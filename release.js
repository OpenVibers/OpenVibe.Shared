'use strict';
// ═══════════════════════════════════════════════════════════════
// openvibe-shared/release — GET /release.json for a web surface (ADR-016, contract
// registry.release-manifest@1). Open tabs poll it (release-watch.js) and learn when the page
// they run is older than what the server now serves, and what changed.
//
//   const release = require('openvibe-shared/release').createRelease({
//       service: 'community',
//       components: {                       // optional; see "Components" below
//           styles: { kind: 'style', assets: ['/css/app.css'] },
//           pages: { kind: 'content', files: ['server/web/pages'] },
//           shell: { kind: 'script', assets: ['/js/app.js'], files: ['server/web/layout.js'] },
//       },
//       contracts: { 'community.web-api': { version: '1.3.0', accepts: '^1.0.0' } },
//       schemaGeneration: () => migrations.generation(),
//   });
//   release.mount(app, { registry });   // GET /release.json + POST /release-metrics into /metrics
//   html += release.metaTag();          // <meta name="ov-release" …> — the page's own release
//
// The release is the deployed commit (git in `root`, or RELEASE_COMMIT), read at boot.
// MIN_CLIENT_RELEASE (env) set to the running release tells every older tab it must reload
// (as soon as that is safe); otherwise older tabs are prompted, and reload on their own once
// the new release is older than the mixed-version window (24 h by default).
//
// Components (manifest 1.1.0). Each has a kind and a version, the content hash of its files:
//   style    stylesheets (`assets`): open tabs swap the <link>s in place
//   content  server-rendered regions marked data-ov-content="<id>": open tabs re-fetch them in place
//   script   code the page runs: a reload at a safe moment
//   server   code only the server runs: nothing to do in the tab
// `shell` is the catch-all script component for every client-facing file no other component
// lists (templates, scripts). Without a declared shell its version is the release, so every release
// reloads, as before 1.5.0. The platform package versions are part of the shell's hash.
// `assets` are URL paths under `publicDir`; they also make the asset map (`url` is
// `<path>?v=<12 hex of sha256>` unless `assetUrl` says otherwise, `integrity` is sha384).
// `files` are paths under `root`; a directory counts every file in it.
//
// The served manifest carries only the fields the service's installed openvibe-contracts
// release-manifest schema declares (1.0.0 has none of the fields above), so /release.json always
// validates against the contracts the service pins. `full()` is the manifest before that filter.
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const SHA_RE = /^[0-9a-f]{7,40}$/;
const ID_RE = /^[a-z][a-z0-9-]{0,39}$/;
const CONTRACT_RE = /^[a-z][a-z0-9-]*(\.[a-z0-9_-]+)+$/;
const KINDS = ['style', 'content', 'script', 'server'];
const V1_0 = ['service', 'release', 'released_at', 'booted_at', 'contracts_version', 'packages', 'min_client_release', 'mixed_version_window_hours'];
const SCHEMA_PATH = 'openvibe-contracts/contracts/registry/release-manifest.v1.json';

function git(root, args) {
    try { return execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).toString().trim(); } catch { return ''; }
}

function pkgVersion(name, root) {
    try { return JSON.parse(fs.readFileSync(require.resolve(`${name}/package.json`, { paths: [root] }), 'utf8')).version || null; } catch { return null; }
}

// ── Versions and ranges ────────────────────────────────────────

