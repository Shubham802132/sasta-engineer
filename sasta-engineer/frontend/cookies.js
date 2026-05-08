// FIXGHAR Cookie Management Service
// Handles cookie operations for authentication and user preferences

class CookieManager {
    constructor() {
        this.defaultExpiry = 7; // days
    }

    // Set a cookie
    set(name, value, days = this.defaultExpiry) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
    }

    // Get a cookie value
    get(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    // Delete a cookie
    delete(name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
    }

    // Check if a cookie exists
    exists(name) {
        return this.get(name) !== null;
    }

    // Set authentication token
    setAuthToken(token) {
        this.set('fixghar_token', token, 7);
    }

    // Get authentication token
    getAuthToken() {
        return this.get('fixghar_token');
    }

    // Clear authentication token
    clearAuthToken() {
        this.delete('fixghar_token');
    }

    // Set user preferences
    setUserPreference(key, value) {
        this.set(`fixghar_pref_${key}`, value, 30);
    }

    // Get user preference
    getUserPreference(key) {
        return this.get(`fixghar_pref_${key}`);
    }
}

// Create global instance
window.cookieManager = new CookieManager();
