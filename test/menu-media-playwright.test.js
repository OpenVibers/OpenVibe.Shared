'use strict';
// Real mobile engines: a person starts a stream with sound, opens the network menu,
// and the same media element continues advancing. The fixture is a short loop.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
let playwright;
try { playwright = require(process.env.OV_PLAYWRIGHT || 'playwright'); } catch {
    console.log('menu-media-playwright: skipped (set OV_PLAYWRIGHT to a Playwright package)');
    process.exit(0);
}
const root = path.join(__dirname, '..');
const fixture = path.join(__dirname, 'fixtures/menu-playing.mp4');
const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<button id="start">Play with sound</button><button id="menu">Open menu</button>
<video id="stream" playsinline loop src="/media.mp4"></video><div style="height:1200px"></div>
<script src="/surfaces.js"></script><script src="/search.js"></script>
<script>document.querySelector('#start').onclick=()=>{const v=document.querySelector('#stream');v.muted=false;v.play()};
document.querySelector('#menu').onclick=()=>OpenVibeSearch.open({links:[],service:'Live'});</script>`;
const server = http.createServer((req, res) => {
    if (req.url === '/media.mp4') { res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': fs.statSync(fixture).size, 'accept-ranges': 'bytes' }); return fs.createReadStream(fixture).pipe(res); }
    if (req.url === '/surfaces.js' || req.url === '/search.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return fs.createReadStream(path.join(root, req.url.slice(1))).pipe(res); }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(html);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const url = `http://127.0.0.1:${server.address().port}/`;
    try {
        for (const name of ['chromium', 'webkit']) {
            const browser = await playwright[name].launch({ headless: true,
                ...(name === 'webkit' && process.env.OV_WEBKIT_BIN ? { executablePath: process.env.OV_WEBKIT_BIN } : {}) });
            try {
                const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
                    userAgent: name === 'webkit' ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36' });
                const page = await context.newPage();
                await page.goto(url);
                await page.locator('#start').tap();
                await page.waitForFunction(() => document.querySelector('#stream').currentTime > .2);
                const before = await page.locator('#stream').evaluate((v) => v.currentTime);
                await page.locator('#menu').tap();
                await page.waitForTimeout(650);
                const state = await page.locator('#stream').evaluate((v) => ({ time: v.currentTime, paused: v.paused, muted: v.muted, body: document.body.style.position }));
                assert.ok(!state.paused && !state.muted && state.time > before + .25, `${name}: unmuted stream advances with menu open (${JSON.stringify(state)})`);
                assert.equal(state.body, '', `${name}: menu leaves the playing video's body layout intact`);
                await context.close();
            } finally { await browser.close(); }
        }
        console.log('menu-media-playwright: Chromium and WebKit keep an unmuted stream playing through the menu');
    } finally { server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; server.close(); });
