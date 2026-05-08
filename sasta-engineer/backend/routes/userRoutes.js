const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
    getUserProfile,
    updateUserProfile,
    getUserBookings,
    getUserBookingById
} = require('../controllers/userController');

const router = express.Router();

// All routes are protected
router.use(protect);
router.use(authorize('user', 'admin'));

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', getUserProfile);

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', updateUserProfile);

// @desc    Get user bookings
// @route   GET /api/users/bookings
// @access  Private
router.get('/bookings', getUserBookings);

// @desc    Get user booking by ID
// @route   GET /api/users/bookings/:id
// @access  Private
router.get('/bookings/:id', getUserBookingById);

// @desc    Get user dashboard data
// @route   GET /api/users/dashboard
// @access  Private
router.get('/dashboard', async (req, res) => {
    try {
        const user = req.user;
        
        // Get user's recent bookings
        const Booking = require('../models/booking');
        const recentBookings = await Booking.find({ user: user._id })
            .populate('service', 'name category')
            .populate('fixer', 'name phone rating')
            .sort({ createdAt: -1 })
            .limit(5);

        // Get user's booking statistics
        const totalBookings = await Booking.countDocuments({ user: user._id });
        const pendingBookings = await Booking.countDocuments({ 
            user: user._id, 
            status: 'pending' 
        });
        const completedBookings = await Booking.countDocuments({ 
            user: user._id, 
            status: 'completed' 
        });

        res.json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone
                },
                stats: {
                    totalBookings,
                    pendingBookings,
                    completedBookings
                },
                recentBookings
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard data',
            error: error.message
        });
    }
});

module.exports = router;



