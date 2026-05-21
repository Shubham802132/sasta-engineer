const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { getOnlineFixers } = require('../controllers/presenceController');

const router = express.Router();

router.get('/online', protect, authorize('user', 'admin'), getOnlineFixers);

module.exports = router;
