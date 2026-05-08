// FIXGHAR Fixer API Service
// Handles fixer-specific API operations

class FixerApiService {
    constructor() {
        this.config = window.FIXGHAR_CONFIG || {};
        this.baseURL = this.config.api?.baseURL || 'https://fixghar.onrender.com/api';
    }

    // Generic API call method for fixer endpoints
    async apiCall(endpoint, method = 'GET', data = null, options = {}) {
        try {
            const url = `${this.baseURL}/fixers${endpoint}`;
            const config = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            };

            // Add body for POST/PUT/PATCH requests
            if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                config.body = JSON.stringify(data);
            }

            // Add authorization header if token exists
            const token = localStorage.getItem('fixghar_token') || window.cookieManager?.getAuthToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }

            console.log(`🔧 Fixer API Call: ${method} ${url}`);
            const response = await fetch(url, config);
            
            // Parse response
            const result = await response.json();

            // Handle non-2xx responses
            if (!response.ok) {
                throw new Error(result.error || result.message || `HTTP ${response.status}`);
            }

            console.log(`✅ Fixer API Call Success: ${method} ${endpoint}`);
            return {
                success: true,
                data: result.data || result,
                message: result.message,
                status: response.status
            };

        } catch (error) {
            console.error(`❌ Fixer API Call Failed: ${method} ${endpoint}`, error);
            throw error;
        }
    }

    // Get fixer profile
    async getFixerProfile() {
        return this.apiCall('/profile');
    }

    // Update fixer profile
    async updateFixerProfile(profileData) {
        return this.apiCall('/profile', 'PUT', profileData);
    }

    // Get fixer services
    async getFixerServices() {
        return this.apiCall('/services');
    }

    // Add new service
    async addService(serviceData) {
        return this.apiCall('/services', 'POST', serviceData);
    }

    // Update service
    async updateService(serviceId, serviceData) {
        return this.apiCall(`/services/${serviceId}`, 'PUT', serviceData);
    }

    // Delete service
    async deleteService(serviceId) {
        return this.apiCall(`/services/${serviceId}`, 'DELETE');
    }

    // Get fixer bookings
    async getFixerBookings(status = null) {
        const endpoint = status ? `?status=${status}` : '';
        return this.apiCall(`/bookings${endpoint}`);
    }

    // Update booking status
    async updateBookingStatus(bookingId, status, notes = '') {
        const data = { status, notes };
        return this.apiCall(`/bookings/${bookingId}/status`, 'PUT', data);
    }

    // Accept booking
    async acceptBooking(bookingId) {
        return this.updateBookingStatus(bookingId, 'accepted');
    }

    // Reject booking
    async rejectBooking(bookingId, reason = '') {
        return this.updateBookingStatus(bookingId, 'rejected', reason);
    }

    // Start work on booking
    async startWork(bookingId) {
        return this.updateBookingStatus(bookingId, 'in_progress');
    }

    // Complete work on booking
    async completeWork(bookingId) {
        return this.updateBookingStatus(bookingId, 'completed');
    }

    // Get fixer availability
    async getFixerAvailability() {
        return this.apiCall('/availability');
    }

    // Update fixer availability
    async updateFixerAvailability(availabilityData) {
        return this.apiCall('/availability', 'PUT', availabilityData);
    }

    // Set working hours
    async setWorkingHours(workingHours) {
        return this.apiCall('/availability/hours', 'PUT', workingHours);
    }

    // Set unavailable dates
    async setUnavailableDates(dates) {
        return this.apiCall('/availability/unavailable', 'PUT', { dates });
    }

    // Get fixer reviews
    async getFixerReviews() {
        return this.apiCall('/reviews');
    }

    // Get fixer rating
    async getFixerRating() {
        return this.apiCall('/reviews/rating');
    }

    // Get fixer earnings
    async getFixerEarnings(period = 'month') {
        return this.apiCall(`/earnings?period=${period}`);
    }

    // Get fixer statistics
    async getFixerStats() {
        return this.apiCall('/stats');
    }

    // Send message to customer
    async sendMessage(bookingId, message) {
        const data = { message, timestamp: new Date().toISOString() };
        return this.apiCall(`/bookings/${bookingId}/messages`, 'POST', data);
    }

    // Get messages for a booking
    async getMessages(bookingId) {
        return this.apiCall(`/bookings/${bookingId}/messages`);
    }

    // Update fixer location
    async updateLocation(locationData) {
        return this.apiCall('/location', 'PUT', locationData);
    }

    // Get nearby bookings
    async getNearbyBookings(radius = 10) {
        return this.apiCall(`/bookings/nearby?radius=${radius}`);
    }

    // Set fixer online/offline status
    async setOnlineStatus(isOnline) {
        return this.apiCall('/status', 'PUT', { isOnline });
    }
}

// Create global instance
window.fixerApiService = new FixerApiService();

console.log('✅ Fixer API Service loaded successfully!');
