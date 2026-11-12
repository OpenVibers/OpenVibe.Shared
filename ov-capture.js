/*
 * ov-capture.js: OpenVibe's capture core, window.OVCapture. One way to open a camera, a microphone or a screen, take a
 * photo and record a clip, on every OpenVibe site: Live's go-live page, OpenVibe.Cam's recorder and <ov-camera>, and the
 * composer's camera button. Built from parts that can each be replaced, and served by each site from its own copy
 * (/shared/ov-capture.js), so a camera never waits on another site, a content policy or a cache.
 *
 * The owner, 2026-11-12: Live's capture must be "completely customize[able] … implemented in a highly over engineered
 * modular editable way", and then "OpenVibe.cam is actually fine … maybe we should be using that for live … Harmony".
 * Both hold: this file began as Live's own system (OpenVibe.Live #847) and is now the one Live and Cam share. From 11-09
 * to 11-12 nobody could go live because Live loaded Cam's kit from openvibe.cam and the browser refused it; a site's own
 * copy of this file cannot be refused that way.
 *
 * Using it:
 *   OVCapture.open({ mode, facing, lens, mic, resolution }) → a MediaStream. mode: 'camera' (both), 'camera_only',
 *                                                            'mic_only'. Runs the strategies in order, each with its
 *                                                            own time limit; the first that opens wins.
 *   OVCapture.screen({ audio, frameRate })                  → a MediaStream of a screen, a window or a tab.
 *   OVCapture.photo(stream, { type, quality, mirror })      → a Blob: the camera's picture now.
 *   OVCapture.record(stream, { maxSeconds, mimeType })      → { stop() → Promise<Blob>, cancel(), seconds(), mimeType }.
 *   OVCapture.devices()                                     → the browser's cameras and microphones.
 *   OVCapture.meter(stream, onLevel)                        → stop(): the microphone's level, 0 to 1, each frame.
 *   OVCapture.network()                                     → 'offline' | 'weak' | 'good' | '' (unknown).
 *   OVCapture.can()                                         → { camera, screen, record, secure }: what this browser
 *                                                            allows here, so a page can hide what it cannot do.
 *   OVCapture.stop(stream)
 *   OVCapture.explain(error, mode, { instead })             → { title, steps }: what happened and what to tap, for
 *                                                            this browser. `instead` adds a last step of the site's own
 *                                                            (Live: "go live with your screen instead").
 *   OVCapture.settings.load() / .save(partial)              → the person's choices: facing, lens, mic, resolution,
 *                                                            mirror, effects (the 'store' part; this browser first).
 *   OVCapture.settings.sync({ load, save })                 → unsync(): the choices that are the same on every device
 *                                                            (the 'portable' part: facing, resolution, mirror,
 *                                                            effects) follow the person through a remote store, such
 *                                                            as OpenVibe.Cam's camera settings. Camera and microphone
 *                                                            ids stay on the device that has them.
 *
 * Changing it:
 *   OVCapture.use(name, impl)   replaces a part and returns the one it replaced, so a wrapper can call through:
 *                               const before = OVCapture.use('constraints', (o) => ({ ...before(o), video: … }));
 *   OVCapture.part(name)        the part now in use. Parts: constraints, getUserMedia, getDisplayMedia, enumerate,
 *                               meter, network, still, recorder, mimeTypes, store, portable, explain, timeoutMs.
 *   OVCapture.strategies        the ways to open a camera, in order: .list(), .add(strategy, { before, after }),
 *                               .remove(name), .replace(name, strategy), .reset(). A strategy is
 *                               { name, note?, timeoutMs?, open(options, capture) }.
 *   OVCapture.on(event, fn)     'opening' { strategy, options } · 'opened' { strategy, stream } ·
 *                               'failed' { strategy, error } · 'gave-up' { error } · 'settings' { settings } ·
 *                               'synced' { settings } · 'sync-failed' { error } · 'recording' { seconds } ·
 *                               'recorded' { blob, seconds }. Returns off().
 * Every name and every default is in this file. It fetches nothing; a page that wants the person's settings to follow
 * them passes its own remote store to settings.sync().
 */
