'use strict';
/** Configuration store on an openvibe-sdk/db handle. The store is ready when the promise resolves. */
const { fromRows, canonical, ConfigError, subjectRef, isPlainObject, isMarker, makeLog, scrub, errText, lintSchema, OWNER_INPUT_GROUPS } = require('./config-core');

const TEST_TIMEOUT_MS = 15000;
const TEST_MESSAGE_MAX = 300;

function createConfigStore(opts = {}) {
    if (!opts.db || typeof opts.db.prepare !== 'function' || typeof opts.db.tx !== 'function') {
        throw new TypeError('createConfigStore: pass an openvibe-sdk/db handle as db');
    }
    return require('./config-pg').createPgConfigStore(opts);
}

// ── /api/admin/config ───────────────────────────────────────────

const TITLES = { 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict', 413: 'Payload Too Large', 422: 'Unprocessable Content', 500: 'Internal Server Error' };

/** RFC 9457 body (errors.problem@1), with the legacy { error } field like openvibe-contracts' http.problem(). */
function problem(status, code, { detail, errors } = {}) {
    const body = { type: `https://openvibe.network/problems/${code}`, title: TITLES[status] || 'Error', status, code };
    if (detail) body.detail = detail;
    if (errors && errors.length) body.errors = errors;
    body.error = detail || body.title;
    return body;
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
    res.statusCode = status;
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
}
const sendProblem = (res, status, code, o) => send(res, status, problem(status, code, o), 'application/problem+json');

/** The acting subject: req.actor, req.subject, req.user.subject or req.user.subject_id (a usr_… id). */
function defaultActor(req) {
    for (const c of [req.actor, req.subject, req.user && req.user.subject, req.user && req.user.subject_id]) {
        const ref = c ? subjectRef(c) : null;
        if (ref) return ref;
    }
    return null;
}

function readBody(req, limit = 256 * 1024) {
    if (req.body !== undefined) return Promise.resolve(req.body);
    if (typeof req.on !== 'function') return Promise.resolve({});
    return new Promise((resolve, reject) => {
        let size = 0; const chunks = [];
        req.on('data', (c) => { size += c.length; if (size > limit) { reject(new ConfigError('config.too_large', 'request body too large', { status: 413 })); req.destroy(); } else chunks.push(c); });
        req.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            if (!text.trim()) return resolve({});
            try { resolve(JSON.parse(text)); } catch { reject(new ConfigError('config.bad_request', 'the body is not JSON', { status: 400 })); }
        });
        req.on('error', reject);
    });
}

/**
 * adminRoutes(stores, { requireAdmin, basePath, actor, authorize, requireFresh, router, log })
 *   GET    <base>                         every namespace: active revision, values (redacted), last-known-good
 *   GET    <base>/:namespace              one of them
 *   GET    <base>/:namespace/history      ?limit (≤200) &before=<revision>, newest first
 *   POST   <base>/:namespace              { values, reason, merge?, unset? } → apply; 422 with errors
 *   POST   <base>/:namespace/rollback     { to?, reason } → the new revision
 *   PUT    <base>/:namespace/secrets/:key { value, reason } → the marker (write-only)
 *   DELETE <base>/:namespace/secrets/:key { reason } → the empty marker (write-only)
 *   POST   <base>/:namespace/test/:key    → { ok, message }: the service's tester tried the stored value
 * requireAdmin (a middleware or a list) guards every handler, mounted or called directly. actor(req)
 * names who acts (default: req.user.subject_id and friends; none → 403). authorize(req, { action:
 * 'read' | 'write', namespace, keys }) may refuse more (false → 403). requireFresh(req, { namespace,
 * keys }) runs before a secret write and before a change to an x-danger key; false → 403
 * config.fresh_required. A normal POST may not carry a secret-class value (422
 * config.secret_write_only) or an env-pinned key (409 config.pinned_in_env). No Express dependency:
 * pass `router` (anything with get/post/put/delete) or call mount(router), use the handlers, or
 * handle(req, res, next) for a plain http server. The body is req.body when a JSON parser ran, else
 * read from the request.
 *
 * test (optional) is the service's tester for the owner's Setup page: async ({ namespace, key, value, values, store,
 * req }) → { ok, message }, or null/undefined when it does not test that key (404 config.test_not_available). It gets
 * the stored value (a secret opened) and calls the provider with it on the server; the answer is one line, at most
 * 300 characters, scrubbed of every secret value of the namespace, so it can never echo a key. A tester that throws is
 * a failed test with its message (scrubbed the same way); one that runs longer than testTimeoutMs (15 s) is a failed
 * test too. authorize sees action 'test'. A key with no value is 409 config.not_set and the tester is not called.
 */
