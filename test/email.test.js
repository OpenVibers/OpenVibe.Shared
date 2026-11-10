'use strict';
// One frame for every mail (email.js): it says what happened in words, in the person's theme, with what a mail client
// allows (tables, styles on the elements, no script, no SVG, nothing that moves); every string is text and a link is
// kept only if it is https or mailto; the plain-text part says the same.
const assert = require('node:assert/strict');
const mail = require('../email');
const themes = require('../builtin-themes');

const base = {
    site: { name: 'OpenVibe', url: 'https://openvibe.network', logo: 'https://openvibe.network/icons/logo-192.png' },
    tone: 'alert', kicker: 'Still failing', title: 'openvibe.domains: 1 problem found by the browser check',
    lead: 'After release 74bdff4, the automatic check found a problem on the page /.',
    body: ['Two fold headings have no name a screen reader can say.'],
    facts: [{ label: 'Page', value: '/', href: 'https://openvibe.domains/' }, { label: 'Release', value: '74bdff4' }, { label: 'Empty', value: '' }],
    actions: [{ label: 'Open the page', href: 'https://openvibe.domains/' }, { label: 'See the release', href: 'https://git.openvibe.codes/x' }],
    next: ['The check runs again after every release and once a day.'],
    why: 'You get this because you run this site.', manage: { href: 'https://openvibe.network/notifications' }, preheader: 'Two fold headings have no name.',
};

