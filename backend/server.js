const express = require('express');
const multer = require('multer');
const cors = require('cors');
const SpotifyWebApi = require('spotify-web-api-node');
const OpenAI = require('openai');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const upload = multer({dest: 'uploads/'});

const corsOptions = {
    origin: [
        "https://instagram-caption-generator-shantanudwvds-projects.vercel.app",
        "http://localhost:3000", // Replace with your Vercel frontend URL
    ],
    methods: "GET,POST,OPTIONS",
    allowedHeaders: "Content-Type,Authorization",
    credentials: true
};

app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

// Middleware
// app.use(cors());
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize Spotify
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

// Add this after the existing imports
const SongRecommendationService = require('./songRecommendationService');

// Initialize the recommendation service after initializing Spotify API
const recommendationService = new SongRecommendationService(spotifyApi);

// Token management
let spotifyTokenExpirationTime = null;

async function ensureSpotifyToken() {
    // Check if token is expired or will expire in the next minute
    if (!spotifyTokenExpirationTime || Date.now() >= spotifyTokenExpirationTime - 60000) {
        try {
            const data = await spotifyApi.clientCredentialsGrant();
            spotifyApi.setAccessToken(data.body['access_token']);

            // Set expiration time (convert seconds to milliseconds)
            spotifyTokenExpirationTime = Date.now() + (data.body['expires_in'] * 1000);
            console.log('Spotify token refreshed successfully');
        } catch (error) {
            console.error('Failed to refresh Spotify token:', error);
            throw new Error('Failed to authenticate with Spotify');
        }
    }
}

// Refresh Spotify access token
async function refreshSpotifyToken() {
    try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body['access_token']);
        console.log('Spotify token refreshed');
    } catch (error) {
        console.error('Error refreshing Spotify token:', error);
    }
}

// Refresh token initially and every 50 minutes
refreshSpotifyToken();
setInterval(refreshSpotifyToken, 50 * 60 * 1000);

// Routes
app.post('/api/generate-caption', upload.single('image'), async (req, res) => {
    try {
        const {trackId} = req.body;
        const imageFile = req.file;

        if (!imageFile || !trackId) {
            return res.status(400).json({error: 'Image and track ID are required'});
        }

        // Analyze image using GPT-4 Vision
        const imageBase64 = fs.readFileSync(imageFile.path, {encoding: 'base64'});
        const imageAnalysis = await analyzeImage(imageBase64);
        console.log("image analysis is coming as: %j", imageAnalysis);

        // Get song details and analysis
        const songAnalysis = await analyzeSong(trackId);
        console.log("song analysis is coming as: %j", songAnalysis);

        // Generate caption
        const caption = await generateCaption(imageAnalysis, songAnalysis);

        // Get song recommendations based on the image analysis
        const recommendations = await recommendationService.getRecommendations(imageAnalysis, {
            id: trackId,
            name: songAnalysis.name,
            artist: songAnalysis.artist,
            album: songAnalysis.album
        });

        // Clean up uploaded file
        fs.unlinkSync(imageFile.path);

        res.json({
            caption,
            recommendations
        });
    } catch (error) {
        console.error('Error generating caption:', error);
        res.status(500).json({error: 'Error generating caption'});
    }
});

app.get('/api/search-tracks', async (req, res) => {
    try {
        const {query} = req.query;
        const data = await spotifyApi.searchTracks(query, {limit: 10});
        const tracks = data.body.tracks.items.map(track => ({
            id: track.id,
            name: track.name,
            artist: track.artists[0].name,
            album: track.album.name,
            albumArt: track.album.images[0]?.url
        }));
        res.json({tracks});
    } catch (error) {
        console.error('Error searching tracks:', error);
        res.status(500).json({error: 'Error searching tracks'});
    }
});


app.post('/api/analyze-image', upload.single('image'), async (req, res) => {
    try {
        const imageFile = req.file;

        if (!imageFile) {
            return res.status(400).json({error: 'Image is required'});
        }

        console.log('Analyzing image:', imageFile.originalname || 'uploaded image');

        // Analyze image using GPT-4 Vision
        const imageBase64 = fs.readFileSync(imageFile.path, {encoding: 'base64'});
        const imageAnalysis = await analyzeImage(imageBase64);

        console.log('Image analysis complete');

        // Clean up uploaded file
        fs.unlinkSync(imageFile.path);

        res.json({analysis: imageAnalysis});
    } catch (error) {
        console.error('Error analyzing image:', error);

        // Try to clean up the file if it exists
        try {
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
        } catch (cleanupError) {
            console.error('Error cleaning up file:', cleanupError);
        }

        res.status(500).json({
            error: 'Error analyzing image',
            message: error.message
        });
    }
});

// Helper functions
async function analyzeImage(base64Image) {
    const response = await openai.chat.completions.create({
        model: "gpt-4o-2024-11-20",
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "Please analyze this image and describe its key elements, mood, and atmosphere in a way that would be relevant for an Instagram caption."
                    },
                    {
                        type: "image_url",
                        // Format the base64 string correctly with the proper MIME type prefix
                        image_url: {
                            url: base64Image.startsWith('data:')
                                ? base64Image
                                : `data:image/jpeg;base64,${base64Image}`
                        }
                    }
                ]
            }
        ],
        max_tokens: 300
    });

    return response.choices[0].message.content;
}

