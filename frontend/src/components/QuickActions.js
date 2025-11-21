import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, LayoutDashboard, List, HelpCircle } from 'lucide-react';

const QuickActions = () => {
    const actions = [
        {
            title: 'Start Generating',
            description: 'Create new captions',
            icon: Sparkles,
            link: '/generator',
            gradient: 'from-purple-600 via-pink-500 to-orange-400',
            bgGradient: 'from-purple-50 via-pink-50 to-orange-50',
            sparkle: 'glow-pulse-purple'
        },
        {
            title: 'View Dashboard',
            description: 'See your analytics',
            icon: LayoutDashboard,
            link: '/dashboard',
            gradient: 'from-purple-600 to-pink-500',
            bgGradient: 'from-purple-50 to-pink-50',
            sparkle: 'glow-pulse-purple'
        },
        {
            title: 'Browse Captions',
            description: 'View all captions',
            icon: List,
            link: '/captions',
            gradient: 'from-pink-500 to-orange-500',
            bgGradient: 'from-pink-50 to-orange-50',
            sparkle: 'glow-pulse-pink'
        },
        {
            title: 'Tips & Tricks',
            description: 'Learn best practices',
            icon: HelpCircle,
            link: '/tips',
            gradient: 'from-purple-500 via-pink-500 to-orange-500',
            bgGradient: 'from-purple-50 via-pink-50 to-orange-50',
            sparkle: 'glow-pulse-multi'
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {actions.map((action, index) => {
                const Icon = action.icon;
                const content = (
                    <div
                        className={`bg-white/90 backdrop-blur-sm rounded-xl border-2 border-slate-200 p-6 shadow-lg transform transition-all duration-300 hover:shadow-xl hover:scale-105 cursor-pointer group animate-fade-in-up`}
                        style={{ animationDelay: `${index * 100}ms` }}
                        onClick={action.onClick}
                    >
                        <div className={`relative inline-flex p-3 rounded-xl bg-gradient-to-br ${action.bgGradient} mb-4 group-hover:scale-110 transition-transform duration-200 overflow-visible`}>
                            <span className={`absolute inset-0 rounded-xl ${action.sparkle} pointer-events-none`}></span>
                            <Icon className={`relative w-6 h-6 icon-animated ${action.gradient.includes('purple') && action.gradient.includes('orange') ? 'text-purple-600' : action.gradient.includes('purple') ? 'text-purple-600' : action.gradient.includes('pink') ? 'text-pink-600' : 'text-orange-600'} transition-transform duration-300 group-hover:scale-110`} />
                        </div>
                        <h3 className={`text-lg font-semibold bg-gradient-to-r ${action.gradient} bg-clip-text text-transparent mb-1`}>
                            {action.title}
                        </h3>
                        <p className="text-sm text-slate-500">{action.description}</p>
                    </div>
                );

                if (action.onClick) {
                    return <div key={action.title}>{content}</div>;
                }

                return (
                    <Link key={action.title} to={action.link} className="block">
                        {content}
                    </Link>
                );
            })}
        </div>
    );
};

export default QuickActions;
