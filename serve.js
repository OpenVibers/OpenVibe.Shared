'use strict';
/**
 * openvibe-shared/serve — a site serves its OWN pinned copy of the shared browser files (the OpenVibe
 * Frame and friends) at /shared/*, with content-addressed URLs, instead of loading whatever
 * openvibe.network happens to run. The site's pin then decides what its pages execute, and its pages
 * keep their navbar and footer while openvibe.network is down.
 *
 *   const serve = require('openvibe-shared/serve');
 *   app.use('/shared', serve.handler());
 *   `<script src="${serve.url('navbar.js')}" defer></script>`   → /shared/navbar.js?v=<content hash>
 *
 * A request carrying the file's current hash (?v=) is cached for a year (immutable); anything else
 * for five minutes. ETag = the hash (304 on a match). CORS-open and cross-origin readable, like the
 * copies on openvibe.network. Only the files openvibe-shared/files lists are served.
 */
const fs = require('fs');
const crypto = require('crypto');
const files = require('./files');

const hashes = new Map();
function hashOf(name) {
    if (!hashes.has(name)) hashes.set(name, crypto.createHash('sha256').update(fs.readFileSync(files.path(name))).digest('hex').slice(0, 12));
    return hashes.get(name);
}

/** The content-addressed URL of a browser file under `base` (default /shared). */
function url(name, base = '/shared') {
    if (!files.isBrowserFile(name)) throw new Error(`openvibe-shared/serve: ${name} is not a browser file`);
    return `${String(base).replace(/\/+$/, '')}/${name}?v=${hashOf(name)}`;
}

/** Express/connect handler for app.use('/shared', handler()). */
function handler() {
    return function openvibeShared(req, res, next) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        const name = String(req.path || '').replace(/^\/+/, '');
        if (!files.isBrowserFile(name)) return next();
        const hash = hashOf(name);
        const v = req.query ? req.query.v : new URL(req.url, 'http://x').searchParams.get('v');
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', v === hash ? 'public, max-age=31536000, immutable' : 'public, max-age=300, stale-while-revalidate=60');
        res.setHeader('ETag', `"${hash}"`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (req.headers['if-none-match'] === `"${hash}"`) { res.statusCode = 304; return res.end(); }
        if (req.method === 'HEAD') return res.end();
        fs.createReadStream(files.path(name)).on('error', next).pipe(res);
    };
}

module.exports = { handler, url, hashOf };
