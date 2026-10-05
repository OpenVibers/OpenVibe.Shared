'use strict';
/**
 * openvibe-shared/showcase — the sections a product's home page is built from (plan T11, D92), rendered on the
 * server as plain HTML (complete without JavaScript, readable by crawlers) and styled from the network's theme
 * tokens, so every product's home reads as one family:
 *
 *   const sc = require('openvibe-shared/showcase');
 *   `<link rel="stylesheet" href="${serve.url('showcase.css')}">` (cached; carries the ring icons' CSS too) or
 *   `<style>${sc.CSS}</style>`, then sc.hero({ eyebrow, title, accent, lede, actions, note, aside })
 *     + sc.features({ id, title, lede, items: [{ icon, title, text, href }] })
 *     + sc.steps({ title, lede, items: [{ title, text, href }] })
 *     + sc.code({ title, lede, samples: [{ label, lang, code }] })
 *     + sc.demo({ title, lede, iframe: { src, title, height } })            (or html: trusted markup)
 *     + sc.compare({ title, lede, columns: ['OpenVibe', 'Elsewhere'], rows: [{ label, values: [true, 'paid add-on'] }] })
 *     + sc.pricing({ title, lede, tiers: [{ name, price, per, items, action, highlight }], note })
 *     + sc.limits({ title, lede, columns, rows: [{ label, values }], source })   pricing that equals the API's limits
 *     + sc.stories({ title, items: [{ who, text, outcome }] })
 *     + sc.cta({ title, text, actions })
 *
 * Every string is escaped; the only markup that passes through is a field named `html` (trusted, the caller's own).
 * `icon` is a Font Awesome class ('fa-code') or an openvibe-shared/icons name ('ov:tools'). `actions` are
 * [{ label, href, primary?, icon? }]. Nothing here reads data: the page passes what it knows, and a section with no
 * items renders nothing (never an empty shell or a "coming soon").
 */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const has = (a) => Array.isArray(a) && a.length > 0;
let ovIcons = null;
function icon(name, size = 22) {
    if (!name) return '';
    const n = String(name);
    if (n.startsWith('ov:')) {
        ovIcons = ovIcons || require('./ov-icons');
        return `<span class="ov-icon sc-ovi" data-icon="${esc(n.slice(3))}" style="--ovi-size:${size}px" aria-hidden="true">${ovIcons.svg(n.slice(3))}</span>`;
    }
    return `<i class="fa-solid ${esc(n.replace(/[^a-z0-9 -]/gi, ''))}" aria-hidden="true"></i>`;
}
const id = (s) => (s ? ` id="${esc(String(s).replace(/[^a-z0-9_-]/gi, '-'))}"` : '');
const head = (title, lede, hid) => `${title ? `<h2${hid ? ` id="${hid}"` : ''}>${esc(title)}</h2>` : ''}${lede ? `<p class="sc-lede">${esc(lede)}</p>` : ''}`;
// Heading ids come from the title, so a page renders the same bytes every time (ETags, caches).
const slug = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'section';
const labelled = (title, h) => (title ? ` aria-labelledby="${h}"` : '');

function actions(list, cls = 'sc-actions') {
    if (!has(list)) return '';
    return `<div class="${cls}">${list.map((a) => `<a class="sc-btn${a.primary ? ' sc-primary' : ''}" href="${esc(a.href)}"${/^https?:/.test(a.href || '') && a.external ? ' rel="noopener"' : ''}>${a.icon ? icon(a.icon, 18) : ''}${esc(a.label)}</a>`).join('')}</div>`;
}

/** The top of the page: what the product is, in one line, and where to start. */
function hero({ eyebrow, title, accent, lede, actions: acts, note, aside, html } = {}) {
    return `<section class="sc-hero${aside || html ? ' sc-split' : ''}"><div class="sc-hero-main">${eyebrow ? `<p class="sc-eyebrow">${esc(eyebrow)}</p>` : ''}<h1>${esc(title)}${accent ? `<span class="sc-accent"> ${esc(accent)}</span>` : ''}</h1>${lede ? `<p class="sc-hero-lede">${esc(lede)}</p>` : ''}${actions(acts)}${note ? `<p class="sc-note">${esc(note)}</p>` : ''}</div>${aside ? `<div class="sc-hero-aside">${aside.html != null ? aside.html : esc(aside)}</div>` : html != null ? `<div class="sc-hero-aside">${html}</div>` : ''}</section>`;
}

