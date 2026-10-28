'use strict';
// search.js and loading.js in a real headless Chrome (4.21.0). Search: the navbar's magnifier (and "/") loads search.js
// on first use and opens the panel; with nothing typed it shows this site's pages; typing asks OpenVibe.Search's
// suggest (here a local stand-in) with the older request cancelled, puts this site's results first, and always offers
// "all of OpenVibe" and "Ask Vibe"; arrows and Escape work; titles are text, never markup. Loading: a poster-backed
// overlay that steps, slows with actions, fails with Retry and fades out; skeleton rows. Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('search-loading-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const asked = [];
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Rooms · OpenVibe.Chat</title><link rel="icon" href="data:,"></head>
<body><div id="navbar-mount"></div><main><div id="player" style="position:relative;width:360px;height:202px"></div><div id="list"></div></main>
<script src="/navbar.js"></script><script src="/loading.js"></script>
<script>
  // search.js asks Search through Network's /api/frame/suggest (every site's connect-src allows openvibe.network); this
  // page answers instead (same shape), slowly for "slow". Asking search.openvibe.network itself is a failure here.
  window.__realFetch = window.fetch;
  window.fetch = async (u, init) => {
    const url = new URL(String(u), location.href);
    if (url.hostname === 'openvibe.network' && url.pathname === '/api/frame/suggest') return window.__realFetch('/suggest' + url.search, init);
    if (url.hostname === 'search.openvibe.network') throw new TypeError('refused by connect-src');
    if (url.hostname === 'openvibe.network') return new Response('{}', { status: 404 });   // the Frame and the catalog: offline here
    return window.__realFetch(u, init);
  };
  OpenVibeNavbar.init({ service: 'chat', user: null, links: [{ label: 'Rooms', href: '/rooms', icon: 'fa-people-group' }, { label: 'Servers', href: '/servers', icon: 'fa-server' }],
    search: { label: 'OpenVibe.Chat', page: '/search' } });
