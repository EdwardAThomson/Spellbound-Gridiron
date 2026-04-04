import { PlayerRole, PlayerStats, TerrainType, SpellKey, SpellDefinition, TeamBlueprint } from './types';

export const ROLE_STATS: Record<PlayerRole, PlayerStats> = {
  [PlayerRole.LINEMAN]:     { move: 4, strength: 4, skill: 2, armor: 9 },
  [PlayerRole.BLITZER]:     { move: 6, strength: 3, skill: 3, armor: 8 },
  [PlayerRole.CATCHER]:     { move: 8, strength: 2, skill: 4, armor: 7 },
  [PlayerRole.QUARTERBACK]: { move: 6, strength: 3, skill: 4, armor: 8 },
  [PlayerRole.WIZARD]:      { move: 5, strength: 2, skill: 3, armor: 7 },
  [PlayerRole.BERSERKER]:   { move: 5, strength: 3, skill: 2, armor: 7 },
  [PlayerRole.ASSASSIN]:    { move: 7, strength: 2, skill: 4, armor: 6 },
  [PlayerRole.BEASTMASTER]: { move: 5, strength: 3, skill: 3, armor: 8 },
};

export const TERRAIN_CONFIG: Record<TerrainType, { name: string; color: string; description: string }> = {
  [TerrainType.GRASS]: { name: 'Elven Fields', color: 'from-green-700 to-green-900', description: 'A pristine, magical glade.' },
  [TerrainType.MUD]: { name: 'Orc Pits', color: 'from-yellow-900 to-stone-800', description: 'Slippery, dirty, and perfect for fighting.' },
  [TerrainType.LAVA]: { name: 'Demon Forge', color: 'from-red-900 to-orange-900', description: 'Don\'t trip, the floor is literally lava.' },
  [TerrainType.ICE]: { name: 'Frozen Wastes', color: 'from-cyan-800 to-blue-900', description: 'Chilly winds and slippery footing.' },
};

export const SPELLS: Record<SpellKey, SpellDefinition> = {
  [SpellKey.FIREBALL]: { name: 'Fireball', cost: 3, range: 4, description: 'Knock down an opponent.' },
  [SpellKey.TELEPORT]: { name: 'Blink', cost: 4, range: 5, description: 'Teleport to an empty square.' },
  [SpellKey.HEAL]: { name: 'Revitalize', cost: 2, range: 1, description: 'Remove stun from an adjacent ally.' },
};

export const TEAM_BLUEPRINTS: TeamBlueprint[] = [
  {
    id: 'elven-vanguard',
    name: 'Elven Vanguard',
    race: 'High Elves',
    color: 'blue',
    roster: [PlayerRole.CATCHER, PlayerRole.CATCHER, PlayerRole.QUARTERBACK, PlayerRole.ASSASSIN, PlayerRole.WIZARD],
    description: 'Swift and graceful. Masters of the passing game with a deadly shadow striker.',
  },
  {
    id: 'orc-bashers',
    name: 'Orc Bashers',
    race: 'Dark Orcs',
    color: 'red',
    roster: [PlayerRole.LINEMAN, PlayerRole.BERSERKER, PlayerRole.BLITZER, PlayerRole.BLITZER, PlayerRole.QUARTERBACK],
    description: 'Why pass when you can smash? Pure brute force with a raging berserker.',
  },
  {
    id: 'undead-legion',
    name: 'Undead Legion',
    race: 'Undead',
    color: 'gray',
    roster: [PlayerRole.LINEMAN, PlayerRole.LINEMAN, PlayerRole.BEASTMASTER, PlayerRole.BLITZER, PlayerRole.WIZARD],
    description: 'Relentless and hard to put down. Their beastmaster calls skeletal wolves from the grave.',
  },
  {
    id: 'dwarven-ironwall',
    name: 'Dwarven Ironwall',
    race: 'Dwarves',
    color: 'amber',
    roster: [PlayerRole.LINEMAN, PlayerRole.LINEMAN, PlayerRole.BERSERKER, PlayerRole.QUARTERBACK, PlayerRole.LINEMAN],
    description: 'Short but immovable. An armored wall with a berserker ready to erupt.',
  },
  {
    id: 'skaven-swarm',
    name: 'Skaven Swarm',
    race: 'Ratfolk',
    color: 'green',
    roster: [PlayerRole.CATCHER, PlayerRole.CATCHER, PlayerRole.ASSASSIN, PlayerRole.BLITZER, PlayerRole.QUARTERBACK],
    description: 'Scurrying chaos. Blazing speed and sneaky backstabs from the shadows.',
  },
  {
    id: 'demon-hellfire',
    name: 'Demon Hellfire',
    race: 'Demons',
    color: 'orange',
    roster: [PlayerRole.WIZARD, PlayerRole.WIZARD, PlayerRole.BERSERKER, PlayerRole.LINEMAN, PlayerRole.QUARTERBACK],
    description: 'Sorcery, brimstone, and demonic rage. A terrifying combination.',
  },
  {
    id: 'human-crusaders',
    name: 'Human Crusaders',
    race: 'Humans',
    color: 'white',
    roster: [PlayerRole.LINEMAN, PlayerRole.BLITZER, PlayerRole.QUARTERBACK, PlayerRole.CATCHER, PlayerRole.BEASTMASTER],
    description: 'Jack of all trades. A balanced roster with a loyal war hound at their side.',
  },
  {
    id: 'lizardfolk-predators',
    name: 'Lizardfolk Predators',
    race: 'Lizardfolk',
    color: 'teal',
    roster: [PlayerRole.BEASTMASTER, PlayerRole.LINEMAN, PlayerRole.BLITZER, PlayerRole.BLITZER, PlayerRole.CATCHER],
    description: 'Ancient and powerful. Their beast-tamers call raptors to hunt the field.',
  },
];
