'use strict';
/**
 * openvibe-shared/sw — the server's side of the shared worker (openvibe-sw.js).
 *
 * A site that wants the shell's cache says so in its navbar (OpenVibeNavbar.init({ sw: true })) and serves the worker at
 * /openvibe-sw.js, from this package, at scope "/". This module is the other half: what the worker needs to know, and the
 * early hints that get the shell downloading before the HTML is even parsed.
 *
 *   const sw = require('openvibe-shared/sw');
 *   app.get('/openvibe-sw.js', (req, res) => res.sendFile(sw.workerPath()));      // the worker itself
 *   app.get('/ov-sw-manifest.json', (req, res) => res.json(sw.manifest()));      // the shell, by content hash
 *   app.use(sw.hints({ links: (req) => [ { href: assets.url('/shared/navbar.js'), as: 'script' } ] }));
 *
 * The early hints (RFC 8297): the browser gets the shell's URLs in a 103 response, before the HTML arrives, and starts
 * fetching them while the server is still writing the page. The same links ride along in the Link header of the page itself,
 * so a proxy that drops the 103 still hands the browser the hint.
 *
 * Nothing here touches the API, and nothing here decides what a page shows: the hints are about when a file starts loading,
 * never about what it says.
 */
const path = require('path');

/** The release this helper ships in; the worker keeps the same number, and a test checks they agree. */
const VERSION = '4.164.0';

/** The shared files every OpenVibe page loads: the shell. The worker keeps them in its cache. */
const SHELL = Object.freeze([
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
]);

/** Where a worker asks whether it may keep working. A site may point it elsewhere for a test. */
const KILL_SWITCH = 'https://openvibe.network/api/v1/sw-config';

/** The path every site serves the worker at. Same origin, scope "/". */
const WORKER_PATH = '/openvibe-sw.js';

/** The file on disk: the worker this package ships. */
function workerPath() {
    return path.join(__dirname, 'openvibe-sw.js');
}

/**
 * The shell as JSON, for the site's /ov-sw-manifest.json. A site that serves the shell by content hash answers with its own
 * hashed URLs; the plain list is the fallback.
 */
function manifest(shell) {
    const given = (Array.isArray(shell) ? shell : []).filter((u) => typeof u === 'string' && u.startsWith('/'));
    return { version: VERSION, shell: given.length ? given : SHELL };
}

/** One preload link, as the Link header and the 103 response write it. */
function linkHeader(link) {
    if (!link || !link.href) return '';
    let out = '<' + link.href + '>; rel=preload';
    if (link.as) out += '; as=' + link.as;
    if (link.type) out += '; type=' + link.type;
    if (link.crossOrigin) out += '; crossorigin';
    return out;
}

/**
 * Send the early hints for a response.
 *
 *   sw.earlyHints(res, [ { href: '/shared/navbar.js?v=abc123', as: 'script' } ]);
 *
 * The 103 goes out first when the runtime can send one (Node 18.11 and later); the Link header rides on the page itself so
 * the hint survives a proxy that drops the 103. Returns true when a 103 was sent.
 */
function earlyHints(res, links) {
    const list = (Array.isArray(links) ? links : []).filter((l) => l && l.href);
    if (!list.length || !res) return false;
    let sent = false;
    if (typeof res.writeEarlyHints === 'function') {
        try {
            res.writeEarlyHints({ link: list.map(linkHeader).filter(Boolean) });
            sent = true;
        } catch { /* the response was already on its way */ }
    }
    if (!res.headersSent) {
        try { res.setHeader('Link', list.map(linkHeader).filter(Boolean).join(', ')); } catch { /* the header was set already */ }
    }
    return sent;
}

/**
 * Express middleware: send the early hints for a document request.
 *
 *   app.use(sw.hints({ links: (req) => [ { href: navbarUrl, as: 'script' } ] }));
 *
 * Only GET and HEAD are hinted, and only when the request asks for a document: a file request already knows its own URL.
 */
function hints({ links, filter } = {}) {
    const pick = typeof links === 'function' ? links : () => (Array.isArray(links) ? links : []);
    return function openvibeEarlyHints(req, res, next) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        if (filter && filter(req, res) === false) return next();
        try { earlyHints(res, pick(req, res)); } catch { /* a hint is never worth a page */ }
        return next();
    };
}

module.exports = { VERSION, SHELL, KILL_SWITCH, WORKER_PATH, workerPath, manifest, earlyHints, hints, linkHeader };
