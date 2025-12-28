const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const CaptionLearningService = require('../services/captionLearningService');
const captionLearningService = new CaptionLearningService();
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

        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'User authentication required' });
        }

        // Add client info for analytics
        const feedback = {
            userId: req.user.id,
            rating,
            comments,
            userEdits,
            userAgent: req.headers['user-agent'],
            ipHash: hashIP(req.ip) // Anonymize IP
        };

        const success = await captionLearningService.recordFeedback(captionId, feedback);

        res.json({ success });
    } catch (error) {
        logger.error('Error recording feedback', {
            error: error.message,
            stack: error.stack,
            captionId: req.params.captionId,
            userId: req.user?.id
        });
        res.status(500).json({ error: 'Failed to record feedback' });
    }
});

// Function to hash IP addresses for privacy
function hashIP(ip) {
    // Use a salt from environment variable for added security
    const salt = process.env.IP_HASH_SALT || 'default-salt';

    return crypto
        .createHash('sha256')
        .update(ip + salt)
        .digest('hex')
        .substring(0, 16); // Only keep a portion to further anonymize
}

module.exports = router;
