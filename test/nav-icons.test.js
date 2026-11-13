'use strict';
// navbar.js ships only the glyphs it draws itself; the rest of the Font Awesome set is nav-icons.js,
// fetched after first paint. Covers: the size budget, the generated block being in sync, every
// built-in icon drawn inline with no fetch, lazy slots sized then filled, the Font Awesome fallback
// when nav-icons.js cannot load, and where nav-icons.js is fetched from.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { brotli } = require('../scripts/size-report');

const ROOT = path.join(__dirname, '..');
const NAVBAR_PATH = path.join(ROOT, 'navbar.js');
const ICONS = require('../nav-icons');
const NAVBAR_BROTLI_BUDGET = 54.4 * 1024;   // 54.2 KB with the names wearing what their people wear (4.244.0, 2026-11-13, plan §Z.3: OV.names(scope) and the items loader); before: 53.3 KB with the viewer model (4.243.0, 2026-11-13, plan §Z.2: OV.viewer(), data-ov-viewer and the openvibe-viewer event); before, 52.3 KB with the menu button drawn from the menu (4.240.0, 2026-11-13: the owner's "regenerate this icon … based on what the menu actually looks like … glow"); before:   // 51.6 KB with menu addresses (data-ov-menu, #ov-menu=, menuAddress; 4.229.0, 2026-11-12: the owner's "other tools and buttons open specific areas of the menu"; budgets grow for a feature); before that: 50.9 KB with Back to the menu, the links' warm-up and token() (4.229.0, 2026-11-12: the owner's back button and fast links; budgets grow for a feature); before that: 50.1 KB with the app icon's squares held at their size before ov-icons.js (4.227.0, 2026-11-12: design rule 142; budgets grow for a feature); before that: 49.9 KB with the content hashes of 4.211.0's siblings (2026-11-11: no new code in the bar; the agent sheet is a sibling); 49.8 KB with the page view a guest sends at once (4.191.0, 2026-11-10); 49.7 KB with the links that step out when the bar is too narrow (4.190.0, 2026-11-10: it lays out the first paint, so it cannot be a sibling; a diet of the bar is owed); 49.3 KB with Sign In's drawn icon and the menu button's idle hop (4.191.0, 2026-11-10; a signed-out first paint, so it cannot be a sibling); 49.0 KB with the press on the site name that opens its pages (4.191.0, 2026-11-10: the list itself is ov-drop.js); 48.7 KB with the page-view beacon's signed-in marker (4.189.0, 2026-11-10); 48.6 KB with the wallet's cookie mode and its two content hashes (4.173.0, 2026-11-09); 48.2 KB with the same-site prerender rule, cross-site prefetch and the file-cache worker registration (4.165.0, 2026-11-09); 47.6 KB with the six glyph styles' refined paths and the sheets' surface loader (4.162.0, 2026-11-09); 47.1 KB with the shared pop motion every site's menus use and the account menu's Wallet and Profile (4.161.0, 2026-11-09); 46.6 KB with the keyboard watcher every site needs and the slots' loader (4.160.0, 2026-11-09; the slots themselves are a sibling, nav-slots.js); 45.0 KB with the floating cards' loader and link warming (4.152.0, 2026-11-08; the cards themselves are a sibling, overlay.js); 44.3 KB with the phone's menu button drawn as the orb (4.148.0, 2026-11-08); 43.5 KB with the menu warmed at idle and on intent (4.137.0); 43.2 KB with every sibling's ?v= content hash (4.137.0, 2026-11-07: the owner's menu was a day stale without them); 42.8 KB keeping the menu's Frame fields (4.132.0, 2026-11-07); 42.6 KB with Messages and the balances on every site (4.130.0, 2026-11-07); 42.1 KB with the featured link's phone button (4.119.0, 2026-11-06); 41.4 KB with the page-move code (4.70.0: busy(), the mark on plain links, prefetch rules on unboosted sites); was 41 KB with the Dock's loader (4.51.0)

// ── size budget and generated block ──────────────────────────
{
    const size = brotli(fs.readFileSync(NAVBAR_PATH));
    assert.ok(size <= NAVBAR_BROTLI_BUDGET, `navbar.js is ${(size / 1024).toFixed(1)} KB brotli, budget ${NAVBAR_BROTLI_BUDGET / 1024} KB — keep glyphs in nav-icons.js`);
    execFileSync(process.execPath, [path.join(ROOT, 'scripts/build-navbar-icons.js'), '--check'], { stdio: 'pipe' });
}

