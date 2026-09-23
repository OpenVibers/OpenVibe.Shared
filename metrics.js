'use strict';
// ═══════════════════════════════════════════════════════════════
// openvibe-shared/metrics — Prometheus text-format metrics with no dependencies (roadmap Track O,
// §15.19): a registry (counter, gauge, histogram), golden-signal HTTP middleware keyed by ROUTE
// TEMPLATE, process metrics, release_info, and a /metrics handler only loopback callers reach.
//
//   const metrics = require('openvibe-shared/metrics');
//   const m = metrics.instrument(app, { service: 'community', release: release.release });
//   // mounted: the HTTP middleware (call this before any route) and GET /metrics (loopback only)
//   const depth = m.registry.gauge({ name: 'jobs', help: 'Jobs by state', labelNames: ['state'],
//       collect: () => db.prepare('SELECT state, COUNT(*) n FROM jobs GROUP BY state').all()
//           .map(r => ({ labels: { state: r.state }, value: r.n })) });
//
// Route labels are templates, never raw URLs: `req.baseUrl` (with id-like segments replaced by
// `:id`) + `req.route.path`, or what `normalize(req)` returns. A request no route matched is
// `unmatched`. Every metric caps its label combinations (`maxSeries`); past the cap new
// combinations collapse into one `_overflow` series and metrics_series_overflow_total counts them.
// ═══════════════════════════════════════════════════════════════

const NAME_RE = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;
const LABEL_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const DEFAULT_BUCKETS = Object.freeze([0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]);
const DEFAULT_MAX_SERIES = 500;
const OVERFLOW = '_overflow';
const MAX_LABEL_VALUE = 120;

const escHelp = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
const escValue = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
function fmt(n) {
    if (n === Infinity) return '+Inf';
    if (n === -Infinity) return '-Inf';
    if (Number.isNaN(n)) return 'NaN';
    return String(n);
}
const labelText = (names, values) => (names.length ? `{${names.map((n, i) => `${n}="${escValue(values[i])}"`).join(',')}}` : '');

