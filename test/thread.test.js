'use strict';
// openvibe-shared/thread and ov-thread.js (plan L55 C4): the conversation UI's markup is complete and escaped without
// script, and the script adds the drawer, the search, the composer's Send that waits for words, starters, Copy, and
// the helpers a site streams turns with.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');
const t = require('../thread');

// ── The groups ─────────────────────────────────────────────────────────────────────────────────────────────────
const now = Date.parse('2026-11-02T12:00:00Z');
assert.strictEqual(t.groupOf('2026-11-02T08:00:00Z', now), 'Today');
assert.strictEqual(t.groupOf('2026-11-01T23:00:00Z', now), 'Yesterday');
assert.strictEqual(t.groupOf('2026-10-29T10:00:00Z', now), 'This week');
assert.strictEqual(t.groupOf('2026-10-01T10:00:00Z', now), 'Earlier');
assert.strictEqual(t.groupOf('not a date', now), 'Earlier');
const groups = t.group([{ at: '2026-11-02T09:00:00Z' }, { at: '2026-11-02T07:00:00Z' }, { at: '2026-10-20T00:00:00Z' }], (c) => c.at, now);
assert.deepStrictEqual(groups.map((g) => [g.name, g.items.length]), [['Today', 2], ['Earlier', 1]]);

// ── The markup ─────────────────────────────────────────────────────────────────────────────────────────────────
const side = t.sidebar({ newHref: '/chat', groups: [{ name: 'Today', items: [{ href: '/chat/1', title: 'Plan <b>a</b> weekend', current: true, live: true }, { href: '/chat/2', title: 'Lisbon' }] }], foot: [{ href: '/memory', label: 'Memory' }] });
// The chats live in the network's one sidebar (kit.sidebar, L35), not a second one.
assert.ok(side.startsWith('<aside class="ovk-sidebar" id="ovt-chats" aria-label="Your chats" data-ovk-sidebar>'), 'kit.sidebar');
assert.ok(side.includes('<a class="ovk-sidebar-item is-here" href="/chat/1" aria-current="page"><span class="ovk-sidebar-t">Plan &lt;b&gt;a&lt;/b&gt; weekend</span><i class="ovk-sidebar-dot is-busy" aria-hidden="true"></i></a>'), 'escaped, current, live');
assert.ok(side.includes('<a class="ovk-sidebar-action" href="/chat">') && side.includes('name="q" placeholder="Find a chat"') && side.includes('<p class="ovt-side-foot"><a href="/memory">Memory</a></p>'));
assert.ok(t.sidebar({ groups: [] }).includes('<p class="ovk-sidebar-empty">Your chats show here.</p>'), 'the empty line');
assert.ok(t.sidebar({ nav: [{ href: '/console', label: 'Console', icon: 'grid' }] }).includes('<nav class="ovk-sidebar-nav"'), 'the site\'s places as rows');
const headHtml = t.head({ title: 'A <title>', newHref: '/chat' });
assert.ok(headHtml.includes('<h1 class="ovt-title">A &lt;title&gt;</h1>') && headHtml.includes('data-ovk-sidebar-open aria-controls="ovt-chats"'), 'the kit\'s button opens the chats on a phone');

const turn = t.turn({ id: 'tsk_1', state: 'running', open: true, you: { text: 'What <is> it?', files: [{ href: '/f/1', name: 'a.png', image: true }, { href: '/f/2', name: 'notes.txt', size: 2048 }] }, reply: t.work({ open: true, live: 'Reading the page', rows: [{ kind: 'step', text: 'Plan' }, { kind: 'tool', name: 'Page reader', input: 'https://x', running: true }] }) });
assert.ok(turn.startsWith('<li class="ovt-turn state-running" id="t-tsk_1" data-turn="tsk_1" data-state="running" data-open>'), turn.slice(0, 120));
assert.ok(turn.includes('<p class="ovt-bubble">What &lt;is&gt; it?</p>'), 'the person\'s words, escaped');
assert.ok(turn.includes('<img src="/f/1" alt="a.png" loading="lazy">') && turn.includes('<small>2 KB</small>'), 'a picture and a file');
assert.ok(turn.includes('<span class="ovt-w-live" data-ovt-live>Reading the page…</span>'), 'the live line while it works');
assert.ok(turn.includes('<details class="ovt-work" open data-open>'), 'open while it works');
assert.ok(turn.includes('class="ovt-w-tool is-run"'), 'a running tool');