</script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (u.pathname === '/suggest') {
        const q = u.searchParams.get('q');
        asked.push(q);
        const body = JSON.stringify({ suggestions: [
            { owner: 'live', type: 'vod', id: '1', title: `${q} stream <b>bold</b>`, canonical_url: 'https://openvibe.video/v/1' },
            { owner: 'chat', type: 'room', id: 'r', title: `${q} room`, canonical_url: 'https://openvibe.chat/r/night-owls' },
            { owner: 'evil', type: 'x', id: 'e', title: 'bad link', canonical_url: 'javascript:alert(1)' },
        ] });
        const send = () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(body); };
        return q === 'slow' ? setTimeout(send, 600) : send();
    }
    const name = u.pathname.slice(1);
    if (/^[a-z-]+\.js$/.test(name) && fs.existsSync(path.join(ROOT, name))) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, name))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-search-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390 });
        await p.goto(`${base}/`, { maxMs: 5000 });
        await wait(200);
        // ── Search ──
        assert.strictEqual(await p.evaluate('!!document.getElementById("openvibe-search-btn")'), true, 'the magnifier is in the bar');
        assert.strictEqual(await p.evaluate('typeof window.OpenVibeSearch'), 'undefined', 'search.js is not loaded until asked');
        await p.evaluate('document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true })); 1');
        // search.js loads on first use: wait for its box, not a fixed time (macOS runners took longer than 400 ms, 4.28.0's CI).
        for (let i = 0; i < 50 && !(await p.evaluate('!!document.querySelector(".ovs.is-open .ovs-input")')); i++) await wait(100);
        await wait(150);
        let v = await p.evaluate(`({ open: !!document.querySelector('.ovs.is-open'), focused: document.activeElement && document.activeElement.className,
            tabs: [...document.querySelectorAll('.ovs-tab')].map((t) => t.textContent + (t.getAttribute('aria-selected') === 'true' ? '*' : '')),
            groups: [...document.querySelectorAll('.ovs-group')].map((g) => g.firstChild.textContent), chips: [...document.querySelectorAll('.ovs-chip span')].map((t) => t.textContent),
            sites: [...document.querySelectorAll('.ovs-tile b')].map((t) => t.textContent), placeholder: document.querySelector('.ovs-input').placeholder })`);
        assert.ok(v.open && v.focused === 'ovs-input', '"/" opened the panel and focused the box');
        assert.deepStrictEqual(v.tabs, ['For you*', 'Sites', 'Tools'], 'one menu, three tabs (the launcher and search together, 4.23.0)');
        assert.deepStrictEqual([v.groups, v.chips], [['On OpenVibe.Chat', 'Popular on OpenVibe'], ['Rooms', 'Servers']], 'nothing typed: this site\'s pages, then the sites');
        assert.ok(v.sites.includes('Live') && v.sites.includes('Tools'), 'the main sites even before the Frame answers');
        assert.strictEqual(v.placeholder, 'Search OpenVibe.Chat, or jump to any site');
        // The box completes from this site's pages (and the person's searches, history and sites); Tab takes it.
        await p.evaluate(`(() => { const i = document.querySelector('.ovs-input'); i.value = 'Roo'; i.dispatchEvent(new Event('input')); return 1; })()`);
        assert.strictEqual(await p.evaluate('document.querySelector(".ovs-ghost").textContent'), 'Rooms', 'the completion shows behind the text');
        await p.evaluate('document.querySelector(".ovs-input").dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true })); 1');
        assert.strictEqual(await p.evaluate('document.querySelector(".ovs-input").value'), 'Rooms', 'Tab takes it');
        await p.evaluate(`(() => { const i = document.querySelector('.ovs-input'); i.value = ''; i.dispatchEvent(new Event('input')); return 1; })()`);
        await wait(100);
        await p.evaluate('document.querySelector(".ovs-tab[data-tab=sites]").click(); 1');
        assert.ok(await p.evaluate('!!document.querySelector(".ovs-grid.is-sites .ovs-tile")'), 'the Sites tab lists the sites');
        // Typing: one request for the latest text (the earlier one cancelled), this site's results first.
        await p.evaluate(`(() => { const i = document.querySelector('.ovs-input'); i.value = 'slow'; i.dispatchEvent(new Event('input')); setTimeout(() => { i.value = 'night'; i.dispatchEvent(new Event('input')); }, 250); })(); 1`);
        await wait(1200);
        v = await p.evaluate(`({ groups: [...document.querySelectorAll('.ovs-group')].map((g) => g.firstChild.textContent), rows: [...document.querySelectorAll('.ovs-item a')].map((a) => [a.querySelector('.ovs-title').textContent, a.getAttribute('href')]),
            bold: !!document.querySelector('.ovs-list .ovs-title b'), active: document.querySelector('.ovs-opt.is-active .ovs-title').textContent })`);
        assert.deepStrictEqual(v.groups, ['On OpenVibe.Chat', 'Across OpenVibe', 'Search']);
        assert.deepStrictEqual(v.rows[0], ['night room', 'https://openvibe.chat/r/night-owls'], 'the room on this site comes first');
        assert.ok(v.rows.some(([t, u]) => t === 'night stream <b>bold</b>' && u === 'https://openvibe.video/v/1'), 'a title is text, never markup');
        assert.ok(!v.bold, 'no markup from a title reached the page');
        assert.ok(!v.rows.some(([, u]) => /^javascript:/.test(u)), 'a script link is dropped');
        assert.ok(v.rows.some(([t, u]) => t === 'Search “night” on OpenVibe.Chat' && u.endsWith('/search?q=night')), 'this site\'s own search page');
        assert.ok(v.rows.some(([t, u]) => t === 'Search “night” on all of OpenVibe' && u === 'https://search.openvibe.network/?q=night'));
        assert.ok(v.rows.some(([t, u]) => t === 'Ask Vibe: “night”' && u === 'https://openvibe.chat/vibe?ask=night'));
        assert.strictEqual(v.active, 'night room', 'the first row is ready for Enter');
        assert.ok(asked.includes('night'), 'Search was asked');
        await p.evaluate('document.querySelector(".ovs-input").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); 1');
        assert.notStrictEqual(await p.evaluate('document.querySelector(".ovs-opt.is-active .ovs-title").textContent'), 'night room', 'arrows move');
        await p.evaluate('document.querySelector(".ovs-input").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); 1');
        assert.strictEqual(await p.evaluate('!!document.querySelector(".ovs.is-open")'), false, 'Escape closes');

        // ── Loading ──
        v = await p.evaluate(`new Promise((done) => {
            const l = OpenVibeLoading.mount(document.getElementById('player'), { label: 'Connecting', sub: 'Getting your viewer ready', steps: 4,
                poster: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"><rect width="16" height="9" fill="purple"/></svg>') });
            const box = document.querySelector('.ovld');
            const r = { role: box.getAttribute('role'), unknown: box.classList.contains('is-unknown'), label: box.querySelector('.ovld-label').textContent };
            l.update({ step: 1, label: 'Opening secure link', sub: 'Almost there' });
            setTimeout(() => {
                r.p = box.style.getPropertyValue('--ovld-p'); r.unknown2 = box.classList.contains('is-unknown'); r.label2 = box.querySelector('.ovld-label').textContent;
                r.poster = box.querySelector('.ovld-poster').classList.contains('is-in');
                let tapped = 0;
                l.slow({ hint: 'Taking longer than usual.', actions: [{ label: 'Copy details', onClick: () => { tapped++; } }] });
                r.slow = box.classList.contains('is-slow'); box.querySelector('.ovld-acts button').click(); r.tapped = tapped;
                l.fail({ title: 'Could not connect', detail: 'The stream stopped answering.', actions: [{ label: 'Retry', onClick: () => {} }] });
                setTimeout(() => {
                    r.failed = box.classList.contains('is-failed'); r.alert = box.getAttribute('role'); r.title = box.querySelector('.ovld-label').textContent; r.retry = box.querySelector('.ovld-acts button').textContent;
                    l.done(); setTimeout(() => { r.gone = !document.querySelector('.ovld');
                        const s = OpenVibeLoading.skeleton(document.getElementById('list'), { rows: 3 }); r.skel = document.querySelectorAll('.ovld-skel-row').length; s.done(); r.skelGone = !document.querySelector('.ovld-skel'); done(r); }, 600);
                }, 400);
            }, 400);
        })`);
        assert.deepStrictEqual([v.role, v.unknown, v.label], ['status', true, 'Connecting'], 'it starts as an unknown progress, announced politely');
        assert.deepStrictEqual([v.p, v.unknown2, v.label2], ['40%', false, 'Opening secure link'], 'step 2 of 4 fills the line');
        assert.strictEqual(v.poster, true, 'the poster faded in behind');
        assert.deepStrictEqual([v.slow, v.tapped], [true, 1], 'slow: a hint and its action');
        assert.deepStrictEqual([v.failed, v.alert, v.title, v.retry], [true, 'alert', 'Could not connect', 'Retry'], 'failed: said, with Retry');
        assert.strictEqual(v.gone, true, 'done: it fades and leaves');
        assert.deepStrictEqual([v.skel, v.skelGone], [3, true], 'skeleton rows');
        const sideways = await p.evaluate('document.documentElement.scrollWidth - innerWidth');
        assert.strictEqual(sideways, 0, 'nothing scrolls sideways at 390 px');
        console.log('search-loading-chrome: search (lazy, scoped, cancelled, safe, keyboard) and loading (steps, slow, fail, done, skeleton) ok');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
