/**
 * ov-run.js (openvibe-shared 4.224.0): the one run thread. Everything a person asks an AI to do on OpenVibe is a run
 * with a thread of steps (a chat with Vibe, a task for an agent, a coding task); this draws every one of them the same
 * way, on every site, from the Frame's Run API (Network /api/frame/runs, Contracts `agents.run@1`, `agents.step@1`,
 * `agents.event@1`). The owner, 11-12, crossing out the menu's Chat · Code · Agents switch: "one new unified agent …
 * a shared UI … a full conversation with rich embedding … agent mode".
 *
 *   const view = OpenVibeRun.mount(host, {
 *     base: 'https://openvibe.network/api/frame',   // the Frame (default)
 *     token: () => token,                            // the person's Network token (or a string)
 *     me: { name, avatar_url },                      // the person, for their own bubbles
 *     sibling: (file) => url,                        // where ov-composer.js is (the navbar's sibling())
 *     examples: ['A goal bar for my stream', …],     // what people make, shown in turn in the empty box
 *     start: { kind, target, context },              // what a new run starts with (the box's defaults)
 *   });
 *   view.list('code'); view.open('chat:c_8f3k2m'); view.start('A goal bar for my stream'); view.prefill('Words, unsent');
 *   view.destroy();
 *   (o.filter: the list's first filter, all | chat | task | code; o.open: a run's ref to open first)
 *
 * 4.225.0, what the menu's Vibe needs to be the one place (the Dock's Vibe and Agents panels did all of it):
 *   o.starters: [[glyph, words], …]  things to ask, as chips above the box (All and Chats); a press starts that run
 *   o.actions: { base }               the Action Center's waiting and running work from every product (Network
 *                                     GET /api/v1/me/actions), merged into the list (All and Tasks) when a run does not
 *                                     already show it; approved or declined in place, and opened on its own page
 *   o.top(el) → { destroy }           something of the host's above the list (All and Tasks): the menu puts the Dock's
 *                                     Now, your Actor and the live agent view there
 *   o.panes: { chat, task, code }     a filter the host still draws itself: pane(el) → { destroy }. The menu's Vibe
 *                                     lends the Dock's Vibe, Agents and Code panels here until this view does all
 *                                     they do; the pane replaces the rows and the box under the filters
 *   o.onPlace({ filter } | { ref })   where the person is, for the host to remember
 *   view.prefill(text)                the words in the list's box, unsent (Ask your agent)
 *
 *   OpenVibeRun.card(type, (data, step, ctx) => Node)   a rich card for a step's `ui.type` (a site or a mod adds its
 *                                                       own); an unknown type shows the step's words.
 *
 * 4.240.0, one agent (the owner, 11-13: "all this separation of tasks and codes and chats … we shouldn't even have
 * that. It's just like filters … your actor is just your agent … it can orchestrate to openvibe.codes, or timer, task,
 * desktop, browser"):
 *   o.agent: true | { name }          your agent heads the list: its face, its state and today's spend (the Frame's
 *                                     /actor, Actor's GET /api/v1/me/actor), Pause or Resume; a tap on it shows its work
 *   the filters are chips over one list, never modes; one box starts everything (no kind: the Frame hands the words to
 *   chat, Codes, a task or a machine), and the thread opens at once with your words and your agent typing. A run your
 *   agent handed on says where it went ("Sent to Codes").
 *
 * The list: needs-you first, then newest, filtered All · Chats · Tasks · Code; each run is its agent's face (glyph and
 * hue, or its picture, with what it is doing), its title, its last line and when. The thread: your words on the right,
 * the agent's on the left (paragraphs, lists, links, code, numbered sources), thinking folded, each tool one quiet row,
 * an approval as a card with its buttons, child runs as rows, files as chips. It follows the run live (the stream,
 * resumed after its last step) and the composer below says the next thing, or starts a new run from the list.
 */
