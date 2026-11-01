'use strict';
/**
 * scripts/pull-glyph-drafts.js (plan L50): approved drafts from openvibe.design become line drawings in DRAWN and, with
 * a solid twin, SOLID entries; a name the set has, a drawing that fails the checks (a script, a style, a colour) and
 * a second draft for the same name are left out; without --apply nothing is written. The run here reads a saved list
 * and writes a copy of glyphs.js (PULL_GLYPHS_FILE).
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pull-drafts-'));
const list = path.join(dir, 'drafts.json');
const copy = path.join(dir, 'glyphs.js');
const original = fs.readFileSync(path.join(__dirname, '..', 'glyphs.js'), 'utf8');
fs.writeFileSync(copy, original);
fs.writeFileSync(list, JSON.stringify({ drafts: [
    { id: 'gd_1', name: 'sauna', sentence: 'A tub with steam over it', svg: '<path d="M4 12h16v6H4Z"/><path d="M9 4c0 2 2 2 2 4"/>', solid_svg: '<path d="M3.5 11.5h17v7h-17Z"/><path class="ln" d="M9 4c0 2 2 2 2 4"/>' },
    { id: 'gd_2', name: 'kite', sentence: 'A kite', svg: '<path d="M12 3l6 8-6 10-6-10Z"/>', solid_svg: '<path d="M12 3l6 8-6 10-6-10Z" style="fill:red"/>' },
    { id: 'gd_3', name: 'bell', sentence: 'Already in the set', svg: '<path d="M4 4h16"/>' },
    { id: 'gd_4', name: 'evil', sentence: 'A script', svg: '<script>alert(1)</script>' },
    { id: 'gd_5', name: 'kite', sentence: 'A second kite', svg: '<path d="M4 4h16"/>' },
] }));

const run = (...args) => execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'pull-glyph-drafts.js'), '--from', list, ...args], { encoding: 'utf8', env: { ...process.env, PULL_GLYPHS_FILE: copy } });
try {
    const dry = run();
    assert.match(dry, /would add sauna \(and its solid\): A tub with steam over it/);
    assert.match(dry, /would add kite: A kite/);
    assert.match(dry, /note kite: its solid twin fails the checks/);
    assert.match(dry, /skip bell: the set has it/);
    assert.match(dry, /skip evil \(gd_4\): its drawing fails the checks/);
    assert.match(dry, /skip kite: the set has it \(or an earlier draft took the name\)/);
    assert.strictEqual(fs.readFileSync(copy, 'utf8'), original, 'a dry run writes nothing');

    run('--apply');
    const out = fs.readFileSync(copy, 'utf8');
    const drawn = out.slice(out.indexOf('    const DRAWN = {'), out.indexOf('    const SOLID = Object.freeze({'));
    const solid = out.slice(out.indexOf('    const SOLID = Object.freeze({'), out.indexOf('const BY = '));
    assert.ok(drawn.includes(`sauna: '<path d="M4 12h16v6H4Z"/><path d="M9 4c0 2 2 2 2 4"/>',`), 'the line drawing is in DRAWN');
    assert.ok(drawn.includes(`kite: '<path d="M12 3l6 8-6 10-6-10Z"/>',`));
    assert.ok(drawn.includes('drafted on openvibe.design (gd_1) and approved: A tub with steam over it.'), 'with where it came from');
    assert.ok(solid.includes(`sauna: '<path d="M3.5 11.5h17v7h-17Z"/><path class="ln" d="M9 4c0 2 2 2 2 4"/>',`), 'its solid twin is in SOLID');
    assert.ok(!out.includes('fill:red') && !out.includes('<script'), 'nothing that failed is written');
    execFileSync(process.execPath, ['--check', copy]);
    console.log('pull-glyph-drafts: adds what passes, where it belongs, and nothing else');
} finally {
    fs.rmSync(dir, { recursive: true, force: true });
}
