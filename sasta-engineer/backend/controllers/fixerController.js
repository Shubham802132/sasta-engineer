// FIXGHAR Fixer Controller
// Handles fixer-related operations

const Fixer = require('../models/fixer');

// @desc    Get fixer profile
// @route   GET /api/fixers/profile
// @access  Private
const getFixerProfile = async (req, res) => {
    try {
        const fixer = await Fixer.findById(req.user.id).select('-password');
        
        if (!fixer) {
            return res.status(404).json({
                success: false,
                message: 'Fixer not found'
            });
        }

        res.status(200).json({
            success: true,
            data: fixer
        });
    } catch (error) {
        console.error('Get fixer profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update fixer profile
// @route   PUT /api/fixers/profile
// @access  Private
const updateFixerProfile = async (req, res) => {
    try {
        const { name, username, phone, address, serviceCategory, experience, skills, areas, email } = req.body;
        
        console.log('📝 Update fixer profile request:', req.body);
        
        const fixer = await Fixer.findById(req.user.id);
        
        if (!fixer) {
            return res.status(404).json({
                success: false,
                message: 'Fixer not found'
            });
        }

        // Update fields
        if (name) fixer.name = name;
        if (username) fixer.username = username;
        if (email) fixer.email = email;
        if (phone) fixer.phone = phone;
        if (address) fixer.address = address;
        if (serviceCategory) fixer.serviceCategory = serviceCategory;
        if (experience !== undefined) {
            if (!fixer.professionalInfo) fixer.professionalInfo = {};
            fixer.professionalInfo.experience = experience;
        }
        if (skills) {
            if (!fixer.professionalInfo) fixer.professionalInfo = {};
            fixer.professionalInfo.skills = Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim());
        }
        if (areas) {
            // Handle areas - could be array or string
            if (Array.isArray(areas)) {
                fixer.areas = areas;
            } else if (typeof areas === 'string') {
                fixer.areas = areas.split(',').map(s => s.trim());
            }
        }

        console.log('💾 Saving fixer with data:', {
            name: fixer.name,
            email: fixer.email,
            phone: fixer.phone,
            serviceCategory: fixer.serviceCategory,
            experience: fixer.professionalInfo?.experience,
            skills: fixer.professionalInfo?.skills,
            areas: fixer.areas
        });

        await fixer.save();

        console.log('✅ Fixer profile saved successfully');

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: fixer
        });
    } catch (error) {
        console.error('❌ Update fixer profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

// @desc    Get fixer bookings
// @route   GET /api/fixers/bookings
// @access  Private
const getFixerBookings = async (req, res) => {
    try {
        const Booking = require('../models/Booking');
        
        // Get all bookings for this fixer
        const bookings = await Booking.find({
            fixer: req.user.id
        })
        .populate('user', 'name email phone')
        .populate('service', 'name description')
        .sort({ createdAt: -1 });

        console.log(`📋 Found ${bookings.length} bookings for fixer ${req.user.id}`);

        res.status(200).json({
            success: true,
            message: 'Fixer bookings retrieved successfully',
            data: bookings
        });
    } catch (error) {
        console.error('Get fixer bookings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get service requests (bookings without assigned fixer)
// @route   GET /api/fixers/service-requests
// @access  Private
const getServiceRequests = async (req, res) => {
    try {
        console.log('📋 Starting getServiceRequests function...');
        
        const Booking = require('../models/Booking');
        console.log('📋 Booking model loaded successfully');
        
        console.log('📋 Fetching service requests...');
        console.log('🔑 User ID:', req.user?.id || 'No user (public access)');
        console.log('🔑 User role:', req.user?.role || 'No role (public access)');
        
        // For public access, we don't need user authentication
        
        // Get all bookings that don't have a fixer assigned yet
        const serviceRequests = await Booking.find({
            $or: [
                { fixer: { $exists: false } },
                { fixer: null }
            ],
            status: { $in: ['pending', 'confirmed', 'new'] }
        })
        .populate('user', 'name email phone')
        .populate('service', 'name description')
        .sort({ createdAt: -1 });

        console.log(`📋 Found ${serviceRequests.length} service requests`);

        // If no service requests found, create some test data for demonstration
        if (serviceRequests.length === 0) {
            console.log('📋 No service requests found, creating test data...');
            const testRequests = [
                {
                    _id: 'test_req_1',
                    service: { name: 'AC Repair', description: 'Air conditioner repair and maintenance' },
                    user: { name: 'Amit Kumar', email: 'amit@example.com', phone: '+91 98765 43210' },
                    address: 'Alpha 2, Greater Noida, Uttar Pradesh',
                    description: 'AC not cooling properly, needs immediate repair',
                    budget: 1500,
                    preferredDate: new Date(),
                    preferredTime: '4:00 PM',
                    status: 'pending',
                    createdAt: new Date()
                },
                {
                    _id: 'test_req_2',
                    service: { name: 'Plumbing', description: 'Pipe repair and installation' },
                    user: { name: 'Priya Sharma', email: 'priya@example.com', phone: '+91 98765 43211' },
                    address: 'Sector 62, Noida, Uttar Pradesh',
                    description: 'Kitchen tap is leaking, needs repair',
                    budget: 800,
                    preferredDate: new Date(),
                    preferredTime: '2:00 PM',
                    status: 'pending',
                    createdAt: new Date()
                },
                {
                    _id: 'test_req_3',
                    service: { name: 'Electrical', description: 'Electrical wiring and repair' },
                    user: { name: 'Rajesh Singh', email: 'rajesh@example.com', phone: '+91 98765 43212' },
                    address: 'Sector 18, Noida, Uttar Pradesh',
                    description: 'Power socket not working, needs electrical repair',
                    budget: 1200,
                    preferredDate: new Date(),
                    preferredTime: '6:00 PM',
                    status: 'pending',
                    createdAt: new Date()
                }
            ];
            
            res.status(200).json({
                success: true,
                message: 'Service requests retrieved successfully (test data)',
                data: testRequests
            });
        } else {
            res.status(200).json({
                success: true,
                message: 'Service requests retrieved successfully',
                data: serviceRequests
            });
        }
    } catch (error) {
        console.error('Get service requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

// @desc    Get fixer booking by ID
// @route   GET /api/fixers/bookings/:id
// @access  Private
const getFixerBookingById = async (req, res) => {
    try {
        const { id } = req.params;
        
        // This will be implemented when Booking model is connected
        res.status(200).json({
            success: true,
            message: `Fixer booking ${id} route - to be implemented with Booking model`,
            data: null
        });
    } catch (error) {
        console.error('Get fixer booking by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update booking status
// @route   PUT /api/fixers/bookings/:id/status
// @access  Private
const updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        // This will be implemented when Booking model is connected
        res.status(200).json({
            success: true,
            message: `Update booking ${id} status to ${status} - to be implemented with Booking model`,
            data: null
        });
    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get fixer availability
// @route   GET /api/fixers/availability
// @access  Private
const getFixerAvailability = async (req, res) => {
    try {
        const fixer = await Fixer.findById(req.user.id).select('availability');
        
        if (!fixer) {
            return res.status(404).json({
                success: false,
                message: 'Fixer not found'
            });
        }

        res.status(200).json({
            success: true,
            data: fixer.availability || {}
        });
    } catch (error) {
        console.error('Get fixer availability error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update fixer availability
// @route   PUT /api/fixers/availability
// @access  Private
const updateFixerAvailability = async (req, res) => {
    try {
        const { availability } = req.body;
        
        const fixer = await Fixer.findById(req.user.id);
        
        if (!fixer) {
            return res.status(404).json({
                success: false,
                message: 'Fixer not found'
            });
        }

        fixer.availability = availability;
        await fixer.save();

        res.status(200).json({
            success: true,
            message: 'Availability updated successfully',
            data: fixer.availability
        });
    } catch (error) {
        console.error('Update fixer availability error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update fixer online status
// @route   PUT /api/fixers/status
// @access  Private
const updateFixerOnlineStatus = async (req, res) => {
    try {
        const { isOnline } = req.body;
        
        const fixer = await Fixer.findById(req.user.id);
        
        if (!fixer) {
            return res.status(404).json({
                success: false,
                message: 'Fixer not found'
            });
        }

        fixer.isOnline = isOnline;
        await fixer.save();

        res.status(200).json({
            success: true,
            message: `Fixer is now ${isOnline ? 'online' : 'offline'}`,
            data: {
                isOnline: fixer.isOnline,
                updatedAt: fixer.updatedAt
            }
        });
    } catch (error) {
        console.error('Update fixer online status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get fixer reviews
// @route   GET /api/fixers/reviews
// @access  Private
const getFixerReviews = async (req, res) => {
    try {
        // This will be implemented when Review model is connected
        res.status(200).json({
            success: true,
            message: 'Fixer reviews route - to be implemented with Review model',
            data: []
        });
    } catch (error) {
        console.error('Get fixer reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

module.exports = {
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
};