async function analyzeSongOld(trackId) {
    const trackInfo = await spotifyApi.getTrack(trackId);
    console.log("track info is coming as: %j", trackInfo);
    const audioFeatures = await spotifyApi.getAudioFeaturesForTrack(trackId);
    console.log("audio features is coming as: %j", audioFeatures);

    const songData = {
        name: trackInfo.body.name,
        artist: trackInfo.body.artists[0].name,
        album: trackInfo.body.album.name,
        features: audioFeatures.body
    };

    const description = await generateSongDescription(songData);
    return {...songData, description};
}

// Update the analyzeSong function with better error handling
async function analyzeSong(trackId) {
    try {
        // Ensure valid token before making API calls
        await ensureSpotifyToken();

        // Get track info
        const trackInfo = await spotifyApi.getTrack(trackId);

        let audioFeatures = null;
        try {
            // Get audio features
            const featuresResponse = await spotifyApi.getAudioFeaturesForTrack(trackId);
            audioFeatures = featuresResponse.body;
        } catch (featuresError) {
            console.warn('Could not fetch audio features:', featuresError);
            // Continue without audio features
        }

        const songData = {
            name: trackInfo.body.name,
            artist: trackInfo.body.artists[0].name,
            album: trackInfo.body.album.name,
            features: audioFeatures || {
                energy: 0.5,
                valence: 0.5,
                danceability: 0.5
            }
        };

        // Generate description even without audio features
        const description = await generateSongDescription(songData);
        return {...songData, description};

    } catch (error) {
        console.error('Error in analyzeSong:', error);
        throw new Error(`Failed to analyze song: ${error.message}`);
    }
}

async function generateSongDescription(songData) {
    const response = await openai.chat.completions.create({
        model: "gpt-4o-2024-11-20",
        messages: [
            {
                role: "user",
                content: `
          Please create a brief, engaging description of this song based on its characteristics:
          
          Song: ${songData.name}
          Artist: ${songData.artist}
          Album: ${songData.album}
          
          Audio features:
          - Energy: ${songData.features.energy}
          - Valence (positivity): ${songData.features.valence}
          - Danceability: ${songData.features.danceability}
          
          Focus on the mood, energy, and emotional qualities of the song.
        `
            }
        ],
        max_tokens: 150
    });

    return response.choices[0].message.content;
}

async function generateCaption(imageAnalysis, songAnalysis) {
    const response = await openai.chat.completions.create({
        model: "gpt-4o-2024-11-20",
        messages: [
            {
                role: "user",
                content: `
Create a magnetic Instagram caption that weaves together the following elements:

IMAGE CONTEXT:
${imageAnalysis}
• What's the dominant emotion/mood?
• What are the key visual elements?
• What's the overall aesthetic/style?
• What time of day/setting is shown?

MUSIC ELEMENTS:
• Song: "${songAnalysis.name}" by ${songAnalysis.artist}
• Genre: ${songAnalysis.genre}
• Key themes: ${songAnalysis.description}
• Mood/Energy: ${songAnalysis.mood}
• Notable lyrics: ${songAnalysis.lyrics}

CAPTION REQUIREMENTS:
1. Opening Hook:
   - Start with an attention-grabbing line that connects the image's mood to the song's emotion
   - Use sensory language or vivid description
   
2. Story/Connection:
   - Create a brief narrative that explains why this song perfectly matches this moment
   - Make it personal and relatable
   
3. Technical Specifications:
   - Length: 2-3 impactful sentences
   - Include 2-3 strategically placed emojis that enhance (don't repeat) the message
   - Add 3-5 relevant hashtags that mix popular and niche terms
   - Credit format: 🎵: [Song] - [Artist]
   
4. Style Guidelines:
   - Write in a conversational, authentic tone
   - Avoid clichés and overused phrases
   - Mix short and medium-length sentences
   - Use specific details from both image and song
   
5. Engagement Elements:
   - End with either a subtle call-to-action or thought-provoking question
   - Make it easy for viewers to connect with the emotion/moment

FORMAT THE OUTPUT AS:
[Caption with emojis]

[Hashtags]

[Song credit]`
            }
        ],
        max_tokens: 150
    });

    return response.choices[0].message.content;
}


app.post('/api/get-recommendations', async (req, res) => {
    try {
        const {imageAnalysis, currentTrack} = req.body;

        if (!imageAnalysis) {
            return res.status(400).json({error: 'Image analysis is required'});
        }

        console.log('Getting recommendations for image analysis');
        console.log('Current track:', currentTrack || 'None');

        // Ensure Spotify token is valid
        await ensureSpotifyToken();

        // Get recommendations - explicitly pass null if currentTrack is undefined
        const recommendations = await recommendationService.getRecommendations(imageAnalysis, currentTrack || null);

        console.log(`Found ${recommendations.length} recommendations`);

        res.json({recommendations});
    } catch (error) {
        console.error('Error getting recommendations:', error);

        try {
            // Return default recommendations if there's an error
            console.log('Using default queries for recommendations due to error');
            const defaultQueries = ["chill music", "relaxing songs", "popular hits", "mood music", "vibes"];

            // Ensure token before fallback search
            await ensureSpotifyToken();

            const defaultRecommendations = await recommendationService.searchTracksWithQueries(defaultQueries);
            res.json({
                recommendations: defaultRecommendations.slice(0, 5),
                note: "Using default recommendations due to an error"
            });
        } catch (fallbackError) {
            console.error('Error with fallback recommendations:', fallbackError);
            res.status(500).json({
                error: 'Error getting song recommendations',
                message: error.message
            });
        }
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});