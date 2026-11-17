'use strict';
// The picker with a whole catalog (4.305.0; the owner, 11-17, on the Vibe menu's model sheet: "Picker is very
// unoptimized … lazy loading, asynchronous, dynamic loading … Search feature … less intensive"). In a real headless
// Chrome at 390 px, 2,000 rows in five sections:
//   • it opens drawing one chunk (at most 40 rows), and draws more as the list is scrolled to its end;
//   • a search keeps the rows that hold every word, the name's own matches first;
//   • the arrows go past the drawn rows (drawing ahead), and a chosen row far down opens drawn and focused;
//   • opts.load: the sheet opens at once with the mark busy, the rows arrive later, and a query typed meanwhile applies.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('ov-picker-big-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="/ov-picker.js"></script></head><body>
<button id="chip" type="button">Model</button>
<script>
const makers = ['openai', 'deepseek', 'qwen', 'meta', 'mistral'];
window.__sections = makers.map((m, s) => ({ title: m, rows: Array.from({ length: 400 }, (_, i) => ({ id: m + '|' + i, name: (m === 'qwen' ? 'Qwen ' : m + '-model ') + (i % 7) + '.' + i, line: m + ' · $' + (i / 100) + ' per 1M' })) }));
window.__sections[3].rows[5].name = 'Qwen-Coder via meta';   // a name match in another section, ranked with the names
window.__picked = [];
window.openBig = (value) => { const t0 = performance.now(); OpenVibePicker.open({ anchor: document.getElementById('chip'), title: 'Model', search: true, value, sections: window.__sections, onPick: (r) => window.__picked.push(r.id) }); window.__openMs = performance.now() - t0; };
window.openLater = () => OpenVibePicker.open({ anchor: document.getElementById('chip'), title: 'Model', search: true, load: () => new Promise((ok) => setTimeout(() => ok(window.__sections), 400)), onPick: (r) => window.__picked.push(r.id) });
</script></body></html>`;
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    const f = path.join(root, u.slice(1));
    if (/^\/[a-z0-9-]+\.js$/.test(u) && fs.existsSync(f)) { res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }); return res.end(fs.readFileSync(f)); }
    res.writeHead(404); res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
const rows = "document.querySelectorAll('.ovp-row').length";
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-picker-big-')) });
    const until = async (p, expr, what, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(40); } throw new Error(`timed out: ${what}`); };
    try {
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await p.goto(base, { maxMs: 6000 });

        // One chunk on open, more as the end comes near.
        await p.evaluate('openBig()');
        const first = await p.evaluate(rows);
        const openMs = await p.evaluate('window.__openMs');
        assert.ok(first > 0 && first <= 40, `opens with one chunk drawn (${first} rows of 2,000)`);
        await p.evaluate("(() => { const l = document.querySelector('.ovp-list'); l.scrollTop = l.scrollHeight; })()");
        await until(p, `${rows} > ${first}`, 'more rows as the end comes near');

        // Search: every word, the names first.
        await p.evaluate("(() => { const i = document.querySelector('.ovp-find input'); i.value = 'qwen 3.'; i.dispatchEvent(new Event('input', { bubbles: true })); })()");
        await until(p, "[...document.querySelectorAll('.ovp-row .ovp-t b')].every((b) => /qwen/i.test(b.textContent) || /qwen/i.test(b.parentNode.textContent))", 'only qwen rows');
        const top = await p.evaluate("[...document.querySelectorAll('.ovp-row .ovp-t b')].slice(0, 3).map((b) => b.textContent)");
        assert.ok(top.every((n) => /^qwen 3\./i.test(n)), `the name's own matches first: ${top.join(', ')}`);
        assert.strictEqual(await p.evaluate("document.querySelectorAll('.ovp-sec').length"), 0, 'search results have no section headers');
        await p.evaluate("(() => { const i = document.querySelector('.ovp-find input'); i.value = 'zzzz'; i.dispatchEvent(new Event('input', { bubbles: true })); })()");
        await until(p, "!!document.querySelector('.ovp-none')", 'nothing matches');
        await p.evaluate("(() => { const i = document.querySelector('.ovp-find input'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()");
        await until(p, `${rows} > 0 && ${rows} <= 40`, 'back to the whole list, one chunk');

        // The arrows go past the drawn rows.
        await p.evaluate("document.querySelector('.ovp-find input').focus()");
        const key = (k) => p.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', bubbles: true, cancelable: true }))`);
        for (let i = 0; i < 55; i++) await key('ArrowDown');
        const act = await p.evaluate("(() => { const a = document.querySelector('.ovp-row.is-active'); return a ? Number(a.dataset.i) : -1; })()");
        assert.ok(act >= 50, `the active row moved past the first chunk (${act})`);
        await key('Enter');
        await until(p, 'window.__picked.length === 1', 'Enter picks the active row');
        await pause(300);

        // A chosen row far down opens drawn and focused.
        await p.evaluate("openBig('deepseek|300')");
        await until(p, "document.activeElement && document.activeElement.dataset && document.activeElement.dataset.id === 'deepseek|300'", 'the chosen row is drawn and focused');
        await p.evaluate("document.querySelector('.ovp-x').click()");
        await pause(300);

        // Later rows: the sheet first, the mark busy, then the rows; a query typed meanwhile applies.
        await p.evaluate('openLater()');
        assert.ok(await p.evaluate("!!document.querySelector('.ovp-wait .ov-mark[data-state=\"busy\"]')"), 'the mark is busy while the rows come');
        await p.evaluate("(() => { const i = document.querySelector('.ovp-find input'); i.value = 'mistral-model 6'; i.dispatchEvent(new Event('input', { bubbles: true })); })()");
        await until(p, "document.querySelectorAll('.ovp-row').length > 0 && !document.querySelector('.ovp-wait')", 'the rows arrive');
        const firsts = await p.evaluate("[...document.querySelectorAll('.ovp-row .ovp-t b')].slice(0, 5).map((b) => b.textContent)");
        assert.ok(firsts.every((n) => /^mistral-model 6/.test(n)), `the query typed while loading applies, the whole phrase first: ${firsts.join(', ')}`);
        console.log(`ov-picker-big-chrome: 2,000 rows open with ${first} drawn in ${openMs.toFixed(1)} ms; more on scroll; search ranks names; arrows draw ahead; load shows the mark`);
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
