'use strict';
// ov-stage.js in Chrome (4.309.0; plan §AD.25 "ov-stage", the owner sent Stageshow on 2026-11-17): a scripted demo of
// our own interface. The beats play (the cursor moves, a click changes the scene, typing fills a field); a phone gets
// the compact scene; Pause stops it and says so; Off shows the poster frame, still; the stage is one labelled picture.
//   node test/stage-chrome.test.js
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const h = require('../browser-harness');

const root = path.join(__dirname, '..');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('stage-chrome: skipped'); process.exit(0); }

const page = (motion) => `<!doctype html><html${motion ? ` data-ov-motion="${motion}"` : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:16px;background:#0b0f17;color:#e8ecf3;font:15px system-ui}.card{max-width:960px}.go{position:absolute;left:600px;top:380px;width:200px;height:56px;border-radius:12px;background:#334}.go.is-live{background:#e11d48}
.title{position:absolute;left:80px;top:80px;width:500px;height:48px;font-size:28px;background:transparent;border:0;color:#fff}.p-go{position:absolute;left:100px;top:480px;width:190px;height:56px;background:#334}</style>
<script src="/ov-stage.js"></script></head><body><div class="card"><div id="stage">
<input class="title" value=""><button class="go">Go live</button><span class="badge" hidden>LIVE</span>
<template data-ov-stage-phone><button class="p-go">Go live</button><span class="badge" hidden>LIVE</span></template>
</div></div>
<script>window.__s = OpenVibeStage.mount(document.getElementById('stage'), { label: 'A stream going live from the browser in two steps', loop: false,
  beats: [{ move: '.title', ms: 200 }, { type: '.title', text: 'Late night set', cps: 60 }, { move: '.go', ms: 200 }, { click: '.go', add: 'is-live' }, { show: '.badge' }, { wait: 50 }],
  phone: { size: { w: 390, h: 640 }, beats: [{ move: '.p-go', ms: 150 }, { click: '.p-go', add: 'is-live' }, { show: '.badge' }] } });</script></body></html>`;

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/' || u.pathname === '/off' || u.pathname === '/calm') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(page(u.pathname === '/' ? null : u.pathname.slice(1)));
    }
    if (u.pathname === '/ov-stage.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'ov-stage.js'))); }
    res.writeHead(404); return res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
// The harness evaluates source text: a function is sent as its source and called there.
const run = (pg, fn) => pg.evaluate(`(${fn})()`);
async function until(p, expr, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(40); } throw new Error(`Timed out: ${expr}`); }

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-stage-')) });
    try {
        // A computer: the wide scene plays to its end.
        const p = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 800 });
        const errors = []; p.on('pageerror', (e) => errors.push(e.message));
        await p.goto(`${base}/`);
        await until(p, "!document.querySelector('.badge').hidden");
        const wide = await run(p, () => ({
            title: document.querySelector('.title').value, badge: !document.querySelector('.badge').hidden, scene: window.__s.scene,
            role: document.getElementById('stage').getAttribute('role'), label: document.getElementById('stage').getAttribute('aria-label'),
            hidden: document.querySelector('.ovst-scaler').getAttribute('aria-hidden'), cursor: getComputedStyle(document.querySelector('.ovst-cursor')).opacity,
            fit: Math.round(document.getElementById('stage').getBoundingClientRect().width), pause: document.querySelector('.ovst-pause').textContent,
            pauseBox: (() => { const r = document.querySelector('.ovst-pause').getBoundingClientRect(); return [Math.round(r.width) >= 44, Math.round(r.height) >= 44]; })(),
            focusable: document.querySelector('.go').matches(':focus') || document.querySelector('.ovst-scaler').inert,
        }));
        assert.deepStrictEqual([wide.title, wide.badge, wide.scene], ['Late night set', true, 'wide'], 'typed, clicked, shown');
        assert.deepStrictEqual([wide.role, wide.label, wide.hidden], ['img', 'A stream going live from the browser in two steps', 'true'], 'one labelled picture, its insides hidden');
        assert.strictEqual(wide.cursor, '1', 'the cursor is shown while it plays');
        assert.ok(wide.fit <= 960 && wide.fit > 300, `scaled to its box (${wide.fit})`);
        assert.deepStrictEqual(wide.pauseBox, [true, true], 'Pause is a 44 px target');
        assert.strictEqual(wide.focusable, true, 'the scene\'s buttons cannot be focused');

        // Pause: stops and says so; Play: goes on.
        await run(p, () => window.__s.reset());
        await run(p, () => document.querySelector('.ovst-pause').click());
        const paused = await run(p, () => ({ text: document.querySelector('.ovst-pause').textContent, pressed: document.querySelector('.ovst-pause').getAttribute('aria-pressed'), beat: window.__s.beat }));
        await pause(400);
        assert.deepStrictEqual([paused.text, paused.pressed], ['Play', 'true']);
        assert.strictEqual(await run(p, () => window.__s.beat), paused.beat, 'nothing moves while paused');
        await run(p, () => document.querySelector('.ovst-pause').click());
        await until(p, "document.querySelector('.go').classList.contains('is-live')");

        // A phone: the compact scene, its own beats.
        const ph = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await ph.goto(`${base}/`);
        await until(ph, "document.querySelector('.p-go') && document.querySelector('.p-go').classList.contains('is-live')");
        assert.strictEqual(await run(ph, () => window.__s.scene), 'phone');
        assert.strictEqual(await run(ph, () => document.documentElement.scrollWidth), 390, 'no sideways scroll');

        // Off: the poster frame at once, still, with no cursor and no Pause.
        const off = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 800 });
        await off.goto(`${base}/off`);
        const o = await run(off, () => ({ live: document.querySelector('.go').classList.contains('is-live'), title: document.querySelector('.title').value, playing: window.__s.playing,
            cursor: getComputedStyle(document.querySelector('.ovst-cursor')).display, pauseHidden: document.querySelector('.ovst-pause').hidden }));
        assert.deepStrictEqual(o, { live: true, title: 'Late night set', playing: false, cursor: 'none', pauseHidden: true });
        // Turning motion back on plays it.
        await run(off, () => document.documentElement.setAttribute('data-ov-motion', 'on'));
        await until(off, "!document.querySelector('.ovst-pause').hidden");

        // Calm plays too, without the press bounce.
        const calm = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 800 });
        await calm.goto(`${base}/calm`);
        await until(calm, "document.querySelector('.go').classList.contains('is-live')", 9000);
        assert.strictEqual(await run(calm, () => document.getElementById('stage').classList.contains('is-calm')), true);

        // destroy() lets it go.
        await run(p, () => window.__s.destroy());
        assert.strictEqual(await run(p, () => Boolean(document.getElementById('stage').__ovst)), false);
        assert.deepStrictEqual(errors, []);
        console.log('stage-chrome: all checks passed');
    } finally {
        await browser.close().catch(() => {});
        server.close();
    }
})().catch((err) => { console.error(err); process.exit(1); });
