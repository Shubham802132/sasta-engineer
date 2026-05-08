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
        const normalized = {
            email: normalizeEmail(email),
            username: normalizeUsername(username),
            phone: normalizePhone(phone)
        };

        console.log('🧾 registerUser req.body (safe)', {
            email,
            username,
            phone,
            hasPassword: typeof password === 'string' && password.length > 0,
            hasAddress: !!address
        });

        console.log('📝 User registration attempt', {
            email: normalized.email,
            username: normalized.username,
            phone: normalized.phone,
            hasAddress: !!address
        });

        // Duplicate checks (only for non-empty values)
        const duplicateCheck = {
            email: normalized.email,
            phone: normalized.phone,
            username: normalized.username
        };
        console.log('🔎 Duplicate check conditions', duplicateCheck);

        if (duplicateCheck.email) {
            const emailExists = await User.findOne({ email: duplicateCheck.email }).select('_id');
            if (emailExists) {
                return res.status(409).json({
                    success: false,
                    message: 'Email already exists',
                    field: 'email'
                });
            }
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

        // Create user
        const user = await User.create({
            name,
            username: normalized.username || username,
            email: normalized.email || email,
            phone: normalized.phone || phone,
            password,
            address
        });

        // Generate OTP for phone verification
        const otp = await OTP.createOTP(phone, 'phone_verification', 'user', user._id);

        // Send OTP SMS
        try {
            console.log('📱 Phone verification OTP:', otp.otp);
            await smsService.sendOTP(phone, otp.otp, 'user');
            console.log('✅ SMS sent successfully to:', phone);
        } catch (smsError) {
            console.error('❌ SMS sending failed:', smsError.message);
            console.log('⚠️ Registration continues without SMS verification');
            console.log('🔑 OTP for testing:', otp.otp);
        }

        // Generate token
        const token = user.getSignedJwtToken();

        res.status(201).json({
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
        });

    } catch (error) {
        console.error('User registration error:', {
            name: error?.name,
            code: error?.code,
            message: error?.message,
            errors: error?.errors ? Object.keys(error.errors) : undefined,
            stack: process.env.NODE_ENV === 'production' ? undefined : error?.stack
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
        
        res.status(500).json({
            success: false,
            message: 'Server error during user registration',
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
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



