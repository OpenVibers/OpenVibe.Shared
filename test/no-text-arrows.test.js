'use strict';
// No text arrows in anything a person sees (the owner, 11-13: "get rid of every single instance of this right or left
// arrow, any ASCII arrow, and use our actual OpenVibe.design icons"): an arrow is a glyph from the registry
// (glyphs.js: arrow-right, open, back, chevron, arrow-up, arrow-down, reply, sort), never →, ↗, ‹, ›, ↑, ↓, ↩, », «.
// Every string and template in the library's modules is read with a real tokenizer, so comments may still use them.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT = path.join(__dirname, '..');
// Arrows (U+2190–21FF), dingbat arrows, the heavy ones, the single and double angle quotes, the heavy angle brackets.
const ARROWS = /[←-⇿➔➘-➿⬅-⬇⮕‹›«»❮❯]/u;
// Tools that print to a terminal, never to a page.
const SKIP = new Set(['browser-harness.js', 'test-runner.js']);

const files = fs.readdirSync(ROOT).filter((n) => n.endsWith('.js') && !n.endsWith('.min.js') && !SKIP.has(n));
assert.ok(files.length > 50, `the library's modules are read (${files.length})`);
const hits = [];
for (const n of files) {
    const src = fs.readFileSync(path.join(ROOT, n), 'utf8');
    let tokens = null;
    for (const sourceType of ['script', 'module']) {
        try { tokens = [...acorn.tokenizer(src, { ecmaVersion: 'latest', sourceType, allowHashBang: true, locations: true })]; break; } catch { tokens = null; }
    }
    assert.ok(tokens, `${n} could be read`);
    for (const t of tokens) {
        if ((t.type.label === 'string' || t.type.label === 'template') && ARROWS.test(String(t.value))) hits.push(`${n}:${t.loc.start.line}: ${String(t.value).slice(0, 80)}`);
    }
}
assert.deepStrictEqual(hits, [], `text arrows in what people see: use a glyph instead\n${hits.join('\n')}`);
console.log(`no-text-arrows: ${files.length} modules, no text arrows in their strings ok`);
