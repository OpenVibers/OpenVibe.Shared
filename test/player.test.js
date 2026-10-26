'use strict';
// player.js (+ player.css): the network's one video look. Runs the real script in a linkedom document with a <video>
// whose media behaviour is faked (play/pause, time, duration, volume, events), and checks it the way a viewer uses it.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parseHTML } = require('linkedom');

const src = fs.readFileSync(path.join(__dirname, '..', 'player.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'player.css'), 'utf8');

const { window, document } = parseHTML(`<!doctype html><html><body>
  <div class="wrap"><video id="v" data-ov-player controls preload="metadata" src="/v.mp4"><track kind="captions" src="/c.vtt"></video></div>
  <video id="plain" controls src="/x.mp4"></video>
</body></html>`);

// The media model linkedom does not have.
const video = document.getElementById('v');
let paused = true;
const media = { currentTime: 0, duration: NaN, volume: 1, muted: false, playbackRate: 1, ended: false };
const fire = (type) => video.dispatchEvent(new window.Event(type));
Object.defineProperties(video, {
    paused: { get: () => paused },
    ended: { get: () => media.ended },
    currentTime: { get: () => media.currentTime, set: (v) => { media.currentTime = v; fire('timeupdate'); } },
    duration: { get: () => media.duration },
    volume: { get: () => media.volume, set: (v) => { media.volume = v; fire('volumechange'); } },
    muted: { get: () => media.muted, set: (v) => { media.muted = v; fire('volumechange'); } },
    playbackRate: { get: () => media.playbackRate, set: (v) => { media.playbackRate = v; fire('ratechange'); } },
    buffered: { get: () => ({ length: 1, start: () => 0, end: () => 30 }) },
    textTracks: { value: Object.assign([{ kind: 'captions', mode: 'hidden' }], { addEventListener() {} }) },
});
video.play = () => { paused = false; fire('play'); fire('playing'); return Promise.resolve(); };
video.pause = () => { paused = true; fire('pause'); };

const store = {};
const ctx = {
    window, document, console, Promise, setTimeout, clearTimeout, Date, Math, Number, String, JSON, Object, Array,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
};
ctx.window.OpenVibePlayer = undefined;
vm.createContext(ctx);
vm.runInContext(src, ctx);
const P = window.OpenVibePlayer;
assert.ok(P && typeof P.enhance === 'function', 'OpenVibePlayer.enhance');

// Enhanced on load: wrapped, the browser's controls off, the network's on; a plain <video> is left alone.
const root = video.parentNode;
assert.ok(root.classList.contains('ov-player'), 'wrapped in .ov-player');
assert.strictEqual(root.parentNode.className, 'wrap', 'in the page where the video was');
assert.strictEqual(video.hasAttribute('controls'), false, "the browser's controls are off");
assert.strictEqual(document.getElementById('plain').hasAttribute('controls'), true, 'only video[data-ov-player]');
assert.strictEqual(P.enhance(video), video.__ovPlayer, 'enhance() is idempotent');
assert.strictEqual(root.querySelectorAll('.ov-player-bar').length, 1);
const $ = (sel) => root.querySelector(sel);
assert.ok($('.ov-player-big') && root.classList.contains('is-start'), 'a large play button before the first play');

// Time: "0:00", then "m:ss / m:ss" once the duration is known, with the scrubber's value for assistive tech.
media.duration = 754; fire('durationchange');
media.currentTime = 65; fire('timeupdate');
assert.strictEqual($('.ov-player-time').textContent, '1:05 / 12:34');
assert.strictEqual($('.ov-player-scrub').getAttribute('aria-valuetext'), '1:05 of 12:34');
assert.match($('.ov-player-played').style.width, /^8\.6\d*%$/);
fire('progress');
assert.match($('.ov-player-buffered').style.width, /^3\.9\d*%$/, 'buffered to 30 s of 754');
assert.strictEqual(P.format(3725), '1:02:05');

// Play and pause from the button, the big button and the keyboard.
$('.ov-player-big').dispatchEvent(new window.Event('click'));
assert.strictEqual(paused, false);
assert.ok(!root.classList.contains('is-start') && !root.classList.contains('is-paused'));
assert.strictEqual($('.ov-player-play').getAttribute('aria-label'), 'Pause (k)');
const key = (k, target = root) => { const e = new window.Event('keydown', { bubbles: true }); e.key = k; target.dispatchEvent(e); return e; };
key('k');
assert.strictEqual(paused, true, 'k pauses');
key('l'); assert.strictEqual(media.currentTime, 75, 'l: +10 s');
key('j'); key('j'); assert.strictEqual(media.currentTime, 55, 'j: -10 s');
key('ArrowRight'); assert.strictEqual(media.currentTime, 60, '→: +5 s');
key('5'); assert.strictEqual(media.currentTime, 377, '5: half way');
key('ArrowDown'); assert.ok(Math.abs(media.volume - 0.95) < 1e-9, '↓: quieter');
key('m'); assert.strictEqual(media.muted, true, 'm mutes');
assert.match($('.ov-player-mute').getAttribute('aria-label'), /^Unmute/);
assert.deepStrictEqual(JSON.parse(store['ov-player-volume']), { volume: 0.95, muted: true }, 'volume remembered');

// Captions, speed.
key('c');
assert.strictEqual(video.textTracks[0].mode, 'showing');
assert.ok($('.ov-player-cc').classList.contains('is-on'));
$('.ov-player-speed').dispatchEvent(new window.Event('click'));
assert.strictEqual(media.playbackRate, 1.25);
assert.strictEqual($('.ov-player-speed').textContent, '1.25×');

// Ended: a replay button.
media.ended = true; paused = true; fire('ended');
assert.ok(root.classList.contains('is-ended'));
assert.strictEqual($('.ov-player-big').getAttribute('aria-label'), 'Replay');

// A video added later is enhanced on request.
const later = document.createElement('video');
later.setAttribute('data-ov-player', '');
later.setAttribute('controls', '');
document.body.appendChild(later);
P.enhanceAll(document);
assert.ok(later.parentNode.classList.contains('ov-player'));

// The stylesheet: the theme's accent, the idle state, and the large button only before play or at the end.
assert.match(css, /--ovp-accent: var\(--accent, #3b82f6\);/);
assert.match(css, /\.ov-player\.is-idle \.ov-player-bar, \.ov-player\.is-idle \.ov-player-bar > \* \{ opacity: 0; pointer-events: none; \}/);
assert.match(css, /\.ov-player-bar \{[^}]*pointer-events: none;/, 'the gradient never blocks the big button or the picture');
assert.match(css, /\.ov-player-big \{[^}]*z-index: 4;/);
assert.match(css, /\.ov-player:not\(\.is-start\):not\(\.is-ended\) \.ov-player-big \{ opacity: 0; pointer-events: none; \}/);

// Served beside the other browser files.
const files = require('../files');
assert.ok(files.isBrowserFile('player.js') && files.isBrowserFile('player.css') && files.BROWSER.includes('player.js') && files.STYLES.includes('player.css'));
console.log('player: all checks passed');

// ── 4.13: sound, loading layers, feedback (owner, 2026-10-25) ──
{
    const { window: w2, document: d2 } = parseHTML(`<!doctype html><html><body><div class="host"><video id="a" data-ov-player data-ov-color="#123456" data-ov-thumb="data:image/webp;base64,AAAA" data-ov-ambient poster="/p.jpg" autoplay muted src="/a.mp4"></video></div></body></html>`);
    const v = d2.getElementById('a');
    let p2 = true;
    const m2 = { currentTime: 0, duration: 120, volume: 0.8, muted: true, playbackRate: 1, ended: false, readyState: 0 };
    const f2 = (type) => v.dispatchEvent(new w2.Event(type));
    Object.defineProperties(v, {
        paused: { get: () => p2 }, ended: { get: () => m2.ended }, readyState: { get: () => m2.readyState },
        currentTime: { get: () => m2.currentTime, set: (x) => { m2.currentTime = x; f2('timeupdate'); } },
        duration: { get: () => m2.duration },
        volume: { get: () => m2.volume, set: (x) => { m2.volume = x; f2('volumechange'); } },
        muted: { get: () => m2.muted, set: (x) => { m2.muted = x; f2('volumechange'); } },
        playbackRate: { get: () => m2.playbackRate, set: (x) => { m2.playbackRate = x; f2('ratechange'); } },
        buffered: { get: () => ({ length: 0 }) },
        textTracks: { value: Object.assign([], { addEventListener() {} }) },
        autoplay: { get: () => true },
    });
    v.play = () => { p2 = false; f2('play'); f2('playing'); return Promise.resolve(); };
    v.pause = () => { p2 = true; f2('pause'); };
    const st2 = {};
    const c2 = { window: w2, document: d2, console, Promise, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, Number, String, JSON, Object, Array,
        localStorage: { getItem: (k) => (k in st2 ? st2[k] : null), setItem: (k, x) => { st2[k] = String(x); } } };
    w2.OpenVibePlayer = undefined;
    vm.createContext(c2);
    vm.runInContext(src, c2);
    const r2 = v.parentNode;
    const q = (sel) => r2.querySelector(sel);
    assert.strictEqual(r2.style.getPropertyValue('--ovp-bg'), '#123456', 'the average colour paints at once');
    assert.ok(q('.ov-player-placeholder').style.backgroundImage.includes('data:image/webp'), 'the tiny preview, blurred under the poster');
    assert.ok(r2.classList.contains('has-thumb') && !r2.classList.contains('has-frame'), 'no frame yet');
    m2.readyState = 2; f2('loadeddata');
    assert.ok(r2.classList.contains('has-frame'), 'the first frame fades in');
    // Autoplaying muted: "Tap for sound", and the pill unmutes at the remembered level.
    v.play();
    assert.strictEqual(q('.ov-player-unmute').hidden, false, '"Tap for sound" while playing muted');
    q('.ov-player-unmute').dispatchEvent(new w2.Event('click'));
    assert.strictEqual(m2.muted, false, 'one tap: sound on');
    assert.strictEqual(q('.ov-player-unmute').hidden, true);
    assert.ok(q('.ov-player-flash').className.includes('is-on'), 'the level shows briefly');
    // A media volume key anywhere on the page drives the player last played.
    m2.muted = true;
    const kd = new w2.Event('keydown', { bubbles: true }); kd.key = 'AudioVolumeUp'; d2.body.dispatchEvent(kd);
    assert.strictEqual(m2.muted, false, 'volume up unmutes a muted video');
    const kd2 = new w2.Event('keydown', { bubbles: true }); kd2.key = 'AudioVolumeDown'; d2.body.dispatchEvent(kd2);
    assert.ok(Math.abs(m2.volume - 0.7) < 1e-9, 'volume down lowers it');
    // Skips say what they did, on their side.
    v.__ovPlayer.skip(10);
    assert.ok(q('.ov-player-flash').className.includes('is-right') && q('.ov-player-flash').textContent.includes('+10 s'));
}
// ── 4.14: volume on phones, and a video with no sound (owner, 2026-10-26: "Volume seems broken … on mobile can't hear
// this and also can't easily adjust volume"; VOD 5986 had no sound track) ──
function player(html, { volumeFixed = false, decoded = null } = {}) {
    const { window: w, document: d } = parseHTML(`<!doctype html><html><body><div class="host">${html}</div></body></html>`);
    const v = d.querySelector('video');
    let p = true;
    const m = { currentTime: 0, duration: 300, volume: 1, muted: false, playbackRate: 1, ended: false, readyState: 4 };
    const f = (type) => v.dispatchEvent(new w.Event(type));
    Object.defineProperties(v, {
        paused: { get: () => p }, ended: { get: () => m.ended }, readyState: { get: () => m.readyState },
        currentTime: { get: () => m.currentTime, set: (x) => { m.currentTime = x; f('timeupdate'); } },
        duration: { get: () => m.duration },
        // An iPhone's Safari ignores a page setting the volume: it stays 1.
        volume: { get: () => m.volume, set: (x) => { if (!volumeFixed) m.volume = x; f('volumechange'); } },
        muted: { get: () => m.muted, set: (x) => { m.muted = x; f('volumechange'); } },
        playbackRate: { get: () => m.playbackRate, set: (x) => { m.playbackRate = x; f('ratechange'); } },
        buffered: { get: () => ({ length: 0 }) },
        textTracks: { value: Object.assign([], { addEventListener() {} }) },
        ...(decoded ? { webkitAudioDecodedByteCount: { get: () => decoded.audio }, webkitVideoDecodedByteCount: { get: () => decoded.video } } : {}),
    });
    v.play = () => { p = false; f('play'); f('playing'); return Promise.resolve(); };
    v.pause = () => { p = true; f('pause'); };
    const c = { window: w, document: d, console, Promise, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, Number, String, JSON, Object, Array,
        localStorage: { getItem: () => null, setItem() {} } };
    w.OpenVibePlayer = undefined;
    vm.createContext(c);
    vm.runInContext(src, c);
    return { v, m, f, w, root: v.parentNode, q: (sel) => v.parentNode.querySelector(sel) };
}
{
    // The page can set the volume (desktop, Android): the slider is offered on touch screens too. An iPhone: mute only.
    assert.ok(root.classList.contains('can-volume'), 'a settable volume marks .can-volume');
    const ios = player('<video data-ov-player src="/a.mp4"></video>', { volumeFixed: true });
    assert.ok(!ios.root.classList.contains('can-volume'), 'an iPhone keeps its own volume buttons');
    assert.strictEqual(ios.m.volume, 1, 'the check leaves the volume as it was');

    // No sound track: after 2 s of decoded video and no audio decoded, the player says so.
    const decoded = { audio: 0, video: 0 };
    const quiet = player('<video data-ov-player src="/a.mp4"></video>', { decoded });
    quiet.v.play();
    decoded.video = 50000; quiet.m.currentTime = 1; quiet.f('timeupdate');
    assert.ok(!quiet.root.classList.contains('is-silent'), 'not judged before 2 s of playback');
    quiet.m.currentTime = 2.5; quiet.f('timeupdate');
    assert.ok(quiet.root.classList.contains('is-silent'), 'no audio decoded: is-silent');
    assert.strictEqual(quiet.q('.ov-player-mute').getAttribute('aria-label'), 'No sound in this video');
    assert.ok(quiet.q('.ov-player-flash').textContent.includes('No sound in this video'), 'and says so once');
    assert.strictEqual(quiet.q('.ov-player-unmute').hidden, true, 'no "Tap for sound" on a silent video');
    quiet.q('.ov-player-mute').dispatchEvent(new quiet.w.Event('click'));
    assert.strictEqual(quiet.m.muted, false, 'its speaker explains instead of muting');
    // A new source asks again.
    quiet.f('emptied');
    assert.ok(!quiet.root.classList.contains('is-silent'));

    // Sound decoded (muted or not): never called silent; a seek restarts the 2 s.
    const loud = { audio: 0, video: 0 };
    const withSound = player('<video data-ov-player muted src="/a.mp4"></video>', { decoded: loud });
    withSound.v.play();
    withSound.m.currentTime = 120; withSound.f('seeked');
    loud.video = 40000; withSound.m.currentTime = 121; withSound.f('timeupdate');
    assert.ok(!withSound.root.classList.contains('is-silent'), 'a seek restarts the count');
    loud.audio = 9000; withSound.m.currentTime = 123; withSound.f('timeupdate');
    assert.ok(!withSound.root.classList.contains('is-silent'), 'audio decoded while muted: it has sound');
}
// The styles, and a mute icon from the one rounded set.
assert.match(css, /\.ov-player-unmute \{/);
assert.match(css, /@media \(hover: none\) \{\s*\.ov-player-volume-slider \{ display: none; \}\s*\.ov-player\.can-volume \.ov-player-volume-slider \{ display: block; width: 84px; height: 36px;/, 'on touch screens the slider shows, finger-sized, where the volume can be set');
assert.match(css, /\.ov-player\.is-silent \.ov-player-volume-slider \{ display: none; \}/);
assert.match(css, /\.ov-player\.has-frame \.ov-player-video/);
assert.match(src, /Material Icons Round/);
console.log('player: all checks passed (4.13 sound, layers, feedback; 4.14 volume on phones, no-sound videos)');
