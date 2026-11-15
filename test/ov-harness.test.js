'use strict';
// ov-harness.js (4.257.0): the coding-harness layout over the one run engine. Code runs group by project (a
// repository by owner/name whatever form its address takes; new work; OpenVibe), a chat never shows; the box starts a
// code run on the chosen project; opening a thread mounts the engine on it and fills the head and the changes column
// (the pull request first); phone tabs follow; everything a run says is text, never markup.
//   node test/ov-harness.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'ov-harness.js'), 'utf8');
const tick = () => new Promise((r) => setImmediate(r));

(async () => {
    const { window, document } = parseHTML('<!doctype html><html><head></head><body><div id="host"></div></body></html>');
    const mounts = [];
    window.OpenVibeRun = { mount(host, o) { const m = { o, destroyed: false, destroy() { m.destroyed = true; } }; mounts.push(m); return m; } };
    const now = Date.now();
    const RUNS = [
        { ref: 'codes:t1', kind: 'code', title: 'Fix the login', status: 'running', target: { repo: 'octocat/hello', branch: 'ov/fix-login' }, agent: { name: 'Claude Code' }, model: { name: 'Opus' }, updated_at: new Date(now - 120000).toISOString() },
        { ref: 'codes:t2', kind: 'code', title: 'Dark mode <img src=x onerror=alert(1)>', status: 'done', target: { repo: 'https://github.com/octocat/hello.git' },
            outputs: [{ kind: 'file', title: 'src/theme.js' }, { kind: 'pr', title: 'Dark mode (#4)', url: 'https://github.com/octocat/hello/pull/4' }], counts: { files: 3, steps: 12 }, cost: { usd: 0.0421 } },
        { ref: 'codes:t3', kind: 'code', title: 'A snake game', status: 'failed', target: 'new' },
        { ref: 'chat:c1', kind: 'chat', title: 'Just chatting' },
    ];
    const calls = [];
    const fetch = async (url, init) => {
        calls.push({ url, auth: init && init.headers && init.headers.Authorization });
        const u = new URL(url);
        const one = /\/runs\/(.+)$/.exec(u.pathname);
        const body = one ? RUNS.find((r) => r.ref === decodeURIComponent(one[1])) : { runs: RUNS };
        return { ok: !!body, status: body ? 200 : 404, json: async () => body };
    };
    new Function('window', 'document', 'fetch', 'setTimeout', 'clearTimeout', SRC)(window, document, fetch, () => 0, () => {});
    const H = window.OpenVibeHarness;
    assert.ok(H && typeof H.page === 'function');

    // Projects, by owner/name whatever the address looks like.
    assert.deepStrictEqual(H.projectOf({ target: { repo: 'https://github.com/a/b.git' } }).name, 'a/b');
    assert.deepStrictEqual(H.projectOf({ target: 'openvibe' }).name, 'OpenVibe');
    assert.deepStrictEqual(H.projectOf({}).key, 'new');

    const host = document.getElementById('host');
    const h = H.page(host, { token: 'tok', repos: ['octocat/other'], base: 'https://openvibe.network/api/frame' });
    for (let i = 0; i < 5; i++) await tick();

    // The list: code runs only, grouped by project; the call carries the token.
    assert.ok(calls.some((c) => /\/runs\?kind=code&limit=100$/.test(c.url) && c.auth === 'Bearer tok'), JSON.stringify(calls));
    const groups = [...host.querySelectorAll('.ovhr-proj')].map((g) => [g.querySelector('.ovhr-proj-head span').textContent, g.querySelectorAll('.ovhr-row').length]);
    assert.deepStrictEqual(groups, [['octocat/hello', 2], ['New projects', 1]]);
    assert.ok(!host.textContent.includes('Just chatting'), 'a chat is not a coding thread');
    assert.ok(host.querySelector('.ovhr-dot.is-run') && host.querySelector('.ovhr-dot.is-bad'));
    assert.strictEqual(host.querySelectorAll('img').length, 0, 'a title is text, never markup');
    assert.ok(host.textContent.includes('Dark mode <img src=x onerror=alert(1)>'));

    // A new task (4.260.0; the owner, 11-15: "type anything … code related"): the engine mounts blank on a code start
    // with no project (Codes' make mode works it out); what it works on is the box's first chip, Anything first, then
    // the projects, the recent repos included; no selects in the head.
    assert.strictEqual(mounts[0].o.blank, true);
    assert.deepStrictEqual(mounts[0].o.start, { kind: 'code' });
    assert.strictEqual(mounts[0].o.filter, 'code');
    assert.strictEqual(host.querySelectorAll('.ovhr-head select').length, 0, 'no picker rows');
    const works = mounts[0].o.composer.runChips[0];
    // Read when the chip opens: the projects of the runs loaded since, then the recent repos, then OpenVibe and new.
    assert.deepStrictEqual(works.options().map((x) => x.name), ['Anything', 'octocat/hello', 'New projects', 'octocat/other', 'OpenVibe']);
    assert.match(mounts[0].o.blankTitle, /What should Codes do/);
    assert.ok(mounts[0].o.examples.every((e) => !/live stream/i.test(e)), 'coding examples only');
    works.onPick('repo:octocat/hello');
    assert.deepStrictEqual(mounts[mounts.length - 1].o.start, { kind: 'code', target: { repo: 'octocat/hello' } }, 'a project picked rides the start');
    host.querySelectorAll('.ovhr-proj-add')[0].click();
    const fresh = mounts[mounts.length - 1];
    assert.deepStrictEqual(fresh.o.start, { kind: 'code', target: { repo: 'octocat/hello' } }, 'the project\'s + starts a task there');
    assert.ok(mounts[mounts.length - 2].destroyed, 'the earlier view is let go');

    // Open a thread: the engine opens it; the head and the changes column fill; the pull request comes first.
    const row = [...host.querySelectorAll('.ovhr-row')].find((b) => b.dataset.ref === 'codes:t2');
    row.click();
    for (let i = 0; i < 5; i++) await tick();
    const opened = mounts[mounts.length - 1];
    assert.strictEqual(opened.o.open, 'codes:t2');
    assert.ok(row.parentNode && host.querySelector('.ovhr-row.is-open').dataset.ref === 'codes:t2');
    assert.strictEqual(host.querySelector('.ovhr-head b').textContent, 'octocat/hello');
    const links = [...host.querySelectorAll('.ovhr-outs a')];
    assert.deepStrictEqual(links.map((a) => [a.className, a.getAttribute('href')]), [['is-pr', 'https://github.com/octocat/hello/pull/4']], 'the PR is a link; a file without an address is not');
    assert.strictEqual(host.querySelector('.ovhr-outs li:first-child').textContent, 'Dark mode (#4)');
    const facts = [...host.querySelectorAll('.ovhr-facts dt')].map((d) => d.textContent);
    assert.deepStrictEqual(facts, ['Status', 'Files', 'Steps', 'Cost']);
    assert.ok(host.querySelector('.ovhr').classList.contains('has-run'));

    // Phone tabs: opening shows Task; a tab shows its region.
    assert.strictEqual(host.querySelector('.ovhr').dataset.tab, 'task');
    host.querySelector('.ovhr-tabs button').click();
    assert.strictEqual(host.querySelector('.ovhr').dataset.tab, 'projects');

    // Find filters the threads.
    const find = host.querySelector('.ovhr-find input');
    find.value = 'snake';
    find.dispatchEvent(new window.Event('input'));
    assert.deepStrictEqual([...host.querySelectorAll('.ovhr-row')].map((b) => b.dataset.ref), ['codes:t3']);

    h.destroy();
    assert.strictEqual(host.children.length, 0);

    // 4.258.0: the start's own choices, and the Board.
    mounts.length = 0;
    const h2 = H.page(host, { token: 'tok', agents: [{ id: 'claude-code', name: 'Claude Code' }, { id: 'gemini-cli', name: 'Gemini CLI', available: false }],
        models: [{ id: 'deepseek-chat', name: 'DeepSeek' }], places: [{ kind: 'openvibe', name: 'OpenVibe' }, { kind: 'machine', id: 'dev_1', name: 'My laptop', online: true }] });
    for (let i = 0; i < 5; i++) await tick();
    // 4.260.0: the agent, the model and where it runs are the box's chips (the composer's run line), fed the page's
    // lists; coding never runs on OpenVibe's own server (the owner, 11-15), so OpenVibe is not a place here.
    const ro = mounts[mounts.length - 1].o.composer.runOptions;
    assert.deepStrictEqual(ro.agents.map((x) => [x.id, !!x.disabled]), [['auto', false], ['claude-code', false], ['gemini-cli', true]]);
    assert.deepStrictEqual(ro.places.map((x) => x.kind + (x.id ? ':' + x.id : '')), ['auto', 'machine:dev_1'], 'a shared node or your computer, never OpenVibe\'s server');
    assert.match(ro.places[0].line, /shared node or your own computer/);
    assert.strictEqual(mounts[mounts.length - 1].o.composer.ask.task, 'code');
    const [, boardBtn] = host.querySelectorAll('.ovhr-views button');
    boardBtn.click();
    assert.ok(host.querySelector('.ovhr').classList.contains('is-board'));
    const cols = [...host.querySelectorAll('.ovhr-col')].map((c) => [c.dataset.status, c.querySelectorAll('.ovhr-card').length]);
    assert.deepStrictEqual(cols, [['planning', 0], ['running', 1], ['waiting', 0], ['done', 1], ['failed', 1]], 'every code run in its column; the chat is not one');
    host.querySelector('.ovhr-col[data-status="done"] .ovhr-card').click();
    for (let i = 0; i < 5; i++) await tick();
    assert.ok(!host.querySelector('.ovhr').classList.contains('is-board'), 'a card opens its thread');
    assert.strictEqual(mounts[mounts.length - 1].o.open, 'codes:t2');
    h2.destroy();
    console.log('ov-harness: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
