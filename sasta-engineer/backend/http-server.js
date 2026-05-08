const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

// Load environment variables:
// - On Render: values come from Render environment settings (process.env)
// - Locally: prefer `backend/.env`, fallback to `backend/config.env`
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, 'config.env'), override: false });

const connectDB = require('./config/database');

// Startup env sanity checks (do not print secrets)
(() => {
    const isProd = process.env.NODE_ENV === 'production';
    const required = isProd ? ['PORT', 'JWT_SECRET', 'MONGODB_URI'] : ['PORT'];
    const missing = required.filter((k) => !process.env[k]);

    const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || process.env.CORS_ORIGINS;
    if (!clientUrl) {
        console.warn('⚠️ CLIENT_URL / FRONTEND_URL / CORS_ORIGINS is not set. CORS may block your deployed frontend.');
        // Safe default to keep production frontend working if env is missing.
        process.env.CORS_ORIGINS = 'https://sasta-engineer.vercel.app';
    }

    if (missing.length) {
        console.warn(`⚠️ Missing environment variables: ${missing.join(', ')}`);
    } else {
        console.log('✅ Required environment variables detected (values not shown)');
    }
})();

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const fixerRoutes = require('./routes/fixerRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { 
    securityHeaders, 
    loginRateLimit, 
    apiRateLimit, 
    sanitizeData, 
    requestLogger, 
    validateRequest,
    corsOptions 
} = require('./middleware/security');


const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced Security middleware
app.use(securityHeaders);
app.use(compression());

// Request logging
app.use(requestLogger);

// Data sanitization
app.use(sanitizeData);

// Request validation
app.use(validateRequest);

// Rate limiting
app.use('/api/', apiRateLimit);

// Enhanced CORS configuration
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chatbot', chatbotRoutes);

