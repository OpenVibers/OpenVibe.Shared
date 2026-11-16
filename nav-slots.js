/**
 * nav-slots.js (openvibe-shared 4.160.0): a site's own buttons in the navbar, drawn here so the bar stays small. The
 * navbar loads this the first time a site calls OpenVibeNavbar.lead(spec) or .action(spec) and calls paint() after each
 * render. Known icons by name, or 24-unit path data (letters, numbers and path commands only: no markup from a site).
 */
(function (root) {
    'use strict';
    const CSS = `.openvibe-navbar .ovnav-slot { all: unset; box-sizing: border-box; position: relative; display: inline-grid; place-items: center; flex: none; width: 34px; height: 34px; border-radius: 11px; cursor: pointer; color: var(--text-secondary, #a8b3c4); transition: background-color .15s, color .15s, transform .18s cubic-bezier(.2, 1.4, .3, 1); }
.openvibe-navbar .ovnav-slot:hover, .openvibe-navbar .ovnav-slot:focus-visible { background: var(--accent-glow, rgba(59,130,246,.14)); color: var(--text-primary, #e6edf7); }
.openvibe-navbar .ovnav-slot:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 1px; }
.openvibe-navbar .ovnav-slot:active { transform: scale(.9); }
.openvibe-navbar .ovnav-slot[aria-expanded="true"], .openvibe-navbar .ovnav-slot[aria-pressed="true"] { color: var(--accent-light, #60a5fa); background: var(--accent-glow, rgba(59,130,246,.14)); }
.openvibe-navbar .ovnav-slot svg { width: 21px; height: 21px; }
.openvibe-navbar .ovnav-slot b { position: absolute; top: -1px; right: -3px; min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box; border-radius: 999px; background: color-mix(in srgb, var(--live-red, #ef4444), #000 20%); color: #fff; font: 700 10px/16px Inter, system-ui, sans-serif; text-align: center; box-shadow: 0 0 0 2px var(--bg-secondary, #111826); }
.openvibe-navbar .ovnav-slot b:empty { display: none; }
.openvibe-navbar .ovnav-lead { margin-left: -2px; animation: ovnav-slot-in .22s cubic-bezier(.2, .9, .3, 1) both; }
@keyframes ovnav-slot-in { from { opacity: 0; transform: translateX(calc(-6px * var(--ov-move, 1))); } }
.openvibe-navbar .ovnav-slot { transition: transform .14s cubic-bezier(.2, .9, .3, 1), background-color .2s, color .2s; }
/* 4.285.0: the sidebar icon says whether its panel is open: the pane inside the frame fills in from the left and the
   divider settles beside it, closing the other way (the owner, 11-16: "better animations and effects"). */
.openvibe-navbar .ovnav-sb-pane { transform-box: fill-box; transform-origin: 0 50%; transform: scaleX(0); opacity: 0; transition: transform .34s cubic-bezier(.2, .9, .3, 1), opacity .22s ease; }
.openvibe-navbar .ovnav-sb-line { transform-box: fill-box; transition: transform .34s cubic-bezier(.2, .9, .3, 1); transform: translateX(calc(-1.5px * var(--ov-move, 1))); }
.openvibe-navbar .ovnav-slot[aria-expanded="true"] .ovnav-sb-pane { transform: scaleX(1); opacity: .42; }
.openvibe-navbar .ovnav-slot[aria-expanded="true"] .ovnav-sb-line { transform: none; }
.openvibe-navbar .ovnav-slot b.is-new { animation: ovnav-badge-pop .42s cubic-bezier(.2, 1.4, .4, 1) both; }
@keyframes ovnav-badge-pop { 0% { transform: scale(.4); } 60% { transform: scale(1.18); } 100% { transform: none; } }
html[data-ov-motion="off"] .openvibe-navbar .ovnav-slot, html[data-ov-motion="off"] .openvibe-navbar .ovnav-slot * { transition: none !important; animation: none !important; }
@media (max-width: 400px) { .openvibe-navbar .ovnav-slot { width: 32px; height: 32px; } }
/* 347: the site's own buttons match the menu button on the right: its size, its corner, its stroke. */
@media (min-width: 761px) { .openvibe-navbar .ovnav-slot.ovnav-phone-only { display: none; } }`;
    const SLOT_ICONS = {
        sidebar: 'M4 5.5h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1zM9.5 5.5v13',
        back: 'M15 5l-7 7 7 7',
        close: 'M6 6l12 12M18 6L6 18',
        plus: 'M12 5v14M5 12h14',
        search: 'M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5L20 20',
        settings: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7',
        filter: 'M4 6h16M7 12h10M10 18h4',
        share: 'M12 15V4M8 8l4-4 4 4M5 13v6h14v-6',
        star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z',
        info: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v5.5M12 7.6v.4',
    };
    const PATH_OK = /^[MmLlHhVvCcSsQqTtAaZz0-9 ,.\-]{1,2000}$/;
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function html(spec, cls, id) {
        const label = esc(spec.label || 'Menu');
        const ctl = spec.sidebar || spec.controls;
        const state = (spec.sidebar ? ' data-ovk-sidebar-open' : '') + (ctl ? ` aria-controls="${esc(ctl)}" aria-expanded="${spec.expanded ? 'true' : 'false'}"` : spec.pressed != null ? ` aria-pressed="${spec.pressed ? 'true' : 'false'}"` : '');
        if (spec.phoneOnly) cls += ' ovnav-phone-only';
        const svg = iconSvg(spec);
        const badge = spec.badge != null ? `<b>${esc(String(spec.badge).slice(0, 3))}</b>` : '';
        const href = spec.href && /^(https?:\/\/|\/)/.test(String(spec.href)) ? spec.href : null;
        const key = ` data-ov-icon="${esc(iconKey(spec))}"`;
        return href ? `<a class="ovnav-slot ${cls}" id="${esc(id)}" href="${esc(href)}" aria-label="${label}" title="${label}"${state}${key}>${svg}${badge}</a>`
            : `<button type="button" class="ovnav-slot ${cls}" id="${esc(id)}" aria-label="${label}" title="${label}"${state}${key}>${svg}${badge}</button>`;
    }
    const SVG_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    /** The icon: a site's path, or a known one; the sidebar is drawn in parts so its open state can move. */
    function iconSvg(spec) {
        if (!(spec.path && PATH_OK.test(spec.path)) && (spec.icon === 'sidebar' || (!spec.icon && spec.sidebar))) {
            return SVG_OPEN + '<rect x="3" y="5.5" width="18" height="13" rx="1.6"/><rect class="ovnav-sb-pane" x="4.7" y="7.2" width="4" height="9.6" rx=".7" fill="currentColor" stroke="none"/><path class="ovnav-sb-line" d="M9.5 5.5v13"/></svg>';
        }
        const d = spec.path && PATH_OK.test(spec.path) ? spec.path : SLOT_ICONS[spec.icon] || SLOT_ICONS.info;
        return `${SVG_OPEN}<path d="${d}"/></svg>`;
    }
    const iconKey = (spec) => (spec.path && PATH_OK.test(spec.path) ? `p:${spec.path}` : `i:${spec.icon || (spec.sidebar ? 'sidebar' : 'info')}`);
    const fromHtml = (markup) => { const t = document.createElement('template'); t.innerHTML = markup; return t.content.firstElementChild; };

    /** Bring a drawn slot up to date where it stands, so its transitions run and focus stays on it; false when it has to
        be drawn again (a link became a button, or the other way). */
    function sync(el, spec, cls, id) {
        const href = spec.href && /^(https?:\/\/|\/)/.test(String(spec.href)) ? spec.href : null;
        if (!el || (href ? el.tagName !== 'A' : el.tagName !== 'BUTTON')) return false;
        const fresh = fromHtml(html(spec, cls, id));
        for (const name of ['class', 'aria-label', 'title', 'aria-controls', 'aria-expanded', 'aria-pressed', 'href', 'data-ovk-sidebar-open']) {
            const v = fresh.getAttribute(name);
            if (v == null) el.removeAttribute(name); else if (el.getAttribute(name) !== v) el.setAttribute(name, v);
        }
        if (el.getAttribute('data-ov-icon') !== iconKey(spec)) { const svg = el.querySelector('svg'); if (svg) svg.outerHTML = iconSvg(spec); el.setAttribute('data-ov-icon', iconKey(spec)); }
        const want = fresh.querySelector('b'); const have = el.querySelector('b');
        if (!want && have) have.remove();
        else if (want && !have) { want.classList.add('is-new'); el.append(want); }
        else if (want && have && have.textContent !== want.textContent) { have.textContent = want.textContent; have.classList.remove('is-new'); void have.offsetWidth; have.classList.add('is-new'); }
        return true;
    }

    /** Draw the lead button before the brand and the actions where the bell was (before the picture or Sign in);
        clicks go to the site's handlers. */
    function paint(nav, lead, actions) {
        if (!nav || !nav.querySelector) return;
        if (!document.getElementById('ovnav-slots-styles')) { const st = document.createElement('style'); st.id = 'ovnav-slots-styles'; st.textContent = CSS; document.head.appendChild(st); }
        const brand = nav.querySelector('.openvibe-navbar-brand');
        // The bar's bell is gone (437): its mount is kept as an anchor when a page still draws one, else the actions
        // sit before the picture (signed in) or Sign in, so a site's buttons stay on the bar's right.
        const anchor = nav.querySelector('#openvibe-bell-mount') || nav.querySelector('.ovnav-avatar-wrap, #openvibe-login-btn');
        const want = new Map();
        if (lead && brand) want.set('ovnav-lead', { spec: lead, cls: 'ovnav-lead' });
        if (anchor && actions) for (const a of actions.values()) want.set(`ovnav-act-${a.id}`, { spec: a, cls: 'ovnav-act' });
        nav.querySelectorAll('.ovnav-slot').forEach((el) => { if (!want.has(el.id)) el.remove(); });
        // 4.285.0: a slot that is already drawn is updated where it stands (its open state animates, focus stays on it).
        for (const [id, w] of want) {
            const el = nav.querySelector(`#${id}`);
            if (sync(el, w.spec, w.cls, id)) continue;
            const markup = html(w.spec, w.cls, id);
            if (el) el.outerHTML = markup;
            else if (id === 'ovnav-lead') brand.insertAdjacentHTML('afterbegin', markup);
            else anchor.insertAdjacentHTML('beforebegin', markup);
        }
        nav.__ovSlots = { lead, actions };
        if (nav.__ovSlotsBound) return;
        nav.__ovSlotsBound = true;
        nav.addEventListener('click', (e) => {
            const b = e.target && e.target.closest ? e.target.closest('.ovnav-slot') : null;
            if (!b || !nav.__ovSlots) return;
            const s = b.id === 'ovnav-lead' ? nav.__ovSlots.lead : nav.__ovSlots.actions.get(b.id.replace(/^ovnav-act-/, ''));
            if (s && typeof s.onClick === 'function') { if (!s.href) e.preventDefault(); try { s.onClick(e, b); } catch (err) { console.error(err); } }
        });
    }
    root.OpenVibeNavSlots = { paint, icons: Object.keys(SLOT_ICONS) };
})(typeof window !== 'undefined' ? window : globalThis);
