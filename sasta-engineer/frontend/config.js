// FIXGHAR Frontend Configuration
const isLocal =
    typeof window !== 'undefined' &&
    window.location &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const FRONTEND_CONFIG = {
    api: {
        baseURL: isLocal ? 'http://localhost:5000/api' : 'https://fixghar.onrender.com/api',
        timeout: 60000,
        endpoints: {
            auth: {
                userRegister: '/auth/user/signup',
                fixerRegister: '/auth/fixer/signup',
                login: '/auth/login',
                verifyOTP: '/auth/verify-otp',
                resendOTP: '/auth/resend-otp',
                getMe: '/auth/me',
                logout: '/auth/logout'
            }
        }
    },
    frontend: {
        baseURL: isLocal ? 'http://localhost:3030' : window.location?.origin || '',
        features: {
            enableOTP: true,
            enableFileUpload: true
        }
    },
    validation: {
        user: {
            name: { min: 2, max: 50 },
            email: { max: 100 },
            phone: { min: 10, max: 15 },
            password: { min: 8, max: 100 }
        },
        fixer: {
            name: { min: 2, max: 50 },
            email: { max: 100 },
            phone: { min: 10, max: 15 },
            password: { min: 8, max: 100 },
            serviceCategory: { required: true }
        }
    }
};

if (typeof window !== 'undefined') {
    window.FIXGHAR_CONFIG = FRONTEND_CONFIG;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FRONTEND_CONFIG;
}
