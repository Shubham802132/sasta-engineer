const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Fixer = require('../models/fixer');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.fixghar_token) {
        token = req.cookies.fixghar_token;
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized to access this route'
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from token
        let user;
        if (decoded.role === 'fixer') {
            user = await Fixer.findById(decoded.id);
        } else {
            user = await User.findById(decoded.id);
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated. Please contact support.'
            });
        }

        // Add user to request object
        req.user = {
            id: user._id,
            role: decoded.role,
            ...(decoded.serviceCategory && { serviceCategory: decoded.serviceCategory })
        };

        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({
            success: false,
            message: 'Not authorized to access this route'
        });
    }
};

// Grant access to specific roles
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to access this route'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role '${req.user.role}' is not authorized to access this route`
            });
        }

        next();
    };
};

// Grant access to specific service categories (for fixers)
const authorizeServiceCategory = (...categories) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to access this route'
            });
        }

        if (req.user.role !== 'fixer') {
            return res.status(403).json({
                success: false,
                message: 'Only fixers can access this route'
            });
        }

        if (!req.user.serviceCategory || !categories.includes(req.user.serviceCategory)) {
            return res.status(403).json({
                success: false,
                message: `Fixers with service category '${req.user.serviceCategory}' are not authorized to access this route`
            });
        }

        next();
    };
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
    let token;

    // Check if token exists in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.fixghar_token) {
        token = req.cookies.fixghar_token;
    }

    // If no token, continue without authentication
    if (!token) {
        console.log('❌ No token provided, setting req.user = null');
        req.user = null;
        return next();
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ Token decoded successfully:', decoded);

        // Get user from token
        let user;
        if (decoded.role === 'fixer') {
            user = await Fixer.findById(decoded.id);
        } else {
            user = await User.findById(decoded.id);
        }

        console.log('👤 User found:', user ? { id: user._id, name: user.name, email: user.email } : 'No user found');

        if (user && user.isActive) {
            // Add user to request object
            req.user = {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: decoded.role,
                ...(decoded.serviceCategory && { serviceCategory: decoded.serviceCategory })
            };
            console.log('✅ User authenticated successfully:', req.user);
        } else {
            console.log('❌ User not found or inactive');
            req.user = null;
        }

        next();
    } catch (error) {
        console.log('❌ Token verification failed:', error.message);
        // If token is invalid, continue without authentication
        req.user = null;
        next();
    }
};

module.exports = {
    protect,
    authorize,
    authorizeServiceCategory,
    optionalAuth
};



