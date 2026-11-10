// ═══════════════════════════════════════════════════════════════
// OpenVibe presence (4.131.0; the owner, 2026-11-07: "we could have online status, especially in DMs … Discord …
// people should be able to easily change it off"). navbar.js loads this beside itself for a signed-in person.
//
//   OpenVibePresence.start({ token: () => string, apiBase, user })   idempotent: navbar calls it after every render
//   OpenVibePresence.open()                                          the status picker
//
// Your dot: a coloured dot on your picture in the bar — online, away, do not disturb, invisible, live — from
// Network's own answer (network.presence@1, the self view). A heartbeat keeps you online while a tab of any
// OpenVibe site is visible: POST <apiBase>/api/v1/me/presence/heartbeat, once a minute across all tabs of this site
// (localStorage ov-presence-beat), { idle: true } after five minutes without a key, click, scroll or touch, so
// Network turns you Away; the first input after that beats at once. A hidden tab never beats (offline in 3 min).
// Your status: Online (automatic), Do not disturb (no pings; people see you are busy), Invisible (offline to
// everyone, nothing else changes), and a short line of your own. PUT <apiBase>/api/v1/me/presence
// (network.presence-update-request@1). Only people you follow or message can see it (Network's rule).
// Desktop: a card under the bar. Phones: a sheet from the bottom over a scrim. Escape, × or outside closes it.
// ═══════════════════════════════════════════════════════════════
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OpenVibePresence) return;
    const BEAT_MS = 60000, IDLE_MS = 5 * 60000;
    const STATES = {
        online: ['Online', '#22c55e'], away: ['Away', '#f59e0b'], dnd: ['Do not disturb', '#ef4444'],
        invisible: ['Invisible', '#94a3b8'], offline: ['Status hidden', '#94a3b8'], live: ['Live now', '#ef4444'],
    };
    const CHOICES = [
        ['auto', 'online', 'Online', 'Shown as online while you are here, away when you step away'],
        ['dnd', 'dnd', 'Do not disturb', 'No pings or message sounds; people see you are busy'],
        ['invisible', 'invisible', 'Invisible', 'You look offline to everyone, and can still do everything'],
    ];
    let o = null, me = null, timer = 0, lastInput = Date.now(), lastBeat = 0, itemId = null, pop = null, lastFocus = null;
    const store = {
        get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window */ } },
    };
    const keyOf = () => `ov-presence-me:${(o && o.user && (o.user.subject || o.user.id || o.user.username)) || ''}`;
    function call(path, init) {
        const t = o && o.token && o.token();
        if (!t || typeof fetch !== 'function') return Promise.reject(new Error('signed out'));
        return fetch(`${o.apiBase}${path}`, Object.assign({ credentials: 'omit' }, init, { headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } }))
            .then((r) => (r.ok ? r.json() : Promise.reject(Object.assign(new Error(`HTTP ${r.status}`), { status: r.status }))));
    }

    function injectStyles() {
        if (document.getElementById('ov-presence-styles')) return;
        const s = document.createElement('style');
        s.id = 'ov-presence-styles';
        s.textContent = `
            .ovp-wrap { position: relative; display: inline-flex; flex: none; }
            .ovp-dot { position: absolute; right: -1px; bottom: -1px; width: 11px; height: 11px; border-radius: 50%; box-sizing: border-box; pointer-events: none;
                background: var(--ovp, #22c55e); border: 2.5px solid var(--bg-secondary, #252530); }
            .ovp-dot[data-state="invisible"], .ovp-dot[data-state="offline"] { background: var(--bg-secondary, #252530); box-shadow: inset 0 0 0 2px var(--ovp); }
            .ovp-dot[data-state="dnd"]::after { content: ""; position: absolute; left: 1.5px; right: 1.5px; top: 50%; height: 1.5px; margin-top: -.75px; border-radius: 2px; background: var(--bg-secondary, #252530); }
            .ovp-dot[data-state="away"] { background: radial-gradient(circle at 70% 30%, var(--bg-secondary, #252530) 0 2.2px, var(--ovp) 2.6px); }
            .ovp-scrim { position: fixed; inset: 0; z-index: 10040; background: rgba(0, 0, 0, .45); animation: ovp-in .18s ease-out; }
            .ovp-pop { position: fixed; z-index: 10041; top: 60px; right: 12px; width: 340px; max-width: calc(100vw - 24px); box-sizing: border-box; display: grid; gap: 12px; padding: 16px;
                border-radius: 18px; border: 1px solid var(--border, #333340); background: var(--bg-card, var(--bg-secondary, #1b1d27)); color: var(--text-primary, #ececf1);
                font: 14px/1.4 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; box-shadow: 0 18px 50px rgba(0, 0, 0, .45); animation: ovp-pop .18s cubic-bezier(.2, .8, .2, 1); }
            .ovp-head { display: flex; align-items: center; gap: 10px; }
            .ovp-head b { flex: 1; font-size: 15px; }
            .ovp-x { display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 999px; background: transparent; color: var(--text-muted, #9aa0ae); font-size: 20px; cursor: pointer; }
            .ovp-x:hover { background: color-mix(in srgb, var(--text-primary, #fff) 8%, transparent); color: var(--text-primary, #fff); }
            .ovp-text { display: flex; gap: 8px; margin: 0; }
            .ovp-text input { flex: 1; min-width: 0; height: 40px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--border, #333340); background: var(--bg-primary, #12141b); color: inherit; font: inherit; }
            .ovp-text input:focus { outline: 2px solid var(--accent, #3b82f6); outline-offset: 0; border-color: transparent; }
            .ovp-btn { height: 40px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--border, #333340); background: transparent; color: inherit; font: inherit; font-weight: 650; cursor: pointer; }
            .ovp-btn:hover { background: color-mix(in srgb, var(--text-primary, #fff) 7%, transparent); }
            .ovp-opts { display: grid; gap: 6px; }
            .ovp-opt { display: grid; grid-template-columns: 14px minmax(0, 1fr); align-items: center; column-gap: 12px; width: 100%; padding: 11px 12px; border-radius: 14px; text-align: left;
                border: 1px solid var(--border, #333340); background: transparent; color: inherit; font: inherit; cursor: pointer; transition: border-color .15s, background .15s; }
            .ovp-opt:hover { border-color: color-mix(in srgb, var(--accent, #3b82f6) 45%, var(--border, #333340)); }
            .ovp-opt[aria-checked="true"] { border-color: var(--accent, #3b82f6); background: color-mix(in srgb, var(--accent, #3b82f6) 10%, transparent); }
            .ovp-opt:focus-visible, .ovp-btn:focus-visible, .ovp-x:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
            .ovp-opt .ovp-dot { position: static; grid-row: span 2; width: 14px; height: 14px; border-color: var(--bg-card, #1b1d27); }
            .ovp-opt b { font-size: 14.5px; }
            .ovp-opt small { font-size: 12.5px; color: var(--text-muted, #9aa0ae); }
            .ovp-foot { margin: 0; font-size: 12.5px; color: var(--text-muted, #9aa0ae); }
            .ovp-say { margin: 0; min-height: 1em; font-size: 12.5px; color: var(--text-muted, #9aa0ae); }
            .ovp-say:empty { display: none; }
            @keyframes ovp-in { from { opacity: 0; } }
            @keyframes ovp-pop { from { opacity: 0; transform: translateY(-6px) scale(.98); } }
            @keyframes ovp-sheet { from { transform: translateY(100%); } }
            @media (max-width: 640px) {
                .ovp-pop { top: auto; right: 0; left: 0; bottom: 0; width: auto; max-width: none; border-radius: 22px 22px 0 0; border-bottom: 0;
                    padding: 10px max(16px, env(safe-area-inset-right, 0px)) calc(18px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px)); animation: ovp-sheet .24s cubic-bezier(.2, .8, .2, 1); }
                .ovp-pop::before { content: ""; justify-self: center; width: 40px; height: 4px; border-radius: 99px; background: color-mix(in srgb, var(--text-primary, #fff) 25%, transparent); }
                .ovp-opt { min-height: 56px; }
            }
            `;
        document.head.appendChild(s);
    }

    const stateOf = (v) => (v ? (v.live ? 'live' : v.state) : null);
    function dot(state) {
        const d = document.createElement('span');
        d.className = 'ovp-dot';
        d.setAttribute('aria-hidden', 'true');
        d.dataset.state = state;
        d.style.setProperty('--ovp', (STATES[state] || STATES.offline)[1]);
        return d;
    }
    /** Your dot on your picture in the bar (the bar re-renders: this runs again each time). */
    function paint() {
        const img = document.getElementById('openvibe-avatar-btn');
        const state = stateOf(me);
        if (!img || !state) return;
        let wrap = img.parentElement && img.parentElement.classList.contains('ovp-wrap') ? img.parentElement : null;
        if (!wrap) { wrap = document.createElement('span'); wrap.className = 'ovp-wrap'; img.replaceWith(wrap); wrap.appendChild(img); }
        const old = wrap.querySelector('.ovp-dot');
        const d = dot(state);
        if (old) old.replaceWith(d); else wrap.appendChild(d);
        const label = (STATES[state] || STATES.offline)[0];
        img.setAttribute('title', me && me.status_text ? `${label} · ${me.status_text}` : label);
    }
    function remember(view) {
        if (!view || !view.state) return;
        me = view;
        store.set(keyOf(), { view, at: Date.now() });
        paint();
        if (pop) drawChoices();
    }

    function beat(force) {
        if (!o || document.visibilityState === 'hidden') return;
        const shared = store.get('ov-presence-beat') || 0;
        if (!force && Date.now() - Math.max(lastBeat, Number(shared) || 0) < BEAT_MS - 5000) {
            const saved = store.get(keyOf());
            if (saved && saved.view) { me = saved.view; paint(); }
            return;
        }
        lastBeat = Date.now();
        store.set('ov-presence-beat', lastBeat);
        call('/api/v1/me/presence/heartbeat', { method: 'POST', body: JSON.stringify({ idle: Date.now() - lastInput > IDLE_MS }) })
            .then(remember).catch((e) => { if (e && e.status === 404) stop(); });
    }
    function onInput() {
        const wasIdle = Date.now() - lastInput > IDLE_MS || (me && me.state === 'away');
        lastInput = Date.now();
        if (wasIdle && Date.now() - lastBeat > 15000) beat(true);
    }
    function onVisible() { if (document.visibilityState === 'visible') beat(false); }
    function onStorage(e) { if (e && e.key === keyOf()) { const s = store.get(keyOf()); if (s && s.view) { me = s.view; paint(); } } }
    function stop() {
        clearInterval(timer); timer = 0;
        ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((t) => document.removeEventListener(t, onInput, true));
        document.removeEventListener('visibilitychange', onVisible);
        root.removeEventListener && root.removeEventListener('storage', onStorage);
    }

    // ── The picker ──────────────────────────────────────────────────────────────────────────────────────────────
    function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
    function drawChoices() {
        const box = pop && pop.querySelector('.ovp-opts');
        if (!box) return;
        const now = me ? (me.state === 'away' || me.state === 'offline' ? 'online' : me.state) : 'online';
        box.replaceChildren(...CHOICES.map(([value, state, label, help]) => {
            const b = el('button', 'ovp-opt');
            b.type = 'button';
            b.setAttribute('role', 'radio');
            b.setAttribute('aria-checked', String(now === state));
            b.dataset.value = value;
            const t = el('span');
            t.style.display = 'grid';
            t.append(el('b', '', label), el('small', '', help));
            b.append(dot(state), t);
            b.addEventListener('click', () => choose({ state: value, show_status: true }, label));
            return b;
        }));
    }
    function say(text) { const s = pop && pop.querySelector('.ovp-say'); if (s) s.textContent = text; }
    function choose(body, label) {
        say('Saving…');
        return call('/api/v1/me/presence', { method: 'PUT', body: JSON.stringify(body) })
            .then((view) => { remember(view); say(label ? `${label}.` : 'Saved.'); })
            .catch(() => say('That did not save. Check your connection and try again.'));
    }
    function close() {
        if (!pop) return;
        pop.remove(); pop = null;
        const s = document.querySelector('.ovp-scrim'); if (s) s.remove();
        document.removeEventListener('keydown', onKey, true);
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
    function open() {
        if (!o) return;
        if (pop) return close();
        injectStyles();
        lastFocus = document.activeElement;
        const scrim = el('div', 'ovp-scrim');
        scrim.addEventListener('click', close);
        pop = el('div', 'ovp-pop');
        pop.setAttribute('role', 'dialog');
        pop.setAttribute('aria-label', 'Your status');
        const head = el('div', 'ovp-head');
        const x = el('button', 'ovp-x', '×');
        x.type = 'button';
        x.setAttribute('aria-label', 'Close');
        x.addEventListener('click', close);
        head.append(el('b', '', 'Your status'), x);
        const form = el('form', 'ovp-text');
        const input = el('input');
        input.type = 'text';
        input.maxLength = 80;
        input.placeholder = 'What are you up to?';
        input.setAttribute('aria-label', 'Your status line');
        input.value = (me && me.status_text) || '';
        const save = el('button', 'ovp-btn', 'Save');
        save.type = 'submit';
        form.append(input, save);
        form.addEventListener('submit', (e) => { e.preventDefault(); choose({ status_text: input.value.trim() || null }, input.value.trim() ? 'Status line saved' : 'Status line cleared'); });
        const opts = el('div', 'ovp-opts');
        opts.setAttribute('role', 'radiogroup');
        opts.setAttribute('aria-label', 'Show me as');
        pop.append(head, form, opts, el('p', 'ovp-say'), el('p', 'ovp-foot', 'Only people you follow or message can see your status. Invisible hides it from everyone.'));
        document.body.append(scrim, pop);
        drawChoices();
        document.addEventListener('keydown', onKey, true);
        const first = pop.querySelector('.ovp-opt[aria-checked="true"]') || pop.querySelector('.ovp-opt');
        if (first) first.focus();
    }

    function start(opts) {
        if (!opts || !opts.user || opts.user.is_anon) return;
        const first = !o;
        o = opts;
        injectStyles();
        const saved = store.get(keyOf());
        if (saved && saved.view && !me) me = saved.view;
        paint();
        // One menu row in the account menu (added once; the bar redraws itself when it is added).
        if (!itemId && root.OpenVibeNavbar && root.OpenVibeNavbar.addMenuItem) {
            itemId = 'ov-presence';
            root.OpenVibeNavbar.addMenuItem({ id: itemId, label: 'Your status', icon: 'fa-circle-half-stroke', position: 'before', onClick: () => open() });
        }
        if (!first) return;
        ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((t) => document.addEventListener(t, onInput, { capture: true, passive: true }));
        document.addEventListener('visibilitychange', onVisible);
        if (root.addEventListener) root.addEventListener('storage', onStorage);
        beat(false);
        timer = setInterval(() => beat(false), BEAT_MS);
    }

    root.OpenVibePresence = { start, open, stop: () => { stop(); o = null; }, _test: { STATES, CHOICES, get me() { return me; } } };
})(typeof window !== 'undefined' ? window : globalThis);
