'use strict';
// Shared validation, redaction and row conversion for the PostgreSQL config store.
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

// ── Sealed secrets (D11) ────────────────────────────────────────
// A secret-class value is stored as v1:<kek_id>:<fingerprint>:<hint>:<bind>:<kek iv>:<wrapped key>:<body iv>:<body tag>:<body>.
// The wrapped key is a random 256-bit data key sealed by the KEK (ciphertext then its 16-byte GCM tag); the body is the
// JSON of the value sealed by that data key. Both use AES-256-GCM with AAD service|namespace|key|bind. fingerprint is
// the namespace's HMAC of the plaintext (so markers stay stable across reseals), hint the last four characters (or
// empty), and bind the value the secret was sealed to. A bad or foreign envelope never throws out of get(): it is locked.

const KEK_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const B64_STD = /^[A-Za-z0-9+/]+={0,2}$/;
const B64_URL = /^[A-Za-z0-9_-]*$/;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

function b64(buf) { return Buffer.from(buf).toString('base64'); }
function unb64(s, length) {
    if (typeof s !== 'string' || !B64_STD.test(s) || s.length % 4 === 1) return null;
    const b = Buffer.from(s, 'base64');
    if (length !== undefined && b.length !== length) return null;
    return b;
}
const b64url = (s) => Buffer.from(String(s), 'utf8').toString('base64url');
function unb64url(s, max = 4096) {
    if (typeof s !== 'string' || !B64_URL.test(s) || s.length > max * 2) return null;
    const b = Buffer.from(s, 'base64url');
    if (b.length > max) return null;
    return b.toString('utf8');
}
const aadOf = ({ service, namespace, key, bind }) => Buffer.from(`${service}|${namespace}|${key}|${bind == null ? '' : String(bind)}`, 'utf8');
const bindText = (v) => (v == null ? '' : typeof v === 'string' ? v : canonical(v));
/** The last four characters of a long enough string, never a short one (a five-character secret must not be shown). */
function hintOf(value) { return typeof value === 'string' && value.length >= 8 ? [...value].slice(-4).join('') : null; }

/** Parse a stored envelope without any key. Null means "not an envelope". */
function parseEnvelope(v) {
    if (typeof v !== 'string' || !v.startsWith('v1:')) return null;
    const parts = v.split(':');
    if (parts.length !== 10) return null;
    const [, kekId, fingerprint, hintB64, bindB64, kekIvB64, wrappedB64, bodyIvB64, tagB64, bodyB64] = parts;
    if (!KEK_ID.test(kekId) || !/^[0-9a-f]{64}$/.test(fingerprint)) return null;
    const hint = unb64url(hintB64, 64);
    const bind = unb64url(bindB64, 4096);
    const kekIv = unb64(kekIvB64, IV_BYTES);
    const wrapped = unb64(wrappedB64, KEY_BYTES + TAG_BYTES);
    const bodyIv = unb64(bodyIvB64, IV_BYTES);
    const tag = unb64(tagB64, TAG_BYTES);
    const body = unb64(bodyB64);
    if (hint === null || bind === null || !kekIv || !wrapped || !bodyIv || !tag || !body) return null;
    return { version: 'v1', kekId, fingerprint, hint, bind, kekIv, wrapped, bodyIv, tag, body };
}
const isEnvelope = (v) => parseEnvelope(v) !== null;

