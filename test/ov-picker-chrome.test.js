'use strict';
// OpenVibePicker (ov-picker.js, 4.264.0; plan §AD.8 step 4, the owner: "the drop downs … not custom animations") in a real
// headless Chrome: a sheet from the bottom at 390 px, a popover by its chip at 1280; sections, a search past eight rows,
// arrows and Enter, Escape back to the chip; a native <select> drawn as a pill that keeps its value and fires change;
// several at once with Done; and the composer's option chip opens it instead of the browser's own list.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('ov-picker-chrome: skipped'); process.exit(0); }

const root = path.join(__dirname, '..');
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:20px;font:15px system-ui}</style>
<script src="/ov-picker.js"></script><script src="/ov-composer.js"></script></head><body>
<button id="chip" type="button">Model</button>
<label for="who">Who can see it</label><select id="who" data-ov-picker><option value="all" data-line="Anyone">Everyone</option><option value="friends">Friends</option><option value="me">Just me</option></select>
<div id="box"></div>
<script>
window.__picked = [];
const rows = Array.from({ length: 12 }, (_, i) => ({ id: 'm' + i, name: ['Opus 5.5', 'Sonnet 5.5', 'Haiku 5.5', 'GPT-6.1 Sol', 'Gemini 4', 'Qwen 3.8 Max', 'Kimi K3', 'GLM 5.3', 'Grok 4.7', 'DeepSeek V4', 'MiniMax M3', 'Muse Spark'][i], line: i < 3 ? 'Anthropic' : 'Other labs' }));
document.getElementById('chip').addEventListener('click', (e) => OpenVibePicker.open({ anchor: e.currentTarget, title: 'Model', sections: [{ title: 'Anthropic', rows: rows.slice(0, 3) }, { title: 'Other labs', rows: rows.slice(3) }], value: 'm1', onPick: (r) => window.__picked.push(r.id) }));
document.getElementById('who').addEventListener('change', (e) => window.__picked.push('who:' + e.target.value));
window.__composer = OpenVibeComposer.mount(document.getElementById('box'), { preset: 'agent', run: false, mode: { name: 'who', label: 'Model', options: [['claude-code|opus', 'Claude Code · Opus'], ['codex|gpt-6.1-sol', 'Codex · GPT-6.1 Sol']], value: 'claude-code|opus' } });
</script></body></html>`;
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
    const f = path.join(root, u.slice(1));
    if (/^\/[a-z0-9-]+\.js$/.test(u) && fs.existsSync(f)) { res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' }); return res.end(fs.readFileSync(f)); }
    res.writeHead(404); res.end();
});
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const browser = await h.launch({ tmpDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ov-picker-')) });
    const until = async (p, expr, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await p.evaluate(expr); if (v) return v; await pause(40); } throw new Error(`Timed out: ${expr}`); };
    try {
        // ── a phone: a sheet from the bottom ──
        const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 844 });
        await p.goto(base, { maxMs: 6000 });
        await p.evaluate("document.getElementById('chip').click()");
        await until(p, "!!document.querySelector('.ovp.is-in')"); await pause(500);   // the sheet rises, then is measured
        const sheet = await until(p, "(() => { const b = document.querySelector('.ovp.is-in'); if (!b) return null; const r = b.getBoundingClientRect(); return { sheet: b.classList.contains('is-sheet'), bottom: Math.round(r.bottom), w: Math.round(r.width), secs: [...b.querySelectorAll('.ovp-sec')].map((s) => s.textContent), rows: b.querySelectorAll('.ovp-row').length, search: !!b.querySelector('.ovp-find input'), on: (b.querySelector('.ovp-row[aria-selected=true] b') || {}).textContent, dialog: b.getAttribute('role') }; })()");
        assert.deepStrictEqual([sheet.sheet, sheet.bottom, sheet.w], [true, 844, 390], 'a sheet across the bottom');
        assert.deepStrictEqual(sheet.secs, ['Anthropic', 'Other labs']);
        assert.deepStrictEqual([sheet.rows, sheet.search, sheet.on, sheet.dialog], [12, true, 'Sonnet 5.5', 'dialog'], 'twelve rows, a search past eight, the chosen one checked');
        await p.evaluate("document.querySelector('.ovp-row[data-id=m6]').click()");
        await until(p, "!document.querySelector('.ovp')");
        assert.deepStrictEqual(await p.evaluate('window.__picked'), ['m6'], 'a press picks and closes');
        assert.strictEqual(await p.evaluate('document.activeElement.id'), 'chip', 'focus is back on its chip');
        // The enhanced select: a pill with the chosen words; the pick sets the select and fires change.
        assert.strictEqual(await p.evaluate("document.querySelector('.ovp-pill .ovp-pill-v').textContent"), 'Everyone');
        await p.evaluate("document.querySelector('.ovp-pill').click()");
        await until(p, "!!document.querySelector('.ovp.is-in .ovp-row[data-id=friends]')");
        assert.strictEqual(await p.evaluate("document.querySelector('.ovp-title').textContent"), 'Who can see it', 'titled by its label');
        await p.evaluate("document.querySelector('.ovp-row[data-id=friends]').click()");
        await until(p, "document.getElementById('who').value === 'friends'");
        assert.strictEqual(await p.evaluate("document.querySelector('.ovp-pill .ovp-pill-v').textContent"), 'Friends');
        assert.ok((await p.evaluate('window.__picked')).includes('who:friends'), 'change fired');
        // The composer's option chip: the picker, not the browser's list.
        await until(p, "!document.querySelector('.ovp')");   // the last one has gone
        await until(p, "!!document.querySelector('.ovc-chip.ovc-chip--picker')");
        await p.evaluate("document.querySelector('.ovc-chip.ovc-chip--picker').click()");
        await until(p, "!!document.querySelector('.ovp.is-in .ovp-row')");
        assert.deepStrictEqual(await p.evaluate("[...document.querySelectorAll('.ovp.is-in .ovp-row b')].map((b) => b.textContent)"), ['Claude Code · Opus', 'Codex · GPT-6.1 Sol']);
        await p.evaluate("document.querySelector('.ovp-row[data-id=\"codex|gpt-6.1-sol\"]').click()");
        await until(p, "document.querySelector('.ovc-chip select[name=who]').value === 'codex|gpt-6.1-sol'");
        assert.strictEqual(await p.evaluate("document.querySelector('.ovc-chip .ovc-chip-v').textContent"), 'Codex · GPT-6.1 Sol', 'the chip says the pick');
        assert.strictEqual(await p.evaluate('document.documentElement.scrollWidth'), 390, 'no sideways scroll');

        // ── a computer: a popover by its chip; type to find, arrows and Enter; Escape closes ──
        const w = await h.openPage(browser, await browser.newContext(), { width: 1280, height: 800 });
        await w.goto(base, { maxMs: 6000 });
        await w.evaluate("document.getElementById('chip').click()");
        await until(w, "!!document.querySelector('.ovp.is-in')"); await pause(350);
        const pop = await until(w, "(() => { const b = document.querySelector('.ovp.is-in'); if (!b) return null; const r = b.getBoundingClientRect(), c = document.getElementById('chip').getBoundingClientRect(); return { pop: b.classList.contains('is-pop'), below: r.top >= c.bottom, near: Math.abs(r.left - c.left) < 40, focus: document.activeElement.type }; })()");
        assert.deepStrictEqual(pop, { pop: true, below: true, near: true, focus: 'search' }, 'a popover under its chip, the search focused');
        await w.evaluate("(() => { const i = document.querySelector('.ovp-find input'); i.value = 'kimi'; i.dispatchEvent(new Event('input', { bubbles: true })); })()");
        await until(w, "document.querySelectorAll('.ovp-row').length === 1");
        const key = (k) => w.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', bubbles: true, cancelable: true }))`);
        await key('ArrowDown'); await key('Enter');
        await until(w, "!document.querySelector('.ovp')");
        assert.deepStrictEqual(await w.evaluate('window.__picked'), ['m6'], 'typed, chosen with the keys');
        await w.evaluate("document.getElementById('chip').click()");
        await until(w, "!!document.querySelector('.ovp.is-in')");
        await key('Escape');
        await until(w, "!document.querySelector('.ovp')");
        assert.deepStrictEqual(await w.evaluate('window.__picked'), ['m6'], 'Escape picks nothing');
        // Several at once: Done hands back every chosen row.
        await w.evaluate("OpenVibePicker.open({ title: 'Sources', multi: true, value: ['web'], rows: [{ id: 'web', name: 'Web' }, { id: 'news', name: 'News' }, { id: 'video', name: 'Video' }], onPick: (rs) => window.__picked.push(rs.map((r) => r.id).join('+')) })");
        await until(w, "!!document.querySelector('.ovp.is-in .ovp-done')");
        await w.evaluate("document.querySelector('.ovp-row[data-id=news]').click()");
        await w.evaluate("document.querySelector('.ovp-done').click()");
        await until(w, "window.__picked.includes('web+news')");
        console.log('ov-picker-chrome: a sheet on a phone, a popover by its chip, search and keys, a select as a pill, several with Done, the composer chip');
    } finally {
        await browser.close();
        server.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
