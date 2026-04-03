import { useState, useCallback, useContext } from 'react';
import {
    GameState, TeamSide, Player, Position, TerrainType, Weather,
    BOARD_WIDTH, BOARD_HEIGHT, PlayerRole, TeamData, SpellKey, GamePhase,
    TeamBlueprint
} from '../types';
import { createPlayer, getPlayerAtPosition, isPositionValid, isAdjacent, resolveTackle, resolvePass } from '../services/gameUtils';
import { SPELLS, TEAM_BLUEPRINTS } from '../constants';
import { generateCommentary, generateTeamName } from '../services/gameAiService';
import { ApiKeysContext } from '../context/ApiKeysContext';
import { LLMProvider } from '../utils/llmHelper';

type InteractionMode = 'DEFAULT' | 'TARGETING';
type TargetAction = 'PASS' | 'SPELL';

const EMPTY_TEAM: TeamData = {
    name: '',
    race: '',
    color: '',
    score: 0,
    players: [],
    blueprintId: '',
};

function createInitialGameState(): GameState {
    return {
        phase: GamePhase.MAIN_MENU,
        turn: 1,
        currentTeam: TeamSide.HOME,
        homeTeam: EMPTY_TEAM,
        awayTeam: EMPTY_TEAM,
        selectedPlayerId: null,
        ballPosition: { x: 6, y: 9 },
        boardWidth: BOARD_WIDTH,
        boardHeight: BOARD_HEIGHT,
        terrain: TerrainType.GRASS,
        weather: Weather.CLEAR,
        gameLog: [],
        commentary: 'Welcome to Spellbound Gridiron! The players are taking the field.',
        isGameOver: false,
        winner: null,
    };
}

function setupTeamFromBlueprint(blueprint: TeamBlueprint, side: TeamSide, startY: number, direction: number): Player[] {
    const xPositions = [2, 4, 6, 8, 10];
    return blueprint.roster.map((role, index) =>
        createPlayer(
            `${side}-${index}`,
            `${role} ${index + 1}`,
            role,
            side,
            xPositions[index],
            startY + (direction * (role === PlayerRole.LINEMAN ? 2 : 0))
        )
    );
}

