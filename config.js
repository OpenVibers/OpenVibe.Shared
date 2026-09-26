'use strict';
// ═══════════════════════════════════════════════════════════════
// openvibe-shared/config — the configuration model (roadmap WS-C task 7). One namespace of a
// service's configuration kept as immutable revisions (common.config-snapshot@1) in the service's
// own SQLite database: validated, classified, activated atomically, with the last-known-good
// revision retained and restored when an activation fails.
//
//   const config = require('openvibe-shared/config');
//   const tiering = config.createConfigStore({
//       db,                                    // the service's better-sqlite3 handle
//       service: 'media', namespace: 'media.storage_tier',
//       schema: { type: 'object', additionalProperties: false, properties: { minAgeDays: { type: 'integer', minimum: 0 } } },
//       validate: (values) => values.minFreeGb < values.targetFreeGb || 'minFreeGb must be below targetFreeGb',
//       classify: { b2_secret: 'secret' },     // or (key, value) => 'public' | 'internal' | 'secret'
//       defaults: DEFAULTS,                    // revision 1 of a new namespace; also under every revision
//       legacy: () => config.fromRows(rows, { prefix: 'storage_tier.', type: 'json' }),  // revision 1 instead
//       onActivate: async (values, previous) => { restartSweep(values); },
//   });
//   tiering.get('minAgeDays');                 // in memory, never a DB read
//   await tiering.apply({ minAgeDays: 3 }, { merge: true, actor: { type: 'user', id: 'usr_…' }, reason: '…' });
//   await tiering.rollback({ actor, reason });
//   config.adminRoutes([tiering], { requireAdmin }).mount(app);   // /api/admin/config…
//
// A revision's values never change. Its state moves proposed -> active -> superseded | rolled_back,
// or proposed -> rejected. activate() switches the active revision in one transaction, then runs
// onActivate(values, previous); when that throws, the previous revision is active again (in memory
// and in the database), the new one is rejected with the error, onActivate runs once more with the
// restored values ({ restoring: true }), and the error is thrown. get() is the defaults overlaid
// with the active revision's values. A secret-class value stays in the row (so it can be activated
// again) but leaves only as { redacted: true, fingerprint }: an HMAC-SHA256 under a random 32-byte
// key kept per namespace in config_keys, which never leaves the database and is never logged. Equal
// fingerprints in one namespace mean an unchanged value; without the key nothing can be guessed. A
// snapshot's checksum is the sha256 of its values as shown, so it reveals nothing more either.
// ═══════════════════════════════════════════════════════════════

const crypto = require('crypto');

const CLASSES = ['public', 'internal', 'secret'];
const SERVICE_RE = /^[a-z][a-z0-9-]{1,39}$/;
const NAMESPACE_RE = /^[a-z][a-z0-9-]{1,39}(\.[a-z0-9_-]+)+$/;
const KEY_RE = /^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,127}$/;
const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);
const validKey = (k) => KEY_RE.test(k) && !RESERVED.has(k);
const SUBJECT_ID = {
    user: /^usr_[0-9A-HJKMNP-TV-Z]{26}$/, guest: /^gst_[0-9A-HJKMNP-TV-Z]{26}$/,
    app: /^app_[0-9A-HJKMNP-TV-Z]{26}$/, mod: /^mod_[0-9A-HJKMNP-TV-Z]{26}$/,
    service: SERVICE_RE, system: SERVICE_RE,
};
const PREFIXED = { usr_: 'user', gst_: 'guest', app_: 'app', mod_: 'mod' };
const REASON_MAX = 500;
const ERROR_MAX = 2000;

class ConfigError extends Error {
    constructor(code, message, { status = 400, errors = null, revision = null, cause } = {}) {
        super(message, cause === undefined ? undefined : { cause });
        this.name = 'ConfigError';
        this.code = code;
        this.status = status;
        if (errors) this.errors = errors;
        if (revision != null) this.revision = revision;
    }
}

