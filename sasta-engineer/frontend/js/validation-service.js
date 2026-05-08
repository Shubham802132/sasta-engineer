// FIXGHAR Core Validation Service
// Handles all frontend form validation

class FIXGHARValidationService {
    constructor() {
        this.config = window.FIXGHAR_CONFIG || {};
        this.setupValidationRules();
    }

    // Setup validation rules from config
    setupValidationRules() {
        this.rules = {
            user: {
                name: { min: 2, max: 50, required: true },
                username: { min: 3, max: 30, required: true, pattern: /^[a-zA-Z0-9_]+$/ },
                email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
                phone: { min: 10, max: 15, pattern: /^[0-9+\-\s()]+$/ },
                password: { min: 6, max: 100, required: true },
                confirmPassword: { required: true }
            },
            fixer: {
                name: { min: 2, max: 50, required: true },
                username: { min: 3, max: 30, required: true, pattern: /^[a-zA-Z0-9_]+$/ },
                email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
                phone: { min: 10, max: 15, pattern: /^[0-9+\-\s()]+$/ },
                password: { min: 6, max: 100, required: true },
                confirmPassword: { required: true },
                serviceCategory: { required: true },
                experience: { min: 0, max: 50, type: 'number' }
            },
            address: {
                street: { required: true, min: 5, max: 100 },
                city: { required: true, min: 2, max: 50 },
                state: { required: true, min: 2, max: 50 },
                zipCode: { required: true, pattern: /^[0-9]{5,6}$/ }
            },
            booking: {
                description: { required: true, min: 10, max: 500 },
                urgency: { required: true, enum: ['low', 'medium', 'high', 'emergency'] },
                date: { required: true, type: 'date' },
                time: { required: true, type: 'time' }
            }
        };

        this.messages = {
            required: 'This field is required',
            min: 'Minimum {min} characters required',
            max: 'Maximum {max} characters allowed',
            pattern: 'Invalid format',
            email: 'Please enter a valid email address',
            phone: 'Please enter a valid phone number',
            passwordMismatch: 'Passwords do not match',
            invalidDate: 'Please select a valid date',
            invalidTime: 'Please select a valid time',
            invalidUrgency: 'Please select a valid urgency level'
        };
    }

    // Validate single field
    validateField(fieldName, value, rules) {
        const errors = [];

        // Required check
        if (rules.required && (!value || value.toString().trim() === '')) {
            errors.push(this.messages.required);
            return errors;
        }

        if (!value || value.toString().trim() === '') {
            return errors; // Skip other validations if empty and not required
        }

        // Length checks
        if (rules.min && value.toString().length < rules.min) {
            errors.push(this.messages.min.replace('{min}', rules.min));
        }

        if (rules.max && value.toString().length > rules.max) {
            errors.push(this.messages.max.replace('{max}', rules.max));
        }

        // Pattern check
        if (rules.pattern && !rules.pattern.test(value)) {
            errors.push(this.messages.pattern);
        }

        // Type check
        if (rules.type === 'number' && isNaN(Number(value))) {
            errors.push('Must be a valid number');
        }

        // Email check
        if (fieldName === 'email' && !this.isValidEmail(value)) {
            errors.push(this.messages.email);
        }

        // Phone check
        if (fieldName === 'phone' && !this.isValidPhone(value)) {
            errors.push(this.messages.phone);
        }

        return errors;
    }

