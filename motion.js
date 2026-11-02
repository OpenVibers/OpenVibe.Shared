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
 *   [data-ov-ghost]           a scene's ghost cursor (4.106.0, MOTION-1): an arrow walks to each [data-ov-ghost-step="N"]
 *                             inside it in order, "clicks" (a ring that widens and fades) and marks that step
 *                             data-ov-ghost-on (the page draws what "chosen" looks like), dwells, moves on, and starts
 *                             over after the last. Only while the scene is in view; never under reduced motion; gone for
 *                             good the moment the reader touches, clicks, types or focuses inside the scene. The
 *                             cursor is aria-hidden and takes no focus or pointer events.
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

    const GHOST_CSS = `
.ov-ghost-host{position:relative}
.ov-ghost{position:absolute;left:0;top:0;z-index:5;width:22px;height:22px;pointer-events:none;opacity:0;transition:transform .55s cubic-bezier(.3,.8,.3,1),opacity .3s ease;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))}
.ov-ghost.is-on{opacity:1}
.ov-ghost svg{display:block;width:22px;height:22px}
.ov-ghost-ring{position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:50%;border:2px solid var(--room-accent,var(--accent,#3b82f6));opacity:0}
.ov-ghost.is-click .ov-ghost-ring{animation:ovGhostRing .5s ease-out}
@keyframes ovGhostRing{from{opacity:.9;transform:scale(.4)}to{opacity:0;transform:scale(1.8)}}`;
    const GHOST_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 8.2-6.1 1.3 3.6 6.8-2.6 1.4-3.6-6.8L5 18.6z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg><span class="ov-ghost-ring"></span>';

    function ghost(scene) {
        if (still()) return;
        const steps = Array.prototype.slice.call(scene.querySelectorAll('[data-ov-ghost-step]'))
            .sort((a, b) => Number(a.getAttribute('data-ov-ghost-step')) - Number(b.getAttribute('data-ov-ghost-step')));
        if (!steps.length) return;
        if (!document.getElementById('ov-ghost-css')) { const st = document.createElement('style'); st.id = 'ov-ghost-css'; st.textContent = GHOST_CSS; document.head.appendChild(st); }
        if (getComputedStyle(scene).position === 'static') scene.classList.add('ov-ghost-host');
        const cur = document.createElement('span');
        cur.className = 'ov-ghost';
        cur.setAttribute('aria-hidden', 'true');
        cur.innerHTML = GHOST_SVG;
        scene.appendChild(cur);
        let i = 0, timer = 0, visible = false, gone = false;
        const mark = (el) => { steps.forEach((x) => x.removeAttribute('data-ov-ghost-on')); if (el) el.setAttribute('data-ov-ghost-on', ''); };
        const place = (el) => {
            const a = scene.getBoundingClientRect(), b = el.getBoundingClientRect();
            // Toward the left of the step (where a radio or an icon usually is), so the arrow does not cover its words.
            const x = b.left - a.left + Math.min(b.width * 0.18, 26), y = b.top - a.top + b.height * 0.6;
            cur.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        };
        const step = () => {
            if (gone || !visible) return;
            const el = steps[i];
            place(el);
            cur.classList.add('is-on');
            timer = setTimeout(() => {
                if (gone) return;
                cur.classList.remove('is-click'); void cur.offsetWidth; cur.classList.add('is-click');
                mark(el);
                i = (i + 1) % steps.length;
                timer = setTimeout(step, i === 0 ? 2600 : 1300);
            }, 650);
        };
        const stop = () => {
            if (gone) return;
            gone = true; clearTimeout(timer); mark(null); cur.remove();
            ['pointerdown', 'keydown', 'focusin', 'wheel', 'touchstart'].forEach((ev) => scene.removeEventListener(ev, stop, true));
        };
        ['pointerdown', 'keydown', 'focusin', 'wheel', 'touchstart'].forEach((ev) => scene.addEventListener(ev, stop, { capture: true, passive: true }));
        if (typeof IntersectionObserver === 'function') {
            new IntersectionObserver((es) => es.forEach((e) => {
                const was = visible; visible = e.isIntersecting;
                if (visible && !was) { clearTimeout(timer); timer = setTimeout(step, 500); } else if (!visible) { clearTimeout(timer); cur.classList.remove('is-on'); }
            }), { threshold: 0.4 }).observe(scene);
        } else { visible = true; timer = setTimeout(step, 500); }
    }

    function enhance(scope) {
        const box = scope || document;
        const all = (sel) => Array.prototype.slice.call(box.querySelectorAll(sel));
        const once = (el, key) => { if (el.dataset[key]) return false; el.dataset[key] = '1'; return true; };
        all('[data-ov-reveal]').forEach((el) => { if (once(el, 'ovReveal')) { if (still()) el.classList.add('is-in'); else seen(el, (x) => x.classList.add('is-in')); } });
        all('[data-ov-ticker]').forEach((el) => { if (once(el, 'ovTicker')) seen(el, tick, '0px'); });
        all('input[data-ov-typed]').forEach((el) => { if (once(el, 'ovTyped')) typed(el); });
        all('[data-ov-ghost]').forEach((el) => { if (once(el, 'ovGhost')) ghost(el); });
    }

    html.classList.add('ov-motion');
    root.OpenVibeMotion = { enhance };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => enhance(document));
    else enhance(document);
})(typeof globalThis !== 'undefined' ? globalThis : this);
