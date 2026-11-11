'use strict';
// Every normalised icon's ink is centred and one size (plan ask 311): re-measured in headless Chrome
// at 96 px, each ink box sits within 3% of its box centre and its larger side within 4% of the set
// target from test/fixtures/icon-ink.json (run node scripts/icon-ink.js --normalise to refresh both).
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const h = require('../browser-harness');
const ink = require('../scripts/icon-ink');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('icon-ink: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'icon-ink.json'), 'utf8'));
assert.ok(fixture.target > 0.5 && fixture.target < 1, 'the fixture names the set target (run --normalise)');

(async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-icon-ink-'));
    const browser = await h.launch({ tmpDir });
    const context = await browser.newContext();
    try {
        const page = await h.openPage(browser, context, { width: 600 });
        const items = ink.buildItems(ROOT);
        const byKey = await ink.measureItems(page, items);
        const failures = [];
        const stale = [];
        let n = 0;
        for (const [set, spec] of Object.entries(ink.SETS)) {
            if (!spec.norm) continue;
            for (const it of items.filter((i) => i.key.startsWith(`${set}/`))) {
                const name = it.key.slice(set.length + 1);
                const r = byKey[it.key];
                n++;
                if (!r || r.n <= 0) { failures.push(`${it.key}: did not rasterise`); continue; }
                const [x0, y0, x1, y1] = r.ink;
                const off = [(x0 + x1) / 2 - 0.5, (y0 + y1) / 2 - 0.5];
                const long = Math.max(x1 - x0, y1 - y0);
                if (Math.abs(off[0]) > 0.03 || Math.abs(off[1]) > 0.03) failures.push(`${it.key}: ${(off[0] * 100).toFixed(1)}%,${(off[1] * 100).toFixed(1)}% off centre`);
                if (Math.abs(long - fixture.target) > 0.04) failures.push(`${it.key}: long side ${long.toFixed(3)}, target ${fixture.target}`);
                const f = fixture.sets[set] && fixture.sets[set].icons[name];
                if (!f) { stale.push(`${it.key}: not in the fixture`); continue; }
                for (const [a, b] of [[off[0], f.off[0]], [off[1], f.off[1]], [x1 - x0, f.ink[0]], [y1 - y0, f.ink[1]]]) {
                    if (Math.abs(a - b) > 0.01) { stale.push(`${it.key}: fixture drift (re-run node scripts/icon-ink.js)`); break; }
                }
            }
        }
        assert.deepStrictEqual(failures, [], failures.join('\n'));
        assert.deepStrictEqual(stale, [], stale.join('\n'));
        console.log(`icon-ink: ${n} icons within 3% of centre, long side within 4% of ${fixture.target}; fixture current`);
    } finally {
        await context.dispose(); await browser.close();
        assert.deepStrictEqual(fs.readdirSync(tmpDir), [], 'Chrome temp profile cleanup'); fs.rmdirSync(tmpDir);
    }
})().catch((err) => { console.error(err); process.exit(1); });
