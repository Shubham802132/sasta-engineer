const express = require('express');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const fixerRoutes = require('./routes/fixerRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const publicRoutes = require('./routes/publicRoutes');
const onlineFixersRoutes = require('./routes/onlineFixersRoutes');
const smsService = require('./utils/smsService');

const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const {
    securityHeaders,
    apiRateLimit,
    sanitizeData,
    requestLogger,
    validateRequest,
    corsOptions
} = require('./middleware/security');

const app = express();

app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(compression());
app.use(cookieParser());
app.use(requestLogger);
app.use(sanitizeData);
app.use(validateRequest);
app.use('/api/', apiRateLimit);
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
    const healthy = dbState === 1 || process.env.NODE_ENV !== 'production';

    res.status(healthy ? 200 : 503).json({
        success: healthy,
        message: healthy ? 'FIXGHAR API is running' : 'API up but database unavailable',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: dbStatus,
        sms: smsService.getDiagnostics()
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/fixers', onlineFixersRoutes);
app.use('/api', publicRoutes);
app.use('/api/fixers', fixerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
