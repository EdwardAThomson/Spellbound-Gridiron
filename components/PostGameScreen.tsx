import React from 'react';
import { GameState, TeamSide, Player } from '../types';
import { TERRAIN_CONFIG } from '../constants';

interface PostGameScreenProps {
    gameState: GameState;
    onRematch: () => void;
    onMainMenu: () => void;
}

function getMvp(players: Player[]): Player | null {
    // Simple MVP heuristic: player who scored the most touchdowns isn't tracked,
    // so we use a proxy: QB/Catcher with highest skill, or strongest Lineman/Blitzer
    if (players.length === 0) return null;
    return players.reduce((best, p) => (p.stats.skill + p.stats.strength > best.stats.skill + best.stats.strength ? p : best));
}

function getMatchSummary(gameState: GameState): string[] {
    const logs = gameState.gameLog;
    const highlights: string[] = [];

    for (const log of logs) {
        if (log.includes('TOUCHDOWN') || log.includes('meteor') || log.includes('lava') ||
            log.includes('slides on the ice') || log.includes('blinks across reality') ||
            log.includes('knocked down by the fireball')) {
            highlights.push(log);
        }
    }

    return highlights.slice(-8); // Last 8 highlights
}

export default function PostGameScreen({ gameState, onRematch, onMainMenu }: PostGameScreenProps) {
    const { homeTeam, awayTeam, terrain, weather, turn } = gameState;
    const homeWon = homeTeam.score > awayTeam.score;
    const tied = homeTeam.score === awayTeam.score;
    const winnerName = tied ? null : (homeWon ? homeTeam.name : awayTeam.name);
    const winnerColor = homeWon ? 'text-blue-400' : 'text-red-400';

    const terrainInfo = TERRAIN_CONFIG[terrain];
    const homeMvp = getMvp(homeTeam.players);
    const awayMvp = getMvp(awayTeam.players);
    const highlights = getMatchSummary(gameState);

    return (
        <div className="min-h-screen bg-stone-900 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900" />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20" />

            <div className="relative z-10 flex flex-col items-center gap-6 px-8 max-w-2xl w-full">
                {/* Result Banner */}
                <div className="text-center">
                    <p className="text-sm text-stone-500 uppercase tracking-widest mb-2">Full Time</p>
                    {tied ? (
                        <h1 className="text-4xl font-fantasy text-amber-200 uppercase">Draw!</h1>
                    ) : (
                        <>
                            <h1 className={`text-4xl font-fantasy uppercase ${winnerColor}`}>
                                {winnerName} Wins!
                            </h1>
                        </>
                    )}
                </div>

                {/* Scoreboard */}
                <div className="w-full bg-black/50 rounded-xl border border-white/10 p-6">
                    <div className="flex justify-between items-center">
                        <div className="text-center flex-1">
                            <p className="text-xs text-blue-400/60 uppercase tracking-widest">{homeTeam.race}</p>
                            <p className="text-lg font-bold text-blue-300">{homeTeam.name}</p>
                            <p className="text-5xl font-fantasy text-blue-400 mt-2">{homeTeam.score}</p>
                        </div>
                        <div className="text-stone-600 text-2xl px-6">VS</div>
                        <div className="text-center flex-1">
                            <p className="text-xs text-red-400/60 uppercase tracking-widest">{awayTeam.race}</p>
                            <p className="text-lg font-bold text-red-300">{awayTeam.name}</p>
                            <p className="text-5xl font-fantasy text-red-400 mt-2">{awayTeam.score}</p>
                        </div>
                    </div>

                    {/* Match Info */}
                    <div className="mt-4 pt-4 border-t border-white/5 flex justify-center gap-6 text-xs text-stone-500">
                        <span>{turn} turns played</span>
                        <span>{terrainInfo.name}</span>
                        <span>{weather}</span>
                    </div>
                </div>

                {/* MVPs */}
                <div className="w-full grid grid-cols-2 gap-4">
                    {homeMvp && (
                        <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-4">
                            <p className="text-[10px] text-blue-400/60 uppercase tracking-widest mb-1">Home MVP</p>
                            <p className="text-sm font-bold text-blue-200">{homeMvp.name}</p>
                            <p className="text-xs text-blue-400/80">{homeMvp.role}</p>
                            <div className="mt-2 flex gap-3 text-[10px] text-blue-300/60">
                                <span>STR {homeMvp.stats.strength}</span>
                                <span>SKL {homeMvp.stats.skill}</span>
                                <span>MOV {homeMvp.stats.move}</span>
                                <span>ARM {homeMvp.stats.armor}</span>
                            </div>
                        </div>
                    )}
                    {awayMvp && (
                        <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4">
                            <p className="text-[10px] text-red-400/60 uppercase tracking-widest mb-1">Away MVP</p>
                            <p className="text-sm font-bold text-red-200">{awayMvp.name}</p>
                            <p className="text-xs text-red-400/80">{awayMvp.role}</p>
                            <div className="mt-2 flex gap-3 text-[10px] text-red-300/60">
                                <span>STR {awayMvp.stats.strength}</span>
                                <span>SKL {awayMvp.stats.skill}</span>
                                <span>MOV {awayMvp.stats.move}</span>
                                <span>ARM {awayMvp.stats.armor}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Key Plays */}
                {highlights.length > 0 && (
                    <div className="w-full bg-stone-800/50 rounded-lg border border-white/5 p-4">
                        <p className="text-[10px] text-stone-500 uppercase tracking-widest mb-2">Key Plays</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                            {highlights.map((h, i) => (
                                <p key={i} className="text-xs text-stone-400">{h}</p>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-4 w-full max-w-md">
                    <button
                        onClick={onRematch}
                        className="flex-1 py-4 bg-amber-700 hover:bg-amber-600 text-white font-bold uppercase tracking-widest rounded-lg shadow-lg border border-amber-500/30 transition-all"
                    >
                        Rematch
                    </button>
                    <button
                        onClick={onMainMenu}
                        className="flex-1 py-4 bg-stone-800 hover:bg-stone-700 text-gray-400 hover:text-white font-bold uppercase tracking-widest rounded-lg border border-white/10 transition-colors"
                    >
                        Main Menu
                    </button>
                </div>
            </div>
        </div>
    );
}
