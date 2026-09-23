'use strict';
// ═══════════════════════════════════════════════════════════════
// openvibe-shared/release-compat — the mixed-version (N/N-1) test harness (ADR-016, Track R, D45).
// Node only; services use it in their own tests.
//
//   const compat = require('openvibe-shared/release-compat');
//   await compat.assertMixedVersion({ releases: [
//       { name: 'N-1', manifest: require('./fixtures/release-prev.json'), client: compat.replay(prevCalls) },
//       { name: 'N', manifest: release.full(), server: startServer, client: compat.replay(calls) },
//   ] });
//
// For every page release P and server release S it checks what the release manifests promise:
//   - compatible(P, S): S still accepts every contract P produces and P accepts S's versions
//     (contract_ranges); the same rule release-watch applies in a tab;
//   - when they say compatible and S has a server, P's client runs against it and must succeed. A failure
//     means the manifest claims a compatibility the server does not honour;
//   - when they say incompatible, the tab's plan must be a reload (reason "contract"), never a silent
//     in-place update or nothing;
//   - releases next to each other in `releases` must be compatible both ways (the supported window of
//     ADR-016: the current and the previous release), unless requireAdjacent is false.
// openPage() runs release-watch.js and release-update.js against an HTML page in linkedom (a
// devDependency the service installs) with a scripted /release.json, for in-place update tests.
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { plan, compatible, satisfies } = require('./release-update');
const { normalizeRange, compareVersions, contractRanges } = require('./release');

/** Service to service: every contract `consumer` consumes is produced by `producer`, both ranges holding. */
function consumerCompatible(consumer, producer) {
    const problems = [];
    const mine = (consumer && consumer.contract_ranges) || {};
    const theirs = (producer && producer.contract_ranges) || {};
    for (const [id, a] of Object.entries(mine)) {
        if (a.role !== 'consumes') continue;
        const b = theirs[id];
        if (!b || b.role === 'consumes') problems.push(`${id}: ${producer && producer.service} does not produce it`);
        else if (!satisfies(a.version, b.accepts)) problems.push(`${id}: ${producer.service} accepts ${b.accepts}, ${consumer.service} speaks ${a.version}`);
        else if (!satisfies(b.version, a.accepts)) problems.push(`${id}: ${consumer.service} accepts ${a.accepts}, ${producer.service} speaks ${b.version}`);
    }
    return { ok: !problems.length, problems };
}

/**
 * Rolling back from release `from` to release `to` keeps data safe when `to`'s code expects a schema
 * generation `from` still supports: to.schema_generation >= from.schema_compatible_from.
 */
function rollbackSafe(from, to) {
    const need = from && from.schema_compatible_from;
    const have = to && to.schema_generation;
    if (need == null || have == null) return { ok: true, unknown: true };
    return have >= need ? { ok: true } : { ok: false, problem: `${to.release} expects schema generation ${have}; ${from.release} is only readable from ${need}` };
}

/**
 * A client made of recorded calls: [{ method?, path, body?, headers?, status?: n | [n…] | (n) => bool,
 * check?: (json, res) => void }]. Each call must answer 2xx (or `status`) and pass `check`.
 */
