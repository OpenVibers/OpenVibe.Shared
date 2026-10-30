'use strict';
// kit-web.js and kit-data-web.js in a real headless Chrome (4.55.0). Until 4.55.0 its once() marked an element as wired under the same
// dataset name as the attribute that asks for the behaviour (data-ovk-copy="#id" is dataset.ovkCopy), so the markup had
// already "marked" it: copy buttons stayed hidden, sheet buttons opened nothing, and a form with data-ovk-confirm was
// sent without asking. This checks each of those, and the tool frame's clear button and "Try" examples, in the page.
// Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
const kit = require('../kit');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('kit-web-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const BODY = kit.snippet({ code: 'hello', id: 'sn' })
    + kit.sheetButton({ sheet: 'sh', label: 'Filters', iconOnly: false }) + kit.sheet({ id: 'sh', title: 'Filters', body: '<p>x</p>' })
    + kit.action({ action: '/gone', label: 'Delete', confirm: 'Delete it?' })
    + kit.tool({ head: kit.toolHead({ title: 'Whois Lookup', crumb: { label: 'Network tools' } }),
        input: kit.toolInput({ name: 'q', label: 'Domain', button: 'Look up', tries: { items: [{ value: 'openvibe.network' }] } }) });
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Kit</title><link rel="icon" href="data:,"></head>
<body>${BODY}<script>
  window.__asked = []; window.confirm = (m) => { window.__asked.push(m); return false; };
  window.__sent = [];
  document.addEventListener('submit', (e) => { if (!e.defaultPrevented) { e.preventDefault(); window.__sent.push([e.target.getAttribute('action'), new FormData(e.target).get('q')]); } });
</script><script src="/kit-web.js"></script><script src="/kit-data-web.js"></script></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (u.pathname === '/kit-web.js' || u.pathname === '/kit-data-web.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, u.pathname.slice(1)))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-kitweb-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390 });
        await p.goto(`${base}/`, { maxMs: 5000 });
        await wait(200);
        const hasClipboard = await p.evaluate('!!navigator.clipboard');
        if (hasClipboard) assert.strictEqual(await p.evaluate("document.querySelector('[data-ovk-copy]').hidden"), false, 'the copy button shows where the clipboard works');
        await p.evaluate("document.querySelector('[data-ovk-sheet]').click()");
        await wait(100);
        assert.strictEqual(await p.evaluate("document.getElementById('sh').open"), true, 'the sheet button opens its sheet');
        await p.evaluate("document.querySelector('#sh [data-ovk-close]').click()");
        await p.evaluate("document.querySelector('form[data-ovk-confirm] button').click()");
        await wait(100);
        assert.deepStrictEqual(await p.evaluate('window.__asked'), ['Delete it?'], 'a form that asks first asks');
        assert.ok(!(await p.evaluate("window.__sent.some(([a]) => a === '/gone')")), 'and is not sent when the answer is no');
        // The tool frame: the clear button follows the box; a Try example fills the box and runs the tool.
        assert.strictEqual(await p.evaluate("document.querySelector('.ovk-tool-clear').hidden"), true, 'an empty box hides its clear button');
        await p.evaluate("document.querySelector('a[data-ovk-try]').click()");
        await wait(100);
        assert.strictEqual(await p.evaluate("document.getElementById('ovk-tool-q').value"), 'openvibe.network', 'the example fills the box');
        assert.ok(await p.evaluate("window.__sent.some(([, q]) => q === 'openvibe.network')"), 'and runs the tool (its form is sent)');
        assert.strictEqual(await p.evaluate("document.querySelector('.ovk-tool-clear').hidden"), false, 'a box with text shows its clear button');
        await p.evaluate("document.querySelector('.ovk-tool-clear').click()");
        assert.strictEqual(await p.evaluate("document.getElementById('ovk-tool-q').value"), '', 'which empties it');
        await p.close();
        console.log(`kit-web-chrome: ${hasClipboard ? 'copy shows, ' : ''}sheets open, confirms ask, the tool frame's clear and Try work ok`);
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
