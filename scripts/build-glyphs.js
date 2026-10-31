#!/usr/bin/env node
'use strict';
// Writes ov-glyphs.js, the page drop-in that swaps Font Awesome icons for the OpenVibe glyphs, and ov-glyphs.svg, the
// sprite (<symbol id="ovg-eye">), from glyphs.js (the one registry). Re-run after a glyph or an alias changes:
// node scripts/build-glyphs.js (test/glyphs.test.js checks both files are current). Only the glyphs some Font Awesome
// name stands for go in the drop-in, so it carries no drawing it cannot use; the sprite has every glyph.
const fs = require('fs');
const path = require('path');
const glyphs = require('../glyphs');

const used = [...new Set(Object.values(glyphs.FA))].sort();
const G = Object.fromEntries(used.map((n) => [n, glyphs.path(n)]));
const FA = Object.fromEntries(Object.entries(glyphs.FA).sort(([a], [b]) => (a < b ? -1 : 1)));

// Font Awesome's features on a swapped icon (4.62.0), with Font Awesome's own class names and CSS variables, so a site
// can drop Font Awesome's stylesheet and keep its markup. Rules about the icon itself are scoped to .ovg; the wrappers
// (fa-ul, fa-stack, fa-layers) carry Font Awesome's own values. Nothing spins (plan L27): fa-spin breathes instead.
const anim = (cls, name, timing, dur = '1s') => `.ovg.${cls}{animation:${name} var(--fa-animation-duration,${dur}) var(--fa-animation-timing,${timing}) var(--fa-animation-delay,0s) var(--fa-animation-iteration-count,infinite) var(--fa-animation-direction,normal)}`;
const CSS = [
    // The icon: Font Awesome's glyph off, ours in the text's colour and size, one drawing in four weights.
    '.ovg::before,.ovg::after{content:none!important;display:none!important}',
    '.ovg{display:inline-block;width:1.15em;height:1.15em;line-height:1;vertical-align:-.18em;font-family:inherit!important;font-style:normal!important}',
    '.ovg>svg{display:block;width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:var(--ovg-stroke,2);stroke-linecap:round;stroke-linejoin:round;overflow:visible}',
    '.ovg.fa-thin{--ovg-stroke:1}.ovg.fa-light{--ovg-stroke:1.5}.ovg.ovg-bold{--ovg-stroke:2.5}.ovg.fa-duotone>svg{stroke:var(--fa-primary-color,currentColor)}',
    // Sizes, fixed width, borders and pulls.
    '.ovg.fa-2xs{font-size:.625em}.ovg.fa-xs{font-size:.75em}.ovg.fa-sm{font-size:.875em}.ovg.fa-lg{font-size:1.25em}.ovg.fa-xl{font-size:1.5em}.ovg.fa-2xl{font-size:2em}',
    Array.from({ length: 10 }, (_, i) => `.ovg.fa-${i + 1}x{font-size:${i + 1}em}`).join(''),
    '.ovg.fa-fw{width:1.25em;text-align:center}',
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
    // The busy dots take turns.
    '.ovg[data-ovg=busy]>svg{fill:currentColor;stroke:none}.ovg[data-ovg=busy] circle{animation:ovgHop 1s ease-in-out infinite;transform-box:fill-box;transform-origin:center}',
    '.ovg[data-ovg=busy] circle:nth-child(2){animation-delay:.15s}.ovg[data-ovg=busy] circle:nth-child(3){animation-delay:.3s}',
    '@keyframes ovgHop{0%,60%,100%{transform:translateY(0);opacity:.55}30%{transform:translateY(-3px);opacity:1}}',
    // Reduced motion: nothing moves.
    '@media (prefers-reduced-motion:reduce){.ovg,.ovg[data-ovg=busy] circle{animation:none!important}}html[data-ov-motion=reduced] .ovg,html[data-ov-motion=reduced] .ovg[data-ovg=busy] circle{animation:none!important}',
].join('');

