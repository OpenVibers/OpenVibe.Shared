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
// The styles, and a mute icon from the one rounded set.
assert.match(css, /\.ov-player-unmute \{/);
assert.match(css, /@media \(hover: none\) \{ \.ov-player-volume-slider \{ display: none; \} \}/, 'no hidden slider on touch screens');
assert.match(css, /\.ov-player\.has-frame \.ov-player-video/);
assert.match(src, /Material Icons Round/);
console.log('player: all checks passed (4.13 sound, layers, feedback)');
