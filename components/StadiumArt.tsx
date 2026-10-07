import React, { useId } from 'react';
import { Stadium } from '../services/stadiums';

// Inline SVG illustrations of each club's home stadium, drawn the same way as
// the per-terrain tile art in BoardTile: no image assets, just shapes. Each
// scene is a 320x140 banner (sky/backdrop, stands with a crowd, a pitch in
// perspective) with set-dressing unique to the venue, and the home club's
// colour on its pennants. Decorative only; all venue data lives in
// services/stadiums.ts.

export const CLUB_COLORS: Record<string, string> = {
    red: '#dc2626',
    blue: '#3b82f6',
    gold: '#eab308',
    purple: '#a855f7',
};

// Small deterministic jitter so crowds and stars look scattered, not gridded.
export const jitter = (i: number, salt: number) => {
    const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
    return s - Math.floor(s);
};

/** The playing surface: a trapezoid in perspective with yard lines. */
const Pitch: React.FC<{ fill: string; line: string; stripe?: string }> = ({ fill, line, stripe }) => (
    <g>
        <polygon points="30,140 290,140 236,94 84,94" fill={fill} />
        {stripe && [0, 2, 4].map((i) => {
            const t0 = i / 6, t1 = (i + 1) / 6;
            const y0 = 94 + 46 * t0, y1 = 94 + 46 * t1;
            const l0 = 84 - 54 * t0, l1 = 84 - 54 * t1;
            return <polygon key={i} points={`${l0},${y0} ${320 - l0},${y0} ${320 - l1},${y1} ${l1},${y1}`} fill={stripe} />;
        })}
        {[0.25, 0.5, 0.75].map((t) => (
            <line key={t} x1={84 - 54 * t} y1={94 + 46 * t} x2={236 + 54 * t} y2={94 + 46 * t} stroke={line} strokeWidth={t === 0.5 ? 1.2 : 0.6} opacity={0.6} />
        ))}
        <polygon points="30,140 290,140 236,94 84,94" fill="none" stroke={line} strokeWidth="1" opacity="0.7" />
    </g>
);

/** A banked stand of spectators between two y values. */
const Crowd: React.FC<{ y0: number; y1: number; colors: string[]; salt: number; x0?: number; x1?: number }> = ({ y0, y1, colors, salt, x0 = 0, x1 = 320 }) => {
    const heads: React.ReactNode[] = [];
    let i = 0;
    for (let y = y0; y < y1; y += 5) {
        for (let x = x0 + (y % 2 ? 2 : 0); x < x1; x += 5) {
            heads.push(
                <circle key={i} cx={x + jitter(i, salt) * 2} cy={y + jitter(i, salt + 1) * 1.5} r={1.4} fill={colors[Math.floor(jitter(i, salt + 2) * colors.length)]} />
            );
            i++;
        }
    }
    return <g opacity={0.9}>{heads}</g>;
};

const Pennant: React.FC<{ x: number; y: number; color: string; flip?: boolean }> = ({ x, y, color, flip }) => (
    <g>
        <line x1={x} y1={y} x2={x} y2={y + 18} stroke="#1c1917" strokeWidth="1.2" />
        <polygon points={flip ? `${x},${y} ${x - 11},${y + 3.5} ${x},${y + 7}` : `${x},${y} ${x + 11},${y + 3.5} ${x},${y + 7}`} fill={color} />
    </g>
);

