import React from 'react';
import { TerrainType } from '../types';
import { TERRAIN_CONFIG } from '../constants';

interface StartOverlayProps {
    onStart: () => void;
    isThinking?: boolean;
    terrain: TerrainType;
    onSelectTerrain: (terrain: TerrainType) => void;
}

const TERRAIN_ORDER: TerrainType[] = [
    TerrainType.GRASS,
    TerrainType.MUD,
    TerrainType.LAVA,
    TerrainType.ICE,
];

export default function StartOverlay({ onStart, isThinking, terrain, onSelectTerrain }: StartOverlayProps) {
    return (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="text-center animate-in fade-in zoom-in duration-700">
                <div className="text-6xl mb-4 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">🌋</div>
                <h1 className="text-5xl font-fantasy text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-purple-300 to-amber-200 uppercase tracking-tighter mb-2">
                    Spellbound Gridiron
                </h1>
                <p className="text-stone-400 font-mono text-sm tracking-widest mb-8">
                    Fantasy Football & ARCANE WARFARE
                </p>

                {/* Terrain picker */}
                <div className="mb-10">
                    <p className="text-stone-500 uppercase tracking-widest text-[10px] font-mono mb-3">Choose the Battlefield</p>
                    <div className="flex gap-3 justify-center flex-wrap max-w-md mx-auto">
                        {TERRAIN_ORDER.map((t) => {
                            const info = TERRAIN_CONFIG[t];
                            const active = t === terrain;
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => onSelectTerrain(t)}
                                    disabled={isThinking}
                                    aria-pressed={active}
                                    title={info.description}
                                    className={`relative w-24 rounded-lg overflow-hidden border-2 transition-all disabled:opacity-50 ${
                                        active
                                            ? 'border-amber-400 scale-105 shadow-[0_0_18px_rgba(251,191,36,0.35)]'
                                            : 'border-white/10 hover:border-white/40'
                                    }`}
                                >
                                    <div className={`h-10 bg-gradient-to-br ${info.color}`}></div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider py-1 px-1 bg-stone-900/90 text-stone-200">
                                        {info.name}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

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
