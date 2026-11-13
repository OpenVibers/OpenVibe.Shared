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
 *   kit.section({ title: 'Messages look', body: kit.switchRow({ name, icon, title, line, checked }) + kit.rangeRow(…) + … })
 *   kit.segmented({ name, items: [{ value, label, icon }] })     three or four equal choices in one control
 *   kit.fold({ id, title, meta, open, body })                    a card that opens: setup, extras, danger
 *   kit.find({ action, name, placeholder, icon: 'search' })      a search or "add by name" row
 *   kit.dock({ action, name, placeholder, label })               the composer pinned at the bottom
 *   kit.stats([[1234, 'messages this week'], …])                 a strip of numbers (scrolls sideways on phones)
 *   kit.empty({ title, text, action: { href, label } }) · kit.notice({ kind, text }) · kit.more({ label, items })
 *   kit.button({ href | type, label, icon, kind }) · kit.share({ title, url, kind, id }) · kit.askAgent({ text }) · kit.iconButton(…) · kit.chips(…) · kit.seg(…) · kit.segmented(…) · kit.icon(name)
 *   kit.mark({ name, src, hue, square }) · kit.when(ts) → { iso, text } · kit.esc(text) · kit.ICONS (names)
 *   kit.mediaW(url, width)                                      a Media object at a resize width (64/96/160/320/480/640)
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
    // A Media object (openvibe.media/o/med_…) at a width from Media's resize ladder (64, 96, 160, 320, 480, 640); any other
    // URL as url() gives it. Avatars and pictures are stored as uploaded: Report and Community drew a 3072 px, 3 MB
    // avatar at 34 px (4.87.0).
    const mediaW = (u, w) => { const s = url(u); return /^https:\/\/openvibe\.media\/o\/med_[0-9A-Za-z]+$/.test(s) ? `${s}?w=${Number(w) || 160}` : s; };
    const attrs = (o) => Object.keys(o || {}).filter((k) => o[k] != null && o[k] !== false && /^[a-z][a-z0-9-]*$/i.test(k)).map((k) => (o[k] === true ? ` ${k}` : ` ${k}="${esc(o[k])}"`)).join('');

    // ── Icons: 24-unit line drawings in the text's colour (stroke 2, round), one set for every site ──
    const P = {
        back: '<path d=\"M16.1 3.6l-8.4 8.4l8.4 8.4\"/>', forward: '<path d=\"M7.9 3.6l8.4 8.4l-8.4 8.4\"/>', chevron: '<path d=\"M7.9 3.6l8.4 8.4l-8.4 8.4\"/>',
        up: '<path d=\"M3.7 16.1l8.3-8.3l8.3 8.3\"/>', down: '<path d=\"M3.6 7.9l8.4 8.4l8.4-8.4\"/>', close: '<path d=\"M3.7 3.7l16.7 16.7M20.4 3.7L3.7 20.4\"/>',
        plus: '<path d=\"M12 3.5v17M3.5 12h17\"/>', minus: '<path d=\"M3.5 12h17\"/>', check: '<path d=\"M3.7 12.1l5.4 5.4L20.4 6.1\"/>',
        send: '<path d=\"M12 20.7V4.2M3.7 12.4l8.3-8.3l8.3 8.3\"/>', search: '<circle cx=\"10.6\" cy=\"10.6\" r=\"7\"/><path d=\"M20.4 20.4l-4.5-4.5\"/>',
        more: '<circle cx=\"5.2\" cy=\"12\" r=\"1.6\"/><circle cx=\"12\" cy=\"12\" r=\"1.6\"/><circle cx=\"18.8\" cy=\"12\" r=\"1.6\"/>',
        menu: '<path d=\"M3.5 6.7h17M3.5 12h17M3.5 17.3h17\"/>', sidebar: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/>', filter: '<path d=\"M3.5 6h17M6.7 12.4h10.6M9.9 18.7h4.2\"/>',
        home: '<path d=\"M3.6 10.6L12 3.3l8.4 7.3v8.4a1 1 0 0 1-1 1h-4.2v-6.3h-6.3v6.3H4.7a1 1 0 0 1-1-1Z\"/>',
        chat: '<path d=\"M3.8 4.3h16.8v11.7H8l-4.2 4.2Z\"/>', mail: '<rect x=\"3.5\" y=\"5.5\" width=\"17\" height=\"13.2\" rx=\"1.9\"/><path d=\"M4.4 7.4l7.6 5.7l7.6-5.7\"/>',
        bell: '<path d=\"M12 3.5a1.22 1.22 0 0 1 1.22 1.22v0.47a5.44 5.44 0 0 1 4.22 5.25v3.38c0 0.84 0.28 1.59 0.84 2.25l0.75 0.84a0.75 0.75 0 0 1 -0.56 1.31H5.53a0.75 0.75 0 0 1 -0.56 -1.31l0.75 -0.84c0.56 -0.66 0.84 -1.41 0.84 -2.25v-3.38a5.44 5.44 0 0 1 4.22 -5.25v-0.47A1.22 1.22 0 0 1 12 3.5ZM9.94 18.97a2.16 2.16 0 0 0 4.13 0\"/>',
        user: '<circle cx=\"12\" cy=\"7.4\" r=\"3.8\"/><path d=\"M4.3 20.5c0-3.9 3.4-6.6 7.7-6.6s7.7 2.6 7.7 6.6\"/>',
        members: '<circle cx=\"9.2\" cy=\"7.9\" r=\"3\"/><path d=\"M3.6 19.1c0-3.1 2.6-5.1 5.6-5.1s5.6 2.1 5.6 5.1M15.7 5a3 3 0 0 1 0 5.9M17.6 14.3c1.8 0.6 2.8 2.3 2.8 4.8\"/>',
        invite: '<circle cx=\"9.2\" cy=\"8.2\" r=\"2.9\"/><path d=\"M3.8 18.8c0-3 2.4-4.8 5.3-4.8s5.3 2 5.3 4.8M17.9 8.2v5.3M15.3 10.9h5.3\"/>',
        gear: '<circle cx=\"12\" cy=\"12.1\" r=\"2.3\"/><path d=\"M17.6 14.3a1.3 1.3 0 0 0 0.2 1.5l0.1 0.1a1.5 1.5 0 1 1-2.4 2.4l-0.1-0.1a1.3 1.3 0 0 0-1.5-0.2a1.3 1.3 0 0 0-0.8 1.3V18.8a1.5 1.5 0 1 1-3.4 0v-0.1a1.3 1.3 0 0 0-0.9-1.3a1.3 1.3 0 0 0-1.5 0.2l-0.1 0.1a1.5 1.5 0 1 1-2.4-2.4l0.1-0.1a1.3 1.3 0 0 0 0.2-1.5a1.3 1.3 0 0 0-1.3-0.8H5.4a1.5 1.5 0 1 1 0-3.4h0.1a1.3 1.3 0 0 0 1.3-0.9a1.3 1.3 0 0 0-0.2-1.5l-0.1-0.1a1.5 1.5 0 1 1 2.4-2.4l0.1 0.1a1.3 1.3 0 0 0 1.5 0.2H9.8a1.3 1.3 0 0 0 0.8-1.3V5.4a1.5 1.5 0 1 1 3.4 0v0.1a1.3 1.3 0 0 0 0.8 1.3a1.3 1.3 0 0 0 1.5-0.2l0.1-0.1a1.5 1.5 0 1 1 2.4 2.4l-0.1 0.1a1.3 1.3 0 0 0-0.2 1.5V9.8a1.3 1.3 0 0 0 1.3 0.8H18.7a1.5 1.5 0 1 1 0 3.4h-0.1a1.3 1.3 0 0 0-1.3 0.8Z\"/>',
        pencil: '<path d=\"M11.9 19.6h8.4M16.1 4.2a2 2 0 0 1 2.8 2.8L7.2 18.7l-3.7 0.9l0.9-3.7Z\"/>', trash: '<path d=\"M4.1 6.7h15.8M10 10.6v5.9M14 10.6v5.9M6.1 6.7l1 11.8a2 2 0 0 0 2 2h5.9a2 2 0 0 0 2-2l1-11.8M9 6.7V3.7h5.9v3\"/>',
        copy: '<rect x=\"8\" y=\"8\" width=\"12.5\" height=\"12.5\" rx=\"2.1\"/><path d=\"M16.3 8V5.8a2.1 2.1 0 0 0-2.1-2.1H5.8a2.1 2.1 0 0 0-2.1 2.1v8.4a2.1 2.1 0 0 0 2.1 2.1h2.1\"/>',
        open: '<path d=\"M14 3.8h6.3v6.3M20.2 3.8l-9.4 9.4M18.2 14.2v4.2a2.1 2.1 0 0 1-2.1 2.1H5.6a2.1 2.1 0 0 1-2.1-2.1V7.9a2.1 2.1 0 0 1 2.1-2.1h4.2\"/>',
        link: '<path d=\"M9.9 14.1a4.3 4.3 0 0 0 6.1 0l3.2-3.2a4.3 4.3 0 0 0-6.1-6.1l-1.1 1.1M14.1 9.9a4.3 4.3 0 0 0-6.1 0l-3.2 3.2a4.3 4.3 0 0 0 6.1 6.1l1.1-1.1\"/>',
        download: '<path d=\"M12 3.2v11.5M6.8 9.5l5.2 5.2l5.2-5.2M4.7 20h14.7\"/>', upload: '<path d=\"M12 20.8V9.2M6.8 14.5l5.2-5.2l5.2 5.2M4.7 4h14.7\"/>',
        lock: '<rect x=\"4.7\" y=\"10.7\" width=\"14.5\" height=\"9.4\" rx=\"2.1\"/><path d=\"M7.8 10.7V7.5a4 4 0 0 1 8.3 0v3.2\"/>',
        key: '<circle cx=\"8.1\" cy=\"15.9\" r=\"4.3\"/><path d=\"M11.1 12.9l9.4-9.4M16.8 7.3l3.2 3.2M14.6 9.4l2.2 2.2\"/>',
        ban: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>', help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8M12 17h.01"/>',
        info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>', alert: '<path d=\"M12 4.5L3.6 18.8h16.9Z\"/><path d=\"M12 10v3.7M12 16.5h0\"/>',
        clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', calendar: '<rect x=\"4\" y=\"5.5\" width=\"16\" height=\"15\" rx=\"2\"/><path d=\"M4 10.5h16M9 3.5v4M15 3.5v4\"/>',
        spark: '<path d=\"M10.4 3.6l1.7 4.8L17 10.1l-4.8 1.7L10.4 16.7l-1.7-4.8L3.9 10.1l4.8-1.7ZM17 14.8l0.8 2.1L19.8 17.6l-2.1 0.8L17 20.3l-0.8-2.1L14.3 17.6l2.1-0.8Z\"/>',
        star: '<path d=\"M12 4l2.6 5.3l5.7 0.6l-4.3 3.9l1.2 5.7L12 16.8l-5.2 2.9l1.2-5.7l-4.3-3.9l5.7-0.6Z\"/>', heart: '<path d=\"M11.9 20.3s-8.1-5.1-8.1-11.6a4.6 4.6 0 0 1 8.1-3A4.6 4.6 0 0 1 20 9.2c0 6.5-8.1 11.6-8.1 11.6Z\"/>',
        play: '<path d=\"M5.6 3.6v16.9l13.4-8.5Z\"/>', pause: '<path d=\"M7.1 3.5v17M16.9 3.5v17\"/>', stop: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 8.5 7 7"/>',
        live: '<circle cx=\"12\" cy=\"11.8\" r=\"2\"/><path d=\"M8.6 8.4a4.9 4.9 0 0 0 0 7.1M15.4 8.4a4.9 4.9 0 0 1 0 7.1M6.3 6.1a8.1 8.1 0 0 0 0 11.9M17.7 6.1a8.1 8.1 0 0 1 0 11.9\"/>',
        video: '<rect x=\"3.4\" y=\"6.4\" width=\"12.3\" height=\"11.3\" rx=\"1.9\"/><path d=\"M15.6 10.2l4.7-2.8v9.4l-4.7-2.8\"/>', mic: '<rect x=\"9.2\" y=\"3.5\" width=\"5.7\" height=\"10.4\" rx=\"2.8\"/><path d=\"M5.4 11.1a6.6 6.6 0 0 0 13.2 0M12 17.7v2.8\"/>',
        image: '<rect x=\"3.5\" y=\"5.4\" width=\"16.7\" height=\"13\" rx=\"2.8\"/><circle cx=\"9.1\" cy=\"10\" r=\"1.5\"/><path d=\"M20.3 15.6l-4.7-4.7l-7.4 7.4\"/>',
        file: '<path d=\"M6.4 3.5h7.6l3.8 3.8v13.2H6.4Z\"/><path d=\"M13.9 3.5v3.8h3.8\"/>', folder: '<path d=\"M3.8 7.3a1.9 1.9 0 0 1 1.9-1.9h3.6l1.9 1.9h7.4a1.9 1.9 0 0 1 1.9 1.9v7.4a1.9 1.9 0 0 1-1.9 1.9H5.8a1.9 1.9 0 0 1-1.9-1.9Z\"/>',
        code: '<path d=\"M7.8 7.8l-4.2 4.2l4.2 4.2M16.2 7.8l4.2 4.2l-4.2 4.2M14.2 4.6l-4.2 14.8\"/>', terminal: '<rect x=\"3.7\" y=\"4.6\" width=\"16.7\" height=\"14.9\" rx=\"1.9\"/><path d=\"M7.4 9.2l2.8 2.8l-2.8 2.8M12.9 14.8h3.7\"/>',
        computer: '<rect x=\"3.5\" y=\"4.5\" width=\"17\" height=\"11.3\" rx=\"1.9\"/><path d=\"M8.2 19.7h7.6M12 15.9v3.8\"/>', phone: '<path d=\"M5.7 3.4h3.9l2 4.9l-2.5 1.5a10.8 10.8 0 0 0 4.9 4.9L15.6 12.3l4.9 2v3.9a2 2 0 0 1-2 2A15.8 15.8 0 0 1 3.8 5.4a2 2 0 0 1 2-2\"/>',
        globe: '<circle cx=\"11.9\" cy=\"11.9\" r=\"8.3\"/><path d=\"M3.6 11.9h16.7M11.9 3.6c2.7 2.7 2.7 13.9 0 16.7M11.9 3.6c-2.7 2.7-2.7 13.9 0 16.7\"/>',
        tag: '<path d=\"M3.8 11.2V3.8h7.4l9.3 9.3l-7.4 7.4Z\"/><circle cx=\"8\" cy=\"8\" r=\"1.2\"/>', cart: '<path d=\"M3.5 4.1h1.9l2.2 10.2h10.2L20.3 6.9H6.5\"/><circle cx=\"9.1\" cy=\"18.6\" r=\"1.2\"/><circle cx=\"16.5\" cy=\"18.6\" r=\"1.2\"/>',
        coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2-.4-2.5-1.2M12 6.5v11"/>',
        gift: '<rect x=\"4.4\" y=\"8.8\" width=\"15.1\" height=\"10.4\" rx=\"0.9\"/><path d=\"M3.5 8.8h17M12 8.8v10.4M12 8.8c-1.4-2.8-4.7-3.8-4.7-1.4S12 8.8 12 8.8s4.7-0.9 4.7-3.3S13.4 6 12 8.8\"/>',
        trophy: '<path d=\"M7.9 4h8.4v5.2a4.1 4.1 0 0 1-8.4 0ZM7.9 6.1H4.7a3.2 3.2 0 0 0 3.2 4.1M16.2 6.1h3.2a3.2 3.2 0 0 1-3.2 4.1M12 13.4v4.1M7.9 20.8h8.4\"/>',
        flag: '<path d=\"M6.7 20.7V4M6.7 4h10.8l-2 3.9l2 3.9H6.7\"/>', eye: '<path d=\"M3.5 12S6.6 6.2 12 6.2S20.5 12 20.5 12S17.4 17.8 12 17.8S3.5 12 3.5 12Z\"/><circle cx=\"12\" cy=\"12\" r=\"2.7\"/>',
        'eye-off': '<path d=\"M3.6 12.1S6.7 6.3 11.9 6.3c1.4 0 2.6 0.4 3.7 1M20.4 12.1S17.3 17.7 11.9 17.7c-1.4 0-2.6-0.4-3.7-1M4.9 5l14.1 14.1\"/><path d=\"M10.1 10.1a2.6 2.6 0 0 0 3.7 3.7\"/>',
        flame: '<path d=\"M12 20c3.3 0 5.6-2.3 5.6-5.3c0-3.9-4.1-7.2-5.6-11.4c-1.5 4.2-5.6 7.6-5.6 11.4C6.4 17.8 8.6 20 12 20Z\"/><path d=\"M12 16.7c1.3 0 2.3-0.9 2.3-2.2c0-1.3-1.1-2.5-2.3-3.9c-1.1 1.5-2.3 2.6-2.3 3.9c0 1.2 0.9 2.2 2.3 2.2Z\"/>',
        map: '<path d=\"M9.1 4.6L3.5 6.5v13l5.6-1.9l5.6 1.9l5.6-1.9V4.6l-5.6 1.9Z\"/><path d=\"M9.1 4.6v13M14.7 6.5v13\"/>', book: '<path d=\"M5 5.7a1.9 1.9 0 0 1 1.9-1.9h12.1v14.9H6.8a1.9 1.9 0 0 0-1.9 1.9Z\"/><path d=\"M5 18.7V5.7\"/>',
        game: '<rect x=\"3.7\" y=\"7.2\" width=\"16.7\" height=\"9.7\" rx=\"4.4\"/><path d=\"M7.6 10.7v2.7M6.4 12h2.7M15.1 11.6h0M17.4 12.9h0\"/>',
        leave: '<path d=\"M12.7 3.5h4.2a2.1 2.1 0 0 1 2.1 2.1v12.7a2.1 2.1 0 0 1-2.1 2.1h-4.2M8.5 16.2l-4.2-4.2l4.2-4.2M4.2 12h10.6\"/>',
        retry: '<path d=\"M3.7 12a8.2 8.2 0 0 1 14.1-5.9L20.2 8.4M20.2 3.8v4.6h-4.6M20.2 12a8.2 8.2 0 0 1-14.1 5.9L3.7 15.6M3.7 20.3v-4.6h4.6\"/>',
        task: '<rect x=\"3.7\" y=\"3.6\" width=\"16.7\" height=\"16.7\" rx=\"3.2\"/><path d=\"M7.8 12l3.2 3.2l5.2-6.3\"/>', steps: '<path d=\"M9.7 5.7h11M9.7 11.8h11M9.7 17.8h11\"/><path d=\"M3.7 5.7l1.5 1.5L7.7 4.8M3.7 11.8l1.5 1.5L7.7 10.8M3.7 17.8l1.5 1.5L7.7 16.8\"/>',
        hand: '<path d=\"M9.9 13.6V6.2a1.5 1.5 0 0 1 3 0V11.7M12.8 10.7V5.3a1.5 1.5 0 0 1 3 0V11.7M15.8 11.2V6.7a1.5 1.5 0 0 1 3 0v6.9c0 3.9-2.5 6.9-6.4 6.9c-2.6 0-4.1-1.3-5.6-3.5L4.9 14.2a1.5 1.5 0 0 1 2.4-1.8L9.9 15.6\"/>',
        shield: '<path d=\"M12 3.7L5.5 6.6v5.6c0 4.1 2.8 7.1 6.5 8.4c3.7-1.3 6.5-4.2 6.5-8.4V6.6Z\"/>', zap: '<path d=\"M13.4 3.5L5.9 12.9h5.7l-0.9 7.6l7.6-9.4h-5.7Z\"/>',
        cloud: '<path d=\"M7.8 17.6h8.9a3.4 3.4 0 0 0 0.5-7A5.2 5.2 0 0 0 6.9 10.1A3.7 3.7 0 0 0 7.8 17.6Z\"/>', server: '<rect x=\"3.5\" y=\"3.5\" width=\"17\" height=\"7.4\" rx=\"2.1\"/><rect x=\"3.5\" y=\"13.1\" width=\"17\" height=\"7.4\" rx=\"2.1\"/><path d=\"M7.8 7.2h0M7.8 16.8h0\"/>',
        sun: '<circle cx=\"11.9\" cy=\"11.9\" r=\"3.4\"/><path d=\"M11.9 3.5v1.8M11.9 18.6v1.8M6 6l1.2 1.2M16.7 16.7l1.2 1.2M3.5 11.9h1.8M18.6 11.9h1.8M6 17.9l1.2-1.2M16.7 7.2l1.2-1.2\"/>',
        moon: '<path d=\"M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a6.9 6.9 0 0 0 11.2 11.2Z\"/>', grid: '<rect x=\"3.5\" y=\"3.5\" width=\"7.4\" height=\"7.4\" rx=\"1.6\"/><rect x=\"13.1\" y=\"3.5\" width=\"7.4\" height=\"7.4\" rx=\"1.6\"/><rect x=\"3.5\" y=\"13.1\" width=\"7.4\" height=\"7.4\" rx=\"1.6\"/><rect x=\"13.1\" y=\"13.1\" width=\"7.4\" height=\"7.4\" rx=\"1.6\"/>',
        list: '<path d=\"M8.2 5.5h11.9M8.2 12h11.9M8.2 18.5h11.9M3.3 5.5h0M3.3 12h0M3.3 18.5h0\"/>',
        chart: '<path d=\"M3.9 3.4v16.7h16.7\"/><path d=\"M7.7 14.5l3.6-4.1l3.2 2.7l5.2-6.3\"/>', swap: '<path d=\"M3.5 7.8h14.9l-3.7-3.7M20.5 16.3H5.6l3.7 3.7\"/>',
        wave: '<path d=\"M3.7 16.2c2.1 0 2.1-1.7 4.2-1.7s2.1 1.7 4.2 1.7s2.1-1.7 4.2-1.7s2.1 1.7 4.2 1.7\"/><path d=\"M6.5 12.7A5.6 5.6 0 0 1 16.4 9.4c-1.9-0.4-3.5 0.3-4 2\"/>',
        shoe: '<path d=\"M3.7 14.8v-4.8l3.5-0.4l2.6-3.5l2.8 1.2l-0.8 2.3l3.5 1.9l4.1 0.9a1.7 1.7 0 0 1 1.3 1.7V14.8Z\"/><path d=\"M3.7 17.2h16.6\"/>',
        palette: '<path d=\"M12.2 3.8a8.4 8.4 0 1 0 0 16.8c1.1 0 1.7-0.9 1.7-1.6c0-1.1-0.9-1.5-0.9-2.6s0.9-1.6 1.9-1.6H16.9a3.7 3.7 0 0 0 3.7-3.7C20.6 7.2 16.9 3.8 12.2 3.8Z\"/><circle cx=\"8\" cy=\"11.4\" r=\"1.1\"/><circle cx=\"10.3\" cy=\"7.9\" r=\"1.1\"/><circle cx=\"14.5\" cy=\"7.9\" r=\"1.1\"/>', robot: '<rect x=\"5.4\" y=\"8.3\" width=\"13.2\" height=\"10.4\" rx=\"2.8\"/><path d=\"M12 4.6v3.8M9.2 13.1h0M14.8 13.1h0M9.6 16.4h4.7M3.5 13.1v1.9M20.5 13.1v1.9\"/>',
    };
    // ── The glyphs the kit does not draw itself, generated from glyphs.js (scripts/build-kit-glyphs.js) ──
    // kit.icon has to draw every glyph a page can name: a page that asks for compass or binoculars gets the same
    // registry's drawing, not an empty <svg>. The block is generated and tested, never edited by hand.
    // <generated:kit-glyphs>
    const MORE = Object.freeze({
        'bell-ring': '<path d="M12 3.5a1.22 1.22 0 0 1 1.22 1.22v0.47a5.44 5.44 0 0 1 4.22 5.25v3.38c0 0.84 0.28 1.59 0.84 2.25l0.75 0.84a0.75 0.75 0 0 1 -0.56 1.31H5.53a0.75 0.75 0 0 1 -0.56 -1.31l0.75 -0.84c0.56 -0.66 0.84 -1.41 0.84 -2.25v-3.38a5.44 5.44 0 0 1 4.22 -5.25v-0.47A1.22 1.22 0 0 1 12 3.5ZM9.94 18.97a2.16 2.16 0 0 0 4.13 0"/><path d="M3.84 9.31a8.63 8.63 0 0 1 2.34 -4.6M20.16 9.31a8.63 8.63 0 0 0 -2.34 -4.6"/>',
        scissors: '<circle cx="6" cy="7" r="2.6"/><circle cx="6" cy="17" r="2.6"/><path d="M8.2 8.6 20 18M8.2 15.4 20 6"/>',
        tree: '<path d="M12.1 3.6L7 10.6h2.8L5.6 16.6h13l-4.2-6h2.8ZM12.1 16.6v3.7"/>',
        pin: '<path d="M12 20.7s-6.2-5.4-6.2-10.5a6.2 6.2 0 0 1 12.4 0C18.2 15.2 12 20.7 12 20.7Z"/><circle cx="12" cy="10" r="2.3"/>',
        volume: '<path d="M3.5 9.5h3.7L11.8 5.8v12.6l-4.7-3.7H3.5Z"/><path d="M15.5 9.5a3.7 3.7 0 0 1 0 5.2M18.1 6.9a7.3 7.3 0 0 1 0 10.5"/>',
        mute: '<path d="M3.9 9.4h3.6L12.2 5.8v12.4l-4.6-3.6H3.9Z"/><path d="M16.3 9.9l4.1 4.1M20.5 9.9l-4.1 4.1"/>',
        tent: '<path d="M3.5 18.4h17M12 4.9L4.8 18.4M12 4.9l7.2 13.4M12 12.5L9.3 18.4M12 12.5l2.7 5.8"/>',
        food: '<path d="M8.2 4v6.5M6.3 4v4.2a1.9 1.9 0 0 0 3.7 0V4M8.2 10.5v10.2M17.5 20.8V4c-1.9 1.1-3 3.3-3 6.5v2.8H17.5"/>',
        train: '<rect x="6.4" y="3.8" width="11.2" height="12.1" rx="2.8"/><path d="M6.4 10.3h11.2M9.2 13.1h0M14.8 13.1h0M8.7 20.5l1.9-3.3M15.3 20.5l-1.9-3.3"/>',
        water: '<path d="M3.5 10.2c2.1 0 2.1-1.8 4.3-1.8s2.1 1.8 4.2 1.8s2.1-1.8 4.3-1.8s2.1 1.8 4.2 1.8M3.5 15.6c2.1 0 2.1-1.8 4.3-1.8s2.1 1.8 4.2 1.8s2.1-1.8 4.3-1.8s2.1 1.8 4.2 1.8"/>',
        dish: '<path d="M3.8 9.2A10.9 10.9 0 0 0 14.8 20.2Z"/><path d="M9 15l5.2-5.2M14.8 3.4a5.8 5.8 0 0 1 5.8 5.8M14.8 7.5a1.8 1.8 0 0 1 1.8 1.8"/>',
        history: '<path d="M3.8 12.1a8.3 8.3 0 1 0 2.5-5.9L3.8 8.5M3.8 4.2v4.2h4.2"/><path d="M12 7.9v4.3l3.1 1.9"/>',
        film: '<rect x="3.5" y="4.4" width="17" height="15.1" rx="1.9"/><path d="M7.7 4.4v15.1M16.3 4.4v15.1M3.5 9.2h4.3M3.5 14.8h4.3M16.3 9.2H20.5M16.3 14.8H20.5"/>',
        circle: '<circle cx="12" cy="12" r="8.5"/>',
        sliders: '<path d="M3.5 6.8h10M18.7 6.8H20.3M3.5 17.2h3.6M12.4 17.2H20.3"/><circle cx="16.2" cy="6.8" r="2.4"/><circle cx="9.8" cy="17.2" r="2.4"/>',
        leaf: '<path d="M3.8 20.1c0-9.5 5.6-15.2 16.7-16.7c-1 11.1-6.7 16.7-16.7 16.7ZM3.8 20.1l8.9-8.9"/>',
        clipboard: '<rect x="5.7" y="5" width="12.6" height="15.5" rx="1.9"/><path d="M9.1 5V3.5h5.8V5M9.1 10.8h5.8M9.1 14.7h3.9"/>',
        gauge: '<path d="M3.6 16.9a8.4 8.4 0 1 1 16.7 0"/><path d="M11.9 13.2l4.1-5.7"/><circle cx="11.9" cy="13.2" r="1.4"/>',
        save: '<path d="M4.7 3.5h11.5l3.2 3.2v13.6H4.7Z"/><path d="M7.8 3.5v5.2h7.3V3.5M7.8 20.2v-6.3h8.4v6.3"/>',
        plug: '<path d="M9.2 4v4.6M14.8 4v4.6M6.9 8.7h10.2v2.8a5.1 5.1 0 0 1-10.2 0ZM12 16.6V20.7"/>',
        puzzle: '<path d="M3.8 7h4.2a2.6 2.6 0 1 1 4.8 0h4.2v4.2a2.6 2.6 0 1 1 0 4.8v4.2h-4.2a2.6 2.6 0 1 0-4.8 0H3.8v-4.2a2.6 2.6 0 1 0 0-4.8Z"/>',
        compress: '<path d="M8.8 3.5v5.3H3.5M15.2 3.5v5.3h5.3M8.8 20.5v-5.3H3.5M15.2 20.5v-5.3h5.3"/>',
        expand: '<path d="M3.5 8.8V3.5h5.3M20.5 8.8V3.5h-5.3M3.5 15.2v5.3h5.3M20.5 15.2v5.3h-5.3"/>',
        care: '<path d="M12 10.6s-3.8-2.3-3.8-5a2.1 2.1 0 0 1 3.8-1.3a2.1 2.1 0 0 1 3.8 1.3c0 2.7-3.8 5-3.8 5Z"/><path d="M3.5 13.5v6.5M3.5 15h3.3l3.4 2.8h7.7a1.8 1.8 0 0 0 0-3.6h-4.1"/>',
        city: '<path d="M3.5 19.7h17M5.4 19.7V8.3h4.7v11.3M10.1 19.7V3.6h5.7v16.1M15.8 19.7v-7.6h3.3v7.6M7.8 11.2h0M7.8 14.5h0M12.9 6.9h0M12.9 10.2h0M12.9 13.5h0"/>',
        wrench: '<path d="M14.6 3.6a5.2 5.2 0 0 0-4.6 7.3L3.7 17.3V20.3h3.1l6.4-6.4a5.2 5.2 0 0 0 7.3-4.6l-3.2 1.2l-2.5-2.5l1.2-3.2Z"/>',
        music: '<path d="M8.6 17.7V5.6l11.1-2.1v12.2"/><circle cx="6" cy="17.7" r="2.6"/><circle cx="17.2" cy="15.7" r="2.6"/>',
        'eye-off': '<path d="M10.6 6.1c0.5-0.1 0.9-0.1 1.4-0.1c5.2 0 8.5 6 8.5 6s-0.6 1.1-1.7 2.4M6.9 7.6C4.7 9.2 3.5 12 3.5 12s3.3 6 8.5 6c1.6 0 3-0.5 4.2-1.2"/><path d="M10 10a2.8 2.8 0 0 0 4 4M4.5 4.5l15 15"/>',
        plane: '<path d="M20 4L3.5 10.8l6.6 3.1l3.1 6.6Z"/><path d="M10.1 13.9l9.9-9.9"/>',
        fire: '<path d="M12 20.5a6.8 6.8 0 0 0 6.8-6.8c0-4.3-2.9-6.8-4.2-10.1c-2 2.3-2.6 4.5-2.6 4.5S10.7 5.8 9.5 3.8C7 6.6 5.2 10 5.2 13.7a6.8 6.8 0 0 0 6.8 6.8Z"/>',
        nodes: '<circle cx="12" cy="5.4" r="2.1"/><circle cx="5.8" cy="17.9" r="2.1"/><circle cx="18.2" cy="17.9" r="2.1"/><path d="M11 7.4L6.8 15.9M13 7.4l4.3 8.6M7.9 17.9h8.3"/>',
        bridge: '<path d="M3.5 16h17M7 19.5V5M17 19.5V5"/><path d="M3.5 10c1.8 0 2.8-2.3 3.5-5c2.4 5.2 7.6 5.2 10 0c.7 2.7 1.7 5 3.5 5"/><path d="M12 10.9V16"/>',
        'check-circle': '<circle cx="12" cy="12" r="8.5"/><path d="m8 12.4 2.8 2.8L16 9.6"/>',
        'x-circle': '<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>',
        'alert-circle': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
        news: '<path d="M3.5 3.5h13.8v14.9a2.1 2.1 0 0 0 2.1 2.1H5.6a2.1 2.1 0 0 1-2.1-2.1Z"/><path d="M17.3 7.7h3.2v10.6a2.1 2.1 0 0 1-2.1 2.1M7.2 7.7h6.4M7.2 11.5h6.4M7.2 15.2h3.7"/>',
        camera: '<path d="M3.5 8h3.4l1.8-2.8h6.6L17.1 8h3.4v11.5h-17Z"/><circle cx="12" cy="13.3" r="3.4"/>',
        crown: '<path d="M3.5 8.3L7.8 12L11.9 5.5l4.2 6.5l4.2-3.7L18.4 18.1H5.4Z"/>',
        wallet: '<path d="M3.5 6.8A2.7 2.7 0 0 1 6.2 4.2H18.4v4.2M3.5 6.8V18a2.1 2.1 0 0 0 2.1 2.1h14.9V8.4H6.2A2.7 2.7 0 0 1 3.5 6.8Z"/><path d="M16.2 14.2h0"/>',
        chip: '<rect x="7.3" y="7.3" width="9.4" height="9.4" rx="1.4"/><path d="M10.1 3.5v3.8M13.9 3.5v3.8M10.1 16.7v3.8M13.9 16.7v3.8M3.5 10.1h3.8M3.5 13.9h3.8M16.7 10.1h3.8M16.7 13.9h3.8"/>',
        id: '<rect x="3.7" y="5.5" width="16.7" height="13" rx="1.9"/><circle cx="9.2" cy="11" r="1.9"/><path d="M6.4 15.6c0.5-1.4 1.6-2.2 2.8-2.2s2.4 0.8 2.8 2.2M14.8 10.1h2.8M14.8 13.4h2.8"/>',
        brain: '<path d="M9.2 4.2a2.8 2.8 0 0 0-2.8 2.8a2.8 2.8 0 0 0-1.9 4.8a2.8 2.8 0 0 0 1.9 4.8a2.8 2.8 0 0 0 5.8 1.1V5.8A1.9 1.9 0 0 0 9.2 4.2ZM14.9 4.2a2.8 2.8 0 0 1 2.8 2.8a2.8 2.8 0 0 1 1.9 4.8a2.8 2.8 0 0 1-1.9 4.8a2.8 2.8 0 0 1-5.8 1.1"/>',
        snow: '<path d="M12 3.5v17M4.6 7.8l14.7 8.5M4.6 16.3l14.7-8.5M9.6 4.9L12 7.3l2.4-2.4M9.6 19.1L12 16.7l2.4 2.4"/>',
        mountain: '<path d="M3.6 17.5L9.3 6l3.7 6.3L15.5 9.1L20.3 17.5Z"/>',
        'mic-off': '<rect x="9.2" y="3.6" width="5.7" height="10.4" rx="2.8"/><path d="M5.5 11.1a6.6 6.6 0 0 0 11 5M18.7 11.1c0 0.8-0.1 1.5-0.4 2.2M12.1 17.7v2.8M4.5 4.5l15.1 15.1"/>',
        database: '<ellipse cx="12" cy="6.4" rx="6.6" ry="2.8"/><path d="M5.4 6.4v11.3c0 1.6 2.9 2.8 6.6 2.8s6.6-1.2 6.6-2.8V6.4M5.4 12c0 1.6 2.9 2.8 6.6 2.8s6.6-1.2 6.6-2.8"/>',
        layers: '<path d="M12 5.4l8.3 4.6l-8.3 4.6l-8.3-4.6Z"/><path d="M3.8 14l8.3 4.6l8.3-4.6"/>',
        hash: '<path d="M5 9h15M4 15h15M10 3.5 8 20.5M16 3.5l-2 17"/>',
        text: '<path d="M5.2 20.3L10.9 3.6h2.1l5.7 16.7M7.4 14h9.2"/>',
        enter: '<path d="M13.8 3.6h4.1a2.1 2.1 0 0 1 2.1 2.1v12.5a2.1 2.1 0 0 1-2.1 2.1h-4.1M9.5 7.9l4.1 4.1l-4.1 4.1M13.8 12H3.2"/>',
        language: '<path d="M4.6 5.4h8.4M8.8 3.6v1.9M6.4 5.4c0.5 2.8 2.3 5.6 5.6 7M11.1 5.4c-0.6 3.2-2.6 6.3-6 7.9M12 20.3l3.7-8.4l3.7 8.4M13.3 17.5h4.8"/>',
        idea: '<path d="M9.1 17.6h5.8M10.1 20.5h3.9M8.7 14.3A5.8 5.8 0 1 1 15.2 14.3c-0.7 0.6-1.4 1.5-1.4 2.3h-3.9c0-0.9-0.7-1.7-1.4-2.3Z"/>',
        dollar: '<path d="M15.7 8C15 6.6 13.7 5.6 12 5.6C9.6 5.6 8.3 6.9 8.3 8.5s1.6 2.5 3.7 2.8s3.7 1.3 3.7 3.1s-1.5 3-3.7 3c-1.8 0-3.2-0.9-3.7-2.4M12 3.7v16.7"/>',
        target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
        'arrow-right': '<path d="M3.2 12h16.7M13.7 5.7l6.3 6.3l-6.3 6.3"/>',
        'arrow-left': '<path d="M20.8 12H4M10.3 5.7l-6.3 6.3l6.3 6.3"/>',
        'arrow-up': '<path d="M12 20.8V4M5.7 10.3l6.3-6.3l6.3 6.3"/>',
        'arrow-down': '<path d="M12 3.2v16.7M5.7 13.7l6.3 6.3l6.3-6.3"/>',
        shirt: '<path d="M8.2 3.8L3.7 6.6l1.8 3.8l1.8-0.9v11.2h9.3V9.4l1.8 0.9l1.8-3.8l-4.7-2.7c-0.5 1.4-1.8 2.3-3.8 2.3S8.8 5.1 8.2 3.8Z"/>',
        route: '<circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M8.4 18H16a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h7.6"/>',
        reply: '<path d="M9.2 5.8L4 11l5.1 5.1M4 11h10.3a6.2 6.2 0 0 1 6.2 6.2v1"/>',
        smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
        archive: '<rect x="3.5" y="4.8" width="17" height="4.7" rx="0.9"/><path d="M5.4 9.5v9.4a0.9 0.9 0 0 0 0.9 0.9h11.3a0.9 0.9 0 0 0 0.9-0.9V9.5M10.1 13.3h3.8"/>',
        'user-check': '<circle cx="9.2" cy="8.1" r="2.8"/><path d="M4 19c0-2.9 2.4-4.9 5.4-4.9s5.4 1.9 5.4 4.9M15.4 10.8l1.8 1.8l3.6-3.6"/>',
        ticket: '<path d="M3.6 7.4h16.7v2.8a1.9 1.9 0 0 0 0 3.7v2.8H3.6v-2.8a1.9 1.9 0 0 0 0-3.7Z"/><path d="M13.8 7.4v9.3"/>',
        tack: '<path d="M9.3 4h5.6l-0.9 4.6l2.8 2.8H7.4l2.8-2.8ZM12 11.4v9.3"/>',
        store: '<path d="M3.7 8.8L5.3 3.7h13.4L20.3 8.8M3.7 8.8h16.5v1.6a2.8 2.8 0 0 1-5.4 0a2.8 2.8 0 0 1-5.6 0A2.8 2.8 0 0 1 3.7 10.4ZM4.8 12.9v7.2h14.5v-7.2M9.9 20.1v-4.1h4.1v4.1"/>',
        keyboard: '<rect x="3.5" y="6.6" width="17" height="10.7" rx="1.8"/><path d="M6.6 10.2h0M9.3 10.2h0M12 10.2h0M14.7 10.2h0M17.4 10.2h0M8.4 13.8h7.2"/>',
        gavel: '<path d="M13.7 4.1l5.1 5.1M10.5 7.4l5.1 5.1M12.1 5.8l-5.6 5.6l5 5l5.6-5.6M3.5 19.5l5.9-5.9M13.7 19.5h6.5"/>',
        drop: '<path d="M12 3.5s5.9 6.4 5.9 10.8a5.9 5.9 0 0 1-11.8 0c0-4.4 5.9-10.8 5.9-10.8Z"/>',
        wifi: '<path d="M3.7 9.4a12.4 12.4 0 0 1 16.7 0M6.4 12.5a8.4 8.4 0 0 1 11.5 0M9.1 15.6a4.4 4.4 0 0 1 6.2 0M12.1 18.6h0"/>',
        branch: '<circle cx="6.7" cy="5.6" r="1.9"/><circle cx="6.7" cy="18.6" r="1.9"/><circle cx="17.9" cy="7.5" r="1.9"/><path d="M6.7 7.5v9.3M17.9 9.3c0 5.1-6 3.7-10.2 7.9"/>',
        binoculars: '<rect x="4.4" y="7.4" width="6" height="12.8" rx="3"/><rect x="13.6" y="7.4" width="6" height="12.8" rx="3"/><path d="M10.4 10.2h3.2M10.4 15.8h3.2"/><path d="M6.9 7.4V5.7a1.6 1.6 0 0 1 3.2 0v1.7M13.9 7.4V5.7a1.6 1.6 0 0 1 3.2 0v1.7"/>',
        telescope: '<path d="M3.1 11.4l14.4-7.2l2.5 5l-14.4 7.2Z"/><path d="M9.1 14.9l-1.6 4.7M9.1 14.9l5.5 4.7M8.2 17.3h6.4"/>',
        microscope: '<path d="M3.4 19.9h17.2M6.2 19.9v-3.4h5.8v3.4M9.2 16.5h8.6M14.1 16.5V7.4M14.1 7.4a4 4 0 0 1 4-4h1.2M19.3 3.4v4.8M9.9 9.9h3.6"/>',
        gpu: '<rect x="3.5" y="5.5" width="14.4" height="10" rx="1.6"/><circle cx="8.2" cy="10.5" r="2.8"/><path d="M8.2 8.3v4.4M6 10.5h4.4"/><path d="M17.9 8h2.6v5h-2.6M3.5 15.5v2.5"/>',
        cpu: '<rect x="7" y="7" width="10" height="10" rx="1.6"/><rect x="10.4" y="10.4" width="3.2" height="3.2" rx="0.6"/><path d="M9.5 3.5v3.5M14.5 3.5v3.5M9.5 17v3.5M14.5 17v3.5M3.5 9.5h3.5M3.5 14.5h3.5M17 9.5h3.5M17 14.5h3.5"/>',
        memory: '<rect x="3.5" y="5.5" width="17" height="7.5" rx="1.2"/><path d="M3.5 15v3.5M6.6 15v3.5M9.7 15v3.5M12.8 15v3.5M15.9 15v3.5M19 15v3.5"/><path d="M6.7 8h4.8M6.7 10.8h3M13.4 8h3.9M13.4 10.8h2.4"/>',
        joystick: '<path d="M4.3 19.6h15.4l-2.6-7.3H6.9Z"/><path d="M12 12.3V7.6"/><circle cx="12" cy="5.4" r="2.1"/><circle cx="8.3" cy="16.6" r="1.1"/><circle cx="15.7" cy="16.6" r="1.1"/>',
        wand: '<path d="M3.7 20.3L13.9 10.1M12.1 8.3l3.6 3.6"/><path d="M17.9 3.7l0.9 2.3l2.3 0.9l-2.3 0.9l-0.9 2.3l-0.9-2.3l-2.3-0.9l2.3-0.9Z"/>',
        'layers-plus': '<path d="M3.8 9.8l8.2-4.8l8.2 4.8M3.8 14l8.2 4.8l4.8-2.8"/><path d="M18.6 14.4v5M16.1 16.9h5"/>',
        restroom: '<circle cx="7.1" cy="5.3" r="1.7"/><circle cx="16.4" cy="5.3" r="1.7"/><path d="M11.7 3.6v16.7M5.6 20.3v-5.1H4.7V10.6A1.4 1.4 0 0 1 6.1 9.2h1.9a1.4 1.4 0 0 1 1.4 1.4v4.6H8.5V20.3M15.5 20.3v-3.7h-2.4l1.9-6.1a0.9 0.9 0 0 1 0.9-0.9h0.9a0.9 0.9 0 0 1 0.9 0.9l1.9 6.1H17.3v3.7"/>',
        shelter: '<path d="M3.7 10.5L12 4l8.3 6.5M5.9 9.2v10.4M18.1 9.2v10.4"/><circle cx="12" cy="11" r="1.6"/><path d="M9.8 19.6v-3.9a2.2 2.2 0 0 1 4.3 0V19.6"/>',
        'hot-tub': '<circle cx="8.6" cy="5.8" r="1.7"/><path d="M3.8 11.9h16.6v3.3a4.2 4.2 0 0 1-4.2 4.2h-8.4A4.2 4.2 0 0 1 3.8 15.2ZM6.8 11.9v-1.4A2.4 2.4 0 0 1 8.9 8.2H9.4M13.7 9.5c0.8-0.9-0.8-1.9 0-2.8M17.3 9.5c0.8-0.9-0.8-1.9 0-2.8"/>',
        umbrella: '<path d="M3.8 12.5a8.4 8.4 0 0 1 16.6 0ZM12.1 12.5v6a1.9 1.9 0 0 1-3.7 0M12.1 4.1v0"/>',
        parking: '<rect x="3.7" y="3.7" width="16.7" height="16.7" rx="3"/><path d="M9.6 17V7.2h3.4a3 3 0 0 1 0 5.9H9.6"/>',
        skull: '<path d="M12 3.7a6.5 6.5 0 0 0-6.5 6.5c0 2.2 1 3.6 2.4 4.6v2.8h8.4v-2.8c1.3-1 2.4-2.6 2.4-4.6a6.5 6.5 0 0 0-6.5-6.5Z"/><circle cx="9.6" cy="10.7" r="1.3"/><circle cx="14.4" cy="10.7" r="1.3"/><path d="M10.6 17.7v2.8M13.4 17.7v2.8"/>',
        group: '<path d="M3.5 7.3V3.5h3.8M16.7 3.5h3.8v3.8M20.5 16.7v3.8h-3.8M7.3 20.5H3.5v-3.8"/><rect x="7.3" y="7.3" width="5.7" height="4.7" rx="0.9"/><rect x="11.1" y="12" width="5.7" height="4.7" rx="0.9"/>',
        medical: '<rect x="3.5" y="7.1" width="17" height="12.3" rx="1.9"/><path d="M9.2 7.1V5.2a0.9 0.9 0 0 1 0.9-0.9h3.8a0.9 0.9 0 0 1 0.9 0.9v1.9M12 10.4v5.7M9.2 13.3h5.7"/>',
        shapes: '<circle cx="7.5" cy="7.7" r="3.4"/><path d="M16.4 3.7l3.9 6.9h-7.9ZM13.9 14.1h5.9v5.9h-5.9ZM3.6 20l3.4-5.9l3.4 5.9Z"/>',
        headphones: '<path d="M4.4 13.9v-2.8a7.5 7.5 0 0 1 14.9 0v2.8"/><rect x="3.5" y="13" width="4.2" height="6" rx="1.4"/><rect x="16.1" y="13" width="4.2" height="6" rx="1.4"/>',
        drive: '<rect x="3.5" y="12.3" width="17" height="6.6" rx="1.9"/><path d="M3.9 12.3L6.8 4.7h10.4l2.8 7.6M16.7 15.6h0M13.8 15.6h0"/>',
        'check-double': '<path d="M3.6 11.7l3.6 3.6L14.6 7.7M11.1 15.2l0.9 0.9L20.4 7.7"/>',
        tv: '<rect x="3.5" y="7.8" width="17" height="11.6" rx="1.8"/><path d="M8.4 4.3l3.6 3.6l3.6-3.6"/>',
        toolbox: '<rect x="3.5" y="8.1" width="17" height="11.3" rx="1.9"/><path d="M9.2 8.1V5.8A1.4 1.4 0 0 1 10.6 4.3h2.8A1.4 1.4 0 0 1 14.8 5.8V8.1M3.5 12.8h17M8.2 11.4v2.8M15.8 11.4v2.8"/>',
        table: '<rect x="3.5" y="4.3" width="17" height="15.1" rx="1.9"/><path d="M3.5 9.5h17M3.5 14.7h17M9.2 9.5V19.4M14.8 9.5V19.4"/>',
        scale: '<path d="M12 4.3V19.5M8.5 19.5h6.9M5.5 7.4h13M12 4.3h0M3.7 13.4L5.9 7.8L8.1 13.4M15.9 13.4L18.1 7.8l2.2 5.6M3.7 13.4a2.2 2.2 0 0 0 4.3 0M15.9 13.4a2.2 2.2 0 0 0 4.3 0"/>',
        road: '<path d="M8.2 3.5L4.4 20.5M15.8 3.5l3.8 17M12 4.4v2.4M12 10.6v2.8M12 17.2V19.6"/>',
        money: '<rect x="3.5" y="6.6" width="17" height="10.7" rx="1.8"/><circle cx="12" cy="12" r="2.2"/><path d="M6.6 9.8v0M17.4 14.2v0"/>',
        'heart-pulse': '<path d="M19 12.3c-1.7 3.6-7 6.7-7 6.7s-5.3-3.1-7-6.7M4.3 9.7A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.7 2.2"/><path d="M3.5 11.9h4l1.3-2.2l2.2 4.5l1.8-3.1h7.6"/>',
        heading: '<path d="M5.6 3.5v17M18.4 3.5v17M5.6 12h12.7M3.5 3.5h4.2M16.2 3.5h4.2M3.5 20.5h4.2M16.2 20.5h4.2"/>',
        fist: '<path d="M6.4 10.1V6.4a1.6 1.6 0 0 1 3.2 0V9.1M9.5 8.5v-3.2a1.6 1.6 0 0 1 3.2 0v3.2M12.6 8.5v-2.1a1.6 1.6 0 0 1 3.2 0V9.1M15.7 9.1V8a1.6 1.6 0 0 1 3.2 0v5.2a7.3 7.3 0 0 1-7.3 7.3H11.1a5.7 5.7 0 0 1-5.7-5.7V12.3A2.1 2.1 0 0 1 7.4 11.2h2.1a1.6 1.6 0 0 1 0 3.2H8"/>',
        'fast-forward': '<path d="M4 6.4v11.2L11.6 12ZM13.1 6.4v11.2L20.7 12Z"/>',
        rewind: '<path d="M20 6.4v11.2L12.4 12ZM10.9 6.4v11.2L3.3 12Z"/>',
        'file-code': '<path d="M13.9 3.5H7.4a1.9 1.9 0 0 0-1.9 1.9v13a1.9 1.9 0 0 0 1.9 1.9h9.3a1.9 1.9 0 0 0 1.9-1.9V8.2Z"/><path d="M13.9 3.5v4.6h4.6M10.1 12.4L8.3 14.3l1.9 1.9M13.9 12.4l1.9 1.9l-1.9 1.9"/>',
        dice: '<rect x="3.7" y="3.6" width="16.7" height="16.7" rx="3"/><path d="M8.6 8.6h0M15.5 8.6h0M12.1 12h0M8.6 15.4h0M15.5 15.4h0" stroke-width="2.6"/>',
        contrast: '<circle cx="11.7" cy="12" r="8.4"/><path d="M11.7 3.6v16.7M11.7 7.9h6.5M11.7 12h8.4M11.7 16.2h6.5"/>',
        briefcase: '<rect x="3.5" y="7.2" width="17" height="12.3" rx="1.9"/><path d="M9.2 7.2V5.7A1.4 1.4 0 0 1 10.6 4.3h2.8A1.4 1.4 0 0 1 14.8 5.7V7.2M3.5 12.3h7.1M13.4 12.3H20.5M10.6 11.4h2.8v2.4h-2.8Z"/>',
        timeline: '<path d="M3.5 12h0.9M8.2 12h1.9M13.9 12h1.9M19.6 12h0.9"/><circle cx="6.3" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="17.7" cy="12" r="1.9"/><path d="M6.3 10.1V5.9M12 13.9v4.3M17.7 10.1V5.9"/>',
        seedling: '<path d="M12 20.8v-9.8M12 11C12 6.7 9.3 4 4.4 4c0 4.3 2.7 7 7.6 7ZM12 13.7c0-4.3 2.7-7 7.6-7c0 4.3-2.7 7-7.6 7Z"/>',
        rocket: '<path d="M11.8 15.7L8.4 12.3C9.9 6.9 13.8 3.9 20.2 3.9C20.2 10.3 17.3 14.2 11.8 15.7ZM8.4 12.3L4.9 11.8L7.4 8.3h3.9M11.8 15.7l0.5 3.4l3.4-2.5v-3.9M6.4 17.7c-1.5 0-3 1.5-3 3c1.5 0 3-1.5 3-3Z"/><circle cx="15.3" cy="8.8" r="1.5"/>',
        'list-ordered': '<path d="M9.7 6.8h10.8M9.7 12.8h10.8M9.7 18.8h10.8M3.8 5.4L4.7 5v4.4M3.8 9.3h2M3.8 13.7a1 1 0 0 1 2 0.3c0 1.1-2 1.7-2 2.7h2.2"/>',
        lifebuoy: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.8"/><path d="M6 6l3.4 3.4M14.6 14.7l3.4 3.4M18 6l-3.4 3.4M9.4 14.7l-3.4 3.4"/>',
        infinity: '<path d="M12 12c-1.8-2.4-3.3-3.6-4.9-3.6a3.6 3.6 0 0 0 0 7.2c1.6 0 3.1-1.2 4.9-3.6Zm0 0c1.8 2.4 3.3 3.6 4.9 3.6a3.6 3.6 0 0 0 0-7.2c-1.6 0-3.1 1.2-4.9 3.6Z"/>',
        inbox: '<path d="M3.5 12.7L5.9 4.8h12.1l2.4 7.9V17.8a0.9 0.9 0 0 1-0.9 0.9H4.4a0.9 0.9 0 0 1-0.9-0.9ZM3.5 12.7h4.6l1.4 2.4h4.6l1.4-2.4h4.6"/>',
        door: '<path d="M13.7 4.7L6.3 3.2v16.7l7.5-1.4ZM13.7 5.1h3.3a0.9 0.9 0 0 1 0.9 0.9v14M3.5 20h16.7M11 11.6h0"/>',
        card: '<rect x="3.7" y="5.8" width="16.7" height="12.3" rx="1.8"/><path d="M3.7 10.3h16.7M6.7 14.6h3.5"/>',
        storm: '<path d="M7.8 16a3.8 3.8 0 1 1 0.8-7.4A4.5 4.5 0 0 1 17.4 10.5a3.1 3.1 0 0 1-0.4 6.2"/><path d="M12.9 12.2l-2.1 3.3h2.5L11.3 18.9"/>',
        'trend-up': '<path d="M3.2 16.8L8.8 11.3l3.8 3.8l7.4-7.4"/><path d="M14.4 7.4h5.6v5.6"/>',
        'trend-down': '<path d="M3.2 7.2l5.6 5.6l3.8-3.8l7.4 7.4"/><path d="M14.4 16.6h5.6v-5.6"/>',
        'chevrons-left': '<path d="M10.9 19.3l-7.3-7.3l7.3-7.3M20.4 19.3l-7.3-7.3l7.3-7.3"/>',
        'chevrons-right': '<path d="M3.6 19.3l7.3-7.3l-7.3-7.3M13.1 19.3l7.3-7.3l-7.3-7.3"/>',
        sort: '<path d="M3.5 5.8h9.2M3.5 12h6.2M3.5 18.2h3M17.5 4.8v14.4M14.3 16.2l3 3l3-3"/>',
        'sort-asc': '<path d="M3.4 5.4h3M3.4 11.6h6.3M3.4 17.9h9.3M17.5 4.3v14.6M14.3 16l3 3l3-3"/>',
        share: '<path d="M12 15.2V3.3M7.4 8.1L12 3.3L16.6 8.1M4.9 12.9v6.1a1 1 0 0 0 1 1h12.2a1 1 0 0 0 1-1v-6.1"/>',
        'arrows-h': '<path d="M3.8 12h16.5M7.6 8.1l-3.9 3.9l3.9 3.9M16.4 8.1l3.9 3.9l-3.9 3.9"/>',
        move: '<path d="M11.9 3.6v16.7M3.6 11.9h16.7M9 6.5l2.9-2.9l2.9 2.9M9 17.3l2.9 2.9l2.9-2.9M6.5 9l-2.9 2.9l2.9 2.9M17.3 9l2.9 2.9l-2.9 2.9"/>',
        focus: '<circle cx="12" cy="12" r="2.8"/><path d="M3.5 9V5.9A2.4 2.4 0 0 1 5.9 3.5H9M15 3.5h3.1A2.4 2.4 0 0 1 20.5 5.9V9M20.5 15v3.1a2.4 2.4 0 0 1-2.4 2.4H15M9 20.5H5.9A2.4 2.4 0 0 1 3.5 18.1V15"/>',
        at: '<circle cx="12" cy="12" r="3.4"/><path d="M15.4 12v1.3a2.5 2.5 0 0 0 4.9 0V12a8.3 8.3 0 1 0-3.2 6.5"/>',
        box: '<path d="M3.6 7.9L11.9 3.9l8.4 3.9v8.4L11.9 20.1l-8.4-3.9Z"/><path d="M3.6 7.9L11.9 11.8l8.4-3.9M11.9 11.8v8.4M7.8 5.9l8.4 3.9"/>',
        bug: '<rect x="7.2" y="6.2" width="9.6" height="13.3" rx="4.8"/><path d="M9.3 6.5a2.7 2.7 0 0 1 5.3 0M12 10.9v8.5M7.2 12H3.5M20.5 12h-3.7M7.6 8.3L4.6 5.6M16.4 8.3L19.4 5.6M7.6 16.3L4.6 18.9M16.4 16.3L19.4 18.9"/>',
        megaphone: '<path d="M3.6 9.5v4a1 1 0 0 0 1 1H7.1l9 4.5v-15L7.1 8.5H4.5a1 1 0 0 0-1 1Z"/><path d="M7.1 14.5l1.3 5h2.4L10.1 15.1M19.1 9a3.2 3.2 0 0 1 0 5"/>',
        burst: '<path d="M11.9 3.7L13.6 7.8L17.8 6.2L16.2 10.4L20.3 12.1L16.2 13.8L17.8 18L13.6 16.4L11.9 20.4L10.2 16.4L6 18L7.6 13.8L3.6 12.1L7.6 10.4L6 6.2L10.2 7.8Z"/>',
        'camera-flip': '<path d="M3.5 8h3.4l1.8-2.8h6.6L17.1 8h3.4v11.5h-17Z"/><path d="M15 12.6a3.1 3.1 0 0 0-5.6-1.2M9 14.4a3.1 3.1 0 0 0 5.6 1.2M9.3 9.5v2h2M14.7 17.5v-2h-2"/>',
        'camera-off': '<path d="M3.7 7.9h3.3l1.7-2.7h6.4L16.9 7.9h3.3v11.2h-16.5Z"/><circle cx="11.9" cy="13" r="3.3"/><path d="M3.7 3.5l16.5 16.5"/>',
        car: '<path d="M3.5 15.8v-4.5L6.2 5.8h11.6l2.7 5.5V15.8Z"/><path d="M3.5 11.3h17M6.5 15.8v2.5M17.5 15.8v2.5M7.2 13.8h0M16.8 13.8h0"/>',
        child: '<circle cx="12" cy="5.8" r="2.1"/><path d="M7.9 10.5L12 9.2l4.1 1.4M12 9.2v5.6M9.2 20.4l2.8-5.6l2.8 5.6"/>',
        donate: '<circle cx="11.9" cy="8.4" r="5.2"/><path d="M11.9 6v4.3M3.7 15.6h16.5V20H3.7ZM8.3 17.7h7.2"/>',
        record: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>',
        'plus-circle': '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
        'minus-circle': '<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>',
        clapper: '<path d="M4 10.4h16.3v8.6a1 1 0 0 1-1 1h-14.4a1 1 0 0 1-1-1Z"/><path d="M4 10.4L3.4 7.2l15.7-2.9l0.7 3.3ZM8.5 6.3l2.2 3.2M13.3 5.4l2.2 3.2"/>',
        'clipboard-check': '<rect x="5.7" y="4.9" width="12.6" height="15.5" rx="1.9"/><path d="M9.1 4.9V3.5h5.8V4.9M9.1 13.2l1.9 1.9l3.9-3.9"/>',
        cc: '<rect x="3.5" y="5.4" width="17" height="13.2" rx="2.4"/><path d="M10.7 10.2a2.3 2.3 0 1 0 0 3.6M16.8 10.2a2.3 2.3 0 1 0 0 3.6"/>',
        'cloud-off': '<path d="M7.5 17.6h9.5a3.8 3.8 0 0 0 0.5-7.5A5.7 5.7 0 0 0 6.4 9.6A4.1 4.1 0 0 0 7.5 17.6Z"/><path d="M4 3.9l16.1 16.1"/>',
        commit: '<circle cx="12" cy="12" r="3.4"/><path d="M3.5 12h5.1M15.4 12H20.5"/>',
        'chat-off': '<path d="M4.2 5.1h15.7v10.9H8l-4 4Z"/><path d="M3.7 3.7l16.7 16.7"/>',
        compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1Z"/>',
        cookie: '<path d="M20.6 12.3a8.4 8.4 0 1 1-8.9-8.9a3 3 0 0 0 3.9 3.5a3 3 0 0 0 4.9 5.3Z"/><path d="M8.8 9.4h0M12.2 13.8h0M8.3 15.3h0M15.7 15.3h0"/>',
        couch: '<path d="M5.4 10.1V7.2a1.9 1.9 0 0 1 1.9-1.9h9.4a1.9 1.9 0 0 1 1.9 1.9v2.8"/><path d="M3.5 11.9a1.9 1.9 0 0 1 3.8 0v1.4h9.4V11.9a1.9 1.9 0 0 1 3.8 0v4.7H3.5ZM5.4 16.7v1.9M18.6 16.7v1.9"/>',
        cubes: '<path d="M12 3.2L8.1 5.2v4.4l3.9 2l3.9-2V5.2ZM7.6 11.6L3.6 13.6v4.4l3.9 2l3.9-2V13.6ZM16.4 11.6l-3.9 2v4.4l3.9 2l3.9-2V13.6Z"/>',
        ear: '<path d="M6.2 9.5a5.7 5.7 0 1 1 10.8 2.4c-0.9 1.9-3.1 3-3.1 5.2a3.4 3.4 0 0 1-6.5 1.6"/><path d="M9.7 9.9a2.4 2.4 0 1 1 3.8 1.5"/>',
        eraser: '<path d="M14.3 4.4l5.5 5.5l-9 9H6.6l-2.6-2.6a1.5 1.5 0 0 1 0-2.1Z"/><path d="M9.3 9.4l5.5 5.5M10.8 18.9H20.3"/>',
        laugh: '<circle cx="12" cy="12" r="8.5"/><path d="M8 13.5h8a4 4 0 0 1-8 0ZM7.5 8.6l2.2 1.2-2.2 1.2M16.5 8.6l-2.2 1.2 2.2 1.2"/>',
        fish: '<path d="M9 12c1.8-3.2 4.3-4.8 7.1-4.8c2.6 0 4.2 2 4.9 4.8c-0.7 2.8-2.3 4.8-4.9 4.8c-2.8 0-5.3-1.6-7.1-4.8Z"/><path d="M9 12L4.2 8.6M9 12l-4.8 3.4M17.3 10.6h0.01"/>',
        finish: '<path d="M5.2 20.7V4"/><rect x="5.2" y="4.6" width="13.9" height="8.6" rx="1"/><path d="M5.2 8.8h13.9M9.6 4.6v8.6M14.3 4.6v8.6"/>',
        flask: '<path d="M9.5 3.2h4.9M10 3.2V9.2L4.9 17.7a1.5 1.5 0 0 0 1.3 2.3h11.6a1.5 1.5 0 0 0 1.3-2.3L14 9.2V3.2"/><path d="M7.3 14.6h9.5"/>',
        'folder-tree': '<path d="M4.1 3.3v13.2a1 1 0 0 0 1 1H9.7M4.1 8.3H9.7"/><path d="M10.2 5.3h3.1l1 1.5h5.6V10.9h-9.7ZM10.2 14.5h3.1l1 1.5h5.6V20.1h-9.7Z"/>',
        skip: '<path d="M4.8 3.5l10.8 8.4l-10.8 8.4Z"/><path d="M19.7 3.5v16.7"/>',
        gem: '<path d="M6.8 4.9h10.3L20.2 9.5l-8.3 10.3L3.6 9.5Z"/><path d="M3.6 9.5h16.7M9.6 4.9L8.1 9.5l3.8 10.3M14.2 4.9L15.7 9.5l-3.8 10.3"/>',
        ghost: '<path d="M4.7 20V10.6a7.3 7.3 0 0 1 14.7 0v9.4l-2.4-1.9l-2.5 1.9l-2.4-1.9L9.6 20l-2.5-1.9Z"/><path d="M9.4 10.1h0M14.6 10.1h0"/>',
        grip: '<path d="M8.3 4.5h0M15.8 4.5h0M8.3 12h0M15.8 12h0M8.3 19.5h0M15.8 19.5h0" stroke-width="3.8"/>',
        hammer: '<path d="M13.1 3.7L19.3 9.9l-2.7 2.7l-6.2-6.2Z"/><path d="M13.6 9.4L5 18.1a1.3 1.3 0 0 0 1.9 1.9l8.6-8.6"/>',
        handshake: '<path d="M3.6 9.9v5.3M20.3 9.9v5.3"/><path d="M3.6 10.8h2.2l3.5-2.7l2.9 1.3L14.5 8.2l3.5 2.7h2.2"/><path d="M5.7 10.8l5.6 5.6a1.4 1.4 0 0 0 2-2M18 10.8l-4.7 4.5M17.5 12.8l-4-4l-2.3 2.1a1.3 1.3 0 0 1-1.9-1.9l1.9-2"/>',
        wizard: '<path d="M3.6 20h16.7M6.3 20L9.9 9.1L15.7 3.3L14.1 10.1L17.8 20"/><path d="M8.4 15.4h7.3"/>',
        'heart-broken': '<path d="M11.9 20.3s-8.1-5.1-8.1-11.6a4.6 4.6 0 0 1 8.1-3A4.6 4.6 0 0 1 20 9.2c0 6.5-8.1 11.6-8.1 11.6Z"/><path d="M11.9 5.8L10 9.8l3.5 2.3l-1.6 3.9"/>',
        hourglass: '<path d="M6 3.5h12M6 20.5h12M7.5 3.5c0 4.5 4.5 5.5 4.5 8.5s-4.5 4-4.5 8.5M16.5 3.5c0 4.5-4.5 5.5-4.5 8.5s4.5 4 4.5 8.5"/>',
        lungs: '<path d="M12 3.5v8M12 9.4l-3 2.1M12 9.4l3 2.1M8.4 6.5C5.6 6.5 3.5 10.4 3.5 15.2c0 2.8 1.1 4.8 3.2 4.8s2.7-2.1 2.7-4.8V8.3M15.6 6.5C18.4 6.5 20.5 10.4 20.5 15.2c0 2.8-1.1 4.8-3.2 4.8s-2.7-2.1-2.7-4.8V8.3"/>',
        'link-off': '<path d="M10 13.8a4 4 0 0 0 5.6 0l2.9-2.9a4 4 0 0 0-5.6-5.6l-1 1M13.8 10a4 4 0 0 0-5.6 0l-2.9 2.9a4 4 0 0 0 5.6 5.6l1-1"/><path d="M3.6 3.6l16.7 16.7"/>',
        mask: '<path d="M3.5 7c3 1.3 5.8 1.8 8.5 1.8S17.5 8.3 20.5 7c0 6-2.5 10-5 10-1.4 0-2-1.5-3.5-1.5S9.9 17 8.5 17c-2.5 0-5-4-5-10Z"/><path d="M7.5 11.5h2M14.5 11.5h2"/>',
        mug: '<path d="M4.8 9.1h11v7a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4Z"/><path d="M15.8 10.5H17.3a2.5 2.5 0 0 1 0 5h-1.5M8.3 3.5c-0.8 1 0.8 2 0 3M11.8 3.5c-0.8 1 0.8 2 0 3"/>',
        paw: '<path d="M7.8 18.5c0-3 1.9-5.3 4.2-5.3s4.2 2.3 4.2 5.3c0 1.4-1.1 2.1-2.1 2.1c-0.8 0-1.4-0.5-2.1-0.5s-1.3 0.5-2.1 0.5c-1.1 0-2.1-0.7-2.1-2.1Z"/><circle cx="5.4" cy="10.6" r="1.9"/><circle cx="9.2" cy="5.7" r="1.9"/><circle cx="14.8" cy="5.7" r="1.9"/><circle cx="18.6" cy="10.6" r="1.9"/>',
        walk: '<circle cx="12.3" cy="5.1" r="1.7"/><path d="M8.8 20.3l2.4-5.5l1.9 2.2V20.3M11 14.8l0.9-5.2l-2.7 1.4l-1.4 2.7M11.9 9.6l1.8 2.7l2.7 0.9"/>',
        'phone-off': '<path d="M5.6 4.1h3.7l1.9 4.7l-2.4 1.4a10.3 10.3 0 0 0 4.7 4.7L15.1 12.5l4.7 1.9v3.7a1.9 1.9 0 0 1-1.9 1.9A15.1 15.1 0 0 1 3.8 5.9a1.9 1.9 0 0 1 1.9-1.9"/><path d="M4.3 3.6l16.1 16.1"/>',
        piggy: '<path d="M3.5 11.4c0-3.2 3.3-5.7 7.7-5.7c1.3 0 2.4 0.2 3.4 0.6L17.4 4.7v3.3c0.8 0.7 1.4 1.6 1.6 2.5h1.4v3.4H18.8c-0.5 1-1.3 1.7-2.3 2.3V19.1h-2.9v-1.9c-0.8 0.2-1.7 0.3-2.5 0.3c-0.8 0-1.6-0.1-2.3-0.3v1.9h-2.9v-2.9C4.4 15.1 3.5 13.4 3.5 11.4Z"/><path d="M14.9 10.1h0M8.7 8.1h2.9"/>',
        airplane: '<path d="M12 3.2c0.9 0 1.4 0.9 1.4 2.4V9.8l7 4.2V15.4l-7-2.4V17.2l1.9 1.4V20L12 19.1l-3.3 0.9v-1.4l1.9-1.4v-4.2L3.6 15.4v-1.4L10.6 9.8V5.6C10.6 4.2 11.1 3.2 12 3.2Z"/>',
        print: '<path d="M7.1 8.9V3.5h9.9V8.9"/><rect x="3.6" y="8.9" width="16.7" height="7.9" rx="2"/><path d="M7.1 13.8h9.9v6.4H7.1ZM16.4 11.9h0"/>',
        quote: '<path d="M9.8 6.2C5.8 7.2 3.6 10 3.6 13.9v3.3h5.6v-5.6h-5.6M20.3 6.2c-3.9 1.1-6.1 3.9-6.1 7.8v3.3h5.6v-5.6h-5.6"/>',
        radio: '<rect x="3.5" y="8.3" width="16.8" height="11.3" rx="1.9"/><path d="M7.3 8.3L16.7 3.9"/><circle cx="15.3" cy="14" r="2.4"/><path d="M6.8 12.4h3.8M6.8 15.4h3.8"/>',
        ranking: '<path d="M3.5 19.9h17M4.5 19.9V13.8h4.7M9.2 19.9V10h5.7v9.9M14.9 19.9V15.7h4.7v4.3"/><path d="M12 3.4l0.9 1.7l1.9 0.3l-1.4 1.3l0.3 1.9L12 7.7l-1.7 0.9l0.3-1.9L9.3 5.4l1.9-0.3Z"/>',
        recycle: '<path d="M7.8 18.2H5.7a1.2 1.2 0 0 1-1-1.8l2.3-3.9M10 5.5l0.9-1.5a1.2 1.2 0 0 1 2.1 0l2.3 3.9M17.7 12.4l1.6 2.7a1.2 1.2 0 0 1-1 1.8h-4.5"/><path d="M11.1 16.5l1.8 1.8l-1.8 1.8M4.5 10.4l2.4-0.7l0.7 2.5M17.2 6.1l-0.7 2.5l-2.5-0.7"/>',
        rss: '<path d="M4 3.5a16.5 16.5 0 0 1 16.5 16.5M4 10.4A9.6 9.6 0 0 1 13.6 20.1"/><path d="M4.6 19.4h0" stroke-width="3.9"/>',
        scroll: '<path d="M8.3 3.8h10.1a1.9 1.9 0 0 1 1.9 1.9v1.5H17M8.3 3.8a1.9 1.9 0 0 0-1.9 1.9v11.7a2.9 2.9 0 0 1-2.9 2.9h10.7a2.9 2.9 0 0 0 2.9-2.9v-11.7a1.9 1.9 0 0 0-1.9-1.9M10.2 9.2h3.9M10.2 13h3.9"/>',
        signature: '<path d="M3.9 14c2.4 0 3.3-8.4 5.6-8.4c1.4 0 0.9 5.6 2.4 5.6c0.9 0 1.4-2.4 2.4-2.4s0.8 1.9 1.9 1.9c0.8 0 1.4-0.6 1.9-1.1M3.9 17.8h16.7"/>',
        square: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.7"/>',
        sword: '<path d="M20.3 3.7v3.7L10.4 17.3L6.7 13.6L16.7 3.7Z"/><path d="M5.2 12L12 18.8M8.3 15.7L3.6 20.4"/>',
        columns: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M12 4.5v15M3.5 9h17"/>',
        'thumbs-up': '<path d="M7.3 10.4v9.6H4.8a1 1 0 0 1-1-1v-7.6a1 1 0 0 1 1-1Z"/><path d="M7.3 10.4L10.9 3.3a2.2 2.2 0 0 1 2.5 2.6L12.7 9.4H18.5a2 2 0 0 1 2 2.4l-1.3 6.6a2 2 0 0 1-2 1.6H7.3"/>',
        undo: '<path d="M9.2 14.2L4 8.9l5.2-5.2"/><path d="M4 8.9h11a5.8 5.8 0 0 1 0 11.5H11.3"/>',
        'user-circle': '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="10" r="3"/><path d="M6.6 18.3a6.5 6.5 0 0 1 10.8 0"/>',
        'user-lock': '<circle cx="9.8" cy="7.3" r="3.3"/><path d="M3.5 18.8c0-3.4 2.8-5.7 6.2-5.7c1.2 0 2.2 0.3 3.1 0.7"/><rect x="14.6" y="14.5" width="5.7" height="4.8" rx="1"/><path d="M16 14.5v-1.2a1.5 1.5 0 0 1 2.9 0v1.2"/>',
        'user-minus': '<circle cx="10.1" cy="8" r="3.3"/><path d="M4 19.3c0-3.3 2.7-5.7 6.1-5.7c1.1 0 2.2 0.3 3 0.7"/><path d="M15.1 17h5.7"/>',
        'user-pen': '<circle cx="9.8" cy="8" r="3.3"/><path d="M3.8 19.1c0-3.3 2.7-5.6 6-5.6c1.1 0 2.1 0.3 3 0.7"/><path d="M19.1 12.1l1.4 1.4l-4.7 4.7l-1.9 0.5l0.5-1.9Z"/>',
        'user-tag': '<circle cx="10" cy="7.6" r="3.3"/><path d="M3.8 18.9c0-3.3 2.8-5.6 6.1-5.6c1.1 0 2.2 0.3 3.1 0.7"/><path d="M14.2 14.2h3.7l2.4 2.4l-2.4 2.4h-3.7Z"/><path d="M16.1 16.5h0"/>',
        'user-off': '<circle cx="12" cy="8.2" r="3.5"/><path d="M5.1 20c0-3.6 3-5.9 6.9-5.9s6.9 2.3 6.9 5.9"/><path d="M3.7 3.7l16.7 16.7"/>',
        weight: '<circle cx="12" cy="5.2" r="2"/><path d="M7.1 8.7h9.9l3 11.3H4.1Z"/>',
        wind: '<path d="M3.5 9.9h10.4a2.8 2.8 0 1 0-2.8-2.8M3.5 13.7h14.2a2.8 2.8 0 1 1-2.8 2.8M3.5 17.5h6.6"/>',
        window: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9h17"/>',
        'window-restore': '<rect x="3.5" y="8.5" width="12" height="11" rx="2"/><path d="M8.5 8.5v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/>',
        'align-left': '<path d="M4 5.9h16.6M4 10h10.4M4 14.3h16.6M4 18.5h10.4"/>',
        slash: '<path d="M3.6 3.6l16.7 16.7"/>',
        'book-open': '<path d="M12 6.3C10 4.8 7 4.3 3.5 4.9v13.2c3.5-0.6 6.5-0.1 8.5 1.4c2-1.5 5-2 8.5-1.4V4.9C17 4.3 14 4.8 12 6.3Z"/><path d="M12 6.3v13.2"/>',
        busy: '<path d="M4.7 12h0M12.1 12h0M19.4 12h0" stroke-width="4.2"/>',
    });
    // </generated:kit-glyphs>
    const ALL = Object.freeze({ ...P, ...MORE });
    const ICONS = Object.freeze(Object.keys(ALL));
    /** Every icon's drawing (the inside of a 24-unit SVG), for openvibe-shared/glyphs and every kit builder. */
    const PATHS = ALL;
    /** The drawings this file was built with, before the glyphs.js block: glyphs.js adds the rest. */
    const KIT_PATHS = P;
    /** One icon as inline SVG (decorative: aria-hidden); '' for a name the set does not have. */
    function icon(name, { size = null, cls = '' } = {}) {
        const d = PATHS[name];
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
        if (src && url(src) !== '#') return `<img class="${cls}" src="${esc(mediaW(src, (Number(size) || 40) > 48 ? 160 : 96))}" alt="" loading="lazy" decoding="async"${st ? ` style="${st}"` : ''}>`;
        const words = String(name || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
        const letters = (words.length > 1 ? [...words[0]][0] + [...words[1]][0] : [...(words[0] || '?')].slice(0, 2).join('')).toUpperCase();
        return `<span class="${cls}" style="${st}--ovk-hue:${hue == null ? hueOf(name) : Number(hue) || 0}" aria-hidden="true">${esc(letters)}</span>`;
    }

    // ── Controls ──
    /** A button or a link that looks like one. kind: 'primary' (default), 'quiet', 'danger', 'ghost'; small: a pill. */
    // 4.204.0, buttons that show what they do and what is happening (docs/kit.md#buttons): kind 'hero' | 'soft' | 'live'
    // beside primary/quiet/ghost/danger; nudge (forward, back, add, open, down, refresh) moves the icon by meaning;
    // iconEnd puts it after the words; attention marks the one next step; badge a count; dot ok|warn|bad|live; hold
    // (ms) makes a destructive button hold-to-confirm; pressed makes it a toggle.
    function button({ href = null, type = 'submit', label = '', icon: ic = '', iconEnd = '', kind = 'primary', small = false, name = null, value = null, attrs: extra = null,
        nudge = null, attention = false, badge = null, dot = null, hold = null, pressed = null } = {}) {
        const cls = `ovk-btn ovk-btn--${esc(kind)}${small ? ' ovk-btn--small' : ''}`;
        const more = { ...(extra || {}) };
        if (nudge) more['data-nudge'] = nudge;
        if (attention) more['data-attention'] = '';
        if (badge != null && badge !== '' && badge !== 0) more['data-badge'] = Number(badge) > 99 ? '99+' : String(badge);
        if (dot) more['data-dot'] = dot;
        if (hold) more['data-hold'] = String(Math.max(400, Math.min(4000, Number(hold) || 1200)));
        if (pressed != null) more['aria-pressed'] = pressed ? 'true' : 'false';
        extra = Object.keys(more).length ? more : null;
        const inner = `${ic ? icon(ic) : ''}<span>${esc(label)}</span>${iconEnd ? icon(iconEnd) : ''}`;
        if (href != null) return `<a class="${cls}" href="${esc(url(href))}"${attrs(extra)}>${inner}</a>`;
        return `<button class="${cls}" type="${type === 'button' ? 'button' : type === 'reset' ? 'reset' : 'submit'}"${name ? ` name="${esc(name)}"` : ''}${value != null ? ` value="${esc(value)}"` : ''}${attrs(extra)}>${inner}</button>`;
    }
    /**
     * The one Share button (4.114.0, docs/share.md): it opens the network's Share sheet (ov-share.js, which the navbar
     * loads on the first press). url is what is shared (else the page's address); kind and id add "Who can open it" for
     * the owner, where the service mounts openvibe-sdk/share's router.
     */
    function share({ title = '', url: link = null, text = '', image = null, embed = null, kind = null, id = null, label = 'Share', small = false, quiet = true } = {}) {
        return button({ type: 'button', label, icon: 'upload', kind: quiet ? 'quiet' : 'primary', small,
            attrs: { 'data-ov-share-sheet': true, 'data-title': title || null, 'data-url': link ? url(link) : null, 'data-text': text || null,
                'data-image': image ? url(image) : null, 'data-embed': embed ? url(embed) : null, 'data-kind': kind || null, 'data-id': id || null } });
    }
    /**
     * "Ask your agent" (4.135.0, plan Z3): one chip any page can carry. A tap opens the person's Vibe in the Dock with the
     * question waiting in its box, this page's context included, for them to read and send; it never sends for them.
     * Signed out, the navbar sends them to sign in. text: the prefilled question ("About this stream: …").
     */
    function askAgent({ text = '', label = 'Ask your agent', small = true } = {}) {
        return button({ type: 'button', label, icon: 'spark', kind: 'quiet', small, attrs: { 'data-ov-ask': String(text || '').slice(0, 2000), class: null } }).replace('class="ovk-btn', 'class="ovk-ask ovk-btn');
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
    function head({ title = '', titleHtml = null, sub = '', subHtml = null, back = null, icon: ic = '', actions = [], tabs = '', level = 1, sticky = true } = {}) {
        const h = level === 2 ? 'h2' : 'h1';
        return `<header class="ovk-head${sticky ? '' : ' ovk-head--static'}"><div class="ovk-head-row">`
            + (back ? `<a class="ovk-icon-btn ovk-back" href="${esc(url(back.href))}" aria-label="${esc(back.label || 'Back')}" title="${esc(back.label || 'Back')}">${icon('back')}</a>` : '')
            + (ic ? `<span class="ovk-heading-icon">${icon(ic)}</span>` : '')
            + `<div class="ovk-head-id"><${h}>${titleHtml != null ? titleHtml : esc(title)}</${h}>${subHtml != null ? `<p class="ovk-sub">${subHtml}</p>` : sub ? `<p class="ovk-sub">${esc(sub)}</p>` : ''}</div>`
            + (actions && actions.length ? `<div class="ovk-head-tools">${actions.join('')}</div>` : '')
            + `</div>${tabs || ''}</header>`;
    }
    /** A page identity, with a named parent and a native, script-free mobile description disclosure.
     * actions accepts iconButton options or trusted control markup, like head(). */
    function pageHead({ back = null, icon: ic = 'home', title = '', lede = '', actions = [] } = {}) {
        const tools = (actions || []).map(a => typeof a === 'string' ? a : iconButton(a)).join('');
        return `<header class="ovk-page-head">`
            + (back ? `<a class="ovk-page-back" href="${esc(url(back.href))}">${icon('back')}<span>${esc(back.label || 'Back')}</span></a>` : '')
            + `<div class="ovk-page-head-row"><span class="ovk-heading-icon">${icon(ic)}</span><h1>${esc(title)}</h1>`
            + (tools ? `<div class="ovk-page-actions">${tools}</div>` : '') + `</div>`
            + (lede ? `<p class="ovk-page-lede">${esc(lede)}</p>` : '')   // one copy, whole, on every screen
            + `</header>`;
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
        // A row's data-* attributes (a site finds its rows by them: a conversation's id), nothing else.
        const data = (a) => Object.entries(a || {}).filter(([k, v]) => /^data-[a-z0-9-]+$/.test(k) && v != null && v !== false).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
        const item = (x) => `<a class="ovk-sidebar-item${x.sub ? ' has-sub' : ''}${x.sub && x.mark ? ' has-mark' : ''}${x.here ? ' is-here' : ''}" href="${esc(url(x.href))}"${x.here ? ' aria-current="page"' : ''}${data(x.attrs)}>`
            + `${x.mark || ''}<span class="ovk-sidebar-t">${esc(x.label)}</span>${x.meta ? `<span class="ovk-sidebar-m">${esc(x.meta)}</span>` : ''}${dotHtml(x.dot)}`
            + `${x.sub ? `<span class="ovk-sidebar-s">${esc(x.sub)}</span>` : ''}</a>`;
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
    function section({ title = '', count = null, note = '', body = '', id = null, cls = '', icon: ic = '', actions = [] } = {}) {
        const hid = id ? `${id}-h` : null;
        const heading = title ? `<h2${hid ? ` id="${esc(hid)}"` : ''}>${esc(title)}${count != null ? `<span class="ovk-count">${esc(count)}</span>` : ''}</h2>` : '';
        return `<section class="ovk-section${cls ? ` ${esc(cls)}` : ''}"${id ? ` id="${esc(id)}"` : ''}${hid && title ? ` aria-labelledby="${esc(hid)}"` : ''}>`
            + (ic || actions.length ? `<header class="ovk-section-head">${ic ? `<span class="ovk-heading-icon">${icon(ic)}</span>` : ''}${heading}${actions.length ? `<div class="ovk-section-actions">${actions.join('')}</div>` : ''}</header>` : heading)
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
    /**
     * A switch row: an icon tile, a title and one muted line on the left, an iOS-style switch on the right. The whole
     * row is the target (56 px), and the switch is the checkbox itself (role="switch"), so the form works without
     * JavaScript. `label`/`hint`/`on` are the older names, kept working.
     */
    const switchRow = ({ name, icon: ic = null, title = null, line = null, label = null, hint = null, checked = null, on = null, value = '1' } = {}) => {
        const t = title != null ? title : (label != null ? label : '');
        const l = line != null ? line : (hint || '');
        const c = checked != null ? !!checked : !!on;
        return `<label class="ovk-set-row ovk-set-switch">${ic ? `<span class="ovk-set-ic" aria-hidden="true">${icon(ic)}</span>` : ''}<span class="ovk-set-text">${esc(t)}${l ? `<small>${esc(l)}</small>` : ''}</span><input type="checkbox" role="switch" class="ovk-switch" name="${esc(name)}" value="${esc(value)}"${c ? ' checked' : ''}></label>`;
    };
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
    /**
     * A segmented choice (three or four) as radios that look like one control: items [{ value, label, icon }]. The
     * value still posts as the radio group's; the input is the browser's, only drawn differently, so it works without
     * JavaScript. Without a label the control stands alone (a form puts its own label above it) and `ariaLabel` names
     * the group; label draws a labelled row.
     */
    function segmented({ name, items = [], value = '', label = '', ariaLabel = '' } = {}) {
        const id = `ovk-seg-${String(name).replace(/[^A-Za-z0-9_-]/g, '-')}`;
        const control = `<span class="ovk-seg ovk-seg--fill" role="radiogroup"${label ? ` aria-labelledby="${id}"` : ` aria-label="${esc(ariaLabel || name)}"`}>${items.map((it) => `<label class="ovk-seg-item"><input type="radio" name="${esc(name)}" value="${esc(it.value)}"${String(it.value) === String(value) ? ' checked' : ''}><span>${it.icon ? icon(it.icon) : ''}${esc(it.label)}</span></label>`).join('')}</span>`;
        return label ? `<div class="ovk-set-row ovk-set-seg"><span class="ovk-set-text" id="${id}">${esc(label)}</span>${control}</div>` : control;
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
        // tabindex: on a phone the row scrolls sideways, and a row with no link in it had no way in by keyboard
        // (axe scrollable-region-focusable, 2026-11-01 sweep).
        return `<dl class="ovk-stats" aria-label="${esc(label)}" tabindex="0">${shown.map(([v, l, href]) => `<div${href ? ' class="ovk-stat--link"' : ''}><dt>${href ? `<a href="${esc(url(href))}">${esc(l)}</a>` : esc(l)}</dt><dd>${esc(fmt(v))}</dd></div>`).join('')}</dl>`;
    }
    /**
     * Content labels (L1, common.content-labels@1) as small chips beside a title: what a stream, recording, picture or
     * post is labelled as. Only the labels in force: an AI or viewer suggestion is the creator's to confirm, never shown
     * to viewers. The page also marks the labelled thing itself (data-ov-labels="…") so ov-labels.js applies each
     * viewer's own choice; these chips only say what it carries.
     *   kit.labels(['language', '18+'])  or  kit.labels({ labels: [...], suggested: [...] })
     */
    const LABEL_NAMES = { nudity: 'Nudity', language: 'Strong language', graphic: 'Graphic', '18+': '18+', flashing: 'Flashing lights', spoilers: 'Spoilers' };
    function labels(list, { label = 'Content labels' } = {}) {
        const arr = Array.isArray(list) ? list : (list && Array.isArray(list.labels) ? list.labels : []);
        const shown = [...new Set(arr)].filter((l) => Object.prototype.hasOwnProperty.call(LABEL_NAMES, l));
        if (!shown.length) return '';
        return `<ul class="ovk-labels" aria-label="${esc(label)}">${shown.map((l) => `<li class="ovk-label${l === '18+' ? ' ovk-label--adult' : ''}" data-label="${esc(l)}">${esc(LABEL_NAMES[l])}</li>`).join('')}</ul>`;
    }
    /** The value for data-ov-labels on the labelled element (empty when there is none). */
    const labelsAttr = (list) => {
        const arr = Array.isArray(list) ? list : (list && Array.isArray(list.labels) ? list.labels : []);
        const shown = [...new Set(arr)].filter((l) => Object.prototype.hasOwnProperty.call(LABEL_NAMES, l));
        return shown.length ? ` data-ov-labels="${esc(shown.join(','))}"` : '';
    };
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
     *  - date: for a thing without a picture that happens on a day (a drop, an event, a deadline), the day itself drawn in
     *    the media (weekday and month, the day large; UTC) instead of a calendar icon repeated on every card
     *  - ⋯ with Save and Remind when given ({ href } or { action, hidden }), Share (always: the system share sheet, else
     *    the link copied) and any `more` items (kit.more's)
     * The card is one link, the title's, stretched over it; ⋯ sits above it. level: the title's heading level (3).
     */
    // A day as a card's cover (card({ date })): the weekday and month on a line, the day large under it (clear of the
    // corner's price). UTC, as the sites' dates are.
    function dateCover(value) {
        if (value == null || value === '') return '';
        const t = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(String(value));
        if (!Number.isFinite(t)) return '';
        const d = new Date(t);
        return `<span class="ovk-card-noimg ovk-card-noimg--date" aria-hidden="true"><span class="ovk-card-date-m"><span class="ovk-card-date-w">${WEEKDAYS[d.getUTCDay()]}</span> ${MONTHS[d.getUTCMonth()]}</span>`
            + `<b class="ovk-card-date-d">${d.getUTCDate()}</b></span>`;
    }
    function card({ href = '#', title = '', type = '', ratio = '', image = '', alt = '', video = '', badge: bd = '', live = false, corner = '',
        peek = '', who = '', whoHtml = null, avatar = '', count = null, when: at = null, level = 3, save = null, remind = null, share = true,
        more: extra = null, sub = '', preview = '', date = null } = {}) {
        const ar = /^\d{1,2}\/\d{1,2}$/.test(String(ratio)) ? ratio : CARD_RATIO[type] || '16/9';
        const link = url(href);
        const first = String(preview || '').split('\n').slice(0, 9).join('\n').slice(0, 480).trimEnd();
        const pic = media(image)
            ? `<img src="${esc(mediaW(image, 640))}" alt="${esc(alt)}" loading="lazy" decoding="async">`
            : first ? `<pre class="ovk-card-pre" aria-hidden="true">${esc(first)}</pre>`
                // No picture but a person (2026-11-01): their face, large, over a soft blur of it, where a lone type icon
                // in an empty box read as a missing image (Report's episodes, Tours' recordings).
                : media(avatar) ? `<span class="ovk-card-noimg ovk-card-noimg--who" aria-hidden="true"><img class="ovk-card-noimg-bg" src="${esc(mediaW(avatar, 160))}" alt="" loading="lazy" decoding="async"><img class="ovk-card-noimg-face" src="${esc(mediaW(avatar, 160))}" alt="" loading="lazy" decoding="async"></span>`
                    : dateCover(date) || `<span class="ovk-card-noimg">${icon(CARD_ICON[type] || 'image')}</span>`;
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
    function rail({ id = '', title = '', more: m = null, items = [], size = 'm', label = '', wrap = false, icon: ic = '' } = {}) {
        const list = (items || []).filter(Boolean);
        if (!list.length) return '';
        const hid = id ? `${String(id).replace(/[^a-z0-9_-]/gi, '')}-h` : '';
        const head = title || m ? `<div class="ovk-rail-head">${title ? `<h2${ic ? ' class="ovk-titled"' : ''}${hid ? ` id="${hid}"` : ''}>${ic ? icon(ic, { cls: 'ovk-heading-icon' }) : ''}${esc(title)}</h2>` : ''}${m && m.href ? (ic ? button({ href: m.href, label: m.label || 'See all', icon: m.icon || 'forward', kind: 'quiet' }) : `<a class="ovk-rail-more" href="${esc(url(m.href))}">${esc(m.label || 'See all')}${icon('chevron')}</a>`) : ''}</div>` : '';
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
        // 4.242.0 (plan §Y.1 A10, rule 141 empty-says-what-comes): an empty table is the kit's designed empty card, not a
        // muted line; `empty` is its words, or { title, text, action, icon }.
        if (!rows || !rows.length) { if (!none) return ''; const spec = typeof none === 'object' ? none : { text: String(none), icon: 'inbox' }; return `<div class="ovk-table-empty">${empty(spec)}</div>`; }
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

    /**
     * Placeholders shaped like the content on its way (4.70.0, plan L52; the owner, 2026-11-01: "placeholder elements while
     * it loads, a fake thumbnail, so it is not jarring"). Same sizes as the real thing, so it lands without a jump; a soft
     * shimmer (never a spinner), still under reduced motion; announced once as busy.
     *   skeleton({ kind: 'card' | 'row' | 'tile' | 'chip' | 'line' | 'chat' | 'stat', count = 3, label = 'Loading' })
     */
    function skeleton({ kind = 'row', count = 3, label = 'Loading' } = {}) {
        const n = Math.max(1, Math.min(48, Number(count) || 1));
        const one = {
            card: '<div class="ovk-skel-card"><span class="ovk-skel ovk-skel-thumb"></span><span class="ovk-skel ovk-skel-l1"></span><span class="ovk-skel ovk-skel-l2"></span></div>',
            row: '<div class="ovk-skel-row"><span class="ovk-skel ovk-skel-avatar"></span><span class="ovk-skel-lines"><span class="ovk-skel ovk-skel-l1"></span><span class="ovk-skel ovk-skel-l2"></span></span></div>',
            tile: '<span class="ovk-skel ovk-skel-tile"></span>',
            chip: '<span class="ovk-skel ovk-skel-chip"></span>',
            line: '<span class="ovk-skel ovk-skel-line"></span>',
            chat: '<div class="ovk-skel-chat"><span class="ovk-skel ovk-skel-dot"></span><span class="ovk-skel ovk-skel-l1"></span></div>',
            stat: '<div class="ovk-skel-stat"><span class="ovk-skel ovk-skel-num"></span><span class="ovk-skel ovk-skel-l2"></span></div>',
        }[kind] || '<span class="ovk-skel ovk-skel-line"></span>';
        return `<div class="ovk-skels ovk-skels-${esc(kind)}" role="status" aria-busy="true" aria-label="${esc(label)}">${one.repeat(n)}</div>`;
    }

    return {
        skeleton,
        esc, url, mediaW, icon, ICONS, PATHS, KIT_PATHS, when, hueOf, mark, button, share, askAgent, iconButton, action, badge, dot, card, rail, CARD_RATIO,
        head, pageHead, tabs, tabOf, list, row, section, fold, more, sidebar, sidebarButton, withSidebar,
        switchRow, rangeRow, selectRow, seg, segmented, chips, saveBar, find, dock, stats, labels, labelsAttr, LABEL_NAMES, empty, notice, snippet, sheet, sheetButton,
        enhance, VERSION: 2,
        num, steps, table, chart, rank, meter, drop, receipt, page,
        toolHead, toolInput, tries, answer, family, tool,
    };
});
