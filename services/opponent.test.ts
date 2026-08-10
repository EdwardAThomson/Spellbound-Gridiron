import { describe, it, expect } from 'vitest';
import {
  planOpponentTurn,
  attackingEndzoneY,
  forwardProgress,
  MAX_OPPONENT_ACTIONS,
  OpponentAction,
} from './opponent';
import { seededRng } from './rules';
import {
  GameState, Player, PlayerRole, TeamSide, TeamData, TerrainType, Weather,
  Position, BOARD_HEIGHT,
} from '../types';
import { ROLE_STATS, SPELLS } from '../constants';

// --- builders --------------------------------------------------------------

let pid = 0;
const mkPlayer = (over: Partial<Player> = {}): Player => {
  const role = over.role ?? PlayerRole.LINEMAN;
  const base = ROLE_STATS[role];
  return {
    id: over.id ?? `p${pid++}`,
    name: over.name ?? 'Unit',
    role,
    team: over.team ?? TeamSide.AWAY,
    position: over.position ?? { x: 6, y: 9 },
    stats: over.stats ?? { ...base },
    hasBall: over.hasBall ?? false,
    isStunned: over.isStunned ?? false,
    movesRemaining: over.movesRemaining ?? base.move,
    actionTaken: over.actionTaken ?? false,
    mana: over.mana ?? (role === PlayerRole.WIZARD ? 5 : 0),
    xp: over.xp ?? 0,
    level: over.level ?? 1,
  };
};

const mkTeam = (players: Player[], over: Partial<TeamData> = {}): TeamData => ({
  name: over.name ?? 'Team',
  race: over.race ?? 'Folk',
  color: over.color ?? 'red',
  players,
  score: over.score ?? 0,
});

const mkState = (over: Partial<GameState> = {}): GameState => ({
  turn: 1,
  currentTeam: TeamSide.AWAY,
  homeTeam: over.homeTeam ?? mkTeam([]),
  awayTeam: over.awayTeam ?? mkTeam([]),
  selectedPlayerId: null,
  ballPosition: over.ballPosition ?? null,
  boardWidth: 12,
  boardHeight: BOARD_HEIGHT,
  terrain: over.terrain ?? TerrainType.GRASS,
  weather: over.weather ?? Weather.CLEAR,
  hazards: over.hazards ?? [],
  meteor: over.meteor ?? null,
  gameLog: [],
  commentary: '',
  isGameOver: false,
  winner: null,
  ...over,
});

const rng = () => seededRng(12345);

const last = (as: OpponentAction[]) => as[as.length - 1];
const firstReal = (as: OpponentAction[]) => as.find((a) => a.type !== 'pass-turn');

// Every plan, whatever the board, must be a terminating turn: it ends in a
// single pass-turn and never exceeds the hard cap.
const expectTerminates = (as: OpponentAction[]) => {
  expect(as.length).toBeGreaterThan(0);
  expect(as.length).toBeLessThanOrEqual(MAX_OPPONENT_ACTIONS);
  expect(last(as).type).toBe('pass-turn');
  expect(as.filter((a) => a.type === 'pass-turn')).toHaveLength(1);
};

// --- tests -----------------------------------------------------------------

