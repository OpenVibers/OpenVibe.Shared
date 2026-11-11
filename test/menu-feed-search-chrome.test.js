'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('menu-feed-search-chrome: skipped'); process.exit(0); }
const item = (id, title, kind, person) => ({ id, title, text: title, kind, actor: { name: person }, site: 'community', site_name: 'Community', url: `https://openvibe.community/p/${id}`, at: new Date().toISOString(), counts: {} });
const loaded = [item('1', 'New photo of a dog', 'pic', 'Ada'), item('2', 'Clip from today', 'clip', 'Bo')];
const server = http.createServer((req, res) => {
    if (req.url === '/ov-home.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(__dirname, '..', 'ov-home.js'))); }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="feed"></div><script>
    window.__mode = 'api'; window.__queries = []; window.__search = '';
    const loaded = ${JSON.stringify(loaded)};
    const J = (data, ok = true) => Promise.resolve({ ok, json: async () => data });
    window.fetch = (url) => { const u = String(url);
      if (u.includes('/feed/examples')) return J({ examples: [{ text: 'New photos' }, { text: 'Ada' }] });
      if (u.includes('/feed/search')) { window.__queries.push(u); return window.__mode === 'api' ? J({ items: [${JSON.stringify(item('3', 'A matching video', 'video', 'Ada'))}], next_cursor: null }) : J({}, false); }
      if (u.includes('/feed?')) return J({ items: loaded, next_cursor: null });
      return J({}, false);
    };
    </script><script src="/ov-home.js"></script><script>
    const target = document.getElementById('feed');
    window.api = OpenVibeHome.feed(target, { onSearch: (q) => { window.__search = q; api.search(q); } });
    </script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-feed-search-')) });
    const context = await browser.newContext();
    const page = await h.openPage(browser, context, { width: 390, height: 844 });
    const wait = async (expr) => { for (let n = 0; n < 100; n++) { if (await page.evaluate(expr)) return true; await new Promise((ok) => setTimeout(ok, 50)); } return false; };
    try {
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        assert.ok(await wait(`document.querySelectorAll('.ovfd-list .ovfd-card').length === 2`), 'loaded cards show');
        assert.ok(await wait(`document.querySelectorAll('.ovfd-examples button').length >= 4`), 'API and fallback examples show');
        await page.evaluate(`api.search('Ada')`);
        assert.ok(await wait(`document.querySelector('.ovfd-results').textContent.includes('1 result')`), 'API results show a count');
        assert.ok(await page.evaluate(`window.__queries[0].includes('q=Ada') && document.querySelector('.ovfd-list').textContent.includes('A matching video')`), 'search calls the API and replaces the list');
        await page.evaluate(`window.__mode = 'fallback'; api.search('Bo')`);
        assert.ok(await wait(`document.querySelector('.ovfd-list').textContent.includes('Clip from today') && !document.querySelector('.ovfd-list').textContent.includes('dog')`), 'unavailable API filters loaded cards by person');
        await page.evaluate(`document.querySelector('[aria-label="Clear feed search"]').click()`);
        assert.ok(await wait(`window.__search === '' && document.querySelectorAll('.ovfd-list .ovfd-card').length === 2`), 'clear restores the list');
        await page.evaluate(`document.querySelector('.ovfd-examples button').click()`);
        assert.strictEqual(await page.evaluate(`window.__search`), 'New photos', 'example chip fills the query');
        console.log('menu-feed-search-chrome: API results, examples, clear, and loaded-card fallback ok');
    } finally { await page.close(); await browser.close(); server.close(); }
})().catch((e) => { console.error(e); server.close(); process.exitCode = 1; });
