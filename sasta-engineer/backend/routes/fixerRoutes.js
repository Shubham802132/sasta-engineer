const express = require('express');
const { protect, authorize, authorizeServiceCategory } = require('../middleware/auth');
const {
    getFixerProfile,
    updateFixerProfile,
    getFixerBookings,
    getServiceRequests,
    getFixerBookingById,
    updateBookingStatus,
    getFixerAvailability,
    updateFixerAvailability,
    updateFixerOnlineStatus,
    getFixerReviews
} = require('../controllers/fixerController');

const router = express.Router();

// @desc    Get service requests (public for testing)
// @route   GET /api/fixers/service-requests
// @access  Public
router.get('/service-requests', (req, res) => {
    console.log('📋 Direct service requests route called');
    getServiceRequests(req, res);
});

// All other routes are protected
router.use(protect);
router.use(authorize('fixer', 'admin'));

// @desc    Get fixer profile
// @route   GET /api/fixers/profile
// @access  Private
router.get('/profile', getFixerProfile);

// @desc    Update fixer profile
// @route   PUT /api/fixers/profile
// @access  Private
router.put('/profile', updateFixerProfile);

// @desc    Get fixer bookings
// @route   GET /api/fixers/bookings
// @access  Private
router.get('/bookings', getFixerBookings);

// @desc    Get fixer booking by ID
// @route   GET /api/fixers/bookings/:id
// @access  Private
router.get('/bookings/:id', getFixerBookingById);

// @desc    Update booking status
// @route   PUT /api/fixers/bookings/:id/status
// @route   PUT /api/fixers/bookings/:id/status
// @access  Private
router.put('/bookings/:id/status', updateBookingStatus);

// @desc    Get fixer availability
// @route   GET /api/fixers/availability
// @access  Private
router.get('/availability', getFixerAvailability);

// @desc    Update fixer availability
// @route   PUT /api/fixers/availability
// @access  Private
router.put('/availability', updateFixerAvailability);

// @desc    Update fixer online status
// @route   PUT /api/fixers/status
// @access  Private
router.put('/status', updateFixerOnlineStatus);

// @desc    Get fixer reviews
// @route   GET /api/fixers/reviews
// @access  Private
router.get('/reviews', getFixerReviews);

module.exports = router;



