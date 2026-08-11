import { generateText, LLMProvider } from '../utils/llmHelper';
import { ApiKeysContextType } from '../context/ApiKeysContext';
import { PROMPT_SNIPPET } from '../constants/ai_persona';

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
