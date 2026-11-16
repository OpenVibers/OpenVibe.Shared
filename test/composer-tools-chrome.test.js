'use strict';
// The composer's Tools (ov-composer.js 4.280.0) in a real headless Chrome, at 390 px: the + has a Tools row; it opens a
// panel with the most used tools; a search finds tools (a tool that takes a file or needs a sign-in is left out); a tool
// opens its input with what you wrote already in its first text field; Run asks openvibe.tools with no cookie; the answer
// is shown in plain lines and "Put it in" adds it to the box. "/tool" opens the same panel. Nothing is wider than the phone.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('composer-tools-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const runs = [];
const searched = [];
const COUNT = { id: 'count', name: 'Word Counter', summary: 'Words, characters, sentences and reading time.', status: 'stable', api: true, files: null, auth: { anonymous: true, capability: 'tools.tool.run' }, hosts: ['count.openvibe.tools'] };
const json = (res, body, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/api/v1/tools/popular') return json(res, { tools: [{ id: 'count', name: 'Word Counter', description: 'Words and characters.' }, { id: 'dig', name: 'Online dig', description: 'DNS records.' }] });
    if (u.pathname === '/api/v1/tools' && u.searchParams.get('q')) {
        searched.push(u.searchParams.get('q'));
        return json(res, { tools: [COUNT, { ...COUNT, id: 'pdfwords', name: 'PDF words', files: { min: 1, max: 1, accept: ['application/pdf'], maxBytes: 1 } }, { ...COUNT, id: 'portscan', name: 'Port scan', auth: { anonymous: false, capability: 'tools.net.probe' } }] });
    }
    if (u.pathname === '/api/v1/tools/count') return json(res, COUNT);
    if (u.pathname === '/api/v1/tools/count/schema') return json(res, { $defs: { input: { type: 'object', required: ['text'], properties: { text: { type: 'string', maxLength: 1000000 }, unit: { type: 'string', enum: ['words', 'characters'] } } } } });
    if (u.pathname === '/api/v1/tools/count/run' && req.method === 'POST') {
        let b = '';
        req.on('data', (c) => { b += c; });
        req.on('end', () => { runs.push({ body: JSON.parse(b), cookie: req.headers.cookie || null }); json(res, { state: 'succeeded', tool: 'count', result: { data: { words: 4, characters: 21, readingTime: '1 s' } }, took_ms: 2 }); });
        return;
    }
    if (u.pathname === '/ov-composer.js' || u.pathname === '/ov-window.js' || u.pathname === '/ov-capture.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, u.pathname.slice(1)))); }
    res.writeHead(200, { 'content-type': 'text/html', 'set-cookie': 'ov_session=secret; Path=/' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="margin:0;padding:16px;background:#0b1220;color:#e6edf7;font-family:sans-serif"><div id="a" style="margin-top:420px"></div>
<script>window.OV_TOOLS_URL = location.origin;</script>
<script src="/ov-composer.js"></script>
<script>window.box = OpenVibeComposer.mount(document.getElementById('a'), { preset: 'chat', id: 'c1' });</script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'composer-tools-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 860 });
        await page.goto(base + '/', { maxMs: 5000 });
        const until = async (expr) => { const end = Date.now() + 5000; while (Date.now() < end) { const v = await page.evaluate(expr); if (v) return v; await wait(40); } return false; };
        assert.ok(await until('!!document.querySelector("#c1 textarea")'), 'the composer mounts');
        await page.evaluate(`(() => { const t = document.querySelector('#c1 textarea'); t.value = 'one small brave world'; t.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);

        // The + has Tools among its rows.
        await page.evaluate(`document.querySelector('#c1 .ovc-more').click()`);
        assert.ok(await until(`!!document.querySelector('dialog.ovc-add[open] .ovc-add-row[data-tool=tools]')`), 'a Tools row in the +');
        await page.evaluate(`document.querySelector('dialog.ovc-add .ovc-add-row[data-tool=tools]').click()`);
        const popular = await until(`(() => { const p = document.querySelector('#c1 .ovc-tools'); const rows = p && [...p.querySelectorAll('.ovc-repo-row b')].map((b) => b.textContent); return rows && rows.length ? rows : null; })()`);
        assert.deepEqual(popular, ['Word Counter', 'Online dig'], 'the most used tools first');

        // A search: tools that take a file or need a sign-in are left out.
        await page.evaluate(`(() => { const f = document.querySelector('#c1 .ovc-tools .ovc-repo-q'); f.value = 'word count'; f.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
        const found = await until(`(() => { const rows = [...document.querySelectorAll('#c1 .ovc-tools .ovc-repo-row b')].map((b) => b.textContent); return rows.length === 1 ? rows : null; })()`);
        assert.deepEqual(found, ['Word Counter'], 'only the tools that run for anyone, without a file');
        assert.deepEqual(searched, ['word count']);

        // The tool: what you wrote is already in its text field; a choice is chips.
        await page.evaluate(`document.querySelector('#c1 .ovc-tools .ovc-repo-row').click()`);
        const form = await until(`(() => { const p = document.querySelector('#c1 .ovc-tools'); const t = p && p.querySelector('.ovc-tools-form textarea'); return t ? { text: t.value, title: p.querySelector('.ovc-tools-title').textContent, chips: [...p.querySelectorAll('.ovc-tools-chip')].map((c) => c.textContent), page: p.querySelector('.ovc-tools-page').href } : null; })()`);
        assert.deepEqual(form, { text: 'one small brave world', title: 'Word Counter', chips: ['words', 'characters'], page: 'https://count.openvibe.tools/' });
        assert.equal(await page.evaluate('document.documentElement.scrollWidth'), 390, 'nothing wider than the phone');

        // Run: on openvibe.tools, no cookie; the answer in plain lines; Put it in adds it to the box.
        await page.evaluate(`document.querySelector('#c1 .ovc-tools-go').click()`);
        const out = await until(`(() => { const o = document.querySelector('#c1 .ovc-tools-out'); return o ? o.textContent : null; })()`);
        assert.equal(out, 'Words: 4\nCharacters: 21\nReading time: 1 s');
        assert.deepEqual(runs[0], { body: { input: { text: 'one small brave world' }, wait_ms: 20000 }, cookie: null }, 'the input, and never a cookie');
        await page.evaluate(`document.querySelector('#c1 .ovc-tools-go').click()`);
        assert.equal(await page.evaluate(`document.querySelector('#c1 textarea').value`), 'one small brave world\nWords: 4\nCharacters: 21\nReading time: 1 s');
        assert.equal(await page.evaluate(`document.querySelector('#c1 .ovc-tools').hidden`), true, 'the panel closes');

        // Back, and Escape.
        await page.evaluate(`document.querySelector('#c1 .ovc-more').click()`);
        await until(`!!document.querySelector('dialog.ovc-add[open] .ovc-add-row[data-tool=tools]')`);
        await page.evaluate(`document.querySelector('dialog.ovc-add .ovc-add-row[data-tool=tools]').click()`);
        assert.equal(await until(`document.querySelector('#c1 .ovc-tools').hidden === false`), true, 'it opens again where it was');
        await page.evaluate(`document.querySelector('#c1 .ovc-tools').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
        assert.equal(await page.evaluate(`document.querySelector('#c1 .ovc-tools').hidden`), true, 'Escape closes it');

        // "/tool" opens it from the keyboard.
        await page.evaluate(`(() => { const t = document.querySelector('#c1 textarea'); t.focus(); t.value = '/tool'; t.setSelectionRange(5, 5); t.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
        assert.ok(await until(`[...document.querySelectorAll('[role=option]')].some((o) => /tool/.test(o.textContent) && /OpenVibe tool/.test(o.textContent))`), 'the /tool command is offered');
        await page.evaluate(`document.querySelector('#c1 textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))`);
        assert.equal(await until(`document.querySelector('#c1 .ovc-tools').hidden === false`), true, '/tool opens the tools');
        console.log('composer-tools-chrome: the + Tools row, the most used, search without file or sign-in tools, what you wrote filled in, a run with no cookie, the answer in lines and into the box');
    } finally {
        await browser.close().catch(() => {});
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((err) => { console.error(err); process.exit(1); });