function parseVersion(s) {
    const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(s == null ? '' : s).trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function compareVersions(a, b) {
    const x = typeof a === 'string' ? parseVersion(a) : a;
    const y = typeof b === 'string' ? parseVersion(b) : b;
    if (!x || !y) return NaN;
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    return 0;
}
const bump = (v, i) => (i === 0 ? [v[0] + 1, 0, 0] : i === 1 ? [v[0], v[1] + 1, 0] : [v[0], v[1], v[2] + 1]);
const caretTop = (v) => (v[0] > 0 ? bump(v, 0) : v[1] > 0 ? bump(v, 1) : bump(v, 2));

/**
 * A range as the manifest writes it: ">=a.b.c <x.y.z". Accepts "^1.2.0", "~1.2.0", "1.x", "1.2",
 * "1.2.3" (that version only), ">=1.2.0", ">=1.2.0 <3.0.0" and "*"; empty means "^<version>".
 */
function normalizeRange(range, version) {
    const r = String(range == null ? '' : range).trim();
    let lo; let hi; let m;
    if (!r) { lo = parseVersion(version); hi = lo && caretTop(lo); }
    else if (r === '*' || /^x$/i.test(r)) { lo = [0, 0, 0]; hi = [Number.MAX_SAFE_INTEGER, 0, 0]; }
    else if ((m = /^\^(\S+)$/.exec(r))) { lo = parseVersion(m[1]); hi = lo && caretTop(lo); }
    else if ((m = /^~(\S+)$/.exec(r))) { lo = parseVersion(m[1]); hi = lo && bump(lo, 1); }
    else if ((m = /^(\d+)(?:\.(\d+|x|\*))?(?:\.(x|\*))?$/i.exec(r))) {
        const minor = m[2] === undefined || /x|\*/i.test(m[2]) ? null : Number(m[2]);
        lo = [Number(m[1]), minor == null ? 0 : minor, 0];
        hi = bump(lo, minor == null ? 0 : 1);
    } else if ((m = /^>=\s*(\S+)(?:\s+<\s*(\S+))?$/.exec(r))) { lo = parseVersion(m[1]); hi = m[2] ? parseVersion(m[2]) : lo && bump(lo, 0); }
    else if (parseVersion(r)) { lo = parseVersion(r); hi = bump(lo, 2); }
    if (!lo || !hi || !(compareVersions(lo, hi) < 0)) throw new TypeError(`release: cannot read the range "${r}"`);
    return `>=${lo.join('.')} <${hi.join('.')}`;
}

function satisfies(version, range) {
    const m = /^>=(\S+) <(\S+)$/.exec(String(range || ''));
    return !!m && compareVersions(version, m[1]) >= 0 && compareVersions(version, m[2]) < 0;
}

/** { id: '1.2.0' | { version, accepts?, role? } } → the manifest's contract_ranges. */
function contractRanges(input) {
    const out = {};
    for (const [id, spec] of Object.entries(input || {})) {
        if (!CONTRACT_RE.test(id) || id.length > 100) throw new TypeError(`release: contract id "${id}" is not <owner>.<name>`);
        const s = typeof spec === 'string' ? { version: spec } : (spec || {});
        const v = parseVersion(s.version);
        if (!v) throw new TypeError(`release: ${id} needs a version x.y.z`);
        const accepts = normalizeRange(s.accepts, s.version);
        if (!satisfies(v.join('.'), accepts)) throw new TypeError(`release: ${id} accepts ${accepts}, which excludes its own version ${v.join('.')}`);
        const role = s.role || 'produces';
        if (role !== 'produces' && role !== 'consumes') throw new TypeError(`release: ${id} role must be produces or consumes`);
        out[id] = role === 'produces' ? { version: v.join('.'), accepts } : { version: v.join('.'), accepts, role };
    }
    return out;
}

// ── Components and the asset map ───────────────────────────────

function listFiles(abs) {
    let st;
    try { st = fs.statSync(abs); } catch { return null; }
    if (st.isFile()) return [abs];
    if (!st.isDirectory()) return null;
    const out = [];
    for (const e of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        out.push(...(listFiles(path.join(abs, e.name)) || []));
    }
    return out;
}

const within = (base, p) => p === base || p.startsWith(base + path.sep);
const hash12 = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);

