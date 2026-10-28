/**
 * openvibe-shared/motion.js — the network's motion, small and opt-in (plan 2026-10-28 §3.11): a page marks what moves and
 * this makes it move, once, when it is seen. The server always renders the finished state (the real number, the whole
 * scene, the plain placeholder), so a page is complete without this file, under reduced motion (the OS setting or the
 * account's, html[data-ov-motion=reduced]) and for crawlers.
 *
 *   [data-ov-reveal]          fades and rises in the first time it scrolls into view (html.ov-motion hides it until then)
 *   [data-ov-ticker="1204"]   counts up to its number when seen (the text the server wrote is the end state)
 *   input[data-ov-typed="a|b|c"]  types each hint into the placeholder in turn, erases it, moves on; stops for good
 *                             once the box is focused or has text
 *
 * Runs by itself when it loads; OpenVibeMotion.enhance(container) again for markup added later. Idempotent.
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const still = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || html.getAttribute('data-ov-motion') === 'reduced';
    const seen = typeof IntersectionObserver === 'function'
        ? (el, fn, margin) => { const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } }), { rootMargin: margin || '0px 0px -8% 0px' }); io.observe(el); }
        : (el, fn) => fn(el);

    function tick(el) {
        const end = Number(el.getAttribute('data-ov-ticker'));
        const text = el.textContent;
        if (!Number.isFinite(end) || end <= 0 || still()) return;
        const t0 = performance.now(), dur = Math.min(1400, 500 + Math.log10(end + 1) * 220);
        const step = (t) => {
            const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
            el.textContent = k < 1 ? Math.round(end * e).toLocaleString('en-US') : text;
            if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    function typed(input) {
        const hints = String(input.getAttribute('data-ov-typed') || '').split('|').map((s) => s.trim()).filter(Boolean);
        const base = input.getAttribute('placeholder') || '';
        if (!hints.length || still()) return;
        let i = 0, n = 0, dir = 1, timer = 0, stopped = false;
        const stop = () => { stopped = true; clearTimeout(timer); input.setAttribute('placeholder', base); };
        input.addEventListener('focus', stop, { once: true });
        input.addEventListener('input', stop, { once: true });
        const run = () => {
            if (stopped || input.value) return stop();
            const h = hints[i];
            n += dir;
            input.setAttribute('placeholder', h.slice(0, n));
            let wait = dir > 0 ? 45 + Math.random() * 40 : 22;
            if (dir > 0 && n >= h.length) { dir = -1; wait = 1700; } else if (dir < 0 && n <= 0) { dir = 1; i = (i + 1) % hints.length; wait = 380; }
            timer = setTimeout(run, wait);
        };
        timer = setTimeout(run, 900);
    }

    function enhance(scope) {
        const box = scope || document;
        const all = (sel) => Array.prototype.slice.call(box.querySelectorAll(sel));
        const once = (el, key) => { if (el.dataset[key]) return false; el.dataset[key] = '1'; return true; };
        all('[data-ov-reveal]').forEach((el) => { if (once(el, 'ovReveal')) { if (still()) el.classList.add('is-in'); else seen(el, (x) => x.classList.add('is-in')); } });
        all('[data-ov-ticker]').forEach((el) => { if (once(el, 'ovTicker')) seen(el, tick, '0px'); });
        all('input[data-ov-typed]').forEach((el) => { if (once(el, 'ovTyped')) typed(el); });
    }

    html.classList.add('ov-motion');
    root.OpenVibeMotion = { enhance };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => enhance(document));
    else enhance(document);
})(typeof globalThis !== 'undefined' ? globalThis : this);
