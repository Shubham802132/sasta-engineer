#!/usr/bin/env node
/**
 * Verify MSG91 env configuration and optionally dry-run phone normalization.
 * Usage: node scripts/verify-msg91.js [phone]
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const { logMsg91StartupValidation, validateMsg91Config } = require('../src/config/msg91');
const smsService = require('../src/utils/smsService');

const phoneArg = process.argv[2] || '9876543210';

console.log('\n🔍 FIXGHAR MSG91 verification\n');

const validation = logMsg91StartupValidation();

if (phoneArg) {
    const norm = smsService.normalizeIndianToE164(phoneArg);
    console.log('📱 Phone normalize test:', phoneArg);
    console.log('   → E.164:', norm.ok ? norm.e164 : norm.error);
    if (norm.ok) {
        console.log('   → MSG91 mobile:', `91${norm.digits10}`);
    }
}

const otp = smsService.generateOTP();
console.log('\n🧪 OTP generation test: 6-digit code generated:', /^\d{6}$/.test(otp) ? 'OK' : 'FAIL');

if (process.env.SMS_TEST_MODE === 'true') {
    console.log('\nℹ️  SMS_TEST_MODE=true — skipping live SMS send (expected in dev).');
} else if (!validation.readyForDelivery) {
    console.log('\n⚠️  MSG91 not ready for live delivery — fix env vars before testing real SMS.');
} else {
    console.log('\n✅ MSG91 config looks ready. Test signup/resend-otp API to send live SMS.');
}

console.log('\nDiagnostics JSON:', JSON.stringify(validation.diagnostics, null, 2));
process.exit(validation.authOk ? 0 : 1);
