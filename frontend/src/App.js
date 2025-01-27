import React, { useState, useRef } from 'react';
import { Search, Upload, Loader2 } from 'lucide-react';

const CaptionGenerator = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef();

  const searchTracks = async (query) => {
    try {
      const response = await fetch(
          `http://localhost:3001/api/search-tracks?query=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      setSearchResults(data.tracks);
    } catch (error) {
      setError('Error searching tracks');
      console.error('Error:', error);
    }
  };

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTrackSelect = (track) => {
    setSelectedTrack(track);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleSubmit = async () => {
    if (!selectedImage || !selectedTrack) {
      setError('Please select both an image and a song');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('image', selectedImage);
    formData.append('trackId', selectedTrack.id);

    try {
      const response = await fetch('http://localhost:3001/api/generate-caption', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setCaption(data.caption);
    } catch (error) {
      setError('Error generating caption');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <h1 className="text-3xl font-bold text-center mb-8">
          Instagram Caption Generator
        </h1>

        {/* Image Upload Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">1. Upload Image</h2>
          <div
              onClick={() => fileInputRef.current.click()}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
          >
            {imagePreview ? (
                <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-64 mx-auto rounded"
                />
            ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 mx-auto text-gray-400" />
                  <p>Click to upload an image</p>
                </div>
            )}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
            />
          </div>
        </div>

        {/* Song Search Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">2. Select Song</h2>
          <div className="relative">
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length > 2) {
                    searchTracks(e.target.value);
                  }
                }}
                placeholder="Search for a song..."
                className="w-full p-3 pr-10 border rounded-lg"
            />
            <Search className="absolute right-3 top-3 text-gray-400" />
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {searchResults.map((track) => (
                    <div
                        key={track.id}
                        onClick={() => handleTrackSelect(track)}
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

          {/* Selected Track */}
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

        {/* Generate Button */}
        <button
            onClick={handleSubmit}
            disabled={loading || !selectedImage || !selectedTrack}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
        >
          {loading ? (
              <>
                <Loader2 className="animate-spin" />
                <span>Generating...</span>
              </>
          ) : (
              <span>Generate Caption</span>
          )}
        </button>

        {/* Error Message */}
        {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
        )}

        {/* Generated Caption */}
        {caption && (
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Generated Caption</h2>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p>{caption}</p>
              </div>
              <button
                  onClick={() => navigator.clipboard.writeText(caption)}
                  className="text-blue-600 text-sm hover:underline"
              >
                Copy to clipboard
              </button>
            </div>
        )}
      </div>
  );
};

export default CaptionGenerator;