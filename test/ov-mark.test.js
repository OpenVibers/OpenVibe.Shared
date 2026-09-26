'use strict';
// ov-mark.js motion budget: the mark moves for its intro, on hover/focus and while it shows activity,
// and is paused (CSS paused where it is, SMIL clock stopped) when the page is hidden, when it is
// off-screen, under reduced motion and with data-static. Browser check (OpenVibe.Host): the endless
// mark kept idle pages 12-29% busy. linkedom with a fake clock, IntersectionObserver and matchMedia.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'ov-mark.js'), 'utf8');

function memoryStorage() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}

function setup({ reduce = false, session = memoryStorage(), start = 1000000, html = '<a href="/" class="brand"><span class="ov-mark" data-size="28"></span></a><span class="ov-mark" id="foot" data-static="1"></span>' } = {}) {
    const { window, document, MutationObserver, Event } = parseHTML(`<!doctype html><html><head></head><body>${html}</body></html>`);
    let now = start, timers = [];
    const clock = {
        now: () => now,
        advance(ms) {
            now += ms;
            for (;;) {
                const due = timers.filter((t) => t.at <= now).sort((a, b) => a.at - b.at)[0];
                if (!due) break;
                timers = timers.filter((t) => t !== due); due.fn();
            }
        },
    };
    const FakeDate = { now: () => now };
    const setT = (fn, ms) => { const t = { fn, at: now + ms }; timers.push(t); return t; };
    const clearT = (t) => { timers = timers.filter((x) => x !== t); };
    const observers = [];
    class IO {
        constructor(cb) { this.cb = cb; this.targets = new Set(); observers.push(this); }
        observe(el) { this.targets.add(el); }
        unobserve(el) { this.targets.delete(el); }
        fire(el, isIntersecting) { this.cb([{ target: el, isIntersecting }]); }
    }
    const mq = { matches: reduce, listeners: [], addEventListener(_t, fn) { this.listeners.push(fn); } };
    window.matchMedia = () => mq;
    window.__ovMark = false; // linkedom windows share their expando properties
    let hidden = false;
    Object.defineProperty(document, 'hidden', { get: () => hidden, configurable: true });
    const smil = new Map(); // svg → { paused, t }
    const probe = document.createElement('div'); probe.innerHTML = '<svg></svg>';
    const proto = Object.getPrototypeOf(probe.firstChild);
    proto.pauseAnimations = function () { const s = smil.get(this) || { t: 0 }; s.paused = true; smil.set(this, s); };
    proto.unpauseAnimations = function () { const s = smil.get(this) || { t: 0 }; s.paused = false; smil.set(this, s); };
    proto.getCurrentTime = function () { return (smil.get(this) || { t: 0 }).t; };
    proto.setCurrentTime = function (t) { const s = smil.get(this) || {}; s.t = t; smil.set(this, s); };
    const run = new Function('window', 'document', 'IntersectionObserver', 'MutationObserver', 'setTimeout', 'clearTimeout', 'Date', 'sessionStorage', SRC);
    run(window, document, IO, MutationObserver, setT, clearT, FakeDate, session);
    const io = observers[0];
    const mark = document.querySelector('.brand .ov-mark');
    return {
        window, document, Event, clock, io, mq, mark,
        running: (el = mark) => el.hasAttribute('data-ovm-run'),
        smilPaused: (el = mark) => (smil.get(el.querySelector('svg')) || {}).paused,
        smilTime: (el = mark) => (smil.get(el.querySelector('svg')) || {}).t,
        setHidden(v) { hidden = v; document.dispatchEvent(new Event('visibilitychange')); },
        flush: () => new Promise((r) => setImmediate(r)),
    };
}