export function useGameEngine(gameProvider: LLMProvider, gameModel: string) {
    const { apiKeys } = useContext(ApiKeysContext);
    const [gameState, setGameState] = useState<GameState>(createInitialGameState);
    const [isAiThinking, setIsAiThinking] = useState(false);

    // Interaction state
    const [interactionMode, setInteractionMode] = useState<InteractionMode>('DEFAULT');
    const [targetingAction, setTargetingAction] = useState<TargetAction | null>(null);
    const [activeSpellKey, setActiveSpellKey] = useState<SpellKey | null>(null);

    // --- Navigation ---

    const goToTeamSelect = useCallback(() => {
        setGameState(prev => ({ ...prev, phase: GamePhase.TEAM_SELECT }));
    }, []);

    const goToMainMenu = useCallback(() => {
        setGameState(createInitialGameState());
    }, []);

    // --- Game Setup ---

    const startGame = useCallback(async (homeBlueprint: TeamBlueprint, awayBlueprint: TeamBlueprint) => {
        const homePlayers = setupTeamFromBlueprint(homeBlueprint, TeamSide.HOME, 1, 1);
        const awayPlayers = setupTeamFromBlueprint(awayBlueprint, TeamSide.AWAY, 16, -1);

        setGameState(prev => ({
            ...prev,
            phase: GamePhase.PLAYING,
            homeTeam: {
                name: homeBlueprint.name,
                race: homeBlueprint.race,
                color: homeBlueprint.color,
                score: 0,
                players: homePlayers,
                blueprintId: homeBlueprint.id,
            },
            awayTeam: {
                name: awayBlueprint.name,
                race: awayBlueprint.race,
                color: awayBlueprint.color,
                score: 0,
                players: awayPlayers,
                blueprintId: awayBlueprint.id,
            },
            gameLog: ['The mystical gates open! The match begins.'],
        }));

        // Fetch AI names in background
        (async () => {
            try {
                const homeName = await generateTeamName(homeBlueprint.race, gameProvider, apiKeys, gameModel);
                const awayName = await generateTeamName(awayBlueprint.race, gameProvider, apiKeys, gameModel);
                setGameState(prev => ({
                    ...prev,
                    homeTeam: { ...prev.homeTeam, name: homeName },
                    awayTeam: { ...prev.awayTeam, name: awayName },
                    gameLog: [...prev.gameLog, `Teams revealed: ${homeName} vs ${awayName}!`],
                }));
            } catch (error) {
                console.error('Failed to generate AI names:', error);
            }
        })();
    }, [gameProvider, apiKeys, gameModel]);

    // --- Helpers ---

    const getAllPlayers = useCallback(() => {
        return [...gameState.homeTeam.players, ...gameState.awayTeam.players];
    }, [gameState.homeTeam.players, gameState.awayTeam.players]);

    const getSelectedPlayer = useCallback(() => {
        if (!gameState.selectedPlayerId) return null;
        return getAllPlayers().find(p => p.id === gameState.selectedPlayerId) ?? null;
    }, [gameState.selectedPlayerId, getAllPlayers]);

    const addLog = useCallback((msg: string) => {
        setGameState(prev => ({
            ...prev,
            gameLog: [...prev.gameLog, msg],
        }));
        triggerCommentary(msg);
    }, []);

    const triggerCommentary = async (action: string) => {
        setIsAiThinking(true);
        const comment = await generateCommentary(action, gameState, gameProvider, apiKeys, gameModel);
        setGameState(prev => ({ ...prev, commentary: comment }));
        setIsAiThinking(false);
    };

    // --- Targeting ---

    const startTargeting = useCallback((action: TargetAction, spellKey?: SpellKey) => {
        setInteractionMode('TARGETING');
        setTargetingAction(action);
        if (spellKey) setActiveSpellKey(spellKey);
    }, []);

    const cancelTargeting = useCallback(() => {
        setInteractionMode('DEFAULT');
        setTargetingAction(null);
        setActiveSpellKey(null);
    }, []);

    // --- State Update Helpers ---

    const updatePlayerState = useCallback((
        playerOrPlayers: Player | Player[],
        globalUpdates: Partial<GameState> & { homeScore?: number; awayScore?: number } = {}
    ) => {
        const playersToUpdate = Array.isArray(playerOrPlayers) ? playerOrPlayers : [playerOrPlayers];

        setGameState(prev => {
            const { homeScore, awayScore, ...gameStateUpdates } = globalUpdates;

            const updateList = (currentList: Player[]) =>
                currentList.map(p => playersToUpdate.find(u => u.id === p.id) ?? p);

            return {
                ...prev,
                ...gameStateUpdates,
                homeTeam: {
                    ...prev.homeTeam,
                    score: homeScore !== undefined ? homeScore : prev.homeTeam.score,
                    players: updateList(prev.homeTeam.players),
                },
                awayTeam: {
                    ...prev.awayTeam,
                    score: awayScore !== undefined ? awayScore : prev.awayTeam.score,
                    players: updateList(prev.awayTeam.players),
                },
            };
        });
    }, []);

    // --- Game Actions ---

    const handleTouchdown = useCallback(() => {
        setTimeout(() => {
            setGameState(prev => {
                const home = prev.homeTeam.players.map(p => ({
                    ...p, hasBall: false, position: { x: p.position.x, y: 1 + Math.floor(Math.random() * 3) }
                }));
                const away = prev.awayTeam.players.map(p => ({
                    ...p, hasBall: false, position: { x: p.position.x, y: 16 - Math.floor(Math.random() * 3) }
                }));
                return {
                    ...prev,
                    ballPosition: { x: 6, y: 9 },
                    homeTeam: { ...prev.homeTeam, players: home },
                    awayTeam: { ...prev.awayTeam, players: away },
                    gameLog: [...prev.gameLog, 'Teams resetting for kickoff...'],
                };
            });
        }, 2000);
    }, []);

    const handleMove = useCallback((player: Player, to: Position) => {
        const updatedPlayer = {
            ...player,
            position: to,
            movesRemaining: player.movesRemaining - 1,
        };

        let newBallPos = gameState.ballPosition;

        if (gameState.ballPosition && to.x === gameState.ballPosition.x && to.y === gameState.ballPosition.y) {
            updatedPlayer.hasBall = true;
            newBallPos = null;
            addLog(`${player.name} picked up the ball!`);
        }

        let scoreHome = gameState.homeTeam.score;
        let scoreAway = gameState.awayTeam.score;
        let touchdown = false;

        if (updatedPlayer.hasBall) {
            if (player.team === TeamSide.HOME && to.y >= BOARD_HEIGHT - 1) {
                scoreHome += 7;
                touchdown = true;
                addLog(`TOUCHDOWN! ${player.name} scores for ${gameState.homeTeam.name}!`);
            } else if (player.team === TeamSide.AWAY && to.y <= 0) {
                scoreAway += 7;
                touchdown = true;
                addLog(`TOUCHDOWN! ${player.name} scores for ${gameState.awayTeam.name}!`);
            }
        }

        updatePlayerState(updatedPlayer, { ballPosition: newBallPos, homeScore: scoreHome, awayScore: scoreAway });

        if (touchdown) handleTouchdown();
    }, [gameState.ballPosition, gameState.homeTeam.score, gameState.homeTeam.name, gameState.awayTeam.score, gameState.awayTeam.name, addLog, updatePlayerState, handleTouchdown]);

    const handleTackle = useCallback((attacker: Player, defender: Player) => {
        const result = resolveTackle(attacker, defender);
        addLog(result.log);

        const updatedAttacker = { ...attacker, actionTaken: true, movesRemaining: 0 };
        const updatedDefender = { ...defender };
        let newBallPos = gameState.ballPosition;

        if (result.success) {
            updatedDefender.isStunned = true;
            updatedDefender.movesRemaining = 0;

            if (updatedDefender.hasBall) {
                updatedDefender.hasBall = false;
                const scatterX = defender.position.x + (Math.random() > 0.5 ? 1 : -1);
                const scatterY = defender.position.y + (Math.random() > 0.5 ? 1 : -1);
                newBallPos = {
                    x: Math.max(1, Math.min(BOARD_WIDTH - 2, scatterX)),
                    y: Math.max(1, Math.min(BOARD_HEIGHT - 2, scatterY)),
                };
                addLog('The ball pops loose!');
            }
        }

        updatePlayerState([updatedAttacker, updatedDefender], { ballPosition: newBallPos });
    }, [gameState.ballPosition, addLog, updatePlayerState]);

    const handlePass = useCallback((thrower: Player, targetPos: Position) => {
        const result = resolvePass(thrower, targetPos);
        addLog(result.log);

        let newBallPos: Position | null = null;
        const updatedThrower = { ...thrower, hasBall: false, actionTaken: true, movesRemaining: 0 };

        const receiver = getPlayerAtPosition(targetPos, getAllPlayers());
        const updatedReceiver = receiver ? { ...receiver } : null;

        if (result.success) {
            if (updatedReceiver) {
                updatedReceiver.hasBall = true;
                addLog(`${updatedReceiver.name} catches it!`);
            } else {
                newBallPos = targetPos;
                addLog(`The ball lands at ${targetPos.x}, ${targetPos.y}.`);
            }
        } else {
            const scatterX = targetPos.x + (Math.random() > 0.5 ? 1 : -1);
            const scatterY = targetPos.y + (Math.random() > 0.5 ? 1 : -1);
            newBallPos = {
                x: Math.max(1, Math.min(BOARD_WIDTH - 2, scatterX)),
                y: Math.max(1, Math.min(BOARD_HEIGHT - 2, scatterY)),
            };
            addLog(`Inaccurate pass! Ball lands at ${newBallPos.x}, ${newBallPos.y}.`);
        }

        const updates = [updatedThrower];
        if (updatedReceiver) updates.push(updatedReceiver);
        updatePlayerState(updates, { ballPosition: newBallPos });
    }, [getAllPlayers, addLog, updatePlayerState]);

    const handleCastSpell = useCallback((player: Player, spellKey: SpellKey, targetPos: Position) => {
        const spell = SPELLS[spellKey];

        if (player.mana < spell.cost) {
            addLog('Not enough mana!');
            return;
        }

        addLog(`${player.name} casts ${spell.name} at ${targetPos.x},${targetPos.y}!`);
        const targetPlayer = getPlayerAtPosition(targetPos, getAllPlayers());
        const updatedTarget = targetPlayer ? { ...targetPlayer } : null;

        if (spellKey === SpellKey.FIREBALL && updatedTarget) {
            updatedTarget.isStunned = true;
            addLog(`${updatedTarget.name} was knocked down by the fireball!`);
        } else if (spellKey === SpellKey.HEAL && updatedTarget) {
            updatedTarget.isStunned = false;
            addLog(`${updatedTarget.name} is back in the fight!`);
        } else if (spellKey === SpellKey.TELEPORT) {
            addLog(`${player.name} blinks across reality!`);
        }

        const updatedCaster = { ...player, mana: player.mana - spell.cost, actionTaken: true };
        if (spellKey === SpellKey.TELEPORT) {
            updatedCaster.position = targetPos;
        }
        const updates: Player[] = [updatedCaster];
        if (updatedTarget) updates.push(updatedTarget);
        updatePlayerState(updates);
    }, [getAllPlayers, addLog, updatePlayerState]);

    // --- Tile Click Handler ---

    const handleTileClick = useCallback((x: number, y: number) => {
        if (gameState.isGameOver) return;

        const targetPos = { x, y };
        const selectedPlayer = getSelectedPlayer();

        // Targeting mode
        if (interactionMode === 'TARGETING' && selectedPlayer) {
            if (targetingAction === 'PASS') {
                handlePass(selectedPlayer, targetPos);
            } else if (targetingAction === 'SPELL' && activeSpellKey) {
                handleCastSpell(selectedPlayer, activeSpellKey, targetPos);
            }
            cancelTargeting();
            return;
        }

        // Default mode
        const clickedPlayer = getPlayerAtPosition(targetPos, getAllPlayers());

        // Select own player
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
            cancelTargeting();
            return;
        }

        // Actions with selected player
        if (selectedPlayer) {
            if (selectedPlayer.actionTaken) return;
            const isAdj = isAdjacent(selectedPlayer.position, targetPos);

            if (clickedPlayer && clickedPlayer.team !== gameState.currentTeam && isAdj) {
                if (selectedPlayer.movesRemaining > 0) {
                    handleTackle(selectedPlayer, clickedPlayer);
                } else {
                    addLog('Not enough movement to tackle!');
                }
                return;
            }

            if (!clickedPlayer && isPositionValid(targetPos)) {
                if (isAdj && selectedPlayer.movesRemaining > 0) {
                    handleMove(selectedPlayer, targetPos);
                } else if (!isAdj) {
                    addLog('Move one square at a time.');
                }
            }
        }
    }, [gameState.isGameOver, gameState.currentTeam, getSelectedPlayer, getAllPlayers, interactionMode, targetingAction, activeSpellKey, handlePass, handleCastSpell, handleTackle, handleMove, addLog, cancelTargeting]);

    // --- Turn Management ---

    const endPlayerAction = useCallback(() => {
        const selected = getSelectedPlayer();
        if (selected) {
            updatePlayerState({ ...selected, actionTaken: true });
        }
    }, [getSelectedPlayer, updatePlayerState]);

    const endTurn = useCallback(() => {
        setGameState(prev => {
            const nextTeam = prev.currentTeam === TeamSide.HOME ? TeamSide.AWAY : TeamSide.HOME;

            const refreshTeam = (team: TeamData): TeamData => ({
                ...team,
                players: team.players.map(p => ({
                    ...p,
                    movesRemaining: p.stats.move,
                    actionTaken: false,
                    isStunned: false,
                })),
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
    }, [gameState.currentTeam, addLog, cancelTargeting]);

    return {
        gameState,
        isAiThinking,
        interactionMode,
        targetingAction,
        activeSpellKey,
        selectedPlayer: getSelectedPlayer(),
        allPlayers: getAllPlayers(),

        // Navigation
        goToTeamSelect,
        goToMainMenu,

        // Game setup
        startGame,

        // Actions
        handleTileClick,
        startTargeting,
        cancelTargeting,
        endPlayerAction,
        endTurn,
    };
}
