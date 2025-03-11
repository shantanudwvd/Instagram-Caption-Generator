// src/components/CaptionOptions.js
import React, { useState } from 'react';
import { Settings, ChevronDown, ChevronUp } from 'lucide-react';

const CaptionOptions = ({ onOptionsChange }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [options, setOptions] = useState({
        tone: 'casual',
        length: 'medium',
        language: 'english',
        emoji: 'moderate',
        hashtags: 'moderate'
    });

    const toneOptions = [
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
        { value: 'very-short', label: 'Very Short (1 sentence)' },
        { value: 'short', label: 'Short' },
        { value: 'medium', label: 'Medium' },
        { value: 'long', label: 'Long' },
        { value: 'very-long', label: 'Very Long' }
    ];

    const emojiOptions = [
        { value: 'none', label: 'No Emojis' },
        { value: 'minimal', label: 'Minimal (1-2)' },
        { value: 'moderate', label: 'Moderate' },
        { value: 'abundant', label: 'Abundant' }
    ];

    const hashtagOptions = [
        { value: 'none', label: 'No Hashtags' },
        { value: 'minimal', label: 'Minimal (1-3)' },
        { value: 'moderate', label: 'Moderate (4-7)' },
        { value: 'abundant', label: 'Abundant (8+)' }
    ];

    const languageOptions = [
        { value: 'english', label: 'English' },
        { value: 'hindi', label: 'Hindi' },
        { value: 'hinglish', label: 'Hinglish' },
        { value: 'spanish', label: 'Spanish' },
        { value: 'french', label: 'French' },
        { value: 'german', label: 'German' },
        { value: 'italian', label: 'Italian' },
        { value: 'portuguese', label: 'Portuguese' },
        { value: 'japanese', label: 'Japanese' },
        { value: 'korean', label: 'Korean' },
        { value: 'mandarin', label: 'Mandarin' }
    ];

    const handleChange = (option, value) => {
        const updatedOptions = {
            ...options,
            [option]: value
        };
        setOptions(updatedOptions);
        onOptionsChange(updatedOptions);
    };

    return (
        <div className="border rounded-lg p-4 space-y-4">
            <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center space-x-2">
                    <Settings className="w-5 h-5 text-gray-600" />
                    <h3 className="font-medium">Caption Options</h3>
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
            </div>

            {isExpanded && (
                <div className="space-y-4 pt-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                        <select
                            value={options.tone}
                            onChange={(e) => handleChange('tone', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                        >
                            {toneOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
                        <select
                            value={options.length}
                            onChange={(e) => handleChange('length', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                        >
                            {lengthOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                        <select
                            value={options.language}
                            onChange={(e) => handleChange('language', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                        >
                            {languageOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Emoji Usage</label>
                        <select
                            value={options.emoji}
                            onChange={(e) => handleChange('emoji', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                        >
                            {emojiOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hashtags</label>
                        <select
                            value={options.hashtags}
                            onChange={(e) => handleChange('hashtags', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                        >
                            {hashtagOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CaptionOptions;