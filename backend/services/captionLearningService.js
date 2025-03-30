const { MongoClient, ObjectId } = require('mongodb');
const OpenAI = require('openai');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

dotenv.config();

/**
 * Service to handle caption feedback and learning
 * Production-ready implementation with proper error handling,
 * connection pooling, and retry mechanisms
 */
class CaptionLearningService {
    constructor() {
        this.dbClient = null;
        this.dbName = process.env.MONGODB_NAME || 'caption_generator';
        this.captionCollection = 'captions';
        this.feedbackCollection = 'caption_feedback';
        this.trainingDataCollection = 'training_data';
        this.fineTuningCollection = 'fine_tuning_jobs';

        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // Connection options for production
        this.connectionOptions = {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000
        };

        // Initialize connection
        this._initializeConnection();
    }

    /**
     * Initialize MongoDB connection with retry mechanism
     * @private
     */
    async _initializeConnection() {
        if (this.dbClient) return;

        const maxRetries = 5;
        let retries = 0;
        let connected = false;

        while (!connected && retries < maxRetries) {
            try {
                this.dbClient = new MongoClient(process.env.MONGODB_URI, this.connectionOptions);
                await this.dbClient.connect();
                logger.info('Connected to MongoDB for caption learning');

                // Add connection event handlers
                this.dbClient.on('error', (error) => {
                    logger.error('MongoDB connection error:', error);
                    this._handleConnectionError();
                });

                this.dbClient.on('timeout', () => {
                    logger.warn('MongoDB connection timeout');
                    this._handleConnectionError();
                });

                this.dbClient.on('close', () => {
                    logger.warn('MongoDB connection closed');
                    this._handleConnectionError();
                });

                // Test the connection
                await this.dbClient.db('admin').command({ ping: 1 });
                connected = true;

                // Set up indexes for better performance
                await this._setupIndexes();

            } catch (error) {
                retries++;
                logger.error(`MongoDB connection attempt ${retries} failed:`, error);

                if (retries >= maxRetries) {
                    logger.error('Max MongoDB connection retries reached. Giving up.');
                    throw new Error('Failed to connect to MongoDB after multiple attempts');
                }

                // Wait before retry (exponential backoff)
                const waitTime = Math.min(1000 * Math.pow(2, retries), 30000);
                logger.info(`Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    /**
     * Handle connection errors with reconnection logic
     * @private
     */
    _handleConnectionError() {
        if (this.reconnecting) return;
        this.reconnecting = true;

        logger.info('Attempting to reconnect to MongoDB...');

        setTimeout(async () => {
            try {
                if (this.dbClient) {
                    await this.dbClient.close(true);
                }
                this.dbClient = null;
                await this._initializeConnection();
                this.reconnecting = false;
            } catch (error) {
                logger.error('Failed to reconnect to MongoDB:', error);
                this.reconnecting = false;
                // Schedule another reconnection attempt
                setTimeout(() => this._handleConnectionError(), 5000);
            }
        }, 5000);
    }

    /**
     * Set up database indexes for performance
     * @private
     */
    async _setupIndexes() {
        try {
            const db = this.getDb();

            // Captions collection indexes
            await db.collection(this.captionCollection).createIndex({ createdAt: -1 });
            await db.collection(this.captionCollection).createIndex({ avgRating: -1 });
            await db.collection(this.captionCollection).createIndex({ feedbackCount: -1 });

            // Feedback collection indexes
            await db.collection(this.feedbackCollection).createIndex({ captionId: 1 });
            await db.collection(this.feedbackCollection).createIndex({ timestamp: -1 });

            // Fine-tuning collection indexes
            await db.collection(this.fineTuningCollection).createIndex({ createdAt: -1 });
            await db.collection(this.fineTuningCollection).createIndex({ status: 1 });

            logger.info('MongoDB indexes set up successfully');
        } catch (error) {
            logger.error('Error setting up MongoDB indexes:', error);
        }
    }

    /**
     * Get connected database instance
     * @returns {Db} MongoDB database instance
     */
    getDb() {
        if (!this.dbClient) {
            throw new Error('MongoDB client not initialized');
        }
        return this.dbClient.db(this.dbName);
    }

    /**
     * Store a generated caption with its context for future learning
     * Production-ready with validation, error handling and sanitization
     *
     * @param {Object} captionData - Caption data including context and options
     * @returns {Promise<string>} ID of the stored caption
     */
    async storeCaption(captionData) {
        if (!captionData || !captionData.caption) {
            throw new Error('Invalid caption data: caption text is required');
        }

        try {
            await this._initializeConnection();
            const db = this.getDb();
            const collection = db.collection(this.captionCollection);

            // Validate and sanitize data
            const sanitizedData = {
                caption: this._sanitizeText(captionData.caption),
                imageAnalysis: this._sanitizeText(captionData.imageAnalysis || ''),
                songAnalysis: this._sanitizeObject(captionData.songAnalysis || {}),
                userContext: this._sanitizeText(captionData.userContext || ''),
                options: this._sanitizeObject(captionData.options || {}),
                createdAt: new Date(),
                feedbackCount: 0,
                avgRating: 0,
                status: 'active',
                captionId: uuidv4() // Add a UUID for external reference
            };

            const result = await collection.insertOne(sanitizedData);

            logger.info(`Stored new caption with ID: ${result.insertedId}`);
            return result.insertedId.toString();
        } catch (error) {
            logger.error('Error storing caption:', error);
            throw new Error(`Failed to store caption: ${error.message}`);
        }
    }

    /**
     * Record user feedback on a caption
     *
     * @param {string} captionId - ID of the caption
     * @param {Object} feedback - User feedback data
     * @returns {Promise<boolean>} Success status
     */
    async recordFeedback(captionId, feedback) {
        if (!captionId) {
            throw new Error('Caption ID is required');
        }

        if (!feedback || typeof feedback.rating !== 'number' || feedback.rating < 1 || feedback.rating > 5) {
            throw new Error('Valid rating (1-5) is required');
        }

        try {
            await this._initializeConnection();
            const db = this.getDb();
            const feedbackColl = db.collection(this.feedbackCollection);
            const captionColl = db.collection(this.captionCollection);

            // Validate captionId format
            let objectId;
            try {
                objectId = new ObjectId(captionId);
            } catch (error) {
                throw new Error('Invalid caption ID format');
            }

            // Check if caption exists
            const captionDoc = await captionColl.findOne({ _id: objectId });
            if (!captionDoc) {
                throw new Error('Caption not found');
            }

            // Store the feedback with sanitized data
            const feedbackDoc = {
                captionId: objectId,
                rating: Math.min(Math.max(parseInt(feedback.rating), 1), 5), // Ensure rating is 1-5
                comments: this._sanitizeText(feedback.comments || ''),
                userEdits: this._sanitizeText(feedback.userEdits || ''),
                clientInfo: {
                    userAgent: feedback.userAgent || '',
                    ipHash: feedback.ipHash || '', // Store hashed IP for analytics
                    timestamp: new Date()
                },
                createdAt: new Date()
            };

            await feedbackColl.insertOne(feedbackDoc);

            // Update the caption's feedback stats with atomic operations
            const newFeedbackCount = captionDoc.feedbackCount + 1;
            const totalRating = (captionDoc.avgRating * captionDoc.feedbackCount) + feedback.rating;
            const newAvgRating = totalRating / newFeedbackCount;

            await captionColl.updateOne(
                { _id: objectId },
                {
                    $set: {
                        feedbackCount: newFeedbackCount,
                        avgRating: newAvgRating,
                        lastFeedbackAt: new Date()
                    },
                    $inc: { totalRatingSum: feedback.rating }
                }
            );

            logger.info(`Recorded feedback for caption ${captionId}: rating ${feedback.rating}`);
            return true;
        } catch (error) {
            logger.error('Error recording feedback:', error);
            throw new Error(`Failed to record feedback: ${error.message}`);
        }
    }

    /**
     * Generate training data from stored captions and feedback
     *
     * @param {Object} options - Options for generating training data
     * @param {number} options.minFeedbackCount - Minimum feedback count to include a caption
     * @param {number} options.minRating - Minimum average rating to include a caption
     * @param {number} options.limit - Maximum number of examples to include
     * @param {boolean} options.includeEdits - Whether to prioritize user edits
     * @returns {Promise<Array>} Array of training examples
     */
    async generateTrainingData(options = {}) {
        const {
            minFeedbackCount = 3,
            minRating = 4,
            limit = 1000,
            includeEdits = true
        } = options;

        try {
            await this._initializeConnection();
            const db = this.getDb();
            const captionColl = db.collection(this.captionCollection);
            const feedbackColl = db.collection(this.feedbackCollection);

            // Find captions with sufficient feedback and high ratings
            const highQualityCaptions = await captionColl.find({
                feedbackCount: { $gte: minFeedbackCount },
                avgRating: { $gte: minRating },
                status: 'active'
            })
                .sort({ avgRating: -1, feedbackCount: -1 })
                .limit(limit)
                .toArray();

            if (highQualityCaptions.length === 0) {
                logger.warn('No captions meet the quality criteria for training data');
                return [];
            }

            logger.info(`Found ${highQualityCaptions.length} high-quality captions for training data`);
            const trainingData = [];

            for (const caption of highQualityCaptions) {
                // Get all feedback for this caption to find user edits
                const allFeedback = await feedbackColl.find({
                    captionId: caption._id
                }).toArray();

                // Use the caption with edits if available and requested
                let finalCaption = caption.caption;
                let sourceType = 'original';

                if (includeEdits) {
                    // Get feedback with edits, sorted by rating (highest first)
                    const feedbackWithEdits = allFeedback
                        .filter(f => f.userEdits && f.userEdits.trim().length > 0)
                        .sort((a, b) => b.rating - a.rating);

                    if (feedbackWithEdits.length > 0) {
                        finalCaption = feedbackWithEdits[0].userEdits;
                        sourceType = 'user_edit';
                    }
                }

                // Build comprehensive training example
                trainingData.push({
                    context: {
                        imageAnalysis: caption.imageAnalysis,
                        songAnalysis: caption.songAnalysis,
                        userContext: caption.userContext,
                        options: caption.options
                    },
                    caption: finalCaption,
                    originalCaption: caption.caption,
                    sourceType: sourceType,
                    metrics: {
                        avgRating: caption.avgRating,
                        feedbackCount: caption.feedbackCount,
                        editCount: allFeedback.filter(f => f.userEdits && f.userEdits.trim().length > 0).length
                    },
                    captionId: caption._id.toString(),
                    createdAt: caption.createdAt
                });
            }

            // Store the training data for future use
            if (trainingData.length > 0) {
                const trainingColl = db.collection(this.trainingDataCollection);
                await trainingColl.insertOne({
                    data: trainingData,
                    createdAt: new Date(),
                    count: trainingData.length,
                    criteria: {
                        minFeedbackCount,
                        minRating,
                        limit,
                        includeEdits
                    }
                });

                logger.info(`Generated ${trainingData.length} training examples`);
            }

            return trainingData;
        } catch (error) {
            logger.error('Error generating training data:', error);
            throw new Error(`Failed to generate training data: ${error.message}`);
        }
    }

    /**
     * Fine-tune the caption generation model using collected training data
     *
     * @param {Object} options - Fine-tuning options
     * @param {Object} options.trainingOptions - Options for generating training data
     * @param {string} options.baseModel - Base model to fine-tune
     * @param {number} options.epochs - Number of epochs for fine-tuning
     * @returns {Promise<Object>} Result of the fine-tuning process
     */
    async finetuneModel(options = {}) {
        const {
            trainingOptions = {},
            baseModel = 'gpt-4o', // Use the latest model as base
            epochs = 3
        } = options;

        try {
            // Step 1: Generate training data
            logger.info('Generating training data for fine-tuning...');
            const trainingData = await this.generateTrainingData(trainingOptions);

            if (trainingData.length < 10) {
                logger.warn(`Insufficient training data: ${trainingData.length} examples (minimum 10 required)`);
                return {
                    success: false,
                    reason: 'insufficient_data',
                    count: trainingData.length
                };
            }

            // Step 2: Format data for OpenAI fine-tuning
            logger.info('Formatting training data for OpenAI fine-tuning...');
            const formattedData = trainingData.map(item => ({
                messages: [
                    {
                        role: "system",
                        content: "You are a skilled social media copywriter who creates authentic, human Instagram captions."
                    },
                    {
                        role: "user",
                        content: this._formatPrompt(item)
                    },
                    {
                        role: "assistant",
                        content: item.caption
                    }
                ]
            }));

            // Step 3: Create a temporary JSONL file for the training data
            const tempId = uuidv4();
            const tempDir = path.join(process.env.TEMP_DIR || '/tmp', 'caption-generator');

            // Ensure temp directory exists
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const tempFilePath = path.join(tempDir, `training_data_${tempId}.jsonl`);

            fs.writeFileSync(
                tempFilePath,
                formattedData.map(item => JSON.stringify(item)).join('\n')
            );

            logger.info(`Training data file created: ${tempFilePath}`);

            // Step 4: Upload the file to OpenAI
            logger.info('Uploading training data to OpenAI...');
            const file = await this.openai.files.create({
                file: fs.createReadStream(tempFilePath),
                purpose: 'fine-tune'
            });

            logger.info(`File uploaded to OpenAI: ${file.id}`);

            // Step 5: Start fine-tuning job
            const modelSuffix = `caption-generator-${new Date().toISOString().split('T')[0]}`;

            logger.info(`Starting fine-tuning job with ${trainingData.length} examples...`);
            const fineTune = await this.openai.fineTuning.jobs.create({
                training_file: file.id,
                model: baseModel,
                suffix: modelSuffix,
                hyperparameters: {
                    n_epochs: epochs
                }
            });

            logger.info(`Fine-tuning job started: ${fineTune.id}`);

            // Step 6: Clean up the temporary file
            fs.unlinkSync(tempFilePath);
            logger.info('Temporary training data file cleaned up');

            // Step 7: Store fine-tuning job information
            const db = this.getDb();
            const fineTuneColl = db.collection(this.fineTuningCollection);

            await fineTuneColl.insertOne({
                jobId: fineTune.id,
                fileId: file.id,
                status: fineTune.status,
                model: fineTune.model,
                baseModel: baseModel,
                exampleCount: trainingData.length,
                hyperparameters: {
                    n_epochs: epochs
                },
                trainingCriteria: trainingOptions,
                createdAt: new Date(),
                modelSuffix: modelSuffix
            });

            return {
                success: true,
                jobId: fineTune.id,
                fileId: file.id,
                exampleCount: trainingData.length,
                baseModel: baseModel
            };
        } catch (error) {
            logger.error('Error fine-tuning model:', error);
            return {
                success: false,
                error: error.message,
                details: error.response?.data || {}
            };
        }
    }

    /**
     * Check the status of a fine-tuning job
     *
     * @param {string} jobId - ID of the fine-tuning job
     * @returns {Promise<Object>} Status of the fine-tuning job
     */
    async checkFineTuningStatus(jobId) {
        if (!jobId) {
            throw new Error('Job ID is required');
        }

        try {
            logger.info(`Checking status of fine-tuning job: ${jobId}`);
            const job = await this.openai.fineTuning.jobs.retrieve(jobId);

            // Extract key information from the job status
            const jobStatus = {
                jobId: job.id,
                status: job.status,
                fineTunedModel: job.fine_tuned_model,
                baseModel: job.model,
                createdAt: new Date(job.created_at * 1000),
                finishedAt: job.finished_at ? new Date(job.finished_at * 1000) : null,
                trainedTokens: job.trained_tokens || 0,
                trainingFile: job.training_file,
                validationFile: job.validation_file,
                error: job.error
            };

            // Update status in database
            await this._initializeConnection();
            const db = this.getDb();
            const fineTuneColl = db.collection(this.fineTuningCollection);

            await fineTuneColl.updateOne(
                { jobId },
                {
                    $set: {
                        status: job.status,
                        finishedAt: job.finished_at ? new Date(job.finished_at * 1000) : null,
                        fineTunedModel: job.fine_tuned_model,
                        trainedTokens: job.trained_tokens || 0,
                        lastCheckedAt: new Date(),
                        error: job.error
                    }
                }
            );

            logger.info(`Fine-tuning job ${jobId} status: ${job.status}`);

            return jobStatus;
        } catch (error) {
            logger.error('Error checking fine-tuning status:', error);
            throw new Error(`Failed to check fine-tuning status: ${error.message}`);
        }
    }

    /**
     * Get all fine-tuning jobs
     *
     * @param {Object} options - Query options
     * @param {number} options.limit - Maximum number of jobs to return
     * @param {string} options.status - Filter by status
     * @returns {Promise<Array>} Array of fine-tuning jobs
     */
    async getFineTuningJobs(options = {}) {
        const {
            limit = 50,
            status = null,
            sort = { createdAt: -1 }
        } = options;

        try {
            await this._initializeConnection();
            const db = this.getDb();
            const fineTuneColl = db.collection(this.fineTuningCollection);

            // Build query based on options
            const query = {};
            if (status) {
                query.status = status;
            }

            const jobs = await fineTuneColl.find(query)
                .sort(sort)
                .limit(limit)
                .toArray();

            logger.info(`Retrieved ${jobs.length} fine-tuning jobs`);
            return jobs;
        } catch (error) {
            logger.error('Error getting fine-tuning jobs:', error);
            throw new Error(`Failed to get fine-tuning jobs: ${error.message}`);
        }
    }

    /**
     * Get the latest fine-tuned model for caption generation
     *
     * @param {Object} options - Options for getting the model
     * @param {boolean} options.onlySucceeded - Only consider succeeded jobs
     * @returns {Promise<string|null>} Model ID of the latest fine-tuned model
     */
    async getLatestFineTunedModel(options = {}) {
        const {
            onlySucceeded = true
        } = options;

        try {
            await this._initializeConnection();
            const db = this.getDb();
            const fineTuneColl = db.collection(this.fineTuningCollection);

            // Build query based on options
            const query = {};
            if (onlySucceeded) {
                query.status = 'succeeded';
                query.fineTunedModel = { $ne: null };
            }

            // Find completed fine-tuning jobs
            const completedJobs = await fineTuneColl.find(query)
                .sort({ finishedAt: -1 })
                .limit(1)
                .toArray();

            if (completedJobs.length > 0) {
                logger.info(`Found latest fine-tuned model: ${completedJobs[0].fineTunedModel}`);
                return completedJobs[0].fineTunedModel;
            }

            logger.info('No fine-tuned models found');
            return null;
        } catch (error) {
            logger.error('Error getting latest fine-tuned model:', error);
            return null; // Return null instead of throwing to gracefully fall back to default model
        }
    }

    /**
     * Get dashboard statistics
     *
     * @returns {Promise<Object>} Dashboard statistics
     */
    async getDashboardStats() {
        try {
            await this._initializeConnection();
            const db = this.getDb();
            const captionColl = db.collection(this.captionCollection);
            const feedbackColl = db.collection(this.feedbackCollection);
            const fineTuneColl = db.collection(this.fineTuningCollection);

            // Get total caption count
            const totalCaptions = await captionColl.countDocuments({ status: 'active' });

            // Get total feedback count
            const totalFeedback = await feedbackColl.countDocuments();

            // Get average rating
            const ratingAgg = await captionColl.aggregate([
                { $match: { status: 'active', feedbackCount: { $gt: 0 } } },
                { $group: { _id: null, avgRating: { $avg: '$avgRating' } } }
            ]).toArray();

            const avgRating = ratingAgg.length > 0 ? ratingAgg[0].avgRating : 0;

            // Get rating distribution
            const ratingDistribution = await feedbackColl.aggregate([
                { $group: { _id: '$rating', count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
                { $project: { rating: '$_id', count: 1, _id: 0 } }
            ]).toArray();

            // Get caption generation history (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const generationHistory = await captionColl.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } },
                { $project: { date: '$_id', count: 1, _id: 0 } }
            ]).toArray();

            // Get fine-tuning stats
            const fineTuningStats = {
                total: await fineTuneColl.countDocuments(),
                succeeded: await fineTuneColl.countDocuments({ status: 'succeeded' }),
                failed: await fineTuneColl.countDocuments({ status: 'failed' }),
                inProgress: await fineTuneColl.countDocuments({
                    status: { $in: ['created', 'running', 'validating'] }
                })
            };

            // Get feedback trends over time (rating averages by week)
            const feedbackTrends = await feedbackColl.aggregate([
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%U', date: '$createdAt' } // Group by year and week
                        },
                        avgRating: { $avg: '$rating' },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } },
                { $project: { period: '$_id', avgRating: 1, count: 1, _id: 0 } }
            ]).toArray();

            return {
                totalCaptions,
                totalFeedback,
                avgRating,
                ratingDistribution,
                generationHistory,
                fineTuningStats,
                feedbackTrends
            };
        } catch (error) {
            logger.error('Error getting dashboard stats:', error);
            throw new Error(`Failed to get dashboard stats: ${error.message}`);
        }
    }

    /**
     * Helper method to format the prompt for fine-tuning
     * @private
     */
    _formatPrompt(item) {
        return `
Create a caption for my Instagram post with this image and song.

IMAGE ANALYSIS:
${item.context.imageAnalysis}

SONG:
"${item.context.songAnalysis.name}" by ${item.context.songAnalysis.artist}
${item.context.songAnalysis.description || ''}

CAPTION STYLE:
- Tone: ${item.context.options?.tone || 'casual'}
- Length: ${item.context.options?.length || 'medium'}
- Emoji usage: ${item.context.options?.emoji || 'moderate'}
- Hashtags: ${item.context.options?.hashtags || 'moderate'}
- Language: ${item.context.options?.language || 'english'}

${item.context.userContext ? `ADDITIONAL CONTEXT: ${item.context.userContext}` : ''}
`;
    }

    /**
     * Sanitize text input to prevent injection attacks
     * @private
     */
    _sanitizeText(text) {
        if (!text) return '';
        // Basic sanitization - remove potential script tags, etc.
        return String(text)
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .trim();
    }

    /**
     * Sanitize object data
     * @private
     */
    _sanitizeObject(obj) {
        if (!obj || typeof obj !== 'object') return {};

        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                sanitized[key] = this._sanitizeText(value);
            } else if (typeof value === 'number' || typeof value === 'boolean') {
                sanitized[key] = value;
            } else if (value === null) {
                sanitized[key] = null;
            } else if (typeof value === 'object') {
                sanitized[key] = this._sanitizeObject(value);
            }
        }
        return sanitized;
    }
}

module.exports = CaptionLearningService;

