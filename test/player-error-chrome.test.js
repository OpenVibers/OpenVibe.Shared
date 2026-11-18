'use strict';
// A video that cannot be played (4.317.0; the owner's phone, 11-18: "This video could not be played" printed across the
// play button, "improve"): the big play button stands down and a card says what happened, with Try again, which loads
// the source again (and the card comes back when it fails again). Real headless Chrome at 390 px.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('player-error-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
let tries = 0;
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Player</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,">
<link rel="stylesheet" href="/player.css"></head><body style="margin:0;background:#0b0f19;color:#fff">
<video data-ov-player controls preload="metadata" playsinline src="/missing.mp4" style="width:100%;aspect-ratio:16/9"></video>
<script src="/player.js"></script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (u.pathname === '/missing.mp4') { tries++; res.writeHead(404); return res.end(); }
    const name = u.pathname.slice(1);
    if (/^player\.(js|css)$/.test(name)) { res.writeHead(200, { 'content-type': name.endsWith('.js') ? 'application/javascript' : 'text/css' }); return res.end(fs.readFileSync(path.join(ROOT, name))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-player-err-'));
    const browser = await h.launch({ tmpDir });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 700 });
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        const CARD = `(() => { const r = document.querySelector('.ov-player'); const m = r && r.querySelector('.ov-player-message'); const big = r && r.querySelector('.ov-player-big');
            const again = m && m.querySelector('.ov-player-again'); const box = m ? m.getBoundingClientRect() : null;
            return r ? { error: r.classList.contains('is-error'), words: m ? m.textContent : '', again: !!again, sign: !!(m && m.querySelector('.ov-player-err-sign svg')),
                big: big ? getComputedStyle(big).opacity : null, w: box ? Math.round(box.width) : 0 } : null; })()`;
        const first = await h.eventually(async () => {
            const x = await p.evaluate(CARD);
            assert.ok(x && x.error && x.again && x.sign && /could not be played|offline/.test(x.words), `a card says it, with Try again (${JSON.stringify(x)})`);
            return x;
        }, { timeout: 15000 });
        await h.eventually(async () => assert.strictEqual(await p.evaluate(`(${CARD}).big`), '0', 'the play button stands down'), { timeout: 3000 });
        assert.ok(first.w >= 200 && first.w <= 320, `a card, not a strip across the picture (${first.w} px)`);
        const before = tries;
        await p.evaluate("document.querySelector('.ov-player-again').click(), 1");
        await h.eventually(async () => assert.ok(tries > before, `Try again loads the source again (${tries} reads)`), { timeout: 5000 });
        await h.eventually(async () => { const x = await p.evaluate(CARD); assert.ok(x && x.error && x.again, 'and says so again when it fails again'); }, { timeout: 15000 });
        console.log(`player-error-chrome: a ${first.w} px card with its sign, "${first.words.replace('Try again', '').trim()}" and Try again; the play button stands down; Try again reads the source again`);
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
