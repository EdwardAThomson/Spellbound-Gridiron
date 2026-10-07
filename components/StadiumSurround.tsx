import React, { useLayoutEffect, useMemo, useRef, useState, useId } from 'react';
import { Stadium } from '../services/stadiums';
import { CLUB_COLORS, jitter } from './StadiumArt';

// A top-down stadium drawn around the live board: banked stands on all four
// sides with a crowd in them, a wall at the pitch edge, and set-dressing for
// the venue (Moonglade's trees, the Gutterpit's palisade, Anvilhold's lava moat,
// Barrowfrost's ice spires and graves). It wraps the board as padding plus an
// SVG behind it, sized to the measured layout so the crowd stays round. Purely
// decorative: pointer-events are off and the board inside is untouched.

interface Theme {
    outer: string;
    stand: string;
    tier: string;
    wall: string;
    crowd: string[];
}

const THEMES: Record<string, Theme> = {
    'moonglade-bowl': { outer: '#0f2a1a', stand: '#1d4a2c', tier: '#2d6a40', wall: '#a3e635', crowd: ['#bbf7d0', '#fef9c3', '#93c5fd', '#f0abfc'] },
    'the-gutterpit': { outer: '#2b1d12', stand: '#4a3220', tier: '#5e4029', wall: '#7c4f2a', crowd: ['#65a30d', '#4d7c0f', '#a3a3a3', '#84cc16'] },
    'anvilhold-forge': { outer: '#1c1917', stand: '#3a3532', tier: '#57534e', wall: '#f97316', crowd: ['#eab308', '#a8a29e', '#b45309', '#fcd34d'] },
    'barrowfrost': { outer: '#0b1020', stand: '#1e293b', tier: '#334155', wall: '#7dd3fc', crowd: ['#c4b5fd', '#94a3b8', '#86efac', '#e2e8f0'] },
    'neutral-ground': { outer: '#44403c', stand: '#57534e', tier: '#78716c', wall: '#e7e5e4', crowd: ['#e7e5e4', '#a8a29e', '#fca5a5', '#93c5fd'] },
};

interface Box { w: number; h: number; x0: number; y0: number; x1: number; y1: number }

const CROWD_STEP = 7;
/** Largest stadium edge we draw, in px; a real board is well under this. */
const MAX_SIDE = 3000;

/** Spectator dots filling the stands, between the pitch wall and the outer decor margin. */
const crowdDots = (b: Box, colors: string[], margin: number) => {
    const dots: React.ReactNode[] = [];
    let i = 0;
    for (let y = margin; y < b.h - margin; y += CROWD_STEP) {
        for (let x = margin + ((y / CROWD_STEP) % 2 ? CROWD_STEP / 2 : 0); x < b.w - margin; x += CROWD_STEP) {
            const inPitch = x > b.x0 - 7 && x < b.x1 + 7 && y > b.y0 - 7 && y < b.y1 + 7;
            if (!inPitch && jitter(i, 3) > 0.12) {
                dots.push(
                    <circle
                        key={i}
                        cx={x + (jitter(i, 1) - 0.5) * 2}
                        cy={y + (jitter(i, 2) - 0.5) * 2}
                        r={1.9}
                        fill={colors[Math.floor(jitter(i, 4) * colors.length)]}
                    />
                );
            }
            i++;
        }
    }
    return dots;
};

/** Points spaced evenly around a rectangle's perimeter, inset by `inset`. */
const perimeter = (b: Box, inset: number, step: number) => {
    const pts: [number, number][] = [];
    const x0 = inset, y0 = inset, x1 = b.w - inset, y1 = b.h - inset;
    for (let x = x0; x <= x1; x += step) { pts.push([x, y0]); pts.push([x, y1]); }
    for (let y = y0 + step; y < y1; y += step) { pts.push([x0, y]); pts.push([x1, y]); }
    return pts;
};

const corners = (b: Box, inset: number): [number, number][] => [
    [inset, inset], [b.w - inset, inset], [inset, b.h - inset], [b.w - inset, b.h - inset],
];

