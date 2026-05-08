// Chatbot Controller for FIXGHAR AI Assistant
const asyncHandler = require('express-async-handler');

// AI-powered response generation
const generateAIResponse = async (message, userContext = {}) => {
    const lowerMessage = message.toLowerCase();
    
    // Service booking related
    if (lowerMessage.includes('book') || lowerMessage.includes('service') || lowerMessage.includes('repair')) {
        return {
            response: `Great! I'd be happy to help you book a service. 🛠️\n\nHere's how to get started:\n\n1. **Choose your service**: Plumbing, Electrical, AC Repair, Carpentry, etc.\n2. **Select your location**: We serve Noida, Greater Noida, Delhi, and surrounding areas\n3. **Describe the issue**: Tell us what needs to be fixed\n4. **Choose timing**: Pick your preferred date and time\n5. **Get matched**: We'll connect you with the best fixer\n\nWhat type of service do you need?`,
            suggestions: ['Plumbing', 'Electrical', 'AC Repair', 'Carpentry', 'General Repair'],
            action: 'service_booking'
        };
    }
    
    // Pricing related
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('rate') || lowerMessage.includes('charge')) {
        return {
            response: `Here's our transparent pricing structure: 💰\n\n**Hourly Rates:**\n• Plumbing: ₹300-800/hour\n• Electrical: ₹400-1000/hour\n• AC Repair: ₹500-1200/hour\n• Carpentry: ₹350-900/hour\n• General Repair: ₹250-600/hour\n\n**Additional Charges:**\n• Call-out fee: ₹100-200\n• Emergency service: +50% of base rate\n• Material costs: As per actual\n\n**Special Offers:**\n• First-time users: 10% discount\n• Senior citizens: 15% discount\n• Bulk bookings: Up to 20% off\n\nWould you like a detailed estimate for a specific service?`,
            suggestions: ['Get Estimate', 'Book Service', 'View Packages', 'Emergency Rates'],
            action: 'pricing_info'
        };
    }
    
    // Fixer related
    if (lowerMessage.includes('fixer') || lowerMessage.includes('technician') || lowerMessage.includes('expert')) {
        return {
            response: `Our fixers are highly skilled professionals! 👨‍🔧\n\n**What makes our fixers special:**\n• Verified and background-checked\n• 3+ years of experience\n• Professional certifications\n• 24/7 availability\n• Customer rating: 4.5+ stars\n\n**Service areas:**\n• Noida, Greater Noida\n• Delhi, Gurgaon\n• Ghaziabad, Faridabad\n\n**How we match you:**\n1. Based on service type\n2. Your location\n3. Availability\n4. Customer ratings\n5. Specialization\n\nWhat type of fixer do you need?`,
            suggestions: ['Find Fixers', 'View Profiles', 'Check Availability', 'Book Now'],
            action: 'fixer_info'
        };
    }
    
    // Location related
    if (lowerMessage.includes('location') || lowerMessage.includes('area') || lowerMessage.includes('city') || 
        lowerMessage.includes('noida') || lowerMessage.includes('delhi') || lowerMessage.includes('gurgaon')) {
        return {
            response: `We provide services across multiple locations! 📍\n\n**Primary Service Areas:**\n• Noida (Sector 1-150)\n• Greater Noida (Alpha, Beta, Gamma)\n• Delhi (All areas)\n• Gurgaon\n• Ghaziabad\n• Faridabad\n\n**Service Time:**\n• Same day service available\n• Emergency: Within 2 hours\n• Regular: 4-24 hours\n\n**Coverage:**\n• 100% coverage in Noida/Greater Noida\n• 95% coverage in Delhi\n• 80% coverage in other areas\n\nWhat's your exact location? I can check availability for you.`,
            suggestions: ['Check Availability', 'Book Service', 'Find Local Fixers', 'Emergency Service'],
            action: 'location_info'
        };
    }
    
    // Booking status
    if (lowerMessage.includes('status') || lowerMessage.includes('track') || lowerMessage.includes('progress')) {
        return {
            response: `I can help you track your booking! 📋\n\n**To check your booking status:**\n\n1. **Provide booking ID** (if you have it)\n2. **Or share your phone number** used for booking\n3. **Or your email address**\n\n**Current Status Options:**\n• Pending - Waiting for fixer assignment\n• Confirmed - Fixer assigned, scheduled\n• In Progress - Work started\n• Completed - Service finished\n• Cancelled - Booking cancelled\n\n**What you can do:**\n• Track real-time progress\n• Chat with your fixer\n• Reschedule if needed\n• Rate the service\n\nPlease share your booking details and I'll check the status for you.`,
            suggestions: ['Track by Phone', 'Track by Email', 'Track by ID', 'Contact Support'],
            action: 'booking_status'
        };
    }
    
    // Contact/Support
    if (lowerMessage.includes('contact') || lowerMessage.includes('support') || lowerMessage.includes('help') || lowerMessage.includes('phone')) {
        return {
            response: `Here are all the ways to reach us: 📞\n\n**24/7 Support:**\n• Phone: +91-9876543210\n• WhatsApp: +91-9876543210\n• Email: support@fixghar.com\n\n**Business Hours:**\n• Monday-Sunday: 6 AM - 10 PM\n• Emergency: 24/7\n\n**Social Media:**\n• Facebook: @fixghar\n• Instagram: @fixghar_official\n• Twitter: @fixghar\n\n**Office Address:**\nFIXGHAR Services Pvt Ltd\nSector 62, Noida\nUttar Pradesh - 201301\n\n**Response Time:**\n• Phone: Immediate\n• WhatsApp: Within 5 minutes\n• Email: Within 2 hours\n\nIs there something specific I can help you with right now?`,
            suggestions: ['Call Now', 'WhatsApp', 'Email Support', 'Visit Office'],
            action: 'contact_info'
        };
    }
    
    // Greeting
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
        return {
            response: "Hello! 👋 How can I help you with your home repair needs today?",
            suggestions: ['Book Service', 'Find Fixers', 'Check Pricing', 'Track Booking'],
            action: 'greeting'
        };
    }
    
    // Thank you
    if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
        return {
            response: "You're welcome! 😊 Is there anything else I can help you with?",
            suggestions: ['Book Service', 'Rate Service', 'Contact Support', 'View Services'],
            action: 'thanks'
        };
    }
    
    // Emergency
    if (lowerMessage.includes('emergency') || lowerMessage.includes('urgent') || lowerMessage.includes('asap')) {
        return {
            response: `🚨 **EMERGENCY SERVICE AVAILABLE** 🚨\n\n**For immediate assistance:**\n• Call: +91-9876543210 (24/7)\n• WhatsApp: +91-9876543210\n• Response time: Within 30 minutes\n\n**Emergency services:**\n• Gas leak repair\n• Electrical hazards\n• Water pipe burst\n• AC breakdown (summer)\n• Lockout services\n\n**Emergency rates apply:**\n• Base rate + 50%\n• Available 24/7/365\n\n**What's your emergency?** I'll connect you immediately!`,
            suggestions: ['Call Emergency', 'WhatsApp Emergency', 'Gas Leak', 'Electrical Hazard'],
            action: 'emergency'
        };
    }
    
    // Default response
    const defaultResponses = [
        {
            response: "I understand you're looking for help. Could you please be more specific about what you need? I can assist with service bookings, pricing, finding fixers, and more.",
            suggestions: ['Book Service', 'Find Fixers', 'Check Pricing', 'Contact Support'],
            action: 'general_help'
        },
        {
            response: "I'm here to help with all your home repair needs! Please let me know if you need help with booking a service, checking prices, or finding the right fixer.",
            suggestions: ['Service Booking', 'Pricing Info', 'Fixer Search', 'Track Booking'],
            action: 'general_help'
        },
        {
            response: "That's an interesting question! I can help you with service bookings, pricing information, fixer details, or connect you with our support team. What would be most helpful?",
            suggestions: ['Book Service', 'Get Quote', 'Find Fixers', 'Support'],
            action: 'general_help'
        }
    ];
    
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
};

