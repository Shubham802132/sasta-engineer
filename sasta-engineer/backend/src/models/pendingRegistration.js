const mongoose = require('mongoose');

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

// Password is hashed once when the User/Fixer account is created after OTP verification.
// Pending records expire automatically (TTL) and are not long-lived.

module.exports = mongoose.model('PendingRegistration', pendingRegistrationSchema);
