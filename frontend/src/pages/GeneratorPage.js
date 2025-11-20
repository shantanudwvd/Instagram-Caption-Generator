import React, { useState, useRef } from 'react';
import Navigation from '../components/Navigation';
import AuthGate from '../components/auth/AuthGate';
import ImageUpload from '../components/ImageUpload';
import SongSearch from '../components/SongSearch';
import ImageContext from '../components/ImageContext';
import CaptionOptions from '../components/CaptionOptions';
import CaptionFeedback from '../components/CaptionFeedback';
import SongRecommendations from '../components/SongRecommendations';
import SpotifyPlayer from '../components/SpotifyPlayer';
import GeneratedCaption from '../components/GeneratedCaption';
import LoadingSpinner from '../components/LoadingSpinner';
import BackButton from '../components/BackButton';
import { useAuth } from '../context/AuthContext';

const GeneratorPage = () => {
    const { user, token, isInitializing } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedTrack, setSelectedTrack] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [caption, setCaption] = useState('');
    const [captionId, setCaptionId] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [recommendationsLoading, setRecommendationsLoading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef();
    const [imageAnalysis, setImageAnalysis] = useState('');
    const [imageContext, setImageContext] = useState(null);
    const [captionOptions, setCaptionOptions] = useState({
        tone: 'casual',
        length: 'medium',
        language: 'english',
        emoji: 'moderate',
        hashtags: 'moderate'
    });
    const [musicIsOptional, setMusicIsOptional] = useState(true);

    const backendUrl = process.env.REACT_APP_BACKEND_URL;
    const cardClass = 'bg-white/90 border border-slate-100 rounded-3xl shadow-sm p-6';

    if (isInitializing) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    if (!user) {
        return <AuthGate />;
    }

    const handleContextChange = (contextData) => setImageContext(contextData);
    const handleOptionsChange = (options) => setCaptionOptions(options);
    const handleCaptionEdit = (editedCaption) => setCaption(editedCaption);

    const searchTracks = async (query) => {
        try {
            const response = await fetch(`${backendUrl}/api/search-tracks?query=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) {
                throw new Error('Failed to search tracks');
            }
            const data = await response.json();
            setSearchResults(data.tracks);
        } catch (err) {
            setError('Error searching tracks');
        }
    };

    const handleImageSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setSelectedImage(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result);
            getRecommendationsFromImage(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const getRecommendationsFromImage = async (imageData) => {
        setRecommendationsLoading(true);
        try {
            const formData = new FormData();
            const fetchResponse = await fetch(imageData);
            if (!fetchResponse.ok) {
                throw new Error('Failed to process image data');
            }
            const blob = await fetchResponse.blob();
            formData.append('image', blob);

            const analysisResponse = await fetch(`${backendUrl}/api/analyze-image`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });
            if (!analysisResponse.ok) {
                throw new Error('Failed to analyze image');
            }
            const analysisData = await analysisResponse.json();
            setImageAnalysis(analysisData.analysis);
            if (!analysisData.analysis) {
                throw new Error('Image analysis returned empty results');
            }

            const recommendationsResponse = await fetch(`${backendUrl}/api/get-recommendations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    imageAnalysis: analysisData.analysis,
                    ...(selectedTrack && { currentTrack: selectedTrack })
                })
            });
            if (!recommendationsResponse.ok) {
                throw new Error('Failed to get recommendations');
            }
            const recommendationsData = await recommendationsResponse.json();
            setRecommendations(recommendationsData.recommendations || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setRecommendationsLoading(false);
        }
    };

    const handleTrackSelect = (track) => {
        setSelectedTrack(track);
        setSearchResults([]);
        setSearchQuery('');
        if (imageAnalysis) {
            getRecommendationsForTrack(track);
        }
    };

    const getRecommendationsForTrack = async (track) => {
        if (!imageAnalysis) return;
        setRecommendationsLoading(true);
        try {
            const response = await fetch(`${backendUrl}/api/get-recommendations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ imageAnalysis, currentTrack: track })
            });
            if (!response.ok) {
                throw new Error('Failed to get recommendations');
            }
            const data = await response.json();
            setRecommendations(data.recommendations || []);
        } catch (err) {
            console.error(err);
        } finally {
            setRecommendationsLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!selectedImage) {
            setError('Please upload an image');
            return;
        }

        if (!musicIsOptional && !selectedTrack) {
            setError('Please select a song to continue');
            return;
        }

        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('image', selectedImage);
        if (selectedTrack) {
            formData.append('trackId', selectedTrack.id);
        }
        if (imageContext) {
            if (imageContext.type === 'text' && imageContext.data) {
                formData.append('textContext', imageContext.data);
            } else if (imageContext.type === 'audio' && imageContext.data) {
                formData.append('audio', imageContext.data, 'recording.webm');
            }
        }
        Object.entries(captionOptions).forEach(([key, value]) => formData.append(key, value));

        try {
            const response = await fetch(`${backendUrl}/api/generate-caption`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            setCaption(data.caption);
            if (data.captionId) {
                setCaptionId(data.captionId);
            }
            if (data.recommendations) {
                setRecommendations(data.recommendations);
            }
        } catch (err) {
            setError(err.message || 'Error generating caption');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Navigation />
            <div className="min-h-screen relative overflow-hidden pb-12">
                {/* Animated Gradient Background */}
                <div className="absolute inset-0 animate-gradient-xy opacity-30" style={{
                    background: 'linear-gradient(-45deg, #9333ea, #ec4899, #f97316, #9333ea, #ec4899, #f97316)',
                    backgroundSize: '400% 400%'
                }}></div>
                
                {/* Floating Orbs */}
                <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-20 left-1/2 w-96 h-96 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
                
                <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
                    <section className="space-y-4 animate-fade-in">
                        <div className="flex justify-start">
                            <BackButton to="/" label="Back to Profile" />
                        </div>
                        <div className="text-center space-y-4">
                            <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white shadow-lg animate-fade-in-up">
                                AI Story Studio
                            </span>
                            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent animate-fade-in-up animation-delay-100">
                                Instagram Caption Generator
                            </h1>
                            <p className="text-base text-slate-600 max-w-3xl mx-auto animate-fade-in-up animation-delay-200">
                                Upload your moodboard-worthy shots, pick a track, and let Caption Muse craft a caption that feels curated, human, and ready for your feed.
                            </p>
                        </div>
                    </section>

                    <div className="space-y-6">
                        <section className={`${cardClass} backdrop-blur-sm bg-white/90 animate-fade-in-up animation-delay-300 hover:shadow-xl transition-all duration-300`}>
                            <ImageUpload
                                imagePreview={imagePreview}
                                onImageSelect={handleImageSelect}
                                fileInputRef={fileInputRef}
                            />
                            {imagePreview && (
                                <div className="mt-8 border-t border-slate-100 pt-6">
                                    <ImageContext onContextChange={handleContextChange} />
                                </div>
                            )}
                        </section>

                        <section className={`${cardClass} backdrop-blur-sm bg-white/90 animate-fade-in-up animation-delay-400 hover:shadow-xl transition-all duration-300`}>
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.3em] text-indigo-500 font-semibold">Step 2</p>
                                    <h2 className="text-2xl font-semibold text-slate-900">Blend music for extra mood</h2>
                                    <p className="text-sm text-slate-500">Optional Spotify pairing helps the AI align tone with your soundtrack.</p>
                                </div>
                                <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={!musicIsOptional}
                                        onChange={() => setMusicIsOptional(!musicIsOptional)}
                                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    {musicIsOptional ? 'Music is optional' : 'Music is required'}
                                </label>
                            </div>
                            <div className="mt-6 space-y-4">
                                <SongSearch
                                    searchQuery={searchQuery}
                                    setSearchQuery={setSearchQuery}
                                    searchResults={searchResults}
                                    selectedTrack={selectedTrack}
                                    onTrackSelect={handleTrackSelect}
                                    onSearch={searchTracks}
                                    showIntro={false}
                                />
                                {selectedTrack && (
                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                        <SpotifyPlayer track={selectedTrack} />
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className={`${cardClass} backdrop-blur-sm bg-white/90 animate-fade-in-up animation-delay-500 hover:shadow-xl transition-all duration-300`}>
                            <div className="space-y-2 mb-4">
                                <p className="text-xs uppercase tracking-[0.3em] text-emerald-500 font-semibold">Step 3</p>
                                <h2 className="text-2xl font-semibold text-slate-900">Personalize the caption</h2>
                                <p className="text-sm text-slate-500">Fine-tune tone, length, emoji, and hashtag flair before generating.</p>
                            </div>
                            {selectedImage ? (
                                <CaptionOptions onOptionsChange={handleOptionsChange} />
                            ) : (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center text-sm text-slate-500">
                                    Upload an image to unlock the advanced style controls.
                                </div>
                            )}
                            <button
                                onClick={handleSubmit}
                                disabled={loading || !selectedImage || (!musicIsOptional && !selectedTrack)}
                                className="mt-6 w-full py-3 px-4 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white rounded-2xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 relative overflow-hidden group"
                            >
                                <span className="relative z-10">
                                {loading ? (
                                    <>
                                        <LoadingSpinner />
                                        <span>Crafting caption...</span>
                                    </>
                                ) : (
                                    <span>Generate Caption{selectedTrack ? ' with Music' : ''}</span>
                                )}
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-700 via-pink-600 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                            </button>
                            {error && (
                                <div className="mt-4 rounded-2xl border border-red-100 bg-red-50/80 text-red-600 px-4 py-3 text-sm">
                                    {error}
                                </div>
                            )}
                        </section>

                        {caption && (
                            <section className={`${cardClass} backdrop-blur-sm bg-white/90 animate-fade-in-up animation-delay-600 hover:shadow-xl transition-all duration-300`}>
                                <div className="space-y-4">
                                    <GeneratedCaption caption={caption} />
                                    {captionId && (
                                        <CaptionFeedback
                                            caption={caption}
                                            captionId={captionId}
                                            onCaptionEdit={handleCaptionEdit}
                                        />
                                    )}
                                    <button
                                        onClick={handleSubmit}
                                        className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 relative overflow-hidden group"
                                    >
                                        <span className="relative z-10">Regenerate with current options</span>
                                        <div className="absolute inset-0 bg-gradient-to-r from-purple-700 via-pink-600 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                                    </button>
                                </div>
                            </section>
                        )}

                        {(recommendations.length > 0 || recommendationsLoading) && (
                            <section className={`${cardClass} backdrop-blur-sm bg-white/90 animate-fade-in-up animation-delay-700 hover:shadow-xl transition-all duration-300`}>
                                <SongRecommendations
                                    recommendations={recommendations}
                                    onTrackSelect={handleTrackSelect}
                                    loading={recommendationsLoading}
                                />
                            </section>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default GeneratorPage;
