import { Position, Player, GameState, TeamSide, BOARD_WIDTH, BOARD_HEIGHT, PlayerRole, TerrainType, Weather } from "../types";
import { ROLE_STATS } from "../constants";

export const INITIAL_MANA = 5;

export const createPlayer = (
  id: string,
  name: string,
  role: PlayerRole,
  team: TeamSide,
  x: number,
  y: number
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
    log: string;
}

export const resolveTackle = (
    attacker: Player,
    defender: Player,
    terrain: TerrainType = TerrainType.GRASS,
    weather: Weather = Weather.CLEAR
): TackleResult => {
    const terrainMod = getTerrainTackleModifier(terrain);
    const attackRoll = rollDice(6) + attacker.stats.strength + terrainMod.attacker;
    const defendRoll = rollDice(6) + defender.stats.strength + terrainMod.defender;

    // Armor: on a failed tackle, check if attacker gets injured (stunned)
    if (attackRoll > defendRoll) {
        return {
            success: true,
            attackerInjured: false,
            log: `${attacker.name} smashed ${defender.name} (Roll: ${attackRoll} vs ${defendRoll})!`,
        };
    }

    // Failed tackle — armor check for attacker injury
    const injuryRoll = rollDice(6);
    const armorThreshold = Math.max(1, defender.stats.armor - 6); // High armor = more likely to hurt attacker
    const attackerInjured = injuryRoll <= armorThreshold;

    let log = `${attacker.name} bounced off ${defender.name} (Roll: ${attackRoll} vs ${defendRoll})!`;
    if (attackerInjured) {
        log += ` ${attacker.name} is dazed from the impact!`;
    }

    return { success: false, attackerInjured, log };
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
