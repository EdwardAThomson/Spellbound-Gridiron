import React, { useContext } from 'react';
import { ApiKeysContext } from '../context/ApiKeysContext';
import { LLMProvider } from '../utils/llmHelper';
import { AVAILABLE_MODELS, DEFAULT_MODELS } from '../constants/models';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    gameProvider: LLMProvider;
    setGameProvider: (provider: LLMProvider) => void;
    gameModel: string;
    setGameModel: (model: string) => void;
    chatProvider: LLMProvider;
    setChatProvider: (provider: LLMProvider) => void;
    chatModel: string;
    setChatModel: (model: string) => void;
}

export default function SettingsModal({
    isOpen, onClose,
    gameProvider, setGameProvider, gameModel, setGameModel,
    chatProvider, setChatProvider, chatModel, setChatModel
}: SettingsModalProps) {
    const { apiKeys, setApiKeys } = useContext(ApiKeysContext);
    const [showApiKeys, setShowApiKeys] = React.useState(false);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-stone-900 border-2 border-purple-500/50 rounded-xl shadow-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="bg-stone-950 p-4 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-purple-300 flex items-center gap-2">
                        <span>⚙️</span> Game Settings
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-2xl">
                        &times;
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">

                    {/* Game Engine Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-amber-500 font-bold mb-2 text-xs uppercase tracking-widest">Provider</label>
                            <select
                                value={gameProvider}
                                onChange={(e) => {
                                    const newProvider = e.target.value as LLMProvider;
                                    setGameProvider(newProvider);
                                    setGameModel(DEFAULT_MODELS[newProvider]);
                                }}
                                className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white focus:border-purple-500 focus:outline-none text-sm"
                            >
                                <optgroup label="Cloud APIs">
                                    <option value="openai">OpenAI (ChatGPT)</option>
                                    <option value="gemini">Gemini (Google)</option>
                                    <option value="claude">Claude (Anthropic)</option>
                                </optgroup>
                                <optgroup label="CLI Tools">
                                    <option value="codex">Codex CLI</option>
                                    <option value="claude-cli">Claude CLI</option>
                                    <option value="gemini-cli">Gemini CLI</option>
                                </optgroup>
                            </select>
                        </div>
                        <div>
                            <label className="block text-amber-500 font-bold mb-2 text-xs uppercase tracking-widest">Model</label>
                            <select
                                value={gameModel}
                                onChange={(e) => setGameModel(e.target.value)}
                                className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white focus:border-purple-500 focus:outline-none text-sm"
                            >
                                {AVAILABLE_MODELS[gameProvider]?.map(model => (
                                    <option key={model.id} value={model.id}>{model.name}</option>
                                )) || <option value="default">Default</option>}
                            </select>
                        </div>
                    </div>
                    <p className="text-xs text-center text-gray-500">
                        This AI engine invents team names. Match commentary is generated locally, no AI or keys needed.
                    </p>

                    <div className="h-px bg-white/10"></div>

                    {/* Chat Assistant Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-purple-400 font-bold mb-2 text-xs uppercase tracking-widest">Assistant Provider</label>
                            <select
                                value={chatProvider}
                                onChange={(e) => {
                                    const newProvider = e.target.value as LLMProvider;
                                    setChatProvider(newProvider);
                                    setChatModel(DEFAULT_MODELS[newProvider]);
                                }}
                                className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white focus:border-purple-500 focus:outline-none text-sm"
                            >
                                <optgroup label="Cloud APIs">
                                    <option value="openai">OpenAI (ChatGPT)</option>
                                    <option value="gemini">Gemini (Google)</option>
                                    <option value="claude">Claude (Anthropic)</option>
                                </optgroup>
                                <optgroup label="CLI Tools">
                                    <option value="codex">Codex CLI</option>
                                    <option value="claude-cli">Claude CLI</option>
                                    <option value="gemini-cli">Gemini CLI</option>
                                </optgroup>
                            </select>
                        </div>
                        <div>
                            <label className="block text-purple-400 font-bold mb-2 text-xs uppercase tracking-widest">Assistant Model</label>
                            <select
                                value={chatModel}
                                onChange={(e) => setChatModel(e.target.value)}
                                className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white focus:border-purple-500 focus:outline-none text-sm"
                            >
                                {AVAILABLE_MODELS[chatProvider]?.map(model => (
                                    <option key={model.id} value={model.id}>{model.name}</option>
                                )) || <option value="default">Default</option>}
                            </select>
                        </div>
                    </div>
                    <p className="text-xs text-center text-gray-500">
                        This engine powers the "AI Assistant".
                    </p>

                    <div className="h-px bg-white/10"></div>

                    {/* API Keys */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="block text-amber-500 font-bold text-sm uppercase tracking-widest">API Configuration</label>
                            <button
                                onClick={() => setShowApiKeys(!showApiKeys)}
                                className="text-xs text-blue-400 hover:text-blue-300 underline"
                            >
                                {showApiKeys ? 'Hide Overrides' : 'Show Key Overrides'}
                            </button>
                        </div>

                        {showApiKeys && (
                            <div className="p-3 bg-black/30 rounded border border-white/5 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <p className="text-[10px] text-gray-500 mb-2">
                                    Keys are automatically loaded from .env. Only use these to override defaults.
                                </p>
                                <div>
                                    <label className="block text-xs text-blue-300 mb-1">OpenAI API Key</label>
                                    <input
                                        type="password"
                                        className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-white text-sm"
                                        value={apiKeys.openai}
                                        onChange={(e) => setApiKeys({ openai: e.target.value })}
                                        placeholder="sk-..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-blue-300 mb-1">Gemini API Key</label>
                                    <input
                                        type="password"
                                        className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-white text-sm"
                                        value={apiKeys.gemini}
                                        onChange={(e) => setApiKeys({ gemini: e.target.value })}
                                        placeholder="Use Google AI Studio Key"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-blue-300 mb-1">Claude API Key</label>
                                    <input
                                        type="password"
                                        className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-white text-sm"
                                        value={apiKeys.claude}
                                        onChange={(e) => setApiKeys({ claude: e.target.value })}
                                        placeholder="sk-ant-..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="bg-stone-950 p-4 border-t border-white/10 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded font-bold transition-colors"
                    >
                        Save & Close
                    </button>
                </div>
            </div>
        </div>
    );
}
