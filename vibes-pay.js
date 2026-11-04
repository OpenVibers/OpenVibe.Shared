'use strict';
/**
 * openvibe-shared/vibes-pay.js — Vibes Pay for any page (MONEY.md, D12).
 *
 *   <script src="https://openvibe.network/shared/vibes-pay.js"></script>
 *
 *   <button data-ov-vibes-pay="https://openvibe.network/pay/vch_…">Pay with Vibes</button>
 *
 *   OpenVibe.vibes.pay(payUrl).then(({ status }) => { … });
 *
 * A button with data-ov-vibes-pay binds itself: it is styled as "Pay with Vibes" (the Vibes green,
 * readable on light and dark themes), and a click opens the sheet in a popup on a computer and as a
 * full page on a phone. The sheet posts { type: 'ov-vibes-pay', status, charge_id } to the page, only
 * from https://openvibe.network; the promise resolves with { status } (and charge_id when sent), and
 * a page may listen for the bubbling 'ov-vibes-pay' event instead. A popup closed without a payment
 * resolves { status: 'closed' }.
 *
 * The sheet itself is openvibe.network/pay/<charge id>; a pay URL on another origin is refused.
 * The button is progressive: without JavaScript (or this file) the link can still be a plain anchor.
 */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    root.OpenVibe = root.OpenVibe || {};
    root.OpenVibe.vibes = Object.assign(root.OpenVibe.vibes || {}, api);
    root.OVVibesPay = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const ORIGIN = 'https://openvibe.network';
    const TYPE = 'ov-vibes-pay';
    const STYLE_ID = 'ov-vibes-pay-style';
    const POPUP = 'ov-vibes-pay';
    const PHONE = '(max-width: 640px)';

    let pending = null;

    const isPhone = () => {
        try { return !!(root.matchMedia && root.matchMedia(PHONE).matches); } catch { return false; }
    };

    /** `payUrl` must be an https URL on openvibe.network (a relative /pay/… path is taken as one). */
    function payTarget(payUrl) {
        let u;
        try { u = new URL(String(payUrl), ORIGIN); } catch { throw new TypeError('vibes.pay: payUrl is a URL'); }
        if (u.protocol !== 'https:' || u.origin !== ORIGIN) throw new TypeError(`vibes.pay: payUrl must be on ${ORIGIN}`);
        if (!/^\/pay\/[^/]+/.test(u.pathname)) throw new TypeError('vibes.pay: payUrl is an openvibe.network/pay/… URL');
        return u.href;
    }

    function emit(result) {
        const doc = root.document;
        if (!doc || typeof root.CustomEvent !== 'function') return;
        try { doc.dispatchEvent(new root.CustomEvent(TYPE, { detail: result, bubbles: true })); } catch { /* an old browser */ }
    }

    function settle(result) {
        const p = pending;
        pending = null;
        if (p && p.timer) clearInterval(p.timer);
        if (p) { p.resolve(result); emit(result); }
    }

    function onMessage(event) {
        if (!event || event.origin !== ORIGIN) return;
        const data = event.data;
        if (!data || typeof data !== 'object' || data.type !== TYPE) return;
        if (typeof data.status !== 'string' || !data.status) return;
        if (!pending) return;
        // A popup: only the window we opened may answer. A page that did not keep the WindowProxy skips this.
        if (pending.popup && event.source && event.source !== pending.popup) return;
        const result = { status: data.status, pay_url: pending.href };
        if (data.charge_id) result.charge_id = data.charge_id;
        settle(result);
    }

    /**
     * Open the Vibes Pay sheet and resolve { status } (plus charge_id/pay_url when known).
     * On a phone it is a full page in a new tab; if the browser blocks it, this page navigates instead.
     */
    function pay(payUrl) {
        const href = payTarget(payUrl);
        if (pending) return pending.promise;
        if (!root || typeof root.open !== 'function') throw new TypeError('vibes.pay: this page cannot open a window');
        let resolve;
        const promise = new Promise((r) => { resolve = r; });
        let popup = null;
        if (isPhone()) {
            popup = root.open(href, '_blank');
        } else {
            const w = Math.min(520, Math.max(360, Number(root.innerWidth) || 1200));
            const h = Math.min(760, Math.max(560, Number(root.innerHeight) || 800));
            const left = Math.max(0, Math.round((Number(root.screenX) || 0) + ((Number(root.outerWidth) || w) - w) / 2));
            const top = Math.max(0, Math.round((Number(root.screenY) || 0) + ((Number(root.outerHeight) || h) - h) / 2));
            popup = root.open(href, POPUP, `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
        }
        if (!popup) {
            // A blocked popup is not an error: the sheet is a normal page too.
            if (root.location && typeof root.location.assign === 'function') root.location.assign(href);
            return promise;
        }
        try { popup.focus(); } catch { /* some browsers refuse focus() */ }
        pending = { href, popup, resolve, promise, timer: null };
        pending.timer = setInterval(() => {
            if (pending && pending.popup && pending.popup.closed) settle({ status: 'closed', pay_url: href });
        }, 700);
        if (pending.timer && typeof pending.timer.unref === 'function') pending.timer.unref();
        return promise;
    }

    const CSS = `
.ov-vibes-pay {
    --ov-vibes-accent: #4ade80;
    --ov-vibes-accent-light: #86efac;
    --ov-vibes-ink: #07130a;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: .5em;
    min-height: 44px;
    padding: .62em 1.15em;
    border: 1px solid rgba(34, 197, 94, .55);
    border-radius: 999px;
    background: var(--ov-vibes-accent);
    color: var(--ov-vibes-ink);
    font: inherit;
    font-weight: 700;
    line-height: 1.2;
    text-decoration: none;
    cursor: pointer;
    box-shadow: 0 6px 18px -10px rgba(34, 197, 94, .8);
    -webkit-tap-highlight-color: transparent;
}
.ov-vibes-pay:hover { background: var(--ov-vibes-accent-light); }
.ov-vibes-pay:focus-visible { outline: 3px solid color-mix(in srgb, var(--ov-vibes-accent) 55%, transparent); outline-offset: 2px; }
.ov-vibes-pay:disabled, .ov-vibes-pay[aria-busy="true"] { opacity: .62; cursor: progress; }
@media (prefers-reduced-motion: no-preference) { .ov-vibes-pay { transition: background-color .15s ease; } }
`;

    function ensureStyles() {
        const doc = root.document;
        if (!doc || doc.getElementById(STYLE_ID)) return;
        const style = doc.createElement('style');
        style.id = STYLE_ID;
        style.textContent = CSS;
        (doc.head || doc.documentElement).appendChild(style);
    }

    /**
     * Bind every [data-ov-vibes-pay] under `scope` (default: the document) once. A bound element is
     * labelled "Pay with Vibes", disabled while the sheet is open, and dispatches the page event.
     * Returns how many were bound now.
     */
    function bind(scope) {
        const doc = root.document;
        if (!doc) return 0;
        const where = scope || doc;
        if (!where || typeof where.querySelectorAll !== 'function') return 0;
        let bound = 0;
        for (const el of where.querySelectorAll('[data-ov-vibes-pay]')) {
            if (el.__ovVibesPayBound) continue;
            const url = el.getAttribute('data-ov-vibes-pay');
            if (!url) continue;
            el.__ovVibesPayBound = true;
            ensureStyles();
            el.classList.add('ov-vibes-pay');
            if (String(el.tagName).toUpperCase() === 'BUTTON' && !el.getAttribute('type')) el.setAttribute('type', 'button');
            el.textContent = 'Pay with Vibes';
            el.addEventListener('click', async (event) => {
                event.preventDefault();
                if (el.disabled) return;
                el.disabled = true;
                el.setAttribute('aria-busy', 'true');
                try {
                    await pay(url);
                } catch (err) {
                    if (root.console && root.console.error) root.console.error('[vibes-pay]', err);
                } finally {
                    el.disabled = false;
                    el.removeAttribute('aria-busy');
                }
            });
            bound++;
        }
        return bound;
    }

    function autoInit() {
        const doc = root.document;
        if (!doc) return;
        const run = () => { ensureStyles(); bind(doc); };
        if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', run, { once: true });
        else run();
        if (typeof root.MutationObserver === 'function' && doc.documentElement) {
            try {
                new root.MutationObserver(() => bind(doc)).observe(doc.documentElement, { childList: true, subtree: true });
            } catch { /* no observer, the initial bind still ran */ }
        }
    }

    if (root && typeof root.addEventListener === 'function' && !root.__ovVibesPayListening) {
        root.__ovVibesPayListening = true;
        root.addEventListener('message', onMessage);
        autoInit();
    }

    return { pay, bind, ORIGIN, TYPE };
});