const done = t.work({ took: '12 s', rows: [{ kind: 'tool', name: 'MX', output: 'ok', ok: true }, { kind: 'tool', name: 'DMARC', output: 'no', ok: false }, { kind: 'note', text: 'Checked', level: 'warn' }] });
assert.ok(done.includes('<span>Worked for 12 s · 2 tools</span>'), 'the folded line');
assert.ok(done.includes('ovt-w-tool is-ok') && done.includes('ovt-w-tool is-bad') && done.includes('ovt-w-note is-warn'));
assert.strictEqual(t.work({ rows: [] }), '', 'nothing to fold, nothing drawn');

const ans = t.answer({ html: '<p>The <b>answer</b></p>', sources: ['https://www.example.com/a', 'not a url'], meta: ['Balanced · DeepSeek', '$0.002'], actions: [{ label: 'Details', href: '/tasks/1?view=details' }] });
assert.ok(ans.includes('<div class="ovt-answer" data-ovt-answer><p>The <b>answer</b></p></div>'), 'the answer is the caller\'s safe markup');
assert.ok(ans.includes('>example.com</a>') && ans.includes('>not a url</a>'), 'sources by host');
assert.ok(ans.includes('<button type="button" class="ovt-act" data-ovt-copy hidden>'), 'Copy waits for the script');
assert.ok(ans.includes('<span>Balanced · DeepSeek</span><span>$0.002</span>') && ans.includes('href="/tasks/1?view=details"'));
assert.ok(t.card({ tone: 'bad', title: 'Could not finish', text: 'It <ran> too long.' }).includes('<div class="ovt-card is-bad"><p><b>Could not finish</b> It &lt;ran&gt; too long.</p>'));

const comp = t.composer({ action: '/chat', placeholder: 'Ask anything', hidden: { parent: 'tsk_1', empty: '' }, starters: ['Plan a weekend'], busy: true, stopAction: '/chat/tsk_1/stop', attach: { name: 'files', accept: 'image/*' }, note: 'Steers the turn' });
assert.ok(comp.includes('<input type="hidden" name="parent" value="tsk_1">') && !comp.includes('name="empty"'), 'hidden fields, empty ones left out');
assert.ok(comp.includes('data-ovt-starter="Plan a weekend"'));
assert.ok(comp.includes('formaction="/chat/tsk_1/stop"') && comp.includes('class="ovt-composer is-busy"'), 'Stop while it works');
assert.ok(comp.includes('enctype="multipart/form-data"') && comp.includes('accept="image/*"'), 'attach');
assert.ok(!/data-ovt-text required/.test(comp), 'a busy composer may send nothing (it steers)');
assert.ok(/<button type="submit" class="ovt-stop" hidden data-ovt-stop>/.test(t.composer({ action: '/chat', stopAction: '' })), 'Stop drawn hidden for a script to show');
assert.ok(!t.composer({ action: '/chat' }).includes('ovt-stop'), 'no Stop when the site has none');
assert.ok(/data-ovt-text required/.test(t.composer({ action: '/chat' })), 'otherwise it needs words');
const topped = t.composer({ action: '/chat', top: '<ul class="picked"></ul>', maxlength: 20000 });
assert.ok(topped.includes('<ul class="picked"></ul><label class="ovt-sr" for="ovt-text">') && topped.includes('maxlength="20000"'), 'a slot above the box, and its limit');

const page = t.page({ sidebar: side, head: t.head({ title: 'Chat' }), turns: [], empty: '<h2>What can I do for you?</h2>', composer: t.composer({ action: '/chat', starters: ['One'] }) });
assert.ok(page.startsWith('<div class="ovt" data-ovt>') && page.includes('<div class="ovt-empty-state"><h2>What can I do for you?</h2></div><ol class="ovt-thread" data-ovt-thread></ol>'));
assert.ok(page.includes('</aside><div class="ovk-sidebar-scrim" data-ovk-sidebar-scrim hidden></div>'), 'the kit\'s scrim closes the drawer');

