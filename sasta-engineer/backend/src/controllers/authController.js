const User = require('../models/user');
const Fixer = require('../models/fixer');
const OTP = require('../models/otp');
const PendingRegistration = require('../models/pendingRegistration');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const smsService = require('../utils/smsService');
const { setFixerOnline, setFixerOffline } = require('../utils/presenceService');

function normalizeEmail(email) {
    if (typeof email !== 'string') return '';
    return email.trim().toLowerCase();
}

function normalizeUsername(username) {
    if (typeof username !== 'string') return '';
    return username.trim();
}

function getRefreshCookieMaxAgeMs() {
    const raw = process.env.JWT_REFRESH_EXPIRE;
    const days = Number.parseInt(raw, 10);
    const safeDays = Number.isFinite(days) && days > 0 ? days : 7;
    return safeDays * 24 * 60 * 60 * 1000;
}

function parseExpireToMs(expire) {
    if (!expire) return 24 * 60 * 60 * 1000;
    const match = String(expire).match(/^(\d+)([dhms])$/i);
    if (!match) return 24 * 60 * 60 * 1000;
    const n = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return n * (mult[unit] || 3600000);
}

function getAccessCookieMaxAgeMs() {
    return parseExpireToMs(process.env.JWT_EXPIRE);
}

function setAuthCookies(res, token, refreshToken) {
    const isProd = process.env.NODE_ENV === 'production';
    const base = {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax'
    };
    res.cookie('fixghar_token', token, { ...base, maxAge: getAccessCookieMaxAgeMs() });
    if (refreshToken) {
        res.cookie('refreshToken', refreshToken, {
            ...base,
            maxAge: getRefreshCookieMaxAgeMs()
        });
    }
}

