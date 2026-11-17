'use strict';
// What the menu button's amber dot means, kept plain (4.295.0; the owner's phone, 11-17: "What is this yellow dot trying to
// indicate? Like when I click it, like it just like opens this menu … it's not clear what it's trying to do"). Over a
// local Frame at 390 px: an agent's task waiting for your answer is first, under Needs you, and its row says "Waiting for
// your answer" (a chat that is simply your turn is not waiting); when the dot was tapped (navbar.js sets __ovNeedsYou),
// the list opens that task itself, once.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('needs-you-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const iso = (s) => new Date(Date.now() - s * 1000).toISOString();
const runs = [
    { ref: 'chat:c_1', kind: 'chat', title: 'A good first synth', status: 'waiting', waiting: { for: 'message' }, created_at: iso(200), updated_at: iso(100), agent: { id: 'vibe', name: 'Vibe' } },
    { ref: 'actor:run_q', kind: 'task', title: 'What is on today?', status: 'waiting', waiting: { for: 'message' }, preview: { text: 'Which part of today: streams or events?' }, created_at: iso(400), updated_at: iso(300), agent: { id: 'actor', name: 'Actor' } },
];
const page = (needs) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0b0f17;color:#e8ecf3;font:15px system-ui}#host{position:fixed;inset:0}</style>
<script src="/ov-session.js"></script></head><body><div id="host"></div>
<script>${needs ? 'window.__ovNeedsYou = Date.now();' : ''}
window.__s = OpenVibeSession.mount(document.getElementById('host'), { base: location.origin + '/api/frame', token: 'signed-in-test', sibling: (f) => '/' + f, title: 'Vibe' });
</script></body></html>`;
const json = (res, s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); const p = u.pathname;
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page(u.searchParams.get('needs') === '1')); }
    if (/^\/[a-z0-9-]+\.js$/.test(p) && fs.existsSync(path.join(root, p.slice(1)))) { res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }); return res.end(fs.readFileSync(path.join(root, p.slice(1)))); }
    if (p === '/api/frame/run-options') return json(res, 200, { agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }], places: [{ kind: 'auto', name: 'Auto' }] });
    if (p === '/api/frame/runs') return json(res, 200, { runs, partial: [] });
    const m = /^\/api\/frame\/runs\/([^/]+)(\/.*)?$/.exec(p);
    if (m) {
        const run = runs.find((r) => r.ref === decodeURIComponent(m[1]));
        if (!run) return json(res, 404, {});
        if (!m[2]) return json(res, 200, run);
        if (m[2] === '/steps') return json(res, 200, { steps: [{ seq: 1, kind: 'message', from: 'person', status: 'done', text: run.title }, { seq: 2, kind: 'message', from: 'agent', status: 'done', text: 'Which part of today: streams or events?' }] });
        if (m[2] === '/events') { res.writeHead(200, { 'content-type': 'text/event-stream' }); return; }
    }
    res.writeHead(404); res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(50); } throw new Error(`Timed out: ${expr}`); }

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-needs-you-')) });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await p.goto(base, { maxMs: 8000 });
        await p.evaluate("document.querySelector('.ovse-menu').click()");
        const list = await until(p, `(() => { const g = [...document.querySelectorAll('.ovse-runs .ovse-group')].map((x) => x.textContent); const rows = [...document.querySelectorAll('.ovse-runs .ovse-row')];
            return rows.length === 2 && { groups: g, first: rows[0].querySelector('b').textContent, line: rows[0].querySelector('.ovse-row-l').textContent, needs: rows[0].classList.contains('is-needs'), chatNeeds: rows[1].classList.contains('is-needs') }; })()`);
        assert.deepStrictEqual(list, { groups: ['Needs you', 'Today'], first: 'What is on today?', line: 'Waiting for your answer', needs: true, chatNeeds: false }, 'the waiting task first, said plainly; a chat is only your turn');
        assert.strictEqual(await p.evaluate("document.querySelector('.ovse-title').textContent"), 'Vibe', 'opened on its own: nothing is opened for you');

        // The dot was tapped: the waiting task opens itself.
        const q = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await q.goto(`${base}?needs=1`, { maxMs: 8000 });
        await q.evaluate('window.__s.refresh()');
        assert.strictEqual(await until(q, "document.querySelector('.ovse-title').textContent === 'What is on today?' && document.querySelector('.ovse-title').textContent"), 'What is on today?', 'the dot opens what waits');
        assert.strictEqual(await q.evaluate('window.__ovNeedsYou'), 0, 'once');
        console.log('needs-you-chrome: the waiting task first and plain, a chat is not waiting, the dot opens what waits ok');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((err) => { console.error(err); process.exit(1); });
