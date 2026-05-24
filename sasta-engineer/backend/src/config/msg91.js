/**
 * MSG91 OTP configuration — loaded from process.env only (via dotenv in server.js).
 * Never hardcode secrets. Non-fatal startup validation; clear errors at send time.
 */

const axios = require('axios');

function isDevEnvironment() {
    return (process.env.NODE_ENV || 'development') !== 'production';
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

/** Strip accidental "MSG91_TEMPLATE_ID=..." prefix from malformed .env values. */
function normalizeTemplateId(raw) {
    let t = (raw || '').trim();
    const lower = t.toLowerCase();
    const prefix = 'msg91_template_id=';
    if (lower.startsWith(prefix)) {
        t = t.slice(prefix.length).trim();
    }
    return t;
}

function isPlaceholderTemplateId(templateId) {
    if (!templateId || typeof templateId !== 'string') return true;
    const t = normalizeTemplateId(templateId).toLowerCase();
    return (
        t === '' ||
        t === 'pending' ||
        t.includes('your_') ||
        t.includes('_here') ||
        t.includes('template_id')
    );
}

function isTemplatePending(templateId, templateStatus) {
    const status = String(templateStatus || '').trim().toLowerCase();
    if (status === 'pending' || status === 'submitted' || status === 'review') return true;
    return isPlaceholderTemplateId(templateId);
}

/** Read MSG91 settings from environment (restart-safe — reads process.env each call). */
function getMsg91Config() {
    return {
        authKey: (process.env.MSG91_AUTH_KEY || '').trim(),
        templateId: normalizeTemplateId(process.env.MSG91_TEMPLATE_ID),
        templateStatus: (process.env.MSG91_TEMPLATE_STATUS || '').trim(),
        senderId: (
            process.env.MSG91_SENDER_ID ||
            process.env.MSG91_SENDER ||
            process.env.MSG91_SENDERID ||
            ''
        ).trim(),
        route: (process.env.MSG91_ROUTE || '4').trim(),
        flowId: (process.env.MSG91_FLOW_ID || '').trim(),
        flowOtpVar: (process.env.MSG91_FLOW_OTP_VAR || 'VAR1').trim() || 'VAR1',
        otpUrl: process.env.MSG91_OTP_URL || 'https://control.msg91.com/api/v5/otp',
        flowUrl: process.env.MSG91_FLOW_URL || 'https://api.msg91.com/api/v5/flow/',
        smsTestMode: process.env.SMS_TEST_MODE === 'true'
    };
}

/**
 * Validate MSG91 env before sending OTP. Returns clear error codes (never throws).
 * @returns {{ ok: true, cfg: object, pendingTemplateDev?: boolean } | { ok: false, code: string, message: string }}
 */
function validateMsg91ForOtpSend() {
    const cfg = getMsg91Config();

    if (isPlaceholderAuthKey(cfg.authKey)) {
        return {
            ok: false,
            code: 'MSG91_AUTH_KEY_MISSING',
            message:
                'MSG91_AUTH_KEY is not configured. Add it to backend/.env (or Render env vars) and restart the server.'
        };
    }

    if (!cfg.senderId) {
        return {
            ok: false,
            code: 'MSG91_SENDER_ID_MISSING',
            message:
                'MSG91_SENDER_ID is not configured. Add your DLT-approved sender ID to backend/.env and restart.'
        };
    }

    const flowOk = !!cfg.flowId;
    const templatePending = isTemplatePending(cfg.templateId, cfg.templateStatus);

    if (!flowOk) {
        if (templatePending) {
            if (isDevEnvironment()) {
                return {
                    ok: true,
                    cfg,
                    pendingTemplateDev: true,
                    code: 'MSG91_TEMPLATE_PENDING',
                    message:
                        'OTP template is pending approval. SMS was not sent; OTP is logged on the server console for development testing only.'
                };
            }
            return {
                ok: false,
                code: 'MSG91_TEMPLATE_PENDING',
                message: 'OTP template is pending approval. SMS cannot be sent until DLT template is approved.'
            };
        }

        if (!cfg.templateId) {
            return {
                ok: false,
                code: 'MSG91_TEMPLATE_MISSING',
                message:
                    'MSG91_TEMPLATE_ID is not configured. Add your DLT-approved template ID to backend/.env and restart.'
            };
        }
    }

    return { ok: true, cfg };
}

/** Fetch MSG91 SMS credits for route (returns null if check fails). */
async function fetchMsg91Balance(route = '4') {
    const cfg = getMsg91Config();
    if (isPlaceholderAuthKey(cfg.authKey)) return null;

    try {
        const response = await axios.get('https://control.msg91.com/api/balance.php', {
            params: { type: String(route || cfg.route || '4'), authkey: cfg.authKey },
            timeout: 12000,
            validateStatus: () => true
        });
        const raw = response.data;
        const n = Number(typeof raw === 'object' ? raw?.balance ?? raw?.msg : raw);
        return Number.isFinite(n) ? n : null;
    } catch {
        return null;
    }
}

async function warnMsg91BalanceIfLow() {
    const balance = await fetchMsg91Balance();
    if (balance == null) return { balance: null, low: false };

    console.log('📲 [MSG91] SMS balance (route 4):', balance);
    if (balance <= 0) {
        console.warn(
            '⚠️ [MSG91] SMS balance is 0 — OTP API may return success but no SMS will reach handsets. Recharge MSG91 wallet.'
        );
        return { balance, low: true };
    }
    return { balance, low: false };
}

function validateMsg91Config() {
    const cfg = getMsg91Config();
    const warnings = [];
    const missing = [];

    const authOk = !isPlaceholderAuthKey(cfg.authKey);
    if (!authOk) missing.push('MSG91_AUTH_KEY');

    const flowOk = !!cfg.flowId;
    const templatePending = isTemplatePending(cfg.templateId, cfg.templateStatus);
    const templateOk = !!cfg.templateId && !templatePending;

    if (authOk && !flowOk) {
        if (templatePending) {
            warnings.push(
                'MSG91 DLT template is pending approval. OTP SMS will not be sent until MSG91_TEMPLATE_ID is approved.'
            );
        } else if (!cfg.templateId) {
            missing.push('MSG91_TEMPLATE_ID');
        }
    }

    if (authOk && !cfg.senderId) {
        missing.push('MSG91_SENDER_ID');
    }

    if (authOk && cfg.route && !/^\d+$/.test(cfg.route)) {
        warnings.push(`MSG91_ROUTE "${cfg.route}" is unusual — India transactional OTP typically uses route 4.`);
    }

    if (cfg.smsTestMode) {
        warnings.push('SMS_TEST_MODE=true — OTP API succeeds but no SMS is sent to handsets.');
    }

    const readyForDelivery =
        authOk && !!cfg.senderId && (templateOk || flowOk) && !cfg.smsTestMode;

    return {
        cfg,
        authOk,
        templateOk,
        templatePending,
        flowOk,
        readyForDelivery,
        warnings,
        missing,
        diagnostics: {
            authKeySet: authOk,
            templateId: cfg.templateId || null,
            templateStatus: cfg.templateStatus || null,
            templatePending,
            senderId: cfg.senderId || null,
            route: cfg.route,
            flowId: cfg.flowId || null,
            otpUrl: cfg.otpUrl,
            smsTestMode: cfg.smsTestMode,
            readyForDelivery
        }
    };
}

function logMsg91StartupValidation() {
    const v = validateMsg91Config();
    const { cfg } = v;

    console.log('='.repeat(60));
    console.log('📲 [MSG91] Startup configuration (from .env — secrets never logged in full)');
    console.log('📲 [MSG91] MSG91_AUTH_KEY:', v.authOk ? '[set]' : '[missing / placeholder]');
    console.log('📲 [MSG91] MSG91_TEMPLATE_ID:', cfg.templateId || '[not set]');
    console.log('📲 [MSG91] MSG91_TEMPLATE_STATUS:', cfg.templateStatus || '[not set]');
    console.log('📲 [MSG91] MSG91_SENDER_ID:', cfg.senderId || '[not set]');
    console.log('📲 [MSG91] MSG91_ROUTE:', cfg.route || '[not set]');
    console.log('📲 [MSG91] MSG91_FLOW_ID:', cfg.flowId || '[not set — using OTP API]');
    console.log('📲 [MSG91] SMS_TEST_MODE:', cfg.smsTestMode ? 'true (no handset SMS)' : 'false / unset');
    console.log('📲 [MSG91] Ready for OTP delivery:', v.readyForDelivery ? 'YES' : 'NO');

    if (v.templatePending && v.authOk) {
        console.warn(
            '⚠️ [MSG91] OTP template is pending approval — server continues. ' +
                'In development, OTP will be logged on the server console only.'
        );
    }

    v.warnings.forEach((w) => console.warn(`⚠️ [MSG91] ${w}`));
    if (v.missing.length) {
        console.warn(`⚠️ [MSG91] Missing for live delivery: ${v.missing.join(', ')}`);
    }
    console.log('='.repeat(60));

    return v;
}

/** Log OTP to server console in development only — never call in production responses. */
function logDevOtpConsole(otp, context = 'OTP') {
    if (!isDevEnvironment()) return;
    console.log(`🧪 [${context}] Development OTP (console only, not sent in API response): ${otp}`);
}

const MSG91_LOG_SECRET_KEYS = new Set([
    'authkey',
    'auth_key',
    'authorization',
    'otp',
    'password',
    'token',
    'secret'
]);

/** Redact secrets from MSG91 payloads before logging (never log auth keys or OTP). */
function sanitizeMsg91ForLog(value, depth = 0) {
    if (value == null || depth > 8) return value;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeMsg91ForLog(item, depth + 1));
    }
    if (typeof value !== 'object') return value;

    const out = {};
    for (const [key, raw] of Object.entries(value)) {
        const k = key.toLowerCase();
        if (MSG91_LOG_SECRET_KEYS.has(k)) {
            out[key] = '[redacted]';
        } else if (typeof raw === 'object' && raw !== null) {
            out[key] = sanitizeMsg91ForLog(raw, depth + 1);
        } else {
            out[key] = raw;
        }
    }
    return out;
}

function logMsg91Response(label, httpStatus, data) {
    const safe = sanitizeMsg91ForLog(data || {});
    console.log(`📥 [MSG91] ${label} HTTP status:`, httpStatus);
    console.log(`📥 [MSG91] ${label} Response:`, JSON.stringify(safe, null, 2));
}

module.exports = {
    getMsg91Config,
    validateMsg91Config,
    validateMsg91ForOtpSend,
    logMsg91StartupValidation,
    logDevOtpConsole,
    logMsg91Response,
    sanitizeMsg91ForLog,
    fetchMsg91Balance,
    warnMsg91BalanceIfLow,
    isDevEnvironment,
    isPlaceholderAuthKey,
    isPlaceholderTemplateId,
    isTemplatePending,
    maskSecret,
    normalizeTemplateId
};
