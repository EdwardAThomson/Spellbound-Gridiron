import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    GameState, TeamSide, Player, Position, TerrainType, Weather,
    BOARD_WIDTH, BOARD_HEIGHT, PlayerRole, TeamData
} from './types';
import { createPlayer, getPlayerAtPosition, isPositionValid, getDistance, isAdjacent, resolveTackle, resolvePass, rollDice, scatterBall, INITIAL_MANA } from './services/gameUtils';
import { TERRAIN_CONFIG, SPELLS } from './constants';
import { generateCommentary, generateTeamName } from './services/gameAiService';
import BoardTile from './components/BoardTile';
import PlayerToken from './components/PlayerToken';
import GameLog from './components/GameLog';
import RuleBookModal from './components/RuleBookModal';
import StartOverlay from './components/StartOverlay';
import SettingsModal from './components/SettingsModal';
import AiAssistantPanel from './components/AiAssistantPanel';
import { ApiKeysProvider, ApiKeysContext } from './context/ApiKeysContext';
import { LLMProvider } from './utils/llmHelper';
import { DEFAULT_MODELS } from './constants/models';

// Icons
const SwordIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 17.5L3 6V3h3l11.5 11.5" /><path d="M13 19l6-6" /><path d="M16 16l4 4" /><path d="M19 21l2-2" /></svg>;
const FootIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /><path d="M10 16V8a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v8" /></svg>;
const TargetIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="22" y1="12" x2="18" y2="12" /><line x1="6" y1="12" x2="2" y2="12" /><line x1="12" y1="6" x2="12" y2="2" /><line x1="12" y1="22" x2="12" y2="18" /></svg>;

const INITIAL_HOME_TEAM: TeamData = {
    name: 'Elven Vanguard',
    race: 'High Elves',
    color: 'blue',
    score: 0,
    players: []
};

const INITIAL_AWAY_TEAM: TeamData = {
    name: 'Orc Bashers',
    race: 'Dark Orcs',
    color: 'red',
    score: 0,
    players: []
};

type InteractionMode = 'DEFAULT' | 'TARGETING';
type TargetAction = 'PASS' | 'SPELL';

