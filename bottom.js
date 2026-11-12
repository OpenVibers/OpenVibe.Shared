/**
 * openvibe-shared/bottom.js — the bottom of the screen, measured once for everything docked there.
 *
 * The owner, 2026-11-10 (plan 279): "That fixed bottom position is kind of buggy … as you scroll up and down,
 * so let's make that nice and smooth and perfect across all sites." A phone's visible viewport is not its layout
 * viewport: the browser's toolbar slides away, a keyboard opens, an orientation turns. A bar placed at bottom: 0
 * of the layout viewport is then somewhere behind the thing the person is looking at. This file measures the one
 * number every bottom-docked part needs and writes it where CSS can use it:
 *
 *   --ovb-lift    px between the bottom of the layout viewport and the bottom of the visible (visual) viewport;
 *                 the bar, the small player and the composer move up by it with `translate`
 *                 (a paint, never layout).
 *   --ovb-vh      the visible viewport's height in px (for a surface that must fit it), measured, never 100dvh.
 *   --ovb-bar     the app bar's height while it is on screen, measured from the bar itself (0 when it is away).
 *   --ovb-mini    the small player's height plus its 8 px gap, while it is the full-width bar on a phone.
 *   --ovb-base    max(--ovb-bar, safe-area-inset-bottom): where the first docked part starts.
 *   --ovb-dock    --ovb-base + --ovb-mini: how far anything above all of them sits from the bottom edge.
 *
 * One stacking order, written here only (the bottom of the screen, low to high):
 *   1. the app bar            --ovb-z-bar    9990
 *   2. the small player       --ovb-z-mini   9991
 *   Above them belong sheets (10060), the notification panel (99999), toasts and notices (2147483000+).
 *
 * navbar.js loads this before the bar, the Dock and the player draw. It is safe without it: every rule that uses
 * these variables has its old value as the fallback, so a page whose bottom.js did not arrive keeps the bar it had.
 *
 *   OpenVibeBottom.measure()   measure now (a page that changed its own bottom calls it)
 *   OpenVibeBottom.lift()      the current lift in px
 *   OpenVibeBottom.height()    the visible viewport's height in px
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || !document.documentElement || root.OpenVibeBottom) return;
    const html = document.documentElement;
    let raf = 0;
    let observer = null;
    let resize = null;
    let watched = [];

    function styles() {
        if (document.getElementById('ovb-styles')) return;
        const st = document.createElement('style');
        st.id = 'ovb-styles';
        st.textContent = `:root {
    --ovb-lift: 0px;
    --ovb-bar: 0px;
    --ovb-mini: 0px;
    --ovb-base: max(var(--ovb-bar, 0px), env(safe-area-inset-bottom, 0px));
    --ovb-dock: calc(var(--ovb-base) + var(--ovb-mini, 0px));
    --ovb-z-bar: 9990;
    --ovb-z-mini: 9991;
}
.ovnav-appbar, .ovmini { will-change: translate; }`;
        (document.head || html).appendChild(st);
    }

    const px = (n) => `${Math.round(n * 100) / 100}px`;
    // A page's own composer docked at the bottom moves up with the toolbar like the bar does.
    const COMPOSERS = 'form[data-ovt-composer], [data-ov-bottom-dock]';

    /** The height of an element that is actually on screen (a bar hidden under the page is not). */
    function onScreen(el) {
        if (!el) return 0;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
        const r = el.getBoundingClientRect();
        if (!r.height || r.bottom <= 0 || r.top >= root.innerHeight) return 0;
        return r.height;
    }

    function measure() {
        raf = 0;
        const vv = root.visualViewport;
        const vh = vv ? vv.height : root.innerHeight;
        const top = vv ? vv.offsetTop : 0;
        const lift = Math.max(0, root.innerHeight - (top + vh));
        html.style.setProperty('--ovb-lift', px(lift));
        // A visible height of 0 happens between two documents; keep the last real one.
        if (vh > 0) html.style.setProperty('--ovb-vh', px(vh));
        const bar = onScreen(document.querySelector('.ovnav-appbar'));
        html.style.setProperty('--ovb-bar', px(bar));
        let mini = 0;
        try {
            if (root.matchMedia && root.matchMedia('(max-width: 640px)').matches) {
                const m = onScreen(document.querySelector('.ovmini:not(.is-leaving)'));
                if (m) mini = m + 8;      // its 8 px above the bar
            }
        } catch { /* no matchMedia: no full-width small player to stack */ }
        html.style.setProperty('--ovb-mini', px(mini));
    }

    const later = () => { if (!raf) raf = requestAnimationFrame(measure); };

    /** Watch the parts that are added to the page after this file, and their size changes. */
    function watch() {
        const parts = [...document.querySelectorAll(`.ovnav-appbar, .ovmini, ${COMPOSERS}`)];
        if (resize) { resize.disconnect(); watched = []; }
        else if (typeof ResizeObserver === 'function') resize = new ResizeObserver(later);
        if (!resize) return;
        for (const el of parts) { try { resize.observe(el); watched.push(el); } catch { /* */ } }
        measure();
    }

    function start() {
        styles();
        const vv = root.visualViewport;
        if (vv && vv.addEventListener) { vv.addEventListener('resize', later); vv.addEventListener('scroll', later); }
        root.addEventListener('resize', later);
        root.addEventListener('orientationchange', later);
        root.addEventListener('load', later);
        document.addEventListener('visibilitychange', later);
        if (typeof MutationObserver === 'function' && document.body) {
            observer = new MutationObserver((records) => {
                let parts = false;
                for (const r of records) {
                    const sel = `.ovnav-appbar, .ovmini, ${COMPOSERS}`;
                    if (r.target && r.target.closest && r.target.closest(sel)) { parts = true; break; }
                    for (const n of [...r.addedNodes, ...r.removedNodes]) {
                        if (n.nodeType === 1 && (n.matches(sel) || n.querySelector(sel))) { parts = true; break; }
                    }
                    if (parts) break;
                }
                if (parts) watch();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
        watch();
        setTimeout(measure, 300);      // fonts, a late app bar, a small player opened by the page
    }

    root.OpenVibeBottom = {
        measure,
        refresh: later,
        lift: () => { const n = parseFloat(html.style.getPropertyValue('--ovb-lift')); return Number.isFinite(n) ? n : 0; },
        height: () => { const vv = root.visualViewport; return vv ? vv.height : root.innerHeight; },
        _stop: () => { if (observer) observer.disconnect(); if (resize) resize.disconnect(); },
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
    if (typeof module === 'object' && module.exports) module.exports = root.OpenVibeBottom;
})(typeof globalThis !== 'undefined' ? globalThis : this);
