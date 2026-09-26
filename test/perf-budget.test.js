'use strict';
// openvibe-shared/perf-budget (WS-T task 1): what a page's first load names and weighs, from a live server.
const assert = require('assert');
const http = require('http');
const { measure, check, format, assetsOf } = require('../perf-budget');

(async () => {
    // The HTML parser: scripts with src (not JSON/LD), stylesheets (not print, not disabled), comments ignored.
    const found = assetsOf(`<head><!-- <script src="/old.js"></script> -->
        <script src="/a.js" defer></script><script type="application/ld+json">{}</script><script>inline()</script>
        <script src='https://cdn.example/lib.js'></script><script type="module" src=/m.js></script>
        <link rel="stylesheet" href="/s.css"><link rel="preload stylesheet" href="/p.css"><link rel=stylesheet href="/print.css" media="print">
        <link rel="icon" href="/f.ico"><link rel="stylesheet" href="/off.css" disabled></head>`);
    assert.deepStrictEqual(found, { js: ['/a.js', 'https://cdn.example/lib.js', '/m.js'], css: ['/s.css', '/p.css'] });

    const files = {
        '/': `<!doctype html><html><head><link rel="stylesheet" href="/s.css"><script src="/a.js" defer></script><script src="https://openvibe.network/shared/navbar.js" defer></script></head><body>${'<p>hello</p>'.repeat(200)}</body></html>`,
        '/a.js': 'console.log(1);'.repeat(500),
        '/s.css': 'body{color:red}'.repeat(300),
    };
    const server = http.createServer((req, res) => {
        const body = files[req.url];
        if (body == null) { res.statusCode = 404; return res.end('no'); }
        res.end(body);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const m = await measure({ base });
    assert.deepStrictEqual([m.js.files, m.css.files, m.external], [2, 1, ['https://openvibe.network/shared/navbar.js']], 'the other origin is listed, not fetched');
    assert.strictEqual(m.js.rawKB, Math.round(files['/a.js'].length / 1024 * 10) / 10);
    assert.ok(m.js.brotliKB < m.js.rawKB && m.html.brotliKB < m.html.rawKB, 'brotli is smaller');
    assert.deepStrictEqual(check(m, { jsFiles: 2, cssFiles: 1, externalFiles: 1 }), []);
    assert.deepStrictEqual(check(m, { jsFiles: 1 }), [{ name: 'jsFiles', value: 2, budget: 1 }]);
    assert.match(format(m, check(m, { jsFiles: 1 })), /over budget: jsFiles 2 > 1/);
    assert.throws(() => check(m, { jsKb: 1 }), /unknown budget/);

    // A named asset that is missing fails the measurement (a broken page is not a small page).
    files['/'] = files['/'].replace('/a.js', '/gone.js');
    await assert.rejects(measure({ base }), /gone\.js .*answered 404/);
    server.close();
    console.log('perf-budget: all checks passed');
})().catch((err) => { console.error(err); process.exit(1); });
