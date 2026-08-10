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
- [ ] **Additional pitch types** beyond the four currently stubbed (e.g. arena variants, themed home pitches per race).
- [x] **Weather effects.** Wired in Task 4. Rain (+1) and Blizzard (+2) raise pass difficulty (`weatherPassModifier`); Meteor Shower telegraphs a tile one round (☄️) then strikes it, knocking down whoever stands there and spilling the ball. Weather is chosen on the start screen and mirrored across `GAME_RULES`, the rulebook, and the README. (2026-08-10)

## Player development

- [ ] **XP and progression.** Players earn experience from match events (tackles, completions, touchdowns).
- [ ] **Skill unlocks.** New skills purchasable / rolled on level-up. Skill catalog needed.
- [ ] **Stat modifiers.** Permanent stat bumps on level-up (capped per role).
- [ ] **Injuries / persistence.** Carry injury state across matches (required for campaign play).

## Campaign mode

- [ ] **League mode.** Multi-match season with standings, scheduled fixtures, and a league table.
- [ ] **Tournament mode.** Bracketed knockout play.
- [ ] **Persistent rosters.** Save/load team state between matches (depends on player progression).
- [ ] **Player trading / transfers.** Move players between teams (campaign-only; needs persistence first).

## World

- [ ] **World map screen.** Overworld view with town names — each team is based in a town. Likely a later addition; depends on having campaign persistence to give towns meaning.

## Notes

- We are not trying to clone Blood Bowl. Where we borrow a concept (turnovers, dodge rolls, skill trees), we should look for a twist that fits the magic / fantasy-football tone of Spellbound Gridiron.
- Order within a section roughly reflects dependency, not priority. Terrain/weather are the most self-contained next steps because the data model already exists.