// ── 4.99.0: the parts Codes needs (several agents in one conversation, approvals, what the work produced) ──────
const pinnedSide = t.sidebar({ pinned: [{ href: '/tasks/c', title: 'Conductor', dot: 'needs' }], groups: [{ name: 'Today', items: [{ href: '/tasks/1', title: 'Fix', meta: '2h' }] }], findPlaceholder: 'Search conversations' });
assert.ok(/<h2 class="ovk-sidebar-h">Pinned<\/h2>[\s\S]*Conductor[\s\S]*is-needs[\s\S]*Today/.test(pinnedSide) || (pinnedSide.indexOf('Pinned') > -1 && pinnedSide.indexOf('Pinned') < pinnedSide.indexOf('Today') && pinnedSide.includes('is-needs')), 'pinned chats above the groups, with their dot');
assert.ok(pinnedSide.includes('<span class="ovk-sidebar-m">2h</span>') && pinnedSide.includes('placeholder="Search conversations"'), 'a quiet word after the title, and the find box\'s words');
const agentTurn = t.turn({ id: 'a1', who: { name: 'Codex <x>', initials: 'Cxy', color: '#10a37f', sub: 'gpt-5 · Thorough' }, reply: '<p>Done</p>' });
assert.ok(agentTurn.includes('<span class="ovt-avatar is-who" style="--ovt-who:#10a37f" aria-hidden="true">Cx</span>'), 'the agent\'s face: two letters in its colour');
assert.ok(agentTurn.includes('<p class="ovt-who"><b>Codex &lt;x&gt;</b><span>gpt-5 · Thorough</span></p><p>Done</p>'), 'its name over the reply, escaped');
for (const bad of ['red;background:url(//x)', 'expression(1)', '#12345678901']) assert.ok(!t.face({ name: 'A', color: bad }).includes('style='), `no colour that is not one: ${bad}`);
assert.ok(t.face({ name: 'A', color: 'var(--accent)' }).includes('style="--ovt-who:var(--accent)"'), 'a theme token is a colour');
const brief = t.turn({ you: { text: 'Do it', caption: 'Hand-over brief' }, reply: null });
assert.ok(brief.includes('<span class="ovt-caption">Hand-over brief</span>') && !brief.includes('ovt-bot'), 'a caption over the bubble; reply null draws only the person');
assert.strictEqual(t.divider({ text: 'Codex took <over>' }).replace(/<svg[\s\S]*?<\/svg>/, ''), '<li class="ovt-divider"><span>Codex took &lt;over&gt;</span></li>', 'a hand-over line, escaped');
const ask = t.card({ tone: 'wait', icon: 'shield', title: 'Bash', text: 'wants to run', code: 'rm -rf "<dir>"', form: { action: '/tasks/1/approvals/2', hidden: { back: '/tasks/1' }, buttons: [{ name: 'decision', value: 'allow', label: 'Allow' }, { name: 'decision', value: 'deny', label: 'Deny', quiet: true }] } });
assert.ok(ask.startsWith('<form class="ovt-card is-wait" method="post" action="/tasks/1/approvals/2"><input type="hidden" name="back" value="/tasks/1">'), 'an approval posts without script');
assert.ok(ask.includes('<pre class="ovt-card-code" tabindex="0">rm -rf &quot;&lt;dir&gt;&quot;</pre>') && ask.includes('<button type="submit" class="ovt-card-btn is-quiet" name="decision" value="deny">Deny</button>'), 'what it runs, escaped; Allow and Deny');
assert.ok(t.card({ tone: 'bad', text: 'x' }).startsWith('<div class="ovt-card is-bad">'), 'a card without a form stays a div');
const pan = t.panel({ id: 'what', title: 'What it did', sections: [{ title: 'Agents', rows: [{ who: { name: 'Codex', initials: 'Cx' }, title: 'Codex', sub: 'finished' }] }, { title: 'Where', rows: [{ icon: 'file', html: '<code>src/</code>' }] }, null] });
assert.ok(pan.startsWith('<aside class="ovt-panel" id="what" aria-label="What it did" data-ovt-panel>') && pan.includes('<h3>Agents</h3>') && pan.includes('<b>Codex</b><small>finished</small>') && pan.includes('<span><code>src/</code></span>'), 'the panel and its rows');
const withPanel = t.page({ sidebar: side, head: t.head({ title: 'Fix', panel: 'what', panelLabel: 'What it did' }), turns: [agentTurn, t.divider({ text: 'Codex took over' })], panel: pan });
assert.ok(withPanel.startsWith('<div class="ovt has-panel" data-ovt>') && withPanel.endsWith('</aside><div class="ovt-panel-scrim" data-ovt-panel-scrim hidden></div></div>'), 'the panel after the conversation, with its scrim');
assert.ok(withPanel.includes('data-ovt-panel-open aria-controls="what" aria-expanded="false" aria-label="What it did"'), 'the head\'s button opens it');
const plain = t.page({ sidebar: side, head: t.head({ title: 'Agents' }), main: '<h2>Your agents</h2>' });
assert.ok(plain.includes('<div class="ovt-scroll ovt-page"><h2>Your agents</h2></div></section>') && !plain.includes('ovt-dock'), 'a plain page in the same frame, no composer');

