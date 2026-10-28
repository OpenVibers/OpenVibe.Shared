/**
 * openvibe-shared/search.js — search everything on OpenVibe from any site's navbar: the magnifier, "/" or Ctrl+K. The
 * navbar loads this file the first time someone asks (the owner, 2026-10-28: "a magnifying glass button that's more
 * compact, shared across the sites… more intelligent… asynchronous loading, lazy loading and autocomplete… reused in
 * the SDK and API… intelligent and aware").
 *
 * What it knows: the site it is on (its pages come first, its own search page when it has one), what you searched
 * before (on this device), and everything OpenVibe.Search holds across the sites, suggested as you type (anonymous,
 * one request in flight, the older one cancelled). The suggestions come through OpenVibe.Network's
 * GET /api/frame/suggest (OpenVibe.Search's /api/v1/suggest, kept 30 s): every site's Content-Security-Policy already
 * lets the navbar reach openvibe.network, and most refuse search.openvibe.network. Every row is a link: a result, a
 * page of this site, "Search all of OpenVibe" and "Ask Vibe". Arrows move, Enter opens, Escape closes. A phone gets
 * the whole screen; a computer a panel near the top.
 *
 *   OpenVibeSearch.open({ service, scope: { owner, label, page }, links, q, suggestUrl })   navbar.js calls it
 *   OpenVibeSearch.close()
 *   OpenVibeSearch.suggest(q, { owner, limit, signal, url }) → [{ owner, type, id, title, url, site }]   for any page's own box
 *     (url: https://openvibe.network/api/frame/suggest, or https://search.openvibe.network/api/v1/suggest where the
 *     page's connect-src allows it; both answer any origin)
 *
 * Text is always set with textContent; links are https or same-site paths only. Recent searches live in localStorage
 * (ov_search_recent, eight at most) and can be cleared from the panel.
 */
