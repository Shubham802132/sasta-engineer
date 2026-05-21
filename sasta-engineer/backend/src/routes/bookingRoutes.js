const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
    createBooking,
    getAllBookings,
    getBookingById,
    updateBooking,
    cancelBooking,
    addBookingReview,
    getBookingMessages,
    sendBookingMessage,
    updateBookingProgress,
    getBookingStats
} = require('../controllers/bookingController');

const router = express.Router();

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private (users only)
router.post('/', protect, authorize('user'), createBooking);

// @desc    Get all bookings (filtered by user role)
// @route   GET /api/bookings
// @access  Private
router.get('/', protect, getAllBookings);

// @desc    Check booking eligibility
// @route   GET /api/bookings/eligibility
// @access  Private
// router.get('/eligibility', protect, checkBookingEligibility);

// @desc    Get booking statistics
// @route   GET /api/bookings/stats/overview
// @access  Private
router.get('/stats/overview', protect, getBookingStats);

// @desc    Get booking by ID
// @route   GET /api/bookings/:id
// @access  Private
router.get('/:id', protect, getBookingById);

// @desc    Update booking
// @route   PUT /api/bookings/:id
// @access  Private
router.put('/:id', protect, updateBooking);

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private
router.put('/:id/cancel', protect, cancelBooking);

// @desc    Add review to booking
// @route   POST /api/bookings/:id/review
// @access  Private (Users only)
router.post('/:id/review', protect, authorize('user'), addBookingReview);

// @desc    Get booking messages
// @route   GET /api/bookings/:id/messages
// @access  Private
router.get('/:id/messages', protect, getBookingMessages);

// @desc    Send message in booking
// @route   POST /api/bookings/:id/messages
// @access  Private
router.post('/:id/messages', protect, sendBookingMessage);

// @desc    Update booking progress
// @route   PUT /api/bookings/:id/progress
// @access  Private (Fixers only)
router.put('/:id/progress', protect, authorize('fixer'), updateBookingProgress);

module.exports = router;



