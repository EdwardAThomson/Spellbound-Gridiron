# Spellbound Gridiron - Development Roadmap

> A turn-based tactical fantasy sports game.
> Last updated: April 2026

---

## Phase 0: Code Modernization & Bug Fixes -- DONE

Before adding features, stabilize and restructure the codebase.

### Architecture

- [x] **Extract game engine from App.tsx** - All game logic moved to
      `hooks/useGameEngine.ts`. App.tsx reduced from ~700 lines to ~70.
- [x] **Introduce a state machine for game flow** - `GamePhase` enum
      (`MAIN_MENU`, `TEAM_SELECT`, `PLAYING`, `HALFTIME`, `POST_GAME`)
      replaces ad-hoc boolean flags.
- [x] **Phase-based routing** - App.tsx routes between screens based on
      `GamePhase`. (Lightweight approach; no React Router needed yet.)
- [x] **Break up the monolith component** - Split into `GameScreen`,
      `MainMenu`, `TeamSelectScreen`, `HalftimeScreen`, `PostGameScreen`,
      plus `useGameEngine` hook.
- [x] **Data-driven team/roster system** - `TeamBlueprint` type and
      `TEAM_BLUEPRINTS` array in `constants.ts` define all 8 teams.

### Bug Fixes

- [x] **Fix direct state mutation in `handleCastSpell`** - Now creates
      a new object via spread instead of mutating `player.position`.
- [x] **Armor stat wired in** - Armor now affects tackle injury checks.
      High-armor defenders can stun attackers on failed tackles.

### Quality of Life

- [ ] **Add save/load game state** - Persist to `localStorage` so games
      survive page refreshes.
- [x] **Add unit tests** - 39 tests covering game utils: position logic,
      tackles, passes, terrain/weather modifiers, ice slide, lava hazards,
      effective movement, backstab, fury, wolf summon. Run with `npm test`.
- [x] **Type-safe spell system** - `SpellKey` enum replaces string keys.
- [x] **Removed stale `StartOverlay` component** - No longer used after
      main menu was added.

---

## Phase 1: Main Menu & Quick Play -- DONE

### Main Menu

- [x] **Main menu screen** - Title art, atmospheric background. Buttons:
  - Quick Play
  - Campaign / League (disabled, coming in Phase 5)
  - Settings (AI model configuration)
  - Rule Book
- [x] **Team selection screen** - Pick home and away teams from the
      8-team roster. Shows race, description, roster composition, and
      color-coded cards.

### Quick Play Flow

- [x] `Main Menu` -> `Select Home Team` -> `Select Away Team` ->
      `Game Board` (with AI team name generation in background)
- [x] **Post-game summary screen** - Shows "Full Time" result, final
      score, team MVPs, key play highlights. Options: rematch, main menu.
- [x] **Timed halves** - 2 halves of 8 turns each. Teams swap sides at
      halftime. Halftime screen shows score and "Start 2nd Half" button.
      Highest score at full time wins; draws are allowed.

---

## Phase 2: Expanded Rosters & Player Stats -- PARTIAL

### Teams (Done)

All 8 teams implemented with unique roster compositions. Current rosters
are 5v5. **Planned: expand to 7v7 on a wider 14x20 pitch** (see below).

| Team                 | Race          | 5v5 Roster                                     |
| -------------------- | ------------- | ---------------------------------------------- |
| Elven Vanguard       | High Elves    | 2x Catcher, QB, Assassin, Wizard               |
| Orc Bashers          | Dark Orcs     | Lineman, Berserker, 2x Blitzer, QB             |
| Undead Legion        | Undead        | 2x Lineman, Beastmaster, Blitzer, Wizard       |
| Dwarven Ironwall     | Dwarves       | 2x Lineman, Berserker, QB, Lineman             |
| Ratfolk Swarm        | Ratfolk       | 2x Catcher, Assassin, Blitzer, QB              |
| Demon Hellfire       | Demons        | 2x Wizard, Berserker, Lineman, QB              |
| Human Crusaders      | Humans        | Lineman, Blitzer, QB, Catcher, Beastmaster     |
| Lizardfolk Predators | Lizardfolk    | Beastmaster, Lineman, 2x Blitzer, Catcher      |

### Player Roles (Done)

8 roles implemented:

| Role        | MOV | STR | SKL | ARM | Special                                   |
| ----------- | --- | --- | --- | --- | ----------------------------------------- |
| Lineman     | 4   | 4   | 2   | 9   | Tank. No special ability.                 |
| Blitzer     | 6   | 3   | 3   | 8   | Balanced attacker.                        |
| Catcher     | 8   | 2   | 4   | 7   | Speed specialist.                         |
| Quarterback | 6   | 3   | 4   | 8   | Passer. High skill.                       |
| Wizard      | 5   | 2   | 3   | 7   | Fireball, Blink, Revitalize. 5 mana.     |
| Berserker   | 5   | 3   | 2   | 7   | Fury: +1 STR per tackle (max +3).         |
| Assassin    | 7   | 2   | 4   | 6   | Moves through units. Backstab: +2 STR.    |
| Beastmaster | 5   | 3   | 3   | 8   | Summon wolf companion (1x per game).      |

### Pitch Size Upgrade (Planned)

- [ ] **Expand default pitch to 14x20** for 7v7 matches.
      Blood Bowl uses 15x26 for 11v11 (~1.4 tiles/player width).
      14x20 gives ~2.0 tiles/player for 7v7 — good balance.
- [ ] **Expand each team roster to 7 players** — fill the 2 new slots
      with the new roles to differentiate team play styles further.
- [ ] Keep 12x18 / 5v5 available for smaller exotic maps.

### Stat Split (Planned)

**Decision: split `skill` into `passing` and `agility`.**

| Stat          | Purpose                                             |
| ------------- | --------------------------------------------------- |
| `move`        | Squares per turn (unchanged)                        |
| `strength`    | Tackle rolls (unchanged)                            |
| `passing`     | Accuracy on throws (replaces skill for passes)      |
| `agility`     | Dodge chance, ball pickup, evasion (replaces skill for defense) |
| `armor`       | Injury resistance on failed tackles, hazards (functional) |

- [ ] Implement stat split across `PlayerStats`, `ROLE_STATS`,
      `resolvePass`, `resolveBallPickup`, and all role definitions.

### Deferred

- Stamina / fatigue — revisit when campaign mode needs it.
- Player XP / leveling — design alongside campaign mode.

---

## Phase 3: Terrain & Exotic Maps -- PARTIAL

### Terrain Effects -- DONE

All 4 terrain types now have gameplay effects:

| Terrain        | Arena Name    | Gameplay Effect                          |
| -------------- | ------------- | ---------------------------------------- |
| Grass          | Elven Fields  | Standard. No modifiers.                  |
| Mud            | Orc Pits      | 2x movement cost per tile. Tackle +1 for defenders. |
| Lava           | Demon Forge   | Random hazard tiles each turn. Armor-based injury check. |
| Ice            | Frozen Wastes | Player slides 1 extra tile after moving. Passing -1. |

Terrain is randomly assigned at match start.

### Exotic / Special Maps (Planned)

**Decision: exotic maps are unlockable via campaign.** In Quick Play,
they appear as locked cards with a teaser description and "Unlock in
Campaign" label. Standard terrain maps are always available.

- [ ] **The Gauntlet** - Narrow 8-wide corridor map. No flanking room.
      Favors brute-force teams.
- [ ] **The Pit** - Circular arena. No endzones. Instead: hold the ball in
      center for 3 consecutive turns to score. King-of-the-hill mode.
- [ ] **The Maze** - Map with wall tiles that block movement and passing.
      Randomly generated each game.
- [ ] **Sky Bridge** - Floating platforms connected by bridges. Falling off
      the edge stuns the player and respawns them at their endzone.
- [ ] **Arcane Nexus** - Tiles grant mana when stepped on. All players can
      cast basic spells, not just Wizards. Magic-heavy game mode.

Each exotic map should define:
- Board dimensions (may differ from standard 14x20)
- Special tile types (walls, hazards, mana wells, bridges, voids)
- Win condition (may differ from touchdown)
- Teaser card shown in Quick Play when locked

---

## Phase 4: Weather System -- DONE

All weather types now have gameplay effects:

| Weather        | Effects                                                    |
| -------------- | ---------------------------------------------------------- |
| Clear          | No modifiers.                                              |
| Rain           | Passing -1. Ball pickup requires a skill check.            |
| Blizzard       | Movement -1. Passing -2.                                   |
| Meteor Shower  | Random meteor strikes each turn. Armor-based stun check.   |

