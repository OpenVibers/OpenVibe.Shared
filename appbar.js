/**
 * openvibe-shared/appbar.js — the phone app bar: a site's main places as a tab bar fixed at the bottom of the screen,
 * as in an app (the owner, 2026-10-28: "on a phone it should act like an app… one app ecosystem across all our
 * systems"). navbar.js loads this file only for a site that asks for it, and draws it again on every render, page move
 * and setActive(); it needs nothing else.
 *
 *   OpenVibeNavbar.init({ …, appBar: true })        the site's own links that carry an icon: the first four, and More
 *                                                   for the rest (it opens the navbar's drawer); five fit without More
 *   OpenVibeNavbar.init({ …, appBar: [{ label, href, icon, id, page, active, dot }] })   five at most
 *   OpenVibeNavbar.setAppBar(spec | false)          change it later (a single-page app's sections)
 *
 * It shows under 760 px only. html.ov-has-appbar and --ovnav-appbar-h keep the page's last lines above it (kit.css's
 * dock and save bar sit on it), and it steps aside while the keyboard is up or a panel is open. A link's icon is a
 * navbar icon name (fa-…), its dot a small red mark, the open page (its path, a path under it, or setActive's page)
 * a filled pill. Clicks go through the link's onClick and the site's onNavigate, as the navbar's own links do.
 */
