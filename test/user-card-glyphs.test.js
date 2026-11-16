'use strict';
// The user card's buttons draw OpenVibe's glyphs, not emoji (4.287.0; the owner, 11-16: "there was use cases where you
// had like item icons and stuff as emojis or buttons … the chat one, emoji's fine"):
// - no button in the card's markup carries an emoji; each names a glyph that exists;
// - a site's registered action may name a glyph, and an emoji it still sends maps to one;
// - glyphs.fromEmoji maps the emoji pages used as icons, and leaves an emoji people write alone.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const glyphs = require('../glyphs');

const src = fs.readFileSync(path.join(__dirname, '..', 'user-card.js'), 'utf8');
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{FF0B}]/u;
const buttons = src.split('\n').filter((l) => /<button data-act=/.test(l));
assert.ok(buttons.length >= 8, `the card's own actions are found (${buttons.length})`);
for (const l of buttons) assert.ok(!EMOJI.test(l.replace(/EMOJI_GLYPH[^;]*;/, '')), `no emoji in a card button: ${l.trim().slice(0, 90)}`);
const used = [...src.matchAll(/\bg\('([a-z-]+)'\)/g)].map((m) => m[1]);
assert.deepStrictEqual(used.sort(), ['alert', 'chat', 'mute', 'plus', 'slash', 'swap', 'user', 'user-pen'].sort());
for (const n of used) assert.ok(glyphs.path(n), `the glyph ${n} exists`);
const table = /const EMOJI_GLYPH = (\{[^}]*\})/.exec(src);
assert.ok(table, 'the site-action table is there');
for (const name of table[1].match(/'([a-z-]+)'/g).map((q) => q.slice(1, -1))) assert.ok(glyphs.path(name), `a site icon maps to an existing glyph: ${name}`);

// The table every site can use.
assert.strictEqual(glyphs.fromEmoji('💬'), 'chat');
assert.strictEqual(glyphs.fromEmoji('⚠️'), 'alert');
assert.strictEqual(glyphs.fromEmoji('⚠'), 'alert', 'with or without the emoji presentation selector');
assert.strictEqual(glyphs.fromEmoji('🔄'), 'swap');
assert.strictEqual(glyphs.fromEmoji('😂'), null, 'an emoji people write is not an icon');
for (const [ch, name] of Object.entries(glyphs.EMOJI)) assert.ok(glyphs.path(name), `${ch} → ${name} exists`);

// A registered action naming a glyph, or still sending an emoji, is accepted as before.
const menu = require('../user-card').OpenVibeUserMenu;
const off = [menu.register({ id: 'chat-message', label: 'Message', icon: 'chat', onSelect() {} }), menu.register({ id: 'chat-friend', label: 'Add friend', icon: '＋', onSelect() {} })];
off.forEach((f) => f());
console.log('user-card-glyphs: the card draws glyphs, and a site\'s icon names one');
