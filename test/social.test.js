'use strict';
// openvibe-shared/social: every site's share card, served from the site's pinned copy and used for og:image.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const social = require('../social');
const serve = require('../serve');
const shell = require('../shell');

/** Width and height from a JPEG's first SOF marker. */
function jpegSize(buf) {
    assert.strictEqual(buf.readUInt16BE(0), 0xffd8, 'starts with SOI');
    let i = 2;
    while (i < buf.length) {
        const marker = buf.readUInt16BE(i);
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xffc0 && marker <= 0xffcf && ![0xffc4, 0xffc8, 0xffcc].includes(marker)) {
            return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
    }
    throw new Error('no SOF marker');
}

(async () => {
    const cards = fs.readdirSync(social.DIR);
    assert.ok(cards.length >= 30, `a card for every site (${cards.length})`);
    for (const f of cards) {
        assert.match(f, /^[a-z0-9-]+\.jpg$/, `${f}: only service-id JPEGs live in social/`);
        const buf = fs.readFileSync(path.join(social.DIR, f));
        assert.deepStrictEqual(jpegSize(buf), { width: 1200, height: 630 }, `${f} is 1200×630`);
        assert.ok(buf.length <= 120 * 1024, `${f} stays small (${Math.round(buf.length / 1024)} KB)`);
    }

    assert.ok(social.has('news') && social.has('openre') && social.has('network'));
    // Page cards: a site's big pages have their own (scripts/build-social-cards.js PAGES), named <service>-<page>.
    for (const id of ['live-rundown', 'live-content', 'live-moments', 'live-chat']) assert.match(social.url(id), new RegExp(`^/shared/social/${id}\\.jpg\\?v=[0-9a-f]{12}$`), id);
    assert.ok(!social.has('nope') && !social.has('../news') && !social.has('') && !social.has(null));
    assert.match(social.url('news'), /^\/shared\/social\/news\.jpg\?v=[0-9a-f]{12}$/);
    assert.match(social.url('news', 'https://cdn.example/s/'), /^https:\/\/cdn\.example\/s\/social\/news\.jpg\?v=/);
    assert.strictEqual(social.url('nope'), null);
    for (const bad of ['social/news.png', 'social/../package.json', 'social/News.jpg', 'news.jpg', 'social/a/b.jpg']) {
        assert.ok(!social.isCard(bad), `${bad} is not a card`);
    }
    assert.throws(() => social.path('social/../serve.js'));

    // The accent stops: a manifest accent keeps its hue (a deeper stop of it), never the network blue.
    const [light, deep] = social.accentOf('news', '#fb923c');
    assert.strictEqual(light, '#fb923c');
    assert.notStrictEqual(deep, '#2563eb');
    assert.ok(parseInt(deep.slice(1, 3), 16) > parseInt(deep.slice(5, 7), 16), 'still orange: more red than blue');
    assert.deepStrictEqual(social.accentOf('live'), require('../app-icon').SITES.live.accent);

    // serve.js answers the cards beside the browser files, content-addressed.
    const app = express();
    app.use('/shared', serve.handler());
    app.use((req, res) => res.status(404).end('nope'));
    const srv = http.createServer(app);
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.address().port}`;
    try {
        const r = await fetch(base + social.url('wiki'));
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.headers.get('content-type'), 'image/jpeg');
        assert.strictEqual(r.headers.get('cache-control'), 'public, max-age=31536000, immutable');
        assert.strictEqual(Buffer.from(await r.arrayBuffer()).length, fs.statSync(path.join(social.DIR, 'wiki.jpg')).size);
        for (const bad of ['/shared/social/nope.jpg', '/shared/social/wiki.png', '/shared/social/../serve.js', '/shared/social/%2e%2e/serve.js']) {
            assert.strictEqual((await fetch(base + bad)).status, 404, `${bad} is not served`);
        }
    } finally {
        srv.close();
    }

    // shell.page: no image named → the site's card, absolute against the canonical; an explicit image wins;
    // image: null shares none; no canonical → no default.
    const html = shell.page({ service: 'news', name: 'OpenVibe.News', canonical: 'https://openvibe.news/', description: 'd' });
    assert.match(html, /<meta property="og:image" content="https:\/\/openvibe\.news\/shared\/social\/news\.jpg\?v=[0-9a-f]{12}">/);
    assert.match(html, /<meta property="og:image:alt" content="OpenVibe\.News">/);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
    assert.match(shell.page({ service: 'news', canonical: 'https://openvibe.news/', image: '/cover.png' }), /og:image" content="https:\/\/openvibe\.news\/cover\.png"/);
    assert.ok(!/og:image/.test(shell.page({ service: 'news', canonical: 'https://openvibe.news/', image: null })));
    assert.ok(!/og:image/.test(shell.page({ service: 'news' })), 'no canonical, no relative og:image');
    assert.ok(!/og:image/.test(shell.page({ service: 'no-such-site', canonical: 'https://x.example/' })));
    assert.match(shell.page({ name: 'OpenVibe.Watch', canonical: 'https://openvibe.watch/', navbar: { service: 'watch' } }), /og:image" content="https:\/\/openvibe\.watch\/shared\/social\/watch\.jpg\?v=/, 'the navbar names the service');
    assert.match(shell.page({ name: 'OpenVibe.Food', canonical: 'https://openvibe.food/', footer: { service: 'food' } }), /social\/food\.jpg/, 'or the footer does');
    console.log('social: ok');
})().catch((e) => { console.error(e); process.exit(1); });
