const express = require('express');
const { body } = require('express-validator');
const {
    registerUser,
    registerFixer,
    loginUser,
    loginFixer,
    verifyOTP,
    resendOTP,
    getMe
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { loginRateLimit } = require('../middleware/security');

const router = express.Router();

// Validation middleware
const userRegistrationValidation = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters'),
    body('username')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ min: 3, max: 30 })
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('phone')
        .matches(/^[0-9+\-\s()]+$/)
        .withMessage('Please provide a valid phone number'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    body('address.street')
        .trim()
        .notEmpty()
        .withMessage('Street address is required'),
    body('address.city')
        .trim()
        .notEmpty()
        .withMessage('City is required'),
    body('address.state')
        .trim()
        .notEmpty()
        .withMessage('State is required'),
    body('address.zipCode')
        .trim()
        .notEmpty()
        .withMessage('Zip code is required')
];

const fixerRegistrationValidation = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters'),
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('phone')
        .matches(/^[0-9+\-\s()]+$/)
        .withMessage('Please provide a valid phone number'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    body('serviceCategory')
        .isIn(['Plumbing', 'Electrical', 'Carpentry', 'Painting', 'General Repair'])
        .withMessage('Please select a valid service category'),
    body('address.street')
        .trim()
        .notEmpty()
        .withMessage('Street address is required'),
    body('address.city')
        .trim()
        .notEmpty()
        .withMessage('City is required'),
    body('address.state')
        .trim()
        .notEmpty()
        .withMessage('State is required'),
    body('address.zipCode')
        .trim()
        .notEmpty()
        .withMessage('Zip code is required')
];

const loginValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

const otpValidation = [
    body('phone')
        .matches(/^[0-9+\-\s()]+$/)
        .withMessage('Please provide a valid phone number'),
    body('otp')
        .isLength({ min: 6, max: 6 })
        .isNumeric()
        .withMessage('OTP must be exactly 6 digits'),
    body('userType')
        .isIn(['user', 'fixer'])
        .withMessage('User type must be either user or fixer')
];

const resendOtpValidation = [
    body('phone')
        .matches(/^[0-9+\-\s()]+$/)
        .withMessage('Please provide a valid phone number'),
    body('userType')
        .isIn(['user', 'fixer'])
        .withMessage('User type must be either user or fixer')
];

// Routes
router.post('/register/user', userRegistrationValidation, registerUser);
router.post('/register/fixer', fixerRegistrationValidation, registerFixer);
router.post('/login/user', loginRateLimit, loginValidation, loginUser);
router.post('/login/fixer', loginRateLimit, loginValidation, loginFixer);
router.post('/verify-otp', otpValidation, verifyOTP);
router.post('/resend-otp', resendOtpValidation, resendOTP);
router.get('/me', protect, getMe);

module.exports = router;



