'use strict';
// Your online status (4.131.0), in a real headless Chrome: signed in, the navbar loads presence.js beside itself, a
// heartbeat answers "online" and a dot shows on your picture; the picker sets Do not disturb (one PUT with
// { state: 'dnd', show_status: true }) and the dot follows; a status line saves; Escape closes the picker; a second
// tab within the minute does not beat again; presence: false loads nothing. Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('presence-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const PAGE = (off) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chat</title><link rel="icon" href="data:,"></head>
<body><div id="navbar-mount"></div><main><h1>Chat</h1></main>
<script>
  window.__calls = [];
  let view = { subject: 'usr_01JABCDEFGHJKMNPQRSTVWXYZ0', state: 'online', status_text: null, emoji: null, live: false, updated_at: '2026-11-07T10:00:00Z' };
  window.fetch = async (url, init) => {
    url = String(url);
    window.__calls.push({ url, method: (init && init.method) || 'GET', body: init && init.body ? JSON.parse(init.body) : null });
    if (/\\/api\\/v1\\/me\\/presence\\/heartbeat$/.test(url)) return new Response(JSON.stringify(view), { status: 200 });
    if (/\\/api\\/v1\\/me\\/presence$/.test(url)) {
      const b = JSON.parse(init.body);
      if (b.state === 'dnd') view = Object.assign({}, view, { state: 'dnd' });
      if ('status_text' in b) view = Object.assign({}, view, { status_text: b.status_text });
      return new Response(JSON.stringify(view), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  };
</script>
<script src="/navbar.js"></script>
<script>
  OpenVibeNavbar.init({ service: 'chat', brandName: 'OpenVibe.Chat', auth: 'external', apiBase: 'https://openvibe.network', wallet: false, messages: false, dock: false, notifications: false, recent: false,
    ${off ? 'presence: false, ' : ''}token: 'x', user: { id: 42, subject: 'usr_01JABCDEFGHJKMNPQRSTVWXYZ0', username: 'moosely', display_name: 'moosely', avatar_url: null },
    links: [{ label: 'Rooms', href: '/', icon: 'fa-comments' }] });
</script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/on' || u.pathname === '/off') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE(u.pathname === '/off')); }
    const name = u.pathname.replace(/^\/(shared\/)?/, '');
    if (/^[a-z-]+\.js$/.test(name) && fs.existsSync(path.join(ROOT, name))) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, name))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-presence-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, ms = 4000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v || Date.now() > end) return v; await wait(60); } };
    try {
        let context = null;
        for (const width of [390, 1280]) {
            context = await browser.newContext();
            const p = await h.openPage(browser, context, { width });
            await p.goto(`${base}/on`, { maxMs: 5000 });
            const state = await until(p, `(() => { const d = document.querySelector('#openvibe-avatar-btn + .ovp-dot, .ovp-wrap .ovp-dot'); return d && d.dataset.state; })()`);
            assert.strictEqual(state, 'online', `${width}px: the dot says online`);
            const beats = await p.evaluate(`window.__calls.filter((c) => /heartbeat/.test(c.url)).length`);
            assert.strictEqual(beats, 1, 'one heartbeat on load');
            assert.strictEqual(await p.evaluate(`document.getElementById('openvibe-avatar-btn').title`), 'Online');

            await p.evaluate(`OpenVibePresence.open()`);
            assert.ok(await until(p, `!!document.querySelector('.ovp-pop')`), `${width}px: the picker opens`);
            await wait(400);   // the sheet's slide-in
            const box = await p.evaluate(`(() => { const r = document.querySelector('.ovp-pop').getBoundingClientRect(); return { l: r.left, r: r.right, b: r.bottom, w: innerWidth, h: innerHeight }; })()`);
            assert.ok(box.l >= 0 && box.r <= box.w, `${width}px: the picker fits the screen ${JSON.stringify(box)}`);
            if (width === 390) assert.ok(Math.abs(box.b - box.h) < 2, 'on a phone it is a sheet at the bottom');
            await p.evaluate(`document.querySelector('.ovp-opt[data-value="dnd"]').click()`);
            assert.strictEqual(await until(p, `(() => { const d = document.querySelector('.ovp-wrap .ovp-dot'); return d && d.dataset.state === 'dnd' && d.dataset.state; })()`), 'dnd', `${width}px: Do not disturb shows`);
            const put = await p.evaluate(`window.__calls.find((c) => c.method === 'PUT')`);
            assert.deepStrictEqual(put.body, { state: 'dnd', show_status: true });
            assert.strictEqual(await p.evaluate(`document.querySelector('.ovp-opt[aria-checked="true"]').dataset.value`), 'dnd', 'the picker marks it');
            await p.evaluate(`(() => { const i = document.querySelector('.ovp-text input'); i.value = 'Building a world'; i.form.requestSubmit(); })()`);
            assert.ok(await until(p, `/Building a world/.test(document.getElementById('openvibe-avatar-btn').title)`), 'the status line saves and shows on hover');
            await p.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
            assert.ok(await until(p, `!document.querySelector('.ovp-pop') && !document.querySelector('.ovp-scrim')`), 'Escape closes it');
            await p.close();
        }
        // A second tab of the same browser within the minute: no heartbeat, the saved answer (Do not disturb) paints.
        const again = await h.openPage(browser, context, { width: 1280 });
        await again.goto(`${base}/on`, { maxMs: 5000 });
        assert.strictEqual(await until(again, `(() => { const d = document.querySelector('.ovp-wrap .ovp-dot'); return d && d.dataset.state; })()`), 'dnd');
        assert.strictEqual(await again.evaluate(`window.__calls.filter((c) => /heartbeat/.test(c.url)).length`), 0, 'a second tab within the minute does not beat again');
        await again.close();
        const off = await h.openPage(browser, context, { width: 1280 });
        await off.goto(`${base}/off`, { maxMs: 5000 });
        await wait(400);
        assert.strictEqual(await off.evaluate(`!!window.OpenVibePresence || !!document.getElementById('ov-presence-loader')`), false, 'presence: false loads nothing');
        await off.close();
        console.log('presence-chrome: the dot, one heartbeat a minute across tabs, the picker (sheet on a phone), Do not disturb, a status line, Escape; presence: false ok');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
