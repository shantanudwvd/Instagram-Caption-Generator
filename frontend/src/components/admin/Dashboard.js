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
import { useNavigate } from 'react-router-dom';
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
const formatWeekLabel = (period) => {
    if (!period || typeof period !== 'string') return 'Week';
    const [year, week] = period.split('-');
    if (!year || !week) return period;
    return `W${week} ${year}`;
};

const UserDashboard = () => {
    const { user, token, isInitializing } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [recentCaptions, setRecentCaptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Redirect to login if user logs out
    useEffect(() => {
        if (!isInitializing && !user) {
            navigate('/', { replace: true });
        }
    }, [user, isInitializing, navigate]);

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

    const feedbackTrends = useMemo(
        () => (stats?.feedbackTrends || []).map((item) => ({
            ...item,
            label: formatWeekLabel(item.period)
        })),
        [stats]
    );

    const captionsLast30Days = useMemo(
        () => generationHistory.reduce((sum, entry) => sum + (entry.count || 0), 0),
        [generationHistory]
    );

    const feedbackPerCaptionDisplay = useMemo(() => {
        if (!stats || stats.totalCaptions === 0) return '—';
        const avg = stats.totalFeedback / stats.totalCaptions;
        return Number.isFinite(avg) ? avg.toFixed(1) : '—';
    }, [stats]);

    const fineTuningStats = useMemo(() => stats?.fineTuningStats || {}, [stats]);

    const renderFeedbackTooltip = ({ active, payload, label }) => {
        if (!active || !payload || payload.length === 0) return null;
        const { avgRating, count } = payload[0].payload;

        return (
            <div className="bg-white shadow-lg rounded-lg p-3 border border-slate-100">
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-500">Avg rating: {avgRating ? avgRating.toFixed(2) : '—'}</p>
                <p className="text-xs text-gray-500">Feedback: {formatNumber(count)}</p>
            </div>
        );
    };

    if (isInitializing) {
        return (
            <div className="max-w-3xl mx-auto py-12 px-6 relative overflow-hidden min-h-screen">
                <div className="absolute inset-0 animate-gradient-xy opacity-30" style={{
                    background: 'linear-gradient(-45deg, #9333ea, #ec4899, #f97316, #9333ea, #ec4899, #f97316)',
                    backgroundSize: '400% 400%'
                }}></div>
                <div className="relative z-10 flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!user) {
        return null; // Redirect handled by useEffect
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
                    <h1 className="text-2xl font-bold text-gray-900">{user.fullName || (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || 'User')}</h1>
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
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                        <div className="animate-fade-in-up animation-delay-450">
                            <DashboardCard
                                label="Feedback per Caption"
                                value={feedbackPerCaptionDisplay}
                                description="Engagement on your creations"
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="animate-fade-in-up animation-delay-475">
                            <DashboardCard
                                label="Captions (Last 30 Days)"
                                value={formatNumber(captionsLast30Days)}
                                description="Recent creation streak"
                            />
                        </div>
                        <div className="animate-fade-in-up animation-delay-500">
                            <DashboardCard
                                label="Fine-tuning Runs"
                                value={formatNumber(fineTuningStats.total)}
                                description="All training jobs started"
                            />
                        </div>
                        <div className="animate-fade-in-up animation-delay-525">
                            <DashboardCard
                                label="Models Ready"
                                value={formatNumber(fineTuningStats.succeeded)}
                                description="Succeeded fine-tunes"
                            />
                        </div>
                        <div className="animate-fade-in-up animation-delay-550">
                            <DashboardCard
                                label="Active Training"
                                value={formatNumber(fineTuningStats.inProgress)}
                                description="Jobs currently running"
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

                    <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 transform transition-all duration-300 hover:shadow-xl animate-fade-in-up animation-delay-650">
                        <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent mb-4">Feedback Trends</h3>
                        {feedbackTrends.length === 0 ? (
                            <p className="text-sm text-gray-500">No feedback trend data yet.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={feedbackTrends}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="label" />
                                    <YAxis domain={[0, 5]} allowDecimals />
                                    <Tooltip content={renderFeedbackTooltip} />
                                    <Line type="monotone" dataKey="avgRating" stroke="#f472b6" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg shadow-lg p-4 transform transition-all duration-300 hover:shadow-xl animate-fade-in-up animation-delay-700">
                        <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent mb-4">Recent Captions</h3>
                        {recentCaptions.length === 0 ? (
                            <p className="text-sm text-gray-500">Generate your first caption to see it here.</p>
                        ) : (
                            <ul className="space-y-4">
                                {recentCaptions.map((item, index) => (
                                    <li
                                        key={item.id}
                                        className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800/50 bg-gradient-to-r from-white/95 via-white/90 to-slate-50/90 dark:from-slate-900/85 dark:via-slate-900/75 dark:to-slate-800/80 shadow-[0_12px_30px_rgba(15,23,42,0.08)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.45)] animate-fade-in-up"
                                        style={{ animationDelay: `${800 + index * 50}ms` }}
                                    >
                                        <div className="p-4 flex flex-col gap-3">
                                            <p className="text-slate-800 dark:text-slate-100 leading-relaxed">{item.caption}</p>
                                            <div className="flex flex-wrap items-center gap-3 text-sm">
                                                <span className="text-slate-500 dark:text-slate-300">
                                                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                                                </span>
                                                {item.avgRating && (
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-yellow-400 dark:text-yellow-300">★</span>
                                                        <span className="text-slate-700 dark:text-slate-200 font-medium">{item.avgRating.toFixed(1)}</span>
                                                    </div>
                                                )}
                                                {item.tone && (
                                                    <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-200 text-xs font-medium">
                                                        {item.tone}
                                                    </span>
                                                )}
                                                {item.length && (
                                                    <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-100 text-xs font-medium">
                                                        {item.length}
                                                    </span>
                                                )}
                                                <span className="text-slate-500 dark:text-slate-400">feedback: {formatNumber(item.feedbackCount)}</span>
                                            </div>
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
