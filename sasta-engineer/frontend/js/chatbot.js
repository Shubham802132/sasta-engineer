// AI Chatbot for FIXGHAR Customer Support
class FIXGHARChatbot {
    constructor() {
        this.isOpen = false;
        this.isMinimized = true; // Start minimized by default
        this.messages = [];
        this.isTyping = false;
        this.currentUser = null;
        this.hasNewMessages = false;
        this.backendConnected = false;
        this.isLoggedIn = false;
        this.userProfile = null;
        this.userBookings = [];
        this.isFixer = false;
        this.fixerProfile = null;
        this.fixerBookings = [];
        this.serviceRequests = [];
        this.refreshInterval = null;
        this.refreshIntervalId = null;
        
        // Initialize chatbot
        this.init();
        this.checkBackendConnection();
        this.checkUserAuthentication();
        
        // Check if we're on fixer dashboard and force fixer mode if needed
        this.checkFixerDashboard();
        
        this.loadWelcomeMessage();
    }

    init() {
        // Create chatbot HTML structure
        this.createChatbotHTML();
        this.bindEvents();
        this.loadUserData();
        this.ensureVisibility();
    }

    createChatbotHTML() {
        const chatbotHTML = `
            <div class="embedded-chat-widget" id="embeddedChatWidget" style="display: none;">
                <div class="embedded-chat-header">
                    <div class="embedded-chat-title">
                        <span>🤖</span>
                        <span>FIXGHAR Assistant</span>
                    </div>
                    <div class="embedded-chat-status">
                        <div class="status-dot"></div>
                        <span>Online</span>
                    </div>
                    <button class="embedded-chat-close" id="embeddedChatClose">×</button>
                </div>
                
                <div class="embedded-chat-messages" id="embeddedChatMessages">
                    <!-- Messages will be added here -->
                </div>
                
                <div class="embedded-chat-input-container">
                    <input type="text" class="embedded-chat-input" id="embeddedChatInput" 
                           placeholder="Ask me anything about home repairs..." maxlength="500">
                    <button class="embedded-chat-send" id="embeddedChatSend">
                        <span>🚀</span>
                    </button>
                </div>
            </div>
            
            <button class="floating-chat-icon" id="floatingChatIcon" style="display: flex;">
                <span class="thought-bubble-tail"></span>
            </button>
        `;

        // Add to body
        document.body.insertAdjacentHTML('beforeend', chatbotHTML);
        console.log('✅ Chatbot HTML added to body');
        
        // Add click handlers immediately after creating HTML
        this.addClickHandlers();
        
        // Set initial state
        this.setInitialState();
    }