// ── JSON helpers ────────────────────────────────────────────────

/** Canonical JSON: object keys sorted at every depth, no whitespace. */
function canonical(v) {
    if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
    if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
    return JSON.stringify(v);
}
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));
const pointer = (k) => `/${String(k).replace(/~/g, '~0').replace(/\//g, '~1')}`;
const clone = (v) => JSON.parse(JSON.stringify(v));
const same = (a, b) => canonical(a) === canonical(b);
const has = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);

function deepFreeze(v) {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); for (const x of Object.values(v)) deepFreeze(x); }
    return v;
}

/** Only what JSON keeps as it is: no undefined, functions, NaN/Infinity, Dates or class instances. */
function jsonErrors(v, path, errors, depth = 0) {
    if (depth > 32) { errors.push({ path, message: 'is nested too deeply' }); return; }
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
    if (typeof v === 'number') { if (!Number.isFinite(v)) errors.push({ path, message: 'must be a finite number' }); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => jsonErrors(x, `${path}/${i}`, errors, depth + 1)); return; }
    if (isPlainObject(v)) { for (const [k, x] of Object.entries(v)) jsonErrors(x, `${path}${pointer(k)}`, errors, depth + 1); return; }
    errors.push({ path, message: 'is not a JSON value' });
}

const isMarker = (v) => isPlainObject(v) && v.redacted === true && Object.keys(v).length === 2 && typeof v.fingerprint === 'string';
/** An object with a redacted member is reserved for markers (common.config-snapshot@1). */
const looksRedacted = (v) => isPlainObject(v) && has(v, 'redacted');
const sameHex = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// ── A small JSON Schema subset ──────────────────────────────────
// type, enum, const, properties, required, additionalProperties, min/maxProperties, items,
// min/maxItems, uniqueItems, min/maxLength, pattern, minimum, maximum, exclusiveMinimum/Maximum,
// multipleOf. Annotations (title, description, default, format, x-…) are ignored. Anything else
// throws when the store is created, so a schema is never silently checked less than it says.

const KEYWORDS = new Set(['type', 'enum', 'const', 'properties', 'required', 'additionalProperties', 'minProperties', 'maxProperties',
    'items', 'minItems', 'maxItems', 'uniqueItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum',
    'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf']);
const ANNOTATIONS = new Set(['$schema', '$id', '$comment', 'title', 'description', 'default', 'examples', 'deprecated', 'readOnly', 'writeOnly', 'format']);
const TYPES = ['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'];
const patterns = new WeakMap();

function compileSchema(s, at = '#') {
    if (typeof s === 'boolean') return;
    if (!isPlainObject(s)) throw new TypeError(`config schema ${at}: must be an object or a boolean`);
    for (const k of Object.keys(s)) {
        if (!KEYWORDS.has(k) && !ANNOTATIONS.has(k) && !k.startsWith('x-')) throw new TypeError(`config schema ${at}: unsupported keyword "${k}"`);
    }
    if (s.type !== undefined && ![].concat(s.type).every((t) => TYPES.includes(t))) throw new TypeError(`config schema ${at}: unknown type`);
    if (s.pattern !== undefined) patterns.set(s, new RegExp(s.pattern, 'u'));
    if (s.properties) for (const [k, sub] of Object.entries(s.properties)) compileSchema(sub, `${at}/properties/${k}`);
    if (s.additionalProperties !== undefined) compileSchema(s.additionalProperties, `${at}/additionalProperties`);
    if (s.items !== undefined) compileSchema(s.items, `${at}/items`);
}

function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
}
function isType(v, t) {
    if (t === 'integer') return Number.isInteger(v);
    if (t === 'number') return typeof v === 'number' && Number.isFinite(v);
    return typeOf(v) === t;
}