(function (root) {
    'use strict';
    if (root.OpenVibeRun || typeof document === 'undefined') return;

    // ── glyphs (the registry's drawings, openvibe-shared/glyphs.js; 24-unit strokes) ──
    const G = {
        back: '<path d="M20.8 12H4M10.3 5.7l-6.3 6.3l6.3 6.3"/>',
        open: '<path d="M7 17L17 7M9 7h8v8"/>',
        send: '<path d="M12 19.5V5M5.8 11.2L12 5l6.2 6.2"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        spark: '<path d="M10.4 3.6l1.7 4.8L17 10.1l-4.8 1.7L10.4 16.7l-1.7-4.8L3.9 10.1l4.8-1.7ZM17 14.8l0.8 2.1L19.8 17.6l-2.1 0.8L17 20.3l-0.8-2.1L14.3 17.6l2.1-0.8Z"/>',
        chat: '<path d="M3.8 4.3h16.8v11.7H8l-4.2 4.2Z"/>',
        code: '<path d="M7.8 7.8l-4.2 4.2l4.2 4.2M16.2 7.8l4.2 4.2l-4.2 4.2M14.2 4.6l-4.2 14.8"/>',
        robot: '<rect x="5.4" y="8.3" width="13.2" height="10.4" rx="2.8"/><path d="M12 4.6v3.8M9.2 13.1h0M14.8 13.1h0M9.6 16.4h4.7"/>',
        tool: '<path d="M14.6 3.6a5.2 5.2 0 0 0-4.6 7.3L3.7 17.3V20.3h3.1l6.4-6.4a5.2 5.2 0 0 0 7.3-4.6l-3.2 1.2l-2.5-2.5l1.2-3.2Z"/>',
        think: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3Z"/>',
        file: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5"/>',
        check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
        x: '<path d="M7 7l10 10M17 7L7 17"/>',
        pr: '<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="M6 8.2v7.6M18 15.8V9a3 3 0 0 0-3-3h-4M13 4l-2 2 2 2"/>',
        link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
        child: '<path d="M6 4v8a4 4 0 0 0 4 4h8M14 12l4 4-4 4"/>',
        clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
        search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
        book: '<path d="M12 6.3C10 4.8 7 4.3 3.5 4.9v13.2c3.5-0.6 6.5-0.1 8.5 1.4c2-1.5 5-2 8.5-1.4V4.9C17 4.3 14 4.8 12 6.3Z"/><path d="M12 6.3v13.2"/>',
        pencil: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
        live: '<circle cx="12" cy="11.8" r="2"/><path d="M8.6 8.4a4.9 4.9 0 0 0 0 7.1M15.4 8.4a4.9 4.9 0 0 1 0 7.1M6.3 6.1a8.1 8.1 0 0 0 0 11.9M17.7 6.1a8.1 8.1 0 0 1 0 11.9"/>',
        store: '<path d="M3.7 8.8L5.3 3.7h13.4L20.3 8.8M3.7 8.8h16.5v1.6a2.8 2.8 0 0 1-5.4 0a2.8 2.8 0 0 1-5.6 0A2.8 2.8 0 0 1 3.7 10.4ZM4.8 12.9v7.2h14.5v-7.2"/>',
        game: '<rect x="3.7" y="7.2" width="16.7" height="9.7" rx="4.4"/><path d="M7.6 10.7v2.7M6.4 12h2.7M15.1 11.6h0M17.4 12.9h0"/>',
        compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1Z"/>',
        page: '<path d="M6.5 3h7.5l4 4v14h-11.5Z"/><path d="M14 3v4h4M9.5 12h5M9.5 15.5h5"/>',
        timer: '<path d="M12 4.5a8.2 8.2 0 1 1 0 16.4 8.2 8.2 0 0 1 0-16.4zM12 8.6v4.2l2.7 1.7M9.6 2.6h4.8"/>',
        bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15ZM10 20.5a2.2 2.2 0 0 0 4 0"/>',
        calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
        phone: '<path d="M6.5 3.8h3l1.5 4-2 1.3a10.5 10.5 0 0 0 5.9 5.9l1.3-2 4 1.5v3a1.8 1.8 0 0 1-2 1.8A15.5 15.5 0 0 1 4.7 5.8a1.8 1.8 0 0 1 1.8-2Z"/>',
    };
    const KIND_GLYPH = { chat: 'chat', ask: 'search', task: 'robot', code: 'code', machine: 'tool', goal: 'spark' };
    const KIND_WORD = { chat: 'Chat', ask: 'Answer', task: 'Task', code: 'Code', machine: 'Machine', goal: 'Goal' };
    const SERVICE_NAME = { actor: 'Actor', codes: 'Codes', ai: 'AI', network: 'OpenVibe', run: 'Run', domains: 'Domains' };
    const svg = (name, cls = '') => {
        const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); if (cls) s.setAttribute('class', cls);
        s.innerHTML = G[name] || G.spark;   // the registry's constants above, never page text
        return s;
    };
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; };
    const httpsUrl = (v) => { try { const u = new URL(String(v)); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
    const hueOf = (id) => { let x = 7; for (const c of String(id || 'ov')) x = (x * 31 + c.codePointAt(0)) % 360; return x; };
    const ago = (iso) => {
        const t = Date.parse(iso || ''); if (!t) return '';
        const s = Math.max(1, Math.round((Date.now() - t) / 1000));
        if (s < 60) return 'now'; if (s < 3600) return `${Math.round(s / 60)} min ago`; if (s < 86400) return `${Math.round(s / 3600)} h ago`;
        const d = Math.round(s / 86400); return d === 1 ? 'yesterday' : `${d} days ago`;
    };
    const needsPerson = (r) => !!r && r.status === 'waiting' && !!r.waiting && r.waiting.for !== 'message';
    const isEnd = (r) => !!r && ['done', 'failed', 'stopped'].includes(r.status);

    // ── rich cards ──
    const CARDS = new Map();
    function card(type, render) { if (typeof type === 'string' && /^[a-z][a-z0-9-]{0,40}$/.test(type) && typeof render === 'function') CARDS.set(type, render); }
    card('results', (data) => {
        const row = el('div', 'ovr-chips');
        for (const r of (Array.isArray(data.results) ? data.results : []).slice(0, 12)) {
            const c = el('span', 'ovr-chip'); c.append(svg(r.kind === 'timer' ? 'timer' : r.kind === 'reminder' ? 'clock' : 'check'), el('span', '', r.label || r.text || r.kind || 'Done'));
            if (r.undone) c.classList.add('is-undone');
            row.append(c);
        }
        return row;
    });
    card('table', (data) => {
        const wrap = el('div', 'ovr-table-wrap'); const t = el('table', 'ovr-table');
        const cols = Array.isArray(data.columns) ? data.columns.slice(0, 8) : [];
        if (cols.length) { const tr = el('tr'); cols.forEach((c) => tr.append(el('th', '', c))); const th = el('thead'); th.append(tr); t.append(th); }
        const tb = el('tbody');
        for (const row of (Array.isArray(data.rows) ? data.rows : []).slice(0, 50)) { const tr = el('tr'); (Array.isArray(row) ? row : []).slice(0, 8).forEach((v) => tr.append(el('td', '', v))); tb.append(tr); }
        t.append(tb); wrap.append(t); return wrap;
    });
    card('link', (data) => {
        const url = httpsUrl(data.url); if (!url) return null;
        const a = el('a', 'ovr-linkcard'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        const img = httpsUrl(data.image); if (img) { const i = el('img'); i.src = img; i.alt = ''; i.loading = 'lazy'; a.append(i); }
        const t = el('span', 'ovr-linkcard-t'); t.append(el('b', '', data.title || url), el('small', '', data.site || new URL(url).hostname)); a.append(t);
        return a;
    });
    card('code', (data) => { const pre = el('pre', 'ovr-code'); pre.append(el('code', '', String(data.code || data.text || '').slice(0, 20000))); return pre; });

    // ── words: paragraphs, lists, links, inline code, numbered sources ──
    function words(text, sources) {
        const box = el('div', 'ovr-words');
        const raw = String(text || '').replace(/\r\n/g, '\n').slice(0, 65536);
        const blocks = raw.split(/\n{2,}/);
        for (const b of blocks) {
            const lines = b.split('\n');
            if (lines.every((l) => /^\s*[-*•]\s+/.test(l) || !l.trim())) {
                const ul = el('ul'); lines.filter((l) => l.trim()).forEach((l) => { const li = el('li'); inline(li, l.replace(/^\s*[-*•]\s+/, ''), sources); ul.append(li); }); box.append(ul);
            } else if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l) || !l.trim())) {
                const ol = el('ol'); lines.filter((l) => l.trim()).forEach((l) => { const li = el('li'); inline(li, l.replace(/^\s*\d+[.)]\s+/, ''), sources); ol.append(li); }); box.append(ol);
            } else if (/^```/.test(b.trim())) {
                const pre = el('pre', 'ovr-code'); pre.append(el('code', '', b.trim().replace(/^```[a-z0-9]*\n?/i, '').replace(/```$/, ''))); box.append(pre);
            } else { const p = el('p'); lines.forEach((l, i) => { if (i) p.append(el('br')); inline(p, l, sources); }); box.append(p); }
        }
        return box;
    }
    function inline(node, text, sources) {
        const re = /(https?:\/\/[^\s<>"')\]]+)|`([^`]{1,200})`|\*\*([^*]{1,200})\*\*|\[(\d{1,2})\]/g;
        let last = 0, m;
        while ((m = re.exec(text))) {
            if (m.index > last) node.append(document.createTextNode(text.slice(last, m.index)));
            if (m[1]) { const a = el('a', 'ovr-a', m[1]); a.href = m[1]; a.target = '_blank'; a.rel = 'nofollow noopener noreferrer'; node.append(a); }
            else if (m[2]) node.append(el('code', 'ovr-ic', m[2]));
            else if (m[3]) node.append(el('strong', '', m[3]));
            else if (m[4]) {
                const src = (sources || []).find((s) => Number(s.n) === Number(m[4]));
                const url = src && httpsUrl(src.url);
                if (url) { const a = el('a', 'ovr-cite', m[4]); a.href = url; a.target = '_blank'; a.rel = 'nofollow noopener noreferrer'; a.title = src.title || src.site || url; node.append(a); }
                else node.append(document.createTextNode(m[0]));
            }
            last = m.index + m[0].length;
        }
        if (last < text.length) node.append(document.createTextNode(text.slice(last)));
    }

    // ── an agent's face: its picture, or its glyph on its hue; what it is doing as a small badge ──
    function face(run, size = 'm') {
        const a = (run && run.agent) || {};
        const f = el('span', `ovr-face is-${size}`);
        f.style.setProperty('--ovr-h', String(Number.isInteger(a.hue) ? a.hue : hueOf(a.id || (run && run.kind))));
        const pic = httpsUrl(a.avatar_url);
        if (pic) { const i = el('img'); i.src = pic; i.alt = ''; i.loading = 'lazy'; f.append(i); }
        else f.append(svg(G[a.glyph] ? a.glyph : KIND_GLYPH[run && run.kind] || 'spark'));
        if (run && run.doing && run.status === 'running') { const d = el('i', 'ovr-doing'); d.append(svg(G[run.doing.glyph] ? run.doing.glyph : 'spark')); f.append(d); f.classList.add('is-working'); }
        if (needsPerson(run)) f.classList.add('is-needs');
        return f;
    }
    function statusLine(run) {
        if (!run) return '';
        if (needsPerson(run)) return (run.waiting && run.waiting.what) || 'Needs you';
        if (run.status === 'running') return (run.doing && run.doing.text) || 'Working';
        if (run.status === 'planning') return 'Starting';
        if (run.status === 'waiting') return 'Your turn';
        return { done: 'Done', failed: 'Did not finish', stopped: 'Stopped' }[run.status] || '';
    }

    // ── the stream: a fetch reader over server-sent events (EventSource cannot send a bearer) ──
    function follow({ url, headers, after, onEvent, signal }) {
        let last = String(after || 0);
        let stopped = false;
        const once = async () => {
            const r = await fetch(url, { headers: { ...headers, Accept: 'text/event-stream', 'Last-Event-ID': last }, signal, credentials: 'omit' });
            if (!r.ok || !r.body) throw new Error(`stream ${r.status}`);
            const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
            for (;;) {
                const { value, done } = await reader.read(); if (done) return 'closed';
                buf += dec.decode(value, { stream: true });
                let i;
                while ((i = buf.indexOf('\n\n')) >= 0) {
                    const raw = buf.slice(0, i); buf = buf.slice(i + 2);
                    let id = null, event = 'message', data = '';
                    for (const line of raw.split('\n')) {
                        if (line.startsWith('id:')) id = line.slice(3).trim();
                        else if (line.startsWith('event:')) event = line.slice(6).trim();
                        else if (line.startsWith('data:')) data += line.slice(5).trim();
                    }
                    let d = null; try { d = JSON.parse(data); } catch { d = null; }
                    if (event === 'step' && id && /^\d+$/.test(id) && Number(id) > Number(last)) last = id;
                    if (onEvent(event, d) === 'end') return 'end';
                }
            }
        };
        (async () => {
            let failures = 0;
            while (!stopped && !(signal && signal.aborted)) {
                try { const how = await once(); failures = 0; if (how === 'end') return; }
                catch { if (signal && signal.aborted) return; failures++; }
                await new Promise((r) => setTimeout(r, Math.min(30000, 800 * 2 ** Math.min(failures, 5))));
            }
        })();
        return () => { stopped = true; };
    }

    const FILTERS = [['all', 'All', 'spark'], ['chat', 'Chats', 'chat'], ['task', 'Tasks', 'robot'], ['code', 'Code', 'code']];
    const FILTER_IDS = FILTERS.map(([id]) => id);

    function mount(host, o = {}) {
        styles();
        const base = String(o.base || 'https://openvibe.network/api/frame').replace(/\/+$/, '');
        const tokenOf = () => (typeof o.token === 'function' ? o.token() : o.token) || '';
        const headers = () => { const t = tokenOf(); return t ? { Authorization: `Bearer ${t}` } : {}; };
        const api = async (path, init = {}) => {
            const r = await fetch(`${base}/runs${path}`, { ...init, credentials: 'omit', headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...headers(), ...(init.headers || {}) } });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) { const e = new Error(j.error || `The runs did not answer (${r.status})`); e.status = r.status; e.code = j.code; throw e; }
            return j;
        };
        const box = el('div', 'ovr');
        host.textContent = ''; host.append(box);
        const actionsBase = o.actions ? String(o.actions.base || 'https://openvibe.network').replace(/\/+$/, '') : '';
        const place = (p) => { try { if (typeof o.onPlace === 'function') o.onPlace(p); } catch { /* the host's */ } };
        let topHandle = null, paneHandle = null, paneId = null;
        const dropTop = () => { if (topHandle && typeof topHandle.destroy === 'function') { try { topHandle.destroy(); } catch { /* */ } } topHandle = null; };
        const dropPane = () => { if (paneHandle && typeof paneHandle.destroy === 'function') { try { paneHandle.destroy(); } catch { /* */ } } paneHandle = null; paneId = null; };
        const paneFor = (f) => (o.panes && typeof o.panes[f] === 'function' ? o.panes[f] : null);
        /** The Action Center's items (common.action-item@1) that need you or are working, as rows beside the runs. */
        async function actionRows(runs) {
            if (!actionsBase || !['all', 'task'].includes(state.filter)) return [];
            try {
                const r = await fetch(`${actionsBase}/api/v1/me/actions`, { headers: { Accept: 'application/json', ...headers() }, credentials: 'omit' });
                if (!r.ok) return [];
                const doc = await r.json();
                const shown = new Set(runs.map((x) => x.ref));
                runs.forEach((x) => { if (x.waiting && x.waiting.approval) shown.add(`approval:${x.waiting.approval}`); });
                const out = [];
                for (const bucket of ['waiting', 'running']) {
                    for (const it of (doc && doc.buckets && Array.isArray(doc.buckets[bucket]) ? doc.buckets[bucket] : []).slice(0, 30)) {
                        if (!it || typeof it.id !== 'string' || shown.has(`${it.service}:${it.id}`) || (it.kind === 'approval' && shown.has(`approval:${it.id}`))) continue;
                        out.push({
                            action: it, id: it.id, kind: it.kind === 'code_task' ? 'code' : 'task', title: it.title, url: it.href,
                            status: bucket === 'waiting' ? 'waiting' : 'running', updated_at: it.updated_at,
                            waiting: bucket === 'waiting' ? { for: 'approval', what: it.summary || it.title } : null,
                            doing: bucket === 'running' ? { text: it.step || it.summary || 'Working', glyph: it.kind === 'code_task' ? 'code' : 'robot' } : null,
                            preview: it.summary ? { text: it.summary } : null,
                            agent: { id: `${it.service}`, name: it.agent || SERVICE_NAME[it.service] || 'OpenVibe', glyph: it.kind === 'code_task' ? 'code' : it.kind === 'ai_run' ? 'spark' : 'robot' },
                        });
                    }
                }
                return out;
            } catch { return []; }
        }
        const state = { view: 'list', filter: FILTER_IDS.includes(o.filter) ? o.filter : 'all', runs: [], run: null, steps: new Map(), stopStream: null, abort: null, gen: 0 };
        // Your agent (4.240.0): one, whatever it is doing. The Frame relays Actor's /api/v1/me/actor (every site's
        // connect-src allows openvibe.network); its name and picture are the person's choice, "Vibe" until they choose.
        let agent = null, agentAt = 0;
        const agentName = () => String((agent && agent.name) || (o.agent && o.agent.name) || 'Vibe').slice(0, 40);
        const agentState = () => { const a = agent; if (!a) return 'resting'; if (a.status === 'paused' || a.enabled === false) return 'paused'; if (Array.isArray(a.asks) && a.asks.length) return 'asks'; return a.status === 'working' ? 'working' : 'resting'; };
        function agentFace(size, st) {
            const f = el('span', `ovr-face is-${size} ovr-me is-${st || agentState()}`);
            f.style.setProperty('--ovr-h', String(hueOf(agentName())));
            const pic = agent && agent.avatar && httpsUrl(agent.avatar.url);
            if (pic) { const i = el('img'); i.src = pic; i.alt = ''; f.append(i); } else f.append(svg('spark'));
            return f;
        }
        async function loadAgent() {
            if (!o.agent || !tokenOf()) return null;
            if (agentAt && Date.now() - agentAt < 20000) return agent;
            try { const r = await fetch(`${base}/actor`, { credentials: 'omit', headers: { Accept: 'application/json', ...headers() } }); agent = r.ok ? await r.json() : null; }
            catch { agent = null; }
            agentAt = Date.now();
            return agent;
        }
        const money = (v) => `$${(Number(v) || 0).toFixed(2)}`;
        const AGENT_WORD = { working: 'Working', asks: 'Asks you something', resting: 'Ready', paused: 'Paused' };
        /** The list's head: your agent, what it is doing, and the one action that fits. */
        function paintAgent(slot) {
            slot.textContent = '';
            if (!o.agent || !tokenOf()) { slot.hidden = true; return; }
            slot.hidden = false;
            const st = agentState();
            const card = el('div', `ovr-agent is-${st}`);
            const who = el('button', 'ovr-agent-who'); who.type = 'button';
            who.setAttribute('aria-label', `${agentName()}, your agent: ${AGENT_WORD[st]}. Show its work`);
            const now = (agent && agent.now) || {};
            const step = st === 'working' ? String(now.current_step || '').slice(0, 120) : st === 'asks' ? String((agent.asks[0] && agent.asks[0].text) || '').slice(0, 120) : '';
            const cap = agent && agent.caps && Number(agent.caps.usd) > 0 ? ` of ${money(agent.caps.usd)}` : '';
            const t = el('span', 'ovr-agent-t');
            const top = el('span', 'ovr-agent-top'); top.append(el('b', '', agentName()), el('i', 'ovr-agent-tag', 'your agent'));
            t.append(top, el('span', 'ovr-agent-line', [AGENT_WORD[st], step, agent ? `${money(now.cost_today)}${cap} today` : ''].filter(Boolean).join(' · ')));
            who.append(agentFace('m', st), t);
            who.addEventListener('click', () => list('task'));
            card.append(who);
            if (agent && agent.id) {
                const paused = st === 'paused';
                const go = el('button', `ovr-agent-go${paused ? ' is-main' : ''}`); go.type = 'button';
                go.setAttribute('aria-label', paused ? `Resume ${agentName()}` : `Pause ${agentName()}`); go.title = paused ? 'Resume' : 'Pause';
                go.innerHTML = paused ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13M15.5 5.5v13"/></svg>';
                go.addEventListener('click', async () => {
                    go.disabled = true;
                    try { const r = await fetch(`${base}/actor/${paused ? 'resume' : 'pause'}`, { method: 'POST', credentials: 'omit', headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers() }, body: '{}' }); if (r.ok) { agentAt = 0; await loadAgent(); } }
                    catch { /* the row stays as it was */ }
                    if (slot.isConnected) paintAgent(slot);
                });
                card.append(go);
            }
            slot.append(card);
        }

        function clearStream() { if (state.stopStream) state.stopStream(); state.stopStream = null; if (state.abort) state.abort.abort(); state.abort = null; }

        // ── the composer: the shared one when it is there, else a plain box ──
        function composer(where, { placeholder, onSend }) {
            const slot = el('div', 'ovr-compose');
            where.append(slot);
            const plain = () => {
                const f = el('form', 'ovr-plain'); const ta = el('textarea'); ta.rows = 2; ta.placeholder = placeholder; ta.setAttribute('aria-label', placeholder);
                const go = el('button', 'ovr-send'); go.type = 'submit'; go.setAttribute('aria-label', 'Send'); go.append(svg('send'));
                f.append(ta, go);
                f.addEventListener('submit', async (e) => {
                    e.preventDefault(); const t = ta.value.trim(); if (!t) return; go.disabled = true;
                    const old = slot.querySelector('.ovr-note'); if (old) old.remove();
                    try { if (await onSend({ text: t }) !== false) ta.value = ''; }
                    catch (err) { slot.append(el('p', 'ovr-note is-err', (err && err.message) || 'That did not send')); }
                    finally { go.disabled = false; }
                });
                ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true })); } });
                slot.append(f);
            };
            const C = root.OpenVibeComposer;
            const real = () => {
                try {
                    // The composer notes a failed send itself and keeps the words.
                    root.OpenVibeComposer.mount(slot, { preset: 'agent', placeholder, label: placeholder, examples: o.examples, user: o.me, noDraft: true,
                        onSubmit: (v) => onSend({ text: v.text, files: v.files, mode: v.mode }) });
                } catch { slot.textContent = ''; plain(); }
            };
            if (C && C.mount) real();
            else if (typeof o.sibling === 'function') {
                let sc = document.getElementById('ov-composer-script');
                if (!sc) { sc = document.createElement('script'); sc.id = 'ov-composer-script'; sc.async = true; sc.src = o.sibling('ov-composer.js'); document.head.appendChild(sc); }
                plain();
                sc.addEventListener('load', () => { if (slot.isConnected && root.OpenVibeComposer) { const was = (slot.querySelector('textarea') || {}).value || ''; slot.textContent = ''; real(); if (was) { const ta = slot.querySelector('textarea'); if (ta) { ta.value = was; ta.dispatchEvent(new Event('input', { bubbles: true })); } } } }, { once: true });   // words put in the plain box (Ask your agent) carry over
            } else plain();
        }

        /** A new run with these words (Vibe answers, or hands the work on), then its thread. */
        async function start(text) {
            const words = String(text || '').slice(0, 16000);
            const gen0 = pending(words);
            let run;
            try { run = await api('', { method: 'POST', headers: { 'Idempotency-Key': `ovr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}` }, body: JSON.stringify({ ...(o.start || {}), text: words }) }); }
            catch (err) {
                // It did not start: back to the list, the words back in the box, and why, in plain words.
                if (gen0 !== state.gen) return null;
                await list();
                const foot = box.querySelector('.ovr-list-note'); if (foot) foot.prepend(el('p', 'ovr-note is-err', err.status === 401 ? 'Sign in to talk to your agent.' : (err && err.message) || 'That did not start. Try again.'));
                const ta = box.querySelector('.ovr-compose textarea'); if (ta && !ta.value) { ta.value = words; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); }
                return null;
            }
            if (gen0 !== state.gen) return run;   // the person went elsewhere while it started
            open(run.ref || run.id, run, { said: words });
            return run;
        }
        /** The thread before the run exists: your words on the right, your agent typing on the left. */
        function pending(words) {
            clearStream(); dropTop(); dropPane();
            const gen = ++state.gen;
            state.view = 'thread'; state.run = null; state.steps = new Map();
            box.textContent = ''; box.className = 'ovr is-thread is-pending';
            const head = el('div', 'ovr-thead');
            const back = el('button', 'ovr-ib'); back.type = 'button'; back.setAttribute('aria-label', 'Back to your runs'); back.append(svg('back'));
            back.addEventListener('click', () => list());
            const who = el('div', 'ovr-who'); who.append(el('b', '', agentName()), el('small', '', 'Starting'));
            head.append(back, agentFace('s', 'working'), who);
            const thread = el('div', 'ovr-thread'); thread.setAttribute('role', 'log'); thread.setAttribute('aria-live', 'polite');
            const me = el('div', 'ovr-step is-you'); const b = el('div', 'ovr-bubble'); b.append(document.createTextNode(words)); me.append(b);
            thread.append(me, typing());
            box.append(head, thread);
            return gen;
        }
        function typing() { const t = el('div', 'ovr-typing'); t.setAttribute('aria-label', `${agentName()} is writing`); t.append(el('i'), el('i'), el('i')); return t; }


        // ── the list ──
        async function list(filter) {
            if (filter && FILTER_IDS.includes(filter)) state.filter = filter;
            clearStream();
            const gen = ++state.gen;
            // The list's frame (filters, the box) is drawn once; a filter only reloads the rows, so the words being typed stay.
            if (state.view !== 'list' || !box.querySelector('.ovr-rows')) {
                state.view = 'list'; state.run = null;
                box.textContent = ''; box.className = 'ovr is-list';
                const head = el('div', 'ovr-head');
                const tabs = el('div', 'ovr-filters'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Show');
                for (const [id, label, ic] of FILTERS) {
                    const b = el('button', 'ovr-filter'); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.filter = id;
                    b.append(svg(ic), el('span', '', label));
                    b.addEventListener('click', () => { if (state.filter !== id || state.view !== 'list') list(id); });
                    tabs.append(b);
                }
                tabs.addEventListener('keydown', (e) => {
                    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                    const all = [...tabs.children]; const k = all.indexOf(document.activeElement); if (k < 0) return;
                    const next = all[(k + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
                    e.preventDefault(); next.focus(); next.click();
                });
                head.append(tabs);
                const me = el('div', 'ovr-agent-slot'); me.hidden = true;
                if (o.agent) { box.append(me); paintAgent(me); loadAgent().then(() => { if (me.isConnected) paintAgent(me); }); }
                const rows = el('ul', 'ovr-rows'); rows.setAttribute('aria-label', 'Your runs');
                const foot = el('div', 'ovr-list-note');
                const top = el('div', 'ovr-top');
                const pane = el('div', 'ovr-pane'); pane.hidden = true;
                box.append(head, top, rows, foot, pane);
                dropTop(); dropPane();
                if (Array.isArray(o.starters) && o.starters.length) {
                    const st = el('div', 'ovr-starters'); st.setAttribute('role', 'group'); st.setAttribute('aria-label', 'Things to ask');
                    o.starters.slice(0, 8).forEach((x) => {
                        const [ic, words] = Array.isArray(x) ? x : ['spark', String(x)];
                        const b = el('button', 'ovr-starter'); b.type = 'button'; b.append(svg(G[ic] ? ic : 'spark'), el('span', '', words));
                        b.addEventListener('click', async () => { b.disabled = true; try { await start(words); } catch (err) { b.disabled = false; foot.textContent = ''; foot.append(el('p', 'ovr-note is-err', err.message)); } });
                        st.append(b);
                    });
                    box.append(st);
                }
                composer(box, { placeholder: o.placeholder || (o.agent ? 'Ask, or say what to do' : 'Ask, or say what to make'), onSend: (v) => start(v.text) });
            }
            place({ filter: state.filter });
            box.querySelectorAll('.ovr-filter').forEach((b) => { const on = b.dataset.filter === state.filter; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
            // A filter the host draws itself (a pane): it takes the place of the rows, the starters and the box. The host's
            // pieces may share one owner (the Dock lends one panel at a time), so the old one goes before the new one comes.
            const pf = paneFor(state.filter);
            const topEl = box.querySelector('.ovr-top'), paneEl = box.querySelector('.ovr-pane');
            const wantTop = !pf && typeof o.top === 'function';   // 4.240.0: Now (timers) and an agent at work show on every filter
            if (!wantTop) { dropTop(); topEl.textContent = ''; }
            if (paneId !== (pf ? state.filter : null)) { dropPane(); paneEl.textContent = ''; }
            box.classList.toggle('has-pane', !!pf);
            paneEl.hidden = !pf; topEl.hidden = !wantTop;
            { const st = box.querySelector('.ovr-starters'); if (st) st.hidden = !!pf || !['all', 'chat'].includes(state.filter); }
            if (pf) {
                if (!paneHandle) { paneId = state.filter; try { paneHandle = pf(paneEl) || {}; } catch { paneHandle = {}; } }
                const rows0 = box.querySelector('.ovr-rows'); rows0.textContent = ''; rows0.removeAttribute('aria-busy'); box.querySelector('.ovr-list-note').textContent = '';
                return;
            }
            if (wantTop && !topHandle) { try { topHandle = o.top(topEl) || null; } catch { topHandle = null; } }
            const rows = box.querySelector('.ovr-rows'); const foot = box.querySelector('.ovr-list-note');
            rows.textContent = ''; foot.textContent = ''; rows.setAttribute('aria-busy', 'true');
            for (let i = 0; i < 3; i++) rows.append(el('li', 'ovr-row is-ghost'));
            let out;
            try { out = await api(`?limit=40${state.filter !== 'all' ? `&kind=${state.filter}` : ''}`); }
            catch (err) {
                if (gen !== state.gen) return;
                rows.textContent = ''; rows.removeAttribute('aria-busy');
                foot.append(empty(err.status === 401 ? 'Sign in to see your runs' : 'Your runs did not load', err.status === 401 ? 'Your chats, tasks and code are here once you sign in.' : 'Check your connection; they come back on their own.'));
                return;
            }
            if (gen !== state.gen) return;
            state.runs = Array.isArray(out.runs) ? out.runs : [];
            const extra = await actionRows(state.runs);
            if (gen !== state.gen) return;
            if (extra.length) {
                // What needs you first, then newest: the Action Center's rows join in that order.
                const needs = (r) => (needsPerson(r) ? 1 : 0);
                state.runs = state.runs.concat(extra).sort((x, y) => needs(y) - needs(x) || String(y.updated_at || '').localeCompare(String(x.updated_at || '')));
            }
            rows.textContent = ''; rows.removeAttribute('aria-busy');
            if (!state.runs.length) foot.append(empty('Nothing here yet', state.filter === 'code' ? 'Say what to build below: a page, a fix, controls for your stream. Your agent hands it to Codes.' : o.agent ? `Ask ${agentName()} anything below. It answers, sets timers and reminders, and hands coding and computer work on.` : 'Ask anything below. Chats, tasks and code you start show up here.'));
            state.runs.forEach((r, i) => { const li = el('li'); li.append(row(r, i)); const acts = answerRow(r); if (acts) { li.classList.add('has-acts'); li.append(acts); } rows.append(li); });
            if (Array.isArray(out.partial) && out.partial.length) foot.append(el('p', 'ovr-note', `Some of your runs did not load (${out.partial.join(', ')}).`));
        }
        function row(r, i) {
            const away = r.action ? httpsUrl(r.url) : '';
            const b = away ? el('a', `ovr-row${needsPerson(r) ? ' is-needs' : ''}`) : el('button', `ovr-row${needsPerson(r) ? ' is-needs' : ''}`);
            if (away) { b.href = away; b.target = '_blank'; b.rel = 'noopener'; } else b.type = 'button';
            b.style.setProperty('--i', String(Math.min(i, 12)));
            const t = el('span', 'ovr-row-t');
            const top = el('span', 'ovr-row-top'); top.append(el('b', '', r.title || (r.agent && r.agent.name) || KIND_WORD[r.kind] || 'Run'), el('time', '', ago(r.updated_at)));
            const line = el('span', 'ovr-row-line', needsPerson(r) || r.status === 'running' ? statusLine(r) : (r.preview && r.preview.text) || statusLine(r));
            const meta = el('span', 'ovr-row-meta'); meta.append(svg(KIND_GLYPH[r.kind] || 'spark'), el('span', '', [KIND_WORD[r.kind] || 'Task', r.agent && r.agent.name && r.agent.name !== r.title ? r.agent.name : ''].filter(Boolean).join(' · ')));
            if (needsPerson(r)) meta.append(el('i', 'ovr-pill is-needs', 'Needs you'));
            else if (r.status === 'running') meta.append(el('i', 'ovr-pill is-working', 'Working'));
            else if (r.status === 'failed') meta.append(el('i', 'ovr-pill is-failed', 'Did not finish'));
            t.append(top, line, meta);
            b.append(face(r), t);
            if (!away) b.addEventListener('click', () => open(r.ref || r.id, r));
            return b;
        }
        /** A run that asks before it acts is answered from the list (the Action Center's approve in place). */
        function answerRow(r) {
            const w = r && r.waiting;
            const it = r && r.action;
            if (it && !(needsPerson(r) && Array.isArray(it.actions) && it.actions.includes('approve'))) return null;
            if (!it && (!needsPerson(r) || w.for !== 'approval' || !w.approval || !/^[A-Za-z0-9._~-]{1,160}$/.test(String(w.approval)))) return null;
            const box2 = el('div', 'ovr-row-acts');
            const say = (text, err) => { box2.textContent = ''; box2.append(el('p', `ovr-note${err ? ' is-err' : ''}`, text)); };
            [['approve', 'Approve', true], ['decline', 'Not now', false]].forEach(([id, label, primary]) => {
                const b = el('button', primary ? 'ovr-btn is-primary' : 'ovr-btn', label); b.type = 'button';
                b.setAttribute('aria-label', `${label}: ${r.title || 'this run'}`);
                b.addEventListener('click', async () => {
                    [...box2.querySelectorAll('button')].forEach((x) => { x.disabled = true; });
                    try {
                        if (it) {
                            const res = await fetch(`${actionsBase}/api/v1/me/actions/${encodeURIComponent(it.service)}/${encodeURIComponent(it.id)}/${id}`, { method: 'POST', credentials: 'omit', headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers() }, body: '{}' });
                            if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.detail || j.error || j.title || `That did not go through (${res.status})`); }
                        } else await api(`/${encodeURIComponent(r.ref || r.id)}/approvals/${encodeURIComponent(w.approval)}`, { method: 'POST', body: JSON.stringify({ answer: id }) });
                        say(id === 'approve' ? 'Approved' : 'Declined');
                    }
                    catch (err) { [...box2.querySelectorAll('button')].forEach((x) => { x.disabled = false; }); box2.append(el('p', 'ovr-note is-err', err.message)); }
                });
                box2.append(b);
            });
            return box2;
        }
        function empty(title, sub) { const e = el('div', 'ovr-empty'); e.append(svg('spark')); const w = el('div'); w.append(el('b', '', title), el('span', '', sub)); e.append(w); return e; }

        // ── the thread ──
        async function open(ref, known, how = {}) {
            clearStream();
            dropTop(); dropPane();
            const gen = ++state.gen;
            state.view = 'thread'; state.run = known || null; state.steps = new Map();
            place({ ref });
            box.textContent = ''; box.className = 'ovr is-thread';
            const head = el('div', 'ovr-thead');
            const back = el('button', 'ovr-ib'); back.type = 'button'; back.setAttribute('aria-label', 'Back to your runs'); back.title = 'Your runs'; back.append(svg('back'));
            back.addEventListener('click', () => list());
            const who = el('div', 'ovr-who'); const title = el('b'); const sub = el('small');
            who.append(title, sub);
            const away = el('a', 'ovr-ib'); away.setAttribute('aria-label', 'Open on its own page'); away.title = 'Open on its own page'; away.target = '_blank'; away.rel = 'noopener'; away.append(svg('open'));
            const faceSlot = el('span', 'ovr-face-slot');
            head.append(back, faceSlot, who, away);
            const thread = el('div', 'ovr-thread'); thread.setAttribute('role', 'log'); thread.setAttribute('aria-live', 'polite');
            box.append(head, thread);
            const paintHead = (r) => {
                state.run = r;
                faceSlot.textContent = ''; faceSlot.append(face(r, 's'));
                title.textContent = r.title || (r.agent && r.agent.name) || 'Run';
                sub.textContent = [KIND_WORD[r.kind] || 'Task', statusLine(r)].filter(Boolean).join(' · ');
                const url = httpsUrl(r.url); away.hidden = !url; if (url) away.href = url;
                box.classList.toggle('is-needs', needsPerson(r));
            };
            if (known) paintHead(known);
            // A run your agent handed on (it started from the one box and is not a chat) says where it went.
            const WENT = { code: ['code', 'Sent to Codes: it works on the code and shows you the change'], task: ['robot', `Sent to ${agentName()}'s tasks: it works on it and asks before anything that matters`], machine: ['tool', 'Sent to your computer: it runs there and shows you each step'], goal: ['spark', 'A goal: your agent plans the steps'] };
            if (how.said && known && WENT[known.kind]) { const w = el('p', 'ovr-went'); w.append(svg(WENT[known.kind][0]), el('span', '', WENT[known.kind][1])); thread.append(w); }
            let wait = null;
            if (how.said) { const me = el('div', 'ovr-step is-you is-said'); const b = el('div', 'ovr-bubble'); b.append(document.createTextNode(how.said)); me.append(b); thread.append(me); wait = typing(); thread.append(wait); }
            composer(box, { placeholder: 'Say the next thing', onSend: async (v) => { const step = await api(`/${encodeURIComponent(ref)}/messages`, { method: 'POST', body: JSON.stringify({ text: v.text }) }); add(step); } });
            const add = (s) => {
                if (!s || !Number.isInteger(s.seq)) return;
                // Your words came back as a step: the stand-in goes. Your agent's first words: the typing goes.
                if (s.kind === 'message' && (s.from === 'person') && how.said) { const said = thread.querySelector(':scope > .is-said'); if (said) said.remove(); }
                if (wait && !(s.kind === 'message' && s.from === 'person')) { wait.remove(); wait = null; }
                if (state.steps.has(s.seq)) { const old = state.steps.get(s.seq); const n = stepNode(s); old.replaceWith(n); state.steps.set(s.seq, n); return; }
                const wasNear = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 160;
                const none = thread.querySelector(':scope > .ovr-none'); if (none) none.remove();
                const n = stepNode(s);
                state.steps.set(s.seq, n);
                const after = [...state.steps.keys()].filter((k) => k > s.seq).sort((a, b) => a - b)[0];
                if (after !== undefined && state.steps.get(after).parentNode === thread) thread.insertBefore(n, state.steps.get(after)); else thread.append(n);
                if (wasNear) requestAnimationFrame(() => { thread.scrollTop = thread.scrollHeight; });
            };
            try {
                const [r, page] = await Promise.all([api(`/${encodeURIComponent(ref)}`), api(`/${encodeURIComponent(ref)}/steps?limit=200`)]);
                if (gen !== state.gen) return;
                paintHead(r);
                (page.steps || []).forEach(add);
                requestAnimationFrame(() => { thread.scrollTop = thread.scrollHeight; });
                if (!(page.steps || []).length && !how.said) thread.append(el('p', 'ovr-note ovr-none', 'Nothing here yet.'));
                if (wait) thread.append(wait);   // still writing: the dots stay last
            } catch (err) { if (gen !== state.gen) return; thread.append(empty('This run did not load', err.message)); return; }
            if (isEnd(state.run)) return;
            const last = Math.max(0, ...state.steps.keys());
            state.abort = new AbortController();
            state.stopStream = follow({ url: `${base}/runs/${encodeURIComponent(ref)}/events`, headers: headers(), after: last, signal: state.abort.signal,
                onEvent(event, d) {
                    if (gen !== state.gen) return 'end';
                    if (event === 'step' && d && d.step) add(d.step);
                    else if (event === 'delta' && d && state.steps.has(d.seq)) { const w = state.steps.get(d.seq).querySelector('.ovr-words'); if (w) w.append(document.createTextNode(String(d.text || ''))); }
                    else if (event === 'run' && d && d.run) paintHead(d.run);
                    else if (event === 'end') { if (state.run) paintHead({ ...state.run, status: (d && d.status) || 'done' }); return 'end'; }
                    return null;
                } });
        }

        function stepNode(s) {
            const from = s.from || (s.kind === 'message' ? 'agent' : 'agent');
            if (s.kind === 'message' && from === 'person') {
                const n = el('div', 'ovr-step is-you'); const b = el('div', 'ovr-bubble'); b.append(words(s.text)); n.append(b);
                attachments(n, s); return n;
            }
            if (s.kind === 'message' || (s.kind !== 'tool' && s.kind !== 'think' && s.kind !== 'approval' && s.kind !== 'child' && s.kind !== 'file' && s.text)) {
                const n = el('div', `ovr-step is-agent${s.status === 'running' ? ' is-writing' : ''}`);
                if (s.author && s.author.name) n.append(el('small', 'ovr-author', s.author.name));
                n.append(words(s.text, s.sources));
                cardFor(n, s);
                if (Array.isArray(s.sources) && s.sources.length) {
                    const src = el('div', 'ovr-sources');
                    s.sources.slice(0, 12).forEach((x) => { const url = httpsUrl(x.url); if (!url) return; const a = el('a', 'ovr-source'); a.href = url; a.target = '_blank'; a.rel = 'nofollow noopener noreferrer'; a.append(el('i', '', String(x.n)), el('span', '', x.title || x.site || new URL(url).hostname)); src.append(a); });
                    n.append(src);
                }
                attachments(n, s); return n;
            }
            if (s.kind === 'think') {
                const d = el('details', 'ovr-step is-think'); const sm = el('summary'); sm.append(svg('think'), el('span', '', s.title || 'Thinking'));
                d.append(sm); if (s.text) d.append(words(s.text)); return d;
            }
            if (s.kind === 'approval') {
                const n = el('div', 'ovr-step is-approval'); const head = el('div', 'ovr-approval-h'); head.append(svg('check'), el('b', '', s.title || 'It asks before it goes on'));
                n.append(head); if (s.text) n.append(words(s.text));
                const r = s.result && typeof s.result === 'object' ? s.result : {};
                const opts = Array.isArray(r.options) ? r.options : [{ id: 'approve', label: 'Approve' }, { id: 'decline', label: 'Not now' }];
                const row = el('div', 'ovr-approval-acts');
                opts.slice(0, 4).forEach((op, i) => {
                    const b = el('button', i === 0 ? 'ovr-btn is-primary' : 'ovr-btn', op.label || op.id); b.type = 'button';
                    b.addEventListener('click', async () => {
                        [...row.children].forEach((x) => { x.disabled = true; });
                        try { await api(`/${encodeURIComponent(state.run.ref || state.run.id)}/approvals/${encodeURIComponent(r.approval || r.id || String(s.seq))}`, { method: 'POST', body: JSON.stringify({ answer: op.id }) }); row.replaceWith(el('p', 'ovr-note', `You answered: ${op.label || op.id}`)); }
                        catch (err) { [...row.children].forEach((x) => { x.disabled = false; }); n.append(el('p', 'ovr-note is-err', err.message)); }
                    });
                    row.append(b);
                });
                if (!r.answer) n.append(row); else n.append(el('p', 'ovr-note', `Answered: ${r.answer}`));
                return n;
            }
            // tool, child, file: one quiet row
            const n = el(s.text && s.kind === 'tool' ? 'details' : 'div', `ovr-step is-row is-${s.kind}${s.status === 'running' ? ' is-running' : s.status === 'failed' ? ' is-failed' : ''}`);
            const line = el(s.text && s.kind === 'tool' ? 'summary' : 'div', 'ovr-row-step');
            const glyph = G[s.glyph] ? s.glyph : s.kind === 'child' ? 'child' : s.kind === 'file' ? 'file' : 'tool';
            line.append(svg(glyph), el('span', '', s.title || (s.tool_call && s.tool_call.name) || (s.kind === 'file' ? s.text : s.kind === 'child' ? 'A helper took part of the work' : 'A step')));
            if (s.status === 'running') line.append(el('i', 'ovr-pulse'));
            if (s.status === 'failed') line.append(svg('x', 'ovr-fail'));
            n.append(line);
            if (s.text && s.kind === 'tool') n.append(words(s.text));
            if (s.kind === 'child' && s.child_run) { n.classList.add('is-link'); n.addEventListener('click', () => open(s.child_run)); }
            return n;
        }
        function cardFor(n, s) {
            if (!s.ui || !s.ui.type) return;
            const render = CARDS.get(s.ui.type); if (!render) return;
            try { const c = render(s.ui.data || {}, s, { open }); if (c) { c.classList && c.classList.add('ovr-card'); n.append(c); } } catch { /* the words above say it */ }
        }
        function attachments(n, s) {
            const list = Array.isArray(s.attachments) ? s.attachments : []; if (!list.length) return;
            const row = el('div', 'ovr-files');
            list.slice(0, 8).forEach((a) => {
                const url = httpsUrl(a.url);
                if (a.kind === 'image' && url) { const i = el('img', 'ovr-thumb'); i.src = url; i.alt = a.alt || ''; i.loading = 'lazy'; row.append(i); }
                else { const c = el('span', 'ovr-chip'); c.append(svg('file'), el('span', '', a.name || a.kind)); row.append(c); }
            });
            n.append(row);
        }

        /** Words in the list's box, unsent, with the focus there (a page's "Ask your agent"). */
        function prefill(text) {
            if (state.view !== 'list' || paneFor(state.filter)) list(paneFor(state.filter) ? 'all' : undefined);
            const put = (n = 0) => {
                const ta = box.querySelector('.ovr-compose textarea');
                if (!ta) { if (n < 40) setTimeout(() => put(n + 1), 50); return; }
                ta.value = String(text || '').slice(0, 16000);
                ta.dispatchEvent(new Event('input', { bubbles: true }));
                try { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); } catch { /* */ }
            };
            put();
        }
        const view = { list, open, start, prefill, destroy() { clearStream(); dropTop(); dropPane(); state.gen++; host.textContent = ''; }, get state() { return { view: state.view, run: state.run, filter: state.filter }; } };
        if (o.open) open(o.open); else list();
        return view;
    }

    let styled = false;
    function styles() {
        if (styled || document.getElementById('ovr-styles')) { styled = true; return; }
        styled = true;
        const st = document.createElement('style'); st.id = 'ovr-styles';
        st.textContent = `
.ovr { --ovr-gap: 12px; display: flex; flex-direction: column; min-height: 0; height: 100%; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--text-primary, #e6edf7); }
.ovr svg { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.ovr-head { padding: 4px 4px 8px; }
.ovr-filters { display: flex; gap: 6px; overflow-x: auto; padding: 2px 2px 4px; scrollbar-width: none; }
.ovr-filters::-webkit-scrollbar { display: none; }
.ovr-filter { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 42px; border-radius: 12px; cursor: pointer; font-family: 'OV Brand', Nunito, Inter, sans-serif; font-weight: 800; font-size: 14px; color: var(--text-secondary, #a8b3c4); transition: background-color .18s, color .18s; }
.ovr-filter[aria-selected="true"] { color: var(--text-primary, #e6edf7); background: var(--bg-secondary, #121826); box-shadow: 0 1px 2px rgba(0,0,0,.3), inset 0 0 0 1px color-mix(in srgb, var(--accent, #3b82f6) 35%, transparent); }
.ovr-filter[aria-selected="true"] svg { color: var(--accent-light, var(--accent, #60a5fa)); }
.ovr-filter:focus-visible, .ovr-row:focus-visible, .ovr-ib:focus-visible, .ovr-btn:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
@media (max-width: 380px) { .ovr-filter { font-size: 13px; gap: 5px; } .ovr-filter svg { width: 16px; height: 16px; } }
.ovr-rows { flex: 0 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: grid; align-content: start; gap: 6px; margin: 0; padding: 2px 4px 10px; list-style: none; }
.ovr-rows > li { display: grid; min-width: 0; }
.ovr-rows > li.has-acts { border-radius: 16px; background: color-mix(in srgb, #f59e0b 7%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, #f59e0b 50%, transparent); }
.ovr-rows > li.has-acts > .ovr-row { background: transparent; box-shadow: none; }
.ovr-row-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 0 12px 12px 72px; }
.ovr-row-acts .ovr-btn { min-height: 38px; font-size: 13.5px; }
.ovr-row-acts .ovr-note { margin: 0; }
@media (max-width: 380px) { .ovr-row-acts { padding-left: 12px; } }
.ovr-rows:empty { display: none; } .ovr-list-note:empty { display: none; } .ovr-list-note { padding: 0 4px; }
.ovr.is-list > .ovr-compose, .ovr.is-list > .ovr-starters:not([hidden]) { margin-top: auto; }
.ovr.is-list > .ovr-starters:not([hidden]) + .ovr-compose { margin-top: 0; }
/* On a wide screen the list, the thread and the box keep a reading column. */
.ovr-head, .ovr-top, .ovr-rows, .ovr-list-note, .ovr-starters, .ovr-compose, .ovr-thead { width: 100%; max-width: 780px; margin-inline: auto; box-sizing: border-box; }
.ovr-thread { padding-inline: max(4px, calc((100% - 772px) / 2)); }
.ovr-row { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 12px; min-height: 72px; padding: 10px 12px; border-radius: 16px; cursor: pointer; background: color-mix(in srgb, var(--text-primary, #e6edf7) 4%, transparent); box-shadow: inset 0 0 0 1px var(--border, rgba(255,255,255,.07)); transition: background-color .15s, transform .15s; animation: ovr-rise .3s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 18ms); }
.ovr-row.is-needs { box-shadow: inset 0 0 0 1px color-mix(in srgb, #f59e0b 50%, transparent); background: color-mix(in srgb, #f59e0b 7%, transparent); }
.ovr-row:active { transform: scale(.985); }
@media (hover: hover) and (pointer: fine) { .ovr-row:hover { background: color-mix(in srgb, var(--text-primary, #e6edf7) 8%, transparent); } }
.ovr-row.is-ghost { min-height: 72px; animation: ovr-shimmer 1.4s ease-in-out infinite; cursor: default; }
.ovr-row-t { flex: 1; min-width: 0; display: grid; gap: 3px; }
.ovr-row-top { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.ovr-row-top b { flex: 1; min-width: 0; font-family: 'OV Brand', Nunito, Inter, sans-serif; font-size: 15px; font-weight: 800; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
.ovr-row-top time { flex: none; font-size: 12px; color: var(--text-muted, #93a0b4); }
.ovr-row-line { font-size: 13.5px; color: var(--text-secondary, #a8b3c4); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; line-height: 1.35; }
.ovr-row-meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted, #93a0b4); }
.ovr-row-meta svg { width: 14px; height: 14px; }
.ovr-pill { font-style: normal; font-size: 11.5px; font-weight: 750; padding: 1px 8px; border-radius: 999px; margin-left: auto; }
.ovr-pill.is-needs { color: #fbbf24; background: color-mix(in srgb, #f59e0b 16%, transparent); }
.ovr-pill.is-working { color: var(--accent-light, #60a5fa); background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); }
.ovr-pill.is-failed { color: #f87171; background: color-mix(in srgb, #ef4444 14%, transparent); }
.ovr-face { position: relative; flex: none; display: grid; place-items: center; border-radius: 30%; color: hsl(var(--ovr-h, 215) 92% 84%); background: linear-gradient(150deg, hsl(var(--ovr-h, 215) 72% 58% / .4), hsl(var(--ovr-h, 215) 70% 38% / .22)); box-shadow: inset 0 0 0 1px hsl(var(--ovr-h, 215) 70% 64% / .3); }
:root[data-theme="light"] .ovr-face { color: hsl(var(--ovr-h, 215) 70% 30%); }
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) .ovr-face { color: hsl(var(--ovr-h, 215) 70% 30%); } }
.ovr-face.is-m { width: 48px; height: 48px; } .ovr-face.is-m > svg { width: 26px; height: 26px; }
/* 4.238.0 (the owner, 11-13: "waste of space … only a tiny bit of space between"): the list is tight, its rows one
   line of title and time, one of what came back, their face a size down. */
.ovr-rows { gap: 4px; padding: 0 2px 8px; }
.ovr-row { min-height: 60px; gap: 10px; padding: 8px 10px; border-radius: 14px; }
.ovr-row-t { gap: 1px; }
.ovr-row-line { -webkit-line-clamp: 1; }
.ovr-rows .ovr-face.is-m { width: 40px; height: 40px; border-radius: 12px; } .ovr-rows .ovr-face.is-m > svg { width: 22px; height: 22px; }
.ovr-row-acts { padding-left: 60px; }
.ovr-face.is-s { width: 38px; height: 38px; } .ovr-face.is-s > svg { width: 21px; height: 21px; }
.ovr-face img { width: 100%; height: 100%; border-radius: inherit; object-fit: cover; }
.ovr-face.is-needs { box-shadow: 0 0 0 2px #f59e0b; }
.ovr-face.is-working { animation: ovr-breathe 2.4s ease-in-out infinite; }
.ovr-doing { position: absolute; right: -4px; bottom: -4px; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; color: #fff; background: linear-gradient(140deg, var(--accent, #3b82f6), color-mix(in srgb, var(--accent, #3b82f6) 45%, #a855f7)); box-shadow: 0 0 0 2px var(--bg-secondary, #121826); }
.ovr-doing svg { width: 12px; height: 12px; stroke-width: 2.3; }
.ovr-empty { display: flex; align-items: center; gap: 14px; margin: 6px 0; padding: 16px; border-radius: 16px; border: 1px dashed color-mix(in srgb, var(--text-muted, #93a0b4) 45%, transparent); }
.ovr-empty > svg { width: 24px; height: 24px; color: var(--accent-light, #60a5fa); }
.ovr-empty > div { display: grid; gap: 2px; } .ovr-empty b { font-size: 14.5px; } .ovr-empty span { font-size: 13px; color: var(--text-muted, #93a0b4); }
.ovr-note { margin: 6px 4px; font-size: 13px; color: var(--text-muted, #93a0b4); } .ovr-note.is-err { color: #f87171; }
.ovr-compose { flex: none; padding: 8px 4px 4px; }
.ovr-top { flex: none; }
.ovr-pane { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; } .ovr-pane[hidden] { display: none; }
.ovr.has-pane > .ovr-rows, .ovr.has-pane > .ovr-list-note, .ovr.has-pane > .ovr-compose { display: none; } .ovr-top[hidden], .ovr-starters[hidden] { display: none; } .ovr-top:empty { display: none; }
.ovr-starters { flex: none; display: flex; gap: 6px; overflow-x: auto; padding: 8px 4px 0; scrollbar-width: none; -webkit-mask-image: linear-gradient(90deg, #000 92%, transparent); mask-image: linear-gradient(90deg, #000 92%, transparent); }
.ovr-starters::-webkit-scrollbar { display: none; }
.ovr-starter { all: unset; box-sizing: border-box; flex: none; display: inline-flex; align-items: center; gap: 7px; min-height: 38px; padding: 0 13px 0 10px; border-radius: 999px; cursor: pointer; font-size: 13.5px; white-space: nowrap; color: var(--text-secondary, #a8b3c4); background: color-mix(in srgb, var(--text-primary, #e6edf7) 6%, transparent); box-shadow: inset 0 0 0 1px var(--border, rgba(255,255,255,.07)); transition: background-color .15s, color .15s; }
.ovr-starter svg { width: 16px; height: 16px; color: var(--accent-light, #60a5fa); }
.ovr-starter:disabled { opacity: .5; cursor: default; } .ovr-starter:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
@media (hover: hover) and (pointer: fine) { .ovr-starter:hover { color: var(--text-primary, #e6edf7); background: color-mix(in srgb, var(--accent, #3b82f6) 12%, transparent); } }
a.ovr-row { color: inherit; text-decoration: none; }
.ovr-plain { display: flex; align-items: flex-end; gap: 8px; padding: 8px; border-radius: 18px; border: 1px solid var(--border, rgba(148,163,184,.2)); background: var(--bg-primary, rgba(0,0,0,.2)); }
.ovr-plain textarea { flex: 1; min-height: 40px; max-height: 160px; resize: none; border: 0; outline: 0; background: transparent; color: inherit; font: inherit; font-size: 15px; }
.ovr-send { all: unset; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; color: #fff; background: var(--accent-strong, var(--accent, #2563eb)); }
.ovr-thead { flex: none; display: flex; align-items: center; gap: 10px; padding: 4px 4px 10px; border-bottom: 1px solid var(--border, rgba(255,255,255,.07)); }
.ovr-ib { all: unset; box-sizing: border-box; flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; color: var(--text-secondary, #a8b3c4); background: color-mix(in srgb, var(--text-primary, #e6edf7) 7%, transparent); transition: background-color .15s, transform .12s; }
.ovr-ib[hidden] { display: none; } .ovr-ib:active { transform: scale(.92); }
@media (hover: hover) { .ovr-ib:hover { color: var(--text-primary, #e6edf7); background: color-mix(in srgb, var(--text-primary, #e6edf7) 13%, transparent); } }
.ovr-who { flex: 1; min-width: 0; display: grid; gap: 1px; }
.ovr-who b { font-family: 'OV Brand', Nunito, Inter, sans-serif; font-size: 15.5px; font-weight: 800; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ovr-who small { font-size: 12.5px; color: var(--text-secondary, #a8b3c4); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ovr.is-needs .ovr-who small { color: #fbbf24; }
.ovr-thread { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 10px; padding: 12px 4px; }
.ovr-step { max-width: min(640px, 92%); animation: ovr-rise .26s cubic-bezier(.2,.8,.2,1) both; }
.ovr-step.is-you { align-self: flex-end; }
.ovr-bubble { padding: 9px 13px; border-radius: 18px 18px 6px 18px; color: var(--on-accent-strong, #fff); background: var(--accent-strong, var(--accent, #2563eb)); }
.ovr-bubble .ovr-a { color: inherit; text-decoration-color: color-mix(in srgb, currentColor 55%, transparent); text-underline-offset: 2px; }
.ovr-step.is-agent { align-self: flex-start; padding: 10px 14px; border-radius: 18px 18px 18px 6px; background: color-mix(in srgb, var(--text-primary, #e6edf7) 6%, transparent); }
.ovr-step.is-writing .ovr-words > :last-child::after { content: ''; display: inline-block; width: .5em; height: 1em; margin-left: 2px; vertical-align: -2px; border-radius: 2px; background: currentColor; opacity: .5; animation: ovr-caret 1s steps(2) infinite; }
.ovr-author { display: block; margin-bottom: 3px; font-size: 12px; font-weight: 750; color: var(--text-muted, #93a0b4); }
.ovr-words { font-size: 15px; line-height: 1.5; overflow-wrap: anywhere; }
.ovr-words p { margin: 0; } .ovr-words p + p, .ovr-words p + ul, .ovr-words ul + p, .ovr-words ol + p, .ovr-words p + ol { margin-top: 8px; }
.ovr-words ul, .ovr-words ol { margin: 0; padding-left: 20px; } .ovr-words li + li { margin-top: 3px; }
.ovr-a { color: var(--accent-light, #60a5fa); text-decoration: underline; text-underline-offset: 2px; }
.ovr-ic { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9em; padding: 1px 5px; border-radius: 6px; background: color-mix(in srgb, var(--text-primary, #e6edf7) 9%, transparent); }
.ovr-cite { display: inline-grid; place-items: center; min-width: 18px; height: 18px; margin: 0 2px; padding: 0 4px; border-radius: 6px; font-size: 11px; font-weight: 800; text-decoration: none; vertical-align: 2px; color: var(--accent-light, #60a5fa); background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); }
.ovr-code { margin: 8px 0 0; padding: 10px 12px; border-radius: 12px; overflow-x: auto; font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; background: color-mix(in srgb, #000 30%, transparent); }
.ovr-sources { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.ovr-source { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 4px 10px 4px 4px; border-radius: 999px; font-size: 12.5px; color: var(--text-secondary, #a8b3c4); text-decoration: none; background: color-mix(in srgb, var(--text-primary, #e6edf7) 6%, transparent); }
.ovr-source i { font-style: normal; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; font-size: 11px; font-weight: 800; color: var(--accent-light, #60a5fa); background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); }
.ovr-source span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 220px; }
.ovr-card { margin-top: 10px; }
.ovr-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.ovr-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px 5px 8px; border-radius: 999px; font-size: 13px; background: color-mix(in srgb, var(--accent, #3b82f6) 13%, transparent); }
.ovr-chip svg { width: 15px; height: 15px; color: var(--accent-light, #60a5fa); } .ovr-chip.is-undone { opacity: .5; text-decoration: line-through; }
.ovr-table-wrap { overflow-x: auto; } .ovr-table { border-collapse: collapse; font-size: 13.5px; min-width: 100%; }
.ovr-table th, .ovr-table td { padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--border, rgba(255,255,255,.08)); } .ovr-table th { font-weight: 750; color: var(--text-secondary, #a8b3c4); }
.ovr-linkcard { display: flex; gap: 10px; align-items: center; padding: 8px; border-radius: 14px; color: inherit; text-decoration: none; background: color-mix(in srgb, var(--text-primary, #e6edf7) 5%, transparent); }
.ovr-linkcard img { width: 64px; height: 48px; object-fit: cover; border-radius: 10px; } .ovr-linkcard-t { display: grid; min-width: 0; } .ovr-linkcard-t b { font-size: 14px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; } .ovr-linkcard-t small { font-size: 12px; color: var(--text-muted, #93a0b4); }
.ovr-step.is-row, .ovr-step.is-think { align-self: flex-start; max-width: 100%; }
.ovr-row-step, .ovr-step.is-think > summary { display: flex; align-items: center; gap: 8px; min-height: 30px; padding: 2px 8px; border-radius: 10px; font-size: 13.5px; color: var(--text-secondary, #a8b3c4); cursor: default; list-style: none; }
.ovr-step.is-think > summary, details.ovr-step > .ovr-row-step { cursor: pointer; }
.ovr-step.is-think > summary::-webkit-details-marker, details.ovr-step > summary::-webkit-details-marker { display: none; }
.ovr-row-step svg, .ovr-step.is-think > summary svg { width: 16px; height: 16px; color: var(--text-muted, #93a0b4); }
.ovr-step.is-row.is-running .ovr-row-step { color: var(--text-primary, #e6edf7); }
.ovr-step.is-row.is-failed .ovr-row-step { color: #f87171; }
.ovr-step.is-row.is-link { cursor: pointer; }
.ovr-step.is-think .ovr-words, details.ovr-step.is-row .ovr-words { margin: 4px 0 2px 32px; font-size: 13.5px; color: var(--text-secondary, #a8b3c4); }
.ovr-pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-light, #60a5fa); animation: ovr-pulse 1.2s ease-in-out infinite; }
.ovr-fail { width: 15px; height: 15px; color: #f87171; }
.ovr-step.is-approval { align-self: stretch; max-width: 100%; padding: 12px 14px; border-radius: 16px; background: color-mix(in srgb, #f59e0b 8%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, #f59e0b 40%, transparent); }
.ovr-approval-h { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; } .ovr-approval-h svg { color: #fbbf24; }
.ovr-approval-acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.ovr-btn { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; min-height: 40px; padding: 0 16px; border-radius: 999px; cursor: pointer; font-weight: 750; font-size: 14px; background: color-mix(in srgb, var(--text-primary, #e6edf7) 9%, transparent); }
.ovr-btn.is-primary { color: var(--on-accent-strong, #fff); background: var(--accent-strong, var(--accent, #2563eb)); } .ovr-btn:disabled { opacity: .5; cursor: default; }
.ovr-files { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; } .ovr-step.is-you .ovr-files { justify-content: flex-end; }
.ovr-thumb { width: 120px; height: 90px; object-fit: cover; border-radius: 12px; }
/* 4.240.0: one agent. The filters are chips over one list; your agent heads it; the thread opens at once. */
.ovr-filter { flex: none; min-height: 36px !important; padding: 0 13px 0 11px; border-radius: 999px !important; font-size: 13.5px !important; gap: 6px !important; border: 1px solid color-mix(in srgb, var(--text-primary, #e6edf7) 12%, transparent); background: transparent !important; box-shadow: none !important; transition: background-color .2s, color .2s, border-color .2s, transform .18s cubic-bezier(.3,1.4,.4,1); }
.ovr-filter svg { width: 16px !important; height: 16px !important; }
.ovr-filter[aria-selected="true"] { color: var(--accent-light, #93c5fd) !important; border-color: color-mix(in srgb, var(--accent, #3b82f6) 55%, transparent); background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent) !important; }
.ovr-filter:active { transform: scale(.94); }
.ovr-agent-slot { flex: none; width: 100%; max-width: 780px; margin-inline: auto; box-sizing: border-box; }
.ovr-agent-slot[hidden] { display: none; }
.ovr-agent { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 6px; border-radius: 20px; background: linear-gradient(135deg, color-mix(in srgb, hsl(var(--ovr-ah, 220) 70% 55%) 14%, transparent), color-mix(in srgb, var(--text-primary, #e6edf7) 3%, transparent)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text-primary, #e6edf7) 9%, transparent); animation: ovr-rise .32s cubic-bezier(.2,.9,.3,1.1) both; }
.ovr-agent-who { all: unset; box-sizing: border-box; flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 2px 6px; border-radius: 14px; cursor: pointer; }
.ovr-agent-who:focus-visible, .ovr-agent-go:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
.ovr-agent-t { min-width: 0; display: grid; gap: 2px; }
.ovr-agent-top { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.ovr-agent-top b { font: 800 16px/1.2 'OV Brand', Nunito, Inter, sans-serif; color: var(--text-primary, #e6edf7); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovr-agent-tag { font-style: normal; font-size: 12px; font-weight: 650; color: var(--text-muted, #8b98ad); white-space: nowrap; }
.ovr-agent-line { font-size: 13px; color: var(--text-secondary, #a8b3c4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovr-agent.is-asks .ovr-agent-line { color: #fbbf24; }
.ovr-agent-go { all: unset; box-sizing: border-box; flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; color: var(--text-secondary, #a8b3c4); background: color-mix(in srgb, var(--text-primary, #e6edf7) 7%, transparent); transition: transform .18s cubic-bezier(.3,1.4,.4,1), background-color .2s; }
.ovr-agent-go svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; }
.ovr-agent-go.is-main { color: var(--on-accent, #fff); background: var(--accent, #3b82f6); box-shadow: 0 6px 18px -6px color-mix(in srgb, var(--accent, #3b82f6) 70%, transparent); }
.ovr-agent-go:active { transform: scale(.9); }
.ovr-agent-go:disabled { opacity: .5; }
.ovr-face.ovr-me { position: relative; }
.ovr-face.ovr-me::after { content: ""; position: absolute; right: -1px; bottom: -1px; width: 11px; height: 11px; border-radius: 50%; border: 2px solid var(--bg-secondary, #121826); background: #64748b; }
.ovr-face.ovr-me.is-resting::after { background: #22c55e; }
.ovr-face.ovr-me.is-working::after { background: var(--accent, #3b82f6); animation: ovr-pulse 1.2s ease-in-out infinite; }
.ovr-face.ovr-me.is-asks::after { background: #f59e0b; }
.ovr-face.ovr-me.is-working { animation: ovr-breathe 2.2s ease-in-out infinite; }
.ovr-face.ovr-me.is-paused { filter: saturate(.4); opacity: .8; }
.ovr-typing { align-self: flex-start; display: inline-flex; gap: 5px; padding: 12px 14px; margin: 2px 0 6px; border-radius: 18px 18px 18px 6px; background: color-mix(in srgb, var(--text-primary, #e6edf7) 7%, transparent); animation: ovr-rise .25s ease both; }
.ovr-typing i { width: 7px; height: 7px; border-radius: 50%; background: var(--text-secondary, #a8b3c4); animation: ovr-dot 1.1s ease-in-out infinite; }
.ovr-typing i:nth-child(2) { animation-delay: .15s; } .ovr-typing i:nth-child(3) { animation-delay: .3s; }
@keyframes ovr-dot { 0%, 60%, 100% { transform: translateY(0); opacity: .45; } 30% { transform: translateY(-4px); opacity: 1; } }
.ovr.is-pending .ovr-step.is-you, .ovr-step.is-said { animation: ovr-send .32s cubic-bezier(.2,.9,.3,1.1) both; }
@keyframes ovr-send { from { opacity: 0; transform: translateY(18px) scale(.96); } }
.ovr-went { display: flex; align-items: center; gap: 8px; align-self: center; max-width: 92%; margin: 4px auto 8px; padding: 7px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 650; color: var(--accent-light, #93c5fd); background: color-mix(in srgb, var(--accent, #3b82f6) 12%, transparent); animation: ovr-rise .3s ease both; }
.ovr-went svg { flex: none; width: 15px; height: 15px; }
html[data-ov-motion=reduced] .ovr-typing i, html[data-ov-motion=reduced] .ovr-face.ovr-me.is-working { animation-duration: 3s; }
html[data-ov-motion=off] :is(.ovr-agent, .ovr-typing, .ovr-typing i, .ovr-went, .ovr-step.is-said, .ovr-face.ovr-me, .ovr-face.ovr-me::after) { animation: none !important; }
@keyframes ovr-rise { from { opacity: 0; transform: translateY(6px); } }
@keyframes ovr-shimmer { 50% { opacity: .55; } }
@keyframes ovr-breathe { 50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent, #3b82f6) 22%, transparent); } }
@keyframes ovr-pulse { 50% { opacity: .35; transform: scale(.7); } }
@keyframes ovr-caret { 50% { opacity: 0; } }
html[data-ov-motion=reduced] .ovr-row, html[data-ov-motion=reduced] .ovr-step { animation-name: ovr-fade; animation-delay: 0s; }
@keyframes ovr-fade { from { opacity: 0; } }
html[data-ov-motion=reduced] .ovr-face.is-working { animation-duration: 5s; }
html[data-ov-motion=off] .ovr-row, html[data-ov-motion=off] .ovr-step, html[data-ov-motion=off] .ovr-face.is-working, html[data-ov-motion=off] .ovr-pulse, html[data-ov-motion=off] .ovr-row.is-ghost { animation: none; }
`;
        document.head.appendChild(st);
    }

    root.OpenVibeRun = { mount, card, version: 1 };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.OpenVibeRun;
})(typeof window !== 'undefined' ? window : globalThis);
