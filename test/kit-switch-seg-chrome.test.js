'use strict';
// kit.switchRow and kit.segmented in a real headless Chrome (4.164.0, the owner's /new paste form, 11-09): a switch row
// is 56 px with a 36 px icon tile, and the whole row is the target around a native checkbox; a segmented control is
// one 44 px control of three equal choices with icons, and neither the row nor the control scrolls sideways at 390.
// Skipped without Chrome.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');
const kit = require('../kit');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('kit-switch-seg-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const ROWS = kit.switchRow({ name: 'burn_after_read', icon: 'flame', title: 'Burn after reading', line: 'Gone once it is opened' })
    + kit.switchRow({ name: 'is_nsfw', icon: 'eye-off', title: 'Mark as NSFW', line: 'Blurred until it is opened' })
    + kit.switchRow({ name: 'lock_it', icon: 'lock', title: 'Lock it', line: 'OpenVibe can’t read what’s inside', checked: true });
const SEG = kit.segmented({ name: 'visibility', value: 'unlisted', items: [
    { value: 'public', label: 'Public', icon: 'globe' },
    { value: 'unlisted', label: 'Unlisted', icon: 'link' },
    { value: 'private', label: 'Private', icon: 'lock' },
] });
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Switch rows</title><link rel="icon" href="data:,">
<link rel="stylesheet" href="/kit.css"><style>body{margin:0;padding:16px;background:#0b0f17;color:#e6edf7;font:16px/1.4 system-ui}</style></head>
<body><form class="ovk-form" id="f">${ROWS}<div class="ovk-field">${SEG}</div></form></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
    if (u.pathname === '/kit.css') { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(fs.readFileSync(path.join(ROOT, 'kit.css'))); }
    res.writeHead(404); return res.end();
});

(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-switch-'));
    const browser = await h.launch({ tmpDir });
    try {
        const context = await browser.newContext();
        const p = await h.openPage(browser, context, { width: 390, height: 844, block: ['*openvibe.network*', '*openvibe.tools*'] });
        await p.goto(`${base}/`, { maxMs: 6000 });
        const rows = await p.evaluate(`[...document.querySelectorAll('.ovk-set-switch')].map((r) => {
            const ic = r.querySelector('.ovk-set-ic'), sw = r.querySelector('input[role=switch]');
            const rr = r.getBoundingClientRect(), ir = ic.getBoundingClientRect(), sr = sw.getBoundingClientRect();
            return { h: Math.round(rr.height), icon: Math.round(ir.width) + 'x' + Math.round(ir.height), switch: Math.round(sr.width) + 'x' + Math.round(sr.height), type: sw.type, role: sw.getAttribute('role') };
        })`);
        assert.strictEqual(rows.length, 3, 'three switch rows');
        for (const r of rows) {
            assert.ok(r.h >= 56, `a switch row is 56 px (${r.h})`);
            assert.strictEqual(r.icon, '36x36', 'the icon tile is 36 px');
            assert.strictEqual(r.switch, '46x26', 'the switch is 46 px wide (4.249.0: the 3D switch)');
            assert.strictEqual(r.type, 'checkbox', 'the switch is the checkbox');
            assert.strictEqual(r.role, 'switch', 'spoken as a switch');
        }
        // The whole row is the target: a tap on the title toggles the checkbox.
        assert.strictEqual(await p.evaluate("document.querySelector('.ovk-set-switch .ovk-set-text').click(), document.querySelector('input[name=burn_after_read]').checked"), true, 'the title toggles it');
        assert.strictEqual(await p.evaluate("document.querySelector('input[name=burn_after_read]').checked = false, document.querySelector('.ovk-set-switch .ovk-set-ic').click(), document.querySelector('input[name=burn_after_read]').checked"), true, 'the icon tile toggles it');
        // The segmented control: one row, 44 px tall, three equal choices, the checked one filled.
        const seg = await p.evaluate(`(() => {
            const box = document.querySelector('.ovk-seg--fill'), labels = [...box.querySelectorAll('.ovk-seg-item')], spans = [...box.querySelectorAll('.ovk-seg-item > span')];
            const br = box.getBoundingClientRect();
            return { h: Math.round(br.height), n: labels.length, w: labels.map((l) => Math.round(l.getBoundingClientRect().width)), top: new Set(labels.map((l) => Math.round(l.getBoundingClientRect().top))).size,
                checked: box.querySelector('input:checked').value, fill: getComputedStyle(box.querySelector('input:checked + span')).backgroundColor, icons: box.querySelectorAll('.ovk-i').length, over: Math.round(document.documentElement.scrollWidth - innerWidth) };
        })()`);
        assert.ok(seg.h >= 44, `the segmented control is 44 px (${seg.h})`);
        assert.strictEqual(seg.n, 3, 'three choices');
        assert.strictEqual(seg.top, 1, 'one row');
        assert.ok(Math.max(...seg.w) - Math.min(...seg.w) <= 1, `equal widths (${seg.w})`);
        assert.strictEqual(seg.checked, 'unlisted', 'the value is the radio group’s');
        assert.notStrictEqual(seg.fill, 'rgba(0, 0, 0, 0)', 'the chosen one is filled');
        assert.strictEqual(seg.icons, 3, 'each choice has its icon');
        assert.strictEqual(seg.over, 0, 'no sideways scroll at 390');
        // The radio still posts: the form carries the chosen visibility.
        assert.strictEqual(await p.evaluate("new FormData(document.getElementById('f')).get('visibility')"), 'unlisted');
        console.log('kit-switch-seg-chrome: a 56 px switch row, the whole row a target, a 44 px segmented control of three equal choices');
    } finally { await browser.close(); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