function replay(calls, { fetchImpl = globalThis.fetch } = {}) {
    return async (baseUrl) => {
        for (const c of calls) {
            const method = (c.method || 'GET').toUpperCase();
            const headers = { accept: 'application/json', ...(c.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(c.headers || {}) };
            const res = await fetchImpl(new URL(c.path, baseUrl), { method, headers, body: c.body !== undefined ? JSON.stringify(c.body) : undefined });
            const want = c.status;
            const ok = want == null ? res.status >= 200 && res.status < 300
                : typeof want === 'function' ? want(res.status) : [].concat(want).includes(res.status);
            const text = await res.text();
            if (!ok) throw new Error(`${method} ${c.path} answered ${res.status}: ${text.slice(0, 200)}`);
            if (c.check) {
                let json = null;
                try { json = text ? JSON.parse(text) : null; } catch { throw new Error(`${method} ${c.path} did not answer JSON`); }
                await c.check(json, res);
            }
        }
    };
}

/** A manifest for a test release (registry.release-manifest 1.1.0 fields), no git needed. */
function manifestFor({ service = 'test', release, releasedAt = new Date().toISOString(), windowHours = 24, minClientRelease = null, components = null, assets = null, contracts = null, schemaGeneration = null, schemaCompatibleFrom = null, metricsUrl = null } = {}) {
    if (!/^[0-9a-f]{7,40}$/.test(String(release || ''))) throw new TypeError('manifestFor: release must be a hex sha');
    const m = {
        service, release, released_at: releasedAt, booted_at: releasedAt, contracts_version: null, packages: {},
        min_client_release: minClientRelease, mixed_version_window_hours: windowHours,
    };
    if (components) m.components = components;
    if (assets) m.assets = assets;
    if (schemaGeneration != null) { m.schema_generation = schemaGeneration; m.schema_compatible_from = schemaCompatibleFrom == null ? schemaGeneration : schemaCompatibleFrom; }
    if (contracts) m.contract_ranges = contractRanges(contracts);
    if (metricsUrl) m.metrics_url = metricsUrl;
    return m;
}

/**
 * Runs the page × server matrix. releases: [{ name, manifest, server?: async () => ({ url, close? }),
 * client?: async (url) => void }], oldest first. Returns rows { page, server, adjacent, compatible,
 * problems, action, reason, ran, ok, error }.
 */
async function runMixedVersion({ releases, now = Date.now(), requireAdjacent = true } = {}) {
    if (!Array.isArray(releases) || releases.length < 2) throw new TypeError('runMixedVersion: at least two releases');
    const started = new Map();
    const serverOf = async (r) => {
        if (!r.server) return null;
        if (!started.has(r.name)) started.set(r.name, await r.server());
        return started.get(r.name);
    };
    const rows = [];
    try {
        for (let i = 0; i < releases.length; i++) {
            for (let j = 0; j < releases.length; j++) {
                if (i === j) continue;
                const P = releases[i]; const S = releases[j];
                const c = compatible(P.manifest, S.manifest);
                const p = plan(P.manifest, S.manifest, now);
                const row = { page: P.name, server: S.name, adjacent: Math.abs(i - j) === 1, compatible: c.ok, problems: c.problems, action: p.action, reason: p.reason || null, ran: false, ok: true, error: null };
                if (!c.ok) {
                    if (p.action !== 'reload' || p.reason !== 'contract') { row.ok = false; row.error = `incompatible, but the tab would ${p.action}`; }
                    if (row.adjacent && requireAdjacent) { row.ok = false; row.error = `adjacent releases must be compatible: ${c.problems.join('; ')}`; }
                } else if (P.client) {
                    const s = await serverOf(S);
                    if (s) {
                        row.ran = true;
                        try { await P.client(s.url); } catch (err) { row.ok = false; row.error = `declared compatible, but the ${P.name} client failed against the ${S.name} server: ${err && err.message}`; }
                    }
                }
                rows.push(row);
            }
        }
    } finally {
        for (const s of started.values()) { try { if (s && s.close) await s.close(); } catch { /* */ } }
    }
    return rows;
}

function formatMatrix(rows) {
    const head = ['page', 'server', 'compatible', 'tab', 'ran', 'ok'];
    const body = rows.map((r) => [r.page, r.server, r.compatible ? 'yes' : 'no', r.action + (r.reason ? ` (${r.reason})` : ''), r.ran ? 'yes' : 'no', r.ok ? 'ok' : `FAIL: ${r.error}`]);
    const w = head.map((h, i) => Math.max(h.length, ...body.map((b) => String(b[i]).length)));
    return [head, ...body].map((r) => r.map((c, i) => (i === r.length - 1 ? String(c) : String(c).padEnd(w[i]))).join('  ')).join('\n');
}

async function assertMixedVersion(opts) {
    const rows = await runMixedVersion(opts);
    if (rows.some((r) => !r.ok)) {
        const err = new Error(`mixed-version check failed\n${formatMatrix(rows)}`);
        err.rows = rows;
        throw err;
    }
    return rows;
}

// ── openPage: release-watch in a linkedom page ────────────────

const WATCH_SRC = () => fs.readFileSync(path.join(__dirname, 'release-watch.js'), 'utf8');
const UPDATE_SRC = () => fs.readFileSync(path.join(__dirname, 'release-update.js'), 'utf8');

function toResponse(out) {
    if (out && typeof out.status === 'number' && typeof out.text === 'function') return out;   // a Response
    const o = out || { status: 404 };
    const body = o.json !== undefined ? JSON.stringify(o.json) : o.body != null ? String(o.body) : o.text != null ? String(o.text) : '';
    return new Response(o.status === 204 ? null : body, { status: o.status || 200, headers: { 'content-type': o.json !== undefined ? 'application/json' : 'text/html' } });
}

/**
 * A page at `url` rendered from `html`, running release-watch.js. `serve(url, init)` answers every fetch
 * the scripts make (return { json } | { body } | { status } | a Response). Options: config
 * (OVReleaseConfig), updateScript: 'lazy' (default: loaded when release-watch asks) | 'fail', hidden,
 * protectedFn (window.OVProtected).
 * Returns controls to drive it: settle(), settleStyles(ok), focus(el), setHidden(bool), tick(), and what
 * it did: reloads, beacons, toasts, requests.
 */
async function openPage({ url = 'https://site.test/', html, serve, config = null, updateScript = 'lazy', protectedFn = null, hidden: startHidden = false } = {}) {
    let linkedom;
    try { linkedom = require('linkedom'); } catch { throw new Error('openPage needs linkedom (npm i -D linkedom)'); }
    const { window: lw, document } = linkedom.parseHTML(html || '<!doctype html><html><head></head><body></body></html>');
    const origin = new URL(url).origin;
    const out = { reloads: 0, beacons: [], toasts: [], requests: [], intervals: [] };
    const timers = new Map(); let tid = 0;
    let focused = null; let hidden = !!startHidden;
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => focused || document.body });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'currentScript', { configurable: true, get: () => ({ src: `${origin}/shared/release-watch.js` }) });
    const listeners = {};
    const ctx = {
        document, console, URL, JSON, Promise,
        DOMParser: linkedom.DOMParser, CustomEvent: lw.CustomEvent || linkedom.CustomEvent, Event: lw.Event || linkedom.Event,
        location: { href: url, origin, reload: () => { out.reloads++; } },
        navigator: { sendBeacon: (to, body) => { out.beacons.push({ to, body: JSON.parse(body) }); return true; } },
        OpenVibeUI: { toast: (msg, o) => out.toasts.push({ msg, o }) },
        setInterval: (f) => { out.intervals.push(f); return out.intervals.length; },
        clearInterval: () => {},
        setTimeout: (f) => { timers.set(++tid, f); return tid; },
        clearTimeout: (id) => { timers.delete(id); },
        addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
        removeEventListener: () => {},
        dispatchEvent: (e) => { for (const f of listeners[e.type] || []) f(e); return true; },
        scrollBy: () => {},
        fetch: async (u, init = {}) => {
            const abs = new URL(String(u), url).href;
            out.requests.push({ url: abs, method: (init.method || 'GET').toUpperCase() });
            return toResponse(await serve(abs, init));
        },
    };
    if (config) ctx.OVReleaseConfig = config;
    if (protectedFn) ctx.OVProtected = protectedFn;
    ctx.window = ctx; ctx.globalThis = ctx;
    vm.createContext(ctx);
    // A script element release-watch appends is "loaded": release-update.js runs, then onload fires.
    const append = document.head.appendChild.bind(document.head);
    document.head.appendChild = (node) => {
        const r = append(node);
        const src = node && node.tagName === 'SCRIPT' ? String(node.src || node.getAttribute('src') || '') : '';
        if (src) {
            setImmediate(() => {
                if (updateScript === 'fail' || !/release-update\.js/.test(src)) { if (node.onerror) node.onerror(new ctx.Event('error')); return; }
                vm.runInContext(UPDATE_SRC(), ctx, { filename: 'release-update.js' });
                if (node.onload) node.onload(new ctx.Event('load'));
            });
        }
        return r;
    };
    const initialLinks = new Set(document.querySelectorAll('link'));
    const settled = new Set();
    vm.runInContext(WATCH_SRC(), ctx, { filename: 'release-watch.js' });
    const page = {
        window: ctx, document, ...out,
        get reloads() { return out.reloads; },
        get release() { return ctx.OVRelease; },
        /** The tab's outcome counts so far (a plain copy). */
        metrics() { return JSON.parse(JSON.stringify(ctx.OVRelease ? ctx.OVRelease.state().metrics : {})); },
        async settle(turns = 8) { for (let i = 0; i < turns; i++) await new Promise((r) => setImmediate(r)); },
        /** Fires load (or error) on every stylesheet release-update inserted and that has not loaded yet. */
        settleStyles(ok = true) {
            let n = 0;
            for (const l of document.querySelectorAll('link')) {
                if (initialLinks.has(l) || settled.has(l)) continue;
                settled.add(l); n++;
                l.dispatchEvent(new ctx.Event(ok ? 'load' : 'error'));
            }
            return n;
        },
        /** Runs the timeouts still pending (release-update's 15 s stylesheet timeout). */
        fireTimeouts() { const t = [...timers.values()]; timers.clear(); t.forEach((f) => f()); return t.length; },
        focus(el) { focused = el; },
        blur() { focused = null; },
        setHidden(h) { hidden = !!h; document.dispatchEvent(new ctx.Event('visibilitychange')); },
        tick() { out.intervals.forEach((f) => f()); },
        stop() { if (ctx.OVRelease) ctx.OVRelease.stop(); },
    };
    return page;
}

module.exports = {
    plan, compatible, satisfies, normalizeRange, compareVersions,
    consumerCompatible, rollbackSafe, replay, manifestFor,
    runMixedVersion, assertMixedVersion, formatMatrix, openPage,
};