function createRegistry({ maxSeries = DEFAULT_MAX_SERIES } = {}) {
    const metrics = new Map();
    let overflow = null;   // counter, created on first use so an untroubled registry stays quiet

    function noteOverflow(name) {
        if (!overflow) overflow = counter({ name: 'metrics_series_overflow_total', help: 'Label combinations collapsed into the _overflow series because a metric reached its series cap', labelNames: ['metric'] });
        overflow.inc({ metric: name });
    }

    function base(kind, { name, help, labelNames = [], maxSeries: cap = maxSeries }) {
        if (!NAME_RE.test(String(name || ''))) throw new TypeError(`metrics: invalid metric name ${name}`);
        if (metrics.has(name)) throw new Error(`metrics: ${name} is already registered`);
        if (!help) throw new TypeError(`metrics: ${name} needs help text`);
        for (const l of labelNames) {
            if (!LABEL_RE.test(l) || l.startsWith('__') || (kind === 'histogram' && l === 'le')) throw new TypeError(`metrics: invalid label ${l} on ${name}`);
        }
        const series = new Map();   // key -> { values: [..], ...state }
        function key(labels = {}) {
            const values = labelNames.map((l) => {
                const v = labels[l];
                return v === undefined || v === null ? '' : String(v).slice(0, MAX_LABEL_VALUE);
            });
            return { k: values.join('\u0000'), values };
        }
        function get(labels, init) {
            let { k, values } = key(labels);
            let s = series.get(k);
            if (s) return s;
            if (series.size >= cap && labelNames.length) {
                noteOverflow(name);
                values = labelNames.map(() => OVERFLOW);
                k = values.join('\u0000');
                s = series.get(k);
                if (s) return s;
            }
            s = { values, ...init() };
            series.set(k, s);
            return s;
        }
        return { name, help, labelNames, series, get, kind };
    }

    function counter(opts) {
        const m = base('counter', opts);
        const api = {
            name: m.name,
            inc(labels, value = 1) {
                if (typeof labels === 'number') { value = labels; labels = {}; }
                if (!(value >= 0)) throw new RangeError(`metrics: ${m.name} can only increase`);
                m.get(labels, () => ({ value: 0 })).value += value;
            },
            get: (labels) => (m.series.get(labelsKey(m.labelNames, labels)) || { value: 0 }).value,
            reset: () => m.series.clear(),
            render() {
                const out = [`# HELP ${m.name} ${escHelp(m.help)}`, `# TYPE ${m.name} counter`];
                for (const s of m.series.values()) out.push(`${m.name}${labelText(m.labelNames, s.values)} ${fmt(s.value)}`);
                return out;
            },
        };
        metrics.set(m.name, api);
        return api;
    }

    // collect(): a number (no labels) or [{ labels, value }] read at scrape time. A throwing collect
    // leaves the gauge out of that scrape rather than reporting a stale or invented value.
    function gauge(opts) {
        const m = base('gauge', opts);
        const collect = typeof opts.collect === 'function' ? opts.collect : null;
        const api = {
            name: m.name,
            set(labels, value) {
                if (typeof labels === 'number') { value = labels; labels = {}; }
                m.get(labels, () => ({ value: 0 })).value = Number(value);
            },
            inc(labels, value = 1) {
                if (typeof labels === 'number') { value = labels; labels = {}; }
                m.get(labels, () => ({ value: 0 })).value += value;
            },
            dec(labels, value = 1) {
                if (typeof labels === 'number') { value = labels; labels = {}; }
                m.get(labels, () => ({ value: 0 })).value -= value;
            },
            get: (labels) => (m.series.get(labelsKey(m.labelNames, labels)) || { value: undefined }).value,
            reset: () => m.series.clear(),
            render() {
                if (collect) {
                    let got;
                    try { got = collect(); } catch { return []; }
                    if (got === undefined || got === null) return [];
                    m.series.clear();
                    if (typeof got === 'number') api.set({}, got);
                    else for (const row of got) api.set(row.labels || {}, row.value);
                }
                const out = [`# HELP ${m.name} ${escHelp(m.help)}`, `# TYPE ${m.name} gauge`];
                for (const s of m.series.values()) out.push(`${m.name}${labelText(m.labelNames, s.values)} ${fmt(s.value)}`);
                return out;
            },
        };
        metrics.set(m.name, api);
        return api;
    }

    function histogram(opts) {
        const m = base('histogram', opts);
        const buckets = [...(opts.buckets || DEFAULT_BUCKETS)].map(Number).sort((a, b) => a - b);
        if (!buckets.length || buckets.some((b) => !Number.isFinite(b))) throw new TypeError(`metrics: ${m.name} needs finite buckets`);
        const init = () => ({ counts: new Array(buckets.length).fill(0), sum: 0, count: 0 });
        const api = {
            name: m.name,
            buckets,
            observe(labels, value) {
                if (typeof labels === 'number') { value = labels; labels = {}; }
                if (!Number.isFinite(value)) return;
                const s = m.get(labels, init);
                for (let i = 0; i < buckets.length; i++) if (value <= buckets[i]) s.counts[i]++;
                s.sum += value;
                s.count++;
            },
            startTimer(labels = {}) {
                const t0 = process.hrtime.bigint();
                return (more = {}) => {
                    const seconds = Number(process.hrtime.bigint() - t0) / 1e9;
                    api.observe({ ...labels, ...more }, seconds);
                    return seconds;
                };
            },
            get: (labels) => {
                const s = m.series.get(labelsKey(m.labelNames, labels));
                return s ? { count: s.count, sum: s.sum, buckets: Object.fromEntries(buckets.map((b, i) => [b, s.counts[i]])) } : null;
            },
            reset: () => m.series.clear(),
            render() {
                const out = [`# HELP ${m.name} ${escHelp(m.help)}`, `# TYPE ${m.name} histogram`];
                const names = [...m.labelNames, 'le'];
                for (const s of m.series.values()) {
                    buckets.forEach((b, i) => out.push(`${m.name}_bucket${labelText(names, [...s.values, fmt(b)])} ${s.counts[i]}`));
                    out.push(`${m.name}_bucket${labelText(names, [...s.values, '+Inf'])} ${s.count}`);
                    out.push(`${m.name}_sum${labelText(m.labelNames, s.values)} ${fmt(s.sum)}`);
                    out.push(`${m.name}_count${labelText(m.labelNames, s.values)} ${s.count}`);
                }
                return out;
            },
        };
        metrics.set(m.name, api);
        return api;
    }

    // Callbacks run just before a scrape renders (process metrics sample themselves here).
    const beforeScrape = [];
    function metricsText() {
        for (const f of beforeScrape) { try { f(); } catch { /* a sampler never breaks the scrape */ } }
        const lines = [];
        for (const m of metrics.values()) lines.push(...m.render());
        return lines.join('\n') + '\n';
    }

    return {
        counter, gauge, histogram,
        getMetric: (name) => metrics.get(name) || null,
        onScrape: (f) => { beforeScrape.push(f); },
        metrics: metricsText,
        contentType: 'text/plain; version=0.0.4; charset=utf-8',
    };
}