// Public fixer routes (no authentication required)
app.get('/api/fixers/service-requests', async (req, res) => {
    // Add CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    try {
        console.log('📋 Public service requests endpoint called');
        
        const Booking = require('./models/booking');
        
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

        res.status(200).json({
            success: true,
            message: 'Service requests retrieved successfully',
            data: serviceRequests
        });
    } catch (error) {
        console.error('Get service requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

app.get('/api/fixers', async (req, res) => {
    // Add CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    try {
        // Try to get real fixers from database first
        try {
            const Fixer = require('./models/fixer');
            const fixers = await Fixer.find({ isActive: true })
                .select('-password -resetPasswordToken -resetPasswordExpire')
                .sort({ 'rating.average': -1, 'rating.totalReviews': -1 })
                .limit(20);
            
            if (fixers && fixers.length > 0) {
                console.log(`✅ Found ${fixers.length} real fixers in database - showing real profiles!`);
                res.json({
                    success: true,
                    count: fixers.length,
                    data: fixers.map(fixer => ({
                        id: fixer._id,
                        name: fixer.name || 'Unknown Fixer',
                        email: fixer.email,
                        phone: fixer.phone,
                        serviceCategory: fixer.serviceCategory || 'General Repair',
                        experience: fixer.professionalInfo?.experience || 0,
                        hourlyRate: fixer.pricing?.hourlyRate || 0,
                        address: fixer.address || { city: 'Location not set' },
                        isOnline: fixer.isOnline || false,
                        workingHours: fixer.availability?.workingHours,
                        rating: fixer.rating || { average: 0, totalReviews: 0 },
                        totalJobs: fixer.totalJobs || 0,
                        completedJobs: fixer.completedJobs || 0,
                        profileImage: fixer.documents?.profilePicture || 'https://via.placeholder.com/50',
                        documents: fixer.documents,
                        username: fixer.username,
                        isActive: fixer.isActive,
                        bio: fixer.professionalInfo?.bio || 'Professional service provider',
                        skills: fixer.professionalInfo?.skills || ['General Repair']
                    }))
                });
                return;
            } else {
                console.log('ℹ️ No active fixers found in database');
            }
        } catch (dbError) {
            console.log('⚠️ Database not available, using mock data:', dbError.message);
        }
        
        // Fallback to mock data if database is not available
        const mockFixers = [
            {
                id: '1',
                name: 'Rajesh Kumar',
                email: 'rajesh@example.com',
                phone: '+91 98765 43210',
                serviceCategory: 'Plumbing',
                experience: 5,
                hourlyRate: 300,
                address: { city: 'Delhi' },
                isOnline: true,
                rating: { average: 4.5, totalReviews: 25 },
                totalJobs: 150,
                completedJobs: 145,
                profileImage: 'https://via.placeholder.com/50',
                username: 'rajesh_kumar',
                isActive: true,
                bio: 'Expert plumber with 5+ years experience',
                skills: ['Pipe Repair', 'Leak Fixing', 'Bathroom Installation']
            },
            {
                id: '2',
                name: 'Priya Sharma',
                email: 'priya@example.com',
                phone: '+91 98765 43211',
                serviceCategory: 'Electrical',
                experience: 3,
                hourlyRate: 400,
                address: { city: 'Mumbai' },
                isOnline: false,
                rating: { average: 4.8, totalReviews: 18 },
                totalJobs: 80,
                completedJobs: 78,
                profileImage: 'https://via.placeholder.com/50',
                username: 'priya_sharma',
                isActive: true,
                bio: 'Certified electrician specializing in home repairs',
                skills: ['Wiring', 'Switch Repair', 'Circuit Installation']
            },
            {
                id: '3',
                name: 'Amit Singh',
                email: 'amit@example.com',
                phone: '+91 98765 43212',
                serviceCategory: 'Carpentry',
                experience: 7,
                hourlyRate: 350,
                address: { city: 'Bangalore' },
                isOnline: true,
                rating: { average: 4.3, totalReviews: 32 },
                totalJobs: 200,
                completedJobs: 195,
                profileImage: 'https://via.placeholder.com/50',
                username: 'amit_singh',
                isActive: true,
                bio: 'Master carpenter with expertise in furniture repair',
                skills: ['Furniture Repair', 'Door Installation', 'Wood Work']
            }
        ];
        
        console.log(`📋 Using ${mockFixers.length} mock fixers for demonstration`);
        res.json({
            success: true,
            count: mockFixers.length,
            data: mockFixers
        });
    } catch (error) {
        console.error('Error fetching fixers:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching fixers',
            error: error.message
        });
    }
});

// Get individual fixer details by ID (PUBLIC - no authentication required)
app.get('/api/fixers/:id', async (req, res) => {
    // Add CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    try {
        const { id } = req.params;
        
        // Try to get real fixer from database first
        try {
            const Fixer = require('./models/fixer');
            const mongoose = require('mongoose');
            
            // Check if id is a valid ObjectId, if not, skip database lookup
            let fixer = null;
            if (mongoose.Types.ObjectId.isValid(id)) {
                fixer = await Fixer.findById(id)
                    .select('-password -resetPasswordToken -resetPasswordExpire');
            } else {
                console.log(`ℹ️ ID "${id}" is not a valid ObjectId, using mock data`);
            }
            
            if (fixer && fixer.isActive) {
                console.log(`✅ Found fixer ${fixer.name} in database`);
                res.json({
                    success: true,
                    data: {
                        id: fixer._id,
                        name: fixer.name || 'Unknown Fixer',
                        email: fixer.email,
                        phone: fixer.phone,
                        serviceCategory: fixer.serviceCategory || 'General Repair',
                        experience: fixer.professionalInfo?.experience || 0,
                        hourlyRate: fixer.pricing?.hourlyRate || 0,
                        address: fixer.address || { city: 'Location not set' },
                        isOnline: fixer.isOnline || false,
                        workingHours: fixer.availability?.workingHours,
                        rating: fixer.rating || { average: 0, totalReviews: 0 },
                        totalJobs: fixer.totalJobs || 0,
                        completedJobs: fixer.completedJobs || 0,
                        profileImage: fixer.documents?.profilePicture || 'https://via.placeholder.com/50',
                        documents: fixer.documents,
                        username: fixer.username,
                        isActive: fixer.isActive,
                        bio: fixer.professionalInfo?.bio || 'Professional service provider',
                        skills: fixer.professionalInfo?.skills || ['General Repair'],
                        professionalInfo: fixer.professionalInfo,
                        pricing: fixer.pricing,
                        availability: fixer.availability,
                        createdAt: fixer.createdAt,
                        updatedAt: fixer.updatedAt
                    }
                });
                return;
            } else {
                console.log(`ℹ️ Fixer with ID ${id} not found or inactive`);
            }
        } catch (dbError) {
            console.log('⚠️ Database not available, using mock data:', dbError.message);
        }
        
        // Fallback to mock data if database is not available or fixer not found
        const mockFixers = [
            {
                id: '1',
                name: 'Rajesh Kumar',
                email: 'rajesh@example.com',
                phone: '+91 98765 43210',
                serviceCategory: 'Plumbing',
                experience: 5,
                hourlyRate: 300,
                address: { 
                    street: '123 Main Street',
                    city: 'Delhi',
                    state: 'Delhi',
                    pincode: '110001'
                },
                isOnline: true,
                rating: { average: 4.5, totalReviews: 25 },
                totalJobs: 150,
                completedJobs: 145,
                profileImage: 'https://via.placeholder.com/50',
                username: 'rajesh_kumar',
                isActive: true,
                bio: 'Expert plumber with 5+ years experience in residential and commercial plumbing. Specializes in leak repairs, pipe installation, and bathroom fixtures.',
                skills: ['Pipe Repair', 'Leak Fixing', 'Bathroom Installation', 'Water Heater Repair', 'Drain Cleaning'],
                professionalInfo: {
                    experience: 5,
                    bio: 'Expert plumber with 5+ years experience in residential and commercial plumbing. Specializes in leak repairs, pipe installation, and bathroom fixtures.',
                    skills: ['Pipe Repair', 'Leak Fixing', 'Bathroom Installation', 'Water Heater Repair', 'Drain Cleaning'],
                    certifications: ['Licensed Plumber', 'Water Safety Certified'],
                    languages: ['Hindi', 'English']
                },
                pricing: {
                    hourlyRate: 300,
                    calloutFee: 100,
                    emergencyRate: 500
                },
                availability: {
                    isAvailable: true,
                    workingHours: {
                        start: '08:00',
                        end: '20:00'
                    },
                    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                },
                createdAt: '2023-01-15T00:00:00.000Z',
                updatedAt: '2024-12-15T00:00:00.000Z'
            },
            {
                id: '2',
                name: 'Priya Sharma',
                email: 'priya@example.com',
                phone: '+91 98765 43211',
                serviceCategory: 'Electrical',
                experience: 3,
                hourlyRate: 400,
                address: { 
                    street: '456 Electric Avenue',
                    city: 'Mumbai',
                    state: 'Maharashtra',
                    pincode: '400001'
                },
                isOnline: false,
                rating: { average: 4.8, totalReviews: 18 },
                totalJobs: 80,
                completedJobs: 78,
                profileImage: 'https://via.placeholder.com/50',
                username: 'priya_sharma',
                isActive: true,
                bio: 'Certified electrician specializing in home repairs and electrical installations. Committed to safety and quality work.',
                skills: ['Wiring', 'Switch Repair', 'Circuit Installation', 'Electrical Panel Upgrade', 'Light Fixture Installation'],
                professionalInfo: {
                    experience: 3,
                    bio: 'Certified electrician specializing in home repairs and electrical installations. Committed to safety and quality work.',
                    skills: ['Wiring', 'Switch Repair', 'Circuit Installation', 'Electrical Panel Upgrade', 'Light Fixture Installation'],
                    certifications: ['Licensed Electrician', 'Safety Certified'],
                    languages: ['Hindi', 'English', 'Marathi']
                },
                pricing: {
                    hourlyRate: 400,
                    calloutFee: 150,
                    emergencyRate: 600
                },
                availability: {
                    isAvailable: false,
                    workingHours: {
                        start: '09:00',
                        end: '18:00'
                    },
                    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
                },
                createdAt: '2023-06-10T00:00:00.000Z',
                updatedAt: '2024-12-10T00:00:00.000Z'
            },
            {
                id: '3',
                name: 'Amit Singh',
                email: 'amit@example.com',
                phone: '+91 98765 43212',
                serviceCategory: 'Carpentry',
                experience: 7,
                hourlyRate: 350,
                address: { 
                    street: '789 Wood Street',
                    city: 'Bangalore',
                    state: 'Karnataka',
                    pincode: '560001'
                },
                isOnline: true,
                rating: { average: 4.3, totalReviews: 32 },
                totalJobs: 200,
                completedJobs: 195,
                profileImage: 'https://via.placeholder.com/50',
                username: 'amit_singh',
                isActive: true,
                bio: 'Master carpenter with expertise in furniture repair, custom woodwork, and home improvements. 7+ years of experience.',
                skills: ['Furniture Repair', 'Door Installation', 'Wood Work', 'Cabinet Making', 'Flooring'],
                professionalInfo: {
                    experience: 7,
                    bio: 'Master carpenter with expertise in furniture repair, custom woodwork, and home improvements. 7+ years of experience.',
                    skills: ['Furniture Repair', 'Door Installation', 'Wood Work', 'Cabinet Making', 'Flooring'],
                    certifications: ['Master Carpenter', 'Wood Working Certified'],
                    languages: ['Hindi', 'English', 'Kannada']
                },
                pricing: {
                    hourlyRate: 350,
                    calloutFee: 100,
                    emergencyRate: 500
                },
                availability: {
                    isAvailable: true,
                    workingHours: {
                        start: '07:00',
                        end: '19:00'
                    },
                    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                },
                createdAt: '2022-03-20T00:00:00.000Z',
                updatedAt: '2024-12-12T00:00:00.000Z'
            }
        ];
        
        // Find the fixer by ID in mock data
        const fixer = mockFixers.find(f => f.id === id);
        
        if (fixer) {
            console.log(`📋 Using mock fixer data for ID: ${id}`);
            res.json({
                success: true,
                data: fixer
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Fixer not found'
            });
        }
    } catch (error) {
        console.error('Error fetching fixer details:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching fixer details',
            error: error.message
        });
    }
});

