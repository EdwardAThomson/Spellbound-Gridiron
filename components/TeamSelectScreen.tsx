import React, { useState } from 'react';
import { TeamBlueprint } from '../types';
import { TEAM_BLUEPRINTS } from '../constants';

interface TeamSelectScreenProps {
    onStart: (home: TeamBlueprint, away: TeamBlueprint) => void;
    onBack: () => void;
}

const TEAM_COLOR_CLASSES: Record<string, string> = {
    blue: 'border-blue-500/50 bg-blue-900/20 hover:bg-blue-900/30',
    red: 'border-red-500/50 bg-red-900/20 hover:bg-red-900/30',
    gray: 'border-gray-500/50 bg-gray-900/20 hover:bg-gray-900/30',
    amber: 'border-amber-500/50 bg-amber-900/20 hover:bg-amber-900/30',
    green: 'border-green-500/50 bg-green-900/20 hover:bg-green-900/30',
    orange: 'border-orange-500/50 bg-orange-900/20 hover:bg-orange-900/30',
    white: 'border-white/50 bg-white/5 hover:bg-white/10',
    teal: 'border-teal-500/50 bg-teal-900/20 hover:bg-teal-900/30',
};

const SELECTED_RING: Record<string, string> = {
    blue: 'ring-blue-400',
    red: 'ring-red-400',
    gray: 'ring-gray-400',
    amber: 'ring-amber-400',
    green: 'ring-green-400',
    orange: 'ring-orange-400',
    white: 'ring-white',
    teal: 'ring-teal-400',
};

function TeamCard({ team, isSelected, label, onClick }: {
    team: TeamBlueprint;
    isSelected: boolean;
    label: string | null;
    onClick: () => void;
}) {
    const colorClass = TEAM_COLOR_CLASSES[team.color] ?? 'border-white/20 bg-stone-800';
    const ringClass = SELECTED_RING[team.color] ?? 'ring-white';

    return (
        <button
            onClick={onClick}
            className={`relative text-left p-4 rounded-lg border transition-all ${colorClass} ${isSelected ? `ring-2 ${ringClass} scale-[1.02]` : ''}`}
        >
            {label && (
                <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-widest bg-black/50 px-2 py-0.5 rounded">
                    {label}
                </span>
            )}
            <h3 className="text-lg font-bold text-amber-100">{team.name}</h3>
            <p className="text-xs text-amber-500 mb-2">{team.race}</p>
            <p className="text-xs text-gray-400 mb-3">{team.description}</p>
            <div className="flex flex-wrap gap-1">
                {team.roster.map((role, i) => (
                    <span key={i} className="text-[10px] bg-black/30 px-2 py-0.5 rounded text-gray-300">
                        {role}
                    </span>
                ))}
            </div>
        </button>
    );
}

export default function TeamSelectScreen({ onStart, onBack }: TeamSelectScreenProps) {
    const [homeTeamId, setHomeTeamId] = useState<string | null>(null);
    const [awayTeamId, setAwayTeamId] = useState<string | null>(null);

    const handleTeamClick = (teamId: string) => {
        if (homeTeamId === null) {
            setHomeTeamId(teamId);
        } else if (homeTeamId === teamId) {
            setHomeTeamId(null);
        } else if (awayTeamId === teamId) {
            setAwayTeamId(null);
        } else {
            setAwayTeamId(teamId);
        }
    };

    const homeBlueprint = TEAM_BLUEPRINTS.find(t => t.id === homeTeamId);
    const awayBlueprint = TEAM_BLUEPRINTS.find(t => t.id === awayTeamId);
    const canStart = homeBlueprint && awayBlueprint;

    return (
        <div className="min-h-screen bg-stone-900 text-gray-100 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-stone-950">
                <button
                    onClick={onBack}
                    className="text-sm text-gray-500 hover:text-white transition-colors"
                >
                    &larr; Back
                </button>
                <h1 className="text-2xl font-fantasy text-amber-200 uppercase tracking-tighter">
                    Choose Your Teams
                </h1>
                <div className="w-16" /> {/* Spacer for centering */}
            </div>

            {/* Instructions */}
            <div className="text-center py-4 text-sm text-gray-500">
                {!homeTeamId
                    ? 'Select your HOME team'
                    : !awayTeamId
                        ? 'Now select the AWAY team'
                        : 'Ready to play!'}
            </div>

            {/* Team Grid */}
            <div className="flex-1 overflow-auto px-6 pb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
                    {TEAM_BLUEPRINTS.map(team => {
                        let label: string | null = null;
                        if (team.id === homeTeamId) label = 'HOME';
                        else if (team.id === awayTeamId) label = 'AWAY';

                        return (
                            <TeamCard
                                key={team.id}
                                team={team}
                                isSelected={team.id === homeTeamId || team.id === awayTeamId}
                                label={label}
                                onClick={() => handleTeamClick(team.id)}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/10 bg-stone-950 flex items-center justify-center gap-6">
                <div className="text-center">
                    <span className="text-xs text-gray-500 uppercase tracking-widest">Home</span>
                    <p className="text-amber-200 font-bold">{homeBlueprint?.name ?? '---'}</p>
                </div>
                <span className="text-gray-600 text-lg">VS</span>
                <div className="text-center">
                    <span className="text-xs text-gray-500 uppercase tracking-widest">Away</span>
                    <p className="text-amber-200 font-bold">{awayBlueprint?.name ?? '---'}</p>
                </div>
                <button
                    disabled={!canStart}
                    onClick={() => canStart && onStart(homeBlueprint!, awayBlueprint!)}
                    className="ml-8 px-8 py-3 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-800 disabled:text-stone-600 text-white font-bold uppercase tracking-widest rounded-lg shadow-lg border border-amber-500/30 disabled:border-white/5 transition-all disabled:cursor-not-allowed"
                >
                    Start Match
                </button>
            </div>
        </div>
    );
}
