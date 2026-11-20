'use strict';
// A glimpse of the feed (4.329.0; the plan's §V.1 guests, the owner's #800: "a glimpse into the feed … on the homepage
// that shows the beginning and then opens … the feed"), in a real headless Chrome: OpenVibeHome.feed(el, { glimpse })
//   - draws the first cards only (here 4 of 9), with no chips, no example searches and no day lines;
//   - asks for one page and never the next, however far the page scrolls;
//   - ends with Show more, which calls the page's onMore (Live opens the menu's Feed);
//   - a feed that does not answer leaves nothing behind and tells the page (feedMissing), never the old wall.
//   node test/feed-glimpse-chrome.test.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('feed-glimpse-chrome: skipped'); process.exit(0); }
const at = (m) => new Date(Date.now() - m * 60e3).toISOString();
const items = Array.from({ length: 9 }, (_, i) => ({ id: `f:pics:pic:${i}`, kind: 'pic', url: `https://openvibe.pics/p/${i}`, title: `Picture ${i}`,
    at: at(i * 900), site: 'pics', site_name: 'Pics', actor: { name: `P${i}` }, media: null }));
const page = (feedUp) => `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div style="height:1400px"></div><div id="feed"></div><div style="height:3000px"></div><script>
    window.__asked = []; window.__more = 0; window.__missing = 0;
    const J = (data, ok = true) => Promise.resolve({ ok, json: async () => data });
    window.fetch = (url) => { const u = String(url); window.__asked.push(u);
      if (u.startsWith('https://openvibe.network/api/frame/feed?')) return ${feedUp ? `J({ items: ${JSON.stringify(items)}, next_cursor: 'c2' })` : 'J({}, false)'};
      return J({}, false);
    };
    </script><script src="/ov-home.js"></script><script>
    OpenVibeHome.feed(document.getElementById('feed'), { glimpse: 4, siteLines: false, onMore: () => { window.__more++; }, feedMissing: () => { window.__missing++; } });
    </script>`;
const server = http.createServer((req, res) => {
    if (req.url === '/ov-home.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(__dirname, '..', 'ov-home.js'))); }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(page(req.url !== '/down'));
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-feed-glimpse-')) });
    const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 900 });
    const wait = async (expr, tries = 100) => { for (let n = 0; n < tries; n++) { if (await p.evaluate(expr)) return true; await new Promise((ok) => setTimeout(ok, 50)); } return false; };
    try {
        await p.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        assert.ok(await wait("!!document.querySelector('.ovfd-glimpse-more')"), 'Show more comes');
        assert.strictEqual(await p.evaluate('OpenVibeHome.glimpse'), true, 'it says it takes a glimpse (a page checks before asking)');
        const got = await p.evaluate(`({ cards: document.querySelectorAll('.ovfd-list > *').length,
            chips: document.querySelector('.ovfd-chips').hidden && !document.querySelector('.ovfd-chip'), examples: document.querySelector('.ovfd-examples').hidden,
            days: document.querySelectorAll('.ovfd-day, .ovfd-dayline').length, caught: !!document.querySelector('.ovfd-caught'),
            more: document.querySelector('.ovfd-glimpse-more').textContent, wide: document.documentElement.scrollWidth })`);
        assert.deepStrictEqual(got, { cards: 4, chips: true, examples: true, days: 0, caught: false, more: 'Show more of the feed', wide: 390 });
        // Scrolled past it and back: still one page asked for.
        await p.evaluate('window.scrollTo(0, 2600)'); await new Promise((ok) => setTimeout(ok, 300));
        await p.evaluate('window.scrollTo(0, 1200)'); await new Promise((ok) => setTimeout(ok, 300));
        const feedAsks = await p.evaluate("window.__asked.filter((u) => u.startsWith('https://openvibe.network/api/frame/feed?')).length");
        assert.strictEqual(feedAsks, 1, 'one page, never the next');
        await p.evaluate("document.querySelector('.ovfd-glimpse-more').click()");
        assert.strictEqual(await p.evaluate('window.__more'), 1, 'Show more is the page\'s');

        // A feed that does not answer: nothing left behind, the page told.
        await p.goto(`http://127.0.0.1:${server.address().port}/down`, { maxMs: 6000 });
        assert.ok(await wait('window.__missing === 1'), 'the page hears it');
        assert.deepStrictEqual(await p.evaluate("[document.getElementById('feed').children.length, !!document.querySelector('.ovh-wall, .ovh-timeline')]"), [0, false]);
        console.log('feed-glimpse-chrome: four cards, no chips or days, one page, Show more is the page\'s, a dead feed leaves nothing');
    } finally {
        await browser.close().catch(() => {});
        server.close();
    }
})().catch((err) => { console.error(err); process.exit(1); });
