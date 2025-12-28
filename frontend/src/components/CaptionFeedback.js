// src/components/CaptionFeedback.js
import React, { useState } from 'react';
import { Star, Edit, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CaptionFeedback = ({ caption, captionId, onCaptionEdit }) => {
    const { token } = useAuth();
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [editedCaption, setEditedCaption] = useState(caption);
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleRatingChange = (newRating) => {
        setRating(newRating);
    };

    const handleFeedbackChange = (e) => {
        setFeedback(e.target.value);
    };

    const toggleEditMode = () => {
        setEditMode(!editMode);
        if (!editMode) {
            setEditedCaption(caption);
        }
    };

    const handleEditedCaptionChange = (e) => {
        setEditedCaption(e.target.value);
    };

    const submitFeedback = async () => {
        if (rating === 0) {
            setError('Please provide a rating before submitting');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const response = await fetch(
                `${process.env.REACT_APP_BACKEND_URL}/api/caption-feedback/${captionId}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        rating,
                        comments: feedback,
                        userEdits: editMode ? editedCaption : null,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error('Failed to submit feedback');
            }

            setSubmitted(true);

            // If the caption was edited, update it in the UI
            if (editMode && onCaptionEdit) {
                onCaptionEdit(editedCaption);
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
            setError('Failed to submit feedback. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="border-2 border-green-200 rounded-xl p-4 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg animate-fade-in-up">
                <div className="flex items-center text-green-600 mb-2">
                    <CheckCircle className="w-5 h-5 mr-2 transform animate-scale-in" />
                    <p className="font-medium">Thank you for your feedback!</p>
                </div>
                <p className="text-sm text-gray-600">
                    Your input helps us improve our caption generation system.
                </p>
            </div>
        );
    }

    return (
        <div className="border-2 border-slate-200 rounded-xl p-4 space-y-4 bg-white/80 backdrop-blur-sm shadow-md transform transition-all duration-300 hover:shadow-lg animate-fade-in-up">
            <h2 className="text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                How's this caption?
            </h2>

            {/* Star Rating */}
            <div className="space-y-2">
                <p className="text-sm text-gray-600">Rate this caption:</p>
                <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            onClick={() => handleRatingChange(star)}
                            className={`p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 transform transition-all duration-200 hover:scale-125 ${
                                star <= rating
                                    ? 'text-yellow-400'
                                    : 'text-gray-300 hover:text-yellow-300'
                            }`}
                        >
                            <Star
                                className="w-6 h-6 transform transition-transform duration-200"
                                fill={star <= rating ? 'currentColor' : 'none'}
                            />
                        </button>
                    ))}
                </div>
            </div>

            {/* Edit Toggle */}
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">Want to improve this caption?</p>
                <button
                    onClick={toggleEditMode}
                    className={`flex items-center text-sm transform transition-all duration-200 hover:scale-105 group ${
                        editMode ? 'text-purple-600' : 'text-gray-600'
                    } hover:text-purple-700`}
                >
                    <Edit className="w-4 h-4 mr-1 transform transition-transform duration-200 group-hover:rotate-12" />
                    {editMode ? 'Cancel Edit' : 'Edit Caption'}
                </button>
            </div>

            {/* Caption Edit Area */}
            {editMode ? (
                <div>
                    <textarea
                        value={editedCaption}
                        onChange={handleEditedCaptionChange}
                        className="w-full p-3 border-2 border-slate-200 rounded-xl min-h-[120px] bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200"
                        placeholder="Edit the caption to make it better..."
                    />
                </div>
            ) : null}

            {/* Additional Feedback */}
            <div>
                <textarea
                    value={feedback}
                    onChange={handleFeedbackChange}
                    className="w-full p-3 border-2 border-slate-200 rounded-xl min-h-[80px] bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200"
                    placeholder="Any additional feedback? What did you like or dislike about this caption?"
                />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            {/* Submit Button */}
            <button
                onClick={submitFeedback}
                disabled={submitting}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:transform-none relative overflow-hidden group"
            >
                <span className="relative z-10">
                    {submitting ? 'Submitting...' : 'Submit Feedback'}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-700 via-pink-600 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            </button>
        </div>
    );
};

export default CaptionFeedback;
