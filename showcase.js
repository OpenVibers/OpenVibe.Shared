'use strict';
/**
 * openvibe-shared/showcase — the sections a product's home page is built from (plan T11, D92), rendered on the
 * server as plain HTML (complete without JavaScript, readable by crawlers) and styled from the network's theme
 * tokens, so every product's home reads as one family:
 *
 *   const sc = require('openvibe-shared/showcase');
 *   `<link rel="stylesheet" href="${serve.url('showcase.css')}">` (cached; carries the ring icons' CSS too) or
 *   `<style>${sc.CSS}</style>`, then sc.hero({ eyebrow, title, accent, lede, actions, note, aside })   (an eyebrow that is
 *     only the site's name is left out: the navbar shows it; { icon, text } gives it an icon)
 *     + sc.features({ id, title, lede, items: [{ icon, title, text, href }] })
 *     + sc.steps({ title, lede, items: [{ title, text, href }] })
 *     + sc.code({ title, lede, samples: [{ label, lang, code }] })
 *     + sc.demo({ title, lede, iframe: { src, title, height } })            (or html: trusted markup)
 *     + sc.compare({ title, lede, columns: ['OpenVibe', 'Elsewhere'], rows: [{ label, values: [true, 'paid add-on'] }] })
 *     + sc.pricing({ title, lede, tiers: [{ name, price, per, items, action, highlight }], note })
 *     + sc.limits({ title, lede, columns, rows: [{ label, values }], source })   pricing that equals the API's limits
 *     + sc.stories({ title, items: [{ who, text, outcome }] })
 *     + sc.stats({ title, items: [{ value, label, href, icon }] })           a strip of real numbers (three across on a phone)
 *     + sc.cards({ title, lede, items: [{ href, title, text, image, badge, meta, live }], layout: 'grid'|'rail',
 *                  ratio: '16/9'|'4/3'|'1/1', more: { label, href } })             rich content: videos, streams, posts
 *     + sc.spotlight({ title, lede, items: [{ title, text, image, video, alt, href, actions }] })   features, shown
 *     + sc.faq({ title, items: [[question, answer]] })                       an accordion, with FAQPage data (faqJsonLd)
 *     + sc.network({ service, title, lede, items })                          "Part of OpenVibe": related products
 *     + sc.cta({ title, text, actions })
 *   sc.jsonLd(obj) is a <script type="application/ld+json"> that cannot end early ('<' escaped).
 *
 * Every string is escaped; the only markup that passes through is a field named `html` (trusted, the caller's own).
 * `icon` is a Font Awesome class ('fa-code') or an openvibe-shared/icons name ('ov:tools'). `actions` are
 * [{ label, href, primary?, icon? }]. Nothing here reads data: the page passes what it knows, and a section with no
 * items renders nothing (never an empty shell or a "coming soon").
 */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const has = (a) => Array.isArray(a) && a.length > 0;
let ovIcons = null;
let glyphSet = null;
/** 4.227.0 (design rule 142): a site or an app is drawn as its app icon, the menu's and Home's, whole on the server. */
function appIcon(key, size) {
    ovIcons = ovIcons || require('./ov-icons');
    return ovIcons.appHtml(String(key || 'ov').toLowerCase(), { size });
}
function icon(name, size = 22) {
    if (!name) return '';
    const n = String(name);
    if (n.startsWith('ov:')) {
        ovIcons = ovIcons || require('./ov-icons');
        const key = n.slice(3);
        // A name the ring set lacks drew as the bare OV mark (Today's "Your agenda", ov:calendar, 2026-11-02): the plain
        // glyph of that name, in a ring of its own, when the glyph set has it.
        if (key !== 'ov' && ovIcons.resolve(key) === 'ov') {
            glyphSet = glyphSet || require('./glyphs');
            if (glyphSet.NAMES.includes(key)) return `<span class="ov-icon sc-ovi sc-ovi--glyph" data-icon="${esc(key)}" style="--ovi-size:${size}px" aria-hidden="true">${glyphSet.svg(key)}</span>`;
        }
        return `<span class="ov-icon sc-ovi" data-icon="${esc(key)}" style="--ovi-size:${size}px" aria-hidden="true">${ovIcons.svg(key)}</span>`;
    }
    return `<i class="fa-solid ${esc(n.replace(/[^a-z0-9 -]/gi, ''))}" aria-hidden="true"></i>`;
}
const id = (s) => (s ? ` id="${esc(String(s).replace(/[^a-z0-9_-]/gi, '-'))}"` : '');
// The arrow on a "more" link is the glyph registry's (no text arrows: the owner, 11-13).
const goGlyph = () => { headGlyphs = headGlyphs || require('./glyphs'); return headGlyphs.svg('arrow-right', { size: 16 }); };
// Every section's heading carries an icon tile (the owner, 11-09: "these section titles should have an icon… look nicer
// and more consistent, separate things"): the section's kind gives a default, a site may pass its own (icon: 'name').
let headGlyphs = null;
const headIcon = (name) => {
    if (!name) return '';
    headGlyphs = headGlyphs || require('./glyphs');
    const n = String(name).replace(/^ov:/, '');
    const key = headGlyphs.NAMES.includes(n) ? n : (headGlyphs.fromFa ? headGlyphs.fromFa(n) : null);
    return key && headGlyphs.path(key) ? `<span class="sc-h-ic" aria-hidden="true">${headGlyphs.svg(key, { size: 18 })}</span>` : '';
};
const head = (title, lede, hid, ic) => `${title ? `<h2${hid ? ` id="${hid}"` : ''}>${headIcon(ic)}<span>${esc(title)}</span></h2>` : ''}${lede ? `<p class="sc-lede">${esc(lede)}</p>` : ''}`;
// Heading ids come from the title, so a page renders the same bytes every time (ETags, caches).
const slug = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'section';
const labelled = (title, h) => (title ? ` aria-labelledby="${h}"` : '');

function actions(list, cls = 'sc-actions') {
    if (!has(list)) return '';
    return `<div class="${cls}">${list.map((a) => `<a class="sc-btn${a.primary ? ' sc-primary' : ''}" href="${esc(a.href)}"${/^https?:/.test(a.href || '') && a.external ? ' rel="noopener"' : ''}>${a.icon ? icon(a.icon, 18) : ''}${esc(a.label)}</a>`).join('')}</div>`;
}

// A site's own name as the eyebrow repeats the navbar's brand right above it ("OpenVibe.Quest" twice, the owner
// 2026-10-28): such an eyebrow is left out. An eyebrow that says something else stays ({ icon, text } adds an icon).
const SITE_NAME_RE = /^(?:OpenVibe\.[A-Za-z]+|OpenRestream|[A-Za-z]+\.OpenVibe\.[A-Za-z]+)$/;
// "OpenVibe.Food · What should we eat?": the name repeats the navbar's, so the eyebrow keeps only what follows it
// (4.26.1; the owner, 2026-10-28: "why is [the name] twice… in the navbar and then right after it").
const SITE_NAME_LEAD_RE = /^(?:OpenVibe\.[A-Za-z]+|OpenRestream|[A-Za-z]+\.OpenVibe\.[A-Za-z]+)\s*[·•|—–:-]\s*/;
// 4.159.0: the hero shows no eyebrow at all (the owner, 11-09, on the pill above every home's headline: "looks really
// cheesy… lame… every site has this generic look"). The headline and its lede say what the site is; `eyebrow` is ignored.
function eyebrowHTML(eyebrow) {
    const e = eyebrow && typeof eyebrow === 'object' ? eyebrow : { text: eyebrow };
    let text = String(e.text || '').trim();
    if (!text || SITE_NAME_RE.test(text)) return '';
    text = text.replace(SITE_NAME_LEAD_RE, '');
    text = text.charAt(0).toUpperCase() + text.slice(1);
    return `<p class="sc-eyebrow">${e.icon ? icon(e.icon, 16) : ''}${esc(text)}</p>`;
}

/** The top of the page: what the product is, in one line, and where to start. */
/**
 * The hero's visual (4.26.0; the owner, 2026-10-28: the heroes were "ugly af… boring… not easy to understand… nice
 * animated visuals"). An orbit when the site names its places ({ inner: [{ icon, label, href }], outer: [...], center:
 * { title, sub, href }, label }): the main ones turn on the inner ring with their names, more on the outer ring, every icon
 * upright. Otherwise the aura: the site's mark in three slowly turning rings with accent dots. Transforms only, still
 * under either reduced-motion setting. On a phone an orbit sits small above the words, the aura faintly behind them.
 */
function visualHTML(orbit) {
    const mark = '<span class="ov-mark sc-vis-mark" data-size="72" style="width:72px;height:72px"></span>';
    if (!orbit) {
        return `<div class="sc-vis sc-aura" aria-hidden="true"><span class="sc-aura-glow"></span><span class="sc-ring r3"><i></i></span><span class="sc-ring r2"><i></i><i></i></span><span class="sc-ring r1"><i></i></span>${mark}</div>`;
    }
    const inner = (orbit.inner || []).filter((it) => it && it.icon).slice(0, 8);
    const outer = (orbit.outer || []).filter((it) => it && it.icon).slice(0, 12);
    const node = (it, i, n, big) => {
        const href = safeHref(it.href);
        const face = `<span class="sc-orb-face">${icon(it.icon, big ? 24 : 18)}${big && it.label ? `<span class="sc-orb-name">${esc(it.label)}</span>` : ''}</span>`;
        const attrs = ` style="--i:${i};--n:${n}"${it.label ? ` title="${esc(it.label)}"` : ''}`;
        return href ? `<a class="sc-orb-node${big ? ' is-big' : ''}" href="${esc(href)}"${attrs}${it.label ? ` aria-label="${esc(it.label)}"` : ''}>${face}</a>` : `<span class="sc-orb-node${big ? ' is-big' : ''}"${attrs} aria-hidden="true">${face}</span>`;
    };
    const c = orbit.center || {};
    const core = `${mark}${c.title ? `<b>${esc(c.title)}</b>` : ''}${c.sub ? `<small>${esc(c.sub)}</small>` : ''}`;
    const coreHref = safeHref(c.href);
    return `<div class="sc-vis sc-orbit" role="group" aria-label="${esc(orbit.label || c.title || 'What is here')}"><span class="sc-aura-glow" aria-hidden="true"></span>`
        + `${outer.length ? `<div class="sc-orb-ring o2">${outer.map((it, i) => node(it, i, outer.length, false)).join('')}</div>` : ''}`
        + `${inner.length ? `<div class="sc-orb-ring o1">${inner.map((it, i) => node(it, i, inner.length, true)).join('')}</div>` : ''}`
        + `${coreHref ? `<a class="sc-orb-core" href="${esc(coreHref)}">${core}</a>` : `<span class="sc-orb-core">${core}</span>`}</div>`;
}

