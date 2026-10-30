'use strict';
// kit.js — the OpenVibe Kit's builders: complete, escaped markup a page can send as is (docs/kit.md).
const assert = require('assert');
const kit = require('../kit');

// ── Escaping and URLs: text is always escaped, a URL that is not http(s) or same-site becomes '#' ──
{
    const h = kit.head({ title: '<b>Hi</b>', sub: '"quoted" & more', back: { href: 'javascript:alert(1)', label: 'Back <x>' } });
    assert.ok(h.includes('&lt;b&gt;Hi&lt;/b&gt;') && !h.includes('<b>Hi'), 'the title is escaped');
    assert.ok(h.includes('&quot;quoted&quot; &amp; more'), 'the sub line is escaped');
    assert.ok(h.includes('href="#"') && !h.includes('javascript:'), 'a script URL never lands in an href');
    assert.ok(h.includes('aria-label="Back &lt;x&gt;"'), 'labels are escaped');
    for (const ok of ['https://openvibe.chat/x', '/rooms?x=1', '?tab=a', '#top']) assert.strictEqual(kit.url(ok), ok, ok);
    for (const bad of ['javascript:x', '//evil.example/', 'data:text/html,x', ' vbscript:x']) assert.strictEqual(kit.url(bad), '#', bad);
    assert.ok(kit.row({ href: '//evil.example', title: 'x' }).includes('href="#"'), 'protocol-relative links are refused');
    assert.ok(kit.mark({ name: 'A', src: 'javascript:x' }).startsWith('<span'), 'a bad picture URL falls back to letters');
}

// ── The head and its tabs ──
{
    const tabs = kit.tabs({ base: '/settings', items: [{ key: 'look', label: 'Look' }, { key: 'sound', label: 'Sound', count: 2 }], active: 'sound' });
    assert.ok(tabs.includes('href="/settings?tab=look"') && tabs.includes('href="/settings?tab=sound" aria-current="page"'));
    assert.ok(tabs.includes('<span class="ovk-tab-n">2</span>'));
    assert.ok(kit.tabs({ base: '/x?a=1', items: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] }).includes('href="/x?a=1&amp;tab=a"'), 'a base with a query gets &');
    assert.strictEqual(kit.tabs({ base: '/x', items: [{ key: 'only', label: 'Only' }] }), '', 'one tab is no tabs');
    assert.strictEqual(kit.tabOf({ tab: 'sound' }, ['look', 'sound']), 'sound');
    assert.strictEqual(kit.tabOf({ tab: 'nope' }, ['look', 'sound']), 'look', 'unknown → the first');
    assert.strictEqual(kit.tabOf({}, ['look', 'sound']), 'look');
    assert.strictEqual(kit.tabOf({ view: 'b' }, ['a', 'b'], 'view'), 'b', 'another parameter name');
    const h = kit.head({ title: 'Settings', tabs, actions: [kit.iconButton({ href: '/help', icon: 'help', label: 'Help' })] });
    assert.ok(/^<header class="ovk-head">/.test(h) && h.indexOf('ovk-tabs') > h.indexOf('ovk-head-row'), 'the tabs sit inside the sticky head');
    assert.ok(h.includes('<h1>Settings</h1>') && h.includes('aria-label="Help" title="Help"'));
    assert.ok(kit.head({ title: 'x', sticky: false }).includes('ovk-head--static'));
}

// ── Rows and lists ──
{
    const r = kit.row({ href: '/r/a', mark: kit.mark({ name: 'Night Owls' }), title: 'Night Owls', meta: '14:05', metaIso: '2026-10-28T14:05:00Z', sub: 'Late chats', unread: 12 });
    assert.ok(r.startsWith('<li class="ovk-row ovk-row--unread">') && r.includes('<a href="/r/a">'));
    assert.ok(r.includes('<time datetime="2026-10-28T14:05:00Z">14:05</time>'));
    assert.ok(r.includes('aria-label="12 new">9+<'), 'more than nine reads 9+');
    assert.ok(r.includes('>NO</span>'), 'two initials');
    const s = kit.row({ title: 'ann', trail: '<form>…</form>' });
    assert.ok(s.includes('ovk-row--static') && !s.includes('<a '), 'a row without href is static with its own controls');
    assert.strictEqual(kit.list([]), '', 'an empty list without an empty line is nothing');
    assert.ok(kit.list([], { title: 'Rooms', empty: 'None yet' }).includes('<p class="ovk-empty-line">None yet</p>'));
    assert.ok(kit.list([r], { title: 'Rooms', more: { href: '/rooms', label: 'All' } }).includes('<a href="/rooms">All</a>'));
    assert.strictEqual(kit.mark({ name: 'Ann' }), kit.mark({ name: 'Ann' }), 'the same name, the same colour');
    assert.ok(kit.mark({ name: 'x', square: true }).includes('ovk-mark--square'));
    assert.ok(kit.mark({ name: 'émile zola' }).includes('>ÉZ<'), 'letters beyond ASCII');
}

