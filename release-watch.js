/*
 * openvibe-shared/release-watch.js — keeps open tabs on a supported release (ADR-016, Track R).
 * Reads /release.json on focus, visibility, reconnect and every 10 min. Changes with components or contract
 * ranges are planned by release-update.js (loaded on demand from this directory): style, content and server
 * go in place, anything else prompts. It reloads by itself only when it must (min_client_release or
 * min_client_generation, the mixed-version window, contracts) and only when safe: hidden or idle 2 min, no
 * focused field, nothing protected (form[data-dirty="true"], [data-ov-protected], playing media, a live
 * camera/mic, OVProtected()). Outcomes and a 5-minute beat go to the metrics URL (D46).
 * Release notifications (WS-P task 9): one anonymous EventSource on Events' realtime stream
 * (host.release.published); a new release of this service runs check(true) after a 0-20 s jitter, at
 * most every 30 s. Polling stays the fallback.
 * OVReleaseConfig: { url, metricsUrl, updateUrl, inPlace: false, service, eventsUrl (false: off) }; the meta
 * tag may carry data-service, data-events and data-generation. See README "Releases".
 */
(function (root) {
    if (typeof document === 'undefined' || root.OVRelease) return;
    const cfg = root.OVReleaseConfig || {};
    const self = (document.currentScript && document.currentScript.src) || '';
    const SELF_RE = /release-watch\.js(?:[?#].*)?$/;
    const updateUrl = cfg.updateUrl || `${SELF_RE.test(self) ? self.replace(SELF_RE, '') : '/shared/'}release-update.js`;
    const meta = document.querySelector('meta[name="ov-release"]');
    let current = (meta && meta.content) || null;
    const gen = meta && meta.hasAttribute('data-generation') ? +meta.getAttribute('data-generation') : undefined;
    const url = cfg.url || (meta && meta.getAttribute('data-url')) || '/release.json';
    const IDLE_MS = 2 * 60 * 1000;
    const MIN_GAP_MS = 60 * 1000;
    let base = null;        // the manifest of the release this page runs
    let latest = null;
    let lastCheck = 0;
    let lastInput = Date.now();
    let prompted = false;
    let mustReload = false; let reloadWhy = null;
    let busyWith = null;    // the plan/apply in flight
    let pending = null; let waiting = []; let kinds = ''; let failedRelease = null; let lib = null;
    let counts = {}; const totals = {}; const noted = {};
    let session = null; let lastBeat = 0;
    try { session = Array.from(root.crypto.getRandomValues(new Uint8Array(8)), (b) => (b | 256).toString(16).slice(1)).join(''); } catch { /* no beats */ }

    ['keydown', 'pointerdown', 'input', 'wheel', 'touchstart'].forEach((t) => root.addEventListener(t, () => { lastInput = Date.now(); }, { passive: true, capture: true }));

    // ── Update metrics (D46): counted here, sent on hide, after an update and before a reload ──
    function record(outcome, reason, once) {
        const k = `${latest && latest.release}|${outcome}|${reason}`;
        if (once) { if (noted[k]) return; noted[k] = 1; }
        for (const o of [counts, totals]) { const r = o[outcome] || (o[outcome] = {}); r[reason] = (r[reason] || 0) + 1; }
    }
    // beat: send even with nothing counted; ended: the tab is going
    function flush(beat, ended) {
        const to = cfg.metricsUrl || (meta && meta.getAttribute('data-metrics')) || (latest && latest.metrics_url);
        const any = Object.keys(counts).length > 0;
        if (!to || (!any && !(beat === true && session && current))) return;
        try {
            if (new URL(to, root.location.href).origin !== new URL(root.location.href).origin) return;
            const report = { service: latest && latest.service, release: current, to: latest && latest.release };
            if (any) report.counts = counts;
            if (session) { report.session = session; lastBeat = Date.now(); if (ended === true) report.ended = true; }
            const body = JSON.stringify(report);
            counts = {};
            const n = root.navigator;
            if (!(n && n.sendBeacon && n.sendBeacon(to, body))) root.fetch(to, { method: 'POST', body, keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
        } catch { /* best effort */ }
    }

    /** Why acting now is not safe, or null. With `scope`, only what is inside that element counts. */
    function busy(scope) {
        const d = scope || document;
        const a = document.activeElement;
        const typing = a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName || ''));
        if (scope ? a && a !== document.body && scope.contains(a) : typing) return typing ? 'typing' : 'active';
        if (d.querySelector('form[data-dirty="true"]') || (scope && scope.matches('form[data-dirty="true"]'))) return 'dirty';
        if (d.querySelector('[data-ov-protected]') || (scope && scope.hasAttribute('data-ov-protected'))) return 'protected';
        // Someone watching or broadcasting: a playing <video>/<audio>, or a live camera/mic stream.
        try {
            for (const m of d.querySelectorAll('video, audio')) {
                if (!m.paused && !m.ended) return 'media';
                const so = m.srcObject;
                if (so && typeof so.getTracks === 'function' && so.getTracks().some((t) => t.readyState === 'live')) return 'capture';
            }
        } catch { return 'media'; }
        if (scope) return null;
        try { if (typeof root.OVProtected === 'function' && root.OVProtected()) return 'protected'; } catch { return 'protected'; }
        return !document.hidden && Date.now() - lastInput < IDLE_MS ? 'active' : null;
    }

    function reload(why) { record('reloaded', why); flush(); root.location.reload(); }
    function prompt() {
        if (prompted) return;
        prompted = true;
        record('prompted', mustReload ? reloadWhy : 'optional');
        if (root.OpenVibeUI && typeof root.OpenVibeUI.toast === 'function') {
            root.OpenVibeUI.toast('A new version of this page is available.', { type: 'info', title: 'Update ready', ttl: 0, action: { label: 'Reload', onClick: () => reload('user') } });
        }
    }
    function maybeReload() {
        if (!mustReload) return;
        const why = busy();
        if (why) record('deferred', why, true); else reload(reloadWhy);
    }
    function emit(name, release) { try { root.dispatchEvent(new root.CustomEvent(name, { detail: { release } })); } catch { /* */ } }

    function loadUpdate() {
        if (root.OVReleaseUpdate) return Promise.resolve(root.OVReleaseUpdate);
        return lib || (lib = new Promise((ok, no) => {
            const sc = document.createElement('script');
            sc.src = updateUrl; sc.async = true;
            sc.onload = () => (root.OVReleaseUpdate ? ok(root.OVReleaseUpdate) : no('script'));
            sc.onerror = () => { lib = null; no('script'); };
            document.head.appendChild(sc);
        }));
    }
    /** Without release-update.js: the release id, min_client_release and the window only. */
    function legacy(m, pg) {
        const w = (Number(m.mixed_version_window_hours) || 0) * 3600e3;
        if (m.min_client_release === m.release || pg < m.min_client_generation) return { action: 'reload', reason: 'required' };
        return w > 0 && Date.now() - Date.parse(m.released_at) > w ? { action: 'reload', reason: 'window' } : { action: 'prompt' };
    }
    function commitRegions(next) {
        if (waiting.length) waiting = root.OVReleaseUpdate.commit(waiting, next, busy, record);
        return !waiting.length;
    }
    function adopt(next) {
        base = next; current = next.release; pending = null; mustReload = false;
        record('applied', kinds || 'server');
        flush();
        emit('ov:release-applied', next.release);
    }

    async function decide(m) {
        let x = null;
        if (m.components || m.contract_ranges) { try { x = await loadUpdate(); } catch { record('failed', 'script'); flush(); } }
        const page = base || { release: current, client_generation: gen };
        let p = x ? x.plan(page, m, Date.now()) : legacy(m, page.client_generation);
        if (p.action === 'in-place' && (cfg.inPlace === false || failedRelease === m.release)) p = x.plan({ release: current, contract_ranges: page.contract_ranges }, m, Date.now());
        if (p.action === 'none') return;
        if (p.action !== 'in-place') {
            if (p.action === 'reload') { mustReload = true; reloadWhy = p.reason; }
            prompt();
            maybeReload();
            return;
        }
        try {
            kinds = Array.from(new Set(p.changed.map((c) => c.kind))).sort().join('+');
            waiting = await x.apply(p, m, busy, record); pending = m;
            if (!waiting.length) adopt(m);
        } catch (why) {
            waiting = []; pending = null;
            record('failed', typeof why === 'string' ? why : 'content');
            failedRelease = m.release;
            flush();
            await decide(m);
        }
    }
    function consider(m) {
        latest = m;
        if (m.release === current || busyWith || (pending && pending.release === m.release)) return;
        waiting = []; pending = null;   // a newer release supersedes regions still waiting for the last one
        busyWith = decide(m).catch(() => {}).then(() => { busyWith = null; });
    }

    async function check(force) {
        const now = Date.now();
        if (!force && now - lastCheck < MIN_GAP_MS) return latest;
        lastCheck = now;
        let m;
        try {
            const r = await root.fetch(url, { cache: 'no-store', credentials: 'omit' });
            if (!r.ok) return latest;
            m = await r.json();
        } catch { return latest; }
        if (!m || typeof m.release !== 'string') return latest;
        if (!current) current = m.release;
        if (!base && m.release === current) base = m;
        consider(m);
        live();
        if (busyWith) await busyWith;
        return m;
    }

    // ── Release notifications (host.release.published, public, via OpenVibe.Events) ──
    // One credential-less EventSource per tab (account switches change nothing). Closed after 5 min hidden,
    // reopened with last_event_id; errors back off 30 s to 15 min; after 6 failures only polling is left.
    const TOPIC = 'host.release.published';
    const HEX = /^[0-9a-f]{7,40}$/;
    const rt = { state: 'off', service: null, url: null, events: 0, ignored: 0, checks: 0, failures: 0, lastSeq: null };
    let es = null; let queued = null; let again = false; let seen = [];
    const t = {};   // timers: run (the jittered check), cool (30 s after it), retry, hide
    const later = (k, f, ms) => { root.clearTimeout(t[k]); t[k] = root.setTimeout(() => { t[k] = null; f(); }, ms); };
    const same = (a, b) => !!a && !!b && (a === b || (HEX.test(a) && HEX.test(b) && (a.startsWith(b) || b.startsWith(a))));
    function eventsUrl() {
        const v = 'eventsUrl' in cfg ? cfg.eventsUrl : meta && meta.hasAttribute('data-events') ? meta.getAttribute('data-events') : undefined;
        if (v !== undefined) return v && v !== 'off' ? String(v) : null;
        try { return new URL(root.location.href).protocol === 'https:' ? 'https://events.openvibe.network/realtime/stream' : null; } catch { return null; }
    }
    function live() {
        if (stopped || es || rt.state !== 'off' || typeof root.EventSource !== 'function') return;
        const svc = cfg.service || (meta && meta.getAttribute('data-service')) || (base && base.service) || (latest && latest.service);
        const at = eventsUrl();
        if (!at || !/^[a-z][a-z0-9-]{1,39}$/.test(String(svc || ''))) return;
        rt.service = svc; rt.url = at;
        open();
        if (document.hidden) later('hide', hide, 5 * 60 * 1000);
    }
    function open() {
        let u;
        try { u = new URL(rt.url, root.location.href); u.searchParams.set('topics', TOPIC); if (rt.lastSeq != null) u.searchParams.set('last_event_id', rt.lastSeq); } catch { rt.state = 'failed'; return; }
        rt.state = 'connecting';
        let s;
        try { s = es = new root.EventSource(u.href); } catch { es = null; fail(); return; }
        s.onopen = () => { if (es === s) { rt.state = 'open'; rt.failures = 0; } };
        s.onmessage = (e) => { if (es === s) heard(e); };
        s.onerror = () => { if (es === s) fail(); };
        s.addEventListener('gap', () => { if (es === s) queue(); });   // events were missed: check anyway
    }
    function close() { const s = es; es = null; if (s) try { s.close(); } catch { /* */ } }
    function fail() {
        close();
        if (rt.state === 'blocked') return;
        if (++rt.failures >= 6) { rt.state = 'failed'; return; }
        rt.state = 'backoff';
        later('retry', () => { if (document.hidden) rt.state = 'hidden'; else open(); }, Math.min(9e5, 3e4 * 2 ** (rt.failures - 1)) * (0.5 + Math.random() / 2));
    }
    function hide() { if (document.hidden && es) { close(); rt.state = 'hidden'; } }
    // A Content-Security-Policy whose connect-src leaves Events out: one refusal, then polling only.
    document.addEventListener('securitypolicyviolation', (e) => {
        try { if (!rt.url || String(e.blockedURI || '').indexOf(new URL(rt.url, root.location.href).origin) !== 0) return; } catch { return; }
        close(); root.clearTimeout(t.retry); t.retry = null; rt.state = 'blocked';
    });
    function heard(e) {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        const ev = m && m.event; const p = ev && ev.payload;
        if (!p || ev.event_type !== TOPIC) return;
        if (typeof m.seq === 'number') { if (rt.lastSeq != null && m.seq <= rt.lastSeq) return; rt.lastSeq = m.seq; }
        if (p.service !== rt.service || typeof p.release !== 'string') return;
        // Ids repeat across origins (Sites' placeholders): a named origin must be ours.
        if (p.origin) { try { if (new URL(p.origin).origin !== root.location.origin) { rt.ignored++; return; } } catch { return; } }
        rt.events++;
        if (seen.includes(ev.event_id) || same(p.release, current) || same(p.release, latest && latest.release) || same(p.release, queued)) { rt.ignored++; return; }
        seen = seen.concat(ev.event_id).slice(-20);
        queued = p.release;
        queue();
    }
    /** One check after a 0-20 s jitter; what arrives meanwhile or 30 s after collapses into one more. */
    function queue() {
        if (t.run) return;
        if (t.cool) { again = true; return; }
        later('run', () => {
            const q = queued;
            rt.checks++;
            later('cool', () => { if (again) { again = false; queue(); } }, 30 * 1000);
            if (!stopped) check(true).then(() => { if (queued === q) queued = null; });
        }, Math.floor(Math.random() * 20 * 1000));
    }

    let stopped = false;
    root.addEventListener('focus', () => { if (!stopped) check(false); });
    root.addEventListener('online', () => { if (stopped) return; if (rt.state === 'failed') { rt.state = 'off'; rt.failures = 0; live(); } check(true); });
    root.addEventListener('pagehide', () => flush(true, true));
    document.addEventListener('visibilitychange', () => {
        if (stopped) return;
        if (document.hidden) { flush(); maybeReload(); if (es) later('hide', hide, 5 * 60 * 1000); return; }
        root.clearTimeout(t.hide); t.hide = null;
        if (rt.state === 'hidden') open();
        check(false);
    });
    const tick = root.setInterval(() => {
        if (stopped) return;
        if (pending && commitRegions(pending)) adopt(pending);
        check(false); maybeReload();
        if (Date.now() - lastBeat >= 3e5) flush(true);
    }, 30 * 1000);
    const poll = root.setInterval(() => { if (!stopped) check(true); }, 10 * 60 * 1000);
    function stop() {
        stopped = true; root.clearInterval(tick); root.clearInterval(poll);
        close(); Object.keys(t).forEach((k) => { root.clearTimeout(t[k]); t[k] = null; }); rt.state = 'off';
    }
    root.OVRelease = {
        get current() { return current; },
        check: () => check(true),
        state: () => ({ current, latest, mustReload, waiting: waiting.length, metrics: totals, realtime: { ...rt } }),
        flush,
        stop,
    };
    // The page's own manifest (if still served). No /release.json and no meta tag: left alone.
    lastCheck = Date.now();
    root.fetch(url, { cache: 'no-store', credentials: 'omit' })
        .then((r) => (r.ok ? r.json() : null))
        .then((m) => {
            if (!m || typeof m.release !== 'string') { if (!current) stop(); return; }
            if (!current) current = m.release;
            if (m.release === current) base = m;
            consider(m);
            live();
            flush(true);
        })
        .catch(() => { if (!current) stop(); });
})(typeof window !== 'undefined' ? window : globalThis);
