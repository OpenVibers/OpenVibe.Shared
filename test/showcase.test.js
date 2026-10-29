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

// A fold: its heading stays visible and keeps its id; nothing to fold renders nothing.
const fo = sc.fold({ id: 'how', title: 'How it <works>', hint: 'four steps', html: sc.steps({ title: 'Steps', items: [{ title: 'One', text: 't' }] }) });
assert.ok(fo.startsWith('<section class="sc-sec sc-fold-sec" id="how" aria-labelledby="sc-how-it-works">'), 'the fold is a labelled section');
assert.ok(fo.includes('<details class="sc-fold"><summary><h2 id="sc-how-it-works">How it &lt;works&gt;</h2><span class="sc-fold-hint">four steps</span></summary>'), 'the heading is in the summary, escaped');
assert.ok(fo.includes('<div class="sc-fold-body"><section class="sc-sec"'), 'other sections nest inside');
assert.ok(sc.fold({ title: 'T', html: '<p>x</p>', open: true }).includes('<details class="sc-fold" open>'), 'open on request');
assert.strictEqual(sc.fold({ title: 'T', html: '' }), '', 'nothing to fold renders nothing');
assert.strictEqual(sc.fold({ html: '<p>x</p>' }), '', 'a fold needs a heading');
assert.ok(sc.CSS.includes('.sc-row.sc-row{display:flex;flex-wrap:nowrap'), 'the phone row does not inherit a wrap');