// ── Settings rows, folds, menus ──
{
    assert.ok(kit.switchRow({ name: 'compact', label: 'Compact', hint: 'Less space', on: true }).includes('class="ovk-switch" name="compact" value="1" checked'));
    assert.ok(kit.rangeRow({ name: 'v', label: 'Volume', value: 40 }).includes('value="40"') && kit.rangeRow({ name: 'v', label: 'V', value: 40 }).includes('aria-valuetext="40 percent"'));
    assert.ok(kit.selectRow({ name: 'who', label: 'Who', options: [['all', 'Everyone'], ['none', 'Nobody']], value: 'none' }).includes('<option value="none" selected>Nobody</option>'));
    const seg = kit.seg({ name: 'size', label: 'Text size', options: [['s', 'Small'], ['m', 'Default']], value: 'm' });
    assert.ok(seg.includes('role="radiogroup"') && seg.includes('value="m" checked'));
    assert.ok(kit.chips({ name: 'src', options: [['kick', 'Kick', true], ['yt', 'YouTube', false]] }).includes('name="src_kick" value="1" checked'));
    const f = kit.fold({ id: 'oc-ai', title: 'AI members', meta: '2', body: '<p>x</p>' });
    assert.ok(f.startsWith('<details class="ovk-fold" id="oc-ai">') && !f.includes(' open'));
    assert.ok(kit.fold({ title: 'x', open: true, tone: 'danger' }).includes('ovk-fold--danger" open'));
    const m = kit.more({ label: 'More', items: [{ href: '/a', label: 'Open' }, { action: '/b/delete', label: 'Delete', danger: true, confirm: 'Delete it?' }, null] });
    assert.ok(m.includes('role="menu"') && m.includes('data-ovk-confirm="Delete it?"') && m.includes('ovk-pop-item--danger'));
    assert.ok(kit.section({ title: 'Members', count: 3, note: 'Who', body: '<ul></ul>', id: 'mem' }).includes('aria-labelledby="mem-h"'));
}

// ── Find, dock, numbers, notices ──
{
    const f = kit.find({ action: '/search', placeholder: 'Search rooms' });
    assert.ok(f.includes('role="search"') && f.includes('method="get"') && f.includes('aria-label="Search"'));
    const add = kit.find({ action: '/r/a/members', method: 'post', name: 'username', placeholder: 'Add by username', icon: 'plus', hidden: { role: 'member' }, required: true, pattern: '[A-Za-z0-9_]{3,24}' });
    assert.ok(add.includes('method="post"') && add.includes('<input type="hidden" name="role" value="member">') && add.includes('required pattern="[A-Za-z0-9_]{3,24}"'));
    const d = kit.dock({ action: '/r/a', placeholder: 'Message #general' });
    assert.ok(d.includes('class="ovk-dock"') && d.includes('data-ovk-enter') && d.includes('rows="1"') && d.includes('aria-label="Send"'));
    const st = kit.stats([[1234, 'messages'], [0, 'hidden'], [null, 'unknown'], ['12k', 'views']]);
    assert.ok(st.includes('<dd>1,234</dd>') && st.includes('<dd>12k</dd>') && !st.includes('hidden') && !st.includes('unknown'));
    assert.strictEqual(kit.stats([[0, 'none']]), '', 'nothing to show, no strip');
    assert.ok(kit.notice({ kind: 'error', text: 'No' }).includes('role="alert"'));
    assert.ok(kit.notice({ kind: 'ok', text: 'Saved' }).includes('role="status"'));
    assert.ok(kit.empty({ title: 'No rooms', text: 'Start one', action: { href: '/rooms?new=1', label: 'Start a room' } }).includes('href="/rooms?new=1"'));
    const sn = kit.snippet({ code: '<script src="x"></script>', id: 'snip' });
    assert.ok(sn.includes('data-ovk-copy="#snip"') && sn.includes('hidden') && sn.includes('&lt;script'));
    assert.ok(kit.action({ action: '/s/x/leave', icon: 'leave', label: 'Leave', confirm: 'Leave it?' }).includes('data-ovk-confirm="Leave it?"'));
}