(function (root) {
    'use strict';
    const VERSION = 2;
    if (!root || (root.OVCapture && Number(root.OVCapture.version) >= VERSION)) return;
    const nav = () => root.navigator || {};
    const doc = () => root.document || null;

    // ── Parts: each one plain, each one replaceable with use(). ─────────────────────────────────────────────────────
    const parts = {
        /** What to ask the browser for, from the options (facing, lens, mic, resolution). */
        constraints(o = {}) {
            const height = Number(o.resolution) || 720;
            const video = o.video === false ? false : {
                facingMode: { ideal: o.facing || 'user' },
                ...(o.lens && o.lens !== 'main' && o.lens !== 'default' ? { deviceId: { ideal: o.lens } } : {}),
                width: { ideal: Math.round(height * 16 / 9) }, height: { ideal: height },
            };
            const audio = o.audio === false ? false : (o.mic && o.mic !== 'default' ? { deviceId: { ideal: o.mic } } : true);
            return { video, audio };
        },
        getUserMedia: (constraints) => nav().mediaDevices.getUserMedia(constraints),
        getDisplayMedia: (constraints) => nav().mediaDevices.getDisplayMedia(constraints),
        enumerate: () => nav().mediaDevices.enumerateDevices(),
        meter(stream, onLevel) {
            const AC = root.AudioContext || root.webkitAudioContext;
            if (!AC || !stream || !stream.getAudioTracks().length) return () => {};
            const ctx = new AC(), analyser = ctx.createAnalyser(), data = new Uint8Array(512);
            let frame = 0, closed = false;
            analyser.fftSize = 512;
            ctx.createMediaStreamSource(stream).connect(analyser);
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
                const d = doc();
                if (d) d.addEventListener('pointerdown', () => { ctx.resume().catch(() => {}); }, { once: true, capture: true });
            }
            const tick = () => {
                if (closed) return;
                analyser.getByteTimeDomainData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
                onLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
                frame = root.requestAnimationFrame(tick);
            };
            frame = root.requestAnimationFrame(tick);
            return () => { closed = true; root.cancelAnimationFrame(frame); ctx.close().catch(() => {}); };
        },
        network() {
            const n = nav();
            if (n.onLine === false) return 'offline';
            const c = n.connection || n.mozConnection || n.webkitConnection;
            if (!c || !(c.effectiveType || c.downlink)) return '';
            return /(^|-)(2g|3g)$/.test(c.effectiveType || '') || (c.downlink && c.downlink < 2.5) ? 'weak' : 'good';
        },
        /** The camera's picture now, as a Blob: the video track drawn once into a canvas. */
        async still(stream, o = {}) {
            const d = doc();
            const track = stream && stream.getVideoTracks()[0];
            if (!d || !track) throw Object.assign(new Error('No camera picture to take'), { name: 'NotFoundError' });
            const video = d.createElement('video');
            video.muted = true; video.playsInline = true; video.srcObject = new root.MediaStream([track]);
            await video.play().catch(() => {});
            if (!video.videoWidth) await new Promise((r) => { video.addEventListener('loadeddata', r, { once: true }); root.setTimeout(r, 1500); });
            const w = video.videoWidth || 1280, h = video.videoHeight || 720;
            const canvas = d.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const g = canvas.getContext('2d');
            if (o.mirror) { g.translate(w, 0); g.scale(-1, 1); }
            g.drawImage(video, 0, 0, w, h);
            video.srcObject = null;
            return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The picture could not be made'))), o.type || 'image/jpeg', o.quality || 0.92));
        },
        /** A MediaRecorder for the stream. */
        recorder: (stream, options) => new root.MediaRecorder(stream, options),
        /** The recording formats to try, best first; the first this browser supports is used. */
        mimeTypes: {
            video: ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'],
            audio: ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'],
        },
        /** Where the person's choices live on this device. Device ids are this browser's own, so this store is local. */
        store: {
            key: 'ov_capture_settings',
            load() { try { return JSON.parse(root.localStorage.getItem(this.key) || 'null') || {}; } catch { return {}; } },
            save(settings) { try { root.localStorage.setItem(this.key, JSON.stringify(settings)); } catch { /* private mode */ } },
        },
        /** The choices that mean the same on any device, so they may follow the person (settings.sync). */
        portable: ['facing', 'resolution', 'mirror', 'effects'],
        explain: null,   // set below (explainFailure): the plain words for a failure, by browser
        timeoutMs: 10000,
    };

    // ── Events ──────────────────────────────────────────────────────────────────────────────────────────────────
    const listeners = new Map();
    function on(event, fn) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(fn);
        return () => listeners.get(event).delete(fn);
    }
    function emit(event, detail) {
        (listeners.get(event) || []).forEach((fn) => { try { fn(detail); } catch (e) { console.warn('[capture] listener', event, e); } });
    }

    // ── Strategies: the ways to open a camera, tried in order. ──────────────────────────────────────────────────────
    const wants = (o) => ({ video: o.mode !== 'mic_only' && o.video !== false, audio: o.mode !== 'camera_only' && o.audio !== false });
    const merge = (...streams) => {
        const out = new root.MediaStream();
        streams.filter(Boolean).forEach((s) => s.getTracks().forEach((t) => out.addTrack(t)));
        return out;
    };
    const defaults = [
        {
            name: 'preferred',
            note: 'Camera and microphone together, as chosen (facing, lens, microphone, resolution).',
            open: (o, c) => c.part('getUserMedia')(c.part('constraints')({ ...o, ...wants(o) })),
        },
        {
            name: 'separately',
            note: 'The camera, then the microphone, each on its own (some Android phones refuse both at once).',
            async open(o, c) {
                const w = wants(o), gum = c.part('getUserMedia'), cons = c.part('constraints');
                let video = null, audio = null, last = null;
                if (w.video) { try { video = await gum({ video: cons(o).video, audio: false }); } catch (e) { last = e; } }
                if (w.audio) { try { audio = await gum({ video: false, audio: cons(o).audio }); } catch (e) { last = e; } }
                if (!video && !audio) throw last || new root.DOMException('No camera or microphone', 'NotFoundError');
                return merge(video, audio);
            },
        },
        {
            name: 'basic',
            note: 'Any camera and any microphone, nothing asked of them.',
            open: (o, c) => c.part('getUserMedia')(wants(o)),
        },
    ];
    let order = defaults.slice();
    const strategies = {
        list: () => order.map((s) => ({ name: s.name, note: s.note || '' })),
        add(strategy, at = {}) {
            if (!strategy || !strategy.name || typeof strategy.open !== 'function') throw new TypeError('a strategy is { name, open(options, capture) }');
            order = order.filter((s) => s.name !== strategy.name);
            const i = at.before ? order.findIndex((s) => s.name === at.before) : at.after ? order.findIndex((s) => s.name === at.after) + 1 : -1;
            if (i < 0 || i > order.length) order.push(strategy); else order.splice(i, 0, strategy);
        },
        remove(name) { order = order.filter((s) => s.name !== name); },
        replace(name, strategy) { order = order.map((s) => (s.name === name ? { ...strategy, name } : s)); },
        reset() { order = defaults.slice(); },
    };

    // A refusal says the most about what to do, so it wins over "not found" when several strategies failed differently.
    const WEIGHT = { NotAllowedError: 6, PermissionDeniedError: 6, SecurityError: 5, NotReadableError: 4, TrackStartError: 4, AbortError: 3, OverconstrainedError: 2, NotFoundError: 1, DevicesNotFoundError: 1, TimeoutError: 1 };
    const heavier = (a, b) => (!a ? b : (WEIGHT[b && b.name] || 0) > (WEIGHT[a.name] || 0) ? b : a);
    const refused = (e) => !!e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError' || e.name === 'SecurityError');
    function within(promise, ms, name) {
        let timer;
        return Promise.race([promise, new Promise((_, reject) => { timer = root.setTimeout(() => reject(new root.DOMException(`${name} took longer than ${ms} ms`, 'TimeoutError')), ms); })])
            .finally(() => root.clearTimeout(timer));
    }
    const noApi = (what) => Object.assign(new Error(`This browser has no ${what} here`), { name: 'NoApi' });

    async function open(options = {}) {
        const md = nav().mediaDevices;
        if (!md || !md.getUserMedia) throw noApi('camera');
        const o = { ...capture.settings.load(), ...options };
        let worst = null;
        for (const s of order) {
            emit('opening', { strategy: s.name, options: o });
            try {
                const stream = await within(Promise.resolve(s.open(o, capture)), Number(s.timeoutMs || parts.timeoutMs), s.name);
                const w = wants(o);
                // A strategy that opened less than was asked for has not opened it: say so and stop the tracks.
                if ((w.video && !stream.getVideoTracks().length) || (w.audio && !stream.getAudioTracks().length)) {
                    stream.getTracks().forEach((t) => t.stop());
                    throw new root.DOMException('The requested device was not available', 'NotFoundError');
                }
                emit('opened', { strategy: s.name, stream });
                return stream;
            } catch (error) {
                worst = heavier(worst, error);
                emit('failed', { strategy: s.name, error });
                // A refusal is the person's answer: asking again in another way would only ask again.
                if (refused(error)) break;
            }
        }
        emit('gave-up', { error: worst });
        throw worst || new Error('The camera did not open');
    }

    async function screen(options = {}) {
        const md = nav().mediaDevices;
        if (!md || !md.getDisplayMedia) throw noApi('screen sharing');
        const constraints = { video: { frameRate: { ideal: Number(options.frameRate) || 30 } }, audio: options.audio !== false };
        emit('opening', { strategy: 'screen', options });
        try {
            const stream = await parts.getDisplayMedia(constraints);
            emit('opened', { strategy: 'screen', stream });
            return stream;
        } catch (error) {
            emit('failed', { strategy: 'screen', error });
            emit('gave-up', { error });
            throw error;
        }
    }

    // ── Recording ─────────────────────────────────────────────────────────────────────────────────────────────
    function pickMime(kind, wanted) {
        const MR = root.MediaRecorder;
        const list = wanted ? [wanted] : (parts.mimeTypes[kind] || []);
        if (!MR || typeof MR.isTypeSupported !== 'function') return '';
        return list.find((t) => { try { return MR.isTypeSupported(t); } catch { return false; } }) || '';
    }
    function record(stream, o = {}) {
        if (!root.MediaRecorder) throw noApi('recorder');
        const kind = stream.getVideoTracks().length ? 'video' : 'audio';
        const mimeType = pickMime(kind, o.mimeType);
        const rec = parts.recorder(stream, mimeType ? { mimeType } : undefined);
        const chunks = [];
        const max = Math.max(1, Number(o.maxSeconds) || 60);
        const started = Date.now();
        let ticker = 0, limit = 0, done = null, cancelled = false;
        const seconds = () => Math.min(max, Math.round((Date.now() - started) / 100) / 10);
        const finished = new Promise((resolve, reject) => {
            rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
            rec.onerror = (e) => reject((e && e.error) || new Error('The recording failed'));
            rec.onstop = () => {
                root.clearInterval(ticker); root.clearTimeout(limit);
                if (cancelled) { resolve(null); return; }
                const blob = new root.Blob(chunks, { type: (mimeType || rec.mimeType || `${kind}/webm`).split(';')[0] });
                emit('recorded', { blob, seconds: seconds() });
                resolve(blob);
            };
        });
        rec.start(1000);
        ticker = root.setInterval(() => emit('recording', { seconds: seconds() }), 500);
        limit = root.setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, max * 1000);
        return {
            mimeType: mimeType || rec.mimeType || '',
            seconds,
            stop() { if (!done) { done = finished; if (rec.state !== 'inactive') rec.stop(); } return done; },
            cancel() { cancelled = true; if (rec.state !== 'inactive') rec.stop(); },
        };
    }

    // ── Plain words for a failure, by browser. ───────────────────────────────────────────────────────────────
    function explainFailure(err, mode, extra = {}) {
        const n = nav(), ua = n.userAgent || '';
        const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && n.maxTouchPoints > 1);
        const mac = /Macintosh/.test(ua) && !ios;
        const android = /Android/.test(ua);
        const firefox = /Firefox|FxiOS/.test(ua);
        const safari = /Safari/.test(ua) && !/Chrome|CriOS|Chromium|Edg|FxiOS/.test(ua);
        const inApp = /FBAN|FBAV|Instagram|Line\/|Twitter|Discord|TikTok|musical_ly|Snapchat|GSA\//.test(ua) || /; wv\)/.test(ua);
        const what = mode === 'mic_only' ? 'microphone' : mode === 'camera_only' ? 'camera' : mode === 'screen' ? 'screen' : 'camera and microphone';
        const both = mode === 'camera_only' ? '' : ' and Microphone';
        const name = err && err.name;
        const instead = extra && extra.instead ? [extra.instead] : [];
        if (name === 'NoApi' || (inApp && name !== 'NotReadableError')) {
            return { title: `This browser can't use your ${mode === 'screen' ? 'screen' : 'camera'} here`, steps: inApp
                ? ['You opened this inside another app (like Discord, Instagram or TikTok). Those can\'t share a camera.', `Tap the ⋮ or ⋯ menu and choose "Open in ${ios ? 'Safari' : 'Chrome'}" (or "Open in browser").`, 'Sign in there if asked, then try again.']
                : mode === 'screen' && (ios || android) ? ['Phones can\'t share their screen from a browser. Use a computer, or your camera instead.', ...instead]
                    : ['Open this page in Chrome, Safari, Edge or Firefox, then try again.', ...instead] };
        }
        if (mode === 'screen' && refused(err)) {
            return { title: 'Screen sharing was stopped', steps: mac
                ? ['Try again and pick a screen, a window or a tab.', 'Nothing to pick? Open System Settings → Privacy & Security → Screen Recording, turn on your browser, then reopen it.']
                : ['Try again and pick a screen, a window or a tab, then press Share.'] };
        }
        if (refused(err)) {
            const steps = ios && safari ? ['Tap "aA" (or the page icon) at the left of the address bar.', 'Tap Website Settings.', `Set Camera${both} to Allow.`]
                : ios ? ['Open the iPhone Settings app, find this browser, and turn on Camera and Microphone.', 'Come back here.']
                : android && !firefox ? ['Tap the icon at the left of the address bar (a lock or two sliders).', 'Tap Permissions (or Site settings).', `Set Camera${both} to Allow.`]
                : firefox ? ['Click the camera icon with a line through it, at the left of the address bar.', 'Remove "Blocked temporarily" (the ×).']
                : safari ? ['Open Safari\'s menu → Settings for this website.', `Set Camera${both} to Allow.`]
                : ['Click the camera icon at the right end of the address bar (or the lock at the left).', `Choose "Always allow" for the ${what}, then Done.`];
            return { title: `Your browser said no to the ${what}`, steps: [...steps, 'Then press Try again.'] };
        }
        if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
            return { title: 'Another app is using your camera', steps: ['Close apps that use the camera, like Zoom, FaceTime, WhatsApp, Instagram or the Camera app (and other tabs with a call).', 'Then press Try again.'] };
        }
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
            return { title: `No ${what} found`, steps: [mode === 'mic_only' ? 'Plug in a microphone or headset, then press Try again.' : 'Plug in a camera (or open its privacy cover), then press Try again.', ...instead] };
        }
        if (name === 'OverconstrainedError') {
            return { title: 'That camera can\'t start with these settings', steps: ['Press Try again: it starts with simpler settings.', 'Still stuck? Pick another camera in the camera settings.'] };
        }
        if (name === 'TimeoutError') {
            return { title: 'Your browser didn\'t answer', steps: ['Look for the browser\'s question at the top of the screen and tap Allow.', 'Nothing there? Press Try again.'] };
        }
        return { title: `The ${mode === 'screen' ? 'screen sharing' : 'camera'} didn't start`, steps: ['Press Try again.', 'Still stuck? Reload this page, or try Chrome or Safari.'] };
    }
    parts.explain = explainFailure;

    // ── Settings: this device first; the portable ones may follow the person. ──────────────────────────────────────
    const DEFAULTS = { facing: 'user', lens: 'main', mic: 'default', resolution: '720', mirror: true, effects: 'none' };
    const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && o[k] !== undefined).map((k) => [k, o[k]]));
    let remote = null;
    const settings = {
        load: () => ({ ...DEFAULTS, ...parts.store.load() }),
        save(partial) {
            const next = { ...settings.load(), ...(partial || {}) };
            parts.store.save(next);
            emit('settings', { settings: next });
            const r = remote;
            const portable = pick(partial || {}, parts.portable);
            if (r && Object.keys(portable).length) {
                Promise.resolve().then(() => r.save(pick(next, parts.portable))).catch((error) => emit('sync-failed', { error }));
            }
            return next;
        },
        /** Follow the person: take the remote store's portable choices now, and send each later change to it. */
        sync(store) {
            if (!store || typeof store.load !== 'function' || typeof store.save !== 'function') throw new TypeError('settings.sync takes { load(), save(settings) }');
            remote = store;
            const mine = store;
            Promise.resolve().then(() => store.load()).then((theirs) => {
                if (remote !== mine || !theirs || typeof theirs !== 'object') return;
                const next = { ...settings.load(), ...pick(theirs, parts.portable) };
                parts.store.save(next);
                emit('settings', { settings: next });
                emit('synced', { settings: next });
            }).catch((error) => emit('sync-failed', { error }));
            return () => { if (remote === mine) remote = null; };
        },
    };

    // ── The API ─────────────────────────────────────────────────────────────────────────────────────────────────
    const capture = {
        version: VERSION,
        part(name) {
            if (!(name in parts)) throw new RangeError(`no capture part "${name}"; the parts are ${Object.keys(parts).join(', ')}`);
            return parts[name];
        },
        use(name, impl) {
            const before = capture.part(name);
            parts[name] = impl;
            return before;
        },
        parts: () => Object.keys(parts),
        strategies,
        on,
        open,
        screen,
        photo: (stream, o = {}) => parts.still(stream, { mirror: false, ...o }),
        record,
        devices: () => parts.enumerate(),
        meter: (stream, onLevel) => parts.meter(stream, onLevel),
        network: () => parts.network(),
        can() {
            const md = nav().mediaDevices || {};
            return { camera: typeof md.getUserMedia === 'function', screen: typeof md.getDisplayMedia === 'function', record: typeof root.MediaRecorder === 'function', secure: root.isSecureContext !== false };
        },
        stop: (stream) => { try { stream && stream.getTracks().forEach((t) => t.stop()); } catch { /* already stopped */ } },
        explain: (error, mode, extra) => parts.explain(error, mode, extra),
        settings,
    };
    root.OVCapture = capture;
    if (typeof module === 'object' && module && module.exports) module.exports = capture;
})(typeof window !== 'undefined' ? window : globalThis);
