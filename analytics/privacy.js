'use strict';
/**
 * What a raw analytics row may carry (ADR-021, OpenVibe.Contracts docs/adr/ADR-021-analytics.md):
 * the event name, the service, a ROUTE TEMPLATE (never a raw URL with ids or a query string), a
 * rotating session id, the country, a user-agent CLASS and the timestamp. Never an IP address, a
 * precise location or a user/subject id.
 *
 * This file holds the pure reducers that turn a request into those fields, and the opt-out check
 * (Sec-GPC / DNT). No dependencies. The raw row shape is analytics/event.v1
 * (docs/schemas/analytics-event.v1.json, ./event.js).
 */

// ── Opt-out (Global Privacy Control, Do Not Track) ───────────

/** True when a header value is exactly "1" (either header may arrive repeated as an array). */
function headerIsOne(v) {
    if (Array.isArray(v)) return v.some(headerIsOne);
    return v != null && String(v).trim() === '1';
}

/**
 * True when the request asks not to be tracked: `Sec-GPC: 1` (Global Privacy Control) or `DNT: 1`.
 * Such a request is not recorded at all — no raw row, no visitor hash, no session, no rate counter —
 * so it is also missing from every rollup (ADR-021 allows no per-request trace of an opted-out
 * visitor, and does not provide for a separate opted-out count).
 */
function optedOut(headers) {
    if (!headers) return false;
    return headerIsOne(headers['sec-gpc']) || headerIsOne(headers.dnt);
}

// ── Bots ──────────────────────────────────────────────────────

const BOT_USER_AGENTS = [
    /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i, /baiduspider/i,
    /yandexbot/i, /facebot/i, /ia_archiver/i, /semrushbot/i, /ahrefsbot/i,
    /mj12bot/i, /dotbot/i, /petalbot/i, /rogerbot/i, /screaming frog/i,
    /seznambot/i, /sogou/i, /exabot/i, /archive\.org_bot/i, /crawler/i,
    /spider/i, /python-requests/i, /python-urllib/i, /httpx/i,
    /go-http-client/i, /java\//i, /libwww-perl/i, /wget/i, /curl/i,
    /headlesschrome/i, /phantomjs/i, /scrapy/i, /node-fetch/i,
    /axios/i, /postman/i, /insomnia/i, /lighthouse/i, /pagespeed/i,
    /gptbot/i, /chatgpt-user/i, /claudebot/i, /anthropic/i,
    /bytespider/i, /amazonbot/i, /applebot/i, /twitterbot/i,
    /facebookexternalhit/i, /linkedinbot/i, /whatsapp/i, /telegrambot/i,
    /discordbot/i, /slackbot/i, /uptimerobot/i, /pingdom/i,
    /statuscake/i, /monitoring/i, /health.?check/i,
];

const HONEYPOT_PATHS = ['/wp-login.php', '/xmlrpc.php', '/wp-admin', '/.env', '/admin.php', '/phpmyadmin'];

/** Requests per client in the current + previous minute above which a "human" is reclassified as a bot. */
const HIGH_REQUEST_RATE = 60;

/** The family name of the first bot pattern the user agent matches, or null. */
function botName(ua) {
    if (!ua) return null;
    for (const re of BOT_USER_AGENTS) {
        if (re.test(ua)) return re.source.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'bot';
    }
    return null;
}

/** { isBot, botType, confidence } from the user agent and the path (the rate check is the tracker's). */
function classifyRequest(req) {
    const ua = (req.headers && req.headers['user-agent']) || '';
    if (botName(ua)) return { isBot: true, botType: 'known_crawler', confidence: 0.95 };
    if (!ua || ua.length < 10) return { isBot: true, botType: 'no_useragent', confidence: 0.85 };
    const path = String(req.path || req.url || '').toLowerCase();
    if (HONEYPOT_PATHS.some((p) => path.startsWith(p))) return { isBot: true, botType: 'honeypot_hit', confidence: 0.90 };
    return { isBot: false, botType: null, confidence: 0.1 };
}

// ── User agent → class ───────────────────────────────────────

