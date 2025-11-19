import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navigation = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const initials = user?.name
        ? user.name
            .split(' ')
            .map((part) => part.charAt(0).toUpperCase())
            .join('')
            .slice(0, 2)
        : 'CM';

    return (
        <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
                <Link to="/" className="flex items-center gap-3">
                    <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-500 text-white font-semibold flex items-center justify-center">
                        CM
                    </span>
                    <div>
                        <p className="text-base font-semibold text-slate-900 leading-none">Caption Muse</p>
                        <p className="text-xs text-slate-500">AI Caption Companion</p>
                    </div>
                </Link>
                <div className="flex items-center gap-4">
                    <Link
                        to="/generator"
                        className={`hidden sm:inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl border ${
                            location.pathname === '/generator'
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'text-slate-600 border-slate-200 hover:text-slate-900'
                        } transition-colors`}
                    >
                        <Sparkles className="w-4 h-4" />
                        Studio
                    </Link>
                    <Link
                        to="/dashboard"
                        className={`hidden sm:inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl border transition-colors ${
                            location.pathname === '/dashboard'
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'text-slate-600 border-slate-200 hover:text-slate-900'
                        }`}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        Dashboard
                    </Link>
                    {user && (
                        <div className="flex items-center gap-3">
                            <div className="hidden sm:flex flex-col text-right leading-tight">
                                <span className="text-xs text-slate-500">Logged in</span>
                                <span className="text-sm font-semibold text-slate-900">{user.name}</span>
                            </div>
                            <div className="h-10 w-10 rounded-2xl bg-slate-900/90 text-white flex items-center justify-center font-semibold">
                                {initials}
                            </div>
                            <button
                                onClick={logout}
                                className="text-sm font-medium text-rose-500 hover:text-rose-600 transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navigation;
