'use strict';
/** openvibe-shared/shipped: the network changelog rendered as DOM nodes (never HTML), hidden when empty or failing. */
const assert = require('assert');
const { parseHTML } = require('linkedom');

const { window, document } = parseHTML('<!doctype html><html><head></head><body><div id="s"></div><div id="n"></div></body></html>');
globalThis.window = window; globalThis.document = document;
const shipped = require('../shipped');

const data = {
    entries: [
        { service: 'live', subject: 'Fix <img src=x onerror=alert(1)> in chat', url: 'https://github.com/OpenVibers/OpenVibe.Live/commit/abc', deployed_at: new Date(Date.now() - 3 * 3600e3).toISOString(), major: false },
        { service: 'tools', subject: 'Recent tools in the launcher', url: 'javascript:alert(1)', deployed_at: new Date().toISOString(), major: true },
    ],
    latest_post: { title: 'Patch notes: Recent tools', url: 'https://openvibe.blog/@openvibe/patch-notes-recent-tools' },
};

(async () => {
    const node = document.getElementById('s');
    shipped.render(node, data, { limit: 5 });
    assert.strictEqual(node.hidden, false);
    assert.strictEqual(node.querySelector('h3').textContent, 'Recently shipped');
    const items = node.querySelectorAll('li');
    assert.strictEqual(items.length, 2);
    assert.strictEqual(node.querySelectorAll('img').length, 0, 'commit text is text, never markup');
    assert.ok(items[0].textContent.includes('<img src=x'));
    assert.strictEqual(items[0].querySelector('.ov-shipped-site').textContent, 'Live', 'network-wide: each line names its site');
    assert.strictEqual(items[1].querySelector('a'), null, 'a non-https link is not a link');
    assert.ok(items[0].querySelector('time').textContent.endsWith('h ago'));
    assert.strictEqual(node.querySelector('.ov-shipped-notes').getAttribute('href'), data.latest_post.url);

    const one = document.getElementById('n');
    shipped.render(one, data, { service: 'live', title: '' });
    assert.strictEqual(one.querySelector('h3'), null);
    assert.strictEqual(one.querySelector('.ov-shipped-site'), null, 'one site: no site labels');
    shipped.render(one, { entries: [] }, {});
    assert.strictEqual(one.hidden, true, 'nothing shipped: hidden');

    // mount(): the request, and a failure hides the element.
    let asked = null;
    globalThis.fetch = async (url) => { asked = url; return { ok: true, json: async () => data }; };
    await shipped.mount('#s', { service: 'live', limit: 3 });
    assert.strictEqual(asked, 'https://openvibe.blog/api/v1/changelog?service=live&limit=3');
    globalThis.fetch = async () => { throw new Error('offline'); };
    const failed = await shipped.mount('#n', {});
    assert.strictEqual(failed.hidden, true);
    assert.ok(document.getElementById('ov-shipped-style'), 'styles injected once');
    console.log('shipped: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
