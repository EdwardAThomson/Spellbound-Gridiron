import { GameState, TeamSide } from '../types';

export const GAME_RULES = `
[GAME RULES]
Title: Spellbound Gridiron
Premise: A 5v5 turn-based fantasy sports game played on a grid.
Objective: Move the ball carrier into the opponent's endzone (the last row) to score 7 points.

Winning: The match ends when a team reaches 21 points (3 touchdowns), or after 16 turns, whichever comes first. The higher score wins; a tie is a draw.

Mechanics:
- Movement: Units move one square at a time to any of the 8 adjacent tiles (orthogonal or diagonal). 1 square = 1 Move point.
- Ball pickup: Moving onto the loose ball's tile picks it up automatically (no roll).
- Tackling: Moving into an opponent initiates a tackle.
  - Strength vs Strength check (STR + d6 each).
  - Success: Defender is Stunned (cannot act next turn) and drops the ball.
  - Failure: Attacker loses turn.
- Passing: A unit with the ball can throw it to a target tile.
  - Skill check: the thrower rolls SKL + d6 and must meet a difficulty of 2 + Manhattan distance to the target tile.
  - Success: Caught by unit at target or lands on ground.
  - Failure: Ball scatters randomly.
- Magic: Wizards can use Mana to cast spells. Range is the Manhattan distance from the caster and is enforced:
  - Fireball: Range 4, Cost 3. Stuns an enemy target.
  - Blink: Range 5, Cost 4. Teleport to an empty target tile.
  - Revitalize: Range 1, Cost 2. Remove Stun from a stunned ally.
- Terrain: The chosen pitch changes how movement resolves.
  - Grass (Elven Fields): standard footing, no effect.
  - Mud (Orc Pits): each step risks a slip - a failed step drops the unit prone (Stunned) where it lands, dropping the ball.
  - Lava (Demon Forge): a fixed set of glowing hazard tiles is seeded at kickoff; stepping onto one knocks the unit down (Stunned).
  - Ice (Frozen Wastes): a step slides one extra tile in the same direction when that tile is open.
- Weather: The sky changes the odds each match.
  - Clear: no penalty.
  - Rain: wet ball - pass difficulty +1.
  - Blizzard: driving snow - pass difficulty +2, and every player suffers -1 Move (each unit gets one fewer square per turn, minimum 1).
  - Meteor Shower: a meteor tile is telegraphed one full round, then strikes it, knocking down anyone standing there and jarring the ball loose.
- Stats:
  - STR (Strength): Combat/Tackling.
  - SKL (Skill): Passing/Catching.
  - MOV (Move): Squares per turn.
  - ARM (Armor): Resistance to injury (flavor only for now).
- Progression: Players earn XP from their plays and level up (max level 5). Each level grants one small, role-capped stat bump.
  - XP awards: successful tackle +2, completed pass +2, spell cast +1, touchdown +5.
  - Level thresholds (cumulative XP): Level 2 at 5, Level 3 at 12, Level 4 at 21, Level 5 at 32.
`;

export function serializeGameState(state: GameState): string {
    const {
        turn,
        currentTeam,
        homeTeam,
        awayTeam,
        weather,
        terrain,
        hazards,
        meteor,
        ballPosition,
        gameLog
    } = state;

    // Summarize Score
    const scoreSummary = `Score: ${homeTeam.name} (${homeTeam.race}) ${homeTeam.score} - ${awayTeam.score} ${awayTeam.name} (${awayTeam.race})`;

    // Summarize Status
    const statusSummary = `Turn: ${turn} | Weather: ${weather} | Terrain: ${terrain} | Current Team: ${currentTeam}`;

    // Ball Location
    const ballSummary = ballPosition
        ? `Ball is on the ground at (${ballPosition.x}, ${ballPosition.y})`
        : `Ball is held by a player.`;

    // Active environmental hazards (lava tiles, telegraphed meteor).
    const hazardSummary = hazards && hazards.length > 0
        ? `Lava hazard tiles: ${hazards.map(h => `(${h.x}, ${h.y})`).join(', ')}`
        : `No terrain hazards active.`;
    const meteorSummary = meteor
        ? `A meteor is telegraphed to strike (${meteor.target.x}, ${meteor.target.y}) next round.`
        : `No meteor incoming.`;

    // Recent Logs (Last 10)
    const recentLogs = gameLog.slice(-10).map(log => `- ${log}`).join('\n');

    // Construct Context Block
    return `
${GAME_RULES}

[CURRENT GAME STATE]
${scoreSummary}
${statusSummary}
${ballSummary}
${hazardSummary}
${meteorSummary}

[RECENT EVENTS]
${recentLogs}
`;
}
