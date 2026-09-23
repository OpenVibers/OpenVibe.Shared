/*
 * openvibe-shared/release-watch.js — keeps open tabs on a supported release (ADR-016).
 *
 * The page declares what it runs: <meta name="ov-release" content="<sha>" data-url="/release.json">
 * (openvibe-shared/release metaTag()). On focus, when the tab becomes visible, when the network
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
    const meta = document.querySelector('meta[name="ov-release"]');
    if (!meta || !meta.content) return;
    const current = meta.content;
    const url = meta.getAttribute('data-url') || '/release.json';
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
        if (m.release === current) return m;
        const age = now - Date.parse(m.released_at);
        const windowMs = (Number(m.mixed_version_window_hours) || 0) * 3600 * 1000;
        mustReload = m.min_client_release === m.release || (windowMs > 0 && age > windowMs);
        prompt();
        maybeReload();
        return m;
    }

    root.addEventListener('focus', () => check(false));
    root.addEventListener('online', () => check(true));
    document.addEventListener('visibilitychange', () => { if (document.hidden) maybeReload(); else check(false); });
    const tick = root.setInterval(() => { check(false); maybeReload(); }, 30 * 1000);
    const poll = root.setInterval(() => check(true), 10 * 60 * 1000);
    root.OVRelease = { current, check: () => check(true), state: () => ({ current, latest, mustReload }), stop: () => { root.clearInterval(tick); root.clearInterval(poll); } };
})(typeof window !== 'undefined' ? window : globalThis);
