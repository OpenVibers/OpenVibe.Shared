'use strict';
// The agents' row over the menu's conversations (ov-run.js, 4.259.0; the owner, 11-15, crossing out "My Actor · Vibe ·
// Vibe · Codes · Agent": "the actor is what the actual agent … should be. Like the default, and then there was also
// codes"). In a real headless Chrome against a stand-in Frame:
//   • your agent first, called Actor until you name it ("My Actor", Network's old default, reads Actor);
//   • Codes always beside it, with its own face (a terminal: a prompt and a cursor), even with no code run yet;
//   • an agent you made has its own face after them; Vibe (the chatbot's old name), "My Actor" and a run with no
//     agent name are your Actor's, never faces of their own; a conversation still titled "Vibe" says Actor;
//   • a press on Codes shows only Codes' conversations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('run-agents-row-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const at = (min) => new Date(Date.now() - min * 60000).toISOString();
const RUNS = [
    { id: 'c_1', ref: 'chat:c_1', kind: 'chat', title: 'Vibe', status: 'done', agent: { id: 'vibe', name: 'Vibe', product: 'chat' }, preview: { text: 'Done' }, updated_at: at(1) },
    { id: 't_1', ref: 'actor:t_1', kind: 'task', title: 'Find me a deal', status: 'done', agent: { id: 'agt_vibe', name: 'Vibe' }, updated_at: at(2) },
    { id: 't_2', ref: 'actor:t_2', kind: 'task', title: 'Read the docs', status: 'done', agent: { id: 'act_1', name: 'My Actor' }, updated_at: at(3) },
    { id: 't_3', ref: 'actor:t_3', kind: 'task', title: 'Task', status: 'done', agent: { id: 'x' }, updated_at: at(4) },
    { id: 't_4', ref: 'actor:t_4', kind: 'task', title: 'Clip the stream', status: 'done', agent: { id: 'agt_clip', name: 'Clipper', hue: 140 }, updated_at: at(5) },
];
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/ov-run.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'ov-run.js'))); }
    if (u.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0b1220;color:#e6edf7">
<div id="app" style="height:100dvh"></div><script src="/ov-run.js"></script>
<script>window.view = OpenVibeRun.mount(document.getElementById('app'), { base: location.origin + '/api/frame', token: 'tok', agent: true });</script>`);
    }
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (u.pathname === '/api/frame/actor') return json(200, { id: 'act_1', name: 'My Actor', enabled: true, status: 'idle', now: {}, asks: [] });
    if (u.pathname === '/api/frame/runs') return json(200, { runs: RUNS, next: null });
    json(404, { error: 'No such thing' });
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-run-agents-')) });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, what, ms = 6000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v) return v; if (Date.now() > end) throw new Error(`timed out: ${what}`); await wait(60); } };
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await p.goto(`${base}/`, { maxMs: 6000 });
        await until(p, "document.querySelectorAll('.ovr-rows .ovr-row').length === 5", 'the conversations');
        const row = await until(p, `(() => { const names = [...document.querySelectorAll('.ovr-people .ovr-person .ovr-person-n')].map((n) => n.textContent);
            return names[0] === 'Actor' ? names : null; })()`, 'your agent called Actor');
        assert.deepEqual(row, ['Actor', 'Codes', 'Clipper', 'New'], 'your Actor, Codes always, an agent you made, then New: no Vibe, no "Agent", no "My Actor"');
        const codes = await p.evaluate(`(() => { const f = document.querySelectorAll('.ovr-people .ovr-person')[1].querySelector('.ovr-face');
            return { coder: f.classList.contains('ovr-coder'), prompt: !!f.querySelector('.ovr-coder-prompt'), cursor: !!f.querySelector('.ovr-coder-cursor') }; })()`);
        assert.deepEqual(codes, { coder: true, prompt: true, cursor: true }, 'Codes has its own face: a terminal with a prompt and a cursor');
        const rows = await p.evaluate(`[...document.querySelectorAll('.ovr-rows .ovr-row')].map((r) => [r.querySelector('.ovr-row-top b').textContent, r.querySelector('.ovr-face').classList.contains('ovr-me')])`);
        assert.deepEqual(rows, [['Actor', true], ['Find me a deal', true], ['Read the docs', true], ['Task', true], ['Clip the stream', false]], 'Vibe, "My Actor" and nameless runs are your Actor\'s; a conversation titled Vibe says Actor');
        await p.evaluate("document.querySelectorAll('.ovr-people .ovr-person')[1].click(), true");
        await until(p, "document.querySelectorAll('.ovr-rows .ovr-row').length === 0 && document.querySelectorAll('.ovr-people .ovr-person')[1].getAttribute('aria-pressed') === 'true'", 'only Codes\' conversations');
        assert.equal(await p.evaluate('document.documentElement.scrollWidth'), 390, 'nothing runs off a phone');
        console.log('run-agents-row-chrome: Actor, Codes always with its face, made agents, old names folded into Actor, the Codes filter');
    } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
