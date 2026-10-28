'use strict';
// The footer's 'auto' variant (footer.js; the owner, 2026-10-28: "the full-size footer on the chat pages might be a
// little much … if we want to have that app-like design … make it a little more sleeker across sites"): the full footer
// on a site's front page (and the paths it names in fullOn), the one quiet line everywhere else, on the server as in the
// browser, and a claim still wins.
const assert = require('assert');
const footer = require('../footer');

assert.strictEqual(footer.autoFor('/', ['/']), 'full');
assert.strictEqual(footer.autoFor('/?ref=x', ['/']), 'full', 'a query is not another page');
assert.strictEqual(footer.autoFor('/r/staff/tasks/1', ['/']), 'compact');
assert.strictEqual(footer.autoFor('/updates/', ['/', '/updates']), 'full', 'a trailing slash is the same path');
assert.strictEqual(footer.autoFor('/updates', undefined), 'compact', 'fullOn defaults to the front page');
assert.strictEqual(footer.autoFor(undefined, ['/']), 'compact', 'no path on the server: compact');

const ssr = (cfg) => (/class="ovf" data-variant="(\w+)"/.exec(footer.ssr({ service: 'chat', ...cfg })) || [])[1];
assert.strictEqual(ssr({ variant: 'auto', path: '/' }), 'full');
assert.strictEqual(ssr({ variant: 'auto', path: '/messages/12' }), 'compact');
assert.strictEqual(ssr({ variant: 'auto', path: '/developers', fullOn: ['/', '/developers'] }), 'full');
assert.strictEqual(ssr({ variant: 'full', path: '/messages/12' }), 'full', 'full stays full');
assert.strictEqual(ssr({ variant: 'compact', path: '/' }), 'compact', 'compact stays compact');

// In the browser: the page's path decides, a claim wins over it, and setVariant('auto') is a variant like the others
// (unmounted here: the variant is what a render would draw).
global.location = { pathname: '/', hostname: 'openvibe.chat' };
footer.setVariant('auto');
assert.strictEqual(footer.variant, 'full', 'the front page');
global.location.pathname = '/r/staff';
assert.strictEqual(footer.variant, 'compact', 'a room');
const release = footer.claim('full', 'test');
assert.strictEqual(footer.variant, 'full', 'a claim wins');
release();
assert.strictEqual(footer.variant, 'compact');
footer.setVariant('full');
assert.strictEqual(footer.variant, 'full');
footer.setVariant('nonsense');
assert.strictEqual(footer.variant, 'full', 'an unknown variant changes nothing');
footer.setVariant('auto');
assert.strictEqual(footer.variant, 'compact');
delete global.location;

console.log('footer-auto: all checks passed');
