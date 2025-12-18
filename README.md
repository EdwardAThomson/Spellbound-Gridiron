
# Spellbound Gridiron

A fantasy football strategy game powered by AI.

![Screenshot](Screenshot_20251218.png)

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
