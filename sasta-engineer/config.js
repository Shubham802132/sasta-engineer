// FIXGHAR Core Configuration
// This file contains all the core configuration for frontend-backend integration

const config = {
    // Backend API Configuration
    api: {
        baseURL: 'https://fixghar.onrender.com/api',
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
        baseURL: process.env.NODE_ENV === 'production' 
            ? 'https://your-production-domain.com' 
            : 'http://localhost:3030',
        features: {
            enableOTP: true,
            enableFileUpload: true,
            enableRealTimeChat: false,
            enablePushNotifications: false
        }
    },

    // Database Configuration
    database: {
        mongodb: {
            // Never embed real credentials in frontend-served config.
            // Backend should use `process.env.MONGODB_URI` directly.
            uri: process.env.MONGODB_URI || '',
            options: {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                bufferMaxEntries: 0
            }
        }
    },

    // JWT Configuration
    jwt: {
        // Never ship secrets to the browser; backend must set JWT_SECRET via env.
        secret: process.env.JWT_SECRET || '',
        expiresIn: process.env.JWT_EXPIRE || '7d',
        refreshExpiresIn: '30d'
    },

    // Email Configuration
    email: {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER || 'your-email@gmail.com',
            pass: process.env.EMAIL_PASS || 'your-app-password'
        }
    },

    // File Upload Configuration
    upload: {
        maxSize: process.env.MAX_FILE_SIZE || 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
        path: process.env.UPLOAD_PATH || './uploads'
    },

    // Security Configuration
    security: {
        bcryptRounds: 12,
        rateLimit: {
            windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
            max: process.env.RATE_LIMIT_MAX_REQUESTS || 100
        },
        cors: {
            origin: [
                'http://lhost:3030',
                'http://127.0.0.1:3030',
                'http://lhost:5500',
                'http://127.0.0.1:5500',
                'file://'
            ],
            credentials: true
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

// Environment-specific overrides
if (process.env.NODE_ENV === 'development') {
    config.api.baseURL = 'https://fixghar.onrender.com/api';
    config.frontend.baseURL = 'http://localhost:3030';
}

if (process.env.NODE_ENV === 'test') {
    config.api.baseURL = 'https://fixghar.onrender.com/api';
    config.database.mongodb.uri = 'mongodb://lhost:27017/fixghar_test';
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = config;
} else if (typeof window !== 'undefined') {
    // Browser environment
    window.FIXGHAR_CONFIG = config;
}

// For ES6 modules
if (typeof exports !== 'undefined') {
    exports.default = config;
}
