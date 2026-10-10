'use strict';
// openvibe-shared/config on PostgreSQL (ADR-035): the configuration store on an openvibe-sdk/db handle. Every
// method that reads or writes the database is async; get() and revision() stay in memory. createConfigStore picks this
// implementation when it is handed an openvibe-sdk/db handle, and then returns a promise of the store (it has read or
// seeded its active revision when it resolves). The tables come from
// the service's migrations: configSchema() is their DDL.
const crypto = require('crypto');
const { CLASSES, SERVICE_RE, NAMESPACE_RE, validKey, REASON_MAX, ERROR_MAX, ConfigError, canonical, sha256, isPlainObject, pointer, clone, same, has, deepFreeze, jsonErrors, isMarker, looksRedacted, sameHex, compileSchema, checkSchema, validateResult, subjectRef, scrub, errText, summarize, makeLog, fromRows } = require('./config-core');

/** The DDL of config_snapshots and config_keys, for a service's migrations. */
function configSchema() {
    return `CREATE TABLE IF NOT EXISTS config_snapshots (
    namespace            text COLLATE "C" NOT NULL,
    revision             bigint NOT NULL,
    service              text COLLATE "C" NOT NULL,
    previous_revision    bigint,
    state                text COLLATE "C" NOT NULL CHECK (state IN ('proposed', 'active', 'superseded', 'rejected', 'rolled_back')),
    values_json          text COLLATE "C" NOT NULL,              -- the full values, secrets included (never served)
    classification_json  text COLLATE "C" NOT NULL,
    values_checksum      text COLLATE "C" NOT NULL,              -- sha256 of the full values: internal, never served
    created_at           text COLLATE "C" NOT NULL,
    created_by           text COLLATE "C" NOT NULL,
    activated_at         text COLLATE "C",
    activated_by         text COLLATE "C",
    reason               text COLLATE "C",
    error                text COLLATE "C",
    copied_from          bigint,
    good                 bigint NOT NULL DEFAULT 0,             -- 1 once it activated successfully (last-known-good)
    PRIMARY KEY (namespace, revision)
);
CREATE UNIQUE INDEX IF NOT EXISTS config_snapshots_one_active ON config_snapshots (namespace) WHERE state = 'active';
-- The fingerprint key of each namespace. Never served, never logged.
CREATE TABLE IF NOT EXISTS config_keys (
    namespace   text COLLATE "C" PRIMARY KEY,
    hmac_key    bytea NOT NULL,
    created_at  text COLLATE "C" NOT NULL
);`;
}

