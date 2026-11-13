'use strict';
// The inline Community thread's composer (openvibe-shared 4.215.0, thread.renderThread + ov-thread.js): the
// server-drawn comment form still posts without script; with the script it becomes the shared composer v2
// (form.ovc-v2[data-preset=comment]) in place, keeps the action and the reply's parent_id, and sends the words
// natively. Real headless Chrome at 390 px; skipped without Chrome.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
const thread = require('../thread');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('inline-composer-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const answer = {
    thread: { id: 'cth_1', access_id: 'cth_1', comment_count: 1, url: 'https://openvibe.community/c/cth_1' },
    comments: [{ id: 1, message: 'A <comment>', created_at: '2026-11-12T00:00:00Z', author: { username: 'alex', display_name: 'Alex' }, reply_count: 0 }],
    viewer: { can_comment: true },
};
const HTML = thread.renderThread({ answer, base: '/p/x', post: '/p/x/comments', remove: '/p/x/comments/remove', signedIn: true, attachmentsAllowed: true, replyId: 1 });
let posted = null, postedRaw = '';
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (req.method === 'POST' && u.pathname === '/p/x/comments') {
        let body = '';
        req.on('data', (d) => { body += d; });
        req.on('end', () => { postedRaw = body; posted = { message: (body.match(/name="message"\r?\n\r?\n([^\r]*)/) || [])[1] || '', parent: (body.match(/name="parent_id"\r?\n\r?\n([^\r]*)/) || [])[1] || '' }; res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><p id="posted">posted</p>'); });
        return;
    }
    if (u.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comments</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/thread.css"><link rel="stylesheet" href="/thread-inline.css"></head><body style="margin:0;padding:16px;background:#0b1220;color:#e6edf7;font-family:sans-serif"><div data-ovt data-ovc-thread>${HTML}</div><script src="/ov-composer.js"></script><script src="/ov-thread.js"></script></body></html>`);
    }
    if (['/thread.css', '/thread-inline.css', '/ov-composer.js', '/ov-thread.js'].includes(u.pathname)) {
        res.writeHead(200, { 'content-type': u.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' });
        return res.end(fs.readFileSync(path.join(root, u.pathname.slice(1))));
    }
    res.writeHead(404); res.end();
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inline-composer-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (expr) => { const end = Date.now() + 5000; while (Date.now() < end) { const v = await page.evaluate(expr); if (v) return v; await wait(40); } return false; };
    let page;
    try {
        page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 900 });
        await page.goto(base + '/', { maxMs: 6000 });
        assert.ok(await until(`!!document.querySelector('form.ovc-v2[data-preset="comment"]')`), 'the reply is the shared comment composer');
        assert.equal(await page.evaluate(`document.querySelectorAll('[data-ovt-composer]').length`), 0, 'the server form is replaced, not doubled');
        const shape = await page.evaluate(`(() => { const f = document.querySelector('form.ovc-v2[data-preset="comment"]'); return { action: f.getAttribute('action'), method: f.method, parent: (f.querySelector('input[name=parent_id]') || {}).value, send: f.querySelector('[data-ovt-send]').textContent.trim(), tools: [...f.querySelectorAll('.ovt-c-tools .ovt-btn')].map((b) => b.getAttribute('aria-label')) }; })()`);
        assert.deepEqual(shape, { action: '/p/x/comments', method: 'post', parent: '1', send: 'Reply', tools: ['Add: camera, photos, files and more', 'Photos and video', 'Emoji'] });
        assert.equal(await page.evaluate(`document.documentElement.scrollWidth`), 390, 'nothing is wider than a phone');
        await page.evaluate(`(() => { const t = document.querySelector('form.ovc-v2 textarea'); t.value = 'Hello from the shared box'; t.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('form.ovc-v2 [data-ovt-send]').click(); })()`);
        const landed = await until(`!!document.getElementById('posted')`);
        assert.ok(landed || posted, 'the native form posts to the page\'s action');
        if (posted) { assert.equal(posted.message, 'Hello from the shared box'); assert.equal(posted.parent, '1'); }
        await page.close();
        console.log('inline-composer-chrome: the comment form mounts preset comment, keeps action and parent, sends, 390 px');
    } finally {
        if (page) await page.close().catch(() => {});
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
