const crypto = require('crypto');
const axios = require('axios');

/**
 * Normalize Indian mobile numbers to E.164: +91XXXXXXXXXX
 * Accepts: 9876543210, +919876543210, 91-98765-43210, etc.
 */
function normalizeIndianToE164(input) {
    if (input == null || input === '') {
        return { ok: false, error: 'Phone number is required.' };
    }
    const raw = String(input).trim();
    let digits = raw.replace(/\D/g, '');

    // Leading 0 for STD-style mobile
    if (digits.length === 11 && digits.startsWith('0')) {
        digits = digits.slice(1);
    }

    // 10-digit Indian mobile (starts 6-9)
    if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
        return { ok: true, e164: `+91${digits}`, digits10: digits };
    }

    // Already includes country code 91
    if (digits.length === 12 && digits.startsWith('91')) {
        const rest = digits.slice(2);
        if (/^[6-9]\d{9}$/.test(rest)) {
            return { ok: true, e164: `+91${rest}`, digits10: rest };
        }
    }

    return {
        ok: false,
        error:
            'Invalid Indian mobile number. Enter 10 digits starting with 6–9, or use +91XXXXXXXXXX.'
    };
}

function maskSecret(value, keepStart = 4) {
    if (!value || typeof value !== 'string') return '[missing]';
    if (value.length <= keepStart) return '***';
    return `${value.slice(0, keepStart)}…`;
}

function isPlaceholderAuthKey(key) {
    if (!key || typeof key !== 'string') return true;
    const k = key.trim().toLowerCase();
    return (
        k === '' ||
        k.includes('your_msg91') ||
        k.includes('your_') ||
        k.includes('_here') ||
        k === 'your_msg91_auth_key_here'
    );
}

function logSmsEnvOnce() {
    if (logSmsEnvOnce._done) return;
    logSmsEnvOnce._done = true;

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM;
    const msg91 = process.env.MSG91_AUTH_KEY;
    const env = process.env.NODE_ENV || 'development';

    console.log('📲 [SMS env] NODE_ENV:', env);
    console.log('📲 [SMS env] TWILIO_ACCOUNT_SID:', sid ? maskSecret(sid, 6) : '[not set]');
    console.log('📲 [SMS env] TWILIO_AUTH_TOKEN:', token ? '[set]' : '[not set]');
    console.log(
        '📲 [SMS env] TWILIO_PHONE_NUMBER:',
        from || '[not set] (trial: recipient must be verified in Twilio)'
    );
    console.log('📲 [SMS env] MSG91_AUTH_KEY:', isPlaceholderAuthKey(msg91) ? '[not set / placeholder]' : '[set]');
    console.log(
        '📲 [SMS env] SMS_TEST_MODE:',
        process.env.SMS_TEST_MODE === 'true' ? 'true (no SMS sent to handset)' : 'false / unset'
    );
}

// SMS delivery: Twilio (preferred) or MSG91; optional test mode
class SMSService {
    constructor() {
        logSmsEnvOnce();
        this.msg91BaseUrl =
            process.env.MSG91_OTP_URL || 'https://control.msg91.com/api/v5/otp';
    }

    validateIndianPhoneE164(e164) {
        return /^\+91[6-9]\d{9}$/.test(String(e164 || ''));
    }

    generateOTP() {
        return crypto.randomInt(100000, 999999).toString();
    }

    getProviderStatus() {
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber =
            process.env.TWILIO_PHONE_NUMBER ||
            process.env.TWILIO_FROM ||
            process.env.TWILIO_PHONE;
        const msg91Key = process.env.MSG91_AUTH_KEY;

        const twilioConfigured = !!(sid && token && fromNumber);
        const msg91Configured = !isPlaceholderAuthKey(msg91Key);
        const smsTestMode = process.env.SMS_TEST_MODE === 'true';

        const missing = [];
        if (!sid) missing.push('TWILIO_ACCOUNT_SID');
        if (!token) missing.push('TWILIO_AUTH_TOKEN');
        if (!fromNumber) missing.push('TWILIO_PHONE_NUMBER');
        if (isPlaceholderAuthKey(msg91Key)) missing.push('MSG91_AUTH_KEY');
        if (process.env.SMS_TEST_MODE !== 'true' && process.env.SMS_TEST_MODE !== 'false') {
            missing.push('SMS_TEST_MODE');
        }

        let provider = null;
        if (smsTestMode) provider = 'test';
        else if (twilioConfigured) provider = 'twilio';
        else if (msg91Configured) provider = 'msg91';

        return {
            provider,
            twilioConfigured,
            msg91Configured,
            smsTestMode,
            missing
        };
    }

