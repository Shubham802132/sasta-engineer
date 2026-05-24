#!/usr/bin/env node
/**
 * Diagnose MSG91 OTP delivery — tries common DLT fixes without logging auth keys.
 * Usage: node scripts/msg91-diagnose.js [mobile10digits]
 */
const path = require('path');
const axios = require('axios');

require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const { getMsg91Config, sanitizeMsg91ForLog } = require('../src/config/msg91');

const phone10 = (process.argv[2] || '7019277781').replace(/\D/g, '').slice(-10);
const mobile91 = `91${phone10}`;
const otp = String(Math.floor(100000 + Math.random() * 900000));
const cfg = getMsg91Config();

async function callVariant(name, url, headers = {}) {
    console.log(`\n--- ${name} ---`);
    const safeUrl = url.replace(/otp=\d+/g, 'otp=[redacted]');
    console.log('URL:', safeUrl);
    try {
        const res = await axios.post(url, {}, {
            headers: {
                authkey: cfg.authKey,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...headers
            },
            timeout: 25000,
            validateStatus: () => true
        });
        console.log('HTTP:', res.status);
        console.log('Body:', JSON.stringify(sanitizeMsg91ForLog(res.data || {}), null, 2));
        return res.data;
    } catch (err) {
        console.log('Error:', err.message);
        return null;
    }
}

(async () => {
    console.log('MSG91 diagnose');
    console.log('Mobile:', mobile91);
    console.log('Template:', cfg.templateId);
    console.log('Sender (.env):', cfg.senderId);
    console.log('Route:', cfg.route);

    const base = cfg.otpUrl;

    // 1) Current production-style call (sender + route + custom otp)
    const p1 = new URLSearchParams({
        template_id: cfg.templateId,
        mobile: mobile91,
        otp,
        otp_length: '6',
        otp_expiry: '10',
        sender: cfg.senderId,
        route: cfg.route
    });
    await callVariant('A: template + sender + route + custom otp', `${base}?${p1}`);

    // 2) Template only (v5 recommended — sender from template)
    const p2 = new URLSearchParams({
        template_id: cfg.templateId,
        mobile: mobile91,
        otp,
        otp_length: '6',
        otp_expiry: '10'
    });
    await callVariant('B: template only (no sender/route)', `${base}?${p2}`);

    // 3) FIXGHAR sender (config.env default — common DLT header)
    const p3 = new URLSearchParams({
        template_id: cfg.templateId,
        mobile: mobile91,
        otp,
        otp_length: '6',
        otp_expiry: '10',
        sender: 'FIXGHAR'
    });
    await callVariant('C: template + FIXGHAR sender', `${base}?${p3}`);

    // 4) Let MSG91 generate OTP (no otp param)
    const p4 = new URLSearchParams({
        template_id: cfg.templateId,
        mobile: mobile91,
        otp_length: '6',
        otp_expiry: '10'
    });
    await callVariant('D: MSG91-generated OTP (no custom otp)', `${base}?${p4}`);

    // 5) Flow API if configured
    if (cfg.flowId) {
        console.log('\n--- E: Flow API ---');
        const payload = {
            flow_id: cfg.flowId,
            sender: cfg.senderId || undefined,
            recipients: [{ mobiles: mobile91, [cfg.flowOtpVar]: otp }]
        };
        try {
            const res = await axios.post(cfg.flowUrl, payload, {
                headers: {
                    authkey: cfg.authKey,
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                timeout: 25000,
                validateStatus: () => true
            });
            console.log('HTTP:', res.status);
            console.log('Body:', JSON.stringify(sanitizeMsg91ForLog(res.data || {}), null, 2));
        } catch (err) {
            console.log('Error:', err.message);
        }
    } else {
        console.log('\n--- E: Flow API skipped (MSG91_FLOW_ID not set) ---');
    }

    console.log('\nCheck phone for SMS. Compare MSG91 dashboard Failed Logs if none arrive.');
})();
