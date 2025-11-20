import React, { useState } from 'react';

const GeneratedCaption = ({ caption }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(caption);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="space-y-3 animate-fade-in-up">
            <h2 className="text-xl font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">Generated Caption</h2>
            <div className="p-4 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 rounded-xl border border-purple-100 shadow-md transform transition-all duration-300 hover:shadow-lg">
                <p className="text-slate-800 leading-relaxed">{caption}</p>
            </div>
            <button
                onClick={handleCopy}
                className="text-sm font-medium bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent hover:from-purple-700 hover:via-pink-600 hover:to-orange-500 transition-all duration-200 flex items-center gap-2 group"
            >
                {copied ? (
                    <>
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Copied!</span>
                    </>
                ) : (
                    <>
                        <svg className="w-4 h-4 transform group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copy to clipboard</span>
                    </>
                )}
            </button>
        </div>
    );
};

export default GeneratedCaption;