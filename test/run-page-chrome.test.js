'use strict';
// The messenger full-page (ov-run.js OpenVibeRun.page, 4.250.0; plan §AB.8/47): openvibe.chat/vibe, Codes' start page and
// Actor's console draw it. In a real headless Chrome against a stand-in for the Frame's Run API:
//   • a computer (1280 px): the conversations on the left and, beside them, a new conversation with your agent (its
//     face, its name, the box); a row opens its conversation on the right and is marked; no Back on a computer;
//   • the box on the left starts a conversation on the right, and the new one joins the list;
//   • a phone (390 px): the list alone; a row opens the conversation in its place, Back returns; nothing runs off it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('run-page-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const NOW = new Date().toISOString();
const RUNS = [
    { id: 'c_1', ref: 'chat:c_1', kind: 'chat', title: 'Goal bar ideas', status: 'done', agent: { id: 'vibe', name: 'Vibe', glyph: 'spark' }, preview: { text: 'Three ideas for your goal bar' }, updated_at: NOW },
    { id: 'k_3', ref: 'codes:k_3', kind: 'code', title: 'Fix the overlay', status: 'running', doing: { text: 'Running the tests', glyph: 'code' }, agent: { id: 'codes', name: 'Codes', glyph: 'code' }, updated_at: NOW },
];
let made = false;
const got = { uploads: [], starts: [] };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/ov-run.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'ov-run.js'))); }
    if (u.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0b1220;color:#e6edf7">
<div id="app" style="height:100dvh"></div><script src="/ov-run.js"></script>
<script>window.page = OpenVibeRun.page(document.getElementById('app'), { base: location.origin + '/api/frame', token: 'tok', agent: { name: 'Vibe' }, starters: [['spark', 'Plan my stream']] });</script>`);
    }
    if (!u.pathname.startsWith('/api/frame/')) { res.writeHead(404); return res.end(); }
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    const rest = decodeURIComponent(u.pathname.slice('/api/frame/runs'.length));
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
        if (u.pathname.startsWith('/api/frame/actor')) return json(200, { id: 'act_1', name: 'Juniper', enabled: true, status: 'idle', now: {}, asks: [] });
        if (rest === '' && req.method === 'GET') return json(200, { runs: made ? [{ ...RUNS[0], id: 'c_2', ref: 'chat:c_2', title: 'A new one' }, ...RUNS] : RUNS, next: null });
        if (rest === '/files' && req.method === 'POST') { got.uploads.push({ type: req.headers['content-type'], name: req.headers['x-filename'], bytes: Buffer.byteLength(body) });
            return json(201, { file: { id: 'med_01ARZ3NDEKTSV4RRFFQ69G5FAV', name: decodeURIComponent(req.headers['x-filename'] || ''), media_type: req.headers['content-type'] } }); }
        if (rest === '' && req.method === 'POST') { got.starts.push(JSON.parse(body || '{}'));
            made = true; return json(201, { ...RUNS[0], id: 'c_2', ref: 'chat:c_2', title: 'A new one', status: 'running' }); }
        if (/^\/chat:c_[12]$/.test(rest)) return json(200, rest.includes('c_2') ? { ...RUNS[0], id: 'c_2', ref: 'chat:c_2', title: 'A new one' } : RUNS[0]);
        if (/^\/chat:c_[12]\/steps$/.test(rest)) return json(200, { steps: [{ seq: 1, kind: 'message', from: 'agent', text: 'Here are three.' }], next: null });
        if (/\/events$/.test(rest)) { res.writeHead(200, { 'content-type': 'text/event-stream' }); return setTimeout(() => res.end(), 100); }
        json(404, { error: 'No such run' });
    });
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-run-page-')) });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (p, expr, what, ms = 6000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(expr); if (v) return v; if (Date.now() > end) throw new Error(`timed out: ${what}`); await wait(60); } };
    try {
        // ── A computer ──
        {
            const p = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 800 });
            await p.goto(`${base}/`, { maxMs: 6000 });
            await until(p, "document.querySelectorAll('.ovr-page-list .ovr-row').length === 2", 'the conversations on the left');
            const first = await until(p, `(() => { const m = document.querySelector('.ovr-page-main'); const b = m && m.querySelector('.ovr.is-blank'); if (!b) return null;
                const l = document.querySelector('.ovr-page-list').getBoundingClientRect(), r = m.getBoundingClientRect();
                return { side: r.left >= l.right - 1, name: (b.querySelector('.ovr-blank-n') || {}).textContent, box: !!b.querySelector('.ovr-compose textarea'), face: !!b.querySelector('.ovr-face.is-xl') }; })()`, 'a new conversation beside them');
            assert.deepEqual([first.side, first.box, first.face], [true, true, true], 'beside the list: your agent\'s face and the box');
            assert.match(first.name, /Juniper|Vibe/, 'its name');
            await p.evaluate("document.querySelector('.ovr-page-list .ovr-row[data-ref=\"chat:c_1\"]').click()");
            await until(p, "!!document.querySelector('.ovr-page-main .ovr.is-thread .ovr-step') && document.querySelector('.ovr-page-list .ovr-row[data-ref=\"chat:c_1\"]').classList.contains('is-open')", 'the conversation on the right, its row marked');
            assert.equal(await p.evaluate("getComputedStyle(document.querySelector('.ovr-page-main .ovr-thead > .ovr-ib')).display"), 'none', 'no Back on a computer');
            assert.equal(await p.evaluate("!!document.querySelector('.ovr-page-list .ovr-row')"), true, 'the list stays');
            // The box on the left starts one on the right, and it joins the list.
            await p.evaluate("(() => { const t = document.querySelector('.ovr-page-list .ovr-compose textarea'); t.value = 'Plan my week'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); })()");
            await until(p, "!!document.querySelector('.ovr-page-main .ovr-step.is-you')", 'your words on the right');
            await until(p, "!!document.querySelector('.ovr-page-list .ovr-row[data-ref=\"chat:c_2\"]')", 'the new one in the list', 8000);
            if (process.env.OV_CAPTURE) { await wait(600); const r = await p.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(process.env.OV_CAPTURE, 'run-page-1280.png'), Buffer.from(r.data, 'base64')); }
            // A picture with the words (4.250.0): uploaded first, its reference rides on the run, and it shows under the words.
            await p.evaluate("page.main.start('What is this?', [new File([new Uint8Array([137, 80, 78, 71])], 'cat.png', { type: 'image/png' })]), true");
            await until(p, "!!document.querySelector('.ovr-page-main .ovr-step.is-you .ovr-file.is-pic img')", 'the picture under the words');
            const deadline = Date.now() + 5000; while (!got.starts.some((b) => b.attachments) && Date.now() < deadline) await wait(60);
            assert.deepEqual([got.uploads[0].type, got.uploads[0].name, got.uploads[0].bytes > 0], ['image/png', 'cat.png', true], 'the file goes up as itself, typed and named');
            const withFile = got.starts.find((b) => b.attachments);
            assert.ok(withFile && withFile.attachments[0].id === 'med_01ARZ3NDEKTSV4RRFFQ69G5FAV' && withFile.text === 'What is this?', 'its reference rides on the run');
            await p.close();
        }
        // ── A phone ──
        {
            made = false;
            const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 800 });
            await p.goto(`${base}/`, { maxMs: 6000 });
            await until(p, "document.querySelectorAll('.ovr-page-list .ovr-row').length === 2", 'the list');
            assert.equal(await p.evaluate("getComputedStyle(document.querySelector('.ovr-page-main')).display"), 'none', 'a phone shows the list alone');
            await p.evaluate("document.querySelector('.ovr-page-list .ovr-row[data-ref=\"chat:c_1\"]').click()");
            if (process.env.OV_CAPTURE) { await wait(600); const r = await p.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(process.env.OV_CAPTURE, 'run-page-390-list.png'), Buffer.from(r.data, 'base64')); }
            await until(p, "getComputedStyle(document.querySelector('.ovr-page-list')).display === 'none' && !!document.querySelector('.ovr-page-main .ovr-step')", 'the conversation in its place');
            await p.evaluate("document.querySelector('.ovr-page-main .ovr-thead > .ovr-ib').click()");
            await until(p, "getComputedStyle(document.querySelector('.ovr-page-list')).display !== 'none'", 'Back to the list');
            assert.equal(await p.evaluate('document.documentElement.scrollWidth'), 390, 'nothing off the screen');
            await p.close();
        }
        console.log('run-page-chrome: ok');
    } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
