import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem('authToken'));
    const [isInitializing, setIsInitializing] = useState(true);
    const backendUrl = process.env.REACT_APP_BACKEND_URL;

    useEffect(() => {
        const initialize = async () => {
            if (!backendUrl) {
                setIsInitializing(false);
                return;
            }

            if (!token) {
                setIsInitializing(false);
                setUser(null);
                return;
            }

            try {
                const response = await fetch(`${backendUrl}/api/auth/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (!response.ok) {
                    throw new Error('Session expired');
                }

                const data = await response.json();
                setUser(data.user);
            } catch (error) {
                localStorage.removeItem('authToken');
                setToken(null);
                setUser(null);
            } finally {
                setIsInitializing(false);
            }
        };

        initialize();
    }, [token, backendUrl]);

    const persistSession = (authResponse) => {
        setUser(authResponse.user);
        setToken(authResponse.token);
        localStorage.setItem('authToken', authResponse.token);
    };

    const ensureBackendUrl = () => {
        if (!backendUrl) {
            throw new Error('Backend URL is not configured');
        }
    };

    const login = async ({ email, password }) => {
        ensureBackendUrl();
        const response = await fetch(`${backendUrl}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Unable to login');
        }

        persistSession(data);
        return data.user;
    };

    const register = async ({ firstName, lastName, email, password }) => {
        ensureBackendUrl();
        const response = await fetch(`${backendUrl}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ firstName, lastName, email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Unable to register');
        }

        persistSession(data);
        return data.user;
    };

    const updateProfile = async (payload) => {
        ensureBackendUrl();
        const response = await fetch(`${backendUrl}/api/auth/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Unable to update profile');
        }

        persistSession(data);
        return data.user;
    };

    const uploadPhoto = async (file) => {
        ensureBackendUrl();
        const formData = new FormData();
        formData.append('photo', file);

        const response = await fetch(`${backendUrl}/api/auth/photo`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Unable to upload photo');
        }

        persistSession(data);
        return data.photoUrl || data.user?.photoUrl;
    };

    const logout = () => {
        localStorage.removeItem('authToken');
        setToken(null);
        setUser(null);
    };

    const value = {
        user,
        token,
        isInitializing,
        login,
        register,
        logout,
        updateProfile,
        uploadPhoto,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
