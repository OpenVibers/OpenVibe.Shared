/*
 * openvibe-shared/ov-tip.js — the network's one small tooltip (the owner, 2026-11-10, on the bar's Sign In button:
 * "Doesn't need the label really, and could have a tooltip … that looks really nice and custom animations"; and on the
 * footer's count: "if you put your mouse over it, it says 'last 30 minutes' … little tidbits, extra info").
 *
 *   <button aria-label="Sign in" data-ov-tip="Sign in" data-ov-tip-sub="Chat, follow, keep your things">…</button>
 *
 * Anything with data-ov-tip gets it: a small card that grows out of the thing it names, under it (above when there is
 * no room), kept on the screen, with an optional quiet second line. It shows for a mouse after a short rest and for
 * the keyboard's focus at once; a press, a scroll, Escape or leaving hides it. A finger never sees it (a touch goes
 * straight to the action), so nothing may be said ONLY in a tooltip: the element keeps its own name (aria-label or
 * text). Moving from one to the next within a moment shows the next at once. Calm fades; Off does not move.
 *
 *   OVTip.show(el)   OVTip.hide()
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OVTip) return;
    let tip = null, on = null, timer = 0, warmUntil = 0;

    function style() {
        if (document.getElementById('ov-tip-style')) return;
        const st = document.createElement('style');
        st.id = 'ov-tip-style';
        st.textContent = `
.ovtip { position: fixed; z-index: 10050; left: 0; top: 0; max-width: min(260px, calc(100vw - 16px)); box-sizing: border-box; padding: 7px 11px 8px; border-radius: 10px; border: 1px solid var(--border-light, #2c3d5c); background: var(--bg-elevated, var(--bg-tertiary, #172238)); color: var(--text-primary, #e6edf7); font: 600 12.5px/1.3 var(--font-sans, system-ui, sans-serif); box-shadow: 0 10px 26px -10px rgba(0, 0, 0, .65), 0 1px 3px rgba(0, 0, 0, .3); pointer-events: none; opacity: 0; transform: translateY(var(--ovtip-from, -5px)) scale(.94); transform-origin: var(--ovtip-ox, 50%) var(--ovtip-oy, 0); transition: opacity .14s ease, transform .22s cubic-bezier(.2, 1.35, .3, 1); }
.ovtip.is-on { opacity: 1; transform: none; }
.ovtip-sub { display: block; margin-top: 2px; font-weight: 500; font-size: 11.5px; color: var(--text-secondary, #96a7c2); }
.ovtip::before { content: ""; position: absolute; left: var(--ovtip-ax, 50%); top: -5px; width: 8px; height: 8px; margin-left: -4px; background: inherit; border: inherit; border-right: 0; border-bottom: 0; transform: rotate(45deg); border-radius: 2px 0 0 0; }
.ovtip.is-above::before { top: auto; bottom: -5px; transform: rotate(225deg); }
html[data-ov-motion=reduced] .ovtip { transform: none; transition: opacity .14s ease; }
html[data-ov-motion=off] .ovtip { transform: none; transition: none; }
@media (prefers-reduced-motion: reduce) { html:not([data-ov-motion]) .ovtip { transform: none; transition: opacity .14s ease; } }
@media print { .ovtip { display: none; } }`;
        document.head.appendChild(st);
    }

    function place(el) {
        const r = el.getBoundingClientRect(), vw = root.innerWidth, vh = root.innerHeight;
        // Measured from the corner: a fixed box takes its width from the room to its right, and where the last one stood
        // (near the right edge) there is little.
        tip.style.left = '0px'; tip.style.top = '0px';
        const w = tip.offsetWidth, h = tip.offsetHeight, gap = 9;
        const above = r.bottom + gap + h > vh - 8 && r.top - gap - h >= 8;
        const cx = r.left + r.width / 2;
        const left = Math.max(8, Math.min(vw - w - 8, cx - w / 2));
        const top = above ? r.top - gap - h : r.bottom + gap;
        const ax = Math.max(12, Math.min(w - 12, cx - left));
        tip.classList.toggle('is-above', above);
        tip.style.left = `${Math.round(left)}px`; tip.style.top = `${Math.round(top)}px`;
        tip.style.setProperty('--ovtip-ax', `${Math.round(ax)}px`); tip.style.setProperty('--ovtip-ox', `${Math.round(ax)}px`);
        tip.style.setProperty('--ovtip-oy', above ? '100%' : '0'); tip.style.setProperty('--ovtip-from', above ? '5px' : '-5px');
    }

    function show(el) {
        if (!el || !el.getAttribute) return;
        const text = el.getAttribute('data-ov-tip');
        if (!text || el.getAttribute('aria-expanded') === 'true') return;
        style();
        if (!tip) { tip = document.createElement('div'); tip.className = 'ovtip'; tip.setAttribute('aria-hidden', 'true'); document.body.appendChild(tip); }
        tip.classList.remove('is-on');
        tip.textContent = text;
        const sub = el.getAttribute('data-ov-tip-sub');
        if (sub) { const s = document.createElement('span'); s.className = 'ovtip-sub'; s.textContent = sub; tip.appendChild(s); }
        on = el;
        place(el);
        // The next frame, so the card is seen to grow out of what it names.
        (root.requestAnimationFrame || setTimeout)(() => { if (on === el && tip) tip.classList.add('is-on'); });
    }

    function hide() {
        clearTimeout(timer); timer = 0;
        if (on) warmUntil = Date.now() + 500;
        on = null;
        if (tip) tip.classList.remove('is-on');
    }

    const named = (t) => (t && t.closest ? t.closest('[data-ov-tip]') : null);
    document.addEventListener('pointerover', (e) => {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        const el = named(e.target);
        if (!el || el === on) return;
        clearTimeout(timer);
        if (Date.now() < warmUntil) show(el); else timer = setTimeout(() => show(el), 320);
    }, true);
    document.addEventListener('pointerout', (e) => { const el = named(e.target); if (el && !el.contains(e.relatedTarget)) hide(); }, true);
    document.addEventListener('focusin', (e) => { const el = named(e.target); if (el && el.matches && el.matches(':focus-visible')) show(el); });
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
    root.addEventListener('scroll', hide, { passive: true, capture: true });
    root.addEventListener('resize', hide, { passive: true });

    root.OVTip = { show, hide };
}(typeof window !== 'undefined' ? window : globalThis));