// ── Icons, time ──
{
    assert.ok(kit.ICONS.length >= 60 && kit.ICONS.includes('send') && kit.ICONS.includes('gear'));
    for (const n of kit.ICONS) assert.ok(kit.icon(n).startsWith('<svg class="ovk-i" viewBox="0 0 24 24"') && kit.icon(n).includes('aria-hidden="true"'), n);
    assert.strictEqual(kit.icon('no-such-icon'), '');
    const now = Date.parse('2026-10-28T15:00:00Z');
    assert.strictEqual(kit.when('2026-10-28 14:05:00', now).text, '14:05');
    assert.strictEqual(kit.when('2026-10-27T23:00:00Z', now).text, 'Yesterday');
    assert.strictEqual(kit.when('2026-10-24T10:00:00Z', now).text, 'Sat');
    assert.strictEqual(kit.when('2026-03-02T10:00:00Z', now).text, 'Mar 2');
    assert.strictEqual(kit.when('2025-03-02T10:00:00Z', now).text, '2025-03-02');
    assert.strictEqual(kit.when(now, now).text, '15:00', 'a number');
    assert.deepStrictEqual(kit.when('not a time', now), { iso: '', text: '' });
    assert.doesNotThrow(() => kit.enhance(), 'enhance is a no-op without a document');
    const web = require('../kit-web');
    assert.strictEqual(typeof web.enhance, 'function', 'kit-web.js carries the behaviour');
    assert.doesNotThrow(() => web.enhance(), 'and does nothing without a document');
    let seen = null;
    globalThis.OpenVibeKitWeb = { enhance: (el) => { seen = el; } };
    kit.enhance('container');
    assert.strictEqual(seen, 'container', 'kit.enhance() hands the page\'s markup to kit-web.js');
    delete globalThis.OpenVibeKitWeb;
}

// ── Kit 2: numbers ──
{
    assert.deepStrictEqual(['0.1', '0.027', '0.0041', '12.5', '1234.5'].map((v) => kit.num(Number(v), 'money')), ['$0.10', '$0.027', '$0.0041', '$12.50', '$1,234.50'], 'money keeps cents, and two figures under a dime');
    assert.strictEqual(kit.num(840, 'ms'), '840 ms');
    assert.strictEqual(kit.num(2400, 'ms'), '2.4 s');
    assert.strictEqual(kit.num(1234567, 'compact'), '1.2M');
    assert.strictEqual(kit.num(92, 'percent'), '92%');
    assert.strictEqual(kit.num(null), '–', 'nothing is a dash, never 0');
    assert.strictEqual(kit.num('x', 'int'), '–');
}

// ── Kit 2: steps ──
{
    const s = kit.steps({ current: 1, items: [{ label: 'Opt in', href: '/m/1' }, { label: 'Verify <it>', note: 'a DNS record' }, { label: 'Live', href: '/m/3' }] });
    assert.ok(s.startsWith('<nav class="ovk-steps" aria-label="Steps"'));
    assert.ok(s.includes('Step 2 of 3') && s.includes('<strong>Verify &lt;it&gt;</strong>'), 'the phone line says where you are, escaped');
    assert.ok(s.includes('<li class="is-done"><a href="/m/1">') && s.includes('(done)'), 'a done step links back and says it is done');
    assert.ok(s.includes('<li class="is-current" aria-current="step">'));
    assert.ok(!s.includes('href="/m/3"'), 'a later step never links ahead');
    assert.ok(kit.steps({ current: 9, items: [{ label: 'A' }, { label: 'B' }] }).includes('Step 2 of 2'), 'current is clamped');
    assert.strictEqual(kit.steps({ items: [] }), '');
}