const steps = t.work({ rows: [{ kind: 'tool', name: 'Edit', input: 'a.css', icon: 'edit', ok: true }, { kind: 'tool', name: 'Bash', input: 'npm test', output: 'ok', ok: true }] });
assert.ok(steps.includes('<li class="ovt-w-tool is-ok"><div class="ovt-w-row"><svg class="ovt-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9') && !/Edit[\s\S]*?Running…/.test(steps.split('Bash')[0]), 'a finished step with no output is a plain row, with its own icon');
assert.ok(steps.includes('<details><summary>') && steps.includes('<pre class="ovt-w-out">ok</pre>'), 'a step with output still opens');
const ended = t.work({ rows: [{ kind: 'tool', name: 'Read', running: false }] });
assert.ok(ended.includes('<li class="ovt-w-tool is-done">') && ended.includes('<span class="ovt-w-st"></span>'), 'a step that ended with no result has no mark');
assert.ok(!t.head({ title: '' }).includes('<h1') && t.head({ title: 'x' }).includes('<h1 class="ovt-title">x</h1>'), 'no empty heading');
assert.ok(t.panel({ sections: [{ rows: [{ iconHtml: '<svg class="mine"></svg>', title: 'Repo' }] }] }).includes('<li><svg class="mine"></svg><span><b>Repo</b>'), 'a panel row with the site\'s own icon');
const startForm = t.composer({ action: '/chat', id: 'ch-start', attrs: { 'data-ch-api': '/api/x"y' }, foot: '<p class="where">On your computer</p>' });
assert.ok(startForm.includes('<form class="ovt-composer" id="ch-start" method="post" action="/chat" data-ovt-composer data-ch-api="/api/x&quot;y">'), 'the form\'s id and the site\'s attributes, escaped');
assert.ok(startForm.includes('<p class="where">On your computer</p><p class="ovt-c-note" data-ovt-note role="status"></p>'), 'markup under the bar, then a status line that is always there');
assert.ok(t.page({ turns: [], center: true, cls: 'ch' }).startsWith('<div class="ovt is-start ch" data-ovt>'), 'a start page');
assert.ok(t.page({ turns: [agentTurn], center: true }).startsWith('<div class="ovt" data-ovt>'), 'not once the conversation has turns');

// ── The script ─────────────────────────────────────────────────────────────────────────────────────────────────
const SRC = fs.readFileSync(path.join(__dirname, '..', 'ov-thread.js'), 'utf8');
const html = `<!doctype html><html><body>${t.page({ sidebar: side, head: t.head({ title: 'Chat' }), turns: [turn, t.turn({ id: 'tsk_0', state: 'succeeded', you: { text: 'Hi' }, reply: ans })], composer: t.composer({ action: '/chat', starters: ['Plan a weekend'] }) })}</body></html>`;
const { window, document } = parseHTML(html);
delete globalThis.OVThread;
const copied = [];
// Node has a global navigator of its own (no clipboard): the script gets one with a clipboard to write to.
const nav = { clipboard: { writeText: (x) => { copied.push(x); return Promise.resolve(); } } };
new Function('window', 'document', 'navigator', 'location', 'setTimeout', SRC)(window, document, nav, { hash: '' }, setTimeout);
const OV = window.OVThread;
assert.ok(OV && typeof OV.add === 'function', 'window.OVThread');
const box = document.querySelector('[data-ovt]');
assert.strictEqual(box.dataset.ovtReady, '1');

// Find a chat, in the kit sidebar: it filters as you type (the drawer is kit-web.js's).
const find = document.querySelector('.ovk-sidebar-find input');
find.value = 'lisbon'; find.dispatchEvent(new window.Event('input'));
const items = [...document.querySelectorAll('.ovk-sidebar-secs .ovk-sidebar-item')];
assert.deepStrictEqual(items.map((a) => a.hidden), [true, false], 'only the matching chat shows');
const submitted = new window.Event('submit', { cancelable: true });
find.closest('form').dispatchEvent(submitted);
assert.ok(submitted.defaultPrevented, 'Enter keeps you on the page');

// The composer: Send waits for words; a starter fills it.
const send = document.querySelector('[data-ovt-send]');
assert.strictEqual(send.disabled, true, 'nothing to send');
document.querySelector('[data-ovt-starter]').dispatchEvent(new window.Event('click'));
assert.strictEqual(document.querySelector('[data-ovt-text]').value, 'Plan a weekend');
assert.strictEqual(send.disabled, false);

