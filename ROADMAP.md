# Spellbound Gridiron - Development Roadmap

> A turn-based tactical fantasy sports game.
> Last updated: April 2026

---

## Phase 0: Code Modernization & Bug Fixes

Before adding features, stabilize and restructure the codebase.

### Architecture

- [ ] **Extract game engine from App.tsx** - Move all game logic (movement,
      tackling, passing, spells, scoring) out of `App.tsx` into a dedicated
      game engine module. `App.tsx` is currently ~700 lines mixing UI and
      game state.
- [ ] **Introduce a state machine for game flow** - Model game phases
      explicitly (e.g. `MAIN_MENU`, `TEAM_SELECT`, `PLAYING`, `POST_GAME`,
      `CAMPAIGN_MAP`) instead of ad-hoc boolean flags like `hasGameStarted`.
- [ ] **Add client-side routing** - Use React Router (or similar) so screens
      like main menu, team selection, game board, and campaign map each have
      their own route.
- [ ] **Break up the monolith component** - Split `App.tsx` into focused
      components/hooks: `useGameEngine`, `GameBoard`, `HUD`, `Scoreboard`,
      `PlayerCard`, `ActionPanel`, etc.
- [ ] **Data-driven team/roster system** - Replace hardcoded `INITIAL_HOME_TEAM`
      / `INITIAL_AWAY_TEAM` with a roster data file that defines all available
      teams, their races, colors, and player compositions.

### Bug Fixes

- [ ] **Fix direct state mutation in `handleCastSpell`** - Line
      `player.position = targetPos` mutates state directly instead of going
      through `updatePlayerState`. This can cause React rendering issues.
- [ ] **Armor stat is flavor-only** - Currently defined on every player but
      never referenced in any game mechanic. Either wire it in or remove it
      (see Phase 2 for plan to use it).

### Quality of Life

- [ ] **Add save/load game state** - Persist to `localStorage` so games
      survive page refreshes.
- [ ] **Add unit tests** - Cover core game utils (`resolveTackle`,
      `resolvePass`, `rollDice`, movement validation, touchdown detection).
- [ ] **Type-safe spell system** - Replace string keys (`'FIREBALL'`,
      `'TELEPORT'`) with a proper enum or union type.

---

## Phase 1: Main Menu & Quick Play

### Main Menu

- [ ] **Create a main menu screen** - Title art, atmospheric background.
      Buttons for:
  - Quick Play
  - Campaign / League (disabled until Phase 5)
  - Settings (AI model configuration)
  - Rule Book
- [ ] **Team selection screen** - Shown after clicking Quick Play. Pick home
      and away teams from the roster. Show team preview: race, roster
      composition, color/theme.

### Quick Play Flow

- [ ] `Main Menu` -> `Select Home Team` -> `Select Away Team` ->
      `Loading / AI team name generation` -> `Game Board`
- [ ] **Post-game summary screen** - Show final score, MVP player stats,
      key plays. Options: rematch, return to menu.

---

## Phase 2: Expanded Rosters & Player Stats

### More Teams

Add a diverse set of teams, each with a distinct fantasy race and play style.

| Team                 | Race          | Play Style            |
| -------------------- | ------------- | --------------------- |
| Elven Vanguard       | High Elves    | Agile, passing game   |
| Orc Bashers          | Dark Orcs     | Brute strength        |
| Undead Legion        | Undead        | Resilient, slow       |
| Dwarven Ironwall     | Dwarves       | Defensive, high armor |
| Skaven Swarm         | Ratfolk       | Fast, fragile         |
| Demon Hellfire       | Demons        | Magic-heavy           |
| Human Crusaders      | Humans        | Balanced / versatile  |
| Lizardfolk Predators | Lizardfolk    | Mixed speed/strength  |

Each team should have a **unique roster composition** - not every team needs
the same 5 roles. For example:
- Orcs might run 2 Linemen, 2 Blitzers, 1 Quarterback (no Wizard)
- Demons might run 2 Wizards, 1 Blitzer, 1 Catcher, 1 Quarterback

### New Player Roles

- [ ] **Beastmaster** - Summons a temporary companion unit (e.g. wolf,
      skeleton) that occupies a tile and can tackle.
- [ ] **Assassin / Rogue** - Can move through occupied tiles. Low strength,
      high skill. Special ability: backstab (bonus tackle from behind).
- [ ] **Berserker** - Gets stronger as the match progresses (or when damaged).
      Fury mechanic.

### Revised Stats

Current stats: `move`, `strength`, `skill`, `armor`.

Proposed additions:

| Stat          | Purpose                                                   |
| ------------- | --------------------------------------------------------- |
| **Agility**   | Dodge chance when tackled; ability to slip past defenders  |
| **Toughness** | Resistance to injury (replaces or works alongside armor)  |
| **Passing**   | Separate from general skill; accuracy on throws           |
| **Stamina**   | Limits total actions per game (not per turn) - fatigue     |

Stat revision decisions to make:
- [ ] Should `skill` split into `passing` and `agility`?
- [ ] Should `armor` become a functional stat (damage reduction / injury
      resistance)?
- [ ] Is a `stamina` / fatigue system worth the complexity? (More relevant
      for campaign mode where player health carries over between matches.)
- [ ] Add player **leveling / XP** for campaign mode?

---

## Phase 3: Terrain & Exotic Maps

### Implement Existing Terrain Effects

The terrain types already exist in code but have no gameplay effect.

| Terrain        | Arena Name    | Gameplay Effect                          |
| -------------- | ------------- | ---------------------------------------- |
| Grass          | Elven Fields  | Standard. No modifiers.                  |
| Mud            | Orc Pits      | -1 movement per tile. Tackle rolls +1 for defenders (harder to push in mud). |
| Lava           | Demon Forge   | Tiles randomly become hazards each turn. Stepping on hazard = injury check. |
| Ice            | Frozen Wastes | After moving, player slides 1 extra tile in the same direction. Passing accuracy -1. |

### Exotic / Special Maps

Beyond terrain modifiers, add maps with unique layouts and game modes.

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

## Phase 4: Weather System

Weather currently exists as an enum (`Clear`, `Rain`, `Blizzard`,
`Meteor Shower`) but has no gameplay impact.

| Weather        | Effects                                                    |
| -------------- | ---------------------------------------------------------- |
| Clear          | No modifiers.                                              |
| Rain           | Passing accuracy -1. Ball pickup requires a skill check.   |
| Blizzard       | Visibility reduced: can only select players within 4 tiles of ball. Movement -1. |
| Meteor Shower  | Random tiles become hazard zones each turn. Standing in one = stun check. |
| Fog            | (New) Cannot see opponent positions beyond 3 tiles.        |
| Arcane Storm   | (New) All spell costs reduced by 1. Random magical effects each turn. |

- [ ] Weather should be randomly assigned at match start (or chosen in
      Quick Play settings).
- [ ] Weather can change mid-match (e.g. every 4 turns, roll for weather
      change).
- [ ] Visual weather effects on the board (rain particles, snow, fire from
      sky, fog overlay).

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
| Ratburrow Warrens | Skaven Swarm         | Maze (exotic)      | Hard       |
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

1. Should terrain effects stack with weather effects, or should they be
   independent systems?
2. How many turns should a match last? Currently unlimited until a score
   target. Should there be a turn limit with highest-score-wins?
3. For campaign mode, should the AI opponent use LLM-based tactical
   decisions, or classic game AI heuristics?
4. Should exotic maps be unlockable (campaign rewards) or available from
   the start in Quick Play?
5. Is 5v5 the right team size, or should some maps / modes support larger
   rosters (7v7, 11v11)?
