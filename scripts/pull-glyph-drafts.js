#!/usr/bin/env node
'use strict';
// Takes the icon drafts approved on openvibe.design into the registry (plan L50): each approved draft whose name the
// set does not have yet becomes a line drawing in glyphs.js (DRAWN), and its solid twin, when it has one, a SOLID
// entry. Every drawing is checked again here, shape by shape, before it is written: a draft that fails is reported and
// left out. Nothing is fetched but the public list of approved drafts.
//
//   node scripts/pull-glyph-drafts.js                    what would be added (dry run)
//   node scripts/pull-glyph-drafts.js --apply            write glyphs.js
//   node scripts/pull-glyph-drafts.js --from <url|file>  another Design, or a saved list (the tests)
//
// Then: node scripts/build-glyphs.js, node scripts/build-navbar-icons.js, node scripts/sibling-revs.js, a CHANGELOG line,
// a minor release. A Font Awesome name for the new glyph, if any, is added to FA by hand.
const fs = require('fs');
const path = require('path');

// PULL_GLYPHS_FILE: write a copy instead (the tests).
const FILE = process.env.PULL_GLYPHS_FILE || path.join(__dirname, '..', 'glyphs.js');
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const FROM = (() => { const i = argv.indexOf('--from'); return i >= 0 ? argv[i + 1] : 'https://openvibe.design'; })();

const SHAPES = { path: ['d'], circle: ['cx', 'cy', 'r'], ellipse: ['cx', 'cy', 'rx', 'ry'], rect: ['x', 'y', 'width', 'height', 'rx', 'ry'], line: ['x1', 'y1', 'x2', 'y2'], polyline: ['points'] };
const NUM = /^-?\d*\.?\d+$/;
const PATH_D = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/;

/**
 * A drawing as this file stores it, or null: shapes only, the known attributes with numbers (a path's d is commands
 * and numbers), and for a solid also fill-rule="evenodd" on a path and class="ln". At most 8 shapes, on the grid.
 */
function check(markup, solid) {
    let rest = String(markup || '').trim();
    if (!rest || rest.length > 3000) return null;
    const out = [];
    const tag = /^<\s*(\w+)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*\/>\s*/;
    while (rest.length) {
        const m = tag.exec(rest);
        if (!m || !SHAPES[m[1]]) return null;
        const attrs = {};
        for (const a of m[2].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[a[1]] = a[2];
        for (const [k, v] of Object.entries(attrs)) {
            if (SHAPES[m[1]].includes(k)) {
                if (k === 'd' ? !PATH_D.test(v) || !/^[Mm]/.test(v) : k === 'points' ? !/^[\d.,\s-]+$/.test(v) : !NUM.test(v)) return null;
            } else if (solid && k === 'fill-rule' && m[1] === 'path' && v === 'evenodd') {
                // a hole
            } else if (solid && k === 'class' && v === 'ln') {
                // a part that stays a line
            } else if (!solid && k === 'stroke-width' && NUM.test(v) && +v >= 1 && +v <= 4) {
                // a heavier dot
            } else return null;
        }
        if ((String(m[2]).match(/-?\d*\.?\d+/g) || []).map(Number).some((n) => n < -25 || n > 50)) return null;
        out.push(m[0].trim());
        if (out.length > 8) return null;
        rest = rest.slice(m[0].length);
    }
    return out.join('');
}

async function drafts() {
    if (/^https?:\/\//.test(FROM)) {
        const r = await fetch(`${FROM.replace(/\/+$/, '')}/api/v1/glyphs/drafts?status=approved`, { headers: { accept: 'application/json' } });
        if (!r.ok) throw new Error(`${FROM} answered ${r.status}`);
        return (await r.json()).drafts || [];
    }
    return JSON.parse(fs.readFileSync(FROM, 'utf8')).drafts || [];
}

(async () => {
    const glyphs = require('../glyphs');
    const have = new Set(Array.isArray(glyphs.NAMES) ? glyphs.NAMES : Object.keys(glyphs.NAMES));
    const list = await drafts();
    const add = [];
    const seen = new Set();
    for (const d of list) {
        const name = String(d.name || '');
        if (!/^[a-z][a-z0-9-]{1,31}$/.test(name)) { console.log(`skip ${JSON.stringify(name)}: not a glyph name`); continue; }
        if (have.has(name) || seen.has(name)) { console.log(`skip ${name}: the set has it (or an earlier draft took the name)`); continue; }
        const line = check(d.svg, false);
        if (!line) { console.log(`skip ${name} (${d.id}): its drawing fails the checks`); continue; }
        const solid = d.solid_svg ? check(d.solid_svg, true) : null;
        if (d.solid_svg && !solid) console.log(`note ${name}: its solid twin fails the checks; the line drawing is taken alone`);
        seen.add(name);
        add.push({ name, id: d.id, line, solid, sentence: String(d.sentence || '').replace(/\s+/g, ' ').slice(0, 120) });
    }
    if (!add.length) { console.log(`nothing to add (${list.length} approved draft${list.length === 1 ? '' : 's'})`); return; }
    for (const a of add) console.log(`${APPLY ? 'add' : 'would add'} ${a.name}${a.solid ? ' (and its solid)' : ''}: ${a.sentence || 'no sentence'}`);
    if (!APPLY) { console.log('\nrun with --apply to write glyphs.js'); return; }

    let src = fs.readFileSync(FILE, 'utf8');
    const key = (n) => (/^[a-z]+$/.test(n) ? n : `'${n}'`);
    const day = new Date().toISOString().slice(0, 10);
    const lines = add.map((a) => `        // ${day}: drafted on openvibe.design (${a.id}) and approved${a.sentence ? `: ${a.sentence.replace(/\*\//g, '')}` : ''}.\n        ${key(a.name)}: '${a.line}',`).join('\n');
    const drawnEnd = src.indexOf('\n    };\n', src.indexOf('    const DRAWN = {'));
    if (drawnEnd < 0) throw new Error('glyphs.js: the end of DRAWN was not found');
    src = `${src.slice(0, drawnEnd)}\n${lines}${src.slice(drawnEnd)}`;
    const solids = add.filter((a) => a.solid).map((a) => `        ${key(a.name)}: '${a.solid}',`).join('\n');
    if (solids) {
        const solidEnd = src.indexOf('\n    });\n', src.indexOf('    const SOLID = Object.freeze({'));
        if (solidEnd < 0) throw new Error('glyphs.js: the end of SOLID was not found');
        src = `${src.slice(0, solidEnd)}\n        // ${day}: the solid twins of the drafts taken above.\n${solids}${src.slice(solidEnd)}`;
    }
    fs.writeFileSync(FILE, src);
    console.log('\nglyphs.js written. Now: node scripts/build-glyphs.js && node scripts/build-navbar-icons.js && node scripts/sibling-revs.js');
})().catch((err) => { console.error(`pull-glyph-drafts: ${err.message}`); process.exit(1); });