// ── Kit 2: tables ──
{
    const t = kit.table({ caption: 'Plans', columns: [{ key: 'name', label: 'Plan', primary: true }, { key: 'price', label: 'Per month', num: true, fmt: 'money' }, { key: 'site', label: 'Site', hide: 'sm' }, { key: 'raw', label: 'Raw', html: true }],
        rows: [{ name: 'CX22 <b>', price: 4.5, site: { text: 'hetzner.com', href: 'https://hetzner.com' }, raw: '<code>x</code>' }, { name: 'Bad', price: null, site: { text: 'x', href: 'javascript:alert(1)' } }] });
    assert.ok(t.includes('ovk-table--stack') && t.includes('<caption>Plans</caption>'));
    assert.ok(t.includes('<th scope="row" class="is-primary" data-label="Plan">CX22 &lt;b&gt;</th>'), 'the primary cell heads its row, escaped');
    assert.ok(t.includes('<td class="is-num" data-label="Per month">$4.50</td>'), 'numbers are formatted and right-aligned');
    assert.ok(t.includes('<a href="https://hetzner.com">hetzner.com</a>') && !t.includes('javascript:'), 'links are checked');
    assert.ok(t.includes('class="is-hide-sm"') && t.includes('<code>x</code>'), 'html columns pass trusted markup');
    assert.ok(t.includes('data-label="Per month">–</td>'), 'a missing number is a dash');
    assert.strictEqual(kit.table({ columns: [{ key: 'a', label: 'A' }], rows: [], empty: 'Nothing yet' }), '<p class="ovk-table-empty">Nothing yet</p>');
}

// ── Kit 2: charts ──
{
    const day = 86400000, t0 = Date.UTC(2026, 8, 1);
    const line = kit.chart({ type: 'line', title: 'Price', x: { time: true }, y: { fmt: 'money', zero: false }, series: [{ name: 'Price <x>', points: [[t0, 12], [t0 + day, null], [t0 + 2 * day, 10.5], [t0 + 30 * day, 9.99]] }] });
    assert.ok(line.startsWith('<figure class="ovk-chart ovk-chart--line"'));
    assert.ok(/<path class="ovk-chart-line" d="M[^"]*M/.test(line), 'a null breaks the line in two');
    assert.ok(line.includes('preserveAspectRatio="none"'), 'the picture stretches; strokes keep their width in CSS');
    assert.ok(line.includes('class="ovk-chart-yt"') && line.includes('$12.00'), 'y ticks are real text, formatted');
    assert.ok(line.includes('>Sep 1<') || line.includes('>Sep 2<'), 'x ticks fall on days');
    assert.ok(line.includes('Price &lt;x&gt; <b>$9.99</b>'), 'the legend says the latest value, escaped');
    assert.ok(line.includes('<div class="ovk-sr"><table><caption>Price</caption>'), 'a table with the same numbers for screen readers, in a box that can be 1 px wide (a table cannot)');
    const raw = line.match(/data-ovk-chart="([^"]*)"/)[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const data = JSON.parse(raw);
    assert.strictEqual(data.x.length, 4);
    assert.strictEqual(data.s[0].v[1], null, 'the readout knows the gap');
    assert.strictEqual(data.x[0][0], 0);
    assert.strictEqual(data.x[3][0], 100);
    const sc = kit.chart({ type: 'scatter', x: { label: 'Cost', fmt: 'money' }, y: { label: 'Elo', fmt: 'int', zero: false }, points: [{ label: 'a', x: 0.1, y: 1000, best: true, mark: true }, { label: 'b <i>', x: 0.4, y: 1080, best: true, href: '/m/b' }, { label: 'c', x: 0.2, y: 990 }] });
    assert.ok(sc.includes('class="ovk-chart-front"'), 'the frontier is drawn through the best points');
    assert.ok(sc.includes('<a href="/m/b" class="ovk-chart-dot is-best is-right"'), 'a point can link; one on the right opens its label leftwards');
    assert.ok(sc.includes('aria-label="b &lt;i&gt;: Elo 1,080, Cost $0.40"'), 'every point says its values');
    const bar = kit.chart({ type: 'bar', y: { fmt: 'int' }, series: [{ name: 'Clips', points: [['Mon', 4], ['Tue', 8], ['Wed', null]] }] });
    assert.strictEqual((bar.match(/class="ovk-chart-bar[ "]/g) || []).length, 3);
    assert.ok(bar.includes('is-none') && bar.includes('aria-label="Tue: 8"'));
    assert.strictEqual(kit.chart({ series: [] }), '', 'no data, no chart');
}

