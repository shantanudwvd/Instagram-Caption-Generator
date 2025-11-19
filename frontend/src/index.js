import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import ProfilePage from './pages/ProfilePage';
import GeneratorPage from './pages/GeneratorPage';
import UserDashboard from './components/admin/Dashboard';
import { AuthProvider } from './context/AuthContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<ProfilePage />} />
                    <Route path="/generator" element={<GeneratorPage />} />
                    <Route path="/dashboard" element={<UserDashboard />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    </React.StrictMode>
);
