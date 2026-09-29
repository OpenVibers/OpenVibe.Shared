'use strict';
// openvibe-shared/cache-policy: hashed asset = immutable, HTML = SWR, personalised = no-store.
const assert = require('assert');
const http = require('http');
const express = require('express');
const cache = require('../cache-policy');
const serve = require('../serve');

(async () => {
    // A URL is content-addressed when it says so: ?v=<hash>, or a hash in the filename.
    for (const hashed of ['/shared/navbar.js?v=6f2a91c3d4e5', '/shared/navbar.js?v=abc12345&x=1', '/app.6f2a91c3d4e5.js', '/styles-a1b2c3d4e5f6.css']) {
        assert.ok(cache.isHashed(hashed), `${hashed} is content-addressed`);
    }
    for (const plain of ['/shared/navbar.js', '/app.js', '/sitemap.xml', '/app.6f2a.js', '/', '/index.html?v=x']) {
        assert.ok(!cache.isHashed(plain), `${plain} is not content-addressed`);
    }

    // Assets: the hash means immutable for a year; anything else is short plus a long stale window.
    assert.strictEqual(cache.assetHeaders('/shared/navbar.js?v=6f2a91c3d4e5'), 'public, max-age=31536000, immutable');
    assert.strictEqual(cache.assetHeaders('/shared/navbar.js'), 'public, max-age=300, stale-while-revalidate=86400');
    assert.strictEqual(cache.assetHeaders('/logo.png', { hashed: true }), cache.IMMUTABLE, 'a caller that knows can say so');
    assert.strictEqual(cache.assetHeaders('/logo.png', { hashed: false }), 'public, max-age=300, stale-while-revalidate=86400');

    // HTML: stale-while-revalidate at the edge, or nothing stored at all when personalised.
    assert.strictEqual(cache.htmlHeaders(), 'public, max-age=120, stale-while-revalidate=3600');
    assert.strictEqual(cache.htmlHeaders({ maxAge: 300, swr: 86400 }), 'public, max-age=300, stale-while-revalidate=86400');
    assert.strictEqual(cache.htmlHeaders({ private: true }), 'private, no-store');
    assert.strictEqual(cache.htmlHeaders({ private: true, maxAge: 3600 }), 'private, no-store', 'a private page is never a window');

    // serve.js keeps its exact headers, now from the shared policy: immutable on the current hash, a
    // minute of stale window (not the estate's day) on anything else, exactly as before this module existed.
    assert.strictEqual(cache.assetHeaders('navbar.js', { hashed: true, swr: 60 }), 'public, max-age=31536000, immutable');
    assert.strictEqual(cache.assetHeaders('navbar.js', { hashed: false, swr: 60 }), 'public, max-age=300, stale-while-revalidate=60');
    assert.strictEqual(cache.assetHeaders('navbar.js?v=' + serve.hashOf('navbar.js')), 'public, max-age=31536000, immutable', 'serve.url() is immutable');

    // The middleware sets the policy once and leaves an explicit one alone.
    const app = express();
    app.get('/private', (req, res) => res.end('mine'));
    app.get('/explicit', (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.end('x'); });
    app.use(cache.applyHtml({ maxAge: 300, swr: 86400 }));
    app.get('/', (req, res) => res.end('<h1>home</h1>'));
    const srv = http.createServer(app);
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.address().port}`;
    try {
        assert.strictEqual((await fetch(`${base}/`)).headers.get('cache-control'), 'public, max-age=300, stale-while-revalidate=86400');
        assert.strictEqual((await fetch(`${base}/explicit`)).headers.get('cache-control'), 'no-store', 'an explicit policy wins');
    } finally { srv.close(); }

    const priv = express();
    priv.use(cache.applyHtml({ private: true }));
    priv.get('/', (req, res) => res.end('account'));
    const srv2 = http.createServer(priv);
    await new Promise((r) => srv2.listen(0, '127.0.0.1', r));
    try {
        assert.strictEqual((await fetch(`http://127.0.0.1:${srv2.address().port}/`)).headers.get('cache-control'), 'private, no-store');
    } finally { srv2.close(); }
    console.log('cache-policy: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
