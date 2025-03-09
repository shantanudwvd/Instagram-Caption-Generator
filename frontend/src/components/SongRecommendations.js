import React from 'react';
import { Music } from 'lucide-react';

const SongRecommendations = ({ recommendations, onTrackSelect, loading }) => {
    if (loading) {
        return (
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Song Recommendations</h2>
                <div className="animate-pulse space-y-3">
                    {[...Array(3)].map((_, index) => (
                        <div key={index} className="border rounded-lg p-4 flex items-center space-x-4">
                            <div className="bg-gray-200 w-16 h-16 rounded"></div>
                            <div className="space-y-2 flex-1">
                                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!recommendations || recommendations.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
                <Music className="h-5 w-5" />
                Similar Songs You Might Like
            </h2>
            <div className="space-y-3">
                {recommendations.map((track) => (
                    <div
                        key={track.id}
                        onClick={() => onTrackSelect(track)}
                        className="border rounded-lg p-4 flex items-center space-x-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                        {track.albumArt ? (
                            <img
                                src={track.albumArt}
                                alt={track.album}
                                className="w-16 h-16 rounded object-cover"
                            />
                        ) : (
                            <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                                <Music className="text-gray-400" />
                            </div>
                        )}
                        <div>
                            <p className="font-medium">{track.name}</p>
                            <p className="text-gray-600">{track.artist}</p>
                            <p className="text-sm text-gray-500">{track.album}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SongRecommendations;