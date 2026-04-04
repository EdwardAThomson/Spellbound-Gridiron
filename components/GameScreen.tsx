import React, { useState } from 'react';
import {
    GameState, Player, TeamSide, PlayerRole, SpellKey,
    BOARD_WIDTH, BOARD_HEIGHT
} from '../types';
import { getPlayerAtPosition, isAdjacent } from '../services/gameUtils';
import { TERRAIN_CONFIG, SPELLS } from '../constants';
import BoardTile from './BoardTile';
import PlayerToken from './PlayerToken';
import GameLog from './GameLog';
import AiAssistantPanel from './AiAssistantPanel';
import { LLMProvider } from '../utils/llmHelper';

// Icons
const TargetIcon = () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="22" y1="12" x2="18" y2="12" />
        <line x1="6" y1="12" x2="2" y2="12" />
        <line x1="12" y1="6" x2="12" y2="2" />
        <line x1="12" y1="22" x2="12" y2="18" />
    </svg>
);

interface GameScreenProps {
    gameState: GameState;
    isAiThinking: boolean;
    interactionMode: 'DEFAULT' | 'TARGETING';
    targetingAction: 'PASS' | 'SPELL' | null;
    selectedPlayer: Player | null;
    allPlayers: Player[];
    gameModel: string;
    chatProvider: LLMProvider;
    chatModel: string;

    onTileClick: (x: number, y: number) => void;
    onStartTargeting: (action: 'PASS' | 'SPELL', spellKey?: SpellKey) => void;
    onCancelTargeting: () => void;
    onEndPlayerAction: () => void;
    onEndTurn: () => void;
    onShowSettings: () => void;
    onShowRules: () => void;
    onQuit: () => void;
    onSummonWolf: () => void;
}