describe('planOpponentTurn: terminating turns', () => {
  it('with no players at all, still emits a legal terminating pass-turn', () => {
    const plan = planOpponentTurn(mkState(), rng(), TeamSide.AWAY);
    expect(plan).toHaveLength(1);
    expect(plan[0].type).toBe('pass-turn');
  });

  it('when every unit is stunned there is no legal action, so it just passes the turn', () => {
    const away = mkTeam([
      mkPlayer({ id: 'a1', isStunned: true }),
      mkPlayer({ id: 'a2', isStunned: true, position: { x: 4, y: 9 } }),
    ]);
    const plan = planOpponentTurn(mkState({ awayTeam: away }), rng(), TeamSide.AWAY);
    expect(plan).toHaveLength(1);
    expect(plan[0].type).toBe('pass-turn');
  });

  it('a fully boxed-in unit (blocked on every reachable tile, no enemy) yields no move', () => {
    // A1 sits in the corner with its only three neighbours occupied by allies
    // that have already acted; it is blocked with no legal move and no foe to
    // hit, so the whole plan is a single pass-turn.
    const away = mkTeam([
      mkPlayer({ id: 'a1', position: { x: 0, y: 0 }, movesRemaining: 4 }),
      mkPlayer({ id: 'b1', position: { x: 1, y: 0 }, actionTaken: true }),
      mkPlayer({ id: 'b2', position: { x: 0, y: 1 }, actionTaken: true }),
      mkPlayer({ id: 'b3', position: { x: 1, y: 1 }, actionTaken: true }),
    ]);
    const plan = planOpponentTurn(mkState({ awayTeam: away }), rng(), TeamSide.AWAY);
    expect(plan).toHaveLength(1);
    expect(plan[0].type).toBe('pass-turn');
  });

  it('never exceeds the hard action cap and always ends with pass-turn', () => {
    const away = mkTeam(
      Array.from({ length: 5 }, (_, i) =>
        mkPlayer({ id: `a${i}`, position: { x: 2 + i * 2, y: 9 } })
      )
    );
    const plan = planOpponentTurn(mkState({ awayTeam: away }), rng(), TeamSide.AWAY);
    expectTerminates(plan);
  });
});

describe('planOpponentTurn: the loose ball', () => {
  it('sends the nearest unit to chase and pick up the loose ball', () => {
    const away = mkTeam([mkPlayer({ id: 'a1', role: PlayerRole.CATCHER, position: { x: 5, y: 9 } })]);
    const ball: Position = { x: 5, y: 6 };
    const plan = planOpponentTurn(mkState({ awayTeam: away, ballPosition: ball }), rng(), TeamSide.AWAY);
    const move = firstReal(plan);
    expect(move?.type).toBe('move');
    // A Catcher (move 8) reaches the loose ball this turn, so it steps onto it.
    expect((move as any).to).toEqual(ball);
    expectTerminates(plan);
  });

  it('only one unit is sent after the loose ball, not the whole squad', () => {
    const away = mkTeam([
      mkPlayer({ id: 'a1', position: { x: 5, y: 9 } }),
      mkPlayer({ id: 'a2', position: { x: 7, y: 9 } }),
      mkPlayer({ id: 'a3', position: { x: 3, y: 9 } }),
    ]);
    const ball: Position = { x: 5, y: 6 };
    const plan = planOpponentTurn(mkState({ awayTeam: away, ballPosition: ball }), rng(), TeamSide.AWAY);
    // Exactly one unit heads for the ball tile; the others do their own thing.
    const towardBall = plan.filter(
      (a) => a.type === 'move' && (a as any).to.x === ball.x && (a as any).to.y === ball.y
    );
    expect(towardBall.length).toBeLessThanOrEqual(1);
    expectTerminates(plan);
  });
});

