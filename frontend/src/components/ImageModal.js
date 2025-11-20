import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const ImageModal = ({ imageUrl, caption, onClose }) => {
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        document.body.style.overflow = 'hidden'; // Prevent background scrolling

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [onClose]);

    if (!imageUrl) return null;

    const fullImageUrl = imageUrl.startsWith('http') 
        ? imageUrl 
        : `${process.env.REACT_APP_BACKEND_URL}${imageUrl}`;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="fixed top-4 right-4 p-2.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white transition-all duration-200 transform hover:scale-110 z-[101] shadow-lg"
                aria-label="Close modal"
            >
                <X className="w-5 h-5" />
            </button>
            <div
                className="relative max-w-4xl max-h-[90vh] w-full animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="relative bg-transparent rounded-xl overflow-hidden shadow-2xl">
                    <img
                        src={fullImageUrl}
                        alt="Caption image"
                        className="w-full h-auto max-h-[90vh] object-contain rounded-xl"
                        onError={(e) => {
                            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23ddd" width="400" height="300"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage not found%3C/text%3E%3C/svg%3E';
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default ImageModal;

