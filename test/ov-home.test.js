'use strict';
// ov-home.js, read as source (the Chrome test, menu-home-screen-chrome.test.js, drives it): what it must never do and
// the shapes it keeps. Text is set as text; links are https or same-site; the arrangement is kept on the device and on
// Network; the composer only posts to Community with the person's bearer and no cookies; the wall reads the pulse.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'ov-home.js'), 'utf8');
assert.ok(/root\.OpenVibeHome = \{ home, wallTop, timeline, feed, loadPulse/.test(src), 'it exposes the home screen, the wall and the feed');
assert.ok(!/\.innerHTML\s*=/.test(src) && !/insertAdjacentHTML/.test(src), 'it never writes markup');
assert.ok(/const safe = \(u\) =>/.test(src) && /x\.protocol === 'https:' \|\| x\.origin === location\.origin/.test(src), 'links are https or this site only');
assert.ok(/localStorage\.setItem\(HOME_KEY/.test(src) && /\/api\/v1\/me\/home-screen/.test(src), 'the arrangement is kept here and on Network');
assert.ok(/credentials: 'omit'/.test(src) && !/credentials: 'include'/.test(src), 'no cookies go with any call');
assert.ok(/\/status`/.test(src) && /viewer\.can_post/.test(src), 'the composer posts (through Network to Community) only when Community says the person can');
assert.ok(/\/wall\?/.test(src) && /for', 'me'/.test(src), 'the wall reads the pulse (through Network), personal when signed in');
assert.ok(/const FRAME = 'https:\/\/openvibe\.network\/api\/frame'/.test(src) && !/openvibe\.community\/api/.test(src), 'the menu reaches Community only through Network (every site allows openvibe.network)');
assert.ok(/LONG_MS = 450/.test(src) && /ArrowLeft/.test(src) && /Delete/.test(src), 'long-press, and keys for people who cannot drag');
assert.ok(/prefers-reduced-motion: reduce/.test(src), 'the wiggle and the pulse stop for reduced motion');
assert.ok(!/@keyframes [a-z-]*spin|ovh-spin|rotate\(360deg\)/i.test(src), 'no spinners');

// The default Home without the network's frame: the person's places first, then the popular places, then the folders.
global.window = undefined;
const sandbox = {};
new Function('globalThis', 'document', src.replace("if (typeof document === 'undefined' || root.OpenVibeHome) return;", 'if (root.OpenVibeHome) return;'))(sandbox, {});
const H = sandbox.OpenVibeHome;
const apps = [
    ...['live', 'video', 'pics', 'stream', 'cam'].map((id) => ({ id, group: 'watch' })),
    ...['community', 'chat', 'tips', 'mail'].map((id) => ({ id, group: 'talk' })),
    ...['games', 'quest', 'surf', 'fun'].map((id) => ({ id, group: 'play' })),
    ...['news', 'today', 'report', 'wiki'].map((id) => ({ id, group: 'read' })),
    ...['deals', 'coupons', 'rent', 'work'].map((id) => ({ id, group: 'shop' })),
    ...['tools', 'design', 'domains', 'host'].map((id) => ({ id, group: 'tools' })),
    ...['space', 'codes', 'bot', 'actor'].map((id) => ({ id, group: 'make' })),
    ...['services', 'exchange', 'run'].map((id) => ({ id, group: 'build' })),
];
// Ten popular singles (one left in every group for its folder), then the menu's eight groups in its order.
assert.deepStrictEqual(H._defaultHome({ apps, yours: [] }), ['live', 'video', 'pics', 'stream', 'community', 'chat', 'tips', 'games', 'quest', 'surf', 'folder:g-watch', 'folder:g-talk', 'folder:g-play', 'folder:g-read', 'folder:g-shop', 'folder:g-tools', 'folder:g-make', 'folder:build', 'folder:tools'], 'signed out: ten popular places and one folder per group, in the menu\'s order');
assert.deepStrictEqual(H._defaultHome({ apps, yours: [{ id: 'you:vibe' }, { id: 'you:files' }, { id: 'you:account' }] }).slice(0, 3), ['you:vibe', 'you:files', 'live'], 'signed in: their own places first');
console.log('ov-home: text only, safe links, kept here and on Network, no cookies, the composer and wall, long-press and keys, the default Home');
