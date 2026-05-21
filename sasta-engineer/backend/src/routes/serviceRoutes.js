const express = require('express');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const {
    getAllServices,
    getServiceById,
    getServicesByCategory,
    searchServices,
    getPopularServices,
    createService,
    updateService,
    deleteService
} = require('../controllers/serviceController');

const router = express.Router();

// @desc    Get all services
// @route   GET /api/services
// @access  Public
router.get('/', getAllServices);

// @desc    Get popular services
// @route   GET /api/services/popular
// @access  Public
router.get('/popular', getPopularServices);

// @desc    Search services
// @route   GET /api/services/search
// @access  Public
router.get('/search', searchServices);

// @desc    Get services by category
// @route   GET /api/services/category/:category
// @access  Public
router.get('/category/:category', getServicesByCategory);

// @desc    Get service by ID
// @route   GET /api/services/:id
// @access  Public
router.get('/:id', getServiceById);

// Protected routes (admin only)
router.use(protect);
router.use(authorize('admin'));

// @desc    Create new service
// @route   POST /api/services
// @access  Private (Admin only)
router.post('/', createService);

// @desc    Update service
// @route   PUT /api/services/:id
// @access  Private (Admin only)
router.put('/:id', updateService);

// @desc    Delete service
// @route   DELETE /api/services/:id
// @access  Private (Admin only)
router.delete('/:id', deleteService);

module.exports = router;

