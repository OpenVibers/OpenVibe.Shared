'use strict';
// seo.jsonLd.organization(): who OpenVibe is, in every site's structured data (4.22.0), so search engines and AI cannot
// take it for something else: the one @id, its other names, what it is, what it is not, and its sites.
const assert = require('assert');
const seo = require('../seo');

const org = seo.jsonLd.organization();
assert.strictEqual(org['@id'], 'https://openvibe.network/#org');
assert.strictEqual(org.name, 'OpenVibe');
assert.deepStrictEqual(org.alternateName, ['OpenVibe Network', 'OpenVibers']);
assert.ok(/open-source, community-run network of websites/.test(org.description));
assert.ok(/not the Openvibe mobile social-media aggregator app/.test(org.disambiguatingDescription));
['https://github.com/OpenVibers', 'https://openvibe.live', 'https://openvibe.tools', 'https://openvibe.chat', 'https://openre.stream'].forEach((u) => assert.ok(org.sameAs.includes(u), u));
assert.strictEqual(seo.jsonLd.website({ name: 'X', url: 'https://x.example/', description: 'd' }).publisher['@id'], org['@id'], 'a WebSite names it by @id');
console.log('seo org: who OpenVibe is ok');
