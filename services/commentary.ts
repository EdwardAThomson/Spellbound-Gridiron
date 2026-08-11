import { Rng } from './rules';

// Deterministic crystal-ball commentary. The old path asked an LLM to narrate
// every action, which was the game's only per-action AI cost and needed keys.
// Commentary is pure flavor, so it is now generated locally: the batched log
// lines of an action are classified into an event kind and a line is drawn
// from that kind's pool with the injected rng. No network, no keys, no cost.

export type CommentaryKind =
  | 'touchdown'
  | 'tackle_hit'
  | 'tackle_miss'
  | 'pass_complete'
  | 'pass_fumble'
  | 'spell'
  | 'knockdown'
  | 'pickup'
  | 'level_up'
  | 'turn'
  | 'generic';

/**
 * Classify a batch of action log lines into the single most noteworthy event.
 * Order matters: a touchdown outranks the pickup that preceded it in the same
 * action, a landed tackle outranks the loose ball it caused, and so on.
 */
export const classifyAction = (lines: string[]): CommentaryKind => {
  const text = lines.join(' ');
  if (/TOUCHDOWN/i.test(text)) return 'touchdown';
  if (/reaches Level/i.test(text)) return 'level_up';
  if (/smashed/i.test(text)) return 'tackle_hit';
  if (/bounced off/i.test(text)) return 'tackle_miss';
  if (/perfect spiral|catches it/i.test(text)) return 'pass_complete';
  if (/fumbles the pass|Inaccurate pass/i.test(text)) return 'pass_fumble';
  if (/casts|fireball|blinks across|back in the fight/i.test(text)) return 'spell';
  if (/slips|molten|slides|knocked down|meteor/i.test(text)) return 'knockdown';
  if (/picked up the ball/i.test(text)) return 'pickup';
  if (/Turn Ending|turn/i.test(text)) return 'turn';
  return 'generic';
};

const LINES: Record<CommentaryKind, string[]> = {
  touchdown: [
    'TOUCHDOWN! The crystal ball is practically glowing!',
    'They\'re in! The crowd erupts and somewhere a goblin loses a bet!',
    'Across the line! That one will be replayed in scrying pools for weeks!',
    'Seven points! The endzone wards flare in celebration!',
  ],
  tackle_hit: [
    'Oh, that hit rattled the moons! Bones were involved.',
    'Flattened! You could hear that one from the cheap seats!',
    'A textbook takedown, if the textbook was written by an ogre!',
    'Down goes the runner! The turf took the worst of it!',
  ],
  tackle_miss: [
    'A big swing and a bigger miss! The defender just bounced off!',
    'Denied! That block had all the impact of a pillow!',
    'The tackle slides right off. Someone oiled that jersey, surely!',
    'Held! The would-be tackler is left hugging empty air!',
  ],
  pass_complete: [
    'A beautiful spiral! Threaded through like an elven needle!',
    'Caught! That throw bent the air itself!',
    'What a connection! Quarterback and catcher, telepathically linked!',
    'The ball sails true. Somewhere a wizard claps politely.',
  ],
  pass_fumble: [
    'Oh no, that pass had all the grace of a drunken griffin!',
    'Wobbled and dropped! The ball has a mind of its own today!',
    'Butterfingers! The crowd groans as the ball skitters loose!',
    'That throw was cursed, no other explanation!',
  ],
  spell: [
    'Magic crackles across the pitch! The referees pretend not to notice!',
    'A spell soars! Health and safety would have words, if any survived!',
    'Arcane fireworks! This is why we can\'t have nice stadiums!',
    'The wizard weaves! Reality politely steps aside!',
  ],
  knockdown: [
    'Down they go! The pitch itself claims another victim!',
    'The ground fights back! That looked expensive!',
    'A tumble! The healers are already stretching!',
    'Gravity: still undefeated this season!',
  ],
  pickup: [
    'Scooped! The loose ball finds a new owner!',
    'Possession claimed! Now the real running starts!',
    'The ball is snapped up! Smart hustle out there!',
  ],
  level_up: [
    'The league office confirms it: that one\'s going in the record books!',
    'Veterans are forged in matches like this one!',
    'Watch that name: a star is being minted before our eyes!',
  ],
  turn: [
    'The whistle turns the tide. Fresh legs, fresh schemes!',
    'Sides swap the initiative. The chess match continues!',
    'A new phase of play begins. The crystal ball refocuses!',
  ],
  generic: [
    'The battle for the gridiron rages on!',
    'Positioning, positioning! Matches are won in the quiet moves!',
    'The tension on the pitch is thick enough to chew!',
    'Both teams probing for a crack in the line!',
  ],
};

/**
 * One announcer line for a batch of action log lines: classify, then draw from
 * that kind's pool with the injected rng (seedable in tests, `Math.random` in
 * the live game).
 */
export const commentaryFor = (lines: string[], rng: Rng): string => {
  const pool = LINES[classifyAction(lines)];
  return pool[Math.floor(rng() * pool.length)];
};
