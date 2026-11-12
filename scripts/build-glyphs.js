#!/usr/bin/env node
'use strict';
// Writes ov-glyphs.js, the page drop-in that swaps Font Awesome icons for the OpenVibe glyphs, and ov-glyphs.svg, the
// sprite (<symbol id="ovg-eye">), from glyphs.js (the one registry). Re-run after a glyph or an alias changes:
// node scripts/build-glyphs.js (test/glyphs.test.js checks both files are current). Every glyph goes in the drop-in
// (4.231.0): a page names any of them with <i data-ov-icon="name">.
const fs = require('fs');
const path = require('path');
const glyphs = require('../glyphs');

const used = glyphs.NAMES.slice().sort();
const G = Object.fromEntries(used.map((n) => [n, glyphs.path(n)]));
// The solid drawings for small sizes (4.69.0).
const S = Object.fromEntries(used.filter((n) => glyphs.solid(n)).map((n) => [n, glyphs.solid(n)]));
const FA = Object.fromEntries(Object.entries(glyphs.FA).sort(([a], [b]) => (a < b ? -1 : 1)));

// Font Awesome's features on a swapped icon (4.62.0), with Font Awesome's own class names and CSS variables, so a site
// can drop Font Awesome's stylesheet and keep its markup. Rules about the icon itself are scoped to .ovg; the wrappers
// (fa-ul, fa-stack, fa-layers) carry Font Awesome's own values. Nothing spins (plan L27): fa-spin breathes instead.
const anim = (cls, name, timing, dur = '1s') => `.ovg.${cls}{animation:${name} var(--fa-animation-duration,${dur}) var(--fa-animation-timing,${timing}) var(--fa-animation-delay,0s) var(--fa-animation-iteration-count,infinite) var(--fa-animation-direction,normal)}`;
const CSS = [
    // The icon: Font Awesome's glyph off, ours in the text's colour and size, one drawing in four weights.
    '.ovg::before,.ovg::after{content:none!important;display:none!important}',
    '.ovg{display:inline-block;width:1.15em;height:1.15em;line-height:1;vertical-align:-.18em;font-family:inherit!important;font-style:normal!important}',
    // Optical sizes (4.69.0, plan L49): inside the SVG a px is a grid unit and an em is the icon's own size, so
    // max(0px, (18.4px - 1.15em) * k) is zero for an icon 18.4 px or bigger and grows as it shrinks. Lines thicken
    // when small; a glyph with a solid drawing shows that instead (its lines go to 0, the solid group's clip opens).
    // A browser without clip-path on SVG groups shows the solid one at every size: still the right icon.
    '.ovg>svg{display:block;width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:calc(var(--ovg-stroke,2) * 1px + max(0px, (18.4px - 1.15em) * .25));stroke-linecap:round;stroke-linejoin:round;overflow:visible}',
    // Where line turns solid (4.71.0, plan L56): --ovg-solid-below is an area's own switch point (default 18.4 px), and
    // --ovg-pref is the person's preference (display setting `icons`, <html data-ov-icons>), which wins over an area's:
    // solid is a switch point no icon reaches, line one every icon passes. .ovg-solid and .ovg-line still win over both.
    'html[data-ov-icons=solid]{--ovg-pref:99999px}html[data-ov-icons=line]{--ovg-pref:0px}',
    '.ovg>svg.has-s{stroke-width:min(var(--ovg-stroke,2) * 1px + max(0px, (18.4px - 1.15em) * .25), max(0px, (1.15em - var(--ovg-pref, var(--ovg-solid-below, 18.4px))) * 999))}',
    '.ovg>svg>.ovg-s{fill:currentColor;stroke:none;clip-path:inset(max(0px, (1.15em - var(--ovg-pref, var(--ovg-solid-below, 18.4px))) * 999))}',
    '.ovg>svg>.ovg-s .ln{fill:none;stroke:currentColor;stroke-width:2.6px}',
    '.ovg>svg>.ovg-s,.ovg>svg>.ovg-s *{stroke-dasharray:none!important;animation:none!important}',
    // Line or solid on purpose (4.70.0; the owner, 2026-11-01: "both sets for any size… swap between them… whichever
    // fits the area"): .ovg-solid and .ovg-line force one at any size, and an active control (the current tab, a pressed
    // or selected button) wears the solid one, the way an app's tab bar fills the tab you are on. :where() keeps these
    // easy for a site to override.
    '.ovg.ovg-solid>svg.has-s{stroke-width:0}.ovg.ovg-solid>svg>.ovg-s{clip-path:none}',
    '.ovg.ovg-line>svg.has-s{stroke-width:calc(var(--ovg-stroke,2) * 1px + max(0px, (18.4px - 1.15em) * .25))}.ovg.ovg-line>svg>.ovg-s{clip-path:inset(50%)}',
    '.ovg.ovg-thin{--ovg-stroke:1}.ovg.ovg-light{--ovg-stroke:1.5}.ovg.ovg-regular{--ovg-stroke:2}.ovg.ovg-bold{--ovg-stroke:2.5}',
    '.ovg.ovg-duotone>svg>.ovg-s{clip-path:none;opacity:.2;fill:var(--ovg-duotone-color,currentColor)}.ovg.ovg-duotone>svg.has-s{stroke-width:var(--ovg-stroke,2)}',
    ':where([aria-current=page],[aria-current=true],[aria-pressed=true],[aria-selected=true],.is-here)>.ovg:not(.ovg-line)>svg.has-s{stroke-width:0}',
    ':where([aria-current=page],[aria-current=true],[aria-pressed=true],[aria-selected=true],.is-here)>.ovg:not(.ovg-line)>svg>.ovg-s{clip-path:none}',
    // Brand logos (4.72.0): filled shapes in the text's colour; ovg-brand-color wears the brand's own.
    '.ovg.ovg-brand>svg{fill:currentColor;stroke:none}.ovg.ovg-brand.ovg-brand-color{color:var(--ovg-brand)}',
    '.ovg.fa-thin{--ovg-stroke:1}.ovg.fa-light{--ovg-stroke:1.5}.ovg.fa-solid{--ovg-solid-below:99999px}.ovg.fa-duotone{--ovg-duotone-color:var(--fa-secondary-color,currentColor)}.ovg.fa-duotone>svg{stroke:var(--fa-primary-color,currentColor)}',
    // Sizes, fixed width, borders and pulls.
    '.ovg.fa-2xs{font-size:.625em}.ovg.fa-xs{font-size:.75em}.ovg.fa-sm{font-size:.875em}.ovg.fa-lg{font-size:1.25em}.ovg.fa-xl{font-size:1.5em}.ovg.fa-2xl{font-size:2em}',
    Array.from({ length: 10 }, (_, i) => `.ovg.fa-${i + 1}x{font-size:${i + 1}em}`).join(''),
    '.ovg.fa-fw{width:1.25em;text-align:center}',
    // OpenVibe's own markup (4.231.0): <i data-ov-icon="eye" class="ovg-lg">; sizes, a fixed width, turns and flips, and
    // ovg-fill (what fa-solid did): the area prefers the solid drawing at every size, the person's own preference still wins.
    '.ovg.ovg-fill{--ovg-solid-below:99999px}',
    '.ovg.ovg-xs{font-size:.75em}.ovg.ovg-sm{font-size:.875em}.ovg.ovg-lg{font-size:1.25em}.ovg.ovg-xl{font-size:1.5em}.ovg.ovg-2x{font-size:2em}.ovg.ovg-3x{font-size:3em}.ovg.ovg-fw{width:1.25em;text-align:center}',
    '.ovg.ovg-rotate-90>svg{transform:rotate(90deg)}.ovg.ovg-rotate-180>svg{transform:rotate(180deg)}.ovg.ovg-rotate-270>svg{transform:rotate(270deg)}.ovg.ovg-flip-h>svg{transform:scale(-1,1)}.ovg.ovg-flip-v>svg{transform:scale(1,-1)}',
    '.ovg.fa-border{box-sizing:content-box;border:var(--fa-border-width,.08em) var(--fa-border-style,solid) var(--fa-border-color,#eee);border-radius:var(--fa-border-radius,.1em);padding:var(--fa-border-padding,.2em .25em .15em)}',
    '.ovg.fa-pull-left{float:left;margin-right:var(--fa-pull-margin,.3em)}.ovg.fa-pull-right{float:right;margin-left:var(--fa-pull-margin,.3em)}',
    // Turns and flips act on the drawing, so they combine with an animation on the icon.
    '.ovg.fa-rotate-90>svg{transform:rotate(90deg)}.ovg.fa-rotate-180>svg{transform:rotate(180deg)}.ovg.fa-rotate-270>svg{transform:rotate(270deg)}.ovg.fa-rotate-by>svg{transform:rotate(var(--fa-rotate-angle,0))}',
    '.ovg.fa-flip-horizontal>svg{transform:scale(-1,1)}.ovg.fa-flip-vertical>svg{transform:scale(1,-1)}.ovg.fa-flip-both>svg{transform:scale(-1,-1)}',
    // Lists, stacks and layers (Font Awesome's wrappers).
    '.fa-ul{list-style-type:none;margin-left:var(--fa-li-margin,2.5em);padding-left:0}.fa-ul>li{position:relative}.fa-li{position:absolute;left:calc(var(--fa-li-width,2em)*-1);width:var(--fa-li-width,2em);text-align:center;line-height:inherit}',
    '.fa-stack{display:inline-block;position:relative;width:2.5em;height:2em;line-height:2em;vertical-align:middle}.fa-stack>.ovg{position:absolute;inset:0;margin:auto;width:1em;height:1em}.fa-stack>.ovg.fa-stack-2x{font-size:2em}.ovg.fa-inverse{color:var(--fa-inverse,#fff)}',
    '.fa-layers{display:inline-block;position:relative;width:1em;height:1em;text-align:center;vertical-align:-.125em}.fa-layers>.ovg{position:absolute;inset:0;margin:auto;width:1em;height:1em}',
    '.fa-layers-text{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:inline-block}',
    '.fa-layers-counter{position:absolute;top:var(--fa-top,0);right:var(--fa-right,0);display:inline-block;box-sizing:border-box;min-width:var(--fa-counter-min-width,1.5em);max-width:var(--fa-counter-max-width,5em);padding:var(--fa-counter-padding,.25em .5em);border-radius:var(--fa-counter-border-radius,1em);background:var(--fa-counter-background-color,#ff253a);color:var(--fa-inverse,#fff);line-height:var(--fa-counter-line-height,1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transform:scale(var(--fa-counter-scale,.25));transform-origin:top right}',
    // Animations, with Font Awesome's variables and timings.
    anim('fa-beat', 'ovgBeat', 'ease-in-out'),
    anim('fa-bounce', 'ovgBounce', 'cubic-bezier(.28,.84,.42,1)'),
    anim('fa-fade', 'ovgFade', 'cubic-bezier(.4,0,.6,1)'),
    anim('fa-beat-fade', 'ovgBeatFade', 'cubic-bezier(.4,0,.6,1)'),
    anim('fa-flip', 'ovgFlip', 'ease-in-out'),
    anim('fa-shake', 'ovgShake', 'linear'),
    '.ovg.fa-spin,.ovg.fa-pulse,.ovg.fa-spin-pulse{animation:ovgBreathe var(--fa-animation-duration,1.6s) ease-in-out var(--fa-animation-delay,0s) var(--fa-animation-iteration-count,infinite)!important}',
    '.ovg[data-ovg=busy].fa-spin,.ovg[data-ovg=busy].fa-pulse,.ovg[data-ovg=busy].fa-spin-pulse{animation:none!important}',
    '@keyframes ovgBeat{0%,90%{transform:scale(1)}45%{transform:scale(var(--fa-beat-scale,1.25))}}',
    '@keyframes ovgBounce{0%{transform:scale(1,1) translateY(0)}10%{transform:scale(var(--fa-bounce-start-scale-x,1.1),var(--fa-bounce-start-scale-y,.9)) translateY(0)}30%{transform:scale(var(--fa-bounce-jump-scale-x,.9),var(--fa-bounce-jump-scale-y,1.1)) translateY(var(--fa-bounce-height,-.5em))}50%{transform:scale(var(--fa-bounce-land-scale-x,1.05),var(--fa-bounce-land-scale-y,.95)) translateY(0)}57%{transform:scale(1,1) translateY(var(--fa-bounce-rebound,-.125em))}64%,100%{transform:scale(1,1) translateY(0)}}',
    '@keyframes ovgFade{50%{opacity:var(--fa-fade-opacity,.4)}}',
    '@keyframes ovgBeatFade{0%,100%{opacity:var(--fa-beat-fade-opacity,.4);transform:scale(1)}50%{opacity:1;transform:scale(var(--fa-beat-fade-scale,1.125))}}',
    '@keyframes ovgFlip{50%{transform:rotate3d(var(--fa-flip-x,0),var(--fa-flip-y,1),var(--fa-flip-z,0),var(--fa-flip-angle,-180deg))}}',
    '@keyframes ovgShake{0%{transform:rotate(-15deg)}4%{transform:rotate(15deg)}8%,24%{transform:rotate(-18deg)}12%,28%{transform:rotate(18deg)}16%{transform:rotate(-22deg)}20%{transform:rotate(22deg)}32%{transform:rotate(-12deg)}36%{transform:rotate(12deg)}40%,100%{transform:rotate(0)}}',
    '@keyframes ovgBreathe{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.9)}}',
    // The glyphs' own motion (4.63.0, L32 I9): ovg-draw draws the lines in once, the way the mark's tick does; ovg-once
    // plays any animation above a single time (a bell that rings once: fa-shake ovg-once).
    '.ovg.ovg-draw>svg>*{stroke-dasharray:1;stroke-dashoffset:1;animation:ovgDraw var(--ovg-draw-duration,.6s) cubic-bezier(.4,0,.2,1) var(--ovg-draw-delay,0s) forwards}',
    '.ovg.ovg-draw>svg>*:nth-child(2){animation-delay:calc(var(--ovg-draw-delay,0s) + .12s)}.ovg.ovg-draw>svg>*:nth-child(n+3){animation-delay:calc(var(--ovg-draw-delay,0s) + .24s)}',
    '@keyframes ovgDraw{to{stroke-dashoffset:0}}',
    '.ovg.ovg-once{--fa-animation-iteration-count:1}',
    // The busy dots take turns.
    '.ovg[data-ovg=busy]>svg{fill:currentColor;stroke:none}.ovg[data-ovg=busy] circle{animation:ovgHop 1s ease-in-out infinite;transform-box:fill-box;transform-origin:center}',
    '.ovg[data-ovg=busy] circle:nth-child(2){animation-delay:.15s}.ovg[data-ovg=busy] circle:nth-child(3){animation-delay:.3s}',
    '@keyframes ovgHop{0%,60%,100%{transform:translateY(0);opacity:.55}30%{transform:translateY(-3px);opacity:1}}',
    // Reduced motion: nothing moves.
    'html[data-ov-motion=off] .ovg,html[data-ov-motion=off] .ovg[data-ovg=busy] circle,html[data-ov-motion=off] .ovg.ovg-draw>svg>*{animation:none!important;stroke-dashoffset:0!important}',
].join('');

