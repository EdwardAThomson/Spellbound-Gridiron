import React, { useEffect, useRef, useState } from 'react';

interface GameLogProps {
  logs: string[];
  commentary: string;
}

const GameLog: React.FC<GameLogProps> = ({ logs, commentary }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  // The crystal ball is flavor, not information, so it starts closed and
  // slides open on demand; the header stays visible as the toggle.
  const [showCommentary, setShowCommentary] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-black/40 rounded-lg overflow-hidden border border-white/10">
      {/* Commentary Box (collapsible) */}
      <div className="bg-gradient-to-r from-purple-900/80 to-indigo-900/80 border-b border-white/10">
        <button
          data-testid="commentary-toggle"
          onClick={() => setShowCommentary(v => !v)}
          className="w-full p-3 flex items-center justify-between gap-2 text-left hover:bg-white/5 transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="text-xl">🔮</span>
            <span className="text-xs font-bold uppercase tracking-widest text-purple-300">Crystal Ball Commentary</span>
          </span>
          <span className={`text-purple-300 text-xs transition-transform ${showCommentary ? 'rotate-180' : ''}`}>▼</span>
        </button>
        <div
          data-testid="commentary-body"
          className={`overflow-hidden transition-all duration-300 ${showCommentary ? 'max-h-40' : 'max-h-0'}`}
        >
          <p className="px-4 pb-3 text-sm italic text-white/90 font-serif leading-relaxed">
            "{commentary}"
          </p>
        </div>
      </div>

      {/* Game Log List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs" ref={scrollRef}>
        {logs.map((log, index) => (
          <div key={index} className="text-gray-300 border-l-2 border-gray-600 pl-2 py-0.5">
            <span className="opacity-50 mr-2">{index + 1}.</span>
            {log}
          </div>
        ))}
        {logs.length === 0 && <div className="text-center text-gray-600 mt-4">Match ready to begin...</div>}
      </div>
    </div>
  );
};

export default GameLog;
