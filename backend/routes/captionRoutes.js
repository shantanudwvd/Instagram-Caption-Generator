const express = require("express");
const router = express.Router();
const OpenAI = require("openai");
const SpotifyWebApi = require("spotify-web-api-node");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const CaptionLearningService = require("../services/captionLearningService");
const captionLearningService = new CaptionLearningService();
const authMiddleware = require("../middleware/auth");
const SongRecommendationService = require("../services/songRecommendationService");
const logger = require("../utils/logger");
const {
    uploadImage,
    deleteImage,
    extractPublicId,
} = require("../utils/cloudinary");

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Spotify
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI,
});

// Initialize the recommendation service after initializing Spotify API
const recommendationService = new SongRecommendationService(spotifyApi);

// Token management
let spotifyTokenExpirationTime = null;

async function ensureSpotifyToken() {
    // Check if token is expired or will expire in the next minute
    if (
        !spotifyTokenExpirationTime ||
        Date.now() >= spotifyTokenExpirationTime - 60000
    ) {
        try {
            const data = await spotifyApi.clientCredentialsGrant();
            spotifyApi.setAccessToken(data.body["access_token"]);

            // Set expiration time (convert seconds to milliseconds)
            spotifyTokenExpirationTime = Date.now() + data.body["expires_in"] * 1000;
            logger.info("Spotify token refreshed successfully");
        } catch (error) {
            logger.error("Failed to refresh Spotify token", {
                error: error.message,
                stack: error.stack,
            });
            throw new Error("Failed to authenticate with Spotify");
        }
    }
}

// Refresh Spotify access token
async function refreshSpotifyToken() {
    try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body["access_token"]);
        logger.info("Spotify token refreshed");
    } catch (error) {
        logger.error("Error refreshing Spotify token", {
            error: error.message,
            stack: error.stack,
        });
    }
}

// Refresh token initially and every 50 minutes
refreshSpotifyToken();
setInterval(refreshSpotifyToken, 50 * 60 * 1000);

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const SUPPORTED_AUDIO_EXTENSIONS = new Set([
    ".flac",
    ".m4a",
    ".mp3",
    ".mp4",
    ".mpeg",
    ".mpga",
    ".oga",
    ".ogg",
    ".wav",
    ".webm",
]);

const AUDIO_MIME_EXTENSIONS = {
    "audio/flac": ".flac",
    "audio/m4a": ".m4a",
    "audio/mp3": ".mp3",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".mp4",
    "audio/mpga": ".mpga",
    "audio/ogg": ".ogg",
    "audio/oga": ".oga",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/webm": ".webm",
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const originalExt = path.extname(file.originalname || "").toLowerCase();
        const mimeExt =
            file.fieldname === "audio"
                ? AUDIO_MIME_EXTENSIONS[file.mimetype] || ""
                : "";
        const fallbackImageExt = file.fieldname === "image" ? ".jpg" : "";
        const finalExt = originalExt || mimeExt || fallbackImageExt;
        cb(null, `${file.fieldname}-${Date.now()}-${uuidv4()}${finalExt}`);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB max to keep audio readable by Whisper
    },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === "image") {
            if (!file.mimetype.startsWith("image/")) {
                return cb(new Error("Only image uploads are allowed"));
            }
            return cb(null, true);
        }

        if (file.fieldname === "audio") {
            const ext = path.extname(file.originalname || "").toLowerCase();
            const hasSupportedExt = SUPPORTED_AUDIO_EXTENSIONS.has(ext);
            const hasSupportedMime = Boolean(AUDIO_MIME_EXTENSIONS[file.mimetype]);

            if (!hasSupportedExt && !hasSupportedMime) {
                return cb(new Error("Unsupported audio format for transcription"));
            }

            return cb(null, true);
        }

        // Reject any unexpected fields
        return cb(new Error("Unsupported upload field"));
    },
});

// Require authentication for all caption routes
router.use(authMiddleware);