// ── Kit 2: rank, meter, drop, receipt, page ──
{
    const r = kit.rank({ base: 900, fmt: 'int', items: [{ name: 'gpt <x>', href: '/m/1', value: 1086, interval: 14, delta: 2, note: '4,812 votes' }, { name: 'b', value: 1000, delta: -1 }, { name: 'c', value: 900, delta: 'new' }] });
    assert.ok(r.includes('<ol class="ovk-rank"') && r.includes('<a class="ovk-rank-link" href="/m/1">gpt &lt;x&gt;</a>'));
    assert.ok(r.includes('<b>1,086</b><small>± 14</small>') && r.includes('aria-label="up 2"') && r.includes('is-new'));
    assert.ok(r.includes('--v:1.000') && r.includes('--v:0.000'), 'bars run from the base to the top value');
    assert.ok(kit.meter({ value: 95, label: 'Disk', tone: 'auto' }).includes('ovk-meter--bad'), 'auto: red near a limit');
    assert.ok(!kit.meter({ value: 95, label: 'Confidence' }).includes('ovk-meter--'), 'without a tone, more is just more');
    assert.ok(kit.meter({ value: 150, max: 100 }).includes('aria-valuenow="100"'), 'clamped');
    const d = kit.drop({ name: 'image', accept: 'image/*', label: 'Drop <a> picture', camera: true, auto: true });
    assert.ok(d.includes('type="file" class="ovk-drop-input" id="ovk-drop-image" name="image" accept="image/*"') && d.includes('data-ovk-auto'));
    assert.ok(d.includes('<label for="ovk-drop-image" class="ovk-drop-zone">') && d.includes('Drop &lt;a&gt; picture'));
    assert.ok(d.includes('capture="environment"') && d.includes('ovk-drop-cam" hidden'), 'the camera waits for kit-web on a phone');
    assert.ok(!/data-ovk-drop-cam[^>]*name=/.test(d) && !/name="[^"]*"[^>]*data-ovk-drop-cam/.test(d), 'the camera input has no name, so an unused one never posts an empty file');
    const rc = kit.receipt({ title: 'Read', body: '<p>Hi</p>', facts: [['Model', 'ocr <2>'], ['Cost', '$0.002'], ['Empty', ''], ['Confidence', { html: '<span class="x"></span>' }]] });
    assert.ok(rc.includes('<dt>Model</dt><dd>ocr &lt;2&gt;</dd>') && rc.includes('<span class="x"></span>') && !rc.includes('Empty'), 'facts: escaped, trusted html when asked, blanks left out');
    const pg = kit.page({ head: '<header>h</header>', body: 'B', side: 'S', wide: true });
    assert.ok(pg.startsWith('<main class="ovk-page ovk-page--wide" id="main"><header>h</header><div class="ovk-split"><div class="ovk-main">B</div><aside class="ovk-side">S</aside>'));
    assert.strictEqual(kit.page({ body: 'B' }), '<main class="ovk-page" id="main">B</main>');
    assert.strictEqual(kit.VERSION, 2);
}

