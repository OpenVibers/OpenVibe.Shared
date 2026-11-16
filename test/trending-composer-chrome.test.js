'use strict';
// The shared composer's search gets the shared suggestions (4.284.0; the owner, 11-16: "the suggestions, like animated
// effects, like that's shared with the other sites … the same composer across sites"). In real headless Chrome:
//   a <textarea name="q"> in a GET form (the shared composer as a search) is a search box: its placeholder gives way to
//   the line;
//   a page's own list in markup (data-ov-trending-items on the form) is what rotates, never the network's trending
//   people, and focus opens it as chips;
//   in a tall composer the line sits on the textarea's first line, one line tall, not centred in the whole box.
// Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('trending-composer-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Composer</title><link rel="icon" href="data:,">
<style>body{margin:0;font:16px/1.4 sans-serif;padding:16px}textarea{box-sizing:border-box;font:inherit;line-height:22px;border:1px solid #888;border-radius:14px;padding:12px 14px;width:320px;resize:none}</style>
<script>window.OV_TRENDING_API = location.origin + '/api/frame';</script></head>
<body>
<form action="/models" method="get" data-ov-trending-items='["GPT-5 nano","DeepSeek V4.1 Flash","Qwen3 32B"]' onsubmit="event.preventDefault()"><label for="one">Search models</label><textarea id="one" name="q" rows="1" placeholder="Find a model" style="height:48px"></textarea></form>
<form action="/search" method="get" onsubmit="event.preventDefault()"><textarea id="tall" name="q" rows="3" placeholder="Search" style="height:96px"></textarea></form>
<script src="/ov-trending.js"></script>
</body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (u.pathname === '/ov-trending.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, 'ov-trending.js'))); }
    if (u.pathname === '/api/frame/trending') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ trending: [{ query: 'GraveGateKeeper' }, { query: 'synthesizers' }] })); }
    if (u.pathname === '/api/frame/searched') { res.writeHead(204); return res.end(); }
    res.writeHead(404); return res.end();
});

const STATE = (id) => `(() => { const i = document.getElementById(${JSON.stringify(id)}); const g = i.nextElementSibling && i.nextElementSibling.classList.contains('ovt-ghost') ? i.nextElementSibling : null;
    const line = g && !g.hidden ? g.querySelector('.ovt-line:last-child') : null;
    const b = i.getBoundingClientRect(), cs = getComputedStyle(i);
    return { ghost: !!g && !g.hidden, text: line ? line.textContent : '', placeholder: i.getAttribute('placeholder'),
        h: g ? Math.round(parseFloat(g.style.height)) : 0, top: g && !g.hidden ? Math.round(g.getBoundingClientRect().top - (b.top + i.clientTop + parseFloat(cs.paddingTop))) : null }; })()`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-trending-comp-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await p.goto(`${base}/`, { maxMs: 6000 });
        let s = null;
        for (let i = 0; i < 60; i++) { s = await p.evaluate(STATE('one')); if (s.ghost && s.text) break; await wait(50); }
        assert.ok(s.ghost && ['GPT-5 nano', 'DeepSeek V4.1 Flash', 'Qwen3 32B'].includes(s.text), `the composer's search rotates the page's own list (${JSON.stringify(s)})`);
        assert.ok(!/GraveGateKeeper|synthesizers/.test(s.text), 'never the network\'s trending in a box with its own list');
        assert.strictEqual(s.h, 22, 'one line tall');
        let t = null;
        for (let i = 0; i < 60; i++) { t = await p.evaluate(STATE('tall')); if (t.ghost && t.text) break; await wait(50); }
        assert.ok(t.ghost && t.text, `a plain composer search gets the shared suggestions (${JSON.stringify(t)})`);
        assert.deepStrictEqual([t.h, t.top], [22, 0], `in a tall composer the line is the first line, at the top (${JSON.stringify(t)})`);
        await p.evaluate("document.getElementById('one').focus(), 1");
        let chips = [];
        for (let i = 0; i < 40; i++) { chips = await p.evaluate("[...document.querySelectorAll('.ovt-chips .ovt-chip')].map((c) => c.textContent.trim())"); if (chips.length) break; await wait(50); }
        assert.ok(chips.length === 3 && chips.includes('Qwen3 32B'), `focus opens the page's own list as chips (${chips})`);
        console.log(`trending-composer-chrome: the composer's search rotates "${s.text}" from its page's list, one line tall; a tall composer's line is its first line; chips on focus: ${chips.join(', ')}`);
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