/** Seal one secret-class value. `fingerprint` is the namespace HMAC of the plaintext; `kek` is 32 bytes. */
function sealEnvelope({ service, namespace, key, value, bind = '', fingerprint, hint = null, kekId, kek }) {
    if (typeof kekId !== 'string' || !KEK_ID.test(kekId)) throw new TypeError('sealEnvelope: kek id must be k1, k2, …');
    if (!Buffer.isBuffer(kek) || kek.length !== KEY_BYTES) throw new TypeError('sealEnvelope: the KEK must be a 32-byte Buffer');
    if (typeof fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(fingerprint)) throw new TypeError('sealEnvelope: fingerprint must be 64 hex characters');
    const aad = aadOf({ service, namespace, key, bind });
    const dataKey = crypto.randomBytes(KEY_BYTES);
    const bodyIv = crypto.randomBytes(IV_BYTES);
    const body = crypto.createCipheriv('aes-256-gcm', dataKey, bodyIv);
    body.setAAD(aad);
    const sealedBody = Buffer.concat([body.update(JSON.stringify(value), 'utf8'), body.final()]);
    const tag = body.getAuthTag();
    const kekIv = crypto.randomBytes(IV_BYTES);
    const wrap = crypto.createCipheriv('aes-256-gcm', kek, kekIv);
    wrap.setAAD(aad);
    const wrapped = Buffer.concat([wrap.update(dataKey), wrap.final(), wrap.getAuthTag()]);
    return ['v1', kekId, fingerprint, b64url(hint || ''), b64url(bind || ''), b64(kekIv), b64(wrapped), b64(bodyIv), b64(tag), b64(sealedBody)].join(':');
}

const secretUnreadable = (why) => Object.assign(new Error(`secret does not open (${why})`), { code: 'config.secret_unreadable' });

// ── The namespace fingerprint key, sealed under the KEK (D11 S2 review) ─────────────────────────
// With a KEK, config_keys.hmac_key is not the key: it is the 32-byte key wrapped with the current KEK
// (AES-256-GCM, AAD openvibe-config-fingerprint|<service>|<namespace>) in this small versioned form.
// A database dump then has the fingerprints but no key that reproduces them. The same key is kept
// across KEK rotations (rewrapped on boot), so markers and checksums never move.
const FP_WRAP_PREFIX = 'ovfp.v1.';
const fpAad = ({ service, namespace }) => Buffer.from(`openvibe-config-fingerprint|${service}|${namespace}`, 'utf8');
const isWrappedFingerprintKey = (stored) => stored != null && Buffer.from(stored).toString('utf8').startsWith(FP_WRAP_PREFIX);

function sealFingerprintKey(key, { service, namespace, kekId, kek }) {
    if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) throw new TypeError('sealFingerprintKey: the fingerprint key must be a 32-byte Buffer');
    if (typeof kekId !== 'string' || !KEK_ID.test(kekId)) throw new TypeError('sealFingerprintKey: kek id must be k1, k2, …');
    if (!Buffer.isBuffer(kek) || kek.length !== KEY_BYTES) throw new TypeError('sealFingerprintKey: the KEK must be a 32-byte Buffer');
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
    cipher.setAAD(fpAad({ service, namespace }));
    const body = Buffer.concat([cipher.update(key), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.from(`${FP_WRAP_PREFIX}${kekId}:${b64(iv)}:${b64(tag)}:${b64(body)}`, 'utf8');
}

/** Open a wrapped fingerprint key: { key, kekId }. Null when the value is a plain 32-byte key. */
function openFingerprintKey(stored, { service, namespace, keys }) {
    const text = Buffer.from(stored).toString('utf8');
    if (!text.startsWith(FP_WRAP_PREFIX)) return null;
    const fail = (why) => Object.assign(new Error(`createConfigStore: the fingerprint key of ${namespace} in config_keys ${why}`), { code: 'config.fingerprint_key_unreadable' });
    const parts = text.slice(FP_WRAP_PREFIX.length).split(':');
    if (parts.length !== 4 || !KEK_ID.test(parts[0])) throw fail('is not a valid wrapper');
    const [kekId, ivB64, tagB64, bodyB64] = parts;
    const iv = unb64(ivB64, IV_BYTES);
    const tag = unb64(tagB64, TAG_BYTES);
    const body = unb64(bodyB64, KEY_BYTES);
    if (!iv || !tag || !body) throw fail('is not a valid wrapper');
    const kek = keys && typeof keys.get === 'function' ? keys.get(kekId) : keys && keys[kekId];
    if (!kek) throw fail(`is sealed under the KEK "${kekId}", which is not configured`);
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', kek, iv);
        decipher.setAAD(fpAad({ service, namespace }));
        decipher.setAuthTag(tag);
        const key = Buffer.concat([decipher.update(body), decipher.final()]);
        if (key.length !== KEY_BYTES) throw new Error('wrong length');
        return { key, kekId };
    } catch {
        throw fail(`does not open with the KEK "${kekId}"`);
    }
}

