'use strict';
// The room kit (4.28.0, plan 2026-10-28 §3.3-§3.5): rooms.js (accents that pass AA in both modes), kit.card, kit.rail,
// sc.room and motion.js's markup contract.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rooms = require('../rooms');
const kit = require('../kit');
const sc = require('../showcase');

// ── rooms.js: fourteen rooms, accents 25° of hue apart, each AA in its mode ──
{
    assert.strictEqual(rooms.IDS.length, 14);
    const lum = (hex) => {
        const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const hues = new Set();
    for (const id of rooms.IDS) {
        const r = rooms.get(id);
        assert.ok(ratio(r.dark, '#0B0D12') >= 4.5, `${id}: dark accent ${r.dark} on #0B0D12 is ${ratio(r.dark, '#0B0D12').toFixed(2)}`);
        assert.ok(ratio(r.light, '#FFFFFF') >= 4.5, `${id}: light accent ${r.light} on white is ${ratio(r.light, '#FFFFFF').toFixed(2)}`);
        assert.ok(r.line.split(/\s+/).length <= 8, `${id}: the hero line is eight words at most`);
        assert.ok(kit.ICONS.includes(r.icon), `${id}: its icon ${r.icon} is in the kit`);
        assert.ok(rooms.HOODS[r.hood], `${id}: ${r.hood} is a neighbourhood`);
        hues.add(r.hue);
    }
    assert.strictEqual(hues.size, 14, 'every room has its own hue');
    assert.strictEqual(rooms.get('www.open.shoes').id, 'shoes', 'a room by its host');
    assert.strictEqual(rooms.get('openvibe.live'), null, 'a site that is not a room');
    assert.strictEqual(rooms.style('surf'), '--room-dark:#00BEF6;--room-light:#0072AB');
    assert.strictEqual(rooms.style('nope'), '');
}

// ── kit.card: one anatomy, escaped, honest counts ──
{
    const c = kit.card({ href: '/runs/1', title: '<b>Run</b>', type: 'run', who: 'goose"ly', count: [1832, 'views'], corner: '1:02.4', badge: 'WR', save: { href: '/save/1' }, when: '2026-10-28T09:00:00Z' });
    assert.ok(c.includes('&lt;b&gt;Run&lt;/b&gt;') && !c.includes('<b>Run'), 'the title is escaped');
    assert.ok(c.includes('style="--ovk-ar:16/9"'), 'a run is 16:9');
    assert.ok(c.includes('<span>1.8k views</span>'), 'counts are short');
    assert.ok(c.includes('class="ovk-card-badge">WR<') && c.includes('class="ovk-card-corner">1:02.4<'));
    assert.ok(c.includes('class="ovk-card-link" href="/runs/1"'), 'the title is the link');
    assert.ok(c.includes('data-ovk-share="&lt;b&gt;Run&lt;/b&gt;"'), 'Share is always offered');
    assert.ok(c.includes('href="/save/1"') && c.includes('Save'), 'Save when given');
    assert.ok(!c.includes('Remind me'), 'no Remind unless given');
    assert.ok(c.includes('class="ovk-card-noimg"'), 'no picture: the type\'s icon');
    assert.ok(!kit.card({ title: 'x', count: [0, 'views'] }).includes('0 views'), 'a count of 0 is left out');
    assert.ok(!kit.card({ title: 'x', count: null }).includes('ovk-card-meta'), 'nothing to say: no meta line');
    assert.ok(kit.card({ title: 'x', type: 'shoe' }).includes('--ovk-ar:1/1'), 'a shoe is square');
    assert.ok(kit.card({ title: 'x', type: 'domain' }).includes('--ovk-ar:2/1'), 'a domain is 2:1');
    assert.ok(kit.card({ title: 'x', ratio: '9/16' }).includes('--ovk-ar:9/16'), 'ratio overrides');
    assert.ok(kit.card({ title: 'x', ratio: '1;color:red' }).includes('--ovk-ar:16/9'), 'a bad ratio is ignored');
    assert.ok(kit.card({ title: 'x', href: 'javascript:alert(1)' }).includes('href="#"'), 'a script URL never lands');
    assert.ok(kit.card({ title: 'x', image: 'javascript:x' }).includes('ovk-card-noimg'), 'a bad picture URL is not used');
    assert.ok(kit.card({ title: 'x', live: true }).includes('ovk-card-badge is-live">LIVE'), 'live says LIVE');
    assert.ok(kit.card({ title: 'x', video: '/v.mp4' }).includes('data-src="/v.mp4"') && !kit.card({ title: 'x', video: '/v.mp4' }).includes(' src="/v.mp4"'), 'the preview loads only when hovered');
    assert.ok(kit.card({ title: 'x', level: 2 }).includes('<h2 class="ovk-card-title">'));
}

// ── kit.rail ──
{
    assert.strictEqual(kit.rail({ title: 'Empty', items: [] }), '', 'an empty rail is left out');
    const r = kit.rail({ id: 'now', title: 'Right now', more: { href: '/live', label: 'All' }, items: ['<i>a</i>', '<i>b</i>'], size: 's' });
    assert.ok(r.includes('class="ovk-rail ovk-rail--s" id="now" aria-labelledby="now-h"') && r.includes('<h2 id="now-h">Right now</h2>'));
    assert.strictEqual((r.match(/<li>/g) || []).length, 2);
    assert.ok(r.includes('ovk-rail-prev') && r.includes('ovk-rail-next') && r.includes(' hidden>'), 'arrows start hidden (kit-web shows them)');
    assert.ok(kit.rail({ items: ['x'], size: 'huge' }).includes('ovk-rail--m'), 'an unknown size is medium');
}

// ── sc.room: the front door's order, the accent, nothing invented ──
{
    const html = sc.room({
        room: 'surf',
        hero: { title: 'Ride maps', lede: 'L', search: { action: '/search', placeholder: 'Find', hints: ['a', 'b'] }, chips: [1, 2, 3, 4, 5, 6].map((n) => ({ label: `c${n}`, href: `/c${n}` })) },
        proof: [{ value: 1204, label: 'runs', live: true }, { value: 0, label: 'zero' }, { value: 12, label: 'maps', asOf: 'Oct 28' }],
        rails: [{ id: 'now', title: 'Right now', items: [kit.card({ title: 'x' })] }],
        scenes: [{ title: 'Race', text: 't', html: '<div id="stage"></div>' }],
        explore: { title: 'Explore', items: [{ title: 'Ride', href: '/ride' }] },
        dev: { title: 'For developers', samples: [{ label: 'SDK', code: 'x()' }], links: [{ label: 'OpenAPI', href: '/openapi.json' }] },
        faq: { items: [['Q?', 'A.']] },
    });
    assert.ok(html.startsWith('<div class="ov-room sc-room" data-room="surf" style="--room-dark:#00BEF6;--room-light:#0072AB">'), 'the room wears its accent');
    const order = ['sc-room-hero', 'ovk-rail', 'sc-room-scenes', 'Explore', 'For developers', 'Q?'].map((k) => html.indexOf(k));
    assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), `the parts come in order: ${order}`);
    assert.strictEqual((html.match(/<nav class="sc-room-chips"[\s\S]*?<\/nav>/)[0].match(/<a /g) || []).length, 5, 'five chips at most');
    assert.ok(html.includes('data-ov-ticker="1204">1,204</b>'), 'the real number is written; motion.js only counts up to it');
    assert.ok(!html.includes('zero'), 'a 0 is left out');
    assert.ok(html.includes('<em class="sc-room-live">live</em>') && html.includes('<em>Oct 28</em>'), 'every number is live or dated');
    assert.ok(html.includes('data-ov-typed="a|b"'), 'the box types its hints');
    assert.ok(html.includes('data-ov-reveal'), 'scenes reveal');
    assert.ok(/<p class="sc-room-devlinks">.*OpenAPI.*<\/p><\/section>/.test(html), 'the developer links sit in their section');
    assert.ok(!sc.room({ room: 'nope', hero: { title: 'x' } }).includes('style='), 'an unknown room keeps the theme\'s accent');
    assert.ok(sc.room({ room: 'surf', hero: { title: 'x', start: { href: '/go', label: 'Start surfing' } } }).includes('sc-room-start'), 'one Start when there is no box');
    assert.ok(sc.room({ room: 'surf', hero: { title: 'x' } }).includes('sc-room-motif'), 'the default motif');
    assert.ok(sc.room({ room: 'surf', hero: { title: 'x', motif: '<canvas id="m"></canvas>' } }).includes('<canvas id="m">'), 'a room brings its own motif');
}

