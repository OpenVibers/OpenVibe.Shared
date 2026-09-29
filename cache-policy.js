'use strict';
/**
 * openvibe-shared/cache-policy — the one cache rule every OpenVibe site uses, so no site has to
 * remember it and no site invents its own numbers: a content-addressed asset is immutable for a
 * year, everything else is a short public window with a long stale-while-revalidate, and a page
 * that is personalised for the person reading it is never cached by anybody.
 *
 *   const cache = require('openvibe-shared/cache-policy');
 *   res.setHeader('Cache-Control', cache.assetHeaders(req.url));   // ?v=<hash> → immutable
 *   res.setHeader('Cache-Control', cache.htmlHeaders());          // public, max-age=120, swr 3600
 *   app.use(cache.applyHtml({ private: req.path === '/account' }));
 *
 * A URL is content-addressed when it carries `?v=<hash>` (what serve.url() hands out) or a hashed
 * filename (`app.6f2a91c3.js`, `styles-a1b2c3d4e5.css`). Immutable is only ever right for those:
 * the bytes cannot change under the same URL. Everything else may change at any moment, so it gets
 * five minutes plus a day of stale-while-revalidate — a visitor is served the old copy for a
 * second while the new one is fetched, and nobody waits on the network twice.
 */
const IMMUTABLE = 'public, max-age=31536000, immutable';
const ASSET_MAX_AGE = 300;
const ASSET_SWR = 86400;

/** True when `path` is content-addressed: `?v=<hash>` or a hash in the filename. */
function isHashed(path) {
    const s = String(path == null ? '' : path);
    if (/(?:[?&]|&amp;)v=[0-9a-f]{8,64}\b/.test(s)) return true;
    const file = s.split(/[?#]/)[0];
    return /[.\-_][0-9a-f]{8,64}(?=[.\-_/]|$)/.test(file);
}

/**
 * The Cache-Control for a static asset. `hashed` defaults to the URL's own content-address; pass
 * it explicitly when the caller knows (a build manifest, a filename it generated itself).
 */
function assetHeaders(path, { hashed = isHashed(path), maxAge = ASSET_MAX_AGE, swr = ASSET_SWR } = {}) {
    if (hashed) return IMMUTABLE;
    return `public, max-age=${maxAge}, stale-while-revalidate=${swr}`;
}

/**
 * The Cache-Control for an HTML page. `private: true` (the default when a page is personalised)
 * is `private, no-store`: no shared cache, no browser cache, nothing left on a shared machine.
 */
function htmlHeaders({ private: isPrivate = false, maxAge = 120, swr = 3600 } = {}) {
    if (isPrivate) return 'private, no-store';
    return `public, max-age=${maxAge}, stale-while-revalidate=${swr}`;
}

/** Express/connect middleware: sets the HTML policy on every GET/HEAD response that has no policy yet. */
function applyHtml(opts = {}) {
    const value = htmlHeaders(opts);
    return function openvibeCachePolicy(req, res, next) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', value);
        return next();
    };
}

module.exports = { IMMUTABLE, isHashed, assetHeaders, htmlHeaders, applyHtml };
