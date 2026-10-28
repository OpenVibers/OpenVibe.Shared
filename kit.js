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
 * draw themselves, plus enhance(), which adds copy buttons, menus that close, Enter to send, sheets and confirms to
 * whatever markup is already there; it runs by itself when the script loads).
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
 *
 * Text arguments are escaped; arguments named body, html, before, after, actions, trail, badge, extra and mark take
 * trusted markup (usually another builder's output). URLs are kept only when they are http(s) or same-site paths.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    root.OpenVibeKit = api;
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => api.enhance(document));
        else api.enhance(document);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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
        menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
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
        list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>', robot: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5M3 13v2M21 13v2"/>',
    };
    const ICONS = Object.freeze(Object.keys(P));
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
     * href makes the whole row a link; without it the row is static and trail can hold its own forms.
     */
    function row({ href = null, mark: markHtml = '', title = '', titleHtml = null, badge: badgeHtml = '', meta = '', metaIso = '', sub = '', subHtml = null, trail = '', unread = 0, attrs: extra = null } = {}) {
        const top = `<span class="ovk-row-top"><strong>${titleHtml != null ? titleHtml : esc(title)}</strong>${badgeHtml || ''}${meta ? (metaIso ? `<time datetime="${esc(metaIso)}">${esc(meta)}</time>` : `<span class="ovk-row-meta">${esc(meta)}</span>`) : ''}</span>`;
        const subLine = subHtml != null || sub || unread ? `<span class="ovk-row-sub"><span>${subHtml != null ? subHtml : esc(sub)}</span>${dot(unread)}</span>` : '';
        const main = `${markHtml || ''}<span class="ovk-row-main">${top}${subLine}</span>`;
        const cls = `ovk-row${unread ? ' ovk-row--unread' : ''}`;
        if (href != null) return `<li class="${cls}"${attrs(extra)}><a href="${esc(url(href))}">${main}${trail ? `<span class="ovk-row-trail">${trail}</span>` : ''}</a></li>`;
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

    // ── In the browser: behaviour for the markup above (idempotent; safe on pages that use none of it) ──
    function enhance(rootEl) {
        if (typeof document === 'undefined') return;
        const scope = rootEl || document;
        const all = (sel) => Array.prototype.slice.call(scope.querySelectorAll ? scope.querySelectorAll(sel) : []);
        const once = (el, key) => { if (el.dataset[key]) return false; el.dataset[key] = '1'; return true; };
        // Copy buttons: shown only where the clipboard works; the icon turns into a check for a moment.
        all('[data-ovk-copy]').forEach((b) => {
            if (!once(b, 'ovkCopy') || !navigator.clipboard) return;
            b.hidden = false;
            b.addEventListener('click', () => {
                const t = document.querySelector(b.getAttribute('data-ovk-copy'));
                if (!t) return;
                navigator.clipboard.writeText(t.value != null && t.tagName !== 'PRE' ? t.value : t.textContent).then(() => {
                    const was = b.innerHTML; b.innerHTML = icon('check'); b.classList.add('is-done');
                    setTimeout(() => { b.innerHTML = was; b.classList.remove('is-done'); }, 1400);
                }, () => {});
            });
        });
        // Menus: one open at a time; a click elsewhere or Escape closes them.
        all('details.ovk-more').forEach((d) => {
            if (!once(d, 'ovkMore')) return;
            d.addEventListener('toggle', () => { if (d.open) all('details.ovk-more[open]').forEach((o) => { if (o !== d) o.open = false; }); });
        });
        if (!document.documentElement.dataset.ovkDoc) {
            document.documentElement.dataset.ovkDoc = '1';
            document.addEventListener('click', (e) => {
                Array.prototype.forEach.call(document.querySelectorAll('details.ovk-more[open]'), (d) => { if (!d.contains(e.target)) d.open = false; });
            });
            document.addEventListener('keydown', (e) => {
                if (e.key !== 'Escape') return;
                Array.prototype.forEach.call(document.querySelectorAll('details.ovk-more[open]'), (d) => { d.open = false; const s = d.querySelector('summary'); if (s) s.focus(); });
            });
            // The head casts a shadow once the page has scrolled under it.
            let ticking = false;
            const mark = () => { ticking = false; document.documentElement.classList.toggle('ovk-scrolled', (window.scrollY || 0) > 4); };
            window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(mark); } }, { passive: true });
            mark();
        }
        // The composer: Enter sends (Shift+Enter, or a phone's own Enter key, is a new line); the box grows with the text.
        const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
        all('textarea[data-ovk-enter]').forEach((ta) => {
            if (!once(ta, 'ovkEnter')) return;
            const grow = () => { if (CSS && CSS.supports && CSS.supports('field-sizing', 'content')) return; ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, Math.round(innerHeight * 0.4))}px`; };
            ta.addEventListener('input', grow);
            ta.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' || e.shiftKey || e.isComposing || coarse) return;
                e.preventDefault();
                const f = ta.form; if (f) { if (f.requestSubmit) f.requestSubmit(); else f.submit(); }
            });
        });
        // A form that asks first (delete, leave): the network's confirm dialog when the page has it.
        all('form[data-ovk-confirm]').forEach((f) => {
            if (!once(f, 'ovkConfirm')) return;
            f.addEventListener('submit', (e) => {
                if (f.dataset.ovkConfirmed) { delete f.dataset.ovkConfirmed; return; }
                e.preventDefault();
                const msg = f.getAttribute('data-ovk-confirm');
                const ask = window.OpenVibeUI && window.OpenVibeUI.confirm ? window.OpenVibeUI.confirm({ title: msg, danger: true }) : Promise.resolve(window.confirm(msg));
                ask.then((ok) => { if (ok) { f.dataset.ovkConfirmed = '1'; if (f.requestSubmit) f.requestSubmit(e.submitter || undefined); else f.submit(); } });
            });
        });
        // Sliders say their value.
        all('input[type=range][data-ovk-unit]').forEach((r) => {
            if (!once(r, 'ovkRange')) return;
            const u = r.getAttribute('data-ovk-unit');
            r.addEventListener('input', () => r.setAttribute('aria-valuetext', `${r.value}${u === '%' ? ' percent' : ` ${u}`}`));
        });
        // Sheets: a button opens its dialog; the backdrop, Close and Escape close it.
        all('[data-ovk-sheet]').forEach((b) => {
            if (!once(b, 'ovkSheet')) return;
            b.addEventListener('click', () => {
                const d = document.querySelector(b.getAttribute('data-ovk-sheet'));
                if (d && d.showModal && !d.open) d.showModal();
            });
        });
        all('dialog.ovk-sheet').forEach((d) => {
            if (!once(d, 'ovkDialog')) return;
            d.addEventListener('click', (e) => { if (e.target === d || (e.target.closest && e.target.closest('[data-ovk-close]'))) d.close(); });
        });
        // Tabs that scroll sideways keep the open one in view.
        all('.ovk-tabs [aria-current="page"]').forEach((a) => { if (once(a, 'ovkTab') && a.scrollIntoView) a.scrollIntoView({ block: 'nearest', inline: 'center' }); });
    }

    return {
        esc, url, icon, ICONS, when, hueOf, mark, button, iconButton, action, badge, dot,
        head, tabs, tabOf, list, row, section, fold, more,
        switchRow, rangeRow, selectRow, seg, chips, saveBar, find, dock, stats, empty, notice, snippet, sheet, sheetButton,
        enhance, VERSION: 1,
    };
});