function labelsKey(names, labels = {}) {
    return names.map((l) => (labels[l] === undefined || labels[l] === null ? '' : String(labels[l]).slice(0, MAX_LABEL_VALUE))).join('\u0000');
}

// ── Route templates ─────────────────────────────────────────────

// A path segment that is an identifier rather than a route word: numbers, UUIDs, ULIDs, prefixed
// subject ids (usr_…), hex digests, and long mixed tokens.
const ID_SEGMENT = /^(?:\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9A-HJKMNP-TV-Z]{26}|[a-z]{2,5}_[0-9A-Za-z]{8,}|[0-9a-f]{12,}|(?=[^/]*\d)[A-Za-z0-9_-]{16,})$/i;

/** Replace id-like segments of a concrete path with `:id` (query strings are dropped). */
function templatePath(p) {
    const clean = String(p || '').split('?')[0];
    return clean.split('/').map((seg) => (seg && ID_SEGMENT.test(seg) ? ':id' : seg)).join('/') || '/';
}

/** The route label of a finished request: the matched route's template, or 'unmatched'. */
function routeLabel(req) {
    if (!req.route || req.route.path === undefined) return 'unmatched';
    const rp = req.route.path;
    const tail = rp instanceof RegExp ? '(regex)' : Array.isArray(rp) ? String(rp[0]) : String(rp);
    const base = req.baseUrl ? templatePath(req.baseUrl) : '';
    const joined = `${base}${tail === '/' && base ? '' : tail}`;
    return (joined || '/').slice(0, MAX_LABEL_VALUE);
}

// ── HTTP golden signals ─────────────────────────────────────────

// skip(req): requests never recorded (long-lived streams such as SSE, whose "duration" is a session).
function httpMetrics(registry, { buckets = DEFAULT_BUCKETS, normalize = null, skip = null, maxRoutes = 300 } = {}) {
    const requests = registry.counter({ name: 'http_requests_total', help: 'HTTP requests by method, route template and status class', labelNames: ['method', 'route', 'status_class'], maxSeries: maxRoutes * 4 });
    const duration = registry.histogram({ name: 'http_request_duration_seconds', help: 'HTTP request duration by method and route template', labelNames: ['method', 'route'], buckets, maxSeries: maxRoutes });
    const inFlight = registry.gauge({ name: 'http_requests_in_flight', help: 'HTTP requests being served' });
    inFlight.set(0);
    const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

    function middleware(req, res, next) {
        try { if (skip && skip(req)) return next(); } catch { /* record it */ }
        const t0 = process.hrtime.bigint();
        inFlight.inc();
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            inFlight.dec();
            let route;
            try { route = normalize ? normalize(req, res) : null; } catch { route = null; }
            if (!route) route = routeLabel(req);
            const method = METHODS.has(req.method) ? req.method : 'OTHER';
            // Closed before the response finished: the client went away (or a stream was cut).
            const status = res.writableFinished || res.finished ? `${Math.floor((res.statusCode || 0) / 100)}xx` : 'aborted';
            requests.inc({ method, route, status_class: status });
            duration.observe({ method, route }, Number(process.hrtime.bigint() - t0) / 1e9);
        };
        res.once('finish', finish);
        res.once('close', finish);
        next();
    }
    return { middleware, requests, duration, inFlight };
}

// ── Process metrics ─────────────────────────────────────────────

