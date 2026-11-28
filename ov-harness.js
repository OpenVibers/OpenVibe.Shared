/**
 * ov-harness.js (openvibe-shared 4.257.0): the coding-harness layout over the one run engine. The owner, 11-15: the
 * messenger (agents, conversations, one box) is Actor's; Codes gets "a coding agent harness layout, look, feel, and
 * organization … the same underlying shared modular powerful system". So this draws code runs the way a harness does
 * (after T3 Code, the Codex app and Cursor's agents): your projects (repositories) with their threads on the left, the
 * open thread in the middle, what it changed on the right. The thread and the box are the network's own
 * (ov-run.js OpenVibeRun.mount), over the Frame's Run API, so a task here is the same run in the menu on every site.
 *
 *   const h = OpenVibeHarness.page(host, {
 *     ...OpenVibeRun's mount options (base, token, me, sibling, examples),
 *     repos: ['owner/name', …],            // the person's recent repositories, offered for a new task
 *     open: 'codes:tsk_…',                 // a run to open first
 *     link: (run) => url,                  // a run's own full page (default: run.url)
 *     agents: [{ id, name, available }],   // 4.258.0: the harnesses a new task may name (auto first, always)
 *     models: [{ id, name }],              //          the models it may name
 *     places: [{ kind, id?, name }],       //          where it may run (agents.run-start@1 WHERE: openvibe, machine…)
 *   });
 *   h.open(ref); h.blank(target?); h.prefill(words); h.board(); h.refresh(); h.destroy();
 *
 * A computer: three columns (the changes column from 1180 px). A phone: Projects · Task · Changes as tabs, one at a
 * time; opening a thread shows Task. Everything a run says is set as text, never markup.
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OpenVibeHarness) return;

    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; };
    const svg = (d) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = d; return s; };
    const I = {
        plus: '<path d="M12 4.5v15M4.5 12h15"/>',
        repo: '<path d="M6 3.5h11.5v14H7.2a2 2 0 0 0 0 4h10.3M6 3.5a2 2 0 0 0-2 2v14"/>',
        spark: '<path d="M10.4 3.6l1.7 4.8L17 10.1l-4.8 1.7L10.4 16.7l-1.7-4.8L3.9 10.1l4.8-1.7Z"/>',
        ov: '<circle cx="8" cy="12" r="4.5"/><path d="M13.5 7.5l3 9 3-9"/>',
        open: '<path d="M14 3.8h6.3v6.3M20.2 3.8l-9.4 9.4M18.2 14.2v4.2a2.1 2.1 0 0 1-2.1 2.1H5.6a2.1 2.1 0 0 1-2.1-2.1V7.9a2.1 2.1 0 0 1 2.1-2.1h4.2"/>',
        pr: '<circle cx="6" cy="5.5" r="2.2"/><circle cx="6" cy="18.5" r="2.2"/><circle cx="18" cy="18.5" r="2.2"/><path d="M6 7.7v8.6M18 16.3V9.5a3 3 0 0 0-3-3h-4M12.5 4l-2 2.5 2 2.5"/>',
        file: '<path d="M6.5 3h7.5l4 4v14h-11.5Z"/><path d="M14 3v4h4"/>',
        search: '<circle cx="10.6" cy="10.6" r="7"/><path d="M20.4 20.4l-4.5-4.5"/>',
    };
    const STATUS = { planning: ['Starting', 'run'], running: ['Working', 'run'], waiting: ['Needs you', 'wait'], done: ['Done', 'ok'], failed: ['Failed', 'bad'], stopped: ['Stopped', 'off'] };
    const ago = (iso) => {
        const t = Date.parse(iso || '');
        if (!Number.isFinite(t)) return '';
        const s = Math.max(0, (Date.now() - t) / 1000);
        return s < 60 ? 'now' : s < 3600 ? `${Math.round(s / 60)} min` : s < 86400 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 86400)} d`;
    };
    /** Where a code run works: a repository's owner/name, or the two kinds of new work. */
    const projectOf = (run) => {
        const t = run && run.target;
        if (t && typeof t === 'object' && t.repo) return { key: `repo:${String(t.repo).replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\.git$/, '')}`, name: String(t.repo).replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\.git$/, ''), target: { repo: t.repo }, icon: 'repo' };
        if (t === 'openvibe') return { key: 'openvibe', name: 'OpenVibe', target: 'openvibe', icon: 'ov' };
        // 4.260.0 (the owner, 11-15: "type anything … it's code related, so it'll code shit or give you a space or …
        // analyze GitHubs, or clone shit"): no project first; Codes' make mode works out what the words ask for.
        if (t === 'anything') return { key: 'anything', name: 'Anything', target: 'anything', icon: 'spark' };
        return { key: 'new', name: 'New projects', target: 'new', icon: 'spark' };
    };

    let styled = false;
    function styles() {
        if (styled || document.getElementById('ovhr-styles')) { styled = true; return; }
        styled = true;
        const st = document.createElement('style');
        st.id = 'ovhr-styles';
        st.textContent = `
.ovhr { display: grid; grid-template-columns: minmax(240px, 300px) minmax(0, 1fr); height: 100%; min-height: 0; background: var(--bg-primary, #0b0f17); color: var(--text-primary, #e8edf5); }
@media (min-width: 1180px) { .ovhr.has-run { grid-template-columns: minmax(240px, 300px) minmax(0, 1fr) minmax(260px, 320px); } }
.ovhr svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.ovhr-side { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--border, rgba(255,255,255,.08)); }
.ovhr-side-top { display: grid; gap: 8px; padding: 12px; }
.ovhr-new { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; border: 0; border-radius: 12px; background: var(--accent, #3b82f6); color: var(--on-accent, #fff); font: inherit; font-weight: 650; cursor: pointer; }
.ovhr-find { display: flex; align-items: center; gap: 8px; min-height: 38px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--border, rgba(255,255,255,.1)); background: var(--bg-card, rgba(255,255,255,.03)); color: var(--text-secondary, #a8b3c4); }
.ovhr-find input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--text-primary, #e8edf5); font: inherit; font-size: 14px; -webkit-appearance: none; appearance: none; }
.ovhr-projects { flex: 1; overflow: auto; padding: 4px 8px 16px; }
.ovhr-proj { margin-top: 10px; }
.ovhr-proj-head { display: flex; align-items: center; gap: 8px; padding: 4px 6px; color: var(--text-secondary, #a8b3c4); font-size: 12.5px; font-weight: 700; letter-spacing: .02em; }
.ovhr-proj-head span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovhr-proj-add { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 8px; background: none; color: inherit; cursor: pointer; }
.ovhr-proj-add:hover, .ovhr-row:hover { background: var(--bg-hover, rgba(255,255,255,.06)); }
.ovhr-row { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; align-items: center; gap: 8px; width: 100%; min-height: 44px; padding: 6px 8px; border: 0; border-radius: 10px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ovhr-row.is-open { background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); }
.ovhr-row b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; }
.ovhr-row small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted, #8b93a3); font-size: 12px; }
.ovhr-row time { color: var(--text-muted, #8b93a3); font-size: 12px; }
.ovhr-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted, #8b93a3); }
.ovhr-dot.is-run { background: var(--accent, #3b82f6); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #3b82f6) 25%, transparent); }
.ovhr-dot.is-wait { background: #f59e0b; } .ovhr-dot.is-ok { background: #22c55e; } .ovhr-dot.is-bad { background: #ef4444; }
html:not([data-ov-motion="off"]) .ovhr-dot.is-run { animation: ovhr-pulse 1.6s ease-in-out infinite; }
@keyframes ovhr-pulse { 50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent, #3b82f6) 0%, transparent); } }
.ovhr-empty { margin: 16px 8px; color: var(--text-muted, #8b93a3); font-size: 13.5px; line-height: 1.5; }
.ovhr-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.ovhr-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; min-height: 48px; padding: 8px 14px; border-bottom: 1px solid var(--border, rgba(255,255,255,.08)); font-size: 13.5px; }
.ovhr-head b { font-weight: 650; }
.ovhr-chip { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; min-height: 30px; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--border, rgba(255,255,255,.1)); color: var(--text-secondary, #a8b3c4); font-size: 12.5px; }
.ovhr-chip svg { width: 15px; height: 15px; }
.ovhr-head select { min-height: 32px; max-width: 100%; border-radius: 10px; border: 1px solid var(--border, rgba(255,255,255,.1)); background: var(--bg-card, rgba(255,255,255,.03)); color: var(--text-primary, #e8edf5); font: inherit; padding: 0 8px; }
.ovhr-head a { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; color: var(--accent-light, #93c5fd); text-decoration: none; min-height: 32px; }
.ovhr-thread { flex: 1; min-height: 0; }
/* 4.260.0 (the owner, 11-15: the box "cut off … and unscrollable" on a phone): the view scrolls in its column and the box
   stays at its foot, over what scrolls; a head with nothing in it takes no room. */
.ovhr-head:empty { display: none; }
.ovhr-thread > .ovr { overflow-y: auto; overflow-x: hidden; }
.ovhr-thread > .ovr > .ovr-compose { position: sticky; bottom: 0; z-index: 5; padding-top: 10px; padding-bottom: max(6px, env(safe-area-inset-bottom, 0px)); background: linear-gradient(to bottom, transparent, var(--bg-primary, #0b0f17) 14px); }
.ovhr-panel { display: none; min-height: 0; overflow: auto; padding: 14px; border-left: 1px solid var(--border, rgba(255,255,255,.08)); }
@media (min-width: 1180px) { .ovhr.has-run .ovhr-panel { display: block; } }
.ovhr-panel h3 { margin: 4px 0 10px; font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: var(--text-secondary, #a8b3c4); }
.ovhr-facts { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 12px; margin: 0 0 16px; font-size: 13.5px; }
.ovhr-facts dt { color: var(--text-muted, #8b93a3); } .ovhr-facts dd { margin: 0; overflow-wrap: anywhere; }
.ovhr-outs { list-style: none; margin: 0 0 16px; padding: 0; display: grid; gap: 6px; }
.ovhr-outs a { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 10px; border-radius: 10px; border: 1px solid var(--border, rgba(255,255,255,.1)); color: inherit; text-decoration: none; font-size: 13.5px; overflow-wrap: anywhere; }
.ovhr-outs span:only-child { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 10px; border-radius: 10px; border: 1px dashed var(--border, rgba(255,255,255,.1)); font-size: 13.5px; overflow-wrap: anywhere; }
.ovhr-outs a.is-pr { border-color: color-mix(in srgb, var(--accent, #3b82f6) 50%, transparent); }
.ovhr-views { display: flex; gap: 4px; padding: 3px; border-radius: 10px; background: var(--bg-card, rgba(255,255,255,.03)); border: 1px solid var(--border, rgba(255,255,255,.08)); }
.ovhr-views button { flex: 1; min-height: 32px; border: 0; border-radius: 8px; background: none; color: var(--text-secondary, #a8b3c4); font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; }
.ovhr-views button[aria-pressed="true"] { background: var(--bg-hover, rgba(255,255,255,.08)); color: var(--text-primary, #e8edf5); }
.ovhr-board { display: none; flex: 1; min-height: 0; overflow: auto; padding: 12px; gap: 12px; grid-auto-flow: column; grid-auto-columns: minmax(176px, 1fr); align-items: start; }
.ovhr.is-board .ovhr-board { display: grid; } .ovhr.is-board .ovhr-thread, .ovhr.is-board .ovhr-head { display: none; }
.ovhr-col { display: grid; gap: 8px; align-content: start; min-height: 120px; padding: 10px; border-radius: 14px; background: var(--bg-card, rgba(255,255,255,.03)); border: 1px solid var(--border, rgba(255,255,255,.08)); }
.ovhr-col h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 2px; font-size: 13px; font-weight: 700; color: var(--text-secondary, #a8b3c4); }
.ovhr-col h3 span:last-child { margin-left: auto; color: var(--text-muted, #8b93a3); font-weight: 600; }
.ovhr-card { display: grid; gap: 4px; width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border, rgba(255,255,255,.08)); background: var(--bg-primary, #0b0f17); color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ovhr-card:hover { border-color: color-mix(in srgb, var(--accent, #3b82f6) 45%, transparent); }
.ovhr-card b { font-size: 14px; font-weight: 650; overflow-wrap: anywhere; }
.ovhr-card small { color: var(--text-muted, #8b93a3); font-size: 12px; overflow-wrap: anywhere; }
.ovhr-tabs { display: none; }
@media (max-width: 899px) {
  .ovhr, .ovhr.has-run { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .ovhr-tabs { display: flex; gap: 4px; padding: 6px 8px; border-bottom: 1px solid var(--border, rgba(255,255,255,.08)); }
  .ovhr-tabs button { flex: 1; min-height: 40px; border: 0; border-radius: 10px; background: none; color: var(--text-secondary, #a8b3c4); font: inherit; font-weight: 650; cursor: pointer; }
  .ovhr-tabs button[aria-selected="true"] { background: var(--bg-hover, rgba(255,255,255,.08)); color: var(--text-primary, #e8edf5); }
  .ovhr-side, .ovhr-main, .ovhr-panel { display: none; border: 0; }
  .ovhr[data-tab="projects"] .ovhr-side, .ovhr[data-tab="task"] .ovhr-main, .ovhr[data-tab="changes"] .ovhr-panel { display: flex; flex-direction: column; }
  .ovhr[data-tab="changes"] .ovhr-panel { display: block; }
  .ovhr-board { grid-auto-flow: row; grid-auto-columns: auto; grid-template-columns: minmax(0, 1fr); align-content: start; }
  .ovhr-col { min-height: 0; }
}`;
        document.head.appendChild(st);
    }

    function page(host, o = {}) {
        styles();
        if (!root.OpenVibeRun || typeof root.OpenVibeRun.mount !== 'function') throw new Error('ov-harness.js needs ov-run.js first');
        const base = String(o.base || 'https://openvibe.network/api/frame').replace(/\/+$/, '');
        const tokenOf = () => (typeof o.token === 'function' ? o.token() : o.token) || '';
        const call = async (path) => {
            const t = tokenOf();
            const r = await fetch(`${base}/runs${path}`, { credentials: 'omit', headers: { Accept: 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        };
        host.textContent = '';
        const wrap = el('div', 'ovhr');
        wrap.dataset.tab = 'task';
        // Phone tabs: one region at a time.
        const tabs = el('div', 'ovhr-tabs');
        tabs.setAttribute('role', 'tablist');
        const tabBtn = {};
        for (const [id, words] of [['projects', 'Projects'], ['task', 'Task'], ['changes', 'Changes']]) {
            const b = el('button', null, words);
            b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(id === 'task'));
            b.addEventListener('click', () => show(id));
            tabBtn[id] = b; tabs.append(b);
        }
        const show = (id) => { wrap.dataset.tab = id; for (const [k, b] of Object.entries(tabBtn)) b.setAttribute('aria-selected', String(k === id)); };

        // The projects column.
        const side = el('aside', 'ovhr-side');
        side.setAttribute('aria-label', 'Projects');
        const top = el('div', 'ovhr-side-top');
        const newBtn = el('button', 'ovhr-new');
        newBtn.type = 'button';
        newBtn.append(svg(I.plus), el('span', null, 'New task'));
        newBtn.addEventListener('click', () => blank());
        const find = el('label', 'ovhr-find');
        const q = el('input');
        q.type = 'search'; q.placeholder = 'Find a thread'; q.setAttribute('aria-label', 'Find a thread');
        find.append(svg(I.search), q);
        q.addEventListener('input', () => { drawProjects(); if (mode === 'board') drawBoard(); });
        // 4.258.0: List (projects and threads) or Board (every run by where it stands, after Vibe Kanban).
        const views = el('div', 'ovhr-views');
        views.setAttribute('role', 'group'); views.setAttribute('aria-label', 'Show');
        const viewBtn = {};
        for (const [id, words] of [['list', 'List'], ['board', 'Board']]) {
            const b = el('button', null, words);
            b.type = 'button'; b.setAttribute('aria-pressed', String(id === 'list'));
            b.addEventListener('click', () => setView(id));
            viewBtn[id] = b; views.append(b);
        }
        top.append(newBtn, views, find);
        const projects = el('div', 'ovhr-projects');
        side.append(top, projects);

        // The thread column: its head, then the network's own thread and box.
        const main = el('section', 'ovhr-main');
        main.setAttribute('aria-label', 'Task');
        const head = el('div', 'ovhr-head');
        const threadHost = el('div', 'ovhr-thread');
        const boardHost = el('div', 'ovhr-board');
        boardHost.setAttribute('aria-label', 'Board');
        main.append(head, threadHost, boardHost);

        // The changes column.
        const panel = el('aside', 'ovhr-panel');
        panel.setAttribute('aria-label', 'Changes');

        wrap.append(tabs, side, main, panel);
        host.append(wrap);

        let runs = [];
        let openRef = String(o.open || '');
        let openRun = null;
        let target = o.target || 'anything';
        let pick = { agent: 'auto', model: 'auto', where: 'auto' };
        let mode = 'list';
        let view = null;
        let timer = null;
        let destroyed = false;
        let openGeneration = 0, refreshGeneration = 0;

        function knownProjects() {
            const seen = new Map();
            for (const r of runs) { const p = projectOf(r); if (!seen.has(p.key)) seen.set(p.key, p); }
            for (const repo of o.repos || []) { const p = projectOf({ target: { repo } }); if (!seen.has(p.key)) seen.set(p.key, p); }
            for (const p of [projectOf({ target: 'openvibe' }), projectOf({ target: 'new' })]) if (!seen.has(p.key)) seen.set(p.key, p);
            return [projectOf({ target: 'anything' }), ...seen.values()];
        }

        function drawProjects() {
            const needle = q.value.trim().toLowerCase();
            projects.textContent = '';
            const groups = new Map();
            for (const r of runs) {
                if (needle && !`${r.title || ''} ${projectOf(r).name}`.toLowerCase().includes(needle)) continue;
                const p = projectOf(r);
                if (!groups.has(p.key)) groups.set(p.key, { p, rows: [] });
                groups.get(p.key).rows.push(r);
            }
            if (!groups.size) { projects.append(el('p', 'ovhr-empty', needle ? 'No thread matches.' : 'No coding threads yet. Start one: pick a repository, or a new project, and say what to build or fix.')); return; }
            for (const { p, rows } of groups.values()) {
                const g = el('section', 'ovhr-proj');
                const h = el('div', 'ovhr-proj-head');
                const add = el('button', 'ovhr-proj-add');
                add.type = 'button'; add.title = `New task in ${p.name}`; add.setAttribute('aria-label', `New task in ${p.name}`);
                add.append(svg(I.plus));
                add.addEventListener('click', () => blank(p.target));
                h.append(svg(I[p.icon]), el('span', null, p.name), add);
                g.append(h);
                for (const r of rows) {
                    const b = el('button', 'ovhr-row');
                    b.type = 'button'; b.dataset.ref = String(r.ref || r.id || '');
                    if (b.dataset.ref === openRef) b.classList.add('is-open');
                    const st = STATUS[r.status] || ['', ''];
                    const dot = el('span', `ovhr-dot is-${st[1]}`);
                    dot.title = st[0];
                    const words = el('span');
                    const who = [r.agent && (r.agent.name || r.agent.harness), r.model && (r.model.name || r.model.id), st[0]].filter(Boolean).join(' · ');
                    words.append(el('b', null, r.title || 'A coding task'), el('small', null, who));
                    const when = el('time', null, ago(r.updated_at || r.created_at));
                    b.append(dot, words, when);
                    b.addEventListener('click', () => open(b.dataset.ref));
                    g.append(b);
                }
                projects.append(g);
            }
        }

        const COLUMNS = [['planning', 'Starting'], ['running', 'Working'], ['waiting', 'Needs you'], ['done', 'Done'], ['failed', 'Failed or stopped']];
        function drawBoard() {
            boardHost.textContent = '';
            const needle = q.value.trim().toLowerCase();
            for (const [status, words] of COLUMNS) {
                const rows = runs.filter((r) => (status === 'failed' ? r.status === 'failed' || r.status === 'stopped' : r.status === status)
                    && (!needle || `${r.title || ''} ${projectOf(r).name}`.toLowerCase().includes(needle)));
                const col = el('section', 'ovhr-col');
                col.dataset.status = status;
                const h = el('h3');
                h.append(el('span', `ovhr-dot is-${(STATUS[status] || ['', 'off'])[1]}`), el('span', null, words), el('span', null, String(rows.length)));
                col.append(h);
                for (const r of rows) {
                    const c = el('button', 'ovhr-card');
                    c.type = 'button'; c.dataset.ref = String(r.ref || r.id || '');
                    c.append(el('b', null, r.title || 'A coding task'), el('small', null, [projectOf(r).name, r.agent && (r.agent.name || r.agent.harness), ago(r.updated_at || r.created_at)].filter(Boolean).join(' · ')));
                    c.addEventListener('click', () => { setView('list'); open(c.dataset.ref); });
                    col.append(c);
                }
                boardHost.append(col);
            }
        }
        function setView(v) {
            mode = v === 'board' ? 'board' : 'list';
            wrap.classList.toggle('is-board', mode === 'board');
            for (const [k, b] of Object.entries(viewBtn)) b.setAttribute('aria-pressed', String(k === mode));
            if (mode === 'board') { drawBoard(); show('task'); }
        }

        /** The start's own choices (agents.run-start@1 AGENT, MODEL and WHERE), from what the host offers. */
        function startFields() {
            const out = {};
            if (pick.agent !== 'auto') out.agent = pick.agent;
            if (pick.model !== 'auto') out.model = { id: pick.model };
            if (pick.where !== 'auto') { const pl = (o.places || []).find((x) => placeKey(x) === pick.where); if (pl) out.where = pl.id ? { kind: pl.kind, id: pl.id } : { kind: pl.kind }; }
            return out;
        }
        const placeKey = (pl) => `${pl.kind}${pl.id ? `:${pl.id}` : ''}`;
        function picker(label, name, items, current, onPick) {
            const wrapLabel = el('label', 'ovhr-chip');
            wrapLabel.append(el('span', null, label));
            const sel = el('select');
            sel.name = name;
            sel.setAttribute('aria-label', label);
            for (const it of items) {
                const opt = el('option', null, it.name);
                opt.value = it.value;
                if (it.disabled) opt.disabled = true;
                if (it.value === current) opt.selected = true;
                sel.append(opt);
            }
            sel.addEventListener('change', () => onPick(sel.value));
            wrapLabel.append(sel);
            return wrapLabel;
        }

        function drawHead() {
            head.textContent = '';
            if (openRun) {
                const p = projectOf(openRun);
                const st = STATUS[openRun.status] || [openRun.status || '', ''];
                head.append(el('b', null, p.name));
                const chips = [openRun.target && openRun.target.branch, openRun.agent && (openRun.agent.name || openRun.agent.harness), openRun.model && (openRun.model.name || openRun.model.id), st[0]].filter(Boolean);
                for (const c of chips) head.append(el('span', 'ovhr-chip', c));
                const url = typeof o.link === 'function' ? o.link(openRun) : openRun.url;
                if (url && /^https?:\/\//.test(String(url))) { const a = el('a'); a.href = url; a.append(svg(I.open), el('span', null, 'Full page')); head.append(a); }
                return;
            }
            // A new task (4.260.0): what it works on, the agent, the model and where it runs are the box's own chips (the
            // owner, 11-15: "reorganize this … icon buttons and better custom drop down"); the head is empty and folds away.
        }

        function drawPanel() {
            panel.textContent = '';
            wrap.classList.toggle('has-run', !!openRun);
            if (!openRun) { panel.append(el('p', 'ovhr-empty', 'What a task changes shows here: its pull request, its files and what it cost.')); return; }
            panel.append(el('h3', null, 'Changes'));
            const outs = Array.isArray(openRun.outputs) ? openRun.outputs.slice().sort((a, b) => (b.kind === 'pr') - (a.kind === 'pr')) : [];
            if (outs.length) {
                const ul = el('ul', 'ovhr-outs');
                for (const out of outs) {
                    const li = el('li');
                    const ok = out.url && /^https?:\/\//.test(String(out.url));
                    const a = el(ok ? 'a' : 'span', out.kind === 'pr' ? 'is-pr' : null);
                    if (ok) { a.href = out.url; a.target = '_blank'; a.rel = 'noopener'; }
                    a.append(svg(out.kind === 'pr' ? I.pr : I.file), el('span', null, out.title || out.kind));
                    li.append(a); ul.append(li);
                }
                panel.append(ul);
            } else {
                panel.append(el('p', 'ovhr-empty', openRun.status === 'running' || openRun.status === 'planning' ? 'Nothing yet: it is still working.' : 'No changes recorded for this run.'));
            }
            panel.append(el('h3', null, 'This run'));
            const dl = el('dl', 'ovhr-facts');
            const c = openRun.counts || {};
            const usd = openRun.cost && (openRun.cost.usd != null ? openRun.cost.usd : openRun.cost.total_usd);
            for (const [k, v] of [['Status', (STATUS[openRun.status] || [openRun.status])[0]], ['Agent', openRun.agent && (openRun.agent.name || openRun.agent.harness)], ['Model', openRun.model && (openRun.model.name || openRun.model.id)],
                ['Branch', openRun.target && openRun.target.branch], ['Files', c.files], ['Steps', c.steps], ['Cost', usd != null && Number.isFinite(+usd) ? `$${(+usd).toFixed(4)}` : null], ['Started', ago(openRun.created_at) ? `${ago(openRun.created_at)} ago` : null]]) {
                if (v == null || v === '') continue;
                dl.append(el('dt', null, k), el('dd', null, v));
            }
            panel.append(dl);
        }

        function remount(opts) {
            if (view) { try { view.destroy(); } catch { /* */ } }
            const p = projectOf({ target });
            const where = p.key === 'new' ? null : p.name;
            const any = p.key === 'anything';
            view = root.OpenVibeRun.mount(threadHost, { ...o, ...opts, filter: 'code', start: { kind: 'code', ...(any ? {} : { target }), ...startFields(), ...(o.start && o.start.context ? { context: o.start.context } : {}) },
                // A coding start, not a chat: what the task works on, and what happens to it.
                blankIcon: 'code',
                blankTitle: any ? 'What should Codes do?' : p.key === 'new' ? 'A new project' : p.key === 'openvibe' ? 'Improve OpenVibe' : `New task in ${where}`,
                blankLine: any ? 'Anything with code: fix or change a repository (name it in your words), build something new, look into a GitHub project, or bring it to OpenVibe.Git. Codes works out the rest.'
                    : p.key === 'new' ? 'Say what to build. An agent makes it in a project of its own, and you can open it, change it and ship it.'
                    : 'Say what to build or fix. Codes picks the agent that fits it, works on its own branch and opens a pull request when it is done.',
                placeholder: any ? 'Ask Codes anything about code' : p.key === 'new' ? 'What should it build?' : 'Describe the change, the bug or what to build',
                // 4.260.0 (the owner, 11-15: the box said "Find a live stream about cooking" on Codes): coding examples only.
                examples: any ? ['Ask Codes anything about code', 'Fix the failing tests in octocat/hello-world', 'Explain how vercel/next.js renders a page', 'Clone my repo to OpenVibe.Git', 'A one-page site for my stream']
                    : p.key === 'new' ? ['What should it build?', 'A one-page site for my stream', 'A small browser game', 'A goal bar overlay for OBS']
                    : ['Describe the change, the bug or what to build', 'Fix the failing login test', 'Add a dark mode toggle', 'Make the home page load faster', 'Write tests for the date parser'],
                // 4.260.0 (the owner: "reorganize this … icon buttons and better custom drop down"): what it works on, the
                // agent, the model and where it runs are the box's own chips, each a sheet, instead of rows of selects.
                composer: {
                    ask: { task: 'code' },
                    runOptions: {
                        agents: [{ id: 'auto', name: 'Auto', line: 'Codes picks the agent that fits' }, ...(Array.isArray(o.agents) ? o.agents : []).map((a) => ({ id: String(a.id), name: a.name || a.id, line: a.available === false ? 'Not set up on your account' : 'A coding agent', disabled: a.available === false }))],
                        // Coding never runs on OpenVibe's own server (the owner, 11-15: "always … on the node or the user's own
                        // computer or link setup … The main server shouldn't be used"): a shared node or your computer.
                        places: [{ kind: 'auto', name: 'Auto', line: 'A shared node or your own computer' },
                            ...(Array.isArray(o.places) ? o.places : []).filter((pl) => pl && pl.kind !== 'openvibe' && pl.kind !== 'auto').map((pl) => ({ kind: pl.kind, ...(pl.id ? { id: pl.id } : {}), name: pl.name || pl.kind, line: pl.kind === 'machine' ? `Your computer${pl.online === false ? ' · offline' : ''}` : '', disabled: pl.online === false }))],
                    },
                    runChips: [{ id: 'project', icon: 'repo', label: 'Works on', value: p.key, options: () => knownProjects().map((x) => ({ value: x.key, name: x.name, line: x.key === 'new' ? 'Something new, in a project of its own' : x.key === 'openvibe' ? 'One of OpenVibe\'s own sites' : 'Your repository' })), onPick: (v) => { const x = knownProjects().find((y) => y.key === v); if (x) blank(x.target); } }],
                },
                starters: o.starters || (any ? [['code', 'Fix the failing tests in my repo'], ['search', 'Explain how a GitHub project works'], ['repo', 'Clone my repo to OpenVibe.Git'], ['spark', 'A one-page site for my stream']]
                    : p.key === 'new' ? [['code', 'A one-page site for my stream'], ['code', 'A small browser game'], ['code', 'A goal bar overlay']]
                    : [['code', 'Fix the failing tests'], ['code', 'Add a dark mode'], ['code', 'Write a README']]),
                onPlace: (p) => { if (p && p.ref && p.ref !== openRef) { openRef = String(p.ref); loadOpen(); } try { if (typeof o.onPlace === 'function') o.onPlace(p); } catch { /* */ } },
                onBack: () => blank() });
        }

        async function loadOpen() {
            if (destroyed) return;
            const generation = ++openGeneration, ref = openRef;
            if (!openRef) { openRun = null; drawHead(); drawPanel(); drawProjects(); return; }
            const known = runs.find((r) => String(r.ref || r.id) === openRef);
            if (known) openRun = known;
            else if (openRun && String(openRun.ref || openRun.id) !== ref) openRun = null;
            drawHead(); drawPanel(); drawProjects();
            try {
                const r = await call(`/${encodeURIComponent(ref)}`);
                if (destroyed || generation !== openGeneration || ref !== openRef) return;
                const run = r && (r.run || r);
                if (run && String(run.ref || run.id) === ref) openRun = run;
            } catch { /* the list's copy stays */ }
            if (destroyed || generation !== openGeneration || ref !== openRef) return;
            drawHead(); drawPanel(); drawProjects();
        }

        async function refresh() {
            if (destroyed) return;
            const generation = ++refreshGeneration;
            try {
                const out = await call('?kind=code&limit=100');
                if (destroyed || generation !== refreshGeneration) return;
                runs = (Array.isArray(out.runs) ? out.runs : []).filter((r) => !r.kind || r.kind === 'code');
            } catch { /* keep what is shown */ }
            if (destroyed || generation !== refreshGeneration) return;
            if (openRef) await loadOpen(); else { drawProjects(); drawHead(); drawPanel(); }
            if (destroyed || generation !== refreshGeneration) return;
            if (mode === 'board') drawBoard();
            schedule();
        }
        function schedule() {
            if (destroyed) return;
            clearTimeout(timer);
            const busy = runs.some((r) => ['planning', 'running', 'waiting'].includes(r.status));
            timer = setTimeout(() => { if (!document.hidden) refresh(); else schedule(); }, busy ? 8000 : 30000);
        }

        function open(ref) {
            if (destroyed) return;
            openGeneration++;
            openRef = String(ref || '');
            remount({ open: openRef, blank: false });
            show('task');
            loadOpen();
        }
        function blank(t) {
            if (destroyed) return;
            openGeneration++;
            if (t) target = t;
            openRef = ''; openRun = null;
            remount({ open: null, blank: true });
            show('task');
            drawHead(); drawPanel(); drawProjects();
        }

        if (openRef) open(openRef); else blank();
        refresh();
        return {
            open, blank, refresh,
            /** Words waiting in the box, unsent (a ?prompt= link). */
            prefill(text) { if (view && typeof view.prefill === 'function') view.prefill(String(text || '')); },
            get target() { return target; },
            board() { setView('board'); },
            destroy() { destroyed = true; clearTimeout(timer); if (view) { try { view.destroy(); } catch { /* */ } } host.textContent = ''; },
        };
    }

    root.OpenVibeHarness = { page, projectOf, version: 1 };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.OpenVibeHarness;
})(typeof window !== 'undefined' ? window : globalThis);
