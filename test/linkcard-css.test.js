'use strict';
// ov-linkcard.css is the stylesheet ov-linkcard.js injects, as a file for pages that draw link cards on the server
// (4.321.0); OVLinkCard.html() draws the card as HTML with the script's rules. What this proves, without a browser:
//   - the file and the injected CSS are the same rules (no drift between the two);
//   - html() escapes every field, takes only https addresses and OpenVibe.Media pictures, and answers '' otherwise;
//   - its hide form posts only to a same-site path.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const L = require('../ov-linkcard.js');

const file = fs.readFileSync(path.join(__dirname, '..', 'ov-linkcard.css'), 'utf8');
const body = file.replace(/^\/\*[\s\S]*?\*\/\n/, '');
assert.strictEqual(body.trim(), L.CSS.trim(), 'ov-linkcard.css is exactly the CSS the script injects');

const card = L.html({ url: 'https://example.com/a?x=1&y=<b>', title: 'A <b>bold</b> "title"', description: '<img src=x onerror=alert(1)>', site_name: 'Ex<ample>', by: 'ana', image: 'https://openvibe.media/i/a.jpg', kind: 'live', live: true },
    { hideAction: '/rooms/r/messages/5/embeds' });
assert.ok(!/<b>|<img src=x/.test(card), 'no field becomes markup');
assert.ok(card.includes('A &lt;b&gt;bold&lt;/b&gt; &quot;title&quot;') && card.includes('Ex&lt;ample&gt; · by ana'));
assert.ok(card.includes('href="https://example.com/a?x=1&amp;y=%3Cb%3E"'), 'the address, escaped');
assert.ok(card.includes('<span class="ovlc-live">LIVE</span>') && card.includes('class="ovlc-play"'));
assert.ok(card.includes('data-kind="live"') && card.includes('data-ovlc-pic'));
assert.ok(card.includes('<form class="ovlc-hide-form" method="post" action="/rooms/r/messages/5/embeds">'));

assert.strictEqual(L.html({ url: 'javascript:alert(1)', title: 'x' }), '');
assert.strictEqual(L.html({ url: 'http://example.com/', title: 'x' }), '');
assert.strictEqual(L.html({ url: 'https://example.com/' }), '', 'no title, no card');
const third = L.html({ url: 'https://example.com/', title: 't', image: 'https://example.com/pic.png' });
assert.ok(!third.includes('<img') && third.includes('ovlc-plain'), 'a page\'s own picture is never drawn');
for (const bad of ['//evil.example/x', 'https://evil.example/x', '/\\evil', 'javascript:x']) {
    assert.ok(!L.html({ url: 'https://example.com/', title: 't' }, { hideAction: bad }).includes('<form'), `no hide form posting to ${bad}`);
}
assert.strictEqual(L.html(null), '');
console.log('linkcard-css: the stylesheet file matches the script; html() is escaped, https and Media only, same-site forms');
