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
 * copies on openvibe.network. Only the files openvibe-shared/files lists are served, plus the share
 * cards (social/<service>.jpg, openvibe-shared/social), the installable app icons
 * (icons/<service>[-maskable]-<size>.png, openvibe-shared/app-icons) and the web app manifest built
 * per service at manifest/<service>.webmanifest.
 *
 * JS/CSS are minified at serve time (openvibe-shared/minify) and cached by content hash: the minify
 * runs once per release per file, then the immutable ?v= URL does the rest. A file the minifier
 * cannot handle is served raw; a minified body is used only when it is smaller than the raw file.
 */
const fs = require('fs');
const files = require('./files');
const social = require('./social');
const appIcons = require('./app-icons');
const appIcon = require('./app-icon');
const cache = require('./cache-policy');
const { hashAsset } = require('./assets');
const { minifyFile } = require('./minify');

const hashes = new Map();
const fileOf = (name) => (social.isCard(name) ? social.path(name) : appIcons.isIcon(name) ? appIcons.path(name) : files.path(name));
function hashOf(name) {
    if (!hashes.has(name)) hashes.set(name, hashAsset(fs.readFileSync(fileOf(name))));
    return hashes.get(name);
}

/** The content-addressed URL of a browser file under `base` (default /shared). */
function url(name, base = '/shared') {
    if (!files.isBrowserFile(name)) throw new Error(`openvibe-shared/serve: ${name} is not a browser file`);
    return `${String(base).replace(/\/+$/, '')}/${name}?v=${hashOf(name)}`;
}

const MANIFEST_RE = /^manifest\/([a-z0-9][a-z0-9-]{0,40})\.webmanifest$/;

/** `short_name` is the part after "OpenVibe." when that fits in 12 characters; otherwise the full name. */
function shortName(name) {
    const suffix = typeof name === 'string' && name.startsWith('OpenVibe.') ? name.slice('OpenVibe.'.length) : '';
    return suffix && suffix.length <= 12 ? suffix : name;
}

/** The web app manifest for a service, from its pre-rendered name/tagline and hashed icon URLs. */
function manifestFor(service) {
    const site = appIcons.site(service);
    if (!site || !appIcons.has(service)) return null;
    return {
        name: site.name,
        short_name: shortName(site.name),
        description: site.description || '',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: appIcon.BG,
        theme_color: '#0d131d',
        icons: [
            { src: appIcons.url(service, 192), sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: appIcons.url(service, 512), sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: appIcons.url(service, 192, { maskable: true }), sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: appIcons.url(service, 512, { maskable: true }), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        id: '/',
    };
}

/** `/shared/manifest/<service>.webmanifest?v=<hash>`, or null when there is no icon set for the service. */
function manifestUrl(service) {
    const data = manifestFor(service);
    if (!data) return null;
    return `/shared/manifest/${service}.webmanifest?v=${hashAsset(JSON.stringify(data))}`;
}

function contentType(name) {
    if (name.endsWith('.css')) return 'text/css; charset=utf-8';
    if (name.endsWith('.jpg')) return 'image/jpeg';
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.woff2')) return 'font/woff2';
    if (name.endsWith('.svg')) return 'image/svg+xml; charset=utf-8';
    return 'application/javascript; charset=utf-8';
}

function vOf(req) {
    return req.query ? req.query.v : new URL(req.url, 'http://x').searchParams.get('v');
}

function cacheHeaders(res, name, hash, v) {
    res.setHeader('Cache-Control', cache.assetHeaders(name, { hashed: v === hash, swr: 60 }));
    res.setHeader('ETag', `"${hash}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
}

// Minified bodies by `${name}:${hash}`: minification runs once per release, then the cache and the
// immutable ?v= URL do the rest. Bounded, because a site never serves more than this package lists.
const bodies = new Map();

/** The bytes to serve for `name`: minified when JS/CSS, raw otherwise. Fail-open to raw. */
async function bodyFor(name) {
    const hash = hashOf(name);
    const key = `${name}:${hash}`;
    const hit = bodies.get(key);
    if (hit) return hit;
    if (bodies.size > 300) bodies.clear();
    const raw = fs.readFileSync(fileOf(name));
    if (!name.endsWith('.js') && !name.endsWith('.css')) {
        const entry = { body: raw, minified: false };
        bodies.set(key, entry);
        return entry;
    }
    try {
        const body = await minifyFile(name, raw);
        const entry = body.length < raw.length ? { body, minified: true } : { body: raw, minified: false };
        bodies.set(key, entry);
        return entry;
    } catch {
        const entry = { body: raw, minified: false };
        bodies.set(key, entry);
        return entry;
    }
}

/** Express/connect handler for app.use('/shared', handler()). */
function handler() {
    return function openvibeShared(req, res, next) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        const name = String(req.path || '').replace(/^\/+/, '');

        const manifest = MANIFEST_RE.exec(name);
        if (manifest) {
            const data = manifestFor(manifest[1]);
            if (!data) return next();
            const json = JSON.stringify(data);
            const hash = hashAsset(json);
            const v = vOf(req);
            res.setHeader('Content-Type', 'application/manifest+json');
            cacheHeaders(res, name, hash, v);
            if (req.headers['if-none-match'] === `"${hash}"`) { res.statusCode = 304; return res.end(); }
            if (req.method === 'HEAD') return res.end();
            return res.end(json);
        }

        if (!files.isBrowserFile(name) && !social.isCard(name) && !appIcons.isIcon(name)) return next();
        const hash = hashOf(name);
        const v = vOf(req);
        res.setHeader('Content-Type', contentType(name));
        cacheHeaders(res, name, hash, v);
        if (req.headers['if-none-match'] === `"${hash}"`) { res.statusCode = 304; return res.end(); }
        if (req.method === 'HEAD') return res.end();
        bodyFor(name).then(({ body }) => res.end(body)).catch(next);
    };
}

module.exports = { handler, url, hashOf, manifestUrl, _bodyFor: bodyFor };
