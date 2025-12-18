import React from 'react';
import { Player, TeamSide, PlayerRole } from '../types';

interface PlayerTokenProps {
  player: Player;
  onClick: (e: React.MouseEvent) => void;
}

const PlayerToken: React.FC<PlayerTokenProps> = ({ player, onClick }) => {
  const isHome = player.team === TeamSide.HOME;
  const bgColor = isHome ? 'bg-blue-600' : 'bg-red-600';
  const ringColor = isHome ? 'ring-blue-300' : 'ring-red-300';
  
  const getIcon = () => {
    switch (player.role) {
      case PlayerRole.WIZARD: return '🧙';
      case PlayerRole.BLITZER: return '⚔️';
      case PlayerRole.CATCHER: return '🤚';
      case PlayerRole.QUARTERBACK: return '👑';
      default: return '🛡️';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative w-[85%] h-[85%] rounded-full shadow-lg cursor-pointer 
        flex items-center justify-center text-sm select-none transition-transform hover:scale-110
        ${bgColor} border-2 border-white/80
        ${player.actionTaken ? 'opacity-50 grayscale' : 'opacity-100'}
        ${player.isStunned ? 'rotate-90' : ''}
      `}
    >
      <span className="text-lg drop-shadow-md filter">{getIcon()}</span>
      
      {/* Status Indicators */}
      {player.hasBall && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-bounce shadow-sm border border-black" />
      )}
      {player.isStunned && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <span className="text-xs text-white font-bold">ZZZ</span>
        </div>
      )}
      
      {/* Action/Move Bar */}
      {!player.actionTaken && !player.isStunned && (
         <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div 
                className="h-full bg-green-400" 
                style={{ width: `${(player.movesRemaining / player.stats.move) * 100}%` }}
            />
         </div>
      )}
    </div>
  );
};

export default PlayerToken;
