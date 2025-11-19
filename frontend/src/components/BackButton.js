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
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
            {direction !== 'forward' && (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                    <Icon className="w-3.5 h-3.5" />
                </span>
            )}
            <span>{label}</span>
            {direction === 'forward' && (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                    <Icon className="w-3.5 h-3.5" />
                </span>
            )}
        </button>
    );
};

export default BackButton;
