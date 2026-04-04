import { describe, it, expect, vi } from 'vitest';
import {
    createPlayer, createWolf, isPositionValid, getDistance, isAdjacent,
    getPlayerAtPosition, rollDice, resolveTackle, resolvePass,
    isBackstab,
    getMovementCost, getTerrainTackleModifier, getTerrainPassModifier,
    getWeatherPassModifier, getWeatherMovementModifier,
    weatherRequiresBallPickupCheck, resolveBallPickup,
    resolveIceSlide, generateLavaHazards, resolveLavaHazard,
    generateMeteorStrikes, resolveMeteorStrike, getEffectiveMovement,
    INITIAL_MANA,
} from './gameUtils';
import { PlayerRole, TeamSide, TerrainType, Weather, BOARD_WIDTH, BOARD_HEIGHT } from '../types';

// --- createPlayer ---
describe('createPlayer', () => {
    it('creates a player with correct stats from role', () => {
        const p = createPlayer('p1', 'Test', PlayerRole.CATCHER, TeamSide.HOME, 3, 5);
        expect(p.id).toBe('p1');
        expect(p.name).toBe('Test');
        expect(p.role).toBe(PlayerRole.CATCHER);
        expect(p.team).toBe(TeamSide.HOME);
        expect(p.position).toEqual({ x: 3, y: 5 });
        expect(p.stats.move).toBe(8); // Catcher has move 8
        expect(p.movesRemaining).toBe(8);
        expect(p.hasBall).toBe(false);
        expect(p.isStunned).toBe(false);
        expect(p.mana).toBe(0);
    });

    it('gives mana only to wizards', () => {
        const wizard = createPlayer('w', 'Wiz', PlayerRole.WIZARD, TeamSide.AWAY, 0, 0);
        expect(wizard.mana).toBe(INITIAL_MANA);

        const blitzer = createPlayer('b', 'Blitz', PlayerRole.BLITZER, TeamSide.HOME, 0, 0);
        expect(blitzer.mana).toBe(0);
    });
});

// --- Position utilities ---
describe('isPositionValid', () => {
    it('accepts valid positions', () => {
        expect(isPositionValid({ x: 0, y: 0 })).toBe(true);
        expect(isPositionValid({ x: BOARD_WIDTH - 1, y: BOARD_HEIGHT - 1 })).toBe(true);
    });
    it('rejects out-of-bounds', () => {
        expect(isPositionValid({ x: -1, y: 0 })).toBe(false);
        expect(isPositionValid({ x: BOARD_WIDTH, y: 0 })).toBe(false);
        expect(isPositionValid({ x: 0, y: BOARD_HEIGHT })).toBe(false);
    });
});

