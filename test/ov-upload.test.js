'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const upload = require('../ov-upload');
const files = require('../files');

let steady = 0;
for (let i = 0; i < 5; i++) steady = upload.rate(steady, 2 * 1024 * 1024, 1);
assert.strictEqual(steady, 2 * 1024 * 1024);
assert.strictEqual(upload.timeLeft(120), 'About 2 min left');
assert.strictEqual(upload.timeLeft(4), 'Almost done');

const burst = upload.rate(steady, 20 * 1024 * 1024, 1);
assert.ok(burst > steady && burst < 20 * 1024 * 1024, 'one burst is smoothed');
assert.strictEqual(upload.rate(burst, 0, 1), burst, 'a stalled sample does not become a false zero rate');
assert.strictEqual(upload.timeLeft(Infinity), 'Estimating time left');

(async () => {
  const bytes = Buffer.from('fixture upload');
  const file = { size: bytes.length, slice: (a, b) => new Blob([bytes.subarray(a, b)]) };
  assert.strictEqual(await upload.sha256(file), require('crypto').createHash('sha256').update(bytes).digest('hex'), 'fixture bytes use their exact SHA-256');
  assert.strictEqual(await upload.sha256({ size: 99, slice: file.slice }, 10), null, 'large files skip the expensive preflight hash');
})().catch((error) => { console.error(error); process.exitCode = 1; });

assert.ok(files.isBrowserFile('ov-upload.js') && files.isBrowserFile('ov-upload.css'));
const css = fs.readFileSync(path.join(__dirname, '../ov-upload.css'), 'utf8');
assert.match(css, /html\[data-ov-motion=off\] \.ov-progress__check path\{stroke-dashoffset: 0\}/, 'with motion off the tick is simply drawn');
assert.doesNotMatch(css, /prefers-reduced-motion/, 'Calm plays the progress');
assert.match(css, /\.ov-upload__input\s*\{[^}]*clip:/s, 'native input is visually hidden');
