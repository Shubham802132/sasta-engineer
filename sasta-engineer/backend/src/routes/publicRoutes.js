const express = require('express');
const mongoose = require('mongoose');
const Fixer = require('../models/fixer');
const Booking = require('../models/booking');

const router = express.Router();
const isProd = process.env.NODE_ENV === 'production';

router.get('/fixers/service-requests', async (req, res) => {
    try {
        const serviceRequests = await Booking.find({
            $or: [{ fixer: { $exists: false } }, { fixer: null }],
            status: { $in: ['pending', 'confirmed', 'new'] }
        })
            .populate('user', 'name email phone')
            .populate('service', 'name description')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: 'Service requests retrieved successfully',
            data: serviceRequests
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

router.get('/fixers', async (req, res) => {
    try {
        const fixers = await Fixer.find({ isActive: true })
            .select('-password -resetPasswordToken -resetPasswordExpire')
            .sort({ 'rating.average': -1, 'rating.totalReviews': -1 })
            .limit(20);

        if (fixers.length > 0) {
            return res.json({
                success: true,
                count: fixers.length,
                data: fixers.map(mapFixerPublic)
            });
        }

        if (isProd) {
            return res.json({ success: true, count: 0, data: [] });
        }

        return res.json({ success: true, count: 0, data: [], message: 'No fixers in database' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching fixers', error: error.message });
    }
});

router.get('/fixers/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (mongoose.Types.ObjectId.isValid(id)) {
            const fixer = await Fixer.findById(id).select(
                '-password -resetPasswordToken -resetPasswordExpire'
            );
            if (fixer && fixer.isActive) {
                return res.json({ success: true, data: mapFixerPublic(fixer, true) });
            }
        }

        return res.status(404).json({ success: false, message: 'Fixer not found' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching fixer details', error: error.message });
    }
});

router.get('/service-requests', async (req, res) => {
    try {
        const serviceRequests = await Booking.find({
            $or: [{ fixer: { $exists: false } }, { fixer: null }],
            status: { $in: ['pending', 'confirmed', 'new'] }
        })
            .populate('user', 'name email phone')
            .populate('service', 'name description')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: 'Service requests retrieved successfully',
            data: serviceRequests
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

function mapFixerPublic(fixer, detailed = false) {
    const base = {
        id: fixer._id,
        name: fixer.name || 'Unknown Fixer',
        email: fixer.email,
        phone: fixer.phone,
        serviceCategory: fixer.serviceCategory || 'General Repair',
        experience: fixer.professionalInfo?.experience || 0,
        hourlyRate: fixer.pricing?.hourlyRate || 0,
        address: fixer.address || { city: 'Location not set' },
        isOnline: fixer.isOnline || false,
        rating: fixer.rating || { average: 0, totalReviews: 0 },
        profileImage: fixer.documents?.profilePicture || '',
        username: fixer.username,
        isActive: fixer.isActive,
        bio: fixer.professionalInfo?.bio || 'Professional service provider',
        skills: fixer.professionalInfo?.skills || ['General Repair']
    };

    if (detailed) {
        return {
            ...base,
            professionalInfo: fixer.professionalInfo,
            pricing: fixer.pricing,
            availability: fixer.availability,
            documents: fixer.documents,
            createdAt: fixer.createdAt,
            updatedAt: fixer.updatedAt
        };
    }

    return base;
}

module.exports = router;
