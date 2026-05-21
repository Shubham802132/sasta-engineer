const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, 'config.env'), override: false });

const app = require('./src/app');
const connectDB = require('./src/config/database');
const { startPresenceJanitor } = require('./src/utils/presenceService');

const PORT = process.env.PORT || 5000;

(() => {
    const isProd = process.env.NODE_ENV === 'production';
    const required = isProd ? ['PORT', 'JWT_SECRET', 'MONGODB_URI'] : ['PORT'];
    const missing = required.filter((k) => !process.env[k]);

    const clientUrl =
        process.env.CLIENT_URL || process.env.FRONTEND_URL || process.env.CORS_ORIGINS;
    if (!clientUrl) {
        console.warn(
            '⚠️ CLIENT_URL / FRONTEND_URL / CORS_ORIGINS not set. Set your Vercel URL for production CORS.'
        );
    }

    if (missing.length) {
        console.warn(`⚠️ Missing environment variables: ${missing.join(', ')}`);
    }
})();

const startServer = async () => {
    try {
        await connectDB();
        startPresenceJanitor();

        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log('='.repeat(60));
            console.log('🚀 FIXGHAR Backend started');
            console.log(`📡 http://localhost:${PORT}`);
            console.log(`📊 Health: http://localhost:${PORT}/api/health`);
            console.log('='.repeat(60));
        });

        server.on('error', (err) => {
            if (err?.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use.`);
                process.exit(1);
            }
            console.error('❌ Server listen error:', err);
            process.exit(1);
        });
    } catch (error) {
        console.error('❌ Server startup error:', error);
        process.exit(1);
    }
};

process.on('unhandledRejection', (err) => {
    console.error(`❌ Unhandled Promise Rejection: ${err?.message}`);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error(`❌ Uncaught Exception: ${err?.message}`);
    process.exit(1);
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

startServer();
