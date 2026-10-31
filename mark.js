'use strict';
// ═══════════════════════════════════════════════════════════════
// openvibe-shared/mark — the OpenVibe mark as static SVG, for servers, icons, share cards and anyone else.
//
// The mark is the Pair: a ring O and a round V, the V with a gap of the ground around it where it crosses the ring
// (the owner, 2026-10-31: "Pair, halo … this should be our new logo"). The gap is a mask, not a painted halo, so the
// mark sits on any ground: a photo, a gradient, a light or a dark theme.
//
// Geometry, in a 100-unit box with the mark centred on (50, 50): the V is exactly as tall as the O (its caps meet the
// O's top and bottom), so it sits level beside a word and centred in a tile. Two forms:
//   pair   the mark: ring 20 + stroke 13, the V's stroke 13.
//   heavy  for 22 px wide and under (favicons, buttons): ring 18 + stroke 18, the V's stroke 17.
// ov-mark.js (the browser drop-in with its states and motion) draws the same numbers; test/mark.test.js checks it.
//
//   geo(form)                       → { cx, cy, r, sw, R, vsw, halo, A, T, B, ring, box, wideBox }
//   shapes(form)                    → the V's two strokes for each shape it takes: v, ok (a tick), no (a cross),
//                                     err (an exclamation mark), tip (folded into its point, for the intro)
//   art({ form, o, v, id, shape, depth })
//                                   → { defs, body }: the mark's <defs> and drawing, to place inside another SVG
//   svg({ form, tone, wide, size, title, id, depth })
//                                   → a standalone SVG. tone: 'brand' (blue O, violet V), 'ink' (currentColor),
//                                     'white', or { o, v }. wide: the box hugs the mark (92 × 56) instead of a square.
//                                     depth (4.66.0; on by default for the brand tone): each stroke runs from a lighter
//                                     to a deeper tone of its colour, as ov-mark.js draws it. Hex colours only; the
//                                     one-colour tones stay flat.
//   COLORS                          → { o: '#4f7cff', v: '#8b5cf6' }
// ═══════════════════════════════════════════════════════════════

const COLORS = Object.freeze({ o: '#4f7cff', v: '#8b5cf6' });
const f = (v) => +v.toFixed(2);

/** The Pair: ring radius r and stroke sw, the V's stroke vsw; the V's left cap a, tip t and right cap b, as multiples of the ring's outer radius from its centre. */
function pair(r, sw, vsw, a = 0.86, t = 1.5, b = 2.16) {
    const R = r + sw / 2, right = b * R + vsw / 2, cx = 50 - (right - R) / 2, cy = 50;
    const A = [f(cx + a * R), f(cy - R + vsw / 2)], T = [f(cx + t * R), f(cy + R - vsw / 2)], B = [f(cx + b * R), f(cy - R + vsw / 2)];
    // The ring as a path from its top, clockwise: a page load draws it as progress (pathLength 100).
    const ring = `M${f(cx)} ${f(cy - r)}A${r} ${r} 0 1 1 ${f(cx)} ${f(cy + r)}A${r} ${r} 0 1 1 ${f(cx)} ${f(cy - r)}`;
    const x0 = f(cx - R), x1 = f(B[0] + vsw / 2), pad = 2;
    const w = f(x1 - x0 + 2 * pad);
    return {
        cx: f(cx), cy, r, sw, R: f(R), vsw, halo: vsw + 7, A, T, B, ring,
        // A square box centred on the mark, and a wide one that hugs it.
        box: `${f(50 - w / 2)} ${f(50 - w / 2)} ${w} ${w}`,
        wideBox: `${f(50 - w / 2)} ${f(50 - R - pad)} ${w} ${f(2 * R + 2 * pad)}`,
    };
}
const FORMS = Object.freeze({ pair: pair(20, 13, 13), heavy: pair(18, 18, 17) });
const geo = (form) => FORMS[form === 'heavy' || form === 'solid' ? 'heavy' : 'pair'];

