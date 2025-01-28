// 9. Update src/App.js:
import React, { useState, useRef } from 'react';
import ImageUpload from './components/ImageUpload';
import SongSearch from './components/SongSearch';
import GeneratedCaption from './components/GeneratedCaption';
import LoadingSpinner from './components/LoadingSpinner';

function App() {
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
          `${process.env.BACKEND_URL}/api/search-tracks?query=${encodeURIComponent(query)}`
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
      const response = await fetch(`${process.env.BACKEND_URL}/api/generate-caption`, {
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

        <ImageUpload
            imagePreview={imagePreview}
            onImageSelect={handleImageSelect}
            fileInputRef={fileInputRef}
        />

        <SongSearch
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            selectedTrack={selectedTrack}
            onTrackSelect={handleTrackSelect}
            onSearch={searchTracks}
        />

        <button
            onClick={handleSubmit}
            disabled={loading || !selectedImage || !selectedTrack}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
        >
          {loading ? (
              <>
                <LoadingSpinner />
                <span>Generating...</span>
              </>
          ) : (
              <span>Generate Caption</span>
          )}
        </button>

        {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
        )}

        {caption && <GeneratedCaption caption={caption} />}
      </div>
  );
}

export default App;