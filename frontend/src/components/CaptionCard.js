import React, { useState } from 'react';
import { Star, Copy, Check, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CaptionCard = ({ id, caption, createdAt, avgRating, feedbackCount, tone, length, imageUrl, onImageClick }) => {
    console.log("Caption::", caption);
    const captionId = id;
    const [copied, setCopied] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { token } = useAuth();
    const backendUrl = process.env.REACT_APP_BACKEND_URL;
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(caption);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleDelete = async (captionId) => {
        try {
            const response = await fetch(`${backendUrl}/api/captions/${captionId}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err.message || 'Error deleting caption');
        } finally {
            setLoading(false);
        }
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

    const fullImageUrl = imageUrl && imageUrl.startsWith('http')
        ? imageUrl
        : imageUrl
            ? `${process.env.REACT_APP_BACKEND_URL}${imageUrl}`
            : null;

    const handleImageClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onImageClick && fullImageUrl) {
            onImageClick(fullImageUrl, caption);
        }
    };

    return (
        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800/50 bg-gradient-to-r from-white/95 via-white/90 to-slate-50/90 dark:from-slate-900/90 dark:via-slate-900/80 dark:to-slate-800/85 shadow-[0_12px_30px_rgba(15,23,42,0.08)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
            <div className="flex flex-col md:flex-row">
                {/* Caption Section */}
                <div className="flex-1 p-5">
                    <div className="flex items-start justify-between mb-3 gap-3">
                        <p className="text-slate-800 dark:text-slate-100 leading-relaxed flex-1 pr-2">{caption}</p>
                        <button
                            onClick={handleCopy}
                            className="flex-shrink-0 p-2 rounded-lg bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-slate-700/80 transition-all duration-200 transform hover:scale-110"
                            title="Copy caption"
                        >
                            {copied ? (
                                <Check className="w-4 h-4 text-green-500 dark:text-green-400" />
                            ) : (
                                <Copy className="w-4 h-4 text-purple-600 dark:text-purple-300" />
                            )}
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-slate-500 dark:text-slate-300">{formatDate(createdAt)}</span>
                        {avgRating > 0 && (
                            <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-400 dark:text-yellow-300 fill-yellow-400 dark:fill-yellow-300" />
                                <span className="text-slate-700 dark:text-slate-200 font-medium">{avgRating.toFixed(1)}</span>
                            </div>
                        )}
                        {feedbackCount > 0 && (
                            <span className="text-slate-500 dark:text-slate-400">({feedbackCount} feedback)</span>
                        )}
                        {tone && (
                            <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-200 text-xs font-medium">
                                {tone}
                            </span>
                        )}
                        {length && (
                            <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-100 text-xs font-medium">
                                {length}
                            </span>
                        )}
                    </div>
                </div>

                {/* Image Section - Right Side */}
                {fullImageUrl && (
                    <div
                        className="relative w-full md:w-64 md:min-w-[256px] h-48 md:h-full bg-slate-100 dark:bg-slate-900/60 overflow-hidden cursor-pointer group flex-shrink-0 border-t border-slate-200 dark:border-slate-800 md:border-l md:border-t-0"
                        onClick={handleImageClick}
                    >
                        {!imageLoaded && !imageError && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-200 to-slate-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 animate-pulse">
                                <ImageIcon className="w-12 h-12 text-slate-400 dark:text-slate-600" />
                            </div>
                        )}
                        {imageError ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                                <div className="text-center">
                                    <ImageIcon className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                                    <p className="text-xs text-slate-400 dark:text-slate-500">Image unavailable</p>
                                </div>
                            </div>
                        ) : (
                            <img
                                src={fullImageUrl}
                                alt="Caption"
                                className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${imageLoaded ? 'opacity-100' : 'opacity-0'
                                    }`}
                                loading="lazy"
                                onLoad={() => setImageLoaded(true)}
                                onError={() => {
                                    setImageError(true);
                                    setImageLoaded(false);
                                }}
                            />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 dark:group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm font-medium text-purple-600 dark:text-purple-200 transform scale-90 group-hover:scale-100">
                                Click to view
                            </div>
                        </div>
                    </div>
                )}

                <button onClick={() => handleDelete(captionId)}> delete </button>
            </div>
        </div>
    );
};

export default CaptionCard;
