'use strict';
/** openvibe-shared/shipped: the network changelog rendered as DOM nodes (never HTML), hidden when empty or failing. */
const assert = require('assert');
const { parseHTML } = require('linkedom');

const { window, document } = parseHTML('<!doctype html><html><head></head><body><div id="s"></div><div id="n"></div><a id="pill" href="/updates"></a><div id="log"></div></body></html>');
globalThis.window = window; globalThis.document = document;
globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });   // the load-time scan never reaches the network
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
    assert.strictEqual(asked, 'https://openvibe.network/api/v1/changelog?service=live&limit=3', 'the Network proxy every site\'s CSP already allows');
    globalThis.fetch = async () => { throw new Error('offline'); };
    const failed = await shipped.mount('#n', {});
    assert.strictEqual(failed.hidden, true);
    assert.ok(document.getElementById('ov-shipped-style'), 'styles injected once');

    // latest: the one-liner keeps the element's own link and never renders markup.
    const pill = document.getElementById('pill');
    shipped.renderLatest(pill, data, { service: 'live' });
    assert.strictEqual(pill.hidden, false);
    assert.strictEqual(pill.getAttribute('href'), '/updates');
    assert.ok(/shipped/.test(pill.textContent) && pill.querySelector('b').textContent.startsWith('Fix <img'));
    assert.strictEqual(pill.querySelectorAll('img').length, 0);
    assert.ok(pill.querySelector('time[data-ov-ago]'));
    shipped.renderLatest(pill, { entries: [] }, {});
    assert.strictEqual(pill.hidden, true, 'nothing shipped: the pill hides');
    const net = document.createElement('a');
    shipped.renderLatest(net, data, {});
    assert.ok(net.textContent.includes('Live shipped'), 'network-wide: the pill names the site');

    // list: an "All updates" link only for a local or https path.
    shipped.render(one, data, { service: 'live', more: '/updates' });
    assert.strictEqual(one.querySelector('.ov-shipped-links a').getAttribute('href'), '/updates');
    shipped.render(one, data, { service: 'live', more: 'javascript:alert(1)' });
    assert.ok(![...one.querySelectorAll('.ov-shipped-links a')].some((a) => /javascript/.test(a.getAttribute('href'))));

    // log: day groups continue across pages; the site label only network-wide.
    const box = document.createElement('div');
    const at = (h) => new Date(Date.UTC(2026, 8, 24, h)).toISOString();
    shipped.appendDays(box, [{ service: 'live', sha: 'a'.repeat(40), short: 'aaaaaaa', subject: 'one', author: 'OpenVibers', deployed_at: at(12), url: 'https://github.com/x/y/commit/a' }], true);
    shipped.appendDays(box, [{ service: 'tools', sha: 'b'.repeat(40), subject: 'two', deployed_at: at(11), url: 'https://github.com/x/y/commit/b' }], true);
    assert.strictEqual(box.querySelectorAll('.ov-shipped-day').length, 1, 'the same day continues');
    assert.strictEqual(box.querySelectorAll('.ov-shipped-entry').length, 2);
    assert.strictEqual(box.querySelectorAll('.ov-shipped-site').length, 2);
    assert.ok(box.querySelector('.ov-shipped-meta').textContent.startsWith('OpenVibers · '));
    assert.strictEqual(box.querySelectorAll('.ov-shipped-hash')[1].textContent, 'bbbbbbb', 'short sha from the full sha');

    // serviceFor: hosts to registry ids.
    const sf = shipped.serviceFor;
    assert.strictEqual(sf('openvibe.wiki'), 'wiki');
    assert.strictEqual(sf('pdf.openvibe.tools'), 'tools');
    assert.strictEqual(sf('my.openvibe.network'), 'network');
    assert.strictEqual(sf('events.openvibe.network'), 'events');
    assert.strictEqual(sf('ingest.openre.stream'), 'openre');
    assert.strictEqual(sf('www.openvibe.live'), 'live');
    assert.strictEqual(sf('example.com'), null);
    assert.strictEqual(sf('live'), 'live');

    // log(): pages with the cursor, and the "Load more" button disappears on the last page.
    const calls = [];
    const page1 = { entries: [{ service: 'wiki', sha: 'c'.repeat(40), subject: 'three', deployed_at: at(10) }], next: 'CUR', posts: [{ title: 'Patch notes: x', url: 'https://openvibe.blog/@openvibe/x', published_at: at(9), entries: 40 }], sites: [{ service: 'wiki' }] };
    const page2 = { entries: [{ service: 'wiki', sha: 'd'.repeat(40), subject: 'four', deployed_at: at(8) }], next: null, posts: [] };
    globalThis.fetch = async (url) => { calls.push(url); return { ok: true, json: async () => (url.includes('before=CUR') ? page2 : page1) }; };
    const logEl = document.getElementById('log');
    await shipped.log(logEl, { service: 'wiki', api: 'https://example.test/api/v1/changelog' });
    assert.ok(logEl.textContent.includes('three'));
    assert.strictEqual(logEl.querySelector('.ov-shipped-posts a').getAttribute('href'), 'https://openvibe.blog/@openvibe/x');
    const more = logEl.querySelector('.ov-shipped-more');
    assert.strictEqual(more.hidden, false);
    assert.deepStrictEqual([...logEl.querySelectorAll('.ov-shipped-chip')].map((b) => b.textContent), ['Wiki', 'All of OpenVibe']);
    more.dispatchEvent(new window.Event('click'));
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(calls.some((u) => u.includes('before=CUR') && u.includes('service=wiki')));
    assert.ok(logEl.textContent.includes('four'));
    assert.strictEqual(more.hidden, true, 'no next cursor: no button');

    // scan(): markup mounts once.
    globalThis.fetch = async () => ({ ok: true, json: async () => data });
    const autoEl = document.createElement('section');
    autoEl.id = 'auto';
    for (const [k, v] of Object.entries({ 'data-ov-shipped': 'list', 'data-service': 'wiki', 'data-limit': '2', 'data-more': '/updates', 'data-api': 'https://example.test/feed' })) autoEl.setAttribute(k, v);
    document.body.appendChild(autoEl);
    const first = shipped.scan(document);
    assert.strictEqual(first.length, 1);
    await Promise.all(first);
    const auto = document.getElementById('auto');
    assert.ok(auto.hasAttribute('data-ov-shipped-mounted'));
    assert.strictEqual(auto.querySelectorAll('li').length, 2);
    assert.strictEqual(shipped.scan(document).length, 0, 'already mounted: not again');
    console.log('shipped: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
