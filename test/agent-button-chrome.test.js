'use strict';
// The agent button (4.288.0; plan §AD.15, the owner, 11-16: "a button … across all sites … that will start an agent or
// spawn an agent to do something … extremely configurable"). In a real headless Chrome:
//   • an empty <button data-ov-agent> is drawn with the agent glyph and its label;
//   • a press starts a session in the menu's Vibe with the task and the page's context: the form's fields, never a
//     password, a key or a hidden field; the selection; or the page itself; and says where it was asked;
//   • approve "first" fills the box instead of starting;
//   • OVAgent.spawn hears its own session's steps and its end, and not another session's;
//   • without the menu, Vibe opens in a new tab with the words;
//   • the navbar loads ov-agent.js once a page has a button.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('agent-button-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const ROOT = path.join(__dirname, '..');

const STUB = `<script>window.calls = []; window.OpenVibeSearch = { ask: (t, o) => { window.calls.push([t, o]); } };</script>`;
const page = ({ menu = true, navbar = false } = {}) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,">
<title>Settings · Test site</title><meta name="description" content="Your site's AI settings">
${navbar ? '<script src="/shared/navbar.js" defer></script>' : ''}</head>
<body style="font:16px system-ui"><div id="navbar-mount"></div><main><h1>AI settings</h1><p>Pick a provider and a budget.</p>
<form id="f" onsubmit="event.preventDefault()">
<label>Provider <input name="provider" value="OpenRouter"></label>
<label>Budget <input name="budget" value="5"></label>
<label>API key <input name="api_key" value="sk-should-not-leave"></label>
<label>Password <input type="password" name="pw" value="hunter2"></label>
<input type="hidden" name="csrf" value="tok123">
<label><input type="checkbox" name="notify" checked> Notify me</label>
<select name="tier"><option>Free</option><option selected>Plus</option></select>
<button type="button" id="b1" data-ov-agent="Set this up for me" data-ov-agent-task="Set up AI with safe defaults" data-ov-agent-context="form" data-ov-agent-who="actor"></button>
</form>
<p id="sel">Some selected words here</p>
<button id="b2" data-ov-agent="Explain this" data-ov-agent-context="selection" data-ov-agent-approve="first">Explain</button>
</main>
${menu ? STUB : '<script>window.opened = []; window.open = (u) => { window.opened.push(u); return null; };</script>'}
${navbar ? `<script>document.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init({ service: 'site', user: null, links: [], networkLinks: false, countViews: false, notifications: false }); });</script>` : '<script src="/shared/ov-agent.js"></script>'}
</body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page({ menu: !u.searchParams.has('nomenu'), navbar: u.searchParams.has('navbar') })); }
    const m = /^\/shared\/([a-z0-9-]+\.(?:js|css|woff2))$/.exec(u.pathname);
    if (m && fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, m[1]))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-agent-button-')) });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, what, ms = 6000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v) return v; if (Date.now() > end) throw new Error(`timed out: ${what}`); await wait(50); } };
    try {
        const ctx = await browser.newContext();
        const p = await h.openPage(browser, ctx, { width: 390, height: 844 });
        await p.goto(`${base}/`, { maxMs: 6000 });
        await until(p, "!!(window.OVAgent && !window.OVAgent._stub)", 'ov-agent.js ready');

        // An empty button is drawn: the glyph and its label. A button with words keeps them.
        await until(p, "document.getElementById('b1').hasAttribute('data-ov-agent-drawn')", 'the empty button drawn');
        const drawn = await p.evaluate("(() => { const b = document.getElementById('b1'); return [b.textContent.trim(), !!b.querySelector('i[data-ov-icon=\"spark\"]')]; })()");
        assert.deepEqual(drawn, ['Set this up for me', true]);
        assert.equal(await p.evaluate("document.getElementById('b2').textContent.trim()"), 'Explain', 'a button with words keeps them');

        // The form's context: its fields, never a password, a key or a hidden field.
        await p.evaluate("document.getElementById('b1').click(), true");
        await until(p, 'window.calls.length === 1', 'the first press asks');
        const [text, how] = await p.evaluate('window.calls[0]');
        assert.ok(text.startsWith('Set up AI with safe defaults\n\nThe form (on Settings · Test site, '), text);
        for (const line of ['Provider: OpenRouter', 'Budget: 5', 'Notify me: yes', 'tier: Plus', '(2 private fields left out)']) assert.ok(text.includes(line), `${line} in ${JSON.stringify(text)}`);
        for (const secret of ['sk-should-not-leave', 'hunter2', 'tok123']) assert.ok(!text.includes(secret), `${secret} never leaves the page`);
        assert.equal(how.agent, 'actor');
        assert.equal(how.prefill, false);
        assert.deepEqual(Object.keys(how.context).sort(), ['kind', 'site', 'title', 'url']);
        assert.deepEqual([how.context.site, how.context.kind, how.context.title], ['127.0.0.1', 'form', 'Settings · Test site']);
        assert.ok(how.context.url.startsWith(base), how.context.url);
        assert.equal(await p.evaluate("document.getElementById('b1').getAttribute('aria-busy')"), 'true', 'the button says it is starting');

        // The selection, and approve first fills the box instead of starting.
        await p.evaluate("(() => { const r = document.createRange(); r.selectNodeContents(document.getElementById('sel')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.getElementById('b2').click(); return 1; })()");
        await until(p, 'window.calls.length === 2', 'the second press asks');
        const [text2, how2] = await p.evaluate('window.calls[1]');
        assert.ok(/^Explain this\n\nWhat I selected \(on Settings · Test site, [^)]+\):\nSome selected words here$/.test(text2), text2);
        assert.deepEqual([how2.prefill, how2.agent, how2.context.kind], [true, null, 'selection']);

        // OVAgent.spawn: the page's own words; the session's steps and end come back, another session's never.
        const got = await p.evaluate(`(async () => {
            const seen = [];
            const run = await OVAgent.spawn({ task: 'Summarize this page', onEvent: (t) => seen.push(t) });
            const fire = (type, data) => dispatchEvent(new CustomEvent('ov:session', { detail: { type, data } }));
            fire('session.started', { ref: 'r1', run: { status: 'running' } });
            fire('session.step', { ref: 'r2', step: { seq: 1 } });
            fire('session.step', { ref: 'r1', step: { seq: 1, kind: 'message' } });
            fire('session.ended', { ref: 'r2', run: { status: 'failed' } });
            fire('session.ended', { ref: 'r1', run: { status: 'done', result_summary: 'All set', url: 'https://openvibe.network/runs/r1' } });
            const out = await run.done;
            return { out, seen, ref: run.ref, text: window.calls[2][0] };
        })()`);
        assert.deepEqual(got.out, { ref: 'r1', status: 'done', summary: 'All set', outputs: [], url: 'https://openvibe.network/runs/r1' });
        assert.deepEqual(got.seen, ['started', 'step', 'ended'], 'only its own session');
        assert.ok(got.text.startsWith('Summarize this page\n\nThe page (on Settings · Test site, '), got.text);
        assert.ok(got.text.includes('AI settings') && got.text.includes("Your site's AI settings"), 'the page: its heading and description');
        await assert.rejects(p.evaluate("OVAgent.spawn({ task: '  ' })"), /needs a task/);

        // Without the menu: Vibe in a new tab, with the words.
        const q = await h.openPage(browser, ctx, { width: 390, height: 844 });
        await q.goto(`${base}/?nomenu`, { maxMs: 6000 });
        await until(q, "!!(window.OVAgent && !window.OVAgent._stub)", 'ov-agent.js ready (no menu)');
        await q.evaluate("document.getElementById('b2').click(), true");
        await until(q, 'window.opened.length === 1', 'a new tab');
        assert.ok((await q.evaluate('window.opened[0]')).startsWith('https://openvibe.chat/vibe?ask=Explain%20this'));

        // The navbar loads ov-agent.js once a page has a button.
        const n = await h.openPage(browser, ctx, { width: 1280, height: 800 });
        await n.goto(`${base}/?navbar`, { maxMs: 8000 });
        await until(n, "!!(window.OVAgent && !window.OVAgent._stub) && !!document.getElementById('ov-agent-loader')", 'the navbar loads the agent button', 10000);
        assert.ok(/ov-agent\.js\?v=[0-9a-f]{12}$/.test(await n.evaluate("document.getElementById('ov-agent-loader').src")), 'by its content hash');
        console.log('agent-button-chrome: drawn, form/selection/page context without secrets, approve first, its own session\'s end, a new tab without the menu, loaded by the navbar');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
