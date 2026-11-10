/* openvibe-shared/ov-labels.js: content labels (plan L1, 2026-10-31), each viewer's own choice applied in the page.
 *
 * A page marks what carries labels: data-ov-labels="nudity,18+" on a card, a player or a picture. Optionally:
 *   data-ov-labels-media   on the child to cover (the thumbnail, the <video>), else the marked element itself;
 *   data-ov-labels-owner   the poster, as their subject (usr_…) or as @username for a page that knows only the name:
 *                          their own content always shows to them;
 *   data-ov-labels-opened  on the thing's own page (a watch page, a picture's page): the person opened it themselves, so
 *                          hide covers it as blur does instead of leaving the page empty.
 * The navbar loads this file the first time such an element appears (navbar.js, like ov-glyphs.js). It reads the
 * person's choices once from Network (GET /api/v1/me/label-prefs, network.label-prefs@1) with the navbar's token:
 *   show  as it is (the web default, and what a signed-out visitor gets);
 *   blur  the media is covered by a calm "Show" button naming the labels, until tapped (a playing video pauses);
 *   hide  the element is not shown.
 * Labels are choices, never bans: nothing is removed from the page for anyone else, and nothing here asks for
 * anything. window.OVLabels: { apply(root?), prefs(), NAMES, LABELS }.
 */
