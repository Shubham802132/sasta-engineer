const crypto = require('crypto');
const axios = require('axios');
const {
    getMsg91Config,
    validateMsg91Config,
    validateMsg91ForOtpSend,
    logDevOtpConsole,
    logMsg91Response,
    sanitizeMsg91ForLog,
    fetchMsg91Balance,
    isPlaceholderAuthKey
} = require('../config/msg91');

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

function logSmsEnvOnce() {
    if (logSmsEnvOnce._done) return;
    logSmsEnvOnce._done = true;

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM;
    const msg91 = process.env.MSG91_AUTH_KEY;
    const msg91Cfg = getMsg91Config();
    const env = process.env.NODE_ENV || 'development';

    console.log('📲 [SMS env] NODE_ENV:', env);
    console.log('📲 [SMS env] TWILIO_ACCOUNT_SID:', sid ? maskSecret(sid, 6) : '[not set]');
    console.log('📲 [SMS env] TWILIO_AUTH_TOKEN:', token ? '[set]' : '[not set]');
    console.log(
        '📲 [SMS env] TWILIO_PHONE_NUMBER:',
        from || '[not set] (trial: recipient must be verified in Twilio)'
    );
    console.log('📲 [SMS env] MSG91_AUTH_KEY:', isPlaceholderAuthKey(msg91) ? '[not set / placeholder]' : '[set]');
    console.log('📲 [SMS env] MSG91_TEMPLATE_ID:', msg91Cfg.templateId || '[not set]');
    console.log('📲 [SMS env] MSG91_SENDER_ID:', msg91Cfg.senderId || '[not set]');
    console.log('📲 [SMS env] MSG91_ROUTE:', msg91Cfg.route || '[not set]');
    console.log(
        '📲 [SMS env] SMS_TEST_MODE:',
        process.env.SMS_TEST_MODE === 'true' ? 'true (no SMS sent to handset)' : 'false / unset'
    );
}