function clearAuthCookies(res) {
    const isProd = process.env.NODE_ENV === 'production';
    const base = { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax' };
    res.clearCookie('fixghar_token', base);
    res.clearCookie('refreshToken', base);
}

function ensureAuthPrereqs(res) {
    if (!process.env.JWT_SECRET) {
        res.status(500).json({
            success: false,
            message: 'Server misconfigured: JWT_SECRET is not set'
        });
        return false;
    }

    // If Mongo is disconnected, login cannot query users reliably.
    if (mongoose.connection.readyState !== 1) {
        res.status(503).json({
            success: false,
            message: 'Database unavailable. Please try again shortly.'
        });
        return false;
    }

    return true;
}

/** User schema requires username; frontend may omit it — generate a unique handle from email. */
async function generateUniqueUsernameForUser(normalizedEmail) {
    const localRaw = (normalizedEmail || '').split('@')[0] || 'user';
    let base = localRaw
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    if (!base || base.length < 3) base = 'user';
    base = base.slice(0, 22);

    for (let i = 0; i < 5000; i++) {
        const candidate = (i === 0 ? base : `${base}_${i}`).slice(0, 30);
        const exists = await User.findOne({ username: candidate }).select('_id');
        if (!exists) return candidate;
    }

    return `u_${Date.now()}_${Math.floor(Math.random() * 10000)}`.slice(0, 30);
}

// @desc    Register User
// @route   POST /api/auth/register/user
// @access  Public
const registerUser = async (req, res) => {
    try {
        if (!ensureAuthPrereqs(res)) return;

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const list = errors.array({ onlyFirstError: true }) || [];
            const first = list[0];
            // Detailed logs to pinpoint which field fails in production.
            console.error('❌ registerUser validation failed:', JSON.stringify(list, null, 2));
            const bodyForLog = { ...req.body };
            if (bodyForLog.password) bodyForLog.password = '[REDACTED]';
            console.error('❌ registerUser invalid req.body (password redacted):', JSON.stringify(bodyForLog));
            return res.status(400).json({
                success: false,
                message: first?.msg || 'Validation failed',
                field: first?.path,
                code: 'VALIDATION_ERROR',
                errors: list
            });
        }

        const { name, username, email, phone, password, address } = req.body;

        // Full body log for debugging (never log raw password)
        const bodyForLog = { ...req.body };
        if (bodyForLog.password) bodyForLog.password = '[REDACTED]';
        console.log('🧾 registerUser raw req.body:', JSON.stringify(bodyForLog));

        const phoneNorm = smsService.normalizeIndianToE164(phone);
        if (!phoneNorm.ok) {
            return res.status(400).json({
                success: false,
                message: phoneNorm.error || 'Invalid phone number',
                field: 'phone',
                code: 'INVALID_PHONE'
            });
        }
        const phoneForSave = phoneNorm.e164;
        console.log('📱 [OTP] register/user phone from client:', phone);
        console.log('📱 [OTP] normalized E.164 before OTP/SMS:', phoneForSave);

        const normalizedEmail =
            typeof email === 'string' ? email.trim().toLowerCase() : normalizeEmail(email);

        const normalized = {
            email: normalizedEmail,
            username: normalizeUsername(username)
        };

        console.log('📧 registerUser received email:', email);
        console.log('📧 registerUser normalized email:', normalized.email);

        console.log('📝 User registration attempt', {
            email: normalized.email,
            username: normalized.username,
            phone: phoneForSave,
            hasAddress: !!address
        });

        const skipEmailDup =
            process.env.SKIP_REGISTRATION_EMAIL_DUPLICATE_CHECK === 'true';
        const debugRegistration = process.env.DEBUG_REGISTRATION === 'true';

        // Duplicate checks (only for non-empty values)
        const duplicateCheck = {
            email: normalized.email,
            phone: phoneForSave,
            username: normalized.username
        };
        console.log('🔎 Duplicate check conditions', duplicateCheck);

        if (duplicateCheck.email && !skipEmailDup) {
            const emailQuery = { email: normalized.email };
            console.log(
                '🔎 MongoDB duplicate query (email): User.findOne(',
                JSON.stringify(emailQuery),
                ')'
            );

            const emailExists = await User.findOne(emailQuery).select(
                '_id email username phone createdAt'
            );

            console.log('🔎 Duplicate query result (email):', {
                found: !!emailExists,
                matchedUser: emailExists
                    ? {
                          _id: String(emailExists._id),
                          email: emailExists.email,
                          username: emailExists.username,
                          phone: emailExists.phone,
                          createdAt: emailExists.createdAt
                      }
                    : null
            });

            if (emailExists) {
                const payload = {
                    success: false,
                    message: 'Email already exists',
                    field: 'email',
                    normalizedEmailChecked: normalized.email
                };
                if (debugRegistration) {
                    payload.debug = {
                        query: emailQuery,
                        matchedUser: {
                            _id: String(emailExists._id),
                            email: emailExists.email,
                            username: emailExists.username,
                            phone: emailExists.phone,
                            createdAt: emailExists.createdAt
                        }
                    };
                }
                console.log(
                    '📤 registerUser final response (409 email conflict):',
                    JSON.stringify(payload)
                );
                return res.status(409).json(payload);
            }
        } else if (duplicateCheck.email && skipEmailDup) {
            console.warn(
                '⚠️ SKIP_REGISTRATION_EMAIL_DUPLICATE_CHECK=true — email duplicate check skipped (testing only)'
            );
        }

        if (duplicateCheck.phone) {
            const phoneExists = await User.findOne({
                $or: [
                    { phone: duplicateCheck.phone },
                    { phone: duplicateCheck.phone.replace(/^\+91/, '') }
                ]
            }).select('_id');
            if (phoneExists) {
                return res.status(409).json({
                    success: false,
                    message: 'Phone already exists',
                    field: 'phone'
                });
            }
        }

        // Username is optional for duplicate checking if empty
        if (duplicateCheck.username) {
            const usernameExists = await User.findOne({ username: duplicateCheck.username }).select('_id');
            if (usernameExists) {
                return res.status(409).json({
                    success: false,
                    message: 'Username already exists',
                    field: 'username'
                });
            }
        }

        let finalUsername = normalized.username;
        if (!finalUsername) {
            console.log('📝 registerUser: username omitted — generating unique username');
            finalUsername = await generateUniqueUsernameForUser(normalized.email);
            console.log('📝 registerUser generated username:', finalUsername);
        }

        // Create/replace pending registration so account is created only after OTP verification
        await PendingRegistration.deleteMany({
            userType: 'user',
            $or: [{ email: normalized.email }, { phone: phoneForSave }]
        });

        const pending = await PendingRegistration.create({
            userType: 'user',
            name,
            username: finalUsername,
            email: normalized.email || email,
            phone: phoneForSave,
            password,
            address
        });

        const otpCode = smsService.generateOTP();
        console.log(
            '📱 [OTP] OTP generated for pending user:',
            process.env.NODE_ENV === 'production' ? '[generated]' : otpCode
        );

        const smsResult = await smsService.sendOTP(phoneForSave, otpCode, 'user');
        const otpDelivery = {
            status: smsResult.success ? 'sent' : 'failed',
            provider: smsResult.provider || null,
            code: smsResult.code || null,
            detail: smsResult.message || null,
            testMode: !!smsResult.testMode
        };
        if (smsResult.success && smsResult.testMode) otpDelivery.status = 'test_mode';

        if (!smsResult.success) {
            await PendingRegistration.deleteOne({ _id: pending._id });
            return res.status(502).json({
                success: false,
                message: smsResult.message || 'SMS provider error.',
                code: smsResult.code || 'SMS_PROVIDER_ERROR',
                otpDelivery
            });
        }

        const otpRecord = await OTP.createOTPWithCode(
            phoneForSave,
            otpCode,
            'phone_verification',
            'user',
            pending._id
        );

        let registerMessage = 'OTP sent successfully — verify to create your account.';
        if (otpDelivery.status === 'test_mode') {
            registerMessage = 'OTP generated (test mode). Verify OTP to create your account.';
        }

        const responseData = {
            phone: phoneForSave,
            otpDelivery
        };
        if (process.env.NODE_ENV !== 'production') {
            responseData.otp = otpRecord.otp;
        }

        return res.status(201).json({
            success: true,
            message: registerMessage,
            data: responseData
        });

    } catch (error) {
        console.error('User registration error.message:', error?.message);
        console.error('User registration error.stack:', error?.stack);
        console.error('User registration error (detail):', {
            name: error?.name,
            code: error?.code,
            errors: error?.errors ? Object.keys(error.errors) : undefined
        });
        
        // Handle duplicate key error
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            const value = error.keyValue[field];
            
            let message = '';
            if (field === 'email') {
                message = 'Email already exists. Please use a different email.';
            } else if (field === 'username') {
                message = 'Username already exists. Please choose a different username.';
            } else if (field === 'phone') {
                message = 'Phone number already exists. Please use a different phone number.';
            } else {
                message = `${field} already exists. Please use a different ${field}.`;
            }
            
            return res.status(409).json({
                success: false,
                message: message,
                field: field,
                value: value
            });
        }

        // Handle mongoose validation errors (bad/weak password, missing fields, invalid email, etc.)
        if (error?.name === 'ValidationError') {
            const fieldErrors = Object.values(error.errors || {}).map((e) => ({
                field: e.path,
                message: e.message
            }));

            const primaryMessage =
                fieldErrors[0]?.message ||
                'Invalid registration data';

            return res.status(400).json({
                success: false,
                message: primaryMessage,
                errors: fieldErrors
            });
        }

        if (error?.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: error.message || 'Invalid data format'
            });
        }

        const jwtRelated =
            error?.name === 'JsonWebTokenError' ||
            error?.name === 'TokenExpiredError' ||
            (typeof error?.message === 'string' &&
                error.message.toLowerCase().includes('jwt'));

        if (jwtRelated) {
            return res.status(500).json({
                success: false,
                message:
                    error?.message ||
                    'Token signing failed. Check JWT_SECRET and JWT_EXPIRE on the server.'
            });
        }

        res.status(500).json({
            success: false,
            message:
                error?.message ||
                'Registration failed due to an unexpected error.'
        });
    }
};

