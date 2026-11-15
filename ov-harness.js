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
 *   });
 *   h.open(ref); h.blank(target?); h.prefill(words); h.refresh(); h.destroy();
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
.ovhr-find input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--text-primary, #e8edf5); font: inherit; font-size: 14px; }
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
.ovhr-panel { display: none; min-height: 0; overflow: auto; padding: 14px; border-left: 1px solid var(--border, rgba(255,255,255,.08)); }
@media (min-width: 1180px) { .ovhr.has-run .ovhr-panel { display: block; } }
.ovhr-panel h3 { margin: 4px 0 10px; font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: var(--text-secondary, #a8b3c4); }
.ovhr-facts { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 12px; margin: 0 0 16px; font-size: 13.5px; }
.ovhr-facts dt { color: var(--text-muted, #8b93a3); } .ovhr-facts dd { margin: 0; overflow-wrap: anywhere; }
.ovhr-outs { list-style: none; margin: 0 0 16px; padding: 0; display: grid; gap: 6px; }
.ovhr-outs a { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 10px; border-radius: 10px; border: 1px solid var(--border, rgba(255,255,255,.1)); color: inherit; text-decoration: none; font-size: 13.5px; overflow-wrap: anywhere; }
.ovhr-outs span:only-child { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 10px; border-radius: 10px; border: 1px dashed var(--border, rgba(255,255,255,.1)); font-size: 13.5px; overflow-wrap: anywhere; }
.ovhr-outs a.is-pr { border-color: color-mix(in srgb, var(--accent, #3b82f6) 50%, transparent); }
.ovhr-tabs { display: none; }
@media (max-width: 899px) {
  .ovhr, .ovhr.has-run { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .ovhr-tabs { display: flex; gap: 4px; padding: 6px 8px; border-bottom: 1px solid var(--border, rgba(255,255,255,.08)); }
  .ovhr-tabs button { flex: 1; min-height: 40px; border: 0; border-radius: 10px; background: none; color: var(--text-secondary, #a8b3c4); font: inherit; font-weight: 650; cursor: pointer; }
  .ovhr-tabs button[aria-selected="true"] { background: var(--bg-hover, rgba(255,255,255,.08)); color: var(--text-primary, #e8edf5); }
  .ovhr-side, .ovhr-main, .ovhr-panel { display: none; border: 0; }
  .ovhr[data-tab="projects"] .ovhr-side, .ovhr[data-tab="task"] .ovhr-main, .ovhr[data-tab="changes"] .ovhr-panel { display: flex; flex-direction: column; }
  .ovhr[data-tab="changes"] .ovhr-panel { display: block; }
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
        q.addEventListener('input', () => drawProjects());
        top.append(newBtn, find);
        const projects = el('div', 'ovhr-projects');
        side.append(top, projects);

        // The thread column: its head, then the network's own thread and box.
        const main = el('section', 'ovhr-main');
        main.setAttribute('aria-label', 'Task');
        const head = el('div', 'ovhr-head');
        const threadHost = el('div', 'ovhr-thread');
        main.append(head, threadHost);

        // The changes column.
        const panel = el('aside', 'ovhr-panel');
        panel.setAttribute('aria-label', 'Changes');

        wrap.append(tabs, side, main, panel);
        host.append(wrap);

        let runs = [];
        let openRef = String(o.open || '');
        let openRun = null;
        let target = o.target || 'new';
        let view = null;
        let timer = null;
        let destroyed = false;

        function knownProjects() {
            const seen = new Map();
            for (const r of runs) { const p = projectOf(r); if (!seen.has(p.key)) seen.set(p.key, p); }
            for (const repo of o.repos || []) { const p = projectOf({ target: { repo } }); if (!seen.has(p.key)) seen.set(p.key, p); }
            for (const p of [projectOf({ target: 'openvibe' }), projectOf({ target: 'new' })]) if (!seen.has(p.key)) seen.set(p.key, p);
            return [...seen.values()];
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
            // A new task: what it works on.
            const label = el('label', 'ovhr-chip');
            label.append(svg(I.repo), el('span', null, 'Works on'));
            const pick = el('select');
            pick.setAttribute('aria-label', 'What the new task works on');
            for (const p of knownProjects()) {
                const opt = el('option', null, p.name);
                opt.value = p.key;
                if (projectOf({ target }).key === p.key) opt.selected = true;
                pick.append(opt);
            }
            pick.addEventListener('change', () => { const p = knownProjects().find((x) => x.key === pick.value); if (p) blank(p.target); });
            head.append(label, pick);
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
            view = root.OpenVibeRun.mount(threadHost, { ...o, ...opts, filter: 'code', start: { kind: 'code', target, ...(o.start && o.start.context ? { context: o.start.context } : {}) },
                // A coding start, not a chat: what the task works on, and what happens to it.
                blankIcon: 'code',
                blankTitle: p.key === 'new' ? 'A new project' : p.key === 'openvibe' ? 'Improve OpenVibe' : `New task in ${where}`,
                blankLine: p.key === 'new' ? 'Say what to build. An agent makes it in a project of its own, and you can open it, change it and ship it.'
                    : 'Say what to build or fix. Codes picks the agent that fits it, works on its own branch and opens a pull request when it is done.',
                placeholder: p.key === 'new' ? 'What should it build?' : 'Describe the change, the bug or what to build',
                starters: o.starters || (p.key === 'new' ? [['code', 'A one-page site for my stream'], ['code', 'A small browser game'], ['code', 'A goal bar overlay']]
                    : [['code', 'Fix the failing tests'], ['code', 'Add a dark mode'], ['code', 'Write a README']]),
                onPlace: (p) => { if (p && p.ref && p.ref !== openRef) { openRef = String(p.ref); loadOpen(); } try { if (typeof o.onPlace === 'function') o.onPlace(p); } catch { /* */ } },
                onBack: () => blank() });
        }

        async function loadOpen() {
            if (!openRef) { openRun = null; drawHead(); drawPanel(); drawProjects(); return; }
            const known = runs.find((r) => String(r.ref || r.id) === openRef);
            if (known) openRun = known;
            try { const r = await call(`/${encodeURIComponent(openRef)}`); if (r && (r.ref || r.id)) openRun = r.run || r; } catch { /* the list's copy stays */ }
            drawHead(); drawPanel(); drawProjects();
        }

        async function refresh() {
            try {
                const out = await call('?kind=code&limit=100');
                runs = (Array.isArray(out.runs) ? out.runs : []).filter((r) => !r.kind || r.kind === 'code');
            } catch { /* keep what is shown */ }
            if (openRef) await loadOpen(); else { drawProjects(); drawHead(); drawPanel(); }
            schedule();
        }
        function schedule() {
            if (destroyed) return;
            clearTimeout(timer);
            const busy = runs.some((r) => ['planning', 'running', 'waiting'].includes(r.status));
            timer = setTimeout(() => { if (!document.hidden) refresh(); else schedule(); }, busy ? 8000 : 30000);
        }

        function open(ref) {
            openRef = String(ref || '');
            remount({ open: openRef, blank: false });
            show('task');
            loadOpen();
        }
        function blank(t) {
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
            destroy() { destroyed = true; clearTimeout(timer); if (view) { try { view.destroy(); } catch { /* */ } } host.textContent = ''; },
        };
    }

    root.OpenVibeHarness = { page, projectOf, version: 1 };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.OpenVibeHarness;
})(typeof window !== 'undefined' ? window : globalThis);