// Create test fixer endpoint
app.post('/api/create-test-fixer', async (req, res) => {
    try {
        // Try to create real fixer in database first
        try {
            const Fixer = require('./models/fixer');
            
            // Create a test fixer
            const testFixer = new Fixer({
                name: 'Test Fixer',
                email: `testfixer${Date.now()}@example.com`,
                phone: '+91 98765 43210',
                password: 'password123',
                serviceCategory: 'General Repair',
                address: {
                    street: 'Test Street',
                    city: 'Test City',
                    state: 'Test State',
                    pincode: '123456'
                },
                professionalInfo: {
                    experience: 2,
                    bio: 'Test fixer for demonstration',
                    skills: ['General Repair', 'Maintenance']
                },
                pricing: {
                    hourlyRate: 250
                },
                availability: {
                    isAvailable: true,
                    workingHours: {
                        start: '09:00',
                        end: '18:00'
                    }
                },
                rating: {
                    average: 4.0,
                    totalReviews: 0
                },
                isActive: true
            });
            
            await testFixer.save();
            
            console.log('✅ Test fixer created in database:', testFixer.name);
            res.json({
                success: true,
                message: 'Test fixer created successfully in database',
                data: {
                    id: testFixer._id,
                    name: testFixer.name,
                    email: testFixer.email
                }
            });
            return;
        } catch (dbError) {
            console.log('⚠️ Database not available, using mock response:', dbError.message);
        }
        
        // Fallback to mock response if database is not available
        const testFixerId = Date.now().toString();
        
        res.json({
            success: true,
            message: 'Test fixer created successfully (mock)',
            data: {
                id: testFixerId,
                name: 'Test Fixer',
                email: `testfixer${testFixerId}@example.com`
            }
        });
    } catch (error) {
        console.error('Error creating test fixer:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating test fixer',
            error: error.message
        });
    }
});

