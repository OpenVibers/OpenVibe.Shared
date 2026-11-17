'use strict';
// Menu History when the page's token is stale (4.292.0; the owner, 11-17: "The history tab no longer loads or is
// broken"), in a real headless Chrome with the menu (search.js and ov-home.js) open on You → History against a
// stand-in Network that refuses the old token:
//   - a refused token (401) is refreshed through the bar (OpenVibeNavbar.refreshAuth) and the read retried once: the
//     person's places show;
//   - when the read still fails, History says it could not load them and offers Try again, never "Nothing here yet";
//     Try again reads them once the Network answers.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('history-token-chrome: skipped'); process.exit(0); }
const ROOT = path.join(__dirname, '..');
const NOW = new Date().toISOString();
const server = http.createServer((req, res) => {
    const m = /^\/shared\/([a-z0-9-]+\.(?:js|css))$/.exec(req.url);
    if (m) {
        if (!fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': m[1].endsWith('.js') ? 'application/javascript' : 'text/css' }); return res.end(fs.readFileSync(path.join(ROOT, m[1])));
    }
    // ?refresh: the bar has a fresh token to give; otherwise the refresh gets nothing new and the Network stays down.
    const refresh = req.url.includes('refresh');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><script>
    window.__calls = []; window.__up = false;
    try { sessionStorage.clear(); } catch (e) {}
    const user = { id: 7, username: 'ada' };
    window.OpenVibeNavbar = { session: { user, token: 'tok_old' }, refreshAuth: async () => { if (${refresh}) window.OpenVibeNavbar.session = { user, token: 'tok_new' }; return user; } };
    const J = (b, status = 200) => Promise.resolve({ ok: status < 300, status, json: async () => b });
    window.fetch = (u, o) => {
      const s = String(u), auth = (o && o.headers && o.headers.Authorization) || '';
      window.__calls.push({ u: s, auth });
      if (s.startsWith('https://openvibe.network/api/history?')) {
        if (auth !== 'Bearer tok_new' && !window.__up) return J({ error: 'expired' }, 401);
        if (s.includes('type=search')) return J({ items: [] });
        return J({ items: [{ id: 1, type: 'stream', title: 'A stream', url: 'https://openvibe.live/ada', service: 'live', service_label: 'Live', updated_at: '${NOW}' }], services: [{ service: 'live', count: 3 }] });
      }
      return J({}, 404);
    };
    </script><script src="/shared/search.js"></script><script>
    OpenVibeSearch.open({ service: 'site', tab: 'you', section: 'recent', token: 'tok_old', user, apiBase: 'https://openvibe.network', sibling: (n) => '/shared/' + n });
    </script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-history-token-')) });
    const text = `(document.querySelector('.ovs') || document.body).textContent`;
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const wait = async (expr, tries = 160) => { for (let n = 0; n < tries; n++) { if (await page.evaluate(expr)) return true; await new Promise((ok) => setTimeout(ok, 50)); } return false; };
        await page.goto(`http://127.0.0.1:${server.address().port}/?refresh`, { maxMs: 6000 });
        assert.ok(await wait(`${text}.includes('A stream')`), `the places show after the token is refreshed (${(await page.evaluate(text)).slice(0, 200)})`);
        const calls = await page.evaluate(`window.__calls.filter((c) => c.u.includes('/api/history?limit')).map((c) => c.auth)`);
        assert.deepStrictEqual(calls.slice(0, 2), ['Bearer tok_old', 'Bearer tok_new'], 'refused once, then read with the fresh token');
        assert.ok(!(await page.evaluate(`${text}.includes('Nothing here yet')`)));
        await page.close();

        const down = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        const waitD = async (expr, tries = 160) => { for (let n = 0; n < tries; n++) { if (await down.evaluate(expr)) return true; await new Promise((ok) => setTimeout(ok, 50)); } return false; };
        await down.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        assert.ok(await waitD(`${text}.includes("Couldn't load your history")`), `a failed read says so (${(await down.evaluate(text)).slice(0, 200)})`);
        assert.ok(!(await down.evaluate(`${text}.includes('Nothing here yet')`)), 'never "Nothing here yet" for a read that failed');
        await down.evaluate(`window.__up = true; document.querySelector('.ovh-retry').click(), true`);
        assert.ok(await waitD(`${text}.includes('A stream')`), 'Try again reads them once the Network answers');
        await down.close();
        console.log('history-token-chrome: a refused token is refreshed and retried; a failed read says so, with Try again');
    } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); server.close(); process.exitCode = 1; });
