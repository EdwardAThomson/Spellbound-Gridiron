import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import {
    GameState, TeamSide, Player, Position, TerrainType, Weather,
    BOARD_WIDTH, BOARD_HEIGHT, PlayerRole, TeamData
} from './types';
import { createPlayer, getPlayerAtPosition, isPositionValid, getDistance, isAdjacent, resolveTackle, resolvePass, rollDice, scatterBall, checkWinner, validateSpellCast, resolveTerrainStep, generateLavaHazards, advanceMeteor, isHazard, effectiveMove, kickoffPosition, findPath, reachableTiles, awardXp, XP_AWARDS, INITIAL_MANA, extractRoster, applyRoster, Roster } from './services/gameUtils';
import { TERRAIN_CONFIG, SPELLS } from './constants';
import { generateCommentary, generateTeamName } from './services/gameAiService';
import BoardTile from './components/BoardTile';
import PlayerToken from './components/PlayerToken';
import GameLog from './components/GameLog';
import RuleBookModal from './components/RuleBookModal';
import StartOverlay from './components/StartOverlay';
import SettingsModal from './components/SettingsModal';
import AiAssistantPanel from './components/AiAssistantPanel';
import { ApiKeysContext } from './context/ApiKeysContext';
import { LLMProvider } from './utils/llmHelper';
import { DEFAULT_MODELS } from './constants/models';
import { saveGame, loadGame } from './services/saveGame';
import { saveRosters, loadRosters } from './services/roster';

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
        hazards: [],
        meteor: null,
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
    // Build a team's 5v5 formation. An optional `roster` overlays carried
    // progression (XP, level, bumped stats) onto the fresh players before their
    // opening Move is computed, so a rematch fields last match's veterans with
    // their earned stats intact.
    const setupTeam = (side: TeamSide, weather: Weather = Weather.CLEAR, roster?: Roster) => {
        // Formation: 5v5, slots from the shared deterministic kickoff layout.
        const roles = [PlayerRole.LINEMAN, PlayerRole.BLITZER, PlayerRole.QUARTERBACK, PlayerRole.CATCHER, PlayerRole.WIZARD];

        let players: Player[] = roles.map((role, index) => {
            const slot = kickoffPosition(side, index, role);
            return createPlayer(
                `${side}-${index}`,
                `${role} ${index + 1}`,
                role,
                side,
                slot.x,
                slot.y
            );
        });

        if (roster) players = applyRoster(roster, players);

        // Apply the weather's Move penalty to the opening turn (Blizzard -1),
        // off each player's (possibly roster-bumped) base Move.
        return players.map(player => ({
            ...player,
            movesRemaining: effectiveMove(player.stats.move, weather),
        }));
    };

    // Terrain and weather are chosen on the start screen before the match begins.
    const handleSelectTerrain = (terrain: TerrainType) => {
        setGameState(prev => ({ ...prev, terrain }));
    };

    const handleSelectWeather = (weather: Weather) => {
        setGameState(prev => ({ ...prev, weather }));
    };

    // Seed the environmental hazards a fresh match starts with: lava hazard
    // tiles for a Lava pitch, and the first telegraphed meteor for a Meteor
    // Shower (visible during turn 1, striking when turn 1 ends).
    const seedHazards = (terrain: TerrainType) =>
        terrain === TerrainType.LAVA ? generateLavaHazards() : [];
    const seedMeteor = (weather: Weather) =>
        weather === Weather.METEOR_SHOWER ? advanceMeteor(null, 1).next : null;

    const handleStartGame = async () => {
        setHasGameStarted(true);

        // Instant setup with temporary names -- race and name mixed up
        setGameState(prev => ({
            ...prev,
            hazards: seedHazards(prev.terrain),
            meteor: seedMeteor(prev.weather),
            homeTeam: {
                ...prev.homeTeam,
                name: 'Elven Vanguard',
                race: 'High Elves',
                players: setupTeam(TeamSide.HOME, prev.weather)
            },
            awayTeam: {
                ...prev.awayTeam,
                name: 'Orc Bashers',
                race: 'Dark Orcs',
                players: setupTeam(TeamSide.AWAY, prev.weather)
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

    // Commentary is batched to one LLM request per action. A single action
    // (tackle, pass, spell) emits several log lines; firing a request per line
    // both races the `commentary`/`isAiThinking` slots and sends the LLM stale
    // pre-action state. Instead `addLog` only appends, and the log lines from an
    // action are collected and flushed once, on the next tick, from the fresh
    // post-action state (read via `gameStateRef`, updated after each commit).
    const gameStateRef = useRef(gameState);
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

    // When a match ends, persist both teams' rosters (their carried XP, levels
    // and stat bumps) to the named roster slots, so the post-game Rematch button
    // can field the same veterans next match.
    useEffect(() => {
        if (gameState.isGameOver) {
            saveRosters({
                home: extractRoster(gameStateRef.current.homeTeam),
                away: extractRoster(gameStateRef.current.awayTeam),
            });
        }
    }, [gameState.isGameOver]);

    const pendingLogsRef = useRef<string[]>([]);
    const commentaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // The post-touchdown kickoff reset is delayed for dramatic effect; it must
    // be cancelled whenever a new match starts (rematch / new game / load), or
    // the stale timer fires into the fresh match and scatters its formation.
    const kickoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cancelPendingKickoff = () => {
        if (kickoffTimerRef.current) {
            clearTimeout(kickoffTimerRef.current);
            kickoffTimerRef.current = null;
        }
    };

    const addLog = (msg: string) => {
        setGameState(prev => ({
            ...prev,
            gameLog: [...prev.gameLog, msg]
        }));
        queueCommentary(msg);
    };

    const queueCommentary = (msg: string) => {
        pendingLogsRef.current.push(msg);
        if (commentaryTimerRef.current) clearTimeout(commentaryTimerRef.current);
        // Small delay so all of an action's synchronous addLog calls collect
        // together and React has committed the resulting state before we read it.
        commentaryTimerRef.current = setTimeout(flushCommentary, 50);
    };

    const flushCommentary = async () => {
        const lines = pendingLogsRef.current;
        pendingLogsRef.current = [];
        commentaryTimerRef.current = null;
        if (lines.length === 0) return;

        const action = lines.join(' ');
        setIsAiThinking(true);
        try {
            const comment = await generateCommentary(action, gameStateRef.current, gameProvider, apiKeys, gameModel);
            setGameState(prev => ({ ...prev, commentary: comment }));
        } finally {
            setIsAiThinking(false);
        }
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

            // MOVE (Empty tile): click any reachable tile and the unit walks
            // the shortest path there, resolving each step (terrain, pickup,
            // touchdown) along the way.
            if (!clickedPlayer && isPositionValid(targetPos)) {
                if (selectedPlayer.movesRemaining <= 0) return;
                const others = getAllPlayers().filter(p => p.id !== selectedPlayer.id);
                const blocked = (pos: Position) => !!getPlayerAtPosition(pos, others);
                const path = findPath(selectedPlayer.position, targetPos, selectedPlayer.movesRemaining, blocked);
                if (path) {
                    walkPath(selectedPlayer, path);
                } else {
                    addLog("Can't reach that tile this turn.");
                }
                return;
            }
        }
    };

    // --- Game Logic Actions ---

    // Walk a plotted path tile by tile. Each step spends one Move point and
    // resolves fully (terrain, ball pickup, touchdown) before the next; a
    // knockdown, a touchdown, or an ice slide off the plotted route stops the
    // walk early. State commits once at the end.
    const walkPath = (player: Player, path: Position[]) => {
        const others = getAllPlayers().filter(p => p.id !== player.id);
        const occupied = (pos: Position) => !!getPlayerAtPosition(pos, others);

        let current: Player = { ...player };
        let newBallPos = gameState.ballPosition;
        let scoreHome = gameState.homeTeam.score;
        let scoreAway = gameState.awayTeam.score;
        let touchdown = false;

        for (const intended of path) {
            if (current.movesRemaining <= 0) break;
            current = { ...current, movesRemaining: current.movesRemaining - 1 };

            // Terrain resolves the step: Mud may slip (knockdown), a Lava hazard
            // knocks down, Ice slides the mover one further open tile. Grass is inert.
            const step = resolveTerrainStep(gameState.terrain, current.position, intended, gameState.hazards, occupied);
            current = { ...current, position: step.position };
            if (step.log) addLog(step.log);

            if (step.knockedDown) {
                // A slip / hazard fall ends the action prone: no pickup, no score.
                current = { ...current, isStunned: true, movesRemaining: 0, actionTaken: true };
                if (current.hasBall) {
                    current = { ...current, hasBall: false };
                    newBallPos = scatterBall(current.position);
                    addLog('The ball comes loose in the tumble!');
                }
                break;
            }

            // Check for Ball Pickup at the tile the mover actually came to rest on.
            // Ball pickup is automatic with no dice roll (by design): moving onto the
            // loose ball's tile always picks it up. This is documented in GAME_RULES.
            if (newBallPos && current.position.x === newBallPos.x && current.position.y === newBallPos.y) {
                current = { ...current, hasBall: true };
                newBallPos = null;
                addLog(`${player.name} picked up the ball!`);
            }

            // Check for Touchdown
            if (current.hasBall) {
                if (current.team === TeamSide.HOME && current.position.y >= BOARD_HEIGHT - 1) {
                    scoreHome += 7; // TD value
                    touchdown = true;
                    addLog(`TOUCHDOWN! ${player.name} scores for ${gameState.homeTeam.name}!`);
                } else if (current.team === TeamSide.AWAY && current.position.y <= 0) {
                    scoreAway += 7;
                    touchdown = true;
                    addLog(`TOUCHDOWN! ${player.name} scores for ${gameState.awayTeam.name}!`);
                }
            }
            if (touchdown) break;

            // An ice slide that pushed the mover off the plotted tile invalidates
            // the rest of the route.
            if (current.position.x !== intended.x || current.position.y !== intended.y) break;
        }

        // Reward the scorer: a touchdown is the biggest XP award and can level a
        // player up (folded into `current` before it is committed).
        if (touchdown) {
            const award = awardXp(current, XP_AWARDS.TOUCHDOWN);
            current = { ...current, xp: award.player.xp, level: award.player.level, stats: award.player.stats };
            if (award.log) addLog(award.log);
        }

        // A touchdown can end the match (score cap reached).
        const outcome = checkWinner(scoreHome, scoreAway, gameState.turn);

        updatePlayerState(current, {
            ballPosition: newBallPos,
            homeScore: scoreHome,
            awayScore: scoreAway,
            isGameOver: outcome.isGameOver,
            winner: outcome.winner,
        });

        if (outcome.isGameOver) {
            announceGameOver(outcome.winner);
        } else if (touchdown) {
            handleTouchdown();
        }
    };

    const announceGameOver = (winner: TeamSide | null) => {
        if (winner === null) {
            addLog("Full time! The match ends in a draw.");
        } else {
            const name = winner === TeamSide.HOME ? gameState.homeTeam.name : gameState.awayTeam.name;
            addLog(`Full time! ${name} win the match!`);
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

            // A landed tackle earns the attacker XP.
            const award = awardXp(updatedAttacker, XP_AWARDS.TACKLE);
            updatedAttacker = award.player;
            if (award.log) addLog(award.log);
        }

        updatePlayerState([updatedAttacker, updatedDefender], { ballPosition: newBallPos });
    };

    const handlePass = (thrower: Player, targetPos: Position) => {
        // Rain / Blizzard raise the pass difficulty (weatherPassModifier).
        const result = resolvePass(thrower, targetPos, gameState.weather);
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

            // A completed pass earns the thrower XP.
            const award = awardXp(updatedThrower, XP_AWARDS.PASS);
            updatedThrower = award.player;
            if (award.log) addLog(award.log);
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

        if (player.mana < spell.cost) {
            addLog("Not enough mana!");
            return;
        }

        // Enforce range and target validity before anything is spent.
        const targetPlayer = getPlayerAtPosition(targetPos, getAllPlayers());
        const validation = validateSpellCast(spellKey, player, targetPos, targetPlayer, spell.range);
        if (!validation.valid) {
            addLog(validation.reason);
            return;
        }

        addLog(`${player.name} casts ${spell.name} at ${targetPos.x},${targetPos.y}!`);

        // Copy both caster and target so we never mutate state in place.
        let updatedCaster: Player = { ...player, mana: player.mana - spell.cost, actionTaken: true };
        let updatedTarget = targetPlayer ? { ...targetPlayer } : null;

        if (spellKey === 'FIREBALL' && updatedTarget) {
            updatedTarget.isStunned = true;
            updatedTarget.movesRemaining = 0;
            addLog(`${updatedTarget.name} was knocked down by the fireball!`);
        } else if (spellKey === 'HEAL' && updatedTarget) {
            updatedTarget.isStunned = false;
            addLog(`${updatedTarget.name} is back in the fight!`);
        } else if (spellKey === 'TELEPORT') {
            updatedCaster.position = { ...targetPos }; // Copy, not in-place mutation.
            addLog(`${player.name} blinks across reality!`);
        }

        // A successful cast earns the wizard XP.
        const award = awardXp(updatedCaster, XP_AWARDS.SPELL);
        updatedCaster = award.player;
        if (award.log) addLog(award.log);

        const updates = [updatedCaster];
        if (updatedTarget) updates.push(updatedTarget);
        updatePlayerState(updates);
    };

    const handleTouchdown = () => {
        cancelPendingKickoff();
        kickoffTimerRef.current = setTimeout(() => {
            kickoffTimerRef.current = null;
            setGameState(prev => {
                // Deterministic kickoff: every player returns to its formation
                // slot (keeping stats, XP, mana and stun state).
                const toFormation = (p: Player, index: number) =>
                    ({ ...p, hasBall: false, position: kickoffPosition(p.team, index, p.role) });
                return {
                    ...prev,
                    ballPosition: { x: 6, y: 9 },
                    homeTeam: { ...prev.homeTeam, players: prev.homeTeam.players.map(toFormation) },
                    awayTeam: { ...prev.awayTeam, players: prev.awayTeam.players.map(toFormation) },
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
        if (gameState.isGameOver) return;

        let outcome = checkWinner(0, 0, 0); // placeholder; recomputed from committed state below
        setGameState(prev => {
            const nextTeam = prev.currentTeam === TeamSide.HOME ? TeamSide.AWAY : TeamSide.HOME;

            const refreshTeam = (team: TeamData) => ({
                ...team,
                players: team.players.map(p => ({
                    ...p,
                    // Blizzard shaves a Move point off every player each turn.
                    movesRemaining: effectiveMove(p.stats.move, prev.weather),
                    actionTaken: false,
                    isStunned: false
                }))
            });

            const newTurnNumber = nextTeam === TeamSide.HOME ? prev.turn + 1 : prev.turn;
            outcome = checkWinner(prev.homeTeam.score, prev.awayTeam.score, newTurnNumber);

            let homeTeam = nextTeam === TeamSide.HOME ? refreshTeam(prev.homeTeam) : prev.homeTeam;
            let awayTeam = nextTeam === TeamSide.AWAY ? refreshTeam(prev.awayTeam) : prev.awayTeam;

            // Meteor Shower: the meteor telegraphed last round strikes now (after
            // the refresh, so a fresh unit standing on the tile is still hit), then
            // a new one is telegraphed for the incoming turn.
            let meteor = prev.meteor;
            let ballPosition = prev.ballPosition;
            const meteorLogs: string[] = [];
            if (prev.weather === Weather.METEOR_SHOWER) {
                const res = advanceMeteor(prev.meteor, newTurnNumber);
                meteor = res.next;
                if (res.strike) {
                    const hit = res.strike;
                    const strikePlayer = (t: TeamData) => ({
                        ...t,
                        players: t.players.map(p => {
                            if (p.position.x !== hit.x || p.position.y !== hit.y) return p;
                            meteorLogs.push(`☄️ A meteor smashes into ${p.name} at (${hit.x}, ${hit.y})!`);
                            const knocked = { ...p, isStunned: true, movesRemaining: 0, actionTaken: true };
                            if (knocked.hasBall) {
                                knocked.hasBall = false;
                                ballPosition = scatterBall(hit);
                            }
                            return knocked;
                        }),
                    });
                    homeTeam = strikePlayer(homeTeam);
                    awayTeam = strikePlayer(awayTeam);
                    if (meteorLogs.length === 0) {
                        meteorLogs.push(`☄️ A meteor cracks the pitch at (${hit.x}, ${hit.y})!`);
                    }
                    if (ballPosition && ballPosition.x === hit.x && ballPosition.y === hit.y) {
                        ballPosition = scatterBall(hit);
                    }
                }
                meteorLogs.push(`⚠️ A meteor is sighted over (${meteor.target.x}, ${meteor.target.y}) - clear the tile!`);
            }

            return {
                ...prev,
                turn: newTurnNumber,
                currentTeam: nextTeam,
                selectedPlayerId: null,
                homeTeam,
                awayTeam,
                ballPosition,
                meteor,
                gameLog: meteorLogs.length ? [...prev.gameLog, ...meteorLogs] : prev.gameLog,
                isGameOver: outcome.isGameOver,
                winner: outcome.winner,
            };
        });

        if (outcome.isGameOver) {
            announceGameOver(outcome.winner);
        } else {
            addLog(`Turn Ending. It is now the ${gameState.currentTeam === TeamSide.HOME ? 'AWAY' : 'HOME'} team's turn.`);
        }
        cancelTargeting();
    };

    const handleNewGame = () => {
        // Drop any queued commentary and pending kickoff from the finished match.
        if (commentaryTimerRef.current) clearTimeout(commentaryTimerRef.current);
        cancelPendingKickoff();
        pendingLogsRef.current = [];
        setIsAiThinking(false);

        setGameState(prev => ({
            turn: 1,
            currentTeam: TeamSide.HOME,
            homeTeam: { ...INITIAL_HOME_TEAM, players: setupTeam(TeamSide.HOME) },
            awayTeam: { ...INITIAL_AWAY_TEAM, players: setupTeam(TeamSide.AWAY) },
            selectedPlayerId: null,
            ballPosition: { x: 6, y: 9 },
            boardWidth: BOARD_WIDTH,
            boardHeight: BOARD_HEIGHT,
            terrain: prev.terrain,
            weather: prev.weather,
            hazards: seedHazards(prev.terrain),
            meteor: seedMeteor(prev.weather),
            gameLog: ["A new match begins! The mystical gates open once more."],
            commentary: "Welcome back to Spellbound Gridiron!",
            isGameOver: false,
            winner: null,
        }));
        cancelTargeting();
    };

    // Post-game rematch: field a fresh match reusing the persisted rosters so the
    // two teams carry their earned XP, levels and stat bumps into the next game.
    // Missing or corrupt roster data degrades gracefully to brand-new teams.
    const handleRematch = () => {
        // Drop any queued commentary and pending kickoff from the finished match.
        if (commentaryTimerRef.current) clearTimeout(commentaryTimerRef.current);
        cancelPendingKickoff();
        pendingLogsRef.current = [];
        setIsAiThinking(false);

        const loaded = loadRosters();
        const homeRoster = loaded.ok ? loaded.slots!.home : undefined;
        const awayRoster = loaded.ok ? loaded.slots!.away : undefined;

        setGameState(prev => ({
            turn: 1,
            currentTeam: TeamSide.HOME,
            homeTeam: {
                ...INITIAL_HOME_TEAM,
                name: homeRoster?.name ?? INITIAL_HOME_TEAM.name,
                race: homeRoster?.race ?? INITIAL_HOME_TEAM.race,
                players: setupTeam(TeamSide.HOME, prev.weather, homeRoster),
            },
            awayTeam: {
                ...INITIAL_AWAY_TEAM,
                name: awayRoster?.name ?? INITIAL_AWAY_TEAM.name,
                race: awayRoster?.race ?? INITIAL_AWAY_TEAM.race,
                players: setupTeam(TeamSide.AWAY, prev.weather, awayRoster),
            },
            selectedPlayerId: null,
            ballPosition: { x: 6, y: 9 },
            boardWidth: BOARD_WIDTH,
            boardHeight: BOARD_HEIGHT,
            terrain: prev.terrain,
            weather: prev.weather,
            hazards: seedHazards(prev.terrain),
            meteor: seedMeteor(prev.weather),
            gameLog: [homeRoster
                ? 'Rematch! The veterans return, XP and hard-won stats intact.'
                : 'Rematch! No saved rosters found - fresh teams take the field.'],
            commentary: 'Rematch time! Same rivals, new grudge.',
            isGameOver: false,
            winner: null,
        }));
        cancelTargeting();
    };

    // A system/meta message (save/load feedback) that appends to the log without
    // firing an LLM commentary request, unlike `addLog`.
    const logSystem = (msg: string) => {
        setGameState(prev => ({ ...prev, gameLog: [...prev.gameLog, msg] }));
    };

    // --- Save / Load ---
    // Explicit only: there is no autosave, so a running match never overwrites
    // the slot on its own. Save persists the whole GameState (read fresh from
    // the ref so any in-flight update is included) plus `hasGameStarted`.
    const handleSave = () => {
        const result = saveGame(gameStateRef.current, hasGameStarted);
        logSystem(result.ok ? '💾 Game saved.' : `Save failed: ${result.error}`);
    };

    const handleLoad = () => {
        const result = loadGame();
        if (!result.ok || !result.gameState) {
            logSystem(`Load failed: ${result.error}`);
            return;
        }

        // Drop any queued commentary and pending kickoff tied to the outgoing match.
        if (commentaryTimerRef.current) clearTimeout(commentaryTimerRef.current);
        cancelPendingKickoff();
        pendingLogsRef.current = [];
        setIsAiThinking(false);

        setHasGameStarted(result.hasGameStarted ?? true);
        setGameState({
            ...result.gameState,
            gameLog: [...result.gameState.gameLog, '📂 Saved game loaded.'],
        });
        cancelTargeting();
    };

    // --- Rendering ---

    const renderBoard = () => {
        const tiles = [];

        // Highlight every tile the selected unit can walk to this turn (BFS
        // over its remaining Move points), not just the adjacent ring.
        const selectedForMove = getSelectedPlayer();
        let reachableKeys = new Set<string>();
        if (selectedForMove && !selectedForMove.actionTaken && selectedForMove.movesRemaining > 0 && interactionMode === 'DEFAULT') {
            const others = getAllPlayers().filter(p => p.id !== selectedForMove.id);
            const blocked = (pos: Position) => !!getPlayerAtPosition(pos, others);
            reachableKeys = new Set(
                reachableTiles(selectedForMove.position, selectedForMove.movesRemaining, blocked).map(p => `${p.x}-${p.y}`)
            );
        }
        for (let y = 0; y < BOARD_HEIGHT; y++) {
            for (let x = 0; x < BOARD_WIDTH; x++) {
                const pos = { x, y };
                const player = getPlayerAtPosition(pos, getAllPlayers());
                const isBall = gameState.ballPosition?.x === x && gameState.ballPosition?.y === y;
                const selected = getSelectedPlayer();

                const isValidMove = reachableKeys.has(`${x}-${y}`);

                // Zone Check
                let endZone = null;
                if (y === 0) endZone = TeamSide.AWAY;
                if (y === BOARD_HEIGHT - 1) endZone = TeamSide.HOME;

                // Environmental telegraphs: seeded lava hazards and the incoming
                // meteor's impact tile are drawn so the risk is visible.
                const tileIsHazard = gameState.terrain === TerrainType.LAVA && isHazard(pos, gameState.hazards);
                const tileIsMeteor = !!gameState.meteor && gameState.meteor.target.x === x && gameState.meteor.target.y === y;

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
                        isHazard={tileIsHazard}
                        isMeteorTarget={tileIsMeteor}
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
                        {gameState.meteor && (
                            <div className="mt-2 text-center text-[11px] font-bold py-1 rounded bg-orange-900/60 text-orange-200 border border-orange-500/40 animate-pulse">
                                ☄️ Meteor incoming at ({gameState.meteor.target.x}, {gameState.meteor.target.y})
                            </div>
                        )}
                    </div>

                    {/* Selected Unit Card */}
                    <div className="flex-1 bg-stone-900/50 rounded-xl border border-white/5 p-4 relative overflow-hidden flex flex-col">
                        {selectedPlayer ? (
                            <>
                                <div className="absolute top-0 right-0 p-2 opacity-10 text-6xl">
                                    {selectedPlayer.role === PlayerRole.WIZARD ? '🧙' : '🛡️'}
                                </div>
                                <h2 className="text-lg font-bold text-amber-100">{selectedPlayer.name}</h2>
                                <p className="text-xs text-amber-500 mb-2">{selectedPlayer.role} - {selectedPlayer.team}</p>

                                {/* Progression: level and accrued XP. */}
                                <div className="flex items-center justify-between mb-4" data-testid="unit-progression">
                                    <span className="text-[11px] font-bold text-purple-200 bg-purple-900/40 border border-purple-500/40 rounded px-2 py-0.5">
                                        Lv {selectedPlayer.level}
                                    </span>
                                    <span className="text-[11px] font-mono text-cyan-300" data-testid="unit-xp">
                                        {selectedPlayer.xp} XP
                                    </span>
                                </div>

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

                    {/* SAVE / LOAD / NEW GAME */}
                    <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                            onClick={handleSave}
                            title="Save the current match to this browser"
                            className="py-2 bg-stone-800 hover:bg-stone-700 border border-white/10 rounded text-[11px] font-bold uppercase tracking-widest text-emerald-300 hover:text-emerald-200 transition-colors"
                        >Save</button>
                        <button
                            onClick={handleLoad}
                            title="Restore the last saved match"
                            className="py-2 bg-stone-800 hover:bg-stone-700 border border-white/10 rounded text-[11px] font-bold uppercase tracking-widest text-sky-300 hover:text-sky-200 transition-colors"
                        >Load</button>
                        <button
                            onClick={handleNewGame}
                            title="Reset the board for a fresh match"
                            className="py-2 bg-stone-800 hover:bg-stone-700 border border-white/10 rounded text-[11px] font-bold uppercase tracking-widest text-amber-300 hover:text-amber-200 transition-colors"
                        >New Game</button>
                    </div>

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
                        {!hasGameStarted && (
                            <StartOverlay
                                onStart={handleStartGame}
                                isThinking={isAiThinking}
                                terrain={gameState.terrain}
                                onSelectTerrain={handleSelectTerrain}
                                weather={gameState.weather}
                                onSelectWeather={handleSelectWeather}
                            />
                        )}

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

                {/* END-OF-GAME SCREEN (blocks all board/HUD input) */}
                {gameState.isGameOver && (
                    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md">
                        <div className="text-center animate-in fade-in zoom-in duration-500">
                            <div className="text-6xl mb-4">🏆</div>
                            <h1 className="text-5xl font-fantasy text-amber-200 uppercase tracking-tighter mb-3">
                                {gameState.winner === null ? "It's a Draw!" : `${(gameState.winner === TeamSide.HOME ? gameState.homeTeam : gameState.awayTeam).name} Win!`}
                            </h1>
                            <p className="text-stone-300 font-mono text-sm tracking-widest mb-2">Full Time</p>
                            <p className="text-2xl font-bold font-fantasy mb-10">
                                <span className="text-blue-400">{gameState.homeTeam.score}</span>
                                <span className="text-gray-600 text-base mx-3">VS</span>
                                <span className="text-red-400">{gameState.awayTeam.score}</span>
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <button
                                    onClick={handleRematch}
                                    title="Replay with the same teams - they keep the XP and levels they earned"
                                    className="px-12 py-5 bg-purple-700 hover:bg-purple-600 text-white rounded-lg shadow-lg transition-all hover:scale-105 active:scale-95 text-2xl font-bold tracking-widest uppercase"
                                >
                                    Rematch
                                </button>
                                <button
                                    onClick={handleNewGame}
                                    title="Start over with fresh teams (progression reset)"
                                    className="px-12 py-5 bg-amber-700 hover:bg-amber-600 text-white rounded-lg shadow-lg transition-all hover:scale-105 active:scale-95 text-2xl font-bold tracking-widest uppercase"
                                >
                                    New Game
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
    );
}