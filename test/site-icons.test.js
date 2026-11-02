'use strict';
// Every live site's launcher icon is a real glyph, never the fallback mark (ov-icons.js ALIASES): the 2026-10-28 rooms
// borrow the nearest glyph until each has its own, and OpenVibe Connect (2026-11-02) is the plug.
const assert = require('assert');
const icons = require('../ov-icons.js');

const fallback = icons.resolve('zz-not-an-icon');
const sites = ['live', 'network', 'tools', 'space', 'website', 'connect', 'shoes', 'tours', 'cam', 'vision', 'design', 'domains', 'report', 'today', 'casino', 'fun', 'meme', 'exchange', 'surf'];
sites.forEach((id) => assert.notStrictEqual(icons.resolve(id), fallback, `${id} draws a real glyph`));
assert.strictEqual(icons.resolve('connect'), 'plug');
console.log(`site icons: ${sites.length} sites draw a real glyph; Connect is the plug`);
