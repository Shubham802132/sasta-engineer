// FIXGHAR Core State Management Service
// Handles application state, user authentication, and data persistence

class FIXGHARStateService {
    constructor() {
        this.state = {
            user: null,
            isAuthenticated: false,
            userType: null,
            token: null,
            ui: {
                currentModal: null,
                isLoading: false,
                notifications: [],
                theme: 'light'
            },
            data: {
                services: [],
                bookings: [],
                categories: []
            }
        };

        this.subscribers = new Map();
        this.init();
    }

    // Initialize state from localStorage
    init() {
        try {
            // Load authentication state
            const token = localStorage.getItem('fixghar_token');
            const userData = localStorage.getItem('fixghar_user_data');
            const userType = localStorage.getItem('fixghar_user_type');

            if (token && userData) {
                this.state.token = token;
                this.state.user = JSON.parse(userData);
                this.state.userType = userType;
                this.state.isAuthenticated = true;
            }

            // Load UI preferences
            const theme = localStorage.getItem('fixghar_theme');
            if (theme) {
                this.state.ui.theme = theme;
                this.applyTheme(theme);
            }

            // Load cached data
            this.loadCachedData();
        } catch (error) {
            console.error('Error initializing state:', error);
            this.clearState();
        }
    }

    // Get current state
    getState() {
        return { ...this.state };
    }

    // Get specific state slice
    getStateSlice(slice) {
        return this.state[slice] ? { ...this.state[slice] } : null;
    }

    // Update state
    updateState(updates) {
        const oldState = { ...this.state };
        
        // Deep merge updates
        this.state = this.deepMerge(this.state, updates);
        
        // Notify subscribers
        this.notifySubscribers(oldState, this.state);
        
        // Persist to localStorage if needed
        this.persistState(updates);
    }

    // Deep merge objects
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    // Authentication state management
    setAuthenticatedUser(userData, token, userType) {
        this.updateState({
            user: userData,
            token: token,
            userType: userType,
            isAuthenticated: true
        });

        // Store in localStorage
        localStorage.setItem('fixghar_token', token);
        localStorage.setItem('fixghar_user_data', JSON.stringify(userData));
        localStorage.setItem('fixghar_user_type', userType);
    }

    clearAuthenticatedUser() {
        this.updateState({
            user: null,
            token: null,
            userType: null,
            isAuthenticated: false
        });

        // Clear localStorage
        localStorage.removeItem('fixghar_token');
        localStorage.removeItem('fixghar_user_data');
        localStorage.removeItem('fixghar_user_type');
    }

    // User profile management
    updateUserProfile(profileData) {
        if (this.state.user) {
            const updatedUser = { ...this.state.user, ...profileData };
            this.updateState({ user: updatedUser });
            
            // Update localStorage
            localStorage.setItem('fixghar_user_data', JSON.stringify(updatedUser));
        }
    }

    // UI state management
    setCurrentModal(modalName) {
        this.updateState({
            ui: { ...this.state.ui, currentModal: modalName }
        });
    }

    setLoading(isLoading) {
        this.updateState({
            ui: { ...this.state.ui, isLoading }
        });
    }

    addNotification(notification) {
        const notifications = [...this.state.ui.notifications];
        const id = Date.now().toString();
        
        notifications.push({
            id,
            ...notification,
            timestamp: new Date().toISOString()
        });

        this.updateState({
            ui: { ...this.state.ui, notifications }
        });

        // Auto-remove notification after duration
        if (notification.duration !== 0) {
            setTimeout(() => {
                this.removeNotification(id);
            }, notification.duration || 5000);
        }

        return id;
    }

    removeNotification(id) {
        const notifications = this.state.ui.notifications.filter(n => n.id !== id);
        this.updateState({
            ui: { ...this.state.ui, notifications }
        });
    }

    clearNotifications() {
        this.updateState({
            ui: { ...this.state.ui, notifications: [] }
        });
    }

