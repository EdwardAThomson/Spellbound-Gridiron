import React from 'react';
import { GAME_RULES } from '../utils/contextSerializer';

interface RuleBookModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function RuleBookModal({ isOpen, onClose }: RuleBookModalProps) {
    if (!isOpen) return null;

    // Process the text to make it slightly richer (converting [Title] to h2, etc.)
    const formatRules = (text: string) => {
        return text.split('\n').map((line, i) => {
            if (line.includes('[GAME RULES]')) return null;
            if (line.trim().startsWith('Title:')) return <h2 key={i} className="text-2xl font-fantasy text-amber-500 mb-2">{line.replace('Title:', '')}</h2>;
            if (line.trim().endsWith(':')) return <h3 key={i} className="text-lg font-bold text-purple-300 mt-4 mb-1">{line}</h3>;
            if (line.trim().startsWith('-')) return <li key={i} className="ml-4 text-gray-300">{line.substring(1)}</li>;
            if (line.trim() === '') return <br key={i} />;
            return <p key={i} className="text-gray-400">{line}</p>;
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-stone-900 border-2 border-amber-600/50 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="bg-stone-950 p-4 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-fantasy text-amber-100 flex items-center gap-2">
                        <span>📖</span> Rule Book
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-2xl">
                        &times;
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto font-sans leading-relaxed">
                    <div className="space-y-1">
                        {formatRules(GAME_RULES)}
                    </div>
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