function hero({ eyebrow, title, accent, lede, actions: acts, note, aside, html, orbit, visual, pageHead: ph = null } = {}) {
    // Without an aside of its own the hero gets a visual (4.26.0): an orbit of the site's places when it names them, else
    // the aura. visual: false keeps it plain.
    const vis = !aside && html == null && visual !== false;
    const hasOrbit = vis && orbit && (has(orbit.inner) || has(orbit.outer));
    return `<section class="sc-hero${aside || html || vis ? ' sc-split' : ''}${vis ? ` sc-has-vis${hasOrbit ? ' sc-has-orbit' : ''}` : ''}"><div class="sc-hero-main">${ph ? require('./kit').pageHead({ ...ph, title: [title, accent].filter(Boolean).join(' '), lede }) : `<h1>${esc(title)}${accent ? `<span class="sc-accent"> ${esc(accent)}</span>` : ''}</h1>${lede ? `<p class="sc-hero-lede">${esc(lede)}</p>` : ''}`}${actions(acts)}${note ? `<p class="sc-note">${esc(note)}</p>` : ''}</div>${aside ? `<div class="sc-hero-aside">${aside.html != null ? aside.html : esc(aside)}</div>` : html != null ? `<div class="sc-hero-aside">${html}</div>` : vis ? `<div class="sc-hero-aside sc-hero-vis">${visualHTML(hasOrbit ? orbit : null)}</div>` : ''}</section>`;
}

/** A grid of what the product does; each card may link to where it starts. */
function features({ id: sid, title, lede, items, icon: secIcon } = {}) {
    if (!has(items)) return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h, secIcon || 'grid')}<div class="sc-grid">${items.map((f) => {
        // A ring icon (ov:…) is its own 40 px tile, so it fills the slot instead of sitting small inside a second tile.
        const ring = f.icon && String(f.icon).startsWith('ov:');
        const inner = `${f.icon ? `<span class="sc-ic${ring ? ' sc-ic-ov' : ''}">${icon(f.icon, ring ? 40 : 22)}</span>` : ''}<span><b>${esc(f.title)}</b>${f.text ? `<small>${esc(f.text)}</small>` : ''}</span>`;
        return f.href ? `<a class="sc-card" href="${esc(f.href)}">${inner}</a>` : `<div class="sc-card">${inner}</div>`;
    }).join('')}</div></section>`;
}

/** A numbered path from nothing to done. */
function steps({ id: sid, title, lede, items, icon: secIcon } = {}) {
    if (!has(items)) return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h, secIcon || 'steps')}<ol class="sc-steps">${items.map((s) => `<li><b>${s.href ? `<a href="${esc(s.href)}">${esc(s.title)}</a>` : esc(s.title)}</b>${s.text ? `<span>${esc(s.text)}</span>` : ''}</li>`).join('')}</ol></section>`;
}

/** Code the reader can copy: one or more samples, each labelled with its language. */
function code({ id: sid, title, lede, samples, icon: secIcon } = {}) {
    if (!has(samples)) return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h, secIcon || 'code')}<div class="sc-code">${samples.map((c, i) => `<figure><figcaption>${esc(c.label || c.lang || `Sample ${i + 1}`)}</figcaption><pre tabindex="0" aria-label="${esc(c.label || c.lang || `Sample ${i + 1}`)}"><code${c.lang ? ` class="language-${esc(c.lang)}"` : ''}>${esc(String(c.code || '').replace(/^\n+|\s+$/g, ''))}</code></pre></figure>`).join('')}</div></section>`;
}

/** A live demo: the product itself in a frame, or the caller's own markup. */
function demo({ id: sid, title, lede, iframe, html, icon: secIcon } = {}) {
    if (!iframe && html == null) return '';
    const h = `sc-${slug(title)}`;
    const body = iframe
        ? `<iframe src="${esc(iframe.src)}" title="${esc(iframe.title || title || 'Live demo')}" loading="lazy" style="height:${Math.max(160, Math.min(900, Number(iframe.height) || 420))}px" referrerpolicy="strict-origin-when-cross-origin"${iframe.sandbox ? ` sandbox="${esc(iframe.sandbox)}"` : ''}></iframe>`
        : html;
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h, secIcon || 'play')}<div class="sc-demo">${body}</div></section>`;
}

/**
 * Read-once material — how it works, the code samples, what every page shows — folded under its own heading. The
 * heading stays visible and keeps its id, so a link to it still lands and the page outline does not change; `hint` is a
 * short line beside it on wide screens. `html` is the caller's markup (other showcase sections nest: they lose their
 * own width and padding inside). Closed by default; `open: true` for a fold the reader should see first.
 */
function fold({ id: sid, title, hint, html, open = false } = {}) {
    if (!title || html == null || html === '') return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec sc-fold-sec"${id(sid)} aria-labelledby="${h}"><details class="sc-fold"${open ? ' open' : ''}><summary><h2 id="${h}">${esc(title)}</h2>${hint ? `<span class="sc-fold-hint">${esc(hint)}</span>` : ''}</summary><div class="sc-fold-body">${html}</div></details></section>`;
}

/**
 * parts({ name, items: [{ id, label, count, html }], label, front }) — 4.228.0: a page of sections shown one at a time as
 * tabs on a phone (the owner, 11-11: "consolidate these into tabs, self-contained tabs, so the page isn't so freaking
 * huge … at least on mobile"; design rule short-pages-tabs). Every part stays in the HTML (crawlers, AI readers, no
 * script): radios and :has(), so a browser without :has() simply stacks them. A tab names its part and its count, so a
 * part's own showcase heading steps aside on a phone (it still names the section for screen readers). Wide screens keep
 * the parts stacked. Phones are 900 px and under; a front page (front: true) tabs only at 600 px and under. Two to eight
 * parts get tabs; one, or more than eight, are stacked as they are. Parts with no html are left out, never an empty tab.
 */
function parts({ name = 'parts', items = [], label = 'Sections', front = false, checked = '' } = {}) {
    const list = (items || []).filter((x) => x && x.id != null && x.label && x.html != null && x.html !== '');
    if (!list.length) return '';
    const n = slug(name);
    const key = (x) => String(x.id).replace(/[^a-z0-9_-]/gi, '-');
    const body = list.map((x) => `<section class="ov-part" data-part="${esc(key(x))}">${x.html}</section>`).join('');
    if (list.length < 2 || list.length > 8) return `<div class="ov-parts is-stacked">${body}</div>`;
    const open = checked && list.some((x) => String(x.id) === String(checked)) ? String(checked) : String(list[0].id);
    const radios = list.map((x) => `<input type="radio" class="ov-parts-r" name="ovp-${n}" id="ovp-${n}-${key(x)}" value="${esc(key(x))}"${String(x.id) === open ? ' checked' : ''}>`).join('');
    const bar = list.map((x) => `<label for="ovp-${n}-${key(x)}">${esc(x.label)}${x.count != null && x.count !== '' ? ` <span class="ov-parts-n">${esc(x.count)}</span>` : ''}</label>`).join('');
    return `<div class="ov-parts${front ? ' ov-parts--front' : ''}" data-parts="${list.length}">${radios}<div class="ov-parts-bar" role="group" aria-label="${esc(label)}">${bar}</div>${body}</div>`;
}

/**
 * pick({ key, label, head, headId, bodyClass, panes: [{ id, label, html }], checked, front = true }) — 4.228.0: the "pick block" twenty-five
 * sites each kept a copy of (server/render/short.js), now one: a heading over the page's own blocks, one at a time as
 * tabs on a phone (parts()), every block in the HTML. Each pane keeps its id, so a link to it opens its tab. The copies
 * drew a row of chips that only jumped to a pane, so a phone still showed them all (the owner, 11-12: "You also never
 * released the new GUI with the tabs"). checked: the pane open first (else the first). A pane with no html is left out.
 * It links ov-parts.css itself (by its content hash), so no site has to.
 */
function pick({ key = 'pick', label = 'Sections', head = '', headId = '', bodyClass = '', panes = [], checked = '', front = true } = {}) {
    const list = (panes || []).filter((p) => p && p.id && p.label && p.html != null && p.html !== '');
    if (!list.length) return '';
    serveMod = serveMod || require('./serve');
    const items = list.map((p) => ({ id: p.id, label: p.label, html: `<div class="pick-pane" id="${esc(p.id)}">${p.html}</div>` }));
    return `<link rel="stylesheet" href="${esc(serveMod.url('ov-parts.css'))}"><div class="pick" id="pick-${esc(String(key).replace(/[^a-z0-9_-]/gi, '-'))}"><div class="pick-bar"><div class="pick-head"><h2${headId ? ` id="${esc(headId)}"` : ''}>${esc(head || label)}</h2></div></div><div class="pick-body${bodyClass ? ` ${esc(bodyClass)}` : ''}">${parts({ name: key, label, front, items, checked: list.some((p) => p.id === checked) ? checked : '' })}</div></div>`;
}
let serveMod = null;

/** parts()' look: phones see one part and a tab bar (generated for one to eight parts, at 900 px or, for a front page, 600). */
const PARTS_CSS = (() => {
    const on = (scope) => {
        const k = [1, 2, 3, 4, 5, 6, 7, 8];
        return [
            `${scope}>.ov-parts-r{display:block;position:absolute;width:1px;height:1px;margin:0;opacity:0;pointer-events:none}`,
            `${scope}>.ov-parts-bar{display:flex}`,
            `${scope}>.ov-part>.sc-sec>h2:first-child,${scope}>.ov-part>.sc-sec>.sc-fold>summary>h2{display:none}`,
            `${scope}>.ov-part>.sc-sec{margin-top:0;padding-top:0;border-top:0}`,
            ...k.map((i) => `${scope}:has(>.ov-parts-r:nth-of-type(${i}):checked)>.ov-parts-bar>label:nth-of-type(${i}){background:var(--bg-card,#16213a);color:var(--text-primary,#e6edf7);box-shadow:0 1px 2px rgba(0,0,0,.25),inset 0 0 0 1px color-mix(in srgb,var(--accent,#3b82f6) 30%,transparent)}`),
            ...k.map((i) => `${scope}:has(>.ov-parts-r:nth-of-type(${i}):checked)>.ov-part:not(:nth-of-type(${i})){display:none}`),
            `${scope}:has(>.ov-parts-r:focus-visible)>.ov-parts-bar{outline:2px solid var(--accent,#3b82f6);outline-offset:2px}`,
            // A link to something inside a part (#faq, a hero's anchor) opens that part, whichever tab was chosen.
            `${scope}:has(>.ov-part:target,>.ov-part :target)>.ov-part:not(:target):not(:has(:target)){display:none}`,
            `${scope}:has(>.ov-part:target,>.ov-part :target)>.ov-part:is(:target,:has(:target)){display:block!important}`,
        ].join('\n');
    };
    return [
        '.ov-parts-r,.ov-parts-bar{display:none}',
        '.ov-parts-bar{gap:4px;margin:18px 0 14px;padding:4px;border-radius:14px;background:color-mix(in srgb,var(--text-primary,#e6edf7) 5%,transparent);overflow-x:auto;scrollbar-width:none;overscroll-behavior-x:contain}.ov-parts-bar::-webkit-scrollbar{display:none}',
        '.ov-parts-bar label{flex:1 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:42px;padding:0 14px;border-radius:10px;font-size:13.5px;font-weight:700;color:var(--text-secondary,#a8b3c4);white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background-color .2s,color .2s}',
        '.ov-parts-bar label:active{transform:scale(.97)}',
        '.pick .ov-part+.ov-part{margin-top:26px}.pick .ov-parts-bar{margin-top:10px}',
        '.ov-parts-n{min-width:18px;padding:0 6px;border-radius:999px;font-size:11.5px;line-height:18px;text-align:center;font-variant-numeric:tabular-nums;background:color-mix(in srgb,var(--text-primary,#e6edf7) 9%,transparent)}',
        `@supports selector(:has(*)){@media (max-width:900px){\n${on('.ov-parts:not(.is-stacked):not(.ov-parts--front)')}\n}@media (max-width:600px){\n${on('.ov-parts.ov-parts--front')}\n}}`,
        'html[data-ov-motion=off] .ov-parts-bar label{transition:none}',
    ].join('\n');
})();