// SMS delivery: Twilio (preferred) or MSG91; optional test mode
class SMSService {
    constructor() {
        logSmsEnvOnce();
        this.msg91BaseUrl = getMsg91Config().otpUrl;
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

        const msg91Validation = validateMsg91Config();
        const { cfg, authOk: msg91Configured, flowOk: msg91FlowConfigured, templatePending } =
            msg91Validation;

        const twilioConfigured = !!(sid && token && fromNumber);
        const smsTestMode = cfg.smsTestMode;

        const missing = [...msg91Validation.missing];
        if (!sid) missing.push('TWILIO_ACCOUNT_SID');
        if (!token) missing.push('TWILIO_AUTH_TOKEN');
        if (!fromNumber) missing.push('TWILIO_PHONE_NUMBER');

        let provider = null;
        if (smsTestMode) provider = 'test';
        else if (twilioConfigured) provider = 'twilio';
        else if (msg91Configured) provider = 'msg91';

        return {
            provider,
            twilioConfigured,
            msg91Configured,
            msg91FlowConfigured,
            msg91TemplatePending: templatePending,
            smsTestMode,
            missing,
            msg91: msg91Validation.diagnostics
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

    async sendViaMsg91(mobile91, otp) {
        const preCheck = validateMsg91ForOtpSend();
        if (!preCheck.ok) {
            return {
                attempted: true,
                ok: false,
                provider: 'msg91',
                code: preCheck.code,
                message: preCheck.message
            };
        }

        if (preCheck.pendingTemplateDev) {
            logDevOtpConsole(otp, 'MSG91 template pending');
            return {
                attempted: true,
                ok: true,
                provider: 'msg91',
                code: 'MSG91_TEMPLATE_PENDING',
                message: preCheck.message,
                pendingTemplateDev: true
            };
        }

        const cfg = preCheck.cfg;

        const balance = await fetchMsg91Balance(cfg.route);
        if (balance != null && balance <= 0) {
            console.error('❌ [MSG91] SMS balance is 0 — recharge MSG91 wallet to deliver OTP SMS.');
            return {
                attempted: true,
                ok: false,
                provider: 'msg91',
                code: 'MSG91_INSUFFICIENT_BALANCE',
                message:
                    'MSG91 SMS balance is 0. OTP was not sent to your phone. Recharge your MSG91 wallet and try again.'
            };
        }

        const params = new URLSearchParams({
            template_id: cfg.templateId,
            mobile: String(mobile91),
            otp: String(otp),
            otp_length: '6',
            otp_expiry: '10'
        });

        const url = `${cfg.otpUrl}?${params.toString()}`;

        console.log('📤 [MSG91] POST', url.replace(String(otp), '[redacted]'), {
            template_id: cfg.templateId,
            mobile: mobile91,
            balance: balance != null ? balance : '[unknown]'
        });

        const response = await axios.post(
            url,
            {},
            {
                headers: {
                    authkey: cfg.authKey,
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                timeout: 25000,
                validateStatus: () => true
            }
        );

        logMsg91Response('OTP API', response.status, response.data);

        const data = response.data || {};
        const httpOk = response.status >= 200 && response.status < 300;
        const typeOk = String(data.type || '').toLowerCase() === 'success';
        const hasReqId = !!data.request_id;

        if (httpOk && typeOk && hasReqId) {
            return {
                ok: true,
                provider: 'msg91',
                requestId: data.request_id,
                providerMessage: data.message,
                raw: data
            };
        }

        const providerMessage = data.message || data.error || `MSG91 HTTP ${response.status}`;
        console.error('❌ [MSG91] Delivery failed:', providerMessage, sanitizeMsg91ForLog(data));

        return {
            ok: false,
            provider: 'msg91',
            code: 'SMS_PROVIDER_ERROR',
            message: providerMessage,
            detail: data
        };
    }

    async sendViaMsg91Flow(mobile91, otp) {
        const cfg = getMsg91Config();

        if (isPlaceholderAuthKey(cfg.authKey)) {
            return { attempted: false, reason: 'MSG91_AUTH_KEY not configured or is placeholder' };
        }
        if (!cfg.flowId) {
            return { attempted: false, reason: 'MSG91_FLOW_ID not set' };
        }

        const recipient = { mobiles: mobile91 };
        recipient[cfg.flowOtpVar] = otp;

        const payload = {
            flow_id: cfg.flowId,
            sender: cfg.senderId || undefined,
            recipients: [recipient]
        };

        console.log('📤 [MSG91 FLOW] POST', cfg.flowUrl, {
            flow_id: cfg.flowId,
            sender: cfg.senderId || '[not set]',
            mobiles: mobile91,
            otpVar: cfg.flowOtpVar
        });

        const response = await axios.post(cfg.flowUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                authkey: cfg.authKey
            },
            timeout: 25000,
            validateStatus: () => true
        });

        logMsg91Response('FLOW API', response.status, response.data);

        const data = response.data || {};
        const httpOk = response.status >= 200 && response.status < 300;
        const typeOk = String(data.type || '').toLowerCase() === 'success';

        if (httpOk && typeOk) {
            return { ok: true, provider: 'msg91_flow', messageId: data.message, raw: data };
        }

        return {
            ok: false,
            provider: 'msg91_flow',
            message: data.message || data.error || `MSG91 FLOW HTTP ${response.status}`,
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
            msg91FlowConfigured: status.msg91FlowConfigured,
            smsTestMode: status.smsTestMode
        });

        if (status.smsTestMode) {
            console.warn(
                '🧪 [OTP SMS] SMS_TEST_MODE=true — no SMS sent to phone. Set SMS_TEST_MODE=false and configure Twilio or MSG91.'
            );
            console.log('🧪 [OTP SMS] Would send to:', e164, 'OTP:', otp);
            if (env === 'production') {
                return {
                    success: false,
                    code: 'SMS_TEST_MODE_PRODUCTION',
                    message:
                        'SMS_TEST_MODE is enabled on the server. OTP was not sent to your phone. Set SMS_TEST_MODE=false and configure MSG91 (MSG91_AUTH_KEY + MSG91_TEMPLATE_ID) or Twilio on Render.',
                    provider: 'test',
                    testMode: true,
                    deliveredToHandset: false,
                    deliveryStatus: 'test_mode_blocked',
                    phoneE164: e164
                };
            }
            return {
                success: true,
                code: 'TEST_MODE',
                message: 'Test mode: SMS not sent to handset.',
                provider: 'test',
                testMode: true,
                deliveredToHandset: false,
                deliveryStatus: 'test_mode',
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
                    deliveredToHandset: false,
                    deliveryStatus: 'test_mode_auto',
                    phoneE164: e164,
                    missingEnv: status.missing
                };
            }

            return {
                success: false,
                code: 'SMS_NOT_CONFIGURED',
                message:
                    `SMS could not be sent: missing ${status.missing.join(', ')}. Configure Twilio (TWILIO_*) or MSG91 (MSG91_AUTH_KEY + MSG91_TEMPLATE_ID), set SMS_TEST_MODE=false, and restart the server.`,
                deliveredToHandset: false,
                deliveryStatus: 'not_configured',
                phoneE164: e164,
                missingEnv: status.missing
            };
        }

