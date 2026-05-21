const Fixer = require('../models/fixer');

const PRESENCE_TTL_MS =
    parseInt(process.env.PRESENCE_TTL_MS, 10) || 90 * 1000;
const JANITOR_INTERVAL_MS =
    parseInt(process.env.PRESENCE_JANITOR_MS, 10) || 60 * 1000;

function getStaleCutoffDate() {
    return new Date(Date.now() - PRESENCE_TTL_MS);
}

async function setFixerOnline(fixerId) {
    const now = new Date();
    return Fixer.findByIdAndUpdate(
        fixerId,
        { isOnline: true, lastSeen: now },
        { new: true }
    );
}

async function setFixerOffline(fixerId) {
    return Fixer.findByIdAndUpdate(
        fixerId,
        { isOnline: false, lastSeen: new Date() },
        { new: true }
    );
}

async function touchFixerHeartbeat(fixerId) {
    const now = new Date();
    return Fixer.findByIdAndUpdate(
        fixerId,
        { isOnline: true, lastSeen: now },
        { new: true }
    );
}

async function markStaleFixersOffline() {
    const cutoff = getStaleCutoffDate();
    const result = await Fixer.updateMany(
        { isOnline: true, lastSeen: { $lt: cutoff } },
        { $set: { isOnline: false } }
    );
    return result.modifiedCount || 0;
}

function mapOnlineFixer(fixer) {
    const city = fixer.address?.city || '';
    const state = fixer.address?.state || '';
    const location = [city, state].filter(Boolean).join(', ') || 'Location not set';

    return {
        id: fixer._id,
        name: fixer.name,
        profileImage: fixer.documents?.profilePicture || '',
        serviceType: fixer.serviceCategory || 'General Repair',
        serviceCategory: fixer.serviceCategory || 'General Repair',
        rating: {
            average: fixer.rating?.average ?? 0,
            totalReviews: fixer.rating?.totalReviews ?? 0
        },
        experience: fixer.professionalInfo?.experience ?? 0,
        location,
        isOnline: true,
        lastSeen: fixer.lastSeen
    };
}

let janitorTimer = null;

function startPresenceJanitor() {
    if (janitorTimer) return;
    janitorTimer = setInterval(async () => {
        try {
            const n = await markStaleFixersOffline();
            if (n > 0 && process.env.NODE_ENV !== 'production') {
                console.log(`[presence] marked ${n} stale fixer(s) offline`);
            }
        } catch (err) {
            console.error('[presence] janitor error:', err.message);
        }
    }, JANITOR_INTERVAL_MS);
}

module.exports = {
    PRESENCE_TTL_MS,
    getStaleCutoffDate,
    setFixerOnline,
    setFixerOffline,
    touchFixerHeartbeat,
    markStaleFixersOffline,
    mapOnlineFixer,
    startPresenceJanitor
};
