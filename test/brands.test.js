'use strict';
// Brand logos without Font Awesome (4.72.0, plan L54 K4): brands.js carries Simple Icons' drawings (CC0) for the brands
// OpenVibe sites name; ov-glyphs.js maps fa-brands names to them and fetches brands.js the first time a page shows one.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const brands = require('../brands');

const ROOT = path.join(__dirname, '..');

// The brands the sites use (a sweep of Live, Network, Chat, Design, Actor, Codes, Games and Tools, 2026-11-01).
for (const fa of ['youtube', 'twitch', 'discord', 'github', 'x-twitter', 'kickstarter-k', 'google', 'tiktok', 'threads', 'spotify', 'soundcloud', 'reddit-alien',
    'paypal', 'patreon', 'mastodon', 'linux', 'instagram', 'facebook', 'cloudflare', 'brave', 'bluesky', 'bitcoin', 'apple', 'tumblr', 'hacker-news', 'line']) {
    const slug = brands.fromFa(`fa-${fa}`);
    assert.ok(slug, `fa-${fa} has a brand`);
    const b = brands.get(slug);
    assert.match(b.hex, /^#[0-9a-f]{6}$/, `${slug} has its colour`);
    assert.match(b.path, /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/, `${slug} is a plain path`);
}
assert.strictEqual(brands.fromFa('fa-x-twitter'), 'x');
assert.strictEqual(brands.fromFa('fa-twitter'), 'x', 'the old bird name draws X');
assert.strictEqual(brands.fromFa('fa-windows'), null, 'a brand Simple Icons does not carry stays with Font Awesome');
assert.strictEqual(brands.get('nope'), null);

// svg(): the text's colour by default, the brand's on request, a title for screen readers when given.
assert.match(brands.svg('youtube', { size: 20 }), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M/);
assert.match(brands.svg('youtube', { color: 'brand' }), /fill="#ff0000"/);
assert.match(brands.svg('twitch', { title: 'Twitch' }), /role="img" aria-label="Twitch"><title>Twitch<\/title>/);
assert.strictEqual(brands.svg('nope'), '');

// ov-glyphs.js: the name map is inline, the drawings load on demand from beside it, and brands are filled.
const js = fs.readFileSync(path.join(ROOT, 'ov-glyphs.js'), 'utf8');
assert.ok(js.includes(`const FB = ${JSON.stringify(brands.FA)};`), 'the fa-brands names, inline');
assert.ok(!js.includes(brands.get('youtube').path), 'the drawings are not inline: brands.js loads when a page needs it');
assert.ok(/return drawBrand\(el\)/.test(js), 'a brand element is drawn as a brand');
assert.ok(js.includes(".ovg.ovg-brand>svg{fill:currentColor;stroke:none}"), 'brands are filled');
assert.ok(js.includes("lum < 0.12 ? 'currentColor' : b.hex"), 'a near-black brand wears the text colour on its own colour setting');
const files = fs.readFileSync(path.join(ROOT, 'files.js'), 'utf8');
assert.ok(files.includes("'brands.js',"), 'brands.js is served');
assert.ok(fs.readFileSync(path.join(ROOT, 'brands.js'), 'utf8').includes('CC0-1.0'), 'the licence travels with the drawings');

console.log(`brands: ${brands.SLUGS.length} brands for ${Object.keys(brands.FA).length} Font Awesome names; ov-glyphs.js draws them, loaded on demand`);