(function (root) {
    'use strict';
    const API = 'https://search.openvibe.network';
    const SUGGEST = 'https://openvibe.network/api/frame/suggest';
    const RECENT_KEY = 'ov_search_recent';
    const SITE = { 'openre.stream': 'Restream', 'search.openvibe.network': 'Search', 'ai.openvibe.services': 'AI' };
    const TYPE = { vod: 'Recording', clip: 'Clip', job: 'Job', story: 'Story', page: 'Page', thread: 'Thread', paste: 'Paste', post: 'Post', stream: 'Live', channel: 'Channel', deal: 'Deal', coupon: 'Code', review: 'Review', entity: 'Reviews', recipe: 'Recipe', game: 'Game', tool: 'Tool', listing: 'Listing', wiki: 'Wiki' };
    let el = null, input = null, listEl = null, ctx = {}, items = [], active = -1, inflight = null, timer = null, lastFocus = null;

    const safeUrl = (u) => { try { const x = new URL(u, location.href); return x.protocol === 'https:' || x.origin === location.origin ? x.href : null; } catch { return null; } };
    function siteOf(url) {
        try {
            const h = new URL(url).hostname.replace(/^www\./, '');
            if (SITE[h]) return SITE[h];
            const m = /^(?:([a-z0-9-]+)\.)?openvibe\.([a-z]+)$/.exec(h);
            if (m) return m[1] ? m[1][0].toUpperCase() + m[1].slice(1) : m[2][0].toUpperCase() + m[2].slice(1);
            return h;
        } catch { return ''; }
    }
    const recent = {
        get() { try { return (JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') || []).filter((x) => typeof x === 'string').slice(0, 8); } catch { return []; } },
        add(q) { try { const list = [q, ...recent.get().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8); localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* private mode */ } },
        clear() { try { localStorage.removeItem(RECENT_KEY); } catch { /* */ } },
    };

    async function suggest(q, { owner = null, limit = 8, signal, url = SUGGEST } = {}) {
        const u = new URL(url || SUGGEST);
        u.searchParams.set('q', String(q).slice(0, 100));
        if (owner) u.searchParams.set('owner', owner);
        u.searchParams.set('limit', String(limit));
        const res = await fetch(u, { signal, credentials: 'omit', headers: { accept: 'application/json' } });
        if (!res.ok) return [];
        const d = await res.json();
        return (d.suggestions || []).map((s) => ({ owner: s.owner, type: s.type, id: s.id, title: String(s.title || '').slice(0, 160), url: safeUrl(s.canonical_url), site: siteOf(s.canonical_url) })).filter((s) => s.url && s.title);
    }

    function styles() {
        if (document.getElementById('openvibe-search-styles')) return;
        const st = document.createElement('style');
        st.id = 'openvibe-search-styles';
        st.textContent = `
.ovs { position: fixed; inset: 0; z-index: 10020; display: none; background: rgba(3, 6, 12, .55); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: var(--text-primary, #e8ecf3); }
.ovs.is-open { display: block; animation: ovs-in .14s ease-out; }
.ovs-panel { position: absolute; left: 50%; top: 10vh; width: min(640px, calc(100vw - 32px)); max-height: 76vh; transform: translateX(-50%); display: flex; flex-direction: column; border-radius: 18px; border: 1px solid var(--border, rgba(255,255,255,.12)); background: var(--bg-secondary, #121826); box-shadow: 0 30px 80px rgba(0,0,0,.55); overflow: hidden; }
.ovs-bar { display: flex; align-items: center; gap: 10px; padding: 6px 8px 6px 16px; border-bottom: 1px solid var(--border, rgba(255,255,255,.1)); }
.ovs-bar svg { width: 18px; height: 18px; flex: none; color: var(--text-muted, #93a0b4); }
.ovs-input { flex: 1; min-width: 0; height: 48px; border: 0; outline: 0; background: transparent; color: inherit; font: inherit; font-size: 17px; }
.ovs-input::-webkit-search-cancel-button { -webkit-appearance: none; }
.ovs-x { flex: none; height: 36px; padding: 0 12px; border: 0; border-radius: 10px; background: transparent; color: var(--text-muted, #93a0b4); font: inherit; font-size: 13px; cursor: pointer; }
.ovs-x:hover { background: var(--bg-hover, rgba(255,255,255,.06)); color: inherit; }
.ovs-list { list-style: none; margin: 0; padding: 6px; overflow-y: auto; overscroll-behavior: contain; }
.ovs-group { padding: 10px 10px 4px; font-size: 11px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: var(--text-muted, #93a0b4); }
.ovs-group button { float: right; border: 0; background: none; color: var(--accent-light, #8ab4ff); font: inherit; font-size: 11px; text-transform: none; letter-spacing: 0; cursor: pointer; }
.ovs-item a { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 6px 10px; border-radius: 12px; color: inherit; text-decoration: none; }
.ovs-item.is-active a, .ovs-item a:hover { background: var(--bg-hover, rgba(255,255,255,.07)); }
.ovs-ic { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); color: var(--accent-light, #8ab4ff); font-size: 12px; font-weight: 800; }
.ovs-ic svg { width: 16px; height: 16px; }
.ovs-main { flex: 1; min-width: 0; display: grid; gap: 1px; }
.ovs-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; font-weight: 600; }
.ovs-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; color: var(--text-muted, #93a0b4); }
.ovs-key { flex: none; font-size: 11px; color: var(--text-muted, #93a0b4); }
.ovs-note { padding: 14px 12px; font-size: 13px; color: var(--text-muted, #93a0b4); }
.ovs-busy .ovs-bar { background-image: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent, #3b82f6) 40%, transparent), transparent); background-size: 40% 2px; background-repeat: no-repeat; background-position: -40% 100%; animation: ovs-scan 1s linear infinite; }
@keyframes ovs-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes ovs-scan { to { background-position: 140% 100%; } }
@media (max-width: 640px) { .ovs-panel { top: 0; left: 0; width: 100vw; height: 100dvh; max-height: none; transform: none; border-radius: 0; border: 0; } .ovs-key { display: none; } }
@media (prefers-reduced-motion: reduce) { .ovs.is-open, .ovs-busy .ovs-bar { animation: none; } }`;
        document.head.appendChild(st);
    }

    const ICON = {
        search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
        clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
        go: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>',
        spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/></svg>',
    };

    function build() {
        styles();
        el = document.createElement('div');
        el.className = 'ovs';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-label', 'Search OpenVibe');
        el.innerHTML = `<div class="ovs-panel"><div class="ovs-bar">${ICON.search}<input class="ovs-input" type="search" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="ovs-list" autocomplete="off" spellcheck="false" enterkeyhint="search" maxlength="100"><button type="button" class="ovs-x">Close</button></div><ul class="ovs-list" id="ovs-list" role="listbox"></ul></div>`;
        input = el.querySelector('.ovs-input');
        listEl = el.querySelector('.ovs-list');
        el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
        el.querySelector('.ovs-x').addEventListener('click', close);
        input.addEventListener('input', () => schedule(input.value));
        input.addEventListener('keydown', onKey);
        listEl.addEventListener('click', (e) => {
            const clear = e.target.closest && e.target.closest('[data-ovs-clear]');
            if (clear) { e.preventDefault(); recent.clear(); render(''); input.focus(); return; }
            const a = e.target.closest && e.target.closest('a[data-i]');
            if (a) remember(items[Number(a.getAttribute('data-i'))]);
        });
        document.body.appendChild(el);
    }

    function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!items.length) return;
            active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            paintActive();
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            const it = items[active >= 0 ? active : 0];
            if (it) { remember(it); location.href = it.url; }
        }
    }
    function remember(it) {
        const q = input && input.value.trim();
        if (q && it && it.kind !== 'recent') recent.add(q);
    }
    function paintActive() {
        Array.prototype.forEach.call(listEl.querySelectorAll('.ovs-item'), (li, i) => {
            const on = i === active;
            li.classList.toggle('is-active', on);
            li.setAttribute('aria-selected', on ? 'true' : 'false');
            if (on) { input.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
        });
    }

    /** The rows: groups of items { title, meta, url, icon, kind }; rendered with textContent only. */
    function paint(groups, note) {
        items = [];
        listEl.textContent = '';
        groups.filter((g) => g.items.length).forEach((g) => {
            const h = document.createElement('li');
            h.className = 'ovs-group';
            h.setAttribute('role', 'presentation');
            h.textContent = g.title;
            if (g.clear) { const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Clear'; b.setAttribute('data-ovs-clear', ''); h.appendChild(b); }
            listEl.appendChild(h);
            g.items.forEach((it) => {
                const i = items.length;
                items.push(it);
                const li = document.createElement('li');
                li.className = 'ovs-item';
                li.id = `ovs-o${i}`;
                li.setAttribute('role', 'option');
                const a = document.createElement('a');
                a.href = it.url;
                a.setAttribute('data-i', String(i));
                a.tabIndex = -1;
                const ic = document.createElement('span');
                ic.className = 'ovs-ic';
                if (ICON[it.icon]) ic.innerHTML = ICON[it.icon]; else ic.textContent = (it.icon || '•').slice(0, 2);
                const main = document.createElement('span');
                main.className = 'ovs-main';
                const t = document.createElement('span'); t.className = 'ovs-title'; t.textContent = it.title;
                main.appendChild(t);
                if (it.meta) { const m = document.createElement('span'); m.className = 'ovs-meta'; m.textContent = it.meta; main.appendChild(m); }
                a.append(ic, main);
                if (i === 0) { const k = document.createElement('span'); k.className = 'ovs-key'; k.textContent = 'Enter'; a.appendChild(k); }
                li.appendChild(a);
                listEl.appendChild(li);
            });
        });
        if (note) { const n = document.createElement('li'); n.className = 'ovs-note'; n.setAttribute('role', 'presentation'); n.textContent = note; listEl.appendChild(n); }
        active = items.length ? 0 : -1;
        paintActive();
    }

    const here = () => (ctx.scope && ctx.scope.label) || document.title.split(/[·|–-]/).pop().trim() || location.hostname;
    function pagesOf(q) {
        const n = q.toLowerCase();
        return (ctx.links || []).filter((l) => l && l.label && typeof l.href === 'string' && !l.hidden && (!n || l.label.toLowerCase().includes(n)))
            .slice(0, n ? 4 : 6).map((l) => ({ title: l.label, meta: `Go to · ${here()}`, url: safeUrl(l.href), icon: 'go', kind: 'page' })).filter((x) => x.url);
    }
    function actions(q) {
        const out = [];
        if (ctx.scope && ctx.scope.page) {
            const u = safeUrl(`${ctx.scope.page}${ctx.scope.page.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}`);
            if (u) out.push({ title: `Search “${q}” on ${here()}`, meta: 'This site\'s own search', url: u, icon: 'search', kind: 'action' });
        }
        out.push({ title: `Search “${q}” on all of OpenVibe`, meta: 'Every site, in OpenVibe.Search', url: `${API}/?q=${encodeURIComponent(q)}`, icon: 'search', kind: 'action' });
        out.push({ title: `Ask Vibe: “${q}”`, meta: 'OpenVibe\'s assistant searches the web and OpenVibe', url: `https://openvibe.chat/vibe?ask=${encodeURIComponent(q)}`, icon: 'spark', kind: 'action' });
        return out;
    }

    function render(q) {
        q = String(q || '').trim();
        if (!q) {
            const r = recent.get();
            paint([
                { title: 'Recent', clear: true, items: r.map((x) => ({ title: x, meta: 'Search again', url: `${API}/?q=${encodeURIComponent(x)}`, icon: 'clock', kind: 'recent' })) },
                { title: `On ${here()}`, items: pagesOf('') },
            ], r.length ? '' : 'Search streams, recordings, jobs, posts, deals, wikis and more, on every OpenVibe site.');
            return;
        }
        paint([{ title: `On ${here()}`, items: pagesOf(q) }, { title: 'Search', items: actions(q) }], 'Looking…');
        if (inflight) inflight.abort();
        const ac = new AbortController();
        inflight = ac;
        el.classList.add('ovs-busy');
        suggest(q, { limit: 10, signal: ac.signal, url: ctx.suggestUrl }).then((found) => {
            if (ac.signal.aborted) return;
            const owner = ctx.scope && ctx.scope.owner;
            const row = (s) => ({ title: s.title, meta: [s.site, TYPE[s.type] || s.type].filter(Boolean).join(' · '), url: s.url, icon: (s.site || '?').slice(0, 2), kind: 'result' });
            const mine = owner ? found.filter((s) => s.owner === owner) : [];
            const rest = found.filter((s) => !mine.includes(s));
            paint([
                { title: `On ${here()}`, items: [...mine.map(row), ...pagesOf(q)] },
                { title: 'Across OpenVibe', items: rest.map(row) },
                { title: 'Search', items: actions(q) },
            ], found.length ? '' : 'Nothing starts with that yet: search everywhere, or ask Vibe.');
        }).catch(() => { if (!ac.signal.aborted) paint([{ title: `On ${here()}`, items: pagesOf(q) }, { title: 'Search', items: actions(q) }], ''); })
            .finally(() => { if (inflight === ac) { inflight = null; if (el) el.classList.remove('ovs-busy'); } });
    }
    function schedule(q) { clearTimeout(timer); timer = setTimeout(() => render(q), String(q).trim() ? 140 : 0); }

    function open(opts = {}) {
        if (typeof document === 'undefined') return;
        ctx = opts || {};
        if (!el) build();
        lastFocus = document.activeElement;
        el.classList.add('is-open');
        document.documentElement.style.overflow = 'hidden';
        input.placeholder = `Search ${here()} and all of OpenVibe`;
        input.value = opts.q || '';
        render(input.value);
        setTimeout(() => input.focus(), 0);
    }
    function close() {
        if (!el) return;
        el.classList.remove('is-open');
        document.documentElement.style.overflow = '';
        if (inflight) { inflight.abort(); inflight = null; }
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    const api = { open, close, suggest, siteOf };
    root.OpenVibeSearch = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
