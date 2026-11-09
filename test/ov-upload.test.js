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

assert.ok(files.isBrowserFile('ov-upload.js') && files.isBrowserFile('ov-upload.css'));
const css = fs.readFileSync(path.join(__dirname, '../ov-upload.css'), 'utf8');
assert.match(css, /prefers-reduced-motion: reduce/);
assert.match(css, /\.ov-upload__input\s*\{[^}]*clip:/s, 'native input is visually hidden');
