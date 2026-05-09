const User = require('../models/user');
const Fixer = require('../models/fixer');
const OTP = require('../models/otp');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const smsService = require('../utils/smsService');

function normalizeEmail(email) {
    if (typeof email !== 'string') return '';
    return email.trim().toLowerCase();
}

function normalizeUsername(username) {
    if (typeof username !== 'string') return '';
    return username.trim();
}

function normalizePhone(phone) {
    if (typeof phone !== 'string') return '';
    return phone.trim();
}

function getRefreshCookieMaxAgeMs() {
    const raw = process.env.JWT_REFRESH_EXPIRE;
    const days = Number.parseInt(raw, 10);
    // Default to 7 days if missing/invalid
    const safeDays = Number.isFinite(days) && days > 0 ? days : 7;
    return safeDays * 24 * 60 * 60 * 1000;
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
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { name, username, email, phone, password, address } = req.body;

        // Full body log for debugging (never log raw password)
        const bodyForLog = { ...req.body };
        if (bodyForLog.password) bodyForLog.password = '[REDACTED]';
        console.log('🧾 registerUser raw req.body:', JSON.stringify(bodyForLog));

        const normalizedEmail =
            typeof email === 'string' ? email.trim().toLowerCase() : normalizeEmail(email);

        const normalized = {
            email: normalizedEmail,
            username: normalizeUsername(username),
            phone: normalizePhone(phone)
        };

        console.log('📧 registerUser received email:', email);
        console.log('📧 registerUser normalized email:', normalized.email);

        console.log('📝 User registration attempt', {
            email: normalized.email,
            username: normalized.username,
            phone: normalized.phone,
            hasAddress: !!address
        });

        const skipEmailDup =
            process.env.SKIP_REGISTRATION_EMAIL_DUPLICATE_CHECK === 'true';
        const debugRegistration = process.env.DEBUG_REGISTRATION === 'true';

        // Duplicate checks (only for non-empty values)
        const duplicateCheck = {
            email: normalized.email,
            phone: normalized.phone,
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
            const phoneExists = await User.findOne({ phone: duplicateCheck.phone }).select('_id');
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

        const phoneForSave = normalized.phone || phone;

        console.log('📝 registerUser User.create (safe)', {
            name,
            username: finalUsername,
            email: normalized.email,
            phone: phoneForSave,
            hasPassword: typeof password === 'string' && password.length > 0,
            addressPresent: !!address
        });

        let user;
        try {
            user = await User.create({
                name,
                username: finalUsername,
                email: normalized.email || email,
                phone: phoneForSave,
                password,
                address
            });
        } catch (saveErr) {
            console.error('❌ User.create / save failed:', saveErr?.message);
            console.error(saveErr?.stack);
            throw saveErr;
        }

        // Generate OTP for phone verification
        const otp = await OTP.createOTP(phoneForSave, 'phone_verification', 'user', user._id);

        // Send OTP SMS
        try {
            console.log('📱 Phone verification OTP:', otp.otp);
            await smsService.sendOTP(phoneForSave, otp.otp, 'user');
            console.log('✅ SMS sent successfully to:', phoneForSave);
        } catch (smsError) {
            console.error('❌ SMS sending failed:', smsError.message);
            console.log('⚠️ Registration continues without SMS verification');
            console.log('🔑 OTP for testing:', otp.otp);
        }

        // Generate token
        let token;
        try {
            token = user.getSignedJwtToken();
        } catch (jwtErr) {
            console.error('❌ JWT sign failed after registration:', jwtErr?.message);
            console.error(jwtErr?.stack);
            throw jwtErr;
        }

        const successBody = {
            success: true,
            message: 'User registered successfully. Please check your phone for OTP verification.',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    username: user.username,
                    phone: user.phone,
                    address: user.address,
                    isPhoneVerified: user.isPhoneVerified
                },
                token,
                otp: otp.otp // Include OTP in response for testing
            }
        };

        console.log('✅ registerUser saved user:', {
            id: String(user._id),
            email: user.email,
            phone: user.phone,
            username: user.username
        });
        console.log(
            '📤 registerUser final response (201):',
            JSON.stringify({
                success: successBody.success,
                message: successBody.message,
                userEmail: successBody.data.user.email
            })
        );

        res.status(201).json(successBody);

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
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, username, email, phone, password, serviceCategory, address } = req.body;

        // Check if fixer already exists
        const existingFixer = await Fixer.findOne({
            $or: [{ email }, { username }, { phone }]
        });

        if (existingFixer) {
            return res.status(400).json({
                success: false,
                message: 'Fixer with this email, username, or phone already exists'
            });
        }

        // Create fixer
        const fixer = await Fixer.create({
            name,
            username,
            email,
            phone,
            password,
            serviceCategory,
            address
        });

        // Generate OTP for phone verification
        const otp = await OTP.createOTP(phone, 'phone_verification', 'fixer', fixer._id);

        // Send OTP SMS
        try {
            console.log('📱 Fixer Phone verification OTP:', otp.otp);
            await smsService.sendOTP(phone, otp.otp, 'fixer');
            console.log('✅ SMS sent successfully to:', phone);
        } catch (smsError) {
            console.error('❌ SMS sending failed:', smsError.message);
            console.log('⚠️ Registration continues without SMS verification');
            console.log('🔑 OTP for testing:', otp.otp);
        }

        // Generate token
        const token = fixer.getSignedJwtToken();

        res.status(201).json({
            success: true,
            message: 'Fixer registered successfully. Please check your phone for OTP verification.',
            data: {
                fixer: {
                    id: fixer._id,
                    name: fixer.name,
                    email: fixer.email,
                    username: fixer.username,
                    phone: fixer.phone,
                    address: fixer.address,
                    serviceCategory: fixer.serviceCategory,
                    isPhoneVerified: fixer.isPhoneVerified
                },
                token,
                otp: otp.otp // Include OTP in response for testing
            }
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

        // Set secure cookie for refresh token
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: getRefreshCookieMaxAgeMs()
        });

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
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email, password } = req.body;

        // Check if fixer exists
        const fixer = await Fixer.findOne({ email }).select('+password');
        if (!fixer) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if password matches
        const isMatch = await fixer.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if fixer is active
        if (!fixer.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated. Please contact support.'
            });
        }

        // Update last login
        fixer.lastLogin = new Date();
        await fixer.save();

        // Generate token
        const token = fixer.getSignedJwtToken();

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
                    isPhoneVerified: fixer.isPhoneVerified,
                    verificationStatus: fixer.verificationStatus
                },
                token
            }
        });

    } catch (error) {
        console.error('Fixer login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during fixer login',
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

        // Find valid OTP
        const otpRecord = await OTP.findValidOTP(phone, otp, 'phone_verification');
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

        // Update user/fixer phone verification status
        if (userType === 'user') {
            await User.findByIdAndUpdate(otpRecord.userId, {
                isPhoneVerified: true
            });
        } else if (userType === 'fixer') {
            await Fixer.findByIdAndUpdate(otpRecord.userId, {
                isPhoneVerified: true
            });
        }

        res.status(200).json({
            success: true,
            message: 'Phone verified successfully'
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

        // Find user/fixer
        let user;
        if (userType === 'user') {
            user = await User.findOne({ phone });
        } else if (userType === 'fixer') {
            user = await Fixer.findOne({ phone });
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Delete existing OTPs for this user
        await OTP.deleteMany({
            email,
            userType,
            userId: user._id
        });

        // Generate new OTP
        const otp = await OTP.createOTP(phone, 'phone_verification', userType, user._id);

        // Send OTP SMS
        try {
            await smsService.sendOTP(phone, otp.otp, userType);
            console.log('✅ SMS sent successfully to:', phone);
        } catch (smsError) {
            console.error('❌ SMS sending failed:', smsError.message);
            console.log('⚠️ OTP resend continues without SMS');
            console.log('🔑 OTP for testing:', otp.otp);
        }

        res.status(200).json({
            success: true,
            message: 'New verification code sent successfully'
        });

    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during OTP resend'
        });
    }
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
    verifyOTP,
    resendOTP,
    getMe
};