function stubElement(tag) {
    const el = {
        tag, style: {}, textContent: '', className: '', id: '', innerHTML: '', dataset: {}, attrs: {}, children: [],
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; }, removeAttribute(k) { delete this.attrs[k]; },
        appendChild(c) { this.children.push(c); }, prepend(c) { this.children.unshift(c); }, remove() {}, addEventListener() {},
        querySelector() { return stubElement(); }, querySelectorAll() { return []; },
    };
    return el;
}

/** Fresh navbar.js with stubbed globals. `slots` are what document.querySelectorAll('svg[data-ovnav-ic]') finds. */
function load(opts = {}) {
    const hostname = opts.hostname || 'openvibe.live';
    global.location = { hostname, href: `https://${hostname}/`, pathname: '/', protocol: 'https:' };
    global.window = { location: global.location };
    try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'test' }, configurable: true }); } catch { /* */ }
    const created = [];
    const slots = opts.slots || [];
    global.document = {
        cookie: '', head: stubElement('head'), body: stubElement('body'), title: 'T',
        currentScript: opts.src ? { src: opts.src } : null,
        getElementById: () => null, createElement: (tag) => { const e = stubElement(tag); created.push(e); return e; },
        querySelectorAll: (sel) => (sel === 'svg[data-ovnav-ic]' ? slots.filter(s => s.attrs['data-ovnav-ic']) : []),
        addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    };
    global.CustomEvent = class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } };
    global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    global.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    delete global.OpenVibeNavIcons;
    if (opts.preloaded) global.OpenVibeNavIcons = ICONS;
    delete require.cache[require.resolve(NAVBAR_PATH)];
    const navbar = require(NAVBAR_PATH);
    return { navbar, created, loaders: () => created.filter(e => e.tag === 'script' && e.id === 'ov-nav-icons-loader') };
}
// [0, line, solid] is an OpenVibe glyph (4.71.0: one hand in the bar); [w, path] a Font Awesome one the set lacks.
const ovg = (g) => `<svg class="ovnav-ic ovnav-ovg${g[2] ? ' has-s' : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${g[1]}${g[2] ? `<g class="ovg-s">${g[2]}</g>` : ''}</svg>`;
const coarseMarkup = (markup) => markup.replace(/ d="([^"]*)"/g, (m, body) => {
    let out = '', cmd = '', n = 0, lastNumber = false;
    for (const tok of body.match(/[AaCcSsQqTtLlHhVvMmZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || []) {
        if (/[A-Za-z]/.test(tok)) { out += tok; cmd = tok; n = 0; lastNumber = false; continue; }
        const keep = /[Aa]/.test(cmd) && (n % 7) >= 2 && (n % 7) <= 4;
        n++;
        const value = keep ? tok : (Object.is(Math.round(Number(tok) * 2) / 2, -0) ? '0' : (Math.round(Number(tok) * 2) / 2).toString());
        if (lastNumber && value[0] !== '-') out += ' ';
        out += value; lastNumber = true;
    }
    return ` d="${out}"`;
});
const rawGlyph = (name) => (ICONS[name][0] === 0 ? ovg(ICONS[name]) : `<svg class="ovnav-ic" viewBox="0 0 ${ICONS[name][0]} 512" style="width:${(ICONS[name][0] / 512).toFixed(3)}em" aria-hidden="true" focusable="false"><path fill="currentColor" d="${ICONS[name][1]}"/></svg>`);
const glyph = (name) => (ICONS[name][0] === 0 ? ovg([0, coarseMarkup(ICONS[name][1]), coarseMarkup(ICONS[name][2] || '')]) : rawGlyph(name));
const html = (created) => created.map(e => e.innerHTML).join('\n');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const admin = { id: 1, username: 'alex', display_name: 'Alex', role: 'admin' };