const MoongladeBowl: React.FC<{ id: string; club: string }> = ({ id, club }) => (
    <>
        <defs>
            <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#0b1530" />
                <stop offset="1" stopColor="#24456b" />
            </linearGradient>
            <radialGradient id={`${id}-lantern`}>
                <stop offset="0" stopColor="#fde68a" stopOpacity="0.9" />
                <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
            </radialGradient>
        </defs>
        <rect width="320" height="140" fill={`url(#${id}-sky)`} />
        {Array.from({ length: 30 }, (_, i) => (
            <circle key={i} cx={jitter(i, 1) * 320} cy={jitter(i, 2) * 50} r={jitter(i, 3) * 0.9 + 0.3} fill="#e0f2fe" opacity={0.4 + jitter(i, 4) * 0.6} />
        ))}
        {/* Crescent moon */}
        <circle cx="214" cy="14" r="9" fill="#f1f5f9" />
        <circle cx="218" cy="11" r="8.5" fill="#0e1936" />
        {/* Living-tree stands: two great trees whose canopies arch over the bowl */}
        <path d="M0,96 Q60,58 160,60 Q260,58 320,96 L320,140 L0,140 Z" fill="#14321f" />
        <Crowd y0={66} y1={92} colors={['#bbf7d0', '#fef9c3', '#93c5fd', club]} salt={11} />
        <path d="M22,140 C26,100 16,70 30,40 L40,40 C48,72 40,100 46,140 Z" fill="#5b4636" />
        <path d="M274,140 C280,100 272,72 280,40 L290,40 C304,70 294,100 298,140 Z" fill="#5b4636" />
        <ellipse cx="38" cy="34" rx="44" ry="22" fill="#1f6b3a" />
        <ellipse cx="282" cy="34" rx="44" ry="22" fill="#1f6b3a" />
        <ellipse cx="52" cy="26" rx="26" ry="12" fill="#2d8a4e" />
        <ellipse cx="268" cy="26" rx="26" ry="12" fill="#2d8a4e" />
        <path d="M70,40 Q160,4 250,40" stroke="#2d8a4e" strokeWidth="5" fill="none" />
        {/* Hanging lanterns along the vine arch */}
        {[100, 130, 160, 190, 220].map((x, i) => {
            const y = 40 - Math.sin((i + 0.5) / 5 * Math.PI) * 15 + 10;
            return (
                <g key={x}>
                    <line x1={x} y1={y - 8} x2={x} y2={y} stroke="#2d8a4e" strokeWidth="0.8" />
                    <circle cx={x} cy={y + 2} r="7" fill={`url(#${id}-lantern)`} />
                    <circle cx={x} cy={y + 2} r="1.8" fill="#fef3c7" />
                </g>
            );
        })}
        <Pitch fill="#2f6b2f" stripe="#367a36" line="#d9f99d" />
        <Pennant x={70} y={74} color={club} />
        <Pennant x={250} y={74} color={club} flip />
    </>
);

const TheGutterpit: React.FC<{ id: string; club: string }> = ({ id, club }) => (
    <>
        <defs>
            <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#2b2f33" />
                <stop offset="1" stopColor="#5c5348" />
            </linearGradient>
            <radialGradient id={`${id}-fire`}>
                <stop offset="0" stopColor="#fb923c" stopOpacity="0.8" />
                <stop offset="1" stopColor="#fb923c" stopOpacity="0" />
            </radialGradient>
        </defs>
        <rect width="320" height="140" fill={`url(#${id}-sky)`} />
        {/* Storm clouds */}
        <ellipse cx="70" cy="16" rx="60" ry="14" fill="#1f2326" opacity="0.8" />
        <ellipse cx="220" cy="12" rx="80" ry="16" fill="#1f2326" opacity="0.8" />
        {/* Earth banks with a jeering crowd */}
        <path d="M0,58 L320,58 L320,140 L0,140 Z" fill="#3a2a1c" />
        <Crowd y0={60} y1={82} colors={['#65a30d', '#4d7c0f', '#a3a3a3', club]} salt={21} />
        {/* Spiked palisade around the pit */}
        {Array.from({ length: 33 }, (_, i) => {
            const x = i * 10;
            const h = 14 + jitter(i, 5) * 6;
            return <polygon key={i} points={`${x},94 ${x + 8},94 ${x + 8},${94 - h + 4} ${x + 4},${94 - h} ${x},${94 - h + 4}`} fill={i % 2 ? '#6b4423' : '#7c4f2a'} stroke="#2b1a0e" strokeWidth="0.6" />;
        })}
        {/* Skulls on a few stakes */}
        {[40, 150, 260].map((x) => (
            <g key={x}>
                <circle cx={x + 4} cy={74} r="3.2" fill="#e7e5e4" />
                <circle cx={x + 3} cy={73.5} r="0.7" fill="#1c1917" />
                <circle cx={x + 5} cy={73.5} r="0.7" fill="#1c1917" />
            </g>
        ))}
        {/* Torches */}
        {[90, 230].map((x) => (
            <g key={x}>
                <circle cx={x} cy={62} r="14" fill={`url(#${id}-fire)`} />
                <line x1={x} y1={64} x2={x} y2={92} stroke="#3f2a17" strokeWidth="2" />
                <path d={`M${x - 3},64 Q${x},52 ${x + 3},64 Z`} fill="#f97316" />
                <path d={`M${x - 1.5},64 Q${x},57 ${x + 1.5},64 Z`} fill="#fde047" />
            </g>
        ))}
        <Pitch fill="#553a24" stripe="#4b3320" line="#a8a29e" />
        {[[110, 112, 14], [200, 126, 18], [160, 102, 9]].map(([cx, cy, rx]) => (
            <ellipse key={cx} cx={cx} cy={cy} rx={rx} ry={rx / 4} fill="#2f2013" opacity="0.7" />
        ))}
        {/* Driving rain */}
        {Array.from({ length: 40 }, (_, i) => {
            const x = jitter(i, 9) * 330;
            const y = jitter(i, 10) * 130;
            return <line key={i} x1={x} y1={y} x2={x - 4} y2={y + 10} stroke="#cbd5e1" strokeWidth="0.6" opacity="0.35" />;
        })}
        <Pennant x={20} y={52} color={club} />
        <Pennant x={300} y={52} color={club} flip />
    </>
);

