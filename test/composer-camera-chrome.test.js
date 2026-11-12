'use strict';
// The composer's camera, retry and resize (ov-composer.js 4.217.0) in a real headless Chrome at 390 px:
//   - an agent's box has the camera; it opens a sheet over the page through the shared capture core (ov-capture.js,
//     loaded from beside the composer), says what to do when no camera opens, and closes with nothing kept;
//   - a failed upload shows Try again on its chip, and a press uploads it again;
//   - a big picture is made smaller before it uploads (an agent's 1568 px on its long side, a post's 2560).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('composer-camera-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (['/ov-composer.js', '/ov-window.js', '/ov-capture.js'].includes(u)) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, u.slice(1)))); }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="margin:0;padding:16px;background:#0b1220;color:#e6edf7;font-family:sans-serif"><div id="a"></div><div id="b"></div>
<script src="/ov-composer.js"></script>
<script>
window.sent = []; window.tries = 0;
const C = OpenVibeComposer;
// An upload that fails the first time and works the second; it records the picture's size as it arrived.
const upload = async (file, progress) => {
    window.tries++;
    if (file.type.startsWith('image/')) { const b = await createImageBitmap(file); window.sent.push([b.width, b.height]); }
    progress(0.5);
    if (window.tries === 1) throw new Error('The network dropped');
    return { id: 'att_' + window.tries };
};
window.agent = C.mount(document.getElementById('a'), { preset: 'agent', id: 'g1', upload, onSubmit: async () => true });
window.post = C.mount(document.getElementById('b'), { preset: 'post', id: 'p1', user: { display_name: 'goosely' }, onSubmit: async () => true });
window.bigPicture = async (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#3b82f6'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(w / 4, h / 4, w / 2, h / 2);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95)); return new File([blob], 'big.jpg', { type: 'image/jpeg' }); };
</script>`);
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'composer-camera-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 900 });
        await page.goto(base + '/', { maxMs: 5000 });
        const until = async (expr, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await page.evaluate(expr); if (v) return v; await wait(50); } return false; };
        assert.ok(await until(`!!window.post`), 'the composers mount');

        // The camera: an agent's box and a post have it.
        const tools = await page.evaluate(`[...document.querySelectorAll('.ovc-v2')].map((f) => [...f.querySelectorAll('.ovt-c-tools .ovt-btn')].map((b) => b.getAttribute('aria-label')).filter((l) => l !== 'Speak' && l !== 'More: attach, timer and tools'))`);
        assert.deepEqual(tools[0].slice(0, 2), ['Attach', 'Camera'], 'an agent: attach and the camera');
        assert.ok(tools[1].includes('Camera'), 'a post: the camera beside photos');
        assert.equal(await page.evaluate(`document.getElementById('g1').getAttribute('data-ovc-resize')`), '1568');
        assert.equal(await page.evaluate(`document.getElementById('p1').getAttribute('data-ovc-resize')`), '2560');

        // It opens a sheet through the shared core (loaded from beside the composer). Headless Chrome has no camera, so
        // the sheet says what to do instead of failing silently; Close takes it away.
        await page.evaluate(`document.querySelector('#g1 .ovc-t-camera').click()`);
        assert.ok(await until(`!!document.querySelector('dialog.ovc-cam[open]')`), 'the camera sheet opens');
        assert.ok(await until(`!!window.OVCapture && window.OVCapture.version >= 2`), 'the shared capture core loaded from beside the composer');
        assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.ovc-cam [data-m]')].map((b) => b.textContent)`), ['Photo', 'Video']);
        assert.ok(await until(`(() => { const m = document.querySelector('.ovc-cam-msg'); const v = document.querySelector('.ovc-cam-v'); return (m && !m.hidden && m.textContent.length > 10) || (v && v.srcObject); })()`), 'the picture, or plain words about the camera');
        assert.equal(await page.evaluate(`document.querySelector('.ovc-cam').getBoundingClientRect().width`), 390, 'the whole screen on a phone');
        await page.evaluate(`document.querySelector('.ovc-cam [data-a="close"]').click()`);
        assert.ok(await until(`!document.querySelector('dialog.ovc-cam')`), 'Close takes it away');
        assert.equal(await page.evaluate(`agent.files().length`), 0, 'and nothing was added');

        // A big picture shrinks to the agent's 1568 px before it uploads; the first upload fails, Try again sends it.
        await page.evaluate(`(async () => { agent.ctx.add([await bigPicture(4000, 3000)]); })()`);
        assert.ok(await until(`!!document.querySelector('#g1 .ovc-file.is-bad [data-ovc-retry]')`), 'a failed upload offers Try again');
        assert.deepEqual(await page.evaluate(`window.sent[0]`), [1568, 1176], 'the picture went at 1568 px on its long side');
        await page.evaluate(`document.querySelector('#g1 [data-ovc-retry]').click()`);
        assert.ok(await until(`agent.uploads().join() === 'att_2' && !document.querySelector('#g1 .ovc-file.is-bad')`), 'Try again uploaded it');
        assert.equal(await page.evaluate(`document.querySelector('#g1 input[type=hidden][name=attachments]').value`), 'att_2', 'its id goes with the form');
        // A small picture is left as it is.
        await page.evaluate(`(async () => { agent.ctx.add([await bigPicture(800, 600)]); })()`);
        assert.ok(await until(`window.sent.length === 3`));
        assert.deepEqual(await page.evaluate(`window.sent[2]`), [800, 600], 'a picture under the limit is not touched');

        assert.equal(await page.evaluate(`document.documentElement.scrollWidth`), 390);
        await page.close();
        console.log('composer-camera-chrome: the camera through the shared core, Try again on a failed upload, pictures made smaller before they go');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
