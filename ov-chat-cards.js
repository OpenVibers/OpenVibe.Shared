/**
 * openvibe-shared/ov-chat-cards.js — chat messages that are events, drawn as cards, the same in every chat (4.284.0; the
 * owner, 11-16: Global in the menu "is missing all the styles that exist when you're out … compared to how it is on .live",
 * and "these chats … should have like a custom system for these type of styles, and you can make custom widgets or custom
 * HTML or AI vibe coded … interconnected … shared, smart and always updating").
 *
 *   OVChatCards.of(message)            → a card ({ kind, … }) or null: what this message is, if it is an event
 *   OVChatCards.render(card, opts)     → an element: the card (opts: { time: 'text', here: bool })
 *   OVChatCards.fold(prevEl, card)     → true when the card joined the card above (a run of deploys, the same person
 *                                        going live again within 15 minutes)
 *   OVChatCards.register(kind, { match(message) → card|null, render(card, h) → element })   a site's or an agent's own
 *
 * Built in, as Live draws them (public/js/chat.js, its first home):
 *   live      "🔴 <name> is live. Share the stream: <url>" or metadata.kind 'live_link' → the face with a live ring,
 *             "<name> is live", Watch
 *   rundown   "📰 <name>: “<title>” at <url>" or metadata.rundown_episode → "<name> on The Rundown", the title, Read
 *   shipped   "🚀 N updates shipped: a · b · c" → "N updates shipped", the subjects folded under it; a run of them is one
 *   widget    metadata.widget = { html, height?, title? }: a page of its own, in a sandboxed frame (scripts only: no
 *             same origin, no forms, no pop-ups, no top navigation), its height asked for by postMessage, labelled with
 *             who made it. What an agent or a person builds into a chat goes here.
 * Links are only ever https OpenVibe addresses; text is set as text. Motion follows html[data-ov-motion].
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OVChatCards) return;
    const LIVE_RE = /^\s*\u{1F534}\s*(.+?) is live\. Share the stream:\s*(https?:\/\/\S+)\s*$/u;
    const RUNDOWN_RE = /^\s*\u{1F4F0}\s*(.+?):\s*[“"](.+)[”"]\s+(?:→|at)\s+(https?:\/\/\S+)\s*$/u;
    const SHIPPED_RE = /^\s*\u{1F680}\s*(\d+)\s+updates?\s+shipped:?\s*(.*)$/su;
    const FOLD_MS = 15 * 60 * 1000;
    const kinds = new Map();   // kind → { match, render }

    const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const safe = (u) => {
        try {
            const x = new URL(String(u || ''), location.href);
            if (x.protocol !== 'https:') return null;
            const host = x.hostname.toLowerCase();
            if (!/(^|\.)openvibe\.[a-z]{2,12}$|(^|\.)open\.[a-z]{2,12}$/.test(host)) return null;
            if (/^\/@[A-Za-z0-9_]{2,32}/.test(x.pathname)) { x.hash = ''; x.searchParams.delete('section'); }
            return x.href;
        } catch { return null; }
    };
    const metaOf = (m) => { try { return typeof m.metadata === 'string' ? JSON.parse(m.metadata) : (m.metadata || null); } catch { return null; } };
    const atOf = (m) => m.timestamp || m.created_at || m.at || null;
    const timeText = (at) => { const d = new Date(at || Date.now()); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };

    function of(m) {
        if (!m) return null;
        for (const [kind, k] of kinds) { try { const c = k.match(m); if (c) return { kind, ...c, id: m.id, at: atOf(m) }; } catch { /* a site's own */ } }
        const meta = metaOf(m);
        const text = String(m.message || m.text || '');
        const at = atOf(m);
        if (meta && meta.widget && typeof meta.widget.html === 'string' && meta.widget.html.length <= 65536) {
            return { kind: 'widget', id: m.id, at, html: meta.widget.html, height: Math.max(80, Math.min(640, Number(meta.widget.height) || 240)),
                title: String(meta.widget.title || 'A widget').slice(0, 80), by: String(m.display_name || m.username || 'Someone').slice(0, 40) };
        }
        if (m.message_type && m.message_type !== 'system' && !(meta && (meta.kind === 'live_link' || meta.rundown_episode))) return null;
        const live = text.match(LIVE_RE);
        if ((meta && meta.kind === 'live_link') || live) {
            const url = safe((meta && meta.url) || (live && live[2]));
            if (!url) return null;
            const handle = (url.match(/\/@([^/?#]+)/) || [])[1];
            const name = (live && live[1]) || (handle ? decodeURIComponent(handle) : 'Someone');
            return { kind: 'live', id: m.id, at, name, url, key: `live:${name.toLowerCase()}` };
        }
        const rd = text.match(RUNDOWN_RE);
        if ((meta && meta.rundown_episode) || rd) {
            const url = safe((meta && meta.url) || (rd && rd[3]));
            if (!url) return null;
            return { kind: 'rundown', id: m.id, at, name: rd ? rd[1] : 'A streamer', title: rd ? rd[2] : 'A new episode', url, key: `rundown:${url}` };
        }
        const sh = text.match(SHIPPED_RE);
        if (sh) {
            const items = sh[2].split(/\s+·\s+/).map((x) => x.trim()).filter(Boolean).slice(0, 40);
            return { kind: 'shipped', id: m.id, at, count: Number(sh[1]) || items.length, items, key: 'shipped' };
        }
        return null;
    }

    let styled = false;
    function styles() {
        if (styled || document.getElementById('ovcc-styles')) { styled = true; return; }
        styled = true;
        const s = document.createElement('style'); s.id = 'ovcc-styles';
        s.textContent = '.ovcc{--ev:var(--accent,#3b82f6);position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:0 10px;min-height:44px;margin:4px 0;padding:6px 8px 6px 6px;border-radius:14px;'
            + 'border:1px solid color-mix(in srgb,var(--ev) 26%,var(--border,rgba(148,163,184,.18)));background:color-mix(in srgb,var(--ev) 9%,var(--bg-card,#131c2e));list-style:none;animation:ovcc-in .32s cubic-bezier(.2,.8,.2,1) both}'
            + '@keyframes ovcc-in{from{opacity:0;transform:translateY(calc(6px * var(--ov-move,1))) scale(.98)}}'
            + '.ovcc:hover{border-color:color-mix(in srgb,var(--ev) 55%,transparent)}'
            + '.ovcc--live{--ev:var(--live-red,var(--live,#ef4444))}.ovcc--shipped{--ev:var(--accent,#3b82f6)}.ovcc--widget{grid-template-columns:minmax(0,1fr);padding:8px}'
            + '.ovcc-ic{position:relative;display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:color-mix(in srgb,var(--ev) 18%,transparent);color:var(--ev);font-size:15px;flex:none}'
            + '.ovcc-ic img{position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover}'
            + '.ovcc--live .ovcc-ic{box-shadow:0 0 0 2px var(--ev);animation:ovcc-pulse 1.8s ease-out infinite}'
            + '@keyframes ovcc-pulse{0%{box-shadow:0 0 0 2px var(--ev),0 0 0 2px color-mix(in srgb,var(--ev) 55%,transparent)}70%{box-shadow:0 0 0 2px var(--ev),0 0 0 10px transparent}100%{box-shadow:0 0 0 2px var(--ev)}}'
            + '.ovcc-b{min-width:0}.ovcc-l{display:flex;align-items:baseline;gap:.3em;min-width:0;white-space:nowrap;color:var(--text-primary,#e6edf7)}'
            + '.ovcc-l b{min-width:0;overflow:hidden;text-overflow:ellipsis;font-weight:750}.ovcc-l span{flex:none}.ovcc-t{flex:none;margin-left:.25em;font-size:.74rem;color:var(--text-muted,#7d8aa0)}'
            + '.ovcc-s{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.86rem;color:var(--text-secondary,#a8b3c4)}'
            + '.ovcc-go{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 14px;border-radius:999px;background:var(--ev);color:#fff;font-weight:750;font-size:.82rem;text-decoration:none;white-space:nowrap}'
            + '.ovcc-go::after{content:"";position:absolute;inset:0;border-radius:14px}.ovcc-go svg{width:14px;height:14px}.ovcc:active .ovcc-go{transform:scale(.96)}'
            + '.ovcc-go:focus-visible{outline:2px solid var(--ev);outline-offset:2px}'
            + '.ovcc details{min-width:0}.ovcc summary{display:flex;align-items:baseline;gap:.35em;cursor:pointer;list-style:none;color:var(--text-primary,#e6edf7);font-weight:750}.ovcc summary::-webkit-details-marker{display:none}'
            + '.ovcc summary::after{content:"";margin-left:auto;width:8px;height:8px;border:solid currentColor;border-width:0 2px 2px 0;transform:rotate(45deg);opacity:.6;transition:transform .2s}'
            + '.ovcc details[open] summary::after{transform:rotate(-135deg)}.ovcc ul{margin:6px 0 2px;padding:0 0 0 18px;font-size:.84rem;color:var(--text-secondary,#a8b3c4)}.ovcc li{margin:2px 0}'
            + '.ovcc-wh{display:flex;align-items:center;gap:6px;font-size:.78rem;color:var(--text-muted,#7d8aa0);margin:0 2px 6px}.ovcc-wh b{color:var(--text-secondary,#a8b3c4)}'
            + '.ovcc iframe{display:block;width:100%;border:0;border-radius:10px;background:var(--bg-primary,#0b1220)}'
            + '@container (max-width:280px){.ovcc-go{width:34px;padding:0;justify-content:center;font-size:0}.ovcc-t{display:none}}'
            + 'html[data-ov-motion=off] .ovcc,html[data-ov-motion=off] .ovcc--live .ovcc-ic{animation:none}';
        document.head.appendChild(s);
    }
    const SVG = {
        play: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M8 5.5v13l10.5-6.5Z"/></svg>',
        read: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h6a2 2 0 0 1 2 2V19a1.5 1.5 0 0 0-1.5-1.5H4ZM20 5.5h-6a2 2 0 0 0-2 2V19a1.5 1.5 0 0 1 1.5-1.5H20Z"/></svg>',
        news: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4.5" width="16" height="15" rx="2"/><path d="M8 9h8M8 12.5h8M8 16h5"/></svg>',
        rocket: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4.5c3 0 5.5 2.5 5.5 5.5L13 16.5 7.5 11Z"/><path d="M7.5 11 5 10.5 3.5 13l3 1M13 16.5l.5 2.5-2.5 1.5-1-3M9.5 17.5 6.5 20.5"/></svg>',
    };

    function render(c, opts = {}) {
        styles();
        const k = kinds.get(c.kind);
        if (k && typeof k.render === 'function') { try { const el = k.render(c, h); if (el) return el; } catch { /* falls back below */ } }
        const card = h('li', `ovcc ovcc--${c.kind}`);
        card.setAttribute('role', 'article');
        if (c.id != null) card.dataset.msgId = String(c.id);
        if (c.key) card.dataset.ovccKey = c.key;
        card.dataset.ovccAt = String(new Date(c.at || Date.now()).getTime() || Date.now());
        const time = opts.time === false ? '' : timeText(c.at);
        if (c.kind === 'widget') {
            const head = h('p', 'ovcc-wh'); head.append(h('b', '', c.title), document.createTextNode(`· by ${c.by}`));
            const f = document.createElement('iframe');
            f.setAttribute('sandbox', 'allow-scripts');
            f.setAttribute('referrerpolicy', 'no-referrer');
            f.title = c.title; f.loading = 'lazy'; f.style.height = `${c.height}px`;
            f.srcdoc = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: https:; font-src data:"><style>html,body{margin:0;font:14px system-ui,sans-serif;color:#e6edf7;background:transparent}</style>${c.html}<script>new ResizeObserver(()=>parent.postMessage({ovccHeight:document.documentElement.scrollHeight},'*')).observe(document.documentElement)<\/script>`;
            window.addEventListener('message', (e) => { if (e.source === f.contentWindow && e.data && Number(e.data.ovccHeight)) f.style.height = `${Math.max(60, Math.min(640, Number(e.data.ovccHeight)))}px`; });
            card.append(head, f);
            return card;
        }
        const ic = h('span', 'ovcc-ic'); ic.setAttribute('aria-hidden', 'true');
        const body = h('div', 'ovcc-b');
        const line = h('div', 'ovcc-l');
        if (c.kind === 'live') {
            if (/^[A-Za-z0-9_]{2,32}$/.test(String(c.name || ''))) { const img = h('img'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = `https://openvibe.network/avatar/${encodeURIComponent(c.name)}?s=64`; img.onerror = () => img.remove(); ic.append(img); }
            line.append(h('b', '', c.name), h('span', '', opts.here ? 'went live' : 'is live'));
        } else if (c.kind === 'rundown') {
            ic.innerHTML = SVG.news;
            line.append(h('b', '', c.name), h('span', '', 'on The Rundown'));
        } else if (c.kind === 'shipped') {
            ic.innerHTML = SVG.rocket;
            const d = h('details'); const sum = h('summary');
            sum.append(h('span', 'ovcc-n', `${c.count} update${c.count === 1 ? '' : 's'} shipped`)); if (time) sum.append(h('span', 'ovcc-t', time));
            const ul = h('ul'); c.items.forEach((x) => ul.append(h('li', '', x)));
            d.append(sum, ul); body.append(d);
            card.append(ic, body);
            card.__ovcc = c;
            return card;
        }
        if (time) line.append(h('span', 'ovcc-t', time));
        body.append(line);
        if (c.kind === 'rundown') body.append(h('span', 'ovcc-s', `“${c.title}”`));
        card.append(ic, body);
        if (c.url && !opts.here) {
            const go = h('a', 'ovcc-go'); go.href = c.url; go.rel = 'noopener';
            go.innerHTML = c.kind === 'live' ? SVG.play : SVG.read;
            go.append(document.createTextNode(c.kind === 'live' ? 'Watch' : 'Read'));
            go.setAttribute('aria-label', c.kind === 'live' ? `Watch ${c.name}` : `Read ${c.name} on The Rundown`);
            card.append(go);
        }
        card.__ovcc = c;
        return card;
    }

    /** The card joins the one above: a run of deploys becomes one, and the same person live again within 15 minutes. */
    function fold(prev, c) {
        if (!prev || !prev.__ovcc || !c) return false;
        const p = prev.__ovcc;
        const t = new Date(c.at || Date.now()).getTime(), pt = Number(prev.dataset.ovccAt) || 0;
        if (c.kind === 'shipped' && p.kind === 'shipped' && Math.abs(t - pt) < 6 * 3600e3) {
            p.count += c.count; p.items = p.items.concat(c.items).slice(0, 80);
            const n = prev.querySelector('.ovcc-n'); if (n) n.textContent = `${p.count} update${p.count === 1 ? '' : 's'} shipped`;
            const ul = prev.querySelector('ul'); if (ul) c.items.forEach((x) => ul.append(h('li', '', x)));
            prev.dataset.ovccAt = String(t);
            return true;
        }
        if (c.kind === 'live' && p.kind === 'live' && p.key === c.key && Math.abs(t - pt) < FOLD_MS) { prev.dataset.ovccAt = String(t); return true; }
        return false;
    }

    function register(kind, spec) {
        if (!/^[a-z][a-z0-9-]{1,30}$/.test(String(kind || '')) || !spec || typeof spec.match !== 'function') return false;
        kinds.set(kind, { match: spec.match, render: typeof spec.render === 'function' ? spec.render : null });
        return true;
    }

    root.OVChatCards = { of, render, fold, register };
})(typeof window !== 'undefined' ? window : globalThis);
