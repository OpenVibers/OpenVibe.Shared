'use strict';
// The sessions drawer scrolls as one on a phone (4.315.0; the owner's phone, 11-18: "Can't scroll!!" over Actor, Codes,
// Your AI and a running card in the menu's Vibe tab). Only the list under them scrolled, and on a short screen those
// rows filled it, so a drag on them moved nothing. In a real headless Chrome, at the owner's size (about 360 px wide,
// about 570 px under the menu's box and tabs): scrolling from over Actor reaches the last session, the head
// (Sessions, New, ×) stays in view, and nothing scrolls sideways.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('ov-session-drawer-scroll-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const now = Date.now();
const iso = (s) => new Date(now - s * 1000).toISOString();
const runs = Array.from({ length: 18 }, (_, i) => ({
    ref: `chat:c_${i}`, kind: 'chat', title: `Session number ${i + 1}`, status: 'done',
    created_at: iso(3600 * (i + 2)), updated_at: iso(3600 * (i + 2)), agent: { id: 'vibe', name: 'Vibe' },
}));
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0f17;color:#e6edf7;font:15px system-ui;overflow:hidden} #host{height:570px;position:relative}</style>
<script src="/ov-session.js"></script></head><body><div id="host"></div>
<script>
window.__s = OpenVibeSession.mount(document.getElementById('host'), { base: location.origin + '/api/frame', token: 'signed-in-test', sibling: (f) => '/' + f,
  actor: true, codes: true, actions: { base: location.origin },
  top: (slot) => { const d = document.createElement('div'); d.className = 'test-card'; d.style.cssText = 'height:300px;margin:8px 10px;border-radius:16px;background:#1a2230'; d.textContent = 'A running job'; slot.append(d); return {}; },
  starters: [['code', 'Build me a landing page']] });
</script></body></html>`;
const server = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    if (/^\/[a-z0-9-]+\.js$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) { res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }); return res.end(fs.readFileSync(path.join(root, p.slice(1)))); }
    if (p === '/api/frame/runs') return json(res, 200, { runs, partial: [] });
    if (p === '/api/frame/actor') return json(res, 200, { id: 'agt_1', name: 'Actor', status: 'ready', now: { cost_today: 0 }, caps: { usd_per_day: 1 } });
    if (p === '/api/v1/me/actions') return json(res, 200, { buckets: { waiting: [] } });
    if (p === '/api/frame/run-options') return json(res, 200, { agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }] });
    if (p === '/api/frame/choices') return json(res, 200, { groups: [] });
    res.writeHead(404); res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-drawer-')) });
    const until = async (p, expr, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); };
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 360, height: 740 });
        await p.goto(base, { maxMs: 8000 });
        // The sessions drawer, opened as the menu's Vibe tab shows it.
        await until(p, '!!window.__s');
        await p.evaluate('window.__s.drawer(true)');
        await until(p, "document.querySelectorAll('.ovse-runs .ovse-row:not(.is-ghost)').length >= 18 && !!document.querySelector('.ovse-actor:not([hidden])') && document.querySelector('.ovse').classList.contains('is-drawer')");
        await pause(400);
        const at = await p.evaluate(`(() => { const r = document.querySelector('.ovse-actor').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
        // Scrolling from over Actor, the way the owner tried: a wheel there scrolls the nearest scrolling box under it, as a
        // drag does (headless Chrome does not carry out a synthesized touch drag). Before 4.315.0 there was none: the
        // list was the only one, below.
        for (let i = 0; i < 6; i++) {
            await p.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: at.x, y: at.y, deltaX: 0, deltaY: 400 });
            await pause(120);
        }
        await pause(300);
        const after = await p.evaluate(`(() => {
            const host = document.getElementById('host').getBoundingClientRect();
            const rows = [...document.querySelectorAll('.ovse-runs .ovse-row:not(.is-ghost)')];
            const last = rows[rows.length - 1].getBoundingClientRect();
            const head = document.querySelector('.ovse-dhead').getBoundingClientRect();
            return { lastBottom: Math.round(last.bottom), hostBottom: Math.round(host.bottom), headTop: Math.round(head.top), hostTop: Math.round(host.top),
                     docW: document.documentElement.scrollWidth };
        })()`);
        assert.ok(after.lastBottom <= after.hostBottom + 1, `scrolling from over Actor reaches the last session (its bottom ${after.lastBottom}, the panel's ${after.hostBottom})`);
        assert.ok(after.headTop >= after.hostTop - 1 && after.headTop < after.hostTop + 60, `the head stays in view (${after.headTop} vs ${after.hostTop})`);
        assert.strictEqual(after.docW, 360, 'no sideways scroll');
        console.log('ov-session-drawer-scroll-chrome: scrolling from over Actor reaches the last session, the head stays');
    } finally {
        await browser.close().catch(() => {});
        server.close();
    }
})().catch((err) => { console.error(err); process.exit(1); });
