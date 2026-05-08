// FIXGHAR Booking Controller
// Handles booking-related operations

const Booking = require('../models/booking');

// Helper function to find matching fixers
const findMatchingFixers = async (serviceCategory, userAddress) => {
    try {
        const Fixer = require('../models/fixer');
        
        // Extract city from address (simple extraction)
        let userCity = 'Unknown';
        if (userAddress) {
            // Try to extract city from address string
            const addressParts = userAddress.toLowerCase().split(/[,\s]+/);
            const commonCities = ['delhi', 'mumbai', 'bangalore', 'chennai', 'kolkata', 'hyderabad', 'pune', 'ahmedabad', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam', 'pimpri', 'patna', 'vadodara', 'ghaziabad', 'ludhiana', 'agra', 'nashik', 'faridabad', 'meerut', 'rajkot', 'kalyan', 'vasai', 'varanasi', 'srinagar', 'aurangabad', 'noida', 'solapur', 'vijayawada', 'kolhapur', 'amritsar', 'nashik', 'ranchi', 'howrah', 'coimbatore', 'raipur', 'jabalpur', 'gwalior', 'jodhpur', 'madurai', 'raipur', 'kota', 'guwahati', 'chandigarh', 'tiruchirappalli', 'mysore', 'bhubaneswar', 'kochi', 'bhavnagar', 'salem', 'warangal', 'guntur', 'bhiwandi', 'amravati', 'nanded', 'kolhapur', 'sangli', 'malegaon', 'ulhasnagar', 'jalgaon', 'latur', 'ahmednagar', 'chandrapur', 'parbhani', 'ichalkaranji', 'jalna', 'ambarnath', 'bhusawal', 'ratnagiri', 'beed', 'yavatmal', 'kamptee', 'gondia', 'barshi', 'achalpur', 'osmanabad', 'nandurbar', 'wardha', 'udgir', 'hinganghat'];
            
            for (const part of addressParts) {
                if (commonCities.includes(part)) {
                    userCity = part.charAt(0).toUpperCase() + part.slice(1);
                    break;
                }
            }
        }
        
        console.log(`🔍 Looking for fixers matching service: ${serviceCategory}, city: ${userCity}`);
        
        // Find fixers who provide this service and are in the same city
        const matchingFixers = await Fixer.find({
            isActive: true,
            $or: [
                { serviceCategory: { $regex: serviceCategory, $options: 'i' } },
                { 'professionalInfo.skills': { $regex: serviceCategory, $options: 'i' } }
            ],
            $or: [
                { 'address.city': { $regex: userCity, $options: 'i' } },
                { 'address.state': { $regex: userCity, $options: 'i' } }
            ]
        }).select('name email phone serviceCategory address rating isActive professionalInfo').limit(10);
        
        console.log(`✅ Found ${matchingFixers.length} matching fixers`);
        
        return matchingFixers.map(fixer => ({
            id: fixer._id,
            name: fixer.name,
            email: fixer.email,
            phone: fixer.phone,
            serviceCategory: fixer.serviceCategory,
            city: fixer.address?.city || 'Unknown',
            rating: fixer.rating?.average || 0,
            isActive: fixer.isActive,
            skills: fixer.professionalInfo?.skills || []
        }));
        
    } catch (error) {
        console.error('❌ Error finding matching fixers:', error);
        return [];
    }
};

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private (Users only)
const createBooking = async (req, res) => {
    try {
        console.log('📝 Booking request received:', req.body);
        
        const { 
            service, 
            description, 
            preferredDate, 
            preferredTime, 
            address,
            serviceId, 
            fixerId, 
            scheduledDate 
        } = req.body;
        
        // Simple validation
        if (!service && !description) {
            return res.status(400).json({
                success: false,
                message: 'Service type and description are required'
            });
        }
        
        // Create booking data that matches the model structure
        const bookingData = {
            user: req.user?.id || null, // Handle both authenticated and non-authenticated users
            service: null, // Don't set service as ObjectId, use serviceCategory instead
            serviceCategory: service || 'General Repair',
            status: 'pending',
            bookingDetails: {
                description: description || 'Service requested',
                preferredDate: preferredDate ? new Date(preferredDate) : new Date(),
                preferredTime: preferredTime || 'morning',
                address: {
                    street: address || 'Address not provided',
                    city: 'City not specified',
                    state: 'State not specified',
                    zipCode: '000000'
                }
            },
            // Add user information for display purposes (use authenticated user data if available)
            userInfo: {
                name: req.user?.name || req.body.userName || 'Guest User',
                email: req.user?.email || req.body.userEmail || 'guest@example.com',
                phone: req.user?.phone || req.body.userPhone || 'Not provided'
            }
        };
        
        // Handle additional fields
        if (scheduledDate) {
            bookingData.schedule = {
                scheduledDate: new Date(scheduledDate)
            };
        }
        if (fixerId) {
            bookingData.fixer = fixerId;
        }
        
        console.log('Creating booking with data:', bookingData);
        
        // Save to database
        const booking = await Booking.create(bookingData);
        
        console.log('✅ Booking saved to database:', booking);
        
        // Find matching fixers based on service category and location
        try {
            const matchingFixers = await findMatchingFixers(service, address);
            console.log(`🔍 Found ${matchingFixers.length} matching fixers for service: ${service}`);
            
            // Add matching fixers info to response
            bookingData.matchingFixers = matchingFixers;
        } catch (matchError) {
            console.log('⚠️ Error finding matching fixers:', matchError.message);
        }
        
        res.status(201).json({
            success: true,
            message: 'Booking created successfully! You will receive a confirmation soon.',
            data: booking,
            matchingFixers: bookingData.matchingFixers || []
        });
    } catch (error) {
        console.error('❌ Create booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

// @desc    Get all bookings (filtered by user role)
// @route   GET /api/bookings
// @access  Private
const getAllBookings = async (req, res) => {
    try {
        let query = {};
        
        // Filter by user role if user is authenticated
        if (req.user) {
            if (req.user.role === 'user') {
                query.user = req.user.id;
            } else if (req.user.role === 'fixer') {
                query.fixer = req.user.id;
            }
        }
        // If no user, return all bookings for testing
        
        const bookings = await Booking.find(query)
            .populate('user', 'name email phone')
            .populate('fixer', 'name email phone serviceCategory')
            .populate('service', 'name category price')
            .sort({ createdAt: -1 }); // Sort by newest first
        
        // Transform data for frontend
        const transformedBookings = bookings.map(booking => ({
            _id: booking._id,
            service: booking.serviceCategory || booking.service,
            description: booking.bookingDetails?.description || 'Service requested',
            status: booking.status,
            preferredDate: booking.bookingDetails?.preferredDate,
            preferredTime: booking.bookingDetails?.preferredTime,
            address: booking.bookingDetails?.address?.street || 'Address not provided',
            createdAt: booking.createdAt,
            user: booking.user,
            fixer: booking.fixer,
            serviceDetails: booking.service,
            // Include user information for display
            userName: booking.userInfo?.name || booking.user?.name || 'Guest User',
            userEmail: booking.userInfo?.email || booking.user?.email || 'guest@example.com',
            userPhone: booking.userInfo?.phone || booking.user?.phone || 'Not provided'
        }));
        
        console.log(`📋 Found ${transformedBookings.length} bookings in database`);
        
        res.status(200).json({
            success: true,
            count: transformedBookings.length,
            data: transformedBookings
        });
    } catch (error) {
        console.error('Get all bookings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get booking by ID
// @route   GET /api/bookings/:id
// @access  Private
const getBookingById = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('user', 'name email phone')
            .populate('fixer', 'name email phone serviceCategory')
            .populate('service', 'name category price');
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
        
        // Check if user has access to this booking
        if (req.user.role === 'user' && booking.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this booking'
            });
        }
        
        if (req.user.role === 'fixer' && booking.fixer.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this booking'
            });
        }
        
        res.status(200).json({
            success: true,
            data: booking
        });
    } catch (error) {
        console.error('Get booking by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update booking
// @route   PUT /api/bookings/:id
// @access  Private
const updateBooking = async (req, res) => {
    try {
        const { scheduledDate, description, address } = req.body;
        
        const booking = await Booking.findById(req.params.id);
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
        
        // Check if user has access to this booking
        if (req.user.role === 'user' && booking.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this booking'
            });
        }
        
        // Update fields
        if (scheduledDate) booking.scheduledDate = scheduledDate;
        if (description) booking.description = description;
        if (address) booking.address = address;
        
        await booking.save();
        
        res.status(200).json({
            success: true,
            message: 'Booking updated successfully',
            data: booking
        });
    } catch (error) {
        console.error('Update booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private
const cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
        
        // Check if user has access to this booking
        if (req.user.role === 'user' && booking.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to cancel this booking'
            });
        }
        
        // Only allow cancellation if status is pending or confirmed
        if (!['pending', 'confirmed'].includes(booking.status)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel booking with current status'
            });
        }
        
        booking.status = 'cancelled';
        await booking.save();
        
        res.status(200).json({
            success: true,
            message: 'Booking cancelled successfully',
            data: booking
        });
    } catch (error) {
        console.error('Cancel booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Add review to booking
// @route   POST /api/bookings/:id/review
// @access  Private (Users only)
const addBookingReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        
        const booking = await Booking.findById(req.params.id);
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
        
        // Check if user has access to this booking
        if (booking.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to review this booking'
            });
        }
        
        // Check if booking is completed
        if (booking.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Can only review completed bookings'
            });
        }
        
        // Add review
        booking.review = {
            rating,
            comment,
            createdAt: new Date()
        };
        
        await booking.save();
        
        res.status(200).json({
            success: true,
            message: 'Review added successfully',
            data: booking
        });
    } catch (error) {
        console.error('Add booking review error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};


// @desc    Get booking messages
// @route   GET /api/bookings/:id/messages
// @access  Private
const getBookingMessages = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
        
        // Check if user has access to this booking
        if (req.user.role === 'user' && booking.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this booking'
            });
        }
        
        if (req.user.role === 'fixer' && booking.fixer.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this booking'
            });
        }
        
        res.status(200).json({
            success: true,
            data: booking.messages || []
        });
    } catch (error) {
        console.error('Get booking messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Send message in booking
// @route   POST /api/bookings/:id/messages
// @access  Private
const sendBookingMessage = async (req, res) => {
    try {
        const { message } = req.body;
        
        const booking = await Booking.findById(req.params.id);
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
        
        // Check if user has access to this booking
        if (req.user.role === 'user' && booking.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to send message in this booking'
            });
        }
        
        if (req.user.role === 'fixer' && booking.fixer.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to send message in this booking'
            });
        }
        
        // Add message
        const newMessage = {
            sender: req.user.id,
            senderRole: req.user.role,
            message,
            createdAt: new Date()
        };
        
        booking.messages.push(newMessage);
        await booking.save();
        
        res.status(200).json({
            success: true,
            message: 'Message sent successfully',
            data: newMessage
        });
    } catch (error) {
        console.error('Send booking message error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update booking progress
// @route   PUT /api/bookings/:id/progress
// @access  Private (Fixers only)
const updateBookingProgress = async (req, res) => {
    try {
        const { status, progressNote } = req.body;
        
        const booking = await Booking.findById(req.params.id);
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
        
        // Check if user is the fixer for this booking
        if (booking.fixer.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this booking'
            });
        }
        
        // Update status and progress
        if (status) booking.status = status;
        if (progressNote) {
            booking.progressNotes.push({
                note: progressNote,
                createdAt: new Date()
            });
        }
        
        await booking.save();
        
        res.status(200).json({
            success: true,
            message: 'Booking progress updated successfully',
            data: booking
        });
    } catch (error) {
        console.error('Update booking progress error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get booking statistics
// @route   GET /api/bookings/stats/overview
// @access  Private
const getBookingStats = async (req, res) => {
    try {
        let query = {};
        
        // Filter by user role
        if (req.user.role === 'user') {
            query.user = req.user.id;
        } else if (req.user.role === 'fixer') {
            query.fixer = req.user.id;
        }
        
        const stats = await Booking.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get booking stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Check booking eligibility
// @route   GET /api/bookings/eligibility
// @access  Private
const checkBookingEligibility = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Check for pending/confirmed bookings
        const pendingBookings = await Booking.countDocuments({
            user: userId,
            status: { $in: ['pending', 'confirmed'] }
        });
        
        // Check for recent bookings (within 15 minutes)
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const recentBookings = await Booking.countDocuments({
            user: userId,
            createdAt: { $gte: fifteenMinutesAgo }
        });
        
        const canBook = pendingBookings < 3 && recentBookings === 0;
        
        res.json({
            success: true,
            data: {
                canBook,
                pendingBookings,
                recentBookings,
                maxPendingBookings: 3,
                cooldownMinutes: 15
            }
        });
        
    } catch (error) {
        console.error('Check booking eligibility error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

module.exports = {
    createBooking,
    getAllBookings,
    getBookingById,
    updateBooking,
    cancelBooking,
    addBookingReview,
    getBookingMessages,
    sendBookingMessage,
    updateBookingProgress,
    checkBookingEligibility,
    getBookingStats
};