const AnvilholdForge: React.FC<{ id: string; club: string }> = ({ id, club }) => (
    <>
        <defs>
            <linearGradient id={`${id}-hall`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#0c0a09" />
                <stop offset="1" stopColor="#3b1d0e" />
            </linearGradient>
            <linearGradient id={`${id}-lava`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#f97316" />
                <stop offset="0.5" stopColor="#fde047" />
                <stop offset="1" stopColor="#f97316" />
            </linearGradient>
            <radialGradient id={`${id}-glow`} cx="0.5" cy="1" r="0.8">
                <stop offset="0" stopColor="#ea580c" stopOpacity="0.55" />
                <stop offset="1" stopColor="#ea580c" stopOpacity="0" />
            </radialGradient>
        </defs>
        <rect width="320" height="140" fill={`url(#${id}-hall)`} />
        {/* Carved mountain hall: a great vaulted arch over the field */}
        <path d="M40,140 L40,60 Q160,-20 280,60 L280,140" fill="#292524" />
        <path d="M58,140 L58,64 Q160,0 262,64 L262,140" fill="#1c1917" />
        {/* Tiered stone galleries with the crowd */}
        <rect x="58" y="64" width="204" height="30" fill="#292524" />
        <Crowd y0={66} y1={92} x0={60} x1={260} colors={['#eab308', '#a8a29e', '#b45309', club]} salt={31} />
        {/* Rune-cut pillars */}
        {[40, 262].map((x) => (
            <g key={x}>
                <rect x={x} y="40" width="18" height="100" fill="#44403c" stroke="#1c1917" />
                {[56, 76, 96, 116].map((y) => (
                    <path key={y} d={`M${x + 5},${y} L${x + 9},${y + 6} L${x + 13},${y}`} stroke="#fb923c" strokeWidth="1" fill="none" opacity="0.8" />
                ))}
            </g>
        ))}
        {/* The anvil crest at the keystone */}
        <g transform="translate(160 26)">
            <path d="M-16,-4 L12,-4 Q20,-4 22,0 L8,2 L6,8 L10,12 L-10,12 L-6,8 L-8,2 L-16,2 Z" fill="#a8a29e" stroke="#eab308" strokeWidth="1" />
        </g>
        {/* Hanging chains */}
        {[100, 220].map((x) => (
            <g key={x}>
                {Array.from({ length: 6 }, (_, i) => (
                    <ellipse key={i} cx={x} cy={22 + i * 5} rx="1.5" ry="2.5" fill="none" stroke="#57534e" strokeWidth="0.8" />
                ))}
            </g>
        ))}
        <rect width="320" height="140" fill={`url(#${id}-glow)`} />
        <Pitch fill="#3b1d0e" stripe="#451f0d" line="#fdba74" />
        {/* Molten channels crossing the pitch */}
        <path d="M60,116 Q120,110 160,118 T262,114" stroke={`url(#${id}-lava)`} strokeWidth="3" fill="none" />
        <path d="M48,130 Q110,124 170,132 T276,128" stroke={`url(#${id}-lava)`} strokeWidth="2.5" fill="none" />
        <Pennant x={66} y={46} color={club} />
        <Pennant x={254} y={46} color={club} flip />
    </>
);

const Barrowfrost: React.FC<{ id: string; club: string }> = ({ id, club }) => (
    <>
        <defs>
            <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#0b1020" />
                <stop offset="1" stopColor="#1e1b4b" />
            </linearGradient>
            <radialGradient id={`${id}-gate`}>
                <stop offset="0" stopColor="#a855f7" stopOpacity="0.8" />
                <stop offset="1" stopColor="#a855f7" stopOpacity="0" />
            </radialGradient>
        </defs>
        <rect width="320" height="140" fill={`url(#${id}-sky)`} />
        {/* Aurora */}
        <path d="M-10,30 Q60,6 130,26 T270,18 T340,28" stroke="#4ade80" strokeWidth="7" fill="none" opacity="0.35" />
        <path d="M-10,40 Q80,18 160,36 T340,30" stroke="#22d3ee" strokeWidth="4" fill="none" opacity="0.3" />
        {/* Ice spires */}
        {[[14, 54], [36, 38], [286, 40], [306, 56]].map(([x, top]) => (
            <polygon key={x} points={`${x - 9},96 ${x},${top} ${x + 9},96`} fill="#bae6fd" stroke="#7dd3fc" strokeWidth="0.6" opacity="0.9" />
        ))}
        {/* Grave-mound terraces with a spectral crowd */}
        <path d="M44,96 Q160,52 276,96 Z" fill="#1e293b" />
        <Crowd y0={70} y1={92} x0={70} x1={250} colors={['#c4b5fd', '#94a3b8', '#86efac', club]} salt={41} />
        {/* Crypt gate at the far end */}
        <circle cx="160" cy="62" r="22" fill={`url(#${id}-gate)`} />
        <path d="M146,94 L146,62 Q160,46 174,62 L174,94 Z" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
        {[151, 156, 161, 166, 171].map((x) => (
            <line key={x} x1={x} y1={58} x2={x} y2={94} stroke="#475569" strokeWidth="0.8" />
        ))}
        {/* Tombstones */}
        {[66, 94, 226, 254].map((x, i) => (
            <g key={x}>
                <path d={`M${x - 5},96 L${x - 5},${84 + i % 2 * 2} Q${x},${78 + i % 2 * 2} ${x + 5},${84 + i % 2 * 2} L${x + 5},96 Z`} fill="#64748b" stroke="#334155" strokeWidth="0.6" />
                <line x1={x} y1={85 + i % 2 * 2} x2={x} y2={92} stroke="#334155" strokeWidth="0.8" />
                <line x1={x - 2} y1={87 + i % 2 * 2} x2={x + 2} y2={87 + i % 2 * 2} stroke="#334155" strokeWidth="0.8" />
            </g>
        ))}
        <Pitch fill="#9cc9e8" stripe="#b3d9f2" line="#f0f9ff" />
        {/* Cracks in the ice */}
        <path d="M110,108 L122,114 L118,122 L132,130" stroke="#e0f2fe" strokeWidth="0.8" fill="none" />
        <path d="M206,104 L198,116 L210,124" stroke="#e0f2fe" strokeWidth="0.8" fill="none" />
        {/* Snow */}
        {Array.from({ length: 36 }, (_, i) => (
            <circle key={i} cx={jitter(i, 51) * 320} cy={jitter(i, 52) * 140} r={0.6 + jitter(i, 53) * 0.8} fill="#f8fafc" opacity="0.7" />
        ))}
        <Pennant x={48} y={72} color={club} />
        <Pennant x={272} y={72} color={club} flip />
    </>
);

const NeutralGround: React.FC<{ id: string; club: string }> = ({ id, club }) => (
    <>
        <defs>
            <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#7dd3fc" />
                <stop offset="1" stopColor="#e0f2fe" />
            </linearGradient>
        </defs>
        <rect width="320" height="140" fill={`url(#${id}-sky)`} />
        <path d="M0,94 Q160,60 320,94 L320,140 L0,140 Z" fill="#65a30d" />
        <rect x="70" y="72" width="180" height="22" fill="#78716c" />
        <Crowd y0={74} y1={92} x0={72} x1={248} colors={['#e7e5e4', '#a8a29e', club]} salt={61} />
        <Pitch fill="#3f7f3f" stripe="#468c46" line="#ecfccb" />
        <Pennant x={70} y={56} color={club} />
        <Pennant x={250} y={56} color={club} flip />
    </>
);

const SCENES: Record<string, React.FC<{ id: string; club: string }>> = {
    'moonglade-bowl': MoongladeBowl,
    'the-gutterpit': TheGutterpit,
    'anvilhold-forge': AnvilholdForge,
    'barrowfrost': Barrowfrost,
};

interface StadiumArtProps {
    stadium: Stadium;
    /** The home club's colour name (red / blue / gold / purple) for its pennants. */
    clubColor?: string;
    className?: string;
}

export default function StadiumArt({ stadium, clubColor, className }: StadiumArtProps) {
    // Unique per instance so two banners on one page don't share gradient ids.
    const id = `stadium-${useId().replace(/:/g, '')}`;
    const Scene = SCENES[stadium.id] ?? NeutralGround;
    const club = CLUB_COLORS[clubColor ?? ''] ?? '#e7e5e4';
    return (
        <svg
            viewBox="0 0 320 140"
            className={className}
            role="img"
            aria-label={`${stadium.name}: ${stadium.tagline}`}
            data-testid={`stadium-art-${stadium.id}`}
            preserveAspectRatio="xMidYMid slice"
        >
            <Scene id={id} club={club} />
        </svg>
    );
}
