'use strict';
// openvibe-shared/showcase: escaping, empty sections, deterministic output, the pieces each section promises.
const assert = require('assert');
const sc = require('../showcase');

const hero = sc.hero({ eyebrow: 'E', title: 'Build <on>', accent: 'OpenVibe', lede: 'L', actions: [{ label: 'Go', href: '/go?a=1&b=2', primary: true, icon: 'fa-plus' }], note: 'N' });
assert.ok(hero.includes('<h1>Build &lt;on&gt;<span class="sc-accent"> OpenVibe</span></h1>'), 'the title is escaped');
assert.ok(hero.includes('href="/go?a=1&amp;b=2"') && hero.includes('sc-btn sc-primary'), 'actions are links, escaped');
assert.ok(sc.hero({ title: 'T', aside: { html: '<pre>x</pre>' } }).includes('<div class="sc-hero-aside"><pre>x</pre></div>'), 'aside.html passes through');

for (const [name, out] of Object.entries({
    features: sc.features({ title: 'F', items: [] }), steps: sc.steps({ title: 'S' }), code: sc.code({ title: 'C', samples: [] }),
    demo: sc.demo({ title: 'D' }), compare: sc.compare({ title: 'X', columns: ['a'], rows: [] }), pricing: sc.pricing({ title: 'P', tiers: [] }),
    limits: sc.limits({ title: 'L', columns: [], rows: [{ label: 'r' }] }), stories: sc.stories({ title: 'St' }), cta: sc.cta({}),
})) assert.strictEqual(out, '', `${name} with nothing to show renders nothing`);

const f = sc.features({ title: 'What you get', items: [{ icon: 'fa-key', title: '<b>', text: 't', href: '/k' }, { icon: 'ov:tools', title: 'Tools' }] });
assert.ok(f.includes('aria-labelledby="sc-what-you-get"') && f.includes('id="sc-what-you-get"'), 'the heading labels its section');
assert.ok(f.includes('<a class="sc-card" href="/k">') && f.includes('&lt;b&gt;') && f.includes('<div class="sc-card">'), 'linked and plain cards');
assert.ok(f.includes('data-icon="tools"'), 'ov: icons render the shared ring icon');
assert.strictEqual(f, sc.features({ title: 'What you get', items: [{ icon: 'fa-key', title: '<b>', text: 't', href: '/k' }, { icon: 'ov:tools', title: 'Tools' }] }), 'the same input renders the same bytes');

const c = sc.compare({ title: 'Compare', columns: ['Us', 'Them'], rows: [{ label: 'Open', values: [true, false] }, { label: 'Price', values: ['Free', 'Paid'] }] });
assert.ok(c.includes('aria-label="yes"') && c.includes('aria-label="no"') && c.includes('<td class="sc-us">Free</td>'));
const p = sc.pricing({ title: 'Plans', tiers: [{ name: 'Free', price: 0, per: 'month', items: ['a'] }, { name: 'Pro', price: '$5', per: 'month', highlight: true, action: { label: 'Buy', href: '/buy' } }] });
assert.ok(p.includes('<p class="sc-price">Free</p>') && p.includes('$5<small> / month</small>') && p.includes('sc-tier sc-hl'));
const l = sc.limits({ title: 'Limits', columns: ['Free'], rows: [{ label: 'Requests per minute', values: [60] }], source: 'https://openvibe.network/limits.json' });
assert.ok(l.includes('<td>60</td>') && l.includes('href="https://openvibe.network/limits.json"'), 'limits cite their source');
const code = sc.code({ title: 'Code', samples: [{ label: 'Node', lang: 'js', code: '\n<script>x</script>\n' }] });
assert.ok(code.includes('class="language-js"') && code.includes('&lt;script&gt;x&lt;/script&gt;</code>'), 'code is escaped and trimmed');
const d = sc.demo({ title: 'Try it', iframe: { src: 'https://x.example/?a=1&b=2', height: 5000 } });
assert.ok(d.includes('loading="lazy"') && d.includes('height:900px') && d.includes('&amp;b=2'), 'a demo frame is lazy and bounded');
assert.ok(typeof sc.CSS === 'string' && sc.CSS.includes('.sc-card') && sc.CSS.includes('prefers-reduced-motion'));
const { execFileSync } = require('child_process');
execFileSync(process.execPath, [require('path').join(__dirname, '..', 'scripts', 'build-styles.js'), '--check'], { stdio: 'inherit' });
const files = require('../files');
assert.ok(files.isBrowserFile('showcase.css') && files.STYLES.includes('showcase.css') && !files.BROWSER.includes('showcase.css'), 'served as a stylesheet, not a script');
assert.strictEqual(sc.STYLESHEET, 'showcase.css');
// A ring icon fills the 40 px slot with no second tile; a Font Awesome icon keeps the tinted tile at its own size.
{
    const ring = sc.features({ items: [{ icon: 'ov:live', title: 'Live' }, { icon: 'fa-code', title: 'Code' }] });
    assert.ok(ring.includes('<span class="sc-ic sc-ic-ov"><span class="ov-icon sc-ovi" data-icon="live" style="--ovi-size:40px"'), 'the ring icon is 40 px in an untinted slot');
    assert.ok(ring.includes('<span class="sc-ic"><i class="fa-solid fa-code"'), 'a Font Awesome icon keeps the plain slot');
    assert.ok(sc.CSS.includes('.sc-ic.sc-ic-ov{background:none'), 'the slot drops its tile for a ring icon');
}

// Next steps (Shared ADR 0002): safe links only, the referral tag, the target's ring icon and name, escaping, at most four.
{
    assert.strictEqual(sc.nextSteps({ items: [] }), '', 'no items, no section');
    assert.strictEqual(sc.nextSteps({ items: [{ to: 'media', what: 'x', href: 'javascript:alert(1)' }] }), '', 'an unsafe link is left out');
    const out = sc.nextSteps({ title: 'What next', items: [
        { to: 'media', from: 'live', what: 'Clip the best <minute>', text: 'From the VOD you just watched.', href: 'https://openvibe.media/clips/new?vod=1#start', embed: 'https://openvibe.media/embed/1' },
        { to: 'tools', what: 'Convert it', href: '/tools/convert' },
        { to: 'chat', what: 'Tell people', href: '//evil.example/' },
        { to: 'blog', what: 'Write about it', href: 'https://openvibe.blog/write' },
        { to: 'news', what: 'Read more', href: 'https://openvibe.news/' },
        { to: 'wiki', what: 'Look it up', href: 'https://openvibe.wiki/' },
    ] });
    assert.ok(out.includes('<section class="sc-sec sc-next"'));
    assert.ok(out.includes('href="https://openvibe.media/clips/new?vod=1&amp;ov_from=live#start"'), 'the referral tag goes before the fragment');
    assert.ok(out.includes('Clip the best &lt;minute&gt;'), 'text is escaped');
    assert.ok(out.includes('on OpenVibe.Media') && out.includes('data-icon="media"'), 'the target product and its ring icon');
    assert.ok(out.includes('href="/tools/convert"'), 'a path on this site is allowed');
    assert.ok(!out.includes('evil.example'), 'a protocol-relative link is left out');
    assert.strictEqual((out.match(/class="sc-next-item"/g) || []).length, 4, 'at most four');
    assert.ok(out.includes('class="sc-next-embed" href="https://openvibe.media/embed/1"'));
    assert.ok(sc.CSS.includes('.sc-next-main{'), 'styled by the kit');
}

console.log('showcase: all checks passed');
