import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const BackButton = ({ to = '/', label = 'Back', direction = 'back' }) => {
    const navigate = useNavigate();
    const Icon = direction === 'forward' ? ArrowRight : ArrowLeft;

    return (
        <button
            type="button"
            onClick={() => navigate(to)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-purple-600 transition-all duration-200 group"
        >
            {direction !== 'forward' && (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm group-hover:border-purple-400 group-hover:bg-gradient-to-r group-hover:from-purple-50 group-hover:via-pink-50 group-hover:to-orange-50 transform transition-all duration-200 group-hover:scale-110">
                    <Icon className="w-3.5 h-3.5 transform transition-transform duration-200 group-hover:-translate-x-1" />
                </span>
            )}
            <span className="group-hover:translate-x-1 transition-transform duration-200">{label}</span>
            {direction === 'forward' && (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm group-hover:border-purple-400 group-hover:bg-gradient-to-r group-hover:from-purple-50 group-hover:via-pink-50 group-hover:to-orange-50 transform transition-all duration-200 group-hover:scale-110">
                    <Icon className="w-3.5 h-3.5 transform transition-transform duration-200 group-hover:translate-x-1" />
                </span>
            )}
        </button>
    );
};

export default BackButton;
