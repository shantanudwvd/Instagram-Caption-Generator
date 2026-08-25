const SpotifyWebApi = require('spotify-web-api-node');
const logger = require('../utils/logger');

let spotifyApi = null;
let tokenExpirationTime = null;
let refreshTimeout = null;
let initPromise = null;

function createSpotifyClient() {
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
        throw new Error('Spotify client credentials are not configured');
    }

    return new SpotifyWebApi({
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        redirectUri: process.env.SPOTIFY_REDIRECT_URI,
    });
}

function scheduleRefresh(expiresInSeconds, fallbackDelayMs = 50 * 60 * 1000) {
    const bufferMs = 60 * 1000; // refresh one minute before expiry
    const minDelayMs = 5 * 60 * 1000; // avoid hot loops on failure
    const baseDelayMs = expiresInSeconds ? expiresInSeconds * 1000 : fallbackDelayMs;
    const delayMs = Math.max(baseDelayMs - bufferMs, minDelayMs);

    if (refreshTimeout) {
        clearTimeout(refreshTimeout);
    }

    refreshTimeout = setTimeout(() => {
        refreshSpotifyToken('scheduled').catch((error) => {
            logger.error('Scheduled Spotify token refresh failed', {
                error: error.message,
                stack: error.stack,
            });
            scheduleRefresh(null, minDelayMs);
        });
    }, delayMs);
}

async function refreshSpotifyToken(reason = 'manual') {
    if (!spotifyApi) {
        spotifyApi = createSpotifyClient();
    }

    const data = await spotifyApi.clientCredentialsGrant();
    const accessToken = data.body['access_token'];
    const expiresInSeconds = data.body['expires_in'] || 3600;

    spotifyApi.setAccessToken(accessToken);
    tokenExpirationTime = Date.now() + expiresInSeconds * 1000;

    logger.info('Spotify token refreshed', { reason, expiresInSeconds });
    scheduleRefresh(expiresInSeconds);
}

async function initializeSpotifyClient() {
    if (initPromise) {
        return initPromise;
    }

    initPromise = (async () => {
        if (!spotifyApi) {
            spotifyApi = createSpotifyClient();
        }

        await refreshSpotifyToken('startup');
        return spotifyApi;
    })().catch((error) => {
        initPromise = null;
        throw error;
    });

    return initPromise;
}

async function ensureSpotifyToken() {
    if (!spotifyApi || !tokenExpirationTime) {
        await initializeSpotifyClient();
        return;
    }

    if (Date.now() >= tokenExpirationTime - 60000) {
        await refreshSpotifyToken('ensure');
    }
}

function getSpotifyApi() {
    if (!spotifyApi) {
        throw new Error('Spotify client not initialized. Call initializeSpotifyClient first.');
    }
    return spotifyApi;
}

module.exports = {
    initializeSpotifyClient,
    ensureSpotifyToken,
    getSpotifyApi,
};
