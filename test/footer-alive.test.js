'use strict';
// The footer, 2026-10-27 (owner: "you can use compact footer on the live streamer channel when they are live only … but
// it should be full mode when not live. make sure thats something the shared footer system can handle … in a modular
// way … more alive and has some stats … allow user to expand to full even on pages that use compact … ensure maximized
// SEO"):
// - claim(variant, key) → release(): a part of the page asks for a variant while it needs it; compact wins over full,
//   any claim over the page's own; releasing brings back what is left; setVariant stays the page's own.
// - The compact footer carries the whole footer in a <details> ("More from OpenVibe"): no script needed, and its links
//   are in the page for crawlers (a player page links the network as a home page does). No second shipped line.
// - The pulse line: a slot in the full footer (and the opened compact one), painted from /api/frame/pulse.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'footer.js'), 'utf8');
function load(host = 'openvibe.live') {
    const ctx = vm.createContext({ console, URLSearchParams });
    ctx.globalThis = ctx; ctx.window = ctx;
    ctx.location = { protocol: 'https:', hostname: host, origin: `https://${host}`, pathname: '/@kim', href: `https://${host}/@kim` };
    ctx.localStorage = { getItem: () => null, setItem() {} };
    vm.runInContext(SRC, ctx);
    return ctx.OpenVibeFooter;
}

// ── claims ──
{
    const f = load();
    assert.strictEqual(f.variant, 'full', 'the page\'s own: full');
    const releaseLive = f.claim('compact', 'channel-live');
    assert.strictEqual(f.variant, 'compact', 'a live stream asks for compact');
    const releaseOther = f.claim('full', 'something');
    assert.strictEqual(f.variant, 'compact', 'compact wins over full');
    f.setVariant('full');
    assert.strictEqual(f.variant, 'compact', 'setVariant is the page\'s own; a claim still holds');
    releaseLive();
    assert.strictEqual(f.variant, 'full', 'the stream ended: back to full');
    releaseLive();
    assert.strictEqual(f.variant, 'full', 'releasing twice does nothing');
    releaseOther();
    f.setVariant('compact');
    assert.strictEqual(f.variant, 'compact', 'a compact page');
    const r = f.claim('full', 'k');
    assert.strictEqual(f.variant, 'full', 'a claim beats the page\'s own');
    f.claim('compact', 'k');
    assert.strictEqual(f.variant, 'compact', 'the same key replaces its claim');
    r();
    assert.strictEqual(f.variant, 'compact', 'an old release does not drop the newer claim of its key');
    assert.strictEqual(typeof f.claim('tiny'), 'function', 'an unknown variant: a no-op release');
}

// ── the compact footer opens into the whole one ──
{
    const f = load();
    const compact = f.buildHTML({ service: 'live', variant: 'compact' });
    const full = f.buildHTML({ service: 'live', variant: 'full' });
    assert.ok(/<details class="ovf-expand"><summary>More from OpenVibe<\/summary>/.test(compact), 'a "More from OpenVibe" disclosure');
    const inside = compact.slice(compact.indexOf('<details'));
    assert.ok(inside.includes('The OpenVibe network') && inside.includes('Legal'), 'with the network and legal columns');
    const links = (h) => (h.match(/href="https:\/\/[a-z.]*openvibe\.[a-z]+[^"]*"/g) || []).length;
    assert.ok(links(compact) >= links(full) - 6, `a compact page links the network nearly as a full one does (${links(compact)} vs ${links(full)})`);
    assert.strictEqual((compact.match(/data-ov-shipped/g) || []).length, 1, 'one shipped line');
    assert.ok(!inside.includes('id="ovf-account"'), 'no second account row');
    assert.ok(f.buildHTML({ service: 'live', variant: 'compact', _open: true }).includes('<details class="ovf-expand" open>'), 'an opened one stays open through a re-render');
    assert.ok(full.includes('data-ovf-pulse') && inside.includes('data-ovf-pulse'), 'the pulse slot');
    assert.ok(!f.buildHTML({ service: 'live', variant: 'full', pulse: false }).includes('data-ovf-pulse'), 'pulse: false leaves it out');
    const net = full.slice(full.indexOf('aria-label="The OpenVibe network"'));
    assert.ok((net.slice(0, net.indexOf('</nav>')).match(/<a /g) || []).length >= 9, 'eight sites and "Everything else"');
    const ssr = require('../footer.js').ssr({ service: 'live', variant: 'compact' });
    assert.ok(ssr.includes('data-variant="compact"') && ssr.includes('More from OpenVibe'), 'server-rendered too, so crawlers and no-script visitors get it');
}

// ── the pulse line ──
{
    const f = load();
    const html = f.pulseHTML({ live_now: 3, watching: 41, sites: 40, views_7d: 51234 });
    assert.ok(html.includes('<span class="ovf-dot" aria-hidden="true"></span>3 live now') && html.includes('href="https://openvibe.live/"'));
    assert.ok(html.includes('41 watching') && html.includes('40 sites, one account') && html.includes('51k page views this week'));
    assert.ok(f.pulseHTML({ live_now: 0, watching: 0, sites: 40, views_7d: 1500 }).includes('Nobody live right now · go live'), 'quiet, with a way in');
    assert.ok(f.pulseHTML({ live_now: 0, sites: 40, views_7d: 1500 }).includes('1.5k page views'));
    assert.strictEqual(f.pulseHTML({ live_now: null, watching: null, sites: null, views_7d: null }), '', 'nothing known: nothing shown');
    assert.ok(SRC.includes("new IntersectionObserver(") && SRC.includes('setInterval(readPulse, PULSE_MS)'), 'read when the footer is in view, every minute while it is');
    assert.ok(SRC.includes('.ovf-dot{') && SRC.includes('prefers-reduced-motion:reduce){.ovf-account,.ovf-pulse,.ovf-inner--expanded,.ovf-dot{animation:none}'), 'the live dot pulses, never with reduced motion');
}

// The compact footer stays one line (4.15.1): the closed "More from OpenVibe" pill ends the compact line (the footer is a
// wrapping row) and only the opened disclosure takes a row of its own. In 4.15.0 the pill sat on a second row: 78 px
// instead of 53 px at 1400 px wide, which shrank the Games editor's canvas under its tests' clicks.
{
    assert.ok(SRC.includes('.ovf[data-variant="compact"]{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;column-gap:18px}'), 'the compact footer is one wrapping row');
    assert.ok(SRC.includes('.ovf[data-variant="compact"]>.ovf-expand{margin:0}'), 'the closed pill sits in the row');
    assert.ok(SRC.includes('.ovf[data-variant="compact"]>.ovf-expand[open]{flex:1 1 100%;margin:10px auto 0}'), 'opened, it takes a full-width row');
}

console.log('footer: claims, the compact footer opening into the whole one, the pulse line');
