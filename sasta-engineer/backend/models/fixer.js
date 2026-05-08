const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const fixerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name'],
        trim: true,
        maxlength: [50, 'Name cannot be more than 50 characters']
    },
    username: {
        type: String,
        required: [true, 'Please provide a username'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [30, 'Username cannot be more than 30 characters'],
        match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores']
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please provide a valid email'
        ]
    },
    phone: {
        type: String,
        required: [true, 'Please provide a phone number'],
        match: [/^[0-9+\-\s()]+$/, 'Please provide a valid phone number']
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },
    serviceCategory: {
        type: String,
        required: [true, 'Please select a service category'],
        enum: ['Plumbing', 'Electrical', 'Carpentry', 'Painting', 'General Repair', 'Multi-Service', 'AC Repair']
    },
    areas: [{
        type: String,
        trim: true
    }],
    address: {
        street: {
            type: String,
            required: [true, 'Please provide street address']
        },
        city: {
            type: String,
            required: [true, 'Please provide city']
        },
        state: {
            type: String,
            required: [true, 'Please provide state']
        },
        zipCode: {
            type: String,
            required: [true, 'Please provide zip code']
        }
    },
    professionalInfo: {
        experience: {
            type: Number,
            min: [0, 'Experience cannot be negative'],
            default: 0
        },
        skills: [{
            type: String,
            trim: true
        }],
        certifications: [{
            name: String,
            issuingAuthority: String,
            issueDate: Date,
            expiryDate: Date,
            certificateFile: String
        }],
        bio: {
            type: String,
            maxlength: [500, 'Bio cannot be more than 500 characters']
        }
    },
    businessInfo: {
        businessName: {
            type: String,
            trim: true
        },
        businessLicense: {
            type: String,
            trim: true
        },
        insurance: {
            type: String,
            trim: true
        },
        taxId: {
            type: String,
            trim: true
        }
    },
    availability: {
        workingDays: [{
            type: String,
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        }],
        workingHours: {
            start: {
                type: String,
                default: '09:00'
            },
            end: {
                type: String,
                default: '18:00'
            }
        },
        isAvailable: {
            type: Boolean,
            default: true
        }
    },
    pricing: {
        hourlyRate: {
            type: Number,
            min: [0, 'Hourly rate cannot be negative'],
            default: 0
        },
        serviceCharges: {
            type: Number,
            min: [0, 'Service charges cannot be negative'],
            default: 0
        },
        travelCharges: {
            type: Number,
            min: [0, 'Travel charges cannot be negative'],
            default: 0
        }
    },
    rating: {
        average: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        totalReviews: {
            type: Number,
            default: 0
        },
        reviews: [{
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            rating: {
                type: Number,
                required: true,
                min: 1,
                max: 5
            },
            comment: {
                type: String,
                maxlength: [500, 'Review comment cannot be more than 500 characters']
            },
            date: {
                type: Date,
                default: Date.now
            }
        }]
    },
    documents: {
        profilePicture: {
            type: String,
            default: ''
        },
        idProof: {
            type: String,
            default: ''
        },
        addressProof: {
            type: String,
            default: ''
        },
        skillCertificates: [{
            type: String
        }]
    },
    isPhoneVerified: {
        type: Boolean,
        default: false
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    isProfileVerified: {
        type: Boolean,
        default: false
    },
    verificationStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date
    },
    preferences: {
        notifications: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: true },
            push: { type: Boolean, default: true }
        },
        language: {
            type: String,
            default: 'en'
        }
    }
}, {
    timestamps: true
});

// Index for better query performance
fixerSchema.index({ phone: 1 });
fixerSchema.index({ serviceCategory: 1 });
fixerSchema.index({ 'address.city': 1 });
fixerSchema.index({ 'address.state': 1 });
fixerSchema.index({ rating: -1 });

// Encrypt password before saving
fixerSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        next();
    }
    
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
fixerSchema.methods.getSignedJwtToken = function() {
    return jwt.sign(
        { id: this._id, role: 'fixer', serviceCategory: this.serviceCategory },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
    );
};

// Match fixer entered password to hashed password in database
fixerSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Calculate average rating
fixerSchema.methods.calculateAverageRating = function() {
    if (this.rating.reviews.length === 0) {
        this.rating.average = 0;
        this.rating.totalReviews = 0;
    } else {
        const totalRating = this.rating.reviews.reduce((sum, review) => sum + review.rating, 0);
        this.rating.average = totalRating / this.rating.reviews.length;
        this.rating.totalReviews = this.rating.reviews.length;
    }
};

// Generate and hash password token
fixerSchema.methods.getResetPasswordToken = function() {
    const crypto = require('crypto');
    // Generate token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to resetPasswordToken field
    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // Set expire
    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    return resetToken;
};

// Generate email verification token
fixerSchema.methods.getEmailVerificationToken = function() {
    const crypto = require('crypto');
    // Generate token
    const verificationToken = crypto.randomBytes(20).toString('hex');

    // Phone verification is handled via OTP system
    this.isPhoneVerified = false;

    return verificationToken;
};

// Remove sensitive fields from JSON output
fixerSchema.methods.toJSON = function() {
    const fixer = this.toObject();
    delete fixer.password;
    // Phone verification handled separately
    delete fixer.resetPasswordToken;
    delete fixer.resetPasswordExpire;
    return fixer;
};

module.exports = mongoose.model('Fixer', fixerSchema);

