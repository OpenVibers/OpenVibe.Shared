'use strict';
// 4.236.0 (the owner's phone, 11-13: "support stuff like a replying to area or different content above … more connected
// to the actual composer … improve the send button"): any context sits inside the box with a rail of the accent
// (bar({ icon, title, detail, kind, onClose }), as reply and edit do), and Send with nothing to send is a quiet outline
// that fills with the accent on a spring when there is.
//
//   node test/composer-bar-send.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'ov-composer.js'), 'utf8');

assert.ok(/values, edit, reply, bar: contextBar, clearBar,/.test(src), 'the box answers bar()');
assert.ok(/const contextBar = \(spec = \{\}\) => \{[\s\S]{0,400}showBar\(PATH_OK\.test\(spec\.icon/.test(src), 'a bar of any kind, its icon a checked path');
assert.ok(/\}, 'edit'\);/.test(src) && /was\.onClear\(\); \}, 'reply'\);/.test(src), 'edit and reply say their kind');
assert.ok(/\.ovc-v2 \.ovc-bar::before \{ content: ""; position: absolute; left: 6px;[^}]*background: var\(--ovt-accent/.test(src), 'a rail of the accent at its start');
assert.ok(/\.ovc-v2 \.ovc-bar\[data-kind=edit\]::before \{ background: var\(--warning/.test(src), 'editing wears its own colour');
assert.ok(/\.ovc-v2 \.ovt-send--round:disabled \{ opacity: 1; background: transparent;[^}]*box-shadow: inset 0 0 0 1\.5px/.test(src), 'nothing to send: a quiet outline, not a grey disc');
assert.ok(/\.ovc-v2 \.ovt-send--round:not\(:disabled\) \{ animation: ovcSendReady/.test(src), 'ready: it fills on a spring');
assert.ok(/html\[data-ov-motion=off\] \.ovc-v2 \.ovt-send--round/.test(src) && /html\[data-ov-motion=off\] \.ovc-v2 \.ovc-bar \{ animation: none; \}/.test(src), 'and nothing moves with motion off');
console.log('composer-bar-send: a context bar of any kind inside the box, a quiet Send until there is something to send');
