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
const upload = multer({ dest: 'uploads/' });

const corsOptions = {
    origin: "instagram-caption-generator-shantanudwvds-projects.vercel.app", // Replace with your Vercel frontend URL
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
        const { trackId } = req.body;
        const imageFile = req.file;

        if (!imageFile || !trackId) {
            return res.status(400).json({ error: 'Image and track ID are required' });
        }

        // Analyze image using GPT-4 Vision
        const imageBase64 = fs.readFileSync(imageFile.path, { encoding: 'base64' });
        const imageAnalysis = await analyzeImage(imageBase64);
        console.log("image analysis is coming as: %j", imageAnalysis);

        // Get song details and analysis
        const songAnalysis = await analyzeSong(trackId);
        console.log("song analysis is coming as: %j", songAnalysis);

        // Generate caption
        const caption = await generateCaption(imageAnalysis, songAnalysis);

        // Clean up uploaded file
        fs.unlinkSync(imageFile.path);

        res.json({ caption });
    } catch (error) {
        console.error('Error generating caption:', error);
        res.status(500).json({ error: 'Error generating caption' });
    }
});

app.get('/api/search-tracks', async (req, res) => {
    try {
        const { query } = req.query;
        const data = await spotifyApi.searchTracks(query, { limit: 10 });
        const tracks = data.body.tracks.items.map(track => ({
            id: track.id,
            name: track.name,
            artist: track.artists[0].name,
            album: track.album.name,
            albumArt: track.album.images[0]?.url
        }));
        res.json({ tracks });
    } catch (error) {
        console.error('Error searching tracks:', error);
        res.status(500).json({ error: 'Error searching tracks' });
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
    return { ...songData, description };
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
        return { ...songData, description };

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
          Based on the following inputs, create an engaging Instagram caption:
          
          Image Analysis: ${imageAnalysis}
          Song Details: ${songAnalysis.description}
          Song: ${songAnalysis.name} by ${songAnalysis.artist}
          
          Create a caption that:
          1. Connects the mood of the image with the song's energy and emotion
          2. Includes relevant emojis
          3. Includes 3-5 relevant hashtags
          4. Is engaging and authentic
          5. Is no longer than 2-3 sentences
          6. Includes the song credit
        `
            }
        ],
        max_tokens: 150
    });

    return response.choices[0].message.content;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});