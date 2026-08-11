import React, { useState } from 'react';
import { GAME_RULES } from '../utils/contextSerializer';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Controls are UI facts (which button does what), not game rules, so they live
// here rather than in GAME_RULES. The How-to-play half deliberately does NOT
// restate the rules: it renders GAME_RULES verbatim so the help text and the
// block the AI engines are fed can never drift apart.
const CONTROLS: { label: string; text: string }[] = [
    { label: 'Select a unit', text: "Click one of your units to select it. Its reachable tiles light up and its actions appear in the side panel." },
    { label: 'Click to move', text: 'Click any highlighted tile and the unit walks the shortest path there automatically, spending one Move point per square.' },
    { label: 'Tackle', text: 'Move your selected unit into an adjacent opponent to start a Strength contest.' },
    { label: 'Pass / spell targeting', text: 'Choose Pass or a spell, then click the target tile. Cancel Action aborts targeting without spending the turn.' },
    { label: 'End Action', text: "Finish the selected unit's turn without moving it any further." },
    { label: 'End Turn', text: 'Hand play to the other team once your units are done.' },
    { label: 'Opponent (Quick Play)', text: 'On the start screen choose Hotseat (two humans share the keyboard) or Computer (the rules-based opponent runs the AWAY team). Computer is the default; campaign matches you play are always against the Computer. While the Computer plays, the board is read-only.' },
    { label: 'Save / Load', text: 'Save writes the current match to this browser; Load restores the last saved match.' },
    { label: 'Rematch', text: 'On the game-over screen, Rematch replays with the same rosters so veterans keep their XP; New Game fields fresh teams.' },
    { label: 'Quit to Menu', text: 'Return to the main menu. The match is paused, not ended, and can be resumed.' },
];

// Shared with RuleBookModal's rendering: turn the plain GAME_RULES text into a
// lightly-styled block (Title -> h2, trailing-colon lines -> h3, - lines -> li).
function formatRules(text: string) {
    return text.split('\n').map((line, i) => {
        if (line.includes('[GAME RULES]')) return null;
        if (line.trim().startsWith('Title:')) return <h3 key={i} className="text-2xl font-fantasy text-amber-500 mb-2">{line.replace('Title:', '')}</h3>;
        if (line.trim().endsWith(':')) return <h4 key={i} className="text-lg font-bold text-purple-300 mt-4 mb-1">{line}</h4>;
        if (line.trim().startsWith('-')) return <li key={i} className="ml-4 text-gray-300">{line.substring(1)}</li>;
        if (line.trim() === '') return <br key={i} />;
        return <p key={i} className="text-gray-400">{line}</p>;
    });
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
    const [tab, setTab] = useState<'controls' | 'howto'>('controls');
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div
                data-testid="help-modal"
                className="bg-stone-900 border-2 border-amber-600/50 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-stone-950 p-4 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-fantasy text-amber-100 flex items-center gap-2">
                        <span>❓</span> Help
                    </h2>
                    <button onClick={onClose} aria-label="Close help" className="text-gray-400 hover:text-white transition-colors text-2xl">
                        &times;
                    </button>
                </div>

                {/* Section tabs: two clearly separated sections. */}
                <div className="bg-stone-950/60 px-4 pt-3 flex gap-2 border-b border-white/10">
                    <button
                        onClick={() => setTab('controls')}
                        className={`px-4 py-2 rounded-t font-bold text-sm transition-colors ${tab === 'controls' ? 'bg-stone-900 text-amber-200 border border-b-0 border-white/10' : 'text-stone-500 hover:text-stone-300'}`}
                    >
                        Controls
                    </button>
                    <button
                        onClick={() => setTab('howto')}
                        className={`px-4 py-2 rounded-t font-bold text-sm transition-colors ${tab === 'howto' ? 'bg-stone-900 text-amber-200 border border-b-0 border-white/10' : 'text-stone-500 hover:text-stone-300'}`}
                    >
                        How to play
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto font-sans leading-relaxed">
                    {tab === 'controls' ? (
                        <section data-testid="help-controls">
                            <h3 className="text-2xl font-fantasy text-amber-500 mb-3">Controls</h3>
                            <dl className="space-y-3">
                                {CONTROLS.map(c => (
                                    <div key={c.label}>
                                        <dt className="text-purple-300 font-bold">{c.label}</dt>
                                        <dd className="text-gray-400 ml-1">{c.text}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    ) : (
                        <section data-testid="help-howto">
                            <div className="space-y-1">
                                {formatRules(GAME_RULES)}
                            </div>
                        </section>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-stone-950 p-4 border-t border-white/10 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded font-bold transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