const c = sc.compare({ title: 'Compare', columns: ['Us', 'Them'], rows: [{ label: 'Open', values: [true, false] }, { label: 'Price', values: ['Free', 'Paid'] }] });
assert.ok(c.includes('aria-label="yes"') && c.includes('aria-label="no"') && c.includes('<td class="sc-us">Free</td>'));
const p = sc.pricing({ title: 'Plans', tiers: [{ name: 'Free', price: 0, per: 'month', items: ['a'] }, { name: 'Pro', price: '$5', per: 'month', highlight: true, action: { label: 'Buy', href: '/buy' } }] });
assert.ok(p.includes('<p class="sc-price">Free</p>') && p.includes('$5<small> / month</small>') && p.includes('sc-tier sc-hl'));
const l = sc.limits({ title: 'Limits', columns: ['Free'], rows: [{ label: 'Requests per minute', values: [60] }], source: 'https://openvibe.network/limits.json' });
assert.ok(l.includes('<td>60</td>') && l.includes('href="https://openvibe.network/limits.json"'), 'limits cite their source');
// A table wider than a phone scrolls in its wrapper: the wrapper is a focusable region named by the section's heading.
assert.ok(c.includes('<div class="sc-table-wrap" tabindex="0" role="region" aria-labelledby="sc-compare">') && c.includes('id="sc-compare"'), 'compare table region');
assert.ok(l.includes('<div class="sc-table-wrap" tabindex="0" role="region" aria-labelledby="sc-limits">'), 'limits table region');
const code = sc.code({ title: 'Code', samples: [{ label: 'Node', lang: 'js', code: '\n<script>x</script>\n' }] });
// A code sample scrolls sideways, so it is a focus stop with a name (axe scrollable-region-focusable).
assert.ok(code.includes('<pre tabindex="0" aria-label="Node">'), 'code samples are keyboard-focusable and named');
assert.ok(code.includes('class="language-js"') && code.includes('&lt;script&gt;x&lt;/script&gt;</code>'), 'code is escaped and trimmed');
const d = sc.demo({ title: 'Try it', iframe: { src: 'https://x.example/?a=1&b=2', height: 5000 } });
assert.ok(d.includes('loading="lazy"') && d.includes('height:900px') && d.includes('&amp;b=2'), 'a demo frame is lazy and bounded');
assert.ok(typeof sc.CSS === 'string' && sc.CSS.includes('.sc-card') && sc.CSS.includes('prefers-reduced-motion'));
const { execFileSync } = require('child_process');
execFileSync(process.execPath, [require('path').join(__dirname, '..', 'scripts', 'build-styles.js'), '--check'], { stdio: 'inherit' });
const files = require('../files');
assert.ok(files.isBrowserFile('showcase.css') && files.STYLES.includes('showcase.css') && !files.BROWSER.includes('showcase.css'), 'served as a stylesheet, not a script');
assert.strictEqual(sc.STYLESHEET, 'showcase.css');
// A step keeps its text under its title when its neighbour in the row is taller (rows of the step's own grid stay at the
// top), and four cards in a section too narrow for four across sit two by two, never three and one alone.
assert.ok(/\.sc-steps li\{[^}]*align-content:start/.test(sc.CSS), 'steps do not stretch their rows');
assert.ok(/\.sc-sec\{[^}]*container-type:inline-size/.test(sc.CSS), 'a section is the container its grid asks about');
assert.ok(/@container \(min-width:584px\) and \(max-width:1191px\)\{\.sc-steps:has\(>:nth-child\(4\):last-child\)\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/.test(sc.CSS), 'four steps: two by two below four columns (Zone, Download read three and one)');
assert.ok(/@container \(min-width:520px\) and \(max-width:1035px\)\{\.sc-grid:has\(>:nth-child\(4\):last-child\)\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/.test(sc.CSS), 'four cards: two by two below four columns');
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
    for (const sneaky of ['/\\evil.example', '/\t/evil.example', '/\n/evil.example', '/\r/evil.example']) {
        assert.strictEqual(sc.nextSteps({ items: [{ to: 'tools', what: 'x', href: sneaky }] }), '', `${JSON.stringify(sneaky)} would leave the site`);
    }
    assert.strictEqual((out.match(/class="sc-next-item"/g) || []).length, 4, 'at most four');
    assert.ok(out.includes('class="sc-next-embed" href="https://openvibe.media/embed/1"'));
    assert.ok(sc.CSS.includes('.sc-next-main{'), 'styled by the kit');
}

// ── Rich home sections (2026-10-25: "more rich content and different types… nice effects… reusable") ──
{
    const st = sc.stats({ title: 'Today', items: [{ value: '1,284', label: 'streams this week' }, { value: '38', label: 'live now', href: '/browse' }, { value: null, label: 'skipped' }] });
    assert.ok(st.includes('<dd>1,284</dd>') && st.includes('<a class="sc-stat" href="/browse">') && !st.includes('skipped'), 'stats: real numbers only, linkable');
    assert.strictEqual(sc.stats({ items: [] }), '');
    const cd = sc.cards({ title: 'Live now', layout: 'rail', ratio: '1/1', more: { label: 'All', href: '/all' }, items: [
        { href: '/@a', title: 'A <b>', meta: '42 watching', image: 'https://openvibe.media/t/a.jpg', live: true },
        { href: 'javascript:alert(1)', title: 'bad' }, { href: '/@c', title: 'C', image: 'http://insecure.example/x.jpg', badge: 'VOD' },
    ] });
    assert.ok(cd.includes('class="sc-cards sc-rail" style="--sc-ar:1 / 1"'), 'the rail at the asked ratio');
    assert.ok(cd.includes('A &lt;b&gt;') && cd.includes('<span class="sc-badge sc-live">LIVE</span>') && cd.includes('loading="lazy"'));
    assert.ok(!cd.includes('javascript:') && !cd.includes('insecure.example'), 'unsafe links and http images are left out');
    assert.ok(cd.includes('<a class="sc-more" href="/all">All'));
    const sp = sc.spotlight({ items: [{ title: 'Clips', text: 'One tap', video: '/v.mp4', image: '/p.jpg', href: '/clips' }, { title: 'Two', image: '/p.jpg' }] });
    assert.ok(sp.includes('<video src="/v.mp4" muted loop playsinline autoplay preload="none" poster="/p.jpg"'), 'a short muted loop, with its poster');
    assert.strictEqual((sp.match(/class="sc-spot"/g) || []).length, 2);
    const fq = sc.faq({ items: [['Do I need OBS?', 'No.'], ['Broken'], ['Free?', 'Yes.']] });
    assert.ok(fq.includes('<details open><summary>Do I need OBS?</summary>') && (fq.match(/<details/g) || []).length === 2, 'an accordion, the first open');
    const ld = sc.faqJsonLd([['Q </script>', 'A']]);
    assert.ok(ld.startsWith('<script type="application/ld+json">') && !ld.slice(35, -9).includes('<'), 'JSON-LD cannot close its script early');
    assert.ok(JSON.parse(ld.slice(35, -9).replace(/\\u003c/g, '<')).mainEntity[0].name === 'Q </script>');
    const net = sc.network({ service: 'live' });
    assert.ok(net.includes('Part of OpenVibe') && net.includes('https://openre.stream/?ov_from=live') && net.includes('data-icon="openre"'), 'related products, with the referral tag and ring icons');
    assert.ok(!net.includes('https://openvibe.live/'), 'never links a product to itself');
    assert.ok(sc.network({ service: 'unknown-thing' }).includes('OpenVibe.Live'), 'a product without its own list gets the core ones');
    assert.ok(sc.network({ service: 'x', items: [['tools', 'Tools', 'https://openvibe.tools/'], ['bad', 'Bad', 'ftp://x']] }).includes('OpenVibe.Tools'));
    for (const [svc, list] of Object.entries(sc.RELATED)) for (const [to, what, href] of list) assert.ok(to && what && /^https:\/\//.test(href) && to !== svc, `${svc} → ${to}`);
    assert.ok(sc.CSS.includes('animation-timeline:view()') && sc.CSS.includes('prefers-reduced-motion:no-preference'), 'scroll reveal, only for people who want motion');
    const rise = sc.CSS.match(/@keyframes scRise\{[^@]*?\}\}/);
    assert.ok(rise && !/opacity/.test(rise[0]), 'the reveal only moves: a section that fades in is measured half-transparent, so its text fails contrast checks (axe on every product home)');
}

// The hero on a phone (4.23.0; the owner on openvibe.quest: "why is openvibe.quest twice… empty space at the top"): an
// eyebrow that is only the site's name is left out (the navbar shows it), any other eyebrow stays, with an icon when
// given; numbers take an icon; phones start the hero near the bar, put the buttons side by side and the numbers three across.
{
    ['OpenVibe.Quest', 'OpenRestream', 'Play.OpenVibe.Network'].forEach((name) => assert.ok(!sc.hero({ eyebrow: name, title: 'T' }).includes('sc-eyebrow'), `${name}: no eyebrow under the navbar's own brand`));
    assert.ok(/<p class="sc-eyebrow">Free, nothing to install<\/p>/.test(sc.hero({ eyebrow: 'Free, nothing to install', title: 'T' })), 'an eyebrow that says something stays');
    assert.ok(/<p class="sc-eyebrow"><(i|span)[^>]*>.*<\/(i|span)>New<\/p>/.test(sc.hero({ eyebrow: { icon: 'fa-star', text: 'New' }, title: 'T' })), 'an eyebrow can carry an icon');
    assert.ok(/<dd><span class="sc-stat-ic">.*<\/span>39<\/dd>/.test(sc.stats({ items: [{ value: 39, label: 'quests', icon: 'fa-star' }] })), 'a number can carry an icon');
    const phone = sc.CSS.slice(sc.CSS.indexOf('@media (max-width:640px){'));
    assert.ok(/\.sc-hero\{padding-top:14px\}/.test(phone) && /\.sc-actions\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(0,1fr\)\)/.test(phone) && /\.sc-stats\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(phone), 'phones: near the bar, buttons side by side, numbers three across');
}

