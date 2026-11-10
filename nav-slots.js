/**
 * nav-slots.js (openvibe-shared 4.160.0): a site's own buttons in the navbar, drawn here so the bar stays small. The
 * navbar loads this the first time a site calls OpenVibeNavbar.lead(spec) or .action(spec) and calls paint() after each
 * render. Known icons by name, or 24-unit path data (letters, numbers and path commands only: no markup from a site).
 */
(function (root) {
    'use strict';
    const CSS = `.openvibe-navbar .ovnav-slot { all: unset; box-sizing: border-box; position: relative; display: inline-grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 11px; cursor: pointer; color: var(--text-secondary, #a8b3c4); transition: background-color .15s, color .15s, transform .18s cubic-bezier(.2, 1.4, .3, 1); }
.openvibe-navbar .ovnav-slot:hover, .openvibe-navbar .ovnav-slot:focus-visible { background: var(--accent-glow, rgba(59,130,246,.14)); color: var(--text-primary, #e6edf7); }
.openvibe-navbar .ovnav-slot:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 1px; }
.openvibe-navbar .ovnav-slot:active { transform: scale(.9); }
.openvibe-navbar .ovnav-slot[aria-expanded="true"], .openvibe-navbar .ovnav-slot[aria-pressed="true"] { color: var(--accent-light, #60a5fa); background: var(--accent-glow, rgba(59,130,246,.14)); }
.openvibe-navbar .ovnav-slot svg { width: 22px; height: 22px; }
.openvibe-navbar .ovnav-slot b { position: absolute; top: -1px; right: -3px; min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box; border-radius: 999px; background: var(--live-red, #ef4444); color: #fff; font: 700 10px/16px Inter, system-ui, sans-serif; text-align: center; box-shadow: 0 0 0 2px var(--bg-secondary, #111826); }
.openvibe-navbar .ovnav-slot b:empty { display: none; }
.openvibe-navbar .ovnav-lead { margin-left: -6px; animation: ovnav-slot-in .22s cubic-bezier(.2, .9, .3, 1) both; }
@keyframes ovnav-slot-in { from { opacity: 0; transform: translateX(-6px); } }
@media (max-width: 400px) { .openvibe-navbar .ovnav-slot { width: 32px; height: 32px; } }
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
        const d = spec.path && PATH_OK.test(spec.path) ? spec.path : SLOT_ICONS[spec.icon] || SLOT_ICONS.info;
        const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
        const badge = spec.badge != null ? `<b>${esc(String(spec.badge).slice(0, 3))}</b>` : '';
        const href = spec.href && /^(https?:\/\/|\/)/.test(String(spec.href)) ? spec.href : null;
        return href ? `<a class="ovnav-slot ${cls}" id="${esc(id)}" href="${esc(href)}" aria-label="${label}" title="${label}"${state}>${svg}${badge}</a>`
            : `<button type="button" class="ovnav-slot ${cls}" id="${esc(id)}" aria-label="${label}" title="${label}"${state}>${svg}${badge}</button>`;
    }
    /** Draw the lead button before the brand and the actions before the bell; clicks go to the site's handlers. */
    function paint(nav, lead, actions) {
        if (!nav || !nav.querySelector) return;
        if (!document.getElementById('ovnav-slots-styles')) { const st = document.createElement('style'); st.id = 'ovnav-slots-styles'; st.textContent = CSS; document.head.appendChild(st); }
        nav.querySelectorAll('.ovnav-slot').forEach((el) => el.remove());
        const brand = nav.querySelector('.openvibe-navbar-brand');
        if (lead && brand) brand.insertAdjacentHTML('afterbegin', html(lead, 'ovnav-lead', 'ovnav-lead'));
        const bell = nav.querySelector('#openvibe-bell-mount');
        if (bell && actions) for (const a of actions.values()) bell.insertAdjacentHTML('beforebegin', html(a, 'ovnav-act', `ovnav-act-${a.id}`));
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
