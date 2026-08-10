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
  isHazard?: boolean;
  isMeteorTarget?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}

// Deterministic hash in [0,1) seeded by the tile's (x, y) and a salt.
// GLSL-style sin hash: same tile always renders the same art, so the field
// looks varied but is stable across re-renders (no flicker, no Math.random).
const seeded = (x: number, y: number, salt: number): number => {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
};

// Inline per-terrain SVG art for Grass / Mud / Lava / Ice. Each tile draws a
// solid base plus a handful of decorative marks whose positions and sizes come
// from the (x, y) seed, giving deterministic per-tile variation.
const TerrainArt: React.FC<{ x: number; y: number; terrain: TerrainType }> = ({ x, y, terrain }) => {
  const r = (salt: number) => seeded(x, y, salt);
  // Subtle checkerboard shading baked into the base fill.
  const dark = (x + y) % 2 === 0;

  let content: React.ReactNode;

  switch (terrain) {
    case TerrainType.MUD: {
      // Churned brown earth with darker puddles/clods.
      const blobs = Array.from({ length: 4 }, (_, i) => (
        <ellipse
          key={i}
          cx={r(i * 3) * 40}
          cy={r(i * 3 + 1) * 40}
          rx={3 + r(i * 3 + 2) * 5}
          ry={2 + r(i * 3 + 5) * 3}
          fill="#2f2013"
          opacity={0.55}
        />
      ));
      content = (
        <>
          <rect width="40" height="40" fill={dark ? '#4b3320' : '#553a24'} />
          {blobs}
        </>
      );
      break;
    }
    case TerrainType.LAVA: {
      // Charred crust cracked by glowing molten seams.
      const cracks = Array.from({ length: 3 }, (_, i) => (
        <line
          key={i}
          x1={r(i * 4) * 40}
          y1={r(i * 4 + 1) * 40}
          x2={r(i * 4 + 2) * 40}
          y2={r(i * 4 + 3) * 40}
          stroke="#ff6a00"
          strokeWidth={1 + r(i * 4 + 6) * 1.5}
          strokeLinecap="round"
          opacity={0.75}
        />
      ));
      content = (
        <>
          <rect width="40" height="40" fill={dark ? '#241009' : '#2e150c'} />
          <circle cx={r(7) * 40} cy={r(9) * 40} r={4 + r(11) * 4} fill="#ff9800" opacity={0.35} />
          {cracks}
        </>
      );
      break;
    }
    case TerrainType.ICE: {
      // Pale frozen sheet scored with white fracture lines.
      const cracks = Array.from({ length: 3 }, (_, i) => (
        <polyline
          key={i}
          points={`${r(i * 5) * 40},${r(i * 5 + 1) * 40} ${r(i * 5 + 2) * 40},${r(i * 5 + 3) * 40} ${r(i * 5 + 4) * 40},${r(i * 5 + 6) * 40}`}
          fill="none"
          stroke="#eaf6ff"
          strokeWidth={0.8}
          opacity={0.6}
        />
      ));
      content = (
        <>
          <rect width="40" height="40" fill={dark ? '#5f97bb' : '#6ba6c8'} />
          <polygon
            points={`${r(1) * 40},0 40,${r(2) * 40} ${r(3) * 40},40`}
            fill="#cfeaf7"
            opacity={0.25}
          />
          {cracks}
        </>
      );
      break;
    }
    case TerrainType.GRASS:
    default: {
      // Verdant turf sprouting a few leaning blades.
      const blades = Array.from({ length: 5 }, (_, i) => {
        const bx = 4 + r(i * 3) * 32;
        const h = 8 + r(i * 3 + 1) * 12;
        const lean = (r(i * 3 + 2) - 0.5) * 5;
        return (
          <path
            key={i}
            d={`M ${bx} 40 Q ${bx + lean} ${40 - h / 2} ${bx + lean * 1.6} ${40 - h}`}
            fill="none"
            stroke={i % 2 === 0 ? '#3f9142' : '#57ad55'}
            strokeWidth={1.2}
            strokeLinecap="round"
            opacity={0.6}
          />
        );
      });
      content = (
        <>
          <rect width="40" height="40" fill={dark ? '#236b26' : '#2a7a2d'} />
          {blades}
        </>
      );
      break;
    }
  }

  return (
    <svg
      viewBox="0 0 40 40"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    >
      {content}
    </svg>
  );
};

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
  isHazard,
  isMeteorTarget,
  onClick,
  children,
}) => {

  let borderColor = 'border-white/10';

  // Ring + cursor live on the root (it receives hover directly). Background
  // tints live on an overlay above the terrain art (a solid SVG base would
  // otherwise hide a tint painted on the root's own background), driven by
  // group-hover so hovering the tile still lights the overlay.
  let rootState = '';
  let tint = '';

  if (isEndZone === TeamSide.HOME) {
    borderColor = 'border-blue-500/30';
    tint = 'bg-blue-900/25';
  } else if (isEndZone === TeamSide.AWAY) {
    borderColor = 'border-red-500/30';
    tint = 'bg-red-900/25';
  }

  if (isTargetingMode) {
    rootState = 'cursor-crosshair ';
    if (targetingType === 'PASS') {
      rootState += 'hover:ring-2 hover:ring-yellow-400';
      tint += ' group-hover:bg-yellow-500/30';
    } else {
      rootState += 'hover:ring-2 hover:ring-red-500';
      tint += ' group-hover:bg-red-500/30';
    }
  } else if (isValidMove) {
    rootState = 'ring-2 ring-green-400 cursor-pointer';
    tint += ' bg-green-500/20 group-hover:bg-green-500/40';
  } else if (isSelected) {
    rootState = 'ring-2 ring-yellow-400';
    tint += ' bg-yellow-500/20';
  }

  return (
    <div
      onClick={onClick}
      className={`group relative w-full h-full border ${borderColor} ${rootState} flex items-center justify-center transition-all duration-200`}
      style={{ aspectRatio: '1/1' }}
    >
      <TerrainArt x={x} y={y} terrain={terrain} />

      {/* Interaction / endzone tint, above the terrain art but below tokens. */}
      <div className={`absolute inset-0 pointer-events-none transition-colors duration-200 ${tint}`} />

      {/* Lava hazard telegraph: a seeded tile that knocks down anyone stepping on it. */}
      {isHazard && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center" title="Lava hazard - stepping here knocks you down!" aria-label="Lava hazard tile">
          <div className="absolute inset-0 bg-orange-500/25 ring-1 ring-inset ring-orange-400/60" />
          <span className="relative text-xs drop-shadow">⚠️</span>
        </div>
      )}

      {/* Meteor telegraph: the tile an incoming meteor will strike next round. */}
      {isMeteorTarget && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center animate-pulse" title="Incoming meteor - clear this tile!" aria-label="Incoming meteor impact tile">
          <div className="absolute inset-0 bg-red-600/30 ring-2 ring-inset ring-red-400/80" />
          <span className="relative text-sm drop-shadow">☄️</span>
        </div>
      )}

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
