import React from 'react';
import { GameState } from '../types';

interface HalftimeScreenProps {
    gameState: GameState;
    onStartSecondHalf: () => void;
}

export default function HalftimeScreen({ gameState, onStartSecondHalf }: HalftimeScreenProps) {
    const { homeTeam, awayTeam, terrain, weather } = gameState;

    return (
        <div className="min-h-screen bg-stone-900 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900" />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20" />

            <div className="relative z-10 flex flex-col items-center gap-6 px-8 max-w-lg w-full">
                <div className="text-center">
                    <p className="text-sm text-amber-500/60 uppercase tracking-widest mb-2">Halftime</p>
                    <h1 className="text-5xl font-fantasy text-amber-200 uppercase">Break</h1>
                </div>

                {/* Halftime Score */}
                <div className="w-full bg-black/50 rounded-xl border border-white/10 p-6">
                    <div className="flex justify-between items-center">
                        <div className="text-center flex-1">
                            <p className="text-xs text-blue-400/60 uppercase tracking-widest">{homeTeam.race}</p>
                            <p className="text-sm font-bold text-blue-300">{homeTeam.name}</p>
                            <p className="text-4xl font-fantasy text-blue-400 mt-2">{homeTeam.score}</p>
                        </div>
                        <div className="text-stone-600 text-xl px-4">-</div>
                        <div className="text-center flex-1">
                            <p className="text-xs text-red-400/60 uppercase tracking-widest">{awayTeam.race}</p>
                            <p className="text-sm font-bold text-red-300">{awayTeam.name}</p>
                            <p className="text-4xl font-fantasy text-red-400 mt-2">{awayTeam.score}</p>
                        </div>
                    </div>
                </div>

                {/* Info */}
                <div className="text-center space-y-2">
                    <p className="text-sm text-stone-400">
                        Teams will switch sides for the second half.
                    </p>
                    <p className="text-xs text-stone-600">
                        The team that kicked off will now receive.
                    </p>
                </div>

                <button
                    onClick={onStartSecondHalf}
                    className="w-full max-w-xs py-4 bg-amber-700 hover:bg-amber-600 text-white font-bold uppercase tracking-widest rounded-lg shadow-lg border border-amber-500/30 transition-all hover:scale-[1.02] text-lg"
                >
                    Start 2nd Half
                </button>
            </div>
        </div>
    );
}
