'use strict';
// The run thread like a coding agent's (ov-run.js 4.242.0) in a real headless Chrome, against a stand-in for the Frame's
// Run API: quiet steps in a row fold into one line ("Working, step 3 of 3" while one runs; "Ran 3 steps" after) that
// opens to each step; words said while the run works wait as queued and go when it is the person's turn; the list says
// how many are working now. The owner, 11-13, showing Claude Code's phone view: "Ran 6 commands", "Queue a message…",
// "2 running tasks": "our system should be able to do this as well, but even more comprehensively".
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('run-steps-queue-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const T = '2026-11-13T09:00:00Z';
const RUN = { id: 'k_1', ref: 'codes:k_1', kind: 'code', title: 'Fix the overlay', status: 'running', doing: { text: 'Running the tests', glyph: 'code' }, agent: { id: 'codes', name: 'Codes', glyph: 'code' }, updated_at: T };
const STEPS = [
    { seq: 1, kind: 'message', from: 'person', text: 'Fix the overlay' },
    { seq: 2, kind: 'tool', title: 'Read the overlay code', status: 'done', text: 'cat overlay.js' },
    { seq: 3, kind: 'tool', title: 'Changed two lines', status: 'done', text: 'apply_patch' },
    { seq: 4, kind: 'tool', title: 'Running the tests', status: 'running' },
];
const posts = [];
let streamTurn = 0;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/ov-run.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'ov-run.js'))); }
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0b1220;color:#e6edf7;font-family:sans-serif"><div id="host" style="height:100vh"></div><script src="/ov-run.js"></script>'); }
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    const rest = decodeURIComponent(u.pathname.slice('/api/frame/runs'.length));
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
        if (rest === '' && req.method === 'GET') return json(200, { runs: [RUN, { ...RUN, id: 'k_2', ref: 'codes:k_2', title: 'Add a timer' }, { ...RUN, id: 'c_9', ref: 'chat:c_9', kind: 'chat', title: 'Ideas', status: 'waiting', waiting: { for: 'message' } }], next: null, partial: [] });
        if (rest === '/codes:k_1') return json(200, RUN);
        if (rest === '/codes:k_1/steps') return json(200, { steps: STEPS, next: null });
        if (rest === '/codes:k_1/messages' && req.method === 'POST') { posts.push(JSON.parse(body).text); return json(201, { seq: 9, kind: 'message', from: 'person', text: JSON.parse(body).text }); }
        if (rest === '/codes:k_1/events') {
            streamTurn += 1;
            res.writeHead(200, { 'content-type': 'text/event-stream' });
            if (streamTurn === 1) {
                // The tests finish; a moment later the run waits for the person.
                setTimeout(() => res.write(`id: 4\nevent: step\ndata: ${JSON.stringify({ type: 'step', step: { ...STEPS[3], status: 'done', title: 'Ran the tests: 12 passed' } })}\n\n`), 900);
                setTimeout(() => res.write(`id: 5\nevent: step\ndata: ${JSON.stringify({ type: 'step', step: { seq: 5, kind: 'message', from: 'agent', text: 'Fixed, and the tests pass.' } })}\n\n`), 1000);
                setTimeout(() => { res.write(`id: 5\nevent: run\ndata: ${JSON.stringify({ type: 'run', run: { ...RUN, status: 'waiting', waiting: { for: 'message' } } })}\n\n`); res.end(); }, 1100);
                return;
            }
            return setTimeout(() => res.end(), 2000);
        }
        json(404, { error: 'No such run' });
    });
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-run-steps-'));
    const browser = await h.launch({ tmpDir });
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 820 });
        await page.goto(`${base}/`, { maxMs: 6000 });
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const until = async (expr, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await page.evaluate(expr); if (v) return v; await wait(40); } return false; };
        await page.evaluate(`window.view = OpenVibeRun.mount(document.getElementById('host'), { base: '${base}/api/frame', token: () => 'tok_1', me: { name: 'Sam' } })`);

        // The list says how many are working now.
        assert.equal(await until(`(document.querySelector('.ovr-busy') || {}).textContent`), '2 working now', 'the list counts what is working');

        // Three quiet steps in a row are one line while one runs.
        await page.evaluate(`view.open('codes:k_1')`);
        const g = await until(`(() => { const g = document.querySelector('.ovr-tools'); return g ? { n: g.querySelector('.ovr-tools-n').textContent, last: g.querySelector('.ovr-tools-last').textContent, rows: g.querySelectorAll('.ovr-tools-list > .ovr-step').length, running: g.classList.contains('is-running'), loose: document.querySelectorAll('.ovr-thread > .ovr-step.is-row.is-tool').length } : null; })()`);
        assert.deepEqual(g, { n: 'Working, step 3 of 3', last: 'Running the tests', rows: 3, running: true, loose: 0 }, 'one line for the three steps, saying which runs');
        assert.equal(await page.evaluate(`document.querySelector('.ovr-tools').open`), false, 'folded until opened');

        // Words said while it works wait as queued.
        await page.evaluate(`(() => { const ta = document.querySelector('.ovr-compose textarea'); ta.value = 'Also add a test'; document.querySelector('.ovr-compose form').requestSubmit(); })()`);
        assert.ok(await until(`!!document.querySelector('.ovr-step.is-queued')`), 'the words wait as queued');
        assert.deepEqual(posts, [], 'nothing is sent while it works');
        assert.match(await page.evaluate(`document.querySelector('.ovr-queued').textContent`), /Queued/);

        // The step finishes, the run waits for the person: the line says Ran 3 steps, and the queued words go.
        assert.ok(await until(`(document.querySelector('.ovr-tools-n') || {}).textContent === 'Ran 3 steps'`), 'Ran 3 steps once the last one is done');
        assert.ok(await until(`window.__sent || (document.querySelectorAll('.ovr-step.is-queued').length === 0 && [...document.querySelectorAll('.ovr-step.is-you')].some((s) => s.textContent === 'Also add a test'))`), 'the queued words were sent and joined the thread');
        assert.deepEqual(posts, ['Also add a test'], 'sent once, at its turn');

        // The line opens to each step, plain words first.
        await page.evaluate(`document.querySelector('.ovr-tools-h').click()`);
        assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.ovr-tools-list .ovr-row-step > span')].map((s) => s.textContent)`), ['Read the overlay code', 'Changed two lines', 'Ran the tests: 12 passed']);
        assert.equal(await page.evaluate('document.documentElement.scrollWidth'), 390, 'nothing wider than the phone');
        console.log('run-steps-queue-chrome: quiet steps fold into one line, queued words wait for the turn, what is working is counted');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
