'use strict';
// The composer's Options, examples and the navbar's lead slot (11-09, the owner on openvibe.codes: "too many options…
// hidden under a cog… less cluttered but still has the power features"; the sidebar button "to the left of the logo"),
// in a real headless Chrome: one button opens the pickers (a sheet on a phone, the page behind stays put), a tap outside
// closes it, a changed picker shows as a chip whose × puts the default back, the placeholder walks through the examples,
// and a kit sidebar's button moves into the navbar on a phone, where the empty head row goes away. Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
const kit = require('../kit');
const thread = require('../thread');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('composer-options-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const OPTIONS = '<label class="ovt-opt">Agent <select name="who" data-ovt-default=""><option value="">Auto</option><option value="codex">Codex</option></select></label>'
    + '<label class="ovt-opt">Effort <select name="effort" data-ovt-default=""><option value="">Effort: auto</option><option value="high">Thorough</option></select></label>';
const composer = thread.composer({ action: '/send', id: 'f', placeholder: 'What should change?', options: { html: OPTIONS }, examples: ['Make the home page faster on phones', 'Add a dark mode toggle'] });
const sidebar = kit.sidebar ? kit.sidebar({ id: 'ch-rail', label: 'Your conversations', sections: [] }) : '<nav id="ch-rail" class="ovk-sidebar" data-ovk-sidebar></nav>';
const view = thread.page({ sidebar, head: thread.head({ sidebar: 'ch-rail', sidebarLabel: 'Your conversations' }), empty: '<h1>What should we build?</h1><p data-ovt-fold>Say it the way you would to a friend.</p>', composer, center: true });
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Composer</title><link rel="icon" href="data:,">
<link rel="stylesheet" href="/kit.css"><link rel="stylesheet" href="/thread.css"></head>
<body><div id="nav"></div>${view}<div style="height:1600px"></div>
<script>document.addEventListener('submit', (e) => e.preventDefault());</script>
<script src="/navbar.js"></script><script>OpenVibeNavbar.init({ mount: '#nav', site: 'codes', siteName: 'Codes', dock: false, messages: false, links: [] });</script>
<script src="/kit-web.js"></script><script src="/ov-thread.js"></script></body></html>`;
const FILES = new Set(['/kit.css', '/thread.css', '/navbar.js', '/nav-slots.js', '/kit-web.js', '/ov-thread.js']);
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (FILES.has(u.pathname)) { res.writeHead(200, { 'content-type': u.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, u.pathname.slice(1)))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-composer-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, what, ms = 5000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v) return v; if (Date.now() > end) throw new Error(`timed out: ${what}`); await wait(50); } };
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390, height: 844, block: ['*openvibe.network*', '*openvibe.tools*'] });
        await p.goto(`${base}/`, { maxMs: 6000 });
        await until(p, "!!document.querySelector('[data-ovt-opts]')", 'the Options button');
        // Only the button and Send in the bar; the pickers are behind it.
        assert.strictEqual(await p.evaluate("document.querySelector('.ovt-opts-panel').checkVisibility()"), false, 'the pickers start closed');
        assert.strictEqual(await p.evaluate("document.querySelector('.ovt-opts-dot').hidden"), true, 'no dot while everything is the default');
        // Open: a sheet at the bottom of a phone, the page behind does not scroll.
        await p.evaluate("document.querySelector('.ovt-opts > summary').click()");
        await until(p, "document.querySelector('[data-ovt-opts]').open", 'it opens');
        await wait(320);
        const sheet = await p.evaluate("(() => { const r = document.querySelector('.ovt-opts-panel').getBoundingClientRect(); return { bottom: Math.round(r.bottom), left: Math.round(r.left), width: Math.round(r.width), pos: getComputedStyle(document.querySelector('.ovt-opts-panel')).position, locked: document.documentElement.classList.contains('ovt-sheet-open') }; })()");
        assert.strictEqual(sheet.pos, 'fixed', 'a sheet on a phone');
        assert.ok(sheet.bottom >= 840 && sheet.left === 0 && sheet.width === 390, `along the bottom edge (${JSON.stringify(sheet)})`);
        assert.ok(sheet.locked, 'the page behind stays put');
        // Change a picker: a chip shows beside the button, and the dot.
        await p.evaluate("(() => { const s = document.querySelector('select[name=who]'); s.value = 'codex'; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
        assert.strictEqual(await p.evaluate("[...document.querySelectorAll('.ovt-opt-chip > span')].map((s) => s.textContent).join()"), 'Codex', 'the changed one is a chip');
        assert.strictEqual(await p.evaluate("document.querySelector('.ovt-opts-dot').hidden"), false, 'and the button wears a dot');
        // A tap outside closes it and unlocks the page.
        await p.evaluate("(() => { const e = new PointerEvent('pointerdown', { bubbles: true }); document.querySelector('h1').dispatchEvent(e); })()");
        await until(p, "!document.querySelector('[data-ovt-opts]').open", 'a tap outside closes it');
        assert.strictEqual(await p.evaluate("document.documentElement.classList.contains('ovt-sheet-open')"), false, 'the page scrolls again');
        // The chip's × puts the default back.
        await p.evaluate("document.querySelector('.ovt-opt-chip-x').click()");
        assert.strictEqual(await p.evaluate("document.querySelector('select[name=who]').value"), '', 'the default is back');
        assert.strictEqual(await p.evaluate("document.querySelectorAll('.ovt-opt-chip').length"), 0, 'and the chip is gone');
        // The examples walk through the placeholder while the box is empty.
        await until(p, "document.querySelector('[data-ovt-text]').placeholder !== 'What should change?'", 'the placeholder moves to an example', 6000);
        // The sidebar button: in the navbar before the brand, and the head row with nothing else in it is gone.
        await until(p, "!!document.getElementById('ovnav-lead')", 'the lead slot in the navbar');
        const lead = await p.evaluate("(() => { const b = document.getElementById('ovnav-lead'); const brand = document.querySelector('.openvibe-navbar-brand'); return { first: brand.firstElementChild === b, ctl: b.getAttribute('aria-controls'), head: getComputedStyle(document.querySelector('.ovt-head')).display }; })()");
        assert.ok(lead.first, 'the button comes before the brand');
        assert.strictEqual(lead.ctl, 'ch-rail', 'and opens the conversations');
        assert.strictEqual(lead.head, 'none', 'the empty head row goes');
        await p.evaluate("document.getElementById('ovnav-lead').click()");
        await until(p, "document.getElementById('ch-rail').classList.contains('is-open')", 'the slot opens the drawer');
        assert.strictEqual(await p.evaluate("document.getElementById('ovnav-lead').getAttribute('aria-expanded')"), 'true', 'and says it is open');
        assert.ok(await p.evaluate('document.documentElement.scrollWidth <= 390'), 'no sideways scroll');
        // A site's own action on the right, by the API.
        await p.evaluate("OpenVibeNavbar.action({ id: 'help', icon: 'info', label: 'Help', badge: 2, onClick: () => { window.__help = (window.__help || 0) + 1; } })");
        await p.evaluate("document.getElementById('ovnav-act-help').click()");
        assert.strictEqual(await p.evaluate('window.__help'), 1, 'an action button calls its handler');
        assert.strictEqual(await p.evaluate("document.querySelector('#ovnav-act-help b').textContent"), '2', 'and shows its count');
        // On a computer: the panel opens beside the button, not as a sheet, and the navbar slot is not shown.
        const d = await h.openPage(browser, context, { width: 1280, height: 900, block: ['*openvibe.network*', '*openvibe.tools*'] });
        await d.goto(`${base}/`, { maxMs: 6000 });
        await until(d, "!!document.querySelector('[data-ovt-opts]')", 'the Options button on a computer');
        await d.evaluate("document.querySelector('.ovt-opts > summary').click()");
        await wait(250);
        assert.strictEqual(await d.evaluate("getComputedStyle(document.querySelector('.ovt-opts-panel')).position"), 'absolute', 'a panel on a computer');
        assert.strictEqual(await d.evaluate("document.documentElement.classList.contains('ovt-sheet-open')"), false, 'the page is not locked for a panel');
        await until(d, "!!document.getElementById('ovnav-lead')", 'the slot exists');
        assert.strictEqual(await d.evaluate("getComputedStyle(document.getElementById('ovnav-lead')).display"), 'none', 'but hides where the sidebar is always shown');
        console.log('composer-options-chrome: one Options button, a sheet on a phone, chips for changes, examples, the sidebar button in the navbar, actions by API');
    } finally { await browser.close(); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
