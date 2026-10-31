'use strict';
// navbar.js — brand resolution from the hostname, compact/short form, overrides and the
// modular menu/links API (plain node with the same stubbed globals as navbar-auth.test.js).
const assert = require('assert');
const path = require('path');
const NAVBAR_PATH = path.join(__dirname, '..', 'navbar.js');

function stubElement() {
    const el = {
        style: {}, textContent: '', className: '', id: '', innerHTML: '', dataset: {}, attrs: {}, children: [],
        classList: { add() {}, remove() {}, toggle() {} },
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
        appendChild(c) { this.children.push(c); }, prepend(c) { this.children.unshift(c); }, remove() {}, addEventListener() {},
        querySelector() { return stubElement(); }, querySelectorAll() { return []; },
    };
    return el;
}

function load(hostname, opts = {}) {
    global.location = { hostname, href: `https://${hostname}/`, pathname: opts.pathname || '/', protocol: 'https:' };
    global.window = { location: global.location };
    try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'test' }, configurable: true }); } catch { /* read-only in some runtimes */ }
    const created = [];
    global.document = {
        cookie: opts.cookie || '', head: stubElement(), body: stubElement(), title: 'T',
        getElementById: () => null, createElement: (tag) => { const e = stubElement(); e.tag = tag; created.push(e); return e; },
        addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    };
    global.CustomEvent = class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } };
    const store = {};
    global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    delete require.cache[require.resolve(NAVBAR_PATH)];
    const navbar = require(NAVBAR_PATH);
    return { navbar, created };
}