describe('getDistance', () => {
    it('returns Manhattan distance', () => {
        expect(getDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
        expect(getDistance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
    });
});

describe('isAdjacent', () => {
    it('returns true for orthogonal neighbors', () => {
        expect(isAdjacent({ x: 5, y: 5 }, { x: 5, y: 6 })).toBe(true);
        expect(isAdjacent({ x: 5, y: 5 }, { x: 6, y: 5 })).toBe(true);
    });
    it('returns true for diagonal neighbors', () => {
        expect(isAdjacent({ x: 5, y: 5 }, { x: 6, y: 6 })).toBe(true);
    });
    it('returns false for same position', () => {
        expect(isAdjacent({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(false);
    });
    it('returns false for non-adjacent', () => {
        expect(isAdjacent({ x: 5, y: 5 }, { x: 7, y: 5 })).toBe(false);
    });
});

describe('getPlayerAtPosition', () => {
    const players = [
        createPlayer('a', 'A', PlayerRole.LINEMAN, TeamSide.HOME, 3, 3),
        createPlayer('b', 'B', PlayerRole.BLITZER, TeamSide.AWAY, 5, 5),
    ];

    it('finds a player at the given position', () => {
        expect(getPlayerAtPosition({ x: 3, y: 3 }, players)?.id).toBe('a');
    });
    it('returns undefined when no player at position', () => {
        expect(getPlayerAtPosition({ x: 0, y: 0 }, players)).toBeUndefined();
    });
});

// --- rollDice ---
describe('rollDice', () => {
    it('returns values within range', () => {
        for (let i = 0; i < 100; i++) {
            const val = rollDice(6);
            expect(val).toBeGreaterThanOrEqual(1);
            expect(val).toBeLessThanOrEqual(6);
        }
    });
});

// --- Terrain modifiers ---
describe('terrain modifiers', () => {
    it('mud costs 2 movement', () => {
        expect(getMovementCost(TerrainType.MUD)).toBe(2);
    });
    it('grass costs 1 movement', () => {
        expect(getMovementCost(TerrainType.GRASS)).toBe(1);
    });
    it('mud gives defender +1 tackle bonus', () => {
        const mod = getTerrainTackleModifier(TerrainType.MUD);
        expect(mod.defender).toBe(1);
    });
    it('ice gives -1 pass modifier', () => {
        expect(getTerrainPassModifier(TerrainType.ICE)).toBe(-1);
    });
});

// --- Weather modifiers ---
describe('weather modifiers', () => {
    it('rain penalizes passing by -1', () => {
        expect(getWeatherPassModifier(Weather.RAIN)).toBe(-1);
    });
    it('blizzard penalizes passing by -2', () => {
        expect(getWeatherPassModifier(Weather.BLIZZARD)).toBe(-2);
    });
    it('blizzard reduces movement by -1', () => {
        expect(getWeatherMovementModifier(Weather.BLIZZARD)).toBe(-1);
    });
    it('rain requires ball pickup check', () => {
        expect(weatherRequiresBallPickupCheck(Weather.RAIN)).toBe(true);
        expect(weatherRequiresBallPickupCheck(Weather.CLEAR)).toBe(false);
    });
});

// --- resolveTackle with terrain and armor ---
describe('resolveTackle', () => {
    it('returns success or failure with log', () => {
        const a = createPlayer('a', 'Attacker', PlayerRole.BLITZER, TeamSide.HOME, 0, 0);
        const d = createPlayer('d', 'Defender', PlayerRole.LINEMAN, TeamSide.AWAY, 1, 0);
        const result = resolveTackle(a, d, TerrainType.GRASS, Weather.CLEAR);
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('attackerInjured');
        expect(result.log).toContain('Attacker');
    });
});

// --- resolvePass with terrain and weather ---
describe('resolvePass', () => {
    it('returns success or failure with log', () => {
        const qb = createPlayer('qb', 'QB', PlayerRole.QUARTERBACK, TeamSide.HOME, 5, 5);
        const result = resolvePass(qb, { x: 5, y: 10 }, TerrainType.GRASS, Weather.CLEAR);
        expect(result).toHaveProperty('success');
        expect(result.log).toContain('QB');
    });
});

// --- Ice slide ---
describe('resolveIceSlide', () => {
    it('slides in the direction of movement when clear', () => {
        const result = resolveIceSlide({ x: 5, y: 5 }, { x: 6, y: 5 }, []);
        expect(result).toEqual({ x: 7, y: 5 });
    });
    it('returns null when slide would go off-board', () => {
        const result = resolveIceSlide({ x: BOARD_WIDTH - 2, y: 5 }, { x: BOARD_WIDTH - 1, y: 5 }, []);
        expect(result).toBeNull();
    });
    it('returns null when slide target is occupied', () => {
        const blocker = createPlayer('b', 'B', PlayerRole.LINEMAN, TeamSide.AWAY, 7, 5);
        const result = resolveIceSlide({ x: 5, y: 5 }, { x: 6, y: 5 }, [blocker]);
        expect(result).toBeNull();
    });
});

// --- Lava hazards ---
describe('generateLavaHazards', () => {
    it('generates the requested number of hazards within bounds', () => {
        const hazards = generateLavaHazards(5);
        expect(hazards).toHaveLength(5);
        for (const h of hazards) {
            expect(h.x).toBeGreaterThanOrEqual(1);
            expect(h.x).toBeLessThan(BOARD_WIDTH - 1);
            expect(h.y).toBeGreaterThanOrEqual(1);
            expect(h.y).toBeLessThan(BOARD_HEIGHT - 1);
        }
    });
});

// --- Effective movement ---
describe('getEffectiveMovement', () => {
    it('reduces movement in blizzard', () => {
        expect(getEffectiveMovement(6, TerrainType.GRASS, Weather.BLIZZARD)).toBe(5);
    });
    it('never drops below 1', () => {
        expect(getEffectiveMovement(1, TerrainType.GRASS, Weather.BLIZZARD)).toBe(1);
    });
    it('returns base in clear grass', () => {
        expect(getEffectiveMovement(6, TerrainType.GRASS, Weather.CLEAR)).toBe(6);
    });
});

// --- New Player Roles ---

describe('createPlayer - new roles', () => {
    it('creates a berserker with fury at 0', () => {
        const b = createPlayer('b', 'Berserker', PlayerRole.BERSERKER, TeamSide.HOME, 0, 0);
        expect(b.fury).toBe(0);
        expect(b.stats.strength).toBe(3);
        expect(b.stats.move).toBe(5);
    });
    it('creates an assassin', () => {
        const a = createPlayer('a', 'Assassin', PlayerRole.ASSASSIN, TeamSide.AWAY, 0, 0);
        expect(a.stats.move).toBe(7);
        expect(a.stats.skill).toBe(4);
        expect(a.stats.armor).toBe(6);
    });
    it('creates a beastmaster with hasSummoned false', () => {
        const bm = createPlayer('bm', 'BM', PlayerRole.BEASTMASTER, TeamSide.HOME, 0, 0);
        expect(bm.hasSummoned).toBe(false);
        expect(bm.isSummon).toBe(false);
    });
});

describe('isBackstab', () => {
    it('returns true when assassin attacks from behind (HOME defender)', () => {
        const assassin = createPlayer('a', 'A', PlayerRole.ASSASSIN, TeamSide.AWAY, 5, 10);
        const defender = createPlayer('d', 'D', PlayerRole.LINEMAN, TeamSide.HOME, 5, 9);
        // HOME scores at bottom (high y), so attacking from higher y = from behind
        expect(isBackstab(assassin, defender)).toBe(true);
    });
    it('returns false for non-assassin', () => {
        const blitzer = createPlayer('b', 'B', PlayerRole.BLITZER, TeamSide.AWAY, 5, 10);
        const defender = createPlayer('d', 'D', PlayerRole.LINEMAN, TeamSide.HOME, 5, 9);
        expect(isBackstab(blitzer, defender)).toBe(false);
    });
    it('returns false when attacking from front', () => {
        const assassin = createPlayer('a', 'A', PlayerRole.ASSASSIN, TeamSide.AWAY, 5, 8);
        const defender = createPlayer('d', 'D', PlayerRole.LINEMAN, TeamSide.HOME, 5, 9);
        expect(isBackstab(assassin, defender)).toBe(false);
    });
});

describe('resolveTackle - berserker fury', () => {
    it('includes furyGained flag for berserker', () => {
        const berserker = createPlayer('b', 'Berserker', PlayerRole.BERSERKER, TeamSide.HOME, 0, 0);
        const defender = createPlayer('d', 'D', PlayerRole.LINEMAN, TeamSide.AWAY, 1, 0);
        const result = resolveTackle(berserker, defender);
        expect(result).toHaveProperty('furyGained');
        expect(result.furyGained).toBe(true); // fury 0 < 3, so should gain
    });
    it('does not gain fury when already at max', () => {
        const berserker = { ...createPlayer('b', 'Berserker', PlayerRole.BERSERKER, TeamSide.HOME, 0, 0), fury: 3 };
        const defender = createPlayer('d', 'D', PlayerRole.LINEMAN, TeamSide.AWAY, 1, 0);
        const result = resolveTackle(berserker, defender);
        expect(result.furyGained).toBe(false);
    });
});

describe('createWolf', () => {
    it('creates a wolf adjacent to beastmaster', () => {
        const bm = createPlayer('bm', 'BM', PlayerRole.BEASTMASTER, TeamSide.HOME, 5, 5);
        const wolf = createWolf(bm, bm.position, [bm]);
        expect(wolf).not.toBeNull();
        expect(wolf!.isSummon).toBe(true);
        expect(wolf!.name).toContain('Wolf');
        expect(wolf!.team).toBe(TeamSide.HOME);
    });
    it('returns null when all adjacent tiles are blocked', () => {
        const bm = createPlayer('bm', 'BM', PlayerRole.BEASTMASTER, TeamSide.HOME, 0, 0);
        // Block all valid adjacent tiles
        const blockers = [
            createPlayer('b1', 'B1', PlayerRole.LINEMAN, TeamSide.HOME, 1, 0),
            createPlayer('b2', 'B2', PlayerRole.LINEMAN, TeamSide.HOME, 0, 1),
        ];
        // Position (0,0) has only (1,0) and (0,1) as valid adjacent (others are off-board)
        // Actually (-1,0) and (0,-1) are invalid, so only 2 adjacent valid tiles
        const wolf = createWolf(bm, bm.position, [bm, ...blockers]);
        expect(wolf).toBeNull();
    });
});