// ── The tool frame (4.55.0): toolHead, toolInput, tries, answer, family, tool ──
{
    const h = kit.toolHead({ icon: 'globe', hue: 190, crumb: { href: '/network', label: 'Network <tools>' }, title: 'Whois <b>', task: 'Who "registered" it' });
    assert.ok(h.startsWith('<header class="ovk-tool-head" style="--ovk-tint-h:190">'), 'the family tint is a hue number');
    assert.ok(h.includes('<a class="ovk-tool-crumb" href="/network">Network &lt;tools&gt;') && h.includes('<h1 class="ovk-tool-title">Whois &lt;b&gt;</h1>'));
    assert.ok(h.includes('<p class="ovk-tool-task">Who &quot;registered&quot; it</p>'));
    const evil = kit.toolHead({ title: 'x', hue: 'red;background:url(x)' });
    assert.ok(/--ovk-tint-h:\d+"/.test(evil) && !evil.includes('url('), 'a hue that is no number is hashed, never written into the style');
    assert.ok(kit.toolHead({ title: 'x', hue: -30 }).includes('--ovk-tint-h:330') && kit.toolHead({ title: 'x', hue: 725 }).includes('--ovk-tint-h:5'));
    assert.ok(kit.toolHead({ title: 'Solo' }).includes('ovk-tool-head--solo'), 'no crumb: the tile sits beside the title alone');
    assert.ok(kit.toolHead({ title: 'x', crumb: { href: 'javascript:alert(1)', label: 'c' } }).includes('href="#"'), 'a crumb link is kept only when it is http(s) or a path');
    assert.ok(kit.toolHead({ title: 'x', level: 2 }).includes('<h2 class="ovk-tool-title">'));
    const fh = kit.toolHead({ title: 'PNG Converter', facts: ['Free', { text: 'Runs in your browser: nothing is uploaded', icon: 'lock' }, '', null, 'Files up to <50> MB'] });
    assert.ok(fh.includes('<ul class="ovk-tool-facts"><li>Free</li><li><svg class="ovk-i"') && fh.includes('Runs in your browser: nothing is uploaded</li><li>Files up to &lt;50&gt; MB</li></ul></header>'), 'the terms: escaped, blanks left out, an icon when asked');
    assert.ok(!kit.toolHead({ title: 'x' }).includes('ovk-tool-facts'), 'no terms, no list');

    const t = kit.tries({ name: 'q', items: [{ value: 'a b&c' }, { label: 'IP', value: '1.1.1.1' }, { label: 'Docs', href: 'javascript:x' }, null] });
    assert.ok(t.startsWith('<p class="ovk-try"><span>Try</span>'));
    assert.ok(t.includes('<a href="?q=a%20b%26c" data-ovk-try="a b&amp;c" data-ovk-name="q">a b&amp;c</a>'), 'without JavaScript an example is a link that runs the tool from the query');
    assert.ok(t.includes('data-ovk-try="1.1.1.1" data-ovk-name="q">IP</a>'));
    assert.ok(t.includes('<a href="#">Docs</a>'), 'an example link is sanitised like every other');
    assert.strictEqual(kit.tries({ items: [] }), '', 'no examples, nothing drawn');

    const i = kit.toolInput({ name: 'q', label: 'Domain or IP', placeholder: 'example.com', button: 'Look up', value: 'x"y', inputmode: 'url', tries: { items: [{ value: 'openvibe.network' }] } });
    assert.ok(i.startsWith('<form class="ovk-tool-form" method="get" action="?">'));
    assert.ok(i.includes('<label class="ovk-tool-label" for="ovk-tool-q">Domain or IP</label>') && i.includes('value="x&quot;y"') && i.includes('inputmode="url"'));
    assert.ok(i.includes('data-ovk-clear="#ovk-tool-q" aria-label="Clear" title="Clear">'), 'a box with text shows its clear button');
    assert.ok(kit.toolInput({ name: 'q' }).includes('title="Clear" hidden>'), 'an empty box hides it until there is text');
    assert.ok(i.includes('<button type="submit" class="ovk-btn ovk-btn--primary ovk-tool-go">') && i.includes('<span>Look up</span>'));
    assert.ok(i.includes('data-ovk-for="#ovk-tool-q"') && i.endsWith('</p></form>'), 'its examples point at its own box');
    assert.ok(kit.toolInput({ name: 'q', type: 'password' }).includes('type="text"'), 'only plain text types');
    assert.ok(!/<input id="ovk-tool-q"[^>]*aria-label=/.test(kit.toolInput({ name: 'q', label: 'L' })), 'a labelled box needs no aria-label');

    const a = kit.answer({ title: 'openvibe.network', badge: { text: 'Registered', tone: 'ok' }, actions: ['<button>c</button>'],
        rows: [['Registrar', 'Cloud <flare>'], ['Expires', '2027', { text: 'in 10 months', tone: 'warn' }], ['Created', '2025', '1 year ago'], ['Empty', ''], ['NS', { html: 'a<br>b' }]],
        next: ['<a class="n">Watch</a>'], id: 'ans' });
    assert.ok(a.startsWith('<section class="ovk-answer" id="ans" aria-live="polite">'), 'the answer is announced when it arrives');
    assert.ok(a.includes('<h2>openvibe.network</h2><span class="ovk-badge ovk-badge--ok">Registered</span><span class="ovk-answer-acts"><button>c</button></span>'));
    assert.ok(a.includes('<div><dt>Registrar</dt><dd>Cloud &lt;flare&gt;</dd></div>') && !a.includes('Empty'), 'rows: escaped, blanks left out');
    assert.ok(a.includes('2027 <span class="ovk-pill ovk-pill--warn">in 10 months</span>') && a.includes('2025 <span class="ovk-pill">1 year ago</span>'));
    assert.ok(a.includes('<dd>a<br>b</dd>') && a.includes('<div class="ovk-answer-next"><a class="n">Watch</a></div>'));
    const bad = kit.answer({ title: 'Not valid JSON', tone: 'bad', body: '<p>x</p>', live: false });
    assert.ok(bad.startsWith('<section class="ovk-answer ovk-answer--bad">') && bad.includes('<div class="ovk-answer-body"><p>x</p></div>'));
    assert.ok(kit.answer({ body: 'B' }).includes('aria-label="Answer"') && !kit.answer({ body: 'B' }).includes('ovk-answer-head'), 'no title, no head');

    const f = kit.family({ title: 'Network tools', more: { href: '/network', label: 'All 22' }, items: [{ href: '/whois', label: 'Whois Lookup', short: 'Whois', current: true }, { href: '/dns', label: 'DNS Lookup' }, { label: '' }] });
    assert.ok(f.startsWith('<nav class="ovk-family" aria-label="Network tools">') && f.includes('<a href="/network">All 22</a>'));
    assert.ok(f.includes('<a href="/whois" aria-current="page"><span class="ovk-family-short">Whois</span><span class="ovk-family-full">Whois Lookup</span></a>'), 'short on a phone, full beside the tool');
    assert.ok(f.includes('<a href="/dns">DNS Lookup</a>') && (f.match(/<a href/g) || []).length === 3, 'an item with no label is left out');
    assert.strictEqual(kit.family({ items: [] }), '');

    const w = kit.tool({ head: '<header>H</header>', input: '<form>I</form>', family: '<nav>F</nav>', folds: [kit.fold({ title: 'About' }), '', kit.fold({ title: 'Questions' })], related: '<ul>R</ul>', id: 'tool' });
    assert.ok(w.startsWith('<div class="ovk-tool" id="tool"><header>H</header><div class="ovk-tool-card"><form>I</form></div><div class="ovk-tool-out"></div><nav>F</nav>'), 'the order: head, box, answer slot, family');
    assert.ok(w.includes('<div class="ovk-tool-folds"><details class="ovk-fold">') && (w.match(/<details/g) || []).length === 2 && w.endsWith('<div class="ovk-tool-related"><ul>R</ul></div></div>'));
    assert.ok(kit.tool({ answer: '<section>A</section>' }).includes('<div class="ovk-tool-out"><section>A</section></div>'), 'the answer goes in its slot');
}

// kit-web.js marks what it has wired under a name of its own: data-ovk-copy="#id" is dataset.ovkCopy, so a mark of the
// same name was set by the markup itself, and copy buttons, sheets and confirms were never wired (fixed in 4.55.0).
{
    for (const file of ['kit-web.js', 'kit-data-web.js']) {
        const src = require('fs').readFileSync(require('path').join(__dirname, '..', file), 'utf8');
        assert.ok(/const once = \(el, key\) => \{ const k = `\$\{key\}Wired`;/.test(src), `${file}: once() keeps its mark apart from the data-ovk-* attribute it wires`);
        const keys = [...src.matchAll(/once\(\w+, '(\w+)'\)/g)].map((m) => m[1]);
        assert.ok(keys.length >= 3 && keys.every((k) => !/Wired$/.test(k)), `${file}: once() adds the suffix itself`);
    }
}

console.log('kit: builders, escaping, tabs, rows, settings, find/dock, icons, time and Kit 2 (steps, table, chart, rank, meter, drop, receipt, page) and the tool frame ok');
