import React from 'react';
import { ExternalLink, Play } from 'lucide-react';

const SpotifyPlayer = ({ track }) => {
    if (!track) return null;

    // Format track ID for Spotify URL
    const spotifyId = track.id;
    const spotifyUri = `spotify:track:${spotifyId}`;
    const spotifyEmbedUrl = `https://open.spotify.com/embed/track/${spotifyId}?utm_source=captionmuse&theme=0`;
    const spotifyUrl = `https://open.spotify.com/track/${spotifyId}`;

    // Open in Spotify app or web
    const openInSpotify = () => {
        // Try to open the Spotify app first
        window.location.href = spotifyUri;

        // Fallback to browser if app doesn't open
        setTimeout(() => {
            window.open(spotifyUrl, '_blank');
        }, 1000);
    };

    return (
        <div className="border rounded-lg p-4 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-medium">Selected Track</h3>
            </div>

            <div className="flex flex-col space-y-4">
                {/* Track info */}
                <div className="flex items-center space-x-4">
                    {track.albumArt && (
                        <img
                            src={track.albumArt}
                            alt={track.album}
                            className="w-16 h-16 rounded object-cover"
                        />
                    )}
                    <div>
                        <p className="font-medium">{track.name}</p>
                        <p className="text-gray-600">{track.artist}</p>
                        <p className="text-sm text-gray-500">{track.album}</p>
                    </div>
                </div>

                {/* Spotify iframe embed */}
                <div className="w-full h-[80px] bg-slate-900/90 dark:bg-slate-900/90 rounded overflow-hidden border border-slate-800/60">
                    <iframe
                        title="Spotify Player"
                        src={spotifyEmbedUrl}
                        width="100%"
                        height="80"
                        frameBorder="0"
                        allowTransparency="true"
                        allow="encrypted-media"
                        loading="lazy"
                        className="w-full h-full bg-slate-900 text-white"
                        style={{ backgroundColor: '#0b1224' }}
                    ></iframe>
                </div>

                {/* Open in Spotify button */}
                <button
                    onClick={openInSpotify}
                    className="flex items-center justify-center space-x-2 w-full py-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
                >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open in Spotify</span>
                </button>
            </div>
        </div>
    );
};

export default SpotifyPlayer;
