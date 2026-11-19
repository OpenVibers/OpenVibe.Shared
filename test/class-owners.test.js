'use strict';
// The face module and the footer each own their class names (4.325.0; the owner, 11-19: "A lot of these icons are the
// wrong aspect ratio"): ov-face.js drew faces with .ovf, the footer's root class, and the footer's padding stretched
// every face on a page with the footer. The face module uses ovface… only, and nothing else styles a face's names.
//   node test/class-owners.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const face = read('ov-face.js');
const footer = read('footer.js');
assert.ok(!/(?<![A-Za-z0-9_-])ovf(?:-[a-z]+)*(?![A-Za-z0-9_-])/.test(face.replace(/`ovf` is the shared footer's/g, '')), 'ov-face.js uses no ovf name (the footer\'s)');
assert.ok(/\.ovface\s*\{/.test(face), 'ov-face.js styles its faces as .ovface');
assert.ok(!/ovface/.test(footer), 'the footer styles no ovface name');
// No other shared file styles the face's names: a face looks the same on every surface.
const others = fs.readdirSync(root).filter((x) => x.endsWith('.js') && x !== 'ov-face.js');
const styling = others.filter((f) => /\.ovface[a-z-]*\s*[{,]/.test(read(f)));
assert.deepStrictEqual(styling, [], 'only ov-face.js styles a face name');
console.log('class-owners: the faces own ovface…, the footer owns ovf…');
