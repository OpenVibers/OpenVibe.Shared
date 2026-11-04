'use strict';
// openvibe-shared/config on PostgreSQL (ADR-035): the configuration store on an openvibe-sdk/db handle. Every
// method that reads or writes the database is async; get() and revision() stay in memory. createConfigStore picks this
// implementation when it is handed an openvibe-sdk/db handle, and then returns a promise of the store (it has read or
// seeded its active revision when it resolves). The tables come from
// the service's migrations: configSchema() is their DDL.
//
// Secret-class values are sealed (D11) when the store has a KEK: a random AES-256-GCM data key seals the value, a
// versioned KEK seals that data key, and values_json only ever holds the envelope. get() opens it for the service;
// summaries, snapshots, history and errors carry a keyed fingerprint marker only. x-bind adds the value of another
// key to the AAD, so changing that value locks the secret until it is entered again. Without a KEK nothing is sealed
// and the store behaves exactly as before, but reports sealed: false.
const crypto = require('crypto');
const { CLASSES, SERVICE_RE, NAMESPACE_RE, validKey, REASON_MAX, ERROR_MAX, ConfigError, canonical, sha256, isPlainObject, pointer, clone, same, has, deepFreeze, jsonErrors, isMarker, looksRedacted, sameHex, compileSchema, checkSchema, validateResult, subjectRef, scrub, errText, summarize, makeLog, fromRows,
    isEnvelope, parseEnvelope, sealEnvelope, openEnvelope, keksOf, hintOf, bindText, schemaAnnotations, summarySchema } = require('./config-core');

