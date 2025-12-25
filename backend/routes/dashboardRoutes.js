const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const CaptionLearningService = require('../services/captionLearningService');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const captionLearningService = new CaptionLearningService();

router.use(authMiddleware);

router.get('/overview', async (req, res) => {
    try {
        const stats = await captionLearningService.getDashboardStats(req.user.id);
        const recentCaptions = await captionLearningService.getRecentCaptions(5, req.user.id);

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
        const stats = await captionLearningService.getDashboardStats(req.user.id);
        res.json(stats);
    } catch (error) {
        logger.error('Error loading dashboard stats:', error);
        res.status(500).json({ error: 'Failed to load dashboard stats' });
    }
});

router.get('/captions', async (req, res) => {
    try {
        const filters = {
            userId: req.user.id,
            search: req.query.search || '',
            tone: req.query.tone || '',
            length: req.query.length || '',
            sortBy: req.query.sortBy || 'createdAt',
            sortOrder: req.query.sortOrder || 'desc',
            limit: req.query.limit || 50,
            offset: req.query.offset || 0
        };

        const result = await captionLearningService.getFilteredCaptions(filters);
        res.json(result);
    } catch (error) {
        logger.error('Error loading filtered captions:', error);
        res.status(500).json({ error: 'Failed to load captions' });
    }
});

router.get('/images/:imageId', async (req, res) => {
    try {
        const imageId = req.params.imageId;
        const imagePath = path.join(process.cwd(), 'uploads', 'captions', imageId);

        // Security: Check if file exists and is within uploads directory
        if (!fs.existsSync(imagePath)) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Security: Prevent directory traversal
        const resolvedPath = path.resolve(imagePath);
        const uploadsPath = path.resolve(path.join(process.cwd(), 'uploads', 'captions'));
        if (!resolvedPath.startsWith(uploadsPath)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Set appropriate content type
        const ext = path.extname(imageId).toLowerCase();
        const contentTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        };
        const contentType = contentTypes[ext] || 'image/jpeg';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

        // Stream the file
        const fileStream = fs.createReadStream(imagePath);
        fileStream.pipe(res);
    } catch (error) {
        logger.error('Error serving image:', error);
        res.status(500).json({ error: 'Failed to serve image' });
    }
});

module.exports = router;
