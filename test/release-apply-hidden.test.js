'use strict';
// An optional release applies itself while nobody is looking (release-watch.js; owner, 2026-10-27: "make sure people are
// on the latest version … if the client needs to update or something, it should just be self-aware or intelligently do
// that"). A release that only prompts (no components, not required) used to wait for the Reload button forever.
//   - visible: the prompt only, never a reload under the reader;
//   - hidden 30 s with nothing protected: it reloads, and saves the scroll position for the same address;
//   - hidden but busy (a live camera, playing media, a protected element): deferred;
//   - OVReleaseConfig.autoApply === false: never by itself.
const assert = require('assert');
const { openPage, manifestFor } = require('../release-compat');

const A = 'aaaaaaa'; const B = 'bbbbbbb';
const M1 = manifestFor({ service: 'test', release: A });
const M2 = manifestFor({ service: 'test', release: B });
const PAGE = (extra = '') => `<!doctype html><html><head><meta name="ov-release" content="${A}" data-url="/release.json"></head><body><p>Reading.</p>${extra}</body></html>`;

async function open({ hidden = false, html = PAGE(), config = null } = {}) {
    const state = { served: M1 }; const stored = {};
    const p = await openPage({
        url: 'https://site.test/article?x=1', html, hidden, config,
        globals: { scrollY: 840, sessionStorage: { getItem: (k) => (k in stored ? stored[k] : null), setItem: (k, v) => { stored[k] = String(v); }, removeItem: (k) => { delete stored[k]; } } },
        serve: (u) => (new URL(u).pathname === '/release.json' ? { json: state.served } : { status: 404 }),
    });
    await p.settle();
    p.state = state; p.stored = stored;
    return p;
}
const thirty = (ms) => ms === 30 * 1000;

(async () => {
    // Visible: a new release prompts and never reloads under the reader.
    let p = await open();
    p.state.served = M2;
    await p.release.check(); await p.settle();
    assert.strictEqual(p.reloads, 0, 'not while visible');
    // Hidden: 30 s later it applies, coming back at the same scroll position.
    p.setHidden(true); await p.settle();
    assert.ok(p.timeouts().includes(30 * 1000), 'waits 30 s in the background');
    p.fireTimeouts(thirty); await p.settle();
    assert.strictEqual(p.reloads, 1, 'reloaded while hidden');
    const saved = JSON.parse(p.stored['ov-release-scroll']);
    assert.deepStrictEqual([saved.path, saved.y], ['/article?x=1', 840], 'the scroll position for this address');
    p.stop();

    // Back before the 30 s: nothing happens.
    p = await open();
    p.state.served = M2;
    await p.release.check(); await p.settle();
    p.setHidden(true); await p.settle();
    p.setHidden(false); await p.settle();
    p.fireTimeouts(thirty); await p.settle();
    assert.strictEqual(p.reloads, 0, 'the reader came back: no reload');
    p.stop();

    // Hidden, but something protected on the page (a live camera, a dirty form): deferred, not reloaded.
    p = await open({ html: PAGE('<div data-ov-protected></div>') });
    p.state.served = M2;
    await p.release.check(); await p.settle();
    p.setHidden(true); await p.settle();
    p.fireTimeouts(thirty); await p.settle();
    assert.strictEqual(p.reloads, 0, 'protected: deferred');
    p.stop();

    // A site that opts out never reloads by itself.
    p = await open({ config: { autoApply: false } });
    p.state.served = M2;
    await p.release.check(); await p.settle();
    p.setHidden(true); await p.settle();
    p.fireTimeouts(thirty); await p.settle();
    assert.strictEqual(p.reloads, 0, 'autoApply false');
    p.stop();

    // Found while already in the background (the 10-minute poll): applies 30 s later.
    p = await open({ hidden: true });
    p.state.served = M2;
    await p.release.check(); await p.settle();
    p.fireTimeouts(thirty); await p.settle();
    assert.strictEqual(p.reloads, 1, 'found while hidden');
    p.stop();
    console.log('release apply hidden: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