// The hero's visual (4.26.0; the owner, 2026-10-28: heroes "ugly af, boring… nice animated visuals"): without an aside of its
// own a hero gets the aura (the mark in turning rings); with orbit, the site's places turn around it, linked and named;
// visual: false keeps it plain; an aside of the page's own still wins.
{
    const plain = sc.hero({ title: 'T' });
    assert.ok(/class="sc-hero sc-split sc-has-vis"/.test(plain) && /<div class="sc-vis sc-aura" aria-hidden="true">/.test(plain), 'a hero gets the aura');
    assert.ok(/class="ov-mark sc-vis-mark"/.test(plain), 'the site\'s mark in the middle');
    assert.ok(!/sc-vis/.test(sc.hero({ title: 'T', visual: false })), 'visual: false keeps it plain');
    assert.ok(!/sc-vis/.test(sc.hero({ title: 'T', aside: 'mine' })), 'an aside of its own wins');
    const o = sc.hero({ title: 'T', orbit: { center: { title: 'Quests', sub: 'every site', href: '/' }, inner: [{ icon: 'ov:live', label: 'Live', href: 'https://openvibe.live/' }, { icon: 'ov:chat', label: '<Chat>' }], outer: [{ icon: 'ov:wiki', label: 'Wiki', href: 'javascript:alert(1)' }] } });
    assert.ok(/sc-has-orbit/.test(o) && /role="group" aria-label="Quests"/.test(o), 'an orbit, labelled');
    assert.ok(/<a class="sc-orb-node is-big" href="https:\/\/openvibe\.live\/" style="--i:0;--n:2"/.test(o), 'inner places link and know their slot');
    assert.ok(/&lt;Chat&gt;/.test(o) && !/<Chat>/.test(o), 'names are escaped');
    assert.ok(!/javascript:/.test(o) && /<span class="sc-orb-node" style="--i:0;--n:1"/.test(o), 'an unsafe link is no link');
    assert.ok(/<b>Quests<\/b><small>every site<\/small>/.test(o), 'the centre says what it is');
    assert.ok(/@media \(prefers-reduced-motion:reduce\)\{\.sc-ring,\.sc-aura-glow,\.sc-orb-ring,\.sc-orb-face\{animation:none\}\}/.test(sc.CSS), 'still under reduced motion');
}

