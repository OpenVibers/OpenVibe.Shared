'use strict';
// ═══════════════════════════════════════════════════════════════
// openvibe-shared/ready — a truthful readiness response (roadmap Track O, §15.19: "readiness must
// report the capability actually served").
//
//   const ready = require('openvibe-shared/ready').createReadiness({
//       service: 'community', release: release.release,
//       checks: [
//           { name: 'db', required: true, check: () => db.prepare('SELECT 1 AS ok').get().ok === 1 },
//           { name: 'network_jwks', required: true, check: () => keys.loaded() || 'not loaded yet' },
//           { name: 'media', required: false, cacheMs: 30000, check: async () => { … } },
//       ],
//       details: () => ({ queue_depth: store.depth() }),   // optional extra fields
//   });
//   app.get('/api/ready', ready.handler);
//
// Every check runs on each request (or from its cache, keeping the time it really ran) and reports
// status, latency_ms and checked_at. A check passes when it returns anything but `false` or a string
// (`false`/a string is a failure; the string is the reason) or `{ ok: false, detail }`, and does not
// throw or time out. Overall `ready` is false only when a REQUIRED check fails (HTTP 503); a failed
// optional check keeps the service ready (HTTP 200) and is listed in `degraded`, so a missing optional
// dependency never reads as "healthy" or as "down".
// ═══════════════════════════════════════════════════════════════

const NAME_RE = /^[a-z][a-z0-9_.-]{0,63}$/;

/** A failure reason safe to show publicly: one line, no URL query strings or credentials, short. */
function safeReason(v) {
    let s = v instanceof Error ? (v.name === 'TimeoutError' || v.name === 'AbortError' ? 'timeout' : v.message) : String(v);
    s = s.split('\n')[0]
        .replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^/@\s]*@/gi, '$1')           // user:pass@
        .replace(/(\b[a-z][a-z0-9+.-]*:\/\/[^\s?#]*)[?#][^\s]*/gi, '$1')    // ?query / #fragment
        .replace(/\b(?:key|token|secret|password|signature)=[^\s&]+/gi, (m) => `${m.split('=')[0]}=…`);
    return s.slice(0, 200) || 'failed';
}

function withTimeout(promise, ms) {
    let t;
    const timer = new Promise((_, reject) => { t = setTimeout(() => reject(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), ms); });
    return Promise.race([promise, timer]).finally(() => clearTimeout(t));
}

function createReadiness({ service, release = null, checks = [], details = null, timeoutMs = 2000, now = () => new Date() } = {}) {
    if (!service) throw new TypeError('createReadiness: service required');
    const list = checks.map((c) => {
        if (!NAME_RE.test(String(c.name || ''))) throw new TypeError(`createReadiness: bad check name ${c.name}`);
        if (typeof c.check !== 'function') throw new TypeError(`createReadiness: check ${c.name} needs a function`);
        return { name: c.name, required: c.required !== false, check: c.check, timeoutMs: c.timeoutMs || timeoutMs, cacheMs: Math.max(0, c.cacheMs || 0), description: c.description || null };
    });
    const names = new Set();
    for (const c of list) { if (names.has(c.name)) throw new Error(`createReadiness: duplicate check ${c.name}`); names.add(c.name); }
    const cache = new Map();   // name -> { at: ms, result }
    const inflight = new Map();

    async function runOne(c) {
        const hit = cache.get(c.name);
        if (hit && c.cacheMs && Date.now() - hit.at < c.cacheMs) return hit.result;
        if (inflight.has(c.name)) return inflight.get(c.name);
        const p = (async () => {
            const t0 = process.hrtime.bigint();
            const out = { status: 'ok', required: c.required };
            try {
                const v = await withTimeout(Promise.resolve().then(() => c.check()), c.timeoutMs);
                if (v === false) { out.status = 'fail'; out.error = 'check returned false'; }
                else if (typeof v === 'string') { out.status = 'fail'; out.error = safeReason(v); }
                else if (v && typeof v === 'object' && !Array.isArray(v)) {
                    if (v.ok === false) { out.status = 'fail'; out.error = safeReason(v.error || v.detail || 'failed'); }
                    if (v.detail !== undefined && (v.ok !== false || typeof v.detail === 'object')) out.detail = v.detail;
                }
            } catch (err) {
                out.status = 'fail';
                out.error = safeReason(err);
            }
            out.latency_ms = Math.round(Number(process.hrtime.bigint() - t0) / 1e5) / 10;
            out.checked_at = now().toISOString();
            if (c.description) out.description = c.description;
            cache.set(c.name, { at: Date.now(), result: out });
            return out;
        })().finally(() => inflight.delete(c.name));
        inflight.set(c.name, p);
        return p;
    }

    async function run() {
        const results = await Promise.all(list.map(runOne));
        const out = {};
        const failed = []; const degraded = [];
        list.forEach((c, i) => {
            out[c.name] = results[i];
            if (results[i].status !== 'ok') (c.required ? failed : degraded).push(c.name);
        });
        const ready = failed.length === 0;
        const body = {
            ready,
            status: !ready ? 'not_ready' : degraded.length ? 'degraded' : 'ready',
            service,
            release: typeof release === 'function' ? release() : release,
            checked_at: now().toISOString(),
            failed,
            degraded,
            checks: out,
        };
        if (details) {
            try {
                const extra = await withTimeout(Promise.resolve().then(() => details(body)), timeoutMs);
                if (extra && typeof extra === 'object') for (const [k, v] of Object.entries(extra)) if (!(k in body)) body[k] = v;
            } catch (err) { body.details_error = safeReason(err); }
        }
        return body;
    }

    async function handler(_req, res) {
        let body;
        try { body = await run(); } catch (err) {
            body = { ready: false, status: 'not_ready', service, checked_at: now().toISOString(), failed: ['readiness'], degraded: [], checks: {}, error: safeReason(err) };
        }
        res.statusCode = body.ready ? 200 : 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(body));
    }

    return { run, handler, checks: list.map((c) => ({ name: c.name, required: c.required })) };
}

module.exports = { createReadiness, safeReason };
