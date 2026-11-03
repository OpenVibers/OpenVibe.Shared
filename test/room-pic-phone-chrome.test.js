'use strict';
// A room's picture on a phone (4.107.3), in a real headless Chrome. Under 760px the room drew its picture behind the
// hero's text at 0.28 opacity. For the default motif (orbits) that is a backdrop; a site's own picture is usually a
// sample card of words and numbers, and on 11-03 it ran through the headline on Report, Domains, Surf, Shoes and Tours.
// Now a site's own picture sits below the hero, whole; the default motif stays a faint backdrop. Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
const sc = require('../showcase');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('room-pic-phone-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const css = ['kit.css', 'room.css', 'showcase.css'].filter((f) => fs.existsSync(path.join(ROOT, f))).map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const page = (motif) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Room</title><style>${css}</style></head>
<body style="margin:0;padding:0 16px">${sc.room({ room: 'surf', hero: { title: 'Every number on OpenVibe, honest', lede: 'The network’s numbers, open to everyone.', ...(motif ? { motif } : {}) } })}</body></html>`;
const CARD = '<div class="x-card" aria-hidden="true"><b>Tuesday stream · 2 h 14 m</b><p>1,204 chat messages · 186 people came by</p></div>';
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(page(req.url === '/card' ? CARD : null));
});

const MEASURE = `(() => {
    const pic = document.querySelector('.sc-room-pic'), h1 = document.querySelector('.sc-room-hero h1');
    const p = pic.getBoundingClientRect(), t = h1.getBoundingClientRect(), cs = getComputedStyle(pic);
    return { position: cs.position, opacity: Number(cs.opacity), picTop: p.top, h1Bottom: t.bottom, overlaps: p.left < t.right && p.right > t.left && p.top < t.bottom && p.bottom > t.top, width: document.documentElement.scrollWidth };
})()`;

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-roompic-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        for (const width of [360, 390, 700]) {
            const card = await h.openPage(browser, context, { width, height: 800 });
            await card.goto(`${base}/card`, { maxMs: 5000 });
            const c = await card.evaluate(MEASURE);
            assert.strictEqual(c.position, 'static', `${width}px: a site's own picture is in the flow`);
            assert.strictEqual(c.opacity, 1, `${width}px: and at full strength`);
            assert.ok(!c.overlaps && c.picTop >= c.h1Bottom, `${width}px: it sits below the headline, not behind it (${JSON.stringify(c)})`);
            assert.ok(c.width <= width, `${width}px: no sideways scroll`);
            await card.close();
            const motif = await h.openPage(browser, context, { width, height: 800 });
            await motif.goto(`${base}/default`, { maxMs: 5000 });
            const m = await motif.evaluate(MEASURE);
            assert.strictEqual(m.position, 'absolute', `${width}px: the default motif stays a backdrop`);
            assert.ok(m.opacity < 0.5, `${width}px: a faint one`);
            await motif.close();
        }
        console.log('room-pic-phone-chrome: a site’s own picture sits below the hero on a phone; the default motif stays a backdrop ok');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
