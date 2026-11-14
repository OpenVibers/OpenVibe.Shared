'use strict';
// The owner's one site list (2026-11-10, plan ask 274): the same eight groups, in the same order, in the footer's
// Network column and fallback, the rooms' neighbourhoods, the You tab's folders and each home page's "More on OpenVibe".
// OpenVibe.Network frame/sites.js GROUPS is the list; these are its consumers in Shared, checked against it.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const footer = require('../footer');
const rooms = require('../rooms');
const showcase = require('../showcase');

const LABELS = ['Watch & stream', 'Talk & belong', 'Play', 'Read & ask', 'Shop & money', 'Free tools', 'Make with AI', 'For developers'];
const IDS = ['watch', 'talk', 'play', 'read', 'shop', 'tools', 'make', 'build'];
// The tile ids as the home cards show them (Email, Restream, Studio and Locker keep their names).
const MEMBERS = [
    ['live', 'video', 'pics', 'download', 'openre', 'cam', 'tours'],
    ['community', 'chat', 'tips', 'vip', 'email', 'help', 'network'],
    ['games', 'quest', 'surf', 'fun', 'meme', 'casino', 'inventory'],
    ['news', 'today', 'report', 'search', 'wiki', 'blog', 'vision'],
    ['deals', 'coupons', 'shoes', 'reviews', 'trade', 'markets', 'finance', 'rent', 'work'],
    ['tools', 'design', 'domains', 'host', 'studio', 'locker', 'food'],
    ['space', 'codes', 'bot', 'actor', 'expert', 'computer', 'connect'],
    ['services', 'exchange', 'run', 'zone', 'events', 'watch', 'git'],
];

// The footer's fallback is the eight groups, in order, each linking to its /sites section.
assert.deepStrictEqual(footer.NETWORK.map((x) => x.name), LABELS, 'footer fallback: the eight labels in order');
assert.deepStrictEqual(footer.NETWORK.map((x) => x.url), IDS.map((id) => `https://openvibe.network/sites#group-${id}`), 'footer fallback: one link per group');
// The rooms' neighbourhoods repeat the same ids and labels.
assert.deepStrictEqual(Object.keys(rooms.HOODS), IDS, 'rooms: the eight ids in order');
assert.deepStrictEqual(Object.values(rooms.HOODS), LABELS, 'rooms: the eight labels in order');
for (const r of rooms.IDS) assert.ok(rooms.HOODS[rooms.get(r).hood], `${r}: a current neighbourhood`);

// The You tab's folders are the same eight groups, in order (Build keeps the `build` id saved home screens use).
const homeSrc = fs.readFileSync(path.join(__dirname, '..', 'ov-home.js'), 'utf8');
const gf = /const GROUP_FOLDERS = (\[\[[\s\S]*?\]\]);/.exec(homeSrc);
assert.ok(gf, 'ov-home has GROUP_FOLDERS');
const folders = JSON.parse(gf[1].replace(/'/g, '"'));
assert.deepStrictEqual(folders.map((f) => f[0]), IDS, 'You folders: the eight ids in order');
assert.deepStrictEqual(folders.map((f) => f[1]), LABELS, 'You folders: the eight labels in order');

// "More on OpenVibe": each home page leads to the next places in its own group, in the group's order.
const ALIAS = { media: 'video', 'media-hub': 'video', stream: 'openre', restream: 'openre', mail: 'email', image: 'studio', lock: 'locker', homes: 'rent', bench: 'report' };
const groupOf = (id) => MEMBERS.findIndex((list) => list.includes(ALIAS[id] || id));
for (const list of MEMBERS) for (const id of list) assert.ok(showcase.RELATED[id], `${id}: has a "More on OpenVibe" list`);
for (const list of MEMBERS) for (const id of list) {
    const g = groupOf(id);
    const expected = MEMBERS[g].filter((x) => x !== id).slice(0, 4);
    assert.deepStrictEqual(showcase.RELATED[id].map((x) => x[0]), expected, `${id}: its group's next places, in group order`);
}
for (const [alias, id] of Object.entries(ALIAS)) {
    assert.ok(showcase.RELATED[alias], `${alias}: an alias for ${id}`);
    assert.ok(!showcase.RELATED[alias].some((x) => x[0] === id), `${alias}: never links to itself`);
    assert.ok(showcase.RELATED[alias].every((x) => groupOf(x[0]) === groupOf(id)), `${alias}: only its own group`);
}
assert.deepStrictEqual(showcase.DEFAULT_RELATED.map((x) => x[0]), ['live', 'community', 'games', 'news'], 'a product without a list: one place from each of the first four groups, in order');

// The footer's live column uses the Frame's own groups (network column), not a head-list of ranked sites.
const footerSrc = fs.readFileSync(path.join(__dirname, '..', 'footer.js'), 'utf8');
assert.ok(/frame\.groups\.map\(g => \(\{ name: g\.name, url: groupHref\(g\.id\)/.test(footerSrc), 'the live footer reads the Frame groups');
assert.ok(/const network = frame && Array\.isArray\(frame\.groups\)/.test(footerSrc), 'and falls back to the eight only when the Frame is away');
console.log('site groups: footer, rooms, You folders and home pages show the same eight groups in the menu\'s order');
