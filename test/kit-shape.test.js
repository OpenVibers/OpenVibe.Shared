'use strict';
/**
 * Shape and elevation tokens (4.81.0, plan L45 step 2): the kit's corners and shadows are --ov-radius-1..3 and
 * --ov-elev-1..3, with the kit's own values as defaults, so a look can give a theme a shape. Paper and the quiet looks
 * are square and flat, Neon round and glowing. room.css carries the same tokens and, at zero specificity, the same
 * personalities (it can load without kit.css).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const kit = fs.readFileSync(path.join(__dirname, '..', 'kit.css'), 'utf8');
const room = fs.readFileSync(path.join(__dirname, '..', 'room.css'), 'utf8');

assert.ok(kit.includes('--ov-radius-1: 10px;'), 'radius-1 defaults to the kit\'s own 10px');
assert.ok(kit.includes('--ov-radius-2: 14px;'), 'radius-2 defaults to the kit\'s own 14px');
assert.ok(kit.includes('--ov-radius-3: 20px;'), 'radius-3 is 20px');
assert.match(kit, /--ov-elev-1: [^;]+;/);
assert.match(kit, /--ov-elev-2: [^;]+;/);
assert.match(kit, /--ov-elev-3: [^;]+;/);
assert.ok(kit.includes('--ovk-radius: var(--ov-radius-2);') && kit.includes('--ovk-radius-sm: var(--ov-radius-1);'), 'the kit\'s own radius names follow the tokens');
assert.doesNotMatch(kit, /border-radius: (8|10|12|14|18|20)px/, 'no corner of the kit is a literal any more (pills and circles stay)');
assert.ok(kit.includes('box-shadow: var(--ov-elev-3);') && kit.includes('box-shadow: var(--ov-elev-2);') && kit.includes('box-shadow: var(--ov-elev-1);'), 'the kit\'s shadows are the elevation tokens');
assert.match(kit, /:is\(\[data-theme=paper\][^{]*\) \{\s*--ov-radius-1: 4px; --ov-radius-2: 6px; --ov-radius-3: 10px;/, 'Paper is square');
assert.match(kit, /:is\(\[data-theme=neon-tokyo\][^{]*\) \{\s*--ov-radius-1: 14px; --ov-radius-2: 20px; --ov-radius-3: 28px;/, 'Neon is round');
assert.match(kit, /--ov-elev-3: 0 0 0 1px color-mix\(in srgb, var\(--ovk-accent\)/, 'and Neon\'s raised things glow in its accent');
assert.match(room, /:where\(\[data-theme=paper\][^{]*\) \{\s*--ov-radius-1: 4px;/, 'room.css: the same personalities at zero specificity');
assert.match(room, /:where\(\[data-theme=neon-tokyo\][^{]*\) \{\s*--ov-radius-1: 14px;/);
// Motion (4.82.0): ov-fx.js's tokens, in kit.css too, so var(--ov-dur-*) resolves on every page and Reduced reaches it.
assert.ok(kit.includes('--ov-dur-1: .12s;') && kit.includes('--ov-dur-4: .52s;') && kit.includes('--ov-ease-out: cubic-bezier(.2, .8, .2, 1);'), 'the motion tokens, as ov-fx.js sets them');
assert.match(kit, /html\[data-ov-motion=reduced\] \{ --ov-dur-1: 0s;/, 'Reduced motion stops them');
assert.match(kit, /@media \(prefers-reduced-motion: reduce\) \{ :root:root \{ --ov-dur-1: 0s;/, 'and so does a device that asks for less, over ov-fx.js\'s own :root');
assert.match(kit, /:is\(\[data-theme=paper\][^{]*\) \{\s*--ov-dur-1: \.15s;/, 'Paper is calm');
const fx = fs.readFileSync(path.join(__dirname, '..', 'ov-fx.js'), 'utf8');
assert.ok(fx.includes('--ov-dur-1:.12s;--ov-dur-2:.2s;--ov-dur-3:.32s;--ov-dur-4:.52s'), 'the same values as ov-fx.js');
console.log('kit-shape: tokens, the kit on them, the personalities and the motion');
