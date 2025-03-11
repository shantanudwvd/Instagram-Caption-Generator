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
        "https://captionmuse.adityagusain.com",
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


app.post('/api/generate-caption', upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'audio', maxCount: 1 }
]), async (req, res) => {
    try {
        const {
            trackId,
            textContext,
            tone,
            length,
            language,
            emoji,
            hashtags
        } = req.body;

        const imageFile = req.files.image ? req.files.image[0] : null;
        const audioFile = req.files.audio ? req.files.audio[0] : null;

        if (!imageFile) {
            return res.status(400).json({ error: 'Image is required' });
        }

        // User context from either text or transcribed audio
        let userContext = '';

        // Process text context if provided
        if (textContext) {
            userContext = textContext;
            console.log('Using text context:', textContext.substring(0, 100) + (textContext.length > 100 ? '...' : ''));
        }

        // Process audio file if provided (transcribe with OpenAI)
        if (audioFile) {
            try {
                console.log('Transcribing audio file...');
                userContext = await transcribeAudio(audioFile.path);
                console.log('Audio transcription:', userContext.substring(0, 100) + (userContext.length > 100 ? '...' : ''));
            } catch (transcriptionError) {
                console.error('Error transcribing audio:', transcriptionError);
                // Continue without transcription if it fails
            }
        }

        // Analyze image using GPT-4 Vision
        const imageBase64 = fs.readFileSync(imageFile.path, { encoding: 'base64' });
        const imageAnalysis = await analyzeImage(imageBase64);
        console.log("Image analysis complete");

        // Setup customization options
        const customization = {
            tone: tone || 'casual',
            length: length || 'medium',
            language: language || 'english',
            emoji: emoji || 'moderate',
            hashtags: hashtags || 'moderate'
        };

        console.log("Using caption options:", customization);

        // Get song details and analysis if trackId is provided
        let songAnalysis = null;
        if (trackId) {
            try {
                songAnalysis = await analyzeSong(trackId);
                console.log("Song analysis complete");
            } catch (songError) {
                console.error('Error analyzing song:', songError);
                // Continue without song analysis if it fails
            }
        }

        // Generate caption
        const caption = await generateCaption(imageAnalysis, songAnalysis, userContext, customization);
        console.log("Caption generated successfully");

        // Clean up uploaded files
        fs.unlinkSync(imageFile.path);
        if (audioFile) {
            fs.unlinkSync(audioFile.path);
        }

        res.json({ caption });
    } catch (error) {
        console.error('Error generating caption:', error);
        res.status(500).json({ error: 'Error generating caption' });
    }
});

// New function to transcribe audio using OpenAI
async function transcribeAudio(audioFilePath) {
    try {
        const response = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioFilePath),
            model: "whisper-1",
        });

        return response.text;
    } catch (error) {
        console.error('OpenAI transcription error:', error);
        throw new Error('Failed to transcribe audio');
    }
}


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
    try {
        console.log('Starting image analysis with OpenAI');

        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key is not configured');
        }

        // Format the base64 string correctly with the proper MIME type prefix
        const imageUrl = base64Image.startsWith('data:')
            ? base64Image
            : `data:image/jpeg;base64,${base64Image}`;

        console.log('Making request to OpenAI API');
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are an observant friend with a good eye for detail. You notice things in photos that others might miss, and you describe scenes in a relatable, personal way."
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "My friend sent me this image. Can you tell me what you notice about it? Focus on what stands out to you personally, specific details that catch your eye, the mood or vibe it gives off, and what feelings or memories it might evoke. Don't be overly formal or analytical - just describe it the way a friend would when looking at someone's photo. Mention 3-4 key elements or details that would be good to reference in an Instagram caption."
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: imageUrl
                            }
                        }
                    ]
                }
            ],
            max_tokens: 300,
            temperature: 0.7  // Slightly more creative to get varied human-like responses
        });

        console.log('Received OpenAI response');
        return response.choices[0].message.content;
    } catch (error) {
        console.error('Error in image analysis API call:', error);

        if (error.response) {
            console.error('OpenAI API error details:', error.response.data);
        }

        // Provide a fallback analysis when in production
        if (process.env.NODE_ENV === 'production') {
            console.log('Using fallback analysis due to error');
            return "This image has a really interesting vibe to it. There's something about the lighting and composition that gives it a unique feel. It's the kind of scene that would go perfectly with the right soundtrack.";
        }

        throw error;
    }
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

