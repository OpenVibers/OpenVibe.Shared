#!/usr/bin/env node
'use strict';
/**
 * scripts/icon-ink.js — measure every icon's painted ink in headless Chrome, and normalise the sets.
 *
 * A hand-drawn glyph is rarely centred and rarely the same size as its neighbours; the eye notices
 * both inside a tile. This script renders every icon of every set at 96 px through the repo's browser
 * harness, measures the INK box (painted pixels, not the viewBox) and the centre of mass, and writes
 * test/fixtures/icon-ink.json with, per icon: the ink width and height as fractions of the box, the
 * ink box's offset from centre, and the centre of mass's offset.
 *
 *   node scripts/icon-ink.js                    measure everything, write test/fixtures/icon-ink.json
 *   node scripts/icon-ink.js --set ovi-line     measure one set (iteration)
 *   node scripts/icon-ink.js --normalise        measure, then centre and resize every drawing so the
 *       larger ink side is the set target (the median, 0.78 of the box) and the ink sits on the box
 *       centre, by rewriting the path data; rebuilds ov-glyphs.js, ov-glyphs.svg, nav-icons.js,
 *       navbar.js's icon block and the glyph fonts. Saves the pre-run measurement beside the fixture
 *       as icon-ink.before.json. Needs the picosvg venv for the fonts (see below).
 *   node scripts/icon-ink.js --sheets DIR       before/after contact sheets at 32/44/56/96 px
 *   node scripts/icon-ink.js --tile-demo DIR    one tile at painted fractions 0.50/0.58/0.64 + before
 *
 * The sets: ovi-line (ov-icons.js, the ring icons' line drawings; their solids are glyph solids since
 * 4.231.0, measured with glyphs-solid), glyphs-line and glyphs-solid (glyphs.js, the network's own set), kit-line (kit.js, whose
 * drawings join the glyph registry). Measured but never rewritten: brands (third-party marks, not ours
 * to redraw), home-local and search-local (one-off chrome, not sets), appicon (the one installable mark,
 * centred by construction). nav-icons.js is not measured separately: every entry is a glyphs.js drawing
 * (build-navbar-icons.js), so measuring the glyphs measures the bar.
 *
 * The font rebuild needs Python with picosvg (scripts/build-glyph-fonts.py): python3 -m venv
 * /tmp/ov-font-venv && /tmp/ov-font-venv/bin/pip install picosvg fonttools brotli, then
 * PATH=/tmp/ov-font-venv/bin:$PATH node scripts/icon-ink.js --normalise.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FIXTURE = path.join(ROOT, 'test', 'fixtures', 'icon-ink.json');
const BEFORE = path.join(ROOT, 'test', 'fixtures', 'icon-ink.before.json');
const PX = 96; // render size: px on a square box's side
// How far the centre of mass may pull a drawing off the box centre, as a fraction of the box. Half the
// test's 3% budget: the eye's judgement is worth something, and the set stays even.
const COM_PULL = 0.015;

const r4 = (n) => Math.round(n * 10000) / 10000;
/**
 * A coordinate: one decimal, no trailing zeros, never -0.
 *
 * One decimal is 0.42% of a 24-box — under half a pixel at the 96 px the measurement rasterises at,
 * and a tenth of the test's 4% size bound. The PAINTED SIZE is what lands on the half-unit grid (see
 * scaleFor); the coordinates themselves stay on a tenth, because a coordinate's rounding error adds to
 * the drawing's centring, and a half-unit coordinate error is 2.1% of the box — most of the test's 3%
 * centring budget spent on rounding.
 */
const fmt = (n) => {
    const r = Math.round(n * 10) / 10;
    return (Object.is(r, -0) ? 0 : r).toString();
};

// ── SVG path data: parse, transform, emit ────────────────────────────────────
// A transform is a uniform scale s about a blend point B onto the box centre C: p' = C + s·(p − B).
// Absolute coordinates map through the point; relative ones only scale (the translation cancels).

// The number of arguments each command takes. S/s take four like the spec (the first control point is
// reflected from the previous curve, so it is not written down) and T/t take two.
const ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/**
 * Tokenise path data into commands with implicit repeats expanded (M's extras become L).
 *
 * A command's numbers are kept in the groups they were written in, and a group that is short of the
 * command's arity stays short: some of our drawings write `S x1 y1 x2 y2` (four numbers, the spec's
 * count for S) and the browser then takes the next command's first pair as the endpoint, so the path's
 * shape depends on what follows it. Regrouping the numbers here would change the drawing.
 */
function parsePath(d) {
    const out = [];
    const re = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
    let m, cmd = null, abs = true, nums = [];
    const flush = () => {
        if (!cmd) return;
        const ar = ARITY[cmd];
        // The groups as written: a full one, and a last one that may be short.
        let i = 0;
        while (i + ar <= nums.length) {
            const first = i === 0;
            out.push({ c: cmd === 'M' && !first ? (abs ? 'L' : 'l') : (abs ? cmd : cmd.toLowerCase()), abs, nums: nums.slice(i, i + ar), full: true });
            i += ar;
        }
        if (i < nums.length) out.push({ c: abs ? cmd : cmd.toLowerCase(), abs, nums: nums.slice(i), full: false });
        nums = [];
    };
    while ((m = re.exec(d))) {
        if (m[1]) { flush(); cmd = m[1].toUpperCase(); abs = m[1] === cmd; if (cmd === 'Z') { out.push({ c: 'Z', abs: true, nums: [], full: true }); cmd = null; } }
        else if (cmd) nums.push(Number(m[2]));
    }
    flush();
    return out;
}

/** Join numbers with the fewest separators that still parse (a sign or dot starts a number). */
function joinNums(ns) {
    let s = '';
    for (const n of ns) {
        const t = fmt(n);
        if (s && t[0] !== '-' && t[0] !== '.') s += ' ';
        s += t;
    }
    return s;
}

