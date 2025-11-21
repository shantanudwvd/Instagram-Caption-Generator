import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Sparkles, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CaptionMuseLogo from './CaptionMuseLogo';
import { useTheme } from '../context/ThemeContext';

const Navigation = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const { theme, toggleTheme } = useTheme();
    const fullName = user?.fullName || (user?.firstName && user?.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user?.firstName || user?.lastName || '');
    const initials = fullName
        ? fullName.split(' ').map((part) => part.charAt(0).toUpperCase()).join('').slice(0, 2)
        : 'CM';

    return (
        <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-lg shadow-sm">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
                <Link to="/" className="flex items-center gap-3 group transition-transform duration-200 hover:scale-105">
                    <div className="h-16 w-44 flex items-center justify-start">
                        <CaptionMuseLogo className="h-full w-full" />
                    </div>
                </Link>
                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleTheme}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl border text-slate-600 border-slate-200 hover:text-slate-900 hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 transform hover:scale-105"
                        aria-label="Toggle color theme"
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'} mode</span>
                    </button>
                    <Link
                        to="/generator"
                        className={`hidden sm:inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl border transition-all duration-200 transform hover:scale-105 ${
                            location.pathname === '/generator'
                                ? 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white border-transparent shadow-lg'
                                : 'text-slate-600 border-slate-200 hover:text-slate-900 hover:border-purple-300 hover:bg-purple-50'
                        }`}
                    >
                        <Sparkles className="w-4 h-4" />
                        Studio
                    </Link>
                    <Link
                        to="/dashboard"
                        className={`hidden sm:inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl border transition-all duration-200 transform hover:scale-105 ${
                            location.pathname === '/dashboard'
                                ? 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white border-transparent shadow-lg'
                                : 'text-slate-600 border-slate-200 hover:text-slate-900 hover:border-purple-300 hover:bg-purple-50'
                        }`}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        Dashboard
                    </Link>
                    {user && (
                        <div className="flex items-center gap-3">
                            <div className="hidden sm:flex flex-col text-right leading-tight">
                                <span className="text-xs text-slate-500">Logged in</span>
                                <span className="text-sm font-semibold text-slate-900">{fullName}</span>
                            </div>
                            {user.photoUrl ? (
                                <img
                                    src={user.photoUrl}
                                    alt={fullName}
                                    className="h-10 w-10 rounded-2xl object-cover border-2 border-slate-200 shadow-md transform transition-transform duration-200 hover:scale-110 hover:border-purple-400"
                                />
                            ) : (
                                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white flex items-center justify-center font-semibold shadow-md transform transition-transform duration-200 hover:scale-110">
                                    {initials}
                                </div>
                            )}
                            <button
                                onClick={logout}
                                className="text-sm font-medium text-rose-500 hover:text-rose-600 transition-all duration-200 hover:underline"
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
