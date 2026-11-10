'use strict';
// Every live site's launcher icon is a real glyph, never the fallback mark (ov-icons.js ALIASES): the 2026-10-28 rooms
// borrow the nearest glyph until each has its own, and OpenVibe Connect (2026-11-02) is the plug.
const assert = require('assert');
const icons = require('../ov-icons.js');

const fallback = icons.resolve('zz-not-an-icon');
// 4.182.0: every product on the network (the ids Live's and Network's site grids ask for), and the things sites
// name as marks. Five products drew the fallback "V" in those grids; a sweep of every home found them.
const sites = ('live chat games community network tools design quest wiki blog video cam codes actor bot exchange report deals coupons food reviews rent work help events news meme fun casino surf tours trade tips vip vision watch zone space host run domains today media my services computer mail lock locker git barcode link party studio pics drive email bench billing inventory search sources mediahub media-hub openre restream website connect play home node shoes'
    + ' shoe heart calendar camera').split(' ');
sites.forEach((id) => assert.notStrictEqual(icons.resolve(id), fallback, `${id} draws a real glyph`));
assert.strictEqual(icons.resolve('connect'), 'plug');
console.log(`site icons: ${sites.length} sites draw a real glyph; Connect is the plug`);
