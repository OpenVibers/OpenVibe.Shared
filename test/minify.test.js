'use strict';
// openvibe-shared/minify: JS/CSS minify smaller, still parses, fail-open via serve.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { minifyJs, minifyCss } = require('../minify');
const files = require('../files');

(async () => {
    // JS: every browser file minifies smaller and still parses as a classic script.
    for (const f of files.BROWSER) {
        const raw = fs.readFileSync(path.join(files.dir, f), 'utf8');
        const code = await minifyJs(raw);
        assert.ok(code.length < raw.length, `${f}: minified (${code.length}) < raw (${raw.length})`);
        assert.doesNotThrow(() => new vm.Script(code, { filename: f }), `${f}: minified parses`);
        assert.ok(!code.includes("require('openvibe-shared/"), `${f}: no require leaked`);
    }
    // CSS: every stylesheet minifies to no more than the raw file.
    for (const f of files.STYLES) {
        const raw = fs.readFileSync(path.join(files.dir, f), 'utf8');
        const code = minifyCss(raw);
        assert.ok(code.length <= raw.length, `${f}: minified no larger (${code.length} <= ${raw.length})`);
        assert.ok(code.trim().length > 0, `${f}: minified is not empty`);
    }
    // A parse error throws (serve.js catches and serves raw) rather than returning broken code.
    await assert.rejects(() => minifyJs('function broken( {'), /Unexpected token/);
    console.log(`minify: ${files.BROWSER.length} JS and ${files.STYLES.length} CSS files minify clean`);
})().catch((e) => { console.error(e); process.exit(1); });