// Generate caption endpoint
router.post(
    "/generate-caption",
    upload.fields([
        { name: "image", maxCount: 1 },
        { name: "audio", maxCount: 1 },
    ]),
    async (req, res) => {
        try {
            const { trackId, textContext, tone, length, language, emoji, hashtags } =
                req.body;

            const imageFile = req.files.image ? req.files.image[0] : null;
            const audioFile = req.files.audio ? req.files.audio[0] : null;

            if (!imageFile) {
                return res.status(400).json({ error: "Image is required" });
            }

            // User context from either text or transcribed audio
            let userContext = "";

            // Process text context if provided
            if (textContext) {
                userContext = textContext;
                logger.debug("Using text context", {
                    contextPreview:
                        textContext.substring(0, 100) +
                        (textContext.length > 100 ? "..." : ""),
                    userId: req.user?.id,
                });
            }

            // Process audio file if provided (transcribe with OpenAI)
            if (audioFile) {
                try {
                    logger.debug("Transcribing audio file", { userId: req.user?.id });
                    userContext = await transcribeAudio(audioFile.path);
                    logger.debug("Audio transcription complete", {
                        transcriptionPreview:
                            userContext.substring(0, 100) +
                            (userContext.length > 100 ? "..." : ""),
                        userId: req.user?.id,
                    });
                } catch (transcriptionError) {
                    logger.error("Error transcribing audio", {
                        error: transcriptionError.message,
                        stack: transcriptionError.stack,
                        userId: req.user?.id,
                    });
                    // Continue without transcription if it fails
                }
            }

            // Analyze image using GPT-4 Vision (returns object with text and features)
            const imageBase64 = fs.readFileSync(imageFile.path, {
                encoding: "base64",
            });
            const imageAnalysisResult = await analyzeImage(imageBase64);
            const imageAnalysisText = imageAnalysisResult.text || imageAnalysisResult;
            const imageFeatures = imageAnalysisResult.features || null;
            logger.debug("Image analysis complete", {
                userId: req.user?.id,
                hasFeatures: !!imageFeatures,
            });

            // Build a user-specific style profile from past captions/feedback
            let userStyleProfile = null;
            try {
                userStyleProfile =
                    await captionLearningService.getUserPreferenceProfile(req.user.id);
                if (userStyleProfile?.preferredOptions) {
                    logger.debug("Loaded user style profile", {
                        userId: req.user?.id,
                        preferredOptions: userStyleProfile.preferredOptions,
                    });
                }
            } catch (profileError) {
                logger.error("Error loading user style profile", {
                    error: profileError.message,
                    stack: profileError.stack,
                    userId: req.user?.id,
                });
            }

            // Setup customization options
            const customization = {
                tone: tone || userStyleProfile?.preferredOptions?.tone || "casual",
                length:
                    length || userStyleProfile?.preferredOptions?.length || "medium",
                language:
                    language || userStyleProfile?.preferredOptions?.language || "english",
                emoji: emoji || userStyleProfile?.preferredOptions?.emoji || "moderate",
                hashtags:
                    hashtags ||
                    userStyleProfile?.preferredOptions?.hashtags ||
                    "moderate",
            };

            logger.debug("Using caption options", {
                customization,
                userId: req.user?.id,
            });

            // Get song details and analysis if trackId is provided
            let songAnalysis = null;
            let songFeatures = null;
            let relationshipAnalysis = null;

            if (trackId) {
                try {
                    songAnalysis = await analyzeSong(trackId);
                    songFeatures = songAnalysis.features || null;
                    logger.debug("Song analysis complete", {
                        trackId,
                        userId: req.user?.id,
                        hasSpotifyFeatures: !!songAnalysis.spotifyAudioFeatures,
                    });

                    // Analyze relationship between image and song if both are available
                    if (imageFeatures && songFeatures) {
                        try {
                            relationshipAnalysis = await analyzeImageSongRelationship(
                                imageFeatures,
                                songFeatures,
                                imageAnalysisText,
                                songAnalysis
                            );
                            logger.debug("Relationship analysis complete", {
                                userId: req.user?.id,
                            });
                        } catch (relationshipError) {
                            logger.error("Error analyzing image-song relationship", {
                                error: relationshipError.message,
                                stack: relationshipError.stack,
                                userId: req.user?.id,
                            });
                            // Continue without relationship analysis if it fails
                        }
                    }
                } catch (songError) {
                    logger.error("Error analyzing song", {
                        error: songError.message,
                        stack: songError.stack,
                        trackId,
                        userId: req.user?.id,
                    });
                    // Continue without song analysis if it fails
                }
            }

            // Generate caption with all available data
            const caption = await generateCaption(
                imageAnalysisText,
                imageFeatures,
                songAnalysis,
                songFeatures,
                relationshipAnalysis,
                userContext,
                customization,
                userStyleProfile
            );
            logger.info("Caption generated successfully", { userId: req.user?.id });

            // Store the caption for learning
            let captionId = null;
            let imageUrl = null;
            let cloudinaryPublicId = null;
            try {
                // Upload image to Cloudinary if configured, otherwise use local storage
                if (
                    process.env.CLOUDINARY_CLOUD_NAME &&
                    process.env.CLOUDINARY_API_KEY &&
                    process.env.CLOUDINARY_API_SECRET
                ) {
                    try {
                        // Generate unique public ID for Cloudinary
                        const publicId = `caption_${uuidv4()}`;

                        // Upload to Cloudinary
                        const uploadResult = await uploadImage(
                            imageFile.path,
                            "captions",
                            publicId
                        );
                        imageUrl = uploadResult.url;
                        cloudinaryPublicId = uploadResult.publicId;

                        logger.debug("Image uploaded to Cloudinary", {
                            imageUrl,
                            publicId: cloudinaryPublicId,
                            userId: req.user?.id,
                        });
                    } catch (cloudinaryError) {
                        logger.error(
                            "Cloudinary upload failed, falling back to local storage",
                            {
                                error: cloudinaryError.message,
                                userId: req.user?.id,
                            }
                        );
                        // Fall back to local storage
                        const imageExt = path.extname(
                            imageFile.originalname || imageFile.filename || ".jpg"
                        );
                        const captionsDir = path.join(process.cwd(), "uploads", "captions");

                        // Ensure captions directory exists
                        if (!fs.existsSync(captionsDir)) {
                            fs.mkdirSync(captionsDir, { recursive: true });
                        }

                        // Generate unique filename using UUID
                        const imageFilename = `${uuidv4()}${imageExt}`;
                        const imagePath = path.join(captionsDir, imageFilename);

                        // Copy image to captions directory
                        fs.copyFileSync(imageFile.path, imagePath);
                        imageUrl = `/uploads/captions/${imageFilename}`;

                        logger.debug("Image saved locally for caption", {
                            imageUrl,
                            userId: req.user?.id,
                        });
                    }
                } else {
                    // Use local storage if Cloudinary is not configured
                    logger.warn("Cloudinary not configured, using local storage", {
                        userId: req.user?.id,
                    });
                    const imageExt = path.extname(
                        imageFile.originalname || imageFile.filename || ".jpg"
                    );
                    const captionsDir = path.join(process.cwd(), "uploads", "captions");

                    // Ensure captions directory exists
                    if (!fs.existsSync(captionsDir)) {
                        fs.mkdirSync(captionsDir, { recursive: true });
                    }

                    // Generate unique filename using UUID
                    const imageFilename = `${uuidv4()}${imageExt}`;
                    const imagePath = path.join(captionsDir, imageFilename);

                    // Copy image to captions directory
                    fs.copyFileSync(imageFile.path, imagePath);
                    imageUrl = `/uploads/captions/${imageFilename}`;

                    logger.debug("Image saved locally for caption", {
                        imageUrl,
                        userId: req.user?.id,
                    });
                }

                captionId = await captionLearningService.storeCaption({
                    userId: req.user.id,
                    caption,
                    imageAnalysis: imageAnalysisText,
                    imageFeatures,
                    songAnalysis,
                    songFeatures,
                    relationshipAnalysis,
                    userContext,
                    options: customization,
                    imageUrl: imageUrl,
                });
                logger.debug("Caption stored for learning", {
                    captionId,
                    userId: req.user?.id,
                });
            } catch (storeError) {
                logger.error("Error storing caption for learning", {
                    error: storeError.message,
                    stack: storeError.stack,
                    userId: req.user?.id,
                });
                // Delete saved image if caption storage failed
                if (imageUrl) {
                    try {
                        if (cloudinaryPublicId) {
                            // Delete from Cloudinary
                            await deleteImage(cloudinaryPublicId);
                            logger.info(
                                "Deleted image from Cloudinary after failed storage",
                                { cloudinaryPublicId }
                            );
                        } else {
                            // Delete from local storage
                            const imagePath = path.join(process.cwd(), imageUrl);
                            if (fs.existsSync(imagePath)) {
                                fs.unlinkSync(imagePath);
                            }
                        }
                    } catch (cleanupError) {
                        logger.error("Error cleaning up image after failed storage", {
                            error: cleanupError.message,
                        });
                    }
                }
                // Continue even if storing fails
            }

            // Clean up uploaded files
            fs.unlinkSync(imageFile.path);
            if (audioFile) {
                fs.unlinkSync(audioFile.path);
            }

            res.json({ caption, captionId, imageUrl });
        } catch (error) {
            logger.error("Error generating caption", {
                error: error.message,
                stack: error.stack,
                userId: req.user?.id,
            });
            res.status(500).json({ error: "Error generating caption" });
        }
    }
);

// Store a caption after generation
router.post("/captions", async (req, res) => {
    try {
        const { caption, imageAnalysis, songAnalysis, userContext, options } =
            req.body;

        if (!caption) {
            return res.status(400).json({ error: "Caption is required" });
        }

        const captionId = await captionLearningService.storeCaption({
            userId: req.user.id,
            caption,
            imageAnalysis,
            songAnalysis,
            userContext,
            options,
        });

        res.json({ success: true, captionId });
    } catch (error) {
        logger.error("Error storing caption", {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
        });
        res.status(500).json({ error: "Failed to store caption" });
    }
});

