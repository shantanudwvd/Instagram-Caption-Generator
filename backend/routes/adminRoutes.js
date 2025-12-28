const express = require('express');
const router = express.Router();
const CaptionLearningService = require('../services/captionLearningService');
const captionLearningService = new CaptionLearningService();
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

    // API key is valid, proceed
    next();
};

// Apply the middleware to all admin routes
router.use(checkAdminApiKey);

// Get dashboard statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await captionLearningService.getDashboardStats();
        res.json(stats);
    } catch (error) {
        logger.error('Error getting dashboard stats', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to get dashboard statistics' });
    }
});

// Get fine-tuning jobs
router.get('/fine-tuning-jobs', async (req, res) => {
    try {
        const jobs = await captionLearningService.getFineTuningJobs();
        res.json(jobs);
    } catch (error) {
        logger.error('Error getting fine-tuning jobs', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to get fine-tuning jobs' });
    }
});

// Generate training data
router.post('/generate-training-data', async (req, res) => {
    try {
        const { minFeedbackCount, minRating, limit, includeEdits } = req.body;

        const trainingData = await captionLearningService.generateTrainingData({
            minFeedbackCount,
            minRating,
            limit,
            includeEdits
        });

        res.json({
            success: true,
            count: trainingData.length,
            trainingData: trainingData.slice(0, 50) // Return a subset to avoid large responses
        });
    } catch (error) {
        logger.error('Error generating training data', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to generate training data' });
    }
});

// Start fine-tuning process
router.post('/finetune-model', async (req, res) => {
    try {
        const { trainingOptions, baseModel, epochs } = req.body;

        const result = await captionLearningService.finetuneModel({
            trainingOptions,
            baseModel,
            epochs
        });

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        logger.error('Error starting fine-tuning', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to start fine-tuning process' });
    }
});

// Check fine-tuning job status
router.get('/finetune-status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;

        const status = await captionLearningService.checkFineTuningStatus(jobId);
        res.json(status);
    } catch (error) {
        logger.error('Error checking fine-tuning status', {
            error: error.message,
            stack: error.stack,
            jobId: req.params.jobId
        });
        res.status(500).json({ error: 'Failed to check fine-tuning status' });
    }
});

// Get latest fine-tuned model
router.get('/latest-model', async (req, res) => {
    try {
        const model = await captionLearningService.getLatestFineTunedModel();
        res.json({ model });
    } catch (error) {
        logger.error('Error getting latest model', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to get latest fine-tuned model' });
    }
});

module.exports = router;
