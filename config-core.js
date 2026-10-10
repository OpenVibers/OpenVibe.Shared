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

module.exports = { CLASSES, SERVICE_RE, NAMESPACE_RE, validKey, REASON_MAX, ERROR_MAX, ConfigError, canonical, sha256, isPlainObject, pointer, clone, same, has, deepFreeze, jsonErrors, isMarker, looksRedacted, sameHex, compileSchema, checkSchema, validateResult, subjectRef, scrub, errText, summarize, makeLog, fromRows };