function parseUserAgent(ua) {
    if (!ua) return { device: 'unknown', browser: 'unknown', os: 'unknown' };
    let device = 'desktop';
    if (/mobile|android|iphone|ipod/i.test(ua)) device = 'mobile';
    else if (/ipad|tablet/i.test(ua)) device = 'tablet';

    let browser = 'other';
    if (/edg\//i.test(ua)) browser = 'edge';
    else if (/opr\/|opera/i.test(ua)) browser = 'opera';
    else if (/firefox\//i.test(ua)) browser = 'firefox';
    else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = 'chrome';
    else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = 'safari';
    else if (/trident|msie/i.test(ua)) browser = 'ie';

    let os = 'other';
    if (/windows/i.test(ua)) os = 'windows';
    else if (/macintosh|mac os/i.test(ua)) os = 'macos';
    else if (/linux/i.test(ua) && !/android/i.test(ua)) os = 'linux';
    else if (/android/i.test(ua)) os = 'android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'ios';

    return { device, browser, os };
}

const UA_CLASS_RE = /^(none|bot:[a-z0-9]+|[a-z]+\/[a-z]+\/[a-z]+)$/;

/**
 * The user-agent class stored instead of the user-agent string: `bot:<family>` for a known crawler,
 * `<browser>/<os>/<device>` otherwise, `none` when there is no user agent. Idempotent (a class maps
 * to itself), so a scrub can run over rows that are already reduced.
 */
function uaClass(ua) {
    if (ua == null || ua === '') return 'none';
    const s = String(ua);
    if (UA_CLASS_RE.test(s)) return s;
    const bot = botName(s);
    if (bot) return `bot:${bot}`;
    const p = parseUserAgent(s);
    return `${p.browser}/${p.os}/${p.device}`;
}

// ── Referer → origin ─────────────────────────────────────────

/** Only the scheme://host[:port] of an http(s) referer; anything else is dropped. */
function refererOrigin(ref) {
    if (!ref) return null;
    try {
        const u = new URL(String(ref));
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        return u.origin;
    } catch {
        return null;
    }
}

// ── Country ──────────────────────────────────────────────────

/** An ISO 3166-1 alpha-2 code (CDN country header) or null. Never a region or city. */
function countryCode(v) {
    const s = String(v || '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(s) ? s : null;
}

// ── Paths → route templates ──────────────────────────────────

/**
 * Words after which the next path segment is a parameter even when it looks like a word
 * (usernames, slugs). Over-redacting is the safe failure: `/u/alex` → `/u/:param`.
 */
const DEFAULT_PARAM_PREFIXES = [
    'u', 'user', 'users', 'profile', 'profiles', 'member', 'members', 'channel', 'channels', 'c',
    'vod', 'clip', 'p', 'paste', 'recap', 'stream', 'watch', 'v', 'embed', 'video', 'videos', 'shorts',
    'playlist', 'category', 'tag', 'tags', 'search', 'q', 's', 'invite', 'reset', 'verify', 'confirm',
    'token', 'tokens', 'share', 'r', 'job', 'jobs', 'download', 'downloads', 'file', 'files', 'doc',
    'recipe', 'recipes', 'place', 'places', 'room', 'rooms', 'dm', 'dms', 'thread', 'threads',
];

const MAX_SEGMENTS = 8;
const MAX_TEMPLATE_LENGTH = 200;
const SAFE_SEGMENT_RE = /^[A-Za-z0-9._~-]+$/;
const TEMPLATE_SEGMENT_RE = /^@?:[A-Za-z_][A-Za-z0-9_]*\??$|^\*$/;

/** True for a segment that is (or may be) an identifier rather than a fixed word of the route. */
function looksLikeId(s) {
    if (!SAFE_SEGMENT_RE.test(s)) return true;                    // spaces, @, +, =, commas, %…
    if (/^\d+$/.test(s)) return true;                             // 123
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s)) return true;        // uuid
    if (/^[0-9a-f]{8,}$/i.test(s)) return true;                   // hashes
    if (/^[A-Za-z]{2,6}_[A-Za-z0-9]{6,}$/.test(s)) return true;    // usr_…, hbt_…
    if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(s)) return true;         // ulid
    if (/\d/.test(s) && s.length >= 6) return true;               // slugs/tokens carrying numbers
    if (/[a-z]/.test(s) && /[A-Z]/.test(s) && s.length >= 8) return true; // base64-ish ids, CamelCase names
    if (s.length > 32) return true;
    return false;
}

/**
 * Path options with a service's extra parameter words merged into the defaults:
 * `{ paramPrefixes: Set, pathRules }`, or undefined when there is nothing to add.
 */
