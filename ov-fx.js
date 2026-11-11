/**
 * openvibe-shared/ov-fx.js — the network's effects, one kit (plan L45, 4.66.0). The mark's motion (4.65.0: a glint,
 * a glow, a press) for anything on any OpenVibe page, plus reveals, counting numbers, a ripple, a tilt and confetti.
 * navbar.js loads it from beside itself once the page settles, and only when the page has an element with data-fx.
 *
 *   <a class="card" data-fx="glint lift press">…</a>     effects by name, any number of them
 *   <section data-fx="reveal" data-fx-stagger="40">…</section>
 *                                                      its heading rises 12 px (8 on a phone) out of a 4 px blur,
 *                                                      a [data-fx-rule] draws from the left, and its cards follow in
 *                                                      40 ms steps (at most six; the rest together), once.
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
 * element coming on screen, plays once, and stops. Calm (the person's choice, or the device asking for less motion:
 * html[data-ov-motion=reduced]) keeps every effect and makes it smaller and slower: a lift rises a pixel, a tilt
 * leans a third as far, a burst of confetti is a third the size, nothing overshoots; a reveal keeps only a short
 * fade. Only Off (html[data-ov-motion=off]) stops them: reveals and numbers are simply there, and no confetti falls.
 *
 * The reveal (278) is driven by the scroll timeline where the browser has animation-timeline: view(), so no script
 * runs on the main thread while scrolling; elsewhere one shared IntersectionObserver does the same job. Content is
 * visible by default: the start state is only applied (a) by CSS inside @supports, or (b) to elements the script
 * knows are below the fold, with an observer ready to show them. A heading is [data-fx-heading] or the first h1–h6
 * in the container; a rule is [data-fx-rule] (or an <hr>); cards are [data-fx-card]s, the container's own children,
 * or the children of a plain list/grid child. Point at them with data-fx-cards="selector" when the markup is not
 * one of those shapes. data-fx-self reveals the element itself. Distances halve on a phone, Calm fades, Off is still.
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
        + 'html[data-ov-motion=reduced]{--ov-move:.35;--ov-dur-1:.15s;--ov-dur-2:.25s;--ov-dur-3:.4s;--ov-dur-4:.62s;--ov-ease-spring:var(--ov-ease-out)}'
        + '@media (prefers-reduced-motion:reduce){html:not([data-ov-motion]){--ov-move:.35;--ov-dur-1:.15s;--ov-dur-2:.25s;--ov-dur-3:.4s;--ov-dur-4:.62s;--ov-ease-spring:var(--ov-ease-out)}}'
        + 'html[data-ov-motion=off]{--ov-move:0;--ov-dur-1:0s;--ov-dur-2:0s;--ov-dur-3:0s;--ov-dur-4:0s}'
        // A demo scope plays in full whatever the page's motion is, in the look's own feel.
        + '[data-fx-demo]{--ov-move:1;--ov-ease-spring:cubic-bezier(.34,1.56,.64,1);--ov-dur-1:.12s;--ov-dur-2:.2s;--ov-dur-3:.32s;--ov-dur-4:.52s}'
        + `html:is(${CALM}) [data-fx-demo]{--ov-dur-1:.15s;--ov-dur-2:.25s;--ov-dur-3:.4s;--ov-dur-4:.62s}`
        + `html:is(${SNAPPY}) [data-fx-demo]{--ov-dur-1:.09s;--ov-dur-2:.15s;--ov-dur-3:.24s;--ov-dur-4:.42s}`
        + '.ovfx-glint{position:relative;overflow:hidden;isolation:isolate}'
        + '.ovfx-glint::after{content:"";position:absolute;inset:-2px;pointer-events:none;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.28) 50%,transparent 65%);transform:translateX(-120%);z-index:1}'
        + '.ovfx-glint:hover::after,.ovfx-glint:focus-visible::after{transform:translateX(120%);transition:transform .75s var(--ov-ease-in-out)}'
        + '.ovfx-glow{transition:box-shadow var(--ov-dur-3) var(--ov-ease-out)}'
        + '.ovfx-glow:hover,.ovfx-glow:focus-visible{box-shadow:0 0 0 1px color-mix(in srgb,var(--accent,#4f7cff) 45%,transparent),0 10px 34px -10px color-mix(in srgb,var(--accent,#4f7cff) 70%,transparent)}'
        + '.ovfx-lift{transition:transform var(--ov-dur-3) var(--ov-ease-spring),box-shadow var(--ov-dur-3) var(--ov-ease-out)}'
        + '.ovfx-lift:hover{transform:translateY(calc(-3px * var(--ov-move,1)));box-shadow:0 12px 28px -14px rgba(0,0,0,.45)}'
        + '.ovfx-press{transition:transform var(--ov-dur-4) var(--ov-ease-spring)}'
        + '.ovfx-press:active{transform:scale(calc(1 - .04 * var(--ov-move,1)));transition-duration:var(--ov-dur-1)}'
        + '.ovfx-lift.ovfx-press:active{transform:translateY(calc(-1px * var(--ov-move,1))) scale(calc(1 - .03 * var(--ov-move,1)))}'
        + '.ovfx-ripple{position:relative;overflow:hidden;isolation:isolate}'
        + '.ovfx-rip{position:absolute;border-radius:50%;pointer-events:none;background:currentColor;opacity:.22;transform:scale(0);animation:ovfxRip .6s var(--ov-ease-out) forwards}'
        + '@keyframes ovfxRip{to{transform:scale(1);opacity:0}}'
        + '.ovfx-tilt{transition:transform var(--ov-dur-3) var(--ov-ease-out);transform-style:preserve-3d;will-change:transform}'
        // The reveal (278): a heading out of a blur, its rule drawing from the left, then its cards. The scroll timeline
        // plays it where view() exists; the classes only carry the start state, so the page is never left blank by CSS.
        + '.ovfx-head{--ovfx-rise:12px}.ovfx-card{--ovfx-card-rise:10px}'
        + '@media (max-width:600px){.ovfx-head{--ovfx-rise:8px}.ovfx-card{--ovfx-card-rise:6px}}'
        + '.ovfx-rule{transform-origin:left center}'
        + '@keyframes ovfxHeadRise{from{opacity:0;transform:translateY(calc(var(--ovfx-rise,12px) * var(--ov-move,1)));filter:blur(4px)}to{opacity:1;transform:none;filter:blur(0)}}'
        + '@keyframes ovfxCardRise{from{opacity:0;transform:translateY(calc(var(--ovfx-card-rise,10px) * var(--ov-move,1)))}to{opacity:1;transform:none}}'
        + '@keyframes ovfxRuleDraw{from{transform:scaleX(0);opacity:.35}to{transform:scaleX(1);opacity:1}}'
        + '@keyframes ovfxFadeIn{from{opacity:0}to{opacity:1}}'
        + '@supports (animation-timeline:view()){.ovfx-head.ovfx-scroll{animation:ovfxHeadRise linear backwards;animation-timeline:view();animation-range:entry 0% cover 25%}.ovfx-rule.ovfx-scroll{animation:ovfxRuleDraw linear backwards;animation-timeline:view();animation-range:entry 5% cover 35%}.ovfx-card.ovfx-scroll{animation:ovfxCardRise linear backwards;animation-timeline:view();animation-range:entry calc(5% + var(--ovfx-i,0) * 3%) cover calc(30% + var(--ovfx-i,0) * 3%)}.ovfx-fade.ovfx-scroll{animation:ovfxFadeIn linear backwards;animation-timeline:view();animation-range:entry 0% cover 15%}}'
        + '.ovfx-head.ovfx-wait{opacity:0;transform:translateY(var(--ovfx-rise,12px));filter:blur(4px)}'
        + '.ovfx-head.ovfx-in{opacity:1;transform:none;filter:blur(0);transition:opacity .5s var(--ov-ease-out),transform .55s var(--ov-ease-spring),filter .45s var(--ov-ease-out)}'
        + '.ovfx-card.ovfx-wait{opacity:0;transform:translateY(var(--ovfx-card-rise,10px))}'
        + '.ovfx-card.ovfx-in{opacity:1;transform:none;transition:opacity .45s var(--ov-ease-out),transform .55s var(--ov-ease-spring);transition-delay:var(--ovfx-d,0ms)}'
        + '.ovfx-rule.ovfx-wait{transform:scaleX(0);opacity:.35}'
        + '.ovfx-rule.ovfx-in{transform:scaleX(1);opacity:1;transition:transform .6s var(--ov-ease-out) 80ms,opacity .4s var(--ov-ease-out) 80ms}'
        + '.ovfx-fade.ovfx-wait{opacity:0}'
        + '.ovfx-fade.ovfx-in{opacity:1;transition:opacity .28s var(--ov-ease-out)}'
        + 'html[data-ov-motion=reduced] :is(.ovfx-head,.ovfx-card,.ovfx-rule).ovfx-scroll:not([data-fx-demo] *){animation-name:ovfxFadeIn;animation-range:entry 0% cover 15%}'
        + 'html[data-ov-motion=reduced] :is(.ovfx-head,.ovfx-card).ovfx-wait:not([data-fx-demo] *){opacity:0;transform:none;filter:none}'
        + 'html[data-ov-motion=reduced] :is(.ovfx-head,.ovfx-card).ovfx-in:not([data-fx-demo] *){opacity:1;transform:none;filter:none;transition:opacity .28s var(--ov-ease-out)}'
        + '@media (prefers-reduced-motion:reduce){html:not([data-ov-motion]) :is(.ovfx-head,.ovfx-card,.ovfx-rule).ovfx-scroll:not([data-fx-demo] *){animation-name:ovfxFadeIn;animation-range:entry 0% cover 15%}html:not([data-ov-motion]) :is(.ovfx-head,.ovfx-card).ovfx-wait:not([data-fx-demo] *){opacity:0;transform:none;filter:none}html:not([data-ov-motion]) :is(.ovfx-head,.ovfx-card).ovfx-in:not([data-fx-demo] *){opacity:1;transform:none;filter:none;transition:opacity .28s var(--ov-ease-out)}}'
        + 'html[data-ov-motion=off] :is(.ovfx-head,.ovfx-card,.ovfx-rule,.ovfx-fade):not([data-fx-demo] *){animation:none!important;transition:none!important}'
        + 'html[data-ov-motion=off] :is(.ovfx-head,.ovfx-card,.ovfx-rule,.ovfx-fade).ovfx-wait:not([data-fx-demo] *){opacity:1!important;transform:none!important;filter:none!important}'
        + '.ovfx-shimmer{background:linear-gradient(100deg,color-mix(in srgb,var(--text-muted,#8b93ad) 12%,transparent) 30%,color-mix(in srgb,var(--text-muted,#8b93ad) 22%,transparent) 50%,color-mix(in srgb,var(--text-muted,#8b93ad) 12%,transparent) 70%) 0 0/300% 100%;animation:ovfxShim 1.4s linear infinite;color:transparent!important;border-radius:8px}'
        + '@keyframes ovfxShim{from{background-position:100% 0}to{background-position:0 0}}'
        + '.ovfx-confetti{position:fixed;inset:0;pointer-events:none;z-index:2147483000}'
        // Calm: the sheen crosses fainter and slower, the ripple is fainter. Off: no sheen, no shimmer, nothing fades in.
        + 'html[data-ov-motion=reduced] .ovfx-glint:not([data-fx-demo] *)::after{opacity:.55}html[data-ov-motion=reduced] .ovfx-glint:not([data-fx-demo] *):is(:hover,:focus-visible)::after{transition-duration:1.1s}html[data-ov-motion=reduced] .ovfx-rip:not([data-fx-demo] *){opacity:.14}'
        + 'html[data-ov-motion=off] .ovfx-glint:not([data-fx-demo] *)::after{display:none}html[data-ov-motion=off] .ovfx-shimmer:not([data-fx-demo] *){animation:none}html[data-ov-motion=off] :is(.ovfx-in,.ovfx-lift,.ovfx-press,.ovfx-tilt):not([data-fx-demo] *){transition:none!important}';

    // The demo scope (4.180.0): inside [data-fx-demo] the effects play in full whatever the page's motion is. A page
    // that exists to show motion sets it on one container, only after the person presses a button that says so.
    const demo = (el) => !!(el && el.closest && el.closest('[data-fx-demo]'));
    // How far things move here: 1 in full, CALM_MOVE under Calm, 0 when motion is off. <html data-ov-motion> is the signal
    // (theme-loader.js writes it, the device's own setting counted in); a page without the loader asks the device.
    const CALM_MOVE = 0.35;
    const move = (el) => {
        if (demo(el)) return 1;
        const m = doc.documentElement.getAttribute('data-ov-motion');
        if (m === 'off') return 0;
        if (m === 'reduced') return CALM_MOVE;
        return !m && root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches ? CALM_MOVE : 1;
    };
    const off = (el) => move(el) === 0;
    const fine = () => !!(root.matchMedia && root.matchMedia('(hover: hover) and (pointer: fine)').matches);
    const done = new WeakSet();
    let io = null;

    function css() {
        if (doc.getElementById('ov-fx-css')) return;
        const st = doc.createElement('style'); st.id = 'ov-fx-css'; st.textContent = CSS; (doc.head || doc.documentElement).appendChild(st);
    }

    // ── Seen: reveal and count, once each, when they come on screen ──
    function observe(el, fn) {
        if (!('IntersectionObserver' in root)) return fn(el);
        io = io || new root.IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); (e.target.__ovfxSeen || fn)(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
        el.__ovfxSeen = fn;
        io.observe(el);
    }
    const below = (el) => { try { return el.getBoundingClientRect().top > (root.innerHeight || 0); } catch (e) { return false; } };
    function seenCount(el) { const c = el.__ovfxCount; if (c) { el.__ovfxCount = null; countUp(el, c); } }

    // ── Reveal (278): a heading, its rule and its cards, once. The scroll timeline (where view() exists) plays it
    // without any script on the main thread; the shared observer is the fallback. Only elements the script knows are
    // below the fold ever get a start state, and every path has a way back to the finished state.
    const HEAD_SEL = 'h1,h2,h3,h4,h5,h6';
    const CARDISH = 'li,article,a,[data-fx-card],[class*="card"],[class*="tile"],[class*="item"]';
    function findHead(el) {
        if (el.hasAttribute('data-fx-self')) return el;
        const marked = el.querySelector('[data-fx-heading]');
        if (marked) return marked;
        if (el.matches(HEAD_SEL)) return el;
        for (const h of el.querySelectorAll(HEAD_SEL)) {
            const card = h.closest(CARDISH);
            if (card && card !== el && el.contains(card)) continue;   // a card's own title is not the section's heading
            let depth = 0, p = h;
            while (p && p !== el) { p = p.parentElement; depth++; }
            if (depth <= 3) return h;
        }
        return null;
    }
    function findRule(el, head) {
        const marked = el.querySelector('[data-fx-rule]');
        if (marked && marked !== head) return marked;
        const hr = el.querySelector('hr');
        return hr && hr !== head ? hr : null;
    }
    function findCards(el, head, rule) {
        const sel = el.getAttribute('data-fx-cards');
        if (sel) { try { const list = Array.from(el.querySelectorAll(sel)); if (list.length) return list; } catch (e) { /* the default below */ } }
        const marked = Array.from(el.querySelectorAll('[data-fx-card]'));
        if (marked.length) return marked;
        const out = [];
        for (const k of Array.from(el.children)) {
            if (k === head || k === rule || (head && k.contains(head)) || (rule && k.contains(rule))) continue;
            const cls = typeof k.className === 'string' ? k.className : '';
            if (k.matches('ul,ol,[role="list"]') || /(^|[\s_-])(grid|cards|rail|row|list)([\s_-]|$)/i.test(cls)) {
                const inner = Array.from(k.children);
                if (inner.length) { out.push(...inner); continue; }
            }
            out.push(k);
        }
        return out;
    }
    let viewTimeline = null;
    function hasViewTimeline() {
        if (viewTimeline != null) return viewTimeline;
        try { viewTimeline = !!(root.CSS && root.CSS.supports && root.CSS.supports('animation-timeline: view()')); } catch (e) { viewTimeline = false; }
        return viewTimeline;
    }
    function showReveal(el) {
        if (el.__ovfxShown) return;
        el.__ovfxShown = true;
        el.classList.add('ovfx-in');
        const delay = Number(String(el.style.getPropertyValue('--ovfx-d')).replace('ms', '')) || 0;
        root.setTimeout(() => { el.classList.remove('ovfx-wait', 'ovfx-in'); el.style.removeProperty('--ovfx-d'); }, 900 + delay);
    }
    function wireReveal(el) {
        if (off(el)) return;
        const mode = demo(el) ? 'full' : move(el) < 1 ? 'fade' : 'full';
        const self = el.hasAttribute('data-fx-self');
        const head = findHead(el), rule = self ? null : findRule(el, head), cards = self ? [] : findCards(el, head, rule);
        const parts = [];
        if (head) parts.push([head, 'head', 0]);
        if (rule) parts.push([rule, 'rule', 0]);
        cards.forEach((k, i) => parts.push([k, 'card', Math.min(i, 5)]));
        if (!parts.length) return;
        // Never hide what someone can already see: a section below the fold is safe whole, one already on screen
        // is checked part by part.
        const live = below(el) ? parts : parts.filter(([k]) => below(k));
        if (!live.length) return;
        const timeline = hasViewTimeline();
        if (!timeline && !('IntersectionObserver' in root)) return;
        const gap = Math.max(0, Math.min(200, Number(el.getAttribute('data-fx-stagger')) || 40));
        const follow = head ? 140 : 0;
        live.forEach(([k, kind, i]) => {
            k.classList.add(mode === 'fade' ? 'ovfx-fade' : kind === 'head' ? 'ovfx-head' : kind === 'rule' ? 'ovfx-rule' : 'ovfx-card');
            if (timeline) {
                k.classList.add('ovfx-scroll');
                if (kind === 'card') k.style.setProperty('--ovfx-i', String(i));
            } else {
                k.classList.add('ovfx-wait');
                if (kind === 'card' && mode === 'full') k.style.setProperty('--ovfx-d', `${follow + i * gap}ms`);
                observe(k, showReveal);
            }
        });
    }

    function countUp(el, c) {
        const t0 = root.performance ? root.performance.now() : Date.now(), ms = Math.min(1600, 500 + Math.log10(Math.max(10, c.to)) * 220) * (move(el) < 1 ? 0.6 : 1);
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
        if (off(el)) return;
        const r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
        const s = doc.createElement('span'); s.className = 'ovfx-rip';
        s.style.cssText = `width:${d}px;height:${d}px;left:${(ev.clientX || r.left + r.width / 2) - r.left - d / 2}px;top:${(ev.clientY || r.top + r.height / 2) - r.top - d / 2}px`;
        el.appendChild(s); root.setTimeout(() => s.remove(), 650);
    }
    function tilt(el) {
        let raf = 0;
        el.addEventListener('pointermove', (ev) => {
            if (ev.pointerType !== 'mouse' || off(el) || raf) return;
            raf = root.requestAnimationFrame(() => {
                raf = 0;
                const r = el.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5;
                const k = move(el);
                el.style.transform = `perspective(900px) rotateX(${(-y * 6 * k).toFixed(2)}deg) rotateY(${(x * 7 * k).toFixed(2)}deg)`;
            });
        });
        el.addEventListener('pointerleave', () => { if (raf) { root.cancelAnimationFrame(raf); raf = 0; } el.style.transform = ''; });
    }

    // ── Confetti: one canvas, about 1.6 s, then gone. Calm: a third of the pieces, thrown half as hard ──
    function confetti(opts) {
        const k = move(opts && opts.from);
        if (!k || !doc.body) return false;
        const o = opts || {}, cs = root.getComputedStyle(doc.documentElement);
        const accent = (cs.getPropertyValue('--accent') || '').trim() || '#4f7cff';
        const colors = o.colors || [accent, '#4f7cff', '#8b5cf6', '#22c55e', '#facc15', '#f472b6'];
        const cv = doc.createElement('canvas'); cv.className = 'ovfx-confetti'; cv.setAttribute('aria-hidden', 'true');
        const dpr = Math.min(2, root.devicePixelRatio || 1), W = root.innerWidth, H = root.innerHeight;
        cv.width = W * dpr; cv.height = H * dpr; doc.body.appendChild(cv);
        const ctx = cv.getContext('2d'); if (!ctx) { cv.remove(); return false; }
        ctx.scale(dpr, dpr);
        const x0 = o.x == null ? W / 2 : o.x, y0 = o.y == null ? H / 3 : o.y, n = Math.max(8, Math.round(Math.min(160, o.count || 80) * (k < 1 ? k : 1))), throwBy = k < 1 ? 0.55 : 1;
        const ps = Array.from({ length: n }, (_, i) => {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9, v = (6 + Math.random() * 7) * throwBy;
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
            if (n === 'confetti') el.addEventListener('click', () => { const r = el.getBoundingClientRect(); confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 70, from: el }); });
            if (n === 'reveal') wireReveal(el);
            if (n === 'count' && !off(el)) {
                const c = countOf(el);
                if (c && below(el)) { el.__ovfxCount = c; observe(el, seenCount); } else if (c) { el.__ovfxCount = c; seenCount(el); }
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

    root.OVFx = { scan, confetti, wire, move, FEEL: { CALM, SNAPPY } };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this);
