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
    const DOCK_REV = { 'dock-vibe.js': '7746fc647b45', 'dock-code.js': '7a768982eff3', 'dock-mount.js': 'fb07dccadb8c', 'dock-runs.js': '4368f039df7c', 'ai-marks-client.js': 'f4a880a9f206', 'action-center.js': 'e40346ec1f16', 'dock-timeline.js': 'bffaed38fccf', 'dock-actor.js': 'ee1f6f21dbba', 'dock-agent.js': '8787080a04d3', 'dock-timer.js': '460d68aa8321', 'dock-share.js': 'e83b2e27b3ef', 'dock-card.js': '2643c20b0016', 'dock-chat-edits.js': '6cf8c6b6daa5' };
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
            .ovdk-msgs { list-style: none; margin: 0; padding: 12px; display: flex; flex-direction: column; gap: 3px; }
            .ovdk-msg { display: grid; justify-items: start; max-width: 84%; margin-top: 8px; }
            .ovdk-msg.is-cont { margin-top: 0; }
            .ovdk-msg.is-mine { align-self: flex-end; justify-items: end; }
            .ovdk-who { margin: 0 0 3px 10px; font-size: 11.5px; font-weight: 700; color: var(--text-muted, #8b8b96); }
            .ovdk-text { padding: 8px 12px; border-radius: 16px; font-size: 14px; line-height: 1.42; white-space: pre-wrap; overflow-wrap: anywhere;
                background: color-mix(in srgb, var(--text-primary, #ececf1) 7%, transparent); }
            .ovdk-msg.is-mine .ovdk-text { color: var(--on-accent-strong, var(--on-accent, #fff)); background: var(--accent-strong, var(--accent, #3472d8)); }
            .ovdk-send { flex: none; display: flex; align-items: flex-end; gap: 8px; margin: 8px 10px 10px; padding: 4px 4px 4px 12px; border-radius: 16px;
                border: 1px solid var(--border-light, var(--border, rgba(255,255,255,.14))); background: var(--bg-primary, #12141b); }
            .ovdk-send:focus-within { border-color: var(--accent, #3b82f6); }
            .ovdk-send textarea { flex: 1; min-width: 0; box-sizing: border-box; min-height: 36px; max-height: 140px; padding: 8px 0; resize: none; border: 0; outline: none; background: transparent; color: var(--text-primary, #ececf1); font: inherit; font-size: 14px; line-height: 1.4; }
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
        if (id === 'agent' && part === 'top') {
            // 4.225.0: only the top is lent (the menu's Vibe draws the runs and the Action Center's work itself).
            panel.innerHTML = '<div class="ovdk-actor"></div><div class="ovdk-timeline"></div><div class="ovdk-agent"></div>';
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
            if (on && epoch === panelEpoch && !mounts[id + 'Timeline'] && panel.isConnected && panelActive(id)) mounts[id + 'Timeline'] = root.OpenVibeDockTimeline.mount(panel.querySelector('.ovdk-timeline'), { token: o.token, base: directBase(o.actorBase), frameBase: frameBase(), active: () => panelActive('agent'), focus: () => o.task || null });
        });
        load('dock-actor.js', () => !!(root.OpenVibeDockActor && root.OpenVibeDockActor.mount)).then((on) => {
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
    const chats = { panel: null, list: null, open: null, msgs: [], last: 0, timer: 0, edits: null, unread: 0, unreadT: 0, busy: false, draft: null, vibeSummary: null, filter: '' };
    const chatBase = () => String(o.chatBase || 'https://openvibe.chat').replace(/\/+$/, '');
    const me = () => String(o.me || '');
    const scopes = () => Array.isArray(o.scopes) ? o.scopes : null;
    const canWriteChat = () => !scopes() || scopes().includes('chat.write');
    const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    const icon = (path) => { const s = h('span', 'ovdk-i'); s.innerHTML = svg(path); return s; };
    const toChat = (href) => { const a = h('a', 'ovdk-ib ovdk-away'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.title = 'Open in Chat'; a.setAttribute('aria-label', 'Open in Chat'); a.setAttribute('data-ov-tip', 'Open in Chat'); a.innerHTML = svg('<path d="M13.5 5.5h5v5M18.5 5.5l-7.5 7.5M17 13.5v4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 17.5v-9A1.5 1.5 0 0 1 6.5 7h4"/>'); return a; };
    async function chatCall(path, init = {}) {
        const t = await tokenOf();
        const headers = { accept: 'application/json', ...(init.body ? { 'content-type': init.type || 'application/json' } : {}), ...(t ? { authorization: `Bearer ${t}` } : {}) };
        const { type: _type, ...rest } = init;
        return fetch(chatBase() + path, { ...rest, headers, credentials: 'omit' }).then(async (r) => {
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
        if (url && !group) { const img = h('img'); img.src = url; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; a.append(img); }
        else a.textContent = group ? '#' : String((p && (p.display_name || p.username)) || '?').trim().charAt(0).toUpperCase() || '?';
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
    async function chatList() {
        clearTimeout(chats.timer);
        if (chats.edits) { chats.edits.stop(); chats.edits = null; }
        chats.open = null;
        const panel = chats.panel; if (!panel) return;
        if (!chats.list) { panel.innerHTML = '<div class="ovdk-wait"><span></span></div>'; }
        const sharing = chats.draft && canWriteChat() ? load('dock-share.js', () => !!(root.OpenVibeDockShare && root.OpenVibeDockShare.bar)) : null;
        try {
            const [dm, ai] = await Promise.all([chatCall('/api/dm/conversations'), chatCall('/api/vibe/conversations').catch(() => null)]);
            chats.list = dm.conversations || [];
            chats.vibeSummary = ai && ai.count ? { kind: 'vibe', count: ai.count, latest: ai.conversations && ai.conversations[0], last_message_at: ai.conversations && ai.conversations[0] && ai.conversations[0].last_message_at } : null;
        } catch (e) { if (panel !== chats.panel || !panelActive('chats')) return; panel.textContent = ''; panel.append(h('div', 'ovdk-none', e.status === 401 ? 'Sign in to Chat to see your conversations.' : 'Your chats did not load. Check your connection, then open them again.')); chatFoot(panel); return; }
        if (sharing) await sharing;
        if (panel !== chats.panel || !panelActive('chats') || chats.open) return;
        panel.textContent = '';
        if (chats.draft && canWriteChat() && root.OpenVibeDockShare) panel.append(root.OpenVibeDockShare.bar({ draft: chats.draft, h, chatCall, host: inline, cancel: () => { chats.draft = null; chatList(); }, open: (id) => { chats.list = null; return openChat(String(id), true); } }));
        // Open in Chat, as an icon over your conversations (ask 336).
        const bar = h('div', 'ovdk-bar'); bar.append(toChat('https://openvibe.chat/messages')); panel.append(bar);
        const scroll = h('div', 'ovdk-scroll');
        if (!chats.list.length && !chats.vibeSummary) {
            const none = h('div', 'ovdk-none');
            none.append(h('b', '', 'No conversations yet'), document.createTextNode('A message to someone on OpenVibe starts one, and it shows here on every site.'));
            scroll.append(none);
        } else {
            const ul = h('ul', 'ovdk-chats');
            [...chats.list.filter((c) => !chats.filter || titleOf(c).toLowerCase().includes(chats.filter)), ...(chats.vibeSummary ? [chats.vibeSummary] : [])].sort((a, b) => String(b.last_message_at || b.updated_at || '').localeCompare(String(a.last_message_at || a.updated_at || ''))).forEach((c) => {
                if (c.kind === 'vibe') {
                    const li = h('li'), b = h('button', 'ovdk-chat'); b.type = 'button';
                    const body = h('span', 'ovdk-chat-b'); body.append(h('b', '', 'Vibe'), h('span', 'ovdk-chat-p', `${c.count} chat${c.count === 1 ? '' : 's'}${c.latest && c.latest.name ? ` · ${c.latest.name}` : ''}`));
                    const meta = h('span', 'ovdk-chat-m'); const at = c.latest && c.latest.last_answer_at;
                    const t = h('time', '', when(at || c.last_message_at)); if (at) t.title = answered(at); meta.append(t);
                    const av = h('span', 'ovdk-av ovdk-av-vibe'); av.append(icon(G.vibe));
                    b.append(av, body, meta); b.setAttribute('aria-label', 'Open Vibe');
                    b.addEventListener('click', () => {
                        if (!b.dispatchEvent(new CustomEvent('openvibe:open-vibe', { bubbles: true, cancelable: true }))) return;
                        vibeOnList = true; save({ vibe: null }); setTab('vibe', true);
                    });
                    li.append(b); ul.append(li); return;
                }
                const li = h('li'), b = h('button', 'ovdk-chat');
                b.type = 'button';
                const unread = Number(c.unread_count) || 0;
                const mine = (c.participants || []).some((p) => p.id === c.last_sender_id && p.username === me());
                const body = h('span', 'ovdk-chat-b');
                body.append(h('b', '', titleOf(c)), h('span', 'ovdk-chat-p', c.last_message ? `${mine ? 'You: ' : ''}${String(c.last_message).replace(/\s+/g, ' ').slice(0, 140)}` : 'No messages yet'));
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
        }
        panel.append(scroll);
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
    function bubble(m, prev) {
        const mine = m.username === me();
        const li = h('li', `ovdk-msg${mine ? ' is-mine' : ''}${prev && prev.username === m.username ? ' is-cont' : ''}`);
        if (!mine && !(prev && prev.username === m.username)) li.append(h('span', 'ovdk-who', m.display_name || m.username || ''));
        li.dataset.id = String(m.id);
        const words = h('span', 'ovdk-text', String(m.message || ''));
        if (m.edited_at) words.append(editedMark(m.edited_at));
        li.append(words);
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
        const back = h('button', 'ovdk-back'); back.type = 'button'; back.setAttribute('aria-label', 'Back to your chats'); back.append(icon(G.back));
        back.addEventListener('click', () => { save({ chat: null }); chatList(); });
        const title = h('b', '', conv ? titleOf(conv) : 'Conversation');
        head.append(back, title, toChat('https://openvibe.chat/messages'));
        // Opened from the Dock's state on another page: the list is not here yet, so the title comes with it.
        if (!conv) chatCall('/api/dm/conversations').then((b) => { chats.list = b.conversations || []; const c = chats.list.find((x) => String(x.id) === String(id)); if (c && chats.open === String(id)) title.textContent = titleOf(c); }).catch(() => { /* the title stays */ });
        const list = h('ol', 'ovdk-msgs'); list.setAttribute('aria-live', 'polite');
        const scroll = h('div', 'ovdk-scroll ovdk-thread'); scroll.append(list);
        const form = h('form', 'ovdk-send');
        const box = h('textarea'); box.rows = 1; box.maxLength = 4000; box.placeholder = 'Message'; box.setAttribute('aria-label', 'Message');
        const go = h('button', 'ovdk-go'); go.type = 'submit'; go.setAttribute('aria-label', 'Send'); go.append(icon(G.send));
        const err = h('p', 'ovdk-err'); err.hidden = true;
        form.append(box, go);
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
            panel.append(bar, form);
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
                if (!text || chats.busy) return;
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
                    await chatCall(`/api/dm/conversations/${encodeURIComponent(chats.open)}/messages`, { method: 'POST', body: JSON.stringify({ message: text }) });
                    box.value = ''; fit();
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
        got.forEach((m) => { if (chats.msgs.some((x) => x.id === m.id)) return; list.append(bubble(m, chats.msgs[chats.msgs.length - 1])); chats.msgs.push(m); chats.last = Math.max(chats.last, Number(m.id) || 0); });
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
        const kept = store();
        off = !!(kept && kept.off > Date.now());
        if (kept && kept.state && !doc) doc = kept;
        paintStatus();
        if (!bound) { bound = true; document.addEventListener('visibilitychange', () => { if (!document.hidden) read(); }); }
        read();
    }

    // ── Open: the menu, on one of its places ──
    // Ask your agent (4.135.0): Vibe opens with the question in its box, unsent.
    function ask({ text = '' } = {}, n = 0) {
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
                start(wrap) { if (!bodyEl) build(); part = lend === 'top' ? 'top' : null; wrap.classList.toggle('ovdk-part-top', part === 'top'); inline = wrap; wrap.append(bodyEl); },
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