// Update the generateCaption function in server.js to incorporate user context and customization options
async function generateCaption(imageAnalysis, songAnalysis, userContext = '', customization = {}) {
    // Set default values if customization options are not provided
    const options = {
        tone: customization.tone || 'casual',
        length: customization.length || 'medium',
        language: customization.language || 'english',
        emoji: customization.emoji || 'moderate',
        hashtags: customization.hashtags || 'moderate',
        style: customization.style || 'balanced',
        focus: customization.focus || 'balanced'
    };

    // Define length parameters
    const lengthMap = {
        'very-short': {description: 'very brief, just 1 sentence', maxWords: 20},
        'short': {description: 'concise', maxWords: 40},
        'medium': {description: 'standard length', maxWords: 70},
        'long': {description: 'detailed', maxWords: 120},
        'very-long': {description: 'extended and elaborate', maxWords: 200}
    };

    const lengthParams = lengthMap[options.length] || lengthMap.medium;

    // Define emoji parameters
    const emojiMap = {
        'none': 'Do not use any emojis',
        'minimal': 'Use 1-2 emojis at most, only where they naturally fit',
        'moderate': 'Use a few well-placed emojis that enhance the message',
        'abundant': 'Use emojis generously throughout to express emotion'
    };

    const emojiParams = emojiMap[options.emoji] || emojiMap.moderate;

    // Define hashtag parameters
    const hashtagMap = {
        'none': 'No hashtags',
        'minimal': '1-3 highly relevant hashtags',
        'moderate': '4-7 well-chosen hashtags',
        'abundant': '8+ diverse and comprehensive hashtags'
    };

    const hashtagParams = hashtagMap[options.hashtags] || hashtagMap.moderate;

    // Define tone context and examples
    const toneExamples = {
        'casual': {
            description: 'relaxed, conversational, everyday language',
            example: 'Just vibing to this track while taking in the view. Sometimes the simplest moments hit different.'
        },
        'professional': {
            description: 'polished, sophisticated, refined language',
            example: 'Exploring the intersection of visual aesthetics and musical composition, finding harmony in both art forms.'
        },
        'friendly': {
            description: 'warm, approachable, personable',
            example: 'Hey friends! This song has been my absolute go-to lately - it just matches the energy of these beautiful surroundings perfectly! Who else feels this?'
        },
        'humorous': {
            description: 'witty, playful, amusing',
            example: "When the song hits just right and you pretend you're in a music video but really you're just waiting for your coffee to brew. #MainCharacterMoment"
        },
        'dark-humor': {
            description: 'comedy with an edge, morbid or cynical undertones',
            example: "Blasting upbeat music to drown out the existential dread. This view almost makes me forget my crippling debt. Almost."
        },
        'inspirational': {
            description: 'uplifting, motivational, encouraging',
            example: 'Every step forward is progress. Let this view remind you that the journey is just as beautiful as the destination.'
        },
        'thoughtful': {
            description: 'reflective, contemplative, insightful',
            example: 'In the quiet moments between the notes, I find myself reflecting on how music colors our perceptions of the world around us.'
        },
        'poetic': {
            description: 'lyrical, metaphorical, artistic',
            example: "Whispers of melody dance across sunlit waters, each ripple a verse in nature's endless song."
        },
        'sarcastic': {
            description: 'ironic, dry humor, subtle mockery',
            example: 'Oh sure, just another average day listening to life-changing music while witnessing breathtaking scenery. No big deal.'
        },
        'enthusiastic': {
            description: 'excited, energetic, passionate',
            example: "I AM ABSOLUTELY OBSESSED with this song right now!! It matches this incredible scene so perfectly I can't even handle it!!!"
        },
        'mysterious': {
            description: 'intriguing, enigmatic, subtle',
            example: 'Some moments defy explanation... the music knows what the eyes see but the words cannot express.'
        }
    };

    const toneParams = toneExamples[options.tone] || toneExamples.casual;

    // Prepare user context section - only include if there is actual context
    const userContextSection = userContext
        ? `
USER-PROVIDED CONTEXT ABOUT THIS IMAGE:
${userContext}
`
        : '';

    // Prepare song information - only include if song is provided
    const songSection = songAnalysis
        ? `
THE SONG I'M FEATURING:
"${songAnalysis.name}" by ${songAnalysis.artist}
From: ${songAnalysis.album}
Vibe: ${songAnalysis.description}
`
        : '';

    // Modify the formatting instructions based on whether a song is included
    const formatInstructions = songAnalysis
        ? `FORMAT:
[Main caption text in ${options.language}${options.language === 'hinglish' ? ' (mix of Hindi and English)' : ''}]

[Hashtags if requested, placed below the main caption]

🎵: "${songAnalysis.name}" - ${songAnalysis.artist}`
        : `FORMAT:
[Main caption text in ${options.language}${options.language === 'hinglish' ? ' (mix of Hindi and English)' : ''}]

[Hashtags if requested, placed below the main caption]`;

    // Generate caption with image analysis, song info, and user context
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: `You are a skilled social media copywriter who creates authentic, human Instagram captions. Your captions never feel AI-generated or formulaic. Instead, they capture the genuine voice of a real person expressing themselves naturally on social media.`
            },
            {
                role: "user",
                content: `
I need a natural-sounding Instagram caption for a post. I want it to feel authentic and human, not AI-generated.

THE IMAGE SHOWS:
${imageAnalysis}
${userContextSection}
${songSection}
CAPTION STYLE:
- Tone: ${toneParams.description}
- Length: ${lengthParams.description} (around ${lengthParams.maxWords} words max)
- Emoji usage: ${emojiParams}
- Hashtags: ${hashtagParams}
- Language: ${options.language}${options.language === 'hinglish' ? ' (mix of Hindi and English)' : ''}

WHAT MAKES HUMAN CAPTIONS DIFFERENT FROM AI CAPTIONS:
1. Humans are subjective and speak from personal experience
2. Humans use imperfect language with natural flow
3. Humans make specific observations rather than generic descriptions
4. Humans express authentic emotions and vulnerability
5. Humans make unexpected connections between ideas
6. Humans use varied sentence structure and conversational patterns
7. Humans sometimes include casual interjections or asides

${options.language === 'hindi' ? `
SPECIFIC GUIDELINES FOR HINDI CAPTIONS:
- Use natural Hindi expressions and colloquialisms that a native speaker would use
- Incorporate common Hindi slang or phrases used on social media
- Use Devanagari script properly
- Mix formal and informal Hindi as appropriate for social media
- Use culturally relevant references that would resonate with Hindi speakers
` : ''}

${options.language === 'hinglish' ? `
SPECIFIC GUIDELINES FOR HINGLISH CAPTIONS:
- Naturally mix Hindi and English the way young Indians do on social media
- Use Romanized Hindi (Hindi written in English letters) for Hindi words
- Switch between languages mid-sentence in a natural way
- Include popular Hinglish expressions and slang
- Keep the tone conversational and authentic to how young Indians actually write
- Use phrases like "yaar", "matlab", "bas", "ekdum", etc. where they naturally fit
` : ''}

${options.tone === 'dark-humor' ? `
SPECIFIC GUIDELINES FOR DARK HUMOR TONE:
- Use irony, sarcasm, and self-deprecation
- Balance edginess with accessibility - don't go too extreme
- Incorporate witty observations on life's difficulties or absurdities
- Keep it instagram-appropriate while maintaining the dark humor edge
- Use juxtaposition between the upbeat song and more cynical observations
- Avoid content that would be genuinely hurtful or offensive
- Focus on relatable dark humor about everyday life struggles
` : ''}

For reference, here's an example of the TONE I want (but create a totally new caption specific to my image${songAnalysis ? ' and song' : ''}):
"${toneParams.example}"

Please write a caption that:
1. Makes a natural, specific connection ${songAnalysis ? 'between the image and the song' : 'to the image'}
2. Includes personal perspective and subjective feelings${userContext ? "\n3. Incorporates the personal context I've shared about the image" : ""}
${userContext ? "4" : "3"}. Feels like something a real person would actually post on Instagram
${userContext ? "5" : "4"}. Avoids clichéd phrases and overly formal language
${userContext ? "6" : "5"}. Sounds relaxed and authentic, not formulaic
${songAnalysis ? (userContext ? "7" : "6") + ". Includes the song credit at the end" : ""}

${formatInstructions}
`
            }
        ],
        max_tokens: 500,
        temperature: 0.85  // Slightly higher temperature for more creative, varied results
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