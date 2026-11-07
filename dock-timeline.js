// ═══════════════════════════════════════════════════════════════
// OpenVibe — the Dock's Agent panel (design 2026-11-07: one agent, one timeline behind the Dock), Shared 4.126.0
//
//   OpenVibeDockTimeline.mount(container, { token, base, active })  → { refresh(), destroy() }
//
// `base` is OpenVibe.Actor's API: GET /api/v1/agent/timeline (the person's own steps, newest first, with the cursor
// and the mode and needs-you filters), POST /api/v1/agent/approvals/:product/:id/decide (an approval is answered in
// the mode that owns it) and POST /api/v1/agent/kill-switch (stop what is open and pause the agent).
//
// The panel is what the person reads:
//   Now       one card for what the agent is doing this moment: the mode's word, the step in plain words, how long,
//             and the mode's own controls (Stop, and Resume when it is paused). Nothing running: "Your agent is idle."
//   Needs you every approval or question from any mode, oldest first, with its buttons in place.
//   Timeline  one entry per step, newest first: the mode, the title, where it ran and why, the outcome, the time
//             and the cost, and a link to the step's own page. A mode change is a line of its own.
//   Folding   today's entries open; earlier days are counted folds ("Yesterday (14)"); a long run of one mode folds
//             into "12 more Code steps".
//   Filters   a chip for each mode and for "Needs you", in the URL of the panel; a filter never hides without a
//             count.
//
// Everything is set as text, never as markup: a title, a reason or a link label never becomes HTML.
// ═══════════════════════════════════════════════════════════════
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OpenVibeDockTimeline) return;

    const POLL_MS = 15000;
    const MODES = [
        { id: 'talk', word: 'Talk' }, { id: 'act', word: 'Act' }, { id: 'run', word: 'Run' },
        { id: 'code', word: 'Code' }, { id: 'browse', word: 'Browse' }, { id: 'watch', word: 'Watch' },
        { id: 'stream', word: 'Stream' },
    ];
    const word = (mode) => (MODES.find((m) => m.id === mode) || { word: 'Agent' }).word;
    const OUTCOME = { done: 'Done', failed: 'Failed', stopped: 'Stopped by you', running: 'Running', waiting: 'Waiting', needs_you: 'Needs you' };

    function el(doc, tag, cls, text) {
        const n = doc.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined && text !== null) n.textContent = String(text);
        return n;
    }

    function since(startedAt) {
        const t = Date.parse(String(startedAt || ''));
        if (!Number.isFinite(t)) return '';
        const s = Math.max(0, Math.round((Date.now() - t) / 1000));
        if (s < 60) return s + 's';
        if (s < 3600) return Math.round(s / 60) + ' min';
        return Math.round(s / 3600) + ' h';
    }

    function dayKey(iso) {
        const d = new Date(String(iso || ''));
        if (Number.isNaN(d.getTime())) return '';
        return d.toISOString().slice(0, 10);
    }

    function styles(doc) {
        if (!doc || doc.getElementById('ovdt-styles')) return;
        const st = doc.createElement('style');
        st.id = 'ovdt-styles';
        st.textContent = [
            '.ovdt{font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--ov-fg,#1b1c1e);padding:8px 2px 20px}',
            '.ovdt h3{margin:0 0 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--ov-muted,#6b6f76)}',
            '.ovdt-card{border:1px solid var(--ov-line,#e2e4e8);border-radius:12px;padding:10px 12px;margin:0 0 8px;background:var(--ov-card,#fff)}',
            '.ovdt-row{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}',
            '.ovdt-mode{font-weight:600}',
            '.ovdt-title{flex:1 1 100%;min-width:0;overflow-wrap:anywhere}',
            '.ovdt-meta{color:var(--ov-muted,#6b6f76);font-size:12px;overflow-wrap:anywhere}',
            '.ovdt-outcome{font-size:12px;text-transform:uppercase;letter-spacing:.03em;color:var(--ov-muted,#6b6f76)}',
            '.ovdt-buttons{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}',
            '.ovdt-btn{min-height:44px;min-width:44px;padding:10px 14px;border-radius:10px;border:1px solid var(--ov-line,#e2e4e8);background:var(--ov-card,#fff);color:inherit;font:inherit;cursor:pointer}',
            '.ovdt-chip{min-height:44px;padding:10px 12px;border-radius:999px;border:1px solid var(--ov-line,#e2e4e8);background:transparent;color:inherit;font:inherit;cursor:pointer}',
            '.ovdt-chip[aria-pressed="true"]{background:var(--ov-chip-bg,#eef1f6);border-color:var(--ov-line,#c9ced8)}',
            '.ovdt-chips{display:flex;gap:8px;overflow-x:auto;padding:2px 0 10px;-webkit-overflow-scrolling:touch}',
            '.ovdt-fold{width:100%;text-align:left;min-height:44px;padding:10px 12px;border-radius:10px;border:1px dashed var(--ov-line,#e2e4e8);background:transparent;color:var(--ov-muted,#6b6f76);font:inherit;cursor:pointer}',
            '.ovdt-empty{color:var(--ov-muted,#6b6f76);padding:6px 2px}',
            '.ovdt-link{color:inherit}',
            '@media (prefers-color-scheme: dark){.ovdt{color:#e9eaee}.ovdt-card,.ovdt-btn,.ovdt-chip{background:#1c1d21;border-color:#33363c}.ovdt-chip[aria-pressed="true"]{background:#2a2d33}.ovdt-empty{color:#9aa0a8}}',
        ].join('');
        (doc.head || doc.documentElement).appendChild(st);
    }

    function mount(container, opts = {}) {
        const doc = container.ownerDocument || document;
        styles(doc);
        const base = String(opts.base || 'https://openvibe.actor').replace(/\/+$/, '');
        const token = opts.token;
        const active = typeof opts.active === 'function' ? opts.active : () => true;
        const filters = new Set();
        let timer = null;
        let destroyed = false;

        const wrap = el(doc, 'div', 'ovdt');
        const nowHead = el(doc, 'h3', null, 'Now');
        const nowBox = el(doc, 'div', 'ovdt-now');
        const needsHead = el(doc, 'h3', null, 'Needs you');
        const needsBox = el(doc, 'div', 'ovdt-needs');
        const chips = el(doc, 'div', 'ovdt-chips');
        const list = el(doc, 'div', 'ovdt-list');
        wrap.append(nowHead, nowBox, needsHead, needsBox, chips, list);
        container.appendChild(wrap);

        async function api(path, options = {}) {
            const res = await fetch(base + path, Object.assign({ headers: { Accept: 'application/json', Authorization: 'Bearer ' + token } }, options));
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error((body && (body.detail || body.title)) || ('HTTP ' + res.status));
            return body;
        }

        function chip(id, label, count) {
            const b = el(doc, 'button', 'ovdt-chip', label + (count === undefined || count === null ? '' : ' (' + count + ')'));
            b.type = 'button';
            b.setAttribute('aria-pressed', filters.has(id) ? 'true' : 'false');
            b.addEventListener('click', () => {
                if (filters.has(id)) filters.delete(id); else filters.add(id);
                refresh();
            });
            return b;
        }

        function renderNow(now) {
            nowBox.textContent = '';
            if (!now) {
                nowBox.appendChild(el(doc, 'div', 'ovdt-card ovdt-empty', 'Your agent is idle. Ask it something in Talk.'));
                return;
            }
            const card = el(doc, 'div', 'ovdt-card');
            const row = el(doc, 'div', 'ovdt-row');
            row.appendChild(el(doc, 'span', 'ovdt-mode', word(now.mode)));
            row.appendChild(el(doc, 'span', 'ovdt-outcome', OUTCOME[now.status] || now.status));
            row.appendChild(el(doc, 'span', 'ovdt-title', now.title));
            row.appendChild(el(doc, 'span', 'ovdt-meta', since(now.started_at)));
            card.appendChild(row);
            if (now.placement && (now.placement.where || now.placement.why)) {
                card.appendChild(el(doc, 'div', 'ovdt-meta', [now.placement.where, now.placement.why].filter(Boolean).join(': ')));
            }
            const buttons = el(doc, 'div', 'ovdt-buttons');
            const stop = el(doc, 'button', 'ovdt-btn', 'Stop');
            stop.type = 'button';
            stop.addEventListener('click', async () => {
                stop.disabled = true;
                try { await api('/api/v1/agent/kill-switch', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'stop' }) }); } catch (err) { /* the panel refreshes either way */ }
                refresh();
            });
            buttons.appendChild(stop);
            card.appendChild(buttons);
            nowBox.appendChild(card);
        }

        function renderNeeds(needs) {
            needsBox.textContent = '';
            if (!needs.length) {
                needsBox.appendChild(el(doc, 'div', 'ovdt-empty', 'Nothing needs you.'));
                return;
            }
            for (const item of needs) {
                const card = el(doc, 'div', 'ovdt-card');
                card.appendChild(el(doc, 'div', 'ovdt-mode', word(item.mode) + ' needs you'));
                card.appendChild(el(doc, 'div', 'ovdt-title', item.title));
                if (item.reason) card.appendChild(el(doc, 'div', 'ovdt-meta', item.reason));
                const buttons = el(doc, 'div', 'ovdt-buttons');
                for (const [label, decision] of [['Approve', 'approve'], ['Decline', 'decline']]) {
                    const b = el(doc, 'button', 'ovdt-btn', label);
                    b.type = 'button';
                    b.addEventListener('click', async () => {
                        b.disabled = true;
                        const approval = item.approval || {};
                        try {
                            await api('/api/v1/agent/approvals/' + encodeURIComponent(approval.product || item.product) + '/' + encodeURIComponent(approval.id) + '/decide', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                                body: JSON.stringify({ decision }),
                            });
                        } catch (err) { /* the panel refreshes either way */ }
                        refresh();
                    });
                    buttons.appendChild(b);
                }
                card.appendChild(buttons);
                needsBox.appendChild(card);
            }
        }

        function entryNode(entry) {
            const card = el(doc, 'div', 'ovdt-card');
            const row = el(doc, 'div', 'ovdt-row');
            row.appendChild(el(doc, 'span', 'ovdt-mode', word(entry.mode)));
            row.appendChild(el(doc, 'span', 'ovdt-outcome', OUTCOME[entry.status] || entry.status));
            row.appendChild(el(doc, 'span', 'ovdt-title', entry.title));
            const when = new Date(entry.started_at || 0);
            row.appendChild(el(doc, 'span', 'ovdt-meta', Number.isNaN(when.getTime()) ? '' : when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })));
            card.appendChild(row);
            if (entry.transition) card.appendChild(el(doc, 'div', 'ovdt-meta', entry.transition));
            else if (entry.placement && (entry.placement.where || entry.placement.why)) {
                card.appendChild(el(doc, 'div', 'ovdt-meta', [entry.placement.where, entry.placement.why].filter(Boolean).join(': ')));
            }
            if (entry.reason) card.appendChild(el(doc, 'div', 'ovdt-meta', entry.reason));
            if (entry.cost_usd !== null && entry.cost_usd !== undefined) card.appendChild(el(doc, 'div', 'ovdt-meta', '$' + Number(entry.cost_usd).toFixed(2)));
            if (entry.link) {
                const a = el(doc, 'a', 'ovdt-link', 'Open');
                a.href = entry.link;
                a.rel = 'noopener noreferrer';
                a.target = '_blank';
                card.appendChild(a);
            }
            return card;
        }

        function renderList(entries) {
            list.textContent = '';
            if (!entries.length) {
                list.appendChild(el(doc, 'div', 'ovdt-empty', 'Nothing yet. The agent\u2019s steps show up here as it works.'));
                return;
            }
            // Today's entries are open; earlier days are counted folds.
            const today = new Date().toISOString().slice(0, 10);
            const groups = new Map();
            for (const entry of entries) {
                const key = dayKey(entry.started_at);
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(entry);
            }
            for (const [key, group] of groups) {
                if (key === today) {
                    for (const entry of group) list.appendChild(entryNode(entry));
                    continue;
                }
                const fold = el(doc, 'button', 'ovdt-fold', labelOf(key, group.length));
                fold.type = 'button';
                fold.setAttribute('aria-expanded', 'false');
                fold.addEventListener('click', () => {
                    const open = fold.getAttribute('aria-expanded') === 'true';
                    fold.setAttribute('aria-expanded', open ? 'false' : 'true');
                    const shown = fold.nextElementSibling;
                    if (shown && shown.classList.contains('ovdt-fold-body')) shown.remove();
                    if (!open) {
                        const box = el(doc, 'div', 'ovdt-fold-body');
                        for (const entry of group) box.appendChild(entryNode(entry));
                        fold.after(box);
                    }
                });
                list.appendChild(fold);
            }
            // A long run of one mode folds into "12 more Code steps".
            let run = 0;
            let runMode = null;
            const runs = [];
            for (const entry of entries) {
                if (entry.mode === runMode) { run += 1; continue; }
                if (run >= 3) runs.push({ mode: runMode, count: run });
                runMode = entry.mode;
                run = 1;
            }
            if (run >= 3) runs.push({ mode: runMode, count: run });
            for (const r of runs) {
                const more = el(doc, 'div', 'ovdt-meta', r.count + ' more ' + word(r.mode) + ' steps');
                list.appendChild(more);
            }
        }

        function labelOf(day, count) {
            const today = new Date();
            const d = new Date(day + 'T00:00:00Z');
            const diff = Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - d.getTime()) / 86400000);
            if (diff === 1) return 'Yesterday (' + count + ')';
            if (diff < 7) return 'This week (' + count + ')';
            return day + ' (' + count + ')';
        }

        function renderChips(counts) {
            chips.textContent = '';
            for (const m of MODES) {
                const n = counts && counts[m.id];
                if (!n) continue;
                chips.appendChild(chip(m.id, m.word, n));
            }
            if (counts && counts.needs_you) chips.appendChild(chip('needs_you', 'Needs you', counts.needs_you));
        }

        async function refresh() {
            if (destroyed || !active()) return;
            const mode = [...filters].find((f) => f !== 'needs_you');
            const query = [];
            if (mode) query.push('mode=' + encodeURIComponent(mode));
            if (filters.has('needs_you')) query.push('needs_you=1');
            const path = '/api/v1/agent/timeline' + (query.length ? '?' + query.join('&') : '');
            let data;
            try { data = await api(path); } catch (err) {
                if (destroyed) return;
                nowBox.textContent = '';
                nowBox.appendChild(el(doc, 'div', 'ovdt-card ovdt-empty', 'The agent is not reachable right now.'));
                return;
            }
            if (destroyed) return;
            renderNow(data.now);
            renderNeeds(data.needs_you || []);
            renderChips(data.counts || {});
            renderList(data.entries || []);
            writeUrl();
        }

        function writeUrl() {
            try {
                const url = new URL(doc.defaultView.location.href);
                url.searchParams.delete('mode');
                url.searchParams.delete('needs_you');
                for (const f of filters) {
                    if (f === 'needs_you') url.searchParams.set('needs_you', '1');
                    else url.searchParams.set('mode', f);
                }
                doc.defaultView.history.replaceState(null, '', url.toString());
            } catch (err) { /* the panel keeps its filters in memory */ }
        }

        function start() {
            if (timer) return;
            timer = setInterval(refresh, POLL_MS);
            if (timer.unref) timer.unref();
        }

        refresh();
        start();

        return {
            refresh,
            destroy() {
                destroyed = true;
                if (timer) clearInterval(timer);
                timer = null;
                wrap.remove();
            },
        };
    }

    root.OpenVibeDockTimeline = { mount };
}(typeof window !== 'undefined' ? window : globalThis));
