import { Position, Player, GameState, TeamSide, BOARD_WIDTH, BOARD_HEIGHT, PlayerRole, TerrainType, Weather } from "../types";
import { ROLE_STATS } from "../constants";

export const INITIAL_MANA = 5;

export const createPlayer = (
  id: string,
  name: string,
  role: PlayerRole,
  team: TeamSide,
  x: number,
  y: number,
  isSummon: boolean = false,
): Player => {
  return {
    id,
    name,
    role,
    team,
    position: { x, y },
    stats: ROLE_STATS[role],
    hasBall: false,
    isStunned: false,
    movesRemaining: ROLE_STATS[role].move,
    actionTaken: false,
    mana: role === PlayerRole.WIZARD ? INITIAL_MANA : 0,
    fury: 0,
    hasSummoned: false,
    isSummon,
  };
};

// --- Wolf companion stats (used by Beastmaster summon) ---
export const WOLF_STATS: PlayerStats = { move: 6, strength: 2, skill: 1, armor: 5 };

export const createWolf = (
  beastmaster: Player,
  spawnPos: Position,
  allPlayers: Player[],
): Player | null => {
  // Find an empty adjacent tile to spawn the wolf
  const candidates = [
    { x: spawnPos.x + 1, y: spawnPos.y },
    { x: spawnPos.x - 1, y: spawnPos.y },
    { x: spawnPos.x, y: spawnPos.y + 1 },
    { x: spawnPos.x, y: spawnPos.y - 1 },
  ].filter(p => isPositionValid(p) && !getPlayerAtPosition(p, allPlayers));

  if (candidates.length === 0) return null;

  const pos = candidates[0];
  return {
    id: `${beastmaster.id}-wolf`,
    name: `${beastmaster.name}'s Wolf`,
    role: PlayerRole.BLITZER, // Wolves act like basic blitzers
    team: beastmaster.team,
    position: pos,
    stats: WOLF_STATS,
    hasBall: false,
    isStunned: false,
    movesRemaining: WOLF_STATS.move,
    actionTaken: false,
    mana: 0,
    fury: 0,
    hasSummoned: false,
    isSummon: true,
  };
};

export const isPositionValid = (pos: Position): boolean => {
  return pos.x >= 0 && pos.x < BOARD_WIDTH && pos.y >= 0 && pos.y < BOARD_HEIGHT;
};

export const getDistance = (p1: Position, p2: Position): number => {
  return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
};

export const isAdjacent = (p1: Position, p2: Position): boolean => {
    const dx = Math.abs(p1.x - p2.x);
    const dy = Math.abs(p1.y - p2.y);
    return dx <= 1 && dy <= 1 && (dx + dy > 0);
};

export const getPlayerAtPosition = (
  pos: Position,
  players: Player[]
): Player | undefined => {
  return players.find((p) => p.position.x === pos.x && p.position.y === pos.y);
};

export const rollDice = (sides: number = 6): number => {
    return Math.floor(Math.random() * sides) + 1;
};

// --- Terrain Modifiers ---

/** Returns the movement cost to enter a tile on this terrain. Standard is 1. */
export const getMovementCost = (terrain: TerrainType): number => {
    switch (terrain) {
        case TerrainType.MUD: return 2;   // Mud costs double movement
        default: return 1;
    }
};

/** Returns a tackle modifier for the defender on this terrain. Positive = helps defender. */
export const getTerrainTackleModifier = (terrain: TerrainType): { attacker: number; defender: number } => {
    switch (terrain) {
        case TerrainType.MUD:  return { attacker: 0, defender: 1 };   // Harder to push in mud
        case TerrainType.ICE:  return { attacker: -1, defender: -1 }; // Everyone slips
        case TerrainType.LAVA: return { attacker: 0, defender: 0 };   // Lava doesn't affect tackles
        default:               return { attacker: 0, defender: 0 };
    }
};

/** Returns a passing accuracy modifier for this terrain. Negative = harder. */
export const getTerrainPassModifier = (terrain: TerrainType): number => {
    switch (terrain) {
        case TerrainType.ICE: return -1;  // Slippery footing hurts accuracy
        default: return 0;
    }
};

