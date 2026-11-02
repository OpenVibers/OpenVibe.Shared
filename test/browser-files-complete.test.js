'use strict';
// Every file a browser file loads is itself served. Sites serve /shared/* from files.js's lists only (a name not on a
// list answers 404), so a script that loads a sibling the lists leave out fails on every site. site-switcher.js was
// left out from 4.48.0 to 4.106.0: the OpenVibe mark loaded it on the first tap, every site answered 404, and the
// switcher never opened.
//   node test/browser-files-complete.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const files = require('../files');

const ROOT = path.join(__dirname, '..');
const served = new Set([...files.BROWSER, ...(files.STYLES || []), ...(files.FONTS || []), ...(files.IMAGES || [])]);
const missing = [];
files.BROWSER.forEach((name) => {
    const src = fs.readFileSync(path.join(ROOT, name), 'utf8');
    // A quoted file name of this package (sibling('x.js'), a <script src>, a <link href>): if it is a file here, it is served.
    for (const m of src.matchAll(/['"]([a-z][a-z0-9-]+\.(?:js|css))['"]/g)) {
        const n = m[1];
        if (n !== name && !served.has(n) && fs.existsSync(path.join(ROOT, n))) missing.push(`${name} loads ${n}`);
    }
});
assert.deepStrictEqual([...new Set(missing)], [], 'files a browser file loads but no site serves');
assert.ok(files.BROWSER.includes('site-switcher.js'), 'the mark\'s switcher is served');
console.log('browser files complete: all checks passed');
