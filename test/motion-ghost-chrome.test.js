'use strict';
// The ghost cursor (motion.js [data-ov-ghost], 4.106.0, MOTION-1) in a real headless Chrome: it walks a scene's steps in
// order and marks each one chosen (data-ov-ghost-on) in turn; the page stays its width; it is gone for good the moment
// the reader touches the scene; and under reduced motion there is no cursor at all. Skipped (exit 0) without Chrome or
// with OV_SKIP_BROWSER=1.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('motion-ghost-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const scene = (extra = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>ghost</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:40px 16px;font:15px system-ui}.pick{max-width:340px;display:grid;gap:8px}.row{display:block;padding:12px;border:1px solid #888}</style>
<script src="/motion.js" defer></script></head><body${extra}><div class="pick" data-ov-ghost>
<span class="row" data-ov-ghost-step="2">Second</span><span class="row" data-ov-ghost-step="1">First</span><span class="row" data-ov-ghost-step="3">Third</span>
</div></body></html>`;
const server = http.createServer((req, res) => {
    if (req.url === '/motion.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(__dirname, '..', 'motion.js'))); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(req.url === '/still' ? scene(' data-x="1"').replace('<html lang="en">', '<html lang="en" data-ov-motion="reduced">') : scene());
});

(async () => {
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-ghost-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const chosen = 'Array.from(document.querySelectorAll("[data-ov-ghost-on]")).map((e) => e.textContent).join(",")';
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390 });
        await p.goto(`${base}/`, { maxMs: 5000 });
        const seen = [];
        for (let k = 0; k < 40 && seen.length < 3; k++) {
            await wait(250);
            const now = await p.evaluate(chosen);
            if (now && now !== seen[seen.length - 1]) seen.push(now);
        }
        assert.deepStrictEqual(seen, ['First', 'Second', 'Third'], 'the steps in their numbered order, one chosen at a time');
        assert.strictEqual(await p.evaluate('!!document.querySelector(".ov-ghost[aria-hidden=true]")'), true, 'the cursor is there, hidden from assistive tech');
        assert.strictEqual(await p.evaluate('document.documentElement.scrollWidth'), 390, 'the page stays its width');
        await p.evaluate('document.querySelector(".row").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); 1');
        await wait(200);
        assert.strictEqual(await p.evaluate(`!document.querySelector(".ov-ghost") && ${chosen} === ""`), true, 'a touch ends it for good');

        const still = await h.openPage(browser, context, { width: 390 });
        await still.goto(`${base}/still`, { maxMs: 5000 });
        await wait(1500);
        assert.strictEqual(await still.evaluate('!document.querySelector(".ov-ghost") && document.querySelectorAll("[data-ov-ghost-on]").length === 0'), true, 'reduced motion: no cursor at all');
        const errors = p.state.errors.concat(still.state.errors).filter((e) => !/Failed to load resource/.test(e.text));
        assert.deepStrictEqual(errors, [], JSON.stringify(errors));
        console.log('motion-ghost-chrome: all checks passed');
    } finally {
        await browser.close().catch(() => {});
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
