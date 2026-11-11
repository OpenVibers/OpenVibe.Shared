'use strict';
// The one tooltip (ov-tip.js, 4.193.0) in a real headless Chrome: it shows for a mouse after a short rest, under what
// it names and on the screen (above when there is no room below), with its quiet second line; the keyboard's focus
// shows it at once; a press, Escape or leaving hides it; an opened button shows none; it is hidden from assistive
// technology (the element keeps its own name).
const assert = require('node:assert/strict');
const { eventually } = require('../browser-harness');   // a check retries until the page is there (5 s ceiling)
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('ov-tip-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
    if (req.url.split('?')[0] === '/ov-tip.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'ov-tip.js'))); }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;height:600px">
<button id="a" aria-label="Sign in" data-ov-tip="Sign in" style="position:fixed;right:6px;top:8px;width:36px;height:36px"></button>
<button id="b" aria-label="Menu" data-ov-tip="Menu" data-ov-tip-sub="This site, search, every OpenVibe site" style="position:fixed;right:60px;top:8px;width:36px;height:36px"></button>
<button id="low" aria-label="People online" data-ov-tip="3 online" data-ov-tip-sub="in the last 30 minutes" style="position:fixed;left:200px;bottom:6px;width:80px;height:30px"></button>
<button id="open" aria-label="Open" aria-expanded="true" data-ov-tip="Never shown while open" style="position:fixed;left:20px;top:8px;width:36px;height:36px"></button>
<script src="/ov-tip.js"></script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-tip-'));
    const browser = await h.launch({ tmpDir });
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 800, height: 600 });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 5000 });
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const until = async (expr) => { const end = Date.now() + 4000; while (Date.now() < end) { if (await page.evaluate(expr)) return true; await wait(40); } return false; };
        const move = (x, y) => page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, pointerType: 'mouse' });
        const ON = `!!document.querySelector('.ovtip.is-on')`;
        const READ = (id) => `(() => { const t = document.querySelector('.ovtip'), r = t.getBoundingClientRect(), e = document.getElementById('${id}').getBoundingClientRect();
            return { text: t.firstChild.textContent, sub: (t.querySelector('.ovtip-sub') || {}).textContent || '', under: r.top >= e.bottom, above: r.bottom <= e.top, left: r.left, right: innerWidth - r.right, lines: Math.round(r.height), hidden: t.getAttribute('aria-hidden') }; })()`;

        // A mouse resting on the button at the right edge: the tooltip, after a moment, under it and on the screen.
        await move(782, 26);
        await eventually(async () => assert.equal(await page.evaluate(ON), false, 'not at once: a pointer passing over shows nothing'));
        assert.ok(await until(ON), 'after a short rest it shows');
        await wait(260);
        const a = await page.evaluate(READ('a'));
        assert.deepEqual([a.text, a.sub, a.under, a.hidden], ['Sign in', '', true, 'true']);
        assert.ok(a.right >= 7 && a.left >= 7, `kept on the screen though its button is at the edge (${JSON.stringify(a)})`);
        // On to its neighbour: the next one shows at once, with its second line, and is not squeezed by where the last stood.
        await move(722, 26);
        assert.ok(await until(`(document.querySelector('.ovtip.is-on') || {}).textContent === 'MenuThis site, search, every OpenVibe site'`), 'moving to the next shows it without the wait');
        await wait(260);
        const b = await page.evaluate(READ('b'));
        assert.deepEqual([b.text, b.sub, b.under], ['Menu', 'This site, search, every OpenVibe site', true]);
        assert.ok(b.lines < 60, `its two lines are two lines, not a column squeezed against the edge (${b.lines}px tall)`);
        // Leaving hides it; a press hides it.
        await move(400, 300);
        assert.ok(await until(`!${ON}`), 'leaving hides it');
        await move(722, 26); assert.ok(await until(ON));
        await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 722, y: 26, button: 'left', clickCount: 1 });
        await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 722, y: 26, button: 'left', clickCount: 1 });
        assert.ok(await until(`!${ON}`), 'a press hides it');
        await move(400, 300); await wait(600);
        // Near the bottom of the screen it opens above.
        await move(240, 580);
        assert.ok(await until(ON));
        await wait(260);
        const low = await page.evaluate(READ('low'));
        assert.deepEqual([low.text, low.sub, low.above], ['3 online', 'in the last 30 minutes', true], 'above when there is no room below');
        await move(400, 300); await wait(600);
        // An opened button shows none.
        await move(38, 26); await wait(700);
        await eventually(async () => assert.equal(await page.evaluate(ON), false, 'a button whose panel is open shows no tooltip'));
        await move(400, 300);
        // The keyboard: focus shows it at once; Escape hides it.
        await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        assert.ok(await until(ON), 'the keyboard\'s focus shows it');
        await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        assert.ok(await until(`!${ON}`), 'Escape hides it');
        console.log('ov-tip-chrome: after a rest for a mouse, at once for the next and for the keyboard, under or above, on the screen, two lines whole, hidden by leaving, a press and Escape');
    } finally { await browser.close(); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((err) => { console.error(err); process.exit(1); });
