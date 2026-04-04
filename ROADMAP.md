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
      (`MAIN_MENU`, `TEAM_SELECT`, `PLAYING`, `POST_GAME`) replaces
      ad-hoc boolean flags.
- [x] **Phase-based routing** - App.tsx routes between screens based on
      `GamePhase`. (Lightweight approach; no React Router needed yet.)
- [x] **Break up the monolith component** - Split into `GameScreen`,
      `MainMenu`, `TeamSelectScreen`, plus `useGameEngine` hook.
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
- [x] **Add unit tests** - 29 tests covering game utils: position logic,
      tackles, passes, terrain/weather modifiers, ice slide, lava hazards,
      effective movement. Run with `npm test`.
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
- [ ] **Post-game summary screen** - Show final score, MVP player stats,
      key plays. Options: rematch, return to menu.

---

## Phase 2: Expanded Rosters & Player Stats -- PARTIAL

### More Teams

All 8 teams implemented with unique roster compositions:

| Team                 | Race          | Roster                                         |
| -------------------- | ------------- | ---------------------------------------------- |
| Elven Vanguard       | High Elves    | 2x Catcher, QB, Blitzer, Wizard                |
| Orc Bashers          | Dark Orcs     | 2x Lineman, 2x Blitzer, QB                     |
| Undead Legion        | Undead        | 3x Lineman, Blitzer, Wizard                    |
| Dwarven Ironwall     | Dwarves       | 3x Lineman, Blitzer, QB                        |
| Ratfolk Swarm         | Ratfolk       | 3x Catcher, Blitzer, QB                        |
| Demon Hellfire       | Demons        | 2x Wizard, Blitzer, Lineman, QB                |
| Human Crusaders      | Humans        | Lineman, Blitzer, QB, Catcher, Wizard           |
| Lizardfolk Predators | Lizardfolk    | 2x Lineman, 2x Blitzer, Catcher                |

### New Player Roles (Future)

- [ ] **Beastmaster** - Summons a temporary companion unit (e.g. wolf,
      skeleton) that occupies a tile and can tackle.
- [ ] **Assassin / Rogue** - Can move through occupied tiles. Low strength,
      high skill. Special ability: backstab (bonus tackle from behind).
- [ ] **Berserker** - Gets stronger as the match progresses (or when damaged).
      Fury mechanic.

### Revised Stats

Current stats: `move`, `strength`, `skill`, `armor`.
Armor is now functional (affects tackle injury checks).

Proposed additions:

| Stat          | Purpose                                                   |
| ------------- | --------------------------------------------------------- |
| **Agility**   | Dodge chance when tackled; ability to slip past defenders  |
| **Toughness** | Resistance to injury (replaces or works alongside armor)  |
| **Passing**   | Separate from general skill; accuracy on throws           |
| **Stamina**   | Limits total actions per game (not per turn) - fatigue     |

Stat revision decisions to make:
- [ ] Should `skill` split into `passing` and `agility`?
- [ ] Is a `stamina` / fatigue system worth the complexity? (More relevant
      for campaign mode where player health carries over between matches.)
- [ ] Add player **leveling / XP** for campaign mode?

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

### Exotic / Special Maps (Future)

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
- Board dimensions (may differ from standard 12x18)
- Special tile types (walls, hazards, mana wells, bridges, voids)
- Win condition (may differ from touchdown)
- Available in Quick Play and Campaign

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
- [x] Weather changes mid-match (every 4 turns, new random weather).
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
- [ ] **Standings table** - Wins / losses / points scored / points allowed.
- [ ] **Playoffs & Championship** - Top teams qualify for a knockout bracket.

### Progression & Persistence

- [ ] **Player XP and leveling** - Players earn XP from matches. Level ups
      grant stat boosts or unlock new abilities.
- [ ] **Injuries carry over** - A player injured in one match may miss the
      next (ties into stamina/toughness stats from Phase 2).
- [ ] **Recruitment** - Between matches, recruit new players from a random
      pool. Manage your roster (bench / starting lineup).
- [ ] **Treasury / Economy** - Earn gold from wins. Spend on recruitment,
      healing injured players, or upgrading facilities.

### World Map Locations (Draft)

| Town              | Team                 | Terrain Home Field | Difficulty |
| ----------------- | -------------------- | ------------------ | ---------- |
| Silverwood        | Elven Vanguard       | Grass              | Easy       |
| Ironhammer Hold   | Dwarven Ironwall     | Mud                | Medium     |
| Bone Hollow       | Undead Legion        | Ice                | Medium     |
| Scorchpeak Caldera| Demon Hellfire       | Lava               | Hard       |
| Ratburrow Warrens | Ratfolk Swarm         | Maze (exotic)      | Hard       |
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
- [ ] **AI opponent** - Single-player against a computer-controlled team
      (basic heuristic AI, or LLM-driven decision making).
- [ ] **Multiplayer** - Hot-seat is already supported (pass-and-play). Online
      multiplayer would require a server rewrite.
- [ ] **Mobile-friendly layout** - The game somewhat works on mobile but
      needs touch-friendly controls and responsive board sizing.
- [ ] **Replay system** - Record and replay matches turn-by-turn.

---

## Open Questions

1. ~~Should terrain effects stack with weather effects?~~ **Resolved**: Yes,
   they stack. Terrain and weather modifiers are independent and additive
   (e.g. ice terrain -1 pass + rain weather -1 pass = -2 total).
2. How many turns should a match last? Currently unlimited until a score
   target. Should there be a turn limit with highest-score-wins?
3. For campaign mode, should the AI opponent use LLM-based tactical
   decisions, or classic game AI heuristics?
4. Should exotic maps be unlockable (campaign rewards) or available from
   the start in Quick Play?
5. Is 5v5 the right team size, or should some maps / modes support larger
   rosters (7v7, 11v11)?
