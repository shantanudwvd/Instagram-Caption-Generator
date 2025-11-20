import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProfileSummary = () => {
    const { user, updateProfile, uploadPhoto } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        photoUrl: user?.photoUrl || '',
        password: ''
    });
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(user?.photoUrl || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    if (!user) {
        return null;
    }

    const memberDate = user.createdAt ? new Date(user.createdAt) : null;
    const initials = user.name
        ? user.name
            .split(' ')
            .map((part) => part.charAt(0).toUpperCase())
            .join('')
            .slice(0, 2)
        : 'YOU';

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handlePhotoSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
        setError('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            let uploadedPhotoUrl = formData.photoUrl;
            if (photoFile) {
                uploadedPhotoUrl = await uploadPhoto(photoFile);
            }

            const payload = {
                name: formData.name,
                email: formData.email,
                photoUrl: uploadedPhotoUrl
            };

            if (formData.password.trim().length > 0) {
                payload.password = formData.password;
            }

            await updateProfile(payload);
            setSuccess('Profile updated successfully');
            setFormData((prev) => ({
                ...prev,
                photoUrl: uploadedPhotoUrl || prev.photoUrl,
                password: ''
            }));
            setPhotoFile(null);
            setIsEditing(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white/90 backdrop-blur-sm shadow-xl p-6 transform transition-all duration-300 hover:shadow-2xl hover:scale-[1.01]">
            <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br from-purple-300 via-pink-300 to-orange-300 blur-3xl opacity-50 animate-blob" />
            <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-gradient-to-br from-orange-300 via-pink-300 to-purple-300 blur-3xl opacity-30 animate-blob animation-delay-2000" />
            <div className="relative flex flex-col gap-6">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        {photoPreview ? (
                            <img
                                src={photoPreview}
                                alt={user.name}
                                className="h-16 w-16 rounded-2xl object-cover shadow-md border border-slate-200"
                            />
                        ) : (
                            <div className="h-16 w-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-2xl font-semibold shadow-md">
                                {initials}
                            </div>
                        )}
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Signed in as</p>
                            <p className="text-2xl font-semibold text-slate-900">{user.name}</p>
                            <p className="text-sm text-slate-500">{user.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Member since</p>
                            <p className="text-base font-semibold text-slate-900">
                                {memberDate
                                    ? memberDate.toLocaleDateString(undefined, {
                                        month: 'short',
                                        year: 'numeric'
                                    })
                                    : '—'}
                            </p>
                        </div>
                        <Link
                            to="/generator"
                            className="inline-flex items-center px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all duration-200"
                        >
                            Start Generating
                        </Link>
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center px-4 py-2 rounded-2xl border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:bg-gradient-to-r hover:from-purple-50 hover:via-pink-50 hover:to-orange-50 hover:border-purple-300 transform hover:scale-105 active:scale-95 transition-all duration-200"
                        >
                            View Dashboard
                        </Link>
                    </div>
                </div>

                <button
                    onClick={() => {
                        setError('');
                        setSuccess('');
                        setIsEditing((prev) => !prev);
                    }}
                    className="self-start text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                    {isEditing ? 'Cancel profile edit' : 'Edit profile details'}
                </button>

                {isEditing && (
                    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-100 bg-white/70 p-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Leave blank to keep current password"
                                minLength={8}
                            />
                            <p className="mt-1 text-xs text-slate-500">At least 8 characters. Leave empty to keep existing password.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Profile Photo</label>
                            <div className="flex items-center gap-3">
                                <label className="inline-flex items-center px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handlePhotoSelect}
                                    />
                                    Choose file
                                </label>
                                {photoFile && (
                                    <span className="text-xs text-slate-500">
                                        {photoFile.name}
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">Upload a JPG or PNG (max 5MB) to update your avatar.</p>
                        </div>

                        {error && <p className="text-sm text-rose-600">{error}</p>}
                        {success && <p className="text-sm text-emerald-600">{success}</p>}

                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:transform-none"
                            >
                                {saving ? 'Saving...' : 'Save changes'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEditing(false);
                                    setFormData({
                                        name: user.name,
                                        email: user.email,
                                        photoUrl: user.photoUrl || '',
                                        password: ''
                                    });
                                    setPhotoFile(null);
                                    setPhotoPreview(user.photoUrl || '');
                                }}
                                className="inline-flex items-center px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Discard
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ProfileSummary;
