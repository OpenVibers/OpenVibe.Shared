'use strict';
/**
 * openvibe-shared/csp — the network's Content-Security-Policy pieces, in one place.
 *
 * Every OpenVibe site builds a CSP header. Before this module each built its own string, so the composer's upload to
 * OpenVibe.Media was blocked on any site that had not named `https://openvibe.media` in connect-src (the browser sends
 * the multipart POST there, and a CSP refusal is a network error with no status). A site that uses these helpers gets
 * Network, Events and Media in connect-src by default; a site that needs more (its own websocket, Cloudflare's beacon)
 * adds it with `sites` or `extra`.
 *
 *   const csp = require('openvibe-shared/csp');
 *   res.setHeader('Content-Security-Policy', csp.policy({ nonce, sites: ['wss://openvibe.chat'], frames: ['https://openvibe.bot'] }));
 *
 * `connectSources()` is the list on its own, for a site that keeps its own policy but wants the network's origins.
 */
const NETWORK = 'https://openvibe.network';
const EVENTS = 'https://openvibe.events';
const MEDIA = 'https://openvibe.media';

const uniq = (list) => [...new Set(list.filter(Boolean).map(String))];

/**
 * The connect-src value: this site, the Network (sign-in, the Frame, settings, mentions), Events (release and
 * notification streams) and Media (composer attachments). `sites` and `extra` add more.
 */
function connectSources({ self = true, sites = [], extra = [] } = {}) {
    return uniq([self ? "'self'" : null, NETWORK, `wss://${NETWORK.slice(8)}`, EVENTS, `wss://${EVENTS.slice(8)}`, MEDIA, ...sites, ...extra]).join(' ');
}

/**
 * A full policy. Defaults suit a server-rendered site that runs only its own scripts, with inline styles and pictures
 * and media from anywhere over https.
 *
 *   nonce        the response's script nonce (inline scripts need it)
 *   script       extra script origins
 *   style        extra style origins
 *   images       the img-src value (default https:)
 *   media        the media-src value (default https:)
 *   frames       frame-src entries (default 'self')
 *   formAction   the form-action value (default 'self' https://openvibe.network)
 *   sites        extra connect-src origins
 *   connect      a full connect-src value, instead of connectSources()
 *   connectExtra extra connect-src entries
 *   objectSrc    object-src (default 'none')
 *   baseUri      base-uri (default 'self')
 *   frameAncestors frame-ancestors (default 'self')
 *   extra        { directive: value } appended (e.g. { 'worker-src': "'self' blob:" })
 */
function policy({ nonce, script = [], style = [], images = 'https:', media = 'https:', frames = ["'self'"], formAction = `'self' ${NETWORK}`, connect, sites = [], connectExtra = [], objectSrc = "'none'", baseUri = "'self'", frameAncestors = "'self'", extra = {} } = {}) {
    const directives = [
        ["default-src", "'self'"],
        ["script-src", ["'self'", nonce ? `'nonce-${nonce}'` : null, ...script].filter(Boolean).join(' ')],
        ["style-src", ["'self'", "'unsafe-inline'", ...style].filter(Boolean).join(' ')],
        ["img-src", images],
        ["media-src", media],
        ["font-src", "'self' data:"],
        ["connect-src", connect || connectSources({ sites, extra: connectExtra })],
        ["frame-src", frames.join(' ')],
        ["frame-ancestors", frameAncestors],
        ["base-uri", baseUri],
        ["object-src", objectSrc],
        ["form-action", formAction],
    ];
    const seen = new Set(directives.map(([d]) => d));
    for (const [d, v] of Object.entries(extra)) if (!seen.has(d) && v != null) directives.push([d, String(v)]);
    return directives.map(([d, v]) => `${d} ${v}`).join('; ');
}

module.exports = { NETWORK, EVENTS, MEDIA, MEDIA_UPLOAD_ORIGIN: MEDIA, connectSources, policy };
