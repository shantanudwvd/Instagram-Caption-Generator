import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const AuthGate = () => {
    const { login, register } = useAuth();
    const [mode, setMode] = useState('login');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [isAnimating, setIsAnimating] = useState(false);

    const handleModeToggle = () => {
        setIsAnimating(true);
        setTimeout(() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
            setIsAnimating(false);
        }, 300);
    };

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            if (mode === 'login') {
                await login({ email: formData.email, password: formData.password });
            } else {
                await register(formData);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
            {/* Animated Gradient Background */}
            <div className="absolute inset-0 animate-gradient-xy" style={{
                background: 'linear-gradient(-45deg, #9333ea, #ec4899, #f97316, #9333ea, #ec4899, #f97316)',
                backgroundSize: '400% 400%'
            }}></div>
            
            {/* Floating Orbs */}
            <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
            <div className="absolute top-40 right-10 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-orange-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>

            {/* Main Card */}
            <div className={`relative z-10 max-w-md w-full bg-white/90 backdrop-blur-lg rounded-2xl shadow-2xl p-8 space-y-6 transform transition-all duration-300 ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                {/* Logo/Brand Section */}
                <div className="text-center space-y-3">
                    <div className="inline-block">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent animate-gradient-text">
                            Caption Muse
                        </h1>
                    </div>
                    <div className="h-1 w-20 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 mx-auto rounded-full"></div>
                    <h2 className={`text-2xl font-bold text-gray-800 transition-all duration-300 ${isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                        {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
                    </h2>
                    <p className={`text-gray-600 transition-all duration-300 ${isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                        {mode === 'login'
                            ? 'Sign in to generate personalized captions.'
                            : 'Join Caption Muse to save and refine your captions.'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name Field - Animated */}
                    <div className={`transition-all duration-300 overflow-hidden ${mode === 'register' ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Name
                        </label>
                        <div className="relative group">
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                                placeholder="Alex Doe"
                                required={mode === 'register'}
                            />
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/0 via-pink-500/0 to-orange-500/0 group-hover:from-purple-500/10 group-hover:via-pink-500/10 group-hover:to-orange-500/10 transition-all duration-300 pointer-events-none"></div>
                        </div>
                    </div>

                    {/* Email Field */}
                    <div className="transition-all duration-300">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Email
                        </label>
                        <div className="relative group">
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                                placeholder="you@example.com"
                                required
                            />
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/0 via-pink-500/0 to-orange-500/0 group-hover:from-purple-500/10 group-hover:via-pink-500/10 group-hover:to-orange-500/10 transition-all duration-300 pointer-events-none"></div>
                        </div>
                    </div>

                    {/* Password Field */}
                    <div className="transition-all duration-300">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Password
                        </label>
                        <div className="relative group">
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                                placeholder="••••••••"
                                required
                                minLength={8}
                            />
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/0 via-pink-500/0 to-orange-500/0 group-hover:from-purple-500/10 group-hover:via-pink-500/10 group-hover:to-orange-500/10 transition-all duration-300 pointer-events-none"></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 ml-1">Minimum 8 characters</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg animate-shake">
                            <p className="text-sm text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3.5 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none relative overflow-hidden group"
                    >
                        <span className="relative z-10 flex items-center justify-center">
                            {submitting ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Please wait...
                                </>
                            ) : (
                                mode === 'login' ? 'Sign In' : 'Create Account'
                            )}
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-700 via-pink-600 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    </button>
                </form>

                {/* Toggle Mode */}
                <div className="text-center pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                        {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                        <button
                            type="button"
                            onClick={handleModeToggle}
                            className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 font-semibold hover:from-purple-700 hover:via-pink-600 hover:to-orange-500 transition-all duration-200 relative group"
                        >
                            {mode === 'login' ? 'Sign up' : 'Sign in'}
                            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 group-hover:w-full transition-all duration-200"></span>
                        </button>
                    </p>
                </div>
            </div>

        </div>
    );
};

export default AuthGate;
