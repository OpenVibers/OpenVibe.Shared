'use strict';
/**
 * openvibe-shared/showcase-stage — homes v2 (plan ~/openvibe/OpenVibe_Homes_v2_Plan_2026-11-09.md; the owner, 11-09: "make
 * the home pages more unique… show the features… custom animations and effects… infographics… a shared system, but
 * modular… not generic… and still SEO friendly"). Show, don't tell: a home opens on the product working.
 *
 *   const st = require('openvibe-shared/showcase-stage');
 *   `<style>${st.CSS}</style>` once (only pages that use these: other homes do not grow), then
 *   st.stage({ title, accent, lede, actions, note, demo, frame, motif })   the hero: words + a live demo panel
 *   st.reel({ id, title, lede, items: [{ title, text, icon, anim, href }] }) features as cards with a small motion each
 *   st.numbers({ id, title, lede, items: [{ value, label, series, note, unit }] })  real numbers that roll up, with lines
 *   st.flow({ id, title, lede, steps: [{ title, text, icon }] })          how it works, the line draws as it scrolls in
 *   `<script>${st.MOTION_JS}</script>` once at the end of the page: starts each piece when it comes into view.
 *
 * Everything is server-rendered HTML with the real words and numbers in it (crawlers and no-JavaScript readers get the
 * whole page); the motion only adds. `demo` is the site's own HTML (trusted: the site renders it from its data). Motion is
 * opacity, stroke-dash and transforms on HTML elements or on an <svg> itself, never a CSS transform on an element inside
 * an SVG (phones left those unpainted while scrolling); all of it stops for prefers-reduced-motion and the Calm setting
 * (html[data-ov-motion=reduced]).
 */
const sc = require('./showcase');
const glyphs = require('./glyphs');

