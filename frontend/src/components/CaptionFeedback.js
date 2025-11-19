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
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/caption-feedback/${captionId}`, {
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
            });

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
            <div className="border rounded-lg p-4 bg-green-50">
                <div className="flex items-center text-green-600 mb-2">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    <p className="font-medium">Thank you for your feedback!</p>
                </div>
                <p className="text-sm text-gray-600">
                    Your input helps us improve our caption generation system.
                </p>
            </div>
        );
    }

    return (
        <div className="border rounded-lg p-4 space-y-4">
            <h2 className="text-lg font-semibold">How's this caption?</h2>

            {/* Star Rating */}
            <div className="space-y-2">
                <p className="text-sm text-gray-600">Rate this caption:</p>
                <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            onClick={() => handleRatingChange(star)}
                            className={`p-1 rounded-full focus:outline-none focus:ring ${
                                star <= rating ? 'text-yellow-400' : 'text-gray-300'
                            }`}
                        >
                            <Star className="w-6 h-6" fill={star <= rating ? 'currentColor' : 'none'} />
                        </button>
                    ))}
                </div>
            </div>

            {/* Edit Toggle */}
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">Want to improve this caption?</p>
                <button
                    onClick={toggleEditMode}
                    className={`flex items-center text-sm ${
                        editMode ? 'text-blue-600' : 'text-gray-600'
                    } hover:text-blue-700`}
                >
                    <Edit className="w-4 h-4 mr-1" />
                    {editMode ? 'Cancel Edit' : 'Edit Caption'}
                </button>
            </div>

            {/* Caption Edit Area */}
            {editMode ? (
                <div>
                    <textarea
                        value={editedCaption}
                        onChange={handleEditedCaptionChange}
                        className="w-full p-3 border rounded-lg min-h-[120px]"
                        placeholder="Edit the caption to make it better..."
                    />
                </div>
            ) : null}

            {/* Additional Feedback */}
            <div>
                <textarea
                    value={feedback}
                    onChange={handleFeedbackChange}
                    className="w-full p-3 border rounded-lg min-h-[80px]"
                    placeholder="Any additional feedback? What did you like or dislike about this caption?"
                />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            {/* Submit Button */}
            <button
                onClick={submitFeedback}
                disabled={submitting}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
            >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
        </div>
    );
};

export default CaptionFeedback;
