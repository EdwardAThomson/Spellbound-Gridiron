# Roadmap

Spellbound Gridiron is broadly inspired by Blood Bowl, but with our own twist. This document tracks planned features. Items are grouped by theme, not by release date.

## Known issues (from code review, 2026-08-09)

All six resolved in Task 1 (2026-08-10).

- [x] **Cloud API keys never reach the game engine.** Fixed: `ApiKeysProvider` now wraps `<App />` in `index.tsx`, so `App`'s `useContext(ApiKeysContext)` sees the real keys.
- [x] **Commentary uses stale state and fires once per log line.** Fixed: `addLog` only appends; the log lines from an action are batched and flushed as a single `generateCommentary` request on the next tick, reading fresh post-action state via a ref.
- [x] **The game never ends.** Fixed: `checkWinner` (`services/rules.ts`) ends the match at 21 points or after 16 turns; `App` wires it into the touchdown and end-of-turn paths and shows an input-blocking end-of-game screen with a New Game button.
- [x] **Spell ranges are not enforced.** Fixed: `validateSpellCast` (`services/rules.ts`) enforces Manhattan range and target validity (Fireball hits an enemy only, Blink lands on an empty on-board tile only, Revitalize clears a stunned ally only). `handleCastSpell` rejects invalid casts before spending mana.
- [x] **Rules sent to the LLM do not match the code.** Fixed: settled on diagonal (king's-move) movement and `2 + manhattan_distance` pass difficulty; `resolvePass`, `GAME_RULES`, and CLAUDE.md are now in sync.
- [x] **Minor cleanups.** Fixed: `TELEPORT` now copies the target position instead of mutating `player.position`; automatic (roll-free) ball pickup is confirmed intentional and documented in `GAME_RULES`.

## Match variety

- [x] **Terrain effects.** Wired into movement in `services/rules.ts` (rng-injected, unit-tested) and applied in `App`'s `handleMove`. Terrain is chosen on the start screen and mirrored in `GAME_RULES`, the rulebook, and the README. (Task 4, 2026-08-10)
  - Mud (Orc Pits): each step risks a slip that drops the unit prone (Stunned) and spills the ball.
  - Lava (Demon Forge): seeded hazard tiles (⚠️ telegraph) knock down anyone stepping on them.
  - Ice (Frozen Wastes): a step slides one extra tile in the travel direction when that tile is open.
- [ ] **Additional pitch types** beyond the four existing ones (e.g. arena variants, themed home pitches per race).
- [x] **Weather effects.** Wired in Task 4. Rain (+1) and Blizzard (+2) raise pass difficulty (`weatherPassModifier`); Meteor Shower telegraphs a tile one round (☄️) then strikes it, knocking down whoever stands there and spilling the ball. Weather is chosen on the start screen and mirrored across `GAME_RULES`, the rulebook, and the README. (2026-08-10)

## Player development

- [x] **XP and progression.** Done (2026-08-10): players earn XP from tackles, completions, spell casts, and touchdowns (`XP_AWARDS` in `services/rules.ts`); XP and level show on the unit card and survive save/load.
- [ ] **Skill unlocks.** New skills purchasable / rolled on level-up. Skill catalog needed.
- [x] **Stat modifiers.** Done (2026-08-10): level-ups grant a stat bump from the role's growth list, capped at `MAX_STAT_BUMP` above base (`applyLevelBump` in `services/rules.ts`).
- [ ] **Injuries / persistence.** Carry injury state across matches (required for campaign play).

## Campaign mode

- [x] **League mode.** Done (2026-08-10) as Campaign on the main menu: a 4-club double round-robin season (12 fixtures, 3-1-0 table) in `services/campaign.ts`. You play your own fixtures against the computer opponent; computer-vs-computer fixtures are simulated instantly with seeded, reproducible results. The season saves to localStorage.
- [ ] **Per-club campaign rosters.** Campaign matches currently reuse the same two global roster slots as Quick Play, so each opponent fields the previous opponent's players and a Quick Play rematch overwrites the campaign squad's XP. Each club should carry its own roster inside the campaign save.
- [ ] **Tournament mode.** Bracketed knockout play.
- [x] **Persistent rosters.** Done (2026-08-10): finished rosters (XP, levels, stat bumps) persist to localStorage (`services/roster.ts`) and the post-game Rematch button fields the same veterans; corrupt or missing data falls back to fresh teams.
- [ ] **Player trading / transfers.** Move players between teams (campaign-only; needs persistence first).

## Modes & controls

- [x] **Main menu.** Quick Play / Campaign / Tutorial / Settings, reachable again from inside a match and from the game-over screen. (2026-08-10)
- [x] **Computer opponent.** Rules-based, LLM-free turn planner (`services/opponent.ts`); Quick Play offers Hotseat or Computer. (2026-08-10)
- [x] **Tutorial and Help.** A guided coachmark tutorial (`services/tutorial.ts`) and an in-game Help with Controls and How-to-play. (2026-08-10)
- [x] **Click-to-move.** Clicking a reachable tile walks the unit along the shortest path, with animated tokens. (2026-08-10)
- [x] **Deterministic commentary.** Match commentary is drawn from event pools (`services/commentary.ts`) instead of an LLM. (2026-08-11)

## World

- [ ] **World map screen.** Overworld view with town names — each team is based in a town. Likely a later addition; depends on having campaign persistence to give towns meaning.

## Notes

- We are not trying to clone Blood Bowl. Where we borrow a concept (turnovers, dodge rolls, skill trees), we should look for a twist that fits the magic / fantasy-football tone of Spellbound Gridiron.
- Order within a section roughly reflects dependency, not priority. Per-club campaign rosters unblock injuries and transfers, and skill unlocks build on the between-games level-ups.
