// FIXGHAR Core API Service
// Handles all frontend-backend communication

class FIXGHARApiService {
    constructor() {
        this.baseURL = window.FIXGHAR_CONFIG?.api?.baseURL || 'https://fixghar.onrender.com/api';
        this.timeout = window.FIXGHAR_CONFIG?.api?.timeout || 60000; // Increased to 60 seconds
        this.token = this.getStoredToken(); // Will be refreshed for each request

        this.setupInterceptors();
    }

    getStoredToken() {
        return localStorage.getItem('fixghar_token') || sessionStorage.getItem('fixghar_token');
    }

    // Setup request/response interceptors
    setupInterceptors() {
        // Add token to all requests if available
        this.addRequestInterceptor = (config) => {
            // Get fresh token from localStorage for each request
            const currentToken =
                localStorage.getItem('fixghar_token') || sessionStorage.getItem('fixghar_token');
            if (currentToken) {
                config.headers = config.headers || {};
                config.headers.Authorization = `Bearer ${currentToken}`;
            }
            return config;
        };

        // Handle response errors
        this.addResponseInterceptor = (response) => {
            if (response.status === 401) {
                this.handleUnauthorized();
            }
            return response;
        };
    }

    // Generic API call method
    async apiCall(endpoint, method = 'GET', data = null, options = {}) {
        try {
            const url = `${this.baseURL}${endpoint}`;
            
            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, this.timeout);
            
            const config = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                mode: 'cors',
                credentials: 'include',
                signal: controller.signal,
                ...options
            };

            // Add request interceptor
            const interceptedConfig = this.addRequestInterceptor(config);

