'use strict';
/**
 * analytics/event.v1: the raw analytics event shape (ADR-021). The JSON schema is
 * docs/schemas/analytics-event.v1.json, also exported as 'openvibe-shared/analytics/event.v1.json'.
 *
 *   EVENT_V1              the schema object
 *   toEvent(row)          an analytics_events row -> an event.v1 object (column renames, 0/1 -> boolean,
 *                         created_at -> RFC 3339). The retired columns ip/user_id/city are not part
 *                         of the event; checkRow() reports them.
 *   validateEvent(ev)     [] when ev conforms to event.v1, else a list of 'field: problem' strings
 *   checkRow(row)         validateEvent(toEvent(row)) plus any non-NULL ip / user_id / city
 *
 * The validator interprets the schema file itself, for the keywords it uses (type, enum, pattern,
 * maxLength, minimum, maximum, required, properties, additionalProperties: false), and refuses a
 * schema with any other keyword, so the file and this code cannot drift apart. No dependencies.
 */

const EVENT_V1 = require('../docs/schemas/analytics-event.v1.json');

const RETIRED_COLUMNS = ['ip', 'user_id', 'city'];
const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description']);
const OBJECT_KEYWORDS = new Set(['type', 'required', 'additionalProperties', 'properties']);
const VALUE_KEYWORDS = new Set(['type', 'enum', 'pattern', 'maxLength', 'minimum', 'maximum']);

function checkKeywords(node, allowed, where) {
    for (const k of Object.keys(node)) {
        if (!ANNOTATIONS.has(k) && !allowed.has(k)) throw new Error(`analytics event schema: unsupported keyword ${k} at ${where}`);
    }
}

/** Compile the schema into per-field checks, once. */
function compile(schema) {
    checkKeywords(schema, OBJECT_KEYWORDS, '/');
    if (schema.type !== 'object' || schema.additionalProperties !== false) throw new Error('analytics event schema: expected a closed object');
    const fields = {};
    for (const [name, spec] of Object.entries(schema.properties)) {
        checkKeywords(spec, VALUE_KEYWORDS, `/properties/${name}`);
        const types = spec.type == null ? null : [].concat(spec.type);
        const re = spec.pattern ? new RegExp(spec.pattern, 'u') : null;
        fields[name] = (v) => {
            if (spec.enum && !spec.enum.some((e) => e === v)) return `not one of ${JSON.stringify(spec.enum)}`;
            if (types && !types.some((t) => typeOk(t, v))) return `expected ${types.join(' or ')}`;
            if (v === null) return null;
            if (typeof v === 'string') {
                if (spec.maxLength != null && [...v].length > spec.maxLength) return `longer than ${spec.maxLength}`;
                if (re && !re.test(v)) return `does not match ${spec.pattern}`;
            }
            if (typeof v === 'number') {
                if (spec.minimum != null && v < spec.minimum) return `below ${spec.minimum}`;
                if (spec.maximum != null && v > spec.maximum) return `above ${spec.maximum}`;
            }
            return null;
        };
    }
    return { fields, required: schema.required || [] };
}

function typeOk(t, v) {
    switch (t) {
        case 'null': return v === null;
        case 'string': return typeof v === 'string';
        case 'boolean': return typeof v === 'boolean';
        case 'integer': return Number.isInteger(v);
        case 'number': return typeof v === 'number' && Number.isFinite(v);
        default: throw new Error(`analytics event schema: unsupported type ${t}`);
    }
}

const COMPILED = compile(EVENT_V1);

/** [] when `ev` is a valid analytics/event.v1 object; otherwise one 'field: problem' string per issue. */
function validateEvent(ev) {
    if (!ev || typeof ev !== 'object' || Array.isArray(ev)) return ['event: expected an object'];
    const errors = [];
    for (const k of COMPILED.required) if (!(k in ev)) errors.push(`${k}: required`);
    for (const [k, v] of Object.entries(ev)) {
        const check = COMPILED.fields[k];
        if (!check) { errors.push(`${k}: not allowed`); continue; }
        const problem = check(v);
        if (problem) errors.push(`${k}: ${problem}`);
    }
    return errors;
}

const nullable = (v) => (v === undefined || v === '' ? null : v);
const bool = (v) => v === true || v === 1 || v === '1';

/** 'YYYY-MM-DD HH:MM:SS' (SQLite CURRENT_TIMESTAMP, UTC) -> 'YYYY-MM-DDTHH:MM:SSZ'; ISO input passes. */
function isoTime(v) {
    if (v == null) return v;
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s.replace(' ', 'T') + 'Z';
    return s;
}

/** An analytics_events row as an analytics/event.v1 object. */
function toEvent(row) {
    return {
        event: row.event_type,
        service: row.service,
        route: nullable(row.path),
        method: nullable(row.method),
        status: nullable(row.status_code),
        duration_ms: nullable(row.response_time_ms),
        session_id: nullable(row.session_id),
        country: nullable(row.country),
        ua_class: nullable(row.user_agent),
        device: nullable(row.device_type),
        browser: nullable(row.browser),
        os: nullable(row.os),
        referer_origin: nullable(row.referer),
        is_bot: bool(row.is_bot),
        bot_type: nullable(row.bot_type),
        authenticated: bool(row.authenticated),
        timestamp: isoTime(row.created_at),
    };
}

/** Problems with a stored row: retired personal columns that are set, then the event.v1 checks. */
function checkRow(row) {
    const errors = RETIRED_COLUMNS.filter((c) => row[c] != null).map((c) => `${c}: must be NULL (ADR-021)`);
    return errors.concat(validateEvent(toEvent(row)));
}

/** The enum of an event.v1 field, without null (for reducers that must stay inside the schema). */
function allowed(field) {
    return EVENT_V1.properties[field].enum.filter((v) => v !== null);
}

module.exports = { EVENT_V1, RETIRED_COLUMNS, toEvent, validateEvent, checkRow, allowed };
