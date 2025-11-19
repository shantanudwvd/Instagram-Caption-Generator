import React from 'react';
import { Music } from 'lucide-react';

const SongRecommendations = ({ recommendations, onTrackSelect, loading }) => {
    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-700">
                    <Music className="h-5 w-5 text-blue-500" />
                    <h2 className="text-lg font-semibold">Curating soundscapes…</h2>
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
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-700">
                <Music className="h-5 w-5 text-blue-500" />
                <h2 className="text-lg font-semibold">Similar songs you might love</h2>
            </div>
            <div className="space-y-3">
                {recommendations.map((track) => (
                    <button
                        type="button"
                        key={track.id}
                        onClick={() => onTrackSelect(track)}
                        className="w-full border border-slate-100 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-blue-200 hover:bg-blue-50/40 transition"
                    >
                        {track.albumArt ? (
                            <img
                                src={track.albumArt}
                                alt={track.album}
                                className="w-16 h-16 rounded-2xl object-cover"
                            />
                        ) : (
                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
                                <Music className="text-slate-400" />
                            </div>
                        )}
                        <div className="text-left">
                            <p className="font-semibold text-slate-900">{track.name}</p>
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