// delete a caption
router.post(`/captions/:captionId`, async (req, res) => {
    try {
        const { captionId } = req.params;
        if (!captionId) {
            return res.status(400).json({ error: "CaptionId is required" });
        }
        const deletedCaptionId = await captionLearningService.deleteCaption(
            captionId
        );

        res.json({ success: true, deletedCaptionId });
    } catch (error) {
        logger.error("Error deletion caption", {
            error: error.message,
            stack: error.stack,
            query: req.query.query,
            userId: req.user?.id,
        });
        res.status(400).json({ error: "Error deletion caption" });
    }
});

router.get("/search-tracks", async (req, res) => {
    try {
        const { query } = req.query;
        const data = await spotifyApi.searchTracks(query, { limit: 10 });
        const tracks = data.body.tracks.items.map((track) => ({
            id: track.id,
            name: track.name,
            artist: track.artists[0].name,
            album: track.album.name,
            albumArt: track.album.images[0]?.url,
        }));
        res.json({ tracks });
    } catch (error) {
        logger.error("Error searching tracks", {
            error: error.message,
            stack: error.stack,
            query: req.query.query,
            userId: req.user?.id,
        });
        res.status(500).json({ error: "Error searching tracks" });
    }
});

router.post("/analyze-image", upload.single("image"), async (req, res) => {
    try {
        const imageFile = req.file;

        if (!imageFile) {
            return res.status(400).json({ error: "Image is required" });
        }

        logger.debug("Analyzing image", {
            filename: imageFile.originalname || "uploaded image",
            userId: req.user?.id,
        });

        // Analyze image using GPT-4 Vision (returns object with text and features)
        const imageBase64 = fs.readFileSync(imageFile.path, { encoding: "base64" });
        const imageAnalysisResult = await analyzeImage(imageBase64);
        const imageAnalysis =
            typeof imageAnalysisResult === "string"
                ? imageAnalysisResult
                : imageAnalysisResult.text;

        logger.debug("Image analysis complete", { userId: req.user?.id });

        // Clean up uploaded file
        fs.unlinkSync(imageFile.path);

        res.json({ analysis: imageAnalysis });
    } catch (error) {
        logger.error("Error analyzing image", {
            error: error.message,
            stack: error.stack,
            filename: req.file?.originalname,
            userId: req.user?.id,
        });

        // Try to clean up the file if it exists
        try {
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
        } catch (cleanupError) {
            logger.error("Error cleaning up file", {
                error: cleanupError.message,
                stack: cleanupError.stack,
            });
        }

        res.status(500).json({
            error: "Error analyzing image",
            message: error.message,
        });
    }
});

router.post("/get-recommendations", async (req, res) => {
    try {
        const { imageAnalysis, currentTrack } = req.body;

        if (!imageAnalysis) {
            return res.status(400).json({ error: "Image analysis is required" });
        }

        logger.debug("Getting recommendations for image analysis", {
            hasCurrentTrack: !!currentTrack,
            userId: req.user?.id,
        });

        // Ensure Spotify token is valid
        await ensureSpotifyToken();

        // Get recommendations - explicitly pass null if currentTrack is undefined
        const recommendations = await recommendationService.getRecommendations(
            imageAnalysis,
            currentTrack || null
        );

        logger.debug("Found recommendations", {
            count: recommendations.length,
            userId: req.user?.id,
        });

        res.json({ recommendations });
    } catch (error) {
        logger.error("Error getting recommendations", {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
        });

        try {
            // Return default recommendations if there's an error
            logger.warn("Using default queries for recommendations due to error", {
                userId: req.user?.id,
            });
            const defaultQueries = [
                "chill music",
                "relaxing songs",
                "popular hits",
                "mood music",
                "vibes",
            ];

            // Ensure token before fallback search
            await ensureSpotifyToken();

            const defaultRecommendations =
                await recommendationService.searchTracksWithQueries(defaultQueries);
            res.json({
                recommendations: defaultRecommendations.slice(0, 5),
                note: "Using default recommendations due to an error",
            });
        } catch (fallbackError) {
            logger.error("Error with fallback recommendations", {
                error: fallbackError.message,
                stack: fallbackError.stack,
                userId: req.user?.id,
            });
            res.status(500).json({
                error: "Error getting song recommendations",
                message: error.message,
            });
        }
    }
});

// Note: For this to work, you need to have the generateCaption, analyzeSong,
// analyzeImage, and transcribeAudio functions accessible.
// These should be imported or defined in this file.
/**
 * Extract structured features from image analysis text
 *
 * @param {string} imageAnalysisText - AI-generated image analysis text
 * @returns {Object} Extracted image features
 */