/** Messages name the rule, never the value (a value may be a secret). */
function checkSchema(s, v, path, errors) {
    if (s === true || s === undefined) return;
    if (s === false) { errors.push({ path, message: 'is not allowed' }); return; }
    if (s.type !== undefined) {
        const types = [].concat(s.type);
        if (!types.some((t) => isType(v, t))) { errors.push({ path, message: `must be ${types.join(' or ')}` }); return; }
    }
    if (s.enum !== undefined && !s.enum.some((e) => same(e, v))) errors.push({ path, message: `must be one of ${s.enum.map((e) => JSON.stringify(e)).join(', ')}` });
    if (s.const !== undefined && !same(s.const, v)) errors.push({ path, message: 'must equal the constant' });
    if (typeof v === 'number') {
        if (s.minimum !== undefined && v < s.minimum) errors.push({ path, message: `must be >= ${s.minimum}` });
        if (s.maximum !== undefined && v > s.maximum) errors.push({ path, message: `must be <= ${s.maximum}` });
        if (s.exclusiveMinimum !== undefined && v <= s.exclusiveMinimum) errors.push({ path, message: `must be > ${s.exclusiveMinimum}` });
        if (s.exclusiveMaximum !== undefined && v >= s.exclusiveMaximum) errors.push({ path, message: `must be < ${s.exclusiveMaximum}` });
        if (s.multipleOf !== undefined && Math.abs(v / s.multipleOf - Math.round(v / s.multipleOf)) > 1e-9) errors.push({ path, message: `must be a multiple of ${s.multipleOf}` });
    }
    if (typeof v === 'string') {
        const len = [...v].length;
        if (s.minLength !== undefined && len < s.minLength) errors.push({ path, message: `must be at least ${s.minLength} characters` });
        if (s.maxLength !== undefined && len > s.maxLength) errors.push({ path, message: `must be at most ${s.maxLength} characters` });
        if (s.pattern !== undefined && !(patterns.get(s) || new RegExp(s.pattern, 'u')).test(v)) errors.push({ path, message: `must match ${s.pattern}` });
    }
    if (Array.isArray(v)) {
        if (s.minItems !== undefined && v.length < s.minItems) errors.push({ path, message: `must have at least ${s.minItems} items` });
        if (s.maxItems !== undefined && v.length > s.maxItems) errors.push({ path, message: `must have at most ${s.maxItems} items` });
        if (s.uniqueItems && new Set(v.map(canonical)).size !== v.length) errors.push({ path, message: 'must not repeat items' });
        if (s.items !== undefined) v.forEach((x, i) => checkSchema(s.items, x, `${path}/${i}`, errors));
    }
    if (isPlainObject(v)) {
        const keys = Object.keys(v);
        for (const r of s.required || []) if (!has(v, r)) errors.push({ path: `${path}${pointer(r)}`, message: 'is required' });
        if (s.minProperties !== undefined && keys.length < s.minProperties) errors.push({ path, message: `must have at least ${s.minProperties} keys` });
        if (s.maxProperties !== undefined && keys.length > s.maxProperties) errors.push({ path, message: `must have at most ${s.maxProperties} keys` });
        for (const k of keys) {
            if (s.properties && has(s.properties, k)) checkSchema(s.properties[k], v[k], `${path}${pointer(k)}`, errors);
            else if (s.additionalProperties === false) errors.push({ path: `${path}${pointer(k)}`, message: 'is not a known key' });
            else if (s.additionalProperties !== undefined) checkSchema(s.additionalProperties, v[k], `${path}${pointer(k)}`, errors);
        }
    }
}

/** validate(values) may return true/undefined, false, a message, a list, or { valid, errors } (Ajv/contracts style). */
function validateResult(r) {
    const norm = (e) => (typeof e === 'string' ? { path: '', message: e } : { path: String(e.path ?? e.instancePath ?? ''), message: String((e && e.message) || 'is invalid') });
    if (r === true || r == null) return [];
    if (r === false) return [{ path: '', message: 'rejected by validate()' }];
    if (typeof r === 'string') return [{ path: '', message: r }];
    if (Array.isArray(r)) return r.map(norm);
    if (typeof r === 'object') {
        if (r.valid === false || (Array.isArray(r.errors) && r.errors.length)) return (r.errors && r.errors.length ? r.errors : ['is invalid']).map(norm);
        return [];
    }
    return [{ path: '', message: 'rejected by validate()' }];
}