// The site's name leading an eyebrow is left out, the rest kept (4.26.1): 14 homes said "OpenVibe.X · …" under a navbar
// that already says it.
{
    assert.ok(/<p class="sc-eyebrow">What should we eat\?<\/p>/.test(sc.hero({ eyebrow: 'OpenVibe.Food · What should we eat?', title: 'T' })), 'the name leaves, the phrase stays');
    assert.ok(/<p class="sc-eyebrow">Open restreaming<\/p>/.test(sc.hero({ eyebrow: 'OpenRestream · open restreaming', title: 'T' })), 'and starts with a capital');
    assert.ok(/<p class="sc-eyebrow">Alpha<\/p>/.test(sc.hero({ eyebrow: 'OpenVibe.Bot · alpha', title: 'T' })));
    assert.ok(/<p class="sc-eyebrow">Free for OpenVibe\.Live streamers<\/p>/.test(sc.hero({ eyebrow: 'Free for OpenVibe.Live streamers', title: 'T' })), 'a name later in the phrase stays');
}

// ── apps(): the launcher ──
{
    const sc = require('../showcase');
    const h = sc.apps({ id: 'network', title: 'Every site', lede: 'One account.', more: { href: '/sites', label: 'All 48 sites' }, groups: [
        { name: 'Watch <and> stream', items: [{ icon: 'ov:live', name: 'Live <x>', text: 'Go live from your browser', href: 'https://openvibe.live/' }, { name: 'Bad', href: 'javascript:alert(1)' }] },
        { name: 'Empty', items: [] },
    ] });
    assert.ok(h.startsWith('<section class="sc-sec sc-apps-sec" id="network" aria-labelledby="sc-every-site">'), 'a labelled section');
    assert.ok(h.includes('<h3 class="sc-apps-group">Watch &lt;and&gt; stream</h3>') && !h.includes('>Empty<'), 'groups are escaped; an empty one is left out');
    assert.ok(h.includes('<b>Live &lt;x&gt;</b><small>Go live from your browser</small>') && h.includes('href="https://openvibe.live/"'), 'a tile: icon, name, text');
    assert.ok(!h.includes('javascript:') && !h.includes('>Bad<'), 'a tile with an unsafe link is dropped');
    assert.ok(h.includes('<p class="sc-apps-more"><a href="/sites">All 48 sites →</a></p>'), 'See all');
    assert.strictEqual(sc.apps({ items: [] }), '', 'nothing to show, no section');
    assert.ok(sc.apps({ items: [{ name: 'A', href: '/a' }] }).includes('<ul class="sc-apps">'), 'items without groups is one grid');
    // 4.39.0: no tile alone on a row. Four go four across on a phone and two by two from 600 px; eight like four.
    const n = (k) => sc.apps({ items: Array.from({ length: k }, (_, i) => ({ name: `A${i}`, href: `/a${i}` })) });
    assert.ok(n(4).includes('<ul class="sc-apps sc-apps--c4">') && n(3).includes('sc-apps--c3') && n(2).includes('sc-apps--c2') && n(8).includes('sc-apps--c4'));
    assert.ok(n(7).includes('<ul class="sc-apps">') && n(15).includes('<ul class="sc-apps">'), 'other counts keep the auto grid');
    assert.match(sc.CSS, /@media \(max-width:599px\)\{\.sc-apps--c2\{[^}]*\}\.sc-apps--c3\{[^}]*\}\.sc-apps--c4\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)\}\}/);
    assert.match(sc.CSS, /\.sc-apps-more a\{display:inline-flex;align-items:center;min-height:44px;/, 'the launcher\'s See all is 44 px');
    const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'showcase.css'), 'utf8');
    assert.ok(css.includes('.sc-apps{') && css.includes('grid-template-columns:repeat(auto-fill,minmax(88px,1fr))'), 'phones: icon tiles');
}

console.log('showcase: all checks passed');
