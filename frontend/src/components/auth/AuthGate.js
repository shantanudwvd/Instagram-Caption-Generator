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

    const handleModeToggle = () => {
        setMode(mode === 'login' ? 'register' : 'login');
        setError('');
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold text-gray-800">
                        {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
                    </h1>
                    <p className="text-gray-500">
                        {mode === 'login'
                            ? 'Sign in to generate personalized captions.'
                            : 'Join Caption Muse to save and refine your captions.'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === 'register' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Name
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Alex Doe"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="••••••••"
                            required
                            minLength={8}
                        />
                        <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {submitting
                            ? 'Please wait...'
                            : mode === 'login'
                                ? 'Sign In'
                                : 'Create Account'}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-600">
                    {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                    <button
                        type="button"
                        onClick={handleModeToggle}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                        {mode === 'login' ? 'Sign up' : 'Sign in'}
                    </button>
                </p>
            </div>
        </div>
    );
};

export default AuthGate;
