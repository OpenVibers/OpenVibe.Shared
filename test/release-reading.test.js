'use strict';
// A feed update while reading (D46 scenario 4), release-watch.js + release-update.js in a linkedom page.
// A content release changes a feed region while the person reads the article under it. Checked:
//   - a feed region above the viewport that grows (or shrinks) is replaced and the page scrolls by exactly the
//     change, so what the reader is looking at does not move;
//   - a region the reader is inside keeps its own scroll position;
//   - a region in view is replaced without scrolling the page;
//   - none of it reloads or prompts.
// linkedom has no layout, so each region's box is scripted: its height depends on whether it holds the new text.
// Lines `[metric] name=value` are read by OpenVibe.Host's release-acceptance runner.
const assert = require('assert');
const { openPage, manifestFor } = require('../release-compat');

const URL_ = 'https://site.test/feed';
const A = 'aaaaaaa'; const B = 'bbbbbbb';
const comps = (o) => ({ feed: { kind: 'content', version: 'f1' }, side: { kind: 'content', version: 's1' }, shell: { kind: 'script', version: 'sh1' }, ...o });
const M1 = manifestFor({ service: 'test', release: A, components: comps() });
const M2 = manifestFor({ service: 'test', release: B, components: comps({ feed: { kind: 'content', version: 'f2' }, side: { kind: 'content', version: 's2' } }) });
const PAGE = `<!doctype html><html><head><meta name="ov-release" content="${A}" data-url="/release.json"></head><body>
<section data-ov-content="feed" data-ov-rev="1"><p>old item</p></section>
<article><p>The article the person is reading.</p></article>
<aside data-ov-content="side" data-ov-rev="1"><p>old side</p></aside>
</body></html>`;
const FRESH = `<!doctype html><html><body>
<section data-ov-content="feed" data-ov-rev="2"><p>new item</p><p>new item 2</p></section>
<aside data-ov-content="side" data-ov-rev="2"><p>new side</p></aside>
</body></html>`;

async function open({ feedTop, feedOld, feedNew, sideTop = 200 }) {
    const scrolled = []; const state = { served: M1 };
    const p = await openPage({
        url: URL_, html: PAGE, hidden: false,
        globals: { scrollBy: (x, y) => scrolled.push(y) },
        serve: (u) => {
            const { pathname } = new URL(u);
            if (pathname === '/release.json') return { json: state.served };
            if (pathname === '/feed') return { body: FRESH };
            return { status: 404 };
        },
    });
    const box = (el, top, oldH, newH) => {
        el.getBoundingClientRect = () => { const h = /new/.test(el.textContent) ? newH : oldH; return { top, bottom: top + h, height: h, left: 0, right: 800, width: 800 }; };
    };
    box(p.document.querySelector('section'), feedTop, feedOld, feedNew);
    box(p.document.querySelector('aside'), sideTop, 100, 180);
    await p.settle();
    p.state = state; p.scrolled = scrolled;
    return p;
}

const metrics = { 'feed-reading.position-shift-px': 0, 'feed-reading.in-view-scrolls': 0, 'feed-reading.region-scroll-lost-px': 0, 'feed-reading.reloads': 0, 'feed-reading.prompts': 0 };
const printMetrics = () => { for (const [k, v] of Object.entries(metrics)) console.log(`[metric] ${k}=${v}`); };

(async () => {
    // A feed above the viewport grows by 300 px, or shrinks by 200 px: the page scrolls by that much.
    for (const [oldH, newH] of [[600, 900], [600, 400]]) {
        const p = await open({ feedTop: -1000, feedOld: oldH, feedNew: newH });
        const feed = p.document.querySelector('section');
        feed.scrollTop = 25;   // the feed box scrolled on its own too
        p.state.served = M2;
        await p.release.check(); await p.settle();
        const moved = (newH - oldH) - p.scrolled.reduce((a, b) => a + b, 0);
        metrics['feed-reading.position-shift-px'] = Math.max(metrics['feed-reading.position-shift-px'], Math.abs(moved));
        metrics['feed-reading.region-scroll-lost-px'] = Math.max(metrics['feed-reading.region-scroll-lost-px'], Math.abs(25 - feed.scrollTop));
        metrics['feed-reading.reloads'] += p.reloads; metrics['feed-reading.prompts'] += p.toasts.length;
        assert.match(feed.textContent, /new item 2/, 'the feed is updated');
        assert.strictEqual(p.release.current, B);
        assert.deepStrictEqual(p.scrolled, [newH - oldH], `the page scrolls by the feed's change (${newH - oldH} px), once`);
        assert.strictEqual(moved, 0, 'what the reader looks at does not move');
        assert.strictEqual(feed.scrollTop, 25, 'the feed keeps its own scroll');
        assert.deepStrictEqual([p.reloads, p.toasts.length], [0, 0]);
        p.stop();
    }
    // Everything in view (the feed at the top of the viewport, the aside below it): replaced, no scrolling.
    {
        const p = await open({ feedTop: 0, feedOld: 600, feedNew: 900 });
        p.state.served = M2;
        await p.release.check(); await p.settle();
        metrics['feed-reading.in-view-scrolls'] += p.scrolled.length;
        metrics['feed-reading.reloads'] += p.reloads; metrics['feed-reading.prompts'] += p.toasts.length;
        assert.match(p.document.querySelector('aside').textContent, /new side/);
        assert.deepStrictEqual(p.scrolled, [], 'a region in view is not compensated by the page');
        p.stop();
    }
    assert.strictEqual(metrics['feed-reading.position-shift-px'], 0);
    printMetrics();
    console.log('release reading: all checks passed');
})().catch((e) => { printMetrics(); console.error(e); process.exit(1); });
