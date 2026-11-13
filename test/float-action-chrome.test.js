'use strict';
// OVFloat.action (4.239.0) in a real headless Chrome on a phone-sized page: a button with its home in the middle of a
// long page floats at the bottom while its home is off screen (before the person reaches it and after they pass it),
// above a fixed bottom bar, and comes back to its home when the home is on screen. It is one element the whole time
// (never a copy, never hidden), its home keeps the space, it rises above a footer that comes up, `ov:fab` says when
// it moves, `when()` can keep it home, and destroy() puts it back as it was (the owner, 11-13: "it's one button, it's
// not jumping around, it's transitioning").
//
//   node test/float-action-chrome.test.js
const assert = require('node:assert/strict');
const { eventually, launch, openPage, findChrome } = require('../browser-harness');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
if (process.env.OV_SKIP_BROWSER === '1' || !findChrome()) { console.log('float-action-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
    if (req.url.startsWith('/ov-float.js')) {
        res.writeHead(200, { 'content-type': 'application/javascript' });
        return res.end(fs.readFileSync(path.join(root, 'ov-float.js')));
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#111;color:#fff;font:16px system-ui}.pad{height:1400px}#card{padding:20px;background:#222}
#act{display:block;width:260px;height:52px;margin:0 auto;border:0;border-radius:14px;background:#3b82f6;color:#fff;font:700 17px system-ui}
#bar{position:fixed;left:0;right:0;bottom:0;height:64px;background:#000}#ov-footer{height:300px;background:#333}</style>
<div class="pad"></div><div id="card"><p>Turn on your camera to go live</p><div id="act-wrap"><button id="act" type="button">Turn on camera</button></div></div>
<div class="pad"></div><footer id="ov-footer">footer</footer><nav id="bar" data-ov-bottom-bar></nav>
<script src="/ov-float.js"></script>
<script>
window.moves = [];
window.allow = true;
document.addEventListener('ov:fab', (e) => window.moves.push(e.detail.floating));
window.a = OVFloat.action(document.getElementById('act'), { when: () => window.allow });
</script>`);
});

(async () => {
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-fab-'));
    const browser = await launch({ tmpDir });
    try {
        const p = await openPage(browser, await browser.newContext(), { width: 390, height: 844, mobile: true });
        await p.goto(`${base}/`, { maxMs: 5000 });
        const st = () => p.evaluate(`(() => { const b = document.getElementById('act'), r = b.getBoundingClientRect(), h = document.querySelector('.ov-fab-home').getBoundingClientRect();
            return { count: document.querySelectorAll('#act').length, fab: b.dataset.ovFab, pos: getComputedStyle(b).position, visible: getComputedStyle(b).display !== 'none' && r.width > 0,
              bottomGap: Math.round(innerHeight - r.bottom), homeH: Math.round(h.height), w: Math.round(r.width), centred: Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 2 }; })()`);

        // Before the person reaches it: floating, above the 64 px bar, the same width, centred; its home keeps 52 px.
        await eventually(async () => assert.equal((await st()).fab, 'floating', 'before its home: it floats'));
        let s = await st();
        assert.deepEqual([s.count, s.pos, s.visible, s.homeH, s.w, s.centred], [1, 'fixed', true, 52, 260, true], 'one element, fixed, its home holds the space');
        assert.ok(s.bottomGap >= 64 + 12 - 1 && s.bottomGap <= 64 + 12 + 4, `above the bar with a 12 px gap (${s.bottomGap})`);

        // Its home on screen: back home, in the page.
        await p.evaluate(`document.getElementById('card').scrollIntoView({ block: 'center' }), true`);
        await eventually(async () => assert.equal((await st()).fab, 'home', 'its home on screen: back home'));
        s = await st();
        assert.deepEqual([s.count, s.pos, s.visible], [1, 'static', true], 'the same element, in the page');

        // Past it: floating again; at the end of the page it rises above the footer.
        await p.evaluate(`window.scrollTo(0, document.getElementById('card').offsetTop + 600), true`);
        await eventually(async () => assert.equal((await st()).fab, 'floating', 'past its home: it floats'));
        await p.evaluate(`window.scrollTo(0, document.body.scrollHeight), true`);
        await eventually(async () => {
            const r = await p.evaluate(`(() => { const b = document.getElementById('act').getBoundingClientRect(), f = document.getElementById('ov-footer').getBoundingClientRect(); return { b: Math.round(b.bottom), f: Math.round(f.top) }; })()`);
            assert.ok(r.b <= r.f - 10, `above the footer (${r.b} vs ${r.f})`);
        });

        // when() can keep it home; ov:fab said every move; destroy() puts it back as it was.
        await p.evaluate(`window.allow = false, window.a.check(), true`);
        await eventually(async () => assert.equal((await st()).fab, 'home', 'when() false: home'));
        assert.deepEqual(await p.evaluate('window.moves'), [true, false, true, false], 'ov:fab for each move');
        await p.evaluate(`window.a.destroy(), true`);
        assert.equal(await p.evaluate(`!document.querySelector('.ov-fab-home') && document.getElementById('act').parentNode.id`), 'act-wrap', 'destroy() puts it back');
        console.log('float-action-chrome: one element floats while its home is away, above the bar and the footer, and comes home ok');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
