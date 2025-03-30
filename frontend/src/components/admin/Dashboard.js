import React, { useState, useEffect } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';

const AdminDashboard = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [stats, setStats] = useState(null);
    const [trainingData, setTrainingData] = useState([]);
    const [fineTuningJobs, setFineTuningJobs] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Authentication handler
    const handleAuth = () => {
        if (apiKey) {
            localStorage.setItem('adminApiKey', apiKey);
            setIsAuthenticated(true);
            fetchDashboardData();
        }
    };

    // Load API key from localStorage on mount
    useEffect(() => {
        const savedApiKey = localStorage.getItem('adminApiKey');
        if (savedApiKey) {
            setApiKey(savedApiKey);
            setIsAuthenticated(true);
            fetchDashboardData();
        }
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // Fetch stats
            const statsResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/stats`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });
            console.log("stats response is coming as:  ", statsResponse);

            if (!statsResponse.ok) {
                throw new Error('Failed to fetch statistics');
            }

            const statsData = await statsResponse.json();
            setStats(statsData);

            // Fetch fine-tuning jobs
            const jobsResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/fine-tuning-jobs`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            if (jobsResponse.ok) {
                const jobsData = await jobsResponse.json();
                setFineTuningJobs(jobsData);
            }

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            setError('Error loading dashboard data. Please check your API key.');
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };

    const generateTrainingData = async () => {
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/generate-training-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    minFeedbackCount: 3,
                    minRating: 4
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate training data');
            }

            const data = await response.json();
            setTrainingData(data.trainingData);
            setSuccess(`Successfully generated ${data.count} training examples`);

        } catch (error) {
            console.error('Error generating training data:', error);
            setError('Failed to generate training data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const startFineTuning = async () => {
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/finetune-model`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to start fine-tuning');
            }

            const data = await response.json();

            if (data.success) {
                setSuccess(`Fine-tuning job started with ${data.exampleCount} examples. Job ID: ${data.jobId}`);
                // Refresh the jobs list
                fetchDashboardData();
            } else {
                setError(data.reason || 'Failed to start fine-tuning');
            }

        } catch (error) {
            console.error('Error starting fine-tuning:', error);
            setError('Failed to start fine-tuning: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const checkJobStatus = async (jobId) => {
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/finetune-status/${jobId}`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to check job status');
            }

            const data = await response.json();

            // Update job status in the list
            setFineTuningJobs(prevJobs =>
                prevJobs.map(job =>
                    job.jobId === jobId ? { ...job, ...data } : job
                )
            );

            return data;

        } catch (error) {
            console.error('Error checking job status:', error);
            return null;
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="max-w-md mx-auto mt-10 p-6 border rounded-lg shadow-md">
                <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            API Key
                        </label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="w-full p-2 border rounded"
                            placeholder="Enter your admin API key"
                        />
                    </div>

                    {error && <p className="text-red-600 text-sm">{error}</p>}

                    <button
                        onClick={handleAuth}
                        className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Authenticate
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            <header className="mb-8">
                <h1 className="text-3xl font-bold">Caption Generator Admin Dashboard</h1>
            </header>

            <div className="mb-6">
                <nav className="flex border-b">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`py-2 px-4 ${activeTab === 'overview' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('training')}
                        className={`py-2 px-4 ${activeTab === 'training' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
                    >
                        Training Data
                    </button>
                    <button
                        onClick={() => setActiveTab('finetuning')}
                        className={`py-2 px-4 ${activeTab === 'finetuning' ? 'border-b-2 border-blue-500 font-medium' : 'text-gray-500'}`}
                    >
                        Fine-Tuning
                    </button>
                </nav>
            </div>

            {loading && <p className="text-gray-600">Loading...</p>}
            {error && <p className="text-red-600 mb-4">{error}</p>}
            {success && <p className="text-green-600 mb-4">{success}</p>}

            {activeTab === 'overview' && stats && (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="border rounded-lg p-6 bg-white shadow-sm">
                            <h3 className="text-lg font-medium text-gray-900">Total Captions</h3>
                            <p className="text-3xl font-bold">{stats.totalCaptions}</p>
                        </div>

                        <div className="border rounded-lg p-6 bg-white shadow-sm">
                            <h3 className="text-lg font-medium text-gray-900">Average Rating</h3>
                            <p className="text-3xl font-bold">{stats.avgRating.toFixed(1)}</p>
                        </div>

                        <div className="border rounded-lg p-6 bg-white shadow-sm">
                            <h3 className="text-lg font-medium text-gray-900">Feedback Count</h3>
                            <p className="text-3xl font-bold">{stats.totalFeedback}</p>
                        </div>
                    </div>

                    <div className="border rounded-lg p-6 bg-white shadow-sm">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Ratings Distribution</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={stats.ratingDistribution}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="rating" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#3b82f6" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="border rounded-lg p-6 bg-white shadow-sm">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Caption Generation History</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={stats.generationHistory}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="count" stroke="#3b82f6" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'training' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">Training Data Management</h2>
                        <button
                            onClick={generateTrainingData}
                            disabled={loading}
                            className="py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : 'Generate Training Data'}
                        </button>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Image Context
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Song
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Caption
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Rating
                                </th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {trainingData.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                                        {loading ? 'Loading training data...' : 'No training data available. Generate training data first.'}
                                    </td>
                                </tr>
                            ) : (
                                trainingData.map((item, index) => (
                                    <tr key={index}>
                                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                                            {item.context.imageAnalysis.substring(0, 100)}...
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            {item.context.songAnalysis.name} - {item.context.songAnalysis.artist}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                                            {item.caption.substring(0, 100)}...
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            {item.avgRating.toFixed(1)} ({item.feedbackCount} reviews)
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'finetuning' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">Fine-Tuning Management</h2>
                        <button
                            onClick={startFineTuning}
                            disabled={loading}
                            className="py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : 'Start Fine-Tuning'}
                        </button>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Job ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Created
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Completed
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Model
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {fineTuningJobs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                                        No fine-tuning jobs available. Start a fine-tuning job first.
                                    </td>
                                </tr>
                            ) : (
                                fineTuningJobs.map((job) => (
                                    <tr key={job.jobId}>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            {job.jobId}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                                <span
                                                    className={`px-2 py-1 rounded-full text-xs font-semibold
                                                    ${job.status === 'succeeded' ? 'bg-green-100 text-green-800' :
                                                        job.status === 'failed' ? 'bg-red-100 text-red-800' :
                                                            job.status === 'running' ? 'bg-blue-100 text-blue-800' :
                                                                'bg-gray-100 text-gray-800'}`}
                                                >
                                                    {job.status}
                                                </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            {new Date(job.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            {job.finishedAt ? new Date(job.finishedAt).toLocaleString() : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            {job.fineTunedModel || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <button
                                                onClick={() => checkJobStatus(job.jobId)}
                                                className="text-blue-600 hover:text-blue-900"
                                            >
                                                Check Status
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;