const out = `/* Generated by scripts/build-glyphs.js from glyphs.js: edit those, then run it. */
/**
 * openvibe-shared/ov-glyphs.js — the OpenVibe glyphs in place of Font Awesome (plan L32). A page that loads it keeps its
 * markup (<i class="fa-solid fa-tower-broadcast">) and shows the network's own icon instead: the same hand as the mark
 * (24-unit grid, 2-unit round strokes), in the text's colour and size. A name the glyphs do not have yet, and every
 * brand logo (fa-brands), stays Font Awesome's. A spinner is three dots that take turns, never a spin.
 *
 * Font Awesome's features keep working without its stylesheet (4.62.0): sizes (fa-2xs … fa-2xl, fa-1x … fa-10x), fa-fw,
 * fa-ul/fa-li, fa-border, fa-pull-*, fa-rotate-* and fa-flip-*, fa-stack, fa-layers with counters and text, the
 * animations (fa-beat, fa-bounce, fa-fade, fa-beat-fade, fa-flip, fa-shake; fa-spin breathes), fa-thin and fa-light
 * as thinner strokes, data-fa-transform (grow, shrink, up, down, left, right, rotate, flip-h, flip-v), and a title that
 * names the icon to screen readers. Every variable Font Awesome documents (--fa-beat-scale …) is honoured.
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
    const FA = ${JSON.stringify(FA)};
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
    function draw(el) {
        if (el.classList.contains('fa-brands') || el.classList.contains('fab')) return;
        const fa = nameOf(el);
        const g = fa && fromFa(fa);
        if (!g) { if (el.dataset.ovg) { el.classList.remove('ovg'); delete el.dataset.ovg; delete el.dataset.ovgFa; delete el.dataset.ovgTf; el.textContent = ''; } return; }
        const tf = el.getAttribute('data-fa-transform') || '';
        if (el.dataset.ovgFa === fa && (el.dataset.ovgTf || '') === tf) { if (!el.classList.contains('ovg')) el.classList.add('ovg'); return; }   // adding a class it has would observe itself forever
        if (!el.dataset.ovg && el.textContent.trim()) return;   // an icon element with text of its own is not an icon
        el.classList.add('ovg');
        el.dataset.ovg = g; el.dataset.ovgFa = fa;
        if (tf) el.dataset.ovgTf = tf; else delete el.dataset.ovgTf;
        const title = el.getAttribute('title');
        if (title && !el.hasAttribute('aria-label')) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', title); }
        else if (!el.hasAttribute('aria-label') && !title) el.setAttribute('aria-hidden', 'true');
        const t = transformOf(tf);
        el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"' + (t ? ' style="transform:' + t + '"' : '') + '>' + (g === 'busy' ? BUSY : G[g]) + '</svg>';
    }
    const SEL = 'i[class*="fa-"],span[class*="fa-"]';
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
            }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-fa-transform'] });
        } catch (e) { /* no observer: what was there is swapped */ }
    }
    window.OVGlyphs = { swap, fromFa };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
`;

// The sprite: every glyph as a <symbol>, for <svg><use href="/shared/ov-glyphs.svg#ovg-eye"/></svg>.
const sprite = `<svg xmlns="http://www.w3.org/2000/svg">\n<!-- The OpenVibe glyphs (openvibe-shared, MIT): <svg><use href="ov-glyphs.svg#ovg-eye"/></svg>. Generated by scripts/build-glyphs.js. -->\n${glyphs.NAMES.map((n) => `<symbol id="ovg-${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyphs.path(n)}</symbol>`).join('\n')}\n</svg>\n`;

if (require.main === module) {
    fs.writeFileSync(path.join(__dirname, '..', 'ov-glyphs.js'), out);
    fs.writeFileSync(path.join(__dirname, '..', 'ov-glyphs.svg'), sprite);
    console.log(`ov-glyphs.js: ${used.length} glyphs for ${Object.keys(FA).length} Font Awesome names, ${(out.length / 1024).toFixed(1)} KB; ov-glyphs.svg: ${glyphs.NAMES.length} symbols, ${(sprite.length / 1024).toFixed(1)} KB`);
}
module.exports = { build: () => out, sprite: () => sprite, CSS };
