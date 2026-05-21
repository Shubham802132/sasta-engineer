const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Security headers middleware
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});

const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 10,
    message: {
        success: false,
        message: 'Too many login attempts. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// General API rate limiting
const apiRateLimit = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Data sanitization middleware
const sanitizeData = [
    // Sanitize data against NoSQL query injection
    mongoSanitize(),
    
    // Sanitize data against XSS
    xss(),
    
    // Prevent parameter pollution
    hpp()
];

// Request logging middleware
const requestLogger = (req, res, next) => {
    if (process.env.NODE_ENV === 'production' && process.env.REQUEST_LOGGING !== 'true') {
        return next();
    }
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
    next();
};

// Security validation middleware
const validateRequest = (req, res, next) => {
    // Check for suspicious patterns
    // Target injection patterns only — avoid blocking normal words like "update" in addresses
    const suspiciousPatterns = [
        /<script\b/i,
        /<\/script>/i,
        /javascript:/i,
        /vbscript:/i,
        /on\w+\s*=/i,
        /\$where\b/i,
        /\{\s*"\$(?:gt|ne|lt|regex)"/i
    ];
    
    const checkObject = (obj, path = '') => {
        for (const key in obj) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                checkObject(obj[key], `${path}.${key}`);
            } else if (typeof obj[key] === 'string') {
                for (const pattern of suspiciousPatterns) {
                    if (pattern.test(obj[key])) {
                        console.log(`🚨 Suspicious pattern detected in ${path}.${key}: ${obj[key]}`);
                        return res.status(400).json({
                            success: false,
                            message: 'Invalid request data detected'
                        });
                    }
                }
            }
        }
    };
    
    checkObject(req.body, 'body');
    checkObject(req.query, 'query');
    checkObject(req.params, 'params');
    
    next();
};

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        const envOrigins = (process.env.CORS_ORIGINS || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

        const isProd = process.env.NODE_ENV === 'production';

        // Production: only allow deployed origins from env (and a safe default fallback)
        // Development: allow localhost + env origins.
        const prodDefaults = ['https://sasta-engineer.vercel.app'];
        const devDefaults = [
            'http://localhost:3030',
            'http://127.0.0.1:3030',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3031',
            'http://127.0.0.1:3031'
        ];

        const allowedOrigins = (isProd ? prodDefaults : prodDefaults.concat(devDefaults)).concat(envOrigins);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log(`🚫 CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

module.exports = {
    securityHeaders,
    loginRateLimit,
    apiRateLimit,
    sanitizeData,
    requestLogger,
    validateRequest,
    corsOptions
};
