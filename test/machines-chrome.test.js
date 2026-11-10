'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('machines-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
  if (req.url === '/machines.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, 'machines.js'))); }
  if (req.url.startsWith('/api/v1/machines')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ machines: [{ id: 'dev_1', principal_id: 'lnk_01J8Z4N0A1B2C3D4E5F6G7H8J0', name: 'Studio', kind: 'onboard', system: 'Linux', online: true, roles: ['ai.host'] }] })); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/kit.css"><form><div data-ov-machines data-needs="models" data-name="machine" data-principal-name="principal" data-auto-label="Auto" data-value="dev_old" data-api-base="http://127.0.0.1:${server.address().port}"></div></form><script>window.OpenVibeNavbar={session:{token:"fixture"}}</script><script src="/machines.js"></script>`);
});
(async () => {
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-machines-'));
  const browser = await h.launch({ tmpDir });
  try {
    const page = await h.openPage(browser, await browser.newContext(), { width: 800, height: 700 });
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { maxMs: 5000 });
    const until = async (expr) => { const end = Date.now() + 5000; while (Date.now() < end) { const v = await page.evaluate(expr); if (v) return v; await new Promise((r) => setTimeout(r, 50)); } return false; };
    assert.ok(await until(`Array.from(document.querySelectorAll('.ovk-row strong')).some((n) => n.textContent === 'Studio')`));
    assert.equal(await page.evaluate(`document.querySelector('input[type=hidden][name=machine]').value`), 'dev_old', 'initial choice is preserved');
    assert.equal(await page.evaluate(`document.querySelector('input[type=hidden][name=principal]').value`), '', 'unlisted selections keep a blank mapped value');
    assert.ok(await until(`Array.from(document.querySelectorAll('.ovk-row strong')).some((n) => n.textContent === 'Auto')`));
    await page.evaluate(`document.querySelector('input[type=radio][value="dev_1"]').click()`);
    assert.equal(await page.evaluate(`document.querySelector('input[type=hidden][name=machine]').value`), 'dev_1');
    assert.equal(await page.evaluate(`document.querySelector('input[type=hidden][name=principal]').value`), 'lnk_01J8Z4N0A1B2C3D4E5F6G7H8J0');
    console.log('machines-chrome: ok');
  } finally { await browser.close(); server.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); }
})().catch((err) => { console.error(err); process.exit(1); });
