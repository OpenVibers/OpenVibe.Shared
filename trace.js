'use strict';
/**
 * openvibe-shared/trace — carry the W3C trace of the request being served onto the calls a service
 * makes while serving it (roadmap Track O): one trace across Live → Chat → VIP → Billing, without
 * threading a context object through every function.
 *
 *   const trace = require('openvibe-shared/trace');
 *   app.use(contracts.http.middleware());   // accepts or starts traceparent, sets req.ov
 *   trace.install(app);                     // right after it: remembers req.ov for the request,
 *                                           // and outbound fetch() carries it
 *
 * install(app) adds a middleware that runs the rest of the request inside an AsyncLocalStorage
 * holding { traceId, requestId } (from req.ov, or parsed from the incoming traceparent), and wraps
 * globalThis.fetch once per process: a request to a loopback address or an OpenVibe host
 * (*.openvibe.network, openvibe.live, …, TRACE_HOSTS) that has no traceparent of its own gets
 * `traceparent: 00-<traceId>-<new span id>-01` and `X-OpenVibe-Request-Id`. Calls to anyone else
 * (payment providers, AI providers, user-chosen URLs) are left exactly as they were, so a trace id
 * never leaves the network. Outside a request (timers, workers) nothing is added.
 *
 *   trace.current()           { traceId, requestId } or null
 *   trace.outboundHeaders()   the headers install() would add ({} outside a request)
 *   trace.run(ctx, fn)        run fn inside a context (jobs that want one)
 */
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();
const TRACE_RE = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const OPENVIBE_HOST = /(^|\.)(openvibe\.(network|live|tools|media|community|chat|games|tips|vip|codes|wiki|blog|news|reviews|deals|coupons|trade|host)|openre\.stream)$/i;
const LOOPBACK_HOST = /^(127\.\d+\.\d+\.\d+|localhost|\[?::1\]?)$/i;

function fromHeaders(headers = {}) {
    const get = (k) => (typeof headers.get === 'function' ? headers.get(k) : headers[k] || headers[k.toLowerCase()]);
    const m = TRACE_RE.exec(String(get('traceparent') || '').trim().toLowerCase());
    const traceId = m && !/^0+$/.test(m[1]) ? m[1] : crypto.randomBytes(16).toString('hex');
    const rid = String(get('x-openvibe-request-id') || '').slice(0, 128);
    return { traceId, requestId: /^[A-Za-z0-9._:-]{1,128}$/.test(rid) ? rid : `req_${crypto.randomBytes(12).toString('hex')}` };
}

function current() { return als.getStore() || null; }
function run(ctx, fn) { return als.run(ctx && ctx.traceId ? { traceId: ctx.traceId, requestId: ctx.requestId || null } : fromHeaders({}), fn); }

function outboundHeaders(ctx = current()) {
    if (!ctx || !ctx.traceId) return {};
    const out = { traceparent: `00-${ctx.traceId}-${crypto.randomBytes(8).toString('hex')}-01` };
    if (ctx.requestId) out['X-OpenVibe-Request-Id'] = ctx.requestId;
    return out;
}

function extraHosts() {
    return String(process.env.TRACE_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
}
/** Does a call to this URL stay inside the network (loopback or an OpenVibe host)? */
function insideNetwork(url) {
    let host;
    try { host = new URL(url).hostname.toLowerCase(); } catch { return false; }
    host = host.replace(/^\[|\]$/g, '');
    return LOOPBACK_HOST.test(host) || OPENVIBE_HOST.test(host) || extraHosts().includes(host);
}

const WRAPPED = Symbol.for('openvibe.trace.fetch');
function wrapFetch() {
    const original = globalThis.fetch;
    if (typeof original !== 'function' || original[WRAPPED]) return;
    const traced = function tracedFetch(input, init) {
        const ctx = current();
        if (!ctx) return original(input, init);
        const url = typeof input === 'string' ? input : (input && (input.url || input.href)) || '';
        if (!insideNetwork(url)) return original(input, init);
        const headers = new Headers((init && init.headers) || (input && typeof input === 'object' && input.headers) || undefined);
        if (headers.has('traceparent')) return original(input, init);
        for (const [k, v] of Object.entries(outboundHeaders(ctx))) if (!headers.has(k)) headers.set(k, v);
        return original(input, { ...(init || {}), headers });
    };
    traced[WRAPPED] = true;
    globalThis.fetch = traced;
}

/** Express: the request's trace for everything it calls, and fetch() that carries it. */
function install(app) {
    wrapFetch();
    const mw = function openvibeTrace(req, _res, next) {
        const ctx = req.ov && req.ov.traceId ? { traceId: req.ov.traceId, requestId: req.ov.requestId || null } : fromHeaders(req.headers || {});
        als.run(ctx, next);
    };
    if (app && typeof app.use === 'function') app.use(mw);
    return mw;
}

module.exports = { install, current, run, outboundHeaders, insideNetwork, _wrapFetch: wrapFetch };