(function (root) {
    'use strict';
    if (root.OVLabels) return;
    const LABELS = ['nudity', 'language', 'graphic', '18+', 'flashing', 'spoilers'];
    const NAMES = { nudity: 'Nudity', language: 'Strong language', graphic: 'Graphic', '18+': '18+', flashing: 'Flashing lights', spoilers: 'Spoilers' };
    const SEL = '[data-ov-labels]';
    const CACHE = 'ov_label_prefs';
    const CACHE_MS = 5 * 60 * 1000;
    let prefs = null;
    let me = null;
    let meName = null;   // '@name', lower-cased: a page may name the poster by username
    let loading = null;

    const CSS = `
[data-ov-labels-state="hide"]{display:none!important}
.ov-labels-cover{position:relative;overflow:hidden}
.ov-labels-cover>:not(.ov-labels-gate){filter:blur(26px) saturate(.6);transform:scale(1.04)}
.ov-labels-gate{all:unset;box-sizing:border-box;position:absolute;inset:0;z-index:3;display:grid;place-content:center;justify-items:center;gap:6px;padding:12px;cursor:pointer;text-align:center;
  font:600 .86rem/1.3 system-ui,sans-serif;color:#fff;background:color-mix(in srgb,#05070c 46%,transparent)}
.ov-labels-gate b{font-weight:700;font-size:.78rem;letter-spacing:.02em;opacity:.86}
.ov-labels-gate span{display:inline-flex;align-items:center;min-height:36px;padding:0 16px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28)}
.ov-labels-gate:hover span,.ov-labels-gate:focus-visible span{background:rgba(255,255,255,.26)}
.ov-labels-gate:focus-visible{outline:2px solid var(--accent,#60a5fa);outline-offset:-4px}
html[data-ov-motion=off] .ov-labels-cover>:not(.ov-labels-gate){transform:none}`;

    function injectCSS() {
        if (document.getElementById('ov-labels-css')) return;
        const st = document.createElement('style');
        st.id = 'ov-labels-css';
        st.textContent = CSS;
        (document.head || document.documentElement).appendChild(st);
    }

    const parse = (el) => String(el.getAttribute('data-ov-labels') || '').split(',').map((s) => s.trim()).filter((l) => LABELS.includes(l));

    /** What this viewer sees for these labels: the strictest of their choices. */
    function decide(labels, el) {
        if (!prefs || !labels.length) return 'show';
        const owner = el.getAttribute('data-ov-labels-owner');
        if (owner && ((me && owner === me) || (meName && owner.charAt(0) === '@' && owner.toLowerCase() === meName))) return 'show';
        let out = 'show';
        for (const l of labels) {
            if (prefs[l] === 'hide') return el.hasAttribute('data-ov-labels-opened') ? 'blur' : 'hide';
            if (prefs[l] === 'blur') out = 'blur';
        }
        return out;
    }

    function cover(el, labels) {
        const media = el.querySelector('[data-ov-labels-media]') || el;
        if (media.querySelector(':scope > .ov-labels-gate')) return;
        media.classList.add('ov-labels-cover');
        if (getComputedStyle(media).position === 'static') media.style.position = 'relative';
        const gate = document.createElement('button');
        gate.type = 'button';
        gate.className = 'ov-labels-gate';
        const what = document.createElement('b');
        what.textContent = labels.map((l) => NAMES[l]).join(' · ');
        const show = document.createElement('span');
        show.textContent = 'Show';
        gate.append(what, show);
        gate.setAttribute('aria-label', `Labelled ${what.textContent}. Show it`);
        gate.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.setAttribute('data-ov-labels-state', 'shown');
            media.classList.remove('ov-labels-cover');
            gate.remove();
        });
        media.prepend(gate);
        const v = media.tagName === 'VIDEO' ? media : media.querySelector('video');
        if (v && !v.paused) { try { v.pause(); } catch { /* */ } }
    }

    function uncover(el) {
        const media = el.querySelector('[data-ov-labels-media]') || el;
        media.classList.remove('ov-labels-cover');
        const gate = media.querySelector(':scope > .ov-labels-gate');
        if (gate) gate.remove();
    }

    /** Apply the choices to every marked element under root (the page by default). A revealed one stays revealed. */
    function apply(scope) {
        const base = scope && scope.querySelectorAll ? scope : document;
        const list = base.matches && base.matches(SEL) ? [base] : [...base.querySelectorAll(SEL)];
        for (const el of list) {
            if (el.getAttribute('data-ov-labels-state') === 'shown') continue;
            const labels = parse(el);
            const state = decide(labels, el);
            el.setAttribute('data-ov-labels-state', state);
            if (state === 'blur') cover(el, labels); else uncover(el);
        }
    }

    function readCache(subject) {
        try {
            const c = JSON.parse(sessionStorage.getItem(CACHE) || 'null');
            return c && c.subject === subject && Date.now() - c.at < CACHE_MS ? c.prefs : null;
        } catch { return null; }
    }

    async function load(session) {
        const token = session && session.token;
        const user = session && session.user;
        me = user && (user.subject_id || user.subject || null);
        meName = user && user.username ? `@${String(user.username).toLowerCase()}` : null;
        if (!token) { prefs = null; apply(); return; }
        const cached = readCache(me);
        if (cached) { prefs = cached; apply(); return; }
        if (loading) return loading;
        const base = String((session && session.apiBase) || 'https://openvibe.network').replace(/\/+$/, '');
        loading = fetch(`${base}/api/v1/me/label-prefs`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'omit' })
            .then((r) => (r.ok ? r.json() : null))
            .then((body) => {
                const p = body && body.prefs;
                prefs = p && typeof p === 'object' ? p : null;
                try { if (prefs) sessionStorage.setItem(CACHE, JSON.stringify({ subject: me, at: Date.now(), prefs })); } catch { /* */ }
            })
            .catch(() => { prefs = null; })
            .finally(() => { loading = null; apply(); });
        return loading;
    }

    function start() {
        injectCSS();
        // The navbar may have signed in before this file arrived (its session getter), or will say so (its event).
        const N = root.OpenVibeNavbar;
        const s = N && N.session;
        if (s && s.token) load(s); else apply();
        document.addEventListener('openvibe-navbar-auth', (e) => {
            const d = (e && e.detail) || {};
            try { sessionStorage.removeItem(CACHE); } catch { /* */ }
            load({ token: d.token, user: d.user, apiBase: N && N.session && N.session.apiBase });
        });
        // Labelled things that arrive later (a feed's next page, a rail that loads as it scrolls).
        if (typeof MutationObserver === 'function' && document.body) {
            let soon = false;
            const own = (n) => n.nodeType !== 1 || (n.classList && n.classList.contains('ov-labels-gate'));
            new MutationObserver((records) => {
                // Its own covers going in or out are not news.
                if (records.every((r) => [...r.addedNodes, ...r.removedNodes].every(own))) return;
                if (soon) return;
                soon = true;
                setTimeout(() => { soon = false; apply(); }, 120);
            }).observe(document.body, { childList: true, subtree: true });
        }
    }

    root.OVLabels = { apply, prefs: () => (prefs ? { ...prefs } : null), NAMES, LABELS };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})(typeof window !== 'undefined' ? window : globalThis);
