import { PlayerRole, PlayerStats, TerrainType } from './types';

export const ROLE_STATS: Record<PlayerRole, PlayerStats> = {
  [PlayerRole.LINEMAN]: { move: 4, strength: 4, skill: 2, armor: 9 },
  [PlayerRole.BLITZER]: { move: 6, strength: 3, skill: 3, armor: 8 },
  [PlayerRole.CATCHER]: { move: 8, strength: 2, skill: 4, armor: 7 },
  [PlayerRole.QUARTERBACK]: { move: 6, strength: 3, skill: 4, armor: 8 },
  [PlayerRole.WIZARD]: { move: 5, strength: 2, skill: 3, armor: 7 },
};

export const TERRAIN_CONFIG: Record<TerrainType, { name: string; color: string; description: string }> = {
  [TerrainType.GRASS]: { name: 'Elven Fields', color: 'from-green-700 to-green-900', description: 'A pristine, magical glade.' },
  [TerrainType.MUD]: { name: 'Orc Pits', color: 'from-yellow-900 to-stone-800', description: 'Slippery, dirty, and perfect for fighting.' },
  [TerrainType.LAVA]: { name: 'Demon Forge', color: 'from-red-900 to-orange-900', description: 'Don\'t trip, the floor is literally lava.' },
  [TerrainType.ICE]: { name: 'Frozen Wastes', color: 'from-cyan-800 to-blue-900', description: 'Chilly winds and slippery footing.' },
};

export const SPELLS = {
  FIREBALL: { name: 'Fireball', cost: 3, range: 4, description: 'Knock down an opponent.' },
  TELEPORT: { name: 'Blink', cost: 4, range: 5, description: 'Teleport to an empty square.' },
  HEAL: { name: 'Revitalize', cost: 2, range: 1, description: 'Remove stun from an adjacent ally.' },
};
