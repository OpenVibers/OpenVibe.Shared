/**
 * openvibe-shared/agent-session.js — a coding agent's session as people read it: what it said, the steps it took
 * (commands, files read and changed, searches, sub-agents) grouped and folded, each step's command, diff and OUTPUT
 * (live while it runs), hand-offs between agents, the plan it keeps, and a summary that stays at the top (4.24.0).
 *
 * The owner, 2026-10-28, showing the Claude app's session view ("Ran 3 commands", a Bash sheet saying "Output
 * unavailable"): "OpenVibe.Codes should… actually show the output from the agent… more user friendly… handle that
 * between all agents… in a smart way… way better than this idea."
 *
 *   const view = OpenVibeAgentSession.mount(el, { title, status: 'running', startedAt, link })
 *                             link(url) → boolean: which https addresses in the agents' text become links (default:
 *                             all; a site whose agents read untrusted pages links only its own, e.g. a person's desk)
 *   view.push(event)          one event: a Codes job line ({ t: 'tool', … }), any Claude Code stream-json event
 *                             ({ type: 'assistant', … }) or an OpenVibe.Actor task event ({ kind: 'output', step, … },
 *                             actor.task-event@1); every OpenVibe.Codes harness adapter (Claude Code, Codex, OpenCode,
 *                             Command Code, Aider, DeepSeek, OpenVibe.AI, your own model) and every Actor agent speaks one
 *   view.pushAll(events)
 *   view.status('succeeded' | 'failed' | 'cancelled' | 'running' | 'queued' | …, label?)
 *   view.actions([{ id, label, kind: 'primary' | 'danger' | undefined }], note?)
 *                             the sticky bar at the bottom (Approve, Continue, Stop…); opts.onAction(id) runs when one is
 *                             pressed (a returned promise keeps the buttons disabled until it settles); [] hides it
 *   view.summary()            → { agents, steps, commands, files, added, removed, problems, costUsd, durationMs }
 *   view.destroy()
 *   OpenVibeAgentSession.normalize(event) → [line]   the stream-json → line mapping, for servers and other readers
 *
 * The lines (Codes' job protocol 1.1, additive to 1.0):
 *   { t: 'agent', agent, model }                      an agent started (a hand-off starts the next one)
 *   { t: 'text', text, parent? }                      what it said (light Markdown: paragraphs, lists, code, links)
 *   { t: 'tool', id, name, what, input?, parent? }    a step began: Bash, Read, Edit, Write, Grep, Glob, LS,
 *                                                     WebFetch, WebSearch, Task (a sub-agent), TodoWrite (the plan)
 *   { t: 'tool_progress', id, chunk }                 output while it runs (agents whose steps the harness runs)
 *   { t: 'tool_result', id, ok, output, cost_usd?, duration_ms? }   how it ended, with its output (and its cost,
 *                                                     when the agent reports one: shown on the step's row)
 *   { t: 'handoff', from, to?, reason }               one agent stopped and the next took over
 *   { t: 'note', text, level? }                       a warning or an error along the way
 *   { t: 'step', text }                               the job's own progress (cloning, the branch, files changed, pushing)
 *   { t: 'usage', input_tokens, output_tokens }
 *   { t: 'done', ok, text, duration_ms, cost_usd, turns }
 * A line from a sub-agent carries `parent`: the id of the Task step that started it, so it nests under that step.
 * Any line may carry `agent` (the head then follows who is working); a step without an id gets one, and the next result
 * of the same tool without an id is its result. { t: 'state', state } moves the head (Actor's task states).
 *
 * Everything is text: no line's content ever becomes markup (links are https only). The look is agent-session.css
 * (4.32.0), linked from beside this script unless the page links it; it follows the page's theme tokens, light or dark.
 * The Files tab lists every file edited or written with its +/−; each step keeps its raw input (folded); the head shows
 * each agent's cost from its done line.
 */