// Copy shows where the clipboard can be written, and copies the answer.
const copyBtn = document.querySelector('[data-turn="tsk_0"] [data-ovt-copy]');
assert.strictEqual(copyBtn.hidden, false, 'Copy shows');
copyBtn.dispatchEvent(new window.Event('click'));
assert.strictEqual(copied.length, 1);
assert.ok(!/Copy$/.test(copied[0]), 'not the Copy buttons\' own words');

// Streaming helpers.
OV.live('tsk_1', 'Checking the answer');
assert.strictEqual(document.querySelector('[data-turn="tsk_1"] [data-ovt-live]').textContent, 'Checking the answer…');
OV.work('tsk_1', '<li class="ovt-w-step"><span>Read two pages</span></li>');
assert.strictEqual(document.querySelectorAll('[data-turn="tsk_1"] [data-ovt-work] > li').length, 3);
const swapped = OV.replace('tsk_1', t.turn({ id: 'tsk_1', state: 'succeeded', you: { text: 'What <is> it?' }, reply: t.answer({ html: '<p>Done</p>' }) }));
const typed = swapped.querySelector('[data-ovt-answer]');
assert.ok(typed.classList.contains('is-revealing') || swapped.classList.contains('is-fresh'), 'a finished turn\'s answer types in (or fades in)');
if (typed.classList.contains('is-revealing')) assert.ok(typed.querySelectorAll('.ovt-sw').length >= 1 && typed.textContent.includes('Done'), 'word by word, every word still in the text');
assert.strictEqual(document.querySelector('[data-turn="tsk_1"] [data-ovt-copy]').hidden, false, 'the new turn has Copy');
const added = OV.add(t.turn({ id: 'tsk_2', open: true, you: { text: 'Next' }, reply: t.work({ open: true }) }));
assert.ok(added.classList.contains('is-new') && document.querySelectorAll('[data-ovt-thread] > li').length === 3, 'a new turn joins the thread');
// A streamed tool row (4.99.0): built from text, running, then done.
const row = OV.tool('tsk_2', { name: '<Bash>', input: 'npm test', icon: 'run' });
assert.ok(row && row.classList.contains('is-run') && row.querySelector('b').textContent === '<Bash>' && !row.querySelector('b').innerHTML.includes('<B'), 'a running row, its words as text');
assert.ok(row.querySelector('.ovt-dot'), 'its dot while it runs');
OV.toolDone('tsk_2', false);
assert.ok(row.classList.contains('is-bad') && !row.querySelector('.ovt-dot') && row.querySelector('.ovt-w-st svg'), 'it failed: the dot becomes a mark');
const r1 = OV.tool('tsk_2', { name: 'Read', key: 't1' }), r2 = OV.tool('tsk_2', { name: 'Grep', key: 't2' });
OV.toolDone('tsk_2', true, 't1');
assert.ok(r1.classList.contains('is-ok') && r2.classList.contains('is-run'), 'a result finds its own row by key, not the last one');
OV.toolDone('tsk_2', null, 't2');
assert.ok(r2.classList.contains('is-done') && !r2.querySelector('.ovt-w-st svg') && !r2.querySelector('.ovt-dot'), 'ended with no result: no mark');

// The panel's drawer (4.99.0): the head's button opens it, the scrim and Escape close it, the focus comes back.
{
    const doc2 = parseHTML(`<!doctype html><html><body>${withPanel}</body></html>`);
    delete globalThis.OVThread;
    new Function('window', 'document', 'navigator', 'location', 'setTimeout', SRC)(doc2.window, doc2.document, nav, { hash: '' }, setTimeout);
    const b2 = doc2.document.querySelector('[data-ovt]');
    const opener = doc2.document.querySelector('[data-ovt-panel-open]');
    const scrim = doc2.document.querySelector('[data-ovt-panel-scrim]');
    opener.dispatchEvent(new doc2.window.Event('click'));
    assert.ok(b2.classList.contains('is-panel') && scrim.hidden === false && opener.getAttribute('aria-expanded') === 'true', 'the button opens the panel');
    scrim.dispatchEvent(new doc2.window.Event('click'));
    assert.ok(!b2.classList.contains('is-panel') && scrim.hidden === true && opener.getAttribute('aria-expanded') === 'false', 'the scrim closes it');
    opener.dispatchEvent(new doc2.window.Event('click'));
    const esc = new doc2.window.Event('keydown'); esc.key = 'Escape';
    doc2.document.dispatchEvent(esc);
    assert.ok(!b2.classList.contains('is-panel'), 'Escape closes it');
}

console.log('thread: all passed');