/** A grid of what the product does; each card may link to where it starts. */
function features({ id: sid, title, lede, items } = {}) {
    if (!has(items)) return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h)}<div class="sc-grid">${items.map((f) => {
        // A ring icon (ov:…) is its own 40 px tile, so it fills the slot instead of sitting small inside a second tile.
        const ring = f.icon && String(f.icon).startsWith('ov:');
        const inner = `${f.icon ? `<span class="sc-ic${ring ? ' sc-ic-ov' : ''}">${icon(f.icon, ring ? 40 : 22)}</span>` : ''}<span><b>${esc(f.title)}</b>${f.text ? `<small>${esc(f.text)}</small>` : ''}</span>`;
        return f.href ? `<a class="sc-card" href="${esc(f.href)}">${inner}</a>` : `<div class="sc-card">${inner}</div>`;
    }).join('')}</div></section>`;
}

/** A numbered path from nothing to done. */
function steps({ id: sid, title, lede, items } = {}) {
    if (!has(items)) return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h)}<ol class="sc-steps">${items.map((s) => `<li><b>${s.href ? `<a href="${esc(s.href)}">${esc(s.title)}</a>` : esc(s.title)}</b>${s.text ? `<span>${esc(s.text)}</span>` : ''}</li>`).join('')}</ol></section>`;
}

/** Code the reader can copy: one or more samples, each labelled with its language. */
function code({ id: sid, title, lede, samples } = {}) {
    if (!has(samples)) return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h)}<div class="sc-code">${samples.map((c, i) => `<figure><figcaption>${esc(c.label || c.lang || `Sample ${i + 1}`)}</figcaption><pre><code${c.lang ? ` class="language-${esc(c.lang)}"` : ''}>${esc(String(c.code || '').replace(/^\n+|\s+$/g, ''))}</code></pre></figure>`).join('')}</div></section>`;
}

/** A live demo: the product itself in a frame, or the caller's own markup. */
function demo({ id: sid, title, lede, iframe, html } = {}) {
    if (!iframe && html == null) return '';
    const h = `sc-${slug(title)}`;
    const body = iframe
        ? `<iframe src="${esc(iframe.src)}" title="${esc(iframe.title || title || 'Live demo')}" loading="lazy" style="height:${Math.max(160, Math.min(900, Number(iframe.height) || 420))}px" referrerpolicy="strict-origin-when-cross-origin"${iframe.sandbox ? ` sandbox="${esc(iframe.sandbox)}"` : ''}></iframe>`
        : html;
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h)}<div class="sc-demo">${body}</div></section>`;
}

const cell = (v) => (v === true ? '<span class="sc-yes" aria-label="yes">✓</span>' : v === false || v == null ? '<span class="sc-no" aria-label="no">—</span>' : esc(v));