(async () => {
    // ── the default navbar draws every one of its own icons inline, with no fetch ──
    const own = [...new Set([...fs.readFileSync(NAVBAR_PATH, 'utf8').matchAll(/navIcon\('(fa-[a-z0-9-]+)'\)/g)].map(m => m[1]))];
    assert.ok(own.length >= 10, 'found the navbar\'s own icons');
    {
        const { navbar, created, loaders } = load();
        navbar.init({ service: 'network', user: admin, token: 't' });
        const out = html(created);
        for (const name of own) {
            if (name === 'fa-coins') continue;   // wallet chip, drawn when the menu first opens (below)
            if (name === 'fa-user-secret') continue;   // "Switch to Anonymous": only where openvibe.network's account switcher runs
            if (name === 'fa-chevron-down') continue;   // the account menu's More: only past eight places (4.23.0)
            if (name === 'fa-bell') continue;   // the Notifications place: only where the bar has no bell (4.23.0)
            if (name === 'fa-comment-dots') continue;   // messages beside the bell: only for a site that has them (4.25.0)
            if (name === 'fa-wallet') continue;   // the Vibes balance in the menu, drawn when it first opens (4.25.0)
            assert.ok(out.includes(glyph(name)), `${name} drawn inline by the default navbar`);
        }
        assert.ok(!/data-ovnav-ic|fa-solid/.test(out), 'no lazy slot or icon-font fallback in the default navbar');
        await wait(350);
        assert.strictEqual(loaders().length, 0, 'the default navbar never fetches nav-icons.js');
    }

    // ── every glyph in the set is available: built in, or lazy with the same width ──
    {
        const src = fs.readFileSync(NAVBAR_PATH, 'utf8');
        const lazy = {};
        const block = src.slice(src.indexOf('const NAV_ICONS_LAZY = {'), src.indexOf('const NAV_ICONS_REV'));
        for (const m of block.matchAll(/(\d+): '([^']+)'/g)) m[2].split(' ').forEach(n => { lazy[n] = Number(m[1]); });
        for (const [name, [w]] of Object.entries(ICONS)) {
            if (own.includes(name)) assert.ok(src.includes(w === 0 ? `'${name}': [0, '${coarseMarkup(ICONS[name][1])}', '${coarseMarkup(ICONS[name][2] || '')}']` : `'${name}': [${w}, '${ICONS[name][1]}']`), `${name} built in, same drawing as nav-icons.js`);
            else assert.strictEqual(lazy[name], w, `${name} listed as lazy with its width`);
        }
        const rev = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'nav-icons.js'))).digest('hex').slice(0, 12);
        assert.ok(src.includes(`const NAV_ICONS_REV = '${rev}';`), 'NAV_ICONS_REV is the content hash of nav-icons.js');
    }

    // ── a site's lazy icon: sized slot → fetched after paint → filled in ──
    {
        const slot = stubElement('svg');
        const { navbar, created, loaders } = load({ src: 'https://openvibe.live/shared/navbar.js?v=abc123', slots: [slot] });
        navbar.init({ service: 'live', user: admin, token: 't', links: [{ id: 'home', label: 'Home', href: '/', icon: 'fa-house' }, { id: 'x', label: 'X', href: '/x', icon: 'fa-not-a-glyph' }] });
        const out = html(created);
        assert.strictEqual(ICONS['fa-house'][0], 0, 'the house is the OpenVibe set\'s own');
        assert.ok(out.includes('<svg class="ovnav-ic ovnav-ovg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-ovnav-ic="fa-house" data-ovnav-cls="fa-house"></svg>'), 'lazy glyph renders as an empty slot of its exact size');
        assert.ok(out.includes('<i class="fa-solid fa-not-a-glyph"></i>'), 'names outside the set keep the icon-font fallback');
        assert.strictEqual(loaders().length, 0, 'nothing fetched before first paint');
        await wait(350);
        assert.strictEqual(loaders().length, 1, 'nav-icons.js requested once');
        const sc = loaders()[0];
        const rev = /NAV_ICONS_REV = '([0-9a-f]{12})'/.exec(fs.readFileSync(NAVBAR_PATH, 'utf8'))[1];
        assert.strictEqual(sc.src, `https://openvibe.live/shared/nav-icons.js?v=${rev}`, 'fetched next to navbar.js, content-hashed');
        assert.strictEqual(sc.async, true);
        Object.assign(slot.attrs, { 'data-ovnav-ic': 'fa-house', 'data-ovnav-cls': 'fa-house' });
        global.OpenVibeNavIcons = ICONS;   // what nav-icons.js does when it runs
        sc.onload();
        assert.strictEqual(slot.innerHTML, ICONS['fa-house'][1] + (ICONS['fa-house'][2] ? `<g class="ovg-s">${ICONS['fa-house'][2]}</g>` : ''), 'slot filled with the glyph: its line and solid drawings');
        assert.strictEqual(slot.attrs['data-ovnav-ic'], undefined);
        created.length = 0;
        navbar.setLinks([{ id: 'home', label: 'Home', href: '/', icon: 'fa-house' }]);
        assert.ok(html(created).includes(rawGlyph('fa-house')), 'after loading, the glyph renders inline');
    }

    // ── nav-icons.js cannot load: lazy icons fall back to the page's Font Awesome ──
    {
        const slot = stubElement('svg');
        Object.assign(slot.attrs, { 'data-ovnav-ic': 'fa-video', 'data-ovnav-cls': 'fa-video extra' });
        const { navbar, created, loaders } = load({ slots: [slot] });
        navbar.init({ service: 'live', links: [{ label: 'VODs', href: '/vods', icon: 'fa-video' }] });
        await wait(350);
        assert.strictEqual(loaders()[0].src.split('?')[0], 'https://openvibe.network/shared/nav-icons.js', 'no navbar.js script URL: the network copy');
        loaders()[0].onerror();
        assert.strictEqual(slot.outerHTML, '<i class="fa-solid fa-video extra"></i>', 'slot replaced by the icon-font fallback');
        created.length = 0;
        navbar.setLinks([{ label: 'VODs', href: '/vods', icon: 'fa-video' }]);
        assert.ok(html(created).includes('<i class="fa-solid fa-video"></i>') && !html(created).includes('data-ovnav-ic'), 'later renders use the fallback directly');
    }

    // ── a page that loaded nav-icons.js itself gets every glyph from the first frame ──
    {
        const { navbar, created, loaders } = load({ preloaded: true });
        navbar.init({ service: 'live', links: [{ label: 'Chat', href: '/chat', icon: 'fa-comments' }] });
        assert.ok(html(created).includes(rawGlyph('fa-comments')), 'preloaded set used synchronously');
        await wait(350);
        assert.strictEqual(loaders().length, 0, 'no fetch when the set is already on the page');
    }

    // ── iconsUrl override ──
    {
        const { navbar, loaders } = load({ src: 'https://cdn.example/x/bundle.js' });
        navbar.init({ service: 'live', iconsUrl: '/assets/nav-icons.js', links: [{ label: 'Chat', href: '/chat', icon: 'fa-comments' }] });
        await wait(350);
        assert.strictEqual(loaders()[0].src, '/assets/nav-icons.js');
    }

    // ── 4.71.0: every name the OpenVibe glyphs cover is drawn from them, and the bar's CSS honours the person's choice ──
    {
        const glyphs = require('../glyphs');
        const covered = Object.keys(ICONS).filter((n) => glyphs.fromFa(n));
        assert.ok(covered.length >= 100, 'nearly the whole set is the OpenVibe glyphs');
        covered.forEach((n) => assert.strictEqual(ICONS[n][0], 0, `${n} is an OpenVibe glyph`));
        assert.deepStrictEqual(ICONS['fa-bell'], [0, glyphs.path('bell'), glyphs.solid('bell')]);
        const src = fs.readFileSync(NAVBAR_PATH, 'utf8');
        assert.ok(src.includes('html[data-ov-icons=solid] .ovnav-ovg.has-s'), 'a person who prefers solid icons gets them in the bar');
        assert.ok(src.includes('.ovnav-ab.is-here .ovnav-ovg.has-s > .ovg-s { display: inline; }'), 'the app bar\'s tab you are on wears the solid one');
        assert.ok(!/LINE_ICONS|lineIcon/.test(src), 'no second icon set inside the navbar');
        const bell = fs.readFileSync(path.join(ROOT, 'notification-ui.js'), 'utf8');
        assert.ok(bell.includes('<svg class=\"ovnav-ovg has-s\"') || bell.includes('<svg class="ovnav-ovg has-s"'), 'the bell has both drawings too');
    }

    console.log('nav-icons: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