    // Theme management
    setTheme(theme) {
        this.updateState({
            ui: { ...this.state.ui, theme }
        });
        
        localStorage.setItem('fixghar_theme', theme);
        this.applyTheme(theme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.body.className = `theme-${theme}`;
    }

    toggleTheme() {
        const newTheme = this.state.ui.theme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    // Data management
    setServices(services) {
        this.updateState({
            data: { ...this.state.data, services }
        });
        this.cacheData('services', services);
    }

    setBookings(bookings) {
        this.updateState({
            data: { ...this.state.data, bookings }
        });
        this.cacheData('bookings', bookings);
    }

    setCategories(categories) {
        this.updateState({
            data: { ...this.state.data, categories }
        });
        this.cacheData('categories', categories);
    }

    // Cache data to localStorage
    cacheData(key, data) {
        try {
            const cacheKey = `fixghar_cache_${key}`;
            const cacheData = {
                data,
                timestamp: Date.now(),
                expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (error) {
            console.error('Error caching data:', error);
        }
    }

    // Load cached data from localStorage
    loadCachedData() {
        try {
            const cacheKeys = ['services', 'bookings', 'categories'];
            
            cacheKeys.forEach(key => {
                const cacheKey = `fixghar_cache_${key}`;
                const cached = localStorage.getItem(cacheKey);
                
                if (cached) {
                    const { data, expiresAt } = JSON.parse(cached);
                    
                    // Check if cache is still valid
                    if (Date.now() < expiresAt) {
                        this.state.data[key] = data;
                    } else {
                        localStorage.removeItem(cacheKey);
                    }
                }
            });
        } catch (error) {
            console.error('Error loading cached data:', error);
        }
    }

    // Clear cached data
    clearCachedData() {
        try {
            const cacheKeys = ['services', 'bookings', 'categories'];
            cacheKeys.forEach(key => {
                localStorage.removeItem(`fixghar_cache_${key}`);
            });
            
            this.updateState({
                data: { services: [], bookings: [], categories: [] }
            });
        } catch (error) {
            console.error('Error clearing cached data:', error);
        }
    }

    // State subscription system
    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        this.subscribers.get(key).add(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.subscribers.get(key);
            if (callbacks) {
                callbacks.delete(callback);
            }
        };
    }

    // Notify subscribers of state changes
    notifySubscribers(oldState, newState) {
        this.subscribers.forEach((callbacks, key) => {
            if (oldState[key] !== newState[key]) {
                callbacks.forEach(callback => {
                    try {
                        callback(newState[key], oldState[key]);
                    } catch (error) {
                        console.error('Error in state subscriber:', error);
                    }
                });
            }
        });
    }

    // Persist state changes to localStorage
    persistState(updates) {
        try {
            // Only persist specific updates
            if (updates.user) {
                localStorage.setItem('fixghar_user_data', JSON.stringify(updates.user));
            }
            
            if (updates.token !== undefined) {
                if (updates.token) {
                    localStorage.setItem('fixghar_token', updates.token);
                } else {
                    localStorage.removeItem('fixghar_token');
                }
            }
            
            if (updates.userType !== undefined) {
                if (updates.userType) {
                    localStorage.setItem('fixghar_user_type', updates.userType);
                } else {
                    localStorage.removeItem('fixghar_user_type');
                }
            }
        } catch (error) {
            console.error('Error persisting state:', error);
        }
    }

    // Clear all state
    clearState() {
        this.state = {
            user: null,
            isAuthenticated: false,
            userType: null,
            token: null,
            ui: {
                currentModal: null,
                isLoading: false,
                notifications: [],
                theme: 'light'
            },
            data: {
                services: [],
                bookings: [],
                categories: []
            }
        };
        
        this.clearCachedData();
        this.notifySubscribers({}, this.state);
    }

    // Utility methods
    isUser() {
        return this.state.isAuthenticated && this.state.userType === 'user';
    }

    isFixer() {
        return this.state.isAuthenticated && this.state.userType === 'fixer';
    }

    isAdmin() {
        return this.state.isAuthenticated && this.state.userType === 'admin';
    }

    hasPermission(permission) {
        if (!this.state.isAuthenticated) return false;
        
        // Add permission logic here based on user type and role
        switch (permission) {
            case 'create_booking':
                return this.isUser();
            case 'manage_bookings':
                return this.isUser() || this.isFixer();
            case 'manage_services':
                return this.isFixer() || this.isAdmin();
            case 'admin_access':
                return this.isAdmin();
            default:
                return false;
        }
    }

    // Get user info safely
    getUserInfo() {
        return this.state.user ? { ...this.state.user } : null;
    }

    // Check if data is stale (older than 5 minutes)
    isDataStale(key) {
        try {
            const cacheKey = `fixghar_cache_${key}`;
            const cached = localStorage.getItem(cacheKey);
            
            if (cached) {
                const { timestamp } = JSON.parse(cached);
                return Date.now() - timestamp > 5 * 60 * 1000; // 5 minutes
            }
            return true;
        } catch (error) {
            return true;
        }
    }
}

// Create global instance
const stateService = new FIXGHARStateService();

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FIXGHARStateService;
    module.exports.default = FIXGHARStateService;
} else if (typeof window !== 'undefined') {
    window.FIXGHARStateService = FIXGHARStateService;
    window.stateService = stateService;
}