function extractImageFeatures(imageAnalysisText) {
    const features = {
        mood: "neutral",
        energy: 0.5,
        colors: [],
        themes: [],
        setting: "general",
        timeOfDay: "unknown",
        dominantElements: [],
    };

    const text = imageAnalysisText.toLowerCase();

    // Extract mood
    if (
        text.includes("happy") ||
        text.includes("joyful") ||
        text.includes("cheerful") ||
        text.includes("bright") ||
        text.includes("uplifting") ||
        text.includes("positive")
    ) {
        features.mood = "positive";
    } else if (
        text.includes("sad") ||
        text.includes("melancholic") ||
        text.includes("somber") ||
        text.includes("gloomy") ||
        text.includes("moody") ||
        text.includes("dark")
    ) {
        features.mood = "melancholic";
    } else if (
        text.includes("peaceful") ||
        text.includes("calm") ||
        text.includes("serene") ||
        text.includes("tranquil") ||
        text.includes("relaxed")
    ) {
        features.mood = "peaceful";
    } else if (
        text.includes("energetic") ||
        text.includes("vibrant") ||
        text.includes("dynamic") ||
        text.includes("intense") ||
        text.includes("dramatic")
    ) {
        features.mood = "energetic";
    } else if (
        text.includes("romantic") ||
        text.includes("intimate") ||
        text.includes("tender")
    ) {
        features.mood = "romantic";
    }

    // Extract energy level
    if (
        text.includes("high energy") ||
        text.includes("energetic") ||
        text.includes("vibrant") ||
        text.includes("dynamic") ||
        text.includes("intense") ||
        text.includes("action")
    ) {
        features.energy = 0.8;
    } else if (
        text.includes("low energy") ||
        text.includes("calm") ||
        text.includes("peaceful") ||
        text.includes("serene") ||
        text.includes("relaxed") ||
        text.includes("still")
    ) {
        features.energy = 0.3;
    } else if (text.includes("moderate") || text.includes("balanced")) {
        features.energy = 0.5;
    }

    // Extract colors
    const colorKeywords = {
        blue: ["blue", "azure", "navy", "cyan", "sky"],
        green: ["green", "emerald", "lime", "forest", "mint"],
        red: ["red", "crimson", "scarlet", "burgundy", "rose"],
        yellow: ["yellow", "gold", "amber", "sunshine", "golden"],
        orange: ["orange", "coral", "peach", "sunset"],
        purple: ["purple", "violet", "lavender", "plum"],
        pink: ["pink", "rose", "blush", "magenta"],
        brown: ["brown", "tan", "beige", "coffee", "earth"],
        black: ["black", "dark", "shadow", "charcoal"],
        white: ["white", "bright", "light", "pale", "snow"],
        gray: ["gray", "grey", "silver", "ash", "slate"],
    };

    for (const [color, keywords] of Object.entries(colorKeywords)) {
        if (keywords.some((keyword) => text.includes(keyword))) {
            if (!features.colors.includes(color)) {
                features.colors.push(color);
            }
        }
    }

    // Extract themes
    const themeKeywords = {
        nature: [
            "nature",
            "outdoor",
            "landscape",
            "forest",
            "mountain",
            "beach",
            "ocean",
            "tree",
            "flower",
            "sunset",
            "sunrise",
        ],
        urban: [
            "city",
            "urban",
            "street",
            "building",
            "architecture",
            "skyline",
            "downtown",
        ],
        portrait: ["person", "face", "portrait", "people", "human", "portrait"],
        food: ["food", "meal", "dish", "restaurant", "cooking", "cuisine"],
        travel: ["travel", "vacation", "trip", "journey", "adventure", "explore"],
        lifestyle: ["lifestyle", "daily", "routine", "home", "interior", "cozy"],
        abstract: ["abstract", "artistic", "creative", "pattern", "design"],
        sports: ["sport", "athletic", "fitness", "exercise", "game"],
        nightlife: ["night", "party", "club", "evening", "nightlife", "dusk"],
        minimalist: ["minimal", "simple", "clean", "minimalist", "minimalistic"],
    };

    for (const [theme, keywords] of Object.entries(themeKeywords)) {
        if (keywords.some((keyword) => text.includes(keyword))) {
            if (!features.themes.includes(theme)) {
                features.themes.push(theme);
            }
        }
    }

    // Extract setting
    if (
        text.includes("beach") ||
        text.includes("ocean") ||
        text.includes("coast") ||
        text.includes("shore")
    ) {
        features.setting = "beach";
    } else if (
        text.includes("mountain") ||
        text.includes("hill") ||
        text.includes("peak")
    ) {
        features.setting = "mountain";
    } else if (
        text.includes("forest") ||
        text.includes("wood") ||
        text.includes("tree")
    ) {
        features.setting = "forest";
    } else if (
        text.includes("city") ||
        text.includes("urban") ||
        text.includes("street")
    ) {
        features.setting = "urban";
    } else if (
        text.includes("home") ||
        text.includes("indoor") ||
        text.includes("room")
    ) {
        features.setting = "indoor";
    } else if (
        text.includes("cafe") ||
        text.includes("restaurant") ||
        text.includes("bar")
    ) {
        features.setting = "venue";
    }

    // Extract time of day
    if (
        text.includes("sunrise") ||
        text.includes("dawn") ||
        text.includes("morning") ||
        text.includes("early")
    ) {
        features.timeOfDay = "morning";
    } else if (
        text.includes("sunset") ||
        text.includes("dusk") ||
        text.includes("evening") ||
        text.includes("golden hour")
    ) {
        features.timeOfDay = "evening";
    } else if (
        text.includes("night") ||
        text.includes("dark") ||
        text.includes("midnight") ||
        text.includes("late")
    ) {
        features.timeOfDay = "night";
    } else if (
        text.includes("afternoon") ||
        text.includes("midday") ||
        text.includes("noon")
    ) {
        features.timeOfDay = "afternoon";
    }

    // Extract dominant elements (first 3-4 key elements mentioned)
    const elementKeywords = [
        "light",
        "shadow",
        "color",
        "texture",
        "composition",
        "angle",
        "perspective",
        "subject",
        "background",
        "foreground",
        "detail",
        "pattern",
        "reflection",
    ];
    for (const keyword of elementKeywords) {
        if (text.includes(keyword) && features.dominantElements.length < 4) {
            features.dominantElements.push(keyword);
        }
    }

    return features;
}

/**
 * Extract numerical and categorical features from the AI-generated description
 *
 * @param {string} description - AI-generated song description
 * @returns {Object} Extracted features
 */
function extractFeaturesFromDescription(description) {
    const features = {
        energy: 0.5,
        mood: "neutral",
        tempo: "moderate",
        genre: "pop",
        vibe: "general",
    };

    // Extract energy level
    if (
        description.toLowerCase().includes("high energy") ||
        description.toLowerCase().includes("energetic") ||
        description.toLowerCase().includes("upbeat")
    ) {
        features.energy = 0.8;
    } else if (
        description.toLowerCase().includes("low energy") ||
        description.toLowerCase().includes("calm") ||
        description.toLowerCase().includes("relaxed") ||
        description.toLowerCase().includes("mellow")
    ) {
        features.energy = 0.3;
    }

    // Extract mood
    if (
        description.toLowerCase().includes("happy") ||
        description.toLowerCase().includes("joyful") ||
        description.toLowerCase().includes("upbeat") ||
        description.toLowerCase().includes("positive")
    ) {
        features.mood = "positive";
    } else if (
        description.toLowerCase().includes("sad") ||
        description.toLowerCase().includes("melancholic") ||
        description.toLowerCase().includes("somber")
    ) {
        features.mood = "melancholic";
    } else if (
        description.toLowerCase().includes("angry") ||
        description.toLowerCase().includes("intense") ||
        description.toLowerCase().includes("aggressive")
    ) {
        features.mood = "intense";
    }

    // Extract tempo
    if (
        description.toLowerCase().includes("fast") ||
        description.toLowerCase().includes("uptempo") ||
        description.toLowerCase().includes("quick")
    ) {
        features.tempo = "fast";
    } else if (
        description.toLowerCase().includes("slow") ||
        description.toLowerCase().includes("downtempo")
    ) {
        features.tempo = "slow";
    }

    // Extract genre (basic extraction, can be expanded)
    const genres = [
        "pop",
        "rock",
        "hip hop",
        "rap",
        "r&b",
        "jazz",
        "classical",
        "electronic",
        "dance",
        "edm",
        "country",
        "folk",
        "indie",
        "alternative",
        "metal",
        "blues",
        "reggae",
        "latin",
    ];

    for (const genre of genres) {
        if (description.toLowerCase().includes(genre)) {
            features.genre = genre;
            break;
        }
    }

    // Extract vibe/atmosphere
    const vibes = [
        "chill",
        "relaxing",
        "party",
        "romantic",
        "dreamy",
        "nostalgic",
        "energetic",
        "dark",
        "atmospheric",
        "emotional",
        "summer",
        "winter",
    ];

    for (const vibe of vibes) {
        if (description.toLowerCase().includes(vibe)) {
            features.vibe = vibe;
            break;
        }
    }

    return features;
}

/**
 * Extract structured features from song using GPT-4
 * This is used as a fallback when Spotify audio features aren't available
 *
 * @param {Object} songData - Basic song metadata
 * @param {string} description - Song description from GPT-4
 * @returns {Promise<Object>} Structured song features
 */
