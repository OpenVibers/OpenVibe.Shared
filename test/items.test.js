'use strict';
// items.js + items.css (plan T21 "equip everywhere"): names marked with data-ov-subject get the name effect their
// owner wears, from OpenVibe.Inventory's public batch read (100 per request, no credentials, 60 s cache); unknown
// tokens never become classes; an unreachable Inventory leaves names alone; items.css carries Live's 13 effects and
// stops them for reduced motion.
//   node test/items.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');

const A = 'usr_01JZ0000000000000000000AAA';
const B = 'usr_01JZ0000000000000000000BBB';
const C = 'usr_01JZ0000000000000000000CCC';
const DEFS = [
    { id: 'itd_2', kind: 'live.hat', art: { emoji: '👑' }, attributes: { hat_char: '👑', animated: 'pulse' } },
    { id: 'itd_4', kind: 'live.particle', art: { emoji: '✨', token: 'px-sparkle' }, attributes: { chars: '✦✧⋆' } },
];
const subjectOf = (i) => `usr_01JZ${String(i).padStart(22, '0')}`;

(async () => {
    const calls = [];
    let down = false;
    global.fetch = async (url, opts) => {
        calls.push({ url: String(url), opts });
        if (down) throw new Error('offline');
        if (String(url).includes('/api/v1/definitions?')) return { ok: true, json: async () => ({ definitions: DEFS }) };
        const subjects = decodeURIComponent(String(url).split('subjects=')[1] || '').split(',');
        return {
            ok: true,
            json: async () => ({
                equipped: subjects.map((s) => ({
                    subject: s,
                    slots: s === A ? { 'live.name_effect:name_effect': { instance_id: 'inv_1', definition_id: 'itd_1', token: 'name-fx-rainbow' }, 'live.hat:hat': { instance_id: 'inv_2', definition_id: 'itd_2', token: 'hat-crown' } }
                        : s === B ? { 'live.name_effect:name_effect': { instance_id: 'inv_3', definition_id: 'itd_3', token: 'evil" onload="x' } }
                        : s === C ? { 'live.particle:particle': { instance_id: 'inv_4', definition_id: 'itd_4', token: 'px-sparkle' } } : {},
                })),
            }),
        };
    };
    require('../items.js');
    const items = global.OpenVibeItems;
    assert.ok(items && typeof items.decorate === 'function');

    const { document } = parseHTML(`<main><a id="a" data-ov-subject="${A}">Ana</a><span id="b" data-ov-subject="${B}">Bob</span><span id="c" data-ov-subject="nope">C</span><b><span id="p" data-ov-subject="${C}">Cleo</span></b>
        ${Array.from({ length: 150 }, (_, i) => `<span class="many" data-ov-subject="${subjectOf(i)}">p${i}</span>`).join('')}</main>`);

    assert.strictEqual(await items.decorate(document), 153, 'every valid subject, the invalid one skipped');
    const sets = calls.filter((c) => c.url.includes('/equipped?'));
    assert.strictEqual(sets.length, 2, '153 people in two requests (100 + 53)');
    assert.strictEqual(calls.filter((c) => c.url.includes('/definitions?')).length, 1, 'definitions once, because someone wears a hat or particles');
    assert.ok(calls.every((c) => c.url.startsWith('https://inventory.openvibe.network/api/v1/') && c.opts.credentials === 'omit'));
    assert.deepStrictEqual([...document.getElementById('a').classList].sort(), ['name-fx-rainbow', 'ov-fx'], 'Ana wears her rainbow');
    const hat = document.getElementById('a').previousElementSibling;
    assert.ok(hat && hat.className === 'ov-hat ov-hat-pulse' && hat.textContent === '👑' && hat.getAttribute('aria-hidden') === 'true', 'and her crown sits just before her name');
    const cleo = document.getElementById('p');
    assert.deepStrictEqual([...cleo.classList].sort(), ['ov-px', 'px-sparkle'], 'Cleo wears particles');
    assert.strictEqual(cleo.dataset.ovPxChars, '✦✧⋆');
    items.burst(cleo);
    assert.strictEqual(cleo.querySelectorAll('.ov-px-p').length, 6, 'a burst: six characters');
    assert.ok([...cleo.querySelectorAll('.ov-px-p')].every((p) => '✦✧⋆'.includes(p.textContent)));
    items.burst(cleo);
    assert.strictEqual(cleo.querySelectorAll('.ov-px-p').length, 6, 'one burst at a time');
    assert.deepStrictEqual([...document.getElementById('b').classList], [], 'a token of the wrong shape never becomes a class');
    assert.deepStrictEqual([...document.getElementById('c').classList], []);

    // Decorating again reads nothing: the elements are done, and the sets are cached.
    assert.strictEqual(await items.decorate(document), 0);
    const more = document.createElement('span');
    more.setAttribute('data-ov-subject', A);
    document.querySelector('main').appendChild(more);
    assert.strictEqual(await items.decorate(document), 1);
    assert.strictEqual(calls.length, 3, 'a new name of a known person is drawn from the cache');
    assert.ok(more.classList.contains('name-fx-rainbow'));

    // apply() replaces an earlier effect.
    items.apply(more, { 'live.name_effect:name_effect': { token: 'name-fx-fire' } });
    assert.deepStrictEqual([...more.classList].sort(), ['name-fx-fire', 'ov-fx']);
    assert.ok(!(more.previousElementSibling && more.previousElementSibling.classList.contains('ov-hat')), 'the earlier hat is gone');
    items.apply(more, {});
    assert.deepStrictEqual([...more.classList], []);

    // Inventory unreachable: names stay as they are, nothing throws.
    down = true;
    const { document: d2 } = parseHTML(`<p><span id="x" data-ov-subject="${subjectOf(999)}">X</span></p>`);
    assert.strictEqual(await items.decorate(d2), 1);
    assert.deepStrictEqual([...d2.getElementById('x').classList], []);

    // The stylesheet: Live's 13 name effects, an inline-block wrapper, and reduced motion.
    const css = fs.readFileSync(path.join(__dirname, '..', 'items.css'), 'utf8');
    const fx = [...css.matchAll(/^\.(name-fx-[a-z]+) \{/gm)].map((m) => m[1]);
    assert.strictEqual(fx.length, 13, `13 name effects (${fx.join(', ')})`);
    assert.ok(fx.includes('name-fx-rainbow') && fx.includes('name-fx-divine'));
    assert.match(css, /\.ov-fx \{ display: inline-block; \}/);
    assert.match(css, /prefers-reduced-motion: reduce[\s\S]*animation: none !important/);
    assert.match(css, /\.ov-hat-pulse \{ animation: ovHatPulse/);
    assert.match(css, /\.px-sparkle \.ov-px-p \{ color: #ffd700; \}/);
    assert.match(css, /prefers-reduced-motion: reduce[\s\S]*\.ov-px-p \{ display: none; \}/);
    console.log('items: all checks passed');
})().catch((err) => { console.error(err); process.exit(1); });
