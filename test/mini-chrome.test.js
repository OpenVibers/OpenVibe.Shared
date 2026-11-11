'use strict';
// The video that comes with you (mini.js, 4.192.0) in a real headless Chrome: the shared player's picture-in-picture
// button on a video that may come along takes the person to the front page, where the small player goes on from the
// same second with the video's title; it has the way back, and going back hands the second to the page's own player and
// draws nothing there; Close stops and forgets; on a phone it is a bar across the bottom; a page's own video starting
// closes it.
const assert = require('node:assert/strict');
const { eventually } = require('../browser-harness');   // a check retries until the page is there (5 s ceiling)
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('mini-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const file = (res, name, type) => { res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes' }); res.end(fs.readFileSync(path.join(root, name))); };
const page0 = (body) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test</title><body style="margin:0;min-height:900px;background:#0b1120;color:#fff">${body}`;
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/mini.js' || u === '/player.js') return file(res, u.slice(1), 'application/javascript');
    if (u === '/player.css') return file(res, 'player.css', 'text/css');
    if (u === '/clip.webm') return file(res, 'test/fixtures/ov-sync-clock.webm', 'video/webm');
    res.writeHead(200, { 'content-type': 'text/html' });
    if (u === '/watch') return res.end(page0(`<link rel="stylesheet" href="/player.css"><div style="width:640px"><video id="v" data-ov-player data-ov-mini data-ov-mini-title="The harbour at night" data-ov-mini-by="Kim" controls muted playsinline preload="auto" src="/clip.webm"></video></div><script src="/player.js"></script><script src="/mini.js"></script>`));
    if (u === '/second') return res.end(page0(`<video id="other" data-ov-player muted playsinline preload="auto" src="/clip.webm" style="width:320px"></video><script src="/mini.js"></script>`));
    return res.end(page0('<h1>Front page</h1><script src="/mini.js"></script>'));
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-mini-'));
    const browser = await h.launch({ tmpDir });
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 1100, height: 800 });
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const until = async (expr, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { let v = false; try { v = await page.evaluate(expr); } catch { v = false; } if (v) return v; await wait(60); } return false; };
        const take = async () => {
            await page.goto(`${base}/watch`, { maxMs: 6000 });
            assert.ok(await until(`!!document.querySelector('.ov-player-pip') && document.getElementById('v').readyState >= 1`), 'the watch page has its player');
            const dur = await page.evaluate(`document.getElementById('v').duration`);
            const at = Math.min(1.2, dur / 2);
            await page.evaluate(`(() => { const v = document.getElementById('v'); v.currentTime = ${at}; return v.play().catch(() => {}); })()`);
            assert.ok(await until(`document.getElementById('v').currentTime >= ${at}`), 'it plays');
            return at;
        };

        // The player's button, on a video that may come along: its label says what it does, and it leaves for the front page.
        let at = await take();
        const label = await page.evaluate(`(() => { const b = document.querySelector('.ov-player-pip'); return { hidden: b.hidden, label: b.getAttribute('aria-label') }; })()`);
        assert.deepEqual(label, { hidden: false, label: 'Keep watching while you browse' }, 'the button says what it does');
        await page.evaluate(`document.querySelector('.ov-player-pip').click()`);
        assert.ok(await until(`location.pathname === '/' && !!document.querySelector('.ovmini video')`), 'the front page, with the small player');
        const same = await until(`document.querySelector('.ovmini video').readyState >= 2 && document.querySelector('.ovmini video').currentTime >= ${at - 0.05}`);
        if (!same) console.error('mini video:', await page.evaluate(`(() => { const v = document.querySelector('.ovmini video'); return JSON.stringify({ ready: v.readyState, t: v.currentTime, dur: v.duration, paused: v.paused, err: v.error && v.error.code, rec: OpenVibeMini.record() && OpenVibeMini.record().t, at: ${at} }); })()`));
        assert.ok(same, 'it goes on from the same second');
        await wait(450);      // its entrance is over: it is measured where it rests
        const m = await page.evaluate(`(() => { const e = document.querySelector('.ovmini'), r = e.getBoundingClientRect(), v = e.querySelector('video');
            return { title: e.querySelector('.ovmini-title').textContent, by: e.querySelector('.ovmini-by').textContent, back: e.querySelector('.ovmini-pic').getAttribute('href'), left: r.left, bottom: innerHeight - r.bottom, width: r.width,
                label: e.getAttribute('aria-label'), playing: !v.paused, pause: e.querySelector('[data-m="play"]').getAttribute('aria-label'), rec: !!OpenVibeMini.record(), fixed: getComputedStyle(e).position }; })()`);
        assert.equal(m.title, 'The harbour at night'); assert.match(m.by, /^Kim · \d+:\d\d/);
        assert.deepEqual([m.back, m.label, m.fixed, m.rec], ['/watch', 'Still playing: The harbour at night', 'fixed', true]);
        assert.ok(m.left >= 16 && m.left <= 20 && m.bottom >= 16 && m.bottom <= 20 && Math.round(m.width) === 340, `bottom left on a computer, 340 wide (${JSON.stringify([m.left, m.bottom, m.width])})`);
        assert.deepEqual([m.playing, m.pause], [true, 'Pause'], 'it was playing, so it plays, and its button says Pause');
        // Pause from its button; the record keeps the second.
        await page.evaluate(`document.querySelector('.ovmini [data-m="play"]').click()`);
        assert.ok(await until(`document.querySelector('.ovmini video').paused && document.querySelector('.ovmini [data-m="play"]').getAttribute('aria-label') === 'Play' && OpenVibeMini.record().playing === false`), 'paused, and written down');

        // Another page of the site: it is there again, still paused, at its second.
        const second0 = await page.evaluate(`OpenVibeMini.record().t`);
        await page.goto(`${base}/second`, { maxMs: 6000 });
        assert.ok(await until(`!!document.querySelector('.ovmini video') && document.querySelector('.ovmini video').readyState >= 1`), 'it follows to the next page');
        assert.ok(await until(`Math.abs(document.querySelector('.ovmini video').currentTime - ${second0}) < 0.3 && document.querySelector('.ovmini video').paused`), 'at its second, paused as it was left');
        // That page's own video starting closes it: one sound at a time.
        await page.evaluate(`document.getElementById('other').play().catch(() => {})`);
        assert.ok(await until(`!document.querySelector('.ovmini:not(.is-leaving)') && OpenVibeMini.record() === null`), "the page's own video starting closes the small player and forgets it");

        // The way back: the video's own page takes the second, and draws no small player.
        at = await take();
        await page.evaluate(`OpenVibeMini.carry(document.getElementById('v'))`);
        assert.ok(await until(`location.pathname === '/' && !!document.querySelector('.ovmini video') && document.querySelector('.ovmini video').readyState >= 2`));
        await page.evaluate(`document.querySelector('.ovmini-text').click()`);
        assert.ok(await until(`location.pathname === '/watch' && !!document.getElementById('v') && document.getElementById('v').readyState >= 1`), 'back on its page');
        assert.ok(await until(`document.getElementById('v').currentTime >= ${at - 0.05}`), 'the page takes the second back');
        await eventually(async () => assert.deepEqual(await page.evaluate(`[!!document.querySelector('.ovmini'), OpenVibeMini.record()]`), [false, null], 'no small player on the video\'s own page, and nothing left written down'));

        // Close stops and forgets.
        await take();
        await page.evaluate(`OpenVibeMini.carry(document.getElementById('v'))`);
        assert.ok(await until(`location.pathname === '/' && !!document.querySelector('.ovmini')`));
        await page.evaluate(`document.querySelector('.ovmini [data-m="close"]').click()`);
        assert.ok(await until(`!document.querySelector('.ovmini') && OpenVibeMini.record() === null`), 'closed and forgotten');
        await page.goto(`${base}/second`, { maxMs: 6000 }); await wait(300);
        await eventually(async () => assert.equal(await page.evaluate(`!!document.querySelector('.ovmini')`), false, 'and it does not come back on the next page'));

        // A file that cannot be played here: the card says so and keeps the way back; nothing follows to the next page.
        await page.goto(`${base}/second`, { maxMs: 6000 });
        await page.evaluate(`OpenVibeMini.open({ page: '/watch', src: '/no-such-file.webm', title: 'The harbour at night', by: 'Kim', t: 3, playing: true })`);
        assert.ok(await until(`!!document.querySelector('.ovmini.is-broken')`), 'a file that cannot play is said, not hidden');
        await eventually(async () => assert.deepEqual(await page.evaluate(`(() => { const e = document.querySelector('.ovmini'); return [e.querySelector('.ovmini-by').textContent, e.querySelector('[data-m="play"]').hidden, e.querySelector('.ovmini-text').getAttribute('href'), OpenVibeMini.record()]; })()`), ['Open its page to keep watching', true, '/watch', null]));
        await page.evaluate(`OpenVibeMini.close()`);

        // A phone: one bar across the bottom, the picture at its left, 44 px buttons.
        const phone = await h.openPage(browser, await browser.newContext(), { width: 390, height: 780 });
        const untilP = async (expr) => { const end = Date.now() + 6000; while (Date.now() < end) { let v = false; try { v = await phone.evaluate(expr); } catch { v = false; } if (v) return v; await wait(60); } return false; };
        await phone.goto(`${base}/watch`, { maxMs: 6000 });
        assert.ok(await untilP(`document.getElementById('v').readyState >= 1`));
        await phone.evaluate(`OpenVibeMini.carry(document.getElementById('v'))`);
        assert.ok(await untilP(`location.pathname === '/' && !!document.querySelector('.ovmini video')`));
        await wait(450);
        const p = await phone.evaluate(`(() => { const e = document.querySelector('.ovmini'), r = e.getBoundingClientRect(), pic = e.querySelector('.ovmini-pic').getBoundingClientRect(), b = e.querySelector('[data-m="close"]').getBoundingClientRect();
            return { left: r.left, right: innerWidth - r.right, height: r.height, picLeft: pic.left - r.left, picW: pic.width, btn: [b.width, b.height], over: document.documentElement.scrollWidth - innerWidth }; })()`);
        assert.ok(p.left === 8 && p.right === 8 && p.height < 80, `a bar from edge to edge, low (${JSON.stringify(p)})`);
        assert.ok(p.picLeft <= 2 && p.picW === 112, 'the picture at its left');
        assert.deepEqual(p.btn, [44, 44], 'buttons a thumb can press'); assert.equal(p.over, 0, 'the page does not scroll sideways');
        console.log('mini-chrome: comes along from the player\'s button, same second, title and way back, pause kept across pages, closes for the page\'s own video, hands the second back, Close forgets, a bar on a phone');
    } finally { await browser.close(); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((err) => { console.error(err); process.exit(1); });
