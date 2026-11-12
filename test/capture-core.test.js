'use strict';
/**
 * ov-capture.js (window.OVCapture), the capture core Live, Cam and the composer share, run against a fake browser:
 *   - the strategies in order, the first that opens wins; a refusal stops at once; a hung strategy is timed out;
 *   - every part can be replaced (and the replaced one called through); strategies added, removed, replaced, reset;
 *   - the screen, a photo and a recording;
 *   - the person's settings: this device first; the portable ones follow them through settings.sync(), while camera and
 *     microphone ids stay on the device;
 *   - plain words for every failure, with the site's own last step;
 *   - one copy wins (a newer one is never replaced by an older), and the module fetches nothing from anywhere.
 *   node test/capture-core.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'ov-capture.js'), 'utf8');
const code = source.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
assert.ok(!/https?:\/\//.test(code), 'the module names no URL');
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|importScripts|createElement\(['"]script/.test(code), 'the module fetches nothing and loads nothing');

class FakeTrack { constructor(kind) { this.kind = kind; this.stopped = false; } stop() { this.stopped = true; } }
class FakeStream {
    constructor(tracks = []) { this.tracks = tracks.slice(); }
    getTracks() { return this.tracks; }
    getVideoTracks() { return this.tracks.filter((t) => t.kind === 'video'); }
    getAudioTracks() { return this.tracks.filter((t) => t.kind === 'audio'); }
    addTrack(t) { this.tracks.push(t); }
}
class FakeDOMException extends Error { constructor(message, name) { super(message); this.name = name; } }
class FakeBlob { constructor(parts, o = {}) { this.parts = parts; this.type = o.type || ''; this.size = parts.length; } }
class FakeRecorder {
    constructor(stream, options) { this.stream = stream; this.mimeType = (options && options.mimeType) || 'video/webm'; this.state = 'inactive'; FakeRecorder.last = this; }
    static isTypeSupported(t) { return /webm/.test(t); }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable({ data: { size: 3 } }); this.onstop(); }
}

function load({ gum, display, ua, extra = {} } = {}) {
    const store = new Map();
    const calls = [];
    const ctx = vm.createContext({
        navigator: {
            userAgent: ua || 'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36', maxTouchPoints: 5, onLine: true,
            mediaDevices: {
                getUserMedia: gum ? (c) => { calls.push(c); return gum(c, calls.length); } : undefined,
                getDisplayMedia: display ? (c) => { calls.push(c); return display(c); } : undefined,
                enumerateDevices: async () => [{ kind: 'videoinput', deviceId: 'a', label: 'Front' }],
            },
        },
        MediaStream: FakeStream, DOMException: FakeDOMException, Blob: FakeBlob, MediaRecorder: FakeRecorder,
        setTimeout, clearTimeout, setInterval, clearInterval, console, isSecureContext: true,
        localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
        document: { addEventListener() {} },
        ...extra,
    });
    ctx.window = ctx;
    vm.runInContext(source, ctx);
    return { capture: ctx.OVCapture, calls, store, ctx };
}
// Values made inside the vm come from another realm: compare them as JSON.
const same = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);
const both = (c) => new FakeStream([...(c.video ? [new FakeTrack('video')] : []), ...(c.audio ? [new FakeTrack('audio')] : [])]);
const tick = () => new Promise((r) => setImmediate(r));

(async () => {
    // ── Opening a camera ──
    let t = load({ gum: async (c) => both(c) });
    assert.strictEqual(t.capture.version, 2);
    let s = await t.capture.open({ mode: 'camera', facing: 'environment', resolution: '1080' });
    assert.strictEqual(s.getVideoTracks().length, 1);
    assert.strictEqual(t.calls.length, 1, 'the preferred way opened it in one call');
    same(t.calls[0].video.facingMode, { ideal: 'environment' });
    assert.strictEqual(t.calls[0].video.height.ideal, 1080);

    // Both at once refused by the hardware (an Android phone): the camera, then the microphone, each on its own.
    t = load({ gum: async (c) => { if (c.video && c.audio) throw new FakeDOMException('busy', 'OverconstrainedError'); return both(c); } });
    const seen = [];
    t.capture.on('failed', (e) => seen.push(`failed:${e.strategy}`));
    t.capture.on('opened', (e) => seen.push(`opened:${e.strategy}`));
    s = await t.capture.open({ mode: 'camera' });
    assert.strictEqual(s.getVideoTracks().length + s.getAudioTracks().length, 2);
    same(seen, ['failed:preferred', 'opened:separately']);

    // A refusal is the person's answer: no second way of asking.
    t = load({ gum: async () => { throw new FakeDOMException('denied', 'NotAllowedError'); } });
    await assert.rejects(t.capture.open({ mode: 'camera' }), (e) => e.name === 'NotAllowedError');
    assert.strictEqual(t.calls.length, 1, 'stopped after the refusal');

    // Several failures: the one that says most about what to do is the one reported.
    t = load({ gum: async (c, n) => { throw new FakeDOMException('x', n === 1 ? 'NotFoundError' : 'NotReadableError'); } });
    await assert.rejects(t.capture.open({ mode: 'camera' }), (e) => e.name === 'NotReadableError');

    // A strategy that never answers is timed out, and the next one runs.
    t = load({ gum: async (c, n) => (n === 1 ? new Promise(() => {}) : both(c)) });
    t.capture.use('timeoutMs', 30);
    s = await t.capture.open({ mode: 'camera' });
    assert.ok(s.getVideoTracks().length, 'opened after the timed-out strategy');

    // Asked for a camera and given none: not opened, and its tracks are stopped.
    const lone = new FakeTrack('audio');
    t = load({ gum: async () => new FakeStream([lone]) });
    await assert.rejects(t.capture.open({ mode: 'camera' }), (e) => e.name === 'NotFoundError');
    assert.ok(lone.stopped, 'the half-open stream was stopped');

    // ── Parts and strategies ──
    t = load({ gum: async (c) => both(c) });
    const before = t.capture.use('constraints', (o) => ({ ...before(o), audio: { echoCancellation: false } }));
    await t.capture.open({ mode: 'camera' });
    same(t.calls[0].audio, { echoCancellation: false });
    assert.throws(() => t.capture.part('nope'), /no capture part "nope"/);
    for (const p of ['constraints', 'getUserMedia', 'getDisplayMedia', 'enumerate', 'meter', 'network', 'still', 'recorder', 'mimeTypes', 'store', 'portable', 'explain', 'timeoutMs']) {
        assert.ok(t.capture.parts().includes(p), `the ${p} part can be replaced`);
    }
    t = load({ gum: async (c) => both(c) });
    same(t.capture.strategies.list().map((x) => x.name), ['preferred', 'separately', 'basic']);
    let ran = '';
    t.capture.strategies.add({ name: 'mine', open: async () => { ran = 'mine'; return both({ video: true, audio: true }); } }, { before: 'preferred' });
    same(t.capture.strategies.list().map((x) => x.name), ['mine', 'preferred', 'separately', 'basic']);
    await t.capture.open({ mode: 'camera' });
    assert.strictEqual(ran, 'mine');
    t.capture.strategies.remove('mine');
    t.capture.strategies.add({ name: 'last', open: async () => both({ video: true, audio: true }) }, { after: 'basic' });
    same(t.capture.strategies.list().map((x) => x.name), ['preferred', 'separately', 'basic', 'last']);
    t.capture.strategies.reset();
    same(t.capture.strategies.list().map((x) => x.name), ['preferred', 'separately', 'basic']);
    assert.throws(() => t.capture.strategies.add({ name: 'x' }), /a strategy is/);

    // ── The screen ──
    t = load({ gum: async (c) => both(c), display: async (c) => both({ video: true, audio: c.audio }) });
    s = await t.capture.screen({ frameRate: 15 });
    assert.strictEqual(s.getVideoTracks().length, 1);
    assert.strictEqual(t.calls[0].video.frameRate.ideal, 15);
    same(t.capture.can(), { camera: true, screen: true, record: true, secure: true });
    t = load({ gum: async (c) => both(c) });
    await assert.rejects(t.capture.screen(), (e) => e.name === 'NoApi');
    assert.strictEqual(t.capture.can().screen, false, 'a page can hide "share your screen" where it cannot work');

    // ── A photo, through the replaceable still part ──
    t = load({ gum: async (c) => both(c) });
    let asked = null;
    t.capture.use('still', async (stream, o) => { asked = o; return new FakeBlob(['jpg'], { type: o.type || 'image/jpeg' }); });
    const photo = await t.capture.photo(await t.capture.open({ mode: 'camera_only' }), { mirror: true });
    assert.strictEqual(photo.type, 'image/jpeg');
    assert.strictEqual(asked.mirror, true);
    // The real still part says so plainly when there is no picture to take.
    t = load({ gum: async (c) => both(c) });
    await assert.rejects(t.capture.photo(new FakeStream([new FakeTrack('audio')])), (e) => e.name === 'NotFoundError');

    // ── A recording: the first supported format, events, a stop that gives a Blob ──
    t = load({ gum: async (c) => both(c) });
    const got = [];
    t.capture.on('recorded', (e) => got.push(e.blob.type));
    const rec = t.capture.record(await t.capture.open({ mode: 'camera' }), { maxSeconds: 5 });
    assert.strictEqual(rec.mimeType, 'video/webm;codecs=vp9,opus', 'mp4 is not supported by the fake browser: the first webm is used');
    const clip = await rec.stop();
    assert.strictEqual(clip.type, 'video/webm');
    same(got, ['video/webm']);
    assert.strictEqual(await rec.stop(), clip, 'stop twice gives the same clip');
    // Cancelled: nothing comes back.
    const rec2 = t.capture.record(new FakeStream([new FakeTrack('audio')]));
    assert.strictEqual(rec2.mimeType, 'audio/webm;codecs=opus', 'an audio-only stream records audio');
    rec2.cancel();

    // ── Settings: this device, then the person ──
    t = load({ gum: async (c) => both(c) });
    let saved = null;
    t.capture.on('settings', (e) => { saved = e.settings; });
    t.capture.settings.save({ mirror: false, resolution: '1080', lens: 'cam-back-1' });
    assert.strictEqual(t.capture.settings.load().resolution, '1080');
    assert.strictEqual(saved.mirror, false);
    assert.ok(t.store.get('ov_capture_settings').includes('1080'), 'kept on this device');
    // A remote store (OpenVibe.Cam's camera settings, for example): its portable choices arrive; device ids stay here.
    const remote = { v: { mirror: true, resolution: '480', effects: 'warm', lens: 'someone-elses-camera' }, saves: [] };
    const synced = [];
    t.capture.on('synced', (e) => synced.push(e.settings));
    const unsync = t.capture.settings.sync({ load: async () => remote.v, save: async (v) => { remote.saves.push(v); } });
    await tick(); await tick();
    const now = t.capture.settings.load();
    assert.strictEqual(now.resolution, '480', 'the person\'s resolution followed them');
    assert.strictEqual(now.effects, 'warm');
    assert.strictEqual(now.lens, 'cam-back-1', 'a camera id from another device is never taken');
    assert.strictEqual(synced.length, 1);
    // A change here goes to the remote store, without device ids.
    t.capture.settings.save({ mirror: false });
    await tick();
    assert.strictEqual(remote.saves.length, 1);
    assert.strictEqual(remote.saves[0].mirror, false);
    assert.ok(!('lens' in remote.saves[0]) && !('mic' in remote.saves[0]), 'device ids never leave the device');
    // A device-only change is not sent.
    t.capture.settings.save({ mic: 'usb-mic' });
    await tick();
    assert.strictEqual(remote.saves.length, 1);
    // A remote that fails leaves this device working, and says so.
    unsync();
    let failed = null;
    t.capture.on('sync-failed', (e) => { failed = e.error; });
    t.capture.settings.sync({ load: async () => { throw new Error('offline'); }, save: async () => {} });
    await tick(); await tick();
    assert.ok(failed && /offline/.test(failed.message));
    assert.strictEqual(t.capture.settings.load().mic, 'usb-mic');
    assert.throws(() => t.capture.settings.sync({}), /settings\.sync takes/);
    // A replaced store is used.
    const mem = {};
    t.capture.use('store', { load: () => mem.v || {}, save: (v) => { mem.v = v; } });
    t.capture.settings.save({ lens: 'back-wide' });
    assert.strictEqual(mem.v.lens, 'back-wide');

    // ── Plain words ──
    t = load({ gum: async (c) => both(c) });
    assert.match(t.capture.explain({ name: 'NotAllowedError' }, 'camera').title, /said no to the camera and microphone/);
    const found = t.capture.explain({ name: 'NotFoundError' }, 'camera', { instead: 'Or go live with your screen instead.' });
    assert.strictEqual(found.steps[found.steps.length - 1], 'Or go live with your screen instead.', 'the site adds its own last step');
    assert.match(t.capture.explain({ name: 'NotAllowedError' }, 'screen').title, /Screen sharing was stopped/);
    assert.match(t.capture.explain({ name: 'NoApi' }, 'screen').steps[0], /Phones can't share their screen/);
    assert.ok(!/openvibe\.live/.test(JSON.stringify(t.capture.explain({ name: 'NoApi' }, 'camera'))), 'no site\'s name in the shared words');
    const mac = load({ gum: async (c) => both(c), ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', extra: {} });
    mac.ctx.navigator.maxTouchPoints = 0;
    assert.match(mac.capture.explain({ name: 'NotAllowedError' }, 'screen').steps.join(' '), /Screen Recording/);
    const inApp = load({ ua: 'Instagram 350 (iPhone)' });
    await assert.rejects(inApp.capture.open({}), (e) => e.name === 'NoApi');
    assert.match(inApp.capture.explain({ name: 'NoApi' }, 'camera').steps.join(' '), /inside another app/);

    // ── One copy wins: an older or equal copy loaded later changes nothing ──
    t = load({ gum: async (c) => both(c) });
    const first = t.ctx.OVCapture;
    vm.runInContext(source, t.ctx);
    assert.strictEqual(t.ctx.OVCapture, first, 'a second copy of the same version keeps the first');
    t.ctx.OVCapture = { version: 1 };
    vm.runInContext(source, t.ctx);
    assert.strictEqual(t.ctx.OVCapture.version, 2, 'a newer copy replaces an older one (Live\'s own, version 1)');

    console.log('capture-core: strategies, parts, screen, photo, recording, settings that follow the person, plain words, one copy wins');
})().catch((e) => { console.error(e); process.exit(1); });
