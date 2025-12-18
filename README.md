
# Spellbound Gridiron

A fantasy football strategy game powered by AI.

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

### 🤖 DeepThought Panel
Click the robot icon to open the **DeepThought** terminal. This panel supports a **Hybrid Architecture** for generating content:

1.  **Cloud APIs (Client Mode)**:
    - Select **OpenAI**, **Gemini**, or **Claude** from the dropdown.
    - Click the **Key Icon (🔑)** to securely enter your API key directly in the browser.
    - These requests are handled entirely by your browser using official SDKs.

2.  **CLI Tools (Backend Mode)**:
    - Select **Codex (GPT-5)** (or other configured CLI tools).
    - These requests are sent to the local backend server, which executes the corresponding command-line tool on your machine.
