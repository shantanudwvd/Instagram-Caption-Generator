import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Type, CheckCircle2, Loader2 } from 'lucide-react';

const ImageContext = ({ onContextChange }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioURL, setAudioURL] = useState('');
    const [elapsedMs, setElapsedMs] = useState(0);
    const [recordedDurationMs, setRecordedDurationMs] = useState(0);
    const [textDescription, setTextDescription] = useState('');
    const [mode, setMode] = useState('text'); // 'text' or 'audio'
    const [transcription, setTranscription] = useState('');
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcriptSupported, setTranscriptSupported] = useState(true);
    const BAR_COUNT = 34;
    const [levels, setLevels] = useState(new Array(BAR_COUNT).fill(8));
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const startTimeRef = useRef(null);
    const recognitionRef = useRef(null);
    const audioElementRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const dataArrayRef = useRef(null);
    const rafRef = useRef(null);

    const formatDuration = (ms) => {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const RecordingRail = () => (
        <div className="recording-rail flex-1 h-12 rounded-full pl-3 pr-16 flex items-center gap-1 overflow-hidden relative">
            {levels.map((h, idx) => (
                <span
                    key={idx}
                    className="recording-rail-bar"
                    style={{ height: `${Math.max(6, Math.min(48, h))}px` }}
                />
            ))}
        </div>
    );

    const startTranscriptCapture = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setTranscriptSupported(false);
            setIsTranscribing(false);
            return;
        }

        setTranscriptSupported(true);
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            let interim = '';
            let finalText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalText += transcript;
                } else {
                    interim += transcript;
                }
            }
            setTranscription((prev) => {
                const base = finalText || prev || '';
                return interim ? `${base} ${interim}`.trim() : base.trim();
            });
        };

        recognition.onerror = () => {
            setTranscriptSupported(false);
            setIsTranscribing(false);
        };

        recognition.onend = () => {
            setIsTranscribing(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsTranscribing(true);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            setTranscription('');
            setElapsedMs(0);
            setRecordedDurationMs(0);

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                setAudioBlob(audioBlob);
                setAudioURL(audioUrl);
                onContextChange({ type: 'audio', data: audioBlob });
            };

            mediaRecorder.start();
            setIsRecording(true);
            startTimeRef.current = Date.now();
            timerRef.current = setInterval(() => {
                setElapsedMs(Date.now() - startTimeRef.current);
            }, 200);
            startTranscriptCapture();

            // Web Audio analyser for live levels
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioContextRef.current = new AudioContextClass();
                const source = audioContextRef.current.createMediaStreamSource(stream);
                analyserRef.current = audioContextRef.current.createAnalyser();
                analyserRef.current.smoothingTimeConstant = 0.5;
                analyserRef.current.fftSize = 512;
                dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
                source.connect(analyserRef.current);

                const tick = () => {
                    analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
                    let sum = 0;
                    for (let i = 0; i < dataArrayRef.current.length; i++) {
                        const v = (dataArrayRef.current[i] - 128) / 128;
                        sum += v * v;
                    }
                    const rms = Math.sqrt(sum / dataArrayRef.current.length);
                    const boost = Math.min(1, rms * 7.5); // scale
                    const now = Date.now();
                    setLevels((prev) => {
                        const next = new Array(BAR_COUNT).fill(0).map((_, idx) => {
                            const mirrorIdx = idx < BAR_COUNT / 2 ? idx : BAR_COUNT - idx - 1;
                            const wobble =
                                Math.sin(now / 320 + mirrorIdx * 0.7) * 4 +
                                Math.sin(now / 180 + mirrorIdx * 1.1) * 3;
                            const target = 10 + boost * 52 + wobble;
                            const current = prev[idx] || 10;
                            const lerp = 0.16; // smoothing factor for fluid motion
                            return current + (target - current) * lerp;
                        });
                        return next;
                    });
                    rafRef.current = requestAnimationFrame(tick);
                };
                tick();
            }
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access your microphone. Please check permissions and try again.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (startTimeRef.current) {
                setElapsedMs(Date.now() - startTimeRef.current);
            }

            // Stop all audio tracks
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
    };

    useEffect(() => {
        // Cleanup function
        return () => {
            if (audioURL) {
                URL.revokeObjectURL(audioURL);
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, [audioURL]);

    const handleTextChange = (e) => {
        setTextDescription(e.target.value);
        onContextChange({ type: 'text', data: e.target.value });
    };

    const renderStatusDot = (color) => (
        <span className={`h-2.5 w-2.5 rounded-full inline-block ${color}`}></span>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.3em] text-purple-500 font-semibold">Step 1b</p>
                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Add context to your image</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Choose to type or record—your vibe guides the caption.</p>
                </div>
                <div className="inline-flex items-center rounded-full bg-slate-100/80 dark:bg-slate-900/70 p-1 shadow-inner dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] border border-transparent dark:border-slate-800">
                    <button
                        onClick={() => setMode('text')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 ${
                            mode === 'text'
                                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100 dark:shadow-none'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                    >
                        <Type className="w-4 h-4" />
                        Text
                    </button>
                    <button
                        onClick={() => setMode('audio')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 ${
                            mode === 'audio'
                                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100 dark:shadow-none'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                    >
                        <Mic className="w-4 h-4" />
                        Voice
                    </button>
                </div>
            </div>

            {mode === 'text' ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/70 p-4 sm:p-5 shadow-inner dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300 mb-3 uppercase tracking-[0.2em]">
                        {renderStatusDot('bg-emerald-500')}
                        Freestyle prompt
                    </div>
                    <textarea
                        value={textDescription}
                        onChange={handleTextChange}
                        placeholder="Describe the mood, setting, or story you want to tell (e.g., 'Sunset coffee with my best friend before the big move', 'Post-game pizza run—still hyped from the win')."
                        className="w-full rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm p-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-purple-500/30 dark:focus:border-purple-500/40"
                        rows={4}
                    />
                </div>
            ) : (
                <div className="p-[1px] rounded-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400">
                    <div className="rounded-2xl bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-5 sm:p-6 shadow-lg dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                        <div className="flex flex-col gap-5 md:flex-row md:items-center">
                            <div className="flex flex-col items-center justify-center gap-3">
                                <div className="relative">
                                    <div className={`absolute inset-0 rounded-full blur-xl transition-opacity ${isRecording ? 'opacity-80 bg-red-200/60' : 'opacity-40 bg-purple-200/60'}`}></div>
                                    {isRecording && (
                                        <>
                                            <div className="absolute inset-[-6px] rounded-full border border-orange-200 animate-ping" />
                                            <div className="absolute inset-[-12px] rounded-full border border-pink-200 opacity-70 animate-[ping_2s_linear_infinite]" />
                                        </>
                                    )}
                                    <button
                                        onClick={isRecording ? stopRecording : startRecording}
                                        className={`relative z-10 h-16 w-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 ${
                                            isRecording
                                                ? 'bg-gradient-to-r from-red-500 to-orange-500 animate-pulse'
                                                : 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:scale-105'
                                        }`}
                                        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                                    >
                                        {isRecording ? (
                                            <MicOff className="w-6 h-6" />
                                        ) : (
                                            <Mic className="w-6 h-6" />
                                        )}
                                    </button>
                                </div>
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-semibold">
                                    {isRecording ? 'Listening' : audioURL ? 'Recorded' : 'Ready'}
                                </p>
                            </div>

                            <div className="flex-1 w-full space-y-3">
                                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold dark:bg-slate-800/80 dark:text-slate-100">
                                        {renderStatusDot(isRecording ? 'bg-red-500 animate-pulse' : 'bg-emerald-500')}
                                        {isRecording ? 'Recording… tap to stop' : audioURL ? 'Recorded' : 'Ready to record'}
                                    </span>
                                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-semibold">
                                        {isRecording || recordedDurationMs
                                            ? formatDuration(isRecording ? elapsedMs : recordedDurationMs || elapsedMs)
                                            : '00:00'}
                                    </span>
                                </div>
                                {isRecording && (
                                    <div className="text-xs font-semibold text-rose-500 dark:text-rose-300">
                                        Listening...
                                    </div>
                                )}

                                {isRecording && (
                                    <div className="rounded-xl border border-rose-100 dark:border-rose-400/40 bg-rose-50/70 dark:bg-rose-950/50 p-3 shadow-inner w-full">
                                        <div className="relative h-10 w-full">
                                            <RecordingRail />
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-rose-600 dark:text-rose-300 z-10">
                                                {formatDuration(elapsedMs)}
                                            </span>
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-[0.2em] text-rose-400 dark:text-rose-300 font-semibold z-10">
                                                live
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {audioURL ? (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/70 p-3">
                                        <audio
                                            ref={audioElementRef}
                                            src={audioURL}
                                            controls
                                            className="w-full"
                                            onLoadedMetadata={() => {
                                                if (audioElementRef.current?.duration) {
                                                    setRecordedDurationMs(Math.floor(audioElementRef.current.duration * 1000));
                                                }
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                                        We record in a web-friendly format for fast Whisper transcriptions. Keep it
                                        concise and conversational.
                                    </div>
                                )}

                                {audioURL && (
                                    <div className="rounded-xl border border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70 backdrop-blur-sm p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-100 font-semibold">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                                <span>Transcript</span>
                                            </div>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                {formatDuration(recordedDurationMs || elapsedMs)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-300">
                                            {isTranscribing ? (
                                                <span className="inline-flex items-center gap-2 text-purple-600 dark:text-purple-300">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Transcribing your note…
                                                </span>
                                            ) : transcription ? (
                                                transcription
                                            ) : transcriptSupported ? (
                                                'Transcript will appear once the note is processed.'
                                            ) : (
                                                'Live transcript not supported in this browser. The note will still be sent with your caption.'
                                            )}
                                        </p>
                                    </div>
                                )}

                                {audioURL && (
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <button
                                            onClick={() => {
                                                setAudioURL('');
                                                setAudioBlob(null);
                                                onContextChange({ type: 'audio', data: null });
                                            }}
                                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-200 text-red-600 bg-red-50/70 hover:bg-red-100 hover:-translate-y-0.5 transition shadow-sm text-sm font-semibold dark:border-red-500/50 dark:text-red-200 dark:bg-red-950/40 dark:hover:bg-red-900/60"
                                        >
                                            <MicOff className="w-4 h-4" />
                                            Delete &amp; record again
                                        </button>
                                        <span className="text-xs text-slate-400 dark:text-slate-500">Formats: webm (auto), wav, mp3 supported</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageContext;
