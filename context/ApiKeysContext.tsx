/// <reference types="vite/client" />
import React, { createContext, useState, useEffect, ReactNode } from 'react';

export interface ApiKeys {
    openai: string;
    gemini: string;
    claude: string;
}

export interface ApiKeysContextType {
    apiKeys: ApiKeys;
    setApiKeys: (keys: Partial<ApiKeys>) => void;
}

const defaultKeys: ApiKeys = {
    openai: '',
    gemini: '',
    claude: '',
};

export const ApiKeysContext = createContext<ApiKeysContextType>({
    apiKeys: defaultKeys,
    setApiKeys: () => { },
});

export const ApiKeysProvider = ({ children }: { children: ReactNode }) => {
    // Initialize from localStorage if available, or .env fallback (if exposed)
    const [apiKeys, setApiKeysState] = useState<ApiKeys>(() => {
        const stored = localStorage.getItem('spellbound_api_keys');
        const envKeys = {
            openai: import.meta.env.VITE_OPENAI_API_KEY || '',
            gemini: import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || '',
            claude: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
        };

        if (stored) {
            try {
                const storedKeys = JSON.parse(stored);
                // Only override env keys if the stored key is non-empty
                return {
                    openai: storedKeys.openai || envKeys.openai,
                    gemini: storedKeys.gemini || envKeys.gemini,
                    claude: storedKeys.claude || envKeys.claude,
                };
            } catch (e) {
                return envKeys;
            }
        }
        return envKeys;
    });

    const setApiKeys = (newKeys: Partial<ApiKeys>) => {
        setApiKeysState(prev => {
            const next = { ...prev, ...newKeys };
            localStorage.setItem('spellbound_api_keys', JSON.stringify(next));
            return next;
        });
    };

    return (
        <ApiKeysContext.Provider value={{ apiKeys, setApiKeys }}>
            {children}
        </ApiKeysContext.Provider>
    );
};
