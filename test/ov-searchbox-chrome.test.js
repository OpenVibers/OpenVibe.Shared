'use strict';
// The one search field (ov-searchbox.js, 4.229.0; the owner, 11-12: "autocomplete, dropdown, animated effects … a shared,
// universal, reusable search input component") in a real headless Chrome against a stub source: the field becomes a pill
// that loads the one dropdown from beside itself; the placeholder names the first example; typing asks the source and the
// first suggestion's rest shows as a ghost that Tab takes; Enter searches the typed words (a cancelable ov-search), the
// arrows and Enter go to a row's page; the search is remembered and shows while the field is empty; "/" puts the cursor
// in it; Escape closes the list, then clears; the clear button empties it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('ov-searchbox-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const ITEMS = [
    { label: 'streams today', url: '/s/today', icon: 'live', sub: '12 live now' },
    { label: 'stream keys', url: '/s/keys', icon: 'page' },
];
const asked = [];
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const file = /^\/shared\/(ov-searchbox|ov-combo)\.js$/.exec(u.pathname);
    if (file) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, `${file[1]}.js`))); }
    if (u.pathname === '/suggest') {
        const q = (u.searchParams.get('q') || '').toLowerCase();
        asked.push([q, u.searchParams.get('limit')]);
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ sections: [{ id: 'top', label: 'Top', items: ITEMS.filter((x) => x.label.includes(q)) }] }));
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#111;color:#eee;font-family:sans-serif">
<form id="f" action="/search" style="padding:40px 16px"><input id="q" name="q" placeholder="Search" data-ov-searchbox="/suggest" data-ov-examples="streams|clips"></form>
<p id="else">Elsewhere</p>
<script>window.searches = []; document.addEventListener('ov-search', (e) => { window.searches.push({ q: e.detail.q, url: e.detail.item && e.detail.item.url }); e.preventDefault(); });</script>
<script src="/shared/ov-searchbox.js"></script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-searchbox-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 700 });
        await page.goto(base + '/', { maxMs: 5000 });
        const until = async (expr) => { const end = Date.now() + 5000; while (Date.now() < end) { const v = await page.evaluate(expr); if (v) return v; await wait(40); } return false; };
        const key = async (k, extra = {}) => { const codes = { Enter: 13, ArrowDown: 40, Escape: 27, Tab: 9, '/': 191 }; const ev = { key: k, code: k === '/' ? 'Slash' : k, windowsVirtualKeyCode: codes[k], nativeVirtualKeyCode: codes[k], ...extra }; await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...ev }); await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...ev }); };

        assert.ok(await until(`!!(document.querySelector('.ovsb #q') && window.OVCombo)`), 'the field sits in the pill, and the one dropdown loaded from beside it');
        assert.equal(await page.evaluate(`document.getElementById('q').placeholder`), 'Search streams', 'the first example names the placeholder');
        assert.equal(await page.evaluate(`document.getElementById('q').getAttribute('role')`), 'combobox');

        // "/" from the page puts the cursor in it.
        await page.evaluate(`document.activeElement && document.activeElement.blur(), true`);
        await key('/', { text: '/' });
        assert.ok(await until(`document.activeElement && document.activeElement.id === 'q'`), '"/" focuses the search field');
        assert.equal(await page.evaluate(`document.getElementById('q').value`), '', 'and types no slash');
        assert.ok(await page.evaluate(`document.querySelector('.ovsb').classList.contains('is-focus')`), 'the pill shows its focus');

        // Typing asks the source; the first match's rest is a ghost; Tab takes it.
        await page.send('Input.insertText', { text: 'str' });
        assert.ok(await until(`[...document.querySelectorAll('.ovcombo:not([hidden]) .ovcombo-i')].length === 2`), 'two suggestions');
        assert.deepEqual(asked.at(-1), ['str', '8']);
        assert.ok(await until(`document.querySelector('.ovsb-ghost i') && document.querySelector('.ovsb-ghost i').textContent === 'eams today'`), 'the ghost shows the rest of the first suggestion');
        assert.equal(await page.evaluate(`document.querySelector('.ovcombo-i[aria-selected="true"]')`), null, 'no row is chosen ahead of the arrows');
        await key('Tab');
        assert.equal(await page.evaluate(`document.getElementById('q').value`), 'streams today', 'Tab takes the ghost');
        assert.ok(await until(`document.activeElement && document.activeElement.id === 'q'`), 'and the cursor stays');

        // Enter searches the typed words.
        await key('Enter');
        assert.ok(await until(`window.searches.length === 1`), 'Enter searches');
        assert.deepEqual(await page.evaluate(`window.searches[0]`), { q: 'streams today', url: null });

        // The arrows and Enter go to a row's page.
        await page.evaluate(`(() => { const i = document.getElementById('q'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        await page.send('Input.insertText', { text: 'key' });
        assert.ok(await until(`[...document.querySelectorAll('.ovcombo:not([hidden]) .ovcombo-i')].some((r) => r.textContent.includes('stream keys'))`), 'stream keys suggested');
        await key('ArrowDown');
        await key('Enter');
        assert.ok(await until(`window.searches.length === 2`), 'a chosen row searches');
        assert.deepEqual(await page.evaluate(`window.searches[1]`), { q: 'key', url: '/s/keys' });

        // Escape closes the list, then clears the field.
        await page.evaluate(`document.getElementById('q').focus(), true`);
        await page.send('Input.insertText', { text: 's' });
        assert.ok(await until(`!!document.querySelector('.ovcombo:not([hidden]) .ovcombo-i')`), 'the list is open');
        await key('Escape');
        assert.ok(await until(`!document.querySelector('.ovcombo:not([hidden])')`), 'Escape closes the list');
        assert.notEqual(await page.evaluate(`document.getElementById('q').value`), '', 'and keeps the words');
        await key('Escape');
        assert.equal(await page.evaluate(`document.getElementById('q').value`), '', 'a second Escape clears');

        // The search is remembered: the empty field shows it.
        await page.evaluate(`document.getElementById('else').click(), document.activeElement.blur(), true`);
        await page.evaluate(`document.getElementById('q').focus(), true`);
        assert.ok(await until(`[...document.querySelectorAll('.ovcombo:not([hidden]) .ovcombo-sec')].some((s) => s.textContent === 'Recent searches') && [...document.querySelectorAll('.ovcombo:not([hidden]) .ovcombo-i')].some((r) => r.textContent.includes('streams today'))`), 'recent searches while empty');

        // The clear button.
        await page.send('Input.insertText', { text: 'abc' });
        assert.equal(await page.evaluate(`document.querySelector('.ovsb-clear').hidden`), false, 'clear shows with words');
        await page.evaluate(`document.querySelector('.ovsb-clear').click(), true`);
        assert.equal(await page.evaluate(`document.getElementById('q').value`), '', 'clear empties the field');
        assert.equal(await page.evaluate(`document.querySelector('.ovsb-clear').hidden`), true);

        // No page overflow at phone width.
        assert.ok(await page.evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'no sideways scroll at 390 px');
        await page.close();
        console.log('ov-searchbox-chrome: the pill, the dropdown from beside it, an example placeholder, "/", the ghost and Tab, Enter, a chosen row, Escape twice, recent searches, clear');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
