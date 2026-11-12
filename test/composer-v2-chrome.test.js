'use strict';
// Composer v2 (ov-composer.js 4.215.0, OpenVibeComposer.mount) in a real headless Chrome at 390 px: the four presets
// draw their own tools; a post says who sees it above the box and puts its pictures under the words; onSubmit gets the
// words, the files and the chips' choices and the box clears after; false keeps it; the ring fills toward the limit;
// emoji go in at the caret; a site's tool module (tool()) joins every box that names it; nothing is wider than a phone.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const h = require('../browser-harness');
assert.doesNotThrow(() => require('../ov-composer'), 'ov-composer.js loads (browser-only: Node takes the early return)');
if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) { console.log('composer-v2-chrome: skipped (no Chrome; set CHROME_BIN)'); process.exit(0); }
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/ov-composer.js' || u === '/ov-window.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(path.join(root, u.slice(1)))); }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="margin:0;padding:16px;background:#0b1220;color:#e6edf7;font-family:sans-serif"><div id="a"></div><div id="b"></div><div id="c"></div><div id="d"></div>
<script src="/ov-composer.js"></script>
<script>
window.got = [];
const C = OpenVibeComposer;
C.tool('poll', { label: 'Poll', path: 'M5 20V10M12 20V4M19 20v-7', run: (ctx) => { ctx.insert('[poll] '); } });
window.post = C.mount(document.getElementById('a'), { preset: 'post', id: 'p1', user: { display_name: 'goosely' }, maxLength: 100,
    tools: ['photo', 'file', 'emoji', 'poll', 'voice'],
    audience: { name: 'audience', label: 'Who sees it', options: [['public', 'Everyone'], ['followers', 'Followers']], value: 'public' },
    onSubmit: async (v) => { window.got.push({ text: v.text, files: v.files.map((f) => f.name), audience: v.audience }); return window.keepNext ? false : true; } });
window.chatSent = []; window.saved = [];
window.chat = C.mount(document.getElementById('b'), { preset: 'chat', id: 'c1', onSubmit: async (v) => { window.chatSent.push({ text: v.text, reply: v.reply }); return true; } });
window.agent = C.mount(document.getElementById('c'), { preset: 'agent', id: 'g1', mode: { name: 'mode', label: 'Mode', options: [['balanced', 'Balanced'], ['best', 'Best']], value: 'balanced' },
    chips: [{ name: 'effort', label: 'Reasoning', icon: 'gauge', options: [['medium', 'Medium'], ['high', 'High']], value: 'high' }],
    onSubmit: async (v) => { window.got.push({ mode: v.mode, effort: v.chips.effort }); } });
