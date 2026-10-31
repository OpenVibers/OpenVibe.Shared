/**
 * ov-mark.js — the OpenVibe mark as a drop-in.
 *   <span class="ov-mark"></span>                 → 32px mark
 *   <span class="ov-mark" data-size="56">         → any size; add data-static="1" for no motion
 *   <span class="ov-mark" data-variant="live">    → the site's own dot colour and rhythm (see the variants below)
 *   <span class="ov-mark" data-form="solid|line"> → force a form (default: solid up to 24px, the line above)
 *   data-state="busy|ok|error|no|notify|live|sleep" → what it shows (island.js sets busy/ok/error on the navbar's)
 *   data-progress="0.4" with style="--ovm-p:.4"    → a known progress: the coin fills to that level
 * Self-contained: injects its own CSS once, works on any page (Live, Network, static pages).
 *
 * The mark is the Loop (the owner, 2026-10-31, from OpenVibe Mark Systems: "use the one that's easiest to see across
 * all these resolutions and add lots of animations to it"). One shape, two forms:
 *   - the line: an O opened at the top by a V, one stroke, with the site's dot in the opening (headers, the navbar);
 *   - the solid: the same circle filled, with the V cut through it (16-24px, where a line would blur).
 * Between them the coin's fill rises and drains, and that fill is also the progress: following a link, the navbar's mark
 * fills as the next page loads, paced by how long this site's pages usually take in this browser (learned per site,
 * boost moves and full loads apart), and drains back to the line when the page is here (window.OVMark.navStart/navEnd
 * for single-page apps). Nothing spins: busy is the dot hopping in the V, ok fills the coin green, an error shakes and
 * drops the dot into the V, live sends ripples out from the ring.
 *
 * Motion budget: SVG animations restyle and re-lay-out on the main thread every frame, so an endlessly moving mark kept
 * idle pages 12-29% busy (browser check, OpenVibe.Host). A mark moves only for its intro (the first INTRO_MS of a
 * visit, from the first time a mark is on screen in this tab; later pages of a multi-page site open with the mark at
 * rest), while it or its link is hovered or focused (and LINGER_MS after), and while it shows a state, a page load or
 * progress. Otherwise its CSS animations are paused where they are. It never moves while the page is hidden, while it
 * is off-screen (IntersectionObserver), with data-static, under prefers-reduced-motion or under the network's own
 * reduced-motion setting (html[data-ov-motion=reduced], theme-loader.js); its colours and fill still change.
 *
 * The season (theme-loader.js sets <html data-ov-season-mark="halloween|winter"> for anyone who has not turned seasonal
 * themes off, on any theme): the mark wears it, a pumpkin's stem and leaf in October, caps of snow in December.
 * Now and then (every 4 to 8 minutes) a mark on screen flickers for a moment, and on the first visit of the day a few
 * leaves (snowflakes in December) drift down from the first mark seen. Never under either reduced-motion setting.
 */
