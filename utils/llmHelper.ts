import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from '@anthropic-ai/sdk';
import { ApiKeys } from "../context/ApiKeysContext";

export type LLMProvider = 'openai' | 'gemini' | 'claude' | 'codex' | 'claude-cli' | 'gemini-cli';

export async function generateText(
    provider: LLMProvider,
    apiKeys: ApiKeys,
    model: string,
    prompt: string,
    systemPrompt: string = "You are a helpful AI assistant."
): Promise<string> {

    // --- OpenAI ---
    if (provider === 'openai') {
        if (!apiKeys.openai) throw new Error("OpenAI API Key is missing");

        const openai = new OpenAI({
            apiKey: apiKeys.openai,
            dangerouslyAllowBrowser: true
        });

        const response = await openai.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
            ],
        });

        return response.choices[0]?.message?.content?.trim() || "";
    }

    // --- Gemini ---
    if (provider === 'gemini') {
        if (!apiKeys.gemini) throw new Error("Gemini API Key is missing");

        const genAI = new GoogleGenerativeAI(apiKeys.gemini);
        const geminiModel = genAI.getGenerativeModel({
            model: model,
            systemInstruction: systemPrompt,
        });

        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    }

    // --- Claude ---
    if (provider === 'claude') {
        if (!apiKeys.claude) throw new Error("Claude API Key is missing");

        const anthropic = new Anthropic({
            apiKey: apiKeys.claude,
            dangerouslyAllowBrowser: true,
        });

        const response = await anthropic.messages.create({
            model: model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [
                { role: "user", content: prompt }
            ]
        });

        // Anthropic response content can be blocks, we assume text block 0
        if (response.content?.[0]?.type === 'text') {
            return response.content[0].text.trim();
        }
        return JSON.stringify(response.content);
    }

    throw new Error(`Unsupported provider: ${provider}`);
}