window.reply = C.mount(document.getElementById('d'), { preset: 'comment', id: 'r1', user: { display_name: 'Maticus', avatar_url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }, onSubmit: async () => true });
</script>`);
});
(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'composer-v2-'));
    const browser = await h.launch({ tmpDir });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
        const page = await h.openPage(browser, await browser.newContext(), { width: 390, height: 900 });
        await page.goto(base + '/', { maxMs: 5000 });
        const until = async (expr) => { const end = Date.now() + 5000; while (Date.now() < end) { const v = await page.evaluate(expr); if (v) return v; await wait(40); } return false; };
        assert.ok(await until(`!!window.reply`), 'the four composers mount');

        // Each preset draws its own tools, chips and send.
        const shape = await page.evaluate(`(() => [...document.querySelectorAll('.ovc-v2')].map((f) => ({ preset: f.dataset.preset,
            // 4.223.0: the mic and the + lead the row; the box's own tools follow.
            lead: [...f.querySelectorAll('.ovt-c-tools .ovt-btn')].map((b) => b.getAttribute('aria-label')).filter((l) => l === 'Speak' || l === 'More: attach, timer and tools'),
            tools: [...f.querySelectorAll('.ovt-c-tools .ovt-btn')].map((b) => b.getAttribute('aria-label')).filter((l) => l !== 'Speak' && l !== 'More: attach, timer and tools'),
            avatar: !!f.querySelector('.ovc-head .ovc-av'), full: Math.abs(f.querySelector('textarea').getBoundingClientRect().left - f.querySelector('.ovc-body').getBoundingClientRect().left) < 4, round: f.querySelector('[data-ovt-send]').classList.contains('ovt-send--round'),
            send: f.querySelector('[data-ovt-send]').textContent.trim(), chips: [...f.querySelectorAll('.ovc-chip-v')].map((c) => c.textContent) })))()`);
        assert.deepEqual(shape.map((s) => s.preset), ['post', 'chat', 'agent', 'comment']);
        assert.ok(shape.every((s) => s.lead[s.lead.length - 1] === 'More: attach, timer and tools' && (s.lead.length === 1 || s.lead[0] === 'Speak')), `the mic, then the +, lead every row (${JSON.stringify(shape.map((s) => s.lead))})`);
        assert.deepEqual(shape[0].tools.slice(0, 4), ['Photos and video', 'Files', 'Emoji', 'Poll'], 'a post: photos, files, emoji and the site\'s own tool');
        assert.ok(shape[0].avatar && shape[0].send === 'Post' && !shape[0].round);
        assert.ok(shape.every((x) => x.full), 'the words use the full width: no column kept for the picture');
        assert.deepEqual(shape[0].chips, ['Everyone']);
        assert.deepEqual(shape[1].tools.slice(0, 2), ['Attach', 'Emoji']);
        assert.ok(shape[1].round && !shape[1].avatar, 'a chat: a round send, no picture');
        assert.ok(shape[2].round && shape[2].chips.join() === 'Balanced,High', 'an agent: its mode and reasoning chips and a round send');
        assert.ok(shape[3].avatar && shape[3].send === 'Reply');

        // A post: who sees it is above the box; a picture goes under the words.
        let order = await page.evaluate(`(() => { const b = document.querySelector('#p1 .ovc-body'); return [...b.children].map((n) => n.className || n.tagName.toLowerCase()); })()`);
        assert.ok(order.indexOf('ovc-head') === 0 && order.indexOf('ovc-head') < order.indexOf('textarea'), `the picture, the name and who sees it are above the box (${order})`);
        assert.ok(await page.evaluate(`!!document.querySelector('#p1 .ovc-head .ovc-chips .ovc-chip')`), 'the audience chip is in that line');
        await page.evaluate(`post.add([new File([new Uint8Array([71, 73, 70])], 'cat.gif', { type: 'image/gif' })])`);
        order = await page.evaluate(`(() => [...document.querySelector('#p1 .ovc-body').children].map((n) => n.className || n.tagName.toLowerCase()))()`);
        assert.ok(order.indexOf('textarea') < order.findIndex((c) => String(c).includes('ovc-files')), `pictures go under the words (${order})`);

        // The site's tool runs with the box's context; emoji go in at the caret.
        await page.evaluate(`document.querySelector('#p1 .ovc-t-poll').click()`);
        await page.evaluate(`document.querySelector('#p1 .ovc-t-emoji').click()`);
        assert.ok(await until(`!!document.querySelector('#p1 .ovc-emoji:not([hidden])')`), 'the emoji panel opens');
        await page.evaluate(`document.querySelector('#p1 .ovc-emoji button').click()`);
        assert.match(await page.evaluate(`document.querySelector('#p1 textarea').value`), /^\[poll\] 😀$/);

        // The ring fills toward the limit and turns red past it.
        await page.evaluate(`post.ctx.set('x'.repeat(90))`);
        assert.ok(await page.evaluate(`document.querySelector('#p1 .ovc-ring').classList.contains('is-near')`), '90 of 100 is near the limit');

        // Send: the words, the files and the audience; then the box clears. false keeps it.
        await page.evaluate(`(() => { post.ctx.set('Hello'); document.querySelector('#p1 select').value = 'followers'; document.querySelector('#p1 select').dispatchEvent(new Event('change', { bubbles: true })); })()`);
        assert.equal(await page.evaluate(`document.querySelector('#p1 .ovc-chip-v').textContent`), 'Followers', 'the chip shows the choice');
        await page.evaluate(`document.querySelector('#p1 [data-ovt-send]').click()`);
        assert.ok(await until(`window.got.length === 1`));
        assert.deepEqual(await page.evaluate(`window.got[0]`), { text: 'Hello', files: ['cat.gif'], audience: 'followers' });
        assert.ok(await until(`document.querySelector('#p1 textarea').value === '' && !document.querySelector('#p1 .ovc-file')`), 'the box clears after the send');
        await page.evaluate(`(() => { window.keepNext = true; post.ctx.set('Keep me'); document.querySelector('#p1 [data-ovt-send]').click(); })()`);
        assert.ok(await until(`window.got.length === 2`));
        assert.equal(await page.evaluate(`document.querySelector('#p1 textarea').value`), 'Keep me', 'onSubmit false keeps the box');

        // An agent's mode goes with the send.
        await page.evaluate(`(() => { agent.ctx.set('Plan my week'); document.querySelector('#g1 [data-ovt-send]').click(); })()`);
        assert.ok(await until(`window.got.length === 3`));
        assert.deepEqual(await page.evaluate(`window.got[2]`), { mode: 'balanced', effort: 'high' }, 'the mode and any more chips go with the send');
        // While a run works, the send is Stop.
        await page.evaluate(`(() => { window.stopped = 0; agent.setRunning(true, () => { window.stopped++; }); })()`);
        assert.equal(await page.evaluate(`document.querySelector('#g1 [data-ovt-send]').getAttribute('aria-label')`), 'Stop');
        await page.evaluate(`document.querySelector('#g1 [data-ovt-send]').click()`);
        assert.equal(await page.evaluate(`window.stopped`), 1, 'Stop calls onStop');
        assert.equal(await page.evaluate(`window.got.length`), 3, 'and sends nothing');
        await page.evaluate(`agent.setRunning(false)`);
        assert.equal(await page.evaluate(`document.querySelector('#g1 [data-ovt-send]').getAttribute('aria-label')`), 'Send');

        // Editing your message in the box (openvibe.design rule 138): a bar says so, the send is Save, Enter saves
        // through onSave (not onSubmit), Esc puts back what was in the box.
        await page.evaluate(`(() => { const t = chat.text; t.value = 'half a draft'; t.dispatchEvent(new Event('input', { bubbles: true })); chat.edit({ text: 'Yo', onSave: async (x) => { window.saved.push(x); } }); })()`);
        const ed = await page.evaluate(`(() => { const f = document.getElementById('c1'); return { bar: (f.querySelector('.ovc-bar b') || {}).textContent, text: f.querySelector('textarea').value, send: f.querySelector('[data-ovt-send]').getAttribute('aria-label'), editing: chat.editing(), first: f.querySelector('.ovc-body').firstElementChild.className }; })()`);
        assert.deepEqual(ed, { bar: 'Editing your message', text: 'Yo', send: 'Save', editing: true, first: 'ovc-bar' });
        // In the one-line chat box the bar is a line of its own: the words keep the box's width under it.
        const lay = await page.evaluate(`(() => { const f = document.getElementById('c1'), b = f.querySelector('.ovc-bar').getBoundingClientRect(), t = f.querySelector('textarea').getBoundingClientRect(), body = f.querySelector('.ovc-body').getBoundingClientRect();
            return { barFull: Math.abs(b.width - body.width) < 2, below: t.top >= b.bottom - 1, left: Math.abs(t.left - body.left) < 4 }; })()`);
        assert.deepEqual(lay, { barFull: true, below: true, left: true }, 'the editing bar spans the chat box and the words sit under it');
        await page.evaluate(`(() => { const t = chat.text; t.value += ' there'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        await page.evaluate(`document.querySelector('#c1 [data-ovt-send]').click()`);
        await until(`window.saved.length === 1`);
        assert.deepEqual(await page.evaluate(`window.saved`), ['Yo there'], 'Save sends the edit to onSave');
        assert.equal(await page.evaluate(`window.chatSent.length`), 0, 'an edit is not a new message');
        assert.deepEqual(await page.evaluate(`({ bar: !!document.querySelector('#c1 .ovc-bar'), text: chat.text.value, send: document.querySelector('#c1 [data-ovt-send]').getAttribute('aria-label') })`),
            { bar: false, text: 'half a draft', send: 'Send' }, 'after saving: the draft is back and the send is Send');
        await page.evaluate(`chat.edit({ text: 'Yo', onSave: async () => {} })`);
        await page.evaluate(`chat.text.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))`);
        assert.deepEqual(await page.evaluate(`({ bar: !!document.querySelector('#c1 .ovc-bar'), text: chat.text.value, editing: chat.editing() })`), { bar: false, text: 'half a draft', editing: false }, 'Esc cancels');
        // Replying: a bar names who, and the send carries the reply.
        await page.evaluate(`chat.reply({ name: 'goosely', text: 'Yo', data: { id: 7 } })`);
        assert.equal(await page.evaluate(`document.querySelector('#c1 .ovc-bar b').textContent`), 'Replying to goosely');
        await page.evaluate(`document.querySelector('#c1 [data-ovt-send]').click()`);
        await until(`window.chatSent.length === 1`);
        assert.deepEqual(await page.evaluate(`window.chatSent[0]`), { text: 'half a draft', reply: { id: 7 } });
        assert.equal(await page.evaluate(`!!document.querySelector('#c1 .ovc-bar')`), false, 'the reply bar goes with the send');

        // Nothing is wider than the phone.
        assert.equal(await page.evaluate(`document.documentElement.scrollWidth`), 390);
        await page.close();
        console.log('composer-v2-chrome: four presets, a post\'s chip above and pictures under, onSubmit and false, the ring, emoji, a site\'s tool, editing and replying bars, 390 px');
    } finally {
        await browser.close();
        server.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
