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
                className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/60 hover:bg-white/90 backdrop-blur-sm transition-all duration-300 hover:border-purple-400 hover:shadow-lg transform hover:scale-[1.01] group relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-pink-500/0 to-orange-500/0 group-hover:from-purple-500/5 group-hover:via-pink-500/5 group-hover:to-orange-500/5 transition-all duration-300 pointer-events-none"></div>
                {imagePreview ? (
                    <div className="relative z-10">
                        <img
                            src={imagePreview}
                            alt="Preview"
                            className="max-h-72 mx-auto rounded-2xl shadow-lg object-contain transform transition-transform duration-300 group-hover:scale-105"
                        />
                    </div>
                ) : (
                    <div className="space-y-3 relative z-10">
                        <Upload className="w-12 h-12 mx-auto text-slate-400 transform transition-transform duration-300 group-hover:scale-110 group-hover:text-purple-500" />
                        <p className="text-base font-medium text-slate-700">Click to browse or drag & drop</p>
                        <p className="text-sm text-slate-500">PNG, JPG up to 10MB</p>
                        <div className="flex justify-center">
                            <span className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white text-sm font-medium shadow-md transform transition-transform duration-300 group-hover:scale-105">
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
