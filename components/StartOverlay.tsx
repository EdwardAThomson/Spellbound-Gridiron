import React from 'react';

interface StartOverlayProps {
    onStart: () => void;
    isThinking?: boolean;
}

export default function StartOverlay({ onStart, isThinking }: StartOverlayProps) {
    return (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="text-center animate-in fade-in zoom-in duration-700">
                <div className="text-6xl mb-4 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">🌋</div>
                <h1 className="text-5xl font-fantasy text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-purple-300 to-amber-200 uppercase tracking-tighter mb-2">
                    Spellbound Gridiron
                </h1>
                <p className="text-stone-400 font-mono text-sm tracking-widest mb-12">
                    Fantasy Football & ARCANE WARFARE
                </p>

                <button
                    onClick={onStart}
                    disabled={isThinking}
                    className="group relative px-12 py-5 bg-amber-700 hover:bg-amber-600 text-white rounded-lg shadow-[0_0_30px_rgba(180,83,9,0.3)] transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                    <div className="absolute inset-0 rounded-lg border-2 border-amber-400/20 group-hover:border-amber-400/50 transition-colors"></div>
                    <span className="text-2xl font-bold tracking-widest uppercase">
                        {isThinking ? 'Preparing Field...' : 'Start Match'}
                    </span>
                </button>

                <div className="mt-8 flex gap-6 justify-center opacity-40">
                    <div className="flex items-center gap-2 text-blue-400 text-xs uppercase font-bold">
                        <span>🛡️</span> High Elves
                    </div>
                    <div className="text-stone-600">VS</div>
                    <div className="flex items-center gap-2 text-red-500 text-xs uppercase font-bold">
                        <span>🪓</span> Dark Orcs
                    </div>
                </div>
            </div>
        </div>
    );
}
