import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import BackButton from '../components/BackButton';
import CaptionCard from '../components/CaptionCard';
import ImageModal from '../components/ImageModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { Search, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';

const CaptionsBrowser = () => {
    const { user, token, isInitializing } = useAuth();
    const backendUrl = process.env.REACT_APP_BACKEND_URL;
    const navigate = useNavigate();

    // Redirect to login if user logs out
    useEffect(() => {
        if (!isInitializing && !user) {
            navigate('/', { replace: true });
        }
    }, [user, isInitializing, navigate]);
    const [captions, setCaptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [totalCount, setTotalCount] = useState(0);

    // Image modal state
    const [modalImage, setModalImage] = useState(null);
    const [modalCaption, setModalCaption] = useState(null);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [toneFilter, setToneFilter] = useState('');
    const [lengthFilter, setLengthFilter] = useState('');
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;
    const offset = (currentPage - 1) * itemsPerPage;

    const toneOptions = [
        { value: '', label: 'All Tones' },
        { value: 'casual', label: 'Casual' },
        { value: 'professional', label: 'Professional' },
        { value: 'friendly', label: 'Friendly' },
        { value: 'humorous', label: 'Humorous' },
        { value: 'dark-humor', label: 'Dark Humor' },
        { value: 'inspirational', label: 'Inspirational' },
        { value: 'thoughtful', label: 'Thoughtful' },
        { value: 'poetic', label: 'Poetic' },
        { value: 'sarcastic', label: 'Sarcastic' },
        { value: 'enthusiastic', label: 'Enthusiastic' },
        { value: 'mysterious', label: 'Mysterious' }
    ];

    const lengthOptions = [
        { value: '', label: 'All Lengths' },
        { value: 'very-short', label: 'Very Short' },
        { value: 'short', label: 'Short' },
        { value: 'medium', label: 'Medium' },
        { value: 'long', label: 'Long' },
        { value: 'very-long', label: 'Very Long' }
    ];

    const sortOptions = [
        { value: 'createdAt', label: 'Date' },
        { value: 'avgRating', label: 'Rating' },
        { value: 'feedbackCount', label: 'Feedback' }
    ];

    // Debounced search
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setCurrentPage(1); // Reset to first page on search
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchCaptions = useCallback(async () => {
        if (!token) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');

        try {
            const params = new URLSearchParams({
                search: debouncedSearch,
                tone: toneFilter,
                length: lengthFilter,
                sortBy: sortBy,
                sortOrder: sortOrder,
                limit: itemsPerPage.toString(),
                offset: offset.toString()
            });

            const response = await fetch(
                `${process.env.REACT_APP_BACKEND_URL}/api/dashboard/captions?${params}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to load captions');
            }

            const data = await response.json();
            setCaptions(data.captions || []);
            setTotalCount(data.totalCount || 0);
        } catch (err) {
            setError(err.message || 'Failed to load captions');
        } finally {
            setLoading(false);
        }
    }, [token, debouncedSearch, toneFilter, lengthFilter, sortBy, sortOrder, offset]);



    const clearFilters = () => {
        setSearchQuery('');
        setToneFilter('');
        setLengthFilter('');
        setSortBy('createdAt');
        setSortOrder('desc');
        setCurrentPage(1);
    };
    const handleDeleteCaption = useCallback(async (captionId) => {
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/captions/${captionId}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            setCaptions(prev =>
                prev.filter(caption => caption.id !== captionId)
            );
            setTotalCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            setError(err.message || 'Error deleting caption');
        } finally {
            setLoading(false);
        }
    }, [backendUrl, token, captions]);

    useEffect(() => {
        fetchCaptions();
    }, [fetchCaptions]);

    const activeFiltersCount = [debouncedSearch, toneFilter, lengthFilter].filter(Boolean).length;
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    if (isInitializing) {
        return (
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 animate-gradient-xy opacity-30" style={{
                    background: 'linear-gradient(-45deg, #9333ea, #ec4899, #f97316, #9333ea, #ec4899, #f97316)',
                    backgroundSize: '400% 400%'
                }}></div>
                <div className="relative z-10">
                    <LoadingSpinner />
                </div>
            </div>
        );
    }

    if (!user) {
        return null; // Redirect handled by useEffect
    }
    return (
        <>
            <Navigation />
            <div className="min-h-screen relative overflow-hidden py-12">
                {/* Animated Gradient Background */}
                <div className="absolute inset-0 animate-gradient-xy opacity-30" style={{
                    background: 'linear-gradient(-45deg, #9333ea, #ec4899, #f97316, #9333ea, #ec4899, #f97316)',
                    backgroundSize: '400% 400%'
                }}></div>

                {/* Floating Orbs */}
                <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-20 left-1/2 w-96 h-96 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

                <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
                    <div className="flex justify-start animate-fade-in">
                        <BackButton to="/" label="Back to Profile" />
                    </div>

                    {/* Header */}
                    <div className="text-center space-y-4 animate-fade-in-up">
                        <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white shadow-lg">
                            Browse Captions
                        </span>
                        <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                            Your Caption Library
                        </h1>
                        <p className="text-base text-slate-600 max-w-3xl mx-auto">
                            Search, filter, and browse all your generated captions
                        </p>
                    </div>

                    {/* Filters Section */}
                    <div className="bg-white/90 backdrop-blur-sm rounded-xl border-2 border-slate-200 p-6 shadow-lg animate-fade-in-up animation-delay-100">
                        <div className="flex items-center gap-2 mb-4">
                            <Filter className="w-5 h-5 text-purple-600" />
                            <h2 className="text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                                Filters
                            </h2>
                            {activeFiltersCount > 0 && (
                                <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                                    {activeFiltersCount} active
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            {/* Search */}
                            <div className="lg:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Search Captions
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search by caption text..."
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200"
                                    />
                                </div>
                            </div>

                            {/* Tone Filter */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Tone
                                </label>
                                <select
                                    value={toneFilter}
                                    onChange={(e) => {
                                        setToneFilter(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200"
                                >
                                    {toneOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Length Filter */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Length
                                </label>
                                <select
                                    value={lengthFilter}
                                    onChange={(e) => {
                                        setLengthFilter(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200"
                                >
                                    {lengthOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            {/* Sort */}
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-700">Sort by:</label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => {
                                        setSortBy(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-400 text-sm"
                                >
                                    {sortOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => {
                                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                        setCurrentPage(1);
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white/80 backdrop-blur-sm hover:bg-purple-50 transition-colors text-sm font-medium"
                                >
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                </button>
                            </div>

                            {/* Clear Filters */}
                            {activeFiltersCount > 0 && (
                                <button
                                    onClick={clearFilters}
                                    className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-sm font-medium"
                                >
                                    <X className="w-4 h-4" />
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Results */}
                    <div className="bg-white/90 backdrop-blur-sm rounded-xl border-2 border-slate-200 p-6 shadow-lg animate-fade-in-up animation-delay-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                                Results
                            </h2>
                            {!loading && (
                                <span className="text-sm text-slate-500">
                                    {totalCount} {totalCount === 1 ? 'caption' : 'captions'} found
                                </span>
                            )}
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-12">
                                <LoadingSpinner />
                            </div>
                        ) : error ? (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        ) : captions.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-slate-500 mb-4">No captions found matching your filters.</p>
                                {activeFiltersCount > 0 && (
                                    <button
                                        onClick={clearFilters}
                                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                                    >
                                        Clear Filters
                                    </button>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="space-y-4">
                                    {captions.map((caption, index) => (
                                        <div
                                            key={caption.id}
                                            className="animate-fade-in-up"
                                            style={{ animationDelay: `${index * 50}ms` }}
                                        >
                                            <CaptionCard
                                                {...caption}
                                                onImageClick={(imageUrl, captionText) => {
                                                    setModalImage(imageUrl);
                                                    setModalCaption(captionText);
                                                }}
                                                onDelete={handleDeleteCaption}
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 mt-6">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="p-2 rounded-lg border border-slate-200 bg-white/80 backdrop-blur-sm hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <span className="px-4 py-2 text-sm text-slate-600">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                            className="p-2 rounded-lg border border-slate-200 bg-white/80 backdrop-blur-sm hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Image Modal */}
                {modalImage && (
                    <ImageModal
                        imageUrl={modalImage}
                        caption={modalCaption}
                        onClose={() => {
                            setModalImage(null);
                            setModalCaption(null);
                        }}
                    />
                )}
            </div>
        </>
    );
};

export default CaptionsBrowser;

