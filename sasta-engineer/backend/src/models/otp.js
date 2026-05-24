const mongoose = require('mongoose');
const crypto = require('crypto');

function hashOtpCode(code) {
    const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || 'fixghar-otp-pepper';
    return crypto.createHmac('sha256', secret).update(String(code).trim()).digest('hex');
}

function isOtpHash(value) {
    return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

const otpSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: [true, 'Phone number is required']
    },
    otp: {
        type: String,
        required: [true, 'OTP is required']
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

otpSchema.index({ phone: 1, type: 1 });
otpSchema.index({ userId: 1, type: 1 });
otpSchema.index({ expiresAt: 1 });
otpSchema.index({ createdAt: 1 });

otpSchema.methods.isExpired = function() {
    return new Date() > this.expiresAt;
};

otpSchema.methods.isValid = function() {
    return !this.isUsed && !this.isExpired() && this.attempts < 5;
};

otpSchema.methods.markAsUsed = function() {
    this.isUsed = true;
    return this.save();
};

otpSchema.methods.incrementAttempts = function() {
    this.attempts += 1;
    this.lastAttempt = new Date();
    return this.save();
};

otpSchema.methods.generateNewOTP = function() {
    const plain = crypto.randomInt(100000, 999999).toString();
    this.otp = hashOtpCode(plain);
    this.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    this.attempts = 0;
    this.isUsed = false;
    this._plainOtpForSms = plain;
    return this.save();
};

otpSchema.statics.createOTP = function(phone, type, userType, userId) {
    const plain = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const doc = this.create({
        phone,
        otp: hashOtpCode(plain),
        type,
        userType,
        userId,
        expiresAt
    });

    return doc.then((record) => {
        record.otp = plain;
        return record;
    });
};

otpSchema.statics.createOTPWithCode = function(phone, otp, type, userType, userId) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    return this.create({
        phone,
        otp: hashOtpCode(otp),
        type,
        userType,
        userId,
        expiresAt
    });
};

otpSchema.statics.findValidOTP = function(phone, otp, type) {
    return this.findOne({
        phone,
        otp: hashOtpCode(otp),
        type,
        isUsed: false,
        expiresAt: { $gt: new Date() },
        attempts: { $lt: 5 }
    });
};

otpSchema.statics.cleanExpiredOTPs = function() {
    return this.deleteMany({
        expiresAt: { $lt: new Date() }
    });
};

otpSchema.pre('save', function(next) {
    if (this.isModified('otp') && this.otp && !isOtpHash(this.otp)) {
        if (String(this.otp).length !== 6) {
            return next(new Error('OTP must be exactly 6 digits'));
        }
        this.otp = hashOtpCode(this.otp);
    }
    return next();
});

module.exports = mongoose.model('OTP', otpSchema);
