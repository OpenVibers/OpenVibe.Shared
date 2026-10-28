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
}

console.log('kit: builders, escaping, tabs, rows, settings, find/dock, icons and time ok');
