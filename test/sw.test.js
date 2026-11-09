'use strict';
// openvibe-shared/sw: the early hints (103), the shell manifest, and the one rule that keeps the worker and the helper in
// step (the same version, the same shell).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sw = require('../sw');

(async () => {
    // ── The shell ────────────────────────────────────────────────────────────────────────────────────────────────
    assert.ok(Array.isArray(sw.SHELL) && sw.SHELL.length >= 5, 'the shell is a list of files');
    for (const file of sw.SHELL) assert.ok(file.startsWith('/shared/'), file + ' is a shared file');
    assert.ok(sw.SHELL.includes('/shared/navbar.js'), 'the navbar is in the shell');
    assert.ok(sw.SHELL.includes('/shared/theme-loader.js'), 'the theme loader is in the shell');

    // The worker keeps its own copy of the shell (it is a file the browser runs, not a module it requires): the two
    // lists must be the same, or a site warms one shell and the worker caches another.
    const worker = fs.readFileSync(path.join(__dirname, '..', 'openvibe-sw.js'), 'utf8');
    const workerShell = JSON.parse((worker.match(/const SHELL = (\[[\s\S]*?\]);/) || [])[1].replace(/'/g, '"').replace(/,\s*]/g, ']'));
    assert.deepStrictEqual(workerShell, sw.SHELL, 'the worker and the helper keep the same shell');
    const workerVersion = (worker.match(/const VERSION = '([^']+)'/) || [])[1];
    assert.strictEqual(workerVersion, sw.VERSION, 'the worker and the helper ship in the same release');
    assert.strictEqual(sw.KILL_SWITCH, 'https://openvibe.network/api/v1/sw-config', 'the kill switch has one address');
    assert.ok(fs.existsSync(sw.workerPath()), 'the worker file is there to serve');
    assert.strictEqual(path.basename(sw.workerPath()), 'openvibe-sw.js', 'the worker is served by its name');

    // ── The manifest ─────────────────────────────────────────────────────────────────────────────────────────
    const man = sw.manifest();
    assert.strictEqual(man.version, sw.VERSION);
    assert.deepStrictEqual(man.shell, sw.SHELL);
    assert.deepStrictEqual(sw.manifest(['/shared/a.js']).shell, ['/shared/a.js'], 'a site answers with its own list');
    assert.deepStrictEqual(sw.manifest(['https://elsewhere/x.js']).shell, sw.SHELL, 'only the site\'s own paths are listed');

    // ── The early hints ────────────────────────────────────────────────────────────────────────────────────
    assert.strictEqual(sw.linkHeader({ href: '/shared/navbar.js?v=abc', as: 'script' }), '</shared/navbar.js?v=abc>; rel=preload; as=script');
    assert.strictEqual(sw.linkHeader({ href: '/x.css', as: 'style', type: 'text/css' }), '</x.css>; rel=preload; as=style; type=text/css');
    assert.strictEqual(sw.linkHeader(null), '');

    // The 103 goes out first, and the Link header rides on the page so a proxy that drops the 103 still hints.
    let hints103 = null; const headers = {};
    const res = {
        headersSent: false,
        writeEarlyHints(h) { hints103 = h; return true; },
        setHeader(k, v) { headers[k] = v; },
    };
    assert.strictEqual(sw.earlyHints(res, [{ href: '/shared/navbar.js', as: 'script' }]), true);
    assert.deepStrictEqual(hints103, { link: ['</shared/navbar.js>; rel=preload; as=script'] });
    assert.strictEqual(headers.Link, '</shared/navbar.js>; rel=preload; as=script');

    // A runtime that cannot send a 103 still gets the header.
    let noHints = null; const headers2 = {};
    const res2 = { headersSent: false, writeEarlyHints(h) { noHints = h; }, setHeader(k, v) { headers2[k] = v; } };
    assert.strictEqual(sw.earlyHints(res2, [{ href: '/a.css', as: 'style' }]), true);
    assert.ok(noHints, 'the 103 was sent');
    const res3 = { headersSent: true, setHeader() { throw new Error('the header was already sent'); } };
    assert.strictEqual(sw.earlyHints(res3, [{ href: '/a.css', as: 'style' }]), false, 'a response already on its way is left alone');
    assert.strictEqual(sw.earlyHints(res, []), false, 'no links, no hint');

    // The middleware only hints a document request.
    const seen = [];
    const mw = sw.hints({ links: () => [{ href: '/shared/navbar.js', as: 'script' }] });
    let nexted = 0;
    mw({ method: 'POST', headers: {} }, { headersSent: false, setHeader(k, v) { seen.push([k, v]); }, writeEarlyHints() { } }, () => { nexted++; });
    assert.strictEqual(seen.length, 0, 'a write is never hinted');
    mw({ method: 'GET', headers: {} }, { headersSent: false, setHeader(k, v) { seen.push([k, v]); }, writeEarlyHints() { } }, () => { nexted++; });
    assert.strictEqual(seen.length, 1, 'a page is hinted');
    assert.strictEqual(nexted, 2, 'the request always goes on');

    console.log('sw: ok');
})().catch((e) => { console.error('sw:', e && e.message ? e.message : e); process.exit(1); });