// Public service requests route (for testing)
app.get('/api/service-requests', async (req, res) => {
    try {
        console.log('📋 Public service requests endpoint called');
        
        const Booking = require('./models/booking');
        
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
});

// Protected fixer routes
app.use('/api/fixers', fixerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'FIXGHAR Backend HTTP Server is running!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        cors: {
            allowedOrigins: [
                'http://127.0.0.1:3030',
                'http://localhost:3030',
                'http://127.0.0.1:3030/index.html',
                'http://localhost:3030/index.html',
                'http://127.0.0.1:3030/dashboard',
                'http://localhost:3030/dashboard'
            ]
        },
        frontend: {
            url: 'http://127.0.0.1:3031/index.html',
            status: 'connected'
        }
    });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// MongoDB Connection
// NOTE: DB connection is managed by `./config/database.js`

// Start server
const startServer = async () => {
    try {
        const db = await connectDB();
        if (db) {
            console.log('🔗 Database connected - Real fixer profiles will be shown!');
        } else {
            console.log('⚠️ Continuing without database connection for demo...');
        }

        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log('='.repeat(60));
            console.log('🚀 FIXGHAR Backend HTTP Server Started!');
            console.log('='.repeat(60));
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📡 Backend Server: http://localhost:${PORT}`);
            console.log(`🌐 Frontend Server: http://127.0.0.1:3031`);
            console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
            console.log('='.repeat(60));
            console.log('✅ Backend ready to connect with Frontend!');
            console.log('✅ CORS configured for frontend communication');
            console.log('✅ All API endpoints available');
            console.log('='.repeat(60));
        });

        server.on('error', (err) => {
            if (err && err.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use. Stop the other process and retry.`);
                console.error('On Windows: run `netstat -ano | findstr \":5000\"` then `taskkill /PID <pid> /F`');
                process.exit(1);
            }
            console.error('❌ Server listen error:', err);
            process.exit(1);
        });

    } catch (error) {
        console.error('❌ Server startup error:', error);
        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`❌ Unhandled Promise Rejection: ${err.message}`);
    // Close server & exit process
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.log(`❌ Uncaught Exception: ${err.message}`);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received. Shutting down gracefully...');
    process.exit(0);
});

// Start the server
startServer();
