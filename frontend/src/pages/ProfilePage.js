import React from 'react';
import Navigation from '../components/Navigation';
import AuthGate from '../components/auth/AuthGate';
import { useAuth } from '../context/AuthContext';
import ProfileSummary from '../components/ProfileSummary';
import ProfileStats from '../components/ProfileStats';
import QuickActions from '../components/QuickActions';
import RecentCaptionsPreview from '../components/RecentCaptionsPreview';
import LoadingSpinner from '../components/LoadingSpinner';

const ProfilePage = () => {
    const { user, isInitializing } = useAuth();

    if (isInitializing) {
        return (
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 animate-gradient-xy opacity-30" style={{
                    background: 'linear-gradient(-45deg, #9333ea, #ec4899, #f97316, #9333ea, #ec4899, #f97316)',
                    backgroundSize: '400% 400%'
                }}></div>
                <div className="relative z-10">
                    <LoadingSpinner />
                </div>
            </div>
        );
    }

    if (!user) {
        return <AuthGate />;
    }

    return (
        <>
            <Navigation />
            <div className="min-h-screen relative overflow-hidden py-12">
                {/* Animated Gradient Background */}
                <div className="absolute inset-0 animate-gradient-xy opacity-30" style={{
                    background: 'linear-gradient(-45deg, #9333ea, #ec4899, #f97316, #9333ea, #ec4899, #f97316)',
                    backgroundSize: '400% 400%'
                }}></div>
                
                {/* Floating Orbs */}
                <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute top-40 right-10 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-20 left-1/2 w-96 h-96 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
                
                <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
                    <section className="space-y-4 text-center animate-fade-in">
                        <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white shadow-lg animate-fade-in-up">
                            My Profile
                        </span>
                        <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent animate-fade-in-up animation-delay-100">
                            Welcome back, {user.name}
                        </h1>
                        <p className="text-base text-slate-600 max-w-3xl mx-auto animate-fade-in-up animation-delay-200">
                            Update your account details, change your password, and jump into the studio whenever inspiration hits.
                        </p>
                    </section>

                    <div className="animate-fade-in-up animation-delay-300">
                        <ProfileSummary />
                    </div>

                    <div className="animate-fade-in-up animation-delay-400">
                        <ProfileStats />
                    </div>

                    <div className="animate-fade-in-up animation-delay-500">
                        <QuickActions />
                    </div>

                    <div className="animate-fade-in-up animation-delay-600">
                        <RecentCaptionsPreview />
                    </div>
                </div>
            </div>
        </>
    );
};

export default ProfilePage;
