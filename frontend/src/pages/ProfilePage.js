import React from 'react';
import Navigation from '../components/Navigation';
import AuthGate from '../components/auth/AuthGate';
import { useAuth } from '../context/AuthContext';
import ProfileSummary from '../components/ProfileSummary';

const ProfilePage = () => {
    const { user, isInitializing } = useAuth();

    if (isInitializing) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-slate-500">Loading...</div>
            </div>
        );
    }

    if (!user) {
        return <AuthGate />;
    }

    return (
        <>
            <Navigation />
            <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white py-12">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
                    <section className="space-y-4 text-center">
                        <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-slate-900 text-white">
                            My Profile
                        </span>
                        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900">
                            Welcome back, {user.name}
                        </h1>
                        <p className="text-base text-slate-600 max-w-3xl mx-auto">
                            Update your account details, change your password, and jump into the studio whenever inspiration hits.
                        </p>
                    </section>

                    <ProfileSummary />
                </div>
            </div>
        </>
    );
};

export default ProfilePage;