/**
 * d with every coordinate mapped: pt for absolute points, dsc for relative deltas.
 *
 * The path keeps its COMMAND STYLE: a relative command stays relative, H and V stay H and V. Writing
 * the same shape in another style costs the file — an absolute L for every relative l, and a decimal
 * for every whole number — and the navbar's brotli budget is tight.
 *
 * The current point is tracked in the TRANSFORMED space and every coordinate is written from it, so
 * two points that coincide before the transform still coincide after it: rounding each source
 * coordinate on its own would let a shared corner drift by 0.1 and leave a zero-area sliver in the
 * outline, which the font build's path union cannot simplify.
 */
function transformPath(d, pt, dsc) {
    const parts = [];
    let cx = 0, cy = 0, sx = 0, sy = 0, first = true;
    const P = (x, y) => pt(x, y);
    // A coordinate as it is written down: rounded to a tenth, so the current point and the file agree
    // exactly. A tenth of a unit is 0.42% of a 24-box — a tenth of the test's centring budget.
    const R = (v) => { const r = Math.round(v * 10) / 10; return Object.is(r, -0) ? 0 : r; };
    for (const { c, abs, nums } of parsePath(d)) {
        const up = c.toUpperCase();
        if (up === 'Z') { parts.push('Z'); cx = sx; cy = sy; continue; }
        if (up === 'H') {
            if (abs) { const X = R(P(nums[0], 0)[0]); parts.push(`H${joinNums([X])}`); cx = X; }
            else { const d0 = R(dsc(nums[0])); parts.push(`h${joinNums([d0])}`); cx = R(cx + d0); }
        } else if (up === 'V') {
            if (abs) { const Y = R(P(0, nums[0])[1]); parts.push(`V${joinNums([Y])}`); cy = Y; }
            else { const d0 = R(dsc(nums[0])); parts.push(`v${joinNums([d0])}`); cy = R(cy + d0); }
        } else if (up === 'A') {
            const [rx, ry, rot, laf, sf, x, y] = nums;
            const Rr = [dsc(rx), dsc(ry)];
            if (abs) { const [X, Y] = P(x, y); parts.push(`A${joinNums([...Rr, rot, laf, sf, X, Y])}`); cx = R(X); cy = R(Y); }
            else { const X = R(cx + dsc(x)), Y = R(cy + dsc(y)); parts.push(`a${joinNums([...Rr, rot, laf, sf, X - cx, Y - cy])}`); cx = X; cy = Y; }
        } else {
            const isMove = up === 'M';
            const asAbs = abs || (isMove && first);
            // The endpoint in the transformed space, whether the command is absolute or relative.
            const nn = [];
            for (let i = 0; i < nums.length; i += 2) {
                if (asAbs) { const [X, Y] = P(nums[i], nums[i + 1]); nn.push(R(X), R(Y)); }
                else nn.push(R(cx + dsc(nums[i])), R(cy + dsc(nums[i + 1])));
            }
            // Only the segment's endpoint moves the current point; control points never do.
            const ex = nn[nn.length - 2], ey = nn[nn.length - 1];
            // A relative command carries DELTAS: write the transformed point minus the point it starts
            // from, so the file says the same thing the transform means.
            const out = asAbs ? nn : [];
            if (!asAbs) for (let i = 0; i < nn.length; i += 2) out.push(nn[i] - cx, nn[i + 1] - cy);
            cx = ex; cy = ey;
            // A first-command relative moveto (m20 20…) is a point from the origin: emit it absolute.
            parts.push(`${asAbs ? up : c}${joinNums(out)}`);
            if (isMove) { sx = cx; sy = cy; }
        }
        first = false;
    }
    return parts.join('');
}

/** Inner markup with every geometric attribute mapped; classes, fills, strokes and rules verbatim. */
function transformMarkup(markup, pt, dsc) {
    return markup.replace(/<(path|circle|rect|ellipse|line|polyline|polygon)\b([^>]*?)\/?>/g, (m, tag, attrs) => {
        if (/\btransform\s*=/.test(attrs)) throw new Error(`cannot transform an element that carries its own transform: ${m.slice(0, 80)}`);
        const get = (name) => {
            const r = new RegExp(`\\b${name}\\s*=\\s*("[^"]*"|'[^']*')`).exec(attrs);
            return r ? { raw: r[0], q: r[1][0], v: r[1].slice(1, -1) } : null;
        };
        const set = (name, v) => {
            const g = get(name);
            attrs = attrs.replace(g.raw, `${name}=${g.q}${v}${g.q}`);
        };
        const pair = (nx, ny) => {
            const gx = get(nx), gy = get(ny);
            if (!gx || !gy) return;
            const [X, Y] = pt(Number(gx.v), Number(gy.v));
            set(nx, fmt(X)); set(ny, fmt(Y));
        };
        const dist = (name) => { const g = get(name); if (g) set(name, fmt(dsc(Number(g.v)))); };
        const d = get('d');
        if (d) set('d', transformPath(d.v, pt, dsc));
        pair('cx', 'cy'); pair('x', 'y'); pair('x1', 'y1'); pair('x2', 'y2');
        for (const n of ['r', 'rx', 'ry', 'width', 'height']) dist(n);
        const pp = get('points');
        if (pp) {
            const ns = pp.v.trim().split(/[\s,]+/).map(Number);
            const out = [];
            for (let i = 0; i + 1 < ns.length; i += 2) { const [X, Y] = pt(ns[i], ns[i + 1]); out.push(`${fmt(X)},${fmt(Y)}`); }
            set('points', out.join(' '));
        }
        return `<${tag} ${attrs.trim()}/>`;
    });
}

