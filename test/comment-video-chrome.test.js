'use strict';
// A video in a comment, end to end in headless Chrome (4.247.0, plan §Z.9): the box of a thread drawn with
// mediaAttachments sends a picked .mkv to Media's composer attachments with the viewer's own token, as it is picked;
// the form then carries the id in `attachments` and no file bytes; a box without a viewer token keeps the plain upload;
// and a comment's video plays in the network's player (player.js loaded by ov-thread.js). Skipped without Chrome.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
const thread = require('../thread');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('comment-video-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const ATT = 'att_01JZ0M0Q8F3K2V7YB6N4T5R9WQ';
const at = (p) => `https://openvibe.media/a/${ATT}/${p}`;
const answer = {
    thread: { id: 'cth_1', access_id: 'cth_1', comment_count: 1 },
    comments: [{ id: 3, message: 'My clip', created_at: '2026-11-13T00:00:00Z', author: { username: 'kim' },
        attachments: [{ id: ATT, kind: 'video', name: 'clip.mkv', url: at('clip.mkv'), poster: at('thumb.jpg'), playback: { url: at('playback.mp4'), mime: 'video/mp4', ready: true }, duration_s: 12, width: 640, height: 360 }] }],
};
const HTML = thread.renderThread({ answer, base: '/p', post: '/p/c', remove: '/p/r', signedIn: true, attachmentsAllowed: true, mediaAttachments: true });
// The page stands Media in: XMLHttpRequest to openvibe.media answers an attachment, and records what it was sent.
const FAKE_XHR = `<script>
window.__sent = [];
window.OpenVibeNavbar = { viewerToken: function () { return window.__token || ''; } };
(function () {
    var Real = window.XMLHttpRequest;
    function Fake() { this.upload = {}; this.headers = {}; this.status = 0; this.responseText = ''; }
    Fake.prototype.open = function (m, u) { this.method = m; this.url = u; };
    Fake.prototype.setRequestHeader = function (k, v) { this.headers[k.toLowerCase()] = v; };
    Fake.prototype.send = function (body) {
        var self = this, file = body && body.get ? body.get('file') : null;
        window.__sent.push({ method: self.method, url: self.url, auth: self.headers.authorization || '', name: file && file.name, size: file && file.size });
        setTimeout(function () {
            if (self.upload.onprogress) self.upload.onprogress({ lengthComputable: true, loaded: 5, total: 10 });
            self.status = 201; self.responseText = JSON.stringify({ id: '${ATT}', kind: 'video', status: 'processing' });
            self.onload && self.onload();
        }, 30);
    };
    window.XMLHttpRequest = function () { return new Fake(); };
    window.XMLHttpRequest.Real = Real;
})();
</script>`;
let posted = null;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (req.method === 'POST' && u.pathname === '/p/c') {
        const chunks = [];
        req.on('data', (d) => chunks.push(d));
        req.on('end', () => {
            const body = Buffer.concat(chunks).toString('latin1');
            posted = {
                attachments: [...body.matchAll(/name="attachments"\r?\n\r?\n([^\r]*)/g)].map((m) => m[1]),
                fileBytes: /filename="clip\.mkv"/.test(body),
                message: (body.match(/name="message"\r?\n\r?\n([^\r]*)/) || [])[1] || '',
            };
            res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><p id="posted">posted</p>');
        });
        return;
    }
    if (u.pathname === '/' || u.pathname === '/anon') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Clip</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/thread.css"><link rel="stylesheet" href="/thread-inline.css">${FAKE_XHR}<script>window.__token = ${u.pathname === '/' ? "'viewer-token'" : "''"};</script></head><body style="margin:0;padding:16px;background:#0b1220;color:#e6edf7;font-family:sans-serif"><div data-ovt data-ovc-thread>${HTML}</div><script src="/ov-composer.js"></script><script src="/ov-thread.js"></script></body></html>`);
    }
    const file = u.pathname.slice(1);
    if (['thread.css', 'thread-inline.css', 'ov-composer.js', 'ov-thread.js', 'player.js', 'player.css'].includes(file)) {
        res.writeHead(200, { 'content-type': file.endsWith('.css') ? 'text/css' : 'application/javascript' });
        return res.end(fs.readFileSync(path.join(root, file)));
    }
    res.writeHead(404); res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'comment-video-')) });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let page;
    const until = async (expr, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await page.evaluate(expr); if (v) return v; await wait(40); } return false; };
    const pick = `(() => { const f = document.querySelector('form.ovc-v2[data-preset="comment"]'); const c = f.__ovc && (f.__ovc.ctx || f.__ovc); c.add([new File([new Uint8Array(4096)], 'clip.mkv', { type: '' })]); return true; })()`;
    try {
        page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 900 });
        await page.goto(base + '/', { maxMs: 6000 });
        assert.ok(await until(`!!document.querySelector('form.ovc-v2[data-preset="comment"][data-ovc-media]')`), 'the comment box is the shared composer, marked for Media');
        // The player: ov-thread.js loads it for the comment's video.
        assert.ok(await until(`!!window.OpenVibePlayer && !!document.querySelector('.ov-player video[data-ov-player]')`), 'the comment\'s video is in the network\'s player');
        assert.equal(await page.evaluate(`document.querySelector('video[data-ov-player]').getAttribute('src')`), at('playback.mp4'));
        assert.equal(await page.evaluate(`document.documentElement.scrollWidth`), 390, 'the video never widens the page');
        // A picked .mkv (no type from the browser: the extension decides) goes to Media at once, with the viewer's token.
        await page.evaluate(pick);
        assert.ok(await until(`window.__sent.length === 1`), 'the file went to Media as it was picked');
        const sent = await page.evaluate(`window.__sent[0]`);
        assert.deepEqual(sent, { method: 'POST', url: 'https://openvibe.media/api/v1/attachments', auth: 'Bearer viewer-token', name: 'clip.mkv', size: 4096 });
        assert.ok(await until(`[...document.querySelectorAll('form.ovc-v2 input[name=attachments]')].map((i) => i.value).join() === '${ATT}'`), 'the form carries the id');
        await page.evaluate(`(() => { const t = document.querySelector('form.ovc-v2 textarea'); t.value = 'Here it is'; t.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('form.ovc-v2 [data-ovt-send]').click(); })()`);
        await until(`!!document.getElementById('posted')`);
        assert.ok(posted, 'the form posted to the page\'s action');
        assert.deepEqual(posted, { attachments: [ATT], fileBytes: false, message: 'Here it is' }, 'the id, the words, and no bytes');
        await page.close();

        // No viewer token: nothing goes to Media; the file stays in the form, the plain upload.
        page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 900 });
        await page.goto(base + '/anon', { maxMs: 6000 });
        assert.ok(await until(`!!document.querySelector('form.ovc-v2[data-preset="comment"]')`));
        await page.evaluate(pick);
        await wait(300);
        assert.equal(await page.evaluate(`window.__sent.length`), 0, 'no token, no call to Media');
        assert.equal(await page.evaluate(`[...document.querySelectorAll('form.ovc-v2 input[type=file]')].reduce((n, i) => n + i.files.length, 0)`), 1, 'the file rides the form');
        await page.close();
        console.log('comment-video-chrome: a picked video goes to Media with the viewer\'s token, the form sends its id, and the comment plays it');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
