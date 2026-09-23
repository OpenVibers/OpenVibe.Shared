/*
 * openvibe-shared/release-watch.js — keeps open tabs on a supported release (ADR-016).
 *
 * The page's release comes from <meta name="ov-release" content="<sha>" data-url="/release.json">
 * (openvibe-shared/release metaTag()) or, without it, from /release.json when the script loads. On focus, when the tab becomes visible, when the network
 * comes back and every 10 minutes, this reads /release.json:
 *   - same release: nothing;
 *   - newer release: one quiet "new version" toast with a Reload button, never an automatic reload;
 *   - the server requires it (min_client_release is the running release) or the new release is older
 *     than the mixed-version window: reload automatically, but ONLY when it is safe — the tab is
 *     hidden or idle for 2 minutes, no text field has focus, and nothing on the page is protected
 *     (a form marked data-dirty="true", an element with data-ov-protected, or window.OVProtected()
 *     returning true for uploads, calls, broadcasts and recordings).
 */
(function (root) {
    if (typeof document === 'undefined' || root.OVRelease) return;
    // The page's release: from <meta name="ov-release"> when the server rendered one, otherwise the
    // release /release.json reports when this script first runs (a site without the route stops).
    const meta = document.querySelector('meta[name="ov-release"]');
    let current = meta && meta.content ? meta.content : null;
    const url = (meta && meta.getAttribute('data-url')) || '/release.json';
    const IDLE_MS = 2 * 60 * 1000;
    const MIN_GAP_MS = 60 * 1000;
    let lastCheck = 0;
    let lastInput = Date.now();
    let prompted = false;
    let mustReload = false;
    let latest = null;

    ['keydown', 'pointerdown', 'input', 'wheel', 'touchstart'].forEach((t) => root.addEventListener(t, () => { lastInput = Date.now(); }, { passive: true, capture: true }));

    function busy() {
        const a = document.activeElement;
        if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName || ''))) return true;
        if (document.querySelector('form[data-dirty="true"], [data-ov-protected]')) return true;
        try { if (typeof root.OVProtected === 'function' && root.OVProtected()) return true; } catch { return true; }
        return !document.hidden && Date.now() - lastInput < IDLE_MS;
    }

    function prompt() {
        if (prompted) return;
        prompted = true;
        const text = 'A new version of this page is available.';
        const reload = () => root.location.reload();
        if (root.OpenVibeUI && typeof root.OpenVibeUI.toast === 'function') {
            root.OpenVibeUI.toast(text, { type: 'info', title: 'Update ready', ttl: 0, action: { label: 'Reload', onClick: reload } });
        }
    }

    function maybeReload() {
        if (mustReload && !busy()) root.location.reload();
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
        latest = m;
        if (!current) { current = m.release; root.OVRelease.current = current; return m; }
        if (m.release === current) return m;
        const age = now - Date.parse(m.released_at);
        const windowMs = (Number(m.mixed_version_window_hours) || 0) * 3600 * 1000;
        mustReload = m.min_client_release === m.release || (windowMs > 0 && age > windowMs);
        prompt();
        maybeReload();
        return m;
    }

    let stopped = false;
    root.addEventListener('focus', () => { if (!stopped) check(false); });
    root.addEventListener('online', () => { if (!stopped) check(true); });
    document.addEventListener('visibilitychange', () => { if (stopped) return; if (document.hidden) maybeReload(); else check(false); });
    const tick = root.setInterval(() => { if (!stopped) { check(false); maybeReload(); } }, 30 * 1000);
    const poll = root.setInterval(() => { if (!stopped) check(true); }, 10 * 60 * 1000);
    function stop() { stopped = true; root.clearInterval(tick); root.clearInterval(poll); }
    root.OVRelease = { current, check: () => check(true), state: () => ({ current, latest, mustReload }), stop };
    // No server-rendered release: learn it now; a site that serves no /release.json is left alone.
    if (!current) {
        root.fetch(url, { cache: 'no-store', credentials: 'omit' })
            .then((r) => (r.ok ? r.json() : null))
            .then((m) => { if (m && typeof m.release === 'string') { current = m.release; root.OVRelease.current = current; latest = m; lastCheck = Date.now(); } else stop(); })
            .catch(stop);
    }
})(typeof window !== 'undefined' ? window : globalThis);
