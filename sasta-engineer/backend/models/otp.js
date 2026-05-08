const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: [true, 'Phone number is required']
    },
    otp: {
        type: String,
        required: [true, 'OTP is required'],
        length: 6
    },
    type: {
        type: String,
        enum: ['phone_verification', 'password_reset', 'login_verification'],
        required: [true, 'OTP type is required']
    },
    userType: {
        type: String,
        enum: ['user', 'fixer'],
        required: [true, 'User type is required']
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'User ID is required']
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    expiresAt: {
        type: Date,
        required: [true, 'Expiry time is required']
    },
    attempts: {
        type: Number,
        default: 0,
        max: [5, 'Maximum attempts exceeded']
    },
    lastAttempt: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for better query performance
otpSchema.index({ phone: 1, type: 1 });
otpSchema.index({ userId: 1, type: 1 });
otpSchema.index({ expiresAt: 1 });
otpSchema.index({ createdAt: 1 });

// Method to check if OTP is expired
otpSchema.methods.isExpired = function() {
    return new Date() > this.expiresAt;
};

// Method to check if OTP is valid
otpSchema.methods.isValid = function() {
    return !this.isUsed && !this.isExpired() && this.attempts < 5;
};

// Method to mark OTP as used
otpSchema.methods.markAsUsed = function() {
    this.isUsed = true;
    return this.save();
};

// Method to increment attempts
otpSchema.methods.incrementAttempts = function() {
    this.attempts += 1;
    this.lastAttempt = new Date();
    return this.save();
};

// Method to generate new OTP
otpSchema.methods.generateNewOTP = function() {
    const crypto = require('crypto');
    this.otp = crypto.randomInt(100000, 999999).toString();
    this.expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    this.attempts = 0;
    this.isUsed = false;
    return this.save();
};

// Static method to create OTP
otpSchema.statics.createOTP = function(phone, type, userType, userId) {
    const crypto = require('crypto');
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    return this.create({
        phone,
        otp,
        type,
        userType,
        userId,
        expiresAt
    });
};

// Static method to find valid OTP
otpSchema.statics.findValidOTP = function(phone, otp, type) {
    return this.findOne({
        phone,
        otp,
        type,
        isUsed: false,
        expiresAt: { $gt: new Date() },
        attempts: { $lt: 5 }
    });
};

// Static method to clean expired OTPs
otpSchema.statics.cleanExpiredOTPs = function() {
    return this.deleteMany({
        expiresAt: { $lt: new Date() }
    });
};

// Pre-save middleware to ensure OTP is 6 digits
otpSchema.pre('save', function(next) {
    if (this.otp && this.otp.length !== 6) {
        return next(new Error('OTP must be exactly 6 digits'));
    }
    return next();
});

module.exports = mongoose.model('OTP', otpSchema);