function pathOptions({ paramPrefixes, pathRules } = {}) {
    const extra = paramPrefixes ? [...paramPrefixes] : [];
    const rules = pathRules && pathRules.length ? checkRules(pathRules) : null;
    if (!extra.length && !rules) return undefined;
    const out = { paramPrefixes: new Set([...DEFAULT_PARAM_PREFIXES, ...extra]) };
    if (rules) out.pathRules = rules;
    return out;
}

function checkRules(rules) {
    for (const r of rules) {
        if (!Array.isArray(r) || !(r[0] instanceof RegExp) || typeof r[1] !== 'string') {
            throw new TypeError('pathRules entries are [RegExp, replacement string] pairs');
        }
    }
    return rules;
}

/** Apply a service's pathRules ([RegExp, replacement] pairs) to a raw path, in order. */
function applyPathRules(p, rules) {
    let s = String(p);
    if (rules) for (const [re, to] of rules) { re.lastIndex = 0; s = s.replace(re, to); }
    return s;
}

/**
 * Reduce a path (or a full URL) to a route template: no query, no fragment, identifiers replaced by
 * `:id`, the segment after a parameter-taking word by `:param`, `/@name` by `/@:user`. Already-templated
 * segments (`:id`, `@:user`, Express `:name`) pass through, so the function is idempotent.
 *
 * Options (a service's own route shapes):
 *   paramPrefixes  words whose next segment is a parameter (default DEFAULT_PARAM_PREFIXES; pass the
 *                  merged set from pathOptions() to add to the defaults rather than replace them)
 *   pathRules      [RegExp, replacement] pairs applied to the raw path first, for a parameter the
 *                  segment rules cannot see (e.g. [/\/by-username\/[^/?#]+/gi, '/by-username/:username']).
 *                  A rule's output must be stable under the same rule, or the result is not idempotent.
 */
function normalisePath(raw, { paramPrefixes = DEFAULT_PARAM_PREFIXES, pathRules } = {}) {
    if (raw == null || raw === '') return '/';
    let p = String(raw);
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(p)) {
        try { p = new URL(p).pathname; } catch { return '/'; }
    }
    p = p.split(/[?#]/)[0];
    if (pathRules) p = applyPathRules(p, pathRules);
    const prefixes = paramPrefixes instanceof Set ? paramPrefixes : new Set(paramPrefixes);
    const segs = p.split('/').filter(Boolean);
    const out = [];
    let expectParam = false;
    for (let i = 0; i < segs.length && i < MAX_SEGMENTS; i++) {
        let s = segs[i];
        try { s = decodeURIComponent(s); } catch { /* keep the raw segment */ }
        if (TEMPLATE_SEGMENT_RE.test(s)) { out.push(s); expectParam = false; continue; }
        if (s.startsWith('@')) { out.push('@:user'); expectParam = true; continue; }
        if (expectParam) { out.push(':param'); expectParam = false; continue; }
        if (looksLikeId(s)) { out.push(':id'); continue; }
        out.push(s);
        expectParam = prefixes.has(s.toLowerCase());
    }
    if (segs.length > MAX_SEGMENTS) out.push('*');
    // Too long: drop whole segments (never cut one in half) and end with `*`.
    if (('/' + out.join('/')).length > MAX_TEMPLATE_LENGTH) {
        if (out[out.length - 1] === '*') out.pop();
        while (out.length && ('/' + out.join('/')).length > MAX_TEMPLATE_LENGTH - 2) out.pop();
        out.push('*');
    }
    return '/' + out.join('/');
}

/**
 * The route template for a finished request: the matched Express route (mount path + route path)
 * when there is one, else the normalised original path. Both go through normalisePath, because a
 * mount path with parameters (`/api/vods/stream/:streamId/chunk`) arrives in req.baseUrl filled in.
 */
function routeTemplate(req, fallbackPath, opts) {
    const r = req && req.route;
    if (r && typeof r.path === 'string' && r.path && !/[*(]/.test(r.path)) {
        return normalisePath(`${req.baseUrl || ''}${r.path}`, opts);
    }
    return normalisePath(fallbackPath || (req && (req.originalUrl || req.url)) || '/', opts);
}

module.exports = {
    BOT_USER_AGENTS,
    HONEYPOT_PATHS,
    HIGH_REQUEST_RATE,
    DEFAULT_PARAM_PREFIXES,
    MAX_TEMPLATE_LENGTH,
    optedOut,
    botName,
    classifyRequest,
    parseUserAgent,
    uaClass,
    refererOrigin,
    countryCode,
    looksLikeId,
    pathOptions,
    applyPathRules,
    normalisePath,
    routeTemplate,
};
