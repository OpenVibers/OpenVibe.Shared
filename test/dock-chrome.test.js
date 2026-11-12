'use strict';
// The menu's Chat and Vibe places (dock.js's panels; Dock plan 2026-10-30 K-D1, and 4.220.0: the owner, 11-12, "there
// should only be the one unified UI … delete … the old tab system") in a real headless Chrome, against a local stand-in
// for the Network's GET/PUT /api/v1/me/dock, /api/v1/me/actions, Chat's DM and Vibe APIs and Codes' agent view:
//   • no floating Dock and no pill, ever: what the pill said is a status on the bar's menu button (agents working, one
//     needs you, a timer's minutes), and a 404 (Network without the route yet) or a signed-out page says nothing;
//   • the menu button opens on Agents when something needs you (waiting first, approve in place); Escape closes it;
//     every change reaches the Network as one debounced PUT;
//   • Chats (K-D2): the person's conversations with their unread counts, a thread opened in place (theirs and mine), Edit
//     as a pencil at the bubble's corner with the box as the editor, Enter sends, read, the open chat is the state;
//   • Send to (4.144.0), the agent view (K-D3), and nothing off a 320 px screen;
//   • Vibe (L48 V2): starters before the first message, a question and Vibe's answer in place, voice without the
//     browser's speech recognition, and the Vibe place kept in the Network's state;
//   • the timer (L48 R2): the Vibe place's timer button starts one, the menu button counts it down, its end says so
//     and clears it, and a focus round's end writes its break from that same end;
//   • Ask your agent: a page's [data-ov-ask] opens the menu on Vibe with the question in the box, unsent.
// Skipped (exit 0) without Chrome or with OV_SKIP_BROWSER=1.
const assert = require('assert');
const { eventually } = require('../browser-harness');   // a check retries until the page is there (5 s ceiling)
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const h = require('../browser-harness');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('dock-chrome: skipped (no Chrome; set CHROME_BIN)');
    process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const iso = (ago) => new Date(Date.now() - ago).toISOString();
const item = (o) => ({ actions: [], cost_usd: null, steps: null, kind: 'task', error: null, next_run_at: null, updated_at: iso(60e3), ...o });
const ACTIONS = {
    generated_at: iso(2000), sources: { actor: 'ok', codes: 'ok' },
    counts: { running: 2, waiting: 1, scheduled: 0, done: 0, failed: 0 },
    buckets: {
        waiting: [item({ id: 'apr_1', service: 'actor', agent: 'Researcher', bucket: 'waiting', state: 'waiting', title: 'Send the weekly digest?', summary: 'It wants to send from your address.', href: 'https://openvibe.actor/tasks/t1', actions: ['approve', 'decline'] })],
        running: [
            item({ id: 'tsk_1', service: 'codes', agent: 'Codex', bucket: 'running', state: 'running', title: 'Fix the flaky upload test', summary: 'Step 14: the suite.', href: 'https://openvibe.codes/run/tasks/tsk_1', steps: 14 }),
            item({ id: 't2', service: 'actor', agent: 'Actor', bucket: 'running', state: 'running', title: 'Compare three VPS offers', summary: 'Reading the providers.', href: 'https://openvibe.actor/tasks/t2', steps: 6 }),
        ],
        scheduled: [], done: [], failed: [],
    },
};
// The Dock v2's rows (plan 2026-11-09 §8): a skill, a subject, a model, a maker, a cost, a duration, a live step and,
// for a failure, safe words and the next step. Six identical failures in a day are one row.
const DOCK_ACTIONS = {
    generated_at: iso(2000), sources: { actor: 'ok', codes: 'ok' },
    counts: { running: 1, waiting: 1, scheduled: 1, done: 2, failed: 6 },
    buckets: {
        waiting: [item({ id: 'apr_1', service: 'actor', agent: 'Actor', kind: 'agent_task', bucket: 'waiting', state: 'waiting',
            skill: 'blog.write', subject: { kind: 'post', title: 'Patch notes draft', url: 'https://openvibe.blog/posts/42' },
            title: 'Patch notes draft', summary: 'It needs the release name to finish the notes.', href: 'https://openvibe.actor/tasks/t3',
            actions: ['approve', 'decline'] })],
        running: [item({ id: 'tsk_1', service: 'actor', agent: 'Actor', kind: 'agent_task', bucket: 'running', state: 'running',
            skill: 'changelog-draft', subject: { kind: 'post', title: 'Patch notes draft · OpenVibe blog', url: 'https://openvibe.blog/posts/42' },
            title: 'Patch notes draft · OpenVibe blog', step: 'Writing the release notes…', model: 'gpt-5-nano', maker: 'OpenAI',
            duration_ms: 42000, href: 'https://openvibe.actor/tasks/tsk_1', steps: 14 })],
        scheduled: [item({ id: 'tsk_4', service: 'actor', agent: 'Actor', kind: 'agent_task', bucket: 'scheduled', state: 'scheduled',
            skill: 'wiki-article', subject: { kind: 'wiki', title: 'The Dock, for beginners', url: 'https://openvibe.wiki/a/dock' },
            title: 'Make a wiki article', next_run_at: new Date(Date.now() + 42 * 60e3).toISOString(), href: 'https://openvibe.actor/tasks/tsk_4' })],
        done: [
            item({ id: 'tsk_5', service: 'actor', agent: 'Actor', kind: 'agent_task', bucket: 'done', state: 'succeeded',
                skill: 'changelog-draft', subject: { kind: 'post', title: '4.162.0 release notes', url: 'https://openvibe.blog/posts/39' },
                title: '4.162.0 release notes', summary: 'The draft is ready for review.', cost_usd: 0.0031, duration_ms: 68000,
                model: 'gpt-5-nano', maker: 'OpenAI', href: 'https://openvibe.blog/posts/39' }),
            item({ id: 'tsk_6', service: 'actor', agent: 'Actor', kind: 'agent_task', bucket: 'done', state: 'succeeded',
                skill: 'wiki-article', subject: { kind: 'wiki', title: 'What is a Dock?', url: 'https://openvibe.wiki/a/dock' },
                title: 'What is a Dock?', summary: 'The article is a draft with its sources.', cost_usd: 0.0124, duration_ms: 154000,
                model: 'claude-sonnet-4-5', maker: 'Anthropic', href: 'https://openvibe.wiki/a/dock' }),
        ],
        failed: Array.from({ length: 6 }, (_, i) => item({ id: `fail_${i}`, service: 'actor', agent: 'Actor', kind: 'agent_task', bucket: 'failed', state: 'failed',
            skill: 'blog.write', subject: { kind: 'post', title: 'Draft a blog post', url: null }, title: 'Draft a blog post',
            error: 'No model could take this task.',
            run_error: { code: 'route.unavailable', words: 'No model could take this task.', next: 'Pick a model or add an AI key, then retry.', action: 'pick_model' },
            href: 'https://openvibe.actor/tasks/fail_0', updated_at: iso(3600e3 * (i + 1)) })),
    },
};
// The Dock v2's Chats row and the Vibe list: a person's AI conversations, newest first.
const DOCK_VIBE = {
    count: 12,
    conversations: [
        { slug: 'v-1', name: 'Patch notes for 4.162', last_message_at: iso(4 * 60e3), created_at: iso(2 * 3600e3), last_line: 'I wrote the first draft.', last_answer_at: iso(4 * 60e3), site: 'openvibe.blog' },
        { slug: 'v-2', name: 'What is on today?', last_message_at: iso(90 * 60e3), created_at: iso(26 * 3600e3), last_line: 'Three things, starting with the release.', last_answer_at: iso(90 * 60e3), site: 'openvibe.today' },
        { slug: 'v-3', name: 'Memes for the launch', last_message_at: iso(2 * 86400e3), created_at: iso(9 * 86400e3), last_line: 'Here are three, pick one.', last_answer_at: iso(2 * 86400e3), site: 'openvibe.meme' },
    ],
};
const NOTES = [
    { id: 1, type: 'agent_done', category: 'agents', service: 'codes', title: 'Codes finished a task', message: 'The suite passed.', priority: 'normal', is_read: 0, created_at: iso(300e3) },
    { id: 2, type: 'mention', category: 'social', service: 'chat', title: 'kai mentioned you', message: 'look at the shots?', priority: 'normal', is_read: 0, created_at: iso(900e3) },
];

