const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            console.warn('⚠️ MONGODB_URI is not set. Skipping MongoDB connection.');
            return null;
        }

        const conn = await mongoose.connect(mongoUri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferCommands: false,
            autoIndex: process.env.NODE_ENV !== 'production'
        });
        
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        
        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('⚠️ MongoDB disconnected');
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('🔄 MongoDB reconnected');
        });
        
        return conn;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);

        // Keep existing app behavior: allow running without DB for demo/dev.
        // If you want to fail startup in production, set DB_FAIL_FAST=true.
        const shouldFailFast = process.env.DB_FAIL_FAST === 'true' || process.env.NODE_ENV === 'production';
        if (shouldFailFast) {
            process.exit(1);
        }

        return null;
    }
};

module.exports = connectDB;