describe('planOpponentTurn: carrying the ball', () => {
  it('drives the carrier toward the attacking endzone, never its own endzone', () => {
    // AWAY attacks the top (y = 0); its own endzone is the bottom (y = 17).
    const carrier = mkPlayer({ id: 'a1', role: PlayerRole.BLITZER, position: { x: 5, y: 9 }, hasBall: true });
    const away = mkTeam([carrier]);
    const plan = planOpponentTurn(mkState({ awayTeam: away }), rng(), TeamSide.AWAY);
    const move = firstReal(plan);
    expect(move?.type).toBe('move');
    const to = (move as any).to as Position;
    expect(to.y).toBeLessThan(carrier.position.y); // toward y=0, away from own endzone
    expect(forwardProgress(TeamSide.AWAY, to)).toBeGreaterThan(
      forwardProgress(TeamSide.AWAY, carrier.position)
    );
    expectTerminates(plan);
  });

  it('a HOME carrier drives the other way, toward the bottom endzone', () => {
    const carrier = mkPlayer({ id: 'h1', team: TeamSide.HOME, role: PlayerRole.BLITZER, position: { x: 5, y: 8 }, hasBall: true });
    const home = mkTeam([carrier]);
    const plan = planOpponentTurn(mkState({ homeTeam: home, currentTeam: TeamSide.HOME }), rng(), TeamSide.HOME);
    const move = firstReal(plan);
    expect((move as any).to.y).toBeGreaterThan(carrier.position.y);
    expect(attackingEndzoneY(TeamSide.HOME)).toBe(BOARD_HEIGHT - 1);
    expectTerminates(plan);
  });

  it('a boxed-in carrier throws a sensible forward pass to a team-mate in range', () => {
    // Carrier has only one move point and its three forward tiles are walled off
    // by enemies, so it cannot advance; a team-mate stands well upfield within a
    // beatable pass, so the carrier throws instead of stalling.
    const carrier = mkPlayer({ id: 'a1', role: PlayerRole.QUARTERBACK, position: { x: 5, y: 9 }, hasBall: true, movesRemaining: 1 });
    const receiver = mkPlayer({ id: 'a2', role: PlayerRole.CATCHER, position: { x: 5, y: 4 } });
    const away = mkTeam([carrier, receiver]);
    const wall = mkTeam([
      mkPlayer({ id: 'h1', team: TeamSide.HOME, position: { x: 4, y: 8 } }),
      mkPlayer({ id: 'h2', team: TeamSide.HOME, position: { x: 5, y: 8 } }),
      mkPlayer({ id: 'h3', team: TeamSide.HOME, position: { x: 6, y: 8 } }),
    ]);
    const plan = planOpponentTurn(mkState({ awayTeam: away, homeTeam: wall }), rng(), TeamSide.AWAY);
    const pass = plan.find((a) => a.type === 'pass');
    expect(pass).toBeDefined();
    expect((pass as any).targetId).toBe('a2');
    expectTerminates(plan);
  });
});

describe('planOpponentTurn: tackling', () => {
  it('throws a favourable block at an adjacent weaker enemy', () => {
    const attacker = mkPlayer({ id: 'a1', role: PlayerRole.LINEMAN, position: { x: 5, y: 9 } }); // STR 4
    const away = mkTeam([attacker]);
    const weak = mkPlayer({ id: 'h1', team: TeamSide.HOME, role: PlayerRole.CATCHER, position: { x: 5, y: 8 } }); // STR 2
    const home = mkTeam([weak]);
    const plan = planOpponentTurn(mkState({ awayTeam: away, homeTeam: home }), rng(), TeamSide.AWAY);
    const tackle = plan.find((a) => a.type === 'tackle');
    expect(tackle).toBeDefined();
    expect((tackle as any).targetId).toBe('h1');
    expectTerminates(plan);
  });

  it('does not throw an unfavourable block at a stronger, non-carrier enemy', () => {
    const attacker = mkPlayer({ id: 'a1', role: PlayerRole.CATCHER, position: { x: 5, y: 9 }, stats: { move: 8, strength: 2, skill: 4, armor: 7 } });
    const away = mkTeam([attacker]);
    const strong = mkPlayer({ id: 'h1', team: TeamSide.HOME, role: PlayerRole.LINEMAN, position: { x: 5, y: 8 } }); // STR 4, no ball
    const home = mkTeam([strong]);
    const plan = planOpponentTurn(mkState({ awayTeam: away, homeTeam: home }), rng(), TeamSide.AWAY);
    expect(plan.some((a) => a.type === 'tackle')).toBe(false);
    expectTerminates(plan);
  });

  it('always hits the enemy ball carrier even against the odds, to jar the ball loose', () => {
    const attacker = mkPlayer({ id: 'a1', role: PlayerRole.CATCHER, position: { x: 5, y: 9 }, stats: { move: 8, strength: 2, skill: 4, armor: 7 } });
    const away = mkTeam([attacker]);
    const carrier = mkPlayer({ id: 'h1', team: TeamSide.HOME, role: PlayerRole.LINEMAN, position: { x: 5, y: 8 }, hasBall: true });
    const home = mkTeam([carrier]);
    const plan = planOpponentTurn(mkState({ awayTeam: away, homeTeam: home }), rng(), TeamSide.AWAY);
    const tackle = plan.find((a) => a.type === 'tackle');
    expect((tackle as any)?.targetId).toBe('h1');
    expectTerminates(plan);
  });
});

