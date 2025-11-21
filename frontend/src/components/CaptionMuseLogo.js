import React from 'react';

const CaptionMuseLogo = ({ className = '' }) => {
    return (
        <div className={`captionmuse-logo inline-flex items-center justify-center ${className}`}>
            <svg
                className="w-full h-full"
                width="220"
                height="140"
                viewBox="0 0 280 170"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    {/* Gooey liquid filter */}
                    <filter id="goo">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
                        <feColorMatrix
                            in="blur"
                            mode="matrix"
                            values="
                                1 0 0 0 0
                                0 1 0 0 0
                                0 0 1 0 0
                                0 0 0 22 -12
                            "
                            result="goo"
                        />
                        <feBlend in="SourceGraphic" in2="goo" />
                    </filter>
                </defs>

                {/* Everything liquid / photo / caption inside the goo filter */}
                <g filter="url(#goo)">
                    {/* Polaroid-style tilted photo icon */}
                    <g id="photoGroup">
                        {/* Polaroid frame */}
                        <rect
                            id="photoFrame"
                            x="18"
                            y="30"
                            width="82"
                            height="72"
                            rx="10"
                            stroke="#BC7BFF"
                            strokeWidth="5"
                            fill="none"
                        />
                        {/* Inner photo area */}
                        <rect
                            x="26"
                            y="38"
                            width="66"
                            height="46"
                            rx="6"
                            stroke="#BC7BFF"
                            strokeWidth="2"
                            fill="none"
                        />
                        {/* Sun / lens */}
                        <circle id="photoDot" cx="44" cy="50" r="6" fill="#BC7BFF" />
                        {/* Mountains / landscape */}
                        <path
                            id="photoMountain"
                            d="M32 78 L50 58 L66 72 L78 78"
                            stroke="#BC7BFF"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                        />
                    </g>

                    {/* 🎵 Main music note traveling from photo to bubble */}
                    <g id="musicNote" fill="#FF8DA1">
                        {/* Note head */}
                        <circle cx="80" cy="88" r="7" />
                        {/* Stem */}
                        <rect x="83" y="60" width="4" height="24" rx="2" />
                        {/* Flag */}
                        <path d="M87 60 L103 56 L103 64 L87 68 Z" />
                    </g>

                    {/* Small music note #1 (trailing) */}
                    <g id="drop1" fill="#FF8DA1">
                        <circle cx="68" cy="74" r="4" />
                        <rect x="70" y="60" width="3" height="18" rx="2" />
                        <path d="M73 60 L83 57 L83 63 L73 66 Z" />
                    </g>

                    {/* Extra-small music note #2 (trailing) */}
                    <g id="drop2" fill="#FF8DA1">
                        <circle cx="84" cy="88" r="3" />
                        <rect x="86" y="78" width="2.4" height="14" rx="1.5" />
                        <path d="M88 78 L96 76 L96 80 L88 82 Z" />
                    </g>

                    {/* Caption Bubble */}
                    <rect
                        id="bubble"
                        x="155"
                        y="40"
                        width="100"
                        height="70"
                        rx="14"
                        stroke="#FF8DA1"
                        strokeWidth="6"
                        fill="none"
                    />

                    {/* Caption Lines (generated caption) */}
                    <line
                        id="line1"
                        x1="170"
                        y1="65"
                        x2="230"
                        y2="65"
                        stroke="#FF8DA1"
                        strokeWidth="6"
                        strokeLinecap="round"
                    />
                    <line
                        id="line2"
                        x1="170"
                        y1="85"
                        x2="220"
                        y2="85"
                        stroke="#FF8DA1"
                        strokeWidth="6"
                        strokeLinecap="round"
                    />

                    {/* Brand blob under the bubble that will "become" the text */}
                    <circle id="brandBlob" cx="205" cy="125" r="10" fill="#FF8DA1" />
                </g>

                {/* Sparkle highlight (currently disabled in CSS) */}
                <path
                    id="sparkle"
                    d="M0 -4 L4 0 L0 4 L-4 0 Z"
                    fill="#FFFFFF"
                    transform="translate(80 80)"
                />

                {/* Brand text: CaptionMuse (morphs in after brandBlob) */}
                <text
                    id="brandText"
                    x="205"
                    y="157"
                    textAnchor="middle"
                    fill="#FF8DA1"
                    fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
                    fontSize="18"
                    fontWeight="600"
                >
                    Caption
                    <tspan fill="#BC7BFF">Muse</tspan>
                </text>
            </svg>
        </div>
    );
};

export default CaptionMuseLogo;