    async sendViaTwilio(e164, bodyText) {
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber =
            process.env.TWILIO_PHONE_NUMBER ||
            process.env.TWILIO_FROM ||
            process.env.TWILIO_PHONE;

        if (!sid || !token || !fromNumber) {
            return {
                attempted: false,
                reason: 'Twilio credentials incomplete (need TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)'
            };
        }

        const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
        const auth = Buffer.from(`${sid}:${token}`).toString('base64');

        const params = new URLSearchParams();
        params.append('To', e164);
        params.append('From', fromNumber);
        params.append('Body', bodyText);

        console.log('📤 [Twilio] Sending SMS… To:', e164, 'From:', fromNumber);

        const response = await axios.post(url, params.toString(), {
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 25000,
            validateStatus: () => true
        });

        console.log('📥 [Twilio] HTTP status:', response.status);
        console.log('📥 [Twilio] Response:', JSON.stringify(response.data || {}, null, 2));

        if (response.status >= 200 && response.status < 300 && response.data?.sid) {
            return {
                ok: true,
                provider: 'twilio',
                messageSid: response.data.sid,
                status: response.data.status
            };
        }

        const errData = response.data || {};
        const msg =
            errData.message ||
            errData.error_message ||
            `Twilio error HTTP ${response.status}`;
        const code = errData.code || errData.status;

        if (String(code) === '21608' || /unverified/i.test(msg)) {
            console.error(
                '❌ [Twilio] Trial account: add this number as a Verified Caller ID / verified recipient in Twilio Console.'
            );
        }

        return {
            ok: false,
            provider: 'twilio',
            message: msg,
            code: code != null ? String(code) : 'TWILIO_ERROR',
            httpStatus: response.status,
            detail: errData
        };
    }

