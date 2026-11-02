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
assert.ok(side.includes('<a href="/chat/1" aria-current="page" data-title="plan &lt;b&gt;a&lt;/b&gt; weekend"><span class="ovt-dot" aria-hidden="true"></span><span>Plan &lt;b&gt;a&lt;/b&gt; weekend</span></a>'), 'escaped, current, live');
assert.ok(side.includes('class="ovt-new" href="/chat"') && side.includes('data-ovt-find') && side.includes('<a href="/memory">Memory</a>'));
assert.ok(t.sidebar({ groups: [] }).includes('Your chats show here.'), 'the empty line');
assert.ok(t.head({ title: 'A <title>', newHref: '/chat' }).includes('<h1 class="ovt-title">A &lt;title&gt;</h1>'));

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
assert.ok(/data-ovt-text required/.test(t.composer({ action: '/chat' })), 'otherwise it needs words');

const page = t.page({ sidebar: side, head: t.head({ title: 'Chat' }), turns: [], empty: '<h2>What can I do for you?</h2>', composer: t.composer({ action: '/chat', starters: ['One'] }) });
assert.ok(page.startsWith('<div class="ovt" data-ovt>') && page.includes('<div class="ovt-empty-state"><h2>What can I do for you?</h2></div><ol class="ovt-thread" data-ovt-thread></ol>'));

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

// The drawer.
document.querySelector('[data-ovt-open]').dispatchEvent(new window.Event('click'));
assert.ok(box.classList.contains('is-drawer') && document.querySelector('.ovt-scrim').hidden === false, 'opens');
assert.strictEqual(document.querySelector('[data-ovt-open]').getAttribute('aria-expanded'), 'true');
const esc = new window.Event('keydown'); esc.key = 'Escape'; document.dispatchEvent(esc);
assert.ok(!box.classList.contains('is-drawer'), 'Esc closes');

// Find a chat.
const find = document.querySelector('[data-ovt-find]');
find.value = 'lisbon'; find.dispatchEvent(new window.Event('input'));
const items = [...document.querySelectorAll('.ovt-list li')];
assert.deepStrictEqual(items.map((li) => li.hidden), [true, false], 'only the matching chat shows');

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

// Streaming helpers.
OV.live('tsk_1', 'Checking the answer');
assert.strictEqual(document.querySelector('[data-turn="tsk_1"] [data-ovt-live]').textContent, 'Checking the answer…');
OV.work('tsk_1', '<li class="ovt-w-step"><span>Read two pages</span></li>');
assert.strictEqual(document.querySelectorAll('[data-turn="tsk_1"] [data-ovt-work] > li').length, 3);
const swapped = OV.replace('tsk_1', t.turn({ id: 'tsk_1', state: 'succeeded', you: { text: 'What <is> it?' }, reply: t.answer({ html: '<p>Done</p>' }) }));
assert.ok(swapped.classList.contains('is-fresh'), 'a finished turn\'s answer fades in');
assert.strictEqual(document.querySelector('[data-turn="tsk_1"] [data-ovt-copy]').hidden, false, 'the new turn has Copy');
const added = OV.add(t.turn({ id: 'tsk_2', open: true, you: { text: 'Next' }, reply: t.work({ open: true }) }));
assert.ok(added.classList.contains('is-new') && document.querySelectorAll('[data-ovt-thread] > li').length === 3, 'a new turn joins the thread');

console.log('thread: all passed');
