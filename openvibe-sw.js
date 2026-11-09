/* OpenVibe — the one worker every site runs (the owner, 2026-11-09: "how come when you change sites it doesn't load more
 * asynchronously and dynamically, so it's faster across sites? … better caching on the client, cross-site and smarter, while
 * staying SEO friendly and crawlable?").
 *
 * Served by every OpenVibe site at /openvibe-sw.js (same origin, scope "/"), from openvibe-shared. Two jobs in one file:
 *
 *   1. Web Push (the job it always had): the network sends a notification, the worker shows it.
 *   2. The cache of content-addressed files: a shared or site file served under its content hash (?v=<hash> or a hash in
 *      the name: what serve.url() hands out) is kept and answered from the cache without asking the network again. Its
 *      bytes cannot change under that URL, and it is public, so this is safe for everyone this worker runs for.
 *
 * The rules that keep it honest (review 11-09):
 *
 *   - Only content-addressed files are answered by the worker. Pages and every other file go to the network exactly as
 *     the browser sends them: no copy of a page is ever kept (a signed-in page could outlive a sign-out on a shared
 *     device), nothing cuts a slow page off, and a file without a hash is never served stale against new HTML.
 *   - Nothing private is stored: a response with Set-Cookie, Cache-Control: private or no-store, or a Vary on Cookie or
 *     Authorization passes through and is never written to the cache.
 *   - The API is never touched: /api/ and anything that is not a plain GET go to the network untouched.
 *   - The kill switch: GET <kill switch> says { "enabled": false } and every worker on every site unregisters itself and
 *     drops its caches. A worker that cannot reach the switch keeps working.
 *   - A new VERSION is a new cache, and the cache keeps the newest MAX_ENTRIES files.
 *
 * This file is also the Web Push worker the notification bell registers for anyone who turns push on, so whatever it does
 * reaches them without any other opt-in: that is why it only keeps immutable public bytes.
 * The site that wants this says so: OpenVibeNavbar.init({ sw: true }). A site can also point the worker elsewhere
 * ({ sw: { path: '/my-sw.js' } }) or leave it alone.
 */
'use strict';

const VERSION = '4.164.0';                                  // the release this worker ships in: a bump replaces the caches
const CACHE_PREFIX = 'ov-shell-';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const KILL_SWITCH = 'https://openvibe.network/api/v1/sw-config';
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
    if (cacheable(res) && staticType(res)) { try { await cache.put(req, res.clone()); await trim(cache); } catch { /* full or gone */ } }
    return res;
}

/** Each release adds files under new hashes: the oldest go once the cache holds more than MAX_ENTRIES. */
const MAX_ENTRIES = 400;
async function trim(cache) {
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - MAX_ENTRIES; i++) await cache.delete(keys[i]);
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
    // Only the content-addressed ones: the worker never answers for any other file (see the fetch handler).
    const urls = (await shellUrls()).filter((u) => { try { return isHashed(new URL(u, self_.location.origin)); } catch { return false; } });
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

    // Only content-addressed files (a hash in the name, or ?v=<hash>): their bytes never change and are public, so the
    // cache answers first, for good. Pages and every other file go to the network exactly as the browser sends them.
    // (Review 11-09: this file is also the Web Push worker every signed-in person with push already runs, so whatever it
    // does reaches people who never opted in. Kept copies of pages could outlive a sign-out on a shared device, a 3 s
    // cut-off turned slow pages into "offline", and stale unhashed scripts could run against new HTML after a deploy.)
    if (req.destination === 'document' || req.mode === 'navigate' || !isHashed(url)) return;
    event.respondWith((async () => cacheFirst(req, await caches.open(CACHE_NAME)))());
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
