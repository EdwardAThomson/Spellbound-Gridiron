import React from 'react';
import { TerrainType, Weather } from '../types';
import { TERRAIN_CONFIG } from '../constants';

// Who controls the AWAY team in a Quick Play match: a second human on the same
// keyboard (Hotseat) or the built-in rules-based Computer opponent.
export type OpponentType = 'HOTSEAT' | 'COMPUTER';

interface StartOverlayProps {
    onStart: () => void;
    isThinking?: boolean;
    terrain: TerrainType;
    onSelectTerrain: (terrain: TerrainType) => void;
    weather: Weather;
    onSelectWeather: (weather: Weather) => void;
    // Quick Play opponent selector: Computer (default) or Hotseat.
    opponent: OpponentType;
    onSelectOpponent: (opponent: OpponentType) => void;
    // Return to the main menu without kicking off. Optional so the overlay still
    // works standalone; when supplied a "Back to Menu" control is shown.
    onBack?: () => void;
}

// The two opponent choices and what each means, shown as button tooltips.
const OPPONENT_ORDER: { opponent: OpponentType; label: string; effect: string }[] = [
    { opponent: 'COMPUTER', label: 'Computer', effect: 'The AWAY team is run by the built-in rules-based computer opponent (no API keys needed).' },
    { opponent: 'HOTSEAT', label: 'Hotseat', effect: 'Two players share one keyboard, taking turns on the same screen.' },
];

const TERRAIN_ORDER: TerrainType[] = [
    TerrainType.GRASS,
    TerrainType.MUD,
    TerrainType.LAVA,
    TerrainType.ICE,
];

// Weather choices and the mechanical effect each has, shown as button tooltips
// so the risk is clear before kickoff.
const WEATHER_ORDER: { weather: Weather; label: string; effect: string }[] = [
    { weather: Weather.CLEAR, label: 'Clear', effect: 'Perfect conditions. No penalties.' },
    { weather: Weather.RAIN, label: 'Rain', effect: 'Slippery ball: passes are +1 harder.' },
    { weather: Weather.BLIZZARD, label: 'Blizzard', effect: 'Driving snow: passes +2 harder and every player -1 Move.' },
    { weather: Weather.METEOR_SHOWER, label: 'Meteor Shower', effect: 'Meteors fall: a tile is telegraphed one round, then struck, knocking down anyone on it.' },
];

export default function StartOverlay({ onStart, isThinking, terrain, onSelectTerrain, weather, onSelectWeather, opponent, onSelectOpponent, onBack }: StartOverlayProps) {
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

                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        disabled={isThinking}
                        className="mb-6 text-xs text-stone-400 hover:text-stone-200 underline underline-offset-4 disabled:opacity-50"
                    >
                        ← Back to Menu
                    </button>
                )}

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

                {/* Weather picker */}
                <div className="mb-10">
                    <p className="text-stone-500 uppercase tracking-widest text-[10px] font-mono mb-3">Choose the Weather</p>
                    <div className="flex gap-2 justify-center flex-wrap max-w-md mx-auto">
                        {WEATHER_ORDER.map(({ weather: w, label, effect }) => {
                            const active = w === weather;
                            return (
                                <button
                                    key={w}
                                    type="button"
                                    onClick={() => onSelectWeather(w)}
                                    disabled={isThinking}
                                    aria-pressed={active}
                                    title={effect}
                                    className={`px-3 py-2 rounded-lg border-2 text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                                        active
                                            ? 'border-amber-400 bg-amber-500/10 text-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.3)]'
                                            : 'border-white/10 bg-stone-900/70 text-stone-300 hover:border-white/40'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Opponent picker: Computer (default) vs Hotseat. */}
                <div className="mb-10" data-testid="opponent-picker">
                    <p className="text-stone-500 uppercase tracking-widest text-[10px] font-mono mb-3">Choose your Opponent</p>
                    <div className="flex gap-2 justify-center flex-wrap max-w-md mx-auto">
                        {OPPONENT_ORDER.map(({ opponent: o, label, effect }) => {
                            const active = o === opponent;
                            return (
                                <button
                                    key={o}
                                    type="button"
                                    onClick={() => onSelectOpponent(o)}
                                    disabled={isThinking}
                                    aria-pressed={active}
                                    title={effect}
                                    className={`px-4 py-2 rounded-lg border-2 text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                                        active
                                            ? 'border-amber-400 bg-amber-500/10 text-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.3)]'
                                            : 'border-white/10 bg-stone-900/70 text-stone-300 hover:border-white/40'
                                    }`}
                                >
                                    {o === 'COMPUTER' ? '🤖 ' : '🧑‍🤝‍🧑 '}{label}
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
