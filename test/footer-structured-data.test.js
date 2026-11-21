'use strict';
// The footer's structured data and heading levels (the network SEO pass of 2026-11-21, OpenSEO's audit rules): every
// site names the OpenVibe organization by one @id and itself as a WebSite it publishes; the footer's section headings
// are h2, so a page with no h2 of its own never skips from h1 to h3.
const assert = require('assert');
const footer = require('../footer.js');

const ld = (html) => { const m = /<script type="application\/ld\+json" data-ovf-ld>([\s\S]*?)<\/script>/.exec(html); return m ? JSON.parse(m[1]) : null; };

const bot = ld(footer.ssr({ service: 'bot', brandName: 'OpenVibe.Bot' }));
assert.strictEqual(bot['@context'], 'https://schema.org');
const [org, site] = bot['@graph'];
assert.deepStrictEqual([org['@type'], org['@id'], org.name, org.logo], ['Organization', 'https://openvibe.network/#organization', 'OpenVibe', 'https://openvibe.network/assets/logo-512.png']);
assert.deepStrictEqual([site['@type'], site.url, site.name, site.publisher['@id']], ['WebSite', 'https://openvibe.bot/', 'OpenVibe.Bot', org['@id']]);

assert.strictEqual(ld(footer.ssr({ service: 'openre' }))['@graph'][1].url, 'https://openre.stream/', 'a site off the openvibe.<id> pattern');
assert.strictEqual(ld(footer.ssr({ service: 'live', siteUrl: 'https://openvibe.live/' }))['@graph'][1].url, 'https://openvibe.live/', 'the site\'s own address wins');
assert.strictEqual(ld(footer.ssr({ service: 'weird id' }))['@graph'].length, 1, 'an address it cannot be sure of: the organization only');
assert.ok(!footer.ssr({ service: 'bot', structuredData: false }).includes('ld+json'), 'a site with its own JSON-LD turns it off');

const tricky = ld(footer.ssr({ service: 'bot', brandName: '</script><script>alert(1)</script>' }));
assert.strictEqual(tricky['@graph'][1].name, '</script><script>alert(1)</script>', 'the name survives as data');
assert.ok(!/<\/script><script>alert/.test(footer.ssr({ service: 'bot', brandName: '</script><script>alert(1)</script>' }).split('data-ovf-ld>')[1].split('</script>')[0]), 'and never closes the element');

const html = footer.ssr({ service: 'bot', variant: 'full' });
assert.ok(/<summary><h2>Network<\/h2>/.test(html) && !/<h3>/.test(html), 'the footer\'s headings are h2');
console.log('footer-structured-data: 6 checks passed');

// A page that asks not to be indexed (a signed-in page) carries no structured data (OpenRestream's private pages, 11-21).
{
    const shell = require('../shell.js');
    const open = shell.page({ name: 'example', title: 'Example', body: '<main>hi</main>' });
    const closed = shell.page({ name: 'example', title: 'Mine', robots: 'noindex, nofollow', body: '<main>hi</main>' });
    assert.ok(open.includes('application/ld+json'), 'a public page carries the organization');
    assert.ok(!closed.includes('application/ld+json'), 'a noindex page carries no structured data');
    console.log('footer structured data: none on a noindex page');
}