(function (root) {
    'use strict';

    // ── What each step is ─────────────────────────────────────
    const KIND = {
        Bash: 'command', bash: 'command', run_command: 'command', shell: 'command', exec: 'command',
        Read: 'read', read_file: 'read', Grep: 'search', grep: 'search', Glob: 'search', LS: 'search', list_files: 'search', search: 'search',
        Edit: 'edit', MultiEdit: 'edit', edit_file: 'edit', NotebookEdit: 'edit', Write: 'write', write_file: 'write', apply_patch: 'edit',
        WebFetch: 'web', WebSearch: 'web', Task: 'agent', Agent: 'agent', TodoWrite: 'plan',
    };
    // A tool no table knows is judged by the words of its name (run_shell, readFile, web-fetch), never by letters inside
    // a word ("Frobnicate" is not a cat).
    function kindOf(name) {
        if (KIND[name]) return KIND[name];
        const w = new Set(String(name || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z]+/).filter(Boolean));
        const any = (...xs) => xs.some((x) => w.has(x));
        // The web first: web_search and web_fetch are looking things up, not searching files.
        return any('web', 'fetch', 'http', 'browse', 'url', 'internet') ? 'web' : any('bash', 'shell', 'command', 'exec', 'run', 'terminal') ? 'command' : any('edit', 'patch', 'replace') ? 'edit'
            : any('write', 'create') ? 'write' : any('read', 'cat', 'view', 'open') ? 'read' : any('grep', 'glob', 'find', 'search', 'list', 'ls') ? 'search' : 'tool';
    }
    const NOUN = { command: ['command', 'commands'], read: ['read', 'reads'], search: ['search', 'searches'], edit: ['edit', 'edits'], write: ['new file', 'new files'], web: ['lookup', 'lookups'], agent: ['helper', 'helpers'], plan: ['plan', 'plan'], tool: ['tool', 'tools'] };
    const VERB = {
        command: ['Ran a command', 'Ran %d commands'], read: ['Read a file', 'Read %d files'], search: ['Searched once', 'Searched %d times'],
        edit: ['Edited a file', 'Edited %d files'], write: ['Wrote a file', 'Wrote %d files'], web: ['Looked something up', 'Looked up %d things'],
        agent: ['Started a helper', 'Started %d helpers'], plan: ['Updated the plan', 'Updated the plan'], tool: ['Used a tool', 'Used %d tools'],
    };
    const ICON = {
        command: '<path d="M4 6l5 5-5 5"/><path d="M11 17h9"/>',
        read: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
        search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/>',
        edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
        write: '<path d="M6 3h8l4 4v14H6z"/><path d="M12 11v6M9 14h6"/>',
        web: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17"/>',
        agent: '<rect x="5" y="7" width="14" height="11" rx="3"/><path d="M12 3v4M9 12h.01M15 12h.01"/>',
        plan: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
        tool: '<path d="M14 7a4 4 0 0 0-5.6 5.1L4 16.5 7.5 20l4.4-4.4A4 4 0 0 0 17 10l-2.5 2.5-3-3z"/>',
        ok: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', fail: '<path d="M6 6l12 12M18 6 6 18"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
        handoff: '<path d="M4 12h13"/><path d="m13 7 5 5-5 5"/>', warn: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
        chevron: '<path d="m9 6 6 6-6 6"/>',
    };
    const svg = (name, cls) => `<svg class="${cls || 'ovas-ic'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ICON.tool}</svg>`;
    const AGENT_NAME = { claude: 'Claude Code', 'claude-code': 'Claude Code', codex: 'Codex', opencode: 'OpenCode', 'command-code': 'Command Code', cmd: 'Command Code', aider: 'Aider', deepseek: 'DeepSeek', 'openvibe-ai': 'OpenVibe.AI', ai: 'OpenVibe.AI', own: 'Your model' };
    const agentName = (a) => AGENT_NAME[String(a || '').toLowerCase()] || String(a || 'Agent');

    // ── stream-json → lines (the same mapping as harness/job.js) ─
    const MAX_TEXT = 6000;
    const cut = (s, n) => { const t = String(s == null ? '' : s); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
    function resultText(content) {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) return content.map((c) => (c && typeof c.text === 'string' ? c.text : '')).join('\n');
        return content == null ? '' : String(content);
    }
    // OpenVibe.Actor's task events (actor.task-event@1): { kind: 'state' | 'end', state } and { kind: 'output', step, agent,
    // text, tool, input, is_error }, step one of plan, text, handoff, check, tool_call, tool_result.
    function fromActor(e) {
        const agent = e.agent ? { agent: String(e.agent) } : {};
        if (e.kind === 'state' || e.kind === 'end') return e.state ? [{ t: 'state', state: String(e.state), ...agent }] : [];
        if (e.kind !== 'output') return [];
        const text = cut(e.text, MAX_TEXT);
        if (e.step === 'text') return [e.is_error ? { t: 'note', level: 'error', text, ...agent } : { t: 'text', text, ...agent }];
        if (e.step === 'plan') return [{ t: 'step', text, ...agent }];
        if (e.step === 'handoff') return [{ t: 'handoff', from: null, to: e.agent || null, reason: text, ...agent }];
        if (e.step === 'check') return [{ t: 'note', level: /^checked/i.test(text) ? 'info' : 'warning', text, ...agent }];
        if (e.step === 'tool_call') return [{ t: 'tool', name: String(e.tool || 'tool'), what: typeof e.input === 'string' ? cut(e.input, 300) : '', input: e.input && typeof e.input === 'object' ? e.input : { description: typeof e.input === 'string' ? cut(e.input, 300) : '' }, ...agent }];
        if (e.step === 'tool_result') return [{ t: 'tool_result', name: String(e.tool || 'tool'), ok: !e.is_error, output: cut(e.text, 8000), ...agent }];
        return text ? [{ t: 'text', text, ...agent }] : [];
    }
    function normalize(e) {
        if (!e || typeof e !== 'object') return [];
        if (e.t) return [e];
        if (e.kind) return fromActor(e);
        const parent = e.parent_tool_use_id || null;
        if (e.type === 'system' && e.subtype === 'init') return [{ t: 'agent', agent: e.agent || 'claude', model: e.model || null }];
        if (e.type === 'system' && e.subtype === 'handoff') return [{ t: 'handoff', from: e.from, to: e.to || null, reason: cut(e.reason, 600) }];
        if (e.type === 'system' && (e.subtype === 'error' || e.subtype === 'warning')) return [{ t: 'note', level: e.subtype, text: cut(e.text, 600) }];
        if (e.type === 'system' && e.subtype === 'tool_progress') return [{ t: 'tool_progress', id: String(e.tool_use_id || ''), chunk: String(e.text || '') }];
        if (e.type === 'system' && e.subtype === 'usage' && e.usage) return [{ t: 'usage', input_tokens: e.usage.input_tokens || 0, output_tokens: e.usage.output_tokens || 0 }];
        if (e.type === 'assistant' && e.message) {
            const out = [];
            for (const c of e.message.content || []) {
                if (c.type === 'text' && c.text) out.push({ t: 'text', text: cut(c.text, MAX_TEXT), parent });
                if (c.type === 'tool_use') out.push({ t: 'tool', id: String(c.id || ''), name: String(c.name || ''), input: c.input || {}, parent });
            }
            if (e.message.usage) out.push({ t: 'usage', input_tokens: e.message.usage.input_tokens || 0, output_tokens: e.message.usage.output_tokens || 0 });
            return out;
        }
        if (e.type === 'user' && e.message && Array.isArray(e.message.content)) {
            return e.message.content.filter((c) => c && c.type === 'tool_result').map((c) => ({ t: 'tool_result', id: String(c.tool_use_id || ''), ok: !c.is_error, output: cut(resultText(c.content), 8000) }));
        }
        if (e.type === 'result') return [{ t: 'done', ok: !e.is_error, text: cut(e.result, MAX_TEXT), duration_ms: e.duration_ms || 0, cost_usd: e.total_cost_usd || 0, turns: e.num_turns || 0 }];
        return [];
    }

    // ── Small helpers ─────────────────────────────────────────
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    const plural = (k, n) => (n === 1 ? VERB[k][0] : VERB[k][1].replace('%d', n));
    function dur(ms) {
        const s = Math.max(0, Math.round(ms / 1000));
        if (s < 60) return `${s} s`;
        const m = Math.floor(s / 60);
        return m < 60 ? `${m} min ${s % 60 ? `${s % 60} s` : ''}`.trim() : `${Math.floor(m / 60)} h ${m % 60} min`;
    }
    const base = (p) => String(p || '').split('/').filter(Boolean).pop() || String(p || '');

    /** Light Markdown, text-safe: paragraphs, bullet and numbered lists, `code`, ```blocks```, **bold**, https links (only
     *  those `linkOk(url)` allows; the others stay text). */
    function markdown(text, linkOk) {
        const frag = document.createDocumentFragment();
        const inline = (s, into) => {
            const re = /(`[^`]+`|\*\*[^*]+\*\*|https:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;
            let at = 0, m;
            while ((m = re.exec(s))) {
                if (m.index > at) into.appendChild(document.createTextNode(s.slice(at, m.index)));
                const tok = m[0];
                if (tok[0] === '`') into.appendChild(el('code', '', tok.slice(1, -1)));
                else if (tok.startsWith('**')) into.appendChild(el('strong', '', tok.slice(2, -2)));
                else if (linkOk && !linkOk(tok)) into.appendChild(document.createTextNode(tok));
                else { const a = el('a', '', tok); a.href = tok; a.target = '_blank'; a.rel = 'noopener noreferrer'; into.appendChild(a); }
                at = m.index + tok.length;
            }
            if (at < s.length) into.appendChild(document.createTextNode(s.slice(at)));
        };
        const blocks = String(text || '').replace(/\r/g, '').split(/\n```/);
        String(text || '').replace(/\r/g, '').split(/(```[\s\S]*?(?:```|$))/).forEach((part) => {
            if (!part) return;
            if (part.startsWith('```')) { const pre = el('pre', 'ovas-code'); pre.appendChild(el('code', '', part.replace(/^```[^\n]*\n?/, '').replace(/```$/, ''))); frag.appendChild(pre); return; }
            part.split(/\n{2,}/).forEach((para) => {
                const lines = para.split('\n').filter((l) => l.trim());
                if (!lines.length) return;
                if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
                    const ol = /^\s*\d/.test(lines[0]);
                    const list = el(ol ? 'ol' : 'ul');
                    lines.forEach((l) => { const li = el('li'); inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''), li); list.appendChild(li); });
                    frag.appendChild(list);
                } else { const p = el('p'); lines.forEach((l, i) => { if (i) p.appendChild(el('br')); inline(l.replace(/^#{1,6}\s+/, ''), p); }); frag.appendChild(p); }
            });
        });
        void blocks;
        return frag;
    }

    /** A line diff of two texts (LCS for small inputs, both sides whole beyond): [['=', line] | ['-', line] | ['+', line]]. */
    function diffLines(a, b) {
        const x = String(a || '').split('\n'), y = String(b || '').split('\n');
        if (x.length * y.length > 90000) return x.map((l) => ['-', l]).concat(y.map((l) => ['+', l]));
        const n = x.length, m = y.length, L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
        for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
        const out = []; let i = 0, j = 0;
        while (i < n && j < m) { if (x[i] === y[j]) { out.push(['=', x[i]]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push(['-', x[i++]]); else out.push(['+', y[j++]]); }
        while (i < n) out.push(['-', x[i++]]);
        while (j < m) out.push(['+', y[j++]]);
        return out;
    }

    /** What a step shows on its row and inside: title, the thing it touched, a diff or content, the counts. */
    function describe(step) {
        const i = step.input || {};
        const k = step.kind;
        const out = { title: '', sub: '', command: '', diff: null, preview: '', added: 0, removed: 0 };
        if (k === 'command') { out.command = String(i.command || i.cmd || step.what || ''); out.title = String(i.description || '') || out.command.split('\n')[0]; out.sub = i.description ? out.command.split('\n')[0] : ''; }
        else if (k === 'read') { const p = i.file_path || i.path || step.what; out.title = `Read ${base(p)}`; out.sub = String(p || ''); }
        else if (k === 'search') { out.title = i.pattern ? `Searched for ${i.pattern}` : `Listed ${base(i.path || step.what) || 'files'}`; out.sub = String(i.path || i.glob || step.what || ''); }
        else if (k === 'edit' || k === 'write') {
            const p = i.file_path || i.path || i.notebook_path || step.what;
            out.title = `${k === 'write' ? 'Wrote' : 'Edited'} ${base(p) || 'a file'}`; out.sub = String(p || '');
            const edits = Array.isArray(i.edits) ? i.edits : (i.old_string != null || i.new_string != null) ? [{ old_string: i.old_string, new_string: i.new_string }] : [];
            if (edits.length) { out.diff = []; edits.forEach((e, n) => { if (n) out.diff.push(['@', '…']); out.diff.push(...diffLines(e.old_string, e.new_string)); }); }
            else if (typeof i.content === 'string') { out.preview = i.content; out.diff = i.content.split('\n').map((l) => ['+', l]); }
            if (out.diff) out.diff.forEach(([op]) => { if (op === '+') out.added++; else if (op === '-') out.removed++; });
        } else if (k === 'web') {
            const asked = i.query || (!i.url && !/^https?:\/\//.test(String(i.description || step.what || '')) ? i.description || step.what : '');
            const url = i.url || (/^https?:\/\//.test(String(i.description || step.what || '')) ? i.description || step.what : '');
            out.title = asked ? `Looked up ${asked}` : `Opened ${String(url).replace(/^https?:\/\//, '').slice(0, 60)}`; out.sub = asked ? '' : String(url);
        }
        else if (k === 'agent') { out.title = String(i.description || 'A helper agent'); out.sub = i.subagent_type ? `${i.subagent_type} helper` : 'helper'; out.preview = String(i.prompt || ''); }
        else if (k === 'plan') { out.title = 'Updated the plan'; }
        else { out.title = String(step.name || 'Tool'); out.sub = String(step.what || ''); }
        if (!out.title) out.title = String(step.what || step.name || 'Step');
        return out;
    }

    // ── Styles: agent-session.css, from beside this script (theme tokens; light and dark) ─────────────────
    const SELF_SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
    function styles() {
        if (typeof document === 'undefined' || document.getElementById('openvibe-agent-session-styles') || document.querySelector('link[href*="agent-session.css"]')) return;
        const m = /^(https?:\/\/[^?#]*\/)agent-session\.js(?:[?#]|$)/.exec(SELF_SRC);
        const link = document.createElement('link');
        link.id = 'openvibe-agent-session-styles';
        link.rel = 'stylesheet';
        link.href = `${m ? m[1] : 'https://openvibe.network/shared/'}agent-session.css`;
        document.head.appendChild(link);
    }

    // ── The view ──────────────────────────────────────────────
    function mount(host, opts = {}) {
        styles();
        const linkOk = typeof opts.link === 'function' ? (u) => { try { return !!opts.link(u); } catch { return false; } } : null;
        const LIVE = ['running', 'placed', 'queued', 'verifying'];
        // The clock runs from startedAt, or from now for a run that is live as it mounts; a finished run replayed without
        // a start time shows the time only once its done line says it.
        const clock = Boolean(opts.startedAt) || LIVE.includes(opts.status || 'running');
        const S = { status: opts.status || 'running', label: opts.label || '', startedAt: opts.startedAt || Date.now(), endedAt: null, agents: [], steps: new Map(), plan: null, tokens: { in: 0, out: 0 }, cost: 0, agentCost: new Map(), durationMs: 0, problems: 0, filter: 'all', follow: opts.follow !== false, lastGroup: null };
        host.textContent = '';
        const box = el('div', 'ovas');
        box.innerHTML = `<div class="ovas-head"><div class="ovas-top"><span class="ovas-pill" data-s="${esc(S.status)}"></span><span class="ovas-title"></span></div><div class="ovas-meta"><span class="ovas-agents"></span><span data-m="time"></span><span data-m="steps"></span><span data-m="files"></span><span data-m="cost"></span></div><details class="ovas-plan" hidden><summary><span class="ovas-plan-now"></span><span class="ovas-plan-n"></span></summary><div class="ovas-plan-bar"><i style="width:0"></i></div><ol></ol></details></div>`
            + '<div class="ovas-bar" role="toolbar" aria-label="Show"></div><ol class="ovas-files" hidden></ol><ol class="ovas-feed" aria-live="polite"></ol><div class="ovas-actions" hidden></div>';
        host.appendChild(box);
        const head = box.querySelector('.ovas-head'), feed = box.querySelector('.ovas-feed'), bar = box.querySelector('.ovas-bar');
        const filesEl = box.querySelector('.ovas-files'), actBar = box.querySelector('.ovas-actions');
        head.querySelector('.ovas-title').textContent = opts.title || 'Agent session';
        const FILTERS = [['all', 'Everything'], ['said', 'What it said'], ['steps', 'Steps'], ['files', 'Files'], ['problems', 'Problems']];
        FILTERS.forEach(([id, label]) => { const b = el('button', 'ovas-chip', label); b.type = 'button'; b.dataset.f = id; b.setAttribute('aria-pressed', String(id === 'all')); bar.appendChild(b); });
        const follow = el('button', 'ovas-chip ovas-follow', 'Follow'); follow.type = 'button'; follow.setAttribute('aria-pressed', String(S.follow)); follow.title = 'Keep the newest step in view'; bar.appendChild(follow);
        bar.addEventListener('click', (e) => {
            const b = e.target.closest('button'); if (!b) return;
            if (b === follow) { S.follow = !S.follow; follow.setAttribute('aria-pressed', String(S.follow)); return; }
            S.filter = b.dataset.f; bar.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); applyFilter();
        });
        box.addEventListener('click', (e) => {
            const c = e.target.closest('.ovas-copy'); if (!c) return;
            e.preventDefault(); e.stopPropagation();
            const pre = c.parentElement && c.parentElement.nextElementSibling;
            const text = pre ? pre.textContent : '';
            try { navigator.clipboard.writeText(text); c.lastChild.textContent = 'Copied'; setTimeout(() => { c.lastChild.textContent = 'Copy'; }, 1400); } catch { /* no clipboard */ }
        });
        const empty = el('li', 'ovas-empty', opts.empty || 'Waiting for the agent to start…'); feed.appendChild(empty);

        function applyFilter() {
            const files = S.filter === 'files';
            feed.hidden = files; filesEl.hidden = !files;
            if (files) { paintFiles(); return; }
            feed.querySelectorAll(':scope > li').forEach((li) => {
                const k = li.dataset.k || '';
                li.hidden = S.filter === 'all' ? false : S.filter === 'said' ? !(k === 'msg' || k === 'done' || k === 'handoff') : S.filter === 'steps' ? !(k === 'steps' || k === 'handoff') : !(li.dataset.p === '1');
            });
        }
        // The Files tab: one row per file, newest change last; a tap shows everything and opens that file's last step.
        function changedFiles() {
            const by = new Map();
            for (const st of S.steps.values()) {
                if (st.hidden || (st.kind !== 'edit' && st.kind !== 'write') || !st.info) continue;
                const p = st.info.sub || st.info.title;
                const f = by.get(p) || { path: p, added: 0, removed: 0, n: 0, last: null, wrote: false };
                f.added += st.info.added || 0; f.removed += st.info.removed || 0; f.n++; f.last = st; f.wrote = f.wrote || st.kind === 'write';
                by.set(p, f);
            }
            return [...by.values()];
        }
        function paintFiles() {
            filesEl.textContent = '';
            const list = changedFiles();
            if (!list.length) { filesEl.appendChild(el('li', 'ovas-empty', 'No files changed yet.')); return; }
            for (const f of list) {
                const li = el('li');
                const b = el('button', 'ovas-file'); b.type = 'button'; b.dataset.step = f.last.id;
                b.innerHTML = `<span class="ovas-kind" data-k="${f.wrote ? 'write' : 'edit'}">${svg(f.wrote ? 'write' : 'edit')}</span><span class="ovas-sum"><b></b><small></small></span><span class="ovas-delta"><span class="a">+${f.added}</span><span class="r">−${f.removed}</span></span><span class="ovas-file-n"></span>`;
                b.querySelector('b').textContent = base(f.path) || f.path;
                b.querySelector('small').textContent = f.path;
                b.querySelector('.ovas-file-n').textContent = f.n > 1 ? `${f.n} changes` : '';
                li.appendChild(b); filesEl.appendChild(li);
            }
        }
        filesEl.addEventListener('click', (e) => {
            const b = e.target.closest('.ovas-file'); if (!b) return;
            const st = S.steps.get(b.dataset.step); if (!st || !st.el) return;
            S.filter = 'all'; bar.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.f === 'all'))); applyFilter();
            for (let p = st.el; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
            if (st.el.scrollIntoView) st.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });

        // The action bar: what the person can do now (the page decides; this only draws and reports the press).
        function paintActions(list, note) {
            actBar.textContent = '';
            const acts = (Array.isArray(list) ? list : []).filter((a) => a && a.id && a.label).slice(0, 4);
            actBar.hidden = !acts.length;
            if (!acts.length) return;
            if (note) actBar.appendChild(el('p', '', note));
            for (const a of acts) { const b = el('button', `ovas-act${a.kind === 'primary' ? ' is-primary' : a.kind === 'danger' ? ' is-danger' : ''}`, a.label); b.type = 'button'; b.dataset.act = a.id; actBar.appendChild(b); }
        }
        actBar.addEventListener('click', async (e) => {
            const b = e.target.closest('.ovas-act'); if (!b || typeof opts.onAction !== 'function') return;
            const all = [...actBar.querySelectorAll('.ovas-act')]; all.forEach((x) => { x.disabled = true; });
            try { await opts.onAction(b.dataset.act); } catch { /* the page says what went wrong */ } finally { all.forEach((x) => { x.disabled = false; }); }
        });
        if (Array.isArray(opts.actions)) paintActions(opts.actions, opts.actionsNote);

        const keep = () => { if (S.follow && S.status === 'running') { const last = feed.lastElementChild; if (last && last.scrollIntoView) last.scrollIntoView({ block: 'end', behavior: 'smooth' }); } };

        // A step's element: <details> with the summary row and, once opened, its detail.
        function stepEl(step) {
            const d = el('details', 'ovas-step');
            d.dataset.id = step.id;
            const sum = el('summary');
            const info = describe(step); step.info = info;
            sum.innerHTML = `${svg('chevron', 'ovas-chev')}<span class="ovas-kind" data-k="${esc(step.kind)}">${svg(step.kind)}</span><span class="ovas-sum"><b></b><small></small></span>${info.added || info.removed ? `<span class="ovas-delta"><span class="a">+${info.added}</span><span class="r">−${info.removed}</span></span>` : ''}<span class="ovas-state" data-s="run"><span class="ovas-spin" aria-label="Running"></span><span data-t></span></span>`;
            sum.querySelector('b').textContent = info.title;
            sum.querySelector('small').textContent = info.sub;
            if (!info.sub) sum.querySelector('small').hidden = true;
            d.appendChild(sum);
            const detail = el('div', 'ovas-detail'); d.appendChild(detail);
            const section = (label, node, copy) => { const l = el('div', 'ovas-label'); l.appendChild(el('span', '', label)); if (copy) { const c = el('button', 'ovas-copy'); c.type = 'button'; c.innerHTML = `${svg('copy')}<span>Copy</span>`; l.appendChild(c); } detail.append(l, node); };
            if (step.kind === 'command' && info.command) { const pre = el('pre', 'ovas-code'); pre.textContent = info.command; section('Command', pre, true); }
            if (info.diff) { const pre = el('pre', 'ovas-diff'); info.diff.slice(0, 600).forEach(([op, line]) => { const s = el('span', op === '+' ? 'a' : op === '-' ? 'r' : op === '@' ? 'h' : '', `${op === '=' ? ' ' : op === '@' ? '' : op} ${line}`); pre.appendChild(s); }); section(step.kind === 'write' ? 'New file' : 'Change', pre, false); }
            if (step.kind === 'agent' && info.preview) { const p = el('div', 'ovas-msg'); p.appendChild(markdown(info.preview.slice(0, 1600), linkOk)); section('Asked to', p, false); }
            if (step.kind !== 'plan' && step.input && typeof step.input === 'object' && Object.keys(step.input).length) {
                const raw = el('details', 'ovas-raw');
                raw.innerHTML = `<summary>${svg('chevron', 'ovas-chev')}<span>Input</span></summary>`;
                const l = el('div', 'ovas-label'); l.appendChild(el('span', '', 'What the agent sent')); const c = el('button', 'ovas-copy'); c.type = 'button'; c.innerHTML = `${svg('copy')}<span>Copy</span>`; l.appendChild(c);
                let text = ''; try { text = JSON.stringify(step.input, null, 2); } catch { text = String(step.input); }
                const pre = el('pre', 'ovas-code'); pre.textContent = text.length > 8000 ? `${text.slice(0, 8000)}\n…` : text;
                raw.append(l, pre); detail.appendChild(raw);
            }
            if (step.kind === 'agent') { const sub = el('div', 'ovas-sub'); step.subEl = sub; d.appendChild(sub); d.open = true; }
            if (step.kind !== 'agent' && step.kind !== 'plan') {
                const pre = el('pre', 'ovas-out'); pre.hidden = true; step.outEl = pre;
                const wait = el('div', 'ovas-wait'); wait.innerHTML = '<span class="ovas-spin"></span><span>Running — the output shows here as it arrives</span>'; step.waitEl = wait;
                const l = el('div', 'ovas-label'); l.appendChild(el('span', '', 'Output')); const c = el('button', 'ovas-copy'); c.type = 'button'; c.innerHTML = `${svg('copy')}<span>Copy</span>`; l.appendChild(c); step.outLabel = l;
                detail.append(l, pre, wait);
            }
            step.el = d; step.stateEl = sum.querySelector('.ovas-state');
            return d;
        }
        function setStepState(step) {
            const st = step.stateEl; if (!st) return;
            const t = step.ended ? dur(step.ended - step.started) : dur(Date.now() - step.started);
            if (step.done) {
                st.dataset.s = step.ok ? 'ok' : 'fail';
                const c = step.cost > 0 ? `$${step.cost < 0.01 ? step.cost.toFixed(4).replace(/0+$/, '') : step.cost.toFixed(2)}` : '';
                st.innerHTML = `${c ? `<span class="ovas-cost">${esc(c)}</span>` : ''}${svg(step.ok ? 'ok' : 'fail')}<span>${esc(step.ended - step.started > 1500 ? t : '')}</span>`;
            } else { const tt = st.querySelector('[data-t]'); if (tt && Date.now() - step.started > 2000) tt.textContent = t; }
        }
        // The group a new step goes in: the last item of its feed when that is a group of steps, else a new one.
        function groupFor(parentFeed) {
            const last = parentFeed.lastElementChild;
            if (last && last.classList.contains('ovas-group-li')) return last;
            const li = el('li', 'ovas-group-li'); li.dataset.k = 'steps';
            const g = el('details', 'ovas-group');
            g.innerHTML = `<summary>${svg('chevron', 'ovas-chev')}<span class="ovas-icons"></span><span class="ovas-sum"><b></b><small></small></span><span class="ovas-delta" hidden><span class="a"></span><span class="r"></span></span><span class="ovas-state"></span></summary><ol></ol>`;
            li.appendChild(g); parentFeed.appendChild(li);
            li.steps = [];
            return li;
        }
        function paintGroup(li) {
            const steps = li.steps, g = li.firstChild, count = {};
            steps.forEach((s) => { count[s.kind] = (count[s.kind] || 0) + 1; });
            const order = ['command', 'edit', 'write', 'read', 'search', 'web', 'agent', 'plan', 'tool'];
            const kinds = order.filter((k) => count[k]);
            g.querySelector('.ovas-icons').innerHTML = kinds.slice(0, 3).map((k) => `<span class="ovas-kind" data-k="${k}">${svg(k)}</span>`).join('');
            // A few steps read as what was done ("Ran 2 commands"); more as counts ("2 commands · 1 edit · 3 reads").
            g.querySelector('.ovas-sum b').textContent = kinds.length === 1 ? plural(kinds[0], count[kinds[0]]) : kinds.map((k) => `${count[k]} ${NOUN[k][count[k] === 1 ? 0 : 1]}`).join(' · ');
            const running = steps.find((s) => !s.done) || steps[steps.length - 1];
            const small = g.querySelector('.ovas-sum small');
            small.textContent = running ? (running.info.sub || running.info.title) : '';
            const added = steps.reduce((n, s) => n + (s.info.added || 0), 0), removed = steps.reduce((n, s) => n + (s.info.removed || 0), 0);
            const delta = g.querySelector('.ovas-delta'); delta.hidden = !(added || removed); delta.firstChild.textContent = `+${added}`; delta.lastChild.textContent = `−${removed}`;
            const st = g.querySelector('.ovas-state'), fails = steps.filter((s) => s.done && !s.ok).length, live = steps.some((s) => !s.done);
            st.dataset.s = live ? 'run' : fails ? 'fail' : 'ok';
            st.innerHTML = live ? '<span class="ovas-spin" aria-label="Running"></span>' : fails ? `${svg('fail')}<span>${fails} failed</span>` : svg('ok');
            if (fails) li.dataset.p = '1';
            // One step alone reads as itself, not as a group of one.
            g.classList.toggle('is-one', steps.length === 1);
            if (steps.length === 1) g.open = true;
        }
        function feedFor(parent) { const p = parent && S.steps.get(parent); return p && p.subEl ? p.subEl : feed; }
        function appendLi(target, li) { if (target === feed) { if (empty.parentNode) empty.remove(); feed.appendChild(li); } else target.appendChild(li); }

        const pending = new Map();   // tool name → ids of its steps still waiting for a result (events without ids)
        function onLine(x) {
            const target = feedFor(x.parent);
            // Who is working: a line that names a different agent than the last moves the head along.
            // A done line reports an agent's cost and time; it never moves the head.
            if (x.agent && x.t !== 'agent' && x.t !== 'handoff' && x.t !== 'done' && (!S.agents.length || S.agents[S.agents.length - 1].agent !== x.agent)) { S.agents.push({ agent: x.agent }); paintHead(); }
            if (x.t === 'tool' && !x.id) { x = { ...x, id: `a${S.steps.size + 1}` }; if (!pending.has(x.name)) pending.set(x.name, []); pending.get(x.name).push(x.id); }
            if (x.t === 'tool_result' && !x.id) { const q = pending.get(x.name); x = { ...x, id: q && q.length ? q.shift() : '' }; }
            if (x.t === 'state') { status(x.state); return; }
            if (x.t === 'agent') {
                const last = S.agents[S.agents.length - 1];
                if (last && last.agent === x.agent) { if (x.model) last.model = x.model; } else S.agents.push({ agent: x.agent, model: x.model });
                paintHead(); return;
            }
            if (x.t === 'text') {
                const li = el('li', 'ovas-msg'); li.dataset.k = 'msg'; li.appendChild(markdown(x.text, linkOk)); appendLi(target, li); return;
            }
            if (x.t === 'tool') {
                const kind = kindOf(x.name);
                const step = { id: x.id || `s${S.steps.size}`, name: x.name, kind, input: x.input || {}, what: x.what || '', started: Date.now(), done: false, ok: null, out: '' };
                if (kind === 'plan') { if (Array.isArray(step.input.todos)) { S.plan = step.input.todos; paintPlan(); } step.hidden = true; S.steps.set(step.id, step); return; }
                S.steps.set(step.id, step);
                const g = groupFor(target === feed ? feed : target);
                if (target === feed && empty.parentNode) empty.remove();
                g.steps.push(step);
                g.firstChild.querySelector('ol').appendChild(stepEl(step));
                paintGroup(g); step.group = g; paintHead(); return;
            }
            if (x.t === 'tool_progress') {
                const step = S.steps.get(String(x.id)); if (!step || !step.outEl) return;
                step.out = (step.out + x.chunk).slice(-20000); step.outEl.textContent = step.out; step.outEl.hidden = false; step.waitEl.hidden = true;
                step.outEl.scrollTop = step.outEl.scrollHeight; return;
            }
            if (x.t === 'tool_result') {
                const step = S.steps.get(String(x.id)); if (!step || step.hidden) return;
                step.done = true; step.ok = x.ok !== false; step.ended = x.duration_ms > 0 ? step.started + Number(x.duration_ms) : Date.now();
                if (Number(x.cost_usd) > 0) step.cost = Number(x.cost_usd);
                if (step.outEl) {
                    const out = String(x.output == null ? '' : x.output) || step.out || '';
                    step.waitEl.hidden = true;
                    if (out.trim()) { step.outEl.textContent = out; step.outEl.hidden = false; step.outEl.classList.toggle('is-fail', !step.ok); }
                    else { step.outEl.hidden = true; step.outLabel.hidden = true; }
                }
                if (!step.ok) { S.problems++; if (step.el) step.el.open = true; }
                setStepState(step); if (step.group) paintGroup(step.group); paintHead(); return;
            }
            if (x.t === 'handoff') {
                const li = el('li', 'ovas-handoff'); li.dataset.k = 'handoff'; li.dataset.p = '1';
                const s = el('div', 'ovas-hand');
                const row = el('div', 'ovas-hand-row');
                const from = x.from || (S.agents.length ? S.agents[S.agents.length - 1].agent : '');
                if (x.to && (!S.agents.length || S.agents[S.agents.length - 1].agent !== x.to)) S.agents.push({ agent: x.to });
                row.appendChild(el('span', 'ovas-agent', agentName(from))); row.insertAdjacentHTML('beforeend', svg('handoff')); row.appendChild(el('span', 'ovas-agent is-now', x.to ? agentName(x.to) : 'the next agent'));
                s.appendChild(row); if (x.reason) s.appendChild(el('small', '', x.reason));
                li.appendChild(s); appendLi(feed, li); S.problems++; paintHead(); return;
            }
            if (x.t === 'note') {
                const li = el('li', 'ovas-note'); li.dataset.k = 'note'; li.dataset.level = x.level === 'warning' || x.level === 'info' ? x.level : 'error';
                if (li.dataset.level !== 'info') li.dataset.p = '1';
                li.innerHTML = svg(li.dataset.level === 'info' ? 'ok' : 'warn'); li.appendChild(el('span', '', x.text)); appendLi(target, li); if (li.dataset.level !== 'info') S.problems++; paintHead(); return;
            }
            if (x.t === 'step') {
                const li = el('li', 'ovas-line'); li.dataset.k = 'line'; li.appendChild(el('span', '', x.text)); appendLi(feed, li); return;
            }
            if (x.t === 'usage') { S.tokens.in += Number(x.input_tokens) || 0; S.tokens.out += Number(x.output_tokens) || 0; return; }
            if (x.t === 'done') {
                if (x.parent) return;
                S.cost += Number(x.cost_usd) || 0; S.durationMs += Number(x.duration_ms) || 0;
                const who = x.agent || (S.agents[S.agents.length - 1] || {}).agent;
                if (who && Number(x.cost_usd) > 0) S.agentCost.set(who, (S.agentCost.get(who) || 0) + Number(x.cost_usd));
                const li = el('li', 'ovas-done'); li.dataset.k = 'done'; li.dataset.ok = x.ok ? '1' : '0';
                const b = el('b'); b.innerHTML = svg(x.ok ? 'ok' : 'fail'); b.appendChild(document.createTextNode(`${agentName((S.agents[S.agents.length - 1] || {}).agent)} ${x.ok ? 'finished' : 'stopped'}${x.duration_ms ? ` in ${dur(x.duration_ms)}` : ''}`));
                li.appendChild(b);
                if (x.text) { const m = el('div', 'ovas-msg'); m.appendChild(markdown(x.text, linkOk)); li.appendChild(m); }
                if (!x.ok) li.dataset.p = '1';
                appendLi(feed, li); paintHead();
            }
        }
        function push(event) { normalize(event).forEach((x) => { try { onLine(x); } catch { /* one odd line never stops the view */ } }); applyFilter(); keep(); }

        function paintPlan() {
            const box2 = head.querySelector('.ovas-plan'); const todos = (S.plan || []).filter((t) => t && (t.content || t.activeForm));
            box2.hidden = !todos.length; if (!todos.length) return;
            const doneN = todos.filter((t) => t.status === 'completed').length;
            box2.querySelector('i').style.width = `${Math.round((doneN / todos.length) * 100)}%`;
            const now = todos.find((t) => t.status === 'in_progress') || todos.find((t) => t.status !== 'completed');
            box2.querySelector('.ovas-plan-now').textContent = now ? (now.status === 'in_progress' && now.activeForm ? now.activeForm : now.content || now.activeForm) : 'Plan done';
            box2.querySelector('.ovas-plan-n').textContent = `${doneN} of ${todos.length}`;
            const ol = box2.querySelector('ol'); ol.textContent = '';
            todos.slice(0, 12).forEach((t) => { const li = el('li', '', t.status === 'in_progress' && t.activeForm ? t.activeForm : t.content || t.activeForm); li.dataset.s = t.status || 'pending'; ol.appendChild(li); });
        }
        function summary() {
            const steps = [...S.steps.values()].filter((s) => !s.hidden);
            const files = new Set(steps.filter((s) => s.kind === 'edit' || s.kind === 'write').map((s) => s.info && s.info.sub).filter(Boolean));
            return {
                agents: S.agents.map((a) => agentName(a.agent)), steps: steps.length, commands: steps.filter((s) => s.kind === 'command').length, files: files.size,
                added: steps.reduce((n, s) => n + ((s.info && s.info.added) || 0), 0), removed: steps.reduce((n, s) => n + ((s.info && s.info.removed) || 0), 0),
                problems: S.problems, costUsd: Math.round(S.cost * 1e4) / 1e4, costByAgent: Object.fromEntries([...S.agentCost].map(([k, v]) => [agentName(k), Math.round(v * 1e4) / 1e4])), durationMs: S.durationMs || (clock ? (S.endedAt || Date.now()) - S.startedAt : 0), tokens: { ...S.tokens },
            };
        }
        const LABEL = { queued: 'Waiting', placed: 'Starting', running: 'Running', verifying: 'Checking the answer', succeeded: 'Finished', failed: 'Failed', cancelled: 'Cancelled', expired: 'Expired' };
        function paintHead() {
            const sm = summary();
            const pill = head.querySelector('.ovas-pill');
            pill.dataset.s = S.status;
            pill.innerHTML = `${S.status === 'running' || S.status === 'placed' || S.status === 'verifying' ? '<span class="ovas-spin"></span>' : S.status === 'succeeded' ? svg('ok') : S.status === 'failed' || S.status === 'expired' ? svg('fail') : ''}<span></span>`;
            pill.lastChild.textContent = S.label || LABEL[S.status] || S.status;
            const ag = head.querySelector('.ovas-agents'); ag.textContent = '';
            const shown = new Set();
            S.agents.forEach((a, i) => {
                if (i) ag.appendChild(el('span', '', '→'));
                const c = el('span', `ovas-agent${i === S.agents.length - 1 ? ' is-now' : ''}`, agentName(a.agent)); if (a.model) c.title = a.model;
                // An agent's cost once, on its last chip (an agent may come back after a hand-off).
                const cost = S.agentCost.get(a.agent);
                if (cost && !shown.has(a.agent) && !S.agents.slice(i + 1).some((b) => b.agent === a.agent)) { shown.add(a.agent); c.appendChild(el('span', 'ovas-agent-cost', `$${cost < 0.01 ? cost.toFixed(4).replace(/0+$/, '') : cost.toFixed(2)}`)); }
                ag.appendChild(c);
            });
            const fc = bar.querySelector('[data-f="files"]'); if (fc) fc.textContent = sm.files ? `Files ${sm.files}` : 'Files';
            const m = (k, html) => { const n = head.querySelector(`[data-m="${k}"]`); n.innerHTML = html; n.hidden = !html; };
            m('time', sm.durationMs ? `<b>${esc(dur(sm.durationMs))}</b>` : '');
            m('steps', sm.steps ? `<b>${sm.steps}</b> step${sm.steps === 1 ? '' : 's'}${sm.commands ? ` · <b>${sm.commands}</b> command${sm.commands === 1 ? '' : 's'}` : ''}` : '');
            m('files', sm.files ? `<b>${sm.files}</b> file${sm.files === 1 ? '' : 's'} <span style="color:var(--ovas-ok)">+${sm.added}</span> <span style="color:var(--ovas-bad)">−${sm.removed}</span>` : '');
            m('cost', sm.costUsd ? `<b>$${sm.costUsd.toFixed(sm.costUsd < 1 ? 3 : 2)}</b>` : '');
        }
        function status(s, label) {
            S.status = s; S.label = label || '';
            if (!LIVE.includes(s)) { S.endedAt = S.endedAt || Date.now(); empty.textContent = 'Nothing was recorded for this run.'; }
            paintHead();
        }
        const tick = setInterval(() => { if (S.status === 'running' || S.status === 'placed') { S.steps.forEach((st) => { if (!st.done) setStepState(st); }); paintHead(); } }, 1000);
        paintHead();
        return { push, pushAll: (list) => (list || []).forEach(push), status, summary, actions: (list, note) => paintActions(list, note), files: () => changedFiles().map((f) => ({ path: f.path, added: f.added, removed: f.removed, changes: f.n })), destroy() { clearInterval(tick); host.textContent = ''; } };
    }

    const api = { mount, normalize, diffLines, kindOf };
    root.OpenVibeAgentSession = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
