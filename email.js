'use strict';
/*
 * openvibe-shared/email — one frame for every mail the network sends (the owner, 2026-11-10, with a "Browser check
 * failed" mail open: "Improve the entire email system so it uses openvibe.design … uses the theme applied by the user
 * … explain more details … show the words, what they can do, what they can click").
 *
 *   const mail = require('openvibe-shared/email');
 *   const { html, text } = mail.frame({
 *       theme: 'vibe',                       // a built-in theme's id (the person's own), or its { mode, variables }
 *       site: { name: 'OpenVibe', url: 'https://openvibe.network', logo: 'https://…/logo-192.png' },
 *       tone: 'alert',                       // 'plain' | 'alert' | 'warning' | 'good'
 *       kicker: 'Still failing',             // a few words over the title (optional)
 *       title: 'openvibe.domains: 1 problem found by the browser check',
 *       lead: 'After release 74bdff4, the automatic check found a problem on the page /.',
 *       body: ['Two fold headings have no name a screen reader can say.'],
 *       facts: [{ label: 'Page', value: '/', href: 'https://openvibe.domains/' }, { label: 'Release', value: '74bdff4' }],
 *       code: '482 913',                     // a code to type somewhere (sign-in, two-step), drawn large (optional)
 *       actions: [{ label: 'Open the page', href: 'https://…' }, { label: 'See the release', href: 'https://…' }],
 *       next: ['The check runs again after every release and once a day.'],
 *       why: 'You get this because you run this site.',
 *       manage: { label: 'Change what is mailed to you', href: 'https://openvibe.network/notifications' },
 *       preheader: 'Two fold headings have no name.',   // the line a mail list shows beside the subject
 *   });
 *
 * What a mail client allows decides the build: tables for layout, every style written on its element, no script, no
 * web font, no SVG (the mark is a hosted PNG, with the site's name beside it as text), nothing that moves. The colours
 * are the person's theme (dark or light as the theme is; the client is told so and does not invert it). A mail's tone is
 * never a hard coloured border: the card leans toward the tone at its top and glows in it, the kicker is a pill with a
 * round mark, the facts stand in a box with a tinted hairline. Where a client draws no shadow or gradient the tints and
 * hairlines remain. Every string is
 * text: it is escaped, and a link is kept only if it is https or mailto. The first action is the one button; the others
 * are plain links under it. `text` says the same in plain words for clients that show no HTML.
 */
