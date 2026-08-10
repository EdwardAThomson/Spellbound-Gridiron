import React from 'react';
import {
    CampaignState, computeStandings, nextFixture, isAiFixture, isSeasonComplete, champion,
} from '../services/campaign';

// The campaign hub: a league dashboard sitting on top of the pure model in
// services/campaign.ts. It renders the standings table (3-1-0), the next
// fixture, and a single Continue control whose behaviour depends on that
// fixture -- a live "Play Match" when the player's team is involved, an instant
// "Simulate" for an AI-vs-AI fixture. When every fixture is played it flips to a
// season-complete screen crowning the champion and offering a new season. All
// gameplay/persistence logic lives in App/services; this is presentation only.
interface CampaignHubProps {
    campaign: CampaignState;
    onPlayMatch: () => void;
    onSimulate: () => void;
    onNewSeason: () => void;
    onBack: () => void;
}

export default function CampaignHub({
    campaign, onPlayMatch, onSimulate, onNewSeason, onBack,
}: CampaignHubProps) {
    const teamName = (id: string) => campaign.teams.find((t) => t.id === id)?.name ?? id;
    const standings = computeStandings(campaign.teams.map((t) => t.id), campaign.fixtures);
    const played = campaign.fixtures.filter((f) => f.played).length;
    const total = campaign.fixtures.length;
    const complete = isSeasonComplete(campaign.fixtures);
    const upcoming = nextFixture(campaign.fixtures);
    const playerUpNext = upcoming ? !isAiFixture(upcoming, campaign.playerTeamId) : false;
    const winner = champion(campaign);

    return (
        <div
            className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-gradient-to-b from-stone-950 via-stone-900 to-black p-6 overflow-auto"
            data-testid="campaign-hub"
        >
            <div className="w-full max-w-2xl">
                <div className="text-center mb-6">
                    <div className="text-5xl mb-2 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">🏆</div>
                    <h1 className="text-4xl font-fantasy text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-purple-300 to-amber-200 uppercase tracking-tighter">
                        Campaign
                    </h1>
                    <p className="text-stone-400 font-mono text-xs tracking-widest mt-1 uppercase">
                        Season {campaign.season} &middot;{' '}
                        <span data-testid="campaign-fixtures-played">{played} / {total} fixtures played</span>
                    </p>
                </div>

                {/* Standings table (played / won / drawn / lost / points, 3-1-0). */}
                <div className="bg-black/40 rounded-xl border border-white/10 overflow-hidden mb-6" data-testid="campaign-standings">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[10px] uppercase tracking-widest text-stone-500 bg-stone-900/80">
                                <th className="text-left px-3 py-2">#</th>
                                <th className="text-left px-3 py-2">Team</th>
                                <th className="px-2 py-2" title="Played">P</th>
                                <th className="px-2 py-2" title="Won">W</th>
                                <th className="px-2 py-2" title="Drawn">D</th>
                                <th className="px-2 py-2" title="Lost">L</th>
                                <th className="px-3 py-2" title="Points">Pts</th>
                            </tr>
                        </thead>
                        <tbody>
                            {standings.map((row, i) => {
                                const isPlayer = row.teamId === campaign.playerTeamId;
                                return (
                                    <tr
                                        key={row.teamId}
                                        data-testid={`standings-row-${row.teamId}`}
                                        className={`border-t border-white/5 ${isPlayer ? 'bg-blue-900/30 text-blue-100' : 'text-stone-200'}`}
                                    >
                                        <td className="px-3 py-2 text-stone-500">{i + 1}</td>
                                        <td className="px-3 py-2 font-bold">
                                            {teamName(row.teamId)}
                                            {isPlayer && <span className="ml-2 text-[9px] uppercase tracking-widest text-blue-300/80">You</span>}
                                        </td>
                                        <td className="px-2 py-2 text-center text-stone-400">{row.played}</td>
                                        <td className="px-2 py-2 text-center">{row.won}</td>
                                        <td className="px-2 py-2 text-center">{row.drawn}</td>
                                        <td className="px-2 py-2 text-center">{row.lost}</td>
                                        <td className="px-3 py-2 text-center font-bold text-amber-200">{row.points}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Season complete -> crown the champion and offer a new season. */}
                {complete ? (
                    <div className="text-center bg-black/40 rounded-xl border border-amber-500/30 p-6" data-testid="campaign-champion">
                        <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Season {campaign.season} champions</p>
                        <p className="text-3xl font-fantasy text-amber-200 mb-4">{winner ? teamName(winner.teamId) : '—'}</p>
                        <button
                            type="button"
                            onClick={onNewSeason}
                            data-testid="campaign-new-season"
                            className="px-8 py-3 bg-purple-700 hover:bg-purple-600 text-white rounded-lg font-bold uppercase tracking-widest transition-colors"
                        >
                            Start New Season
                        </button>
                    </div>
                ) : (
                    /* Next fixture + the contextual Continue control. */
                    <div className="bg-black/40 rounded-xl border border-white/10 p-5" data-testid="campaign-next-fixture">
                        <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-2 text-center">Next fixture</p>
                        <div className="flex items-center justify-center gap-4 text-lg font-bold mb-4">
                            <span className="text-blue-300">{upcoming ? teamName(upcoming.homeId) : ''}</span>
                            <span className="text-xs text-stone-600">VS</span>
                            <span className="text-red-300">{upcoming ? teamName(upcoming.awayId) : ''}</span>
                        </div>
                        <button
                            type="button"
                            onClick={playerUpNext ? onPlayMatch : onSimulate}
                            data-testid="campaign-advance"
                            className={`w-full py-4 rounded-lg font-bold uppercase tracking-widest transition-colors ${
                                playerUpNext
                                    ? 'bg-amber-700 hover:bg-amber-600 text-white'
                                    : 'bg-purple-700 hover:bg-purple-600 text-white'
                            }`}
                        >
                            {playerUpNext ? '⚔️ Play Your Match' : '⏩ Simulate Next Fixture'}
                        </button>
                    </div>
                )}

                <div className="mt-6 text-center">
                    <button
                        type="button"
                        onClick={onBack}
                        className="text-sm text-stone-400 hover:text-stone-200 underline underline-offset-4"
                    >
                        🏠 Back to Menu
                    </button>
                </div>
            </div>
        </div>
    );
}
