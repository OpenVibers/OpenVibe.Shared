'use strict';
// kit.mark and kit.card ask Media for a resize width instead of the original upload (4.87.0): Report and Community drew a
// 3072 px, 3 MB avatar at 34 px, and Community a 2460 px picture in a 280 px card.
const assert = require('assert');
const kit = require('../kit');

const obj = 'https://openvibe.media/o/med_01M0E4X90R0VPTR7JBXFXC2Y38';
assert.strictEqual(kit.mediaW(obj, 96), `${obj}?w=96`);
assert.strictEqual(kit.mediaW(`${obj}?w=64`, 96), `${obj}?w=64`, 'a URL that already has a query is left alone');
assert.strictEqual(kit.mediaW('https://openvibe.media/t/vod-1.jpg', 96), 'https://openvibe.media/t/vod-1.jpg', 'thumbnails are already small');
assert.strictEqual(kit.mediaW('https://example.com/a.png', 96), 'https://example.com/a.png');
assert.strictEqual(kit.mediaW('javascript:alert(1)', 96), '#', 'still sanitised like kit.url');

assert.match(kit.mark({ name: 'a', src: obj }), new RegExp(`src="${obj}\\?w=96"`), 'a 40 px mark asks for 96');
assert.match(kit.mark({ name: 'a', src: obj, size: 64 }), new RegExp(`src="${obj}\\?w=160"`), 'a bigger mark asks for 160');
assert.match(kit.card({ title: 't', href: '/x', image: obj }), new RegExp(`<img src="${obj}\\?w=640"`), 'a card picture asks for 640');
console.log('kit media width: all checks passed');