const themes = require('./builtin-themes');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const link = (u) => { const s = String(u == null ? '' : u).trim(); return /^https:\/\/[^\s<>"']+$/i.test(s) || /^mailto:[^\s<>"']+$/i.test(s) ? s : ''; };
const rgb = (h) => { const x = String(h).replace('#', ''); const f = x.length === 3 ? x.split('').map((ch) => ch + ch).join('') : x.slice(0, 6); return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)); };
/** A colour part of the way from one to another, as a plain hex: a mail client has no colour mixing and little transparency. */
const mix = (a, b, t) => { const q = rgb(b); return '#' + rgb(a).map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const ratio = (a, b) => themes.contrast(themes.hexToRgb(a), themes.hexToRgb(b));
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

/** The colours a mail is written in, from a theme's id or its { mode, variables }. An unknown id is the default theme. */
function palette(theme) {
    let t = theme && typeof theme === 'object' ? theme : themes.BUILTIN_THEMES.find((x) => x.id === theme || x.slug === theme);
    if (!t || !t.variables) t = themes.BUILTIN_THEMES.find((x) => x.id === themes.DEFAULT_THEME) || themes.BUILTIN_THEMES[0];
    const mode = t.mode === 'light' ? 'light' : 'dark';
    const v = { ...t.variables, ...themes.deriveTokens(t.variables, mode) };
    const pick = (k, d) => (/^#[0-9a-f]{3,8}$/i.test(String(v[k] || '')) ? v[k] : d);
    const dark = mode === 'dark';
    return {
        mode,
        page: pick('--bg-primary', dark ? '#0a0f1c' : '#f4f6fb'), card: pick('--bg-card', dark ? '#131c2e' : '#ffffff'), well: pick('--bg-secondary', dark ? '#101828' : '#f1f4f9'),
        line: pick('--border', dark ? '#1f2d47' : '#d9e0ec'), text: pick('--text-primary', dark ? '#e6edf7' : '#0f172a'), dim: pick('--text-secondary', dark ? '#96a7c2' : '#475569'), faint: pick('--text-muted', dark ? '#8192ac' : '#64748b'),
        accent: pick('--accent-light', pick('--accent', '#3b82f6')), button: pick('--accent-strong', '#3472d8'), onButton: pick('--on-accent-strong', '#ffffff'),
        alert: pick('--danger', '#ef4444'), warning: pick('--warning', '#f59e0b'), good: pick('--success', '#22c55e'),
    };
}

/** One mail: { html, text }. See the head of this file for what it takes. */
function frame(o = {}) {
    const c = palette(o.theme);
    const site = { name: 'OpenVibe', url: 'https://openvibe.network', ...(o.site || {}) };
    const tone = ['alert', 'warning', 'good'].includes(o.tone) ? o.tone : 'plain';
    const mark = tone === 'plain' ? c.accent : c[tone];
    const tint = (t) => mix(c.card, mark, t);                    // the card, leaning toward the tone
    let ink = mark;                                              // the tone as words on its own tint: readable in every theme
    for (let i = 0; i < 8 && ratio(ink, tint(0.14)) < 4.5; i += 1) ink = mix(ink, c.text, 0.25);
    const onMark = ratio(mark, '#ffffff') >= ratio(mark, c.page) ? '#ffffff' : c.page;
    const glyph = { alert: '!', warning: '!', good: '&#10003;', plain: 'i' }[tone];
    const body = (Array.isArray(o.body) ? o.body : o.body ? [o.body] : []).filter(Boolean);
    const facts = (o.facts || []).filter((f) => f && f.label && f.value != null && f.value !== '');
    const actions = (o.actions || []).map((a) => ({ label: a && a.label, href: link(a && a.href) })).filter((a) => a.label && a.href);
    const next = (Array.isArray(o.next) ? o.next : o.next ? [o.next] : []).filter(Boolean);
    const manage = o.manage && link(o.manage.href) ? { label: o.manage.label || 'Change what is mailed to you', href: link(o.manage.href) } : null;
    const home = link(site.url) || 'https://openvibe.network';
    const logo = link(site.logo);
    const p = (s, style) => `<p style="margin:0 0 14px;font:400 15px/1.6 ${FONT};color:${c.dim};${style || ''}">${esc(s)}</p>`;
    const a = (label, href, style) => `<a href="${esc(href)}" style="color:${c.accent};text-decoration:underline;${style || ''}">${esc(label)}</a>`;

    const head = `<tr><td style="padding:22px 28px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${logo ? `<td style="padding-right:10px"><a href="${esc(home)}"><img src="${esc(logo)}" width="32" height="32" alt="" style="display:block;border:0;border-radius:8px"></a></td>` : ''}<td><a href="${esc(home)}" style="font:700 16px/1 ${FONT};color:${c.text};text-decoration:none;letter-spacing:.1px">${esc(site.name)}</a></td></tr></table></td></tr>`;
    const title = `<tr><td style="padding:22px 28px 0">${o.kicker ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px"><tr><td style="padding:4px 12px 4px 5px;border-radius:999px;background:${tint(0.14)};border:1px solid ${tint(0.34)};font:700 12px/18px ${FONT};color:${ink};white-space:nowrap"><span style="display:inline-block;width:18px;height:18px;margin-right:7px;border-radius:50%;background:${mark};color:${onMark};font:700 12px/18px ${FONT};text-align:center;vertical-align:top">${glyph}</span>${esc(o.kicker)}</td></tr></table>` : ''}<h1 style="margin:0 0 12px;font:700 21px/1.3 ${FONT};color:${c.text}">${esc(o.title || '')}</h1>${o.lead ? p(o.lead, `color:${c.text};`) : ''}${body.map((s) => p(s)).join('')}</td></tr>`;
    const code = o.code ? `<tr><td style="padding:2px 28px 16px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:18px 12px;border-radius:12px;background:${c.well};border:1px solid ${c.line};font:700 30px/1.2 ${MONO};letter-spacing:6px;color:${c.text}">${esc(o.code)}</td></tr></table></td></tr>` : '';
    const factRows = facts.map((f, i) => `<tr><td valign="top" style="padding:9px 14px 9px 16px;width:34%;font:600 13px/1.5 ${FONT};color:${c.faint};${i ? `border-top:1px solid ${c.line};` : ''}">${esc(f.label)}</td><td valign="top" style="padding:9px 16px 9px 0;font:400 14px/1.5 ${FONT};color:${c.text};word-break:break-word;${i ? `border-top:1px solid ${c.line};` : ''}">${link(f.href) ? a(f.value, link(f.href)) : esc(f.value)}</td></tr>`).join('');
    const factsBlock = facts.length ? `<tr><td style="padding:2px 28px 18px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:14px;background:${c.well};border:1px solid ${tint(0.3)};box-shadow:0 12px 30px -18px ${mark}">${factRows}</table></td></tr>` : '';
    const first = actions[0];
    const actionsBlock = first ? `<tr><td style="padding:2px 28px 6px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:12px;background:${c.button};box-shadow:0 10px 24px -12px ${c.button}"><a href="${esc(first.href)}" style="display:inline-block;padding:12px 22px;font:700 15px/1.2 ${FONT};color:${c.onButton};text-decoration:none;border-radius:12px">${esc(first.label)} <span aria-hidden="true">&rarr;</span></a></td></tr></table></td></tr>${actions.length > 1 ? `<tr><td style="padding:8px 28px 6px;font:400 14px/1.9 ${FONT};color:${c.dim}">${actions.slice(1).map((x) => a(x.label, x.href)).join(' &nbsp;·&nbsp; ')}</td></tr>` : ''}` : '';
    const nextBlock = next.length ? `<tr><td style="padding:12px 28px 4px"><p style="margin:0 0 6px;font:700 13px/1.4 ${FONT};color:${c.text}">What happens next</p><table role="presentation" cellpadding="0" cellspacing="0" border="0">${next.map((s) => `<tr><td valign="top" style="padding:9px 10px 0 1px"><span style="display:block;width:6px;height:6px;border-radius:50%;background:${mark}"></span></td><td style="padding:0 0 5px;font:400 14px/1.6 ${FONT};color:${c.dim}">${esc(s)}</td></tr>`).join('')}</table></td></tr>` : '';
    const foot = `<tr><td style="padding:18px 28px 22px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="border-top:1px solid ${c.line};padding-top:14px;font:400 12px/1.6 ${FONT};color:${c.faint}">${o.why ? `${esc(o.why)} ` : ''}${manage ? a(manage.label, manage.href, `color:${c.faint};`) : ''}${o.why || manage ? '<br>' : ''}${a(site.name, home, `color:${c.faint};text-decoration:none;`)}</td></tr></table></td></tr>`;

    const html = `<!doctype html>
<html lang="${esc(o.lang || 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="${c.mode}"><meta name="supported-color-schemes" content="${c.mode}"><title>${esc(o.title || site.name)}</title>
<style>@media (max-width:480px){.ovm-pad>tbody>tr>td{padding-left:18px!important;padding-right:18px!important}.ovm-out{padding:12px 8px!important}}</style></head>
<body style="margin:0;padding:0;background:${c.page};-webkit-text-size-adjust:100%">
${o.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${c.page};font-size:1px;line-height:1px">${esc(o.preheader)}</div>` : ''}<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${c.page}"><tr><td class="ovm-out" align="center" style="padding:24px 12px">
<table role="presentation" class="ovm-pad" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:580px;background:${c.card};background-image:linear-gradient(180deg, ${tint(0.2)} 0, ${c.card} 130px);border:1px solid ${mix(c.line, mark, 0.3)};border-radius:16px;box-shadow:0 22px 60px -30px ${mark}">
${head}${title}${code}${factsBlock}${actionsBlock}${nextBlock}${foot}
</table></td></tr></table></body></html>`;

    const lines = [];
    if (o.kicker) lines.push(String(o.kicker).toUpperCase());
    lines.push(String(o.title || ''), '');
    if (o.lead) lines.push(String(o.lead));
    body.forEach((s) => lines.push(String(s)));
    if (o.code) lines.push('', `Your code: ${o.code}`);
    if (facts.length) { lines.push(''); facts.forEach((f) => lines.push(`${f.label}: ${f.value}${link(f.href) ? ` (${link(f.href)})` : ''}`)); }
    if (actions.length) { lines.push(''); actions.forEach((x) => lines.push(`${x.label}: ${x.href}`)); }
    if (next.length) { lines.push('', 'What happens next'); next.forEach((s) => lines.push(`- ${s}`)); }
    lines.push('', '--');
    if (o.why) lines.push(String(o.why));
    if (manage) lines.push(`${manage.label}: ${manage.href}`);
    lines.push(`${site.name} · ${home}`);
    return { html, text: lines.join('\n').replace(/\n{3,}/g, '\n\n') };
}

module.exports = { frame, palette, mix };
