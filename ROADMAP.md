# Roadmap

Spellbound Gridiron is broadly inspired by Blood Bowl, but with our own twist. This document tracks planned features. Items are grouped by theme, not by release date.

## Known issues (from code review, 2026-08-09)

Ordered roughly by severity.

- [ ] **Cloud API keys never reach the game engine.** `App` reads `useContext(ApiKeysContext)` (`App.tsx`), but `ApiKeysProvider` is rendered inside App's own JSX, so App sits outside the provider and always sees empty default keys. Commentary and team-name generation fail for cloud providers regardless of Settings or `.env`. Fix: move the provider wrapper into `index.tsx`. (The chatbot works because `AiAssistantPanel` is inside the provider, which masks the bug.)
- [ ] **Commentary uses stale state and fires once per log line.** `addLog` calls `triggerCommentary`, which reads `gameState` from a stale closure, so the LLM sees the pre-action board. A single tackle emits 2-3 log lines, spawning that many concurrent LLM calls racing for the commentary slot and `isAiThinking`. Needs a design decision: debounce, or batch logs per action.
- [ ] **The game never ends.** `isGameOver` and `winner` exist in `GameState` but nothing sets them; touchdowns reset for kickoff forever. Decide on a win condition (turn limit or score cap) and wire it up.
- [ ] **Spell ranges are not enforced.** `SPELLS` defines ranges (Fireball 4, Blink 5, Revitalize 1) and the LLM is told about them, but `handleCastSpell` never checks distance or target validity: Fireball works across the map, Blink can land on an occupied tile, and Revitalize can clear an enemy's stun.
- [ ] **Rules sent to the LLM do not match the code.** `GAME_RULES` in `utils/contextSerializer.ts` says movement is orthogonal, but `isAdjacent` allows diagonals. Docs describe pass difficulty as `2 + manhattan_distance`, but `resolvePass` uses Euclidean distance. The assistant confidently tells players wrong rules; pick one behaviour and sync code, `GAME_RULES`, and CLAUDE.md.
- [ ] **Minor cleanups.** `TELEPORT` mutates `player.position` in place in `handleCastSpell` instead of copying; ball pickup is automatic with no roll (confirm whether intentional).

## Match variety

- [ ] **Terrain effects.** `TerrainType` (Mud / Lava / Ice) and `TERRAIN_CONFIG` are already defined in `constants.ts`, but only Grass behaves differently in practice. Wire each terrain into movement, tackle, and pass resolution in `services/gameUtils.ts`.
  - Mud (Orc Pits): movement penalty / risk of slipping.
  - Lava (Demon Forge): tile damage; possible hazard squares.
  - Ice (Frozen Wastes): slide on movement; reduced control.
- [ ] **Additional pitch types** beyond the four currently stubbed (e.g. arena variants, themed home pitches per race).
- [ ] **Weather effects.** `Weather` enum exists (Clear / Rain / Blizzard / Meteor Shower) but has no mechanical impact. Apply effects to passing accuracy, movement, and possibly random events (e.g. meteors as board hazards).

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