(function (root) {
    'use strict';
    let barEl = null;
    let resizeBound = false;

    function spec(ctx) {
        const cfg = ctx.config.appBar;
        if (!cfg) return null;
        const path = (typeof location !== 'undefined' && location.pathname) || '/';
        const here = (l) => (l.active !== undefined ? !!l.active : ctx.activePage && l.page ? l.page === ctx.activePage
            : l.href === path || (l.href.length > 1 && l.href.startsWith('/') && path.startsWith(`${l.href.replace(/\/$/, '')}/`)));
        const usable = (l) => l && typeof l.href === 'string' && l.label && !l.hidden && !l.external;
        if (Array.isArray(cfg)) return { items: cfg.filter(usable).slice(0, 5).map((l) => Object.assign({}, l, { active: here(l) })), more: false };
        const all = ctx.links.filter(usable);
        const withIcon = all.filter((l) => l.icon);
        const items = withIcon.slice(0, withIcon.length > 5 || all.length > withIcon.length ? 4 : 5);
        return { items: items.map((l) => Object.assign({}, l, { active: here(l) })), more: all.length > items.length };
    }

    function styles() {
        if (document.getElementById('openvibe-appbar-styles')) return;
        const st = document.createElement('style');
        st.id = 'openvibe-appbar-styles';
        st.textContent = `
            .ovnav-appbar { display: none; }
            @media (max-width: 760px) {
                html.ov-has-appbar { --ovnav-appbar-h: calc(58px + env(safe-area-inset-bottom, 0px)); }
                html.ov-has-appbar body { padding-bottom: var(--ovnav-appbar-h); }
                .ovnav-appbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 9990; display: flex; align-items: stretch; height: var(--ovnav-appbar-h); box-sizing: border-box; padding: 0 4px env(safe-area-inset-bottom, 0px);
                    background: color-mix(in srgb, var(--bg-secondary, #121826) 90%, transparent); -webkit-backdrop-filter: saturate(1.5) blur(16px); backdrop-filter: saturate(1.5) blur(16px);
                    border-top: 1px solid var(--border, rgba(255,255,255,.1)); font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; transition: transform .2s ease; }
                .ovnav-appbar .ovnav-ab { all: unset; box-sizing: border-box; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; padding: 6px 2px; cursor: pointer;
                    color: var(--text-muted, #93a0b4); font-size: 12px; font-weight: 650; line-height: 1.1; text-align: center; -webkit-tap-highlight-color: transparent; }
                .ovnav-appbar .ovnav-ab:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: -4px; border-radius: 12px; }
                .ovnav-appbar .ovnav-ab.is-here { color: var(--text-primary, #e8ecf3); }
                .ovnav-appbar .ovnav-ab-ic { position: relative; display: grid; place-items: center; width: 52px; height: 28px; border-radius: 999px; font-size: 18px; transition: background .15s; }
                .ovnav-appbar .ovnav-ab.is-here .ovnav-ab-ic { color: var(--accent-light, var(--accent, #60a5fa)); }
                /* 4.70.0 (the owner, 2026-11-01: "improve the mobile button so it feels seamless and smooth"): one pill slides to the
                   tab you are on (the bar is kept between pages, so it can), a tap lights its tab at once, a press gives and the new
                   tab's icon pops. */
                .ovnav-appbar .ovnav-ab-pill { position: absolute; left: 0; top: 0; width: 52px; height: 28px; border-radius: 999px; background: color-mix(in srgb, var(--accent, #3b82f6) 22%, transparent); transform: translate(var(--ab-x, 0px), var(--ab-y, 6px)); transition: transform .42s cubic-bezier(.2,1.25,.3,1), opacity .2s; pointer-events: none; }
                .ovnav-appbar.ab-still .ovnav-ab-pill { transition: none; }
                .ovnav-appbar:not(:has(.is-here)) .ovnav-ab-pill { opacity: 0; }
                .ovnav-appbar .ovnav-ab { -webkit-tap-highlight-color: transparent; }
                .ovnav-appbar .ovnav-ab-ic, .ovnav-appbar .ovnav-ab-l { position: relative; transition: transform .2s cubic-bezier(.2,1.4,.3,1), color .2s; }
                .ovnav-appbar .ovnav-ab:active .ovnav-ab-ic { transform: scale(.88); }
                .ovnav-appbar .ovnav-ab.is-here .ovnav-ab-ic svg { animation: ovAbPop .45s cubic-bezier(.2,1.5,.3,1); }
                .ovnav-appbar .ovnav-ab.is-here .ovnav-ab-l { font-weight: 700; }
                @keyframes ovAbPop { 0% { transform: scale(.7); } 60% { transform: scale(1.12); } 100% { transform: scale(1); } }
                .ovnav-appbar .ovnav-ab-ic svg { width: 1em; height: 1em; }
                .ovnav-appbar .ovnav-ab-l { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .ovnav-appbar .ovnav-ab-dot { position: absolute; top: 2px; right: 12px; width: 8px; height: 8px; border-radius: 50%; background: var(--danger, #ef4444); box-shadow: 0 0 0 2px var(--bg-secondary, #121826); }
                html.ov-has-appbar:has(:is(input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select, [contenteditable="true"]):focus) { --ovnav-appbar-h: 0px; }
                html.ov-has-appbar:has(:is(input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select, [contenteditable="true"]):focus) .ovnav-appbar,
                body.ov-panel-open .ovnav-appbar { transform: translateY(110%); }
            }
            @media (prefers-reduced-motion: reduce) { .ovnav-appbar, .ovnav-appbar .ovnav-ab-ic, .ovnav-appbar .ovnav-ab-pill { transition: none; } .ovnav-appbar .ovnav-ab-ic svg { animation: none !important; } }
            @media print { .ovnav-appbar { display: none !important; } }`;
        document.head.appendChild(st);
    }

    /** Slide the pill under the lit tab's icon (the bar is its offset parent). */
    function placePill(bar, instant) {
        const pill = bar && bar.querySelector('.ovnav-ab-pill');
        const ic = bar && bar.querySelector('.ovnav-ab.is-here .ovnav-ab-ic');
        if (!pill || !ic) return;
        if (instant) bar.classList.add('ab-still');
        bar.style.setProperty('--ab-x', `${ic.offsetLeft + (ic.offsetWidth - 52) / 2}px`);
        bar.style.setProperty('--ab-y', `${ic.offsetTop}px`);
        const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f) => setTimeout(f, 16);
        if (instant) raf(() => raf(() => bar.classList.remove('ab-still')));
    }
    /** Light one tab (and only it), as the page it opens. */
    function light(bar, a) {
        bar.querySelectorAll('.ovnav-ab').forEach((t) => { const on = t === a; t.classList.toggle('is-here', on); if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
        placePill(bar);
    }
    const keyOf = (s) => s.items.map((l) => `${l.href}|${l.label}|${l.icon || ''}|${l.dot ? 1 : 0}`).join(',') + (s.more ? '+more' : '');

    /** Draw (or take away) the bar for the navbar's current state: { config, links, activePage, nav, navIcon, escapeAttr, escapeHtml, flatLinks }. */
    function render(ctx) {
        if (typeof document === 'undefined' || !document.body) return;
        const s = spec(ctx);
        const de = document.documentElement;
        // The same tabs as before: keep the bar (no flash, no jump) and move only what is lit, so the pill slides.
        if (barEl && barEl.isConnected && s && s.items.length >= 2 && barEl.getAttribute('data-ab-key') === keyOf(s)) {
            const tabs = barEl.querySelectorAll('a.ovnav-ab');
            const lit = s.items.findIndex((l) => l.active);
            light(barEl, lit >= 0 ? tabs[lit] : null);
            return;
        }
        if (barEl) { barEl.remove(); barEl = null; }
        if (!s || s.items.length < 2) { if (de && de.classList) de.classList.remove('ov-has-appbar'); return; }
        styles();
        const { navIcon, escapeAttr, escapeHtml } = ctx;
        const bar = document.createElement('nav');
        bar.className = 'ovnav-appbar';
        bar.setAttribute('aria-label', 'App');
        bar.setAttribute('data-ab-key', keyOf(s));
        bar.innerHTML = '<span class="ovnav-ab-pill" aria-hidden="true"></span>' + s.items.map((l) => `<a href="${escapeAttr(l.href)}" class="ovnav-ab${l.active ? ' is-here' : ''}"${l.active ? ' aria-current="page"' : ''}${l.id ? ` data-link-id="${escapeAttr(l.id)}"` : ''}${l.page ? ` data-page="${escapeAttr(l.page)}"` : ''}><span class="ovnav-ab-ic">${navIcon(l.icon || 'fa-circle')}${l.dot ? '<span class="ovnav-ab-dot" aria-label="new"></span>' : ''}</span><span class="ovnav-ab-l">${escapeHtml(l.label)}</span></a>`).join('')
            + (s.more ? `<button type="button" class="ovnav-ab" data-ab-more aria-haspopup="true"><span class="ovnav-ab-ic">${navIcon('fa-bars')}</span><span class="ovnav-ab-l">More</span></button>` : '');
        bar.addEventListener('click', (e) => {
            if (e.target.closest && e.target.closest('[data-ab-more]')) {
                e.preventDefault(); e.stopPropagation();
                const b = ctx.nav && ctx.nav.querySelector('#openvibe-burger'); if (b) b.click();
                return;
            }
            const a = e.target.closest && e.target.closest('a.ovnav-ab');
            if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            light(bar, a);
            const id = a.getAttribute('data-link-id');
            const item = id ? ctx.flatLinks(ctx.links).concat(Array.isArray(ctx.config.appBar) ? ctx.config.appBar : []).find((l) => l && l.id === id) : null;
            if (item && typeof item.onClick === 'function' && item.onClick(e) === false) e.preventDefault();
            if (e.defaultPrevented) return;
            if (typeof ctx.config.onNavigate === 'function') {
                let same = false; try { same = new URL(a.href, location.href).origin === location.origin; } catch { /* */ }
                if (same && ctx.config.onNavigate((() => { try { const u = new URL(a.href, location.href); return `${u.pathname}${u.search}${u.hash}`; } catch { return a.getAttribute('href'); } })(), e) === false) e.preventDefault();
            }
        });
        document.body.appendChild(bar);
        barEl = bar;
        if (de && de.classList) de.classList.add('ov-has-appbar');
        placePill(bar, true);
        if (!resizeBound && typeof window !== 'undefined' && typeof window.addEventListener === 'function') { resizeBound = true; window.addEventListener('resize', () => placePill(barEl, true)); }
    }

    const api = { render, spec };
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.OpenVibeAppBar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
