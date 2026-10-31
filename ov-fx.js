/**
 * openvibe-shared/ov-fx.js — the network's effects, one kit (plan L45, 4.66.0). The mark's motion (4.65.0: a glint,
 * a glow, a press) for anything on any OpenVibe page, plus reveals, counting numbers, a ripple, a tilt and confetti.
 * navbar.js loads it from beside itself once the page settles, and only when the page has an element with data-fx.
 *
 *   <a class="card" data-fx="glint lift press">…</a>     effects by name, any number of them
 *   <ul data-fx="reveal" data-fx-stagger="60">…</ul>     its children rise in as they come on screen, 60 ms apart
 *   <b data-fx="count">12,480</b>                         the number counts up the first time it is seen
 *   <button data-fx="confetti press">Send tip</button>    a burst of confetti from the button when it is pressed
 *   OVFx.confetti({ x, y, count, colors })                the same burst from anywhere (a first stream, a goal)
 *   OVFx.scan(root)                                       wire effects in markup added later (scanned by itself too)
 *
 * Effects: glint (a band of light crosses on hover), glow (the accent glows behind on hover), lift (rises a little),
 * press (gives on press and springs back), ripple (from the point pressed), tilt (leans toward the pointer; mouse
 * only), reveal, count, confetti, shimmer (a placeholder that shimmers until data-fx is removed).
 *
 * Motion tokens (a look can set them; theme-loader.js passes a theme's own): --ov-dur-1…4, --ov-ease-out,
 * --ov-ease-spring, --ov-ease-in-out. Each look has a feel (4.67.0): the quiet paper and light themes move calmly (a
 * little slower, no overshoot), the neon and terminal ones snap (quicker, a livelier spring); the rest are lively. Nothing here runs by itself: every effect waits for a hover, a press, or the
 * element coming on screen, plays once, and stops. Under prefers-reduced-motion or Calm (html[data-ov-motion=reduced])
 * nothing moves: reveals and numbers are simply there, and no confetti falls.
 */