        if (
            env === 'production' &&
            status.msg91Configured &&
            !status.msg91FlowConfigured &&
            (status.msg91TemplatePending || !getMsg91Config().templateId)
        ) {
            return {
                success: false,
                code: status.msg91TemplatePending ? 'MSG91_TEMPLATE_PENDING' : 'MSG91_TEMPLATE_MISSING',
                message: status.msg91TemplatePending
                    ? 'MSG91 DLT template is pending approval. OTP cannot be sent until the template is approved.'
                    : 'MSG91_TEMPLATE_ID is not set on the server. OTP cannot be delivered without a DLT-approved template ID.',
                deliveredToHandset: false,
                deliveryStatus: 'failed',
                phoneE164: e164
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
                console.log('✅ [OTP SMS] Sent via Twilio', tw.messageSid, 'status:', tw.status);
                return {
                    success: true,
                    provider: 'twilio',
                    messageSid: tw.messageSid,
                    deliveredToHandset: true,
                    deliveryStatus: 'sent',
                    providerMessage: tw.status,
                    phoneE164: e164
                };
            } else {
                console.error('❌ [OTP SMS] Twilio failed:', tw.message, tw.code, tw.detail);
                // fall through to MSG91
            }
        } catch (err) {
            console.error('❌ [OTP SMS] Twilio exception:', err.message);
            if (err.response?.data) {
                console.error('❌ [OTP SMS] Twilio error body:', JSON.stringify(err.response.data));
            }
        }

        // 2) MSG91 — mobile format 91XXXXXXXXXX (no +)
        try {
            const digits10 = norm.digits10 || e164.replace(/^\+91/, '');
            const mobile91 = `91${digits10}`;
            console.log('📤 [MSG91] Mobile formatted (no +):', mobile91);

            if (status.msg91Configured && !status.twilioConfigured) {
                const preCheck = validateMsg91ForOtpSend();
                if (!preCheck.ok) {
                    return {
                        success: false,
                        code: preCheck.code,
                        message: preCheck.message,
                        deliveredToHandset: false,
                        deliveryStatus: 'failed',
                        phoneE164: e164
                    };
                }
                if (preCheck.pendingTemplateDev) {
                    logDevOtpConsole(otp, 'MSG91 template pending');
                    return {
                        success: true,
                        code: 'MSG91_TEMPLATE_PENDING',
                        message: preCheck.message,
                        provider: 'msg91',
                        testMode: true,
                        pendingTemplateDev: true,
                        deliveredToHandset: false,
                        deliveryStatus: 'template_pending_dev',
                        phoneE164: e164
                    };
                }
            }

            const m = status.msg91FlowConfigured
                ? await this.sendViaMsg91Flow(mobile91, otp)
                : await this.sendViaMsg91(mobile91, otp);

            if (m.attempted === false) {
                console.log('ℹ️ [OTP SMS] MSG91 skipped:', m.reason);
            } else if (m.ok) {
                console.log('✅ [OTP SMS] Sent via MSG91 request_id:', m.requestId || m.messageId);
                const pendingDev = !!m.pendingTemplateDev;
                return {
                    success: true,
                    provider: m.provider || 'msg91',
                    deliveredToHandset: !pendingDev,
                    deliveryStatus: pendingDev ? 'template_pending_dev' : 'sent',
                    providerMessage: m.providerMessage || m.message || 'accepted',
                    code: m.code,
                    message: m.message,
                    phoneE164: e164,
                    requestId: m.requestId,
                    messageId: m.messageId,
                    testMode: pendingDev,
                    pendingTemplateDev: pendingDev
                };
            } else {
                console.error('❌ [OTP SMS] MSG91 failed:', m.message, m.code, m.detail);
                return {
                    success: false,
                    code: m.code || 'SMS_PROVIDER_ERROR',
                    message: m.message || 'SMS provider (MSG91) rejected the request.',
                    deliveredToHandset: false,
                    deliveryStatus: 'failed',
                    phoneE164: e164,
                    providerResponse: m.detail
                };
            }
        } catch (err) {
            console.error('❌ [OTP SMS] MSG91 exception:', err.message);
            if (err.response?.data) {
                console.error(
                    '❌ [OTP SMS] MSG91 error body:',
                    JSON.stringify(sanitizeMsg91ForLog(err.response.data))
                );
            }
        }

        console.error('❌ [OTP SMS] All configured providers failed.');
        return {
            success: false,
            code: 'SMS_PROVIDER_ERROR',
            message:
                'SMS could not be delivered. Check Twilio trial verified numbers, MSG91 template/DLT/credits, and server logs.',
            deliveredToHandset: false,
            deliveryStatus: 'failed',
            phoneE164: e164
        };
    }

    /** Non-secret SMS config summary for logs / health checks */
    getDiagnostics() {
        const status = this.getProviderStatus();
        const msg91Validation = validateMsg91Config();
        return {
            nodeEnv: process.env.NODE_ENV || 'development',
            smsTestMode: status.smsTestMode,
            provider: status.provider,
            twilioConfigured: status.twilioConfigured,
            msg91Configured: status.msg91Configured,
            msg91FlowConfigured: status.msg91FlowConfigured,
            msg91: msg91Validation.diagnostics,
            missingEnv: status.missing
        };
    }
}

const smsService = new SMSService();

smsService.normalizeIndianToE164 = normalizeIndianToE164;

module.exports = smsService;
