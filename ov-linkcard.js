/*!
 * ov-linkcard.js (openvibe-shared 4.320.0; html() and ov-linkcard.css 4.321.0): the card under a chat message that carries a web address, drawn the same on
 * every surface.
 *
 * OpenVibe.Chat reads each address a message carries (server/chat/link-previews.js) and hands the result to every
 * place that shows the message: a room's line carries `embeds`, a stream chat line gets a `chat_embeds` frame a moment
 * later, a room line a `room_message_embeds` frame. Chat's own page drew them; Live's stream chat and the menu's Chat
 * drew nothing (plan §Y.1 A8). They all draw with this now.
 *
 *   OVLinkCard.make(embed, { onHide, hideLabel })   one card, or null for an embed it will not draw
 *   OVLinkCard.render(host, embeds, { onHide, max })  replaces the cards in `host` (at most `max`, 3); returns the count
 *   OVLinkCard.html(embed, { hideAction, hideLabel })  4.321.0: the same card as HTML, for a server (no document): the
 *                                                     same rules, every field escaped; hideAction (a same-site path)
 *                                                     adds the × as a form post, so it works without JavaScript
 *   OVLinkCard.watch(root)                           drop the picture of a server-drawn card that does not load
 *   OVLinkCard.KINDS, OVLinkCard.CSS                 (ov-linkcard.css is the same stylesheet as a file, for pages that
 *                                                     draw cards on the server; the script injects it otherwise)
 *
 *   embed: { url, title, description?, site_name?, image?, kind?, by?, live? }   (link-previews.js's shape)
 *
 * Everything is data: text goes in as text, a link must be https, and a picture must already be on OpenVibe.Media
 * (Chat brings a page's picture there first; a page's own picture is never loaded from the page's site). The whole card
 * opens the address in a new tab (its title is the one link; the rest of the card is its target area); `onHide`, when
 * given, adds a small × that calls it (Chat: the author or a room moderator takes the cards back).
 * Colours are the page's tokens with fallbacks for both modes; the card enters with a short rise that follows
 * html[data-ov-motion] (Calm shortens it, Off has none).
 */
