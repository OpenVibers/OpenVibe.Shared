'use strict';
// The look before first paint (4.64.0, plan L42): look-boot's inline script paints what this browser last painted here
// (ov_paint) or what a link from another OpenVibe page carried (?ov_look=), colours only, and leaves an ended season
// to the loader. The Look panel (ov-look.js) offers only themes the loader has, and the navbar opens it in place.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { BOOT, tag, KEYS } = require('../look-boot');

const ROOT = path.join(__dirname, '..');
const NOW = new Date(2026, 10, 5, 12).getTime();

function boot({ store = {}, search = '', referrer = '' } = {}) {
    const attrs = {}; const props = {}; const style = { setProperty: (k, v) => { props[k] = v; } };
    const html = { style, setAttribute: (k, v) => { attrs[k] = String(v); } };
    const sandbox = {
        document: { documentElement: html, referrer },
        location: { search },
        localStorage: { getItem: (k) => (k in store ? store[k] : null) },
        atob: (s) => Buffer.from(s, 'base64').toString('binary'),
        URL, JSON, Date: { now: () => NOW }, String,
    };
    vm.runInNewContext(BOOT, sandbox);
    return { attrs, props, style };
}
const paint = (k, a = {}, extra = {}) => JSON.stringify({ k, a, ts: '', at: NOW - 1000, ...extra });
const nord = ['#2e3440', '#3b4252', '#434c5e', '#4c566a', '#3b4252', '#2e3440', '#eceff4', '#d8dee9', '#a3acbd', '#88c0d0', '#8fbcbb', '#5e81ac'];
const token = (p) => Buffer.from(JSON.stringify({ v: 1, d: {}, da: 0, t: 'nord', ta: NOW, p }), 'binary').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// ── The order is theme-loader's own ──
const loader = fs.readFileSync(path.join(ROOT, 'theme-loader.js'), 'utf8');
assert.ok(KEYS.length > 20 && KEYS[0] === '--bg-primary', 'the token order comes from theme-loader.js');
assert.ok(loader.includes(`const THEME_KEYS = ${JSON.stringify(KEYS).replace(/"/g, "'").replace(/,/g, ', ')}`) || KEYS.every((k) => loader.includes(`'${k}'`)), 'every key is the loader\'s');
assert.ok(BOOT.length < 2200, `small enough to inline (${BOOT.length} chars)`);

// ── Paints what this browser last painted here ──
let r = boot({ store: { ov_paint: paint(nord, { 'data-theme': 'nord', 'data-theme-mode': 'dark', 'data-ov-motion': 'reduced' }) } });
assert.strictEqual(r.props['--bg-primary'], '#2e3440');
assert.strictEqual(r.props[KEYS[9]], '#88c0d0');
assert.strictEqual(r.attrs['data-theme'], 'nord');
assert.strictEqual(r.attrs['data-ov-motion'], 'reduced', 'Calm before first paint');
assert.strictEqual(r.style.background, '#2e3440', 'the page background, so nothing flashes');
assert.strictEqual(r.style.colorScheme, 'dark');

// ── Nothing kept: nothing painted, nothing thrown ──
r = boot();
assert.deepStrictEqual([Object.keys(r.props).length, Object.keys(r.attrs).length], [0, 0]);
r = boot({ store: { ov_paint: '{not json' } });
assert.strictEqual(Object.keys(r.props).length, 0, 'a broken record is ignored');

// ── A season whose dates are over is left for the loader ──
r = boot({ store: { ov_paint: paint(nord, { 'data-ov-season': 'halloween' }, { u: NOW - 1 }) } });
assert.strictEqual(Object.keys(r.props).length, 0);
r = boot({ store: { ov_paint: paint(nord, { 'data-ov-season': 'halloween' }, { u: NOW + 86400000 }) } });
assert.strictEqual(r.attrs['data-ov-season'], 'halloween', 'a running season paints');

// ── Only colours and known attributes pass ──
const bad = nord.slice(); bad[0] = 'url(https://evil.example/x.png)'; bad[6] = 'expression(alert(1))';
r = boot({ store: { ov_paint: paint(bad, { 'data-theme': 'x"><script>', onload: 'alert(1)', 'data-ov-text': 'lg' }) } });
assert.ok(!('--bg-primary' in r.props) && !r.style.background && !r.style.color, 'url() and expression() never reach the page');
assert.strictEqual(r.props['--bg-secondary'], '#3b4252', 'the colours beside them do');
assert.ok(!('data-theme' in r.attrs) && !('onload' in r.attrs), 'odd attributes and odd values are dropped');
assert.strictEqual(r.attrs['data-ov-text'], 'lg');

