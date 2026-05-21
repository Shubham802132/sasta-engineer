const Fixer = require('../models/fixer');
const {
    getStaleCutoffDate,
    touchFixerHeartbeat,
    setFixerOffline,
    setFixerOnline,
    mapOnlineFixer,
    markStaleFixersOffline
} = require('../utils/presenceService');

// @desc    List currently online fixers
// @route   GET /api/fixers/online
// @access  Private (user)
const getOnlineFixers = async (req, res) => {
    try {
        await markStaleFixersOffline();

        const cutoff = getStaleCutoffDate();
        const fixers = await Fixer.find({
            isActive: true,
            isOnline: true,
            lastSeen: { $gte: cutoff }
        })
            .select('-password -resetPasswordToken -resetPasswordExpire')
            .sort({ lastSeen: -1 })
            .limit(50);

        res.status(200).json({
            success: true,
            count: fixers.length,
            data: fixers.map(mapOnlineFixer)
        });
    } catch (error) {
        console.error('getOnlineFixers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch online fixers'
        });
    }
};

// @desc    Fixer heartbeat (stay online while active)
// @route   POST /api/fixers/presence/heartbeat
// @access  Private (fixer)
const fixerHeartbeat = async (req, res) => {
    try {
        const fixer = await touchFixerHeartbeat(req.user.id);
        if (!fixer) {
            return res.status(404).json({ success: false, message: 'Fixer not found' });
        }
        res.status(200).json({
            success: true,
            data: { isOnline: true, lastSeen: fixer.lastSeen }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Heartbeat failed' });
    }
};

// @desc    Fixer goes offline (logout / tab close)
// @route   POST /api/fixers/presence/offline
// @access  Private (fixer)
const fixerGoOffline = async (req, res) => {
    try {
        await setFixerOffline(req.user.id);
        res.status(200).json({ success: true, message: 'Marked offline' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to set offline' });
    }
};

module.exports = {
    getOnlineFixers,
    fixerHeartbeat,
    fixerGoOffline,
    setFixerOnline,
    setFixerOffline
};