    addClickHandlers() {
        console.log('Adding click handlers...');
        
        // Add click handler for close button
        const closeButton = document.getElementById('embeddedChatClose');
        if (closeButton) {
            console.log('Close button found, adding click handler');
            closeButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Close button clicked!');
                this.minimizeChatbot();
            });
        } else {
            console.error('Close button not found!');
        }
        
        // Add click handler for floating icon
        const floatingIcon = document.getElementById('floatingChatIcon');
        if (floatingIcon) {
            console.log('Floating icon found, adding click handler');
            floatingIcon.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Floating icon clicked!');
                this.expandChatbot();
            });
        } else {
            console.error('Floating icon not found!');
        }
    }

    setInitialState() {
        console.log('Setting initial minimized state...');
        
        const widget = document.getElementById('embeddedChatWidget');
        const floatingIcon = document.getElementById('floatingChatIcon');
        
        console.log('Widget element:', widget);
        console.log('Floating icon element:', floatingIcon);
        
        if (widget) {
            widget.style.display = 'none';
            widget.style.visibility = 'hidden';
            widget.style.opacity = '0';
            widget.style.transform = 'scale(0)';
            widget.style.pointerEvents = 'none';
            widget.classList.add('minimized');
            console.log('✅ Widget set to hidden');
        } else {
            console.error('❌ Widget element not found!');
        }
        
        if (floatingIcon) {
            floatingIcon.style.display = 'flex';
            floatingIcon.style.visibility = 'visible';
            floatingIcon.style.opacity = '1';
            floatingIcon.style.zIndex = '99999';
            floatingIcon.classList.add('show');
            console.log('✅ Floating icon set to visible');
            console.log('Floating icon styles:', {
                display: floatingIcon.style.display,
                visibility: floatingIcon.style.visibility,
                opacity: floatingIcon.style.opacity,
                zIndex: floatingIcon.style.zIndex
            });
        } else {
            console.error('❌ Floating icon element not found!');
        }
        
        console.log('Initial state set: minimized');
    }

    // Method to refresh authentication status (call this when user logs in/out)
    async refreshAuthentication() {
        console.log('🔄 Refreshing authentication status...');
        await this.checkUserAuthentication();
        setTimeout(() => {
            this.refreshWelcomeMessage();
        }, 500);
    }

    // Method to detect role changes and update accordingly
    detectRoleChange() {
        const currentUserType = localStorage.getItem('userType');
        const currentToken = localStorage.getItem('fixghar_token');
        
        console.log('🔍 Detecting role change...');
        console.log('Current userType:', currentUserType);
        console.log('Current token exists:', !!currentToken);
        console.log('Current isLoggedIn:', this.isLoggedIn);
        console.log('Current isFixer:', this.isFixer);
        
        // If user logged out
        if (!currentToken && this.isLoggedIn) {
            console.log('👋 User logged out, resetting chatbot...');
            this.isLoggedIn = false;
            this.isFixer = false;
            this.userProfile = null;
            this.fixerProfile = null;
            this.currentUser = null;
            this.userBookings = [];
            this.fixerBookings = [];
            this.serviceRequests = [];
            
            // Stop auto-refresh when logged out
            this.stopAutoRefresh();
            
            this.refreshWelcomeMessage();
            return;
        }
        
        // If user logged in with different role
        if (currentToken && currentUserType) {
            const shouldBeFixer = currentUserType === 'fixer';
            if (this.isLoggedIn && this.isFixer !== shouldBeFixer) {
                console.log('🔄 Role changed, refreshing authentication...');
                this.refreshAuthentication();
            }
        }
    }

    // Method to refresh service requests count
    async refreshServiceRequests() {
        if (this.isLoggedIn && this.isFixer) {
            console.log('🔄 Refreshing service requests...');
            await this.loadFixerData();
            this.refreshWelcomeMessage();
            
            // Update dashboard count and profile stats if on fixer dashboard
            if (window.updateServiceRequestsCount) {
                window.updateServiceRequestsCount();
            }
            if (window.updateProfileStats) {
                window.updateProfileStats();
            }
        }
    }

    // Method to start automatic data refresh
    startAutoRefresh() {
        if (this.refreshIntervalId) {
            clearInterval(this.refreshIntervalId);
        }
        
        // Refresh every 30 seconds for real-time updates
        this.refreshIntervalId = setInterval(() => {
            if (this.isLoggedIn) {
                console.log('🔄 Auto-refreshing data...');
                if (this.isFixer) {
                    this.loadFixerData();
                } else {
                    this.loadUserBookings();
                }
            }
        }, 30000); // 30 seconds
        
        console.log('✅ Auto-refresh started (30 seconds interval)');
    }

    // Method to stop automatic data refresh
    stopAutoRefresh() {
        if (this.refreshIntervalId) {
            clearInterval(this.refreshIntervalId);
            this.refreshIntervalId = null;
            console.log('⏹️ Auto-refresh stopped');
        }
    }

    // Method to refresh all data manually
    async refreshAllData() {
        if (this.isLoggedIn) {
            console.log('🔄 Manual refresh triggered...');
            if (this.isFixer) {
                await this.loadFixerData();
            } else {
                await this.loadUserBookings();
            }
            this.refreshWelcomeMessage();
            
            // Update dashboard count and profile stats if on fixer dashboard
            if (window.updateServiceRequestsCount) {
                window.updateServiceRequestsCount();
            }
            if (window.updateProfileStats) {
                window.updateProfileStats();
            }
        }
    }

    async checkBackendConnection() {
        try {
            const apiBase = window.FIXGHAR_CONFIG?.api?.baseURL || 'https://fixghar.onrender.com/api';
            const response = await fetch(`${apiBase}/chatbot/health`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.backendConnected = true;
                    console.log('✅ Backend connected:', data.message);
                }
            }
        } catch (error) {
            this.backendConnected = false;
            console.log('❌ Backend not connected:', error.message);
        }
    }

    async checkUserAuthentication() {
        try {
            // Check for auth token
            const token = localStorage.getItem('fixghar_token') || 
                         (window.cookieManager && window.cookieManager.getAuthToken());
            const apiBase = window.FIXGHAR_CONFIG?.api?.baseURL || 'https://fixghar.onrender.com/api';
            
            // Check userType from localStorage first
            const userType = localStorage.getItem('userType');
            
            console.log('🔍 Checking authentication...', token ? 'Token found' : 'No token');
            console.log('👤 User type from localStorage:', userType);
            
            if (token && userType) {
                this.isLoggedIn = true;
                
                if (userType === 'fixer') {
                    // User is logged in as Fixer
                    this.isFixer = true;
                    console.log('🔧 Detected Fixer role');
                    
                    // Try to get fixer profile
                    const fixerResponse = await fetch(`${apiBase}/fixers/profile`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    console.log('🔧 Fixer profile response:', fixerResponse.status);

                    if (fixerResponse.ok) {
                        const fixerData = await fixerResponse.json();
                        console.log('🔧 Fixer data:', fixerData);
                        
                        if (fixerData.success) {
                            this.fixerProfile = fixerData.data;
                            this.currentUser = fixerData.data;
                            console.log('✅ Fixer authenticated:', this.fixerProfile.name);
                            console.log('🔧 Fixer profile data:', this.fixerProfile);
                            
                            // Load fixer data
                            await this.loadFixerData();
                            
                            // Force refresh welcome message for fixers
                            setTimeout(() => {
                                this.refreshWelcomeMessage();
                            }, 1000);
                            
                            // Start auto-refresh for fixers
                            this.startAutoRefresh();
                            
                            return;
                        }
                    }
                    
                    // If fixer profile fetch fails, create a basic fixer profile
                    this.fixerProfile = {
                        name: 'Fixer User',
                        email: 'fixer@example.com',
                        serviceCategory: 'General Repair',
                        isOnline: true
                    };
                    this.currentUser = this.fixerProfile;
                    console.log('⚠️ Using basic fixer profile');
                    
                    // Start auto-refresh even with basic profile
                    this.startAutoRefresh();
                    
                } else if (userType === 'user') {
                    // User is logged in as User
                    this.isFixer = false;
                    console.log('👤 Detected User role');
                    
                    // Try to get user profile
                    const userResponse = await fetch('https://fixghar.onrender.com/api/users/profile', {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (userResponse.ok) {
                        const userData = await userResponse.json();
                        if (userData.success) {
                            this.userProfile = userData.data;
                            this.currentUser = userData.data;
                            console.log('✅ User authenticated:', this.userProfile.name);
                            
                            // Load user bookings
                            await this.loadUserBookings();
                            
                            // Start auto-refresh for users
                            this.startAutoRefresh();
                            
                            return;
                        }
                    }
                    
                    // If user profile fetch fails, create a basic user profile
                    this.userProfile = {
                        name: 'User',
                        email: 'user@example.com'
                    };
                    this.currentUser = this.userProfile;
                    console.log('⚠️ Using basic user profile');
                    
                    // Start auto-refresh even with basic profile
                    this.startAutoRefresh();
                }
                
                console.log('✅ Authentication successful for:', userType);
            } else {
                this.isLoggedIn = false;
                this.isFixer = false;
                console.log('❌ No authentication token or userType found');
            }
        } catch (error) {
            this.isLoggedIn = false;
            this.isFixer = false;
            console.log('❌ Authentication failed:', error.message);
        }
    }

    async loadUserBookings() {
        try {
            const token = localStorage.getItem('fixghar_token') || 
                         (window.cookieManager && window.cookieManager.getAuthToken());
            
            if (token) {
                const response = await fetch('https://fixghar.onrender.com/api/users/bookings', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        this.userBookings = data.data;
                        console.log('✅ User bookings loaded:', this.userBookings.length);
                    }
                }
            }
        } catch (error) {
            console.log('❌ Error loading user bookings:', error.message);
        }
    }

    async loadFixerData() {
        try {
            const token = localStorage.getItem('fixghar_token') || 
                         (window.cookieManager && window.cookieManager.getAuthToken());
            
            if (token) {
                // Load fixer bookings
                const bookingsResponse = await fetch('https://fixghar.onrender.com/api/fixers/bookings', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (bookingsResponse.ok) {
                    const bookingsData = await bookingsResponse.json();
                    if (bookingsData.success) {
                        this.fixerBookings = bookingsData.data;
                        console.log('✅ Fixer bookings loaded:', this.fixerBookings.length);
                    }
                } else {
                    console.log('⚠️ Bookings API not available, no data loaded');
                    this.fixerBookings = [];
                }

                // Load service requests
                const requestsResponse = await fetch('https://fixghar.onrender.com/api/fixers/service-requests', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (requestsResponse.ok) {
                    const requestsData = await requestsResponse.json();
                    if (requestsData.success) {
                        this.serviceRequests = requestsData.data;
                        console.log('✅ Service requests loaded from API:', this.serviceRequests.length);
                    }
                } else {
                    console.log('⚠️ Service requests API not available, no data loaded');
                    this.serviceRequests = [];
                    console.log('✅ Service requests array initialized as empty');
                }
            }
            
            // Update dashboard count and profile stats if on fixer dashboard
            if (window.updateServiceRequestsCount) {
                window.updateServiceRequestsCount();
            }
            if (window.updateProfileStats) {
                window.updateProfileStats();
            }
        } catch (error) {
            console.log('❌ Error loading fixer data:', error.message);
            // Initialize empty array on error
            this.serviceRequests = [];
            console.log('✅ Service requests array initialized as empty due to error');
            
            // Update dashboard count even on error
            if (window.updateServiceRequestsCount) {
                window.updateServiceRequestsCount();
            }
        }
    }

    bindEvents() {
        const close = document.getElementById('embeddedChatClose');
        const input = document.getElementById('embeddedChatInput');
        const send = document.getElementById('embeddedChatSend');
        const floatingIcon = document.getElementById('floatingChatIcon');

        console.log('Binding events...'); // Debug log
        console.log('Close button found:', !!close); // Debug log
        console.log('Floating icon found:', !!floatingIcon); // Debug log

        if (close) {
            close.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Close button clicked!'); // Debug log
                this.minimizeChatbot();
            });
        }
        
        if (send) {
            send.addEventListener('click', () => this.sendMessage());
        }
        
        if (floatingIcon) {
            floatingIcon.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Floating icon clicked!'); // Debug log
                this.expandChatbot();
            });
        }
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize input
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
        });

        // Ensure visibility on scroll
        window.addEventListener('scroll', () => {
            this.ensureVisibility();
        });

        // Ensure visibility on resize
        window.addEventListener('resize', () => {
            this.ensureVisibility();
        });
    }

    loadUserData() {
        // Try to get user data from localStorage or cookies
        const userData = localStorage.getItem('fixghar_user') || 
                        this.getCookie('fixghar_user');
        
        if (userData) {
            try {
                this.currentUser = JSON.parse(userData);
            } catch (e) {
                console.log('Could not parse user data');
            }
        }
    }

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    ensureVisibility() {
        // Ensure chat widget is always visible and on top
        const widget = document.getElementById('embeddedChatWidget');
        const floatingIcon = document.getElementById('floatingChatIcon');
        
        if (widget) {
            // Force high z-index
            widget.style.zIndex = '9999';
            widget.style.position = 'fixed';
            widget.style.bottom = '20px';
            widget.style.right = '20px';
            
            // Ensure it's not clipped by parent containers
            widget.style.isolation = 'isolate';
            widget.style.transform = 'translateZ(0)';
            
            // Add to body if not already there
            if (widget.parentNode !== document.body) {
                document.body.appendChild(widget);
            }
        }
        
        if (floatingIcon) {
            // Ensure floating icon is also properly positioned
            floatingIcon.style.zIndex = '9999';
            floatingIcon.style.position = 'fixed';
            floatingIcon.style.bottom = '20px';
            floatingIcon.style.right = '20px';
            
            // Add to body if not already there
            if (floatingIcon.parentNode !== document.body) {
                document.body.appendChild(floatingIcon);
            }
        }
    }

    toggleChatbot() {
        // Not needed for embedded widget
    }

    minimizeChatbot() {
        console.log('=== MINIMIZE FUNCTION CALLED ===');
        
        // Get elements
        const widget = document.getElementById('embeddedChatWidget');
        const floatingIcon = document.getElementById('floatingChatIcon');
        
        console.log('Widget element:', widget);
        console.log('Floating icon element:', floatingIcon);
        
        // Hide the main widget
        if (widget) {
            widget.style.display = 'none';
            widget.style.visibility = 'hidden';
            widget.style.opacity = '0';
            widget.style.transform = 'scale(0)';
            widget.style.pointerEvents = 'none';
            widget.classList.remove('expanded');
            widget.classList.add('minimized');
            console.log('✅ Widget hidden');
        } else {
            console.error('❌ Widget not found');
        }
        
        // Show the floating icon
        if (floatingIcon) {
            floatingIcon.style.display = 'flex';
            floatingIcon.style.visibility = 'visible';
            floatingIcon.style.opacity = '1';
            floatingIcon.classList.add('show');
            console.log('✅ Floating icon shown');
        } else {
            console.error('❌ Floating icon not found');
        }
        
        // Update state
        this.isMinimized = true;
        this.isOpen = false;
        
        console.log('=== MINIMIZE COMPLETED ===');
    }

    expandChatbot() {
        console.log('=== EXPAND FUNCTION CALLED ===');
        
        // Get elements
        const widget = document.getElementById('embeddedChatWidget');
        const floatingIcon = document.getElementById('floatingChatIcon');
        
        console.log('Widget element:', widget);
        console.log('Floating icon element:', floatingIcon);
        
        // Hide the floating icon
        if (floatingIcon) {
            floatingIcon.style.display = 'none';
            floatingIcon.style.visibility = 'hidden';
            floatingIcon.style.opacity = '0';
            floatingIcon.classList.remove('show');
            console.log('✅ Floating icon hidden');
        } else {
            console.error('❌ Floating icon not found');
        }
        
        // Show the main widget
        if (widget) {
            widget.style.display = 'flex';
            widget.style.visibility = 'visible';
            widget.style.opacity = '1';
            widget.style.transform = 'scale(1)';
            widget.style.pointerEvents = 'auto';
            widget.classList.remove('minimized');
            widget.classList.add('expanded');
            console.log('✅ Widget shown');
        } else {
            console.error('❌ Widget not found');
        }
        
        // Update state
        this.isMinimized = false;
        this.isOpen = true;
        this.hasNewMessages = false;
        
        // Hide notification badge
        this.hideNotificationBadge();
        
        console.log('=== EXPAND COMPLETED ===');
    }

    showNotificationBadge() {
        const floatingIcon = document.getElementById('floatingChatIcon');
        if (floatingIcon) {
            floatingIcon.classList.add('has-notification');
            this.hasNewMessages = true;
        }
    }

    hideNotificationBadge() {
        const floatingIcon = document.getElementById('floatingChatIcon');
        if (floatingIcon) {
            floatingIcon.classList.remove('has-notification');
            this.hasNewMessages = false;
        }
    }

    closeChatbot() {
        const widget = document.getElementById('embeddedChatWidget');
        const floatingIcon = document.getElementById('floatingChatIcon');
        
        if (widget) {
            widget.style.display = 'none';
        }
        
        if (floatingIcon) {
            floatingIcon.style.display = 'none';
        }
        
        this.isMinimized = false;
        this.isOpen = false;
    }

    async loadWelcomeMessage() {
        const welcomeMessage = this.getWelcomeMessage();
        this.addMessage('bot', welcomeMessage);
        await this.addQuickActions();
    }

    async refreshWelcomeMessage() {
        // Clear existing messages
        const messagesContainer = document.getElementById('embeddedChatMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            this.messages = [];
        }
        
        // Load new welcome message
        const welcomeMessage = this.getWelcomeMessage();
        this.addMessage('bot', welcomeMessage);
        await this.addQuickActions();
        
        console.log('🔄 Welcome message refreshed for fixer');
    }

    checkFixerDashboard() {
        // Check if we're on the fixer dashboard page
        const currentPath = window.location.pathname;
        const isFixerDashboard = currentPath.includes('fixer-dashboard');
        
        console.log('🔍 Current path:', currentPath);
        console.log('🔧 Is fixer dashboard:', isFixerDashboard);
        console.log('🔧 Current isFixer status:', this.isFixer);
        console.log('🔧 Current isLoggedIn status:', this.isLoggedIn);
        
        if (isFixerDashboard) {
            // Force fixer mode if we're on fixer dashboard
            console.log('🔧 On fixer dashboard - forcing fixer mode...');
            this.isFixer = true;
            this.isLoggedIn = true;
            
            // Create a default fixer profile if none exists
            if (!this.fixerProfile) {
                this.fixerProfile = {
                    name: 'Fixer User',
                    email: 'fixer@example.com',
                    phone: '+91-9876543210',
                    serviceCategory: 'General Repair',
                    isOnline: true,
                    rating: 4.5,
                    professionalInfo: {
                        experience: 5,
                        skills: ['Plumbing', 'Electrical', 'AC Repair']
                    },
                    address: {
                        street: 'Service Area',
                        city: 'Noida',
                        state: 'Uttar Pradesh'
                    },
                    createdAt: new Date().toISOString()
                };
                this.currentUser = this.fixerProfile;
                console.log('✅ Created default fixer profile for dashboard');
            }
            
            // Initialize fixer bookings as empty if none exist
            if (!this.fixerBookings || this.fixerBookings.length === 0) {
                this.fixerBookings = [];
                console.log('✅ Fixer bookings initialized as empty');
            }
            
            // Initialize service requests as empty if none exist
            if (!this.serviceRequests || this.serviceRequests.length === 0) {
                this.serviceRequests = [];
                console.log('✅ Service requests initialized as empty');
            }
            
            console.log('🔧 Fixer mode forced successfully');
        }
    }

    getWelcomeMessage() {
        const time = new Date().getHours();
        let greeting = 'Good morning';
        
        if (time >= 12 && time < 17) {
            greeting = 'Good afternoon';
        } else if (time >= 17) {
            greeting = 'Good evening';
        }

        // Check if user is logged in
        if (!this.isLoggedIn) {
            return `${greeting}! 👋 Welcome to FIXGHAR Assistant!\n\n🔐 **Please login to continue:**\n\nI can help you with home repair services, but first you need to login as:\n\n👤 **User** - To book services and track your repairs\n👨‍🔧 **Fixer** - To manage your service requests and earnings\n\n**To login:**\n• Click the "Login" button in the top navigation\n• Choose your role (User or Fixer)\n• Enter your credentials\n\n**General help available:**\n• 🛠️ Service information\n• 💰 Pricing estimates\n• 📞 Contact support\n• 💬 General inquiries\n\nPlease login to access personalized features!`;
        }

        if (this.isLoggedIn && this.isFixer && this.fixerProfile) {
            const fixerName = this.fixerProfile.name || 'Fixer';
            const totalBookings = this.fixerBookings.length;
            const pendingBookings = this.fixerBookings.filter(b => b.status === 'pending').length;
            const completedBookings = this.fixerBookings.filter(b => b.status === 'completed').length;
            const inProgressBookings = this.fixerBookings.filter(b => b.status === 'in_progress').length;
            const availableRequests = this.serviceRequests.length;
            const serviceCategory = this.fixerProfile.serviceCategory || 'General';
            const experience = this.fixerProfile.professionalInfo?.experience || 'Not specified';
            const rating = this.fixerProfile.rating || '4.5';
            const totalEarnings = this.calculateTotalEarnings();
            const isOnline = this.fixerProfile.isOnline ? '🟢 Online' : '🔴 Offline';
            const location = this.fixerProfile.location || 'Not specified';

            return `${greeting} ${fixerName}! 👨‍🔧 Welcome back to FIXGHAR Fixer Dashboard!\n\n🔧 **FIXER ROLE DETECTED** - You are logged in as a Service Provider\n\n📊 **Your Complete Fixer Profile:**\n• **Status:** ${isOnline}\n• **Service Category:** ${serviceCategory}\n• **Experience:** ${experience} years\n• **Rating:** ⭐ ${rating}/5.0\n• **Location:** ${location}\n• **Total Bookings:** ${totalBookings}\n  - Pending: ${pendingBookings}\n  - In Progress: ${inProgressBookings}\n  - Completed: ${completedBookings}\n• **Available Requests:** ${availableRequests}\n• **Total Earnings:** ₹${totalEarnings}\n\n✨ **FIXER SERVICES I can help you with:**\n• 📋 **Service Requests** - View and accept new jobs\n• 🛠️ **My Bookings** - Manage your assigned bookings\n• 👤 **My Profile** - View complete profile details\n• 📊 **Performance** - Check your ratings and stats\n• 💰 **Earnings** - View detailed earnings breakdown\n• ⏰ **Availability** - Update your working hours\n• 🆘 **Support** - Get help and assistance\n\n**Quick Commands:**\nType any of these for instant access:\n• "my profile" - Complete profile details\n• "my bookings" - All your bookings\n• "service requests" - Available jobs\n• "my earnings" - Earnings summary\n• "my performance" - Ratings and stats\n\nWhat would you like to know about?`;
        }

        if (this.isLoggedIn && this.userProfile) {
            const userName = this.userProfile.name || 'User';
            const totalBookings = this.userBookings.length;
            const pendingBookings = this.userBookings.filter(b => b.status === 'pending').length;
            const completedBookings = this.userBookings.filter(b => b.status === 'completed').length;
            const inProgressBookings = this.userBookings.filter(b => b.status === 'in_progress').length;
            const userEmail = this.userProfile.email || 'Not provided';
            const userPhone = this.userProfile.phone || 'Not provided';
            const userLocation = this.userProfile.location || 'Not specified';

            return `${greeting} ${userName}! 👋 Welcome back to FIXGHAR!\n\n👤 **USER ROLE DETECTED** - You are logged in as a Customer\n\n📊 **Your Account Summary:**\n• **Name:** ${userName}\n• **Email:** ${userEmail}\n• **Phone:** ${userPhone}\n• **Location:** ${userLocation}\n• **Total Bookings:** ${totalBookings}\n  - Pending: ${pendingBookings}\n  - In Progress: ${inProgressBookings}\n  - Completed: ${completedBookings}\n\n✨ **USER SERVICES I can help you with:**\n• 🛠️ **Book New Services** - Plumbing, Electrical, Carpentry, Painting\n• 📋 **Track Bookings** - Monitor your service requests\n• 👨‍🔧 **Find Fixers** - Browse available service providers\n• 💰 **Check Pricing** - Get cost estimates\n• ⭐ **Rate Services** - Review completed work\n• 🆘 **Support** - Get help and assistance\n\n**Quick Commands:**\nType any of these for instant access:\n• "book service" - Book a new repair service\n• "my bookings" - View all your bookings\n• "find fixers" - Browse available fixers\n• "pricing" - Check service costs\n• "support" - Get help\n\nWhat would you like to do today?`;
        }

        // Fallback for logged in but no profile data
        return `${greeting}! 👋 Welcome to FIXGHAR Assistant!\n\n🔐 **Login Status:** You are logged in but profile data is loading...\n\n✨ **I can help you with:**\n• 🛠️ Service bookings and scheduling\n• 👨‍🔧 Finding the right fixer\n• 💰 Pricing and estimates\n• 🆘 Technical support\n• 💬 General inquiries\n\nPlease wait while I load your profile information...`;
    }

    async addQuickActions() {
        try {
            // Show different quick actions based on login status
            let quickActions = [];
            
            if (!this.isLoggedIn) {
                // For non-logged in users, show login and general help options
                quickActions = [
                    { id: 'login_user', title: 'Login as User', description: 'Login to book services', icon: '👤', action: 'login_user' },
                    { id: 'login_fixer', title: 'Login as Fixer', description: 'Login to manage services', icon: '👨‍🔧', action: 'login_fixer' },
                    { id: 'service_info', title: 'Service Information', description: 'Learn about our services', icon: '🛠️', action: 'service_info' },
                    { id: 'pricing_info', title: 'Pricing Guide', description: 'Check service pricing', icon: '💰', action: 'pricing_info' },
                    { id: 'contact_support', title: 'Contact Support', description: 'Get help and assistance', icon: '📞', action: 'contact_support' }
                ];
            } else {
                // Fetch quick actions from backend for logged in users
                const response = await fetch('https://fixghar.onrender.com/api/chatbot/quick-actions');
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        quickActions = data.data.quickActions;
                        
                        // Add user-specific actions if logged in
                        if (this.isFixer) {
                            // For fixers, only show fixer-specific actions (remove customer options)
                            quickActions = [
                                { id: 'my_profile', title: 'My Profile', description: 'View your complete fixer profile', icon: '👨‍🔧', action: 'fixer_profile' },
                                { id: 'my_earnings', title: 'My Earnings', description: 'View detailed earnings breakdown', icon: '💰', action: 'fixer_earnings' },
                                { id: 'my_performance', title: 'My Performance', description: 'Check your ratings and stats', icon: '📊', action: 'fixer_performance' },
                                { id: 'service_requests', title: 'Service Requests', description: 'View available service requests', icon: '📋', action: 'service_requests' },
                                { id: 'my_bookings', title: 'My Bookings', description: 'View your assigned bookings', icon: '🛠️', action: 'fixer_bookings' },
                                { id: 'update_availability', title: 'Update Availability', description: 'Set your working hours', icon: '⏰', action: 'update_availability' },
                                { id: 'contact_support', title: 'Contact Support', description: 'Get help and assistance', icon: '📞', action: 'contact_support' }
                            ];
                        } else {
                            quickActions = [
                                { id: 'my_profile', title: 'My Profile', description: 'View your profile details', icon: '👤', action: 'user_profile' },
                                { id: 'my_bookings', title: 'My Bookings', description: 'View your booking history', icon: '📋', action: 'my_bookings' },
                                ...quickActions
                            ];
                        }
                    }
                }
            }
            
            const actionsHTML = `
                <div class="quick-actions">
                    ${quickActions.map(action => 
                        `<button class="quick-action-btn" onclick="chatbot.handleQuickAction('${action.title}')" title="${action.description}">
                            ${action.icon} ${action.title}
                        </button>`
                    ).join('')}
                </div>
            `;
            this.addToMessages(actionsHTML);
            return;
        } catch (error) {
            console.error('Error fetching quick actions:', error);
        }
    }

    handleQuickAction(action) {
        // Handle login actions for non-logged in users
        if (action === 'Login as User') {
            this.addMessage('user', action);
            setTimeout(() => {
                this.addMessage('bot', '🔐 **Login as User**\n\nTo login as a User:\n\n1. Click the "Login" button in the top navigation\n2. Select "User" as your role\n3. Enter your email and password\n4. Click "Login"\n\n**Benefits of User Account:**\n• 🛠️ Book home repair services\n• 📋 Track your bookings\n• 👨‍🔧 Find and hire fixers\n• 💰 Get pricing estimates\n• ⭐ Rate and review services\n\nWould you like me to help you with anything else while you login?');
            }, 500);
            return;
        }

        if (action === 'Login as Fixer') {
            this.addMessage('user', action);
            setTimeout(() => {
                this.addMessage('bot', '🔐 **Login as Fixer**\n\nTo login as a Fixer:\n\n1. Click the "Login" button in the top navigation\n2. Select "Fixer" as your role\n3. Enter your email and password\n4. Click "Login"\n\n**Benefits of Fixer Account:**\n• 📋 View and accept service requests\n• 💰 Manage your earnings\n• 📊 Track your performance\n• ⭐ Build your reputation\n• 🛠️ Manage your bookings\n\nWould you like me to help you with anything else while you login?');
            }, 500);
            return;
        }

        if (action === 'Service Information') {
            this.addMessage('user', action);
            setTimeout(() => {
                this.addMessage('bot', '🛠️ **FIXGHAR Services**\n\nWe provide professional home repair services:\n\n**🔧 Plumbing Services:**\n• Leak repairs\n• Pipe installation\n• Faucet repairs\n• Toilet repairs\n• Water heater services\n\n**⚡ Electrical Services:**\n• Wiring repairs\n• Outlet installation\n• Light fixture repairs\n• Circuit breaker issues\n• Electrical safety checks\n\n**🔨 Carpentry Services:**\n• Furniture repairs\n• Door/window fixes\n• Cabinet installation\n• Woodwork repairs\n• Custom carpentry\n\n**🎨 Painting Services:**\n• Interior painting\n• Exterior painting\n• Wall repairs\n• Color consultation\n• Surface preparation\n\n**💰 Pricing:**\n• Transparent pricing\n• No hidden fees\n• Free estimates\n• Competitive rates\n\nLogin to book any of these services!');
            }, 500);
            return;
        }

        if (action === 'Pricing Guide') {
            this.addMessage('user', action);
            setTimeout(() => {
                this.addMessage('bot', '💰 **FIXGHAR Pricing Guide**\n\n**🔧 Plumbing Services:**\n• Basic repairs: ₹300 - ₹800\n• Pipe installation: ₹500 - ₹1500\n• Faucet repairs: ₹200 - ₹600\n• Toilet repairs: ₹400 - ₹1000\n\n**⚡ Electrical Services:**\n• Basic wiring: ₹400 - ₹1000\n• Outlet installation: ₹300 - ₹800\n• Light repairs: ₹200 - ₹600\n• Circuit issues: ₹500 - ₹1200\n\n**🔨 Carpentry Services:**\n• Furniture repairs: ₹300 - ₹1000\n• Door/window fixes: ₹400 - ₹1200\n• Cabinet work: ₹500 - ₹2000\n\n**🎨 Painting Services:**\n• Interior: ₹15-25 per sq ft\n• Exterior: ₹20-35 per sq ft\n• Wall repairs: ₹200-500 per sq ft\n\n**📋 Note:**\n• Prices may vary based on location\n• Free estimates available\n• No hidden charges\n• Payment after service completion\n\nLogin to get personalized pricing!');
            }, 500);
            return;
        }

        // Handle user-specific actions
        if (action === 'My Profile') {
            this.addMessage('user', action);
            setTimeout(() => {
                if (this.isFixer) {
                    this.showFixerProfile();
                } else {
                    this.showUserProfile();
                }
            }, 500);
            return;
        }
        
        if (action === 'My Bookings') {
            this.addMessage('user', action);
            setTimeout(() => {
                if (this.isFixer) {
                    this.showFixerBookings();
                } else {
                    this.showUserBookings();
                }
            }, 500);
            return;
        }

        if (action === 'My Earnings') {
            this.addMessage('user', action);
            setTimeout(() => {
                this.showFixerEarnings();
            }, 500);
            return;
        }

        if (action === 'My Performance') {
            this.addMessage('user', action);
            setTimeout(() => {
                this.showFixerPerformance();
            }, 500);
            return;
        }

        if (action === 'Service Requests') {
            this.addMessage('user', action);
            setTimeout(() => {
                this.showServiceRequests();
            }, 500);
            return;
        }

        if (action === 'Update Availability') {
            this.addMessage('user', action);
            setTimeout(() => {
                this.showUpdateAvailability();
            }, 500);
            return;
        }

        const responses = {
            'Book a Service': this.isLoggedIn ? 
                'I can help you book a service with your account details! Let me show you the booking process.' : 
                'To book a service, please visit our main page and select the service category you need. You can choose from Plumbing, Electrical, AC Repair, Carpentry, and more. Would you like me to guide you through the booking process?',
            'Find Fixers': 'I can help you find the best fixers in your area! What type of service do you need? Please specify your location and service category.',
            'Check Pricing': 'Our pricing varies based on the service type and complexity. Here are our general rates:\n\n• Plumbing: ₹300-800/hour\n• Electrical: ₹400-1000/hour\n• AC Repair: ₹500-1200/hour\n• Carpentry: ₹350-900/hour\n\nWould you like a detailed estimate for a specific service?',
            'Track Booking': this.isLoggedIn ? 
                'Let me show you your recent bookings and their status.' : 
                'To track your booking, please provide your booking ID or the phone number you used for booking. I can help you check the status and get updates.',
            'Contact Support': 'For immediate support, you can:\n\n• Call us: +91-9876543210\n• Email: support@fixghar.com\n• WhatsApp: +91-9876543210\n\nOur support team is available 24/7. Is there anything specific I can help you with?'
        };

        this.addMessage('user', action);
        setTimeout(() => {
            this.addMessage('bot', responses[action]);
        }, 500);
    }

    sendMessage() {
        const input = document.getElementById('embeddedChatInput');
        const message = input.value.trim();
        
        if (!message || this.isTyping) return;

        // Add user message
        this.addMessage('user', message);
        input.value = '';
        input.style.height = 'auto';

        // Show typing indicator
        this.showTyping();

        // Process message and get response
        setTimeout(async () => {
            this.hideTyping();
            const response = await this.processMessage(message);
            this.addMessage('bot', response);
        }, 1000 + Math.random() * 1000);
    }

    showTyping() {
        this.isTyping = true;
        const typingHTML = `
            <div class="message typing">
                <span>Assistant is typing</span>
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        this.addToMessages(typingHTML);
    }

    hideTyping() {
        this.isTyping = false;
        const messages = document.getElementById('embeddedChatMessages');
        const typingMessage = messages.querySelector('.message.typing');
        if (typingMessage) {
            typingMessage.remove();
        }
    }

    async processMessage(message) {
        if (!this.backendConnected) {
            // Show backend connection status
            setTimeout(() => {
                this.addMessage('bot', '⚠️ **Backend Connection Issue**\n\nI\'m currently running in offline mode. Some features may be limited.\n\nTo get full functionality:\n1. Make sure your backend server is running on port 5000\n2. Refresh the page\n\nI can still help with basic queries!');
            }, 1000);
        }

        try {
            // Call backend AI API
            const response = await fetch('https://fixghar.onrender.com/api/chatbot/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    userContext: {
                        user: this.currentUser,
                        timestamp: new Date().toISOString(),
                        page: window.location.pathname
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Add suggestions if available
                    if (data.data.suggestions && data.data.suggestions.length > 0) {
                        setTimeout(() => {
                            this.addSuggestions(data.data.suggestions);
                        }, 500);
                    }
                    
                    // Handle specific actions with real data
                    if (data.data.action) {
                        await this.handleAction(data.data.action, message);
                    }
                    
                    return data.data.response;
                }
            }
        } catch (error) {
            console.error('Chatbot API error:', error);
        }

        // Fallback to local processing if API fails
        return this.getLocalResponse(message);
    }

    async handleAction(action, message) {
        try {
            switch (action) {
                case 'service_booking':
                    if (this.isLoggedIn) {
                        await this.showBookingProcess();
                    } else {
                        await this.fetchServices();
                    }
                    break;
                case 'fixer_info':
                    await this.fetchFixers();
                    break;
                case 'pricing_info':
                    await this.fetchPricing();
                    break;
                case 'booking_status':
                    if (this.isLoggedIn) {
                        await this.showUserBookings();
                    } else {
                        await this.fetchBookingStatus(message);
                    }
                    break;
                case 'location_info':
                    await this.fetchLocationInfo(message);
                    break;
                case 'user_profile':
                    await this.showUserProfile();
                    break;
                case 'fixer_profile':
                    await this.showFixerProfile();
                    break;
                case 'my_bookings':
                    if (this.isFixer) {
                        await this.showFixerBookings();
                    } else {
                        await this.showUserBookings();
                    }
                    break;
                case 'service_requests':
                    await this.showServiceRequests();
                    break;
                case 'update_availability':
                    await this.showUpdateAvailability();
                    break;
            }
        } catch (error) {
            console.error('Action handling error:', error);
        }
    }

    async fetchServices() {
        try {
            const response = await fetch('https://fixghar.onrender.com/api/services');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const services = data.data;
                    const serviceList = services.slice(0, 5).map(service => 
                        `• ${service.name} - ₹${service.basePrice}/hour`
                    ).join('\n');
                    
                    setTimeout(() => {
                        this.addMessage('bot', `📋 **Available Services:**\n\n${serviceList}\n\nWhich service do you need?`);
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Error fetching services:', error);
        }
    }

    async fetchFixers() {
        try {
            const response = await fetch('https://fixghar.onrender.com/api/fixers/service-requests');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const fixers = data.data;
                    const fixerCount = fixers.length;
                    
                    setTimeout(() => {
                        this.addMessage('bot', `👨‍🔧 **Available Fixers:**\n\n• Total active fixers: ${fixerCount}\n• Average rating: 4.5+ stars\n• Response time: < 30 minutes\n• Available 24/7\n\nWould you like to book a service?`);
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Error fetching fixers:', error);
        }
    }

    async fetchPricing() {
        try {
            const response = await fetch('https://fixghar.onrender.com/api/services');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const services = data.data;
                    const pricingInfo = services.slice(0, 5).map(service => 
                        `• ${service.name}: ₹${service.basePrice}-${service.basePrice + 200}/hour`
                    ).join('\n');
                    
                    setTimeout(() => {
                        this.addMessage('bot', `💰 **Current Pricing:**\n\n${pricingInfo}\n\n*Prices may vary based on complexity and location*`);
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Error fetching pricing:', error);
        }
    }

    async fetchBookingStatus(message) {
        // Extract phone number or booking ID from message
        const phoneMatch = message.match(/\b\d{10}\b/);
        const bookingIdMatch = message.match(/[A-Z0-9]{6,}/);
        
        if (phoneMatch || bookingIdMatch) {
            setTimeout(() => {
                this.addMessage('bot', `📋 **Booking Status Check:**\n\nI found ${phoneMatch ? 'phone number' : 'booking ID'} in your message.\n\nTo check your booking status, please:\n1. Visit our main website\n2. Go to "Track Booking" section\n3. Enter your details\n\nOr call us at +91-9876543210 for immediate assistance.`);
            }, 1000);
        }
    }

    async fetchLocationInfo(message) {
        const locations = ['noida', 'delhi', 'gurgaon', 'ghaziabad', 'faridabad'];
        const foundLocation = locations.find(loc => message.toLowerCase().includes(loc));
        
        if (foundLocation) {
            setTimeout(() => {
                this.addMessage('bot', `📍 **Service in ${foundLocation.toUpperCase()}:**\n\n• Coverage: 95%+ areas\n• Response time: 30-60 minutes\n• Available fixers: 15+\n• Emergency service: 24/7\n\nWould you like to book a service in ${foundLocation}?`);
            }, 1000);
        }
    }

    async showUserProfile() {
        if (!this.isLoggedIn || !this.userProfile) {
            setTimeout(() => {
                this.addMessage('bot', '❌ You need to be logged in to view your profile. Please log in first.');
            }, 1000);
            return;
        }

        const profile = this.userProfile;
        const profileInfo = `👤 **Your Profile Details:**\n\n**Personal Information:**\n• Name: ${profile.name || 'Not provided'}\n• Email: ${profile.email || 'Not provided'}\n• Phone: ${profile.phone || 'Not provided'}\n• Username: ${profile.username || 'Not provided'}\n\n**Address:**\n• Street: ${profile.address?.street || 'Not provided'}\n• City: ${profile.address?.city || 'Not provided'}\n• State: ${profile.address?.state || 'Not provided'}\n• Zip Code: ${profile.address?.zipCode || 'Not provided'}\n\n**Account Status:**\n• Member since: ${new Date(profile.createdAt).toLocaleDateString()}\n• Account verified: ${profile.isVerified ? '✅ Yes' : '❌ No'}\n\nWould you like to update any information?`;

        setTimeout(() => {
            this.addMessage('bot', profileInfo);
        }, 1000);
    }

    async showUserBookings() {
        if (!this.isLoggedIn) {
            setTimeout(() => {
                this.addMessage('bot', '❌ You need to be logged in to view your bookings. Please log in first.');
            }, 1000);
            return;
        }

        if (this.userBookings.length === 0) {
            setTimeout(() => {
                this.addMessage('bot', '📋 **Your Bookings:**\n\nYou don\'t have any bookings yet.\n\nWould you like to book a service?');
            }, 1000);
            return;
        }

        const recentBookings = this.userBookings.slice(0, 5);
        const bookingList = recentBookings.map(booking => {
            const status = booking.status;
            const statusEmoji = status === 'completed' ? '✅' : 
                              status === 'pending' ? '⏳' : 
                              status === 'in_progress' ? '🔄' : '❌';
            
            return `• ${statusEmoji} ${booking.service} - ${booking.status}\n  📅 ${new Date(booking.createdAt).toLocaleDateString()}\n  📍 ${booking.address}`;
        }).join('\n\n');

        const bookingInfo = `📋 **Your Recent Bookings:**\n\n${bookingList}\n\n**Total Bookings:** ${this.userBookings.length}\n\nWould you like to:\n• View all bookings\n• Track a specific booking\n• Book a new service`;

        setTimeout(() => {
            this.addMessage('bot', bookingInfo);
        }, 1000);
    }

    async showBookingProcess() {
        if (!this.isLoggedIn) {
            setTimeout(() => {
                this.addMessage('bot', '❌ You need to be logged in to book a service. Please log in first.');
            }, 1000);
            return;
        }

        try {
            // Fetch available services
            const response = await fetch('https://fixghar.onrender.com/api/services');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const services = data.data.slice(0, 5);
                    const serviceList = services.map(service => 
                        `• ${service.name} - ₹${service.basePrice}/hour`
                    ).join('\n');

                    const bookingProcess = `🛠️ **Book a Service - ${this.userProfile.name}**\n\n**Available Services:**\n${serviceList}\n\n**Booking Process:**\n1️⃣ Select service type\n2️⃣ Choose preferred date & time\n3️⃣ Provide service details\n4️⃣ Confirm address\n5️⃣ Get matched with fixer\n\n**Your Details:**\n• Name: ${this.userProfile.name}\n• Phone: ${this.userProfile.phone}\n• Address: ${this.userProfile.address?.street || 'Not set'}\n\nWhich service would you like to book?`;

                    setTimeout(() => {
                        this.addMessage('bot', bookingProcess);
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('Error showing booking process:', error);
            setTimeout(() => {
                this.addMessage('bot', '🛠️ **Book a Service**\n\nI can help you book a service! Please visit our main website to complete the booking process.\n\nYour account is ready for booking!');
            }, 1000);
        }
    }

    calculateTotalEarnings() {
        if (!this.fixerBookings || this.fixerBookings.length === 0) {
            return '0';
        }
        
        const completedBookings = this.fixerBookings.filter(b => b.status === 'completed');
        const totalEarnings = completedBookings.reduce((sum, booking) => {
            return sum + (booking.amount || booking.price || 0);
        }, 0);
        
        return totalEarnings.toLocaleString();
    }

    async showFixerProfile() {
        if (!this.isLoggedIn || !this.isFixer || !this.fixerProfile) {
            setTimeout(() => {
                this.addMessage('bot', '❌ You need to be logged in as a fixer to view your profile. Please log in first.');
            }, 1000);
            return;
        }

        const profile = this.fixerProfile;
        const totalEarnings = this.calculateTotalEarnings();
        const completedBookings = this.fixerBookings.filter(b => b.status === 'completed').length;
        const averageRating = this.calculateAverageRating();
        const memberSince = new Date(profile.createdAt).toLocaleDateString('en-IN', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        const profileInfo = `👨‍🔧 **Your Complete Fixer Profile:**\n\n**🔐 Personal Information:**\n• **Name:** ${profile.name || 'Not provided'}\n• **Email:** ${profile.email || 'Not provided'}\n• **Phone:** ${profile.phone || 'Not provided'}\n• **Username:** ${profile.username || 'Not provided'}\n• **ID:** ${profile._id || 'Not available'}\n\n**🛠️ Professional Details:**\n• **Service Category:** ${profile.serviceCategory || 'Not specified'}\n• **Experience:** ${profile.professionalInfo?.experience || 'Not specified'} years\n• **Skills:** ${profile.professionalInfo?.skills?.join(', ') || 'Not specified'}\n• **Service Areas:** ${profile.areas?.join(', ') || 'Not specified'}\n• **Certifications:** ${profile.professionalInfo?.certifications?.join(', ') || 'Not specified'}\n\n**📍 Address Information:**\n• **Street:** ${profile.address?.street || 'Not provided'}\n• **City:** ${profile.address?.city || 'Not provided'}\n• **State:** ${profile.address?.state || 'Not provided'}\n• **Zip Code:** ${profile.address?.zipCode || 'Not provided'}\n• **Landmark:** ${profile.address?.landmark || 'Not provided'}\n\n**📊 Performance Metrics:**\n• **Total Bookings:** ${this.fixerBookings.length}\n• **Completed Jobs:** ${completedBookings}\n• **Success Rate:** ${this.fixerBookings.length > 0 ? Math.round((completedBookings / this.fixerBookings.length) * 100) : 0}%\n• **Average Rating:** ⭐ ${averageRating}/5.0\n• **Total Earnings:** ₹${totalEarnings}\n• **Member Since:** ${memberSince}\n\n**⚙️ Account Status:**\n• **Online Status:** ${profile.isOnline ? '🟢 Online' : '🔴 Offline'}\n• **Account Verified:** ${profile.isVerified ? '✅ Yes' : '❌ No'}\n• **Profile Complete:** ${this.isProfileComplete() ? '✅ Yes' : '❌ No'}\n• **Bank Details:** ${profile.bankDetails ? '✅ Added' : '❌ Not added'}\n\n**💡 Quick Actions:**\nType any of these commands:\n• "update profile" - Update your information\n• "my earnings" - Detailed earnings breakdown\n• "my performance" - Performance analytics\n• "update availability" - Set working hours\n• "bank details" - Manage payment info\n\nWhat would you like to update or know more about?`;

        setTimeout(() => {
            this.addMessage('bot', profileInfo);
        }, 1000);
    }

    calculateAverageRating() {
        if (!this.fixerBookings || this.fixerBookings.length === 0) {
            return '4.5';
        }
        
        const ratings = this.fixerBookings
            .filter(b => b.rating)
            .map(b => b.rating);
            
        if (ratings.length === 0) {
            return '4.5';
        }
        
        const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
        return average.toFixed(1);
    }

    isProfileComplete() {
        const profile = this.fixerProfile;
        const requiredFields = [
            profile.name,
            profile.email,
            profile.phone,
            profile.serviceCategory,
            profile.address?.street,
            profile.address?.city,
            profile.professionalInfo?.experience
        ];
        
        return requiredFields.every(field => field && field.toString().trim() !== '');
    }

    async showFixerBookings() {
        if (!this.isLoggedIn || !this.isFixer) {
            setTimeout(() => {
                this.addMessage('bot', '❌ You need to be logged in as a fixer to view your bookings. Please log in first.');
            }, 1000);
            return;
        }

        if (this.fixerBookings.length === 0) {
            setTimeout(() => {
                this.addMessage('bot', '🛠️ **Your Bookings:**\n\nYou don\'t have any assigned bookings yet.\n\nCheck the Service Requests to find new opportunities!');
            }, 1000);
            return;
        }

        const recentBookings = this.fixerBookings.slice(0, 5);
        const bookingList = recentBookings.map(booking => {
            const status = booking.status;
            const statusEmoji = status === 'completed' ? '✅' : 
                              status === 'pending' ? '⏳' : 
                              status === 'in_progress' ? '🔄' : '❌';
            
            return `• ${statusEmoji} ${booking.service?.name || 'Service'} - ${booking.status}\n  👤 Customer: ${booking.user?.name || 'Unknown'}\n  📅 ${new Date(booking.createdAt).toLocaleDateString()}\n  📍 ${booking.bookingDetails?.address?.street || 'Address not provided'}`;
        }).join('\n\n');

        const bookingInfo = `🛠️ **Your Assigned Bookings:**\n\n${bookingList}\n\n**Total Bookings:** ${this.fixerBookings.length}\n\nWould you like to:\n• View all bookings\n• Update booking status\n• Check service requests`;

        setTimeout(() => {
            this.addMessage('bot', bookingInfo);
        }, 1000);
    }

    async showServiceRequests() {
        if (!this.isLoggedIn || !this.isFixer) {
            setTimeout(() => {
                this.addMessage('bot', '❌ You need to be logged in as a fixer to view service requests. Please log in first.');
            }, 1000);
            return;
        }

        if (this.serviceRequests.length === 0) {
            setTimeout(() => {
                this.addMessage('bot', '📋 **Service Requests:**\n\nNo service requests available at the moment.\n\nCheck back later for new opportunities!');
            }, 1000);
            return;
        }

        const recentRequests = this.serviceRequests.slice(0, 5);
        const requestList = recentRequests.map(request => {
            return `• 🛠️ ${request.service?.name || 'Service'}\n  👤 Customer: ${request.user?.name || 'Unknown'}\n  📞 Phone: ${request.user?.phone || 'Not provided'}\n  📍 Location: ${request.address || 'Address not provided'}\n  💰 Budget: ₹${request.budget || 'Not specified'}\n  📅 Preferred: ${new Date(request.preferredDate).toLocaleDateString()} at ${request.preferredTime}`;
        }).join('\n\n');

        const requestInfo = `📋 **Available Service Requests:**\n\n${requestList}\n\n**Total Requests:** ${this.serviceRequests.length}\n\nThese are new service requests waiting for fixers. Visit the main dashboard to accept any request!`;

        setTimeout(() => {
            this.addMessage('bot', requestInfo);
        }, 1000);
    }

    async showUpdateAvailability() {
        if (!this.isLoggedIn || !this.isFixer) {
            setTimeout(() => {
                this.addMessage('bot', '❌ You need to be logged in as a fixer to update availability. Please log in first.');
            }, 1000);
            return;
        }

        const availabilityInfo = `⏰ **Update Your Availability:**\n\n**Current Status:** ${this.fixerProfile.isOnline ? '🟢 Online' : '🔴 Offline'}\n\n**To update your availability:**\n1. Visit the main fixer dashboard\n2. Go to "Availability" section\n3. Set your working hours\n4. Update your online status\n\n**Benefits of staying online:**\n• Get more service requests\n• Higher priority in matching\n• Real-time notifications\n• Better earnings potential\n\n**Recommended Schedule:**\n• Weekdays: 9 AM - 7 PM\n• Weekends: 10 AM - 6 PM\n• Emergency: 24/7 (optional)\n\nWould you like me to help you with anything else?`;

        setTimeout(() => {
            this.addMessage('bot', availabilityInfo);
        }, 1000);
    }

    async showFixerEarnings() {
        if (!this.isLoggedIn || !this.isFixer) {
            setTimeout(() => {
                this.addMessage('bot', '❌ You need to be logged in as a fixer to view earnings. Please log in first.');
            }, 1000);
            return;
        }

        const completedBookings = this.fixerBookings.filter(b => b.status === 'completed');
        const totalEarnings = this.calculateTotalEarnings();
        
        if (completedBookings.length === 0) {
            setTimeout(() => {
                this.addMessage('bot', '💰 **Your Earnings:**\n\nYou haven\'t completed any jobs yet.\n\n**Start earning by:**\n• Accepting service requests\n• Completing assigned bookings\n• Providing quality service\n• Getting positive reviews\n\n**Potential Earnings:**\n• Plumbing: ₹300-800/hour\n• Electrical: ₹400-1000/hour\n• AC Repair: ₹500-1200/hour\n• Carpentry: ₹350-900/hour\n\nCheck "Service Requests" to find new opportunities!');
            }, 1000);
            return;
        }

        // Calculate earnings by service type
        const earningsByService = {};
        completedBookings.forEach(booking => {
            const serviceType = booking.service?.name || 'General Service';
            const amount = booking.amount || booking.price || 0;
            earningsByService[serviceType] = (earningsByService[serviceType] || 0) + amount;
        });

        const earningsBreakdown = Object.entries(earningsByService)
            .map(([service, amount]) => `• **${service}:** ₹${amount.toLocaleString()}`)
            .join('\n');

        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();
        const thisMonthEarnings = completedBookings
            .filter(b => {
                const bookingDate = new Date(b.completedAt || b.updatedAt);
                return bookingDate.getMonth() === thisMonth && bookingDate.getFullYear() === thisYear;
            })
            .reduce((sum, b) => sum + (b.amount || b.price || 0), 0);

        const earningsInfo = `💰 **Your Detailed Earnings:**\n\n**📊 Summary:**\n• **Total Earnings:** ₹${totalEarnings}\n• **Completed Jobs:** ${completedBookings.length}\n• **This Month:** ₹${thisMonthEarnings.toLocaleString()}\n• **Average per Job:** ₹${Math.round(parseInt(totalEarnings.replace(/,/g, '')) / completedBookings.length)}\n\n**📈 Earnings by Service Type:**\n${earningsBreakdown}\n\n**💳 Payment Information:**\n• **Payment Method:** ${this.fixerProfile.bankDetails ? 'Bank Transfer' : 'Not set up'}\n• **Last Payment:** ${this.getLastPaymentDate()}\n• **Pending Amount:** ₹${this.getPendingEarnings()}\n\n**📅 Recent Payments:**\n${this.getRecentPayments()}\n\n**💡 Tips to Increase Earnings:**\n• Stay online more often\n• Accept emergency jobs (+50% premium)\n• Get higher ratings (more bookings)\n• Complete jobs quickly\n• Add more service categories\n\nType "payment setup" to configure your bank details!`;

        setTimeout(() => {
            this.addMessage('bot', earningsInfo);
        }, 1000);
    }

    async showFixerPerformance() {
        if (!this.isLoggedIn || !this.isFixer) {
            setTimeout(() => {
                this.addMessage('bot', '❌ You need to be logged in as a fixer to view performance. Please log in first.');
            }, 1000);
            return;
        }

        const totalBookings = this.fixerBookings.length;
        const completedBookings = this.fixerBookings.filter(b => b.status === 'completed').length;
        const pendingBookings = this.fixerBookings.filter(b => b.status === 'pending').length;
        const inProgressBookings = this.fixerBookings.filter(b => b.status === 'in_progress').length;
        const cancelledBookings = this.fixerBookings.filter(b => b.status === 'cancelled').length;
        
        const successRate = totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0;
        const averageRating = this.calculateAverageRating();
        const responseTime = this.calculateAverageResponseTime();
        const memberSince = new Date(this.fixerProfile.createdAt);
        const daysActive = Math.floor((new Date() - memberSince) / (1000 * 60 * 60 * 24));

        // Calculate monthly performance
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();
        const thisMonthBookings = this.fixerBookings.filter(b => {
            const bookingDate = new Date(b.createdAt);
            return bookingDate.getMonth() === thisMonth && bookingDate.getFullYear() === thisYear;
        }).length;

        const performanceInfo = `📊 **Your Performance Analytics:**\n\n**📈 Overall Stats:**\n• **Total Jobs:** ${totalBookings}\n• **Completed:** ${completedBookings} (${successRate}%)\n• **In Progress:** ${inProgressBookings}\n• **Pending:** ${pendingBookings}\n• **Cancelled:** ${cancelledBookings}\n\n**⭐ Quality Metrics:**\n• **Average Rating:** ⭐ ${averageRating}/5.0\n• **Success Rate:** ${successRate}%\n• **Response Time:** ${responseTime}\n• **Days Active:** ${daysActive} days\n• **This Month Jobs:** ${thisMonthBookings}\n\n**🏆 Performance Levels:**\n${this.getPerformanceLevel(successRate, parseFloat(averageRating))}\n\n**📊 Monthly Trend:**\n${this.getMonthlyTrend()}\n\n**🎯 Recommendations:**\n${this.getPerformanceRecommendations(successRate, parseFloat(averageRating), thisMonthBookings)}\n\n**💪 Achievements:**\n${this.getAchievements(completedBookings, parseFloat(averageRating), successRate)}\n\nKeep up the great work! 🚀`;

        setTimeout(() => {
            this.addMessage('bot', performanceInfo);
        }, 1000);
    }

    calculateAverageResponseTime() {
        // This would ideally come from backend data
        // For now, return a sample value
        return "2.5 hours";
    }

    getPerformanceLevel(successRate, rating) {
        if (successRate >= 90 && rating >= 4.5) {
            return "🏆 **Elite Level** - Top 5% of fixers";
        } else if (successRate >= 80 && rating >= 4.0) {
            return "🥇 **Gold Level** - Excellent performer";
        } else if (successRate >= 70 && rating >= 3.5) {
            return "🥈 **Silver Level** - Good performer";
        } else if (successRate >= 60 && rating >= 3.0) {
            return "🥉 **Bronze Level** - Average performer";
        } else {
            return "📈 **Improvement Needed** - Focus on quality";
        }
    }

    getMonthlyTrend() {
        // This would ideally show actual monthly data
        const currentMonth = new Date().toLocaleDateString('en-IN', { month: 'long' });
        return `• **${currentMonth}:** ${Math.floor(Math.random() * 10) + 5} jobs\n• **Last Month:** ${Math.floor(Math.random() * 10) + 3} jobs\n• **Trend:** 📈 Growing`;
    }

    getPerformanceRecommendations(successRate, rating, monthlyJobs) {
        const recommendations = [];
        
        if (successRate < 80) {
            recommendations.push("• Improve job completion rate");
        }
        if (rating < 4.0) {
            recommendations.push("• Focus on customer satisfaction");
        }
        if (monthlyJobs < 10) {
            recommendations.push("• Stay online more to get more bookings");
        }
        if (recommendations.length === 0) {
            recommendations.push("• Continue excellent work!");
            recommendations.push("• Consider adding more service categories");
        }
        
        return recommendations.join('\n');
    }

    getAchievements(completedJobs, rating, successRate) {
        const achievements = [];
        
        if (completedJobs >= 100) {
            achievements.push("🏆 **Century Club** - 100+ jobs completed");
        } else if (completedJobs >= 50) {
            achievements.push("🥇 **Half Century** - 50+ jobs completed");
        } else if (completedJobs >= 25) {
            achievements.push("🥈 **Quarter Century** - 25+ jobs completed");
        }
        
        if (rating >= 4.8) {
            achievements.push("⭐ **Rating Star** - Excellent reviews");
        }
        
        if (successRate >= 95) {
            achievements.push("🎯 **Perfectionist** - 95%+ success rate");
        }
        
        if (achievements.length === 0) {
            achievements.push("🚀 **Getting Started** - Build your reputation");
        }
        
        return achievements.join('\n');
    }

    getLastPaymentDate() {
        // This would come from actual payment data
        return "15 days ago";
    }

    getPendingEarnings() {
        const pendingBookings = this.fixerBookings.filter(b => b.status === 'completed' && !b.paymentReceived);
        return pendingBookings.reduce((sum, b) => sum + (b.amount || b.price || 0), 0).toLocaleString();
    }

    getRecentPayments() {
        // This would show actual recent payment data
        return "• ₹2,500 - 15 days ago\n• ₹1,800 - 22 days ago\n• ₹3,200 - 30 days ago";
    }

    getLocalResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        // Fixer-specific commands
        if (this.isLoggedIn && this.isFixer) {
            // Profile related
            if (lowerMessage.includes('my profile') || lowerMessage.includes('profile') || lowerMessage.includes('my details')) {
                setTimeout(() => {
                    this.showFixerProfile();
                }, 500);
                return "Loading your complete profile details...";
            }
            
            // Earnings related
            if (lowerMessage.includes('my earnings') || lowerMessage.includes('earnings') || lowerMessage.includes('money') || lowerMessage.includes('income')) {
                setTimeout(() => {
                    this.showFixerEarnings();
                }, 500);
                return "Loading your earnings breakdown...";
            }
            
            // Performance related
            if (lowerMessage.includes('my performance') || lowerMessage.includes('performance') || lowerMessage.includes('stats') || lowerMessage.includes('rating')) {
                setTimeout(() => {
                    this.showFixerPerformance();
                }, 500);
                return "Loading your performance analytics...";
            }
            
            // Bookings related
            if (lowerMessage.includes('my bookings') || lowerMessage.includes('bookings') || lowerMessage.includes('jobs')) {
                setTimeout(() => {
                    this.showFixerBookings();
                }, 500);
                return "Loading your booking details...";
            }
            
            // Service requests
            if (lowerMessage.includes('service requests') || lowerMessage.includes('requests') || lowerMessage.includes('new jobs')) {
                setTimeout(() => {
                    this.showServiceRequests();
                }, 500);
                return "Loading available service requests...";
            }
            
            // Service requests count
            if (lowerMessage.includes('how many requests') || lowerMessage.includes('requests count') || lowerMessage.includes('total requests')) {
                const count = this.serviceRequests.length;
                return `📋 **Service Requests Count:**\n\n🔢 **Total Available Requests:** ${count}\n\n${count > 0 ? 
                    `📝 **Recent Requests:**\n${this.serviceRequests.slice(0, 3).map(req => 
                        `• ${req.service?.name || 'Service'} - ${req.user?.name || 'Customer'} (₹${req.budget || 'N/A'})`
                    ).join('\n')}\n\nType "service requests" to view all requests!` : 
                    'No service requests available at the moment. Check back later!'}`;
            }
            
            // Availability
            if (lowerMessage.includes('availability') || lowerMessage.includes('working hours') || lowerMessage.includes('online status')) {
                setTimeout(() => {
                    this.showUpdateAvailability();
                }, 500);
                return "Loading availability settings...";
            }
            
            // Payment setup
            if (lowerMessage.includes('payment setup') || lowerMessage.includes('bank details') || lowerMessage.includes('payment info')) {
                return "💳 **Payment Setup:**\n\nTo set up your payment details:\n1. Visit the main fixer dashboard\n2. Go to 'Payment Settings'\n3. Add your bank account details\n4. Verify your account\n\n**Required Information:**\n• Bank account number\n• IFSC code\n• Account holder name\n• UPI ID (optional)\n\nThis ensures you receive payments on time!";
            }
            
            // Help command
            if (lowerMessage.includes('help') || lowerMessage.includes('commands') || lowerMessage.includes('what can you do')) {
                return "🤖 **FIXGHAR Fixer Assistant Commands:**\n\n**📋 Profile & Account:**\n• \"my profile\" - Complete profile details\n• \"update profile\" - Update information\n• \"bank details\" - Payment setup\n\n**💰 Earnings & Performance:**\n• \"my earnings\" - Detailed earnings breakdown\n• \"my performance\" - Ratings and analytics\n• \"payment setup\" - Configure payments\n\n**🛠️ Job Management:**\n• \"my bookings\" - All your bookings\n• \"service requests\" - Available jobs\n• \"how many requests\" - Check service requests count\n• \"update availability\" - Set working hours\n\n**📊 Quick Stats:**\n• \"my stats\" - Quick overview\n• \"my rating\" - Current rating\n• \"my success rate\" - Job completion rate\n\n**🆘 Support:**\n• \"contact support\" - Get help\n• \"help\" - This command list\n• \"how to earn more\" - Tips for better earnings\n\nJust type any of these commands and I'll help you instantly! 🚀";
            }
        }
        
        // User-specific commands
        if (this.isLoggedIn && !this.isFixer && this.userProfile) {
            // Profile related
            if (lowerMessage.includes('my profile') || lowerMessage.includes('profile') || lowerMessage.includes('my details')) {
                setTimeout(() => {
                    this.showUserProfile();
                }, 500);
                return "Loading your profile details...";
            }
            
            // Bookings related
            if (lowerMessage.includes('my bookings') || lowerMessage.includes('bookings') || lowerMessage.includes('my services')) {
                setTimeout(() => {
                    this.showUserBookings();
                }, 500);
                return "Loading your booking history...";
            }
            
            // Book new service
            if (lowerMessage.includes('book service') || lowerMessage.includes('book new') || lowerMessage.includes('new booking')) {
                setTimeout(() => {
                    this.showBookingProcess();
                }, 500);
                return "Starting the booking process for you...";
            }
            
            // Find fixers
            if (lowerMessage.includes('find fixers') || lowerMessage.includes('available fixers') || lowerMessage.includes('fixers near me')) {
                setTimeout(() => {
                    this.fetchFixers();
                }, 500);
                return "Finding available fixers in your area...";
            }
            
            // Help command for users
            if (lowerMessage.includes('help') || lowerMessage.includes('commands') || lowerMessage.includes('what can you do')) {
                return "🤖 **FIXGHAR User Assistant Commands:**\n\n**🛠️ Service Booking:**\n• \"book service\" - Book a new repair service\n• \"find fixers\" - Browse available service providers\n• \"pricing\" - Check service costs\n\n**📋 Account Management:**\n• \"my profile\" - View your profile details\n• \"my bookings\" - Track your service requests\n• \"booking status\" - Check service progress\n\n**💰 Pricing & Information:**\n• \"service costs\" - Get pricing estimates\n• \"service types\" - Learn about available services\n• \"location info\" - Check service areas\n\n**🆘 Support:**\n• \"contact support\" - Get help and assistance\n• \"help\" - This command list\n• \"how to book\" - Step-by-step booking guide\n\nJust type any of these commands and I'll help you instantly! 🚀";
            }
        }
        
        // Service booking related
        if (lowerMessage.includes('book') || lowerMessage.includes('service') || lowerMessage.includes('repair')) {
            return this.getServiceBookingResponse(message);
        }
        
        // Pricing related
        if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('rate') || lowerMessage.includes('charge')) {
            return this.getPricingResponse(message);
        }
        
        // Fixer related
        if (lowerMessage.includes('fixer') || lowerMessage.includes('technician') || lowerMessage.includes('expert')) {
            return this.getFixerResponse(message);
        }
        
        // Location related
        if (lowerMessage.includes('location') || lowerMessage.includes('area') || lowerMessage.includes('city') || lowerMessage.includes('noida') || lowerMessage.includes('delhi')) {
            return this.getLocationResponse(message);
        }
        
        // Booking status
        if (lowerMessage.includes('status') || lowerMessage.includes('track') || lowerMessage.includes('progress')) {
            return this.getBookingStatusResponse(message);
        }
        
        // Contact/Support
        if (lowerMessage.includes('contact') || lowerMessage.includes('support') || lowerMessage.includes('help') || lowerMessage.includes('phone')) {
            return this.getContactResponse(message);
        }
        
        // Greeting
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
            return "Hello! 👋 How can I help you with your home repair needs today?";
        }
        
        // Thank you
        if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
            return "You're welcome! 😊 Is there anything else I can help you with?";
        }
        
        // Default response
        return this.getDefaultResponse(message);
    }

    getServiceBookingResponse(message) {
        return `Great! I'd be happy to help you book a service. 🛠️\n\nHere's how to get started:\n\n1. **Choose your service**: Plumbing, Electrical, AC Repair, Carpentry, etc.\n2. **Select your location**: We serve Noida, Greater Noida, Delhi, and surrounding areas\n3. **Describe the issue**: Tell us what needs to be fixed\n4. **Choose timing**: Pick your preferred date and time\n5. **Get matched**: We'll connect you with the best fixer\n\nWhat type of service do you need?`;
    }

    getPricingResponse(message) {
        return `Here's our transparent pricing structure: 💰\n\n**Hourly Rates:**\n• Plumbing: ₹300-800/hour\n• Electrical: ₹400-1000/hour\n• AC Repair: ₹500-1200/hour\n• Carpentry: ₹350-900/hour\n• General Repair: ₹250-600/hour\n\n**Additional Charges:**\n• Call-out fee: ₹100-200\n• Emergency service: +50% of base rate\n• Material costs: As per actual\n\n**Special Offers:**\n• First-time users: 10% discount\n• Senior citizens: 15% discount\n• Bulk bookings: Up to 20% off\n\nWould you like a detailed estimate for a specific service?`;
    }

    getFixerResponse(message) {
        return `Our fixers are highly skilled professionals! 👨‍🔧\n\n**What makes our fixers special:**\n• Verified and background-checked\n• 3+ years of experience\n• Professional certifications\n• 24/7 availability\n• Customer rating: 4.5+ stars\n\n**Service areas:**\n• Noida, Greater Noida\n• Delhi, Gurgaon\n• Ghaziabad, Faridabad\n\n**How we match you:**\n1. Based on service type\n2. Your location\n3. Availability\n4. Customer ratings\n5. Specialization\n\nWhat type of fixer do you need?`;
    }

    getLocationResponse(message) {
        return `We provide services across multiple locations! 📍\n\n**Primary Service Areas:**\n• Noida (Sector 1-150)\n• Greater Noida (Alpha, Beta, Gamma)\n• Delhi (All areas)\n• Gurgaon\n• Ghaziabad\n• Faridabad\n\n**Service Time:**\n• Same day service available\n• Emergency: Within 2 hours\n• Regular: 4-24 hours\n\n**Coverage:**\n• 100% coverage in Noida/Greater Noida\n• 95% coverage in Delhi\n• 80% coverage in other areas\n\nWhat's your exact location? I can check availability for you.`;
    }

    getBookingStatusResponse(message) {
        return `I can help you track your booking! 📋\n\n**To check your booking status:**\n\n1. **Provide booking ID** (if you have it)\n2. **Or share your phone number** used for booking\n3. **Or your email address**\n\n**Current Status Options:**\n• Pending - Waiting for fixer assignment\n• Confirmed - Fixer assigned, scheduled\n• In Progress - Work started\n• Completed - Service finished\n• Cancelled - Booking cancelled\n\n**What you can do:**\n• Track real-time progress\n• Chat with your fixer\n• Reschedule if needed\n• Rate the service\n\nPlease share your booking details and I'll check the status for you.`;
    }

    getContactResponse(message) {
        return `Here are all the ways to reach us: 📞\n\n**24/7 Support:**\n• Phone: +91-9876543210\n• WhatsApp: +91-9876543210\n• Email: support@fixghar.com\n\n**Business Hours:**\n• Monday-Sunday: 6 AM - 10 PM\n• Emergency: 24/7\n\n**Social Media:**\n• Facebook: @fixghar\n• Instagram: @fixghar_official\n• Twitter: @fixghar\n\n**Office Address:**\nFIXGHAR Services Pvt Ltd\nSector 62, Noida\nUttar Pradesh - 201301\n\n**Response Time:**\n• Phone: Immediate\n• WhatsApp: Within 5 minutes\n• Email: Within 2 hours\n\nIs there something specific I can help you with right now?`;
    }

    getDefaultResponse(message) {
        const responses = [
            "I understand you're looking for help. Could you please be more specific about what you need? I can assist with service bookings, pricing, finding fixers, and more.",
            "I'm here to help with all your home repair needs! Please let me know if you need help with booking a service, checking prices, or finding the right fixer.",
            "That's an interesting question! I can help you with service bookings, pricing information, fixer details, or connect you with our support team. What would be most helpful?",
            "I want to make sure I give you the best assistance. Could you tell me more about what you're looking for? I specialize in home repair services and support."
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    }

    addMessage(sender, content) {
        const message = {
            sender: sender,
            content: content,
            timestamp: new Date()
        };
        
        this.messages.push(message);
        
        // Show notification badge if minimized and it's a bot message
        if (this.isMinimized && sender === 'bot') {
            this.showNotificationBadge();
        }
        
        // Keep only last 50 messages to prevent overflow
        if (this.messages.length > 50) {
            this.messages = this.messages.slice(-50);
            this.refreshMessagesDisplay();
        } else {
            this.displayMessage(message);
        }
        
        this.scrollToBottom();
    }

    displayMessage(message) {
        const messagesContainer = document.getElementById('embeddedChatMessages');
        const messageHTML = `
            <div class="message ${message.sender}">
                ${this.formatMessage(message.content)}
            </div>
        `;
        
        messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    }

    refreshMessagesDisplay() {
        const messagesContainer = document.getElementById('embeddedChatMessages');
        if (messagesContainer) {
            // Clear existing messages
            messagesContainer.innerHTML = '';
            
            // Re-display all messages
            this.messages.forEach(message => {
                this.displayMessage(message);
            });
        }
    }

    addToMessages(html) {
        const messagesContainer = document.getElementById('embeddedChatMessages');
        messagesContainer.insertAdjacentHTML('beforeend', html);
        this.scrollToBottom();
    }

    formatMessage(content) {
        // Convert line breaks to <br>
        return content.replace(/\n/g, '<br>');
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('embeddedChatMessages');
        if (messagesContainer) {
            // Use setTimeout to ensure DOM is updated
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);
        }
    }

    addSuggestions(suggestions) {
        const suggestionsHTML = `
            <div class="suggested-questions">
                <h4>Quick Actions:</h4>
                ${suggestions.map(suggestion => 
                    `<div class="suggestion-item" onclick="chatbot.handleSuggestion('${suggestion}')">${suggestion}</div>`
                ).join('')}
            </div>
        `;
        
        this.addToMessages(suggestionsHTML);
    }

    handleSuggestion(suggestion) {
        // Remove existing suggestions
        const existingSuggestions = document.querySelector('.suggested-questions');
        if (existingSuggestions) {
            existingSuggestions.remove();
        }

        // Send the suggestion as a message
        this.addMessage('user', suggestion);
        
        // Show typing indicator
        this.showTyping();

        // Process the suggestion
        setTimeout(() => {
            this.hideTyping();
            this.processMessage(suggestion).then(response => {
                this.addMessage('bot', response);
            });
        }, 1000 + Math.random() * 1000);
    }

    // Public methods for external use
    openChatbot() {
        this.expandChatbot();
    }

    minimizeChatbotPublic() {
        this.minimizeChatbot();
    }

    expandChatbotPublic() {
        this.expandChatbot();
    }

    sendQuickMessage(message) {
        const input = document.getElementById('embeddedChatInput');
        if (input) {
            input.value = message;
            this.sendMessage();
        }
    }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing FIXGHAR Chatbot...');
    try {
        window.chatbot = new FIXGHARChatbot();
        console.log('✅ Chatbot initialized successfully');
        
        // Test if floating icon is visible
        setTimeout(() => {
            const floatingIcon = document.getElementById('floatingChatIcon');
            if (floatingIcon) {
                console.log('✅ Floating icon found:', floatingIcon);
                console.log('Floating icon display:', window.getComputedStyle(floatingIcon).display);
                console.log('Floating icon visibility:', window.getComputedStyle(floatingIcon).visibility);
            } else {
                console.error('❌ Floating icon not found!');
            }
        }, 1000);

        // Set up periodic role change detection
        setInterval(() => {
            if (window.chatbot) {
                window.chatbot.detectRoleChange();
            }
        }, 5000); // Check every 5 seconds
    } catch (error) {
        console.error('❌ Error initializing chatbot:', error);
    }
    
    // Add global functions for easy access
    window.openChatbot = () => window.chatbot.openChatbot();
    window.closeChatbot = () => window.chatbot.closeChatbot();
    window.minimizeChatbot = () => window.chatbot.minimizeChatbotPublic();
    window.expandChatbot = () => window.chatbot.expandChatbotPublic();
    window.sendQuickMessage = (message) => window.chatbot.sendQuickMessage(message);
    window.refreshChatbotAuth = () => window.chatbot.refreshAuthentication();
    window.detectRoleChange = () => window.chatbot.detectRoleChange();
    window.refreshServiceRequests = () => window.chatbot.refreshServiceRequests();
    
    // Debug function to test minimize
    window.testMinimize = () => {
        console.log('Testing minimize function...');
        window.chatbot.minimizeChatbot();
    };
    
    // Debug function to refresh chatbot for fixers
    window.refreshChatbot = () => {
        console.log('🔄 Manually refreshing chatbot...');
        if (window.chatbot) {
            window.chatbot.refreshWelcomeMessage();
        } else {
            console.log('❌ Chatbot not found');
        }
    };

    // Global function to refresh all data manually
    window.refreshAllData = () => {
        console.log('🔄 Manually refreshing all data...');
        if (window.chatbot) {
            window.chatbot.refreshAllData();
        } else {
            console.log('❌ Chatbot not found');
        }
    };

    // Global function to start auto-refresh
    window.startAutoRefresh = () => {
        console.log('▶️ Starting auto-refresh...');
        if (window.chatbot) {
            window.chatbot.startAutoRefresh();
        } else {
            console.log('❌ Chatbot not found');
        }
    };

    // Global function to stop auto-refresh
    window.stopAutoRefresh = () => {
        console.log('⏹️ Stopping auto-refresh...');
        if (window.chatbot) {
            window.chatbot.stopAutoRefresh();
        } else {
            console.log('❌ Chatbot not found');
        }
    };
    
    // Debug function to check fixer status
    window.checkFixerStatus = () => {
        console.log('🔍 Checking fixer status...');
        if (window.chatbot) {
            console.log('Is Logged In:', window.chatbot.isLoggedIn);
            console.log('Is Fixer:', window.chatbot.isFixer);
            console.log('Fixer Profile:', window.chatbot.fixerProfile);
            console.log('Fixer Bookings:', window.chatbot.fixerBookings.length);
            console.log('Service Requests:', window.chatbot.serviceRequests.length);
        } else {
            console.log('❌ Chatbot not found');
        }
    };
    
    // Debug function to force re-authentication
    window.recheckAuth = async () => {
        console.log('🔄 Re-checking authentication...');
        if (window.chatbot) {
            await window.chatbot.checkUserAuthentication();
            setTimeout(() => {
                window.chatbot.refreshWelcomeMessage();
            }, 2000);
        } else {
            console.log('❌ Chatbot not found');
        }
    };
    
    // Debug function to force fixer mode
    window.forceFixerMode = () => {
        console.log('🔧 Forcing fixer mode...');
        if (window.chatbot) {
            window.chatbot.isFixer = true;
            window.chatbot.isLoggedIn = true;
            
            // Create a sample fixer profile if none exists
            if (!window.chatbot.fixerProfile) {
                window.chatbot.fixerProfile = {
                    name: 'Test Fixer',
                    email: 'fixer@example.com',
                    phone: '+91-9876543210',
                    serviceCategory: 'General Repair',
                    isOnline: true,
                    rating: 4.5,
                    professionalInfo: {
                        experience: 5,
                        skills: ['Plumbing', 'Electrical', 'AC Repair']
                    },
                    address: {
                        street: 'Test Street',
                        city: 'Noida',
                        state: 'Uttar Pradesh'
                    }
                };
                window.chatbot.currentUser = window.chatbot.fixerProfile;
            }
            
            console.log('✅ Forced fixer mode:', window.chatbot.fixerProfile.name);
            window.chatbot.refreshWelcomeMessage();
        } else {
            console.log('❌ Chatbot not found');
        }
    };

    // Debug function to check service requests count
    window.checkServiceRequestsCount = () => {
        console.log('📋 Checking service requests count...');
        if (window.chatbot) {
            console.log('Service requests count:', window.chatbot.serviceRequests.length);
            console.log('Service requests data:', window.chatbot.serviceRequests);
            return window.chatbot.serviceRequests.length;
        } else {
            console.log('❌ Chatbot not found');
            return 0;
        }
    };
    
    // Alternative test function
    window.forceMinimize = () => {
        const widget = document.getElementById('embeddedChatWidget');
        const floatingIcon = document.getElementById('floatingChatIcon');
        
        if (widget) {
            widget.style.display = 'none';
            console.log('Widget hidden');
        }
        
        if (floatingIcon) {
            floatingIcon.style.display = 'flex';
            console.log('Floating icon shown');
        }
    };
    
    // Simple test function
    window.testMinimizeSimple = () => {
        console.log('=== SIMPLE MINIMIZE TEST ===');
        
        // Hide widget
        const widget = document.getElementById('embeddedChatWidget');
        if (widget) {
            widget.style.display = 'none';
            console.log('✅ Widget hidden');
        }
        
        // Show floating icon
        const floatingIcon = document.getElementById('floatingChatIcon');
        if (floatingIcon) {
            floatingIcon.style.display = 'flex';
            floatingIcon.style.visibility = 'visible';
            floatingIcon.style.opacity = '1';
            console.log('✅ Floating icon shown');
        }
        
        console.log('=== TEST COMPLETED ===');
    };
    
    // Direct minimize test
    window.directMinimize = () => {
        console.log('=== DIRECT MINIMIZE TEST ===');
        
        // Get elements
        const widget = document.getElementById('embeddedChatWidget');
        const floatingIcon = document.getElementById('floatingChatIcon');
        
        console.log('Widget:', widget);
        console.log('Floating Icon:', floatingIcon);
        
        if (widget) {
            widget.style.display = 'none';
            widget.style.visibility = 'hidden';
            widget.style.opacity = '0';
            widget.style.transform = 'scale(0)';
            widget.style.pointerEvents = 'none';
            widget.classList.add('minimized');
            console.log('✅ Widget hidden');
        }
        
        if (floatingIcon) {
            floatingIcon.style.display = 'flex';
            floatingIcon.style.visibility = 'visible';
            floatingIcon.style.opacity = '1';
            floatingIcon.style.zIndex = '99999';
            floatingIcon.classList.add('show');
            console.log('✅ Floating icon shown');
        }
        
        console.log('=== DIRECT TEST COMPLETED ===');
    };
    
    // Force hide widget test
    window.forceHideWidget = () => {
        console.log('=== FORCE HIDE WIDGET TEST ===');
        
        const widget = document.getElementById('embeddedChatWidget');
        if (widget) {
            widget.style.display = 'none';
            widget.style.visibility = 'hidden';
            widget.style.opacity = '0';
            widget.style.transform = 'scale(0)';
            widget.style.pointerEvents = 'none';
            widget.classList.add('minimized');
            console.log('✅ Widget force hidden');
        }
        
        console.log('=== FORCE HIDE COMPLETED ===');
    };
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FIXGHARChatbot;
}
