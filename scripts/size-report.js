#!/usr/bin/env node
'use strict';
/**
 * Raw and brotli (quality 11, what nginx/Cloudflare serve at best) size of every browser file.
 *
 *   node scripts/size-report.js           # table
 *   node scripts/size-report.js --json    # { "navbar.js": { raw, brotli }, … }
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { BROWSER, dir } = require('../files');

const brotli = (buf) => zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const kb = (n) => (n / 1024).toFixed(1);

function sizes() {
    const out = {};
    for (const f of BROWSER) {
        const buf = fs.readFileSync(path.join(dir, f));
        out[f] = { raw: buf.length, brotli: brotli(buf) };
    }
    return out;
}

if (require.main === module) {
    const s = sizes();
    if (process.argv.includes('--json')) {
        console.log(JSON.stringify(s, null, 2));
    } else {
        const rows = Object.entries(s).sort((a, b) => b[1].brotli - a[1].brotli);
        console.log(`${'file'.padEnd(22)} ${'raw KB'.padStart(9)} ${'brotli KB'.padStart(10)}`);
        for (const [f, v] of rows) console.log(`${f.padEnd(22)} ${kb(v.raw).padStart(9)} ${kb(v.brotli).padStart(10)}`);
        const tot = rows.reduce((t, [, v]) => ({ raw: t.raw + v.raw, brotli: t.brotli + v.brotli }), { raw: 0, brotli: 0 });
        console.log(`${'total'.padEnd(22)} ${kb(tot.raw).padStart(9)} ${kb(tot.brotli).padStart(10)}`);
    }
}

module.exports = { sizes, brotli };
