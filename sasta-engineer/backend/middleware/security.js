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

// Rate limiting for login attempts - temporarily disabled for testing
const loginRateLimit = (req, res, next) => {
    // Temporarily bypass rate limiting for testing
    next();
};

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
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.originalUrl;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';
    
    console.log(`[${timestamp}] ${method} ${url} - IP: ${ip} - UA: ${userAgent.substring(0, 50)}...`);
    
    // Log authentication attempts
    if (url.includes('/login') && method === 'POST') {
        console.log(`🔐 Login attempt from IP: ${ip} for email: ${req.body?.email || 'unknown'}`);
    }
    
    next();
};

// Security validation middleware
const validateRequest = (req, res, next) => {
    // Check for suspicious patterns
    const suspiciousPatterns = [
        /script/i,
        /javascript/i,
        /vbscript/i,
        /onload/i,
        /onerror/i,
        /<script/i,
        /<\/script/i,
        /\$where/i,
        /\$ne/i,
        /\$gt/i,
        /\$lt/i,
        /union/i,
        /select/i,
        /insert/i,
        /delete/i,
        /drop/i,
        /update/i
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
        
        const allowedOrigins = [
            // Vercel production frontend
            'https://sasta-engineer.vercel.app',

            'http://localhost:3030',
            'http://127.0.0.1:3030',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3031',
            'http://127.0.0.1:3031'
        ].concat(envOrigins);
        
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
