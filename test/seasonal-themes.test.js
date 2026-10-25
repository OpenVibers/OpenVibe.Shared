'use strict';
// Seasonal themes (builtin-themes.js `season`, theme-loader.js Seasons): during a season its theme stands in for the
// default theme for anyone on the default who has not turned seasonal themes off; a theme someone picked stays theirs;
// the `seasonal` display preference switches it, at once and in every tab; picking the default theme during a season
// turns seasonal themes off. theme-loader.js runs here in a small fake browser on fixed dates.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { BUILTIN_THEMES, SEASONS, seasonOn } = require('../builtin-themes');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'theme-loader.js'), 'utf8');
const by = Object.fromEntries(BUILTIN_THEMES.map((t) => [t.id, t]));

/** A page load on `day` (YYYY-MM-DD, local) with `store` as localStorage and `cookie`. → { L, html, events, puts } */
function load(day, store = new Map(), cookie = '', opts = {}) {
    const [y, m, d] = day.split('-').map(Number);
    const fixed = new Date(y, m - 1, d, 12).getTime();
    class FixedDate extends Date { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } }
    const attrs = new Map(); const props = new Map(); const events = []; const puts = []; const gets = []; const timers = []; const docListeners = {};
    const html = {
        style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) },
        setAttribute: (k, v) => attrs.set(k, String(v)), getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null), removeAttribute: (k) => attrs.delete(k),
        attrs, props,
    };
    const listeners = {};
    const sandbox = {
        Date: FixedDate, JSON, Object, String, Number, Math, Array, Promise, Error,
        document: { documentElement: html, readyState: 'complete', cookie, head: null, querySelector: () => null, getElementById: () => null, referrer: opts.referrer || '', visibilityState: 'visible',
            addEventListener: (type, fn) => { (docListeners[type] = docListeners[type] || []).push(fn); } },
        URL, setTimeout: (fn, ms) => timers.push({ fn, ms }), clearTimeout() {},
        localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
        location: { hostname: 'openvibe.live', protocol: 'https:' },
        getComputedStyle: () => ({ getPropertyValue: () => '' }),
        fetch: (url, o) => {
            if (o && o.method === 'PUT') { puts.push({ url, body: JSON.parse(o.body), keepalive: o.keepalive }); return Promise.resolve({ ok: false, json: () => Promise.resolve(null) }); }
            gets.push(url);
            return Promise.resolve(opts.active ? { ok: true, json: () => Promise.resolve(opts.active) } : { ok: false, json: () => Promise.resolve(null) });
        },
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
        addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
        dispatchEvent: (e) => { events.push(e); },
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(SRC, sandbox);
    return { L: sandbox.OpenVibeThemeLoader, html, events, puts, gets, timers, store, fire: (type, e) => (listeners[type] || []).forEach((fn) => fn(e)), fireDoc: (type) => (docListeners[type] || []).forEach((fn) => fn()) };
}
const accent = (p) => p.html.props.get('--accent');

// The catalog: two seasons, each a complete theme, found by date (both ends included).
assert.deepStrictEqual(SEASONS.map((s) => [s.id, s.theme]), [['halloween', 'halloween'], ['winter', 'frost']]);
assert.strictEqual(seasonOn(new Date(2026, 9, 1)).id, 'halloween');
assert.strictEqual(seasonOn(new Date(2026, 9, 31)).id, 'halloween');
assert.strictEqual(seasonOn(new Date(2026, 10, 1)), null);
assert.strictEqual(seasonOn(new Date(2026, 11, 24)).id, 'winter');
assert.ok(by.halloween.tags.includes('seasonal') && by.frost.tags.includes('seasonal'));

// 1. October, nothing chosen: Pumpkin Night shows; the person's theme is still the default.
let p = load('2026-10-24');
assert.strictEqual(accent(p), by.halloween.variables['--accent']);
assert.strictEqual(p.html.getAttribute('data-ov-season'), 'halloween');
assert.strictEqual(p.html.getAttribute('data-theme'), 'halloween');
assert.strictEqual(p.L.getCurrent(), 'vibe', 'the saved choice stays the default');
assert.strictEqual(p.L.seasons.showing().id, 'halloween');
assert.strictEqual(p.L.display.get().seasonal, 'on', 'seasonal themes are on unless turned off');

// 2. A theme someone picked stays theirs; a custom take on the default too.
const picked = new Map([['ov_theme', JSON.stringify({ id: 'nord', variables: by.nord.variables })]]);
p = load('2026-10-24', picked);
assert.strictEqual(accent(p), by.nord.variables['--accent']);
assert.strictEqual(p.html.getAttribute('data-ov-season'), null);
p = load('2026-10-24', new Map([['ov_theme', JSON.stringify({ id: 'vibe', variables: { ...by.vibe.variables, '--accent': '#ff00aa' }, custom: true })]]));
assert.strictEqual(accent(p), '#ff00aa', 'a customised default is a choice');

