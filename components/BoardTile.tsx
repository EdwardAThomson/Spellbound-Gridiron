import React from 'react';
import { TerrainType, TeamSide } from '../types';

interface BoardTileProps {
  x: number;
  y: number;
  terrain: TerrainType;
  isValidMove: boolean;
  isSelected: boolean;
  isTargetingMode: boolean;
  targetingType: 'PASS' | 'SPELL' | null;
  isBall: boolean;
  isEndZone: TeamSide | null;
  onClick: () => void;
  children?: React.ReactNode;
}

const BoardTile: React.FC<BoardTileProps> = ({
  x,
  y,
  terrain,
  isValidMove,
  isSelected,
  isTargetingMode,
  targetingType,
  isBall,
  isEndZone,
  onClick,
  children,
}) => {
  
  let baseColor = '';
  let borderColor = 'border-white/10';

  // Theme styling
  if ((x + y) % 2 === 0) {
    baseColor = 'bg-white/5'; 
  } else {
    baseColor = 'bg-transparent';
  }

  if (isEndZone === TeamSide.HOME) {
    baseColor = 'bg-blue-900/30';
    borderColor = 'border-blue-500/30';
  } else if (isEndZone === TeamSide.AWAY) {
    baseColor = 'bg-red-900/30';
    borderColor = 'border-red-500/30';
  }

  // Dynamic classes based on state
  let stateClasses = '';

  if (isTargetingMode) {
      // Targeting visual overrides
      stateClasses = 'cursor-crosshair ';
      if (targetingType === 'PASS') {
          stateClasses += 'hover:bg-yellow-500/30 hover:ring-2 hover:ring-yellow-400';
      } else {
          stateClasses += 'hover:bg-red-500/30 hover:ring-2 hover:ring-red-500';
      }
  } else {
      // Standard Movement visuals
      if (isValidMove) {
          stateClasses = 'ring-2 ring-green-400 bg-green-500/20 cursor-pointer hover:bg-green-500/40';
      } else if (isSelected) {
          stateClasses = 'ring-2 ring-yellow-400 bg-yellow-500/20';
      }
  }

  return (
    <div
      onClick={onClick}
      className={`relative w-full h-full border ${borderColor} ${baseColor} ${stateClasses} flex items-center justify-center transition-all duration-200`}
      style={{ aspectRatio: '1/1' }}
    >
       {isBall && (
        <div className="absolute z-20 w-3/4 h-3/4 animate-pulse pointer-events-none">
             <svg viewBox="0 0 24 24" fill="currentColor" className="text-amber-600 drop-shadow-lg">
                <path d="M12 2L14.5 4.5L12 7L9.5 4.5L12 2Z" /> 
                <ellipse cx="12" cy="12" rx="6" ry="10" />
                <path stroke="rgba(0,0,0,0.5)" strokeWidth="2" d="M12 2V22 M6 12H18" />
             </svg>
        </div>
       )}

       {children}
    </div>
  );
};

export default BoardTile;