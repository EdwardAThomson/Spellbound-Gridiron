import React, { useState, useEffect, useRef, useContext } from 'react';
import { cliService, LogEntry, TaskStatus } from '../services/cliService';
import { ApiKeysContext } from '../context/ApiKeysContext';
import { generateText, LLMProvider } from '../utils/llmHelper';
import { GameState } from '../types';
import { serializeGameState } from '../utils/contextSerializer';

interface AiAssistantPanelProps {
    gameState: GameState;
    backend: LLMProvider;
    model: string;
}

export default function AiAssistantPanel({ gameState, backend, model }: AiAssistantPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [status, setStatus] = useState<TaskStatus | 'idle'>('idle');
    const [logs, setLogs] = useState<LogEntry[]>([]);

    const logsEndRef = useRef<HTMLDivElement>(null);
    const { apiKeys } = useContext(ApiKeysContext);

    // Auto-scroll
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handleRun = async () => {
        if (!prompt.trim()) return;

        setStatus('queued');
        setLogs([]);

        // --- CLI BACKENDS (Served by Node Backend) ---
        const isCli = ['codex', 'claude-cli', 'gemini-cli'].includes(backend);

        if (isCli) {
            try {
                const contextBlock = serializeGameState(gameState);
                const fullPrompt = `${contextBlock}\n\n[USER COMMAND]\n${prompt}`;

                // Map LLMProvider params to BackendType expected by cliService
                let cliBackend = 'codex';
                if (backend === 'claude-cli') cliBackend = 'claude';
                if (backend === 'gemini-cli') cliBackend = 'gemini';
                if (backend === 'codex') cliBackend = 'codex';

                // We cast to any because we know we are passing a CLI backend string valid for the service
                const { id } = await cliService.createTask(cliBackend as any, fullPrompt);

                cliService.streamTask(id, (update) => {
                    if (update.type === 'status') {
                        setStatus(update.data.state);
                    } else if (update.type === 'log') {
                        setLogs(prev => [...prev, update.data]);
                    } else if (update.type === 'error') {
                        setStatus('error');
                        setLogs(prev => [...prev, { line: `Error: ${update.data}`, stream: 'stderr', ts: new Date().toISOString() }]);
                    }
                });
            } catch (error: any) {
                setStatus('error');
                let message = `Failed: ${error.message}`;
                if (error.message.includes('Failed to fetch')) {
                    message += "\n(Is the CLI Gateway Server running?)";
                }
                setLogs(prev => [...prev, { line: message, stream: 'stderr', ts: new Date().toISOString() }]);
            }
            return;
        }

        // --- API BACKENDS (Client-side SDKs) ---
        setStatus('running');
        try {
            const contextBlock = serializeGameState(gameState);
            const fullPrompt = `${contextBlock}\n\n[USER COMMAND]\n${prompt}`;

            const response = await generateText(backend, apiKeys, model, fullPrompt);
            setLogs([{ line: response, stream: 'stdout', ts: new Date().toISOString() }]);
            setStatus('completed');
        } catch (error: any) {
            setStatus('error');
            setLogs(prev => [...prev, { line: `API Error: ${error.message}`, stream: 'stderr', ts: new Date().toISOString() }]);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-purple-900/80 hover:bg-purple-800 text-white p-3 rounded-full shadow-lg border border-purple-500/50 z-50 transition-all hover:scale-110"
                title="AI Assistant"
            >
                <span className="text-xl">🤖</span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 w-96 md:w-[600px] h-[500px] bg-stone-950 border border-purple-500/30 rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden font-mono text-xs">
            {/* Header */}
            <div className="flex justify-between items-center bg-purple-900/20 p-2 border-b border-white/10">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 text-purple-300 font-bold">
                        <span>🤖 AI Assistant</span>
                        {status === 'running' && <span className="animate-pulse text-green-400">●</span>}
                    </div>
                    <div className="text-[9px] text-purple-500/70 uppercase tracking-widest">
                        Powered By: <span className="text-white">{backend.toUpperCase()}</span>
                        {model && !model.includes('cli') && <span className="text-purple-400 ml-1">({model})</span>}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">✕</button>
                </div>
            </div>

            {/* Terminal Output */}
            <div className="flex-1 overflow-auto p-4 bg-black/50 space-y-1">
                {logs.length === 0 && (
                    <div className="text-gray-600 italic">How can I help you, coach?</div>
                )}
                {logs.map((log, i) => (
                    <div key={i} className={`${log.stream === 'stderr' ? 'text-red-400' : 'text-gray-300'} whitespace-pre-wrap break-all`}>
                        <span className="text-gray-600 mr-2 select-none">[{new Date(log.ts).toLocaleTimeString()}]</span>
                        {log.line}
                    </div>
                ))}
                <div ref={logsEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-stone-900 border-t border-white/10 space-y-3">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRun()}
                        placeholder="Ask for advice, rules, or tactics..."
                        className="flex-1 bg-stone-800 border border-white/10 text-white rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                        disabled={status === 'running'}
                    />
                    <button
                        onClick={handleRun}
                        disabled={status === 'running' || !prompt.trim()}
                        className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-bold transition-colors"
                    >
                        SEND
                    </button>
                </div>
            </div>
        </div>
    );
}
