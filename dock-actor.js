// ═══════════════════════════════════════════════════════════════
// OpenVibe — the Dock's Actor block (Actor v3 plan, stage A3; design 2026-11-09)
//
// Your Actor at the top of the Dock's Actor tab, on every OpenVibe site. dock.js loads this file the first time that
// tab opens:
//   OpenVibeDockActor.mount(container, { token, base, active })  → { refresh(), destroy() }
//
// It reads OpenVibe.Actor's GET /api/v1/me/actor with the person's Network token (scope actor.me.read); the answers,
// pause, resume and tell are POSTs with actor.me.write. On a site every call goes through Network's same-origin relay
// (/api/frame/actor…) because every site's connect-src allows openvibe.network and refuses openvibe.actor; `base`
// reaches Actor itself in a test, and `frameBase` names the relay. Nothing is asked without a token. It shows:
//   - the Actor's face, name and state (Working, Waiting for you, Resting, Paused), Pause/Resume, and its model;
//   - Now: the step it is on in plain words, what it is looking at, the last three steps and what comes next, and the
//     cost so far today;
//   - the first thing it is asking you, with its own buttons;
//   - one line to tell it something.
// A person with no Actor sees nothing here (the tab's timeline and list stay as they are). Everything people or the
// Actor wrote is set as text, never markup. No spinner: a running step shows its words with a soft pulse.
// ═══════════════════════════════════════════════════════════════
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OpenVibeDockActor) return;

    const POLL_MS = 15000;
    const STATE = { working: 'Working', resting: 'Resting', paused: 'Paused', waiting: 'Waiting for you' };

    function styles(doc) {
        const d = doc || document;
        if (!d || d.getElementById('ovdac-styles')) return;
        const st = d.createElement('style');
        st.id = 'ovdac-styles';
        st.textContent = `
            .ovdac { display: none; flex: none; padding: 10px 10px 8px; border-bottom: 1px solid var(--border, rgba(255,255,255,.08)); }
            .ovdac.on { display: grid; gap: 8px; }
            .ovdac-head { display: flex; align-items: center; gap: 10px; min-width: 0; }
            .ovdac-face { flex: none; width: 34px; height: 34px; border-radius: 50%; overflow: hidden; display: grid; place-items: center;
                background: var(--accent, #3b82f6); color: #fff; font-weight: 800; font-size: 14px; }
            .ovdac-face img { width: 100%; height: 100%; object-fit: cover; }
            .ovdac-who { min-width: 0; flex: 1; }
            .ovdac-name { display: block; font-weight: 800; font-size: 14px; color: var(--text-primary, #ececf1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .ovdac-state { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-secondary, #b6b6c0); }
            .ovdac-state .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted, #8b8b96); }
            .ovdac-state.is-working .dot { background: var(--success, #22c55e); animation: ovdac-pulse 1.8s ease-in-out infinite; }
            .ovdac-state.is-waiting .dot { background: var(--warning, #f5a524); }
            .ovdac-btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 44px; padding: 0 14px; border-radius: 999px;
                border: 1px solid var(--border, rgba(255,255,255,.14)); background: transparent; color: var(--text-secondary, #b6b6c0);
                font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; text-decoration: none; white-space: nowrap; }
            .ovdac-btn:hover { color: var(--text-primary, #ececf1); background: color-mix(in srgb, var(--text-primary, #ececf1) 7%, transparent); }
            .ovdac-btn.is-yes { background: var(--accent-strong, var(--accent, #2563eb)); border-color: transparent; color: var(--on-accent-strong, #fff); }
            .ovdac-btn:disabled { opacity: .5; cursor: default; }
            .ovdac-now { display: grid; gap: 4px; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--text-primary, #ececf1) 4%, transparent); }
            .ovdac-step { display: flex; gap: 8px; align-items: flex-start; font-weight: 700; font-size: 13px; color: var(--text-primary, #ececf1); line-height: 1.35; }
            .ovdac-step .dot { flex: none; width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; background: var(--success, #22c55e); animation: ovdac-pulse 1.8s ease-in-out infinite; }
            .ovdac-look, .ovdac-next, .ovdac-cost { font-size: 12px; color: var(--text-muted, #8b8b96); overflow-wrap: anywhere; }
            .ovdac-done { margin: 0; padding-left: 18px; display: grid; gap: 2px; font-size: 12px; color: var(--text-secondary, #b6b6c0); }
            .ovdac-ask { display: grid; gap: 6px; padding: 10px 12px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--warning, #f5a524) 45%, transparent);
                background: color-mix(in srgb, var(--warning, #f5a524) 10%, transparent); }
            .ovdac-ask b { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: color-mix(in srgb, var(--warning, #f5a524) 70%, var(--text-primary, #ececf1)); }
            .ovdac-ask p { margin: 0; font-size: 13px; color: var(--text-primary, #ececf1); }
            .ovdac-ask .row { display: flex; flex-wrap: wrap; gap: 6px; }
            .ovdac-tell { display: flex; gap: 6px; }
            .ovdac-tell input { flex: 1; min-width: 0; min-height: 44px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--border, rgba(255,255,255,.14));
                background: var(--bg-input, transparent); color: var(--text-primary, #ececf1); font: inherit; font-size: 13px; }
            .ovdac-note { font-size: 12px; color: var(--text-muted, #8b8b96); }
            @keyframes ovdac-pulse { 50% { opacity: .4; } }
            @media (prefers-reduced-motion: reduce) { .ovdac-state.is-working .dot, .ovdac-step .dot { animation: none; } }
        `;
        (d.head || d.documentElement).appendChild(st);
    }

    const money = (n) => { const v = Number(n) || 0; return v < 0.01 && v > 0 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`; };

    function mount(container, opts = {}) {
        const d = container.ownerDocument || document;
        styles(d);
        const o = { ...opts };
        const h = (tag, cls, text) => { const n = d.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
        let gone = false, timer = 0, busy = false;
        container.replaceChildren();
        container.classList.add('ovdac');
        // Network's frame relay on a site; an explicit base reaches Actor itself (a test).
        const direct = o.base ? String(o.base).replace(/\/+$/, '') : '';
        const frameBase = String(o.frameBase || 'https://openvibe.network/api/frame').replace(/\/+$/, '');
        const endpoint = (path) => (direct ? direct + '/api/v1/me/actor' + path : frameBase + '/actor' + path);
        // "Open" is a navigation, never a fetch: Actor's own page, wherever the API is.
        const openBase = direct || 'https://openvibe.actor';

        async function api(path, init = {}) {
            const t = typeof o.token === 'function' ? await o.token() : o.token;
            if (!t) throw Object.assign(new Error('Sign in to use your Actor'), { status: 401 });
            const headers = { accept: 'application/json', ...(init.json ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${t}` };
            const r = await fetch(endpoint(path), { method: init.method || 'GET', headers, credentials: 'omit', body: init.json ? JSON.stringify(init.body || {}) : undefined });
            const b = await r.json().catch(() => ({}));
            if (!r.ok) throw Object.assign(new Error(b.detail || `HTTP ${r.status}`), { status: r.status });
            return b;
        }

        function stateOf(a) {
            const asks = Array.isArray(a.asks) ? a.asks : [];
            if (asks.length) return 'waiting';
            return STATE[a.status] ? a.status : 'paused';
        }

        function render(a) {
            container.replaceChildren();
            if (!a || a.enabled === false && !a.id) { container.classList.remove('on'); return; }
            container.classList.add('on');
            const state = stateOf(a);
            // Head: face, name and state; Pause or Resume; the model; open the Actor's page.
            const head = h('div', 'ovdac-head');
            const face = h('span', 'ovdac-face');
            const pic = a.avatar && typeof a.avatar.url === 'string' && /^https:\/\//.test(a.avatar.url) ? a.avatar.url : '';
            if (pic) { const img = h('img'); img.alt = ''; img.src = pic; face.append(img); } else face.textContent = String(a.name || 'A').trim().charAt(0).toUpperCase() || 'A';
            const who = h('span', 'ovdac-who');
            who.append(h('span', 'ovdac-name', a.name || 'Your Actor'));
            const st = h('span', `ovdac-state is-${state}`); st.append(h('span', 'dot'), d.createTextNode(STATE[state]));
            who.append(st);
            const pause = h('button', 'ovdac-btn', a.status === 'paused' ? 'Resume' : 'Pause'); pause.type = 'button';
            pause.addEventListener('click', () => act(a.status === 'paused' ? '/resume' : '/pause', {}, pause));
            const open = h('a', 'ovdac-btn', 'Open'); open.href = openBase + '/you'; open.target = '_blank'; open.rel = 'noopener';
            head.append(face, who, pause, open);
            container.append(head);
            // Now: the step, what it looks at, the last three, next, today's cost.
            const now = a.now || {};
            const box = h('div', 'ovdac-now');
            if (now.current_step) {
                const step = h('div', 'ovdac-step'); step.append(h('span', 'dot'), d.createTextNode(String(now.current_step)));
                box.append(step);
                if (now.looking_at) box.append(h('div', 'ovdac-look', `Looking at: ${now.looking_at.title || now.looking_at}`));
            } else {
                box.append(h('div', 'ovdac-step', state === 'paused' ? 'Paused. It does nothing until you resume it.' : 'Resting.'));
            }
            const last = Array.isArray(now.last_three_steps) ? now.last_three_steps.slice(0, 3) : [];
            if (last.length) { const ol = h('ol', 'ovdac-done'); last.forEach((x) => ol.append(h('li', '', String(x.text || x)))); box.append(ol); }
            if (now.next) box.append(h('div', 'ovdac-next', `Next: ${now.next.text || now.next}`));
            const model = a.brain && a.brain !== 'auto' ? a.brain : 'Auto';
            box.append(h('div', 'ovdac-cost', `Model: ${model} · today ${money(now.cost_today)}${a.caps && a.caps.usd ? ` of your ${money(a.caps.usd)} cap` : ''}`));
            container.append(box);
            // The first thing it asks, with its own buttons.
            const ask = (Array.isArray(a.asks) ? a.asks : [])[0];
            if (ask) {
                const card = h('div', 'ovdac-ask');
                card.append(h('b', '', 'It asks you'), h('p', '', String(ask.text || '')));
                const row = h('div', 'row');
                const options = Array.isArray(ask.options) && ask.options.length ? ask.options : [{ id: 'yes', label: 'Yes' }];
                options.slice(0, 3).forEach((op, i) => {
                    const b = h('button', `ovdac-btn${i === 0 ? ' is-yes' : ''}`, String(op.label || op)); b.type = 'button';
                    b.addEventListener('click', () => act(`/asks/${encodeURIComponent(ask.id)}/answer`, { option: op.id || op }, b));
                    row.append(b);
                });
                const no = h('button', 'ovdac-btn', 'Not now'); no.type = 'button';
                no.addEventListener('click', () => act(`/asks/${encodeURIComponent(ask.id)}/decline`, {}, no));
                row.append(no);
                card.append(row);
                if (a.asks.length > 1) card.append(h('div', 'ovdac-note', `${a.asks.length - 1} more on your Actor's page`));
                container.append(card);
            }
            // Tell it something.
            const form = h('form', 'ovdac-tell');
            const input = h('input'); input.type = 'text'; input.maxLength = 2000; input.placeholder = 'Tell your Actor something'; input.setAttribute('aria-label', 'Tell your Actor something');
            const send = h('button', 'ovdac-btn', 'Send'); send.type = 'submit';
            form.append(input, send);
            form.addEventListener('submit', (e) => { e.preventDefault(); const text = input.value.trim(); if (!text) return; act('/tell', { text }, send).then((ok) => { if (ok) input.value = ''; }); });
            container.append(form);
        }

        async function act(path, body, btn) {
            if (busy) return false;
            busy = true; if (btn) btn.disabled = true;
            try { await api(path, { method: 'POST', json: true, body }); await refresh(); return true; }
            catch (err) { const n = h('div', 'ovdac-note', `That did not go through: ${err.message}`); container.append(n); return false; }
            finally { busy = false; if (btn) btn.disabled = false; }
        }

        async function refresh() {
            if (gone) return;
            if (o.active && !o.active()) return;
            try { render(await api('')); }
            catch (err) { if (err.status === 401 || err.status === 403 || err.status === 404) render(null); }
        }
        refresh();
        timer = setInterval(refresh, POLL_MS);
        return { refresh, destroy() { gone = true; clearInterval(timer); container.replaceChildren(); container.classList.remove('on'); } };
    }

    root.OpenVibeDockActor = { mount };
})(typeof window !== 'undefined' ? window : globalThis);
