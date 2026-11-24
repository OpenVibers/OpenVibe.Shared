'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('composer-pending-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const server = http.createServer((req, res) => {
    if (req.url === '/ov-composer.js') {
        res.writeHead(200, { 'content-type': 'application/javascript' });
        return res.end(fs.readFileSync(path.join(__dirname, '..', 'ov-composer.js')));
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="host"></div><script src="/ov-composer.js"></script>');
});
(async () => {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-composer-pending-'));
    let browser;
    try {
        browser = await h.launch({ tmpDir });
        for (const width of [390, 1280]) {
            const page = await h.openPage(browser, await browser.newContext(), { width, height: 820 });
            await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 6000 });
            const result = await page.evaluate(`(async () => {
                const results = [];
                const tick = () => new Promise((r) => setTimeout(r, 0));
                for (const verb of ['post', 'ask', 'do']) {
                    for (const outcome of ['success', 'false', 'error']) {
                        let resolve, reject, submitted;
                        const pending = new Promise((a, b) => { resolve = a; reject = b; });
                        const onSend = (v) => { submitted = v; return pending; };
                        const c = OpenVibeComposer.mount(document.getElementById('host'), { preset: 'chat', noDraft: true,
                            verbs: ['post', 'ask', 'do'], verb, onSubmit: onSend, onAsk: onSend, onDo: onSend });
                        const type = (text) => { c.text.value = text; c.text.dispatchEvent(new Event('input', { bubbles: true })); };
                        const attach = (name) => { const dt = new DataTransfer(); dt.items.add(new File(['file'], name, { type: 'text/plain' }));
                            c.form.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt })); };
                        type('first'); attach('first.txt'); c.reply({ name: 'First', data: 'first' });
                        c.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                        type('next draft'); attach('next.txt'); c.reply({ name: 'Next', data: 'next' });
                        if (outcome === 'error') reject(new Error('Try again')); else resolve(outcome === 'false' ? false : true);
                        await tick();
                        results.push({ verb, outcome, text: c.text.value, files: c.files().map((f) => f.name),
                            reply: c.form.textContent.includes('Next'), busy: c.form.classList.contains('is-busy'),
                            submitted: { text: submitted.text, files: submitted.files.map((f) => f.name) } });
                    }
                }
                // Retyping the same words is still a new draft; normal sends still clear.
                for (const changed of [false, true]) {
                    let finish;
                    const c = OpenVibeComposer.mount(document.getElementById('host'), { preset: 'chat', noDraft: true,
                        onSubmit: () => new Promise((r) => { finish = r; }) });
                    c.text.value = 'same'; c.text.dispatchEvent(new Event('input', { bubbles: true }));
                    c.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                    if (changed) { c.text.value = ''; c.text.dispatchEvent(new Event('input', { bubbles: true }));
                        c.text.value = 'same'; c.text.dispatchEvent(new Event('input', { bubbles: true })); }
                    finish(true); await tick(); results.push({ changed, text: c.text.value });
                }
                return results;
            })()`);
            for (const row of result.slice(0, 9)) {
                const label = `${width}px ${row.verb} ${row.outcome}`;
                assert.equal(row.text, 'next draft', `${label}: keeps subsequent typing`);
                assert.deepEqual(row.files, row.outcome === 'success' ? ['next.txt'] : ['first.txt', 'next.txt'], `${label}: only sent attachments clear`);
                assert.equal(row.reply, true, `${label}: keeps a new reply context`);
                assert.equal(row.busy, false, `${label}: unlocks composer`);
                assert.deepEqual(row.submitted, { text: 'first', files: ['first.txt'] });
            }
            assert.equal(result[9].text, '', `${width}px: unchanged submitted draft clears`);
            assert.equal(result[10].text, 'same', `${width}px: retyped words survive`);
        }
        console.log('composer-pending-chrome: pending sends preserve drafts at 390px and 1280px');
    } finally {
        if (browser) await browser.close();
        await new Promise((resolve) => server.close(resolve));
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((err) => { console.error(err); process.exitCode = 1; });
