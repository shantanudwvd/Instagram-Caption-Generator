const OpenAI = require('openai');
const dotenv = require('dotenv');
const logger = require('../utils/logger');

dotenv.config();

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Service to generate song recommendations based on image analysis and user preferences
 */
class SongRecommendationService {
    constructor(spotifyApi) {
        this.spotifyApi = spotifyApi;
    }

    /**
     * Generate song recommendations based on image analysis
     *
     * @param {string} imageAnalysis - The analysis of the uploaded image
     * @param {Object} [currentTrack] - Optional currently selected track
     * @returns {Promise<Array>} Array of recommended tracks
     */
    async getRecommendations(imageAnalysis, currentTrack = null) {
        try {
            // Generate search queries based on image analysis
            const searchQueries = await this.generateSearchQueries(imageAnalysis, currentTrack);
            logger.debug('Generated search queries', { searchQueries });

            // Search for tracks using the generated queries
            const recommendations = await this.searchTracksWithQueries(searchQueries);

            // Filter out the current track if it exists
            const filteredRecommendations = currentTrack
                ? recommendations.filter(track => track.id !== currentTrack.id)
                : recommendations;

            // Return top 5 recommendations
            return filteredRecommendations.slice(0, 5);
        } catch (error) {
            logger.error('Error generating recommendations', { 
                error: error.message, 
                stack: error.stack 
            });

            // Fallback: Use default queries if there's an error
            logger.warn('Using fallback search queries');
            const defaultQueries = ["chill music", "relaxing songs", "popular hits", "mood music", "vibes"];
            const recommendations = await this.searchTracksWithQueries(defaultQueries);
            return recommendations.slice(0, 5);
        }
    }

    /**
     * Generate search queries based on image analysis
     *
     * @param {string} imageAnalysis - The analysis of the uploaded image
     * @param {Object} [currentTrack] - Optional currently selected track
     * @returns {Promise<Array>} Array of search queries
     */
    async generateSearchQueries(imageAnalysis, currentTrack) {
        // Create a prompt for GPT to generate search queries
        const currentTrackInfo = currentTrack ?
            `Currently selected song: "${currentTrack.name}" by ${currentTrack.artist} from album "${currentTrack.album}"` :
            'No song currently selected.';

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-2024-11-20",
                messages: [
                    {
                        role: "user",
                        content: `
                        Based on the following image analysis, generate 5 distinct search queries for finding songs that would match the mood, theme, and aesthetics of this image.

                        IMAGE ANALYSIS:
                        ${imageAnalysis}

                        ${currentTrackInfo}

                        For each query, consider:
                        1. The dominant mood/emotion
                        2. Key visual elements and their symbolic meaning
                        3. Color palette and what it evokes
                        4. Time of day/setting and its atmosphere
                        5. Activities or themes present in the image

                        FORMAT YOUR RESPONSE AS FIVE PLAIN SEARCH QUERIES, ONE PER LINE.
                        DO NOT include numbering, explanation or JSON formatting. Just the queries.
                        Example response:
                        chill lofi beats
                        relaxing piano music
                        upbeat morning motivation
                        peaceful ambient sounds
                        energetic workout music
                        `
                    }
                ],
                max_tokens: 300
            });

            const content = response.choices[0].message.content.trim();
            logger.debug('GPT raw response for search queries', { content });

            // Split by new lines and filter empty lines
            const queries = content.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.startsWith('#') && !line.match(/^\d+\.\s/));

            // Ensure we have at least some queries
            if (queries.length > 0) {
                return queries.slice(0, 5); // Return at most 5 queries
            }

            // Fallback
            return ["chill music", "relaxing songs", "popular hits", "mood music", "vibes"];

        } catch (error) {
            logger.error('Error generating search queries', { 
                error: error.message, 
                stack: error.stack 
            });
            return ["chill music", "relaxing songs", "popular hits", "mood music", "vibes"];
        }
    }

    /**
     * Search for tracks using multiple queries and aggregate results
     *
     * @param {Array} queries - Search queries
     * @returns {Promise<Array>} Array of tracks
     */
    async searchTracksWithQueries(queries) {
        const allResults = [];
        const seenTrackIds = new Set();

        for (const query of queries) {
            try {
                const data = await this.spotifyApi.searchTracks(query, {limit: 5});

                if (!data.body || !data.body.tracks || !data.body.tracks.items) {
                    logger.warn('No results found for query', { query });
                    continue;
                }

                for (const track of data.body.tracks.items) {
                    // Avoid duplicate tracks
                    if (!seenTrackIds.has(track.id)) {
                        seenTrackIds.add(track.id);
                        allResults.push({
                            id: track.id,
                            name: track.name,
                            artist: track.artists[0]?.name || 'Unknown Artist',
                            album: track.album?.name || 'Unknown Album',
                            albumArt: track.album?.images[0]?.url || null,
                            popularity: track.popularity || 0,
                            relevanceScore: this.calculateRelevanceScore(track, query)
                        });
                    }
                }
            } catch (error) {
                logger.warn('Error searching for tracks with query', { 
                    query, 
                    error: error.message 
                });
                // Continue with next query
            }
        }

        // Sort by relevance score
        return allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    /**
     * Calculate a relevance score for a track based on popularity and query matching
     *
     * @param {Object} track - Track information
     * @param {string} query - The search query
     * @returns {number} Relevance score
     */
    calculateRelevanceScore(track, query) {
        // Base score from popularity (0-100)
        let score = track.popularity || 50;

        // Normalize terms for comparison
        const normalizedQuery = query.toLowerCase();
        const normalizedName = track.name?.toLowerCase() || '';
        const normalizedArtist = track.artists?.[0]?.name?.toLowerCase() || '';
        const normalizedAlbum = track.album?.name?.toLowerCase() || '';

        // Bonus points for matching terms in the name, artist, or album
        if (normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName)) {
            score += 20;
        }

        if (normalizedArtist.includes(normalizedQuery) || normalizedQuery.includes(normalizedArtist)) {
            score += 15;
        }

        if (normalizedAlbum.includes(normalizedQuery) || normalizedQuery.includes(normalizedAlbum)) {
            score += 10;
        }

        return score;
    }
}

module.exports = SongRecommendationService;