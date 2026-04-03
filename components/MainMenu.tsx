import React from 'react';

interface MainMenuProps {
    onQuickPlay: () => void;
    onSettings: () => void;
    onRules: () => void;
}

export default function MainMenu({ onQuickPlay, onSettings, onRules }: MainMenuProps) {
    return (
        <div className="min-h-screen bg-stone-900 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900" />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20" />

            <div className="relative z-10 flex flex-col items-center gap-8 px-8">
                {/* Title */}
                <div className="text-center">
                    <h1 className="text-6xl md:text-7xl font-fantasy text-amber-200 uppercase tracking-tighter drop-shadow-lg">
                        Spellbound
                    </h1>
                    <h2 className="text-4xl md:text-5xl font-fantasy text-amber-400/80 uppercase tracking-widest -mt-2 drop-shadow-md">
                        Gridiron
                    </h2>
                    <p className="mt-4 text-stone-500 text-sm tracking-widest uppercase">
                        Tactical Fantasy Football
                    </p>
                </div>

                {/* Menu Buttons */}
                <div className="flex flex-col gap-3 w-72">
                    <button
                        onClick={onQuickPlay}
                        className="w-full py-4 bg-amber-700 hover:bg-amber-600 text-white font-bold uppercase tracking-widest rounded-lg shadow-lg border border-amber-500/30 transition-all hover:scale-[1.02] text-lg"
                    >
                        Quick Play
                    </button>

                    <button
                        disabled
                        className="w-full py-4 bg-stone-800 text-stone-600 font-bold uppercase tracking-widest rounded-lg border border-white/5 cursor-not-allowed text-sm"
                    >
                        Campaign (Coming Soon)
                    </button>

                    <div className="flex gap-3">
                        <button
                            onClick={onSettings}
                            className="flex-1 py-3 bg-stone-800 hover:bg-stone-700 text-gray-400 hover:text-white font-bold uppercase tracking-widest rounded-lg border border-white/10 transition-colors text-xs"
                        >
                            Settings
                        </button>
                        <button
                            onClick={onRules}
                            className="flex-1 py-3 bg-stone-800 hover:bg-stone-700 text-gray-400 hover:text-white font-bold uppercase tracking-widest rounded-lg border border-white/10 transition-colors text-xs"
                        >
                            Rules
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-stone-700 text-xs mt-8">
                    A turn-based tactical fantasy sports game
                </p>
            </div>
        </div>
    );
}