export default function App() {
    // --- State Initialization ---
    const [gameState, setGameState] = useState<GameState>({
        turn: 1,
        currentTeam: TeamSide.HOME,
        homeTeam: INITIAL_HOME_TEAM,
        awayTeam: INITIAL_AWAY_TEAM,
        selectedPlayerId: null,
        ballPosition: { x: 6, y: 9 }, // Center
        boardWidth: BOARD_WIDTH,
        boardHeight: BOARD_HEIGHT,
        terrain: TerrainType.GRASS,
        weather: Weather.CLEAR,
        gameLog: [],
        commentary: "Welcome to Spellbound Gridiron! The players are taking the field.",
        isGameOver: false,
        winner: null
    });

    // --- State Initialization ---
    // ... (gameState) ...

    const { apiKeys } = useContext(ApiKeysContext);
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [hasGameStarted, setHasGameStarted] = useState(false);

    // AI Engine State
    const [gameProvider, setGameProvider] = useState<LLMProvider>('gemini');
    const [gameModel, setGameModel] = useState<string>(DEFAULT_MODELS['gemini']);

    // AI Chat/Assistant State
    const [chatProvider, setChatProvider] = useState<LLMProvider>('gemini-cli');
    const [chatModel, setChatModel] = useState<string>(DEFAULT_MODELS['gemini-cli']);

    const [showSettings, setShowSettings] = useState(false);

    // Interaction State
    const [interactionMode, setInteractionMode] = useState<InteractionMode>('DEFAULT');
    const [targetingAction, setTargetingAction] = useState<TargetAction | null>(null);
    const [activeSpellKey, setActiveSpellKey] = useState<string | null>(null);
    const [showRules, setShowRules] = useState(false);
    const [showSpellMenu, setShowSpellMenu] = useState(false);

    // --- Helpers ---
    const setupTeam = (side: TeamSide, startY: number, direction: number) => {
        const players: Player[] = [];
        // Formation: 5v5
        const roles = [PlayerRole.LINEMAN, PlayerRole.BLITZER, PlayerRole.QUARTERBACK, PlayerRole.CATCHER, PlayerRole.WIZARD];
        const xPos = [2, 4, 6, 8, 10]; // Spread out

        roles.forEach((role, index) => {
            players.push(createPlayer(
                `${side}-${index}`,
                `${role} ${index + 1}`,
                role,
                side,
                xPos[index],
                startY + (direction * (role === PlayerRole.LINEMAN ? 2 : 0)) // Stagger formation slightly
            ));
        });
        return players;
    };

    const handleStartGame = async () => {
        setHasGameStarted(true);

        // Instant setup with temporary names -- race and name mixed up
        setGameState(prev => ({
            ...prev,
            homeTeam: {
                ...prev.homeTeam,
                name: 'Elven Vanguard',
                race: 'High Elves',
                players: setupTeam(TeamSide.HOME, 1, 1)
            },
            awayTeam: {
                ...prev.awayTeam,
                name: 'Orc Bashers',
                race: 'Dark Orcs',
                players: setupTeam(TeamSide.AWAY, 16, -1)
            },
            gameLog: ["The mystical gates open! The match begins.", ...prev.gameLog]
        }));

        // Fetch AI names in the background
        (async () => {
            try {
                const homeName = await generateTeamName('High Elves', gameProvider, apiKeys, gameModel);
                const awayName = await generateTeamName('Dark Orcs', gameProvider, apiKeys, gameModel);

                setGameState(prev => ({
                    ...prev,
                    homeTeam: { ...prev.homeTeam, name: homeName },
                    awayTeam: { ...prev.awayTeam, name: awayName },
                    gameLog: [`Teams revealed: ${homeName} vs ${awayName}!`, ...prev.gameLog]
                }));
            } catch (error) {
                console.error("Failed to generate AI names:", error);
            }
        })();
    };

    // --- Setup Teams on Mount ---
    useEffect(() => {
        // Removed automatic game start. Now triggered by handleStartGame.
    }, []);

    // --- Helpers ---
    const getAllPlayers = useCallback(() => {
        return [...gameState.homeTeam.players, ...gameState.awayTeam.players];
    }, [gameState.homeTeam.players, gameState.awayTeam.players]);

    const getSelectedPlayer = useCallback(() => {
        if (!gameState.selectedPlayerId) return null;
        return getAllPlayers().find(p => p.id === gameState.selectedPlayerId);
    }, [gameState.selectedPlayerId, getAllPlayers]);

    const addLog = (msg: string) => {
        setGameState(prev => ({
            ...prev,
            gameLog: [...prev.gameLog, msg]
        }));
        triggerCommentary(msg);
    };

    const triggerCommentary = async (action: string) => {
        setIsAiThinking(true);
        const comment = await generateCommentary(action, gameState, gameProvider, apiKeys, gameModel);
        setGameState(prev => ({ ...prev, commentary: comment }));
        setIsAiThinking(false);
    };

    // --- Interaction Handlers ---

    const startTargeting = (action: TargetAction, spellKey?: string) => {
        setInteractionMode('TARGETING');
        setTargetingAction(action);
        if (spellKey) setActiveSpellKey(spellKey);
        setShowSpellMenu(false);
    };

    const cancelTargeting = () => {
        setInteractionMode('DEFAULT');
        setTargetingAction(null);
        setActiveSpellKey(null);
    };

    const handleTileClick = (x: number, y: number) => {
        if (gameState.isGameOver) return;

        const targetPos = { x, y };
        const selectedPlayer = getSelectedPlayer();

        // --- TARGETING MODE LOGIC ---
        if (interactionMode === 'TARGETING' && selectedPlayer) {
            if (targetingAction === 'PASS') {
                handlePass(selectedPlayer, targetPos);
            } else if (targetingAction === 'SPELL' && activeSpellKey) {
                handleCastSpell(selectedPlayer, activeSpellKey, targetPos);
            }
            // Reset after action attempt
            cancelTargeting();
            return;
        }

        // --- DEFAULT MODE LOGIC ---

        const clickedPlayer = getPlayerAtPosition(targetPos, getAllPlayers());

        // 1. Select own player
        if (clickedPlayer && clickedPlayer.team === gameState.currentTeam) {
            if (clickedPlayer.isStunned) {
                addLog(`${clickedPlayer.name} is stunned and cannot act.`);
                return;
            }
            if (clickedPlayer.actionTaken && !selectedPlayer) {
                addLog(`${clickedPlayer.name} has already acted this turn.`);
                return;
            }
            setGameState(prev => ({ ...prev, selectedPlayerId: clickedPlayer.id }));
            cancelTargeting(); // Ensure we reset any previous modes
            return;
        }

        // 2. Actions with Selected Player
        if (selectedPlayer) {
            if (selectedPlayer.actionTaken) return;

            const isAdj = isAdjacent(selectedPlayer.position, targetPos);

            // TACKLE (Move into enemy)
            if (clickedPlayer && clickedPlayer.team !== gameState.currentTeam && isAdj) {
                if (selectedPlayer.movesRemaining > 0) {
                    handleTackle(selectedPlayer, clickedPlayer);
                } else {
                    addLog("Not enough movement to tackle!");
                }
                return;
            }

            // MOVE (Empty tile)
            if (!clickedPlayer && isPositionValid(targetPos)) {
                if (isAdj && selectedPlayer.movesRemaining > 0) {
                    handleMove(selectedPlayer, targetPos);
                } else if (!isAdj) {
                    addLog("Move one square at a time.");
                }
                return;
            }
        }
    };

    // --- Game Logic Actions ---

    const handleMove = (player: Player, to: Position) => {
        // Update position
        const updatedPlayer = {
            ...player,
            position: to,
            movesRemaining: player.movesRemaining - 1
        };

        // Check for Ball Pickup
        let newBallPos = gameState.ballPosition;

        if (gameState.ballPosition && to.x === gameState.ballPosition.x && to.y === gameState.ballPosition.y) {
            updatedPlayer.hasBall = true;
            newBallPos = null;
            addLog(`${player.name} picked up the ball!`);
        }

        // Check for Touchdown
        let scoreHome = gameState.homeTeam.score;
        let scoreAway = gameState.awayTeam.score;
        let touchdown = false;

        if (updatedPlayer.hasBall) {
            if (player.team === TeamSide.HOME && to.y >= BOARD_HEIGHT - 1) {
                scoreHome += 7; // TD value
                touchdown = true;
                addLog(`TOUCHDOWN! ${player.name} scores for ${gameState.homeTeam.name}!`);
            } else if (player.team === TeamSide.AWAY && to.y <= 0) {
                scoreAway += 7;
                touchdown = true;
                addLog(`TOUCHDOWN! ${player.name} scores for ${gameState.awayTeam.name}!`);
            }
        }

        updatePlayerState(updatedPlayer, { ballPosition: newBallPos, homeScore: scoreHome, awayScore: scoreAway });

        if (touchdown) {
            handleTouchdown();
        }
    };

    const handleTackle = (attacker: Player, defender: Player) => {
        const result = resolveTackle(attacker, defender);
        addLog(result.log);

        let updatedAttacker = { ...attacker, actionTaken: true, movesRemaining: 0 };
        let updatedDefender = { ...defender };
        let newBallPos = gameState.ballPosition;

        if (result.success) {
            updatedDefender.isStunned = true;
            updatedDefender.movesRemaining = 0;

            if (updatedDefender.hasBall) {
                updatedDefender.hasBall = false;
                newBallPos = scatterBall(defender.position);
                addLog("The ball pops loose!");
            }
        }

        updatePlayerState([updatedAttacker, updatedDefender], { ballPosition: newBallPos });
    };

    const handlePass = (thrower: Player, targetPos: Position) => {
        const result = resolvePass(thrower, targetPos);
        addLog(result.log);

        let newBallPos: Position | null = null;
        let updatedThrower = { ...thrower, hasBall: false, actionTaken: true, movesRemaining: 0 };

        const receiver = getPlayerAtPosition(targetPos, getAllPlayers());
        let updatedReceiver = receiver ? { ...receiver } : null;

        if (result.success) {
            if (updatedReceiver) {
                updatedReceiver.hasBall = true;
                addLog(`${updatedReceiver.name} catches it!`);
            } else {
                newBallPos = targetPos; // Lands on ground
                addLog(`The ball lands at ${targetPos.x}, ${targetPos.y}.`);
            }
        } else {
            newBallPos = scatterBall(targetPos);
            addLog(`Inaccurate pass! Ball lands at ${newBallPos.x}, ${newBallPos.y}.`);
        }

        const updates = [updatedThrower];
        if (updatedReceiver) updates.push(updatedReceiver);

        updatePlayerState(updates, { ballPosition: newBallPos });
    };

    const handleCastSpell = (player: Player, spellKey: string, targetPos: Position) => {
        const spell = SPELLS[spellKey as keyof typeof SPELLS];

        if (player.mana >= spell.cost) {
            addLog(`${player.name} casts ${spell.name} at ${targetPos.x},${targetPos.y}!`);
            // Simplistic spell effect logic for now
            const targetPlayer = getPlayerAtPosition(targetPos, getAllPlayers());

            let updatedTarget = targetPlayer ? { ...targetPlayer } : null;

            if (spellKey === 'FIREBALL' && updatedTarget) {
                updatedTarget.isStunned = true;
                addLog(`${updatedTarget.name} was knocked down by the fireball!`);
            } else if (spellKey === 'HEAL' && updatedTarget) {
                updatedTarget.isStunned = false;
                addLog(`${updatedTarget.name} is back in the fight!`);
            } else if (spellKey === 'TELEPORT') {
                player.position = targetPos; // Instant move
                addLog(`${player.name} blinks across reality!`);
            }

            const updates = [{ ...player, mana: player.mana - spell.cost, actionTaken: true }];
            if (updatedTarget) updates.push(updatedTarget);
            updatePlayerState(updates);

        } else {
            addLog("Not enough mana!");
        }
    };

    const handleTouchdown = () => {
        setTimeout(() => {
            setGameState(prev => {
                const home = prev.homeTeam.players.map(p => ({ ...p, hasBall: false, position: { x: p.position.x, y: 1 + Math.floor(Math.random() * 3) } }));
                const away = prev.awayTeam.players.map(p => ({ ...p, hasBall: false, position: { x: p.position.x, y: 16 - Math.floor(Math.random() * 3) } }));

                return {
                    ...prev,
                    ballPosition: { x: 6, y: 9 },
                    homeTeam: { ...prev.homeTeam, players: home },
                    awayTeam: { ...prev.awayTeam, players: away },
                    gameLog: [...prev.gameLog, "Teams resetting for kickoff..."]
                };
            });
        }, 2000);
    };

    const updatePlayerState = (
        playerOrPlayers: Player | Player[],
        globalUpdates: Partial<GameState> & { homeScore?: number; awayScore?: number } = {}
    ) => {
        const playersToUpdate = Array.isArray(playerOrPlayers) ? playerOrPlayers : [playerOrPlayers];

        setGameState(prev => {
            const { homeScore, awayScore, ...gameStateUpdates } = globalUpdates;

            const updateList = (currentList: Player[]) => {
                return currentList.map(p => {
                    const found = playersToUpdate.find(u => u.id === p.id);
                    return found ? found : p;
                });
            };

            return {
                ...prev,
                ...gameStateUpdates,
                homeTeam: {
                    ...prev.homeTeam,
                    score: homeScore !== undefined ? homeScore : prev.homeTeam.score,
                    players: updateList(prev.homeTeam.players)
                },
                awayTeam: {
                    ...prev.awayTeam,
                    score: awayScore !== undefined ? awayScore : prev.awayTeam.score,
                    players: updateList(prev.awayTeam.players)
                },
            };
        });
    };

    const endTurn = () => {
        setGameState(prev => {
            const nextTeam = prev.currentTeam === TeamSide.HOME ? TeamSide.AWAY : TeamSide.HOME;

            const refreshTeam = (team: TeamData) => ({
                ...team,
                players: team.players.map(p => ({
                    ...p,
                    movesRemaining: p.stats.move,
                    actionTaken: false,
                    isStunned: false
                }))
            });

            const newTurnNumber = nextTeam === TeamSide.HOME ? prev.turn + 1 : prev.turn;

            return {
                ...prev,
                turn: newTurnNumber,
                currentTeam: nextTeam,
                selectedPlayerId: null,
                homeTeam: nextTeam === TeamSide.HOME ? refreshTeam(prev.homeTeam) : prev.homeTeam,
                awayTeam: nextTeam === TeamSide.AWAY ? refreshTeam(prev.awayTeam) : prev.awayTeam,
            };
        });
        addLog(`Turn Ending. It is now the ${gameState.currentTeam === TeamSide.HOME ? 'AWAY' : 'HOME'} team's turn.`);
        cancelTargeting();
    };

    // --- Rendering ---

    const renderBoard = () => {
        const tiles = [];
        for (let y = 0; y < BOARD_HEIGHT; y++) {
            for (let x = 0; x < BOARD_WIDTH; x++) {
                const pos = { x, y };
                const player = getPlayerAtPosition(pos, getAllPlayers());
                const isBall = gameState.ballPosition?.x === x && gameState.ballPosition?.y === y;
                const selected = getSelectedPlayer();

                // Valid move calculation for highlight
                let isValidMove = false;
                if (selected && !selected.actionTaken && selected.movesRemaining > 0 && interactionMode === 'DEFAULT') {
                    if (isAdjacent(selected.position, pos) && !player) {
                        isValidMove = true;
                    }
                }

                // Zone Check
                let endZone = null;
                if (y === 0) endZone = TeamSide.AWAY;
                if (y === BOARD_HEIGHT - 1) endZone = TeamSide.HOME;

                tiles.push(
                    <BoardTile
                        key={`${x}-${y}`}
                        x={x}
                        y={y}
                        terrain={gameState.terrain}
                        isValidMove={isValidMove}
                        isSelected={selected?.position.x === x && selected?.position.y === y}
                        isTargetingMode={interactionMode === 'TARGETING'}
                        targetingType={targetingAction}
                        isBall={isBall}
                        isEndZone={endZone}
                        onClick={() => handleTileClick(x, y)}
                    >
                        {player && <PlayerToken player={player} onClick={(e) => { e.stopPropagation(); handleTileClick(x, y); }} />}
                    </BoardTile>
                );
            }
        }
        return tiles;
    };

    const selectedPlayer = getSelectedPlayer();
    const terrainInfo = TERRAIN_CONFIG[gameState.terrain];

    return (
        <ApiKeysProvider>
            <div className="min-h-screen bg-stone-900 text-gray-100 flex flex-col md:flex-row overflow-hidden">

                {/* LEFT PANEL: HUD & CONTROLS */}
                <div className="w-full md:w-80 p-4 flex flex-col border-r border-white/10 bg-stone-950 z-10 shadow-2xl">
                    {/* Main Title & Engine Info */}
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

                    {/* Full Width Settings Button */}
                    <button
                        onClick={() => setShowSettings(true)}
                        className="mb-6 w-full py-3 bg-stone-900 hover:bg-stone-800 border border-white/10 hover:border-purple-500/50 rounded flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"
                    >
                        <span>⚙️</span> Configure AI Models
                    </button>
                    {/* Scoreboard */}
                    <div className="bg-black/50 p-4 rounded-xl border border-white/10 mb-4">
                        <div className="flex justify-between items-center text-sm text-gray-400 mb-2">
                            <span>TURN {gameState.turn}</span>
                            <span className="uppercase tracking-wider">{gameState.weather}</span>
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
                                            <div className="h-full bg-green-500 transition-all" style={{ width: `${(selectedPlayer.movesRemaining / selectedPlayer.stats.move) * 100}%` }}></div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="bg-black/30 p-2 rounded border border-white/5 flex items-center gap-2">
                                            <span className="text-red-400 font-bold">STR</span> {selectedPlayer.stats.strength}
                                        </div>
                                        <div className="bg-black/30 p-2 rounded border border-white/5 flex items-center gap-2">
                                            <span className="text-blue-400 font-bold">SKL</span> {selectedPlayer.stats.skill}
                                        </div>
                                    </div>

                                    {/* --- ACTION BUTTONS --- */}
                                    <div className="mt-4 space-y-2">
                                        {/* PASS BUTTON */}
                                        {selectedPlayer.hasBall && !selectedPlayer.actionTaken && (
                                            <button
                                                onClick={() => interactionMode === 'DEFAULT' ? startTargeting('PASS') : cancelTargeting()}
                                                className={`w-full py-3 rounded font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${interactionMode === 'TARGETING' && targetingAction === 'PASS'
                                                    ? 'bg-yellow-600 text-white animate-pulse'
                                                    : 'bg-yellow-500/20 text-yellow-200 hover:bg-yellow-500/30 border border-yellow-500/50'
                                                    }`}
                                            >
                                                <TargetIcon /> {interactionMode === 'TARGETING' ? 'Select Target Tile' : 'Throw Pass'}
                                            </button>
                                        )}

                                        {/* MAGIC MENU */}
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
                                                                onClick={() => startTargeting('SPELL', key)}
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

                                        {/* CANCEL TARGETING */}
                                        {interactionMode === 'TARGETING' && (
                                            <button
                                                onClick={cancelTargeting}
                                                className="w-full py-2 bg-red-900/50 hover:bg-red-800/50 text-red-200 text-xs rounded border border-red-500/30"
                                            >
                                                Cancel Action
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => updatePlayerState({ ...selectedPlayer, actionTaken: true })}
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
                        onClick={endTurn}
                        className="mt-4 w-full py-4 bg-amber-700 hover:bg-amber-600 text-white font-bold uppercase tracking-widest rounded shadow-lg border border-amber-500/20 transition-colors"
                    >
                        End Turn
                    </button>

                    <button
                        onClick={() => setShowRules(true)}
                        className="mt-2 text-xs text-stone-500 hover:text-stone-300 underline"
                    >
                        📖 Game Rules
                    </button>
                </div>

                {/* CENTER: BOARD */}
                <div className="flex-1 relative overflow-auto flex items-center justify-center bg-stone-900 p-4 md:p-8">

                    {/* Field Background Wrapper */}
                    <div className={`relative rounded-lg shadow-2xl overflow-hidden border-4 border-stone-800 bg-gradient-to-br ${terrainInfo.color}`}>

                        {/* START OVERLAY */}
                        {!hasGameStarted && <StartOverlay onStart={handleStartGame} isThinking={isAiThinking} />}

                        {/* Targeting Overlay Info */}
                        {interactionMode === 'TARGETING' && (
                            <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none z-30">
                                <div className="bg-black/80 text-white px-4 py-2 rounded-full border border-yellow-500/50 text-sm font-bold shadow-lg animate-bounce">
                                    {targetingAction === 'PASS' ? 'Select Target Tile for Pass' : 'Select Target for Spell'}
                                </div>
                            </div>
                        )}

                        {/* Grid Container */}
                        <div
                            className="grid gap-[1px] bg-white/5 p-1"
                            style={{
                                gridTemplateColumns: `repeat(${BOARD_WIDTH}, minmax(24px, 40px))`,
                                gridTemplateRows: `repeat(${BOARD_HEIGHT}, minmax(24px, 40px))`
                            }}
                        >
                            {renderBoard()}
                        </div>

                        {/* Field Overlay Effects */}
                        <div className="absolute inset-0 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
                    </div>
                </div>

                {/* RIGHT PANEL: LOGS & CHAT */}
                <div className="w-full md:w-72 h-64 md:h-auto border-l border-white/10 bg-stone-950 z-10 flex flex-col">
                    <GameLog logs={gameState.gameLog} commentary={gameState.commentary} isThinking={isAiThinking} />
                </div>

                {/* CLI RUNNER PANEL */}
                <AiAssistantPanel gameState={gameState} backend={chatProvider} model={chatModel} />
                <RuleBookModal isOpen={showRules} onClose={() => setShowRules(false)} />

                <SettingsModal
                    isOpen={showSettings}
                    onClose={() => setShowSettings(false)}
                    gameProvider={gameProvider}
                    setGameProvider={setGameProvider}
                    gameModel={gameModel}
                    setGameModel={setGameModel}
                    chatProvider={chatProvider}
                    setChatProvider={setChatProvider}
                    chatModel={chatModel}
                    setChatModel={setChatModel}
                />
            </div>
        </ApiKeysProvider>
    );
}