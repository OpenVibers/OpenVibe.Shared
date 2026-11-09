/* OpenVibe — the one worker every site runs (the owner, 2026-11-09: "how come when you change sites it doesn't load more
 * asynchronously and dynamically, so it's faster across sites? … better caching on the client, cross-site and smarter, while
 * staying SEO friendly and crawlable?").
 *
 * Served by every OpenVibe site at /openvibe-sw.js (same origin, scope "/"), from openvibe-shared. Two jobs in one file:
 *
 *   1. Web Push (the job it always had): the network sends a notification, the worker shows it.
 *   2. The shell's cache: the shared files every page loads (the navbar, the theme loader, the footer, the kit CSS, the brand
 *      face, the glyphs) are kept by their content hash and served from the cache without asking the network again; a page
 *      is always fetched from the network first, and the copy in the cache is only there for when the network does not answer.
 *
 * The rules that keep it honest:
 *
 *   - Hashed assets (a ?v=<hash> or a hash in the name — what serve.url() hands out) are immutable: cache first, forever.
 *     Their bytes cannot change under the same URL, so the cache is right to keep them.
 *   - A page is never served from the cache while the network answers. The network is asked first (3 s), so a crawler and a
 *     person both read the same HTML the server just wrote. Only when the network does not answer does the cached copy show.
 *   - Nothing private is ever stored: a response with Set-Cookie, with Cache-Control: private or no-store, or with a Vary on
 *     Cookie or Authorization is passed straight through and never written to the cache.
 *   - The API is never touched. /api/ and anything that is not a plain GET goes to the network untouched.
 *   - The kill switch: GET <kill switch> says { "enabled": false } and every worker on every site unregisters itself and drops
 *     its caches. A worker that cannot reach the switch keeps working (a network hiccup must not take the cache away).
 *   - A new VERSION is a new cache: the old one is deleted when the new worker takes over, so a release never serves stale
 *     shell bytes.
 *
 * The site that wants this says so: OpenVibeNavbar.init({ sw: true }). A site can also point the worker elsewhere
 * ({ sw: { path: '/my-sw.js' } }) or leave it alone.
 */
'use strict';

const VERSION = '4.164.0';                                  // the release this worker ships in: a bump replaces the caches
const CACHE_PREFIX = 'ov-shell-';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const KILL_SWITCH = 'https://openvibe.network/api/v1/sw-config';
const PAGE_TIMEOUT_MS = 3000;                               // a page waits this long for the network before the cached copy shows
const STATIC_TYPES = ['javascript', 'ecmascript', 'css', 'woff2', 'woff', 'ttf', 'otf', 'svg+xml', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico'];

const self_ = typeof self !== 'undefined' ? self : globalThis;

/** The shared files every OpenVibe page loads. The site's own manifest (below) replaces this list when it has one. */
const SHELL = [
    '/shared/navbar.js',
    '/shared/theme-loader.js',
    '/shared/web-runtime.js',
    '/shared/footer.js',
    '/shared/nav-icons.js',
    '/shared/kit.css',
    '/shared/kit-layout.css',
    '/shared/ov-brand.woff2',
    '/shared/ov-glyphs.woff2',
    '/shared/ov-glyphs.svg',
];

// The switch may be pointed elsewhere by the registration URL: /openvibe-sw.js?cfg=https://…
const params = new URL(self_.location.href).searchParams;
const KILL_URL = params.get('cfg') || KILL_SWITCH;

// ── The cache's own rules ────────────────────────────────────────────────────────────────────────────────────────────────

/** A URL is content-addressed when it carries ?v=<hash> or a hash in the file name: its bytes cannot change. */
function isHashed(url) {
    if (/[?&]v=[0-9a-f]{8,64}\b/.test(url.pathname + url.search)) return true;
    return /[.\-_][0-9a-f]{8,64}(?=[.\-_/]|$)/.test(url.pathname);
}

/** True when the response may be written to the cache: public, not private, no cookie, no Vary on the reader. */
function cacheable(res) {
    if (!res || !res.ok || res.type === 'opaque' || res.type === 'opaqueredirect') return false;
    const cc = String(res.headers.get('cache-control') || '');
    if (/\bprivate\b/i.test(cc) || /\bno-store\b/i.test(cc)) return false;
    if (res.headers.get('set-cookie')) return false;
    const vary = String(res.headers.get('vary') || '').toLowerCase();
    if (/(^|,|\s)\s*(cookie|authorization)\s*(,|$)/.test(vary)) return false;
    return true;
}

/** True when the response is a page (a document the browser renders), not a file. */
function isPage(res) {
    const type = String(res.headers.get('content-type') || '');
    return type.indexOf('text/html') >= 0;
}

/** True when the response is a file the shell keeps (a script, a stylesheet, a font, an image). */
function staticType(res) {
    const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const sub = type.indexOf('/') >= 0 ? type.slice(type.indexOf('/') + 1) : type;
    return STATIC_TYPES.indexOf(sub) >= 0;
}

// ── The strategies ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Hashed assets: the cache first, the network only when the cache does not have it. */
async function cacheFirst(req, cache) {
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (cacheable(res) && staticType(res)) await cache.put(req, res.clone());
    return res;
}

/** The other files: the cached copy now, the fresh one in the background. */
async function staleWhileRevalidate(req, cache, event) {
    const hit = await cache.match(req);
    const fresh = fetch(req).then(async (res) => {
        if (cacheable(res) && staticType(res)) await cache.put(req, res.clone());
        return res;
    }).catch(() => null);
    if (hit) { event.waitUntil(fresh); return hit; }
    const res = await fresh;
    return res || new Response('', { status: 504, statusText: 'Offline' });
}

/**
 * A page: the network first, so a crawler and a person read the HTML the server just wrote. The cached copy is only the
 * answer when the network does not answer within PAGE_TIMEOUT_MS.
 */
async function networkFirst(req, cache) {
    const controller = new AbortController();
    const timer = setTimeout(() => { try { controller.abort(); } catch { /* */ } }, PAGE_TIMEOUT_MS);
    let res = null;
    try {
        // 'no-cache': the page is revalidated with the server every time, so a person and a crawler read the HTML the
        // server just wrote. The browser's own cache still keeps the bytes it validated.
        res = await fetch(req, { signal: controller.signal, cache: 'no-cache' });
    } catch { /* the network did not answer */ } finally { clearTimeout(timer); }
    if (res) {
        if (cacheable(res) && isPage(res)) { try { await cache.put(req, res.clone()); } catch { /* the cache is full or gone */ } }
        return res;
    }
    const hit = await cache.match(req);
    if (hit) return hit;
    return new Response('<!doctype html><meta charset="utf-8"><title>Offline</title><p style="font:16px system-ui;padding:2rem">This page is not available offline yet.</p>', {
        status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
}

// ── The shell's own files ────────────────────────────────────────────────────────────────────────────────────────────────

/** The site's manifest of the shell it serves, by content hash: the site's own answer, when it has one. */
async function shellUrls() {
    try {
        const res = await fetch('/ov-sw-manifest.json', { cache: 'no-store' });
        if (!res.ok) return SHELL;
        const body = await res.json();
        const list = Array.isArray(body && body.shell) ? body.shell.filter((u) => typeof u === 'string' && u.startsWith('/')) : [];
        return list.length ? list : SHELL;
    } catch { return SHELL; }
}

/** Put the shell in the cache so the next page does not wait for it. One file that fails never stops the rest. */
async function warmShell(cache) {
    const urls = await shellUrls();
    await Promise.all(urls.map(async (url) => {
        try {
            const res = await fetch(new Request(url, { cache: 'reload' }));
            if (cacheable(res) && staticType(res)) await cache.put(url, res);
        } catch { /* that file is not on this site */ }
    }));
}

// ── The kill switch ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ask the network whether the worker may keep working. No answer means yes: a hiccup must not take the cache away. */
async function checkKillSwitch() {
    try {
        const res = await fetch(KILL_URL, { cache: 'no-store' });
        if (!res.ok) return false;
        const cfg = await res.json();
        if (!cfg || cfg.enabled !== false) return false;
    } catch { return false; }
    try {
        await self_.registration.unregister();
        for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX)) await caches.delete(name);
    } catch { /* nothing more to do */ }
    return true;
}

// ── The worker's life ───────────────────────────────────────────────────────────────────────────────────────────────────

self_.addEventListener('install', () => self_.skipWaiting());

self_.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        await self_.clients.claim();
        for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
        await checkKillSwitch();
        try { await warmShell(await caches.open(CACHE_NAME)); } catch { /* the shell warms on its next visit */ }
    })());
});

