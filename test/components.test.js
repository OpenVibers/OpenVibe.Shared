'use strict';
// components.js: the kit's components as a contract (anatomy, tokens, props, states, a11y) with reference views for
// Compose and SwiftUI, and kit documents that validate strictly and render through kit.js exactly as a direct call would.
const assert = require('assert');
const components = require('../components');
const kit = require('../kit');
const tokens = require('../tokens');
const { BUILTIN_THEMES } = require('../builtin-themes');

const vibe = tokens.fromTheme(BUILTIN_THEMES.find((t) => t.slug === 'vibe'));
const paths = new Set(tokens.flatten(vibe).map((t) => t.path.join('.')));
const kt = tokens.compile(vibe, 'compose');
const swift = tokens.compile(vibe, 'swiftui');
const ktScale = new Set([...kt.slice(kt.indexOf('object OvScale')).matchAll(/val (\w+) =/g)].map((m) => m[1]));
const swScale = new Set([...swift.slice(swift.indexOf('public enum OvScale')).matchAll(/static let (\w+):/g)].map((m) => m[1]));
const swTokens = new Set([...swift.matchAll(/static let (\w+) = Color/g)].map((m) => m[1]));

// ── The contract ──
assert.ok(components.SPECS.length >= 11);
for (const spec of components.SPECS) {
    for (const k of ['id', 'name', 'summary', 'role', 'anatomy', 'props', 'states', 'a11y', 'layout', 'native', 'web']) assert.ok(spec[k], `${spec.id}: ${k}`);
    assert.strictEqual(typeof kit[spec.web.replace('kit.', '')], 'function', `${spec.id}: its web builder ${spec.web} exists`);
    for (const p of components.tokensOf(spec)) assert.ok(paths.has(p), `${spec.id}: token ${p} exists in OpenVibe Tokens`);
    assert.ok(spec.native.compose.includes('@Composable') && /fun Ov\w+\(/.test(spec.native.compose), `${spec.id}: a Compose view`);
    assert.ok(/struct Ov\w+(<[^>]+>)?: View/.test(spec.native.swiftui), `${spec.id}: a SwiftUI view`);
    for (const m of spec.native.compose.matchAll(/OvScale\.(\w+)/g)) assert.ok(ktScale.has(m[1]), `${spec.id}: Compose OvScale.${m[1]} exists in the tokens' Compose file`);
    for (const m of spec.native.swiftui.matchAll(/OvScale\.(\w+)/g)) assert.ok(swScale.has(m[1]), `${spec.id}: Swift OvScale.${m[1]} exists`);
    for (const m of spec.native.swiftui.matchAll(/OvTokens\.(\w+)/g)) assert.ok(swTokens.has(m[1]), `${spec.id}: Swift OvTokens.${m[1]} exists on the theme enum`);
    assert.ok(!/OvTokens\./.test(spec.native.compose), `${spec.id}: Compose reads MaterialTheme roles, not a theme object`);
}
assert.match(components.PREAMBLE.compose, /enum class OvKind/);
assert.match(components.PREAMBLE.swiftui, /typealias OvTokens = VibeDarkTokens/);
console.log(`✓ ${components.SPECS.length} components: anatomy tokens exist, web builders exist, Compose and SwiftUI views use real tokens`);

// ── Kit documents render exactly as the builders do ──
const doc = { type: 'section', props: { title: 'Right now', note: 'Who is live' }, children: [
    { type: 'rail', props: { id: 'now', title: 'Live', more: { href: '/live', label: 'See all' }, wrap: true }, children: [
        { type: 'card', props: { href: '/c/1', title: 'Night walk', type: 'stream', live: true, who: 'goosely', count: [1204, 'watching'] } },
        { type: 'card', props: { href: '/c/2', title: 'Surf race', type: 'stream', sub: 'Utopia · 3 laps' } }] },
    { type: 'stats', props: { items: [[26, 'services'], [106, 'capabilities', '/caps']] } },
    { type: 'list', props: { title: 'Recent' }, children: [{ type: 'row', props: { href: 'https://example.com/', rel: 'nofollow ugc', title: 'A link', sub: 'example.com' } }] },
    { type: 'fold', props: { title: 'More', meta: 'two' }, children: [{ type: 'notice', props: { kind: 'ok', text: 'Saved' } }, { type: 'button', props: { label: 'Go', href: '/go' } }] },
] };
const v = components.validate(doc);
assert.ok(v.ok, v.errors.join('\n'));
const html = components.render(doc, kit);
const direct = kit.section({ title: 'Right now', note: 'Who is live', body:
    kit.rail({ id: 'now', title: 'Live', more: { href: '/live', label: 'See all' }, wrap: true, items: [
        kit.card({ href: '/c/1', title: 'Night walk', type: 'stream', live: true, who: 'goosely', count: [1204, 'watching'], when: null }),
        kit.card({ href: '/c/2', title: 'Surf race', type: 'stream', sub: 'Utopia · 3 laps', when: null })] })
    + kit.stats([[26, 'services'], [106, 'capabilities', '/caps']], { label: 'In numbers' })
    + kit.list([kit.row({ href: 'https://example.com/', rel: 'nofollow ugc', title: 'A link', sub: 'example.com', mark: '' })], { title: 'Recent', more: null, flush: false, empty: '' })
    + kit.fold({ title: 'More', meta: 'two', body: kit.notice({ kind: 'ok', text: 'Saved' }) + kit.button({ href: '/go', type: 'button', label: 'Go', kind: 'primary' }) }) });
assert.strictEqual(html, direct, 'a document renders exactly as the direct builder calls');
assert.match(html, /ovk-rail--wrap/);
console.log('✓ a kit document renders exactly as kit.js does');

// ── Strict validation ──
const bad = (d, re) => { const r = components.validate(d); assert.ok(!r.ok && r.errors.some((e) => re.test(e)), `${JSON.stringify(d).slice(0, 80)} → ${r.errors.join(' | ')}`); assert.throws(() => components.render(d, kit), /invalid kit document/); };
bad({ type: 'marquee' }, /unknown type/);
bad({ type: 'card', props: { title: 'x' } }, /card\.props\.href: required/);
bad({ type: 'card', props: { href: 'javascript:alert(1)', title: 'x' } }, /card\.props\.href: expected url/);
bad({ type: 'card', props: { href: '//evil.example/', title: 'x' } }, /expected url/);
bad({ type: 'card', props: { href: '/x', title: 'x', onclick: 'alert(1)' } }, /onclick: not a prop of card/);
bad({ type: 'button', props: { label: 'x', kind: 'shiny' } }, /kind: expected "primary" \| "quiet" \| "danger"/);
bad({ type: 'button', props: { label: 'x' }, children: [{ type: 'notice', props: { text: 'y' } }] }, /takes no children/);
bad({ type: 'rail', children: [{ type: 'row', props: { title: 'r' } }] }, /rail takes card, not row/);
bad({ type: 'stats', props: { items: [[1, 'a', 'javascript:x']] } }, /items: expected stats/);
bad({ type: 'notice', props: { text: 'x'.repeat(2001) } }, /text: expected string/);
let deep = { type: 'notice', props: { text: 'deep' } };
for (let i = 0; i < 9; i++) deep = { type: 'section', props: { title: `l${i}` }, children: [deep] };
bad(deep, /deeper than 8/);
bad({ type: 'section', children: Array.from({ length: 61 }, () => ({ type: 'notice', props: { text: 'n' } })) }, /more than 60/);
// Text is escaped by kit.js: a document's words can never become markup.
const x = components.render({ type: 'card', props: { href: '/a', title: '<img src=x onerror=alert(1)>', sub: '"><script>alert(1)</script>' } }, kit);
assert.throws(() => components.render({ type: 'notice', props: { text: 'x' } }), /pass kit\.js/, 'on a server the kit is passed in');
assert.ok(!/<img src=x|<script>/.test(x) && /&lt;img src=x/.test(x), 'titles are escaped');
console.log('✓ validation is strict (types, enums, required, children, depth, size, links) and text is escaped');
console.log('components: all checks passed');