// ── A link from another OpenVibe page wins; from anywhere else it is ignored ──
const arriving = token({ k: ['#101010'].concat(nord.slice(1)), a: { 'data-theme': 'midnight' } });
r = boot({ store: { ov_paint: paint(nord, { 'data-theme': 'nord' }) }, search: `?tab=x&ov_look=${arriving}`, referrer: 'https://openvibe.network/themes' });
assert.deepStrictEqual([r.props['--bg-primary'], r.attrs['data-theme']], ['#101010', 'midnight'], 'the carried look paints first');
r = boot({ store: { ov_paint: paint(nord, { 'data-theme': 'nord' }) }, search: `?ov_look=${arriving}`, referrer: 'https://evil.example/' });
assert.deepStrictEqual([r.props['--bg-primary'], r.attrs['data-theme']], ['#2e3440', 'nord'], 'a link from elsewhere cannot set the look');
r = boot({ store: {}, search: `?ov_look=${arriving}`, referrer: 'https://openvibe.network.evil.example/' });
assert.strictEqual(Object.keys(r.props).length, 0, 'a look-alike host is elsewhere');

// ── The tag ──
assert.ok(tag().startsWith('<script>(function(){') && tag().endsWith('</script>'));
assert.ok(tag({ nonce: 'abc123' }).startsWith('<script nonce="abc123">'));
assert.ok(!tag({ nonce: '"><x' }).includes('"><x'), 'a nonce cannot break out of its attribute');

// ── The Look panel offers only real themes, and the navbar opens it in place ──
const sandbox = { window: { location: { href: 'https://openvibe.live/@goosely?tab=clips&ov_look=abc&ov-try=old#chat' } }, URL };
sandbox.window.window = sandbox.window;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'ov-look.js'), 'utf8'), sandbox);
const { PICKS } = sandbox.window.OVLook;
assert.ok(PICKS.length >= 8 && PICKS.every(([id]) => /^[a-z-]+$/.test(id)), 'picks are theme ids');
const loaderTheme = (id) => loader.includes(`\n        '${id}': ['`);
assert.ok(PICKS.every(([id]) => loaderTheme(id)), `every pick is one of theme-loader's themes: ${PICKS.filter(([id]) => !loaderTheme(id)).map(([id]) => id)}`);
assert.ok(!fs.readFileSync(path.join(__dirname, '..', 'ov-look.js'), 'utf8').split('\n').some((l) => !/^\s*(\/\*\*|\*)/.test(l) && /[^\x00-\x7f]/.test(l)), 'its text is ASCII (escapes), so a server without a charset still shows it right');
const nav = fs.readFileSync(path.join(ROOT, 'navbar.js'), 'utf8');
assert.ok(/data-ov-look-open/.test(nav) && nav.includes("siblingV('ov-look.js')"), 'the navbar loads the panel from beside itself');
assert.ok(!nav.includes('openvibe.network/themes"'), 'the menu no longer sends people to another site to change their look');
assert.ok(require('../files').BROWSER.includes('ov-look.js'), 'served');
// Share (4.67.0): this page in that theme, for anyone; the tried theme's own bar offers Use it / Stop.
const shared = new URL(sandbox.window.OVLook.shareLink('nord'));
assert.deepStrictEqual([shared.origin + shared.pathname, shared.searchParams.get('tab'), shared.searchParams.get('ov-try'), shared.searchParams.has('ov_look'), shared.hash], ['https://openvibe.live/@goosely', 'clips', 'nord', false, ''], 'the page, its own query, the theme to try; never a carried look or an anchor');
const lookSrc = fs.readFileSync(path.join(__dirname, '..', 'ov-look.js'), 'utf8');
assert.match(lookSrc, /L\.THEMES\[shareId\] \? \[el\('button'/, 'Share only for a built-in theme (custom colours cannot ride a link)');

console.log(`look boot: paints ov_paint or a carried look before first paint (${BOOT.length} chars), colours only, ended seasons left; the Look panel's ${PICKS.length} picks are real themes`);
