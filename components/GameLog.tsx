import React, { useEffect, useRef } from 'react';

interface GameLogProps {
  logs: string[];
  commentary: string;
  isThinking: boolean;
}

const GameLog: React.FC<GameLogProps> = ({ logs, commentary, isThinking }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-black/40 rounded-lg overflow-hidden border border-white/10">
      {/* Commentary Box */}
      <div className="p-4 bg-gradient-to-r from-purple-900/80 to-indigo-900/80 border-b border-white/10 min-h-[100px]">
        <div className="flex items-center gap-2 mb-1">
             <span className="text-xl">🔮</span>
             <h3 className="text-xs font-bold uppercase tracking-widest text-purple-300">Crystal Ball Commentary</h3>
        </div>
        <p className={`text-sm italic text-white/90 font-serif leading-relaxed ${isThinking ? 'animate-pulse' : ''}`}>
          "{commentary}"
        </p>
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
