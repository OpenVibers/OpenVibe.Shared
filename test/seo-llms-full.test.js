'use strict';
const assert = require('assert');
const seo = require('../seo');

for (const name of ['llmsFull', 'pageSummary']) assert.strictEqual(typeof seo[name], 'function', `${name} resolves`);

const input = { site: 'Example', summary: '  Docs  and blog ', base: 'https://example.test/', sections: [
    { title: 'Docs', pages: [
        { title: 'Intro', url: '/intro', text: 'Line one.\r\nLine two.\n\nLast paragraph.' },
        { title: 'API', url: 'api/v1', html: '<h1>API</h1><!-- note --><p>Use <b>get()</b> &amp; <i>set()</i>.</p><style>p{}</style><script>alert("x")</script><ul><li>One</li><li>Two&#33;</li></ul>' },
    ] },
    { title: 'Empty', pages: [] },
    { title: 'Blog', pages: [{ title: 'Launch', url: 'https://other.test/launch' }] },
] };
const full = seo.llmsFull(input);
assert.strictEqual(full, seo.llmsFull(input), 'deterministic');
assert.ok(full.startsWith(seo.llmsTxt({ name: 'Example', summary: '  Docs  and blog ' })), 'llms.txt header');
assert.ok(full.endsWith('\n') && !full.endsWith('\n\n'), 'one trailing newline');
assert.ok(full.indexOf('## Docs') < full.indexOf('### Intro') && full.indexOf('### Intro') < full.indexOf('### API')
    && full.indexOf('### API') < full.indexOf('## Blog') && full.indexOf('## Blog') < full.indexOf('### Launch'), 'input order kept');
assert.ok(full.includes('### Intro\n\nURL: https://example.test/intro\n\nLine one.\nLine two.\n\nLast paragraph.\n'), 'text kept with its newlines');
assert.ok(full.includes('URL: https://example.test/api/v1\n\nAPI\n\nUse get() & set().\n\nOne\nTwo!\n'), 'html stripped to text');
assert.ok(!/<|alert|p\{\}|note/.test(full), 'no tags, scripts, styles or comments');
assert.ok(full.endsWith('### Launch\n\nURL: https://other.test/launch\n'), 'a page without text lists its URL only');
assert.ok(!full.includes('## Empty'), 'an empty section is left out');
assert.strictEqual(seo.llmsFull({ site: 'X', summary: 's', sections: [{ title: 'None', pages: [] }] }), seo.llmsTxt({ name: 'X', summary: 's' }));
const long = 'word '.repeat(5000).trim();
assert.ok(seo.llmsFull({ site: 'X', base: 'https://x.test', sections: [{ title: 'A', pages: [{ title: 'Long', url: '/', text: long }] }] }).includes(long), 'body never clipped');
assert.match(seo.llmsFull({ site: { name: 'S', url: 'https://s.test/' }, sections: [{ title: 'A', pages: [{ title: 'P', url: '/p' }] }] }), /URL: https:\/\/s\.test\/p\n/, 'site.url is the base when base is absent');

const pages = (n) => Array.from({ length: n }, (_, i) => ({ title: `P${i}`, url: `/p${i}`, text: `Body ${i} ünïcode` }));
const all = seo.llmsFull({ site: 'X', base: 'https://x.test/', sections: [{ title: 'A', pages: pages(2) }, { title: 'B', pages: pages(2) }] });
const upTo = (marker) => Buffer.byteLength(all.slice(0, all.indexOf(marker)));
const cut = seo.llmsFull({ site: 'X', base: 'https://x.test/', maxBytes: upTo('### P1'), sections: [{ title: 'A', pages: pages(2) }, { title: 'B', pages: pages(2) }] });
assert.ok(cut.includes('### P0') && !cut.includes('### P1') && !cut.includes('## B'), 'stops before the page that would pass maxBytes');
assert.ok(cut.endsWith('\n\n(truncated: 3 more pages at https://x.test/llms.txt)\n'), 'truncation line counts every page left');
assert.ok(Buffer.byteLength(cut.slice(0, cut.indexOf('\n(truncated'))) <= upTo('### P1'), 'content stays within maxBytes');
assert.strictEqual(seo.llmsFull({ site: 'X', base: 'https://x.test/', maxBytes: Buffer.byteLength(all), sections: [{ title: 'A', pages: pages(2) }, { title: 'B', pages: pages(2) }] }), all, 'no line when everything fits');
assert.match(seo.llmsFull({ site: 'X', base: 'https://x.test/', maxBytes: upTo('## B'), sections: [{ title: 'A', pages: pages(2) }, { title: 'B', pages: pages(1) }] }), /\n\(truncated: 1 more page at https:\/\/x\.test\/llms\.txt\)\n$/);

const ps = seo.pageSummary({ title: 'Guide "A" <b> & co', summary: 'Say "hi" <b>bold</b> & </script><script>alert(1)</script>', url: 'https://example.test/g?a=1&b=2', updated: '2026-10-01T12:00:00Z', facts: ['Fast & "small"', '<i>Two</i>'] });
const html = String(ps);
assert.strictEqual(`${ps}`, html);
assert.strictEqual(html, `${ps.head}\n${ps.body}`);
assert.ok(html.includes('<meta name="ai-summary" content="Say &quot;hi&quot; &lt;b&gt;bold&lt;/b&gt; &amp; &lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;">'), 'meta content escaped');
assert.ok(!html.includes('name="description"'), 'headTags owns the description');
assert.strictEqual(html.match(/<\/script>/g).length, 1, '</script> in the summary cannot close the JSON-LD tag');
const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
assert.deepStrictEqual(ld, { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Guide "A" <b> & co',
    description: 'Say "hi" <b>bold</b> & </script><script>alert(1)</script>', url: 'https://example.test/g?a=1&b=2',
    dateModified: '2026-10-01T12:00:00.000Z', abstract: 'Say "hi" <b>bold</b> & </script><script>alert(1)</script>' });
assert.ok(html.includes(seo.jsonLdTag(ld)), 'built with jsonLdTag');
assert.ok(ps.body.startsWith('<noscript><section data-ai-summary><h2>Guide &quot;A&quot; &lt;b&gt; &amp; co</h2><p>Say &quot;hi&quot;'));
assert.ok(ps.body.endsWith('<ul><li>Fast &amp; &quot;small&quot;</li><li>&lt;i&gt;Two&lt;/i&gt;</li></ul></section></noscript>'));
assert.deepStrictEqual(Object.keys(ps), ['meta', 'jsonLd', 'html'], 'the 2.4.0 result shape is unchanged');

const bare = seo.pageSummary({ title: 'T', summary: 'S', url: '/t' });
assert.ok(!String(bare).includes('<noscript'), 'no noscript block without facts');
assert.strictEqual(bare.body, '');
assert.ok(!String(seo.pageSummary({ title: 'T', summary: 'S', facts: [] })).includes('<noscript'));
assert.ok(!/dateModified/.test(String(bare)) && !/dateModified/.test(String(seo.pageSummary({ summary: 'S', updated: 'not a date' }))), 'dateModified only for a valid date');

const words = 'alpha beta gamma delta '.repeat(20);
const content = String(seo.pageSummary({ title: 'T', summary: words })).match(/name="ai-summary" content="([^"]*)"/)[1];
assert.strictEqual(content, seo.clip(words, 160), 'clipped like the description');
assert.ok(content.length <= 160 && content.endsWith('…'));
assert.ok(String(seo.pageSummary({ title: 'T', summary: words })).includes(`"abstract":"${words}"`), 'JSON-LD keeps the full summary');

console.log('seo-llms-full: all checks passed');
