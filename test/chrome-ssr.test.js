'use strict';
// openvibe-shared/chrome-ssr: the server-side pieces of the shared chrome, including the "shipped"
// block for a home page and the body of a site's /updates page (shipped.js fills both).
const assert = require('assert');
const chrome = require('../chrome-ssr');

const home = chrome.shipped({ service: 'wiki', title: 'Recently shipped on OpenVibe.Wiki <x>' });
assert.ok(home.includes('data-ov-shipped="latest" data-service="wiki" href="/updates"'));
assert.ok(home.includes('data-ov-shipped="list" data-service="wiki" data-limit="5" data-more="/updates"'));
assert.ok(home.includes('data-title="Recently shipped on OpenVibe.Wiki &lt;x&gt;"'), 'title escaped');
assert.ok(home.includes('<noscript><p><a href="/updates">'), 'a plain link without JavaScript');
assert.ok(chrome.shipped({ service: '"><script>' }).includes('data-service=""'), 'a bad id never reaches the markup');

const body = chrome.updatesBody({ service: 'wiki' });
assert.ok(body.includes('<h1>What shipped on OpenVibe.Wiki</h1>'));
assert.ok(body.includes('data-ov-shipped="log" data-service="wiki"'));
assert.ok(body.includes('https://openvibe.network/updates?site=wiki'), 'the no-JavaScript fallback is the network log');
assert.strictEqual(chrome.shippedScript(), '<script src="https://openvibe.network/shared/shipped.js" defer></script>');

const foot = chrome.footer({ service: 'wiki', variant: 'full', updates: '/updates' });
assert.ok(foot.includes('data-ov-shipped="latest"') && foot.includes('href="/updates"'));
console.log('chrome-ssr: all checks passed');