(function (root) {
    'use strict';
    if (!root || root.OVLinkCard) return;
    const KINDS = ['link', 'video', 'image', 'live', 'picture', 'design', 'post', 'profile', 'game'];
    const MEDIA = /^https:\/\/openvibe\.media\/[^\s"'<>]+$/;
    const httpsUrl = (v) => { try { const u = new URL(String(v)); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
    const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
    const siteOf = (e, href) => {
        const named = text(e.site_name, 60);
        if (named) return named;
        try { return new URL(href).hostname.replace(/^www\./, ''); } catch { return ''; }
    };

    const CSS = `
.ovlc { --ovlc-bg: var(--bg-card, var(--surface, #131c2e)); --ovlc-line: var(--border, rgba(148, 163, 184, .22));
  --ovlc-text: var(--text-primary, #e6edf7); --ovlc-muted: var(--text-secondary, #96a7c2); --ovlc-accent: var(--accent, #4f8cff);
  --ovlc-live: var(--danger, #ef4444);
  position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 10px;
  box-sizing: border-box; width: 100%; max-width: 440px; margin: 6px 0 2px; padding: 8px 10px 8px 8px;
  border: 1px solid var(--ovlc-line); border-radius: 12px; background: var(--ovlc-bg); color: var(--ovlc-text);
  font: inherit; text-align: left; transition: border-color .15s, transform .15s, box-shadow .15s;
  animation: ovlc-in .28s cubic-bezier(.2, .8, .2, 1) both; }
html[data-theme-mode="light"] .ovlc { --ovlc-bg: var(--bg-card, var(--surface, #ffffff)); --ovlc-line: var(--border, rgba(15, 23, 42, .14));
  --ovlc-text: var(--text-primary, #0f172a); --ovlc-muted: var(--text-secondary, #475569); }
.ovlc.ovlc-plain { grid-template-columns: minmax(0, 1fr); padding-left: 12px; }
.ovlc:hover, .ovlc:focus-within { border-color: color-mix(in srgb, var(--ovlc-accent) 55%, var(--ovlc-line)); box-shadow: 0 6px 18px -12px rgba(0, 0, 0, .55); transform: translateY(-1px); }
.ovlc-pic { position: relative; width: 64px; height: 64px; border-radius: 9px; overflow: hidden; background: color-mix(in srgb, var(--ovlc-muted) 18%, transparent); }
.ovlc[data-kind="video"] .ovlc-pic, .ovlc[data-kind="live"] .ovlc-pic { width: 96px; height: 54px; }
.ovlc-pic > img { display: block; width: 100%; height: 100%; object-fit: cover; }
.ovlc-play { position: absolute; inset: 0; display: grid; place-items: center; color: #fff; pointer-events: none; }
.ovlc-play > svg { width: 22px; height: 22px; filter: drop-shadow(0 1px 3px rgba(0, 0, 0, .6)); }
.ovlc-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ovlc-site { display: flex; align-items: center; gap: 6px; min-width: 0; color: var(--ovlc-muted); font-size: 11.5px; line-height: 1.3; }
.ovlc-site > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovlc-live { flex: 0 0 auto; padding: 1px 6px; border-radius: 999px; background: var(--ovlc-live); color: #fff; font-size: 10px; font-weight: 700; letter-spacing: .04em; }
.ovlc-title { color: var(--ovlc-text); font-size: 14px; font-weight: 600; line-height: 1.3; text-decoration: none;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.ovlc-title::after { content: ""; position: absolute; inset: 0; border-radius: inherit; }
.ovlc-title:focus-visible { outline: none; }
.ovlc:has(.ovlc-title:focus-visible) { outline: 2px solid var(--ovlc-accent); outline-offset: 2px; }
.ovlc-line { margin: 0; color: var(--ovlc-muted); font-size: 12.5px; line-height: 1.35;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.ovlc-hide { position: absolute; top: -8px; right: -8px; z-index: 1; display: grid; place-items: center; width: 24px; height: 24px; padding: 0;
  border: 1px solid var(--ovlc-line); border-radius: 999px; background: var(--ovlc-bg); color: var(--ovlc-muted); font: 600 14px/1 system-ui, sans-serif;
  cursor: pointer; opacity: 0; transition: opacity .15s, color .15s, border-color .15s; }
.ovlc:hover .ovlc-hide, .ovlc:focus-within .ovlc-hide, .ovlc-hide:focus-visible { opacity: 1; }
.ovlc-hide:hover, .ovlc-hide:focus-visible { color: var(--ovlc-text); border-color: var(--ovlc-accent); }
.ovlc-hide::before { content: ""; position: absolute; inset: -10px; }
.ovlc-hide-form { display: contents; }
@media (hover: none) { .ovlc-hide { opacity: 1; } }
@keyframes ovlc-in { from { opacity: 0; transform: translateY(calc(6px * var(--ov-move, 1))); } }
html[data-ov-motion="calm"] .ovlc { animation-duration: .18s; }
html[data-ov-motion="off"] .ovlc { animation: none; transition: none; }
html[data-ov-motion="off"] .ovlc:hover, html[data-ov-motion="off"] .ovlc:focus-within { transform: none; }
`;
    function css() {
        if (typeof document === 'undefined' || document.getElementById('ov-linkcard-css')) return;
        const st = document.createElement('style'); st.id = 'ov-linkcard-css'; st.textContent = CSS;
        (document.head || document.documentElement).appendChild(st);
    }
    function el(tag, cls, content) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (content != null) n.textContent = content;
        return n;
    }
    const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z"/></svg>';

    /** One card, or null: an embed needs a title and an https address. */
    function make(e, opts) {
        const o = opts || {};
        if (!e || typeof e !== 'object' || typeof document === 'undefined') return null;
        const title = text(e.title, 200);
        const href = httpsUrl(e.url);
        if (!title || !href) return null;
        css();
        const kind = KINDS.includes(e.kind) ? e.kind : 'link';
        const card = el('div', 'ovlc');
        card.dataset.kind = kind;
        const pic = typeof e.image === 'string' && MEDIA.test(e.image) ? httpsUrl(e.image) : '';
        if (pic) {
            const box = el('span', 'ovlc-pic');
            const img = document.createElement('img');
            img.src = pic; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
            img.referrerPolicy = 'no-referrer';
            // A picture that will not load leaves the words alone, not a broken frame.
            img.addEventListener('error', () => { box.remove(); card.classList.add('ovlc-plain'); }, { once: true });
            box.appendChild(img);
            if (kind === 'video' || kind === 'live') { const play = el('span', 'ovlc-play'); play.innerHTML = PLAY; box.appendChild(play); }
            card.appendChild(box);
        } else {
            card.classList.add('ovlc-plain');
        }
        const body = el('span', 'ovlc-body');
        const site = el('span', 'ovlc-site');
        if (e.live === true) site.appendChild(el('span', 'ovlc-live', 'LIVE'));
        const by = text(e.by, 60);
        site.appendChild(el('span', '', [siteOf(e, href), by ? `by ${by}` : ''].filter(Boolean).join(' · ')));
        body.appendChild(site);
        const link = el('a', 'ovlc-title', title);
        link.href = href; link.target = '_blank'; link.rel = 'noopener nofollow ugc';
        body.appendChild(link);
        const line = text(e.description, 300);
        if (line) body.appendChild(el('p', 'ovlc-line', line));
        card.appendChild(body);
        if (typeof o.onHide === 'function') {
            const label = text(o.hideLabel, 60) || 'Hide this preview';
            const b = el('button', 'ovlc-hide', '×');
            b.type = 'button'; b.title = label; b.setAttribute('aria-label', label);
            b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); o.onHide(e, card); });
            card.appendChild(b);
        }
        return card;
    }

    /** The cards of one message: the old ones in `host` go, the new list (at most `max`) is drawn. */
    function render(host, embeds, opts) {
        if (!host || typeof host.querySelectorAll !== 'function') return 0;
        for (const old of host.querySelectorAll(':scope > .ovlc')) old.remove();
        const o = opts || {};
        const max = Math.max(0, Math.min(10, Number(o.max) || 3));
        let n = 0;
        for (const e of Array.isArray(embeds) ? embeds : []) {
            if (n >= max) break;
            const card = make(e, o);
            if (card) { host.appendChild(card); n += 1; }
        }
        return n;
    }

    const escHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /** The card as HTML for a server: the same markup make() builds, or '' for an embed it will not draw. */
    function html(e, opts) {
        const o = opts || {};
        if (!e || typeof e !== 'object') return '';
        const title = text(e.title, 200);
        const href = httpsUrl(e.url);
        if (!title || !href) return '';
        const kind = KINDS.includes(e.kind) ? e.kind : 'link';
        const pic = typeof e.image === 'string' && MEDIA.test(e.image) ? httpsUrl(e.image) : '';
        const by = text(e.by, 60);
        const site = [siteOf(e, href), by ? `by ${by}` : ''].filter(Boolean).join(' · ');
        const line = text(e.description, 300);
        const hide = typeof o.hideAction === 'string' && /^\/[^/\\]/.test(o.hideAction) ? o.hideAction : '';
        const label = text(o.hideLabel, 60) || 'Hide this preview';
        return `<div class="ovlc${pic ? '' : ' ovlc-plain'}" data-kind="${kind}">`
            + (pic ? `<span class="ovlc-pic"><img src="${escHtml(pic)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-ovlc-pic>`
                + (kind === 'video' || kind === 'live' ? `<span class="ovlc-play">${PLAY}</span>` : '') + '</span>' : '')
            + '<span class="ovlc-body"><span class="ovlc-site">'
            + (e.live === true ? '<span class="ovlc-live">LIVE</span>' : '') + `<span>${escHtml(site)}</span></span>`
            + `<a class="ovlc-title" href="${escHtml(href)}" target="_blank" rel="noopener nofollow ugc">${escHtml(title)}</a>`
            + (line ? `<p class="ovlc-line">${escHtml(line)}</p>` : '') + '</span>'
            + (hide ? `<form class="ovlc-hide-form" method="post" action="${escHtml(hide)}"><input type="hidden" name="hidden" value="1">`
                + `<button type="submit" class="ovlc-hide" title="${escHtml(label)}" aria-label="${escHtml(label)}">×</button></form>` : '')
            + '</div>';
    }

    /** A server-drawn card whose picture does not load keeps its words, not a broken frame. */
    function watch(scope) {
        if (typeof document === 'undefined') return;
        const all = (scope || document).querySelectorAll ? (scope || document).querySelectorAll('img[data-ovlc-pic]') : [];
        for (const img of all) {
            if (img.__ovlcWatched) continue;
            img.__ovlcWatched = true;
            const drop = () => { const box = img.closest('.ovlc-pic'); const card = img.closest('.ovlc'); if (box) box.remove(); if (card) card.classList.add('ovlc-plain'); };
            if (img.complete && img.naturalWidth === 0) drop(); else img.addEventListener('error', drop, { once: true });
        }
    }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => watch(document), { once: true });
        else watch(document);
    }

    const api = Object.freeze({ KINDS, CSS, make, render, html, watch, version: '4.321.0' });
    root.OVLinkCard = api;
    if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
