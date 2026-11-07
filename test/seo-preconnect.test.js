'use strict';
// 4.135.0: every page opens its connection to openvibe.network early (the bar, sign-in and the menu all ask it), except
// the Network's own pages and a page that says preconnect: false. And kit.askAgent draws the "Ask your agent" chip.
const assert = require('assert');
const seo = require('../seo');
const kit = require('../kit');

const tag = '<link rel="preconnect" href="https://openvibe.network" crossorigin>';
assert.ok(seo.headTags({ title: 'Live', canonical: 'https://openvibe.live/' }).includes(tag), 'a product page preconnects');
assert.ok(!seo.headTags({ title: 'Network', canonical: 'https://openvibe.network/my' }).includes(tag), 'not on the Network itself');
assert.ok(!seo.headTags({ title: 'Kiosk', canonical: 'https://openvibe.live/tv', preconnect: false }).includes(tag), 'and not when a page says no');

const chip = kit.askAgent({ text: 'About this stream: <b>night walk</b>' });
assert.match(chip, /^<button class="ovk-ask ovk-btn/, 'a button, styled as the ask chip');
assert.match(chip, /type="button"/);
assert.match(chip, /data-ov-ask="About this stream: &lt;b&gt;night walk&lt;\/b&gt;"/, 'the question, escaped');
assert.match(chip, />Ask your agent</);
assert.strictEqual((kit.askAgent({ text: 'x'.repeat(3000) }).match(/data-ov-ask="(x+)"/) || [])[1].length, 2000, 'capped at 2,000 characters');
console.log('seo-preconnect: preconnect on product pages only; kit.askAgent draws an escaped, capped ask chip');