            // Add body for POST/PUT/PATCH requests
            if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                interceptedConfig.body = JSON.stringify(data);
            }

            // Make the request
            const response = await fetch(url, interceptedConfig);
            
            // Clear timeout if request completes
            clearTimeout(timeoutId);
            
            // Add response interceptor
            this.addResponseInterceptor(response);

            const rawText = await response.text();
            let result = {};
            try {
                result = rawText ? JSON.parse(rawText) : {};
            } catch {
                result = { message: rawText || `HTTP ${response.status}` };
            }

            // Handle non-2xx responses (preserve server code/message for OTP/SMS flows)
            if (!response.ok) {
                const msg =
                    result.message ||
                    result.error ||
                    `Request failed (${response.status})`;
                const apiErr = new Error(msg);
                apiErr.status = response.status;
                apiErr.code = result.code;
                apiErr.field = result.field;
                apiErr.errors = result.errors;
                throw apiErr;
            }

            return {
                success: true,
                data: result.data || result,
                message: result.message,
                status: response.status
            };

        } catch (error) {
            // Re-throw API errors we constructed above (already have .code / .status)
            if (error && typeof error.message === 'string' && 'status' in error) {
                throw error;
            }

            // Handle network errors
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Network error: Unable to connect to server. Please check if backend is running on port 5000.');
            }

            // Handle timeout errors
            if (error.name === 'AbortError') {
                throw new Error('Request timeout: Server took too long to respond. Please check your internet connection and try again.');
            }

            // Handle connection refused errors
            if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED')) {
                throw new Error('Network error: Unable to connect to server. Please check if backend is running on port 5000.');
            }

            // Handle CORS errors
            if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
                throw new Error('Network error: Unable to connect to server. Please check if backend is running on port 5000.');
            }

            throw error;
        }
    }

    // Authentication Methods
    async registerUser(userData) {
        return this.apiCall('/auth/user/signup', 'POST', userData);
    }

    async registerFixer(fixerData) {
        return this.apiCall('/auth/fixer/signup', 'POST', fixerData);
    }

    // Health check method for connection testing
    async healthCheck() {
        try {
            console.log('🔍 Testing connection to:', `${this.baseURL}/health`);
            const response = await fetch(`${this.baseURL}/health`);
            const data = await response.json();
            console.log('✅ Health check response:', data);
            return response.ok && data.success;
        } catch (error) {
            console.error('❌ Health check failed:', error);
            return false;
        }
    }

    // Test connection before making API calls
    async testConnection() {
        console.log('🧪 Testing API Connection...');
        try {
            const isHealthy = await this.healthCheck();
            if (isHealthy) {
                console.log('✅ API Connection: HEALTHY');
                return true;
            } else {
                console.log('❌ API Connection: FAILED');
                throw new Error('Cannot connect to backend server. Please ensure backend is running on port 5000.');
            }
        } catch (error) {
            console.log('❌ API Connection: FAILED -', error.message);
            throw new Error('Cannot connect to backend server. Please ensure backend is running on port 5000.');
        }
    }

    async login(credentials, role = 'user') {
        return this.apiCall('/auth/login', 'POST', { ...credentials, role });
    }

    async loginUser(credentials) {
        return this.login(credentials, 'user');
    }

    async loginFixer(credentials) {
        return this.login(credentials, 'fixer');
    }

    async verifyOTP(otpData) {
        return this.apiCall('/auth/verify-otp', 'POST', otpData);
    }

    async resendOTP(otpData) {
        return this.apiCall('/auth/resend-otp', 'POST', otpData);
    }

    async getCurrentUser() {
        return this.apiCall('/auth/me', 'GET');
    }

    async logout() {
        try {
            await this.apiCall('/auth/logout', 'POST');
        } finally {
            this.clearAuth();
        }
    }

    // User Management Methods
    async getUserProfile() {
        return this.apiCall('/users/profile', 'GET');
    }

    async updateUserProfile(profileData) {
        return this.apiCall('/users/profile', 'PUT', profileData);
    }

    async getUserBookings() {
        return this.apiCall('/users/bookings', 'GET');
    }

    // Booking Management Methods (moved to main booking methods section)

    async getUserBookingHistory() {
        return this.apiCall('/user/bookings/history', 'GET');
    }

    // Fixer Management Methods
    async getFixerProfile() {
        return this.apiCall('/fixer/profile', 'GET');
    }

    async updateFixerProfile(profileData) {
        return this.apiCall('/fixer/profile', 'PUT', profileData);
    }

    async getFixerServices() {
        return this.apiCall('/fixer/services', 'GET');
    }

    async getFixerBookings() {
        return this.apiCall('/fixer/bookings', 'GET');
    }

    async updateFixerAvailability(availabilityData) {
        return this.apiCall('/fixer/availability', 'PUT', availabilityData);
    }

    async getFixerReviews() {
        return this.apiCall('/fixer/reviews', 'GET');
    }

    // Service Methods
    async getAllServices() {
        return this.apiCall('/services', 'GET');
    }

    async getServicesByCategory(category) {
        return this.apiCall(`/services/category/${category}`, 'GET');
    }

    async searchServices(query) {
        return this.apiCall(`/services/search?q=${encodeURIComponent(query)}`, 'GET');
    }

    async getPopularServices() {
        return this.apiCall('/services/popular', 'GET');
    }

    async getServiceById(serviceId) {
        return this.apiCall(`/services/${serviceId}`, 'GET');
    }

    // Booking Methods
    async createBooking(bookingData) {
        return this.apiCall('/bookings', 'POST', bookingData);
    }

    async getAllBookings() {
        return this.apiCall('/bookings', 'GET');
    }

    async getBookingById(bookingId) {
        return this.apiCall(`/bookings/${bookingId}`, 'GET');
    }

    async updateBooking(bookingId, updateData) {
        return this.apiCall(`/bookings/${bookingId}`, 'PUT', updateData);
    }

    async cancelBooking(bookingId, reason) {
        return this.apiCall(`/bookings/${bookingId}/cancel`, 'POST', { reason });
    }

    async addBookingReview(bookingId, reviewData) {
        return this.apiCall(`/bookings/${bookingId}/review`, 'POST', reviewData);
    }

    async sendBookingMessage(bookingId, messageData) {
        return this.apiCall(`/bookings/${bookingId}/messages`, 'POST', messageData);
    }

    async updateBookingProgress(bookingId, progressData) {
        return this.apiCall(`/bookings/${bookingId}/progress`, 'PUT', progressData);
    }

    // File Upload Methods
    async uploadFile(file, type = 'image') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        return this.apiCall('/upload', 'POST', formData, {
            headers: {
                // Don't set Content-Type for FormData
            }
        });
    }

    // Utility Methods
    setToken(token) {
        this.token = token;
        // Respect chosen persistence if set; otherwise default to localStorage
        const persist =
            localStorage.getItem('fixghar_persist') || sessionStorage.getItem('fixghar_persist') || 'local';
        const storage = persist === 'session' ? sessionStorage : localStorage;
        storage.setItem('fixghar_persist', persist);
        storage.setItem('fixghar_token', token);
    }

    getToken() {
        return this.token;
    }

    clearAuth() {
        this.token = null;
        // Clear both storages (and legacy keys)
        localStorage.removeItem('fixghar_token');
        localStorage.removeItem('fixghar_user_type');
        localStorage.removeItem('fixghar_user_data');
        localStorage.removeItem('fixghar_persist');
        localStorage.removeItem('fixghar_user');
        localStorage.removeItem('userType');

        sessionStorage.removeItem('fixghar_token');
        sessionStorage.removeItem('fixghar_user_type');
        sessionStorage.removeItem('fixghar_user_data');
        sessionStorage.removeItem('fixghar_persist');
        sessionStorage.removeItem('fixghar_user');
        sessionStorage.removeItem('userType');
    }

    isAuthenticated() {
        return !!(this.token || this.getStoredToken());
    }

    getUserType() {
        return localStorage.getItem('fixghar_user_type');
    }

    // Error Handling
    handleUnauthorized() {
        this.clearAuth();
        // Redirect to login or show login modal
        if (typeof showLoginModal === 'function') {
            showLoginModal();
        } else {
            window.location.reload();
        }
    }

    // Health Check
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseURL}/health`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    // Retry Logic for Failed Requests
    async retryRequest(fn, maxRetries = 3, delay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            }
        }
    }
}

// Create global instance
const apiService = new FIXGHARApiService();

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FIXGHARApiService;
    module.exports.default = FIXGHARApiService;
} else if (typeof window !== 'undefined') {
    window.FIXGHARApiService = FIXGHARApiService;
    window.apiService = apiService;
}