// The stand-in's state for the scenario under way.
let scenario = {};
const puts = [], decided = [], said = [], reads = [], started = [];
// K-D3: the agent view Codes' API answers (dock-agent.js) and the controls the Dock pressed.
let agentView = null;
const controls = [];
const AGENT_ID = 'ags_01JAB2C3D4E5F6G7H8J9K0MNPQ';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
// Chat's Vibe API for the Dock (OpenVibe.Chat server/rooms/vibe-api.js): one chat, Vibe answering a moment later.
let vibeChat = null;
const vibeMsgs = [], asked = [], listened = [], undone = [];
const defaultState = () => ({ open: false, tab: 'activity', pinned: false, agent: null, chat: null, place: { phone: { corner: 'bottom-right' }, desktop: { corner: 'bottom-right', width: null, height: null } }, updated_at: iso(0) });

const PAGE = (o) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tasks</title><link rel="icon" href="data:,">
<style>body{margin:0;font:15px system-ui}main{padding:16px}p{margin:0 0 12px}@media(prefers-color-scheme:light){:root{--bg:#fff;--bg-primary:#fff;--bg-elevated:#fff;--bg-secondary:#f4f6fa;--text-primary:#18202f;--text-secondary:#5d6779;--border:#dce0e8;--accent:#2365dc;--on-accent:#fff}}</style></head>
<body><div id="navbar-mount"></div><main>${'<p>Fix the flaky upload test in the Media client and add a regression case.</p>'.repeat(30)}</main>
<script src="/navbar.js"></script>
<script>OpenVibeNavbar.init({ service: 'codes', brandName: 'OpenVibe.Codes', notifications: false, dockApiBase: location.origin, dockChatBase: location.origin, dockAgentBase: location.origin,
  ${o.signedIn === false ? 'user: null,' : "token: 'tok_user', user: { id: 7, username: 'ada', display_name: 'Ada', avatar_url: null },"}
  links: [{ label: 'Tasks', href: '/', icon: 'fa-list' }] });</script></body></html>`;

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
        if (u.pathname === '/page') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE({ signedIn: u.searchParams.get('in') !== '0' })); }
        if (u.pathname === '/api/v1/me/dock') {
            if (scenario.missing) return json(404, { code: 'not_found' });
            assert.strictEqual(req.headers.authorization, 'Bearer tok_user', 'the Dock reads with the person\'s token');
            if (req.method === 'PUT') { const b = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); puts.push(b); scenario.state = { ...(scenario.state || defaultState()), ...b, place: { ...((scenario.state || defaultState()).place), ...(b.place || {}) } }; }
            return json(200, { state: scenario.state || defaultState(), counts: scenario.counts || { running: 0, waiting: 0, unread: 0 }, sources_partial: false });
        }
        if (u.pathname === '/api/v1/me/actions') return json(200, scenario.actions || ACTIONS);
        // 4.225.0: the menu's Vibe lists runs from the Frame (Network /api/frame/runs, agents.run@1).
        if (u.pathname === '/api/frame/runs' && req.method === 'GET') {
            assert.strictEqual(req.headers.authorization, 'Bearer tok_user', 'the runs are read with the person\'s own token');
            return json(200, { runs: [{ id: 'v-1', ref: 'chat:v-1', kind: 'chat', title: 'Patch notes for 4.162', status: 'waiting', waiting: { for: 'message' }, agent: { id: 'vibe', name: 'Vibe', glyph: 'spark' }, preview: { text: 'I wrote the first draft.' }, updated_at: iso(4 * 60e3) }], next: null, partial: [] });
        }
        // Actor's skill catalogue, as the Dock's overview reads it: through Network's actions.
        if (u.pathname === '/api/v1/me/actions/skills') return json(200, { listings: (scenario.skills || [1, 2, 3, 4, 5, 6]).map((n) => ({
            id: `skl_${n}`, skill: { slug: `skill-${n}`, name: ['Make an image', 'Make a wiki article', 'Write a blog post', 'Improve an article', 'Make a meme', 'Summarise a thread'][n - 1] },
            scan: { state: 'passed' }, curator: { state: 'active' } })) });
        // Codes' agent view (K-D3): the stream, its two controls, and the still.
        if (u.pathname === '/api/v1/me/agent-view' && req.method === 'GET') {
            assert.strictEqual(req.headers.authorization, 'Bearer tok_user', 'the agent view is read with the person\'s own token');
            return json(200, { agent: agentView });
        }
        if (u.pathname === '/api/v1/me/agent-view/frame') {
            res.writeHead(200, { 'content-type': 'image/jpeg' });
            return res.end(JPEG);
        }
        const ctl = /^\/api\/v1\/me\/agent-view\/(pause|curtain|mute|end)$/.exec(u.pathname);
        if (ctl && req.method === 'POST') {
            assert.strictEqual(req.headers.authorization, 'Bearer tok_user', `${ctl[1]} is pressed with the person's own token`);
            controls.push(ctl[1]);
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
            agentView = ctl[1] === 'pause' ? { ...agentView, paused: !!body.paused, paused_by: body.paused ? 'ada' : null }
                : ctl[1] === 'curtain' ? { ...agentView, curtain: { up: true } }
                : ctl[1] === 'mute' ? { ...agentView, voice_muted: !!body.muted }
                : { ...agentView, state: 'ended', paused: false, paused_by: null, embed_url: null, last_frame_url: '/api/v1/me/agent-view/frame' };
            return json(200, { agent: agentView });
        }
        const m = /^\/api\/v1\/me\/actions\/(\w+)\/(\w+)\/(approve|decline)$/.exec(u.pathname);
        if (m && req.method === 'POST') { decided.push(m.slice(1).join(':')); return json(200, { item: ACTIONS.buckets.waiting[0] }); }
        // Chat's DM API, as OpenVibe.Chat answers it (server/chat/dm-routes.js).
        if (u.pathname === '/api/dm/unread') return json(200, { unread: 3 });
        if (u.pathname === '/api/dm/users/search') return json(200, { users: [{ id: 4, username: 'mia', display_name: 'Mia' }, { id: 5, username: 'miandra', display_name: 'Miandra' }] });
        if (u.pathname === '/api/dm/conversations' && req.method === 'POST') { started.push(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}').user_ids); return json(201, { conversation: { id: 13 } }); }
        if (u.pathname === '/api/dm/conversations') {
            const ada = { id: 1, username: 'ada', display_name: 'Ada' }, kai = { id: 2, username: 'kai', display_name: 'Kai Moreno' }, jo = { id: 3, username: 'jo', display_name: 'Jo' };
            return json(200, { conversations: [
                { id: 11, name: null, is_group: false, last_message: 'see the shots?', last_sender_id: 2, last_message_at: iso(240e3), unread_count: 2, participants: [ada, kai] },
                { id: 12, name: 'Design crit', is_group: true, last_message: 'Shipped it', last_sender_id: 1, last_message_at: iso(3600e3), unread_count: 0, participants: [ada, kai, jo] },
            ] });
        }
        const dm = /^\/api\/dm\/conversations\/(\d+)\/(messages|read)$/.exec(u.pathname);
        if (dm && dm[2] === 'read') { reads.push(dm[1]); return json(200, { ok: true }); }
        const dmEdit = /^\/api\/dm\/conversations\/(\d+)\/messages\/(\d+)$/.exec(u.pathname);
        if (dmEdit && req.method === 'PATCH') { const text = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}').message; return json(200, { message: { id: Number(dmEdit[2]), message: text, card: null, edited_at: new Date().toISOString() } }); }
        if (dm && req.method === 'POST') { said.push(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}').message); return json(201, { message: { id: 900 + said.length } }); }
        if (dm) {
            const after = Number(u.searchParams.get('after')) || 0;
            // A known OpenVibe link's card, as Chat's link cards put it on a message (4.147.0, dock-card.js); and one that
            // tries a script link, a picture from elsewhere and a script button, which draws as plain text only.
            const card = { kind: 'video', url: 'https://openvibe.video/v/42', title: 'The studio tour', line: '12:04 · Kai Moreno', image: 'https://openvibe.media/t/abc?w=320', action: { label: 'Watch together', href: 'https://openvibe.party/new?media=https%3A%2F%2Fopenvibe.video%2Fv%2F42' } };
            const bad = { kind: 'video', url: 'javascript:alert(1)', title: '<img src=x>', line: 'x', image: 'https://evil.example/p.png', action: { label: 'Go', href: 'javascript:alert(2)' } };
            const all = [{ id: 101, username: 'kai', display_name: 'Kai Moreno', message: 'see the shots?', card, created_at: iso(240e3) }, { id: 102, username: 'ada', display_name: 'Ada', message: '<b>on it</b>', card: bad, created_at: iso(120e3) }]
                .concat(said.map((m, i) => ({ id: 901 + i, username: 'ada', display_name: 'Ada', message: m, created_at: iso(0) })));
            return json(200, { messages: all.filter((m) => m.id > after) });
        }
        if (u.pathname === '/api/vibe/conversations') return json(200, scenario.vibe || { conversations: [], count: 0 });
        if (u.pathname === '/api/vibe/chat') {
            assert.strictEqual(req.headers.authorization, 'Bearer tok_user', 'Vibe is asked with the person\'s own token');
            const after = Number(u.searchParams.get('after')) || 0;
            return json(200, { chat: vibeChat, messages: vibeMsgs.filter((m) => m.id > after) });
        }
        if (u.pathname === '/api/vibe/undo' && req.method === 'POST') {
            const b = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
            undone.push(b);
            const m = vibeMsgs.find((x) => x.id === b.message_id);
            if (!m || !m.results || !m.results[b.index]) return json(404, { error: 'No such result' });
            m.results = m.results.map((r, k) => (k === b.index ? { ...r, action: 'stopped' } : r));
            return json(200, { results: m.results, undone: { kind: 'reminder', id: m.results[b.index].id, title: m.results[b.index].title } });
        }
        if (u.pathname === '/api/vibe/listen' && req.method === 'POST') {
            listened.push({ type: req.headers['content-type'], bytes: Buffer.concat(chunks).length, lang: u.searchParams.get('lang'), auth: req.headers.authorization });
            return json(200, { text: 'remind me to drink water at 3' });
        }
        if (u.pathname === '/api/vibe/ask' && req.method === 'POST') {
            const b = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
            asked.push(b);
            vibeChat = vibeChat || { slug: 'v1', name: 'Vibe', url: 'https://openvibe.chat/vibe/v1' };
            const mine = { id: 500 + vibeMsgs.length, from: 'you', text: b.message, at: iso(0) };
            vibeMsgs.push(mine);
            setTimeout(() => vibeMsgs.push({ id: 600 + vibeMsgs.length, from: 'vibe', text: 'Reminder set: Stretch, every 2 hours. See them at https://openvibe.today/reminders', at: iso(0),
                results: [{ kind: 'reminder', action: 'set', id: 'rem_01J8Z3V9Q6N1X2Y3Z4A5B6C7E1', title: 'Stretch', when: 'Every 2 hours, 9 am–5 pm', url: 'https://openvibe.today/me#reminders' }] }), 700);
            return json(201, { chat: vibeChat, message: mine });
        }
        if (u.pathname === '/api/notifications/unread-count') return json(200, { count: 2 });
        if (u.pathname === '/api/notifications/unread-by-tab') return json(200, { tabs: { all: 2 } });
        if (u.pathname === '/api/notifications') return json(200, { notifications: NOTES, total: NOTES.length, has_more: false });
        const name = u.pathname.slice(1);
        if (/^[a-z-]+\.js$/.test(name) && fs.existsSync(path.join(ROOT, name))) { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, name))); }
        res.writeHead(404); res.end();
    });
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(p, expr, what, ms = 15000) {   // a limit on a poll: a loaded runner drew the pill after 5 s
    const end = Date.now() + ms;
    for (;;) {
        const v = await p.evaluate(expr);
        if (v) return v;
        if (Date.now() > end) throw new Error(`timed out: ${what}`);
        await wait(80);
    }
}
// 4.220.0: what the Dock's pill said is the menu button's status; the panels are the menu's places.
const STATUS = `(() => { const b = [...document.querySelectorAll('#openvibe-search-btn, #openvibe-burger.ovnav-orb')].find((x) => x.getBoundingClientRect().width > 0);
    if (!b || !b.getAttribute('data-ov-status')) return null; const c = b.querySelector('.ovnav-st');
    return { tone: b.getAttribute('data-ov-status'), label: b.getAttribute('data-ov-tip'), text: c ? c.textContent : '' }; })()`;