// ── The CSS is served and carries the room accent rules; motion.js keeps the server's end state ──
{
    const rcss = fs.readFileSync(path.join(__dirname, '..', 'room.css'), 'utf8');
    const kcss = fs.readFileSync(path.join(__dirname, '..', 'kit.css'), 'utf8');
    assert.ok(rcss.includes(':root[data-theme-mode="light"] .ov-room[style*="--room-light"]'), 'light themes take the light accent');
    assert.ok(rcss.includes('.ovk-rail-btn { display: none; }'), 'phones swipe rails');
    assert.ok(!/ovk-card|ovk-rail|ov-room/.test(kcss), 'kit.css stays the controls only: cards, rails and accents are room.css (4.29.1)');
    const files = require('../files');
    for (const f of ['motion.js', 'rooms.js', 'room.css']) assert.ok(files.isBrowserFile(f), `${f} is served at /shared/`);
    const scss = fs.readFileSync(path.join(__dirname, '..', 'showcase.css'), 'utf8');
    assert.ok(rcss.includes('.sc-room-hero{') && rcss.includes('html.ov-motion [data-ov-reveal]'), 'sc.room()\'s look is in room.css (4.29.2)');
    assert.ok(!scss.includes('.sc-room-hero{'), 'showcase.css, which every product home loads, does not carry the room front door');
    const motion = fs.readFileSync(path.join(__dirname, '..', 'motion.js'), 'utf8');
    assert.ok(/el\.textContent = k < 1 \? .* : text;/.test(motion), 'the ticker ends on the server\'s text');
    assert.ok(motion.includes("html.getAttribute('data-ov-motion') === 'reduced'"), 'the account\'s reduced motion is honoured');
}

console.log('room kit: rooms, card, rail, sc.room and motion ok');
