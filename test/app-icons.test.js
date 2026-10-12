'use strict';
// openvibe-shared/app-icons: every site's installable app icon set and web app manifest, served from
// the site's pinned copy (serve.js) and linked by shell.page() with no per-site code.
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const express = require('express');
const appIcons = require('../app-icons');
const social = require('../social');
const serve = require('../serve');
const shell = require('../shell');

/** Width and height from a PNG's IHDR chunk. */
function pngSize(buf) {
    assert.strictEqual(buf.readUInt32BE(0), 0x89504e47, 'PNG signature');
    assert.strictEqual(buf.readUInt32BE(4), 0x0d0a1a0a, 'PNG signature');
    assert.strictEqual(buf.toString('ascii', 12, 16), 'IHDR', 'IHDR is the first chunk');
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

(async () => {
    // Every service with a share card has its four icons, valid PNGs of the right size.
    const services = fs.readdirSync(social.DIR).filter((f) => f.endsWith('.jpg')).map((f) => f.slice(0, -4)).sort();
    assert.ok(services.length >= 30, `a card for every site (${services.length})`);
    const variants = new Set();
    for (const service of services) {
        assert.ok(appIcons.has(service), `${service} has an icon set`);
        const meta = appIcons.site(service);
        assert.ok(meta && meta.name && meta.icon === social.iconSite(service), `${service}: name and the share card's variant`);
        variants.add(meta.icon);
    }
    // One set per tint variant (most sites share the network's), not one per site: the package ships every icon.
    assert.ok(variants.size <= 10, `${variants.size} variants`);
    const pngs = fs.readdirSync(appIcons.DIR).filter((f) => f.endsWith('.png'));
    assert.strictEqual(pngs.length, variants.size * 4, 'exactly the four icons of each variant in use');
    for (const variant of variants) {
        for (const maskable of [false, true]) {
            for (const size of [192, 512]) {
                const name = `icons/${variant}-${maskable ? 'maskable-' : ''}${size}.png`;
                assert.ok(appIcons.isIcon(name), `${name} is an icon`);
                const buf = fs.readFileSync(appIcons.path(name));
                assert.deepStrictEqual(pngSize(buf), { width: size, height: size }, `${name} is ${size}×${size}`);
            }
        }
    }
    assert.strictEqual(appIcons.site('media-hub').name, 'OpenVibe.Video', 'names follow the Contracts site blocks');
    assert.strictEqual(appIcons.site('constructor'), null, 'only own entries');

    // URL lookup mirrors social.url: hashed, immutable-shaped, null without an icon set.
    assert.match(appIcons.url('wiki', 192), /^\/shared\/icons\/network-192\.png\?v=[0-9a-f]{12}$/);
    assert.match(appIcons.url('wiki', 512, { maskable: true }), /^\/shared\/icons\/network-maskable-512\.png\?v=[0-9a-f]{12}$/);
    assert.match(appIcons.url('games', 192), /^\/shared\/icons\/games-192\.png\?v=/, 'a tinted site has its own set');
    assert.strictEqual(appIcons.url('nope', 192), null);
    assert.strictEqual(appIcons.url('wiki', 128), null);
    assert.ok(!appIcons.has('nope') && !appIcons.has('../wiki') && !appIcons.has('') && !appIcons.has(null));
    for (const bad of ['icons/network-999.png', 'icons/../serve.js', 'icons/network.jpg', 'network-192.png', 'icons/a/b-192.png', 'icons/wiki-192.png']) {
        assert.ok(!appIcons.isIcon(bad), `${bad} is not an icon`);
    }
    assert.throws(() => appIcons.path('icons/../serve.js'));

    // serve.js answers icons and the manifest beside the browser files, content-addressed.
    const app = express();
    app.use('/shared', serve.handler());
    app.use((req, res) => res.status(404).end('nope'));
    const srv = http.createServer(app);
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.address().port}`;
    try {
        let r = await fetch(base + appIcons.url('wiki', 192));
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.headers.get('content-type'), 'image/png');
        assert.strictEqual(r.headers.get('cache-control'), 'public, max-age=31536000, immutable', 'the current hash is immutable');
        assert.strictEqual(Buffer.from(await r.arrayBuffer()).length, fs.statSync(appIcons.path('icons/network-192.png')).size);
        assert.strictEqual((await fetch(base + '/shared/icons/network-192.png?v=old')).headers.get('cache-control'), 'public, max-age=300, stale-while-revalidate=60', 'a stale hash is short-lived');

        const murl = serve.manifestUrl('wiki');
        assert.match(murl, /^\/shared\/manifest\/wiki\.webmanifest\?v=[0-9a-f]{12}$/);
        r = await fetch(base + murl);
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.headers.get('content-type'), 'application/manifest+json');
        assert.strictEqual(r.headers.get('cache-control'), 'public, max-age=31536000, immutable');
        const manifest = await r.json();
        assert.strictEqual(manifest.name, 'OpenVibe.Wiki');
        assert.strictEqual(manifest.short_name, 'Wiki');
        assert.strictEqual(manifest.description, 'Knowledge, with sources');
        assert.strictEqual(manifest.start_url, '/');
        assert.strictEqual(manifest.scope, '/');
        assert.strictEqual(manifest.display, 'standalone');
        assert.strictEqual(manifest.background_color, '#0a0f1c');
        assert.strictEqual(manifest.theme_color, '#0d131d');
        assert.strictEqual(manifest.id, '/');
        assert.strictEqual(manifest.icons.length, 4);
        assert.deepStrictEqual([...new Set(manifest.icons.map((i) => i.purpose))].sort(), ['any', 'maskable']);
        assert.deepStrictEqual([...new Set(manifest.icons.map((i) => i.sizes))].sort(), ['192x192', '512x512']);
        for (const icon of manifest.icons) {
            assert.strictEqual(icon.type, 'image/png');
            assert.match(icon.src, /^\/shared\/icons\/network-.*\.png\?v=[0-9a-f]{12}$/);
        }

        // OpenRestream carries its own name (no "OpenVibe." prefix), so short_name is the name itself.
        const openre = await (await fetch(base + serve.manifestUrl('openre'))).json();
        assert.strictEqual(openre.name, 'OpenRestream');
        assert.strictEqual(openre.short_name, 'OpenRestream');

        assert.strictEqual((await fetch(base + '/shared/manifest/nope.webmanifest')).status, 404);
        assert.strictEqual((await fetch(base + '/shared/manifest/wiki.png')).status, 404);
        assert.strictEqual((await fetch(base + '/shared/manifest/%2e%2e/serve.js')).status, 404);
        assert.strictEqual((await fetch(base + '/shared/icons/nope-192.png')).status, 404);
    } finally {
        srv.close();
    }

    // shell.page links the manifest and touch icon when the service has icons; manifest:false and an
    // existing manifest link in `head` both leave exactly what the page named.
    const html = shell.page({ service: 'wiki', name: 'OpenVibe.Wiki', canonical: 'https://openvibe.wiki/' });
    const manifestLinks = html.match(/<link rel="manifest"[^>]*>/g) || [];
    assert.strictEqual(manifestLinks.length, 1, 'exactly one manifest link');
    assert.match(manifestLinks[0], /href="\/shared\/manifest\/wiki\.webmanifest\?v=[0-9a-f]{12}">/);
    assert.match(html, /<link rel="apple-touch-icon" href="\/shared\/icons\/network-192\.png\?v=[0-9a-f]{12}">/);
    assert.ok(!/rel="manifest"/.test(shell.page({ service: 'wiki', manifest: false })), 'manifest: false opts out');
    assert.ok(!/apple-touch-icon/.test(shell.page({ service: 'wiki', manifest: false })));
    const withHead = shell.page({ service: 'wiki', head: '<link rel="manifest" href="/manifest.webmanifest">' });
    assert.strictEqual((withHead.match(/rel="manifest"/g) || []).length, 1, 'the head manifest is kept, none added');
    assert.ok(!/shared\/manifest/.test(withHead));
    assert.ok(!/rel="manifest"/.test(shell.page({ service: 'no-such-site', canonical: 'https://x.example/' })), 'an unknown service adds none');
    assert.match(shell.page({ name: 'OpenVibe.Watch', canonical: 'https://openvibe.watch/', navbar: { service: 'watch' } }), /shared\/manifest\/watch\.webmanifest\?v=/, 'the navbar names the service');

    console.log('app-icons: ok');
})().catch((e) => { console.error(e); process.exit(1); });
