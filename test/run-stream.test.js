'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseHTML } = require('linkedom');

const src = fs.readFileSync(path.join(__dirname, '..', 'ov-run.js'), 'utf8');
const tick = () => new Promise((resolve) => setImmediate(resolve));
const run = { ref: 'codes:a', kind: 'code', title: 'A', status: 'running' };
const step = { seq: 1, kind: 'message', from: 'agent', text: 'Hello 🌍' };

async function setup(chunks) {
    const { document } = parseHTML('<html><head></head><body><div id="host"></div></body></html>');
    const window = {};
    const timers = new Map(), cursors = [];
    let timerId = 0, cancelled = 0, controller;
    const streams = [];
    const fetch = async (url, init) => {
        if (url.endsWith('/events')) {
            cursors.push(init.headers['Last-Event-ID']);
            const stream = new ReadableStream({ start(c) { controller = c; }, cancel() { cancelled++; } });
            streams.push(stream);
            return { ok: true, body: stream };
        }
        return { ok: true, json: async () => url.includes('/steps?') ? { steps: [] } : run };
    };
    new Function('window', 'document', 'fetch', 'requestAnimationFrame', 'setTimeout', 'clearTimeout', src)(
        window, document, fetch, (fn) => fn(), (fn) => { timers.set(++timerId, fn); return timerId; }, (id) => timers.delete(id));
    const host = document.getElementById('host');
    const view = window.OpenVibeRun.mount(host, { blank: true });
    await view.open(run.ref);
    for (const chunk of chunks) controller.enqueue(chunk);
    await tick();
    return { host, view, get controller() { return controller; }, streams, timers, cursors, cancelled: () => cancelled };
}

(async () => {
    // Real run rendering, arbitrary byte boundaries, and all legal SSE line endings.
    for (const eol of ['\r\n', '\r', '\n']) {
        const bytes = new TextEncoder().encode([': heartbeat', 'id: 1', 'event: step', 'data: {', `data: "step": ${JSON.stringify(step)}`, 'data: }', '', ''].join(eol));
        const env = await setup([...bytes].map((b) => Uint8Array.of(b)));
        try { assert.match(env.host.textContent, /Hello 🌍/, `renders ${JSON.stringify(eol)} split into single bytes`); }
        finally { env.view.destroy(); }
    }
    // An end event can arrive while the server leaves the connection open.
    const env = await setup([new TextEncoder().encode(`event: step\ndata: ${JSON.stringify({ step })}\n\nevent: end\ndata: {"status":"done"}\n\nevent: delta\ndata: {"seq":1,"text":"late"}\n\n`)]);
    assert.equal(env.view.state.run.status, 'done');
    assert.ok(!env.host.textContent.includes('late'), 'events after end do not change the answer');
    assert.equal(env.cancelled(), 1, 'terminal event releases the live stream');
    assert.equal(env.streams[0].locked, false, 'terminal reader releases its lock');
    assert.equal(env.timers.size, 0, 'terminal event does not reconnect');
    env.view.destroy();

    const active = await setup([]);
    active.view.destroy();
    await tick();
    assert.equal(active.cancelled(), 1, 'leaving a run cancels a pending reader');
    assert.equal(active.timers.size, 0);

    // Only valid, fully dispatched steps advance the replay cursor. Multiline data keeps its newline.
    const replay = await setup([new TextEncoder().encode(`id: 1\nevent: step\ndata: ${JSON.stringify({ step })}\n\nid: 99\nevent: step\ndata: {"step":{"seq":99,"kind":"message","text":"bad\ndata: join"}}\n\nid: 100\nevent: step\ndata: {"step":`)]);
    replay.controller.close(); await tick();
    assert.equal(replay.streams[0].locked, false);
    assert.equal(replay.timers.size, 1, 'EOF schedules one reconnect');
    assert.ok(!replay.host.textContent.includes('badjoin'), 'data lines are joined with a newline, not glued together');
    const [id, reconnect] = [...replay.timers][0]; replay.timers.delete(id); reconnect(); await tick();
    assert.deepEqual(replay.cursors, ['0', '1'], 'reconnect resumes after the last valid step');
    replay.controller.close(); await tick();
    replay.view.destroy(); await tick();
    assert.equal(replay.timers.size, 0, 'leaving during backoff clears its timer');
    assert.equal(replay.cursors.length, 2);
    console.log('run-stream: line endings, UTF-8 and stream cleanup passed');
})().catch((err) => { console.error(err); process.exitCode = 1; });
