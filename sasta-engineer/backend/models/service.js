const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a service name'],
        trim: true,
        maxlength: [100, 'Service name cannot be more than 100 characters']
    },
    category: {
        type: String,
        required: [true, 'Please provide a service category'],
        enum: ['Plumbing', 'Carpentry', 'Painting', 'General Repair']
    },
    description: {
        type: String,
        required: [true, 'Please provide a service description'],
        maxlength: [500, 'Description cannot be more than 500 characters']
    },
    icon: {
        type: String,
        default: '🔧'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    features: [{
        type: String,
        trim: true
    }],
    estimatedDuration: {
        min: {
            type: Number,
            min: [1, 'Minimum duration must be at least 1 hour']
        },
        max: {
            type: Number,
            min: [1, 'Maximum duration must be at least 1 hour']
        },
        unit: {
            type: String,
            enum: ['hours', 'days'],
            default: 'hours'
        }
    },
    pricing: {
        basePrice: {
            type: Number,
            min: [0, 'Base price cannot be negative'],
            required: true
        },
        priceUnit: {
            type: String,
            enum: ['hourly', 'fixed', 'per_square_feet'],
            default: 'hourly'
        },
        additionalCharges: [{
            name: String,
            amount: Number,
            description: String
        }]
    },
    requirements: [{
        type: String,
        trim: true
    }],
    materials: [{
        name: String,
        description: String,
        isIncluded: {
            type: Boolean,
            default: false
        }
    }],
    warranty: {
        duration: {
            type: Number,
            min: [0, 'Warranty duration cannot be negative']
        },
        unit: {
            type: String,
            enum: ['days', 'months', 'years'],
            default: 'months'
        },
        terms: String
    },
    images: [{
        url: String,
        alt: String,
        caption: String
    }],
    tags: [{
        type: String,
        trim: true
    }],
    popularity: {
        type: Number,
        default: 0,
        min: 0
    },
    averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    totalBookings: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for better query performance
serviceSchema.index({ category: 1 });
serviceSchema.index({ isActive: 1 });
serviceSchema.index({ popularity: -1 });
serviceSchema.index({ averageRating: -1 });
serviceSchema.index({ tags: 1 });

// Virtual for formatted duration
serviceSchema.virtual('formattedDuration').get(function() {
    if (!this.estimatedDuration.min || !this.estimatedDuration.max) {
        return 'Varies';
    }
    
    if (this.estimatedDuration.min === this.estimatedDuration.max) {
        return `${this.estimatedDuration.min} ${this.estimatedDuration.unit}`;
    }
    
    return `${this.estimatedDuration.min}-${this.estimatedDuration.max} ${this.estimatedDuration.unit}`;
});

// Virtual for formatted price
serviceSchema.virtual('formattedPrice').get(function() {
    if (this.pricing.priceUnit === 'hourly') {
        return `₹${this.pricing.basePrice}/hour`;
    } else if (this.pricing.priceUnit === 'per_square_feet') {
        return `₹${this.pricing.basePrice}/sq ft`;
    } else {
        return `₹${this.pricing.basePrice}`;
    }
});

// Method to update popularity
serviceSchema.methods.updatePopularity = function() {
    this.popularity = (this.totalBookings * 0.6) + (this.averageRating * 0.4);
    return this.save();
};

// Method to update average rating
serviceSchema.methods.updateAverageRating = function(newRating) {
    const currentTotal = this.averageRating * this.totalBookings;
    this.totalBookings += 1;
    this.averageRating = (currentTotal + newRating) / this.totalBookings;
    return this.save();
};

// Ensure virtual fields are serialized
serviceSchema.set('toJSON', { virtuals: true });
serviceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Service', serviceSchema);



