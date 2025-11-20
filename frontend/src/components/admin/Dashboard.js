import React, { useEffect, useMemo, useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar
} from 'recharts';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import BackButton from '../BackButton';

const DashboardCard = ({ label, value, description }) => (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 transform transition-all duration-300 hover:shadow-xl hover:scale-105 border border-slate-100">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent mt-2">{value}</p>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
    </div>
);

const formatNumber = (value) => (value || value === 0 ? value.toLocaleString() : '—');

const UserDashboard = () => {
    const { user, token } = useAuth();
    const [stats, setStats] = useState(null);
    const [recentCaptions, setRecentCaptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }
        const fetchDashboardData = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/dashboard/overview`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Unable to load dashboard data.');
                }

                const data = await response.json();
                setStats(data.stats);
                setRecentCaptions(data.recentCaptions || []);
            } catch (err) {
                setError(err.message || 'Failed to load dashboard');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [token]);

    const generationHistory = useMemo(() => stats?.generationHistory || [], [stats]);
    const ratingDistribution = useMemo(
        () => (stats?.ratingDistribution || []).map((item) => ({
            ...item,
            label: `${item.rating} ★`
        })),
        [stats]
    );

    if (!user) {
        return (
            <div className="max-w-3xl mx-auto py-12 px-6 relative overflow-hidden min-h-screen">
                <div className="absolute inset-0 animate-gradient-xy opacity-30" style={{
                    background: 'linear-gradient(-45deg, #9333ea, #ec4899, #f97316, #9333ea, #ec4899, #f97316)',
                    backgroundSize: '400% 400%'
                }}></div>
                <div className="relative z-10">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-xl p-6 text-center space-y-4 animate-fade-in">
                    <h2 className="text-xl font-semibold">Please sign in</h2>
                    <p className="text-gray-600">You need to be signed in to access your dashboard.</p>
                    <Link
                        to="/"
                        className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all duration-200"
                    >
                        Go to Caption Generator
                    </Link>
                </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative overflow-hidden py-10 px-6">
            {/* Animated Gradient Background */}
            <div className="absolute inset-0 animate-gradient-xy opacity-30" style={{
                background: 'linear-gradient(-45deg, #9333ea, #ec4899, #f97316, #9333ea, #ec4899, #f97316)',
                backgroundSize: '400% 400%'
            }}></div>
            
            {/* Floating Orbs */}
            <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-20 left-1/2 w-96 h-96 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
            
            <div className="relative z-10 max-w-5xl mx-auto space-y-8">
            <div className="flex justify-start animate-fade-in">
                <BackButton to="/" label="Back to Profile" />
            </div>
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between transform transition-all duration-300 hover:shadow-2xl animate-fade-in-up animation-delay-100">
                <div>
                    <p className="text-sm text-gray-500">Welcome back</p>
                    <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
                    <p className="text-sm text-gray-500">{user.email}</p>
                </div>
                <div className="mt-4 md:mt-0 flex items-center space-x-6 text-sm text-gray-600">
                    <div>
                        <p className="text-xs uppercase tracking-wide">Last Login</p>
                        <p className="font-medium">
                            {user.lastLoginAt
                                ? new Date(user.lastLoginAt).toLocaleString()
                                : 'First time here'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-wide">Member Since</p>
                        <p className="font-medium">
                            {user.createdAt
                                ? new Date(user.createdAt).toLocaleDateString()
                                : '—'}
                        </p>
                    </div>
                </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg">{error}</div>}

            {loading ? (
                <div className="text-center py-10 text-gray-500">Loading your dashboard...</div>
            ) : stats ? (
                <>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="animate-fade-in-up animation-delay-200">
                            <DashboardCard
                                label="Captions Generated"
                                value={formatNumber(stats.totalCaptions)}
                                description="Total creative captions crafted"
                            />
                        </div>
                        <div className="animate-fade-in-up animation-delay-300">
                            <DashboardCard
                                label="Average Rating"
                                value={stats.avgRating ? stats.avgRating.toFixed(1) : '—'}
                                description="Based on community feedback"
                            />
                        </div>
                        <div className="animate-fade-in-up animation-delay-400">
                            <DashboardCard
                                label="Feedback Received"
                                value={formatNumber(stats.totalFeedback)}
                                description="Ratings & edits shared"
                            />
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 transform transition-all duration-300 hover:shadow-xl animate-fade-in-up animation-delay-500">
                            <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent mb-4">Generation History</h3>
                            {generationHistory.length === 0 ? (
                                <p className="text-sm text-gray-500">No generation activity yet.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={generationHistory}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis allowDecimals={false} />
                                        <Tooltip />
                                        <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 transform transition-all duration-300 hover:shadow-xl animate-fade-in-up animation-delay-600">
                            <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent mb-4">Rating Distribution</h3>
                            {ratingDistribution.length === 0 ? (
                                <p className="text-sm text-gray-500">No feedback has been collected yet.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={ratingDistribution}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="label" />
                                        <YAxis allowDecimals={false} />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#34d399" />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 transform transition-all duration-300 hover:shadow-xl animate-fade-in-up animation-delay-700">
                        <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent mb-4">Recent Captions</h3>
                        {recentCaptions.length === 0 ? (
                            <p className="text-sm text-gray-500">Generate your first caption to see it here.</p>
                        ) : (
                            <ul className="space-y-4">
                                {recentCaptions.map((item, index) => (
                                    <li key={item.id} className="border rounded-lg p-4 bg-white/50 backdrop-blur-sm transform transition-all duration-300 hover:shadow-md hover:scale-[1.02] animate-fade-in-up" style={{ animationDelay: `${800 + index * 50}ms` }}>
                                        <p className="text-gray-900">{item.caption}</p>
                                        <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-2">
                                            <span>
                                                {item.createdAt
                                                    ? new Date(item.createdAt).toLocaleString()
                                                    : ''}
                                            </span>
                                            {item.tone && <span>tone: {item.tone}</span>}
                                            {item.length && <span>length: {item.length}</span>}
                                            <span>rating: {item.avgRating ? item.avgRating.toFixed(1) : '—'}</span>
                                            <span>feedback: {formatNumber(item.feedbackCount)}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            ) : (
                <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6 text-center text-gray-500 animate-fade-in-up">
                    Nothing to show yet. Generate a caption to kickstart your insights!
                </div>
            )}
            </div>
        </div>
    );
};

export default UserDashboard;
