import { Position, Player, GameState, TeamSide, BOARD_WIDTH, BOARD_HEIGHT, PlayerRole } from "../types";
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
  return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y); // Manhattan distance
};

export const isAdjacent = (p1: Position, p2: Position): boolean => {
    const dx = Math.abs(p1.x - p2.x);
    const dy = Math.abs(p1.y - p2.y);
    return dx <= 1 && dy <= 1 && (dx + dy > 0); // Include diagonals
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

export const resolveTackle = (attacker: Player, defender: Player): { success: boolean, log: string } => {
    const attackRoll = rollDice(6) + attacker.stats.strength;
    const defendRoll = rollDice(6) + defender.stats.strength;
    
    if (attackRoll > defendRoll) {
        return { success: true, log: `${attacker.name} smashed ${defender.name} (Roll: ${attackRoll} vs ${defendRoll})!` };
    } else {
        return { success: false, log: `${attacker.name} bounced off ${defender.name} (Roll: ${attackRoll} vs ${defendRoll})!` };
    }
};

export const resolvePass = (thrower: Player, targetPos: Position): { success: boolean, log: string } => {
    const distance = Math.floor(Math.sqrt(Math.pow(targetPos.x - thrower.position.x, 2) + Math.pow(targetPos.y - thrower.position.y, 2)));
    const difficulty = 2 + distance;
    const roll = rollDice(6) + thrower.stats.skill;

    if (roll >= difficulty) {
         return { success: true, log: `${thrower.name} throws a perfect spiral! (Roll: ${roll} vs DC: ${difficulty})` };
    } else {
         return { success: false, log: `${thrower.name} fumbles the pass! (Roll: ${roll} vs DC: ${difficulty})` };
    }
};
