import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FileText, Star, MessageSquare, Activity } from 'lucide-react';

const ProfileStats = () => {
    const { token } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }

        const fetchStats = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/dashboard/overview`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Unable to load stats.');
                }

                const data = await response.json();
                setStats(data.stats);
            } catch (err) {
                setError(err.message || 'Failed to load stats');
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [token]);

    const formatNumber = (value) => (value || value === 0 ? value.toLocaleString() : '—');

    const statCards = [
        {
            label: 'Captions Generated',
            value: stats ? formatNumber(stats.totalCaptions) : '—',
            icon: FileText,
            gradient: 'from-purple-500 to-purple-600',
            bgGradient: 'from-purple-50 to-purple-100'
        },
        {
            label: 'Average Rating',
            value: stats?.avgRating ? stats.avgRating.toFixed(1) : '—',
            icon: Star,
            gradient: 'from-pink-500 to-pink-600',
            bgGradient: 'from-pink-50 to-pink-100'
        },
        {
            label: 'Feedback Received',
            value: stats ? formatNumber(stats.totalFeedback) : '—',
            icon: MessageSquare,
            gradient: 'from-orange-500 to-orange-600',
            bgGradient: 'from-orange-50 to-orange-100'
        },
        {
            label: 'Total Activity',
            value: stats ? formatNumber(stats.totalCaptions + (stats.totalFeedback || 0)) : '—',
            icon: Activity,
            gradient: 'from-purple-500 via-pink-500 to-orange-500',
            bgGradient: 'from-purple-50 via-pink-50 to-orange-50'
        }
    ];

    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((index) => (
                    <div
                        key={index}
                        className="bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200 p-6 shadow-lg animate-pulse"
                    >
                        <div className="h-12 w-12 rounded-xl bg-slate-200 mb-4"></div>
                        <div className="h-4 w-24 bg-slate-200 rounded mb-2"></div>
                        <div className="h-8 w-16 bg-slate-200 rounded"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat, index) => {
                const Icon = stat.icon;
                return (
                    <div
                        key={stat.label}
                        className={`bg-white/90 backdrop-blur-sm rounded-xl border-2 border-slate-200 p-6 shadow-lg transform transition-all duration-300 hover:shadow-xl hover:scale-105 animate-fade-in-up`}
                        style={{ animationDelay: `${index * 100}ms` }}
                    >
                        <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${stat.bgGradient} mb-4`}>
                            <Icon className={`w-6 h-6 ${stat.gradient === 'from-purple-500 via-pink-500 to-orange-500' ? 'text-purple-600' : stat.gradient.includes('purple') ? 'text-purple-600' : stat.gradient.includes('pink') ? 'text-pink-600' : 'text-orange-600'}`} />
                        </div>
                        <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">{stat.label}</p>
                        <p className={`text-3xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                            {stat.value}
                        </p>
                    </div>
                );
            })}
        </div>
    );
};

export default ProfileStats;

