'use strict';
// "Caption it" (4.228.0; the owner, 11-12: "auto caption using OpenVibe.Exchange, using the AI features … like some
// Instagram"): in a real headless Chrome, on thread.composer()'s own markup, a picture's chip has ✨; a tap sends the
// picture, made small (JPEG, 768 px at most), to the Frame's /api/frame/caption with the person's session, the caption
// fills an empty box and ovc:caption carries the alt text; a box that has words keeps them; a text file has no ✨;
// data-ovc-caption="off" leaves it out; a refusal is said in the box's note.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('composer-caption-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const thread = require('../thread');
const box = (id) => thread.composer({ action: '/send', id, placeholder: 'Add a comment', maxlength: 600, attach: { menu: true, accept: 'image/*,text/plain,.md' } });
const asked = [];
let refuse = false;
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    const file = { '/ov-composer.js': 'application/javascript', '/ov-window.js': 'application/javascript', '/thread.css': 'text/css' }[u];
    if (file) { res.writeHead(200, { 'content-type': file }); return res.end(fs.readFileSync(path.join(root, u.slice(1)))); }
    if (u === '/api/frame/caption' && req.method === 'POST') {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
            asked.push({ body: JSON.parse(body), cookie: req.headers.cookie || '', auth: req.headers.authorization || '' });
            res.writeHead(refuse ? 402 : 200, { 'content-type': 'application/json' });
            res.end(JSON.stringify(refuse ? { error: 'Your free AI allowance for today is used up' } : { alt: 'A small blue square on white', caption: 'Minimalism, but make it blue.', tags: ['blue', 'square'] }));
        });
        return;
    }
    res.writeHead(200, { 'content-type': 'text/html', 'set-cookie': 'ov_token=person; Path=/' });
    const frame = `http://127.0.0.1:${server.address().port}`;
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/thread.css">
<body style="margin:0;background:#0b1220;color:#e6edf7;font-family:sans-serif"><div class="ovt" data-ovt style="padding:40px 16px">${box('c1').replace('<form ', `<form data-ovc-frame="${frame}" `)}${box('c2').replace('<form ', `<form data-ovc-caption="off" data-ovc-frame="${frame}" `)}</div>
<script>window.captions = []; document.getElementById('c1').addEventListener('ovc:caption', (e) => window.captions.push({ alt: e.detail.alt, caption: e.detail.caption, tags: e.detail.tags }));</script>
<script src="/ov-composer.js"></script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-caption-'));
    const browser = await h.launch({ tmpDir });
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 800 });
        await page.goto(base + '/', { maxMs: 5000 });
        await h.eventually(async () => assert.equal(await page.evaluate(`!!(document.getElementById('c1').__ovc && document.getElementById('c2').__ovc)`), true));
        const paste = (id, name, type, b64) => page.evaluate(`(async () => { const t = document.querySelector('#${id} textarea'); const dt = new DataTransfer();
            let blob;
            if ('${type}' === 'image/png') { const c = document.createElement('canvas'); c.width = 40; c.height = 30; const g = c.getContext('2d'); g.fillStyle = '#2563eb'; g.fillRect(0, 0, 40, 30); blob = await new Promise((r) => c.toBlob(r, 'image/png')); }
            else blob = new Blob([Uint8Array.from(atob('${b64}'), (ch) => ch.charCodeAt(0))], { type: '${type}' });
            dt.items.add(new File([blob], '${name}', { type: '${type}' }));
            t.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return true; })()`);
        await paste('c1', 'square.png', 'image/png', '');
        await paste('c1', 'notes.md', 'text/markdown', Buffer.from('# notes').toString('base64'));
        await paste('c2', 'square.png', 'image/png', '');
        await h.eventually(async () => assert.equal(await page.evaluate(`document.querySelectorAll('#c1 .ovc-file').length`), 2));
        const buttons = await page.evaluate(`[...document.querySelectorAll('.ovc-file')].map((c) => [c.closest('form').id, c.querySelector('.ovc-file-n').textContent, !!c.querySelector('[data-ovc-caption]')])`);
        assert.deepEqual(buttons, [['c1', 'square.png', true], ['c1', 'notes.md', false], ['c2', 'square.png', false]], 'a picture has ✨; a text file and a box with captions off do not');
        assert.equal(await page.evaluate(`document.querySelector('#c1 [data-ovc-caption]').getAttribute('aria-label')`), 'Caption it with AI');

        await page.evaluate(`document.querySelector('#c1 [data-ovc-caption]').click(), true`);
        await h.eventually(async () => assert.equal(await page.evaluate(`document.querySelector('#c1 textarea').value`), 'Minimalism, but make it blue.', `asked ${asked.length}, note: ${await page.evaluate(`(document.querySelector('#c1 [data-ovt-note]') || {}).textContent || '(no note)'`)}`), { timeout: 8000 });
        assert.equal(asked.length, 1);
        assert.match(asked[0].body.image.data_url, /^data:image\/jpeg;base64,/, 'a small JPEG goes, not the original file');
        assert.ok(asked[0].cookie.includes('ov_token=person'), 'with the person\'s session');
        assert.deepEqual(await page.evaluate(`window.captions`), [{ alt: 'A small blue square on white', caption: 'Minimalism, but make it blue.', tags: ['blue', 'square'] }], 'ovc:caption carries the alt text');
        assert.equal(await page.evaluate(`document.getElementById('c1').__ovc.ctx.alt(document.getElementById('c1').__ovc.files()[0])`), 'A small blue square on white', 'ctx.alt(file)');
        assert.equal(await page.evaluate(`!!document.querySelector('#c1 [data-ovc-caption]:not(.is-busy)')`), true, 'the button is ready again');

        // With the bar's token (any OpenVibe site), it goes as the Bearer, not a cookie.
        await page.evaluate(`window.OpenVibeNavbar = { token: () => 'tok_person_abcdefghijklmnop' }; document.querySelector('#c1 textarea').value = ''; true`);
        await page.evaluate(`document.querySelector('#c1 [data-ovc-caption]').click(), true`);
        await h.eventually(async () => assert.equal(asked.length, 2));
        assert.equal(asked[1].auth, 'Bearer tok_person_abcdefghijklmnop', 'the bar\'s token as the Bearer');
        await h.eventually(async () => assert.equal(await page.evaluate(`!!document.querySelector('#c1 [data-ovc-caption]:not(.is-busy)')`), true));
        // Words already in the box stay; a refusal is said in the note.
        await page.evaluate(`(() => { const t = document.querySelector('#c1 textarea'); t.value = 'mine'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        refuse = true;
        await page.evaluate(`document.querySelector('#c1 [data-ovc-caption]').click(), true`);
        await h.eventually(async () => assert.match(await page.evaluate(`document.querySelector('#c1 [data-ovt-note]') ? document.querySelector('#c1 [data-ovt-note]').textContent : ''`), /allowance/));
        assert.equal(await page.evaluate(`document.querySelector('#c1 textarea').value`), 'mine', 'the person\'s words stay');
        await page.close();
        console.log('composer-caption-chrome: ✨ on a picture, a small JPEG with the session, the caption in an empty box, the alt text in ovc:caption, off where asked, a refusal said');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
