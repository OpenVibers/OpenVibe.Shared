'use strict';
// openvibe-shared/shell composes a whole page. These are the invariants a consumed shell must keep:
// the SEO head is present, the theme-loader runs before every other script, the runtime scripts are
// deferred and in order, the runtime boot is parseable JSON with `<` escaped, interpolated values are
// escaped, the page summary appears only when asked for, and the no-JS nav + shared footer are there.
const assert = require('node:assert/strict');
const shell = require('openvibe-shared/shell');

// ── A whole document, in order ────────────────────────────────────────────────────────────────────
const html = shell.page({
    name: 'example',
    title: 'Example <site>',
    siteName: 'Example',
    description: 'A <b>description</b>',
    canonical: 'https://example.com/',
    lang: 'en-GB',
    body: '<main id="hero">Hello</main>',
});
assert.ok(html.startsWith('<!doctype html>\n<html lang="en-GB">'), 'doctype and <html lang>');
assert.ok(html.trimEnd().endsWith('</html>'), 'document closes');
assert.match(html, /<title>Example &lt;site&gt;<\/title>/, 'title escaped');
assert.match(html, /<meta name="description" content="A &lt;b&gt;description&lt;\/b&gt;">/, 'description escaped');
assert.match(html, /<link rel="canonical" href="https:\/\/example\.com\/">/, 'canonical present');
assert.match(html, /<meta property="og:title" content="Example &lt;site&gt;">/, 'og:title present and escaped');
assert.match(html, /<noscript><nav aria-label="Site"/, 'no-JS nav present');
assert.match(html, /<footer id="ov-footer"/, 'shared footer present');
assert.ok(html.includes('<main id="hero">Hello</main>'), 'body kept verbatim');
assert.ok(html.includes('<script src="/shared/theme-loader.js?v='), 'theme-loader via serve.url');

// ── Script order: theme-loader first (eager); the runtime after it (deferred) ─────────────────────
const scripts = shell.scripts({ name: 'example' });
assert.ok(!scripts.includes('<!doctype'), 'scripts() is the head block only');
const order = ['theme-loader.js', 'web-runtime.js', 'navbar.js', 'footer.js'].map((f) => html.indexOf(f));
assert.ok(order.every((i) => i > 0), 'every runtime script is present');
assert.deepEqual([...order].sort((a, b) => a - b), order, 'theme-loader, web-runtime, navbar, footer');
const themeTag = html.match(/<script src="[^"]*theme-loader[^"]*"[^>]*><\/script>/)[0];
assert.ok(!/ defer/.test(themeTag), 'theme-loader is eager (before first paint)');
for (const f of ['web-runtime.js', 'navbar.js', 'footer.js']) {
    assert.match(html, new RegExp(`<script src="[^"]*${f.replace('.', '\\.')}[^"]*" defer><\\/script>`), `${f} is deferred`);
}

// ── The runtime boot is JSON, parseable, and can never close the <script> ─────────────────────────
const bootSrc = shell.page({
    name: 'example',
    features: { chat: { scripts: ['/js/chat.js'] } },
    routes: [{ path: '^/chat', features: ['chat'] }],
    versions: { '/js/chat.js': 'abc123' },
});
const m = bootSrc.match(/OVWebRuntime\.create\((\{.*?\})\)\.boot\(\);/);
assert.ok(m, 'the create(...).boot() call is present');
assert.deepEqual(JSON.parse(m[1]), {
    features: { chat: { scripts: ['/js/chat.js'] } },
    routes: [{ path: '^/chat', features: ['chat'] }],
    versions: { '/js/chat.js': 'abc123' },
});
assert.match(bootSrc, /OpenVibeNavbar\.init\(\{"service":"example"\}\);/, 'navbar init carries the service');
const evil = shell.page({ name: 'x', features: { a: '</script><script>alert(1)</script>' } });
assert.ok(!evil.includes('</script><script>alert(1)'), 'a feature name cannot break out of the boot script');
assert.ok(evil.includes('\\u003c/script>'), 'the boot escapes <');

// ── Body attributes are escaped ───────────────────────────────────────────────────────────────────
const attrs = shell.page({ name: 'x', bodyClass: 'a" onload="b', bodyAttributes: { 'data-x': '" y="', hidden: true, skip: null } });
assert.ok(attrs.includes('<body class="a&quot; onload=&quot;b" data-x="&quot; y=&quot;" hidden>'), 'body attributes escaped, bare flag kept, null dropped');

// ── The AI page summary is present only when given, and its JSON-LD comes with it ────────────────
assert.ok(!shell.page({ name: 'x' }).includes('"@type":"WebPage"'), 'no WebPage JSON-LD without a summary');
const withSummary = shell.page({ name: 'x', title: 'X', summary: 'One line', facts: [['Sites', 12]], url: 'https://example.com/' });
assert.match(withSummary, /<meta name="ai-summary" content="One line">/, 'ai-summary meta');
assert.match(withSummary, /"@type":"WebPage"/, 'WebPage JSON-LD with the summary');
assert.match(withSummary, /<noscript><section data-ai-summary>/, 'noscript summary in the body');
assert.ok(withSummary.indexOf('</head>') < withSummary.indexOf('<noscript><section data-ai-summary>'), 'summary body sits after </head>');

console.log('shell: all checks passed');
