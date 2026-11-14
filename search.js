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
    // When the Feed was last looked at, for its "new since" count (11-09, the owner: "if there's anything new in the feed
    // since last time you've looked… a badge").
    const FEED_SEEN = 'ovs-feed-seen';
    const FEED_COUNT = 'ovs-feed-count';
    const feedSeen = () => { try { return Number(localStorage.getItem(FEED_SEEN)) || 0; } catch { return 0; } };
    function paintFeedDot(count) {
        const orb = document.getElementById('openvibe-burger'); if (!orb) return;
        let dot = orb.querySelector('.ovs-feed-dot');
        if (!dot) { dot = document.createElement('i'); dot.className = 'ovs-feed-dot'; dot.setAttribute('aria-hidden', 'true'); orb.appendChild(dot); }
        dot.hidden = !(Number(count) > 0);
    }
    function paintFeedTabCount(count) {
        if (!el || !el.classList.contains('is-open') || !tabsEl) return;
        const b = tabsEl.querySelector('[data-tab="feed"]'); if (!b) return;
        const old = b.querySelector('.ovs-tabnew'); if (old) old.remove();
        const n = Number(count) || 0;
        if (n) { const badge = document.createElement('b'); badge.className = 'ovs-tabnew'; badge.textContent = n > 9 ? '9+' : String(n); badge.setAttribute('aria-label', `${n} new since you last looked`); (b.querySelector('.ovs-tab-ic') || b).appendChild(badge); }
    }
    let feedChannel;
    try { if (typeof BroadcastChannel === 'function') { feedChannel = new BroadcastChannel('openvibe-feed-seen'); feedChannel.onmessage = (e) => { const n = Number(e.data && e.data.count) || 0; paintFeedDot(n); paintFeedTabCount(n); }; } } catch { feedChannel = null; }
    if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === FEED_COUNT) { paintFeedDot(e.newValue); paintFeedTabCount(e.newValue); } if (e.key === FEED_SEEN) { paintFeedDot(0); paintFeedTabCount(0); } });
    const markFeedSeen = () => {
        try { localStorage.setItem(FEED_SEEN, String(Date.now())); } catch { /* signed out private window */ }
        try { localStorage.setItem(FEED_COUNT, '0'); } catch { /* */ }
        paintFeedDot(0); paintFeedTabCount(0);
        try { feedChannel?.postMessage({ type: 'seen', count: 0, at: feedSeen() }); } catch { /* */ }
    };
    let el = null, input = null, ghost = null, listEl = null, tabsEl = null, ctx = {}, items = [], active = -1, inflight = null, timer = null, lastFocus = null;
    let tab = 'here', mine = null, catalog = null, completion = '';
    // The results view (4.29.0): Enter shows the Search Fabric's answer here, by scope, instead of leaving the page.
    const RTABS = [['all', 'All'], ['openvibe', 'OpenVibe'], ['web', 'Web'], ['video', 'Video'], ['news', 'News'], ['products', 'Products'], ['mine', 'Yours']];
    const PROVIDER = { open_index: 'OpenVibe\'s index', deepseek: 'DeepSeek', wikipedia: 'Wikipedia', brave: 'Brave', exa: 'Exa', tavily: 'Tavily' };
    let view = 'suggest', rtabsEl = null, rq = '', rtab = 'all', rflight = null, moved = false;
    // A place of the Dock shown inside the menu (a phone, 312 step 2): which one, its mount, and AI's part.
    let door = null, doorEl = null, doorHost = null, doorMount = null, runView = null, runFilter = 'all';
    let actsEl = null, actsObs = null, actsTick = 0;

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
    // The site this page is on: the longest matching address, and a site that lives under a path (openvibe.my/inventory)
    // only on that path.
    function hereSite(list) {
        const h = location.hostname.toLowerCase(), at = location.pathname || '/'; let best = null, score = 0;
        for (const s of list) {
            let u; try { u = new URL(s.url); } catch { continue; }
            const sh = u.hostname, sp = u.pathname.replace(/\/+$/, '');
            if (!sh || !(h === sh || h.endsWith(`.${sh}`))) continue;
            if (sp && at !== sp && !at.startsWith(`${sp}/`)) continue;
            const n = sh.length * 1000 + sp.length + 1;
            if (n > score) { best = s; score = n; }
        }
        return best;
    }
    /** The person's own use of each site (their history's counts), for "your sites" and for ranking results. */
    const useOf = (id) => { const s = mine && mine.services.find((x) => x.service === id); return s ? s.count : 0; };

    /** The person's history: one request per opening, kept two minutes (signed in only; anonymous sessions keep none). */
    async function loadHistory() {
        if (!ctx.token || !ctx.user || ctx.user.is_anon) return null;
        const key = `ov_hist2:${ctx.user.id || ctx.user.username || ''}`;
        try { const c = JSON.parse(sessionStorage.getItem(key) || 'null'); if (c && Date.now() - c.at < 120000) return c.data; } catch { /* */ }
        try {
            const r = await fetch(`${ctx.apiBase || 'https://openvibe.network'}/api/history?limit=60`, { headers: { Authorization: `Bearer ${ctx.token}` }, credentials: 'omit' });
            if (!r.ok) return null;
            const j = await r.json();
            const data = {
                items: (j.items || []).map((h) => ({ title: String(h.title || '').slice(0, 160), url: safeUrl(h.url), site: h.service_label || siteOf(h.url), service: h.service, at: utcOf(h.updated_at) })).filter((h) => h.url && h.title),
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

    // Times that keep up while the menu is open (once a minute; nothing runs while it is closed).
    let agoTimer = 0;
    function tickAgo() {
        clearInterval(agoTimer);
        agoTimer = setInterval(() => {
            if (!el || !el.classList.contains('is-open')) { clearInterval(agoTimer); agoTimer = 0; return; }
            el.querySelectorAll('[data-at]').forEach((m) => { const t = ago(m.dataset.at); if (t) m.textContent = [m.dataset.pre, t].filter(Boolean).join(' · '); });
        }, 60000);
    }
    /** A time without a zone is UTC (Network's history and older APIs send "YYYY-MM-DD HH:MM:SS"; a browser reads that as
     *  local time, and west of UTC every visit looked hours ahead: "just now" for all of them, 11-12). */
    function utcOf(t) { const v = String(t || ''); return /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(:\d\d(\.\d+)?)?$/.test(v) ? `${v.replace(' ', 'T')}Z` : v; }
    function ago(iso) {
        const t = Date.parse(utcOf(iso)); if (!isFinite(t)) return '';
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
/* The button becomes its tab (4.200.0): the flight layer above everything, its parts drawn from the two buttons. */
.ovs-fly { position: fixed; inset: 0; z-index: 2147483600; pointer-events: none; }
.ovs-fly-part { position: absolute; display: grid; place-items: center; color: inherit; will-change: transform, opacity, filter; }
.ovs-fly-ring { position: fixed; z-index: 2147483600; border: 2px solid; border-radius: 50%; pointer-events: none; }
.ovs-fly-part > svg, .ovs-fly-part > .ov-icon { width: 100%; height: 100%; }
.ovs-fly-part > img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.ovs-fly-part--count { width: auto !important; height: auto !important; }
.ovs-fly-count { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: #ef4444; color: #fff; font: 800 11px/1 system-ui, sans-serif; }
.ovs-panel { position: absolute; left: 50%; top: 8vh; width: min(720px, calc(100vw - 32px)); max-height: 80vh; transform: translateX(-50%); display: flex; flex-direction: column; border-radius: 18px; border: 1px solid var(--border, rgba(255,255,255,.12)); background: var(--bg-secondary, #121826); box-shadow: 0 30px 80px rgba(0,0,0,.55); overflow: hidden; }
.ovs-bar { display: flex; align-items: center; gap: 10px; margin: 10px 10px 6px; padding: 0 6px 0 14px; border-radius: calc(var(--ov-radius-2, 14px) + 2px); background: var(--bg-primary, rgba(0,0,0,.25)); box-shadow: inset 0 0 0 1px var(--border, rgba(255,255,255,.12)); transition: box-shadow .2s, background .2s; }
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
.ovs-x:focus:not(:focus-visible) { outline: none; }
/* 4.223.0 (the owner, 11-12: "Close … ICON"; "these buttons and borders … get extra wide … make that more sleek"): Close
   is a round × on every screen; the phone's orb keeps a hairline edge and a soft glass, never a thick ring. */
.ovs-x { display: inline-grid; place-items: center; width: 36px; height: 36px; padding: 0; border-radius: 50%; color: var(--text-secondary, #a8b3c4); transition: background-color .15s, color .15s, transform .12s; }
.ovs-x svg { display: block; width: 18px; height: 18px; }
.ovs-x span { display: none; }   /* the button's own aria-label (Close the menu) names it */
.ovs-x:active { transform: scale(.9); }
@media (hover: hover) { .ovs-x:hover { color: var(--text-primary, #e6edf7); background: color-mix(in srgb, var(--text-primary, #e6edf7) 10%, transparent); } }
@media (max-width: 640px) {
  .ovs.ovs-anchored .ovs-orb { background: color-mix(in srgb, var(--bg-secondary, #121826) 72%, transparent); -webkit-backdrop-filter: blur(12px) saturate(1.4); backdrop-filter: blur(12px) saturate(1.4);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--text-primary, #e6edf7) 14%, transparent), 0 8px 22px -10px rgba(0, 0, 0, .6); }
  .ovs.ovs-anchored .ovs-orb.is-x::before { border-width: 1px; }
}
/* Phones and small windows: the menu covers the screen (the bar under it too), so Close is always there, a round x at
   the end of the search pill (the owner, 11-07: "This needs a close button"). The hit area is 48 px. */
@media (max-width: 860px) {
  .ovs-x { position: relative; display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border-radius: 50%; background: var(--bg-hover, rgba(255,255,255,.07)); color: var(--text-secondary, #a8b3c4); }
  .ovs-x::after { content: ""; position: absolute; inset: -4px; }
  .ovs-x svg { display: block; }
  .ovs-x span { display: none; }
  .ovs-x:active { background: var(--bg-active, rgba(255,255,255,.14)); color: var(--text-primary, #fff); }
}
.ovs-tabs { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 12px 8px; border-bottom: 1px solid var(--border, rgba(255,255,255,.1)); }
/* Five places in one row (4.194.0): on a phone each is its icon over its word; the doors to the Dock look like the tabs. */
.ovs-starttabs.has-doors .ovs-tab { padding: 0 6px; }
.ovs-starttabs .ovs-tab[data-dock] .ovs-tab-ic > svg { width: 26px; height: 26px; }
@media (max-width: 640px) { .ovs-starttabs.has-doors { gap: 4px; padding: 2px 8px 8px; } .ovs-starttabs.has-doors .ovs-tab { flex-direction: column; gap: 3px; height: 56px; padding: 4px 2px; font-size: 12.5px; border-radius: 14px; } }
.ovs-bridge { flex: 1 0 100%; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; margin-top: 4px; }
.ovs-bridge-b { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 0; min-height: 44px; padding: 0 6px; border-radius: 12px; cursor: pointer; font-size: 12.5px; font-weight: 650;
  color: var(--text-secondary, #a8b3c4); background: color-mix(in srgb, var(--accent, #3b82f6) 7%, transparent); transition: background-color .15s, color .15s, transform .12s; }
.ovs-bridge-b span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovs-bridge-i { display: grid; place-items: center; flex: none; color: var(--accent-light, var(--accent, #60a5fa)); }
.ovs-bridge-b:hover, .ovs-bridge-b:focus-visible { color: var(--text-primary, #e6edf7); background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); }
.ovs-bridge-b:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
.ovs-bridge-b:active { transform: scale(.96); }
@media (max-width: 640px) { .ovs-bridge-b { flex-direction: column; gap: 2px; min-height: 50px; padding: 4px 2px; font-size: 11.5px; } .ovs-bridge-i svg { width: 19px; height: 19px; } }
/* The menu's three tabs (4.149.0): one segmented row under the field; the chosen one in the accent. */
.ovs-starttabs { gap: 6px; padding: 2px 12px 10px; }
.ovs-starttabs .ovs-tab { flex: 1 1 0; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 38px; padding: 0 10px; border-radius: 12px; font-size: 14px; background: color-mix(in srgb, var(--text-primary, #e6edf7) 5%, transparent); }
.ovs-starttabs .ovs-tab span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovs-starttabs .ovs-tab { height: 42px; gap: 8px; transition: background-color .18s, color .18s; }
.ovs-starttabs .ovs-tab .ovs-tab-ic { position: relative; flex: none; display: grid; place-items: center; width: 22px; height: 22px; overflow: visible; }
.ovs-tab-ic > svg { width: 20px; height: 20px; }
.ovs-tab-ic .ov-icon { display: grid; place-items: center; }
/* 4.236.0, the tab's nudge: this site's tab rolls its glyph and name through the places in its section, and back. */
.ovs-tab .ovs-roll { animation: ovsRoll .38s cubic-bezier(.2, .9, .25, 1); }
@keyframes ovsRoll { from { opacity: 0; transform: translateY(65%); } 60% { opacity: 1; } }
.ovs-tab.is-rolling > span:not(.ovs-tab-ic) { color: var(--accent-light, var(--accent, #60a5fa)); transition: color .3s; }
html[data-ov-motion=off] .ovs-tab .ovs-roll { animation: none; }
/* The site's tab wears its glyph like Feed and You (owner, 11-09): no disc and no ring, the glyph at their weight and in
   the label's colour. The icon's box is drawn larger than the slot so the solid glyph itself is about 18 px. */
.ovs-tab-ic .ov-icon .ovi-bg, .ovs-tab-ic .ov-icon .ovi-ring, .ovs-tab-ic .ov-icon .ovi-comet, .ovs-tab-ic .ov-icon .ovi-prog { display: none; }
.ovs-tab-ic .ov-icon { --ovi-glyph: currentColor; color: currentColor; width: 22px; height: 22px; overflow: visible; }
.ovs-tab-ic .ov-icon svg { width: 40px; height: 40px; margin: -9px; flex: none; }
@media (max-width: 420px) { .ovs-starttabs .ovs-tab { padding: 0 7px; gap: 6px; font-size: 13.5px; } }
.ovs-tab-av { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; display: block; box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--text-primary, #e6edf7) 18%, transparent); }
.ovs-tab[aria-selected="true"] .ovs-tab-av { box-shadow: 0 0 0 2px var(--accent, #3b82f6); }
.ovs-tab-on { position: absolute; right: -2px; bottom: -2px; width: 8px; height: 8px; border-radius: 50%; background: var(--success, #22c55e); box-shadow: 0 0 0 2px var(--bg-secondary, #111826); }
.ovs-tabnew { flex: none; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; font: 750 11px/18px Inter, system-ui, sans-serif; letter-spacing: -.01em; text-align: center; font-variant-numeric: tabular-nums; color: #fff; box-shadow: 0 0 0 2px var(--bg-secondary, #141a24), 0 3px 8px -2px rgba(0, 0, 0, .55); animation: ovsBadgeIn .3s cubic-bezier(.34, 1.56, .64, 1); background: var(--accent, #3b82f6); }
.ovs-tabnew-red { background: var(--danger, #ef4444); }
.openvibe-navbar .ovnav-orb .ovs-feed-dot { position: absolute; top: 2px; right: 2px; width: 7px; height: 7px; border-radius: 50%; background: var(--accent-light, var(--accent, #60a5fa)); }
.openvibe-navbar .ovnav-orb .ovs-feed-dot[hidden] { display: none; }
.ovs-tabdot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--live-red, #ef4444); box-shadow: 0 0 0 3px color-mix(in srgb, var(--live-red, #ef4444) 22%, transparent); }
/* 4.237.0: one badge for every count in the menu (the You tab's, Feed's, Notifications'), on the icon's corner; the live
   dot after the word, breathing. */
.ovs-tab-ic > .ovs-tabnew { position: absolute; top: -7px; left: calc(100% - 8px); z-index: 1; }
.ovs-tab span > .ovs-tabdot { display: inline-block; margin: 0 0 1px 5px; vertical-align: middle; animation: ovsLiveDot 2s ease-in-out infinite; }
.ovs-tab > span:not(.ovs-tab-ic) { display: inline-flex; align-items: center; }
/* 4.238.0, round two (the owner, 11-13: "the icons aren't big enough, not even nearly"): the place tabs' glyphs grow,
   24 px beside the word and 30 px over it on a phone. */
.ovs-starttabs .ovs-tab .ovs-tab-ic, .ovs-starttabs .ovs-tab .ovs-tab-ic .ov-icon { width: 24px; height: 24px; }
.ovs-starttabs .ovs-tab .ovs-tab-ic > svg, .ovs-starttabs .ovs-tab[data-dock] .ovs-tab-ic > svg { width: 24px; height: 24px; }
.ovs-starttabs .ovs-tab .ovs-tab-ic .ov-icon svg { width: 44px; height: 44px; margin: -10px; }
@media (max-width: 640px) {
  .ovs-starttabs.has-doors .ovs-tab { height: 54px; gap: 2px; font-size: 12px; }
  .ovs-starttabs.has-doors { padding-bottom: 6px; }
  .ovs-starttabs.has-doors .ovs-tab .ovs-tab-ic, .ovs-starttabs.has-doors .ovs-tab .ovs-tab-ic .ov-icon { width: 30px; height: 30px; }
  .ovs-starttabs.has-doors .ovs-tab .ovs-tab-ic > svg, .ovs-starttabs.has-doors .ovs-tab[data-dock] .ovs-tab-ic > svg { width: 30px; height: 30px; }
  .ovs-starttabs.has-doors .ovs-tab .ovs-tab-ic .ov-icon svg { width: 54px; height: 54px; margin: -12px; }
}
@keyframes ovsLiveDot { 50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--live-red, #ef4444) 10%, transparent); } }
@keyframes ovsBadgeIn { from { transform: scale(.5); opacity: 0; } }
html[data-ov-motion=off] .ovs-tab span > .ovs-tabdot, html[data-ov-motion=off] .ovs-tabnew { animation: none; }
.ovs-grid.is-mini { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; padding: 0 2px 4px; }
.ovs-grid.is-mini .ovs-tile { gap: 8px; min-height: 40px; padding: 4px 8px; border-radius: 10px; }
.ovs-grid.is-mini .ovs-ic { width: 26px; height: 26px; border-radius: 8px; }
.ovs-grid.is-mini .ovs-tile b { font-size: 13.5px; font-weight: 650; }
/* 4.189.0: the sites in their groups are full touch targets with a larger mark, and each group's name runs into a
   hairline, so the list reads as sections and not as one long column of small rings. */
.ovs-grid.is-mini { gap: 4px; }
.ovs-grid.is-mini .ovs-tile { min-height: 48px; padding: 6px 8px; border-radius: 12px; transition: background-color .15s, transform .12s; }
/* 4.222.0: a site's whole name, never "Downlo…" or "Commu…": a long name takes a second line instead of an ellipsis. */
.ovs-grid.is-mini .ovs-tile b { white-space: normal; text-overflow: clip; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.15; overflow-wrap: anywhere; }
.ovs-grid.is-mini .ovs-tile:active { transform: scale(.97); }
.ovs-grid.is-mini .ovs-ic { width: 32px; height: 32px; border-radius: 10px; }
/* 4.202.0: on a phone a site's name sits under its mark, so the whole name shows (Download, Community: not "Downlo…"). */
@media (max-width: 480px) { .ovs-grid.is-mini .ovs-tile { flex-direction: column; justify-content: center; gap: 5px; min-height: 64px; padding: 6px 2px 5px; text-align: center; } .ovs-grid.is-mini .ovs-tile b { max-width: 100%; font-size: 12.5px; } }
.ovs-group[data-sec="all"] { display: flex; align-items: center; gap: 10px; }
/* 4.223.0 (the owner, 11-12: "the icons are so small, they're hard to see … make the icons bigger so they actually take up
   more of the square … fix the alignment"): a site's icon is an app icon in every tab — its own hue on a rounded square,
   the glyph at 58% of it, placed absolutely so no hover transform can move it off centre. */
.ovs .ovs-ic.ovs-site { position: relative; overflow: hidden; border-radius: 30%; background: linear-gradient(150deg, hsl(var(--ovs-h, 215) 72% 58% / .36), hsl(var(--ovs-h, 215) 70% 38% / .2)); box-shadow: inset 0 0 0 1px hsl(var(--ovs-h, 215) 70% 64% / .3); }
.ovs .ovs-ic.ovs-site .ovi-ring, .ovs-ic.ovs-site .ovi-bg, .ovs-ic.ovs-site .ovi-comet, .ovs-ic.ovs-site .ovi-prog { display: none; }
.ovs .ovs-ic.ovs-site > .ov-icon { position: absolute; inset: 0; width: 100%; height: 100%; display: block; --ovi-glyph: hsl(var(--ovs-h, 215) 92% 84%); color: hsl(var(--ovs-h, 215) 92% 84%); }
:root[data-theme="light"] .ovs .ovs-ic.ovs-site > .ov-icon { --ovi-glyph: hsl(var(--ovs-h, 215) 70% 30%); color: hsl(var(--ovs-h, 215) 70% 30%); }
.ovs .ovs-ic.ovs-site > .ov-icon svg { position: absolute; left: -13%; top: -13%; width: 126%; height: 126%; margin: 0; transform: none !important; }
/* The site list: a grid of app icons, four across on a phone and as many as fit beyond, names on two balanced lines. */
.ovs-grid.is-mini { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px; padding: 2px 0 6px; }
@media (min-width: 560px) { .ovs-grid.is-mini { grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); } }
.ovs-grid.is-mini .ovs-tile { flex-direction: column; justify-content: flex-start; align-items: center; gap: 7px; min-height: 0; padding: 6px 0 8px; border-radius: 16px; text-align: center; background: transparent; }
.ovs-grid.is-mini .ovs-tile > span:last-child { max-width: 100%; }
.ovs-grid.is-mini .ovs-ic { width: min(100% - 14px, 64px); height: auto; aspect-ratio: 1; border-radius: 29%; transition: transform .22s cubic-bezier(.2, 1.4, .4, 1), box-shadow .22s; }
.ovs-grid.is-mini .ovs-tile b { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 100%; white-space: normal; text-overflow: clip; font-size: 12px; font-weight: 650; line-height: 1.2; text-wrap: balance; }
.ovs-grid.is-mini .ovs-tile.is-here { background: color-mix(in srgb, var(--accent, #3b82f6) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, #3b82f6) 35%, transparent); }
.ovs-grid.is-mini .ovs-tile:active .ovs-ic { transform: scale(.93); transition-duration: .08s; }
@media (hover: hover) { .ovs-grid.is-mini .ovs-tile:hover { background: transparent; } .ovs-grid.is-mini .ovs-tile:hover .ovs-ic { transform: translateY(-3px) scale(1.04); box-shadow: inset 0 0 0 1px hsl(var(--ovs-h, 215) 75% 70% / .5), 0 12px 26px -8px hsl(var(--ovs-h, 215) 75% 45% / .6); } }
html[data-ov-motion=off] .ovs-grid.is-mini .ovs-ic { transition: none; }
/* Each section of sites wears its glyph. */
.ovs-group-ic { order: -1; flex: none; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 8px; background: color-mix(in srgb, var(--accent, #3b82f6) 15%, transparent); color: var(--accent-light, var(--accent, #60a5fa)); }
.ovs-group-ic svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2.1; stroke-linecap: round; stroke-linejoin: round; }
/* Names in the brand face (openvibe.design rule: a place's or an app's name in OV Brand 800; words you read in the UI
   face): the site list, the tabs, Vibe's switch. */
.ovs-grid.is-mini .ovs-tile b, .ovs-starttabs .ovs-tab { font-family: 'OV Brand', Nunito, Inter, -apple-system, BlinkMacSystemFont, sans-serif; font-weight: 800; letter-spacing: .005em; }
.ovs-grid.is-mini .ovs-tile b { font-size: 13px; color: color-mix(in srgb, var(--text-primary, #e6edf7) 92%, transparent); }
.ovs-group[data-sec="all"] { font-family: 'OV Brand', Nunito, Inter, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13.5px; font-weight: 800; letter-spacing: .01em; text-transform: none; color: var(--text-primary, #e6edf7); }
/* A slow light drifts behind the menu (Calm slows it, only Off stops it; openvibe.design: calm reduces, only off removes). */
/* 4.223.1: the panel clips its light (overflow: clip is never a scroll container; hidden was, and a focus inside it
   scrolled the whole panel up, taking the search field and the tabs off the screen). */
.ovs-panel { isolation: isolate; overflow: clip; }
.ovs-panel::before { content: ""; position: absolute; inset: -20%; z-index: -1; pointer-events: none; opacity: .5;
  background: radial-gradient(38% 30% at 20% 10%, color-mix(in srgb, var(--accent, #3b82f6) 22%, transparent), transparent 70%), radial-gradient(34% 28% at 85% 30%, color-mix(in srgb, #a855f7 16%, transparent), transparent 70%), radial-gradient(40% 32% at 50% 95%, color-mix(in srgb, #14b8a6 12%, transparent), transparent 70%);
  animation: ovs-drift 26s ease-in-out infinite alternate; }
@keyframes ovs-drift { from { transform: translate3d(-3%, -2%, 0) rotate(0deg); } to { transform: translate3d(3%, 2%, 0) rotate(8deg); } }
html[data-ov-motion=reduced] .ovs-panel::before { animation-duration: 60s; }
html[data-ov-motion=off] .ovs-panel::before { animation: none; }
:root[data-theme="light"] .ovs-panel::before { opacity: .35; }
.ovs-group[data-sec="all"]::after { content: ""; flex: 1; height: 1px; background: var(--border, rgba(255,255,255,.1)); }
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
/* A place of the Dock inside the menu (312 step 2, a phone): it fills the sheet under the head and scrolls itself. */
.ovs-door { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.ovs-door[hidden] { display: none; }
.ovs-door-host { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
/* A place's actions in the search pill (4.200.0); the panel's own row of them is hidden inside the menu. */
.ovs-acts { display: flex; flex: none; gap: 2px; }
.ovs-acts:empty, .ovs-door-host .ovdk-bar { display: none; }
/* One UI (4.220.0; the owner, 11-12: "part of the one UI instead of having two different areas"): inside the menu a place has
   no head of its own. A conversation keeps a slim way back and its name; its actions are the search pill's; its mark is the
   greeting's; no band, no border. */
.ovs-door-host .ovdk-thread-h { min-height: 40px; padding: 2px 12px 2px 6px; gap: 4px; border-bottom: 0; }
.ovs-door-host .ovdk-thread-h > .ovdk-ib, .ovs-door-host .ovdk-vibe-h .ovdk-vibe-mark, .ovs-door-host .ovdk-vibe-name small { display: none; }
.ovs-door-host .ovdk-thread-h .ovdk-back, .ovs-door-host .ovdk-vibe-h .ovdk-vibe-back { width: 36px; height: 36px; min-width: 36px; min-height: 36px; }
.ovs-door-host .ovdk-thread-h b, .ovs-door-host .ovdk-vibe-name b { font-size: 14px; font-weight: 700; color: var(--text-secondary, #b4c0d4); }
.ovs-door-host .ovdk-vibe-start { padding-top: 2px; }

.ovs-act { width: 40px; height: 40px; display: grid; place-items: center; border: 0; border-radius: 50%; background: transparent; color: var(--text-secondary, #b6b6c0); cursor: pointer; }
.ovs-act svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; }
.ovs-act:hover, .ovs-act:focus-visible { background: var(--hover-bg, rgba(127,127,127,.14)); color: var(--text-primary, #ececf1); }
.ovs-act.is-new { background: color-mix(in srgb, var(--accent, #3b82f6) 18%, transparent); color: var(--accent-light, var(--accent, #60a5fa)); }
.ovs-door-host > .ovdk { flex: 1 1 auto; min-height: 0; }
/* 4.225.0: Vibe's runs fill the place under the menu's head (ov-run.js keeps its own filters, thread and box). */
.ovs-door-host > .ovr { flex: 1 1 auto; min-height: 0; padding: 8px 10px 10px; box-sizing: border-box; }
.ovs-door-wait { margin: 18px 16px; font-size: 14px; color: var(--text-muted, #93a0b4); }
@media (min-width: 641px) { .ovs.ovs-in-door .ovs-panel { height: min(820px, 86vh); max-height: 86vh; } .ovs.ovs-in-door .ovs-foot { display: none; } }
.ovs-in-door .ovs-foot { display: none; }
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
/* This site's pages: named as such, in the case they are written in, behind a dot that says "you are here"; each a tile. */
.ovs-group[data-sec="here"] { gap: 9px; padding-top: 12px; font-size: 13.5px; font-weight: 750; letter-spacing: 0; text-transform: none; color: var(--text-secondary, #a8b3c4); }
.ovs-group[data-sec="here"]::before { content: ""; flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--accent-light, var(--accent, #60a5fa)); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent, #3b82f6) 22%, transparent); animation: ovs-here 2.4s ease-in-out infinite; }
@keyframes ovs-here { 50% { box-shadow: 0 0 0 calc(4px + 3px * var(--ov-move, 1)) color-mix(in srgb, var(--accent, #3b82f6) 8%, transparent); } }
.ovs-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; padding: 2px 4px 6px; }
.ovs-link { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 46px; padding: 0 12px; border-radius: 12px; color: inherit; text-decoration: none; font-size: 14px; font-weight: 600; background: color-mix(in srgb, var(--text-primary, #e6edf7) 4.5%, transparent); transition: background-color .15s, transform .12s; }
.ovs-link:hover { background: color-mix(in srgb, var(--text-primary, #e6edf7) 9%, transparent); }
.ovs-link:active { transform: scale(.97); }
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
/* 4.201.0's look: Notifications' head in You; the Timer under Vibe; the Dock's actions in You. */
.ovs-nhead { display: flex; align-items: center; gap: 8px; padding: 10px 14px 6px; }
.ovs-nhead b { font-size: 13px; font-weight: 750; letter-spacing: .04em; text-transform: uppercase; color: var(--text-secondary, #a8b3c4); }
.ovs-nhead-n { padding: 2px 8px; border-radius: 999px; background: var(--live-red, #ef4444); color: #fff; font-size: 11.5px; font-weight: 750; }
.ovs-nhead-n[hidden], .ovs-nhead-more[hidden] { display: none; }
.ovs-nhead-more { margin-left: auto; min-height: 32px; padding: 0 10px; border: 0; border-radius: 9px; background: none; color: var(--accent-light, var(--accent, #60a5fa)); font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; }
.ovs-nhead-more:hover, .ovs-nhead-more:focus-visible { background: color-mix(in srgb, var(--accent, #3b82f6) 14%, transparent); }
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
.ovs-guest { display: grid; gap: 8px; }
.ovs-guest b { font-size: 15px; font-weight: 650; }
.ovs-guest ul { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; color: var(--text-secondary, #a8b3c4); font-size: 13.5px; line-height: 1.4; }
.ovs-guest li::before { content: ''; display: inline-block; width: 6px; height: 6px; margin: 0 8px 1px 2px; border-radius: 50%; background: var(--accent, #3b82f6); }
.ovs-guest a.ovs-guest-go { justify-self: start; display: inline-flex; align-items: center; min-height: 44px; padding: 0 18px; border-radius: 12px; background: var(--accent, #3b82f6); color: var(--on-accent, #fff); font-weight: 650; text-decoration: none; }
.ovs-guest a.ovs-guest-go:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
.ovs-cardbody { border-radius: 16px; border: 1px solid var(--border, rgba(255,255,255,.12)); background: color-mix(in srgb, var(--text-primary, #e8ecf3) 4%, transparent); padding: 12px 14px; }
.ovs-displayrow { padding: 4px 8px 10px; }
.ovs-displayrow .ovnav-display { margin-top: 4px; }
.ovs-host { display: block; margin-top: 2px; font-size: 11px; font-weight: 650; letter-spacing: .01em; color: color-mix(in srgb, var(--accent, #3b82f6) 60%, var(--text-muted, #93a0b4)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovs-group .ovs-more { margin-left: auto; color: var(--accent-light, #8ab4ff); font-size: 11.5px; font-weight: 650; text-transform: none; letter-spacing: 0; text-decoration: none; }
@media (hover: hover) { .ovs-app:hover, .ovs-link:hover, .ovs-live:hover, .ovs-fold:hover { background: var(--bg-hover, rgba(255,255,255,.07)); color: inherit; } .ovs-app:hover .ovs-appic { transform: translateY(-2px); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, #3b82f6) 45%, transparent); } }
@media (max-width: 640px) { .ovs-apps { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (pointer: coarse) { .ovs-chip { height: 44px; } .ovs-group button, .ovs-group .ovs-more { min-height: 44px; display: inline-flex; align-items: center; } }
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
/* It grows out of the button that was pressed (4.195.0; the owner: "go … to the proper element … what you clicked on"): its
   origin is that button's centre, wherever the panel was clamped to (it unfolded from its left corner, though the button is at
   the right since 4.193.0), on the dropdown's own curve. */
.ovs.ovs-anchored .ovs-panel { --ovs-pl: clamp(8px, var(--ovs-left, 12px), calc(100vw - min(720px, calc(100vw - 16px)) - 8px)); top: 8px; left: var(--ovs-pl); transform: none; transform-origin: calc(var(--ovs-cx, 40px) - var(--ovs-pl)) 0; max-height: calc(100dvh - var(--ovs-top, 0px) - 24px); animation: ovs-drop .26s cubic-bezier(.2, 1.25, .3, 1); }
@keyframes ovs-drop { from { opacity: 0; transform: translateY(-6px) scale(.9); } to { opacity: 1; transform: none; } }
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
/* 4.238.0, the top as a composer: the lead (your Actor's face with its state), the tools inside the pill, the Actor's card
   under it; the close orb beside the pill on a phone, a solid disc with a bold x. */
.ovs-lead { all: unset; box-sizing: border-box; position: relative; flex: none; display: grid; place-items: center; width: 36px; height: 36px; margin-left: -4px; border-radius: 50%; color: var(--text-muted, #93a0b4); }
.ovs-lead > svg { width: 20px; height: 20px; }
.ovs-lead-on { position: absolute; right: 2px; bottom: 2px; width: 10px; height: 10px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 2px var(--bg-secondary, #121826); }
.ovs-lead.is-you { cursor: pointer; height: 40px; -webkit-tap-highlight-color: transparent; transition: transform .18s cubic-bezier(.3, 1.4, .4, 1); }
.ovs-lead.is-you:active { transform: scale(.92); }
.ovs-lead.is-you:focus-visible { outline: 2px solid var(--accent-light, var(--accent, #60a5fa)); outline-offset: 2px; }
.ovs-lead-face { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; overflow: hidden; font: 800 14px/1 Inter, system-ui, sans-serif; color: #fff;
  background: linear-gradient(135deg, var(--accent, #3b82f6), color-mix(in oklab, var(--accent, #3b82f6) 50%, #a855f7)); box-shadow: 0 0 0 2px var(--bg-secondary, #121826); }
.ovs-lead-face img { width: 100%; height: 100%; object-fit: cover; }
.ovs-lead-me { position: relative; flex: none; display: grid; place-items: center; z-index: 4; }
.ovs-lead.is-you { display: inline-flex; align-items: center; width: auto; min-width: 40px; padding: 0 2px; }
/* What runs for you, stacked behind your picture: each a small face with its state on a ring (a comet while it works,
   amber while it waits for you). They fan out from behind you as the menu opens. */
.ovs-stack { display: inline-flex; align-items: center; margin-left: -4px; padding-right: 5px; }
.ovs-stack-f, .ovs-stack-more { position: relative; flex: none; display: grid; place-items: center; width: 24px; height: 24px; margin-left: -5px; border-radius: 50%; z-index: calc(3 - var(--i, 0));
  color: #fff; background: linear-gradient(140deg, hsl(var(--h, 220) 70% 56%), hsl(calc(var(--h, 220) + 40) 65% 40%)); box-shadow: 0 0 0 2px var(--bg-secondary, #121826);
  animation: ovs-fan .42s cubic-bezier(.2, 1.3, .3, 1) both; animation-delay: calc(90ms + var(--i, 0) * 70ms); }
.ovs-stack-f:first-child { margin-left: 0; }
.ovs-stack-f img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.ovs-stack-f svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.1; stroke-linecap: round; stroke-linejoin: round; }
.ovs-stack-more { align-self: flex-start; width: auto; min-width: 17px; height: 17px; margin: -3px 0 0 -9px; padding: 0 4px; box-sizing: border-box; border-radius: 999px; z-index: 5; background: var(--text-primary, #e6edf7); color: var(--bg-primary, #0b0f19); font: 800 10px/17px Inter, system-ui, sans-serif; letter-spacing: -.02em; }
@keyframes ovs-fan { from { opacity: 0; transform: translateX(-16px) scale(.5); } }
.ovs-stack-f.is-working::after, .ovs-active-f.is-working::after { content: ""; position: absolute; inset: -3px; border-radius: 50%; pointer-events: none;
  background: conic-gradient(from 0deg, transparent 0 50%, color-mix(in srgb, var(--accent-light, #60a5fa) 70%, transparent) 80%, #fff 100%);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px)); mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px));
  animation: ovs-comet 1.25s linear infinite; }
@keyframes ovs-comet { to { transform: rotate(360deg); } }
.ovs-stack-f.is-asks, .ovs-active-f.is-asks { box-shadow: 0 0 0 2px var(--bg-secondary, #121826), 0 0 0 4px #f59e0b; }
.ovs-stack-f.is-asks { animation: ovs-fan .42s cubic-bezier(.2, 1.3, .3, 1) both, ovs-asks 2.2s ease-in-out 1s infinite; animation-delay: calc(90ms + var(--i, 0) * 70ms), 1s; }
@keyframes ovs-asks { 50% { box-shadow: 0 0 0 2px var(--bg-secondary, #121826), 0 0 0 4px #f59e0b, 0 0 0 8px color-mix(in srgb, #f59e0b 22%, transparent); } }
html[data-ov-motion=reduced] .ovs-stack-f.is-working::after, html[data-ov-motion=reduced] .ovs-active-f.is-working::after { animation-duration: 2.6s; }
html[data-ov-motion=reduced] .ovs-stack-f, html[data-ov-motion=reduced] .ovs-stack-more { animation-duration: .2s; animation-delay: 0s; }
html[data-ov-motion=off] .ovs-stack-f, html[data-ov-motion=off] .ovs-stack-more { animation: none; }
html[data-ov-motion=off] .ovs-stack-f.is-working::after, html[data-ov-motion=off] .ovs-active-f.is-working::after { animation: none; background: var(--accent-light, #60a5fa); opacity: .8; }
/* Your sheet's rows of what is running. */
.ovs-active { display: grid; gap: 4px; }
.ovs-active-h { margin: 2px 6px 0; font: 800 11.5px/1.4 'OV Brand', Nunito, Inter, system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted, #7c8aa0); }
.ovs-active-row { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 12px; width: 100%; min-height: 54px; padding: 6px 10px 6px 8px; border-radius: 16px; cursor: pointer; -webkit-tap-highlight-color: transparent;
  background: color-mix(in srgb, var(--text-primary, #e6edf7) 4%, transparent); transition: background-color .15s, transform .15s cubic-bezier(.3, 1.4, .4, 1); }
.ovs-active-row:focus-visible { outline: 2px solid var(--accent-light, var(--accent, #60a5fa)); outline-offset: 1px; }
@media (hover: hover) { .ovs-active-row:hover { background: color-mix(in srgb, var(--accent, #3b82f6) 12%, transparent); } }
.ovs-active-row:active { transform: scale(.985); }
.ovs-active-f { position: relative; flex: none; display: grid; place-items: center; width: 36px; height: 36px; margin: 3px; border-radius: 50%; color: #fff; background: linear-gradient(140deg, hsl(var(--h, 220) 70% 56%), hsl(calc(var(--h, 220) + 40) 65% 40%)); }
.ovs-active-f img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.ovs-active-f svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.ovs-active-t { flex: 1 1 auto; min-width: 0; display: grid; line-height: 1.3; }
.ovs-active-t b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 800 14.5px/1.3 'OV Brand', Nunito, Inter, system-ui, sans-serif; color: var(--text-primary, #e6edf7); }
.ovs-active-t small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; color: var(--text-secondary, #a8b3c4); }
.ovs-active-st { flex: none; font: 750 11.5px/1 Inter, system-ui, sans-serif; font-style: normal; padding: 6px 9px; border-radius: 999px; color: var(--accent-light, #93c5fd); background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); }
.ovs-active-st.is-asks { color: #fbbf24; background: color-mix(in srgb, #f59e0b 18%, transparent); }
/* The sheet's parts rise in, one after the other. */
.ovs-youpanel > * { animation: ovs-rise .3s cubic-bezier(.2, .8, .2, 1) both; }
.ovs-youpanel > :nth-child(2) { animation-delay: .05s; } .ovs-youpanel > :nth-child(3) { animation-delay: .1s; }
@keyframes ovs-rise { from { opacity: 0; transform: translateY(8px); } }
html[data-ov-motion=off] .ovs-youpanel > * { animation: none; }
.ovs-tools { flex: none; display: flex; align-items: center; gap: 4px; }
.ovs-tool { all: unset; box-sizing: border-box; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; cursor: pointer; color: var(--text-secondary, #a8b3c4); -webkit-tap-highlight-color: transparent;
  transition: background-color .15s, color .15s, transform .15s cubic-bezier(.3, 1.4, .4, 1); }
.ovs-tool[hidden] { display: none; }
.ovs-tool svg { width: 22px; height: 22px; }
.ovs-tool:focus-visible { outline: 2px solid var(--accent-light, var(--accent, #60a5fa)); outline-offset: 1px; }
@media (hover: hover) { .ovs-tool:hover { color: var(--text-primary, #e6edf7); background: color-mix(in srgb, var(--text-primary, #e6edf7) 9%, transparent); } }
.ovs-tool:active { transform: scale(.9); }
.ovs-plus { overflow: visible; }
.ovs-plus-x path { fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; transform-box: view-box; transform-origin: 12px 12px; transition: transform .28s cubic-bezier(.3, 1.5, .4, 1); }
.ovs-plus-x { transform-box: view-box; transform-origin: 12px 12px; transition: transform .45s cubic-bezier(.3, 1.6, .4, 1); }
.ovs-plus-p circle { fill: var(--accent-light, var(--accent, #60a5fa)); transform-box: fill-box; transform-origin: center; transform: scale(0); opacity: 0; transition: transform .3s cubic-bezier(.3, 1.6, .4, 1), opacity .2s; }
@media (hover: hover) {
  .ovs-attach:hover .ovs-plus-h { transform: scaleX(1.12); } .ovs-attach:hover .ovs-plus-v { transform: scaleY(1.12); }
  .ovs-attach:hover .ovs-plus-p circle { transform: scale(.75); opacity: .9; }
}
.ovs-attach:focus-visible .ovs-plus-p circle { transform: scale(.75); opacity: .9; }
.ovs-attach:active .ovs-plus-x { transform: scale(.82); }
.ovs-attach.is-bloom .ovs-plus-x { transform: rotate(90deg); }
.ovs-attach.is-bloom .ovs-plus-p circle { animation: ovs-plus-burst .55s cubic-bezier(.2, .8, .3, 1) both; }
.ovs-attach.is-bloom .ovs-plus-p circle:nth-child(1) { --dx: -7px; --dy: -7px; } .ovs-attach.is-bloom .ovs-plus-p circle:nth-child(2) { --dx: 7px; --dy: -7px; }
.ovs-attach.is-bloom .ovs-plus-p circle:nth-child(3) { --dx: -7px; --dy: 7px; } .ovs-attach.is-bloom .ovs-plus-p circle:nth-child(4) { --dx: 7px; --dy: 7px; }
@keyframes ovs-plus-burst { 0% { transform: scale(1.15); opacity: 1; } 55% { opacity: .95; } 100% { transform: translate(var(--dx, 0), var(--dy, 0)) scale(.25); opacity: 0; } }
html[data-ov-motion=reduced] .ovs-attach.is-bloom .ovs-plus-p circle { animation-duration: .9s; }
html[data-ov-motion=reduced] .ovs-attach.is-bloom .ovs-plus-p circle:nth-child(1) { --dx: -2px; --dy: -2px; } html[data-ov-motion=reduced] .ovs-attach.is-bloom .ovs-plus-p circle:nth-child(2) { --dx: 2px; --dy: -2px; }
html[data-ov-motion=reduced] .ovs-attach.is-bloom .ovs-plus-p circle:nth-child(3) { --dx: -2px; --dy: 2px; } html[data-ov-motion=reduced] .ovs-attach.is-bloom .ovs-plus-p circle:nth-child(4) { --dx: 2px; --dy: 2px; }
html[data-ov-motion=reduced] :is(.ovs-plus-x, .ovs-plus-x path) { transition-timing-function: ease-out; }
html[data-ov-motion=off] :is(.ovs-plus-x, .ovs-plus-x path, .ovs-plus-p circle) { transition: none; animation: none !important; }
.ovs-send { color: #fff; background: linear-gradient(160deg, color-mix(in srgb, var(--accent, #3b82f6) 72%, #fff), var(--accent, #3b82f6) 50%, color-mix(in srgb, var(--accent, #3b82f6) 78%, #000)); box-shadow: inset 0 1px 0 rgba(255,255,255,.38), inset 0 -2px 0 rgba(0,0,0,.22), 0 8px 18px -8px color-mix(in srgb, var(--accent, #3b82f6) 85%, transparent); animation: ovs-send-in .22s cubic-bezier(.3, 1.4, .4, 1); }
@media (hover: hover) { .ovs-send:hover { color: var(--on-accent, #fff); background: var(--accent-hover, color-mix(in oklab, var(--accent, #3b82f6) 85%, #fff)); } }
@keyframes ovs-send-in { from { transform: scale(.5); opacity: 0; } }
.ovs-mic.is-on { color: #fff; background: var(--live-red, #ef4444); animation: ovs-mic 1.2s ease-in-out infinite; }
@keyframes ovs-mic { 50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--live-red, #ef4444) 25%, transparent); } }
html[data-ov-motion=off] .ovs-send, html[data-ov-motion=off] .ovs-mic.is-on { animation: none; }
.ovs-panel { position: relative; }
/* The list fills the menu's height (You's notifications put their foot at the bottom: the owner, 11-13: "take up the full height properly"). */
.ovs-panel > .ovs-list { flex: 1 1 auto; min-height: 0; }
.ovs-youpanel { position: absolute; z-index: 6; left: 8px; right: 8px; top: var(--ovs-you-top, 64px); max-height: calc(100% - var(--ovs-you-top, 64px) - 12px); overflow: auto; overscroll-behavior: contain;
  display: grid; gap: 8px; padding: 10px; border-radius: 22px; background: var(--bg-elevated, var(--bg-secondary, #141a26));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text-primary, #e6edf7) 9%, transparent), 0 24px 60px -18px rgba(0, 0, 0, .75); transform-origin: 32px 0; animation: ovs-drop .24s cubic-bezier(.2, .8, .2, 1); }
.ovs-youpanel[hidden] { display: none; }
@keyframes ovs-drop { from { opacity: 0; transform: translateY(-8px) scale(.96); } }
html[data-ov-motion=off] .ovs-youpanel { animation: none; }
@media (max-width: 640px) { .ovs-bar { gap: 8px; padding: 0 4px 0 8px; } .ovs-bar .ovs-input::placeholder { font-size: 15px; } .ovs-tools { gap: 0; } .ovs-tool { width: 36px; height: 36px; } }
.ovs-orb { display: none; }
.ovs-foot kbd svg { width: 12px; height: 12px; vertical-align: -1px; }
@media (max-width: 640px) {
  .ovs.ovs-anchored .ovs-x { display: none; }
  .ovs.ovs-anchored .ovs-bar { margin-right: 58px; }
  .ovs.ovs-anchored .ovs-orb { position: fixed; z-index: 3; left: var(--orb-x, calc(100vw - 52px)); top: var(--orb-y, 12px); width: 44px; height: 44px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%; cursor: pointer;
    background: color-mix(in srgb, var(--accent, #3b82f6) 16%, var(--bg-primary, #0b0f19)); color: var(--text-primary, #e6edf7); -webkit-tap-highlight-color: transparent;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-light, #60a5fa) 35%, transparent), 0 6px 18px -6px color-mix(in srgb, var(--accent, #3b82f6) 70%, transparent);
    --ovo-a: var(--accent-light, var(--accent, #60a5fa)); --ovo-b: color-mix(in oklab, var(--accent, #3b82f6) 45%, #e879f9);
    transform: none; transition: transform .42s cubic-bezier(.2, 1.1, .3, 1), background-color .3s, box-shadow .3s; }
  .ovs.ovs-anchored .ovs-orb.is-from { transform: translate(var(--orb-dx, 0px), var(--orb-dy, 0px)) scale(.9); background: transparent; box-shadow: none; }
  .ovs.ovs-anchored .ovs-orb::after { content: ""; position: absolute; inset: -4px; }
  /* A ring leaves the orb as its sheet opens (4.186.0; the Dock's sheet does the same). */
  /* 4.229.0: the ring is invisible at rest, so where animations are off (a phone's "Remove animations", reduced motion)
     it never stays as a white circle around the x (the owner, 11-12: "why is it white"). */
  .ovs.ovs-anchored .ovs-orb.is-x::before { content: ""; position: absolute; inset: 0; border-radius: 50%; border: 2px solid var(--ovo-a); pointer-events: none; opacity: 0; animation: ovs-ring .6s cubic-bezier(.2,.8,.2,1) .1s both; }
  @keyframes ovs-ring { from { opacity: .8; transform: scale(.9); } to { opacity: 0; transform: scale(calc(1 + 2.2 * var(--ov-move, 1))); } }
  .ovs.ovs-anchored .ovs-orb:active { transform: scale(.9); }
  /* 4.213.0: when the pressed button flew to its tab, the close turns in at the pill once it has left (a quarter turn,
     a little past its size); closing with the button flying back, it turns away where it is. */
  .ovs.ovs-anchored .ovs-orb.is-pop { animation: ovs-orb-in .38s cubic-bezier(.2, 1.3, .3, 1) .1s both; }
  .ovs.ovs-anchored .ovs-orb.is-gone { animation: ovs-orb-out .22s cubic-bezier(.5, 0, .75, .2) both; }
  @keyframes ovs-orb-in { from { opacity: 0; transform: scale(.45) rotate(-90deg); } }
  @keyframes ovs-orb-out { to { opacity: 0; transform: scale(.5) rotate(90deg); } }
  .ovs.ovs-anchored .ovs-orb svg { display: block; overflow: visible; width: 24px; height: 24px; }
  .ovs.ovs-anchored .ovs-orb.is-x { background: var(--bg-primary, rgba(0,0,0,.25)); box-shadow: inset 0 0 0 1px var(--border, rgba(255,255,255,.12)), 0 8px 22px -10px rgba(0, 0, 0, .7); }
  /* 4.248.0 (the owner, 11-14: "the top thing … needs to be less round … make everything more consistent"): the field and
     its close share the kit's radius scale (--ov-radius-2 + 2, the tabs' own), so the close is a rounded square beside it. */
  .ovs.ovs-anchored .ovs-orb.is-x { border-radius: calc(var(--ov-radius-2, 14px) + 2px); }
  .ovs.ovs-anchored .ovs-orb.is-x::after { border-radius: inherit; }
  /* 4.248.0: as tall as the search field beside it, centred on it (placeOrb measures both). */
  .ovs.ovs-anchored .ovs-orb.is-x { width: var(--orb-size, 48px); height: var(--orb-size, 48px); transition: transform .42s cubic-bezier(.2, 1.1, .3, 1), background-color .3s, box-shadow .3s, top .25s ease, left .25s ease; }
  .ovs.ovs-anchored .ovs-orb.is-x:hover { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, #3b82f6) 55%, var(--border, rgba(255,255,255,.12))), 0 8px 22px -10px rgba(0, 0, 0, .7); }
  .ovs.ovs-anchored .ovs-orb.is-x::before { display: none; }
  .ovs.ovs-anchored .ovs-orb { width: 48px; height: 48px; }
  .ovs.ovs-anchored .ovs-orb:focus { outline: none; }
  .ovs.ovs-anchored .ovs-orb:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--bg-primary, #0b0f19), 0 0 0 4px var(--accent-light, var(--accent, #60a5fa)); }
  .ovs.ovs-anchored .ovs-orb.is-x { color: var(--text-primary, #e6edf7);
    background: radial-gradient(120% 120% at 30% 20%, color-mix(in srgb, var(--accent, #3b82f6) 26%, var(--bg-secondary, #121826)), var(--bg-secondary, #121826) 70%);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-light, #60a5fa) 22%, transparent), 0 10px 24px -10px color-mix(in srgb, var(--accent, #3b82f6) 70%, rgba(0, 0, 0, .8)); }
  .ovs.ovs-anchored .ovs-orb.is-x svg { width: 26px; height: 26px; transition: transform .4s cubic-bezier(.3, 1.4, .4, 1); }
  .ovs.ovs-anchored .ovs-orb.is-x.is-pop { animation: ovs-orb-spin .5s cubic-bezier(.2, 1.3, .3, 1) .06s both; }
  @keyframes ovs-orb-spin { from { opacity: 0; transform: scale(.4) rotate(-180deg); } 60% { opacity: 1; } }
  .ovs.ovs-anchored .ovs-orb.is-x:active svg { transform: rotate(90deg) scale(.86); }
  html[data-ov-motion=off] .ovs.ovs-anchored .ovs-orb.is-x.is-pop { animation: none; }
  @media (hover: hover) { .ovs.ovs-anchored .ovs-orb.is-x:hover svg { transform: rotate(90deg); } }
  /* 4.239.0 (the owner, 11-13: "make the close button look slightly 3D and look kind of like glowing … a better effect …
     make it look kind of cool"): a lit sphere (a highlight up and to the left, a shade under it, a rim of the accent),
     a soft glow around it, a sheen that sweeps across once as the menu opens, a brighter glow on hover, and a press
     that sinks it. Nothing moves at rest. */
  .ovs.ovs-anchored .ovs-orb.is-x { color: #fff; --ovo-a: #fff; --ovo-b: #fff;   /* no overflow clip: ::after is the 4 px wider hit area */
    background: radial-gradient(120% 120% at 32% 22%, color-mix(in srgb, #fff 30%, var(--accent-light, #60a5fa)) 0%, color-mix(in srgb, var(--accent, #3b82f6) 72%, #0b1220) 42%, color-mix(in srgb, var(--accent, #3b82f6) 30%, #04060c) 100%);
    box-shadow: inset 0 1.5px 0 rgba(255, 255, 255, .42), inset 0 -4px 8px rgba(0, 0, 0, .45), 0 0 0 1px color-mix(in srgb, var(--accent-light, #60a5fa) 55%, transparent),
      0 0 22px -2px color-mix(in srgb, var(--accent, #3b82f6) 75%, transparent), 0 10px 22px -8px rgba(0, 0, 0, .8);
    transition: transform .42s cubic-bezier(.2, 1.1, .3, 1), box-shadow .25s, filter .25s; }
  .ovs.ovs-anchored .ovs-orb.is-x svg { filter: drop-shadow(0 1px 1px rgba(0, 0, 0, .45)); }
  .ovs.ovs-anchored .ovs-orb.is-x::before { display: block; content: ""; position: absolute; inset: 0; border-radius: 50%; border: 0; opacity: 1; pointer-events: none;
    background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, .55) 48%, transparent 62%) no-repeat; background-size: 260% 100%; background-position: 130% 0;
    animation: ovs-orb-sheen .9s cubic-bezier(.3, .6, .3, 1) .38s 1 both; }
  @keyframes ovs-orb-sheen { to { background-position: -40% 0; } }
  @media (hover: hover) { .ovs.ovs-anchored .ovs-orb.is-x:hover { filter: brightness(1.12); box-shadow: inset 0 1.5px 0 rgba(255, 255, 255, .5), inset 0 -4px 8px rgba(0, 0, 0, .4), 0 0 0 1px color-mix(in srgb, var(--accent-light, #60a5fa) 70%, transparent), 0 0 30px 0 color-mix(in srgb, var(--accent, #3b82f6) 85%, transparent), 0 10px 22px -8px rgba(0, 0, 0, .8); } }
  .ovs.ovs-anchored .ovs-orb.is-x:active { transform: scale(.9); box-shadow: inset 0 3px 8px rgba(0, 0, 0, .55), 0 0 0 1px color-mix(in srgb, var(--accent-light, #60a5fa) 50%, transparent), 0 0 14px -2px color-mix(in srgb, var(--accent, #3b82f6) 60%, transparent); }
  html[data-ov-motion=off] .ovs.ovs-anchored .ovs-orb.is-x::before { animation: none; background: none; }
  html[data-ov-motion=reduced] .ovs.ovs-anchored .ovs-orb.is-x::before { animation-duration: .5s; }
  .ovs.is-closing .ovs-panel { animation: ovs-fold .28s cubic-bezier(.5, 0, .75, .2) both; }
  .ovs.is-closing { animation: ovs-fade .28s ease-in both; }
}
`;
        document.head.appendChild(st);
    }

    const ICON = {
        up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="16" height="16"><path d="M12 20.8V4M5.7 10.3l6.3-6.3l6.3 6.3"/></svg>',
        down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="16" height="16"><path d="M12 3.2v16.7M5.7 13.7l6.3 6.3l6.3-6.3"/></svg>',
        mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
        // The composer's + (ov-composer.js PLUS_MARK): four petals behind two arms; the petals bloom out on a tap.
        plus: '<svg class="ovs-plus" viewBox="0 0 24 24" aria-hidden="true"><g class="ovs-plus-p"><circle cx="6.2" cy="6.2" r="1.35"/><circle cx="17.8" cy="6.2" r="1.35"/><circle cx="6.2" cy="17.8" r="1.35"/><circle cx="17.8" cy="17.8" r="1.35"/></g><g class="ovs-plus-x"><path class="ovs-plus-h" d="M5.5 12h13"/><path class="ovs-plus-v" d="M12 5.5v13"/></g></svg>',
        send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>',
        search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
        close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
        clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
        go: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>',
        spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/></svg>',
        back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/></svg>',
        grid: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/></svg>',
    };

    // The orb (navbar.js's drawing, root.OpenVibeOrb): on a phone the menu covers the bar, so the menu draws the orb in the
    // button's own place, on top, and it turns into the menu's close (4.150.0, the owner: "it renders on top … turns into
    // the close button when it's open … a cool effect as it goes in and out").
    const orbSvg = () => (root.OpenVibeOrb ? root.OpenVibeOrb.svg(24) : '');
    let orbEl = null, closing = 0;
    const phoneSheet = () => { try { return !!(el && el.classList.contains('ovs-anchored') && root.matchMedia('(max-width: 640px)').matches); } catch { return false; } };
    // Motion off (html[data-ov-motion=off], theme-loader.js) is the only setting that skips an effect; Calm plays it.
    const calm = () => document.documentElement.getAttribute('data-ov-motion') === 'off';

    function build() {
        styles();
        el = document.createElement('div');
        el.className = 'ovs';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-label', 'Search and every OpenVibe site');
        el.innerHTML = `<div class="ovs-panel"><div class="ovs-bar"><button type="button" class="ovs-lead" tabindex="-1" aria-hidden="true">${ICON.search}</button><div class="ovs-field"><span class="ovs-ghost" aria-hidden="true"></span><input class="ovs-input" type="search" role="combobox" aria-autocomplete="both" aria-expanded="true" aria-controls="ovs-list" autocomplete="off" spellcheck="false" enterkeyhint="search" maxlength="100"></div><div class="ovs-tools"><button type="button" class="ovs-tool ovs-mic" aria-label="Speak your search" data-ov-tip="Speak" hidden>${ICON.mic}</button><button type="button" class="ovs-tool ovs-attach" aria-label="Ask Vibe about a picture or a file" data-ov-tip="Attach" hidden>${ICON.plus}</button><button type="button" class="ovs-tool ovs-send" aria-label="Ask Vibe" data-ov-tip="Ask Vibe" hidden>${ICON.send}</button><input class="ovs-file" type="file" multiple hidden accept="image/*,video/*,audio/*,.pdf,.txt,.md,.csv,.json,.zip"></div><div class="ovs-acts"></div><button type="button" class="ovs-x" aria-label="Close the menu" title="Close (Esc)">${ICON.close}<span>Close</span></button></div>`
            + '<div class="ovs-youpanel" role="region" aria-label="You and your Actor" hidden></div><div class="ovs-tabs ovs-starttabs" hidden></div>'
            + `<div class="ovs-tabs ovs-rtabs" role="tablist" aria-label="Results from" hidden>${RTABS.map(([id, label]) => `<button type="button" class="ovs-tab" role="tab" data-rtab="${id}" aria-selected="false">${label}</button>`).join('')}</div>`
            + '<ul class="ovs-list" id="ovs-list" role="listbox"></ul><div class="ovs-foot" aria-hidden="true"><span><kbd>' + ICON.up + '</kbd><kbd>' + ICON.down + '</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Tab</kbd> complete</span><span><kbd>Esc</kbd> close</span></div></div>';
        input = el.querySelector('.ovs-input');
        ghost = el.querySelector('.ovs-ghost');
        listEl = el.querySelector('.ovs-list');
        doorEl = document.createElement('div'); doorEl.className = 'ovs-door'; doorEl.hidden = true;
        // 4.225.0: Vibe is one place (the owner, 11-12, crossing out the Chat · Code · Agents switch: "one new unified
        // agent … a shared UI"): every chat, task and coding run in one list with its own filters, drawn by ov-run.js.
        doorHost = document.createElement('div'); doorHost.className = 'ovs-door-host';
        doorEl.append(doorHost);
        listEl.after(doorEl);
        doorHost.addEventListener('openvibe:open-vibe', (e) => {
            if (door !== 'chats' || !canDoor()) return;
            e.preventDefault();
            openDoor('vibe');
        });
        tabsEl = el.querySelector('.ovs-tabs');
        actsEl = el.querySelector('.ovs-acts');
        rtabsEl = el.querySelector('.ovs-rtabs');
        rtabsEl.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-rtab]'); if (b) { showResults(rq, b.getAttribute('data-rtab')); input.focus(); } });
        el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
        el.querySelector('.ovs-x').addEventListener('click', close);
        wireTop();
        // 4.223.1: the panel never scrolls as a whole (only its list does); an engine that still scrolls it on a focus
        // is put back at once, so the search field and the tabs stay in place.
        { const panel = el.querySelector('.ovs-panel'); if (panel) panel.addEventListener('scroll', () => { if (panel.scrollTop || panel.scrollLeft) { panel.scrollTop = 0; panel.scrollLeft = 0; } }, { passive: true }); }
        orbEl = document.createElement('button');
        orbEl.type = 'button'; orbEl.className = 'ovs-orb'; orbEl.setAttribute('aria-label', 'Close the menu'); orbEl.title = 'Close (Esc)';
        orbEl.innerHTML = orbSvg();
        orbEl.addEventListener('click', close);
        el.appendChild(orbEl);
        tabsEl.addEventListener('click', (e) => {
            const b = e.target.closest && e.target.closest('[data-tab]'); if (!b) return;
            leaveDoor();
            tab = b.getAttribute('data-tab'); if (tab === 'feed') markFeedSeen(); input.value = ''; render(''); listEl.scrollTop = 0;
            let touch = false; try { touch = root.matchMedia('(pointer: coarse)').matches; } catch { /* */ }
            if (touch) b.focus(); else input.focus();
        });
        document.addEventListener('openvibe-notifications-count', () => { if (el && el.classList.contains('is-open')) paintTabs(); });
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
                e.preventDefault(); if (!showDoor(it.dock)) { try { root.OpenVibeNavbar.openDock(it.dock); } catch { location.href = it.url; } } return;
            }
            if (it && it.kind === 'results') { e.preventDefault(); showResults(input.value.trim()); input.focus(); return; }
            if (it && it.kind === 'recent') { e.preventDefault(); input.value = it.title; paintGhost(); showResults(it.title); input.focus(); return; }
            if (it) remember(it);
            // A page chosen in the menu (owner, 11-09: "it doesn't update the navigation that's highlighted… the menu
            // should animate closed when you change pages"): the menu closes as the page changes, whether Boost swaps it in
            // place or the browser loads the next one. Its Back entry stays, so Back is not spent on it during the move.
            const link = e.target.closest && e.target.closest('a[href]');
            if (link && !e.defaultPrevented && !e.button && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && (!link.target || link.target === '_self') && !/^#/.test(link.getAttribute('href'))) close({ navigating: true });
        });
        document.body.appendChild(el);
    }

    function onKey(e) {
        if (e.key === 'Escape' && el.classList.contains('ovs-you-open')) { e.preventDefault(); toggleYou(false); return; }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && input.value.trim()) { e.preventDefault(); askVibe(input.value); return; }
        if (e.key === 'Escape') { e.preventDefault(); if (input.value) { input.value = ''; paintGhost(); render(''); return; } close(); return; }
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
            if (tab === 'feed' && homeLib() && !door) { render(q); return; }
            // Vibe: on Chats (the Dock's Vibe) the words go to its box as before; anywhere else they start a run.
            if (door === 'vibe' && q) {
                if (runFilter === 'chat') { try { if (ctx.ask) ctx.ask(q); } catch { /* the Dock is optional */ } }
                else if (runView) runView.start(q).then(() => { input.value = ''; paintGhost(); }, () => {});
                return;
            }
            if (door === 'chats') { try { if (root.OpenVibeDock && root.OpenVibeDock.filterChats) root.OpenVibeDock.filterChats(q); } catch { /* Dock is optional */ } return; }
            const it = items[active >= 0 ? active : 0];
            // Enter shows every result, unless the person picked a row or typed a place's exact name (live, tools).
            if (q && !moved && view !== 'results' && !exact(it, q)) { showResults(q); return; }
            if (it && it.kind === 'results') { showResults(q); return; }
            if (it && it.kind === 'recent') { input.value = it.title; paintGhost(); showResults(it.title); return; }
            if (it) { remember(it); location.href = it.url; }
        }
    }
    const exact = (it, q) => !!it && ['site', 'family', 'tool', 'page'].includes(it.kind) && String(it.title).toLowerCase() === q.toLowerCase();
    /** 4.229.0 (the owner, 11-12: "fix the history back button so it properly brings you back to this GUI"): the menu's
     *  entry remembers where it was when a link took the person away, and Back reopens it there (navbar.js restoreMenu). */
    function markBack() {
        try {
            const back = { tab, door: door || null, scroll: listEl ? Math.round(listEl.scrollTop) : 0, at: Date.now() };
            history.replaceState(Object.assign({}, history.state || {}, { ovsMenu: false, ovsBack: back }), '');
        } catch { /* a page that cannot keep state: Back shows the page */ }
    }
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

    /** A steady hue per site (ov-home.js has the same), so an app wears one colour in every tab. */
    function hueOf(id) { let x = 7; const t = String(id || 'ov'); let i = 0; while (i < t.length) { x = (x * 31 + t.charCodeAt(i)) % 360; i++; } return x; }
    // The glyphs a section of sites can wear (openvibe-shared/glyphs.js), and which one a section's name asks for.
    const GROUP_GLYPH = {
        'video': '<rect x="3.4" y="6.4" width="12.3" height="11.3" rx="1.9"/><path d="M15.6 10.2l4.7-2.8v9.4l-4.7-2.8"/>',
        'chat': '<path d="M3.8 4.3h16.8v11.7H8l-4.2 4.2Z"/>',
        'game': '<rect x="3.7" y="7.2" width="16.7" height="9.7" rx="4.4"/><path d="M7.6 10.7v2.7M6.4 12h2.7M15.1 11.6h0M17.4 12.9h0"/>',
        'book': '<path d="M12 6.3C10 4.8 7 4.3 3.5 4.9v13.2c3.5-0.6 6.5-0.1 8.5 1.4c2-1.5 5-2 8.5-1.4V4.9C17 4.3 14 4.8 12 6.3Z"/><path d="M12 6.3v13.2"/>',
        'store': '<path d="M3.7 8.8L5.3 3.7h13.4L20.3 8.8M3.7 8.8h16.5v1.6a2.8 2.8 0 0 1-5.4 0a2.8 2.8 0 0 1-5.6 0A2.8 2.8 0 0 1 3.7 10.4ZM4.8 12.9v7.2h14.5v-7.2M9.9 20.1v-4.1h4.1v4.1"/>',
        'wrench': '<path d="M14.6 3.6a5.2 5.2 0 0 0-4.6 7.3L3.7 17.3V20.3h3.1l6.4-6.4a5.2 5.2 0 0 0 7.3-4.6l-3.2 1.2l-2.5-2.5l1.2-3.2Z"/>',
        'spark': '<path d="M10.4 3.6l1.7 4.8L17 10.1l-4.8 1.7L10.4 16.7l-1.7-4.8L3.9 10.1l4.8-1.7ZM17 14.8l0.8 2.1L19.8 17.6l-2.1 0.8L17 20.3l-0.8-2.1L14.3 17.6l2.1-0.8Z"/>',
        'code': '<path d="M7.8 7.8l-4.2 4.2l4.2 4.2M16.2 7.8l4.2 4.2l-4.2 4.2M14.2 4.6l-4.2 14.8"/>',
        'compass': '<circle cx="12" cy="12" r="8.5"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1Z"/>',
    };
    function groupGlyph(name) {
        const n = String(name || '').toLowerCase();
        return /watch|stream|video|live/.test(n) ? 'video' : /talk|belong|chat|social|community/.test(n) ? 'chat' : /play|game|fun/.test(n) ? 'game'
            : /read|ask|news|learn/.test(n) ? 'book' : /shop|money|buy|market/.test(n) ? 'store' : /tool/.test(n) ? 'wrench'
            : /\bai\b|make/.test(n) ? 'spark' : /develop|build|code/.test(n) ? 'code' : 'compass';
    }
    function icon(it) {
        const ic = document.createElement('span');
        ic.className = 'ovs-ic';
        if (it.site) { ic.classList.add('ovs-site'); ic.style.setProperty('--ovs-h', String(hueOf(it.site))); const s = document.createElement('span'); s.className = 'ov-icon'; s.setAttribute('data-icon', it.site); s.setAttribute('data-size', '28'); s.setAttribute('data-fx', 'none'); ic.appendChild(s); }
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
        if (doorMount && !door) { try { doorMount.destroy(); } catch { /* */ } doorMount = null; }
        groups.filter((g) => (g.items && g.items.length) || ['note', 'loading', 'route', 'fold', 'card', 'signin', 'display', 'feeds', 'home', 'walltop', 'wall', 'dock-activity', 'notifications'].includes(g.as)).forEach((g) => {
            if (g.as === 'notifications') {
                const li = document.createElement('li'); li.className = 'ovs-notifications'; li.setAttribute('role', 'presentation'); li.setAttribute('data-sec', 'notifications');
                const host = document.createElement('div'); host.className = 'ovs-notifications-host'; li.appendChild(host);
                const N = root.OpenVibeNotifications;
                // 4.201.0's look: the section's head says what it is and how many wait, and Show all sits in it.
                const head = document.createElement('div'); head.className = 'ovs-nhead';
                const title = document.createElement('b'); title.textContent = 'Notifications';
                const unread = document.createElement('span'); unread.className = 'ovs-nhead-n'; unread.hidden = true;
                try { const n = N.unread ? Number(N.unread()) : 0; if (n > 0) { unread.textContent = `${n > 99 ? '99+' : n} new`; unread.hidden = false; } } catch { /* the count is optional */ }
                const more = document.createElement('button'); more.type = 'button'; more.className = 'ovs-nhead-more'; more.hidden = true;
                head.append(title, unread, more);
                li.insertBefore(head, host);
                let compact = null;
                try { compact = N.renderMenuNotifications(host, (total) => { if (total > 3) { more.textContent = `Show all ${total}`; more.hidden = false; } }); } catch { host.textContent = 'Notifications are unavailable right now.'; }
                more.addEventListener('click', () => { if (compact) compact.showAll(); more.hidden = true; });
                listEl.appendChild(li); return;
            }
            if (g.as === 'home' || g.as === 'walltop' || g.as === 'wall') {
                const H = root.OpenVibeHome; if (!H) return;
                const kept = homeViews[g.as];
                if (kept) { if (kept.api && kept.api.update) { try { kept.api.update(homeOpts()); } catch { /* keep what shows */ } } listEl.appendChild(kept.li); if (g.as === 'home') drawerIfAsked(kept.api); return; }
                const li = document.createElement('li'); li.setAttribute('role', 'presentation');
                let api = null;
                try { api = (g.as === 'home' ? H.home : g.as === 'walltop' ? H.wallTop : (H.feed || H.timeline))(li, homeOpts()); } catch { return; }
                homeViews[g.as] = { li, api };
                listEl.appendChild(li);
                if (g.as === 'home') drawerIfAsked(api);
                return;
            }
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
                    [['up', ICON.up, 'Show it earlier'], ['down', ICON.down, 'Show it later']].forEach(([dir, glyph, name]) => {
                        const mv = document.createElement('button'); mv.type = 'button'; mv.innerHTML = glyph; mv.setAttribute('aria-label', `${name}: ${f.title}`); mv.setAttribute('data-ovs-feed-move', `${dir}|${f.id}`); mv.disabled = !f.on; row.appendChild(mv);
                    });
                    li.appendChild(row);
                });
                const note = document.createElement('p'); note.className = 'ovs-feeds-note'; note.textContent = 'Every feed shows unless you turn it off; the arrows set the order.'; li.appendChild(note);
                listEl.appendChild(li);
                return;
            }
            if (g.as === 'signin') {
                const bar = document.getElementById('openvibe-login-btn');
                const href = (bar && bar.href) || `https://openvibe.network/login?return=${encodeURIComponent(location.href)}`;
                const li = document.createElement('li'); li.className = 'ovs-card'; li.setAttribute('role', 'presentation'); li.setAttribute('data-sec', 'signin');
                const body = document.createElement('div'); body.className = 'ovs-cardbody ovs-guest';
                const head = document.createElement('b'); head.textContent = 'Sign in to make OpenVibe yours';
                const list = document.createElement('ul');
                for (const line of ['Your home screen, arranged your way, on every site', 'Your feed, messages and notifications', 'Your agents, and the AI that comes with your account', 'Your wallet, and what you own']) {
                    const item = document.createElement('li'); item.textContent = line; list.appendChild(item);
                }
                const go = document.createElement('a'); go.className = 'ovs-guest-go'; go.href = href; go.textContent = 'Sign in';
                go.addEventListener('click', () => close());
                body.append(head, list, go); li.appendChild(body); listEl.appendChild(li);
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
                    g.card.render(body, { close, here: here(), user: ctx.user || null, signedIn: !!(ctx.user && !ctx.user.is_anon) });
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
            // A section of sites wears its glyph (4.223.0), drawn from the glyph registry's set.
            h.appendChild(document.createTextNode(g.title));
            // The name stays the first node (readers and the launcher read it there); the glyph is drawn before it (order -1).
            if (g.section === 'all' && g.title) { const gi = document.createElement('span'); gi.className = 'ovs-group-ic'; gi.setAttribute('aria-hidden', 'true'); gi.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${GROUP_GLYPH[groupGlyph(g.title)]}</svg>`; h.appendChild(gi); }
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
                    if (it.meta) { const m = document.createElement('span'); m.className = 'ovs-meta'; m.textContent = it.meta; if (it.at) { m.dataset.at = it.at; m.dataset.pre = it.metaPre || ''; } main.appendChild(m); }
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
                if (as === 'mini') { const sp = ic.querySelector('.ov-icon'); if (sp) sp.setAttribute('data-size', '44'); }
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

    // This site's short name for the field, the first tab and the headings: a product name ("Download", "Space"), never a
    // page title or a tagline ("OpenVibe.Download: a free 25 GB drive with share links" ran over two lines; on 11-08 the
    // tab read "Websites that l…", openvibe.website's tagline). In order: the site's own short label, the network's name
    // for this address (path-aware: openvibe.my/inventory is Inventory, openvibe.my itself is not), the "OpenVibe.X" in
    // the title, the address (openvibe.website → Website, connect.openvibe.link → Connect), then a short title segment.
    const SHORT_NAME = 18;
    const shortName = (t) => String(t || '').split(/\s[·|–—-]\s|:\s/)[0].replace(/^OpenVibe\./, '').trim();
    // A page's word for itself ("Home", "Welcome") never names the site: the first tab is the site's name (owner, 11-09:
    // "the first tab should be named after the site you're on… I meant the home options", which are Home in its list).
    const GENERIC = /^(?:home|homepage|index|welcome|start|main|untitled|dashboard)$/i;
    const brief = (t) => { const v = shortName(t); return v && v.length <= SHORT_NAME && !GENERIC.test(v) ? v : ''; };
    const capital = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : '');
    function addressName(host) {
        const p = String(host || '').toLowerCase().replace(/^www\./, '').split('.');
        if (p.length === 2 && p[0] === 'openvibe') return p[1] === 'ai' ? 'AI' : capital(p[1]);
        if (p.length >= 3 && p[p.length - 2] === 'openvibe' && /^[a-z][a-z-]{1,17}$/.test(p[0])) return capital(p[0]);
        return '';
    }
    const here = () => {
        const f = ctx.frame, list = f && Array.isArray(f.nav) ? f.nav.map((n) => ({ name: n.name, url: safeUrl(n.url) })) : [];
        const s = list.length ? hereSite(list) : null;
        const titled = /OpenVibe\.([A-Za-z][A-Za-z0-9-]{0,17})\b/.exec(document.title || '');
        return brief(ctx.scope && ctx.scope.label) || (s && brief(s.name)) || (titled && titled[1]) || addressName(location.hostname)
            || brief(String(document.title || '').split(/\s[·|–—-]\s/).pop()) || location.hostname;
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
    // Every feed shows until the person turns some off (11-09); this device keeps up to twelve in their order. Network's
    // menu-feeds@1 keeps the first four until @2 (order and off) is live.
    const FEEDS_KEY = 'ovs-feeds', FEEDS_MAX = 12, FEEDS_SYNC = 4;
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
        feedsPut = setTimeout(() => { fetch(feedsUrl(), { method: 'PUT', headers: { Authorization: `Bearer ${ctx.token}`, 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify({ on: on.slice(0, FEEDS_SYNC) }) }).catch(() => {}); }, 800);
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
                // Network's v1 copy holds the first four: a device whose longer list starts with them keeps its own.
                if (local && remote.length === FEEDS_SYNC && local.length > remote.length && remote.every((id, i) => local[i] === id)) return;
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
            { title: 'Machines', url: 'https://openvibe.link/machines', site: 'plug', kind: 'you' },
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

    /** What is new in the Feed since it was last looked at: the network's real changes after that moment (0 on a first look). */
    function feedNew() {
        const seen = feedSeen();
        if (!seen || !Array.isArray(changesData)) return 0;
        let n = 0;
        for (const e of changesData) { const t = Date.parse(e.deployed_at || e.committed_at || ''); if (t > seen && !HOUSEKEEPING.test(String(e.subject || ''))) n++; }
        return n;
    }
    const TAB_SVG = {
        feed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="7" rx="2"/><path d="M4 15.5h16M4 19.5h10"/></svg>',
        you: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.6"/><path d="M5 19.5c1.2-3.3 3.9-5 7-5s5.8 1.7 7 5"/></svg>',
    };
    /**
     * The tab strip under the search field (11-09, the owner: "these icons should be visually improved… your avatar…
     * the feed content aware… each site its own icon"): this site's own mark and name, Feed with a red dot while anyone is
     * live or a count of what is new since you last looked, and You with your picture and an online dot.
     */
    /** A phone's menu with the Dock to hand: its places open inside the menu, under the menu's own head. */
    /** Chat and Vibe open inside the menu, on every screen (4.220.0: the floating Dock is gone). */
    function canDoor() { return !!(root.OpenVibeDock && typeof root.OpenVibeDock.mountInto === 'function'); }

    // ── The top (4.238.0; the owner, 11-13: "redesign the whole entire top to be our agentic search … uses our composer
    // … the actor … at the top … you can see your little avatar of your actor running in there … click for expand"):
    // the pill is a composer. Your Actor's face leads it with its state on a ring (tap: its card drops under the pill);
    // voice and attach sit inside it while it is empty, and Ask Vibe once there are words: the question becomes a Vibe
    // run in place, a file goes into Vibe's box. Results still come as you type.
    const ACTOR = 'https://openvibe.actor';
    // The pill's words: the site's name where there is room; on a phone, with the tools beside them, the short form.
    function askHint() { let narrow = false; try { narrow = root.matchMedia('(max-width: 640px)').matches; } catch { /* */ } return narrow ? 'Search or ask Vibe' : `Search ${here()}, or ask Vibe`; }
    let actorInfo = null, actorAt = 0, listening = null;
    const signedInTop = () => !!(ctx && ctx.token && ctx.user && !ctx.user.is_anon);
    function syncTools() {
        if (!el) return;
        const has = !!(input && input.value.trim());
        const mic = el.querySelector('.ovs-mic'), att = el.querySelector('.ovs-attach'), send = el.querySelector('.ovs-send');
        const canSpeak = !!(root.SpeechRecognition || root.webkitSpeechRecognition);
        if (mic) mic.hidden = has || !canSpeak;
        if (att) att.hidden = has || !signedInTop();
        if (send) send.hidden = !has;
    }
    function askVibe(text, files) {
        const words = String(text || '').trim();
        if (!words && !(files && files.length)) return;
        if (!canDoor() || !signedInTop()) { location.href = `https://openvibe.chat/vibe${words ? `?ask=${encodeURIComponent(words)}` : ''}`; return; }
        if (input) { input.value = ''; paintGhost(); syncTools(); }
        toggleYou(false);
        openDoor('vibe');
        const go = (n = 0) => {
            if (!runView) { if (n < 80) setTimeout(() => go(n + 1), 50); return; }
            if (files && files.length) {
                try { runView.prefill(words); } catch { /* */ }
                const put = (k = 0) => {
                    const f = doorHost && doorHost.querySelector('.ovr-compose form');
                    if (f && f.__ovc && typeof f.__ovc.add === 'function') { f.__ovc.add(files); return; }
                    if (k < 60) setTimeout(() => put(k + 1), 50);
                };
                put();
                return;
            }
            Promise.resolve(runView.start(words)).catch(() => { try { runView.prefill(words); } catch { /* */ } });
        };
        go();
    }
    async function loadActor() {
        if (!signedInTop()) return null;
        if (actorAt && Date.now() - actorAt < 60000) return actorInfo;
        try {
            // 4.242.0: through the Frame (every site's connect-src allows openvibe.network, most refuse openvibe.actor).
            const url = ctx.actorBase ? `${String(ctx.actorBase).replace(/\/+$/, '')}/api/v1/me/actor` : `${ctx.runsBase || ctx.apiBase || 'https://openvibe.network'}/api/frame/actor`;
            const r = await fetch(url, { credentials: 'omit', headers: { Accept: 'application/json', Authorization: `Bearer ${ctx.token}` } });
            actorInfo = r.ok ? await r.json() : null;
        } catch { actorInfo = null; }
        actorAt = Date.now();
        return actorInfo;
    }
    // What is running for you (4.238.0; the owner, 11-13: "when you have actors or tasks running … sessions,
    // conversations, anything, there should be stacked … your agents … that are active behind you, and there should be
    // like status indicator"): your Actor while it works or asks, and every run that is going or waits for you.
    const KIND_SVG = {
        chat: '<path d="M3.8 4.3h16.8v11.7H8l-4.2 4.2Z"/>',
        task: '<rect x="5.4" y="8.3" width="13.2" height="10.4" rx="2.8"/><path d="M12 4.6v3.8M9.2 13.1h0M14.8 13.1h0M9.6 16.4h4.7M3.5 13.1v1.9M20.5 13.1v1.9"/>',
        code: '<path d="M7.8 7.8l-4.2 4.2l4.2 4.2M16.2 7.8l4.2 4.2l-4.2 4.2M14.2 4.6l-4.2 14.8"/>',
        ask: '<circle cx="10.6" cy="10.6" r="7"/><path d="M20.4 20.4l-4.5-4.5"/>',
        spark: '<path d="M10.4 3.6l1.7 4.8L17 10.1l-4.8 1.7L10.4 16.7l-1.7-4.8L3.9 10.1l4.8-1.7ZM17 14.8l0.8 2.1L19.8 17.6l-2.1 0.8L17 20.3l-0.8-2.1L14.3 17.6l2.1-0.8Z"/>',
    };
    const faceHue = (t) => { let n = 0; for (const c of String(t || 'ov')) n = (n * 31 + c.charCodeAt(0)) >>> 0; return n % 360; };
    let activeList = [], activeAt = 0;
    async function loadActive() {
        if (!signedInTop()) return [];
        if (activeAt && Date.now() - activeAt < 30000) return activeList;
        const net = ctx.runsBase || ctx.apiBase || 'https://openvibe.network';
        const [a, runs, faces] = await Promise.all([
            loadActor(),
            fetch(`${net}/api/frame/runs?limit=20`, { credentials: 'omit', headers: { Accept: 'application/json', Authorization: `Bearer ${ctx.token}` } })
                .then((r) => (r.ok ? r.json() : { runs: [] })).then((d) => (Array.isArray(d.runs) ? d.runs : [])).catch(() => []),
            // 4.242.0: your agents (Experts) with their faces, while they work or ask you something.
            fetch(`${net}/api/frame/actor/faces`, { credentials: 'omit', headers: { Accept: 'application/json', Authorization: `Bearer ${ctx.token}` } })
                .then((r) => (r.ok ? r.json() : { agents: [] })).then((d) => (Array.isArray(d.agents) ? d.agents : [])).catch(() => []),
        ]);
        const out = [];
        for (const ag of faces.slice(0, 12)) {
            if (!ag || !ag.id || !['working', 'asks'].includes(ag.state)) continue;
            out.push({ key: `agent:${ag.id}`, kind: 'agent', name: String(ag.name || 'Your agent').slice(0, 40), state: ag.state,
                pic: /^https:\/\//.test(String(ag.avatar_url || '')) ? ag.avatar_url : '', hue: Number.isInteger(ag.hue) ? ag.hue : faceHue(ag.name || ag.id),
                glyph: KIND_SVG[ag.glyph] ? ag.glyph : 'spark',
                line: ag.state === 'asks' ? (ag.asks > 1 ? `${ag.asks} things for you` : 'It asks you something') : String(ag.step || 'Working').slice(0, 120) });
        }
        // Your Actor's own agent is already among the faces: once, with its face.
        const shownAgent = (x) => out.some((f) => f.kind === 'agent' && ((x.agent_id && f.key === `agent:${x.agent_id}`) || f.name === String(x.name || '')));
        if (a && a.id && a.enabled !== false && !shownAgent(a)) {
            const asks = Array.isArray(a.asks) ? a.asks.length : 0;
            if (asks || a.status === 'working') out.push({ key: `actor:${a.id}`, kind: 'actor', name: a.name || 'Your Actor', state: asks ? 'asks' : 'working',
                pic: a.avatar && /^https:\/\//.test(String(a.avatar.url || '')) ? a.avatar.url : '', hue: faceHue(a.name || a.id), glyph: 'task',
                line: asks ? `It asks you: ${(a.asks[0] && a.asks[0].text) || ''}` : (a.now && a.now.current_step) || 'Working' });
        }
        for (const r of runs) {
            const needs = r.status === 'waiting' && r.waiting && r.waiting.for !== 'message';
            if (!needs && !['running', 'planning'].includes(r.status)) continue;
            const ag = r.agent || {};
            out.push({ key: `run:${r.ref || r.id}`, kind: 'run', ref: r.ref || r.id, name: r.title || ag.name || { chat: 'Chat', task: 'Task', code: 'Code', ask: 'Answer' }[r.kind] || 'Run', state: needs ? 'asks' : 'working',
                pic: /^https:\/\//.test(String(ag.avatar_url || '')) ? ag.avatar_url : '', hue: Number.isInteger(ag.hue) ? ag.hue : faceHue(ag.id || r.kind), glyph: KIND_SVG[r.kind] ? r.kind : 'spark',
                line: needs ? 'Your turn' : (r.doing && r.doing.text) || (r.status === 'planning' ? 'Starting' : 'Working') });
        }
        out.sort((x, y) => (y.state === 'asks') - (x.state === 'asks'));
        activeList = out; activeAt = Date.now();
        return out;
    }
    function stackFace(it, cls) {
        const f = document.createElement('span'); f.className = `${cls} is-${it.state}`; f.style.setProperty('--h', String(it.hue));
        if (it.pic) { const img = document.createElement('img'); img.alt = ''; img.src = it.pic; img.decoding = 'async'; img.onerror = () => { img.remove(); f.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true">${KIND_SVG[it.glyph] || KIND_SVG.spark}</svg>`); }; f.appendChild(img); }
        else f.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${KIND_SVG[it.glyph] || KIND_SVG.spark}</svg>`;
        return f;
    }
    async function paintLead() {
        const lead = el && el.querySelector('.ovs-lead'); if (!lead) return;
        const u = ctx && ctx.user && !ctx.user.is_anon ? ctx.user : null;
        lead.className = 'ovs-lead';
        if (!u) {
            lead.innerHTML = ICON.search; lead.tabIndex = -1; lead.setAttribute('aria-hidden', 'true');
            ['aria-expanded', 'aria-label', 'data-ov-tip'].forEach((k) => lead.removeAttribute(k));
            return;
        }
        // You: your picture (or first letter) and the online dot.
        lead.classList.add('is-you');
        lead.textContent = '';
        const meEl = document.createElement('span'); meEl.className = 'ovs-lead-me';
        const face = document.createElement('span'); face.className = 'ovs-lead-face';
        const pic = /^https:\/\//.test(String(u.avatar_url || '')) ? u.avatar_url : '';
        const letter = String(u.display_name || u.username || '?').trim().charAt(0).toUpperCase() || '?';
        if (pic) { const img = document.createElement('img'); img.alt = ''; img.src = pic; img.decoding = 'async'; img.onerror = () => { img.remove(); face.textContent = letter; }; face.appendChild(img); }
        else face.textContent = letter;
        const dot = document.createElement('i'); dot.className = 'ovs-lead-on'; dot.setAttribute('aria-hidden', 'true');
        meEl.append(face, dot);
        lead.append(meEl);
        lead.tabIndex = 0; lead.removeAttribute('aria-hidden');
        const name = u.display_name || u.username || 'You';
        lead.setAttribute('aria-label', `${name}: your account and display`);
        lead.setAttribute('aria-expanded', String(!!(el && el.classList.contains('ovs-you-open'))));
        lead.setAttribute('data-ov-tip', 'You');
        // Behind you: what is running for you, newest asks first; two faces on a phone, three on a computer, then a count.
        const list = await loadActive();
        if (!el || !lead.isConnected || !lead.classList.contains('is-you') || !list.length) return;
        let narrow = false; try { narrow = root.matchMedia('(max-width: 640px)').matches; } catch { /* */ }
        const room = narrow ? 2 : 3;
        const stack = document.createElement('span'); stack.className = 'ovs-stack'; stack.setAttribute('aria-hidden', 'true');
        list.slice(0, room).forEach((it, i) => { const f = stackFace(it, 'ovs-stack-f'); f.style.setProperty('--i', String(i)); stack.appendChild(f); });
        if (list.length > room) { const more = document.createElement('span'); more.className = 'ovs-stack-more'; more.style.setProperty('--i', String(room)); more.textContent = `+${list.length - room}`; stack.appendChild(more); }
        lead.appendChild(stack);
        lead.classList.add('has-stack');
        const asks = list.filter((x) => x.state === 'asks').length;
        if (asks) lead.classList.add('has-asks');
        const say = list.slice(0, 3).map((x) => `${x.name}, ${x.state === 'asks' ? 'waiting for you' : 'working'}`).join('; ');
        lead.setAttribute('aria-label', `${name}: your account and display. Running for you: ${say}${list.length > 3 ? `, and ${list.length - 3} more` : ''}`);
    }
    /** The rows of what is running, in your sheet: a tap opens that run in Vibe (your Actor has its own card above). */
    function activeRows(panel) {
        const old = panel.querySelector('.ovs-active'); if (old) old.remove();
        // 4.242.0: your agents at work (with their faces) and the runs that go or wait for you.
        const runs = activeList.filter((x) => x.kind === 'run' || x.kind === 'agent');
        if (!runs.length) return;
        const box = document.createElement('div'); box.className = 'ovs-active'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Running for you');
        const h = document.createElement('p'); h.className = 'ovs-active-h'; h.textContent = 'Running for you'; box.appendChild(h);
        runs.slice(0, 6).forEach((it) => {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'ovs-active-row';
            const t = document.createElement('span'); t.className = 'ovs-active-t';
            const n = document.createElement('b'); n.textContent = it.name;
            const l = document.createElement('small'); l.textContent = it.line;
            t.append(n, l);
            const st = document.createElement('i'); st.className = `ovs-active-st is-${it.state}`; st.textContent = it.state === 'asks' ? 'Your turn' : 'Working';
            b.append(stackFace(it, 'ovs-active-f'), t, st);
            b.setAttribute('aria-label', `${it.name}: ${it.state === 'asks' ? 'waiting for you' : 'working'}. Open it`);
            b.addEventListener('click', () => {
                toggleYou(false);
                if (!canDoor()) { location.href = 'https://openvibe.chat/vibe'; return; }
                // An agent opens its work (Tasks); a run opens its thread.
                if (it.kind === 'agent') { runFilter = 'task'; openDoor('vibe'); return; }
                openDoor('vibe');
                const go = (k = 0) => { if (runView && typeof runView.open === 'function') { try { runView.open(it.ref); } catch { /* the list stands */ } return; } if (k < 80) setTimeout(() => go(k + 1), 50); };
                go();
            });
            box.appendChild(b);
        });
        panel.appendChild(box);
    }
    function toggleYou(force) {
        const panel = el && el.querySelector('.ovs-youpanel'), lead = el && el.querySelector('.ovs-lead');
        if (!panel || !lead) return;
        const show = force != null ? !!force : panel.hidden;
        if (show && !lead.classList.contains('is-you')) return;
        if (show) { const bar = el.querySelector('.ovs-bar'), pr = el.querySelector('.ovs-panel'); if (bar && pr) pr.style.setProperty('--ovs-you-top', `${Math.round(bar.getBoundingClientRect().bottom - pr.getBoundingClientRect().top + 6)}px`); }
        panel.hidden = !show; el.classList.toggle('ovs-you-open', show);
        if (lead.classList.contains('is-you')) lead.setAttribute('aria-expanded', String(show));
        if (!show) { panel.textContent = ''; return; }
        const draw = (n = 0) => {
            const H = root.OpenVibeHome;
            if (H && typeof H.youCard === 'function') { H.youCard(panel, { token: ctx.token, user: ctx.user, me: ctx.me, look: ctx.look, actorBase: ctx.actorBase, close }); loadActive().then(() => { if (!panel.hidden) activeRows(panel); }); return; }
            homeLib();
            if (n < 60) setTimeout(() => draw(n + 1), 50);
        };
        draw();
    }
    function listen() {
        const SR = root.SpeechRecognition || root.webkitSpeechRecognition; if (!SR || !input) return;
        const mic = el.querySelector('.ovs-mic');
        if (listening) { try { listening.stop(); } catch { /* */ } return; }
        let rec; try { rec = new SR(); } catch { return; }
        rec.interimResults = true; rec.continuous = false;
        try { rec.lang = document.documentElement.lang || navigator.language || 'en-US'; } catch { /* */ }
        rec.onresult = (e) => { let t = ''; for (const r of e.results) t += r[0].transcript; input.value = t.slice(0, 100); paintGhost(); schedule(input.value); };
        rec.onend = () => { listening = null; if (mic) { mic.classList.remove('is-on'); mic.setAttribute('aria-pressed', 'false'); } syncTools(); input.focus(); };
        rec.onerror = rec.onend;
        listening = rec;
        if (mic) { mic.classList.add('is-on'); mic.setAttribute('aria-pressed', 'true'); }
        try { rec.start(); } catch { rec.onend(); }
    }
    function wireTop() {
        const lead = el.querySelector('.ovs-lead');
        lead.addEventListener('click', () => { if (lead.classList.contains('is-you')) toggleYou(); else input.focus(); });
        // A tap anywhere else folds your sheet (it floats over the menu).
        el.addEventListener('pointerdown', (e) => {
            if (!el.classList.contains('ovs-you-open')) return;
            const panel = el.querySelector('.ovs-youpanel');
            if (panel && !panel.contains(e.target) && !lead.contains(e.target)) toggleYou(false);
        }, true);
        el.querySelector('.ovs-mic').addEventListener('click', listen);
        const file = el.querySelector('.ovs-file');
        // The + blooms (its petals fly out, the arms turn a quarter) as the picker opens, then settles back.
        const attach = el.querySelector('.ovs-attach');
        attach.addEventListener('click', () => {
            attach.classList.remove('is-bloom');
            void attach.offsetWidth; // a second tap restarts the bloom
            attach.classList.add('is-bloom');
            clearTimeout(attach._bloom);
            attach._bloom = setTimeout(() => attach.classList.remove('is-bloom'), 950);
            file.click();
        });
        file.addEventListener('change', () => { const f = [...(file.files || [])]; file.value = ''; if (f.length) askVibe(input.value, f); });
        el.querySelector('.ovs-send').addEventListener('click', () => askVibe(input.value));
        input.addEventListener('input', syncTools);
    }
    // A place's own actions (+ for a new chat, ↗ to open it in Chat) sit in the search pill, left of the close orb, so
    // they cost no row (asks 335, 336: "an icon plus button that looks nice and integrated", "open in Chat … a button
    // icon"). The Dock's panel draws them in its slim row; inside the menu that row is hidden and mirrored here, and
    // each mirror presses the panel's own button (an address opens from the person's own tap).
    function mirrorActs() {
        actsTick = 0;
        if (!actsEl) return;
        actsEl.textContent = '';
        if (!door || !doorHost) return;
        // A list's actions and an open conversation's (+ for a new chat, ↗ to open it in Chat): one head, the menu's (4.220.0).
        doorHost.querySelectorAll('.ovdk-bar > .ovdk-ib, .ovdk-thread-h > .ovdk-ib').forEach((orig) => {
            const b = document.createElement('button'); b.type = 'button';
            b.className = 'ovs-act' + (orig.classList.contains('is-new') ? ' is-new' : '');
            const label = orig.getAttribute('aria-label') || ''; b.setAttribute('aria-label', label); b.title = label;
            b.innerHTML = orig.innerHTML;
            b.addEventListener('click', (e) => { e.stopPropagation(); orig.click(); });
            actsEl.appendChild(b);
        });
    }
    function watchActs(on) {
        if (actsObs) { actsObs.disconnect(); actsObs = null; }
        if (on && doorHost && typeof MutationObserver === 'function') {
            actsObs = new MutationObserver(() => { if (!actsTick) actsTick = requestAnimationFrame(mirrorActs); });
            actsObs.observe(doorHost, { childList: true, subtree: true });
        }
        mirrorActs();
    }
    /** A place by the Dock's name ('chats', or Vibe's lists 'vibe' | 'code' | 'agent' | 'tasks'), in the open menu. */
    function showDoor(id) {
        if (!el || !el.classList.contains('is-open') || !canDoor() || !id) return false;
        // The Dock's places by name: its Vibe is Chats, its Agents are Tasks.
        const want = { all: 'all', vibe: 'chat', chat: 'chat', code: 'code', agent: 'task', agents: 'task', tasks: 'task' }[id];
        if (want) runFilter = want;
        openDoor(id === 'chats' ? 'chats' : 'vibe');
        return door != null;
    }
    /** Vibe's runs (ov-run.js, loaded beside the navbar by its hash the first time Vibe opens). */
    let runLoading = null;
    function runLib() {
        if (root.OpenVibeRun) return Promise.resolve(root.OpenVibeRun);
        if (runLoading || typeof ctx.sibling !== 'function') return runLoading || Promise.reject(new Error('no sibling'));
        runLoading = new Promise((resolve, reject) => {
            const sc = document.createElement('script'); sc.src = ctx.sibling('ov-run.js'); sc.async = true;
            sc.onload = () => (root.OpenVibeRun ? resolve(root.OpenVibeRun) : reject(new Error('ov-run.js')));
            sc.onerror = () => { runLoading = null; sc.remove(); reject(new Error('ov-run.js')); };
            document.head.appendChild(sc);
        });
        return runLoading;
    }
    // What Vibe can do, to tap (they were the Dock's Vibe starters).
    const VIBE_STARTERS = [
        ['bell', 'Remind me to stretch every 2 hours'],
        ['calendar', 'What is on today?'],
        ['live', 'Who is live right now?'],
        ['clock', 'Start a 25-minute focus timer'],
        ['phone', 'Remind me tomorrow at 9 to call Sam'],
        ['search', 'What is new on OpenVibe this week?'],
    ];
    let pendingAsk = null;
    /** One of the Dock's panels in a slot of the run view (the Dock lends one at a time). */
    function lend(slot, how) {
        try { return root.OpenVibeDock && root.OpenVibeDock.mountInto ? root.OpenVibeDock.mountInto(slot, how) : null; } catch { return null; }
    }
    function mountRuns() {
        const me = ctx.user && !ctx.user.is_anon ? ctx.user : null;
        // Runs and the Action Center are the person's Network places, like the Dock's (navbar.js passes its base).
        const net = ctx.runsBase || ctx.apiBase || 'https://openvibe.network';
        const D = () => root.OpenVibeDock;
        const opts = {
            base: `${net}/api/frame`, token: () => ctx.token, me, sibling: ctx.sibling, filter: runFilter,
            // 4.240.0 (the owner, 11-13: "it's just like filters … your actor is just your agent"): one view. Your agent
            // heads the list, Chats, Tasks and Code are filters over the same runs, and one box starts everything; the
            // Dock's Vibe, Agents and Code panels are no longer lent here.
            actions: { base: net }, starters: VIBE_STARTERS, agent: true,
            // Above the list: Now (timers, what is on) and the live view of an agent at work, from the Dock's agent top.
            // Above the list: what is happening now (a timer, an agent at work, what needs you), quiet otherwise (4.248.0: no
            // idle line, no "Nothing needs you", no timeline folds; the owner, 11-14).
            top: (slot) => lend(slot, { tab: 'agent', part: 'live' }),
            onPlace: (p) => { if (p.filter) runFilter = p.filter; },
        };
        const go = (R) => {
            if (door !== 'vibe' || runView) return;
            doorHost.textContent = ''; runView = R.mount(doorHost, opts);
            if (pendingAsk != null) { runView.prefill(pendingAsk); pendingAsk = null; }
        };
        if (root.OpenVibeRun) { go(root.OpenVibeRun); return; }
        doorHost.textContent = '';
        const wait = document.createElement('p'); wait.className = 'ovs-door-wait'; wait.textContent = 'Opening Vibe…'; doorHost.append(wait);
        runLib().then(go, () => { if (door === 'vibe') wait.textContent = 'Vibe did not load. Check your connection and open it again.'; });
    }
    /** Show a place in the menu: Messages (the Dock's), or Vibe (your runs). */
    function openDoor(id) {
        if (!doorEl || !canDoor()) return;
        if (door && door !== id) closeDoorBody();
        door = id;
        listEl.hidden = true; doorEl.hidden = false; el.classList.add('ovs-in-door');
        el.classList.toggle('ovs-in-vibe', id === 'vibe');
        if (id === 'vibe') {
            if (runView) runView.list(runFilter); else mountRuns();
        } else {
            try { if (!doorMount) doorMount = root.OpenVibeDock.mountInto(doorHost, { tab: 'chats' }); else doorMount.show('chats'); }
            catch { leaveDoor(); try { ctx.dock(id); } catch { /* the Dock is optional */ } return; }
        }
        watchActs(true);
        input.placeholder = id === 'chats' ? 'Search your chats' : askHint();
        paintTabs();
    }
    function closeDoorBody() {
        if (doorMount) { try { doorMount.destroy(); } catch { /* */ } doorMount = null; }
        if (runView) { try { runView.destroy(); } catch { /* */ } runView = null; }
        if (doorHost) doorHost.textContent = '';
    }
    /** Back to the menu's own list (a tab, typing, or closing). The Dock's panels go home with their state. */
    function leaveDoor() {
        if (!door) return;
        door = null;
        closeDoorBody();
        watchActs(false);
        if (doorEl) doorEl.hidden = true;
        if (listEl) listEl.hidden = false;
        if (el) el.classList.remove('ovs-in-door', 'ovs-in-vibe');
        if (input) input.placeholder = askHint();
    }

    function paintTabs() {
        tabsEl.hidden = false;
        tabsEl.setAttribute('role', 'tablist');
        tabsEl.setAttribute('aria-label', 'Menu');
        tabsEl.textContent = '';
        const live = pulseData && Number(pulseData.live_now) > 0;
        const fresh = tab === 'feed' ? 0 : feedNew();
        try { localStorage.setItem(FEED_COUNT, String(fresh)); } catch { /* */ }
        paintFeedDot(fresh);
        try { feedChannel?.postMessage({ type: 'count', count: fresh }); } catch { /* */ }
        // Your picture on You whenever the bar knows you, with or without a token for the network's reads (4.236.0; the
        // owner, 11-13: "what happened to the user avatar": on a site with its own session it fell back to a glyph).
        const me = ctx.user && !ctx.user.is_anon ? ctx.user : null;
        let siteId = ctx.service || '';
        try { const b0 = basis(); if (b0.mineSite) siteId = b0.mineSite.icon || b0.mineSite.id; } catch { /* the sites load later */ }
        // One row of places (4.194.0): this site, the feed, your messages, AI (Vibe and your agents), you. Messages and
        // AI are the Dock's; they are in this row, between Feed and You, where the bar can open the Dock for this person.
        const doors = typeof ctx.dock === 'function' ? [['chats', ctx.service === 'chat' ? 'Messages' : 'Chat'], ['vibe', 'Vibe']] : [];
        const row = [TABS[0], TABS[1], ...doors.map(([id, label]) => [id, label, true]), TABS[2]];
        tabsEl.classList.toggle('has-doors', doors.length > 0);
        for (const [id, label, isDoor] of row) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'ovs-tab'; b.setAttribute('role', 'tab');
            if (isDoor) {
                // A place of the Dock. On a phone it opens here, inside the menu, and is then the chosen tab; on a computer
                // it opens the floating Dock beside the page (it is kept beside the work there).
                b.setAttribute('data-tab', id); b.setAttribute('data-dock', id); b.setAttribute('aria-selected', door === id ? 'true' : 'false');
                const ic = document.createElement('span'); ic.className = 'ovs-tab-ic'; ic.innerHTML = BRIDGE_SVG[id]; b.appendChild(ic);
                const t = document.createElement('span'); t.textContent = label; b.appendChild(t);
                b.addEventListener('click', (e) => { e.stopPropagation(); if (canDoor()) { openDoor(id); return; } try { ctx.dock(id); } catch { /* not loaded yet: it opens the menu here when it is */ } });
                tabsEl.appendChild(b);
                continue;
            }
            b.setAttribute('data-tab', id);
            b.setAttribute('aria-selected', !door && tab === id ? 'true' : 'false');
            const ic = document.createElement('span'); ic.className = 'ovs-tab-ic';
            if (id === 'here' && siteId) { const g = document.createElement('span'); g.className = 'ov-icon'; g.setAttribute('data-icon', siteId); g.setAttribute('data-size', '20'); g.setAttribute('data-fx', 'none'); ic.appendChild(g); }
            else if (id === 'you' && me && me.avatar_url && /^https:\/\//.test(me.avatar_url)) {
                const img = document.createElement('img'); img.src = me.avatar_url; img.alt = ''; img.width = 22; img.height = 22; img.decoding = 'async'; img.className = 'ovs-tab-av';
                img.onerror = () => { ic.innerHTML = TAB_SVG.you; };
                ic.appendChild(img);
                const on = document.createElement('i'); on.className = 'ovs-tab-on'; on.setAttribute('aria-hidden', 'true'); ic.appendChild(on);
            } else if (TAB_SVG[id]) ic.innerHTML = TAB_SVG[id];
            if (ic.firstChild) b.appendChild(ic);
            const t = document.createElement('span'); t.textContent = id === 'here' ? here() : label; b.appendChild(t);
            // 4.237.0 (the owner, 11-13): the live dot after the word, a count on the icon's corner, never a third line.
            if (id === 'feed' && live) { const d = document.createElement('i'); d.className = 'ovs-tabdot'; d.setAttribute('aria-label', 'live now'); t.appendChild(d); }
            else if (id === 'feed' && fresh) { const n = document.createElement('b'); n.className = 'ovs-tabnew'; n.textContent = fresh > 9 ? '9+' : String(fresh); n.setAttribute('aria-label', `${fresh} new since you last looked`); (b.querySelector('.ovs-tab-ic') || b).appendChild(n); }
            if (id === 'you' && ctx.token && root.OpenVibeNotifications) {
                const count = Number(root.OpenVibeNotifications.unread ? root.OpenVibeNotifications.unread() : 0) || 0;
                if (count) { const n = document.createElement('b'); n.className = 'ovs-tabnew ovs-tabnew-red'; n.textContent = count > 99 ? '99+' : String(count); n.setAttribute('aria-label', `${count} unread notifications`); (b.querySelector('.ovs-tab-ic') || b).appendChild(n); }
            }
            tabsEl.appendChild(b);
        }
        if (typeof ctx.icons === 'function') { try { ctx.icons(tabsEl); } catch { /* the glyphs come with ov-icons.js */ } }
        if (!tabsEl.__ovsRollWired) { tabsEl.__ovsRollWired = true; tabsEl.addEventListener('pointerdown', rollStop, true); tabsEl.addEventListener('keydown', rollStop, true); }
        rollSchedule();
    }
    /**
     * The tab's nudge (4.236.0; the owner, 11-13: "every once in a while it swaps between all the options that exist in
     * that section … scroll through all these icons and labels … nudges the user"): this site's tab rolls its glyph and
     * name through the other places in its section, a beat each, and back to its own; once a little after the menu
     * opens, then every 40 s while it is open and nobody is typing or pointing at the tabs. Calm rolls once an opening;
     * Off never. Its accessible name stays its own, and a press stops it at once.
     */
    let rollTimer = 0, rollRun = 0, rolledOpen = false;
    function rollSteps() {
        try {
            const b0 = basis();
            const mineSite = b0.mineSite;
            if (!mineSite) return [];
            // 4.249.0 (the owner, 11-14: "keep that roll … not randomized, but connected sites … stuff people go to from"):
            // the sites this person goes to most, then (for a new person) the rest of this site's section.
            const others = b0.ranked.filter((x) => x.id !== mineSite.id && x.name);
            const used = others.filter((x) => useOf(x.id) > 0);
            const pool = used.length >= 2 ? used : others.filter((x) => x.group === mineSite.group);
            return pool.slice(0, 6).map((x) => ({ label: x.name, icon: x.icon || x.id }));
        } catch { return []; }
    }
    function rollStop() {
        rollRun += 1;
        const b = tabsEl && tabsEl.querySelector('.ovs-tab[data-tab="here"].is-rolling');
        if (!b || !b.__ovsOwn) return;
        const t = b.querySelector(':scope > span:not(.ovs-tab-ic)'), g = b.querySelector('.ovs-tab-ic .ov-icon');
        if (t) t.textContent = b.__ovsOwn.label;
        if (g && b.__ovsOwn.icon) { g.setAttribute('data-icon', b.__ovsOwn.icon); if (typeof ctx.icons === 'function') { try { ctx.icons(b); } catch { /* */ } } }
        b.classList.remove('is-rolling');
    }
    function rollHere() {
        // The roll stays (the owner, 11-14: "keep that randomized roll, I like that"); a site can turn it off with
        // data-ov-roll="off" on <html>. It starts well after the menu has opened, so the opening itself never flickers.
        if (document.documentElement.getAttribute('data-ov-roll') === 'off') return;
        if (document.documentElement.getAttribute('data-ov-motion') === 'off') return;
        const b = tabsEl && tabsEl.querySelector('.ovs-tab[data-tab="here"]');
        const steps = rollSteps();
        if (!b || steps.length < 2 || b.classList.contains('is-rolling')) return;
        const t = b.querySelector(':scope > span:not(.ovs-tab-ic)'), g = b.querySelector('.ovs-tab-ic .ov-icon');
        if (!t) return;
        b.__ovsOwn = { label: t.textContent, icon: g ? g.getAttribute('data-icon') : null };
        b.setAttribute('aria-label', b.__ovsOwn.label);
        const seq = steps.concat([b.__ovsOwn]);
        const run = ++rollRun;
        b.classList.add('is-rolling');
        let i = 0;
        const beat = () => {
            if (run !== rollRun || !b.isConnected) return;
            const st = seq[i++];
            for (const x of [t, g]) if (x) x.classList.remove('ovs-roll');
            void t.offsetWidth;
            t.textContent = st.label;
            if (g && st.icon) { g.setAttribute('data-icon', st.icon); if (typeof ctx.icons === 'function') { try { ctx.icons(b); } catch { /* */ } } }
            for (const x of [t, g]) if (x) x.classList.add('ovs-roll');
            if (i < seq.length) setTimeout(beat, 820); else setTimeout(() => { if (run === rollRun) b.classList.remove('is-rolling'); }, 420);
        };
        beat();
    }
    function rollSchedule() {
        if (rolledOpen) return;
        rolledOpen = true;
        setTimeout(() => { if (el && el.classList.contains('is-open') && !input.value) rollHere(); }, 1400);
        clearInterval(rollTimer);
        rollTimer = setInterval(() => {
            if (!el || !el.classList.contains('is-open')) { clearInterval(rollTimer); rolledOpen = false; return; }
            if (document.hidden || input.value || tabsEl.matches(':hover, :focus-within')) return;
            if (document.documentElement.getAttribute('data-ov-motion') === 'reduced') return;
            rollHere();
        }, 40000);
    }
    const bsvg = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    const BRIDGE_SVG = {
        vibe: bsvg('<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'),
        code: bsvg('<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15"/>'),
        agent: bsvg('<rect x="5" y="8" width="14" height="10" rx="3"/><path d="M12 8V4.5M9.5 13v.01M14.5 13v.01M3 12.5v2M21 12.5v2"/>'),
        talk: bsvg('<path d="M4.6 11.6a7.4 6.4 0 1 1 3.3 5.4l-3.4 1.3 1-3.1a6 6 0 0 1-.9-3.6z"/><path d="M9 11.6h.01M12 11.6h.01M15 11.6h.01"/>'),
        chats: bsvg('<path d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-7L8 20v-3.5H5A1.5 1.5 0 0 1 3.5 15V8A1.5 1.5 0 0 1 5 6.5z"/>'),
        activity: bsvg('<path d="M6.2 16.2V11a5.8 5.8 0 0 1 11.6 0v5.2l1.6 2H4.6z"/><path d="M10 20.2a2.1 2.1 0 0 0 4 0"/>'),
    };

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
        // A site's links that never name its home get one first, so the home page has a place of its own in the menu
        // and wears the highlight there too (owner 11-09, on openvibe.exchange: "shouldn't there be a link to home that's
        // highlighted").
        const rootHere = (x) => { try { const u = new URL(x.url, root.location.href); return u.origin === root.location.origin && (u.pathname.replace(/\/+$/, '') || '/') === '/'; } catch { return false; } };
        if (pages.length && !pages.some(rootHere)) pages.unshift({ title: 'Home', url: '/', icon: 'go', drawn: typeof ctx.navIcon === 'function' ? ctx.navIcon('fa-house') : '', kind: 'page' });
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
        if (pages.length) groups.push({ title: `Pages on ${here()}`, as: 'links', items: pages, section: 'here' });
        const fgroups = f && f.groups && f.groups.length ? f.groups.slice() : [{ id: '', name: 'OpenVibe' }];
        if (mineSite) fgroups.sort((a, b) => (b.id === mineSite.group) - (a.id === mineSite.group));
        const inGroup = (x, g) => !g.id || x.group === g.id || (!fgroups.some((y) => y.id === x.group) && g === fgroups[fgroups.length - 1]);
        const mini = (x) => siteItem(x, all);
        fgroups.forEach((g, i) => {
            // The site you are on is first in its group (its group is already first): the menu opens where you are.
            const list = all.filter((x) => inGroup(x, g)).sort((a, b) => (mineSite ? (b.id === mineSite.id) - (a.id === mineSite.id) : 0)).map(mini);
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
        const wall = homeLib();
        if (wall && input && input.value.trim()) return [{ as: 'wall', items: [], section: 'wall' }];
        if (wall) groups.push({ as: 'walltop', items: [], section: 'wall-top' });
        const live = liveGroup(); if (live) groups.push(live);
        if (wall) groups.push({ as: 'wall', items: [], section: 'wall' });
        if (wall && feedV2) return groups;   // Feed v2: the composer, today, the live bar and the stream
        // The network's cards: text and links only (never another site's code), checked here again, with an entry's https
        // picture when it sent one; the person's choice and order, else Network's first two.
        const feeds = f && Array.isArray(f.cards) ? f.cards.filter((c) => c && typeof c.title === 'string' && Array.isArray(c.items) && c.items.length).slice(0, 12) : [];
        const chosen = feedPref();
        // Every feed shows until the person chooses (owner, 11-09: "by default all the feeds show, but you can configure the order").
        let netCards = chosen ? chosen.map((id) => feeds.find((c) => feedId(c) === id)).filter(Boolean) : feeds;
        // Nothing old dressed as new (11-09, the owner: "why is New in the forum first when it's 17 days ago"): a card's age
        // is its newest item's (a timestamp when the card sends one, else its "3d ago" words); one older than 3 days drops
        // the word "New" from its title, and until the person orders them, fresher cards come first and month-old ones last.
        const AGE = { m: 60e3, min: 60e3, h: 3600e3, d: 86400e3, w: 604800e3, mo: 2592e6, y: 31536e6 };
        const ageOf = (c) => {
            let best = Infinity;
            for (const x of c.items || []) {
                const t = Date.parse(x && (x.at || x.updated_at || x.published_at) || '');
                if (t) { best = Math.min(best, Date.now() - t); continue; }
                const m = /(\d+)\s*(min|mo|m|h|d|w|y)\b[^·]*ago/.exec(String(x && x.meta || ''));
                if (m) best = Math.min(best, Number(m[1]) * AGE[m[2]]);
            }
            return best;
        };
        const ages = new Map(netCards.map((c) => [c, ageOf(c)]));
        const later = [];   // cards older than two weeks: after What's new
        if (!chosen) netCards = netCards.slice().sort((a, b) => (ages.get(a) === Infinity ? 1e15 : ages.get(a)) - (ages.get(b) === Infinity ? 1e15 : ages.get(b)));
        netCards.forEach((c) => {
            const as = c.kind === 'rail' ? 'livebar' : c.kind === 'chips' ? 'chips' : 'rows';
            const rows = c.items.slice(0, 6).map((x) => ({ title: String(x.title || '').slice(0, 80), meta: String(x.meta || '').slice(0, 120), url: safeUrl(x.url),
                image: x.image && /^https:\/\//.test(String(x.image.src || '')) ? String(x.image.src) : null,
                site: c.site && /^[a-z0-9-]{1,30}$/.test(c.site) ? c.site : null, icon: 'go', kind: 'card' })).filter((x) => x.url && x.title);
            const stale = isFinite(ages.get(c)) && ages.get(c) > 3 * 86400e3;   // an unknown age is never called old
            const title = stale ? String(c.title).replace(/^New\s+(in|on|from)\s+/i, (m0, w) => `${w[0].toUpperCase()}${w.slice(1)} `).replace(/^New\s+/i, '') : String(c.title);
            if (rows.length) (isFinite(ages.get(c)) && ages.get(c) > 14 * 86400e3 && !chosen ? later : groups).push({ title: title.slice(0, 60), as, items: rows, section: `net:${String(c.id || c.site || '').slice(0, 30)}`, more: c.more && safeUrl(c.more.url) ? { label: String(c.more.label || 'More').slice(0, 24), href: c.more.url } : null });
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
            // Each row (owner, 11-09: "keep the recently updated… see some info about the last update"): the site, what
            // changed in plain words, when, "New" since this person's last visit and "Big update" for a major one; the
            // heading counts today's real changes across the network.
            const at = (e) => e.deployed_at || e.committed_at;
            const rows = [...newest.values()].sort((a, b) => Date.parse(at(b.e) || 0) - Date.parse(at(a.e) || 0)).slice(0, 6).map(({ e, site }) => {
                const seen = lastVisit(site.id);
                const fresh = seen && Date.parse(at(e)) > seen;
                return { title: site.name, meta: [`Updated ${ago(at(e))}`, e.major ? 'Big update' : ''].filter(Boolean).join(' · '), snippet: plainChange(e.subject),
                    url: safeUrl(`${site.url.replace(/\/$/, '')}/updates`), site: site.icon || site.id, kind: 'update', tag: fresh ? 'New' : '' };
            }).filter((x) => x.url && x.snippet);
            const dayAgo = Date.now() - 86400000;
            const today = changesData.filter((e) => e && e.service && !HOUSEKEEPING.test(String(e.subject || '')) && Date.parse(at(e) || 0) > dayAgo).length;
            if (rows.length) groups.push({ title: today ? `What's new (${today} today)` : "What's new", items: rows, section: 'news', more: { label: 'All updates', href: 'https://openvibe.network/updates' } });
        }
        groups.push(...later);
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

    /**
     * A page they were on (11-09, the owner: "more like live data… smart and aware… better info, looks nicer"): the site's
     * own icon, the title without the site's name glued on, when, and "Live now" for a channel that is live this minute.
     */
    function backRow(x) {
        const title = String(x.title || '').replace(/\s*[·|–—-]\s*(?:OpenVibe\.\w+|open\.\w+)\s*$/i, '').replace(/^OpenVibe\.\w+:\s*/i, '').trim() || x.title;
        const live = pulseData && Array.isArray(pulseData.live) && pulseData.live.some((c) => c && c.url && safeUrl(c.url) && hostOf(c.url) === hostOf(x.url) && String(c.url).replace(/\/$/, '').toLowerCase() === String(x.url).replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase());
        const svc = x.service === 'media' ? 'media-hub' : x.service;
        const pre = [live ? 'Live now' : '', x.site].filter(Boolean).join(' · ');
        return { title: title.slice(0, 90), meta: [pre, ago(x.at)].filter(Boolean).join(' · '), metaPre: pre, at: x.at, url: x.url, site: svc && /^[a-z0-9-]{1,30}$/.test(svc) ? svc : null, icon: 'back', kind: 'history', tag: live ? 'Live' : '' };
    }

    /** You: their workspace, their places, the pages they were on, tools, their searches, and the display controls. */
    function youGroups() {
        const { take, ranked } = basis();
        const groups = [];
        const H = homeLib();
        // With the home screen, Notifications is one of You's tabs (4.223.0); without it, the section stays at the top.
        if (root.OpenVibeNotifications && ctx.token && !H) groups.push({ title: 'Notifications', as: 'notifications', items: [] });
        // §Z.2 (4.247.0): a guest sees first what signing in adds, with the bar's own Sign in link.
        // Signed in is the person the bar shows, not a token: a site that signs in by its own session cookie (Download) has
        // no token in the page, and the menu said "Sign in to make OpenVibe yours" under their avatar (11-14).
        if (!(ctx.user && !ctx.user.is_anon)) groups.push({ as: 'signin', items: [], section: 'signin' });
        if (H) {
            groups.push({ as: 'home', items: [], section: 'home' });
            // Signed out, Display stays at the foot (a signed-in person has it beside their name, in ov-home).
            if (!(ctx.user && !ctx.user.is_anon) && typeof ctx.display === 'function') groups.push({ title: '', as: 'display', items: [], section: 'display' });
            return groups;
        }
        if (ctx.user && !ctx.user.is_anon) groups.push({ title: 'Your workspace', as: 'apps', items: youItems(), section: 'you' });
        const yours = mine && mine.services.some((x) => x.count > 0);
        // Without their own history, developer services are not places to visit: they come up here once used.
        const dockPool = yours ? ranked : ranked.filter((x) => x.group !== 'build' || useOf(x.id));
        groups.push({ title: yours ? 'Your places' : 'Popular on OpenVibe', as: 'apps', items: take(dockPool, 8).map((x) => siteItem(x)), section: 'places' });
        const seen = new Set();
        const back = mine ? mine.items.filter((h) => { if (seen.has(h.url)) return false; seen.add(h.url); return true; }).slice(0, 5).map(backRow) : [];
        groups.push({ title: 'Jump back in', items: back, section: 'back' });
        const tools = yourTools().concat(quickTools()).filter((t, i, a) => a.findIndex((x) => x.url === t.url) === i).slice(0, 6);
        groups.push({ title: 'Tools', as: 'chips', more: { label: 'All tools', href: 'https://openvibe.tools/' }, items: tools, section: 'tools' });
        const r = recent.get();
        groups.push({ title: 'Recent searches', as: 'chips', clear: true, items: r.map((x) => ({ title: x, url: `${API}/?q=${encodeURIComponent(x)}`, icon: 'clock', kind: 'recent' })), section: 'recent' });
        // Display: theme, text size and motion.
        if (typeof ctx.display === 'function') groups.push({ title: '', as: 'display', items: [], section: 'display' });
        return groups;
    }

    // ── The home screen and the wall (ov-home.js, 2026-11-09): loaded beside this file the first time You or Feed
    // paints; until it arrives (or if it cannot), the tabs paint as before.
    // One view of each per opening: a repaint (history or the catalogue arriving) keeps edit mode, a drag, a half-typed post.
    let homeLoading = false, pulseReady = null, homeViews = {}, feedV2 = false;
    function homeLib() {
        if (root.OpenVibeHome) return root.OpenVibeHome;
        if (homeLoading || typeof ctx.sibling !== 'function') return null;
        homeLoading = true;
        try {
            const sc = document.createElement('script'); sc.src = ctx.sibling('ov-home.js'); sc.async = true;
            sc.onload = () => { if (el && el.classList.contains('is-open') && !input.value && (tab === 'you' || tab === 'feed')) render(''); };
            document.head.appendChild(sc);
        } catch { /* the old tabs stand */ }
        return null;
    }
    const slugOf = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    /** What ov-home.js needs: every app (ranked), the person's own places, the tools, what they opened lately. */
    /** 4.229.0: You's home tells the menu which view shows: All apps makes the pill its finder ("Find among 64 apps"),
     *  and leaving it gives the pill back to searching OpenVibe. */
    function homeView(view, info) {
        if (!input || tab !== 'you') return;
        if (view === 'drawer') { input.placeholder = `Find among ${(info && info.apps) || ''} apps`.replace('  ', ' '); input.value = ''; return; }
        if (/^Find among /.test(input.placeholder)) { input.placeholder = askHint(); input.value = ''; }
    }
    function homeOpts() {
        const { all, ranked, f } = basis();
        const apps = ranked.map((x) => ({ id: x.id, title: x.name, url: x.url, site: x.icon || x.id, group: x.group })).filter((x) => x.url);
        const yours = ctx.user && !ctx.user.is_anon ? youItems().filter((y) => y.title !== 'Agents').map((y) => ({ id: `you:${slugOf(y.title)}`, title: y.title, url: y.url, site: y.site, group: 'you' })) : [];
        const tools = catalog ? catalog.tools.map((t) => [toolUse(t), t]).sort((a, b) => b[0] - a[0]).map(([, t]) => ({ id: `tool:${slugOf(t.name)}`, title: t.name, url: t.go || t.url, site: t.icon || 'tools' })) : [];
        const seen = new Set(), recentIds = [];
        for (const h of (mine ? mine.items : [])) {
            const id = h.service === 'media' ? 'media-hub' : h.service;
            if (!id || seen.has(id) || !all.some((x) => x.id === id)) continue;
            seen.add(id); recentIds.push(id);
            if (recentIds.length >= 5) break;
        }
        // Jump back in (the last places, newest first) and what this person uses most (pages opened per site).
        const seenB = new Set();
        const back = mine ? mine.items.filter((x) => { if (seenB.has(x.url)) return false; seenB.add(x.url); return true; }).slice(0, 60).map(backRow) : [];
        const usage = mine ? mine.services.filter((x) => x && x.count > 0).map((x) => ({ id: x.service === 'media' ? 'media-hub' : x.service, count: Number(x.count) || 0 })) : [];
        return { onView: homeView, apps, yours, tools, toolCount: catalog ? catalog.tools.length : 0, recent: recentIds, back, usage, groups: f && Array.isArray(f.groups) ? f.groups : [],
            token: ctx.token, apiBase: ctx.apiBase, user: ctx.user, look: ctx.look, me: ctx.me, sibling: ctx.sibling, meInTop: !!(ctx.user && !ctx.user.is_anon),
            // You's Notifications tab: the whole list with Mark all read, mounted once; the count rides on the tab.
            notifications: (host) => mountNotes(host), unread: () => { try { return root.OpenVibeNotifications ? Number(root.OpenVibeNotifications.unread()) || 0 : 0; } catch { return 0; } },
            startTab: ['notifications', 'recent', 'apps'].includes(ctx.section) ? ctx.section : null, mountIcons: (scope) => { if (typeof ctx.icons === 'function') ctx.icons(scope); }, close,
            onSearch: (q) => { input.value = q; render(q); input.focus(); },
            pulseReady: pulseReady || (pulseReady = root.OpenVibeHome.loadPulse({ token: ctx.token, user: ctx.user })),
            // The feed answered: the Feed tab is the stream (its sections would sit after an endless list); it did not: as before.
            feedLive: () => { if (!feedV2) { feedV2 = true; if (el && el.classList.contains('is-open') && !input.value && tab === 'feed') render(''); } } };
    }

    /** The whole notifications list for You's tab: a head with how many are new and Mark all read, then every notice. */
    function mountNotes(host) {
        const N = root.OpenVibeNotifications;
        if (!N || typeof N.renderMenuNotifications !== 'function') {
            // The navbar fetches notification-ui.js once you are signed in; the tab can open first. Wait for it (or fetch it
            // here), start it with your token, then draw. It said "unavailable" for good before (11-12).
            host.textContent = '';
            const wait = document.createElement('p'); wait.className = 'ovs-note'; wait.textContent = 'Loading your notifications…'; host.appendChild(wait);
            const ready = () => {
                const M = root.OpenVibeNotifications;
                if (!M || typeof M.renderMenuNotifications !== 'function') { wait.textContent = 'Notifications did not load. Close the menu and open it again.'; return; }
                try { if (!M.__ovNavInit && ctx.token) { M.init({ token: ctx.token, apiBase: ctx.apiBase || 'https://openvibe.network' }); M.__ovNavInit = true; } } catch { /* the navbar's own init may follow */ }
                host.textContent = ''; mountNotes(host);
            };
            let sc = document.getElementById('ov-notify-loader');
            if (!sc && typeof ctx.sibling === 'function') { sc = document.createElement('script'); sc.id = 'ov-notify-loader'; sc.src = ctx.sibling('notification-ui.js'); sc.async = true; document.head.appendChild(sc); }
            if (!sc) { wait.textContent = 'Notifications are on openvibe.network/notifications.'; return; }
            sc.addEventListener('load', () => setTimeout(ready, 0), { once: true });
            sc.addEventListener('error', () => { wait.textContent = 'Notifications did not load. Check your connection and open the menu again.'; }, { once: true });
            setTimeout(() => { if (root.OpenVibeNotifications && host.contains(wait)) ready(); }, 1200);
            return;
        }
        // The list draws its own search, tabs and Mark all read: the tab needs no second heading.
        const list = document.createElement('div'); list.className = 'ovs-notifications-host';
        host.append(list);
        try { const view = N.renderMenuNotifications(list, () => {}); if (view && view.showAll) view.showAll(); } catch { list.textContent = 'Notifications did not load.'; }
    }

    function renderTab() {
        paint(tab === 'feed' ? feedGroups() : tab === 'you' ? youGroups() : hereGroups());
    }

    function render(q) {
        // The field's buttons follow its words on every render (4.249.0; the owner, 11-14: typed, closed, reopened: "empty …
        // lit up"): a clear that set the value by script left Send showing.
        try { syncTools(); } catch { /* the menu is being built */ }
        q = String(q || '').trim();
        el.classList.toggle('ovs-typing', !!q);
        if (door === 'chats' && canDoor()) { try { root.OpenVibeDock.filterChats(q); } catch { /* */ } return; }
        if (door === 'vibe') return;
        // All apps open under You: the pill finds an app there, in place (4.229.0; one search, not a second box).
        const homeApi = homeViews.home && homeViews.home.api;
        if (tab === 'you' && homeApi && homeApi.view === 'drawer') {
            tabsEl.hidden = false;
            input.placeholder = `Find among ${homeApi.apps()} apps`;
            homeApi.filter(q);
            return;
        }
        if (tab === 'feed' && homeLib()) {
            tabsEl.hidden = false;
            input.placeholder = 'Search the feed';
            paintTabs(); renderTab();
            const feed = homeViews.wall && homeViews.wall.api;
            if (feed && feed.search && (q || feed.query)) feed.search(q);
            return;
        }
        input.placeholder = askHint();
        if (q) leaveDoor();
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

    // ── The button becomes its tab (ask 334; the owner, 11-10: "when you click this button, I want it to animate into the
    // tab it becomes. Same with the other buttons … if you click notifications, it should merge into the notifications
    // tab"). The bar button that was pressed (the orb, the bell, the picture, a balance: opts.from) flies to its tab's
    // icon and turns into it on the way; the bell's count flies with it to the tab's count. Closing flies it back.
    // 4.213.0 (the owner, 11-11: "the icon becomes whiter than it was when idle … needs general polish … effects when it
    // lands … improve both the open and close transitions"):
    //   - the copy is the button exactly as it looked when pressed: its look is frozen before the press turns it bright
    //     and into an x, with every computed paint copied (the bar's colour rules stop at its edge, so a bare copy fell
    //     back to the brightest text colour);
    //   - it drops first and glides in last (a landing, not a line across the search field), swelling a little and
    //     tilting into the turn, with a short trail and a glow while it moves;
    //   - it lands: the tab's icon gives with a squash and a ring leaves it; flying back, the bar button does the same;
    //   - the menu's own circle grows from the button while it flies (it was cut short before), and the close orb turns
    //     in once the button has left its place.
    // Motion Off skips it all; Calm plays the same path short, with no trail, tilt or glow (Calm reduces, only Off removes).
    let flyFrom = null, flyIdle = null, fromTab = null;
    const motionLevel = () => (typeof document !== 'undefined' && document.documentElement.getAttribute('data-ov-motion')) || '';
    function tabFace(id) {
        const b = tabsEl && tabsEl.querySelector(`.ovs-tab[data-tab="${id}"], .ovs-tab[data-dock="${id}"]`);
        return b ? (b.querySelector('.ovs-tab-ic') || b) : null;
    }
    const PAINT = ['color', 'fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'transform', 'transform-origin', 'transform-box', 'visibility'];
    /** What the eye sees of a button, as it looks now: its picture or its glyph, every computed paint copied onto the copy
     *  (so it keeps its colour outside the bar's CSS), without ids, handlers, transitions or animations. */
    function faceOf(node) {
        const pic = (node.matches && node.matches('img, svg') && node) || node.querySelector('img, svg, .ov-icon') || node;
        const g = pic.cloneNode(true);
        try {
            const from = [pic, ...pic.querySelectorAll('*')], to = [g, ...g.querySelectorAll('*')];
            from.forEach((n, i) => {
                const t = to[i], cs = getComputedStyle(n);
                if (!t || !t.style) return;
                PAINT.forEach((k) => t.style.setProperty(k, cs.getPropertyValue(k)));
                t.style.transition = 'none'; t.style.animation = 'none';
            });
        } catch { /* a plain copy */ }
        if (g.removeAttribute) g.removeAttribute('id');
        if (g.querySelectorAll) g.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
        return g;
    }
    const countIn = (node) => node && node.querySelector && [...node.querySelectorAll('b, span, i')].find((n) => /^\d+\+?$/.test((n.textContent || '').trim()) && n.getBoundingClientRect().width);
    const inOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const fadeAt = (g, a, b) => Math.min(1, Math.max(0, (g - a) / (b - a)));
    /** A ring that leaves a point and fades (where the flight lands). */
    function ring(r, color, big) {
        const d = Math.max(r.width, r.height) + 10, o = document.createElement('div');
        o.className = 'ovs-fly-ring'; o.setAttribute('aria-hidden', 'true');
        o.style.cssText = `left:${r.left + r.width / 2 - d / 2}px;top:${r.top + r.height / 2 - d / 2}px;width:${d}px;height:${d}px;border-color:${color}`;
        document.body.appendChild(o);
        const a = o.animate([{ transform: 'scale(.55)', opacity: .75 }, { transform: `scale(${big ? 1.9 : 1.35})`, opacity: 0 }], { duration: big ? 520 : 320, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
        a.finished.then(() => o.remove(), () => o.remove());
    }
    function fly(fromEl, toEl, { back = false, fromFace = null, toFace = null } = {}) {
        const level = motionLevel();
        if (!fromEl || !toEl || level === 'off' || !toEl.animate || !fromEl.isConnected || !toEl.isConnected) return;
        const A = fromEl.getBoundingClientRect(), B = toEl.getBoundingClientRect();
        if (!A.width || !B.width || A.bottom < 0 || A.top > innerHeight) return;
        // Only a button flies, and only a button lands: a larger opener (a page passing document.body) would be copied
        // whole and squashed on landing, the whole page with it.
        if (Math.max(A.width, A.height, B.width, B.height) > 160) return;
        const calm = level === 'reduced';
        const D = calm ? 240 : back ? 340 : 460, N = calm ? 8 : 22;
        const accent = (getComputedStyle(document.documentElement).getPropertyValue('--accent-light') || '').trim() || '#60a5fa';
        const layer = document.createElement('div'); layer.className = 'ovs-fly'; layer.setAttribute('aria-hidden', 'true');
        const part = (face, r, cls = '') => { const box = document.createElement('div'); box.className = 'ovs-fly-part' + cls; box.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`; box.appendChild(face); layer.appendChild(box); return box; };
        const srcFace = () => (fromFace ? fromFace.cloneNode(true) : faceOf(fromEl));
        const ghosts = calm ? [] : [part(srcFace(), A), part(srcFace(), A)];
        const src = part(srcFace(), A), dst = part(toFace ? toFace.cloneNode(true) : faceOf(toEl), B), riders = [];
        document.body.appendChild(layer);
        const dx = (B.left + B.width / 2) - (A.left + A.width / 2), dy = (B.top + B.height / 2) - (A.top + A.height / 2), s = B.width / A.width;
        // The path, from the bar to the tab: down fast, across slowly (both settle at the end). Flying back is the same
        // path walked the other way.
        const xs = (g) => g * g * (3 - 2 * g), ys = (g) => 1 - Math.pow(1 - g, 2.4);
        const X = (g) => (back ? 1 - xs(1 - g) : xs(g)), Y = (g) => (back ? 1 - ys(1 - g) : ys(g));
        const swell = calm ? 0 : .14, tilt = calm ? 0 : (dx < 0 ? -9 : 9);
        const frames = (fn) => Array.from({ length: N + 1 }, (_, i) => { const g = inOut(i / N); return Object.assign({ offset: i / N }, fn(g)); });
        const look = (g) => { const sc = 1 + (s - 1) * g + swell * Math.sin(Math.PI * g); return { sc, rot: tilt * Math.sin(Math.PI * g), glow: calm ? 0 : 7 * Math.sin(Math.PI * g) }; };
        const glow = (n) => (n > .2 ? `drop-shadow(0 0 ${n.toFixed(1)}px ${accent})` : 'none');
        const srcOp = (g) => 1 - fadeAt(g, .32, .74), dstOp = (g) => fadeAt(g, .26, .7);
        src.animate(frames((g) => { const l = look(g); return { transform: `translate(${dx * X(g)}px, ${dy * Y(g)}px) rotate(${l.rot}deg) scale(${l.sc})`, opacity: srcOp(g), filter: glow(l.glow) }; }), { duration: D, easing: 'linear', fill: 'forwards' });
        const end = dst.animate(frames((g) => { const l = look(g); return { transform: `translate(${-dx * (1 - X(g))}px, ${-dy * (1 - Y(g))}px) rotate(${l.rot}deg) scale(${l.sc / s})`, opacity: dstOp(g), filter: glow(l.glow) }; }), { duration: D, easing: 'linear', fill: 'forwards' });
        // The trail: two fainter copies a beat behind, gone before it lands.
        ghosts.forEach((gh, i) => gh.animate(frames((g) => { const l = look(g); return { transform: `translate(${dx * X(g)}px, ${dy * Y(g)}px) rotate(${l.rot}deg) scale(${l.sc})`, opacity: srcOp(g) * (i ? .14 : .28) }; }), { duration: D, delay: 34 * (i + 1), easing: 'linear', fill: 'forwards' }));
        // The count rides along (the bell's red count to the tab's, and back), when both are showing.
        const c1 = back ? countIn(fromEl.closest && fromEl.closest('.ovs-tab')) : countIn(fromEl);
        const c2 = back ? countIn(toEl) : countIn(toEl.closest && toEl.closest('.ovs-tab'));
        if (c1 && c2) {
            const R1 = c1.getBoundingClientRect(), R2 = c2.getBoundingClientRect();
            const pill = document.createElement('b'); pill.className = 'ovs-fly-count'; pill.textContent = (c2.textContent || '').trim();
            const box = part(pill, R1, ' ovs-fly-part--count');
            const mx = R2.left - R1.left, my = R2.top - R1.top;
            box.animate(frames((g) => ({ transform: `translate(${mx * X(g)}px, ${my * Y(g)}px) scale(${1 + (calm ? 0 : .12) * Math.sin(Math.PI * g)})` })), { duration: D, easing: 'linear', fill: 'forwards' });
            c1.style.opacity = c2.style.opacity = '0';
            riders.push(c1, c2);
        }
        const hidden = [fromEl, toEl, ...riders];
        hidden.forEach((n) => { n.style.opacity = '0'; });   // opacity, not visibility: a button still takes a press while it flies
        const done = () => {
            hidden.forEach((n) => { n.style.opacity = ''; });
            layer.remove();
            // The landing: the icon gives under it (a squash, then up past its size and back) and a ring leaves it.
            const give = calm ? [{ transform: 'scale(.94)' }, { transform: 'none' }]
                : [{ transform: 'scale(1.16, .84)' }, { transform: 'scale(.94, 1.07)', offset: .42 }, { transform: 'scale(1.02, .99)', offset: .72 }, { transform: 'none' }];
            try { toEl.animate(give, { duration: calm ? 160 : 380, easing: 'cubic-bezier(.2,.9,.3,1)' }); } catch { /* */ }
            ring(B, accent, !calm && !back);
        };
        end.finished.then(done, done);
    }
    /** After the menu has painted its tabs: they are finished where they rest (so the flight lands on them), while the
     *  menu's own circle keeps growing from the button around the flight. */
    function flyIn() {
        const from = flyFrom;
        if (!from || !el) return;
        const to = tabFace(door || tab);
        if (!to) return;
        // Anything that moves the tabs is finished (a computer's dropdown scales in); the circle and the fade only show
        // more of the menu, so they keep playing.
        try { (el.getAnimations ? el.getAnimations({ subtree: true }) : []).forEach((a) => { if (a.animationName === 'ovs-reveal' || a.animationName === 'ovs-in') return; try { a.finish(); } catch { /* an endless one */ } }); } catch { /* */ }
        fly(from, to, { fromFace: flyIdle });
    }

    function drawerIfAsked(api) {
        if (!wantDrawer || !api || typeof api.show !== 'function') return;
        wantDrawer = false;
        try { api.show('drawer'); } catch { /* the home screen stays */ }
    }
    function open(opts = {}) {
        homeViews = {}; pulseReady = null;   // a fresh home screen and wall each time the menu opens
        if (typeof document === 'undefined') return;
        ctx = opts || {};
        ctx.from = opts.from || null;
        if (!el) build();
        flyFrom = opts.from && opts.from.getBoundingClientRect ? opts.from : null;
        // Its look now, before the press turns it bright and into an x: what flies (and what it flies back to). Only a
        // button-sized opener is copied.
        const fr = flyFrom ? flyFrom.getBoundingClientRect() : null;
        flyIdle = fr && fr.width && Math.max(fr.width, fr.height) <= 160 ? faceOf(flyFrom) : null;
        lastFocus = document.activeElement;
        // The tab the person last chose wins; else the one the opener asked for (old names kept: "sites" is this site's
        // tab, whose second half is every site; "tools" is You); else this site.
        // "sites" is a request for the list of every site (the legacy drawer's All sites): it opens this site's tab.
        const asked = { here: 'here', sites: 'here', feed: 'feed', you: 'you', tools: 'you' }[opts.tab];
        // The menu opens on this site's tab unless a tab was asked (the picture asks You): no tab is remembered (4.189.0).
        tab = asked || 'here';
        fromTab = tab;   // what the opener opened: only that tab flies back into it
        allOpen = false; hereOpen = true; leadHere = false; discoverPick = null;
        drainCards();
        syncFeeds();
        el.classList.add('is-open');
        tickAgo();
        actorAt = 0; activeAt = 0; toggleYou(false); syncTools(); paintLead();
        // Back closes the menu first (the owner, 11-07: pressing Back on a phone left the page instead): opening adds one
        // history entry; Back pops it and only closes the menu.
        try {
            if (opts.restore) { history.replaceState(Object.assign({}, history.state || {}, { ovsMenu: true, ovsBack: null }), ''); pushed = true; }
            else if (!(history.state && history.state.ovsMenu)) { history.pushState(Object.assign({}, history.state || {}, { ovsMenu: true }), ''); pushed = true; }
        } catch { pushed = false; }
        if (opts.restore && opts.restore.scroll > 0) {
            // Its parts arrive a moment later (the home screen, the wall): the scroll is put back as they land.
            const want = opts.restore.scroll;
            const put = () => { if (listEl && listEl.scrollTop < want) listEl.scrollTop = want; };
            requestAnimationFrame(put); setTimeout(put, 250); setTimeout(put, 700);
        }
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
            orbEl.classList.remove('is-x', 'is-pop', 'is-gone');
            if (phoneSheet()) {
                // From the button's centre to the pill's right end: the same orb, moving into the menu. When the pressed
                // button flies into its tab instead, the orb is simply there as the close X.
                const home = barButtonCentre();
                const bar = el.querySelector('.ovs-bar'), br = bar ? bar.getBoundingClientRect() : null;
                const tx = br ? br.right + 6 + 24 : innerWidth - 24, ty = br ? br.top + br.height / 2 : 28;
                orbEl.style.setProperty('--orb-x', `${Math.round(tx - 24)}px`); orbEl.style.setProperty('--orb-y', `${Math.round(ty - 24)}px`);
                settleOrb();
                if (home) { orbEl.style.setProperty('--orb-dx', `${Math.round(home.cx - tx)}px`); orbEl.style.setProperty('--orb-dy', `${Math.round(home.cy - ty)}px`); }
                // The button has flown to its tab, or no menu button is on screen: the close turns in at the pill.
                if (flyFrom || !home) orbEl.classList.add('is-x', 'is-pop');
                else {
                    orbEl.classList.add('is-from');
                    void orbEl.offsetWidth;
                    requestAnimationFrame(() => { orbEl.classList.remove('is-from'); orbEl.classList.add('is-x'); });
                }
            }
        }
        if (root.OVSurfaces) {
            surface = root.OVSurfaces.sheet({ el: el.querySelector('.ovs-panel'), opener: lastFocus,
                header: el.querySelector('.ovs-bar'), body: listEl, close });
            surface.open();
        } else document.documentElement.style.overflow = 'hidden';
        input.placeholder = askHint();
        input.value = opts.q || '';
        try { syncTools(); } catch { /* */ }
        paintGhost();
        render(input.value);
        if (flyFrom && !input.value) requestAnimationFrame(flyIn);
        // All apps is a view of You's home screen: it opens as the home screen arrives (4.229.0, you/apps).
        wantDrawer = opts.section === 'apps';
        const sec = opts.section === 'apps' ? 'home' : opts.section;
        if (sec) setTimeout(() => { const section = listEl.querySelector(`[data-sec="${sec}"]`); if (section && section.scrollIntoView) section.scrollIntoView({ block: 'start' }); }, 80);
        // On a phone the orb opens a menu, not a search: focusing the field would raise the keyboard over the menu (owner
        // 11-08), so focus stays on the close orb until the person taps the field. A query, or a computer, still types.
        setTimeout(() => { if (phoneSheet() && !opts.q && !opts.search && orbEl && orbEl.isConnected) orbEl.focus({ preventScroll: true }); else input.focus(); }, 0);
        // What makes it the person's own arrives after the first paint: their history, and the tools catalog.
        mine = null;
        loadHistory().then((h) => { if (h && el.classList.contains('is-open')) { mine = h; paintGhost(); render(input.value); } });
        if (!catalog) loadCatalog().then((c) => { if (c) { catalog = c; if (el.classList.contains('is-open')) render(input.value); } });
        loadPulse().then((d) => { if (d && el.classList.contains('is-open') && !input.value.trim() && view !== 'results') render(''); });
        loadChanges().then((d) => { if (d && el.classList.contains('is-open') && !input.value.trim() && view !== 'results') render(''); });
        if (opts.door) showDoor(opts.door);
        const jump = opts.tab === 'tools' || opts.tab === 'sites' ? opts.tab : '';
        if (jump) setTimeout(() => { const t = listEl.querySelector(`[data-sec="${jump === 'tools' ? 'tools' : 'all'}"]`); if (t && t.scrollIntoView) t.scrollIntoView({ block: 'start' }); }, 60);
    }
    // ownBack: the history.back() a close made itself. Its popstate arrives later, and must not close a menu opened
    // again in between (a quick close-and-reopen on the picture lost the second open, 2026-11-10).
    let pushed = false, popping = false, surface = null, ownBack = false, wantDrawer = false;
    if (typeof window !== 'undefined') window.addEventListener('popstate', () => {
        if (ownBack) return;
        if (!(el && el.classList.contains('is-open'))) {
            try { if (history.state && history.state.ovsBack) document.dispatchEvent(new CustomEvent('openvibe-menu-restore')); } catch { /* */ }
        }
    });
    if (typeof window !== 'undefined') window.addEventListener('popstate', () => { if (ownBack) { ownBack = false; return; } if (el && el.classList.contains('is-open')) { popping = true; pushed = false; close(); popping = false; } });
    // The bar's menu button as it is now (11-13, the owner: "the close button … goes into the users avatar drop-down spot
    // rather than where it should"). The orb is that button turned into the close, so it leaves from it and goes back
    // into it: the button that opened the menu when it is a visible bar button, else the bar's menu button (the burger
    // on a phone, the orb on a computer). Measured each time, never remembered: the bar may have scrolled away or come
    // back since, and on a phone the computer's orb is hidden (zero size). Null when none is on screen.
    function barButtonCentre() {
        // The orb is the menu button turned into the close: it goes home into the menu button, never into the picture or
        // another opener (11-14, the owner: still went into the avatar).
        const list = [document.getElementById('openvibe-burger'), document.getElementById('openvibe-search-btn')];
        for (const b of list) {
            if (!b || typeof b.getBoundingClientRect !== 'function' || typeof b.closest !== 'function' || !b.closest('.openvibe-navbar')) continue;
            const r = b.getBoundingClientRect();
            if (r.width < 8 || r.height < 8 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
            return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
        }
        return null;
    }
    /** The close sits beside the search field, centred on it and as tall as it (4.248.0; the owner, 11-14: "the close
     *  button's offset … more consistent with the search input"). Measured again once the sheet has slid in and when the
     *  window changes, never only at the first frame (the field was still moving then). */
    let orbWatch = null;
    function placeOrb() {
        if (!orbEl || !el || !el.classList.contains('is-open') || !phoneSheet()) return;
        const bar = el.querySelector('.ovs-bar'); if (!bar) return;
        const r = bar.getBoundingClientRect(); if (!r.height) return;
        const size = Math.max(44, Math.min(56, Math.round(r.height)));
        orbEl.style.setProperty('--orb-size', `${size}px`);
        orbEl.style.setProperty('--orb-x', `${Math.round(Math.min(innerWidth - size - 4, r.right + 8))}px`);
        orbEl.style.setProperty('--orb-y', `${Math.round(r.top + (r.height - size) / 2)}px`);
    }
    function settleOrb() {
        [140, 360, 700].forEach((t) => setTimeout(placeOrb, t));
        if (!orbWatch && typeof window !== 'undefined') {
            orbWatch = () => requestAnimationFrame(placeOrb);
            window.addEventListener('resize', orbWatch, { passive: true });
            if (window.visualViewport) window.visualViewport.addEventListener('resize', orbWatch, { passive: true });
        }
    }
    function close({ navigating = false } = {}) {
        // The tab flies back into the bar button that opened it (not when a link was followed: the page is going).
        // Only while the menu still shows what the opener opened (11-14, the owner: "it goes to the user avatar instead of
        // … going to the right icon"): opened from the picture and moved to Community, the close is the menu's own.
        const backTo = flyFrom && !door && tab === fromTab ? flyFrom : null; flyFrom = null; fromTab = null;
        if (backTo && !navigating && el && el.classList.contains('is-open') && !closing) fly(tabFace(door || tab), backTo, { back: true, toFace: flyIdle });
        flyIdle = null;
        if (view === 'results' && rtabsEl) leaveResults();
        leaveDoor();
        if (!el || closing) return;
        if (navigating) { pushed = false; markBack(); }
        // Closed by the person (Close, Escape, a tap outside): take back the entry Back would have used.
        // The page stays where it is (11-14, the owner: closing "scrolls the page down"): the browser restores no scroll
        // for this Back, and focus returns without scrolling.
        if (pushed && !popping) { pushed = false; try { if (history.state && history.state.ovsMenu) { ownBack = true; keepScroll(); history.back(); } } catch { /* */ } }
        // A phone's menu folds back into the orb (its x turns back into dots) before it goes; elsewhere it closes at once.
        if (phoneSheet() && !calm() && el.classList.contains('is-open')) {
            el.classList.add('is-closing');
            // With a button flying back, the close turns away where it is (two things never land on the bar at once);
            // otherwise it glides back into the button's place.
            if (orbEl) {
                orbEl.classList.remove('is-x', 'is-pop');
                // Back into the bar's menu button where it will be once the sheet lets the page go (the bar sits 16 px
                // off while the menu holds the page), so it is measured on the next frame, after this close has released
                // it. With no button on screen (or a tab flying back) the close turns away where it is, never into a
                // guessed corner.
                const flying = backTo;
                requestAnimationFrame(() => {
                    const home = flying ? null : barButtonCentre();
                    if (home) {
                        const ox = parseFloat(orbEl.style.getPropertyValue('--orb-x')) + 24, oy = parseFloat(orbEl.style.getPropertyValue('--orb-y')) + 24;
                        orbEl.style.setProperty('--orb-dx', `${Math.round(home.cx - ox)}px`); orbEl.style.setProperty('--orb-dy', `${Math.round(home.cy - oy)}px`);
                    }
                    if (closing) orbEl.classList.add(home ? 'is-from' : 'is-gone');
                });
            }
            closing = setTimeout(() => { closing = 0; el.classList.remove('is-open', 'is-closing'); if (orbEl) orbEl.classList.remove('is-from', 'is-gone'); }, 280);
        } else {
            el.classList.remove('is-open');
            rollStop(); clearInterval(rollTimer); rolledOpen = false;
            if (orbEl) orbEl.classList.remove('is-x', 'is-from', 'is-pop', 'is-gone');
        }
        if (surface) { surface.destroy(); surface = null; }
        else document.documentElement.style.overflow = '';
        if (inflight) { inflight.abort(); inflight = null; }
        if (ctx && typeof ctx.onClose === 'function') { try { ctx.onClose(); } catch { /* */ } }
        try { document.dispatchEvent(new CustomEvent('openvibe-menu', { detail: { open: false } })); } catch { /* */ }
        if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch { /* */ } }
    }
    /** Back taken by the menu itself: no scroll restored by the browser, and the page put back where it was if anything
     *  moved it (the scroll lock's release, a late restore). */
    function keepScroll() {
        try {
            const was = history.scrollRestoration;
            history.scrollRestoration = 'manual';
            const y = Number(document.body && document.body.style.position === 'fixed' ? -parseFloat(document.body.style.top || '0') : root.scrollY) || 0;
            let over = false;
            const done = () => { if (over) return; over = true; root.removeEventListener('popstate', done); setTimeout(() => { try { history.scrollRestoration = was; } catch { /* */ } if (Math.abs((root.scrollY || 0) - y) > 2) root.scrollTo(0, y); }, 0); };
            root.addEventListener('popstate', done);
            setTimeout(done, 600);
        } catch { /* */ }
    }

    // On a phone the empty menu keeps focus on its orb to avoid raising the keyboard. Escape must still close it.
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !e.defaultPrevented && el && el.classList.contains('is-open')) { e.preventDefault(); close(); }
    });

    document.addEventListener('ov:boost:load', () => { if (el && el.classList.contains('is-open') && !input.value) render(''); });

    /** Ask your agent: Vibe, with the words in its box, unsent (the Dock's ask() comes here when the bar wires it). */
    function prefill(text) {
        const t = String(text || '').slice(0, 4000);
        if (door === 'vibe' && runView) { runView.prefill(t); return true; }
        pendingAsk = t; runFilter = 'all';
        return showDoor('vibe');
    }
    const api = { open, close, door: (id) => showDoor(id), prefill, suggest, siteOf, registerCard, _state: () => ({ tab, door, from: ctx.from }) };
    root.OpenVibeSearch = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
