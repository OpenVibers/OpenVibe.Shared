'use strict';
// No broken pictures in the feed (4.252.0; plan §AB.43, the owner 11-14: "lots of broken and missing icons and images"),
// in a real headless Chrome, on a site's own feed proxy (frameBase '/api/v1', as Community's /pulse mounts it):
//   - a video whose picture does not load keeps its frame and shows the site's mark (never an empty box);
//   - a live card on air without a picture yet gets the same frame with the mark;
//   - a photo whose picture does not load folds its frame away;
//   - a group's rows without a picture (or with a broken one) show the site's small mark, never an empty square;
//   - faces in a run of streamers whose pictures do not load become first letters;
//   - the views beacon goes to the Network (it went to '/api/v1/api/v1/feed/views' on such a proxy: a 404);
//   - a site's own card wears the site's live line from Network's /api/frame/feed/sites ("14 new jobs today").
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('feed-pictures-chrome: skipped'); process.exit(0); }
const BROKEN = 'https://127.0.0.1:1/missing.jpg';   // refused at once: the picture never loads
const at = (m) => new Date(Date.now() - m * 60e3).toISOString();
const items = [
    { id: 'f:live:recording:1', kind: 'video', url: 'https://openvibe.video/watch?v=a', title: 'Recording: a night stream', at: at(1), site: 'live', site_name: 'Live',
        actor: { name: 'Ada', avatar: BROKEN }, media: { thumb: BROKEN, ratio: 16 / 9, length: 184 }, counts: { views: 3 } },
    { id: 'f:live:stream:2', kind: 'live', live_now: true, url: 'https://openvibe.live/@bo', title: 'Bo went live: morning coffee', at: at(2), site: 'live', site_name: 'Live',
        actor: { name: 'Bo', avatar: BROKEN }, media: null, counts: { viewers: 4 } },
    { id: 'f:pics:pic:3', kind: 'pic', url: 'https://openvibe.pics/p/3', title: 'A dog', at: at(3), site: 'pics', site_name: 'Pics',
        actor: { name: 'Cy' }, media: { thumb: BROKEN, ratio: 1 } },
    { id: 'g:work:work:4', kind: 'work', url: 'https://openvibe.work/jobs', title: '14 new jobs', at: at(4), site: 'work', site_name: 'Work', actor: null, label: 'Work',
        counts: { people: 14 }, group: { count: 14, items: [
            { id: 'f:work:job:a', url: 'https://openvibe.work/j/a', title: 'GIS engineer', media: { thumb: BROKEN } },
            { id: 'f:work:job:b', url: 'https://openvibe.work/j/b', title: 'Night editor', media: null },
            { id: 'f:work:job:c', url: 'https://openvibe.work/j/c', title: 'Sound tech', media: null }] } },
    { id: 'f:work:job:9', kind: 'work', url: 'https://openvibe.work/jobs/job_aaaaaaaaaa9', title: 'Night porter', at: at(4.5), site: 'work', site_name: 'Work', actor: null, label: 'Work', media: null },
    { id: 'f:live:stream:5', kind: 'live', live_now: false, url: 'https://openvibe.live/@dee', title: 'Dee went live: art', at: at(5), site: 'live', site_name: 'Live', actor: { name: 'Dee', avatar: BROKEN } },
    { id: 'f:live:stream:6', kind: 'live', live_now: false, url: 'https://openvibe.live/@eve', title: 'Eve went live: games', at: at(6), site: 'live', site_name: 'Live', actor: { name: 'Eve', avatar: BROKEN } },
];
const server = http.createServer((req, res) => {
    if (req.url === '/ov-home.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(__dirname, '..', 'ov-home.js'))); }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="feed"></div><script>
    window.__beacons = [];
    navigator.sendBeacon = (u) => { window.__beacons.push(String(u)); return true; };
    const J = (data, ok = true) => Promise.resolve({ ok, json: async () => data });
    window.fetch = (url) => { const u = String(url);
      if (u.includes('/feed/examples')) return J({ examples: [] });
      if (u.startsWith('/api/v1/feed?')) return J({ items: ${JSON.stringify(items)}, next_cursor: null });
      if (u === 'https://openvibe.network/api/frame/feed/sites') return J({ sites: { work: { line: '14 new jobs today', url: 'https://openvibe.work/jobs' }, live: { line: '1 live now', url: 'https://openvibe.live/' }, 'bad site!': { line: 'x' } } });
      return J({}, false);
    };
    </script><script src="/ov-home.js"></script><script>
    window.api = OpenVibeHome.feed(document.getElementById('feed'), { frameBase: '/api/v1' });
    </script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-feed-pics-')) });
    const context = await browser.newContext();
    const page = await h.openPage(browser, context, { width: 390, height: 2400 });
    const wait = async (expr, tries = 100) => { for (let n = 0; n < tries; n++) { if (await page.evaluate(expr)) return true; await new Promise((ok) => setTimeout(ok, 50)); } return false; };
    try {
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        assert.ok(await wait(`document.querySelectorAll('.ovfd-list > *').length >= 4`), 'the cards show');
        // Every picture has given up by now: wait until no lazy picture is still pending.
        for (const id of ['f:live:recording:1']) {
            assert.ok(await wait(`!!document.querySelector('[data-feed-id="${id}"] .ovfd-media.is-empty .ovfd-art .ov-appicon[data-icon="live"]')`),
                'a video whose picture does not load shows the site\'s mark in its frame');
        }
        assert.ok(await page.evaluate(`(() => { const b = document.querySelector('[data-feed-id="f:live:stream:2"] .ovfd-media .ovfd-art'); return !!b && b.getBoundingClientRect().height > 100; })()`),
            'a live card on air without a picture has a frame with the mark');
        assert.ok(await page.evaluate(`!!document.querySelector('[data-feed-id="f:live:stream:2"] .ovfd-livechip')`), 'and says LIVE');
        assert.ok(await wait(`(() => { const m = document.querySelector('[data-feed-id="f:pics:pic:3"] .ovfd-media'); return !!m && m.classList.contains('is-broken') && getComputedStyle(m).display === 'none'; })()`),
            'a photo whose picture does not load folds its frame away');
        assert.ok(await wait(`(() => { const rows = [...document.querySelectorAll('.ovfd-group-i')]; return rows.length === 3 && rows.every((r) => { const ph = r.querySelector('.ovfd-group-ph'); return ph && ph.querySelector('.ov-icon[data-icon="work"]'); }); })()`),
            'every row of a group without a picture shows the site\'s small mark');
        assert.ok(await wait(`(() => { const f = [...document.querySelectorAll('.ovfd-lives .ovfd-face')]; return f.length === 2 && f.every((x) => !x.querySelector('img') && /^[A-Z]$/.test(x.textContent)); })()`),
            'faces in a run of streamers whose pictures do not load become first letters');
        assert.ok(await wait(`(() => { const f = document.querySelector('[data-feed-id="f:live:recording:1"] .ovfd-face'); return !!f && !f.querySelector('img') && f.textContent === 'A'; })()`),
            'a card\'s face whose picture does not load becomes its first letter');
        assert.strictEqual(await page.evaluate(`[...document.querySelectorAll('.ovfd-list img')].filter((i) => i.complete && i.naturalWidth === 0 && getComputedStyle(i).visibility !== 'hidden' && getComputedStyle(i).display !== 'none' && i.offsetParent).length`), 0,
            'no broken picture is left showing');
        // A site's own card wears the site's live line (plan §AB.46); a person's card does not.
        assert.ok(await wait(`(document.querySelector('[data-ovfd-site="work"] .ovfd-line') || {}).textContent === '14 new jobs today'`), 'a site\'s card says what is new there');
        assert.strictEqual(await page.evaluate(`document.querySelectorAll('.ovfd-line').length`), 1, 'only the site\'s own card wears it, once a feed (two Work cards, one line)');
        // The views beacon: the cards were on screen for a second; hiding the page sends them.
        await new Promise((ok) => setTimeout(ok, 1400));
        await page.evaluate(`Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange'))`);
        assert.ok(await wait(`window.__beacons.length > 0`), 'the seen cards are sent');
        assert.deepStrictEqual(await page.evaluate(`[...new Set(window.__beacons)]`), ['https://openvibe.network/api/v1/feed/views'], 'to the Network, not to a doubled path on the site');
        console.log('feed-pictures-chrome: marks in empty frames, folded photos, group marks, letter faces, beacon to the Network ok');
    } finally { await page.close(); await browser.close(); server.close(); }
})().catch((e) => { console.error(e); server.close(); process.exitCode = 1; });
