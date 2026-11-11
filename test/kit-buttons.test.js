'use strict';
// 4.204.0, buttons that show what they do and what is happening (docs/kit.md#buttons-42040): the builder's options,
// the sheet's rules (every motion scaled by --ov-move), and busy() on a fake button.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const kit = require('../kit.js');

const hero = kit.button({ label: 'Go live', icon: 'live', kind: 'hero', nudge: 'forward', iconEnd: 'chevron', attention: true, badge: 120 });
assert.match(hero, /^<button class="ovk-btn ovk-btn--hero" type="submit" data-nudge="forward" data-attention="" data-badge="99\+">/);
assert.ok((hero.match(/<svg/g) || []).length === 2, 'an icon before and one after the words');
assert.match(kit.button({ label: 'Delete', kind: 'danger', hold: 99999, type: 'button' }), /data-hold="4000"/, 'a hold is 4 s at most');
assert.match(kit.button({ label: 'Delete', kind: 'danger', hold: 10, type: 'button' }), /data-hold="400"/, 'and 0.4 s at least');
assert.match(kit.button({ label: 'Following', kind: 'soft', pressed: true, dot: 'live', type: 'button' }), /data-dot="live" aria-pressed="true"/);
assert.ok(!/data-badge/.test(kit.button({ label: 'x', badge: 0 })), 'no badge for nothing');
assert.match(kit.button({ label: '<b>', attrs: { 'data-x': '1' } }), /data-x="1"><span>&lt;b&gt;<\/span>/, 'the words are text and other attributes stay');

const css = fs.readFileSync(path.join(__dirname, '..', 'kit.css'), 'utf8');
for (const k of ['hero', 'soft', 'live']) assert.ok(css.includes(`.ovk-btn--${k} {`), k);
for (const sel of ['[data-attention]', '[data-badge]', '[data-dot="ok"]', '[data-state="busy"]', '[data-state="done"]', '[data-state="error"]', '[data-hold]', '--ovk-progress']) assert.ok(css.includes(sel), sel);
const start = css.indexOf('Buttons that show what they do');
const block = css.slice(start, css.indexOf('@media (hover: none) { .ovk-btn:hover', start));
const moves = block.match(/(translate[XY]?|rotate|scale)\([^;]*\)/g) || [];
assert.ok(moves.length >= 10 && moves.every((m) => /--ov-move/.test(m) || /\((0|0px)\)$/.test(m)), 'every move is scaled by --ov-move: ' + moves.filter((m) => !/--ov-move/.test(m) && !/\((0|0px)\)$/.test(m)).join(' | '));

// busy(): a fake document and button.
global.document = { readyState: 'complete', addEventListener() {}, createElement: () => ({ className: '', innerHTML: '', setAttribute() {}, remove() { this.gone = true; } }) };
const web = require('../kit-web.js');
const btn = { dataset: {}, disabled: false, attrs: {}, kids: [], setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild(c) { this.kids.push(c); } };
(async () => {
    const p = web.busy(btn, Promise.resolve(7));
    assert.strictEqual(btn.dataset.state, 'busy'); assert.strictEqual(btn.attrs['aria-busy'], 'true'); assert.strictEqual(btn.disabled, true);
    assert.strictEqual(await p, 7);
    assert.strictEqual(btn.dataset.state, 'done'); assert.strictEqual(btn.disabled, false); assert.ok(btn.kids[0].gone);
    await assert.rejects(web.busy(btn, () => Promise.reject(new Error('no'))), /no/);
    assert.strictEqual(btn.dataset.state, 'error');
    console.log('kit-buttons: kinds, status, attention, hold and busy');
    process.exit(0);
})();
