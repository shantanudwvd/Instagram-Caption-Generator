import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import ProfilePage from './pages/ProfilePage';
import GeneratorPage from './pages/GeneratorPage';
import UserDashboard from './components/admin/Dashboard';
import CaptionsBrowser from './pages/CaptionsBrowser';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import TipsPage from './pages/TipsPage';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <ThemeProvider>
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<ProfilePage />} />
                        <Route path="/generator" element={<GeneratorPage />} />
                        <Route path="/dashboard" element={<UserDashboard />} />
                        <Route path="/captions" element={<CaptionsBrowser />} />
                        <Route path="/tips" element={<TipsPage />} />
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </ThemeProvider>
    </React.StrictMode>
);
