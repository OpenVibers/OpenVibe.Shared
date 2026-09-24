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
