import { generateText, LLMProvider } from '../utils/llmHelper';
import { GameState } from '../types';
import { ApiKeysContextType } from '../context/ApiKeysContext';
import { serializeGameState } from '../utils/contextSerializer';

export const generateCommentary = async (
    lastAction: string,
    gameState: GameState,
    provider: LLMProvider,
    apiKeys: ApiKeysContextType['apiKeys'],
    model: string
): Promise<string> => {
    // Validate Key
    const key = apiKeys[provider === 'openai' ? 'openai' : provider === 'gemini' ? 'gemini' : 'claude'];
    if (!key) return "The crowd roars! (Please check Settings -> API Keys)";

    const context = serializeGameState(gameState);
    const prompt = `
${context}

You are a fantasy sports commentator (a Goblin or Excitable Wizard).
The last action was: "${lastAction}".
Provide a short, punchy, and funny 1-sentence reaction.
`;

    try {
        return await generateText(provider, apiKeys, model, prompt);
    } catch (error) {
        console.error("AI Commentary Error:", error);
        return "The magical winds interfere with the commentary!";
    }
};

export const generateTeamName = async (
    race: string,
    provider: LLMProvider,
    apiKeys: ApiKeysContextType['apiKeys'],
    model: string
): Promise<string> => {
    const key = apiKeys[provider === 'openai' ? 'openai' : provider === 'gemini' ? 'gemini' : 'claude'];
    if (!key) return `The ${race} Warriors`;

    const prompt = `Generate a cool, fantasy football team name for a team of ${race}. Just the name, nothing else. Example: "The Iron Hill Bashers"`;

    try {
        const name = await generateText(provider, apiKeys, model, prompt);
        return name.replace(/"/g, '').trim();
    } catch (e) {
        return `The ${race} Legends`;
    }
}
