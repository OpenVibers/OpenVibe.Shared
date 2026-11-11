/*
 * openvibe-shared/soft.js — the small, safe part of "soft pages": the next page is already fetched on intent, the
 * shared bar stays still while the page cross-fades, and the navbar's mark draws "a page on its way" from the press.
 *
 *   <script src="/shared/soft.js"></script>          in <head>, after theme-loader.js, not deferred
 *
 * The script has to run before the arriving page first renders, or that page cannot take part in the cross-document
 * transition; a deferred copy still opts the *next* move in. It re-appends its one <style> at DOMContentLoaded so it
 * wins the cascade over kit.css.
 *
 * It adds only what is safe on every site today:
 *
 *   • Prefetch on intent: pointer down, or 80 ms of hover on a computer, for a same-site link. Never on a data saver
 *     or a 2G/3G connection, at most four in flight, and never sign-in/out, auth/API, downloads, query URLs, in-page
 *     anchors or data-ov-no-prefetch (see research/soft-pages.md, 2026-11-10). Speculation Rules cover the press in
 *     Chrome/Edge (conservative, prefetch only); the hover and the other browsers use <link rel=prefetch>.
 *     No prerender: our navbar's page-view beacon (countView) and visit record (recordVisit) do not defer under
 *     document.prerendering, and signed-in pages can be stale when a hidden prerender is activated.
 *   • The navbar's mark: OVMark.navStart('page') on the press, and navEnd('page') on the next page's first paint, so
 *     the ring is already drawing while the click is still on its way. It leaves a site without the mark alone.
 *   • Cross-document view transitions: the bar mount is named and held still, the rest of the page cross-fades. Calm
 *     (data-ov-motion=reduced) is shorter; Off gets no transition. A browser without CSSViewTransitionRule gets no
 *     transition styles and no error.
 *   • window.OpenVibeSoft = { on(), off(), exclude(selector) }.
 *
 * If a page already has its own <script type="speculationrules"> (the navbar adds one), soft.js leaves the rules to
 * it rather than adding a second set. The navbar sees these rules first and skips its own, so loading soft.js early
 * also turns off the navbar's default prerender.
 */