(function (root) {
    'use strict';
    if (!root || root.OVFx) return;
    const doc = root.document;
    const feel = (ids) => ids.map((id) => `[data-theme=${id}]`).join(',');
    const CALM = feel(['paper', 'daylight', 'cloud', 'snow', 'sand', 'rose', 'meadow', 'peach', 'lavender', 'dawn', 'solarized-light', 'catppuccin-latte', 'nord', 'nord-light']);
    const SNAPPY = feel(['neon-tokyo', 'vapor', 'matrix', 'hacker', 'high-contrast', 'dracula', 'monokai', 'abyss']);
    const CSS = ':root{--ov-dur-1:.12s;--ov-dur-2:.2s;--ov-dur-3:.32s;--ov-dur-4:.52s;--ov-ease-out:cubic-bezier(.2,.8,.2,1);--ov-ease-spring:cubic-bezier(.34,1.56,.64,1);--ov-ease-in-out:cubic-bezier(.65,0,.35,1)}'
        + `html:is(${CALM}){--ov-dur-1:.15s;--ov-dur-2:.25s;--ov-dur-3:.4s;--ov-dur-4:.62s;--ov-ease-spring:var(--ov-ease-out)}`
        + `html:is(${SNAPPY}){--ov-dur-1:.09s;--ov-dur-2:.15s;--ov-dur-3:.24s;--ov-dur-4:.42s;--ov-ease-spring:cubic-bezier(.3,1.8,.6,1)}`
        + 'html[data-ov-motion=reduced]{--ov-dur-1:0s;--ov-dur-2:0s;--ov-dur-3:0s;--ov-dur-4:0s}'
        + '.ovfx-glint{position:relative;overflow:hidden;isolation:isolate}'
        + '.ovfx-glint::after{content:"";position:absolute;inset:-2px;pointer-events:none;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.28) 50%,transparent 65%);transform:translateX(-120%);z-index:1}'
        + '.ovfx-glint:hover::after,.ovfx-glint:focus-visible::after{transform:translateX(120%);transition:transform .75s var(--ov-ease-in-out)}'
        + '.ovfx-glow{transition:box-shadow var(--ov-dur-3) var(--ov-ease-out)}'
        + '.ovfx-glow:hover,.ovfx-glow:focus-visible{box-shadow:0 0 0 1px color-mix(in srgb,var(--accent,#4f7cff) 45%,transparent),0 10px 34px -10px color-mix(in srgb,var(--accent,#4f7cff) 70%,transparent)}'
        + '.ovfx-lift{transition:transform var(--ov-dur-3) var(--ov-ease-spring),box-shadow var(--ov-dur-3) var(--ov-ease-out)}'
        + '.ovfx-lift:hover{transform:translateY(-3px);box-shadow:0 12px 28px -14px rgba(0,0,0,.45)}'
        + '.ovfx-press{transition:transform var(--ov-dur-4) var(--ov-ease-spring)}'
        + '.ovfx-press:active{transform:scale(.96);transition-duration:var(--ov-dur-1)}'
        + '.ovfx-lift.ovfx-press:active{transform:translateY(-1px) scale(.97)}'
        + '.ovfx-ripple{position:relative;overflow:hidden;isolation:isolate}'
        + '.ovfx-rip{position:absolute;border-radius:50%;pointer-events:none;background:currentColor;opacity:.22;transform:scale(0);animation:ovfxRip .6s var(--ov-ease-out) forwards}'
        + '@keyframes ovfxRip{to{transform:scale(1);opacity:0}}'
        + '.ovfx-tilt{transition:transform var(--ov-dur-3) var(--ov-ease-out);transform-style:preserve-3d;will-change:transform}'
        + '.ovfx-hide{opacity:0;transform:translateY(14px)}'
        + '.ovfx-in{opacity:1;transform:none;transition:opacity .5s var(--ov-ease-out),transform .6s var(--ov-ease-spring);transition-delay:var(--ovfx-d,0ms)}'
        + '.ovfx-shimmer{background:linear-gradient(100deg,color-mix(in srgb,var(--text-muted,#8b93ad) 12%,transparent) 30%,color-mix(in srgb,var(--text-muted,#8b93ad) 22%,transparent) 50%,color-mix(in srgb,var(--text-muted,#8b93ad) 12%,transparent) 70%) 0 0/300% 100%;animation:ovfxShim 1.4s linear infinite;color:transparent!important;border-radius:8px}'
        + '@keyframes ovfxShim{from{background-position:100% 0}to{background-position:0 0}}'
        + '.ovfx-confetti{position:fixed;inset:0;pointer-events:none;z-index:2147483000}'
        + '@media (prefers-reduced-motion:reduce){.ovfx-glint::after{display:none}.ovfx-lift,.ovfx-press,.ovfx-tilt,.ovfx-in{transition:none!important}.ovfx-shimmer{animation:none}}'
        + 'html[data-ov-motion=reduced] .ovfx-glint::after{display:none}html[data-ov-motion=reduced] .ovfx-shimmer{animation:none}html[data-ov-motion=reduced] .ovfx-in{transition:none}';

    const reduced = () => (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) || doc.documentElement.getAttribute('data-ov-motion') === 'reduced';
    const fine = () => !!(root.matchMedia && root.matchMedia('(hover: hover) and (pointer: fine)').matches);
    const done = new WeakSet();
    let io = null;

    function css() {
        if (doc.getElementById('ov-fx-css')) return;
        const st = doc.createElement('style'); st.id = 'ov-fx-css'; st.textContent = CSS; (doc.head || doc.documentElement).appendChild(st);
    }

    // ── Seen: reveal and count, once each, when they come on screen ──
    function seen(el) {
        if (el.__ovfxReveal) {
            const kids = el.__ovfxReveal;
            kids.forEach((k) => { k.classList.add('ovfx-in'); k.classList.remove('ovfx-hide'); });
            root.setTimeout(() => kids.forEach((k) => { k.classList.remove('ovfx-in'); k.style.removeProperty('--ovfx-d'); }), 1400 + kids.length * 80);
            el.__ovfxReveal = null;
        }
        if (el.__ovfxCount) { const c = el.__ovfxCount; el.__ovfxCount = null; countUp(el, c); }
    }
    function observe(el) {
        if (!('IntersectionObserver' in root)) return seen(el);
        io = io || new root.IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); seen(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
        io.observe(el);
    }
    const below = (el) => { try { return el.getBoundingClientRect().top > (root.innerHeight || 0); } catch (e) { return false; } };

    function countUp(el, c) {
        const t0 = root.performance ? root.performance.now() : Date.now(), ms = Math.min(1600, 500 + Math.log10(Math.max(10, c.to)) * 220);
        const step = (now) => {
            const p = Math.min(1, ((now || Date.now()) - t0) / ms), e = 1 - Math.pow(1 - p, 3);
            el.textContent = p < 1 ? c.fmt(c.to * e) : c.text;
            if (p < 1) root.requestAnimationFrame(step);
        };
        root.requestAnimationFrame(step);
    }
    function countOf(el) {
        const text = el.textContent;
        const m = /^(\D*?)(\d(?:[\d.,\s ]*\d)?)(\D*)$/.exec(text.trim());
        if (!m) return null;
        const digits = m[2].replace(/[\s ]/g, '');
        const dec = /[.,]\d{1,2}$/.test(digits) && !/^\d{1,3}([.,]\d{3})+$/.test(digits) ? digits.slice(-3).replace(/^\D/, '').length : 0;
        const to = Number(dec ? digits.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.') : digits.replace(/[.,]/g, ''));
        if (!Number.isFinite(to) || to <= 0) return null;
        const nf = new Intl.NumberFormat(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
        return { to, text, fmt: (v) => m[1] + nf.format(v) + m[3] };
    }

    // ── Pointer effects ──
    function ripple(el, ev) {
        if (reduced()) return;
        const r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
        const s = doc.createElement('span'); s.className = 'ovfx-rip';
        s.style.cssText = `width:${d}px;height:${d}px;left:${(ev.clientX || r.left + r.width / 2) - r.left - d / 2}px;top:${(ev.clientY || r.top + r.height / 2) - r.top - d / 2}px`;
        el.appendChild(s); root.setTimeout(() => s.remove(), 650);
    }
    function tilt(el) {
        let raf = 0;
        el.addEventListener('pointermove', (ev) => {
            if (ev.pointerType !== 'mouse' || reduced() || raf) return;
            raf = root.requestAnimationFrame(() => {
                raf = 0;
                const r = el.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5;
                el.style.transform = `perspective(900px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 7).toFixed(2)}deg)`;
            });
        });
        el.addEventListener('pointerleave', () => { if (raf) { root.cancelAnimationFrame(raf); raf = 0; } el.style.transform = ''; });
    }

    // ── Confetti: one canvas, about 1.6 s, then gone ──
    function confetti(opts) {
        if (reduced() || !doc.body) return false;
        const o = opts || {}, cs = root.getComputedStyle(doc.documentElement);
        const accent = (cs.getPropertyValue('--accent') || '').trim() || '#4f7cff';
        const colors = o.colors || [accent, '#4f7cff', '#8b5cf6', '#22c55e', '#facc15', '#f472b6'];
        const cv = doc.createElement('canvas'); cv.className = 'ovfx-confetti'; cv.setAttribute('aria-hidden', 'true');
        const dpr = Math.min(2, root.devicePixelRatio || 1), W = root.innerWidth, H = root.innerHeight;
        cv.width = W * dpr; cv.height = H * dpr; doc.body.appendChild(cv);
        const ctx = cv.getContext('2d'); if (!ctx) { cv.remove(); return false; }
        ctx.scale(dpr, dpr);
        const x0 = o.x == null ? W / 2 : o.x, y0 = o.y == null ? H / 3 : o.y, n = Math.min(160, o.count || 80);
        const ps = Array.from({ length: n }, (_, i) => {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9, v = 6 + Math.random() * 7;
            return { x: x0, y: y0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, w: 5 + Math.random() * 5, h: 3 + Math.random() * 4, c: colors[i % colors.length], round: Math.random() < 0.3 };
        });
        const t0 = Date.now();
        const frame = () => {
            const t = (Date.now() - t0) / 1600;
            ctx.clearRect(0, 0, W, H);
            ps.forEach((p) => {
                p.vy += 0.28; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
                ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 0.6) / 0.4); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
                if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.h / 1.6, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            });
            if (t < 1 && !doc.hidden) root.requestAnimationFrame(frame); else cv.remove();
        };
        root.requestAnimationFrame(frame);
        return true;
    }

    // ── Wiring ──
    function wire(el) {
        if (done.has(el)) return;
        done.add(el);
        const names = String(el.getAttribute('data-fx') || '').toLowerCase().split(/\s+/).filter(Boolean);
        for (const n of names) {
            if (n === 'glint' || n === 'glow' || n === 'lift' || n === 'press' || n === 'ripple' || n === 'shimmer') el.classList.add(`ovfx-${n}`);
            if (n === 'ripple') el.addEventListener('pointerdown', (ev) => ripple(el, ev));
            if (n === 'tilt' && fine()) { el.classList.add('ovfx-tilt'); tilt(el); }
            if (n === 'confetti') el.addEventListener('click', () => { const r = el.getBoundingClientRect(); confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 70 }); });
            if (n === 'reveal' && !reduced()) {
                const kids = el.children.length && el.getAttribute('data-fx-self') == null ? Array.from(el.children) : [el];
                if (!below(el)) continue;   // already on screen when wired: never hide what someone can see
                const gap = Math.max(0, Math.min(200, Number(el.getAttribute('data-fx-stagger')) || 50));
                kids.forEach((k, i) => { k.classList.add('ovfx-hide'); k.style.setProperty('--ovfx-d', `${Math.min(i, 12) * gap}ms`); });
                el.__ovfxReveal = kids; observe(el);
            }
            if (n === 'count' && !reduced()) {
                const c = countOf(el);
                if (c && below(el)) { el.__ovfxCount = c; observe(el); } else if (c) { el.__ovfxCount = c; seen(el); }
            }
        }
    }
    function scan(scope) {
        const base = scope && scope.querySelectorAll ? scope : doc;
        if (base.matches && base.matches('[data-fx]')) wire(base);
        base.querySelectorAll('[data-fx]').forEach(wire);
    }
    function init() {
        css();
        scan(doc);
        if ('MutationObserver' in root) new root.MutationObserver((rs) => rs.forEach((r) => r.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n); }))).observe(doc.documentElement, { childList: true, subtree: true });
    }

    root.OVFx = { scan, confetti, wire, FEEL: { CALM, SNAPPY } };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this);
