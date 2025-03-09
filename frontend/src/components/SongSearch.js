import React from 'react';
import { Search } from 'lucide-react';

const SongSearch = ({
                        searchQuery,
                        setSearchQuery,
                        searchResults,
                        selectedTrack,
                        onTrackSelect,
                        onSearch
                    }) => {
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">2. Select Song</h2>
            <div className="relative">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (e.target.value.length > 2) {
                            onSearch(e.target.value);
                        }
                    }}
                    placeholder="Search for a song..."
                    className="w-full p-3 pr-10 border rounded-lg"
                />
                <Search className="absolute right-3 top-3 text-gray-400" />
            </div>

            {searchResults.length > 0 && (
                <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                    {searchResults.map((track) => (
                        <div
                            key={track.id}
                            onClick={() => onTrackSelect(track)}
                            className="p-3 hover:bg-gray-50 cursor-pointer flex items-center space-x-3"
                        >
                            {track.albumArt && (
                                <img
                                    src={track.albumArt}
                                    alt={track.album}
                                    className="w-12 h-12 rounded"
                                />
                            )}
                            <div>
                                <p className="font-medium">{track.name}</p>
                                <p className="text-sm text-gray-600">{track.artist}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedTrack && (
                <div className="border rounded-lg p-4 flex items-center space-x-4">
                    {selectedTrack.albumArt && (
                        <img
                            src={selectedTrack.albumArt}
                            alt={selectedTrack.album}
                            className="w-16 h-16 rounded"
                        />
                    )}
                    <div>
                        <p className="font-medium">{selectedTrack.name}</p>
                        <p className="text-gray-600">{selectedTrack.artist}</p>
                        <p className="text-sm text-gray-500">{selectedTrack.album}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SongSearch;