(function (root) {
    'use strict';
    if (!root || typeof document === 'undefined' || root.OpenVibeSoft) return;
    const doc = document;
    const html = doc.documentElement;
    const STYLE_ID = 'ov-soft-css';
    const RULES_ID = 'ov-soft-rules';
    const NAV_KEY = 'ov-soft-press';
    const SELF = doc.currentScript || null;
    const state = { on: true, exclude: [] };
    const MAX_PREFETCH = 4, HOVER_MS = 80;
    const prefetched = new Set();      // URLs already asked for on this page (never ask twice)
    const inflight = new Map();        // URL -> link, only while the fetch is on its way
    let hoverTimer = 0, hoverLink = null, pressedLink = null, navTimer = 0;

    const supportsRules = () => {
        try { return typeof HTMLScriptElement !== 'undefined' && !!HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules'); } catch { return false; }
    };
    // The cross-document feature, not just startViewTransition (Firefox 144 has same-document transitions only).
    const supportsTransitions = () => typeof root.CSSViewTransitionRule !== 'undefined';
    // theme-loader.js's one signal: full | reduced (Calm) | off; without it, ask the device. Calm only shortens.
    function motion() {
        const m = html && html.getAttribute ? html.getAttribute('data-ov-motion') : null;
        if (m === 'off') return 'off';
        if (m === 'reduced') return 'calm';
        if (m === 'full') return 'full';
        try { return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'calm' : 'full'; } catch { return 'full'; }
    }

    // A data saver or a slow mobile connection never gets a speculative fetch: the page would arrive either way.
    function frugal() {
        let c = null;
        try { c = (root.navigator && (root.navigator.connection || root.navigator.mozConnection || root.navigator.webkitConnection)) || null; } catch { c = null; }
        if (!c) return false;
        if (c.saveData) return true;
        return /(^|-)[23]g$/.test(String(c.effectiveType || ''));
    }
    // Hover is a computer's signal; a finger's pointerdown is handled everywhere.
    function finePointer() {
        try { return !!(root.matchMedia && root.matchMedia('(hover: hover) and (pointer: fine)').matches); } catch { return false; }
    }

    // The links a prefetch is never worth making: sign-in/out and auth (they can send mail, set a CSRF cookie or sign
    // someone out), the API, downloads, query URLs (a server-rendered state change often hides in a query), in-page
    // anchors, and anything the page marks with data-ov-no-prefetch (or the navbar's data-no-prefetch).
    const DENY_PATHS = [
        '/auth/*', '/api/*', '/internal/*', '/oauth/*', '/sso/*',
        '/login*', '/*login*', '/signin*', '/*signin*', '/sign-in*', '/*sign-in*',
        '/signup*', '/*signup*', '/sign-up*', '/*sign-up*', '/register*', '/*register*',
        '/logout*', '/*logout*', '/signout*', '/*signout*', '/sign-out*', '/*sign-out*',
        '/verify*', '/*verify*', '/reset*', '/*reset*',
        '/*.pdf', '/*.zip', '/*.gz', '/*.tgz', '/*.tar', '/*.7z', '/*.rar', '/*.dmg', '/*.exe', '/*.apk', '/*.iso',
        '/*.png', '/*.jpg', '/*.jpeg', '/*.gif', '/*.webp', '/*.avif', '/*.svg',
        '/*.mp4', '/*.webm', '/*.mov', '/*.mp3', '/*.wav', '/*.ogg', '/*.m4a',
        '/*.doc', '/*.docx', '/*.xls', '/*.xlsx', '/*.ppt', '/*.pptx',
        '/*.csv', '/*.ics', '/*.json', '/*.xml',
    ];
    const DENY_SELECTOR = '[data-ov-no-prefetch], [data-no-prefetch], [download], [rel~=nofollow], [target=_blank], [href*="?"], [href^="#"], [data-method], [data-turbo-method]';
    const globCache = {};
    const glob = (p) => globCache[p] || (globCache[p] = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'));
    const deniedPath = (path) => DENY_PATHS.some((p) => glob(p).test(path));

    function ruleSpec() {
        const where = {
            and: [
                { href_matches: '/*' },
                { not: { href_matches: DENY_PATHS } },
                { not: { selector_matches: DENY_SELECTOR } },
            ],
        };
        for (const selector of state.exclude) where.and.push({ not: { selector_matches: selector } });
        // conservative is a pointerdown: the same "on intent" the intent prefetcher uses. Hover is the explicit 80 ms
        // below, so Chrome does not fetch every link that scrolls into view.
        const rules = { prefetch: [{ where, eagerness: 'conservative' }] };
        // The navbar's cross-site warm-up for another OpenVibe site (navbar.js's [data-ov-net-link] rule): soft.js owns
        // the rule set when it runs first, so keep that prefetch instead of silently losing it. The browser itself only
        // prefetches a cross-site URL when the person has no cookies on the destination.
        const crossSite = { and: [{ selector_matches: '[data-ov-net-link]' }, { not: { selector_matches: DENY_SELECTOR } }] };
        for (const selector of state.exclude) crossSite.and.push({ not: { selector_matches: selector } });
        rules.prefetch.push({ where: crossSite, eagerness: 'moderate' });
        return rules;
    }

    const nonce = () => {
        if (SELF && SELF.nonce) return SELF.nonce;
        try { return [].slice.call(doc.scripts || []).map((s) => s.nonce).find(Boolean) || ''; } catch { return ''; }
    };

    const ownRules = () => doc.getElementById(RULES_ID);
    const otherRules = () => doc.querySelector('script[type="speculationrules"]:not(#' + RULES_ID + ')');
    function dropRules() { const el = ownRules(); if (el && el.remove) el.remove(); }

    function applyRules() {
        if (!state.on || !supportsRules() || frugal()) return dropRules();
        // Someone else owns the rule set (the navbar, an inline block, a header): do not add a competing one.
        if (otherRules()) return dropRules();
        dropRules();
        try {
            const script = doc.createElement('script');
            script.type = 'speculationrules';
            script.id = RULES_ID;
            const n = nonce();
            if (n) script.nonce = n;
            script.textContent = JSON.stringify(ruleSpec());
            (doc.head || html).appendChild(script);
        } catch { /* an old browser: no prefetch, pages load as before */ }
    }

    // ── Prefetch on intent ───────────────────────────────────────────────────────────────────────
    function attr(el, name) { try { return el.getAttribute(name); } catch { return null; } }
    function samePage(u) {
        try { return u.origin === root.location.origin && u.pathname === root.location.pathname && u.search === root.location.search; } catch { return false; }
    }
    function navigates(a) {
        if (!a || attr(a, 'download') !== null) return false;
        const target = String(attr(a, 'target') || '');
        if (target && target !== '_self') return false;
        let u; try { u = new URL(attr(a, 'href'), root.location.href); } catch { return false; }
        return /^https?:$/.test(u.protocol) && !samePage(u);
    }
    function excluded(a) {
        for (const selector of state.exclude.concat([DENY_SELECTOR])) {
            try { if (a.matches && a.matches(selector)) return true; } catch { /* an old selector: ignore it */ }
        }
        return false;
    }
    function prefetchable(a) {
        if (!state.on || frugal() || !navigates(a) || excluded(a)) return null;
        let u; try { u = new URL(attr(a, 'href'), root.location.href); } catch { return null; }
        if (u.origin !== root.location.origin || u.search) return null;
        if (deniedPath(u.pathname)) return null;
        return u.href;
    }
    function startPrefetch(a, press) {
        // Our conservative rule already fetches a press in Chrome/Edge; a second link would only repeat the GET. A
        // page's own rules are left alone and may not cover the press, so it still gets the link.
        if (press && supportsRules() && ownRules()) return;
        const href = prefetchable(a);
        if (!href || prefetched.has(href) || inflight.size >= MAX_PREFETCH) return;
        prefetched.add(href);
        try {
            const link = doc.createElement('link');
            link.rel = 'prefetch';
            link.setAttribute('href', href);
            link.setAttribute('as', 'document');
            link.setAttribute('fetchpriority', 'low');
            const done = () => { if (inflight.get(href) === link) inflight.delete(href); };
            if (link.addEventListener) { link.addEventListener('load', done); link.addEventListener('error', done); }
            inflight.set(href, link);
            (doc.head || html).appendChild(link);
            setTimeout(done, 15000);
        } catch { prefetched.delete(href); }
    }

    function linkFrom(e) {
        try { return e && e.target && e.target.closest ? e.target.closest('a[href]') : null; } catch { return null; }
    }
    function onPress(e) {
        if (!e || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = linkFrom(e);
        if (!a || !navigates(a)) return;
        pressedLink = a;
        startPrefetch(a, true);
        startNav();
    }
    function onHover(e) {
        if (!finePointer() || frugal()) return;
        const a = linkFrom(e);
        if (!a || a === hoverLink) return;
        clearTimeout(hoverTimer);
        hoverLink = a;
        if (!navigates(a)) return;
        hoverTimer = setTimeout(() => startPrefetch(a, false), HOVER_MS);
    }
    function onHoverOut(e) {
        if (!hoverLink) return;
        let to = e && e.relatedTarget;
        try { if (to && hoverLink.contains && hoverLink.contains(to)) return; } catch { /* */ }
        clearTimeout(hoverTimer);
        hoverLink = null;
    }

    // ── The navbar's mark between the press and the next page's first paint ──────────────────────
    function startNav() {
        if (!state.on) return;
        clearTimeout(navTimer);
        try { if (root.OVMark) root.OVMark.navStart('page'); } catch { /* */ }
        try { root.sessionStorage.setItem(NAV_KEY, String(Date.now())); } catch { /* no storage: the arrival's own mark */ }
        // A press that turned out to be a drag, a context menu or a download never leaves the page.
        navTimer = setTimeout(() => { try { root.sessionStorage.removeItem(NAV_KEY); } catch { /* */ } endNav(); }, 10000);
    }
    function endNav(kind) {
        clearTimeout(navTimer);
        try { if (root.OVMark) root.OVMark.navEnd(kind); } catch { /* */ }
    }
    // This page came from a press: finish the ring here, at the first paint the mark exists for. The mark is loaded by
    // the navbar (deferred), so wait for it rather than for a script order.
    function arrival() {
        let t = 0;
        try {
            t = Number(root.sessionStorage.getItem(NAV_KEY)) || 0;
            root.sessionStorage.removeItem(NAV_KEY);
        } catch { t = 0; }
        if (!t || Date.now() - t > 20000) return false;
        // ov-mark learns the pace from its own 'ov-nav-click' marker; it sees this flag and leaves the ending to us.
        try { root.__ovSoftNavEnded = true; } catch { /* */ }
        let tries = 0;
        const finish = () => {
            let marks = null;
            try { marks = doc.querySelectorAll('.openvibe-navbar-brand .ov-mark, .navbar .nav-brand .ov-mark, .ov-mark[data-ov-nav]'); } catch { marks = null; }
            if (!root.OVMark || !marks || !marks.length) {
                if (++tries <= 100) setTimeout(finish, 50);   // the navbar and its mark arrive after the first paint
                return;
            }
            endNav('page');
        };
        finish();
        return true;
    }

    // ── The view transition styles ───────────────────────────────────────────────────────────────
    const ON_CSS = '@view-transition{navigation:auto}'
        + ':root{--ov-soft-fade:.18s}'
        + 'html[data-ov-motion=reduced]{--ov-soft-fade:.12s}'
        + 'html #navbar-mount{view-transition-name:ov-soft-bar}'
        // kit.css names the mount and the nested bar the same, which skips the transition; only the mount keeps a name.
        + 'html #navbar-mount .openvibe-navbar{view-transition-name:none}'
        + '::view-transition-old(root),::view-transition-new(root){animation-duration:var(--ov-soft-fade,.18s)}'
        + '::view-transition-group(ov-soft-bar),::view-transition-old(ov-soft-bar),::view-transition-new(ov-soft-bar){animation:none}';
    const OFF_CSS = '@view-transition{navigation:none}';

    let styleEl = null;
    function applyStyle() {
        const css = !supportsTransitions() ? '' : state.on && motion() !== 'off' ? ON_CSS : OFF_CSS;
        if (!css) {
            if (styleEl && styleEl.remove) { styleEl.remove(); styleEl = null; }
            return;
        }
        if (!styleEl) {
            styleEl = doc.createElement('style');
            styleEl.id = STYLE_ID;
            (doc.head || html).appendChild(styleEl);
        }
        if (styleEl.textContent !== css) styleEl.textContent = css;
        // Last in <head>, so @view-transition:none beats the auto kit.css declares, and so a later stylesheet cannot
        // take the bar's name back.
        try { if (doc.head && doc.head.lastChild !== styleEl) doc.head.appendChild(styleEl); } catch { /* */ }
    }

    function on() { state.on = true; applyStyle(); applyRules(); }
    function off() { state.on = false; applyStyle(); dropRules(); }
    function exclude(selector) {
        const s = String(selector || '').trim();
        if (!s) return;
        try { doc.querySelector(s); } catch { return; }   // an invalid selector would break the whole rule set
        if (state.exclude.indexOf(s) === -1) state.exclude.push(s);
        if (state.on) applyRules();
    }

    root.OpenVibeSoft = { on, off, exclude };

    applyStyle();
    applyRules();
    // theme-loader.js may set the motion attribute after this script, and the Look panel may change it later.
    try { if (typeof MutationObserver === 'function' && html) new MutationObserver(applyStyle).observe(html, { attributes: true, attributeFilter: ['data-ov-motion'] }); } catch { /* */ }
    try { const rm = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)'); if (rm && rm.addEventListener) rm.addEventListener('change', applyStyle); } catch { /* */ }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', applyStyle, { once: true });
    else applyStyle();

    // Intent, then the mark, then the next page's first paint.
    try {
        if (doc.addEventListener) {
            doc.addEventListener('pointerdown', onPress, true);
            if (typeof root.PointerEvent === 'undefined') doc.addEventListener('mousedown', onPress, true);
            doc.addEventListener('click', (e) => {   // a keyboard's activation has no pointerdown
                if (!e || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                const a = linkFrom(e);
                // A press already started it, at the real intent; do not reset the ring at the click.
                if (!a || a === pressedLink || !navigates(a)) return;
                startNav();
            }, true);
            doc.addEventListener('mouseover', onHover, true);
            doc.addEventListener('mouseout', onHoverOut, true);
            root.addEventListener('pagereveal', () => setTimeout(arrival, 0));
            root.addEventListener('pageshow', (e) => {
                if (!e || !e.persisted) return;
                clearTimeout(navTimer);
                try { root.sessionStorage.removeItem(NAV_KEY); } catch { /* */ }
            });
            try { const c = root.navigator && (root.navigator.connection || root.navigator.mozConnection || root.navigator.webkitConnection); if (c && c.addEventListener) c.addEventListener('change', applyRules); } catch { /* */ }
            if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', arrival, { once: true });
            else setTimeout(arrival, 0);
        }
    } catch { /* a page without events still loads normally */ }
})(typeof window !== 'undefined' ? window : globalThis);
