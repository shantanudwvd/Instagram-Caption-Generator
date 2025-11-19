const express = require('express');
const router = express.Router();
const CaptionLearningService = require('../services/captionLearningService');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const captionLearningService = new CaptionLearningService();

router.use(authMiddleware);

router.get('/overview', async (req, res) => {
    try {
        const stats = await captionLearningService.getDashboardStats();
        const recentCaptions = await captionLearningService.getRecentCaptions(5);

        res.json({
            user: req.user,
            stats,
            recentCaptions
        });
    } catch (error) {
        logger.error('Error loading dashboard overview:', error);
        res.status(500).json({ error: 'Failed to load dashboard overview' });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const stats = await captionLearningService.getDashboardStats();
        res.json(stats);
    } catch (error) {
        logger.error('Error loading dashboard stats:', error);
        res.status(500).json({ error: 'Failed to load dashboard stats' });
    }
});

module.exports = router;
