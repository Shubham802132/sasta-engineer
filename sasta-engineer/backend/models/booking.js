const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Make optional for testing
    },
    userInfo: {
        name: {
            type: String,
            default: 'Guest User'
        },
        email: {
            type: String,
            default: 'guest@example.com'
        },
        phone: {
            type: String,
            default: 'Not provided'
        }
    },
    fixer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Fixer',
        required: false // Make fixer optional initially
    },
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: false // Make service optional since we're using serviceCategory
    },
    serviceCategory: {
        type: String,
        required: false, // Make optional for testing
        // enum: ['plumbing', 'electrical', 'carpentry', 'painting', 'General Repair', 'general repair', 'General repair']
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected'],
        default: 'pending'
    },
    bookingDetails: {
        description: {
            type: String,
            required: false, // Make optional for now
            maxlength: [1000, 'Description cannot be more than 1000 characters']
        },
        urgency: {
            type: String,
            enum: ['low', 'medium', 'high', 'emergency'],
            default: 'medium'
        },
        preferredDate: {
            type: Date,
            required: false // Make optional for now
        },
        preferredTime: {
            type: String,
            required: false // Make optional for now
        },
        address: {
            street: {
                type: String,
                required: false // Make optional for now
            },
            city: {
                type: String,
                required: false // Make optional for now
            },
            state: {
                type: String,
                required: false // Make optional for now
            },
            zipCode: {
                type: String,
                required: false // Make optional for now
            },
            additionalInfo: String
        },
        images: [{
            url: String,
            alt: String,
            description: String
        }]
    },
    pricing: {
        estimatedCost: {
            type: Number,
            min: [0, 'Estimated cost cannot be negative']
        },
        finalCost: {
            type: Number,
            min: [0, 'Final cost cannot be negative']
        },
        breakdown: [{
            item: String,
            amount: Number,
            description: String
        }],
        discount: {
            type: Number,
            min: [0, 'Discount cannot be negative'],
            default: 0
        },
        totalAmount: {
            type: Number,
            min: [0, 'Total amount cannot be negative']
        }
    },
    schedule: {
        scheduledDate: Date,
        scheduledTime: String,
        estimatedDuration: {
            type: Number,
            min: [1, 'Duration must be at least 1 hour']
        },
        actualStartTime: Date,
        actualEndTime: Date,
        actualDuration: Number
    },
    communication: {
        messages: [{
            sender: {
                type: String,
                enum: ['user', 'fixer', 'system'],
                required: true
            },
            senderId: {
                type: mongoose.Schema.Types.ObjectId,
                required: true
            },
            message: {
                type: String,
                required: true,
                maxlength: [1000, 'Message cannot be more than 1000 characters']
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
            isRead: {
                type: Boolean,
                default: false
            }
        }],
        lastMessage: Date
    },
    progress: {
        currentStep: {
            type: String,
            enum: ['scheduled', 'arrived', 'work_started', 'work_in_progress', 'work_completed', 'cleanup', 'final_inspection'],
            default: 'scheduled'
        },
        notes: [{
            note: String,
            timestamp: Date,
            addedBy: {
                type: String,
                enum: ['user', 'fixer', 'system']
            }
        }],
        milestones: [{
            title: String,
            description: String,
            completed: {
                type: Boolean,
                default: false
            },
            completedAt: Date
        }]
    },
    review: {
        rating: {
            type: Number,
            min: [1, 'Rating must be at least 1'],
            max: [5, 'Rating cannot be more than 5']
        },
        comment: {
            type: String,
            maxlength: [500, 'Review comment cannot be more than 500 characters']
        },
        reviewDate: Date,
        isPublic: {
            type: Boolean,
            default: true
        }
    },
    payment: {
        method: {
            type: String,
            enum: ['cash', 'card', 'upi', 'bank_transfer', 'wallet'],
            default: 'cash'
        },
        status: {
            type: String,
            enum: ['pending', 'partial', 'completed', 'failed', 'refunded'],
            default: 'pending'
        },
        transactionId: String,
        paymentDate: Date,
        amountPaid: {
            type: Number,
            min: [0, 'Amount paid cannot be negative']
        }
    },
    cancellation: {
        reason: String,
        cancelledBy: {
            type: String,
            enum: ['user', 'fixer', 'system']
        },
        cancelledAt: Date,
        refundAmount: {
            type: Number,
            min: [0, 'Refund amount cannot be negative']
        }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for better query performance
bookingSchema.index({ user: 1 });
bookingSchema.index({ fixer: 1 });
bookingSchema.index({ service: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ 'bookingDetails.preferredDate': 1 });
bookingSchema.index({ 'schedule.scheduledDate': 1 });
bookingSchema.index({ createdAt: -1 });

// Virtual for booking duration
bookingSchema.virtual('bookingDuration').get(function() {
    if (this.schedule.actualStartTime && this.schedule.actualEndTime) {
        const duration = this.schedule.actualEndTime - this.schedule.actualStartTime;
        return Math.round(duration / (1000 * 60 * 60)); // Convert to hours
    }
    return null;
});

// Virtual for formatted status
bookingSchema.virtual('formattedStatus').get(function() {
    return this.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
});

// Virtual for isOverdue
bookingSchema.virtual('isOverdue').get(function() {
    if (this.status === 'confirmed' && this.schedule.scheduledDate) {
        return new Date() > this.schedule.scheduledDate;
    }
    return false;
});

// Method to update booking status
bookingSchema.methods.updateStatus = function(newStatus, note = '') {
    this.status = newStatus;
    
    if (note) {
        this.progress.notes.push({
            note,
            timestamp: new Date(),
            addedBy: 'system'
        });
    }
    
    return this.save();
};

// Method to add message
bookingSchema.methods.addMessage = function(sender, senderId, message) {
    this.communication.messages.push({
        sender,
        senderId,
        message,
        timestamp: new Date()
    });
    
    this.communication.lastMessage = new Date();
    return this.save();
};

// Method to calculate total amount
bookingSchema.methods.calculateTotalAmount = function() {
    let total = this.pricing.estimatedCost || 0;
    
    if (this.pricing.breakdown && this.pricing.breakdown.length > 0) {
        total = this.pricing.breakdown.reduce((sum, item) => sum + item.amount, 0);
    }
    
    if (this.pricing.discount) {
        total -= this.pricing.discount;
    }
    
    this.pricing.totalAmount = Math.max(0, total);
    return this.pricing.totalAmount;
};

// Ensure virtual fields are serialized
bookingSchema.set('toJSON', { virtuals: true });
bookingSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Booking', bookingSchema);



