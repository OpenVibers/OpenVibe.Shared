'use strict';
const assert = require('assert');
const crawlable = require('../crawlable');

const page = crawlable.render({
    name: 'OpenVibe.Test', service: 'live', url: 'https://openvibe.test/', description: 'Test site',
    links: [{ label: 'Latest', href: '/latest' }, { label: 'About <us>', href: '/about' }],
    pages: [{ title: 'Latest', url: '/latest' }], searchUrl: 'https://openvibe.test/search?q={q}',
});
assert.match(page.nav, /<nav aria-label="OpenVibe\.Test"><ul><li><a href="\/">Home<\/a>/);
assert.match(page.nav, /href="\/about">About &lt;us&gt;/);
assert.match(page.footer, /<nav aria-label="OpenVibe">/);
assert.ok(page.catalog === undefined);
assert.ok(page.jsonLd.some((item) => item['@type'] === 'Organization' && item.sameAs.length === crawlable.catalog.sites.length));
assert.ok(page.jsonLd.some((item) => item['@type'] === 'WebSite' && item.potentialAction['@type'] === 'SearchAction'));
page.jsonLd.forEach((item) => JSON.parse(JSON.stringify(item)));
assert.match(page.llmsTxt, /Main pages[\s\S]*Latest[\s\S]*Watch & stream/);
assert.ok(page.catalog === undefined, 'render output contains only page artifacts');
assert.throws(() => crawlable.render({}), /requires name and url/);
console.log('crawlable: all checks passed');
