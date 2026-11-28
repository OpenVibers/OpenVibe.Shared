'use strict';
// Every page with the bar handles a cross-document view transition's promises (4.339.0): a transition aborted by a move
// to a page without the opt-in, or by a resize, leaves no unhandled rejection (Live's RUM, 11-28: "Transition was
// aborted because of invalid state"), and a replace navigation (a redirect) skips its transition.
const assert = require('assert');
const path = require('path');

const listeners = {};
global.window = global;
global.addEventListener = (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); };
global.location = { href: 'https://openvibe.live/', hostname: 'openvibe.live', protocol: 'https:' };
global.document = { readyState: 'complete', cookie: '', addEventListener() {}, querySelector() { return null; }, getElementById() { return null; } };

const unhandled = [];
process.on('unhandledRejection', (e) => unhandled.push(String(e && e.message)));

require(path.join(__dirname, '..', 'navbar.js'));
assert.strictEqual((listeners.pageswap || []).length, 1, 'pageswap is handled');
assert.strictEqual((listeners.pagereveal || []).length, 1, 'pagereveal is handled');

const aborted = () => Promise.reject(Object.assign(new Error('Transition was aborted because of invalid state. ViewTransition opt-in disabled'), { name: 'InvalidStateError' }));
let skipped = 0;
const event = (navigationType) => ({ viewTransition: { finished: aborted(), ready: aborted(), updateCallbackDone: aborted(), skipTransition() { skipped++; } }, activation: navigationType ? { navigationType } : null });

listeners.pagereveal[0](event('push'));
listeners.pageswap[0](event('replace'));
listeners.pagereveal[0]({});   // no transition: nothing to do

setTimeout(() => {
    assert.deepStrictEqual(unhandled, [], 'no rejection is left unhandled');
    assert.strictEqual(skipped, 1, 'only the redirect skips its transition');
    // Loading the bar twice (two copies on one page) listens once.
    delete require.cache[require.resolve(path.join(__dirname, '..', 'navbar.js'))];
    require(path.join(__dirname, '..', 'navbar.js'));
    assert.strictEqual(listeners.pageswap.length, 1, 'listened once');
    console.log('view-transition-quiet: an aborted page transition rejects nothing unhandled; a redirect skips its transition');
}, 20);