async function extractSongFeaturesWithGPT(songData, description) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a music analysis expert. Extract structured features from song descriptions and metadata.",
                },
                {
                    role: "user",
                    content: `
Based on this song information, extract structured features:

Song: "${songData.name}"
Artist: ${songData.artist}
Album: ${songData.album}
Release Date: ${songData.releaseDate || "Unknown"}
Popularity: ${songData.popularity || "Unknown"}/100

Song Description:
${description}

Extract and return a JSON object with these exact fields:
{
    "energy": 0.0-1.0 (numeric value representing energy level),
    "mood": "positive" | "neutral" | "melancholic" | "intense" | "romantic" | "peaceful",
    "tempo": "slow" | "moderate" | "fast",
    "genre": "pop" | "rock" | "hip hop" | "r&b" | "jazz" | "electronic" | "country" | "indie" | "alternative" | "classical" | etc.,
    "vibe": "chill" | "relaxing" | "party" | "romantic" | "dreamy" | "nostalgic" | "energetic" | "dark" | "atmospheric" | "emotional" | "danceable" | "acoustic" | "general"
}

Base your extraction on the description, song title, artist, genre, release date, and popularity. Be specific and accurate.
`,
                },
            ],
            max_tokens: 200,
            temperature: 0.3,
            response_format: { type: "json_object" },
        });

        const extractedFeatures = JSON.parse(response.choices[0].message.content);

        // Validate and normalize the extracted features
        const features = {
            energy: Math.max(0, Math.min(1, extractedFeatures.energy || 0.5)),
            mood: extractedFeatures.mood || "neutral",
            tempo: extractedFeatures.tempo || "moderate",
            genre: extractedFeatures.genre || "pop",
            vibe: extractedFeatures.vibe || "general",
        };

        logger.debug("Extracted song features using GPT-4", {
            trackId: songData.id,
            features,
        });

        return features;
    } catch (error) {
        logger.error("Error extracting song features with GPT-4", {
            error: error.message,
            stack: error.stack,
            songName: songData.name,
        });
        // Fall back to keyword-based extraction
        return extractFeaturesFromDescription(description);
    }
}

/**
 * Generate song analysis using OpenAI
 *
 * @param {Object} songData - Basic song metadata
 * @returns {Promise<string>} Song description/analysis
 */
async function generateSongAnalysis(songData) {
    try {
        // Create prompt for OpenAI to analyze the song
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a music analysis expert with deep knowledge of songs, artists, genres, and emotional characteristics of music. You can analyze songs based on their metadata and provide insightful descriptions of their mood, energy, and overall vibe.",
                },
                {
                    role: "user",
                    content: `
Analyze this song based on its metadata and your music knowledge:

Song: "${songData.name}"
Artist: ${songData.artist}
Album: ${songData.album}
Release Date: ${songData.releaseDate || "Unknown"}
Popularity on Spotify: ${songData.popularity || "Unknown"}/100

Please provide:
1. A brief, engaging description (2-3 sentences) of this song's overall sound, mood, and vibe
2. Estimate these characteristics in your analysis:
   - Energy level (low, moderate, high)
   - Mood (melancholic, neutral, upbeat, etc.)
   - Tempo (slow, moderate, fast)
   - Genre or style
   - Overall vibe/atmosphere

Focus on how this song might make someone feel when listening to it, what contexts it's suitable for, and its emotional qualities.
Keep your response under 150 words, focusing on the most distinctive elements of the track.
`,
                },
            ],
            max_tokens: 250,
            temperature: 0.7,
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        logger.error("Error generating song analysis with OpenAI", {
            error: error.message,
            stack: error.stack,
            songName: songData.name,
            artist: songData.artist,
        });
        return `"${songData.name}" by ${songData.artist} is a track with distinctive qualities that could match the mood of your image.`;
    }
}