const Decor: React.FC<{ id: string; stadiumId: string; b: Box; club: string }> = ({ id, stadiumId, b, club }) => {
    const midX = b.w / 2;
    switch (stadiumId) {
        case 'moonglade-bowl':
            return (
                <g>
                    {perimeter(b, 2, 22).map(([x, y], i) => (
                        <g key={i}>
                            <circle cx={x} cy={y} r={9 + jitter(i, 7) * 4} fill={i % 3 ? '#1f6b3a' : '#2d8a4e'} />
                            <circle cx={x - 2} cy={y - 2} r={4 + jitter(i, 8) * 2} fill="#3fa564" opacity="0.7" />
                        </g>
                    ))}
                    {[...corners(b, 16), [midX, 16] as [number, number], [midX, b.h - 16] as [number, number]].map(([x, y], i) => (
                        <g key={`l${i}`}>
                            <circle cx={x} cy={y} r="11" fill={`url(#${id}-glow)`} />
                            <circle cx={x} cy={y} r="2.5" fill="#fef3c7" />
                        </g>
                    ))}
                </g>
            );
        case 'the-gutterpit':
            return (
                <g>
                    {perimeter(b, 4, 7).map(([x, y], i) => (
                        <circle key={i} cx={x} cy={y} r="3.6" fill={i % 2 ? '#6b4423' : '#7c4f2a'} stroke="#2b1a0e" strokeWidth="0.8" />
                    ))}
                    {corners(b, 16).map(([x, y], i) => (
                        <g key={`t${i}`}>
                            <circle cx={x} cy={y} r="16" fill={`url(#${id}-glow)`} />
                            <circle cx={x} cy={y} r="3.5" fill="#f97316" />
                            <circle cx={x} cy={y} r="1.6" fill="#fde047" />
                        </g>
                    ))}
                    {[[midX - 40, b.h - 12], [midX + 40, b.h - 12], [12, b.h / 2], [b.w - 12, b.h / 2]].map(([x, y], i) => (
                        <g key={`s${i}`}>
                            <circle cx={x} cy={y} r="4" fill="#e7e5e4" />
                            <circle cx={x - 1.4} cy={y - 0.6} r="0.9" fill="#1c1917" />
                            <circle cx={x + 1.4} cy={y - 0.6} r="0.9" fill="#1c1917" />
                        </g>
                    ))}
                </g>
            );
        case 'anvilhold-forge':
            return (
                <g>
                    {/* Lava moat between the stands and the pitch */}
                    <rect x={b.x0 - 5} y={b.y0 - 5} width={b.x1 - b.x0 + 10} height={b.y1 - b.y0 + 10} rx="4" fill="none" stroke="#ea580c" strokeWidth="9" opacity="0.35" />
                    <rect x={b.x0 - 5} y={b.y0 - 5} width={b.x1 - b.x0 + 10} height={b.y1 - b.y0 + 10} rx="4" fill="none" stroke={`url(#${id}-lava)`} strokeWidth="3" />
                    {/* Outer wall of cut stone blocks */}
                    {perimeter(b, 4, 14).map(([x, y], i) => (
                        <rect key={i} x={x - 6} y={y - 4} width="12" height="8" fill={i % 2 ? '#44403c' : '#57534e'} stroke="#1c1917" strokeWidth="0.8" />
                    ))}
                    {/* Rune pillars at the corners */}
                    {corners(b, 14).map(([x, y], i) => (
                        <g key={`p${i}`}>
                            <rect x={x - 11} y={y - 11} width="22" height="22" fill="#44403c" stroke="#1c1917" strokeWidth="1.5" />
                            <path d={`M${x - 5},${y - 3} L${x},${y + 4} L${x + 5},${y - 3}`} stroke="#fb923c" strokeWidth="1.6" fill="none" />
                        </g>
                    ))}
                    {/* Anvil crests at each end */}
                    {[14, b.h - 14].map((y) => (
                        <path key={y} transform={`translate(${midX} ${y - 4})`} d="M-12,-3 L9,-3 Q15,-3 16,0 L6,1.5 L4.5,6 L7.5,9 L-7.5,9 L-4.5,6 L-6,1.5 L-12,1.5 Z" fill="#a8a29e" stroke="#eab308" strokeWidth="1" />
                    ))}
                </g>
            );
        case 'barrowfrost':
            return (
                <g>
                    {/* Tombstones around the outer ring */}
                    {perimeter(b, 7, 26).map(([x, y], i) => (
                        <g key={i}>
                            <rect x={x - 4} y={y - 5} width="8" height="10" rx="3" fill="#64748b" stroke="#334155" strokeWidth="0.8" />
                            <line x1={x} y1={y - 3} x2={x} y2={y + 3} stroke="#334155" strokeWidth="0.8" />
                            <line x1={x - 2} y1={y - 1} x2={x + 2} y2={y - 1} stroke="#334155" strokeWidth="0.8" />
                        </g>
                    ))}
                    {/* Ice spires at the corners, seen from above */}
                    {corners(b, 16).map(([x, y], i) => (
                        <g key={`i${i}`}>
                            <circle cx={x} cy={y} r="15" fill={`url(#${id}-glow)`} />
                            <polygon points={`${x},${y - 14} ${x + 4},${y - 4} ${x + 14},${y} ${x + 4},${y + 4} ${x},${y + 14} ${x - 4},${y + 4} ${x - 14},${y} ${x - 4},${y - 4}`} fill="#bae6fd" stroke="#7dd3fc" strokeWidth="0.8" />
                        </g>
                    ))}
                </g>
            );
        default:
            return (
                <g>
                    {corners(b, 12).map(([x, y], i) => (
                        <g key={i}>
                            <circle cx={x} cy={y} r="14" fill={`url(#${id}-glow)`} />
                            <rect x={x - 5} y={y - 5} width="10" height="10" fill="#fef9c3" stroke="#78716c" />
                        </g>
                    ))}
                </g>
            );
    }
};