async function createPgConfigStore(opts = {}) {
    const { db, service, namespace, schema = null, validate = null, classify = null, onActivate = null } = opts;
    if (!db || typeof db.prepare !== 'function' || typeof db.tx !== 'function') throw new TypeError('createConfigStore: db must be an openvibe-sdk/db handle');
    if (!SERVICE_RE.test(String(service || ''))) throw new TypeError('createConfigStore: service must be a service id (live, media, …)');
    if (!NAMESPACE_RE.test(String(namespace || '')) || !namespace.startsWith(`${service}.`) || namespace.length > 120) {
        throw new TypeError(`createConfigStore: namespace must be <service>.<name>, e.g. ${service}.settings`);
    }
    if (schema !== null) compileSchema(schema);
    if (validate !== null && typeof validate !== 'function') throw new TypeError('createConfigStore: validate must be a function');
    if (onActivate !== null && typeof onActivate !== 'function') throw new TypeError('createConfigStore: onActivate must be a function');
    if (classify !== null && typeof classify !== 'function' && !isPlainObject(classify)) throw new TypeError('createConfigStore: classify must be a map or a function');
    if (opts.defaults != null && !isPlainObject(opts.defaults)) throw new TypeError('createConfigStore: defaults must be an object');
    const keep = Math.max(1, Math.floor(opts.keep || 50));
    const maxBytes = opts.maxBytes || 1024 * 1024;
    const log = makeLog(opts.log);
    const now = opts.now || (() => new Date());
    const iso = () => { const d = now(); return (d instanceof Date ? d : new Date(d)).toISOString(); };
    const self = { type: 'service', id: service };
    const defaults = deepFreeze(clone(opts.defaults || {}));
    const tag = `[config] ${namespace}`;

    // config_snapshots and config_keys come from the service's migrations (configSchema()).
    const q = {
        row: db.prepare('SELECT * FROM config_snapshots WHERE namespace = ? AND revision = ?'),
        active: db.prepare("SELECT * FROM config_snapshots WHERE namespace = ? AND state = 'active'"),
        any: db.prepare('SELECT 1 AS x FROM config_snapshots WHERE namespace = ? LIMIT 1'),
        max: db.prepare('SELECT COALESCE(MAX(revision), 0) AS n FROM config_snapshots WHERE namespace = ?'),
        lastGood: db.prepare("SELECT revision FROM config_snapshots WHERE namespace = ? AND good = 1 AND state IN ('active', 'superseded', 'rolled_back') ORDER BY revision DESC LIMIT 1"),
        previousGood: db.prepare("SELECT revision FROM config_snapshots WHERE namespace = ? AND good = 1 AND state IN ('superseded', 'rolled_back') AND revision < ? AND values_checksum != ? ORDER BY revision DESC LIMIT 1"),
        history: db.prepare('SELECT * FROM config_snapshots WHERE namespace = ? AND revision < ? ORDER BY revision DESC LIMIT ?'),
        insert: db.prepare(`INSERT INTO config_snapshots (namespace, revision, service, previous_revision, state, values_json, classification_json,
            values_checksum, created_at, created_by, activated_at, activated_by, reason, copied_from, good)
            VALUES (@namespace, @revision, @service, @previous_revision, @state, @values_json, @classification_json,
            @values_checksum, @created_at, @created_by, @activated_at, @activated_by, @reason, @copied_from, @good)`),
        setState: db.prepare('UPDATE config_snapshots SET state = ? WHERE namespace = ? AND revision = ?'),
        activate: db.prepare("UPDATE config_snapshots SET state = 'active', activated_at = ?, activated_by = ?, good = ? WHERE namespace = ? AND revision = ?"),
        good: db.prepare('UPDATE config_snapshots SET good = 1 WHERE namespace = ? AND revision = ?'),
        reject: db.prepare("UPDATE config_snapshots SET state = 'rejected', error = ?, activated_at = NULL, activated_by = NULL, good = 0 WHERE namespace = ? AND revision = ?"),
        prune: db.prepare("DELETE FROM config_snapshots WHERE namespace = ? AND revision <= ? AND state != 'active' AND revision != ?"),
    };
    const tx = async (fn) => await db.tx(fn);   // ambient: the store's statements inside join it

    // ── the namespace's fingerprint key: made on first use, then read (a racing process keeps the first) ──
    let hmacKey = null;   // loaded by init(): made on first use, then read (a racing process keeps the first)
    async function loadKey() {
        const read = db.prepare('SELECT hmac_key FROM config_keys WHERE namespace = ?');
        let row = await read.get(namespace);
        if (!row) {
            await db.prepare('INSERT INTO config_keys (namespace, hmac_key, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(namespace, crypto.randomBytes(32), iso());
            row = await read.get(namespace);
        }
        const k = row && row.hmac_key ? Buffer.from(row.hmac_key) : null;   // Buffer (pg) or Uint8Array (PGlite)
        if (!k || k.length < 32) throw new Error(`createConfigStore: the fingerprint key of ${namespace} in config_keys is not a 32-byte key`);
        hmacKey = k;
    }
    const fingerprint = (v) => crypto.createHmac('sha256', hmacKey).update(canonical(v)).digest('hex');
    const markerFor = (v) => ({ redacted: true, fingerprint: fingerprint(v) });

    // ── classification and redaction ──
    const RANK = { public: 0, internal: 1, secret: 2 };
    function classOf(key, value) {
        let c;
        try { c = typeof classify === 'function' ? classify(key, value) : (classify && has(classify, key) ? classify[key] : undefined); } catch { c = 'secret'; }
        if (c == null) return 'internal';
        if (!CLASSES.includes(c)) { log.warn(`${tag}: classify gave "${String(c).slice(0, 20)}" for ${key}; treating it as secret`); return 'secret'; }
        return c;
    }
    const classifyAll = (values) => Object.fromEntries(Object.keys(values).map((k) => [k, classOf(k, values[k])]));
    /** The stricter of what was stored and what the policy says now, so a key made secret later is redacted in old revisions too. */
    function classesFor(values, stored = {}) {
        const out = classifyAll(values);
        for (const k of Object.keys(out)) if (stored[k] && RANK[stored[k]] > RANK[out[k]]) out[k] = stored[k];
        return out;
    }
    const redact = (values, cls) => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, cls[k] === 'secret' ? markerFor(v) : v]));
    function secretStrings(...valueSets) {
        const out = [];
        for (const values of valueSets) {
            if (!values) continue;
            for (const [k, v] of Object.entries(values)) {
                if (classOf(k, v) !== 'secret' || v == null) continue;
                out.push(typeof v === 'string' ? v : JSON.stringify(v));
            }
        }
        return out.sort((a, b) => b.length - a.length);
    }

    function toSnapshot(row) {
        const values = JSON.parse(row.values_json);
        const classification = classesFor(values, JSON.parse(row.classification_json));
        const shown = redact(values, classification);
        return {
            service: row.service,
            namespace: row.namespace,
            revision: row.revision,
            previous_revision: row.previous_revision == null ? null : row.previous_revision,
            state: row.state,
            values: shown,
            classification,
            checksum: sha256(canonical(shown)),
            created_at: row.created_at,
            created_by: JSON.parse(row.created_by),
            activated_at: row.activated_at || null,
            activated_by: row.activated_by ? JSON.parse(row.activated_by) : null,
            reason: row.reason == null ? null : row.reason,
            error: row.error == null ? null : row.error,
            copied_from: row.copied_from == null ? null : row.copied_from,
        };
    }

    // ── in-memory state ──
    let current = null;   // { revision, values (stored), effective (frozen), classification }
    const emptyEffective = defaults;
    function load(row) {
        const values = JSON.parse(row.values_json);
        return { revision: row.revision, checksum: row.values_checksum, values, effective: deepFreeze({ ...clone(defaults), ...clone(values) }), classification: JSON.parse(row.classification_json) };
    }
    const effectiveNow = () => (current ? current.effective : emptyEffective);

    // ── validation ──
    function problems(values) {
        const errors = [];
        if (!isPlainObject(values)) return [{ path: '', message: 'must be an object' }];
        for (const k of Object.keys(values)) if (!validKey(k)) errors.push({ path: pointer(k), message: 'is not a valid key (letters, digits, _ . : -; at most 128)' });
        for (const [k, v] of Object.entries(values)) if (looksRedacted(v)) errors.push({ path: pointer(k), message: 'is an object with a redacted member, which only a redaction marker may be' });
        jsonErrors(values, '', errors);
        if (errors.length) return errors;
        const size = Buffer.byteLength(canonical(values));
        if (size > maxBytes) return [{ path: '', message: `is ${size} bytes; at most ${maxBytes}` }];
        const effective = { ...defaults, ...values };
        if (schema !== null) checkSchema(schema, effective, '', errors);
        if (validate) {
            let r;
            try { r = validate(effective); } catch (err) { r = [{ path: '', message: errText(err) }]; }
            if (r && typeof r.then === 'function') throw new TypeError('createConfigStore: validate must be synchronous (check asynchronously in onActivate)');
            errors.push(...validateResult(r));
        }
        const secrets = secretStrings(values, effectiveNow());
        return errors.map((e) => ({ path: e.path, message: scrub(e.message, secrets) }));
    }
    const invalid = (errors, revision) => new ConfigError('config.invalid', `invalid configuration: ${summarize(errors)}`.slice(0, ERROR_MAX), { status: 422, errors, revision });

    /** values (+ merge/unset) as the complete values a new revision would hold. A redaction marker keeps the value it stands for. */
    function resolve(input, { merge = false, unset = [] } = {}) {
        if (!isPlainObject(input)) throw invalid([{ path: '', message: 'must be an object' }]);
        if (!Array.isArray(unset) || !unset.every((k) => typeof k === 'string')) throw invalid([{ path: '', message: 'unset must be a list of keys' }]);
        const base = merge && current ? clone(current.values) : {};
        const errors = [];
        for (const [k, v] of Object.entries(input)) {
            if (!validKey(k)) { errors.push({ path: pointer(k), message: 'is not a valid key (letters, digits, _ . : -; at most 128)' }); continue; }
            if (!isMarker(v)) { base[k] = v; continue; }
            if (current && has(current.values, k) && sameHex(fingerprint(current.values[k]), v.fingerprint)) base[k] = clone(current.values[k]);
            else if (has(defaults, k) && sameHex(fingerprint(defaults[k]), v.fingerprint)) delete base[k];
            else errors.push({ path: pointer(k), message: 'is a redacted value that is not the current one; send the value itself' });
        }
        if (errors.length) throw invalid(errors);
        for (const k of unset) delete base[k];
        return base;
    }

    function changedKeys(before, after) {
        const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
        return [...keys].filter((k) => has(before, k) !== has(after, k) || !same(before[k], after[k])).sort();
    }
    const listKeys = (keys) => (keys.length ? keys.slice(0, 20).join(', ') + (keys.length > 20 ? ` (+${keys.length - 20})` : '') : 'nothing');
    const who = (a) => `${a.type}:${a.id}`;

    function actorOf(actor) {
        if (actor == null) return self;
        const ref = subjectRef(actor);
        if (!ref) throw new ConfigError('config.bad_actor', 'actor must be a subject reference ({ type, id })', { status: 400 });
        return ref;
    }
    function reasonOf(reason) {
        if (reason == null || reason === '') return null;
        if (typeof reason !== 'string') throw invalid([{ path: '/reason', message: 'must be a string' }]);
        return reason.slice(0, REASON_MAX);
    }

    async function insertRow(values, { state, actor, reason, previous, copiedFrom = null, activatedAt = null, good = 0 }) {
        let row;
        await tx(async () => {
            const revision = (await q.max.get(namespace)).n + 1;
            await q.insert.run({
                namespace, revision, service, previous_revision: previous, state,
                values_json: JSON.stringify(values), classification_json: JSON.stringify(classifyAll(values)),
                values_checksum: sha256(canonical(values)), created_at: iso(), created_by: JSON.stringify(actor),
                activated_at: activatedAt, activated_by: activatedAt ? JSON.stringify(actor) : null,
                reason, copied_from: copiedFrom, good,
            });
            row = await q.row.get(namespace, revision);
        });
        return row;
    }

    async function prune() {
        const cutoff = (await q.max.get(namespace)).n - keep;
        if (cutoff < 1) return;
        const good = await q.lastGood.get(namespace);
        await q.prune.run(namespace, cutoff, good ? good.revision : -1);
    }

    // ── boot: load the active revision, recover an interrupted activation, or seed revision 1 ──
    async function seed(values, reason, { strict }) {
        if (!strict) {
            // A legacy key the contract cannot carry is left behind, by name, rather than imported.
            const bad = Object.keys(values).filter((k) => !validKey(k) || looksRedacted(values[k]));
            if (bad.length) {
                log.warn(`${tag}: ${bad.length} legacy key(s) are not valid config keys and were not imported: ${bad.slice(0, 5).map((k) => JSON.stringify(k.slice(0, 64))).join(', ')}`);
                values = Object.fromEntries(Object.entries(values).filter(([k]) => validKey(k)));
            }
        }
        const errors = problems(values);
        if (errors.length && strict) throw new ConfigError('config.invalid_defaults', `${namespace} defaults do not validate: ${summarize(errors)}`, { status: 500, errors });
        if (errors.length) log.warn(`${tag}: the imported values do not validate (${summarize(errors).slice(0, 300)}); imported as they are`);
        const row = await insertRow(clone(values), { state: 'active', actor: self, reason, previous: null, activatedAt: iso(), good: 1 });
        current = load(row);
        log.info(`${tag}: revision ${row.revision} ${reason} (${Object.keys(values).length} keys)`);
        return toSnapshot(row);
    }

    async function importLegacy(legacy, { reason = 'imported from the legacy source' } = {}) {
        if (await q.any.get(namespace)) return null;
        let v = typeof legacy === 'function' ? legacy() : legacy;
        if (Array.isArray(v)) v = fromRows(v);
        if (v == null) return null;
        if (!isPlainObject(v)) throw new TypeError('import: legacy must give an object or key-value rows');
        return await seed(v, reasonOf(reason) || 'imported from the legacy source', { strict: false });
    }

    async function boot() {
        await loadKey();
        let row = await q.active.get(namespace);
        if (row && !row.good) {
            // The process stopped between the switch and the end of onActivate: that revision never
            // proved itself, so the last-known-good one is active again.
            const good = await q.lastGood.get(namespace);
            await tx(async () => {
                await q.reject.run('activation interrupted: the service stopped before onActivate finished', namespace, row.revision);
                if (good) await q.setState.run('active', namespace, good.revision);
            });
            log.warn(`${tag}: revision ${row.revision} was interrupted while activating; ${good ? `revision ${good.revision} restored` : 'no earlier revision to restore'}`);
            row = good ? await q.row.get(namespace, good.revision) : null;
        }
        if (row) {
            current = load(row);
            const errors = problems(current.values);
            if (errors.length) log.warn(`${tag}: active revision ${row.revision} does not validate under this release (${summarize(errors).slice(0, 300)}); serving it as it is`);
            return;
        }
        if (await q.any.get(namespace)) return;
        if (opts.legacy !== undefined && await importLegacy(opts.legacy)) return;
        if (opts.defaults != null) await seed(defaults, 'seeded from defaults', { strict: true });
    }

    // ── activation (serialized per store) ──
    let queue = Promise.resolve();
    function serialized(fn) {
        const run = queue.then(fn, fn);
        queue = run.catch(() => {});
        return run;
    }

    async function activateNow(revision, { actor, rollingBack = false } = {}) {
        const by = actorOf(actor);
        const row = await q.row.get(namespace, revision);
        if (!row) throw new ConfigError('config.revision_not_found', `${namespace} has no revision ${revision}`, { status: 404, revision });
        if (row.state !== 'proposed') throw new ConfigError('config.not_proposed', `revision ${revision} is ${row.state}, not proposed`, { status: 409, revision });
        const values = JSON.parse(row.values_json);
        const errors = problems(values);
        if (errors.length) {
            await q.reject.run(summarize(errors).slice(0, ERROR_MAX), namespace, revision);
            log.warn(`${tag}: revision ${revision} rejected: ${summarize(errors).slice(0, 300)}`);
            throw invalid(errors, revision);
        }
        const prev = current;
        const at = iso();
        await tx(async () => {
            const dbActive = await q.active.get(namespace);
            const activeRev = dbActive ? dbActive.revision : null;
            if ((row.previous_revision == null ? null : row.previous_revision) !== activeRev) {
                throw new ConfigError('config.stale', `revision ${revision} was proposed on ${row.previous_revision ? `revision ${row.previous_revision}` : 'an empty namespace'}, but ${activeRev ? `revision ${activeRev}` : 'nothing'} is active now; propose it again`, { status: 409, revision });
            }
            if (dbActive) await q.setState.run(rollingBack ? 'rolled_back' : 'superseded', namespace, dbActive.revision);
            await q.activate.run(at, JSON.stringify(by), onActivate ? 0 : 1, namespace, revision);
        });
        current = load(await q.row.get(namespace, revision));
        const changed = changedKeys(prev ? prev.effective : emptyEffective, current.effective);
        if (onActivate) {
            const next = current;
            try {
                await onActivate(next.effective, prev ? prev.effective : null, { namespace, revision, previous_revision: prev ? prev.revision : null, restoring: false });
            } catch (err) {
                const message = scrub(`onActivate: ${errText(err)}`, secretStrings(next.values, prev && prev.values));
                await tx(async () => {
                    await q.reject.run(message, namespace, revision);
                    if (prev) await q.setState.run('active', namespace, prev.revision);
                });
                current = prev;
                log.warn(`${tag}: revision ${revision} rejected (${message}); ${prev ? `revision ${prev.revision} restored` : 'nothing was active before'}`);
                if (prev) {
                    try {
                        await onActivate(prev.effective, next.effective, { namespace, revision: prev.revision, previous_revision: revision, restoring: true });
                    } catch (again) {
                        log.error(`${tag}: re-applying revision ${prev.revision} failed too: ${scrub(errText(again), secretStrings(next.values, prev.values))}`);
                    }
                }
                throw new ConfigError('config.activation_failed', message, { status: 422, revision, cause: err });
            }
            await q.good.run(namespace, revision);
        }
        await prune();
        log.info(`${tag}: revision ${revision} active${prev ? ` (was ${prev.revision})` : ''} by ${who(by)}; changed ${listKeys(changed)}`);
        return toSnapshot(await q.row.get(namespace, revision));
    }

    async function propose(values, o = {}) {
        const actor = actorOf(o.actor);
        const reason = reasonOf(o.reason);
        const next = resolve(values, o);
        const errors = problems(next);
        if (errors.length) throw invalid(errors);
        const row = await insertRow(next, { state: 'proposed', actor, reason, previous: current ? current.revision : null });
        await prune();
        log.info(`${tag}: revision ${row.revision} proposed by ${who(actor)}; changes ${listKeys(changedKeys(effectiveNow(), { ...defaults, ...next }))}`);
        return toSnapshot(row);
    }

    async function rollbackTarget(to) {
        if (!current) throw new ConfigError('config.nothing_active', `${namespace} has no active revision to roll back`, { status: 409 });
        if (to == null) {
            const r = await q.previousGood.get(namespace, current.revision, current.checksum);
            if (!r) throw new ConfigError('config.no_previous', `${namespace} has no earlier good revision to roll back to`, { status: 409 });
            return r.revision;
        }
        const rev = Number(to);
        const row = Number.isInteger(rev) ? await q.row.get(namespace, rev) : null;
        if (!row) throw new ConfigError('config.revision_not_found', `${namespace} has no revision ${to}`, { status: 404, revision: Number.isInteger(rev) ? rev : null });
        if (row.revision === current.revision) throw new ConfigError('config.already_active', `revision ${rev} is the active one`, { status: 409, revision: rev });
        if (!row.good) throw new ConfigError('config.not_good', `revision ${rev} never activated successfully (${row.state})`, { status: 409, revision: rev });
        return rev;
    }

    const store = {
        service,
        namespace,
        /** The active values over the defaults (frozen), or one of them. Never reads the database. */
        get(key) { const e = effectiveNow(); return key === undefined ? e : e[key]; },
        /** The active revision number, or null. */
        revision() { return current ? current.revision : null; },
        propose,
        activate(revision, o = {}) { return serialized(async () => await activateNow(Number(revision), { actor: o.actor })); },
        /** propose + activate, in turn with every other activation of this store. */
        apply(values, o = {}) { return serialized(async () => await activateNow((await propose(values, o)).revision, { actor: o.actor })); },
        /** A new revision copying the previous good one (or `to`), activated; the one it replaces becomes rolled_back. */
        rollback(o = {}) {
            return serialized(async () => {
                const actor = actorOf(o.actor);
                const target = await rollbackTarget(o.to);
                const values = JSON.parse((await q.row.get(namespace, target)).values_json);
                const row = await insertRow(values, { state: 'proposed', actor, reason: reasonOf(o.reason) || `rollback to revision ${target}`, previous: current.revision, copiedFrom: target });
                log.info(`${tag}: revision ${row.revision} rolls back to revision ${target} (by ${who(actor)})`);
                return await activateNow(row.revision, { actor, rollingBack: true });
            });
        },
        rollbackTarget,
        async lastKnownGood() { const r = await q.lastGood.get(namespace); return r ? toSnapshot(await q.row.get(namespace, r.revision)) : null; },
        async snapshot(revision) { const row = await q.row.get(namespace, Number(revision)); return row ? toSnapshot(row) : null; },
        async history({ limit = 20, before = null } = {}) {
            const n = Math.min(200, Math.max(1, Math.floor(Number(limit)) || 20));
            const b = before == null || before === '' ? Number.MAX_SAFE_INTEGER : Math.floor(Number(before));
            return (await q.history.all(namespace, Number.isFinite(b) ? b : Number.MAX_SAFE_INTEGER, n)).map(toSnapshot);
        },
        /** Keys whose effective value would change: for new values (+ merge/unset), or for a revision's. */
        async changes(values, o = {}) {
            const next = o.revision != null ? JSON.parse((await q.row.get(namespace, Number(o.revision)) || { values_json: '{}' }).values_json) : resolve(values, o);
            return changedKeys(effectiveNow(), { ...defaults, ...next });
        },
        /** What /api/admin/config shows: the active revision, its effective values redacted, and the last-known-good. */
        async summary() {
            const effective = effectiveNow();
            const classification = classesFor(effective, current ? current.classification : {});
            return {
                service, namespace,
                revision: current ? current.revision : null,
                values: redact(effective, classification),
                classification,
                active: current ? await store.snapshot(current.revision) : null,
                last_known_good: await store.lastKnownGood(),
            };
        },
        /** Seed revision 1 from a legacy source when the namespace has no revisions yet (else null). */
        import: importLegacy,
        /** Re-read the active revision (another process changed it). onActivate is not run. */
        async reload() {
            const row = await q.active.get(namespace);
            current = row ? load(row) : null;
            return store.revision();
        },
    };
    await boot();
    return store;
}

// ── /api/admin/config ───────────────────────────────────────────

const TITLES = { 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict', 413: 'Payload Too Large', 422: 'Unprocessable Content', 500: 'Internal Server Error' };

module.exports = { createPgConfigStore, configSchema };
