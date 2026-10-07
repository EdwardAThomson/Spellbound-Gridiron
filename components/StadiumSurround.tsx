import React, { useLayoutEffect, useMemo, useRef, useState, useId } from 'react';
import { Stadium } from '../services/stadiums';
import { CLUB_COLORS, jitter } from './StadiumArt';

// The stadium drawn around the live board, in a 3/4 view: the camera sits
// above the near (bottom) end looking up the pitch, so the far stand rises
// tall behind the top endzone, the side stands step up and away from the
// touchlines, and the near stand is only a foreground roof edge. The board
// itself stays flat and untouched inside; this is padding plus an SVG behind
// it, sized to the measured layout. Purely decorative (pointer-events off).
//
// Venues are redrawn one at a time. Only Moonglade Bowl has a scene so far;
// any other venue renders the board with no frame.

interface Box { w: number; h: number; x0: number; y0: number; x1: number; y1: number }

/** Largest stadium edge we draw, in px; a real board is well under this. */
const MAX_SIDE = 3000;

// --- Moonglade Bowl -----------------------------------------------------------

const MG = {
    skyTop: '#0a1430',
    skyBottom: '#2a4a74',
    treeFar: '#10261c',
    treeNear: '#163524',
    stone: '#c9d2c2',
    stoneShade: '#8e9a8a',
    stoneDark: '#5d6a5c',
    riser: '#6f7d6d',
    seat: '#2f7d4f',
    seatDark: '#215c3a',
    apron: '#24502c',
    leaf: '#1f6b3a',
    leafLight: '#2f8f50',
    leafDark: '#123f24',
    gold: '#f3d27a',
    lantern: '#fde68a',
    // Muted crowd colours so the crowd reads as texture, with the club colour as the accent.
    hair: ['#3b2a1e', '#5b4330', '#2a211b', '#8a6a45', '#c9b27a'],
    cloth: ['#c7cfc4', '#9fb0a3', '#b9b2a2', '#8f9cab', '#d8d2c2'],
};

/** One spectator: shoulders and a head. */
/** One spectator: shoulders and a head. `back` draws them from behind (near stand). */
const Fan: React.FC<{ x: number; y: number; s: number; i: number; club: string; back?: boolean }> = ({ x, y, s, i, club, back }) => {
    const cloth = jitter(i, 21) < 0.3 ? club : MG.cloth[Math.floor(jitter(i, 22) * MG.cloth.length)];
    const hair = MG.hair[Math.floor(jitter(i, 23) * MG.hair.length)];
    return (
        <g>
            <rect x={x - 3.4 * s} y={y - 3.2 * s} width={6.8 * s} height={4.2 * s} rx={2 * s} fill={cloth} />
            {back ? (
                <circle cx={x} cy={y - 5.2 * s} r={2.4 * s} fill={hair} />
            ) : (
                <>
                    <circle cx={x} cy={y - 5.2 * s} r={2.3 * s} fill="#f1d3b3" />
                    <path d={`M${x - 2.4 * s},${y - 5.6 * s} a${2.4 * s},${2.4 * s} 0 0 1 ${4.8 * s},0 Z`} fill={hair} />
                </>
            )}
        </g>
    );
};

/** A lantern on a slender pole, with its glow. */
const LanternPole: React.FC<{ x: number; base: number; top: number; id: string }> = ({ x, base, top, id }) => (
    <g>
        <line x1={x} y1={base} x2={x} y2={top} stroke={MG.stoneDark} strokeWidth="3" />
        <line x1={x} y1={base} x2={x} y2={top} stroke={MG.stone} strokeWidth="1" opacity="0.6" />
        <path d={`M${x},${top} q-10,-4 -12,-14 M${x},${top} q10,-4 12,-14`} stroke={MG.stoneDark} strokeWidth="2" fill="none" />
        <circle cx={x} cy={top - 4} r="26" fill={`url(#${id}-glow)`} />
        <path d={`M${x - 5},${top - 1} L${x + 5},${top - 1} L${x + 3.5},${top - 11} L${x - 3.5},${top - 11} Z`} fill={MG.lantern} stroke={MG.gold} strokeWidth="1" />
        <path d={`M${x - 6},${top - 11} L${x + 6},${top - 11} L${x},${top - 17} Z`} fill={MG.stoneDark} />
    </g>
);