// 3. Turning seasonal themes off repaints at once to the normal default, saves it to the account (signed in), and on
//    again repaints.
p = load('2026-10-24', new Map(), 'ov_sso_hint=account');
p.L.display.set({ seasonal: 'off' });
assert.strictEqual(accent(p), by.vibe.variables['--accent']);
assert.strictEqual(p.html.getAttribute('data-ov-season'), null);
assert.ok(p.events.some((e) => e.type === 'ov:season' && e.detail === null), 'ov:season says it went');
assert.ok(p.puts.some((x) => /\/api\/themes\/me\/display$/.test(x.url) && x.body.seasonal === 'off'), 'the choice follows the account');
p.L.display.set({ seasonal: 'on' });
assert.strictEqual(accent(p), by.halloween.variables['--accent']);
// Remembered on the next page load, on any site (here: the same storage).
const off = new Map(); load('2026-10-24', off).L.display.set({ seasonal: 'off' });
assert.strictEqual(accent(load('2026-10-24', off)), by.vibe.variables['--accent']);

// 4. Another tab turning it off repaints this one.
const shared = new Map();
p = load('2026-10-24', shared);
shared.set('ov_display', JSON.stringify({ motion: 'auto', text: '100', seasonal: 'off' }));
p.fire('storage', { key: 'ov_display' });
assert.strictEqual(accent(p), by.vibe.variables['--accent']);

// 5. Picking the default theme during a season means "my normal theme": seasonal themes go off.
p = load('2026-10-24');
p.L.save('vibe', null, { sync: false });
assert.strictEqual(p.L.display.get().seasonal, 'off');
assert.strictEqual(accent(p), by.vibe.variables['--accent']);
// Picking the season's own theme keeps it all year.
p = load('2026-11-20');
p.L.save('halloween', null, { sync: false });
assert.strictEqual(accent(load('2026-11-21', p.store)), by.halloween.variables['--accent']);

// 6. Out of season the default is the default; December brings Frost.
assert.strictEqual(accent(load('2026-11-05')), by.vibe.variables['--accent']);
p = load('2026-12-10');
assert.strictEqual(accent(p), by.frost.variables['--accent']);
assert.strictEqual(p.html.getAttribute('data-ov-season'), 'winter');

// 7. The mark wears the season for anyone who has not turned seasonal themes off, whatever their theme.
assert.strictEqual(load('2026-10-24').html.getAttribute('data-ov-season-mark'), 'halloween');
p = load('2026-10-24', new Map([['ov_theme', JSON.stringify({ id: 'nord', variables: by.nord.variables })]]));
assert.deepStrictEqual([p.html.getAttribute('data-ov-season'), p.html.getAttribute('data-ov-season-mark')], [null, 'halloween'], 'a picked theme keeps its colours; the mark still wears October');
p = load('2026-10-24');
p.L.display.set({ seasonal: 'off' });
assert.strictEqual(p.html.getAttribute('data-ov-season-mark'), null, 'seasonal off: no seasonal mark either');
assert.strictEqual(load('2026-11-05').html.getAttribute('data-ov-season-mark'), null);
assert.strictEqual(load('2026-12-10').html.getAttribute('data-ov-season-mark'), 'winter');

// 8. Saves outlive the page (a choice made just before following a link to another site still lands).
p = load('2026-10-24', new Map(), 'ov_sso_hint=account');
p.L.display.set({ seasonal: 'off' });
p.L.save('nord');
assert.ok(p.puts.length === 2 && p.puts.every((x) => x.keepalive === true), 'both saves are keepalive');

// 9. The account is asked again when the page comes back into view (not more than every 10 s), and once more 2.5 s after
//    arriving from another site; its answer corrects the theme.
p = load('2026-10-24');
assert.strictEqual(p.gets.filter((u) => /\/api\/themes\/me\/active$/.test(u)).length, 1, 'asked on load');
p.fireDoc('visibilitychange');
assert.strictEqual(p.gets.length, 1, 'not again within 10 s');
assert.ok(!p.timers.some((t) => t.ms === 2500), 'no extra check without a referrer from another site');
p = load('2026-10-24', new Map(), '', { referrer: 'https://openvibe.network/themes', active: { theme_id: 'nord' } });
const again = p.timers.find((t) => t.ms === 2500);
assert.ok(again, 'arriving from openvibe.network: one more check soon');
again.fn();
assert.strictEqual(p.gets.length, 2);
assert.ok(!load('2026-10-24', new Map(), '', { referrer: 'https://openvibe.live/other' }).timers.some((t) => t.ms === 2500), 'from this same site: no extra check');
setImmediate(() => {
    assert.strictEqual(accent(p), by.nord.variables['--accent'], "the account's theme replaces the stale copy");
    console.log('seasonal-themes: all checks passed');
});
