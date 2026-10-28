/**
 * openvibe-shared/agent-session.js — a coding agent's session as people read it: what it said, the steps it took
 * (commands, files read and changed, searches, sub-agents) grouped and folded, each step's command, diff and OUTPUT
 * (live while it runs), hand-offs between agents, the plan it keeps, and a summary that stays at the top (4.24.0).
 *
 * The owner, 2026-10-28, showing the Claude app's session view ("Ran 3 commands", a Bash sheet saying "Output
 * unavailable"): "OpenVibe.Codes should… actually show the output from the agent… more user friendly… handle that
 * between all agents… in a smart way… way better than this idea."
 *
 *   const view = OpenVibeAgentSession.mount(el, { title, status: 'running', startedAt })
 *   view.push(event)          one event: a Codes job line ({ t: 'tool', … }), any Claude Code stream-json event
 *                             ({ type: 'assistant', … }) or an OpenVibe.Actor task event ({ kind: 'output', step, … },
 *                             actor.task-event@1); every OpenVibe.Codes harness adapter (Claude Code, Codex, OpenCode,
 *                             Command Code, Aider, DeepSeek, OpenVibe.AI, your own model) and every Actor agent speaks one
 *   view.pushAll(events)
 *   view.status('succeeded' | 'failed' | 'cancelled' | 'running' | 'queued' | …, label?)
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
 *   { t: 'tool_result', id, ok, output }              how it ended, with its output
 *   { t: 'handoff', from, to?, reason }               one agent stopped and the next took over
 *   { t: 'note', text, level? }                       a warning or an error along the way
 *   { t: 'step', text }                               the job's own progress (cloning, the branch, files changed, pushing)
 *   { t: 'usage', input_tokens, output_tokens }
 *   { t: 'done', ok, text, duration_ms, cost_usd, turns }
 * A line from a sub-agent carries `parent`: the id of the Task step that started it, so it nests under that step.
 * Any line may carry `agent` (the head then follows who is working); a step without an id gets one, and the next result
 * of the same tool without an id is its result. { t: 'state', state } moves the head (Actor's task states).
 *
 * Everything is text: no line's content ever becomes markup (links are https only). It needs nothing else; the look
 * follows the page's theme tokens (kit.css's), light or dark.
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
        return any('bash', 'shell', 'command', 'exec', 'run', 'terminal') ? 'command' : any('edit', 'patch', 'replace') ? 'edit' : any('write', 'create') ? 'write'
            : any('read', 'cat', 'view', 'open') ? 'read' : any('grep', 'glob', 'find', 'search', 'list', 'ls') ? 'search' : any('web', 'fetch', 'http', 'browse', 'url') ? 'web' : 'tool';
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

    /** Light Markdown, text-safe: paragraphs, bullet and numbered lists, `code`, ```blocks```, **bold**, https links. */
    function markdown(text) {
        const frag = document.createDocumentFragment();
        const inline = (s, into) => {
            const re = /(`[^`]+`|\*\*[^*]+\*\*|https:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;
            let at = 0, m;
            while ((m = re.exec(s))) {
                if (m.index > at) into.appendChild(document.createTextNode(s.slice(at, m.index)));
                const tok = m[0];
                if (tok[0] === '`') into.appendChild(el('code', '', tok.slice(1, -1)));
                else if (tok.startsWith('**')) into.appendChild(el('strong', '', tok.slice(2, -2)));
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
        } else if (k === 'web') { out.title = i.query ? `Looked up ${i.query}` : `Opened ${String(i.url || step.what || '').replace(/^https?:\/\//, '').slice(0, 60)}`; out.sub = String(i.url || ''); }
        else if (k === 'agent') { out.title = String(i.description || 'A helper agent'); out.sub = i.subagent_type ? `${i.subagent_type} helper` : 'helper'; out.preview = String(i.prompt || ''); }
        else if (k === 'plan') { out.title = 'Updated the plan'; }
        else { out.title = String(step.name || 'Tool'); out.sub = String(step.what || ''); }
        if (!out.title) out.title = String(step.what || step.name || 'Step');
        return out;
    }

    // ── Styles (theme tokens; light and dark) ─────────────────
    function styles() {
        if (typeof document === 'undefined' || document.getElementById('openvibe-agent-session-styles')) return;
        const st = document.createElement('style');
        st.id = 'openvibe-agent-session-styles';
        st.textContent = `
.ovas { --ovas-b: var(--border, rgba(255,255,255,.1)); --ovas-s: var(--bg-secondary, #121826); --ovas-t: var(--bg-tertiary, rgba(255,255,255,.05)); --ovas-mut: var(--text-muted, #8b98ad); --ovas-sec: var(--text-secondary, #a8b3c4); --ovas-ok: #4ade80; --ovas-bad: var(--live-red, #f87171); --ovas-add: color-mix(in srgb, #22c55e 18%, transparent); --ovas-del: color-mix(in srgb, #ef4444 18%, transparent); --ovas-code: color-mix(in srgb, var(--bg-primary, #0b1020) 72%, var(--ovas-s));
  display: grid; gap: 12px; color: var(--text-primary, #e6edf7); font-family: inherit; min-width: 0; }
.ovas-ic { width: 16px; height: 16px; flex: none; }
.ovas-head { position: sticky; top: var(--ovnav-real-h, 0px); z-index: 2; display: grid; gap: 8px; padding: 12px 14px; border-radius: 16px; border: 1px solid var(--ovas-b); background: color-mix(in srgb, var(--ovas-s) 92%, transparent); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.ovas-top { display: flex; align-items: center; gap: 10px; min-width: 0; }
.ovas-pill { display: inline-flex; align-items: center; gap: 6px; flex: none; height: 26px; padding: 0 10px; border-radius: 999px; font-size: 12.5px; font-weight: 700; background: var(--ovas-t); color: var(--ovas-sec); }
.ovas-pill[data-s="running"], .ovas-pill[data-s="placed"] { color: var(--accent-light, var(--accent, #60a5fa)); background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); }
.ovas-pill[data-s="succeeded"] { color: var(--ovas-ok); background: color-mix(in srgb, #22c55e 15%, transparent); }
.ovas-pill[data-s="failed"], .ovas-pill[data-s="expired"] { color: var(--ovas-bad); background: color-mix(in srgb, #ef4444 15%, transparent); }
.ovas-title { flex: 1; min-width: 0; font-weight: 700; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovas-meta { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12.5px; color: var(--ovas-mut); }
.ovas-meta b { color: var(--ovas-sec); font-weight: 650; font-variant-numeric: tabular-nums; }
.ovas-agents { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.ovas-agent { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 650; border: 1px solid var(--ovas-b); color: var(--ovas-sec); }
.ovas-agent.is-now { border-color: color-mix(in srgb, var(--accent, #3b82f6) 55%, transparent); color: var(--text-primary, #e6edf7); }
.ovas-plan { display: grid; gap: 6px; padding-top: 2px; }
.ovas-plan > summary { display: flex; align-items: center; gap: 8px; cursor: pointer; list-style: none; font-size: 13px; font-weight: 600; }
.ovas-plan > summary::-webkit-details-marker { display: none; }
.ovas-plan-now { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovas-plan-now::before { content: ''; display: inline-block; width: 8px; height: 8px; margin-right: 7px; border-radius: 50%; background: var(--accent, #3b82f6); vertical-align: 1px; }
.ovas-plan-n { flex: none; font-size: 12px; color: var(--ovas-mut); font-variant-numeric: tabular-nums; }
.ovas-plan:not([open]) > ol { display: none; }
.ovas-plan-bar { height: 4px; border-radius: 4px; background: var(--ovas-t); overflow: hidden; }
.ovas-plan-bar i { display: block; height: 100%; background: var(--accent, #3b82f6); border-radius: inherit; transition: width .3s; }
.ovas-plan ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 3px; font-size: 13px; }
.ovas-plan li { display: flex; gap: 8px; align-items: baseline; color: var(--ovas-sec); }
.ovas-plan li::before { content: ''; flex: none; width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--ovas-mut); transform: translateY(1px); }
.ovas-plan li[data-s="in_progress"] { color: var(--text-primary, #e6edf7); font-weight: 600; }
.ovas-plan li[data-s="in_progress"]::before { border-color: var(--accent, #3b82f6); border-right-color: transparent; animation: ovas-spin .9s linear infinite; }
.ovas-plan li[data-s="completed"] { color: var(--ovas-mut); text-decoration: line-through; }
.ovas-plan li[data-s="completed"]::before { background: var(--ovas-ok); border-color: var(--ovas-ok); }
.ovas-bar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.ovas-chip { height: 30px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--ovas-b); background: transparent; color: var(--ovas-sec); font: inherit; font-size: 12.5px; font-weight: 650; cursor: pointer; }
.ovas-chip[aria-pressed="true"] { background: var(--accent-strong, var(--accent, #3472d8)); border-color: transparent; color: var(--on-accent-strong, #fff); }
.ovas-chip.ovas-follow { margin-left: auto; }
.ovas-feed { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; min-width: 0; }
.ovas-feed > li { min-width: 0; }
.ovas-msg { padding: 2px 4px; font-size: 15px; line-height: 1.55; overflow-wrap: anywhere; }
.ovas-msg p { margin: 0 0 8px; } .ovas-msg p:last-child { margin-bottom: 0; }
.ovas-msg ul, .ovas-msg ol { margin: 4px 0 8px; padding-left: 22px; } .ovas-msg li { margin: 2px 0; }
.ovas-msg code, .ovas-detail code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .88em; padding: 1px 5px; border-radius: 6px; background: var(--ovas-t); }
.ovas-msg a { color: var(--accent-light, var(--accent, #60a5fa)); }
.ovas-code, .ovas-out, .ovas-diff { margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--ovas-code); border: 1px solid var(--ovas-b); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; line-height: 1.5; overflow: auto; max-height: 50vh; white-space: pre; }
.ovas-code code { padding: 0; background: none; }
.ovas-group, .ovas-step { border: 1px solid var(--ovas-b); border-radius: 14px; background: var(--ovas-s); overflow: hidden; }
.ovas-group > summary, .ovas-step > summary { display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 6px 12px; cursor: pointer; list-style: none; }
.ovas-group > summary::-webkit-details-marker, .ovas-step > summary::-webkit-details-marker { display: none; }
.ovas-chev { width: 14px; height: 14px; flex: none; color: var(--ovas-mut); transition: transform .15s; }
details[open] > summary .ovas-chev { transform: rotate(90deg); }
.ovas-icons { display: inline-flex; flex: none; }
.ovas-kind { display: grid; place-items: center; width: 28px; height: 28px; flex: none; border-radius: 9px; background: color-mix(in srgb, var(--accent, #3b82f6) 14%, transparent); color: var(--accent-light, var(--accent, #60a5fa)); }
.ovas-icons .ovas-kind { width: 24px; height: 24px; border: 2px solid var(--ovas-s); border-radius: 8px; }
.ovas-icons .ovas-kind + .ovas-kind { margin-left: -7px; }
.ovas-kind .ovas-ic { width: 14px; height: 14px; }
.ovas-kind[data-k="edit"], .ovas-kind[data-k="write"] { color: #4ade80; background: color-mix(in srgb, #22c55e 14%, transparent); }
.ovas-kind[data-k="web"] { color: #38bdf8; background: color-mix(in srgb, #0ea5e9 14%, transparent); }
.ovas-kind[data-k="agent"] { color: #c084fc; background: color-mix(in srgb, #a855f7 16%, transparent); }
.ovas-sum { flex: 1; min-width: 0; display: grid; gap: 1px; }
.ovas-sum b { font-size: 14px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovas-sum small { font-size: 12px; color: var(--ovas-mut); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.ovas-delta { flex: none; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
.ovas-delta .a { color: var(--ovas-ok); } .ovas-delta .r { color: var(--ovas-bad); margin-left: 4px; }
.ovas-state { flex: none; display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--ovas-mut); font-variant-numeric: tabular-nums; }
.ovas-state .ovas-ic { width: 15px; height: 15px; }
.ovas-state[data-s="ok"] .ovas-ic { color: var(--ovas-ok); } .ovas-state[data-s="fail"] { color: var(--ovas-bad); }
.ovas-spin { width: 13px; height: 13px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: ovas-spin .8s linear infinite; color: var(--accent, #3b82f6); }
.ovas-group > ol { list-style: none; margin: 0; padding: 0 8px 8px; display: grid; gap: 6px; }
.ovas-group.is-one { border: 0; background: none; }
.ovas-group.is-one > summary { display: none; }
.ovas-group.is-one > ol { padding: 0; }
.ovas-group.is-one .ovas-step { background: var(--ovas-s); border-color: var(--ovas-b); }
.ovas-group .ovas-step { background: var(--ovas-t); border-color: transparent; }
.ovas-detail { display: grid; gap: 10px; padding: 0 12px 12px; }
.ovas-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--ovas-mut); margin-bottom: -4px; }
.ovas-copy { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; color: var(--ovas-mut); font: inherit; font-size: 11.5px; font-weight: 650; letter-spacing: 0; text-transform: none; cursor: pointer; padding: 2px 4px; border-radius: 6px; }
.ovas-copy:hover { color: var(--text-primary, #e6edf7); background: var(--ovas-t); }
.ovas-copy .ovas-ic { width: 13px; height: 13px; }
.ovas-out.is-fail { box-shadow: inset 3px 0 0 var(--ovas-bad); }
.ovas-wait { font-size: 13px; color: var(--ovas-mut); display: flex; align-items: center; gap: 8px; }
.ovas-diff span { display: block; padding: 0 6px; margin: 0 -6px; }
.ovas-diff .a { background: var(--ovas-add); } .ovas-diff .r { background: var(--ovas-del); } .ovas-diff .h { color: var(--ovas-mut); }
.ovas-sub { margin: 0 8px 8px; padding: 8px 0 0 12px; border-left: 2px solid color-mix(in srgb, #a855f7 45%, transparent); display: grid; gap: 8px; }
.ovas-handoff { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--ovas-sec); }
.ovas-handoff::before, .ovas-handoff::after { content: ''; flex: 1; height: 1px; background: var(--ovas-b); }
.ovas-hand { display: grid; justify-items: center; gap: 4px; max-width: 82%; text-align: center; }
.ovas-hand-row { display: inline-flex; align-items: center; gap: 6px; }
.ovas-hand-row .ovas-ic { color: var(--ovas-mut); }
.ovas-hand small { font-size: 12.5px; color: var(--ovas-mut); line-height: 1.4; }
.ovas-note { display: flex; gap: 8px; align-items: flex-start; padding: 9px 12px; border-radius: 12px; font-size: 13.5px; background: color-mix(in srgb, #f59e0b 12%, transparent); color: var(--text-primary, #e6edf7); }
.ovas-note[data-level="error"] { background: color-mix(in srgb, #ef4444 13%, transparent); }
.ovas-note[data-level="info"] { background: color-mix(in srgb, #22c55e 10%, transparent); }
.ovas-note[data-level="info"] .ovas-ic { color: var(--ovas-ok); }
.ovas-note .ovas-ic { color: #f59e0b; margin-top: 2px; } .ovas-note[data-level="error"] .ovas-ic { color: var(--ovas-bad); }
.ovas-done { display: grid; gap: 6px; padding: 12px 14px; border-radius: 14px; border: 1px solid color-mix(in srgb, #22c55e 40%, transparent); background: color-mix(in srgb, #22c55e 8%, transparent); }
.ovas-done[data-ok="0"] { border-color: color-mix(in srgb, #ef4444 40%, transparent); background: color-mix(in srgb, #ef4444 8%, transparent); }
.ovas-done > b { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.ovas-line { display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: 12.5px; color: var(--ovas-mut); }
.ovas-line::before { content: ''; flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--ovas-mut); opacity: .7; }
.ovas-empty { padding: 18px; text-align: center; color: var(--ovas-mut); font-size: 13.5px; border: 1px dashed var(--ovas-b); border-radius: 14px; }
.ovas [hidden] { display: none !important; }
@keyframes ovas-spin { to { transform: rotate(360deg); } }
@media (hover: hover) { .ovas-group > summary:hover, .ovas-step > summary:hover { background: var(--bg-hover, rgba(255,255,255,.04)); } }
@media (max-width: 640px) {
  .ovas-head { padding: 10px 12px; border-radius: 14px; } .ovas-msg { font-size: 14.5px; }
  .ovas-code, .ovas-out, .ovas-diff { font-size: 12px; max-height: 45vh; }
  .ovas-bar { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin: 0 -14px; padding: 0 14px; } .ovas-bar::-webkit-scrollbar { display: none; }
  .ovas-chip { flex: none; } .ovas-icons .ovas-kind + .ovas-kind { display: none; }
}
@media (prefers-reduced-motion: reduce) { .ovas-spin, .ovas-plan li::before { animation: none; } }`;
        document.head.appendChild(st);
    }

    // ── The view ──────────────────────────────────────────────
    function mount(host, opts = {}) {
        styles();
        const S = { status: opts.status || 'running', label: opts.label || '', startedAt: opts.startedAt || Date.now(), endedAt: null, agents: [], steps: new Map(), plan: null, tokens: { in: 0, out: 0 }, cost: 0, durationMs: 0, problems: 0, filter: 'all', follow: opts.follow !== false, lastGroup: null };
        host.textContent = '';
        const box = el('div', 'ovas');
        box.innerHTML = `<div class="ovas-head"><div class="ovas-top"><span class="ovas-pill" data-s="${esc(S.status)}"></span><span class="ovas-title"></span></div><div class="ovas-meta"><span class="ovas-agents"></span><span data-m="time"></span><span data-m="steps"></span><span data-m="files"></span><span data-m="cost"></span></div><details class="ovas-plan" hidden><summary><span class="ovas-plan-now"></span><span class="ovas-plan-n"></span></summary><div class="ovas-plan-bar"><i style="width:0"></i></div><ol></ol></details></div>`
            + '<div class="ovas-bar" role="toolbar" aria-label="Show"></div><ol class="ovas-feed" aria-live="polite"></ol>';
        host.appendChild(box);
        const head = box.querySelector('.ovas-head'), feed = box.querySelector('.ovas-feed'), bar = box.querySelector('.ovas-bar');
        head.querySelector('.ovas-title').textContent = opts.title || 'Agent session';
        const FILTERS = [['all', 'Everything'], ['said', 'What it said'], ['steps', 'Steps'], ['problems', 'Problems']];
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
            feed.querySelectorAll(':scope > li').forEach((li) => {
                const k = li.dataset.k || '';
                li.hidden = S.filter === 'all' ? false : S.filter === 'said' ? !(k === 'msg' || k === 'done' || k === 'handoff') : S.filter === 'steps' ? !(k === 'steps' || k === 'handoff') : !(li.dataset.p === '1');
            });
        }
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
            if (step.kind === 'agent' && info.preview) { const p = el('div', 'ovas-msg'); p.appendChild(markdown(info.preview.slice(0, 1600))); section('Asked to', p, false); }
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
                st.innerHTML = `${svg(step.ok ? 'ok' : 'fail')}<span>${esc(step.ended - step.started > 1500 ? t : '')}</span>`;
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
            if (x.agent && x.t !== 'agent' && x.t !== 'handoff' && (!S.agents.length || S.agents[S.agents.length - 1].agent !== x.agent)) { S.agents.push({ agent: x.agent }); paintHead(); }
            if (x.t === 'tool' && !x.id) { x = { ...x, id: `a${S.steps.size + 1}` }; if (!pending.has(x.name)) pending.set(x.name, []); pending.get(x.name).push(x.id); }
            if (x.t === 'tool_result' && !x.id) { const q = pending.get(x.name); x = { ...x, id: q && q.length ? q.shift() : '' }; }
            if (x.t === 'state') { status(x.state); return; }
            if (x.t === 'agent') {
                const last = S.agents[S.agents.length - 1];
                if (last && last.agent === x.agent) { if (x.model) last.model = x.model; } else S.agents.push({ agent: x.agent, model: x.model });
                paintHead(); return;
            }
            if (x.t === 'text') {
                const li = el('li', 'ovas-msg'); li.dataset.k = 'msg'; li.appendChild(markdown(x.text)); appendLi(target, li); return;
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
                step.done = true; step.ok = x.ok !== false; step.ended = Date.now();
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
                const li = el('li', 'ovas-done'); li.dataset.k = 'done'; li.dataset.ok = x.ok ? '1' : '0';
                const b = el('b'); b.innerHTML = svg(x.ok ? 'ok' : 'fail'); b.appendChild(document.createTextNode(`${agentName((S.agents[S.agents.length - 1] || {}).agent)} ${x.ok ? 'finished' : 'stopped'}${x.duration_ms ? ` in ${dur(x.duration_ms)}` : ''}`));
                li.appendChild(b);
                if (x.text) { const m = el('div', 'ovas-msg'); m.appendChild(markdown(x.text)); li.appendChild(m); }
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
                problems: S.problems, costUsd: Math.round(S.cost * 1e4) / 1e4, durationMs: S.durationMs || ((S.endedAt || Date.now()) - S.startedAt), tokens: { ...S.tokens },
            };
        }
        const LABEL = { queued: 'Waiting', placed: 'Starting', running: 'Running', succeeded: 'Finished', failed: 'Failed', cancelled: 'Cancelled', expired: 'Expired' };
        function paintHead() {
            const sm = summary();
            const pill = head.querySelector('.ovas-pill');
            pill.dataset.s = S.status;
            pill.innerHTML = `${S.status === 'running' || S.status === 'placed' ? '<span class="ovas-spin"></span>' : S.status === 'succeeded' ? svg('ok') : S.status === 'failed' || S.status === 'expired' ? svg('fail') : ''}<span></span>`;
            pill.lastChild.textContent = S.label || LABEL[S.status] || S.status;
            const ag = head.querySelector('.ovas-agents'); ag.textContent = '';
            S.agents.forEach((a, i) => { if (i) ag.appendChild(el('span', '', '→')); const c = el('span', `ovas-agent${i === S.agents.length - 1 ? ' is-now' : ''}`, agentName(a.agent)); if (a.model) c.title = a.model; ag.appendChild(c); });
            const m = (k, html) => { const n = head.querySelector(`[data-m="${k}"]`); n.innerHTML = html; n.hidden = !html; };
            m('time', `<b>${esc(dur(sm.durationMs))}</b>`);
            m('steps', sm.steps ? `<b>${sm.steps}</b> step${sm.steps === 1 ? '' : 's'}${sm.commands ? ` · <b>${sm.commands}</b> command${sm.commands === 1 ? '' : 's'}` : ''}` : '');
            m('files', sm.files ? `<b>${sm.files}</b> file${sm.files === 1 ? '' : 's'} <span style="color:var(--ovas-ok)">+${sm.added}</span> <span style="color:var(--ovas-bad)">−${sm.removed}</span>` : '');
            m('cost', sm.costUsd ? `<b>$${sm.costUsd.toFixed(sm.costUsd < 1 ? 3 : 2)}</b>` : '');
        }
        function status(s, label) {
            S.status = s; S.label = label || '';
            if (!['running', 'placed', 'queued'].includes(s)) { S.endedAt = S.endedAt || Date.now(); empty.textContent = 'Nothing was recorded for this run.'; }
            paintHead();
        }
        const tick = setInterval(() => { if (S.status === 'running' || S.status === 'placed') { S.steps.forEach((st) => { if (!st.done) setStepState(st); }); paintHead(); } }, 1000);
        paintHead();
        return { push, pushAll: (list) => (list || []).forEach(push), status, summary, destroy() { clearInterval(tick); host.textContent = ''; } };
    }

    const api = { mount, normalize, diffLines, kindOf };
    root.OpenVibeAgentSession = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
