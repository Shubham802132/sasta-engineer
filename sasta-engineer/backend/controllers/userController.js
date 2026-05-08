const User = require('../models/user');
const Booking = require('../models/booking');
const asyncHandler = require('express-async-handler');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error getting user profile:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching user profile'
        });
    }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
    try {
        const { name, email, phone, username, address } = req.body;
        
        console.log('📝 Received profile update data:', req.body);
        
        // Build update object with only provided fields
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (phone) updateData.phone = phone;
        if (username) updateData.username = username;
        
        // Handle structured address
        if (address) {
            updateData.address = {
                street: address.street || '',
                city: address.city || '',
                state: address.state || '',
                zipCode: address.zipCode || ''
            };
        }
        
        // Find user and update
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            updateData,
            {
                new: true,
                runValidators: true
            }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedUser
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: Object.values(error.errors).map(err => err.message)
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while updating user profile'
        });
    }
});

// @desc    Get user bookings
// @route   GET /api/users/bookings
// @access  Private
const getUserBookings = asyncHandler(async (req, res) => {
    try {
        // For testing without authentication, get all bookings
        // In production, this should be: { user: req.user.id }
        const query = req.user ? { user: req.user.id } : {};
        
        const bookings = await Booking.find(query)
            .populate('fixer', 'name email phone')
            .populate('service', 'name category price')
            .sort({ createdAt: -1 });

        // Transform bookings for frontend
        const transformedBookings = bookings.map(booking => ({
            _id: booking._id,
            service: booking.serviceCategory,
            description: booking.bookingDetails?.description || 'Service Request',
            status: booking.status,
            preferredDate: booking.bookingDetails?.preferredDate,
            preferredTime: booking.bookingDetails?.preferredTime,
            address: booking.bookingDetails?.address?.street || 'Address not provided',
            createdAt: booking.createdAt,
            fixer: booking.fixer,
            userInfo: booking.userInfo
        }));

        res.status(200).json({
            success: true,
            count: transformedBookings.length,
            data: transformedBookings
        });
    } catch (error) {
        console.error('Error getting user bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching user bookings'
        });
    }
});

// @desc    Get user booking by ID
// @route   GET /api/users/bookings/:id
// @access  Private
const getUserBookingById = asyncHandler(async (req, res) => {
    try {
        const booking = await Booking.findOne({
            _id: req.params.id,
            user: req.user.id
        })
        .populate('fixer', 'name email phone')
        .populate('service', 'name category price description');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        res.status(200).json({
            success: true,
            data: booking
        });
    } catch (error) {
        console.error('Error getting user booking by ID:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching booking details'
        });
    }
});

module.exports = {
    getUserProfile,
    updateUserProfile,
    getUserBookings,
    getUserBookingById
};





























