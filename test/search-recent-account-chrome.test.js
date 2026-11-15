'use strict';
// Recent searches follow the account (4.252.0; plan §AB.34, the owner: "search history … across all sites"), in a real
// headless Chrome with the menu's search (search.js) opened signed in against a stand-in Network:
//   - Recent searches shows the account's searches (Network's history, kind `search`) first, then this browser's own;
//   - a search run from the box is recorded on the account (POST /api/history, type search) and in this browser;
//   - Clear empties both (DELETE /api/history/type/search, and the browser's list);
//   - signed out, nothing is sent to the account and the browser's list still works;
//   - a search in the account's history is never a place under "Jump back in".
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('search-recent-account-chrome: skipped'); process.exit(0); }
const ROOT = path.join(__dirname, '..');
const NOW = new Date().toISOString();
const server = http.createServer((req, res) => {
    const m = /^\/shared\/([a-z0-9-]+\.(?:js|css))$/.exec(req.url);
    if (m) {
        if (!fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': m[1].endsWith('.js') ? 'application/javascript' : 'text/css' }); return res.end(fs.readFileSync(path.join(ROOT, m[1])));
    }
    const signed = !req.url.includes('anon');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><script>
    window.__calls = [];
    try { localStorage.setItem('ov_search_recent', JSON.stringify(['local one', 'Lofi Streams'])); sessionStorage.clear(); } catch (e) {}
    const J = (b, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 404, json: async () => b });
    window.fetch = (u, o) => {
      const s = String(u), m = (o && o.method) || 'GET';
      window.__calls.push({ u: s, m, body: o && o.body ? String(o.body) : '', auth: (o && o.headers && o.headers.Authorization) || '' });
      if (s.startsWith('https://openvibe.network/api/history?type=search')) return J({ items: [{ id: 2, type: 'search', title: 'lofi streams', url: 'https://search.openvibe.network/?q=lofi%20streams', updated_at: '${NOW}' }] });
      if (s.startsWith('https://openvibe.network/api/history?')) return J({ items: [
        { id: 2, type: 'search', title: 'lofi streams', url: 'https://search.openvibe.network/?q=lofi%20streams', service: 'search', service_label: 'Search', updated_at: '${NOW}' },
        { id: 1, type: 'stream', title: 'A stream', url: 'https://openvibe.live/ada', service: 'live', service_label: 'Live', updated_at: '${NOW}' }], services: [{ service: 'live', count: 3 }] });
      if (s === 'https://openvibe.network/api/history' && m === 'POST') return J({ ok: true, id: 3 });
      if (s === 'https://openvibe.network/api/history/type/search' && m === 'DELETE') return J({ ok: true, deleted: 1 });
      return J({}, false);
    };
    </script><script src="/shared/search.js"></script><script>
    OpenVibeSearch.open({ service: 'site', token: ${signed ? "'tok_1'" : 'null'}, user: ${signed ? "{ id: 7, username: 'ada' }" : 'null'}, apiBase: 'https://openvibe.network', sibling: (n) => '/shared/' + n });
    </script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-search-recent-')) });
    const context = await browser.newContext();
    const page = await h.openPage(browser, context, { width: 390, height: 844 });
    const wait = async (expr, tries = 120) => { for (let n = 0; n < tries; n++) { if (await page.evaluate(expr)) return true; await new Promise((ok) => setTimeout(ok, 50)); } return false; };
    // Recent searches are the list under the field while it is focused and empty (4.262.0, was a section on the site tab).
    const chips = `(() => { const i = document.querySelector('.ovs-input'); if (i && !i.value && document.activeElement !== i) i.focus();
        return [...document.querySelectorAll('.ovs-recent:not([hidden]) .ovs-recent-row')].map((b) => b.textContent.trim()); })()`;
    try {
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
        assert.ok(await wait(`${chips}.includes('lofi streams')`), 'the account\'s recent search shows');
        const shown = await page.evaluate(chips);
        assert.deepStrictEqual(shown.slice(0, 2), ['lofi streams', 'local one'], 'the account\'s first, then this browser\'s own (the same words only once)');
        assert.ok(await page.evaluate(`window.__calls.some((c) => c.u.includes('/api/history?type=search') && c.auth === 'Bearer tok_1')`), 'read with the person\'s own token');
        assert.ok(await page.evaluate(`![...document.querySelectorAll('.ovs-group')].filter((g) => /Jump back in/.test(g.textContent)).some((g) => /lofi streams/.test(g.textContent))`),
            'a search is not a place to jump back to');

        // A search from the box is kept on the account and here.
        await page.evaluate(`(() => { const i = document.querySelector('.ovs input, input[type="search"]'); i.focus(); i.value = 'cats in hats'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        await page.evaluate(`(() => { const i = document.querySelector('.ovs input, input[type="search"]'); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); })()`);
        assert.ok(await wait(`window.__calls.some((c) => c.m === 'POST' && c.u === 'https://openvibe.network/api/history')`), 'the search is sent to the account');
        const post = JSON.parse(await page.evaluate(`window.__calls.find((c) => c.m === 'POST').body`));
        assert.deepStrictEqual([post.type, post.service, post.title, post.url], ['search', 'search', 'cats in hats', 'https://search.openvibe.network/?q=cats%20in%20hats']);
        assert.strictEqual(await page.evaluate(`JSON.parse(localStorage.getItem('ov_search_recent'))[0]`), 'cats in hats', 'and kept in this browser');

        // Clear empties both.
        await page.evaluate(`(() => { const i = document.querySelector('.ovs input, input[type="search"]'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); })()`);
        await page.evaluate(`OpenVibeSearch.close(); OpenVibeSearch.open({ service: 'site', token: 'tok_1', user: { id: 7, username: 'ada' }, apiBase: 'https://openvibe.network', sibling: (n) => '/shared/' + n })`);
        assert.ok(await wait(`(${chips}, !!document.querySelector('.ovs-recent:not([hidden]) [data-ovs-clear]'))`), 'the Clear button shows, under the field');
        assert.ok(await page.evaluate(`![...document.querySelectorAll('.ovs-group')].some((g) => /Recent searches/.test(g.textContent))`), 'and no Recent searches section on the tab');
        await page.evaluate(`document.querySelector('[data-ovs-clear]').click()`);
        assert.ok(await wait(`window.__calls.some((c) => c.m === 'DELETE' && c.u === 'https://openvibe.network/api/history/type/search' && c.auth === 'Bearer tok_1')`), 'Clear empties the account\'s searches');
        assert.strictEqual(await page.evaluate(`localStorage.getItem('ov_search_recent')`), null, 'and this browser\'s');
        assert.deepStrictEqual(await page.evaluate(chips), [], 'and none show');

        // Signed out: nothing goes to the account.
        const anon = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await anon.goto(`http://127.0.0.1:${server.address().port}/anon`, { maxMs: 6000 });
        for (let n = 0; n < 60 && !(await anon.evaluate(`${chips}.includes('local one')`)); n++) await new Promise((ok) => setTimeout(ok, 50));
        assert.deepStrictEqual((await anon.evaluate(chips)).slice(0, 2), ['local one', 'Lofi Streams'], 'signed out, this browser\'s own list');
        assert.strictEqual(await anon.evaluate(`window.__calls.filter((c) => c.u.includes('/api/history')).length`), 0, 'and nothing asks the account');
        await anon.close();
        console.log('search-recent-account-chrome: account searches first, recorded on search, cleared on both, none signed out ok');
    } finally { await page.close(); await browser.close(); server.close(); }
})().catch((e) => { console.error(e); server.close(); process.exitCode = 1; });