// ── Source scanning: read a const object literal's entries with their offsets ──

function scanEntries(src, constName) {
    const m = new RegExp(`const ${constName} = (?:Object\\.freeze\\()?\\{`).exec(src);
    if (!m) throw new Error(`${constName}: object not found`);
    let i = m.index + m[0].length - 1; // at the '{'
    const n = src.length;
    const entries = [];
    let depth = 0, key = '', exprStart = -1, str = null, esc = false, lineC = false, blockC = false;
    const pushEntry = (end) => {
        let s = exprStart, e = end;
        while (s < e && /\s/.test(src[s])) s++;
        while (e > s && /\s/.test(src[e - 1])) e--;
        if (key && e > s) entries.push({ key, expr: src.slice(s, e), start: s, end: e });
        key = ''; exprStart = -1;
    };
    for (; i < n; i++) {
        const ch = src[i], nx = src[i + 1];
        if (lineC) { if (ch === '\n') lineC = false; continue; }
        if (blockC) { if (ch === '*' && nx === '/') { blockC = false; i++; } continue; }
        if (str) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === str) str = null; continue; }
        // A KEY comes before a string: a quoted key ('eye-off': …) is a key, and reading it as a string
        // would swallow the entry and leave the drawing out of the rewrite.
        if (depth === 1 && exprStart < 0 && /[A-Za-z0-9_$'"-]/.test(ch)) {
            let j = i, k = '';
            if (src[j] === "'" || src[j] === '"') { const q = src[j++]; while (j < n && src[j] !== q) { k += src[j]; j++; } j++; }
            else { while (j < n && /[A-Za-z0-9_$-]/.test(src[j])) { k += src[j]; j++; } }
            let t = j;
            while (t < n && /\s/.test(src[t])) t++;
            if (src[t] === ':') { key = k; i = t; exprStart = t + 1; continue; }
        }
        if (ch === '"' || ch === "'" || ch === '`') { str = ch; continue; }
        if (ch === '/' && nx === '/') { lineC = true; i++; continue; }
        if (ch === '/' && nx === '*') { blockC = true; i++; continue; }
        if (ch === '{' || ch === '[' || ch === '(') {
            depth++;
            if (depth === 1) { key = ''; exprStart = -1; }
            continue;
        }
        if (ch === '}' || ch === ']' || ch === ')') {
            depth--;
            if (depth === 0) { if (exprStart >= 0) pushEntry(i); break; }
            continue;
        }
        if (depth === 1 && ch === ',' && exprStart >= 0) pushEntry(i);
    }
    return entries;
}

const unquote = (e) => new Function(`return (${e});`)();

// ── The sets ─────────────────────────────────────────────────────────────────
// box: the square the measurement rasterises in and the normalise step maps into; sw: the production
// stroke the measurement rasterises with; norm: rewritten by --normalise.
// Every set's box is square, so one target fraction means one painted size everywhere. The Font
// Awesome solids are drawn in the 0..512 square their path data lives in (their DECLARED advance width
// varies, 384..640, but the path data does not), so their box is 512 too.

const SETS = {
    'ovi-line': { box: [24, 24], sw: 1.7, norm: true, label: 'ov-icons line (24-unit strokes)' },
    'glyphs-line': { box: [24, 24], sw: 2, norm: true, label: 'glyphs line (24-unit strokes)' },
    'glyphs-solid': { box: [24, 24], sw: 0, norm: true, label: 'glyphs solid (filled twins)' },
    'kit-line': { box: [24, 24], sw: 2, norm: true, label: 'kit line (24-unit strokes)' },
    'brands': { box: [24, 24], sw: 0, norm: false, label: 'brand marks (third party, measured only)' },
    'home-local': { box: [24, 24], sw: 2, norm: false, label: 'ov-home chrome (measured only)' },
    'search-local': { box: [24, 24], sw: -1, norm: false, label: 'search chrome (measured only)' },
    'appicon': { box: 'png', sw: 0, norm: false, label: 'installable mark (measured only)' },
};

/** ov-icons.js from a source string: line markup per name, with entry offsets. */
function loadOvi(src) {
    const P = (d) => `<path d="${d}"/>`;
    const line = {}, solid = {};
    const lineEntries = scanEntries(src, 'GLYPHS');
    for (const e of lineEntries) line[e.key] = new Function('P', `return (${e.expr});`)(P);
    const solidEntries = [];   // the ring solids are glyph solids (4.231.0), measured with glyphs-solid
    return { line, solid, lineEntries, solidEntries };
}

function loadGlyphsKit(rootDir) {
    const g = require(path.resolve(rootDir, 'glyphs.js'));
    const kit = require(path.resolve(rootDir, 'kit.js'));
    const line = {}, kl = {}, solid = {};
    for (const n of g.DRAWN) line[n] = g.path(n);
    for (const [n, d] of Object.entries(kit.PATHS)) kl[n] = d;
    for (const n of Object.keys(g.SOLID)) solid[n] = g.solid(n);
    return { line, solid, kit: kl, names: g.NAMES };
}

/** brands.js: slug -> path data (a 24-unit filled drawing each). */
function loadBrands(rootDir) {
    const b = require(path.resolve(rootDir, 'brands.js'));
    const out = {};
    for (const s of b.SLUGS) { const g = b.get(s); if (g) out[s] = g.path; }
    return out;
}

