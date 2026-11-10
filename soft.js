/*
 * openvibe-shared/soft.js — the small, safe part of "soft pages": the next page is already fetched, and the shared
 * bar stays still while the page cross-fades.
 *
 *   <script src="/shared/soft.js"></script>          in <head>, after theme-loader.js, not deferred
 *
 * The script has to run before the arriving page first renders, or that page cannot take part in the cross-document
 * transition; a deferred copy still opts the *next* move in. It re-appends its one <style> at DOMContentLoaded so it
 * wins the cascade over kit.css.
 *
 * It adds only what is safe on every site today:
 *
 *   • Speculation Rules prefetch for same-origin links (and the navbar's [data-ov-net-link] cross-site links), at
 *     "moderate" eagerness. No prerender: our navbar's page-view beacon (countView) and visit record (recordVisit) do
 *     not defer under document.prerendering, and signed-in pages can be stale when a hidden prerender is activated.
 *     Sign-in/sign-out, auth/API, downloads, query URLs and data-ov-no-prefetch are left out (see
 *     research/soft-pages.md, 2026-11-10).
 *   • Cross-document view transitions: the bar mount is named and held still, the rest of the page cross-fades. Calm
 *     (data-ov-motion=reduced) is shorter; Off gets no transition. A browser without CSSViewTransitionRule gets no
 *     styles and no error.
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
    const SELF = doc.currentScript || null;
    const state = { on: true, exclude: [] };

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
    const DENY_SELECTOR = '[data-ov-no-prefetch], [data-no-prefetch], [download], [rel~=nofollow], [target=_blank], [href*="?"], [href^="#"]';

    function ruleSpec() {
        const where = {
            and: [
                { href_matches: '/*' },
                { not: { href_matches: DENY_PATHS } },
                { not: { selector_matches: DENY_SELECTOR } },
            ],
        };
        for (const selector of state.exclude) where.and.push({ not: { selector_matches: selector } });
        const rules = { prefetch: [{ where, eagerness: 'moderate' }] };
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
        if (!state.on || !supportsRules()) return dropRules();
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
})(typeof window !== 'undefined' ? window : globalThis);
