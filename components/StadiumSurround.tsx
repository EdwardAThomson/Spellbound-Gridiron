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

/**
 * One spectator seated facing the pitch. `facing` is the direction from the
 * fan toward the pitch: the body (lap and shoulders) sits on that side, the
 * head on the other. From the far stand we see faces; everywhere else we see
 * the top of the head.
 */
type Facing = 'up' | 'down' | 'left' | 'right';
const FACE: Record<Facing, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const Fan: React.FC<{ x: number; y: number; s: number; i: number; club: string; facing: Facing }> = ({ x, y, s, i, club, facing }) => {
    const cloth = jitter(i, 21) < 0.3 ? club : MG.cloth[Math.floor(jitter(i, 22) * MG.cloth.length)];
    const hair = MG.hair[Math.floor(jitter(i, 23) * MG.hair.length)];
    const [fx, fy] = FACE[facing];
    const vertical = fy !== 0;
    const bx = x + fx * 2.4 * s, by = y + fy * 2.4 * s;
    const hx = x - fx * 2.6 * s, hy = y - fy * 2.6 * s;
    const bw = vertical ? 6.8 * s : 4.4 * s, bh = vertical ? 4.4 * s : 6.8 * s;
    return (
        <g>
            <rect x={bx - bw / 2} y={by - bh / 2} width={bw} height={bh} rx={1.8 * s} fill={cloth} />
            {facing === 'down' ? (
                <>
                    <circle cx={hx} cy={hy} r={2.3 * s} fill="#f1d3b3" />
                    <path d={`M${hx - 2.4 * s},${hy - 0.4 * s} a${2.4 * s},${2.4 * s} 0 0 1 ${4.8 * s},0 Z`} fill={hair} />
                </>
            ) : (
                <circle cx={hx} cy={hy} r={2.4 * s} fill={hair} />
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

/** Vertical twin of leafFringe: scallops along x = `x`, pointing in +x for positive depth. */
const leafFringeV = (y0: number, y1: number, x: number, depth: number) => {
    const n = Math.max(2, Math.round((y1 - y0) / 22));
    const step = (y1 - y0) / n;
    let d = `M${x - depth},${y0}`;
    for (let i = 0; i < n; i++) {
        const a = y0 + i * step;
        d += ` Q${x + depth * (0.55 + jitter(i, 33) * 0.5)},${a + step / 2} ${x - depth * 0.15},${a + step}`;
    }
    return d + ` L${x - depth * 2},${y1} L${x - depth * 2},${y0} Z`;
};

// The bowl is one structure built from concentric rectangular rings. Ring 0 is
// the pitch-side boards; rings 1..3 are the backs of the three seating tiers;
// beyond ring 3 is the roof, out to the frame. Each side's stand is the
// quadrilateral between the inner and outer ring on that side, so the four
// stands meet on mitred diagonals at the corners and nothing overlaps. The
// camera is above the near (bottom) end: the far stand shows its riser faces,
// the near stand shows treads and the backs of heads, and everything nearer the
// camera is drawn larger.
const MoongladeScene: React.FC<{ b: Box; id: string; club: string; label: string }> = ({ b, id, club, label }) => {
    const { w, h, x0, y0, x1, y1 } = b;
    const midX = (x0 + x1) / 2;
    const apron = 10, hoard = 8;
    // Ring 0: the outside of the pitch-side boards.
    const L0 = x0 - apron - hoard, R0 = x1 + apron + hoard, T0 = y0 - apron - hoard, B0 = y1 + apron + hoard;
    // Space on each side, split into sky (top only), stand and roof.
    const sky = T0 * 0.24, roofTop = T0 * 0.12, standTop = T0 - sky - roofTop;
    const roofSide = L0 * 0.18, standSide = L0 - roofSide;
    const roofBot = (h - B0) * 0.22, standBot = h - B0 - roofBot;
    // Tier depths as fractions of each side's stand. Tiers nearer the camera are deeper.
    // Three tiers of two rows, identical on every side so the rings line up at the corners.
    const TIERS = 3, ROWS_PER_TIER = 2, NR = TIERS * ROWS_PER_TIER, AISLE = 110;
    const tier = Array.from({ length: TIERS }, (_, k) => (k + 1) / TIERS);
    const ft = tier, fs = tier, fb = tier;
    const L = [L0, ...fs.map((f) => L0 - standSide * f)];
    const R = [R0, ...fs.map((f) => R0 + standSide * f)];
    const T = [T0, ...ft.map((f) => T0 - standTop * f)];
    const B = [B0, ...fb.map((f) => B0 + standBot * f)];
    const L3 = L[3], R3 = R[3], T3 = T[3], B3 = B[3];

    const farPoly = `${L3},${T3} ${R3},${T3} ${R0},${T0} ${L0},${T0}`;
    const nearPoly = `${L0},${B0} ${R0},${B0} ${R3},${B3} ${L3},${B3}`;
    const leftPoly = `${L3},${T3} ${L0},${T0} ${L0},${B0} ${L3},${B3}`;
    const rightPoly = `${R3},${T3} ${R0},${T0} ${R0},${B0} ${R3},${B3}`;

    let fanIdx = 0;

    // --- One row grid for the whole bowl. Every side has the same tiers and
    // the same rows per tier, spaced evenly across that side's depth, so a row
    // boundary on a long side meets the same boundary on a short side exactly
    // on the corner seam. Perspective comes from the depths (the far stand is
    // tall because we see its risers) and from seat and fan size, not from
    // changing the grid.
    const far: React.ReactNode[] = [];
    const farRowH = standTop / NR;
    for (let i = 0; i < NR; i++) {
        const yBot = T0 - i * farRowH, yTop = yBot - farRowH;
        const s = Math.min(1.2, Math.max(0.7, farRowH / 18)) * (0.85 + 0.3 * (1 - i / NR));
        far.push(<rect key={`r${i}`} x={L3} y={yTop + farRowH * 0.55} width={R3 - L3} height={farRowH * 0.45} fill={MG.riser} />);
        far.push(<rect key={`t${i}`} x={L3} y={yTop} width={R3 - L3} height={farRowH * 0.55} fill={i % 2 ? MG.stone : '#bfc9b8'} />);
        const step = 12 * s;
        for (let x = L3 + step; x < R3 - step / 2; x += step) {
            const dx = ((x - midX) % AISLE + AISLE) % AISLE;
            if (Math.abs(dx - AISLE / 2) > AISLE / 2 - 6) continue;      // aisle
            if (Math.abs(x - midX) < 40 && i < 3) continue;               // royal box
            far.push(<rect key={`s${i}-${x}`} x={x - 4 * s} y={yTop + farRowH * 0.1} width={8 * s} height={farRowH * 0.45} rx={1.5 * s} fill={i % 2 ? MG.seat : MG.seatDark} />);
            fanIdx++;
            if (jitter(fanIdx, 5) < 0.62) far.push(<Fan key={`f${i}-${x}`} x={x} y={yTop + farRowH * 0.42} s={s} i={fanIdx} club={club} facing="down" />);
        }
    }
    for (let k = -8; k <= 8; k++) {
        const ax = midX + k * AISLE + AISLE / 2;
        if (ax < L3 || ax > R3) continue;
        far.push(<rect key={`a${k}`} x={ax - 6} y={T3} width="12" height={T0 - T3} fill={MG.stoneShade} />);
        for (let yy = T0 - farRowH / 2; yy > T3; yy -= farRowH / 2) far.push(<line key={`al${k}-${yy}`} x1={ax - 6} x2={ax + 6} y1={yy} y2={yy} stroke={MG.stoneDark} strokeWidth="0.8" opacity="0.6" />);
    }

    // --- Side stands: the same rows run along the touchline; risers face the pitch.
    const sideRowW = standSide / NR;
    const side = (dir: -1 | 1) => {
        const parts: React.ReactNode[] = [];
        const facing: Facing = dir < 0 ? 'right' : 'left';
        for (let i = 0; i < NR; i++) {
            const xIn = dir < 0 ? L0 - i * sideRowW : R0 + i * sideRowW;
            const xOut = xIn + dir * sideRowW;
            const xa = Math.min(xIn, xOut), xb = Math.max(xIn, xOut);
            parts.push(<rect key={`t${i}`} x={xa} y={T3} width={sideRowW} height={B3 - T3} fill={i % 2 ? MG.stone : '#bfc9b8'} />);
            parts.push(<rect key={`r${i}`} x={dir < 0 ? xb - sideRowW * 0.28 : xa} y={T3} width={sideRowW * 0.28} height={B3 - T3} fill={MG.riser} />);
            const sx = dir < 0 ? xa + sideRowW * 0.4 : xb - sideRowW * 0.4;
            for (let y = T0 + 10; y < B0; y += 13) {
                const s = Math.min(1.1, Math.max(0.6, sideRowW / 16)) * (0.85 + 0.5 * ((y - T0) / (B0 - T0)));
                const dy = ((y - T0) % 130 + 130) % 130;
                if (Math.abs(dy - 65) > 58) continue;
                parts.push(<rect key={`s${i}-${y}`} x={sx - sideRowW * 0.2} y={y - 4.5 * s} width={sideRowW * 0.4} height={9 * s} rx={1.5 * s} fill={i % 2 ? MG.seat : MG.seatDark} />);
                fanIdx++;
                if (jitter(fanIdx, 6) < 0.6) parts.push(<Fan key={`f${i}-${y}`} x={sx} y={y} s={s * 0.9} i={fanIdx} club={club} facing={facing} />);
            }
        }
        for (let k = 0; k < 12; k++) {
            const ay = T0 + k * 130 + 65;
            if (ay > B0) break;
            const xa = dir < 0 ? L3 : R0, xb = dir < 0 ? L0 : R3;
            parts.push(<rect key={`a${k}`} x={xa} y={ay - 6} width={xb - xa} height="12" fill={MG.stoneShade} />);
            for (let xx = xa + sideRowW / 2; xx < xb; xx += sideRowW / 2) parts.push(<line key={`al${k}-${xx}`} x1={xx} x2={xx} y1={ay - 6} y2={ay + 6} stroke={MG.stoneDark} strokeWidth="0.8" opacity="0.6" />);
        }
        return parts;
    };

    // --- Near stand: seen from above and behind; rows step down to the pitch.
    const near: React.ReactNode[] = [];
    const nearRowH = standBot / NR;
    for (let i = 0; i < NR; i++) {
        const y = B0 + i * nearRowH;
        const s = Math.min(1.6, Math.max(0.8, nearRowH / 16)) * (0.95 + 0.3 * (i / NR));
        near.push(<rect key={`t${i}`} x={L3} y={y} width={R3 - L3} height={nearRowH} fill={i % 2 ? MG.stone : '#bfc9b8'} />);
        near.push(<rect key={`l${i}`} x={L3} y={y} width={R3 - L3} height="2" fill={MG.stoneDark} opacity="0.6" />);
        const step = 12 * s;
        for (let x = L3 + step; x < R3 - step / 2; x += step) {
            const dx = ((x - midX) % AISLE + AISLE) % AISLE;
            if (Math.abs(dx - AISLE / 2) > AISLE / 2 - 7) continue;
            // Seat back on the camera side; the fan's lap reaches toward the pitch and the head sits over the back.
            near.push(<rect key={`s${i}-${x}`} x={x - 4.4 * s} y={y + nearRowH * 0.5} width={8.8 * s} height={nearRowH * 0.38} rx={2 * s} fill={i % 2 ? MG.seatDark : MG.seat} />);
            fanIdx++;
            if (jitter(fanIdx, 7) < 0.62) near.push(<Fan key={`f${i}-${x}`} x={x} y={y + nearRowH * 0.5} s={s} i={fanIdx} club={club} facing="up" />);
        }
    }
    for (let k = -8; k <= 8; k++) {
        const ax = midX + k * AISLE + AISLE / 2;
        if (ax < L3 || ax > R3) continue;
        near.push(<rect key={`a${k}`} x={ax - 7} y={B0} width="14" height={B3 - B0} fill={MG.stoneShade} />);
        for (let yy = B0 + 8; yy < B3; yy += 9) near.push(<line key={`al${k}-${yy}`} x1={ax - 7} x2={ax + 7} y1={yy} y2={yy} stroke={MG.stoneDark} strokeWidth="0.8" opacity="0.6" />);
    }

    const lanterns: React.ReactNode[] = [];
    // Floodlight lanterns at the four roof corners, on the mitre lines, plus small ones along the roof edges.
    const corner = (x: number, y: number, big: boolean) => (
        <g key={`c${x}-${y}`}>
            <circle cx={x} cy={y} r={big ? 26 : 11} fill={`url(#${id}-glow)`} />
            <path d={`M${x - 4},${y + 4} L${x + 4},${y + 4} L${x + 3},${y - 5} L${x - 3},${y - 5} Z`} fill={MG.lantern} stroke={MG.gold} strokeWidth="0.9" />
        </g>
    );
    const roofMidX = (L3 + 0) / 2, roofMidR = (R3 + w) / 2;
    for (let yy = T3 + 90; yy < B3 - 40; yy += 170) lanterns.push(corner(roofMidX, yy, false), corner(roofMidR, yy, false));
    for (let xx = L3 + 90; xx < R3 - 40; xx += 170) lanterns.push(corner(xx, (B3 + h) / 2, false));

    return (
        <g>
            {/* Sky, moon, stars and the forest horizon above the far roof */}
            <rect width={w} height={h} fill={MG.stoneDark} />
            <rect width={w} height={sky + 4} fill={`url(#${id}-sky)`} />
            {Array.from({ length: 28 }, (_, i) => (
                <circle key={`st${i}`} cx={jitter(i, 1) * w} cy={jitter(i, 2) * sky * 0.6} r={0.5 + jitter(i, 3) * 0.9} fill="#e0f2fe" opacity={0.45 + jitter(i, 4) * 0.5} />
            ))}
            <circle cx={w * 0.8} cy={sky * 0.3} r="11" fill="#f1f5f9" />
            <circle cx={w * 0.8 + 5} cy={sky * 0.3 - 4} r="10" fill={MG.skyTop} />
            {Array.from({ length: Math.ceil(w / 34) + 1 }, (_, i) => (
                <ellipse key={`tf${i}`} cx={i * 34} cy={sky * 0.8} rx={26} ry={16 + jitter(i, 9) * 10} fill={MG.treeFar} />
            ))}
            {Array.from({ length: Math.ceil(w / 46) + 1 }, (_, i) => (
                <ellipse key={`tn${i}`} cx={i * 46 + 20} cy={sky * 0.98} rx={32} ry={18 + jitter(i, 10) * 8} fill={MG.treeNear} />
            ))}

            {/* The four stands, each clipped to its own quadrilateral */}
            <clipPath id={`${id}-far`}><polygon points={farPoly} /></clipPath>
            <clipPath id={`${id}-near`}><polygon points={nearPoly} /></clipPath>
            <clipPath id={`${id}-left`}><polygon points={leftPoly} /></clipPath>
            <clipPath id={`${id}-right`}><polygon points={rightPoly} /></clipPath>
            <g clipPath={`url(#${id}-far)`}>{far}<rect x={L3} y={T3} width={R3 - L3} height={farRowH * 2} fill={`url(#${id}-shade)`} /></g>
            <g clipPath={`url(#${id}-left)`}>{side(-1)}</g>
            <g clipPath={`url(#${id}-right)`}>{side(1)}</g>
            <g clipPath={`url(#${id}-near)`}>{near}</g>

            {/* Concourse walkways between tiers run right round the bowl, and the mitred corner seams */}
            {[1, 2].map((k) => (
                <rect key={`wk${k}`} x={L[k]} y={T[k]} width={R[k] - L[k]} height={B[k] - T[k]} fill="none" stroke={MG.stoneShade} strokeWidth="5" />
            ))}
            {[[L0, T0, L3, T3], [R0, T0, R3, T3], [L0, B0, L3, B3], [R0, B0, R3, B3]].map(([ax, ay, bx, by], i) => (
                <line key={`seam${i}`} x1={ax} y1={ay} x2={bx} y2={by} stroke={MG.stoneDark} strokeWidth="2.5" />
            ))}

            {/* Royal box, set into the lower rows of the far stand */}
            <g>
                <rect x={midX - 38} y={T0 - farRowH * 3.6} width="76" height={farRowH * 3.6} rx="3" fill={MG.stoneShade} stroke={MG.gold} strokeWidth="1.2" />
                <rect x={midX - 38} y={T0 - farRowH * 1.1} width="76" height={farRowH * 0.35} fill={MG.stone} />
                <path d={`M${midX - 42},${T0 - farRowH * 3.5} Q${midX},${T0 - farRowH * 4.6} ${midX + 42},${T0 - farRowH * 3.5} Z`} fill={MG.leaf} stroke={MG.gold} strokeWidth="1" />
                <rect x={midX - 9} y={T0 - farRowH * 3.2} width="18" height={farRowH * 2} fill={club} />
                <path d={`M${midX - 9},${T0 - farRowH * 1.2} L${midX},${T0 - farRowH * 1.6} L${midX + 9},${T0 - farRowH * 1.2} Z`} fill={MG.stoneShade} />
            </g>

            {/* Grass apron and the pitch-side boards, one unbroken ring */}
            <rect x={x0 - apron} y={y0 - apron} width={x1 - x0 + apron * 2} height={y1 - y0 + apron * 2} fill={MG.apron} />
            <rect x={L0 + hoard / 2} y={T0 + hoard / 2} width={R0 - L0 - hoard} height={B0 - T0 - hoard} fill="none" stroke={MG.leafDark} strokeWidth={hoard} />
            <rect x={L0 + hoard / 2} y={T0 + hoard / 2} width={R0 - L0 - hoard} height={B0 - T0 - hoard} fill="none" stroke={`url(#${id}-runes)`} strokeWidth={hoard} opacity="0.9" />

            {/* The leaf-canopy roof: one ring from the back of the top tier to the frame */}
            <path d={`M0,${sky} H${w} V${h} H0 Z M${L3},${T3} H${R3} V${B3} H${L3} Z`} fill={MG.leafDark} fillRule="evenodd" />
            <path d={leafFringe(L3, R3, T3 + 1, 6)} fill={MG.leaf} />
            <path d={leafFringe(L3, R3, B3 - 1, -6)} fill={MG.leaf} />
            <path d={leafFringeV(T3, B3, L3 + 1, 6)} fill={MG.leaf} />
            <path d={leafFringeV(T3, B3, R3 - 1, -6)} fill={MG.leaf} />
            <path d={`M0,${sky} Q${midX},${sky - 10} ${w},${sky}`} stroke={MG.leafLight} strokeWidth="3" fill="none" />
            {lanterns}
            {corner(L3, T3, true)}
            {corner(R3, T3, true)}
            {corner(L3, B3, true)}
            {corner(R3, B3, true)}
            {/* Lantern towers rising from the far roof corners into the sky */}
            {[L3, R3].map((x) => (
                <g key={`tw${x}`}>
                    <line x1={x} y1={T3} x2={x} y2={sky * 0.45} stroke={MG.stoneDark} strokeWidth="3" />
                    <circle cx={x} cy={sky * 0.42} r="24" fill={`url(#${id}-glow)`} />
                    <path d={`M${x - 5},${sky * 0.45} L${x + 5},${sky * 0.45} L${x + 3.5},${sky * 0.45 - 11} L${x - 3.5},${sky * 0.45 - 11} Z`} fill={MG.lantern} stroke={MG.gold} strokeWidth="1" />
                </g>
            ))}
            {/* Venue name on the far roof's fascia */}
            <rect x={midX - 78} y={(sky + T3) / 2 - 9} width="156" height="18" rx="9" fill={MG.treeFar} stroke={MG.gold} strokeWidth="1" />
            <text x={midX} y={(sky + T3) / 2 + 4} textAnchor="middle" fontSize="10.5" fontWeight="700" letterSpacing="2.5" fill={MG.gold}>{label.toUpperCase()}</text>
            {/* Club pennants on the near roof corners */}
            {[L3 / 2, (R3 + w) / 2].map((x, i) => (
                <g key={`pn${x}`}>
                    <line x1={x} y1={h} x2={x} y2={B3 + 6} stroke={MG.stone} strokeWidth="1.5" />
                    <path d={`M${x},${B3 + 6} l${i ? -16 : 16},5 l${i ? 16 : -16},5 Z`} fill={club} />
                </g>
            ))}
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
        padding: 'clamp(150px, 20vw, 230px) clamp(92px, 11vw, 140px) clamp(96px, 12vw, 140px)',
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
