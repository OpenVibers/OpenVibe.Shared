/**
 * openvibe-shared/dock.js — the panels behind the menu's Chat and Vibe tabs: your conversations (Chat), and Vibe, your
 * coding tasks and your agents (Vibe's three parts). 4.220.0 (the owner, 11-12: "there should only be the one unified
 * UI … delete … the old tab system"): the floating Dock — its pill, its card and tab bar, corners, the phone sheet and
 * the window of its own — is gone. The menu (search.js) places these panels with mountInto on every screen.
 *
 *   OpenVibeDock.mount(opts)          a signed-in person's state and counts (navbar.js; null when signed out)
 *   OpenVibeDock.mountInto(host, { tab })   the panel body in the menu ('vibe' | 'code' | 'agent' | 'chats')
 *   OpenVibeDock.mountInto(host, { tab: 'agent', part: 'top' })   4.225.0: only the top of Agents (Now and the
 *                                            timeline, your Actor, the live agent view), for the menu's Vibe, which
 *                                            draws the runs and the Action Center's work itself (ov-run.js)
 *   OpenVibeDock.open({ tab }) / ask({ text }) / share({ text, title })   open the menu there (opts.openMenu)
 * What the old pill said (an agent needs you, agents working, a timer's minutes) goes to opts.status, which navbar.js
 * paints on the bar's menu button.
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OpenVibeDock) return;

    const svg = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
    const G = {
        clip: '<path d="M19.5 11.3l-7.6 7.6a4.9 4.9 0 0 1-6.9-6.9l7.9-7.9a3.3 3.3 0 0 1 4.6 4.6l-7.9 7.9a1.6 1.6 0 0 1-2.3-2.3l7.3-7.3"/>',
        personAdd: '<circle cx="10" cy="8" r="3.4"/><path d="M3.8 19.5c.7-3.5 3.1-5.4 6.2-5.4 1.4 0 2.6.4 3.6 1.1"/><path d="M18 13.5v6M15 16.5h6"/>',
        people: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3.2 19.5c.7-3.4 3-5.3 5.8-5.3s5.1 1.9 5.8 5.3"/><circle cx="17.2" cy="9.4" r="2.6"/><path d="M16 14.4c2.4.2 4.2 1.8 4.8 5"/>',
        server: '<rect x="4" y="4" width="7" height="7" rx="2.2"/><rect x="13" y="4" width="7" height="7" rx="2.2"/><rect x="4" y="13" width="7" height="7" rx="2.2"/><rect x="13" y="13" width="7" height="7" rx="2.2"/>',
        globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.6 3.6 5.4 3.6 8.5s-1.2 5.9-3.6 8.5c-2.4-2.6-3.6-5.4-3.6-8.5s1.2-5.9 3.6-8.5z"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4"/>',
        code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
        spark: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.4 15.6l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/>',
        bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
        close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
        open: '<path d="M13.5 5.5h5v5M18.5 5.5l-8 8M16.5 13.5v4a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h4"/>',
        chat: '<path d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-7l-4 3v-3H5A1.5 1.5 0 0 1 3.5 16V8A1.5 1.5 0 0 1 5 6.5z"/>',
        back: '<path d="M14.5 6.5L9 12l5.5 5.5"/>',
        send: '<path d="M12 20.7V4.2M3.7 12.4l8.3-8.3l8.3 8.3"/>',   // 4.220.0: the registry's (openvibe-shared/glyphs), as Vibe's box
        vibe: '<path d="M12 4.5a7.5 7.5 0 0 1 6.4 11.4L19.5 19.5l-3.6-1.1A7.5 7.5 0 1 1 12 4.5z"/><path d="M9 11.5h.01M12 11.5h.01M15 11.5h.01"/>',
        clock: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5M9.5 3h5"/>',
        // 4.220.0: the registry's pencil (openvibe-shared/glyphs), for a message's Edit.
        pencil: '<path d="M11.9 19.6h8.4M16.1 4.2a2 2 0 0 1 2.8 2.8L7.2 18.7l-3.7 0.9l0.9-3.7Z"/>',
    };
    // Vibe first (L48 V2): the person's AI, on every site.
    const ROBOT = '<rect x="5" y="8" width="14" height="10" rx="3"/><path d="M12 8V4.5M9.5 13h.01M14.5 13h.01M3 12.5v2M21 12.5v2"/>';   // as in the menu's row
    const TABS = [['vibe', 'Vibe', G.spark], ['code', 'Code', G.code], ['agent', 'Agents', ROBOT], ['chats', 'Chat', G.chat]];
    const DEFAULT_STATE = { tab: 'vibe', agent: null, chat: null, vibe: null };

    let bodyEl = null, inline = null, panelEpoch = 0, o = {}, doc = null, tab = 'vibe', saveT = 0, pending = {};
    let part = null;   // 'top': only the top of the Agents panel is lent (mountInto … part: 'top', 4.225.0)
    const mounts = {};

    const state = () => (doc && doc.state) || DEFAULT_STATE;
    const counts = () => (doc && doc.counts) || {};
    const sibling = (name) => (typeof o.sibling === 'function' ? o.sibling(name) : `https://openvibe.network/shared/${name}`);
    // K-D3: the agent stream is OpenVibe.Codes' (it mints the view ticket with the person's own token) and the one
    // timeline behind the Dock is OpenVibe.Actor's (design 2026-11-07). On a site both go through Network's frame
    // relay: every site's connect-src allows openvibe.network and refuses openvibe.codes and openvibe.actor. A test
    // or the extension passes agentBase/actorBase and reaches the product itself; actorBase also names the Actor's
    // pages in the run list.
    const frameBase = () => String(o.frameBase || (String(o.apiBase || 'https://openvibe.network').replace(/\/+$/, '') + '/api/frame')).replace(/\/+$/, '');
    const directBase = (v) => (v ? String(v).replace(/\/+$/, '') : '');
    const actorBase = () => String(o.actorBase || 'https://openvibe.actor').replace(/\/+$/, '');

    async function call(path, init = {}) {
        const base = String(o.apiBase || 'https://openvibe.network').replace(/\/+$/, '');
        const t = await tokenOf();
        const headers = { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...(t ? { authorization: `Bearer ${t}` } : {}) };
        const r = await fetch(base + path, { ...init, headers, credentials: 'omit' });
        return r.ok ? r.json() : null;
    }
    /** A token may be a string, a sync function or an async function (the extension refreshes it). */
    async function tokenOf() { return typeof o.token === 'function' ? await o.token() : o.token; }
    const notify = () => { store(doc); paintStatus(); };

    /** A change to the state: painted now, sent to the Network a beat later (several changes go as one PUT). */
    function save(patch) {
        const st = state();
        const next = { ...st, ...patch };
        doc = { ...(doc || {}), state: next, counts: counts() };
        pending = { ...pending, ...patch };
        notify();
        clearTimeout(saveT);
        saveT = setTimeout(flush, 700);
    }
    async function flush() {
        const body = pending; pending = {};
        if (!Object.keys(body).length) return;
        try {
            const r = await call('/api/v1/me/dock', { method: 'PUT', body: JSON.stringify(body) });
            if (r && r.state && !Object.keys(pending).length) { doc = { ...doc, state: r.state, counts: r.counts || counts() }; notify(); }
        } catch { /* offline, or no route yet: the copy stands and the next change tries again */ }
    }

    // Each sibling's content hash (scripts/sibling-revs.js writes it), so a release gives each a new URL.
    const DOCK_REV = { 'ov-chat-cards.js': '43cbb5c8c9d6', 'ov-tabs.js': '0e8a449da361', 'dock-vibe.js': '1b3c38c338b8', 'dock-code.js': 'ff5ce01c6933', 'dock-mount.js': 'fb07dccadb8c', 'dock-runs.js': '57b9d87fd71e', 'ai-marks-client.js': 'f4a880a9f206', 'action-center.js': 'c3f2db0f3fb3', 'dock-timeline.js': 'c2f16c16d470', 'dock-actor.js': 'aa013b999817', 'dock-agent.js': '8787080a04d3', 'dock-timer.js': '460d68aa8321', 'dock-share.js': 'e83b2e27b3ef', 'dock-card.js': '2643c20b0016', 'dock-chat-edits.js': '6cf8c6b6daa5' };
    function load(src, test) {
        return new Promise((ok) => {
            if (test()) return ok(true);
            const id = `ov-dock-${src.replace(/\W/g, '')}`;
            let sc = document.getElementById(id);
            if (!sc) { sc = document.createElement('script'); sc.id = id; sc.src = sibling(src) + (DOCK_REV[src] ? `?v=${DOCK_REV[src]}` : ''); sc.async = true; document.head.appendChild(sc); }
            sc.addEventListener('load', () => ok(test()));
            sc.addEventListener('error', () => ok(false));
        });
    }
    // Chat's event cards (ov-chat-cards.js), loaded with Global; a pane's own load() shadows the name inside it.
    const loadCards = () => load('ov-chat-cards.js', () => !!root.OVChatCards);

    function styles() {
        if (document.getElementById('ovdk-styles')) return;
        const st = document.createElement('style');
        st.id = 'ovdk-styles';
        st.textContent = `
            /* The bar's menu button carries the status: navbar.js paints .ovnav-st, which shows only once this file has loaded. */
            .ovnav-st { position: absolute; top: -4px; right: -6px; z-index: 1; display: inline-flex; align-items: center; justify-content: center; min-width: 10px; height: 18px; padding: 0 6px;
                box-sizing: border-box; border-radius: 999px; font: normal 750 10.5px/1 var(--font-sans, inherit); font-variant-numeric: tabular-nums; letter-spacing: .01em; white-space: nowrap;
                --st: var(--accent-strong, var(--accent, #3b82f6)); color: var(--on-accent-strong, var(--on-accent, #fff)); background: var(--st); box-shadow: 0 0 0 2px var(--bg-primary, #0b0f19); pointer-events: none; }
            [data-ov-status="running"] > .ovnav-st, [data-ov-status="waiting"] > .ovnav-st { width: 10px; min-width: 10px; height: 10px; padding: 0; top: 1px; right: 1px; }
            [data-ov-status^="timer"] > .ovnav-st { top: auto; bottom: -8px; right: 50%; transform: translateX(50%); height: 15px; padding: 0 5px; font-size: 9.5px; }
            [data-ov-status="waiting"] > .ovnav-st { --st: var(--warning, #f5a524); }
            [data-ov-status="timer-done"] > .ovnav-st { --st: var(--success, #22c55e); color: #052e14; }
            [data-ov-status="running"] > .ovnav-st { animation: ovnav-st-breathe 1.8s ease-in-out infinite; }
            [data-ov-status="waiting"] > .ovnav-st { animation: ovnav-st-breathe 1.2s ease-in-out infinite; }
            @keyframes ovnav-st-breathe { 50% { box-shadow: 0 0 0 2px var(--bg-primary, #0b0f19), 0 0 0 6px color-mix(in srgb, var(--st) 30%, transparent); } }
            html[data-ov-motion=calm] [data-ov-status] > .ovnav-st { animation-duration: 3.2s; }
            html[data-ov-motion=off] .ovnav-st { animation: none; }
            /* 4.220.0: the panels live in the menu only (the floating card, its pill and tab bar are gone). */
            .ovdk { position: relative; display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box; width: 100%; height: 100%; min-height: 0;
                color: var(--text-primary, #ececf1); font-family: inherit; container-type: inline-size; }
            .ovdk svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
            /* The menu button's drawing (navbar.js) has its own fills: the line style above is not its. */
            .ovdk svg.ovmb { fill: currentColor; stroke: none; stroke-width: 0; }
 { transform: translateX(16px); }
            .ovdk-body { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
            .ovdk-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; }
            .ovdk-panel[hidden] { display: none; }
            .ovdk-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
            .ovdk-foot { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; border-top: 1px solid var(--border, rgba(255,255,255,.08)); font-size: 12.5px; }
            .ovdk-foot a, .ovdk-foot button { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0; border: 0; background: none; font: inherit; font-weight: 700; cursor: pointer; text-decoration: none; color: var(--accent-light, var(--accent, #60a5fa)); }
            .ovdk-foot button { color: var(--text-secondary, #b6b6c0); }
            .ovdk-foot button:hover { color: var(--text-primary, #ececf1); }
            .ovdk-foot svg { width: 15px; height: 15px; }
            .ovdk-wait { display: flex; justify-content: center; padding: 36px; }
            .ovdk-wait span { position: relative; display: inline-block; width: 6px; height: 6px; margin: 0 10px; border: 0; border-radius: 50%; background: var(--accent, #3b82f6); animation: ovdk-hop 1s ease-in-out .15s infinite; }
            .ovdk-wait span::before, .ovdk-wait span::after { content: ''; position: absolute; top: 0; width: 6px; height: 6px; border-radius: 50%; background: inherit; animation: ovdk-hop 1s ease-in-out infinite; }
            .ovdk-wait span::before { left: -10px; } .ovdk-wait span::after { left: 10px; animation-delay: .3s; }
            @keyframes ovdk-hop { 0%, 80%, 100% { transform: translateY(0); opacity: .45; } 40% { transform: translateY(-4px); opacity: 1; } }
            .ovdk-none { padding: 40px 24px; text-align: center; color: var(--text-muted, #8b8b96); font-size: 13.5px; line-height: 1.45; }
            .ovdk-muted { color: var(--text-muted, #8b8b96); }
            .ovdk-i { display: inline-grid; place-items: center; }
            .ovdk-i svg { width: 18px; height: 18px; }
            .ovdk-bar { flex: none; display: flex; justify-content: flex-end; gap: 4px; padding: 4px 8px 0; }
            .ovdk-ib { flex: none; width: 40px; height: 40px; display: grid; place-items: center; border: 0; border-radius: 12px; background: transparent; color: var(--text-secondary, #b6b6c0); cursor: pointer; text-decoration: none; }
            .ovdk-ib svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; }
            .ovdk-ib:hover, .ovdk-ib:focus-visible { background: var(--hover-bg, rgba(127,127,127,.12)); color: var(--text-primary, #ececf1); }
            .ovdk-thread-h .ovdk-ib { margin-left: auto; }
            .ovdk-chats { list-style: none; margin: 0; padding: 6px; display: grid; gap: 2px; }
            .ovdk-rail { display: flex; gap: 8px; overflow-x: auto; overflow-y: hidden; padding: 10px 10px 8px; scrollbar-width: none; border-bottom: 1px solid var(--border, rgba(148,163,184,.14)); }
            .ovdk-rail::-webkit-scrollbar { display: none; }
            .ovdk-rail-i { all: unset; flex: none; display: grid; justify-items: center; gap: 4px; width: 54px; cursor: pointer; text-decoration: none; }
            .ovdk-rail-t { position: relative; display: grid; place-items: center; width: 44px; height: 44px; border-radius: var(--ov-app-corner, 22.5%); color: var(--text-secondary, #a8b3c4); background: color-mix(in srgb, var(--text-primary, #e6edf3) 7%, transparent); transition: transform .2s cubic-bezier(.34, 1.56, .64, 1), background-color .2s; }
            .ovdk-rail-t svg { width: 22px; height: 22px; }
            .ovdk-rail-t.is-server { color: #fff; background: hsl(var(--rh, 215) 55% 42%); overflow: visible; }
            .ovdk-rail-t.is-server img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
            .ovdk-rail-t.is-server b { font-size: 17px; font-weight: 800; }
            .ovdk-rail-i:hover .ovdk-rail-t, .ovdk-rail-i:focus-visible .ovdk-rail-t { transform: translateY(-2px); background-color: color-mix(in srgb, var(--accent, #3b82f6) 22%, transparent); }
            .ovdk-rail-i:hover .ovdk-rail-t.is-server, .ovdk-rail-i:focus-visible .ovdk-rail-t.is-server { background-color: hsl(var(--rh, 215) 60% 48%); }
            .ovdk-rail-n { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 600; color: var(--text-secondary, #a8b3c4); }
            .ovdk-rail-div { flex: none; align-self: center; width: 1px; height: 32px; margin: 0 2px 16px; background: var(--border, rgba(148,163,184,.2)); }
            .ovdk-rail-dot { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; display: grid; place-items: center; font: 700 10.5px/1 Inter, sans-serif; font-style: normal; color: #fff; background: #ef4444; box-shadow: 0 0 0 2px var(--bg-elevated, #1d1f27); }
            html[data-ov-motion="off"] .ovdk-rail-t { transition: none; }
            .ovdk-friends { display: grid; gap: 8px; padding: 8px 10px 4px; border-bottom: 1px solid var(--border, rgba(148,163,184,.14)); }
            .ovdk-sec { margin: 0 2px; font-size: 11.5px; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted, #8b8b96); }
            .ovdk-friends-row { display: flex; gap: 10px; overflow-x: auto; overflow-y: hidden; padding: 4px 2px 6px; scrollbar-width: none; }
            .ovdk-friends-row::-webkit-scrollbar { display: none; }
            .ovdk-friend { all: unset; flex: none; display: grid; justify-items: center; gap: 4px; width: 58px; cursor: pointer; }
            .ovdk-friend .ovdk-av { width: 46px; height: 46px; transition: transform .2s cubic-bezier(.34, 1.56, .64, 1), box-shadow .2s ease; }
            .ovdk-friend:hover .ovdk-av, .ovdk-friend:focus-visible .ovdk-av { transform: translateY(-2px); box-shadow: 0 0 0 2px var(--accent, #3b82f6); }
            .ovdk-friend .ovdk-av.is-online { box-shadow: 0 0 0 2px var(--bg-elevated, #1d1f27), 0 0 0 4px #22c55e; }
            .ovdk-friend-n { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; font-weight: 600; color: var(--text-secondary, #a8b3c4); }
            .ovdk-request { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 6px 4px; }
            .ovdk-request .ovdk-av { width: 32px; height: 32px; font-size: 12px; }
            .ovdk-request-t { font-size: 13px; line-height: 1.35; }
            .ovdk-request-ok, .ovdk-addfriend-go { all: unset; box-sizing: border-box; display: inline-grid; place-items: center; min-height: 36px; padding: 0 14px; border-radius: 999px; background: var(--accent, #3b82f6); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; transition: filter .15s ease, transform .12s ease; }
            .ovdk-request-ok:hover, .ovdk-addfriend-go:hover { filter: brightness(1.08); }
            .ovdk-request-ok:active, .ovdk-addfriend-go:active { transform: scale(.96); }
            .ovdk-request-ok:disabled, .ovdk-addfriend-go:disabled { opacity: .55; cursor: default; }
            .ovdk-addfriend { display: flex; gap: 8px; align-items: center; }
            .ovdk-addfriend .ovdk-addfriend-go { width: 44px; height: 44px; min-height: 44px; padding: 0; border-radius: calc(var(--ov-radius-2, 14px) + 2px); }
            .ovdk-addfriend .ovdk-addfriend-go svg { width: 20px; height: 20px; }
            /* 4.288.0 (the owner, 11-16: "extra rounded … doesn't match all the other sites"): the menu box's shape, not a pill. */
            .ovdk-addfriend input { flex: 1; min-width: 0; box-sizing: border-box; height: 44px; padding: 0 14px; border-radius: calc(var(--ov-radius-2, 14px) + 2px); border: 1px solid var(--border, rgba(148,163,184,.2)); background: var(--bg-primary, #0b1220); color: var(--text-primary, #ececf1); font: inherit; font-size: 14px; }
            .ovdk-addfriend input:focus { outline: none; border-color: var(--accent, #3b82f6); }
            .ovdk-addfriend-note { margin: 0 4px; font-size: 12.5px; color: var(--text-secondary, #a8b3c4); }
            /* 4.263.0, the Chat tab's segments (Messages · Friends · Global · Servers): a quiet track, the chosen one lifted,
               a red count for what waits; each pane rises in. Calm moves less, Off does not move. */
            .ovdk-segs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; margin: 4px 10px 6px; padding: 4px; border-radius: 16px; background: color-mix(in srgb, var(--text-primary, #ececf1) 6%, transparent); }
            .ovdk-seg { all: unset; box-sizing: border-box; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-width: 0; min-height: 50px; border-radius: 12px; font-size: 12px; font-weight: 650; color: var(--text-secondary, #a8b3c4); cursor: pointer; transition: background-color .18s ease, color .18s ease, box-shadow .18s ease; }
            .ovdk-seg .ovdk-i svg { width: 19px; height: 19px; }
            .ovdk-seg-l { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .ovdk-seg[aria-selected="true"] { color: var(--text-primary, #ececf1); background: var(--bg-elevated, #1d1f27); box-shadow: 0 0 0 1px var(--border, rgba(148,163,184,.18)), 0 6px 16px -10px rgba(0,0,0,.6); }
            .ovdk-seg[aria-selected="true"] .ovdk-i { color: var(--accent-light, var(--accent, #60a5fa)); }
            .ovdk-seg:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: -2px; }
            .ovdk-seg:active { transform: scale(.96); }
            .ovdk-seg-n.is-quiet { background: color-mix(in srgb, var(--accent, #3b82f6) 30%, var(--bg-elevated, #1f2937)); color: color-mix(in srgb, var(--accent, #3b82f6) 30%, #fff); }
            .ovdk-seg-n { position: absolute; top: 4px; left: calc(50% + 6px); min-width: 17px; height: 17px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; background: var(--danger, #ef4444); color: #fff; font-size: 10.5px; font-weight: 800; line-height: 17px; text-align: center; }
            .ovdk-pane { display: grid; align-content: start; gap: 2px; padding: 4px 6px 10px; animation: ovdk-pane-in .22s cubic-bezier(.2,.8,.2,1) both; }
            @keyframes ovdk-pane-in { from { opacity: 0; transform: translateY(calc(6px * var(--ov-move, 1))); } }
            .ovdk-pane .ovdk-sec { padding: 12px 8px 4px; }
            .ovdk-rows { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
            .ovdk-rows > li { animation: ovdk-pane-in .24s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 22ms); }
            .ovdk-row { box-sizing: border-box; display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; align-items: center; gap: 12px; width: 100%; min-height: 58px; padding: 7px 10px; border: 0; border-radius: 14px; background: transparent; color: inherit; font: inherit; text-align: left; text-decoration: none; cursor: pointer; transition: background-color .15s ease; }
            li.ovdk-row { cursor: default; }
            @media (hover: hover) { button.ovdk-row:hover, a.ovdk-row:hover { background: color-mix(in srgb, var(--text-primary, #ececf1) 6%, transparent); } }
            button.ovdk-row:active, a.ovdk-row:active { transform: scale(.985); }
            .ovdk-row:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: -2px; }
            .ovdk-row .ovdk-av { width: 44px; height: 44px; }
            .ovdk-row .ovdk-av.is-online { box-shadow: 0 0 0 2px var(--bg-elevated, #1d1f27), 0 0 0 4px #22c55e; }
            .ovdk-row-b { display: grid; min-width: 0; gap: 1px; }
            .ovdk-row-b b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14.5px; }
            .ovdk-suggest[hidden] { display: none; }
            .ovdk-row-n { display: flex; align-items: center; gap: 4px; min-width: 0; line-height: 1.25; }
            .ovdk-row-n > b { min-width: 0; }
            .ovdk-row-n > .ov-hat, .ovdk-row-n > img { flex: none; margin: 0; }
            .ovdk-av.is-initial { background: linear-gradient(140deg, hsl(var(--ovdk-hue, 220) 55% 42%), hsl(calc(var(--ovdk-hue, 220) + 40) 60% 30%)); color: #fff; font-weight: 800; }
            .ovdk-add-q { min-height: 36px; padding: 0 14px 0 11px; border: 1px solid color-mix(in srgb, var(--accent, #3b82f6) 45%, transparent); border-radius: 999px; background: color-mix(in srgb, var(--accent, #3b82f6) 14%, transparent); color: color-mix(in srgb, var(--accent, #3b82f6) 35%, var(--text-primary, #ececf1)); font: inherit; font-size: 13.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: background .2s, transform .15s; }
            .ovdk-add-q:hover { background: color-mix(in srgb, var(--accent, #3b82f6) 26%, transparent); }
            .ovdk-add-q:active { transform: scale(.95); }
            .ovdk-add-q svg { width: 18px; height: 18px; }
            .ovdk-row-p { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; color: var(--text-secondary, #a8b3c4); }
            /* 4.288.0 (the owner, 11-16: "all the UI in this menu could be improved"): a row's action read as a faint 13 px mark;
               it is a soft 36 px chip now, tinted on hover, so a friend's row says what a press does. */
            .ovdk-row-go { color: var(--text-muted, #8b8b96); } .ovdk-row-go svg { width: 18px; height: 18px; }
            .ovdk-row .ovdk-row-go { flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 12px; color: var(--text-secondary, #a8b3c4); background: color-mix(in srgb, var(--text-primary, #e6edf7) 6%, transparent); transition: background .15s ease, color .15s ease; }
            .ovdk-row .ovdk-row-go svg { width: 20px; height: 20px; }
            .ovdk-row:hover .ovdk-row-go, .ovdk-row:focus-visible .ovdk-row-go { color: var(--accent-light, #60a5fa); background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); }
            .ovdk-row-acts { display: flex; gap: 6px; }
            .ovdk-request-no { all: unset; box-sizing: border-box; display: inline-grid; place-items: center; min-height: 36px; padding: 0 12px; border-radius: 999px; font-size: 13px; font-weight: 650; color: var(--text-secondary, #a8b3c4); cursor: pointer; background: color-mix(in srgb, var(--text-primary, #ececf1) 7%, transparent); }
            .ovdk-request-no:hover { color: var(--text-primary, #ececf1); }
            .ovdk-fr-add { display: grid; gap: 6px; padding: 6px 6px 2px; }
            .ovdk-none-go { all: unset; cursor: pointer; justify-self: center; margin-top: 10px; min-height: 40px; padding: 0 16px; border-radius: 999px; font-weight: 700; color: #fff; background: var(--accent, #3b82f6); }
            .ovdk-gl-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
            .ovdk-gl-row { display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 10px; padding: 6px 8px; border-radius: 12px; }
            .ovdk-gl-row .ovdk-av { width: 32px; height: 32px; }
            .ovdk-gl-b { display: grid; min-width: 0; gap: 1px; }
            .ovdk-gl-h { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
            .ovdk-gl-h b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; }
            .ovdk-gl-h time { flex: none; font-size: 11.5px; color: var(--text-muted, #8b8b96); }
            .ovdk-gl-t { font-size: 14px; line-height: 1.4; overflow-wrap: anywhere; color: var(--text-primary, #ececf1); }
            .ovdk-gl-open, .ovdk-sv-act { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; margin: 8px 4px 0; border-radius: 14px; font-weight: 700; text-decoration: none; color: var(--accent-light, var(--accent, #60a5fa)); background: color-mix(in srgb, var(--accent, #3b82f6) 14%, transparent); transition: background-color .15s ease; }
            .ovdk-gl-open:hover, .ovdk-sv-act:hover { background: color-mix(in srgb, var(--accent, #3b82f6) 22%, transparent); }
            .ovdk-gl-open .ovdk-i svg, .ovdk-sv-act .ovdk-i svg { width: 18px; height: 18px; }
            .ovdk-sv-more { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
            .ovdk-sv-more .ovdk-sv-act { margin: 8px 0 0; }
            /* 4.275.0: Friends offer names as you type; Global is the room itself; Servers start and join right here. */
            .ovdk-addfriend-go { width: 40px; min-height: 40px; padding: 0; border-radius: 50%; }
            .ovdk-addfriend-go .ovdk-i svg, .ovdk-ask .ovdk-i svg { width: 20px; height: 20px; }
            .ovdk-ask { gap: 6px; display: inline-flex; align-items: center; }
            .ovdk-suggest { list-style: none; margin: 0; padding: 4px; display: grid; gap: 2px; border-radius: 14px; background: var(--bg-elevated, var(--bg-secondary, #1d1f27)); box-shadow: 0 10px 30px rgba(0,0,0,.35); animation: ovdk-pop .16s cubic-bezier(.2,.8,.2,1) both; }
            .ovdk-sug { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 48px; padding: 6px 8px; border-radius: 10px; cursor: pointer; }
            .ovdk-sug .ovdk-av { width: 34px; height: 34px; font-size: 13px; }
            .ovdk-sug:hover, .ovdk-sug[aria-selected="true"] { background: color-mix(in srgb, var(--accent, #3b82f6) 14%, transparent); }
            @keyframes ovdk-pop { from { opacity: 0; transform: translateY(calc(-4px * var(--ov-move, 1))); } to { opacity: 1; transform: none; } }
            .ovdk-none-soft { display: grid; justify-items: center; gap: 6px; padding: 28px 24px; }
            .ovdk-none-soft .ovdk-i svg { width: 28px; height: 28px; opacity: .7; }
            .ovdk-gl { display: flex; flex-direction: column; min-height: 100%; }
            .ovdk-gl-top { display: flex; align-items: center; gap: 8px; padding: 8px 10px; color: var(--text-secondary, #a8b3c4); font-size: 13px; font-weight: 650; }
            .ovdk-gl-top .ovdk-i svg { width: 18px; height: 18px; }
            .ovdk-gl-title { flex: 1; min-width: 0; }
            .ovdk-gl-full { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; color: var(--text-muted, #8b8b96); }
            .ovdk-gl-full:hover { color: var(--text-primary, #ececf1); background: color-mix(in srgb, var(--text-primary, #ececf1) 7%, transparent); }
            .ovdk-gl .ovdk-gl-list { flex: 1; align-content: end; }
            .ovdk-gl-list > li { animation: ovdk-pop .2s ease both; }
            .ovdk-gl-quiet { margin: 24px 0; text-align: center; color: var(--text-muted, #8b8b96); font-size: 13.5px; }
            .ovdk-gl-say, .ovdk-sv-new { position: sticky; bottom: 0; display: flex; align-items: center; gap: 6px; margin: 8px 4px 4px; padding: 4px 4px 4px 14px; border: 1px solid var(--border, rgba(148,163,184,.2)); border-radius: 999px; background: var(--bg-input, var(--bg-primary, #0f1522)); transition: border-color .15s ease; }
            .ovdk-sv-new { position: static; padding-left: 10px; color: var(--text-muted, #8b8b96); }
            .ovdk-gl-say:focus-within, .ovdk-sv-new:focus-within { border-color: var(--accent, #3b82f6); }
            .ovdk-gl-say input, .ovdk-sv-new input { flex: 1; min-width: 0; height: 38px; padding: 0; border: 0; outline: none; background: none; color: var(--text-primary, #ececf1); font: inherit; font-size: 15px; box-shadow: none; }
            .ovdk-gl-send, .ovdk-sv-make { all: unset; flex: none; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; color: #fff; background: var(--accent, #3b82f6); cursor: pointer; }
            .ovdk-gl-send:disabled, .ovdk-sv-make:disabled { opacity: .55; cursor: default; }
            .ovdk-gl-send:active, .ovdk-sv-make:active { transform: scale(.94); }
            .ovdk-gl-send:focus-visible, .ovdk-sv-make:focus-visible { outline: 2px solid var(--accent-light, var(--accent, #3b82f6)); outline-offset: 2px; }
            .ovdk-gl-send .ovdk-i svg, .ovdk-sv-make .ovdk-i svg { width: 18px; height: 18px; }
            .ovdk-gl-note { margin: 0 14px 6px; font-size: 12.5px; color: var(--text-secondary, #a8b3c4); }
            .ovdk-sv-find .ovdk-row-b { color: inherit; text-decoration: none; }
            .ovdk-sv-filter { box-sizing: border-box; width: calc(100% - 8px); height: 40px; margin: 2px 4px 6px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--border, rgba(148,163,184,.2)); background: var(--bg-input, var(--bg-primary, #0f1522)); color: var(--text-primary, #ececf1); font: inherit; font-size: 15px; -webkit-appearance: none; appearance: none; }
            .ovdk-sv-filter:focus { outline: none; border-color: var(--accent, #3b82f6); }
            .ovdk-gl-more { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; margin: 6px 4px 0; color: var(--text-muted, #8b8b96); font-size: 13px; font-weight: 650; text-decoration: none; }
            .ovdk-gl-more:hover { color: var(--text-primary, #ececf1); }
            /* The Servers foot (4.284.0): pinned to the pane's bottom over a fade; New server floats in its corner. */
            .ovdk-sv-foot { position: sticky; bottom: 0; z-index: 2; display: flex; align-items: center; gap: 8px; margin-top: 10px; padding: 14px 4px calc(6px + env(safe-area-inset-bottom, 0px));
                background: linear-gradient(to top, var(--bg-secondary, #141a24) 62%, transparent); }
            .ovdk-sv-foot .ovdk-gl-more { flex: 1; min-width: 0; margin: 0; justify-content: flex-start; padding: 0 14px; border-radius: 999px;
                background: color-mix(in srgb, var(--text-primary, #ececf1) 6%, transparent); }
            .ovdk-sv-foot .ovdk-gl-more span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .ovdk-fab { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 48px; padding: 0 18px 0 14px; border: 0; border-radius: 999px; cursor: pointer;
                font: inherit; font-size: 14px; font-weight: 750; color: #fff; background: var(--accent, #3b82f6);
                box-shadow: 0 12px 26px -12px color-mix(in srgb, var(--accent, #3b82f6) 85%, transparent), inset 0 1px 0 rgba(255, 255, 255, .22);
                animation: ovdk-fab-in .34s cubic-bezier(.3, 1.4, .4, 1) both; }
            .ovdk-fab .ovdk-i svg { width: 20px; height: 20px; transition: transform .25s cubic-bezier(.3, 1.4, .4, 1); }
            .ovdk-fab[aria-expanded="true"] .ovdk-i svg { transform: rotate(45deg); }
            .ovdk-fab:active { transform: scale(.95); }
            @keyframes ovdk-fab-in { from { opacity: 0; transform: scale(.6) translateY(calc(10px * var(--ov-move, 1))); } }
            .ovdk-sv-new.is-float { margin: 6px 4px 0; }
            .ovdk-sv-new.is-rising { animation: ovdk-rise .26s cubic-bezier(.2, .8, .2, 1) both; }
            @keyframes ovdk-rise { from { opacity: 0; transform: translateY(calc(12px * var(--ov-move, 1))); } }
            html[data-ov-motion=off] .ovdk-fab, html[data-ov-motion=off] .ovdk-sv-new.is-rising { animation: none; }
            .ovdk-gl-more .ovdk-i svg { width: 15px; height: 15px; }
            html[data-ov-motion="off"] .ovdk-suggest, html[data-ov-motion="off"] .ovdk-gl-list > li { animation: none; }
            html[data-ov-motion="off"] .ovdk-pane, html[data-ov-motion="off"] .ovdk-rows > li, html[data-ov-motion="off"] .ovdk-seg { animation: none; transition: none; }
            .ovdk-chat { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 12px; width: 100%; min-height: 60px; padding: 8px 10px; border: 0; border-radius: 14px;
                background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
            .ovdk-chat:hover { background: color-mix(in srgb, var(--text-primary, #ececf1) 5%, transparent); }
            .ovdk-chat:focus-visible { outline: 2px solid var(--accent-light, var(--accent, #3b82f6)); outline-offset: -2px; }
            .ovdk-av { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; overflow: hidden; font-weight: 800; font-size: 15px;
                color: var(--accent-light, var(--accent, #60a5fa)); background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); }
            .ovdk-av img { width: 100%; height: 100%; object-fit: cover; }
            .ovdk-av-vibe { color: #fff; background: radial-gradient(120% 120% at 30% 20%, color-mix(in srgb, var(--accent, #3b82f6) 70%, #a78bfa), var(--accent-strong, var(--accent, #2563eb))); }
            .ovdk-av-vibe svg { width: 22px; height: 22px; }
            .ovdk-av-group { display: flex; align-items: center; overflow: visible; background: transparent; }
            .ovdk-av-group .ovdk-av { width: 27px; height: 27px; margin-left: -12px; border: 2px solid var(--bg-elevated, var(--bg-secondary, #1d1f27)); font-size: 11px; }
            .ovdk-av-group .ovdk-av:first-child { margin-left: 0; }
            .ovdk-chat-b { display: grid; gap: 1px; min-width: 0; }
            .ovdk-chat-b b { font-size: 14px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .ovdk-chat-p { font-size: 12.5px; color: var(--text-secondary, #b6b6c0); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .is-unread .ovdk-chat-b b, .is-unread .ovdk-chat-p { color: var(--text-primary, #ececf1); font-weight: 750; }
            .ovdk-chat-m { display: grid; justify-items: end; gap: 4px; font-size: 11.5px; color: var(--text-muted, #8b8b96); font-variant-numeric: tabular-nums; }
            .ovdk-unread { min-width: 20px; padding: 1px 6px; box-sizing: border-box; border-radius: 999px; text-align: center; font-size: 11px; font-weight: 800;
                color: var(--on-accent-strong, var(--on-accent, #fff)); background: var(--accent-strong, var(--accent, #3472d8)); }
            .ovdk-thread-h { flex: none; display: flex; align-items: center; gap: 6px; padding: 6px 10px 6px 6px; border-bottom: 1px solid var(--border, rgba(255,255,255,.08)); }
            .ovdk-thread-h b { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14.5px; }
            .ovdk-back { width: 40px; height: 40px; flex: none; border: 0; border-radius: 12px; background: transparent; color: var(--text-secondary, #b6b6c0); cursor: pointer; display: grid; place-items: center; }
            .ovdk-back:hover { background: color-mix(in srgb, var(--text-primary, #ececf1) 7%, transparent); color: var(--text-primary, #ececf1); }
            .ovdk-back.is-pill { width: auto; display: inline-flex; align-items: center; gap: 2px; padding: 0 14px 0 6px; border-radius: 999px; font: inherit; font-size: 14px; font-weight: 750;
                color: var(--accent-light, var(--accent, #93c5fd)); background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, #3b82f6) 28%, transparent); }
            .ovdk-back.is-pill:hover { color: var(--text-primary, #ececf1); background: color-mix(in srgb, var(--accent, #3b82f6) 26%, transparent); }
            .ovdk-back.is-pill svg { width: 22px; height: 22px; }
            .ovdk-back.is-pill:active { transform: scale(.95); }
            .ovdk-msgs { list-style: none; margin: 0; padding: 12px; display: flex; flex-direction: column; gap: 3px; }
            .ovdk-msg { display: grid; justify-items: start; max-width: 84%; margin-top: 8px; }
            .ovdk-msg.is-cont { margin-top: 2px; }
            .ovdk-who-row { display: inline-flex; align-items: baseline; gap: 8px; margin: 0 4px 3px; min-width: 0; max-width: 100%; }
            .ovdk-who-row .ovdk-who { margin: 0; }
            .ovdk-time { font-size: 11.5px; font-weight: 600; color: var(--text-muted, #93a0b4); font-variant-numeric: tabular-nums; white-space: nowrap; }
            .ovdk-day { list-style: none; display: flex; align-items: center; gap: 10px; margin: 14px 4px 6px; font-size: 11.5px; font-weight: 750; letter-spacing: .04em; text-transform: uppercase; color: var(--text-muted, #93a0b4); }
            .ovdk-day::before, .ovdk-day::after { content: ''; flex: 1; height: 1px; background: color-mix(in srgb, var(--text-primary, #e6edf7) 10%, transparent); }
            .ovdk-msg.is-mine { align-self: flex-end; justify-items: end; }
            .ovdk-who { margin: 0 0 3px 10px; font-size: 11.5px; font-weight: 700; color: var(--text-muted, #8b8b96); }
            .ovdk-text { padding: 8px 12px; border-radius: 16px; font-size: 14px; line-height: 1.42; white-space: pre-wrap; overflow-wrap: anywhere;
                background: color-mix(in srgb, var(--text-primary, #ececf1) 7%, transparent); }
            .ovdk-msg.is-mine .ovdk-text { color: var(--on-accent-strong, var(--on-accent, #fff)); background: var(--accent-strong, var(--accent, #3472d8)); }
            .ovdk-send { flex: none; display: flex; align-items: flex-end; gap: 8px; margin: 8px 10px 10px; padding: 4px 4px 4px 12px; border-radius: 16px;
                border: 1px solid var(--border-light, var(--border, rgba(255,255,255,.14))); background: var(--bg-primary, #12141b); }
            .ovdk-send:focus-within { border-color: var(--accent, #3b82f6); }
            .ovdk-send textarea { flex: 1; min-width: 0; box-sizing: border-box; min-height: 36px; max-height: 140px; padding: 8px 0; resize: none; border: 0; outline: none; background: transparent; color: var(--text-primary, #ececf1); font: inherit; font-size: 14px; line-height: 1.4; }
            .ovdk-attach { width: 40px; height: 40px; flex: none; border: 0; border-radius: 12px; background: transparent; color: var(--text-secondary, #a8b3c4); cursor: pointer; display: grid; place-items: center; margin-left: -8px; }
            .ovdk-attach:hover { color: var(--text-primary, #e6edf7); background: color-mix(in srgb, var(--text-primary, #e6edf7) 8%, transparent); }
            .ovdk-attach svg { width: 20px; height: 20px; }
            .ovdk-pending { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 10px; }
            .ovdk-chip { position: relative; display: inline-flex; align-items: center; gap: 6px; max-width: 100%; min-height: 34px; padding: 0 4px 0 10px; border-radius: 10px; overflow: hidden; background: var(--bg-card, rgba(255,255,255,.05)); border: 1px solid var(--border, rgba(255,255,255,.1)); font-size: 13px; }
            .ovdk-chip > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
            .ovdk-chip > i { position: absolute; left: 0; bottom: 0; height: 2px; width: 0; background: var(--accent, #3b82f6); transition: width .2s; }
            .ovdk-chip:not(.is-up) > i { display: none; } .ovdk-chip.is-bad { border-color: var(--danger, #ef4444); }
            .ovdk-chip > button { width: 28px; height: 28px; border: 0; background: transparent; color: inherit; cursor: pointer; display: grid; place-items: center; }
            .ovdk-chip > button svg { width: 14px; height: 14px; }
            .ovdk-files { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; max-width: 100%; }
            .ovdk-pic img { display: block; max-width: min(240px, 100%); height: auto; max-height: 240px; border-radius: 12px; object-fit: cover; }
            .ovdk-vid { display: block; width: min(280px, 100%); max-height: 220px; border-radius: 12px; background: #000; }
            .ovdk-aud { width: min(280px, 100%); }
            .ovdk-fileref { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; min-height: 36px; padding: 0 10px; border-radius: 10px; background: var(--bg-card, rgba(255,255,255,.05)); color: inherit; text-decoration: none; font-size: 13px; }
            .ovdk-fileref .ovdk-fileref-n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ovdk-fileref small { color: var(--text-muted, #93a0b4); }
            .ovdk-fileref svg { width: 16px; height: 16px; flex: none; }
            .ovdk-go { width: 44px; height: 44px; flex: none; border: 0; border-radius: 12px; cursor: pointer; display: grid; place-items: center;
                color: var(--on-accent-strong, var(--on-accent, #fff)); background: var(--accent-strong, var(--accent, #3472d8)); }
            .ovdk-go:disabled { opacity: .55; cursor: default; }
            /* 4.220.0: a message's actions at its corner (openvibe.design rule 138; the owner, 11-12, on chat's Edit: "hidden
               until you tap"): on hover or focus on a computer, a tap on a phone; never under the words. "edited" is one
               quiet word in the bubble. Editing happens in the box, under a slim bar that says so. */
            .ovdk-msg.has-acts { position: relative; }
            /* Beside the bubble, on its empty side (a bubble is at most 84% wide), so the cluster never covers anyone's words. */
            .ovdk-acts { position: absolute; top: 50%; transform: translateY(-50%); right: calc(100% + 6px); z-index: 2; display: none; align-items: center; gap: 2px; padding: 2px; border-radius: 10px;
                border: 1px solid var(--border, rgba(255,255,255,.12)); background: var(--bg-secondary, #1b1d26); box-shadow: 0 6px 18px rgba(0,0,0,.28); }
            .ovdk-msg:not(.is-mine) > .ovdk-acts { right: auto; left: calc(100% + 6px); }
            .ovdk-msg.has-acts:hover > .ovdk-acts, .ovdk-msg.has-acts:focus-within > .ovdk-acts, .ovdk-msg.is-acting > .ovdk-acts { display: inline-flex; }
            .ovdk-act { width: 30px; height: 28px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--text-secondary, #b6b6c0); cursor: pointer; }
            .ovdk-act:hover, .ovdk-act:focus-visible { color: var(--text-primary, #ececf1); background: color-mix(in srgb, var(--accent, #3b82f6) 22%, transparent); outline: none; }
            .ovdk-act .ovdk-i svg { width: 16px; height: 16px; }
            @media (hover: none) {
                .ovdk-msg.has-acts:hover:not(.is-acting):not(:focus-within) > .ovdk-acts { display: none; }
                .ovdk-act { width: 44px; height: 40px; border-radius: 9px; }
                .ovdk-act .ovdk-i svg { width: 18px; height: 18px; }
            }
            .ovdk-msg.is-acting .ovdk-text, .ovdk-msg.is-editing .ovdk-text { box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent, #3b82f6) 55%, transparent); }
            .ovdk-edited { margin-left: 6px; font-size: .74em; color: var(--text-muted, #8b8b96); white-space: nowrap; }
            .ovdk-msg.is-mine .ovdk-edited { color: inherit; opacity: .72; }
            .ovdk-edit-bar { flex: none; display: flex; align-items: center; gap: 8px; margin: 8px 10px -2px; padding: 2px 2px 2px 12px; min-height: 36px; border-radius: 12px;
                font-size: 12.5px; font-weight: 650; color: var(--accent-light, var(--accent, #60a5fa)); background: color-mix(in srgb, var(--accent, #3b82f6) 10%, transparent); }
            .ovdk-edit-bar[hidden] { display: none; }
            .ovdk-edit-bar span:not(.ovdk-i) { flex: 1; min-width: 0; }
            .ovdk-edit-bar .ovdk-i svg { width: 15px; height: 15px; }
            .ovdk-edit-bar button { width: 36px; height: 32px; display: grid; place-items: center; border: 0; border-radius: 9px; background: transparent; color: var(--text-secondary, #b6b6c0); cursor: pointer; }
            .ovdk-edit-bar button:hover { color: var(--text-primary, #ececf1); background: color-mix(in srgb, var(--text-primary, #ececf1) 8%, transparent); }
            .ovdk-send.is-editing { border-color: var(--accent, #3b82f6); }
            /* One send for every box in the Dock: round, as Vibe's. */
            .ovdk-send { border-radius: 22px; padding: 4px 4px 4px 14px; }
            .ovdk-send .ovdk-go { width: 40px; height: 40px; border-radius: 50%; }
            .ovdk-err { margin: 0 14px; font-size: 12.5px; color: color-mix(in srgb, var(--live-red, #e5484d) 60%, var(--text-primary, #ececf1)); }
            .ovdk-err[hidden] { display: none; }
            .ovdk-none b { display: block; margin-bottom: 4px; font-size: 15px; color: var(--text-primary, #ececf1); }
            @media (max-width: 640px) { .ovdk-foot a, .ovdk-foot button { min-height: 44px; } }
        `;
        document.head.appendChild(st);
    }

    /** The panels' body, once: the menu (search.js) places it with mountInto. */
    function build() {
        styles();
        bodyEl = document.createElement('div');
        bodyEl.className = 'ovdk-body';
        bodyEl.innerHTML = TABS.map(([id, label]) => `<div class="ovdk-panel" role="region" aria-label="${label}" id="ovdk-panel-${id}" data-panel="${id}" hidden></div>`).join('');
    }


    // ── Tabs ─────────────────────────────────────────────────
    function setTab(id, remember) {
        if (id === 'agents') id = 'agent';
        if (inline && tab !== id) disposePanel();
        tab = TABS.some(([t]) => t === id) ? id : 'vibe';
        if (tab !== 'chats') clearTimeout(chats.timer);
        if (tab !== 'vibe' && vibe.api) vibe.api.pause();
        bodyEl.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== tab; });
        if (remember && state().tab !== tab) save({ tab });
        fill(tab);
        if (inline && tab === 'chats') readUnread();
    }
    const panelActive = (id) => tab === id && !!inline;
    function disposePanel() {
        panelEpoch++;
        clearTimeout(chats.timer); clearTimeout(chats.unreadT);
        if (vibe.api) { vibe.api.pause(); vibe.api = null; }
        for (const k of Object.keys(mounts)) { if (mounts[k] && mounts[k].destroy) mounts[k].destroy(); delete mounts[k]; }
        chats.panel = null; chats.open = null; vibe.panel = null;
        if (bodyEl) bodyEl.querySelectorAll('[data-panel]').forEach((p) => { p.replaceChildren(); p.hidden = true; });
    }

    async function fill(id) {
        const epoch = panelEpoch;
        const panel = bodyEl.querySelector(`[data-panel="${id}"]`);
        if (id === 'vibe') {
            vibe.panel = panel;
            if (vibe.api) return vibe.api.refresh();
            panel.innerHTML = '<div class="ovdk-wait"><span></span></div>';
            const ok = await load('dock-vibe.js', () => !!(root.OpenVibeDockVibe && root.OpenVibeDockVibe.mount));
            if (epoch !== panelEpoch || !panelActive(id)) return;
            if (!ok) { panel.innerHTML = '<div class="ovdk-none">Vibe did not load. Check your connection, then open it again.</div>'; return; }
            vibe.api = root.OpenVibeDockVibe.mount(panel, { chatCall, active: () => panelActive('vibe'), state, save, wantList: () => { const v = vibeOnList; vibeOnList = false; return v; }, styles: () => document.getElementById('ovdk-styles'), icons: { vibe: G.vibe, send: G.send, clock: G.clock, bell: G.bell }, refresh: () => read() });
            return;
        }
        if (id === 'chats') { chats.panel = panel; mounts.chats = mounts.chats || { refresh: null }; if (chats.draft) return chatList(); return state().chat && chats.open !== state().chat ? openChat(state().chat, false) : chats.open ? openChat(chats.open, false) : chatList(); }
        // The Agent panel reads the step.
        if (mounts[id]) { if (mounts[id].refresh) mounts[id].refresh(); if (mounts[id + 'Timeline']) mounts[id + 'Timeline'].refresh(); return; }
        mounts[id] = { refresh: null };
        panel.innerHTML = '<div class="ovdk-wait"><span></span></div>';
        if (id === 'agent' && (part === 'top' || part === 'live')) {
            // 4.225.0: only the top is lent (the menu's Vibe draws the runs and the Action Center's work itself). 4.240.0,
            // part 'live': Now (timers, what is on) and the live view of an agent at work, without the Actor card (the
            // menu's Vibe draws your agent itself).
            panel.innerHTML = part === 'live' ? '<div class="ovdk-timeline"></div><div class="ovdk-agent"></div>' : '<div class="ovdk-actor"></div><div class="ovdk-timeline"></div><div class="ovdk-agent"></div>';
            agentTop(id, panel, epoch);
            mounts[id] = { refresh() { ['Timeline', 'Actor', 'View'].forEach((k) => { const m = mounts[id + k]; if (m && m.refresh) m.refresh(); }); } };
            return;
        }
        if (id === 'code') {
            const ok = await load('dock-code.js', () => !!(root.OpenVibeDockCode && root.OpenVibeDockCode.mount));
            if (epoch !== panelEpoch || !panelActive(id)) { delete mounts[id]; return; }
            if (!ok) return failed(panel, id);
            mounts[id] = root.OpenVibeDockCode.mount(panel, { token: o.token, frameBase: frameBase(), active: () => panelActive('code') });
            return;
        }
        if (id === 'agent') {
            const ok = await load('dock-runs.js', () => !!(root.OpenVibeDockRuns && root.OpenVibeDockRuns.mount));
            if (epoch !== panelEpoch || !panelActive(id)) { delete mounts[id]; return; }
            if (!ok) return failed(panel, id);
            // K-D3: the person's own agent stream above the list; it hides itself when there is none.
            panel.innerHTML = '<div class="ovdk-actor"></div><div class="ovdk-timeline"></div><div class="ovdk-agent"></div><div class="ovdk-scroll"></div><div class="ovdk-runs-foot ovdk-foot"></div>';
            agentTop(id, panel, epoch);
            const m = root.OpenVibeDockRuns.mount(panel.querySelector('.ovdk-scroll'), {
                call, state, save, scopes: o.scopes, active: () => panelActive('agent'), actorBase: actorBase(), loadMarks: () => load('ai-marks-client.js', () => !!root.OpenVibeAIMarks),
                styles: () => document.getElementById('ovdk-styles'),
                foot: panel.querySelector('.ovdk-runs-foot'),
                onCounts: (c) => { doc = { ...(doc || {}), state: state(), counts: { ...counts(), running: c.running || 0, waiting: c.waiting || 0 } }; notify(); },
            });
            mounts[id] = m;
            return;
        }
        delete mounts[id];
    }
    /** The top of the Agents panel: Now and the one timeline (design 2026-11-07, first, so on a phone Now and Needs you
     * are on screen before anything else), your Actor (Actor v3 A3; nothing for a person without one) and your own
     * agent's live view (K-D3; it hides itself when there is none). Each loads on its own. */
    function agentTop(id, panel, epoch) {
        load('dock-timeline.js', () => !!(root.OpenVibeDockTimeline && root.OpenVibeDockTimeline.mount)).then((on) => {
            if (on && epoch === panelEpoch && !mounts[id + 'Timeline'] && panel.isConnected && panelActive(id)) mounts[id + 'Timeline'] = root.OpenVibeDockTimeline.mount(panel.querySelector('.ovdk-timeline'), { quiet: part === 'live', token: o.token, base: directBase(o.actorBase), frameBase: frameBase(), active: () => panelActive('agent'), focus: () => o.task || null });
        });
        if (panel.querySelector('.ovdk-actor')) load('dock-actor.js', () => !!(root.OpenVibeDockActor && root.OpenVibeDockActor.mount)).then((on) => {
            if (on && epoch === panelEpoch && !mounts[id + 'Actor'] && panel.isConnected && panelActive(id)) mounts[id + 'Actor'] = root.OpenVibeDockActor.mount(panel.querySelector('.ovdk-actor'), { token: o.token, base: directBase(o.actorBase), frameBase: frameBase(), networkBase: o.apiBase || 'https://openvibe.network', active: () => panelActive('agent') });
        });
        load('dock-agent.js', () => !!(root.OpenVibeDockAgent && root.OpenVibeDockAgent.mount)).then((on) => {
            if (on && epoch === panelEpoch && !mounts[id + 'View'] && panel.isConnected && panelActive(id)) mounts[id + 'View'] = root.OpenVibeDockAgent.mount(panel.querySelector('.ovdk-agent'), { token: o.token, base: directBase(o.agentBase), frameBase: frameBase(), active: () => panelActive('agent') });
        });
    }
    function failed(panel, id) {
        mounts[id] = null;
        panel.innerHTML = `<div class="ovdk-none">That part did not load. Check your connection, then open it again.</div>`;
    }

    // ── Chats (Dock plan K-D2) ───────────────────────────────
    // The person's conversations and DMs, from OpenVibe.Chat's own API with their Network token (Chat checks they are
    // in each one). Everything people wrote is set as text, never markup; only https pictures are shown. A thread polls
    // for new messages every 5 s while it is open in the Dock, and is marked read as it is shown.
    /** The last Global post you have seen (this device): read with a number, written with one. */
    function globalSeen(id) {
        try {
            if (id != null) { const was = Number(localStorage.getItem('ovdk-global-seen')) || 0; if (Number(id) > was) localStorage.setItem('ovdk-global-seen', String(id)); return Number(id); }
            return Number(localStorage.getItem('ovdk-global-seen')) || 0;
        } catch { return 0; }
    }
    const chats = { panel: null, list: null, open: null, msgs: [], last: 0, timer: 0, edits: null, unread: 0, unreadT: 0, busy: false, draft: null, vibeSummary: null, filter: '' };
    const chatBase = () => String(o.chatBase || 'https://openvibe.chat').replace(/\/+$/, '');
    const me = () => String(o.me || '');
    const scopes = () => Array.isArray(o.scopes) ? o.scopes : null;
    const canWriteChat = () => !scopes() || scopes().includes('chat.write');
    const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    // §Z.3: a person's subject (usr_…), the only key a name effect hangs on. Never invented: what the data carries is what is used.
    const SUBJECT_RE = /^usr_[0-9A-HJKMNP-TV-Z]{26}$/;
    const subjectOf = (data) => {
        if (!data || typeof data !== 'object') return null;
        for (const key of ['subject', 'subject_id', 'user_subject', 'author_subject', 'owner_subject', 'sender_subject', 'sender_subject_id']) {
            const v = data[key];
            if (typeof v === 'string' && SUBJECT_RE.test(v)) return v;
            if (v && typeof v === 'object' && typeof v.id === 'string' && SUBJECT_RE.test(v.id)) return v.id;
        }
        return null;
    };
    // The attribute a name wears, when the data carries a subject. Never invented.
    /** A person's name for a list row: one line, so a hat or a badge (items.js puts them before the name) sits beside it. */
    const named = (text, data) => { const line = h('span', 'ovdk-row-n'); line.append(setSubject(h('b', '', String(text || '')), data)); return line; };
    const setSubject = (node, data) => { const s = subjectOf(data); if (s && node && node.setAttribute) node.setAttribute('data-ov-subject', s); return node; };
    // Every name under the scope wears its effect, hat and badge (items.js; items.css). Never throws: a name stays plain.
    const wearNames = (scope) => { try { const OV = root.OV || (root.window && root.window.OV); if (OV && typeof OV.names === 'function') OV.names(scope); } catch { /* names stay plain */ } };
    const icon = (path) => { const s = h('span', 'ovdk-i'); s.innerHTML = svg(path); return s; };
    const toChat = (href) => { const a = h('a', 'ovdk-ib ovdk-away'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.title = 'Open in Chat'; a.setAttribute('aria-label', 'Open in Chat'); a.setAttribute('data-ov-tip', 'Open in Chat'); a.innerHTML = svg('<path d="M13.5 5.5h5v5M18.5 5.5l-7.5 7.5M17 13.5v4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 17.5v-9A1.5 1.5 0 0 1 6.5 7h4"/>'); return a; };
    async function chatCall(path, init = {}, renewed = false) {
        const t = await tokenOf();
        const headers = { accept: 'application/json', ...(init.body ? { 'content-type': init.type || 'application/json' } : {}), ...(t ? { authorization: `Bearer ${t}` } : {}) };
        const { type: _type, ...rest } = init;
        return fetch(chatBase() + path, { ...rest, headers, credentials: 'omit' }).then(async (r) => {
            // 4.260.0: a refused token is renewed once and asked again (the owner, 11-15: "All my chat messages
            // disappeared": the token ran out during a Network deploy and the tab said "Sign in to Chat").
            if (r.status === 401 && !renewed && t && typeof o.renew === 'function') {
                const fresh = await Promise.resolve(o.renew()).catch(() => null);
                if (fresh && fresh !== t) return chatCall(path, init, true);
            }
            const b = await r.json().catch(() => ({}));
            if (!r.ok) { const e = new Error(b.error || `HTTP ${r.status}`); e.status = r.status; e.code = b.code || null; throw e; }
            return b;
        });
    }
    function readUnread() {
        clearTimeout(chats.unreadT);
        chatCall('/api/dm/unread').then((b) => { chats.unread = Number(b && b.unread) || 0; }).catch(() => { /* Chat away: no count */ });
        if (panelActive('chats')) chats.unreadT = setTimeout(readUnread, 30000);
    }
    const when = (iso) => {
        const t = Date.parse(iso || ''); if (!Number.isFinite(t)) return '';
        const m = Math.max(0, Math.round((Date.now() - t) / 60000));
        return m < 1 ? 'now' : m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h` : `${Math.floor(m / 1440)} d`;
    };
    // "answered 4 min ago", and "answered just now" when it was this minute.
    const answered = (iso) => { const w = when(iso); return !w ? '' : w === 'now' ? 'answered just now' : `answered ${w} ago`; };
    function avatar(p, group) {
        const a = h('span', 'ovdk-av');
        const url = p && /^https:\/\//.test(String(p.avatar_url || '')) ? p.avatar_url : '';
        const first = () => String((p && (p.display_name || p.username)) || '?').trim().charAt(0).toUpperCase() || '?';
        // A picture that does not load (a moved or deleted file) shows the initial, never an empty circle.
        if (url && !group) { const img = h('img'); img.src = url; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.onerror = () => { img.remove(); a.textContent = first(); a.classList.add('is-initial'); }; a.append(img); }
        else a.textContent = group ? '#' : first();
        if (!url || group) { let hue = 0; for (const c of String((p && (p.username || p.display_name)) || '')) hue = (hue * 31 + c.charCodeAt(0)) % 360; a.classList.add('is-initial'); a.style.setProperty('--ovdk-hue', String(hue)); }
        return a;
    }
    function groupAvatar(c) {
        const people = others(c).slice(0, 3);
        if (!people.length) return avatar({}, false);
        const stack = h('span', 'ovdk-av ovdk-av-group');
        people.forEach((p) => stack.append(avatar(p, false)));
        return stack;
    }
    const others = (c) => (c.participants || []).filter((p) => p.username !== me());
    const titleOf = (c) => c.name || others(c).map((p) => p.display_name || p.username).join(', ') || 'Just you';
    // §Z.3: the conversation's title with each person's name in a span of its own, so every name wears its effect.
    const titleInto = (el, c) => {
        if (!c) { el.textContent = 'Conversation'; return el; }
        if (c.name) { el.textContent = c.name; return el; }
        const people = others(c);
        if (!people.length) { el.textContent = 'Just you'; return el; }
        el.textContent = '';
        people.forEach((p, i) => {
            if (i) el.appendChild(document.createTextNode(', '));
            const s = setSubject(h('span', ''), p); s.textContent = p.display_name || p.username || '';
            el.appendChild(s);
        });
        return el;
    };
    const titleEl = (c) => titleInto(h('b', ''), c);
    async function chatList() {
        clearTimeout(chats.timer);
        if (chats.edits) { chats.edits.stop(); chats.edits = null; }
        chats.open = null;
        const panel = chats.panel; if (!panel) return;
        if (!chats.list) { panel.innerHTML = '<div class="ovdk-wait"><span></span></div>'; }
        const sharing = chats.draft && canWriteChat() ? load('dock-share.js', () => !!(root.OpenVibeDockShare && root.OpenVibeDockShare.bar)) : null;
        try {
            const seen = globalSeen();
            const [dm, ai, people, srv, glob] = await Promise.all([chatCall('/api/dm/conversations'), Promise.resolve(null), friendsCall('').catch(() => chatCall('/api/dm/contacts').catch(() => null)), chatCall('/api/chat/servers?limit=30').catch(() => null),
                seen ? chatCall(`/api/chat/global/history?after_id=${seen}&limit=50`).catch(() => null) : Promise.resolve(null)]);
            chats.globalNew = glob && Array.isArray(glob.messages) ? glob.messages.filter((m) => m && !m.is_deleted && m.message && Number(m.id) > seen).length : 0;
            chats.servers = srv && Array.isArray(srv.mine) ? srv.mine.slice(0, 12) : [];
            chats.publicServers = srv && Array.isArray(srv.public) ? srv.public.slice(0, 30) : [];
            chats.people = people && Array.isArray(people.mutual) ? { friends: people.mutual, requests: people.requests || [], asked: people.asked || [], network: true } : people && Array.isArray(people.friends) ? people : null;
            chats.list = dm.conversations || [];
            chats.vibeSummary = ai && ai.count ? { kind: 'vibe', count: ai.count, latest: ai.conversations && ai.conversations[0], last_message_at: ai.conversations && ai.conversations[0] && ai.conversations[0].last_message_at } : null;
        } catch (e) { if (panel !== chats.panel || !panelActive('chats')) return; panel.textContent = ''; panel.append(h('div', 'ovdk-none', e.status === 401 ? 'Sign in to Chat to see your conversations.' : 'Your chats did not load. Check your connection, then open them again.')); chatFoot(panel); return; }
        if (sharing) await sharing;
        if (panel !== chats.panel || !panelActive('chats') || chats.open) return;
        panel.textContent = '';
        if (chats.draft && canWriteChat() && root.OpenVibeDockShare) panel.append(root.OpenVibeDockShare.bar({ draft: chats.draft, h, chatCall, host: inline, cancel: () => { chats.draft = null; chatList(); }, open: (id) => { chats.list = null; return openChat(String(id), true); } }));
        // 4.263.0: no row of its own for "Open in Chat" (it held one icon over the segments); Messages ends with the way there.
        // 4.263.0 (the owner, 11-15: "segments Messages · Friends · Global · Servers; Friends Discord-style … no add field
        // over the DMs; no Vibe row"): one segment at a time, the last one remembered; each says what waits in it.
        const SEGS = [['messages', 'Messages', G.chat], ['friends', 'Friends', G.people], ['global', 'Global', G.globe], ['servers', 'Servers', G.server]];
        let seg = chats.seg || (() => { try { return localStorage.getItem('ovdk-chat-seg') || 'messages'; } catch { return 'messages'; } })();
        if (!SEGS.some(([id]) => id === seg)) seg = 'messages';
        const waiting = {
            messages: chats.list.reduce((n, c) => n + (Number(c.unread_count) || 0), 0),
            friends: chats.people ? (chats.people.requests || []).filter((p) => !ignoredRequests().has(personKey(p))).length : 0,
            servers: (chats.servers || []).reduce((n, sv) => n + (sv.muted ? 0 : Number(sv.unread) || 0), 0),
            global: chats.globalNew || 0,
        };
        const segBar = h('div', 'ovdk-segs'); segBar.setAttribute('role', 'tablist'); segBar.setAttribute('aria-label', 'Chat');
        const scroll = h('div', 'ovdk-scroll');
        const messagesPane = () => {
            const box = h('div', 'ovdk-pane');
            if (!chats.list.length) {
                const none = h('div', 'ovdk-none');
                none.append(h('b', '', 'No conversations yet'), document.createTextNode('A message to someone on OpenVibe starts one, and it shows here on every site.'));
                const go = h('button', 'ovdk-none-go', 'Find your friends'); go.type = 'button'; go.addEventListener('click', () => pick('friends'));
                none.append(go); box.append(none); return box;
            }
            const scroll = box;
                const ul = h('ul', 'ovdk-chats');
                chats.list.filter((c) => !chats.filter || titleOf(c).toLowerCase().includes(chats.filter)).sort((a, b) => String(b.last_message_at || b.updated_at || '').localeCompare(String(a.last_message_at || a.updated_at || ''))).forEach((c) => {
                    const li = h('li'), b = h('button', 'ovdk-chat');
                    b.type = 'button';
                    const unread = Number(c.unread_count) || 0;
                    const mine = (c.participants || []).some((p) => p.id === c.last_sender_id && p.username === me());
                    const body = h('span', 'ovdk-chat-b');
                    body.append(titleEl(c), h('span', 'ovdk-chat-p', c.last_message ? `${mine ? 'You: ' : ''}${String(c.last_message).replace(/\s+/g, ' ').slice(0, 140)}` : 'No messages yet'));
                    const meta = h('span', 'ovdk-chat-m');
                    meta.append(h('time', '', when(c.last_message_at || c.updated_at)));
                    if (unread) meta.append(h('b', 'ovdk-unread', unread > 99 ? '99+' : String(unread)));
                    b.append(c.is_group ? groupAvatar(c) : avatar(others(c)[0] || {}, false), body, meta);
                    b.setAttribute('aria-label', `${titleOf(c)}${unread ? `, ${unread} unread` : ''}`);
                    if (unread) li.className = 'is-unread';
                    b.addEventListener('click', () => openChat(String(c.id), true));
                    li.append(b); ul.append(li);
                });
            scroll.append(ul);
            const all = h('a', 'ovdk-gl-open'); all.href = 'https://openvibe.chat/messages'; all.append(icon(G.chat), h('span', '', 'All your messages on Chat'), icon(G.open || G.chat));
            box.append(all);
            return box;
        };
        const paint = () => {
            segBar.querySelectorAll('[data-seg]').forEach((b) => { const on = b.dataset.seg === seg; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
            scroll.textContent = ''; scroll.dataset.seg = seg; scroll.scrollTop = 0;
            scroll.append(seg === 'friends' ? friendsPane(chats.people, () => { chats.list = chats.list || []; paint(); })
                : seg === 'global' ? globalPane() : seg === 'servers' ? serversPane(chats.servers || [], chats.publicServers || [], () => paint()) : messagesPane());
            wearNames(scroll);
        };
        const pick = (id) => { seg = id; chats.seg = id; try { localStorage.setItem('ovdk-chat-seg', id); } catch { /* private mode */ } paint(); };
        for (const [id, label, glyph] of SEGS) {
            const b = h('button', 'ovdk-seg'); b.type = 'button'; b.dataset.seg = id; b.setAttribute('role', 'tab');
            b.append(icon(glyph), h('span', 'ovdk-seg-l', label));
            const n = waiting[id] || 0;
            // Red asks for you (a message to you, a friend request, a server you have not muted); Global's new posts are a
            // quiet blue, like the feed's: there to see, never urgent (the owner, 11-16).
            if (n) { b.append(h('b', `ovdk-seg-n${id === 'global' ? ' is-quiet' : ''}`, n > 99 ? '99+' : n >= 50 && id === 'global' ? '50+' : String(n))); b.setAttribute('aria-label', `${label}, ${n} ${id === 'global' ? 'new' : 'waiting'}`); }
            b.addEventListener('click', () => pick(id));
            segBar.append(b);
        }
        segBar.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            const i = SEGS.findIndex(([id]) => id === seg), next = SEGS[(i + (e.key === 'ArrowRight' ? 1 : SEGS.length - 1)) % SEGS.length][0];
            e.preventDefault(); pick(next); const nb = segBar.querySelector(`[data-seg="${next}"]`); if (nb) nb.focus();
        });
        panel.append(segBar, scroll);
        paint();
        // The segments' ink (4.284.0, ov-tabs.js): it glides to the chosen one, from where it was when the panel is drawn again.
        load('ov-tabs.js', () => !!root.OVTabs).then((ok) => { if (ok && segBar.isConnected) root.OVTabs.ink(segBar, { key: 'ovdk-chat' }); });
    }
    /**
     * Your friends, on top of your conversations (4.249.0; the owner, 11-14: "our entire OpenVibe.chat product should be a
     * part of the chat tab in the menu … add friends on there … that's where your friends should be"): a row of their
     * faces (a press opens your conversation with them, or starts one), the requests waiting for you with Accept, and
     * Add a friend by username. Chat's /api/dm/contacts.
     */
    /** Friends are the account's (Network, 4.249.0): /api/v1/me/friends with the person's token. */
    async function friendsCall(path, init = {}) {
        const t = await tokenOf();
        if (!t) throw new Error('signed out');
        const r = await fetch(`https://openvibe.network/api/v1/me/friends${path}`, { ...init, credentials: 'omit', headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${t}` } });
        const b = await r.json().catch(() => ({}));
        if (!r.ok) { const e = new Error(b.detail || b.error || `HTTP ${r.status}`); e.status = r.status; throw e; }
        return b;
    }
    // ── 4.263.0: the Chat tab's Friends, Global and Servers (the owner, 11-15) ──
    const CHAT_SITE = 'https://openvibe.chat';
    const personKey = (p) => String((p && (p.subject || p.username)) || '');
    /** Requests you ignored stay out of the list on this device (the Network keeps no request inbox to decline). */
    function ignoredRequests() { try { return new Set(JSON.parse(localStorage.getItem('ovdk-fr-ignored') || '[]')); } catch { return new Set(); } }
    function ignoreRequest(p) { try { const s0 = ignoredRequests(); s0.add(personKey(p)); localStorage.setItem('ovdk-fr-ignored', JSON.stringify([...s0].slice(-200))); } catch { /* private mode */ } }
    /** Your conversation with a friend, or a new one. */
    async function talkTo(p, people) {
        const one = (chats.list || []).find((c) => !c.is_group && others(c).some((x) => (p.id != null && Number(x.id) === Number(p.id)) || (p.username && String(x.username || '').toLowerCase() === String(p.username).toLowerCase())));
        if (one) { openChat(String(one.id), true); return; }
        try { const out = await chatCall('/api/dm/conversations', { method: 'POST', body: JSON.stringify(p.id != null && !people.network ? { user_ids: [p.id] } : { usernames: [p.username] }) }); const id = out && (out.conversation ? out.conversation.id : out.id); if (id != null) openChat(String(id), true); }
        catch { /* the list stays */ }
    }
    /** Friends, Discord-style: add someone at the top, then the requests waiting for you (Accept or Ignore), the ones
     *  online now (where), the rest, and the ones you asked. A press on a friend opens your conversation. */
    function friendsPane(people, repaint) {
        const box = h('div', 'ovdk-pane ovdk-fr');
        if (!people) { const none = h('div', 'ovdk-none'); none.append(h('b', '', 'Your friends show here'), document.createTextNode('Sign in to OpenVibe to see them and add someone.')); box.append(none); return box; }
        const add = h('form', 'ovdk-addfriend');
        const input = h('input'); input.type = 'text'; input.name = 'username'; input.placeholder = 'Add a friend by username'; input.autocomplete = 'off'; input.spellcheck = false; input.setAttribute('aria-label', 'Add a friend by username');
        // 4.275.0 (the owner's phone, 11-15: "auto fill", "icon"): a person-plus button, and names offered as you type.
        const go = h('button', 'ovdk-addfriend-go'); go.type = 'submit'; go.append(icon(G.personAdd)); go.setAttribute('aria-label', 'Add friend'); go.title = 'Add friend';
        const note = h('p', 'ovdk-addfriend-note'); note.hidden = true; note.setAttribute('role', 'status');
        add.append(input, go);
        const sug = h('ul', 'ovdk-suggest'); sug.id = `ovdk-sug-${Math.random().toString(36).slice(2, 8)}`; sug.setAttribute('role', 'listbox'); sug.setAttribute('aria-label', 'People'); sug.hidden = true;
        input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-controls', sug.id); input.setAttribute('aria-expanded', 'false');
        const known = new Set([...(people.friends || []), ...(people.asked || [])].map((x) => String(x.username || '').toLowerCase()).filter(Boolean));
        let sugTimer = 0, sugSeq = 0, active = -1;
        const closeSug = () => { sug.hidden = true; sug.textContent = ''; active = -1; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); };
        const pickSug = (u) => { input.value = u; closeSug(); if (typeof add.requestSubmit === 'function') add.requestSubmit(); else add.dispatchEvent(new Event('submit', { cancelable: true })); };
        const mark = (i) => {
            const opts = [...sug.children]; if (!opts.length) return;
            active = (i + opts.length) % opts.length;
            opts.forEach((o, k) => o.setAttribute('aria-selected', String(k === active)));
            input.setAttribute('aria-activedescendant', opts[active].id);
        };
        input.addEventListener('input', () => {
            clearTimeout(sugTimer);
            const q = input.value.trim().replace(/^@/, '');
            if (q.length < 2) { closeSug(); return; }
            sugTimer = setTimeout(async () => {
                const seq = ++sugSeq;
                let users = [];
                try { const d = await chatCall(`/api/dm/users/search?q=${encodeURIComponent(q.slice(0, 40))}`); users = d && Array.isArray(d.users) ? d.users : []; } catch { users = []; }
                if (seq !== sugSeq) return;
                sug.textContent = ''; active = -1;
                users.filter((u) => u && u.username && !known.has(String(u.username).toLowerCase())).slice(0, 6).forEach((u, k) => {
                    const li = h('li', 'ovdk-sug'); li.id = `${sug.id}-${k}`; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
                    const body = h('span', 'ovdk-row-b'); body.append(named(String(u.display_name || u.username).slice(0, 60), u), h('span', 'ovdk-row-p', `@${u.username}`));
                    const plus = icon(G.personAdd); plus.classList.add('ovdk-row-go');
                    li.append(avatar(u, false), body, plus);
                    li.addEventListener('pointerdown', (e) => e.preventDefault());   // the field keeps the focus
                    li.addEventListener('click', () => pickSug(String(u.username)));
                    sug.append(li);
                });
                sug.hidden = !sug.children.length; input.setAttribute('aria-expanded', String(!sug.hidden));
            }, 180);
        });
        input.addEventListener('keydown', (e) => {
            if (sug.hidden) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); mark(active + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); mark(active - 1); }
            else if (e.key === 'Escape') { e.preventDefault(); closeSug(); }
            else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); const o = sug.children[active]; if (o) o.click(); }
        });
        input.addEventListener('blur', () => setTimeout(closeSug, 150));
        add.addEventListener('submit', async (e) => {
            e.preventDefault();
            const u = input.value.trim().replace(/^@/, ''); if (!u) return;
            go.disabled = true; note.hidden = false; note.textContent = 'Sending…';
            try {
                let mutual = false;
                if (people.network) { const out = await friendsCall(`/${encodeURIComponent(u)}`, { method: 'PUT', body: '{}' }); mutual = !!(out && out.friend && out.friend.state === 'friends'); }
                else { const out = await chatCall('/api/dm/contacts', { method: 'POST', body: JSON.stringify({ username: u }) }); mutual = !!(out && out.status === 'friend'); }
                note.textContent = mutual ? `You and @${u} are friends.` : `Asked @${u} to be your friend.`; input.value = ''; closeSug();
                known.add(u.toLowerCase());
            }
            catch (err) { note.textContent = (err && err.message) || 'That did not send.'; }
            finally { go.disabled = false; }
        });
        const addBox = h('div', 'ovdk-fr-add'); addBox.append(add, sug, note); box.append(addBox);
        const section = (title, list, row) => { if (!list.length) return; box.append(h('p', 'ovdk-sec', `${title} · ${list.length}`)); const ul = h('ul', 'ovdk-rows'); list.forEach((p, i) => { const li = row(p); li.style.setProperty('--i', String(Math.min(i, 12))); ul.append(li); }); box.append(ul); };
        const face = (p) => { const f = avatar(p, false); if (p.online) { f.classList.add('is-online'); f.title = p.site ? `Online on ${p.site}` : 'Online'; } return f; };
        const nameOf = (p) => String(p.display_name || p.username || 'Someone').slice(0, 60);
        const ign = ignoredRequests();
        section('Pending', (people.requests || []).filter((p) => !ign.has(personKey(p))), (p) => {
            const li = h('li', 'ovdk-row is-request');
            const body = h('span', 'ovdk-row-b'); body.append(named(nameOf(p), p), h('span', 'ovdk-row-p', 'Wants to be your friend'));
            const acts = h('span', 'ovdk-row-acts');
            const ok = h('button', 'ovdk-request-ok', 'Accept'); ok.type = 'button';
            const no = h('button', 'ovdk-request-no', 'Ignore'); no.type = 'button';
            ok.addEventListener('click', async () => {
                ok.disabled = true; no.disabled = true;
                try {
                    if (people.network) await friendsCall(`/${encodeURIComponent(p.subject || p.username)}/accept`, { method: 'POST', body: '{}' });
                    else await chatCall('/api/dm/contacts', { method: 'POST', body: JSON.stringify({ username: p.username }) });
                    people.requests = (people.requests || []).filter((x) => personKey(x) !== personKey(p));
                    people.friends = [{ ...p, online: !!p.online }, ...(people.friends || [])];
                    repaint();
                } catch { ok.disabled = false; no.disabled = false; ok.textContent = 'Try again'; }
            });
            no.addEventListener('click', () => { ignoreRequest(p); repaint(); });
            acts.append(ok, no);
            li.append(face(p), body, acts);
            return li;
        });
        const friend = (p) => {
            const li = h('li'), b = h('button', 'ovdk-row'); b.type = 'button';
            const body = h('span', 'ovdk-row-b'); body.append(named(nameOf(p), p), h('span', 'ovdk-row-p', p.online ? (p.site ? `Online on ${p.site}` : 'Online') : `@${p.username || ''}`));
            const go = icon(G.chat); go.classList.add('ovdk-row-go');
            b.append(face(p), body, go); b.setAttribute('aria-label', `Message ${nameOf(p)}${p.online ? ', online' : ''}`);
            b.addEventListener('click', () => talkTo(p, people));
            li.append(b); return li;
        };
        const all = people.friends || [];
        section('Online', all.filter((p) => p.online), friend);
        section('Offline', all.filter((p) => !p.online), friend);
        section('Asked', people.asked || [], (p) => {
            const li = h('li', 'ovdk-row is-asked');
            const body = h('span', 'ovdk-row-b'); body.append(named(nameOf(p), p), h('span', 'ovdk-row-p', 'Waiting for them to add you back'));
            li.append(face(p), body); return li;
        });
        // 4.275.0 (the owner, 11-15: "improve"): the people you already talk to, each one tap from a friend. 4.288.0 (the
        // owner, 11-16: "how come the suggested friends goes away when you add someone"): always, not only while the list
        // is empty; anyone already a friend, asked or asking you is left out.
        const asking = new Set((people.requests || []).map((x) => String(x.username || '').toLowerCase()));
        const seen = new Set();
        const talk = [];
        for (const c of chats.list || []) {
            if (c.is_group) continue;
            for (const x of others(c)) {
                const k = String(x.username || '').toLowerCase();
                if (!k || seen.has(k) || known.has(k) || asking.has(k)) continue;
                seen.add(k); talk.push(x);
            }
        }
        const empty = !all.length && !(people.requests || []).length && !(people.asked || []).length;
        if (talk.length || empty) {
            if (talk.length) {
                section('People you talk to', talk.slice(0, empty ? 8 : 6), (p) => {
                    const li = h('li', 'ovdk-row is-request is-suggest');
                    const body = h('span', 'ovdk-row-b'); body.append(named(nameOf(p), p), h('span', 'ovdk-row-p', `@${p.username}`));
                    const ask = h('button', 'ovdk-add-q ovdk-ask'); ask.type = 'button'; ask.append(icon(G.personAdd), h('span', '', 'Add')); ask.setAttribute('aria-label', `Add ${nameOf(p)} as a friend`);
                    ask.setAttribute('aria-label', `Add ${nameOf(p)} as a friend`);
                    ask.addEventListener('click', async () => {
                        ask.disabled = true;
                        try {
                            if (people.network) await friendsCall(`/${encodeURIComponent(p.username)}`, { method: 'PUT', body: '{}' });
                            else await chatCall('/api/dm/contacts', { method: 'POST', body: JSON.stringify({ username: p.username }) });
                            people.asked = [...(people.asked || []), p]; repaint();
                        } catch { ask.disabled = false; ask.lastChild.textContent = 'Try again'; }
                    });
                    li.append(face(p), body, ask);
                    return li;
                });
            } else if (empty) {
                const none = h('div', 'ovdk-none ovdk-none-soft'); none.append(icon(G.people), h('b', '', 'No friends yet'), document.createTextNode('Type a name above: people show as you type. When they add you back, you are friends on every OpenVibe site.'));
                box.append(none);
            }
        }
        return box;
    }
    /** Global, built in (4.275.0; the owner's phone, 11-15: "Global chat did not load … improve"): what everyone is saying,
     *  newest last, new lines every few seconds while it is open, and a box to say something (Chat's /api/chat/send, as the
     *  person). It no longer sends people to openvibe.chat to read it; a quiet link still opens the full room there. */
    function globalPane() {
        const box = h('div', 'ovdk-pane ovdk-gl');
        const top = h('div', 'ovdk-gl-top');
        const full = h('a', 'ovdk-gl-full'); full.href = `${CHAT_SITE}/`; full.target = '_blank'; full.rel = 'noopener'; full.append(icon(G.open || G.chat)); full.setAttribute('aria-label', 'Open Global chat on openvibe.chat'); full.title = 'Open on openvibe.chat';
        top.append(icon(G.globe), h('span', 'ovdk-gl-title', 'Everyone on OpenVibe'), full);
        const list = h('ul', 'ovdk-gl-list'); list.setAttribute('aria-label', 'Global chat'); list.setAttribute('aria-live', 'polite');
        const wait = h('div', 'ovdk-wait'); wait.append(h('span'));
        const quiet = h('p', 'ovdk-gl-quiet', 'It is quiet in Global. Say the first thing.'); quiet.hidden = true;
        const say = h('form', 'ovdk-gl-say');
        const field = h('input'); field.type = 'text'; field.maxLength = 500; field.placeholder = 'Say something to everyone'; field.setAttribute('aria-label', 'Message to Global chat'); field.autocomplete = 'off'; field.enterKeyHint = 'send';
        const send = h('button', 'ovdk-gl-send'); send.type = 'submit'; send.append(icon(G.send)); send.setAttribute('aria-label', 'Send');
        const sayNote = h('p', 'ovdk-gl-note'); sayNote.hidden = true; sayNote.setAttribute('role', 'status');
        say.append(field, send);
        box.append(top, wait, list, quiet, say, sayNote);
        let lastId = 0, timer = 0;
        const sc = () => box.closest('.ovdk-scroll');
        const nearEnd = () => { const el = sc(); return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120; };
        const toEnd = () => requestAnimationFrame(() => { const el = sc(); if (el) el.scrollTop = el.scrollHeight; });
        function rowOf(m) {
            // An event (someone went live, a Rundown episode, a run of deploys, a widget) is a card, as on Live (4.284.0,
            // ov-chat-cards.js; the owner: Global "is missing all the styles that exist when you're out").
            const C = root.OVChatCards; const card = C && C.of(m);
            if (card) return C.render(card);
            const li = h('li', 'ovdk-gl-row');
            const who = { username: m.username, display_name: m.display_name, avatar_url: m.avatar_url };
            const head = h('span', 'ovdk-gl-h'); head.append(setSubject(h('b', '', String(m.display_name || m.username || 'Someone').slice(0, 40)), who), h('time', '', when(m.timestamp)));
            const body = h('span', 'ovdk-gl-b'); body.append(head, h('span', 'ovdk-gl-t', String(m.message).replace(/\s+/g, ' ').slice(0, 500)));
            li.append(avatar(who, false), body);
            return li;
        }
        function addRows(rows, { scroll = false } = {}) {
            const keep = nearEnd();
            const fresh = (rows || []).filter((m) => m && !m.is_deleted && m.message && Number(m.id) > lastId)
                .sort((a, b2) => Number(a.id) - Number(b2.id) || String(a.timestamp || '').localeCompare(String(b2.timestamp || '')));
            for (const m of fresh) {
                const C = root.OVChatCards; const card = C && C.of(m);
                if (!(card && C.fold(list.lastElementChild, card))) list.append(card ? C.render(card) : rowOf(m));
                lastId = Math.max(lastId, Number(m.id) || 0);
                globalSeen(lastId);
            }
            while (list.children.length > 120) list.firstChild.remove();
            quiet.hidden = list.children.length > 0;
            if (fresh.length && (scroll || keep)) toEnd();
        }
        function poll() {
            clearTimeout(timer);
            timer = setTimeout(async () => {
                if (!box.isConnected) return;   // the pane was left: stop
                if (document.visibilityState === 'visible' && lastId) {
                    try { const d = await chatCall(`/api/chat/global/history?after_id=${lastId}&limit=50`); addRows(d && d.messages); } catch { /* the next tick tries again */ }
                }
                poll();
            }, 5000);
        }
        // The cards' module loads with the pane (a run of deploys folds into one card).
        const cardsJob = loadCards();
        function load() {
            if (!wait.isConnected) box.insertBefore(wait, list);
            const failed = box.querySelector('.ovdk-gl-fail'); if (failed) failed.remove();
            Promise.all([chatCall('/api/chat/global/history?limit=30'), cardsJob.catch(() => false)]).then(([d]) => {
                wait.remove();
                addRows(d && d.messages, { scroll: true });
                quiet.hidden = list.children.length > 0;
                poll();
            }).catch(() => {
                wait.remove();
                const none = h('div', 'ovdk-none ovdk-gl-fail'); none.append(h('b', '', 'Global chat did not load'), document.createTextNode('Check your connection and try again.'));
                const again = h('button', 'ovdk-none-go', 'Try again'); again.type = 'button'; again.addEventListener('click', load);
                none.append(again); box.insertBefore(none, list);
            });
        }
        say.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = field.value.trim(); if (!text) return;
            send.disabled = true; sayNote.hidden = true;
            try {
                await chatCall('/api/chat/send', { method: 'POST', body: JSON.stringify({ message: text }) });
                field.value = '';
                const d = await chatCall(`/api/chat/global/history?after_id=${lastId}&limit=50`).catch(() => null);
                addRows(d && d.messages, { scroll: true });
            } catch (err) {
                sayNote.hidden = false;
                sayNote.textContent = err && err.status === 401 ? 'Sign in to say something.' : (err && err.message) || 'That did not send.';
            } finally { send.disabled = false; field.focus(); }
        });
        tokenOf().then((t) => { if (!t) { say.hidden = true; sayNote.hidden = false; sayNote.textContent = 'Sign in to OpenVibe to say something.'; } }).catch(() => {});
        load();
        return box;
    }
    /** Servers, built in (4.275.0; the owner's phone, 11-15: "built in", "down"): yours (unread marked), a box to start
     *  one right here, and the public ones below to join with one press. A server opens on openvibe.chat. */
    function serverTile(sv) {
        const slug = String(sv.slug || ''), name = String(sv.name || slug).slice(0, 60);
        let hue = 0; for (let k = 0; k < slug.length; k++) hue = (hue * 31 + slug.charCodeAt(k)) % 360;
        const pic = typeof sv.picture_url === 'string' && /^https:\/\//.test(sv.picture_url) ? sv.picture_url : '';
        const tile = h('span', 'ovdk-rail-t is-server'); tile.style.setProperty('--rh', String(hue));
        if (pic) { const img = h('img'); img.alt = ''; img.loading = 'lazy'; img.src = pic; tile.append(img); } else tile.append(h('b', '', name.charAt(0).toUpperCase()));
        return tile;
    }
    const okSlug = (slug) => /^[a-z0-9][a-z0-9-]{0,63}$/i.test(String(slug || ''));
    function serversPane(servers, publicServers = [], repaint = () => {}) {
        const box = h('div', 'ovdk-pane ovdk-sv');
        const ul = h('ul', 'ovdk-rows');
        servers.forEach((sv, i) => {
            const slug = String(sv.slug || ''); if (!okSlug(slug)) return;
            const name = String(sv.name || slug).slice(0, 60);
            const li = h('li'); li.style.setProperty('--i', String(Math.min(i, 12)));
            const a = h('a', 'ovdk-row'); a.href = `${CHAT_SITE}/s/${encodeURIComponent(slug)}`;
            const n = Number(sv.unread) || 0;
            const body = h('span', 'ovdk-row-b'); body.append(h('b', '', name), h('span', 'ovdk-row-p', n ? `${n > 99 ? '99+' : n} unread` : (sv.member_count || sv.members ? `${sv.member_count || sv.members} members` : 'Your server')));
            a.append(serverTile(sv), body); if (n) { a.append(h('b', 'ovdk-unread', n > 99 ? '99+' : String(n))); a.setAttribute('aria-label', `${name}, ${n} unread`); }
            li.append(a); ul.append(li);
        });
        if (ul.children.length) box.append(h('p', 'ovdk-sec', `Your servers · ${ul.children.length}`), ul);

        // Start one, right here: a name, and it is made (with #general and a voice Lounge) and listed above.
        const start = h('form', 'ovdk-sv-new');
        const name = h('input'); name.type = 'text'; name.maxLength = 60; name.placeholder = ul.children.length ? 'Start another server: name it' : 'Start a server for your people: name it'; name.setAttribute('aria-label', 'Name a new server'); name.autocomplete = 'off';
        const make = h('button', 'ovdk-sv-make'); make.type = 'submit'; make.append(icon(G.plus)); make.setAttribute('aria-label', 'Start the server');
        const startNote = h('p', 'ovdk-addfriend-note'); startNote.hidden = true; startNote.setAttribute('role', 'status');
        start.append(icon(G.server), name, make);
        start.addEventListener('submit', async (e) => {
            e.preventDefault();
            const n = name.value.replace(/\s+/g, ' ').trim(); if (!n) return;
            make.disabled = true; startNote.hidden = false; startNote.textContent = 'Starting it…';
            try {
                const out = await chatCall('/api/chat/servers', { method: 'POST', body: JSON.stringify({ name: n }) });
                const sv = out && out.server;
                if (sv && okSlug(sv.slug)) { servers.unshift({ ...sv, unread: 0 }); chats.servers = servers; repaint(); return; }
                startNote.textContent = 'Started.';
            } catch (err) { startNote.textContent = err && err.status === 401 ? 'Sign in to start a server.' : (err && err.message) || 'That did not work.'; }
            finally { make.disabled = false; }
        });
        // 4.284.0 (the owner, 11-16: "start another server … move that to the corner … float … every server on openvibe.chat
        // … fixed to the bottom"): with servers of your own, starting one is a button in the corner of the foot and the
        // name field rises above it when pressed; with none yet, the field leads the pane (it is what to do first).
        const haveOwn = ul.children.length > 0;
        if (!haveOwn) box.append(start, startNote);

        // The public ones, below: join with one press (then it is yours above), or open it.
        const mine = new Set(servers.map((sv) => String(sv.slug || '').toLowerCase()));
        const open = (publicServers || []).filter((sv) => sv && okSlug(sv.slug) && !mine.has(String(sv.slug).toLowerCase()));
        if (open.length) {
            box.append(h('p', 'ovdk-sec', `Find servers · ${open.length}`));
            const list = h('ul', 'ovdk-rows ovdk-sv-find');
            let filter = null;
            if (open.length > 8) {
                filter = h('input', 'ovdk-sv-filter'); filter.type = 'search'; filter.placeholder = 'Find a server'; filter.setAttribute('aria-label', 'Find a server');
                box.append(filter);
            }
            open.forEach((sv, i) => {
                const slug = String(sv.slug), nm = String(sv.name || slug).slice(0, 60);
                const li = h('li', 'ovdk-row is-request'); li.style.setProperty('--i', String(Math.min(i, 12))); li.dataset.find = `${nm} ${sv.description || ''} ${slug}`.toLowerCase();
                const a = h('a', 'ovdk-row-b'); a.href = `${CHAT_SITE}/s/${encodeURIComponent(slug)}`;
                const members = Number(sv.members || sv.member_count) || 0;
                a.append(h('b', '', nm), h('span', 'ovdk-row-p', [sv.official ? 'Official' : '', members ? `${members} ${members === 1 ? 'member' : 'members'}` : '', String(sv.description || '').slice(0, 90)].filter(Boolean).join(' · ')));
                const join = h('button', 'ovdk-request-ok'); join.type = 'button'; join.textContent = 'Join'; join.setAttribute('aria-label', `Join ${nm}`);
                join.addEventListener('click', async () => {
                    join.disabled = true; join.textContent = 'Joining…';
                    try {
                        await chatCall(`/api/chat/servers/${encodeURIComponent(slug)}/join`, { method: 'POST', body: '{}' });
                        servers.push({ ...sv, unread: 0 }); chats.servers = servers; repaint();
                    } catch (err) { join.disabled = false; join.textContent = err && err.status === 401 ? 'Sign in' : 'Try again'; }
                });
                li.append(serverTile(sv), a, join);
                list.append(li);
            });
            box.append(list);
            if (filter) filter.addEventListener('input', () => {
                const words = filter.value.toLowerCase().split(/\s+/).filter(Boolean);
                for (const li of list.children) li.hidden = !words.every((w) => li.dataset.find.includes(w));
            });
        }
        const more = h('a', 'ovdk-gl-more'); more.href = `${CHAT_SITE}/servers`; more.append(h('span', '', 'Every server on openvibe.chat'), icon(G.open || G.chat));
        // The foot stays at the bottom of the pane: every server on Chat, and (with servers of your own) New server.
        const foot = h('div', 'ovdk-sv-foot');
        foot.append(more);
        if (haveOwn) {
            start.hidden = true; start.classList.add('is-float');
            const fab = h('button', 'ovdk-fab'); fab.type = 'button'; fab.setAttribute('aria-expanded', 'false'); fab.setAttribute('aria-label', 'Start a server');
            fab.append(icon(G.plus), h('span', '', 'New server'));
            fab.addEventListener('click', () => {
                const opening = start.hidden;
                start.hidden = !opening; startNote.hidden = !opening || !startNote.textContent;
                fab.setAttribute('aria-expanded', String(opening));
                if (opening) { start.classList.remove('is-rising'); void start.offsetWidth; start.classList.add('is-rising'); try { name.focus({ preventScroll: true }); } catch { /* */ } }
            });
            name.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !start.hidden) { e.stopPropagation(); start.hidden = true; fab.setAttribute('aria-expanded', 'false'); fab.focus(); } });
            box.append(start, startNote);
            foot.append(fab);
        }
        box.append(foot);
        return box;
    }
    /** "edited", one quiet word after a message's words; when, in its title. */
    function editedMark(at) {
        const mark = h('small', 'ovdk-edited', 'edited');
        const d = new Date(String(at || '').replace(' ', 'T'));
        if (!Number.isNaN(d.getTime())) mark.title = `Edited ${d.toLocaleString()}`;
        return mark;
    }
    /** An edit arrived (mine, saved here, or another of my devices'): the words in place, marked, the card again. */
    function applyEdit(list, m) {
        const old = chats.msgs.find((x) => Number(x.id) === Number(m && m.id));
        const li = old && list.querySelector(`[data-id="${Number(m.id)}"]`);
        if (!li || !m.edited_at || (old.edited_at && old.edited_at >= m.edited_at)) return;
        Object.assign(old, { message: m.message, card: m.card, edited_at: m.edited_at });
        const words = li.querySelector('.ovdk-text');
        words.textContent = String(m.message || ''); words.append(editedMark(m.edited_at));
        const card = li.querySelector('.ovdk-card'); if (card) card.remove();
        if (m.card) load('dock-card.js', () => !!root.OpenVibeDockCard).then((ok) => { if (ok && li.isConnected) { const c = root.OpenVibeDockCard(m.card, h); if (c) li.append(c); } });
    }
    /** When a message was sent, as a number (0 when it does not say). */
    const sentAt = (m) => { const t = Date.parse(String((m && m.created_at) || '')); return Number.isFinite(t) ? t : 0; };
    /** The day line over a thread's first message of a day (4.259.0; the owner, 11-15: "missing dates and timestamps"). */
    function dayLine(t) {
        const d = new Date(t), now = new Date();
        const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
        const ago = Math.round((day(now) - day(d)) / 86400000);
        const words = ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : ago < 7 ? d.toLocaleDateString(undefined, { weekday: 'long' })
            : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
        const li = h('li', 'ovdk-day'); li.setAttribute('role', 'separator'); li.append(h('span', '', words));
        return li;
    }
    const sameDay = (a, b) => { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); };
    /** One sender's run of messages: a new one starts with another sender, or after ten quiet minutes. */
    const sameRun = (m, prev) => !!prev && prev.username === m.username && sentAt(m) - sentAt(prev) < 10 * 60000 && sameDay(sentAt(m), sentAt(prev));
    const MEDIA = /^https:\/\/openvibe\.media\//;
    const size = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);
    function filesOf(m) {
        const list = (Array.isArray(m.attachments) ? m.attachments : []).filter((a) => a && MEDIA.test(String(a.url || ''))).slice(0, 4);
        if (!list.length) return null;
        const box = h('span', 'ovdk-files');
        for (const a of list) {
            const play = a.playback && a.playback.ready && MEDIA.test(String(a.playback.url || '')) ? a.playback.url : a.url;
            if (a.kind === 'image') {
                const link = h('a', 'ovdk-pic'); link.href = a.url; link.target = '_blank'; link.rel = 'noopener';
                const img = h('img'); img.src = a.url; img.alt = a.name || 'A picture'; img.loading = 'lazy'; img.decoding = 'async';
                if (a.width && a.height) { img.width = a.width; img.height = a.height; }
                link.append(img); box.append(link);
            } else if (a.kind === 'video') {
                const v = h('video', 'ovdk-vid'); v.controls = true; v.preload = 'none'; v.playsInline = true; v.src = play;
                if (a.poster && MEDIA.test(a.poster)) v.poster = a.poster;
                v.setAttribute('aria-label', a.name || 'A video'); box.append(v);
            } else if (a.kind === 'audio') {
                const s = h('audio', 'ovdk-aud'); s.controls = true; s.preload = 'none'; s.src = play; s.setAttribute('aria-label', a.name || 'A sound'); box.append(s);
            } else {
                const f = h('a', 'ovdk-fileref'); f.href = a.url; f.target = '_blank'; f.rel = 'noopener';
                f.append(icon(G.clip), h('span', 'ovdk-fileref-n', a.name || 'A file'), h('small', '', size(Number(a.size) || 0)));
                box.append(f);
            }
        }
        return box;
    }
    function bubble(m, prev) {
        const mine = m.username === me();
        const cont = sameRun(m, prev);
        const li = h('li', `ovdk-msg${mine ? ' is-mine' : ''}${cont ? ' is-cont' : ''}`);
        if (!cont) {
            // A run's head: the sender (not you) and the time it was sent (4.259.0).
            const head = h('span', 'ovdk-who-row');
            if (!mine) {
                // §Z.3: the name wears its effect, hat and badge (the message's subject, when it carries one).
                const who = setSubject(h('span', 'ovdk-who'), m); who.textContent = m.display_name || m.username || '';
                head.append(who);
            }
            const at = sentAt(m);
            if (at) { const tm = h('time', 'ovdk-time', new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })); tm.dateTime = new Date(at).toISOString(); head.append(tm); }
            if (head.childNodes.length) li.append(head);
        }
        li.dataset.id = String(m.id);
        const words = h('span', 'ovdk-text', String(m.message || ''));
        if (m.edited_at) words.append(editedMark(m.edited_at));
        li.append(words);
        // 4.267.0 (plan §AD.8 step 5: DMs with files in the Chat tab): the files a message carries, drawn from
        // Chat's references (Media addresses only): a picture, a video or a sound that plays here, a file to open.
        const files = filesOf(m);
        if (files) { li.append(files); if (!String(m.message || '').trim()) words.hidden = true; }
        if (mine && canWriteChat()) {
            const acts = h('span', 'ovdk-acts');
            const edit = h('button', 'ovdk-act ovdk-edit'); edit.type = 'button'; edit.setAttribute('aria-label', 'Edit message'); edit.setAttribute('data-ov-tip', 'Edit'); edit.append(icon(G.pencil));
            acts.append(edit); li.append(acts); li.classList.add('has-acts');
        }
        // A known OpenVibe link's card (Chat's link cards): dock-card.js draws it, loaded the first time one shows.
        if (m.card) load('dock-card.js', () => !!root.OpenVibeDockCard).then((ok) => { const c = ok && root.OpenVibeDockCard(m.card, h); if (c) li.append(c); });
        li.title = new Date(m.created_at).toLocaleString();
        return li;
    }
    async function openChat(id, remember) {
        clearTimeout(chats.timer);
        if (chats.edits) { chats.edits.stop(); chats.edits = null; }
        const panel = chats.panel; if (!panel) return;
        chats.open = String(id); chats.msgs = []; chats.last = 0;
        const draft = chats.draft && canWriteChat() ? chats.draft.text : '';
        chats.draft = null;
        if (remember) save({ chat: chats.open });
        const conv = (chats.list || []).find((c) => String(c.id) === chats.open);
        panel.textContent = '';
        const head = h('div', 'ovdk-thread-h');
        // 4.260.0 (the owner, 11-15: "make the back button easier to see"): a pill with its word, in the accent.
        const back = h('button', 'ovdk-back is-pill'); back.type = 'button'; back.setAttribute('aria-label', 'Back to your chats'); back.append(icon(G.back), h('span', '', 'Chats'));
        back.addEventListener('click', () => { save({ chat: null }); chatList(); });
        // §Z.3: the title's names wear their effect, hat and badge (each person's name in a span of its own).
        const title = titleInto(h('b', ''), conv);
        head.append(back, title, toChat('https://openvibe.chat/messages'));
        // Opened from the Dock's state on another page: the list is not here yet, so the title comes with it.
        if (!conv) chatCall('/api/dm/conversations').then((b) => { chats.list = b.conversations || []; const c = chats.list.find((x) => String(x.id) === String(id)); if (c && chats.open === String(id)) titleInto(title, c); }).catch(() => { /* the title stays */ });
        const list = h('ol', 'ovdk-msgs'); list.setAttribute('aria-live', 'polite');
        const scroll = h('div', 'ovdk-scroll ovdk-thread'); scroll.append(list);
        const form = h('form', 'ovdk-send');
        const box = h('textarea'); box.rows = 1; box.maxLength = 4000; box.placeholder = 'Message'; box.setAttribute('aria-label', 'Message');
        const go = h('button', 'ovdk-go'); go.type = 'submit'; go.setAttribute('aria-label', 'Send'); go.append(icon(G.send));
        const err = h('p', 'ovdk-err'); err.hidden = true;
        // 4.267.0: files. Each goes to Media as it is picked (the composer's own upload, loaded beside the Dock the
        // first time), shows as a chip with its progress, and goes with the message by its id; a file alone is a message.
        const attach = h('button', 'ovdk-attach'); attach.type = 'button'; attach.setAttribute('aria-label', 'Attach a picture, a video, a sound or a file'); attach.setAttribute('data-ov-tip', 'Attach'); attach.append(icon(G.clip));
        const picker = h('input'); picker.type = 'file'; picker.multiple = true; picker.hidden = true; picker.accept = 'image/*,video/*,audio/*,application/pdf,text/*';
        const pending = h('div', 'ovdk-pending'); pending.hidden = true;
        const sent = [];   // { chip, id?, job }
        const ready = () => sent.filter((x) => x.id).map((x) => x.id);
        const paintPending = () => { pending.hidden = !sent.length; };
        attach.addEventListener('click', () => picker.click());
        picker.addEventListener('change', async () => {
            const picked = [...(picker.files || [])].slice(0, Math.max(0, 4 - sent.length));
            picker.value = '';
            if (!picked.length) return;
            let C = root.OpenVibeComposer;
            if (!C || !C.uploadToMedia) C = await new Promise((ok) => { const sc = document.createElement('script'); sc.src = sibling('ov-composer.js'); sc.onload = () => ok(root.OpenVibeComposer || null); sc.onerror = () => ok(null); document.head.appendChild(sc); });
            if (!C || !C.uploadToMedia) { err.textContent = 'Files cannot be attached right now. Try again in a moment.'; err.hidden = false; return; }
            for (const file of picked) {
                const chip = h('span', 'ovdk-chip is-up'); const prog = h('i'); const x = h('button'); x.type = 'button'; x.setAttribute('aria-label', `Remove ${file.name}`); x.append(icon(G.close));
                chip.append(h('span', '', file.name || 'file'), prog, x);
                const item = { chip };
                const ctl = typeof AbortController === 'function' ? new AbortController() : null;
                x.addEventListener('click', () => { if (ctl) ctl.abort(); sent.splice(sent.indexOf(item), 1); chip.remove(); paintPending(); });
                sent.push(item); pending.append(chip); paintPending();
                item.job = C.uploadToMedia(file, (p) => { prog.style.width = `${Math.round(p * 100)}%`; }, ctl && ctl.signal)
                    .then((r) => { item.id = r.id; chip.classList.remove('is-up'); })
                    .catch((e) => { if (e && e.cancelled) return; chip.classList.remove('is-up'); chip.classList.add('is-bad'); chip.title = (e && e.message) || 'It did not upload'; });
            }
        });
        form.append(attach, picker, box, go);
        panel.append(head, scroll, err);
        // Editing one of mine: the box holds its words, a slim bar over it says so, Escape or × lets go.
        const bar = h('div', 'ovdk-edit-bar'); bar.hidden = true;
        const stopX = h('button'); stopX.type = 'button'; stopX.setAttribute('aria-label', 'Stop editing'); stopX.setAttribute('data-ov-tip', 'Stop editing'); stopX.append(icon(G.close));
        bar.append(icon(G.pencil), h('span', '', 'Editing your message'), stopX);
        let editing = null;
        const stopEditing = () => {
            if (!editing) return;
            if (editing.li) editing.li.classList.remove('is-editing');
            editing = null; bar.hidden = true; form.classList.remove('is-editing');
            box.value = ''; box.dispatchEvent(new Event('input')); go.setAttribute('aria-label', 'Send');
        };
        const startEditing = (li) => {
            const old = li && chats.msgs.find((m) => Number(m.id) === Number(li.dataset.id));
            if (!old) return;
            if (editing && editing.li) editing.li.classList.remove('is-editing');
            list.querySelectorAll('.is-acting').forEach((x) => x.classList.remove('is-acting'));
            editing = { id: old.id, was: String(old.message || ''), li };
            li.classList.add('is-editing'); bar.hidden = false; form.classList.add('is-editing'); go.setAttribute('aria-label', 'Save');
            box.value = editing.was; box.dispatchEvent(new Event('input'));
            try { box.focus(); box.setSelectionRange(box.value.length, box.value.length); } catch { /* */ }
        };
        stopX.addEventListener('click', () => { stopEditing(); box.focus(); });
        list.addEventListener('click', (e) => {
            const edit = e.target.closest && e.target.closest('.ovdk-edit');
            if (edit) { e.preventDefault(); startEditing(edit.closest('[data-id]')); return; }
            // A finger: a tap on my bubble shows its actions (a second tap, or a tap on another, puts them away).
            const li = e.target.closest && e.target.closest('.ovdk-msg.has-acts');
            if (!li || !(typeof matchMedia === 'function' && matchMedia('(hover: none)').matches) || (e.target.closest('a, button'))) return;
            const was = li.classList.contains('is-acting');
            list.querySelectorAll('.is-acting').forEach((x) => x.classList.remove('is-acting'));
            if (!was) li.classList.add('is-acting');
        });
        if (canWriteChat()) {
            panel.append(bar, pending, form);
            const fit = () => { box.style.height = 'auto'; box.style.height = `${Math.min(box.scrollHeight, 140)}px`; };
            box.addEventListener('input', fit);
            if (draft && root.OpenVibeDockShare) root.OpenVibeDockShare.ready({ draft, h, panel, form, box, fit });
            box.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && editing) { e.preventDefault(); e.stopPropagation(); stopEditing(); return; }
                if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true })); }
            });
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const text = box.value.trim();
                if (sent.length && !editing) await Promise.all(sent.map((x) => x.job).filter(Boolean)).catch(() => {});
                const ids = editing ? [] : ready();
                if ((!text && !ids.length) || chats.busy) return;
                if (editing) {
                    const ed = editing;
                    if (text === ed.was.trim()) { stopEditing(); return; }
                    chats.busy = true; go.disabled = true; err.hidden = true;
                    try {
                        const out = await chatCall(`/api/dm/conversations/${encodeURIComponent(chats.open)}/messages/${encodeURIComponent(ed.id)}`, { method: 'PATCH', body: JSON.stringify({ message: text }) });
                        if (out && out.message) applyEdit(list, out.message);
                        if (editing === ed) stopEditing();
                    } catch (x) {
                        err.textContent = x.status === 429 ? 'Slow down a little, then save it again.' : x.status === 403 ? 'That message can no longer be edited.' : 'The edit did not save. Try again.';
                        err.hidden = false;
                    } finally { chats.busy = false; go.disabled = false; box.focus(); }
                    return;
                }
                chats.busy = true; go.disabled = true; err.hidden = true;
                try {
                    await chatCall(`/api/dm/conversations/${encodeURIComponent(chats.open)}/messages`, { method: 'POST', body: JSON.stringify({ message: text, ...(ids.length ? { attachments: ids } : {}) }) });
                    box.value = ''; fit();
                    sent.splice(0).forEach((x) => x.chip.remove()); paintPending();
                    await pull(list, scroll);
                } catch (x) {
                    err.textContent = x.status === 429 ? 'Slow down a little, then send it again.' : x.status === 403 ? 'You can’t send messages in this conversation.' : 'That did not send. Try again.';
                    err.hidden = false;
                } finally { chats.busy = false; go.disabled = false; box.focus(); }
            });
        } else {
            panel.append(h('div', 'ovdk-none', 'Reading only. Answer in OpenVibe.Chat.'));
        }
        list.append(h('li', 'ovdk-wait', null));
        list.firstChild.innerHTML = '<span></span>';
        await pull(list, scroll, true);
        load('dock-chat-edits.js', () => !!root.OpenVibeDockChatEdits).then((ok) => { if (ok && chats.open === String(id)) chats.edits = root.OpenVibeDockChatEdits({ id: String(id), apply: (m) => applyEdit(list, m), tokenOf, chatBase, active: () => chats.open === String(id) && panelActive('chats') }); });
        if (canWriteChat() && !(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)) setTimeout(() => { try { box.focus({ preventScroll: true }); if (draft) box.setSelectionRange(box.value.length, box.value.length); } catch { /* */ } }, 0);
        // §Z.3: every name in the room (the title and the messages) wears its effect, hat and badge.
        wearNames(panel);
    }
    /** New messages of the open thread (all of them the first time), drawn in place; read once shown. */
    async function pull(list, scroll, first) {
        const id = chats.open;
        let got = [];
        try { got = (await chatCall(`/api/dm/conversations/${encodeURIComponent(id)}/messages?limit=50${chats.last ? `&after=${chats.last}` : ''}`)).messages || []; } catch (e) {
            if (first && panelActive('chats')) { list.textContent = ''; list.append(h('li', 'ovdk-none', e.status === 403 ? 'This conversation is not yours.' : 'The messages did not load. Try again.')); }
            return;
        }
        if (id !== chats.open || !panelActive('chats')) return;
        if (first) list.textContent = '';
        const atEnd = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 40;
        // Oldest first, whatever order the page came in (Chat answers the latest 50 newest first: the thread read upside
        // down; the owner, 11-15: "the conversations aren't ordered correctly"), with a day line where the day changes.
        got.slice().sort((a, b) => (sentAt(a) - sentAt(b)) || ((Number(a.id) || 0) - (Number(b.id) || 0))).forEach((m) => {
            if (chats.msgs.some((x) => x.id === m.id)) return;
            const prev = chats.msgs[chats.msgs.length - 1];
            if (sentAt(m) && (!prev || !sameDay(sentAt(m), sentAt(prev)))) list.append(dayLine(sentAt(m)));
            list.append(bubble(m, prev)); chats.msgs.push(m); chats.last = Math.max(chats.last, Number(m.id) || 0);
        });
        // §Z.3: every name in the room wears its effect, hat and badge.
        wearNames(list);
        if (first && !chats.msgs.length) list.append(h('li', 'ovdk-none', 'No messages yet. Say hello.'));
        if (first || atEnd) scroll.scrollTop = scroll.scrollHeight;
        if (got.length || first) chatCall(`/api/dm/conversations/${encodeURIComponent(id)}/read`, { method: 'POST', body: '{}' }).then(readUnread).catch(() => { /* */ });
        clearTimeout(chats.timer);
        if (panelActive('chats') && chats.open === id) chats.timer = setTimeout(() => pull(list, scroll), 5000);
    }

    // ── Vibe (plan L48 V2): the person's Vibe, in dock-vibe.js, loaded the first time the tab opens (the Dock is on
    // every page for signed-in people; Vibe's conversation and mic are not needed until then). Alt+V talks to Vibe from
    // any page: it opens the Dock on Vibe and starts listening (only where the browser can listen).
    const vibe = { panel: null, api: null };
    // The Chats tab's AI chats row opens the Vibe tab on its list, not on the last conversation.
    let vibeOnList = false;
    const canListen = () => !!(root.SpeechRecognition || root.webkitSpeechRecognition);
    document.addEventListener('keydown', (e) => {
        if (!e.altKey || e.ctrlKey || e.metaKey || String(e.key).toLowerCase() !== 'v' || !canListen() || !o || typeof o.token !== 'function') return;
        e.preventDefault();
        const talk = (n = 0) => { if (vibe.api && vibe.api.talk && panelActive('vibe')) vibe.api.talk(); else if (n < 40) setTimeout(() => talk(n + 1), 100); };
        if (!panelActive('vibe')) open({ tab: 'vibe' });
        talk();
    });

    // ── The timer (plan L48 R2): dock-timer.js, loaded when the state carries one or the person opens its menu ──
    let timerMod = null, timerLoading = null;
    function withTimer(fn) {
        if (timerMod) return fn(timerMod);
        timerLoading = timerLoading || load('dock-timer.js', () => !!(root.OpenVibeDockTimer && root.OpenVibeDockTimer.attach)).then((ok) => {
            if (ok && !timerMod) timerMod = root.OpenVibeDockTimer.attach({ state, save, host: () => inline, repaint: () => paintStatus() });
            return timerMod;
        });
        return timerLoading.then((m) => (m ? fn(m) : null));
    }

    // ── Status (4.220.0): what the pill used to say rides on the bar's menu button (navbar.js passes o.status) ──
    let readT = 0, bound = false, off = false;
    function store(v) {
        try { if (v === undefined) return JSON.parse(localStorage.getItem('ov-dock') || 'null'); localStorage.setItem('ov-dock', JSON.stringify(v)); } catch { /* */ }
        return null;
    }
    /** An agent needs you (first), a timer's minutes, or agents working; null when there is nothing to say. */
    function status() {
        if (off || !doc) return null;
        const c = counts(), st = state(), w = c.waiting || 0, r = c.running || 0;
        if (st.timer && !timerMod) withTimer((m) => m.sync());
        const tm = timerMod && !w ? timerMod.pillText() : null;
        if (w) return { tone: 'waiting', text: 'Needs you', label: `${w} need${w > 1 ? '' : 's'} you`, part: 'agent' };
        if (tm) return { tone: tm.tone, text: tm.text, label: tm.label, part: 'vibe' };
        if (r) return { tone: 'running', text: r > 1 ? `${r} working` : 'Working', label: `${r} working`, part: 'agent' };
        return null;
    }
    /** The status on the bar's menu button, for a bar that asked (navbar.js passes o.status): a dot while agents work, an
     * amber one when one needs you, a timer's minutes in a small label under it; the tooltip and the name say it in words. */
    function paintBar(s) {
        document.querySelectorAll('.openvibe-navbar #openvibe-search-btn, .openvibe-navbar #openvibe-burger.ovnav-orb').forEach((b) => {
            let chip = b.querySelector('.ovnav-st');
            if (!s) { if (chip) chip.remove(); b.removeAttribute('data-ov-status'); if (b.dataset.ovLabel) { b.setAttribute('aria-label', b.dataset.ovLabel); b.setAttribute('data-ov-tip', b.dataset.ovTip || b.dataset.ovLabel); } return; }
            // An i, not a span: the old burger draws its spans as lines.
            if (!chip) { chip = document.createElement('i'); chip.className = 'ovnav-st'; chip.setAttribute('aria-hidden', 'true'); b.appendChild(chip); }
            chip.textContent = /^timer/.test(s.tone) ? (s.tone === 'timer-done' ? 'Done' : s.text) : '';
            b.setAttribute('data-ov-status', s.tone);
            if (!b.dataset.ovLabel) { b.dataset.ovLabel = b.getAttribute('aria-label') || 'Menu'; b.dataset.ovTip = b.getAttribute('data-ov-tip') || ''; }
            b.setAttribute('aria-label', `${b.dataset.ovLabel}: ${s.label}`);
            b.setAttribute('data-ov-tip', s.label);
        });
    }
    function paintStatus() {
        if (typeof o.status !== 'function') return;
        const s = status();
        try { o.status(s); } catch { /* the bar is optional */ }
        paintBar(s);
    }
    async function read() {
        clearTimeout(readT);
        if (off || !o.token || document.hidden) return;
        const t = await tokenOf();
        if (!t) return;
        try {
            const r = await fetch(`${String(o.apiBase || 'https://openvibe.network').replace(/\/+$/, '')}/api/v1/me/dock`, { headers: { authorization: `Bearer ${t}`, accept: 'application/json' }, credentials: 'omit' });
            if (r.status === 404) { off = true; store({ off: Date.now() + 864e5 }); paintStatus(); return; }
            const next = r.ok ? await r.json() : null;
            if (!next || !next.state) return;
            update(next);
            const c = next.counts || {};
            if (c.running || c.waiting || next.state.timer) readT = setTimeout(read, 30000);
        } catch { /* offline: the copy stands */ }
    }
    /** A signed-in person's state and counts (navbar.js), or none (null: signed out, or the site turned it off). */
    function mount(opts) {
        if (!opts) {
            if (mountHandle) mountHandle.destroy();
            clearTimeout(readT);
            const was = o.status; o = {}; doc = null;
            if (typeof was === 'function') { try { was(null); } catch { /* */ } paintBar(null); }
            return;
        }
        o = { ...o, ...opts };
        styles();
        offerSearchRows();
        const kept = store();
        off = !!(kept && kept.off > Date.now());
        if (kept && kept.state && !doc) doc = kept;
        paintStatus();
        if (!bound) { bound = true; document.addEventListener('visibilitychange', () => { if (!document.hidden) read(); }); }
        read();
    }

    // ── The top bar's rows for Chat (4.263.0; the owner, 11-15: "add a friend … from the top bar"): typed @name, the menu
    //    offers Message @name and Add @name as a friend. Offered once, for a signed-in Dock. ──
    let searchRowsOn = false;
    function offerSearchRows() {
        if (searchRowsOn) return; searchRowsOn = true;
        const provider = {
            id: 'chat',
            rows(q) {
                const m = /^@([a-z0-9_.-]{2,40})$/i.exec(String(q || '').trim());
                if (!m || !o.token || m[1].toLowerCase() === me().toLowerCase()) return [];
                const u = m[1];
                return [
                    { title: `Message @${u}`, meta: 'Your conversation with them, in Chat', icon: 'send', run: () => chatWith(u) },
                    { title: `Add @${u} as a friend`, meta: 'Friends once they add you back, on every OpenVibe site', icon: 'plus', run: () => befriend(u) },
                ];
            },
        };
        const S = root.OpenVibeSearch;
        if (S && typeof S.provide === 'function') S.provide(provider);
        else (root.OVSearchProviders = root.OVSearchProviders || []).push(provider);
    }
    async function chatWith(username) {
        open({ tab: 'chats' });
        try {
            const out = await chatCall('/api/dm/conversations', { method: 'POST', body: JSON.stringify({ usernames: [username] }) });
            const id = out && (out.conversation ? out.conversation.id : out.id);
            if (id != null) setTimeout(() => openChat(String(id), true), 120);
        } catch { /* the list shows; the person can try again there */ }
    }
    async function befriend(username) {
        chats.seg = 'friends'; try { localStorage.setItem('ovdk-chat-seg', 'friends'); } catch { /* private mode */ }
        try { await friendsCall(`/${encodeURIComponent(username)}`, { method: 'PUT', body: '{}' }); } catch { /* the Friends list says what is so */ }
        open({ tab: 'chats' });
        if (chats.panel && panelActive('chats')) chatList();
    }

    // ── Open: the menu, on one of its places ──
    // Ask your agent (4.135.0): Vibe opens with the question in its box, unsent.
    function ask({ text = '' } = {}, n = 0) {
        // 4.240.0: the menu's Vibe is one agent with one box (ov-run.js): the words wait there, unsent.
        const S = root.OpenVibeSearch;
        if (S && typeof S.prefill === 'function') {
            if (!n) open({ tab: 'vibe' });
            if (S.prefill(text)) return;
            if (n < 40) setTimeout(() => ask({ text }, n + 1), 100);
            return;
        }
        if (!n && !panelActive('vibe')) open({ tab: 'vibe' }); if (vibe.api && vibe.api.ask && panelActive('vibe')) vibe.api.ask(text); else if (n < 40) setTimeout(() => ask({ text }, n + 1), 100); }
    function isOpen() { return !!inline; }
    function share({ text = '', title = '' } = {}) {
        const t = String(text || '').trim().slice(0, 4000);
        if (!t) return;
        chats.draft = { text: t, title: String(title || '').trim().slice(0, 140) }; chats.open = null;
        // A bar left from an earlier share would show the old words until the list reloads: it goes now.
        const stale = chats.panel && chats.panel.querySelector('.ovdk-share'); if (stale) stale.remove();
        if (panelActive('chats')) { chatList(); return; }
        open({ tab: 'chats' });
    }
    /** The menu opens on that place (navbar.js passes o.openMenu), and the menu mounts the panel with mountInto. */
    function open(opts = {}) {
        const { tab: want, doc: given, ...rest } = opts || {};
        o = { ...o, ...rest };
        if (given) doc = given;
        const c = counts();
        let id = want || (c.waiting || c.running ? 'agent' : state().tab || 'vibe');
        if (id === 'agents') id = 'agent';
        if (!TABS.some(([t]) => t === id)) id = 'vibe';
        if (inline && id === tab && part !== 'top') return;
        if (typeof o.openMenu === 'function') o.openMenu(id);
    }
    function close() { if (typeof o.closeMenu === 'function') o.closeMenu(); }
    /** A fresh copy from the Network: counts, and anything changed elsewhere (the timer, the open chat). */
    function update(next) {
        if (!next || !next.state) return;
        doc = Object.keys(pending).length ? { ...next, state: state() } : next;
        store(doc);
        if (timerMod) timerMod.sync();
        paintStatus();
    }

    let mountHandle = null;
    /** Place the same panel body under another sheet's head. The helper and its layout load on first use. */
    function mountInto(host, { tab: first = 'vibe', part: lend = null } = {}) {
        if (!(host instanceof Element)) throw new TypeError('mountInto needs a host element');
        if (mountHandle) mountHandle.destroy();
        let api = null, gone = false, wanted = first;
        const handle = {
            show(id) { if (gone) return; wanted = id; if (api) api.show(id); },
            destroy() { if (gone) return; gone = true; if (api) api.destroy(); if (mountHandle === handle) mountHandle = null; },
        };
        mountHandle = handle;
        load('dock-mount.js', () => !!root.OpenVibeDockMount).then((ok) => {
            if (ok && !gone) api = root.OpenVibeDockMount.mount(host, wanted, {
                start(wrap) { if (!bodyEl) build(); part = lend === 'top' || lend === 'live' ? lend : null; wrap.classList.toggle('ovdk-part-top', !!part); inline = wrap; wrap.append(bodyEl); },
                // A lent top is not a place the person chose: the menu's Vibe remembers its own (remember()).
                show(id) { setTab(id, part !== 'top'); },
                end() { disposePanel(); inline = null; part = null; if (bodyEl) bodyEl.remove(); paintStatus(); },
            });
        });
        return handle;
    }

    root.OpenVibeDock = { mount, mountInto, open, close, isOpen, update, ask, share,
        // The menu's search box filters the conversations. The menu redraws when its own loads arrive (and calls this with the
        // same words): an unchanged filter does nothing, so an open chat is never swapped for the list under the person.
        filterChats: (v) => { const f = String(v || '').toLowerCase(); if (f === chats.filter) return; chats.filter = f; chatList(); },
        // The timer's menu (the menu's Vibe tab has its button): presets, a focus round, your own.
        timer: (anchor) => withTimer((t) => t.menu(anchor || null)), more: (a) => { if (a === 'timer') withTimer((t) => t.menu(null)); },
        status, canSend: () => canWriteChat(), _state: () => ({ doc, tab, pending }) };
})(typeof window !== 'undefined' ? window : globalThis);