export default function GameScreen({
    gameState,
    isAiThinking,
    interactionMode,
    targetingAction,
    selectedPlayer,
    allPlayers,
    gameModel,
    chatProvider,
    chatModel,
    onTileClick,
    onStartTargeting,
    onCancelTargeting,
    onEndPlayerAction,
    onEndTurn,
    onShowSettings,
    onShowRules,
    onQuit,
    onSummonWolf,
}: GameScreenProps) {
    const [showSpellMenu, setShowSpellMenu] = useState(false);
    const terrainInfo = TERRAIN_CONFIG[gameState.terrain];

    const handleStartSpell = (spellKey: SpellKey) => {
        onStartTargeting('SPELL', spellKey);
        setShowSpellMenu(false);
    };

    const renderBoard = () => {
        const tiles = [];
        for (let y = 0; y < BOARD_HEIGHT; y++) {
            for (let x = 0; x < BOARD_WIDTH; x++) {
                const pos = { x, y };
                const player = getPlayerAtPosition(pos, allPlayers);
                const isBall = gameState.ballPosition?.x === x && gameState.ballPosition?.y === y;

                let isValidMove = false;
                if (selectedPlayer && !selectedPlayer.actionTaken && selectedPlayer.movesRemaining > 0 && interactionMode === 'DEFAULT') {
                    if (isAdjacent(selectedPlayer.position, pos) && !player) {
                        isValidMove = true;
                    }
                }

                // Endzones flip at halftime
                const homeScoresAtBottom = gameState.half === 1;
                let endZone = null;
                if (y === 0) endZone = homeScoresAtBottom ? TeamSide.AWAY : TeamSide.HOME;
                if (y === BOARD_HEIGHT - 1) endZone = homeScoresAtBottom ? TeamSide.HOME : TeamSide.AWAY;

                tiles.push(
                    <BoardTile
                        key={`${x}-${y}`}
                        x={x}
                        y={y}
                        terrain={gameState.terrain}
                        isValidMove={isValidMove}
                        isSelected={selectedPlayer?.position.x === x && selectedPlayer?.position.y === y}
                        isTargetingMode={interactionMode === 'TARGETING'}
                        targetingType={targetingAction}
                        isBall={isBall}
                        isEndZone={endZone}
                        onClick={() => onTileClick(x, y)}
                    >
                        {player && (
                            <PlayerToken
                                player={player}
                                onClick={(e) => { e.stopPropagation(); onTileClick(x, y); }}
                            />
                        )}
                    </BoardTile>
                );
            }
        }
        return tiles;
    };

    return (
        <div className="min-h-screen bg-stone-900 text-gray-100 flex flex-col md:flex-row overflow-hidden">
            {/* LEFT PANEL: HUD & CONTROLS */}
            <div className="w-full md:w-80 p-4 flex flex-col border-r border-white/10 bg-stone-950 z-10 shadow-2xl">
                {/* Title & Engine Info */}
                <div className="mb-6 text-center">
                    <h1 className="text-3xl font-fantasy text-amber-200 uppercase tracking-tighter drop-shadow-md">
                        Spellbound Gridiron
                    </h1>
                    <div className="flex items-center justify-center gap-2 mt-2">
                        <span className="text-[10px] text-stone-500 uppercase tracking-widest font-mono">Game Engine:</span>
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-mono">
                            {gameModel}
                        </span>
                    </div>
                </div>

                {/* Settings Button */}
                <button
                    onClick={onShowSettings}
                    className="mb-6 w-full py-3 bg-stone-900 hover:bg-stone-800 border border-white/10 hover:border-purple-500/50 rounded flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"
                >
                    <span>⚙️</span> Configure AI Models
                </button>

                {/* Terrain & Weather Bar */}
                <div className="mb-3 flex gap-2">
                    <div className={`flex-1 text-center py-1.5 rounded text-[10px] font-bold uppercase tracking-widest border bg-gradient-to-r ${terrainInfo.color} border-white/10`}>
                        {terrainInfo.name}
                    </div>
                    <div className="flex-1 text-center py-1.5 rounded text-[10px] font-bold uppercase tracking-widest border border-white/10 bg-stone-800">
                        {gameState.weather}
                    </div>
                </div>

                {/* Scoreboard */}
                <div className="bg-black/50 p-4 rounded-xl border border-white/10 mb-4">
                    <div className="flex justify-between items-center text-sm text-gray-400 mb-2">
                        <span>TURN {gameState.turn}/{gameState.turnsPerHalf}</span>
                        <span className="text-xs text-amber-400/60">Half {gameState.half}/2</span>
                    </div>
                    <div className="flex justify-between items-center text-2xl font-bold font-fantasy">
                        <div className="text-blue-400 flex flex-col items-center">
                            <span className="text-xs font-sans text-blue-400/50 mb-1">{gameState.homeTeam.race}</span>
                            {gameState.homeTeam.score}
                        </div>
                        <div className="text-xs text-gray-600">VS</div>
                        <div className="text-red-400 flex flex-col items-center">
                            <span className="text-xs font-sans text-red-400/50">{gameState.awayTeam.race}</span>
                            {gameState.awayTeam.score}
                        </div>
                    </div>
                    <div className={`mt-2 text-center text-xs font-bold py-1 rounded ${gameState.currentTeam === TeamSide.HOME ? 'bg-blue-900/50 text-blue-200' : 'bg-red-900/50 text-red-200'}`}>
                        Current: {gameState.currentTeam}
                    </div>
                </div>

                {/* Selected Unit Card */}
                <div className="flex-1 bg-stone-900/50 rounded-xl border border-white/5 p-4 relative overflow-hidden flex flex-col">
                    {selectedPlayer ? (
                        <>
                            <div className="absolute top-0 right-0 p-2 opacity-10 text-6xl">
                                {selectedPlayer.role === PlayerRole.WIZARD ? '🧙' : '🛡️'}
                            </div>
                            <h2 className="text-lg font-bold text-amber-100">{selectedPlayer.name}</h2>
                            <p className="text-xs text-amber-500 mb-4">{selectedPlayer.role} - {selectedPlayer.team}</p>

                            <div className="space-y-3 text-sm flex-1">
                                <div>
                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                        <span>Movement</span>
                                        <span>{selectedPlayer.movesRemaining} / {selectedPlayer.stats.move}</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 transition-all" style={{ width: `${(selectedPlayer.movesRemaining / selectedPlayer.stats.move) * 100}%` }} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-black/30 p-2 rounded border border-white/5 flex items-center gap-2">
                                        <span className="text-red-400 font-bold">STR</span> {selectedPlayer.stats.strength}{selectedPlayer.fury > 0 && <span className="text-orange-400">+{selectedPlayer.fury}</span>}
                                    </div>
                                    <div className="bg-black/30 p-2 rounded border border-white/5 flex items-center gap-2">
                                        <span className="text-blue-400 font-bold">SKL</span> {selectedPlayer.stats.skill}
                                    </div>
                                </div>

                                {/* Role-specific indicators */}
                                {selectedPlayer.role === PlayerRole.BERSERKER && (
                                    <div className="bg-orange-900/30 border border-orange-500/20 rounded p-2 text-xs">
                                        <span className="text-orange-400 font-bold">FURY</span>
                                        <div className="flex gap-1 mt-1">
                                            {[0, 1, 2].map(i => (
                                                <div key={i} className={`h-2 flex-1 rounded ${i < selectedPlayer.fury ? 'bg-orange-500' : 'bg-orange-900/50'}`} />
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-orange-400/60 mt-1">Gains strength from combat</p>
                                    </div>
                                )}
                                {selectedPlayer.role === PlayerRole.ASSASSIN && (
                                    <div className="bg-violet-900/30 border border-violet-500/20 rounded p-2 text-xs text-violet-300">
                                        <span className="font-bold">SHADOW</span>
                                        <p className="text-[10px] text-violet-400/60 mt-1">Can move through units. Backstab: +2 STR from behind.</p>
                                    </div>
                                )}
                                {selectedPlayer.role === PlayerRole.BEASTMASTER && (
                                    <div className="bg-emerald-900/30 border border-emerald-500/20 rounded p-2 text-xs text-emerald-300">
                                        <span className="font-bold">BEAST BOND</span>
                                        <p className="text-[10px] text-emerald-400/60 mt-1">
                                            {selectedPlayer.hasSummoned ? 'Wolf already summoned.' : 'Can summon a wolf companion (1x per game).'}
                                        </p>
                                    </div>
                                )}
                                {selectedPlayer.isSummon && (
                                    <div className="bg-emerald-900/30 border border-emerald-500/20 rounded p-2 text-xs text-emerald-300">
                                        <span className="font-bold">SUMMONED UNIT</span>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="mt-4 space-y-2">
                                    {selectedPlayer.hasBall && !selectedPlayer.actionTaken && (
                                        <button
                                            onClick={() => interactionMode === 'DEFAULT' ? onStartTargeting('PASS') : onCancelTargeting()}
                                            className={`w-full py-3 rounded font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${interactionMode === 'TARGETING' && targetingAction === 'PASS'
                                                ? 'bg-yellow-600 text-white animate-pulse'
                                                : 'bg-yellow-500/20 text-yellow-200 hover:bg-yellow-500/30 border border-yellow-500/50'
                                                }`}
                                        >
                                            <TargetIcon /> {interactionMode === 'TARGETING' ? 'Select Target Tile' : 'Throw Pass'}
                                        </button>
                                    )}

                                    {selectedPlayer.role === PlayerRole.WIZARD && !selectedPlayer.actionTaken && (
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowSpellMenu(!showSpellMenu)}
                                                className="w-full py-2 bg-purple-900/50 hover:bg-purple-800/50 border border-purple-500/30 rounded text-purple-200 text-xs transition-colors flex items-center justify-center gap-2"
                                            >
                                                <span>✨</span> Cast Spell
                                            </button>

                                            {showSpellMenu && (
                                                <div className="mt-2 space-y-1 bg-stone-950 p-2 rounded border border-white/10 absolute w-full z-50 shadow-xl">
                                                    {Object.entries(SPELLS).map(([key, spell]) => (
                                                        <button
                                                            key={key}
                                                            disabled={selectedPlayer.mana < spell.cost}
                                                            onClick={() => handleStartSpell(key as SpellKey)}
                                                            className="w-full text-left px-3 py-2 text-xs bg-black/40 hover:bg-purple-900/20 disabled:opacity-30 rounded flex justify-between items-center"
                                                        >
                                                            <span>{spell.name}</span>
                                                            <span className="text-cyan-300">{spell.cost} MP</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Beastmaster Summon */}
                                    {selectedPlayer.role === PlayerRole.BEASTMASTER && !selectedPlayer.hasSummoned && !selectedPlayer.actionTaken && (
                                        <button
                                            onClick={onSummonWolf}
                                            className="w-full py-2 bg-emerald-900/50 hover:bg-emerald-800/50 border border-emerald-500/30 rounded text-emerald-200 text-xs transition-colors flex items-center justify-center gap-2"
                                        >
                                            <span>🐺</span> Summon Wolf
                                        </button>
                                    )}

                                    {interactionMode === 'TARGETING' && (
                                        <button
                                            onClick={onCancelTargeting}
                                            className="w-full py-2 bg-red-900/50 hover:bg-red-800/50 text-red-200 text-xs rounded border border-red-500/30"
                                        >
                                            Cancel Action
                                        </button>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={onEndPlayerAction}
                                className="mt-4 w-full py-3 bg-gray-800 hover:bg-gray-700 rounded text-xs font-bold uppercase tracking-widest"
                            >
                                End Action
                            </button>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-600 text-center text-sm">
                            <p>Select a unit to view stats</p>
                        </div>
                    )}
                </div>

                <button
                    onClick={onEndTurn}
                    className="mt-4 w-full py-4 bg-amber-700 hover:bg-amber-600 text-white font-bold uppercase tracking-widest rounded shadow-lg border border-amber-500/20 transition-colors"
                >
                    End Turn
                </button>

                <div className="mt-2 flex justify-between">
                    <button
                        onClick={onShowRules}
                        className="text-xs text-stone-500 hover:text-stone-300 underline"
                    >
                        Game Rules
                    </button>
                    <button
                        onClick={onQuit}
                        className="text-xs text-stone-500 hover:text-red-400 underline"
                    >
                        Quit to Menu
                    </button>
                </div>
            </div>

            {/* CENTER: BOARD */}
            <div className="flex-1 relative overflow-auto flex items-center justify-center bg-stone-900 p-4 md:p-8">
                <div className={`relative rounded-lg shadow-2xl overflow-hidden border-4 border-stone-800 bg-gradient-to-br ${terrainInfo.color}`}>
                    {interactionMode === 'TARGETING' && (
                        <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none z-30">
                            <div className="bg-black/80 text-white px-4 py-2 rounded-full border border-yellow-500/50 text-sm font-bold shadow-lg animate-bounce">
                                {targetingAction === 'PASS' ? 'Select Target Tile for Pass' : 'Select Target for Spell'}
                            </div>
                        </div>
                    )}

                    <div
                        className="grid gap-[1px] bg-white/5 p-1"
                        style={{
                            gridTemplateColumns: `repeat(${BOARD_WIDTH}, minmax(24px, 40px))`,
                            gridTemplateRows: `repeat(${BOARD_HEIGHT}, minmax(24px, 40px))`,
                        }}
                    >
                        {renderBoard()}
                    </div>

                    <div className="absolute inset-0 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay" />
                </div>
            </div>

            {/* RIGHT PANEL: LOGS & CHAT */}
            <div className="w-full md:w-72 h-64 md:h-auto border-l border-white/10 bg-stone-950 z-10 flex flex-col">
                <GameLog logs={gameState.gameLog} commentary={gameState.commentary} isThinking={isAiThinking} />
            </div>

            {/* AI Assistant */}
            <AiAssistantPanel gameState={gameState} backend={chatProvider} model={chatModel} />
        </div>
    );
}