// Chat with AI assistant
const chatWithAI = asyncHandler(async (req, res) => {
    try {
        const { message, userContext = {} } = req.body;
        
        if (!message || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Message is required'
            });
        }

        // Generate AI response
        const aiResponse = await generateAIResponse(message, userContext);
        
        // Log the conversation (optional)
        console.log(`🤖 Chatbot: User asked - "${message}"`);
        console.log(`🤖 Chatbot: AI responded with action - "${aiResponse.action}"`);

        res.status(200).json({
            success: true,
            data: {
                response: aiResponse.response,
                suggestions: aiResponse.suggestions,
                action: aiResponse.action,
                timestamp: new Date().toISOString(),
                messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            }
        });

    } catch (error) {
        console.error('Chatbot error:', error);
        res.status(500).json({
            success: false,
            message: 'Sorry, I encountered an error. Please try again.',
            error: error.message
        });
    }
});

// Get quick actions/suggestions
const getQuickActions = asyncHandler(async (req, res) => {
    try {
        const quickActions = [
            {
                id: 'book_service',
                title: 'Book a Service',
                description: 'Schedule a home repair service',
                icon: '🛠️',
                action: 'service_booking'
            },
            {
                id: 'find_fixers',
                title: 'Find Fixers',
                description: 'Browse available technicians',
                icon: '👨‍🔧',
                action: 'fixer_search'
            },
            {
                id: 'check_pricing',
                title: 'Check Pricing',
                description: 'Get service cost estimates',
                icon: '💰',
                action: 'pricing_info'
            },
            {
                id: 'track_booking',
                title: 'Track Booking',
                description: 'Check your service status',
                icon: '📋',
                action: 'booking_status'
            },
            {
                id: 'emergency_service',
                title: 'Emergency Service',
                description: '24/7 urgent repair service',
                icon: '🚨',
                action: 'emergency'
            },
            {
                id: 'contact_support',
                title: 'Contact Support',
                description: 'Get help from our team',
                icon: '📞',
                action: 'contact_info'
            }
        ];

        res.status(200).json({
            success: true,
            data: {
                quickActions,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Quick actions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load quick actions',
            error: error.message
        });
    }
});

// Get chatbot status and info
const getChatbotInfo = asyncHandler(async (req, res) => {
    try {
        const chatbotInfo = {
            name: 'FIXGHAR Assistant',
            version: '1.0.0',
            status: 'online',
            capabilities: [
                'Service booking assistance',
                'Pricing information',
                'Fixer recommendations',
                'Booking status tracking',
                'Emergency service coordination',
                'General support queries'
            ],
            supportedLanguages: ['English', 'Hindi'],
            responseTime: '< 2 seconds',
            availability: '24/7',
            lastUpdated: new Date().toISOString()
        };

        res.status(200).json({
            success: true,
            data: chatbotInfo
        });

    } catch (error) {
        console.error('Chatbot info error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get chatbot information',
            error: error.message
        });
    }
});

// Save chat conversation (optional feature)
const saveConversation = asyncHandler(async (req, res) => {
    try {
        const { messages, userInfo, sessionId } = req.body;
        
        // In a real application, you would save this to a database
        // For now, we'll just log it
        console.log(`💬 Chat session saved: ${sessionId}`);
        console.log(`👤 User: ${userInfo?.name || 'Anonymous'}`);
        console.log(`📝 Messages: ${messages?.length || 0}`);
        
        res.status(200).json({
            success: true,
            message: 'Conversation saved successfully',
            data: {
                sessionId,
                messageCount: messages?.length || 0,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Save conversation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save conversation',
            error: error.message
        });
    }
});

module.exports = {
    chatWithAI,
    getQuickActions,
    getChatbotInfo,
    saveConversation
};