const cell = (v) => (v === true ? '<span class="sc-yes" aria-label="yes">✓</span>' : v === false || v == null ? '<span class="sc-no" aria-label="no">—</span>' : esc(v));

// A table wider than a phone scrolls inside its wrapper, so the wrapper is a region the keyboard can reach and name
// (axe scrollable-region-focusable, WCAG 2.1.1): focusable, and labelled by the section's heading.
const tableWrap = (title, h) => `<div class="sc-table-wrap" tabindex="0" role="region" ${title ? `aria-labelledby="${h}"` : 'aria-label="Table"'}>`;

/** How the product compares, feature by feature. The first column is this product. */
function compare({ id: sid, title, lede, columns, rows, icon: secIcon } = {}) {
    if (!has(rows) || !has(columns)) return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h, secIcon || 'chart')}${tableWrap(title, h)}<table class="sc-table"><thead><tr><th scope="col"><span class="sr-only">Feature</span></th>${columns.map((c, i) => `<th scope="col"${i === 0 ? ' class="sc-us"' : ''}>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th>${columns.map((_, i) => `<td${i === 0 ? ' class="sc-us"' : ''}>${cell((r.values || [])[i])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}

/** Plans side by side. A price of 0 reads "Free". */
function pricing({ id: sid, title, lede, tiers, note, icon: secIcon } = {}) {
    if (!has(tiers)) return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h, secIcon || 'coin')}<div class="sc-tiers">${tiers.map((t) => `<div class="sc-tier${t.highlight ? ' sc-hl' : ''}"><b class="sc-tier-name">${esc(t.name)}</b><p class="sc-price">${t.price === 0 || t.price === '0' ? 'Free' : esc(t.price)}${t.per && !(t.price === 0 || t.price === '0') ? `<small> / ${esc(t.per)}</small>` : ''}</p>${has(t.items) ? `<ul>${t.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${t.action ? actions([{ ...t.action, primary: t.highlight }], 'sc-actions sc-tier-act') : ''}</div>`).join('')}</div>${note ? `<p class="sc-note">${esc(note)}</p>` : ''}</section>`;
}

/**
 * The limits a caller really gets, as a table: pricing that equals the API's limits. `source` names where the numbers
 * come from (a /limits.json URL), so the page can never promise more than the service enforces.
 */
function limits({ id: sid, title, lede, columns, rows, source, icon: secIcon } = {}) {
    if (!has(rows) || !has(columns)) return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h, secIcon || 'gauge')}${tableWrap(title, h)}<table class="sc-table sc-limits"><thead><tr><th scope="col">Limit</th>${columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th>${columns.map((_, i) => `<td>${cell((r.values || [])[i])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${source ? `<p class="sc-note">These are the limits the service enforces, read from <a href="${esc(source)}">${esc(source.replace(/^https?:\/\//, ''))}</a>.</p>` : ''}</section>`;
}

/** What people do with it, in their words. Only real uses: the caller passes nothing it cannot stand behind. */
function stories({ id: sid, title, lede, items, icon: secIcon } = {}) {
    if (!has(items)) return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h, secIcon || 'quote')}<div class="sc-stories">${items.map((s) => `<figure class="sc-story"><blockquote>${esc(s.text)}</blockquote><figcaption>${esc(s.who)}${s.outcome ? `<span>${esc(s.outcome)}</span>` : ''}</figcaption></figure>`).join('')}</div></section>`;
}

// A next step's target names: the service id → the product name the card says it opens ("on OpenVibe.Media").
const SERVICE_NAME = (to) => {
    const t = String(to || '').toLowerCase();
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(t)) return '';
    if (t === 'openre') return 'OpenRestream';
    return `OpenVibe.${t.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`;
};
// Only links a person can follow safely: https anywhere, or a path on this site. A path may hold no backslash and no
// tab or newline: the URL parser turns \ into / and drops tab/LF/CR, so "/\evil.example" would leave the site.
const safeHref = (h) => {
    const s = String(h || '');
    if (/^https:\/\//i.test(s)) return s;
    return /^\/(?!\/)[^\t\n\r\\]*$/.test(s) ? s : '';
};
const withFrom = (href, from) => {
    if (!from || !/^[a-z][a-z0-9-]{0,31}$/.test(String(from))) return href;
    const [base, hash = ''] = href.split('#');
    return `${base}${base.includes('?') ? '&' : '?'}ov_from=${encodeURIComponent(from)}${hash ? `#${hash}` : ''}`;
};

/**
 * Next steps on other OpenVibe products (Shared ADR 0002, plan D94): after a person finishes something, up to four
 * concrete things to do next, each a real link that works signed out. Items: `{ to, what, text?, href, from?, embed? }`
 * — `to` picks the ring icon and the "on OpenVibe.X" label, `from` adds the referral tag `ov_from=<from>` (never anything
 * about the person), `embed` adds a secondary link to an embeddable view. Presentation only: each site passes its own
 * items. An item without `what` or a safe `href` is left out; no items → ''.
 */
function nextSteps({ id: sid, title = 'Next steps', lede, items } = {}) {
    const usable = (items || []).filter((s) => s && s.what && safeHref(s.href)).slice(0, 4);
    if (!usable.length) return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec sc-next"${id(sid)}${labelled(title, h)}>${head(title, lede, h)}<ol class="sc-next-list">${usable.map((s) => {
        const to = SERVICE_NAME(s.to);
        const href = withFrom(safeHref(s.href), s.from);
        const embed = safeHref(s.embed);
        return `<li class="sc-next-item"><a class="sc-next-main" href="${esc(href)}">${s.to && to ? appIcon(s.to, 44) : ''}<span class="sc-next-body"><b>${esc(s.what)}</b>${s.text ? `<small>${esc(s.text)}</small>` : ''}${to ? `<span class="sc-next-on">on ${esc(to)}</span>` : ''}</span><span class="sc-next-go" aria-hidden="true">${goGlyph()}</span></a>${embed ? `<a class="sc-next-embed" href="${esc(embed)}">Embed it</a>` : ''}</li>`;
    }).join('')}</ol></section>`;
}

/** A strip of real numbers ("12,400 streams", "184 tools"). The page passes what it measured; nothing is invented here. */
function stats({ id: sid, title, items, icon: secIcon } = {}) {
    const usable = (items || []).filter((x) => x && x.value != null && x.label);
    if (!usable.length) return '';
    const h = `sc-${slug(title || 'numbers')}`;
    return `<section class="sc-sec sc-stats-sec"${id(sid)}${labelled(title, h)}>${title ? `<h2 id="${h}" class="sr-only">${esc(title)}</h2>` : ''}<dl class="sc-stats">${usable.map((x) => {
        const inner = `<dt>${esc(x.label)}</dt><dd>${x.icon ? `<span class="sc-stat-ic">${icon(x.icon, 18)}</span>` : ''}${esc(x.value)}</dd>`;
        const href = safeHref(x.href);
        return href ? `<a class="sc-stat" href="${esc(href)}">${inner}</a>` : `<div class="sc-stat">${inner}</div>`;
    }).join('')}</dl></section>`;
}

const RATIOS = { '16/9': '16 / 9', '4/3': '4 / 3', '1/1': '1 / 1', '3/4': '3 / 4', '9/16': '9 / 16' };
/**
 * Rich content: live streams, videos, posts, products, listings. `layout: 'rail'` is one swipeable row (scroll snap) for
 * the top of a page; 'grid' (the default) wraps. Images are lazy and hold their space (`ratio`), so nothing jumps.
 * `live: true` adds the red LIVE badge; `badge` is any short label, `meta` a quiet line under the title.
 */
function cards({ id: sid, title, lede, items, layout = 'grid', ratio = '16/9', more, icon: secIcon } = {}) {
    const usable = (items || []).filter((c) => c && c.title && safeHref(c.href));
    if (!usable.length) return '';
    const h = `sc-${slug(title)}`;
    const ar = RATIOS[ratio] || RATIOS['16/9'];
    const moreHref = more && safeHref(more.href);
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${title || moreHref ? `<div class="sc-head-row"><div>${head(title, lede, h, secIcon || 'image')}</div>${moreHref ? `<a class="sc-more" href="${esc(moreHref)}">${esc(more.label || 'See all')} <span class="sc-go" aria-hidden="true">${goGlyph()}</span></a>` : ''}</div>` : ''}<ul class="sc-cards sc-${layout === 'rail' ? 'rail' : 'wrap'}" style="--sc-ar:${ar}">${usable.map((c) => {
        const img = /^(https:\/\/|\/(?!\/))/.test(c.image || '') ? `<img src="${esc(c.image)}" alt="${esc(c.alt || '')}" loading="lazy" decoding="async">` : '';
        const badge = c.live ? '<span class="sc-badge sc-live">LIVE</span>' : c.badge ? `<span class="sc-badge">${esc(c.badge)}</span>` : '';
        return `<li><a class="sc-tile" href="${esc(safeHref(c.href))}"><span class="sc-thumb">${img}${badge}</span><span class="sc-tile-body"><b>${esc(c.title)}</b>${c.meta ? `<small>${esc(c.meta)}</small>` : ''}${c.text ? `<span class="sc-tile-text">${esc(c.text)}</span>` : ''}</span></a></li>`;
    }).join('')}</ul></section>`;
}

/** Features, shown rather than listed: a picture or a short muted loop beside each, alternating sides. */
function spotlight({ id: sid, title, lede, items, icon: secIcon } = {}) {
    const usable = (items || []).filter((x) => x && x.title);
    if (!usable.length) return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h, secIcon || 'star')}<div class="sc-spots">${usable.map((x) => {
        const video = /^(https:\/\/|\/(?!\/))/.test(x.video || '') ? `<video src="${esc(x.video)}" muted loop playsinline autoplay preload="none"${x.image ? ` poster="${esc(x.image)}"` : ''} aria-label="${esc(x.alt || x.title)}"></video>` : '';
        const img = !video && /^(https:\/\/|\/(?!\/))/.test(x.image || '') ? `<img src="${esc(x.image)}" alt="${esc(x.alt || '')}" loading="lazy" decoding="async">` : '';
        const href = safeHref(x.href);
        return `<article class="sc-spot">${video || img ? `<div class="sc-spot-media">${video || img}</div>` : ''}<div class="sc-spot-body"><h3>${href ? `<a href="${esc(href)}">${esc(x.title)}</a>` : esc(x.title)}</h3>${x.text ? `<p>${esc(x.text)}</p>` : ''}${actions(x.actions, 'sc-actions sc-spot-act')}</div></article>`;
    }).join('')}</div></section>`;
}

/** Questions people ask, as an accordion that works without JavaScript. Pair it with faqJsonLd(items) in the head. */
function faq({ id: sid, title = 'Questions', lede, items, icon: secIcon } = {}) {
    const usable = (items || []).filter((q) => Array.isArray(q) && q[0] && q[1]);
    if (!usable.length) return '';
    const h = `sc-${slug(title)}`;
    // 4.248.0 (the owner, 11-14: "so much padding for no reason … more compact … add icons"): each question wears a glyph,
    // its own third item or one its words suggest; the row is compact whatever the site's own details rule says.
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h, secIcon || 'help')}<div class="sc-faq">${usable.map(([q, a, ic], i) => `<details${i === 0 ? ' open' : ''}><summary><span class="sc-q-ic" aria-hidden="true">${qGlyph(ic, q)}</span><span>${esc(q)}</span></summary><p>${esc(a)}</p></details>`).join('')}</div></section>`;
}
/** The glyph a question wears: the one it names, else the first its words suggest, else a question mark. */
const Q_WORDS = [[/\b(free|cost|price|pay|paid|money|charge)/i, 'coin'], [/\b(key|safe|secure|privacy|private|password)/i, 'lock'],
    [/\b(platform|where|which site|countr|languag)/i, 'globe'], [/\b(encode|quality|bitrate|resolution|setting)/i, 'sliders'],
    [/\b(obs|camera|webcam|record|video|vod|clip)/i, 'video'], [/\b(appear|show|see|visible|public)/i, 'eye'], [/\b(delete|remove|cancel)/i, 'trash'],
    [/\b(account|sign|login|profile)/i, 'user'], [/\b(api|sdk|code|developer|bot)/i, 'code'], [/\b(live|stream|broadcast)/i, 'live'],
    [/\b(how long|when|time|schedule)/i, 'clock'], [/\b(download|export|backup)/i, 'download'], [/\b(ai|agent|model)/i, 'spark']];
function qGlyph(named, q) {
    headGlyphs = headGlyphs || require('./glyphs');
    const want = named && headGlyphs.NAMES.includes(String(named)) ? String(named) : ((Q_WORDS.find(([re]) => re.test(String(q || ''))) || [])[1] || 'help');
    return headGlyphs.svg(headGlyphs.NAMES.includes(want) ? want : 'help', { size: 16 });
}
/** A JSON-LD block that cannot close its script early. */
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const faqJsonLd = (items) => jsonLd({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: (items || []).filter((q) => Array.isArray(q) && q[0] && q[1]).map(([q, a]) => ({ '@type': 'Question', name: String(q), acceptedAnswer: { '@type': 'Answer', text: String(a) } })) });

/**
 * Where each home page leads next on the network: the other places in the same menu group, in the group's own order
 * (OpenVibe.Network frame/sites.js GROUPS, the owner's regrouping of 2026-11-10), so "More on OpenVibe" shows the
 * same neighbourhood the launcher and the footer show. Up to four. [to, what, href]; `to` is the name and icon the
 * card shows (Email is `email`, OpenRestream `openre`, Studio `studio`, Locker `locker`).
 */
const GROUPS = {
    watch: [
        ['live', 'Go live, watch streams', 'https://openvibe.live/'],
        ['video', 'Clips and past streams', 'https://openvibe.video/'],
        ['pics', 'Share pictures', 'https://openvibe.pics/'],
        ['download', 'Your files', 'https://openvibe.download/'],
        ['openre', 'Stream everywhere', 'https://openre.stream/'],
        ['cam', 'Your camera, in private', 'https://openvibe.cam/'],
        ['tours', 'Cities, routes, stays', 'https://openvibe.tours/'],
    ],
    talk: [
        ['community', 'Posts and pastes', 'https://openvibe.community/'],
        ['chat', 'Chat with anyone', 'https://openvibe.chat/'],
        ['tips', 'Support streamers', 'https://openvibe.tips/'],
        ['vip', 'Back your creators', 'https://openvibe.vip/'],
        ['email', 'Masks and inboxes', 'https://openvibe.email/'],
        ['help', 'Help nearby', 'https://openvibe.help/'],
        ['network', 'Your account', 'https://openvibe.network/'],
    ],
    play: [
        ['games', 'Play in your browser', 'https://openvibe.games/'],
        ['quest', 'Earn badges', 'https://openvibe.quest/'],
        ['surf', 'Surf maps and the web', 'https://openvibe.surf/'],
        ['fun', 'Something to do', 'https://openvibe.fun/'],
        ['meme', 'Memes with receipts', 'https://openvibe.meme/'],
        ['casino', 'Odds shown, chips free', 'https://openvibe.casino/'],
        ['inventory', 'Your items', 'https://openvibe.my/inventory'],
    ],
    read: [
        ['news', 'Sourced, not spun', 'https://openvibe.news/'],
        ['today', 'Your schedule', 'https://openvibe.today/'],
        ['report', 'Your numbers, honest', 'https://openvibe.report/'],
        ['search', 'Search everything', 'https://search.openvibe.network/'],
        ['wiki', 'Facts with sources', 'https://openvibe.wiki/'],
        ['blog', 'Write long-form', 'https://openvibe.blog/'],
        ['vision', 'Ask a picture', 'https://openvibe.vision/'],
    ],
    shop: [
        ['deals', 'Deals people share', 'https://openvibe.deals/'],
        ['coupons', 'Codes that work', 'https://openvibe.coupons/'],
        ['shoes', 'Every shoe, every price', 'https://open.shoes/'],
        ['reviews', 'Honest reviews', 'https://openvibe.reviews/'],
        ['trade', 'Watch the markets', 'https://openvibe.trade/'],
        // The three doors of 2026-11-13: Markets and Finance sit with Deals and Trade, Expert with the agents.
        ['markets', 'Every marketplace in one search', 'https://openvibe.markets/'],
        ['finance', 'Your money in one private place', 'https://openvibe.finance/'],
        ['rent', 'Places to rent', 'https://openvibe.rent/'],
        ['work', 'Find a job', 'https://openvibe.work/'],
    ],
    tools: [
        ['tools', 'Every online tool', 'https://openvibe.tools/'],
        ['design', 'Try themes live', 'https://openvibe.design/'],
        ['domains', 'Names and prices', 'https://openvibe.domains/'],
        ['host', 'Compare hosting', 'https://openvibe.host/'],
        ['studio', 'Edit photos in your browser', 'https://openvibe.studio/'],
        ['locker', 'Files only you can open', 'https://openvibe.locker/'],
        ['food', 'Food near you', 'https://openvibe.food/'],
    ],
    make: [
        ['space', 'Host a site or app', 'https://openvibe.space/'],
        ['codes', 'Code with any agent', 'https://openvibe.codes/'],
        ['bot', 'Drive a robot', 'https://openvibe.bot/'],
        ['actor', 'The agent engine', 'https://openvibe.actor/'],
        ['expert', 'Agents you make, with a soul', 'https://openvibe.expert/'],
        ['computer', 'Your computer, your way', 'https://openvibe.computer/'],
        ['connect', 'Share a port with Link', 'https://connect.openvibe.link/'],
    ],
    build: [
        ['services', 'APIs, SDK and keys', 'https://openvibe.services/'],
        ['exchange', 'AI models, one account', 'https://openvibe.exchange/'],
        ['run', 'Run jobs anywhere', 'https://openvibe.run/'],
        ['zone', 'S3 storage', 'https://openvibe.zone/'],
        ['events', 'Event streams', 'https://openvibe.events/'],
        ['watch', 'Know when it changes', 'https://openvibe.watch/'],
        ['git', 'Host and browse code', 'https://git.openvibe.codes/'],
    ],
};
// The service names home pages pass that are not the card's own name (Video is media-hub, Media is its API,
// Restream's service is openre, Email's mail, Studio's image, Locker's lock, Homes is Rent's section, Bench Report's).
const RELATED_ALIAS = {
    media: 'video', 'media-hub': 'video', video: 'video', stream: 'openre', openre: 'openre', restream: 'openre',
    mail: 'email', email: 'email', image: 'studio', studio: 'studio', lock: 'locker', locker: 'locker',
    homes: 'rent', bench: 'report',
};
const RELATED_ALL = Object.entries(GROUPS).flatMap(([group, members]) => members.map(([to, what, href]) => ({ group, to, what, href })));
const RELATED_BY_ID = new Map(RELATED_ALL.map((x) => [x.to, x]));
function relatedFor(key) {
    const id = RELATED_ALIAS[key] || key;
    const here = RELATED_BY_ID.get(id);
    if (!here) return null;
    return RELATED_ALL.filter((x) => x.group === here.group && x.to !== id).slice(0, 4).map((x) => [x.to, x.what, x.href]);
}
const RELATED = {};
for (const x of RELATED_ALL) RELATED[x.to] = relatedFor(x.to);
for (const [alias, id] of Object.entries(RELATED_ALIAS)) if (RELATED_BY_ID.has(id)) RELATED[alias] = relatedFor(id);
// A product without its own list shows one place from each of the first four groups, in the groups' order.
const DEFAULT_RELATED = ['live', 'community', 'games', 'news'].map((id) => {
    const x = RELATED_BY_ID.get(id);
    return [x.to, x.what, x.href];
});

/**
 * "Part of OpenVibe": up to four related products for this one (RELATED, or the caller's own items in the same
 * [to, what, href] or { to, what, href } shape), each a ring icon, its name and why to go there.
 */
function network({ id: sid, service, title = 'More on OpenVibe', lede = 'One account across every OpenVibe site.', items, icon: secIcon } = {}) {
    const list = (items || RELATED[String(service || '').toLowerCase()] || DEFAULT_RELATED)
        .map((x) => (Array.isArray(x) ? { to: x[0], what: x[1], href: x[2] } : x))
        .filter((x) => x && x.what && safeHref(x.href) && x.to !== service).slice(0, 4);
    if (!list.length) return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec sc-network"${id(sid)}${labelled(title, h)}>${head(title, lede, h, secIcon || 'spark')}<ul class="sc-net">${list.map((x) => `<li><a href="${esc(withFrom(safeHref(x.href), service))}">${appIcon(x.to, 44)}<span><b>${esc(SERVICE_NAME(x.to) || x.to)}</b><small>${esc(x.what)}</small></span></a></li>`).join('')}</ul><div class="sc-net-now" data-ov-now hidden></div><p class="sc-net-all"><a href="https://openvibe.network/sites">Every OpenVibe site <span class="sc-go" aria-hidden="true">${goGlyph()}</span></a></p></section>`;
}

/**
 * apps({ id, title, lede, groups: [{ name, items }], items, more: { href, label } }) — a set of apps as a launcher, the
 * way a phone's home screen shows them: each item { icon ('ov:live' or 'fa-…'), name, text, href }. Phones see icon
 * tiles three or four to a row with the name under the icon (the one-line text is for screen readers and wider
 * screens); from 600 px each tile is a row: icon, name, the text in one line. groups put a small heading over each
 * set (the network's neighbourhoods); items without groups is one grid. A set of two to four, or of eight, twelve…,
 * gets a column count that fills its rows (four tiles: four across on a phone, two by two from 600 px, four from
 * 960 px), so no tile sits alone on a row. Empty → ''.
 */
function apps({ id: sid, title = '', lede = '', groups = null, items = null, more = null, icon: secIcon } = {}) {
    const sets = (groups || [{ name: '', items: items || [] }]).map((g) => ({ name: g.name || '', items: (g.items || []).filter((x) => x && x.name && safeHref(x.href)) })).filter((g) => g.items.length);
    if (!sets.length) return '';
    const h = `sc-${slug(title || 'apps')}`;
    const glyph = (x) => { const k = String(x.icon || 'ov:spark'); return k.startsWith('ov:') ? appIcon(k.slice(3), 56) : `<span class="sc-ic">${icon(k, 22)}</span>`; };
    const tile = (x) => `<li><a href="${esc(safeHref(x.href))}">${glyph(x)}<span class="sc-app-t"><b>${esc(x.name)}</b>${x.text ? `<small>${esc(x.text)}</small>` : ''}</span></a></li>`;
    // Six or nine are three a row (4.46.1): four columns left one tile alone on the last row.
    const cols = (n) => (n >= 2 && n <= 4 ? n : n % 4 === 0 ? 4 : n % 3 === 0 ? 3 : 0);
    const body = sets.map((g) => `${g.name ? `<h3 class="sc-apps-group">${esc(g.name)}</h3>` : ''}<ul class="sc-apps${cols(g.items.length) ? ` sc-apps--c${cols(g.items.length)}` : ''}">${g.items.map(tile).join('')}</ul>`).join('');
    const end = more && safeHref(more.href) ? `<p class="sc-apps-more"><a href="${esc(safeHref(more.href))}">${esc(more.label || 'See all')} <span class="sc-go" aria-hidden="true">${goGlyph()}</span></a></p>` : '';
    return `<section class="sc-sec sc-apps-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h, secIcon || 'grid')}${body}${end}</section>`;
}

/** The closing call to action. */
function cta({ title, text, actions: acts } = {}) {
    if (!title) return '';
    return `<section class="sc-cta"><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}${actions(acts)}</section>`;
}

// ── Rooms (plan 2026-10-28 §3.3): a room's front door, in the order every room shares ──
let roomsLib = null, kitLib = null;
const fmtNum = (v) => (typeof v === 'number' ? v.toLocaleString('en-US') : String(v));
/** The room's motif when it brings none: its icon in an aura of its accent, two slow orbits and their dots. */
function roomMotif(r) {
    kitLib = kitLib || require('./kit');
    return `<div class="sc-room-motif" aria-hidden="true"><span class="sc-rm-glow"></span><span class="sc-rm-orbit o1"><i></i></span><span class="sc-rm-orbit o2"><i></i><i></i></span>`
        + `<span class="sc-rm-core">${kitLib.icon(r ? r.icon : 'spark')}</span></div>`;
}
/**
 * room({ room, hero, proof, rails, scenes, explore, dev, faq, network, html }) — a room's front door, in the order every
 * room shares: hero → live proof → rails (Right now, For you…) → feature scenes → explore → for developers → questions →
 * the rest of OpenVibe. Wrapped in .ov-room with the room's accent (rooms.js); what has nothing to show is left out.
 *   room: 'surf' (rooms.js id or host; an unknown one keeps the theme's accent)
 *   hero: { title (≤ 8 words), lede, search: { action, name, placeholder, hints: [typed in turn], label },
 *           start: { href, label } (when there is no box), chips: [{ label, href }] (≤ 5), motif (trusted HTML) }
 *   proof: [{ value, label, live: true } | { value, label, asOf: 'Oct 28' }] — real numbers only; 0 or none is left out
 *   rails: [{ id, title, more, items: [kit.card(...)], size }] — kit.rail
 *   scenes: [{ title, text, html (trusted: the room's own component in a demo state), action: { href, label } }]
 *   explore: { title, items: [{ href, title, text, icon }] } — sc.features · dev: sc.code's arguments, with links
 *   faq: { title, items: [[q, a]] } · network: sc.network's arguments · html: trusted markup after the scenes
 * Needs kit.css, room.css (cards, rails, the room's accent) and showcase.css; motion.js makes the numbers tick and the box type.
 */
function room({ room: key, hero: h = {}, proof, rails, scenes, explore, dev, faq: q, network: net, html } = {}) {
    roomsLib = roomsLib || require('./rooms');
    kitLib = kitLib || require('./kit');
    const r = roomsLib.get(key);
    const chips = (h.chips || []).filter((c) => c && c.label && safeHref(c.href)).slice(0, 5);
    const box = h.search && h.search.action ? `<form class="sc-room-box" role="search" method="get" action="${esc(safeHref(h.search.action) || '#')}">`
        + `<label class="sc-sr" for="sc-room-q">${esc(h.search.label || h.search.placeholder || 'Search')}</label>`
        + `<input id="sc-room-q" type="search" name="${esc(h.search.name || 'q')}" placeholder="${esc(h.search.placeholder || '')}" autocomplete="off" enterkeyhint="search"${has(h.search.hints) ? ` data-ov-typed="${esc(h.search.hints.slice(0, 6).join('|'))}"` : ''}>`
        + `<button type="submit" aria-label="${esc(h.search.button || 'Go')}">${kitLib.icon('forward')}</button></form>` : '';
    const start = !box && h.start && safeHref(h.start.href) ? `<div class="sc-actions"><a class="sc-btn sc-primary sc-room-start" href="${esc(safeHref(h.start.href))}">${esc(h.start.label || 'Start')}</a></div>` : '';
    const nums = (proof || []).filter((p) => p && p.label && p.value != null && p.value !== '' && p.value !== 0);
    const proofHTML = nums.length ? `<ul class="sc-room-proof" aria-label="${esc(r ? `${r.name} right now` : 'Right now')}">${nums.map((p) => `<li>`
        + `<b${typeof p.value === 'number' ? ` data-ov-ticker="${p.value}"` : ''}>${esc(fmtNum(p.value))}</b> <span>${esc(p.label)}</span>`
        + `${p.live ? '<em class="sc-room-live">live</em>' : p.asOf ? `<em>${esc(p.asOf)}</em>` : ''}</li>`).join('')}</ul>` : '';
    const heroHTML = h.title ? `<section class="sc-room-hero" aria-labelledby="sc-room-h">`
        + `<div class="sc-room-main">${h.pageHead ? kitLib.pageHead({ ...h.pageHead, title: h.title, lede: h.lede }).replace('<h1>', '<h1 id="sc-room-h">') : `<h1 id="sc-room-h">${esc(h.title)}</h1>${h.lede ? `<p class="sc-room-lede">${esc(h.lede)}</p>` : ''}`}${box}${start}`
        + `${chips.length ? `<nav class="sc-room-chips" data-ovk-scroll aria-label="Try">${chips.map((c) => `<a href="${esc(safeHref(c.href))}">${esc(c.label)}</a>`).join('')}</nav>` : ''}${proofHTML}</div>`
        + `<div class="sc-room-pic">${h.motif != null ? h.motif : roomMotif(r)}</div></section>` : '';
    const railsHTML = (rails || []).map((x) => kitLib.rail(x)).join('');
    const sceneList = (scenes || []).filter((x) => x && x.title && x.html != null);
    const scenesHTML = sceneList.length ? `<section class="sc-room-scenes" aria-label="What you can do">${sceneList.map((x, i) => `<article class="sc-scene${i % 2 ? ' is-flip' : ''}" data-ov-reveal>`
        + `<div class="sc-scene-text"><h2>${esc(x.title)}</h2>${x.text ? `<p>${esc(x.text)}</p>` : ''}${x.action && safeHref(x.action.href) ? `<a class="sc-scene-go" href="${esc(safeHref(x.action.href))}">${esc(x.action.label || 'Try it')}${kitLib.icon('chevron')}</a>` : ''}</div>`
        + `<div class="sc-scene-stage">${x.html}</div></article>`).join('')}</section>` : '';
    const devLinks = dev && has(dev.links) ? `<p class="sc-room-devlinks">${dev.links.filter((l) => safeHref(l.href)).map((l) => `<a href="${esc(safeHref(l.href))}">${esc(l.label)}</a>`).join(' · ')}</p>` : '';
    const devHTML = dev ? code(dev).replace(/<\/section>$/, `${devLinks}</section>`) : '';
    return `<div class="ov-room sc-room"${r ? ` data-room="${esc(r.id)}" style="${roomsLib.style(r.id)}"` : ''}>${heroHTML}${railsHTML}${scenesHTML}${html != null ? html : ''}`
        + `${explore ? features(explore) : ''}${devHTML}${q ? faq(q) : ''}${net ? network(net) : ''}</div>`;
}

// More on OpenVibe's live strip: up to four things happening across the network, filled in the browser from Network's
// Frame (the same data the menu shows: who is live, the sites' trending cards). Text only; https links only; nothing
// shows when Network does not answer. A page that renders network() includes this once: `<script>${sc.NETWORK_JS}</script>`.
const NETWORK_JS = "(function(){try{var box=document.querySelector('[data-ov-now]');if(!box||!window.fetch)return;var here=location.hostname;"
    + "function ok(u){try{var x=new URL(u);return x.protocol==='https:'&&x.hostname!==here?x.href:null}catch(e){return null}}"
    + "function row(tag,name,title,href,live){var a=document.createElement('a');a.href=href;var s=document.createElement('span');s.textContent=tag;if(live)s.className='live';a.appendChild(s);var t=document.createElement('em');t.style.fontStyle='normal';t.textContent=title;a.appendChild(t);box.appendChild(a)}"
    + "Promise.all([fetch('https://openvibe.network/api/frame/pulse',{credentials:'omit'}).then(function(r){return r.ok?r.json():null}).catch(function(){return null}),fetch('https://openvibe.network/api/frame?v=2',{credentials:'omit',headers:{accept:'application/json'}}).then(function(r){return r.ok?r.json():null}).catch(function(){return null})]).then(function(v){var n=0,p=v[0],f=v[1];"
    + "var h=document.createElement('b');h.textContent='Happening on OpenVibe';box.appendChild(h);"
    + "if(p&&Number(p.live_now)>0){var names=(p.live||[]).slice(0,3).map(function(c){return c.name}).filter(Boolean).join(', ');row('Live',null,(p.live_now==1?'1 stream live now':p.live_now+' streams live now')+(names?': '+names:''),'https://openvibe.live/',true);n++}"
    + "(f&&f.cards||[]).forEach(function(c){if(n>=4||!c||!c.items||!c.items.length)return;var it=c.items[0],u=ok(it.url);if(!u||!it.title)return;row(String(c.title||c.site||'').slice(0,24),null,String(it.title).slice(0,90),u,false);n++});"
    + "if(n)box.hidden=false})}catch(e){}})();";

const CSS = `
${PARTS_CSS}
/* The hero's visual (4.26.0): the aura (rings, dots, the mark) or an orbit of the site's places. */
.sc-vis{position:relative;width:min(100%,380px);aspect-ratio:1;margin:0 auto;container-type:inline-size}
.sc-aura-glow{position:absolute;inset:28%;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--accent,#3b82f6) 42%,transparent),transparent);filter:blur(8px);animation:sc-breathe 6s ease-in-out infinite}
.sc-ring{position:absolute;border-radius:50%;border:1px dashed color-mix(in srgb,var(--accent-light,#60a5fa) 34%,transparent);}
.sc-ring.r1{inset:24%}.sc-ring.r2{inset:12%;animation-duration:105s;animation-direction:reverse;opacity:.8}.sc-ring.r3{inset:1%;animation-duration:150s;opacity:.55}
.sc-ring i{position:absolute;top:-5px;left:calc(50% - 5px);width:10px;height:10px;border-radius:50%;background:var(--accent,#3b82f6);box-shadow:0 0 14px var(--accent,#3b82f6)}
.sc-ring i+i{top:auto;bottom:-4px;left:calc(30% - 4px);width:8px;height:8px;background:var(--accent-light,#60a5fa)}
.sc-vis-mark{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2}
.sc-orb-ring{position:absolute;inset:0;border-radius:50%}
.sc-orb-ring::before{content:"";position:absolute;border-radius:50%;border:1px dashed color-mix(in srgb,var(--accent-light,#60a5fa) 30%,transparent)}
.sc-orb-ring.o1{--R:30cqw;z-index:2}.sc-orb-ring.o1::before{inset:20%}
.sc-orb-ring.o2{--R:44cqw;animation-duration:140s;animation-direction:reverse}.sc-orb-ring.o2::before{inset:6%;opacity:.55}
.sc-orb-node{position:absolute;left:50%;top:50%;width:40px;height:40px;margin:-20px;transform:rotate(calc(360deg / var(--n) * var(--i))) translateY(calc(-1 * var(--R))) rotate(calc(-360deg / var(--n) * var(--i)));color:var(--text-primary,#e6edf7);text-decoration:none}
.sc-orb-node.is-big{width:54px;height:54px;margin:-27px}
.sc-orb-face{display:flex;flex-direction:column;align-items:center;gap:4px;width:100%;height:100%}
.o2 .sc-orb-face{animation-duration:140s;animation-direction:normal}
.sc-orb-face>.ov-icon,.sc-orb-face>svg,.sc-orb-face>i{display:grid;place-items:center;flex:none;width:100%;height:100%;border-radius:50%;background:color-mix(in srgb,var(--bg-secondary,#101828) 88%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--accent-light,#60a5fa) 30%,transparent),0 8px 22px rgba(0,0,0,.35);transition:transform .3s cubic-bezier(.2,1.4,.3,1)}
.sc-orb-name{font-size:11.5px;font-weight:700;color:var(--text-secondary,#96a7c2);white-space:nowrap;padding:1px 7px;border-radius:999px;background:color-mix(in srgb,var(--bg-primary,#0a0f1c) 78%,transparent)}
a.sc-orb-node:hover .sc-orb-face>*:first-child,a.sc-orb-node:focus-visible .sc-orb-face>*:first-child{transform:scale(1.15)}
.sc-orb-core{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--text-primary,#e6edf7);text-decoration:none;text-align:center}
.sc-orb-core .sc-vis-mark{position:static;transform:none}
.sc-orb-core b{margin-top:6px;font-size:14px;font-weight:800}.sc-orb-core small{font-size:12px;color:var(--text-muted,#7386a3)}

@keyframes sc-breathe{0%,100%{opacity:.7;transform:scale(.95)}50%{opacity:1;transform:scale(1.05)}}
@media (max-width:860px){
.sc-hero.sc-has-vis{display:block}
.sc-hero.sc-has-vis .sc-hero-vis{position:absolute;z-index:-1;top:-26px;right:0;width:180px;opacity:.36;pointer-events:none}
.sc-hero.sc-has-vis .sc-aura .sc-vis-mark{display:none!important}
.sc-hero.sc-has-orbit{display:flex;flex-direction:column}
.sc-hero.sc-has-orbit .sc-hero-vis{order:1;position:static;width:auto;opacity:1;pointer-events:auto;margin:22px 0 0}
.sc-hero.sc-has-orbit .sc-vis{width:min(82vw,300px)}
.sc-hero.sc-has-orbit .sc-orb-core small{max-width:8em;font-size:10px;line-height:1.2}
.sc-hero.sc-has-orbit .sc-orb-core .sc-vis-mark{width:50px!important;height:50px!important}
.sc-orb-node{width:32px;height:32px;margin:-16px}.sc-orb-node.is-big{width:44px;height:44px;margin:-22px}.sc-orb-name{font-size:10.5px}
}

.sc-hero,.sc-sec,.sc-cta{max-width:1080px;margin:0 auto;padding:0 24px;font-family:var(--ov-font,'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif)}
.sc-hero{padding-top:56px;padding-bottom:8px}
.sc-hero.sc-split{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:32px;align-items:center}
.sc-eyebrow{display:inline-block;margin:0 0 14px;padding:4px 12px;border-radius:999px;border:1px solid var(--border-light,var(--border,#2c3d5c));background:var(--bg-secondary,#101828);color:var(--accent-light,var(--accent,#60a5fa));font-size:12px;font-weight:700;letter-spacing:.4px}
.sc-hero h1{font-size:clamp(32px,4.6vw,52px);line-height:1.08;letter-spacing:-1.2px;margin:0;font-weight:800}
.sc-accent{background:linear-gradient(120deg,var(--accent-light,#60a5fa),var(--accent,#3b82f6),var(--secondary,#22d3ee));-webkit-background-clip:text;background-clip:text;color:transparent}
.sc-hero-lede{margin:16px 0 0;max-width:640px;font-size:17px;line-height:1.6;color:var(--text-secondary,#96a7c2)}
.sc-hero-aside{min-width:0}
.sc-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
.sc-btn{display:inline-flex;align-items:center;gap:8px;padding:11px 20px;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none;color:var(--text-primary,#e6edf7);border:1px solid var(--border-light,var(--border,#2c3d5c));background:transparent;transition:border-color .15s,background .15s,transform .15s}
.sc-btn:hover,.sc-btn:focus-visible{border-color:var(--accent,#3b82f6);background:var(--bg-hover,#1c2a44);outline:0}
.sc-btn.sc-primary{border-color:transparent;color:var(--on-accent,#fff);background:linear-gradient(135deg,var(--accent,#3b82f6),var(--accent-dark,#1d4ed8))}
.sc-btn.sc-primary:hover{transform:translateY(-1px);filter:brightness(1.06)}
.sc-note{margin:14px 0 0;font-size:13.5px;color:var(--text-muted,#7386a3)}
.sc-note a{color:var(--accent-light,#60a5fa)}
.sc-sec{margin-top:48px;padding-top:32px;border-top:1px solid color-mix(in srgb,var(--border,#263244) 70%,transparent);container-type:inline-size}
.sc-hero+.sc-sec,.sc-sec:first-child{border-top:0;padding-top:0}
.sc-sec>h2,.sc-cta>h2{display:flex;align-items:center;gap:12px;font-size:clamp(22px,2.6vw,30px);letter-spacing:-.02em;margin:0 0 6px}
.sc-h-ic{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:11px;background:color-mix(in srgb,var(--accent,#3b82f6) 14%,transparent);color:var(--accent-light,#60a5fa)}
.sc-h-ic svg{display:block}
.sc-sec>h2:has(.sc-h-ic)+.sc-lede{margin-left:48px}
@media (max-width:520px){.sc-sec>h2+.sc-lede{margin-left:0}}
.sc-lede{color:var(--text-secondary,#96a7c2);margin:0 0 18px;max-width:760px;line-height:1.55}
.sc-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
@container (min-width:520px) and (max-width:1035px){.sc-grid:has(>:nth-child(4):last-child){grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (min-width:900px){.sc-grid:has(>:nth-child(5):last-child),.sc-grid:has(>:nth-child(6):last-child),.sc-grid:has(>:nth-child(9):last-child){grid-template-columns:repeat(3,minmax(0,1fr))}}
.sc-card{display:flex;gap:14px;align-items:flex-start;padding:16px;border-radius:16px;border:1px solid var(--border,rgba(255,255,255,.08));background:var(--bg-secondary,#101828);color:inherit;text-decoration:none;transition:border-color .15s,transform .15s}
a.sc-card:hover,a.sc-card:focus-visible{border-color:var(--accent,#3b82f6);transform:translateY(-2px);outline:0}
/* 4.248.0 (the owner, 11-14: "redesign all these icons … use the full space … modern and minimalist … stands out
   unique"): a filled tile on its own hue (six, in turn down a grid), the glyph large in it; a ring icon loses its ring. */
.sc-card,.sc-grid>*{--sc-h:var(--accent,#3b82f6)}
.sc-grid>:nth-child(6n+2){--sc-h:#10b981}.sc-grid>:nth-child(6n+3){--sc-h:#f59e0b}.sc-grid>:nth-child(6n+4){--sc-h:#8b5cf6}.sc-grid>:nth-child(6n+5){--sc-h:#ec4899}.sc-grid>:nth-child(6n){--sc-h:#06b6d4}
.sc-ic{width:46px;height:46px;flex:none;display:grid;place-items:center;border-radius:14px;font-size:20px;overflow:hidden;color:color-mix(in srgb,var(--sc-h,var(--accent,#3b82f6)) 28%,#fff);background:linear-gradient(150deg,color-mix(in srgb,var(--sc-h,var(--accent,#3b82f6)) 42%,transparent),color-mix(in srgb,var(--sc-h,var(--accent,#3b82f6)) 16%,transparent));box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 8px 20px -10px color-mix(in srgb,var(--sc-h,var(--accent,#3b82f6)) 70%,transparent)}
html[data-theme-mode=light] .sc-ic{color:color-mix(in srgb,var(--sc-h,var(--accent,#3b82f6)) 78%,#0b1220);background:linear-gradient(150deg,color-mix(in srgb,var(--sc-h,var(--accent,#3b82f6)) 24%,#fff),color-mix(in srgb,var(--sc-h,var(--accent,#3b82f6)) 10%,#fff))}
.sc-ic.sc-ic-ov{border-radius:14px}
.sc-ic .ovi-bg,.sc-ic .ovi-ring,.sc-ic .ovi-comet,.sc-ic .ovi-prog{display:none}
.sc-ic .sc-ovi{--ovi-size:46px!important;display:grid;place-items:center;width:46px;height:46px;color:inherit}.sc-ic .sc-ovi svg{width:46px;height:46px;transform:scale(1.32)}.sc-ic .ovi-glyph{stroke:currentColor;stroke-width:2.3}
.sc-ic .sc-ovi--glyph{--ovi-size:26px!important;width:26px;height:26px}.sc-ic>i{font-size:21px}
a.sc-card:hover .sc-ic,a.sc-card:focus-visible .sc-ic{scale:1.06}.sc-ic{transition:scale .2s cubic-bezier(.2,.9,.3,1.2)}
/* A phone: the tile beside the title, the words under both, the card's whole width (no empty column under the icon). */
@media (max-width:600px){.sc-grid .sc-card{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:12px;align-items:center}.sc-grid .sc-card>span:last-child{display:contents}.sc-grid .sc-card b{grid-column:2}.sc-grid .sc-card small{grid-column:1/-1;margin-top:8px}}
.sc-ovi--glyph{border-radius:50%;color:var(--accent,#3b82f6);background:color-mix(in srgb,var(--accent,#3b82f6) 13%,transparent);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--accent,#3b82f6) 42%,transparent)}.sc-ovi--glyph svg{width:54%!important;height:54%!important}
.sc-card b{display:block;font-size:15.5px}.sc-card small{display:block;margin-top:3px;color:var(--text-secondary,#96a7c2);font-size:13.5px;line-height:1.45}
.sc-steps{list-style:none;margin:0;padding:0;counter-reset:sc;display:grid;gap:14px 24px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
@container (min-width:584px) and (max-width:1191px){.sc-steps:has(>:nth-child(4):last-child){grid-template-columns:repeat(2,minmax(0,1fr))}}
.sc-steps li{counter-increment:sc;display:grid;grid-template-columns:34px 1fr;column-gap:12px;align-items:baseline;align-content:start}
.sc-steps li::before{content:counter(sc);grid-row:span 2;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:13px;color:var(--accent-light,#60a5fa);border:1px solid var(--border-light,#2c3d5c);background:var(--bg-secondary,#101828)}
.sc-steps b{font-size:15.5px}.sc-steps b a{color:inherit;text-decoration:underline;text-decoration-color:var(--accent,#3b82f6);text-underline-offset:3px}
.sc-steps span{color:var(--text-secondary,#96a7c2);font-size:14px;line-height:1.5}
.sc-code{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}
.sc-code figure{margin:0;border-radius:14px;border:1px solid var(--border,rgba(255,255,255,.08));background:var(--bg-primary,#0a0f1c);overflow:hidden;min-width:0}
.sc-code figcaption{padding:8px 14px;font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--text-muted,#7386a3);border-bottom:1px solid var(--border,rgba(255,255,255,.08))}
.sc-code pre{margin:0;padding:14px;overflow:auto;font-size:13px;line-height:1.55}
.sc-demo{border-radius:16px;border:1px solid var(--border,rgba(255,255,255,.08));overflow:hidden;background:var(--bg-secondary,#101828)}
.sc-demo iframe{display:block;width:100%;border:0;background:var(--bg-primary,#0a0f1c)}
.sc-table-wrap{overflow-x:auto;border-radius:14px;border:1px solid var(--border,rgba(255,255,255,.08))}
.sc-table{width:100%;border-collapse:collapse;font-size:14px}
.sc-table th,.sc-table td{padding:11px 14px;text-align:left;border-bottom:1px solid var(--border,rgba(255,255,255,.08))}
.sc-table thead th{font-size:12px;letter-spacing:.5px;text-transform:uppercase;color:var(--text-muted,#7386a3);background:var(--bg-secondary,#101828)}
.sc-table tbody th{font-weight:600;width:44%}.sc-table tr:last-child>*{border-bottom:0}
.sc-table .sc-us{background:color-mix(in srgb,var(--accent,#3b82f6) 7%,transparent)}
.sc-yes{color:var(--success-text,var(--success,#22c55e));font-weight:800}.sc-no{color:var(--text-muted,#7386a3)}
.sc-tiers{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.sc-tier{display:flex;flex-direction:column;padding:18px;border-radius:16px;border:1px solid var(--border,rgba(255,255,255,.08));background:var(--bg-secondary,#101828)}
.sc-tier.sc-hl{border-color:var(--accent,#3b82f6);box-shadow:0 0 0 1px var(--accent,#3b82f6) inset}
.sc-tier-name{font-size:13px;letter-spacing:.6px;text-transform:uppercase;color:var(--text-muted,#7386a3)}
.sc-price{margin:6px 0 10px;font-size:28px;font-weight:800}.sc-price small{font-size:14px;font-weight:600;color:var(--text-secondary,#96a7c2)}
.sc-tier ul{margin:0;padding-left:18px;color:var(--text-secondary,#96a7c2);font-size:14px;line-height:1.6}
.sc-tier-act{margin-top:auto;padding-top:14px}
.sc-stories{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.sc-story{margin:0;padding:18px;border-radius:16px;border:1px solid var(--border,rgba(255,255,255,.08));background:var(--bg-secondary,#101828)}
.sc-story blockquote{margin:0;font-size:15px;line-height:1.55}.sc-story figcaption{margin-top:10px;font-weight:700;font-size:13.5px}
.sc-story figcaption span{display:block;font-weight:500;color:var(--text-secondary,#96a7c2)}
.sc-next-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.sc-next-item{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px}
.sc-next-main{flex:1 1 320px;display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;border:1px solid var(--border,rgba(255,255,255,.08));background:var(--bg-secondary,#101828);color:inherit;text-decoration:none;transition:border-color .15s,transform .15s}
.sc-next-main:hover,.sc-next-main:focus-visible{border-color:var(--accent,#3b82f6);transform:translateX(2px);outline:0}
.sc-next-body{flex:1;min-width:0}.sc-next-body b{display:block;font-size:15.5px}
.sc-next-body small{display:block;margin-top:2px;color:var(--text-secondary,#96a7c2);font-size:13.5px;line-height:1.45}
.sc-next-on{display:block;margin-top:4px;font-size:12px;font-weight:700;letter-spacing:.3px;color:var(--accent-light,var(--accent,#60a5fa))}
.sc-next-go{font-size:20px;color:var(--text-muted,#7386a3);transition:transform .15s}.sc-next-main:hover .sc-next-go{transform:translateX(3px);color:var(--accent-light,#60a5fa)}
.sc-next-embed{font-size:13px;font-weight:600;color:var(--accent-light,#60a5fa)}
.sc-cta{margin-top:64px;margin-bottom:24px;text-align:center}
.sc-cta>div,.sc-cta .sc-actions{justify-content:center}.sc-cta p{color:var(--text-secondary,#96a7c2);margin:6px auto 0;max-width:620px}
.sc-head-row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}.sc-head-row>div{min-width:0}.sc-head-row h2{margin:0 0 6px;font-size:clamp(22px,2.6vw,30px);letter-spacing:-.02em}
.sc-more{font-weight:700;font-size:14px;color:var(--accent-light,var(--accent,#60a5fa));text-decoration:none;white-space:nowrap;margin-bottom:18px}.sc-more:hover{text-decoration:underline}
.sc-stats{display:grid;gap:10px;margin:0;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.sc-stat{display:flex;flex-direction:column-reverse;gap:2px;padding:16px 18px;border-radius:16px;border:1px solid var(--border,rgba(255,255,255,.08));background:var(--bg-secondary,#101828);color:inherit;text-decoration:none}
.sc-stat dd{margin:0;font-size:clamp(24px,3vw,32px);font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.sc-stat dt{font-size:13.5px;color:var(--text-secondary,#96a7c2)}
a.sc-stat:hover{border-color:var(--accent,#3b82f6)}
.sc-cards{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.sc-cards.sc-wrap{grid-template-columns:repeat(auto-fill,minmax(230px,1fr))}
.sc-cards.sc-rail{grid-auto-flow:column;grid-auto-columns:minmax(240px,300px);overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px;scrollbar-width:thin}
.sc-cards.sc-rail>li{scroll-snap-align:start}
.sc-tile{display:flex;flex-direction:column;height:100%;border-radius:16px;overflow:hidden;border:1px solid var(--border,rgba(255,255,255,.08));background:var(--bg-secondary,#101828);color:inherit;text-decoration:none;transition:border-color .15s,transform .2s,box-shadow .2s}
.sc-tile:hover,.sc-tile:focus-visible{border-color:var(--accent,#3b82f6);transform:translateY(-3px);box-shadow:0 12px 30px rgba(0,0,0,.28);outline:0}
.sc-thumb{position:relative;display:block;aspect-ratio:var(--sc-ar,16/9);background:linear-gradient(135deg,color-mix(in srgb,var(--accent,#3b82f6) 22%,var(--bg-tertiary,#172238)),var(--bg-tertiary,#172238))}
.sc-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .35s ease}.sc-tile:hover .sc-thumb img{transform:scale(1.04)}
.sc-badge{position:absolute;left:10px;top:10px;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:800;letter-spacing:.4px;color:#fff;background:rgba(0,0,0,.66)}
.sc-badge.sc-live{background:color-mix(in srgb,var(--live-red,#ef4444) 80%,#000)}.sc-badge.sc-live::before{content:'';display:inline-block;width:6px;height:6px;margin-right:5px;border-radius:50%;background:#fff;vertical-align:1px;animation:scPulse 1.4s ease-in-out infinite}
.sc-tile-body{display:block;padding:12px 14px 14px}.sc-tile-body b{display:block;font-size:15px;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.sc-tile-body small{display:block;margin-top:4px;font-size:12.5px;color:var(--text-muted,#7386a3)}.sc-tile-text{display:block;margin-top:6px;font-size:13.5px;line-height:1.45;color:var(--text-secondary,#96a7c2)}
.sc-spots{display:grid;gap:28px}
.sc-spot{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:28px;align-items:center}
.sc-spot:nth-child(even) .sc-spot-media{order:2}
.sc-spot-media{border-radius:18px;overflow:hidden;border:1px solid var(--border,rgba(255,255,255,.08));background:var(--bg-secondary,#101828);box-shadow:0 18px 50px color-mix(in srgb,var(--accent,#3b82f6) 16%,transparent)}
.sc-spot-media img,.sc-spot-media video{display:block;width:100%;height:auto}
.sc-spot h3{margin:0 0 8px;font-size:clamp(20px,2.2vw,26px);letter-spacing:-.01em}.sc-spot h3 a{color:inherit;text-decoration:none}.sc-spot h3 a:hover{color:var(--accent-light,#60a5fa)}
.sc-spot p{margin:0;color:var(--text-secondary,#96a7c2);line-height:1.6;font-size:15.5px}.sc-spot-act{margin-top:16px}
/* 4.248.0 (the owner, 11-14: "so much padding for no reason … more compact … no space between your streams and the
   question section"): a compact row whatever a site's own details rule says, its glyph, the next block spaced. */
.sc-faq{display:grid;gap:6px;max-width:820px}
.sc-faq details,.sc-sec>details:not([class]){margin:0;padding:0!important;border-radius:12px;border:1px solid var(--border,rgba(255,255,255,.08));background:var(--bg-secondary,#101828);transition:border-color .15s,background-color .15s}
.sc-faq details[open]{border-color:color-mix(in srgb,var(--accent,#3b82f6) 34%,var(--border,rgba(255,255,255,.08)))}
.sc-faq summary,.sc-sec>details:not([class])>summary{cursor:pointer;list-style:none;padding:12px 44px 12px 16px;font-weight:700;position:relative}
.sc-faq summary{display:flex;align-items:center;gap:10px;min-height:48px;box-sizing:border-box;padding:8px 40px 8px 10px;font-weight:650;line-height:1.35}
.sc-faq summary:hover{background:color-mix(in srgb,var(--text-primary,#e8ecf3) 4%,transparent);border-radius:12px}
.sc-q-ic{flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:9px;color:var(--accent-light,#60a5fa);background:color-mix(in srgb,var(--accent,#3b82f6) 14%,transparent)}
.sc-q-ic svg{width:16px;height:16px}
.sc-sec:has(>.sc-faq)+:not(.sc-sec),.sc-sec+:not(.sc-sec):not(script):not(style):not(link){margin-top:clamp(28px,5vw,44px)}
.sc-faq summary::-webkit-details-marker,.sc-sec>details:not([class])>summary::-webkit-details-marker{display:none}
.sc-faq summary::after,.sc-sec>details:not([class])>summary::after{content:'';position:absolute;right:18px;top:50%;width:8px;height:8px;margin-top:-6px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);transition:transform .2s;opacity:.7}
.sc-faq details[open] summary::after,.sc-sec>details[open]:not([class])>summary::after{transform:rotate(-135deg);margin-top:-2px}
.sc-sec>details:not([class])+details:not([class]){margin-top:8px}
.sc-faq p,.sc-sec>details:not([class])>p{margin:0;padding:0 16px 16px;color:var(--text-secondary,#96a7c2);line-height:1.6}
.sc-faq p{padding:0 14px 12px 50px;font-size:14.5px}
@media (max-width:600px){.sc-faq p{padding-left:14px}}
.sc-fold{border-radius:16px;border:1px solid var(--border,rgba(255,255,255,.08));background:var(--bg-secondary,#101828)}
.sc-fold>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:56px;padding:0 48px 0 18px;cursor:pointer;list-style:none;position:relative}
.sc-fold>summary::-webkit-details-marker{display:none}
.sc-fold>summary::after{content:'';position:absolute;right:22px;top:50%;width:8px;height:8px;margin-top:-6px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);transition:transform .2s;opacity:.7}
.sc-fold[open]>summary::after{transform:rotate(-135deg);margin-top:-2px}
.sc-fold>summary:focus-visible{outline:2px solid var(--accent,#3b82f6);outline-offset:-2px;border-radius:16px}
.sc-fold>summary h2{margin:0;font-size:clamp(18px,2.2vw,22px)}
.sc-fold-hint{color:var(--text-muted,#7386a3);font-size:14px;font-weight:600;text-align:right}
.sc-fold-body{padding:0 18px 18px}
.sc-fold-body .sc-sec{max-width:none;margin:0;padding:0}
.sc-fold-body .sc-sec+.sc-sec{margin-top:22px}
/* A list that is one sideways row on a phone (scroll snap, the next card peeking) and whatever the page made it on wide
   screens. Every item stays in the HTML. --sc-row-w sets a card's width (82% by default; 46% for small tiles). */
@media (max-width:599px){
.sc-row.sc-row{position:relative;display:flex;flex-wrap:nowrap;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-inline:16px;scrollbar-width:none;gap:10px;margin-left:-16px;margin-right:-16px;padding:0 16px 4px;grid-template-columns:none}
.sc-row.sc-row::-webkit-scrollbar{display:none}
.sc-row.sc-row>*{flex:0 0 var(--sc-row-w,82%);min-width:0;scroll-snap-align:start}
.sc-fold-hint{display:none}
}
/* apps(): a launcher. Phones: icon tiles, name under the icon; from 600 px: rows with a one-line tagline. */
.sc-apps-group{margin:18px 0 8px;font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-secondary,#96a7c2)}
.sc-apps-sec .sc-apps-group:first-of-type{margin-top:6px}
.sc-apps{list-style:none;margin:0;padding:0;display:grid;gap:6px;grid-template-columns:repeat(auto-fill,minmax(88px,1fr))}
.sc-apps a{display:flex;flex-direction:column;align-items:center;gap:6px;min-height:44px;padding:10px 4px;border-radius:14px;color:inherit;text-decoration:none;text-align:center;transition:background .15s}
.sc-apps a:hover,.sc-apps a:focus-visible{background:color-mix(in srgb,var(--accent,#3b82f6) 10%,transparent);outline:0}
.sc-apps a:focus-visible{box-shadow:0 0 0 2px var(--accent,#3b82f6)}
.sc-app-t{min-width:0;max-width:100%}
.sc-apps b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:700}
.sc-apps small{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sc-apps-more{margin:14px 0 0;font-weight:700}
.sc-apps-more a{display:inline-flex;align-items:center;min-height:44px;color:var(--accent-light,#60a5fa);text-decoration:none}
.sc-apps-more a:hover{text-decoration:underline}
@media (max-width:599px){.sc-apps--c2{grid-template-columns:repeat(2,minmax(0,1fr))}.sc-apps--c3{grid-template-columns:repeat(3,minmax(0,1fr))}.sc-apps--c4{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (min-width:600px){
.sc-apps{gap:8px;grid-template-columns:repeat(auto-fill,minmax(230px,1fr))}
.sc-apps a{flex-direction:row;align-items:center;gap:12px;padding:10px 12px;text-align:left;border:1px solid var(--border,rgba(255,255,255,.08));background:var(--bg-secondary,#101828)}
.sc-apps .ov-appicon{--ova-size:44px!important}
.sc-apps a:hover,.sc-apps a:focus-visible{border-color:var(--accent,#3b82f6);background:var(--bg-secondary,#101828)}
.sc-apps b{font-size:15px}
.sc-apps small{position:static;width:auto;height:auto;clip:auto;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary,#96a7c2);font-size:13px}
.sc-apps--c2,.sc-apps--c4{grid-template-columns:repeat(2,minmax(0,1fr))}
.sc-apps--c3{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media (min-width:960px){.sc-apps--c4{grid-template-columns:repeat(4,minmax(0,1fr))}}
.sc-net-now{display:grid;gap:8px;margin:14px 0 0;padding:12px;border-radius:14px;background:color-mix(in srgb,var(--accent,#3b82f6) 6%,var(--bg-secondary,#101828));border:1px solid color-mix(in srgb,var(--accent,#3b82f6) 22%,var(--border,#263244))}
.sc-net-now[hidden]{display:none}
.sc-net-now b{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted,#8a96a8)}
.sc-net-now a{display:flex;gap:10px;align-items:baseline;min-height:36px;color:inherit;text-decoration:none;font-size:14px;line-height:1.4}
.sc-net-now a span{flex:none;min-width:64px;font-weight:700;color:var(--accent-light,#60a5fa)}
.sc-net-now a .live{color:var(--live,#ef4444)}
.sc-net-all{margin:12px 0 0;font-weight:700}.sc-net-all a{color:var(--accent-light,#60a5fa);text-decoration:none}
.sc-net{list-style:none;margin:0;padding:0;display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.sc-net a{display:flex;gap:12px;align-items:center;padding:14px;border-radius:14px;border:1px solid var(--border,rgba(255,255,255,.08));background:var(--bg-secondary,#101828);color:inherit;text-decoration:none;transition:border-color .15s,transform .15s}
.sc-net a:hover,.sc-net a:focus-visible{border-color:var(--accent,#3b82f6);transform:translateY(-2px);outline:0}
.sc-net b{display:block;font-size:15px}.sc-net small{display:block;color:var(--text-secondary,#96a7c2);font-size:13px;line-height:1.4}
.sc-hero{position:relative;isolation:isolate}
/* The hero's aura is drawn past its right edge (right:-54px below), so a narrow page that uses it was wider than
   the screen and a phone scrolled sideways. Clip the viewport's horizontal axis in the kit itself: nothing that
   fits is cut, and the page's own horizontal scrollers (tables, rails) keep working (2026-10-29). */
html{overflow-x:clip}
.sc-hero::before{content:'';position:absolute;z-index:-1;inset:-40px 0 auto;height:340px;pointer-events:none;background:radial-gradient(ellipse at 30% 20%,color-mix(in srgb,var(--accent,#3b82f6) 22%,transparent),transparent 62%),radial-gradient(ellipse at 80% 0%,color-mix(in srgb,var(--secondary,#22d3ee) 14%,transparent),transparent 58%);filter:blur(10px);opacity:.9}
@keyframes scPulse{50%{opacity:.35}}
@supports (animation-timeline:view()){.sc-sec{animation:scRise linear both;animation-timeline:view();animation-range:entry 0% cover 18%}html[data-ov-motion=off] .sc-sec{animation:none}}
@keyframes scRise{from{transform:translateY(calc(18px * var(--ov-move,1)))}to{transform:none}}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (max-width:860px){.sc-hero.sc-split{grid-template-columns:1fr}.sc-hero{padding-top:36px}.sc-spot{grid-template-columns:1fr;gap:14px}.sc-spot:nth-child(even) .sc-spot-media{order:0}}
@media (max-width:520px){.sc-actions .sc-btn{flex:1 1 100%;justify-content:center}.sc-code{grid-template-columns:1fr}}
.sc-stat dd{display:flex;align-items:center;gap:8px}.sc-stat-ic{display:inline-flex;color:var(--accent-light,var(--accent,#60a5fa))}
@media (max-width:640px){
.sc-hero,.sc-sec,.sc-cta{padding-left:16px;padding-right:16px}
.sc-hero{padding-top:14px}.sc-hero::before{inset:-60px 0 auto;height:280px}
.sc-eyebrow{margin-bottom:10px;font-size:11.5px}
.sc-hero h1{font-size:clamp(27px,7.6vw,34px);line-height:1.1;letter-spacing:-.8px}
.sc-hero-lede{margin-top:10px;font-size:15.5px;line-height:1.5}
.sc-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:8px;margin-top:16px}
.sc-actions .sc-btn{justify-content:center;min-height:46px;padding:10px 12px;font-size:14.5px;text-align:center}
.sc-note{margin-top:10px;font-size:12px;line-height:1.45}
.sc-stats-sec{margin-top:14px}
.sc-stats{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.sc-stat{padding:10px 10px 9px;border-radius:13px;gap:1px;justify-content:flex-end}
.sc-stat dd{font-size:19px;gap:5px;letter-spacing:-.01em}.sc-stat-ic svg,.sc-stat-ic .ov-icon{width:15px;height:15px}
.sc-stat dt{font-size:11.5px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
}
`;

module.exports = { NETWORK_JS, icon, room, hero, features, steps, code, demo, fold, compare, pricing, limits, stories, stats, cards, spotlight, faq, network, apps, nextSteps, parts, pick, PARTS_CSS, cta, jsonLd, faqJsonLd, RELATED, DEFAULT_RELATED, CSS, STYLESHEET: 'showcase.css', esc };
