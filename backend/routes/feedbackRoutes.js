const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const captionLearningService = require('../services/captionLearningServiceInstance');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(authMiddleware);

// Submit feedback for a caption
router.post('/caption-feedback/:captionId', async (req, res) => {
    try {
        const { captionId } = req.params;
        const { rating, comments, userEdits } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Valid rating (1-5) is required' });
        }

        const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
        const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex');

        await captionLearningService.recordFeedback(captionId, {
            rating,
            comments,
            userEdits,
            userId: req.user.id,
            userAgent: req.headers['user-agent'],
            ipHash,
        });

        res.json({ success: true });
    } catch (error) {
        logger.error('Error submitting caption feedback', {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
            captionId: req.params.captionId,
        });
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

module.exports = router;
