'use strict';
// Shared avatars reserve their box: width/height on every <img> the shared parts draw, lazy + async
// where the image sits below the fold (footer), async alone in the header and click panels.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const src = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

const navbar = src('navbar.js');
// avatarImg carries the requested size as width/height and decodes async; no lazy above the fold.
const avatarImg = navbar.slice(navbar.indexOf('function avatarImg'), navbar.indexOf('function avatarImg') + 1200);
assert.ok(avatarImg.includes('width="${escapeAttr(size)}"') && avatarImg.includes('height="${escapeAttr(size)}"'), 'navbar avatar reserves its size');
assert.ok(avatarImg.includes('decoding="async"'), 'navbar avatar decodes async');
assert.ok(!avatarImg.includes('loading="lazy"'), 'navbar avatar is above the fold: no lazy');

const footer = src('footer.js');
assert.ok(footer.includes('width="${media ? 64 : 32}"') && footer.includes('height="${media ? 64 : 32}"'), 'footer avatar reserves 64/32');
assert.ok(footer.includes('loading="lazy"') && footer.includes('decoding="async"'), 'footer avatar is lazy + async (below the fold)');

const switcher = src('account-switcher.js');
assert.ok(switcher.includes('width="40" height="40"') && switcher.includes('decoding="async"'), 'switcher avatar is 40x40');

const card = src('user-card.js');
assert.ok(card.includes('width="56" height="56"') && card.includes('decoding="async"'), 'user-card avatar is 56x56');

console.log('avatar sizes: navbar, footer, switcher and user-card reserve their boxes');