(async () => {
    // ── the CSS pauses a mounted mark's endless animations unless it is running ─────
    {
        const t = setup();
        const css = t.document.getElementById('ov-mark-css').textContent;
        assert.match(css, /\.ov-mark\[data-ov\]:not\(\[data-ovm-run\]\) svg,[^{]*\.ov-mark\[data-ov\]:not\(\[data-ovm-run\]\) \.c,[^{]*\{animation-play-state:paused!important\}/, 'paused rule');
        assert.ok(t.mark.querySelector('svg'), 'mounted');
        assert.ok(t.io.targets.has(t.mark), 'observed for visibility');
        // Not yet known to be on screen: still, SMIL parked on the centred V sweep.
        assert.strictEqual(t.running(), false);
        assert.strictEqual(t.smilPaused(), true);
        assert.strictEqual(t.smilTime(), 1.6);
    }

    // ── intro: runs once on screen, stops by itself after about 8 s ─────────────────
    {
        const t = setup();
        t.io.fire(t.mark, true);
        assert.strictEqual(t.running(), true, 'intro runs');
        assert.strictEqual(t.smilPaused(), false);
        t.clock.advance(7000);
        assert.strictEqual(t.running(), true, 'still in the intro');
        t.clock.advance(1100);
        assert.strictEqual(t.running(), false, 'intro over: paused');
        assert.strictEqual(t.smilPaused(), true);
        // Scrolling away and back does not replay the intro.
        t.io.fire(t.mark, false); t.io.fire(t.mark, true);
        assert.strictEqual(t.running(), false, 'no second intro');
    }

    // ── one intro per visit: the next page of a multi-page site finishes it, never restarts it ─
    {
        const session = memoryStorage();
        const first = setup({ session });
        first.io.fire(first.mark, true);
        assert.strictEqual(first.running(), true);
        const second = setup({ session, start: 1000000 + 3000 }); // a click 3 s into the intro
        second.io.fire(second.mark, true);
        assert.strictEqual(second.running(), true, 'the intro carries on');
        second.clock.advance(5100);
        assert.strictEqual(second.running(), false, 'and ends 8 s after the visit began');
        const third = setup({ session, start: 1000000 + 20000 });
        third.io.fire(third.mark, true);
        assert.strictEqual(third.running(), false, 'a later page opens with the mark at rest');
        assert.strictEqual(third.smilPaused(), true);
        third.mark.closest('a').dispatchEvent(new third.Event('pointerenter'));
        assert.strictEqual(third.running(), true, 'and still answers hover');
    }

    // ── hover and focus on the mark's link run it, with a short linger ─────────────
    {
        const t = setup();
        t.io.fire(t.mark, true); t.clock.advance(9000);
        const link = t.mark.closest('a');
        link.dispatchEvent(new t.Event('pointerenter'));
        assert.strictEqual(t.running(), true, 'hover runs');
        t.clock.advance(60000);
        assert.strictEqual(t.running(), true, 'while hovered');
        link.dispatchEvent(new t.Event('pointerleave'));
        assert.strictEqual(t.running(), true, 'lingers');
        t.clock.advance(1300);
        assert.strictEqual(t.running(), false, 'stops after the linger');
        link.dispatchEvent(new t.Event('focusin'));
        assert.strictEqual(t.running(), true, 'focus runs');
        link.dispatchEvent(new t.Event('focusout')); t.clock.advance(1300);
        assert.strictEqual(t.running(), false);
    }

    // ── a hidden page or an off-screen mark never runs, even in the intro or hovered ─
    {
        const t = setup();
        t.io.fire(t.mark, true);
        t.setHidden(true);
        assert.strictEqual(t.running(), false, 'hidden page pauses the intro');
        assert.strictEqual(t.smilPaused(), true);
        t.setHidden(false);
        assert.strictEqual(t.running(), true, 'visible again inside the intro');
        t.io.fire(t.mark, false);
        assert.strictEqual(t.running(), false, 'off-screen pauses');
        t.mark.closest('a').dispatchEvent(new t.Event('pointerenter'));
        assert.strictEqual(t.running(), false, 'off-screen even when hovered');
    }

    // ── activity (island.js data-state) runs it after the intro ─────────────────────
    {
        const t = setup();
        t.io.fire(t.mark, true); t.clock.advance(9000);
        t.mark.setAttribute('data-state', 'busy'); await t.flush();
        assert.strictEqual(t.running(), true, 'busy runs');
        t.mark.removeAttribute('data-state'); await t.flush();
        assert.strictEqual(t.running(), false, 'idle again');
    }

    // ── reduced motion (the OS setting or the network's own) and data-static: never ──
    {
        const t = setup({ reduce: true });
        t.io.fire(t.mark, true);
        t.mark.closest('a').dispatchEvent(new t.Event('pointerenter'));
        assert.strictEqual(t.running(), false, 'prefers-reduced-motion');
        assert.strictEqual(t.smilPaused(), true, 'SMIL stopped too (the V sweep used to run under reduced motion)');

        const u = setup();
        u.io.fire(u.mark, true);
        u.document.documentElement.setAttribute('data-ov-motion', 'reduced'); await u.flush();
        assert.strictEqual(u.running(), false, 'html[data-ov-motion=reduced]');
        u.document.documentElement.removeAttribute('data-ov-motion'); await u.flush();
        assert.strictEqual(u.running(), true, 'back inside the intro');

        const foot = u.document.getElementById('foot');
        u.io.fire(foot, true);
        assert.strictEqual(u.running(foot), false, 'data-static');
        assert.strictEqual(u.smilPaused(foot), true);
        u.mq.matches = true; u.mq.listeners.forEach((fn) => fn());
        assert.strictEqual(u.running(), false, 'reduced-motion change applies at once');
    }

    // ── a removed mark is let go; one added later mounts and gets its own intro ──────
    {
        const t = setup();
        t.io.fire(t.mark, true);
        t.mark.closest('a').remove(); await t.flush();
        assert.ok(!t.io.targets.has(t.mark), 'unobserved');
        assert.strictEqual(t.running(), false, 'a detached mark does not keep a running flag');
        const span = t.document.createElement('span'); span.className = 'ov-mark';
        t.document.body.appendChild(span); await t.flush();
        assert.ok(span.querySelector('svg') && t.io.targets.has(span), 'new mark mounted and observed');
        t.io.fire(span, true);
        assert.strictEqual(t.running(span), true, 'its own intro');
    }

    console.log('ov-mark: intro, hover/focus, activity; paused when hidden, off-screen, reduced or static');
})().catch((e) => { console.error(e); process.exit(1); });