// Update the generateCaption function to incorporate structured features and relationship analysis
async function generateCaption(
    imageAnalysis,
    imageFeatures,
    songAnalysis,
    songFeatures,
    relationshipAnalysis,
    userContext = "",
    customization = {},
    userStyleProfile = null
) {
    // Set default values if customization options are not provided
    const options = {
        tone: customization.tone || "casual",
        length: customization.length || "medium",
        language: customization.language || "english",
        emoji: customization.emoji || "moderate",
        hashtags: customization.hashtags || "moderate",
        style: customization.style || "balanced",
        focus: customization.focus || "balanced",
    };

    // Define length parameters
    const lengthMap = {
        "very-short": { description: "very brief, just 1 sentence", maxWords: 20 },
        short: { description: "concise", maxWords: 40 },
        medium: { description: "standard length", maxWords: 70 },
        long: { description: "detailed", maxWords: 120 },
        "very-long": { description: "extended and elaborate", maxWords: 200 },
    };

    const lengthParams = lengthMap[options.length] || lengthMap.medium;

    // Define emoji parameters
    const emojiMap = {
        none: "Do not use any emojis",
        minimal: "Use 1-2 emojis at most, only where they naturally fit",
        moderate: "Use a few well-placed emojis that enhance the message",
        abundant: "Use emojis generously throughout to express emotion",
    };

    const emojiParams = emojiMap[options.emoji] || emojiMap.moderate;

    // Define hashtag parameters
    const hashtagMap = {
        none: "No hashtags",
        minimal: "1-3 highly relevant hashtags",
        moderate: "4-7 well-chosen hashtags",
        abundant: "8+ diverse and comprehensive hashtags",
    };

    const hashtagParams = hashtagMap[options.hashtags] || hashtagMap.moderate;

    // Define tone context and examples
    const toneExamples = {
        casual: {
            description: "relaxed, conversational, everyday language",
            example:
                "Just vibing to this track while taking in the view. Sometimes the simplest moments hit different.",
        },
        professional: {
            description: "polished, sophisticated, refined language",
            example:
                "Exploring the intersection of visual aesthetics and musical composition, finding harmony in both art forms.",
        },
        friendly: {
            description: "warm, approachable, personable",
            example:
                "Hey friends! This song has been my absolute go-to lately - it just matches the energy of these beautiful surroundings perfectly! Who else feels this?",
        },
        humorous: {
            description: "witty, playful, amusing",
            example:
                "When the song hits just right and you pretend you're in a music video but really you're just waiting for your coffee to brew. #MainCharacterMoment",
        },
        "dark-humor": {
            description: "comedy with an edge, morbid or cynical undertones",
            example:
                "Blasting upbeat music to drown out the existential dread. This view almost makes me forget my crippling debt. Almost.",
        },
        inspirational: {
            description: "uplifting, motivational, encouraging",
            example:
                "Every step forward is progress. Let this view remind you that the journey is just as beautiful as the destination.",
        },
        thoughtful: {
            description: "reflective, contemplative, insightful",
            example:
                "In the quiet moments between the notes, I find myself reflecting on how music colors our perceptions of the world around us.",
        },
        poetic: {
            description: "lyrical, metaphorical, artistic",
            example:
                "Whispers of melody dance across sunlit waters, each ripple a verse in nature's endless song.",
        },
        sarcastic: {
            description: "ironic, dry humor, subtle mockery",
            example:
                "Oh sure, just another average day listening to life-changing music while witnessing breathtaking scenery. No big deal.",
        },
        enthusiastic: {
            description: "excited, energetic, passionate",
            example:
                "I AM ABSOLUTELY OBSESSED with this song right now!! It matches this incredible scene so perfectly I can't even handle it!!!",
        },
        mysterious: {
            description: "intriguing, enigmatic, subtle",
            example:
                "Some moments defy explanation... the music knows what the eyes see but the words cannot express.",
        },
    };

    const toneParams = toneExamples[options.tone] || toneExamples.casual;

    const preferredOptions = userStyleProfile?.preferredOptions;
    const styleProfileSection = userStyleProfile
        ? `
LEARNED USER STYLE (from their past, highly-rated captions):
- Summary: ${userStyleProfile.summary || "Keep it natural and personal"}
- Preferred defaults: tone ${preferredOptions?.tone || "casual"}, length ${
            preferredOptions?.length || "medium"
        }, emoji ${preferredOptions?.emoji || "moderate"}, hashtags ${
            preferredOptions?.hashtags || "moderate"
        }, language ${preferredOptions?.language || "english"}
- Style principles: ${
            (userStyleProfile.stylePrinciples || []).join("; ") ||
            "Stay specific, personal, and non-robotic"
        }
- Lean into: ${
            (userStyleProfile.dos || []).join("; ") ||
            "Concrete observations and genuine feelings"
        }
- Avoid: ${
            (userStyleProfile.donts || []).join("; ") ||
            "Generic inspirational filler or repetitive wording"
        }
- Snippets they liked (vibe only—do not copy verbatim): ${
            (userStyleProfile.examplePhrases || []).slice(0, 3).join(" | ") || "n/a"
        }
Use this profile to subtly match their voice unless the user explicitly requested a different style for this caption.
`
        : "";

    // Prepare user context section - only include if there is actual context
    const userContextSection = userContext
        ? `
USER-PROVIDED CONTEXT ABOUT THIS IMAGE:
${userContext}
`
        : "";

    // Prepare image features section
    const imageFeaturesSection = imageFeatures
        ? `
IMAGE FEATURES:
- Mood: ${imageFeatures.mood}
- Energy Level: ${imageFeatures.energy}
- Dominant Colors: ${imageFeatures.colors.join(", ") || "various"}
- Themes: ${imageFeatures.themes.join(", ") || "general"}
- Setting: ${imageFeatures.setting}
- Time of Day: ${imageFeatures.timeOfDay}
`
        : "";

    // Prepare song information - only include if song is provided
    const songSection = songAnalysis
        ? `
THE SONG I'M FEATURING:
"${songAnalysis.name}" by ${songAnalysis.artist}
From: ${songAnalysis.album}
Vibe: ${songAnalysis.description}
`
        : "";

    // Prepare song features section - only include if song is provided
    const songFeaturesSection =
        songAnalysis && songFeatures
            ? `
SONG FEATURES:
- Mood: ${songFeatures.mood}
- Energy Level: ${songFeatures.energy}
- Tempo: ${songFeatures.tempo}
- Genre: ${songFeatures.genre}
- Vibe: ${songFeatures.vibe}
`
            : "";

    // Prepare relationship analysis section - only include if song is provided
    const relationshipSection =
        relationshipAnalysis && songAnalysis
            ? `
IMAGE-SONG RELATIONSHIP ANALYSIS:
- Compatibility: ${relationshipAnalysis.compatibility}
- Thematic Connections: ${
                relationshipAnalysis.thematicConnections?.join(", ") ||
                "Various connections"
            }
- Emotional Resonance: ${
                relationshipAnalysis.emotionalResonance ||
                "The image and song create a cohesive emotional experience"
            }
- Contrast Opportunities: ${
                relationshipAnalysis.contrastOpportunities ||
                "Consider exploring subtle contrasts"
            }
- Integration Suggestions: ${
                relationshipAnalysis.integrationSuggestions?.join("; ") ||
                "Weave image and song elements naturally together"
            }

IMPORTANT: Use these relationship insights to create a caption that naturally integrates both the image and song. Don't just mention them separately - find authentic connections and weave them together organically.
`
            : "";

    // Modify the formatting instructions based on whether a song is included
    const formatInstructions = songAnalysis
        ? `FORMAT:
[Main caption text in ${options.language}${
            options.language === "hinglish" ? " (mix of Hindi and English)" : ""
        }]

[Hashtags if requested, placed below the main caption]

🎵: "${songAnalysis.name}" - ${songAnalysis.artist}`
        : `FORMAT:
[Main caption text in ${options.language}${
            options.language === "hinglish" ? " (mix of Hindi and English)" : ""
        }]

[Hashtags if requested, placed below the main caption]`;

    // Generate caption with image analysis, song info, and user context
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: `You are a skilled social media copywriter who creates authentic, human Instagram captions. Your captions never feel AI-generated or formulaic. Instead, they capture the genuine voice of a real person expressing themselves naturally on social media.`,
            },
            {
                role: "user",
                content: `
I need a natural-sounding Instagram caption for a post. I want it to feel authentic and human, not AI-generated.

THE IMAGE SHOWS:
${typeof imageAnalysis === "string" ? imageAnalysis : imageAnalysis.text}
${imageFeaturesSection}
${userContextSection}
${styleProfileSection}
${songSection}
${songFeaturesSection}
${relationshipSection}
CAPTION STYLE:
- Tone: ${toneParams.description}
- Length: ${lengthParams.description} (around ${
                    lengthParams.maxWords
                } words max)
- Emoji usage: ${emojiParams}
- Hashtags: ${hashtagParams}
- Language: ${options.language}${
                    options.language === "hinglish" ? " (mix of Hindi and English)" : ""
                }

WHAT MAKES HUMAN CAPTIONS DIFFERENT FROM AI CAPTIONS:
1. Humans are subjective and speak from personal experience
2. Humans use imperfect language with natural flow
3. Humans make specific observations rather than generic descriptions
4. Humans express authentic emotions and vulnerability
5. Humans make unexpected connections between ideas
6. Humans use varied sentence structure and conversational patterns
7. Humans sometimes include casual interjections or asides

${
                    options.language === "hindi"
                        ? `
SPECIFIC GUIDELINES FOR HINDI CAPTIONS:
- Use natural Hindi expressions and colloquialisms that a native speaker would use
- Incorporate common Hindi slang or phrases used on social media
- Use Devanagari script properly
- Mix formal and informal Hindi as appropriate for social media
- Use culturally relevant references that would resonate with Hindi speakers
`
                        : ""
                }

${
                    options.language === "hinglish"
                        ? `
SPECIFIC GUIDELINES FOR HINGLISH CAPTIONS:
- Naturally mix Hindi and English the way young Indians do on social media
- Use Romanized Hindi (Hindi written in English letters) for Hindi words
- Switch between languages mid-sentence in a natural way
- Include popular Hinglish expressions and slang
- Keep the tone conversational and authentic to how young Indians actually write
- Use phrases like "yaar", "matlab", "bas", "ekdum", etc. where they naturally fit
`
                        : ""
                }

${
                    options.tone === "dark-humor"
                        ? `
SPECIFIC GUIDELINES FOR DARK HUMOR TONE:
- Use irony, sarcasm, and self-deprecation
- Balance edginess with accessibility - don't go too extreme
- Incorporate witty observations on life's difficulties or absurdities
- Keep it instagram-appropriate while maintaining the dark humor edge
- Use juxtaposition between the upbeat song and more cynical observations
- Avoid content that would be genuinely hurtful or offensive
- Focus on relatable dark humor about everyday life struggles
`
                        : ""
                }

For reference, here's an example of the TONE I want (but create a totally new caption specific to my image${
                    songAnalysis ? " and song" : ""
                }):
"${toneParams.example}"

Please write a caption that:
1. Makes a natural, specific connection ${
                    songAnalysis ? "between the image and the song" : "to the image"
                }
2. Includes personal perspective and subjective feelings${
                    userContext
                        ? "\n3. Incorporates the personal context I've shared about the image"
                        : ""
                }
${
                    userContext ? "4" : "3"
                }. Respects the learned user style above while honoring any explicit options provided
${
                    userContext ? "5" : "4"
                }. Feels like something a real person would actually post on Instagram
${userContext ? "6" : "5"}. Avoids clichéd phrases and overly formal language
${userContext ? "7" : "6"}. Sounds relaxed and authentic, not formulaic
${
                    songAnalysis
                        ? (userContext ? "8" : "7") + ". Includes the song credit at the end"
                        : ""
                }

${formatInstructions}
`,
            },
        ],
        max_tokens: 500,
        temperature: 0.85, // Slightly higher temperature for more creative, varied results
    });

    return response.choices[0].message.content;
}