function adminRoutes(stores, o = {}) {
    const list = [].concat(stores || []);
    const byNs = new Map();
    for (const s of list) {
        if (!s || typeof s.summary !== 'function') throw new TypeError('adminRoutes: every store must come from createConfigStore');
        if (byNs.has(s.namespace)) throw new TypeError(`adminRoutes: ${s.namespace} is listed twice`);
        byNs.set(s.namespace, s);
    }
    const guards = [].concat(o.requireAdmin || []);
    if (!guards.length || !guards.every((g) => typeof g === 'function')) throw new TypeError('adminRoutes: requireAdmin middleware is required');
    const basePath = (o.basePath || '/api/admin/config').replace(/\/+$/, '');
    const actorOf = o.actor || defaultActor;
    const authorize = o.authorize || null;
    const requireFresh = o.requireFresh || null;
    if (requireFresh !== null && typeof requireFresh !== 'function') throw new TypeError('adminRoutes: requireFresh must be a function');
    const tester = o.test || null;
    if (tester !== null && typeof tester !== 'function') throw new TypeError('adminRoutes: test must be a function');
    const testTimeoutMs = Number.isInteger(o.testTimeoutMs) && o.testTimeoutMs > 0 ? o.testTimeoutMs : TEST_TIMEOUT_MS;
    const log = makeLog(o.log);

    const allowed = async (req, ctx) => !authorize || (await authorize(req, ctx)) !== false;
    function storeFor(req) {
        const ns = (req.params && req.params.namespace) || '';
        const s = byNs.get(ns);
        if (!s) throw new ConfigError('config.namespace_not_found', `no configuration namespace ${ns || '(none)'}`, { status: 404 });
        return s;
    }
    const queryOf = (req) => req.query || Object.fromEntries(new URL(req.url || '/', 'http://x').searchParams);
    const keyList = (keys) => keys.slice(0, 10).join(', ') + (keys.length > 10 ? ` (+${keys.length - 10})` : '');
    const keyOf = (req) => {
        let key = (req.params && req.params.key) || '';
        try { key = decodeURIComponent(key); } catch { /* keep it as it is */ }
        return key;
    };
    /** requireFresh for a secret or x-danger write; absent means no extra gate (nothing new is on). */
    async function fresh(req, s, keys) {
        if (!requireFresh) return;
        const ok = await requireFresh(req, { namespace: s.namespace, keys });
        if (ok === false) throw new ConfigError('config.fresh_required', 'a fresh sign-in is required for this change', { status: 403 });
    }

    const handlers = {
        async list(req, res) {
            const namespaces = [];
            for (const s of list) if (await allowed(req, { action: 'read', namespace: s.namespace, keys: [] })) namespaces.push(await s.summary());
            send(res, 200, { namespaces });
        },
        async get(req, res) {
            const s = storeFor(req);
            if (!(await allowed(req, { action: 'read', namespace: s.namespace, keys: [] }))) throw new ConfigError('config.forbidden', 'not allowed to read this namespace', { status: 403 });
            send(res, 200, await s.summary());
        },
        async history(req, res) {
            const s = storeFor(req);
            if (!(await allowed(req, { action: 'read', namespace: s.namespace, keys: [] }))) throw new ConfigError('config.forbidden', 'not allowed to read this namespace', { status: 403 });
            const query = queryOf(req);
            const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 20));
            const snapshots = await s.history({ limit, before: query.before != null && query.before !== '' ? parseInt(query.before, 10) : null });
            send(res, 200, { namespace: s.namespace, snapshots, next_before: snapshots.length === limit ? snapshots[snapshots.length - 1].revision : null });
        },
        async apply(req, res) {
            const s = storeFor(req);
            const body = await readBody(req);
            if (!isPlainObject(body) || !isPlainObject(body.values)) throw new ConfigError('config.bad_request', 'the body must be { values, reason }', { status: 400 });
            if (body.merge !== undefined && typeof body.merge !== 'boolean') throw new ConfigError('config.bad_request', 'merge must be true or false', { status: 400 });
            const actor = await actorOf(req);
            if (!subjectRef(actor)) throw new ConfigError('config.actor_required', 'the request does not name the acting subject', { status: 403 });
            const opts = { merge: body.merge === true, unset: body.unset || [], actor, reason: body.reason };
            const keys = await s.changes(body.values, opts);
            if (!(await allowed(req, { action: 'write', namespace: s.namespace, keys }))) throw new ConfigError('config.forbidden', 'not allowed to change these keys', { status: 403 });
            const classes = await s.classes(body.values, opts);
            // A secret value may not even be carried unchanged through the normal route; a marker may.
            const carried = Object.entries(body.values).filter(([k, v]) => !isMarker(v) && s.classify(k, v) === 'secret').map(([k]) => k);
            const secretKeys = [...new Set([...keys.filter((k) => classes[k] === 'secret'), ...carried])];
            if (secretKeys.length) throw new ConfigError('config.secret_write_only', `secret-class keys are write-only through /secrets: ${keyList(secretKeys)}`, { status: 422 });
            const danger = keys.filter((k) => s.isDanger(k));
            if (danger.length) await fresh(req, s, danger);
            send(res, 200, await s.apply(body.values, opts));
        },
        async rollback(req, res) {
            const s = storeFor(req);
            const body = await readBody(req);
            if (!isPlainObject(body)) throw new ConfigError('config.bad_request', 'the body must be { to?, reason? }', { status: 400 });
            if (body.to != null && !Number.isInteger(body.to)) throw new ConfigError('config.bad_request', 'to must be a revision number', { status: 400 });
            const actor = await actorOf(req);
            if (!subjectRef(actor)) throw new ConfigError('config.actor_required', 'the request does not name the acting subject', { status: 403 });
            const target = await s.rollbackTarget(body.to);
            const keys = await s.changes(null, { revision: target });
            if (!(await allowed(req, { action: 'write', namespace: s.namespace, keys }))) throw new ConfigError('config.forbidden', 'not allowed to change these keys', { status: 403 });
            const classes = await s.classes(null, { revision: target });
            const gated = [...new Set([...keys.filter((k) => classes[k] === 'secret'), ...keys.filter((k) => s.isDanger(k))])];
            if (gated.length) await fresh(req, s, gated);
            send(res, 200, await s.rollback({ to: target, reason: body.reason, actor }));
        },
        async secretPut(req, res) {
            const s = storeFor(req);
            const key = keyOf(req);
            if (!(await allowed(req, { action: 'write', namespace: s.namespace, keys: [key] }))) throw new ConfigError('config.forbidden', 'not allowed to change this key', { status: 403 });
            const body = await readBody(req);
            if (!isPlainObject(body) || !Object.prototype.hasOwnProperty.call(body, 'value')) throw new ConfigError('config.bad_request', 'the body must be { value, reason }', { status: 400 });
            const actor = await actorOf(req);
            if (!subjectRef(actor)) throw new ConfigError('config.actor_required', 'the request does not name the acting subject', { status: 403 });
            await fresh(req, s, [key]);
            send(res, 200, await s.setSecret(key, body.value, { actor, reason: body.reason }));
        },
        async secretDelete(req, res) {
            const s = storeFor(req);
            const key = keyOf(req);
            if (!(await allowed(req, { action: 'write', namespace: s.namespace, keys: [key] }))) throw new ConfigError('config.forbidden', 'not allowed to change this key', { status: 403 });
            const body = await readBody(req);
            if (!isPlainObject(body)) throw new ConfigError('config.bad_request', 'the body must be { reason }', { status: 400 });
            const actor = await actorOf(req);
            if (!subjectRef(actor)) throw new ConfigError('config.actor_required', 'the request does not name the acting subject', { status: 403 });
            await fresh(req, s, [key]);
            send(res, 200, await s.deleteSecret(key, { actor, reason: body.reason }));
        },
        async test(req, res) {
            const s = storeFor(req);
            const key = keyOf(req);
            if (!(await allowed(req, { action: 'test', namespace: s.namespace, keys: [key] }))) throw new ConfigError('config.forbidden', 'not allowed to test this key', { status: 403 });
            const actor = await actorOf(req);
            if (!subjectRef(actor)) throw new ConfigError('config.actor_required', 'the request does not name the acting subject', { status: 403 });
            if (!tester) throw new ConfigError('config.test_not_available', 'this service has no tests for its settings', { status: 404 });
            const values = s.get();
            const value = values[key];
            if (value === undefined || value === null || value === '') throw new ConfigError('config.not_set', `${key} is not set, so there is nothing to test`, { status: 409 });
            // Every secret value of the namespace is scrubbed from the answer, not only the tested one: a tester for a
            // client id may well have the client secret in hand.
            const classes = await s.classes({}, { merge: true });
            const secrets = Object.entries(values)
                .filter(([k, v]) => (classes[k] || s.classify(k, v)) === 'secret')
                .map(([, v]) => (typeof v === 'string' ? v : canonical(v)))
                .filter((v) => v.length >= 4)
                .sort((a, b) => b.length - a.length);
            const line = (m) => {
                const one = String(m == null ? '' : m).replace(/\s+/g, ' ').trim();
                return one ? scrub(one, secrets).slice(0, TEST_MESSAGE_MAX) : '';
            };
            const seconds = Math.max(1, Math.ceil(testTimeoutMs / 1000));
            let timer = null;
            let result;
            try {
                result = await Promise.race([
                    Promise.resolve().then(() => tester({ namespace: s.namespace, key, value, values, store: s, req })),
                    new Promise((resolve) => { timer = setTimeout(() => resolve({ ok: false, message: `The test did not finish in ${seconds} second${seconds === 1 ? '' : 's'}.` }), testTimeoutMs); }),
                ]);
            } catch (err) {
                if (err instanceof ConfigError) throw err;
                result = { ok: false, message: errText(err) };
            } finally {
                clearTimeout(timer);
            }
            if (result == null) throw new ConfigError('config.test_not_available', `${key} has no test`, { status: 404 });
            const ok = result === true || (isPlainObject(result) && result.ok === true);
            const message = line(isPlainObject(result) ? result.message : '') || (ok ? 'It works.' : 'It did not work.');
            log.info(`[config] ${s.namespace} ${key}: test ${ok ? 'passed' : 'failed'}`);
            send(res, 200, { ok, message });
        },
    };

    function fail(res, err) {
        if (res.headersSent) return;
        if (err instanceof ConfigError) return sendProblem(res, err.status, err.code, { detail: err.message, errors: err.errors });
        log.error(`[config] admin route failed: ${scrub(errText(err))}`);
        sendProblem(res, 500, 'config.internal', { detail: 'the configuration request failed' });
    }
    /** requireAdmin first, always; a guard that answers (401/403) ends the request there. */
    function guarded(fn) {
        return (req, res, next) => {
            let i = 0;
            const step = (err) => {
                if (err) return typeof next === 'function' ? next(err) : fail(res, err);
                if (i >= guards.length) return Promise.resolve().then(() => fn(req, res)).catch((e) => fail(res, e));
                const g = guards[i++];
                try { g(req, res, step); } catch (e) { step(e); }
            };
            step();
        };
    }
    const out = Object.fromEntries(Object.entries(handlers).map(([k, fn]) => [k, guarded(fn)]));
    const routes = [
        { method: 'get', path: basePath, handler: out.list },
        { method: 'get', path: `${basePath}/:namespace`, handler: out.get },
        { method: 'get', path: `${basePath}/:namespace/history`, handler: out.history },
        { method: 'post', path: `${basePath}/:namespace`, handler: out.apply },
        { method: 'post', path: `${basePath}/:namespace/rollback`, handler: out.rollback },
        { method: 'put', path: `${basePath}/:namespace/secrets/:key`, handler: out.secretPut },
        { method: 'delete', path: `${basePath}/:namespace/secrets/:key`, handler: out.secretDelete },
        { method: 'post', path: `${basePath}/:namespace/test/:key`, handler: out.test },
    ];
    function mount(router) {
        for (const r of routes) router[r.method](r.path, r.handler);
        return router;
    }
    /** For a plain http server: dispatches the eight routes, calls next() (or answers 404) for anything else. */
    function handle(req, res, next) {
        const url = new URL(req.url || '/', 'http://x');
        const method = String(req.method || 'GET').toLowerCase();
        const rest = url.pathname === basePath ? '' : url.pathname.startsWith(`${basePath}/`) ? url.pathname.slice(basePath.length + 1) : null;
        let m = null;
        if (rest === '') m = method === 'get' ? ['list'] : null;
        else if (rest !== null) {
            const parts = rest.split('/');
            if (parts.length === 1 && method === 'get') m = ['get', parts[0]];
            else if (parts.length === 1 && method === 'post') m = ['apply', parts[0]];
            else if (parts.length === 2 && parts[1] === 'history' && method === 'get') m = ['history', parts[0]];
            else if (parts.length === 2 && parts[1] === 'rollback' && method === 'post') m = ['rollback', parts[0]];
            else if (parts.length === 3 && parts[1] === 'secrets' && method === 'put') m = ['secretPut', parts[0], parts[2]];
            else if (parts.length === 3 && parts[1] === 'secrets' && method === 'delete') m = ['secretDelete', parts[0], parts[2]];
            else if (parts.length === 3 && parts[1] === 'test' && method === 'post') m = ['test', parts[0], parts[2]];
        }
        if (!m) return typeof next === 'function' ? next() : sendProblem(res, 404, 'config.route_not_found', { detail: 'no such configuration route' });
        let ns = m[1] || '';
        try { ns = decodeURIComponent(ns); } catch { /* keep it as it is */ }
        const params = { ...(req.params || {}), namespace: ns };
        if (m[2] !== undefined) { let key = m[2]; try { key = decodeURIComponent(key); } catch { /* keep it as it is */ } params.key = key; }
        req.params = params;
        if (!req.query) req.query = Object.fromEntries(url.searchParams);
        return out[m[0]](req, res, next);
    }
    if (o.router) mount(o.router);
    return { ...out, routes, mount, handle };
}

module.exports = { createConfigStore, adminRoutes, fromRows, canonical, ConfigError, problem, lintSchema, OWNER_INPUT_GROUPS, configSchema: (...a) => require('./config-pg').configSchema(...a) };
