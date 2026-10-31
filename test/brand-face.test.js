'use strict';
// The OpenVibe names are set in the brand face (4.59.0): Nunito, rounded like the mark, cut to Latin and weights
// 700-900 (ov-brand.woff2, SIL OFL 1.1). Sites serve it at /shared/ov-brand.woff2 beside navbar.js, which declares it;
// the navbar's site name, the footer's brand, the site switcher's names and the share cards use it, and every one
// falls back to the system face, so a site that does not serve the file still reads.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const files = require('../files');
const serve = require('../serve');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const font = fs.readFileSync(path.join(__dirname, '..', 'ov-brand.woff2'));
assert.strictEqual(font.subarray(0, 4).toString('latin1'), 'wOF2', 'a WOFF2 file');
assert.ok(font.length < 20 * 1024, `small enough for every first visit (${(font.length / 1024).toFixed(1)} KB)`);
assert.ok(/SIL OPEN FONT LICENSE Version 1\.1/i.test(read('OFL-Nunito.txt')), 'its licence travels with it');
const pkg = JSON.parse(read('package.json'));
assert.ok(pkg.files.includes('*.woff2') && pkg.files.includes('OFL-Nunito.txt'), 'both are in the package');

// Served at /shared/<file>, as a font, and never counted as a browser script.
assert.ok(files.FONTS.includes('ov-brand.woff2') && files.isBrowserFile('ov-brand.woff2'), 'sites serve it');
assert.ok(!files.BROWSER.includes('ov-brand.woff2'), 'not a script: the size report and the bundle test read BROWSER');
assert.strictEqual(files.path('ov-brand.woff2'), path.join(__dirname, '..', 'ov-brand.woff2'));
(async () => {
    const headers = {};
    const res = { statusCode: 200, setHeader: (k, v) => { headers[k.toLowerCase()] = v; }, end() {} };
    await new Promise((resolve, reject) => serve.handler()({ method: 'HEAD', path: '/ov-brand.woff2', query: {}, headers: {} }, Object.assign(res, { end: resolve }), reject));
    assert.strictEqual(headers['content-type'], 'font/woff2', 'with its own type');
    assert.strictEqual(headers['access-control-allow-origin'], '*', 'and readable from another site (fonts need CORS)');

    // Declared once by the navbar, from beside itself, for the characters it has; used with a fallback everywhere.
    const nav = read('navbar.js');
    assert.match(nav, /@font-face \{ font-family: 'OV Brand'; src: url\(\$\{siblingV\('ov-brand\.woff2'\)\}\) format\('woff2'\); font-weight: 700 900;[^}]*font-display: swap; unicode-range: U\+0020-007E/, 'navbar.js declares it, swapping in when it arrives');
    const fallback = /font-family: ?'OV Brand', ?Nunito, ?'?Inter'?, ?-apple-system/;
    assert.match(nav, new RegExp(`\\.openvibe-navbar-brand \\.name \\{[^}]*${fallback.source}`), 'the site name');
    assert.match(read('footer.js'), new RegExp(`\\.ovf-brand\\{[^}]*${fallback.source}`), "the footer's brand");
    assert.match(read('site-switcher.js'), new RegExp(`\\.ovsw-t \\{[^}]*${fallback.source}`), "the switcher's names");
    const cards = read('scripts/build-social-cards.js');
    assert.ok(/function brandFace\(\)[\s\S]*ov-brand\.woff2/.test(cards) && /\.name\{[^}]*font-family:'OV Brand'/.test(cards), 'the share cards, with the face embedded');

    // The mark sits beside the name in the wide box: level with the words, not a square with space above and below.
    assert.match(nav, /<span class="ov-mark" data-size="34" data-wide data-variant=/, 'navbar: the wide mark');
    assert.match(read('footer.js'), /<span class="ov-mark" data-size="38" data-wide><\/span>/, 'footer: the wide mark');
    console.log('brand face: served as a font with CORS, declared by the navbar, used for the names with a fallback; the wide mark beside them');
})().catch((e) => { console.error(e); process.exit(1); });