async function analyzeImage(base64Image) {
    try {
        logger.debug("Starting image analysis with OpenAI");

        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OpenAI API key is not configured");
        }

        // Format the base64 string correctly with the proper MIME type prefix
        const imageUrl = base64Image.startsWith("data:")
            ? base64Image
            : `data:image/jpeg;base64,${base64Image}`;

        logger.debug("Making request to OpenAI API");
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content:
                        "You are an observant friend with a good eye for detail. You notice things in photos that others might miss, and you describe scenes in a relatable, personal way.",
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "My friend sent me this image. Can you tell me what you notice about it? Focus on what stands out to you personally, specific details that catch your eye, the mood or vibe it gives off, and what feelings or memories it might evoke. Don't be overly formal or analytical - just describe it the way a friend would when looking at someone's photo. Mention 3-4 key elements or details that would be good to reference in an Instagram caption.",
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: imageUrl,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 300,
            temperature: 0.7, // Slightly more creative to get varied human-like responses
        });

        logger.debug("Received OpenAI response");
        const imageAnalysisText = response.choices[0].message.content;

        // Extract structured features from the analysis text
        const imageFeatures = extractImageFeatures(imageAnalysisText);
        logger.debug("Image features extracted", { imageFeatures });

        return {
            text: imageAnalysisText,
            features: imageFeatures,
        };
    } catch (error) {
        logger.error("Error in image analysis API call", {
            error: error.message,
            stack: error.stack,
        });

        if (error.response) {
            logger.error("OpenAI API error details", {
                errorDetails: error.response.data,
            });
        }

        // Provide a fallback analysis when in production
        if (process.env.NODE_ENV === "production") {
            logger.warn("Using fallback analysis due to error");
            const fallbackText =
                "This image has a really interesting vibe to it. There's something about the lighting and composition that gives it a unique feel. It's the kind of scene that would go perfectly with the right soundtrack.";
            return {
                text: fallbackText,
                features: extractImageFeatures(fallbackText),
            };
        }

        throw error;
    }
}

/**
 * Analyze the relationship between image and song features
 * Uses GPT-4 to find thematic connections, compatibility, and integration opportunities
 *
 * @param {Object} imageFeatures - Structured image features
 * @param {Object} songFeatures - Structured song features
 * @param {string} imageAnalysisText - Image analysis text description
 * @param {Object} songAnalysis - Full song analysis object
 * @returns {Promise<Object>} Relationship analysis
 */
async function analyzeImageSongRelationship(
    imageFeatures,
    songFeatures,
    imageAnalysisText,
    songAnalysis
) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content:
                        "You are an expert at analyzing the relationship between visual and musical elements. You identify thematic connections, emotional resonance, compatibility, and creative integration opportunities between images and songs.",
                },
                {
                    role: "user",
                    content: `
Analyze the relationship between this image and song. Find connections, compatibility, and integration opportunities.

IMAGE FEATURES:
- Mood: ${imageFeatures.mood}
- Energy: ${imageFeatures.energy}
- Colors: ${imageFeatures.colors.join(", ") || "various"}
- Themes: ${imageFeatures.themes.join(", ") || "general"}
- Setting: ${imageFeatures.setting}
- Time of Day: ${imageFeatures.timeOfDay}

IMAGE DESCRIPTION:
${imageAnalysisText}

SONG FEATURES:
- Mood: ${songFeatures.mood}
- Energy: ${songFeatures.energy}
- Tempo: ${songFeatures.tempo}
- Genre: ${songFeatures.genre}
- Vibe: ${songFeatures.vibe}

SONG: "${songAnalysis.name}" by ${songAnalysis.artist}
SONG DESCRIPTION: ${songAnalysis.description}

Please provide a JSON object with the following structure:
{
    "compatibility": "high|moderate|low" - How well the image and song match
    "thematicConnections": ["connection1", "connection2"] - Specific thematic links between image and song
    "emotionalResonance": "description of how image and song emotions align or complement"
    "contrastOpportunities": "description of interesting contrasts that could create dynamic captions"
    "integrationSuggestions": ["suggestion1", "suggestion2"] - Specific ways to weave image and song together in a caption
}

Focus on finding authentic, natural connections that would make sense in an Instagram caption. Consider both complementary matches and interesting contrasts.
`,
                },
            ],
            max_tokens: 500,
            temperature: 0.7,
            response_format: { type: "json_object" },
        });

        const relationshipAnalysis = JSON.parse(
            response.choices[0].message.content
        );
        logger.debug("Image-song relationship analyzed", { relationshipAnalysis });

        return relationshipAnalysis;
    } catch (error) {
        logger.error("Error analyzing image-song relationship", {
            error: error.message,
            stack: error.stack,
        });

        // Return fallback relationship analysis
        return {
            compatibility: "moderate",
            thematicConnections: ["Both elements share a similar mood and energy"],
            emotionalResonance:
                "The image and song create a cohesive emotional experience",
            contrastOpportunities:
                "Consider exploring subtle contrasts between visual and auditory elements",
            integrationSuggestions: [
                "Reference both the visual scene and the song naturally in the caption",
            ],
        };
    }
}

/**
 * Map Spotify audio features to our feature schema
 *
 * @param {Object} audioFeatures - Spotify audio features object
 * @returns {Object} Mapped features
 */
