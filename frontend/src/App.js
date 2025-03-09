import React, { useState, useRef } from 'react';
import ImageUpload from './components/ImageUpload';
import SongSearch from './components/SongSearch';
import GeneratedCaption from './components/GeneratedCaption';
import LoadingSpinner from './components/LoadingSpinner';
import SongRecommendations from './components/SongRecommendations';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [caption, setCaption] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef();
  const [imageAnalysis, setImageAnalysis] = useState('');

  const REACT_APP_BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  console.log("backend url is coming as: %s", REACT_APP_BACKEND_URL);

  const searchTracks = async (query) => {
    try {
      const response = await fetch(
          `${REACT_APP_BACKEND_URL}/api/search-tracks?query=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      setSearchResults(data.tracks);
    } catch (error) {
      setError('Error searching tracks');
      console.error('Error:', error);
    }
  };

  const handleImageSelect = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        getRecommendationsFromImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const getRecommendationsFromImage = async (imageData) => {
    // First analyze the image before getting recommendations
    setRecommendationsLoading(true);

    try {
      // Create FormData for image analysis
      const formData = new FormData();

      // Convert dataURL to Blob
      const fetchResponse = await fetch(imageData);
      if (!fetchResponse.ok) {
        throw new Error('Failed to process image data');
      }
      const blob = await fetchResponse.blob();
      formData.append('image', blob);

      console.log('Sending image for analysis...');

      // Get image analysis
      const analysisResponse = await fetch(`${REACT_APP_BACKEND_URL}/api/analyze-image`, {
        method: 'POST',
        body: formData,
      });

      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to analyze image');
      }

      const analysisData = await analysisResponse.json();
      console.log('Image analysis received');

      // Save the image analysis
      setImageAnalysis(analysisData.analysis);

      // Make sure we have analysis data before requesting recommendations
      if (!analysisData.analysis) {
        throw new Error('Image analysis returned empty results');
      }

      console.log('Requesting recommendations based on image analysis...');

      // Get recommendations based on image analysis
      const recommendationsResponse = await fetch(`${REACT_APP_BACKEND_URL}/api/get-recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageAnalysis: analysisData.analysis,
          // Only include currentTrack if it's not null
          ...(selectedTrack && { currentTrack: selectedTrack })
        }),
      });

      if (!recommendationsResponse.ok) {
        const errorData = await recommendationsResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get recommendations');
      }

      const recommendationsData = await recommendationsResponse.json();
      console.log(`Received ${recommendationsData.recommendations?.length || 0} recommendations`);

      if (recommendationsData.recommendations && recommendationsData.recommendations.length > 0) {
        setRecommendations(recommendationsData.recommendations);
      } else {
        console.log('No recommendations received');
      }
    } catch (error) {
      console.error('Error in recommendation process:', error);
      // Optionally show a non-intrusive message to the user
      setError(prevError => {
        // Only show error if there's no other error already
        if (!prevError) {
          setTimeout(() => setError(''), 5000); // Clear after 5 seconds
          return 'Could not load recommendations. Try selecting a song first.';
        }
        return prevError;
      });
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const handleTrackSelect = (track) => {
    setSelectedTrack(track);
    setSearchResults([]);
    setSearchQuery('');

    // Get new recommendations based on the selected track if we have image analysis
    if (imageAnalysis) {
      getRecommendationsForTrack(track);
    }
  };

  const getRecommendationsForTrack = async (track) => {
    if (!imageAnalysis) {
      console.log('No image analysis available, skipping recommendations');
      return;
    }

    setRecommendationsLoading(true);

    try {
      console.log('Requesting recommendations for track:', track.name);

      const response = await fetch(`${REACT_APP_BACKEND_URL}/api/get-recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageAnalysis,
          currentTrack: track
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get recommendations');
      }

      const data = await response.json();
      console.log(`Received ${data.recommendations?.length || 0} recommendations for track`);

      if (data.recommendations && data.recommendations.length > 0) {
        setRecommendations(data.recommendations);
      } else {
        console.log('No recommendations received for track');
      }
    } catch (error) {
      console.error('Error getting recommendations for track:', error);
      // Don't show error to user, just log it
    } finally {
      setRecommendationsLoading(false);
    }
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
      const response = await fetch(`${REACT_APP_BACKEND_URL}/api/generate-caption`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setCaption(data.caption);

      // If recommendations are included in response, update them
      if (data.recommendations) {
        setRecommendations(data.recommendations);
      }
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

        <SongRecommendations
            recommendations={recommendations}
            onTrackSelect={handleTrackSelect}
            loading={recommendationsLoading}
        />
      </div>
  );
}

export default App;