/** A scalloped canopy of leaves along a horizontal edge (the roof's hanging fringe). */
const leafFringe = (x0: number, x1: number, y: number, depth: number) => {
    const n = Math.max(2, Math.round((x1 - x0) / 22));
    const step = (x1 - x0) / n;
    let d = `M${x0},${y - depth}`;
    for (let i = 0; i < n; i++) {
        const a = x0 + i * step;
        d += ` Q${a + step / 2},${y + depth * (0.55 + jitter(i, 31) * 0.5)} ${a + step},${y - depth * 0.15}`;
    }
    return d + ` L${x1},${y - depth * 2} L${x0},${y - depth * 2} Z`;
};

const MoongladeScene: React.FC<{ b: Box; id: string; club: string; label: string }> = ({ b, id, club, label }) => {
    const { w, h, x0, y0, x1, y1 } = b;
    const midX = (x0 + x1) / 2;
    const sideW = x0;                     // width of each side stand
    const apron = 10;                     // grass between the pitch and the hoardings
    const hoardH = 9;                     // pitch-side boards

    // Far stand: from the roof line down to the hoardings above the top endzone.
    const farTop = y0 * 0.34;
    const farBottom = y0 - apron - hoardH;
    const farRows = 5;
    const farRowH = (farBottom - farTop) / farRows;
    const farLeft = x0 - sideW * 0.55;
    const farRight = x1 + sideW * 0.55;

    // Side stands: rows run alongside the touchline and step up and outward.
    const sideRows = 3;
    const sideRowW = (sideW - apron - hoardH) / sideRows;
    const sideRise = farRowH * 1.1;       // each row further out starts higher, so the tiers visibly step up

    const els: React.ReactNode[] = [];
    let fanIdx = 0;

    // Far stand rows, back (top) to front (bottom) so nearer rows overlap.
    for (let r = 0; r < farRows; r++) {
        const top = farTop + r * farRowH;
        els.push(<rect key={`fr${r}`} x={farLeft} y={top} width={farRight - farLeft} height={farRowH * 0.38} fill={MG.riser} />);
        els.push(<rect key={`ft${r}`} x={farLeft} y={top + farRowH * 0.38} width={farRight - farLeft} height={farRowH * 0.62} fill={MG.stone} />);
        const seatY = top + farRowH * 0.38;
        for (let x = farLeft + 9; x < farRight - 8; x += 14) {
            const aisle = Math.abs(((x - midX) % 96 + 96) % 96 - 48) > 42;
            if (aisle) continue;
            els.push(<rect key={`fs${r}-${x}`} x={x - 5.5} y={seatY + 2} width="11" height={farRowH * 0.4} rx="2" fill={r % 2 ? MG.seat : MG.seatDark} />);
            fanIdx++;
            if (jitter(fanIdx, 5) < 0.6 && !(r < 3 && Math.abs(x - midX) < 44)) {
                els.push(<Fan key={`ff${r}-${x}`} x={x} y={seatY + farRowH * 0.52} s={Math.min(1.5, farRowH / 16)} i={fanIdx} club={club} />);
            }
        }
    }
    // Aisle stairs down the far stand.
    for (let k = -6; k <= 6; k++) {
        const ax = midX + k * 96 + 48;
        if (ax < farLeft + 6 || ax > farRight - 6) continue;
        els.push(<rect key={`fa${k}`} x={ax - 5} y={farTop} width="10" height={farBottom - farTop} fill={MG.stoneShade} />);
        for (let r = 0; r < farRows * 2; r++) {
            els.push(<line key={`fas${k}-${r}`} x1={ax - 5} x2={ax + 5} y1={farTop + (r + 1) * farRowH / 2} y2={farTop + (r + 1) * farRowH / 2} stroke={MG.stoneDark} strokeWidth="1" />);
        }
    }

    // Side stands (left and right are mirror images).
    const side = (dir: -1 | 1) => {
        const parts: React.ReactNode[] = [];
        const inner = dir < 0 ? x0 - apron - hoardH : x1 + apron + hoardH;
        for (let r = sideRows - 1; r >= 0; r--) {
            const near = inner + dir * r * sideRowW;
            const far = inner + dir * (r + 1) * sideRowW;
            const top = y0 - apron - r * sideRise;
            const bottom = h;
            const xa = Math.min(near, far), xb = Math.max(near, far);
            // Tread and riser of the row (the riser faces the pitch).
            parts.push(<rect key={`st${dir}${r}`} x={xa} y={top} width={xb - xa} height={bottom - top} fill={`url(#${id}-tread${dir < 0 ? 'L' : 'R'})`} />);
            // The riser faces the pitch and the tread lights up outward, so each tier reads as a step.
            const riserX = dir < 0 ? xb - sideRowW * 0.3 : xa;
            parts.push(<rect key={`sr${dir}${r}`} x={riserX} y={top} width={sideRowW * 0.3} height={bottom - top} fill={MG.riser} />);
            parts.push(<rect key={`sh${dir}${r}`} x={dir < 0 ? xa : xb - 2} y={top} width="2" height={bottom - top} fill="#e8eee4" opacity="0.7" />);
            parts.push(<rect key={`sc${dir}${r}`} x={xa} y={top} width={xb - xa} height="4" fill={MG.stoneDark} />);
            const s = Math.min(1.4, sideRowW / 18);
            for (let y = top + 14; y < bottom - 8; y += 15) {
                const aisle = Math.abs(((y - y0) % 150 + 150) % 150 - 75) > 66;
                if (aisle) {
                    parts.push(<rect key={`sa${dir}${r}-${y}`} x={xa} y={y - 6} width={xb - xa} height="12" fill={MG.stoneShade} />);
                    continue;
                }
                const sx = (xa + xb) / 2 - dir * sideRowW * 0.1;
                parts.push(<rect key={`ss${dir}${r}-${y}`} x={sx - sideRowW * 0.24} y={y - 5} width={sideRowW * 0.48} height="11" rx="2" fill={r % 2 ? MG.seat : MG.seatDark} />);
                fanIdx++;
                if (jitter(fanIdx, 6) < 0.55) parts.push(<Fan key={`sf${dir}${r}-${y}`} x={sx} y={y + 4} s={s} i={fanIdx} club={club} />);
            }
        }
        // Back wall of the side stand, with slender pillars holding its canopy.
        const wallX = dir < 0 ? 0 : w;
        const backEdge = inner + dir * sideRows * sideRowW;
        parts.push(<rect key={`sw${dir}`} x={Math.min(wallX, backEdge)} y={0} width={Math.abs(wallX - backEdge)} height={h} fill={MG.stoneDark} />);
        // A leaf canopy over the back of the stand, on slender silver pillars.
        const canopyW = sideRowW * 0.9;
        const cx0 = dir < 0 ? backEdge - 2 : backEdge - canopyW + 2;
        parts.push(<rect key={`sk${dir}`} x={cx0} y={0} width={canopyW} height={h} fill={MG.leafDark} />);
        parts.push(
            <path
                key={`sf${dir}`}
                d={leafFringe(0, h, 0, 6)}
                fill={MG.leaf}
                transform={dir < 0 ? `translate(${cx0 + canopyW + 6} 0) rotate(90)` : `translate(${cx0 - 6} ${h}) rotate(-90)`}
            />
        );
        for (let y = y0 + 40; y < y1; y += 110) {
            parts.push(<rect key={`sp${dir}${y}`} x={dir < 0 ? cx0 + canopyW + 2 : cx0 - 5} y={y} width="3" height="34" fill={MG.stone} />);
            parts.push(<circle key={`sl${dir}${y}`} cx={dir < 0 ? cx0 + canopyW + 3.5 : cx0 - 3.5} cy={y} r="10" fill={`url(#${id}-glow)`} />);
        }
        return parts;
    };

    return (
        <g>
            {/* Night sky over the far stand, with the moon and stars */}
            <rect width={w} height={h} fill={MG.stoneDark} />
            <rect width={w} height={farTop + 30} fill={`url(#${id}-sky)`} />
            {Array.from({ length: 28 }, (_, i) => (
                <circle key={`st${i}`} cx={jitter(i, 1) * w} cy={jitter(i, 2) * farTop * 0.55} r={0.5 + jitter(i, 3) * 0.9} fill="#e0f2fe" opacity={0.45 + jitter(i, 4) * 0.5} />
            ))}
            <circle cx={w * 0.8} cy={farTop * 0.22} r="11" fill="#f1f5f9" />
            <circle cx={w * 0.8 + 5} cy={farTop * 0.22 - 4} r="10" fill={MG.skyTop} />
            {/* The forest the bowl is carved from, on the horizon */}
            {Array.from({ length: Math.ceil(w / 34) + 1 }, (_, i) => (
                <ellipse key={`tf${i}`} cx={i * 34} cy={farTop * 0.62} rx={26} ry={16 + jitter(i, 9) * 10} fill={MG.treeFar} />
            ))}
            {Array.from({ length: Math.ceil(w / 46) + 1 }, (_, i) => (
                <ellipse key={`tn${i}`} cx={i * 46 + 20} cy={farTop * 0.8} rx={32} ry={18 + jitter(i, 10) * 8} fill={MG.treeNear} />
            ))}

            {/* Side stands first (they sit behind the far stand's ends) */}
            {side(-1)}
            {side(1)}

            {/* Far stand: back wall, seating tiers, then its leaf roof */}
            <rect x={farLeft - 6} y={farTop - 6} width={farRight - farLeft + 12} height={farBottom - farTop + 6} fill={MG.stoneDark} />
            {els}
            {/* Shade under the roof on the upper rows */}
            <rect x={farLeft} y={farTop} width={farRight - farLeft} height={farRowH * 2.5} fill={`url(#${id}-shade)`} />
            {/* Royal box at the centre of the far stand */}
            <g>
                <rect x={midX - 34} y={farTop + farRowH * 0.2} width="68" height={farRowH * 1.9} rx="3" fill={MG.stoneShade} stroke={MG.gold} strokeWidth="1.2" />
                <path d={`M${midX - 38},${farTop + farRowH * 0.25} Q${midX},${farTop - farRowH * 0.9} ${midX + 38},${farTop + farRowH * 0.25} Z`} fill={MG.leaf} stroke={MG.gold} strokeWidth="1" />
                <rect x={midX - 9} y={farTop + farRowH * 0.6} width="18" height={farRowH * 1.9} fill={club} />
                <path d={`M${midX - 9},${farTop + farRowH * 2.5} L${midX},${farTop + farRowH * 2.1} L${midX + 9},${farTop + farRowH * 2.5} Z`} fill={MG.stoneShade} />
                <path d={`M${midX},${farTop + farRowH * 0.9} l3,5 h-6 Z`} fill={MG.gold} />
            </g>
            {/* Leaf canopy roof with the venue name on its fascia */}
            <path d={`M${farLeft - 22},${farTop - 2} Q${midX},${farTop - farRowH * 1.6} ${farRight + 22},${farTop - 2} L${farRight + 22},${farTop + 8} Q${midX},${farTop - farRowH * 1.1} ${farLeft - 22},${farTop + 8} Z`} fill={MG.leafDark} />
            <path d={leafFringe(farLeft - 22, farRight + 22, farTop + 10, 7)} fill={MG.leaf} />
            <path d={`M${farLeft - 22},${farTop - 2} Q${midX},${farTop - farRowH * 1.6} ${farRight + 22},${farTop - 2}`} stroke={MG.leafLight} strokeWidth="3" fill="none" />
            <rect x={midX - 78} y={farTop - farRowH * 1.05 - 9} width="156" height="18" rx="9" fill={MG.leafDark} stroke={MG.gold} strokeWidth="1" />
            <text x={midX} y={farTop - farRowH * 1.05 + 4} textAnchor="middle" fontSize="10.5" fontWeight="700" letterSpacing="2.5" fill={MG.gold}>{label.toUpperCase()}</text>

            {/* Lantern towers at the corners of the far stand */}
            <LanternPole x={farLeft - 10} base={farBottom} top={farTop - farRowH * 1.4} id={id} />
            <LanternPole x={farRight + 10} base={farBottom} top={farTop - farRowH * 1.4} id={id} />

            {/* Grass apron and the pitch-side boards */}
            <rect x={x0 - apron} y={y0 - apron} width={x1 - x0 + apron * 2} height={y1 - y0 + apron * 2} fill={MG.apron} />
            {[
                [x0 - apron - hoardH, y0 - apron - hoardH, x1 - x0 + 2 * (apron + hoardH), hoardH],
                [x0 - apron - hoardH, y0 - apron, hoardH, y1 - y0 + 2 * apron],
                [x1 + apron, y0 - apron, hoardH, y1 - y0 + 2 * apron],
                [x0 - apron - hoardH, y1 + apron, x1 - x0 + 2 * (apron + hoardH), hoardH],
            ].map(([x, y, ww, hh], i) => (
                <g key={`hb${i}`}>
                    <rect x={x} y={y} width={ww} height={hh} fill={MG.leafDark} />
                    <rect x={x} y={y} width={ww} height={hh} fill={`url(#${id}-runes)`} opacity="0.9" />
                </g>
            ))}

            {/* Near stand. The camera is above and behind it, so we look down
                over the backs of its fans: the rows step DOWN toward the pitch,
                the row nearest the camera (bottom of the frame) is the largest,
                we see treads and seat backs but no risers (they face away), and
                a low parapet with lanterns closes the frame. Its sides flare out
                to the frame edges and meet the side stands on a mitred seam,
                the way a bowl's corners turn. */}
            {(() => {
                const parts: React.ReactNode[] = [];
                const top = y1 + apron + hoardH;        // pitch-side edge
                const parapetH = 16;
                const bottom = h - parapetH;             // back of the stand
                const innerL = x0 - apron - hoardH, innerR = x1 + apron + hoardH;
                const poly = `${innerL},${top} ${innerR},${top} ${w},${bottom} ${0},${bottom}`;
                const clipId = `${id}-nearclip`;
                parts.push(
                    <clipPath key="nc" id={clipId}>
                        <polygon points={poly} />
                    </clipPath>
                );
                const rows = 3;
                const weights = [1, 1.3, 1.7];           // foreshortening: nearer rows are taller
                const total = weights.reduce((a, b) => a + b, 0);
                const inner: React.ReactNode[] = [];
                let y = top;
                for (let r = 0; r < rows; r++) {
                    const rh = ((bottom - top) * weights[r]) / total;
                    const sc = Math.min(2.1, rh / 15);
                    // Tread (the step we look down on) with a shadow lip where it drops to the next row.
                    inner.push(<rect key={`nt${r}`} x={0} y={y} width={w} height={rh} fill={r % 2 ? MG.stone : '#bfc9b8'} />);
                    inner.push(<rect key={`nl${r}`} x={0} y={y} width={w} height={Math.max(2, rh * 0.08)} fill={MG.stoneDark} opacity="0.55" />);
                    const step = 11 * sc;
                    const pitch = step * 9;
                    for (let x = step * 0.6; x < w; x += step) {
                        const dx = ((x - midX) % pitch + pitch) % pitch;
                        if (Math.abs(dx - pitch / 2) > pitch / 2 - step * 0.5) {
                            // Staircase aisle: a lighter strip with step lines.
                            inner.push(<rect key={`na${r}-${x}`} x={x - step * 0.5} y={y} width={step} height={rh} fill={MG.stoneShade} />);
                            for (let k = 1; k < 4; k++) inner.push(<line key={`nk${r}-${x}-${k}`} x1={x - step * 0.5} x2={x + step * 0.5} y1={y + (rh * k) / 4} y2={y + (rh * k) / 4} stroke={MG.stoneDark} strokeWidth="0.8" opacity="0.6" />);
                            continue;
                        }
                        // Seat back (we see its plain rear), then the fan from behind rising above it.
                        inner.push(<rect key={`ns${r}-${x}`} x={x - 4.6 * sc} y={y + rh * 0.38} width={9.2 * sc} height={rh * 0.4} rx={2 * sc} fill={r % 2 ? MG.seatDark : MG.seat} />);
                        fanIdx++;
                        if (jitter(fanIdx, 7) < 0.62) inner.push(<Fan key={`nf${r}-${x}`} x={x} y={y + rh * 0.5} s={sc} i={fanIdx} club={club} back />);
                    }
                    y += rh;
                }
                parts.push(<g key="nbody" clipPath={`url(#${clipId})`}>{inner}</g>);
                // Mitred seams where the near stand meets the side stands.
                parts.push(<line key="nsl" x1={innerL} y1={top} x2={0} y2={bottom} stroke={MG.stoneDark} strokeWidth="3" />);
                parts.push(<line key="nsr" x1={innerR} y1={top} x2={w} y2={bottom} stroke={MG.stoneDark} strokeWidth="3" />);
                // Parapet along the back of the stand, nearest the camera.
                parts.push(<rect key="np" x={0} y={bottom} width={w} height={parapetH} fill={MG.stoneDark} />);
                parts.push(<rect key="npc" x={0} y={bottom} width={w} height="4" fill={MG.stone} />);
                parts.push(<rect key="npv" x={0} y={bottom + 4} width={w} height={parapetH - 4} fill={`url(#${id}-runes)`} opacity="0.5" />);
                for (let i = 0; i < Math.ceil(w / 90); i++) {
                    const lx = i * 90 + 45;
                    // Lanterns sit on the parapet cap, so they light the back row without cutting through it.
                    parts.push(<circle key={`npg${i}`} cx={lx} cy={bottom + 2} r="14" fill={`url(#${id}-glow)`} />);
                    parts.push(<path key={`npl${i}`} d={`M${lx - 3.5},${bottom + 3} L${lx + 3.5},${bottom + 3} L${lx + 2.5},${bottom - 5} L${lx - 2.5},${bottom - 5} Z`} fill={MG.lantern} stroke={MG.gold} strokeWidth="0.8" />);
                }
                // Club pennants at the corners of the parapet.
                for (const px of [14, w - 14]) {
                    parts.push(<line key={`pl${px}`} x1={px} y1={h} x2={px} y2={bottom - 30} stroke={MG.stone} strokeWidth="1.5" />);
                    parts.push(<path key={`pf${px}`} d={`M${px},${bottom - 30} l${px < w / 2 ? 16 : -16},5 l${px < w / 2 ? -16 : 16},5 Z`} fill={club} />);
                }
                return parts;
            })()}
        </g>
    );
};

