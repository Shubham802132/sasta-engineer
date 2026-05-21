const express = require('express');
const { body } = require('express-validator');
const {
    registerUser,
    registerFixer,
    loginUser,
    loginFixer,
    login,
    logout,
    verifyOTP,
    resendOTP,
    getMe
} = require('../controllers/authController');
const { protect, optionalAuth } = require('../middleware/auth');
const { loginRateLimit } = require('../middleware/security');

const router = express.Router();

const userRegistrationValidation = [
    body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    body('username')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ min: 3, max: 30 })
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username must be 3-30 characters (letters, numbers, underscores)'),
    body('email')
        .isEmail()
        .customSanitizer((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v))
        .withMessage('Please provide a valid email'),
    body('phone')
        .matches(/^[0-9+\-\s()]+$/)
        .withMessage('Please provide a valid phone number'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
        .withMessage(
            'Password must include uppercase, lowercase, a number, and a special character (@$!%*?&)'
        ),
    body('address.street').trim().notEmpty().withMessage('Street address is required'),
    body('address.city').trim().notEmpty().withMessage('City is required'),
    body('address.state').trim().notEmpty().withMessage('State is required'),
    body('address.zipCode').trim().notEmpty().withMessage('Zip code is required')
];

const fixerRegistrationValidation = [
    body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username must be 3-30 characters (letters, numbers, underscores)'),
    body('email')
        .isEmail()
        .customSanitizer((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v))
        .withMessage('Please provide a valid email'),
    body('phone')
        .matches(/^[0-9+\-\s()]+$/)
        .withMessage('Please provide a valid phone number'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
        .withMessage(
            'Password must include uppercase, lowercase, a number, and a special character (@$!%*?&)'
        ),
    body('serviceCategory')
        .isIn(['Plumbing', 'Electrical', 'Carpentry', 'Painting', 'General Repair', 'Multi-Service', 'AC Repair'])
        .withMessage('Please select a valid service category'),
    body('address.street').trim().notEmpty().withMessage('Street address is required'),
    body('address.city').trim().notEmpty().withMessage('City is required'),
    body('address.state').trim().notEmpty().withMessage('State is required'),
    body('address.zipCode').trim().notEmpty().withMessage('Zip code is required')
];

const loginValidation = [
    body('email')
        .isEmail()
        .customSanitizer((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v))
        .withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
    body('role').optional().isIn(['user', 'fixer']).withMessage('Role must be user or fixer'),
    body('userType').optional().isIn(['user', 'fixer']).withMessage('User type must be user or fixer')
];

const otpValidation = [
    body('phone').matches(/^[0-9+\-\s()]+$/).withMessage('Please provide a valid phone number'),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be exactly 6 digits'),
    body('userType').isIn(['user', 'fixer']).withMessage('User type must be either user or fixer')
];

const resendOtpValidation = [
    body('phone').matches(/^[0-9+\-\s()]+$/).withMessage('Please provide a valid phone number'),
    body('userType').isIn(['user', 'fixer']).withMessage('User type must be either user or fixer')
];

// Production routes
router.post('/user/signup', userRegistrationValidation, registerUser);
router.post('/fixer/signup', fixerRegistrationValidation, registerFixer);
router.post('/login', loginRateLimit, loginValidation, login);
router.post('/fixer/login', loginRateLimit, loginValidation, loginFixer);
router.post('/logout', optionalAuth, logout);
router.get('/me', protect, getMe);

// Legacy aliases (keep existing frontend working during migration)
router.post('/register/user', userRegistrationValidation, registerUser);
router.post('/register/fixer', fixerRegistrationValidation, registerFixer);
router.post('/login/user', loginRateLimit, loginValidation, loginUser);
router.post('/login/fixer', loginRateLimit, loginValidation, loginFixer);
router.post('/verify-otp', otpValidation, verifyOTP);
router.post('/resend-otp', resendOtpValidation, resendOTP);

module.exports = router;