const GLOW: Record<string, string> = {
    'moonglade-bowl': '#fde68a',
    'the-gutterpit': '#fb923c',
    'anvilhold-forge': '#f97316',
    'barrowfrost': '#a855f7',
    'neutral-ground': '#fef9c3',
};

interface StadiumSurroundProps {
    stadium: Stadium;
    /** Home club colour name for the pennants; omitted outside the campaign. */
    clubColor?: string;
    /** Text on the name plaque (defaults to the stadium's name). */
    label?: string;
    children: React.ReactNode;
}

export default function StadiumSurround({ stadium, clubColor, label, children }: StadiumSurroundProps) {
    const ref = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState<Box | null>(null);
    const id = `surround-${useId().replace(/:/g, '')}`;

    useLayoutEffect(() => {
        const el = ref.current;
        const inner = innerRef.current;
        if (!el || !inner) return;
        const measure = () => {
            const next = {
                w: el.offsetWidth, h: el.offsetHeight,
                x0: inner.offsetLeft, y0: inner.offsetTop,
                x1: inner.offsetLeft + inner.offsetWidth, y1: inner.offsetTop + inner.offsetHeight,
            };
            setBox((prev) => (prev && Object.keys(next).every((k) => (prev as any)[k] === (next as any)[k]) ? prev : next));
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        ro.observe(inner);
        return () => ro.disconnect();
    }, []);

    // The crowd is a few thousand nodes, so only rebuild it when the layout or
    // venue changes, not on every board re-render.
    const svg = useMemo(() => {
    const theme = THEMES[stadium.id] ?? THEMES['neutral-ground'];
    const club = CLUB_COLORS[clubColor ?? ''];
    const crowdColors = club ? [...theme.crowd, club, club] : theme.crowd;
    const plaque = label ?? stadium.name;
    // Skip the drawing for an implausible layout (e.g. the board unstyled
    // because its stylesheet failed to load): the crowd scales with the area.
    if (!box || box.w <= 0 || box.w > MAX_SIDE || box.h > MAX_SIDE) return null;
    return (
        <svg
            // Inline positioning (not just classes) so the SVG can never join
            // the layout it measures, even if the stylesheet fails to load.
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
            width={box.w}
            height={box.h}
            viewBox={`0 0 ${box.w} ${box.h}`}
            aria-hidden="true"
        >
            <defs>
                <radialGradient id={`${id}-glow`}>
                    <stop offset="0" stopColor={GLOW[stadium.id] ?? GLOW['neutral-ground']} stopOpacity="0.75" />
                    <stop offset="1" stopColor={GLOW[stadium.id] ?? GLOW['neutral-ground']} stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`${id}-lava`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#f97316" />
                    <stop offset="0.5" stopColor="#fde047" />
                    <stop offset="1" stopColor="#f97316" />
                </linearGradient>
                {/* Banking: each stand darkens toward the pitch, like seats stepping down */}
                {([['t', 0, 0, 0, 1], ['b', 0, 1, 0, 0], ['l', 0, 0, 1, 0], ['r', 1, 0, 0, 0]] as const).map(([k, x1, y1, x2, y2]) => (
                    <linearGradient key={k} id={`${id}-bank-${k}`} x1={x1} y1={y1} x2={x2} y2={y2}>
                        <stop offset="0" stopColor={theme.stand} />
                        <stop offset="1" stopColor={theme.outer} />
                    </linearGradient>
                ))}
                <clipPath id={`${id}-clip`}>
                    <rect width={box.w} height={box.h} rx="14" />
                </clipPath>
            </defs>
            <g clipPath={`url(#${id}-clip)`}>
                <rect width={box.w} height={box.h} fill={theme.outer} />
                {/* Banked stands: four mitred bands from the outer edge to the pitch */}
                <polygon points={`0,0 ${box.w},0 ${box.x1},${box.y0} ${box.x0},${box.y0}`} fill={`url(#${id}-bank-t)`} />
                <polygon points={`0,${box.h} ${box.w},${box.h} ${box.x1},${box.y1} ${box.x0},${box.y1}`} fill={`url(#${id}-bank-b)`} />
                <polygon points={`0,0 0,${box.h} ${box.x0},${box.y1} ${box.x0},${box.y0}`} fill={`url(#${id}-bank-l)`} />
                <polygon points={`${box.w},0 ${box.w},${box.h} ${box.x1},${box.y1} ${box.x1},${box.y0}`} fill={`url(#${id}-bank-r)`} />
                {/* Corner seams between the stands */}
                {[[0, 0, box.x0, box.y0], [box.w, 0, box.x1, box.y0], [0, box.h, box.x0, box.y1], [box.w, box.h, box.x1, box.y1]].map(([ax, ay, bx, by], i) => (
                    <line key={`seam${i}`} x1={ax} y1={ay} x2={bx} y2={by} stroke={theme.outer} strokeWidth="3" />
                ))}
                {/* Seating tiers */}
                {[0.25, 0.5, 0.75].map((f) => {
                    const x0 = box.x0 * f, y0 = box.y0 * f;
                    const x1 = box.x1 + (box.w - box.x1) * (1 - f), y1 = box.y1 + (box.h - box.y1) * (1 - f);
                    return <rect key={f} x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx="6" fill="none" stroke={theme.tier} strokeWidth="1.5" />;
                })}
                <g opacity="0.9">{crowdDots(box, crowdColors, 9)}</g>
                <Decor id={id} stadiumId={stadium.id} b={box} club={club ?? '#e7e5e4'} />
                {/* Pitch-side wall */}
                <rect x={box.x0 - 2} y={box.y0 - 2} width={box.x1 - box.x0 + 4} height={box.y1 - box.y0 + 4} rx="6" fill="none" stroke={theme.wall} strokeWidth="2.5" opacity="0.85" />
                {/* Club pennants at the ends */}
                {club && [box.w * 0.22, box.w * 0.78].flatMap((x) => [box.y0 - 10, box.y1 + 10].map((y) => (
                    <polygon key={`${x}-${y}`} points={`${x - 6},${y - 4} ${x + 6},${y - 4} ${x},${y + 5}`} fill={club} stroke="#0c0a09" strokeWidth="0.8" />
                )))}
            </g>
            {/* Name plaque over the far stand */}
            <g>
                <rect
                    x={box.w / 2 - Math.min(110, box.w / 2 - 8)}
                    y={Math.max(2, box.y0 / 2 - 10)}
                    width={Math.min(220, box.w - 16)}
                    height="20"
                    rx="4"
                    fill="#0c0a09"
                    opacity="0.85"
                    stroke={club ?? theme.wall}
                    strokeWidth="1.2"
                />
                <text
                    x={box.w / 2}
                    y={Math.max(2, box.y0 / 2 - 10) + 14}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    letterSpacing="2"
                    fill="#fde68a"
                    style={{ textTransform: 'uppercase' }}
                >
                    {plaque}
                </text>
            </g>
        </svg>
    );
    }, [box, stadium, clubColor, label, id]);

    return (
        <div
            ref={ref}
            style={{ position: 'relative', padding: 'clamp(32px, 6vw, 76px) clamp(22px, 4.5vw, 64px)' }}
            data-testid={`stadium-surround-${stadium.id}`}
        >
            {svg}
            <div ref={innerRef} style={{ position: 'relative' }}>
                {children}
            </div>
        </div>
    );
}
