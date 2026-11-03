'use strict';
// A name card never waits on a restarting service (11-03: Maticus's Live name card sat on "Loading..." for minutes
// while a deploy round restarted Chat). The shared profile panel and user card give a lookup eight seconds, and the
// panel does not keep a failed lookup, so a later click on the same name asks again.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const panel = read('profile-panel.js');
assert.match(panel, /AbortSignal\.timeout\(8000\)/);
assert.match(panel, /headers: \{ Accept: 'application\/json' \}, signal \}\)/, 'the panel\'s lookup carries the limit');
assert.match(panel, /\.catch\(\(\) => \{ seen\.delete\(username\); return null; \}\)/, 'a failed lookup is not kept');
const card = read('user-card.js');
assert.match(card, /AbortSignal\.timeout\(8000\)/);
assert.match(card, /credentials: 'include', signal \}\)/, 'the card\'s lookup carries the limit');
console.log('card fetch limits: ok');