// ── Subjects and text ───────────────────────────────────────────

/** A common subject reference ({ type, id }), or a prefixed id string (usr_…, gst_…, app_…, mod_…). */
function subjectRef(actor) {
    if (typeof actor === 'string') {
        const type = PREFIXED[actor.slice(0, 4)];
        if (type && SUBJECT_ID[type].test(actor)) return { type, id: actor };
        return null;
    }
    if (actor && typeof actor === 'object' && SUBJECT_ID[actor.type] && typeof actor.id === 'string' && SUBJECT_ID[actor.type].test(actor.id)) {
        return { type: actor.type, id: actor.id };
    }
    return null;
}

/** One line, no credentials in URLs or key=value pairs, and never any of the given secret values. */
function scrub(text, secrets = []) {
    let s = String(text == null ? '' : text).split('\n')[0];
    for (const x of secrets) if (x.length >= 4) s = s.split(x).join('[redacted]');
    s = s.replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^/@\s]*@/gi, '$1')
        .replace(/\b(key|token|secret|password|signature)=[^\s&]+/gi, '$1=…');
    return s.slice(0, ERROR_MAX) || 'failed';
}

const errText = (err) => (err instanceof Error ? err.message : String(err));
const summarize = (errors) => errors.map((e) => (e.path ? `${e.path} ${e.message}` : e.message)).join('; ');

function makeLog(log) {
    const noop = () => {};
    if (log === false || log === null) return { info: noop, warn: noop, error: noop };
    if (typeof log === 'function') return { info: (m) => log(m, 'info'), warn: (m) => log(m, 'warn'), error: (m) => log(m, 'error') };
    const l = log || console;
    return { info: (m) => (l.info || l.log || noop).call(l, m), warn: (m) => (l.warn || l.log || noop).call(l, m), error: (m) => (l.error || l.warn || noop).call(l, m) };
}

// ── Storage ─────────────────────────────────────────────────────