// The default theme, a dark one: its own colours, written on the elements; the client is told it is dark.
{
    const { html, text } = mail.frame({ ...base, theme: 'vibe' });
    const vibe = themes.BUILTIN_THEMES.find((t) => t.id === 'vibe').variables;
    assert.ok(html.includes(`background:${vibe['--bg-primary']}`) && html.includes(`background:${vibe['--bg-card']}`), 'the page and the card are the theme\'s');
    assert.match(html, /<meta name="color-scheme" content="dark">/);
    // The tone is a lean and a glow, never a hard coloured border (the owner: "instead of just like this red … border").
    assert.ok(!/border-(top|left):\s*3px/.test(html), 'no hard coloured bar on the card or the facts');
    const lean = mail.mix(vibe['--bg-card'], vibe['--danger'], 0.2);
    assert.ok(html.includes(`background-image:linear-gradient(180deg, ${lean} 0, ${vibe['--bg-card']} 130px)`), 'the card leans toward the tone at its top');
    assert.ok(html.includes(`box-shadow:0 22px 60px -30px ${vibe['--danger']}`) && html.includes(`box-shadow:0 12px 30px -18px ${vibe['--danger']}`), 'the card and the facts glow in the tone');
    assert.match(html, new RegExp(`border-radius:50%;background:${vibe['--danger']};[^"]*">!</span>Still failing</td>`), 'the kicker is a pill with a round mark');
    assert.match(html, /<h1 [^>]*>openvibe\.domains: 1 problem found by the browser check<\/h1>/);
    assert.ok(!/<script|<svg|@keyframes|animation:|position:\s*fixed|<link /i.test(html), 'nothing a mail client strips or that moves');
    assert.ok(!/class="(?!ovm-)/.test(html), 'styles are on the elements (the two classes are the phone padding only)');
    assert.equal((html.match(/<table /g) || []).length, (html.match(/<table role="presentation"/g) || []).length, 'every table is layout, and says so');
    assert.match(html, /<img src="https:\/\/openvibe\.network\/icons\/logo-192\.png" width="32" height="32" alt=""/, 'the mark is a hosted picture beside the name');
    assert.ok(!/🔥|🔔|🚨/u.test(html), 'no emoji stands in for the mark');
    // One button (the first action), the others as plain links.
    assert.equal((html.match(/display:inline-block;padding:12px 22px/g) || []).length, 1, 'one button');
    assert.match(html, /<a href="https:\/\/openvibe\.domains\/" style="display:inline-block[^"]*">Open the page <span aria-hidden="true">&rarr;<\/span><\/a>/, 'the button points onward');
    assert.match(html, /<a href="https:\/\/git\.openvibe\.codes\/x" style="color:[^"]*">See the release<\/a>/);
    // Facts: a label and its value; a value with a link is the link; an empty one is left out.
    assert.match(html, />Page<\/td><td [^>]*><a href="https:\/\/openvibe\.domains\/"[^>]*>\/<\/a><\/td>/);
    assert.ok(!html.includes('>Empty<'), 'a fact with no value is not drawn');
    assert.ok(html.includes('What happens next') && html.includes('The check runs again after every release and once a day.'));
    assert.match(html, /You get this because you run this site\. <a href="https:\/\/openvibe\.network\/notifications"[^>]*>Change what is mailed to you<\/a>/);
    assert.match(html, /<div style="display:none[^"]*">Two fold headings have no name\.<\/div>/, 'the line a mail list shows');
    assert.ok(Buffer.byteLength(html) < 20000, 'far under the size where a mail client cuts a message');
    assert.equal(text, ['STILL FAILING', 'openvibe.domains: 1 problem found by the browser check', '', 'After release 74bdff4, the automatic check found a problem on the page /.', 'Two fold headings have no name a screen reader can say.', '',
        'Page: / (https://openvibe.domains/)', 'Release: 74bdff4', '', 'Open the page: https://openvibe.domains/', 'See the release: https://git.openvibe.codes/x', '', 'What happens next', '- The check runs again after every release and once a day.', '', '--',
        'You get this because you run this site.', 'Change what is mailed to you: https://openvibe.network/notifications', 'OpenVibe · https://openvibe.network'].join('\n'), 'the plain-text part says the same');
}

// Every string is text; a link that is not https or mailto is dropped (its label stays as words where it is a fact).
{
    const { html, text } = mail.frame({ theme: 'vibe', title: '<img src=x onerror=1>', lead: '"quoted" & <b>bold</b>', facts: [{ label: '<i>L</i>', value: '<u>V</u>', href: 'javascript:alert(1)' }],
        actions: [{ label: 'Bad', href: 'http://insecure.example/' }, { label: 'Worse', href: 'javascript:alert(1)' }, { label: 'Write to us', href: 'mailto:help@openvibe.network' }], site: { name: 'A<b>', url: 'javascript:1', logo: 'data:image/png;base64,AAAA' }, manage: { href: 'ftp://x' } });
    assert.ok(!/<img src=x|<b>bold|<u>V|<i>L|javascript:|http:\/\/insecure|data:image|ftp:/.test(html), 'nothing given is markup, and no unsafe address is kept');
    assert.ok(html.includes('&lt;img src=x onerror=1&gt;') && html.includes('&quot;quoted&quot; &amp; &lt;b&gt;bold&lt;/b&gt;') && html.includes('&lt;u&gt;V&lt;/u&gt;'));
    assert.match(html, /<a href="mailto:help@openvibe\.network" style="display:inline-block[^"]*">Write to us </, 'the first address that is safe is the button');
    assert.ok(html.includes('href="https://openvibe.network"'), 'an unsafe site address falls back to the network\'s');
    assert.ok(!text.includes('javascript:') && text.includes('Write to us: mailto:help@openvibe.network'));
}

// A light theme: light surfaces, and the client is told it is light. An unknown theme is the default one.
{
    const light = themes.BUILTIN_THEMES.find((t) => t.mode === 'light');
    assert.ok(light, 'there is a light theme');
    const { html } = mail.frame({ theme: light.id, title: 'Welcome' });
    assert.match(html, /<meta name="color-scheme" content="light">/);
    assert.ok(html.includes(`background:${light.variables['--bg-primary']}`));
    assert.equal(mail.frame({ theme: 'no-such-theme', title: 'x' }).html, mail.frame({ theme: themes.DEFAULT_THEME, title: 'x' }).html);
    const c = mail.palette(light.id);
    assert.ok(themes.contrast(themes.hexToRgb(c.text), themes.hexToRgb(c.card)) >= 7, 'the words stand well clear of the card');
    assert.ok(themes.contrast(themes.hexToRgb(c.onButton), themes.hexToRgb(c.button)) >= 4.5, 'the button\'s words can be read');
}

// In every built-in theme the words can be read, the kicker's on its tint too, in every tone.
for (const t of themes.BUILTIN_THEMES) {
    const c = mail.palette(t.id);
    for (const tone of ['plain', 'alert', 'warning', 'good']) {
        const h = mail.frame({ theme: t.id, tone, kicker: 'Kicker', title: 'T' }).html;
        const m = /border-radius:999px;background:(#[0-9a-f]{6});border:1px solid #[0-9a-f]{6};font:700 12px\/18px [^;]+;color:(#[0-9a-f]{6})/.exec(h);
        assert.ok(m, `${t.id} ${tone}: the kicker pill is drawn`);
        const r = themes.contrast(themes.hexToRgb(m[2]), themes.hexToRgb(m[1]));
        assert.ok(r >= 4.5, `${t.id} ${tone}: the kicker's words on its tint are ${r.toFixed(2)}:1`);
    }
    for (const [name, fg, bg, min] of [['text on the card', c.text, c.card, 4.5], ['quiet text on the card', c.dim, c.card, 4.5], ['faint text on the card', c.faint, c.card, 3], ['a link on the card', c.accent, c.card, 3], ['the button', c.onButton, c.button, 4.5]]) {
        const r = themes.contrast(themes.hexToRgb(fg), themes.hexToRgb(bg));
        assert.ok(r >= min, `${t.id}: ${name} is ${r.toFixed(2)}:1, wanted ${min}:1`);
    }
}

// A code to type is drawn large in its own box, and said in the text.
{
    const { html, text } = mail.frame({ theme: 'vibe', title: 'Your sign-in code', code: '482 913' });
    assert.match(html, /letter-spacing:6px;[^"]*">482 913<\/td>/);
    assert.ok(text.includes('Your code: 482 913'));
}
console.log(`email: one frame in ${themes.BUILTIN_THEMES.length} themes, words that can be read, text only, safe links, one button, the plain-text part`);
