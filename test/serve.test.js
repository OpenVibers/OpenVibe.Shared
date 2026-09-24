'use strict';
// openvibe-shared/serve: a site serves its own pinned shared browser files, content-addressed.
const assert = require('assert');
const http = require('http');
const express = require('express');
const serve = require('../serve');

(async () => {
    const app = express();
    app.use('/shared', serve.handler());
    app.use((req, res) => res.status(404).end('nope'));
    const srv = http.createServer(app);
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.address().port}`;
    try {
        const u = serve.url('navbar.js');
        assert.match(u, /^\/shared\/navbar\.js\?v=[0-9a-f]{12}$/);
        let r = await fetch(base + u);
        assert.strictEqual(r.status, 200);
        assert.match(r.headers.get('content-type'), /javascript/);
        assert.strictEqual(r.headers.get('cache-control'), 'public, max-age=31536000, immutable', 'the current hash is immutable');
        assert.strictEqual(r.headers.get('cross-origin-resource-policy'), 'cross-origin');
        assert.ok((await r.text()).includes('OpenVibeNavbar'));
        r = await fetch(`${base}/shared/navbar.js?v=old`);
        assert.match(r.headers.get('cache-control'), /max-age=300/, 'a stale hash is short-lived');
        r = await fetch(`${base}/shared/navbar.js`, { headers: { 'If-None-Match': `"${serve.hashOf('navbar.js')}"` } });
        assert.strictEqual(r.status, 304);
        for (const bad of ['/shared/serve.js', '/shared/../package.json', '/shared/frame.js', '/shared/%2e%2e/files.js']) {
            assert.strictEqual((await fetch(base + bad)).status, 404, `${bad} is not served`);
        }
        assert.throws(() => serve.url('legal.js'), /not a browser file/);
        console.log('serve: all checks passed');
    } finally { srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