    // Validate form data
    validateForm(formData, formType) {
        const errors = {};
        const rules = this.rules[formType] || {};

        for (const [fieldName, fieldRules] of Object.entries(rules)) {
            const value = formData[fieldName];
            const fieldErrors = this.validateField(fieldName, value, fieldRules);
            
            if (fieldErrors.length > 0) {
                errors[fieldName] = fieldErrors;
            }
        }

        // Special validations
        if (formType === 'user' || formType === 'fixer') {
            // Password confirmation check
            if (formData.password && formData.confirmPassword) {
                if (formData.password !== formData.confirmPassword) {
                    errors.confirmPassword = [this.messages.passwordMismatch];
                }
            }

            // Address validation if present
            if (formData.address) {
                const addressErrors = this.validateForm(formData.address, 'address');
                if (Object.keys(addressErrors).length > 0) {
                    errors.address = addressErrors;
                }
            }
        }

        // Booking specific validations
        if (formType === 'booking') {
            if (formData.date && formData.time) {
                if (!this.isValidDateTime(formData.date, formData.time)) {
                    errors.dateTime = ['Please select a future date and time'];
                }
            }
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }

    // Validate user registration
    validateUserRegistration(userData) {
        return this.validateForm(userData, 'user');
    }

    // Validate fixer registration
    validateFixerRegistration(fixerData) {
        return this.validateForm(fixerData, 'fixer');
    }

    // Validate login
    validateLogin(credentials) {
        const errors = {};

        if (!credentials.email || !this.isValidEmail(credentials.email)) {
            errors.email = [this.messages.email];
        }

        if (!credentials.password) {
            errors.password = [this.messages.required];
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }

    // Validate OTP
    validateOTP(otpData) {
        const errors = {};

        if (!otpData.phone || !this.isValidPhone(otpData.phone)) {
            errors.phone = [this.messages.phone];
        }

        if (!otpData.otp || otpData.otp.length !== 6) {
            errors.otp = ['Please enter a valid 6-digit OTP'];
        }

        if (!otpData.userType || !['user', 'fixer'].includes(otpData.userType)) {
            errors.userType = ['Please select a valid user type'];
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }

    // Validate address
    validateAddress(addressData) {
        return this.validateForm(addressData, 'address');
    }

    // Validate booking
    validateBooking(bookingData) {
        return this.validateForm(bookingData, 'booking');
    }

    // Utility validation methods
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isValidPhone(phone) {
        const phoneRegex = /^[0-9+\-\s()]{10,15}$/;
        return phoneRegex.test(phone);
    }

    isValidDateTime(date, time) {
        const selectedDateTime = new Date(`${date}T${time}`);
        const now = new Date();
        return selectedDateTime > now;
    }

    // Real-time validation for input fields
    setupRealTimeValidation(formSelector) {
        const form = document.querySelector(formSelector);
        if (!form) return;

        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            input.addEventListener('blur', () => {
                this.validateInputField(input);
            });

            input.addEventListener('input', () => {
                this.clearFieldError(input);
            });
        });
    }

    // Validate single input field in real-time
    validateInputField(input) {
        const fieldName = input.name;
        const value = input.value;
        
        // Find validation rules for this field
        let rules = {};
        if (fieldName.includes('.')) {
            // Nested field (e.g., address.street)
            const [parent, child] = fieldName.split('.');
            rules = this.rules[parent]?.[child] || {};
        } else {
            // Direct field
            rules = this.rules.user?.[fieldName] || this.rules.fixer?.[fieldName] || {};
        }

        const errors = this.validateField(fieldName, value, rules);
        
        if (errors.length > 0) {
            this.showFieldError(input, errors[0]);
        } else {
            this.clearFieldError(input);
        }
    }

    // Show field error
    showFieldError(input, errorMessage) {
        this.clearFieldError(input);
        
        input.classList.add('error');
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = errorMessage;
        errorDiv.style.display = 'block';
        
        input.parentNode.appendChild(errorDiv);
    }

    // Clear field error
    clearFieldError(input) {
        input.classList.remove('error');
        
        const errorDiv = input.parentNode.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.remove();
        }
    }

    // Show form errors
    showFormErrors(form, errors) {
        // Clear previous errors
        this.clearFormErrors(form);

        // Show new errors
        for (const [fieldName, fieldErrors] of Object.entries(errors)) {
            const input = form.querySelector(`[name="${fieldName}"]`);
            if (input && fieldErrors.length > 0) {
                this.showFieldError(input, fieldErrors[0]);
            }
        }
    }

    // Clear form errors
    clearFormErrors(form) {
        const errorMessages = form.querySelectorAll('.error-message');
        errorMessages.forEach(error => error.remove());
        
        const errorInputs = form.querySelectorAll('.error');
        errorInputs.forEach(input => input.classList.remove('error'));
    }

    // Sanitize input data
    sanitizeInput(input) {
        if (typeof input === 'string') {
            return input.trim().replace(/[<>]/g, '');
        }
        return input;
    }

    // Sanitize form data
    sanitizeFormData(formData) {
        const sanitized = {};
        
        for (const [key, value] of Object.entries(formData)) {
            if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeFormData(value);
            } else {
                sanitized[key] = this.sanitizeInput(value);
            }
        }
        
        return sanitized;
    }
}

// Create global instance
const validationService = new FIXGHARValidationService();

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FIXGHARValidationService;
    module.exports.default = FIXGHARValidationService;
} else if (typeof window !== 'undefined') {
    window.FIXGHARValidationService = FIXGHARValidationService;
    window.validationService = validationService;
}


