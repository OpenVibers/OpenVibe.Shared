'use strict';
// navbar.js loads ov-mark.js, ov-glyphs.js and the brand face from beside itself by content hash (4.61.0): a release
// gives each a new URL, so no edge serves the copy it cached before the deploy (the old mark showed some minutes after
// 4.59.0). The constant must match the files: node scripts/sibling-revs.js rewrites it.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { revs, line, OWN, table } = require('../scripts/sibling-revs');

const src = fs.readFileSync(path.join(__dirname, '..', 'navbar.js'), 'utf8');
assert.ok(src.includes(line(revs())), 'SIBLING_REV is current: run node scripts/sibling-revs.js');
assert.ok(/const siblingV = \(name\) => `\$\{sibling\(name\)\}\$\{SIBLING_REV\[name\] \? `\?v=\$\{SIBLING_REV\[name\]\}` : ''\}`;/.test(src), 'siblingV adds the hash');
assert.ok(src.includes("sc.src = siblingV('ov-mark.js')") && src.includes("url(${siblingV('ov-brand.woff2')})") && src.includes("sc.src = siblingV('ov-glyphs.js')"), 'the mark, the face and the glyphs load by hash');
assert.ok(/GLYPH_ICONS = 'i\[class\*="fa-"\]/.test(src), 'the glyphs load where Font Awesome is used, unless a site says glyphs: false');
assert.ok(/glyphWatch = new MutationObserver[\s\S]{0,300}glyphWatch\.disconnect\(\)/.test(src), 'and when the page adds its first icon later, then the watch ends');
assert.ok(/_config\.glyphs !== false\) watchGlyphs\(\)/.test(src), 'the render only asks; the one watch lives outside it (a Boost page move re-renders the bar)');
// 4.137.0 (2026-11-07): every script the navbar, the Dock and the notifications load from beside themselves goes by its
// content hash. Without it a release reached phones up to a day late (max-age=300, stale-while-revalidate=86400).
assert.strictEqual((src.match(/[^V]sibling\('[a-z0-9-]+\.(js|css)'\)/g) || []).filter((m) => !/nav-icons\.js/.test(m)).length, 0, 'no sibling script loads without its hash (use siblingV)');
for (const [file, { name, files }] of Object.entries(OWN)) {
    const own = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.ok(own.includes(table(name, files)), `${file}'s ${name} is current: run node scripts/sibling-revs.js`);
}
const dock = fs.readFileSync(path.join(__dirname, '..', 'dock.js'), 'utf8');
assert.ok(dock.includes("sc.src = sibling(src) + (DOCK_REV[src] ? `?v=${DOCK_REV[src]}` : '');"), 'the Dock loads its siblings by hash');
// 4.138.0: the footer, Boost and the glyphs load theirs by hash too; the footer's shipped.js and the glyphs' brands.js
// wait until the footer (or a logo) comes near the screen.
const footer = fs.readFileSync(path.join(__dirname, '..', 'footer.js'), 'utf8');
assert.ok(/if \(_cfg\.shipped !== false\) shippedWhenNear\(_mounted\);/.test(footer), 'the footer fetches shipped.js when it nears the screen');
assert.ok(footer.includes("sc.src = src + (FOOTER_REV['shipped.js'] ? `?v=${FOOTER_REV['shipped.js']}` : '');"), 'and by its hash');
const glyphsOut = fs.readFileSync(path.join(__dirname, '..', 'ov-glyphs.js'), 'utf8');
assert.ok(/const BRANDS_REV = '[0-9a-f]{12}';/.test(glyphsOut) && glyphsOut.includes('waiting.add(el); wantBrands(el);'), 'brands.js by hash, when a logo nears the screen');
const boost = fs.readFileSync(path.join(__dirname, '..', 'boost.js'), 'utf8');
assert.ok(/BOOST_REV\['route-transition\.js'\]/.test(boost), 'route-transition.js by hash');
console.log('sibling revs: every script the navbar, the Dock, the notifications, the footer, Boost and the glyphs load goes by its content hash');
