// FIXGHAR Frontend Configuration
// This file contains frontend-specific configuration and makes backend config available

// Frontend Configuration
const FRONTEND_CONFIG = {
    // Backend API Configuration
    api: {
        baseURL: baseURL: 'https://fixghar.onrender.com/api',
        timeout: 60000, // 60 seconds
        endpoints: {
            // Authentication
            auth: {
                userRegister: '/auth/register/user',
                fixerRegister: '/auth/register/fixer',
                userLogin: '/auth/login/user',
                fixerLogin: '/auth/login/fixer',
                verifyOTP: '/auth/verify-otp',
                resendOTP: '/auth/resend-otp',
                getMe: '/auth/me',
                logout: '/auth/logout'
            },
            // User Management
            user: {
                profile: '/user/profile',
                updateProfile: '/user/profile',
                bookings: '/user/bookings',
                bookingHistory: '/user/bookings/history'
            },
            // Fixer Management
            fixer: {
                profile: '/fixer/profile',
                updateProfile: '/fixer/profile',
                services: '/fixer/services',
                bookings: '/fixer/bookings',
                availability: '/fixer/availability',
                reviews: '/fixer/reviews'
            },
            // Services
            services: {
                all: '/services',
                byCategory: '/services/category',
                search: '/services/search',
                popular: '/services/popular',
                byId: '/services'
            },
            // Bookings
            bookings: {
                create: '/bookings',
                all: '/bookings',
                byId: '/bookings',
                update: '/bookings',
                cancel: '/bookings',
                review: '/bookings',
                messages: '/bookings',
                progress: '/bookings'
            }
        }
    },

    // Frontend Configuration
    frontend: {
        baseURL: 'http://localhost:3030',
        features: {
            enableOTP: true,
            enableFileUpload: true,
            enableRealTimeChat: false,
            enablePushNotifications: false
        }
    },

    // Validation Rules
    validation: {
        user: {
            name: { min: 2, max: 50 },
            username: { min: 3, max: 30 },
            email: { max: 100 },
            phone: { min: 10, max: 15 },
            password: { min: 6, max: 100 }
        },
        fixer: {
            name: { min: 2, max: 50 },
            username: { min: 3, max: 30 },
            email: { max: 100 },
            phone: { min: 10, max: 15 },
            password: { min: 6, max: 100 },
            serviceCategory: { required: true },
            experience: { min: 0, max: 50 }
        }
    },

    // Error Messages
    messages: {
        auth: {
            userNotFound: 'User not found',
            invalidCredentials: 'Invalid email or password',
            userExists: 'User with this email already exists',
            invalidOTP: 'Invalid or expired OTP',
            emailNotVerified: 'Please verify your email first'
        },
        validation: {
            required: 'This field is required',
            invalidEmail: 'Please enter a valid email address',
            passwordMismatch: 'Passwords do not match',
            weakPassword: 'Password must be at least 6 characters long'
        },
        server: {
            internalError: 'Internal server error',
            databaseError: 'Database connection error',
            validationError: 'Validation error'
        }
    },

    // Status Codes
    statusCodes: {
        success: 200,
        created: 201,
        badRequest: 400,
        unauthorized: 401,
        forbidden: 403,
        notFound: 404,
        conflict: 409,
        internalServer: 500
    }
};

// Make config available globally for frontend use
window.FIXGHAR_CONFIG = FRONTEND_CONFIG;

// Environment-specific overrides
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    FRONTEND_CONFIG.api.baseURL = 'https://fixghar.onrender.com/api';
    FRONTEND_CONFIG.frontend.baseURL = 'http://localhost:3030';
}

// Force correct API URL regardless of current port
FRONTEND_CONFIG.api.baseURL = 'https://fixghar.onrender.com/api';

// Auto-detect current port and update frontend URL
if (typeof window !== 'undefined' && window.location) {
    const currentPort = window.location.port;
    if (currentPort) {
        FRONTEND_CONFIG.frontend.baseURL = `http://localhost:${currentPort}`;
        console.log(`🔧 Auto-detected frontend port: ${currentPort}`);
    }
}

// Debug: Log current configuration
console.log('🔧 Current Configuration:');
console.log('  - API Base URL:', FRONTEND_CONFIG.api.baseURL);
console.log('  - Frontend URL:', FRONTEND_CONFIG.frontend.baseURL);
console.log('  - Current Location:', window.location.href);

// Ensure this config takes precedence
console.log('🚀 FIXGHAR Frontend Config Loaded!');
console.log('📡 API Base URL:', FRONTEND_CONFIG.api.baseURL);
console.log('🌐 Current Location:', window.location.href);

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = FRONTEND_CONFIG;
} else if (typeof window !== 'undefined') {
    // Browser environment
    window.FIXGHAR_CONFIG = FRONTEND_CONFIG;
}

// For ES6 modules
if (typeof exports !== 'undefined') {
    exports.default = FRONTEND_CONFIG;
}

console.log('✅ FIXGHAR Frontend Configuration loaded successfully!');
console.log('🌐 API Base URL:', FRONTEND_CONFIG.api.baseURL);
console.log('🏠 Frontend URL:', FRONTEND_CONFIG.frontend.baseURL);
