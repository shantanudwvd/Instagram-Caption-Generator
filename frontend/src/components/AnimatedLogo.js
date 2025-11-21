import React from 'react';

/**
 * Animated brand mark for CaptiomMuse with glow, orbit, and pulse accents.
 */
const AnimatedLogo = ({ size = 52, showWordmark = true, subtitle = 'AI Caption Companion' }) => {
    const dimension = typeof size === 'number' ? `${size}px` : size;

    return (
        <div className="flex items-center gap-3">
            <div
                className="relative flex items-center justify-center"
                style={{ width: dimension, height: dimension }}
                aria-label="CaptiomMuse logo"
            >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 blur-xl opacity-70 logo-glow" />
                <div className="absolute inset-0 rounded-2xl border border-white/40 bg-white/10 backdrop-blur-sm shadow-[0_15px_45px_rgba(147,51,234,0.45)] logo-tilt" />
                <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white shadow-lg ring-2 ring-purple-200 logo-pulse" />
                <div className="absolute -left-1/4 top-1/2 h-2 w-2 rounded-full bg-orange-400/80 logo-orbit" />
                <div className="relative h-[70%] w-[70%] rounded-xl bg-slate-900/90 text-white flex items-center justify-center font-black tracking-tight uppercase shadow-inner shadow-black/30">
                    <span className="text-lg leading-none">CM</span>
                </div>
            </div>
            {showWordmark && (
                <div>
                    <p className="text-base font-semibold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent leading-none">
                        CaptiomMuse
                    </p>
                    {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
                </div>
            )}
        </div>
    );
};

export default AnimatedLogo;
