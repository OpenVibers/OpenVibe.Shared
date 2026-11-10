'use strict';
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const browserHarness = require('../browser-harness');

(async () => {
  const script = fs.readFileSync(path.join(__dirname, '../ov-upload.js'));
  const server = http.createServer((req, res) => {
    if (req.url === '/ov-upload.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(script); }
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html><head><meta charset="utf-8"><script src="/ov-upload.js"></script></head><body><div id="row"></div></body></html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser, context, page;
  try {
    browser = await browserHarness.launch();
    context = await browser.newContext();
    page = await browserHarness.openPage(browser, context);
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const result = await page.evaluate(`(async () => {
      let again = false;
      const file = new File(['duplicate fixture'], 'same.txt', { type: 'text/plain' });
      const row = document.getElementById('row');
      await OVUpload.preflight(file, async (_file, hash) => ({ duplicate: true, object: { date: '2026-11-10', address: '/p/existing', url: '/p/existing', sha256: hash } }), row, { onAgain: () => { again = true; } });
      const labels = Array.from(row.querySelectorAll('button,a')).map((x) => x.textContent);
      const note = row.querySelector('.ov-upload__duplicate-note').textContent;
      row.querySelector('button:last-child').click();
      return { labels, note, again };
    })()`);
    assert.deepStrictEqual(result.labels, ['Open it', 'Use that one', 'Upload again']);
    assert.match(result.note, /You already uploaded this on 2026-11-10/);
    assert.strictEqual(result.again, true);
  } finally {
    if (page) await page.close();
    if (context) await context.dispose();
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
