const express = require('express');
const router = express.Router();
const captionLearningService = require('../services/captionLearningServiceInstance');
const logger = require('../utils/logger');

// Middleware to check admin API key
const checkAdminApiKey = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing API key' });
    }

    const apiKey = authHeader.split(' ')[1];

    // Check against the environment variable or other secure storage
    if (apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(403).json({ error: 'Forbidden: Invalid API key' });
    }

    next();
};

// Apply the admin API key middleware to all routes in this router
router.use(checkAdminApiKey);

// Fetch stats for admin dashboard
router.get('/stats', async (req, res) => {
    try {
        const stats = await captionLearningService.getAdminStats();
        res.json({ stats });
    } catch (error) {
        logger.error('Error fetching admin stats', {
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
});

// Fetch user activity summaries
router.get('/user-activity', async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const activity = await captionLearningService.getUserActivitySummaries(limit);
        res.json({ activity });
    } catch (error) {
        logger.error('Error fetching user activity', {
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({ error: 'Failed to fetch user activity' });
    }
});

// Trigger model fine-tuning
router.post('/fine-tune', async (req, res) => {
    try {
        const { trainingOptions, baseModel, epochs } = req.body;
        const result = await captionLearningService.finetuneModel({
            trainingOptions,
            baseModel,
            epochs,
        });

        res.json({ success: true, result });
    } catch (error) {
        logger.error('Error starting fine-tuning job', {
            error: error.message,
            stack: error.stack,
        });
        res.status(500).json({ error: 'Failed to start fine-tuning job' });
    }
});

module.exports = router;
