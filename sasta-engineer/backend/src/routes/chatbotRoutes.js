// Chatbot Routes for FIXGHAR AI Assistant
const express = require('express');
const router = express.Router();
const {
    chatWithAI,
    getQuickActions,
    getChatbotInfo,
    saveConversation
} = require('../controllers/chatbotController');

// Chat with AI assistant
router.post('/chat', chatWithAI);

// Get quick actions/suggestions
router.get('/quick-actions', getQuickActions);

// Get chatbot information
router.get('/info', getChatbotInfo);

// Save chat conversation
router.post('/save-conversation', saveConversation);

// Health check for chatbot service
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'FIXGHAR AI Chatbot is running!',
        timestamp: new Date().toISOString(),
        status: 'online',
        version: '1.0.0'
    });
});

module.exports = router;


