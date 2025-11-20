import React from 'react';
import { Music } from 'lucide-react';

const SongRecommendations = ({ recommendations, onTrackSelect, loading }) => {
    if (loading) {
        return (
            <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-700">
                <Music className="h-5 w-5 text-purple-500 animate-pulse" />
                <h2 className="text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">Curating soundscapes…</h2>
            </div>
                <div className="space-y-3">
                    {[...Array(3)].map((_, index) => (
                        <div
                            key={index}
                            className="animate-pulse bg-white/70 border border-slate-100 rounded-2xl p-4 flex items-center gap-4"
                        >
                            <div className="bg-slate-200 w-16 h-16 rounded-xl" />
                            <div className="space-y-2 flex-1">
                                <div className="h-4 bg-slate-200 rounded w-3/4" />
                                <div className="h-3 bg-slate-200 rounded w-1/2" />
                                <div className="h-3 bg-slate-200 rounded w-1/3" />
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
        <div className="space-y-4 animate-fade-in-up">
            <div className="flex items-center gap-2 text-slate-700">
                <Music className="h-5 w-5 text-purple-500 transform transition-transform duration-200 hover:scale-110" />
                <h2 className="text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">Similar songs you might love</h2>
            </div>
            <div className="space-y-3">
                {recommendations.map((track, index) => (
                    <button
                        type="button"
                        key={track.id}
                        onClick={() => onTrackSelect(track)}
                        className="w-full border-2 border-slate-200 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-purple-300 hover:bg-gradient-to-r hover:from-purple-50 hover:via-pink-50 hover:to-orange-50 transition-all duration-200 transform hover:scale-[1.02] shadow-md hover:shadow-lg bg-white/80 backdrop-blur-sm animate-fade-in-up group"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        {track.albumArt ? (
                            <img
                                src={track.albumArt}
                                alt={track.album}
                                className="w-16 h-16 rounded-2xl object-cover shadow-md transform transition-transform duration-200 group-hover:scale-110"
                            />
                        ) : (
                            <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center">
                                <Music className="text-purple-400" />
                            </div>
                        )}
                        <div className="text-left flex-1">
                            <p className="font-semibold text-slate-900 group-hover:text-purple-600 transition-colors">{track.name}</p>
                            <p className="text-sm text-slate-500">{track.artist}</p>
                            <p className="text-xs text-slate-400 uppercase tracking-wide">{track.album}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SongRecommendations;
