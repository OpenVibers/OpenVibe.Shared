'use strict';
// OpenVibe's own controls (4.230.0; the owner, 11-12: "improve the selection boxes … a more customized look … themed
// better with animations and effects for all inputs and buttons"), in a real headless Chrome with ov-forms.css alone:
// a checkbox and a radio are drawn (no native look) and their mark scales in when checked; a switch stays a switch; a
// site's own rule wins (:where), data-ov-native keeps the browser's box, motion Off removes the transitions, and the
// mark needs no picture (no url() in the stylesheet, so no page's image policy is involved). Skipped without Chrome.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('ov-forms-controls-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'ov-forms.css'), 'utf8');
assert.ok(!/url\(/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'no url() in ov-forms.css: the marks are drawn, not fetched');

const page = (motion) => `<!doctype html><html lang="en"${motion ? ` data-ov-motion="${motion}"` : ''}><head><meta charset="utf-8"><link rel="stylesheet" href="/ov-forms.css">
<style>.mine { width: 30px; height: 30px; }</style></head><body>
<input type="checkbox" id="on" checked><input type="checkbox" id="off"><input type="radio" id="r" checked><input type="checkbox" role="switch" id="sw" checked>
<input type="checkbox" id="mine" class="mine"><span data-ov-native><input type="checkbox" id="native"></span><button id="b">B</button><input id="t"></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/ov-forms.css') { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(css); }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(page(u.searchParams.get('motion')));
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-controls-'));
    const browser = await h.launch({ tmpDir });
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 400 });
        await p.goto(`${base}/`, { maxMs: 5000 });
        const cs = (id, prop, pseudo = null) => p.evaluate(`getComputedStyle(document.getElementById(${JSON.stringify(id)})${pseudo ? `, ${JSON.stringify(pseudo)}` : ''}).${prop}`);
        assert.equal(await cs('on', 'appearance'), 'none', 'a checkbox is drawn');
        assert.equal(await cs('on', 'width'), '18px');
        assert.equal(await cs('on', 'transform', '::before'), 'matrix(1, 0, 0, 1, 0, 0)', 'its check is shown when checked');
        assert.equal(await cs('off', 'transform', '::before'), 'matrix(0, 0, 0, 0, 0, 0)', 'and scaled away when not');
        assert.ok(/transform/.test(await cs('off', 'transitionProperty', '::before')), 'the check scales in');
        assert.equal(await cs('r', 'appearance'), 'none', 'a radio is drawn');
        assert.equal(await cs('r', 'borderTopLeftRadius'), '50%');
        assert.equal(await cs('sw', 'width'), '42px', 'a switch stays a switch');
        assert.equal(await cs('sw', 'transform', '::before'), 'none', 'a switch has no check mark');
        assert.equal(await cs('mine', 'width'), '30px', 'a site\'s own rule wins');
        assert.notEqual(await cs('native', 'appearance'), 'none', 'data-ov-native keeps the browser\'s box');
        assert.ok(/transform/.test(await cs('b', 'transitionProperty')), 'a button answers a press');
        await p.goto(`${base}/?motion=off`, { maxMs: 5000 });
        assert.equal(await cs('off', 'transitionDuration', '::before'), '0s', 'motion Off: the check does not move');
        assert.equal(await cs('b', 'transitionDuration'), '0s', 'motion Off: buttons do not move');
        await p.close();
        console.log('ov-forms-controls-chrome: drawn checkbox and radio, the check scales in, switch kept, site rules win, data-ov-native, no url(), motion Off');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
