'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const h = require('../browser-harness');
require('../purse'); // The browser fixture loads and exercises this module with a DOM.
const { eventually } = h;
const { fixture } = require('./helpers/wallet-fixture');

if (!h.findChrome()) { console.log('purse catch-up Chrome: skipped (Chrome unavailable)'); process.exit(0); }

(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-purse-catchup-'));
    const browser = await h.launch({ tmpDir: dir });
    try {
        for (const mode of ['full', 'off', 'unauthorized']) {
            const f = fixture({ changes: mode === 'unauthorized' ? mode : true });
            const base = await f.start();
            const context = await browser.newContext();
            const page = await h.openPage(browser, context, { width: 390, height: 850 });
            try {
                await page.goto(base + (mode === 'off' ? '?off=1' : ''), { maxMs: 5000 });
                await eventually(async () => assert(f.calls.some((c) => c.path === '/changes' && c.method === 'GET')));
                if (mode === 'unauthorized') {
                    assert.strictEqual(f.calls.filter((c) => c.path === '/changes/read' && c.method === 'PUT').length, 0);
                    assert.deepStrictEqual(await page.evaluate('window._purseEffects'), []);
                    continue;
                }
                await eventually(async () => assert.strictEqual(f.calls.filter((c) => c.path === '/changes/read' && c.method === 'PUT').length, 1));
                assert.deepStrictEqual(f.calls.find((c) => c.path === '/changes/read' && c.method === 'PUT').body, { currency: 'opencoins', cursor: 42 });
                assert.deepStrictEqual(await page.evaluate('window._purseEffects'), mode === 'off' ? [] : ['+5']);
                await page.evaluate("document.querySelector('[data-chip-id]').click()");
                await eventually(async () => assert(await page.evaluate("document.querySelector('.ov-wallet-changes')?.innerText.includes('For a quest')")));
                const line = await page.evaluate("(() => { const x=document.querySelector('.ov-wallet-changes .ov-wallet-event'); const v=x.querySelector('span'); return { text:x.innerText, title:v.title, aria:v.getAttribute('aria-label'), tabular:v.style.fontVariantNumeric }; })()");
                assert.match(line.text, /OpenCoins/); assert.match(line.text, /\+5/); assert.strictEqual(line.title, '+5');
                assert.strictEqual(line.aria, '+5'); assert.strictEqual(line.tabular, 'tabular-nums');
                await page.goto(base + (mode === 'off' ? '?off=1' : ''), { maxMs: 5000 });
                await eventually(async () => assert(f.calls.filter((c) => c.path === '/changes' && c.method === 'GET').length >= 2));
                assert.strictEqual(f.calls.filter((c) => c.path === '/changes/read' && c.method === 'PUT').length, 1, 'reload does not mark the same change twice');
                assert.deepStrictEqual(await page.evaluate('window._purseEffects'), [], 'reload does not replay');
            } finally { await page.close(); await context.dispose(); await f.close(); }
        }
        console.log('purse catch-up Chrome: one effect and PUT, reload quiet, Off quiet, 401 quiet, sheet reasons and figures');
    } finally { await browser.close(); fs.rmSync(dir, { recursive: true, force: true }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
