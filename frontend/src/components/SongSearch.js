import React from 'react';
import { Search } from 'lucide-react';

const SongSearch = ({
                        searchQuery,
                        setSearchQuery,
                        searchResults,
                        selectedTrack,
                        onTrackSelect,
                        onSearch,
                        showIntro = true,
                        introTitle = 'Choose an optional soundtrack',
                        introDescription = 'Search Spotify to pair a track that guides the caption’s energy.'
                    }) => {
    const handleChange = (event) => {
        const value = event.target.value;
        setSearchQuery(value);
        if (value.trim().length > 2) {
            onSearch(value);
        }
    };

    return (
        <div className="space-y-5">
            {showIntro && (
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-indigo-500 font-semibold">Step 2</p>
                    <h2 className="text-2xl font-semibold text-slate-900">{introTitle}</h2>
                    <p className="text-sm text-slate-500">{introDescription}</p>
                </div>
            )}

            <div className="relative">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={handleChange}
                    placeholder="Search for a song, artist, or mood…"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="absolute right-4 top-3.5 text-slate-400" />
            </div>

            {searchResults.length > 0 && (
                <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-64 overflow-y-auto bg-white shadow-sm">
                    {searchResults.map((track) => (
                        <button
                            type="button"
                            key={track.id}
                            onClick={() => onTrackSelect(track)}
                            className="w-full p-3 hover:bg-slate-50 flex items-center gap-3 transition text-left"
                        >
                            {track.albumArt && (
                                <img
                                    src={track.albumArt}
                                    alt={track.album}
                                    className="w-12 h-12 rounded-xl object-cover"
                                />
                            )}
                            <div>
                                <p className="font-medium text-slate-900">{track.name}</p>
                                <p className="text-sm text-slate-500">{track.artist}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {selectedTrack && (
                <div className="border border-slate-200 rounded-2xl p-4 flex items-center gap-4 bg-slate-50">
                    {selectedTrack.albumArt && (
                        <img
                            src={selectedTrack.albumArt}
                            alt={selectedTrack.album}
                            className="w-16 h-16 rounded-2xl object-cover"
                        />
                    )}
                    <div>
                        <p className="font-semibold text-slate-900">{selectedTrack.name}</p>
                        <p className="text-slate-600">{selectedTrack.artist}</p>
                        <p className="text-sm text-slate-500">{selectedTrack.album}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SongSearch;
