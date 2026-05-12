const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Holds signup data temporarily until OTP verification succeeds.
// Auto-expires so DB stays clean.
const pendingRegistrationSchema = new mongoose.Schema(
    {
        userType: {
            type: String,
            enum: ['user', 'fixer'],
            required: true
        },
        name: { type: String, required: true, trim: true, maxlength: 50 },
        username: { type: String, trim: true },
        email: { type: String, required: true, trim: true, lowercase: true },
        phone: { type: String, required: true, trim: true },
        password: { type: String, required: true, select: false },
        address: {
            street: { type: String },
            city: { type: String },
            state: { type: String },
            zipCode: { type: String }
        },
        // Fixer-only fields (optional for user registrations)
        serviceCategory: { type: String }
    },
    { timestamps: true }
);

// TTL: expire pending registrations automatically after 20 minutes
pendingRegistrationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 20 * 60 });

pendingRegistrationSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
});

module.exports = mongoose.model('PendingRegistration', pendingRegistrationSchema);