self_.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;                                     // never touches a write
    if (req.headers.get('range')) return;                                 // a partial request is the browser's business
    let url;
    try { url = new URL(req.url); } catch { return; }
    if (url.origin !== self_.location.origin) return;                     // another site's bytes are another site's cache
    if (url.pathname.startsWith('/api/')) return;                         // the API is never cached
    if (url.pathname === '/ov-sw.js' || url.pathname === '/openvibe-sw.js') return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        // A page: the network first, the cached copy only when the network does not answer.
        if (req.destination === 'document' || req.mode === 'navigate'
            || String(req.headers.get('accept') || '').indexOf('text/html') >= 0) {
            return networkFirst(req, cache);
        }
        // A content-addressed file: the cache first, for good.
        if (isHashed(url)) return cacheFirst(req, cache);
        return staleWhileRevalidate(req, cache, event);
    })());
});

self_.addEventListener('message', (event) => {
    const data = (event.data && typeof event.data === 'object') ? event.data : {};
    if (data.type === 'skipWaiting') self_.skipWaiting();
    if (data.type === 'checkKill') event.waitUntil(checkKillSwitch());
    if (data.type === 'clearCaches') event.waitUntil((async () => {
        for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX)) await caches.delete(name);
    })());
});

// ── Web Push (the job this worker always had) ───────────────────────────────────────────────────────────────────────

self_.addEventListener('push', (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'OpenVibe', body: event.data ? event.data.text() : '' }; }
    const title = data.title || 'OpenVibe';
    const options = {
        body: data.body || '',
        icon: data.icon || 'https://openvibe.network/assets/logo-192.png',
        badge: data.badge || 'https://openvibe.network/assets/logo-72.png',
        tag: data.tag || 'openvibe',
        renotify: !!data.renotify,
        data: { url: data.url || 'https://openvibe.network/notifications', id: data.id || null },
        requireInteraction: false,
    };
    event.waitUntil(self_.registration.showNotification(title, options));
});

self_.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || 'https://openvibe.network/notifications';
    event.waitUntil((async () => {
        const all = await self_.clients.matchAll({ type: 'window', includeUncontrolled: true });
        let target = null;
        try { target = new URL(url); } catch { /* */ }
        for (const c of all) {
            try {
                if (target && new URL(c.url).origin === target.origin && 'focus' in c) {
                    await c.focus();
                    if ('navigate' in c) { try { await c.navigate(url); } catch { /* cross-origin navigate blocked */ } }
                    return;
                }
            } catch { /* */ }
        }
        await self_.clients.openWindow(url);
    })());
});