- [x] Weather randomly assigned at match start.
- [x] Weather changes mid-match (every 4 turns + at halftime).
- [ ] Visual weather effects on the board (rain particles, snow, fire from
      sky, fog overlay).

Future weather types:
- [ ] **Fog** - Cannot see opponent positions beyond 3 tiles.
- [ ] **Arcane Storm** - All spell costs reduced by 1. Random magical
      effects each turn.

---

## Phase 5: Campaign / League Mode

The flagship long-term feature. A single-player campaign with progression.

### Fantasy World Map

- [ ] **Create a fantasy world map** - A stylized overworld with major towns
      and cities. Each town has a team. The player picks a starting team
      and travels the map, challenging other towns.
- [ ] Map rendered as an interactive node graph or illustrated map with
      clickable locations.

### League Structure

- [ ] **Season-based league** - Play a series of matches against other
      teams in a round-robin or bracket format.
- [ ] **Standings table** - Wins / losses / draws / points scored /
      points allowed. 3 pts for win, 1 for draw.
- [ ] **Playoffs & Championship** - Top teams qualify for a knockout
      bracket. **No draws in knockout rounds** — overtime / sudden death
      if tied at full time.

### Progression & Persistence

- [ ] **Player XP and leveling** - Players earn XP from matches. Level ups
      grant stat boosts or unlock new abilities.
- [ ] **Injuries carry over** - A player injured in one match may miss the
      next (ties into stamina/toughness stats from Phase 2).
- [ ] **Recruitment** - Between matches, recruit new players from a random
      pool. Manage your roster (bench / starting lineup).
- [ ] **Treasury / Economy** - Earn gold from wins. Spend on recruitment,
      healing injured players, or upgrading facilities.
- [ ] **Exotic map unlocks** - Beating certain teams or completing
      challenges unlocks exotic maps for Quick Play and Campaign.

### World Map Locations (Draft)

| Town              | Team                 | Terrain Home Field | Difficulty |
| ----------------- | -------------------- | ------------------ | ---------- |
| Silverwood        | Elven Vanguard       | Grass              | Easy       |
| Ironhammer Hold   | Dwarven Ironwall     | Mud                | Medium     |
| Bone Hollow       | Undead Legion        | Ice                | Medium     |
| Scorchpeak Caldera| Demon Hellfire       | Lava               | Hard       |
| Ratburrow Warrens | Ratfolk Swarm        | Maze (exotic)      | Hard       |
| Kingsbridge       | Human Crusaders      | Grass              | Medium     |
| Blackfang Kraal   | Orc Bashers          | Mud                | Medium     |
| Sunscale Marsh    | Lizardfolk Predators | Grass              | Easy       |

---

## Phase 6: Polish & Nice-to-Haves

- [ ] **Sound effects** - Tackle hits, spell casts, crowd cheers, touchdown
      fanfare.
- [ ] **Animations** - Smooth movement between tiles, tackle impact effects,
      spell particle effects.
- [ ] **Player portraits / sprites** - Per-race character art instead of
      generic tokens.
- [ ] **AI opponent** - Three modes:
  - **Heuristic AI** (JS-only) — fast, consistent, tunable difficulty.
  - **LLM AI** — creative/unpredictable, uses configured AI provider.
  - **Hybrid** — heuristic handles moves, LLM provides commentary and
    occasional surprise plays.
- [ ] **Multiplayer** - Hot-seat is already supported (pass-and-play). Online
      multiplayer would require a server rewrite.
- [ ] **Mobile-friendly layout** - The game somewhat works on mobile but
      needs touch-friendly controls and responsive board sizing.
- [ ] **Replay system** - Record and replay matches turn-by-turn.

---

## Resolved Questions

1. **Terrain + weather stacking** — Yes, they stack additively.
2. **Match length** — Timed halves: 2 x 8 turns. Highest score wins.
3. **AI opponent** — Offer all three: heuristic, LLM, and hybrid.
4. **Exotic maps** — Unlockable via campaign. Teased (locked) in Quick Play.
5. **Team size** — Upgrade to 7v7 on 14x20 pitch. Keep 5v5/12x18 for
   smaller exotic maps.
6. **Skill split** — Split into `passing` and `agility`.
7. **Stamina / fatigue** — Deferred. Revisit for campaign mode.
8. **Player XP** — Good idea, design alongside campaign mode.
9. **Draws** — Allowed in league play (3/1/0 points). No draws in
   knockout / cup rounds (overtime or sudden death).
