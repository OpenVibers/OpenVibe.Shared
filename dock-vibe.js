/**
 * openvibe-shared/dock-vibe.js: the Dock's Vibe tab (plan L48 V2), loaded by dock.js the first time the tab opens.
 *   OpenVibeDockVibe.mount(panel, { chatCall, active, styles, icons }) → { refresh(), pause(), talk() }
 * chatCall is the Dock's call to OpenVibe.Chat with the person's Network token; active() says whether the Vibe tab is
 * the one showing; styles() is the Dock's own <style> (this file adds its rules there, so a popped-out Dock has them).
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OpenVibeDockVibe) return;
    const svg = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
    const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    // 4.220.0: the panel's marks are the network's glyphs (openvibe-shared/glyphs, shown on openvibe.design/icons; the owner,
    // 11-12: "actually has icons for everything using OpenVibe.design"). test/dock-vibe-glyphs.test.js keeps them equal.
    const V = {
        back: '<path d="M16.1 3.6l-8.4 8.4l8.4 8.4"/>',
        spark: '<path d="M10.4 3.6l1.7 4.8L17 10.1l-4.8 1.7L10.4 16.7l-1.7-4.8L3.9 10.1l4.8-1.7ZM17 14.8l0.8 2.1L19.8 17.6l-2.1 0.8L17 20.3l-0.8-2.1L14.3 17.6l2.1-0.8Z"/>',
        image: '<rect x="3.5" y="5.4" width="16.7" height="13" rx="2.8"/><circle cx="9.1" cy="10" r="1.5"/><path d="M20.3 15.6l-4.7-4.7l-7.4 7.4"/>',
        code: '<path d="M7.8 7.8l-4.2 4.2l4.2 4.2M16.2 7.8l4.2 4.2l-4.2 4.2M14.2 4.6l-4.2 14.8"/>',
        send: '<path d="M12 20.7V4.2M3.7 12.4l8.3-8.3l8.3 8.3"/>',
        bell: '<path d="M6 14.6V9.5a6.1 6.1 0 0 1 12.2 0v5.1l1.5 2.1h-15.3ZM10 18.7a2.1 2.1 0 0 0 4 0"/>',
        calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10.5h16M9 3.5v4M15 3.5v4"/>',
        live: '<circle cx="12" cy="11.8" r="2"/><path d="M8.6 8.4a4.9 4.9 0 0 0 0 7.1M15.4 8.4a4.9 4.9 0 0 1 0 7.1M6.3 6.1a8.1 8.1 0 0 0 0 11.9M17.7 6.1a8.1 8.1 0 0 1 0 11.9"/>',
        clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
        phone: '<path d="M5.7 3.4h3.9l2 4.9l-2.5 1.5a10.8 10.8 0 0 0 4.9 4.9L15.6 12.3l4.9 2v3.9a2 2 0 0 1-2 2A15.8 15.8 0 0 1 3.8 5.4a2 2 0 0 1 2-2"/>',
        search: '<circle cx="10.6" cy="10.6" r="7"/><path d="M20.4 20.4l-4.5-4.5"/>',
        chevron: '<path d="M7.9 3.6l8.4 8.4l-8.4 8.4"/>',
        plus: '<path d="M12 3.5v17M3.5 12h17"/>',
        mic: '<rect x="9.2" y="3.5" width="5.7" height="10.4" rx="2.8"/><path d="M5.4 11.1a6.6 6.6 0 0 0 13.2 0M12 17.7v2.8"/>',
        open: '<path d="M14 3.8h6.3v6.3M20.2 3.8l-9.4 9.4M18.2 14.2v4.2a2.1 2.1 0 0 1-2.1 2.1H5.6a2.1 2.1 0 0 1-2.1-2.1V7.9a2.1 2.1 0 0 1 2.1-2.1h4.2"/>',
    };
    const CSS = `
            .ovdk-ib.is-new { background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); color: var(--accent-light, var(--accent, #60a5fa)); }
            .ovdk-ib.is-new:hover, .ovdk-ib.is-new:focus-visible { background: color-mix(in srgb, var(--accent, #3b82f6) 26%, transparent); }
            .ovdk-vibe-h .ovdk-i { color: var(--accent, #3b82f6); margin-left: 6px; }
            .ovdk-vibe-list { list-style: none; padding: 2px 6px 6px; margin: 0; display: grid; gap: 2px; }
            .ovdk-vibe-list button { width: 100%; min-height: 56px; display: grid; grid-template-columns: 36px minmax(0,1fr) auto; grid-template-rows: auto auto; gap: 2px 12px; align-items: center; padding: 9px 10px; border: 0; border-radius: 14px; background: transparent; color: var(--text-primary,#ececf1); text-align: left; cursor: pointer; font: inherit; }
            .ovdk-vibe-list .ovdk-vibe-site { grid-row: 1 / 3; width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; background: color-mix(in srgb, var(--accent, #3b82f6) 14%, transparent); color: var(--accent-light, var(--accent, #60a5fa)); }
            .ovdk-vibe-list .ovdk-vibe-site svg { width: 19px; height: 19px; }
            .ovdk-vibe-list b { font-size: 14px; } .ovdk-vibe-list span { font-size: 12.5px; color: var(--text-secondary, #b6b6c0); }
            .ovdk-vibe-list small { justify-self: end; }
            .ovdk-vibe-list button:hover, .ovdk-vibe-list button:focus-visible { background: var(--hover-bg,rgba(127,127,127,.12)); }
            .ovdk-vibe-list b, .ovdk-vibe-list span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .ovdk-vibe-list small, .ovdk-vibe-list time { color: var(--text-muted,#8b8b96); font-size: 12px; }
            .ovdk-vibe-back { min-width: 44px; min-height: 44px; display: grid; place-items: center; border: 0; background: transparent; color: inherit; cursor: pointer; }
            .ovdk-msg.is-vibe .ovdk-text a { color: var(--accent, #3b82f6); text-decoration: underline; word-break: break-all; }
            .ovdk-typing .ovdk-text { display: inline-flex; gap: 4px; align-items: center; padding: 10px 12px; }
            .ovdk-typing i { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted, #8b8b96); animation: ovdk-hop 1s ease-in-out infinite; }
            .ovdk-typing i:nth-child(2) { animation-delay: .15s; } .ovdk-typing i:nth-child(3) { animation-delay: .3s; }
            /* 4.220.0 (the owner, 11-12: "sleek … organized … sized well … without huge spaces … uses the full space … icons for
               everything"): a header that says what Vibe is, a greeting at the top, the starters as rows with their marks, and the
               shared composer's two-row shape. */
            .ovdk-vibe-h { gap: 8px; padding: 6px 8px; min-height: 56px; box-sizing: border-box; }
            .ovdk-vibe-h .ovdk-vibe-back { width: 40px; height: 40px; min-width: 40px; min-height: 40px; border-radius: 12px; color: var(--text-secondary, #b6b6c0); }
            .ovdk-vibe-h .ovdk-vibe-back:hover { background: color-mix(in srgb, var(--text-primary, #ececf1) 7%, transparent); color: var(--text-primary, #ececf1); }
            .ovdk-vibe-back svg { width: 17px; height: 17px; } .ovdk-chip-go svg { width: 13px; height: 13px; }
            .ovdk-vibe-mark { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 11px; color: #fff;
                background: linear-gradient(135deg, color-mix(in srgb, var(--accent, #3b82f6) 90%, #a855f7), color-mix(in srgb, #a855f7 85%, var(--accent, #3b82f6))); box-shadow: 0 4px 14px color-mix(in srgb, #a855f7 28%, transparent); }
            .ovdk-vibe-mark svg { width: 19px; height: 19px; }
            .ovdk-vibe-mark.is-big { width: 46px; height: 46px; border-radius: 14px; }
            .ovdk-vibe-mark.is-big svg { width: 24px; height: 24px; }
            .ovdk-vibe-name { flex: 1; min-width: 0; display: grid; line-height: 1.2; }
            .ovdk-vibe-name b { font-size: 15px; }
            .ovdk-vibe-name small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted, #8b8b96); font-size: 12px; }
            .ovdk-vibe-h .ovdk-ib { margin-left: 0; width: 40px; height: 40px; border-radius: 12px; background: transparent; color: var(--text-secondary, #b6b6c0); }
            .ovdk-vibe-h .ovdk-ib:hover, .ovdk-vibe-h .ovdk-ib:focus-visible { background: color-mix(in srgb, var(--text-primary, #ececf1) 7%, transparent); color: var(--text-primary, #ececf1); }
            .ovdk-vibe-h .ovdk-vibe-fresh { color: var(--accent-light, var(--accent, #60a5fa)); }
            .ovdk-vibe-start { list-style: none; display: grid; gap: 14px; padding: 14px 4px 6px; color: var(--text-muted, #8b8b96); font-size: 13.5px; line-height: 1.45; text-align: left; }
            .ovdk-vibe-hello { display: flex; align-items: center; gap: 12px; padding: 0 4px; }
            .ovdk-vibe-hello-t { min-width: 0; display: grid; gap: 2px; }
            .ovdk-vibe-start b { color: var(--text-primary, #ececf1); font-size: 16.5px; letter-spacing: -.01em; }
            .ovdk-chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: 6px; margin: 0; }
            .ovdk-chip { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; min-height: 52px; padding: 8px 10px 8px 8px; border-radius: 14px;
                border: 1px solid var(--border, rgba(255,255,255,.1)); background: color-mix(in srgb, var(--text-primary, #ececf1) 3%, transparent); color: var(--text-primary, #ececf1);
                font: inherit; font-size: 14px; text-align: left; cursor: pointer; transition: border-color var(--ov-dur-2, .2s) ease, background-color var(--ov-dur-2, .2s) ease; }
            .ovdk-chip:hover, .ovdk-chip:focus-visible { border-color: color-mix(in srgb, var(--accent, #3b82f6) 55%, transparent); background: color-mix(in srgb, var(--accent, #3b82f6) 9%, transparent); outline: none; }
            .ovdk-chip-ic { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; color: var(--accent-light, var(--accent, #60a5fa)); background: color-mix(in srgb, var(--accent, #3b82f6) 14%, transparent); }
            .ovdk-chip-ic svg { width: 18px; height: 18px; }
            .ovdk-chip-t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .ovdk-chip-go { display: grid; color: var(--text-muted, #8b8b96); }
            /* The box: the words on top over the full width, the tools and a round send under them. */
            .ovdk-send.ovdk-send--two { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; padding: 6px 6px 6px 8px; border-radius: 20px; }
            .ovdk-send--two textarea { padding: 8px 6px 4px; min-height: 40px; font-size: 15.5px; }
            .ovdk-send-tools { display: flex; align-items: center; gap: 2px; min-width: 0; }
            .ovdk-send-tools .ovdk-attach, .ovdk-send-tools .ovdk-mic { width: 40px; height: 40px; border-radius: 12px; color: var(--accent-light, var(--accent, #60a5fa)); }
            .ovdk-send-tools .ovdk-attach:hover, .ovdk-send-tools .ovdk-mic:hover { background: color-mix(in srgb, var(--accent, #3b82f6) 12%, transparent); }
            .ovdk-send-tools .ovdk-attach svg, .ovdk-send-tools .ovdk-mic svg { width: 20px; height: 20px; }
            .ovdk-send-tools .ovdk-go { margin-left: auto; width: 40px; height: 40px; border-radius: 50%; }
            .ovdk-send-tools .ovdk-go svg { width: 18px; height: 18px; stroke-width: 2.2; }
            .ovdk-msg.is-vibe .ovdk-text a { word-break: normal; overflow-wrap: anywhere; }
            .ovdk-res-c { grid-template-columns: auto minmax(0, 1fr); }
            .ovdk-res-c .ovdk-res-a { grid-column: 2; }
            .ovdk-mic, .ovdk-attach { width: 44px; height: 44px; flex: none; border: 0; border-radius: 12px; cursor: pointer; display: grid; place-items: center; background: transparent; color: var(--text-muted, #8b8b96); touch-action: none; }
            .ovdk-attach:hover { color: var(--text-primary,#ececf1); }
            .ovdk-mic:hover { color: var(--text-primary, #ececf1); }
            .ovdk-mic.is-on { color: var(--on-accent, #fff); background: var(--live-red, #e5484d); box-shadow: 0 0 0 4px color-mix(in srgb, var(--live-red, #e5484d) 28%, transparent); }
            .ovdk-res { display: grid; gap: 6px; margin-top: 6px; max-width: 100%; }
            .ovdk-res-c { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 4px 10px; padding: 8px 10px; border-radius: 12px;
                border: 1px solid color-mix(in srgb, var(--accent, #3b82f6) 35%, var(--border, rgba(255,255,255,.12))); background: color-mix(in srgb, var(--accent, #3b82f6) 8%, transparent); }
            .ovdk-res-c .ovdk-i { color: var(--accent, #3b82f6); }
            .ovdk-res-t { min-width: 0; font-size: 13px; line-height: 1.35; color: var(--text-primary, #ececf1); }
            .ovdk-res-t b { font-weight: 750; }
            .ovdk-res-t small { display: block; color: var(--text-muted, #8b8b96); font-size: 12px; }
            .ovdk-res-a { display: flex; gap: 4px; }
            .ovdk-res-a button, .ovdk-res-a a { min-height: 30px; padding: 0 10px; border-radius: 999px; border: 1px solid var(--border, rgba(255,255,255,.12)); background: transparent;
                color: var(--text-primary, #ececf1); font: inherit; font-size: 12.5px; font-weight: 650; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
            .ovdk-res-a button:hover, .ovdk-res-a a:hover { border-color: var(--accent, #3b82f6); }
            .ovdk-res-a button:disabled { opacity: .55; cursor: default; }
            .ovdk-res-c.is-stopped { border-color: var(--border, rgba(255,255,255,.12)); background: transparent; }
            .ovdk-res-c.is-stopped .ovdk-i, .ovdk-res-c.is-stopped .ovdk-res-t { color: var(--text-muted, #8b8b96); }
`;
    let ctx = null, G = {};
    // 4.203.0 (ask 349, "a better composer system unified across all sites"): Vibe's box is the one composer too, for
    // drafts, "/" commands and your own, the marks, what sends and your settings; its picture keeps its own upload.
    const selfSrc = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
    const VIBE_REV = { 'ov-composer.js': '203e770ec00f' };
    function joinComposer(form) {
        if (!form || form.ownerDocument !== document) return;   // a popped-out Dock keeps its plain box
        form.setAttribute('data-ovc-no-files', '');
        const go = () => { try { if (root.OpenVibeComposer && form.isConnected) root.OpenVibeComposer.enhance(form); } catch (e) { console.error(e); } };
        if (root.OpenVibeComposer) { go(); return; }
        const m = /^(https?:\/\/[^?#]*\/)dock-vibe(?:\.[0-9a-f]{6,})?\.js(?:[?#]|$)/.exec(selfSrc);
        if (!m) return;
        let sc = document.getElementById('ov-composer-script');
        if (!sc) { sc = document.createElement('script'); sc.id = 'ov-composer-script'; sc.async = true; sc.src = m[1] + 'ov-composer.js' + (VIBE_REV['ov-composer.js'] ? '?v=' + VIBE_REV['ov-composer.js'] : ''); document.head.appendChild(sc); }
        sc.addEventListener('load', go, { once: true });
    }
    const icon = (path) => { const s = h('span', 'ovdk-i'); s.innerHTML = svg(path); return s; };
    /** A round icon button with its name as label and tooltip. */
    const iconButton = (tag, cls, path, label) => { const b = h(tag, cls); if (tag === 'button') b.type = 'button'; b.setAttribute('aria-label', label); b.setAttribute('data-ov-tip', label); b.title = label; b.innerHTML = svg(path); return b; };
    /** Open Vibe in OpenVibe.Chat, as an icon (the thread's own address when one is open). */
    const awayLink = () => { const a = iconButton('a', 'ovdk-ib ovdk-away', V.open, 'Open in Chat'); a.href = 'https://openvibe.chat/vibe'; a.target = '_blank'; a.rel = 'noopener'; return a; };

    // ── Vibe (plan L48 V2; the owner, 11-01: "access your agent or the AI… from across all websites… use a voice
    // feature to tell it to set a reminder… have a conversation with your Vibe AI") ──
    // The same conversation as openvibe.chat/vibe, through Chat's /api/vibe with the person's Network token: what is
    // asked on Live carries on on Chat and back. Vibe answers in the background; the tab waits for it (a quick poll
    // for a minute and a half after a message, then every 15 s while the tab is open). The mic is the browser's own
    // speech recognition, hold to talk or Alt+V, and only while the person asks: no wake word, never always on. A
    // browser without it (Firefox) records instead, up to 30 s, and Chat's /api/vibe/listen turns that into text
    // (OpenVibe.AI's speech-to-text on this network's own machines; the recording is never kept).
    // Everything is set as text; a link is a link only when it is https.
    const vibe = { panel: null, chat: null, view: 'list', fresh: false, msgs: [], last: 0, timer: 0, busy: false, waitUntil: 0, rec: null, talk: null, generation: 0 };
    const SR = root.SpeechRecognition || root.webkitSpeechRecognition || null;
    const MR = !SR && root.MediaRecorder && root.navigator && root.navigator.mediaDevices && root.navigator.mediaDevices.getUserMedia ? root.MediaRecorder : null;
    const TALK = Boolean(SR || MR);
    const REC_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'];
    const REC_MAX_MS = 30000;
    const STARTERS = [
        ['bell', 'Remind me to stretch every 2 hours'],
        ['calendar', 'What is on today?'],
        ['live', 'Who is live right now?'],
        ['clock', 'Start a 25-minute focus timer'],
        ['phone', 'Remind me tomorrow at 9 to call Sam'],
        ['search', 'What is new on OpenVibe this week?'],
    ];
    function linkified(text) {
        const span = h('span', 'ovdk-text');
        String(text || '').split(/(https:\/\/[^\s<>"')]+)/).forEach((part, i) => {
            if (i % 2) { const a = h('a', '', part); a.href = part; a.target = '_blank'; a.rel = 'noopener noreferrer'; span.append(a); } else if (part) span.append(part);
        });
        return span;
    }
    const DAY = 24 * 3600 * 1000;
    /** One thing Vibe did (Chat's results on its answer): what, when, and Undo / Open. */
    function resultChip(m, r, i) {
        const set = r.action === 'set';
        const c = h('div', `ovdk-res-c${set ? '' : ' is-stopped'}`);
        c.append(icon(r.kind === 'timer' ? G.clock : G.bell));
        const t = h('div', 'ovdk-res-t');
        const what = r.kind === 'timer' ? (set ? 'Timer' : 'Timer stopped') : (set ? 'Reminder set' : 'Reminder stopped');
        t.append(h('b', '', `${what}: `), String(r.title || ''));
        if (r.when && set) t.append(h('small', '', String(r.when)));
        const a = h('div', 'ovdk-res-a');
        const young = !m.at || Date.now() - Date.parse(m.at) < DAY;
        if (set && young && Number(m.id) > 0) {
            const undo = h('button', '', 'Undo'); undo.type = 'button';
            undo.setAttribute('aria-label', `Undo: ${what} ${r.title || ''}`.trim());
            undo.addEventListener('click', async () => {
                undo.disabled = true;
                try {
                    const out = await ctx.chatCall('/api/vibe/undo', { method: 'POST', body: JSON.stringify({ message_id: Number(m.id), index: i }) });
                    m.results = (out && out.results) || m.results.map((x, k) => (k === i ? { ...x, action: 'stopped' } : x));
                    c.replaceWith(resultChip(m, m.results[i], i));
                    if (r.kind === 'timer' && ctx.refresh) ctx.refresh();
                } catch (e) {
                    undo.disabled = false; undo.textContent = e && e.status === 410 ? 'Too old to undo' : 'Try again';
                    if (e && (e.status === 409 || e.status === 410)) undo.disabled = true;
                }
            });
            a.append(undo);
        }
        if (r.url && /^https:\/\//.test(r.url)) { const o = h('a', '', 'Open'); o.href = r.url; o.target = '_blank'; o.rel = 'noopener'; a.append(o); }
        c.append(t, a);
        return c;
    }
    function results(m) {
        const box = h('div', 'ovdk-res');
        m.results.slice(0, 4).forEach((r, i) => { if (r && (r.kind === 'reminder' || r.kind === 'timer')) box.append(resultChip(m, r, i)); });
        return box;
    }
    function vbubble(m, prev) {
        const mine = m.from === 'you';
        const li = h('li', `ovdk-msg${mine ? ' is-mine' : ' is-vibe'}${prev && prev.from === m.from ? ' is-cont' : ''}`);
        if (!mine && !(prev && prev.from === m.from)) li.append(h('span', 'ovdk-who', 'Vibe'));
        li.append(linkified(m.text));
        if (!mine && Array.isArray(m.results) && m.results.length) li.append(results(m));
        if (m.at) li.title = new Date(m.at).toLocaleString();
        return li;
    }
    const age = (iso) => { const n = Date.parse(iso || ''); if (!Number.isFinite(n)) return ''; const m = Math.max(0, Math.floor((Date.now() - n) / 60000)); return m < 1 ? 'now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`; };
    async function openList() {
        const generation = ++vibe.generation;
        clearTimeout(vibe.timer); vibe.view = 'list'; vibe.chat = null;
        const panel = vibe.panel; if (!panel) return;
        panel.textContent = '';
        // No heading (ask 335, the owner: "remove the text … new conversation … an icon plus button … open in Chat a
        // little button icon"): one slim row of two icon buttons over your chats.
        const head = h('div', 'ovdk-bar');
        const newer = iconButton('button', 'ovdk-ib is-new ovdk-vibe-new', V.plus, 'New chat'); newer.addEventListener('click', () => { vibe.fresh = true; vibe.chat = null; ctx.save({ vibe: null }); openVibe(); });
        head.append(newer, awayLink());
        const scroll = h('div', 'ovdk-scroll'); const list = h('ul', 'ovdk-vibe-list');
        scroll.append(list); panel.append(head, scroll);
        try {
            const out = await ctx.chatCall('/api/vibe/conversations');
            if (generation !== vibe.generation || vibe.view !== 'list' || vibe.panel !== panel) return;
            const conversations = Array.isArray(out.conversations) ? out.conversations : [];
            if (!conversations.length) list.append(h('li', 'ovdk-none', 'Your chats with Vibe will appear here. Press + to start one.'));
            conversations.forEach((c) => {
                const li = h('li'), b = h('button'); b.type = 'button';
                const title = h('b', '', c.name || 'Conversation'); const time = h('time', '', age(c.last_message_at));
                const line = h('span', '', c.last_line || 'No messages yet');
                // The site it began on, by name ("Blog", not openvibe.blog), beside the time.
                const host = String(c.site || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
                const name = host ? (/^openvibe\.([a-z]+)$/.exec(host) || [])[1] : '';
                const site = h('small', '', name ? name.charAt(0).toUpperCase() + name.slice(1) : host);
                const mark = h('span', 'ovdk-vibe-site'); mark.append(icon(G.vibe));
                b.append(mark, title, time, line, site);
                b.setAttribute('aria-label', `${c.name || 'Conversation'}, ${age(c.last_message_at)}`);
                b.addEventListener('click', () => { vibe.fresh = false; vibe.chat = { slug: c.slug }; ctx.save({ vibe: { slug: c.slug, at: new Date().toISOString() } }); openVibe(); });
                li.append(b); list.append(li);
            });
        } catch (e) { if (generation === vibe.generation) list.append(h('li', 'ovdk-none', e && e.status === 401 ? 'Sign in to see your conversations.' : 'Conversations did not load. Open Vibe again to retry.')); }
    }
    async function openVibe() {
        const generation = ++vibe.generation;
        clearTimeout(vibe.timer);
        vibe.view = 'conversation';
        const panel = vibe.panel; if (!panel) return;
        vibe.msgs = []; vibe.last = 0;
        panel.textContent = '';
        const head = h('div', 'ovdk-thread-h ovdk-vibe-h');
        const title = h('b', '', 'Vibe');
        const back = iconButton('button', 'ovdk-vibe-back', V.back, 'Back to your chats'); back.addEventListener('click', () => { ctx.save({ vibe: null }); openList(); });
        const away = awayLink();
        const mark = h('span', 'ovdk-vibe-mark'); mark.innerHTML = svg(V.spark);
        const name = h('span', 'ovdk-vibe-name'); name.append(title, h('small', '', 'Your AI on every OpenVibe site'));
        const fresh = iconButton('button', 'ovdk-ib ovdk-vibe-fresh', V.plus, 'New chat');
        fresh.addEventListener('click', () => { vibe.fresh = true; vibe.chat = null; ctx.save({ vibe: null }); openVibe(); });
        head.append(back, mark, name, fresh, away);
        const list = h('ol', 'ovdk-msgs'); list.setAttribute('aria-live', 'polite');
        const scroll = h('div', 'ovdk-scroll ovdk-thread'); scroll.append(list);
        const typing = h('li', 'ovdk-msg is-vibe ovdk-typing'); typing.innerHTML = '<span class="ovdk-text"><i></i><i></i><i></i></span>'; typing.setAttribute('aria-label', 'Vibe is writing');
        const form = h('form', 'ovdk-send');
        const box = h('textarea'); box.rows = 1; box.maxLength = 8000; box.placeholder = TALK ? 'Ask Vibe, or hold the mic' : 'Ask Vibe anything'; box.setAttribute('aria-label', 'Message Vibe');
        const go = h('button', 'ovdk-go'); go.type = 'submit'; go.setAttribute('aria-label', 'Send'); go.append(icon(G.send));
        const err = h('p', 'ovdk-err'); err.hidden = true;
        const reason = (e) => e && e.status === 401 ? 'Your sign in expired. Sign in again to continue.'
            : e && e.status === 429 ? 'Too many requests were sent. Wait a minute, then retry.'
            : e && e.code === 'vibe.off' ? 'Vibe is unavailable right now. Retry when it returns.'
            : e && e.status === 503 ? 'The AI service is unavailable right now. Retry shortly.'
            : 'The request could not reach Vibe. Check your connection and retry.';
        const showFailure = (e, retry) => { err.textContent = `Vibe did not answer: ${reason(e)} `; err.hidden = false;
            if (retry) { const b = h('button', '', 'Retry'); b.type = 'button'; b.addEventListener('click', async () => { b.disabled = true; try { await retry(); } catch (x) { showFailure(x, retry); } finally { b.disabled = false; } }); err.append(b); }
        };
        const attach = iconButton('button', 'ovdk-attach', V.image, 'Attach a picture');
        const file = h('input'); file.type = 'file'; file.accept = 'image/*'; file.hidden = true;
        attach.addEventListener('click', () => file.click());
        file.addEventListener('change', async () => {
            const picture = file.files && file.files[0]; if (!picture) return;
            attach.disabled = true; err.hidden = true;
            try {
                const path = vibe.chat ? `/api/chat/rooms/${encodeURIComponent(vibe.chat.slug)}/pictures` : '/api/chat/vibe/picture';
                const out = await ctx.chatCall(path, { method: 'POST', body: picture, type: picture.type || 'image/jpeg' });
                if (out.room && out.room.slug) { vibe.chat = { slug: out.room.slug }; vibe.fresh = false; ctx.save({ vibe: { slug: out.room.slug, at: new Date().toISOString() } }); }
                openVibe();
            } catch { err.textContent = 'That picture could not be attached. Try again.'; err.hidden = false; }
            finally { attach.disabled = false; file.value = ''; }
        });
        // 350: Build it in Code. What you wrote, else Vibe's last answer, goes to the Code part as a new task's words.
        const build = iconButton('button', 'ovdk-attach ovdk-build', V.code, 'Build it in Code');
        build.addEventListener('click', () => {
            const last = [...vibe.msgs].reverse().find((m) => m.from !== 'you');
            const text = box.value.trim() || (last && last.text) || '';
            if (!text) { box.focus(); return; }
            build.dispatchEvent(new CustomEvent('ov-dock:part', { bubbles: true, detail: { part: 'code', text: text.slice(0, 16000) } }));
        });
        form.classList.add('ovdk-send--two');
        const tools = h('div', 'ovdk-send-tools');
        tools.append(attach, file, build);
        let mic = null;
        if (TALK) {
            mic = h('button', 'ovdk-mic'); mic.type = 'button'; mic.append(icon(G.mic));
            mic.setAttribute('aria-label', 'Talk to Vibe: hold, or press Alt+V'); mic.title = 'Hold to talk (Alt+V)'; mic.setAttribute('aria-pressed', 'false');
            tools.append(mic);
        }
        go.textContent = ''; go.innerHTML = svg(V.send);
        tools.append(go);
        form.append(box, tools);
        panel.append(head, scroll, err, form);
        const fit = () => { box.style.height = 'auto'; box.style.height = `${Math.min(box.scrollHeight, 140)}px`; };
        vibe.fill = (text) => { box.value = String(text || '').slice(0, 8000); fit(); try { box.focus(); box.setSelectionRange(box.value.length, box.value.length); } catch { /* */ } };
        if (vibe.pendingAsk) { vibe.fill(vibe.pendingAsk); vibe.pendingAsk = null; }
        box.addEventListener('input', fit);
        box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true })); } });

        async function send(text) {
            if (!text || vibe.busy) return;
            vibe.busy = true; go.disabled = true; err.hidden = true;
            try {
                let timezone = null; try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* */ }
                const out = await ctx.chatCall('/api/vibe/ask', { method: 'POST', body: JSON.stringify({ message: text, slug: vibe.chat ? vibe.chat.slug : undefined, fresh: vibe.fresh, timezone }) });
                if (generation !== vibe.generation) return;
                if (out.chat) { vibe.chat = out.chat; vibe.fresh = false; away.href = out.chat.url; ctx.save({ vibe: { slug: out.chat.slug, at: new Date().toISOString() } }); }
                box.value = ''; fit();
                const empty = list.querySelector('.ovdk-vibe-start'); if (empty) empty.remove();
                if (out.message && !vibe.msgs.some((x) => x.id === out.message.id)) { list.append(vbubble(out.message, vibe.msgs[vibe.msgs.length - 1])); vibe.msgs.push(out.message); vibe.last = Math.max(vibe.last, out.message.id || 0); }
                vibe.waitUntil = Date.now() + 90000;
                list.append(typing);
                scroll.scrollTop = scroll.scrollHeight;
                clearTimeout(vibe.timer); vibe.timer = setTimeout(() => pull(), 1200);
            } catch (x) {
                showFailure(x, () => send(text));
            } finally { vibe.busy = false; go.disabled = false; box.focus(); }
        }
        form.addEventListener('submit', (e) => { e.preventDefault(); send(box.value.trim()); });
        joinComposer(form);

        async function pull(first) {
            let got;
            try {
                got = vibe.fresh && !vibe.chat ? { chat: null, messages: [] } : await ctx.chatCall(`/api/vibe/chat${vibe.chat ? `?slug=${encodeURIComponent(vibe.chat.slug)}${vibe.last ? `&after=${vibe.last}` : ''}` : ''}`);
            } catch (e) {
                if (first && generation === vibe.generation) { list.textContent = ''; showFailure(e, () => pull(true)); }
                return;
            }
            if (generation !== vibe.generation || !ctx.active() || vibe.panel !== panel) return;
            if (got.chat) { vibe.chat = got.chat; away.href = got.chat.url; title.textContent = got.chat.name || 'Vibe'; }
            if (first) list.textContent = '';
            const atEnd = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 40;
            let answered = false;
            (got.messages || []).forEach((m) => {
                if (vibe.msgs.some((x) => x.id === m.id)) return;
                list.insertBefore(vbubble(m, vibe.msgs[vibe.msgs.length - 1]), typing.parentNode === list ? typing : null);
                vibe.msgs.push(m); vibe.last = Math.max(vibe.last, Number(m.id) || 0);
                if (m.from === 'vibe') answered = true;
                if (!first && Array.isArray(m.results) && m.results.some((r) => r && r.kind === 'timer') && ctx.refresh) ctx.refresh();
            });
            if (answered || Date.now() > vibe.waitUntil) {
                typing.remove();
                if (!answered && vibe.waitUntil && Date.now() > vibe.waitUntil) {
                    showFailure({ status: 503 }, vibe.chat ? async () => { await ctx.chatCall(`/api/chat/vibe/${encodeURIComponent(vibe.chat.slug)}/retry`, { method: 'POST', body: '{}' }); err.hidden = true; vibe.waitUntil = Date.now() + 90000; list.append(typing); pull(); } : null);
                }
                vibe.waitUntil = 0;
            }
            if (first && !vibe.msgs.length) {
                const start = h('li', 'ovdk-vibe-start');
                const hello = h('div', 'ovdk-vibe-hello');
                const big = h('span', 'ovdk-vibe-mark is-big'); big.innerHTML = svg(V.spark);
                const words = h('div', 'ovdk-vibe-hello-t');
                words.append(h('b', '', 'What can I do for you?'), h('span', '', TALK ? 'Ask anything, set reminders and timers, find what is live. Hold the mic to talk.' : 'Ask anything, set reminders and timers, find what is live.'));
                hello.append(big, words);
                const chips = h('div', 'ovdk-chips'); chips.setAttribute('role', 'list');
                STARTERS.forEach(([ic, s]) => {
                    const c = h('button', 'ovdk-chip'); c.type = 'button'; c.setAttribute('role', 'listitem');
                    const m = h('span', 'ovdk-chip-ic'); m.innerHTML = svg(V[ic]);
                    const t = h('span', 'ovdk-chip-t', s);
                    const go2 = h('span', 'ovdk-chip-go'); go2.innerHTML = svg(V.chevron);
                    c.append(m, t, go2);
                    c.addEventListener('click', () => send(s)); chips.append(c);
                });
                start.append(hello, chips);
                list.append(start);
            }
            if (first && !vibe.msgs.length) scroll.scrollTop = 0;
            else if (first || atEnd || answered) scroll.scrollTop = scroll.scrollHeight;
            clearTimeout(vibe.timer);
            if (ctx.active()) vibe.timer = setTimeout(() => pull(), vibe.waitUntil ? 1500 : 15000);
        }

        // The mic: hold to talk (or a click to start and another to stop), Alt+V from anywhere while the Dock is open.
        if (mic) {
            let said = '', heard = false;
            const stop = () => { if (vibe.rec) { try { vibe.rec.stop(); } catch { /* */ } } };
            const on = (yes) => { mic.classList.toggle('is-on', yes); mic.setAttribute('aria-pressed', yes ? 'true' : 'false'); };
            const fail = (text) => { err.textContent = text; err.hidden = false; };
            // No speech recognition in this browser: record, then Chat's /api/vibe/listen says what was said.
            const record = async () => {
                const type = REC_TYPES.find((t) => { try { return MR.isTypeSupported(t); } catch { return false; } }) || '';
                let stream;
                try { stream = await root.navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) {
                    return fail(e && e.name === 'NotAllowedError' ? 'The microphone is off for this site: allow it in the browser to talk to Vibe.' : 'No microphone was found.');
                }
                const chunks = [];
                let r;
                try { r = new MR(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 }); } catch { stream.getTracks().forEach((t) => t.stop()); return fail('This browser cannot record here.'); }
                const cap = setTimeout(stop, REC_MAX_MS);
                r.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
                r.onstop = async () => {
                    clearTimeout(cap); vibe.rec = null; on(false);
                    stream.getTracks().forEach((t) => t.stop());
                    const kind = String(r.mimeType || type || 'audio/webm').split(';')[0];
                    const blob = new Blob(chunks, { type: kind });
                    if (blob.size < 800) { box.placeholder = 'Ask Vibe, or hold the mic'; return; }
                    box.placeholder = 'Working out what you said…'; mic.disabled = true;
                    try {
                        const lang = String(document.documentElement.lang || root.navigator.language || 'en').slice(0, 2).toLowerCase();
                        const out = await ctx.chatCall(`/api/vibe/listen?lang=${encodeURIComponent(/^[a-z]{2}$/.test(lang) ? lang : 'en')}`, { method: 'POST', body: blob, type: kind });
                        const said = String((out && out.text) || '').trim();
                        if (said) { box.value = said; fit(); send(said); } else fail('I could not hear that. Try again, a little closer.');
                    } catch (e) {
                        fail(e && e.status === 429 ? 'That is a lot of talking for one minute: type it, or try again shortly.' : e && e.status === 413 ? 'Keep it under 30 seconds.' : 'I could not hear that just now. Try again, or type it.');
                    } finally { mic.disabled = false; box.placeholder = 'Ask Vibe, or hold the mic'; }
                };
                vibe.rec = r; err.hidden = true; on(true); box.placeholder = 'Listening… let go or tap to send';
                try { r.start(); } catch { vibe.rec = null; on(false); stream.getTracks().forEach((t) => t.stop()); }
            };
            const start = () => {
                if (vibe.rec) return stop();
                if (!SR) return record();
                const r = new SR();
                r.lang = document.documentElement.lang || navigator.language || 'en-US';
                r.interimResults = true; r.continuous = false;
                said = ''; heard = false;
                r.onresult = (ev) => {
                    let text = '';
                    for (let i = 0; i < ev.results.length; i++) text += ev.results[i][0].transcript;
                    said = text.trim(); heard = true; box.value = said; fit();
                };
                r.onerror = (ev) => {
                    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { err.textContent = 'The microphone is off for this site: allow it in the browser to talk to Vibe.'; err.hidden = false; }
                };
                r.onend = () => {
                    vibe.rec = null; mic.classList.remove('is-on'); mic.setAttribute('aria-pressed', 'false');
                    if (heard && said) send(said);
                };
                vibe.rec = r;
                mic.classList.add('is-on'); mic.setAttribute('aria-pressed', 'true');
                try { r.start(); } catch { vibe.rec = null; mic.classList.remove('is-on'); }
            };
            let held = 0;
            mic.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; held = Date.now(); start(); });
            mic.addEventListener('pointerup', () => { if (held && Date.now() - held > 400) stop(); held = 0; });
            mic.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(); } });
            vibe.talk = start;
        }
        list.append(h('li', 'ovdk-wait', null));
        list.firstChild.innerHTML = '<span></span>';
        await pull(true);
        // A touch screen does not get the keyboard on opening (11-09, the owner: it "immediately opens the keyboard… you
        // can't see the chat input or what it did"): the answer and the box show first; a tap on the box types.
        if (!(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)) setTimeout(() => { try { box.focus({ preventScroll: true }); } catch { /* */ } }, 0);
    }

    function mount(panel, c) {
        ctx = c || {};
        G = { mic: V.mic, ...(ctx.icons || {}) };
        const st = typeof ctx.styles === 'function' ? ctx.styles() : null;
        if (st && !st.textContent.includes('.ovdk-vibe-start')) st.textContent += CSS;
        else if (!st && !document.getElementById('ovdk-vibe-styles')) { const s = document.createElement('style'); s.id = 'ovdk-vibe-styles'; s.textContent = CSS; document.head.appendChild(s); }
        vibe.panel = panel;
        // The Chats tab's AI chats row asks for the list, not for the last conversation.
        const onList = ctx.wantList ? ctx.wantList() : false;
        const selected = ctx.state && ctx.state().vibe;
        if (!onList && selected && selected.slug && Date.now() - Date.parse(selected.at) < 20 * 60000) { vibe.chat = { slug: selected.slug }; openVibe(); }
        else openList();
        return {
            refresh: () => { vibe.panel = panel; const list = ctx.wantList ? ctx.wantList() : false; if (list) return openList(); return vibe.view === 'list' ? openList() : openVibe(); },
            list: () => { vibe.panel = panel; return openList(); },
            pause: () => { vibe.generation++; clearTimeout(vibe.timer); if (vibe.rec) { try { vibe.rec.abort(); } catch { /* */ } } },
            talk: () => { if (vibe.talk) vibe.talk(); },
            // A page's "Ask your agent" (4.135.0): the question waits in the box, with its context, for the person to send.
            ask: (text) => { if (vibe.view === 'list') { vibe.pendingAsk = text; vibe.fresh = true; openVibe(); } else if (vibe.fill) vibe.fill(text); else vibe.pendingAsk = text; },
        };
    }
    root.OpenVibeDockVibe = { mount, GLYPHS: V };
})(typeof window !== 'undefined' ? window : globalThis);
