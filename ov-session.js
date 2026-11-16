/**
 * ov-session.js (openvibe-shared 4.265.0; 4.266.0 your Actor, the Action Center, the menu's Vibe): one session surface for every agent (plan §AD.8). The owner, 11-15 night:
 * "the layout sucks … a complete rethink and redesign … more modular, shared, SDK API enabled, and way smarter,
 * intelligent type system sessions, kind of like Claude Code or any other harnesses, but make it way better"; "you
 * shouldn't have to swap to a different site".
 *
 * Every agent (your Actor, Codes, a coding harness, an agent you made) is a session over the Frame's Run API (Network
 * /api/frame/runs: agents.run@1, agents.step@1, agents.event@1). There is no Actor | Codes switch: who works on it is a
 * property of the session. A new session is one box; Auto places the words (code to Codes, the rest to your Actor),
 * and `@codes`, `@actor`, a harness's name or the context chip pins it.
 *
 *   const s = OpenVibeSession.mount(host, {
 *     base: 'https://openvibe.network/api/frame',   // the Frame (default)
 *     token: () => token,                            // the person's Network token (or a string)
 *     me: { name, avatar_url },                      // the person, for the box
 *     sibling: (file) => url,                        // where ov-composer.js and ov-picker.js are (the navbar's sibling())
 *     open: 'codes:tsk_…',                           // a session to open first (else a new one)
 *     agent: 'auto' | 'actor' | 'codes' | id,        // who a new session goes to first (the chip can change it)
 *     works: [{ value, name, line }],                // what a code session may work on (repositories); optional
 *     starters: [[glyph, words], …],                 // things to ask, under a new session's hello
 *     title: 'Vibe', line: 'Ask anything …',         // a new session's hello
 *     onEvent: (type, data) => {},                   // session.opened | started | step | approval | ended | blank
 *     actor: true,                                   // 4.266.0: your Actor heads the sessions (face, state, today's
 *                                                    // spend, Pause or Resume; the Frame's /actor) and greets a new one
 *     actions: { base: 'https://openvibe.network' }, // 4.266.0: the Action Center's waiting and running work from every
 *                                                    // product in the list, approved or declined there
 *     top: (slot) => ({ destroy }),                  // 4.266.0: something of the host's above the sessions
 *   });
 *   s.open(ref); s.blank(); s.start(words); s.prefill(words); s.drawer(true|false); s.list(); s.refresh(); s.destroy();
 *   OpenVibeSession.card(type, (data, step, ctx) => Node)   a rich card for a step's ui.type
 *
 * The layout, phone first:
 *   - a slim head: the sessions button, the agent's face, the title, live status (Working · 2:14 · $0.03), the files it
 *     changed, and ⋯ (stop, copy the link, its own page, a new session);
 *   - the thread: your words on the right; the agent's words full width; thinking folded; the tools it used in a row
 *     grouped into one block ("Read 4 files, ran 2 commands, edited 3") that opens to each; the files it changed as a
 *     card that opens the diff; approvals inline; helpers (child sessions) as rows that open in place; what it made;
 *   - the plan: the agent's live checklist above the box ("Plan · 3 of 7"), opening to every item;
 *   - the box: the network's composer, one line, with ONE context chip (Agent · Model · Runs on · Works on) that opens
 *     one picker; slash commands (/new /model /agent /where /repo /stop /sessions /help) and @-mentions;
 *   - sessions: a drawer (the button at the top left, or a swipe from the edge) on a phone, a column on a computer:
 *     search, needs-you first, today, earlier.
 * Everything a run says is set as text, never markup. Motion follows html[data-ov-motion]; colours are theme tokens.
 */