/** Open one envelope: { value, meta }. Throws a coded error when the KEK, bind or tag is wrong. */
function openEnvelope(envelope, { service, namespace, key, bind = '', keys }) {
    const p = parseEnvelope(envelope);
    if (!p) throw secretUnreadable('not an envelope');
    const kek = keys && typeof keys.get === 'function' ? keys.get(p.kekId) : keys && keys[p.kekId];
    if (!kek) throw secretUnreadable(`no KEK ${p.kekId}`);
    const aad = aadOf({ service, namespace, key, bind });
    try {
        const wrapped = p.wrapped;
        const unwrap = crypto.createDecipheriv('aes-256-gcm', kek, p.kekIv);
        unwrap.setAAD(aad);
        unwrap.setAuthTag(wrapped.subarray(KEY_BYTES));
        const dataKey = Buffer.concat([unwrap.update(wrapped.subarray(0, KEY_BYTES)), unwrap.final()]);
        const open = crypto.createDecipheriv('aes-256-gcm', dataKey, p.bodyIv);
        open.setAAD(aad);
        open.setAuthTag(p.tag);
        const plain = Buffer.concat([open.update(p.body), open.final()]).toString('utf8');
        return { value: JSON.parse(plain), meta: { ...p } };
    } catch (err) {
        throw secretUnreadable(err && err.code ? err.code : 'wrong KEK, bind or tag');
    }
}

/**
 * The KEKs of a store: opts.keks ({ current, keys: { k1: Buffer } }) when given (false/null disables sealing), else
 * OV_CONFIG_KEKS and OV_CONFIG_KEK_CURRENT. Every value must be base64 of exactly 32 bytes. Errors name the variable
 * or the option and the key id, never a byte of the key.
 */
function keksOf(opts = {}, env = process.env) {
    if (opts.keks === false || opts.keks === null) return null;
    if (opts.keks !== undefined) {
        if (!isPlainObject(opts.keks)) throw new TypeError('createConfigStore: opts.keks must be { current, keys }');
        const keys = new Map();
        const raw = opts.keks.keys;
        if (!isPlainObject(raw) || !Object.keys(raw).length) throw new TypeError('createConfigStore: opts.keks.keys must name at least one KEK');
        for (const [id, k] of Object.entries(raw)) {
            if (!KEK_ID.test(id)) throw new TypeError(`createConfigStore: opts.keks.keys has an invalid KEK id "${String(id).slice(0, 40)}"`);
            if (!Buffer.isBuffer(k) || k.length !== KEY_BYTES) throw new TypeError(`createConfigStore: opts.keks.keys.${id} must be a 32-byte Buffer`);
            keys.set(id, Buffer.from(k));
        }
        if (typeof opts.keks.current !== 'string' || !KEK_ID.test(opts.keks.current)) throw new TypeError('createConfigStore: opts.keks.current must name a KEK id (k1, k2, …)');
        if (!keys.has(opts.keks.current)) throw new TypeError(`createConfigStore: opts.keks.current names the unknown KEK "${opts.keks.current}"`);
        return { current: opts.keks.current, keys };
    }
    const list = env && env.OV_CONFIG_KEKS;
    const current = env && env.OV_CONFIG_KEK_CURRENT;
    if (list == null || list === '') {
        if (current) throw new TypeError('createConfigStore: OV_CONFIG_KEK_CURRENT is set but OV_CONFIG_KEKS is empty');
        return null;
    }
    const keys = new Map();
    for (const part of String(list).split(',')) {
        const s = part.trim();
        if (!s) continue;
        const at = s.indexOf(':');
        if (at < 1) throw new TypeError('createConfigStore: every OV_CONFIG_KEKS entry must be <id>:<base64 32-byte key>');
        const id = s.slice(0, at).trim();
        const value = s.slice(at + 1).trim();
        if (!KEK_ID.test(id)) throw new TypeError(`createConfigStore: OV_CONFIG_KEKS has an invalid KEK id "${id.slice(0, 40)}"`);
        if (keys.has(id)) throw new TypeError(`createConfigStore: OV_CONFIG_KEKS names the KEK "${id}" twice`);
        const k = unb64(value, KEY_BYTES);
        if (!k) throw new TypeError(`createConfigStore: OV_CONFIG_KEKS entry "${id}" must be base64 of exactly 32 bytes`);
        keys.set(id, k);
    }
    if (!keys.size) throw new TypeError('createConfigStore: OV_CONFIG_KEKS names no KEK');
    if (!current) throw new TypeError('createConfigStore: OV_CONFIG_KEKS is set, so OV_CONFIG_KEK_CURRENT must name the current KEK id');
    if (!KEK_ID.test(current)) throw new TypeError(`createConfigStore: OV_CONFIG_KEK_CURRENT is not a KEK id ("${String(current).slice(0, 40)}")`);
    if (!keys.has(current)) throw new TypeError(`createConfigStore: OV_CONFIG_KEK_CURRENT names the unknown KEK "${current}"`);
    return { current, keys };
}

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
const UNITS = new Set(['nano_usd', 'ms', 'bps']);
const ENV_NAME = /^[A-Z][A-Z0-9_]{0,127}$/;
const patterns = new WeakMap();

