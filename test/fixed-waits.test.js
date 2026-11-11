'use strict';
// A browser test checks the page after it is ready, not after a guessed sleep (2026-11-11, the owner: "Can we fix the
// Mac OS bug once and for all?"). The macOS runners are slow: menu-places-chrome slept 180 ms for a 140 ms debounce and
// failed now and then, holding back releases 4.202.0 and 4.203.0. A check after `await wait(n)` now goes through
// browser-harness's eventually() (or the test's own until()), which retries until the page is there.
//
// This is a ratchet: test/fixtures/fixed-waits.json counts the sleep-then-assert places each file still has. A file may
// lose them, never gain them, and a new file starts at none. Lower the number in the fixture when you fix one.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const baseline = JSON.parse(fs.readFileSync(path.join(DIR, 'fixtures', 'fixed-waits.json'), 'utf8'));

/** The sleep-then-assert places in one file: an `await wait(<number>)`, then within two lines a bare assert. */
function count(text) {
    const lines = text.split('\n');
    let n = 0;
    for (let i = 0; i < lines.length; i++) {
        if (!/await\s+wait\(\s*\d+\s*\)/.test(lines[i])) continue;
        const same = lines[i].slice(lines[i].search(/await\s+wait\(/));
        const next = [same.replace(/^await\s+wait\(\s*\d+\s*\)\s*;?/, ''), lines[i + 1] || '', lines[i + 2] || ''];
        // Only a check that reads the page now (an evaluate) races the sleep; one of a value measured before does not.
        if (next.some((l) => /^\s*assert[.(]/.test(l) && /evaluate\(|inside\(\)/.test(l) && !/eventually\(|until\(/.test(l))) n++;
    }
    return n;
}

const now = {};
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.test.js')).sort()) {
    const n = count(fs.readFileSync(path.join(DIR, f), 'utf8'));
    if (n) now[f] = n;
}
const grew = Object.entries(now).filter(([f, n]) => n > (baseline[f] || 0)).map(([f, n]) => `${f}: ${n} (was ${baseline[f] || 0})`);
assert.deepStrictEqual(grew, [], 'a check right after a fixed sleep: use eventually() from browser-harness (or until()) instead');
const better = Object.entries(baseline).filter(([f, n]) => (now[f] || 0) < n).map(([f, n]) => `${f}: ${now[f] || 0} (fixture says ${n})`);
assert.deepStrictEqual(better, [], 'fewer than the fixture says: lower test/fixtures/fixed-waits.json so it cannot grow back');
assert.strictEqual(count(fs.readFileSync(path.join(DIR, 'menu-places-chrome.test.js'), 'utf8')), 0, 'the test that held back 4.202 and 4.203 has none');
console.log(`fixed-waits: ${Object.values(now).reduce((a, b) => a + b, 0)} sleep-then-assert places left in ${Object.keys(now).length} files, none new`);
