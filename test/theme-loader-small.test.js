'use strict';
// 4.342.0: the theme loader's display styles give every <small> at least 12 px (an unsized one was the browser's
// "smaller", 10-10.7 px), at no weight, so a site's or part's own small size wins.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'theme-loader.js'), 'utf8');
assert.ok(SRC.includes(":where(small){font-size:max(.75rem,83%)}"), 'the floor, at no weight');
assert.ok(/st\.id = 'ov-display-css';\s*\n[\s\S]{0,400}:where\(small\)\{font-size:max\(\.75rem,83%\)\}/.test(SRC), 'in the display styles every site gets');
console.log('theme-loader-small: every <small> at 12 px or more, and a site\'s own size still wins');