const MoongladeDefs: React.FC<{ id: string }> = ({ id }) => (
    <>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={MG.skyTop} />
            <stop offset="1" stopColor={MG.skyBottom} />
        </linearGradient>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.45" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        {/* Side-stand treads: shaded at the pitch end, lit toward the back */}
        <linearGradient id={`${id}-treadL`} x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor={MG.stoneShade} />
            <stop offset="1" stopColor={MG.stone} />
        </linearGradient>
        <linearGradient id={`${id}-treadR`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={MG.stoneShade} />
            <stop offset="1" stopColor={MG.stone} />
        </linearGradient>
        <linearGradient id={`${id}-nearshade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
            <stop offset="0" stopColor={MG.lantern} stopOpacity="0.7" />
            <stop offset="1" stopColor={MG.lantern} stopOpacity="0" />
        </radialGradient>
        <pattern id={`${id}-runes`} width="28" height="9" patternUnits="userSpaceOnUse">
            <path d="M4,7 L7,2 L10,7 M14,2 L14,7 M18,7 L21,2 L24,7 M17,4.5 L22,4.5" stroke={MG.gold} strokeWidth="0.9" fill="none" opacity="0.8" />
        </pattern>
    </>
);

// --- Venue registry ------------------------------------------------------------

interface Scene {
    /** CSS padding around the board that the scene draws into. */
    padding: string;
    Defs: React.FC<{ id: string }>;
    Body: React.FC<{ b: Box; id: string; club: string; label: string }>;
}

const SCENES: Record<string, Scene> = {
    'moonglade-bowl': {
        padding: 'clamp(150px, 20vw, 230px) clamp(70px, 9vw, 112px) clamp(90px, 11vw, 136px)',
        Defs: MoongladeDefs,
        Body: MoongladeScene,
    },
};

interface StadiumSurroundProps {
    stadium: Stadium;
    /** Home club colour name for scarves and banners; omitted outside the campaign. */
    clubColor?: string;
    /** Text on the roof fascia (defaults to the stadium's name). */
    label?: string;
    children: React.ReactNode;
}

export default function StadiumSurround({ stadium, clubColor, label, children }: StadiumSurroundProps) {
    const ref = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState<Box | null>(null);
    const id = `surround-${useId().replace(/:/g, '')}`;
    const scene = SCENES[stadium.id];

    useLayoutEffect(() => {
        const el = ref.current;
        const inner = innerRef.current;
        if (!el || !inner || !scene) return;
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
    }, [scene]);

    // The stands are a few hundred nodes, so only rebuild them when the layout
    // or venue changes, not on every board re-render.
    const svg = useMemo(() => {
        // Skip the drawing for an implausible layout (e.g. the board unstyled
        // because its stylesheet failed to load).
        if (!scene || !box || box.w <= 0 || box.w > MAX_SIDE || box.h > MAX_SIDE) return null;
        const club = CLUB_COLORS[clubColor ?? ''] ?? '#e5e7eb';
        return (
            <svg
                // Inline positioning (not just classes) so the SVG can never join
                // the layout it measures, even if the stylesheet fails to load.
                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', borderRadius: 12 }}
                width={box.w}
                height={box.h}
                viewBox={`0 0 ${box.w} ${box.h}`}
                aria-hidden="true"
            >
                <defs>
                    <scene.Defs id={id} />
                    <clipPath id={`${id}-clip`}>
                        <rect width={box.w} height={box.h} rx="12" />
                    </clipPath>
                </defs>
                <g clipPath={`url(#${id}-clip)`}>
                    <scene.Body b={box} id={id} club={club} label={label ?? stadium.name} />
                </g>
            </svg>
        );
    }, [box, scene, stadium, clubColor, label, id]);

    return (
        <div
            ref={ref}
            style={{ position: 'relative', padding: scene ? scene.padding : 0 }}
            data-testid={`stadium-surround-${stadium.id}`}
        >
            {svg}
            <div ref={innerRef} style={{ position: 'relative' }}>
                {children}
            </div>
        </div>
    );
}