// @desc    Register Fixer
// @route   POST /api/auth/register/fixer
// @access  Public
const registerFixer = async (req, res) => {
    try {
        if (!ensureAuthPrereqs(res)) return;

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const list = errors.array({ onlyFirstError: true }) || [];
            const first = list[0];
            console.error('❌ registerFixer validation failed:', JSON.stringify(list, null, 2));
            const bodyForLog = { ...req.body };
            if (bodyForLog.password) bodyForLog.password = '[REDACTED]';
            console.error('❌ registerFixer invalid req.body (password redacted):', JSON.stringify(bodyForLog));
            return res.status(400).json({
                success: false,
                message: first?.msg || 'Validation failed',
                field: first?.path,
                code: 'VALIDATION_ERROR',
                errors: list
            });
        }

        const { name, username, email, phone, password, serviceCategory, address } = req.body;

        const phoneNorm = smsService.normalizeIndianToE164(phone);
        if (!phoneNorm.ok) {
            return res.status(400).json({
                success: false,
                message: phoneNorm.error || 'Invalid phone number',
                field: 'phone',
                code: 'INVALID_PHONE'
            });
        }
        const phoneForSave = phoneNorm.e164;
        console.log('📱 [OTP] register/fixer phone from client:', phone);
        console.log('📱 [OTP] normalized E.164 before OTP/SMS:', phoneForSave);

        // Check if fixer already exists
        const existingFixer = await Fixer.findOne({
            $or: [
                { email },
                { username },
                { phone: phoneForSave },
                { phone: phoneForSave.replace(/^\+91/, '') }
            ]
        });

        if (existingFixer) {
            return res.status(400).json({
                success: false,
                message: 'Fixer with this email, username, or phone already exists'
            });
        }

        // Create/replace pending fixer registration so account is created only after OTP verification
        await PendingRegistration.deleteMany({
            userType: 'fixer',
            $or: [{ email }, { phone: phoneForSave }]
        });

        const pending = await PendingRegistration.create({
            userType: 'fixer',
            name,
            username,
            email,
            phone: phoneForSave,
            password,
            serviceCategory,
            address
        });

        const otpCode = smsService.generateOTP();
        console.log(
            '📱 [OTP] OTP generated for pending fixer:',
            process.env.NODE_ENV === 'production' ? '[generated]' : otpCode
        );

        const smsResult = await smsService.sendOTP(phoneForSave, otpCode, 'fixer');
        const otpDelivery = {
            status: smsResult.success ? 'sent' : 'failed',
            provider: smsResult.provider || null,
            code: smsResult.code || null,
            detail: smsResult.message || null,
            testMode: !!smsResult.testMode
        };
        if (smsResult.success && smsResult.testMode) otpDelivery.status = 'test_mode';

        if (!smsResult.success) {
            await PendingRegistration.deleteOne({ _id: pending._id });
            return res.status(502).json({
                success: false,
                message: smsResult.message || 'SMS provider error.',
                code: smsResult.code || 'SMS_PROVIDER_ERROR',
                otpDelivery
            });
        }

        const otpRecord = await OTP.createOTPWithCode(
            phoneForSave,
            otpCode,
            'phone_verification',
            'fixer',
            pending._id
        );

        let fixerMsg = 'OTP sent successfully — verify to create your account.';
        if (otpDelivery.status === 'test_mode') {
            fixerMsg = 'OTP generated (test mode). Verify OTP to create your account.';
        }

        const fixerResponseData = {
            phone: phoneForSave,
            otpDelivery
        };
        if (process.env.NODE_ENV !== 'production') {
            fixerResponseData.otp = otpRecord.otp;
        }

        return res.status(201).json({
            success: true,
            message: fixerMsg,
            data: fixerResponseData
        });

    } catch (error) {
        console.error('Fixer registration error:', error);
        
        // Handle duplicate key error
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            const value = error.keyValue[field];
            
            let message = '';
            if (field === 'email') {
                message = 'Email already exists. Please use a different email.';
            } else if (field === 'username') {
                message = 'Username already exists. Please choose a different username.';
            } else if (field === 'phone') {
                message = 'Phone number already exists. Please use a different phone number.';
            } else {
                message = `${field} already exists. Please use a different ${field}.`;
            }
            
            return res.status(400).json({
                success: false,
                message: message,
                field: field,
                value: value
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error during fixer registration',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
};

// @desc    Login User
// @route   POST /api/auth/login/user
// @access  Public
const loginUser = async (req, res) => {
    try {
        if (!ensureAuthPrereqs(res)) return;

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email, password } = req.body;

        // Check if user exists
        const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if account is locked
        if (user.isLocked) {
            const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
            return res.status(423).json({
                success: false,
                message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${lockTimeRemaining} minutes.`,
                lockTimeRemaining
            });
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            // Increment login attempts
            await user.incLoginAttempts();
            
            const attemptsLeft = 5 - (user.loginAttempts + 1);
            return res.status(401).json({
                success: false,
                message: `Invalid credentials. ${attemptsLeft > 0 ? `${attemptsLeft} attempts remaining.` : 'Account will be locked after next failed attempt.'}`
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated. Please contact support.'
            });
        }

        // Check if email is verified (optional - can be made mandatory)
        if (!user.isEmailVerified) {
            console.log(`⚠️ User ${email} logged in with unverified email`);
        }

        // Reset login attempts on successful login
        await user.resetLoginAttempts();

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate tokens
        const token = user.getSignedJwtToken();
        const refreshToken = user.getRefreshToken();
        await user.save(); // Save refresh token

        setAuthCookies(res, token, refreshToken);

        res.status(200).json({
            success: true,
            message: 'User logged in successfully',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    username: user.username,
                    phone: user.phone,
                    address: user.address,
                    isPhoneVerified: user.isPhoneVerified,
                    isEmailVerified: user.isEmailVerified,
                    role: user.role
                },
                token,
                expiresIn: process.env.JWT_EXPIRE
            }
        });

    } catch (error) {
        console.error('User login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during user login',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
};

// @desc    Login Fixer
// @route   POST /api/auth/login/fixer
// @access  Public
const loginFixer = async (req, res) => {
    try {
        if (!ensureAuthPrereqs(res)) return;

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const list = errors.array({ onlyFirstError: true }) || [];
            const first = list[0];
            console.error('[loginFixer] validation failed:', JSON.stringify(list));
            return res.status(400).json({
                success: false,
                message: first?.msg || 'Validation failed',
                field: first?.path,
                code: 'VALIDATION_ERROR',
                errors: list
            });
        }

        const email = normalizeEmail(req.body.email);
        const { password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required',
                code: 'MISSING_CREDENTIALS'
            });
        }

        const fixer = await Fixer.findOne({ email }).select('+password');
        if (!fixer) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS'
            });
        }

        if (!fixer.password) {
            console.error('[loginFixer] fixer has no password hash:', fixer._id);
            return res.status(500).json({
                success: false,
                message: 'Account configuration error. Please contact support.',
                code: 'ACCOUNT_CONFIG_ERROR'
            });
        }

        const isMatch = await fixer.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS'
            });
        }

        if (!fixer.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated. Please contact support.',
                code: 'ACCOUNT_INACTIVE'
            });
        }

        let token;
        try {
            token = fixer.getSignedJwtToken();
        } catch (jwtErr) {
            console.error('[loginFixer] JWT sign failed:', jwtErr.message);
            return res.status(500).json({
                success: false,
                message:
                    'Token signing failed. Set JWT_SECRET and JWT_EXPIRE (e.g. 24h or 7d) on the server.',
                code: 'JWT_CONFIG_ERROR'
            });
        }

        setAuthCookies(res, token);

        try {
            await Fixer.findByIdAndUpdate(fixer._id, { lastLogin: new Date() });
        } catch (saveErr) {
            console.warn('[loginFixer] lastLogin update skipped:', saveErr.message);
        }

        try {
            await setFixerOnline(fixer._id);
        } catch (presenceErr) {
            console.warn('[loginFixer] presence update skipped:', presenceErr.message);
        }

        const onlineFixer = await Fixer.findById(fixer._id).select('isOnline lastSeen');

        res.status(200).json({
            success: true,
            message: 'Fixer logged in successfully',
            data: {
                fixer: {
                    id: fixer._id,
                    name: fixer.name,
                    email: fixer.email,
                    username: fixer.username,
                    phone: fixer.phone,
                    address: fixer.address,
                    serviceCategory: fixer.serviceCategory,
                    role: 'fixer',
                    isPhoneVerified: fixer.isPhoneVerified,
                    verificationStatus: fixer.verificationStatus,
                    isOnline: onlineFixer?.isOnline ?? true,
                    lastSeen: onlineFixer?.lastSeen
                },
                token
            }
        });
    } catch (error) {
        console.error('[loginFixer] unexpected error:', error?.message, error?.stack);

        const jwtRelated =
            error?.name === 'JsonWebTokenError' ||
            (typeof error?.message === 'string' &&
                error.message.toLowerCase().includes('expiresin'));

        if (jwtRelated) {
            return res.status(500).json({
                success: false,
                message:
                    'Token signing failed. Set JWT_EXPIRE to a valid value (e.g. 24h or 7d).',
                code: 'JWT_CONFIG_ERROR'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Unable to complete fixer login. Please try again.',
            code: 'LOGIN_SERVER_ERROR',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { phone, otp, userType } = req.body;

        const phoneNorm = smsService.normalizeIndianToE164(phone);
        if (!phoneNorm.ok) {
            return res.status(400).json({
                success: false,
                message: phoneNorm.error || 'Invalid phone number',
                code: 'INVALID_PHONE'
            });
        }

        // Find valid OTP (stored phone is E.164 after normalization on signup)
        let otpRecord = await OTP.findValidOTP(
            phoneNorm.e164,
            otp,
            'phone_verification'
        );
        if (!otpRecord && phoneNorm.digits10) {
            otpRecord = await OTP.findValidOTP(
                phoneNorm.digits10,
                otp,
                'phone_verification'
            );
        }
        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        // Check if OTP is for the correct user type
        if (otpRecord.userType !== userType) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP for this user type'
            });
        }

        // Mark OTP as used
        await otpRecord.markAsUsed();

        // Update user/fixer phone verification status OR create account from pending registration.
        if (userType === 'user') {
            const existing = await User.findById(otpRecord.userId).select('_id');
            if (existing) {
                await User.findByIdAndUpdate(otpRecord.userId, { isPhoneVerified: true });
            } else {
                const pending = await PendingRegistration.findById(otpRecord.userId).select('+password');
                if (!pending || pending.userType !== 'user') {
                    return res.status(404).json({
                        success: false,
                        message: 'Pending registration expired. Please sign up again.',
                        code: 'PENDING_EXPIRED'
                    });
                }

                const user = await User.create({
                    name: pending.name,
                    username: pending.username,
                    email: pending.email,
                    phone: pending.phone,
                    password: pending.password,
                    address: pending.address,
                    isPhoneVerified: true
                });

                await PendingRegistration.deleteOne({ _id: pending._id });
                await OTP.deleteMany({
                    userId: pending._id,
                    userType: 'user',
                    type: 'phone_verification'
                });

                console.log('✅ [OTP] User created after OTP verification:', String(user._id));
            }
        } else if (userType === 'fixer') {
            const existing = await Fixer.findById(otpRecord.userId).select('_id');
            if (existing) {
                await Fixer.findByIdAndUpdate(otpRecord.userId, { isPhoneVerified: true });
            } else {
                const pending = await PendingRegistration.findById(otpRecord.userId).select('+password');
                if (!pending || pending.userType !== 'fixer') {
                    return res.status(404).json({
                        success: false,
                        message: 'Pending registration expired. Please sign up again.',
                        code: 'PENDING_EXPIRED'
                    });
                }

                const fixer = await Fixer.create({
                    name: pending.name,
                    username: pending.username,
                    email: pending.email,
                    phone: pending.phone,
                    password: pending.password,
                    serviceCategory: pending.serviceCategory,
                    address: pending.address,
                    isPhoneVerified: true
                });

                await PendingRegistration.deleteOne({ _id: pending._id });
                await OTP.deleteMany({
                    userId: pending._id,
                    userType: 'fixer',
                    type: 'phone_verification'
                });

                console.log('✅ [OTP] Fixer created after OTP verification:', String(fixer._id));
            }
        }

        res.status(200).json({
            success: true,
            message: 'Phone verified successfully. You can now login.'
        });

    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during OTP verification'
        });
    }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
const resendOTP = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { phone, userType } = req.body;

        const phoneNorm = smsService.normalizeIndianToE164(phone);
        if (!phoneNorm.ok) {
            return res.status(400).json({
                success: false,
                message: phoneNorm.error || 'Invalid phone number',
                code: 'INVALID_PHONE'
            });
        }

        const phoneOr = [{ phone: phoneNorm.e164 }, { phone: phoneNorm.digits10 }];

        // Find user/fixer
        let user;
        if (userType === 'user') {
            user = await User.findOne({ $or: phoneOr });
        } else if (userType === 'fixer') {
            user = await Fixer.findOne({ $or: phoneOr });
        }

        // If not found, try pending registrations (signup not yet verified)
        let pending = null;
        if (!user) {
            pending = await PendingRegistration.findOne({
                userType,
                $or: [{ phone: phoneNorm.e164 }, { phone: phoneNorm.digits10 }]
            }).select('_id');
            if (!pending) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
        }

        // Delete existing OTPs for this user
        await OTP.deleteMany({
            userId: user ? user._id : pending._id,
            userType,
            type: 'phone_verification'
        });

        // Generate new OTP
        const otp = await OTP.createOTP(
            phoneNorm.e164,
            'phone_verification',
            userType,
            user ? user._id : pending._id
        );

        const smsResult = await smsService.sendOTP(phoneNorm.e164, otp.otp, userType);
        console.log('📲 [resend OTP] SMS result:', smsResult);

        let message = 'New verification code sent successfully.';
        if (smsResult.success && smsResult.testMode) {
            message =
                'OTP regenerated (SMS test mode — SMS not sent to phone). Set SMS_TEST_MODE=false and configure SMS provider.';
        } else if (!smsResult.success) {
            message =
                smsResult.message ||
                'Could not send SMS. Check Twilio/MSG91 configuration and server logs.';
            return res.status(502).json({
                success: false,
                message,
                code: smsResult.code || 'SMS_PROVIDER_ERROR'
            });
        }

        res.status(200).json({
            success: true,
            message
        });

    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during OTP resend'
        });
    }
};

// @desc    Unified login (user or fixer)
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
    const role = (req.body.role || req.body.userType || 'user').toLowerCase();
    if (role === 'fixer') {
        return loginFixer(req, res);
    }
    return loginUser(req, res);
};

// @desc    Logout
// @route   POST /api/auth/logout
// @access  Private (optional)
const logout = async (req, res) => {
    try {
        if (req.user?.role === 'fixer' && req.user?.id) {
            await setFixerOffline(req.user.id);
        }
    } catch (e) {
        console.error('logout presence error:', e.message);
    }
    clearAuthCookies(res);
    res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        let user;
        
        if (req.user.role === 'fixer') {
            user = await Fixer.findById(req.user.id);
        } else {
            user = await User.findById(req.user.id);
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    username: user.username,
                    phone: user.phone,
                    profilePicture: user.profilePicture || '',
                    role: req.user.role,
                    isPhoneVerified: user.isPhoneVerified,
                    address: user.address,
                    createdAt: user.createdAt,
                    ...(req.user.role === 'fixer' && {
                        serviceCategory: user.serviceCategory,
                        verificationStatus: user.verificationStatus,
                        experience: user.experience,
                        hourlyRate: user.hourlyRate,
                        availability: user.availability
                    })
                }
            }
        });

    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

module.exports = {
    registerUser,
    registerFixer,
    loginUser,
    loginFixer,
    login,
    logout,
    verifyOTP,
    resendOTP,
    getMe
};



