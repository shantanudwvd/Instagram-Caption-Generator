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
        this.userPreferenceCollection = 'user_preferences';

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
            await db.collection(this.captionCollection).createIndex({ userId: 1 });
            await db.collection(this.captionCollection).createIndex({ userId: 1, createdAt: -1 });

            // Feedback collection indexes
            await db.collection(this.feedbackCollection).createIndex({ captionId: 1 });
            await db.collection(this.feedbackCollection).createIndex({ userId: 1 });
            await db.collection(this.feedbackCollection).createIndex({ timestamp: -1 });

            // Fine-tuning collection indexes
            await db.collection(this.fineTuningCollection).createIndex({ createdAt: -1 });
            await db.collection(this.fineTuningCollection).createIndex({ status: 1 });

            // User preference collection indexes
            await db.collection(this.userPreferenceCollection).createIndex({ userId: 1 }, { unique: true });
            await db.collection(this.userPreferenceCollection).createIndex({ updatedAt: -1 });

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
     * @param {string} captionData.userId - User ID who created the caption (required)
     * @returns {Promise<string>} ID of the stored caption
     */
    async storeCaption(captionData) {
        if (!captionData || !captionData.caption) {
            throw new Error('Invalid caption data: caption text is required');
        }

        if (!captionData.userId) {
            throw new Error('User ID is required to store caption');
        }

        try {
            await this._initializeConnection();
            const db = this.getDb();
            const collection = db.collection(this.captionCollection);

            // Validate userId is a valid ObjectId
            if (!ObjectId.isValid(captionData.userId)) {
                throw new Error('Invalid user ID format');
            }

            // Validate and sanitize data
            const sanitizedData = {
                userId: new ObjectId(captionData.userId),
                caption: this._sanitizeText(captionData.caption),
                imageAnalysis: this._sanitizeText(captionData.imageAnalysis || ''),
                imageFeatures: this._sanitizeObject(captionData.imageFeatures || null),
                imageUrl: captionData.imageUrl || null,
                songAnalysis: this._sanitizeObject(captionData.songAnalysis || {}),
                songFeatures: this._sanitizeObject(captionData.songFeatures || null),
                relationshipAnalysis: this._sanitizeObject(captionData.relationshipAnalysis || null),
                userContext: this._sanitizeText(captionData.userContext || ''),
                options: this._sanitizeObject(captionData.options || {}),
                createdAt: new Date(),
                feedbackCount: 0,
                avgRating: 0,
                status: 'active',
                captionId: uuidv4() // Add a UUID for external reference
            };

            const result = await collection.insertOne(sanitizedData);

            logger.info(`Stored new caption with ID: ${result.insertedId} for user: ${captionData.userId}`);
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
     * @param {string} feedback.userId - User ID who provided the feedback (required)
     * @returns {Promise<boolean>} Success status
     */
    async recordFeedback(captionId, feedback) {
        if (!captionId) {
            throw new Error('Caption ID is required');
        }

        if (!feedback || typeof feedback.rating !== 'number' || feedback.rating < 1 || feedback.rating > 5) {
            throw new Error('Valid rating (1-5) is required');
        }

        if (!feedback.userId) {
            throw new Error('User ID is required to record feedback');
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

            // Validate userId format
            if (!ObjectId.isValid(feedback.userId)) {
                throw new Error('Invalid user ID format');
            }

            // Check if caption exists and belongs to the user
            const captionDoc = await captionColl.findOne({ _id: objectId });
            if (!captionDoc) {
                throw new Error('Caption not found');
            }

            // Verify the caption belongs to the user providing feedback
            if (captionDoc.userId && captionDoc.userId.toString() !== feedback.userId) {
                throw new Error('Caption does not belong to this user');
            }

            // Store the feedback with sanitized data
            const feedbackDoc = {
                captionId: objectId,
                userId: new ObjectId(feedback.userId),
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
            const userProfileCache = new Map();

            for (const caption of highQualityCaptions) {
                let styleProfile = null;
                const captionUserId = caption.userId?.toString();

                if (captionUserId) {
                    if (userProfileCache.has(captionUserId)) {
                        styleProfile = userProfileCache.get(captionUserId);
                    } else {
                        try {
                            styleProfile = await this.getUserPreferenceProfile(captionUserId, { forceRefresh: false });
                            userProfileCache.set(captionUserId, styleProfile);
                        } catch (profileError) {
                            logger.warn('Unable to load user style profile for training data', { error: profileError.message, userId: captionUserId });
                        }
                    }
                }

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
                        imageFeatures: caption.imageFeatures || null,
                        songAnalysis: caption.songAnalysis,
                        songFeatures: caption.songFeatures || null,
                        relationshipAnalysis: caption.relationshipAnalysis || null,
                        userContext: caption.userContext,
                        options: caption.options,
                        styleProfile: styleProfile || null
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
     * Get dashboard statistics for a specific user
     *
     * @param {string} userId - User ID to get stats for (required)
     * @returns {Promise<Object>} Dashboard statistics
     */
    async getDashboardStats(userId) {
        if (!userId) {
            throw new Error('User ID is required to get dashboard stats');
        }

        if (!ObjectId.isValid(userId)) {
            throw new Error('Invalid user ID format');
        }

        try {
            await this._initializeConnection();
            const db = this.getDb();
            const captionColl = db.collection(this.captionCollection);
            const feedbackColl = db.collection(this.feedbackCollection);
            const fineTuneColl = db.collection(this.fineTuningCollection);

            const userObjectId = new ObjectId(userId);

            // Base match for user's captions
            const userCaptionMatch = { userId: userObjectId, status: 'active' };

            // Get total caption count for this user
            const totalCaptions = await captionColl.countDocuments(userCaptionMatch);

            // Get user's caption IDs for feedback filtering
            const userCaptionIds = await captionColl.find(userCaptionMatch)
                .project({ _id: 1 })
                .toArray();
            const captionIdArray = userCaptionIds.map(c => c._id);

            // Get total feedback count for this user's captions
            const totalFeedback = captionIdArray.length > 0
                ? await feedbackColl.countDocuments({ captionId: { $in: captionIdArray } })
                : 0;

            // Get average rating for this user's captions
            const ratingAgg = await captionColl.aggregate([
                { $match: { ...userCaptionMatch, feedbackCount: { $gt: 0 } } },
                { $group: { _id: null, avgRating: { $avg: '$avgRating' } } }
            ]).toArray();

            const avgRating = ratingAgg.length > 0 ? ratingAgg[0].avgRating : 0;

            // Get rating distribution for this user's feedback
            const ratingDistribution = captionIdArray.length > 0
                ? await feedbackColl.aggregate([
                    { $match: { captionId: { $in: captionIdArray } } },
                    { $group: { _id: '$rating', count: { $sum: 1 } } },
                    { $sort: { _id: 1 } },
                    { $project: { rating: '$_id', count: 1, _id: 0 } }
                ]).toArray()
                : [];

            // Get caption generation history (last 30 days) for this user
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const generationHistory = await captionColl.aggregate([
                { $match: { ...userCaptionMatch, createdAt: { $gte: thirtyDaysAgo } } },
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

            // Fine-tuning stats are global (not user-specific)
            const fineTuningStats = {
                total: await fineTuneColl.countDocuments(),
                succeeded: await fineTuneColl.countDocuments({ status: 'succeeded' }),
                failed: await fineTuneColl.countDocuments({ status: 'failed' }),
                inProgress: await fineTuneColl.countDocuments({
                    status: { $in: ['created', 'running', 'validating'] }
                })
            };

            // Get feedback trends over time (rating averages by week) for this user's captions
            const feedbackTrends = captionIdArray.length > 0
                ? await feedbackColl.aggregate([
                    { $match: { captionId: { $in: captionIdArray } } },
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
                ]).toArray()
                : [];

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
     * Get recent captions for dashboard activity feed
     *
     * @param {number} limit - Maximum number of captions to return
     * @returns {Promise<Array>} Recent caption summaries
     */
    async getRecentCaptions(limit = 5, userId) {
        if (!userId) {
            throw new Error('User ID is required to get recent captions');
        }

        if (!ObjectId.isValid(userId)) {
            throw new Error('Invalid user ID format');
        }

        try {
            await this._initializeConnection();
            const db = this.getDb();
            const captionColl = db.collection(this.captionCollection);

            const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 50);
            const userObjectId = new ObjectId(userId);

            const captions = await captionColl.find({ userId: userObjectId, status: 'active' })
                .sort({ createdAt: -1 })
                .limit(safeLimit)
                .project({
                    caption: 1,
                    createdAt: 1,
                    avgRating: 1,
                    feedbackCount: 1,
                    options: 1,
                    imageUrl: 1
                })
                .toArray();

            return captions.map(caption => ({
                id: caption._id.toString(),
                caption: caption.caption,
                createdAt: caption.createdAt,
                avgRating: caption.avgRating || 0,
                feedbackCount: caption.feedbackCount || 0,
                tone: caption?.options?.tone || null,
                length: caption?.options?.length || null,
                imageUrl: caption.imageUrl || null
            }));
        } catch (error) {
            logger.error('Error fetching recent captions:', error);
            throw new Error('Failed to fetch recent captions');
        }
    }

    /**
     * Get filtered captions with search and pagination
     *
     * @param {Object} filters - Filter options
     * @param {string} filters.search - Text search query
     * @param {string} filters.tone - Filter by tone
     * @param {string} filters.length - Filter by length
     * @param {string} filters.sortBy - Sort field (createdAt, avgRating, feedbackCount)
     * @param {string} filters.sortOrder - Sort order (asc, desc)
     * @param {number} filters.limit - Number of results per page
     * @param {number} filters.offset - Pagination offset
     * @returns {Promise<Object>} Paginated captions with metadata
     */
    async getFilteredCaptions(filters = {}) {
        try {
            await this._initializeConnection();
            const db = this.getDb();
            const captionColl = db.collection(this.captionCollection);

            // Build query - always filter by userId
            const query = { status: 'active' };

            // User filter (required)
            if (filters.userId) {
                if (!ObjectId.isValid(filters.userId)) {
                    throw new Error('Invalid user ID format');
                }
                query.userId = new ObjectId(filters.userId);
            } else {
                throw new Error('User ID is required to filter captions');
            }

            // Text search filter
            if (filters.search && filters.search.trim()) {
                query.caption = { $regex: filters.search.trim(), $options: 'i' };
            }

            // Tone filter
            if (filters.tone && filters.tone !== 'all') {
                query['options.tone'] = filters.tone;
            }

            // Length filter
            if (filters.length && filters.length !== 'all') {
                query['options.length'] = filters.length;
            }

            // Build sort object
            const sortField = filters.sortBy || 'createdAt';
            const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
            const sort = { [sortField]: sortOrder };

            // Pagination
            const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 50, 1), 100);
            const offset = Math.max(parseInt(filters.offset, 10) || 0, 0);

            // Get total count for pagination
            const totalCount = await captionColl.countDocuments(query);

            // Fetch captions
            const captions = await captionColl.find(query)
                .sort(sort)
                .skip(offset)
                .limit(limit)
                .project({
                    caption: 1,
                    createdAt: 1,
                    avgRating: 1,
                    feedbackCount: 1,
                    options: 1,
                    imageUrl: 1
                })
                .toArray();

            return {
                captions: captions.map(caption => ({
                    id: caption._id.toString(),
                    caption: caption.caption,
                    createdAt: caption.createdAt,
                    avgRating: caption.avgRating || 0,
                    feedbackCount: caption.feedbackCount || 0,
                    tone: caption?.options?.tone || null,
                    length: caption?.options?.length || null,
                    imageUrl: caption.imageUrl || null
                })),
                totalCount,
                limit,
                offset,
                hasMore: offset + limit < totalCount
            };
        } catch (error) {
            logger.error('Error fetching filtered captions:', error);
            throw new Error('Failed to fetch filtered captions');
        }
    }

    /**
     * Build a lightweight preference profile for a user based on their caption history and feedback
     *
     * @param {string} userId - User ID to build preferences for (required)
     * @param {Object} options - Optional configuration
     * @param {number} options.historyLimit - Number of recent captions to consider
     * @param {number} options.feedbackLimit - Number of feedback entries to consider
     * @returns {Promise<Object|null>} Preference profile or null if no history
     */
    async getUserPreferenceProfile(userId, options = {}) {
        const {
            historyLimit = 12,
            feedbackLimit = 20,
            forceRefresh = false
        } = options;

        if (!userId) {
            throw new Error('User ID is required to build preference profile');
        }

        if (!ObjectId.isValid(userId)) {
            throw new Error('Invalid user ID format');
        }

        try {
            await this._initializeConnection();
            const db = this.getDb();
            const captionColl = db.collection(this.captionCollection);
            const feedbackColl = db.collection(this.feedbackCollection);
            const preferenceColl = db.collection(this.userPreferenceCollection);
            const userObjectId = new ObjectId(userId);

            // Return existing cached profile unless forced to refresh
            if (!forceRefresh) {
                const existing = await preferenceColl.findOne({ userId: userObjectId });
                if (existing) {
                    return this._sanitizeObject({
                        ...existing,
                        id: existing._id?.toString()
                    });
                }
            }

            // Recent captions for this user
            const captions = await captionColl.find({ userId: userObjectId, status: 'active' })
                .sort({ createdAt: -1 })
                .limit(historyLimit)
                .project({
                    caption: 1,
                    options: 1,
                    avgRating: 1,
                    feedbackCount: 1,
                    createdAt: 1,
                    userContext: 1
                })
                .toArray();

            if (!captions.length) {
                return null;
            }

            const captionIds = captions.map(c => c._id);
            const feedback = await feedbackColl.find({
                captionId: { $in: captionIds },
                userId: userObjectId
            })
                .sort({ createdAt: -1 })
                .limit(feedbackLimit)
                .project({
                    captionId: 1,
                    rating: 1,
                    comments: 1,
                    userEdits: 1,
                    createdAt: 1
                })
                .toArray();

            const optionStats = this._collectOptionStats(captions);
            const preferredOptions = {
                tone: this._topOption(optionStats.tone, 'casual'),
                length: this._topOption(optionStats.length, 'medium'),
                emoji: this._topOption(optionStats.emoji, 'moderate'),
                hashtags: this._topOption(optionStats.hashtags, 'moderate'),
                language: this._topOption(optionStats.language, 'english')
            };

            // Pick top-rated or most recent captions as examples
            const scoredCaptions = [...captions].sort((a, b) => {
                const scoreA = (a.avgRating || 0) + (a.feedbackCount || 0) * 0.1;
                const scoreB = (b.avgRating || 0) + (b.feedbackCount || 0) * 0.1;
                if (scoreA === scoreB) {
                    return (b.createdAt || 0) - (a.createdAt || 0);
                }
                return scoreB - scoreA;
            });

            const topCaptions = scoredCaptions.slice(0, 5).map(caption => {
                const relatedFeedback = feedback.filter(f => f.captionId.toString() === caption._id.toString());
                const bestEdit = relatedFeedback.find(f => f.userEdits && f.userEdits.trim().length > 0);

                return {
                    captionId: caption._id?.toString(),
                    caption: caption.caption,
                    createdAt: caption.createdAt,
                    avgRating: caption.avgRating || 0,
                    feedbackCount: caption.feedbackCount || 0,
                    options: caption.options || {},
                    userContext: caption.userContext || '',
                    userEdits: bestEdit?.userEdits || null,
                    feedbackSample: relatedFeedback.slice(0, 2).map(fb => ({
                        rating: fb.rating,
                        comments: fb.comments || '',
                        userEdits: fb.userEdits || ''
                    }))
                };
            });

            // Attempt to summarize preferences using OpenAI
            let aiProfile = null;
            if (process.env.OPENAI_API_KEY) {
                try {
                    const response = await this.openai.chat.completions.create({
                        model: "gpt-4o-mini",
                        messages: [
                            {
                                role: "system",
                                content: "You are a social media strategist who summarizes a user's captioning style from examples and feedback."
                            },
                            {
                                role: "user",
                                content: `
Review these past Instagram captions, their options, and feedback. Extract what the user likes, avoids, and how they typically sound. Keep it concise and actionable.

EXAMPLES:
${topCaptions.map((c, idx) => `${idx + 1}. Caption: "${c.caption}"
- Options: ${JSON.stringify(c.options)}
- Avg rating: ${c.avgRating} (feedback count: ${c.feedbackCount})
- User edits: ${c.userEdits || 'none'}
- Feedback: ${c.feedbackSample.map(f => `rating ${f.rating}${f.comments ? `, comment: ${f.comments}` : ''}${f.userEdits ? `, edits: ${f.userEdits}` : ''}`).join(' | ') || 'none'}
`).join('\n')}

Return a JSON object with:
- summary: short sentence describing their vibe
- stylePrinciples: 3-5 bullet rules that capture their voice
- dos: 2-4 things to lean into
- donts: 2-4 things to avoid
- examplePhrases: 2-4 short snippets of wording they like (do not repeat captions verbatim)
- preferredOptions: optional overrides for tone/length/emoji/hashtags/language if obvious
`
                            }
                        ],
                        temperature: 0.35,
                        max_tokens: 400,
                        response_format: { type: "json_object" }
                    });

                    aiProfile = JSON.parse(response.choices[0].message.content);
                } catch (aiError) {
                    logger.warn('Failed to build AI preference profile, using heuristics', { error: aiError.message });
                }
            }

            const profile = {
                summary: aiProfile?.summary || `Prefers ${preferredOptions.tone} captions of ${preferredOptions.length} length with ${preferredOptions.emoji} emoji use.`,
                stylePrinciples: aiProfile?.stylePrinciples || [
                    'Keep captions specific to the moment',
                    'Maintain a natural, non-robotic tone',
                    'Blend feelings with concise observations'
                ],
                dos: aiProfile?.dos || [
                    'Reference concrete details from the scene',
                    'Keep language relaxed and personable'
                ],
                donts: aiProfile?.donts || [
                    'Avoid generic inspirational filler',
                    'Avoid repetitive phrasing'
                ],
                preferredOptions: {
                    tone: aiProfile?.preferredOptions?.tone || preferredOptions.tone,
                    length: aiProfile?.preferredOptions?.length || preferredOptions.length,
                    emoji: aiProfile?.preferredOptions?.emoji || preferredOptions.emoji,
                    hashtags: aiProfile?.preferredOptions?.hashtags || preferredOptions.hashtags,
                    language: aiProfile?.preferredOptions?.language || preferredOptions.language
                },
                examplePhrases: aiProfile?.examplePhrases || topCaptions.map(c => c.caption).slice(0, 3),
                samplesUsed: topCaptions
            };

            // Persist the preference profile for reuse and fine-tuning
            const now = new Date();
            const profileDoc = {
                userId: userObjectId,
                summary: this._sanitizeText(profile.summary),
                stylePrinciples: this._sanitizeArray(profile.stylePrinciples || []),
                dos: this._sanitizeArray(profile.dos || []),
                donts: this._sanitizeArray(profile.donts || []),
                preferredOptions: this._sanitizeObject(profile.preferredOptions || {}),
                examplePhrases: this._sanitizeArray(profile.examplePhrases || []),
                samplesUsed: this._sanitizeArray(profile.samplesUsed || []),
                sourceStats: {
                    captionCount: captions.length,
                    feedbackCount: feedback.length,
                    historyLimit,
                    feedbackLimit,
                    aiGenerated: !!aiProfile
                },
                version: 1,
                createdAt: now,
                updatedAt: now
            };

            await preferenceColl.updateOne(
                { userId: userObjectId },
                { $set: profileDoc, $setOnInsert: { createdAt: now } },
                { upsert: true }
            );

            return {
                ...profile,
                sourceStats: profileDoc.sourceStats
            };
        } catch (error) {
            logger.error('Error building user preference profile:', error);
            return null;
        }
    }

    /**
     * Helper method to format the prompt for fine-tuning
     * @private
     */
    _formatPrompt(item) {
        const imageFeaturesSection = item.context.imageFeatures
            ? `
IMAGE FEATURES:
- Mood: ${item.context.imageFeatures.mood}
- Energy: ${item.context.imageFeatures.energy}
- Colors: ${item.context.imageFeatures.colors?.join(', ') || 'various'}
- Themes: ${item.context.imageFeatures.themes?.join(', ') || 'general'}
- Setting: ${item.context.imageFeatures.setting}
- Time of Day: ${item.context.imageFeatures.timeOfDay}
`
            : '';

        const songFeaturesSection = item.context.songFeatures
            ? `
SONG FEATURES:
- Mood: ${item.context.songFeatures.mood}
- Energy: ${item.context.songFeatures.energy}
- Tempo: ${item.context.songFeatures.tempo}
- Genre: ${item.context.songFeatures.genre}
- Vibe: ${item.context.songFeatures.vibe}
`
            : '';

        const relationshipSection = item.context.relationshipAnalysis
            ? `
IMAGE-SONG RELATIONSHIP:
- Compatibility: ${item.context.relationshipAnalysis.compatibility}
- Thematic Connections: ${item.context.relationshipAnalysis.thematicConnections?.join(', ') || 'Various'}
- Emotional Resonance: ${item.context.relationshipAnalysis.emotionalResonance || 'Cohesive emotional experience'}
- Integration Suggestions: ${item.context.relationshipAnalysis.integrationSuggestions?.join('; ') || 'Weave elements naturally together'}
`
            : '';

        const styleProfileSection = item.context.styleProfile
            ? `
USER STYLE PROFILE:
- Summary: ${item.context.styleProfile.summary || 'Keep it human and specific'}
- Style principles: ${(item.context.styleProfile.stylePrinciples || []).join('; ') || 'Stay specific; keep it natural'}
- Dos: ${(item.context.styleProfile.dos || []).join('; ') || 'Lean into concrete details'}
- Donts: ${(item.context.styleProfile.donts || []).join('; ') || 'Avoid generic filler'}
- Preferred options: ${JSON.stringify(item.context.styleProfile.preferredOptions || {})}
- Example snippets: ${(item.context.styleProfile.examplePhrases || []).slice(0, 3).join(' | ') || 'n/a'}
Use this to match the user voice without copying prior captions verbatim.
`
            : '';

        return `
Create a caption for my Instagram post with this image and song.

IMAGE ANALYSIS:
${item.context.imageAnalysis}
${imageFeaturesSection}

SONG:
"${item.context.songAnalysis?.name || 'Unknown'}" by ${item.context.songAnalysis?.artist || 'Unknown Artist'}
${item.context.songAnalysis?.description || ''}
${songFeaturesSection}
${relationshipSection}
${styleProfileSection}

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
        if (obj === null || obj === undefined) return {};
        if (Array.isArray(obj)) {
            return this._sanitizeArray(obj);
        }
        if (typeof obj !== 'object') return obj;

        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                sanitized[key] = this._sanitizeText(value);
            } else if (value instanceof Date) {
                sanitized[key] = value;
            } else if (typeof value === 'number' || typeof value === 'boolean') {
                sanitized[key] = value;
            } else if (value === null) {
                sanitized[key] = null;
            } else if (Array.isArray(value)) {
                sanitized[key] = this._sanitizeArray(value);
            } else if (typeof value === 'object') {
                sanitized[key] = this._sanitizeObject(value);
            }
        }
        return sanitized;
    }

    /**
     * Sanitize array data
     * @private
     */
    _sanitizeArray(arr) {
        if (!Array.isArray(arr)) return [];

        return arr
            .map(item => {
                if (typeof item === 'string') return this._sanitizeText(item);
                if (typeof item === 'number' || typeof item === 'boolean') return item;
                if (item === null) return null;
                if (Array.isArray(item)) return this._sanitizeArray(item);
                if (typeof item === 'object') return this._sanitizeObject(item);
                return null;
            })
            .filter(item => item !== undefined);
    }

    /**
     * Collect option usage statistics from captions
     * @private
     */
    _collectOptionStats(captions) {
        const stats = {
            tone: {},
            length: {},
            emoji: {},
            hashtags: {},
            language: {}
        };

        captions.forEach(caption => {
            const options = caption.options || {};
            ['tone', 'length', 'emoji', 'hashtags', 'language'].forEach(key => {
                const value = options[key];
                if (value) {
                    stats[key][value] = (stats[key][value] || 0) + 1;
                }
            });
        });

        return stats;
    }

    /**
     * Get the most common option value
     * @private
     */
    _topOption(countMap, fallback) {
        const entries = Object.entries(countMap || {});
        if (!entries.length) return fallback;

        entries.sort((a, b) => b[1] - a[1]);
        return entries[0][0] || fallback;
    }
}

module.exports = CaptionLearningService;
