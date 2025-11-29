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
                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{introTitle}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{introDescription}</p>
                </div>
            )}

            <div className="relative group">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={handleChange}
                    placeholder="Search for a song, artist, or mood…"
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/80 backdrop-blur-sm px-4 py-3 pr-12 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200 dark:border-purple-500/40 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:border-purple-400 dark:focus:ring-purple-500/40"
                />
                <Search className="absolute right-4 top-3.5 text-slate-400 dark:text-slate-500 transform transition-transform duration-200 group-hover:scale-110 group-focus-within:text-purple-500" />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/0 via-pink-500/0 to-orange-500/0 group-hover:from-purple-500/5 group-hover:via-pink-500/5 group-hover:to-orange-500/5 dark:group-hover:from-purple-900/40 dark:group-hover:via-pink-900/35 dark:group-hover:to-orange-900/30 transition-all duration-300 pointer-events-none"></div>
            </div>

            {searchResults.length > 0 && (
                <div className="border-2 border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm shadow-lg dark:shadow-[0_20px_60px_rgba(0,0,0,0.55)] animate-fade-in-up">
                    {searchResults.map((track, index) => (
                        <button
                            type="button"
                            key={track.id}
                            onClick={() => onTrackSelect(track)}
                            className="w-full p-3 hover:bg-gradient-to-r hover:from-purple-50 hover:via-pink-50 hover:to-orange-50 dark:hover:from-purple-900/35 dark:hover:via-pink-900/30 dark:hover:to-orange-900/25 flex items-center gap-3 transition-all duration-200 text-left transform hover:scale-[1.02] group"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            {track.albumArt && (
                                <img
                                    src={track.albumArt}
                                    alt={track.album}
                                    className="w-12 h-12 rounded-xl object-cover shadow-md transform transition-transform duration-200 group-hover:scale-110"
                                />
                            )}
                            <div className="flex-1">
                                <p className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">{track.name}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{track.artist}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {selectedTrack && (
                <div className="border-2 border-purple-200 dark:border-purple-500/50 rounded-2xl p-4 flex items-center gap-4 bg-gradient-to-r from-purple-50 via-pink-50 to-orange-50 dark:from-purple-900/50 dark:via-pink-900/40 dark:to-orange-900/35 shadow-md animate-fade-in-up transform transition-all duration-300 hover:shadow-lg dark:shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
                    {selectedTrack.albumArt && (
                        <img
                            src={selectedTrack.albumArt}
                            alt={selectedTrack.album}
                            className="w-16 h-16 rounded-2xl object-cover"
                        />
                    )}
                    <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedTrack.name}</p>
                        <p className="text-slate-600 dark:text-slate-300">{selectedTrack.artist}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{selectedTrack.album}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SongSearch;