function mapSpotifyFeaturesToSchema(audioFeatures) {
    const features = {
        energy: audioFeatures.energy || 0.5,
        mood: "neutral",
        tempo: "moderate",
        genre: "pop",
        vibe: "general",
    };

    // Map valence (0-1) to mood
    // Valence represents musical positiveness (0 = sad, 1 = happy)
    if (audioFeatures.valence !== undefined) {
        if (audioFeatures.valence >= 0.7) {
            features.mood = "positive";
        } else if (audioFeatures.valence >= 0.4) {
            features.mood = "neutral";
        } else {
            features.mood = "melancholic";
        }
    }

    // Map tempo (BPM) to tempo category
    if (audioFeatures.tempo !== undefined) {
        if (audioFeatures.tempo >= 120) {
            features.tempo = "fast";
        } else if (audioFeatures.tempo >= 90) {
            features.tempo = "moderate";
        } else {
            features.tempo = "slow";
        }
    }

    // Map danceability to vibe
    if (audioFeatures.danceability !== undefined) {
        if (audioFeatures.danceability >= 0.7) {
            features.vibe = "danceable";
        } else if (audioFeatures.danceability >= 0.4) {
            features.vibe = "general";
        } else {
            features.vibe = "chill";
        }
    }

    // Use acousticness to refine vibe
    if (
        audioFeatures.acousticness !== undefined &&
        audioFeatures.acousticness >= 0.7
    ) {
        features.vibe = "acoustic";
    }

    return features;
}

/**
 * Improved song analysis function that uses OpenAI and Spotify Audio Features API
 * for analyzing song features and characteristics
 *
 * @param {string} trackId - Spotify track ID
 * @returns {Promise<Object>} Song data with analysis
 */
async function analyzeSong(trackId) {
    try {
        // Ensure valid token before making API calls
        await ensureSpotifyToken();

        // Get basic track info from Spotify
        const trackInfoResponse = await spotifyApi.getTrack(trackId);

        if (!trackInfoResponse.body) {
            throw new Error("Failed to fetch track information");
        }

        const trackInfo = trackInfoResponse.body;

        // Extract basic song metadata
        const songData = {
            id: trackInfo.id,
            name: trackInfo.name,
            artist: trackInfo.artists[0].name,
            album: trackInfo.album.name,
            releaseDate: trackInfo.album.release_date,
            popularity: trackInfo.popularity,
            previewUrl: trackInfo.preview_url,
            albumArt: trackInfo.album.images[0]?.url || null,
            // Initialize with empty values that will be filled
            description: "",
            features: {
                energy: 0.5,
                mood: "neutral",
                tempo: "moderate",
                genre: "pop",
                vibe: "general",
            },
            spotifyAudioFeatures: null,
        };

        // Fetch Spotify audio features
        let spotifyAudioFeatures = null;
        try {
            // Validate trackId
            if (
                !trackId ||
                typeof trackId !== "string" ||
                trackId.trim().length === 0
            ) {
                throw new Error(`Invalid trackId: ${trackId}`);
            }

            // Ensure token is still valid before making the call
            await ensureSpotifyToken();

            // Check if the method exists
            if (typeof spotifyApi.getAudioFeaturesForTrack !== "function") {
                throw new Error(
                    "getAudioFeaturesForTrack method not available on spotifyApi"
                );
            }

            logger.debug("Fetching Spotify audio features", {
                trackId,
                hasAccessToken: !!spotifyApi.getAccessToken(),
                accessTokenPreview: spotifyApi.getAccessToken()
                    ? spotifyApi.getAccessToken().substring(0, 10) + "..."
                    : "none",
            });

            const audioFeaturesResponse = await spotifyApi.getAudioFeaturesForTrack(
                trackId
            );

            if (audioFeaturesResponse && audioFeaturesResponse.body) {
                spotifyAudioFeatures = audioFeaturesResponse.body;
                logger.debug("Spotify audio features fetched successfully", {
                    trackId,
                    energy: spotifyAudioFeatures.energy,
                    valence: spotifyAudioFeatures.valence,
                    tempo: spotifyAudioFeatures.tempo,
                    danceability: spotifyAudioFeatures.danceability,
                });
            } else {
                logger.warn("Spotify audio features response missing body", {
                    trackId,
                    response: audioFeaturesResponse,
                });
            }
        } catch (audioFeaturesError) {
            // Enhanced error logging for debugging
            const errorDetails = {
                trackId,
                errorMessage: audioFeaturesError.message,
                errorName: audioFeaturesError.name,
                errorStack: audioFeaturesError.stack,
            };

            // Check if Spotify API provides additional error details
            if (audioFeaturesError.body) {
                errorDetails.spotifyErrorBody = audioFeaturesError.body;
            }
            if (audioFeaturesError.statusCode) {
                errorDetails.statusCode = audioFeaturesError.statusCode;
            }
            if (audioFeaturesError.statusCode === 404) {
                errorDetails.diagnosis =
                    "Track not found - trackId may be invalid or track may have been removed";
            } else if (audioFeaturesError.statusCode === 401) {
                errorDetails.diagnosis =
                    "Authentication failed - Spotify token may be expired or invalid";
            } else if (audioFeaturesError.statusCode === 403) {
                errorDetails.diagnosis =
                    "Forbidden - Audio features not available for this track. Will use GPT-4 based feature extraction instead.";
                logger.info(
                    "Spotify audio features not available, using GPT-4 fallback",
                    { trackId }
                );
            }

            logger.warn("Failed to fetch Spotify audio features", errorDetails);
            // Continue without audio features - we'll use GPT-4 based extraction instead
        }

        // Use OpenAI to analyze the song
        const description = await generateSongAnalysis(songData);
        logger.debug("Song description generated", {
            trackId,
            descriptionPreview: description.substring(0, 100),
        });

        // Extract features - use Spotify if available, otherwise use enhanced GPT-4 extraction
        let features;
        if (spotifyAudioFeatures) {
            // Use Spotify audio features (most accurate)
            const spotifyMappedFeatures =
                mapSpotifyFeaturesToSchema(spotifyAudioFeatures);
            features = {
                ...spotifyMappedFeatures,
                // Keep genre from GPT-4 analysis as Spotify doesn't provide it
                genre: extractFeaturesFromDescription(description).genre,
            };
            logger.debug("Features extracted from Spotify audio features", {
                trackId,
                features,
            });
        } else {
            // Use enhanced GPT-4 based feature extraction as fallback
            logger.debug(
                "Using GPT-4 based feature extraction (Spotify features not available)",
                { trackId }
            );
            features = await extractSongFeaturesWithGPT(songData, description);
            logger.debug("Song features extracted using GPT-4", {
                trackId,
                features,
            });
        }

        return {
            ...songData,
            description,
            features,
            spotifyAudioFeatures: spotifyAudioFeatures || null,
        };
    } catch (error) {
        logger.error("Error in analyzeSong", {
            error: error.message,
            stack: error.stack,
            trackId,
        });

        // Provide fallback analysis if there's an error
        return {
            id: trackId,
            name: "Unknown Track",
            artist: "Unknown Artist",
            album: "Unknown Album",
            description: "A track that could complement the mood of your image.",
            features: {
                energy: 0.5,
                mood: "neutral",
                tempo: "moderate",
                genre: "pop",
                vibe: "general",
            },
            spotifyAudioFeatures: null,
        };
    }
}

// New function to transcribe audio using OpenAI
async function transcribeAudio(audioFilePath) {
    try {
        const response = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioFilePath),
            model: "whisper-1",
        });

        return response.text;
    } catch (error) {
        logger.error("OpenAI transcription error", {
            error: error.message,
            stack: error.stack,
        });
        throw new Error("Failed to transcribe audio");
    }
}

module.exports = router;