/** The owner-settings annotations of the summary (D11): x-env, x-danger, x-bind and x-unit are checked. */
function checkAnnotations(s, at) {
    if (s['x-env'] !== undefined && (typeof s['x-env'] !== 'string' || !ENV_NAME.test(s['x-env']))) throw new TypeError(`config schema ${at}: x-env must be an env name (A-Z, 0-9, _)`);
    if (s['x-bind'] !== undefined && (typeof s['x-bind'] !== 'string' || !s['x-bind'])) throw new TypeError(`config schema ${at}: x-bind must name another key`);
    if (s['x-danger'] !== undefined && typeof s['x-danger'] !== 'boolean') throw new TypeError(`config schema ${at}: x-danger must be true or false`);
    if (s['x-unit'] !== undefined && !UNITS.has(s['x-unit'])) throw new TypeError(`config schema ${at}: x-unit must be one of ${[...UNITS].join(', ')}`);
    if (s['x-group'] !== undefined && typeof s['x-group'] !== 'string') throw new TypeError(`config schema ${at}: x-group must be a string`);
    if (s.title !== undefined && typeof s.title !== 'string') throw new TypeError(`config schema ${at}: title must be a string`);
    if (s.description !== undefined && typeof s.description !== 'string') throw new TypeError(`config schema ${at}: description must be a string`);
}

function compileSchema(s, at = '#') {
    if (typeof s === 'boolean') return;
    if (!isPlainObject(s)) throw new TypeError(`config schema ${at}: must be an object or a boolean`);
    for (const k of Object.keys(s)) {
        if (!KEYWORDS.has(k) && !ANNOTATIONS.has(k) && !k.startsWith('x-')) throw new TypeError(`config schema ${at}: unsupported keyword "${k}"`);
    }
    if (s.type !== undefined && ![].concat(s.type).every((t) => TYPES.includes(t))) throw new TypeError(`config schema ${at}: unknown type`);
    checkAnnotations(s, at);
    if (at === '#' && isPlainObject(s.properties)) {
        for (const [k, sub] of Object.entries(s.properties)) {
            if (!isPlainObject(sub) || typeof sub['x-bind'] !== 'string') continue;
            if (sub['x-bind'] === k) throw new TypeError(`config schema ${at}/properties/${k}: x-bind cannot name itself`);
            if (!has(s.properties, sub['x-bind'])) throw new TypeError(`config schema ${at}/properties/${k}: x-bind names an unknown key "${sub['x-bind']}"`);
            if (isPlainObject(s.properties[sub['x-bind']]) && has(s.properties[sub['x-bind']], 'x-bind')) throw new TypeError(`config schema ${at}/properties/${k}: x-bind cannot chain to another bound key`);
        }
    }
    if (s.pattern !== undefined) patterns.set(s, new RegExp(s.pattern, 'u'));
    if (s.properties) for (const [k, sub] of Object.entries(s.properties)) compileSchema(sub, `${at}/properties/${k}`);
    if (s.additionalProperties !== undefined) compileSchema(s.additionalProperties, `${at}/additionalProperties`);
    if (s.items !== undefined) compileSchema(s.items, `${at}/items`);
}