// --- Weather Modifiers ---

export const getWeatherPassModifier = (weather: Weather): number => {
    switch (weather) {
        case Weather.RAIN: return -1;
        case Weather.BLIZZARD: return -2;
        default: return 0;
    }
};

export const getWeatherMovementModifier = (weather: Weather): number => {
    switch (weather) {
        case Weather.BLIZZARD: return -1;
        default: return 0;
    }
};

/** Returns true if this weather requires a skill check to pick up the ball. */
export const weatherRequiresBallPickupCheck = (weather: Weather): boolean => {
    return weather === Weather.RAIN || weather === Weather.BLIZZARD;
};

/** Attempt to pick up the ball in bad weather. Returns true on success. */
export const resolveBallPickup = (player: Player, weather: Weather): { success: boolean; log: string } => {
    if (!weatherRequiresBallPickupCheck(weather)) {
        return { success: true, log: '' };
    }
    const difficulty = weather === Weather.BLIZZARD ? 4 : 3;
    const roll = rollDice(6) + player.stats.skill;
    if (roll >= difficulty) {
        return { success: true, log: `${player.name} scoops up the slippery ball! (Roll: ${roll} vs DC: ${difficulty})` };
    }
    return { success: false, log: `${player.name} fumbles the wet ball! (Roll: ${roll} vs DC: ${difficulty})` };
};

// --- Ice slide mechanic ---

/** On ice terrain, after moving the player slides 1 extra tile in the same direction. */
export const resolveIceSlide = (
    from: Position,
    to: Position,
    allPlayers: Player[]
): Position | null => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const slidePos = { x: to.x + dx, y: to.y + dy };

    if (isPositionValid(slidePos) && !getPlayerAtPosition(slidePos, allPlayers)) {
        return slidePos;
    }
    return null; // Blocked or off-board
};

// --- Lava hazard mechanic ---

/** Generate random lava hazard positions for this turn. */
export const generateLavaHazards = (count: number = 3): Position[] => {
    const hazards: Position[] = [];
    for (let i = 0; i < count; i++) {
        hazards.push({
            x: 1 + Math.floor(Math.random() * (BOARD_WIDTH - 2)),
            y: 1 + Math.floor(Math.random() * (BOARD_HEIGHT - 2)),
        });
    }
    return hazards;
};

/** Check if a player is on a lava hazard. Armor helps resist. */
export const resolveLavaHazard = (player: Player): { stunned: boolean; log: string } => {
    const difficulty = 4;
    const roll = rollDice(6) + Math.floor(player.stats.armor / 3);
    if (roll >= difficulty) {
        return { stunned: false, log: `${player.name} endures the scorching heat! (Roll: ${roll} vs DC: ${difficulty})` };
    }
    return { stunned: true, log: `${player.name} is burned by the lava! (Roll: ${roll} vs DC: ${difficulty})` };
};

// --- Meteor shower hazard ---

/** Generate random meteor strike positions. */
export const generateMeteorStrikes = (count: number = 2): Position[] => {
    const strikes: Position[] = [];
    for (let i = 0; i < count; i++) {
        strikes.push({
            x: Math.floor(Math.random() * BOARD_WIDTH),
            y: 1 + Math.floor(Math.random() * (BOARD_HEIGHT - 2)),
        });
    }
    return strikes;
};

/** Check if a player survives a meteor strike. Armor helps. */
export const resolveMeteorStrike = (player: Player): { stunned: boolean; log: string } => {
    const difficulty = 5;
    const roll = rollDice(6) + Math.floor(player.stats.armor / 3);
    if (roll >= difficulty) {
        return { stunned: false, log: `${player.name} dodges the meteor! (Roll: ${roll} vs DC: ${difficulty})` };
    }
    return { stunned: true, log: `${player.name} is struck by a meteor! (Roll: ${roll} vs DC: ${difficulty})` };
};

// --- Core Mechanics (now with terrain, weather, and armor) ---

export interface TackleResult {
    success: boolean;
    attackerInjured: boolean;
    furyGained: boolean;  // Berserker gains fury from combat
    log: string;
}

