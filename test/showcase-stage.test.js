'use strict';
// Homes v2 (showcase-stage.js): the stage, the reel, the numbers and the flow render server-side with the real words and
// numbers in them, escape what they are given, draw every motif, keep motion off SVG children's transforms, and stop all
// motion for reduced motion and the Calm setting.
//   node test/showcase-stage.test.js
const assert = require('assert');
const st = require('../showcase-stage');

const stage = st.stage({ title: 'Your files, <b>yours</b>', accent: 'shared your way', lede: 'A drive with 25 GB free.', actions: [{ label: 'Your files', href: '/files?a=1&b=2', primary: true }], demo: '<ul class="x"><li>holiday-cut.mp4</li></ul>', frame: 'window', motif: 'planes', label: 'A file being shared' });
assert.match(stage, /^<section class="sc-stage sc-motif-planes" data-sc-in>/);
assert.ok(stage.includes('<h1>Your files, &lt;b&gt;yours&lt;/b&gt;<span class="sc-accent"> shared your way</span></h1>'), 'one H1, escaped, with its accent');
assert.ok(stage.includes('href="/files?a=1&amp;b=2"'), 'links are escaped');
assert.ok(stage.includes('<ul class="x"><li>holiday-cut.mp4</li></ul>'), "the demo is the site's own HTML, in the page");
assert.ok(stage.includes('role="figure" aria-label="A file being shared"'), 'the demo is labelled');
assert.ok(stage.includes('sc-frame-bar'), 'a window frame has its bar');
assert.ok(!/class="sc-eyebrow"/.test(stage), 'no pill above the headline');

for (const m of st.MOTIFS) {
    const svg = st.motifSVG(m);
    assert.match(svg, /^<svg class="sc-motif" viewBox="0 0 600 400"[^>]*aria-hidden="true"/, `${m} draws`);
    assert.ok(!/NaN|undefined/.test(svg), `${m} has numbers only`);
}
assert.ok(st.MOTIFS.length >= 12, 'a motif for each kind of site');

const reel = st.reel({ title: 'What it does', items: [{ title: 'Share a link', text: 'For named people or anyone.', icon: 'ov:link', href: '/share' }, { title: 'Back up', text: 'One command.' }] });
assert.ok(reel.includes('<h2 id="what-it-does">What it does</h2>') && reel.includes('<h3>Share a link</h3>'), 'headings for each card');
assert.ok(/data-anim="(float|pulse|tilt|pop|glow)"/.test(reel), 'each card has a motion');
assert.strictEqual(st.reel({ items: [] }), '', 'no items, no section');

const nums = st.numbers({ title: 'Today', items: [{ value: 1204, label: 'people', series: [1, 3, 2, 5] }, { value: null, label: 'skipped' }, { value: 3.5, label: 'GB', unit: 'GB' }] });
assert.ok(nums.includes('<b data-to="1204">1,204</b>'), 'the final number is in the page');
assert.ok(!nums.includes('skipped'), 'an unknown number is left out, never a placeholder');
assert.ok(nums.includes('<b data-to="">3.5</b>'), 'a fraction is shown, not rolled');
assert.ok(nums.includes('<polyline points="'), 'a line when there is a series');

const flow = st.flow({ title: 'How it works', steps: [{ title: 'Pick a file' }, { title: 'Share it' }, { title: 'Done' }] });
assert.strictEqual((flow.match(/<li /g) || []).length, 3);

// Motion rules.
assert.ok(!/\.sc-motif [^{]*\{[^}]*transform/.test(st.CSS), 'no CSS transform on anything inside the motif SVG');
assert.ok(/@media \(prefers-reduced-motion:reduce\)/.test(st.CSS) && /html\[data-ov-motion=reduced\]/.test(st.CSS), 'reduced motion and Calm stop it');
assert.ok(/IntersectionObserver/.test(st.MOTION_JS) && /prefers-reduced-motion/.test(st.MOTION_JS), 'it starts in view and stays still when asked');
console.log('showcase-stage: stage, reel, numbers and flow render whole, escaped, with motifs and motion that can stop');