    async sendViaMsg91(mobile10, otp, smsMessage) {
        const authKey = process.env.MSG91_AUTH_KEY;
        if (isPlaceholderAuthKey(authKey)) {
            return { attempted: false, reason: 'MSG91_AUTH_KEY not configured or is placeholder' };
        }

        const templateId = process.env.MSG91_TEMPLATE_ID;
        if (!templateId) {
            console.warn(
                '⚠️ [MSG91] MSG91_TEMPLATE_ID is not set. Many MSG91 India accounts require a DLT-mapped template to deliver OTP.'
            );
        }

        const payload = {
            authkey: authKey,
            // MSG91 expects countrycode + mobile without "+" (India: 91XXXXXXXXXX)
            mobile: mobile10,
            otp,
            otp_expiry: 10,
            template_id: templateId || undefined
        };

        // MSG91 accepts optional message / sender depending on account — keep minimal OTP flow
        console.log('📤 [MSG91] POST', this.msg91BaseUrl, {
            mobile: mobile10,
            otp: '[redacted]',
            template_id: payload.template_id || '[default]'
        });

        const response = await axios.post(this.msg91BaseUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                authkey: authKey
            },
            timeout: 25000,
            validateStatus: () => true
        });

        console.log('📥 [MSG91] HTTP status:', response.status);
        console.log('📥 [MSG91] Body:', JSON.stringify(response.data || {}, null, 2));

        const data = response.data || {};
        const httpOk = response.status >= 200 && response.status < 300;
        const hasReqId = !!data.request_id;
        const typeOk = String(data.type || '').toLowerCase() === 'success';
        const msgOk =
            typeof data.message === 'string' &&
            data.message.toLowerCase().includes('otp') &&
            data.message.toLowerCase().includes('generated');
        const ok = httpOk && (typeOk || msgOk) && (hasReqId || msgOk);

        if (ok) {
            if (!hasReqId) {
                console.warn(
                    '⚠️ [MSG91] Success response without request_id. Delivery may still fail if template/DLT is not configured.'
                );
            }
            return {
                ok: true,
                provider: 'msg91',
                requestId: data.request_id,
                raw: data
            };
        }

        return {
            ok: false,
            provider: 'msg91',
            message: data.message || data.error || `MSG91 HTTP ${response.status}`,
            detail: data
        };
    }

    /**
     * @param {string} phoneNumber - raw or E.164
     * @param {string} otp - 6 digit OTP (already generated by OTP model)
     * @param {string} userType
     * @returns {Promise<{success:boolean, code?:string, message?:string, provider?:string, testMode?:boolean}>}
     */
    async sendOTP(phoneNumber, otp, userType = 'user') {
        const env = process.env.NODE_ENV || 'development';
        console.log('📱 [OTP SMS] Raw phone from caller:', phoneNumber);
        console.log('📱 [OTP SMS] OTP length:', otp ? String(otp).length : 0, 'userType:', userType, 'env:', env);

        const norm = normalizeIndianToE164(phoneNumber);
        if (!norm.ok) {
            console.error('❌ [OTP SMS] Invalid phone:', norm.error);
            return {
                success: false,
                code: 'INVALID_PHONE',
                message: norm.error
            };
        }

        const e164 = norm.e164;
        console.log('📱 [OTP SMS] E.164 for SMS gateway:', e164);

        const smsMessage = `Your FIXGHAR verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;

        const status = this.getProviderStatus();
        console.log('🧾 [OTP SMS] Provider status:', {
            provider: status.provider,
            twilioConfigured: status.twilioConfigured,
            msg91Configured: status.msg91Configured,
            smsTestMode: status.smsTestMode
        });

        if (status.smsTestMode) {
            console.warn(
                '🧪 [OTP SMS] SMS_TEST_MODE=true — no SMS sent to phone. Set SMS_TEST_MODE=false and configure Twilio or MSG91.'
            );
            console.log('🧪 [OTP SMS] Would send to:', e164, 'OTP:', otp);
            return {
                success: true,
                code: 'TEST_MODE',
                message: 'Test mode: SMS not sent to handset.',
                provider: 'test',
                testMode: true,
                phoneE164: e164
            };
        }

        if (!status.twilioConfigured && !status.msg91Configured) {
            console.error('❌ [OTP SMS] No SMS provider configured. Missing:', status.missing.join(', ') || '[unknown]');

            if (env !== 'production') {
                console.warn(
                    '🧪 [OTP SMS] Dev fallback: enabling implicit test mode (no SMS sent). Set SMS_TEST_MODE=true to silence this warning.'
                );
                console.log('🧪 [OTP SMS] Would send to:', e164, 'OTP:', otp);
                return {
                    success: true,
                    code: 'TEST_MODE_AUTO',
                    message:
                        'Local dev fallback: SMS not sent because no provider keys are configured. Set SMS_TEST_MODE=true for local testing or configure Twilio/MSG91 for real delivery.',
                    provider: 'test',
                    testMode: true,
                    phoneE164: e164,
                    missingEnv: status.missing
                };
            }

            return {
                success: false,
                code: 'SMS_NOT_CONFIGURED',
                message:
                    `SMS could not be sent: missing ${status.missing.join(', ')}. Configure Twilio (TWILIO_*) or MSG91 (MSG91_AUTH_KEY), set SMS_TEST_MODE=false, and restart the server.`,
                phoneE164: e164,
                missingEnv: status.missing
            };
        }

        if (status.twilioConfigured) console.log('📡 [OTP SMS] Provider selected: twilio');
        else if (status.msg91Configured) console.log('📡 [OTP SMS] Provider selected: msg91');

        // 1) Twilio
        try {
            const tw = await this.sendViaTwilio(e164, smsMessage);
            if (tw.attempted === false) {
                console.log('ℹ️ [OTP SMS] Twilio skipped:', tw.reason);
            } else if (tw.ok) {
                console.log('✅ [OTP SMS] Sent via Twilio', tw.messageSid);
                return {
                    success: true,
                    provider: 'twilio',
                    messageSid: tw.messageSid,
                    phoneE164: e164
                };
            } else {
                console.error('❌ [OTP SMS] Twilio failed:', tw.message, tw.detail);
                // fall through to MSG91
            }
        } catch (err) {
            console.error('❌ [OTP SMS] Twilio exception:', err.message);
            if (err.response?.data) {
                console.error('❌ [OTP SMS] Twilio error body:', JSON.stringify(err.response.data));
            }
        }

        // 2) MSG91 (10-digit mobile without country code)
        try {
            const digits10 = norm.digits10 || e164.replace(/^\+91/, '');
            const mobile91 = `91${digits10}`; // required: 91XXXXXXXXXX (no '+')
            console.log('📤 [MSG91] Mobile formatted (no +):', mobile91);
            const m = await this.sendViaMsg91(mobile91, otp, smsMessage);
            if (m.attempted === false) {
                console.log('ℹ️ [OTP SMS] MSG91 skipped:', m.reason);
            } else if (m.ok) {
                console.log('✅ [OTP SMS] Sent via MSG91');
                return {
                    success: true,
                    provider: 'msg91',
                    phoneE164: e164,
                    requestId: m.requestId
                };
            } else {
                console.error('❌ [OTP SMS] MSG91 failed:', m.message, m.detail);
                return {
                    success: false,
                    code: 'SMS_PROVIDER_ERROR',
                    message: m.message || 'SMS provider (MSG91) rejected the request.',
                    phoneE164: e164
                };
            }
        } catch (err) {
            console.error('❌ [OTP SMS] MSG91 exception:', err.message);
            if (err.response?.data) {
                console.error('❌ [OTP SMS] MSG91 error body:', JSON.stringify(err.response.data));
            }
        }

        console.error('❌ [OTP SMS] All configured providers failed.');
        return {
            success: false,
            code: 'SMS_NOT_CONFIGURED',
            message:
                'SMS could not be sent. Configure Twilio (TWILIO_*) or MSG91 (MSG91_AUTH_KEY), set SMS_TEST_MODE=false, and restart the server.',
            phoneE164: e164
        };
    }
}

const smsService = new SMSService();

smsService.normalizeIndianToE164 = normalizeIndianToE164;

module.exports = smsService;
