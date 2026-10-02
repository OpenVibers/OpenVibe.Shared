'use strict';
const assert = require('assert');
const seo = require('../seo');
const icons = require('../ov-icons');

const head = seo.headTags({ title: 'A very long title that certainly goes past the sixty character limit for titles', description: 'd', canonical: 'https://openvibe.tools/', jsonLd: [{ '@type': 'Thing', name: '</script><script>alert(1)' }] });
assert.ok(/<title>[^<]{1,62}<\/title>/.test(head), 'title is clipped');
assert.ok(!head.includes('</script><script>alert'), 'JSON-LD cannot close its script tag');
assert.ok(seo.robotsTxt({ sitemaps: ['https://x.test/sitemap.xml'] }).includes('GPTBot'), 'AI crawlers are named');
assert.ok(!seo.sitemapXml([{ loc: '/relative' }, { loc: 'https://ok.test/' }]).includes('/relative'), 'sitemaps hold absolute URLs only');
assert.ok(seo.llmsTxt({ name: 'X', summary: 's', sections: [] }).startsWith('# X'));

{
    const feed = { title: `News & <Notes> "A" 'B'`, link: 'https://x.test/', description: `Fresh & <new> "A" 'B'`, language: 'en',
        selfUrl: '/feed.xml', items: [
            { title: 'First', link: '/one', description: 'One & <b>', content: '<p>Full & body</p>', author: 'Ada',
                published: '2026-10-01T12:34:56Z', updated: new Date('2026-10-03T08:00:00Z') },
            { title: `T & <t> "q" 'a'`, link: `/two?a=1&b="2"'`, guid: 'urn:x:two', published: new Date('2026-10-02T09:00:00Z') },
        ] };
    const rss = seo.feedXml(feed);
    assert.ok(rss.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>'));
    assert.ok(rss.includes(`<title>News &amp; &lt;Notes&gt; &quot;A&quot; &#39;B&#39;</title><link>https://x.test/</link><description>Fresh &amp; &lt;new&gt; &quot;A&quot; &#39;B&#39;</description><language>en</language><lastBuildDate>Sat, 03 Oct 2026 08:00:00 GMT</lastBuildDate><atom:link href="https://x.test/feed.xml" rel="self" type="application/rss+xml"/>`), 'channel elements, updated = newest item');
    assert.ok(rss.includes('<item><title>First</title><link>https://x.test/one</link><guid isPermaLink="true">https://x.test/one</guid><description>One &amp; &lt;b&gt;</description><pubDate>Thu, 01 Oct 2026 12:34:56 GMT</pubDate><author>Ada</author></item>'), 'guid defaults to the link');
    assert.ok(rss.includes('<item><title>T &amp; &lt;t&gt; &quot;q&quot; &#39;a&#39;</title><link>https://x.test/two?a=1&amp;b=%222%22%27</link><guid isPermaLink="false">urn:x:two</guid><pubDate>Fri, 02 Oct 2026 09:00:00 GMT</pubDate></item>'), 'explicit guid, escaped title and link');
    assert.ok(seo.feedXml({ ...feed, items: [{ title: 't', link: `http://a b/<x>&"'` }] }).includes('<link>http://a b/&lt;x&gt;&amp;&quot;&#39;</link>'), 'an unparseable link is still escaped');
    assert.ok(rss.indexOf('<title>First</title>') < rss.indexOf('urn:x:two'), 'items keep their order');
    for (const m of rss.match(/<pubDate>[^<]*<\/pubDate>|<lastBuildDate>[^<]*<\/lastBuildDate>/g)) assert.match(m, />[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT</, 'RFC 822');

    const atom = seo.feedXml(feed, { format: 'atom' });
    assert.ok(atom.includes(`<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en"><id>https://x.test/</id><title>News &amp; &lt;Notes&gt; &quot;A&quot; &#39;B&#39;</title><subtitle>Fresh &amp; &lt;new&gt; &quot;A&quot; &#39;B&#39;</subtitle><updated>2026-10-03T08:00:00.000Z</updated><link rel="alternate" href="https://x.test/"/><link rel="self" href="https://x.test/feed.xml"/>`), 'feed elements, updated = newest item');
    assert.ok(atom.includes('<entry><id>https://x.test/one</id><title>First</title><link href="https://x.test/one"/><published>2026-10-01T12:34:56.000Z</published><updated>2026-10-03T08:00:00.000Z</updated><summary>One &amp; &lt;b&gt;</summary><content type="html">&lt;p&gt;Full &amp; body&lt;/p&gt;</content><author><name>Ada</name></author></entry>'));
    assert.ok(atom.includes(`<entry><id>urn:x:two</id><title>T &amp; &lt;t&gt; &quot;q&quot; &#39;a&#39;</title><link href="https://x.test/two?a=1&amp;b=%222%22%27"/><published>2026-10-02T09:00:00.000Z</published><updated>2026-10-02T09:00:00.000Z</updated></entry>`), 'updated falls back to published');
    for (const m of atom.match(/<(published|updated)>[^<]*</g)) assert.match(m, />\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z</, 'RFC 3339');
    assert.ok(seo.feedXml({ ...feed, updated: '2026-09-01T00:00:00Z' }, { format: 'atom' }).includes('<updated>2026-09-01T00:00:00.000Z</updated><link'), 'feed.updated wins');

    const empty = { title: 'E', link: 'https://x.test/', description: 'd', items: [] };
    assert.match(seo.feedXml(empty), /<channel><title>E<\/title><link>https:\/\/x\.test\/<\/link><description>d<\/description><lastBuildDate>[^<]+GMT<\/lastBuildDate>\n<\/channel><\/rss>\n$/);
    assert.ok(!seo.feedXml(empty).includes('<item>') && !seo.feedXml(empty).includes('atom:link'));
    const emptyAtom = seo.feedXml(empty, { format: 'atom' });
    assert.match(emptyAtom, /<updated>\d{4}-\d{2}-\d{2}T[^<]+Z<\/updated><link rel="alternate" href="https:\/\/x\.test\/"\/>\n<\/feed>\n$/, 'empty feed is updated now');
    assert.ok(!emptyAtom.includes('<entry>') && !emptyAtom.includes('rel="self"'));
    assert.throws(() => seo.feedXml(feed, { format: 'json' }), /rss or atom/);
}

assert.ok(icons.names().length >= 40);
for (const n of icons.names()) assert.ok(/<(path|circle|rect)/.test(icons.svg(n)), `glyph: ${n}`);
assert.equal(icons.resolve('yt'), 'youtube');
assert.equal(icons.resolve('<img onerror=1>'), 'ov', 'unknown names fall back to the mark');
for (const f of ['../island.js', '../ui.js']) { const m = require(f); assert.equal(typeof (m.start || m.toast), 'function', `${f} loads without a DOM`); }
console.log('shared modules: all checks passed');

// The browser bundles must at least evaluate in a bare global (this caught a missing `root` once).
{
    const vm = require('vm'); const fs = require('fs'); const path = require('path');
    for (const f of ['footer.js', 'navbar.js', 'island.js', 'ui.js', 'ov-icons.js', 'history.js', 'sso-client.js', 'panels.js', 'shipped.js']) {
        const ctx = vm.createContext({ console });
        ctx.globalThis = ctx; ctx.window = ctx; ctx.self = ctx;
        ctx.localStorage = { getItem: () => null, setItem() {} }; ctx.location = { hostname: 'openvibe.tools', href: 'https://openvibe.tools/' };
        assert.doesNotThrow(() => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx), `${f} evaluates`);
    }
    const ctx = vm.createContext({ console }); ctx.globalThis = ctx; ctx.window = ctx; ctx.location = { hostname: 'openvibe.media', href: 'https://openvibe.media/' }; ctx.localStorage = { getItem: () => null, setItem() {} };
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'footer.js'), 'utf8'), ctx);
    const html = ctx.OpenVibeFooter.buildHTML({ service: 'media', variant: 'full' });
    assert.ok(html.includes('Legal') && html.includes('ovf-brand'), 'footer renders without chrome data');
    // Every footer carries the "shipped X ago" line and an Updates link (the shared update system).
    assert.ok(html.includes('data-ov-shipped="latest"'), 'the shipped line is in the footer');
    assert.ok(html.includes('https://openvibe.network/updates?site=openvibe.media'), 'Updates defaults to the network log for this host');
    const own = ctx.OpenVibeFooter.buildHTML({ service: 'media', variant: 'compact', updates: '/updates' });
    assert.ok(own.includes('href="/updates"') && own.includes('data-ov-shipped="latest"'), 'a site with its own log links to it, compact too');
    const off = ctx.OpenVibeFooter.buildHTML({ service: 'media', variant: 'full', shipped: false });
    assert.ok(!off.includes('data-ov-shipped') && !off.includes('>Updates<'), 'shipped: false leaves it out');
    for (const [host, id] of [['openvibe.wiki', 'wiki'], ['openvibe.live', 'live'], ['pdf.openvibe.tools', 'pdf'], ['openvibe.tools', 'tools'], ['openre.stream', 'openre']]) {
        const c2 = vm.createContext({ console }); c2.globalThis = c2; c2.window = c2; c2.location = { hostname: host, href: `https://${host}/` }; c2.localStorage = { getItem: () => null, setItem() {} };
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'footer.js'), 'utf8'), c2);
        assert.strictEqual(c2.OpenVibeFooter.detectService(), id, `detectService on ${host}`);
    }
    console.log('browser bundles evaluate: ok');
}
