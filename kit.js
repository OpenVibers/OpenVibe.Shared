/**
 * openvibe-shared/kit.js — the OpenVibe Kit: the pieces an app page is made of, one look on every OpenVibe site (and on
 * anyone's: the package is MIT), phone first. Draw with /shared/kit.css. docs/kit.md describes every piece and how it
 * behaves on a phone, a tablet and a computer.
 *
 * The owner, 2026-10-28: "the pages are so dang long… use tabs or collapsible areas… fixed position elements… on a
 * phone it should act like an app, not a huge long web page… one app ecosystem across all our systems." So a page is:
 * a sticky head (back, title, one muted line, icon actions) with its tabs, content in lists of rows and cards that fold,
 * a dock pinned at the bottom for the one thing you type, and the navbar's app bar under it on phones.
 *
 * The same file runs on the server (require('openvibe-shared/kit'): builders return HTML strings, every text escaped,
 * so pages are complete without JavaScript) and in the browser (window.OpenVibeKit: the same builders for pages that
 * draw themselves). The behaviour (copy buttons, menus that close, Enter to send, sheets, confirms) is kit-web.js, a
 * small file of its own: a server-rendered site loads only that; a page that draws itself loads both and calls
 * OpenVibeKit.enhance(container) after adding markup.
 *
 *   const kit = require('openvibe-shared/kit');
 *   kit.head({ title: 'Settings', sub: 'Saved to your account', back: { href: '/', label: 'Home' },
 *              actions: [kit.iconButton({ href: '/help', icon: 'help', label: 'Help' })],
 *              tabs: kit.tabs({ base: '/settings', items: [{ key: 'look', label: 'Look' }, …], active }) })
 *   kit.tabOf(req.query, ['look', 'sound'])                     → the open tab (the first when none or unknown)
 *   kit.list([kit.row({ href, mark: kit.mark({ name }), title, meta: kit.when(ts).text, sub, unread: 2 }), …])
 *   kit.section({ title: 'Messages look', body: kit.switchRow({ name, label, hint, on }) + kit.rangeRow(…) + … })
 *   kit.fold({ id, title, meta, open, body })                    a card that opens: setup, extras, danger
 *   kit.find({ action, name, placeholder, icon: 'search' })      a search or "add by name" row
 *   kit.dock({ action, name, placeholder, label })               the composer pinned at the bottom
 *   kit.stats([[1234, 'messages this week'], …])                 a strip of numbers (scrolls sideways on phones)
 *   kit.empty({ title, text, action: { href, label } }) · kit.notice({ kind, text }) · kit.more({ label, items })
 *   kit.button({ href | type, label, icon, kind }) · kit.iconButton(…) · kit.chips(…) · kit.seg(…) · kit.icon(name)
 *   kit.mark({ name, src, hue, square }) · kit.when(ts) → { iso, text } · kit.esc(text) · kit.ICONS (names)
 *   kit.sidebar({ id, label, action, find, nav, sections, foot }) · kit.sidebarButton({ id }) · kit.withSidebar({ sidebar,
 *   body })                                                       the left sidebar: vertical navigation, a drawer on phones
 *
 * The tool frame, one order for every tool page: kit.tool({ head: kit.toolHead({ icon, hue, crumb, title, task, facts }),
 *   input: kit.toolInput({ name, label, placeholder, button, tries: { items } }) | kit.drop(…) | an editor,
 *   answer: kit.answer({ title, badge, rows: [[label, value, note]], next }), family: kit.family({ title, more, items }),
 *   folds: [kit.fold(…)], related: kit.list(…) })
 *
 * Text arguments are escaped; arguments named body, html, before, after, actions, trail, badge, extra and mark take
 * trusted markup (usually another builder's output). URLs are kept only when they are http(s) or same-site paths.
 */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    root.OpenVibeKit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    /** A URL kept only when it is http(s), a same-site path, a query or a fragment; anything else becomes '#'. */
    const url = (u) => { const s = String(u == null ? '' : u).trim(); return /^(https?:\/\/|\/(?!\/)|\?|#)/i.test(s) ? s : '#'; };
    const attrs = (o) => Object.keys(o || {}).filter((k) => o[k] != null && o[k] !== false && /^[a-z][a-z0-9-]*$/i.test(k)).map((k) => (o[k] === true ? ` ${k}` : ` ${k}="${esc(o[k])}"`)).join('');

    // ── Icons: 24-unit line drawings in the text's colour (stroke 2, round), one set for every site ──
    const P = {
        back: '<path d="M15 5l-7 7 7 7"/>', forward: '<path d="m9 5 7 7-7 7"/>', chevron: '<path d="m9 6 6 6-6 6"/>',
        up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>',
        plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
        send: '<path d="M12 19V5M5 12l7-7 7 7"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
        more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
        menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', sidebar: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/>', filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
        home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1Z"/>',
        chat: '<path d="M4 5h16v11H8l-4 4Z"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
        bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15ZM10 20a2 2 0 0 0 4 0"/>',
        user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
        members: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.8a3.2 3.2 0 0 1 0 6.4M18 14.8c1.9.6 3 2.4 3 5.2"/>',
        invite: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M19 8v6M16 11h6"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
        pencil: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
        copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
        open: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
        link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
        download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
        lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
        key: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.7-8.7M16 7l3 3M14 9l2 2"/>',
        ban: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>', help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8M12 17h.01"/>',
        info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>', alert: '<path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4M12 17h.01"/>',
        clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
        spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/>',
        star: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6Z"/>', heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
        play: '<path d="M8 5v14l11-7Z"/>', pause: '<path d="M8 5v14M16 5v14"/>', stop: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 8.5 7 7"/>',
        live: '<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
        video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
        image: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>',
        file: '<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v4h4"/>', folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
        code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>', terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
        computer: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>', phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
        globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
        tag: '<path d="M3 12V4h8l10 10-8 8Z"/><circle cx="7.5" cy="8.5" r="1.3"/>', cart: '<path d="M3 4h2l2.4 11h11L21 7H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
        coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2-.4-2.5-1.2M12 6.5v11"/>',
        gift: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M3 9h18M12 9v11M12 9c-1.5-3-5-4-5-1.5S12 9 12 9s5-1 5-3.5S13.5 6 12 9"/>',
        trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
        flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
        map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2Z"/><path d="M9 4v14M15 6v14"/>', book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z"/><path d="M4 19V5"/>',
        game: '<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 13.5h.01"/>',
        leave: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"/>',
        retry: '<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5"/>',
        task: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>', steps: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
        hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6.5 7-2.6 0-4.2-1.3-5.7-3.6L3 13.6a1.5 1.5 0 0 1 2.4-1.8L8 15"/>',
        shield: '<path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6Z"/>', zap: '<path d="M13 3 5 13h6l-1 8 8-10h-6Z"/>',
        cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18Z"/>', server: '<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.01M8 16.5h.01"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>', grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
        list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
        chart: '<path d="M4 4v16h16"/><path d="m7.5 14.5 3.5-4 3 2.5 5-6"/>', swap: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
        wave: '<path d="M2 16c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M5.5 11.5A7 7 0 0 1 18 8.6c-2.3-.5-4.2.4-4.8 2.4"/>',
        shoe: '<path d="M2.5 17v-5.5l4-.5 3-4 3.2 1.4-.9 2.6 4 2.2 4.7 1a2 2 0 0 1 1.5 1.9V17Z"/><path d="M2.5 20h19"/>',
        palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6s.8-1.7 2-1.7H17a4 4 0 0 0 4-4C21 6.7 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7.3" r="1.2"/><circle cx="14.5" cy="7.3" r="1.2"/>', robot: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5M3 13v2M21 13v2"/>',
    };
    const ICONS = Object.freeze(Object.keys(P));
    /** Every icon's drawing (the inside of a 24-unit SVG), for openvibe-shared/glyphs, the one registry built on these. */
    const PATHS = Object.freeze({ ...P });
    /** One icon as inline SVG (decorative: aria-hidden); '' for a name the set does not have. */
    function icon(name, { size = null, cls = '' } = {}) {
        const d = P[name];
        if (!d) return '';
        return `<svg class="ovk-i${cls ? ` ${esc(cls)}` : ''}" viewBox="0 0 24 24"${size ? ` width="${Number(size) || 20}" height="${Number(size) || 20}"` : ''} aria-hidden="true" focusable="false">${d}</svg>`;
    }

    // ── Time and marks ──
    const DAY = 86400000;
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    /** A time people read at a glance: 14:05 today, Yesterday, Mon this week, Oct 20 this year, else 2025-10-20 (UTC). */
    function when(ts, now = Date.now()) {
        const s = ts instanceof Date ? ts.toISOString() : typeof ts === 'number' ? new Date(ts).toISOString() : String(ts || '');
        const t = Date.parse(/[TZ]/.test(s) || !s.includes(' ') ? s : `${s.replace(' ', 'T')}Z`);
        if (!Number.isFinite(t)) return { iso: '', text: '' };
        const d = new Date(t), n = new Date(now);
        const today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
        let text;
        if (t >= today) text = d.toISOString().slice(11, 16);
        else if (t >= today - DAY) text = 'Yesterday';
        else if (t >= today - 6 * DAY) text = WEEKDAYS[d.getUTCDay()];
        else if (d.getUTCFullYear() === n.getUTCFullYear()) text = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
        else text = d.toISOString().slice(0, 10);
        return { iso: d.toISOString(), text };
    }
    /** A steady hue (0-359) for a name or id, so the same thing has the same colour everywhere. */
    function hueOf(key) { let h = 0; for (const ch of String(key || '')) h = (h * 31 + ch.codePointAt(0)) % 360; return h; }
    /** A person's or a place's mark: their picture, or up to two letters on a colour from the name (square: a place). */
    function mark({ name = '?', src = '', hue = null, square = false, size = null } = {}) {
        const cls = `ovk-mark${square ? ' ovk-mark--square' : ''}`;
        const st = size ? `--ovk-mark:${Number(size) || 40}px;` : '';
        if (src && url(src) !== '#') return `<img class="${cls}" src="${esc(url(src))}" alt="" loading="lazy" decoding="async"${st ? ` style="${st}"` : ''}>`;
        const words = String(name || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
        const letters = (words.length > 1 ? [...words[0]][0] + [...words[1]][0] : [...(words[0] || '?')].slice(0, 2).join('')).toUpperCase();
        return `<span class="${cls}" style="${st}--ovk-hue:${hue == null ? hueOf(name) : Number(hue) || 0}" aria-hidden="true">${esc(letters)}</span>`;
    }

    // ── Controls ──
    /** A button or a link that looks like one. kind: 'primary' (default), 'quiet', 'danger', 'ghost'; small: a pill. */
    function button({ href = null, type = 'submit', label = '', icon: ic = '', kind = 'primary', small = false, name = null, value = null, attrs: extra = null } = {}) {
        const cls = `ovk-btn ovk-btn--${esc(kind)}${small ? ' ovk-btn--small' : ''}`;
        const inner = `${ic ? icon(ic) : ''}<span>${esc(label)}</span>`;
        if (href != null) return `<a class="${cls}" href="${esc(url(href))}"${attrs(extra)}>${inner}</a>`;
        return `<button class="${cls}" type="${type === 'button' ? 'button' : type === 'reset' ? 'reset' : 'submit'}"${name ? ` name="${esc(name)}"` : ''}${value != null ? ` value="${esc(value)}"` : ''}${attrs(extra)}>${inner}</button>`;
    }
    /** An icon-only control: a link (href), or a button (type) — it always carries its label for screen readers and a tooltip. */
    function iconButton({ href = null, type = 'submit', icon: ic = 'more', label = '', name = null, value = null, kind = '', attrs: extra = null } = {}) {
        const cls = `ovk-icon-btn${kind ? ` ovk-icon-btn--${esc(kind)}` : ''}`;
        const a = ` aria-label="${esc(label)}" title="${esc(label)}"${attrs(extra)}`;
        if (href != null) return `<a class="${cls}" href="${esc(url(href))}"${a}>${icon(ic)}</a>`;
        return `<button class="${cls}" type="${type === 'button' ? 'button' : 'submit'}"${name ? ` name="${esc(name)}"` : ''}${value != null ? ` value="${esc(value)}"` : ''}${a}>${icon(ic)}</button>`;
    }
    /** A one-button form (a POST action as an icon or a button), e.g. leave, delete, revoke. confirm: asked first (kit.enhance). */
    function action({ action: to, method = 'post', hidden = {}, confirm = '', ...btn }) {
        const fields = Object.keys(hidden || {}).map((k) => `<input type="hidden" name="${esc(k)}" value="${esc(hidden[k])}">`).join('');
        const control = btn.label && !btn.iconOnly ? button(btn) : iconButton(btn);
        return `<form class="ovk-inline" method="${method === 'get' ? 'get' : 'post'}" action="${esc(url(to))}"${confirm ? ` data-ovk-confirm="${esc(confirm)}"` : ''}>${fields}${control}</form>`;
    }
    /** A small badge beside a name: tone 'accent' | 'ok' | 'warn' | 'bad' | 'live' | '' (quiet). */
    const badge = (text, tone = '') => `<span class="ovk-badge${tone ? ` ovk-badge--${esc(tone)}` : ''}">${esc(text)}</span>`;
    /** An unread count: 1-9, then 9+. */
    const dot = (n) => (Number(n) > 0 ? `<span class="ovk-dot" aria-label="${Number(n)} new">${Number(n) > 9 ? '9+' : Number(n)}</span>` : '');

    // ── The page's head and its tabs ──
    /**
     * The sticky head every app page starts with: back (an icon), the title and one muted line, icon actions on the right,
     * and the page's tabs under it (kit.tabs). It stays under the navbar while the page scrolls.
     */
    function head({ title = '', titleHtml = null, sub = '', subHtml = null, back = null, actions = [], tabs = '', level = 1, sticky = true } = {}) {
        const h = level === 2 ? 'h2' : 'h1';
        return `<header class="ovk-head${sticky ? '' : ' ovk-head--static'}"><div class="ovk-head-row">`
            + (back ? `<a class="ovk-icon-btn ovk-back" href="${esc(url(back.href))}" aria-label="${esc(back.label || 'Back')}" title="${esc(back.label || 'Back')}">${icon('back')}</a>` : '')
            + `<div class="ovk-head-id"><${h}>${titleHtml != null ? titleHtml : esc(title)}</${h}>${subHtml != null ? `<p class="ovk-sub">${subHtml}</p>` : sub ? `<p class="ovk-sub">${esc(sub)}</p>` : ''}</div>`
            + (actions && actions.length ? `<div class="ovk-head-tools">${actions.join('')}</div>` : '')
            + `</div>${tabs || ''}</header>`;
    }
    // ── The left sidebar (L35) ──
    /**
     * An app's left sidebar, one for every OpenVibe product (the owner, 2026-10-31: "the navigation makes more sense
     * in a vertical way… part of the openvibe.design shared styling across everything"): the main action and search at
     * the top, the navigation as vertical rows (an icon and a name, the page you are on marked, a count or a dot), the
     * sections under it (conversations, recent things) and a foot. A column beside the page from 761 px; on a phone a
     * drawer that kit.sidebarButton opens and the scrim, its close button or Escape close (kit-web.js, boost-safe).
     *   kit.sidebar({ id, label, action: { href, label, icon }, find: { action, name, placeholder, label },
     *                 nav: [{ href, label, icon, iconHtml, here, count, dot }],
     *                 sections: [{ title, items: [{ href, label, meta, mark, here, dot }], empty }], foot })
     *   kit.sidebarButton({ id, label })      the button that opens it on a phone (shown only there)
     *   kit.withSidebar({ sidebar, body })     the sidebar and the page side by side
     * dot: true, or 'busy' | 'needs' | 'bad'. mark and foot take trusted markup; iconHtml replaces a kit icon.
     */
    function sidebar({ id = 'ovk-sidebar', label = 'Navigation', action: act = null, find: f = null, nav = [], sections = [], foot = '' } = {}) {
        const dotHtml = (d) => (d ? `<i class="ovk-sidebar-dot${d === true ? '' : ` is-${esc(d)}`}" aria-hidden="true"></i>` : '');
        const link = (x) => `<a class="ovk-sidebar-link${x.here ? ' is-here' : ''}" href="${esc(url(x.href))}"${x.here ? ' aria-current="page"' : ''}>`
            + `${x.iconHtml != null ? x.iconHtml : icon(x.icon || 'chevron')}<span>${esc(x.label)}</span>`
            + `${Number(x.count) > 0 ? `<b class="ovk-sidebar-count">${Number(x.count) > 99 ? '99+' : Number(x.count)}</b>` : dotHtml(x.dot)}</a>`;
        const item = (x) => `<a class="ovk-sidebar-item${x.here ? ' is-here' : ''}" href="${esc(url(x.href))}"${x.here ? ' aria-current="page"' : ''}>`
            + `${x.mark || ''}<span class="ovk-sidebar-t">${esc(x.label)}</span>${x.meta ? `<span class="ovk-sidebar-m">${esc(x.meta)}</span>` : ''}${dotHtml(x.dot)}</a>`;
        const secs = (sections || []).map((sec) => {
            const items = sec.items || [];
            return `<section class="ovk-sidebar-sec">${sec.title ? `<h2 class="ovk-sidebar-h">${esc(sec.title)}</h2>` : ''}${items.map(item).join('')}`
                + `${!items.length && sec.empty ? `<p class="ovk-sidebar-empty">${esc(sec.empty)}</p>` : ''}</section>`;
        }).join('');
        return `<aside class="ovk-sidebar" id="${esc(id)}" aria-label="${esc(label)}" data-ovk-sidebar>`
            + `<div class="ovk-sidebar-top">${act ? `<a class="ovk-sidebar-action" href="${esc(url(act.href))}">${icon(act.icon || 'plus')}<span>${esc(act.label)}</span></a>` : ''}`
            + `<button class="ovk-icon-btn ovk-sidebar-close" type="button" data-ovk-sidebar-close aria-label="Close">${icon('close')}</button></div>`
            + (f ? `<form class="ovk-sidebar-find" role="search" method="get" action="${esc(url(f.action || '?'))}"><label class="ovk-sr" for="${esc(id)}-q">${esc(f.label || 'Search')}</label>`
                + `${icon('search')}<input id="${esc(id)}-q" name="${esc(f.name || 'q')}" placeholder="${esc(f.placeholder || 'Search')}" autocomplete="off"></form>` : '')
            + (nav && nav.length ? `<nav class="ovk-sidebar-nav" aria-label="${esc(label)}">${nav.map(link).join('')}</nav>` : '')
            + (secs ? `<div class="ovk-sidebar-secs">${secs}</div>` : '')
            + (foot ? `<div class="ovk-sidebar-foot">${foot}</div>` : '')
            + '</aside>';
    }
    const sidebarButton = ({ id = 'ovk-sidebar', label = 'Menu' } = {}) => `<button class="ovk-icon-btn ovk-sidebar-open" type="button" data-ovk-sidebar-open aria-controls="${esc(id)}" aria-expanded="false" aria-label="${esc(label)}" title="${esc(label)}">${icon('sidebar')}</button>`;
    const withSidebar = ({ sidebar: sb = '', body = '' } = {}) => `<div class="ovk-with-sidebar">${sb}<div class="ovk-sidebar-scrim" data-ovk-sidebar-scrim hidden></div><div class="ovk-with-sidebar-main">${body}</div></div>`;

    /**
     * Tabs as links (?tab=key, or ?<param>=key): the server builds only the open one, so a long page becomes a few short
     * ones and nothing needs JavaScript. items: [{ key, label, count, icon, href }].
     */
    function tabs({ base = '', items = [], active = '', param = 'tab', label = 'Sections' } = {}) {
        if (!items || items.length < 2) return '';
        const sep = String(base).includes('?') ? '&' : '?';
        return `<nav class="ovk-tabs" aria-label="${esc(label)}">${items.map((t) => `<a href="${esc(url(t.href || `${base}${sep}${param}=${encodeURIComponent(t.key)}`))}"${t.key === active ? ' aria-current="page"' : ''}>${t.icon ? icon(t.icon) : ''}<span>${esc(t.label)}</span>${t.count != null && t.count !== '' ? `<span class="ovk-tab-n">${esc(t.count)}</span>` : ''}</a>`).join('')}</nav>`;
    }
    /** The open tab from a query object: its value when it is one of keys, else the first key. */
    function tabOf(query, keys, param = 'tab') {
        const v = query && query[param] != null ? String(query[param]) : '';
        return keys.includes(v) ? v : keys[0];
    }

    // ── Lists and rows ──
    /** A list of rows (kit.row), in one rounded panel; title: a small heading above it. */
    function list(rows = [], { title = '', more = null, flush = false, empty = '' } = {}) {
        const headHtml = title ? `<div class="ovk-list-head"><h2>${esc(title)}</h2>${more ? `<a href="${esc(url(more.href))}">${esc(more.label || 'All')}</a>` : ''}</div>` : '';
        if (!rows.length) return empty ? `${headHtml}<p class="ovk-empty-line">${esc(empty)}</p>` : '';
        return `${headHtml}<ul class="ovk-list${flush ? ' ovk-list--flush' : ''}">${rows.join('')}</ul>`;
    }
    /**
     * One row: its mark, the title (with a badge) and the time on one line, one muted line under it, a trailing control.
     * href makes the whole row a link; without it the row is static and trail can hold its own forms. rel: the link's
     * rel ('nofollow ugc' for links people posted, 'noopener' off-site).
     */
    function row({ href = null, rel = '', mark: markHtml = '', title = '', titleHtml = null, badge: badgeHtml = '', meta = '', metaIso = '', sub = '', subHtml = null, trail = '', unread = 0, attrs: extra = null } = {}) {
        const top = `<span class="ovk-row-top"><strong>${titleHtml != null ? titleHtml : esc(title)}</strong>${badgeHtml || ''}${meta ? (metaIso ? `<time datetime="${esc(metaIso)}">${esc(meta)}</time>` : `<span class="ovk-row-meta">${esc(meta)}</span>`) : ''}</span>`;
        const subLine = subHtml != null || sub || unread ? `<span class="ovk-row-sub"><span>${subHtml != null ? subHtml : esc(sub)}</span>${dot(unread)}</span>` : '';
        const main = `${markHtml || ''}<span class="ovk-row-main">${top}${subLine}</span>`;
        const cls = `ovk-row${unread ? ' ovk-row--unread' : ''}`;
        if (href != null) return `<li class="${cls}"${attrs(extra)}><a href="${esc(url(href))}"${rel ? ` rel="${esc(rel)}"` : ''}>${main}${trail ? `<span class="ovk-row-trail">${trail}</span>` : ''}</a></li>`;
        return `<li class="${cls} ovk-row--static"${attrs(extra)}>${main}${trail ? `<span class="ovk-row-trail">${trail}</span>` : ''}</li>`;
    }

    // ── Cards, sections, folds ──
    /** A card with a small heading (settings groups, a page's parts): body is markup; note: one muted line under the title. */
    function section({ title = '', count = null, note = '', body = '', id = null, cls = '' } = {}) {
        const hid = id ? `${id}-h` : null;
        return `<section class="ovk-section${cls ? ` ${esc(cls)}` : ''}"${id ? ` id="${esc(id)}"` : ''}${hid && title ? ` aria-labelledby="${esc(hid)}"` : ''}>`
            + (title ? `<h2${hid ? ` id="${esc(hid)}"` : ''}>${esc(title)}${count != null ? `<span class="ovk-count">${esc(count)}</span>` : ''}</h2>` : '')
            + (note ? `<p class="ovk-note">${esc(note)}</p>` : '') + body + '</section>';
    }
    /** A card that opens and closes (setup, extras, the danger zone): closed unless open; meta: a muted word after the title. */
    function fold({ id = null, title = '', meta = '', open = false, body = '', icon: ic = 'chevron', tone = '' } = {}) {
        return `<details class="ovk-fold${tone ? ` ovk-fold--${esc(tone)}` : ''}"${id ? ` id="${esc(id)}"` : ''}${open ? ' open' : ''}><summary><span>${esc(title)}${meta ? ` <span class="ovk-muted">· ${esc(meta)}</span>` : ''}</span>${icon(ic)}</summary><div class="ovk-fold-body">${body}</div></details>`;
    }
    /** A "more" menu: an icon that opens a small panel of links and one-button forms. items: [{ href | action, label, icon, danger, hidden }]. */
    function more({ label = 'More', items = [], icon: ic = 'more' } = {}) {
        const item = (it) => {
            const inner = `${it.icon ? icon(it.icon) : ''}<span>${esc(it.label)}</span>`;
            const cls = `ovk-pop-item${it.danger ? ' ovk-pop-item--danger' : ''}`;
            if (it.action) return `<form method="post" action="${esc(url(it.action))}"${it.confirm ? ` data-ovk-confirm="${esc(it.confirm)}"` : ''}>${Object.keys(it.hidden || {}).map((k) => `<input type="hidden" name="${esc(k)}" value="${esc(it.hidden[k])}">`).join('')}<button type="submit" class="${cls}" role="menuitem">${inner}</button></form>`;
            if (it.share) return `<a class="${cls}" role="menuitem" href="${esc(url(it.href))}" data-ovk-share="${esc(it.title || '')}">${inner}</a>`;
            return `<a class="${cls}" role="menuitem" href="${esc(url(it.href))}">${inner}</a>`;
        };
        return `<details class="ovk-more"><summary class="ovk-icon-btn" aria-label="${esc(label)}" title="${esc(label)}">${icon(ic)}</summary><div class="ovk-pop" role="menu">${items.filter(Boolean).map(item).join('')}</div></details>`;
    }

    // ── Settings rows ──
    /** A switch row: what it does (one muted hint line when needed) on the left, the switch on the right. */
    const switchRow = ({ name, label, hint = '', on = false, value = '1' }) => `<label class="ovk-set-row"><span class="ovk-set-text">${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ''}</span><input type="checkbox" class="ovk-switch" name="${esc(name)}" value="${esc(value)}"${on ? ' checked' : ''}></label>`;
    /** A slider row (0-100 by 5 unless told otherwise); the value is spoken as a percent when unit is '%'. */
    function rangeRow({ name, label, value = 0, min = 0, max = 100, step = 5, unit = '%' }) {
        const v = Number(value);
        return `<label class="ovk-set-row ovk-set-range"><span class="ovk-set-text">${esc(label)}</span><input type="range" name="${esc(name)}" min="${Number(min)}" max="${Number(max)}" step="${Number(step)}" value="${Number.isFinite(v) ? v : Number(min)}" data-ovk-unit="${esc(unit)}" aria-valuetext="${Number.isFinite(v) ? v : Number(min)}${unit === '%' ? ' percent' : ` ${esc(unit)}`}"></label>`;
    }
    /** A choice row: the label on the left, a select on the right. options: [[value, label], …]. */
    const selectRow = ({ name, label, hint = '', options = [], value = '' }) => `<label class="ovk-set-row"><span class="ovk-set-text">${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ''}</span><select name="${esc(name)}">${options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
    /** A segmented choice (2-4 options) as radios that look like one control. */
    function seg({ name, options = [], value = '', label = '' }) {
        const id = `ovk-seg-${esc(name)}`;
        return `<div class="ovk-set-row"><span class="ovk-set-text" id="${id}">${esc(label)}</span><span class="ovk-seg" role="radiogroup" aria-labelledby="${id}">${options.map(([v, l]) => `<label><input type="radio" name="${esc(name)}" value="${esc(v)}"${String(v) === String(value) ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</span></div>`;
    }
    /** Chips: checkboxes (or radios: single) that look like small pills, for filters and "which of these". options: [[value, label, checked]]. */
    function chips({ name, options = [], single = false, label = '' }) {
        const box = options.map(([v, l, on]) => `<label class="ovk-chip"><input type="${single ? 'radio' : 'checkbox'}" name="${esc(single ? name : `${name}_${v}`)}" value="${esc(single ? v : '1')}"${on ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('');
        return label ? `<div class="ovk-set-row ovk-set-chips"><span class="ovk-set-text">${esc(label)}</span><span class="ovk-chips">${box}</span></div>` : `<span class="ovk-chips">${box}</span>`;
    }
    /** A form's last line that stays in reach (sticky above the dock/app bar on phones). */
    const saveBar = ({ label = 'Save', name = null, value = null } = {}) => `<p class="ovk-save">${button({ label, name, value })}</p>`;

    // ── Search, add, compose ──
    /**
     * A one-line form in a pill: an icon, the input, optional extra controls (a select), and a round icon button. For
     * search (method get) and for "add by name" (post). hidden: { name: value } fields.
     */
    function find({ action: to = '', method = 'get', name = 'q', placeholder = '', value = '', label = '', icon: ic = 'search', type = 'search', required = false, pattern = null, maxlength = null, extra = '', hidden = {}, button: btn = null, inset = false, id = null } = {}) {
        const fid = id || `ovk-find-${esc(name)}`;
        const b = btn || { icon: method === 'get' ? 'forward' : 'plus', label: method === 'get' ? 'Search' : 'Add' };
        return `<form class="ovk-find${inset ? ' ovk-find--inset' : ''}" method="${method === 'post' ? 'post' : 'get'}" action="${esc(url(to || '?'))}"${method === 'get' ? ' role="search"' : ''}>`
            + Object.keys(hidden || {}).map((k) => `<input type="hidden" name="${esc(k)}" value="${esc(hidden[k])}">`).join('')
            + `${ic ? icon(ic) : ''}<label for="${fid}" class="ovk-sr">${esc(label || placeholder)}</label><input id="${fid}" name="${esc(name)}" type="${type === 'text' ? 'text' : 'search'}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off"${required ? ' required' : ''}${pattern ? ` pattern="${esc(pattern)}"` : ''}${maxlength ? ` maxlength="${Number(maxlength)}"` : ''}>`
            + `${extra || ''}<button type="submit" class="ovk-go" aria-label="${esc(b.label)}" title="${esc(b.label)}">${icon(b.icon)}</button></form>`;
    }
    /**
     * The composer pinned at the bottom of a conversation (above the app bar on phones): a one-line box that grows, Enter
     * sends (Shift+Enter: a new line; kit.enhance), a round send button. before: controls left of the box (attach).
     */
    function dock({ action: to = '', name = 'message', placeholder = 'Write a message', label = 'Message', maxlength = 2000, id = 'ovk-dock', before = '', hidden = {}, send = 'Send', value = '' } = {}) {
        return `<div class="ovk-dock">${before || ''}<form class="ovk-compose" method="post" action="${esc(url(to))}" id="${esc(id)}">`
            + Object.keys(hidden || {}).map((k) => `<input type="hidden" name="${esc(k)}" value="${esc(hidden[k])}">`).join('')
            + `<label for="${esc(id)}-input" class="ovk-sr">${esc(label)}</label><textarea id="${esc(id)}-input" name="${esc(name)}" rows="1" maxlength="${Number(maxlength) || 2000}" required placeholder="${esc(placeholder)}" data-ovk-enter>${esc(value)}</textarea>`
            + `<button type="submit" class="ovk-go ovk-go--send" aria-label="${esc(send)}" title="${esc(send)}">${icon('send')}</button></form></div>`;
    }

    // ── Numbers, empty, notices, code ──
    /** A strip of numbers: [[value, label], …] (zero and unknown values left out); scrolls sideways on phones. */
    function stats(items = [], { label = 'In numbers' } = {}) {
        const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('en-US') : String(v));
        const shown = items.filter((x) => x && x[0] != null && x[0] !== '' && x[0] !== 0);
        if (!shown.length) return '';
        return `<dl class="ovk-stats" aria-label="${esc(label)}">${shown.map(([v, l, href]) => `<div${href ? ' class="ovk-stat--link"' : ''}><dt>${href ? `<a href="${esc(url(href))}">${esc(l)}</a>` : esc(l)}</dt><dd>${esc(fmt(v))}</dd></div>`).join('')}</dl>`;
    }
    /** What an empty list says: a title, one line, and the one thing to do next. */
    const empty = ({ title = '', text = '', action: act = null, icon: ic = '' } = {}) => `<div class="ovk-empty">${ic ? icon(ic) : ''}${title ? `<p class="ovk-empty-title">${esc(title)}</p>` : ''}${text ? `<p>${esc(text)}</p>` : ''}${act ? button({ href: act.href, label: act.label, kind: act.kind || 'primary', icon: act.icon || '' }) : ''}</div>`;
    /** A notice in the page: kind 'ok' | 'error' | 'info' | 'warn'; errors are announced (role=alert). */
    const notice = ({ kind = 'info', text = '', html = null } = {}) => `<p class="ovk-notice ovk-notice--${esc(kind)}" role="${kind === 'error' ? 'alert' : 'status'}">${icon(kind === 'ok' ? 'check' : kind === 'error' || kind === 'warn' ? 'alert' : 'info')}<span>${html != null ? html : esc(text)}</span></p>`;
    /** A block of code people copy: the copy button in its corner (shown by kit.enhance), never taller than half a screen. */
    function snippet({ code = '', id = null, label = 'Copy' } = {}) {
        const sid = id || `ovk-snip-${hueOf(code)}-${String(code).length}`;
        return `<div class="ovk-snip"><button type="button" class="ovk-icon-btn" data-ovk-copy="#${esc(sid)}" aria-label="${esc(label)}" title="${esc(label)}" hidden>${icon('copy')}</button><pre tabindex="0" id="${esc(sid)}"><code>${esc(code)}</code></pre></div>`;
    }
    /** A bottom sheet on phones, a dialog on computers: kit.sheetButton opens it (without JavaScript the sheet is a fold). */
    const sheet = ({ id, title = '', body = '' }) => `<dialog class="ovk-sheet" id="${esc(id)}" aria-labelledby="${esc(id)}-t"><div class="ovk-sheet-head"><h2 id="${esc(id)}-t">${esc(title)}</h2><button type="button" class="ovk-icon-btn" data-ovk-close aria-label="Close" title="Close">${icon('close')}</button></div><div class="ovk-sheet-body">${body}</div></dialog>`;
    const sheetButton = ({ sheet: sid, label = '', icon: ic = 'filter', iconOnly = true }) => (iconOnly
        ? `<button type="button" class="ovk-icon-btn" data-ovk-sheet="#${esc(sid)}" aria-label="${esc(label)}" title="${esc(label)}">${icon(ic)}</button>`
        : `<button type="button" class="ovk-btn ovk-btn--quiet ovk-btn--small" data-ovk-sheet="#${esc(sid)}">${icon(ic)}<span>${esc(label)}</span></button>`);

    // ── In the browser: the behaviour lives in kit-web.js (a server-rendered site loads only that); a page that draws
    // markup with these builders loads both and calls enhance() on what it added. A no-op on the server.
    const enhance = (rootEl) => (root.OpenVibeKitWeb ? root.OpenVibeKitWeb.enhance(rootEl) : undefined);

    // ── Cards and rails (plan 2026-10-28 §3.4): one card for every kind of thing, in rows that snap ──
    // The media's shape by what the card shows; `ratio` overrides it.
    const CARD_RATIO = {
        stream: '16/9', clip: '16/9', vod: '16/9', video: '16/9', run: '16/9', map: '16/9', cam: '16/9', tour: '16/9', trip: '16/9',
        event: '16/9', brief: '16/9', post: '16/9', meme: '1/1', shoe: '1/1', listing: '1/1', deal: '1/1', person: '1/1',
        toy: '4/3', game: '4/3', simulator: '4/3', report: '4/3', dashboard: '4/3', theme: '4/3', kit: '4/3', benchmark: '4/3', site: '4/3', domain: '2/1',
    };
    // What a card without a picture draws in its media, by type.
    const CARD_ICON = { stream: 'live', clip: 'play', vod: 'play', video: 'play', run: 'wave', map: 'map', cam: 'video', tour: 'map', trip: 'map',
        event: 'calendar', brief: 'calendar', post: 'file', meme: 'image', shoe: 'shoe', listing: 'tag', deal: 'tag', person: 'user', toy: 'spark',
        game: 'game', simulator: 'game', report: 'chart', dashboard: 'chart', theme: 'palette', kit: 'palette', benchmark: 'chart', site: 'computer', domain: 'globe' };
    const media = (u) => /^(https:\/\/|\/(?!\/))/.test(String(u || '').trim());
    const fmtCount = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0).replace(/\.0$/, '')}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n));
    /**
     * card({ href, title, type, ratio, image, alt, video, badge, live, corner, peek, who, avatar, count: [n, 'watching'],
     *        when, level, save, remind, share, more: [items] }) — one thing, the same anatomy everywhere:
     *  - media in the type's shape, a badge top-left (a word: NEW, −24 %, WR; live: true draws LIVE with a pulse) and a
     *    corner bottom-right (a length or a price); peek: one line over the media on hover or focus; video: a muted
     *    loop played while it is hovered (computers only, never under reduced motion, loaded only then)
     *  - the title (two lines at most); sub: one plain muted line under it (a city, a kind, a language); then who (with
     *    their picture or letters), one count and when; a count of 0 or none is left out, never shown as 0. whoHtml: the
     *    name as markup the caller escaped (a name with its decorations); who stays the plain name for the letters
     *  - preview: for a thing without a picture whose text is the point (a code paste, a note), its first lines drawn in
     *    the media instead of the type's icon
     *  - ⋯ with Save and Remind when given ({ href } or { action, hidden }), Share (always: the system share sheet, else
     *    the link copied) and any `more` items (kit.more's)
     * The card is one link, the title's, stretched over it; ⋯ sits above it. level: the title's heading level (3).
     */
    function card({ href = '#', title = '', type = '', ratio = '', image = '', alt = '', video = '', badge: bd = '', live = false, corner = '',
        peek = '', who = '', whoHtml = null, avatar = '', count = null, when: at = null, level = 3, save = null, remind = null, share = true,
        more: extra = null, sub = '', preview = '' } = {}) {
        const ar = /^\d{1,2}\/\d{1,2}$/.test(String(ratio)) ? ratio : CARD_RATIO[type] || '16/9';
        const link = url(href);
        const first = String(preview || '').split('\n').slice(0, 9).join('\n').slice(0, 480).trimEnd();
        const pic = media(image)
            ? `<img src="${esc(image)}" alt="${esc(alt)}" loading="lazy" decoding="async">`
            : first ? `<pre class="ovk-card-pre" aria-hidden="true">${esc(first)}</pre>`
                : `<span class="ovk-card-noimg">${icon(CARD_ICON[type] || 'image')}</span>`;
        const loop = media(video) ? `<video class="ovk-card-video" data-src="${esc(video)}" muted loop playsinline preload="none" aria-hidden="true" tabindex="-1"></video>` : '';
        const tag = live ? '<span class="ovk-card-badge is-live">LIVE</span>' : bd ? `<span class="ovk-card-badge">${esc(bd)}</span>` : '';
        const n = Array.isArray(count) ? Number(count[0]) : Number(count);
        const counted = Number.isFinite(n) && n > 0 ? `<span>${esc(fmtCount(n))}${Array.isArray(count) && count[1] ? ` ${esc(count[1])}` : ''}</span>` : '';
        const t = at != null && at !== '' ? when(at) : null;
        const meta = [whoHtml != null && whoHtml !== '' ? `<span class="ovk-card-who">${whoHtml}</span>` : who ? `<span class="ovk-card-who">${esc(who)}</span>` : '', counted, t && t.text ? `<time datetime="${esc(t.iso)}">${esc(t.text)}</time>` : ''].filter(Boolean).join('');
        const items = [
            save ? { label: 'Save', icon: 'star', ...save } : null,
            remind ? { label: 'Remind me', icon: 'bell', ...remind } : null,
            share ? { label: 'Share', icon: 'open', href: link, share: true, title } : null,
        ].concat(extra || []).filter(Boolean);
        const h = Math.min(6, Math.max(2, Number(level) || 3));
        return `<article class="ovk-card${live ? ' is-live' : ''}${type ? ` ovk-card--${esc(type)}` : ''}" style="--ovk-ar:${ar}">`
            + `<div class="ovk-card-media">${pic}${loop}${tag}${corner ? `<span class="ovk-card-corner">${esc(corner)}</span>` : ''}${peek ? `<span class="ovk-card-peek">${esc(peek)}</span>` : ''}</div>`
            + `<div class="ovk-card-body">${who || avatar ? mark({ name: who || title, src: avatar, size: 34 }) : ''}<div class="ovk-card-text">`
            + `<h${h} class="ovk-card-title"><a class="ovk-card-link" href="${esc(link)}">${esc(title)}</a></h${h}>${sub ? `<p class="ovk-card-sub">${esc(sub)}</p>` : ''}${meta ? `<p class="ovk-card-meta">${meta}</p>` : ''}</div>`
            + `${items.length ? more({ label: `More: ${title}`, items }) : ''}</div></article>`;
    }
    /**
     * rail({ id, title, more: { href, label }, items: [card html], size: 's'|'m'|'l', label }) — a row that scrolls
     * sideways and snaps: about 1.2 cards on a phone, as many as fit on a computer, with ‹ › buttons there (kit.enhance).
     * size: 's' square things (memes, shoes, deals), 'm' (default) pictures 16:9, 'l' wide features. wrap: from 760 px
     * the row becomes a grid that shows every item (no arrows, no kit-web.js needed); phones still swipe. Empty → ''.
     */
    function rail({ id = '', title = '', more: m = null, items = [], size = 'm', label = '', wrap = false } = {}) {
        const list = (items || []).filter(Boolean);
        if (!list.length) return '';
        const hid = id ? `${String(id).replace(/[^a-z0-9_-]/gi, '')}-h` : '';
        const head = title || m ? `<div class="ovk-rail-head">${title ? `<h2${hid ? ` id="${hid}"` : ''}>${esc(title)}</h2>` : ''}${m && m.href ? `<a class="ovk-rail-more" href="${esc(url(m.href))}">${esc(m.label || 'See all')}${icon('chevron')}</a>` : ''}</div>` : '';
        const named = hid && title ? ` aria-labelledby="${hid}"` : ` aria-label="${esc(label || title || 'More')}"`;
        return `<section class="ovk-rail ovk-rail--${size === 's' || size === 'l' ? size : 'm'}${wrap ? ' ovk-rail--wrap' : ''}"${id ? ` id="${esc(id)}"` : ''}${named}>${head}`
            + `<div class="ovk-rail-wrap"><ul class="ovk-rail-track" role="list">${list.map((x) => `<li>${x}</li>`).join('')}</ul>`
            + `<button type="button" class="ovk-rail-btn ovk-rail-prev" aria-label="Scroll back" hidden>${icon('back')}</button>`
            + `<button type="button" class="ovk-rail-btn ovk-rail-next" aria-label="Scroll on" hidden>${icon('forward')}</button></div></section>`;
    }

    // ── Kit 2 (4.36.0): the pieces data and tool pages need — steps, tables, charts, rankings, a drop zone, a result
    // with its receipt, a meter, and the page's whole shape in one call. Same rules: plain HTML that works without
    // JavaScript, escaped text, theme tokens, phone first (docs/kit.md "Kit 2").

    /** A number the way a reader wants it: fmt 'int' | 'compact' | 'money' | 'percent' (0–100) | 'ms' | 'auto'. */
    function num(v, fmt = 'auto') {
        const n = Number(v);
        if (v == null || v === '' || !Number.isFinite(n)) return '–';
        if (typeof fmt === 'function') return String(fmt(n));
        if (fmt === 'compact') return fmtCount(Math.round(n));
        if (fmt === 'int') return Math.round(n).toLocaleString('en-US');
        if (fmt === 'percent') return `${Math.abs(n) < 10 && n % 1 ? n.toFixed(1) : Math.round(n)}%`;
        if (fmt === 'ms') return n < 1000 ? `${Math.round(n)} ms` : `${(n / 1000).toFixed(n < 1e4 ? 1 : 0)} s`;
        if (fmt === 'money') {
            // Exact enough to compare: cents from ten cents up ($0.10, $12.50), two significant figures below ($0.027, $0.0041).
            const a = Math.abs(n);
            const s = a === 0 ? '0.00' : a >= 0.1 ? a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(Number(a.toPrecision(2)));
            return `${n < 0 ? '−' : ''}$${s}`;
        }
        return n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) < 10 ? 2 : Math.abs(n) < 100 ? 1 : 0 });
    }

    /**
     * steps({ items: [{ label, href, note }], current: index, label }) — where someone is in a flow of a few steps.
     * Done steps link back (when they have an href), the current one says aria-current="step", later ones are plain.
     * A phone shows the dots and "Step 2 of 4 · Verify"; a tablet or computer shows every label.
     */
    function steps({ items = [], current = 0, label = 'Steps' } = {}) {
        const list = (items || []).filter(Boolean);
        if (!list.length) return '';
        const at = Math.min(Math.max(0, Number(current) || 0), list.length - 1);
        const li = list.map((s, i) => {
            const state = i < at ? 'is-done' : i === at ? 'is-current' : 'is-next';
            const inner = `<span class="ovk-steps-n" aria-hidden="true">${i < at ? icon('check') : i + 1}</span><span class="ovk-steps-l">${esc(s.label)}${s.note ? `<small>${esc(s.note)}</small>` : ''}</span>`;
            const sr = i < at ? '<span class="ovk-sr"> (done)</span>' : '';
            return `<li class="${state}"${i === at ? ' aria-current="step"' : ''}>${i < at && s.href ? `<a href="${esc(url(s.href))}">${inner}${sr}</a>` : `<span class="ovk-steps-item">${inner}${sr}</span>`}</li>`;
        }).join('');
        return `<nav class="ovk-steps" aria-label="${esc(label)}" style="--ovk-steps:${list.length}"><p class="ovk-steps-now"><span>Step ${at + 1} of ${list.length}</span> <strong>${esc(list[at].label)}</strong></p><ol>${li}</ol></nav>`;
    }

    /**
     * table({ columns: [{ key, label, num, fmt, primary, hide: 'sm', html }], rows: [{…}], caption, label, empty, stack })
     * A real table on wide screens. Under 600 px each row becomes a card (stack, the default): the primary column is its
     * title and every other cell says its column's name. A cell is text (escaped), { text, href } (a link), or trusted
     * markup when its column says html: true. num: right-aligned, tabular figures, formatted with fmt (kit.num).
     */
    function table({ columns = [], rows = [], caption = '', label = '', empty: none = '', stack = true, id = null } = {}) {
        const cols = (columns || []).filter((c) => c && c.key != null);
        if (!rows || !rows.length) return none ? `<p class="ovk-table-empty">${esc(none)}</p>` : '';
        const primary = cols.find((c) => c.primary) || cols[0];
        const cell = (c, v) => {
            if (c.html) return v == null ? '' : String(v);
            if (v && typeof v === 'object' && v.href) return `<a href="${esc(url(v.href))}">${esc(v.text != null ? v.text : v.href)}</a>`;
            if (c.num) return esc(num(v, c.fmt || 'auto'));
            return esc(v == null ? '' : v);
        };
        const cls = (c) => [c.num ? 'is-num' : '', c === primary ? 'is-primary' : '', c.hide === 'sm' ? 'is-hide-sm' : ''].filter(Boolean).join(' ');
        const head = `<thead><tr>${cols.map((c) => `<th scope="col"${cls(c) ? ` class="${cls(c)}"` : ''}>${esc(c.label)}</th>`).join('')}</tr></thead>`;
        const body = `<tbody>${rows.map((r) => `<tr>${cols.map((c) => {
            const tag = c === primary ? 'th scope="row"' : 'td';
            return `<${tag}${cls(c) ? ` class="${cls(c)}"` : ''} data-label="${esc(c.label)}">${cell(c, r[c.key])}</${tag.split(' ')[0]}>`;
        }).join('')}</tr>`).join('')}</tbody>`;
        const named = caption ? '' : ` aria-label="${esc(label || 'Table')}"`;
        return `<div class="ovk-table-wrap${stack ? ' ovk-table--stack' : ''}" role="region" tabindex="0"${named}${id ? ` id="${esc(id)}"` : ''}><table class="ovk-table">${caption ? `<caption>${esc(caption)}</caption>` : ''}${head}${body}</table></div>`;
    }

    /** Three to six round ticks between lo and hi (1, 2, 5 × 10ⁿ). */
    function niceTicks(lo, hi, count = 4) {
        if (!(hi > lo)) { hi = lo === 0 ? 1 : lo + Math.abs(lo) * 0.1; }
        const raw = (hi - lo) / count;
        const mag = Math.pow(10, Math.floor(Math.log10(raw)));
        const f = raw / mag;
        const step = (f >= 7 ? 10 : f >= 3 ? 5 : f >= 1.5 ? 2 : 1) * mag;
        const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step;
        const ticks = [];
        for (let v = a; v <= b + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
        return { lo: a, hi: b, ticks };
    }
    const HOUR = 3600000;
    const toMs = (x) => (x instanceof Date ? x.getTime() : typeof x === 'number' ? x : Date.parse(String(x)));
    /** Ticks on a time axis at round moments (hours, days, weeks, months), with labels that say only what changes. */
    function timeTicks(lo, hi) {
        const span = hi - lo;
        const steps = [HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 7 * DAY, 14 * DAY];
        const out = [];
        const d2 = (n) => String(n).padStart(2, '0');
        if (span <= 70 * DAY) {
            const step = steps.find((s) => span / s <= 5) || 14 * DAY;
            const day = step >= DAY;
            for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) {
                const d = new Date(t);
                out.push([t, day ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}` : `${d2(d.getUTCHours())}:00`]);
            }
            return out;
        }
        const months = span <= 200 * DAY ? 1 : span <= 400 * DAY ? 3 : span <= 800 * DAY ? 6 : 12;
        const s = new Date(lo);
        let y = s.getUTCFullYear(), m = Math.ceil((s.getUTCMonth() + (s.getUTCDate() > 1 ? 1 : 0)) / months) * months;
        for (;;) {
            while (m >= 12) { m -= 12; y += 1; }
            const t = Date.UTC(y, m, 1);
            if (t > hi) break;
            out.push([t, m === 0 || months === 12 ? `${MONTHS[m]} ${y}` : MONTHS[m]]);
            m += months;
        }
        return out;
    }
    const pct = (v) => `${(Math.round(v * 100) / 100)}%`;

    /**
     * chart({ type: 'line' | 'area' | 'bar' | 'scatter', series, points, x: { time, label, fmt }, y: { label, fmt, zero },
     *         title, note, height, label })
     *  - line/area: series: [{ name, points: [[x, y], …] }] (y null = a gap). x.time: x is a time (ms, ISO or Date).
     *  - bar: series: [{ name, points: [[label or time, value], …] }], one bar per point (counts per day, per kind).
     *  - scatter: points: [{ x, y, label, href, mark: true }] — every point is focusable and says its values; mark:
     *    true writes its label beside it. frontier: true draws the line through the points marked best.
     * The picture is an SVG stretched to the box (strokes keep their width); every word and number is real text at its
     * real size, so a phone reads it as well as a computer. A table with the same numbers is there for screen readers;
     * kit-web.js adds the hover and arrow-key readout on lines and areas.
     */
    function chart({ type = 'line', series = [], points = [], x: xo = {}, y: yo = {}, title = '', note = '', height = 220, label = '', id = null } = {}) {
        const kind = ['line', 'area', 'bar', 'scatter'].includes(type) ? type : 'line';
        const isTime = !!xo.time;
        const fx = (v) => (isTime ? (() => { const d = new Date(toMs(v)); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}${xo.hours ? ` ${String(d.getUTCHours()).padStart(2, '0')}:00` : ''}`; })() : xo.fmt ? num(v, xo.fmt) : String(v));
        const fy = (v) => num(v, yo.fmt || 'auto');
        const name = title || label || 'Chart';
        let plot = '', table = '', legend = '', data = null, yl = [];

        if (kind === 'scatter') {
            const ps = (points || []).filter((p) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)));
            if (!ps.length) return '';
            const xs = niceTicks(Math.min(...ps.map((p) => +p.x)) * (xo.zero === false ? 1 : 0), Math.max(...ps.map((p) => +p.x)));
            const ys = niceTicks(yo.zero === false ? Math.min(...ps.map((p) => +p.y)) : Math.min(0, ...ps.map((p) => +p.y)), Math.max(...ps.map((p) => +p.y)));
            const X = (v) => ((v - xs.lo) / (xs.hi - xs.lo)) * 100, Y = (v) => ((v - ys.lo) / (ys.hi - ys.lo)) * 100;
            const best = ps.filter((p) => p.best).sort((a, b) => a.x - b.x);
            const line = best.length > 1 ? `<svg class="ovk-chart-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="ovk-chart-front" d="M${best.map((p) => `${(X(p.x) * 10).toFixed(1)},${(1000 - Y(p.y) * 10).toFixed(1)}`).join('L')}"/></svg>` : '';
            const dots = ps.map((p) => {
                const say = `${p.label ? `${p.label}: ` : ''}${yo.label || 'y'} ${fy(p.y)}, ${xo.label || 'x'} ${fx(p.x)}`;
                const tag = p.href ? `a href="${esc(url(p.href))}"` : 'span tabindex="0"';
                const right = X(+p.x) > 70;
                return `<${tag} class="ovk-chart-dot${p.best ? ' is-best' : ''}${right ? ' is-right' : ''}" style="left:${pct(X(+p.x))};bottom:${pct(Y(+p.y))}" aria-label="${esc(say)}">`
                    + `${p.mark && p.label ? `<span class="ovk-chart-name" aria-hidden="true">${esc(p.label)}</span>` : ''}<span class="ovk-chart-pop" aria-hidden="true"><b>${esc(p.label || '')}</b>${esc(fy(p.y))} · ${esc(fx(p.x))}</span></${tag.split(' ')[0]}>`;
            }).join('');
            yl = ys.ticks.map(fy);
            plot = axes(xs.ticks.map((t) => [X(t), fx(t)]), ys.ticks.map((t) => [Y(t), fy(t)])) + line + dots;
            table = `<thead><tr><th scope="col">${esc(xo.label ? 'Name' : '')}</th><th scope="col">${esc(xo.label || 'x')}</th><th scope="col">${esc(yo.label || 'y')}</th></tr></thead><tbody>${ps.map((p) => `<tr><th scope="row">${esc(p.label || '')}</th><td>${esc(fx(p.x))}</td><td>${esc(fy(p.y))}</td></tr>`).join('')}</tbody>`;
        } else {
            const ss = (series || []).filter((s) => s && Array.isArray(s.points) && s.points.length);
            if (!ss.length) return '';
            if (kind === 'bar') {
                const s = ss[0];
                const val = (p) => (p[1] == null || p[1] === '' ? NaN : Number(p[1]));   // missing is not 0
                const vals = s.points.map(val).filter(Number.isFinite);
                const ys = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals));
                const Y = (v) => ((v - ys.lo) / (ys.hi - ys.lo)) * 100;
                const every = Math.max(1, Math.ceil(s.points.length / 6));
                const bars = s.points.map((p, i) => {
                    const v = val(p);
                    const lab = isTime ? fx(p[0]) : String(p[0]);
                    return `<span class="ovk-chart-bar${Number.isFinite(v) ? '' : ' is-none'}" tabindex="0" style="--h:${pct(Number.isFinite(v) ? Y(v) - Y(Math.max(0, ys.lo)) : 0)}" aria-label="${esc(`${lab}: ${fy(v)}`)}"><span class="ovk-chart-pop" aria-hidden="true"><b>${esc(lab)}</b>${esc(fy(v))}</span>${i % every === 0 ? `<span class="ovk-chart-blab" aria-hidden="true">${esc(lab)}</span>` : ''}</span>`;
                }).join('');
                yl = ys.ticks.map(fy);
                plot = axes([], ys.ticks.map((t) => [Y(t), fy(t)])) + `<div class="ovk-chart-bars" style="--n:${s.points.length}">${bars}</div>`;
                table = `<thead><tr><th scope="col">${esc(xo.label || '')}</th><th scope="col">${esc(s.name || yo.label || '')}</th></tr></thead><tbody>${s.points.map((p) => `<tr><th scope="row">${esc(isTime ? fx(p[0]) : p[0])}</th><td>${esc(fy(p[1]))}</td></tr>`).join('')}</tbody>`;
            } else {
                const all = ss.flatMap((s) => s.points);
                const xv = all.map((p) => (isTime ? toMs(p[0]) : Number(p[0]))).filter(Number.isFinite);
                const yNum = all.map((p) => (p[1] == null ? NaN : Number(p[1]))).filter(Number.isFinite);
                if (!xv.length || !yNum.length) return '';
                const x0 = Math.min(...xv), x1 = Math.max(...xv);
                const ys = niceTicks(yo.zero === false ? Math.min(...yNum) : Math.min(0, ...yNum), Math.max(...yNum));
                const X = (v) => (x1 > x0 ? ((v - x0) / (x1 - x0)) * 100 : 50), Y = (v) => ((v - ys.lo) / (ys.hi - ys.lo)) * 100;
                const xt = isTime ? timeTicks(x0, x1).map(([t, l]) => [X(t), l]) : niceTicks(x0, x1).ticks.filter((t) => t >= x0 && t <= x1).map((t) => [X(t), fx(t)]);
                const paths = ss.map((s, i) => {
                    const pts = s.points.map((p) => [X(isTime ? toMs(p[0]) : Number(p[0])), p[1] == null ? null : Y(Number(p[1]))]);
                    let d = '', open = false;
                    for (const [px, py] of pts) { if (py == null || !Number.isFinite(py)) { open = false; continue; } d += `${open ? 'L' : 'M'}${(px * 10).toFixed(1)},${(1000 - py * 10).toFixed(1)}`; open = true; }
                    const firstX = pts.find((p) => p[1] != null), lastX = [...pts].reverse().find((p) => p[1] != null);
                    const area = kind === 'area' && firstX && lastX && !pts.some((p) => p[1] == null) ? `<path class="ovk-chart-area" d="${d}L${(lastX[0] * 10).toFixed(1)},${(1000 - Y(Math.max(ys.lo, 0)) * 10).toFixed(1)}L${(firstX[0] * 10).toFixed(1)},${(1000 - Y(Math.max(ys.lo, 0)) * 10).toFixed(1)}Z"/>` : '';
                    return `<g class="ovk-chart-s${(i % 5) + 1}">${area}<path class="ovk-chart-line" d="${d}"/></g>`;
                }).join('');
                yl = ys.ticks.map(fy);
                plot = axes(xt, ys.ticks.map((t) => [Y(t), fy(t)])) + `<svg class="ovk-chart-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">${paths}</svg>`;
                // The readout's data (kit-web.js): x positions and labels, and per series its y positions and values.
                const xsAll = [...new Set(ss[0].points.map((p) => (isTime ? toMs(p[0]) : Number(p[0]))))];
                data = { x: xsAll.map((v) => [Math.round(X(v) * 100) / 100, fx(v)]),
                    s: ss.map((s, i) => ({ n: s.name || '', c: (i % 5) + 1, v: xsAll.map((xv0) => { const p = s.points.find((q) => (isTime ? toMs(q[0]) : Number(q[0])) === xv0); return p && p[1] != null ? [Math.round(Y(Number(p[1])) * 100) / 100, fy(p[1])] : null; }) })) };
                const last = (s) => [...s.points].reverse().find((p) => p[1] != null);
                legend = `<ul class="ovk-chart-legend">${ss.map((s, i) => `<li class="ovk-chart-s${(i % 5) + 1}"><i aria-hidden="true"></i>${esc(s.name || '')}${last(s) ? ` <b>${esc(fy(last(s)[1]))}</b>` : ''}</li>`).join('')}</ul>`;
                table = `<thead><tr><th scope="col">${esc(xo.label || '')}</th>${ss.map((s) => `<th scope="col">${esc(s.name || '')}</th>`).join('')}</tr></thead><tbody>${xsAll.map((xv0) => `<tr><th scope="row">${esc(fx(xv0))}</th>${ss.map((s) => { const p = s.points.find((q) => (isTime ? toMs(q[0]) : Number(q[0])) === xv0); return `<td>${esc(p ? fy(p[1]) : '–')}</td>`; }).join('')}</tr>`).join('')}</tbody>`;
            }
        }
        // The left gutter fits the longest y label (about 7 px a character at the axis's size).
        const gutter = Math.min(72, 14 + 7 * Math.max(2, ...yl.map((t) => String(t).length)));
        const cap = title || note ? `<figcaption>${title ? `<strong>${esc(title)}</strong>` : ''}${note ? `<span>${esc(note)}</span>` : ''}</figcaption>` : '';
        const axisNames = yo.label ? `<span class="ovk-chart-yname" aria-hidden="true">${esc(yo.label)}</span>` : '';
        return `<figure class="ovk-chart ovk-chart--${kind}"${id ? ` id="${esc(id)}"` : ''} style="--ovk-chart-h:${Math.max(120, Math.min(600, Number(height) || 220))}px;--ovk-chart-g:${gutter}px">${cap}${legend}${axisNames}`
            + `<div class="ovk-chart-plot"${data ? ` tabindex="0" role="img" aria-label="${esc(name)}" data-ovk-chart="${esc(JSON.stringify(data))}"` : ` role="group" aria-label="${esc(name)}"`}>${plot}${data ? '<span class="ovk-chart-rule" hidden></span><span class="ovk-chart-tip" hidden></span>' : ''}</div>`
            + `${xo.label ? `<p class="ovk-chart-xname" aria-hidden="true">${esc(xo.label)}</p>` : ''}<div class="ovk-sr"><table><caption>${esc(name)}</caption>${table}</table></div></figure>`;
    }
    /** The grid and the tick labels: x [[pos%, text]], y [[pos%, text]] — real text, placed by percent. */
    function axes(xt, yt) {
        return yt.map(([p, t]) => `<span class="ovk-chart-grid" style="bottom:${pct(p)}" aria-hidden="true"></span><span class="ovk-chart-yt" style="bottom:${pct(p)}" aria-hidden="true">${esc(t)}</span>`).join('')
            + xt.map(([p, t]) => `<span class="ovk-chart-xt" style="left:${pct(p)}" aria-hidden="true">${esc(t)}</span>`).join('');
    }

    /**
     * rank({ items: [{ name, href, mark, value, fmt, interval, delta, note, badge }], fmt, base, label, start })
     * A leaderboard: the place, the name, the value (± its interval), the change since last time, and a bar in
     * proportion (from `base`, 0 by default — give the floor for a rating that never nears 0, e.g. an Elo).
     */
    function rank({ items = [], fmt = 'auto', base = 0, label = 'Ranking', start = 1, unit = '' } = {}) {
        const list = (items || []).filter((x) => x && x.name != null);
        if (!list.length) return '';
        const top = Math.max(...list.map((x) => Number(x.value)).filter(Number.isFinite), base + 1e-9);
        return `<ol class="ovk-rank" aria-label="${esc(label)}" start="${Number(start) || 1}">${list.map((x, i) => {
            const v = Number(x.value);
            const share = Number.isFinite(v) ? Math.max(0, Math.min(1, (v - base) / (top - base))) : 0;
            const d = Number(x.delta);
            const delta = Number.isFinite(d) && d !== 0 ? `<span class="ovk-rank-delta ${d > 0 ? 'is-up' : 'is-down'}" aria-label="${d > 0 ? 'up' : 'down'} ${Math.abs(d)}">${icon(d > 0 ? 'up' : 'down')}${Math.abs(d)}</span>` : x.delta === 'new' ? '<span class="ovk-rank-delta is-new">new</span>' : '';
            const nameHtml = x.href ? `<a class="ovk-rank-link" href="${esc(url(x.href))}">${esc(x.name)}</a>` : `<strong>${esc(x.name)}</strong>`;
            return `<li class="ovk-rank-row${i < 3 && start === 1 ? ' is-top' : ''}"><span class="ovk-rank-n" aria-hidden="true">${(Number(start) || 1) + i}</span>${x.mark || ''}`
                + `<span class="ovk-rank-main"><span class="ovk-rank-name">${nameHtml}${x.badge || ''}</span>${x.note ? `<small>${esc(x.note)}</small>` : ''}</span>`
                + `<span class="ovk-rank-val"><b>${esc(x.display != null ? x.display : num(v, x.fmt || fmt))}${unit ? ` <small>${esc(unit)}</small>` : ''}</b>${x.interval != null ? `<small>± ${esc(num(x.interval, x.fmt || fmt))}</small>` : ''}</span>${delta}`
                + `<span class="ovk-rank-bar" style="--v:${share.toFixed(3)}" aria-hidden="true"></span></li>`;
        }).join('')}</ol>`;
    }

    /**
     * meter({ value, max, label, text, tone }) — how full something is. tone 'ok' | 'warn' | 'bad', or 'auto' for use of
     * a limit (a quota, a budget, a disk): amber from 75 %, red from 90 %. Without a tone it is the accent, which suits
     * a level where more is better (a confidence, a progress).
     */
    function meter({ value = 0, max = 100, label = '', text = '', tone = '' } = {}) {
        const v = Math.max(0, Math.min(Number(max) || 100, Number(value) || 0));
        const share = v / (Number(max) || 100);
        const t = tone === 'auto' ? (share >= 0.9 ? 'bad' : share >= 0.75 ? 'warn' : '') : tone;
        return `<span class="ovk-meter${t ? ` ovk-meter--${esc(t)}` : ''}" role="meter" aria-valuemin="0" aria-valuemax="${Number(max) || 100}" aria-valuenow="${v}" aria-label="${esc(label)}"${text ? ` aria-valuetext="${esc(text)}"` : ''}><span style="--v:${share.toFixed(3)}"></span></span>`;
    }

    /**
     * drop({ name, accept, label, hint, multiple, camera, required, id, auto }) — the place a file goes: a real file input
     * (it works without JavaScript), with drag and drop, paste and, on phones, the camera added by kit-web.js. auto:
     * the form is sent as soon as a file is chosen. Put it inside the form that receives the file.
     */
    function drop({ name = 'file', accept = '', label = 'Choose a file', hint = '', multiple = false, camera = false, required = false, id = null, auto = false } = {}) {
        const fid = id || `ovk-drop-${esc(name)}`;
        const cam = camera ? `<label class="ovk-btn ovk-btn--quiet ovk-btn--small ovk-drop-cam" hidden>${icon('image')}<span>Take a photo</span><input type="file" accept="image/*" capture="environment" class="ovk-sr" data-ovk-drop-cam></label>` : '';
        return `<div class="ovk-drop" data-ovk-drop${auto ? ' data-ovk-auto' : ''}><input type="file" class="ovk-drop-input" id="${esc(fid)}" name="${esc(name)}"${accept ? ` accept="${esc(accept)}"` : ''}${multiple ? ' multiple' : ''}${required ? ' required' : ''}>`
            + `<label for="${esc(fid)}" class="ovk-drop-zone">${icon('upload')}<strong>${esc(label)}</strong>${hint ? `<small>${esc(hint)}</small>` : ''}<span class="ovk-drop-name" aria-live="polite"></span></label>${cam}</div>`;
    }

    /**
     * receipt({ title, body, facts: [[label, value]], actions: [html], tone }) — a result and what it cost: the answer
     * first, then one quiet line of facts (model, cost, time, confidence, how long it is kept). A value can be
     * { html } (trusted markup, e.g. a kit.meter).
     */
    function receipt({ title = '', body = '', facts = [], actions = [], tone = '', id = null } = {}) {
        const fs2 = (facts || []).filter((f) => f && f[1] != null && f[1] !== '');
        const acts = (actions || []).filter(Boolean).join('');
        return `<section class="ovk-receipt${tone ? ` ovk-receipt--${esc(tone)}` : ''}"${id ? ` id="${esc(id)}"` : ''}${title ? '' : ' aria-label="Result"'}>`
            + `${title || acts ? `<div class="ovk-receipt-head">${title ? `<h2>${esc(title)}</h2>` : '<span></span>'}${acts ? `<span class="ovk-receipt-acts">${acts}</span>` : ''}</div>` : ''}`
            + `<div class="ovk-receipt-body">${body}</div>`
            + `${fs2.length ? `<dl class="ovk-receipt-facts">${fs2.map(([l, v]) => `<div><dt>${esc(l)}</dt><dd>${v && typeof v === 'object' && v.html != null ? v.html : esc(v)}</dd></div>`).join('')}</dl>` : ''}</section>`;
    }

    // ── The tool frame (4.55.0, owner ask 11): one order for every tool page on every site ──
    // What it does, the box you type in, the answer and its next step, the family's other tools, then the rest folded
    // away. Phone first; from 1024 px the family sits in a column beside the tool. docs/kit.md "The tool frame".

    /** The tool's terms as a short list: text, or { text, icon }; blanks are left out. */
    function factsList(facts) {
        const fs = (Array.isArray(facts) ? facts : [facts]).map((f) => (f && typeof f === 'object' ? f : { text: f })).filter((f) => f.text != null && String(f.text).trim());
        return fs.length ? `<ul class="ovk-tool-facts">${fs.map((f) => `<li>${f.icon ? icon(f.icon) : ''}${esc(f.text)}</li>`).join('')}</ul>` : '';
    }
    /** A family's tint as a hue (0–360): a number, or a key hashed the way kit.mark hashes names. */
    const hueFor = (h, key) => (h != null && h !== '' && Number.isFinite(Number(h)) ? ((Math.round(Number(h)) % 360) + 360) % 360 : hueOf(key || ''));

    /**
     * toolHead({ icon, iconHtml, hue, family, crumb: { href, label }, title, task, facts, level }) — the tool's name and the
     * one sentence saying what it does. The icon sits on a tile in the family's tint (hue, else one hashed from family or
     * the crumb); buttons keep the site's own accent. facts: the plain terms, in a short line under the sentence ('Free',
     * 'Runs in your browser: nothing is uploaded', 'Files up to 50 MB', 'Deleted after 1 hour'); the market research's
     * first ask of a tool page is to say its limits, where the work happens and what it costs (4.56.0). A fact is text,
     * or { text, icon } with a kit icon name.
     */
    function toolHead({ icon: ic = 'grid', iconHtml = null, hue = null, family: fam = '', crumb = null, title = '', task = '', facts = [], level = 1 } = {}) {
        const lv = Math.min(3, Math.max(1, Number(level) || 1));
        const cr = crumb && crumb.label ? (crumb.href ? `<a class="ovk-tool-crumb" href="${esc(url(crumb.href))}">${esc(crumb.label)}${icon('chevron')}</a>` : `<span class="ovk-tool-crumb">${esc(crumb.label)}</span>`) : '';
        return `<header class="ovk-tool-head${cr ? '' : ' ovk-tool-head--solo'}" style="--ovk-tint-h:${hueFor(hue, fam || (crumb && crumb.label) || title)}">`
            + `<span class="ovk-tool-tile" aria-hidden="true">${iconHtml != null ? iconHtml : (icon(ic) || icon('grid'))}</span>${cr}`
            + `<h${lv} class="ovk-tool-title">${esc(title)}</h${lv}>${task ? `<p class="ovk-tool-task">${esc(task)}</p>` : ''}`
            + factsList(facts) + '</header>';
    }

    /**
     * tries({ name, target, run, items: [{ label, value, href }] }) — "Try" examples under the box: a tap fills it and
     * runs the tool (kit-web.js). Without JavaScript each is a link to ?<name>=<value>, so a tool page runs the tool its
     * query names. target: the box (a selector; default the [name] field in the same form); run: a button to press when
     * the box is in no form.
     */
    function tries({ name = 'q', target = '', run = '', items = [], label = 'Try' } = {}) {
        const its = (items || []).filter((it) => it && (it.value != null || it.href));
        if (!its.length) return '';
        return `<p class="ovk-try"><span>${esc(label)}</span>${its.map((it) => {
            const v = it.value == null ? '' : String(it.value);
            const href = it.href ? url(it.href) : `?${encodeURIComponent(name)}=${encodeURIComponent(v)}`;
            return `<a href="${esc(href)}"${it.value != null ? ` data-ovk-try="${esc(v)}" data-ovk-name="${esc(name)}"` : ''}${target ? ` data-ovk-for="${esc(target)}"` : ''}${run ? ` data-ovk-run="${esc(run)}"` : ''}>${esc(it.label || v)}</a>`;
        }).join('')}</p>`;
    }

    /**
     * toolInput({ action, method, name, label, placeholder, value, button, icon, type, inputmode, id, required, pattern,
     * maxlength, hidden, tries }) — the one box most tools need: a big field (17 px, so phones do not zoom in), a clear
     * button, and the tool's button under it on a phone and beside it on a computer.
     */
    function toolInput({ action: to = '', method = 'get', name = 'q', label = '', placeholder = '', value = '', button: btn = 'Go', icon: ic = 'search', type = 'text', inputmode = null, id = null, required = true, pattern = null, maxlength = null, hidden = {}, tries: tr = null, autocomplete = 'off' } = {}) {
        const fid = id || `ovk-tool-${String(name).replace(/[^a-z0-9_-]/gi, '')}`;
        const t = ['text', 'search', 'url', 'email', 'number', 'tel'].includes(type) ? type : 'text';
        return `<form class="ovk-tool-form" method="${method === 'post' ? 'post' : 'get'}" action="${esc(url(to || '?'))}">`
            + Object.keys(hidden || {}).map((k) => `<input type="hidden" name="${esc(k)}" value="${esc(hidden[k])}">`).join('')
            + `${label ? `<label class="ovk-tool-label" for="${esc(fid)}">${esc(label)}</label>` : ''}`
            + `<div class="ovk-tool-row"><span class="ovk-tool-field"><input id="${esc(fid)}" name="${esc(name)}" type="${t}" value="${esc(value)}"${label ? '' : ` aria-label="${esc(placeholder || btn)}"`} placeholder="${esc(placeholder)}" autocomplete="${esc(autocomplete)}" spellcheck="false" autocapitalize="off"${inputmode ? ` inputmode="${esc(inputmode)}"` : ''}${required ? ' required' : ''}${pattern ? ` pattern="${esc(pattern)}"` : ''}${maxlength ? ` maxlength="${Number(maxlength)}"` : ''}>`
            + `<button type="button" class="ovk-tool-clear" data-ovk-clear="#${esc(fid)}" aria-label="Clear" title="Clear"${value ? '' : ' hidden'}>${icon('close')}</button></span>`
            + `<button type="submit" class="ovk-btn ovk-btn--primary ovk-tool-go">${ic ? icon(ic) : ''}<span>${esc(btn)}</span></button></div>`
            + (tr ? tries({ name, target: `#${fid}`, ...tr }) : '') + '</form>';
    }

    /**
     * answer({ title, badge: { text, tone }, actions: [html], rows: [[label, value, note]], body, next: [html], tone, id })
     * — a tool's answer: labelled rows with the fact that matters marked (note: text or { text, tone }, a small pill),
     * then the next step (watch it for changes, look up the same name's DNS, compress the picture just made). A value
     * can be { html } (trusted markup). tone 'bad' draws an error answer.
     */
    function answer({ title = '', badge: bd = null, actions = [], rows = [], body = '', next = [], tone = '', id = null, live = true } = {}) {
        const rs = (rows || []).filter((r) => r && r[1] != null && r[1] !== '');
        const acts = (actions || []).filter(Boolean).join('');
        const nx = (next || []).filter(Boolean).join('');
        const pill = (n) => { if (n == null || n === '') return ''; const o = typeof n === 'object' ? n : { text: n }; return ` <span class="ovk-pill${o.tone ? ` ovk-pill--${esc(o.tone)}` : ''}">${esc(o.text)}</span>`; };
        const val = (v) => (v && typeof v === 'object' && v.html != null ? v.html : esc(v));
        return `<section class="ovk-answer${tone ? ` ovk-answer--${esc(tone)}` : ''}"${id ? ` id="${esc(id)}"` : ''}${live ? ' aria-live="polite"' : ''}${title ? '' : ' aria-label="Answer"'}>`
            + (title || (bd && bd.text) || acts ? `<div class="ovk-answer-head">${title ? `<h2>${esc(title)}</h2>` : '<span></span>'}${bd && bd.text ? badge(bd.text, bd.tone || '') : ''}${acts ? `<span class="ovk-answer-acts">${acts}</span>` : ''}</div>` : '')
            + (rs.length ? `<dl class="ovk-answer-rows">${rs.map(([l, v, n]) => `<div><dt>${esc(l)}</dt><dd>${val(v)}${pill(n)}</dd></div>`).join('')}</dl>` : '')
            + (body ? `<div class="ovk-answer-body">${body}</div>` : '')
            + (nx ? `<div class="ovk-answer-next">${nx}</div>` : '') + '</section>';
    }

    /**
     * family({ title, more: { href, label }, items: [{ href, label, short, current }] }) — the family's other tools: one
     * row that scrolls sideways on a phone (short names), a list beside the tool on a computer (full names).
     */
    function family({ title = '', more: m = null, items = [], label = '' } = {}) {
        const its = (items || []).filter((it) => it && it.label);
        if (!its.length) return '';
        return `<nav class="ovk-family" aria-label="${esc(label || title || 'More tools')}">`
            + `<div class="ovk-family-head">${title ? `<h2>${esc(title)}</h2>` : '<span></span>'}${m && m.href ? `<a href="${esc(url(m.href))}">${esc(m.label || 'All')}</a>` : ''}</div>`
            + `<div class="ovk-family-items">${its.map((it) => `<a href="${esc(url(it.href))}"${it.current ? ' aria-current="page"' : ''}>${it.short && it.short !== it.label ? `<span class="ovk-family-short">${esc(it.short)}</span><span class="ovk-family-full">${esc(it.label)}</span>` : esc(it.label)}</a>`).join('')}</div></nav>`;
    }

    /**
     * tool({ head, input, answer, family, folds: [html], related, id }) — the whole frame. input: the card's markup
     * (kit.toolInput, kit.drop, an editor); answer: '' until there is one (the .ovk-tool-out slot stays, so a page that
     * draws its answer later fills it); folds: kit.fold()s joined into one card (About, Questions, Use it from code);
     * related: a kit.list of tools people also use. Folded text stays in the page for search engines.
     */
    function tool({ head: h = '', input = '', answer: a = '', family: f = '', folds = [], related = '', id = null } = {}) {
        const fl = (Array.isArray(folds) ? folds : [folds]).filter(Boolean).join('');
        return `<div class="ovk-tool"${id ? ` id="${esc(id)}"` : ''}>${h}`
            + (input ? `<div class="ovk-tool-card">${input}</div>` : '')
            + `<div class="ovk-tool-out">${a || ''}</div>${f}`
            + (fl ? `<div class="ovk-tool-folds">${fl}</div>` : '')
            + (related ? `<div class="ovk-tool-related">${related}</div>` : '') + '</div>';
    }

    /**
     * page({ head, body, side, dock, wide, id }) — the app page's whole shape in one call: the sticky head (with its tabs),
     * the content, a side panel beside it on a computer (under it on a phone), and the dock.
     */
    const page = ({ head: h = '', body = '', side = '', dock: d = '', wide = false, id = 'main' } = {}) =>
        `<main class="ovk-page${wide ? ' ovk-page--wide' : ''}" id="${esc(id)}">${h}${side ? `<div class="ovk-split"><div class="ovk-main">${body}</div><aside class="ovk-side">${side}</aside></div>` : body}${d}</main>`;

    return {
        esc, url, icon, ICONS, PATHS, when, hueOf, mark, button, iconButton, action, badge, dot, card, rail, CARD_RATIO,
        head, tabs, tabOf, list, row, section, fold, more, sidebar, sidebarButton, withSidebar,
        switchRow, rangeRow, selectRow, seg, chips, saveBar, find, dock, stats, empty, notice, snippet, sheet, sheetButton,
        enhance, VERSION: 2,
        num, steps, table, chart, rank, meter, drop, receipt, page,
        toolHead, toolInput, tries, answer, family, tool,
    };
});
