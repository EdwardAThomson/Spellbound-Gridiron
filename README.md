
# Spellbound Gridiron

A fantasy football strategy game powered by AI. Broadly inspired by Blood Bowl: two teams of five (Linemen, Blitzers, Catchers, a Quarterback, and a spell-slinging Wizard) battle across a 12x18 grid, tackling, passing, and casting spells to carry the ball into the opposing endzone.

The AI angle is a dual-engine setup: one LLM provides live match commentary and team names, while a second powers an in-game assistant chatbot (Coach "Iron-Gut" Ironfist) for rules help and tactical advice. Both engines can run on cloud APIs (OpenAI, Gemini, Claude) or on local CLI tools via a small backend server.

![Screenshot](Screenshot_20251218.png)

## YouTube Videos

- [Getting started!](https://www.youtube.com/watch?v=pgtWZjtKIuA&t=1s) : a quick tour of the game and how to set it up.

## Run Locally

**Prerequisites:**  Node.js

1.  **Install dependencies:**
    ```bash
    npm install
    cd server && npm install && cd ..
    ```

2.  **Environment Setup:**
    - Create a `.env` file in the root directory (see `.env.example` or `.env.local`).
    - Add your `GEMINI_API_KEY` for in-game commentary.
    - (Optional) Add `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc. if strictly using server-side keys (though the UI now allows client-side entry).

3.  **Start the Backend (CLI Runner):**
    The backend is required for using local CLI tools (like `codex` or `claude` CLI).
    ```bash
    npm run start:server
    ```

4.  **Start the Frontend:**
    In a new terminal:
    ```bash
    npm run dev
    ```

## Game Modes

The game opens on a fantasy-styled **main menu** with four entries. You can return to the menu from inside a match at any time via **Quit to Menu** (and from the game-over screen), all without a page reload, and doing so never clobbers a running match's saved state.

- **Quick Play**: a one-off exhibition match. Pick the pitch and the sky on the start screen, then play a standard 5v5 game to 21 points or 16 turns.
- **Campaign**: a first-playable league season (see below).
- **Tutorial**: a short, skippable guided walkthrough (see below). Runs on Grass / Clear and needs no API keys.
- **Settings**: the dual-engine provider/model configuration (also reachable via the gear icon in-game).

### Campaign (league season)

Campaign runs a **4-team double round-robin**: every team meets every other team twice, once at each team's home, for 12 fixtures in all. A standings table tracks played / won / drawn / lost and league points on the **3-1-0** (win-draw-loss) system, sorted by points, then goal difference, then points scored.

-   **Your fixtures** are played as normal matches.
-   **AI-vs-AI fixtures** resolve instantly through a pure, non-LLM simulator that derives a score from each team's overall quality: no keys, no network. Each fixture's randomness comes from a seeded PRNG keyed on the season number and the fixture's identity (round and the two teams), not the wall clock, so an AI-vs-AI season is genuinely reproducible: it replays to exactly the same results every time.
-   When every fixture is played, a **season-complete** screen crowns the champion and offers a **new season**: rosters carry over (via the persistent roster system), and the standings reset.
-   The campaign persists under its own **versioned localStorage** slot, separate from the single-match save and the roster slots. It resumes from the Campaign menu entry, survives a reload mid-season, and degrades gracefully (to "no usable campaign") on corrupt or missing data rather than loading a half-broken season.

### Tutorial

The Tutorial teaches by doing: a short sequence of anchored **coachmarks**, each with a plain-language instruction and a real in-game action to perform (select a unit, move it, pick up the ball, score, end the turn), advanced with **Next / Skip** controls. It is **skippable at any time** and returns cleanly to the menu without touching your saves or rosters. It always runs on Grass / Clear and needs no API keys, so it doubles as the keys-free first-run experience.

## 📖 Gameplay Manual

### The Basics
Spellbound Gridiron is a turn-based tactical sports game played on a 12x18 grid. The objective is to score touchdowns by moving the ball into the opponent's endzone. Whichever mode you pick, the in-match rules below are identical.

To move, select a unit and click any highlighted tile: the unit walks the shortest path there, one Move point per square, resolving terrain (slips, hazards, slides), ball pickups, and touchdowns along the way.

### Player Roles & Stats

Each player has unique stats that define their capabilities:

-   **Lineman**: Tough and reliable. High Armor.
-   **Blitzer**: The muscle. Balanced Speed and Strength.
-   **Catcher**: Fast and agile (Move 8), but fragile (Armor 7).
-   **Quarterback**: The playmaker. Good passing skills.
-   **Wizard**: Special unit capable of casting spells like *Fireball* or *Teleport*.

### Terrain & Weather

Pick the pitch and the sky on the start screen; both have real mechanical effects, telegraphed on the board and in the rulebook.

**Terrain** (affects movement):

-   **Elven Fields (Grass)**: Standard footing, no effect.
-   **Orc Pits (Mud)**: Every step risks a slip. A failed step drops the unit prone (Stunned) where it lands and shakes the ball loose.
-   **Demon Forge (Lava)**: A set of glowing hazard tiles is seeded at kickoff (shown with a ⚠️). Step onto one and the molten ground knocks the unit down.
-   **Frozen Wastes (Ice)**: A step slides one extra tile in the same direction whenever that tile is open.

**Weather** (affects passing and events):

-   **Clear**: No penalty.
-   **Rain**: Wet ball; passes are +1 harder.
-   **Blizzard**: Driving snow; passes are +2 harder and every player suffers -1 Move (one fewer square per turn, minimum 1).
-   **Meteor Shower**: A meteor tile is telegraphed one full round (shown with a ☄️), then strikes it, knocking down anyone standing there and jarring the ball loose. Clear the tile before it lands.

### Progression (XP & Levels)

Players grow across a match. Every play banks XP, and enough XP levels a unit up (to a maximum of level 5), granting one small stat bump capped to that role's strengths. The selected unit's card shows its current **level** and **accrued XP**.

-   **XP awards**: landing a tackle **+2**, completing a pass **+2**, casting a spell **+1**, scoring a touchdown **+5**.
-   **Level thresholds** (cumulative XP): Level 2 at 5, Level 3 at 12, Level 4 at 21, Level 5 at 32.
-   Progression is saved and restored with the match (the save format is versioned; saves from older versions are rejected rather than loaded).

### Persistent Rosters & Rematch

Teams persist between matches. When a match ends, both rosters (every player's XP, level and earned stat bumps) are written to versioned, named localStorage slots, separately from the single-match Save/Load slot. The post-game screen then offers two choices:

-   **Rematch**: replays with the same two teams, reusing the saved rosters, so your veterans return at their formation slots carrying the XP and levels they earned. Corrupt or missing roster data falls back gracefully to fresh teams.
-   **New Game**: starts over with brand-new teams (progression reset).

## Features

### 📓 In-game Help
An always-available **Help** entry splits into two sections: **Controls** (unit selection, click-to-move, tackle, pass/spell targeting, End Action / End Turn, Save/Load, Rematch) and **How to play** (objective, turn structure, stats, terrain/weather, spells, XP/levels, win condition). It reuses the same `GAME_RULES` block the AI engines are fed, so the rules never drift between what the game tells you and what it tells the AI.

### 🤖 AI Assistant (chatbot)
Click the robot icon to open the **Ai Assistant** terminal. This assistant provides in-game help, rule clarifications, and tactical advice.

### ⚙️ Game Configuration
Click the **Gear Icon** to open the Settings Modal. Here you can configure the dual-engine architecture:

1.  **Game Engine**: Powers automatic commentary, team names, and flavor text.
2.  **Assistant Engine**: Powers the interactive chat assistant.

**Supported Providers:**
-   **Cloud APIs**: OpenAI (ChatGPT), Gemini (Google), Claude (Anthropic). _(Requires API Keys)_
-   **CLI Tools**: Local execution of `codex`, `claude`, or `gemini` command-line tools via the backend server.
