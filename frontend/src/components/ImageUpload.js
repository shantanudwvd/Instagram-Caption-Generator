// 6. Create src/components/ImageUpload.js:
import React from 'react';
import { Upload } from 'lucide-react';

const ImageUpload = ({ imagePreview, onImageSelect, fileInputRef }) => {
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">1. Upload Image</h2>
            <div
                onClick={() => fileInputRef.current.click()}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
            >
                {imagePreview ? (
                    <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-64 mx-auto rounded"
                    />
                ) : (
                    <div className="space-y-2">
                        <Upload className="w-12 h-12 mx-auto text-gray-400" />
                        <p>Click to upload an image</p>
                    </div>
                )}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={onImageSelect}
                    accept="image/*"
                    className="hidden"
                />
            </div>
        </div>
    );
};

export default ImageUpload;