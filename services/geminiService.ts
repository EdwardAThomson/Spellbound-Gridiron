import { GoogleGenAI, SchemaType } from "@google/genai";
import { TeamSide, GameState } from "../types";

const apiKey = process.env.API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

const MODEL_NAME = "gemini-2.5-flash";

export const generateCommentary = async (
  lastAction: string,
  gameState: GameState
): Promise<string> => {
  if (!apiKey) return "The crowd roars! (Configure API Key for AI Commentary)";

  const prompt = `
    You are a fantasy sports commentator (like a Goblin or an excitable Wizard) for a game called Spellbound Gridiron.
    
    Current Match Context:
    - Home Team: ${gameState.homeTeam.name} (${gameState.homeTeam.race}) - Score: ${gameState.homeTeam.score}
    - Away Team: ${gameState.awayTeam.name} (${gameState.awayTeam.race}) - Score: ${gameState.awayTeam.score}
    - Weather: ${gameState.weather}
    - Terrain: ${gameState.terrain}

    The last action was: "${lastAction}".

    Provide a short, punchy, and thematic 1-2 sentence reaction to this action. Be funny and descriptive.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    return response.text || "The magical winds interfere with the commentary!";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Technical difficulties in the scrying orb!";
  }
};

export const generateTeamName = async (race: string): Promise<string> => {
    if (!apiKey) return `The Mighty ${race}s`;
    
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Generate a cool, fantasy board game team name for a team of ${race}. Just the name, nothing else. Example: "The Iron Hill Bashers"`,
        });
        return response.text?.trim() || `The ${race} Warriors`;
    } catch (e) {
        return `The ${race} Legends`;
    }
}

export const getTacticalAdvice = async (gameState: GameState): Promise<string> => {
    if (!apiKey) return "Move the ball to the endzone!";

    const prompt = `
        Analyze this board game state efficiently.
        Turn: ${gameState.turn}. Current Team: ${gameState.currentTeam}.
        Score: Home ${gameState.homeTeam.score} - Away ${gameState.awayTeam.score}.
        
        Give one short sentence of tactical advice for the ${gameState.currentTeam} team.
    `;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
        });
        return response.text || "Run forward!";
    } catch (e) {
        return "Protect the ball carrier!";
    }
}
