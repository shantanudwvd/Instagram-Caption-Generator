// 8. Create src/components/GeneratedCaption.js:
import React from 'react';

const GeneratedCaption = ({ caption }) => {
    return (
        <div className="space-y-2">
            <h2 className="text-xl font-semibold">Generated Caption</h2>
            <div className="p-4 bg-gray-50 rounded-lg">
                <p>{caption}</p>
            </div>
            <button
                onClick={() => navigator.clipboard.writeText(caption)}
                className="text-blue-600 text-sm hover:underline"
            >
                Copy to clipboard
            </button>
        </div>
    );
};

export default GeneratedCaption;