import React from 'react';
import { Upload } from 'lucide-react';

const ImageUpload = ({ imagePreview, onImageSelect, fileInputRef }) => {
    return (
        <div className="space-y-4">
            <div>
                <p className="text-xs uppercase tracking-[0.2em] text-blue-500 font-semibold">Step 1</p>
                <h2 className="text-2xl font-semibold text-slate-900">Upload your image</h2>
                <p className="text-sm text-slate-500">Drop in a photo or browse your files to let the muse analyze it.</p>
            </div>
            <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/60 hover:bg-white transition-all hover:border-blue-400"
            >
                {imagePreview ? (
                    <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-72 mx-auto rounded-2xl shadow-sm object-contain"
                    />
                ) : (
                    <div className="space-y-3">
                        <Upload className="w-12 h-12 mx-auto text-slate-400" />
                        <p className="text-base font-medium text-slate-700">Click to browse or drag & drop</p>
                        <p className="text-sm text-slate-500">PNG, JPG up to 10MB</p>
                        <div className="flex justify-center">
                            <span className="px-4 py-2 rounded-full bg-white text-sm font-medium text-slate-600 border border-slate-200">
                                Browse files
                            </span>
                        </div>
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
