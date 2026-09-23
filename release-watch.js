/*
 * openvibe-shared/release-watch.js — keeps open tabs on a supported release (ADR-016, Track R).
 * Reads /release.json on focus, visibility, reconnect and every 10 minutes. A new release with components
 * or contract ranges is planned by release-update.js (loaded then, from this directory): style, content and
 * server changes are applied in place; anything else prompts. It reloads by itself only when it must
 * (min_client_release, the mixed-version window, contracts out of range) and only when safe: hidden or idle
 * 2 minutes, no focused field, nothing protected (form[data-dirty="true"], [data-ov-protected], playing
 * media, a live camera/mic, window.OVProtected()). Outcomes are beaconed to the metrics URL (D46).
 * OVReleaseConfig: { url, metricsUrl, updateUrl, inPlace: false }. See README "Releases".
 */
(function (root) {
    if (typeof document === 'undefined' || root.OVRelease) return;
    const cfg = root.OVReleaseConfig || {};
    const self = (document.currentScript && document.currentScript.src) || '';
    const SELF_RE = /release-watch\.js(?:[?#].*)?$/;
    const updateUrl = cfg.updateUrl || `${SELF_RE.test(self) ? self.replace(SELF_RE, '') : '/shared/'}release-update.js`;
    const meta = document.querySelector('meta[name="ov-release"]');
    let current = (meta && meta.content) || null;
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

    ['keydown', 'pointerdown', 'input', 'wheel', 'touchstart'].forEach((t) => root.addEventListener(t, () => { lastInput = Date.now(); }, { passive: true, capture: true }));

    // ── Update metrics (D46): counted here, sent on hide, after an update and before a reload ──
    function record(outcome, reason, once) {
        const k = `${latest && latest.release}|${outcome}|${reason}`;
        if (once) { if (noted[k]) return; noted[k] = 1; }
        for (const o of [counts, totals]) { const r = o[outcome] || (o[outcome] = {}); r[reason] = (r[reason] || 0) + 1; }
    }
    function flush() {
        const to = cfg.metricsUrl || (meta && meta.getAttribute('data-metrics')) || (latest && latest.metrics_url);
        if (!to || !Object.keys(counts).length) return;
        try {
            if (new URL(to, root.location.href).origin !== new URL(root.location.href).origin) return;
            const body = JSON.stringify({ service: latest && latest.service, release: current, to: latest && latest.release, counts });
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
    function legacy(m) {
        const w = (Number(m.mixed_version_window_hours) || 0) * 3600e3;
        if (m.min_client_release === m.release) return { action: 'reload', reason: 'required' };
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
        const page = base || { release: current };
        let p = x ? x.plan(page, m, Date.now()) : legacy(m);
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
        if (busyWith) await busyWith;
        return m;
    }

    let stopped = false;
    root.addEventListener('focus', () => { if (!stopped) check(false); });
    root.addEventListener('online', () => { if (!stopped) check(true); });
    root.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (stopped) return; if (document.hidden) { flush(); maybeReload(); } else check(false); });
    const tick = root.setInterval(() => {
        if (stopped) return;
        if (pending && commitRegions(pending)) adopt(pending);
        check(false); maybeReload();
    }, 30 * 1000);
    const poll = root.setInterval(() => { if (!stopped) check(true); }, 10 * 60 * 1000);
    function stop() { stopped = true; root.clearInterval(tick); root.clearInterval(poll); }
    root.OVRelease = {
        get current() { return current; },
        check: () => check(true),
        state: () => ({ current, latest, mustReload, waiting: waiting.length, metrics: totals }),
        flush,
        stop,
    };
    // The page's own manifest, if /release.json still serves the release the page was rendered from. A site
    // that serves no /release.json and rendered no meta tag is left alone.
    lastCheck = Date.now();
    root.fetch(url, { cache: 'no-store', credentials: 'omit' })
        .then((r) => (r.ok ? r.json() : null))
        .then((m) => {
            if (!m || typeof m.release !== 'string') { if (!current) stop(); return; }
            if (!current) current = m.release;
            if (m.release === current) base = m;
            consider(m);
        })
        .catch(() => { if (!current) stop(); });
})(typeof window !== 'undefined' ? window : globalThis);
