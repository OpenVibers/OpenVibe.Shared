'use strict';
// 4.108.0 (AGT-5): llms.txt's markdown mode links the site's own pages at their Markdown twins and nothing else: a
// file, an API path, a .well-known path and another site's link keep their URL; a page with no twin says (HTML).
const assert = require('assert');
const seo = require('../seo');

const links = (text) => [...text.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
const txt = seo.llmsTxt({
    name: 'Deals', summary: 'Hot deals.', markdown: true, base: 'https://openvibe.deals',
    sections: [{ title: 'Pages', links: [
        { title: 'Home', url: 'https://openvibe.deals/' },
        { title: 'Hot', url: '/hot' },
        { title: 'A deal', url: 'https://openvibe.deals/d/abc-123/' },
        { title: 'Search', url: '/search?q=tv' },
        { title: 'Crowdfunding', url: '/crowdfunding', html: true },
        { title: 'OpenAPI', url: '/openapi.json' },
        { title: 'Feed', url: 'https://openvibe.deals/feed.xml' },
        { title: 'API', url: '/api/v1/deals/hot' },
        { title: 'Agent', url: '/.well-known/agent.json' },
        { title: 'Network', url: 'https://openvibe.network/' },
        { title: 'Mail', url: 'mailto:x@example.com' },
    ] }],
    optional: [{ title: 'Terms', url: '/terms' }, { title: 'Everything', url: '/llms-full.txt' }],
});
assert.deepStrictEqual(links(txt), [
    'https://openvibe.deals/index.md', '/hot.md', 'https://openvibe.deals/d/abc-123.md', '/search.md?q=tv', '/crowdfunding',
    '/openapi.json', 'https://openvibe.deals/feed.xml', '/api/v1/deals/hot', '/.well-known/agent.json',
    'https://openvibe.network/', 'mailto:x@example.com', '/terms.md', '/llms-full.txt',
]);
assert.match(txt, /- \[Crowdfunding\]\(\/crowdfunding\) \(HTML\)/, 'a page with no twin is marked');
assert.match(txt, /## Optional\n\n- \[Terms\]\(\/terms\.md\)/, 'the Optional section is last');
assert.strictEqual(txt.indexOf('## Optional'), txt.lastIndexOf('## '));

// Without base, an absolute link is still the site's own (as before 4.108.0), unless it is a file or an API path.
const old = seo.llmsTxt({ name: 'X', markdown: true, sections: [{ title: 'P', links: [{ title: 'Home', url: 'https://example.com/' }, { title: 'Doc', url: 'https://example.com/openapi.json' }] }] });
assert.deepStrictEqual(links(old), ['https://example.com/index.md', 'https://example.com/openapi.json']);
// Without markdown nothing changes.
assert.deepStrictEqual(links(seo.llmsTxt({ name: 'X', sections: [{ title: 'P', links: [{ title: 'Hot', url: '/hot' }] }] })), ['/hot']);
console.log('llms markdown links: ok');
