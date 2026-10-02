'use strict';
// openvibe-shared/assets: hash stability, content-addressed URL shape, source/format ordering and fallback behavior.
const assert = require('assert');
const crypto = require('crypto');
const assets = require('../assets');

// hash: stable, 12 hex, the estate's sha256 convention, and content-sensitive.
const bytes = Buffer.from([0, 1, 2, 253, 254, 255, 0x89, 0x50]);
const h = assets.hash(bytes);
assert.strictEqual(h.length, 12, '12 hex characters, like every ?v= in the estate');
assert.ok(/^[0-9a-f]{12}$/.test(h));
assert.strictEqual(h, assets.hash(bytes), 'the same bytes hash the same');
assert.strictEqual(h, crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12), 'sha256, first 12 hex');
assert.notStrictEqual(h, assets.hash(bytes.slice(1)), 'a changed byte changes the hash');
assert.strictEqual(assets.hash(''), crypto.createHash('sha256').update('').digest('hex').slice(0, 12));
assert.strictEqual(assets.hash(null), '', 'nothing to hash is no hash');

// url: no hash keeps the path exactly; a hash appends ?v= / &v= and replaces an old one, never stacks it.
assert.strictEqual(assets.url('/img/hero.png'), '/img/hero.png');
assert.strictEqual(assets.url('/img/hero.png', ''), '/img/hero.png');
assert.strictEqual(assets.url('/img/hero.png', h), `/img/hero.png?v=${h}`);
assert.strictEqual(assets.url('/img/hero.png?s=2', h), `/img/hero.png?s=2&v=${h}`);
assert.strictEqual(assets.url('/img/hero.png?v=old&s=2', h), `/img/hero.png?s=2&v=${h}`, 'an old version is replaced');
assert.strictEqual(assets.url('/img/hero.png?x=1&v=old&y=2', h), `/img/hero.png?x=1&y=2&v=${h}`, 'a version in the middle is replaced cleanly');
assert.strictEqual(assets.url('/img/hero.png?v=old', h), `/img/hero.png?v=${h}`);
assert.strictEqual(assets.url('/img/hero.png#x', h), `/img/hero.png?v=${h}#x`, 'a fragment survives');
assert.strictEqual(assets.url('', h), '');

// srcset: entries in order, w/x descriptors, empty entries dropped.
assert.strictEqual(assets.srcset([{ src: '/a.png', hash: h, w: 400 }, { src: '/b.png', w: 800 }]), `/a.png?v=${h} 400w, /b.png 800w`);
assert.strictEqual(assets.srcset(['/a.png', { src: '/b@2x.png', x: 2 }]), '/a.png, /b@2x.png 2x');
assert.strictEqual(assets.srcset([{ w: 5 }, null, '/a.png']), '/a.png');
assert.strictEqual(assets.srcset([]), '');
assert.strictEqual(assets.srcset('nope'), '');

// picture: AVIF before WebP before the <img>, even when passed in another order; caller order kept within a format.
const p = assets.picture({
    src: '/img/hero.png', hash: h, alt: 'Hero', width: 1600, height: 900,
    sizes: '(max-width: 800px) 100vw, 800px',
    sources: [
        { type: 'image/webp', entries: [{ src: '/img/hero-800.webp', hash: 'b'.repeat(12), w: 800 }] },
        { type: 'image/avif', entries: [{ src: '/img/hero-800.avif', hash: 'a'.repeat(12), w: 800 }, { src: '/img/hero-1600.avif', w: 1600 }] },
    ],
});
assert.ok(p.startsWith('<picture>'), 'sources are wrapped around the image');
assert.ok(p.indexOf('type="image/avif"') < p.indexOf('type="image/webp"'), 'AVIF is offered first');
assert.ok(p.indexOf('type="image/webp"') < p.indexOf('<img '), 'the fallback <img> is last');
assert.ok(p.indexOf('/img/hero-800.avif') < p.indexOf('/img/hero-1600.avif'), 'within a format the caller order is kept');
assert.ok(p.includes(`src="/img/hero.png?v=${h}"`) && p.includes('alt="Hero"') && p.includes('width="1600"') && p.includes('height="900"'));
assert.ok(p.includes('sizes="(max-width: 800px) 100vw, 800px"'), 'sizes reaches the sources');
assert.ok(p.includes('loading="lazy"') && p.includes('decoding="async"'), 'defaults keep the image off the critical path');
assert.ok(p.endsWith('</picture>'));

// fallback behavior: no sources is a plain <img> with the original path; no src is nothing; values are escaped.
const plain = assets.picture({ src: '/img/logo.png', alt: 'A "logo" <x>' });
assert.ok(plain.startsWith('<img ') && !plain.includes('<picture>'), 'no sources is a plain image');
assert.ok(plain.includes('src="/img/logo.png"'), 'an unhashed path is preserved exactly');
assert.ok(plain.includes('alt="A &quot;logo&quot; &lt;x&gt;"'), 'alt is escaped');
assert.strictEqual(assets.picture({ src: '' }), '', 'no src renders nothing');
assert.strictEqual(assets.picture({}), '');
assert.strictEqual(assets.picture({ src: '/a.png', sources: [{ type: 'image/avif' }, null] }), '<img src="/a.png" alt="" loading="lazy" decoding="async">', 'a source with no srcset is dropped');

// a single-format source keeps its own srcset, media and sizes.
const single = assets.picture({ src: '/p.png', sources: [{ type: 'image/webp', src: '/p.webp', hash: h, media: '(min-width: 60em)', sizes: '50vw' }] });
assert.ok(single.includes(`<source type="image/webp" media="(min-width: 60em)" srcset="/p.webp?v=${h}" sizes="50vw">`), 'a plain source carries media and sizes');

// the same input renders the same bytes (ETags, caches).
assert.strictEqual(assets.picture({ src: '/a.png', hash: h, alt: 'x', sources: [{ type: 'image/avif', src: '/a.avif' }] }), assets.picture({ src: '/a.png', hash: h, alt: 'x', sources: [{ type: 'image/avif', src: '/a.avif' }] }));
console.log('assets: all checks passed');
