'use strict';
// The site tab's roll goes through the sites people go to next from this one (4.253.0; plan §AB.33, the owner 11-14:
// "keep that randomized roll, I like that … not randomized, but connected sites … stuff people go to from"), in a real
// headless Chrome: on Chat, with the Frame's `next` naming Live, Community and Bot, the tab rolls Live → Community → Bot
// and back to its own name; a site with no flows rolls through its own section.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('menu-roll-flows-chrome: skipped'); process.exit(0); }
const ROOT = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
    const m = /^\/shared\/([a-z0-9-]+\.(?:js|css))$/.exec(req.url);
    if (m) {
        if (!fs.existsSync(path.join(ROOT, m[1]))) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': m[1].endsWith('.js') ? 'application/javascript' : 'text/css' }); return res.end(fs.readFileSync(path.join(ROOT, m[1])));
    }
    const here = `http://127.0.0.1:${server.address().port}/`;
    const flows = !req.url.includes('noflows');
    const site = (id, name, group, url) => ({ id, name, icon: id, group, url: url || `https://openvibe.${id}/` });
    const frame = {
        nav: [site('chat', 'Chat', 'talk', here), site('community', 'Community', 'talk'), site('vip', 'VIP', 'talk'), site('live', 'Live', 'watch'),
            site('bot', 'Bot', 'make'), site('games', 'Games', 'play')],
        groups: [{ id: 'talk', name: 'Talk & belong' }, { id: 'watch', name: 'Watch & stream' }, { id: 'make', name: 'Make with AI' }, { id: 'play', name: 'Play' }],
        next: flows ? { chat: ['live', 'community', 'bot', 'nowhere'] } : {}, soon: [], footer: {},
    };
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><script>
    window.__seq = [];
    window.fetch = () => Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    </script><script src="/shared/search.js"></script><script>
    OpenVibeSearch.open({ service: 'chat', frame: ${JSON.stringify(frame)}, sibling: (n) => '/shared/' + n });
    const watch = () => {
      const tab = document.querySelector('.ovs-tab[data-tab="here"]');
      if (!tab) return setTimeout(watch, 50);
      const label = () => { const t = tab.querySelector(':scope > span:not(.ovs-tab-ic)'); return t ? t.textContent : ''; };
      window.__seq.push(label());
      new MutationObserver(() => { const l = label(); if (window.__seq[window.__seq.length - 1] !== l) window.__seq.push(l); }).observe(tab, { subtree: true, childList: true, characterData: true });
    };
    watch();
    </script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-roll-flows-')) });
    const run = async (p) => {
        const page = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 900 });
        await page.goto(`http://127.0.0.1:${server.address().port}${p}`, { maxMs: 6000 });
        await new Promise((ok) => setTimeout(ok, 6500));   // the roll starts 1.4 s after opening, a beat every 0.82 s
        const seq = await page.evaluate('window.__seq');
        await page.close();
        return seq;
    };
    try {
        const seq = await run('/');
        assert.ok(seq.length >= 5, `the tab rolled: ${JSON.stringify(seq)}`);
        const own = seq[0];
        assert.deepStrictEqual(seq.slice(1, 4), ['Live', 'Community', 'Bot'], `where people go next from Chat, in order: ${JSON.stringify(seq)}`);
        assert.strictEqual(seq[seq.length - 1], own, 'and back to its own name');
        const quiet = await run('/noflows');
        assert.deepStrictEqual(quiet.slice(1, 3), ['Community', 'VIP'], `no flows yet: its own section: ${JSON.stringify(quiet)}`);
        console.log('menu-roll-flows-chrome: rolls through where people go next, else its section, and back');
    } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); server.close(); process.exitCode = 1; });