function buildComponents({ root, publicDir, spec, release, packages, assetUrl, warn }) {
    const components = {}; const assets = {}; const watched = [];
    const specs = { ...(spec || {}) };
    for (const [id, c] of Object.entries(specs)) {
        if (!ID_RE.test(id)) throw new TypeError(`release: component id "${id}" must match ${ID_RE}`);
        if (!c || !KINDS.includes(c.kind)) throw new TypeError(`release: component ${id} needs kind ${KINDS.join('|')}`);
    }
    if (!specs.shell) specs.shell = { kind: 'script' };
    else if (specs.shell.kind !== 'script') throw new TypeError('release: the shell component is kind script');
    if (!specs.server) specs.server = { kind: 'server' };
    for (const [id, c] of Object.entries(specs)) {
        const h = crypto.createHash('sha256');
        let counted = 0;
        for (const urlPath of c.assets || []) {
            const p = String(urlPath);
            const file = path.resolve(publicDir, '.' + p);
            if (!p.startsWith('/') || p.includes('..') || /[?#\s]/.test(p) || !within(publicDir, file)) throw new TypeError(`release: asset ${p} of ${id} is not a path under publicDir`);
            let buf;
            try { buf = fs.readFileSync(file); } catch { warn(`asset ${p} of component ${id} is missing (${file})`); h.update(`${p}\0missing\0`); continue; }
            watched.push(file);
            if (assets[p]) warn(`asset ${p} is listed by ${assets[p].component} and ${id}`);
            assets[p] = { url: assetUrl(p, hash12(buf)), component: id, integrity: `sha384-${crypto.createHash('sha384').update(buf).digest('base64')}` };
            h.update(`${p}\0`).update(buf).update('\0');
            counted++;
        }
        for (const rel of c.files || []) {
            const abs = path.resolve(root, String(rel));
            const list = within(root, abs) ? listFiles(abs) : null;
            if (!list) { warn(`file ${rel} of component ${id} is missing`); h.update(`${rel}\0missing\0`); continue; }
            for (const f of list) {
                watched.push(f);
                h.update(`${path.relative(root, f)}\0`).update(fs.readFileSync(f)).update('\0');
                counted++;
            }
        }
        if (id === 'shell') h.update(JSON.stringify(packages));
        const stated = c.version != null ? String(c.version) : null;
        const version = stated || (counted ? hash12(h.digest()) : release);
        if (!/^[0-9A-Za-z._+-]{1,64}$/.test(version)) throw new TypeError(`release: component ${id} version "${version}" is not a plain token`);
        components[id] = { kind: c.kind, version };
    }
    return { components, assets, watched };
}

// ── The contract filter ────────────────────────────────────────

/** The service's installed release-manifest schema, or null (then the 1.0.0 fields are served). */
function installedSchema(root) {
    try { return JSON.parse(fs.readFileSync(require.resolve(SCHEMA_PATH, { paths: [root] }), 'utf8')); } catch { return null; }
}

/** Keeps what `schema` allows: properties it names when additionalProperties is false, recursively. */
function project(value, schema) {
    if (!schema || typeof schema !== 'object' || value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return schema.items ? value.map((v) => project(v, schema.items)) : value;
    const props = schema.properties || {};
    const extra = schema.additionalProperties;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
        if (props[k]) out[k] = project(v, props[k]);
        else if (extra === false) continue;
        else out[k] = extra && typeof extra === 'object' ? project(v, extra) : v;
    }
    return out;
}

function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
    return o;
}

// ── /release-metrics: what open tabs report (D46) ──────────────

const OUTCOMES = {
    applied: /^(content|server|style)(\+(content|server|style)){0,2}$/,
    reloaded: /^(user|required|window|contract)$/,
    deferred: /^(typing|dirty|protected|media|capture|active)$/,
    failed: /^(style|style-timeout|content|origin|script)$/,
};
const MAX_BODY = 4096;
const MAX_PER_REASON = 50;
const counters = new WeakMap();

function updateCounter(registry) {
    let c = counters.get(registry);
    if (!c) {
        c = registry.counter({ name: 'release_client_updates_total', help: 'Release updates in open tabs, reported by release-watch: applied in place, reloaded, deferred or failed, by reason', labelNames: ['outcome', 'reason'], maxSeries: 64 });
        counters.set(registry, c);
    }
    return c;
}

/** The report: a string, an object a body parser made, or null when it is over MAX_BODY. */
function readBody(req) {
    const b = req.body;
    if (typeof b === 'string') return Promise.resolve(b.length > MAX_BODY ? null : b);
    if (Buffer.isBuffer(b)) return Promise.resolve(b.length > MAX_BODY ? null : b.toString('utf8'));
    // express.json() leaves {} (and the stream unread) for the text/plain body sendBeacon sends.
    if (b && typeof b === 'object' && (Object.keys(b).length || req.readableEnded)) return Promise.resolve(b);
    return new Promise((resolve) => {
        let size = 0; const chunks = [];
        req.on('data', (c) => { size += c.length; if (size <= MAX_BODY) chunks.push(c); });
        req.on('end', () => resolve(size > MAX_BODY ? null : Buffer.concat(chunks).toString('utf8')));
        req.on('error', () => resolve(''));
    });
}

/**
 * POST handler for release-watch beacons: { counts: { applied|reloaded|deferred|failed: { reason: n } } }.
 * Counts go to release_client_updates_total{outcome,reason} in `registry` (openvibe-shared/metrics).
 * Unknown reasons count as "other"; each reason counts at most 50 per report; a report is at most 4 KB;
 * one address sends at most `perMinute` reports a minute. Sec-GPC/DNT requests are not counted.
 */
function collector(registry, { perMinute = 30 } = {}) {
    if (!registry || typeof registry.counter !== 'function') throw new TypeError('release: collect() needs an openvibe-shared/metrics registry');
    const counter = updateCounter(registry);
    const seen = new Map(); let windowStart = Date.now();
    return async function releaseMetrics(req, res) {
        const done = (code) => { res.statusCode = code; res.setHeader('Cache-Control', 'no-store'); res.end(); };
        const h = req.headers || {};
        if (h['sec-gpc'] === '1' || h.dnt === '1') return done(204);
        const now = Date.now();
        if (now - windowStart > 60000) { seen.clear(); windowStart = now; }
        const ip = String((req.socket && req.socket.remoteAddress) || req.ip || '');
        const n = (seen.get(ip) || 0) + 1;
        if (seen.size < 10000 || seen.has(ip)) seen.set(ip, n);
        if (n > perMinute) return done(429);
        let body = await readBody(req);
        if (body === null) return done(413);
        if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return done(400); } }
        const counts = body && typeof body === 'object' ? body.counts : null;
        if (!counts || typeof counts !== 'object') return done(400);
        for (const [outcome, re] of Object.entries(OUTCOMES)) {
            const reasons = counts[outcome];
            if (!reasons || typeof reasons !== 'object') continue;
            for (const [reason, value] of Object.entries(reasons).slice(0, 16)) {
                const k = Math.min(MAX_PER_REASON, Math.floor(Number(value)));
                if (k > 0) counter.inc({ outcome, reason: re.test(reason) ? reason : 'other' }, k);
            }
        }
        return done(204);
    };
}

