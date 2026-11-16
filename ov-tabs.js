/**
 * openvibe-shared/ov-tabs.js — one tab bar for every site (4.284.0; the owner, 11-16: "the tabs … Messages, Friends, Global
 * … should have like a nice animation effect … reusable, and update openvibe.design for this type of tab system, so it's
 * nice and animated and considers theme").
 *
 *   OVTabs.ink(list, { selector, kind, key }) → { update(), destroy() }
 *     list       the element holding the tabs (role="tablist" or any row)
 *     selector   which children are tabs (default [role="tab"]); the chosen one has aria-selected="true"
 *     kind       'pill' (default: a raised pill behind the chosen tab) or 'line' (an accent line under it)
 *     key        a name for the bar: a page that draws its bar again (a panel that rebuilds on every switch) gets the ink
 *                gliding from where it last was, not jumping
 *
 * The list keeps its markup, its clicks and its keys; this adds one ink element behind the tabs and moves it when
 * aria-selected changes (a MutationObserver) or the row resizes. The ink is drawn in the theme's tokens (--bg-elevated,
 * --accent); a site can name its own with --ovtb-ink and --ovtb-edge. It glides with a little overshoot, shorter under
 * Calm, and jumps under Off (html[data-ov-motion]).
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OVTabs) return;
    let styled = false;
    function styles() {
        if (styled || document.getElementById('ovtb-styles')) { styled = true; return; }
        styled = true;
        const s = document.createElement('style');
        s.id = 'ovtb-styles';
        s.textContent = '.ovtb{position:relative;isolation:isolate}'
            + '.ovtb-ink{position:absolute;left:0;top:0;z-index:-1;pointer-events:none;opacity:0;border-radius:12px;will-change:transform,width;'
            + 'background:var(--ovtb-ink,var(--bg-elevated,color-mix(in srgb,var(--text-primary,#ececf1) 11%,transparent)));'
            + 'box-shadow:0 0 0 1px var(--ovtb-edge,color-mix(in srgb,var(--accent,#3b82f6) 34%,transparent)),0 8px 20px -12px color-mix(in srgb,var(--accent,#3b82f6) 70%,transparent);'
            + 'transition:transform .44s cubic-bezier(.2,.9,.25,1.14),width .44s cubic-bezier(.2,.9,.25,1.14),height .3s ease,opacity .2s ease}'
            + '.ovtb-line .ovtb-ink{border-radius:3px;background:var(--ovtb-edge,var(--accent,#3b82f6));box-shadow:0 0 12px color-mix(in srgb,var(--accent,#3b82f6) 55%,transparent)}'
            + '.ovtb.ovtb-pill > [aria-selected="true"]{background:transparent!important;box-shadow:none!important}'
            + 'html[data-ov-motion=calm] .ovtb-ink{transition-duration:.26s,.26s,.2s,.15s}'
            + 'html[data-ov-motion=off] .ovtb-ink{transition:none}';
        document.head.appendChild(s);
    }
    const memo = new Map();   // key → where the ink last was { x, y, w, h }

    function ink(list, o = {}) {
        if (!list || !list.isConnected && !list.parentNode) return null;
        styles();
        const sel = o.selector || '[role="tab"]';
        const line = o.kind === 'line';
        list.classList.add('ovtb', line ? 'ovtb-line' : 'ovtb-pill');
        let bar = list.querySelector(':scope > .ovtb-ink');
        if (!bar) { bar = document.createElement('span'); bar.className = 'ovtb-ink'; bar.setAttribute('aria-hidden', 'true'); list.prepend(bar); }
        const key = o.key ? String(o.key) : '';
        const put = (b, animate) => {
            if (!animate) bar.style.transition = 'none';
            bar.style.width = `${b.w}px`; bar.style.height = `${b.h}px`;
            bar.style.transform = `translate(${b.x}px, ${b.y}px)`; bar.style.opacity = '1';
            if (!animate) { void bar.offsetWidth; bar.style.transition = ''; }
        };
        const where = () => {
            const on = list.querySelector(`${sel}[aria-selected="true"]`);
            if (!on || !on.offsetParent) return null;
            const lr = list.getBoundingClientRect(), r = on.getBoundingClientRect();
            const x = r.left - lr.left - list.clientLeft + list.scrollLeft;
            const y = r.top - lr.top - list.clientTop + list.scrollTop;
            return line ? { x: x + 10, y: y + r.height - 3, w: Math.max(12, r.width - 20), h: 3 } : { x, y, w: r.width, h: r.height };
        };
        const place = (animate) => {
            const b = where();
            if (!b) { bar.style.opacity = '0'; return; }
            put(b, animate);
            if (key) memo.set(key, b);
        };
        // Drawn again: start where the ink last was, then glide to the chosen tab.
        const was = key ? memo.get(key) : null;
        if (was) { put(was, false); requestAnimationFrame(() => requestAnimationFrame(() => place(true))); }
        else requestAnimationFrame(() => place(false));
        let tick = 0;
        const soon = () => { if (!tick) tick = requestAnimationFrame(() => { tick = 0; place(true); }); };
        const mo = typeof MutationObserver === 'function' ? new MutationObserver(soon) : null;
        if (mo) mo.observe(list, { subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
        const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => place(false)) : null;
        if (ro) ro.observe(list);
        list.addEventListener('scroll', soon, { passive: true });
        return { update: () => place(true), destroy() { if (mo) mo.disconnect(); if (ro) ro.disconnect(); bar.remove(); list.classList.remove('ovtb', 'ovtb-line', 'ovtb-pill'); } };
    }

    root.OVTabs = { ink };
})(typeof window !== 'undefined' ? window : globalThis);