/** Check if an assassin is attacking "from behind" (closer to defender's endzone). */
export const isBackstab = (attacker: Player, defender: Player): boolean => {
    if (attacker.role !== PlayerRole.ASSASSIN) return false;
    // HOME scores at bottom (high y), AWAY scores at top (low y)
    if (defender.team === TeamSide.HOME) {
        return attacker.position.y > defender.position.y; // Attacking from behind (toward HOME endzone)
    }
    return attacker.position.y < defender.position.y; // Attacking from behind (toward AWAY endzone)
};

export const resolveTackle = (
    attacker: Player,
    defender: Player,
    terrain: TerrainType = TerrainType.GRASS,
    weather: Weather = Weather.CLEAR
): TackleResult => {
    const terrainMod = getTerrainTackleModifier(terrain);

    // Berserker fury: adds bonus strength from accumulated fury
    const furyBonus = attacker.role === PlayerRole.BERSERKER ? attacker.fury : 0;

    // Assassin backstab: +2 strength when attacking from behind
    const backstabBonus = isBackstab(attacker, defender) ? 2 : 0;

    const attackStr = attacker.stats.strength + terrainMod.attacker + furyBonus + backstabBonus;
    const defendStr = defender.stats.strength + terrainMod.defender;

    const attackRoll = rollDice(6) + attackStr;
    const defendRoll = rollDice(6) + defendStr;

    // Build modifier label for log
    const modifiers: string[] = [];
    if (furyBonus > 0) modifiers.push(`Fury +${furyBonus}`);
    if (backstabBonus > 0) modifiers.push('Backstab +2');
    const modLabel = modifiers.length > 0 ? ` [${modifiers.join(', ')}]` : '';

    // Berserker gains fury from ANY tackle (win or lose), capped at 3
    const canGainFury = attacker.role === PlayerRole.BERSERKER && attacker.fury < 3;

    if (attackRoll > defendRoll) {
        return {
            success: true,
            attackerInjured: false,
            furyGained: canGainFury,
            log: `${attacker.name} smashed ${defender.name}${modLabel} (Roll: ${attackRoll} vs ${defendRoll})!`,
        };
    }

    // Failed tackle — armor check for attacker injury
    const injuryRoll = rollDice(6);
    const armorThreshold = Math.max(1, defender.stats.armor - 6);
    const attackerInjured = injuryRoll <= armorThreshold;

    let log = `${attacker.name} bounced off ${defender.name}${modLabel} (Roll: ${attackRoll} vs ${defendRoll})!`;
    if (attackerInjured) {
        log += ` ${attacker.name} is dazed from the impact!`;
    }
    if (canGainFury) {
        log += ` ${attacker.name}'s rage intensifies!`;
    }

    return { success: false, attackerInjured, furyGained: canGainFury, log };
};

export const resolvePass = (
    thrower: Player,
    targetPos: Position,
    terrain: TerrainType = TerrainType.GRASS,
    weather: Weather = Weather.CLEAR
): { success: boolean; log: string } => {
    const distance = Math.floor(Math.sqrt(
        Math.pow(targetPos.x - thrower.position.x, 2) +
        Math.pow(targetPos.y - thrower.position.y, 2)
    ));
    const terrainMod = getTerrainPassModifier(terrain);
    const weatherMod = getWeatherPassModifier(weather);
    const totalMod = terrainMod + weatherMod;

    const difficulty = 2 + distance;
    const roll = rollDice(6) + thrower.stats.skill + totalMod;

    const modLabel = totalMod !== 0 ? ` [${totalMod > 0 ? '+' : ''}${totalMod} conditions]` : '';

    if (roll >= difficulty) {
        return { success: true, log: `${thrower.name} throws a perfect spiral!${modLabel} (Roll: ${roll} vs DC: ${difficulty})` };
    }
    return { success: false, log: `${thrower.name} fumbles the pass!${modLabel} (Roll: ${roll} vs DC: ${difficulty})` };
};

/** Calculate effective movement for a player factoring in terrain and weather. */
export const getEffectiveMovement = (baseMove: number, terrain: TerrainType, weather: Weather): number => {
    const weatherMod = getWeatherMovementModifier(weather);
    const effective = baseMove + weatherMod;
    return Math.max(1, effective);
};
