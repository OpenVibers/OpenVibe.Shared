/**
 * openvibe-shared/search.js — the OpenVibe menu: search, every site and every tool in one panel, opened by the navbar's
 * magnifier, "/" or Ctrl+K (4.23.0). The navbar loads this file the first time someone asks.
 *
 * It used to be two panels side by side, the launcher (the dots: every site) and search (the magnifier), which "kind
 * of accomplish the same exact thing" (the owner, 2026-10-28: "combine… what are the most important things… a better
 * hierarchy… use this user's history… input history and autocomplete… to give them better results… maybe use tabs").
 *
 * Before typing, three tabs:
 *   For you  the places this person went lately anywhere on OpenVibe (their Network history, signed in), this site's
 *            pages, their recent searches, and their sites (most used by them, else most used by everyone: the Frame's
 *            analytics ranking).
 *   Sites    every OpenVibe site by what people come to do (the Frame's groups), the one you are on marked.
 *   Tools    the tool families and the most used tools (OpenVibe.Tools' catalog).
 * Typing makes one list: sites and tools to go to, this site's results and pages, the person's own history, the rest of
 * OpenVibe.Search (sites they use most first), their recent searches, and "search everywhere" / "Ask Vibe". The box
 * completes what they type from their own searches, history and the site names (Tab or → takes it).
 *
 * Enter shows every result in the panel (4.29.0, the Search Fabric, plan 2026-10-28 §4.5), unless a row was picked with the
 * arrows or the text is a place's exact name (live, tools): tabs All · OpenVibe · Web · Video · News · Products (· Yours,
 * signed in). OpenVibe's results come at once (Network's GET /api/frame/query, scopes network[,mine], depth quick); the
 * web's arrive on their own (scope web) with skeleton rows meanwhile, each saying where it came from ("via Wikipedia").
 * A line at the end says what was searched and how long it took. The person's token goes along, so their own results
 * and the paid web providers are theirs; the query is never written into the page as markup.
 *
 *   OpenVibeSearch.open({ service, scope: { owner, label, page }, links, q, tab, frame, token, apiBase, user,
 *                         suggestUrl, icons })   navbar.js calls it
 *   OpenVibeSearch.close()
 *   OpenVibeSearch.suggest(q, { owner, limit, signal, url }) → [{ owner, type, id, title, url, site }]   for any page's own box
 *     (url: https://openvibe.network/api/frame/suggest, or https://search.openvibe.network/api/v1/suggest where the
 *     page's connect-src allows it; both answer any origin)
 *
 * Suggestions come through OpenVibe.Network's GET /api/frame/suggest (OpenVibe.Search, kept 30 s): every site's
 * Content-Security-Policy lets the navbar reach openvibe.network. History is GET /api/history (the person's own token,
 * read once a panel opening, kept two minutes). Text is always set with textContent; links are https or same-site paths
 * only. Recent searches live in localStorage (ov_search_recent, eight at most) and can be cleared from the panel.
 */
