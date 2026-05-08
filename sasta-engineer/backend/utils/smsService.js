const crypto = require('crypto');
const axios = require('axios');

// SMS Service for OTP delivery
// Real SMS service using MSG91 API for actual SMS delivery

class SMSService {
    constructor() {
        // MSG91 SMS configuration
        this.config = {
            authKey: process.env.MSG91_AUTH_KEY || 'your_msg91_auth_key',
            senderId: process.env.MSG91_SENDER_ID || 'FIXGHAR',
            route: process.env.MSG91_ROUTE || '4', // 4 for transactional SMS
            country: process.env.MSG91_COUNTRY || '91', // India country code
            baseUrl: 'https://api.msg91.com/api/v5/otp',
            testMode: process.env.SMS_TEST_MODE === 'true' || false
        };
    }

    // Generate OTP
    generateOTP() {
        return crypto.randomInt(100000, 999999).toString();
    }

    // Send OTP via SMS using MSG91 API
    async sendOTP(phoneNumber, otp, userType = 'user') {
        try {
            console.log('📱 SMS OTP Service - MSG91 Implementation');
            console.log('📱 Phone:', phoneNumber);
            console.log('📱 OTP:', otp);
            console.log('📱 User Type:', userType);
            
            // Format phone number
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            console.log('📱 Formatted Phone:', formattedPhone);
            
            // Create SMS message
            const smsMessage = `Your FIXGHAR verification code is: ${otp}. This code will expire in 10 minutes. Do not share this code with anyone.`;
            
            // If test mode, just log and return success
            if (this.config.testMode) {
                console.log('🧪 TEST MODE: SMS not sent, but logged');
                console.log('📱 Message:', smsMessage);
                console.log('📱 Would send to:', formattedPhone);
                
                return {
                    success: true,
                    messageId: `TEST_${Date.now()}`,
                    phoneNumber: formattedPhone,
                    message: smsMessage,
                    timestamp: new Date().toISOString(),
                    testMode: true
                };
            }
            
            // MSG91 API configuration
            const phoneDigits = formattedPhone.replace('+', '');
            const mobileNumber = phoneDigits.startsWith('91') ? phoneDigits.substring(2) : phoneDigits;
            
            const msg91Data = {
                authkey: this.config.authKey,
                mobile: mobileNumber,
                message: smsMessage,
                sender: this.config.senderId,
                route: this.config.route,
                country: this.config.country,
                otp: otp,
                otp_expiry: 10 // 10 minutes
            };
            
            console.log('📤 Sending SMS via MSG91 API...');
            console.log('📤 MSG91 Data:', { ...msg91Data, authkey: '***' });
            
            const response = await axios.post(this.config.baseUrl, msg91Data, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            console.log('✅ MSG91 API Response:', response.data);
            
            if (response.data.type === 'success') {
                console.log('✅ SMS OTP sent successfully via MSG91!');
                console.log('📱 Request ID:', response.data.request_id);
                
                return {
                    success: true,
                    messageId: response.data.request_id,
                    phoneNumber: formattedPhone,
                    message: smsMessage,
                    timestamp: new Date().toISOString(),
                    apiResponse: response.data,
                    provider: 'MSG91'
                };
            } else {
                throw new Error(`MSG91 API Error: ${response.data.message || 'Unknown error'}`);
            }
            
        } catch (error) {
            console.error('❌ MSG91 SMS sending failed:', error.message);
            
            // Fallback: Log OTP for testing
            console.log('⚠️ FALLBACK: OTP for testing -', otp);
            console.log('📱 Phone:', phoneNumber);
            
            // Return success with fallback info
            return {
                success: true,
                messageId: `FALLBACK_${Date.now()}`,
                phoneNumber: phoneNumber,
                message: `OTP: ${otp} (Fallback - SMS failed)`,
                timestamp: new Date().toISOString(),
                fallback: true,
                error: error.message
            };
        }
    }

    // Send OTP for user registration
    async sendRegistrationOTP(phoneNumber, userType = 'user') {
        const otp = this.generateOTP();
        const message = `Welcome to FIXGHAR! Your verification code is: ${otp}. This code will expire in 10 minutes.`;
        
        return await this.sendOTP(phoneNumber, otp, userType);
    }

    // Send OTP for login verification
    async sendLoginOTP(phoneNumber, userType = 'user') {
        const otp = this.generateOTP();
        const message = `Your FIXGHAR login code is: ${otp}. This code will expire in 10 minutes.`;
        
        return await this.sendOTP(phoneNumber, otp, userType);
    }

    // Send OTP for password reset
    async sendPasswordResetOTP(phoneNumber, userType = 'user') {
        const otp = this.generateOTP();
        const message = `Your FIXGHAR password reset code is: ${otp}. This code will expire in 10 minutes.`;
        
        return await this.sendOTP(phoneNumber, otp, userType);
    }

    // Validate phone number format
    validatePhoneNumber(phoneNumber) {
        // Indian phone number validation
        const phoneRegex = /^[6-9]\d{9}$/;
        return phoneRegex.test(phoneNumber.replace(/\D/g, ''));
    }

    // Format phone number for SMS
    formatPhoneNumber(phoneNumber) {
        // Remove all non-digits
        const digits = phoneNumber.replace(/\D/g, '');
        
        // Add country code if not present
        if (digits.length === 10) {
            return `+91${digits}`;
        } else if (digits.length === 12 && digits.startsWith('91')) {
            return `+${digits}`;
        }
        
        return phoneNumber;
    }
}

// Create singleton instance
const smsService = new SMSService();

module.exports = smsService;
