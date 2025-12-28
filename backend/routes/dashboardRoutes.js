const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const captionLearningService = require('../services/captionLearningServiceInstance');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(authMiddleware);

router.get('/overview', async (req, res) => {
    try {
        const stats = await captionLearningService.getDashboardStats(req.user.id);
        const recentCaptions = await captionLearningService.getRecentCaptions(5, req.user.id);

        res.json({
            user: req.user,
            stats,
            recentCaptions,
        });
    } catch (error) {
        logger.error('Error fetching dashboard overview', {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
        });
        res.status(500).json({ error: 'Failed to fetch dashboard overview' });
    }
});

router.get('/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 10;
        const recentCaptions = await captionLearningService.getRecentCaptions(limit, req.user.id);
        res.json({ recentCaptions });
    } catch (error) {
        logger.error('Error fetching recent captions', {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
        });
        res.status(500).json({ error: 'Failed to fetch recent captions' });
    }
});

// Export captions as CSV (basic implementation)
router.get('/export', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 100;
        const captions = await captionLearningService.getRecentCaptions(limit, req.user.id);

        const csvHeader = 'caption,createdAt,avgRating,feedbackCount\n';
        const csvRows = captions
            .map((c) => {
                const captionSafe = (c.caption || '').replace(/"/g, '""');
                return `"${captionSafe}",${c.createdAt?.toISOString?.() || ''},${c.avgRating || 0},${c.feedbackCount || 0}`;
            })
            .join('\n');

        const csvContent = csvHeader + csvRows;
        const filePath = path.join(process.cwd(), 'exports', `captions_${Date.now()}.csv`);
        const dirName = path.dirname(filePath);
        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName, { recursive: true });
        }
        fs.writeFileSync(filePath, csvContent);

        res.download(filePath, (err) => {
            if (err) {
                logger.error('Error sending export file', { error: err.message, stack: err.stack });
            }
            // Clean up the file after sending
            fs.unlink(filePath, () => {});
        });
    } catch (error) {
        logger.error('Error exporting captions', {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
        });
        res.status(500).json({ error: 'Failed to export captions' });
    }
});

module.exports = router;