// ── createRelease ──────────────────────────────────────────────

function createRelease({
    service, root = process.cwd(), windowHours = 24,
    minClientRelease = process.env.MIN_CLIENT_RELEASE || null,
    packages = ['openvibe-shared', 'openvibe-sdk'],
    components = null, publicDir = null, assetUrl = (p, h) => `${p}?v=${h}`,
    contracts = null, schemaGeneration = null, schemaCompatibleFrom = null,
    metricsPath = null, schema, recheckMs = 0,
    env = process.env, now = () => new Date(), logger = console,
} = {}) {
    if (!/^[a-z][a-z0-9-]{1,39}$/.test(String(service || ''))) throw new TypeError('createRelease: service id required');
    root = path.resolve(root);
    const pub = path.resolve(root, publicDir || 'public');
    const ranges = contractRanges(contracts);   // throws at boot on a malformed range
    const contractSchema = schema === undefined ? installedSchema(root) : schema;
    const bootedAt = now();
    const warnings = [];
    const warn = (msg) => { warnings.push(msg); try { logger.warn(`[release] ${service}: ${msg}`); } catch { /* */ } };
    let metricsUrl = metricsPath || null;
    let state = null; let body = null; let signature = ''; let checkedAt = 0;

    const intOrNull = (v, name) => {
        let x = v;
        try { if (typeof x === 'function') x = x(); } catch (err) { warn(`${name} failed: ${err && err.message}`); return null; }
        if (x == null) return null;
        if (Number.isInteger(x) && x >= 0) return x;
        warn(`${name} is not a non-negative integer`); return null;
    };
    const sigOf = (files) => files.map((f) => { try { const s = fs.statSync(f); return `${s.mtimeMs}:${s.size}`; } catch { return '-'; } }).join('|');

    function build() {
        warnings.length = 0;
        const fromEnv = String(env.RELEASE_COMMIT || '').toLowerCase();
        const sha = SHA_RE.test(fromEnv) ? fromEnv.slice(0, 12) : git(root, ['rev-parse', '--short=12', 'HEAD']);
        const release = SHA_RE.test(sha) ? sha : '0000000';
        const committed = env.RELEASE_AT || git(root, ['log', '-1', '--format=%cI']);
        const releasedAt = Number.isNaN(Date.parse(committed)) ? bootedAt : new Date(committed);
        const versions = {};
        for (const p of packages) { const v = pkgVersion(p, root); if (v) versions[p] = v; }
        const built = buildComponents({ root, publicDir: pub, spec: components, release, packages: versions, assetUrl, warn });
        const generation = intOrNull(schemaGeneration, 'schemaGeneration');
        let compatibleFrom = schemaCompatibleFrom == null ? generation : intOrNull(schemaCompatibleFrom, 'schemaCompatibleFrom');
        if (generation != null && compatibleFrom != null && compatibleFrom > generation) { warn('schemaCompatibleFrom is above schemaGeneration'); compatibleFrom = generation; }
        const full = deepFreeze({
            service,
            release,
            released_at: releasedAt.toISOString(),
            booted_at: bootedAt.toISOString(),
            contracts_version: pkgVersion('openvibe-contracts', root),
            packages: versions,
            min_client_release: minClientRelease && SHA_RE.test(minClientRelease) ? minClientRelease : null,
            mixed_version_window_hours: Math.max(0, Math.floor(Number(windowHours) || 0)),
            components: built.components,
            assets: built.assets,
            schema_generation: generation,
            schema_compatible_from: compatibleFrom,
            contract_ranges: ranges,
            metrics_url: metricsUrl,
        });
        const served = deepFreeze(contractSchema ? project(full, contractSchema) : Object.fromEntries(V1_0.map((k) => [k, full[k]])));
        state = { full, served, watched: built.watched };
        body = JSON.stringify(served);
        signature = sigOf(built.watched);
        checkedAt = Date.now();
        return served;
    }
    build();

    /** Re-reads git, env, files and the schema generation (e.g. after a static-only release switch). */
    function refresh() { return build(); }
    function maybeRecheck() {
        if (!(recheckMs > 0) || Date.now() - checkedAt < recheckMs) return;
        checkedAt = Date.now();
        if (sigOf(state.watched) !== signature) build();
    }

    function handler(_req, res) {
        maybeRecheck();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, max-age=0');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(body);
    }
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const metaTag = (url = '/release.json') => `<meta name="ov-release" content="${esc(state.full.release)}" data-released-at="${esc(state.full.released_at)}" data-url="${esc(url)}"${metricsUrl ? ` data-metrics="${esc(metricsUrl)}"` : ''}>`;

    /** GET /release.json and, with a metrics registry, POST <metricsPath> into release_client_updates_total. */
    function mount(app, { registry = null, path: manifestPath = '/release.json', metricsPath: mp = metricsPath || '/release-metrics', perMinute } = {}) {
        app.get(manifestPath, handler);
        if (registry) {
            app.post(mp, collector(registry, { perMinute }));
            if (metricsUrl !== mp) { metricsUrl = mp; build(); }
        }
        return api;
    }

    /** Validates the served manifest with the service's openvibe-contracts (or the one passed). */
    function validate({ contracts: lib } = {}) {
        let c = lib;
        if (!c) { try { c = require(require.resolve('openvibe-contracts', { paths: [root] })); } catch { return { valid: null, errors: [], reason: 'openvibe-contracts is not installed' }; } }
        const r = c.validate('registry.release-manifest@1', state.served);
        let version = null;
        try { version = c.resolve('registry.release-manifest@1').version; } catch { /* */ }
        return { valid: r.valid, errors: r.errors, contract: version };
    }

    const api = {
        get release() { return state.full.release; },
        manifest: () => state.served,
        full: () => state.full,
        handler,
        metaTag,
        mount,
        collect: (registry, opts) => collector(registry, opts),
        refresh,
        validate,
        warnings,
        /** Which manifest fields the service's contracts let it serve. */
        fields: () => Object.keys(state.served),
    };
    return api;
}

module.exports = { createRelease, normalizeRange, satisfies, compareVersions, parseVersion, contractRanges, project, collector, OUTCOMES };
