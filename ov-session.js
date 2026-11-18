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
    // 4.311.0 (the owner, 11-18: the Way sheet's letter tiles, "explain this better … more organized"): each way has its
    // own glyph and a group: an AI model answers (ai), another engine answers (other), or a coding agent works (code).
    const WAYS = [
        { id: 'auto', name: 'Auto', line: 'Actor picks: its agent for real work, one model for a quick answer', glyph: 'spark', group: 'ai' },
        { id: 'agent', name: 'Actor\'s agent', line: 'Plans, searches, uses tools, then checks its answer', glyph: 'robot', group: 'ai' },
        { id: 'model', name: 'One model', line: 'One quick answer from the model you pick: no tools, the cheapest', glyph: 'chat', group: 'ai' },
        { id: 'decisions', name: 'Decisions', line: 'Yes or no, pick one, rate it: and how sure it is', glyph: 'scale', group: 'ai' },
        { id: 'openai-agent', name: 'OpenAI agent', line: 'OpenAI\'s own agent, with its web search', glyph: 'globe', group: 'other' },
        { id: 'open-model', name: 'Open model', line: 'A small model on OpenVibe\'s own server: nothing leaves OpenVibe', glyph: 'lock', group: 'other' },
        // 4.296.0: a coding agent on your computer, through Codes, inside the same conversation (the Code mode).
        { id: 'harness', name: 'A coding agent', line: 'Claude Code, Codex and the rest on your computer, through Codes', glyph: 'term', group: 'code' },
    ];
    // 4.296.0 (the owner, 11-17: "the fully modular agentic system … even with the chat mode"; plan §AD.17): one session,
    // its mode on a switch. Chat is one model talking, Agent is your Actor working (plans, tools, a check), Code is a
    // coding agent; Auto lets the route choose.
    const MODES = [['auto', 'Auto', 'spark'], ['chat', 'Chat', 'chat'], ['agent', 'Agent', 'robot'], ['code', 'Code', 'code']];
    'use strict';
    if (typeof document === 'undefined' || root.OpenVibeSession) return;

    // ── glyphs (the registry's drawings; 24-unit strokes) ──
    const G = {
        speaker: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M15.6 9.3a3.9 3.9 0 0 1 0 5.4M18.4 6.7a7.6 7.6 0 0 1 0 10.6"/>',
        list: '<path d="M4 6.5h16M4 12h16M4 17.5h10"/>',
        coin: '<circle cx="12" cy="12" r="8.2"/><path d="M14.7 9.5c-.5-.8-1.5-1.3-2.7-1.3-1.5 0-2.6.8-2.6 1.9 0 2.6 5.3 1.5 5.3 4.1 0 1.1-1.1 2-2.7 2-1.2 0-2.3-.6-2.8-1.5M12 6.6v1.6M12 16.2v1.4"/>',
        tune: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
        sidebar: '<rect x="3" y="5.5" width="18" height="13" rx="1.6"/><rect class="ovse-sb-pane" x="4.7" y="7.2" width="4" height="9.6" rx=".7" fill="currentColor" stroke="none"/><path class="ovse-sb-line" d="M9.5 5.5v13"/>',
        back: '<path d="M20.8 12H4M10.3 5.7l-6.3 6.3l6.3 6.3"/>',
        more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        members: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c2.6-.2 4.8 1.3 5.5 4.3"/>',
        image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>',
        download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
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
        lock: '<rect x="5" y="10.6" width="14" height="9.4" rx="2.2"/><path d="M8.2 10.6V8a3.8 3.8 0 0 1 7.6 0v2.6"/>',
        columns: '<rect x="3.4" y="5" width="7.2" height="14" rx="1.8"/><rect x="13.4" y="5" width="7.2" height="14" rx="1.8"/>',
        scale: '<path d="M12 4.5v15M7 19.5h10M5.5 8h13M5.5 8l-2.6 5.6a2.8 2.8 0 0 0 5.2 0L5.5 8ZM18.5 8l-2.6 5.6a2.8 2.8 0 0 0 5.2 0L18.5 8Z"/>',
        chev: '<path d="m9.5 6 6 6-6 6"/>',
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
        // 4.294.0 (the owner, 11-17: "configure their own API keys, or … the coding harness … all the different methods work
        // interconnected"): your own AI key first (sealed in OpenVibe.AI, used instead of the free allowance), then your
        // computer (add-computer needs the page to come back to: it answered 400 without one), the coding agents, the
        // machines, and the sign-ins agents use.
        { id: 'keys', name: 'Your own AI key', line: 'Anthropic, OpenAI, OpenRouter, Gemini and more: sealed in OpenVibe.AI, used instead of the free allowance', url: 'https://openvibe.actor/chat/model' },
        { id: 'computer', name: 'Your computer', line: 'Add it with OpenVibe Link: coding agents and models run there, on your keys', url: 'https://openvibe.link/add-computer', back: true },
        { id: 'harnesses', name: 'Coding agents', line: 'Claude Code, Codex, OpenCode and the rest: installed and signed in where they run', url: 'https://openvibe.codes/setup' },
        { id: 'machines', name: 'Shared nodes and your computers', line: 'Where your sessions can run, and who else may use them', url: 'https://openvibe.link/machines' },
        { id: 'signins', name: 'Sign-ins for your agents', line: 'Kept sealed in Locker; an agent asks you before it uses one', url: 'https://openvibe.locker/passwords' },
    ];
    /** A setup page's address; the ones that send you back are told where to (this page). */
    // Your AI's words (4.297.0): a provider's name, a time today, short token counts, a key that answered its check.
    const KEY_NAMES = { openai: 'OpenAI', openrouter: 'OpenRouter', xai: 'xAI', deepseek: 'DeepSeek', minimax: 'MiniMax' };
    const keyName = (prov) => KEY_NAMES[prov] || String(prov || '').charAt(0).toUpperCase() + String(prov || '').slice(1);
    const atTime = (iso) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'midnight UTC'; };
    const shortN = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n));
    const keyOk = (k) => !k.status || /^(ok|ready|active|valid)$/i.test(k.status);
    // What an agent turn on the free AI takes, about (Actor's ACTOR_FREE_TURN_TOKENS; 11-17: 11,134 and 10,986 tokens).
    const TURN_TOKENS = 12000;
    const actorMay = (res, prov) => ((res && res.key_apps) || []).some((x) => x.service === 'actor' && (x.providers || []).some((q) => q === '*' || q === prov));
    // An answer's receipt (4.298.0, agents.step@1 1.3.0): the rungs in the order Actor tries them, a model's readable
    // name from its id ("claude-sonnet-5-5" reads "Claude Sonnet 5.5", "deepseek-chat" reads "DeepSeek Chat").
    const RUNGS = ['allowance', 'key', 'machine', 'plan', 'credits'];
    const RUNG_GLYPH = { allowance: 'spark', key: 'key', machine: 'computer', plan: 'tune', credits: 'coin' };
    const rungWord = (k, provider) => ({ allowance: 'Free AI', key: provider && provider !== 'machine' ? `Your ${keyName(provider)} key` : 'Your own key',
        machine: 'Your computer', plan: 'Your plan', credits: 'Your Balance' }[k] || k);
    const BRANDS = { deepseek: 'DeepSeek', openai: 'OpenAI', gpt: 'GPT', claude: 'Claude', gemini: 'Gemini', qwen: 'Qwen', llama: 'Llama', kimi: 'Kimi', glm: 'GLM', minimax: 'MiniMax', mistral: 'Mistral', grok: 'Grok', gemma: 'Gemma', phi: 'Phi', oss: 'OSS' };
    const modelName = (id) => {
        const bare = String(id || '').split('/').pop().replace(/:.*$/, '');
        if (!bare) return '';
        const parts = bare.split(/[-_ ]+/).filter(Boolean);
        const out = [];
        parts.forEach((w) => {
            const prev = out[out.length - 1];
            if (/^\d+$/.test(w) && prev && /^\d+(\.\d+)*$/.test(prev) && w.length <= 2) { out[out.length - 1] = `${prev}.${w}`; return; }
            out.push(BRANDS[w.toLowerCase()] || (/^v?\d/i.test(w) ? w.toUpperCase().replace(/^V/, 'V') : w.charAt(0).toUpperCase() + w.slice(1)));
        });
        return out.join(' ').replace(/^GPT (\d)/, 'GPT-$1').slice(0, 60);
    };
    const setupUrl = (x) => { if (!x || !x.url) return null; if (!x.back) return x.url; try { const u = new URL(x.url); u.searchParams.set('return_to', root.location.href); return u.href; } catch { return x.url; } };
    const setupGlyph = (id) => ({ keys: 'key', computer: 'computer', harnesses: 'code', machines: 'computer', signins: 'key', actor: 'robot' }[id] || 'link');
    /** The free AI allowance is spent (OpenVibe.AI's ai.allowance_spent, said through Exchange's 402). */
    /** The free AI is spent, in any of the ways a service says it (Actor's actor.budget.day_spent words included). */
    const isSpent = (t) => isAllowance(t) || /used today's free allowance|free allowance for today is spent|free AI allowance[^.]*is spent|actor\.budget\.day_spent/i.test(String(t || ''));
    /** How long until midnight UTC, when the free AI comes back: "4 h 12 min". */
    const backIn = () => { const now = Date.now(); const d = new Date(now); const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
        const min = Math.max(1, Math.round((next - now) / 60000)); const h = Math.floor(min / 60); const m = min % 60; return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`; };
    const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|heic|heif|bmp)$/i;
    /** A small preview of a picture (at most 480 px, JPEG), as a data: address every page's policy allows. */
    const previewOf = (file) => new Promise((done) => {
        try {
            if (!file || file.size > 25 * 1024 * 1024) return done(null);
            const r = new FileReader();
            r.onerror = () => done(null);
            r.onload = () => {
                const img = new Image();
                img.onerror = () => done(null);
                img.onload = () => {
                    try {
                        const k = Math.min(1, 480 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
                        const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
                        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                        done(c.toDataURL('image/jpeg', 0.82));
                    } catch { done(null); }
                };
                img.src = String(r.result || '');
            };
            r.readAsDataURL(file);
        } catch { done(null); }
    });
    // 4.313.0: how much an Actor conversation does on its own (Actor's four levels, plan §12 A-1), in a person's words.
    const LEVEL_WORDS = {
        ask: ['Asks first', 'It asks before every step that acts', 'lock'],
        'auto-edits': ['Edits on its own', 'Edits go ahead; anything else asks first', 'edit'],
        'approve-for-me': ['A reviewer approves', 'Another AI approves ordinary steps; when unsure, it asks you', 'check'],
        full: ['Full', 'It acts, then tells you what it did', 'spark'],
    };
    const LEVEL_ORDER = ['ask', 'auto-edits', 'approve-for-me', 'full'];
    const ALWAYS_WORDS = { money: 'spending money', password: 'a password', delete: 'deleting', new_recipient: 'a new recipient' };
    const isAllowance = (t) => /\bai\.allowance_spent\b|free AI allowance[^.]{0,80}\bspent\b|Exchange HTTP 402\b/i.test(String(t || ''));
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
    const STATUS = { planning: ['Starting', 'run'], running: ['Working', 'run'], waiting: ['Waiting for you', 'wait'], turn: ['Your turn', 'ok'], done: ['Done', 'ok'], failed: ['Did not finish', 'bad'], stopped: ['Stopped', 'off'] };
    const WAITING = { approval: 'It asks before it goes on', takeover: 'It needs you to take over a step', payment: 'It needs a payment to go on', message: '' };
    const isLive = (r) => !!r && ['planning', 'running'].includes(r.status);
    const isEnd = (r) => !!r && ['done', 'failed', 'stopped'].includes(r.status);
    const needsYou = (r) => !!r && r.status === 'waiting' && !!r.waiting && r.waiting.for && r.waiting.for !== 'message';
    // 4.295.0: an agent's task waiting for your answer (Actor's question). A chat is always your turn; that is not waiting.
    // 4.311.0 (the owner, 11-18: a group "stuck waiting for you even though it's not waiting"): a run whose turn is over
    // and waits for the next message is not asking anything; it is the person's turn, nothing more.
    // A task waiting for a message asked something (a clarifying question): that still needs the person.
    const yourTurn = (r) => !!r && r.status === 'waiting' && !!r.waiting && r.waiting.for === 'message' && r.kind !== 'task';
    const asksYou = (r) => !!r && r.status === 'waiting' && r.kind !== 'chat' && !needsYou(r) && !yourTurn(r);

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
    // 4.313.0: the web a group of steps touched: every site its inputs and results name, in order, at most 40.
    const WEBISH = /search_web|search_sites|read_page|read_pages|fetch_data|web|fetch|browse|navigate|wikipedia/i;
    const sitesOf = (steps) => {
        const out = new Map();
        const add = (u) => { try { const host = new URL(String(u)).hostname.replace(/^www\./, ''); if (host && /\./.test(host) && !out.has(host)) out.set(host, true); } catch { /* not an address */ } };
        for (const s of steps) {
            if (out.size >= 40) break;
            const i = inputOf(s);
            if (i.url) add(i.url);
            if (Array.isArray(i.urls)) i.urls.slice(0, 20).forEach(add);
            let blob = '';
            try { blob = typeof s.result === 'string' ? s.result : JSON.stringify(s.result || ''); } catch { blob = ''; }
            for (const m of `${blob} ${s.text || ''}`.slice(0, 60000).matchAll(/https:\/\/[a-z0-9.-]+\.[a-z]{2,}(?=[/\s"'?#)\]]|$)/gi)) { add(m[0]); if (out.size >= 40) break; }
        }
        return [...out.keys()];
    };
    const siteHue = (host) => { let h = 0; for (const c of host) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
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
    /**
     * 4.310.0 (the owner's phone, 11-18: the same "Assumptions: …; … Now 1. … · 2. …" as a raw Thought block on every
     * turn): Actor's plan text (runtime/loop.js planText: an "Assumptions:" line, then "✓ 1. goal" / "Now 2. goal" /
     * "· 3. goal") is a plan. It leaves the thread, and the one plan panel shows the newest: a checklist, its assumptions
     * folded under it. → the items (with .assumptions), or null.
     */
    function actorPlan(text) {
        const t = String(text || '');
        if (!/(?:^|\n|\s)(?:✓|Now|·)\s+\d{1,2}\.\s/.test(t)) return null;
        const lines = t.split('\n').flatMap((l) => l.split(/\s(?=(?:✓|Now|·)\s+\d{1,2}\.\s)/));
        const items = [];
        let assumptions = [];
        for (const raw of lines) {
            const l = raw.trim();
            const a = /^Assumptions:\s*(.*)$/i.exec(l);
            if (a) { assumptions = a[1].split(/;\s+/).map((x) => x.replace(/[.;]+$/, '').trim()).filter(Boolean).slice(0, 8); continue; }
            const m = /^(✓|Now|·)\s+\d{1,2}\.\s+(.*)$/.exec(l);
            if (m) items.push({ text: m[2].trim().slice(0, 300), state: m[1] === '✓' ? 'done' : m[1] === 'Now' ? 'doing' : 'todo' });
        }
        if (!items.length) return null;
        items.assumptions = assumptions;
        return items;
    }
    function planOf(s) {
        let items = null;
        if (s.kind === 'think' && !s.ui && typeof s.text === 'string') { const ap = actorPlan(s.text); if (ap) return ap; }
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
            // 4.310.0 (11-18: tables showed as raw "| a | b |" lines run together): a GitHub table, scrolling in its own box.
            if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
                flush(); list = null;
                const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
                const head = cells(line);
                const wrap = el('div', 'ovse-table'); const table = el('table'); const thead = el('thead'); const tr = el('tr');
                head.forEach((c) => tr.append(inline(el('th'), c, sources))); thead.append(tr); table.append(thead);
                const tbody = el('tbody');
                i += 1;
                while (i + 1 < lines.length && /^\s*\|.*\|\s*$/.test(lines[i + 1])) {
                    i += 1;
                    const row = el('tr'); const cs = cells(lines[i]);
                    head.forEach((_, n) => row.append(inline(el('td'), cs[n] || '', sources)));
                    tbody.append(row);
                }
                table.append(tbody); wrap.append(table); box.append(wrap);
                continue;
            }
            if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flush(); list = null; box.append(el('hr', 'ovse-hr')); continue; }
            const q = /^\s*>\s?(.*)$/.exec(line);
            if (q) { flush(); list = null; box.append(inline(el('blockquote', 'ovse-quote'), q[1], sources)); continue; }
            const h = /^(#{1,4})\s+(.*)$/.exec(line);
            if (h) { flush(); list = null; box.append(inline(el('p', `ovse-h is-h${h[1].length}`), h[2], sources)); continue; }
            const cb = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line);
            if (cb) {
                flush();
                if (!list || list.tagName.toLowerCase() !== 'ul') { list = el('ul', 'ovse-checks'); box.append(list); }
                const item = inline(el('li', cb[1].trim() ? 'is-done' : ''), cb[2], sources); list.append(item);
                continue;
            }
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

    /** An agent's face (4.318.0): ov-face.js draws it, the one face system openvibe.chat/vibe draws with too (the owner,
     *  11-18: "These should share the same universal shared system so they both have the faces"). Painted now, or as
     *  soon as ov-face.js arrives; until then the tile of the agent's colour. */
    const facesWaiting = [];
    function faceInto(o, f, spec) {
        const specOf = (F, x) => (typeof x === 'function' ? x(F) : x);
        if (root.OVFace) return root.OVFace.paint(f, specOf(root.OVFace, spec));
        facesWaiting.push([f, spec]);
        need(o, 'ov-face.js', 'OVFace').then((F) => { if (F) facesWaiting.splice(0).forEach(([g, x]) => F.paint(g, specOf(F, x))); });
        return f;
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
        if (!root.OVFace) need(o, 'ov-face.js', 'OVFace');
        const actorFaces = [];   // faces drawn before your Actor loaded: painted again with its face when it does
        styles();
        const base = String(o.base || 'https://openvibe.network/api/frame').replace(/\/+$/, '');
        const tokenOf = () => (typeof o.token === 'function' ? o.token() : o.token) || '';
        const headers = () => { const t = tokenOf(); return t ? { Authorization: `Bearer ${t}` } : {}; };
        const api = async (path, init = {}) => {
            const r = await fetch(`${base}${path}`, { ...init, credentials: 'omit', headers: { Accept: 'application/json', ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...headers(), ...(init.headers || {}) } });
            const j = await r.json().catch(() => ({}));
            // 4.311.0: a problem+json answer says it in `detail` (Actor's day_spent, through any Frame that passes it on).
            if (!r.ok) { const e = new Error((typeof j.error === 'string' && j.error) || j.detail || j.message || `It did not answer (${r.status})`); e.status = r.status; e.code = j.code; throw e; }
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
        const wayBody = () => (pick.way && pick.way !== 'auto' ? { kind: pick.way, ...(pick.model && ['agent', 'model', 'decisions'].includes(pick.way) ? { model: pick.model.id } : {}),
            ...(pick.way === 'harness' && pick.harness ? { harness: pick.harness } : {}) } : null);
        let options = null;   // the Frame's /run-options: { agents, places }
        // The Frame's /resources (4.297.0, plan §AD.17): the free AI left, your keys and who may use them, your Balance.
        // One read for the road chip and Your AI, kept a minute; 'old' from a Network without it; null when it failed.
        let resources = null, resourcesAt = 0, resourcesWait = null;
        function loadResources(fresh) {
            if (!tokenOf()) return Promise.resolve(null);
            if (!fresh && resourcesAt && Date.now() - resourcesAt < 60000) return Promise.resolve(resources);
            if (resourcesWait) return resourcesWait;
            resourcesWait = fetch(`${base}/resources`, { credentials: 'omit', headers: { Accept: 'application/json', ...headers() } })
                .then((r) => (r.ok ? r.json() : r.status === 404 ? 'old' : null)).catch(() => null)
                .then((x) => { resources = x; resourcesAt = Date.now(); resourcesWait = null; if (typeof paintRoad === 'function') paintRoad(); return x; });
            return resourcesWait;
        }
        const fallbackOptions = { agents: [{ id: 'auto', name: 'Auto', line: 'The right one for what you ask', kind: 'auto' }, { id: 'actor', name: 'Actor', line: 'Your agent: answers, searches, does things for you', kind: 'actor' }, { id: 'codes', name: 'Codes', line: 'Writes and changes code', kind: 'codes' }], places: [{ kind: 'auto', name: 'Auto', line: 'Wherever it fits best' }, { kind: 'openvibe', name: 'OpenVibe', line: 'OpenVibe\'s own computers' }] };
        const loadOptions = async () => {
            if (options) return options;
            try { const d = await api('/run-options'); if (d && Array.isArray(d.agents) && Array.isArray(d.places)) options = d; } catch { /* the short list stands */ }
            return options || fallbackOptions;
        };
        let models = null;   // the Frame's /choices?task=agent: { recommended, groups: [{ id, title, rows }] }
        // The models a person can pick (4.305.0): asked once, shared by every open of the picker, and kept ten minutes in
        // this tab's sessionStorage so the next page opens it with no wait; fetched while the page is idle, so the first
        // open usually has it already. A second ask while one is under way waits for that one.
        const MODELS_KEY = 'ovse-models-v1';
        let modelsAsk = null;
        const loadModels = () => {
            if (models) return Promise.resolve(models);
            if (!modelsAsk) {
                try {
                    const kept = JSON.parse(sessionStorage.getItem(MODELS_KEY) || 'null');
                    if (kept && kept.at > Date.now() - 10 * 60_000 && kept.d && Array.isArray(kept.d.groups)) { models = kept.d; return Promise.resolve(models); }
                } catch { /* no storage here */ }
                modelsAsk = api('/choices?task=agent').then((d) => {
                    if (d && Array.isArray(d.groups)) {
                        models = d;
                        try { sessionStorage.setItem(MODELS_KEY, JSON.stringify({ at: Date.now(), d })); } catch { /* full or off */ }
                    }
                    return models || { groups: [] };
                }, () => ({ groups: [] })).finally(() => { modelsAsk = null; });
            }
            return modelsAsk;
        };
        try {
            const soon = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
            soon(() => { loadModels(); }, { timeout: 4000 });
        } catch { /* the picker asks when it opens */ }

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
            const face = faceInto(o, el('span', 'ovse-codes-face'), { codes: true });
            const t = el('span', 'ovse-actor-t');
            const top = el('span', 'ovse-actor-top'); top.append(el('b', '', 'Codes'), el('i', '', 'your coding agent'));
            t.append(top, el('small', '', 'On a shared node or your computer · openvibe.codes'));
            who.append(face, t);
            who.addEventListener('click', () => { pick.agent = 'codes'; if (pick.where === 'openvibe') pick.where = 'auto'; savePick(); blank(); if (!wide) setDrawer(false); });
            // 4.294.0 (the owner, 11-17: "the icon is really huge on codes … not consistent"): Set up, the size of Actor's
            // own buttons; openvibe.codes is one of its setup rows.
            const tune = btn('ovse-ib ovse-actor-set', 'Set up Codes: its coding agent, model and where it runs', 'tune');
            tune.addEventListener('click', () => setupFor('codes'));
            codesSlot.append(who, tune);
        }
        const topSlot = el('div', 'ovse-top'); topSlot.hidden = true;
        // The page's own box searches the sessions (the menu, 4.284.0: "the search can be moved up there and use the icon
        // system … so we can save the space"): the drawer's field stays out.
        if (o.searchOutside) find.hidden = true;
        // 4.296.0 (the owner, 11-17: "a menu that brings them to set up their agents and their harnesses and their API keys,
        // or to enable billing"): Your AI, one row under your agents.
        const aiSlot = el('div', 'ovse-actor ovse-ai-row');
        {
            const who = el('button', 'ovse-actor-who'); who.type = 'button'; who.setAttribute('aria-label', 'Your AI: your agents, coding agents, keys, Balance and computers');
            const face = el('span', 'ovse-ai-face'); face.append(svg('tune'));
            const t = el('span', 'ovse-actor-t');
            const top = el('span', 'ovse-actor-top'); top.append(el('b', '', 'Your AI'), el('i', '', 'set up'));
            t.append(top, el('small', '', 'Agents, coding agents, keys, Balance, computers'));
            who.append(face, t, svg('fold', 'ovse-ai-go'));
            who.addEventListener('click', () => yourAI());
            aiSlot.append(who);
        }
        // 4.317.0 (the owner's phone, 11-18: Actor, Codes and Your AI filled the screen above the sessions, "make it
        // collapse"): your agents fold into one row of three, face and name, each doing what its card does; the chevron
        // opens the full cards (settings, pause, today's spend) and the choice is kept on this device.
        const agents = el('div', 'ovse-agents');
        const foldB = btn('ovse-ib ovse-agents-fold', 'Show your agents in full', 'fold');
        let agentsOpen = false;
        try { agentsOpen = localStorage.getItem('ovse-agents-open') === '1'; } catch { /* private mode: folded */ }
        const paintAgents = () => {
            agents.classList.toggle('is-folded', !agentsOpen);
            foldB.setAttribute('aria-expanded', String(agentsOpen));
            const label = agentsOpen ? 'Fold your agents into one row' : 'Show your agents in full';
            foldB.setAttribute('aria-label', label); foldB.title = label;
        };
        foldB.addEventListener('click', () => {
            agentsOpen = !agentsOpen;
            try { localStorage.setItem('ovse-agents-open', agentsOpen ? '1' : '0'); } catch { /* */ }
            agents.classList.add('is-turning'); setTimeout(() => agents.classList.remove('is-turning'), 320);
            paintAgents();
        });
        agents.append(actorSlot, codesSlot, aiSlot, foldB);
        paintAgents();
        drawer.append(dHead, agents, topSlot, find, runsBox);

        const main = el('section', 'ovse-main');
        const head = el('header', 'ovse-head');
        const menuB = btn('ovse-ib ovse-menu', 'Your sessions', 'sidebar'); menuB.setAttribute('aria-controls', drawer.id);
        const backB = btn('ovse-ib ovse-up', 'Back to the session it helps', 'back'); backB.hidden = true;
        const faceSlot = el('span', 'ovse-face-slot');
        const who = el('div', 'ovse-who'); const titleN = el('b', 'ovse-title'); const statN = el('small', 'ovse-stat'); who.append(titleN, statN);
        // 4.306.0: what the session used, in the status line, is a button: the Usage sheet.
        const useB = el('button', 'ovse-stat-use'); useB.type = 'button'; useB.hidden = true;
        useB.addEventListener('click', () => usageSheet('session'));
        const changesB = btn('ovse-chg', 'What it changed', 'file'); changesB.append(el('b'), el('span')); changesB.hidden = true;
        const moreB = btn('ovse-ib ovse-more', 'More', 'more'); moreB.setAttribute('aria-haspopup', 'dialog');
        // 4.308.0: reading aloud. The speaker shows while answers are read aloud; it moves while it reads, and a tap stops.
        const speakB = btn('ovse-ib ovse-speak', 'Read aloud', 'speaker'); speakB.hidden = true;
        head.append(menuB, backB, faceSlot, who, changesB, speakB, moreB);
        const body = el('div', 'ovse-body');
        const thread = el('div', 'ovse-thread'); thread.setAttribute('role', 'log'); thread.setAttribute('aria-live', 'polite');
        // Group conversations (4.302.0, plan §AD.19): a group is a run (`group:<id>`) of people and agents; its bar says who
        // is in it (each agent's @handle and the harness it works through), opens the shared space and adds members.
        const groupBar = el('div', 'ovse-gbar'); groupBar.hidden = true;
        body.append(groupBar, thread);
        const foot = el('div', 'ovse-foot');
        const planBox = el('details', 'ovse-plan'); planBox.hidden = true;
        const slash = el('div', 'ovse-slash'); slash.hidden = true; slash.setAttribute('role', 'listbox');
        const mentionRow = el('div', 'ovse-mention'); mentionRow.hidden = true; mentionRow.setAttribute('role', 'listbox'); mentionRow.setAttribute('aria-label', 'Who to ask');
        const ctxRow = el('div', 'ovse-ctxrow');
        const ctxB = btn('ovse-ctx', 'How it runs: change it', 'spark', ''); ctxB.setAttribute('aria-haspopup', 'dialog');
        const ctxInfo = el('span', 'ovse-ctxinfo');
        // The price before it runs (plan §AD.6): a chosen model's typical message, from its own price.
        const ctxCost = el('span', 'ovse-cost'); ctxCost.hidden = true;
        const modes = el('div', 'ovse-modes'); modes.setAttribute('role', 'radiogroup'); modes.setAttribute('aria-label', 'Mode');
        MODES.forEach(([id, label, glyph]) => {
            const m = btn('ovse-mode', null, glyph, label); m.dataset.mode = id; m.setAttribute('role', 'radio');
            m.addEventListener('click', () => setMode(id));
            modes.append(m);
        });
        // The road (4.297.0, plan §AD.17): where the next answer goes before it is sent: the free AI with what is left,
        // your own key, your computer, or nothing left today (then it opens Your AI on the ways).
        const road = btn('ovse-road', 'Where your next answer runs', null, ''); road.hidden = true;
        { const ring = el('i', 'ovse-road-ring'); ring.append(svg('spark')); road.append(ring, el('span')); }
        road.addEventListener('click', () => yourAI());
        // 4.311.0: what Actor runs on, said and changed in one place (an API model, or a coding harness on a machine).
        // 4.311.0 (the owner, 11-18: the row wrapped, two chips said the same): one chip, on one line, opens the sheet.
        // 4.313.0: the conversation's approval level, beside the chip (an open Actor conversation that can set it).
        const levelB = btn('ovse-level', 'How much it does on its own: change it', 'lock', ''); levelB.hidden = true; levelB.setAttribute('aria-haspopup', 'dialog');
        if (!levelB.querySelector('span')) levelB.append(el('span'));
        levelB.addEventListener('click', () => levelSheet());
        ctxRow.append(modes, ctxB, levelB, road, ctxCost, ctxInfo);
        const composeSlot = el('div', 'ovse-compose');
        foot.append(planBox, slash, mentionRow, ctxRow, composeSlot);
        composeSlot.addEventListener('input', () => { if (groupId()) paintMentions(); else if (!mentionRow.hidden) mentionRow.hidden = true; });
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
            f.style.setProperty('--ovse-h', String(Number.isFinite(Number(a.hue)) ? Number(a.hue) : hueOf(a.id || a.name || (run && run.kind))));
            // As on Chat's Vibe: your Actor's sessions wear its face, Codes' its terminal, any other agent its own blob.
            const spec = (F) => {
                let mine = false;
                try { mine = !!o.actor && F.isYours(run, actorName()); } catch { mine = false; }
                return mine ? { ...F.forActor(actor, actorName()), working: !!(run && run.status === 'running') } : F.forRun(run);
            };
            let known = true;
            try { known = !o.actor || !!actor; } catch { known = false; }
            if (!known) actorFaces.push([f, spec]);
            return faceInto(o, f, spec);
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
        /** The menu's button said something waits and was tapped (navbar.js, 4.295.0): open it, once. */
        function openWaiting() {
            const at = Number(root.__ovNeedsYou) || 0;
            if (!at || Date.now() - at > 15000 || state.ref) return;
            const r = state.runs.find((x) => needsYou(x) || asksYou(x));
            if (!r) return;
            root.__ovNeedsYou = 0;
            if (r.action) { if (!wide) setDrawer(true); return; }
            state.stack = []; open(r.ref || r.id, r); if (!wide) setDrawer(false);
        }
        function paintRuns() {
            runsBox.textContent = '';
            if (!state.runs.length) { runsBox.append(el('p', 'ovse-note', state.q ? 'Nothing matches.' : 'No sessions yet. Start one with the box.')); return; }
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const groups = [['Needs you', []], ['Working', []], ['Today', []], ['Earlier', []]];
            for (const r of state.runs) {
                const g = needsYou(r) || asksYou(r) ? 0 : isLive(r) ? 1 : ms(r.updated_at || r.created_at) >= today.getTime() ? 2 : 3;
                groups[g][1].push(r);
            }
            let i = 0;
            for (const [name, rows] of groups) {
                if (!rows.length) continue;
                runsBox.append(el('p', 'ovse-group', name));
                for (const r of rows) runsBox.append(runRow(r, i++));
            }
            if (state.partial.length) runsBox.append(el('p', 'ovse-note', `Some sessions did not load: ${state.partial.slice(0, 3).join(', ')}.`));
            openWaiting();
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
                    } catch (err) { [...box.querySelectorAll('button')].forEach((x) => { x.disabled = false; }); errorNote(box, err); }
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
            const b = el('button', `ovse-row${ref === state.ref ? ' is-on' : ''}${needsYou(r) || asksYou(r) ? ' is-needs' : ''}${isLive(r) ? ' is-live' : ''}`); b.type = 'button';
            b.style.setProperty('--i', String(Math.min(i, 12)));
            const t = el('span', 'ovse-row-t');
            const top = el('span', 'ovse-row-top'); top.append(el('b', '', titleOf(r)), el('small', '', ago(r.updated_at || r.created_at)));
            let line = needsYou(r) ? WAITING[r.waiting.for] || 'Needs you' : (r.doing && r.doing.text) || (r.preview && r.preview.text) || r.preview || r.result_summary || (STATUS[r.status] || [''])[0];
            if (isAllowance(line)) line = 'Free AI used up for today: set up your own';
            else if (asksYou(r)) line = 'Waiting for your answer';
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
            if (actor) actorFaces.splice(0).forEach(([f, spec]) => { if (f.isConnected) faceInto(o, f, spec); });
            return actor;
        }
        function actorFace(size) {
            const st = actorState();
            const f = el('span', `ovse-face is-${size} ovse-me-face is-${st}`);
            const hue = actor && actor.avatar && actor.avatar.blob && Number.isInteger(actor.avatar.blob.hue) ? actor.avatar.blob.hue : hueOf(actorName());
            f.style.setProperty('--ovse-h', String(hue));
            return faceInto(o, f, (F) => ({ ...F.forActor(actor, actorName()), working: st === 'working' }));
        }
        // 4.294.0 (the owner, 11-17: "when I choose codes, it brings me to a thing that still has the A from actor, and then
        // it says vibe … switching to actor doesn't work"): the agent a new session goes to is the one the panel shows,
        // its face, its name and its hello, and its row in the sessions is marked.
        function chosen() {
            const a = pick.agent || 'auto';
            if (a === 'actor') return { id: 'actor', kind: 'actor', name: actorName(), line: 'your agent' };
            if (a === 'codes') return { id: 'codes', kind: 'code', name: 'Codes', line: 'your coding agent' };
            // Auto: your Actor answers, and code goes to Codes, so with an Actor its face greets you.
            if (a === 'auto') return { id: 'auto', kind: o.actor ? 'actor' : 'auto', name: o.title || 'New session', line: 'the right agent for what you ask' };
            const x = ((options || fallbackOptions).agents || []).find((y) => y.id === a);
            return { id: a, kind: x && x.kind === 'actor' ? 'actor' : 'code', name: x ? x.name : a, line: (x && x.line) || 'a coding agent' };
        }
        function chosenFace(size) {
            const c = chosen();
            if (c.kind === 'actor' && o.actor && actor) return actorFace(size);
            const f = el('span', `ovse-face is-${size} ovse-agent-face is-${c.kind}`);
            if (c.kind === 'auto') { f.append(svg('spark')); return f; }
            // Codes and the coding agents it runs wear Codes' terminal; an Actor not loaded yet, its name's blob.
            return faceInto(o, f, (F) => (c.kind === 'actor' ? F.forActor(null, c.name) : F.codes()));
        }
        function markChosen() {
            const a = pick.agent || 'auto';
            const harness = a !== 'actor' && a !== 'auto' && a !== 'codes' && chosen().kind === 'code';
            [[actorSlot, a === 'actor'], [codesSlot, a === 'codes' || harness]].forEach(([slot, on]) => {
                slot.classList.toggle('is-on', on);
                const w = slot.querySelector('.ovse-actor-who'); if (w) w.setAttribute('aria-pressed', String(on));
            });
        }
        /** Set an agent up: it becomes the new session's, and How it runs opens on it (harness, model, where, your setup). */
        function setupFor(agent) {
            pick.agent = agent; if (agent === 'codes' && pick.where === 'openvibe') pick.where = 'auto';
            savePick(); blank(); if (!wide) setDrawer(false);
            setTimeout(() => openCtx(), 260);
        }
        /** Your agent, edited in place (4.295.0; the owner, 11-17: "you can't even edit these properly, or like edit and
         *  configure them easily"): its name, its picture (one of yours to wear, or three drawn from a few words in a
         *  style), Pause or Resume, how it runs and your own setup, and Actor's site for its rules. The Frame relays each
         *  part (PATCH /actor, GET /actor/pictures, POST /actor/pictures/generate, POST /actor/face). */
        function agentSheet() {
            sheet(`${actorName()}, your agent`, (b, { end, title }) => {
                const json = () => ({ Accept: 'application/json', 'Content-Type': 'application/json', ...headers() });
                const call = async (path, method, body) => {
                    const r = await fetch(`${base}${path}`, { method, credentials: 'omit', headers: json(), ...(body ? { body: JSON.stringify(body) } : {}) });
                    const j = await r.json().catch(() => ({}));
                    if (!r.ok) throw new Error(j.detail || j.error || j.title || `That did not go through (${r.status})`);
                    return j;
                };
                const note = el('p', 'ovse-ag-note'); note.setAttribute('role', 'status');
                const fresh = async () => { actorAt = 0; await loadActor(); paintActor(); faceBox.textContent = ''; faceBox.append(actorFace('xl')); title.textContent = `${actorName()}, your agent`; if (!state.run) { paintHead(); } };
                // Its face and name
                const top = el('div', 'ovse-ag-top');
                const faceBox = el('span', 'ovse-ag-face'); faceBox.append(actorFace('xl'));
                const nameRow = el('div', 'ovse-ag-namerow');
                const nameIn = el('input', 'ovse-ag-name'); nameIn.type = 'text'; nameIn.maxLength = 80; nameIn.value = actorName(); nameIn.spellcheck = false; nameIn.setAttribute('aria-label', 'Your agent\'s name');
                const save = btn('ovse-ag-save', 'Save the name', 'check', 'Save'); save.hidden = true;
                nameIn.addEventListener('input', () => { const v = nameIn.value.trim(); save.hidden = !(v && v !== actorName()); });
                nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!save.hidden) save.click(); } });
                save.addEventListener('click', async () => {
                    save.disabled = true; note.textContent = 'Saving…';
                    try { await call('/actor', 'PATCH', { name: nameIn.value.trim().slice(0, 80) }); await fresh(); save.hidden = true; note.textContent = 'Saved: that is its name everywhere now.'; }
                    catch (err) { note.textContent = err.message; }
                    finally { save.disabled = false; }
                });
                nameRow.append(nameIn, save);
                const st = actorState(); const now = (actor && actor.now) || {};
                const cap = actor && actor.caps && Number(actor.caps.usd) > 0 ? ` of $${Number(actor.caps.usd).toFixed(2)}` : '';
                const line = el('small', 'ovse-ag-line', [ACTOR_WORD[st], `$${(Number(now.cost_today) || 0).toFixed(2)}${cap} today`].filter(Boolean).join(' · '));
                const tt = el('div', 'ovse-ag-tt'); tt.append(nameRow, line);
                top.append(faceBox, tt);
                b.append(top);
                // Pause or Resume, and how it runs
                const acts = el('div', 'ovse-ag-acts');
                if (actor && actor.id) {
                    const paused = st === 'paused';
                    const go = btn('ovse-ag-btn', paused ? `Resume ${actorName()}` : `Pause ${actorName()}`, paused ? 'play' : 'pause', paused ? 'Resume' : 'Pause');
                    go.addEventListener('click', async () => {
                        go.disabled = true;
                        try { await call(`/actor/${paused ? 'resume' : 'pause'}`, 'POST', {}); end(); actorAt = 0; loadActor().then(paintActor); }
                        catch (err) { note.textContent = err.message; go.disabled = false; }
                    });
                    acts.append(go);
                }
                const how = btn('ovse-ag-btn is-main', 'How it runs: the model, the way, where and the effort', 'tune', 'How it runs');
                how.addEventListener('click', () => { end(); setTimeout(() => setupFor('actor'), 240); });
                acts.append(how);
                b.append(acts, note);
                // Its picture: one of yours, or three new ones
                const pics = el('section', 'ovse-ag-sec'); pics.hidden = true;
                const row = el('div', 'ovse-ag-pics'); row.setAttribute('role', 'radiogroup'); row.setAttribute('aria-label', 'Your pictures');
                const draw = el('form', 'ovse-ag-draw'); draw.setAttribute('aria-label', 'Draw new pictures');
                const words = el('input', 'ovse-ag-words'); words.type = 'text'; words.maxLength = 200; words.placeholder = 'A calm fox in a hoodie'; words.setAttribute('aria-label', 'Describe the picture'); words.enterKeyHint = 'go';
                const styles = el('div', 'ovse-ag-styles'); styles.setAttribute('role', 'radiogroup'); styles.setAttribute('aria-label', 'Style');
                const drawGo = btn('ovse-ag-btn is-main', 'Draw three pictures', 'spark', 'Draw three'); drawGo.type = 'submit';
                draw.append(words, styles, drawGo);
                pics.append(el('b', 'ovse-ag-h', 'Picture'), row, draw);
                b.append(pics);
                let list = [], style = 'openvibe';
                const worn = () => (actor && actor.avatar && typeof actor.avatar.face === 'string' ? actor.avatar.face : null);
                const paintPics = () => {
                    row.textContent = '';
                    list.slice(0, 8).forEach((pp) => {
                        const on = pp.id === worn();
                        const c = el('button', 'ovse-ag-pic'); c.type = 'button'; c.setAttribute('role', 'radio'); c.setAttribute('aria-checked', String(on));
                        c.setAttribute('aria-label', on ? 'Wearing this picture' : 'Wear this picture');
                        const i = el('img'); i.src = pp.url; i.alt = ''; i.loading = 'lazy'; i.decoding = 'async'; c.append(i);
                        c.addEventListener('click', async () => {
                            if (on) return;
                            note.textContent = 'Putting it on…';
                            try { await call('/actor/face', 'POST', { face: pp.id }); await fresh(); paintPics(); note.textContent = ''; }
                            catch (err) { note.textContent = err.message; }
                        });
                        row.append(c);
                    });
                    row.hidden = !row.childElementCount;
                };
                draw.addEventListener('submit', async (e) => {
                    e.preventDefault(); if (drawGo.disabled) return;
                    drawGo.disabled = true; note.textContent = 'Drawing three pictures…';
                    const mark = root.OVMark && typeof root.OVMark.busy === 'function' ? (() => { try { return root.OVMark.busy(drawGo); } catch { return null; } })() : null;
                    try {
                        const j = await call('/actor/pictures/generate', 'POST', { name: actorName(), description: words.value.trim().slice(0, 200) || undefined, style, n: 3 });
                        const got = (Array.isArray(j.faces) ? j.faces : []).filter((x) => x && httpsUrl(x.url));
                        list = got.concat(list.filter((x) => !got.some((n) => n.id === x.id)));
                        paintPics();
                        note.textContent = `Three new pictures${Number(j.cost_usd) > 0 ? ` · $${Number(j.cost_usd).toFixed(2)}` : ''}: tap one to wear it.`;
                        if (mark && mark.done) mark.done();
                    } catch (err) { note.textContent = err.message; if (mark && mark.fail) mark.fail(); }
                    finally { drawGo.disabled = false; }
                });
                fetch(`${base}/actor/pictures`, { credentials: 'omit', headers: { Accept: 'application/json', ...headers() } })
                    .then((r) => (r.ok ? r.json() : null)).then((j) => {
                        if (!j || !pics.isConnected) return;
                        list = Array.isArray(j.faces) ? j.faces.filter((x) => x && httpsUrl(x.url)) : [];
                        (Array.isArray(j.styles) && j.styles.length ? j.styles : [{ id: 'openvibe', name: 'OpenVibe' }]).slice(0, 6).forEach((s0, k) => {
                            const c = el('button', 'ovse-ag-style', String(s0.name || s0.id)); c.type = 'button'; c.setAttribute('role', 'radio');
                            if (k === 0) style = s0.id;
                            c.setAttribute('aria-checked', String(k === 0));
                            c.addEventListener('click', () => { style = s0.id; styles.querySelectorAll('[role="radio"]').forEach((x) => x.setAttribute('aria-checked', String(x === c))); });
                            styles.append(c);
                        });
                        paintPics(); pics.hidden = false;
                    }).catch(() => { /* no relay: its letter stays its face */ });
                // Your own setup, and Actor's site
                const own = el('section', 'ovse-ag-sec');
                own.append(el('b', 'ovse-ag-h', 'Your own setup'));
                {
                    const r0 = btn('ovse-ag-row', 'Your AI: keys, Balance, computers and coding agents', 'tune');
                    const t0 = el('span', 'ovse-ag-rt'); t0.append(el('b', '', 'Your AI'), el('small', '', 'Your own keys, your Balance, your computers and coding agents'));
                    r0.append(t0, svg('fold', 'ovse-ag-go')); r0.addEventListener('click', () => { end(); setTimeout(() => yourAI(), 240); });
                    own.append(r0);
                }
                [['https://openvibe.actor/you', 'Rules, money and computer', 'key'], ['https://openvibe.actor/', 'What Actor can do', 'spark']].forEach(([href, w, g]) => {
                    const a = el('a', 'ovse-ag-link'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.append(svg(g), el('span', '', w), svg('open'));
                    own.append(a);
                });
                b.append(own);
                setTimeout(() => { try { nameIn.focus({ preventScroll: true }); } catch { /* */ } }, 260);
            });
        }
        // ── Read aloud (4.308.0; the owner, 11-17: "a feature for the sessions and codes and actor and etc where it will read
        // out it's messages using text to speech if configured"). ov-speak.js reads; the person turns it on, picks this
        // device's voices (free, nothing leaves it) or OpenVibe's voices (the Frame's /speech, by the character), a voice
        // and a speed. A session then reads each new answer as it finishes (in a group, who said it first), never the
        // history it opened with; a tap on the speaker stops it. ──
        let speaker = null;
        const speakPrefs = () => { try { return { on: false, engine: 'device', voice: '', rate: 1, ...JSON.parse(localStorage.getItem('ov:speak') || '{}') }; } catch { return { on: false }; } };
        async function speakNow() {
            if (speaker) return speaker;
            const S = await need(o, 'ov-speak.js', 'OpenVibeSpeak');
            if (!S) return null;
            S.configure({ base, headers });
            S.on(({ speaking, error }) => {
                speakB.classList.toggle('is-speaking', speaking);
                speakB.setAttribute('aria-label', speaking ? 'Stop reading aloud' : 'Read aloud');
                speakB.title = speakB.getAttribute('aria-label');
                if (error) flash(error);
            });
            speaker = S;
            return S;
        }
        function paintSpeak() { speakB.hidden = !speakPrefs().on; }
        speakB.addEventListener('click', () => { if (speaker && speaker.speaking()) speaker.stop(); else speakSheet(); });
        root.addEventListener('ov-speak-prefs', () => { paintSpeak(); if (!speakPrefs().on && speaker) speaker.stop(); });
        if (speakPrefs().on) speakNow().then(paintSpeak);
        /** Read the answers that finished since the session opened, once each. */
        function speakNew() {
            if (state.readFrom == null || !speakPrefs().on) return;
            const fresh = [...state.steps.values()].filter((st) => st && Number(st.seq) > state.readFrom && st.kind === 'message' && st.from !== 'person'
                && st.status !== 'running' && st.text && !state.spoken.has(st.seq)).sort((x, y) => x.seq - y.seq);
            if (!fresh.length) return;
            for (const st of fresh) state.spoken.add(st.seq);
            speakNow().then((S) => {
                if (!S) return;
                for (const st of fresh) S.say(groupWords(st).text || st.text, { who: state.run && state.run.kind === 'group' && st.author && st.author.name ? st.author.name : '' });
            });
        }
        function speakSheet() {
            sheet('Read aloud', (b) => {
                b.classList.add('ovse-speaksheet');
                const sec = (title, glyph) => { const x = el('section', 'ovse-yai-sec'); const h = el('h3', 'ovse-yai-h'); h.append(svg(glyph), el('span', '', title)); x.append(h); b.append(x); return x; };
                const chips = (list, value, pick) => {
                    const row = el('div', 'ovse-use-tabs'); row.setAttribute('role', 'group');
                    list.forEach(([id, word]) => { const t = el('button', 'ovse-use-tab', word); t.type = 'button'; t.setAttribute('aria-pressed', String(id === value)); t.classList.toggle('is-on', id === value); t.addEventListener('click', () => pick(id)); row.append(t); });
                    return row;
                };
                function draw() {
                    b.textContent = '';
                    const pr = speakPrefs();
                    const top = sec('Answers', 'speaker');
                    const sw = el('button', `ovse-switch${pr.on ? ' is-on' : ''}`); sw.type = 'button'; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', String(pr.on));
                    const t = el('span', 'ovse-yai-t'); t.append(el('b', '', 'Read new answers aloud'), el('small', '', pr.on ? 'Each new answer is read as it finishes; tap the speaker to stop' : 'Off: answers stay silent'));
                    const knob = el('i', 'ovse-switch-k');
                    sw.append(t, knob);
                    sw.addEventListener('click', async () => { const S = await speakNow(); if (S) S.save({ on: !pr.on }); else flash('Reading aloud did not load'); draw(); });
                    top.append(sw);
                    const from = sec('Voice from', 'tune');
                    from.append(chips([['device', 'This device · free'], ['openvibe', 'OpenVibe voices']], pr.engine, async (id) => { const S = await speakNow(); if (S) S.save({ engine: id, voice: '' }); draw(); }));
                    from.append(el('small', 'ovse-speak-note', pr.engine === 'openvibe' ? 'Natural voices, paid by the character from your free AI, then your Balance (about $0.002 an answer).' : 'Your browser\'s own voices: free, and the words never leave this device.'));
                    const vs = sec('Voice', 'members');
                    const list = el('div', 'ovse-use-list');
                    vs.append(list);
                    speakNow().then((S) => {
                        if (!S || !list.isConnected) return;
                        const voices = pr.engine === 'openvibe' ? S.VOICES : S.deviceVoices().slice(0, 12);
                        if (!voices.length) { list.append(el('p', 'ovse-note', pr.engine === 'openvibe' ? 'No voices.' : 'This browser has no voices of its own: choose OpenVibe voices.')); return; }
                        const current = pr.voice || (voices[0] && voices[0].id);
                        voices.forEach((v) => {
                            const r = el('button', `ovse-use-row${v.id === current ? ' is-on' : ''}`); r.type = 'button'; r.setAttribute('aria-pressed', String(v.id === current));
                            const tile = el('span', 'ovse-yai-tile'); tile.append(svg(v.id === current ? 'check' : 'speaker'));
                            const tt = el('span', 'ovse-yai-t'); tt.append(el('b', '', v.name), el('small', '', v.line || ''));
                            r.append(tile, tt);
                            r.addEventListener('click', () => { S.save({ voice: v.id }); S.stop(); S.say(`Hello. This is ${v.name}.`); draw(); });
                            list.append(r);
                        });
                    });
                    const sp = sec('Speed', 'clock');
                    sp.append(chips([[0.8, '0.8×'], [1, '1×'], [1.25, '1.25×'], [1.5, '1.5×']], Number(pr.rate) || 1, async (v) => { const S = await speakNow(); if (S) S.save({ rate: v }); draw(); }));
                    const tryB = btn('ovse-setup-all', 'Try it', 'play', 'Try it');
                    tryB.addEventListener('click', async () => { const S = await speakNow(); if (S) { S.stop(); S.say('This is how answers will sound.'); } });
                    b.append(tryB);
                }
                draw();
            });
        }

        // ── Usage (4.306.0; the owner, 11-17: "display usage stats and tokens and all that for each harness or API balances
        // or cost"). What this session, today and the last 30 days used: tokens and dollars by how each was paid and by
        // model (each answer's receipt here; Actor's /me/usage through the Frame's /usage for the days), then the limits
        // and balances (the free AI left, the day's limit, your Balance, your keys) and each coding agent's windows on your
        // computers (the Frame's /resources: what their Links report). ──
        function sessionUse() {
            const out = { usd: 0, tokens: 0, tasks: 0, by: {}, models: new Map() };
            for (const st of state.steps.values()) {
                const c = st && st.cost && typeof st.cost === 'object' && st.cost.by && typeof st.cost.by === 'object' ? st.cost : null;
                if (!c) continue;
                out.tasks += 1; out.usd += Number(c.usd) || 0; out.tokens += Number(c.tokens) || 0;
                for (const k of RUNGS) {
                    const x = c.by[k]; if (!x) continue;
                    const w = out.by[k] || (out.by[k] = { usd: 0, tokens: 0, tasks: 0 });
                    w.usd += Number(x.usd) || 0; w.tokens += Number(x.tokens) || 0; w.tasks += 1;
                }
                const m = st.model && typeof st.model.id === 'string' ? st.model : null;
                if (m) {
                    const w = out.models.get(m.id) || { id: m.id, provider: m.provider || null, usd: 0, tokens: 0, tasks: 0 };
                    w.usd += Number(c.usd) || 0; w.tokens += Number(c.tokens) || 0; w.tasks += 1; out.models.set(m.id, w);
                }
            }
            return { ...out, models: [...out.models.values()].sort((a, b) => b.tokens - a.tokens) };
        }
        const moneyWord = (v) => { const usd = Number(v) || 0; return usd <= 0 ? '$0' : usd < 0.01 ? 'under 1¢' : costWords(usd); };
        /** The status line's words for what a run used: its answers' tokens and what it cost ("68k tokens · under 1¢"). */
        function useWords(r) {
            const u = sessionUse();
            const usd = Math.max(Number(r && r.cost && r.cost.usd) || 0, u.usd);
            const bits = [];
            if (u.tokens > 0) bits.push(`${shortN(Math.round(u.tokens))} tokens`);
            if (usd > 0) bits.push(spent({ usd }));
            return bits.length ? bits.join(' · ') : spent(r && r.cost);
        }
        /** Top up (the Wallet's own sheet, else its page); `close` ends the sheet it was opened from. */
        async function openWallet(close) {
            const W = await need(o, 'ov-wallet.js', 'OpenVibeWallet');
            if (!document.getElementById('ovse-wallet-css') && typeof o.sibling === 'function') { const l = document.createElement('link'); l.id = 'ovse-wallet-css'; l.rel = 'stylesheet'; l.href = o.sibling('ov-wallet.css'); document.head.append(l); }
            if (!W || typeof W.open !== 'function') { goSetup({ id: 'wallet', url: 'https://openvibe.network/wallet' }); return; }
            if (typeof close === 'function') close();
            try { await W.open({ getToken: () => tokenOf(), frameBase: base }); } catch { goSetup({ id: 'wallet', url: 'https://openvibe.network/wallet' }); }
        }
        let usageDoc = null, usageAt = 0, usageAsk = null;
        /** The Frame's /usage (30 days), kept 30 s; 'out' signed out, 'old' a Network without it, null when it failed. */
        function loadUsage() {
            if (!tokenOf()) return Promise.resolve('out');
            if (usageDoc && Date.now() - usageAt < 30000) return Promise.resolve(usageDoc);
            if (!usageAsk) {
                usageAsk = fetch(`${base}/usage?days=30`, { credentials: 'omit', headers: { Accept: 'application/json', ...headers() } })
                    .then((x) => (x.ok ? x.json() : x.status === 404 ? 'old' : x.status === 401 || x.status === 403 ? 'out' : null)).catch(() => null)
                    .then((x) => { if (x && typeof x === 'object') { usageDoc = x; usageAt = Date.now(); } usageAsk = null; return x; });
            }
            return usageAsk;
        }
        const RUNG_TONE = { allowance: 'free', key: 'key', machine: 'mine', plan: 'plan', credits: 'bal' };
        const winName = (n) => { const w = String(n || 'window').replace(/[_-]+/g, (m, at) => (/\d/.test(String(n).charAt(at - 1)) ? '-' : ' ')).trim(); return /window|limit/i.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : `${w.charAt(0).toUpperCase()}${w.slice(1)} window`; };
        const whenWord = (iso) => {
            const t = ms(iso); if (!t) return '';
            const d = new Date(t);
            return t - Date.now() < 20 * 3600 * 1000 ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
        };
        function usageSheet(first) {
            sheet('Usage', (b, { end }) => {
                b.classList.add('ovse-use');
                const spans = [state.run && ['session', 'This session'], ['today', 'Today'], ['period', '30 days']].filter(Boolean);
                let on = spans.some(([id]) => id === first) ? first : spans[0][0];
                let doc = null, docState = 'wait', res, resState = 'wait';
                const head = (title, glyph) => { const h = el('h3', 'ovse-yai-h'); h.append(svg(glyph), el('span', '', title)); return h; };

                // What it used
                const tabs = el('div', 'ovse-use-tabs'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'When');
                const tabB = new Map();
                spans.forEach(([id, word]) => { const t = el('button', 'ovse-use-tab', word); t.type = 'button'; t.addEventListener('click', () => { on = id; paint(); }); tabB.set(id, t); tabs.append(t); });
                const big = el('b', 'ovse-use-big'); const unit = el('span', 'ovse-use-unit'); const sub = el('p', 'ovse-use-sub');
                const top = el('div', 'ovse-use-top'); top.append(big, unit);
                const hero = el('div', 'ovse-use-hero'); hero.setAttribute('aria-live', 'polite'); hero.append(top, sub);
                const bar = el('div', 'ovse-use-bar'); bar.setAttribute('role', 'img');
                const legend = el('div', 'ovse-use-legend');
                const modelsH = head('Models', 'spark'); const modelsL = el('div', 'ovse-use-models');
                const what = el('section', 'ovse-yai-sec'); what.append(tabs, hero, bar, legend, modelsH, modelsL);
                // Limits and balances; coding agents
                const limL = el('div', 'ovse-use-list');
                const lim = el('section', 'ovse-yai-sec'); lim.append(head('Limits and balances', 'coin'), limL);
                const agL = el('div', 'ovse-use-list');
                const ags = el('section', 'ovse-yai-sec'); ags.append(head('Coding agents', 'term'), agL);
                b.append(what, lim, ags);

                const dataOf = (id) => (id === 'session' ? sessionUse() : doc && doc[id] ? { ...doc[id], models: Array.isArray(doc.models) ? doc.models : [] } : null);
                const meter = (share, tone, label) => { const m = el('i', `ovse-use-gauge${tone ? ` is-${tone}` : ''}`); m.style.setProperty('--w', String(Math.max(0, Math.min(1, share)))); m.setAttribute('role', 'img'); m.setAttribute('aria-label', label); return m; };
                function paint() {
                    tabB.forEach((t, id) => { t.setAttribute('aria-pressed', String(id === on)); t.classList.toggle('is-on', id === on); });
                    const d = dataOf(on);
                    hero.classList.toggle('is-wait', !d && docState === 'wait');
                    bar.replaceChildren(); legend.replaceChildren(); modelsL.replaceChildren();
                    if (!d) {
                        big.textContent = docState === 'wait' ? '…' : '—'; unit.textContent = '';
                        sub.textContent = docState === 'wait' ? 'Counting…' : docState === 'out' ? 'Sign in to see what you used.' : 'Actor could not say just now: try again in a moment.';
                        bar.hidden = true; modelsH.hidden = true; return;
                    }
                    const tokens = Math.round(Number(d.tokens) || 0), n = Number(d.tasks) || 0;
                    big.textContent = shortN(tokens); unit.textContent = tokens === 1 ? 'token' : 'tokens';
                    const secs = on === 'session' && state.run && state.run.cost ? Number(state.run.cost.seconds) || 0 : 0;
                    const usd = on === 'session' ? Math.max(Number(d.usd) || 0, Number(state.run && state.run.cost && state.run.cost.usd) || 0) : Number(d.usd) || 0;
                    sub.textContent = [moneyWord(usd), on === 'session' ? `${n} answer${n === 1 ? '' : 's'}` : `${n} task${n === 1 ? '' : 's'}`, secs ? clock(secs) : ''].filter(Boolean).join(' · ');
                    // How it was paid: one bar, a part per way, as a share of the tokens.
                    const by = d.by || {};
                    const ks = RUNGS.filter((k) => by[k] && ((Number(by[k].tokens) || 0) > 0 || (Number(by[k].usd) || 0) > 0 || (Number(by[k].tasks) || 0) > 0));
                    const total = ks.reduce((t, k) => t + (Number(by[k].tokens) || 0), 0);
                    bar.hidden = !ks.length;
                    const said = [];
                    ks.forEach((k, i) => {
                        const x = by[k], tk = Number(x.tokens) || 0, u = Number(x.usd) || 0;
                        const share = total > 0 ? tk / total : 1 / ks.length;
                        const seg = el('i', `ovse-use-seg is-${RUNG_TONE[k]}`); seg.style.setProperty('--w', String(Math.max(0.03, share))); seg.style.setProperty('--i', String(i));
                        bar.append(seg);
                        const words = [tk ? `${shortN(Math.round(tk))} tokens` : '', u > 0 && k !== 'allowance' && k !== 'machine' ? moneyWord(u) : k === 'allowance' || k === 'machine' ? 'free to you' : ''].filter(Boolean).join(' · ');
                        const r = el('div', 'ovse-use-leg'); r.style.setProperty('--i', String(i));
                        r.append(el('i', `ovse-use-dot is-${RUNG_TONE[k]}`), svg(RUNG_GLYPH[k] || 'spark'), el('b', '', rungWord(k)), el('span', '', words));
                        legend.append(r);
                        said.push(`${rungWord(k)} ${Math.round(share * 100)}%`);
                    });
                    bar.setAttribute('aria-label', `How it was paid: ${said.join(', ')}`);
                    if (!ks.length) legend.append(el('p', 'ovse-note', on === 'session' ? 'Nothing measured yet: each answer says what it took when it ends.' : 'Nothing measured in this time yet.'));
                    // The models, most tokens first.
                    const list = (d.models || []).slice(0, 8);
                    modelsH.hidden = !list.length;
                    modelsH.querySelector('span').textContent = on === 'today' ? 'Models, last 30 days' : 'Models';
                    const most = Math.max(1, ...list.map((m) => Number(m.tokens) || 0));
                    list.forEach((m, i) => {
                        const r = el('div', 'ovse-use-model'); r.style.setProperty('--i', String(i));
                        const t = el('span', 'ovse-yai-t'); const k = Number(m.tasks) || 0;
                        t.append(el('b', '', modelName(m.id) || m.id), el('small', '', [m.provider ? keyName(m.provider) : '', `${k} ${on === 'session' ? 'answer' : 'task'}${k === 1 ? '' : 's'}`].filter(Boolean).join(' · ')));
                        r.append(t, el('span', 'ovse-use-n', [`${shortN(Math.round(Number(m.tokens) || 0))}`, Number(m.usd) > 0 ? moneyWord(m.usd) : ''].filter(Boolean).join(' · ')), meter((Number(m.tokens) || 0) / most, '', `${Math.round(((Number(m.tokens) || 0) / most) * 100)}% of the most`));
                        modelsL.append(r);
                    });
                }
                const item = (list, { glyph, name, line, chip = null, tone = '', share = null, shareTone = '', go = null }) => {
                    const r = el(go ? 'button' : 'div', 'ovse-use-row'); if (go) { r.type = 'button'; r.addEventListener('click', go); }
                    const tile = el('span', 'ovse-yai-tile'); tile.append(svg(glyph));
                    const t = el('span', 'ovse-yai-t'); t.append(el('b', '', name), el('small', '', line));
                    r.append(tile, t);
                    if (chip) r.append(el('i', `ovse-yai-chip${tone ? ` is-${tone}` : ''}`, chip));
                    if (share != null) r.append(meter(share, shareTone, `${Math.round(share * 100)}% used`));
                    list.append(r); return r;
                };
                function paintLimits() {
                    limL.replaceChildren();
                    const a = res && typeof res === 'object' ? res.allowance : null;
                    if (a && a.unlimited) item(limL, { glyph: 'spark', name: 'Free AI', line: 'OpenVibe\'s free AI, with no daily cap for you', chip: 'No cap', tone: 'ok' });
                    else if (a && Number(a.tokens) > 0) {
                        const all = Number(a.tokens), left = Math.max(0, Number(a.left) || 0);
                        item(limL, { glyph: 'spark', name: 'Free AI today', line: left > 0 ? `${shortN(left)} of ${shortN(all)} tokens left · back in full at ${atTime(a.resets_at)}` : `Used up · back at ${atTime(a.resets_at)}`,
                            chip: left > 0 ? `${Math.round((left / all) * 100)}% left` : 'Used up', tone: left / all > 0.15 ? 'ok' : 'warn', share: (all - left) / all, shareTone: left / all > 0.15 ? '' : 'warn' });
                    }
                    const cap = doc && doc.limit, today = doc && doc.today;
                    if (cap && Number(cap.per_day_usd) > 0 && today) {
                        const used = (Number(today.usd) || 0) / Number(cap.per_day_usd);
                        item(limL, { glyph: 'clock', name: 'Your day with Actor', line: `${moneyWord(today.usd)} of ${moneyWord(cap.per_day_usd)}${cap.tasks_per_day ? ` · ${today.tasks} of ${cap.tasks_per_day} tasks` : ''} · from midnight UTC`, share: used, shareTone: used >= 0.9 ? 'bad' : used >= 0.7 ? 'warn' : '' });
                    }
                    const bl = res && typeof res === 'object' ? res.balance : null;
                    if (bl) {
                        const n = Number(bl.amount) / Math.pow(10, Number(bl.scale) || 0);
                        item(limL, { glyph: 'coin', name: 'Your Balance', line: 'Pays for AI you run on OpenVibe, by the cent · Top up', chip: Number.isFinite(n) ? `$${n.toFixed(2)}` : 'Top up', tone: 'money', go: () => openWallet(end) });
                    } else if (resState === 'ok') item(limL, { glyph: 'coin', name: 'Your Balance', line: 'Add money to run AI past the free allowance', chip: 'Top up', go: () => openWallet(end) });
                    (res && typeof res === 'object' && Array.isArray(res.keys) ? res.keys : []).slice(0, 8).forEach((k) => {
                        const ok = keyOk(k);
                        item(limL, { glyph: 'key', name: `${keyName(k.provider)} key`, line: ok ? 'Yours: the provider bills you for it, not OpenVibe' : 'It did not answer its last check', chip: ok ? 'Ready' : 'Check it', tone: ok ? 'ok' : 'warn' });
                    });
                    if (!limL.children.length) limL.append(el('p', 'ovse-note', resState === 'wait' ? 'Counting…' : 'Your limits could not be read just now.'));
                }
                function paintAgents() {
                    agL.replaceChildren();
                    const hs = res && typeof res === 'object' && Array.isArray(res.harnesses) ? res.harnesses : null;
                    if (!hs) { agL.append(el('p', 'ovse-note', resState === 'wait' ? 'Counting…' : 'Your coding agents could not be read just now.')); return; }
                    if (!hs.length) {
                        const set = setupOf(options || fallbackOptions).find((x) => x.id === 'harnesses') || SETUP.find((x) => x.id === 'harnesses');
                        item(agL, { glyph: 'term', name: 'No coding agent reported yet', line: 'Claude Code, Codex and the rest say their limits from your computers through Link', chip: 'Set up', go: set ? () => goSetup(set) : null });
                        return;
                    }
                    hs.forEach((h, i) => {
                        const card = el('div', 'ovse-use-agent'); card.style.setProperty('--i', String(i));
                        const wins = Array.isArray(h.windows) ? h.windows : [];
                        const full = wins.reduce((m, w) => Math.max(m, Number(w.pct) || 0), 0);
                        const where = (Array.isArray(h.machines) ? h.machines : []).join(', ');
                        item(card, { glyph: 'term', name: h.name || h.agent, line: [where || 'On your computer', h.signed_in ? '' : 'not signed in'].filter(Boolean).join(' · '),
                            chip: !h.signed_in ? 'Sign in' : full >= 100 ? 'At its limit' : wins.length ? `${100 - Math.round(full)}% left` : 'Ready', tone: !h.signed_in || full >= 80 ? 'warn' : 'ok' });
                        wins.forEach((w) => {
                            const pct = w.pct == null ? null : Math.max(0, Math.min(100, Number(w.pct)));
                            const r = el('div', 'ovse-use-win');
                            r.append(el('span', 'ovse-use-wn', winName(w.name)), el('span', 'ovse-use-wv', [pct == null ? '' : `${Math.round(pct)}% used`, w.resets_at ? `resets ${whenWord(w.resets_at)}` : ''].filter(Boolean).join(' · ')));
                            if (pct != null) r.append(meter(pct / 100, pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : '', `${Math.round(pct)}% used`));
                            card.append(r);
                        });
                        agL.append(card);
                    });
                }
                paint(); paintLimits(); paintAgents();
                loadUsage().then((x) => {
                    if (!b.isConnected) return;
                    if (x && typeof x === 'object') { doc = x; docState = 'ok'; } else docState = x === 'out' ? 'out' : 'bad';
                    paint(); paintLimits();
                });
                loadResources(true).then((x) => {
                    if (!b.isConnected) return;
                    res = x; resState = x && typeof x === 'object' ? 'ok' : 'bad';
                    paintLimits(); paintAgents();
                });
            });
        }
        /**
         * Your AI (4.296.0; the owner, 11-17: "a menu that brings them to set up their agents and their harnesses and their
         * API keys, or to enable billing … buy credits"; plan §AD.17): every road an answer can take, with its state, in
         * one sheet. Who works (your Actor, Codes, the coding agents and whether each is ready), how it is paid (the free
         * AI, your Balance with Top up in the Wallet, your own key), where it runs (your computers and the shared nodes,
         * online or not) and the sign-ins agents use. Each row does its thing here or opens the one page that does.
         */
        function yourAI() {
            sheet('Your AI', (b, { end }) => {
                b.classList.add('ovse-yai');
                const opts = options || fallbackOptions;
                let i = 0;
                // 4.311.0 (the owner, 11-18: "confusing"): every section says in a line what it is.
                const section = (title, glyph, line) => { const sec = el('section', 'ovse-yai-sec'); const h = el('h3', 'ovse-yai-h'); h.append(svg(glyph), el('span', '', title)); sec.append(h); if (line) sec.append(el('p', 'ovse-yai-l', line)); b.append(sec); return sec; };
                const row = (sec, { face, glyph, name, line, chip = null, tone = '', go = 'fold', onClick }) => {
                    const r = el('button', 'ovse-yai-r'); r.type = 'button'; r.style.setProperty('--i', String(i++));
                    r.setAttribute('aria-label', `${name}: ${line}${chip ? ` (${chip})` : ''}`);
                    const tile = face || el('span', 'ovse-yai-tile'); if (!face) tile.append(svg(glyph));
                    const t = el('span', 'ovse-yai-t'); t.append(el('b', '', name), el('small', '', line));
                    r.append(tile, t);
                    if (chip) r.append(el('i', `ovse-yai-chip${tone ? ` is-${tone}` : ''}`, chip));
                    r.append(svg(go, `ovse-yai-go${go === 'fold' ? ' is-next' : ''}`));
                    r.addEventListener('click', onClick);
                    sec.append(r); return r;
                };
                const later = (fn) => () => { end(); setTimeout(fn, 240); };
                const setup = (id) => setupOf(opts).find((x) => x.id === id) || SETUP.find((x) => x.id === id);

                // Who works
                const who = section('Your agents', 'robot', 'They do what you ask. Actor answers and acts with AI models through their APIs; Codes writes code with a coding agent.');
                if (o.actor) {
                    const st = actorState(); const now = (actor && actor.now) || {};
                    const cap = actor && actor.caps && Number(actor.caps.usd) > 0 ? ` of $${Number(actor.caps.usd).toFixed(2)}` : '';
                    row(who, { face: actorFace('m'), name: actorName(), line: `AI models through their APIs · ${ACTOR_WORD[st]} · $${(Number(now.cost_today) || 0).toFixed(2)}${cap} today`, onClick: later(() => agentSheet()) });
                }
                if (o.codes) row(who, { glyph: 'code', name: 'Codes', line: 'Writes code with a coding agent, on a shared node or your computer', onClick: later(() => setupFor('codes')) });
                const coders = section('Coding agents', 'term', 'The programs Codes runs to write code, each signed in on the machine it runs on. Ready means it can start now.');
                // 4.299.0 (Your AI on a phone, 11-17: nine coding agents pushed keys and the Balance far below the fold): the
                // ready ones first, three shown, the rest one row that unfolds them in place.
                const harnesses = (opts.agents || []).filter((a) => a && (a.kind === 'harness'));
                const ordered = harnesses.filter((a) => a.available !== false).concat(harnesses.filter((a) => a.available === false)).slice(0, 12);
                const SHOWN = 3;
                const folded = [];
                ordered.forEach((a, k) => {
                    const ready = a.available !== false;
                    const r = row(coders, { glyph: 'term', name: a.name, line: a.line || 'A coding agent', chip: ready ? 'Ready' : 'Set it up', tone: ready ? 'ok' : 'warn', go: ready ? 'fold' : 'open',
                        onClick: ready ? later(() => { pick.agent = a.id; if (pick.where === 'openvibe') pick.where = 'auto'; savePick(); blank(); }) : () => goSetup(setup('harnesses')) });
                    if (k >= SHOWN && ordered.length > SHOWN + 1) { r.hidden = true; r.classList.add('ovse-yai-more'); folded.push(r); }
                });
                if (folded.length) {
                    const rest = ordered.slice(ordered.length - folded.length);
                    const more = row(coders, { glyph: 'term', name: `${folded.length} more coding agents`, line: rest.map((a) => a.name).join(', '), go: 'fold', onClick: () => {
                        folded.forEach((r, k) => { r.style.setProperty('--i', String(k)); r.hidden = false; });
                        more.remove();
                        if (folded[0]) folded[0].focus({ preventScroll: true });
                    } });
                    more.classList.add('is-unfold');
                    const g = more.querySelector('.ovse-yai-go'); if (g) g.classList.remove('is-next');
                    more.setAttribute('aria-expanded', 'false');
                }
                if (!harnesses.length) row(coders, { glyph: 'term', name: 'Coding agents', line: 'Claude Code, Codex, OpenCode and the rest, signed in where they run', go: 'open', onClick: () => goSetup(setup('harnesses')) });

                // How it's paid
                const pay = section('How it\'s paid', 'coin', 'The free AI comes first; then your Balance, or your own key.');
                // 4.306.0: what you used, today and over 30 days; it opens Usage.
                const usedR = row(pay, { glyph: 'clock', name: 'What you used', line: 'Tokens and cost: this session, today, 30 days', chip: '…', onClick: later(() => usageSheet(state.run ? 'session' : 'today')) });
                loadUsage().then((x) => {
                    if (!usedR.isConnected) return;
                    if (!x || typeof x !== 'object' || !x.today) { setChip(usedR, null); return; }
                    setChip(usedR, `${shortN(Math.round(Number(x.today.tokens) || 0))} today`);
                    setText(usedR, '.ovse-yai-t small', `${moneyWord(x.today.usd)} today · ${shortN(Math.round(Number(x.period.tokens) || 0))} tokens and ${moneyWord(x.period.usd)} over ${x.days} days`);
                });
                const free = row(pay, { glyph: 'spark', name: 'Free AI', line: 'OpenVibe\'s free allowance: it comes back every day', chip: 'Daily', onClick: later(() => openCtx('model')) });
                const bal = row(pay, { glyph: 'coin', name: 'Your Balance', line: 'Pays for AI you run on OpenVibe, by the cent', chip: '…', go: 'plus', onClick: () => topUp() });
                const keysAt = el('div', 'ovse-yai-keys'); pay.append(keysAt);
                const keyRow = (sec) => row(sec, { glyph: 'key', name: 'Your own AI key', line: setup('keys').line, go: 'open', onClick: () => goSetup(setup('keys')) });
                keyRow(keysAt);
                const setText = (r, sel, text) => { const n = r.querySelector(sel); if (n) n.textContent = text; };
                const setChip = (r, text, tone) => {
                    let c = r.querySelector('.ovse-yai-chip');
                    if (!text) { if (c) c.remove(); return; }
                    if (!c) { c = el('i', 'ovse-yai-chip'); r.insertBefore(c, r.querySelector('.ovse-yai-go')); }
                    c.className = `ovse-yai-chip${tone ? ` is-${tone}` : ''}`; c.textContent = text;
                };
                const showBalance = (x, frozen) => {
                    if (!x || !bal.isConnected) { setChip(bal, null); return; }
                    const n = Number(x.amount) / Math.pow(10, Number(x.scale) || 0);
                    setChip(bal, Number.isFinite(n) ? `$${n.toFixed(2)}` : '', 'money');
                    if (x.purpose) setText(bal, '.ovse-yai-t small', String(x.purpose).slice(0, 140));
                    if (frozen) setText(bal, '.ovse-yai-t small', 'Top-ups are paused for now; your Balance is still here.');
                };
                const at = atTime, short = shortN;
                /** 4.297.0 (plan §AD.17): Your AI as it stands, in one read (the Frame's /resources): the free AI left, your keys
                 *  and who may use them, your Balance. An older Network without it: the Wallet's read for the Balance. */
                loadResources(true).then((res) => {
                        if (!free.isConnected) return;
                        if (res === 'old') {
                            fetch(`${base}/wallet/api/v1/me/wallet`, { credentials: 'omit', headers: { Accept: 'application/json', ...headers() } })
                                .then((r) => (r.ok ? r.json() : null)).then((w) => showBalance(w && w.balances && w.balances.balance, w && w.money_writes_frozen)).catch(() => showBalance(null));
                            return;
                        }
                        if (!res) { setChip(bal, null); return; }
                        showBalance(res.balance);
                        const a = res.allowance;
                        if (a && a.unlimited) { setChip(free, 'No cap', 'ok'); setText(free, '.ovse-yai-t small', 'OpenVibe\'s free AI, with no daily cap for you'); }
                        else if (a && Number(a.tokens) > 0) {
                            const left = Math.max(0, Number(a.left) || 0), pct = Math.round((left / Number(a.tokens)) * 100);
                            setChip(free, left > 0 ? `${pct}% left` : 'Used up', left > 0 && pct > 15 ? 'ok' : 'warn');
                            setText(free, '.ovse-yai-t small', left > 0 ? `${short(left)} of ${short(Number(a.tokens))} tokens left today · back in full at ${at(a.resets_at)}` : `Used up for today · back at ${at(a.resets_at)}`);
                        }
                        const keys = Array.isArray(res.keys) ? res.keys : [];
                        if (!keys.length) return;
                        const name = keyName;
                        keysAt.textContent = '';
                        keys.forEach((k) => {
                            const ok = keyOk(k);
                            const may = actorMay(res, k.provider);
                            // Allowing is OpenVibe.AI's own page (a site session may only read key grants): the provider filled in.
                            const allow = { id: 'keys', url: `https://ai.openvibe.services/you?allow=actor&provider=${encodeURIComponent(k.provider)}` };
                            row(keysAt, { glyph: 'key', name: `${name(k.provider)} key`, line: !ok ? 'Yours: it did not answer its last check' : may ? 'Yours: Actor may use it when the free AI runs out' : 'Yours: allow Actor to use it, so it answers when the free AI runs out',
                                chip: ok ? (may ? 'Ready' : 'Allow') : 'Check it', tone: ok && may ? 'ok' : 'warn', go: 'open', onClick: () => goSetup(may && ok ? setup('keys') : allow) });
                        });
                        row(keysAt, { glyph: 'plus', name: 'Add another key', line: 'Anthropic, OpenAI, OpenRouter, Gemini and more', go: 'open', onClick: () => goSetup(setup('keys')) });
                    }).catch(() => setChip(bal, null));
                const topUp = () => openWallet(end);

                // Where it runs
                const where = section('Where it runs', 'computer', 'Your computers (through OpenVibe Link) and OpenVibe\'s shared nodes.');
                const machines = (opts.places || []).filter((x) => x && x.kind === 'machine');
                machines.slice(0, 8).forEach((m) => {
                    const on = m.available !== false;
                    row(where, { glyph: 'computer', name: m.name || 'A computer', line: m.line || 'Yours, through OpenVibe Link', chip: on ? 'Online' : 'Offline', tone: on ? 'ok' : 'off',
                        onClick: later(() => { pick.where = placeKey(m); savePick(); blank(); }) });
                });
                const shared = (opts.places || []).find((x) => x && x.kind === 'shared');
                if (shared) row(where, { glyph: 'globe', name: shared.name || 'A shared node', line: shared.line || 'OpenVibe\'s shared machines, for coding and desks', onClick: later(() => { pick.where = placeKey(shared); savePick(); blank(); }) });
                row(where, { glyph: 'plus', name: machines.length ? 'Add another computer' : 'Add your computer', line: setup('computer').line, go: 'open', onClick: () => goSetup(setup('computer')) });
                row(where, { glyph: 'list', name: 'Shared nodes and your computers', line: setup('machines').line, go: 'open', onClick: () => goSetup(setup('machines')) });

                // Sign-ins
                // 4.311.0 (the owner, 11-18: "Your own AI key" → "Locker", beside the sign-ins): your keys and your sign-ins, together.
                const ins = section('Keys and sign-ins', 'lock', 'Sealed and used only for you. An agent asks before it uses a sign-in.');
                ins.append(keysAt);
                row(ins, { glyph: 'key', name: 'Sign-ins for your agents', line: setup('signins').line, go: 'open', onClick: () => goSetup(setup('signins')) });
                emit('setup.your-ai', {});
            });
        }
        function goSetup(x) {
            const url = setupUrl(x); if (!url) return;
            emit('setup.open', { id: x.id, url });
            try { const w = root.open(url, '_blank', 'noopener'); if (!w) root.location.href = url; } catch { root.location.href = url; }
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
            const tune = btn('ovse-ib ovse-actor-set', `Edit ${actorName()}: its name, picture, model, your own key and where it runs`, 'tune');
            tune.addEventListener('click', () => agentSheet());
            actorSlot.append(tune);
            markChosen();
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
                const c = chosen();
                faceSlot.append(chosenFace('s'));
                titleN.textContent = c.id === 'auto' ? (o.title || 'New session') : c.name;
                statN.className = 'ovse-stat'; statN.textContent = c.id === 'auto' ? 'New session · the right agent for it' : `New session · ${c.line}`;
                changesB.hidden = true; return;
            }
            faceSlot.append(face(r, 's'));
            titleN.textContent = titleOf(r);
            const [word, tone] = STATUS[r.status] || ['', 'off'];
            statN.className = `ovse-stat is-${tone}`;
            // The line's nodes stay (it repaints every second while live, and a button rebuilt under a finger loses the tap).
            if (!statN.querySelector('.ovse-stat-t')) { statN.textContent = ''; statN.append(el('i', 'ovse-dot'), el('span', 'ovse-stat-t'), el('span', 'ovse-stat-sep', ' · '), useB); }
            const bits = [needsYou(r) ? WAITING[r.waiting.for] || word : yourTurn(r) ? STATUS.turn[0] : word];
            const startT = ms(r.started_at || r.created_at), endT = ms(r.ended_at) || (isEnd(r) ? ms(r.updated_at) : 0);
            if (startT && (isLive(r) || endT)) bits.push(clock(((endT || Date.now()) - startT) / 1000));
            statN.querySelector('.ovse-stat-t').textContent = bits.filter(Boolean).join(' · ');
            const c = useWords(r);
            if (useB.textContent !== c) useB.textContent = c;
            useB.hidden = !c; statN.querySelector('.ovse-stat-sep').hidden = !c || !statN.querySelector('.ovse-stat-t').textContent;
            if (c) useB.setAttribute('aria-label', `What it used: ${c}. Open Usage`);
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
            rows.push({ id: 'speak', name: 'Read aloud', line: speakPrefs().on ? `On · ${speakPrefs().engine === 'openvibe' ? 'OpenVibe voices' : 'this device\'s voice'}` : 'Hear new answers as they finish', icon: 'speaker' });
            if (r) rows.push({ id: 'usage', name: 'Usage', line: useWords(r) || 'Tokens, cost, your limits and coding agents', icon: 'coin' });
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
                else if (id === 'usage') usageSheet('session');
                else if (id === 'speak') speakSheet();
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
        /**
         * 4.310.0 (the owner's phone, 11-18: a white pill over the page, one reading "POST http://127.0.0.1:4100/api/v2/…
         * -> 404: Unknown app"): a card in the theme above the box. An internal address never shows: what failed is said
         * in words. A link in it is a button. It stays as long as it takes to read, and a tap puts it away.
         */
        function plainError(words) {
            let w = String(words == null ? '' : words).trim();
            w = w.replace(/\b(?:GET|POST|PUT|PATCH|DELETE)\s+https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?\S*\s*->\s*/gi, '');
            w = w.replace(/https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\S*/gi, 'a service');
            return w || 'That did not work.';
        }
        /** 4.311.0 (the owner's phone, 11-18: the spent allowance as a white bubble over the hello, and as red text under an
         *  approval, "add custom layouts … improve … add link"): what happened, when it comes back, and the ways to keep
         *  going now as buttons. `closable` for the floating one. */
        function spentNote(text, closable) {
            const n = el('div', 'ovse-spent'); n.setAttribute('role', 'status');
            const h = el('div', 'ovse-spent-h'); h.append(svg('key'), el('b', '', 'Today\'s free AI is used up'));
            if (closable) {
                const x = btn('ovse-spent-x', 'Put it away', 'x');
                x.addEventListener('click', () => { n.classList.add('is-out'); setTimeout(() => n.remove(), 320); });
                h.append(x);
            }
            n.append(h, el('p', 'ovse-spent-l', `It comes back in ${backIn()}, at midnight UTC. Keep going now on your own key or your own computer: neither counts against it.`));
            const row = el('div', 'ovse-spent-acts');
            const opts = options || fallbackOptions;
            const go = (id) => goSetup(setupOf(opts).find((x) => x.id === id) || SETUP.find((x) => x.id === id));
            const key = btn('ovse-spent-b is-primary', 'Use your own AI key', 'key', 'Your own key'); key.addEventListener('click', () => go('keys'));
            const pc = btn('ovse-spent-b', 'Run it on your computer', 'computer', 'Your computer'); pc.addEventListener('click', () => go('computer'));
            const all = btn('ovse-spent-b is-quiet', 'Every way to keep going', 'tune', 'More ways'); all.addEventListener('click', () => yourAI());
            row.append(key, pc, all); n.append(row);
            return n;
        }
        /** An error under a control (an approval, a Needs-you row): the spent card, or what failed in plain words. */
        function errorNote(host, err) {
            host.querySelectorAll(':scope > .ovse-note.is-err, :scope > .ovse-spent').forEach((x) => x.remove());
            const words = (err && err.message) || String(err || '');
            host.append(isSpent(words) ? spentNote(words) : el('p', 'ovse-note is-err', plainError(words)));
        }
        function flash(words, kind) {
            if (isSpent(words)) {
                main.querySelectorAll('.ovse-flash, .ovse-spent.is-float').forEach((x) => x.remove());
                const c = spentNote(words, true); c.classList.add('is-float'); main.append(c);
                return;
            }
            const text = plainError(words);
            const link = /https:\/\/[^\s)]+[^\s).,;:]/.exec(text);
            const bad = kind === 'bad' || /did not|could not|failed|refused|\b4\d\d\b|\b5\d\d\b|used today's free|spent/i.test(text);
            const t = el('div', `ovse-flash${bad ? ' is-bad' : ''}`); t.setAttribute('role', bad ? 'alert' : 'status');
            t.append(svg(bad ? 'x' : 'check', 'ovse-flash-g'), el('span', 'ovse-flash-t', link ? text.replace(link[0], '').replace(/\s+([:.,])/g, '$1').replace(/\s{2,}/g, ' ').trim() : text));
            if (link) { const go = el('a', 'ovse-flash-go', 'Open it'); go.href = link[0]; go.target = '_blank'; go.rel = 'noopener'; t.append(go); }
            main.querySelectorAll('.ovse-flash').forEach((x) => x.remove());
            main.append(t);
            const ms = Math.min(9000, 2200 + text.length * 35);
            const out = () => { t.classList.add('is-out'); setTimeout(() => t.remove(), 400); };
            const timer = setTimeout(out, ms);
            t.addEventListener('click', (e) => { if (e.target.closest('a')) return; clearTimeout(timer); out(); });
        }

        // ── the thread: steps become blocks (words, a group of tool rows, the files it changed, approvals, helpers) ──
        // 4.305.0 (the owner's phone, 11-17: tool rows read "A step" and the answer showed twice): a tool's result, which
        // Actor writes as a step of its own, joins its call (the call's row then has what it found), and the same answer
        // written twice in a row is shown once (the later step's receipt kept).
        const ordered = () => {
            const out = [];
            for (const s of [...state.steps.values()].sort((a, b) => a.seq - b.seq)) {
                if (s.kind === 'tool' && !s.tool_call && !s.title && s.result != null) {
                    let at = -1;
                    for (let k = out.length - 1; k >= 0; k--) {
                        const c = out[k];
                        if (c.kind === 'message') break;
                        if (c.kind === 'tool' && c.tool_call && c.result == null) { at = k; break; }
                    }
                    if (at >= 0) {
                        const c = out[at];
                        out[at] = { ...c, result: s.result, ended_at: s.ended_at || c.ended_at, status: c.status === 'running' ? 'done' : c.status };
                        continue;
                    }
                }
                // 4.310.0: thoughts between the two copies do not keep them apart (11-18: "I queued the change …" twice).
                // Tools and thoughts between them do not either; the later copy stays, where the work ended.
                let k = out.length - 1;
                while (k >= 0 && (out[k].kind === 'think' || out[k].kind === 'tool')) k--;
                const prev = out[k];
                const same = (x, y) => String(x || '').replace(/\s+/g, ' ').trim() === String(y || '').replace(/\s+/g, ' ').trim();
                if (prev && s.kind === 'message' && prev.kind === 'message' && s.from !== 'person' && prev.from !== 'person' && s.text && same(s.text, prev.text)) {
                    out.splice(k, 1);
                    out.push({ ...prev, ...s });
                    continue;
                }
                out.push(s);
            }
            return out;
        };
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
        /** The answer as it is being written (delta { live }): plain words and a caret, replaced by the stored answer. */
        function liveNode() {
            const n = el('div', 'ovse-say ovse-live'); n.setAttribute('aria-live', 'polite'); n.setAttribute('aria-busy', 'true');
            const w = el('div', 'ovse-words'); w.append(el('p', 'ovse-live-t', state.live)); n.append(w);
            return n;
        }
        function paint() {
            speakNew();
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
            if (state.live && (isLive(r) || state.pending)) frag.append(liveNode());
            else if ((isLive(r) || state.pending) && !writing) frag.append(working(r));
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
            // Research says where it looked: "Searched 13 websites", the first sites as chips, the rest counted.
            const webSteps = steps.filter((s) => WEBISH.test(toolName(s)));
            const sites = webSteps.length ? sitesOf(webSteps) : [];
            const allWeb = webSteps.length && webSteps.length === steps.filter((s) => toolKind(s) !== 'plan').length;
            const text = allWeb && sites.length >= 2 ? `${steps.some((s) => /search/i.test(toolName(s))) ? 'Searched' : 'Read'} ${sites.length} websites` : said.length ? said.join(', ') : 'Worked';
            const words0 = el('span', 'ovse-acts-w', text.charAt(0).toUpperCase() + text.slice(1));
            sm.append(icons, words0);
            if (sites.length) {
                const row = el('span', 'ovse-sites');
                sites.slice(0, 3).forEach((host) => { const c = el('span', 'ovse-site'); const mark = el('i', '', host.charAt(0).toUpperCase()); mark.style.setProperty('--h', String(siteHue(host))); c.append(mark, el('span', '', host)); row.append(c); });
                if (sites.length > 3) row.append(el('span', 'ovse-site is-more', `${sites.length - 3} more`));
                row.title = sites.join(', ');
                sm.append(row);
            }
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
            if (s.kind === 'message' && from === 'person' && s.author && s.author.you === false) {
                // Someone else in a group (4.302.0): their name over their words, on the others' side.
                const n = el('div', 'ovse-say ovse-them'); n.dataset.seq = String(s.seq);
                n.append(el('small', 'ovse-author', s.author.name || 'Someone'));
                if (s.text) n.append(words(s.text));
                attachments(n, s);
                return n;
            }
            if (s.kind === 'message' && from === 'person') {
                const n = el('div', 'ovse-me'); const b = el('div', 'ovse-bubble'); b.append(words(s.text)); n.append(b); attachments(n, s);
                return n;
            }
            // 4.310.0 (the owner's phone, 11-18: "Could not answer: You have used today's free allowance … add your own model
            // key at …" as a paragraph): what to do next, as a card with its buttons.
            if (s.kind === 'message' && from !== 'person' && /used today's free allowance|free AI allowance[^.]*is spent|free allowance for today is spent/i.test(String(s.text || ''))) {
                return allowanceCard(s);
            }
            if (from === 'agent' && s.status === 'running' && !s.text && s.author && s.author.name) {
                // An agent of a group at work: its name and the mark's wait, until its words come.
                const n = el('div', 'ovse-say is-writing ovse-group-working'); n.dataset.seq = String(s.seq);
                n.append(el('small', 'ovse-author', s.author.name), el('span', 'ovse-typing', 'Working'));
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
            if (from !== 'person' && isAllowance(s.text)) return allowanceCard(s);
            const n = el('div', `ovse-say${s.status === 'running' ? ' is-writing' : ''}`);
            n.dataset.seq = String(s.seq);
            // 4.307.0 (rooms, plan §AD.25): in a group, why an agent spoke ("Review 1 of 2", "@design asked for changes")
            // rides beside its name, and a reviewer's last word (APPROVED, a CHANGES list) or a builder's DONE is a chip,
            // not a shouted word at the end of the text.
            const said = groupWords(s);
            if (s.author && s.author.name) {
                const who = el('small', 'ovse-author', s.author.name);
                if (said.why) who.append(el('i', 'ovse-why', said.why));
                n.append(who);
            }
            if (said.text) n.append(words(said.text, s.sources));
            if (said.chip) {
                const c = el('span', `ovse-verdict is-${said.chip.tone}`); c.setAttribute('role', 'status');
                c.append(svg(said.chip.glyph), el('span', '', said.chip.words));
                n.append(c);
            }
            if (s.ui && s.ui.type) { const render = cardRender(s.ui.type); if (render) { try { const c = render(s.ui.data || {}, s, { open }); if (c) { c.classList && c.classList.add('ovse-card'); n.append(c); } } catch { /* the words say it */ } } }
            if (Array.isArray(s.sources) && s.sources.length) {
                const src = el('div', 'ovse-sources');
                s.sources.slice(0, 12).forEach((x) => { const url = httpsUrl(x.url); if (!url) return; const a = el('a', 'ovse-source'); a.href = url; a.target = '_blank'; a.rel = 'nofollow noopener noreferrer'; a.append(el('i', '', String(x.n || '')), el('span', '', x.title || x.site || new URL(url).hostname)); src.append(a); });
                n.append(src);
            }
            attachments(n, s);
            const rc = s.status !== 'running' ? receiptNode(s) : null;
            if (rc) n.append(rc);
            return n;
        }
        /**
         * An answer's receipt (4.298.0, agents.step@1 1.3.0's cost.by and model; plan §AD.17): one quiet line under the
         * words, what paid for it (the free AI, your own key, your computer), the model, what it took. It opens on the
         * spend by rung. Nothing for an answer without one.
         */
        function receiptNode(s) {
            const c = s.cost && typeof s.cost === 'object' ? s.cost : null;
            const by = c && c.by && typeof c.by === 'object' ? c.by : null;
            if (!by) return null;
            const rungs = RUNGS.filter((k) => by[k] && typeof by[k] === 'object');
            if (!rungs.length) return null;
            const provider = s.model && typeof s.model.provider === 'string' ? s.model.provider : null;
            const last = rungs[rungs.length - 1];
            const paid = rungs.length === 1 ? rungWord(last, provider) : `${rungWord(rungs[0], provider)}, then ${rungWord(last, provider).replace(/^Your/, 'your')}`;
            const took = (sec) => (sec >= 60 ? clock(Math.round(sec)) : sec >= 1 ? `${Math.round(sec)} s` : '');
            const tokens = Number(c.tokens) || 0;
            const head = [paid, s.model && s.model.id ? modelName(s.model.id) : ''].filter(Boolean);
            const more = [tokens ? `${shortN(tokens)} tokens` : '', took(Number(c.seconds) || 0)].filter(Boolean);
            const bits = head.concat(more);
            const d = el('details', 'ovse-receipt'); d.dataset.key = `receipt:${s.seq}`;
            // A narrow box keeps what paid and the model; the tokens and the time are in the breakdown.
            const sm = el('summary'); sm.append(svg(RUNG_GLYPH[last] || 'spark'), el('span', 'ovse-receipt-head', head.join(' · ')));
            if (more.length) sm.append(el('span', 'ovse-receipt-more', ` · ${more.join(' · ')}`));
            sm.setAttribute('aria-label', `How this answer ran: ${bits.join(', ')}. Show the breakdown`);
            d.append(sm);
            const list = el('div', 'ovse-receipt-rows');
            rungs.forEach((k, i) => {
                const r = by[k];
                const usd = Number(r.usd) || 0;
                const line = [Number(r.tokens) ? `${shortN(Number(r.tokens))} tokens` : '', took(Number(r.seconds) || 0),
                    usd > 0 ? costWords(usd) : (k === 'allowance' || k === 'machine' ? 'free' : '')].filter(Boolean).join(' · ');
                const row = el('div', 'ovse-receipt-r'); row.style.setProperty('--i', String(i));
                row.append(svg(RUNG_GLYPH[k] || 'spark'), el('b', '', rungWord(k, provider)), el('span', '', line));
                list.append(row);
            });
            d.append(list);
            return d;
        }
        function attachments(n, s) {
            const list = Array.isArray(s.attachments) && s.attachments.length ? s.attachments : Array.isArray(s.files) ? s.files : []; if (!list.length) return;
            const row = el('div', 'ovse-attach');
            list.slice(0, 8).forEach((a) => {
                const url = httpsUrl(a.url);
                // A picture by its kind, its type or its name; drawn from the service's copy, else from the preview made here.
                const picture = a.kind === 'image' || /^image\//.test(String(a.type || a.mime || '')) || IMAGE_EXT.test(String(a.name || ''));
                const src = url || (typeof a.preview === 'string' && /^data:image\/(png|jpeg|gif|webp)/.test(a.preview) ? a.preview : null);
                if (picture && src) {
                    const box = el(url ? 'a' : 'span', 'ovse-thumb-box'); if (url) { box.href = url; box.target = '_blank'; box.rel = 'noopener'; }
                    const i = el('img', 'ovse-thumb'); i.src = src; i.alt = a.alt || a.name || ''; i.loading = 'lazy'; i.decoding = 'async';
                    i.addEventListener('error', () => { box.replaceWith(Object.assign(el('span', 'ovse-chip'), {}).appendChild(document.createTextNode(a.name || 'A picture')).parentNode); }, { once: true });
                    box.append(i); row.append(box);
                }
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
                    } catch (err) { [...row.children].forEach((x) => { x.disabled = false; }); errorNote(n, err); }
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
            if (Array.isArray(p.assumptions) && p.assumptions.length) {
                const asm = el('details', 'ovse-plan-asm');
                const as = el('summary', '', `Assumptions · ${p.assumptions.length}`);
                const ul = el('ul'); p.assumptions.forEach((x) => ul.append(el('li', '', x)));
                asm.append(as, ul); planBox.append(asm);
            }
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
        /** The mode the next words go in: Code for a coding session or the harness way, Chat for one model, Agent, Auto. */
        function modeNow() {
            const r = state.run;
            if (r && !String(r.ref || '').startsWith('actor:')) return null;
            if (pick.way === 'harness' || (!r && coding(options || fallbackOptions))) return 'code';
            if (pick.way === 'model') return 'chat';
            if (pick.way === 'agent') return 'agent';
            return 'auto';
        }
        function paintModes() {
            const now = modeNow();
            modes.hidden = now === null;
            modes.querySelectorAll('[data-mode]').forEach((m) => m.setAttribute('aria-checked', String(m.dataset.mode === now)));
        }
        /** A new session changes who it goes to; an open Actor session changes its way for the next words. */
        function setMode(id) {
            const open = state.run && String(state.run.ref || '').startsWith('actor:');
            if (id === 'code') {
                // 4.311.0: which coding agent, and where, said before the words go (11-18: Code ran nowhere and spun).
                if (open && !pick.harness) { engineSheet('harness'); return; }
                if (open) pick.way = 'harness';
                else { pick.agent = 'codes'; pick.way = 'auto'; if (pick.where === 'openvibe') pick.where = 'auto'; }
            } else {
                if (!open && (pick.agent === 'codes' || coding(options || fallbackOptions))) pick.agent = o.actor ? 'actor' : 'auto';
                pick.way = id === 'chat' ? 'model' : id === 'agent' ? 'agent' : 'auto';
                if (id === 'auto' && !open) pick.agent = 'auto';
                else if (!open && id !== 'auto' && o.actor) pick.agent = 'actor';
            }
            savePick();
            emit('session.mode', { mode: id, open: !!open });
            if (open) { paintModes(); paintCtx(); flash(id === 'code' ? 'Your next words go to a coding agent on your computer.' : id === 'chat' ? 'Your next words go to one model: quick, no tools.' : id === 'agent' ? 'Your next words go to your agent: it plans, uses tools and checks.' : 'Your next words go where they fit best.'); }
            else blank();
        }
        /** Where the next answer goes, as Actor routes it (tasks/engine.js): the free AI while a turn fits in what is
         *  left (4.300.0, Actor #575: an agent turn takes about 12,000 tokens; Chat's one model, anything left), then a
         *  key you allowed Actor to use, then a computer of yours that is online; for a coding run, the Frame's road.code
         *  (4.314.0); null when it is not known. */
        function roadNow() {
            const res = resources;
            if (!res || res === 'old') return null;
            const m = modeNow();
            if (m === 'code') return codeRoad(res);
            if (!res.allowance) return null;
            if (m === null) return null;
            const a = res.allowance;
            // The Frame's own answer when it sends one (4.301.0): Network answers openvibe-sdk/agents/roads, the one order
            // Actor's engine walks, over these facts and your computers, so the chip and Actor cannot disagree. The copy
            // of that order below is for a Frame that does not send it yet.
            const fr = res.road && res.road[m === 'chat' ? 'chat' : 'agent'];
            if (fr && fr.road) {
                const tokens = Number(a.tokens) || 0, left = Math.max(0, Number(a.left) || 0), pct = tokens ? left / tokens : 0;
                const back = a.resets_at ? ` Back in full at ${atTime(a.resets_at)}.` : '';
                const say = String(fr.say || '').trim();
                if (fr.road === 'free') {
                    if (a.unlimited || a.left == null) return { road: 'free', glyph: 'spark', text: 'Free AI', pct: 1, say: 'The free AI, with no daily cap for you' };
                    return { road: 'free', glyph: 'spark', text: `${Math.max(1, Math.round(pct * 100))}% free`, pct, say: `The free AI: ${shortN(left)} of ${shortN(tokens)} tokens left today` };
                }
                if (fr.road === 'key' && fr.provider) return { road: 'key', glyph: 'key', text: `${keyName(fr.provider)} key`, say: `${say}${back}` };
                if (fr.road === 'computer') {
                    const name = String((fr.machine && fr.machine.name) || 'Your computer');
                    return { road: 'computer', glyph: 'computer', text: name.slice(0, 24), say: `${say}${back}` };
                }
                if (fr.road === 'none') return fr.chat_only
                    ? { road: 'none', glyph: 'spark', text: 'Chat only', pct, say: `${say}${back}` }
                    : { road: 'none', glyph: 'spark', text: `Back ${atTime(a.resets_at)}`, pct: 0, say: `${say}${back}` };
            }
            if (a.unlimited) return { road: 'free', glyph: 'spark', text: 'Free AI', pct: 1, say: 'The free AI, with no daily cap for you' };
            const tokens = Number(a.tokens) || 0, left = Math.max(0, Number(a.left) || 0);
            const need = m === 'chat' ? 1 : TURN_TOKENS;
            if (tokens > 0 && left >= need) {
                const pct = left / tokens;
                return { road: 'free', glyph: 'spark', text: `${Math.max(1, Math.round(pct * 100))}% free`, pct, say: `The free AI: ${shortN(left)} of ${shortN(tokens)} tokens left today` };
            }
            // Some left, not enough for an agent turn: the words say so (Chat's one model would still answer).
            const why = left > 0 ? `the free AI has ${shortN(left)} tokens left, not enough for an agent turn,` : 'the free AI is used up';
            const key = (res.keys || []).find((k) => keyOk(k) && actorMay(res, k.provider));
            if (key) return { road: 'key', glyph: 'key', text: `${keyName(key.provider)} key`, say: `Your ${keyName(key.provider)} key: ${why} until ${atTime(a.resets_at)}` };
            const pc = ((options && options.places) || []).find((x) => x.kind === 'machine' && x.online && !x.disabled);
            if (pc) return { road: 'computer', glyph: 'computer', text: String(pc.name || 'Your computer').slice(0, 24), say: `${pc.name || 'Your computer'}: ${why} until ${atTime(a.resets_at)}` };
            if (left > 0) return { road: 'none', glyph: 'spark', text: 'Chat only', pct: tokens ? left / tokens : 0, say: `The free AI has ${shortN(left)} tokens left today: enough for Chat, not for an agent turn. Back in full at ${atTime(a.resets_at)}. Add a key or a computer to keep going` };
            return { road: 'none', glyph: 'spark', text: `Back ${atTime(a.resets_at)}`, pct: 0, say: `The free AI is used up until ${atTime(a.resets_at)}. Add a key or a computer to keep going` };
        }
        /** Code mode (4.314.0, plan §AD.28 item 4): what would run the next coding task, as the Frame answers it (SDK
         *  0.186's coding order: a coding agent signed in with your plan on your computer, your key allowed for Codes,
         *  the free AI when a coding turn fits, else why not). A coding agent you picked is yours: the chip says nothing
         *  over it. A Frame without road.code: no chip, as before. */
        function codeRoad(res) {
            const fr = res.road && res.road.code;
            if (!fr || !fr.road || fr.road === 'code' || pick.harness) return null;
            const say = String(fr.say || '').trim().replace(/\.$/, '');   // the label adds '. Your AI'
            const short = (s) => String(s || '').slice(0, 24);
            if (fr.road === 'plan' || fr.road === 'choice') return { road: 'computer', glyph: 'code', text: short(fr.harness_name || fr.harness || 'Your coding agent'), say };
            if (fr.road === 'key' && fr.provider) return { road: 'key', glyph: 'key', text: `${keyName(fr.provider)} key`, say };
            if (fr.road === 'free') {
                const a = res.allowance || {};
                const tokens = Number(a.tokens) || 0, left = Math.max(0, Number(a.left) || 0), pct = a.unlimited || !tokens ? 1 : left / tokens;
                return { road: 'free', glyph: 'spark', text: a.unlimited ? 'Free AI' : `${Math.max(1, Math.round(pct * 100))}% free`, pct, say };
            }
            if (fr.road === 'none') return { road: 'none', glyph: 'code', text: 'No coding agent', pct: 0, say };
            return null;
        }
        function paintRoad() {
            const r = roadNow();
            const wasHidden = road.hidden;
            road.hidden = !r;
            if (!r) return;
            road.className = `ovse-road is-${r.road}`;
            const g = road.querySelector('.ovse-road-ring svg'); if (g) g.innerHTML = G[r.glyph] || G.spark;
            road.querySelector('span').textContent = r.text;
            // The ring fills from empty when the chip first shows; afterwards it moves from where it was.
            const pct = r.pct != null ? String(Math.max(0, Math.min(1, r.pct))) : null;
            if (pct == null) road.style.removeProperty('--ovse-road-p');
            else if (wasHidden) { road.style.setProperty('--ovse-road-p', '0'); requestAnimationFrame(() => requestAnimationFrame(() => road.style.setProperty('--ovse-road-p', pct))); }
            else road.style.setProperty('--ovse-road-p', pct);
            road.setAttribute('aria-label', `${r.say}. Your AI`);
            road.title = r.say;
        }
        const groupId = () => (state.run && state.run.kind === 'group' ? String(state.run.id || String(state.ref || '').replace(/^group:/, '')) : null);
        const roleWords = (m) => (m.personal ? (m.owner_name ? ` · ${m.owner_name}'s own agent` : ' · someone\'s own agent')
            : m.engine && m.engine.specialist === 'design' ? ' · openvibe.design\'s rules and tools'
            : m.engine && m.engine.harness ? ` · ${m.engine.harness}` : m.harness ? ` · ${m.harness}` : m.engine && m.engine.kind === 'model' ? ' · one model' : '') + (m.reviewer ? ' · reviews' : '');
        /**
         * A group message as a room shows it (4.307.0, plan §AD.25): its words without the trailing DONE or APPROVED,
         * why the agent spoke, and a chip for the verdict (Approved; Asks for changes, with how many) or for DONE.
         * Anything not in a group is shown as it was.
         */
        function groupWords(st) {
            const text = st && st.text ? String(st.text) : '';
            if (!state.run || state.run.kind !== 'group' || !st || st.from === 'person') return { text };
            // Why it spoke, only where it says something the thread does not: a review's number, who asked for changes,
            // a handoff, plainly coding words. A person's @mention or the lead answering needs no note.
            const w = String(st.why || '');
            const why = /^review (\d+) of (\d+)$/.test(w) ? w.replace(/^review (\d+) of (\d+)$/, 'Review $1 of $2')
                : /asked for changes$/.test(w) ? w.slice(0, 80)
                    : /^handed to /.test(w) ? 'A handoff'
                        : /^the words are about code$/.test(w) ? 'About code' : '';
            const approved = /(?:^|\s)APPROVED[.!]?\s*$/.test(text);
            const changes = !approved && /(?:^|\n)\s*(?:\*\*)?CHANGES\b/.test(text);
            const done = !approved && !changes && /(?:^|\s)DONE[.!]?\s*$/.test(text);
            // The chip says the verdict, so the bare words go: a trailing APPROVED or DONE, and a CHANGES line's keyword.
            const shown = text.replace(/\s*(?:APPROVED|DONE)[.!]?\s*$/, '').replace(/(^|\n)[ \t]*(?:\*\*)?CHANGES(?:\*\*)?:?[ \t]*(?=\n|$)/, '$1').trim();
            if (approved) return { text: shown, why, chip: { tone: 'ok', glyph: 'check', words: 'Approved' } };
            if (changes) {
                const asks = (text.split(/(?:^|\n)\s*(?:\*\*)?CHANGES\b/)[1] || '').split('\n').filter((l) => /^\s*\d+[.)]\s+\S/.test(l)).length;
                return { text: shown, why, chip: { tone: 'warn', glyph: 'edit', words: asks ? `Asks for ${asks} change${asks === 1 ? '' : 's'}` : 'Asks for changes' } };
            }
            if (done) return { text: shown, why, chip: { tone: 'done', glyph: 'check', words: 'Done' } };
            return { text, why };
        }
        // A handle for one of your agents from its name: how people @mention it (2–24 letters, digits, - or _).
        const handleFor = (name, taken) => {
            let h = String(name || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9_-]+/g, '-').replace(/^[^a-z]+/, '').replace(/-+$/, '').slice(0, 20) || 'agent';
            if (h.length < 2) h = `${h}-a`;
            let out = h; let n = 2;
            while (taken.has(out)) out = `${h}${n++}`;
            return out;
        };
        function memberFace(m, i = 0) {
            const dot = el('i', `ovse-gm-face is-${m.kind === 'agent' ? 'agent' : 'person'}`); dot.style.setProperty('--i', String(i));
            dot.dataset.handle = m.handle || '';
            if (m.kind === 'agent') dot.append(svg(m.product === 'codes' ? 'code' : 'robot')); else dot.textContent = String(m.name || '?').slice(0, 1).toUpperCase();
            return dot;
        }
        function paintGroup() {
            const id = groupId();
            groupBar.hidden = !id;
            groupBar.textContent = '';
            if (!id) return;
            const ms = Array.isArray(state.run.members) ? state.run.members : [];
            // Faces, overlapped, never a row that scrolls sideways (11-17: the owner's streamers hate those): a tap lists
            // everyone with each agent's role.
            const faces = btn('ovse-group-faces', `In this group: ${ms.map((m) => (m.kind === 'agent' ? `@${m.handle}` : m.name)).join(', ')}`, null, '');
            const stack = el('span', 'ovse-gm-stack');
            ms.slice(0, 6).forEach((m, i) => stack.append(memberFace(m, i)));
            if (ms.length > 6) stack.append(el('i', 'ovse-gm-face ovse-gm-more', `+${ms.length - 6}`));
            const people = ms.filter((m) => m.kind !== 'agent').length, agents = ms.length - people;
            faces.append(stack, el('span', 'ovse-group-count', `${people} ${people === 1 ? 'person' : 'people'} · ${agents} ${agents === 1 ? 'agent' : 'agents'}`));
            faces.addEventListener('click', () => groupSheet('members'));
            const space = btn('ovse-group-b', 'The shared space: every file in this group', 'file', 'Space');
            space.addEventListener('click', () => groupSheet('space'));
            const add = btn('ovse-group-b', 'Add a person or an agent', 'plus', 'Add');
            add.addEventListener('click', () => groupSheet('add'));
            groupBar.append(faces, space, add);
        }
        /** The group's own small sheet over the thread: its shared space, or adding a person or an agent. */
        async function groupSheet(what) {
            const id = groupId(); if (!id) return;
            const old = main.querySelector('.ovse-gsheet'); if (old) old.remove();
            const sh = el('div', 'ovse-gsheet'); sh.setAttribute('role', 'dialog');
            const x = btn('ovse-ib', 'Close', 'x'); x.addEventListener('click', () => sh.remove());
            const head = el('div', 'ovse-gsheet-h'); head.append(el('b', '', what === 'space' ? 'Shared space' : what === 'members' ? 'In this group' : 'Add to the group'), x);
            sh.append(head);
            if (what === 'members') {
                sh.setAttribute('aria-label', 'In this group');
                const list = el('div', 'ovse-gsheet-list');
                (state.run.members || []).forEach((m) => {
                    const row = el('div', 'ovse-gfile ovse-gmember');
                    const t = el('span');
                    t.append(el('b', '', m.kind === 'agent' ? `${m.name} · @${m.handle}` : m.name),
                        el('small', '', m.kind === 'agent' ? `${m.product === 'codes' ? 'Codes' : 'Actor'}${roleWords(m)}${m.lead ? ' · leads' : ''}${m.coder ? ' · takes the code' : ''}` : `@${m.handle}`));
                    row.append(memberFace(m), t);
                    list.append(row);
                });
                const add = btn('ovse-group-b', 'Add a person or an agent', 'plus', 'Add someone');
                add.addEventListener('click', () => groupSheet('add'));
                sh.append(list, add);
            } else if (what === 'space') {
                sh.setAttribute('aria-label', 'Shared space');
                const seen = new Set(); const files = [];
                for (const st of state.steps.values()) for (const f of (Array.isArray(st.files) ? st.files : [])) { const k = f.id || f.url; if (k && !seen.has(k)) { seen.add(k); files.push({ ...f, by: st.author && st.author.name }); } }
                if (!files.length) sh.append(el('p', 'ovse-gsheet-empty', 'No files yet. Attach one to a message, or ask an agent to make one: everything lands here.'));
                const list = el('div', 'ovse-gsheet-list');
                files.forEach((f) => {
                    const url = httpsUrl(f.url);
                    const row = el(url ? 'a' : 'div', 'ovse-gfile'); if (url) { row.href = url; row.target = '_blank'; row.rel = 'noopener'; row.setAttribute('download', f.name || ''); }
                    const t = el('span'); t.append(el('b', '', f.name || 'A file'), el('small', '', [f.by, f.type].filter(Boolean).join(' · ')));
                    row.append(svg(/^image\//.test(String(f.type || '')) ? 'image' : 'file'), t, svg('download'));
                    list.append(row);
                });
                sh.append(list);
            } else {
                sh.setAttribute('aria-label', 'Add to the group');
                const note = el('p', 'ovse-gsheet-note'); note.setAttribute('role', 'status');
                const done = (j) => { if (j && Array.isArray(j.members)) { state.run.members = j.members; paintGroup(); } sh.remove(); };
                const fail = (err) => { note.textContent = (err && err.message) || 'That did not work.'; };
                const who = el('form', 'ovse-gsheet-f');
                const name = el('input', 'ovse-gsheet-in'); name.type = 'text'; name.placeholder = 'Their username'; name.setAttribute('aria-label', 'A person by their username'); name.autocomplete = 'off';
                const go = btn('ovse-b is-primary ovse-gsheet-go', null, 'plus', 'Add'); go.type = 'submit';
                who.append(name, go);
                who.addEventListener('submit', async (e) => { e.preventDefault(); if (!name.value.trim()) return; try { done(await api(`/groups/${encodeURIComponent(id)}/members`, { method: 'POST', body: JSON.stringify({ username: name.value.trim() }) })); } catch (err) { fail(err); } });
                sh.append(el('small', 'ovse-gsheet-l', 'A person'), who, el('small', 'ovse-gsheet-l', 'An agent'));
                const agentsBox = el('div', 'ovse-gsheet-list');
                sh.append(agentsBox, note);
                api('/groups/presets').then((j) => {
                    const have = new Set((state.run.members || []).map((m) => m.handle));
                    (j.agents || []).filter((a) => !have.has(a.handle)).forEach((a) => {
                        const b = btn('ovse-gfile', `Add ${a.name}`, a.product === 'codes' ? 'code' : 'robot', '');
                        const t = el('span'); t.append(el('b', '', `${a.name} · @${a.handle}`), el('small', '', a.line || '')); b.append(t);
                        b.addEventListener('click', async () => { b.disabled = true; try { done(await api(`/groups/${encodeURIComponent(id)}/members`, { method: 'POST', body: JSON.stringify({ agent: a }) })); } catch (err) { b.disabled = false; fail(err); } });
                        agentsBox.append(b);
                    });
                    if (!agentsBox.childElementCount) agentsBox.append(el('p', 'ovse-gsheet-empty', 'Every agent role is already here.'));
                }).catch(() => { agentsBox.append(el('p', 'ovse-gsheet-empty', 'The agents could not be listed right now.')); });
                // Your own Actor agents (Network #1070): each brings its own instructions, memory and engine, and answers you.
                const yoursBox = el('div', 'ovse-gsheet-list');
                sh.insertBefore(el('small', 'ovse-gsheet-l', 'Your agents'), note); sh.insertBefore(yoursBox, note);
                // 4.310.0 (the owner, 11-18: "why dupe"): an agent of yours that the roles above already offer (your Actor is
                // @actor there) is not listed again.
                const presetsSaid = api('/groups/presets').then((j) => new Set((j.agents || []).map((x) => String(x.name || '').toLowerCase()))).catch(() => new Set());
                Promise.all([api('/actor/faces'), presetsSaid]).then(([j, presetNames]) => {
                    const taken = new Set((state.run.members || []).map((m) => m.handle));
                    const here = new Set((state.run.members || []).filter((m) => m.personal).map((m) => m.name));
                    (Array.isArray(j && j.agents) ? j.agents : []).filter((a) => /^agt_[0-9A-Z]{26}$/.test(String(a.id || '')) && !here.has(a.name) && !presetNames.has(String(a.name || '').toLowerCase())).slice(0, 20).forEach((a) => {
                        const handle = handleFor(a.name, taken); taken.add(handle);
                        const b = btn('ovse-gfile ovse-gyours', `Add ${a.name}`, null, '');
                        const t = el('span'); t.append(el('b', '', `${a.name} · @${handle}`), el('small', '', 'Your own agent: its instructions, memory and engine come with it'));
                        b.append(face({ agent: a }, 's'), t);
                        b.addEventListener('click', async () => {
                            b.disabled = true;
                            try { done(await api(`/groups/${encodeURIComponent(id)}/members`, { method: 'POST', body: JSON.stringify({ agent: { product: 'actor', agent: a.id, name: String(a.name || '').slice(0, 60), handle } }) })); } catch (er) { b.disabled = false; fail(er); }
                        });
                        yoursBox.append(b);
                    });
                    if (!yoursBox.childElementCount) { yoursBox.previousElementSibling && yoursBox.previousElementSibling.classList.contains('ovse-gsheet-l') && yoursBox.previousElementSibling.remove(); yoursBox.remove(); }
                }).catch(() => { yoursBox.append(el('p', 'ovse-gsheet-empty', 'Your agents could not be listed right now.')); });
            }
            main.append(sh);
        }
        /** @ in a group's box offers its members (4.302.0): a tap writes the handle. */
        function paintMentions() {
            const ta = boxText(); const id = groupId();
            if (!ta || !id) { mentionRow.hidden = true; return; }
            const before = ta.value.slice(0, ta.selectionStart || ta.value.length);
            const m = /(^|\s)@([\w-]*)$/.exec(before);
            const ms = (state.run.members || []).filter((x) => x.kind === 'agent' || x.handle);
            const hits = m ? ms.filter((x) => String(x.handle || '').startsWith(m[2].toLowerCase())).slice(0, 8) : [];
            mentionRow.textContent = '';
            mentionRow.hidden = !hits.length;
            hits.forEach((x) => {
                const b = btn('ovse-mention-b', `Ask ${x.name}`, x.kind === 'agent' ? (x.product === 'codes' ? 'code' : 'robot') : null, `@${x.handle}`);
                b.setAttribute('role', 'option');
                b.addEventListener('click', () => {
                    const pos = before.length - m[2].length - 1;
                    ta.value = `${ta.value.slice(0, pos)}@${x.handle} ${ta.value.slice(before.length)}`;
                    ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus();
                    mentionRow.hidden = true;
                });
                mentionRow.append(b);
            });
        }
        let canGroup = null;
        const groupsAllowed = () => (canGroup !== null ? Promise.resolve(canGroup) : tokenOf() ? api('/groups').then((j) => (canGroup = !!(j && j.can_start))).catch(() => (canGroup = false)) : Promise.resolve(false));
        // 4.307.0 (rooms, plan §AD.25): a group starts from a recipe. The presets come from the Frame (/groups/presets);
        // a recipe names their handles and a role, and one whose presets are missing falls back to the defaults.
        const RECIPES = [
            { id: 'room', name: 'Actor, Codes and Design', line: 'Actor leads, Codes builds, Design reviews what is built', icon: 'members', title: 'A group', agents: null },
            { id: 'review', name: 'Build, then review', line: 'Codes builds; Design and Codex look at it at once; Codes fixes until both approve', icon: 'code', title: 'Build and review',
                agents: [['actor', { lead: true }], ['codes', {}], ['design', { reviewer: true }], ['codex-review', { reviewer: true }]] },
            { id: 'critics', name: 'A panel of critics', line: 'Design leads; Claude Code, Muse and one model each give their own view. Ask @all', icon: 'edit', title: 'Design review',
                agents: [['design', { lead: true, reviewer: false }], ['claude-review', {}], ['muse-review', {}], ['model-review', {}]] },
        ];
        async function startGroup(btnEl) {
            const make = async (recipe) => {
                if (btnEl) btnEl.disabled = true;
                try {
                    let agents = null;
                    if (recipe.agents) {
                        const presets = await api('/groups/presets').then((j) => (j && Array.isArray(j.agents) ? j.agents : []), () => []);
                        const picked = recipe.agents.map(([handle, role]) => { const a = presets.find((x) => x.handle === handle); return a ? { ...a, ...role } : null; });
                        if (picked.every(Boolean)) agents = picked;
                    }
                    const made = await api('/groups', { method: 'POST', body: JSON.stringify({ title: recipe.title, ...(agents ? { agents } : {}) }) });
                    open(`group:${made.id}`);
                } catch (err) { if (btnEl) btnEl.disabled = false; flash((err && err.message) || 'The group did not start.'); }
            };
            const P = await need(o, 'ov-picker.js', 'OpenVibePicker');
            if (!P || typeof P.open !== 'function') { make(RECIPES[0]); return; }
            // 4.313.0 (the owner, 11-18: "the team feature … the orchestrator"): a coding team is Codes' Orchestrator, one
            // goal split between coding agents, each one's part and the review in one place.
            const codesBase = String(o.codesUrl || 'https://openvibe.codes').replace(/\/+$/, '');
            P.open({ anchor: btnEl || main, title: 'Start a group', value: 'room',
                intro: 'People and agents in one thread. Pick who is in it; you can add anyone later.',
                sections: [{ title: 'A group here', rows: RECIPES.map((r) => ({ id: r.id, name: r.name, line: r.line, icon: r.icon })) },
                    { title: 'A coding team', rows: [{ id: 'orchestrator', name: 'Orchestrator', line: 'One goal, split between coding agents: each one\'s part, then the review, on openvibe.codes', svg: svgMarkup('code') }] }],
                onPick: (row) => {
                    if (row.id === 'orchestrator') { try { window.open(`${codesBase}/orchestrator`, '_blank', 'noopener'); } catch { /* a blocked window */ } return; }
                    const r = RECIPES.find((x) => x.id === row.id); if (r) make(r);
                } });
        }

        /** The way the next words go, in a person's words: "DeepSeek Flash (API)", "Claude Code on your computer", "Auto". */
        function engineWords() {
            const opts = options || fallbackOptions;
            if (pick.way === 'harness') {
                const h = (opts.agents || []).find((a) => a && a.kind === 'harness' && a.id === pick.harness);
                const w = (opts.places || []).find((x) => placeKey(x) === pick.where);
                return { glyph: 'term', text: `${h ? h.name : 'A coding agent'}${w && pick.where !== 'auto' ? ` on ${w.name}` : ''}`, kind: 'Harness' };
            }
            const way = WAYS.find((x) => x.id === (pick.way || 'auto')) || WAYS[0];
            const model = pick.model ? pick.model.name || pick.model.id : '';
            if (way.id === 'auto') return { glyph: 'spark', text: model ? `${model} (API)` : 'Auto', kind: 'API' };
            return { glyph: way.glyph || 'robot', text: `${way.name}${model ? ` · ${model}` : ''}`, kind: 'API' };
        }
        /** An open conversation with Actor (its turns can change how the next one runs). */
        function actorRunNow() { const r = state.run; return !!r && String(r.ref || '').startsWith('actor:') && (!r.kind || ['chat', 'task'].includes(r.kind)); }
        function paintLevel() {
            const lv = actorRunNow() && state.run && state.run.level;
            levelB.hidden = !(lv && lv.can_set && LEVEL_WORDS[lv.now]);
            if (levelB.hidden) return;
            const [word, line, glyph] = LEVEL_WORDS[lv.now];
            levelB.querySelector('span').textContent = word;
            { const g = levelB.querySelector('svg'); if (g) g.innerHTML = G[glyph] || G.lock; }
            levelB.setAttribute('aria-label', `${word}: ${line}. Change it`);
            levelB.dataset.level = lv.now;
        }
        /** The level sheet: the four, the ones under the agent's own shown and not offered, and what asks at every level. */
        async function levelSheet() {
            const lv = state.run && state.run.level; if (!lv) return;
            const P = await need(o, 'ov-picker.js', 'OpenVibePicker');
            if (!P) { flash('The choices did not load. Try again in a moment.'); return; }
            const floor = LEVEL_ORDER.indexOf(lv.agent);
            const rows = LEVEL_ORDER.map((id, i) => ({ id, name: LEVEL_WORDS[id][0], svg: svgMarkup(LEVEL_WORDS[id][2]),
                line: i < floor ? `Your agent itself is set higher (${LEVEL_WORDS[lv.agent][0]}): change it in its settings` : LEVEL_WORDS[id][1], disabled: i < floor }));
            const always = (Array.isArray(lv.always_asks) ? lv.always_asks : []).map((x) => ALWAYS_WORDS[x]).filter(Boolean);
            P.open({ anchor: levelB, title: 'How much it does on its own', search: false, value: lv.now, rows,
                intro: `For this conversation, from your next message.${always.length ? ` At every level it still asks before ${always.join(', ').replace(/, ([^,]*)$/, ' or $1')}.` : ''}`,
                onPick: async (row) => {
                    if (row.disabled || row.id === lv.now) return;
                    const ref = state.ref;
                    try {
                        const run = await api(`/runs/${encodeURIComponent(ref)}`, { method: 'PATCH', body: JSON.stringify({ level: row.id }) });
                        if (state.ref !== ref) return;
                        if (run && run.level) state.run = { ...state.run, level: run.level };
                        paintLevel();
                        flash(`From your next message: ${LEVEL_WORDS[(run && run.level && run.level.now) || row.id][0]}`);
                    } catch (err) { flash((err && err.message) || 'The level did not change'); }
                } });
        }
        function paintEngine() {
            paintLevel();
            if (!actorRunNow()) return false;
            const w = engineWords();
            ctxB.hidden = false; ctxInfo.hidden = true; ctxCost.hidden = true;
            ctxB.querySelector('span').textContent = `Runs on ${w.text}`;
            { const g = ctxB.querySelector('svg'); if (g) g.innerHTML = G[w.glyph] || G.robot; }
            ctxB.setAttribute('aria-label', `Actor runs on ${w.text}: change it`);
            ctxB.classList.toggle('is-on', w.kind === 'Harness' || (pick.way && pick.way !== 'auto') || !!pick.model);
            return true;
        }
        /** One sheet: an AI model through its API (Actor's own agent loop, one model, Decisions …), or a coding harness
         *  (Claude Code, Codex, OpenCode …) that runs Actor's work on a machine you choose. A change goes with the next words. */
        async function engineSheet(focus) {
            const P = await need(o, 'ov-picker.js', 'OpenVibePicker');
            if (!P) { flash('The choices did not load. Try again in a moment.'); return; }
            const harnessSetup = () => setupOf(options || fallbackOptions).find((x) => x.id === 'harnesses') || SETUP.find((x) => x.id === 'harnesses');
            const opts = options || fallbackOptions;
            const harnesses = (opts.agents || []).filter((a) => a && a.kind === 'harness');
            const value = pick.way === 'harness' && pick.harness ? `h:${pick.harness}` : `w:${pick.way || 'auto'}`;
            const rowOf = (x) => ({ id: `w:${x.id}`, name: x.name, line: x.line, svg: svgMarkup(x.glyph || 'robot') });
            const ai = WAYS.filter((x) => x.group === 'ai').map(rowOf);
            ai.push({ id: 'pick-model', name: pick.model ? `Model: ${pick.model.name || pick.model.id}` : 'Choose the model', line: 'The free AI, your own keys, or a model on your computer', svg: svgMarkup('model') });
            const other = WAYS.filter((x) => x.group === 'other').map(rowOf);
            const coding = harnesses.length
                ? harnesses.map((h) => ({ id: `h:${h.id}`, name: h.name, line: h.available === false ? 'Set it up first: sign in on your computer' : (h.line || 'Runs on your computer or a shared node'), svg: svgMarkup('term'), badge: h.available === false ? 'Set up' : 'Ready' }))
                : [{ id: 'setup', name: 'Add a coding agent', line: 'Claude Code, Codex, OpenCode … on your computer, through OpenVibe Link', svg: svgMarkup('term') }];
            coding.push({ id: 'pick-where', name: 'Where it runs', line: ((opts.places || []).find((x) => placeKey(x) === pick.where) || { name: 'Anywhere it fits' }).name, svg: svgMarkup('computer') });
            const side = [{ id: 'compare', name: 'Compare the ways', line: 'One question, several ways side by side, each answer graded', svg: svgMarkup('columns') }];
            let sections = [{ title: 'Answer with an AI model', rows: ai }, { title: 'Other engines', rows: other }, { title: 'Code on a machine', rows: coding }, { title: 'Side by side', rows: side }];
            if (focus === 'harness') sections = [sections[2], sections[0], sections[1], sections[3]];
            const actorBase = String(o.actorUrl || 'https://openvibe.actor').replace(/\/+$/, '');
            P.open({ anchor: ctxB, title: 'How Actor works', intro: 'A model answers through its API, in seconds. A coding agent works in a repository on a machine you choose. Your choice goes with your next message.',
                search: false, value, sections,
                onPick: (row) => {
                    if (row.id === 'compare') { try { window.open(`${actorBase}/compare`, '_blank', 'noopener'); } catch { /* a blocked window */ } return; }
                    if (row.id === 'pick-model') { setTimeout(() => openCtx('model'), 230); return; }
                    if (row.id === 'pick-where') { setTimeout(() => openCtx('where'), 230); return; }
                    if (row.id === 'setup') { goSetup(harnessSetup()); return; }
                    if (row.id.startsWith('h:')) {
                        const h = harnesses.find((x) => `h:${x.id}` === row.id);
                        if (h && h.available === false) { goSetup(harnessSetup()); return; }
                        pick.way = 'harness'; pick.harness = row.id.slice(2);
                    } else { pick.way = row.id.slice(2); pick.harness = null; }
                    savePick(); paintCtx();
                    flash(`Your next message: ${engineWords().text}`);
                } });
        }
        function paintCtx() {
            paintModes();
            paintGroup();
            if (tokenOf()) loadResources(); paintRoad();
            const r = state.run;
            paintLevel();
            if (r && paintEngine()) return;
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
            // The chip wears the chosen agent's glyph (Codes' code, Actor's robot, Auto's spark), like its hello.
            { const k = chosen().kind, g = ctxB.querySelector('svg'); if (g) g.innerHTML = G[k === 'code' ? 'code' : k === 'actor' && pick.agent !== 'auto' ? 'robot' : 'spark'] || G.spark; }
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
                // 4.311.0 (the owner, 11-18: "explain this better … more organized"): the same rows in four groups, and one
                // sentence on what they are.
                const GROUPS = [['Who works on it', ['agent']], ['How it thinks', ['way', 'model', 'effort']], ['Where it runs', ['where', 'permission', 'works']], ['Your own AI', ['setup']]];
                const sections = GROUPS.map(([title, ids]) => ({ title, rows: rows.filter((x) => ids.includes(x.id)).map((x) => ({ id: x.id, name: x.name, line: x.line, svg: svgMarkup(x.glyph) })) })).filter((x) => x.rows.length);
                const who = p.agent === 'Auto' ? 'whichever agent fits what you ask' : p.agent;
                P.open({ anchor: ctxB, title: 'How it runs', intro: `Your next message goes to ${who}. Change any part: it applies from your next message.`, sections, search: false, onPick: (row) => then(() => openCtx(row.id)) });
                return;
            }
            if (section === 'way') { engineSheet(); return; }
            if (section === 'setup') {
                P.open({ anchor: ctxB, title: 'Your own setup', search: false, rows: setupOf(opts).map((x) => ({ id: x.id, name: x.name, line: x.line || '', svg: svgMarkup(setupGlyph(x.id) || 'computer') })),
                    onPick: (row) => { const x = setupOf(opts).find((y) => y.id === row.id); goSetup(x); } });
                return;
            }
            if (section === 'agent') {
                // 4.311.0 (the owner, 11-18: "confused … API or harness"): Auto; your agents, each saying how it works (Actor
                // through AI models' APIs, Codes through a coding agent); the coding agents themselves; your own.
                const all = opts.agents || [];
                const tileOf = (a) => (a.kind === 'auto' ? 'spark' : a.kind === 'actor' ? 'robot' : a.kind === 'codes' ? 'code' : a.kind === 'harness' ? 'term' : 'robot');
                const lineOf = (a) => (a.kind === 'actor' ? 'Answers, searches and does things, with AI models through their APIs' : a.kind === 'codes' ? 'Writes and changes code, with the best coding agent for it' : a.line || '');
                const rowOf = (a) => ({ id: a.id, name: a.name, line: lineOf(a), svg: svgMarkup(tileOf(a)), disabled: a.available === false, badge: a.kind === 'harness' ? (a.available === false ? 'Set up' : 'Ready') : '' });
                const sections = [
                    { title: '', rows: all.filter((a) => a.kind === 'auto').map(rowOf) },
                    { title: 'Your agents', rows: all.filter((a) => a.kind === 'actor' || a.kind === 'codes').map(rowOf) },
                    { title: 'Coding agents (harnesses)', rows: all.filter((a) => a.kind === 'harness').map(rowOf) },
                    { title: 'Others', rows: all.filter((a) => !['auto', 'actor', 'codes', 'harness'].includes(a.kind)).map(rowOf) },
                    { title: 'Your own', rows: [{ ...SETUP_ROW, svg: svgMarkup('key') }] },
                ].filter((x) => x.rows.length);
                P.open({ anchor: ctxB, title: 'Who works on it', intro: 'An agent does the work. Actor uses AI models through their APIs. A coding agent (a harness: Claude Code, Codex …) works in a repository on a machine, run by Codes.',
                    search: 'auto', value: pick.agent, sections, onPick: (row) => {
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
                // 4.305.0: the sheet opens at once; the models fill it when they are here (loadModels, usually already).
                const priced = new Map();   // row id → { price, free }, kept with the pick for the price before it runs
                const value = pick.model ? `${pick.model.source || 'openvibe'}|${pick.model.id}` : 'auto';
                P.open({ anchor: ctxB, title: 'Model', search: true, value, searchLabel: 'Search models', load: async () => {
                    const d = await loadModels();
                    const sections = [{ title: '', rows: [{ id: 'auto', name: 'Auto', line: 'The best fit for what you ask, within your budget', svg: svgMarkup('spark') }] }];
                    for (const g of d.groups || []) {
                        for (const x of (g.rows || []).slice(0, 800)) priced.set(`${x.source || 'openvibe'}|${x.model}`, { price: x.price && Number.isFinite(x.price.in) ? { in: x.price.in, out: x.price.out } : null, free: !!x.free });
                        // 4.311.0 (the owner, 11-18: letter tiles, "Your computers … link how"): each group's own glyph, and a
                        // first row that says how your computers' models reach here.
                        const glyph = g.id === 'machines' ? 'computer' : g.id === 'keys' ? 'key' : g.id === 'plans' ? 'coin' : 'model';
                        const rows = (g.rows || []).slice(0, 800).map((x) => ({ id: `${x.source || 'openvibe'}|${x.model}`, name: x.name || x.model, line: [x.maker && x.maker !== x.model ? x.maker : '', x.free ? 'Free' : x.price && Number.isFinite(x.price.in) ? `$${x.price.in} / $${x.price.out} per 1M` : ''].filter(Boolean).join(' · '), badge: x.free ? 'Free' : '', svg: svgMarkup(glyph) }));
                        if (rows.length && g.id === 'machines') rows.unshift({ id: '__how-machines', name: 'How these get here', line: 'Your computers run them through OpenVibe Link: free, private, on your own machine. Add or manage computers', svg: svgMarkup('link') });
                        if (rows.length) sections.push({ title: g.title || g.id, rows });
                    }
                    return sections;
                }, onPick: (row) => {
                    if (row.id === '__how-machines') { const x = setupOf(opts).find((y) => y.id === 'computer') || SETUP.find((y) => y.id === 'computer'); if (x) goSetup(x); return; }
                    if (row.id === 'auto') pick.model = null;
                    else { const [source, ...rest] = String(row.id).split('|'); pick.model = { id: rest.join('|'), source, name: row.name, ...(priced.get(row.id) || {}) }; }
                    savePick();
                } });
            }
        }
        ctxB.addEventListener('click', () => (actorRunNow() ? engineSheet() : openCtx()));
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
            // 4.288.0: an agent button (ov-agent.js) says where it was asked (agents.run-start@1 context) and may name a model.
            if (choice && choice.context && typeof choice.context === 'object') {
                const c = {};
                for (const [k, n] of [['site', 60], ['url', 2000], ['title', 300], ['kind', 60], ['id', 160]]) {
                    if (typeof choice.context[k] === 'string' && choice.context[k]) c[k] = choice.context[k].slice(0, n);
                }
                if (c.url && !/^https?:\/\//.test(c.url)) delete c.url;
                if (Object.keys(c).length) how.context = c;
            }
            if (choice && typeof choice.model === 'string' && choice.model.trim()) how.model = { id: choice.model.trim().slice(0, 160), source: 'openvibe' };
            // The thread opens at once: your words on the right, the agent working on the left.
            const gen = ++state.gen; clearStream();
            state.ref = null; state.run = null; state.steps = new Map(); state.queue = []; state.pending = true; state.open = new Set();
            wrap.classList.remove('is-blank');
            const echoed = (files || []).map((f) => ({ name: f.name, kind: /^image\//.test(f.type) || IMAGE_EXT.test(f.name || '') ? 'image' : 'file' }));
            state.steps.set(0, { seq: 0, kind: 'message', from: 'person', text, attachments: echoed });
            // 4.311.0: a picture you sent shows as the picture (a small preview made here) until the service's copy is in.
            (files || []).forEach((f, k) => { if (echoed[k].kind === 'image') previewOf(f).then((src) => { if (!src) return; echoed[k].preview = src; if (state.gen >= gen) paint(); }); });
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
            open(run.ref || run.id, run, { said: text, saidFiles: echoed, modelSent: pick.model ? pick.model.id : null });
            loadRuns();
            return true;
        }
        async function say(text, files) {
            if (!state.ref) return false;
            if (isLive(state.run)) {
                // While it works, your words wait in the thread and go at its next turn.
                const q = el('div', 'ovse-me is-queued'); const b = el('div', 'ovse-bubble'); b.append(words(text));
                const note = el('small', 'ovse-queued', 'Queued: it reads this after the step it is on');
                // 4.310.0 (the owner, 11-18: "send now when possible"): stop the step under way, and these words go at once.
                const now = el('button', 'ovse-b ovse-sendnow', 'Send now'); now.type = 'button';
                now.addEventListener('click', async () => {
                    now.disabled = true; note.textContent = 'Stopping the step it is on…';
                    try { await api(`/runs/${encodeURIComponent(state.ref)}/stop`, { method: 'POST', body: '{}' }); }
                    catch (err) { now.disabled = false; note.textContent = (err && err.message) || 'It did not stop: these words wait for the next turn'; return; }
                    if (state.run) state.run = { ...state.run, status: 'stopped' };
                    flushQueue();
                });
                q.append(b, el('div', 'ovse-queued-row'), note);
                q.lastChild.previousSibling.append(now);
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
            state.ref = ref; state.run = known || null; state.steps = new Map(); state.queue = []; state.open = new Set(); state.pending = false; state.replay = null; state.readFrom = null; state.live = '';
            // The model this session last asked for: a message carries the chip's model only when it changed (plan §AD.8.3).
            state.modelSent = how.modelSent !== undefined ? how.modelSent : (known && known.model && known.model.id) || null;
            // The way the chip shows when a session opens is taken as the one it runs: a later change on the chip is a swap.
            state.waySent = `${pick.way || 'auto'}|${(wayBody() && wayBody().model) || ''}`;
            wrap.classList.remove('is-blank');
            if (how.said) { state.steps.set(-1, { seq: -1, kind: 'message', from: 'person', text: how.said, ...(how.saidFiles && how.saidFiles.length ? { attachments: how.saidFiles } : {}) }); state.pending = true; }
            paint(); paintCtx();
            [...runsBox.querySelectorAll('.ovse-row')].forEach((b) => b.classList.remove('is-on'));
            composer('Say the next thing');
            emit('session.opened', { ref });
            try {
                const [r, page] = await Promise.all([api(`/runs/${encodeURIComponent(ref)}`), api(`/runs/${encodeURIComponent(ref)}/steps?limit=500`)]);
                if (gen !== state.gen) return;
                state.run = r; state.pending = false;
                const steps = Array.isArray(page.steps) ? page.steps : [];
                // Read aloud (4.308.0): only what finishes after this, never the history the session opened with.
                state.spoken = new Set();
                // A session started here reads from the person's own message on, so an answer that came before this load is read.
                state.readFrom = how.said ? steps.filter((x) => x && x.from === 'person').reduce((m, x) => Math.max(m, Number(x.seq) || 0), 0)
                    : steps.reduce((m, x) => Math.max(m, Number(x && x.seq) || 0), 0);
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
                        if (s.kind === 'message' && s.from !== 'person') state.live = '';
                        state.steps.set(s.seq, s); emit('session.step', { ref, step: s }); schedule();
                    } else if (event === 'delta' && d && d.live) {
                        // 4.313.0 (the owner, 11-18: "stream response"): the answer's words as the model writes them, in a
                        // bubble that grows where "Working" was, until the stored answer replaces it.
                        state.live = `${state.live || ''}${String(d.text || '')}`.slice(-20000);
                        const n = thread.querySelector('.ovse-live .ovse-live-t');
                        if (n) { n.textContent = state.live; if (body.scrollHeight - body.scrollTop - body.clientHeight < 200) body.scrollTop = body.scrollHeight; }
                        else schedule();
                    } else if (event === 'delta' && d && state.steps.has(d.seq)) {
                        const s = state.steps.get(d.seq); state.steps.set(d.seq, { ...s, text: `${s.text || ''}${String(d.text || '')}` });
                        // Words as they come: in place, no repaint of the whole thread.
                        const n = thread.querySelector(`.ovse-say[data-seq="${d.seq}"] .ovse-words`);
                        if (n) { const last2 = n.lastElementChild || n; last2.append(document.createTextNode(String(d.text || ''))); if (body.scrollHeight - body.scrollTop - body.clientHeight < 200) body.scrollTop = body.scrollHeight; }
                        else schedule();
                    } else if (event === 'run' && d && d.run) {
                        if (!['running', 'planning'].includes(d.run.status)) state.live = '';
                        state.run = d.run; schedule(); flushQueue(); updateRow(d.run);
                    } else if (event === 'approval' && d && d.approval) {
                        schedule();
                    } else if (event === 'end') {
                        if (state.run) state.run = { ...state.run, status: (d && d.status) || 'done', ended_at: state.run.ended_at || new Date().toISOString() };
                        state.stop = null; schedule(); flushQueue(); updateRow(state.run);
                        emit('session.ended', { ref, run: state.run });
                        loadResources(true);   // what it spent: the road chip says what is left
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
        /** How a new session runs, in plain sight (4.294.0; the owner: "you can't even edit these properly, or like edit
         *  and configure them easily"): who, the model, where, and your own setup, each one tap from its picker. */
        function howCard() {
            // 4.311.0 (the owner, 11-18: "explain this better … I'm so confused"): one card, a row per choice, each with what
            // it means in a line; a tap changes it.
            const box = el('div', 'ovse-how is-list'); box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'How your next message runs');
            const opts = options || fallbackOptions;
            const p = ctxParts();
            const code = coding(opts);
            const agent = (opts.agents || []).find((x) => x.id === pick.agent);
            const place = (opts.places || []).find((x) => placeKey(x) === pick.where);
            const way = WAYS.find((x) => x.id === pick.way) || WAYS[0];
            const m = pick.model;
            const price = m && m.price && Number.isFinite(Number(m.price.in)) ? (2000 * Number(m.price.in) + 800 * Number(m.price.out)) / 1e6 : null;
            const whoLine = pick.agent === 'auto' ? 'Actor answers and does things; coding work goes to Codes'
                : code ? ((agent && agent.line) || 'A coding agent: it works in a repository and shows what it changed')
                    : (chosen().kind === 'actor' ? way.line : (agent && agent.line) || '');
            const rows = [
                ['agent', code ? 'Coding agent' : 'Who answers', p.agent === 'Auto' ? 'Auto' : p.agent, whoLine, code ? 'code' : chosen().kind === 'actor' ? 'robot' : 'spark'],
                ['model', 'Thinks with', p.model, !m ? 'The best model for what you ask, inside your free AI' : m.free || price === 0 ? 'Free to use' : price != null ? `About ${costWords(price)} a message` : 'Your choice of model', 'model'],
                ['where', 'Runs on', p.where === 'Auto' ? 'Auto' : p.where, pick.where === 'auto' || !place ? (code ? 'A shared node, or your own computer when it is on' : 'Wherever it fits: OpenVibe, a shared node or your computer') : (place.line || ''), 'computer'],
                ...(code ? [['effort', 'Effort', p.effort ? p.effort.replace(/ effort$/, '') : 'Auto', (EFFORTS.find((x) => x.id === (pick.effort || 'auto')) || EFFORTS[0]).line || '', 'think']] : []),
            ];
            box.append(el('p', 'ovse-how-h', 'How your next message runs'));
            const row = ([id, label, value, line, glyph], i, own) => {
                const b = btn(`ovse-how-c${own ? ' is-own' : ''}`, `${label}: ${value || 'Auto'}. Change it`);
                b.style.setProperty('--i', String(i));
                const tile = el('span', 'ovse-how-i'); tile.append(svg(glyph));
                const t = el('span', 'ovse-how-t'); t.append(el('small', '', label), el('b', '', value || 'Auto'));
                if (line) t.append(el('span', 'ovse-how-l', line));
                b.append(tile, t, svg('chev', 'ovse-how-go'));
                return b;
            };
            rows.forEach((x, i) => { const b = row(x, i); b.addEventListener('click', () => openCtx(x[0])); box.append(b); });
            const own = row(['own', 'Your AI', 'Keys · Balance · computers', 'Use your own keys, Balance or computer instead of the free AI', 'tune'], rows.length, true);
            own.addEventListener('click', () => yourAI());
            box.append(own);
            // Drawn at once from what is known; once, when the Frame's choices first arrive, again with their names.
            if (!options) loadOptions().then(() => { if (box.isConnected && options) box.replaceWith(howCard()); }).catch(() => {});
            return box;
        }
        /** The free AI is spent (the owner's phone, 11-17: "should guide the user to set up their different coding agents or
         *  the harnesses … or set it up on the shared node or their own computer … rather than just being a lame ass
         *  message"): what happened in one line, and each way to keep going now, the raw words folded below. */
        function allowanceCard(s) {
            const n = el('div', 'ovse-say ovse-setup'); n.dataset.seq = String(s.seq);
            const h = el('div', 'ovse-setup-h'); h.append(svg('key'), el('b', '', 'Your free AI is used up for today'));
            n.append(h, el('p', 'ovse-setup-l', 'It comes back tomorrow. Or keep going now, your way:'));
            const all = btn('ovse-setup-all', 'Set up your AI: agents, keys, Balance and computers', 'tune', 'Set up your AI');
            all.addEventListener('click', () => yourAI());
            n.append(all);
            const last = () => { const m = [...state.steps.values()].filter((x) => x.kind === 'message' && x.from === 'person').pop(); return m ? String(m.text || '') : ''; };
            const opts = options || fallbackOptions;
            const go = (id) => goSetup(setupOf(opts).find((x) => x.id === id) || SETUP.find((x) => x.id === id));
            const rows = [
                ['key', 'Use your own AI key', 'Anthropic, OpenAI, OpenRouter and more: sealed, used only for you, never billed by OpenVibe', () => go('keys')],
                ['code', 'Hand it to Codes', 'A coding agent on a shared node or your computer: it does not use the free allowance', () => {
                    const words = last(); pick.agent = 'codes'; if (pick.where === 'openvibe') pick.where = 'auto'; savePick();
                    blank(); if (words) prefill(words);
                }],
                ['computer', 'Run on your computer', 'Add it with OpenVibe Link: your coding agents and models, on your own keys', () => go('computer')],
                ['model', 'Pick another model', 'A free one, or one your key pays for', () => openCtx('model')],
            ];
            const list = el('div', 'ovse-setup-rows');
            rows.forEach(([glyph, name, line, fn], i) => {
                const b = btn('ovse-setup-r', `${name}: ${line}`, glyph); b.style.setProperty('--i', String(i));
                const t = el('span', 'ovse-setup-t'); t.append(el('b', '', name), el('small', '', line));
                b.append(t, svg('open', 'ovse-setup-go')); b.addEventListener('click', fn);
                list.append(b);
            });
            n.append(list);
            const d = el('details', 'ovse-setup-raw'); d.append(el('summary', '', 'What it said'), el('p', '', String(s.text || '').slice(0, 600)));
            n.append(d);
            return n;
        }
        function empty(title, line) { const e = el('div', 'ovse-empty'); e.append(svg('spark'), el('b', '', title), el('p', '', line || '')); return e; }

        // ── a new session ──
        function blank() {
            clearStream();
            state.gen++; state.ref = null; state.run = null; state.steps = new Map(); state.live = ''; state.queue = []; state.stack = []; state.pending = false;
            wrap.classList.add('is-blank');
            thread.textContent = '';
            const hi = el('div', 'ovse-hello');
            const c = chosen();
            const big = el('span', `ovse-hello-face is-${c.kind}`); big.append(svg(c.kind === 'auto' ? 'spark' : c.kind === 'actor' ? 'robot' : 'code'));
            if (o.actor && c.kind === 'actor') loadActor().then(() => { if (!actor || !big.isConnected || chosen().kind !== 'actor') return; big.textContent = ''; big.classList.add('is-actor'); big.append(actorFace('xl')); });
            const helloT = c.kind === 'code' ? 'What should we build?' : (o.helloTitle || 'What should we do?');
            const helloL = c.kind === 'code' ? `${c.name} writes and changes code on a shared node or your own computer, with the coding agent and model you pick.`
                : c.kind === 'actor' && c.id === 'actor' ? `${c.name} answers, searches and does things for you. / for commands.` : null;
            hi.append(big, el('b', 'ovse-hello-t', helloT), el('p', 'ovse-hello-l', helloL || o.line || 'Type anything. It answers, searches, makes things and writes code, on the right agent for it. / for commands, @ to pick who works on it.'));
            thread.append(hi, howCard());
            // Admins and the owner start groups (4.302.0, plan §AD.19): people and agents in one thread.
            groupsAllowed().then((ok) => {
                if (!ok || !hi.isConnected) return;
                const g = btn('ovse-group-start', 'Start a group with people and agents', 'members', '');
                const t = el('span'); t.append(el('b', '', 'Start a group'), el('small', '', 'People and agents in one thread: Actor, Codes and any harness, with a shared space'));
                g.append(t);
                g.addEventListener('click', () => startGroup(g));
                hi.after(g);
            });
            // 4.310.0 (the owner's phone, 11-18: Code mode offered "Remind me to stretch"): a coding session offers coding.
            const CODE_STARTERS = [['code', 'Fix the failing test in my repository'], ['search', 'Explain how this codebase is laid out'], ['check', 'Add tests for the newest change'],
                ['spark', 'Make a small web page that shows the weather'], ['file', 'Review my last commit and say what to improve']];
            const starters = c.kind === 'code' ? CODE_STARTERS : o.starters;
            if (Array.isArray(starters) && starters.length) {
                const st = el('div', 'ovse-starters'); st.setAttribute('role', 'group'); st.setAttribute('aria-label', 'Things to ask');
                starters.slice(0, 6).forEach((x, i) => {
                    const [g, w] = Array.isArray(x) ? x : ['spark', String(x)];
                    const b = btn('ovse-starter', null, G[g] ? g : 'spark', w); b.style.setProperty('--i', String(i));
                    b.addEventListener('click', () => { b.disabled = true; start(w); });
                    st.append(b);
                });
                thread.append(st);
            }
            planBox.hidden = true;
            [...runsBox.querySelectorAll('.ovse-row')].forEach((b) => b.classList.remove('is-on'));
            paintHead(); paintCtx(); markChosen();
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
        // 4.311.0 (the owner, 11-18: the Model sheet "slow to open the 1st time"): when the session has drawn and the page is
        // idle, the picker's script and the models are fetched, so the first sheet opens at once.
        { const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
            idle(() => { need(o, 'ov-picker.js', 'OpenVibePicker').catch(() => {}); if (tokenOf()) loadModels().catch(() => {}); }, { timeout: 5000 }); }
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
/* 4.315.0 (the owner's phone, 11-18, "Can't scroll!!"): the drawer scrolls as one. Only the list under Actor, Codes, Your
   AI and the running card scrolled, and on a short screen those rows filled the drawer, so a drag on them moved
   nothing; the head (Sessions, New, x) stays at the top. */
.ovse-drawer { overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
.ovse-drawer > * { flex-shrink: 0; }
.ovse-drawer { position: absolute; z-index: 5; inset: 0 auto 0 0; width: min(86%, 340px); display: flex; flex-direction: column; min-height: 0; background: var(--bg-secondary, var(--ovse-bg)); border-right: 1px solid var(--ovse-line); transform: translateX(-104%); transition: transform .28s cubic-bezier(.2,.8,.2,1); padding-top: env(safe-area-inset-top, 0px); }
.ovse-scrim { position: absolute; z-index: 4; inset: 0; background: rgba(0,0,0,.42); opacity: 0; pointer-events: none; transition: opacity .25s; }
/* 4.313.0 (the owner's phone, 11-18: a slice of the conversation and its ⋯ beside the drawer, "fix"): on a phone the
   drawer is the whole width; its × closes it. */
@media (max-width: 480px) { .ovse:not(.is-wide) .ovse-drawer { width: 100%; border-right: 0; } }
.ovse.is-drawer .ovse-drawer { transform: none; box-shadow: 0 0 40px rgba(0,0,0,.35); }
.ovse.is-drawer:not(.is-wide) .ovse-scrim { opacity: 1; pointer-events: auto; }
.ovse.is-wide { grid-template-columns: 0 minmax(0, 1fr); transition: grid-template-columns .28s cubic-bezier(.2,.8,.2,1); }
.ovse.is-wide.is-drawer { grid-template-columns: 300px minmax(0, 1fr); }
.ovse.is-wide .ovse-drawer { position: relative; inset: auto; width: auto; grid-row: 1; grid-column: 1; overflow-x: hidden; overflow-y: auto; box-shadow: none; transform: none; opacity: 0; transition: opacity .2s; }
.ovse.is-wide.is-drawer .ovse-drawer { opacity: 1; }
.ovse.is-wide .ovse-scrim, .ovse.is-wide .ovse-dclose { display: none; }
.ovse.is-wide .ovse-main { grid-column: 2; }
.ovse-dhead { display: flex; align-items: center; gap: 8px; padding: 10px 10px 6px 16px; position: sticky; top: 0; z-index: 2; background: var(--bg-secondary, var(--ovse-bg)); }
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
.ovse-runs { padding: 0 6px 12px; }
.ovse-group { margin: 10px 10px 2px; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--ovse-mute); }
/* 4.317.0 (the owner's phone, 11-18: "reduce spacing, padding"): a session row is one tight line of words under its title. */
.ovse-runs .ovse-row { min-height: 50px; padding: 6px 10px; gap: 10px; }
.ovse-runs .ovse-row .ovse-face.is-m { width: 36px; height: 36px; }
/* Your agents (4.317.0): folded, one row of three, face and name; open, the full cards; the chevron turns between them. */
.ovse-agents { display: grid; gap: 6px; margin: 2px 10px 8px; }
.ovse-agents > .ovse-actor { margin: 0; }
.ovse-agents > .ovse-agents-fold { justify-self: end; width: 36px; height: 28px; min-height: 28px; border-radius: 10px; color: var(--ovse-mute); }
.ovse-agents-fold svg { transform: rotate(180deg); transition: transform .28s cubic-bezier(.2, .9, .25, 1.15); }
.ovse-agents.is-folded { display: flex; align-items: stretch; }
.ovse-agents.is-folded > .ovse-actor:not([hidden]) { flex: 1 1 0; min-width: 0; padding: 3px; border-radius: 14px; }
.ovse-agents.is-folded > .ovse-actor > :not(.ovse-actor-who) { display: none; }
.ovse-agents.is-folded .ovse-actor-who { gap: 7px; padding: 4px; }
.ovse-agents.is-folded .ovse-actor-top i, .ovse-agents.is-folded .ovse-actor-t small, .ovse-agents.is-folded .ovse-ai-go { display: none; }
.ovse-agents.is-folded .ovse-actor-top b { font-size: 13.5px; }
.ovse-agents.is-folded .ovse-face, .ovse-agents.is-folded .ovse-codes-face, .ovse-agents.is-folded .ovse-ai-face { width: 30px; height: 30px; border-radius: 9px; }
.ovse-agents.is-folded .ovse-codes-face svg, .ovse-agents.is-folded .ovse-ai-face svg { width: 17px; height: 17px; }
.ovse-agents.is-folded .ovse-actor-who.is-working .ovse-actor-top b { color: var(--ovse-acc2); }
.ovse-agents.is-folded .ovse-actor-who.is-asks .ovse-actor-top b { color: var(--warning, #f5a524); }
.ovse-agents.is-folded > .ovse-agents-fold { flex: none; align-self: center; width: 32px; height: 40px; min-height: 40px; }
.ovse-agents.is-folded .ovse-agents-fold svg { transform: none; }
.ovse-agents.is-turning > .ovse-actor { animation: ovse-agents-in .3s cubic-bezier(.2, .8, .2, 1) both; }
.ovse-agents.is-turning > .ovse-actor:nth-child(2) { animation-delay: 30ms; } .ovse-agents.is-turning > .ovse-actor:nth-child(3) { animation-delay: 60ms; }
@keyframes ovse-agents-in { from { opacity: .4; transform: translateY(calc(-4px * var(--ov-move, 1))) scale(.98); } }
html[data-ov-motion=off] .ovse-agents.is-turning > .ovse-actor, html[data-ov-motion=off] .ovse-agents-fold svg { animation: none; transition: none; }
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
.ovse-actor-top { display: flex; align-items: baseline; gap: 6px; min-width: 0; } .ovse-actor-top b { flex: none; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovse-actor-top i { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; font-style: normal; font-size: 11.5px; color: var(--ovse-mute); white-space: nowrap; }
.ovse-actor-t small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ovse-mute); font-size: 12.5px; }
.ovse-actor-who.is-working .ovse-actor-t small { color: var(--ovse-acc2); } .ovse-actor-who.is-asks .ovse-actor-t small { color: var(--warning, #f5a524); }
.ovse-actor-go.is-main { background: var(--ovse-acc); color: var(--on-accent, #fff); }
/* 4.294.0: the agent a new session goes to is marked; Set up is the size of Pause on both rows. */
.ovse-actor { transition: border-color .2s, box-shadow .2s; }
.ovse-actor.is-on { border-color: color-mix(in srgb, var(--ovse-acc) 70%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ovse-acc) 45%, transparent), 0 10px 24px -18px var(--ovse-acc); }
.ovse-actor-set .ovse-g { width: 20px; height: 20px; }
/* 4.296.0: one session, its mode on a switch */
.ovse-ctxrow { flex-wrap: wrap; }
.ovse-modes { display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px; border: 1px solid var(--ovse-line); background: var(--ovse-card); }
.ovse-mode { display: inline-flex; align-items: center; gap: 5px; min-height: 36px; padding: 0 11px; border: 0; border-radius: 999px; background: transparent;
  color: var(--ovse-dim); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; transition: background .18s, color .18s, transform .15s; }
.ovse-mode .ovse-g { width: 15px; height: 15px; }
.ovse-mode:hover { color: var(--ovse-fg); }
.ovse-mode[aria-checked="true"] { color: var(--on-accent, #fff); background: var(--ovse-acc); box-shadow: 0 6px 16px -10px var(--ovse-acc); }
.ovse-mode:active { transform: scale(.95); }
@media (max-width: 420px) { .ovse-mode { padding: 0 9px; } .ovse-mode[aria-checked="false"] span { display: none; } }
/* 4.296.0: Your AI, the one setup menu */
.ovse-ai-row { margin-top: 6px; border-style: dashed; }
.ovse-ai-face { flex: none; width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: var(--accent-light, var(--accent, #3b82f6));
  background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, #3b82f6) 35%, transparent); }
.ovse-ai-face .ovse-g { width: 22px; height: 22px; }
.ovse-ai-go { flex: none; width: 16px; height: 16px; transform: rotate(-90deg); color: var(--ovse-mute); }
.ovse-yai { display: grid; gap: 4px; }
.ovse-yai-sec { display: grid; gap: 6px; padding: 4px 0 10px; }
.ovse-yai-keys { display: grid; gap: 6px; }
.ovse-yai-sec + .ovse-yai-sec { border-top: 1px solid var(--border, rgba(255,255,255,.09)); padding-top: 12px; }
.ovse-yai-h { display: flex; align-items: center; gap: 8px; margin: 0 2px 2px; font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted, #8b8b96); }
.ovse-yai-h .ovse-g { width: 16px; height: 16px; }
.ovse-yai-l { margin: -2px 2px 4px; font-size: 12.5px; line-height: 1.4; color: var(--text-muted, #8b8b9e); }
.ovse-yai-r { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 58px; padding: 8px 10px; border: 1px solid var(--border, rgba(255,255,255,.09)); border-radius: 16px;
  background: color-mix(in srgb, var(--text-primary, #ececf1) 3%, transparent); color: inherit; font: inherit; text-align: left; cursor: pointer;
  transition: border-color .15s, background .15s, transform .15s; animation: ovse-in .36s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 32ms); }
.ovse-yai-r[hidden] { display: none; }
.ovse-yai-r.is-unfold { border-style: dashed; background: transparent; }
.ovse-yai-r.is-unfold .ovse-yai-tile { opacity: .8; }
.ovse-yai-r:hover { border-color: color-mix(in srgb, var(--accent, #3b82f6) 55%, transparent); background: color-mix(in srgb, var(--accent, #3b82f6) 7%, transparent); }
.ovse-yai-r:active { transform: scale(.98); }
.ovse-yai-tile { flex: none; width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: var(--accent-light, var(--accent, #3b82f6));
  background: color-mix(in srgb, var(--accent, #3b82f6) 13%, transparent); }
.ovse-yai-tile .ovse-g { width: 22px; height: 22px; }
.ovse-yai-t { flex: 1; min-width: 0; display: grid; gap: 2px; }
.ovse-yai-t b { font-size: 14.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovse-yai-t small { font-size: 12.5px; line-height: 1.35; color: var(--text-muted, #8b8b96); }
.ovse-yai-chip { flex: none; padding: 3px 9px; border-radius: 999px; font-style: normal; font-size: 11.5px; font-weight: 750; color: var(--text-secondary, #a8b3c4);
  background: color-mix(in srgb, var(--text-primary, #ececf1) 8%, transparent); }
.ovse-yai-chip.is-ok { color: var(--success, #22c55e); background: color-mix(in srgb, var(--success, #22c55e) 14%, transparent); }
.ovse-yai-chip.is-warn { color: var(--warning, #f5a524); background: color-mix(in srgb, var(--warning, #f5a524) 14%, transparent); }
.ovse-yai-chip.is-off { opacity: .75; }
.ovse-yai-chip.is-money { color: var(--text-primary, #ececf1); font-variant-numeric: tabular-nums; }
.ovse-yai-go { flex: none; width: 16px; height: 16px; color: var(--text-muted, #8b8b96); }
.ovse-yai-go.is-next { transform: rotate(-90deg); }
.ovse-setup-all { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; margin: 0 0 10px; padding: 0 16px; border: 0; border-radius: 12px; cursor: pointer;
  font: inherit; font-weight: 750; color: var(--on-accent, #fff); background: var(--accent, #3b82f6); box-shadow: 0 10px 22px -12px var(--accent, #3b82f6); transition: transform .15s; }
.ovse-setup-all:active { transform: scale(.97); }
.ovse-setup-all .ovse-g { width: 18px; height: 18px; }
html[data-ov-motion="off"] .ovse-yai-r { animation: none; }
/* 4.306.0: Usage — the status line's button and the sheet (tokens, cost, how it was paid, models, limits, coding agents) */
.ovse-stat [hidden] { display: none; }
.ovse-stat-sep { flex: none; opacity: .7; }
.ovse-stat-use { position: relative; flex: none; padding: 0; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; white-space: nowrap;
  text-decoration: underline dotted color-mix(in srgb, currentColor 55%, transparent); text-underline-offset: 3px; }
.ovse-stat-use::after { content: ""; position: absolute; inset: -14px -6px; }
.ovse-stat-use:hover, .ovse-stat-use:focus-visible { color: var(--text-primary, #e6edf7); }
.ovse-use { --use-free: var(--accent, #3b82f6); --use-key: var(--warning, #f5a524); --use-mine: var(--success, #22c55e); --use-plan: var(--accent-light, #60a5fa); --use-bal: var(--text-secondary, #a8b3c4);
  display: grid; gap: 4px; }
/* A sheet is outside .ovse (on the body), so its border-box rule is not here: a div at width 100% with padding would
   stick out of the sheet (buttons are border-box already). */
.ovse-use, .ovse-use *, .ovse-use *::before, .ovse-use *::after { box-sizing: border-box; }
.ovse-use-tabs { display: flex; gap: 6px; padding: 2px 0 6px; }
.ovse-use-tab { flex: 1; min-height: 40px; padding: 0 12px; border: 1px solid var(--border, rgba(255,255,255,.09)); border-radius: 999px; background: transparent; color: var(--text-secondary, #a8b3c4);
  font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: background .18s, color .18s, border-color .18s, transform .15s; }
.ovse-use-tab.is-on { color: var(--on-accent, #fff); background: var(--accent, #3b82f6); border-color: transparent; box-shadow: 0 8px 18px -12px var(--accent, #3b82f6); }
.ovse-use-tab:active { transform: scale(.97); }
.ovse-use-hero { display: grid; gap: 2px; padding: 6px 4px 10px; }
.ovse-use-top { display: flex; align-items: baseline; gap: 8px; }
.ovse-use-big { font-size: 40px; line-height: 1.05; font-weight: 800; letter-spacing: -.02em; font-variant-numeric: tabular-nums; animation: ovse-in .4s cubic-bezier(.2,.8,.2,1) both; }
.ovse-use-unit { font-size: 15px; font-weight: 700; color: var(--text-muted, #8b8b96); }
.ovse-use-sub { margin: 0; font-size: 13.5px; color: var(--text-secondary, #a8b3c4); font-variant-numeric: tabular-nums; }
.ovse-use-hero.is-wait .ovse-use-big { opacity: .5; animation: ovse-beat 1.4s ease-in-out infinite; }
.ovse-use-bar { display: flex; gap: 3px; height: 12px; margin: 2px 2px 10px; }
.ovse-use-seg { flex: var(--w, 1) 1 0; min-width: 6px; border-radius: 999px; background: var(--use-free); transform-origin: left; animation: ovse-use-grow .55s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 60ms); }
.ovse-use-seg.is-key, .ovse-use-dot.is-key { background: var(--use-key); }
.ovse-use-seg.is-mine, .ovse-use-dot.is-mine { background: var(--use-mine); }
.ovse-use-seg.is-plan, .ovse-use-dot.is-plan { background: var(--use-plan); }
.ovse-use-seg.is-bal, .ovse-use-dot.is-bal { background: var(--use-bal); }
@keyframes ovse-use-grow { from { transform: scaleX(0); opacity: .4; } to { transform: none; opacity: 1; } }
.ovse-use-legend { display: grid; gap: 4px; margin-bottom: 8px; }
.ovse-use-leg { display: grid; grid-template-columns: 10px 18px auto minmax(0, 1fr); align-items: center; gap: 8px; min-height: 32px; padding: 0 4px; font-size: 13.5px;
  animation: ovse-in .36s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 40ms); }
.ovse-use-leg .ovse-g { width: 18px; height: 18px; color: var(--text-muted, #8b8b96); }
.ovse-use-leg span { min-width: 0; text-align: right; color: var(--text-secondary, #a8b3c4); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovse-use-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--use-free); }
.ovse-use-models, .ovse-use-list { display: grid; gap: 6px; }
.ovse-use-model { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4px 12px; padding: 8px 10px; border-radius: 14px;
  background: color-mix(in srgb, var(--text-primary, #ececf1) 3%, transparent); animation: ovse-in .36s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 32ms); }
.ovse-use-model .ovse-use-gauge { grid-column: 1 / -1; }
.ovse-use-n { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-secondary, #a8b3c4); }
.ovse-use-gauge { position: relative; display: block; height: 6px; border-radius: 999px; overflow: hidden; background: color-mix(in srgb, var(--text-primary, #ececf1) 9%, transparent); }
.ovse-use-gauge::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background: var(--accent, #3b82f6); transform-origin: left; transform: scaleX(var(--w, 0));
  animation: ovse-use-fill .6s cubic-bezier(.2,.8,.2,1) both; }
/* A gauge grows to its own scale: the keyframes name only the start, so the end is the rule's scaleX(var(--w)). */
@keyframes ovse-use-fill { from { transform: scaleX(0); } }
.ovse-use-gauge.is-warn::after { background: var(--warning, #f5a524); }
.ovse-use-gauge.is-bad::after { background: var(--danger, #ef4444); }
.ovse-use-row { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 6px 12px; width: 100%; min-height: 58px; padding: 8px 10px;
  border: 1px solid var(--border, rgba(255,255,255,.09)); border-radius: 16px; background: color-mix(in srgb, var(--text-primary, #ececf1) 3%, transparent); color: inherit; font: inherit; text-align: left; }
.ovse-use-row .ovse-use-gauge { grid-column: 2 / -1; }
button.ovse-use-row { cursor: pointer; transition: border-color .15s, background .15s, transform .15s; }
button.ovse-use-row:hover { border-color: color-mix(in srgb, var(--accent, #3b82f6) 55%, transparent); background: color-mix(in srgb, var(--accent, #3b82f6) 7%, transparent); }
button.ovse-use-row:active { transform: scale(.98); }
.ovse-use-agent { display: grid; gap: 4px; padding-bottom: 4px; animation: ovse-in .36s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 40ms); }
.ovse-use-win { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; padding: 6px 12px 6px 62px; font-size: 13px; }
.ovse-use-win .ovse-use-gauge { grid-column: 1 / -1; }
.ovse-use-wn { min-width: 0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovse-use-wv { color: var(--text-muted, #8b8b96); font-variant-numeric: tabular-nums; }
html[data-ov-motion="off"] .ovse-use-seg, html[data-ov-motion="off"] .ovse-use-gauge::after, html[data-ov-motion="off"] .ovse-use-big { animation: none; }
@media (min-width: 720px) { .ovse-use-legend { grid-template-columns: 1fr 1fr; column-gap: 18px; } }
/* 4.295.0: Your agent, edited in place */
.ovse-ag-top { display: flex; align-items: center; gap: 14px; padding: 6px 2px 4px; }
.ovse-ag-face { flex: none; }
.ovse-ag-tt { flex: 1; min-width: 0; display: grid; gap: 4px; }
.ovse-ag-namerow { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ovse-ag-name { flex: 1; min-width: 0; height: 44px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--border, rgba(255,255,255,.12)); background: color-mix(in srgb, var(--text-primary, #ececf1) 4%, transparent);
  color: inherit; font: inherit; font-size: 17px; font-weight: 750; }
.ovse-ag-name:focus { outline: none; border-color: var(--accent, #3b82f6); }
.ovse-ag-line { color: var(--text-muted, #8b8b96); font-size: 12.5px; }
.ovse-ag-save, .ovse-ag-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border: 1px solid var(--border, rgba(255,255,255,.12)); border-radius: 12px;
  background: transparent; color: inherit; font: inherit; font-weight: 700; cursor: pointer; transition: transform .15s, background .15s; }
.ovse-ag-save, .ovse-ag-btn.is-main { border-color: transparent; background: var(--accent, #3b82f6); color: var(--on-accent, #fff); }
.ovse-ag-save:active, .ovse-ag-btn:active { transform: scale(.96); }
.ovse-ag-save .ovse-g, .ovse-ag-btn .ovse-g { width: 18px; height: 18px; }
.ovse-ag-acts { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 4px; }
.ovse-ag-note { min-height: 1.2em; margin: 6px 2px; color: var(--text-secondary, #a8b3c4); font-size: 13px; }
.ovse-ag-sec { display: grid; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border, rgba(255,255,255,.09)); }
.ovse-ag-h { font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: var(--text-muted, #8b8b96); }
.ovse-ag-pics { display: flex; flex-wrap: wrap; gap: 8px; }
.ovse-ag-pic { width: 64px; height: 64px; padding: 0; border: 2px solid transparent; border-radius: 18px; overflow: hidden; background: none; cursor: pointer; transition: transform .15s, border-color .15s; }
.ovse-ag-pic img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ovse-ag-pic[aria-checked="true"] { border-color: var(--accent, #3b82f6); }
.ovse-ag-pic:active { transform: scale(.95); }
.ovse-ag-draw { display: grid; gap: 8px; }
.ovse-ag-words { height: 44px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--border, rgba(255,255,255,.12)); background: transparent; color: inherit; font: inherit; }
.ovse-ag-words:focus { outline: none; border-color: var(--accent, #3b82f6); }
.ovse-ag-styles { display: flex; flex-wrap: wrap; gap: 6px; }
.ovse-ag-style { min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--border, rgba(255,255,255,.12)); background: transparent; color: inherit; font: inherit; font-size: 13px; cursor: pointer; }
.ovse-ag-style[aria-checked="true"] { border-color: var(--accent, #3b82f6); background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); }
.ovse-ag-row { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 54px; padding: 8px 10px; border: 1px solid var(--border, rgba(255,255,255,.09)); border-radius: 14px; background: transparent;
  color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ovse-ag-row > .ovse-g:first-child { flex: none; width: 22px; height: 22px; color: var(--accent-light, var(--accent, #3b82f6)); }
.ovse-ag-rt { flex: 1; min-width: 0; display: grid; gap: 2px; } .ovse-ag-rt small { color: var(--text-muted, #8b8b96); font-size: 12.5px; line-height: 1.35; }
.ovse-ag-go { flex: none; width: 16px; height: 16px; color: var(--text-muted, #8b8b96); }
.ovse-ag-link { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 10px; border-radius: 12px; color: inherit; text-decoration: none; }
.ovse-ag-link .ovse-g { width: 18px; height: 18px; } .ovse-ag-link span { flex: 1; }
.ovse-ag-link:hover, .ovse-ag-row:hover { background: color-mix(in srgb, var(--text-primary, #ececf1) 5%, transparent); }
.ovse-agent-face { color: #fff; background: linear-gradient(135deg, color-mix(in srgb, var(--accent, #3b82f6) 85%, #22d3ee), color-mix(in srgb, var(--accent, #3b82f6) 70%, #0f172a)); }
.ovse-agent-face.is-auto { background: linear-gradient(140deg, var(--ovse-acc), var(--ovse-acc2)); }
.ovse-agent-face .ovse-g { width: 55%; height: 55%; }
/* Group conversations (4.302.0, plan §AD.19): the bar, others' words, the @ chips, the sheet. */
.ovse-gbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--ovse-line, rgba(255,255,255,.08)); }
.ovse-group-faces { display: flex; flex: 1 1 auto; align-items: center; gap: 10px; min-width: 0; min-height: 40px; padding: 0 6px 0 0; border: 0; border-radius: 999px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ovse-group-faces:hover .ovse-group-count { color: var(--text-primary, #e6edf7); }
.ovse-gm-stack { display: flex; flex: none; }
.ovse-gm-stack .ovse-gm-face { margin-left: -8px; box-shadow: 0 0 0 2px var(--bg-primary, #0b1120); animation: ovse-gm-in .28s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 30ms); }
.ovse-gm-stack .ovse-gm-face:first-child { margin-left: 0; }
.ovse-group-count { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary, #a8b3c4); font-size: .82rem; font-weight: 700; }
.ovse-gm-more { font-size: .68rem; font-weight: 800; background: var(--bg-tertiary, rgba(255,255,255,.1)) !important; color: var(--text-secondary, #a8b3c4) !important; }
.ovse-gmember { cursor: default; }
@media (max-width: 520px) { .ovse-group-b { width: 40px; padding: 0; justify-content: center; } .ovse-group-b > span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); } .ovse-gsheet .ovse-group-b { width: auto; padding: 0 12px; } .ovse-gsheet .ovse-group-b > span { position: static; width: auto; height: auto; clip-path: none; } }
.ovse-gm { display: inline-flex; flex: none; align-items: center; gap: 6px; max-width: 180px; padding: 3px 10px 3px 3px; border-radius: 999px; background: var(--bg-tertiary, rgba(255,255,255,.06)); font-size: .78rem; font-weight: 700; animation: ovse-gm-in .28s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 30ms); }
.ovse-gm-face { flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: color-mix(in srgb, var(--accent, #3b82f6) 22%, transparent); color: var(--text-primary, #e6edf7); font-style: normal; font-size: .72rem; }
.ovse-gm-face.is-agent { background: linear-gradient(135deg, var(--accent, #3b82f6), color-mix(in srgb, var(--accent, #3b82f6) 60%, #a855f7)); color: #fff; }
.ovse-gm-face svg { width: 14px; height: 14px; }
.ovse-gm-n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.ovse-group-b { display: inline-flex; flex: none; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px; border: 1px solid var(--ovse-line, rgba(255,255,255,.12)); border-radius: 999px; background: transparent; color: inherit; font: inherit; font-size: .8rem; font-weight: 700; cursor: pointer; }
.ovse-group-b svg { width: 16px; height: 16px; }
.ovse-group-b:hover { background: var(--bg-hover, rgba(255,255,255,.06)); }
.ovse-them { align-self: flex-start; }
.ovse-group-working .ovse-typing { color: var(--text-muted, #8a96ad); font-size: .85rem; }
.ovse-group-start { display: flex; align-items: center; gap: 12px; width: min(100%, 420px); margin: 12px auto 0; padding: 12px 14px; border: 1px dashed color-mix(in srgb, var(--accent, #3b82f6) 45%, transparent); border-radius: 14px; background: color-mix(in srgb, var(--accent, #3b82f6) 7%, transparent); color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ovse-group-start > svg { flex: none; width: 22px; height: 22px; color: var(--accent, #3b82f6); }
.ovse-group-start span, .ovse-gfile span { display: grid; gap: 2px; min-width: 0; }
.ovse-group-start small, .ovse-gfile small { color: var(--text-muted, #8a96ad); font-size: .78rem; }
.ovse-mention { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 12px 0; }
.ovse-mention[hidden] { display: none; }
.ovse-mention-b { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px; border: 0; border-radius: 999px; background: color-mix(in srgb, var(--accent, #3b82f6) 16%, transparent); color: inherit; font: inherit; font-size: .82rem; font-weight: 700; cursor: pointer; }
.ovse-mention-b svg { width: 16px; height: 16px; }
.ovse-gsheet { position: absolute; z-index: 30; inset: auto 8px 8px 8px; max-height: 70%; overflow-y: auto; display: grid; gap: 8px; padding: 12px; border: 1px solid var(--ovse-line, rgba(255,255,255,.12)); border-radius: 16px; background: var(--bg-secondary, #0f1729); box-shadow: 0 18px 48px rgba(0,0,0,.45); animation: ovse-gm-in .24s cubic-bezier(.2,.8,.2,1) both; }
.ovse-gsheet-h { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ovse-gsheet-l { color: var(--text-muted, #8a96ad); font-size: .76rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.ovse-gsheet-f { display: flex; gap: 8px; }
.ovse-gsheet-in { flex: 1 1 auto; min-width: 0; min-height: 40px; padding: 0 12px; border: 1px solid var(--ovse-line, rgba(255,255,255,.14)); border-radius: 10px; background: var(--bg-tertiary, rgba(255,255,255,.04)); color: inherit; font: inherit; }
.ovse-gsheet-list { display: grid; gap: 4px; }
.ovse-gfile { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 8px 10px; border: 0; border-radius: 10px; background: transparent; color: inherit; font: inherit; text-align: left; text-decoration: none; cursor: pointer; }
.ovse-gfile:hover { background: var(--bg-hover, rgba(255,255,255,.06)); }
.ovse-gfile > svg { flex: none; width: 20px; height: 20px; }
.ovse-gfile > svg:last-child { margin-left: auto; color: var(--text-muted, #8a96ad); }
.ovse-gsheet-empty, .ovse-gsheet-note { margin: 0; color: var(--text-muted, #8a96ad); font-size: .85rem; line-height: 1.45; }
@keyframes ovse-gm-in { from { opacity: 0; transform: translateY(calc(4px * var(--ov-move, 1))); } }
html[data-ov-motion=off] .ovse-gm, html[data-ov-motion=off] .ovse-gsheet { animation: none; }
.ovse-hello-face.is-code { background: linear-gradient(135deg, color-mix(in srgb, var(--accent, #3b82f6) 85%, #22d3ee), color-mix(in srgb, var(--accent, #3b82f6) 70%, #0f172a)); }
/* How it runs, under a new session's hello */
.ovse-how { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 2px 4px 14px; }
.ovse-how-c { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; max-width: 100%; padding: 4px 14px 4px 10px; border: 1px solid var(--ovse-line); border-radius: 14px;
  background: var(--ovse-card); color: var(--ovse-fg); font: inherit; text-align: left; cursor: pointer; transition: border-color .15s, background .15s, transform .15s;
  animation: ovse-in .38s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 40ms); }
.ovse-how-c:hover { border-color: color-mix(in srgb, var(--ovse-acc) 55%, transparent); }
.ovse-how-c:active { transform: scale(.97); }
.ovse-how-c .ovse-g { flex: none; width: 18px; height: 18px; color: var(--ovse-acc2); }
.ovse-how-t { display: grid; min-width: 0; line-height: 1.15; }
.ovse-how-t small { font-size: 11px; color: var(--ovse-mute); }
.ovse-how-t b { font-size: 13.5px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px; }
.ovse-how-c.is-own { border-style: dashed; }
/* the setup card for a spent allowance */
.ovse-setup { padding: 14px; border-radius: 18px; border: 1px solid color-mix(in srgb, var(--warning, #f5a524) 40%, var(--ovse-line)); background: color-mix(in srgb, var(--warning, #f5a524) 7%, var(--ovse-card)); animation: ovse-in .4s cubic-bezier(.2,.8,.2,1) both; }
.ovse-setup-h { display: flex; align-items: center; gap: 8px; font-size: 15px; }
.ovse-setup-h .ovse-g { width: 20px; height: 20px; color: var(--warning, #f5a524); }
.ovse-setup-l { margin: 6px 0 10px; color: var(--ovse-dim); font-size: 13.5px; }
.ovse-setup-rows { display: grid; gap: 8px; }
.ovse-setup-r { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 54px; padding: 8px 12px; border: 1px solid var(--ovse-line); border-radius: 14px;
  background: var(--ovse-bg); color: var(--ovse-fg); font: inherit; text-align: left; cursor: pointer; transition: border-color .15s, transform .15s;
  animation: ovse-in .36s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(80ms + var(--i, 0) * 50ms); }
.ovse-setup-r:hover { border-color: color-mix(in srgb, var(--ovse-acc) 60%, transparent); }
.ovse-setup-r:active { transform: scale(.98); }
.ovse-setup-r > .ovse-g:first-child { flex: none; width: 22px; height: 22px; color: var(--ovse-acc2); }
.ovse-setup-t { flex: 1; min-width: 0; display: grid; gap: 2px; }
.ovse-setup-t b { font-size: 14px; } .ovse-setup-t small { color: var(--ovse-mute); font-size: 12.5px; line-height: 1.35; }
.ovse-setup-go { flex: none; width: 16px; height: 16px; color: var(--ovse-mute); }
.ovse-setup-raw { margin-top: 10px; color: var(--ovse-mute); font-size: 12px; }
.ovse-setup-raw summary { cursor: pointer; min-height: 32px; display: flex; align-items: center; }
.ovse-setup-raw p { margin: 4px 0 0; overflow-wrap: anywhere; }
html[data-ov-motion="off"] .ovse-how-c, html[data-ov-motion="off"] .ovse-setup, html[data-ov-motion="off"] .ovse-setup-r { animation: none; }
.ovse-top:empty { display: none; }
.ovse-face.is-xl { width: 60px; height: 60px; border-radius: 22px; }
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
/* 4.308.0: read aloud — the speaker in the head, and its sheet */
.ovse-speak.is-speaking { color: var(--ovse-acc2); }
.ovse-speak.is-speaking .ovse-g { animation: ovse-beat 1.1s ease-in-out infinite; }
.ovse-speaksheet { display: grid; gap: 4px; }
.ovse-speaksheet, .ovse-speaksheet * { box-sizing: border-box; }
.ovse-switch { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 58px; padding: 8px 12px; border: 1px solid var(--border, rgba(255,255,255,.09)); border-radius: 16px;
  background: color-mix(in srgb, var(--text-primary, #ececf1) 3%, transparent); color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ovse-switch-k { position: relative; flex: none; width: 46px; height: 28px; border-radius: 999px; background: color-mix(in srgb, var(--text-primary, #ececf1) 18%, transparent); transition: background .2s; }
.ovse-switch-k::after { content: ""; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: var(--text-primary, #ececf1); transition: transform .22s cubic-bezier(.2,.8,.2,1); }
.ovse-switch.is-on .ovse-switch-k { background: var(--accent, #3b82f6); }
.ovse-switch.is-on .ovse-switch-k::after { transform: translateX(18px); background: var(--on-accent, #fff); }
.ovse-speak-note { display: block; margin: 2px 4px 4px; font-size: 12.5px; color: var(--text-muted, #8b8b96); }
.ovse-speaksheet .ovse-use-row { cursor: pointer; }
.ovse-speaksheet .ovse-use-row.is-on { border-color: color-mix(in srgb, var(--accent, #3b82f6) 60%, transparent); background: color-mix(in srgb, var(--accent, #3b82f6) 9%, transparent); }
html[data-ov-motion="off"] .ovse-speak.is-speaking .ovse-g, html[data-ov-motion="off"] .ovse-switch-k, html[data-ov-motion="off"] .ovse-switch-k::after { animation: none; transition: none; }
/* 4.307.0: rooms — why an agent spoke, and a reviewer's verdict */
.ovse-why { margin-left: 6px; font-style: normal; font-weight: 600; color: var(--ovse-mute); opacity: .85; }
.ovse-why::before { content: "·"; margin-right: 6px; }
.ovse-verdict { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; min-height: 28px; padding: 0 11px 0 9px; border-radius: 999px;
  font-size: 12.5px; font-weight: 750; color: var(--ovse-dim); background: color-mix(in srgb, var(--ovse-fg) 7%, transparent);
  animation: ovse-in .36s cubic-bezier(.2,.8,.2,1) both; }
.ovse-verdict .ovse-g { width: 16px; height: 16px; }
.ovse-verdict.is-ok { color: var(--success, #22c55e); background: color-mix(in srgb, var(--success, #22c55e) 14%, transparent); }
.ovse-verdict.is-warn { color: var(--warning, #f5a524); background: color-mix(in srgb, var(--warning, #f5a524) 14%, transparent); }
.ovse-verdict.is-done { color: var(--ovse-acc2); background: color-mix(in srgb, var(--ovse-acc) 13%, transparent); }
.ovse-words > :first-child { margin-top: 0; } .ovse-words > :last-child { margin-bottom: 0; }
.ovse-words p { margin: 0 0 10px; } .ovse-words .ovse-h { font-weight: 700; margin-top: 14px; }
.ovse-words ul, .ovse-words ol { margin: 0 0 10px; padding-left: 22px; } .ovse-words li { margin: 3px 0; }
.ovse-words a { color: var(--ovse-acc2); text-decoration: underline; text-underline-offset: 2px; }
.ovse-ic { padding: 1px 6px; border-radius: 6px; background: color-mix(in srgb, var(--ovse-fg) 9%, transparent); font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ovse-cite { display: inline-grid; place-items: center; min-width: 18px; height: 18px; margin: 0 2px; padding: 0 4px; border-radius: 6px; background: color-mix(in srgb, var(--ovse-acc) 22%, transparent); color: var(--ovse-acc2) !important; font-size: 11px; font-weight: 700; text-decoration: none !important; vertical-align: 2px; }
.ovse-pre, .ovse-out { margin: 0 0 10px; padding: 12px 14px; border-radius: 12px; background: color-mix(in srgb, var(--ovse-bg) 60%, #000 40%); border: 1px solid var(--ovse-line); overflow-x: auto; overflow-y: auto; font: 12.5px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre; }
.ovse-say.is-writing .ovse-words > :last-child::after { content: ''; display: inline-block; width: 7px; height: 15px; margin-left: 2px; vertical-align: -2px; border-radius: 2px; background: var(--ovse-acc2); animation: ovse-caret 1s steps(2) infinite; }
/* An answer's receipt (4.298.0): one quiet line; it opens on the spend by rung. */
.ovse-receipt { margin-top: 8px; color: var(--ovse-mute); font-size: 12px; container-type: inline-size; }
.ovse-receipt > summary { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; min-height: 28px; padding: 0 9px 0 7px; border-radius: 999px;
  list-style: none; cursor: pointer; font-variant-numeric: tabular-nums; transition: background .18s, color .18s; }
.ovse-receipt > summary::-webkit-details-marker { display: none; }
.ovse-receipt > summary span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovse-receipt-more { flex: none; margin-left: -3px; }
@container (max-width: 520px) { .ovse-receipt-more { display: none; } }
.ovse-receipt > summary .ovse-g { flex: none; width: 13px; height: 13px; color: var(--ovse-acc2); }
.ovse-receipt > summary:hover, .ovse-receipt[open] > summary { background: color-mix(in srgb, var(--ovse-fg) 6%, transparent); color: var(--ovse-dim); }
.ovse-receipt-rows { display: grid; gap: 4px; margin: 6px 0 2px; padding: 8px 10px; border: 1px solid var(--ovse-line); border-radius: 12px; background: var(--ovse-card); max-width: 460px; }
.ovse-receipt-r { display: grid; grid-template-columns: 16px auto minmax(0, 1fr); align-items: center; gap: 8px; min-height: 24px;
  animation: ovse-receipt-in .26s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 50ms); }
.ovse-receipt-r .ovse-g { width: 14px; height: 14px; color: var(--ovse-acc2); }
.ovse-receipt-r b { color: var(--ovse-fg); font-weight: 650; white-space: nowrap; }
.ovse-receipt-r span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; font-variant-numeric: tabular-nums; }
@keyframes ovse-receipt-in { from { opacity: 0; transform: translateY(calc(3px * var(--ov-move, 1))); } }
html[data-ov-motion="off"] .ovse-receipt-r { animation: none; }
.ovse-sources { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.ovse-source { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; height: 30px; padding: 0 10px 0 4px; border-radius: 999px; background: var(--ovse-card); border: 1px solid var(--ovse-line); color: var(--ovse-dim); font-size: 12.5px; text-decoration: none; }
.ovse-source i { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: color-mix(in srgb, var(--ovse-acc) 22%, transparent); color: var(--ovse-acc2); font-style: normal; font-weight: 700; font-size: 11px; }
.ovse-source span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
.ovse-attach { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
/* 4.313.0: the sites a group of steps looked at, as chips under its line. */
.ovse-acts-h { flex-wrap: wrap; }
.ovse-sites { order: 9; flex-basis: 100%; display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 2px 28px; min-width: 0; }
.ovse-site { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; max-width: 100%; padding: 0 10px 0 4px; border-radius: 999px; border: 1px solid var(--ovse-line); background: var(--ovse-card); color: var(--ovse-dim); font-size: 12.5px; font-weight: 600; min-width: 0; }
.ovse-site span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.ovse-site i { flex: none; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; font-style: normal; font-size: 11px; font-weight: 800; color: #fff; background: hsl(var(--h, 210) 55% 42%); }
.ovse-site.is-more { padding: 0 10px; }
/* 4.313.0: an answer being written, with a caret. */
.ovse-live .ovse-live-t { white-space: pre-wrap; overflow-wrap: anywhere; }
.ovse-live .ovse-live-t::after { content: ""; display: inline-block; width: .5em; height: 1.05em; margin-left: 2px; vertical-align: -3px; border-radius: 2px; background: var(--ovse-acc2); opacity: .7; animation: ovse-caret 1s steps(2, start) infinite; }
@keyframes ovse-caret { to { visibility: hidden; } }
html[data-ov-motion="off"] .ovse-live .ovse-live-t::after { animation: none; }
/* 4.311.0: a picture you sent, as a picture. */
.ovse-thumb-box { display: block; border-radius: 14px; overflow: hidden; border: 1px solid var(--ovse-line); background: var(--ovse-card); max-width: min(260px, 70vw); }
.ovse-thumb-box .ovse-thumb { display: block; width: 100%; height: auto; max-height: 260px; object-fit: cover; }
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
/* 4.310.0 (the owner's phone, 11-18: a tool's JSON ran past the screen): a tool's output wraps inside its box. */
.ovse-out { white-space: pre-wrap; overflow-wrap: anywhere; max-width: 100%; box-sizing: border-box; }
.ovse-pre { max-width: 100%; box-sizing: border-box; }
.ovse-words { min-width: 0; overflow-wrap: anywhere; }
/* 4.310.0: tables, quotes, rules, heading levels and checkbox items in answers. */
.ovse-table { max-width: 100%; overflow-x: auto; overflow-y: hidden; margin: 6px 0 12px; border: 1px solid var(--ovse-line); border-radius: 12px; }
.ovse-table table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
.ovse-table th, .ovse-table td { padding: 8px 12px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--ovse-line); overflow-wrap: normal; word-break: normal; min-width: 64px; }
.ovse-table th { font-weight: 650; color: var(--ovse-fg); background: color-mix(in srgb, var(--ovse-acc) 8%, transparent); white-space: nowrap; }
.ovse-table tbody tr:last-child td { border-bottom: 0; }
.ovse-table tbody tr:nth-child(even) td { background: color-mix(in srgb, var(--ovse-fg) 3%, transparent); }
.ovse-hr { border: 0; border-top: 1px solid var(--ovse-line); margin: 14px 0; }
.ovse-quote { margin: 8px 0; padding: 6px 14px; border-left: 3px solid color-mix(in srgb, var(--ovse-acc) 60%, transparent); color: var(--ovse-dim); }
.ovse-h.is-h1 { font-size: 1.2em; } .ovse-h.is-h2 { font-size: 1.1em; } .ovse-h.is-h3, .ovse-h.is-h4 { font-size: 1em; }
.ovse-checks { list-style: none; padding-left: 4px; }
.ovse-checks li { position: relative; padding-left: 26px; }
.ovse-checks li::before { content: ""; position: absolute; left: 0; top: .2em; width: 15px; height: 15px; border-radius: 5px; border: 1.5px solid var(--ovse-line); }
.ovse-checks li.is-done::before { background: var(--success, #22c55e); border-color: transparent; }
.ovse-checks li.is-done { color: var(--ovse-mute); text-decoration: line-through; }
/* 4.310.0: the plan's assumptions, folded under its checklist. */
.ovse-plan-asm { margin: 0 12px 10px; font-size: 13px; color: var(--ovse-dim); }
.ovse-plan-asm > summary { cursor: pointer; min-height: 32px; display: flex; align-items: center; color: var(--ovse-mute); }
.ovse-plan-asm ul { margin: 2px 0 0; padding-left: 18px; display: grid; gap: 4px; }
/* 4.310.0: a queued message can go now. */
.ovse-queued-row { display: flex; justify-content: flex-end; margin: 6px 0 2px; }
.ovse-sendnow { min-height: 36px; padding: 0 14px; font-size: 13px; }
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
.ovse-foot { position: relative; display: grid; gap: 6px; width: 100%; max-width: 852px; margin: 0 auto; padding: 6px 16px max(10px, env(safe-area-inset-bottom, 0px)); container: ovse-foot / inline-size; }
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
/* The road (4.297.0): where the next answer goes. The ring is the free AI left today; it fills as the read lands. */
@property --ovse-road-p { syntax: '<number>'; inherits: true; initial-value: 0; }
.ovse-road { --ovse-road-c: var(--success, #22c55e); display: inline-flex; align-items: center; gap: 7px; flex: none; min-height: 34px; padding: 0 12px 0 5px;
  border: 1px solid var(--ovse-line); border-radius: 999px; background: var(--ovse-card); color: var(--ovse-dim); font: inherit; font-size: 12.5px; font-weight: 650;
  font-variant-numeric: tabular-nums; white-space: nowrap; cursor: pointer; transition: color .18s, border-color .18s, transform .12s, --ovse-road-p .9s cubic-bezier(.2,.8,.2,1);
  animation: ovse-road-in .32s cubic-bezier(.2,.8,.2,1) both; }
.ovse-road[hidden] { display: none; }
.ovse-road:hover { color: var(--ovse-fg); border-color: color-mix(in srgb, var(--ovse-road-c) 45%, var(--ovse-line)); }
.ovse-road:active { transform: scale(.97); }
.ovse-road-ring { position: relative; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; font-style: normal; }
.ovse-road-ring::before { content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: conic-gradient(var(--ovse-road-c) calc(var(--ovse-road-p) * 360deg), color-mix(in srgb, var(--ovse-road-c) 18%, transparent) 0);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px)); mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px)); }
.ovse-road-ring svg { position: relative; width: 13px; height: 13px; color: var(--ovse-road-c); }
.ovse-road.is-key, .ovse-road.is-computer { --ovse-road-c: var(--ovse-acc2, #8ab4ff); --ovse-road-p: 1; }
.ovse-road.is-none { --ovse-road-c: var(--warning, #f5a524); color: var(--warning, #f5a524); border-color: color-mix(in srgb, var(--warning, #f5a524) 40%, var(--ovse-line)); }
/* A narrow box (a phone, the menu's panel): the ring alone keeps the row to one line; its label says the rest. */
@container ovse-foot (max-width: 480px) { .ovse-road { gap: 0; padding: 0 5px; } .ovse-road > span { display: none; } }
@keyframes ovse-road-in { from { opacity: 0; transform: translateY(calc(4px * var(--ov-move, 1))) scale(.96); } }
html[data-ov-motion="off"] .ovse-road { animation: none; transition: none; }
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
/* 4.311.0: the spent free AI, one card (in a thread, under an approval, or floating over the box). */
.ovse-spent { display: grid; gap: 8px; margin-top: 10px; padding: 12px 14px; border-radius: 16px; border: 1px solid color-mix(in srgb, var(--warning, #f5a524) 45%, var(--ovse-line)); background: color-mix(in srgb, var(--ovse-bg) 88%, var(--warning, #f5a524) 12%); color: var(--ovse-fg); text-align: left; }
.ovse-spent-h { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ovse-spent-h b { flex: 1; min-width: 0; font-size: 14.5px; }
.ovse-spent-h > .ovse-g { flex: none; width: 18px; height: 18px; color: var(--warning, #f5a524); }
.ovse-spent-x { flex: none; display: inline-grid; place-items: center; width: 36px; height: 36px; margin: -6px -8px -6px 0; border: 0; border-radius: 999px; background: transparent; color: var(--ovse-mute); cursor: pointer; }
.ovse-spent-x .ovse-g { width: 16px; height: 16px; }
.ovse-spent-l { margin: 0; color: var(--ovse-dim); font-size: 13px; line-height: 1.45; }
.ovse-spent-acts { display: flex; flex-wrap: wrap; gap: 8px; }
.ovse-spent-b { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--ovse-line); background: var(--ovse-card); color: var(--ovse-fg); font: inherit; font-size: 13.5px; font-weight: 650; cursor: pointer; transition: transform .12s ease, border-color .15s ease; }
.ovse-spent-b .ovse-g { width: 16px; height: 16px; color: var(--ovse-acc2); }
.ovse-spent-b.is-primary { background: var(--ovse-acc); border-color: transparent; color: var(--on-accent, #fff); }
.ovse-spent-b.is-primary .ovse-g { color: currentColor; }
.ovse-spent-b.is-quiet { background: transparent; }
.ovse-spent-b:hover { border-color: color-mix(in srgb, var(--ovse-acc) 60%, transparent); }
.ovse-spent-b:active { transform: scale(calc(1 - .03 * var(--ov-move, 1))); }
.ovse-spent.is-float { position: absolute; z-index: 7; left: 16px; right: 16px; bottom: 120px; margin: 0 auto; max-width: 460px; box-shadow: 0 18px 40px -18px rgba(0,0,0,.55); animation: ovse-spent-in .28s cubic-bezier(.2,.8,.2,1); }
.ovse-spent.is-out { opacity: 0; transform: translateY(calc(8px * var(--ov-move, 1))); transition: opacity .25s ease, transform .25s ease; }
@keyframes ovse-spent-in { from { opacity: 0; transform: translateY(calc(12px * var(--ov-move, 1))); } }
/* 4.311.0: the box's row on one line: the modes, one chip that gives way, the road. */
.ovse-ctxrow { flex-wrap: nowrap; }
.ovse-ctxrow > .ovse-modes, .ovse-ctxrow > .ovse-road, .ovse-ctxrow > .ovse-cost, .ovse-ctxrow > .ovse-level { flex: none; }
/* 4.313.0: the approval level chip; on a narrow phone only its glyph. */
.ovse-level { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; min-width: 34px; padding: 0 11px 0 9px; border-radius: 999px; border: 1px solid var(--ovse-line); background: var(--ovse-card); color: var(--ovse-dim); font: inherit; font-size: 12.5px; font-weight: 650; cursor: pointer; }
.ovse-level svg { flex: none; width: 15px; height: 15px; color: var(--ovse-acc2); }
.ovse-level[data-level="full"] svg, .ovse-level[data-level="approve-for-me"] svg { color: var(--warning, #f5a524); }
.ovse-level:hover, .ovse-level:focus-visible { color: var(--ovse-fg); border-color: var(--ovse-acc2); }
@media (max-width: 430px) { .ovse-level { padding: 0; justify-content: center; } .ovse-level span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; } }
.ovse-ctxrow > .ovse-ctx { flex: 0 1 auto; min-width: 0; }
.ovse-ctxrow > .ovse-ctxinfo { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 480px) { .ovse-ctxrow > .ovse-cost { display: none; } }
/* 4.311.0: the hello's card, a row per choice with what it means. */
.ovse-how.is-list { display: grid; gap: 0; width: min(520px, 100%); box-sizing: border-box; margin: 4px auto 14px; padding: 4px 4px 6px; border: 1px solid var(--ovse-line); border-radius: 18px; background: var(--ovse-card); justify-content: stretch; }
.ovse-how-h { margin: 8px 12px 4px; font-size: 11.5px; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; color: var(--ovse-mute); text-align: left; }
.ovse-how.is-list .ovse-how-c { display: grid; grid-template-columns: 36px minmax(0, 1fr) 16px; align-items: center; gap: 12px; width: 100%; max-width: none; min-height: 62px; padding: 8px 10px; border: 0; border-radius: 14px; background: transparent; text-align: left; }
.ovse-how.is-list .ovse-how-c { position: relative; }
.ovse-how.is-list .ovse-how-c + .ovse-how-c::before { content: ""; position: absolute; top: 0; left: 58px; right: 12px; height: 1px; background: color-mix(in srgb, var(--ovse-line) 80%, transparent); }
.ovse-how.is-list .ovse-how-c:hover { background: color-mix(in srgb, var(--ovse-acc) 7%, transparent); }
.ovse-how-i { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 11px; background: color-mix(in srgb, var(--ovse-acc) 15%, transparent); color: var(--ovse-acc2); }
.ovse-how.is-list .ovse-how-i .ovse-g { width: 20px; height: 20px; }
.ovse-how.is-list .ovse-how-t { display: grid; gap: 1px; min-width: 0; }
.ovse-how.is-list .ovse-how-t b { max-width: none; font-size: 14.5px; }
.ovse-how-l { font-size: 12.5px; line-height: 1.35; color: var(--ovse-mute); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ovse-how.is-list .ovse-how-go { width: 16px; height: 16px; color: var(--ovse-mute); }
.ovse-how.is-list .ovse-how-c.is-own .ovse-how-i { background: transparent; border: 1px dashed var(--ovse-line); }
/* 4.310.0: the flash is a card in the theme (it was a white pill): a glyph, the words, a link as a button; errors tinted. */
.ovse-flash { display: flex; align-items: center; gap: 10px; border-radius: 14px; padding: 10px 12px 10px 14px; width: max-content; max-width: min(460px, calc(100% - 32px)); box-sizing: border-box;
  background: color-mix(in srgb, var(--ovse-bg) 82%, var(--ovse-fg) 18%); color: var(--ovse-fg); border: 1px solid var(--ovse-line); font-weight: 550; line-height: 1.4; cursor: pointer;
  backdrop-filter: blur(10px); box-shadow: 0 14px 36px rgba(0,0,0,.35); }
.ovse-flash.is-bad { border-color: color-mix(in srgb, var(--danger, #ef4444) 55%, var(--ovse-line)); background: color-mix(in srgb, var(--ovse-bg) 80%, var(--danger, #ef4444) 20%); }
.ovse-flash .ovse-flash-g { flex: none; width: 18px; height: 18px; color: var(--ovse-acc2); }
.ovse-flash.is-bad .ovse-flash-g { color: var(--danger, #ef4444); }
.ovse-flash-t { min-width: 0; overflow-wrap: anywhere; }
.ovse-flash-go { flex: none; min-height: 36px; display: inline-flex; align-items: center; padding: 0 12px; border-radius: 10px; background: var(--ovse-acc); color: #fff; text-decoration: none; font-weight: 650; }
.ovse-allow-l { margin: 4px 0 10px; color: var(--ovse-dim); }
.ovse-gsheet-go { min-height: 44px; flex: none; }

@keyframes ovse-in { from { opacity: 0; transform: translateY(calc(8px * var(--ov-move, 1))); } }
@keyframes ovse-pop { from { opacity: 0; transform: scale(.94); } }
@keyframes ovse-shim { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@keyframes ovse-beat { 0%, 100% { opacity: .45; transform: scale(.85); } 50% { opacity: 1; transform: scale(1); } }
@keyframes ovse-caret { 50% { opacity: 0; } }
@keyframes ovse-float { 50% { transform: translateY(calc(-4px * var(--ov-move, 1))); } }
.ovse-flash { animation-name: ovse-flash-in; } @keyframes ovse-flash-in { from { opacity: 0; transform: translate(-50%, 10px); } }
html[data-ov-motion="off"] .ovse *, html[data-ov-motion="off"] .ovse-sheet, html[data-ov-motion="off"] .ovse-veil, html[data-ov-motion="off"] .ovse-flash, html[data-ov-motion="off"] .ovse-spent { animation: none !important; transition: none !important; }
.ovse-chg b { font-weight: 700; color: var(--ovse-fg); } .ovse-chg span { margin-left: -4px; }
@media (max-width: 899px) { .ovse-chg span { display: none; } .ovse-chg { padding: 0 10px; } }
`;
        const st = document.createElement('style'); st.id = 'ovse-styles'; st.textContent = css; document.head.appendChild(st);
    }

    root.OpenVibeSession = { mount, card, version: 1 };
})(typeof window !== 'undefined' ? window : globalThis);