const brands = require('../brands');
// brands.js's content hash, so ov-glyphs.js fetches it by a URL that changes with each release (4.138.0).
const brandsRev = require('../assets').hashAsset(fs.readFileSync(path.join(__dirname, '..', 'brands.js')));
const out = `/* Generated by scripts/build-glyphs.js from glyphs.js: edit those, then run it. */
/**
 * openvibe-shared/ov-glyphs.js — the OpenVibe glyphs (plan L32): the same hand as the mark (24-unit grid, 2-unit round
 * strokes), in the text's colour and size.
 *
 *   <i data-ov-icon="live"></i>              any glyph by name (openvibe.design/icons lists them); a title names it
 *   <i data-ov-brand="github"></i>           a brand logo, from brands.js (Simple Icons, CC0), fetched the first time one
 *                                            shows, filled in the text's colour (add ovg-brand-color to wear the brand's)
 *   class ovg-xs … ovg-3x, ovg-fw, ovg-rotate-90/180/270, ovg-flip-h/-v, ovg-solid, ovg-line, ovg-draw, ovg-once
 *   OVGlyphs.icon('live', { title })         an element, drawn;  OVGlyphs.html('live') its markup
 *
 * A spinner is the glyph busy: three dots that take turns, never a spin. Font Awesome markup (<i class="fa-solid
 * fa-tower-broadcast">) is still drawn with the glyph its name maps to, until every site writes data-ov-icon
 * (scripts/fa-to-ov.js rewrites a repository); a release after that drops it.
 *
 * Font Awesome's features keep working without its stylesheet (4.62.0): sizes (fa-2xs … fa-2xl, fa-1x … fa-10x), fa-fw,
 * fa-ul/fa-li, fa-border, fa-pull-*, fa-rotate-* and fa-flip-*, fa-stack, fa-layers with counters and text, the
 * animations (fa-beat, fa-bounce, fa-fade, fa-beat-fade, fa-flip, fa-shake; fa-spin breathes), fa-thin and fa-light
 * as thinner strokes, data-fa-transform (grow, shrink, up, down, left, right, rotate, flip-h, flip-v), and a title that
 * names the icon to screen readers. Every variable Font Awesome documents (--fa-beat-scale …) is honoured. The glyphs'
 * own motion: ovg-draw draws the lines in once, ovg-once plays an animation a single time (4.63.0).
 *
 *   <script src="/shared/ov-glyphs.js" defer></script>     swaps what is in the page, then anything added later
 *   OVGlyphs.swap(rootEl)                                    swaps inside one element now
 *   OVGlyphs.fromFa('fa-eye') → 'eye'                        the glyph a Font Awesome name maps to, or null
 *
 * ${used.length} glyphs for ${Object.keys(FA).length} Font Awesome names (openvibe.design/icons shows them).
 */
(function () {
    'use strict';
    if (typeof window === 'undefined' || window.OVGlyphs) return;
    const G = ${JSON.stringify(G)};
    const S = ${JSON.stringify(S)};
    const FA = ${JSON.stringify(FA)};
    const FB = ${JSON.stringify(brands.FA)};
    // Font Awesome's style, size, layout and animation classes: they say how, not what.
    const MOD = /^fa-(solid|regular|light|thin|duotone|sharp|sharp-duotone|classic|brands|fw|lg|xl|xs|sm|2xs|2xl|[0-9]+x|spin|spin-pulse|spin-reverse|pulse|beat|beat-fade|bounce|fade|flip|shake|border|inverse|li|ul|stack|stack-1x|stack-2x|layers|layers-text|layers-counter|pull-left|pull-right|rotate-[0-9]+|rotate-by|flip-horizontal|flip-vertical|flip-both|swap-opacity|width-auto|width-fixed)$/;
    const BUSY = '<circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/>';
    const CSS = ${JSON.stringify(CSS)};
    const nameOf = (el) => { for (const c of el.classList) if (c.startsWith('fa-') && !MOD.test(c)) return c.slice(3); return null; };
    const fromFa = (fa) => { const n = String(fa || '').replace(/^fa-/, ''); return Object.prototype.hasOwnProperty.call(FA, n) ? FA[n] : null; };
    // data-fa-transform, in Font Awesome's units (a sixteenth of the icon).
    const TF = /^(grow|shrink|up|down|left|right|rotate)-(-?[0-9.]+)$|^flip-(h|v)$/;
    function transformOf(spec) {
        let s = 1, x = 0, y = 0, r = 0, fx = 1, fy = 1, any = false;
        for (const p of String(spec || '').toLowerCase().split(/\\s+/)) {
            const m = TF.exec(p);
            if (!m) continue;
            any = true;
            if (m[3]) { if (m[3] === 'h') fx = -1; else fy = -1; continue; }
            const n = Number(m[2]);
            if (m[1] === 'grow') s += n / 16; else if (m[1] === 'shrink') s -= n / 16;
            else if (m[1] === 'up') y -= n / 16; else if (m[1] === 'down') y += n / 16;
            else if (m[1] === 'left') x -= n / 16; else if (m[1] === 'right') x += n / 16; else r += n;
        }
        return any ? 'translate(' + x + 'em,' + y + 'em) rotate(' + r + 'deg) scale(' + (fx * s) + ',' + (fy * s) + ')' : '';
    }
    // Brand logos (4.72.0): brands.js from beside this script, once, then every waiting element is drawn.
    const SRC = (document.currentScript && document.currentScript.src) || '';
    let brandState = 0;   // 0 idle, 1 loading, 2 ready, 3 unavailable
    const waiting = new Set();
    const BRANDS_REV = '${brandsRev}';
    // A logo far below the fold (a footer's social links) waits until it comes near the screen (4.138.0): most visits
    // never get there, and brands.js is 26 KB. One that is in view, or hidden in a closed fold that opens, loads then.
    let brandSeen = null;
    function wantBrands(el) {
        if (brandState || typeof IntersectionObserver !== 'function' || !el.getBoundingClientRect) { loadBrands(); return; }
        const r = el.getBoundingClientRect();
        if ((r.width || r.height) && r.bottom > -800 && r.top < (window.innerHeight || 0) + 800) { loadBrands(); return; }
        brandSeen = brandSeen || new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { brandSeen.disconnect(); brandSeen = null; loadBrands(); } }, { rootMargin: '800px 0px' });
        brandSeen.observe(el);
    }
    function loadBrands() {
        if (brandState) return;
        if (window.OVBrands) { brandState = 2; return; }
        brandState = 1;
        // No backslashes here: this text is inside a template literal.
        const base = SRC ? SRC.split(/[?#]/)[0] : '';
        const dir = base && /ov-glyphs[.]js$/.test(base) ? base.slice(0, base.lastIndexOf('/') + 1) : 'https://openvibe.network/shared/';
        const sc = document.createElement('script');
        sc.src = dir + 'brands.js' + (BRANDS_REV ? '?v=' + BRANDS_REV : '');
        sc.async = true;
        sc.onload = () => { brandState = window.OVBrands ? 2 : 3; waiting.forEach((el) => draw(el)); waiting.clear(); };
        sc.onerror = () => { brandState = 3; waiting.clear(); };
        document.head.appendChild(sc);
    }
    function drawBrand(el, own) {
        let fa = null;
        if (own == null) for (const c of el.classList) if (c.startsWith('fa-') && c !== 'fa-brands' && !MOD.test(c) && Object.prototype.hasOwnProperty.call(FB, c.slice(3))) { fa = c.slice(3); break; }
        if (own == null && !fa) return;
        const slug = own != null ? own : FB[fa];
        if (el.dataset.ovg === 'brand:' + slug) return;
        if (!window.OVBrands) { if (brandState !== 3) { waiting.add(el); wantBrands(el); } return; }
        const b = window.OVBrands.get(slug);
        if (!b || (!el.dataset.ovg && el.textContent.trim())) return;
        el.classList.add('ovg', 'ovg-brand');
        el.dataset.ovg = 'brand:' + slug; if (fa) el.dataset.ovgFa = fa;
        // A near-black brand (GitHub, X, Apple…) would vanish on a dark page: it wears the text's colour instead.
        const n = parseInt(b.hex.slice(1), 16), lum = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
        el.style.setProperty('--ovg-brand', lum < 0.12 ? 'currentColor' : b.hex);
        const title = el.getAttribute('title');
        if (title && !el.hasAttribute('aria-label')) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', title); }
        else if (!el.hasAttribute('aria-label') && !title) el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + b.path + '"/></svg>';
    }
    // OpenVibe's own markup (4.231.0): data-ov-brand names a logo by its slug, data-ov-icon a glyph by its name.
    function drawNative(el, name) {
        const g = name === 'busy' || Object.prototype.hasOwnProperty.call(G, name) ? name : null;
        if (!g) { if (el.dataset.ovg) { el.classList.remove('ovg'); delete el.dataset.ovg; el.textContent = ''; } return; }
        if (el.dataset.ovg === g && el.firstChild) { if (!el.classList.contains('ovg')) el.classList.add('ovg'); return; }
        el.classList.add('ovg');
        el.dataset.ovg = g;
        paint(el, g, '');
    }
    function paint(el, g, t) {
        const title = el.getAttribute('title');
        if (title && !el.hasAttribute('aria-label')) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', title); }
        else if (!el.hasAttribute('aria-label') && !title) el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"' + (S[g] ? ' class="has-s"' : '') + (t ? ' style="transform:' + t + '"' : '') + '>' + (g === 'busy' ? BUSY : G[g] + (S[g] ? '<g class="ovg-s">' + S[g] + '</g>' : '')) + '</svg>';
        // ovg-draw draws each line in: every shape measures 1 along its length.
        if (el.classList.contains('ovg-draw')) el.firstChild.childNodes.forEach((n) => { if (n.setAttribute) n.setAttribute('pathLength', '1'); });
    }
    function draw(el) {
        const own = el.getAttribute('data-ov-icon');
        if (own != null) return drawNative(el, own.trim());
        const brand = el.getAttribute('data-ov-brand');
        if (brand != null) return drawBrand(el, brand.trim());
        if (el.classList.contains('fa-brands') || el.classList.contains('fab')) return drawBrand(el);
        const fa = nameOf(el);
        const g = fa && fromFa(fa);
        if (!g) { if (el.dataset.ovg) { el.classList.remove('ovg'); delete el.dataset.ovg; delete el.dataset.ovgFa; delete el.dataset.ovgTf; el.textContent = ''; } return; }
        const tf = el.getAttribute('data-fa-transform') || '';
        if (el.dataset.ovgFa === fa && (el.dataset.ovgTf || '') === tf) { if (!el.classList.contains('ovg')) el.classList.add('ovg'); return; }   // adding a class it has would observe itself forever
        if (!el.dataset.ovg && el.textContent.trim()) return;   // an icon element with text of its own is not an icon
        el.classList.add('ovg');
        el.dataset.ovg = g; el.dataset.ovgFa = fa;
        if (tf) el.dataset.ovgTf = tf; else delete el.dataset.ovgTf;
        paint(el, g, transformOf(tf));
    }
    const SEL = '[data-ov-icon],[data-ov-brand],i[class*="fa-"],span[class*="fa-"]';
    function swap(root) {
        const r = root || document;
        if (r.matches && r.matches(SEL)) draw(r);
        if (r.querySelectorAll) r.querySelectorAll(SEL).forEach(draw);
    }
    function start() {
        if (!document.getElementById('ov-glyphs-css')) { const s = document.createElement('style'); s.id = 'ov-glyphs-css'; s.textContent = CSS; document.head.appendChild(s); }
        swap(document);
        try {
            new MutationObserver((records) => {
                for (const r of records) {
                    if (r.type === 'attributes') { if (r.target.matches && r.target.matches(SEL)) draw(r.target); continue; }
                    r.addedNodes.forEach((n) => { if (n.nodeType === 1) swap(n); });
                }
            }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-fa-transform', 'data-ov-icon', 'data-ov-brand'] });
        } catch (e) { /* no observer: what was there is swapped */ }
    }
    const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    // The markup for a glyph, and an element drawn now (4.231.0).
    function html(name, o) {
        const opt = o || {};
        return '<i data-ov-icon="' + esc(name) + '"' + (opt.cls ? ' class="' + esc(opt.cls) + '"' : '') + (opt.title ? ' title="' + esc(opt.title) + '"' : ' aria-hidden="true"') + '></i>';
    }
    function icon(name, o) {
        const opt = o || {};
        const el = document.createElement('i');
        el.setAttribute('data-ov-icon', String(name));
        if (opt.cls) el.className = String(opt.cls);
        if (opt.title) el.setAttribute('title', String(opt.title));
        if (!document.getElementById('ov-glyphs-css')) { const st = document.createElement('style'); st.id = 'ov-glyphs-css'; st.textContent = CSS; document.head.appendChild(st); }
        draw(el);
        return el;
    }
    window.OVGlyphs = { swap, fromFa, icon, html, has: (n) => n === 'busy' || Object.prototype.hasOwnProperty.call(G, n) };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
`;