/** The V's two strokes, each from its first point, for every shape it takes: [x1, y1, x2, y2, x3, y3, x4, y4]. */
function shapes(form) {
    const g = geo(form), [A, T, B] = [g.A, g.T, g.B];
    const w = B[0] - A[0], h = T[1] - A[1], cx = A[0] + w / 2, cy = A[1] + h * 0.55, s = Math.min(w, h) * 0.42;
    const tick = [A[0] + w * 0.46, T[1]];
    return Object.fromEntries(Object.entries({
        v: [T[0], T[1], A[0], A[1], T[0], T[1], B[0], B[1]],
        tip: [T[0], T[1], T[0], T[1], T[0], T[1], T[0], T[1]],
        ok: [tick[0], tick[1], A[0] + w * 0.16, A[1] + h * 0.52, tick[0], tick[1], B[0] + w * 0.06, A[1]],
        no: [cx - s + w * 0.1, cy - s, cx + s + w * 0.1, cy + s, cx - s + w * 0.1, cy + s, cx + s + w * 0.1, cy - s],
        err: [cx, A[1], cx, T[1] - g.vsw * 1.28, cx, T[1], cx, T[1] + 0.01],
    }).map(([k, p]) => [k, p.map(f)]));
}

const stroke = (p, i) => `M${p[i]} ${p[i + 1]}L${p[i + 2]} ${p[i + 3]}`;
const HEX = /^#[0-9a-f]{6}$/i;
/** hex mixed toward `to` by t (0..1): ov-mark.js's color-mix, worked out for files that cannot run CSS. */
function mix(hex, to, t) {
    const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
    return `#${[16, 8, 0].map((sh) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t).toString(16).padStart(2, '0')).join('')}`;
}
/** The light-to-deep tones of each stroke: the same mixes as ov-mark.js (O 68% / 84%, V 70% / 86%). */
const tones = (o, v) => ({ o: [mix(o, '#ffffff', 0.32), mix(o, '#000000', 0.16)], v: [mix(v, '#ffffff', 0.30), mix(v, '#000000', 0.14)] });

/** The mark's defs and drawing, to place inside another SVG. ids are prefixed with `id` (unique per document). */
function art({ form = 'pair', o = COLORS.o, v = COLORS.v, id = 'ovm', shape = 'v', depth = false } = {}) {
    const g = geo(form), p = shapes(form)[shape] || shapes(form).v;
    let defs = `<mask id="${id}h" maskUnits="userSpaceOnUse" x="-20" y="-20" width="140" height="140"><rect x="-20" y="-20" width="140" height="140" fill="#fff"/>`
        + `<path d="${stroke(p, 0)}${stroke(p, 4)}" fill="none" stroke="#000" stroke-width="${g.halo}" stroke-linecap="round"/></mask>`;
    let os = o, vs = v;
    if (depth && HEX.test(o) && HEX.test(v)) {
        // In user space: a straight stroke (the "!" shape) has no box for a bounding-box gradient to span.
        const t = tones(o, v);
        defs += `<linearGradient id="${id}go" gradientUnits="userSpaceOnUse" x1="${f(g.cx - g.R)}" y1="${f(g.cy - g.R)}" x2="${f(g.cx + g.R)}" y2="${f(g.cy + g.R)}"><stop offset="0" stop-color="${t.o[0]}"/><stop offset="1" stop-color="${t.o[1]}"/></linearGradient>`
            + `<linearGradient id="${id}gv" gradientUnits="userSpaceOnUse" x1="0" y1="${g.A[1]}" x2="0" y2="${g.T[1]}"><stop offset="0" stop-color="${t.v[0]}"/><stop offset="1" stop-color="${t.v[1]}"/></linearGradient>`;
        os = `url(#${id}go)`; vs = `url(#${id}gv)`;
    }
    const body = `<circle cx="${g.cx}" cy="${g.cy}" r="${g.r}" fill="none" stroke="${os}" stroke-width="${g.sw}" mask="url(#${id}h)"/>`
        + `<path d="${stroke(p, 0)}${stroke(p, 4)}" fill="none" stroke="${vs}" stroke-width="${g.vsw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    return { defs, body };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** A standalone SVG of the mark. */
function svg({ form = 'pair', tone = 'brand', wide = false, size = null, title = 'OpenVibe', id = 'ovm', depth = tone === 'brand' } = {}) {
    const c = typeof tone === 'object' && tone ? tone
        : tone === 'ink' ? { o: 'currentColor', v: 'currentColor' }
            : tone === 'white' ? { o: '#fff', v: '#fff' } : COLORS;
    const g = geo(form), box = wide ? g.wideBox : g.box;
    const [, , bw, bh] = box.split(' ').map(Number);
    const dims = size ? ` width="${f(wide ? size * bw / bh : size)}" height="${size}"` : '';
    const { defs, body } = art({ form, o: c.o, v: c.v, id, depth });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}"${dims} role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><defs>${defs}</defs>${body}</svg>`;
}

module.exports = { COLORS, FORMS, geo, shapes, art, svg, tones };