/** The DDL of config_snapshots and config_keys, for a service's migrations. */
function configSchema() {
    return `CREATE TABLE IF NOT EXISTS config_snapshots (
    namespace            text COLLATE "C" NOT NULL,
    revision             bigint NOT NULL,
    service              text COLLATE "C" NOT NULL,
    previous_revision    bigint,
    state                text COLLATE "C" NOT NULL CHECK (state IN ('proposed', 'active', 'superseded', 'rejected', 'rolled_back')),
    values_json          text COLLATE "C" NOT NULL,              -- the full values; secret-class values are envelopes (never their plaintext)
    classification_json  text COLLATE "C" NOT NULL,
    values_checksum      text COLLATE "C" NOT NULL,              -- sha256 of the values as served (secrets as markers)
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
    const { db, service, namespace, schema = null, validate = null, classify = null, onActivate = null, onChange = null } = opts;
    if (!db || typeof db.prepare !== 'function' || typeof db.tx !== 'function') throw new TypeError('createConfigStore: db must be an openvibe-sdk/db handle');
    if (!SERVICE_RE.test(String(service || ''))) throw new TypeError('createConfigStore: service must be a service id (live, media, …)');
    if (!NAMESPACE_RE.test(String(namespace || '')) || !namespace.startsWith(`${service}.`) || namespace.length > 120) {
        throw new TypeError(`createConfigStore: namespace must be <service>.<name>, e.g. ${service}.settings`);
    }
    const keks = keksOf(opts, opts.env || process.env);
    if (schema !== null) compileSchema(schema);
    if (validate !== null && typeof validate !== 'function') throw new TypeError('createConfigStore: validate must be a function');
    if (onActivate !== null && typeof onActivate !== 'function') throw new TypeError('createConfigStore: onActivate must be a function');
    if (onChange !== null && typeof onChange !== 'function') throw new TypeError('createConfigStore: onChange must be a function');
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
    const env = opts.env || process.env;

    // ── the schema's owner annotations: env pins, binds and danger keys ──
    const annotations = schemaAnnotations(schema);
    const binds = annotations.bind;
    const dangerKeys = new Set();
    if (schema && isPlainObject(schema.properties)) {
        for (const [k, p] of Object.entries(schema.properties)) {
            if (isPlainObject(p) && p['x-danger'] === true) dangerKeys.add(k);
            if (isPlainObject(p) && typeof p['x-bind'] === 'string' && classOf(p['x-bind'], undefined) === 'secret') throw new TypeError(`config schema: x-bind of ${k} names the secret key ${p['x-bind']}`);
        }
    }
    function envValue(prop, raw) {
        const types = prop && prop.type !== undefined ? [].concat(prop.type) : [];
        if (types.includes('boolean')) return raw === 'true' || raw === '1';
        if (types.includes('integer') || types.includes('number')) {
            const n = Number(String(raw).trim());
            return Number.isFinite(n) ? n : raw;
        }
        if (types.includes('array') || types.includes('object')) { try { return JSON.parse(raw); } catch { return raw; } }
        return raw;
    }
    const pins = {};
    for (const [k, name] of Object.entries(annotations.env)) {
        const raw = env ? env[name] : undefined;
        if (raw === undefined) continue;
        pins[k] = { env: name, value: envValue(schema && schema.properties && schema.properties[k], raw) };
    }
    const pinKeys = new Set(Object.keys(pins));
    const pinValues = () => Object.fromEntries(Object.entries(pins).map(([k, p]) => [k, clone(p.value)]));
    const emptyEffective = deepFreeze({ ...clone(defaults), ...pinValues() });

    // ── classification and redaction ──
    const RANK = { public: 0, internal: 1, secret: 2 };
    function classOf(key, value) {
        let c;
        try { c = typeof classify === 'function' ? classify(key, value) : (classify && has(classify, key) ? classify[key] : undefined); } catch { c = 'secret'; }
        if (c == null) return 'internal';
        if (!CLASSES.includes(c)) { log.warn(`${tag}: classify gave an invalid class for ${key}; treating it as secret`); return 'secret'; }
        return c;
    }
    /** An envelope is always secret-class; everything else is the policy's call. */
    const classOfValue = (k, v) => (isEnvelope(v) ? 'secret' : classOf(k, v));
    const classifyAll = (values) => Object.fromEntries(Object.keys(values).map((k) => [k, classOfValue(k, values[k])]));
    /** The stricter of what was stored and what the policy says now, so a key made secret later is redacted in old revisions too. */
    function classesFor(values, stored = {}) {
        const out = classifyAll(values);
        for (const k of Object.keys(out)) if (stored[k] && RANK[stored[k]] > RANK[out[k]]) out[k] = stored[k];
        return out;
    }
    /** The marker of a stored value: an envelope carries its fingerprint; plaintext is HMAC'd as before. */
    function markerOf(v) {
        const p = isEnvelope(v) ? parseEnvelope(v) : null;
        if (p) return { redacted: true, fingerprint: p.fingerprint };
        return { redacted: true, fingerprint: fingerprint(v) };
    }
    const redact = (values, cls) => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, cls[k] === 'secret' ? markerOf(v) : v]));
    /** The fingerprint a marker of this value has, whether the value is stored sealed or plain. */
    const storedFingerprint = (v) => (isEnvelope(v) ? parseEnvelope(v).fingerprint : fingerprint(v));
    function secretStrings(...valueSets) {
        const out = [];
        for (const values of valueSets) {
            if (!values) continue;
            for (const [k, v] of Object.entries(values)) {
                if (v == null || isEnvelope(v)) continue;
                if (classOf(k, v) !== 'secret') continue;
                out.push(typeof v === 'string' ? v : JSON.stringify(v));
            }
        }
        return out.sort((a, b) => b.length - a.length);
    }
    const plainStrings = (...valueSets) => {
        const out = [];
        for (const values of valueSets) {
            if (!values) continue;
            for (const v of Object.values(values)) if (v != null && !isEnvelope(v)) out.push(typeof v === 'string' ? v : JSON.stringify(v));
        }
        return out.sort((a, b) => b.length - a.length);
    };

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
        reseal: db.prepare('UPDATE config_snapshots SET values_json = ?, classification_json = ?, values_checksum = ? WHERE namespace = ? AND revision = ?'),
        all: db.prepare('SELECT * FROM config_snapshots WHERE namespace = ? ORDER BY revision'),
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

    /**
     * Open every envelope of a stored values object with the bind each key's x-bind names. A secret that does not
     * open (another bind, a missing KEK, a copied envelope) is locked: it stays a marker and never reaches get().
     */
    function materialize(stored) {
        const base = {};
        for (const [k, v] of Object.entries(stored)) if (!isEnvelope(v)) base[k] = v;
        const opened = {};
        const locked = new Set();
        const meta = {};
        const memo = new Map();
        function valueOf(key, seen) {
            if (pinKeys.has(key)) return clone(pins[key].value);
            if (memo.has(key)) return memo.get(key);
            if (has(opened, key)) return opened[key];
            if (has(base, key)) return base[key];
            if (has(stored, key)) {
                const r = openKey(key, seen);
                memo.set(key, r.value);
                return r.value;
            }
            if (has(defaults, key)) return defaults[key];
            return undefined;
        }
        function bindOf(key, seen) {
            const target = binds[key];
            if (!target) return '';
            return bindText(valueOf(target, new Set(seen)));
        }
        function openKey(key, seen) {
            if (!keks) throw Object.assign(new Error('no KEK is configured'), { code: 'config.secret_unreadable' });
            if (seen.has(key)) throw Object.assign(new Error('x-bind cycle'), { code: 'config.secret_unreadable' });
            const nextSeen = new Set(seen).add(key);
            const bind = bindOf(key, nextSeen);
            const { value, meta: m } = openEnvelope(stored[key], { service, namespace, key, bind, keys: keks.keys });
            return { value, meta: m };
        }
        for (const [k, v] of Object.entries(stored)) {
            if (!isEnvelope(v)) continue;
            try {
                const r = openKey(k, new Set());
                opened[k] = r.value;
                meta[k] = r.meta;
            } catch { locked.add(k); }
        }
        const effective = { ...clone(defaults), ...clone(base), ...clone(opened) };
        for (const [k, p] of Object.entries(pins)) effective[k] = clone(p.value);
        for (const k of locked) if (!pinKeys.has(k)) delete effective[k];
        return { opened, locked, effective, meta, stored };
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
    let current = null;   // { revision, checksum, stored, opened, locked, effective, classification }
    function load(row) {
        const stored = JSON.parse(row.values_json);
        const classification = classesFor(stored, JSON.parse(row.classification_json));
        const mat = materialize(stored);
        for (const k of mat.locked) log.warn(`${tag}: secret ${k} is set but does not open (it must be entered again for the current value)`);
        return {
            revision: row.revision,
            checksum: row.values_checksum,
            stored,
            values: stored,
            opened: mat.opened,
            locked: mat.locked,
            envelopeMeta: mat.meta,
            effective: deepFreeze(mat.effective),
            classification,
        };
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
        const mat = materialize(values);
        const skip = new Set([...mat.locked].map((k) => pointer(k)));
        if (schema !== null) checkSchema(schema, mat.effective, '', errors, skip);
        if (validate) {
            let r;
            try { r = validate(mat.effective); } catch (err) { r = [{ path: '', message: errText(err) }]; }
            if (r && typeof r.then === 'function') throw new TypeError('createConfigStore: validate must be synchronous (check asynchronously in onActivate)');
            errors.push(...validateResult(r));
        }
        const secrets = [...secretStrings(values, current && current.opened, current ? current.effective : emptyEffective), ...plainStrings(mat.opened)].sort((a, b) => b.length - a.length);
        return errors.map((e) => ({ path: e.path, message: scrub(e.message, secrets) }));
    }
    const invalid = (errors, revision) => new ConfigError('config.invalid', `invalid configuration: ${summarize(errors)}`.slice(0, ERROR_MAX), { status: 422, errors, revision });

    /** values (+ merge/unset) as the complete stored form a new revision would hold. A marker keeps the value it stands for. */
    function resolve(input, { merge = false, unset = [] } = {}) {
        if (!isPlainObject(input)) throw invalid([{ path: '', message: 'must be an object' }]);
        if (!Array.isArray(unset) || !unset.every((k) => typeof k === 'string')) throw invalid([{ path: '', message: 'unset must be a list of keys' }]);
        for (const k of [...Object.keys(input), ...unset]) {
            if (pinKeys.has(k)) throw new ConfigError('config.pinned_in_env', `${k} is pinned by ${pins[k].env} and is read-only`, { status: 409 });
        }
        const base = merge && current ? clone(current.stored) : {};
        const errors = [];
        for (const [k, v] of Object.entries(input)) {
            if (!validKey(k)) { errors.push({ path: pointer(k), message: 'is not a valid key (letters, digits, _ . : -; at most 128)' }); continue; }
            if (!isMarker(v)) { base[k] = v; continue; }
            if (current && has(current.stored, k) && sameHex(storedFingerprint(current.stored[k]), v.fingerprint)) base[k] = clone(current.stored[k]);
            else if (has(defaults, k) && sameHex(fingerprint(defaults[k]), v.fingerprint)) delete base[k];
            else errors.push({ path: pointer(k), message: 'is a redacted value that is not the current one; send the value itself' });
        }
        if (errors.length) throw invalid(errors);
        for (const k of unset) delete base[k];
        return base;
    }

    /** Seal the new plaintext secrets of a complete values object; envelopes already sealed are carried unchanged. */
    function sealValues(values) {
        const classification = classesFor(values, current ? current.classification : {});
        const mat = materialize(values);
        const out = {};
        for (const [k, v] of Object.entries(values)) {
            if (classification[k] !== 'secret' || !keks || isEnvelope(v)) { out[k] = v; continue; }
            const target = binds[k];
            let bindVal;
            if (target) {
                if (has(values, target) && isEnvelope(values[target])) throw new ConfigError('config.bind_secret', `the x-bind target of ${k} is secret-class`, { status: 422 });
                if (pinKeys.has(target)) bindVal = pins[target].value;
                else if (has(mat.effective, target)) bindVal = mat.effective[target];
                else if (has(defaults, target)) bindVal = defaults[target];
                if (bindVal !== undefined && classOfValue(target, bindVal) === 'secret') throw new ConfigError('config.bind_secret', `the x-bind target of ${k} is secret-class`, { status: 422 });
            }
            const bind = bindText(bindVal);
            out[k] = sealEnvelope({
                service, namespace, key: k, value: v, bind,
                fingerprint: fingerprint(v), hint: hintOf(v), kekId: keks.current, kek: keks.keys.get(keks.current),
            });
        }
        return { values: out, classification };
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
        const sealed = sealValues(values);
        const checksum = sha256(canonical(redact(sealed.values, sealed.classification)));
        let row;
        await tx(async () => {
            const revision = (await q.max.get(namespace)).n + 1;
            await q.insert.run({
                namespace, revision, service, previous_revision: previous, state,
                values_json: JSON.stringify(sealed.values), classification_json: JSON.stringify(sealed.classification),
                values_checksum: checksum, created_at: iso(), created_by: JSON.stringify(actor),
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

    async function notifyChange(keys, actor, revision) {
        if (!onChange) return;
        try { await onChange({ namespace, keys, actor, revision }); }
        catch (err) { log.warn(`${tag}: onChange failed: ${scrub(errText(err), [...secretStrings(current && current.values, current && current.effective), ...plainStrings(current && current.opened)])}`); }
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
                const message = scrub(`onActivate: ${errText(err)}`, [...secretStrings(next.values, prev && prev.values, next.effective, prev && prev.effective), ...plainStrings(next.opened, prev && prev.opened)]);
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
                        log.error(`${tag}: re-applying revision ${prev.revision} failed too: ${scrub(errText(again), [...secretStrings(next.values, prev.values, next.effective, prev.effective), ...plainStrings(next.opened, prev.opened)])}`);
                    }
                }
                throw new ConfigError('config.activation_failed', message, { status: 422, revision, cause: err });
            }
            await q.good.run(namespace, revision);
        }
        await notifyChange(changed, by, revision);
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
        log.info(`${tag}: revision ${row.revision} proposed by ${who(actor)}; changes ${listKeys(changedKeys(effectiveNow(), materialize(next).effective))}`);
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

    /** The marker of one secret-class key: the active revision's row, or an env pin / default that no row holds. */
    async function secretMarker(key) {
        const row = await q.active.get(namespace);
        const values = row ? JSON.parse(row.values_json) : {};
        let value;
        let fromRow = false;
        if (pinKeys.has(key)) value = pins[key].value;
        else if (has(values, key)) { value = values[key]; fromRow = true; }
        else if (has(defaults, key)) value = defaults[key];
        else return null;
        const classification = fromRow ? classesFor(values, JSON.parse(row.classification_json)) : { [key]: classOfValue(key, value) };
        if (classification[key] !== 'secret') return null;
        const envelope = isEnvelope(value) ? parseEnvelope(value) : null;
        const readable = !envelope && current && has(current.effective, key) ? current.effective[key] : undefined;
        const plain = readable !== undefined ? readable : value;
        const fp = envelope ? envelope.fingerprint : fingerprint(plain);
        let boundTo = envelope ? envelope.bind : null;
        if (!envelope) {
            const target = binds[key];
            const mat = materialize(values);
            const v = target && has(mat.effective, target) ? mat.effective[target] : undefined;
            boundTo = target && !(v !== undefined && classOfValue(target, v) === 'secret') ? bindText(v) : '';
        }
        const activatedAt = fromRow ? (row.activated_at || row.created_at) : null;
        const setBy = fromRow ? (row.activated_by ? JSON.parse(row.activated_by) : JSON.parse(row.created_by)) : null;
        return {
            redacted: true,
            fingerprint: fp,
            hint: envelope ? (envelope.hint || null) : hintOf(plain),
            set_at: activatedAt || null,
            set_by: setBy,
            bound_to: boundTo || null,
        };
    }

    async function resealNow() {
        if (!keks) throw new ConfigError('config.no_kek', 'reseal needs a KEK (opts.keks or OV_CONFIG_KEKS)', { status: 409 });
        const rows = await q.all.all(namespace);
        const report = { namespace, kek: keks.current, revisions: rows.length, resealed: 0, current: 0, plaintext: 0, locked: 0, errors: [] };
        const updates = [];
        for (const row of rows) {
            const values = JSON.parse(row.values_json);
            const storedCls = JSON.parse(row.classification_json);
            const cls = classesFor(values, storedCls);
            const mat = materialize(values);
            const next = {};
            let changed = false;
            for (const [k, v] of Object.entries(values)) {
                if (cls[k] !== 'secret') { next[k] = v; continue; }
                try {
                    if (isEnvelope(v)) {
                        const p = parseEnvelope(v);
                        if (p && p.kekId === keks.current) { next[k] = v; report.current++; continue; }
                        const target = binds[k];
                        const bind = bindText(target && has(mat.effective, target) ? mat.effective[target] : undefined);
                        const { value } = openEnvelope(v, { service, namespace, key: k, bind, keys: keks.keys });
                        next[k] = sealEnvelope({
                            service, namespace, key: k, value, bind,
                            fingerprint: (p && p.fingerprint) || fingerprint(value), hint: (p && p.hint) || hintOf(value),
                            kekId: keks.current, kek: keks.keys.get(keks.current),
                        });
                        changed = true;
                        report.resealed++;
                    } else {
                        const target = binds[k];
                        const bindVal = target ? (pinKeys.has(target) ? pins[target].value : mat.effective[target]) : undefined;
                        if (target && has(values, target) && isEnvelope(values[target])) throw new ConfigError('config.bind_secret', `the x-bind target of ${k} is secret-class`, { status: 422 });
                        if (target && bindVal !== undefined && classOfValue(target, bindVal) === 'secret') throw new ConfigError('config.bind_secret', `the x-bind target of ${k} is secret-class`, { status: 422 });
                        const bind = bindText(bindVal);
                        next[k] = sealEnvelope({
                            service, namespace, key: k, value: v, bind,
                            fingerprint: fingerprint(v), hint: hintOf(v), kekId: keks.current, kek: keks.keys.get(keks.current),
                        });
                        changed = true;
                        report.plaintext++;
                    }
                } catch (err) {
                    next[k] = v;
                    report.locked++;
                    report.errors.push({ revision: row.revision, key: k, reason: scrub(errText(err)) });
                }
            }
            const nextJson = JSON.stringify(next);
            const clsJson = JSON.stringify(cls);
            if (changed || nextJson !== row.values_json || clsJson !== row.classification_json) {
                updates.push({ revision: row.revision, values_json: nextJson, classification_json: clsJson, values_checksum: sha256(canonical(redact(next, cls))) });
            }
        }
        if (updates.length) {
            await tx(async () => {
                for (const u of updates) await q.reseal.run(u.values_json, u.classification_json, u.values_checksum, namespace, u.revision);
            });
        }
        if (current) current = load(await q.row.get(namespace, current.revision));
        if (report.locked) log.warn(`${tag}: reseal left ${report.locked} secret(s) locked (${report.errors.slice(0, 3).map((e) => `${e.key}@${e.revision}`).join(', ')})`);
        log.info(`${tag}: reseal to ${keks.current}: ${report.resealed} under an old KEK, ${report.plaintext} plaintext, ${report.current} current, ${report.locked} locked`);
        return report;
    }

    /** The summary's schema: a clone whose secret-class properties never carry a default, examples, enum or const. */
    function schemaForSummary() {
        const isSecret = (k) => {
            if (current && current.classification[k] === 'secret') return true;
            if (pinKeys.has(k) && classOf(k, pins[k].value) === 'secret') return true;
            if (classOf(k, undefined) === 'secret') return true;
            const p = schema && schema.properties && schema.properties[k];
            return !!(isPlainObject(p) && has(p, 'default') && classOf(k, p.default) === 'secret');
        };
        return summarySchema(schema, isSecret);
    }

    const store = {
        service,
        namespace,
        /** Whether secret-class values are sealed with a KEK (D11). */
        get sealed() { return !!keks; },
        /** The current KEK id, or null when unsealed. */
        get kek() { return keks ? keks.current : null; },
        /** The active values over the defaults and env pins (frozen), or one of them. Never reads the database. */
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
            if (o.revision != null) {
                const row = await q.row.get(namespace, Number(o.revision));
                const stored = row ? JSON.parse(row.values_json) : {};
                return changedKeys(effectiveNow(), materialize(stored).effective);
            }
            const next = resolve(values, o);
            return changedKeys(effectiveNow(), materialize(next).effective);
        },
        /** The classification a change would give its keys (the active one for keys it removes). */
        async classes(values, o = {}) {
            let next;
            if (o.revision != null) {
                const row = await q.row.get(namespace, Number(o.revision));
                next = row ? JSON.parse(row.values_json) : {};
            } else next = resolve(values, o);
            const out = classesFor(next, current ? current.classification : {});
            if (current) for (const k of Object.keys(current.classification)) if (!has(out, k)) out[k] = current.classification[k];
            return out;
        },
        isDanger(key) { return dangerKeys.has(key); },
        isPinned(key) { return pinKeys.has(key); },
        /** The classification policy for one value (an envelope is secret). */
        classify(key, value) { return classOfValue(key, value); },
        /** The marker of one secret-class key of the active revision, or null. */
        secretMarker,
        /** Write one secret through the write-only path: a new revision holding its envelope. Returns the marker. */
        setSecret(key, value, o = {}) {
            return serialized(async () => {
                if (typeof key !== 'string' || !validKey(key)) throw invalid([{ path: pointer(key), message: 'is not a valid key (letters, digits, _ . : -; at most 128)' }]);
                if (pinKeys.has(key)) throw new ConfigError('config.pinned_in_env', `${key} is pinned by ${pins[key].env} and is read-only`, { status: 409 });
                if (classOfValue(key, value) !== 'secret') throw new ConfigError('config.not_secret', `${key} is not a secret-class key`, { status: 422 });
                if (value === undefined) throw invalid([{ path: pointer(key), message: 'is required' }]);
                if (looksRedacted(value)) throw invalid([{ path: pointer(key), message: 'a secret value cannot be a redaction marker' }]);
                const actor = actorOf(o.actor);
                const next = current ? clone(current.stored) : {};
                next[key] = value;
                const errors = problems(next);
                if (errors.length) throw invalid(errors);
                const row = await insertRow(next, { state: 'proposed', actor, reason: reasonOf(o.reason) || 'secret set', previous: current ? current.revision : null });
                await activateNow(row.revision, { actor });
                return await secretMarker(key);
            });
        },
        /** Remove one secret through the write-only path. Returns the marker of the removed (empty) state. */
        deleteSecret(key, o = {}) {
            return serialized(async () => {
                if (typeof key !== 'string' || !validKey(key)) throw invalid([{ path: pointer(key), message: 'is not a valid key (letters, digits, _ . : -; at most 128)' }]);
                if (pinKeys.has(key)) throw new ConfigError('config.pinned_in_env', `${key} is pinned by ${pins[key].env} and is read-only`, { status: 409 });
                if (!current || !has(current.stored, key)) throw new ConfigError('config.secret_not_set', `${key} is not set`, { status: 404 });
                if (current.classification[key] !== 'secret') throw new ConfigError('config.not_secret', `${key} is not a secret-class key`, { status: 422 });
                const actor = actorOf(o.actor);
                const next = clone(current.stored);
                delete next[key];
                const errors = problems(next);
                if (errors.length) throw invalid(errors);
                const row = await insertRow(next, { state: 'proposed', actor, reason: reasonOf(o.reason) || 'secret deleted', previous: current.revision });
                await activateNow(row.revision, { actor });
                return { redacted: true, fingerprint: null, hint: null, set_at: null, set_by: actor, bound_to: null };
            });
        },
        /** Move every plaintext secret and every envelope under an older KEK to the current KEK, revision by revision. */
        reseal() { return serialized(resealNow); },
        /** What /api/admin/config shows: the active revision, its effective values redacted, the schema, pins and state. */
        async summary() {
            const values = {};
            for (const [k, v] of Object.entries(current ? current.stored : {})) values[k] = clone(v);
            for (const k of Object.keys(defaults)) if (!has(values, k)) values[k] = clone(defaults[k]);
            for (const [k, p] of Object.entries(pins)) values[k] = clone(p.value);
            const classification = classesFor(values, current ? current.classification : {});
            const shown = redact(values, classification);
            const secrets = {};
            for (const k of Object.keys(classification)) {
                if (classification[k] !== 'secret' || !has(values, k)) continue;
                const m = await store.secretMarker(k);
                if (m) secrets[k] = m;
            }
            return {
                service, namespace,
                revision: current ? current.revision : null,
                values: shown,
                classification,
                sealed: !!keks,
                kek: keks ? keks.current : null,
                pins: Object.fromEntries(Object.entries(pins).map(([k, p]) => [k, { env: p.env, pinned: true }])),
                secrets,
                schema: schemaForSummary(),
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
