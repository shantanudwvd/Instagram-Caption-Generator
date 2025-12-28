import React from 'react';
import { Lightbulb, Sparkles, PenTool, Zap, Shield, ArrowLeftCircle } from 'lucide-react';
import Navigation from '../components/Navigation';
import BackButton from '../components/BackButton';

const TipCard = ({ icon: Icon, title, points, accent }) => (
    <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5">
        <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${accent} mb-4`}>
            <Icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed list-disc list-inside">
            {points.map((p) => (
                <li key={p}>{p}</li>
            ))}
        </ul>
    </div>
);

const TipsPage = () => {
    return (
        <>
            <Navigation />
            <div className="min-h-screen relative overflow-hidden py-12">
                <div
                    className="absolute inset-0 animate-gradient-xy opacity-30"
                    style={{
                        background:
                            'linear-gradient(-45deg, #9333ea, #ec4899, #f97316, #9333ea, #ec4899, #f97316)',
                        backgroundSize: '400% 400%',
                    }}
                />

                <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
                    <div className="flex justify-start animate-fade-in">
                        <BackButton to="/" label="Back to Profile" />
                    </div>

                    <header className="text-center space-y-4 animate-fade-in-up">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-md text-sm font-semibold text-slate-700 dark:text-slate-200">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            Caption Muse Tips
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                            Craft captions that feel human
                        </h1>
                        <p className="text-base text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
                            Use these patterns to get vivid, on-brand captions faster. Start with
                            intent, add context, and let Caption Muse do the heavy lifting.
                        </p>
                    </header>

                    <section className="grid gap-6 md:grid-cols-3 animate-fade-in-up">
                        <TipCard
                            icon={Lightbulb}
                            title="Give clear context"
                            accent="from-purple-500 via-pink-500 to-orange-400"
                            points={[
                                'Mention the scene, mood, or event (e.g., sunset rooftop, graduation, café with friends).',
                                'Drop 2–3 keywords you care about: brand voice, vibe, and sentiment.',
                                'If a product is present, name it and what makes it special.',
                            ]}
                        />
                        <TipCard
                            icon={PenTool}
                            title="Control tone & length"
                            accent="from-blue-500 to-indigo-500"
                            points={[
                                'Pick tone and length sliders in the Studio to avoid over/under-writing.',
                                'For playful posts, ask for emojis sparingly; for professional, skip them.',
                                'Add one personality trait (witty, heartfelt, confident) for consistency.',
                            ]}
                        />
                        <TipCard
                            icon={Shield}
                            title="Keep it safe & on-brand"
                            accent="from-emerald-500 to-teal-500"
                            points={[
                                'Avoid sensitive topics and inside jokes that need heavy context.',
                                'Check brand guidelines: banned words, required hashtags, or disclosures.',
                                'Use “sounds like me” feedback to fine-tune style over time.',
                            ]}
                        />
                    </section>

                    <section className="grid gap-6 md:grid-cols-2 animate-fade-in-up">
                        <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg">
                            <div className="flex items-center gap-2 mb-4">
                                <Zap className="w-5 h-5 text-orange-500" />
                                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                                    Prompt recipes that work
                                </h2>
                            </div>
                            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                                    <p className="text-slate-900 dark:text-slate-100 font-medium mb-1">
                                        Event recap
                                    </p>
                                    <p>
                                        “Celebrating with close friends at a rooftop sunset in NYC.
                                        Keep it warm, 1–2 emojis, casual tone.”
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                                    <p className="text-slate-900 dark:text-slate-100 font-medium mb-1">
                                        Product highlight
                                    </p>
                                    <p>
                                        “Showcasing a handmade ceramic mug, earthy tones, cozy
                                        morning vibe. Short, inviting, no salesy language.”
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                                    <p className="text-slate-900 dark:text-slate-100 font-medium mb-1">
                                        Travel moment
                                    </p>
                                    <p>
                                        “Sunrise hike in the mountains, foggy horizon, feeling
                                        grateful. Add one nature emoji, medium length.”
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg">
                            <div className="flex items-center gap-2 mb-4">
                                <ArrowLeftCircle className="w-5 h-5 text-purple-500" />
                                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                                    Make the most of feedback
                                </h2>
                            </div>
                            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300 list-disc list-inside">
                                <li>
                                    Rate and adjust captions in Dashboard so the model learns your
                                    style.
                                </li>
                                <li>
                                    Flag overused phrases; ask for “swap clichés for fresh
                                    phrasing.”
                                </li>
                                <li>
                                    When a caption misses, specify what felt off (too long, too
                                    formal, wrong vibe).
                                </li>
                                <li>
                                    Save a few “golden” captions as reference text for future
                                    generations.
                                </li>
                            </ul>
                        </div>
                    </section>

                    <div className="text-center animate-fade-in-up">
                        <a
                            href="/generator"
                            className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                        >
                            Try these tips in the Studio
                        </a>
                    </div>
                </div>
            </div>
        </>
    );
};

export default TipsPage;
