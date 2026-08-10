import React from 'react';

// The fantasy-styled home screen that replaces the bare start overlay. It offers
// exactly four destinations -- Quick Play, Campaign, Tutorial, Settings -- and is
// reachable again from inside a match (Quit to Menu) and from the game-over
// screen without a page reload. Campaign and Tutorial are wired up by later
// tasks; until their handlers are supplied the buttons render disabled so the
// menu always shows the full, honest set of modes.
interface MainMenuProps {
    onQuickPlay: () => void;
    onSettings: () => void;
    onCampaign?: () => void;
    onTutorial?: () => void;
    // When a started match is paused (Quit to Menu mid-game), offer a way back
    // into it so returning to the menu never strands a running match.
    canResume?: boolean;
    onResume?: () => void;
}

// One menu entry. A missing handler renders the button disabled with a
// "coming soon" hint rather than hiding the mode, so the four modes are always
// visible.
function MenuButton({
    label, hint, icon, onClick, accent,
}: {
    label: string;
    hint: string;
    icon: string;
    onClick?: () => void;
    accent: string;
}) {
    const disabled = !onClick;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={disabled ? 'Coming soon' : hint}
            className={`group relative w-full px-6 py-4 rounded-lg border-2 text-left transition-all ${
                disabled
                    ? 'border-white/5 bg-stone-900/50 opacity-40 cursor-not-allowed'
                    : `border-white/10 bg-stone-900/70 hover:scale-[1.02] active:scale-[0.99] ${accent}`
            }`}
        >
            <div className="flex items-center gap-4">
                <span className="text-3xl drop-shadow">{icon}</span>
                <div>
                    <div className="text-lg font-bold uppercase tracking-widest text-stone-100">{label}</div>
                    <div className="text-[11px] text-stone-400">{disabled ? 'Coming soon' : hint}</div>
                </div>
            </div>
        </button>
    );
}

export default function MainMenu({
    onQuickPlay, onSettings, onCampaign, onTutorial, canResume, onResume,
}: MainMenuProps) {
    return (
        <div
            className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-gradient-to-b from-stone-950 via-stone-900 to-black p-6"
            data-testid="main-menu"
        >
            <div className="w-full max-w-md text-center animate-in fade-in zoom-in duration-500">
                <div className="text-6xl mb-4 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">🌋</div>
                <h1 className="text-5xl font-fantasy text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-purple-300 to-amber-200 uppercase tracking-tighter mb-2">
                    Spellbound Gridiron
                </h1>
                <p className="text-stone-400 font-mono text-xs tracking-widest mb-8 uppercase">
                    Fantasy Football &amp; Arcane Warfare
                </p>

                <div className="space-y-3">
                    {canResume && onResume && (
                        <MenuButton
                            label="Resume Match"
                            hint="Return to the match in progress"
                            icon="⏵"
                            onClick={onResume}
                            accent="hover:border-emerald-400/60 hover:shadow-[0_0_18px_rgba(52,211,153,0.25)]"
                        />
                    )}
                    <MenuButton
                        label="Quick Play"
                        hint="Pick a battlefield and kick off a single match"
                        icon="⚔️"
                        onClick={onQuickPlay}
                        accent="hover:border-amber-400/60 hover:shadow-[0_0_18px_rgba(251,191,36,0.25)]"
                    />
                    <MenuButton
                        label="Campaign"
                        hint="Play a league season"
                        icon="🏆"
                        onClick={onCampaign}
                        accent="hover:border-purple-400/60 hover:shadow-[0_0_18px_rgba(168,85,247,0.25)]"
                    />
                    <MenuButton
                        label="Tutorial"
                        hint="Learn the ropes with a guided match"
                        icon="🎓"
                        onClick={onTutorial}
                        accent="hover:border-sky-400/60 hover:shadow-[0_0_18px_rgba(56,189,248,0.25)]"
                    />
                    <MenuButton
                        label="Settings"
                        hint="Configure AI providers and API keys"
                        icon="⚙️"
                        onClick={onSettings}
                        accent="hover:border-stone-300/60 hover:shadow-[0_0_18px_rgba(214,211,209,0.2)]"
                    />
                </div>

                <div className="mt-8 flex gap-6 justify-center opacity-40">
                    <div className="flex items-center gap-2 text-blue-400 text-xs uppercase font-bold">
                        <span>🛡️</span> High Elves
                    </div>
                    <div className="text-stone-600">VS</div>
                    <div className="flex items-center gap-2 text-red-500 text-xs uppercase font-bold">
                        <span>🪓</span> Dark Orcs
                    </div>
                </div>
            </div>
        </div>
    );
}
