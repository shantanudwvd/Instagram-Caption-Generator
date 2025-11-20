import React, { useState } from 'react';
import { Star, Copy, Check, Image as ImageIcon } from 'lucide-react';

const CaptionCard = ({ caption, createdAt, avgRating, feedbackCount, tone, length, imageUrl, onImageClick }) => {
    const [copied, setCopied] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(caption);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
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
        <div className="bg-gradient-to-br from-purple-50/50 via-pink-50/50 to-orange-50/50 rounded-xl overflow-hidden border border-purple-100 shadow-md transform transition-all duration-300 hover:shadow-lg hover:scale-[1.01]">
            <div className="flex flex-col md:flex-row">
                {/* Caption Section */}
                <div className="flex-1 p-5">
                    <div className="flex items-start justify-between mb-3">
                        <p className="text-slate-800 leading-relaxed flex-1 pr-4">{caption}</p>
                        <button
                            onClick={handleCopy}
                            className="flex-shrink-0 p-2 rounded-lg bg-white/80 backdrop-blur-sm border border-purple-200 hover:bg-purple-50 transition-all duration-200 transform hover:scale-110"
                            title="Copy caption"
                        >
                            {copied ? (
                                <Check className="w-4 h-4 text-green-500" />
                            ) : (
                                <Copy className="w-4 h-4 text-purple-600" />
                            )}
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-slate-500">{formatDate(createdAt)}</span>
                        {avgRating > 0 && (
                            <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                <span className="text-slate-600 font-medium">{avgRating.toFixed(1)}</span>
                            </div>
                        )}
                        {feedbackCount > 0 && (
                            <span className="text-slate-500">({feedbackCount} feedback)</span>
                        )}
                        {tone && (
                            <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                                {tone}
                            </span>
                        )}
                        {length && (
                            <span className="px-2 py-1 rounded-full bg-pink-100 text-pink-700 text-xs font-medium">
                                {length}
                            </span>
                        )}
                    </div>
                </div>

                {/* Image Section - Right Side */}
                {fullImageUrl && (
                    <div 
                        className="relative w-full md:w-64 md:min-w-[256px] h-48 md:h-full bg-slate-100 overflow-hidden cursor-pointer group flex-shrink-0 border-l border-purple-100 md:border-l md:border-t-0 border-t"
                        onClick={handleImageClick}
                    >
                        {!imageLoaded && !imageError && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 animate-pulse">
                                <ImageIcon className="w-12 h-12 text-purple-300" />
                            </div>
                        )}
                        {imageError ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                                <div className="text-center">
                                    <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                    <p className="text-xs text-slate-400">Image unavailable</p>
                                </div>
                            </div>
                        ) : (
                            <img
                                src={fullImageUrl}
                                alt="Caption image"
                                className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${
                                    imageLoaded ? 'opacity-100' : 'opacity-0'
                                }`}
                                loading="lazy"
                                onLoad={() => setImageLoaded(true)}
                                onError={() => {
                                    setImageError(true);
                                    setImageLoaded(false);
                                }}
                            />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm font-medium text-purple-600 transform scale-90 group-hover:scale-100">
                                Click to view
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CaptionCard;