/** How the product compares, feature by feature. The first column is this product. */
function compare({ id: sid, title, lede, columns, rows } = {}) {
    if (!has(rows) || !has(columns)) return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h)}<div class="sc-table-wrap"><table class="sc-table"><thead><tr><th scope="col"><span class="sr-only">Feature</span></th>${columns.map((c, i) => `<th scope="col"${i === 0 ? ' class="sc-us"' : ''}>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th>${columns.map((_, i) => `<td${i === 0 ? ' class="sc-us"' : ''}>${cell((r.values || [])[i])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}

/** Plans side by side. A price of 0 reads "Free". */
function pricing({ id: sid, title, lede, tiers, note } = {}) {
    if (!has(tiers)) return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h)}<div class="sc-tiers">${tiers.map((t) => `<div class="sc-tier${t.highlight ? ' sc-hl' : ''}"><b class="sc-tier-name">${esc(t.name)}</b><p class="sc-price">${t.price === 0 || t.price === '0' ? 'Free' : esc(t.price)}${t.per && !(t.price === 0 || t.price === '0') ? `<small> / ${esc(t.per)}</small>` : ''}</p>${has(t.items) ? `<ul>${t.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${t.action ? actions([{ ...t.action, primary: t.highlight }], 'sc-actions sc-tier-act') : ''}</div>`).join('')}</div>${note ? `<p class="sc-note">${esc(note)}</p>` : ''}</section>`;
}

/**
 * The limits a caller really gets, as a table: pricing that equals the API's limits. `source` names where the numbers
 * come from (a /limits.json URL), so the page can never promise more than the service enforces.
 */
function limits({ id: sid, title, lede, columns, rows, source } = {}) {
    if (!has(rows) || !has(columns)) return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h)}<div class="sc-table-wrap"><table class="sc-table sc-limits"><thead><tr><th scope="col">Limit</th>${columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th>${columns.map((_, i) => `<td>${cell((r.values || [])[i])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${source ? `<p class="sc-note">These are the limits the service enforces, read from <a href="${esc(source)}">${esc(source.replace(/^https?:\/\//, ''))}</a>.</p>` : ''}</section>`;
}

/** What people do with it, in their words. Only real uses: the caller passes nothing it cannot stand behind. */
function stories({ id: sid, title, lede, items } = {}) {
    if (!has(items)) return '';
    const h = `sc-${slug(title)}`;
    return `<section class="sc-sec"${id(sid)}${labelled(title, h)}>${head(title, lede, h)}<div class="sc-stories">${items.map((s) => `<figure class="sc-story"><blockquote>${esc(s.text)}</blockquote><figcaption>${esc(s.who)}${s.outcome ? `<span>${esc(s.outcome)}</span>` : ''}</figcaption></figure>`).join('')}</div></section>`;
}

/** The closing call to action. */
function cta({ title, text, actions: acts } = {}) {
    if (!title) return '';
    return `<section class="sc-cta"><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}${actions(acts)}</section>`;
}

const CSS = `
.sc-hero,.sc-sec,.sc-cta{max-width:1080px;margin:0 auto;padding:0 24px}
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
.sc-sec{margin-top:56px}
.sc-sec>h2,.sc-cta>h2{font-size:clamp(22px,2.6vw,30px);letter-spacing:-.02em;margin:0 0 6px}
.sc-lede{color:var(--text-secondary,#96a7c2);margin:0 0 18px;max-width:760px;line-height:1.55}
.sc-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.sc-card{display:flex;gap:14px;align-items:flex-start;padding:16px;border-radius:16px;border:1px solid var(--border,rgba(255,255,255,.08));background:var(--bg-secondary,#101828);color:inherit;text-decoration:none;transition:border-color .15s,transform .15s}
a.sc-card:hover,a.sc-card:focus-visible{border-color:var(--accent,#3b82f6);transform:translateY(-2px);outline:0}
.sc-ic{width:40px;height:40px;flex:none;display:grid;place-items:center;border-radius:12px;font-size:17px;color:var(--accent-light,#60a5fa);background:color-mix(in srgb,var(--accent,#3b82f6) 14%,transparent)}
.sc-ic.sc-ic-ov{background:none;border-radius:50%}
.sc-card b{display:block;font-size:15.5px}.sc-card small{display:block;margin-top:3px;color:var(--text-secondary,#96a7c2);font-size:13.5px;line-height:1.45}
.sc-steps{list-style:none;margin:0;padding:0;counter-reset:sc;display:grid;gap:14px 24px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.sc-steps li{counter-increment:sc;display:grid;grid-template-columns:34px 1fr;column-gap:12px;align-items:baseline}
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
.sc-yes{color:var(--success,#22c55e);font-weight:800}.sc-no{color:var(--text-muted,#7386a3)}
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
.sc-cta{margin-top:64px;margin-bottom:24px;text-align:center}
.sc-cta>div,.sc-cta .sc-actions{justify-content:center}.sc-cta p{color:var(--text-secondary,#96a7c2);margin:6px auto 0;max-width:620px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (max-width:860px){.sc-hero.sc-split{grid-template-columns:1fr}.sc-hero{padding-top:36px}}
@media (max-width:520px){.sc-actions .sc-btn{flex:1 1 100%;justify-content:center}.sc-code{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.sc-card,.sc-btn{transition:none}}
`;

module.exports = { hero, features, steps, code, demo, compare, pricing, limits, stories, cta, CSS, STYLESHEET: 'showcase.css', esc };
