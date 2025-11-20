import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Star, ArrowRight, FileText } from 'lucide-react';

const RecentCaptionsPreview = () => {
    const { token } = useAuth();
    const [recentCaptions, setRecentCaptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }

        const fetchRecentCaptions = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/dashboard/overview`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Unable to load recent captions.');
                }

                const data = await response.json();
                setRecentCaptions((data.recentCaptions || []).slice(0, 3));
            } catch (err) {
                setError(err.message || 'Failed to load recent captions');
            } finally {
                setLoading(false);
            }
        };

        fetchRecentCaptions();
    }, [token]);

    const truncateText = (text, maxLength = 100) => {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
    };

    if (loading) {
        return (
            <div className="bg-white/90 backdrop-blur-sm rounded-xl border-2 border-slate-200 p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-purple-500" />
                    <h2 className="text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                        Recent Captions
                    </h2>
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map((index) => (
                        <div key={index} className="bg-slate-50 rounded-lg p-4 animate-pulse">
                            <div className="h-4 w-3/4 bg-slate-200 rounded mb-2"></div>
                            <div className="h-3 w-1/2 bg-slate-200 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
            </div>
        );
    }

    return (
        <div className="bg-white/90 backdrop-blur-sm rounded-xl border-2 border-slate-200 p-6 shadow-lg animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-500" />
                    <h2 className="text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                        Recent Captions
                    </h2>
                </div>
                {recentCaptions.length > 0 && (
                    <Link
                        to="/captions"
                        className="text-sm font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors"
                    >
                        View All
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                )}
            </div>

            {recentCaptions.length === 0 ? (
                <div className="text-center py-8">
                    <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 mb-4">No captions generated yet</p>
                    <Link
                        to="/generator"
                        className="inline-flex items-center px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                    >
                        Create Your First Caption
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {recentCaptions.map((caption, index) => (
                        <div
                            key={caption.id}
                            className="bg-gradient-to-br from-purple-50/50 via-pink-50/50 to-orange-50/50 rounded-xl p-4 border border-purple-100 transform transition-all duration-300 hover:shadow-md hover:scale-[1.01] animate-fade-in-up"
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <p className="text-slate-800 mb-3 leading-relaxed">{truncateText(caption.caption)}</p>
                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                <span className="text-slate-500">{formatDate(caption.createdAt)}</span>
                                {caption.avgRating && caption.avgRating > 0 && (
                                    <div className="flex items-center gap-1">
                                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                        <span className="text-slate-600 font-medium">{caption.avgRating.toFixed(1)}</span>
                                    </div>
                                )}
                                {caption.tone && (
                                    <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                                        {caption.tone}
                                    </span>
                                )}
                                {caption.length && (
                                    <span className="px-2 py-1 rounded-full bg-pink-100 text-pink-700 text-xs font-medium">
                                        {caption.length}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RecentCaptionsPreview;

