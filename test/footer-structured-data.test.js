'use strict';
// The footer's structured data and heading levels (the network SEO pass of 2026-11-21, OpenSEO's audit rules): every
// site names the OpenVibe organization by one @id and itself as a WebSite it publishes; the footer's section headings
// are h2, so a page with no h2 of its own never skips from h1 to h3.
const assert = require('assert');
const footer = require('../footer.js');

// The footer's structured data is microdata (4.336.0): the organization by one itemid, the site as a WebSite it publishes.
const site = (html) => {
    const m = /itemtype="https:\/\/schema\.org\/WebSite" itemid="([^"]+)\/#website"><meta itemprop="name" content="([^"]*)">/.exec(html);
    return m ? { url: `${m[1]}/`, name: m[2], publisher: /itemprop="publisher"/.test(html.slice(m.index)) } : null;
};
const bot = footer.ssr({ service: 'bot', brandName: 'OpenVibe.Bot' });
assert.ok(!bot.includes('application/ld+json'), 'no JSON-LD script: a page\'s JSON-LD is the page\'s own');
assert.ok(bot.includes('<div itemscope itemtype="https://schema.org/Organization" itemid="https://openvibe.network/#organization"><meta itemprop="name" content="OpenVibe"><link itemprop="url" href="https://openvibe.network/"><link itemprop="logo" href="https://openvibe.network/assets/logo-512.png">'), 'the organization, its address and logo');
assert.ok(bot.includes('<link itemprop="sameAs" href="https://github.com/OpenVibers">'));
assert.deepStrictEqual(site(bot), { url: 'https://openvibe.bot/', name: 'OpenVibe.Bot', publisher: true });
assert.ok(/<div class="ovf-ld" data-ovf-ld hidden>/.test(bot), 'it takes no room on the page');

assert.strictEqual(site(footer.ssr({ service: 'openre' })).url, 'https://openre.stream/', 'a site off the openvibe.<id> pattern');
assert.strictEqual(site(footer.ssr({ service: 'live', siteUrl: 'https://openvibe.live/' })).url, 'https://openvibe.live/', 'the site\'s own address wins');
assert.strictEqual(site(footer.ssr({ service: 'weird id' })), null, 'an address it cannot be sure of: the organization only');
assert.ok(!footer.ssr({ service: 'bot', structuredData: false }).includes('itemscope'), 'a site with its own structured data turns it off');

const trickyHtml = footer.ssr({ service: 'bot', brandName: '"><script>alert(1)</script>' });
assert.strictEqual(site(trickyHtml).name, '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;', 'the name survives as escaped text');
assert.ok(!trickyHtml.includes('<script>alert'), 'and never becomes markup');

const html = footer.ssr({ service: 'bot', variant: 'full' });
assert.ok(/<summary><h2>Network<\/h2>/.test(html) && !/<h3>/.test(html), 'the footer\'s headings are h2');
console.log('footer-structured-data: 6 checks passed (microdata)');

// A page that asks not to be indexed (a signed-in page) carries no structured data (OpenRestream's private pages, 11-21).
{
    const shell = require('../shell.js');
    const open = shell.page({ name: 'example', title: 'Example', body: '<main>hi</main>' });
    const closed = shell.page({ name: 'example', title: 'Mine', robots: 'noindex, nofollow', body: '<main>hi</main>' });
    assert.ok(open.includes('data-ovf-ld') && !open.includes('application/ld+json'), 'a public page carries the organization, as microdata');
    assert.ok(!closed.includes('data-ovf-ld') && !closed.includes('itemscope'), 'a noindex page carries no structured data');
    console.log('footer structured data: none on a noindex page');
}