(function (root) {
    'use strict';
    const API = 'https://search.openvibe.network';
    const SUGGEST = 'https://openvibe.network/api/frame/suggest';
    const CATALOG_URL = 'https://openvibe.network/api/catalog.json';
    const TOOLS_SEARCH = 'https://openvibe.tools/search?q=';
    const RECENT_KEY = 'ov_search_recent';
    const SITE = { 'openre.stream': 'Restream', 'search.openvibe.network': 'Search', 'ai.openvibe.services': 'AI' };
    const TYPE = { vod: 'Recording', clip: 'Clip', job: 'Job', story: 'Story', page: 'Page', thread: 'Thread', paste: 'Paste', post: 'Post', stream: 'Live', channel: 'Channel', deal: 'Deal', coupon: 'Code', review: 'Review', entity: 'Reviews', recipe: 'Recipe', game: 'Game', tool: 'Tool', listing: 'Listing', wiki: 'Wiki' };
    // Until the Frame answers (or when it cannot): the network's main sites and the tool families.
    const FALLBACK_SITES = [
        { id: 'live', name: 'Live', desc: 'Go live, watch streams', icon: 'live', url: 'https://openvibe.live/' },
        { id: 'chat', name: 'Chat', desc: 'Rooms, servers and messages', icon: 'chat', url: 'https://openvibe.chat/' },
        { id: 'games', name: 'Games', desc: 'Browser games', icon: 'games', url: 'https://openvibe.games/' },
        { id: 'tools', name: 'Tools', desc: 'Every online tool', icon: 'tools', url: 'https://openvibe.tools/' },
        { id: 'community', name: 'Community', desc: 'Forum, pastes and posts', icon: 'community', url: 'https://openvibe.community/' },
        { id: 'network', name: 'Network', desc: 'Your account and themes', icon: 'network', url: 'https://openvibe.network/' },
    ];
    const FALLBACK_FAMILIES = [
        { name: 'Media Tools', icon: 'youtube', url: 'https://yt.openvibe.tools/' },
        { name: 'Image Tools', icon: 'image', url: 'https://img.openvibe.tools/' },
        { name: 'Audio Tools', icon: 'audio', url: 'https://audio.openvibe.tools/' },
        { name: 'PDF & Documents', icon: 'pdf', url: 'https://docs.openvibe.tools/' },
        { name: 'Text Tools', icon: 'text', url: 'https://text.openvibe.tools/' },
        { name: 'Developer Tools', icon: 'code', url: 'https://dev.openvibe.tools/' },
        { name: 'Network Tools', icon: 'dns', url: 'https://net.openvibe.tools/' },
    ];
    // The menu's three tabs (the owner, 11-08: "we should have tabs at the top … a feed tab … remember whichever tab the
    // user last had open … the main tab should just show links that exist on that site, and under that the full list
    // of sites"). The first is labelled with this site's own name.
    const TABS = [['here', ''], ['feed', 'Feed'], ['you', 'You']];
    const TAB_KEY = 'ovs-tab';
    const savedTab = () => { try { const v = localStorage.getItem(TAB_KEY); return TABS.some(([id]) => id === v) ? v : null; } catch { return null; } };
    const saveTab = (v) => { try { localStorage.setItem(TAB_KEY, v); } catch { /* private window */ } };
    let el = null, input = null, ghost = null, listEl = null, tabsEl = null, ctx = {}, items = [], active = -1, inflight = null, timer = null, lastFocus = null;
    let tab = 'here', mine = null, catalog = null, completion = '';
    // The results view (4.29.0): Enter shows the Search Fabric's answer here, by scope, instead of leaving the page.
    const RTABS = [['all', 'All'], ['openvibe', 'OpenVibe'], ['web', 'Web'], ['video', 'Video'], ['news', 'News'], ['products', 'Products'], ['mine', 'Yours']];
    const PROVIDER = { open_index: 'OpenVibe\'s index', deepseek: 'DeepSeek', wikipedia: 'Wikipedia', brave: 'Brave', exa: 'Exa', tavily: 'Tavily' };
    let view = 'suggest', rtabsEl = null, rq = '', rtab = 'all', rflight = null, moved = false;

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
    const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
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

    // ── What the panel knows ─────────────────────────────────
    /** Every open site from the Frame (most used across OpenVibe first), else the main ones. */
    function sites() {
        const f = ctx.frame;
        if (f && Array.isArray(f.nav) && f.nav.length) return f.nav.map((n) => ({ id: n.id, name: n.name, desc: String(n.tagline || '').replace(/\.\s*$/, ''), icon: n.icon || n.id, url: safeUrl(n.url), group: n.group })).filter((s) => s.url);
        return FALLBACK_SITES;
    }
    /** The site this page belongs to: the longest matching host (play.openvibe.network is Play, not Network). */
    function hereSite(list) {
        const h = location.hostname.toLowerCase(); let best = null, len = 0;
        for (const s of list) { const sh = hostOf(s.url); if (sh && (h === sh || h.endsWith(`.${sh}`)) && sh.length > len) { best = s; len = sh.length; } }
        return best;
    }
    /** The person's own use of each site (their history's counts), for "your sites" and for ranking results. */
    const useOf = (id) => { const s = mine && mine.services.find((x) => x.service === id); return s ? s.count : 0; };

    /** The person's history: one request per opening, kept two minutes (signed in only; anonymous sessions keep none). */
    async function loadHistory() {
        if (!ctx.token || !ctx.user || ctx.user.is_anon) return null;
        const key = `ov_hist:${ctx.user.id || ctx.user.username || ''}`;
        try { const c = JSON.parse(sessionStorage.getItem(key) || 'null'); if (c && Date.now() - c.at < 120000) return c.data; } catch { /* */ }
        try {
            const r = await fetch(`${ctx.apiBase || 'https://openvibe.network'}/api/history?limit=60`, { headers: { Authorization: `Bearer ${ctx.token}` }, credentials: 'omit' });
            if (!r.ok) return null;
            const j = await r.json();
            const data = {
                items: (j.items || []).map((h) => ({ title: String(h.title || '').slice(0, 160), url: safeUrl(h.url), site: h.service_label || siteOf(h.url), service: h.service, at: h.updated_at })).filter((h) => h.url && h.title),
                services: (j.services || []).map((s) => ({ service: String(s.service || ''), count: Number(s.count) || 0 })),
            };
            try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* */ }
            return data;
        } catch { return null; }
    }
    /** OpenVibe.Tools' catalog (families and tools), kept 30 minutes; the same copy the navbar used to keep. */
    async function loadCatalog() {
        try { const c = JSON.parse(sessionStorage.getItem('ov_catalog2') || 'null'); if (c && Date.now() - c.at < 30 * 60000) return c.data; } catch { /* */ }
        try {
            const r = await fetch(CATALOG_URL, { credentials: 'omit' }); if (!r.ok) return null;
            const j = await r.json();
            const ok = (u) => { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : null; } catch { return null; } };
            const data = {
                families: (j.families || []).slice(0, 12).map((f) => ({ name: String(f.name || ''), icon: String(f.icon || 'tools'), url: ok(f.url) })).filter((f) => f.name && f.url),
                tools: (j.tools || []).slice(0, 400).map((t) => ({ name: String(t.name || ''), icon: String(t.icon || 'tools'), url: ok(t.url), go: t.hosts && t.hosts.short ? ok(`https://${t.hosts.short}/`) : null,
                    hosts: [t.hosts && t.hosts.short, t.hosts && t.hosts.canonical].concat((t.hosts && t.hosts.mirrors) || [], (t.hosts && t.hosts.aliases) || []).filter((h) => typeof h === 'string' && h), id: String(t.id || ''),
                    desc: String(t.tagline || '').slice(0, 120), k: [t.name, t.tagline].concat(t.keywords || []).join(' ').toLowerCase().slice(0, 400) })).filter((t) => t.name && t.url),
            };
            try { sessionStorage.setItem('ov_catalog2', JSON.stringify({ at: Date.now(), data })); } catch { /* */ }
            return data;
        } catch { return null; }
    }

    function ago(iso) {
        const t = Date.parse(iso || ''); if (!isFinite(t)) return '';
        const m = Math.max(0, Math.round((Date.now() - t) / 60000));
        return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
    }

    // ── Drawing ──────────────────────────────────────────────
    function styles() {
        if (document.getElementById('openvibe-search-styles')) return;
        const st = document.createElement('style');
        st.id = 'openvibe-search-styles';
        st.textContent = `
.ovs { position: fixed; inset: 0; z-index: 10020; display: none; background: rgba(3, 6, 12, .55); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: var(--text-primary, #e8ecf3); }
.ovs.is-open { display: block; animation: ovs-in .14s ease-out; }
.ovs-panel { position: absolute; left: 50%; top: 8vh; width: min(720px, calc(100vw - 32px)); max-height: 80vh; transform: translateX(-50%); display: flex; flex-direction: column; border-radius: 18px; border: 1px solid var(--border, rgba(255,255,255,.12)); background: var(--bg-secondary, #121826); box-shadow: 0 30px 80px rgba(0,0,0,.55); overflow: hidden; }
.ovs-bar { display: flex; align-items: center; gap: 10px; margin: 10px 10px 6px; padding: 0 6px 0 14px; border-radius: 999px; background: var(--bg-primary, rgba(0,0,0,.25)); box-shadow: inset 0 0 0 1px var(--border, rgba(255,255,255,.12)); transition: box-shadow .2s, background .2s; }
.ovs-bar:focus-within { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--accent, #3b82f6) 70%, transparent), 0 0 0 4px color-mix(in srgb, var(--accent, #3b82f6) 15%, transparent); }
/* A site's own focus ring (the orange box on openvibe.download, 10-29) never draws on the field: the pill shows focus. */
.ovs .ovs-input, .ovs .ovs-input:focus, .ovs .ovs-input:focus-visible { outline: none !important; box-shadow: none !important; border: 0 !important; background: transparent !important; }
.ovs-bar > svg { width: 18px; height: 18px; flex: none; color: var(--text-muted, #93a0b4); }
.ovs-field { position: relative; flex: 1; min-width: 0; display: flex; }
.ovs-input, .ovs-ghost { height: 48px; font: inherit; font-size: 17px; letter-spacing: normal; }
.ovs-input { position: relative; z-index: 1; flex: 1; min-width: 0; border: 0; outline: 0; padding: 0; background: transparent; color: inherit; }
.ovs-input::-webkit-search-cancel-button { -webkit-appearance: none; }
.ovs-ghost { position: absolute; inset: 0; display: flex; align-items: center; white-space: pre; overflow: hidden; pointer-events: none; color: var(--text-muted, #93a0b4); opacity: .75; }
.ovs-ghost b { color: transparent; font-weight: inherit; }
.ovs-x { flex: none; height: 36px; padding: 0 12px; border: 0; border-radius: 10px; background: transparent; color: var(--text-muted, #93a0b4); font: inherit; font-size: 13px; cursor: pointer; }
.ovs-x svg { display: none; width: 20px; height: 20px; }
.ovs-x:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
/* Phones and small windows: the menu covers the screen (the bar under it too), so Close is always there, a round x at
   the end of the search pill (the owner, 11-07: "This needs a close button"). The hit area is 48 px. */
@media (max-width: 860px) {
  .ovs-x { position: relative; display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border-radius: 50%; background: var(--bg-hover, rgba(255,255,255,.07)); color: var(--text-secondary, #a8b3c4); }
  .ovs-x::after { content: ""; position: absolute; inset: -4px; }
  .ovs-x svg { display: block; }
  .ovs-x span { display: none; }
  .ovs-x:active { background: var(--bg-active, rgba(255,255,255,.14)); color: var(--text-primary, #fff); }
}
.ovs-tabs { display: flex; gap: 4px; padding: 0 12px 8px; border-bottom: 1px solid var(--border, rgba(255,255,255,.1)); }
/* The menu's three tabs (4.149.0): one segmented row under the field; the chosen one in the accent. */
.ovs-starttabs { gap: 6px; padding: 2px 12px 10px; }
.ovs-starttabs .ovs-tab { flex: 1 1 0; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 38px; padding: 0 10px; border-radius: 12px; font-size: 14px; background: color-mix(in srgb, var(--text-primary, #e6edf7) 5%, transparent); }
.ovs-starttabs .ovs-tab span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovs-tabdot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--live-red, #ef4444); box-shadow: 0 0 0 3px color-mix(in srgb, var(--live-red, #ef4444) 22%, transparent); }
.ovs-grid.is-mini { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; padding: 0 2px 4px; }
.ovs-grid.is-mini .ovs-tile { gap: 8px; min-height: 40px; padding: 4px 8px; border-radius: 10px; }
.ovs-grid.is-mini .ovs-ic { width: 26px; height: 26px; border-radius: 8px; }
.ovs-grid.is-mini .ovs-tile b { font-size: 13px; font-weight: 600; }
.ovs-tabs[hidden] { display: none; }
.ovs-tab { flex: none; height: 32px; padding: 0 14px; border: 0; border-radius: 999px; background: transparent; color: var(--text-secondary, #a8b3c4); font: inherit; font-size: 13.5px; font-weight: 650; cursor: pointer; }
.ovs-tab[aria-selected="true"] { background: color-mix(in srgb, var(--accent, #3b82f6) 18%, transparent); color: var(--accent-light, var(--accent, #8ab4ff)); }
.ovs-tab:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 1px; }
.ovs-typing .ovs-bar { border-bottom: 0; }
/* Opening, the groups rise in one after another (not while typing: every key redraws the list). */
.ovs:not(.ovs-typing) .ovs-list > li { animation: ovs-rise .32s cubic-bezier(.2, 1.2, .3, 1) both; }
.ovs-list > li:nth-child(2) { animation-delay: 25ms; } .ovs-list > li:nth-child(3) { animation-delay: 50ms; } .ovs-list > li:nth-child(4) { animation-delay: 75ms; }
.ovs-list > li:nth-child(5) { animation-delay: 100ms; } .ovs-list > li:nth-child(6) { animation-delay: 125ms; } .ovs-list > li:nth-child(n+7) { animation-delay: 150ms; }
@keyframes ovs-rise { from { opacity: 0; transform: translateY(6px); } }
.ovs-list { list-style: none; margin: 0; padding: 6px; overflow-y: auto; overscroll-behavior: contain; }
.ovs-group { display: flex; align-items: center; gap: 8px; padding: 10px 10px 4px; font-size: 11px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: var(--text-muted, #93a0b4); }
.ovs-group button { margin-left: auto; border: 0; background: none; color: var(--accent-light, #8ab4ff); font: inherit; font-size: 11.5px; font-weight: 650; text-transform: none; letter-spacing: 0; cursor: pointer; }
.ovs-item a { display: flex; align-items: center; gap: 12px; min-height: 46px; padding: 5px 10px; border-radius: 12px; color: inherit; text-decoration: none; }
.ovs-opt.is-active, .ovs-opt:focus-visible { background: var(--bg-hover, rgba(255,255,255,.07)); outline: none; }
/* A tap leaves :hover on what it touched: rows light on hover only where a pointer really hovers. */
@media (hover: hover) { .ovs-item a:hover, .ovs-chip:hover, .ovs-tile:hover, .ovs-x:hover, .ovs-tab:hover { background: var(--bg-hover, rgba(255,255,255,.07)); color: inherit; } }
.ovs-ic { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); color: var(--accent-light, #8ab4ff); font-size: 12px; font-weight: 800; }
.ovs-ic > svg { width: 16px; height: 16px; }
.ovs-ic.ovs-site { background: none; }
.ovs-thumb { flex: none; width: 72px; height: 40px; border-radius: 9px; object-fit: cover; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 6%, transparent); }
.ovs-thumb--ico { display: grid; place-items: center; }
.ovs .ov-icon:empty { border-radius: 50%; box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--accent, #3b82f6) 26%, transparent); background: color-mix(in srgb, var(--accent, #3b82f6) 10%, transparent); }
.ovs-main { flex: 1; min-width: 0; display: grid; gap: 1px; }
.ovs-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; font-weight: 600; }
.ovs-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; color: var(--text-muted, #93a0b4); }
.ovs-key { flex: none; font-size: 11px; color: var(--text-muted, #93a0b4); }
.ovs-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 8px 6px; }
.ovs-chip { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; height: 34px; padding: 0 13px; border-radius: 999px; border: 1px solid var(--border, rgba(255,255,255,.12)); color: inherit; text-decoration: none; font-size: 13.5px; font-weight: 600; box-sizing: border-box; }
.ovs-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovs-chip svg { width: 14px; height: 14px; flex: none; color: var(--text-muted, #93a0b4); }
.ovs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 4px; padding: 2px 4px 6px; }
.ovs-grid.is-sites { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
.ovs-tile { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 8px 10px; border-radius: 12px; border: 1px solid transparent; color: inherit; text-decoration: none; }
.ovs-tile > span:last-child { min-width: 0; }
.ovs-tile b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; font-weight: 650; }
.ovs-tile small { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 11.5px; line-height: 1.3; color: var(--text-muted, #93a0b4); }
.ovs-tile.is-here { border-color: color-mix(in srgb, var(--accent, #3b82f6) 55%, transparent); background: color-mix(in srgb, var(--accent, #3b82f6) 12%, transparent); }
.ovs-note { padding: 14px 12px; font-size: 13px; color: var(--text-muted, #93a0b4); }
/* The menu before typing (4.128.0): the places dock, this site's pages, the live bar, counted folds. */
.ovs-apps { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 2px; padding: 2px 2px 6px; }
.ovs-app { display: flex; flex-direction: column; align-items: center; gap: 7px; min-width: 0; padding: 10px 2px 8px; border-radius: 16px; color: inherit; text-decoration: none; }
.ovs .ovs-appic { width: 54px; height: 54px; border-radius: 17px; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 6%, transparent); box-shadow: inset 0 0 0 1px var(--border, rgba(255,255,255,.1)); transition: transform .18s cubic-bezier(.2,1.4,.4,1), box-shadow .18s; }
.ovs-appname { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; font-weight: 650; color: var(--text-secondary, #a8b3c4); }
.ovs-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 6px; padding: 0 2px 2px; }
.ovs-link { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 44px; padding: 0 10px; border-radius: 12px; color: inherit; text-decoration: none; font-size: 14px; font-weight: 600; }
.ovs-link svg { width: 16px; height: 16px; flex: none; color: var(--text-muted, #93a0b4); }
.ovs-link span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovs-link.is-here { background: color-mix(in srgb, var(--accent, #3b82f6) 14%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, #3b82f6) 42%, transparent); color: var(--text-primary, #e6edf3); }
.ovs-link.is-here svg { color: var(--accent, #3b82f6); }
.ovs-livebar { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 8px 6px 2px; }
.ovs-livebar::-webkit-scrollbar { display: none; }
.ovs-live { flex: none; display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--border, rgba(255,255,255,.12)); color: inherit; text-decoration: none; font-size: 13.5px; font-weight: 650; }
.ovs-live.is-count { border-color: color-mix(in srgb, var(--danger, #ef4444) 45%, transparent); background: color-mix(in srgb, var(--danger, #ef4444) 10%, transparent); }
.ovs-live small { color: var(--text-muted, #93a0b4); font-size: 12px; font-weight: 600; }
.ovs-livedot { width: 8px; height: 8px; flex: none; border-radius: 50%; background: var(--danger, #ef4444); animation: ovs-livedot 1.6s ease-in-out infinite; }
@keyframes ovs-livedot { 50% { opacity: .4; transform: scale(.75); } }
.ovs-foldrow { padding: 6px 4px 2px; }
.ovs-fold { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px; padding: 0 12px; border-radius: 12px; border: 1px dashed var(--border, rgba(255,255,255,.16)); background: transparent; color: var(--text-secondary, #a8b3c4); font: inherit; font-size: 13.5px; font-weight: 650; text-align: left; cursor: pointer; }
.ovs-fold svg { width: 16px; height: 16px; flex: none; transition: transform .2s; }
.ovs-feeds { display: grid; gap: 4px; padding: 4px 6px 8px; }
.ovs-feed { display: grid; grid-template-columns: minmax(0, 1fr) 40px 40px; align-items: center; gap: 4px; padding: 4px 4px 4px 10px; border-radius: 12px; background: color-mix(in srgb, var(--text-primary, #e8ecf3) 4%, transparent); }
.ovs-feed label { display: flex; align-items: center; gap: 12px; min-height: 44px; min-width: 0; cursor: pointer; }
.ovs-feed input { width: 18px; height: 18px; flex: none; accent-color: var(--accent, #3b82f6); }
.ovs-feed label span { display: grid; min-width: 0; }
.ovs-feed b { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovs-feed small { font-size: 12px; color: var(--text-muted, #8b95a7); text-transform: capitalize; }
.ovs-feed button { width: 40px; height: 40px; border: 0; border-radius: 10px; background: transparent; color: var(--text-secondary, #a8b3c4); font: inherit; font-size: 16px; cursor: pointer; }
.ovs-feed button:hover:not(:disabled) { background: color-mix(in srgb, var(--text-primary, #e8ecf3) 8%, transparent); }
.ovs-feed button:disabled { opacity: .3; cursor: default; }
.ovs-feeds-note { margin: 2px 6px 0; font-size: 12px; color: var(--text-muted, #8b95a7); }
.ovs-fold[aria-expanded="true"] svg { transform: rotate(90deg); }
.ovs-fold:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 1px; }
.ovs-tag { margin-left: 7px; padding: 1px 7px; border-radius: 999px; font-style: normal; font-size: 10.5px; font-weight: 800; letter-spacing: .03em; vertical-align: 1px; color: color-mix(in srgb, var(--accent, #3b82f6) 72%, var(--text-primary, #e8ecf3)); background: color-mix(in srgb, var(--accent, #3b82f6) 15%, transparent); }
.ovs-card { padding: 2px 6px 6px; }
.ovs-cardbody { border-radius: 16px; border: 1px solid var(--border, rgba(255,255,255,.12)); background: color-mix(in srgb, var(--text-primary, #e8ecf3) 4%, transparent); padding: 12px 14px; }
.ovs-displayrow { padding: 4px 8px 10px; }
.ovs-displayrow .ovnav-display { margin-top: 4px; }
.ovs-host { display: block; margin-top: 2px; font-size: 11px; font-weight: 650; letter-spacing: .01em; color: color-mix(in srgb, var(--accent, #3b82f6) 60%, var(--text-muted, #93a0b4)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovs-group .ovs-more { margin-left: auto; color: var(--accent-light, #8ab4ff); font-size: 11.5px; font-weight: 650; text-transform: none; letter-spacing: 0; text-decoration: none; }
@media (hover: hover) { .ovs-app:hover, .ovs-link:hover, .ovs-live:hover, .ovs-fold:hover { background: var(--bg-hover, rgba(255,255,255,.07)); color: inherit; } .ovs-app:hover .ovs-appic { transform: translateY(-2px); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, #3b82f6) 45%, transparent); } }
@media (max-width: 640px) { .ovs-apps { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (pointer: coarse) { .ovs-chip { height: 44px; } .ovs-group button, .ovs-group .ovs-more { min-height: 44px; display: inline-flex; align-items: center; } }
@media (prefers-reduced-motion: reduce) { .ovs-livedot { animation: none; } .ovs .ovs-appic { transition: none; } }
.ovs-foot { display: flex; gap: 14px; padding: 8px 16px; border-top: 1px solid var(--border, rgba(255,255,255,.1)); font-size: 11.5px; color: var(--text-muted, #93a0b4); }
.ovs-foot kbd { font: inherit; font-weight: 700; padding: 1px 5px; border-radius: 5px; border: 1px solid var(--border, rgba(255,255,255,.14)); }
.ovs-busy .ovs-bar { background-image: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent, #3b82f6) 40%, transparent), transparent); background-size: 40% 2px; background-repeat: no-repeat; background-position: -40% 100%; animation: ovs-scan 1s linear infinite; }
.ovs-snip { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 2px; font-size: 13px; line-height: 1.4; color: var(--text-secondary, #a8b3c4); white-space: normal; }
.ovs-results-on .ovs-item a { align-items: flex-start; padding: 9px 10px; }
.ovs-results-on .ovs-ic { margin-top: 1px; text-transform: lowercase; }
.ovs-rtabs { overflow-x: auto; scrollbar-width: none; padding-top: 8px; }
.ovs-rtabs::-webkit-scrollbar { display: none; }
.ovs-rtabs .ovs-tab[hidden] { display: none; }
.ovs-skels { display: grid; gap: 6px; padding: 4px 6px 8px; }
.ovs-skel { display: block; height: 52px; border-radius: 12px; background: linear-gradient(90deg, var(--bg-hover, rgba(255,255,255,.05)) 0%, color-mix(in srgb, var(--bg-hover, rgba(255,255,255,.05)) 40%, transparent) 50%, var(--bg-hover, rgba(255,255,255,.05)) 100%); background-size: 200% 100%; animation: ovs-shimmer 1.3s linear infinite; }
.ovs-route { padding: 10px 14px 6px; font-size: 12px; color: var(--text-muted, #93a0b4); }
@keyframes ovs-shimmer { to { background-position: -200% 0; } }
@keyframes ovs-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes ovs-scan { to { background-position: 140% 100%; } }
@media (hover: none), (max-width: 640px) { .ovs-foot, .ovs-key { display: none; } }
@media (max-width: 640px) {
  .ovs-panel { top: 0; left: 0; width: 100vw; height: 100dvh; max-height: none; transform: none; border-radius: 0; border: 0; }
  .ovs-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ovs-grid.is-sites { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ovs-grid:not(.is-sites) .ovs-tile small { -webkit-line-clamp: 1; }
}
/* Dropped from the navbar's orb (4.25.0): under the bar, from the orb's side, the bar still showing. */
.ovs.ovs-anchored { top: var(--ovs-top, 0px); background: rgba(3, 6, 12, .45); }
.ovs.ovs-anchored .ovs-panel { top: 8px; left: clamp(8px, var(--ovs-left, 12px), calc(100vw - min(720px, calc(100vw - 16px)) - 8px)); transform: none; transform-origin: 24px 0; max-height: calc(100dvh - var(--ovs-top, 0px) - 24px); animation: ovs-drop .22s cubic-bezier(.2,1.15,.3,1); }
@keyframes ovs-drop { from { opacity: 0; transform: translateY(-8px) scale(.97); } to { opacity: 1; transform: none; } }
@media (max-width: 640px) {
  /* The whole screen on a phone (the owner, 11-07: "make full use of the height, not compensate for the navbar"),
     opening as a circle that grows from the button that opened it. */
  .ovs.ovs-anchored { top: 0; }
  .ovs.ovs-anchored .ovs-panel { top: 0; left: 0; width: 100vw; height: 100dvh; max-height: none; border-radius: 0; border: 0; padding-top: env(safe-area-inset-top, 0px); animation: ovs-reveal .38s cubic-bezier(.2,.9,.25,1) both; }
}
@keyframes ovs-reveal { from { clip-path: circle(28px at var(--ovs-cx, 40px) var(--ovs-cy, 28px)); } to { clip-path: circle(150% at var(--ovs-cx, 40px) var(--ovs-cy, 28px)); } }
@keyframes ovs-fold { from { clip-path: circle(150% at var(--ovs-cx, 40px) var(--ovs-cy, 28px)); } to { clip-path: circle(20px at var(--ovs-cx, 40px) var(--ovs-cy, 28px)); } }
@keyframes ovs-fade { to { opacity: 0; } }
/* The orb, on top of the phone's menu, in the button's place (4.150.0): it glides into the search pill as the menu grows
   from it, its nine dots turning into an x (the corners and the centre stay, the edges fold away); closing, it glides
   back and the menu folds into it. */
.ovs-orb { display: none; }
@media (max-width: 640px) {
  .ovs.ovs-anchored .ovs-x { display: none; }
  .ovs.ovs-anchored .ovs-bar { padding-right: 52px; }
  .ovs.ovs-anchored .ovs-orb { position: fixed; z-index: 3; left: var(--orb-x, calc(100vw - 52px)); top: var(--orb-y, 12px); width: 40px; height: 40px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%; cursor: pointer;
    background: color-mix(in srgb, var(--accent, #3b82f6) 16%, var(--bg-primary, #0b0f19)); color: var(--text-primary, #e6edf7); -webkit-tap-highlight-color: transparent;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-light, #60a5fa) 35%, transparent), 0 6px 18px -6px color-mix(in srgb, var(--accent, #3b82f6) 70%, transparent);
    --ovo-a: var(--accent-light, var(--accent, #60a5fa)); --ovo-b: color-mix(in oklab, var(--accent, #3b82f6) 45%, #e879f9);
    transform: none; transition: transform .42s cubic-bezier(.2, 1.1, .3, 1), background-color .3s, box-shadow .3s; }
  .ovs.ovs-anchored .ovs-orb.is-from { transform: translate(var(--orb-dx, 0px), var(--orb-dy, 0px)) scale(.9); background: transparent; box-shadow: none; }
  .ovs.ovs-anchored .ovs-orb::after { content: ""; position: absolute; inset: -4px; }
  .ovs.ovs-anchored .ovs-orb:active { transform: scale(.9); }
  .ovs.ovs-anchored .ovs-orb svg { display: block; overflow: visible; }
  .ovs.is-closing .ovs-panel { animation: ovs-fold .28s cubic-bezier(.5, 0, .75, .2) both; }
  .ovs.is-closing { animation: ovs-fade .28s ease-in both; }
}
.ovs-orb .ovo-g { transform-origin: 12px 12px; transform: rotate(45deg) scale(.8); transition: transform .5s cubic-bezier(.2, 1.35, .3, 1); }
.ovs-orb .ovo-d { fill: currentColor; transform-box: fill-box; transform-origin: center; transition: fill .3s, opacity .25s, transform .32s cubic-bezier(.2, 1.4, .3, 1); }
.ovs-orb .ovo-r0 { fill: var(--ovo-a); }
.ovs-orb .ovo-r2 { opacity: .6; }
.ovs-orb.is-x .ovo-g { transform: rotate(180deg) scale(.95); }
.ovs-orb.is-x .ovo-r1 { opacity: 0; transform: scale(0); }
.ovs-orb.is-x :is(.ovo-r0, .ovo-r2) { fill: var(--ovo-a); opacity: 1; transform: scale(1.12); }
@media (prefers-reduced-motion: reduce) { .ovs.is-open, .ovs-busy .ovs-bar, .ovs.ovs-anchored .ovs-panel, .ovs-skel, .ovs-list > li { animation: none; } .ovs-orb, .ovs-orb .ovo-g, .ovs-orb .ovo-d { transition: none !important; } }`;
        document.head.appendChild(st);
    }

    const ICON = {
        search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
        close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
        clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
        go: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>',
        spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/></svg>',
        back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/></svg>',
        grid: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/></svg>',
    };

    // The orb (navbar.js draws the same nine dots): on a phone the menu covers the bar, so the menu draws the orb in the
    // button's own place, on top, and it turns into the menu's close (4.150.0, the owner: "it renders on top … turns into
    // the close button when it's open … a cool effect as it goes in and out").
    const ORB_DOTS = [[12, 12, 0], [12, 5, 1], [19, 12, 1], [12, 19, 1], [5, 12, 1], [5, 5, 2], [19, 5, 2], [19, 19, 2], [5, 19, 2]];
    const orbSvg = () => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><g class="ovo-g">${ORB_DOTS.map(([x, y, r]) => `<circle class="ovo-d ovo-r${r}" cx="${x}" cy="${y}" r="${r ? 2.15 : 2.5}"/>`).join('')}</g></svg>`;
    let orbEl = null, closing = 0;
    const phoneSheet = () => { try { return !!(el && el.classList.contains('ovs-anchored') && root.matchMedia('(max-width: 640px)').matches); } catch { return false; } };
    const calm = () => { try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.getAttribute('data-ov-motion') === 'reduced'; } catch { return false; } };

    function build() {
        styles();
        el = document.createElement('div');
        el.className = 'ovs';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-label', 'Search and every OpenVibe site');
        el.innerHTML = `<div class="ovs-panel"><div class="ovs-bar">${ICON.search}<div class="ovs-field"><span class="ovs-ghost" aria-hidden="true"></span><input class="ovs-input" type="search" role="combobox" aria-autocomplete="both" aria-expanded="true" aria-controls="ovs-list" autocomplete="off" spellcheck="false" enterkeyhint="search" maxlength="100"></div><button type="button" class="ovs-x" aria-label="Close the menu" title="Close (Esc)">${ICON.close}<span>Close</span></button></div>`
            + '<div class="ovs-tabs ovs-starttabs" hidden></div>'
            + `<div class="ovs-tabs ovs-rtabs" role="tablist" aria-label="Results from" hidden>${RTABS.map(([id, label]) => `<button type="button" class="ovs-tab" role="tab" data-rtab="${id}" aria-selected="false">${label}</button>`).join('')}</div>`
            + '<ul class="ovs-list" id="ovs-list" role="listbox"></ul><div class="ovs-foot" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Tab</kbd> complete</span><span><kbd>Esc</kbd> close</span></div></div>';
        input = el.querySelector('.ovs-input');
        ghost = el.querySelector('.ovs-ghost');
        listEl = el.querySelector('.ovs-list');
        tabsEl = el.querySelector('.ovs-tabs');
        rtabsEl = el.querySelector('.ovs-rtabs');
        rtabsEl.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-rtab]'); if (b) { showResults(rq, b.getAttribute('data-rtab')); input.focus(); } });
        el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
        el.querySelector('.ovs-x').addEventListener('click', close);
        orbEl = document.createElement('button');
        orbEl.type = 'button'; orbEl.className = 'ovs-orb'; orbEl.setAttribute('aria-label', 'Close the menu'); orbEl.title = 'Close (Esc)';
        orbEl.innerHTML = orbSvg();
        orbEl.addEventListener('click', close);
        el.appendChild(orbEl);
        tabsEl.addEventListener('click', (e) => {
            const b = e.target.closest && e.target.closest('[data-tab]'); if (!b) return;
            tab = b.getAttribute('data-tab'); saveTab(tab); render(''); listEl.scrollTop = 0;
            let touch = false; try { touch = root.matchMedia('(pointer: coarse)').matches; } catch { /* */ }
            if (touch) b.focus(); else input.focus();
        });
        input.addEventListener('input', () => { moved = false; if (view === 'results') leaveResults(); paintGhost(); schedule(input.value); });
        input.addEventListener('keydown', onKey);
        listEl.addEventListener('click', (e) => {
            const clear = e.target.closest && e.target.closest('[data-ovs-clear]');
            if (clear) { e.preventDefault(); recent.clear(); render(input.value); input.focus(); return; }
            const fold = e.target.closest && e.target.closest('[data-ovs-fold]');
            if (fold) {
                e.preventDefault();
                const key = fold.getAttribute('data-ovs-fold');
                if (key === 'all') allOpen = !allOpen; else if (key === 'here') hereOpen = !hereOpen; else if (key === 'feeds') feedsOpen = !feedsOpen;
                render(''); const back = listEl.querySelector(`[data-ovs-fold="${key}"]`); if (back) back.focus(); return;
            }
            const tick = e.target.closest && e.target.closest('[data-ovs-feed]');
            const move = e.target.closest && e.target.closest('[data-ovs-feed-move]');
            if (tick || move) {
                const shown = [...listEl.querySelectorAll('[data-ovs-feed]')];
                let on = shown.filter((x) => x.checked).map((x) => x.getAttribute('data-ovs-feed'));
                const cur = feedPref();
                if (cur) on = cur.filter((id) => on.includes(id)).concat(on.filter((id) => !cur.includes(id)));
                let focusSel = tick ? `[data-ovs-feed="${tick.getAttribute('data-ovs-feed')}"]` : null;
                if (move) {
                    e.preventDefault();
                    const [dir, id] = move.getAttribute('data-ovs-feed-move').split('|');
                    const i = on.indexOf(id), j = dir === 'up' ? i - 1 : i + 1;
                    if (i >= 0 && j >= 0 && j < on.length) { [on[i], on[j]] = [on[j], on[i]]; }
                    focusSel = `[data-ovs-feed-move="${dir}|${id}"]`;
                }
                saveFeeds(on);
                render('');
                const back = focusSel && listEl.querySelector(focusSel); if (back) back.focus();
                return;
            }
            const a = e.target.closest && e.target.closest('a[data-i]');
            const it = a && items[Number(a.getAttribute('data-i'))];
            if (it && !input.value.trim()) beacon(it, a);
            if (it && it.kind === 'dock' && root.OpenVibeNavbar && typeof root.OpenVibeNavbar.openDock === 'function' && ctx.token) {
                e.preventDefault(); close(); try { root.OpenVibeNavbar.openDock(it.dock); } catch { location.href = it.url; } return;
            }
            if (it && it.kind === 'results') { e.preventDefault(); showResults(input.value.trim()); input.focus(); return; }
            if (it && it.kind === 'recent') { e.preventDefault(); input.value = it.title; paintGhost(); showResults(it.title); input.focus(); return; }
            if (it) remember(it);
        });
        document.body.appendChild(el);
    }

    function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        if ((e.key === 'Tab' && !e.shiftKey || e.key === 'ArrowRight' && input.selectionStart === input.value.length) && completion) {
            e.preventDefault(); input.value = completion; paintGhost(); schedule(input.value); return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!items.length) return;
            moved = true;
            active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            paintActive();
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            const q = input.value.trim();
            const it = items[active >= 0 ? active : 0];
            // Enter shows every result, unless the person picked a row or typed a place's exact name (live, tools).
            if (q && !moved && view !== 'results' && !exact(it, q)) { showResults(q); return; }
            if (it && it.kind === 'results') { showResults(q); return; }
            if (it && it.kind === 'recent') { input.value = it.title; paintGhost(); showResults(it.title); return; }
            if (it) { remember(it); location.href = it.url; }
        }
    }
    const exact = (it, q) => !!it && ['site', 'family', 'tool', 'page'].includes(it.kind) && String(it.title).toLowerCase() === q.toLowerCase();
    function remember(it) {
        if (pushed) { pushed = false; try { history.replaceState(Object.assign({}, history.state || {}, { ovsMenu: false }), ''); } catch { /* */ } }
        const q = input && input.value.trim();
        if (q && it && it.kind !== 'recent') recent.add(q);
    }
    function paintActive() {
        Array.prototype.forEach.call(listEl.querySelectorAll('.ovs-opt'), (a, i) => {
            const on = i === active;
            a.classList.toggle('is-active', on);
            a.setAttribute('aria-selected', on ? 'true' : 'false');
            if (on) { input.setAttribute('aria-activedescendant', a.id); a.scrollIntoView({ block: 'nearest' }); }
        });
    }

    /** What the box would complete to: the person's searches, then their history, then sites and this site's pages. */
    function paintGhost() {
        const q = input.value;
        completion = '';
        if (q.trim().length >= 2 && !/\s$/.test(q)) {
            const n = q.toLowerCase();
            const pool = recent.get().concat(mine ? mine.items.map((h) => h.title) : [], sites().map((s) => s.name), (ctx.links || []).map((l) => l && l.label).filter(Boolean));
            completion = pool.find((x) => x && x.length > q.length && x.toLowerCase().startsWith(n)) || '';
            if (completion) completion = q + completion.slice(q.length);
        }
        ghost.textContent = '';
        if (!completion) return;
        const typed = document.createElement('b'); typed.textContent = q;
        ghost.append(typed, document.createTextNode(completion.slice(q.length)));
    }

    function icon(it) {
        const ic = document.createElement('span');
        ic.className = 'ovs-ic';
        if (it.site) { ic.classList.add('ovs-site'); const s = document.createElement('span'); s.className = 'ov-icon'; s.setAttribute('data-icon', it.site); s.setAttribute('data-size', '28'); s.setAttribute('data-fx', 'none'); ic.appendChild(s); }
        else if (ICON[it.icon]) ic.innerHTML = ICON[it.icon];
        else ic.textContent = (it.icon || '•').slice(0, 2);
        return ic;
    }
    function option(tag, cls, it) {
        const i = items.length;
        items.push(it);
        const a = document.createElement(tag);
        a.className = `ovs-opt ${cls}`;
        a.id = `ovs-o${i}`;
        a.setAttribute('role', 'option');
        a.href = it.url;
        a.setAttribute('data-i', String(i));
        a.tabIndex = -1;
        if (it.here) { a.classList.add('is-here'); a.setAttribute('aria-current', 'page'); }
        return a;
    }
    /** groups: [{ title, items, as: 'rows' | 'chips' | 'tiles' | 'sites' | 'apps' | 'links' | 'livebar' | 'fold', section,
     *  clear, more: { label, tab | href }, fold: { open, label, key } }]; text only through textContent. */
    function foldButton(f, sec) {
        const li = document.createElement('li'); li.setAttribute('role', 'presentation'); li.className = 'ovs-foldrow';
        if (sec) li.setAttribute('data-sec', sec);
        const b = document.createElement('button'); b.type = 'button'; b.className = 'ovs-fold';
        b.setAttribute('data-ovs-fold', f.key); b.setAttribute('aria-expanded', f.open ? 'true' : 'false');
        b.insertAdjacentHTML('beforeend', ICON.go); const t = document.createElement('span'); t.textContent = f.label; b.appendChild(t);
        li.appendChild(b); return li;
    }
    function paint(groups, note) {
        items = [];
        listEl.textContent = '';
        groups.filter((g) => (g.items && g.items.length) || ['note', 'loading', 'route', 'fold', 'card', 'display', 'feeds'].includes(g.as)).forEach((g) => {
            if (g.as === 'route') {
                const r = document.createElement('li'); r.className = 'ovs-route'; r.setAttribute('role', 'presentation'); r.textContent = g.text; listEl.appendChild(r);
                return;
            }
            if (g.as === 'fold') { listEl.appendChild(foldButton(g.fold, g.section)); return; }
            if (g.as === 'feeds') {
                const li = document.createElement('li'); li.className = 'ovs-feeds'; li.setAttribute('role', 'presentation'); li.setAttribute('data-sec', 'feeds');
                const onCount = g.items.filter((x) => x.on).length;
                g.items.forEach((f) => {
                    const row = document.createElement('div'); row.className = 'ovs-feed';
                    const lab = document.createElement('label');
                    const box = document.createElement('input'); box.type = 'checkbox'; box.checked = f.on; box.setAttribute('data-ovs-feed', f.id);
                    if (!f.on && onCount >= FEEDS_MAX) box.disabled = true;
                    const t = document.createElement('span'); const b = document.createElement('b'); b.textContent = f.title; const m = document.createElement('small'); m.textContent = f.meta;
                    t.append(b, m); lab.append(box, t); row.appendChild(lab);
                    [['up', '↑', 'Show it earlier'], ['down', '↓', 'Show it later']].forEach(([dir, glyph, name]) => {
                        const mv = document.createElement('button'); mv.type = 'button'; mv.textContent = glyph; mv.setAttribute('aria-label', `${name}: ${f.title}`); mv.setAttribute('data-ovs-feed-move', `${dir}|${f.id}`); mv.disabled = !f.on; row.appendChild(mv);
                    });
                    li.appendChild(row);
                });
                const note = document.createElement('p'); note.className = 'ovs-feeds-note'; note.textContent = `Up to ${FEEDS_MAX}, in your order. Kept on this device.`; li.appendChild(note);
                listEl.appendChild(li);
                return;
            }
            if (g.as === 'display') {
                const li = document.createElement('li'); li.className = 'ovs-displayrow'; li.setAttribute('role', 'presentation'); li.setAttribute('data-sec', 'display');
                try { ctx.display(li); } catch { return; }
                listEl.appendChild(li);
                return;
            }
            if (g.as === 'card') {
                const body = document.createElement('div'); body.className = 'ovs-cardbody';
                try {
                    g.card.render(body, { close, here: here(), user: ctx.user || null, signedIn: !!(ctx.token && ctx.user && !ctx.user.is_anon) });
                } catch { return; }
                if (!body.childNodes.length) return;
                if (g.title) { const h = document.createElement('li'); h.className = 'ovs-group'; h.setAttribute('role', 'presentation'); h.setAttribute('data-sec', g.section); h.textContent = g.title; listEl.appendChild(h); }
                const li = document.createElement('li'); li.className = 'ovs-card'; li.setAttribute('role', 'presentation'); li.setAttribute('data-sec', g.section);
                li.appendChild(body); listEl.appendChild(li);
                return;
            }
            const h = document.createElement('li');
            h.className = 'ovs-group';
            h.setAttribute('role', 'presentation');
            if (g.section) h.setAttribute('data-sec', g.section);
            h.appendChild(document.createTextNode(g.title));
            if (g.clear) { const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Clear'; b.setAttribute('data-ovs-clear', ''); h.appendChild(b); }
            if (g.more && g.more.href) { const m = document.createElement('a'); m.className = 'ovs-more'; m.href = safeUrl(g.more.href) || '#'; m.textContent = g.more.label; h.appendChild(m); }
            else if (g.more) { const b = document.createElement('button'); b.type = 'button'; b.textContent = g.more.label; b.setAttribute('data-ovs-tab', g.more.tab); h.appendChild(b); }
            if (g.title) listEl.appendChild(h);
            const as = g.as || 'rows';
            if (as === 'note' || as === 'loading') {
                const n = document.createElement('li'); n.setAttribute('role', 'presentation');
                if (as === 'loading') { n.className = 'ovs-skels'; n.setAttribute('aria-label', g.text || 'Looking'); for (let k = 0; k < (g.rows || 3); k++) { const sk = document.createElement('span'); sk.className = 'ovs-skel'; n.appendChild(sk); } }
                else { n.className = 'ovs-note'; n.textContent = g.text; }
                listEl.appendChild(n);
                return;
            }
            if (as === 'rows') {
                // A row with a picture needs no site icon beside it (4.139.0); in a group where some rows have one, the
                // others carry their icon in a picture-sized tile so the titles line up.
                const pictured = g.items.some((x) => x.image);
                g.items.forEach((it) => {
                    const li = document.createElement('li'); li.className = 'ovs-item'; li.setAttribute('role', 'presentation');
                    if (g.section) li.setAttribute('data-sec', g.section);
                    const a = option('a', '', it);
                    const main = document.createElement('span'); main.className = 'ovs-main';
                    const t = document.createElement('span'); t.className = 'ovs-title'; t.textContent = it.title; main.appendChild(t);
                    if (it.tag) { const tg = document.createElement('i'); tg.className = 'ovs-tag'; tg.textContent = it.tag; t.appendChild(tg); }
                    if (it.meta) { const m = document.createElement('span'); m.className = 'ovs-meta'; m.textContent = it.meta; main.appendChild(m); }
                    if (it.snippet) { const sn = document.createElement('span'); sn.className = 'ovs-snip'; sn.textContent = it.snippet; main.appendChild(sn); }
                    if (it.image) {
                        const im = document.createElement('img');
                        im.className = 'ovs-thumb'; im.src = it.image; im.alt = '';
                        im.width = 72; im.height = 40; im.loading = 'lazy'; im.decoding = 'async';
                        a.appendChild(im);
                    } else if (pictured) {
                        const tile = document.createElement('span'); tile.className = 'ovs-thumb ovs-thumb--ico';
                        tile.append(icon(it)); a.appendChild(tile);
                    } else a.append(icon(it));
                    a.appendChild(main);
                    const q = input.value.trim();
                    if (q && view !== 'results' && (it.kind === 'results' || (items.length === 1 && exact(it, q)))) { const k = document.createElement('span'); k.className = 'ovs-key'; k.textContent = 'Enter'; a.appendChild(k); }
                    li.appendChild(a); listEl.appendChild(li);
                });
                return;
            }
            const box = document.createElement('li');
            box.setAttribute('role', 'presentation');
            if (g.section) box.setAttribute('data-sec', g.section);
            box.className = as === 'chips' ? 'ovs-chips' : as === 'apps' ? 'ovs-apps' : as === 'links' ? 'ovs-links' : as === 'livebar' ? 'ovs-livebar' : `ovs-grid${as === 'sites' ? ' is-sites' : as === 'mini' ? ' is-mini' : ''}`;
            g.items.forEach((it, k) => {
                if (as === 'chips') {
                    const a = option('a', 'ovs-chip', it);
                    // The place's own icon (the navbar's drawn set, never page text), else the menu's.
                    if (it.drawn && /^<svg[\s>]/.test(it.drawn)) a.insertAdjacentHTML('afterbegin', it.drawn); else if (ICON[it.icon]) a.insertAdjacentHTML('afterbegin', ICON[it.icon]);
                    const s = document.createElement('span'); s.textContent = it.title; a.appendChild(s);
                    box.appendChild(a);
                    return;
                }
                if (as === 'apps') {
                    // A dock of big icons: the name under each, one tap to the place.
                    const a = option('a', 'ovs-app', it);
                    const ic = icon(it); ic.classList.add('ovs-appic');
                    const span = ic.querySelector('.ov-icon'); if (span) span.setAttribute('data-size', '40');
                    const t = document.createElement('span'); t.className = 'ovs-appname'; t.textContent = it.title;
                    a.append(ic, t); box.appendChild(a); return;
                }
                if (as === 'links') {
                    const a = option('a', 'ovs-link', it);
                    if (it.drawn && /^<svg[\s>]/.test(it.drawn)) a.insertAdjacentHTML('afterbegin', it.drawn); else a.insertAdjacentHTML('afterbegin', ICON.go);
                    const t = document.createElement('span'); t.textContent = it.title; a.appendChild(t);
                    box.appendChild(a); return;
                }
                if (as === 'livebar') {
                    // The first is the count ("3 streams live now"), then the live channels when Network names them.
                    const a = option('a', k === 0 ? 'ovs-live is-count' : 'ovs-live', it);
                    if (k === 0) { const dot = document.createElement('span'); dot.className = 'ovs-livedot'; a.appendChild(dot); }
                    const t = document.createElement('span'); t.className = 'ovs-livename'; t.textContent = it.title; a.appendChild(t);
                    if (it.meta) { const m = document.createElement('small'); m.textContent = it.meta; a.appendChild(m); }
                    box.appendChild(a); return;
                }
                const a = option('a', 'ovs-tile', it);
                const txt = document.createElement('span');
                const b = document.createElement('b'); b.textContent = it.title; txt.appendChild(b);
                if (it.tag) { const tg = document.createElement('i'); tg.className = 'ovs-tag'; tg.textContent = it.tag; b.appendChild(tg); }
                if (as === 'sites' && it.meta) { const sm = document.createElement('small'); sm.textContent = it.meta; txt.appendChild(sm); }
                if (it.host) { const hs = document.createElement('span'); hs.className = 'ovs-host'; hs.textContent = it.host; txt.appendChild(hs); }
                const ic = icon(it);
                if (as === 'mini') { const sp = ic.querySelector('.ov-icon'); if (sp) sp.setAttribute('data-size', '22'); }
                a.append(ic, txt);
                box.appendChild(a);
            });
            listEl.appendChild(box);
            if (g.fold) listEl.appendChild(foldButton(g.fold, g.section));
        });
        if (note) { const n = document.createElement('li'); n.className = 'ovs-note'; n.setAttribute('role', 'presentation'); n.textContent = note; listEl.appendChild(n); }
        active = items.length && input.value.trim() && view !== 'results' ? 0 : -1;
        paintActive();
        if (typeof ctx.icons === 'function') { try { ctx.icons(listEl); } catch { /* the icons are optional */ } }
    }

    // This site's short name for the field and the headings: the frame's name for this address ("Download"), not the page
    // title ("OpenVibe.Download: a free 25 GB drive with share links" was cut off in the field and ran over two lines).
    const shortName = (t) => String(t || '').split(/\s[·|–—-]\s|:\s/)[0].replace(/^OpenVibe\./, '').trim().slice(0, 28);
    const here = () => {
        if (ctx.scope && ctx.scope.label) return shortName(ctx.scope.label);
        const f = ctx.frame, list = f && Array.isArray(f.nav) ? f.nav.map((n) => ({ name: n.name, url: safeUrl(n.url) })) : [];
        const s = list.length ? hereSite(list) : null;
        return (s && s.name) || shortName(document.title.split(/[·|–-]/).pop()) || location.hostname;
    };
    const siteItem = (s, all) => ({ title: s.name, meta: s.desc, url: s.url, site: s.icon || s.id, kind: 'site', here: all && s === hereSite(all) });
    function pagesOf(q) {
        const n = q.toLowerCase();
        return (ctx.links || []).filter((l) => l && l.label && typeof l.href === 'string' && !l.hidden && (!n || l.label.toLowerCase().includes(n)))
            .slice(0, n ? 4 : 8).map((l) => ({ title: l.label, meta: `Go to · ${here()}`, url: safeUrl(l.href), icon: 'go', drawn: l.icon && typeof ctx.navIcon === 'function' ? ctx.navIcon(l.icon) : '', kind: 'page' })).filter((x) => x.url);
    }
    function actions(q) {
        const out = [];
        if (ctx.scope && ctx.scope.page) {
            const u = safeUrl(`${ctx.scope.page}${ctx.scope.page.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}`);
            if (u) out.push({ title: `Search “${q}” on ${here()}`, meta: 'This site\'s own search', url: u, icon: 'search', kind: 'action' });
        }
        out.push({ title: `All results for “${q}”`, meta: 'Every OpenVibe site and the web, in one list', url: `${API}/?q=${encodeURIComponent(q)}`, icon: 'search', kind: 'results' });
        out.push({ title: `Ask Vibe: “${q}”`, meta: 'OpenVibe\'s assistant searches the web and OpenVibe', url: `https://openvibe.chat/vibe?ask=${encodeURIComponent(q)}`, icon: 'spark', kind: 'action' });
        return out;
    }
    // How well a name answers what was typed: its start (3), inside it (2), or only the words behind it (1).
    const scoreOf = (n, name, words) => { const nm = name.toLowerCase(); return nm.startsWith(n) ? 3 : nm.includes(n) ? 2 : words && words.includes(n) ? 1 : 0; };
    // Quick tools on Start: the everyday ones first (the owner, 10-29: "I'm trying to just get to basic tools"), then the
    // network's most used.
    const EVERYDAY = ['QR Code Generator', 'Image Compressor', 'Merge PDF', 'Image Converter', 'Word Counter', 'YouTube Downloader'];
    function quickTools() {
        const picked = catalog ? EVERYDAY.map((n) => catalog.tools.find((t) => t.name === n)).filter(Boolean).map(toolRow) : [];
        const seen = new Set(picked.map((r) => r.url));
        return [...picked, ...popularTools().filter((r) => !seen.has(r.url))].slice(0, 6);
    }
    const toolRow = (t) => ({ title: t.name, meta: t.desc ? `Tool · ${t.desc}` : 'Tool', url: t.go || t.url, site: t.icon, kind: 'tool' });
    /** How often this person opened a tool (their history's visits to any of its addresses). */
    function toolUse(t) {
        if (!mine || !t.hosts || !t.hosts.length) return 0;
        return mine.items.reduce((n, h) => n + (t.hosts.indexOf(hostOf(h.url)) >= 0 ? 1 : 0), 0);
    }
    const toolByHost = (url) => { const h = hostOf(url); return catalog ? catalog.tools.find((t) => t.hosts.indexOf(h) >= 0 || hostOf(t.url) === h) : null; };
    /** The tools this person opened lately, most first (their history), and the most used across OpenVibe (the Frame's analytics). */
    function yourTools() {
        if (!mine || !catalog) return [];
        return catalog.tools.map((t) => [toolUse(t), t]).filter(([n]) => n > 0).sort((a, b) => b[0] - a[0]).slice(0, 6).map(([, t]) => toolRow(t));
    }
    function popularTools() {
        const list = ctx.frame && ctx.frame.footer && Array.isArray(ctx.frame.footer.popular) ? ctx.frame.footer.popular : [];
        const rows = list.map((p) => { const t = toolByHost(p.url); return t ? toolRow(t) : { title: String(p.name || ''), meta: 'Tool', url: safeUrl(p.url), site: 'tools', kind: 'tool' }; }).filter((x) => x.url && x.title);
        return rows.length ? rows : catalog ? catalog.tools.slice(0, 8).map(toolRow) : [];
    }
    /** Sites, tool families and tools whose NAME matches (the start first, then what this person uses most): the places to go. */
    function goTo(q) {
        const n = q.toLowerCase();
        const all = sites();
        const s = all.map((x) => [scoreOf(n, x.name) * 100 + Math.min(99, useOf(x.id)), x]).filter(([v]) => v >= 200).sort((a, b) => b[0] - a[0]).map(([, x]) => siteItem(x, all));
        const fams = ((catalog && catalog.families.length) ? catalog.families : FALLBACK_FAMILIES).filter((f) => scoreOf(n, f.name) >= 2).map((f) => ({ title: f.name, meta: 'Tools', url: f.url, site: f.icon, kind: 'family' }));
        const tools = catalog ? catalog.tools.map((t) => [scoreOf(n, t.name) * 100 + Math.min(99, toolUse(t)), t]).filter(([v]) => v >= 200).sort((a, b) => b[0] - a[0]).slice(0, 4).map(([, t]) => toolRow(t)) : [];
        // What this person already uses goes first: a tool they opened before outranks a site that merely matches.
        return tools.filter((t) => toolUse(toolByHost(t.url) || {}) > 0).concat(s, fams, tools.filter((t) => !(toolUse(toolByHost(t.url) || {}) > 0))).slice(0, 6);
    }
    /** Tools whose description or keywords mention it (but not their name): useful, never the first answer. */
    function toolsAbout(q) {
        const n = q.toLowerCase();
        if (!catalog || n.length < 3) return [];
        return catalog.tools.filter((t) => scoreOf(n, t.name, t.k) === 1).slice(0, 3).map(toolRow);
    }
    /** A result's site icon: the Frame's site for its address (openvibe.video is Video), else its first letters. */
    function siteIcon(url) {
        const h = hostOf(url); let best = null, len = 0;
        for (const s of sites()) { const sh = hostOf(s.url); if (sh && (h === sh || h.endsWith(`.${sh}`)) && sh.length > len) { best = s; len = sh.length; } }
        return best ? best.icon || best.id : null;
    }

    // ── The menu before typing (the owner, 2026-11-07: "rethink the whole idea of this whole menu … not spreading
    // traffic good enough … not smartly done based on what's popular"). One calm scroll, no tabs, in the order people
    // need it: who is live, the places they use (one tap to Live from anywhere), this site's own pages, where people
    // really go next from here (Network's cross-site moves, 11-07), two places new to them (fair rotation through the
    // long tail), their own corner (agents, Vibe, account), tools, every site behind a counted fold, and the pages they
    // were on last. Network's Frame may send `next`, `discover`, `you` and `live`; until it does the menu works them out.
    const NEXT_OF = {
        live: ['media-hub', 'community', 'chat', 'tools', 'bot', 'vip'],
        'media-hub': ['live', 'pics', 'community', 'download'],
        community: ['live', 'chat', 'tools', 'space'],
        chat: ['live', 'community', 'media-hub', 'games'],
        tools: ['live', 'community', 'download', 'chat'],
        network: ['live', 'media-hub', 'community', 'design'],
        games: ['live', 'casino', 'quest', 'chat'],
        bot: ['live', 'actor', 'codes', 'run'],
        pics: ['media-hub', 'download', 'live', 'design'],
        download: ['pics', 'media-hub', 'tools', 'zone'],
        design: ['space', 'website', 'pics', 'network'],
        space: ['website', 'design', 'community', 'domains'],
    };
    const NEXT_WHY = {
        live: 'Streams and calls', 'media-hub': 'Recordings and clips', community: 'Forum and pastes', chat: 'Rooms and messages',
        tools: 'Free tools', bot: 'Robots and machines', vip: 'Back a streamer', pics: 'Pictures', download: 'Files and drive',
    };
    let allOpen = false, hereOpen = false, leadHere = false, discoverPick = null, pulseData = null, feedsOpen = false;
    // Your feeds (11-07, the owner: "the user should be able to configure which data feed streams are shown"): the sites'
    // cards you chose and their order, on this device ({ on: ['media-hub:trending', …] }); none chosen = Network's first two.
    const FEEDS_KEY = 'ovs-feeds', FEEDS_MAX = 4;
    const feedId = (c) => `${String(c.site || '').slice(0, 30)}:${String(c.id || '').slice(0, 30)}`;
    const feedPref = () => { try { const v = JSON.parse(localStorage.getItem(FEEDS_KEY) || 'null'); return v && Array.isArray(v.on) ? v.on.filter((x) => typeof x === 'string').slice(0, FEEDS_MAX) : null; } catch { return null; } };
    const saveFeedsLocal = (on) => { try { localStorage.setItem(FEEDS_KEY, JSON.stringify({ on: on.slice(0, FEEDS_MAX) })); } catch { /* private window */ } };
    // The choice follows the person (4.135.0): Network keeps it (GET/PUT /api/v1/me/menu-feeds, network.menu-feeds@1);
    // this device's copy paints at once and stands whenever Network does not answer.
    let feedsSynced = false, feedsPut = 0;
    const feedsUrl = () => `${ctx.apiBase || 'https://openvibe.network'}/api/v1/me/menu-feeds`;
    const signedInCtx = () => !!(ctx.token && ctx.user && !ctx.user.is_anon);
    function pushFeeds(on) {
        if (!signedInCtx() || typeof fetch !== 'function') return;
        clearTimeout(feedsPut);
        feedsPut = setTimeout(() => { fetch(feedsUrl(), { method: 'PUT', headers: { Authorization: `Bearer ${ctx.token}`, 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify({ on: on.slice(0, FEEDS_MAX) }) }).catch(() => {}); }, 800);
    }
    const saveFeeds = (on) => { saveFeedsLocal(on); pushFeeds(on); };
    async function syncFeeds() {
        if (feedsSynced || !signedInCtx() || typeof fetch !== 'function') return;
        feedsSynced = true;
        try {
            const r = await fetch(feedsUrl(), { headers: { Authorization: `Bearer ${ctx.token}` }, credentials: 'omit' });
            if (!r.ok) return;
            const j = await r.json();
            const local = feedPref();
            if (Array.isArray(j.on)) {
                const remote = j.on.filter((x) => typeof x === 'string').slice(0, FEEDS_MAX);
                if (JSON.stringify(remote) !== JSON.stringify(local)) { saveFeedsLocal(remote); if (el && el.classList.contains('is-open') && !input.value) render(''); }
            } else if (local) pushFeeds(local);
        } catch { /* the device copy stands */ }
    }
    /** Network's live line (GET /api/frame/pulse, kept 30 s): how many are live now, and who when the Frame sends it. */
    function loadPulse() {
        try { const c = JSON.parse(sessionStorage.getItem('ov_pulse') || 'null'); if (c && Date.now() - c.at < 30000) { pulseData = c.data; return Promise.resolve(c.data); } } catch { /* */ }
        return fetch('https://openvibe.network/api/frame/pulse', { credentials: 'omit' }).then((r) => (r.ok ? r.json() : null)).then((d) => {
            if (d) { pulseData = d; try { sessionStorage.setItem('ov_pulse', JSON.stringify({ at: Date.now(), data: d })); } catch { /* */ } }
            return d;
        }).catch(() => null);
    }
    /** What shipped lately, every site (Network's GET /api/v1/changelog, the feed OpenVibe.Blog keeps; kept 5 minutes):
     *  the newest real change per site, library bumps left out (the same rule as shipped.js). */
    let changesData = null;
    const HOUSEKEEPING = /^(?:openvibe-(?:shared|sdk|contracts|publishing)|openvibe-codes-cli)\s+v?\d|^(?:bump|pin)\b|\(was v\d/i;
    function loadChanges() {
        try { const c = JSON.parse(sessionStorage.getItem('ov_changes') || 'null'); if (c && Date.now() - c.at < 300000) { changesData = c.data; return Promise.resolve(c.data); } } catch { /* */ }
        return fetch('https://openvibe.network/api/v1/changelog?limit=100', { credentials: 'omit', headers: { accept: 'application/json' } }).then((r) => (r.ok ? r.json() : null)).then((d) => {
            if (d && Array.isArray(d.entries)) { changesData = d.entries; try { sessionStorage.setItem('ov_changes', JSON.stringify({ at: Date.now(), data: d.entries })); } catch { /* */ } }
            return changesData;
        }).catch(() => null);
    }
    /** A commit subject in plain words: no PR number, no stage tag ("A6: "), no trailing period. */
    const plainChange = (t) => String(t || '').replace(/\s*\(#\d+\)\s*$/, '').replace(/^[A-Z]{1,3}\d{0,3}(?:-\d+)?:\s+/, '').replace(/\.$/, '').slice(0, 110);
    /** When this person was last on a site (their history), for "new since your last visit". */
    function lastVisit(id) {
        if (!mine) return 0;
        let t = 0;
        for (const h of mine.items) if (h.service === id || (id === 'media-hub' && h.service === 'media')) { const v = Date.parse(h.at || ''); if (v > t) t = v; }
        return t;
    }

    /** Two places this person has never used, picked fairly from the network's ranked list: better-used places come up
     *  more often, but every place gets its turn (the pick changes each time the menu opens). */
    function pickDiscover(pool) {
        // The same two for the whole opening (history arriving later must not reshuffle them); one that has since moved
        // up into the person's places is replaced, so there are always two.
        const kept = discoverPick ? discoverPick.map((id) => pool.find((s) => s.id === id)).filter(Boolean) : [];
        if (discoverPick && kept.length >= 2) return kept;
        const fresh = pool.filter((s) => !useOf(s.id) && !kept.includes(s));
        const picked = kept.slice();
        const bag = fresh.map((s, i) => [s, 1 / Math.sqrt(1 + i)]);
        while (picked.length < 2 && bag.length) {
            const total = bag.reduce((n, [, w]) => n + w, 0);
            let r = Math.random() * total, k = 0;
            for (; k < bag.length - 1 && r > bag[k][1]; k++) r -= bag[k][1];
            picked.push(bag[k][0]); bag.splice(k, 1);
        }
        discoverPick = picked.map((s) => s.id);
        return picked;
    }
    /** The person's workspace (signed in): their agents and Vibe (the Dock opens in place), Codes, their files, their
     *  machines, wallet, account and themes, one tap from every site (the owner, 11-07: "access codes through this menu
     *  easily, and talk to your agent … less having to hop between sites"). */
    function youItems() {
        const f = ctx.frame;
        if (f && Array.isArray(f.you) && f.you.length) return f.you.map((y) => ({ title: String(y.name || ''), url: safeUrl(y.url), site: y.icon || 'ov', kind: y.dock ? 'dock' : 'you', dock: y.dock || null })).filter((x) => x.url && x.title);
        return [
            { title: 'Agents', url: 'https://openvibe.actor/', site: 'actor', kind: 'dock', dock: 'agent' },
            { title: 'Vibe', url: 'https://openvibe.chat/vibe', site: 'ov', kind: 'dock', dock: 'vibe' },
            { title: 'Codes', url: 'https://openvibe.codes/', site: 'codes', kind: 'you' },
            { title: 'Files', url: 'https://openvibe.download/files', site: 'drive', kind: 'you' },
            { title: 'Machines', url: 'https://node.openvibe.network', site: 'plug', kind: 'you' },
            { title: 'Wallet', url: 'https://openvibe.network/wallet', site: 'billing', kind: 'you' },
            { title: 'Account', url: 'https://openvibe.network/my', site: 'account', kind: 'you' },
            { title: 'Themes', url: 'https://openvibe.network/themes', site: 'theme', kind: 'you' },
        ];
    }
    // ── Site cards: a site's own live piece of the menu (the owner, 11-07: "content aware … on Download, a little
    // download thing … or create custom elements"). A page pushes { id, title, render(el, api) } onto
    // window.OpenVibeMenuCards (a queue, so it works before search.js loads) or calls OpenVibeSearch.registerCard().
    // render() gets an empty element and { close, here, user, signedIn } and draws with DOM nodes; it runs on the
    // site's own page, so it is the site's code and its own responsibility. A card that throws is left out.
    const cards = [];
    function registerCard(c) {
        if (!c || typeof c.render !== 'function' || !c.id || cards.some((x) => x.id === c.id)) return () => {};
        cards.push(c);
        return () => { const i = cards.indexOf(c); if (i >= 0) cards.splice(i, 1); };
    }
    function drainCards() {
        const q = root.OpenVibeMenuCards;
        if (Array.isArray(q)) { while (q.length) registerCard(q.shift()); }
        // Later pushes go straight in.
        root.OpenVibeMenuCards = { push: (c) => { registerCard(c); return cards.length; } };
    }

    // The network's flagships, first in the full list (the owner, 11-07: "show our most coolest products front facing").
    const FLAGSHIPS = ['live', 'media-hub', 'codes', 'design', 'space', 'games', 'chat', 'tools'];

    /** The tab strip under the search field: this site's name, Feed (a red dot while anyone is live), You. */
    function paintTabs() {
        tabsEl.hidden = false;
        tabsEl.setAttribute('role', 'tablist');
        tabsEl.setAttribute('aria-label', 'Menu');
        tabsEl.textContent = '';
        const live = pulseData && Number(pulseData.live_now) > 0;
        for (const [id, label] of TABS) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'ovs-tab'; b.setAttribute('role', 'tab'); b.setAttribute('data-tab', id);
            b.setAttribute('aria-selected', tab === id ? 'true' : 'false');
            const t = document.createElement('span'); t.textContent = id === 'here' ? here() : label; b.appendChild(t);
            if (id === 'feed' && live) { const d = document.createElement('i'); d.className = 'ovs-tabdot'; d.setAttribute('aria-label', 'live now'); b.appendChild(d); }
            tabsEl.appendChild(b);
        }
    }

    /** What every tab needs: the sites, this one, and the person's ranking of them. */
    function basis() {
        // This site: by its address, else by the service the bar names (www., a preview host, a stand-in page).
        const all = sites(), mineSite = hereSite(all) || all.find((x) => x.id === ctx.service) || null;
        const byId = new Map(all.map((x) => [x.id, x]));
        const shown = new Set(mineSite ? [mineSite.id] : []);
        const take = (list, n) => { const out = []; for (const x of list) { if (out.length >= n) break; if (x && !shown.has(x.id)) { out.push(x); shown.add(x.id); } } return out; };
        const ranked = all.map((x, i) => [useOf(x.id) * 1000 - i, x]).sort((a, b) => b[0] - a[0]).map(([, x]) => x);
        return { all, mineSite, byId, shown, take, ranked, f: ctx.frame };
    }

    /** Who is live (Network's pulse), as the live bar: the count, then the live channels when Network names them. */
    function liveGroup() {
        const p = pulseData;
        const liveNow = p && Number(p.live_now) > 0 ? Number(p.live_now) : 0;
        if (!liveNow) return null;
        const chans = Array.isArray(p.live) ? p.live.slice(0, 8).map((c) => ({ title: String(c.name || ''), meta: c.viewers ? `${c.viewers} watching` : 'Live', url: safeUrl(c.url), site: 'live', kind: 'live' })).filter((x) => x.url && x.title) : [];
        return { title: '', as: 'livebar', section: 'live', items: [{ title: liveNow === 1 ? '1 stream live now' : `${liveNow} streams live now`, meta: p.watching ? `${p.watching} watching` : 'Watch on Live', url: 'https://openvibe.live/', site: 'live', kind: 'live' }, ...chans] };
    }

    /**
     * This site's tab: its own pages, then every OpenVibe site, compact and grouped (this site's group first). People
     * live show here only on Live itself; everywhere else they are the Feed's.
     */
    function hereGroups() {
        const { all, mineSite, byId, f } = basis();
        const groups = [];
        if (mineSite && mineSite.id === 'live') { const g = liveGroup(); if (g) groups.push(g); }
        // This site's own cards (a drop zone on Download, go-live status on Live, a new task on Codes…).
        for (const c of cards) groups.push({ title: c.title || '', as: 'card', card: c, section: `card:${c.id}`, items: [] });
        const pages = (ctx.links || []).filter((l) => l && l.label && typeof l.href === 'string' && !l.hidden).map((l) => ({ title: l.label, url: safeUrl(l.href), icon: 'go', drawn: l.icon && typeof ctx.navIcon === 'function' ? ctx.navIcon(l.icon) : '', kind: 'page' })).filter((x) => x.url);
        // The page the person is on wears the highlight (owner 11-08): the link whose path is this page's, or the longest one
        // this page sits under (/messages/abc under Messages); "/" only on the home itself.
        let best = -1, bestLen = -1;
        pages.forEach((x, i) => {
            let u; try { u = new URL(x.url, root.location.href); } catch { return; }
            if (u.origin !== root.location.origin) return;
            const p = u.pathname.replace(/\/+$/, '') || '/', at = root.location.pathname.replace(/\/+$/, '') || '/';
            const len = p === at ? 10000 + p.length : (p !== '/' && at.startsWith(`${p}/`) ? p.length : -1);
            if (len > bestLen) { best = i; bestLen = len; }
        });
        if (best >= 0) pages[best].here = true;
        if (pages.length) groups.push({ title: `On ${here()}`, as: 'links', items: pages, section: 'here' });
        const fgroups = f && f.groups && f.groups.length ? f.groups.slice() : [{ id: '', name: 'OpenVibe' }];
        if (mineSite) fgroups.sort((a, b) => (b.id === mineSite.group) - (a.id === mineSite.group));
        const inGroup = (x, g) => !g.id || x.group === g.id || (!fgroups.some((y) => y.id === x.group) && g === fgroups[fgroups.length - 1]);
        const mini = (x) => siteItem(x, all);
        fgroups.forEach((g, i) => {
            const list = all.filter((x) => inGroup(x, g)).map(mini);
            if (list.length) groups.push({ title: i === 0 && fgroups.length > 1 ? g.name : g.name, as: 'mini', items: list, section: 'all' });
        });
        const soon = f && Array.isArray(f.soon) ? f.soon : [];
        if (soon.length) groups.push({ title: 'Opening soon', as: 'chips', items: soon.map((x) => ({ title: x.name, url: safeUrl(x.url), kind: 'site' })).filter((x) => x.url), section: 'all' });
        void byId;
        return groups;
    }

    /**
     * The Feed: who is live, the feeds the person chose (the sites' cards: Video's trending, Games' new worlds, the
     * forum…), what changed lately, places new to them and where people go next from here; the chooser at the end.
     */
    function feedGroups() {
        const { all, mineSite, byId, shown, take, ranked, f } = basis();
        const groups = [];
        const live = liveGroup(); if (live) groups.push(live);
        // The network's cards: text and links only (never another site's code), checked here again, with an entry's https
        // picture when it sent one; the person's choice and order, else Network's first two.
        const feeds = f && Array.isArray(f.cards) ? f.cards.filter((c) => c && typeof c.title === 'string' && Array.isArray(c.items) && c.items.length).slice(0, 12) : [];
        const chosen = feedPref();
        const netCards = chosen ? chosen.map((id) => feeds.find((c) => feedId(c) === id)).filter(Boolean) : feeds.slice(0, 2);
        netCards.forEach((c) => {
            const as = c.kind === 'rail' ? 'livebar' : c.kind === 'chips' ? 'chips' : 'rows';
            const rows = c.items.slice(0, 6).map((x) => ({ title: String(x.title || '').slice(0, 80), meta: String(x.meta || '').slice(0, 120), url: safeUrl(x.url),
                image: x.image && /^https:\/\//.test(String(x.image.src || '')) ? String(x.image.src) : null,
                site: c.site && /^[a-z0-9-]{1,30}$/.test(c.site) ? c.site : null, icon: 'go', kind: 'card' })).filter((x) => x.url && x.title);
            if (rows.length) groups.push({ title: String(c.title).slice(0, 60), as, items: rows, section: `net:${String(c.id || c.site || '').slice(0, 30)}`, more: c.more && safeUrl(c.more.url) ? { label: String(c.more.label || 'More').slice(0, 24), href: c.more.url } : null });
        });
        // What's new (the owner, 11-07): the newest real change per site, newest first, "New" after this person's last visit.
        if (Array.isArray(changesData) && changesData.length) {
            const newest = new Map();
            for (const e of changesData) {
                if (!e || !e.service || HOUSEKEEPING.test(String(e.subject || '')) || newest.has(e.service)) continue;
                const site = byId.get(e.service) || (e.service === 'media' ? byId.get('media-hub') : null);
                if (!site || (site.group === 'build' && !useOf(site.id))) continue;
                newest.set(e.service, { e, site });
            }
            const rows = [...newest.values()].sort((a, b) => Date.parse(b.e.deployed_at || b.e.committed_at || 0) - Date.parse(a.e.deployed_at || a.e.committed_at || 0)).slice(0, 4).map(({ e, site }) => {
                const at = e.deployed_at || e.committed_at;
                const seen = lastVisit(site.id);
                const fresh = seen && Date.parse(at) > seen;
                return { title: site.name, meta: `${plainChange(e.subject)} · ${ago(at)}`, url: safeUrl(`${site.url.replace(/\/$/, '')}/updates`), site: site.icon || site.id, kind: 'update', tag: fresh ? 'New' : '' };
            }).filter((x) => x.url);
            if (rows.length) groups.push({ title: "What's new", items: rows, section: 'news', more: { label: 'All updates', href: 'https://openvibe.network/updates' } });
        }
        // Two places new to this person, rotating fairly through the network (developer services only for builders).
        const builder = all.some((x) => x.group === 'build' && useOf(x.id));
        const discoverPool = (f && Array.isArray(f.discover_ids) && f.discover_ids.length ? f.discover_ids.map((id) => byId.get(id)).filter(Boolean) : ranked)
            .filter((x) => !shown.has(x.id) && (builder || x.group !== 'build'));
        const disc = pickDiscover(discoverPool);
        disc.forEach((x) => shown.add(x.id));
        if (disc.length) groups.push({ title: 'New to you', as: 'sites', items: disc.map((x) => Object.assign(siteItem(x), { tag: 'New' })), section: 'discover' });
        // Where people go next from here: the Frame's list, else the moves Network saw and this site's group.
        const nextIds = mineSite ? ((f && f.next && Array.isArray(f.next[mineSite.id]) && f.next[mineSite.id]) || NEXT_OF[mineSite.id] || all.filter((x) => x.group === mineSite.group).map((x) => x.id)) : [];
        const next = take(nextIds.map((id) => byId.get(id)), 4);
        if (next.length) groups.push({ title: `Next from ${here()}`, as: 'sites', items: next.map((x) => Object.assign(siteItem(x), { meta: NEXT_WHY[x.id] || x.desc })), section: 'next' });
        // Choose your feeds: every card a site offers, a tick to show it, arrows to order it (four at most).
        if (feeds.length > 1 || chosen) {
            groups.push({ as: 'fold', fold: { key: 'feeds', open: feedsOpen, label: feedsOpen ? 'Done choosing' : `Choose your feeds (${netCards.length} of ${feeds.length})` }, section: 'feeds' });
            if (feedsOpen) groups.push({ as: 'feeds', section: 'feeds', items: feeds.map((c) => ({ id: feedId(c), title: String(c.title).slice(0, 60), meta: String(c.site || '').replace('media-hub', 'Video'), on: netCards.includes(c) })) });
        }
        if (!groups.length) groups.push({ as: 'note', text: 'Nothing new right now. Choose your feeds, or look around the sites on the first tab.' });
        return groups;
    }

    /** You: their workspace, their places, the pages they were on, tools, their searches, and the display controls. */
    function youGroups() {
        const { take, ranked } = basis();
        const groups = [];
        if (ctx.token && ctx.user && !ctx.user.is_anon) groups.push({ title: 'Your workspace', as: 'apps', items: youItems(), section: 'you' });
        const yours = mine && mine.services.some((x) => x.count > 0);
        // Without their own history, developer services are not places to visit: they come up here once used.
        const dockPool = yours ? ranked : ranked.filter((x) => x.group !== 'build' || useOf(x.id));
        groups.push({ title: yours ? 'Your places' : 'Popular on OpenVibe', as: 'apps', items: take(dockPool, 8).map((x) => siteItem(x)), section: 'places' });
        const seen = new Set();
        const back = mine ? mine.items.filter((h) => { if (seen.has(h.url)) return false; seen.add(h.url); return true; }).slice(0, 5)
            .map((h) => ({ title: h.title, meta: [h.site, ago(h.at)].filter(Boolean).join(' · '), url: h.url, icon: 'back', kind: 'history' })) : [];
        groups.push({ title: 'Jump back in', items: back, section: 'back' });
        const tools = yourTools().concat(quickTools()).filter((t, i, a) => a.findIndex((x) => x.url === t.url) === i).slice(0, 6);
        groups.push({ title: 'Tools', as: 'chips', more: { label: 'All tools', href: 'https://openvibe.tools/' }, items: tools, section: 'tools' });
        const r = recent.get();
        groups.push({ title: 'Recent searches', as: 'chips', clear: true, items: r.map((x) => ({ title: x, url: `${API}/?q=${encodeURIComponent(x)}`, icon: 'clock', kind: 'recent' })), section: 'recent' });
        // Display: theme, text size and motion.
        if (typeof ctx.display === 'function') groups.push({ title: '', as: 'display', items: [], section: 'display' });
        return groups;
    }

    function renderTab() {
        paint(tab === 'feed' ? feedGroups() : tab === 'you' ? youGroups() : hereGroups());
    }

    function render(q) {
        q = String(q || '').trim();
        el.classList.toggle('ovs-typing', !!q);
        tabsEl.hidden = !!q;
        if (!q) { if (inflight) { inflight.abort(); inflight = null; } el.classList.remove('ovs-busy'); paintTabs(); renderTab(); return; }
        const n = q.toLowerCase();
        const recentHits = recent.get().filter((x) => x.toLowerCase().startsWith(n) && x.toLowerCase() !== n).slice(0, 3).map((x) => ({ title: x, meta: 'Search again', url: `${API}/?q=${encodeURIComponent(x)}`, icon: 'clock', kind: 'recent' }));
        const history = mine ? mine.items.filter((h) => h.title.toLowerCase().includes(n)).slice(0, 4).map((h) => ({ title: h.title, meta: [h.site, ago(h.at)].filter(Boolean).join(' · '), url: h.url, icon: 'back', kind: 'history' })) : [];
        const first = (found) => {
            const owner = ctx.scope && ctx.scope.owner;
            const row = (s) => ({ title: s.title, meta: [s.site, TYPE[s.type] || s.type].filter(Boolean).join(' · '), url: s.url, site: siteIcon(s.url), icon: (s.site || '?').slice(0, 2), kind: 'result' });
            const minehere = owner ? found.filter((s) => s.owner === owner) : [];
            // The rest of OpenVibe: the sites this person uses most come first, Search's own order otherwise.
            const rest = found.filter((s) => !minehere.includes(s)).map((s, i) => [useOf(s.owner) * 1000 - i, s]).sort((a, b) => b[0] - a[0]).map(([, s]) => s);
            return [
                { title: 'Go to', items: goTo(q) },
                { title: `On ${here()}`, items: [...minehere.map(row), ...pagesOf(q)] },
                { title: 'Your history', items: history },
                { title: 'Across OpenVibe', items: rest.map(row) },
                { title: 'Tools for it', items: toolsAbout(q) },
                { title: 'Your searches', items: recentHits },
                { title: 'Search', items: actions(q) },
            ];
        };
        paint(first([]), 'Looking…');
        if (inflight) inflight.abort();
        const ac = new AbortController();
        inflight = ac;
        el.classList.add('ovs-busy');
        suggest(q, { limit: 10, signal: ac.signal, url: ctx.suggestUrl }).then((found) => {
            if (ac.signal.aborted) return;
            paint(first(found), found.length || goTo(q).length ? '' : 'Nothing starts with that yet: search everywhere, or ask Vibe.');
        }).catch(() => { if (!ac.signal.aborted) paint(first([]), ''); })
            .finally(() => { if (inflight === ac) { inflight = null; if (el) el.classList.remove('ovs-busy'); } });
    }
    function schedule(q) { clearTimeout(timer); timer = setTimeout(() => render(q), String(q).trim() ? 140 : 0); }

    // ── Results: OpenVibe.Search's fabric through Network's /api/frame/query (the same connect-src as suggestions) ──
    /** One fabric question; the person's token goes along (their own results, the paid web providers). null on failure. */
    function query(q, scopes, { depth = 'standard', limit = 10, signal } = {}) {
        const base = ctx.suggestUrl && /\/suggest$/.test(ctx.suggestUrl) ? ctx.suggestUrl.replace(/\/suggest$/, '/query') : SUGGEST.replace(/\/suggest$/, '/query');
        const u = new URL(base);
        u.searchParams.set('q', q);
        u.searchParams.set('scopes', scopes.join(','));
        u.searchParams.set('depth', depth);
        u.searchParams.set('limit', String(limit));
        return fetch(u.href, { headers: ctx.token ? { Authorization: `Bearer ${ctx.token}` } : {}, credentials: 'omit', signal })
            .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    }
    const SCOPES_OF = { all: ['network'], openvibe: ['network'], video: ['video'], news: ['news'], products: ['products'], mine: ['mine'], web: [] };
    function showResults(q, which) {
        q = String(q || '').trim();
        if (!q) return;
        rq = q; rtab = RTABS.some(([id]) => id === which) ? which : (which ? 'all' : rtab);
        if (rtab === 'mine' && !ctx.token) rtab = 'all';
        view = 'results';
        recent.add(q);
        clearTimeout(timer);
        if (inflight) { inflight.abort(); inflight = null; }
        if (rflight) rflight.abort();
        const ac = new AbortController();
        rflight = ac;
        el.classList.add('ovs-typing', 'ovs-results-on');
        tabsEl.hidden = true;
        rtabsEl.hidden = false;
        rtabsEl.querySelectorAll('[data-rtab]').forEach((b) => {
            const id = b.getAttribute('data-rtab');
            b.hidden = id === 'mine' && !ctx.token;
            b.setAttribute('aria-selected', String(id === rtab));
        });
        const fast = SCOPES_OF[rtab].concat(rtab === 'all' && ctx.token ? ['mine'] : []);
        const web = rtab === 'all' || rtab === 'web';
        const st = { q, fast: null, web: null, fastDone: !fast.length, webDone: !web, t0: Date.now(), fastMs: 0, webMs: 0 };
        const done = () => { if (st.fastDone && st.webDone && rflight === ac) { rflight = null; el.classList.remove('ovs-busy'); } };
        el.classList.add('ovs-busy');
        paintResults(st);
        if (fast.length) query(q, fast, { depth: 'quick', limit: rtab === 'all' ? 8 : 20, signal: ac.signal }).then((d) => {
            if (ac.signal.aborted) return;
            st.fast = d; st.fastDone = true; st.fastMs = Date.now() - st.t0; paintResults(st); done();
        });
        if (web) query(q, ['web'], { depth: rtab === 'web' ? 'deep' : 'standard', limit: rtab === 'web' ? 15 : 6, signal: ac.signal }).then((d) => {
            if (ac.signal.aborted) return;
            st.web = d; st.webDone = true; st.webMs = Date.now() - st.t0; paintResults(st); done();
        });
    }
    function leaveResults() {
        view = 'suggest';
        if (rflight) { rflight.abort(); rflight = null; }
        el.classList.remove('ovs-results-on');
        rtabsEl.hidden = true;
    }
    /** A fabric result as a row: OpenVibe's with the site's own icon, the web's with its host's letters and who found it. */
    function resultRow(r) {
        const page = r.kind === 'page';
        const host = r.site || hostOf(r.url);
        const meta = page
            ? [host, PROVIDER[r.provider] ? `via ${PROVIDER[r.provider]}` : '', ago(r.published_at)].filter(Boolean)
            : [host, TYPE[r.type] || r.type || '', ago(r.published_at)].filter(Boolean);
        const url = safeUrl(r.url);
        return url ? { title: r.title || host, meta: meta.join(' · '), snippet: r.snippet || '', url, site: page ? null : siteIcon(url), icon: page ? host.replace(/^www\./, '').slice(0, 2) : (host || '?').slice(0, 2), kind: 'result' } : null;
    }
    function paintResults(st) {
        const owner = ctx.scope && ctx.scope.owner;
        const all = (d) => (d && Array.isArray(d.results) ? d.results : []);
        const docs = all(st.fast).filter((r) => r.scope !== 'mine');
        const yours = all(st.fast).filter((r) => r.scope === 'mine').map(resultRow).filter(Boolean);
        const hereRows = owner ? docs.filter((r) => r.owner === owner).map(resultRow).filter(Boolean) : [];
        const rest = docs.filter((r) => !owner || r.owner !== owner).map(resultRow).filter(Boolean);
        const webRows = all(st.web).map(resultRow).filter(Boolean);
        const label = (RTABS.find(([id]) => id === rtab) || [])[1];
        const groups = [];
        if (rtab === 'all' || rtab === 'mine') groups.push({ title: 'Yours', items: yours });
        if (!st.fastDone) groups.push({ title: rtab === 'all' ? 'On OpenVibe' : label, as: 'loading', rows: 3, text: 'Searching OpenVibe' });
        else {
            if (hereRows.length) groups.push({ title: `On ${here()}`, items: hereRows });
            groups.push({ title: rtab === 'all' || rtab === 'openvibe' ? (hereRows.length ? 'Across OpenVibe' : 'On OpenVibe') : label, items: rest });
        }
        if (rtab === 'all' || rtab === 'web') {
            if (!st.webDone) groups.push({ title: 'From the web', as: 'loading', rows: rtab === 'web' ? 5 : 2, text: 'Searching the web' });
            else groups.push({ title: 'From the web', items: webRows });
        }
        const any = yours.length + hereRows.length + rest.length + webRows.length;
        const settled = st.fastDone && st.webDone;
        if (settled && !any) groups.push({ title: '', as: 'note', text: rtab === 'all' ? 'Nothing on OpenVibe or the web for that yet. Try other words, or ask Vibe.' : `Nothing in ${label} for that yet.` });
        groups.push({ title: 'More', items: actions(st.q).filter((a) => a.kind !== 'results') });
        const route = routeLine(st);
        if (route) groups.push({ as: 'route', text: route, items: [] });
        paint(groups);
    }
    /** What answered, in words: "OpenVibe in 40 ms · the web through DeepSeek and Wikipedia in 1.4 s (kept from earlier)". */
    function routeLine(st) {
        const parts = [];
        const secs = (ms) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);
        if (st.fastDone && st.fast) parts.push(`OpenVibe in ${secs(st.fastMs)}`);
        if (st.webDone && st.web && st.web.route && Array.isArray(st.web.route.explain)) {
            const ran = st.web.route.explain.filter((x) => x.scope === 'web' && x.ok && x.count > 0);
            const who = ran.map((x) => PROVIDER[x.step] || x.step).filter((v, i, a) => a.indexOf(v) === i);
            const cached = ran.length && ran.every((x) => x.cached);
            if (who.length) parts.push(`the web through ${who.length > 1 ? `${who.slice(0, -1).join(', ')} and ${who[who.length - 1]}` : who[0]} in ${secs(st.webMs)}${cached ? ' (kept from earlier)' : ''}`);
        }
        return parts.length ? `Searched ${parts.join(' · ')}` : '';
    }

    /** What people pick from the menu (section, position, where it leads), when Network asks for it: no person, no
     *  page, summed per day there, so the menu can learn what helps and spread people across the network. */
    function beacon(it, a) {
        const b = ctx.frame && ctx.frame.menu && typeof ctx.frame.menu.beacon === 'string' ? safeUrl(ctx.frame.menu.beacon) : null;
        if (!b || !navigator.sendBeacon) return;
        const li = a.closest('[data-sec]');
        const sec = li ? li.getAttribute('data-sec') : '';
        const peers = li ? Array.prototype.indexOf.call(li.querySelectorAll('a[data-i]'), a) : -1;
        try { navigator.sendBeacon(b, new Blob([JSON.stringify({ host: location.hostname, section: sec, pos: peers, to: hostOf(it.url), kind: it.kind })], { type: 'text/plain' })); } catch { /* */ }
    }

    function open(opts = {}) {
        if (typeof document === 'undefined') return;
        ctx = opts || {};
        if (!el) build();
        lastFocus = document.activeElement;
        // The tab the person last chose wins; else the one the opener asked for (old names kept: "sites" is this site's
        // tab, whose second half is every site; "tools" is You); else this site.
        // "sites" is a request for the list of every site (the legacy drawer's All sites): it opens this site's tab.
        const asked = { here: 'here', sites: 'here', feed: 'feed', you: 'you', tools: 'you' }[opts.tab];
        tab = opts.tab === 'sites' ? 'here' : (savedTab() || asked || 'here');
        allOpen = false; hereOpen = true; leadHere = false; discoverPick = null;
        drainCards();
        syncFeeds();
        el.classList.add('is-open');
        // Back closes the menu first (the owner, 11-07: pressing Back on a phone left the page instead): opening adds one
        // history entry; Back pops it and only closes the menu.
        try { if (!(history.state && history.state.ovsMenu)) { history.pushState(Object.assign({}, history.state || {}, { ovsMenu: true }), ''); pushed = true; } } catch { pushed = false; }
        // Opened from the navbar's orb: the menu drops from it, under the bar; otherwise centred.
        const at = opts.anchor;
        el.classList.toggle('ovs-anchored', !!at);
        if (at) {
            el.style.setProperty('--ovs-top', `${Math.max(0, Math.round(at.top))}px`); el.style.setProperty('--ovs-left', `${Math.max(8, Math.round(at.left))}px`);
            const cx = Number.isFinite(at.cx) ? at.cx : (Number.isFinite(at.left) ? at.left + 20 : 40);
            const cy = Number.isFinite(at.cy) ? at.cy : (Number.isFinite(at.top) ? Math.max(20, at.top - 28) : 28);
            el.style.setProperty('--ovs-cx', `${Math.round(cx)}px`); el.style.setProperty('--ovs-cy', `${Math.round(cy)}px`);
        }
        try { document.dispatchEvent(new CustomEvent('openvibe-menu', { detail: { open: true } })); } catch { /* */ }
        if (closing) { clearTimeout(closing); closing = 0; el.classList.remove('is-closing'); }
        if (orbEl) {
            orbEl.classList.remove('is-x');
            if (phoneSheet()) {
                // From the button's centre to the pill's right end: the same orb, moving into the menu.
                const cx = Number.isFinite(at && at.cx) ? at.cx : innerWidth - 24, cy = Number.isFinite(at && at.cy) ? at.cy : 28;
                const bar = el.querySelector('.ovs-bar'), br = bar ? bar.getBoundingClientRect() : null;
                const tx = br ? br.right - 26 : cx, ty = br ? br.top + br.height / 2 : cy;
                orbEl.style.setProperty('--orb-x', `${Math.round(tx - 20)}px`); orbEl.style.setProperty('--orb-y', `${Math.round(ty - 20)}px`);
                orbEl.style.setProperty('--orb-dx', `${Math.round(cx - tx)}px`); orbEl.style.setProperty('--orb-dy', `${Math.round(cy - ty)}px`);
                orbEl.classList.add('is-from');
                void orbEl.offsetWidth;
                requestAnimationFrame(() => { orbEl.classList.remove('is-from'); orbEl.classList.add('is-x'); });
            }
        }
        document.documentElement.style.overflow = 'hidden';
        input.placeholder = `Search ${here()}, or ask Vibe`;
        input.value = opts.q || '';
        paintGhost();
        render(input.value);
        // On a phone the orb opens a menu, not a search: focusing the field would raise the keyboard over the menu (owner
        // 11-08), so focus stays on the close orb until the person taps the field. A query, or a computer, still types.
        setTimeout(() => { if (phoneSheet() && !opts.q && !opts.search && orbEl && orbEl.isConnected) orbEl.focus({ preventScroll: true }); else input.focus(); }, 0);
        // What makes it the person's own arrives after the first paint: their history, and the tools catalog.
        mine = null;
        loadHistory().then((h) => { if (h && el.classList.contains('is-open')) { mine = h; paintGhost(); render(input.value); } });
        if (!catalog) loadCatalog().then((c) => { if (c) { catalog = c; if (el.classList.contains('is-open')) render(input.value); } });
        loadPulse().then((d) => { if (d && el.classList.contains('is-open') && !input.value.trim() && view !== 'results') render(''); });
        loadChanges().then((d) => { if (d && el.classList.contains('is-open') && !input.value.trim() && view !== 'results') render(''); });
        if (tab === 'tools' || tab === 'sites') setTimeout(() => { const t = listEl.querySelector(`[data-sec="${tab === 'tools' ? 'tools' : 'all'}"]`); if (t && t.scrollIntoView) t.scrollIntoView({ block: 'start' }); }, 60);
    }
    let pushed = false, popping = false;
    if (typeof window !== 'undefined') window.addEventListener('popstate', () => { if (el && el.classList.contains('is-open')) { popping = true; pushed = false; close(); popping = false; } });
    function close() {
        if (view === 'results' && rtabsEl) leaveResults();
        if (!el || closing) return;
        // Closed by the person (Close, Escape, a tap outside): take back the entry Back would have used.
        if (pushed && !popping) { pushed = false; try { if (history.state && history.state.ovsMenu) history.back(); } catch { /* */ } }
        // A phone's menu folds back into the orb (its x turns back into dots) before it goes; elsewhere it closes at once.
        if (phoneSheet() && !calm() && el.classList.contains('is-open')) {
            el.classList.add('is-closing');
            if (orbEl) { orbEl.classList.remove('is-x'); orbEl.classList.add('is-from'); }
            closing = setTimeout(() => { closing = 0; el.classList.remove('is-open', 'is-closing'); if (orbEl) orbEl.classList.remove('is-from'); }, 280);
        } else {
            el.classList.remove('is-open');
            if (orbEl) orbEl.classList.remove('is-x', 'is-from');
        }
        document.documentElement.style.overflow = '';
        if (inflight) { inflight.abort(); inflight = null; }
        if (ctx && typeof ctx.onClose === 'function') { try { ctx.onClose(); } catch { /* */ } }
        try { document.dispatchEvent(new CustomEvent('openvibe-menu', { detail: { open: false } })); } catch { /* */ }
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    const api = { open, close, suggest, siteOf, registerCard };
    root.OpenVibeSearch = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