function processMetrics(registry, { eventLoopResolutionMs = 20 } = {}) {
    let loop = null;
    try {
        loop = require('perf_hooks').monitorEventLoopDelay({ resolution: eventLoopResolutionMs });
        loop.enable();
    } catch { loop = null; }
    const startSeconds = Math.round((Date.now() - process.uptime() * 1000) / 1000);
    const rss = registry.gauge({ name: 'process_resident_memory_bytes', help: 'Resident set size in bytes' });
    const heapUsed = registry.gauge({ name: 'nodejs_heap_used_bytes', help: 'V8 heap in use in bytes' });
    const heapTotal = registry.gauge({ name: 'nodejs_heap_total_bytes', help: 'V8 heap allocated in bytes' });
    const cpu = registry.gauge({ name: 'process_cpu_seconds_total', help: 'User and system CPU time spent, in seconds' });
    const uptime = registry.gauge({ name: 'process_uptime_seconds', help: 'Seconds since the process started' });
    registry.gauge({ name: 'process_start_time_seconds', help: 'Start time of the process since the Unix epoch, in seconds' }).set(startSeconds);
    const lag = loop && registry.gauge({ name: 'nodejs_eventloop_lag_seconds', help: 'Event-loop delay since the previous scrape', labelNames: ['stat'] });
    registry.onScrape(() => {
        const mem = process.memoryUsage();
        rss.set(mem.rss);
        heapUsed.set(mem.heapUsed);
        heapTotal.set(mem.heapTotal);
        const c = process.cpuUsage();
        cpu.set((c.user + c.system) / 1e6);
        uptime.set(Math.round(process.uptime()));
        if (loop && lag) {
            // The histogram is in nanoseconds; with no samples yet it reports NaN/huge values.
            const ok = loop.count > 0 || loop.max > 0;
            lag.set({ stat: 'mean' }, ok ? loop.mean / 1e9 : 0);
            lag.set({ stat: 'p99' }, ok ? loop.percentile(99) / 1e9 : 0);
            lag.set({ stat: 'max' }, ok ? loop.max / 1e9 : 0);
            loop.reset();
        }
    });
    return { stop: () => { if (loop) loop.disable(); } };
}

/** release_info{service,release} 1 — the deployed release, from openvibe-shared/release. */
function releaseInfo(registry, { service, release }) {
    const g = registry.gauge({ name: 'release_info', help: 'The release this process runs (value is always 1)', labelNames: ['service', 'release'] });
    g.set({ service: String(service || 'unknown'), release: String(release || 'unknown') }, 1);
    return g;
}

// ── /metrics ───────────────────────────────────────────────────

const LOOPBACK = /^(?:127\.\d+\.\d+\.\d+|::1|::ffff:127\.\d+\.\d+\.\d+)$/;
const PROXY_HEADERS = ['x-forwarded-for', 'x-real-ip', 'forwarded', 'cf-connecting-ip', 'true-client-ip'];

/** True only for a direct loopback connection that no proxy relayed. */
function isLoopbackDirect(req) {
    const addr = String((req.socket && req.socket.remoteAddress) || (req.connection && req.connection.remoteAddress) || '');
    if (!LOOPBACK.test(addr)) return false;
    const h = req.headers || {};
    return !PROXY_HEADERS.some((name) => h[name] !== undefined);
}

function metricsHandler(registry) {
    return (req, res) => {
        if (!isLoopbackDirect(req)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.end('{"error":"Not found"}');
        }
        let body;
        try { body = registry.metrics(); } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.end(`# metrics failed: ${String(err && err.message).slice(0, 200)}\n`);
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', registry.contentType);
        res.setHeader('Cache-Control', 'no-store');
        res.end(body);
    };
}

/**
 * Everything at once, for an Express app: a registry with process metrics and release_info, the HTTP
 * middleware mounted first, and GET <path> (default /metrics) for loopback callers.
 * Call it before any route or body parser is mounted.
 */
function instrument(app, { service, release, path = '/metrics', normalize = null, skip = null, buckets, maxRoutes, registry = createRegistry() } = {}) {
    const http = httpMetrics(registry, { normalize, skip, buckets, maxRoutes });
    const proc = processMetrics(registry);
    releaseInfo(registry, { service, release });
    app.use(http.middleware);
    app.get(path, metricsHandler(registry));
    return { registry, http, stop: proc.stop };
}

module.exports = {
    createRegistry,
    httpMetrics,
    processMetrics,
    releaseInfo,
    metricsHandler,
    isLoopbackDirect,
    instrument,
    routeLabel,
    templatePath,
    DEFAULT_BUCKETS,
};