(function () {
    'use strict';
    if (window.__ovMark) return; window.__ovMark = true;
    let n = 0;
    // The Loop in a 48-unit box (the coin's V cut is the line's V plus a 1.7-unit gap each side, so a filling coin keeps
    // the V visible as an inlay): ring radius 15.84, opened 33° each side of the top, the V's point just under the
    // middle, stroke 6.24. Centred on (24, 24) with its dot; the solid form (no dot) moves up SOLID_DY to stay centred.
    const GEO = (() => {
        const r = 15.84, a = 33 * Math.PI / 180, sw = 6.24, cy = 25, f = (v) => +v.toFixed(2);
        const lx = r * Math.sin(a), ly = -r * Math.cos(a);
        const L = [f(24 - lx), f(cy + ly)], Rt = [f(24 + lx), f(cy + ly)], T = [24, f(cy + 0.96)];
        const at = (deg, rr) => [f(24 + rr * Math.cos(deg * Math.PI / 180)), f(cy + rr * Math.sin(deg * Math.PI / 180))];
        const cap = (d0, d1) => { const p = at(d0, r + sw / 2 + 1.2), q = at(d1, r + sw / 2 + 1.2); return `M${p[0]} ${p[1]}A${f(r + sw / 2 + 1.2)} ${f(r + sw / 2 + 1.2)} 0 0 1 ${q[0]} ${q[1]}`; };
        return {
            r, sw, cy, R: f(r + sw / 2), dotY: f(cy + ly - 4.32), dotR: 3.36,
            loop: `M${L[0]} ${L[1]}A${r} ${r} 0 1 0 ${Rt[0]} ${Rt[1]}L${T[0]} ${T[1]}Z`,
            vee: `M${L[0]} ${L[1]}L${T[0]} ${T[1]}L${Rt[0]} ${Rt[1]}`,
            snow: [cap(-162, -128), cap(-52, -18)], flake: [at(-150, r + 7.6), at(-36, r + 7.2)],
            // The fill's clip slides up from below the coin (0) to its top (1): translateY in user units.
            fill0: f(cy + r + sw / 2 + 4), span: f(2 * (r + sw / 2)),
        };
    })();
    const SOLID_DY = -2.28;
    const CSS = `
@property --ovm-fill{syntax:'<number>';inherits:true;initial-value:0}
.ov-mark{display:inline-grid;place-items:center;width:32px;height:32px;color:var(--accent,#8b5cf6);flex:none;vertical-align:middle;line-height:0;--ovm-to:color-mix(in oklab,currentColor 45%,#a78bfa);--ovm-fill:0;transition:--ovm-fill .55s cubic-bezier(.3,.8,.2,1),color .35s}
.ov-mark svg{width:100%;height:100%;overflow:visible}
.ov-mark .m{transform-box:view-box;transform-origin:24px 24px;transition:translate .35s}
.ov-mark .fr{transform-box:view-box;transform:translateY(calc((${GEO.fill0} - var(--ovm-fill) * ${GEO.span + 4}) * 1px))}
.ov-mark .lp{fill:none;stroke-width:${GEO.sw};stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:100;stroke-dashoffset:0;transition:opacity .3s}
.ov-mark .d{fill:var(--ovm-dot,var(--text-primary,#fff));transform-box:fill-box;transform-origin:center;transition:opacity .3s,fill .35s}
.ov-mark .rp{fill:none;stroke:var(--danger,#ef4444);stroke-width:1.6;opacity:0;transform-box:fill-box;transform-origin:center}
/* The solid form: the coin, the line hidden in it, the dot away (it would vanish into the disc). */
.ov-mark[data-form=solid]{--ovm-fill:1}
.ov-mark[data-form=solid] .m{translate:0 ${SOLID_DY}px}
.ov-mark[data-form=solid] .lp,.ov-mark[data-form=solid] .d{opacity:0}
/* Hover and focus: the line fills into the coin and drains again when let go. */
a:hover>.ov-mark:not([data-form=solid]),button:hover>.ov-mark:not([data-form=solid]),.ov-mark:not([data-form=solid]):hover,a:focus-visible>.ov-mark:not([data-form=solid]){--ovm-fill:1}
a:hover>.ov-mark .d,button:hover>.ov-mark .d,.ov-mark:hover .d{animation:ovmHop .6s cubic-bezier(.3,.7,.4,1) 1}
/* A page on its way, or a known progress: the coin fills to the level; the line stays drawn over it. */
.ov-mark[data-nav],.ov-mark[data-progress]{transition:--ovm-fill .3s linear,color .35s}
.ov-mark[data-progress]{--ovm-fill:var(--ovm-p,0)}
.ov-mark[data-nav] .lp,.ov-mark[data-progress] .lp{opacity:1}
.ov-mark[data-nav] .m,.ov-mark[data-progress] .m{translate:none}
.ov-mark[data-nav] .d,.ov-mark[data-progress] .d{opacity:0}
/* The states. */
.ov-mark[data-state=busy] .d{animation:ovmHop .82s ease-in-out infinite}
.ov-mark[data-state=busy][data-form=solid] .m{animation:ovmBreathe 1.1s ease-in-out infinite}
.ov-mark[data-state=ok]{color:var(--success,#22c55e)!important;--ovm-fill:1}
.ov-mark[data-state=ok] .m{animation:ovmPop .55s cubic-bezier(.3,1.5,.5,1) 1}
.ov-mark[data-state=error]{color:var(--danger,#ef4444)!important;--ovm-dot:var(--danger,#ef4444)}
.ov-mark[data-state=error] .m{animation:ovmShake .56s ease-in-out 1}
.ov-mark[data-state=error] .d{animation:ovmDrop .7s ease-in 1 both}
.ov-mark[data-state=no]{color:var(--text-muted,#94a3b8)!important}
.ov-mark[data-state=no] .m{animation:ovmNo .52s ease-in-out 1}
.ov-mark[data-state=notify] .d{animation:ovmPing .76s ease-out 2}
.ov-mark[data-state=live]{--ovm-dot:var(--danger,#ef4444)}
.ov-mark[data-state=live] .d{animation:ovmOnAir 1.4s ease-in-out infinite}
.ov-mark[data-state=live] .rp{animation:ovmRipple 1.6s ease-out infinite}
.ov-mark[data-state=live] .rp2{animation-delay:.8s}
.ov-mark[data-state=sleep] svg{filter:grayscale(1);opacity:.7}
.ov-mark[data-state=sleep] .d{transform:translateY(5.2px);transition:transform .6s,opacity .3s}
/* The intro: the line draws itself, then the dot drops into the opening; the coin pops. */
.ov-mark[data-ovm-intro]:not([data-form=solid]) .lp{animation:ovmDraw 1.1s cubic-bezier(.3,.8,.2,1) both}
.ov-mark[data-ovm-intro]:not([data-form=solid]) .d{animation:ovmIn .5s cubic-bezier(.3,1.5,.5,1) .85s both}
.ov-mark[data-ovm-intro][data-form=solid] .m{animation:ovmPop .6s cubic-bezier(.3,1.5,.5,1) both}
/* Per-site rhythm: one family, each site with its own dot and pace. Colours stay with the theme (currentColor). */
.ov-mark[data-variant=live]{--ovm-dot:#ef4444}
.ov-mark[data-variant=live][data-ovm-run]:not([data-state]) .d{animation:ovmOnAir 1.4s ease-in-out infinite}
.ov-mark[data-variant=vip]{--ovm-dot:#facc15}
.ov-mark[data-variant=tips]{--ovm-dot:#22c55e}
.ov-mark[data-variant=deals],.ov-mark[data-variant=coupons]{--ovm-dot:#f59e0b}
.ov-mark[data-variant=games][data-state=busy] .d{animation-duration:.6s}
.ov-mark[data-variant=chat][data-state=busy] .d{animation-duration:.55s}
.ov-mark[data-variant=codes][data-state=busy] .d{animation-timing-function:steps(4,end)}
.ov-mark[data-variant=blog][data-state=busy] .d,.ov-mark[data-variant=wiki][data-state=busy] .d,.ov-mark[data-variant=news][data-state=busy] .d{animation-duration:1.2s}
@keyframes ovmHop{0%,100%{transform:translateY(0) scale(1)}45%{transform:translateY(5.2px) scale(1.1,.84)}55%{transform:translateY(5.2px) scale(.92,1.1)}}
@keyframes ovmBreathe{0%,100%{transform:scale(1)}50%{transform:scale(.9)}}
@keyframes ovmPop{0%{transform:scale(.6)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
@keyframes ovmShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-3.2px)}30%{transform:translateX(3.2px)}45%{transform:translateX(-2.6px)}60%{transform:translateX(2.6px)}80%{transform:translateX(-1.2px)}}
@keyframes ovmNo{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}50%{transform:translateX(2px)}75%{transform:translateX(-1.5px)}}
@keyframes ovmDrop{0%{transform:translateY(0)}55%{transform:translateY(5.6px)}70%{transform:translateY(4.2px)}100%{transform:translateY(5.6px)}}
@keyframes ovmPing{0%{transform:scale(1)}30%{transform:scale(1.6)}55%{transform:scale(.9)}75%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes ovmOnAir{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.35);opacity:1}}
@keyframes ovmRipple{0%{transform:scale(1);opacity:.65}100%{transform:scale(1.4);opacity:0}}
@keyframes ovmDraw{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
@keyframes ovmIn{from{transform:scale(0)}to{transform:scale(1)}}
.ov-mark[data-static] *{animation:none!important}
.ov-mark[data-ov]:not([data-ovm-run]) *{animation-play-state:paused!important}
.ov-mark .sh,.ov-mark .sw2{display:none}
html[data-ov-season-mark=halloween] .ov-mark .sh,html[data-ov-season-mark=winter] .ov-mark .sw2{display:inline}
html[data-ov-season-mark=halloween] .ov-mark .d{display:none}
.ov-mark .ss{fill:none;stroke:#5fae3c;stroke-width:3.2;stroke-linecap:round}
.ov-mark .sl{fill:#7fd04e;transform-box:fill-box;transform-origin:0 70%}
.ov-mark .sc{fill:none;stroke:#f4fbff;stroke-width:4.6;stroke-linecap:round}
.ov-mark .sd{fill:#f4fbff}
html[data-ov-season-mark=halloween] .ov-mark{--ovm-to:#f97316}
html[data-ov-season-mark] .ov-mark[data-ovm-intro] .sl{animation:ovmLeaf .9s cubic-bezier(.3,1.6,.5,1) both}
.ov-mark[data-ovm-flourish] .sl{animation:ovmWiggle 1.2s ease-in-out 1}
.ov-mark[data-ovm-flourish] .sd{animation:ovmTwinkle 1.4s ease-in-out 1}
.ov-mark[data-ovm-flourish] .d{animation:ovmPing .76s ease-out 1}
.ovm-fall{position:fixed;width:0;height:0;pointer-events:none;z-index:10010}
.ovm-fall i{position:absolute;left:-4px;top:-4px;width:9px;height:9px;border-radius:0 70% 0 70%;opacity:0;animation:ovmFall 3s cubic-bezier(.3,.1,.5,1) forwards}
html[data-ov-season-mark=winter] .ovm-fall i{width:6px;height:6px;border-radius:50%}
@keyframes ovmLeaf{from{transform:scale(0) rotate(-50deg)}to{transform:none}}
@keyframes ovmWiggle{0%,100%{transform:none}25%{transform:rotate(-18deg)}60%{transform:rotate(12deg)}}
@keyframes ovmTwinkle{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes ovmFall{0%{opacity:0;transform:none}12%{opacity:1}72%{opacity:1;transform:translate(var(--x),var(--y)) rotate(var(--r))}100%{opacity:0;transform:translate(var(--x),var(--y)) rotate(var(--r))}}
@media (prefers-reduced-motion:reduce){.ov-mark *{animation:none!important}.ov-mark,.ov-mark .m{transition:none}.ovm-fall{display:none}}
html[data-ov-motion=reduced] .ov-mark *{animation:none!important}`;
    function svg(id) {
        const G = GEO;
        return `<svg viewBox="0 0 48 48" aria-hidden="true"><defs>
<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="currentColor"/><stop offset="1" style="stop-color:var(--ovm-to)"/></linearGradient>
<mask id="${id}v" maskUnits="userSpaceOnUse" x="-4" y="-4" width="56" height="56"><rect x="-4" y="-4" width="56" height="56" fill="#fff"/><path d="${G.vee}" fill="none" stroke="#000" stroke-width="${G.sw + 3.4}" stroke-linecap="round" stroke-linejoin="round"/></mask>
<clipPath id="${id}f"><rect class="fr" x="-4" y="-4" width="56" height="${G.span + 8}"/></clipPath></defs>
<g class="m"><circle class="rp" cx="24" cy="${G.cy}" r="${G.R}"/><circle class="rp rp2" cx="24" cy="${G.cy}" r="${G.R}"/>
<g clip-path="url(#${id}f)"><circle class="fl" cx="24" cy="${G.cy}" r="${G.R}" fill="url(#${id}g)" mask="url(#${id}v)"/></g>
<path class="lp" d="${G.loop}" pathLength="100" stroke="url(#${id}g)"/>
<circle class="d" cx="24" cy="${G.dotY}" r="${G.dotR}"/>
<g class="sh"><path class="ss" d="M24 9.6c.2-2.8 1-4.8 2.7-6.1"/><path class="sl" d="M26.4 4.6c2.3-2.5 5.8-2.7 8.3-1.2-1.9 2.7-5.4 3.5-8.3 1.2z"/></g>
<g class="sw2"><path class="sc" d="${G.snow[0]}"/><path class="sc" d="${G.snow[1]}"/><circle class="sd" cx="${G.flake[0][0]}" cy="${G.flake[0][1]}" r="1.4"/><circle class="sd" cx="${G.flake[1][0]}" cy="${G.flake[1][1]}" r="1.2"/></g></g></svg>`;
    }

    const INTRO_MS = 8000, LINGER_MS = 1200;
    const state = new WeakMap(); // mark → { introEnd, lingerEnd, hover, focus, onScreen, timer }
    let io = null, rm = null;
    // One intro per visit (tab): the deadline is kept in sessionStorage so the next page of a
    // multi-page site finishes the same intro instead of starting another.
    const INTRO_KEY = 'ov-mark-intro-end';
    function introDeadline(now) {
        let end = 0;
        try { end = Number(sessionStorage.getItem(INTRO_KEY)) || 0; } catch { /* no storage */ }
        if (!end || end > now + INTRO_MS) { end = now + INTRO_MS; try { sessionStorage.setItem(INTRO_KEY, String(end)); } catch { /* */ } }
        return end;
    }
    function reduced() {
        return !!(rm && rm.matches) || document.documentElement.getAttribute('data-ov-motion') === 'reduced';
    }
    function update(el) {
        const st = state.get(el); if (!st) return;
        const svgEl = el.querySelector('svg');
        if (!el.isConnected || !svgEl) { forget(el); return; }
        const now = Date.now();
        const may = !reduced() && !el.hasAttribute('data-static') && !document.hidden && st.onScreen === true;
        if (may && !st.introEnd) { st.introEnd = introDeadline(now); if (season()) setTimeout(() => fallOnce(el), 900); }
        const s = el.getAttribute('data-state');
        // Anything the mark is showing keeps it moving: a state, a page on its way, a known progress.
        const showing = (s && s !== 'idle') || el.hasAttribute('data-nav') || el.hasAttribute('data-progress');
        const intro = now < st.introEnd;
        const run = may && (intro || st.hover || st.focus || now < st.lingerEnd || showing);
        if (run !== el.hasAttribute('data-ovm-run')) { if (run) el.setAttribute('data-ovm-run', ''); else el.removeAttribute('data-ovm-run'); }
        // The intro's draw-in and pop are on only inside the intro (paused with the rest while the mark cannot move).
        if ((may && intro) !== el.hasAttribute('data-ovm-intro') && (may || !intro)) { if (may && intro) el.setAttribute('data-ovm-intro', ''); else el.removeAttribute('data-ovm-intro'); }
        try { if (run) svgEl.unpauseAnimations(); else svgEl.pauseAnimations(); } catch { /* no SMIL */ }
        clearTimeout(st.timer); st.timer = 0;
        const next = Math.min(...[st.introEnd, st.lingerEnd].filter((t) => t > now));
        if (run && next !== Infinity) st.timer = setTimeout(() => update(el), next - now + 20);
    }
    // A mark taken out of the page stops and is let go (a navbar re-render replaces its mark);
    // mount() picks it up again if it comes back.
    function forget(el) {
        const st = state.get(el); if (!st) return;
        clearTimeout(st.timer); state.delete(el);
        if (io) try { io.unobserve(el); } catch { /* */ }
        el.removeAttribute('data-ovm-run');
        try { el.querySelector('svg').pauseAnimations(); } catch { /* */ }
    }
    function updateAll() { document.querySelectorAll('.ov-mark[data-ov]').forEach(update); }
    // ── The season ──
    const season = () => document.documentElement.getAttribute('data-ov-season-mark');
    let flourishTimer = 0;
    function scheduleFlourish() {
        clearTimeout(flourishTimer); flourishTimer = 0;
        if (!season()) return;
        flourishTimer = setTimeout(() => {
            if (season() && !reduced() && !document.hidden) {
                document.querySelectorAll('.ov-mark[data-ov]:not([data-static])').forEach((el) => {
                    const st = state.get(el); if (!st || st.onScreen === false) return;
                    el.setAttribute('data-ovm-flourish', ''); setTimeout(() => el.removeAttribute('data-ovm-flourish'), 1700);
                });
            }
            scheduleFlourish();
        }, (4 + Math.random() * 4) * 60000);
    }
    const FALL_KEY = 'ov-season-fall';
    function fallOnce(el) {
        const id = season(); if (!id || reduced() || document.hidden || !el.isConnected) return;
        const day = id + ':' + new Date().toDateString();
        try { const ls = window.localStorage; if (ls.getItem(FALL_KEY) === day) return; ls.setItem(FALL_KEY, day); } catch { return; }
        const r = el.getBoundingClientRect(); if (!r.width || !document.body) return;
        const box = document.createElement('div'); box.className = 'ovm-fall'; box.setAttribute('aria-hidden', 'true');
        const x0 = r.left + r.width / 2, y0 = r.top + r.height * 0.6;
        box.style.left = x0 + 'px'; box.style.top = y0 + 'px';
        // The leaves land on the bottom edge of the bar the mark sits in and fade there, so they never cross a page's
        // heading (they fell 120-280 px over it on phones, 10-30). A mark outside a bar gets a short fall.
        const bar = el.closest('.openvibe-navbar,header,nav');
        const rb = bar && bar.getBoundingClientRect();
        const floor = rb && rb.bottom > y0 + 8 ? rb.bottom - y0 - 4 : 0;
        const colors = id === 'winter' ? ['#f4fbff', '#d8f3ff', '#ffffff'] : ['#ff7a1a', '#f5a524', '#d9481f', '#7fd04e'];
        for (let i = 0; i < 7; i++) {
            const s = document.createElement('i');
            const dx = Math.max(8 - x0, Math.min((window.innerWidth || 0) - 8 - x0, Math.round((Math.random() - 0.3) * 200)));
            const dy = floor ? Math.round(floor - Math.random() * 3) : Math.round(36 + Math.random() * 28);
            s.style.cssText = `--x:${dx}px;--y:${dy}px;--r:${Math.round(Math.random() * 540 - 270)}deg;animation-delay:${(i * 0.18 + Math.random() * 0.2).toFixed(2)}s;animation-duration:${(2.4 + Math.random() * 1.2).toFixed(2)}s;background:${colors[i % colors.length]}`;
            box.appendChild(s);
        }
        document.body.appendChild(box);
        setTimeout(() => box.remove(), 5200);
    }
    const bound = new WeakSet();
    function track(el) {
        state.set(el, { introEnd: 0, lingerEnd: 0, hover: false, focus: false, onScreen: io ? null : true, timer: 0 });
        if (!bound.has(el)) {
            bound.add(el);
            const host = el.closest('a,button') || el;
            const set = (k, v) => () => {
                const st = state.get(el); if (!st) return;
                st[k] = v; if (!v) st.lingerEnd = Date.now() + LINGER_MS;
                update(el);
            };
            host.addEventListener('pointerenter', set('hover', true)); host.addEventListener('pointerleave', set('hover', false));
            host.addEventListener('focusin', set('focus', true)); host.addEventListener('focusout', set('focus', false));
        }
        if (io) io.observe(el);
        update(el);
    }
    function mount(root) {
        (root || document).querySelectorAll('.ov-mark').forEach(el => {
            if (!el.hasAttribute('data-ov')) {
                el.setAttribute('data-ov', '1');
                const size = parseInt(el.getAttribute('data-size'), 10);
                if (size) { el.style.width = size + 'px'; el.style.height = size + 'px'; }
                // The form follows the size unless the page names one: a line under 24px blurs, the coin holds.
                if (!el.hasAttribute('data-form')) {
                    let px = size;
                    if (!px) { try { px = Math.round(el.getBoundingClientRect().width); } catch { px = 0; } }
                    el.setAttribute('data-form', px && px <= 24 ? 'solid' : 'line');
                }
                el.innerHTML = svg('ovm' + (++n) + '_');
            }
            if (!state.has(el) && el.isConnected) track(el);
        });
    }
    function init() {
        if (!document.getElementById('ov-mark-css')) { const st = document.createElement('style'); st.id = 'ov-mark-css'; st.textContent = CSS; document.head.appendChild(st); }
        try {
            io = new IntersectionObserver((entries) => entries.forEach((e) => {
                const st = state.get(e.target); if (!st) return;
                st.onScreen = e.isIntersecting; update(e.target);
            }));
        } catch { io = null; }
        try { rm = window.matchMedia('(prefers-reduced-motion: reduce)'); rm.addEventListener('change', updateAll); } catch { rm = null; }
        document.addEventListener('visibilitychange', updateAll);
        mount();
        hookNav();
        scheduleFlourish();
        try {
            new MutationObserver((records) => {
                let added = false;
                for (const r of records) {
                    if (r.type === 'attributes') { if (r.target === document.documentElement) { updateAll(); if (r.attributeName === 'data-ov-season-mark') scheduleFlourish(); } else if (state.has(r.target)) update(r.target); continue; }
                    if (r.addedNodes.length) added = true;
                    r.removedNodes.forEach((node) => {
                        if (node.nodeType !== 1) return;
                        if (state.has(node) && !node.isConnected) forget(node);
                        if (node.querySelectorAll) node.querySelectorAll('.ov-mark[data-ov]').forEach((m) => { if (!m.isConnected) forget(m); });
                    });
                }
                if (added) mount();
            }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state', 'data-static', 'data-nav', 'data-progress', 'data-ov-motion', 'data-ov-season-mark'] });
        } catch { /* */ }
    }
    // ── A page on its way: the navbar's mark fills as the next page loads ──
    // The pace is learned: the usual time of this site's boost moves and full page loads in this browser (a running
    // average in localStorage). The fill reaches about four fifths at the usual time and never the top before the page
    // is really here; then it fills, and drains back to the line on the new page.
    const loc = () => window.location || { host: '', href: 'http://localhost/', origin: 'http://localhost', pathname: '/', search: '' };
    const NAV_KEY = 'ov-nav-ms', NAV_FLAG = 'ov-nav-click', NAV_DEFAULT = { boost: 450, page: 1600 };
    const navMarks = () => [...document.querySelectorAll('.openvibe-navbar-brand .ov-mark, .navbar .nav-brand .ov-mark, .ov-mark[data-ov-nav]')].filter((m) => !m.closest('.openvibe-network-badge'));
    const navStore = () => { try { return JSON.parse(window.localStorage.getItem(NAV_KEY) || '{}') || {}; } catch { return {}; } };
    function usual(kind) { const v = Number(navStore()[`${loc().host}:${kind}`]); return v > 0 ? v : NAV_DEFAULT[kind] || 1000; }
    function learn(kind, ms) {
        if (!(ms > 30 && ms < 30000)) return;
        try {
            const all = navStore(), k = `${loc().host}:${kind}`;
            all[k] = Math.round(all[k] > 0 ? all[k] * 0.7 + ms * 0.3 : ms);
            window.localStorage.setItem(NAV_KEY, JSON.stringify(all));
        } catch { /* no storage: the default pace */ }
    }
    let nav = null;
    function setFill(marks, p) { marks.forEach((m) => { m.setAttribute('data-nav', ''); m.style.setProperty('--ovm-fill', String(p)); }); }
    function navStart(kind = 'page') {
        navStop();
        const marks = navMarks(); if (!marks.length) return;
        const t0 = Date.now(), avg = usual(kind);
        const me = { kind, t0, timer: 0 };
        const tick = () => {
            if (nav !== me) return;
            const t = Date.now() - t0;
            setFill(navMarks(), Math.min(0.94, 0.08 + 0.86 * (1 - Math.exp(-1.6 * t / avg))).toFixed(3));
            me.timer = setTimeout(tick, 120);
        };
        nav = me;
        tick();
    }
    function navStop() { if (nav) { clearTimeout(nav.timer); nav = null; } }
    /** The page is here: fill to the top, then drain back. A navbar re-rendered by the move gets the same ending. */
    // The ending runs after every other listener of the arrival (the navbar re-renders on it), and no timer keeps a mark:
    // each step looks the marks up again, so a replaced navbar is never held in memory.
    const clearNav = () => { if (!nav) navMarks().forEach((m) => { m.removeAttribute('data-nav'); m.style.removeProperty('--ovm-fill'); }); };
    function navEnd(kind) {
        const was = nav; navStop();
        if (was && kind) learn(kind, Date.now() - was.t0);
        setTimeout(() => { if (nav) return; mount(); setFill(navMarks(), 1); setTimeout(clearNav, 320); }, 0);
    }
    function hookNav() {
        document.addEventListener('ov:boost:before', () => navStart('boost'));
        document.addEventListener('ov:boost:load', () => navEnd('boost'));
        // A full page load: a plain click on a link that leaves this page, in this tab, not taken by boost or the app.
        document.addEventListener('click', (e) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const a = e.target && e.target.closest && e.target.closest('a[href]');
            if (!a || a.hasAttribute('download') || (a.target && a.target !== '_self')) return;
            const here = loc(); let u; try { u = new URL(a.href, here.href); } catch { return; }
            if (!/^https?:$/.test(u.protocol) || (u.origin === here.origin && u.pathname === here.pathname && u.search === here.search)) return;
            navStart('page');
            try { if (u.origin === here.origin) sessionStorage.setItem(NAV_FLAG, String(Date.now())); } catch { /* */ }
        });
        // Back to a page from the back/forward cache: nothing is loading any more.
        window.addEventListener('pageshow', (e) => { if (e.persisted) { navStop(); clearNav(); } });
        // This page came from a click on the last one: learn how long it took, and finish the fill here.
        let t = 0; try { t = Number(sessionStorage.getItem(NAV_FLAG)) || 0; sessionStorage.removeItem(NAV_FLAG); } catch { /* */ }
        if (t && Date.now() - t < 20000) {
            learn('page', Date.now() - t);
            const finish = () => { const marks = navMarks(); if (!marks.length) return false; setFill(marks, 0.9); setTimeout(() => navEnd(null), 60); return true; };
            let tries = 0; const again = () => { if (!finish() && ++tries <= 20) setTimeout(again, 100); }; again();
        }
    }
    window.OVMark = { mount, navStart, navEnd, usual };
    window.ovMarkMount = mount;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
