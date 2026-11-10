'use strict';
// The footer strip's one read (owner, 2026-11-10): openvibe.network GET /api/frame/online fills the strip with who
// was on the network in the last thirty minutes, the live channels, the counts that open what they count and this
// site's own items. The old /api/frame/pulse line is the fallback. Nothing from the read is trusted: every string is
// capped, every link must be https, and a guest is a number.
//   node test/footer-online.test.js
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

const f = load();
const read = {
    updated: '2026-11-10T10:00:00.000Z',
    members: 3, guests: 7, total: 10, more: 2,
    people: [{ name: 'Ann', username: 'ann', avatar: 'https://openvibe.network/avatar/ann?s=64', site: 'Live' },
        { name: 'Bo<b>b</b>', username: 'bob', avatar: 'javascript:alert(1)', site: 'Games<script>' }],
    live: { channels: 2, watching: 41, first: [{ name: 'Eve', url: 'https://openvibe.live/@eve' }, { name: 'Fay', url: 'http://evil.example/' }] },
    counts: [
        { id: 'joined', label: 'Joined this week', value: 23, icon: 'members', url: 'https://openvibe.network/stats' },
        { id: 'videos', label: 'Videos today', value: 4, icon: 'video', url: 'https://openvibe.video/' },
        { label: 'Unsafe', value: 1, icon: 'video', url: 'http://openvibe.video/' },
    ],
    items: [
        { label: 'The Rundown', icon: 'news', link: 'https://openvibe.live/rundown', line: 'What streamers talked about' },
        { label: 'Clips', icon: 'clapper', link: 'https://openvibe.live/clips', value: 1284 },
    ],
    sites: 56, views_7d: 81234,
};

// ── the read is cleaned before it reaches a page ──
const clean = f.cleanOnline(read);
assert.deepStrictEqual(clean.people.map((p) => p.username), ['ann', 'bob']);
assert.strictEqual(clean.people[1].avatar, '', 'a picture must be https');
assert.ok(!clean.people[1].site.includes('<'), 'markup is gone');
assert.deepStrictEqual(clean.live.first.map((s) => s.url), ['https://openvibe.live/@eve'], 'an http channel link is dropped');
assert.deepStrictEqual(clean.counts.map((c) => c.link), ['https://openvibe.network/stats', 'https://openvibe.video/'], 'an http count link is dropped');
assert.strictEqual(clean.items.length, 2, 'a site item with no value and no line is dropped, as on the server');
assert.ok(!JSON.stringify(clean).includes('evil.example'));

// ── the strip: the old facts, then who is online, then the counts and the site's own items ──
const html = f.onlineHTML(clean);
assert.ok(html.includes('<span class="ovf-dot" aria-hidden="true"></span>2 live now') && html.includes('href="https://openvibe.live/"'), 'live keeps its dot and its way in');
assert.ok(html.includes('41 watching') && html.includes('56 sites, one account') && html.includes('81k page views this week'), 'the old facts are kept');
assert.ok(html.includes('<details class="ovf-who">') && html.includes('10 online in the last 30 min') && html.includes('7 guests'), 'who is online opens a disclosure; guests are a count');
assert.ok(html.includes('href="https://openvibe.network/@ann"') && html.includes('https://openvibe.network/avatar/ann?s=64') && html.includes('<small>Live</small>'), 'a named member links to their profile with their picture and site');
assert.ok(html.includes('and 2 more'), 'the rest of the list is a count');
assert.ok(!html.includes('guest') || !/guest[^s]/.test(html.replace(/7 guests/, '')), 'nothing about a guest but the count');
assert.ok(html.includes('href="https://openvibe.network/stats"') && html.includes('23') && html.includes('Joined this week'), 'a count opens what it counts');
assert.ok(html.includes('href="https://openvibe.live/rundown"') && html.includes('What streamers talked about'), 'a site\'s own fixed line');
assert.ok(html.includes('href="https://openvibe.live/clips"') && html.includes('1.3k'), 'a site\'s own number');
assert.ok(html.includes('class="ovf-ic"'), 'a count and an item carry their glyph');
assert.ok(html.includes('data-icon=') === false, 'the glyph is drawn, not left for another script');
assert.ok(!html.includes('http://'), 'no insecure link reaches the page');

// Nobody live: nothing at all about live (the owner: show it only while someone is). Nobody online: no disclosure.
assert.ok(!f.onlineHTML(f.cleanOnline({ ...read, live: { channels: 0, watching: 0, first: [] } })).includes('live now'), 'nobody live: no live line');
assert.ok(f.pulseHTML({ live_now: 0, watching: 0, sites: 40, views_7d: 1500 }).includes('Nobody live right now · go live'), 'the old line is the fallback');
assert.ok(!f.onlineHTML(f.cleanOnline({ ...read, members: 0, guests: 0, total: 0, people: [] })).includes('online in the last'), 'nobody online: no list');
assert.ok(!f.onlineHTML(f.cleanOnline({ ...read, counts: [], items: [] })).includes('ovf-online-actions'), 'no counts and no items: no row');

// The slot stays in the footer; the strip is read from /api/frame/online, with the old line as the fallback.
assert.ok(f.buildHTML({ service: 'live', variant: 'full' }).includes('class="ovf-pulse" data-ovf-pulse'), 'the strip slot');
assert.ok(SRC.includes('const ONLINE_URL = `${NETWORK_URL}/api/frame/online`'));
assert.ok(SRC.includes('readNetwork()') && SRC.includes('setInterval(readNetwork, PULSE_MS)'), 'read when the footer is in view, every minute while it is');
assert.ok(SRC.includes('readPulse(); return;'), 'the old pulse line when the new read does not answer');
assert.ok(SRC.includes('?site=${encodeURIComponent(site)}'), 'the read asks as this site, so its own items come back');

// The page-view beacon says only whether the browser is signed in (a boolean, no identity): the network
// counts that person from their presence heartbeat and leaves them out of the guest count.
const NB = fs.readFileSync(path.join(__dirname, '..', 'navbar.js'), 'utf8');
assert.ok(NB.includes('sendBeacon(_config.user && !_config.user.is_anon ? `${hit}?in=1` : hit)'), 'the beacon marks a signed-in browser, and never an anonymous account');
assert.ok(NB.includes("document.addEventListener('openvibe-navbar-auth', send, { once: true })"), 'it waits for the shared sign-in state, once');
assert.ok(!/sendBeacon\([^)]*username|sendBeacon\([^)]*token/.test(NB), 'no identity travels with it');

console.log('footer-online: one read fills the strip, a guest is a number, a live member is named with their picture and site, counts and the site\'s own items open what they count');