// ── hostname → segments ──────────────────────────────────────
{
    const { navbar } = load('pastes.openvibe.tools');
    navbar.init({ service: 'paste', user: { id: 1, username: 'x' } });
    const b = navbar.brand();
    assert.strictEqual(b.name, 'Pastes.OpenVibe.Tools');
    assert.strictEqual(b.short, 'Pastes');
    assert.strictEqual(b.tld, 'tools');
    assert.strictEqual(b.variant, 'tools');
}
{
    const { navbar } = load('json.openvibe.tools');
    navbar.init({ service: 'dev' });
    assert.strictEqual(navbar.brand().name, 'JSON.OpenVibe.Tools', 'known acronyms keep their casing');
}
{
    const { navbar } = load('mergepdf.openvibe.tools');
    navbar.init({ service: 'docs' });
    assert.strictEqual(navbar.brand().name, 'MergePDF.OpenVibe.Tools');
}
{
    const { navbar } = load('openvibe.space');
    navbar.init({ service: 'space' });
    assert.strictEqual(navbar.brand().name, 'OpenVibe.Space');
    const { navbar: ai } = load('ai.openvibe.services');
    ai.init({ service: 'ai' });
    assert.strictEqual(ai.brand().name, 'AI.OpenVibe.Services');
    const { navbar: off } = load('localhost');
    off.init({ service: 'space' });
    assert.strictEqual(off.brand().name, 'OpenVibe.Space', 'off the network the space service keeps its brand');
}
{
    const { navbar } = load('openvibe.live');
    navbar.init({ service: 'live' });
    const b = navbar.brand();
    assert.strictEqual(b.name, 'OpenVibe.Live');
    assert.strictEqual(b.short, 'OpenVibe.Live', 'no subdomain: nothing to shorten to');
    assert.strictEqual(b.variant, 'live');
}
{
    const { navbar } = load('www.openvibe.community');
    navbar.init({ service: 'community' });
    assert.strictEqual(navbar.brand().name, 'OpenVibe.Community', 'www is not a subdomain brand');
}
{
    const { navbar } = load('play.openvibe.games');
    navbar.init({ service: 'games' });
    assert.strictEqual(navbar.brand().name, 'Play.OpenVibe.Games');
}
{
    const { navbar } = load('ingest.openre.stream');
    navbar.init({ service: 'live' });
    const b = navbar.brand();
    assert.strictEqual(b.name, 'Ingest.OpenRestream');
    assert.strictEqual(b.variant, 'stream');
}
{
    // openre.stream is OpenRestream: "OpenRe" + "stream" as one word (no dot), both linking to openre.stream.
    const { navbar } = load('openre.stream');
    navbar.init({ service: 'openre' });
    const b = navbar.brand();
    assert.strictEqual(b.name, 'OpenRestream');
    assert.strictEqual(b.short, 'OpenRestream');
    assert.strictEqual(b.core, 'OpenRe');
    assert.strictEqual(b.tldText, 'stream');
    assert.strictEqual(b.variant, 'stream');
}
{
    const { navbar } = load('openvibe.vip');
    navbar.init({ service: 'network' });
    assert.strictEqual(navbar.brand().name, 'OpenVibe.VIP');
}
// ── off-network hosts fall back to the service id ────────────
{
    const { navbar } = load('localhost');
    navbar.init({ service: 'net' });
    assert.strictEqual(navbar.brand().name, 'Net.OpenVibe.Tools');
    const { navbar: n2 } = load('localhost');
    n2.init({ service: 'live' });
    assert.strictEqual(n2.brand().name, 'OpenVibe.Live');
}
// ── overrides ────────────────────────────────────────────────
{
    const { navbar } = load('openvibe.tools');
    navbar.init({ service: 'tools', brandName: 'Paste.OpenVibe' });
    assert.strictEqual(navbar.brand().name, 'Pastes.OpenVibe.Tools', 'legacy brandName steers the subdomain segment (paste → Pastes, the host name)');
    const { navbar: n2 } = load('openvibe.tools');
    n2.init({ service: 'tools', brand: { sub: 'logo', tag: 'beta' } });
    assert.strictEqual(n2.brand().name, 'Logo.OpenVibe.Tools');
    assert.strictEqual(n2.brand().tag, 'beta');
    const { navbar: n3 } = load('openvibe.tools');
    n3.init({ service: 'tools', brand: { name: 'Custom Name', variant: 'games' } });
    assert.strictEqual(n3.brand().name, 'Custom Name');
    assert.strictEqual(n3.brand().variant, 'games');
}
// ── ov-mark.js is loaded once: not when the page already carries its own (async) tag ────
{
    const { navbar, created } = load('openvibe.coupons');
    navbar.init({ service: 'coupons', user: null });
    assert.strictEqual(created.filter((e) => e.tag === 'script' && e.id === 'ov-mark-loader').length, 1, 'no tag on the page: the navbar loads the mark');
    const second = load('openvibe.coupons');
    global.document.querySelector = (sel) => (sel === 'script[src*="/ov-mark.js"]' ? { src: '/shared/ov-mark.js?v=1' } : null);
    second.navbar.init({ service: 'coupons', user: null });
    assert.strictEqual(second.created.filter((e) => e.tag === 'script' && e.id === 'ov-mark-loader').length, 0, 'the page\'s own tag: no second copy');
}
// ── a re-render removes the previous render's document listener (it kept the removed bar alive) ────
{
    const { navbar } = load('openvibe.space');
    const docListeners = [];
    global.document.addEventListener = (type, fn, opts) => docListeners.push({ type, opts });
    navbar.init({ service: 'space', user: { id: 1, username: 'x' } });
    const first = docListeners.filter((l) => l.type === 'click');
    assert.ok(first.length >= 1 && first.every((l) => l.opts && l.opts.signal), 'the outside-click listener carries an abort signal');
    navbar.init({ service: 'space', user: { id: 1, username: 'x' } });
    assert.ok(first.every((l) => l.opts.signal.aborted), 'the next render removed it');
    const latest = docListeners.filter((l) => l.type === 'click').slice(first.length);
    assert.ok(latest.length >= 1 && latest.every((l) => !l.opts.signal.aborted), 'the new render has its own, live');
}
// ── a re-render also ends the previous render's panel registrations and window listeners (the panels coordinator
//    and the display rows' window listener held every old bar: ovhost browser-check, 2026-10-08) ────
{
    const { navbar } = load('openvibe.space');
    const regs = [], winListeners = [];
    // navbar.js's root is globalThis under node (the window in a browser).
    global.OpenVibePanels = { register: (o) => { regs.push(o); } };
    global.OpenVibeThemeLoader = { display: { get: () => ({ text: 100, motion: 'auto' }), set() {}, options: { text: [100], motion: ['auto'] } } };
    global.addEventListener = (type, fn, opts) => winListeners.push({ type, opts });
    navbar.init({ service: 'space', user: { id: 1, username: 'x' } });
    const first = regs.slice(), firstDisplay = winListeners.filter((l) => l.type === 'ov:display');
    assert.deepStrictEqual(first.map((r) => r.id).sort(), ['nav-drawer', 'user-menu'], 'the drawer and the account menu are registered');
    assert.ok(first.every((r) => r.signal && !r.signal.aborted), 'each registration carries the render\'s signal');
    assert.ok(firstDisplay.length === 1 && firstDisplay[0].opts && firstDisplay[0].opts.signal, 'the display rows\' window listener carries it too');
    navbar.init({ service: 'space', user: { id: 1, username: 'x' } });
    assert.ok(first.every((r) => r.signal.aborted) && firstDisplay[0].opts.signal.aborted, 'the next render ended them');
    assert.ok(regs.slice(first.length).every((r) => !r.signal.aborted), 'the new render\'s registrations are live');
    delete global.OpenVibePanels; delete global.OpenVibeThemeLoader; delete global.addEventListener;
}
// ── before panels.js loads, registrations queue; a render that is gone registers nothing when it arrives ────
{
    const { navbar, created } = load('openvibe.space');
    navbar.init({ service: 'space', user: { id: 1, username: 'x' } });
    navbar.init({ service: 'space', user: { id: 1, username: 'x' } });
    const loaders = created.filter((e) => e.tag === 'script' && e.id === 'ov-panels-loader');
    assert.ok(loaders.length >= 1, 'panels.js was requested');
    const regs = [];
    global.OpenVibePanels = { register: (o) => { regs.push(o); } };
    loaders[loaders.length - 1].onload();
    delete global.OpenVibePanels;
    assert.deepStrictEqual(regs.map((r) => r.id).sort(), ['nav-drawer', 'user-menu'], 'only the live render\'s panels are registered');
    assert.ok(regs.every((r) => !r.signal.aborted));
}
// ── balance chips fold into one on a phone (owner, 2026-10-27): the folded chip, its short values, and setChip ──
{
    const { navbar, created } = load('openvibe.live');
    navbar.init({ service: 'live', user: { id: 1, username: 'x' }, chips: [
        { id: 'coins', icon: 'fa-coins', tone: 'gold', value: '160,774', label: 'OpenCoins', onClick() {} },
        { id: 'vibes', icon: 'fa-wallet', tone: 'green', value: '400', title: 'Vibes balance', onClick() {} },
    ] });
    const nav = created.find(e => e.tag === 'nav');
    assert.ok(/class="ovnav-chip ovnav-chip--all" id="openvibe-chips-all"/.test(nav.innerHTML), 'the folded chip');
    assert.ok(/data-chip-mini="coins" data-tone="gold">.*?<span class="ovnav-chip-mv">161k<\/span>/.test(nav.innerHTML), '160,774 reads 161k');
    assert.ok(/data-chip-mini="vibes" data-tone="green">.*?<span class="ovnav-chip-mv">400<\/span>/.test(nav.innerHTML));
    assert.ok(nav.innerHTML.includes('aria-label="Your balances: OpenCoins 160,774, Vibes balance 400"'), 'said in full to a screen reader');
    assert.ok(/@media \(max-width: 560px\) \{\s*\.openvibe-navbar-right\.has-chips-all \.ovnav-chip\[data-chip-id\] \{ display: none; \}/.test(require('fs').readFileSync(NAVBAR_PATH, 'utf8')), 'the chips fold on a phone');
    // One chip: nothing to fold.
    const one = load('openvibe.live');
    one.navbar.init({ service: 'live', user: { id: 1, username: 'x' }, chips: [{ id: 'coins', icon: 'fa-coins', value: '5' }] });
    assert.ok(!/ovnav-chip--all/.test(one.created.find(e => e.tag === 'nav').innerHTML));
}
// ── "Across OpenVibe" in the drawer, and the icon slots that have their size before ov-icons.js arrives ──
{
    const src = require('fs').readFileSync(NAVBAR_PATH, 'utf8');
    assert.ok(src.includes('<span class="ud-label">Across OpenVibe</span>') && src.includes('data-open-launcher>All sites</button>'), 'a header with All sites');
    assert.ok(/class="ovnav-net-grid">\$\{pick\.map\(n => `<a class="ovnav-net" href="\$\{escapeAttr\(n\.url\)\}" title="\$\{escapeAttr\(n\.tagline\)\}"><span class="ov-icon" data-icon=/.test(src), 'each site with its mark');
    assert.ok(src.includes('.ovnav-drawer .ov-icon { display: inline-block; flex: none; width: 24px; height: 24px;'), 'icon slots are sized before they are drawn');
    assert.strictEqual((src.match(/function loadIcons\(/g) || []).length, 1, 'one loadIcons (the nav glyphs); the ov-icons loader has its own name');
    assert.ok(/function queueIcons\(\)[\s\S]*?requestIdleCallback\(go/.test(src), 'ov-icons.js loads when the page settles');
}
// ── rendered markup carries the segments, compact attr and the variant ────
{
    const { navbar, created } = load('pastes.openvibe.tools', { pathname: '/mine' });
    navbar.init({ service: 'paste', user: { id: 1, username: 'x' }, links: [{ label: 'Mine', href: '/mine' }, { label: 'New', href: '/new', icon: 'fa-plus' }], menu: { after: [{ id: 'mp', label: 'My pastes', href: '/my', icon: 'fa-paste' }] }, compact: 'always' });
    const nav = created.find(e => e.tag === 'nav');
    assert.ok(nav, 'nav element created');
    assert.strictEqual(nav.getAttribute('data-compact'), 'always');
    assert.ok(nav.innerHTML.includes('class="b-sub">Pastes<') && nav.innerHTML.includes('class="b-tld">Tools<'), 'segments rendered');
    assert.ok(nav.innerHTML.includes('data-variant="tools"'), 'ov-mark variant');
    assert.ok(/href="\/mine" class="ovnav-link active"/.test(nav.innerHTML), 'current path marked active');
    assert.ok(/class="ovnav-burger"/.test(nav.innerHTML) && /class="ovnav-drawer"/.test(nav.innerHTML), 'links get a mobile drawer');
    assert.ok(/<span class="icon"><svg class="ovnav-ic"/.test(nav.innerHTML), 'link icon rendered inline (no icon font needed)');
    assert.ok(!/fa-solid fa-plus/.test(nav.innerHTML), 'known icons do not depend on Font Awesome');
    const dd = created.find(e => e.tag === 'div' && /openvibe-navbar-dropdown-menu/.test(e.innerHTML));
    assert.ok(dd && dd.innerHTML.includes('data-menu-id="mp"') && dd.innerHTML.includes('My pastes'), 'custom dropdown row rendered');
    assert.ok(dd.innerHTML.includes('/my#history'), 'History link present');
    assert.ok(dd.innerHTML.includes('href="https://openvibe.network/@x"') && !dd.innerHTML.includes('My Profile'), 'the public profile (openvibe.network/@username) is one tap away: the name and picture, not a row that repeats them');
    // The account menu, reviewed (the owner, 2026-10-28: "duplicated things … so many icons sizes that aren't consistent"):
    // no row says what another says, the seasonal switch is on the Themes page, and every icon sits in one box.
    ['Seasonal themes', 'Linked Services', 'Switch account'].forEach((gone) => assert.ok(!dd.innerHTML.includes(gone), `no "${gone}" row`));
    // 4.23.0 (the owner: "a plus button… better use of icons… compactness"): + and the gear beside the name, your places
    // as a grid of icons, and one row at the foot for light/dark, text size, motion and themes; Sign out by the gear.
    assert.ok(/class="ud-hbtn add-account" id="openvibe-add-account"[^>]*aria-label="Add another account"/.test(dd.innerHTML), 'Add another account is a + beside the name');
    assert.ok(dd.innerHTML.includes('aria-label="Account &amp; settings"') && dd.innerHTML.includes('aria-label="Look"') && dd.innerHTML.includes('data-ov-look-open') && /id="openvibe-logout-btn"[^>]*aria-label="Sign out"/.test(dd.innerHTML), 'the gear, Look (4.64.0: opens in place) and Sign out are icon buttons');
    assert.ok(/<div class="ud-grid">/.test(dd.innerHTML) && /class="ud-tile"[^>]*data-menu-id="mp"/.test(dd.innerHTML), 'the places are a grid of tiles, the site\'s own first');
    assert.ok(!dd.innerHTML.includes('Recently used'), 'the places you went are the search menu\'s');
    assert.ok(!dd.innerHTML.includes('Across OpenVibe'), 'the other sites are the launcher\'s and the drawer\'s, not the account menu\'s');
    assert.ok(/\.openvibe-navbar-dropdown-menu \.icon \.ovnav-ic \{ width: 1\.25em !important; height: 1em; \}/.test(require('fs').readFileSync(require('path').join(__dirname, '..', 'navbar.js'), 'utf8')), 'every menu icon in one fixed-width box');
    assert.ok(dd.innerHTML.includes('<a class="name ud-me" href="https://openvibe.network/@x"'), 'pressing your name in the menu opens your profile');
    assert.ok(['light', 'dark', 'auto'].every((m) => dd.innerHTML.includes(`data-ov-scheme="${m}"`)) && dd.innerHTML.includes('aria-label="Light or dark"'), 'Light, Dark and Auto are one press away in the account menu');
    assert.ok(dd.innerHTML.includes('<a class="ud-me" href="https://openvibe.network/@x" tabindex="-1" aria-hidden="true"><img'), 'and so does your picture (one stop for keyboards)');
    const id = navbar.addMenuItem({ label: 'Runtime row', href: '/r', position: 'before' });
    assert.ok(id, 'addMenuItem returns an id');
}
// ── the season lives in the mark (ov-mark.js), not in a badge beside the brand; the switch stays in the account menu ────
{
    const HALLOWEEN = { id: 'halloween', name: 'Halloween', theme: 'halloween' };
    global.OpenVibeThemeLoader = {
        seasons: { now: () => HALLOWEEN, showing: () => HALLOWEEN },
        display: { get: () => ({ text: '100', motion: 'auto', seasonal: 'on' }), set() {}, options: { text: ['100'], motion: ['auto'], seasonal: ['on', 'off'] } },
    };
    const { navbar, created } = load('openvibe.live');
    navbar.init({ service: 'live' });
    const nav = created.find((e) => e.tag === 'nav');
    assert.ok(!nav.innerHTML.includes('ovnav-season'), 'no pumpkin button beside the brand');
    assert.ok(nav.innerHTML.includes('class="ov-mark"'), 'the mark, which wears the season itself');
    delete global.OpenVibeThemeLoader;
}
console.log('navbar brand: all checks passed');
