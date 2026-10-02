'use strict';
const assert = require('assert');
const seo = require('../seo');

for (const name of ['llmsFull', 'pageSummary', 'feedXml', 'feedLinkTags']) assert.strictEqual(typeof seo[name], 'function', `${name} resolves`);

const full = seo.llmsFull({ site: { name: 'Example', url: 'https://example.test/' }, summary: '  A useful  site ',
    sections: [
        { title: 'Guide', url: '/guide', body: 'First paragraph.\n\nSecond paragraph.' },
        { title: 'Short', url: '/short', body: 'abcdefghijklmnop', maxChars: 7 },
    ] });
assert.ok(full.startsWith(seo.llmsTxt({ name: 'Example', summary: '  A useful  site ' })), 'reuses the llms.txt header');
assert.match(full, /## Guide\n\nhttps:\/\/example\.test\/guide\n\nFirst paragraph\.\n\nSecond paragraph\./);
assert.match(full, /## Short\n\nhttps:\/\/example\.test\/short\n\nabcdef…/);
assert.strictEqual(seo.llmsFull({ site: 'X', maxTotal: 0 }), '');
assert.strictEqual(seo.llmsFull({ site: 'X', summary: 'text', maxTotal: 12 }).length, 12);
assert.ok(!full.includes('abcdefghijklmnop'), 'per-section limit applies');

const page = seo.pageSummary({ title: '<Guide & More>', summary: 'A "short" <script>alert(1)</script> & guide',
    facts: [['<Topic>', 'A & B']], url: 'https://example.test/?a=1&b=2', updated: '2026-10-01' });
assert.strictEqual(page.meta, 'A &quot;short&quot; &lt;script&gt;alert(1)&lt;/script&gt; &amp; guide');
assert.deepStrictEqual(page.jsonLd, { '@context': 'https://schema.org', '@type': 'WebPage',
    name: '<Guide & More>', url: 'https://example.test/?a=1&b=2',
    abstract: 'A "short" <script>alert(1)</script> & guide', dateModified: '2026-10-01' });
assert.match(page.html, /^<section data-ov-summary hidden>/);
assert.match(page.html, /<dt>&lt;Topic&gt;<\/dt><dd>A &amp; B<\/dd>/);
assert.match(page.html, /href="https:\/\/example\.test\/\?a=1&amp;b=2"/);
assert.ok(!page.html.includes('<script>'), 'HTML fields are escaped');
assert.ok(seo.jsonLdTag(page.jsonLd).includes('\\u003cscript>'), 'JSON-LD tag safely serializes raw data');

const item = { title: 'One & <Two>', url: '/one?a=1&b=2', id: 'urn:example:one',
    published: '2026-10-01T12:34:56Z', updated: '2026-10-02T10:00:00Z',
    summary: 'A <b>summary</b> & more', author: 'A & B' };
const feed = { title: 'News & Notes', link: 'https://example.test/', description: 'A <feed>',
    updated: '2026-10-02T10:00:00Z', items: [item] };
const rss = seo.feedXml(feed, { format: 'rss' });
assert.match(rss, /<rss version="2\.0"><channel>/);
assert.match(rss, /<link>https:\/\/example\.test\/one\?a=1&amp;b=2<\/link>/);
assert.match(rss, /<guid isPermaLink="false">urn:example:one<\/guid>/);
assert.match(rss, /<pubDate>Thu, 01 Oct 2026 12:34:56 GMT<\/pubDate>/);
assert.match(rss, /<lastBuildDate>Fri, 02 Oct 2026 10:00:00 GMT<\/lastBuildDate>/);
assert.match(rss, /<description>A &lt;b&gt;summary&lt;\/b&gt; &amp; more<\/description>/);
assert.match(rss, /<author>A &amp; B<\/author>/);
assert.ok(!rss.includes('<b>summary</b>'));
assert.match(seo.feedXml({ ...feed, items: [{ title: 'A & B', url: '/plain' }] }), /<guid isPermaLink="true">https:\/\/example\.test\/plain<\/guid>/);
assert.match(seo.feedXml({ ...feed, items: [{ ...item, id: 'urn:one&two' }] }), /<guid isPermaLink="false">urn:one&amp;two<\/guid>/);
const atom = seo.feedXml(feed, { format: 'atom' });
assert.match(atom, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/);
assert.match(atom, /<link href="https:\/\/example\.test\/one\?a=1&amp;b=2"\/>/);
assert.match(atom, /<id>urn:example:one<\/id>/);
assert.match(atom, /<published>2026-10-01T12:34:56\.000Z<\/published>/);
assert.match(atom, /<updated>2026-10-02T10:00:00\.000Z<\/updated>/);
assert.match(atom, /<summary>A &lt;b&gt;summary&lt;\/b&gt; &amp; more<\/summary>/);
assert.match(atom, /<author><name>A &amp; B<\/name><\/author>/);
assert.throws(() => seo.feedXml(feed, { format: 'json' }), /rss or atom/);
const links = seo.feedLinkTags({ rss: 'https://example.test/feed?a=1&b=2', atom: 'https://example.test/atom', title: 'News "A"' });
assert.match(links, /type="application\/rss\+xml" title="News &quot;A&quot;" href="https:\/\/example\.test\/feed\?a=1&amp;b=2"/);
assert.match(links, /type="application\/atom\+xml"/);

const rating = seo.jsonLd.aggregateRating({ ratingValue: 4.5, ratingCount: 20 });
assert.deepStrictEqual([rating['@type'], rating.ratingValue, rating.ratingCount], ['AggregateRating', 4.5, 20]);
const review = seo.jsonLd.review({ reviewBody: 'Useful', author: 'Ada', rating: 5, itemReviewed: { '@type': 'Product', name: 'Kit' } });
assert.strictEqual(review.reviewRating.ratingValue, 5);
assert.deepStrictEqual(review.author, { '@type': 'Person', name: 'Ada' });
const product = seo.jsonLd.product({ name: 'Kit', url: 'https://example.test/kit', brand: 'Example', aggregateRating: rating, review });
assert.strictEqual(product['@type'], 'Product');
assert.deepStrictEqual(product.brand, { '@type': 'Brand', name: 'Example' });
assert.strictEqual(product.aggregateRating, rating);
assert.strictEqual(product.review, review);
assert.deepStrictEqual(seo.jsonLd.imageGallery(['https://example.test/a.jpg', { url: 'https://example.test/b.jpg', caption: 'Second', width: 800 }]).map((x) => x['@type']), ['ImageObject', 'ImageObject']);
assert.strictEqual(seo.jsonLd.imageGallery([{ url: 'https://example.test/b.jpg', caption: 'Second' }])[0].caption, 'Second');
assert.deepStrictEqual(seo.jsonLd.videoObject({ name: 'Demo', thumbnailUrl: 'https://example.test/demo.jpg', uploadDate: '2026-10-01' }), seo.jsonLd.video({ name: 'Demo', thumbnailUrl: 'https://example.test/demo.jpg', uploadDate: '2026-10-01' }));

console.log('seo: all checks passed');