function ensureTables(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS config_snapshots (
            namespace TEXT NOT NULL,
            revision INTEGER NOT NULL,
            service TEXT NOT NULL,
            previous_revision INTEGER,
            state TEXT NOT NULL CHECK (state IN ('proposed', 'active', 'superseded', 'rejected', 'rolled_back')),
            values_json TEXT NOT NULL,              -- the full values, secrets included (never served)
            classification_json TEXT NOT NULL,
            values_checksum TEXT NOT NULL,          -- sha256 of the full values: internal, never served
            created_at TEXT NOT NULL,
            created_by TEXT NOT NULL,
            activated_at TEXT,
            activated_by TEXT,
            reason TEXT,
            error TEXT,
            copied_from INTEGER,
            good INTEGER NOT NULL DEFAULT 0,        -- 1 once it activated successfully (last-known-good)
            PRIMARY KEY (namespace, revision)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS config_snapshots_one_active ON config_snapshots (namespace) WHERE state = 'active';
        -- The fingerprint key of each namespace. Never served, never logged.
        CREATE TABLE IF NOT EXISTS config_keys (
            namespace TEXT PRIMARY KEY,
            hmac_key BLOB NOT NULL,
            created_at TEXT NOT NULL
        );
    `);
}

/**
 * Typed key-value rows ({ key, value, type }, as site_settings/media_settings keep them) as a values
 * object: number, boolean ('true'), json (parsed; the raw text if it does not parse), anything else
 * a string. `prefix` keeps only the keys that start with it and strips it; `type` forces one type.
 */
function fromRows(rows, { prefix = '', type = null } = {}) {
    const out = {};
    for (const r of rows || []) {
        if (!r || typeof r.key !== 'string' || !r.key.startsWith(prefix) || RESERVED.has(r.key.slice(prefix.length))) continue;
        const raw = r.value == null ? '' : String(r.value);
        const t = type || r.type || 'string';
        let v = raw;
        if (t === 'number') v = raw.trim() === '' ? null : Number(raw);
        else if (t === 'boolean') v = raw === 'true';
        else if (t === 'json') { try { v = JSON.parse(raw); } catch { v = raw; } }
        if (typeof v === 'number' && !Number.isFinite(v)) v = raw;
        out[r.key.slice(prefix.length)] = v;
    }
    return out;
}

// ── The store ───────────────────────────────────────────────────

function createConfigStore(opts = {}) {
    const { db, service, namespace, schema = null, validate = null, classify = null, onActivate = null } = opts;
    if (!db || typeof db.prepare !== 'function' || typeof db.transaction !== 'function') throw new TypeError('createConfigStore: db must be a better-sqlite3 handle');
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

    ensureTables(db);
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
    const tx = (fn) => db.transaction(fn).immediate();

    // ── the namespace's fingerprint key: made on first use, then read (a racing process keeps the first) ──
    const hmacKey = (() => {
        const read = db.prepare('SELECT hmac_key FROM config_keys WHERE namespace = ?');
        let row = read.get(namespace);
        if (!row) {
            db.prepare('INSERT OR IGNORE INTO config_keys (namespace, hmac_key, created_at) VALUES (?, ?, ?)').run(namespace, crypto.randomBytes(32), iso());
            row = read.get(namespace);
        }
        const k = row && Buffer.isBuffer(row.hmac_key) ? Buffer.from(row.hmac_key) : null;
        if (!k || k.length < 32) throw new Error(`createConfigStore: the fingerprint key of ${namespace} in config_keys is not a 32-byte key`);
        return k;
    })();
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

    function insertRow(values, { state, actor, reason, previous, copiedFrom = null, activatedAt = null, good = 0 }) {
        let row;
        tx(() => {
            const revision = q.max.get(namespace).n + 1;
            q.insert.run({
                namespace, revision, service, previous_revision: previous, state,
                values_json: JSON.stringify(values), classification_json: JSON.stringify(classifyAll(values)),
                values_checksum: sha256(canonical(values)), created_at: iso(), created_by: JSON.stringify(actor),
                activated_at: activatedAt, activated_by: activatedAt ? JSON.stringify(actor) : null,
                reason, copied_from: copiedFrom, good,
            });
            row = q.row.get(namespace, revision);
        });
        return row;
    }

    function prune() {
        const cutoff = q.max.get(namespace).n - keep;
        if (cutoff < 1) return;
        const good = q.lastGood.get(namespace);
        q.prune.run(namespace, cutoff, good ? good.revision : -1);
    }

    // ── boot: load the active revision, recover an interrupted activation, or seed revision 1 ──
    function seed(values, reason, { strict }) {
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
        const row = insertRow(clone(values), { state: 'active', actor: self, reason, previous: null, activatedAt: iso(), good: 1 });
        current = load(row);
        log.info(`${tag}: revision ${row.revision} ${reason} (${Object.keys(values).length} keys)`);
        return toSnapshot(row);
    }

    function importLegacy(legacy, { reason = 'imported from the legacy source' } = {}) {
        if (q.any.get(namespace)) return null;
        let v = typeof legacy === 'function' ? legacy() : legacy;
        if (Array.isArray(v)) v = fromRows(v);
        if (v == null) return null;
        if (!isPlainObject(v)) throw new TypeError('import: legacy must give an object or key-value rows');
        return seed(v, reasonOf(reason) || 'imported from the legacy source', { strict: false });
    }

    (function boot() {
        let row = q.active.get(namespace);
        if (row && !row.good) {
            // The process stopped between the switch and the end of onActivate: that revision never
            // proved itself, so the last-known-good one is active again.
            const good = q.lastGood.get(namespace);
            tx(() => {
                q.reject.run('activation interrupted: the service stopped before onActivate finished', namespace, row.revision);
                if (good) q.setState.run('active', namespace, good.revision);
            });
            log.warn(`${tag}: revision ${row.revision} was interrupted while activating; ${good ? `revision ${good.revision} restored` : 'no earlier revision to restore'}`);
            row = good ? q.row.get(namespace, good.revision) : null;
        }
        if (row) {
            current = load(row);
            const errors = problems(current.values);
            if (errors.length) log.warn(`${tag}: active revision ${row.revision} does not validate under this release (${summarize(errors).slice(0, 300)}); serving it as it is`);
            return;
        }
        if (q.any.get(namespace)) return;
        if (opts.legacy !== undefined && importLegacy(opts.legacy)) return;
        if (opts.defaults != null) seed(defaults, 'seeded from defaults', { strict: true });
    })();

    // ── activation (serialized per store) ──
    let queue = Promise.resolve();
    function serialized(fn) {
        const run = queue.then(fn, fn);
        queue = run.catch(() => {});
        return run;
    }

    async function activateNow(revision, { actor, rollingBack = false } = {}) {
        const by = actorOf(actor);
        const row = q.row.get(namespace, revision);
        if (!row) throw new ConfigError('config.revision_not_found', `${namespace} has no revision ${revision}`, { status: 404, revision });
        if (row.state !== 'proposed') throw new ConfigError('config.not_proposed', `revision ${revision} is ${row.state}, not proposed`, { status: 409, revision });
        const values = JSON.parse(row.values_json);
        const errors = problems(values);
        if (errors.length) {
            q.reject.run(summarize(errors).slice(0, ERROR_MAX), namespace, revision);
            log.warn(`${tag}: revision ${revision} rejected: ${summarize(errors).slice(0, 300)}`);
            throw invalid(errors, revision);
        }
        const prev = current;
        const at = iso();
        tx(() => {
            const dbActive = q.active.get(namespace);
            const activeRev = dbActive ? dbActive.revision : null;
            if ((row.previous_revision == null ? null : row.previous_revision) !== activeRev) {
                throw new ConfigError('config.stale', `revision ${revision} was proposed on ${row.previous_revision ? `revision ${row.previous_revision}` : 'an empty namespace'}, but ${activeRev ? `revision ${activeRev}` : 'nothing'} is active now; propose it again`, { status: 409, revision });
            }
            if (dbActive) q.setState.run(rollingBack ? 'rolled_back' : 'superseded', namespace, dbActive.revision);
            q.activate.run(at, JSON.stringify(by), onActivate ? 0 : 1, namespace, revision);
        });
        current = load(q.row.get(namespace, revision));
        const changed = changedKeys(prev ? prev.effective : emptyEffective, current.effective);
        if (onActivate) {
            const next = current;
            try {
                await onActivate(next.effective, prev ? prev.effective : null, { namespace, revision, previous_revision: prev ? prev.revision : null, restoring: false });
            } catch (err) {
                const message = scrub(`onActivate: ${errText(err)}`, secretStrings(next.values, prev && prev.values));
                tx(() => {
                    q.reject.run(message, namespace, revision);
                    if (prev) q.setState.run('active', namespace, prev.revision);
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
            q.good.run(namespace, revision);
        }
        prune();
        log.info(`${tag}: revision ${revision} active${prev ? ` (was ${prev.revision})` : ''} by ${who(by)}; changed ${listKeys(changed)}`);
        return toSnapshot(q.row.get(namespace, revision));
    }

    function propose(values, o = {}) {
        const actor = actorOf(o.actor);
        const reason = reasonOf(o.reason);
        const next = resolve(values, o);
        const errors = problems(next);
        if (errors.length) throw invalid(errors);
        const row = insertRow(next, { state: 'proposed', actor, reason, previous: current ? current.revision : null });
        prune();
        log.info(`${tag}: revision ${row.revision} proposed by ${who(actor)}; changes ${listKeys(changedKeys(effectiveNow(), { ...defaults, ...next }))}`);
        return toSnapshot(row);
    }

    function rollbackTarget(to) {
        if (!current) throw new ConfigError('config.nothing_active', `${namespace} has no active revision to roll back`, { status: 409 });
        if (to == null) {
            const r = q.previousGood.get(namespace, current.revision, current.checksum);
            if (!r) throw new ConfigError('config.no_previous', `${namespace} has no earlier good revision to roll back to`, { status: 409 });
            return r.revision;
        }
        const rev = Number(to);
        const row = Number.isInteger(rev) ? q.row.get(namespace, rev) : null;
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
        activate(revision, o = {}) { return serialized(() => activateNow(Number(revision), { actor: o.actor })); },
        /** propose + activate, in turn with every other activation of this store. */
        apply(values, o = {}) { return serialized(() => activateNow(propose(values, o).revision, { actor: o.actor })); },
        /** A new revision copying the previous good one (or `to`), activated; the one it replaces becomes rolled_back. */
        rollback(o = {}) {
            return serialized(() => {
                const actor = actorOf(o.actor);
                const target = rollbackTarget(o.to);
                const values = JSON.parse(q.row.get(namespace, target).values_json);
                const row = insertRow(values, { state: 'proposed', actor, reason: reasonOf(o.reason) || `rollback to revision ${target}`, previous: current.revision, copiedFrom: target });
                log.info(`${tag}: revision ${row.revision} rolls back to revision ${target} (by ${who(actor)})`);
                return activateNow(row.revision, { actor, rollingBack: true });
            });
        },
        rollbackTarget,
        lastKnownGood() { const r = q.lastGood.get(namespace); return r ? toSnapshot(q.row.get(namespace, r.revision)) : null; },
        snapshot(revision) { const row = q.row.get(namespace, Number(revision)); return row ? toSnapshot(row) : null; },
        history({ limit = 20, before = null } = {}) {
            const n = Math.min(200, Math.max(1, Math.floor(Number(limit)) || 20));
            const b = before == null || before === '' ? Number.MAX_SAFE_INTEGER : Math.floor(Number(before));
            return q.history.all(namespace, Number.isFinite(b) ? b : Number.MAX_SAFE_INTEGER, n).map(toSnapshot);
        },
        /** Keys whose effective value would change: for new values (+ merge/unset), or for a revision's. */
        changes(values, o = {}) {
            const next = o.revision != null ? JSON.parse((q.row.get(namespace, Number(o.revision)) || { values_json: '{}' }).values_json) : resolve(values, o);
            return changedKeys(effectiveNow(), { ...defaults, ...next });
        },
        /** What /api/admin/config shows: the active revision, its effective values redacted, and the last-known-good. */
        summary() {
            const effective = effectiveNow();
            const classification = classesFor(effective, current ? current.classification : {});
            return {
                service, namespace,
                revision: current ? current.revision : null,
                values: redact(effective, classification),
                classification,
                active: current ? store.snapshot(current.revision) : null,
                last_known_good: store.lastKnownGood(),
            };
        },
        /** Seed revision 1 from a legacy source when the namespace has no revisions yet (else null). */
        import: importLegacy,
        /** Re-read the active revision (another process changed it). onActivate is not run. */
        reload() {
            const row = q.active.get(namespace);
            current = row ? load(row) : null;
            return store.revision();
        },
    };
    return store;
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
 * adminRoutes(stores, { requireAdmin, basePath, actor, authorize, router, log })
 *   GET  <base>                         every namespace: active revision, values (redacted), last-known-good
 *   GET  <base>/:namespace              one of them
 *   GET  <base>/:namespace/history      ?limit (≤200) &before=<revision>, newest first
 *   POST <base>/:namespace              { values, reason, merge?, unset? } → apply; 422 with errors
 *   POST <base>/:namespace/rollback     { to?, reason } → the new revision
 * requireAdmin (a middleware or a list) guards every handler, mounted or called directly. actor(req)
 * names who acts (default: req.user.subject_id and friends; none → 403). authorize(req, { action:
 * 'read' | 'write', namespace, keys }) may refuse more (false → 403). No Express dependency: pass
 * `router` (anything with get/post) or call mount(router), use the handlers, or handle(req, res, next)
 * for a plain http server. The body is req.body when a JSON parser ran, else read from the request.
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
    const log = makeLog(o.log);

    const allowed = async (req, ctx) => !authorize || (await authorize(req, ctx)) !== false;
    function storeFor(req) {
        const ns = (req.params && req.params.namespace) || '';
        const s = byNs.get(ns);
        if (!s) throw new ConfigError('config.namespace_not_found', `no configuration namespace ${ns || '(none)'}`, { status: 404 });
        return s;
    }
    const queryOf = (req) => req.query || Object.fromEntries(new URL(req.url || '/', 'http://x').searchParams);

    const handlers = {
        async list(req, res) {
            const namespaces = [];
            for (const s of list) if (await allowed(req, { action: 'read', namespace: s.namespace, keys: [] })) namespaces.push(s.summary());
            send(res, 200, { namespaces });
        },
        async get(req, res) {
            const s = storeFor(req);
            if (!(await allowed(req, { action: 'read', namespace: s.namespace, keys: [] }))) throw new ConfigError('config.forbidden', 'not allowed to read this namespace', { status: 403 });
            send(res, 200, s.summary());
        },
        async history(req, res) {
            const s = storeFor(req);
            if (!(await allowed(req, { action: 'read', namespace: s.namespace, keys: [] }))) throw new ConfigError('config.forbidden', 'not allowed to read this namespace', { status: 403 });
            const query = queryOf(req);
            const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 20));
            const snapshots = s.history({ limit, before: query.before != null && query.before !== '' ? parseInt(query.before, 10) : null });
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
            const keys = s.changes(body.values, opts);
            if (!(await allowed(req, { action: 'write', namespace: s.namespace, keys }))) throw new ConfigError('config.forbidden', 'not allowed to change these keys', { status: 403 });
            send(res, 200, await s.apply(body.values, opts));
        },
        async rollback(req, res) {
            const s = storeFor(req);
            const body = await readBody(req);
            if (!isPlainObject(body)) throw new ConfigError('config.bad_request', 'the body must be { to?, reason? }', { status: 400 });
            if (body.to != null && !Number.isInteger(body.to)) throw new ConfigError('config.bad_request', 'to must be a revision number', { status: 400 });
            const actor = await actorOf(req);
            if (!subjectRef(actor)) throw new ConfigError('config.actor_required', 'the request does not name the acting subject', { status: 403 });
            const keys = s.changes(null, { revision: s.rollbackTarget(body.to) });
            if (!(await allowed(req, { action: 'write', namespace: s.namespace, keys }))) throw new ConfigError('config.forbidden', 'not allowed to change these keys', { status: 403 });
            send(res, 200, await s.rollback({ to: body.to, reason: body.reason, actor }));
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
    ];
    function mount(router) {
        for (const r of routes) router[r.method](r.path, r.handler);
        return router;
    }
    /** For a plain http server: dispatches the five routes, calls next() (or answers 404) for anything else. */
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
        }
        if (!m) return typeof next === 'function' ? next() : sendProblem(res, 404, 'config.route_not_found', { detail: 'no such configuration route' });
        let ns = m[1] || '';
        try { ns = decodeURIComponent(ns); } catch { /* keep it as it is */ }
        req.params = { ...(req.params || {}), namespace: ns };
        if (!req.query) req.query = Object.fromEntries(url.searchParams);
        return out[m[0]](req, res, next);
    }
    if (o.router) mount(o.router);
    return { ...out, routes, mount, handle };
}

module.exports = { createConfigStore, adminRoutes, fromRows, canonical, ConfigError, problem };