/** A glyph from the set as inline SVG (strokes in currentColor); "ov:name" and "fa-name" resolve too. */
function art(name, size) {
    const n = String(name || '').replace(/^ov:/, '');
    const key = glyphs.NAMES.includes(n) ? n : (glyphs.fromFa ? glyphs.fromFa(n) : null);
    if (key && glyphs.path(key)) return glyphs.svg(key, { size });
    return name ? sc.icon(name, size) : '';
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const has = (a) => Array.isArray(a) && a.length > 0;
const slug = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'section';
const head = (title, lede, hid) => `${title ? `<h2 id="${hid}">${esc(title)}</h2>` : ''}${lede ? `<p class="sc-lede">${esc(lede)}</p>` : ''}`;
const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// ── Motifs: one signature drawing per site, in the theme's accents (--accent, --accent-light), behind the stage ──
const P = (d, cls = '') => `<path d="${d}"${cls ? ` class="${cls}"` : ''}/>`;
const MOTIFS = {
    wave: () => [0, 1, 2].map((i) => P(`M-20 ${190 + i * 34}C80 ${140 + i * 34} 160 ${240 + i * 34} 260 ${190 + i * 34}S440 ${140 + i * 34} 620 ${190 + i * 34}`, `m-line m-d${i}`)).join(''),
    planes: () => P('M-10 330C120 300 150 150 300 170S470 70 610 40', 'm-dash') + [[150, 228], [330, 162], [500, 82]].map(([x, y], i) => P(`M${x} ${y}l26-10-8 20-6-8z`, `m-dot m-d${i}`)).join(''),
    strip: () => [60, 330].map((y) => Array.from({ length: 12 }, (_, i) => `<rect x="${i * 52 - 10}" y="${y}" width="34" height="22" rx="5" class="m-dot m-d${i % 3}"/>`).join('')).join(''),
    shutter: () => [70, 110, 150].map((r, i) => `<circle cx="470" cy="200" r="${r}" class="m-line m-d${i}"/>`).join('') + Array.from({ length: 6 }, (_, i) => { const a = (i * Math.PI) / 3; return P(`M${470 + Math.cos(a) * 40} ${200 + Math.sin(a) * 40}L${470 + Math.cos(a + 1.2) * 150} ${200 + Math.sin(a + 1.2) * 150}`, `m-line m-d${i % 3}`); }).join(''),
    bubbles: () => [[60, 80, 150], [330, 140, 190], [90, 230, 210], [380, 300, 160], [200, 30, 120]].map(([x, y, w], i) => `<rect x="${x}" y="${y}" width="${w}" height="46" rx="23" class="m-dot m-d${i % 3}"/>`).join(''),
    converge: () => [40, 120, 200, 280, 360].map((y, i) => P(`M-10 ${y}C200 ${y} 300 200 520 200`, `m-dash m-d${i % 3}`)).join('') + '<circle cx="530" cy="200" r="14" class="m-dot"/>',
    rise: () => P('M-10 340L80 300 150 318 230 250 310 262 390 180 470 196 610 70', 'm-draw') + [[80, 300], [230, 250], [390, 180], [610, 70]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="6" class="m-dot m-d${i % 3}"/>`).join(''),
    path: () => P('M30 340C120 340 110 230 220 230S330 120 430 120 520 40 600 40', 'm-dash') + [[30, 340], [220, 230], [430, 120], [600, 40]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="11" class="m-dot m-d${i % 3}"/>`).join(''),
    stickers: () => [[60, 60, 0], [480, 40, 1], [520, 280, 2], [120, 300, 1], [300, 20, 2], [380, 330, 0]].map(([x, y, i]) => (i === 0 ? `<circle cx="${x}" cy="${y}" r="22" class="m-dot m-d0"/>` : i === 1 ? `<rect x="${x - 20}" y="${y - 20}" width="40" height="40" rx="10" class="m-dot m-d1"/>` : P(`M${x} ${y - 24}l7 15 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z`, 'm-dot m-d2'))).join(''),
    grid: () => Array.from({ length: 40 }, (_, i) => `<rect x="${(i % 10) * 62 + 6}" y="${Math.floor(i / 10) * 100 + 20}" width="34" height="34" rx="9" class="m-dot m-d${(i * 7) % 3}"/>`).join(''),
    pen: () => P('M20 320C120 120 230 380 320 200S520 60 590 160', 'm-draw') + '<circle cx="590" cy="160" r="8" class="m-dot"/>',
    orbit: () => [80, 130, 180].map((r, i) => `<circle cx="300" cy="200" r="${r}" class="m-line m-d${i}"/>`).join('') + [[380, 200], [300, 70], [140, 260]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="9" class="m-dot m-d${i}"/>`).join(''),
    cursor: () => [[40, 220], [40, 160], [80, 290], [80, 120], [40, 250], [120, 180]].map(([x, w], i) => `<rect x="${x}" y="${60 + i * 46}" width="${w * 1.6}" height="14" rx="7" class="m-dot m-d${i % 3}"/>`).join('') + '<rect x="440" y="290" width="12" height="26" rx="2" class="m-blink"/>',
};
function motifSVG(name) {
    const draw = MOTIFS[name] || MOTIFS.orbit;
    return `<svg class="sc-motif" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${draw()}</svg>`;
}

/** The hero: the words (one H1) and the product working in a frame beside them (above on a phone: the words first). */
function stage({ title, accent, lede, actions, note, demo, frame = 'window', motif = 'orbit', label } = {}) {
    const acts = has(actions) ? `<div class="sc-actions">${actions.map((a) => `<a class="sc-btn${a.primary ? ' sc-primary' : ''}" href="${esc(a.href)}">${esc(a.label)}</a>`).join('')}</div>` : '';
    const fr = ['window', 'phone', 'card'].includes(frame) ? frame : 'window';
    const panel = demo ? `<div class="sc-stage-demo sc-frame-${fr}"${label ? ` role="figure" aria-label="${esc(label)}"` : ''}>${fr === 'window' ? '<span class="sc-frame-bar" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}<div class="sc-frame-body">${demo}</div></div>` : '';
    return `<section class="sc-stage sc-motif-${esc(motif)}" data-sc-in><div class="sc-stage-bg" aria-hidden="true">${motifSVG(motif)}</div>`
        + `<div class="sc-stage-copy"><h1>${esc(title)}${accent ? `<span class="sc-accent"> ${esc(accent)}</span>` : ''}</h1>${lede ? `<p class="sc-stage-lede">${esc(lede)}</p>` : ''}${acts}${note ? `<p class="sc-stage-note">${esc(note)}</p>` : ''}</div>${panel}</section>`;
}

const ANIMS = ['float', 'pulse', 'tilt', 'pop', 'glow'];
/** The features: cards in a row you swipe on a phone and a grid on a computer, each with its icon moving its own way. */
function reel({ id, title, lede, items } = {}) {
    if (!has(items)) return '';
    const hid = slug(id || title);
    return `<section class="sc-reel" data-sc-in${title ? ` aria-labelledby="${hid}"` : ''}>${head(title, lede, hid)}<ul class="sc-reel-list">${items.map((it, i) => {
        const anim = ANIMS.includes(it.anim) ? it.anim : ANIMS[i % ANIMS.length];
        const inner = `<span class="sc-reel-art" data-anim="${anim}" aria-hidden="true">${it.icon ? art(it.icon, 26) : ''}</span><h3>${esc(it.title)}</h3>${it.text ? `<p>${esc(it.text)}</p>` : ''}`;
        return `<li class="sc-reel-card" style="--i:${i}">${it.href ? `<a href="${esc(it.href)}">${inner}</a>` : inner}</li>`;
    }).join('')}</ul></section>`;
}

function spark(series) {
    const v = (Array.isArray(series) ? series : []).map(Number).filter(Number.isFinite).slice(-30);
    if (v.length < 2) return '';
    const max = Math.max(...v, 1), w = 120, h = 28;
    const pts = v.map((x, i) => `${((i / (v.length - 1)) * w).toFixed(1)},${(h - (x / max) * (h - 4) - 2).toFixed(1)}`).join(' ');
    return `<svg class="sc-num-line" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}
/** The site's real numbers as an infographic: each rolls up once when it comes into view; the text is the final number. */
function numbers({ id, title, lede, items } = {}) {
    const list = (items || []).filter((x) => x && num(x.value) != null);
    if (!list.length) return '';
    const hid = slug(id || title);
    const fmt = new Intl.NumberFormat('en-US');
    return `<section class="sc-numbers" data-sc-in${title ? ` aria-labelledby="${hid}"` : ''}>${head(title, lede, hid)}<dl class="sc-num-grid">${list.map((x) => {
        const n = num(x.value);
        return `<div class="sc-num"><dt>${esc(x.label)}</dt><dd><b data-to="${Number.isInteger(n) ? n : ''}">${esc(fmt.format(n))}</b>${x.unit ? `<span class="sc-num-unit">${esc(x.unit)}</span>` : ''}</dd>${spark(x.series)}${x.note ? `<p>${esc(x.note)}</p>` : ''}</div>`;
    }).join('')}</dl></section>`;
}

/** How it works: steps joined by a line that draws as the section comes into view. */
function flow({ id, title, lede, steps } = {}) {
    if (!has(steps)) return '';
    const hid = slug(id || title);
    return `<section class="sc-flow" data-sc-in${title ? ` aria-labelledby="${hid}"` : ''}>${head(title, lede, hid)}<ol class="sc-flow-list">${steps.map((s, i) => `<li style="--i:${i}"><span class="sc-flow-dot" aria-hidden="true">${s.icon ? art(s.icon, 20) : i + 1}</span><h3>${esc(s.title)}</h3>${s.text ? `<p>${esc(s.text)}</p>` : ''}</li>`).join('')}</ol></section>`;
}

const CSS = `
.sc-stage{--sa:var(--accent,#3b82f6);--sb:var(--accent-light,#60a5fa);position:relative;isolation:isolate;display:grid;gap:28px;align-items:center;padding:28px 0 36px;margin:0 0 8px}
@media (min-width:900px){.sc-stage{grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:48px;padding:56px 0 64px}}
.sc-stage-bg{position:absolute;inset:-40px calc(-1 * var(--ovk-gutter,16px)) 0;z-index:-1;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,#000 55%,transparent);mask-image:linear-gradient(180deg,#000 55%,transparent)}
.sc-motif{position:absolute;inset:0;width:100%;height:100%;opacity:.55}
@media (max-width:899px){.sc-motif{opacity:.28}.sc-stage-bg{-webkit-mask-image:linear-gradient(180deg,#000 30%,transparent 70%);mask-image:linear-gradient(180deg,#000 30%,transparent 70%)}}
.sc-motif .m-line,.sc-motif .m-dash,.sc-motif .m-draw{fill:none;stroke:var(--sa);stroke-width:2;stroke-linecap:round;opacity:.35}
.sc-motif .m-dash{stroke-dasharray:2 12;stroke:var(--sb)}
.sc-motif .m-draw{stroke-width:3;stroke-dasharray:1;stroke-dashoffset:1;opacity:.5}
.sc-motif .m-dot{fill:color-mix(in srgb,var(--sb) 28%,transparent);stroke:none}
.sc-motif .m-blink{fill:var(--sb);opacity:.6}
.sc-stage.is-in .sc-motif .m-draw{animation:sc-draw 2.4s cubic-bezier(.3,.7,.2,1) forwards}
.sc-stage.is-in .sc-motif .m-dash{animation:sc-flowdash 9s linear infinite}
.sc-stage.is-in .sc-motif .m-dot{animation:sc-breathe 5s ease-in-out infinite}
.sc-stage.is-in .sc-motif .m-d1{animation-delay:-1.6s}.sc-stage.is-in .sc-motif .m-d2{animation-delay:-3.2s}
.sc-stage.is-in .sc-motif .m-blink{animation:sc-blink 1.1s steps(1) infinite}
.sc-stage-copy h1{margin:0 0 14px;font-size:clamp(2rem,5.4vw,3.4rem);line-height:1.05;letter-spacing:-.03em}
.sc-stage-copy .sc-accent{background:linear-gradient(90deg,var(--sa),var(--sb));-webkit-background-clip:text;background-clip:text;color:transparent}
.sc-stage-lede{margin:0 0 20px;font-size:clamp(1.02rem,2.2vw,1.2rem);line-height:1.55;color:var(--text-secondary,#b6c0d0);max-width:38em}
.sc-stage-note{margin:12px 0 0;font-size:.86rem;color:var(--text-muted,#8a96a8)}
.sc-stage-demo{position:relative;min-width:0;border-radius:20px;background:color-mix(in srgb,var(--bg-secondary,#111827) 86%,transparent);border:1px solid color-mix(in srgb,var(--sb) 22%,var(--border,#263244));box-shadow:0 30px 70px -30px color-mix(in srgb,var(--sa) 45%,transparent),0 0 0 1px rgba(255,255,255,.02);overflow:hidden;opacity:0;transform:translateY(14px) scale(.985);transition:opacity .6s ease,transform .7s cubic-bezier(.2,.8,.2,1)}
.sc-stage.is-in .sc-stage-demo{opacity:1;transform:none}
.sc-stage-demo::before{content:'';position:absolute;inset:-30%;z-index:-1;background:radial-gradient(circle at 70% 20%,color-mix(in srgb,var(--sa) 30%,transparent),transparent 55%)}
.sc-frame-bar{display:flex;gap:6px;padding:10px 12px;border-bottom:1px solid var(--border,#263244)}
.sc-frame-bar i{width:9px;height:9px;border-radius:50%;background:var(--border-light,#334155)}
.sc-frame-body{padding:14px;min-width:0}
.sc-frame-phone{max-width:340px;margin:0 auto;border-radius:34px;padding:10px}
.sc-frame-phone .sc-frame-body{border-radius:26px;background:var(--bg-primary,#0b1220);min-height:420px}
.sc-reel,.sc-numbers,.sc-flow{margin:36px 0}
.sc-reel-list{list-style:none;margin:14px calc(-1 * var(--ovk-gutter,16px)) 0;padding:4px var(--ovk-gutter,16px) 10px;display:grid;grid-auto-flow:column;grid-auto-columns:min(78%,280px);gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}
.sc-reel-list::-webkit-scrollbar{display:none}
@media (min-width:900px){.sc-reel-list{grid-auto-flow:row;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));overflow:visible;margin:14px 0 0;padding:4px 0}}
.sc-reel-card{scroll-snap-align:start;border-radius:18px;background:var(--bg-secondary,#111827);border:1px solid var(--border,#263244);transition:transform .25s cubic-bezier(.2,.8,.2,1),border-color .25s,box-shadow .25s;opacity:0;transform:translateY(10px)}
.sc-reel.is-in .sc-reel-card{opacity:1;transform:none;transition-delay:calc(var(--i) * 70ms)}
.sc-reel-card>a,.sc-reel-card{color:inherit;text-decoration:none}
.sc-reel-card>a{display:block}
.sc-reel-card>a{padding:16px;height:100%;box-sizing:border-box}
.sc-reel-card:not(:has(>a)){padding:16px}
.sc-reel-card h3{margin:12px 0 6px;font-size:1.02rem}
.sc-reel-card p{margin:0;font-size:.9rem;line-height:1.5;color:var(--text-secondary,#b6c0d0)}
@media (hover:hover){.sc-reel-card:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--accent,#3b82f6) 50%,var(--border,#263244));box-shadow:0 16px 36px -20px color-mix(in srgb,var(--accent,#3b82f6) 60%,transparent)}}
.sc-reel-art svg,.sc-flow-dot svg{display:block}
.sc-reel-art{display:grid;place-items:center;width:52px;height:52px;border-radius:15px;background:color-mix(in srgb,var(--accent,#3b82f6) 14%,transparent);color:var(--accent-light,#60a5fa)}
.sc-reel.is-in [data-anim=float]{animation:sc-float 4.5s ease-in-out infinite}
.sc-reel.is-in [data-anim=pulse]{animation:sc-pulse 3.2s ease-in-out infinite}
.sc-reel.is-in [data-anim=tilt]{animation:sc-tilt 5s ease-in-out infinite}
.sc-reel.is-in [data-anim=pop]{animation:sc-pop .6s cubic-bezier(.3,1.6,.5,1) both;animation-delay:calc(var(--i,0) * 90ms + .2s)}
.sc-reel.is-in [data-anim=glow]{animation:sc-glow 3.6s ease-in-out infinite}
.sc-num-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0 0}
@media (min-width:700px){.sc-num-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
.sc-num{display:grid;gap:4px;align-content:start;padding:14px;border-radius:16px;background:var(--bg-secondary,#111827);border:1px solid var(--border,#263244);min-width:0}
.sc-num dt{order:2;font-size:.82rem;color:var(--text-muted,#8a96a8)}
.sc-num dd{order:1;margin:0;display:flex;align-items:baseline;gap:4px}
.sc-num b{font-size:clamp(1.5rem,4vw,2.1rem);font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.sc-num-unit{font-size:.9rem;color:var(--text-muted,#8a96a8)}
.sc-num-line{order:3;width:100%;height:28px}
.sc-num-line polyline{fill:none;stroke:var(--accent,#3b82f6);stroke-width:2;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round}
.sc-num-line{opacity:0;transition:opacity .9s ease .3s}.sc-numbers.is-in .sc-num-line{opacity:1}
.sc-num p{order:4;margin:0;font-size:.8rem;color:var(--text-muted,#8a96a8)}
.sc-flow-list{list-style:none;margin:16px 0 0;padding:0;display:grid;gap:18px;position:relative}
@media (min-width:800px){.sc-flow-list{grid-auto-flow:column;grid-auto-columns:1fr}}
.sc-flow-list::before{content:'';position:absolute;left:21px;top:22px;bottom:22px;width:2px;background:linear-gradient(180deg,var(--accent,#3b82f6),var(--accent-light,#60a5fa));transform-origin:0 0;transform:scaleY(0);transition:transform 1.2s cubic-bezier(.3,.7,.2,1)}
@media (min-width:800px){.sc-flow-list::before{left:22px;right:22px;top:21px;bottom:auto;width:auto;height:2px;transform:scaleX(0)}}
.sc-flow.is-in .sc-flow-list::before{transform:none}
.sc-flow-list li{position:relative;padding-left:60px}
@media (min-width:800px){.sc-flow-list li{padding:58px 0 0}}
.sc-flow-dot{position:absolute;left:0;top:0;display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:var(--bg-primary,#0b1220);border:2px solid var(--accent,#3b82f6);color:var(--accent-light,#60a5fa);font-weight:800}
.sc-flow-list h3{margin:8px 0 4px;font-size:1.02rem}
.sc-flow-list p{margin:0;font-size:.9rem;line-height:1.5;color:var(--text-secondary,#b6c0d0)}
@keyframes sc-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes sc-flowdash{to{stroke-dashoffset:-280}}
@keyframes sc-breathe{50%{opacity:.35}}
@keyframes sc-blink{50%{opacity:0}}
@keyframes sc-float{50%{transform:translateY(-5px)}}
@keyframes sc-pulse{50%{box-shadow:0 0 0 8px color-mix(in srgb,var(--accent,#3b82f6) 12%,transparent)}}
@keyframes sc-tilt{25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
@keyframes sc-pop{from{transform:scale(.6);opacity:0}}
@keyframes sc-glow{50%{background:color-mix(in srgb,var(--accent,#3b82f6) 26%,transparent)}}
@media (prefers-reduced-motion:reduce){.sc-stage *,.sc-reel *,.sc-numbers *,.sc-flow *,.sc-stage-demo,.sc-reel-card,.sc-flow-list::before{animation:none!important;transition:none!important}.sc-stage-demo,.sc-reel-card,.sc-num-line{opacity:1;transform:none}.sc-flow-list::before{transform:none}.sc-motif .m-draw{stroke-dashoffset:0}}
html[data-ov-motion=reduced] :is(.sc-stage,.sc-reel,.sc-numbers,.sc-flow) *,html[data-ov-motion=reduced] :is(.sc-stage-demo,.sc-reel-card){animation:none!important;transition:none!important;opacity:1;transform:none}
html[data-ov-motion=reduced] .sc-flow-list::before{transform:none;transition:none}
`;

// Starts each piece when it comes into view; rolls the numbers up from zero once. Without IntersectionObserver, or with
// reduced motion, everything is shown as it is (the server already wrote the final numbers).
const MOTION_JS = "(function(){try{var d=document,h=d.documentElement,still=(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)||h.getAttribute('data-ov-motion')==='reduced',els=[].slice.call(d.querySelectorAll('[data-sc-in]'));"
    + "function roll(e){if(still)return;[].slice.call(e.querySelectorAll('[data-to]')).forEach(function(n){var to=+n.getAttribute('data-to');if(!(to>0))return;var f=new Intl.NumberFormat('en-US'),t0=performance.now();(function s(t){var k=Math.min(1,(t-t0)/900);n.textContent=f.format(Math.round(to*(1-Math.pow(1-k,3))));if(k<1)requestAnimationFrame(s)})(t0)})}"
    + "if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('is-in')});return}"
    + "var io=new IntersectionObserver(function(es){es.forEach(function(x){if(!x.isIntersecting)return;x.target.classList.add('is-in');roll(x.target);io.unobserve(x.target)})},{threshold:.15});els.forEach(function(e){io.observe(e)})}catch(e){}})();";

module.exports = { stage, reel, numbers, flow, motifSVG, MOTIFS: Object.keys(MOTIFS), ANIMS, CSS, MOTION_JS };
