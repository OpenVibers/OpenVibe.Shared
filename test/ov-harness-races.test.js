'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseHTML } = require('linkedom');
const src = fs.readFileSync(path.join(__dirname, '..', 'ov-harness.js'), 'utf8');
const tick = () => new Promise((resolve) => setImmediate(resolve));
const run = (id) => ({ ref: `codes:${id}`, kind: 'code', title: id, status: 'done', target: { repo: `owner/${id}` }, outputs: [{ kind: 'pr', title: `${id} PR`, url: `https://github.com/owner/${id}/pull/1` }] });

(async () => {
    const { window, document } = parseHTML('<html><head></head><body><div id="host"></div></body></html>');
    window.OpenVibeRun = { mount: () => ({ destroy() {} }) };
    const pending = [], timers = new Map(); let id = 0;
    const fetch = (url) => new Promise((resolve) => pending.push({ url, resolve: (body) => resolve({ ok: true, json: async () => body }) }));
    new Function('window', 'document', 'fetch', 'setTimeout', 'clearTimeout', src)(window, document, fetch,
        (fn) => { timers.set(++id, fn); return id; }, (key) => timers.delete(key));
    const host = document.getElementById('host');
    const h = window.OpenVibeHarness.page(host);
    pending.shift().resolve({ runs: [] }); await tick();

    h.open('codes:a'); const a = pending.shift();
    h.open('codes:b'); const b = pending.shift();
    b.resolve(run('b')); await tick();
    a.resolve(run('a')); await tick();
    assert.equal(host.querySelector('.ovhr-head b').textContent, 'owner/b', 'a late A cannot overwrite B');
    assert.equal(host.querySelector('.ovhr-outs a').href, 'https://github.com/owner/b/pull/1');

    h.open('codes:a'); const blanked = pending.shift();
    h.blank(); blanked.resolve(run('a')); await tick();
    assert.equal(host.querySelector('.ovhr-head').textContent, '', 'New task stays blank');
    assert.equal(host.querySelectorAll('.ovhr-outs a').length, 0);

    const oldRefresh = h.refresh(); const oldList = pending.shift();
    const newRefresh = h.refresh(); const newList = pending.shift();
    newList.resolve({ runs: [run('b')] }); await newRefresh;
    oldList.resolve({ runs: [run('a')] }); await oldRefresh;
    assert.equal(host.querySelector('.ovhr-row').dataset.ref, 'codes:b', 'older refresh cannot roll back the list');

    h.open('codes:a'); const gone = pending.shift();
    const detached = host.firstElementChild;
    h.destroy(); const before = detached.outerHTML;
    gone.resolve(run('a')); await tick();
    assert.equal(detached.outerHTML, before, 'destroyed view is not redrawn');
    await h.refresh();
    assert.equal(pending.length, 0, 'destroyed view starts no more requests');
    assert.equal(timers.size, 0);
    console.log('ov-harness-races: navigation, refresh and destroy passed');
})().catch((err) => { console.error(err); process.exitCode = 1; });