describe('planOpponentTurn: the Wizard', () => {
  it('spends mana to fireball an enemy in range', () => {
    const wiz = mkPlayer({ id: 'a1', role: PlayerRole.WIZARD, position: { x: 5, y: 9 }, mana: 5 });
    const away = mkTeam([wiz]);
    const foe = mkPlayer({ id: 'h1', team: TeamSide.HOME, position: { x: 5, y: 7 } }); // manhattan 2 <= range 4
    const home = mkTeam([foe]);
    const plan = planOpponentTurn(mkState({ awayTeam: away, homeTeam: home }), rng(), TeamSide.AWAY);
    const spell = plan.find((a) => a.type === 'spell');
    expect(spell).toBeDefined();
    expect((spell as any).spell).toBe('FIREBALL');
    expect((spell as any).targetId).toBe('h1');
    expectTerminates(plan);
  });

  it('with zero mana casts nothing and falls back to ordinary play', () => {
    const wiz = mkPlayer({ id: 'a1', role: PlayerRole.WIZARD, position: { x: 5, y: 9 }, mana: 0 });
    const away = mkTeam([wiz]);
    const foe = mkPlayer({ id: 'h1', team: TeamSide.HOME, position: { x: 5, y: 7 } });
    const home = mkTeam([foe]);
    const plan = planOpponentTurn(mkState({ awayTeam: away, homeTeam: home }), rng(), TeamSide.AWAY);
    expect(plan.some((a) => a.type === 'spell')).toBe(false);
    expectTerminates(plan);
  });

  it('revitalizes an adjacent stunned ally when it has the mana', () => {
    const wiz = mkPlayer({ id: 'a1', role: PlayerRole.WIZARD, position: { x: 5, y: 9 }, mana: SPELLS.HEAL.cost });
    const downed = mkPlayer({ id: 'a2', position: { x: 5, y: 8 }, isStunned: true });
    const away = mkTeam([wiz, downed]);
    const plan = planOpponentTurn(mkState({ awayTeam: away }), rng(), TeamSide.AWAY);
    const spell = plan.find((a) => a.type === 'spell');
    expect((spell as any)?.spell).toBe('HEAL');
    expect((spell as any)?.targetId).toBe('a2');
    expectTerminates(plan);
  });
});

describe('planOpponentTurn: terrain avoidance & determinism', () => {
  it('steers a move off a lava hazard tile when a safe tile of equal value exists', () => {
    // One move point: the three forward tiles are all equally good, but (5,8) is
    // a lava hazard, so the planner should pick a different one.
    const carrier = mkPlayer({ id: 'a1', role: PlayerRole.BLITZER, position: { x: 5, y: 9 }, hasBall: true, movesRemaining: 1 });
    const away = mkTeam([carrier]);
    const state = mkState({
      awayTeam: away,
      terrain: TerrainType.LAVA,
      hazards: [{ x: 5, y: 8 }],
    });
    const plan = planOpponentTurn(state, rng(), TeamSide.AWAY);
    const move = firstReal(plan);
    expect(move?.type).toBe('move');
    const to = (move as any).to as Position;
    expect(to).not.toEqual({ x: 5, y: 8 });
    expect(to.y).toBe(8); // still advanced, just around the hazard
    expectTerminates(plan);
  });

  it('is deterministic: the same state and seed produce an identical plan', () => {
    const build = () =>
      mkState({
        awayTeam: mkTeam([
          mkPlayer({ id: 'a1', role: PlayerRole.BLITZER, position: { x: 4, y: 9 }, hasBall: true }),
          mkPlayer({ id: 'a2', role: PlayerRole.WIZARD, position: { x: 8, y: 9 }, mana: 5 }),
          mkPlayer({ id: 'a3', role: PlayerRole.LINEMAN, position: { x: 6, y: 10 } }),
        ]),
        homeTeam: mkTeam([
          mkPlayer({ id: 'h1', team: TeamSide.HOME, position: { x: 6, y: 8 } }),
          mkPlayer({ id: 'h2', team: TeamSide.HOME, role: PlayerRole.CATCHER, position: { x: 8, y: 8 } }),
        ]),
      });
    const a = planOpponentTurn(build(), seededRng(999), TeamSide.AWAY);
    const b = planOpponentTurn(build(), seededRng(999), TeamSide.AWAY);
    expect(a).toEqual(b);
    expectTerminates(a);
  });
});