// The sprite: every glyph as a <symbol>, for <svg><use href="/shared/ov-glyphs.svg#ovg-eye"/></svg>.
const sprite = `<svg xmlns="http://www.w3.org/2000/svg">\n<!-- The OpenVibe glyphs (openvibe-shared, MIT): use ovg-<name>-<style>; the unqualified id stays regular. -->\n${glyphs.NAMES.flatMap((n) => [`<symbol id="ovg-${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyphs.path(n)}</symbol>`, ...[1, 1.5, 2, 2.5].map((w) => `<symbol id="ovg-${n}-${w === 1 ? 'thin' : w === 1.5 ? 'light' : w === 2 ? 'regular' : 'bold'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${glyphs.path(n)}</symbol>`)].concat(glyphs.solid(n) ? [`<symbol id="ovg-${n}-solid" viewBox="0 0 24 24" fill="currentColor">${glyphs.solid(n).replace(/class="ln"/g, 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"')}</symbol>`, `<symbol id="ovg-${n}-duotone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g fill="currentColor" stroke="none" opacity=".2">${glyphs.solid(n)}</g>${glyphs.path(n)}</symbol>`] : [])).join('\n')}\n</svg>`;

if (require.main === module) {
    fs.writeFileSync(path.join(__dirname, '..', 'ov-glyphs.js'), out);
    fs.writeFileSync(path.join(__dirname, '..', 'ov-glyphs.svg'), sprite);
    console.log(`ov-glyphs.js: ${used.length} glyphs for ${Object.keys(FA).length} Font Awesome names, ${(out.length / 1024).toFixed(1)} KB; ov-glyphs.svg: ${glyphs.NAMES.length} symbols, ${(sprite.length / 1024).toFixed(1)} KB`);
}
module.exports = { build: () => out, sprite: () => sprite, CSS };
