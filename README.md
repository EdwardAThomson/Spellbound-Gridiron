
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

## 📖 Gameplay Manual

### The Basics
Spellbound Gridiron is a turn-based tactical sports game played on a 12x18 grid. The objective is to score touchdowns by moving the ball into the opponent's endzone.

### Player Roles & Stats

Each player has unique stats that define their capabilities:

-   **Lineman**: Tough and reliable. High Armor.
-   **Blitzer**: The muscle. Balanced Speed and Strength.
-   **Catcher**: Fast and agile (Move 8), but fragile (Armor 7).
-   **Quarterback**: The playmaker. Good passing skills.
-   **Wizard**: Special unit capable of casting spells like *Fireball* or *Teleport*.

### Terrain & Weather

The arena changes every match (in the future it will affect strategy):

-   **Elven Fields (Grass)**: Standard play conditions.
-   **Orc Pits (Mud)**: Slippery; movement is riskier. (not yet implemented)
-   **Demon Forge (Lava)**: Dangerous footing. (not yet implemented)
-   **Frozen Wastes (Ice)**: High slide potential. (not yet implemented)

## Features

### 🤖 AI Assistant (chatbot)
Click the robot icon to open the **Ai Assistant** terminal. This assistant provides in-game help, rule clarifications, and tactical advice.

### ⚙️ Game Configuration
Click the **Gear Icon** to open the Settings Modal. Here you can configure the dual-engine architecture:

1.  **Game Engine**: Powers automatic commentary, team names, and flavor text.
2.  **Assistant Engine**: Powers the interactive chat assistant.

**Supported Providers:**
-   **Cloud APIs**: OpenAI (ChatGPT), Gemini (Google), Claude (Anthropic). _(Requires API Keys)_
-   **CLI Tools**: Local execution of `codex`, `claude`, or `gemini` command-line tools via the backend server.