(function (root) {
    // The ways Actor can work a message (Actor's engines; openvibe.actor/api/v1/engines): the session's Way choice.
    // 4.286.0: the shared effort ladder every harness maps to its own flag (Codes' runner: claude --effort, codex
    // model_reasoning_effort, aider --reasoning-effort …; one with none just runs), and what a coding agent may do.
    const EFFORTS = [
        { id: 'auto', name: 'Auto', line: 'The harness decides how long to think' },
        { id: 'low', name: 'Low', line: 'Quick: little thinking, fast answers' },
        { id: 'medium', name: 'Medium', line: 'Balanced' },
        { id: 'high', name: 'High', line: 'Thinks longer before it acts' },
        { id: 'xhigh', name: 'Extra high', line: 'Much longer thinking, for hard problems' },
        { id: 'max', name: 'Max', line: 'As long as it takes: the most thinking the model allows' },
    ];
    const PERMISSIONS = [
        { id: 'edit', name: 'Edit files', line: 'Changes files in its workspace; asks before running commands' },
        { id: 'read', name: 'Look only', line: 'Reads and answers; changes nothing' },
        { id: 'full', name: 'Full', line: 'Runs commands and changes anything in its workspace' },
    ];
    const WAYS = [
        { id: 'auto', name: 'Auto', line: 'Actor\'s agent, or what fits the question' },
        { id: 'agent', name: 'Actor\'s agent', line: 'Plans, uses tools, checks its answer' },
        { id: 'model', name: 'One model', line: 'One answer from the model you picked, no tools: quick and cheap' },
        { id: 'decisions', name: 'Decisions', line: 'Yes or no, pick one, rate it: with how sure it is' },
        { id: 'openai-agent', name: 'OpenAI agent', line: 'OpenAI\'s agent with its own web search' },
        { id: 'open-model', name: 'Open model', line: 'A small model on OpenVibe\'s own server: nothing leaves OpenVibe' },
    ];
    'use strict';
    if (typeof document === 'undefined' || root.OpenVibeSession) return;

    // ── glyphs (the registry's drawings; 24-unit strokes) ──
    const G = {
        list: '<path d="M4 6.5h16M4 12h16M4 17.5h10"/>',
        sidebar: '<rect x="3" y="5.5" width="18" height="13" rx="1.6"/><rect class="ovse-sb-pane" x="4.7" y="7.2" width="4" height="9.6" rx=".7" fill="currentColor" stroke="none"/><path class="ovse-sb-line" d="M9.5 5.5v13"/>',
        back: '<path d="M20.8 12H4M10.3 5.7l-6.3 6.3l6.3 6.3"/>',
        more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        x: '<path d="M7 7l10 10M17 7L7 17"/>',
        search: '<circle cx="10.6" cy="10.6" r="7"/><path d="M20.4 20.4l-4.5-4.5"/>',
        spark: '<path d="M10.4 3.6l1.7 4.8L17 10.1l-4.8 1.7L10.4 16.7l-1.7-4.8L3.9 10.1l4.8-1.7ZM17 14.8l0.8 2.1L19.8 17.6l-2.1 0.8L17 20.3l-0.8-2.1L14.3 17.6l2.1-0.8Z"/>',
        chat: '<path d="M3.8 4.3h16.8v11.7H8l-4.2 4.2Z"/>',
        code: '<path d="M7.8 7.8l-4.2 4.2l4.2 4.2M16.2 7.8l4.2 4.2l-4.2 4.2M14.2 4.6l-4.2 14.8"/>',
        robot: '<rect x="5.4" y="8.3" width="13.2" height="10.4" rx="2.8"/><path d="M12 4.6v3.8M9.2 13.1h0M14.8 13.1h0M9.6 16.4h4.7"/>',
        tool: '<path d="M14.6 3.6a5.2 5.2 0 0 0-4.6 7.3L3.7 17.3V20.3h3.1l6.4-6.4a5.2 5.2 0 0 0 7.3-4.6l-3.2 1.2l-2.5-2.5l1.2-3.2Z"/>',
        think: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3Z"/>',
        file: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5"/>',
        edit: '<path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4"/>',
        term: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15h4.5"/>',
        globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c2.4 2.4 3.6 5.3 3.6 8.6s-1.2 6.2-3.6 8.6c-2.4-2.4-3.6-5.3-3.6-8.6s1.2-6.2 3.6-8.6Z"/>',
        check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
        child: '<path d="M6 4v8a4 4 0 0 0 4 4h8M14 12l4 4-4 4"/>',
        pr: '<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="M6 8.2v7.6M18 15.8V9a3 3 0 0 0-3-3h-4M13 4l-2 2 2 2"/>',
        open: '<path d="M7 17L17 7M9 7h8v8"/>',
        link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
        stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
        repo: '<path d="M6 3.5h11.5v14H7.2a2 2 0 0 0 0 4h10.3M6 3.5a2 2 0 0 0-2 2v14"/>',
        model: '<path d="M12 3.2l7.6 4.4v8.8L12 20.8l-7.6-4.4V7.6Z"/><path d="M12 12l7.6-4.4M12 12v8.8M12 12L4.4 7.6"/>',
        computer: '<rect x="3.2" y="4.6" width="17.6" height="11.6" rx="2"/><path d="M8.6 20h6.8M12 16.2V20"/>',
        key: '<circle cx="8" cy="15" r="4.2"/><path d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5M14.2 8.8l2 2"/>',
        plan: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M3.8 6.5l1.3 1.3 2.2-2.4M3.8 12l1.3 1.3 2.2-2.4"/><circle cx="5.2" cy="17.5" r="1.4"/>',
        fold: '<path d="M6 9l6 6 6-6"/>',
        copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
        made: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/>',
        clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
        send: '<path d="M12 19.5V5M5.8 11.2L12 5l6.2 6.2"/>',
        pause: '<path d="M9 6v12M15 6v12"/>',
        live: '<circle cx="12" cy="11.8" r="2"/><path d="M8.6 8.4a4.9 4.9 0 0 0 0 7.1M15.4 8.4a4.9 4.9 0 0 1 0 7.1M6.3 6.1a8.1 8.1 0 0 0 0 11.9M17.7 6.1a8.1 8.1 0 0 1 0 11.9"/>',
        timer: '<path d="M12 4.5a8.2 8.2 0 1 1 0 16.4 8.2 8.2 0 0 1 0-16.4zM12 8.6v4.2l2.7 1.7M9.6 2.6h4.8"/>',
        bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15ZM10 20.5a2.2 2.2 0 0 0 4 0"/>',
        calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
        phone: '<path d="M6.5 3.8h3l1.5 4-2 1.3a10.5 10.5 0 0 0 5.9 5.9l1.3-2 4 1.5v3a1.8 1.8 0 0 1-2 1.8A15.5 15.5 0 0 1 4.7 5.8a1.8 1.8 0 0 1 1.8-2Z"/>',
        play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    };
    const svg = (name, cls) => {
        const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', `ovse-g${cls ? ` ${cls}` : ''}`);
        s.innerHTML = G[name] || G.spark;   // the registry's constants above, never page text
        return s;
    };
    /** A glyph as markup for OpenVibePicker's rows (the constants above only). */
    // Your own setup (the owner, 11-16: "a place where it brings you to set up your different harnesses and API keys …
    // even if you choose Actor … your computer with your own harness and API keys set up in Locker … the shared node,
    // their own computer"): the places that already do each part, in one list, from every session on every site. The
    // Frame's options may send their own list (setup: [{ id, name, line, url }]); https links only.
    const SETUP = [
        { id: 'computer', name: 'Your computer', line: 'Add it with OpenVibe Link: agents, coding agents and models run there, on your keys', url: 'https://openvibe.link/add-computer' },
        { id: 'machines', name: 'Your computers and shared nodes', line: 'Where your sessions can run, and who else may use them', url: 'https://openvibe.link/machines' },
        { id: 'harnesses', name: 'Coding agents', line: 'Claude Code, Codex, OpenCode and the rest: installed and signed in where they run', url: 'https://openvibe.codes/setup' },
        { id: 'actor', name: 'Actor on your setup', line: 'Its model and where it runs: OpenVibe\'s keys, your own key, or your computer', url: 'https://openvibe.actor/chat/model' },
        { id: 'keys', name: 'Your keys and sign-ins', line: 'Kept sealed in Locker; an agent asks you before it uses one', url: 'https://openvibe.locker/passwords' },
    ];
    const setupOf = (opts) => {
        const own = opts && Array.isArray(opts.setup) ? opts.setup.filter((x) => x && x.id && x.name && /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(String(x.url || ''))) : [];
        return own.length ? own.slice(0, 12) : SETUP;
    };
    const SETUP_ROW = { id: '__setup', name: 'Use your own…', line: 'Your computer, coding agents and keys, instead of OpenVibe\'s' };
    const svgMarkup = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${G[name] || G.spark}</svg>`;
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; };
    const btn = (cls, label, glyph, words) => { const b = el('button', cls); b.type = 'button'; if (label) { b.setAttribute('aria-label', label); b.title = label; } if (glyph) b.append(svg(glyph)); if (words) b.append(el('span', '', words)); return b; };
    const httpsUrl = (v) => { try { const u = new URL(String(v)); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
    const hueOf = (id) => { let x = 7; for (const c of String(id || 'ov')) x = (x * 31 + c.codePointAt(0)) % 360; return x; };
    const ms = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? t : 0; };
    const ago = (iso) => {
        const t = ms(iso); if (!t) return '';
        const s = Math.max(1, Math.round((Date.now() - t) / 1000));
        if (s < 60) return 'now'; if (s < 3600) return `${Math.round(s / 60)} min`; if (s < 86400) return `${Math.round(s / 3600)} h`;
        const d = Math.round(s / 86400); return d === 1 ? 'yesterday' : `${d} d`;
    };
    const clock = (sec) => { const s = Math.max(0, Math.round(sec)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`; };
    // A small amount of money in words: $0.0042, $0.012, $1.20.
    const costWords = (usd) => (usd >= 1 ? `$${usd.toFixed(2)}` : usd >= 0.01 ? `$${usd.toFixed(3).replace(/0$/, '')}` : `$${Number(usd.toPrecision(2))}`);
    const spent = (cost) => {
        if (!cost || typeof cost !== 'object') return '';
        const usd = Number(cost.usd);
        if (Number.isFinite(usd) && usd > 0) return usd < 0.01 ? 'under 1¢' : `$${usd < 10 ? usd.toFixed(2) : usd.toFixed(0)}`;
        const tk = Number(cost.tokens); return Number.isFinite(tk) && tk > 0 ? `${tk >= 1000 ? `${(tk / 1000).toFixed(tk >= 10000 ? 0 : 1)}k` : tk} tokens` : '';
    };
    const STATUS = { planning: ['Starting', 'run'], running: ['Working', 'run'], waiting: ['Waiting for you', 'wait'], done: ['Done', 'ok'], failed: ['Did not finish', 'bad'], stopped: ['Stopped', 'off'] };
    const WAITING = { approval: 'It asks before it goes on', takeover: 'It needs you to take over a step', payment: 'It needs a payment to go on', message: '' };
    const isLive = (r) => !!r && ['planning', 'running'].includes(r.status);
    const isEnd = (r) => !!r && ['done', 'failed', 'stopped'].includes(r.status);
    const needsYou = (r) => !!r && r.status === 'waiting' && !!r.waiting && r.waiting.for && r.waiting.for !== 'message';
    const KIND_GLYPH = { code: 'code', task: 'robot', machine: 'computer', chat: 'chat', ask: 'search', goal: 'made' };

    // ── what a tool step did ──
    const TOOL_KINDS = [
        ['plan', /todo|update_plan|^plan$|set_plan/i],
        ['edit', /edit|write|patch|str_replace|create_file|replace|insert|delete_file|git_files_write/i],
        ['read', /^(read|view|cat|open)|read_file|get_file|fs_read|notebook_read/i],
        ['shell', /bash|shell|exec|command|terminal|^run$|run_command/i],
        ['search', /grep|glob|search|find|^ls$|list_files|list_dir|ripgrep/i],
        ['web', /web|fetch|browse|http|url|navigate/i],
        ['agent', /^task$|agent|spawn|delegate|subagent/i],
    ];
    const TOOL_WORDS = { edit: ['edited', 'edit', 'file', 'files'], read: ['read', 'file', 'file', 'files'], shell: ['ran', 'term', 'command', 'commands'], search: ['searched', 'search', 'time', 'times'], web: ['looked up', 'globe', 'page', 'pages'], agent: ['asked', 'child', 'helper', 'helpers'], tool: ['used', 'tool', 'tool', 'tools'] };
    const toolName = (s) => String((s.tool_call && s.tool_call.name) || '');
    const toolKind = (s) => {
        const n = toolName(s) || String(s.glyph || '');
        for (const [k, re] of TOOL_KINDS) if (re.test(n)) return k;
        if (s.kind === 'file') return 'edit';
        return 'tool';
    };
    const inputOf = (s) => (s.tool_call && s.tool_call.input && typeof s.tool_call.input === 'object' ? s.tool_call.input : {});
    const toolWhat = (s) => { const i = inputOf(s); const w = i.path || i.file_path || i.filename || i.command || i.cmd || i.pattern || i.query || i.q || i.url || ''; return String(Array.isArray(w) ? w.join(' ') : w).slice(0, 160); };
    /** One line for a tool row: its own title, else what it touched (a path, a command, a query, an address). */
    const toolLine = (s) => {
        if (s.title) return String(s.title);
        const i = inputOf(s);
        const what = i.path || i.file_path || i.filename || i.command || i.cmd || i.pattern || i.query || i.q || i.url || i.description || '';
        const k = toolKind(s);
        const verb = { edit: 'Edited', read: 'Read', shell: 'Ran', search: 'Searched', web: 'Opened', agent: 'Asked a helper', tool: toolName(s) || 'A step' }[k];
        return what ? `${verb} ${String(Array.isArray(what) ? what.join(' ') : what).slice(0, 160)}` : verb;
    };

    /** The files a step changed: [{ path, adds, dels, lines: [[sign, text]] }]. */
    function filesOf(s) {
        if (s.ui && s.ui.type === 'diff' && s.ui.data && Array.isArray(s.ui.data.files)) {
            return s.ui.data.files.slice(0, 40).map((f) => fileFrom(String(f.path || f.name || 'a file'), f));
        }
        if (toolKind(s) !== 'edit') return [];
        const i = inputOf(s);
        const patch = [i.patch, i.diff, typeof i.input === 'string' ? i.input : null].find((x) => typeof x === 'string' && x.length);
        if (patch) return patchFiles(patch);
        const path = String(i.path || i.file_path || i.filename || i.target_file || (s.kind === 'file' ? s.text : '') || '');
        if (!path) return [];
        return [fileFrom(path, i)];
    }
    function fileFrom(path, i) {
        const lines = [];
        const put = (sign, text) => String(text == null ? '' : text).split('\n').slice(0, 400).forEach((t) => lines.push([sign, t]));
        const edits = Array.isArray(i.edits) ? i.edits : [i];
        let any = false;
        for (const e of edits.slice(0, 30)) {
            const oldT = e.old_string ?? e.old_str ?? e.oldText ?? e.old;
            const newT = e.new_string ?? e.new_str ?? e.newText ?? e.new;
            if (oldT != null || newT != null) { if (lines.length) lines.push(['@', '…']); if (oldT) put('-', oldT); if (newT) put('+', newT); any = true; }
        }
        const whole = i.content ?? i.file_text ?? i.contents ?? i.text;
        if (!any && typeof whole === 'string') put('+', whole);
        if (typeof i.patch === 'string' && !any) return patchFiles(i.patch)[0] || { path, adds: 0, dels: 0, lines: [] };
        const adds = Number.isFinite(i.adds) ? i.adds : lines.filter((l) => l[0] === '+').length;
        const dels = Number.isFinite(i.dels) ? i.dels : lines.filter((l) => l[0] === '-').length;
        return { path, adds, dels, lines };
    }
    /** apply_patch ("*** Update File: x") and unified diffs ("+++ b/x"). */
    function patchFiles(text) {
        const out = []; let cur = null;
        for (const line of String(text).split('\n').slice(0, 4000)) {
            const m = /^\*\*\* (Update|Add|Delete) File: (.+)$/.exec(line) || /^\+\+\+ (?:b\/)?(.+)$/.exec(line);
            if (m) {
                const path = (m[2] || m[1]).trim();
                if (path === '/dev/null') continue;
                cur = { path, adds: 0, dels: 0, lines: [] }; out.push(cur); continue;
            }
            if (!cur || /^(--- |\*\*\* (Begin|End) Patch|diff --git|index )/.test(line)) continue;
            if (line.startsWith('@@')) { cur.lines.push(['@', line]); continue; }
            const sign = line[0] === '+' ? '+' : line[0] === '-' ? '-' : ' ';
            if (sign === '+') cur.adds++; else if (sign === '-') cur.dels++;
            if (cur.lines.length < 600) cur.lines.push([sign, sign === ' ' ? line.replace(/^ /, '') : line.slice(1)]);
        }
        return out;
    }
    /** A plan or todo list a step carries: [{ text, state: done | doing | todo }], or null. */
    function planOf(s) {
        let items = null;
        if (s.ui && /^(plan|todo|todos|checklist)$/.test(String(s.ui.type || ''))) { const d = s.ui.data || {}; items = d.items || d.todos || d.steps || d.plan; }
        else if (s.kind === 'tool' && toolKind(s) === 'plan') { const i = inputOf(s); items = i.todos || i.plan || i.items || i.steps; }
        if (!Array.isArray(items) || !items.length) return null;
        return items.slice(0, 60).map((it) => {
            if (typeof it === 'string') return { text: it, state: 'todo' };
            const st = String(it.status || it.state || (it.done === true || it.completed === true ? 'done' : '')).toLowerCase();
            return { text: String(it.content || it.text || it.step || it.title || it.activeForm || '').slice(0, 300), state: /done|complete/.test(st) ? 'done' : /progress|doing|active|running/.test(st) ? 'doing' : 'todo' };
        }).filter((x) => x.text);
    }

    // ── words: paragraphs, headings, lists, code, links, numbered sources (as nodes, never markup) ──
    function inline(node, text, sources) {
        const re = /(`[^`\n]{1,400}`)|(\*\*[^*\n]{1,400}\*\*)|\[([^\]\n]{1,200})\]\((https:\/\/[^\s)]{1,800})\)|(https:\/\/[^\s<>()]{2,800}[^\s<>().,;:!?'"])|\[(\d{1,2})\]/g;
        let at = 0, m;
        const s = String(text);
        while ((m = re.exec(s))) {
            if (m.index > at) node.append(document.createTextNode(s.slice(at, m.index)));
            if (m[1]) node.append(el('code', 'ovse-ic', m[1].slice(1, -1)));
            else if (m[2]) node.append(el('b', '', m[2].slice(2, -2)));
            else if (m[3]) { const a = el('a', '', m[3]); a.href = m[4]; a.target = '_blank'; a.rel = 'nofollow noopener noreferrer'; node.append(a); }
            else if (m[5]) { const a = el('a', '', m[5].replace(/^https:\/\/(www\.)?/, '').slice(0, 60)); a.href = m[5]; a.target = '_blank'; a.rel = 'nofollow noopener noreferrer'; node.append(a); }
            else if (m[6]) {
                const n = Number(m[6]); const src = Array.isArray(sources) ? sources.find((x) => Number(x.n) === n) : null; const url = src && httpsUrl(src.url);
                if (url) { const a = el('a', 'ovse-cite', String(n)); a.href = url; a.target = '_blank'; a.rel = 'nofollow noopener noreferrer'; a.title = src.title || ''; node.append(a); }
                else node.append(document.createTextNode(m[0]));
            }
            at = m.index + m[0].length;
        }
        if (at < s.length) node.append(document.createTextNode(s.slice(at)));
        return node;
    }
    function words(text, sources) {
        const box = el('div', 'ovse-words');
        const lines = String(text || '').replace(/\r/g, '').split('\n');
        let para = [], list = null;
        const flush = () => { if (para.length) { box.append(inline(el('p'), para.join(' '), sources)); para = []; } };
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^```/.test(line)) {
                flush(); list = null;
                const lang = line.slice(3).trim().slice(0, 20); const body = [];
                while (++i < lines.length && !/^```/.test(lines[i])) body.push(lines[i]);
                const pre = el('pre', 'ovse-pre'); if (lang) pre.dataset.lang = lang; pre.append(el('code', '', body.join('\n').slice(0, 40000))); box.append(pre);
                continue;
            }
            const h = /^(#{1,4})\s+(.*)$/.exec(line);
            if (h) { flush(); list = null; box.append(inline(el('p', 'ovse-h'), h[2], sources)); continue; }
            const li = /^\s*(?:[-*•]|(\d{1,3})[.)])\s+(.*)$/.exec(line);
            if (li) {
                flush();
                const tag = li[1] ? 'ol' : 'ul';
                if (!list || list.tagName.toLowerCase() !== tag) { list = el(tag); if (li[1] && li[1] !== '1') list.start = Number(li[1]); box.append(list); }
                list.append(inline(el('li'), li[2], sources));
                continue;
            }
            if (!line.trim()) { flush(); list = null; continue; }
            list = null; para.push(line.trim());
        }
        flush();
        return box;
    }

    // ── rich cards (a step's ui.type); OpenVibeRun's registry is read too, so a site's own cards show here ──
    const CARDS = new Map();
    function card(type, render) { if (typeof type === 'string' && /^[a-z][a-z0-9-]{0,40}$/.test(type) && typeof render === 'function') CARDS.set(type, render); }
    card('link', (data) => {
        const url = httpsUrl(data.url); if (!url) return null;
        const a = el('a', 'ovse-linkcard'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        const img = httpsUrl(data.image); if (img) { const i = el('img'); i.src = img; i.alt = ''; i.loading = 'lazy'; a.append(i); }
        const t = el('span'); t.append(el('b', '', data.title || url), el('small', '', data.site || new URL(url).hostname)); a.append(t);
        return a;
    });
    // What a quick action did (a timer set, a reminder made, undone), as chips.
    card('results', (data) => {
        const row = el('div', 'ovse-chips');
        for (const r of (Array.isArray(data.results) ? data.results : []).slice(0, 12)) {
            const c = el('span', `ovse-chip${r.undone ? ' is-undone' : ''}`); c.append(svg(r.kind === 'timer' ? 'timer' : r.kind === 'reminder' ? 'bell' : 'check'), el('span', '', r.label || r.text || r.kind || 'Done'));
            row.append(c);
        }
        return row;
    });
    card('code', (data) => { const pre = el('pre', 'ovse-pre'); pre.append(el('code', '', String(data.code || data.text || '').slice(0, 40000))); return pre; });
    card('table', (data) => {
        const wrap = el('div', 'ovse-table'); const t = el('table');
        const cols = Array.isArray(data.columns) ? data.columns.slice(0, 8) : [];
        if (cols.length) { const tr = el('tr'); cols.forEach((c) => tr.append(el('th', '', c))); const th = el('thead'); th.append(tr); t.append(th); }
        const tb = el('tbody');
        for (const row of (Array.isArray(data.rows) ? data.rows : []).slice(0, 60)) { const tr = el('tr'); (Array.isArray(row) ? row : []).slice(0, 8).forEach((v) => tr.append(el('td', '', v))); tb.append(tr); }
        t.append(tb); wrap.append(t); return wrap;
    });
    const cardRender = (type) => CARDS.get(type) || (root.OpenVibeRun && typeof root.OpenVibeRun.cardFor === 'function' ? root.OpenVibeRun.cardFor(type) : null);

    // ── the Frame's live stream (agents.event@1 as server-sent events; fetch, so the token goes as a header) ──
    function follow({ url, headers, after, onEvent, signal }) {
        let last = String(after || 0);
        let stopped = false;
        const once = async () => {
            const r = await fetch(url, { headers: { ...headers(), Accept: 'text/event-stream', 'Last-Event-ID': last }, signal, credentials: 'omit' });
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

    /** A sibling file (ov-composer.js, ov-picker.js), once per page. */
    const asked = new Map();
    function need(o, file, global) {
        if (root[global]) return Promise.resolve(root[global]);
        if (asked.has(file)) return asked.get(file);
        const job = new Promise((ok) => {
            if (typeof o.sibling !== 'function') return ok(null);
            const id = `ovse-${file.replace(/\W/g, '-')}`;
            let sc = document.getElementById(id) || document.querySelector(`script[src*="/${file}"]`);
            if (root[global]) return ok(root[global]);
            if (!sc) { sc = document.createElement('script'); sc.id = id; sc.async = true; sc.src = o.sibling(file); document.head.appendChild(sc); }
            sc.addEventListener('load', () => ok(root[global] || null), { once: true });
            sc.addEventListener('error', () => ok(null), { once: true });
            setTimeout(() => ok(root[global] || null), 8000);
        });
        asked.set(file, job);
        return job;
    }

    // ── the surface ──
    /**
     * What a link asks the session to start with (4.284.0; the owner, 11-16, on Compare's and Exchange's "Try it in Chat":
     * "it automatically sets the model or sets the mode … based on what the user clicked. It just redirected me to the
     * chat"): ?model= (or ?models=a,b: the first), ?agent=, ?way=, ?q= (the words, ready to send). A model alone means
     * One model: you talk to the model you clicked. Taken once: the address is cleaned so a reload does not take it again.
     */
    const LINK_KEYS = ['model', 'models', 'agent', 'way', 'q', 'prompt'];
    const readableModel = (id) => {
        const tail = String(id).split(/[/:]/).pop() || String(id);
        return tail.replace(/[-_]+/g, ' ').replace(/\b(gpt|oss|glm|ai|vl|llm)\b/gi, (w) => w.toUpperCase()).replace(/\b([a-z])/g, (m) => m.toUpperCase());
    };
    function linkChoice() {
        let u;
        try { u = new URL(location.href); } catch { return null; }
        const p = u.searchParams;
        if (!LINK_KEYS.some((k) => p.has(k))) return null;
        const out = {};
        const model = String(p.get('model') || String(p.get('models') || '').split(',')[0] || '').trim();
        if (/^[\w.:/@+-]{2,160}$/.test(model)) out.model = { id: model, source: 'openvibe', name: readableModel(model) };
        const agent = String(p.get('agent') || '').trim().toLowerCase();
        if (/^[\w-]{2,40}$/.test(agent)) out.agent = agent;
        const way = String(p.get('way') || '').trim();
        if (WAYS.some((w) => w.id === way)) out.way = way;
        const effort = String(p.get('effort') || '').trim().toLowerCase();
        if (EFFORTS.some((e) => e.id === effort)) out.effort = effort;
        else if (out.model) out.way = 'model';
        const q = String(p.get('q') || p.get('prompt') || '').trim();
        if (q) out.q = q.slice(0, 4000);
        LINK_KEYS.forEach((k) => p.delete(k));
        try { history.replaceState(history.state, '', `${u.pathname}${p.toString() ? `?${p}` : ''}${u.hash}`); } catch { /* a sandbox */ }
        return out;
    }

    function mount(host, o = {}) {
        styles();
        const base = String(o.base || 'https://openvibe.network/api/frame').replace(/\/+$/, '');
        const tokenOf = () => (typeof o.token === 'function' ? o.token() : o.token) || '';
        const headers = () => { const t = tokenOf(); return t ? { Authorization: `Bearer ${t}` } : {}; };
        const api = async (path, init = {}) => {
            const r = await fetch(`${base}${path}`, { ...init, credentials: 'omit', headers: { Accept: 'application/json', ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...headers(), ...(init.headers || {}) } });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) { const e = new Error(j.error || j.message || `It did not answer (${r.status})`); e.status = r.status; e.code = j.code; throw e; }
            return j;
        };
        const emit = (type, data) => { if (typeof o.onEvent === 'function') { try { o.onEvent(type, data); } catch { /* the host's */ } } };
        const state = { gen: 0, ref: null, run: null, steps: new Map(), nodes: new Map(), stack: [], stop: null, abort: null, tick: null, runs: [], partial: [], q: '', listGen: 0, paint: 0, queue: [], open: new Set(), drawer: false };
        // The choice for a new session, shared with the composer's (localStorage 'ov:composer:run').
        let pick = { agent: o.agent || 'auto', where: 'auto', model: null, works: null, way: 'auto', effort: 'auto', permission: null };
        try { const kept = JSON.parse(localStorage.getItem('ov:composer:run') || '{}'); pick = { ...pick, ...(o.agent ? {} : { agent: kept.agent || 'auto' }), where: kept.where || 'auto', model: kept.model || null, works: kept.works || null, way: WAYS.some((w) => w.id === kept.way) ? kept.way : 'auto' , effort: EFFORTS.some((e) => e.id === kept.effort) ? kept.effort : 'auto', permission: PERMISSIONS.some((x) => x.id === kept.permission) ? kept.permission : null }; } catch { /* private mode */ }
        // A link's choice wins over the kept one, and is kept (what the person clicked is what they chose).
        const linked = o.fromLink === false ? null : linkChoice();
        if (linked) {
            if (linked.model) pick.model = linked.model;
            if (linked.agent) pick.agent = linked.agent;
            if (linked.way) pick.way = linked.way;
            if (linked.effort) pick.effort = linked.effort;
            try { const kept = JSON.parse(localStorage.getItem('ov:composer:run') || '{}'); localStorage.setItem('ov:composer:run', JSON.stringify({ ...kept, agent: pick.agent, model: pick.model, way: pick.way })); } catch { /* private mode */ }
            emit('linked', { model: pick.model && pick.model.id, agent: pick.agent, way: pick.way });
        }
        const savePick = () => { try { const kept = JSON.parse(localStorage.getItem('ov:composer:run') || '{}'); localStorage.setItem('ov:composer:run', JSON.stringify({ ...kept, agent: pick.agent, where: pick.where, model: pick.model, works: pick.works, way: pick.way, effort: pick.effort, permission: pick.permission })); } catch { /* private mode */ } paintCtx(); };
        // The way the chosen model is used (Actor's engines), as the body Actor reads: null for Auto, or { kind, model? }.
        const wayBody = () => (pick.way && pick.way !== 'auto' ? { kind: pick.way, ...(pick.model && ['agent', 'model', 'decisions'].includes(pick.way) ? { model: pick.model.id } : {}) } : null);
        let options = null;   // the Frame's /run-options: { agents, places }
        const fallbackOptions = { agents: [{ id: 'auto', name: 'Auto', line: 'The right one for what you ask', kind: 'auto' }, { id: 'actor', name: 'Actor', line: 'Your agent: answers, searches, does things for you', kind: 'actor' }, { id: 'codes', name: 'Codes', line: 'Writes and changes code', kind: 'codes' }], places: [{ kind: 'auto', name: 'Auto', line: 'Wherever it fits best' }, { kind: 'openvibe', name: 'OpenVibe', line: 'OpenVibe\'s own computers' }] };
        const loadOptions = async () => {
            if (options) return options;
            try { const d = await api('/run-options'); if (d && Array.isArray(d.agents) && Array.isArray(d.places)) options = d; } catch { /* the short list stands */ }
            return options || fallbackOptions;
        };
        let models = null;   // the Frame's /choices?task=agent: { recommended, groups: [{ id, title, rows }] }
        const loadModels = async () => {
            if (models) return models;
            try { const d = await api('/choices?task=agent'); if (d && Array.isArray(d.groups)) models = d; } catch { /* Auto only */ }
            return models || { groups: [] };
        };

        // ── the frame of the surface ──
        const wrap = el('div', 'ovse');
        const scrim = el('div', 'ovse-scrim');
        const drawer = el('aside', 'ovse-drawer'); drawer.setAttribute('aria-label', 'Your sessions');
        drawer.id = `ovse-drawer-${Math.random().toString(36).slice(2, 9)}`;
        const dHead = el('div', 'ovse-dhead');
        const dNew = btn('ovse-new', 'New session', 'plus', 'New');
        const dClose = btn('ovse-ib ovse-dclose', 'Close', 'x');
        dHead.append(el('b', '', 'Sessions'), dNew, dClose);
        const find = el('label', 'ovse-find'); const findIn = el('input'); findIn.type = 'search'; findIn.placeholder = 'Search sessions'; findIn.setAttribute('aria-label', 'Search sessions'); findIn.setAttribute('data-ov-trending', 'own'); find.append(svg('search'), findIn);
        const runsBox = el('div', 'ovse-runs'); runsBox.setAttribute('role', 'list');
        const actorSlot = el('div', 'ovse-actor'); actorSlot.hidden = true;
        // Codes beside your Actor (4.284.0; the owner, 11-16: "we need to add codes by default … actor and codes means the
        // openvibe.codes system … interconnected, same system as the site"): a session that writes and changes code, on a
        // shared node or your own computer (never OpenVibe's own server).
        const codesSlot = el('div', 'ovse-actor ovse-codes'); codesSlot.hidden = !o.codes;
        if (o.codes) {
            const who = el('button', 'ovse-actor-who is-resting'); who.type = 'button';
            who.setAttribute('aria-label', 'Codes, your coding agent: start a coding session');
            const face = el('span', 'ovse-codes-face'); face.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 8 4.5 12l4 4M15.5 8l4 4-4 4M13.2 5.5l-2.4 13"/></svg>';
            const t = el('span', 'ovse-actor-t');
            const top = el('span', 'ovse-actor-top'); top.append(el('b', '', 'Codes'), el('i', '', 'your coding agent'));
            t.append(top, el('small', '', 'On a shared node or your computer · openvibe.codes'));
            who.append(face, t);
            who.addEventListener('click', () => { pick.agent = 'codes'; if (pick.where === 'openvibe') pick.where = 'auto'; savePick(); blank(); if (!wide) setDrawer(false); });
            const away = el('a', 'ovse-ib'); away.href = 'https://openvibe.codes/'; away.target = '_blank'; away.rel = 'noopener';
            away.setAttribute('aria-label', 'Open OpenVibe.Codes'); away.title = 'Open OpenVibe.Codes'; away.innerHTML = svgMarkup('repo');
            codesSlot.append(who, away);
        }
        const topSlot = el('div', 'ovse-top'); topSlot.hidden = true;
        // The page's own box searches the sessions (the menu, 4.284.0: "the search can be moved up there and use the icon
        // system … so we can save the space"): the drawer's field stays out.
        if (o.searchOutside) find.hidden = true;
        drawer.append(dHead, actorSlot, codesSlot, topSlot, find, runsBox);

        const main = el('section', 'ovse-main');
        const head = el('header', 'ovse-head');
        const menuB = btn('ovse-ib ovse-menu', 'Your sessions', 'sidebar'); menuB.setAttribute('aria-controls', drawer.id);
        const backB = btn('ovse-ib ovse-up', 'Back to the session it helps', 'back'); backB.hidden = true;
        const faceSlot = el('span', 'ovse-face-slot');
        const who = el('div', 'ovse-who'); const titleN = el('b', 'ovse-title'); const statN = el('small', 'ovse-stat'); who.append(titleN, statN);
        const changesB = btn('ovse-chg', 'What it changed', 'file'); changesB.append(el('b'), el('span')); changesB.hidden = true;
        const moreB = btn('ovse-ib ovse-more', 'More', 'more'); moreB.setAttribute('aria-haspopup', 'dialog');
        head.append(menuB, backB, faceSlot, who, changesB, moreB);
        const body = el('div', 'ovse-body');
        const thread = el('div', 'ovse-thread'); thread.setAttribute('role', 'log'); thread.setAttribute('aria-live', 'polite');
        body.append(thread);
        const foot = el('div', 'ovse-foot');
        const planBox = el('details', 'ovse-plan'); planBox.hidden = true;
        const slash = el('div', 'ovse-slash'); slash.hidden = true; slash.setAttribute('role', 'listbox');
        const ctxRow = el('div', 'ovse-ctxrow');
        const ctxB = btn('ovse-ctx', 'How it runs: change it', 'spark', ''); ctxB.setAttribute('aria-haspopup', 'dialog');
        const ctxInfo = el('span', 'ovse-ctxinfo');
        // The price before it runs (plan §AD.6): a chosen model's typical message, from its own price.
        const ctxCost = el('span', 'ovse-cost'); ctxCost.hidden = true;
        ctxRow.append(ctxB, ctxCost, ctxInfo);
        const composeSlot = el('div', 'ovse-compose');
        foot.append(planBox, slash, ctxRow, composeSlot);
        main.append(head, body, foot);
        wrap.append(drawer, scrim, main);
        host.textContent = ''; host.append(wrap);

        // A computer: the sessions are a column (≥ 900 px of room); a phone: a drawer over the session.
        let lead = null;   // the navbar's slot when the surface sits on a page under the bar (takeLead, below)
        let wide = false;
        let collapsed = false; try { collapsed = localStorage.getItem('ov:session:drawer') === 'closed'; } catch { /* */ }
        const fit = () => {
            const w = wrap.getBoundingClientRect().width || root.innerWidth || 0;
            wide = w >= 900;
            wrap.classList.toggle('is-wide', wide);
            wrap.classList.toggle('is-drawer', wide ? !collapsed : state.drawer);
            const open = wide ? !collapsed : !!state.drawer;
            menuB.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (lead) lead.set({ expanded: open });
        };
        // 4.285.0: where the surface sits decides where its sessions button goes (the owner, 11-16: "move to top left …
        // it does have to be intelligent and aware, so that in this UI [the menu's Vibe] it still has a way to do the
        // button nicely, versus when you're on the site itself"). On a site's page, under the navbar, the button is the
        // navbar's own top-left slot and the row under the bar goes while nothing is open. In the menu, a sheet or a
        // dialog the bar is covered, so the surface keeps its own button. o.navLead: true or false decides it instead.
        const covered = () => !!host.closest('.ovs-panel, .ovs-vibe-body, .openvibe-navbar, dialog, [role="dialog"], [popover], .ovk-sheet, .ovse-sheet');
        function takeLead(n) {
            if (lead || o.navLead === false || !host.isConnected || (o.navLead !== true && covered())) return;
            const N = root.OpenVibeNavbar;
            if (!N || typeof N.lead !== 'function' || !N.getElement || !N.getElement()) { if (n < 40) setTimeout(() => takeLead(n + 1), 125); return; }
            lead = N.lead({ icon: 'sidebar', label: 'Your sessions', controls: drawer.id, expanded: wide ? !collapsed : !!state.drawer, onClick: () => toggleDrawer() });
            wrap.classList.add('has-nav-lead');
        }
        const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
        if (ro) ro.observe(wrap); else root.addEventListener('resize', fit);
        fit();
        function setDrawer(open) {
            if (wide) { collapsed = !open; try { localStorage.setItem('ov:session:drawer', collapsed ? 'closed' : 'open'); } catch { /* */ } }
            else state.drawer = !!open;
            fit();
            if (open) { loadRuns(); if (!wide) setTimeout(() => { try { findIn.focus({ preventScroll: true }); } catch { /* */ } }, 180); }
            else if (!wide) { try { (lead && document.getElementById('ovnav-lead') || menuB).focus({ preventScroll: true }); } catch { /* */ } }
        }
        const toggleDrawer = () => setDrawer(wide ? collapsed : !state.drawer);
        menuB.addEventListener('click', toggleDrawer);
        setTimeout(() => takeLead(0), 0);
        dClose.addEventListener('click', () => setDrawer(false));
        scrim.addEventListener('click', () => setDrawer(false));
        dNew.addEventListener('click', () => { blank(); if (!wide) setDrawer(false); });
        // A swipe: from the left edge opens the drawer, towards the left closes it.
        let touch = null;
        wrap.addEventListener('touchstart', (e) => { const t = e.touches[0]; const r = wrap.getBoundingClientRect(); touch = { x: t.clientX, y: t.clientY, edge: t.clientX - r.left < 22, inDrawer: drawer.contains(e.target) }; }, { passive: true });
        wrap.addEventListener('touchend', (e) => {
            if (!touch || wide) return; const t = e.changedTouches[0]; const dx = t.clientX - touch.x, dy = Math.abs(t.clientY - touch.y);
            if (dy < 50 && touch.edge && dx > 60 && !state.drawer) setDrawer(true);
            else if (dy < 50 && (touch.inDrawer || state.drawer) && dx < -60 && state.drawer) setDrawer(false);
            touch = null;
        }, { passive: true });
        wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.drawer && !wide) { e.stopPropagation(); setDrawer(false); } });

        // ── the sessions list ──
        let findT = 0;
        findIn.addEventListener('input', () => { clearTimeout(findT); findT = setTimeout(() => { state.q = findIn.value.trim(); loadRuns(); }, 250); });
        function face(run, size = 'm') {
            const f = el('span', `ovse-face is-${size}`);
            const a = (run && run.agent) || {};
            const pic = httpsUrl(a.avatar_url);
            if (pic) { const i = el('img'); i.src = pic; i.alt = ''; i.loading = 'lazy'; f.append(i); return f; }
            f.style.setProperty('--ovse-h', String(Number.isFinite(Number(a.hue)) ? Number(a.hue) : hueOf(a.id || a.name || (run && run.kind))));
            f.append(svg(G[a.glyph] ? a.glyph : KIND_GLYPH[run && run.kind] || 'spark'));
            return f;
        }
        // The search suggests the person's own sessions, never what other people searched (the owner, 11-16: "this should
        // be your session search"); with fewer than two it keeps its placeholder.
        need(o, 'ov-trending.js', 'OVTrending').then((T) => { if (T) T.attach(findIn, { items: () => state.hints || [], prefix: '' }); });
        const titleOf = (r) => String((r && (r.title || (r.preview && r.preview.text) || r.preview)) || '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'A session';
        async function loadRuns() {
            const gen = ++state.listGen;
            if (!state.runs.length) { runsBox.textContent = ''; for (let i = 0; i < 5; i++) runsBox.append(el('div', 'ovse-row is-ghost')); }
            try {
                const q = state.q ? `&q=${encodeURIComponent(state.q.slice(0, 120))}` : '';
                const d = await api(`/runs?limit=40${q}`);
                if (gen !== state.listGen) return;
                state.runs = Array.isArray(d.runs) ? d.runs : []; state.partial = Array.isArray(d.partial) ? d.partial : [];
                paintRuns();
                if (!state.q) {
                    state.hints = [...new Set(state.runs.map(titleOf).filter((t) => t && t !== 'A session'))].slice(0, 12);
                    if (state.hints.length < 2) state.hints = [];
                    if (root.OVTrending) root.OVTrending.update(findIn);
                }
                if (o.actions && !state.q) {
                    const more = await actionRows(state.runs);
                    if (gen !== state.listGen || !more.length) return;
                    state.runs = [...more, ...state.runs]; paintRuns();
                }
            } catch (err) {
                if (gen !== state.listGen) return;
                runsBox.textContent = '';
                runsBox.append(el('p', 'ovse-note is-err', err.status === 401 ? 'Sign in to see your sessions.' : 'Your sessions did not load. Pull the list again in a moment.'));
            }
        }
        function paintRuns() {
            runsBox.textContent = '';
            if (!state.runs.length) { runsBox.append(el('p', 'ovse-note', state.q ? 'Nothing matches.' : 'No sessions yet. Start one with the box.')); return; }
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const groups = [['Needs you', []], ['Working', []], ['Today', []], ['Earlier', []]];
            for (const r of state.runs) {
                const g = needsYou(r) ? 0 : isLive(r) ? 1 : ms(r.updated_at || r.created_at) >= today.getTime() ? 2 : 3;
                groups[g][1].push(r);
            }
            let i = 0;
            for (const [name, rows] of groups) {
                if (!rows.length) continue;
                runsBox.append(el('p', 'ovse-group', name));
                for (const r of rows) runsBox.append(runRow(r, i++));
            }
            if (state.partial.length) runsBox.append(el('p', 'ovse-note', `Some sessions did not load: ${state.partial.slice(0, 3).join(', ')}.`));
        }
        /** 4.266.0: the Action Center's work (Network GET /api/v1/me/actions) that no session here already shows. */
        const SERVICE = { actor: 'Actor', codes: 'Codes', ai: 'OpenVibe AI', run: 'OpenVibe Run', bot: 'OpenVibe.Bot', chat: 'Chat', network: 'OpenVibe' };
        async function actionRows(runs) {
            const actionsBase = String(o.actions.base || '').replace(/\/+$/, '');
            if (!actionsBase) return [];
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
                            action: it, ref: `action:${it.service}:${it.id}`, kind: it.kind === 'code_task' ? 'code' : 'task', title: it.title, url: it.href,
                            status: bucket === 'waiting' ? 'waiting' : 'running', updated_at: it.updated_at,
                            waiting: bucket === 'waiting' ? { for: 'approval' } : null,
                            doing: bucket === 'running' ? { text: it.step || it.summary || 'Working' } : null,
                            preview: it.summary ? { text: it.summary } : null,
                            agent: { id: String(it.service), name: it.agent || SERVICE[it.service] || 'OpenVibe', glyph: it.kind === 'code_task' ? 'code' : 'robot' },
                        });
                    }
                }
                return out;
            } catch { return []; }
        }
        /** A row that asks before it goes on is answered from the list: Approve, Not now. */
        function answerRow(r) {
            const it = r.action; const w = r.waiting;
            if (it ? !(needsYou(r) && Array.isArray(it.actions) && it.actions.includes('approve')) : !(needsYou(r) && w.for === 'approval' && w.approval && /^[A-Za-z0-9._~-]{1,160}$/.test(String(w.approval)))) return null;
            const box = el('div', 'ovse-row-acts');
            const say = (text, err) => { box.textContent = ''; box.append(el('p', `ovse-note${err ? ' is-err' : ''}`, text)); };
            [['approve', 'Approve', true], ['decline', 'Not now', false]].forEach(([id, label, primary]) => {
                const b = el('button', primary ? 'ovse-b is-primary' : 'ovse-b', label); b.type = 'button';
                b.setAttribute('aria-label', `${label}: ${titleOf(r)}`);
                b.addEventListener('click', async () => {
                    [...box.querySelectorAll('button')].forEach((x) => { x.disabled = true; });
                    try {
                        if (it) {
                            const res = await fetch(`${String(o.actions.base).replace(/\/+$/, '')}/api/v1/me/actions/${encodeURIComponent(it.service)}/${encodeURIComponent(it.id)}/${id}`, { method: 'POST', credentials: 'omit', headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers() }, body: '{}' });
                            if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.detail || j.error || j.title || `That did not go through (${res.status})`); }
                        } else await api(`/runs/${encodeURIComponent(r.ref || r.id)}/approvals/${encodeURIComponent(w.approval)}`, { method: 'POST', body: JSON.stringify({ answer: id }) });
                        say(id === 'approve' ? 'Approved' : 'Declined');
                        emit('session.approval', { ref: r.ref, answer: id });
                    } catch (err) { [...box.querySelectorAll('button')].forEach((x) => { x.disabled = false; }); box.append(el('p', 'ovse-note is-err', err.message)); }
                });
                box.append(b);
            });
            return box;
        }
        function runRow(r, i) {
            const li = el('div', 'ovse-li'); li.setAttribute('role', 'listitem');
            li.append(runButton(r, i));
            const acts = answerRow(r); if (acts) { li.classList.add('has-acts'); li.append(acts); }
            return li;
        }
        function runButton(r, i) {
            const ref = r.ref || r.id;
            const b = el('button', `ovse-row${ref === state.ref ? ' is-on' : ''}${needsYou(r) ? ' is-needs' : ''}${isLive(r) ? ' is-live' : ''}`); b.type = 'button';
            b.style.setProperty('--i', String(Math.min(i, 12)));
            const t = el('span', 'ovse-row-t');
            const top = el('span', 'ovse-row-top'); top.append(el('b', '', titleOf(r)), el('small', '', ago(r.updated_at || r.created_at)));
            const line = needsYou(r) ? WAITING[r.waiting.for] || 'Needs you' : (r.doing && r.doing.text) || (r.preview && r.preview.text) || r.preview || r.result_summary || (STATUS[r.status] || [''])[0];
            t.append(top, el('small', 'ovse-row-l', String(line || '').slice(0, 140)));
            b.append(face(r, 's'), t);
            if (isLive(r)) b.append(el('i', 'ovse-pulse'));
            // Work from the Action Center opens on its own page; a session opens here.
            if (r.action) { b.addEventListener('click', () => { const url = httpsUrl(r.url); if (url) root.open(url, '_blank', 'noopener'); }); return b; }
            b.addEventListener('click', () => { state.stack = []; open(ref, r); if (!wide) setDrawer(false); });
            return b;
        }

        // ── your Actor (4.266.0): its face, what it is doing, today's spend, Pause or Resume ──
        let actor = null, actorAt = 0;
        const actorName = () => { const n = String((actor && actor.name) || '').trim(); return (!n || /^(my actor|vibe)$/i.test(n) ? 'Actor' : n).slice(0, 40); };
        const actorState = () => { const a = actor; if (!a) return 'resting'; if (a.status === 'paused' || a.enabled === false) return 'paused'; if (Array.isArray(a.asks) && a.asks.length) return 'asks'; return a.status === 'working' ? 'working' : 'resting'; };
        async function loadActor() {
            if (!o.actor || !tokenOf()) return null;
            if (actorAt && Date.now() - actorAt < 20000) return actor;
            try { const r = await fetch(`${base}/actor`, { credentials: 'omit', headers: { Accept: 'application/json', ...headers() } }); actor = r.ok ? await r.json() : null; } catch { actor = null; }
            actorAt = Date.now();
            return actor;
        }
        function actorFace(size) {
            const f = el('span', `ovse-face is-${size} ovse-me-face is-${actorState()}`);
            const pic = actor && actor.avatar && httpsUrl(actor.avatar.url);
            if (pic) { const i = el('img'); i.src = pic; i.alt = ''; f.append(i); return f; }
            const hue = actor && actor.avatar && actor.avatar.blob && Number.isInteger(actor.avatar.blob.hue) ? actor.avatar.blob.hue : hueOf(actorName());
            f.style.setProperty('--ovse-h', String(hue));
            f.append(el('b', 'ovse-face-l', actorName().charAt(0).toUpperCase()));
            return f;
        }
        const ACTOR_WORD = { working: 'Working', asks: 'Asks you something', resting: 'Ready', paused: 'Paused' };
        function paintActor() {
            actorSlot.textContent = '';
            if (!o.actor || !actor) { actorSlot.hidden = true; return; }
            actorSlot.hidden = false;
            const st = actorState();
            const now = actor.now || {};
            const cap = actor.caps && Number(actor.caps.usd) > 0 ? ` of $${Number(actor.caps.usd).toFixed(2)}` : '';
            const step = st === 'working' ? String(now.current_step || '').slice(0, 100) : st === 'asks' ? String((actor.asks[0] && actor.asks[0].text) || '').slice(0, 100) : '';
            const who = el('button', `ovse-actor-who is-${st}`); who.type = 'button';
            who.setAttribute('aria-label', `${actorName()}, your agent: ${ACTOR_WORD[st]}. Start a session with it`);
            const t = el('span', 'ovse-actor-t');
            const top = el('span', 'ovse-actor-top'); top.append(el('b', '', actorName()), el('i', '', 'your agent'));
            t.append(top, el('small', '', [ACTOR_WORD[st], step, `$${(Number(now.cost_today) || 0).toFixed(2)}${cap} today`].filter(Boolean).join(' · ')));
            who.append(actorFace('m'), t);
            who.addEventListener('click', () => { pick.agent = 'actor'; savePick(); blank(); if (!wide) setDrawer(false); });
            actorSlot.append(who);
            if (actor.id) {
                const paused = st === 'paused';
                const go = btn(`ovse-ib ovse-actor-go${paused ? ' is-main' : ''}`, paused ? `Resume ${actorName()}` : `Pause ${actorName()}`, paused ? 'play' : 'pause');
                go.addEventListener('click', async () => {
                    go.disabled = true;
                    try { const r = await fetch(`${base}/actor/${paused ? 'resume' : 'pause'}`, { method: 'POST', credentials: 'omit', headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers() }, body: '{}' }); if (r.ok) { actorAt = 0; await loadActor(); } } catch { /* it stays as it was */ }
                    paintActor();
                });
                actorSlot.append(go);
            }
        }
        if (typeof o.top === 'function') {
            try {
                const t = o.top(topSlot);
                if (t) {
                    state.topMount = t;
                    // Shown only while what was lent shows something (a timer, an agent at work): an empty lent panel kept
                    // its padding and left a blank band between your agent and the search (11-15, the owner's phone).
                    const fit = () => { topSlot.hidden = !(topSlot.textContent.trim() || topSlot.querySelector('img,video,canvas,iframe,svg')); };
                    fit();
                    if (typeof root.MutationObserver === 'function') new root.MutationObserver(fit).observe(topSlot, { childList: true, subtree: true, characterData: true });
                }
            } catch { /* the host's */ }
        }

        // ── the head ──
        function paintHead() {
            const r = state.run;
            faceSlot.textContent = '';
            if (!r) {
                titleN.textContent = o.title || 'New session'; statN.textContent = ''; statN.className = 'ovse-stat';
                changesB.hidden = true; return;
            }
            faceSlot.append(face(r, 's'));
            titleN.textContent = titleOf(r);
            const [word, tone] = STATUS[r.status] || ['', 'off'];
            statN.className = `ovse-stat is-${tone}`;
            statN.textContent = '';
            statN.append(el('i', 'ovse-dot'));
            const bits = [needsYou(r) ? WAITING[r.waiting.for] || word : word];
            const startT = ms(r.started_at || r.created_at), endT = ms(r.ended_at) || (isEnd(r) ? ms(r.updated_at) : 0);
            if (startT && (isLive(r) || endT)) bits.push(clock(((endT || Date.now()) - startT) / 1000));
            const c = spent(r.cost); if (c) bits.push(c);
            statN.append(el('span', '', bits.filter(Boolean).join(' · ')));
            const n = changed().length;
            changesB.hidden = !n; if (n) { changesB.querySelector('b').textContent = String(n); changesB.querySelector('span').textContent = ` file${n === 1 ? '' : 's'}`; changesB.setAttribute('aria-label', `What it changed: ${n} file${n === 1 ? '' : 's'}`); }
            backB.hidden = !state.stack.length; menuB.hidden = !!state.stack.length;
            clearInterval(state.tick); state.tick = null;
            if (isLive(r)) state.tick = setInterval(() => { if (!wrap.isConnected) { clearInterval(state.tick); return; } if (document.visibilityState !== 'hidden') paintHead(); }, 1000);
        }
        backB.addEventListener('click', () => { const up = state.stack.pop(); if (up) open(up, null, { up: true }); });
        moreB.addEventListener('click', async () => {
            const r = state.run;
            const rows = [];
            if (r && (isLive(r) || r.status === 'waiting')) rows.push({ id: 'stop', name: 'Stop it', line: 'It stops after the step it is on', icon: 'stop' });
            if (r && httpsUrl(r.url)) { rows.push({ id: 'copy', name: 'Copy the link', line: 'Its own page, for you or anyone you share it with', icon: 'link' }); rows.push({ id: 'page', name: 'Open its own page', line: new URL(httpsUrl(r.url)).hostname, icon: 'open' }); }
            if (r && changed().length) rows.push({ id: 'changes', name: 'What it changed', line: `${changed().length} file(s)`, icon: 'file' });
            // Rename (plan §AD.8): Actor's conversations and coding runs; the name is edited in place in the header.
            if (r && /^(actor|codes):/.test(String(state.ref || ''))) rows.push({ id: 'rename', name: 'Rename', line: 'Give this session a name of your own', icon: 'edit' });
            // A coding run's replay (Codes' /r/<token>, plan §AD.8): anyone with the link reads it, no sign-in.
            if (r && /^codes:/.test(String(state.ref || ''))) {
                rows.push(state.replay
                    ? { id: 'unshare', name: 'Stop sharing the replay', line: 'The link stops working; sharing again makes a new one', icon: 'link' }
                    : { id: 'share', name: 'Share a replay', line: 'A link anyone can read, step by step, without signing in', icon: 'link' });
            }
            rows.push({ id: 'new', name: 'New session', line: 'Start over with an empty box', icon: 'plus' });
            rows.push({ id: 'sessions', name: 'All your sessions', line: 'Search them, pick one up again', icon: 'chat' });
            const P = await need(o, 'ov-picker.js', 'OpenVibePicker');
            const act = (id) => {
                if (id === 'stop') stop();
                else if (id === 'copy') { const url = httpsUrl(r.url); try { navigator.clipboard.writeText(url).then(() => flash('Link copied'), () => flash(url)); } catch { flash(url); } }
                else if (id === 'page') root.open(httpsUrl(r.url), '_blank', 'noopener');
                else if (id === 'changes') openChanges();
                else if (id === 'share') shareReplay();
                else if (id === 'rename') renameInPlace();
                else if (id === 'unshare') stopReplay();
                else if (id === 'new') blank();
                else if (id === 'sessions') setDrawer(true);
            };
            if (P) P.open({ anchor: moreB, title: r ? titleOf(r) : 'This session', rows: rows.map((x) => ({ id: x.id, name: x.name, line: x.line, svg: svgMarkup(x.icon) })), search: false, onPick: (row) => act(row.id) });
            else miniMenu(moreB, rows, act);
        });
        changesB.addEventListener('click', () => openChanges());
        /** Without the picker: a plain list under the button. */
        function miniMenu(anchor, rows, act) {
            const m = el('div', 'ovse-mini'); m.setAttribute('role', 'menu');
            rows.forEach((x) => { const b = btn('ovse-mini-b', null, x.icon, x.name); b.setAttribute('role', 'menuitem'); b.addEventListener('click', () => { m.remove(); act(x.id); }); m.append(b); });
            const off = (e) => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('pointerdown', off, true); } };
            document.addEventListener('pointerdown', off, true);
            const r = anchor.getBoundingClientRect(); m.style.top = `${Math.round(r.bottom + 6)}px`; m.style.right = `${Math.max(8, Math.round(root.innerWidth - r.right))}px`;
            document.body.append(m); const first = m.querySelector('button'); if (first) first.focus();
        }
        function flash(words) {
            const t = el('div', 'ovse-flash', words); t.setAttribute('role', 'status');
            main.append(t); setTimeout(() => t.classList.add('is-out'), 1800); setTimeout(() => t.remove(), 2300);
        }

        // ── the thread: steps become blocks (words, a group of tool rows, the files it changed, approvals, helpers) ──
        const ordered = () => [...state.steps.values()].sort((a, b) => a.seq - b.seq);
        function changed() {
            const by = new Map();
            for (const s of ordered()) for (const f of filesOf(s)) {
                const was = by.get(f.path) || { path: f.path, adds: 0, dels: 0, parts: [] };
                was.adds += f.adds; was.dels += f.dels; was.parts.push(f.lines); by.set(f.path, was);
            }
            return [...by.values()];
        }
        function latestPlan() { let p = null; for (const s of ordered()) { const x = planOf(s); if (x) p = x; } return p; }
        function schedule() { if (state.paint) return; state.paint = requestAnimationFrame(() => { state.paint = 0; paint(); }); }
        function paint() {
            const nearEnd = body.scrollHeight - body.scrollTop - body.clientHeight < 200;
            // What was open stays open.
            thread.querySelectorAll('details[data-key]').forEach((d) => { if (d.open) state.open.add(d.dataset.key); else state.open.delete(d.dataset.key); });
            const frag = document.createDocumentFragment();
            let acts = null, actFiles = [], thinks = null;
            // 4.286.0: thoughts in a row are one compact line of connected dots (one per thought) that opens in place.
            const closeThinks = () => {
                if (!thinks) return;
                frag.append(thinks.steps.length === 1 ? stepNode(thinks.steps[0]) : thinkingNode(thinks.steps));
                thinks = null;
            };
            const closeActs = () => {
                if (!acts) return;
                // Edits alone are the files card: its rows open each diff.
                const onlyEdits = actFiles.length && acts.steps.every((x) => toolKind(x) === 'edit' && x.status !== 'running' && filesOf(x).length);
                if (!onlyEdits) { paintActs(acts.node, acts.steps); frag.append(acts.node); }
                if (actFiles.length) frag.append(filesCard(actFiles));
                acts = null; actFiles = [];
            };
            for (const s of ordered()) {
                const plan = planOf(s);
                if (plan) { closeActs(); closeThinks(); continue; }
                if (s.kind === 'think') {
                    closeActs();
                    if (!thinks) thinks = { steps: [] };
                    thinks.steps.push(s);
                    continue;
                }
                closeThinks();
                const isTool = s.kind === 'tool' || (s.kind === 'file' && s.from !== 'person');
                if (isTool) {
                    if (!acts) acts = { node: actsNode(s.seq), steps: [] };
                    acts.steps.push(s);
                    for (const f of filesOf(s)) actFiles.push(f);
                    continue;
                }
                closeActs();
                const n = stepNode(s);
                if (n) frag.append(n);
            }
            closeActs();
            closeThinks();
            const r = state.run;
            if (r && r.status === 'waiting' && r.waiting && ['takeover', 'payment'].includes(r.waiting.for)) frag.append(needCard(r));
            if (r && Array.isArray(r.outputs) && r.outputs.length) frag.append(outputsCard(r.outputs));
            const lastStep = ordered().slice(-1)[0];
            const writing = lastStep && lastStep.status === 'running' && lastStep.kind === 'message';
            if ((isLive(r) || state.pending) && !writing) frag.append(working(r));
            for (const q of state.queue) frag.append(q.node);
            thread.textContent = ''; thread.append(frag);
            thread.querySelectorAll('details[data-key]').forEach((d) => { if (state.open.has(d.dataset.key)) d.open = true; });
            paintPlan();
            paintHead();
            if (nearEnd) requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
        }
        /** Several thoughts in a row: "Thought 4 times · 12 s", a dot per thought joined by a line (the live one pulses),
         *  and opened, each thought beside its dot, the line running through them. */
        function thinkingNode(steps) {
            const d = el('details', 'ovse-think ovse-thinks'); d.dataset.key = `thinks:${steps[0].seq}`;
            const running = steps.some((x) => x.status === 'running');
            const first = ms(steps[0].started_at), last = ms(steps[steps.length - 1].ended_at) || ms(steps[steps.length - 1].started_at);
            const took = first && last ? Math.round((last - first) / 1000) : 0;
            const sm = el('summary');
            const dots = el('span', 'ovse-dots'); dots.setAttribute('aria-hidden', 'true');
            steps.slice(0, 12).forEach((x, i) => { const dot = el('i'); if (x.status === 'running') dot.className = 'is-now'; dot.style.setProperty('--i', String(i)); dots.append(dot); });
            const said = running ? 'Thinking' : `Thought ${steps.length} times${took >= 1 ? ` · ${took < 60 ? `${took} s` : clock(took)}` : ''}`;
            sm.append(svg('think'), el('span', '', said), dots, svg('fold', 'ovse-fold'));
            d.append(sm);
            const list = el('ol', 'ovse-thinks-list');
            steps.forEach((x) => {
                const li = el('li', x.status === 'running' ? 'is-now' : '');
                li.append(words(String(x.text || x.title || '').slice(0, 4000) || 'Thinking'));
                list.append(li);
            });
            d.append(list);
            if (running) d.classList.add('is-running');
            return d;
        }
        function actsNode(seq) {
            const d = el('details', 'ovse-acts'); d.dataset.key = `acts:${seq}`;
            return d;
        }
        function paintActs(d, steps) {
            const sm = el('summary', 'ovse-acts-h');
            const count = new Map();
            for (const s of steps) { const k = toolKind(s); if (k === 'plan') continue; count.set(k, (count.get(k) || 0) + 1); }
            const running = steps.find((s) => s.status === 'running');
            const failed = steps.filter((s) => s.status === 'failed').length;
            const icons = el('span', 'ovse-acts-ic');
            [...count.keys()].slice(0, 5).forEach((k) => icons.append(svg(TOOL_WORDS[k][1])));
            const said = [...count.entries()].map(([k, n]) => { const w = TOOL_WORDS[k]; return k === 'search' ? `${w[0]} ${n === 1 ? 'once' : `${n} times`}` : `${w[0]} ${n} ${n === 1 ? w[2] : w[3]}`; });
            const text = said.length ? said.join(', ') : 'Worked';
            const words0 = el('span', 'ovse-acts-w', text.charAt(0).toUpperCase() + text.slice(1));
            sm.append(icons, words0);
            if (running) { sm.append(el('small', 'ovse-acts-now', count.size === 1 ? toolWhat(running) || toolLine(running) : toolLine(running))); d.classList.add('is-running'); }
            else if (failed) sm.append(el('small', 'ovse-acts-bad', `${failed} did not work`));
            sm.append(svg('fold', 'ovse-fold'));
            const list = el('div', 'ovse-acts-list');
            steps.forEach((s) => list.append(toolRow(s)));
            d.append(sm, list);
        }
        function toolRow(s) {
            const out = s.text || (s.result != null ? (typeof s.result === 'string' ? s.result : (() => { try { return JSON.stringify(s.result, null, 2); } catch { return ''; } })()) : '');
            const n = el(out ? 'details' : 'div', `ovse-tool${s.status === 'running' ? ' is-running' : s.status === 'failed' ? ' is-failed' : ''}`);
            if (out) n.dataset.key = `tool:${s.seq}`;
            const line = el(out ? 'summary' : 'div', 'ovse-tool-h');
            line.append(svg(TOOL_WORDS[toolKind(s)] ? TOOL_WORDS[toolKind(s)][1] : 'tool'), el('span', '', toolLine(s)));
            const took = ms(s.ended_at) && ms(s.started_at) ? (ms(s.ended_at) - ms(s.started_at)) / 1000 : 0;
            if (s.status === 'running') line.append(el('i', 'ovse-pulse'));
            else if (took >= 1) line.append(el('small', '', took < 60 ? `${Math.round(took)} s` : clock(took)));
            if (s.status === 'failed') line.append(svg('x', 'ovse-bad'));
            n.append(line);
            if (out) { const pre = el('pre', 'ovse-out'); pre.append(el('code', '', String(out).slice(0, 6000))); n.append(pre); }
            return n;
        }
        function filesCard(files) {
            const by = new Map();
            files.forEach((f) => { const w = by.get(f.path) || { path: f.path, adds: 0, dels: 0, parts: [] }; w.adds += f.adds; w.dels += f.dels; w.parts.push(f.lines); by.set(f.path, w); });
            const list = [...by.values()];
            const c = el('div', 'ovse-files');
            const h = el('div', 'ovse-files-h'); h.append(svg('edit'), el('b', '', `Changed ${list.length} file${list.length === 1 ? '' : 's'}`));
            const sum = list.reduce((a, f) => [a[0] + f.adds, a[1] + f.dels], [0, 0]);
            h.append(stat(sum[0], sum[1]));
            c.append(h);
            list.slice(0, 8).forEach((f) => c.append(fileRow(f)));
            if (list.length > 8) { const more = btn('ovse-files-more', null, null, `${list.length - 8} more`); more.addEventListener('click', () => openChanges()); c.append(more); }
            return c;
        }
        const stat = (a, d) => { const s = el('span', 'ovse-stat2'); if (a) s.append(el('i', 'is-add', `+${a}`)); if (d) s.append(el('i', 'is-del', `−${d}`)); return s; };
        function fileRow(f) {
            const b = el('button', 'ovse-file'); b.type = 'button';
            const parts = f.path.split('/'); const name = parts.pop();
            const t = el('span', 'ovse-file-t'); t.append(el('b', '', name), el('small', '', parts.join('/')));
            b.append(svg('file'), t, stat(f.adds, f.dels));
            b.addEventListener('click', () => openDiff(f));
            return b;
        }
        function stepNode(s) {
            const from = s.from || 'agent';
            if (s.kind === 'message' && from === 'person') {
                const n = el('div', 'ovse-me'); const b = el('div', 'ovse-bubble'); b.append(words(s.text)); n.append(b); attachments(n, s);
                return n;
            }
            if (from === 'system' && s.kind === 'message') {
                const compact = (s.ui && s.ui.type === 'compaction') || /summari[sz]ed|compact/i.test(String(s.text || ''));
                const n = el('div', compact ? 'ovse-mark' : 'ovse-sys');
                if (compact) n.append(el('span', '', 'Earlier turns were summarized to leave room'));
                else n.append(el('span', '', String(s.text || '').slice(0, 400)));
                return n;
            }
            if (s.kind === 'think') {
                const d = el('details', 'ovse-think'); d.dataset.key = `think:${s.seq}`;
                const took = ms(s.ended_at) && ms(s.started_at) ? Math.round((ms(s.ended_at) - ms(s.started_at)) / 1000) : 0;
                const sm = el('summary'); sm.append(svg('think'), el('span', '', s.status === 'running' ? 'Thinking' : took >= 1 ? `Thought for ${took < 60 ? `${took} s` : clock(took)}` : (s.title || 'Thought')), svg('fold', 'ovse-fold'));
                d.append(sm); if (s.text) d.append(words(s.text));
                if (s.status === 'running') d.classList.add('is-running');
                return d;
            }
            if (s.kind === 'approval') return approvalNode(s);
            if (s.kind === 'child') {
                const b = el('button', `ovse-child${s.status === 'running' ? ' is-running' : ''}`); b.type = 'button';
                const t = el('span'); t.append(el('b', '', s.title || 'A helper took part of the work'), el('small', '', s.text ? String(s.text).slice(0, 140) : (s.status === 'running' ? 'Working' : 'Open it to see what it did')));
                b.append(svg('child'), t, svg('open'));
                if (s.child_run) b.addEventListener('click', () => { if (state.ref) state.stack.push(state.ref); open(s.child_run); });
                else b.disabled = true;
                return b;
            }
            // the agent's words (and anything else with words)
            if (!s.text && !(s.ui && s.ui.type) && !(Array.isArray(s.attachments) && s.attachments.length)) return null;
            const n = el('div', `ovse-say${s.status === 'running' ? ' is-writing' : ''}`);
            n.dataset.seq = String(s.seq);
            if (s.author && s.author.name) n.append(el('small', 'ovse-author', s.author.name));
            if (s.text) n.append(words(s.text, s.sources));
            if (s.ui && s.ui.type) { const render = cardRender(s.ui.type); if (render) { try { const c = render(s.ui.data || {}, s, { open }); if (c) { c.classList && c.classList.add('ovse-card'); n.append(c); } } catch { /* the words say it */ } } }
            if (Array.isArray(s.sources) && s.sources.length) {
                const src = el('div', 'ovse-sources');
                s.sources.slice(0, 12).forEach((x) => { const url = httpsUrl(x.url); if (!url) return; const a = el('a', 'ovse-source'); a.href = url; a.target = '_blank'; a.rel = 'nofollow noopener noreferrer'; a.append(el('i', '', String(x.n || '')), el('span', '', x.title || x.site || new URL(url).hostname)); src.append(a); });
                n.append(src);
            }
            attachments(n, s);
            return n;
        }
        function attachments(n, s) {
            const list = Array.isArray(s.attachments) ? s.attachments : []; if (!list.length) return;
            const row = el('div', 'ovse-attach');
            list.slice(0, 8).forEach((a) => {
                const url = httpsUrl(a.url);
                if ((a.kind === 'image' || /^image\//.test(String(a.type || a.mime || ''))) && url) { const i = el('img', 'ovse-thumb'); i.src = url; i.alt = a.alt || a.name || ''; i.loading = 'lazy'; row.append(i); }
                else { const c = el(url ? 'a' : 'span', 'ovse-chip'); if (url) { c.href = url; c.target = '_blank'; c.rel = 'noopener'; } c.append(svg('file'), el('span', '', a.name || a.kind || 'A file')); row.append(c); }
            });
            n.append(row);
        }
        function approvalNode(s) {
            const n = el('div', 'ovse-ask');
            const h = el('div', 'ovse-ask-h'); h.append(svg('check'), el('b', '', s.title || 'It asks before it goes on'));
            n.append(h); if (s.text) n.append(words(s.text));
            const r = s.result && typeof s.result === 'object' ? s.result : {};
            if (r.answer) { n.classList.add('is-done'); n.append(el('p', 'ovse-note', `You answered: ${r.answer_label || r.answer}`)); return n; }
            const opts = Array.isArray(r.options) && r.options.length ? r.options : [{ id: 'approve', label: 'Go ahead' }, { id: 'decline', label: 'Not now' }];
            const row = el('div', 'ovse-ask-acts');
            opts.slice(0, 4).forEach((op, i) => {
                const b = el('button', i === 0 ? 'ovse-b is-primary' : 'ovse-b', op.label || op.id); b.type = 'button';
                b.addEventListener('click', async () => {
                    [...row.children].forEach((x) => { x.disabled = true; });
                    try {
                        await api(`/runs/${encodeURIComponent(state.ref)}/approvals/${encodeURIComponent(r.approval || r.id || String(s.seq))}`, { method: 'POST', body: JSON.stringify({ answer: op.id }) });
                        state.steps.set(s.seq, { ...s, result: { ...r, answer: op.id, answer_label: op.label } });
                        emit('session.approval', { ref: state.ref, step: s.seq, answer: op.id });
                        schedule();
                    } catch (err) { [...row.children].forEach((x) => { x.disabled = false; }); n.append(el('p', 'ovse-note is-err', err.message)); }
                });
                row.append(b);
            });
            n.append(row);
            return n;
        }
        function needCard(r) {
            const c = el('div', 'ovse-ask is-need');
            const h = el('div', 'ovse-ask-h'); h.append(svg('computer'), el('b', '', WAITING[r.waiting.for] || 'It needs you'));
            c.append(h);
            const url = httpsUrl(r.url);
            if (url) { const a = el('a', 'ovse-b is-primary', 'Open it'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; c.append(a); }
            return c;
        }
        function outputsCard(list) {
            const c = el('div', 'ovse-made');
            const h = el('div', 'ovse-files-h'); h.append(svg('made'), el('b', '', 'What it made')); c.append(h);
            list.slice(0, 12).forEach((x) => {
                const url = httpsUrl(x.url);
                const row = el(url ? 'a' : 'div', 'ovse-file');
                if (url) { row.href = url; row.target = '_blank'; row.rel = 'noopener'; }
                const g = /pr|pull/.test(String(x.kind)) ? 'pr' : /space|site|page/.test(String(x.kind)) ? 'globe' : /repo/.test(String(x.kind)) ? 'repo' : 'file';
                const t = el('span', 'ovse-file-t'); t.append(el('b', '', x.title || x.name || x.kind || 'A result'), el('small', '', url ? new URL(url).hostname + new URL(url).pathname.replace(/\/$/, '') : String(x.kind || '')));
                row.append(svg(g), t); if (url) row.append(svg('open'));
                c.append(row);
            });
            return c;
        }
        function working(r) {
            const w = el('div', 'ovse-working'); w.setAttribute('role', 'status');
            const mark = el('span', 'ov-mark ovse-mk'); mark.dataset.size = '20'; mark.dataset.state = 'busy';
            if (root.OVMark && typeof root.OVMark.mount === 'function') { try { root.OVMark.mount(mark); } catch { /* the dots below say it */ } }
            else { mark.className = 'ovse-dots'; mark.append(el('i'), el('i'), el('i')); }
            const doing = (r && r.doing && r.doing.text) || (r && r.status === 'planning' ? 'Starting' : 'Working');
            w.append(mark, el('span', '', String(doing).slice(0, 140)));
            return w;
        }

        // ── the plan, above the box ──
        function paintPlan() {
            const p = latestPlan();
            planBox.hidden = !p; if (!p) return;
            const was = planBox.open;
            planBox.textContent = '';
            const done = p.filter((x) => x.state === 'done').length;
            const now = p.find((x) => x.state === 'doing') || p.find((x) => x.state === 'todo');
            const sm = el('summary', 'ovse-plan-h');
            const ring = el('span', 'ovse-ring'); ring.style.setProperty('--p', String(p.length ? done / p.length : 0));
            sm.append(ring, el('b', '', `Plan · ${done} of ${p.length}`), el('span', 'ovse-plan-now', done === p.length ? 'All done' : now ? now.text : ''), svg('fold', 'ovse-fold'));
            const ol = el('ol', 'ovse-plan-list');
            p.forEach((x) => { const li = el('li', `is-${x.state}`); const box = el('span', 'ovse-tick'); if (x.state === 'done') box.append(svg('check')); li.append(box, el('span', '', x.text)); ol.append(li); });
            planBox.append(sm, ol);
            planBox.open = was;
        }

        // ── sheets: the changes and a diff ──
        function sheet(title, fill) {
            const veil = el('div', 'ovse-veil');
            const s = el('div', 'ovse-sheet'); s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true'); s.setAttribute('aria-label', title);
            const h = el('div', 'ovse-sheet-h'); const close = btn('ovse-ib', 'Close', 'x'); const t = el('b', '', title);
            h.append(t, close);
            const b = el('div', 'ovse-sheet-b');
            s.append(h, b);
            const was = document.activeElement;
            const end = () => { s.classList.remove('is-in'); veil.classList.remove('is-in'); setTimeout(() => { s.remove(); veil.remove(); }, 220); document.removeEventListener('keydown', key, true); try { if (was && was.focus) was.focus({ preventScroll: true }); } catch { /* */ } };
            const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); end(); } };
            close.addEventListener('click', end); veil.addEventListener('click', end);
            document.addEventListener('keydown', key, true);
            document.body.append(veil, s);
            fill(b, { end, title: t, head: h });
            requestAnimationFrame(() => { s.classList.add('is-in'); veil.classList.add('is-in'); close.focus({ preventScroll: true }); });
            return { end, body: b };
        }
        function openChanges() {
            const list = changed();
            sheet(`What it changed · ${list.length} file${list.length === 1 ? '' : 's'}`, (b) => {
                const sum = list.reduce((a, f) => [a[0] + f.adds, a[1] + f.dels], [0, 0]);
                const top = el('div', 'ovse-files-h'); top.append(svg('edit'), el('b', '', 'Every file'), stat(sum[0], sum[1])); b.append(top);
                list.forEach((f) => b.append(fileRow(f)));
            });
        }
        function openDiff(f) {
            const parts0 = f.path.split('/'); const name = parts0.pop();
            sheet(name, (b) => {
                const top = el('div', 'ovse-files-h'); top.append(svg('file'), el('b', 'is-dim', parts0.join('/') || 'The top folder'), stat(f.adds, f.dels)); b.append(top);
                const pre = el('div', 'ovse-diff'); pre.setAttribute('role', 'table'); pre.setAttribute('aria-label', `Changes to ${f.path}`);
                const parts = f.parts || [f.lines];
                parts.forEach((lines, i) => {
                    if (i) pre.append(el('div', 'ovse-dl is-hunk', '…'));
                    (lines || []).slice(0, 800).forEach(([sign, text]) => { const l = el('div', `ovse-dl${sign === '+' ? ' is-add' : sign === '-' ? ' is-del' : sign === '@' ? ' is-hunk' : ''}`); l.setAttribute('role', 'row'); l.append(el('i', '', sign === '@' ? '' : sign), el('span', '', text)); pre.append(l); });
                });
                if (!parts.some((l) => l && l.length)) pre.append(el('p', 'ovse-note', 'It changed this file; the change itself was not sent.'));
                b.append(pre);
            });
        }

        // ── the context chip: Agent · Model · Runs on · Works on, one picker ──
        const placeKey = (pl) => (pl.kind === 'auto' ? 'auto' : pl.id ? `${pl.kind}:${pl.id}` : pl.kind);
        const coding = (opts) => { const a = (opts.agents || []).find((x) => x.id === pick.agent); return pick.agent === 'codes' || !!(a && (a.kind === 'harness' || a.kind === 'codes')); };
        function ctxParts() {
            const opts = options || fallbackOptions;
            const a = (opts.agents || []).find((x) => x.id === pick.agent) || { name: pick.agent === 'auto' ? 'Auto' : pick.agent };
            const w = (opts.places || []).find((x) => placeKey(x) === pick.where) || { name: 'Auto' };
            const m = pick.model && pick.model.name ? pick.model.name : 'Auto';
            const works = Array.isArray(o.works) ? o.works.find((x) => String(x.value) === String(pick.works)) : null;
            const way = WAYS.find((x) => x.id === pick.way) || WAYS[0];
            const eff = EFFORTS.find((x) => x.id === pick.effort) || EFFORTS[0];
            const allowed = PERMISSIONS.find((x) => x.id === pick.permission) || null;
            return { agent: a.name, model: m, where: w.name, works: works ? works.name : '', way: way.id === 'auto' ? '' : way.name,
                effort: eff.id === 'auto' ? '' : `${eff.name} effort`, permission: allowed ? allowed.name : '' };
        }
        function paintCtx() {
            const r = state.run;
            if (r) {
                // An open session says how it runs; the chip's choice is for the next new one.
                const bits = [r.agent && (r.agent.name || r.agent.harness), r.model && (r.model.name || r.model.id), r.where && (r.where.name || ({ openvibe: 'OpenVibe', machine: 'your computer', runner: 'a runner', 'this-computer': 'this computer' })[r.where.kind || r.where]), r.target && r.target.repo ? String(r.target.repo).replace(/^https:\/\/github\.com\//, '') : ''].filter(Boolean);
                ctxB.hidden = true; ctxCost.hidden = true; ctxInfo.hidden = !bits.length; ctxInfo.textContent = bits.join(' · ');
                return;
            }
            ctxB.hidden = false; ctxInfo.hidden = true;
            const p = ctxParts();
            const said = [p.agent === 'Auto' ? 'Any agent' : p.agent, p.way, p.model === 'Auto' ? '' : p.model, p.effort, p.where === 'Auto' ? '' : p.where, p.works].filter(Boolean);
            ctxB.querySelector('span').textContent = said.join(' · ');
            ctxB.setAttribute('aria-label', `How it runs: ${said.join(', ')}. Change it`);
            ctxB.classList.toggle('is-on', pick.agent !== 'auto' || !!pick.model || pick.where !== 'auto' || !!pick.works || (pick.way && pick.way !== 'auto') || (pick.effort && pick.effort !== 'auto') || !!pick.permission);
            paintCost();
        }
        /**
         * What a message costs on the chosen model, before it is sent: Exchange's estimate of a typical turn (2,000 tokens
         * in, 800 out) at the model's own price. Auto says nothing: the router picks within the person's budget. An open
         * session's turns say what they really cost (spent()).
         */
        function paintCost() {
            const m = !state.run && pick.model;
            const cost = m && m.price && Number.isFinite(Number(m.price.in)) && Number.isFinite(Number(m.price.out))
                ? (2000 * Number(m.price.in) + 800 * Number(m.price.out)) / 1e6 : null;
            if (!m || (!m.free && cost == null)) { ctxCost.hidden = true; return; }
            ctxCost.hidden = false;
            ctxCost.textContent = m.free || cost === 0 ? 'Free' : `≈ ${costWords(cost)} a message`;
            ctxCost.title = m.free || cost === 0 ? `${m.name || m.id} is free to use.`
                : `${m.name || m.id}: $${m.price.in} per million tokens in, $${m.price.out} out. A typical message is about 2,000 tokens in and 800 out; long work takes more, and your free allowance comes first.`;
        }
        ctxB.append(el('span'));
        async function openCtx(section) {
            const P = await need(o, 'ov-picker.js', 'OpenVibePicker');
            if (!P) { flash('The choices did not load. Try again in a moment.'); return; }
            const opts = await loadOptions();
            const p = ctxParts();
            const then = (fn) => setTimeout(fn, 230);   // after the last picker has gone
            if (!section) {
                const rows = [
                    // 4.284.0 (the owner, 11-16: "labeling this as a harness, not agent … which harness is powering your
                    // agent … your actor … your codes"): the row names what powers the work.
                    { id: 'agent', name: 'Harness', line: p.agent === 'Auto' ? 'Auto: the right one for what you ask' : p.agent, glyph: 'robot' },
                    { id: 'model', name: 'Model', line: p.model === 'Auto' ? 'Auto: the best fit, within your budget' : p.model, glyph: 'model' },
                    ...(coding(opts) ? [] : [{ id: 'way', name: 'Way', line: p.way || 'Auto: Actor\'s agent, or what fits the question', glyph: 'spark' }]),
                    { id: 'where', name: 'Runs on', line: p.where === 'Auto' ? (coding(opts) ? 'Auto: a shared node or your own computer' : 'Auto: wherever it fits best') : p.where, glyph: 'computer' },
                    // 4.286.0: how long it thinks, on every harness; what it may do, for coding.
                    { id: 'effort', name: 'Effort', line: p.effort || 'Auto: the harness decides how long to think', glyph: 'think' },
                    ...(coding(opts) ? [{ id: 'permission', name: 'Allowed to', line: p.permission || 'Edit files: asks before running commands', glyph: 'key' }] : []),
                ];
                if (Array.isArray(o.works) && o.works.length) rows.push({ id: 'works', name: 'Works on', line: p.works || 'Anything: it works out what you mean', glyph: 'repo' });
                rows.push({ id: 'setup', name: 'Your own setup', line: 'Your computer, coding agents and keys, instead of OpenVibe\'s', glyph: 'key' });
                P.open({ anchor: ctxB, title: 'How it runs', rows: rows.map((x) => ({ id: x.id, name: x.name, line: x.line, svg: svgMarkup(x.glyph) })), search: false, onPick: (row) => then(() => openCtx(row.id)) });
                return;
            }
            if (section === 'setup') {
                P.open({ anchor: ctxB, title: 'Your own setup', search: false, rows: setupOf(opts).map((x) => ({ id: x.id, name: x.name, line: x.line || '', svg: svgMarkup(x.id === 'keys' ? 'key' : x.id === 'harnesses' ? 'repo' : x.id === 'actor' ? 'robot' : 'computer') })),
                    onPick: (row) => { const x = setupOf(opts).find((y) => y.id === row.id); if (x) { try { window.open(x.url, '_blank', 'noopener'); } catch { /* a blocked window */ } } } });
                return;
            }
            if (section === 'agent') {
                P.open({ anchor: ctxB, title: 'Harness', search: 'auto', value: pick.agent, rows: [...(opts.agents || []).map((a) => ({ id: a.id, name: a.name, line: a.line || '', disabled: a.available === false })), SETUP_ROW], onPick: (row) => {
                    if (row.id === SETUP_ROW.id) { then(() => openCtx('setup')); return; } pick.agent = row.id; if (pick.where === 'openvibe' && coding(opts)) pick.where = 'auto'; savePick(); } });
            } else if (section === 'where') {
                const places = coding(opts) ? (opts.places || []).filter((x) => x.kind !== 'openvibe').map((x) => (x.kind === 'auto' ? { ...x, line: 'A shared node or your own computer' } : x)) : (opts.places || []);
                P.open({ anchor: ctxB, title: 'Runs on', search: 'auto', value: pick.where, rows: [...places.map((x) => ({ id: placeKey(x), name: x.name, line: x.line || '', disabled: x.available === false })), SETUP_ROW], onPick: (row) => { if (row.id === SETUP_ROW.id) { then(() => openCtx('setup')); return; } pick.where = row.id; savePick(); } });
            } else if (section === 'effort') {
                P.open({ anchor: ctxB, title: 'Effort', search: false, value: pick.effort || 'auto', rows: EFFORTS.map((x) => ({ id: x.id, name: x.name, line: x.line })),
                    onPick: (row) => { pick.effort = row.id; savePick(); paintCtx(); } });
            } else if (section === 'permission') {
                P.open({ anchor: ctxB, title: 'Allowed to', search: false, value: pick.permission || 'edit', rows: PERMISSIONS.map((x) => ({ id: x.id, name: x.name, line: x.line })),
                    onPick: (row) => { pick.permission = row.id; savePick(); paintCtx(); } });
            } else if (section === 'way') {
                // How Actor works it (4.281.0; Actor's engines, the owner 11-16: "use an agent or harness or model system or a
                // decisions API or swap between and benchmark"): mid-session a change goes with the next message.
                const actorBase = String(o.actorUrl || 'https://openvibe.actor').replace(/\/+$/, '');
                P.open({ anchor: ctxB, title: 'Way', search: false, value: pick.way || 'auto',
                    rows: [...WAYS.map((x) => ({ id: x.id, name: x.name, line: x.line })), { id: 'compare', name: 'Compare the ways', line: 'One question, several ways side by side, each answer graded' }],
                    onPick: (row) => {
                        if (row.id === 'compare') { try { window.open(`${actorBase}/compare`, '_blank', 'noopener'); } catch { /* a blocked window */ } return; }
                        pick.way = row.id; savePick();
                    } });
            } else if (section === 'works') {
                P.open({ anchor: ctxB, title: 'Works on', search: 'auto', value: pick.works || '', rows: [{ id: '', name: 'Anything', line: 'It works out what you mean: a new site, a repository, a question' }, ...o.works.map((x) => ({ id: String(x.value), name: x.name, line: x.line || '' }))], onPick: (row) => { pick.works = row.id || null; savePick(); } });
            } else if (section === 'model') {
                const d = await loadModels();
                const sections = [{ title: '', rows: [{ id: 'auto', name: 'Auto', line: 'The best fit for what you ask, within your budget' }] }];
                const priced = new Map();   // row id → { price, free }, kept with the pick for the price before it runs
                for (const g of d.groups || []) {
                    for (const x of (g.rows || []).slice(0, 800)) priced.set(`${x.source || 'openvibe'}|${x.model}`, { price: x.price && Number.isFinite(x.price.in) ? { in: x.price.in, out: x.price.out } : null, free: !!x.free });
                    const rows = (g.rows || []).slice(0, 800).map((x) => ({ id: `${x.source || 'openvibe'}|${x.model}`, name: x.name || x.model, line: [x.maker, x.free ? 'Free' : x.price && Number.isFinite(x.price.in) ? `$${x.price.in} / $${x.price.out} per 1M` : ''].filter(Boolean).join(' · '), badge: x.free ? 'Free' : '' }));
                    if (rows.length) sections.push({ title: g.title || g.id, rows });
                }
                const value = pick.model ? `${pick.model.source || 'openvibe'}|${pick.model.id}` : 'auto';
                P.open({ anchor: ctxB, title: 'Model', search: true, value, sections, onPick: (row) => {
                    if (row.id === 'auto') pick.model = null;
                    else { const [source, ...rest] = String(row.id).split('|'); pick.model = { id: rest.join('|'), source, name: row.name, ...(priced.get(row.id) || {}) }; }
                    savePick();
                } });
            }
        }
        ctxB.addEventListener('click', () => openCtx());
        loadOptions().then(paintCtx);

        // ── the box ──
        function composer(placeholder) {
            composeSlot.textContent = '';
            const send = (v) => onSend(v);
            const plain = () => {
                const f = el('form', 'ovse-plainbox'); const ta = el('textarea'); ta.rows = 1; ta.placeholder = placeholder; ta.setAttribute('aria-label', placeholder);
                const go = btn('ovse-send', 'Send', 'send'); go.type = 'submit';
                f.append(ta, go);
                f.addEventListener('submit', async (e) => {
                    e.preventDefault(); const t = ta.value.trim(); if (!t) return; go.disabled = true;
                    try { if (await send({ text: t }) !== false) ta.value = ''; } catch (err) { flash((err && err.message) || 'That did not send'); } finally { go.disabled = false; }
                });
                ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && slash.hidden) { e.preventDefault(); f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true })); } });
                composeSlot.append(f);
            };
            const real = (C) => {
                try {
                    C.mount(composeSlot, { preset: 'agent', run: false, frameBase: base, placeholder, label: placeholder, examples: o.examples, user: o.me, noDraft: true, ...(o.composer && typeof o.composer === 'object' ? o.composer : {}), onSubmit: (v) => send({ text: v.text, files: v.files }) });
                } catch { composeSlot.textContent = ''; plain(); }
            };
            if (root.OpenVibeComposer && root.OpenVibeComposer.mount) real(root.OpenVibeComposer);
            else {
                plain();
                need(o, 'ov-composer.js', 'OpenVibeComposer').then((C) => {
                    if (!C || !composeSlot.isConnected) return;
                    const was = (composeSlot.querySelector('textarea') || {}).value || '';
                    composeSlot.textContent = ''; real(C);
                    if (was) { const ta = composeSlot.querySelector('textarea'); if (ta) { ta.value = was; ta.dispatchEvent(new Event('input', { bubbles: true })); } }
                });
            }
        }
        const boxText = () => composeSlot.querySelector('textarea');
        // The link's words wait in the box, ready to send (never sent for the person).
        if (linked && linked.q) {
            let tries = 0;
            const fill = () => { const ta = boxText(); if (ta && !ta.value) { ta.value = linked.q; ta.dispatchEvent(new Event('input', { bubbles: true })); return; } if (++tries < 40) setTimeout(fill, 100); };
            fill();
        }
        // Slash commands and @-mentions, offered as you type.
        const COMMANDS = [
            ['/new', 'A new session', 'plus'], ['/agent', 'Who works on it', 'robot'], ['/model', 'Which model', 'model'], ['/where', 'Where it runs', 'computer'],
            ['/repo', 'What it works on', 'repo'], ['/stop', 'Stop this session', 'stop'], ['/sessions', 'All your sessions', 'chat'], ['/help', 'What the box can do', 'spark'],
        ];
        let slashAt = 0;
        function paintSlash() {
            const ta = boxText(); const v = ta ? ta.value : '';
            const m = /^\/([a-z]*)$/i.exec(v) || /^@([\w.-]*)$/.exec(v);
            if (!m) { slash.hidden = true; return; }
            const q = m[1].toLowerCase();
            let rows;
            if (v[0] === '/') rows = COMMANDS.filter(([c]) => c.slice(1).startsWith(q)).filter(([c]) => c !== '/repo' || (Array.isArray(o.works) && o.works.length)).map(([c, line, g]) => ({ put: `${c} `, name: c, line, g }));
            else rows = ((options || fallbackOptions).agents || []).filter((a) => a.id !== 'auto' && (a.id.toLowerCase().startsWith(q) || String(a.name).toLowerCase().startsWith(q))).map((a) => ({ put: `@${a.id} `, name: `@${a.id}`, line: a.name + (a.line ? ` · ${a.line}` : ''), g: a.kind === 'harness' || a.id === 'codes' ? 'code' : 'robot' }));
            if (!rows.length) { slash.hidden = true; return; }
            slashAt = Math.min(slashAt, rows.length - 1);
            slash.textContent = '';
            rows.slice(0, 8).forEach((r, i) => {
                const b = el('button', `ovse-sl${i === slashAt ? ' is-on' : ''}`); b.type = 'button'; b.setAttribute('role', 'option'); b.setAttribute('aria-selected', String(i === slashAt));
                b.append(svg(r.g), el('b', '', r.name), el('small', '', r.line));
                b.addEventListener('mousedown', (e) => e.preventDefault());
                b.addEventListener('click', () => take(r));
                slash.append(b);
            });
            slash.hidden = false;
            slash._rows = rows;
        }
        function take(r) {
            const ta = boxText(); if (!ta) return;
            slash.hidden = true;
            if (r.put.startsWith('/') && !['/repo '].includes(r.put)) { ta.value = ''; ta.dispatchEvent(new Event('input', { bubbles: true })); command(r.put.trim()); return; }
            ta.value = r.put; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus();
        }
        composeSlot.addEventListener('input', (e) => { if (e.target && e.target.tagName === 'TEXTAREA') { slashAt = 0; paintSlash(); } });
        composeSlot.addEventListener('keydown', (e) => {
            if (slash.hidden || !slash._rows) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); slashAt = (slashAt + (e.key === 'ArrowDown' ? 1 : -1) + Math.min(8, slash._rows.length)) % Math.min(8, slash._rows.length); paintSlash(); }
            else if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); e.stopPropagation(); take(slash._rows[slashAt]); }
            else if (e.key === 'Escape') { e.stopPropagation(); slash.hidden = true; }
        }, true);
        function command(c) {
            const word = c.split(/\s+/)[0].toLowerCase();
            if (word === '/new') blank();
            else if (word === '/stop') { if (state.run && !isEnd(state.run)) stop(); else flash('Nothing is running here.'); }
            else if (word === '/sessions') setDrawer(true);
            else if (word === '/agent') { if (state.run) blank(); openCtx('agent'); }
            else if (word === '/model') { if (state.run) blank(); openCtx('model'); }
            else if (word === '/where') { if (state.run) blank(); openCtx('where'); }
            else if (word === '/repo') { if (state.run) blank(); openCtx('works'); }
            else if (word === '/help') flash('Type anything. / for commands, @ to pick who works on it.');
            else return false;
            return true;
        }
        async function onSend(v) {
            const text = String(v.text || '').trim();
            if (/^\/[a-z]+$/i.test(text) && command(text)) return true;
            if (!state.run) return start(text, v.files);
            return say(text, v.files);
        }

        // ── starting, saying, stopping ──
        async function uploadFiles(files) {
            const out = [];
            for (const f of [...(files || [])].slice(0, 10)) {
                if (f.size > 10 * 1024 * 1024) throw new Error(`${f.name} is over 10 MB`);
                const r = await fetch(`${base}/runs/files`, { method: 'POST', credentials: 'omit', headers: { ...headers(), 'Content-Type': f.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(f.name || 'file') }, body: f });
                const j = await r.json().catch(() => ({}));
                if (!r.ok || !j.file) throw new Error(j.error || `${f.name} did not upload`);
                out.push(j.file);
            }
            return out;
        }
        function mention(text) {
            const m = /^@([\w.-]{1,40})\s+([\s\S]*)$/.exec(text);
            if (!m) return { text, agent: null };
            const a = ((options || fallbackOptions).agents || []).find((x) => x.id.toLowerCase() === m[1].toLowerCase() || String(x.name).toLowerCase() === m[1].toLowerCase());
            return a ? { text: m[2], agent: a.id } : { text, agent: null };
        }
        async function start(raw, files, choice) {
            const { text, agent } = mention(raw);
            const how = {};
            // 4.287.0: the menu's box may name who answers (Ask Actor, Ask Codes, Ask one of your agents).
            const named = choice && typeof choice.agent === 'string' && choice.agent.trim() ? choice.agent.trim().slice(0, 160) : null;
            const who = named || agent || pick.agent;
            if (who && who !== 'auto') how.agent = who;
            if (pick.model) how.model = { id: pick.model.id, source: pick.model.source || 'openvibe', name: pick.model.name };
            const opts = options || fallbackOptions;
            if (pick.where && pick.where !== 'auto') { const w = (opts.places || []).find((x) => placeKey(x) === pick.where); if (w) how.where = { kind: w.kind, ...(w.id ? { id: w.id } : {}), name: w.name }; }
            if (pick.works) { how.kind = 'code'; how.target = /^[\w.-]+\/[\w.-]+$/.test(pick.works) ? { repo: pick.works } : pick.works; }
            // 4.286.0: the effort (every harness) and, for coding, what the agent may do.
            if (pick.effort && pick.effort !== 'auto') how.effort = pick.effort;
            if (pick.permission && (coding(opts) || pick.works)) how.permission = pick.permission;
            state.effortSent = pick.effort || 'auto';
            // The way (4.281.0; Actor's engines): Actor's agent, one model, the Decisions API … Only for Actor's runs.
            if (wayBody() && !coding(opts) && !pick.works) { how.engine = wayBody(); state.waySent = pick.way; }
            if (o.context) how.context = o.context;
            // The thread opens at once: your words on the right, the agent working on the left.
            const gen = ++state.gen; clearStream();
            state.ref = null; state.run = null; state.steps = new Map(); state.queue = []; state.pending = true; state.open = new Set();
            wrap.classList.remove('is-blank');
            state.steps.set(0, { seq: 0, kind: 'message', from: 'person', text, attachments: (files || []).map((f) => ({ name: f.name, kind: /^image\//.test(f.type) ? 'image' : 'file' })) });
            paint(); paintCtx();
            let run;
            try {
                const attachments = files && files.length ? await uploadFiles(files) : [];
                run = await api('/runs', { method: 'POST', headers: { 'Idempotency-Key': `ovse-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}` }, body: JSON.stringify({ ...how, ...(attachments.length ? { attachments } : {}), text: text.slice(0, 16000) }) });
            } catch (err) {
                if (gen !== state.gen) return false;
                state.pending = false;
                blank();
                const ta = boxText(); if (ta) { ta.value = raw; ta.dispatchEvent(new Event('input', { bubbles: true })); }
                flash(err.status === 401 ? 'Sign in to start a session.' : (err && err.message) || 'That did not start. Try again.');
                return false;
            }
            state.pending = false;
            if (gen !== state.gen) return true;
            emit('session.started', { ref: run.ref || run.id, run });
            open(run.ref || run.id, run, { said: text, modelSent: pick.model ? pick.model.id : null });
            loadRuns();
            return true;
        }
        async function say(text, files) {
            if (!state.ref) return false;
            if (isLive(state.run)) {
                // While it works, your words wait in the thread and go at its next turn.
                const q = el('div', 'ovse-me is-queued'); const b = el('div', 'ovse-bubble'); b.append(words(text)); q.append(b, el('small', 'ovse-queued', 'Queued: it reads this after the step it is on'));
                state.queue.push({ text, files, node: q }); schedule();
                return true;
            }
            const attachments = files && files.length ? await uploadFiles(files) : [];
            // A model changed on the chip mid-session goes with the words, and the conversation stays on it after.
            const swap = pick.model && pick.model.id !== state.modelSent ? { model: { id: pick.model.id, source: pick.model.source || 'openvibe', name: pick.model.name } } : {};
            // The way, swapped on the chip mid-session (4.281.0): sent once, and the conversation keeps it after.
            const wayKey = `${pick.way || 'auto'}|${(wayBody() && wayBody().model) || ''}`;
            if (String(state.ref || '').startsWith('actor:') && state.waySent !== undefined && wayKey !== state.waySent) swap.engine = wayBody() || 'auto';
            // The effort, changed on the chip mid-session (4.286.0): sent once, and the session keeps it after.
            if (state.effortSent !== undefined && (pick.effort || 'auto') !== state.effortSent) swap.effort = pick.effort || 'auto';
            const step = await api(`/runs/${encodeURIComponent(state.ref)}/messages`, { method: 'POST', body: JSON.stringify({ text, ...(attachments.length ? { attachments } : {}), ...swap }) });
            if (swap.effort) state.effortSent = swap.effort;
            if (swap.model) state.modelSent = swap.model.id;
            if (String(state.ref || '').startsWith('actor:')) state.waySent = wayKey;
            if (step && Number.isInteger(step.seq)) state.steps.set(step.seq, step);
            if (state.run && !isLive(state.run)) state.run = { ...state.run, status: 'running' };
            schedule();
            if (!state.stop) followRun();
            return true;
        }
        function flushQueue() {
            if (!state.queue.length || isLive(state.run)) return;
            const next = state.queue.shift();
            say(next.text, next.files).catch((err) => { next.node.classList.add('is-failed'); next.node.querySelector('.ovse-queued').textContent = (err && err.message) || 'That did not send'; state.queue.unshift(next); });
        }
        /** The title becomes a field: Enter saves (empty gives it back its first line), Escape or leaving it cancels. */
        function renameInPlace() {
            const r = state.run;
            if (!r || !state.ref || who.querySelector('.ovse-rename')) return;
            const ref = state.ref;
            const input = el('input', 'ovse-rename'); input.type = 'text'; input.maxLength = 200; input.value = titleOf(r);
            input.setAttribute('aria-label', 'Name this session'); input.enterKeyHint = 'done';
            titleN.hidden = true; who.insertBefore(input, titleN);
            let done = false;
            const close = () => { if (done) return; done = true; input.remove(); titleN.hidden = false; };
            const save = async () => {
                if (done) return;
                const title = input.value.replace(/\s+/g, ' ').trim();
                close();
                if (title === titleOf(r)) return;
                try {
                    const out = await api(`/runs/${encodeURIComponent(ref)}`, { method: 'PATCH', body: JSON.stringify({ title: title || null }) });
                    if (state.ref !== ref) return;
                    state.run = { ...state.run, title: (out && out.title) || title || state.run.title };
                    paintHead(); flash(title ? 'Renamed' : 'Back to its first words');
                    emit('session.renamed', { ref, title: state.run.title });
                    const row = state.runs.find((x) => (x.ref || x.id) === ref); if (row) { row.title = state.run.title; paintRuns(); }
                } catch (err) { flash((err && err.message) || 'The name was not saved'); }
            };
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } else if (e.key === 'Escape') { e.preventDefault(); close(); } });
            input.addEventListener('blur', () => close());
            input.focus(); input.select();
        }
        async function shareReplay() {
            if (!state.ref) return;
            try {
                const out = await api(`/runs/${encodeURIComponent(state.ref)}/replay`, { method: 'POST', body: '{}' });
                state.replay = out.url;
                try { await navigator.clipboard.writeText(out.url); flash('Replay link copied'); } catch { flash(out.url); }
                emit('session.shared', { ref: state.ref, url: out.url });
            } catch (err) { flash((err && err.message) || 'The replay link was not made'); }
        }
        async function stopReplay() {
            if (!state.ref) return;
            try { await api(`/runs/${encodeURIComponent(state.ref)}/replay`, { method: 'DELETE' }); state.replay = null; flash('Not shared any more'); }
            catch (err) { flash((err && err.message) || 'It is still shared'); }
        }
        async function stop() {
            if (!state.ref) return;
            try { await api(`/runs/${encodeURIComponent(state.ref)}/stop`, { method: 'POST', body: '{}' }); flash('Stopping'); }
            catch (err) { flash((err && err.message) || 'It did not stop'); }
        }

        // ── opening a session ──
        function clearStream() { if (state.stop) state.stop(); state.stop = null; if (state.abort) state.abort.abort(); state.abort = null; clearInterval(state.tick); state.tick = null; }
        async function open(ref, known, how = {}) {
            clearStream();
            const gen = ++state.gen;
            state.ref = ref; state.run = known || null; state.steps = new Map(); state.queue = []; state.open = new Set(); state.pending = false; state.replay = null;
            // The model this session last asked for: a message carries the chip's model only when it changed (plan §AD.8.3).
            state.modelSent = how.modelSent !== undefined ? how.modelSent : (known && known.model && known.model.id) || null;
            // The way the chip shows when a session opens is taken as the one it runs: a later change on the chip is a swap.
            state.waySent = `${pick.way || 'auto'}|${(wayBody() && wayBody().model) || ''}`;
            wrap.classList.remove('is-blank');
            if (how.said) { state.steps.set(-1, { seq: -1, kind: 'message', from: 'person', text: how.said }); state.pending = true; }
            paint(); paintCtx();
            [...runsBox.querySelectorAll('.ovse-row')].forEach((b) => b.classList.remove('is-on'));
            composer('Say the next thing');
            emit('session.opened', { ref });
            try {
                const [r, page] = await Promise.all([api(`/runs/${encodeURIComponent(ref)}`), api(`/runs/${encodeURIComponent(ref)}/steps?limit=500`)]);
                if (gen !== state.gen) return;
                state.run = r; state.pending = false;
                const steps = Array.isArray(page.steps) ? page.steps : [];
                if (steps.some((s) => s.kind === 'message' && s.from === 'person')) state.steps.delete(-1);
                steps.forEach((s) => { if (Number.isInteger(s.seq)) state.steps.set(s.seq, s); });
                paint(); paintCtx();
                requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
            } catch (err) {
                if (gen !== state.gen) return;
                state.pending = false;
                thread.textContent = '';
                thread.append(empty('This session did not load', err.status === 404 ? 'It is gone, or it is not yours.' : (err && err.message) || ''));
                return;
            }
            if (!isEnd(state.run)) followRun();
        }
        function followRun() {
            const gen = state.gen; const ref = state.ref;
            const last = Math.max(0, ...[...state.steps.keys()].filter((k) => k > 0));
            state.abort = new AbortController();
            state.stop = follow({ url: `${base}/runs/${encodeURIComponent(ref)}/events`, headers, after: last, signal: state.abort.signal,
                onEvent(event, d) {
                    if (gen !== state.gen) return 'end';
                    if (event === 'step' && d && d.step && Number.isInteger(d.step.seq)) {
                        const s = d.step;
                        if (s.kind === 'message' && s.from === 'person') state.steps.delete(-1);
                        state.steps.set(s.seq, s); emit('session.step', { ref, step: s }); schedule();
                    } else if (event === 'delta' && d && state.steps.has(d.seq)) {
                        const s = state.steps.get(d.seq); state.steps.set(d.seq, { ...s, text: `${s.text || ''}${String(d.text || '')}` });
                        // Words as they come: in place, no repaint of the whole thread.
                        const n = thread.querySelector(`.ovse-say[data-seq="${d.seq}"] .ovse-words`);
                        if (n) { const last2 = n.lastElementChild || n; last2.append(document.createTextNode(String(d.text || ''))); if (body.scrollHeight - body.scrollTop - body.clientHeight < 200) body.scrollTop = body.scrollHeight; }
                        else schedule();
                    } else if (event === 'run' && d && d.run) {
                        state.run = d.run; schedule(); flushQueue(); updateRow(d.run);
                    } else if (event === 'approval' && d && d.approval) {
                        schedule();
                    } else if (event === 'end') {
                        if (state.run) state.run = { ...state.run, status: (d && d.status) || 'done', ended_at: state.run.ended_at || new Date().toISOString() };
                        state.stop = null; schedule(); flushQueue(); updateRow(state.run);
                        emit('session.ended', { ref, run: state.run });
                        return 'end';
                    }
                    return null;
                } });
        }
        function updateRow(r) {
            if (!r) return;
            const i = state.runs.findIndex((x) => (x.ref || x.id) === (r.ref || r.id));
            if (i >= 0) { state.runs[i] = { ...state.runs[i], ...r }; paintRuns(); }
        }
        function empty(title, line) { const e = el('div', 'ovse-empty'); e.append(svg('spark'), el('b', '', title), el('p', '', line || '')); return e; }

        // ── a new session ──
        function blank() {
            clearStream();
            state.gen++; state.ref = null; state.run = null; state.steps = new Map(); state.queue = []; state.stack = []; state.pending = false;
            wrap.classList.add('is-blank');
            thread.textContent = '';
            const hi = el('div', 'ovse-hello');
            const big = el('span', 'ovse-hello-face'); big.append(svg('spark'));
            if (o.actor) loadActor().then(() => { if (!actor || !big.isConnected) return; big.textContent = ''; big.classList.add('is-actor'); big.append(actorFace('xl')); });
            hi.append(big, el('b', 'ovse-hello-t', o.helloTitle || 'What should we do?'), el('p', 'ovse-hello-l', o.line || 'Type anything. It answers, searches, makes things and writes code, on the right agent for it. / for commands, @ to pick who works on it.'));
            thread.append(hi);
            if (Array.isArray(o.starters) && o.starters.length) {
                const st = el('div', 'ovse-starters'); st.setAttribute('role', 'group'); st.setAttribute('aria-label', 'Things to ask');
                o.starters.slice(0, 6).forEach((x, i) => {
                    const [g, w] = Array.isArray(x) ? x : ['spark', String(x)];
                    const b = btn('ovse-starter', null, G[g] ? g : 'spark', w); b.style.setProperty('--i', String(i));
                    b.addEventListener('click', () => { b.disabled = true; start(w); });
                    st.append(b);
                });
                thread.append(st);
            }
            planBox.hidden = true;
            [...runsBox.querySelectorAll('.ovse-row')].forEach((b) => b.classList.remove('is-on'));
            paintHead(); paintCtx();
            composer(o.placeholder || 'Ask anything, or describe what to build');
            emit('session.blank', {});
        }
        function prefill(text) {
            const put = (n = 0) => {
                const ta = boxText();
                if (!ta) { if (n < 40) setTimeout(() => put(n + 1), 50); return; }
                ta.value = String(text || '').slice(0, 16000);
                ta.dispatchEvent(new Event('input', { bubbles: true }));
                try { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); } catch { /* */ }
            };
            put();
        }

        if (o.open) open(o.open); else blank();
        if (o.actor) loadActor().then(paintActor);
        if (wide && !collapsed) loadRuns();
        need(o, 'ov-picker.js', 'OpenVibePicker');
        return {
            open: (ref) => { state.stack = []; return open(ref); }, blank, prefill, refresh: () => { loadRuns(); if (o.actor) { actorAt = 0; loadActor().then(paintActor); } },
            start: (text, files, choice) => start(String(text || ''), Array.isArray(files) ? files : undefined, choice), list: () => setDrawer(true),
            /** 4.284.0: the page's own box searches the sessions (the menu's box on Vibe). */
            search(q) { const v = String(q || '').slice(0, 120); if (findIn.value !== v) findIn.value = v; clearTimeout(findT); findT = setTimeout(() => { state.q = v.trim(); loadRuns(); }, 250); if (!wide && v) setDrawer(true); },
            drawer: (v) => setDrawer(v === undefined ? true : !!v),
            get state() { return { ref: state.ref, run: state.run, steps: state.steps.size, wide, drawer: wide ? !collapsed : state.drawer }; },
            destroy() { clearStream(); state.gen++; if (ro) ro.disconnect(); if (lead) { try { lead.remove(); } catch { /* */ } lead = null; } if (state.topMount && typeof state.topMount.destroy === 'function') { try { state.topMount.destroy(); } catch { /* */ } } host.textContent = ''; },
        };
    }

    let styled = false;
    function styles() {
        if (styled || document.getElementById('ovse-styles')) { styled = true; return; }
        styled = true;
        const css = `
.ovse { --ovse-fg: var(--text-primary, #e6edf7); --ovse-dim: var(--text-secondary, #a8b3c4); --ovse-mute: var(--text-muted, #93a0b4); --ovse-line: var(--border, rgba(255,255,255,.09)); --ovse-card: var(--bg-card, rgba(255,255,255,.035)); --ovse-bg: var(--bg-primary, #0b0f17); --ovse-acc: var(--accent, #3b82f6); --ovse-acc2: var(--accent-light, #60a5fa);
  position: relative; display: grid; grid-template-columns: minmax(0, 1fr); height: 100%; min-height: 0; color: var(--ovse-fg); font: 15px/1.5 var(--font-body, system-ui, sans-serif); overflow: hidden; background: var(--ovse-bg); }
.ovse * { box-sizing: border-box; }
/* A host page's rules for bare elements stay out of the frame (11-15: openvibe.design's .ds section margin-top
   pushed the thread 40 px down; a site's header, aside or form margins would do the same). */
.ovse > .ovse-drawer, .ovse > .ovse-main, .ovse > .ovse-main > .ovse-head, .ovse .ovse-plainbox { margin: 0; float: none; }
.ovse [hidden], .ovse-sheet [hidden] { display: none !important; }
.ovse-g { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.ovse button { font: inherit; color: inherit; }
.ovse-ib { display: inline-grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 12px; background: transparent; color: var(--ovse-dim); cursor: pointer; transition: background .15s, color .15s, transform .15s; }
.ovse-ib:hover { background: color-mix(in srgb, var(--ovse-fg) 8%, transparent); color: var(--ovse-fg); }
.ovse-ib:active { transform: scale(.94); }
.ovse :focus-visible { outline: 2px solid var(--ovse-acc2); outline-offset: 2px; }

/* the drawer: over the session on a phone, a column on a computer */
.ovse-drawer { position: absolute; z-index: 5; inset: 0 auto 0 0; width: min(86%, 340px); display: flex; flex-direction: column; min-height: 0; background: var(--bg-secondary, var(--ovse-bg)); border-right: 1px solid var(--ovse-line); transform: translateX(-104%); transition: transform .28s cubic-bezier(.2,.8,.2,1); padding-top: env(safe-area-inset-top, 0px); }
.ovse-scrim { position: absolute; z-index: 4; inset: 0; background: rgba(0,0,0,.42); opacity: 0; pointer-events: none; transition: opacity .25s; }
.ovse.is-drawer .ovse-drawer { transform: none; box-shadow: 0 0 40px rgba(0,0,0,.35); }
.ovse.is-drawer:not(.is-wide) .ovse-scrim { opacity: 1; pointer-events: auto; }
.ovse.is-wide { grid-template-columns: 0 minmax(0, 1fr); transition: grid-template-columns .28s cubic-bezier(.2,.8,.2,1); }
.ovse.is-wide.is-drawer { grid-template-columns: 300px minmax(0, 1fr); }
.ovse.is-wide .ovse-drawer { position: relative; inset: auto; width: auto; grid-row: 1; grid-column: 1; overflow: hidden; box-shadow: none; transform: none; opacity: 0; transition: opacity .2s; }
.ovse.is-wide.is-drawer .ovse-drawer { opacity: 1; }
.ovse.is-wide .ovse-scrim, .ovse.is-wide .ovse-dclose { display: none; }
.ovse.is-wide .ovse-main { grid-column: 2; }
.ovse-dhead { display: flex; align-items: center; gap: 8px; padding: 10px 10px 6px 16px; }
.ovse-dhead > b { flex: 1; font-size: 17px; }
.ovse-new { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px 0 10px; border: 0; border-radius: 999px; background: var(--ovse-acc); color: var(--on-accent, #fff) !important; font-weight: 600; cursor: pointer; transition: transform .15s, filter .15s; }
.ovse-new:hover { filter: brightness(1.08); } .ovse-new:active { transform: scale(.96); }
/* The search: one soft field, no hard edge, one focus ring on the field itself. The input inside is bare: a search
   input keeps the platform's own rounded field and ring unless told not to (11-15, the owner on a phone: "a double
   border instead of just being no border on the inner one"), and a host page's input rules never reach it. */
.ovse-find { display: flex; align-items: center; gap: 10px; margin: 6px 12px 10px; padding: 0 14px; height: 42px; border-radius: 14px; background: color-mix(in srgb, var(--ovse-fg) 6%, transparent); border: 1px solid transparent; color: var(--ovse-mute); cursor: text; transition: background .18s, border-color .18s, box-shadow .18s; }
.ovse-find:hover { background: color-mix(in srgb, var(--ovse-fg) 9%, transparent); }
.ovse-find > svg { flex: none; width: 17px; height: 17px; }
.ovse .ovse-find input, .ovse .ovse-find input:focus, .ovse .ovse-find input:focus-visible { flex: 1; min-width: 0; height: 100%; padding: 0; border: 0; outline: 0; background: transparent; color: var(--ovse-fg); font: inherit; font-size: 15px; caret-color: var(--ovse-acc); -webkit-appearance: none; appearance: none; border-radius: 0; box-shadow: none; margin: 0; }
.ovse .ovse-find input::placeholder { color: var(--ovse-mute); opacity: 1; }
.ovse .ovse-find input::-webkit-search-decoration, .ovse .ovse-find input::-webkit-search-cancel-button { -webkit-appearance: none; display: none; }
.ovse-find:focus-within { background: var(--ovse-card); border-color: color-mix(in srgb, var(--ovse-acc) 55%, transparent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ovse-acc) 18%, transparent); color: var(--ovse-dim); }
.ovse-runs { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 8px 16px; }
.ovse-group { margin: 12px 10px 4px; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--ovse-mute); }
.ovse-row { position: relative; display: flex; align-items: center; gap: 10px; width: 100%; min-height: 56px; padding: 8px 10px; border: 0; border-radius: 14px; background: transparent; text-align: left; cursor: pointer; animation: ovse-in .32s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 22ms); transition: background .15s; }
.ovse-row:hover { background: color-mix(in srgb, var(--ovse-fg) 6%, transparent); }
.ovse-row.is-on { background: color-mix(in srgb, var(--ovse-acc) 16%, transparent); }
.ovse-row.is-ghost { height: 56px; background: linear-gradient(90deg, var(--ovse-card), color-mix(in srgb, var(--ovse-fg) 7%, transparent), var(--ovse-card)); background-size: 200% 100%; animation: ovse-shim 1.4s linear infinite; margin-bottom: 4px; }
.ovse-row-t { flex: 1; min-width: 0; display: grid; gap: 1px; }
.ovse-row-top { display: flex; gap: 8px; align-items: baseline; min-width: 0; }
.ovse-row-top b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14.5px; font-weight: 600; }
.ovse-row-top small, .ovse-row-l { color: var(--ovse-mute); font-size: 12.5px; }
.ovse-row-l { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovse-row.is-needs .ovse-row-l { color: var(--warning, #f5a524); }
.ovse-li { display: grid; }
.ovse-li.has-acts { margin: 2px 0 6px; border-radius: 16px; background: color-mix(in srgb, var(--warning, #f5a524) 8%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning, #f5a524) 40%, transparent); }
.ovse-li.has-acts > .ovse-row:hover { background: transparent; }
.ovse-row-acts { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 10px 10px 54px; }
.ovse-row-acts .ovse-b { min-height: 36px; padding: 0 14px; font-size: 13.5px; } .ovse-row-acts .ovse-note { margin: 0; }
.ovse-actor { display: flex; align-items: center; gap: 6px; margin: 2px 10px 8px; padding: 6px; border-radius: 16px; background: var(--ovse-card); border: 1px solid var(--ovse-line); }
.ovse-actor-who { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 4px; border: 0; border-radius: 12px; background: transparent; text-align: left; cursor: pointer; }
.ovse-codes { margin-top: 6px; }
.ovse-codes-face { flex: none; width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, color-mix(in srgb, var(--accent, #3b82f6) 85%, #22d3ee), color-mix(in srgb, var(--accent, #3b82f6) 70%, #0f172a)); }
.ovse-codes-face svg { width: 22px; height: 22px; }
.ovse-actor-who:hover { background: color-mix(in srgb, var(--ovse-fg) 6%, transparent); }
.ovse-actor-t { flex: 1; min-width: 0; display: grid; }
.ovse-actor-top { display: flex; align-items: baseline; gap: 6px; } .ovse-actor-top i { font-style: normal; font-size: 11.5px; color: var(--ovse-mute); }
.ovse-actor-t small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ovse-mute); font-size: 12.5px; }
.ovse-actor-who.is-working .ovse-actor-t small { color: var(--ovse-acc2); } .ovse-actor-who.is-asks .ovse-actor-t small { color: var(--warning, #f5a524); }
.ovse-actor-go.is-main { background: var(--ovse-acc); color: var(--on-accent, #fff); }
.ovse-top:empty { display: none; }
.ovse-face-l { font-size: 15px; font-weight: 800; }
.ovse-face.is-xl { width: 60px; height: 60px; border-radius: 22px; } .ovse-face.is-xl .ovse-face-l { font-size: 26px; }
.ovse-me-face.is-working { box-shadow: 0 0 0 2px var(--ovse-bg), 0 0 0 4px var(--ovse-acc2); animation: ovse-ring 1.8s ease-in-out infinite; }
@keyframes ovse-ring { 50% { box-shadow: 0 0 0 2px var(--ovse-bg), 0 0 0 4px color-mix(in srgb, var(--ovse-acc2) 35%, transparent); } }
.ovse-hello-face.is-actor { background: none; box-shadow: none; width: auto; height: auto; }

/* faces */
.ovse-face { --ovse-h: 215; display: inline-grid; place-items: center; flex: none; border-radius: 30%; background: linear-gradient(140deg, hsl(var(--ovse-h) 70% 56%), hsl(calc(var(--ovse-h) + 40) 72% 44%)); color: #fff; overflow: hidden; }
.ovse-face.is-s { width: 34px; height: 34px; } .ovse-face.is-m { width: 40px; height: 40px; }
.ovse-face img { width: 100%; height: 100%; object-fit: cover; }
.ovse-face .ovse-g { width: 60%; height: 60%; }

/* the session */
.ovse-main { position: relative; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; min-width: 0; min-height: 0; grid-row: 1; }
.ovse.has-nav-lead .ovse-menu { display: none; }
.ovse.has-nav-lead.is-blank .ovse-head { display: none; }
.ovse-sb-pane { transform-box: fill-box; transform-origin: 0 50%; transform: scaleX(0); opacity: 0; transition: transform .34s cubic-bezier(.2, .9, .3, 1), opacity .22s ease; }
.ovse-sb-line { transform-box: fill-box; transform: translateX(calc(-1.5px * var(--ov-move, 1))); transition: transform .34s cubic-bezier(.2, .9, .3, 1); }
.ovse-menu[aria-expanded="true"] { color: var(--ovse-accent, var(--accent, #60a5fa)); }
.ovse-menu[aria-expanded="true"] .ovse-sb-pane { transform: scaleX(1); opacity: .42; }
.ovse-menu[aria-expanded="true"] .ovse-sb-line { transform: none; }
html[data-ov-motion="off"] .ovse-sb-pane, html[data-ov-motion="off"] .ovse-sb-line { transition: none; }
.ovse-head { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 8px 8px 8px 6px; padding-top: max(8px, env(safe-area-inset-top, 0px)); border-bottom: 1px solid var(--ovse-line); }
.ovse-who { flex: 1; min-width: 0; display: grid; gap: 1px; }
.ovse-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15.5px; }
.ovse-rename { min-width: 0; width: 100%; height: 30px; padding: 0 8px; border: 1px solid var(--ovse-line); border-radius: 8px; background: var(--ovse-card); color: var(--ovse-fg); font: 600 15px/1 inherit; outline: none; }
.ovse-rename:focus-visible { border-color: var(--ovse-acc); }
.ovse-stat { display: flex; align-items: center; gap: 6px; min-width: 0; color: var(--ovse-mute); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.ovse-stat span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovse-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ovse-mute); flex: none; }
.ovse-stat.is-run .ovse-dot { background: var(--ovse-acc2); animation: ovse-beat 1.4s ease-in-out infinite; }
.ovse-stat.is-wait .ovse-dot { background: var(--warning, #f5a524); } .ovse-stat.is-wait { color: var(--warning, #f5a524); }
.ovse-stat.is-ok .ovse-dot { background: var(--success, #22c55e); }
.ovse-stat.is-bad .ovse-dot { background: var(--danger, #ef4444); }
.ovse-chg { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border: 1px solid var(--ovse-line); border-radius: 999px; background: var(--ovse-card); color: var(--ovse-dim); font-size: 13px; cursor: pointer; flex: none; }
.ovse-chg .ovse-g { width: 15px; height: 15px; }
.ovse-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; scroll-behavior: smooth; }
.ovse-thread { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 820px; margin: 0 auto; padding: 18px 16px 24px; }
.ovse-me { align-self: flex-end; max-width: min(86%, 640px); display: grid; justify-items: end; gap: 4px; animation: ovse-in .28s cubic-bezier(.2,.8,.2,1) both; }
.ovse-bubble { padding: 10px 14px; border-radius: 20px 20px 6px 20px; background: color-mix(in srgb, var(--ovse-acc) 24%, var(--ovse-card)); overflow-wrap: anywhere; }
.ovse-bubble .ovse-words p { margin: 0; }
.ovse-me.is-queued .ovse-bubble { opacity: .65; border: 1px dashed var(--ovse-line); }
.ovse-queued { color: var(--ovse-mute); font-size: 12px; }
.ovse-me.is-failed .ovse-queued { color: var(--danger, #ef4444); }
.ovse-say { min-width: 0; overflow-wrap: anywhere; animation: ovse-in .3s cubic-bezier(.2,.8,.2,1) both; }
.ovse-author { display: block; margin-bottom: 2px; color: var(--ovse-mute); font-size: 12px; font-weight: 600; }
.ovse-words > :first-child { margin-top: 0; } .ovse-words > :last-child { margin-bottom: 0; }
.ovse-words p { margin: 0 0 10px; } .ovse-words .ovse-h { font-weight: 700; margin-top: 14px; }
.ovse-words ul, .ovse-words ol { margin: 0 0 10px; padding-left: 22px; } .ovse-words li { margin: 3px 0; }
.ovse-words a { color: var(--ovse-acc2); text-decoration: underline; text-underline-offset: 2px; }
.ovse-ic { padding: 1px 6px; border-radius: 6px; background: color-mix(in srgb, var(--ovse-fg) 9%, transparent); font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ovse-cite { display: inline-grid; place-items: center; min-width: 18px; height: 18px; margin: 0 2px; padding: 0 4px; border-radius: 6px; background: color-mix(in srgb, var(--ovse-acc) 22%, transparent); color: var(--ovse-acc2) !important; font-size: 11px; font-weight: 700; text-decoration: none !important; vertical-align: 2px; }
.ovse-pre, .ovse-out { margin: 0 0 10px; padding: 12px 14px; border-radius: 12px; background: color-mix(in srgb, var(--ovse-bg) 60%, #000 40%); border: 1px solid var(--ovse-line); overflow-x: auto; overflow-y: auto; font: 12.5px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre; }
.ovse-say.is-writing .ovse-words > :last-child::after { content: ''; display: inline-block; width: 7px; height: 15px; margin-left: 2px; vertical-align: -2px; border-radius: 2px; background: var(--ovse-acc2); animation: ovse-caret 1s steps(2) infinite; }
.ovse-sources { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.ovse-source { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; height: 30px; padding: 0 10px 0 4px; border-radius: 999px; background: var(--ovse-card); border: 1px solid var(--ovse-line); color: var(--ovse-dim); font-size: 12.5px; text-decoration: none; }
.ovse-source i { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: color-mix(in srgb, var(--ovse-acc) 22%, transparent); color: var(--ovse-acc2); font-style: normal; font-weight: 700; font-size: 11px; }
.ovse-source span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
.ovse-attach { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.ovse-thumb { width: 120px; height: 90px; object-fit: cover; border-radius: 12px; border: 1px solid var(--ovse-line); }
.ovse-chip { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border-radius: 10px; background: var(--ovse-card); border: 1px solid var(--ovse-line); color: var(--ovse-dim); font-size: 12.5px; text-decoration: none; }
.ovse-chip .ovse-g { width: 14px; height: 14px; }
.ovse-chips { display: flex; flex-wrap: wrap; gap: 6px; } .ovse-chip.is-undone { opacity: .6; text-decoration: line-through; }
.ovse-card { margin-top: 8px; }
.ovse-linkcard { display: flex; gap: 10px; align-items: center; padding: 8px; border-radius: 14px; border: 1px solid var(--ovse-line); background: var(--ovse-card); color: inherit; text-decoration: none; }
.ovse-linkcard img { width: 64px; height: 64px; border-radius: 10px; object-fit: cover; }
.ovse-linkcard span { display: grid; min-width: 0; } .ovse-linkcard small { color: var(--ovse-mute); }
.ovse-table { overflow-x: auto; overflow-y: auto; border: 1px solid var(--ovse-line); border-radius: 12px; }
.ovse-table table { border-collapse: collapse; width: 100%; font-size: 13.5px; } .ovse-table th, .ovse-table td { padding: 7px 10px; border-bottom: 1px solid var(--ovse-line); text-align: left; }

/* thinking, the tool block, the files, helpers */
.ovse-think, .ovse-acts { border-radius: 14px; animation: ovse-in .28s cubic-bezier(.2,.8,.2,1) both; }
.ovse-think > summary, .ovse-acts-h { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 10px; border-radius: 12px; color: var(--ovse-dim); font-size: 13.5px; cursor: pointer; list-style: none; user-select: none; transition: background .15s; }
.ovse-think > summary::-webkit-details-marker, .ovse-acts-h::-webkit-details-marker, .ovse-tool-h::-webkit-details-marker, .ovse-plan-h::-webkit-details-marker { display: none; }
.ovse-think > summary:hover, .ovse-acts-h:hover { background: color-mix(in srgb, var(--ovse-fg) 6%, transparent); }
.ovse-think > summary .ovse-g { width: 16px; height: 16px; }
.ovse-think.is-running > summary span { background: linear-gradient(90deg, var(--ovse-dim), var(--ovse-fg), var(--ovse-dim)); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: ovse-shim 1.6s linear infinite; }
.ovse-think > .ovse-words { margin: 4px 10px 8px 34px; padding-left: 12px; border-left: 2px solid var(--ovse-line); color: var(--ovse-dim); font-size: 14px; }
/* 4.286.0: thoughts in a row as one line of connected dots; opened, a dot per thought on one line. */
.ovse-dots { display: inline-flex; align-items: center; gap: 0; margin-left: 2px; }
.ovse-dots i { position: relative; width: 6px; height: 6px; border-radius: 50%; background: color-mix(in srgb, var(--ovse-dim) 70%, transparent); animation: ovse-dot-in .3s cubic-bezier(.2, 1.2, .4, 1) calc(var(--i, 0) * 40ms) both; }
.ovse-dots i + i { margin-left: 10px; }
.ovse-dots i + i::before { content: ""; position: absolute; right: 100%; top: 50%; width: 10px; height: 1.5px; margin-top: -.75px; background: color-mix(in srgb, var(--ovse-dim) 45%, transparent); }
.ovse-dots i.is-now { background: var(--ovse-accent, var(--accent, #60a5fa)); animation: ovse-dot-pulse 1.1s ease-in-out infinite; }
@keyframes ovse-dot-in { from { transform: scale(0); opacity: 0; } }
@keyframes ovse-dot-pulse { 50% { transform: scale(1.5); box-shadow: 0 0 0 4px color-mix(in srgb, var(--ovse-accent, var(--accent, #60a5fa)) 22%, transparent); } }
.ovse-thinks-list { list-style: none; margin: 4px 10px 8px 22px; padding: 0; position: relative; }
.ovse-thinks-list::before { content: ""; position: absolute; left: 5px; top: 10px; bottom: 10px; width: 1.5px; background: var(--ovse-line); }
.ovse-thinks-list li { position: relative; padding: 4px 0 8px 22px; color: var(--ovse-dim); font-size: 14px; animation: ovse-in .28s cubic-bezier(.2, .8, .2, 1) both; }
.ovse-thinks-list li::before { content: ""; position: absolute; left: 1px; top: 10px; width: 9px; height: 9px; border-radius: 50%; background: var(--ovse-bg, var(--bg, #0b0f1a)); border: 2px solid color-mix(in srgb, var(--ovse-dim) 70%, transparent); box-sizing: border-box; }
.ovse-thinks-list li.is-now::before { border-color: var(--ovse-accent, var(--accent, #60a5fa)); animation: ovse-dot-pulse 1.1s ease-in-out infinite; }
html[data-ov-motion="off"] .ovse-dots i, html[data-ov-motion="off"] .ovse-thinks-list li, html[data-ov-motion="off"] .ovse-thinks-list li::before { animation: none; }
.ovse-fold { width: 16px; height: 16px; margin-left: auto; color: var(--ovse-mute); transition: transform .2s; }
details[open] > summary > .ovse-fold { transform: rotate(180deg); }
.ovse-acts { border: 1px solid var(--ovse-line); background: var(--ovse-card); }
.ovse-acts-ic { display: inline-flex; flex: none; }
.ovse-acts-ic .ovse-g { width: 26px; height: 26px; padding: 5px; margin-right: -6px; border-radius: 50%; background: var(--bg-secondary, var(--ovse-bg)); border: 1px solid var(--ovse-line); color: var(--ovse-acc2); }
.ovse-acts-w { margin-left: 8px; color: var(--ovse-fg); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.ovse-acts-now, .ovse-acts-bad { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ovse-mute); font-size: 12.5px; }
.ovse-acts-bad { color: var(--danger, #ef4444); }
.ovse-acts.is-running .ovse-acts-now { color: var(--ovse-acc2); }
.ovse-acts-list { display: grid; gap: 2px; padding: 0 6px 8px; }
.ovse-tool { border-radius: 10px; animation: ovse-in .22s cubic-bezier(.2,.8,.2,1) both; }
.ovse-tool-h { display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 4px 8px; color: var(--ovse-dim); font-size: 13px; cursor: default; list-style: none; }
details.ovse-tool > .ovse-tool-h { cursor: pointer; } details.ovse-tool > .ovse-tool-h:hover { color: var(--ovse-fg); }
.ovse-tool-h .ovse-g { width: 15px; height: 15px; color: var(--ovse-mute); }
.ovse-tool-h span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
.ovse-tool-h small { color: var(--ovse-mute); font-size: 11.5px; font-variant-numeric: tabular-nums; }
.ovse-tool.is-failed .ovse-tool-h { color: var(--danger, #ef4444); } .ovse-bad { color: var(--danger, #ef4444) !important; }
.ovse-out { margin: 2px 8px 8px 31px; max-height: 280px; overflow: auto; font-size: 12px; }
.ovse-files, .ovse-made { display: grid; gap: 2px; padding: 6px; border-radius: 14px; border: 1px solid var(--ovse-line); background: var(--ovse-card); animation: ovse-in .3s cubic-bezier(.2,.8,.2,1) both; }
.ovse-files-h { display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-size: 13.5px; }
.ovse-files-h > b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovse-files-h .ovse-g { width: 16px; height: 16px; color: var(--ovse-acc2); }
.ovse-file { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 6px 8px; border: 0; border-radius: 10px; background: transparent; color: inherit; text-align: left; text-decoration: none; cursor: pointer; transition: background .15s; }
.ovse-file:hover { background: color-mix(in srgb, var(--ovse-fg) 6%, transparent); }
.ovse-file .ovse-g { width: 16px; height: 16px; color: var(--ovse-mute); }
.ovse-file-t { flex: 1; min-width: 0; display: grid; }
.ovse-file-t b, .ovse-file-t small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovse-file-t b { font-size: 13.5px; font-weight: 600; } .ovse-file-t small { color: var(--ovse-mute); font-size: 12px; }
.ovse-stat2 { display: inline-flex; gap: 6px; font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ovse-stat2 .is-add { color: var(--success-text, var(--success, #34d399)); font-style: normal; } .ovse-stat2 .is-del { color: var(--danger, #ef4444); font-style: normal; }
.ovse-files-more { height: 36px; border: 0; border-radius: 10px; background: transparent; color: var(--ovse-acc2); cursor: pointer; }
.ovse-child { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; padding: 8px 12px; border: 1px solid var(--ovse-line); border-radius: 14px; background: var(--ovse-card); text-align: left; cursor: pointer; transition: border-color .15s, transform .15s; animation: ovse-in .28s cubic-bezier(.2,.8,.2,1) both; }
.ovse-child:hover { border-color: color-mix(in srgb, var(--ovse-acc) 50%, var(--ovse-line)); } .ovse-child:active { transform: scale(.99); }
.ovse-child > span { flex: 1; min-width: 0; display: grid; } .ovse-child small { color: var(--ovse-mute); font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovse-child .ovse-g { color: var(--ovse-acc2); } .ovse-child.is-running > .ovse-g:first-child { animation: ovse-beat 1.4s ease-in-out infinite; }
.ovse-ask { display: grid; gap: 8px; padding: 12px 14px; border-radius: 16px; border: 1px solid color-mix(in srgb, var(--warning, #f5a524) 45%, var(--ovse-line)); background: color-mix(in srgb, var(--warning, #f5a524) 9%, var(--ovse-card)); animation: ovse-pop .34s cubic-bezier(.2,1.3,.4,1) both; }
.ovse-ask.is-done { border-color: var(--ovse-line); background: var(--ovse-card); } .ovse-ask .ovse-note { margin: 0; }
.ovse-ask-h { display: flex; align-items: center; gap: 8px; } .ovse-ask-h .ovse-g { color: var(--warning, #f5a524); }
.ovse-ask-acts { display: flex; flex-wrap: wrap; gap: 8px; }
.ovse-b { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 16px; border: 1px solid var(--ovse-line); border-radius: 12px; background: var(--ovse-card); font-weight: 600; cursor: pointer; text-decoration: none; color: inherit; transition: transform .15s, filter .15s; }
.ovse-b.is-primary { background: var(--ovse-acc); border-color: transparent; color: var(--on-accent, #fff); } .ovse-b:active { transform: scale(.97); } .ovse-b:disabled { opacity: .55; }
.ovse-mark { display: flex; align-items: center; gap: 10px; color: var(--ovse-mute); font-size: 12.5px; }
.ovse-mark::before, .ovse-mark::after { content: ''; flex: 1; height: 1px; background: var(--ovse-line); }
.ovse-sys { align-self: center; max-width: 90%; color: var(--ovse-mute); font-size: 12.5px; text-align: center; }
.ovse-working { display: flex; align-items: center; gap: 10px; min-height: 32px; color: var(--ovse-dim); font-size: 13.5px; animation: ovse-in .3s both; }
.ovse-working > span:last-child { background: linear-gradient(90deg, var(--ovse-dim), var(--ovse-fg), var(--ovse-dim)); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: ovse-shim 1.8s linear infinite; }
.ovse-dots { display: inline-flex; gap: 4px; } .ovse-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--ovse-acc2); animation: ovse-beat 1.2s ease-in-out infinite; } .ovse-dots i:nth-child(2) { animation-delay: .15s; } .ovse-dots i:nth-child(3) { animation-delay: .3s; }
.ovse-pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--ovse-acc2); flex: none; animation: ovse-beat 1.4s ease-in-out infinite; }
.ovse-note { margin: 8px 10px; color: var(--ovse-mute); font-size: 13px; } .ovse-note.is-err { color: var(--danger, #ef4444); }
.ovse-empty { display: grid; justify-items: center; gap: 6px; padding: 48px 16px; text-align: center; color: var(--ovse-dim); } .ovse-empty .ovse-g { width: 30px; height: 30px; color: var(--ovse-acc2); } .ovse-empty p { margin: 0; color: var(--ovse-mute); }

/* a new session */
.ovse.is-blank .ovse-thread { min-height: 100%; justify-content: center; }
.ovse-hello { display: grid; justify-items: center; gap: 8px; text-align: center; padding: 8px 8px 4px; animation: ovse-in .4s cubic-bezier(.2,.8,.2,1) both; }
.ovse-hello-face { display: inline-grid; place-items: center; width: 60px; height: 60px; border-radius: 22px; background: linear-gradient(140deg, var(--ovse-acc), var(--ovse-acc2)); color: var(--on-accent, #fff); box-shadow: 0 12px 40px color-mix(in srgb, var(--ovse-acc) 40%, transparent); animation: ovse-float 5s ease-in-out infinite; }
.ovse-hello-face .ovse-g { width: 30px; height: 30px; }
.ovse-hello-t { font-size: 24px; letter-spacing: -.01em; }
.ovse-hello-l { margin: 0; max-width: 46ch; color: var(--ovse-dim); }
.ovse-starters { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 8px; margin-top: 10px; }
.ovse-starter { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 10px 14px; border: 1px solid var(--ovse-line); border-radius: 16px; background: var(--ovse-card); text-align: left; cursor: pointer; animation: ovse-in .35s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(80ms + var(--i, 0) * 45ms); transition: border-color .15s, transform .15s; }
.ovse-starter:hover { border-color: color-mix(in srgb, var(--ovse-acc) 50%, var(--ovse-line)); transform: translateY(calc(-1px * var(--ov-move, 1))); }
.ovse-starter .ovse-g { color: var(--ovse-acc2); } .ovse-starter span { min-width: 0; }

/* the foot: the plan, the commands, the chip, the box */
.ovse-foot { position: relative; display: grid; gap: 6px; width: 100%; max-width: 852px; margin: 0 auto; padding: 6px 16px max(10px, env(safe-area-inset-bottom, 0px)); }
.ovse-plan { border: 1px solid var(--ovse-line); border-radius: 14px; background: var(--ovse-card); animation: ovse-in .3s both; }
.ovse-plan-h { display: flex; align-items: center; gap: 10px; min-height: 42px; padding: 6px 12px; cursor: pointer; list-style: none; font-size: 13.5px; }
.ovse-plan-h > b { flex: none; } .ovse-plan-now { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ovse-dim); }
.ovse-ring { --p: 0; width: 18px; height: 18px; flex: none; border-radius: 50%; background: conic-gradient(var(--success, #22c55e) calc(var(--p) * 360deg), color-mix(in srgb, var(--ovse-fg) 14%, transparent) 0); -webkit-mask: radial-gradient(circle, transparent 5px, #000 5.5px); mask: radial-gradient(circle, transparent 5px, #000 5.5px); }
.ovse-plan-list { display: grid; gap: 2px; max-height: 40vh; overflow-y: auto; margin: 0; padding: 0 12px 10px; list-style: none; font-size: 13.5px; }
.ovse-plan-list li { display: flex; align-items: flex-start; gap: 10px; padding: 4px 0; color: var(--ovse-dim); }
.ovse-plan-list li.is-done { color: var(--ovse-mute); } .ovse-plan-list li.is-done > span:last-child { text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--ovse-mute) 60%, transparent); }
.ovse-plan-list li.is-doing { color: var(--ovse-fg); font-weight: 600; }
.ovse-tick { display: inline-grid; place-items: center; width: 18px; height: 18px; margin-top: 1px; flex: none; border-radius: 6px; border: 1.6px solid color-mix(in srgb, var(--ovse-fg) 28%, transparent); }
.ovse-plan-list li.is-done .ovse-tick { background: var(--success, #22c55e); border-color: transparent; color: #fff; animation: ovse-pop .3s cubic-bezier(.2,1.4,.4,1) both; }
.ovse-plan-list li.is-doing .ovse-tick { border-color: var(--ovse-acc2); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ovse-acc) 25%, transparent); }
.ovse-tick .ovse-g { width: 13px; height: 13px; stroke-width: 2.6; }
.ovse-slash { position: absolute; left: 16px; right: 16px; bottom: calc(100% - 2px); z-index: 3; display: grid; gap: 2px; max-height: 320px; overflow-y: auto; padding: 6px; border-radius: 16px; border: 1px solid var(--ovse-line); background: var(--bg-elevated, var(--bg-secondary, #141a24)); box-shadow: 0 18px 50px rgba(0,0,0,.35); animation: ovse-pop .22s cubic-bezier(.2,1.2,.4,1) both; transform-origin: bottom left; }
.ovse-sl { display: grid; grid-template-columns: 20px auto minmax(0, 1fr); align-items: center; gap: 10px; min-height: 44px; padding: 6px 10px; border: 0; border-radius: 10px; background: transparent; text-align: left; cursor: pointer; }
.ovse-sl small { color: var(--ovse-mute); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovse-sl.is-on, .ovse-sl:hover { background: color-mix(in srgb, var(--ovse-acc) 16%, transparent); }
.ovse-sl .ovse-g { width: 17px; height: 17px; color: var(--ovse-acc2); }
.ovse-ctxrow { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ovse-ctx { display: inline-flex; align-items: center; gap: 7px; max-width: 100%; min-height: 34px; padding: 0 12px 0 9px; border: 1px solid var(--ovse-line); border-radius: 999px; background: var(--ovse-card); color: var(--ovse-dim); font-size: 13px; cursor: pointer; transition: border-color .15s, color .15s, transform .15s; }
.ovse-ctx span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.ovse-ctx .ovse-g { width: 15px; height: 15px; color: var(--ovse-acc2); }
.ovse-ctx:hover, .ovse-ctx.is-on { color: var(--ovse-fg); border-color: color-mix(in srgb, var(--ovse-acc) 45%, var(--ovse-line)); }
.ovse-ctx:active { transform: scale(.97); }
.ovse-cost { flex: none; color: var(--ovse-mute); font-size: 12.5px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ovse-ctxinfo { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ovse-mute); font-size: 12.5px; padding-left: 4px; }
.ovse-plainbox { display: flex; align-items: flex-end; gap: 8px; padding: 6px 6px 6px 14px; border-radius: 22px; border: 1px solid var(--ovse-line); background: var(--ovse-card); }
.ovse .ovse-plainbox textarea, .ovse .ovse-plainbox textarea:focus, .ovse .ovse-plainbox textarea:focus-visible { flex: 1; min-width: 0; resize: none; border: 0; background: transparent; color: inherit; font: inherit; padding: 8px 0; outline: 0; max-height: 40vh; caret-color: var(--ovse-acc); -webkit-appearance: none; appearance: none; border-radius: 0; box-shadow: none; margin: 0; }
.ovse-plainbox:focus-within { border-color: color-mix(in srgb, var(--ovse-acc) 55%, var(--ovse-line)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ovse-acc) 16%, transparent); }
.ovse-send { display: inline-grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 50%; background: var(--ovse-acc); color: var(--on-accent, #fff); cursor: pointer; }

/* sheets, the menu, a flash */
.ovse-veil { position: fixed; inset: 0; z-index: 2147482990; background: rgba(0,0,0,.45); opacity: 0; transition: opacity .2s; }
.ovse-veil.is-in { opacity: 1; }
.ovse-sheet { position: fixed; z-index: 2147482991; left: 0; right: 0; bottom: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); max-height: 86vh; border-radius: 22px 22px 0 0; background: var(--bg-elevated, var(--bg-secondary, #141a24)); color: var(--text-primary, #e6edf7); border: 1px solid var(--border, rgba(255,255,255,.09)); box-shadow: 0 -20px 60px rgba(0,0,0,.4); padding-bottom: env(safe-area-inset-bottom, 0px); transform: translateY(calc(100% * var(--ov-move, 1))); opacity: 0; transition: transform .32s cubic-bezier(.2,.9,.2,1), opacity .2s; font: 15px/1.5 var(--font-body, system-ui, sans-serif); }
.ovse-sheet.is-in { transform: none; opacity: 1; }
@media (min-width: 900px) { .ovse-sheet { left: auto; top: 0; bottom: 0; width: min(720px, 60vw); max-height: none; border-radius: 22px 0 0 22px; transform: translateX(calc(40px * var(--ov-move, 1))); } }
.ovse-sheet-h { display: flex; align-items: center; gap: 8px; padding: 10px 10px 8px 18px; border-bottom: 1px solid var(--border, rgba(255,255,255,.09)); }
.ovse-sheet-h b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovse-sheet .ovse-ib { display: inline-grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 12px; background: transparent; color: inherit; cursor: pointer; }
.ovse-sheet .ovse-g { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.ovse-sheet-b { overflow: auto; padding: 8px 10px 18px; }
.ovse-sheet .ovse-file { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 6px 8px; border: 0; border-radius: 10px; background: transparent; color: inherit; text-align: left; cursor: pointer; font: inherit; }
.ovse-sheet .ovse-file:hover { background: rgba(127,127,127,.12); }
.ovse-sheet .ovse-file-t { flex: 1; min-width: 0; display: grid; } .ovse-sheet .ovse-file-t b, .ovse-sheet .ovse-file-t small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ovse-sheet .ovse-file-t small { color: var(--text-muted, #93a0b4); font-size: 12px; }
.ovse-sheet .ovse-files-h { display: flex; align-items: center; gap: 8px; padding: 6px 8px; } .ovse-sheet .ovse-files-h b { flex: 1; } .ovse-sheet .ovse-files-h b.is-dim { color: var(--text-muted, #93a0b4); font-weight: 500; font-size: 13px; }
.ovse-sheet .ovse-stat2 { display: inline-flex; gap: 6px; font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; } .ovse-sheet .ovse-stat2 i { font-style: normal; }
.ovse-sheet .ovse-stat2 .is-add { color: var(--success-text, var(--success, #34d399)); } .ovse-sheet .ovse-stat2 .is-del { color: var(--danger, #ef4444); }
.ovse-diff { margin: 6px 0 0; border-radius: 12px; border: 1px solid var(--border, rgba(255,255,255,.09)); overflow-x: auto; overflow-y: auto; font: 12.5px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ovse-dl { display: grid; grid-template-columns: 22px max-content; min-width: 100%; padding-right: 12px; white-space: pre; }
.ovse-dl i { font-style: normal; text-align: center; color: var(--text-muted, #93a0b4); user-select: none; }
.ovse-dl.is-add { background: color-mix(in srgb, var(--success, #22c55e) 14%, transparent); } .ovse-dl.is-add i { color: var(--success-text, var(--success, #34d399)); }
.ovse-dl.is-del { background: color-mix(in srgb, var(--danger, #ef4444) 13%, transparent); } .ovse-dl.is-del i { color: var(--danger, #ef4444); }
.ovse-dl.is-hunk { display: block; padding: 4px 12px; color: var(--text-muted, #93a0b4); background: rgba(127,127,127,.08); }
.ovse-sheet .ovse-note { margin: 10px; color: var(--text-muted, #93a0b4); }
.ovse-mini { position: fixed; z-index: 2147482992; display: grid; min-width: 220px; padding: 6px; border-radius: 14px; background: var(--bg-elevated, #141a24); color: var(--text-primary, #e6edf7); border: 1px solid var(--border, rgba(255,255,255,.09)); box-shadow: 0 18px 50px rgba(0,0,0,.4); }
.ovse-mini-b { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 12px; border: 0; border-radius: 10px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ovse-mini-b:hover { background: rgba(127,127,127,.14); } .ovse-mini .ovse-g { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.ovse-flash { position: absolute; z-index: 6; left: 50%; bottom: 120px; transform: translateX(-50%); max-width: calc(100% - 32px); padding: 9px 16px; border-radius: 999px; background: var(--text-primary, #e6edf7); color: var(--bg-primary, #0b0f17); font-size: 13.5px; font-weight: 600; box-shadow: 0 10px 30px rgba(0,0,0,.3); animation: ovse-pop .26s cubic-bezier(.2,1.3,.4,1) both; transition: opacity .4s; }
.ovse-flash.is-out { opacity: 0; }

@keyframes ovse-in { from { opacity: 0; transform: translateY(calc(8px * var(--ov-move, 1))); } }
@keyframes ovse-pop { from { opacity: 0; transform: scale(.94); } }
@keyframes ovse-shim { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@keyframes ovse-beat { 0%, 100% { opacity: .45; transform: scale(.85); } 50% { opacity: 1; transform: scale(1); } }
@keyframes ovse-caret { 50% { opacity: 0; } }
@keyframes ovse-float { 50% { transform: translateY(calc(-4px * var(--ov-move, 1))); } }
.ovse-flash { animation-name: ovse-flash-in; } @keyframes ovse-flash-in { from { opacity: 0; transform: translate(-50%, 10px); } }
html[data-ov-motion="off"] .ovse *, html[data-ov-motion="off"] .ovse-sheet, html[data-ov-motion="off"] .ovse-veil, html[data-ov-motion="off"] .ovse-flash { animation: none !important; transition: none !important; }
.ovse-chg b { font-weight: 700; color: var(--ovse-fg); } .ovse-chg span { margin-left: -4px; }
@media (max-width: 899px) { .ovse-chg span { display: none; } .ovse-chg { padding: 0 10px; } }
`;
        const st = document.createElement('style'); st.id = 'ovse-styles'; st.textContent = css; document.head.appendChild(st);
    }

    root.OpenVibeSession = { mount, card, version: 1 };
})(typeof window !== 'undefined' ? window : globalThis);
