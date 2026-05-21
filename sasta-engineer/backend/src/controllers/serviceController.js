// FIXGHAR Service Controller
// Handles service-related operations

const Service = require('../models/service');

// @desc    Get all services
// @route   GET /api/services
// @access  Public
const getAllServices = async (req, res) => {
    try {
        let services = await Service.find({ isActive: true });
        
        // If no services exist, create default services
        if (services.length === 0) {
            console.log('No services found, creating default services...');
            await createDefaultServices();
            services = await Service.find({ isActive: true });
        }
        
        res.status(200).json({
            success: true,
            count: services.length,
            data: services
        });
    } catch (error) {
        console.error('Get all services error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Create default services
const createDefaultServices = async () => {
    try {
        const defaultServices = [
            {
                name: 'Plumbing Services',
                category: 'Plumbing',
                description: 'Professional plumbing services including leak repairs, pipe installation, drain cleaning, and faucet fixes.',
                features: ['24/7 Emergency', 'Licensed Experts', 'Quality Materials'],
                pricing: {
                    basePrice: 500,
                    priceUnit: 'hourly'
                },
                estimatedDuration: {
                    min: 1,
                    max: 3,
                    unit: 'hours'
                },
                isActive: true
            },
            {
                name: 'Carpentry Services',
                category: 'Carpentry',
                description: 'Expert carpentry services including furniture repair, custom woodwork, door/window fixes.',
                features: ['Custom Solutions', 'Quality Materials', 'Expert Craftsmanship'],
                pricing: {
                    basePrice: 600,
                    priceUnit: 'hourly'
                },
                estimatedDuration: {
                    min: 2,
                    max: 6,
                    unit: 'hours'
                },
                isActive: true
            },
            {
                name: 'Painting Services',
                category: 'Painting',
                description: 'Professional painting services including interior/exterior painting, color consultation, touch-ups.',
                features: ['Premium Paints', 'Clean Finish', 'Color Consultation'],
                pricing: {
                    basePrice: 400,
                    priceUnit: 'hourly'
                },
                estimatedDuration: {
                    min: 4,
                    max: 8,
                    unit: 'hours'
                },
                isActive: true
            },
            {
                name: 'General Repair Services',
                category: 'General Repair',
                description: 'Professional repair services for various home maintenance and repair needs.',
                features: ['Versatile Solutions', 'Quality Work', 'Affordable Pricing'],
                pricing: {
                    basePrice: 300,
                    priceUnit: 'hourly'
                },
                estimatedDuration: {
                    min: 1,
                    max: 4,
                    unit: 'hours'
                },
                isActive: true
            }
        ];

        await Service.insertMany(defaultServices);
        console.log('✅ Default services created successfully');
    } catch (error) {
        console.error('Error creating default services:', error);
    }
};

// @desc    Get service by ID
// @route   GET /api/services/:id
// @access  Public
const getServiceById = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        
        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        res.status(200).json({
            success: true,
            data: service
        });
    } catch (error) {
        console.error('Get service by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get services by category
// @route   GET /api/services/category/:category
// @access  Public
const getServicesByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        
        const services = await Service.find({ 
            category: category,
            isActive: true 
        });
        
        res.status(200).json({
            success: true,
            count: services.length,
            data: services
        });
    } catch (error) {
        console.error('Get services by category error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Search services
// @route   GET /api/services/search
// @access  Public
const searchServices = async (req, res) => {
    try {
        const { q, category, location } = req.query;
        
        let query = { isActive: true };
        
        if (q) {
            query.$text = { $search: q };
        }
        
        if (category) {
            query.category = category;
        }
        
        if (location) {
            query.location = { $regex: location, $options: 'i' };
        }
        
        const services = await Service.find(query);
        
        res.status(200).json({
            success: true,
            count: services.length,
            data: services
        });
    } catch (error) {
        console.error('Search services error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get popular services
// @route   GET /api/services/popular
// @access  Public
const getPopularServices = async (req, res) => {
    try {
        const services = await Service.find({ isActive: true })
            .sort({ rating: -1, reviewCount: -1 })
            .limit(10);
        
        res.status(200).json({
            success: true,
            count: services.length,
            data: services
        });
    } catch (error) {
        console.error('Get popular services error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Create new service
// @route   POST /api/services
// @access  Private (Admin only)
const createService = async (req, res) => {
    try {
        const service = await Service.create(req.body);
        
        res.status(201).json({
            success: true,
            message: 'Service created successfully',
            data: service
        });
    } catch (error) {
        console.error('Create service error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update service
// @route   PUT /api/services/:id
// @access  Private (Admin only)
const updateService = async (req, res) => {
    try {
        const service = await Service.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Service updated successfully',
            data: service
        });
    } catch (error) {
        console.error('Update service error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Delete service
// @route   DELETE /api/services/:id
// @access  Private (Admin only)
const deleteService = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        
        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }
        
        // Soft delete - mark as inactive
        service.isActive = false;
        await service.save();
        
        res.status(200).json({
            success: true,
            message: 'Service deleted successfully'
        });
    } catch (error) {
        console.error('Delete service error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

module.exports = {
    getAllServices,
    getServiceById,
    getServicesByCategory,
    searchServices,
    getPopularServices,
    createService,
    updateService,
    deleteService
};