/** The declared env pins and binds of a schema's top-level properties. */
function schemaAnnotations(schema) {
    const out = { env: {}, bind: {} };
    if (isPlainObject(schema) && isPlainObject(schema.properties)) {
        for (const [k, p] of Object.entries(schema.properties)) {
            if (!isPlainObject(p)) continue;
            if (typeof p['x-env'] === 'string') out.env[k] = p['x-env'];
            if (typeof p['x-bind'] === 'string') out.bind[k] = p['x-bind'];
        }
    }
    return out;
}

/** A JSON Schema for the summary: secret-class properties lose default/examples, which could hold a secret. */
function summarySchema(schema, isSecret) {
    if (schema == null) return null;
    const out = clone(schema);
    if (isPlainObject(out.properties)) {
        for (const [k, p] of Object.entries(out.properties)) {
            if (!isPlainObject(p) || !isSecret(k)) continue;
            delete p.default; delete p.examples; delete p.enum; delete p.const;
        }
    }
    return deepFreeze(out);
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

/** Messages name the rule, never the value (a value may be a secret). `skip` holds paths whose value cannot be read. */
function checkSchema(s, v, path, errors, skip = null) {
    if (skip && skip.has(path)) return;
    if (s === true || s === undefined) return;
    if (s === false) { errors.push({ path, message: 'is not allowed' }); return; }
    if (s.type !== undefined) {
        const types = [].concat(s.type);
        if (!types.some((t) => isType(v, t))) { errors.push({ path, message: `must be ${types.join(' or ')}` }); return; }
    }
    if (s.enum !== undefined && !s.enum.some((e) => same(e, v))) errors.push({ path, message: 'must be one of the allowed values' });
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
        if (s.items !== undefined) v.forEach((x, i) => checkSchema(s.items, x, `${path}/${i}`, errors, skip));
    }
    if (isPlainObject(v)) {
        const keys = Object.keys(v);
        for (const r of s.required || []) if (!has(v, r) && !(skip && skip.has(`${path}${pointer(r)}`))) errors.push({ path: `${path}${pointer(r)}`, message: 'is required' });
        if (s.minProperties !== undefined && keys.length < s.minProperties) errors.push({ path, message: `must have at least ${s.minProperties} keys` });
        if (s.maxProperties !== undefined && keys.length > s.maxProperties) errors.push({ path, message: `must have at most ${s.maxProperties} keys` });
        for (const k of keys) {
            if (s.properties && has(s.properties, k)) checkSchema(s.properties[k], v[k], `${path}${pointer(k)}`, errors, skip);
            else if (s.additionalProperties === false) errors.push({ path: `${path}${pointer(k)}`, message: 'is not a known key' });
            else if (s.additionalProperties !== undefined) checkSchema(s.additionalProperties, v[k], `${path}${pointer(k)}`, errors, skip);
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

module.exports = { CLASSES, SERVICE_RE, NAMESPACE_RE, validKey, REASON_MAX, ERROR_MAX, ConfigError, canonical, sha256, isPlainObject, pointer, clone, same, has, deepFreeze, jsonErrors, isMarker, looksRedacted, sameHex, compileSchema, checkSchema, validateResult, subjectRef, scrub, errText, summarize, makeLog, fromRows,
    KEK_ID, KEY_BYTES, IV_BYTES, TAG_BYTES, isEnvelope, parseEnvelope, sealEnvelope, openEnvelope, isWrappedFingerprintKey, sealFingerprintKey, openFingerprintKey, keksOf, hintOf, bindText, schemaAnnotations, summarySchema };
