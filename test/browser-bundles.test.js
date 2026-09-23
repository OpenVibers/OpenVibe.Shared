'use strict';
// Browser files (files.js BROWSER) run as plain <script> tags on every OpenVibe site: no
// require(), no Node globals, CommonJS export only behind a typeof check, and every one parses.
// Node-only modules stay out of the list.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { BROWSER, dir, isBrowserFile, path: filePath } = require('../files');

const SERVER_ONLY = [
    [/\brequire\s*\(/, 'require()'],
    [/\brequire\.resolve\b/, 'require.resolve'],
    [/\b__dirname\b|\b__filename\b/, '__dirname/__filename'],
    [/\bprocess\.(env|argv|cwd|exit)\b/, 'process.*'],
    [/\bBuffer\.(from|alloc|concat)\b/, 'Buffer'],
];
// Comments may mention require('openvibe-shared/…') in usage notes.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

for (const f of BROWSER) {
    const file = path.join(dir, f);
    assert.ok(fs.existsSync(file), `${f} exists`);
    const src = fs.readFileSync(file, 'utf8');
    const code = stripComments(src);
    for (const [re, what] of SERVER_ONLY) assert.ok(!re.test(code), `${f} uses ${what} (server-only)`);
    for (const m of code.matchAll(/module\.exports\s*=/g)) {
        const line = code.slice(code.lastIndexOf('\n', m.index) + 1, code.indexOf('\n', m.index));
        assert.ok(/typeof module/.test(line), `${f}: module.exports only behind a typeof module check (${line.trim()})`);
    }
    assert.doesNotThrow(() => new vm.Script(src, { filename: f }), `${f} parses as a classic script`);
}

// Every root module that pulls in other modules with require() is Node-only and never served.
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    if (/\brequire\s*\(/.test(stripComments(fs.readFileSync(path.join(dir, f), 'utf8')))) assert.ok(!isBrowserFile(f), `${f} requires modules; it must not be listed as a browser file`);
}
assert.ok(!isBrowserFile('middleware.js') && !isBrowserFile('../package.json'));
assert.throws(() => filePath('auth-client.js'), /not a browser file/);
assert.strictEqual(filePath('navbar.js'), path.join(dir, 'navbar.js'));

console.log(`browser bundles: ${BROWSER.length} files clean`);
