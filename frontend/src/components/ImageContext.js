import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Type } from 'lucide-react';

const ImageContext = ({ onContextChange }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioURL, setAudioURL] = useState('');
    const [textDescription, setTextDescription] = useState('');
    const [mode, setMode] = useState('text'); // 'text' or 'audio'
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

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
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access your microphone. Please check permissions and try again.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);

            // Stop all audio tracks
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
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
        };
    }, [audioURL]);

    const handleTextChange = (e) => {
        setTextDescription(e.target.value);
        onContextChange({ type: 'text', data: e.target.value });
    };

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Add Context to Your Image</h2>
            <div className="flex space-x-2 mb-2">
                <button
                    onClick={() => setMode('text')}
                    className={`px-3 py-2 rounded-md flex items-center ${
                        mode === 'text' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'
                    }`}
                >
                    <Type className="w-4 h-4 mr-2" />
                    Text Description
                </button>
                <button
                    onClick={() => setMode('audio')}
                    className={`px-3 py-2 rounded-md flex items-center ${
                        mode === 'audio' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'
                    }`}
                >
                    <Mic className="w-4 h-4 mr-2" />
                    Voice Recording
                </button>
            </div>

            {mode === 'text' ? (
                <div>
          <textarea
              value={textDescription}
              onChange={handleTextChange}
              placeholder="Describe your image or add context (e.g., 'This is from my hiking trip last weekend where...', 'I took this at sunset after we had just...')"
              className="w-full p-3 border rounded-lg min-h-[100px]"
          />
                </div>
            ) : (
                <div className="border rounded-lg p-4">
                    <div className="flex flex-col items-center space-y-4">
                        {!audioURL ? (
                            <button
                                onClick={isRecording ? stopRecording : startRecording}
                                className={`rounded-full p-4 ${
                                    isRecording
                                        ? 'bg-red-100 text-red-600 animate-pulse'
                                        : 'bg-blue-100 text-blue-600'
                                }`}
                            >
                                {isRecording ? (
                                    <MicOff className="w-6 h-6" />
                                ) : (
                                    <Mic className="w-6 h-6" />
                                )}
                            </button>
                        ) : (
                            <audio src={audioURL} controls className="w-full" />
                        )}
                        <p className="text-sm text-gray-600">
                            {!audioURL
                                ? (isRecording
                                    ? 'Recording... Click to stop'
                                    : 'Click to start recording')
                                : 'Your audio description is ready'}
                        </p>
                        {audioURL && (
                            <button
                                onClick={() => {
                                    setAudioURL('');
                                    setAudioBlob(null);
                                    onContextChange({ type: 'audio', data: null });
                                }}
                                className="text-sm text-red-600 hover:underline"
                            >
                                Delete and record again
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageContext;