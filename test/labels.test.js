'use strict';
// Content labels (L1): kit.labels says what a thing carries; ov-labels.js applies each viewer's own choice from
// Network (show, blur until tapped, hide). Signed out, everything shows; a poster always sees their own.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');
const kit = require('../kit.js');

// ── kit.labels ─────────────────────────────────────────────────────────────────────────────────────────────────
assert.strictEqual(kit.labels([]), '', 'no labels, no list');
assert.strictEqual(kit.labels({ labels: [], suggested: ['nudity'] }), '', 'a suggestion is the creator\'s to confirm: never shown');
const chips = kit.labels(['language', '18+', 'language', 'made-up']);
assert.ok(chips.startsWith('<ul class="ovk-labels" aria-label="Content labels">'), chips);
assert.ok(chips.includes('<li class="ovk-label" data-label="language">Strong language</li>'), 'named in words');
assert.ok(chips.includes('<li class="ovk-label ovk-label--adult" data-label="18+">18+</li>'), '18+ in the warning colour');
assert.strictEqual((chips.match(/<li/g) || []).length, 2, 'no repeats, nothing outside the set');
assert.strictEqual(kit.labelsAttr({ labels: ['nudity', 'graphic'] }), ' data-ov-labels="nudity,graphic"');
assert.strictEqual(kit.labelsAttr(null), '');

// ── ov-labels.js ───────────────────────────────────────────────────────────────────────────────────────────────
const SRC = fs.readFileSync(path.join(__dirname, '..', 'ov-labels.js'), 'utf8');
const PAGE = `<div id="a" data-ov-labels="nudity"><img data-ov-labels-media src="a.jpg"><h3>A</h3></div>
<div id="b" data-ov-labels="18+"><img src="b.jpg"></div>
<div id="c" data-ov-labels="language"><img src="c.jpg"></div>
<div id="d" data-ov-labels="18+" data-ov-labels-owner="usr_me"><img src="d.jpg"></div>
<div id="e"><img src="e.jpg"></div>`;

async function page({ session, prefs }) {
    // linkedom's window falls back to the process's globals: each page starts without the last one's module.
    delete globalThis.OVLabels;
    const { window, document, MutationObserver } = parseHTML(`<!doctype html><html><head></head><body>${PAGE}</body></html>`);
    delete window.OVLabels;
    const store = new Map();
    const sessionStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
    const calls = [];
    const fetch = async (url, opts) => { calls.push({ url, auth: opts && opts.headers && opts.headers.Authorization }); return { ok: true, json: async () => ({ prefs }) }; };
    window.OpenVibeNavbar = { session };
    window.getComputedStyle = () => ({ position: 'static' });
    new Function('window', 'document', 'fetch', 'sessionStorage', 'MutationObserver', 'setTimeout', 'getComputedStyle', SRC)(
        window, document, fetch, sessionStorage, MutationObserver, setTimeout, window.getComputedStyle);
    await new Promise((r) => setTimeout(r, 300));
    return { window, document, calls };
}

(async () => {
    // Signed out: nothing is asked and everything shows (the web default).
    {
        const { document, calls } = await page({ session: { token: null, user: null } });
        assert.strictEqual(calls.length, 0, 'no token, no request');
        for (const id of ['a', 'b', 'c', 'd']) assert.strictEqual(document.getElementById(id).getAttribute('data-ov-labels-state'), 'show', `${id} shows`);
        assert.ok(!document.querySelector('.ov-labels-gate'), 'no cover');
    }
    // Signed in: nudity blurred, 18+ hidden, language shown; their own 18+ post shows to them.
    {
        const prefs = { nudity: 'blur', language: 'show', graphic: 'show', '18+': 'hide', flashing: 'show', spoilers: 'show' };
        const { document, calls } = await page({ session: { token: 'tok', user: { subject_id: 'usr_me' }, apiBase: 'https://openvibe.network' }, prefs });
        assert.strictEqual(calls.length, 1, 'the choices are asked once');
        assert.strictEqual(calls[0].url, 'https://openvibe.network/api/v1/me/label-prefs');
        assert.strictEqual(calls[0].auth, 'Bearer tok');
        const a = document.getElementById('a');
        assert.strictEqual(a.getAttribute('data-ov-labels-state'), 'blur');
        const media = a.querySelector('[data-ov-labels-media]');
        assert.ok(media.classList.contains('ov-labels-cover'), 'the marked media is covered, not the whole card');
        const gate = media.querySelector('.ov-labels-gate');
        assert.ok(gate && gate.textContent.includes('Nudity') && gate.textContent.includes('Show'), 'the cover names the label and offers Show');
        assert.strictEqual(document.getElementById('b').getAttribute('data-ov-labels-state'), 'hide', '18+ hidden');
        assert.strictEqual(document.getElementById('c').getAttribute('data-ov-labels-state'), 'show', 'language shown');
        assert.strictEqual(document.getElementById('d').getAttribute('data-ov-labels-state'), 'show', 'the poster sees their own');
        assert.ok(!document.getElementById('e').hasAttribute('data-ov-labels-state'), 'an unlabelled thing is untouched');
        // Show: uncovered, and it stays uncovered when the page applies again.
        gate.dispatchEvent(new (document.defaultView || globalThis).Event('click', { bubbles: true, cancelable: true }));
        assert.strictEqual(a.getAttribute('data-ov-labels-state'), 'shown');
        assert.ok(!media.classList.contains('ov-labels-cover') && !media.querySelector('.ov-labels-gate'), 'revealed');
    }
    console.log('labels: all passed');
})().catch((e) => { console.error(e); process.exit(1); });