const PLACE = `(() => { const c = document.querySelector('.ovs.is-open .ovs-door-host .ovdk'); if (!c) return null; const panel = c.querySelector('[data-panel]:not([hidden])');
    return { tab: panel && panel.dataset.panel, groups: [...new Set([...c.querySelectorAll('.ovdk-run[data-bucket]')].map((g) => g.dataset.bucket))], items: c.querySelectorAll('.ovac-item').length }; })()`;
const OPEN = (tab) => `(window.OpenVibeDock.open({ tab: '${tab}' }), true)`;
const MENU_BUTTON = "[...document.querySelectorAll('#openvibe-search-btn, #openvibe-burger.ovnav-orb')].find((x) => x.getBoundingClientRect().width > 0).click()";
const NO_FLOATING = "!document.querySelector('#ovdk-pill, .ovdk-pill') && [...document.querySelectorAll('.ovdk')].every((d) => !!d.closest('.ovs-door-host'))";


(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-dock-'));
    const browser = await h.launch({ tmpDir });
    const fresh = async (width, height = 860) => { const context = await browser.newContext(); const p = await h.openPage(browser, context, { width, height }); return p; };
    const PART = Number(process.env.DOCK_CHROME_PART == null ? 1 : process.env.DOCK_CHROME_PART);
    try {
        if (process.env.DOCK_SHOTS_DIR) {
            fs.mkdirSync(process.env.DOCK_SHOTS_DIR, { recursive: true });
            const shot = async (p, name) => {
                await wait(400);
                const docWidth = await p.evaluate('document.documentElement.scrollWidth');
                assert.ok(docWidth <= p.width && docWidth >= p.width - 20, `${p.width} px: no sideways scroll (${docWidth})`);
                const pic = await p.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
                fs.writeFileSync(path.join(process.env.DOCK_SHOTS_DIR, `${name}-${p.width}-${p.scheme}.png`), Buffer.from(pic.data, 'base64'));
            };
            for (const width of [390, 1280]) for (const scheme of ['dark', 'light']) {
                // The Agents list: a running run, one waiting, one scheduled, two done and six identical failures.
                scenario = { counts: { running: 1, waiting: 1, unread: 0 }, actions: DOCK_ACTIONS, vibe: DOCK_VIBE };
                const p = await fresh(width, 900);
                p.width = width; p.scheme = scheme;
                await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
                await p.goto(`${base}/page`, { maxMs: 5000 });
                await until(p, "!!window.OpenVibeDock", 'the Dock');
                await p.evaluate("window.OpenVibeDock.open({ tab: 'agent' })");
                await until(p, "document.querySelectorAll('.ovdk-run').length >= 4", 'the screenshot runs');
                await shot(p, 'agents');

                // The overview: nothing runs, so the tab says what is next, what happened and what agents can do.
                scenario = { counts: { running: 0, waiting: 0, unread: 0 }, state: { ...defaultState(), pinned: true },
                    actions: { ...DOCK_ACTIONS, counts: { running: 0, waiting: 0, scheduled: 1, done: 2, failed: 6 } }, vibe: DOCK_VIBE };
                await p.goto(`${base}/page`, { maxMs: 5000 });
                await until(p, "!!window.OpenVibeDock", 'the Dock');
                await p.evaluate("window.OpenVibeDock.open({ tab: 'agent' })");
                await until(p, "!!document.querySelector('.ovdk-overview')", 'the overview');
                await shot(p, 'overview');

                // The Vibe tab: the list of the person's conversations.
                await p.evaluate(OPEN('vibe'));
                await until(p, "document.querySelectorAll('.ovdk-vibe-list button').length >= 3", 'the Vibe list');
                await shot(p, 'vibe');

                // The Chats tab: the AI chats row among the DMs.
                await p.evaluate(OPEN('chats'));
                await until(p, "!!document.querySelector('.ovdk-chat-b b')", 'the Chats rows');
                await shot(p, 'chats');
                await p.close();
            }
            if (process.env.DOCK_SHOTS_ONLY) return;
        }
        // Two halves (each well under the runner's 60 s; the whole file took about 65 s and timed out on macOS): this file
        // runs the first (DOCK_CHROME_PART 1, the default), test/dock-vibe-timer-chrome.test.js the second, 0 both.
        if (PART !== 2) {
        // ── Nothing runs, nothing waits: the menu button says nothing. Agents working: a breathing dot on it. No pill. ──
        {
            scenario = { counts: { running: 0, waiting: 0, unread: 3 } };
            const p = await fresh(390);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            await until(p, "!!window.OpenVibeDock", 'the panels beside the navbar');
            await wait(700);
            await eventually(async () => assert.strictEqual(await p.evaluate(STATUS), null, 'nothing to say while nothing runs or waits (unread alone is the bell\'s)'));
            await eventually(async () => assert.strictEqual(await p.evaluate(NO_FLOATING), true, 'no pill and no floating Dock'));
            scenario.counts = { running: 2, waiting: 0, unread: 0 };
            await p.goto(`${base}/page`, { maxMs: 5000 });
            const st = await until(p, STATUS, 'the status on the menu button');
            assert.deepStrictEqual([st.tone, st.label, st.text], ['running', '2 working', ''], 'agents working: a dot, named in the tooltip');
            await p.close();
        }

        // ── A phone: the menu button says what matters and opens on Agents; approve in place; Escape closes it. ──
        {
            scenario = { counts: { running: 2, waiting: 1, unread: 2 } };
            puts.length = 0; decided.length = 0;
            const p = await fresh(390, 780);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            const st = await until(p, STATUS, 'the status');
            assert.deepStrictEqual([st.tone, st.label], ['waiting', '1 needs you'], 'what needs you comes first');
            await p.evaluate(MENU_BUTTON);
            const place = await until(p, `(() => { const c = ${PLACE}; return c && c.items ? c : null; })()`, 'the menu, open on Agents');
            assert.deepStrictEqual([place.tab, place.groups, place.items], ['agent', ['waiting', 'running'], 3], 'what needs you first, then what runs');
            assert.strictEqual(await p.evaluate(NO_FLOATING), true, 'inside the menu, nothing floating');
            await p.evaluate("document.querySelector('.ovdk .ovac-item[data-bucket=waiting] button[data-do=approve]').click()");
            await until(p, "document.querySelector('.ovdk .ovac-item[data-bucket=waiting] .primary').textContent === 'Approved'", 'approved in place');
            assert.deepStrictEqual(decided, ['actor:apr_1:approve'], 'the approval goes to the Network for that item');
            await p.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))");
            await until(p, "!document.querySelector('.ovs.is-open')", 'Escape closes the menu');
            await eventually(async () => assert.ok(puts.some((b) => b.tab === 'agent'), `the Network heard the place (${JSON.stringify(puts)})`));
            assert.ok(puts.length <= 3, `changes go as debounced PUTs, not one per click (${puts.length})`);
            await p.close();
        }

        // ── 4.225.0: the menu's Vibe is one list (ov-run.js) under All · Chats · Tasks · Code: runs from the Frame and the
        // Action Center's work together, the Dock's Now, Actor and live view above; Chats, Tasks and Code are the Dock's
        // own panels, lent whole. No Chat · Code · Agents switch. ──
        {
            scenario = { counts: { running: 0, waiting: 0, unread: 0 } };
            agentView = null;
            const p = await fresh(390, 780);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            await until(p, "!!window.OpenVibeDock", 'the panels');
            await p.evaluate(MENU_BUTTON);
            await until(p, "!!document.querySelector('.ovs.is-open .ovs-starttabs [data-dock=\"vibe\"]')", 'the Vibe place');
            await p.evaluate(`document.querySelector('.ovs-starttabs [data-dock="vibe"]').click()`);
            await until(p, "document.querySelectorAll('.ovs-door-host .ovr-rows .ovr-row:not(.is-ghost)').length === 4", 'the run and the Action Center\'s three');
            const all = await p.evaluate(`({ filters: [...document.querySelectorAll('.ovs-door-host .ovr-filter')].map((b) => b.textContent + (b.getAttribute('aria-selected') === 'true' ? '*' : '')),
                titles: [...document.querySelectorAll('.ovs-door-host .ovr-row-top b')].map((b) => b.textContent), sw: !!document.querySelector('.ovs-door-sw, [data-part]'),
                top: !!document.querySelector('.ovs-door-host .ovr-top .ovdk.ovdk-part-top'), runsList: !!document.querySelector('.ovs-door-host .ovr-top .ovdk-scroll, .ovs-door-host .ovr-top .ovac-item'),
                starters: document.querySelectorAll('.ovs-door-host .ovr-starter').length, wide: document.documentElement.scrollWidth > innerWidth })`);
            assert.deepStrictEqual(all.filters, ['All*', 'Chats', 'Tasks', 'Code'], 'All · Chats · Tasks · Code, on All');
            assert.deepStrictEqual(all.titles, ['Send the weekly digest?', 'Fix the flaky upload test', 'Compare three VPS offers', 'Patch notes for 4.162'], 'what needs you first, then newest (the work a minute ago, the chat four): a run and the Action Center\'s work in one list');
            assert.deepStrictEqual([all.sw, all.top, all.runsList, all.starters, all.wide], [false, true, false, 6, false], 'no switch; the Dock\'s top above (not its list); the six starters; nothing off the screen');
            if (process.env.OV_CAPTURE_VIBE) { await wait(500); const r = await p.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(process.env.OV_CAPTURE_VIBE, 'vibe-all-390.png'), Buffer.from(r.data, 'base64')); }
            // Tasks: the Dock's Agents panel, whole; the Network hears the place.
            await p.evaluate(`document.querySelector('.ovs-door-host .ovr-filter[data-filter="task"]').click()`);
            const place = await until(p, `(() => { const c = ${PLACE}; return c && c.tab === 'agent' && c.items ? c : null; })()`, 'Tasks: the Agents panel');
            assert.strictEqual(place.items, 3, 'its own list, as before');
            assert.strictEqual(await p.evaluate("!!document.querySelector('.ovs-door-host .ovr-pane .ovdk') && document.querySelector('.ovs-door-host .ovr-top').hidden"), true, 'in the pane, and the top handed back');
            if (process.env.OV_CAPTURE_VIBE) { await wait(500); const r = await p.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(process.env.OV_CAPTURE_VIBE, 'vibe-tasks-390.png'), Buffer.from(r.data, 'base64')); }
            await eventually(async () => assert.ok(puts.some((b) => b.tab === 'agent'), 'the Network heard Tasks'));
            // Approve in place from All, through the Action Center.
            await p.evaluate(`document.querySelector('.ovs-door-host .ovr-filter[data-filter="all"]').click()`);
            await until(p, "!!document.querySelector('.ovs-door-host .ovr-rows li.has-acts .ovr-btn.is-primary')", 'All again, with its answers');
            decided.length = 0;
            await p.evaluate("document.querySelector('.ovs-door-host .ovr-rows li.has-acts .ovr-btn.is-primary').click()");
            await until(p, "(document.querySelector('.ovs-door-host .ovr-rows li.has-acts .ovr-row-acts') || {}).textContent === 'Approved'", 'approved in place from All');
            assert.deepStrictEqual(decided, ['actor:apr_1:approve'], 'through the Action Center');
            await p.close();
        }

        // ── Chats (K-D2): the list, a thread in place, Enter sends, read, remembered; a phone keeps the sheet open. ──
        {
            scenario = { counts: { running: 1, waiting: 0, unread: 0 } };
            puts.length = 0; said.length = 0; reads.length = 0;
            const p = await fresh(390, 780);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            await until(p, "!!window.OpenVibeDock", 'the panels');
            await p.evaluate(OPEN('chats'));
            const rows = await until(p, "(() => { const r = [...document.querySelectorAll('.ovdk .ovdk-chat')]; return r.length ? r.map((b) => b.getAttribute('aria-label') + ' | ' + b.querySelector('.ovdk-chat-p').textContent) : null; })()", 'the conversations');
            assert.deepStrictEqual(rows, ['Kai Moreno, 2 unread | see the shots?', 'Design crit | You: Shipped it'], 'named for the other person (or the group), unread first, mine as "You:"');
            await p.evaluate("document.querySelector('.ovdk .ovdk-chat').click()");
            const thread = await until(p, "(() => { const m = [...document.querySelectorAll('.ovdk .ovdk-msg')]; return m.length === 2 ? m.map((x) => (x.classList.contains('is-mine') ? 'me: ' : 'them: ') + x.querySelector('.ovdk-text').textContent) : null; })()", 'the thread');
            assert.deepStrictEqual(thread, ['them: see the shots?', 'me: <b>on it</b>'], 'theirs and mine, and what people wrote is text, never markup');
            // The menu redraws when its own loads arrive and hands its (empty) search words on again: the open chat stays.
            await p.evaluate("OpenVibeDock.filterChats(''), true");
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelectorAll('.ovdk .ovdk-msg').length"), 2, 'a menu redraw never swaps the open chat for the list'));
            const cards = await until(p, "(() => { const c = [...document.querySelectorAll('.ovdk .ovdk-msg .ovdk-card')]; return c.length === 2 ? c.map((x) => { const t = x.querySelector('.ovdk-card-t'), g = x.querySelector('.ovdk-card-go'), i = x.querySelector('img'); return [t.tagName, t.textContent, t.getAttribute('href'), i ? i.getAttribute('src') : null, g ? g.textContent + ' ' + g.getAttribute('href') : null]; }) : null; })()", 'the link cards');
            assert.deepStrictEqual(cards[0], ['A', 'The studio tour', 'https://openvibe.video/v/42', 'https://openvibe.media/t/abc?w=320', 'Watch together https://openvibe.party/new?media=https%3A%2F%2Fopenvibe.video%2Fv%2F42'], 'a card: its picture, its title as a link, its one move');
            assert.deepStrictEqual(cards[1], ['B', '<img src=x>', null, null, null], 'a card is data: no script link, no picture from elsewhere, no script button, the title as text');
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelectorAll('script[src*=\"dock-card.js\"]').length"), 1, 'dock-card.js is loaded once, when a card first shows'));
            await until(p, "!!document.querySelector('.ovdk .ovdk-edit')", 'the edit action');
            // 4.220.0: Edit is a pencil at the bubble's corner, hidden until hover, focus or a tap (rule 138); the box is
            // the editor (no browser prompt), and "edited" is one quiet word inside the bubble.
            assert.strictEqual(await p.evaluate("getComputedStyle(document.querySelector('.ovdk .ovdk-acts')).display"), 'none', 'the pencil waits for a tap');
            assert.strictEqual(await p.evaluate("document.querySelector('.ovdk .ovdk-edit').getAttribute('aria-label')"), 'Edit message');
            await p.evaluate("(() => { window.prompt = () => { window.__prompted = true; return null; }; document.querySelector('.ovdk .ovdk-edit').click(); })()");
            await until(p, "!document.querySelector('.ovdk .ovdk-edit-bar').hidden && document.querySelector('.ovdk-send textarea').value === '<b>on it</b>'", 'the box holds the words, under its editing bar');
            assert.strictEqual(await p.evaluate("!!window.__prompted"), false, 'never the browser prompt');
            await p.evaluate("(() => { const b = document.querySelector('.ovdk-send textarea'); b.value = 'updated by me'; b.dispatchEvent(new Event('input')); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); })()");
            await until(p, "document.querySelector('.ovdk .ovdk-msg.is-mine .ovdk-text').firstChild.textContent === 'updated by me'", 'the edited message');
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelector('.ovdk .ovdk-msg.is-mine .ovdk-text .ovdk-edited').textContent"), 'edited', 'one quiet word, inside the bubble'));
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelector('.ovdk .ovdk-edit-bar').hidden && document.querySelector('.ovdk-send textarea').value === ''"), true, 'saved: the bar goes and the box is empty'));
            await eventually(async () => assert.strictEqual(await p.evaluate("!!document.querySelector('.ovs.is-open .ovdk')"), true, 'the thread stays in the menu'));
            await p.evaluate("(() => { const b = document.querySelector('.ovdk-send textarea'); b.value = 'Looks good'; b.dispatchEvent(new Event('input')); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); })()");
            await until(p, "document.querySelectorAll('.ovdk .ovdk-msg').length === 3", 'the sent message in the thread');
            assert.deepStrictEqual(said, ['Looks good'], 'Enter sends it to Chat');
            assert.ok(reads.includes('11'), 'the thread is marked read as it is shown');
            await eventually(async () => assert.ok(puts.some((b) => b.chat === '11'), `the open chat is the Dock's state (${JSON.stringify(puts)})`));
            await p.evaluate("document.querySelector('.ovdk-back').click()");
            await until(p, "document.querySelectorAll('.ovdk .ovdk-chat').length === 2", 'back to the list');
            await p.close();
        }

        // ── Send to a chat (4.144.0): a conversation or a name; the message waits in the box until it is sent ──
        {
            scenario = { counts: { running: 1, waiting: 0, unread: 0 } };
            said.length = 0; started.length = 0;
            const p = await fresh(390, 780);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            await until(p, "!!window.OpenVibeDock", 'the panels');
            const TEXT = 'Friday film https://openvibe.party/p/friday?k=abc';
            const share = (title) => p.evaluate(`OpenVibeDock.share({ text: ${JSON.stringify(TEXT)}${title ? `, title: ${JSON.stringify(title)}` : ''} })`);
            await share('Friday film');
            await until(p, "!!document.querySelector('.ovdk .ovdk-share')", 'the Send to… bar');
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelector('.ovdk-share-what').textContent"), 'Friday film', 'what is being sent, by its title'));
            await until(p, "document.querySelectorAll('.ovdk .ovdk-chat').length === 2", 'your conversations under it');
            await p.evaluate("document.querySelector('.ovdk .ovdk-chat').click()");
            await until(p, "document.querySelector('.ovdk-send textarea') && document.querySelector('.ovdk-send textarea').value.length > 0", 'the message in the box');
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelector('.ovdk-send textarea').value"), TEXT, 'the link waits in the box'));
            await eventually(async () => assert.strictEqual(await p.evaluate("!!document.querySelector('.ovdk-ready')"), true, 'and says it is ready to send'));
            await wait(300);
            assert.deepStrictEqual(said, [], 'nothing is sent until the person sends it');
            // Someone new, by their name: a name nobody has says so; the right one starts the conversation.
            await share('Friday film');
            await until(p, "!!document.querySelector('.ovdk .ovdk-share')", 'the bar again');
            await p.evaluate("(() => { document.querySelector('.ovdk-to input').value = '@zz'; document.querySelector('.ovdk-to').requestSubmit(); })()");
            await until(p, "!document.querySelector('.ovdk-share .ovdk-err').hidden", 'a name nobody has');
            await eventually(async () => assert.match(await p.evaluate("document.querySelector('.ovdk-share .ovdk-err').textContent"), /Nobody is called @zz\. Did you mean @mia\?/));
            await p.evaluate("(() => { document.querySelector('.ovdk-to input').value = 'mia'; document.querySelector('.ovdk-to').requestSubmit(); })()");
            await until(p, `document.querySelector('.ovdk-send textarea') && document.querySelector('.ovdk-send textarea').value === ${JSON.stringify(TEXT)}`, 'a new conversation with the message in the box');
            assert.deepStrictEqual(started, [[4]], 'the conversation is started with Mia, by her id');
            assert.deepStrictEqual(said, [], 'still nothing sent');
            // A page button that sends something opens the menu on Chat, and the opening tap does not close it.
            await p.evaluate("(() => { OpenVibeDock.close(); const b = document.createElement('button'); b.id = 'pagesend'; b.textContent = 'Send it'; b.addEventListener('click', () => OpenVibeDock.share({ text: 'From a page button' })); document.body.appendChild(b); })()");
            await until(p, "!document.querySelector('.ovs.is-open')", 'closed first');
            await p.evaluate("document.getElementById('pagesend').click()");
            await until(p, "!!document.querySelector('.ovs.is-open .ovdk .ovdk-share')", 'the bar, opened by a tap on the page');
            await wait(300);
            await eventually(async () => assert.strictEqual(await p.evaluate("!!document.querySelector('.ovs.is-open')"), true, 'the opening tap does not close the menu'));
            await p.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))");
            await until(p, "!document.querySelector('.ovs.is-open')", 'Escape closes it');
            await share();
            await until(p, "!!document.querySelector('.ovdk .ovdk-share')", 'the bar again');
            // Cancel: back to the list, nothing waiting.
            await share();
            await until(p, "!!document.querySelector('.ovdk .ovdk-share')", 'the bar');
            await until(p, `(document.querySelector('.ovdk-share-what') || {}).textContent === ${JSON.stringify(TEXT)}`, 'with no title, the text itself');
            await p.evaluate("document.querySelector('.ovdk-share-x').click()");
            await until(p, "!document.querySelector('.ovdk .ovdk-share') && document.querySelectorAll('.ovdk .ovdk-chat').length === 2", 'the list without the bar');
            await p.close();
        }

        // ── The agent view (K-D3): the person's own desk stream, its curtain, End, and the still when it ends ──
        {
            scenario = { counts: { running: 1, waiting: 0, unread: 0 } };
            controls.length = 0;
            const view = () => ({
                id: AGENT_ID, state: 'live', title: 'Fix the flaky upload test',
                task: { source: 'codes', ref: 'tsk_1', title: 'Fix the flaky upload test', url: 'https://openvibe.codes/run/tasks/tsk_1' },
                current_step: { title: 'Run the checkout tests', status: 'started' },
                curtain: { up: false }, viewers: 2, worked_seconds: 720, visibility: 'private',
                page_url: `https://openvibe.live/@ada/agents/${AGENT_ID}`,
                embed_url: `https://openvibe.live/embed/agent/${AGENT_ID}?vt=wvt_test`, last_frame_url: null,
            });
            agentView = view();
            // The embed is Live's own page; the harness blocks its address so the test never reaches it.
            const p = await h.openPage(browser, await browser.newContext(), { width: 390, height: 780, block: ['https://openvibe.live/*'] });
            await p.goto(`${base}/page`, { maxMs: 8000 });
            await until(p, "!!window.OpenVibeDock", 'the panels');
            await p.evaluate(OPEN('agent'));
            await until(p, `(() => { const c = ${PLACE}; return c && c.tab === 'agent' && c.items ? c : null; })()`, 'the Agents place');
            // The stream: Live's embed, the task, the numbers.
            const src = await until(p, "document.querySelector('.ovda iframe') && document.querySelector('.ovda iframe').getAttribute('src')", 'the embed');
            assert.strictEqual(src, view().embed_url, 'the embed Codes answered, with the ticket in its address');
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelector('.ovda-line').textContent"), 'Fix the flaky upload test', 'the task, one line'));
            await eventually(async () => assert.ok((await p.evaluate("document.querySelector('.ovda-step').textContent")).includes('Run the checkout tests'), 'the current step'));
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelector('.ovda-meta').textContent"), 'Live · 2 watching · worked 12 min'));
            await eventually(async () => assert.deepStrictEqual(await p.evaluate("[...document.querySelectorAll('.ovda-acts button')].map((b) => b.dataset.act)"), ['pause', 'curtain', 'mute', 'end', 'float'], 'the owner\'s four controls (S5), and Float while the screen plays (4.154.0)'));
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelector('.ovda').classList.contains('on')"), true, 'the view is shown above the list'));
            // Curtain now: Live is asked, and the line says so.
            await p.evaluate("document.querySelector('.ovda-acts button[data-act=curtain]').click()");
            await until(p, "document.querySelector('.ovda-meta').textContent.includes('Private screen')", 'the curtain in the line');
            assert.deepStrictEqual(controls, ['curtain'], 'Curtain now reached Codes, which puts it to Live');
            await eventually(async () => assert.strictEqual(await p.evaluate("!!document.querySelector('.ovda-acts button[data-act=curtain]')"), false, 'no Curtain now while the curtain is up'));
            // S5: Pause and Mute reach Codes, which puts them to Live; the line says whose pause it is.
            await p.evaluate("document.querySelector('.ovda-acts button[data-act=pause]').click()");
            await until(p, "document.querySelector('.ovda-acts button[data-act=pause]').textContent.includes('Resume')", 'the pause in the button');
            await p.evaluate("document.querySelector('.ovda-acts button[data-act=mute]').click()");
            await until(p, "document.querySelector('.ovda-acts button[data-act=mute]').textContent.includes('Unmute')", 'the mute in the button');
            // End: the stream becomes the last frame, and the list is still there under it.
            await p.evaluate("document.querySelector('.ovda-acts button[data-act=end]').click()");
            const stillSrc = await until(p, "document.querySelector('.ovda img') && document.querySelector('.ovda img').getAttribute('src')", 'the still after End');
            assert.ok(stillSrc.startsWith('blob:'), 'the still is read with the token, never a bare <img> URL');
            assert.deepStrictEqual(controls, ['curtain', 'pause', 'mute', 'end'], 'Pause, Mute and End reached Codes, which puts them to Live');
            await eventually(async () => assert.strictEqual(await p.evaluate("!!document.querySelector('.ovda iframe')"), false, 'no player once it has ended'));
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelector('.ovda-meta').textContent"), 'Ended · worked 12 min'));
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelectorAll('.ovac-item').length"), 3, 'the agents list is untouched under the stream'));
            // No stream at all: the view hides itself and the tab is just the list.
            agentView = null;
            await p.goto(`${base}/page`, { maxMs: 8000 });
            await until(p, "!!window.OpenVibeDock", 'the panels again');
            await p.evaluate(OPEN('agent'));
            await until(p, `(() => { const c = ${PLACE}; return c && c.tab === 'agent' && c.items ? c : null; })()`, 'the Agents place again');
            await wait(400);
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelector('.ovda').classList.contains('on')"), false, 'nothing to show, and nowhere to show it'));
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelectorAll('.ovac-item').length"), 3, 'the list alone'));
            await p.close();
        }

        // ── 320 px: nothing runs off the screen, closed or open. ──
        {
            scenario = { counts: { running: 1, waiting: 0, unread: 0 } };
            const p = await fresh(320, 640);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            const st = await until(p, STATUS, 'the status at 320');
            assert.strictEqual(st.tone, 'running');
            await p.evaluate(OPEN('agent'));
            await until(p, PLACE, 'the menu on Agents at 320');
            await eventually(async () => assert.strictEqual(await p.evaluate('document.documentElement.scrollWidth'), 320, 'no sideways scroll'));
            await p.close();
        }
        }
        if (PART === 1) { console.log('dock-chrome (1 of 2): no pill and no floating Dock, the status on the menu button, Agents in the menu, Chats, Send to, the agent view, 320 px clean'); return; }
        // ── Vibe (L48 V2): starters, a question, Vibe's answer in place; the Network keeps the tab. ──
        {
            scenario = { counts: { running: 0, waiting: 0, unread: 0 }, state: { ...defaultState(), pinned: true } };
            puts.length = 0;
            const p = await fresh(1280, 860);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            await until(p, "!!window.OpenVibeDock", 'the panels');
            await p.evaluate(OPEN('vibe'));
            await until(p, "document.querySelector('.ovs.is-open [data-dock=\"vibe\"]') && document.querySelector('.ovs [data-dock=\"vibe\"]').getAttribute('aria-selected') === 'true'", 'the menu on Vibe');
            await until(p, "!!document.querySelector('.ovdk-vibe-new')", 'the conversation list');
            await p.evaluate("document.querySelector('.ovdk-vibe-new').click()");
            await until(p, "document.querySelectorAll('.ovdk [data-panel=vibe] .ovdk-chip').length === 6", 'the starters before the first message, each with its icon');
            assert.strictEqual(await p.evaluate("[...document.querySelectorAll('.ovdk [data-panel=vibe] .ovdk-chip')].filter((c) => c.querySelector('.ovdk-chip-ic svg')).length"), 6, 'every starter has its icon');
            await p.evaluate("document.querySelector('.ovdk [data-panel=vibe] .ovdk-chip').click()");
            await until(p, "!!document.querySelector('.ovdk [data-panel=vibe] .ovdk-msg.is-mine')", 'my question in place');
            assert.strictEqual(asked[0].message, 'Remind me to stretch every 2 hours');
            assert.ok(asked[0].timezone, 'with the person\'s time zone, for "at 9"');
            const answer = await until(p, "(() => { const m = document.querySelector('.ovdk [data-panel=vibe] .ovdk-msg.is-vibe:not(.ovdk-typing)'); return m ? { text: m.innerText, link: (m.querySelector('a') || {}).href || null } : null; })()", 'Vibe\'s answer', 6000);
            assert.match(answer.text, /Reminder set: Stretch, every 2 hours/);
            assert.strictEqual(answer.link, 'https://openvibe.today/reminders', 'an https link is a link');
            // What Vibe did, under its answer: a reminder chip with Undo and Open (plan L48 V2, result chips).
            const chip = await until(p, "(() => { const c = document.querySelector('.ovdk [data-panel=vibe] .ovdk-res-c'); return c ? { text: c.innerText, open: (c.querySelector('a') || {}).href, undo: !!c.querySelector('button') } : null; })()", 'the result chip');
            assert.match(chip.text, /Reminder set: Stretch/);
            assert.match(chip.text, /Every 2 hours, 9 am–5 pm/);
            assert.strictEqual(chip.open, 'https://openvibe.today/me#reminders');
            assert.ok(chip.undo, 'Undo while it can be undone');
            await p.evaluate("document.querySelector('.ovdk .ovdk-res-c button').click()");
            await until(p, "!!document.querySelector('.ovdk .ovdk-res-c.is-stopped')", 'the chip says it is stopped');
            assert.deepStrictEqual(undone[0], { message_id: vibeMsgs.find((m) => m.from === 'vibe').id, index: 0 }, 'undo names the answer and the result');
            await eventually(async () => assert.match(await p.evaluate("document.querySelector('.ovdk .ovdk-res-c').innerText"), /Reminder stopped: Stretch/));
            await eventually(async () => assert.strictEqual(await p.evaluate("!!document.querySelector('.ovdk .ovdk-res-c button')"), false, 'and is not offered again'));
            await eventually(async () => assert.strictEqual(await p.evaluate("!!document.querySelector('.ovdk .ovdk-typing')"), false, 'the writing dots go when it answers'));
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelector('.ovdk .ovdk-away').href"), 'https://openvibe.chat/vibe/v1', 'Open in Chat goes to the same chat'));
            await eventually(async () => assert.ok(puts.some((b) => b.tab === 'vibe'), `the Network keeps the Vibe tab, so it follows the person to the next site (${JSON.stringify(puts)})`));
            await p.close();
        }

        // ── Vibe by voice without the browser's speech recognition (Firefox): the mic records, Chat's /api/vibe/listen
        //    says what was said, and it is asked like typed text. The recorder is a stand-in: no microphone in CI. ──
        {
            scenario = { counts: { running: 0, waiting: 0, unread: 0 }, state: { ...defaultState(), pinned: true, tab: 'vibe' } };
            asked.length = 0;
            const p = await fresh(1280, 860);
            await p.send('Page.addScriptToEvaluateOnNewDocument', { source: `
                delete window.SpeechRecognition; delete window.webkitSpeechRecognition;
                window.__tracksStopped = 0;
                navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() { window.__tracksStopped++; } }] });
                window.MediaRecorder = class {
                    static isTypeSupported(t) { return t === 'audio/ogg;codecs=opus'; }
                    constructor(stream, o) { this.mimeType = (o && o.mimeType) || ''; this.state = 'inactive'; }
                    start() { this.state = 'recording'; window.__recording = true; }
                    stop() { this.state = 'inactive'; window.__recording = false; this.ondataavailable({ data: new Blob([new Uint8Array(4096)], { type: 'audio/ogg' }) }); this.onstop(); }
                };` });
            await p.goto(`${base}/page`, { maxMs: 5000 });
            await until(p, "!!window.OpenVibeDock", 'the panels');
            await p.evaluate(OPEN('vibe'));
            await until(p, "!!document.querySelector('.ovdk-vibe-new')", 'the Vibe list');
            await p.evaluate("document.querySelector('.ovdk-vibe-new').click()");
            await until(p, "!!document.querySelector('.ovdk [data-panel=vibe] .ovdk-mic')", 'a mic, though the browser has no speech recognition');
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelector('.ovdk [data-panel=vibe] textarea').placeholder"), 'Ask Vibe, or hold the mic'));
            await p.evaluate("document.querySelector('.ovdk .ovdk-mic').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))");
            await until(p, "window.__recording === true && document.querySelector('.ovdk .ovdk-mic').getAttribute('aria-pressed') === 'true'", 'recording, and the mic says so');
            await p.evaluate("document.querySelector('.ovdk .ovdk-mic').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))");
            await until(p, "[...document.querySelectorAll('.ovdk [data-panel=vibe] .ovdk-msg.is-mine')].some((m) => /drink water at 3/.test(m.innerText))", 'what was said, asked');
            assert.deepStrictEqual(listened[0], { type: 'audio/ogg', bytes: 4096, lang: 'en', auth: 'Bearer tok_user' }, 'the recording goes to Chat as itself, with the person\'s token');
            assert.strictEqual(asked[0].message, 'remind me to drink water at 3');
            await eventually(async () => assert.strictEqual(await p.evaluate('window.__tracksStopped'), 1, 'the microphone is released'));
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelector('.ovdk .ovdk-mic').getAttribute('aria-pressed')"), 'false'));
            await p.close();
        }

        // ── The navbar loads the OpenVibe glyphs only when a page shows an icon: none at first costs nothing, and an
        //    icon the page's own script adds later is drawn all the same (L54 K4: Font Awesome is gone everywhere). ──
        {
            scenario = { counts: { running: 0, waiting: 0, unread: 0 }, state: { ...defaultState() } };
            const p = await fresh(1280, 860);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            await until(p, "!!document.querySelector('.openvibe-navbar')", 'the navbar');
            await wait(600);
            await eventually(async () => assert.strictEqual(await p.evaluate("!!document.getElementById('ov-glyphs-loader')"), false, 'no icon on the page: no glyphs loaded'));
            await p.evaluate("(() => { const i = document.createElement('i'); i.className = 'fa-solid fa-gear'; i.id = 'late-icon'; document.querySelector('main').prepend(i); })()");
            await until(p, "!!document.getElementById('ov-glyphs-loader') && !!window.OVGlyphs", 'the glyphs load once an icon appears');
            await until(p, "(() => { const e = document.getElementById('late-icon'); return !e || !!e.querySelector('svg') || e.tagName.toLowerCase() === 'svg'; })()", 'and the late icon is drawn');
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelectorAll('script[src*=\"ov-glyphs.js\"]').length"), 1, 'once'));
            await p.close();
        }

        // ── The timer (L48 R2): start from the menu, count down in the pill, end, and a focus round moves on by itself. ──
        {
            scenario = { counts: { running: 0, waiting: 0, unread: 0 }, state: { ...defaultState() } };
            puts.length = 0;
            const p = await fresh(1280, 860);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            await until(p, "!!window.OpenVibeDock", 'the panels');
            await p.evaluate(OPEN('vibe'));
            await until(p, PLACE, 'the menu on Vibe');
            // 4.223.0: the timer is in the box's + (every composer's), not a button of Vibe's own.
            await p.evaluate("(document.querySelector('.ovs .ovdk-vibe-new') || { click() {} }).click()");
            await until(p, "!!document.querySelector('.ovs .ovc-more')", 'the box and its +');
            await p.evaluate("document.querySelector('.ovs .ovc-more').click()");
            await until(p, "[...document.querySelectorAll('.ovs .ovc-tray-i')].some((b) => b.textContent === 'Timer')", 'Timer in the +');
            await p.evaluate("[...document.querySelectorAll('.ovs .ovc-tray-i')].find((b) => b.textContent === 'Timer').click()");
            await until(p, "!!document.querySelector('.ovdk .ovdk-tmenu')", 'the timer menu');
            await p.evaluate("document.querySelector('.ovdk .ovdk-tmenu [data-min=\"5\"]').click()");
            const strip = await until(p, "(() => { const s = document.querySelector('.ovdk .ovdk-timer'); return s ? s.innerText : null; })()", 'the timer strip in the Dock');
            assert.match(strip, /^[45]:\d\d/, `about five minutes left (${strip})`);
            await wait(900);
            const started = puts.find((b) => b.timer);
            assert.ok(started && started.timer.kind === 'timer' && Date.parse(started.timer.ends_at) - Date.parse(started.timer.started_at) === 300000, `the Network keeps the timer (${JSON.stringify(puts)})`);
            await p.evaluate("OpenVibeSearch.close()");
            const pill = await until(p, `(() => { const q = ${STATUS}; return q && /^\\d+:\\d\\d$/.test(q.text) ? q : null; })()`, 'the menu button counts it down');
            assert.strictEqual(pill.tone, 'timer');
            assert.match(pill.label, /Timer: \d+:\d\d left/);
            // Another page's view: a timer two seconds from its end.
            const soon = (ms, extra = {}) => ({ kind: 'timer', started_at: new Date(Date.now() - 60000).toISOString(), ends_at: new Date(Date.now() + ms).toISOString(), ...extra });
            scenario.state = { ...defaultState(), timer: soon(1500) };
            puts.length = 0;
            await p.goto(`${base}/page`, { maxMs: 5000 });
            const up = await until(p, `(() => { const q = ${STATUS}; return q && q.tone === 'timer-done' && q.text === 'Done' ? q : null; })()`, 'the end, said', 8000);
            assert.match(up.label, /time's up/i);
            await wait(900);
            assert.ok(puts.some((b) => 'timer' in b && b.timer === null), `a plain timer clears itself at its end (${JSON.stringify(puts)})`);
            // A focus round ending: its break starts at that same end, whatever page writes it.
            const end = Date.now() + 1200;
            scenario.state = { ...defaultState(), timer: { kind: 'focus', label: 'Write', started_at: new Date(end - 25 * 60000).toISOString(), ends_at: new Date(end).toISOString(), round: 1, rounds: 2, focus_min: 25, break_min: 5 } };
            puts.length = 0;
            await p.goto(`${base}/page`, { maxMs: 5000 });
            await until(p, `(() => { const q = ${STATUS}; return q && q.tone === 'timer' ? q : null; })()`, 'the focus round on the menu button');
            await wait(2600);
            const brk = puts.map((b) => b.timer).find((t) => t && t.kind === 'break');
            assert.ok(brk, `the break follows the focus round (${JSON.stringify(puts)})`);
            assert.strictEqual(Date.parse(brk.started_at), end, 'it starts where the round ended');
            assert.strictEqual(Date.parse(brk.ends_at), end + 5 * 60000, 'five minutes');
            assert.deepStrictEqual([brk.round, brk.rounds, brk.label], [1, 2, 'Write']);
            await p.close();
        }

        // ── Network without the route yet (404): no status, and the site stops asking for a day. Signed out: none. ──
        {
            scenario = { missing: true };
            const p = await fresh(1280);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            await wait(700);
            await eventually(async () => assert.strictEqual(await p.evaluate(STATUS), null, 'nothing on the menu button without the route'));
            const off = await p.evaluate("JSON.parse(localStorage.getItem('ov-dock') || 'null')");
            assert.ok(off && off.off > Date.now() + 23 * 3600e3, 'and it waits a day before asking again');
            await p.evaluate("localStorage.removeItem('ov-dock')");
            scenario = { counts: { running: 1, waiting: 0, unread: 0 } };
            await p.goto(`${base}/page?in=0`, { maxMs: 5000 });
            await wait(600);
            await eventually(async () => assert.strictEqual(await p.evaluate(STATUS), null, 'signed out: no status'));
            await eventually(async () => assert.strictEqual(await p.evaluate("!!document.querySelector('#ovdk-pill, .ovdk-pill')"), false, 'and no pill'));
            await p.close();
        }
        // ── Ask your agent (4.135.0): a page's [data-ov-ask] chip opens Vibe with the question in the box, unsent. ──
        {
            scenario = { counts: { running: 0, waiting: 0, unread: 0 }, state: { ...defaultState(), pinned: false } };
            const before = asked.length;
            const p = await fresh(1280, 860);
            await p.goto(`${base}/page`, { maxMs: 5000 });
            await until(p, "!!window.OpenVibeNavbar && typeof OpenVibeNavbar.askAgent === 'function'", 'the navbar');
            await p.evaluate("(() => { const b = document.createElement('button'); b.type = 'button'; b.id = 'ask'; b.setAttribute('data-ov-ask', 'About this stream: night walk in Asakusa. '); document.body.appendChild(b); b.click(); })()");
            await until(p, PLACE, 'the menu opens');
            const box = await until(p, "(() => { const t = document.querySelector('.ovdk [data-panel=vibe] textarea'); return t && t.value ? { value: t.value } : null; })()", 'the question in the box');
            assert.strictEqual(box.value, 'About this stream: night walk in Asakusa. ', 'the page question, as given');
            await eventually(async () => assert.strictEqual(await p.evaluate("document.querySelector('.ovs [data-dock=\"vibe\"]').getAttribute('aria-selected')"), 'true', 'on Vibe'));
            await wait(400);
            assert.strictEqual(asked.length, before, 'nothing is sent for the person');
            await p.close();
        }
        console.log('dock-chrome: Vibe, voice, the glyphs, the timer on the menu button, a Network without the route, Ask your agent');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
