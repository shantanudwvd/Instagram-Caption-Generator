import React from 'react';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';

const Navigation = () => {
    return (
        <nav className="bg-white shadow-sm py-4">
            <div className="max-w-4xl mx-auto px-6 flex justify-between items-center">
                <div>
                    <Link to="/" className="text-xl font-bold text-blue-600">Caption Muse</Link>
                </div>
                <div>
                    <Link
                        to="/admin"
                        className="flex items-center text-gray-600 hover:text-blue-600 transition-colors"
                    >
                        <Settings className="w-5 h-5 mr-1" />
                        <span>Admin</span>
                    </Link>
                </div>
            </div>
        </nav>
    );
};

export default Navigation;