/** ov-home.js's ICON table: name -> inner markup (built the way svgIcon builds it). */
function loadHome(src) {
    const out = {};
    for (const e of scanEntries(src, 'ICON')) {
        const shapes = unquote(e.expr);
        out[e.key] = shapes.map(([tag, at]) => `<${tag} ${Object.entries(at).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
    }
    return out;
}

/** search.js's ICON table: name -> the whole <svg> string, kept as authored (own stroke). */
function loadSearch(src) {
    const m = /const (ICON\w*) = \{/.exec(src);
    if (!m) throw new Error('search.js: ICON table not found');
    const out = {};
    for (const e of scanEntries(src, m[1])) out[e.key] = unquote(e.expr);
    return out;
}

const svgURI = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

/** Measurement items: { key, src (data URI), w, h } per icon. */
function buildItems(rootDir, onlySet) {
    const oviSrc = fs.readFileSync(path.join(rootDir, 'ov-icons.js'), 'utf8');
    const ovi = loadOvi(oviSrc);
    const { line: gl, solid: gs, kit: kl } = loadGlyphsKit(rootDir);
    const brands = loadBrands(rootDir);
    const home = loadHome(fs.readFileSync(path.join(rootDir, 'ov-home.js'), 'utf8'));
    const search = loadSearch(fs.readFileSync(path.join(rootDir, 'search.js'), 'utf8'));
    const items = [];
    const want = (s) => !onlySet || onlySet === s;
    const stroked = (inner, sw, extra = '') =>
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${PX}" height="${PX}" fill="none" stroke="#000" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${extra}${inner}</svg>`;
    // Every item carries its markup: the raster reads the painted pixels, and the same markup is put
    // in the page so getBBox() can give the geometric box (the paths' own bounds, without the stroke).
    const push = (key, svg, w, h, stroke) => items.push({ key, svg, src: svgURI(svg), w, h, stroke });
    if (want('ovi-line')) for (const [n, d] of Object.entries(ovi.line)) {
        // Production fills the sub-unit dots (ov-icons.js CSS): measure what the page paints.
        const dots = '<style>circle[r=".6"],circle[r=".7"]{fill:#000;stroke:none}</style>';
        push(`ovi-line/${n}`, stroked(d, 1.7, dots), PX, PX);
    }
    if (want('glyphs-line')) for (const [n, d] of Object.entries(gl)) push(`glyphs-line/${n}`, stroked(d, 2), PX, PX);
    if (want('glyphs-solid')) for (const [n, d] of Object.entries(gs)) {
        // A solid drawing may carry a part that stays a line (class "ln"), stroked at 2.6: that stroke
        // widens the painted ink, so the icon's stroke is recorded and the normalise step accounts for it.
        const ln = '<style>.ln{fill:none;stroke:#000;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}</style>';
        push(`glyphs-solid/${n}`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${PX}" height="${PX}" fill="#000" stroke="none">${ln}${d}</svg>`, PX, PX, d.includes('class="ln"') ? 2.6 : 0);
    }
    if (want('kit-line')) for (const [n, d] of Object.entries(kl)) push(`kit-line/${n}`, stroked(d, 2), PX, PX);
    if (want('brands')) for (const [n, d] of Object.entries(brands)) push(`brands/${n}`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${PX}" height="${PX}" fill="#000"><path d="${d}"/></svg>`, PX, PX);
    if (want('home-local')) for (const [n, d] of Object.entries(home)) push(`home-local/${n}`, stroked(d, 2), PX, PX);
    if (want('search-local')) for (const [n, s] of Object.entries(search)) {
        const sized = s.replace(/<svg\b([^>]*)>/, (m, a) => `<svg${a.replace(/\swidth="[^"]*"/, '').replace(/\sheight="[^"]*"/, '')} width="${PX}" height="${PX}">`);
        push(`search-local/${n}`, sized.includes('xmlns=') ? sized : sized.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'), PX, PX);
    }
    if (want('appicon')) {
        const png = fs.readFileSync(path.join(rootDir, 'icons', 'network-192.png'));
        items.push({ key: 'appicon/network', src: 'data:image/png;base64,' + png.toString('base64'), w: 192, h: 192 });
    }
    return items;
}

// ── Browser measurement ──────────────────────────────────────────────────────
// One evaluate per set: each icon rasterised from a data URI (SVG) or PNG bytes, the alpha channel
// read back, the ink box and the alpha-weighted centre of mass computed in fractions of the box.

const RASTER = `(items) => Promise.all(items.map((it) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
        try {
            const W = it.w, H = it.h;
            const c = document.createElement('canvas'); c.width = W; c.height = H;
            const x = c.getContext('2d', { willReadFrequently: true });
            x.drawImage(img, 0, 0, W, H);
            const d = x.getImageData(0, 0, W, H).data;
            let n = 0, sa = 0, sx = 0, sy = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
            for (let i = 0; i < W * H; i++) {
                const a = d[i * 4 + 3];
                if (!a) continue;
                n++; sa += a;
                const px = i % W, py = (i / W) | 0;
                if (px < x0) x0 = px; if (px > x1) x1 = px;
                if (py < y0) y0 = py; if (py > y1) y1 = py;
                sx += (px + 0.5) * a; sy += (py + 0.5) * a;
            }
            // The GEOMETRIC box: the paths' own bounds, without the stroke. A stroked drawing's painted
            // ink is not its geometry plus the stroke — a diagonal edge adds the stroke times root two —
            // so the scale has to be solved on the geometry, and only the centring reads the painted ink.
            let geo = null;
            try {
                const holder = document.createElement('div');
                holder.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;overflow:hidden';
                holder.innerHTML = it.svg || '';
                document.body.appendChild(holder);
                const svg = holder.querySelector('svg');
                if (svg) {
                    const b = svg.getBBox();
                    if (b.width || b.height) geo = [b.x, b.y, b.width, b.height];
                }
                holder.remove();
            } catch (e) { geo = null; }
            resolve(n ? { key: it.key, n, ink: [x0 / W, y0 / H, (x1 + 1) / W, (y1 + 1) / H], com: [sx / sa / W, sy / sa / H], geo }
                : { key: it.key, n: 0, ink: [0, 0, 0, 0], com: [0.5, 0.5], geo: null });
        } catch (e) { resolve({ key: it.key, n: -1, error: String(e && e.message || e) }); }
    };
    img.onerror = () => resolve({ key: it.key, n: -1, error: 'raster failed' });
    img.src = it.src;
})))`;

/** { key -> { n, ink, com, geo } } for every item, one page evaluate per set. Exported for the test. */
async function measureItems(page, items) {
    const out = {};
    const sets = {};
    for (const it of items) (sets[it.key.split('/')[0]] = sets[it.key.split('/')[0]] || []).push(it);
    for (const [set, group] of Object.entries(sets)) {
        const CH = 250;
        for (let i = 0; i < group.length; i += CH) {
            const part = group.slice(i, i + CH).map(({ key, src, w, h, svg }) => ({ key, src, w, h, svg }));
            const res = await page.evaluate(`(${RASTER})(${JSON.stringify(part)})`, 180000);
            for (const r of res) out[r.key] = r;
        }
    }
    return out;
}

async function withBrowser(fn) {
    const h = require(path.join(ROOT, 'browser-harness.js'));
    if (!h.findChrome()) throw new Error('Chrome not found (set CHROME_BIN)');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-icon-ink-'));
    const browser = await h.launch({ tmpDir });
    const context = await browser.newContext();
    try {
        return await fn(await h.openPage(browser, context, { width: 800, height: 600 }));
    } finally {
        await context.dispose(); await browser.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

/** Full measurement from a checkout's sources: { sets: { id -> { box, icons: { name -> rec } } } }. */
async function measureAll(rootDir, onlySet) {
    const items = buildItems(rootDir, onlySet);
    const byKey = await withBrowser((page) => measureItems(page, items));
    const failed = Object.values(byKey).filter((r) => r.n <= 0);
    if (failed.length) throw new Error(`raster failed for ${failed.map((r) => r.key).join(', ')}`);
    const strokeOf = new Map(items.map((it) => [it.key, it.stroke == null ? SETS[it.key.split('/')[0]].sw : it.stroke]));
    const sets = {};
    for (const [key, r] of Object.entries(byKey)) {
        const [set, name] = [key.slice(0, key.indexOf('/')), key.slice(key.indexOf('/') + 1)];
        sets[set] = sets[set] || { box: SETS[set].box, norm: SETS[set].norm, icons: {} };
        const [x0, y0, x1, y1] = r.ink;
        const rec = {
            ink: [r4(x1 - x0), r4(y1 - y0)],
            off: [r4((x0 + x1) / 2 - 0.5), r4((y0 + y1) / 2 - 0.5)],
            com: [r4(r.com[0] - 0.5), r4(r.com[1] - 0.5)],
            sw: strokeOf.get(key),
            n: r.n,
        };
        // The geometric box, in fractions of the box: the paths' own bounds, without the stroke. The
        // scale is solved on this (a stroke's reach depends on the angle of the edge it sits on), while
        // the centring reads the painted ink.
        if (r.geo) {
            const [bx, by, bw, bh] = r.geo;
            const b = SETS[set].box;
            if (Array.isArray(b)) {
                rec.geo = [r4(bw / b[0]), r4(bh / b[1])];
                rec.geoOff = [r4((bx + bw / 2) / b[0] - 0.5), r4((by + bh / 2) / b[1] - 0.5)];
            }
        }
        sets[set].icons[name] = rec;
    }
    return sets;
}

const median = (ns) => { const s = [...ns].sort((a, b) => a - b); return s.length % 2 ? s[s.length >> 1] : (s[(s.length >> 1) - 1] + s[s.length >> 1]) / 2; };

function summarize(sets) {
    const lines = [];
    for (const [set, { icons }] of Object.entries(sets)) {
        const recs = Object.entries(icons);
        const longs = recs.map(([, r]) => Math.max(...r.ink));
        const med = median(longs);
        const worst = recs.map(([n, r]) => [n, Math.hypot(r.off[0], r.off[1])]).sort((a, b) => b[1] - a[1]).slice(0, 10);
        lines.push(`${set}: ${recs.length} icons, median long side ${med.toFixed(4)} of box`);
        lines.push(`  furthest off centre: ${worst.map(([n, d]) => `${n} ${(d * 100).toFixed(1)}%`).join(', ')}`);
    }
    return lines.join('\n');
}

// ── Normalise ────────────────────────────────────────────────────────────────
// Per drawing: centre the ink on the box (the ink-box centre blended 70/30 with the centre of
// mass, so a lopsided drawing sits where the eye puts it) and scale the larger ink side to the
// target. Applied by rewriting the path data: the files keep the same number of coordinates (no
// per-icon tables, no runtime cost, every consumer — inline, sprite, font, navbar — inherits it),
// and the stroke stays the set's uniform width, which a per-icon viewBox or <g> scale would not.
// A solid twin gets its OWN transform, not its line twin's: 111 of 203 twins differ by >3% in size
// or >2.5% in centre, so sharing would miss the target; separate transforms also centre the two on
// each other, which is what duotone overlays. ov-icons solids are normalised in their w×512 box to
// the same fraction, and glyphMarkup's fit becomes the full-box map (24/512), so line and solid
// paint the same size.

/**
 * { s, pt, dsc } mapping p' = C + s·(p − B): C the box centre, B the point the transform pins to C.
 *
 * The scale puts the drawing's PAINTED larger ink side on the target fraction of the box. It is solved
 * on the geometry and the stroke's REACH, not on the painted ink: the transform scales the paths, and the
 * stroke stays the set's width, so the painted ink is s·geo + reach. The reach is measured, not assumed:
 * a stroke's spread past the geometry depends on the angle of the edge it sits on (a diagonal edge adds
 * the stroke times root two, and a round cap adds half of it past the end), so reach = painted − geometry
 * is read off the drawing and held fixed while the geometry is scaled. Solving on the painted ink alone
 * would leave every drawing whose edges are not axis-aligned a few per cent over the target.
 *
 * The position is the one the eye reads: the INK BOX is the centre, and the centre of mass pulls it 30%
 * of the way towards the mass, so a lopsided drawing (a "play" triangle, a "download" arrow) sits where
 * the eye puts it rather than where a bounding box says it is. The pull is CLAMPED to 1.5% of the box:
 * the eye's judgement is worth half the test's 3% budget, and no more — the widest gap between a
 * drawing's ink box and its mass is 17.5% of the box, which a full 30% pull would push past the budget.
 *
 * Pinning the ink box (rather than the blend) is what makes the step converge: the painted box is what
 * the measurement reads back, so the transform is close to its own inverse on that measure.
 */
/**
 * The scale that puts a drawing's painted longer side on the target fraction of the box.
 *
 * The transform scales the paths, and the stroke stays the set's width, so the painted ink on an axis
 * is s·geo + reach, where reach is the stroke's spread past the geometry on that axis. The reach is
 * measured, not assumed: a stroke's spread depends on the angle of the edge it sits on (a diagonal edge
 * adds the stroke times root two, and a round cap adds half of it past the end). The two axes can
 * disagree about which is longer — a wide drawing whose stroke makes it taller than it is wide — so
 * both candidates are computed and the one that lands the painted longer side on the target wins.
 *
 * The painted size lands on a HALF-UNIT grid, not on the target exactly. Half a unit is 2.1% of a
 * 24-box — one pixel at the 96 px the measurement rasterises at, and a quarter of the test's 4% —
 * and it keeps the drawings on the grid the hand-drawn ones already use, so the rewritten paths stay
 * as short as the ones they replace. Chasing the target exactly would put every coordinate on a
 * tenth and cost the navbar half a kilobyte of its brotli budget for a tenth of a pixel.
 */
function scaleFor(boxW, boxH, rec, target) {
    const ref = boxW === boxH ? boxW : boxH;
    const inkW = rec.ink[0] * boxW, inkH = rec.ink[1] * boxH;
    const geoW = rec.geo ? rec.geo[0] * boxW : inkW, geoH = rec.geo ? rec.geo[1] * boxH : inkH;
    const reachW = Math.max(0, inkW - geoW), reachH = Math.max(0, inkH - geoH);
    // The painted size to land on: the target, snapped to the half-unit grid.
    const GRID = 0.5;
    const want = (t) => Math.max(GRID, Math.round(t / GRID) * GRID);
    let s = (want(target * ref) - reachW) / geoW;
    for (const c of [(want(target * ref) - reachW) / geoW, (want(target * ref) - reachH) / geoH]) {
        if (!(c > 0)) continue;
        // With this scale, does the axis it solves stay the longer painted side?
        if (c * geoW + reachW >= c * geoH + reachH) { s = c; break; }
        s = c;
    }
    return s;
}

function transformFor(boxW, boxH, rec, target) {
    const ref = boxW === boxH ? boxW : boxH;
    const inkW = rec.ink[0] * boxW, inkH = rec.ink[1] * boxH;
    const ix = (rec.off[0] + 0.5) * boxW, iy = (rec.off[1] + 0.5) * boxH; // ink-box centre, units
    const mx = (rec.com[0] + 0.5) * boxW, my = (rec.com[1] + 0.5) * boxH; // centre of mass, units
    const s = scaleFor(boxW, boxH, rec, target);
    const cx = boxW / 2, cy = boxH / 2;
    // The pull the eye asks for, clamped to COM_PULL of the box.
    let px = 0.3 * (mx - ix), py = 0.3 * (my - iy);
    const cap = COM_PULL * ref;
    const pl = Math.hypot(px, py);
    if (pl > cap) { px = (px / pl) * cap; py = (py / pl) * cap; }
    // The painted ink box ends up at C + pull, so the pinned point is I + pull/s.
    const bx = ix + px / s, by = iy + py / s;
    return { s, pt: (x, y) => [cx + s * (x - bx), cy + s * (y - by)], dsc: (v) => v * s };
}

function checkGrid(name, markup) {
    for (const m of markup.matchAll(/(?:cx|cy|x|y)="(-?[\d.]+)"/g)) {
        const v = Number(m[1]);
        if (v < 0 || v > 24) return `${name}: ${m[0]} off the 24 grid`;
    }
    return null;
}

/** Replace entry expressions in src (applied end-first so offsets hold); { src, count }. */
function rewriteEntries(src, entries, exprOf) {
    let out = src, count = 0;
    const sorted = [...entries].sort((a, b) => b.start - a.start);
    for (const e of sorted) {
        const expr = exprOf(e);
        if (expr == null || expr === e.expr) continue;
        out = out.slice(0, e.start) + expr + out.slice(e.end);
        count++;
    }
    return { src: out, count };
}

const squote = (s) => {
    if (/['\\]/.test(s)) throw new Error(`cannot single-quote: ${s.slice(0, 60)}`);
    return `'${s}'`;
};

async function cmdMeasure(out, onlySet) {
    const sets = await measureAll(ROOT, onlySet);
    const h = require(path.join(ROOT, 'browser-harness.js'));
    const doc = { generated: new Date().toISOString(), chrome: h.findChrome(), px: PX, sets };
    fs.writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');
    console.log(`wrote ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
    console.log(summarize(sets));
}

async function refreshOffsets() {
    // The ring centres each glyph by its getBBox (ov-icons.js OFFSETS); after normalisation the ink
    // is on the centre, so this table should empty. Same method as scripts/measure-icons.js.
    const file = path.join(ROOT, 'ov-icons.js');
    const clean = fs.readFileSync(file, 'utf8').replace(/const OFFSETS = \{[^}]*\};/, 'const OFFSETS = {};');
    const out = await withBrowser((page) => page.evaluate(`(() => {
        ${clean}
        const r = {};
        for (const n of OpenVibeIcons.names()) {
            const d = document.createElement('div');
            d.innerHTML = OpenVibeIcons.svg(n, 48);
            document.body.appendChild(d);
            const b = d.querySelector('.ovi-glyph').getBBox();
            r[n] = [+(12 - (b.x + b.width / 2)).toFixed(2), +(12 - (b.y + b.height / 2)).toFixed(2)];
            d.remove();
        }
        return r;
    })()`, 120000));
    const table = Object.entries(out).filter(([, [x, y]]) => Math.abs(x) >= 0.05 || Math.abs(y) >= 0.05)
        .map(([n, [x, y]]) => `${JSON.stringify(n)}:[${x},${y}]`).join(',');
    const src = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, src.replace(/const OFFSETS = \{[^}]*\};/, `const OFFSETS = {${table}};`));
    const kept = table ? table.split('],').length : 0;
    console.log(`OFFSETS: ${Object.keys(out).length} glyphs measured, ${kept} still corrected`);
    const worst = Object.entries(out).sort((a, b) => Math.hypot(...b[1]) - Math.hypot(...a[1])).slice(0, 5);
    console.log(`  residual: ${worst.map(([n, o]) => `${n}${JSON.stringify(o)}`).join(' ')}`);
}

/**
 * The transform one drawing needs, or null when it is already there.
 *
 * A drawing is left alone when its painted ink is already where it should be. The bands are a quarter
 * of the test's own bounds — the larger side within 1% of the target and the ink box within 0.75% of
 * the centre — so a drawing this step leaves alone passes with room to spare, and a drawing that is
 * visibly off is always rewritten. Leaving a drawing alone also leaves its file alone: rewriting a
 * drawing that only needed a 1% nudge costs the navbar its brotli budget, because the normalised
 * coordinates carry a decimal the hand-drawn ones did not.
 */
function neededTransform(set, name, boxW, boxH, rec, target) {
    const ref = boxW === boxH ? boxW : boxH;
    const inkW = rec.ink[0] * boxW, inkH = rec.ink[1] * boxH;
    const s = scaleFor(boxW, boxH, rec, target);
    const ix = (rec.off[0] + 0.5) * boxW, iy = (rec.off[1] + 0.5) * boxH;
    const mx = (rec.com[0] + 0.5) * boxW, my = (rec.com[1] + 0.5) * boxH;
    // Where the painted ink box ends up after the transform: the centre plus the (clamped) com pull.
    const pull = (v) => {
        let p = 0.3 * v;
        const cap = COM_PULL * ref;
        return Math.abs(p) > cap ? Math.sign(p) * cap : p;
    };
    const ex = pull(mx - ix), ey = pull(my - iy);
    // The ink box's own offset from the centre is what the eye sees; the pull is how much of it is
    // left on purpose. A drawing still further out than the pull is not done.
    const dx = rec.off[0] * boxW, dy = rec.off[1] * boxH;
    const off = Math.hypot(dx - ex, dy - ey);
    if (Math.abs(s - 1) <= 0.01 && off <= 0.18) return null;
    return transformFor(boxW, boxH, rec, target);
}

/** Rewrite every normalised set's drawings with the transforms the measurement asks for. */
function applyTransforms(measured, target) {
    const gridErrors = [];
    const scales = [];
    let skipped = 0, count = 0;
    const maybe = (set, name, boxW, boxH) => {
        const rec = measured[set] && measured[set].icons[name];
        if (!rec) return null;
        const t = neededTransform(set, name, boxW, boxH, rec, target);
        if (!t) { skipped++; return null; }
        scales.push(t.s);
        return t;
    };
    // ov-icons.js: the line markup collapsed to one string each.
    {
        const file = path.join(ROOT, 'ov-icons.js');
        const src = fs.readFileSync(file, 'utf8');
        const ovi = loadOvi(src);
        const P = (d) => `<path d="${d}"/>`;
        const r = rewriteEntries(src, ovi.lineEntries, (e) => {
            const t = maybe('ovi-line', e.key, 24, 24);
            if (!t) return null;
            const old = new Function('P', `return (${e.expr});`)(P);
            return squote(transformMarkup(old, t.pt, t.dsc));
        });
        fs.writeFileSync(file, r.src);
        count += r.count;
        console.log(`ov-icons.js: ${r.count} line drawings rewritten`);
    }
    // glyphs.js: line drawings and solid twins, each its own transform.
    {
        const file = path.join(ROOT, 'glyphs.js');
        const src = fs.readFileSync(file, 'utf8');
        let r = rewriteEntries(src, scanEntries(src, 'DRAWN'), (e) => {
            const t = maybe('glyphs-line', e.key, 24, 24);
            if (!t) return null;
            const next = transformMarkup(unquote(e.expr), t.pt, t.dsc);
            const err = checkGrid(e.key, next);
            if (err) gridErrors.push(err);
            return squote(next);
        });
        r = rewriteEntries(r.src, scanEntries(r.src, 'SOLID'), (e) => {
            const t = maybe('glyphs-solid', e.key, 24, 24);
            if (!t) return null;
            const next = transformMarkup(unquote(e.expr), t.pt, t.dsc);
            const err = checkGrid(`solid/${e.key}`, next);
            if (err) gridErrors.push(err);
            return squote(next);
        });
        fs.writeFileSync(file, r.src);
        count += r.count;
        console.log(`glyphs.js: ${r.count} drawings rewritten`);
    }
    // kit.js: the kit's own drawings (file style: double quotes escaped).
    {
        const file = path.join(ROOT, 'kit.js');
        const src = fs.readFileSync(file, 'utf8');
        const r = rewriteEntries(src, scanEntries(src, 'P'), (e) => {
            const t = maybe('kit-line', e.key, 24, 24);
            if (!t) return null;
            const next = transformMarkup(unquote(e.expr), t.pt, t.dsc);
            const err = checkGrid(`kit/${e.key}`, next);
            if (err) gridErrors.push(err);
            return `'${next.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}'`;
        });
        fs.writeFileSync(file, r.src);
        count += r.count;
        console.log(`kit.js: ${r.count} drawings rewritten`);
    }
    if (gridErrors.length) {
        console.error(`GRID VIOLATIONS (cx/cy/x/y must stay in 0..24):\n${gridErrors.join('\n')}`);
        throw new Error(`${gridErrors.length} drawings left the 24 grid`);
    }
    scales.sort((a, b) => a - b);
    console.log(`scales: min ${scales[0].toFixed(3)}, median ${median(scales).toFixed(3)}, max ${scales[scales.length - 1].toFixed(3)}; ${skipped} already settled`);
    return count;
}

async function cmdNormalise(targetFlag) {
    console.log('measuring before…');
    const before = await measureAll(ROOT, null);
    const h = require(path.join(ROOT, 'browser-harness.js'));
    fs.writeFileSync(BEFORE, JSON.stringify({ generated: new Date().toISOString(), chrome: h.findChrome(), px: PX, note: 'pre-normalisation', sets: before }, null, 1) + '\n');
    const pool = [];
    for (const s of ['ovi-line', 'glyphs-line', 'glyphs-solid', 'kit-line']) for (const r of Object.values(before[s].icons)) pool.push(Math.max(...r.ink));
    const target = targetFlag ? Number(targetFlag) : Math.round(median(pool) * 100) / 100;
    console.log(`target: ${target} of box (pooled median ${median(pool).toFixed(4)} over ${pool.length} drawings)`);

    // ── normalise, then rebuild, then measure again, until it settles ──
    // The ring icons' solids are not rewritten here: scripts/build-navbar-icons.js copies them from the glyphs.
    const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
    const rebuild = () => {
        run(process.execPath, ['scripts/build-glyphs.js']);
        run(process.execPath, ['scripts/build-navbar-icons.js']);
        try {
            execFileSync('python3', ['-c', 'import picosvg'], { stdio: 'pipe' });
        } catch {
            throw new Error('fonts not rebuilt: python3 has no picosvg (see the header); re-run with the venv on PATH');
        }
        run('python3', ['scripts/build-glyph-fonts.py']);
        for (const f of ['glyphs.js', 'kit.js', 'brands.js']) delete require.cache[path.resolve(ROOT, f)];
    };
    rebuild();
    let measured = await measureAll(ROOT, null);
    for (let pass = 1; pass <= 6; pass++) {
        const n = applyTransforms(measured, target);
        if (!n) { console.log(`pass ${pass}: nothing left to move`); break; }
        rebuild();
        measured = await measureAll(ROOT, null);
        console.log(`pass ${pass}: ${n} drawings rewritten, re-measured`);
    }
    console.log('rebuilt ov-glyphs.js, ov-glyphs.svg, nav-icons.js, navbar.js block, glyph fonts');
    await refreshOffsets();

    // ── write the fixture and verify ──
    const after = measured;
    fs.writeFileSync(FIXTURE, JSON.stringify({ generated: new Date().toISOString(), chrome: h.findChrome(), px: PX, target, sets: after }, null, 1) + '\n');
    console.log(summarize(after));
    const failures = [];
    for (const [set, spec] of Object.entries(SETS)) {
        if (!spec.norm) continue;
        for (const [name, r] of Object.entries(after[set].icons)) {
            if (Math.abs(r.off[0]) > 0.03 || Math.abs(r.off[1]) > 0.03) failures.push(`${set}/${name}: off centre ${(r.off[0] * 100).toFixed(1)}%,${(r.off[1] * 100).toFixed(1)}%`);
            if (Math.abs(Math.max(...r.ink) - target) > 0.04) failures.push(`${set}/${name}: long side ${Math.max(...r.ink).toFixed(3)}, target ${target}`);
        }
    }
    if (failures.length) {
        console.error(`NOT NORMALISED (${failures.length}):\n${failures.join('\n')}`);
        throw new Error(`${failures.length} icons still outside 3%/4%`);
    }
    console.log(`all ${Object.entries(SETS).filter(([, s]) => s.norm).map(([s]) => Object.keys(after[s].icons).length).reduce((a, b) => a + b, 0)} normalised icons within 3% centre, 4% size`);
}

module.exports = { SETS, PX, fmt, parsePath, transformPath, transformMarkup, transformFor, scanEntries, loadOvi, loadGlyphsKit, loadBrands, loadHome, loadSearch, buildItems, measureItems, measureAll, median, FIXTURE, BEFORE };

if (require.main === module) {
    const args = process.argv.slice(2);
    const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
    const out = flag('--out') || FIXTURE;
    const onlySet = flag('--set');
    (async () => {
        if (args.includes('--normalise')) { await cmdNormalise(flag('--target')); return; }
        if (flag('--sheets')) { await require('./icon-ink-sheets').saveSheets(path.resolve(flag('--sheets'))); return; }
        if (flag('--tile-demo')) { await require('./icon-ink-sheets').saveTileDemo(path.resolve(flag('--tile-demo'))); return; }
        await cmdMeasure(out, onlySet);
    })().catch((e) => { console.error(e.message || e); process.exit(1); });
}


