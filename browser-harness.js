'use strict';
/**
 * openvibe-shared/browser-harness — real-Chrome checks for any OpenVibe site (roadmap WS-Q task 3, WS-T
 * tasks 3 and 4), generalised from Live's test/browser/smoke.js. No dependency: Chrome is driven over the
 * DevTools protocol with Node's own WebSocket (Node 22+), one browser context per site (in-memory cache).
 *
 *   const harness = require('openvibe-shared/browser-harness');
 *   const report = await harness.run({ base: 'https://openvibe.wiki', routes: ['/', '/p/intro', { path: '/nope', status: 404 }] });
 *   console.log(harness.format(report));
 *   process.exit(report.ok ? 0 : 1);
 *
 * For every route, at every width (default 390, 768, 1280), in a fresh tab:
 *   status     the main document's HTTP status is the expected one (200 unless the route says `status`)
 *   errors     no uncaught exception, console.error or browser error log entry (failed loads, CSP)
 *   overflow   the page cannot be scrolled sideways; the widest offending elements are named
 *   scripts    no script URL (origin + path) is requested twice
 * once per route, with JavaScript disabled (the initial HTML, what a crawler reads):
 *   nojs       at least `minText` (200) characters of visible text
 *   canonical  exactly one <link rel=canonical>, an absolute URL; another origin or a different URL with
 *              JavaScript on is a warning; a noindex page (meta robots or X-Robots-Tag) may have none
 *   jsonld     every application/ld+json block parses, and the headline (else name) of each top-level entity
 *              (of an ItemList: 80 % of its item names) is in the visible text: without JavaScript passes, only
 *              with JavaScript warns, nowhere fails
 * once per route, at the widest width:
 *   axe        axe-core, WCAG 2.0/2.1 A and AA rules: serious and critical violations fail, moderate and
 *              minor are reported
 * once per site (`navigation`):
 *   growth     A → B → A, `laps` times (default 5; a link on the page is clicked when there is one, so a
 *              single-page app navigates in place). After a forced GC at the end of each lap the JS heap,
 *              DOM nodes, event listeners, documents (Performance.getMetrics), live intervals, pending
 *              timeouts and open WebSockets (counted by a probe installed before any page script) are
 *              sampled. It fails when a measure grows from the end of lap 2 to the last lap by more than
 *              its budget (BUDGETS) and was still growing over the last half of the laps.
 *   idle       then, after the page settles, `idleMs` (5 s) of doing nothing: CPU busy % (TaskDuration),
 *              requests and bytes. Reported, never failed.
 *
 * Options (run): base (required), routes (paths or { path, status, widths, checks: { nojs: false, … } }),
 *   widths, checks ({ axe: false, navigation: false, … }), navigation ({ from, to, laps, budgets }),
 *   minText, settleMs (quiet time after load, 600), maxSettleMs (15000), idleMs, ignoreErrors (RegExps on the
 *   message or URL, or { label, text, url } where every RegExp given must match; matches are counted per label
 *   in `ignored`, never dropped silently),
 *   axe ({ source } | { path } | { url, sha384 }), browser (a running one from launch()), chrome ({ bin,
 *   browserURL, tmpDir, args }), log (a function, progress lines).
 * Report: { base, startedAt, finishedAt, chrome, routes: [RouteResult], navigation, summary, ok }.
 *
 * axe-core is not vendored (580 KB in every site's node_modules): an installed `axe-core` package is used
 * when one resolves, else AXE.version is fetched once from jsDelivr, checked against AXE.sha384 (the same
 * bytes as the npm tarball), and cached in $XDG_CACHE_HOME/openvibe-shared (or ~/.cache/openvibe-shared).
 * Chrome: CHROME_BIN or the usual paths; `--no-sandbox` unless chrome.sandbox is true.
 */
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WIDTHS = [390, 768, 1280];
const CHECKS = ['status', 'errors', 'overflow', 'scripts', 'nojs', 'canonical', 'jsonld', 'axe'];
/** Growth allowed from the end of lap 2 to the end of the last lap (so over 3 laps with the default 5). */
const BUDGETS = Object.freeze({ heapKB: 3072, nodes: 300, listeners: 30, documents: 1, intervals: 1, timeouts: 10, sockets: 1 });
const AXE = Object.freeze({
    version: '4.13.0',
    url: 'https://cdn.jsdelivr.net/npm/axe-core@4.13.0/axe.min.js',
    sha384: 'jzJDdyy7z7+/I7TeoAg0Gc8k9hD8b1xRN0W18hMptWJ0cdoiebywhPpCyP9eBOgn',
    tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
});
// Entities whose name is not a visible fact of the page (a breadcrumb trail, a search box action, a logo).
const JSONLD_SKIP_TYPES = new Set(['BreadcrumbList', 'ListItem', 'SearchAction', 'EntryPoint', 'ImageObject', 'ContactPoint', 'ReadAction', 'WatchAction']);
const USER_AGENT_SUFFIX = ' OpenVibe-BrowserCheck/1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Chrome and the DevTools protocol ────────────────────────────────────────────────────────────

function findChrome(bin) {
    return [bin, process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((c) => c && fs.existsSync(c)) || null;
}

/** One WebSocket to the browser; pages are flattened sessions on it. */
function connect(wsUrl, onClose) {
    if (typeof WebSocket !== 'function') throw new Error('browser-harness needs Node 22 or later (global WebSocket)');
    const ws = new WebSocket(wsUrl);
    let nextId = 0, closed = false;
    const pending = new Map();
    const listeners = new Map(); // `${sessionId}|${method}` → [fn]
    ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id) {
            const p = pending.get(msg.id);
            if (!p) return;
            pending.delete(msg.id); clearTimeout(p.timer);
            if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`)); else p.resolve(msg.result || {});
            return;
        }
        for (const fn of listeners.get(`${msg.sessionId || ''}|${msg.method}`) || []) {
            try { fn(msg.params || {}); } catch { /* a listener never breaks the connection */ }
        }
    };
    ws.onclose = () => {
        closed = true;
        for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Chrome connection closed')); }
        pending.clear();
        if (onClose) onClose();
    };
    const send = (method, params = {}, sessionId, timeoutMs = 60000) => new Promise((resolve, reject) => {
        if (closed) { reject(new Error('Chrome connection closed')); return; }
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method}: no answer in ${timeoutMs} ms`)); }, timeoutMs);
        pending.set(id, { resolve, reject, timer, method });
        ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    });
    const on = (sessionId, method, fn) => {
        const k = `${sessionId || ''}|${method}`;
        if (!listeners.has(k)) listeners.set(k, []);
        listeners.get(k).push(fn);
    };
    const off = (sessionId) => { for (const k of [...listeners.keys()]) if (k.startsWith(`${sessionId}|`)) listeners.delete(k); };
    const opened = new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error(`cannot connect to ${wsUrl}`)); });
    return { opened, send, on, off, close: () => { try { ws.close(); } catch { /* closed */ } }, get closed() { return closed; } };
}

/**
 * Starts headless Chrome (or attaches to one at chrome.browserURL, e.g. through an ssh tunnel) and answers
 * { version, userAgent, send, newContext(), close() }. close() kills only the process it started and resolves once
 * its temporary profile is removed.
 */
async function launch({ bin, browserURL, tmpDir, args = [], sandbox = false, headless = true } = {}) {
    let proc = null, profile = null, wsUrl;
    if (browserURL) {
        const v = await (await fetch(`${browserURL.replace(/\/$/, '')}/json/version`)).json();
        wsUrl = v.webSocketDebuggerUrl;
    } else {
        const exe = findChrome(bin);
        if (!exe) throw new Error('Chrome not found (set CHROME_BIN)');
        profile = fs.mkdtempSync(path.join(tmpDir || os.tmpdir(), 'ov-harness-'));
        proc = spawn(exe, [
            ...(headless ? ['--headless=new'] : []), '--remote-debugging-port=0', `--user-data-dir=${profile}`,
            ...(sandbox ? [] : ['--no-sandbox']), '--no-first-run', '--no-default-browser-check', '--disable-extensions',
            '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-default-apps',
            // No back/forward cache: kept pages would count in the navigation check's heap, node and document samples.
            '--mute-audio', '--disk-cache-size=16777216', '--window-size=1280,900', '--disable-features=BackForwardCache', ...args, 'about:blank',
        ], { stdio: 'ignore', detached: true }); // its own process group: close() stops Chrome and its helpers together
        const portFile = path.join(profile, 'DevToolsActivePort');
        for (let i = 0; i < 200 && !wsUrl; i++) {
            if (proc.exitCode != null) break;
            try {
                const [port, p] = fs.readFileSync(portFile, 'utf8').split('\n');
                if (port && p) wsUrl = `ws://127.0.0.1:${port.trim()}${p.trim()}`;
            } catch { /* not yet */ }
            if (!wsUrl) await sleep(100);
        }
        if (!wsUrl) { proc.kill('SIGKILL'); fs.rmSync(profile, { recursive: true, force: true }); throw new Error('Chrome did not start'); }
    }
    const conn = connect(wsUrl);
    await conn.opened;
    const version = await conn.send('Browser.getVersion');
    // Only the Chrome this launch started: its process group (the browser and its renderer/GPU helpers, which
    // otherwise outlive a killed browser for a moment and keep writing to the profile).
    const killChrome = () => { if (!proc) return; try { process.kill(-proc.pid, 'SIGKILL'); } catch { try { proc.kill('SIGKILL'); } catch { /* gone */ } } };
    const removeProfile = () => { if (profile) { try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); } catch { /* retried by close() */ } } };
    // A leftover profile per run fills a small disk: if this process ends first, Chrome and the profile go too.
    const onExit = () => { killChrome(); removeProfile(); };
    if (proc) process.once('exit', onExit);
    /** Closes the connection, stops only the Chrome this launch started, and resolves once its profile is gone. */
    const close = () => new Promise((resolve) => {
        conn.close();
        if (!proc) { resolve(); return; }
        const done = async () => {
            for (let i = 0; i < 30 && profile && fs.existsSync(profile); i++) { removeProfile(); if (fs.existsSync(profile)) await sleep(100); }
            process.removeListener('exit', onExit);
            resolve();
        };
        if (proc.exitCode != null || proc.signalCode != null) { killChrome(); done(); return; }
        proc.once('exit', () => { killChrome(); done(); });
        killChrome();
    });
    return {
        version: version.product, userAgent: version.userAgent, pid: proc ? proc.pid : null,
        send: conn.send, on: conn.on, off: conn.off, get closed() { return conn.closed; }, close,
        newContext: async () => {
            const { browserContextId } = await conn.send('Target.createBrowserContext', { disposeOnDetach: false });
            return { id: browserContextId, dispose: () => conn.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {}) };
        },
    };
}

// Installed before any page script (navigation check only): live intervals, pending timeouts, open sockets
// and window/document listeners as the browser keeps them (re-adding the same listener is a no-op).
const PROBE = `(() => {
  if (window.__ovProbe) return;
  const w = window; const intervals = new Set(), timeouts = new Set(), sockets = new Set();
  const si = w.setInterval, ci = w.clearInterval, st = w.setTimeout, ct = w.clearTimeout;
  w.setInterval = function (...a) { const id = si.apply(this, a); intervals.add(id); return id; };
  w.clearInterval = function (id) { intervals.delete(id); timeouts.delete(id); return ci.call(this, id); };
  w.setTimeout = function (fn, ...a) {
    if (typeof fn !== 'function') return st.call(this, fn, ...a);
    let id; id = st.call(this, function (...b) { timeouts.delete(id); return fn.apply(this, b); }, ...a); timeouts.add(id); return id;
  };
  w.clearTimeout = function (id) { timeouts.delete(id); intervals.delete(id); return ct.call(this, id); };
  const WS = w.WebSocket;
  if (WS) {
    w.WebSocket = function (...a) { const s = new WS(...a); sockets.add(s); s.addEventListener('close', () => sockets.delete(s)); return s; };
    w.WebSocket.prototype = WS.prototype; Object.assign(w.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  }
  const counts = {};
  for (const target of [w, document]) {
    const add = target.addEventListener, rem = target.removeEventListener; const key = target === w ? 'window' : 'document';
    const reg = new Map(); counts[key] = () => [...reg.values()].reduce((n, m) => n + [...m.values()].reduce((k, s) => k + s.size, 0), 0);
    const cap = (o) => !!(o === true || (o && o.capture));
    target.addEventListener = function (t, fn, o) {
      if (fn && !(o && o.once)) { if (!reg.has(t)) reg.set(t, new Map()); const m = reg.get(t); if (!m.has(fn)) m.set(fn, new Set()); m.get(fn).add(cap(o)); }
      return add.call(this, t, fn, o);
    };
    target.removeEventListener = function (t, fn, o) { const m = reg.get(t); if (m && m.has(fn)) { m.get(fn).delete(cap(o)); if (!m.get(fn).size) m.delete(fn); } return rem.call(this, t, fn, o); };
  }
  Object.defineProperty(w, '__ovProbe', { value: () => ({ intervals: intervals.size, timeouts: timeouts.size,
    sockets: [...sockets].filter((s) => s.readyState < 2).length, windowListeners: counts.window(), documentListeners: counts.document(),
    href: location.pathname + location.search, timeOrigin: performance.timeOrigin }) });
})();`;

/** A tab in `context`, with its errors, script requests, document status and network activity recorded. */
async function openPage(browser, context, { width = 1280, height = 900, js = true, probe = false } = {}) {
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId: context.id });
    const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (m, p, t) => browser.send(m, p, sessionId, t);
    const on = (m, fn) => browser.on(sessionId, m, fn);
    const st = { errors: [], scripts: new Map(), doc: null, redirects: [], inflight: new Map(), lastActivity: Date.now(), loading: false, requests: 0, bytes: 0, mainFrame: null, urls: [] };
    const activity = () => { st.lastActivity = Date.now(); };
    on('Runtime.exceptionThrown', (p) => {
        const d = p.exceptionDetails || {};
        st.errors.push({ source: 'exception', text: firstLine((d.exception && d.exception.description) || d.text), url: d.url || '' });
    });
    on('Runtime.consoleAPICalled', (p) => {
        if (p.type !== 'error' && p.type !== 'assert') return;
        const text = (p.args || []).map((a) => (a.value !== undefined ? String(a.value) : a.description || a.type)).join(' ');
        const frame = p.stackTrace && p.stackTrace.callFrames && p.stackTrace.callFrames[0];
        st.errors.push({ source: 'console', text: firstLine(text), url: frame ? frame.url : '' });
    });
    on('Log.entryAdded', (p) => {
        const e = p.entry || {};
        if (e.level === 'error') st.errors.push({ source: e.source || 'log', text: firstLine(e.text), url: e.url || '' });
    });
    on('Network.requestWillBeSent', (p) => {
        activity(); st.requests++;
        if (st.urls.length < 500) st.urls.push(p.request.url);
        if (p.type === 'Script') {
            const key = scriptKey(p.request.url);
            if (key) { if (!st.scripts.has(key)) st.scripts.set(key, new Set()); st.scripts.get(key).add(p.requestId); }
        }
        if (p.type === 'Document' && p.frameId === st.mainFrame) {
            if (p.redirectResponse) st.redirects.push({ status: p.redirectResponse.status, url: p.redirectResponse.url });
            else st.redirects = [];
        }
        if (p.type !== 'EventSource') st.inflight.set(p.requestId, p.type);
    });
    on('Network.responseReceived', (p) => {
        activity();
        if (p.type === 'Document' && p.frameId === st.mainFrame) {
            const hdr = Object.fromEntries(Object.entries(p.response.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
            st.doc = { status: p.response.status, url: p.response.url, mimeType: p.response.mimeType, xRobots: hdr['x-robots-tag'] || '' };
        }
    });
    on('Network.dataReceived', (p) => { st.bytes += p.encodedDataLength || 0; });
    on('Network.loadingFinished', (p) => { activity(); st.inflight.delete(p.requestId); });
    on('Network.loadingFailed', (p) => {
        activity(); st.inflight.delete(p.requestId);
        if (p.type === 'Document' && !st.doc && !p.canceled) st.doc = { status: null, error: p.errorText };
    });
    on('Network.webSocketFrameReceived', activity);
    on('Page.frameStartedLoading', (p) => { if (p.frameId === st.mainFrame) { st.loading = true; activity(); } });
    on('Page.frameStoppedLoading', (p) => { if (p.frameId === st.mainFrame) { st.loading = false; activity(); } });
    await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable'), send('Log.enable'), send('Performance.enable')]);
    st.mainFrame = (await send('Page.getFrameTree')).frameTree.frame.id;
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
    if (width < 700) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    // A phone width gets a phone user agent too (sites that choose markup by user agent), marked as this harness.
    const ua = width < 700 ? browser.userAgent.replace(/\([^)]*\)/, '(Linux; Android 10; K)').replace(/ Safari\//, ' Mobile Safari/') : browser.userAgent;
    await send('Network.setUserAgentOverride', { userAgent: ua + USER_AGENT_SUFFIX });
    if (!js) await send('Emulation.setScriptExecutionDisabled', { value: true });
    if (probe) await send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE });

    const evaluate = async (expression, timeoutMs) => {
        const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeoutMs);
        if (r.exceptionDetails) {
            const d = r.exceptionDetails;
            throw new Error(firstLine((d.exception && d.exception.description) || d.text));
        }
        return r.result ? r.result.value : undefined;
    };
    /** Waits for the main frame to stop loading and the network to go quiet (EventSource/WebSocket excluded). */
    const settle = async ({ quietMs = 600, maxMs = 15000, minMs = 300 } = {}) => {
        const start = Date.now();
        await sleep(minMs);
        while (Date.now() - start < maxMs) {
            const idleFor = Date.now() - st.lastActivity;
            // A request that never finishes (long poll) cannot hold the page forever: 3× quiet with no event.
            if (!st.loading && ((st.inflight.size === 0 && idleFor >= quietMs) || idleFor >= quietMs * 3)) return true;
            await sleep(100);
        }
        return false;
    };
    const goto = async (url, opts) => {
        st.doc = null; st.loading = true; activity();
        const r = await send('Page.navigate', { url });
        if (r.errorText) { st.loading = false; if (!st.doc) st.doc = { status: null, error: r.errorText }; }
        return settle(opts);
    };
    const metrics = async () => {
        const { metrics: list } = await send('Performance.getMetrics');
        return Object.fromEntries(list.map((m) => [m.name, m.value]));
    };
    const close = async () => {
        browser.off(sessionId);
        await browser.send('Target.closeTarget', { targetId }).catch(() => {});
    };
    return { send, on, evaluate, settle, goto, metrics, close, state: st };
}

const firstLine = (s) => String(s || '').split('\n')[0].slice(0, 300);
function scriptKey(u) {
    try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.origin + x.pathname : null; } catch { return null; }
}

// ─── Page reads (evaluated in the page) ───────────────────────────────────────────────────────────

const READ_PAGE = `(() => {
  const de = document.documentElement, body = document.body;
  const vw = de.clientWidth;
  const scrollWidth = Math.max(de.scrollWidth, body ? body.scrollWidth : 0);
  const x0 = window.scrollX; window.scrollTo(100000, window.scrollY); const scrollX = window.scrollX; window.scrollTo(x0, window.scrollY);
  const describe = (e) => {
    let s = e.tagName.toLowerCase();
    if (e.id) s += '#' + e.id;
    else if (typeof e.className === 'string' && e.className.trim()) s += '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.');
    return s.slice(0, 80);
  };
  const offenders = [];
  if (scrollX > 0 || scrollWidth > vw + 1) {
    for (const e of body ? body.getElementsByTagName('*') : []) {
      if (offenders.length >= 5) break;
      const r = e.getBoundingClientRect();
      if (!r.width || r.right <= vw + 1) continue;
      if (offenders.some((o) => o.el.contains(e))) continue;
      const cs = getComputedStyle(e);
      if (cs.position === 'fixed' || cs.visibility === 'hidden') continue;
      offenders.push({ el: e, desc: describe(e) + ' (right ' + Math.round(r.right) + 'px)' });
    }
  }
  const text = (body ? body.innerText : '').replace(/\\s+/g, ' ').trim();
  return {
    url: location.href, title: document.title, vw, scrollWidth, scrollX,
    offenders: offenders.map((o) => o.desc),
    canonical: [...document.querySelectorAll('link[rel~="canonical" i]')].map((l) => l.getAttribute('href')),
    robots: [...document.querySelectorAll('meta[name="robots" i]')].map((m) => m.getAttribute('content') || '').join(', '),
    jsonld: [...document.querySelectorAll('script[type="application/ld+json" i]')].map((s) => s.textContent),
    h1: document.querySelectorAll('h1').length, links: document.querySelectorAll('a[href]').length,
    textChars: text.length, text: text.slice(0, 300000),
  };
})()`;

// ─── Pure helpers (tested without a browser) ──────────────────────────────────────────────────────

/** Routes as objects: { path, status, widths, checks }. */
function normalizeRoutes(routes) {
    const list = (routes && routes.length ? routes : ['/']).map((r) => (typeof r === 'string' ? { path: r } : { ...r }));
    for (const r of list) {
        if (!r.path || !String(r.path).startsWith('/')) throw new Error(`browser-harness: route path must start with / (${JSON.stringify(r.path)})`);
        r.status = r.status == null ? 200 : Number(r.status);
        r.checks = { ...(r.checks || {}) };
        // A route answered with an error page is checked for its status, errors and layout, not for SEO.
        if (r.status !== 200) for (const c of ['nojs', 'canonical', 'jsonld']) if (r.checks[c] === undefined) r.checks[c] = false;
    }
    return list;
}

const normText = (s) => String(s || '').normalize('NFKC').toLowerCase()
    .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"').replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ').trim();

/** Where `value` appears in `text`: 'full', 'prefix' (a long value's first 60 characters) or null. */
function findText(text, value) {
    const t = normText(text), v = normText(value).replace(/(\.\.\.|…)$/, '').trim();
    if (!v) return null;
    if (t.includes(v)) return 'full';
    if (v.length > 80 && t.includes(v.slice(0, 60))) return 'prefix';
    return null;
}

const WEBPAGE_TYPES = /(^|,)(WebPage|CollectionPage|AboutPage|ContactPage|ProfilePage|SearchResultsPage|ItemPage|FAQPage|QAPage|CheckoutPage|MedicalWebPage|RealEstateListing)(,|$)/;
/**
 * Where a JSON-LD entity's headline/name (a list: 80 % of its item names) is visible: 'html' (without JavaScript), 'js' (only with it) or null.
 * A title-style name ("Content — OpenVibe.Live") also matches by its leading part, and a web page's name by
 * the document title.
 */
function visibleIn(entity, nojs, jsText) {
    if (entity.items) {
        // At least 80 % of a list's item names (a stale or truncated one may be missing).
        const share = (t) => entity.items.filter((x) => findText(t, x)).length / entity.items.length;
        return share(nojs.text) >= 0.8 ? 'html' : share(jsText) >= 0.8 ? 'js' : null;
    }
    const parts = entity.value.split(/\s+[—–|·-]\s+/);
    const candidates = [entity.value, ...(parts.length > 1 && parts[0].length >= 3 ? [parts[0]] : [])];
    const inText = (t) => candidates.some((c) => findText(t, c));
    if (inText(nojs.text) || (WEBPAGE_TYPES.test(entity.type) && nojs.title && findText(nojs.title, entity.value))) return 'html';
    return inText(jsText) ? 'js' : null;
}

/** Parses JSON-LD blocks: { parseErrors: [msg], entities: [{ type, field, value }] } (top level and @graph). */
function jsonLdEntities(blocks) {
    const parseErrors = [], entities = [];
    (blocks || []).forEach((raw, i) => {
        let data;
        try { data = JSON.parse(raw); } catch (e) { parseErrors.push(`block ${i + 1}: ${e.message}`); return; }
        const nodes = [];
        for (const d of Array.isArray(data) ? data : [data]) {
            if (!d || typeof d !== 'object') continue;
            if (Array.isArray(d['@graph'])) nodes.push(...d['@graph']); else nodes.push(d);
        }
        for (const n of nodes) {
            if (!n || typeof n !== 'object') continue;
            const types = [].concat(n['@type'] || []).map(String);
            if (types.some((t) => JSONLD_SKIP_TYPES.has(t))) continue;
            // A list's facts are its items (its own name is a label, often an aria-label): their names are checked.
            if (types.includes('ItemList') && Array.isArray(n.itemListElement)) {
                const names = n.itemListElement.map((x) => x && (typeof x.name === 'string' ? x.name : x.item && typeof x.item.name === 'string' ? x.item.name : null))
                    .filter((x) => x && x.trim()).map((x) => x.trim());
                if (names.length) { entities.push({ type: types.join(','), field: 'items', value: names.length === 1 ? names[0] : `${names.length} items`, items: names, name: typeof n.name === 'string' ? n.name : undefined }); continue; }
            }
            const field = typeof n.headline === 'string' && n.headline.trim() ? 'headline' : typeof n.name === 'string' && n.name.trim() ? 'name' : null;
            if (field) entities.push({ type: types.join(',') || '?', field, value: n[field].trim() });
        }
    });
    return { parseErrors, entities };
}

/** Growth from sample `from` (index) to the last; fails a measure over budget that still grew over the last half. */
function growth(samples, budgets = BUDGETS, from = 1) {
    const s = samples.filter(Boolean);
    if (s.length < from + 2) return { measured: false, deltas: {}, over: [] };
    const base = s[from], last = s[s.length - 1], mid = s[Math.floor((from + s.length - 1) / 2)];
    const deltas = {}, over = [];
    for (const k of Object.keys(budgets)) {
        if (typeof base[k] !== 'number' || typeof last[k] !== 'number') continue;
        const d = last[k] - base[k];
        deltas[k] = Math.round(d * 10) / 10;
        if (d > budgets[k] && last[k] > mid[k]) over.push({ name: k, from: base[k], to: last[k], delta: deltas[k], budget: budgets[k] });
    }
    return { measured: true, laps: s.length, from: from + 1, deltas, over };
}

/** Same-origin paths from a sitemap (or the <loc>s of a sitemap index), one per first path segment (all /@… count as one), capped. */
function sitemapPaths(xml, base, cap = 4) {
    const origin = new URL(base).origin;
    const seen = new Set(), out = [];
    for (const m of String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
        let u;
        try { u = new URL(m[1].replace(/&amp;/g, '&')); } catch { continue; }
        if (u.origin !== origin) continue;
        const p = u.pathname + u.search;
        // One per section: /p/…, /tool/…; every /@channel is one section.
        const first = u.pathname.split('/')[1] || '';
        const section = first.startsWith('@') ? '@' : first;
        if (p === '/' || seen.has(section)) continue;
        seen.add(section); out.push(p);
        if (out.length >= cap) break;
    }
    return out;
}

function checkRoute(route, r, { minText, ignoreErrors }) {
    const checks = {};
    // A document that is not HTML (an API's JSON 404) is not a page: only its status is judged.
    const types = r.widths.map((w) => w.contentType).filter(Boolean);
    if (types.length && types.every((t) => !/html/i.test(t))) {
        r.contentType = types[0];
        route = { ...route, checks: Object.fromEntries(CHECKS.filter((c) => c !== 'status').map((c) => [c, false])) };
        r.axe = r.axe && { skipped: true };
    }
    const want = (c) => route.checks[c] !== false;
    // status: every width and the no-JS load answered the expected status.
    checks.status = statusesOf(r).every((s) => s === route.status) ? 'pass' : 'fail';
    const { kept, ignored } = splitErrors(r.widths.flatMap((w) => w.errors), ignoreErrors);
    r.errors = dedupe(kept.map((e) => `${e.source}: ${e.text}${e.url && !e.text.includes(e.url) ? ` (${e.url})` : ''}`));
    if (Object.keys(ignored).length) r.ignored = ignored;
    checks.errors = want('errors') ? (r.errors.length ? 'fail' : 'pass') : 'skip';
    checks.overflow = want('overflow') ? (r.widths.some((w) => w.overflow) ? 'fail' : 'pass') : 'skip';
    checks.scripts = want('scripts') ? (r.widths.some((w) => w.duplicateScripts.length) ? 'fail' : 'pass') : 'skip';
    if (r.nojs && !r.nojs.error) {
        const n = r.nojs;
        checks.nojs = !want('nojs') ? 'skip' : n.textChars >= minText ? 'pass' : 'fail';
        if (!want('canonical')) checks.canonical = 'skip';
        // A page that asks not to be indexed needs no canonical URL (one it has is still checked).
        else if (!n.canonical.length && /noindex/i.test(n.robots || '')) { checks.canonical = 'skip'; r.canonical = { found: 0, note: 'noindex page: no canonical needed' }; }
        else if (n.canonical.length !== 1) { checks.canonical = 'fail'; r.canonical = { found: n.canonical.length, note: n.canonical.length ? 'more than one canonical link' : 'no canonical link' }; }
        else {
            const href = n.canonical[0];
            let abs = null;
            try { abs = /^https?:\/\//i.test(href) ? new URL(href) : null; } catch { abs = null; }
            const jsHref = (r.widths.find((w) => w.canonical) || {}).canonical || [];
            r.canonical = { href };
            if (!abs) { checks.canonical = 'fail'; r.canonical.note = 'not an absolute URL'; }
            else {
                const notes = [];
                if (abs.origin !== new URL(r.url).origin) notes.push(`points to ${abs.origin}`);
                if (jsHref.length === 1 && jsHref[0] !== href) notes.push(`JavaScript changes it to ${jsHref[0]}`);
                if (jsHref.length > 1) notes.push(`${jsHref.length} canonical links with JavaScript`);
                checks.canonical = notes.length ? 'warn' : 'pass';
                if (notes.length) r.canonical.note = notes.join('; ');
            }
        }
        if (!want('jsonld')) checks.jsonld = 'skip';
        else {
            const { parseErrors, entities } = jsonLdEntities(n.jsonld);
            const jsText = (r.widths.find((w) => w.width === Math.max(...r.widths.map((x) => x.width))) || {}).text || '';
            const found = entities.map((e) => ({ ...e, found: visibleIn(e, n, jsText) }));
            r.jsonld = { blocks: n.jsonld.length, parseErrors, entities: found };
            checks.jsonld = !n.jsonld.length ? 'skip' : parseErrors.length || found.some((e) => !e.found) ? 'fail' : found.some((e) => e.found === 'js') ? 'warn' : 'pass';
        }
    } else {
        for (const c of ['nojs', 'canonical', 'jsonld']) checks[c] = want(c) && r.nojs && r.nojs.error ? 'fail' : 'skip';
    }
    if (!r.axe || r.axe.skipped) checks.axe = 'skip';
    else if (r.axe.error) checks.axe = 'fail';
    else checks.axe = r.axe.serious + r.axe.critical ? 'fail' : r.axe.moderate ? 'warn' : 'pass';
    r.checks = checks;
    r.ok = !Object.values(checks).includes('fail');
    return r;
}

const dedupe = (a) => [...new Set(a)];

/** Errors not matched by an ignore rule, and a count per rule label of those that were. */
function splitErrors(errors, rules = []) {
    const kept = [], ignored = {};
    for (const e of errors) {
        const rule = rules.find((x) => (x instanceof RegExp ? x.test(e.text) || x.test(e.url || '')
            : (!x.text || x.text.test(e.text)) && (!x.url || x.url.test(e.url || ''))));
        if (!rule) { kept.push(e); continue; }
        const label = rule instanceof RegExp ? String(rule) : rule.label || String(rule.text || rule.url);
        ignored[label] = (ignored[label] || 0) + 1;
    }
    return { kept, ignored };
}
/** The main document's status at every width and without JavaScript (null: no response). */
const statusesOf = (r) => [...r.widths.map((w) => w.status), ...(r.nojs && !r.nojs.error ? [r.nojs.status] : [])];

/** Per check: { pass, warn, fail, skip }; axe impact totals; growth and idle; ok. */
function summarize(report) {
    const checks = {};
    for (const c of CHECKS) checks[c] = { pass: 0, warn: 0, fail: 0, skip: 0 };
    const axe = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const r of report.routes) {
        for (const c of CHECKS) checks[c][(r.checks && r.checks[c]) || 'skip']++;
        if (r.axe && !r.axe.skipped && !r.axe.error) for (const k of Object.keys(axe)) axe[k] += r.axe[k] || 0;
    }
    const nav = report.navigation;
    checks.navigation = { pass: 0, warn: 0, fail: 0, skip: 0 };
    checks.navigation[!nav || nav.skipped ? 'skip' : nav.error || !nav.ok ? 'fail' : 'pass']++;
    const ok = report.routes.every((r) => r.ok) && checks.navigation.fail === 0 && !report.error;
    return { routes: report.routes.length, checks, axe, ok };
}

/** Plain text (default) or Markdown: the failures and warnings, route by route, then the navigation check. */
function format(report, { markdown = false } = {}) {
    const L = [];
    const b = (s) => (markdown ? `**${s}**` : s);
    const code = (s) => (markdown ? `\`${String(s).replace(/`/g, "'")}\`` : String(s));
    L.push(`${b(report.base)}: ${report.ok ? 'pass' : 'FAIL'} (${report.routes.length} route(s), ${report.chrome || 'Chrome'})`);
    if (report.error) L.push(`  error: ${report.error}`);
    for (const r of report.routes) {
        const bad = Object.entries(r.checks || {}).filter(([, v]) => v === 'fail' || v === 'warn');
        if (r.error) { L.push(`- ${code(r.path)}: error: ${r.error}`); continue; }
        if (!bad.length) { L.push(`- ${code(r.path)}: pass${r.contentType ? ` (${r.contentType}: only the status is checked)` : ''}`); continue; }
        L.push(`- ${code(r.path)}: ${bad.map(([k, v]) => `${k} ${v}`).join(', ')}`);
        const d = (s) => L.push(`    - ${s}`);
        if (r.contentType) d(`answered ${r.contentType}, not HTML: only the status is checked`);
        if (r.checks.status === 'fail') d(`status: expected ${r.status}, got ${dedupe(statusesOf(r).map(String)).join('/')}${r.widths.find((w) => w.navError) ? ` (${r.widths.find((w) => w.navError).navError})` : ''}`);
        for (const e of (r.errors || []).slice(0, 6)) d(`error: ${e}`);
        for (const [label, n] of Object.entries(r.ignored || {})) d(`ignored ×${n}: ${label}`);
        if ((r.errors || []).length > 6) d(`… ${r.errors.length - 6} more error(s)`);
        for (const w of r.widths.filter((x) => x.overflow)) d(`overflow at ${w.width}px: page ${w.scrollWidth}px wide; ${w.offenders.join(', ') || 'no single element found'}`);
        for (const w of r.widths.filter((x) => x.duplicateScripts.length)) d(`scripts requested twice at ${w.width}px: ${w.duplicateScripts.map((s) => `${s.url} ×${s.count}`).join(', ')}`);
        if (r.checks.nojs === 'fail') d(r.nojs && r.nojs.error ? `no-JS load failed: ${r.nojs.error}` : `no-JS: only ${r.nojs.textChars} characters of visible text`);
        if (r.canonical && r.canonical.note) d(`canonical: ${r.canonical.note}${r.canonical.href ? ` (${r.canonical.href})` : ''}`);
        if (r.jsonld) {
            for (const e of r.jsonld.parseErrors) d(`JSON-LD does not parse: ${e}`);
            for (const e of r.jsonld.entities.filter((x) => x.found !== 'html')) {
                d(e.items ? `JSON-LD ${e.type}${e.name ? ` ${JSON.stringify(e.name.slice(0, 60))}` : ''}: its ${e.items.length} item names are ${e.found === 'js' ? 'only visible with JavaScript' : 'not in the visible text (80 % needed)'}`
                    : `JSON-LD ${e.type} ${e.field} ${JSON.stringify(e.value.slice(0, 90))} ${e.found === 'js' ? 'is only visible with JavaScript' : 'is not in the visible text'}`);
            }
        }
        if (r.axe && r.axe.error) d(`axe: ${r.axe.error}`);
        for (const v of (r.axe && r.axe.violations) || []) {
            if (v.impact === 'minor') continue;
            d(`axe ${v.impact}: ${v.id} (${v.nodes} node${v.nodes === 1 ? '' : 's'}) ${v.help}: ${v.targets.map(code).join(', ')}`);
        }
    }
    const n = report.navigation;
    if (n && !n.skipped) {
        if (n.error) L.push(`- navigation: error: ${n.error}`);
        else {
            const g = n.growth;
            L.push(`- navigation ${code(n.from)} ↔ ${code(n.to)} ×${n.laps} (${n.mode}): ${n.ok ? 'pass' : 'FAIL'}; growth lap ${g.from}→${g.laps}: ${fmtDeltas(g.deltas)}`);
            for (const o of g.over) L.push(`    - ${o.name} grew ${o.from} → ${o.to} (+${o.delta}, budget ${o.budget})`);
            if (n.idle) {
                const i = n.idle, a = i.animations;
                L.push(`    - idle ${i.seconds}s after settle: CPU ${i.cpuPct}% (script ${i.scriptMs ?? '?'} ms, style ${i.styleMs ?? '?'} ms, layout ${i.layoutMs ?? '?'} ms), ${i.requests} request(s), ${i.kb} KB${i.urls && i.urls.length ? ` (${i.urls.map(code).join(', ')})` : ''}${a && a.running ? `; ${a.running} running animation(s), ${a.infinite} infinite: ${a.list.map(code).join(', ')}` : ''}`);
            }
        }
        for (const e of (n.errors || []).slice(0, 4)) L.push(`    - error during navigation: ${e}`);
    }
    return L.join('\n');
}

function fmtDeltas(d) {
    const parts = [];
    if (d.heapKB !== undefined) parts.push(`heap ${sign(Math.round(d.heapKB))} KB`);
    for (const k of ['nodes', 'listeners', 'documents', 'intervals', 'timeouts', 'sockets']) if (d[k] !== undefined) parts.push(`${k} ${sign(d[k])}`);
    return parts.join(', ') || 'not measured';
}
const sign = (n) => (n > 0 ? `+${n}` : String(n));

// ─── axe-core ─────────────────────────────────────────────────────────────────────────────────────

const axeCache = new Map();
async function axeSource(opt = {}) {
    if (opt.source) return opt.source;
    if (opt.path) return fs.readFileSync(opt.path, 'utf8');
    const url = opt.url || AXE.url, sha = opt.sha384 || AXE.sha384;
    if (axeCache.has(url)) return axeCache.get(url);
    if (!opt.url) {
        try {
            const src = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: [process.cwd(), __dirname] }), 'utf8');
            axeCache.set(url, src);
            return src;
        } catch { /* not installed */ }
    }
    const dir = path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'openvibe-shared');
    const file = path.join(dir, `axe-core-${crypto.createHash('sha256').update(url).digest('hex').slice(0, 12)}.min.js`);
    const verify = (buf) => crypto.createHash('sha384').update(buf).digest('base64') === sha;
    try { const b = fs.readFileSync(file); if (verify(b)) { axeCache.set(url, b.toString('utf8')); return axeCache.get(url); } } catch { /* not cached */ }
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`axe-core download: ${url} answered ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!verify(buf)) throw new Error(`axe-core download: ${url} does not match its pinned sha384`);
    try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, buf); } catch { /* cache is best effort */ }
    axeCache.set(url, buf.toString('utf8'));
    return axeCache.get(url);
}

async function runAxe(page, source, tags = AXE.tags) {
    await page.evaluate(`${source};0`, 60000);
    const json = await page.evaluate(`axe.run(document, { runOnly: { type: 'tag', values: ${JSON.stringify(tags)} }, resultTypes: ['violations'] })
        .then((r) => JSON.stringify(r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
            targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ').slice(0, 120)) }))))`, 120000);
    const violations = JSON.parse(json || '[]');
    const out = { violations, critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const v of violations) if (out[v.impact] !== undefined) out[v.impact]++;
    return out;
}

// ─── Runs ─────────────────────────────────────────────────────────────────────────────────────────

async function checkOneRoute(browser, context, route, o) {
    const url = new URL(route.path, o.base).href;
    const r = { path: route.path, url, status: route.status, widths: [], nojs: null, axe: null };
    const widths = route.widths || o.widths;
    const axeWidth = Math.max(...widths);
    for (const width of widths) {
        const page = await openPage(browser, context, { width });
        try {
            const settled = await page.goto(url, { quietMs: o.settleMs, maxMs: o.maxSettleMs });
            const w = { width, status: page.state.doc ? page.state.doc.status : null, settled, errors: [], duplicateScripts: [] };
            if (page.state.doc && page.state.doc.mimeType) w.contentType = page.state.doc.mimeType;
            if (page.state.doc && page.state.doc.error) w.navError = page.state.doc.error;
            if (page.state.redirects.length) w.redirects = page.state.redirects;
            const s = await page.evaluate(READ_PAGE);
            Object.assign(w, { title: s.title, finalUrl: s.url, scrollWidth: s.scrollWidth, overflow: s.scrollX > 0, offenders: s.offenders, canonical: s.canonical });
            if (width === axeWidth) { w.text = s.text; r.title = s.title; }
            // The browser logs the document's own error status; the status check already judges it.
            const docUrl = page.state.doc && page.state.doc.url;
            w.errors = page.state.errors.filter((e) => !(e.source === 'network' && docUrl && e.url === docUrl));
            w.duplicateScripts = [...page.state.scripts].filter(([, ids]) => ids.size > 1).map(([u, ids]) => ({ url: u, count: ids.size }));
            if (width === axeWidth && o.checks.axe !== false && route.checks.axe !== false) {
                try { r.axe = await runAxe(page, await axeSource(o.axe)); } catch (e) { r.axe = { error: e.message }; }
            } else if (width === axeWidth) r.axe = { skipped: true };
            r.widths.push(w);
        } finally { await page.close(); }
    }
    const wantNoJs = ['nojs', 'canonical', 'jsonld'].some((c) => o.checks[c] !== false && route.checks[c] !== false);
    if (wantNoJs) {
        const page = await openPage(browser, context, { width: axeWidth, js: false });
        try {
            await page.goto(url, { quietMs: o.settleMs, maxMs: o.maxSettleMs });
            const s = await page.evaluate(READ_PAGE);
            r.nojs = { status: page.state.doc ? page.state.doc.status : null, textChars: s.textChars, h1: s.h1, links: s.links, canonical: s.canonical, jsonld: s.jsonld, text: s.text, title: s.title,
                robots: [s.robots, page.state.doc && page.state.doc.xRobots].filter(Boolean).join(', ') };
            if (page.state.doc && page.state.doc.error) r.nojs.error = page.state.doc.error;
        } catch (e) { r.nojs = { error: e.message }; } finally { await page.close(); }
    }
    for (const c of CHECKS) if (o.checks[c] === false) route.checks[c] = false;
    checkRoute(route, r, o);
    // Keep the report small: the page text was only needed for the JSON-LD comparison.
    for (const w of r.widths) delete w.text;
    if (r.nojs) { delete r.nojs.text; delete r.nojs.jsonld; }
    return r;
}

async function sample(page) {
    await page.send('HeapProfiler.collectGarbage').catch(() => {});
    await sleep(200);
    const m = await page.metrics();
    const p = await page.evaluate('window.__ovProbe ? window.__ovProbe() : null').catch(() => null);
    return {
        heapKB: Math.round((m.JSHeapUsedSize || 0) / 1024), nodes: m.Nodes, listeners: m.JSEventListeners, documents: m.Documents,
        intervals: p ? p.intervals : undefined, timeouts: p ? p.timeouts : undefined, sockets: p ? p.sockets : undefined,
        href: p ? p.href : undefined, timeOrigin: p ? p.timeOrigin : undefined,
    };
}

async function navigationCheck(browser, context, o) {
    const n = o.navigation;
    const from = n.from, to = n.to;
    const out = { from, to, laps: n.laps, samples: [] };
    const page = await openPage(browser, context, { width: 1280, probe: true });
    try {
        await page.goto(new URL(from, o.base).href, { quietMs: o.settleMs, maxMs: o.maxSettleMs });
        let modes = new Set();
        const go = async (target) => {
            const before = await page.evaluate('performance.timeOrigin');
            const clicked = await page.evaluate(`(() => {
                const want = ${JSON.stringify(target)};
                const a = [...document.querySelectorAll('a[href]')].find((x) => { try { const u = new URL(x.href, location.href);
                    return u.origin === location.origin && (u.pathname + u.search) === want && !x.target && !x.hasAttribute('download'); } catch (e) { return false; } });
                if (!a) return false; a.click(); return true; })()`);
            if (!clicked) { page.state.loading = true; await page.send('Page.navigate', { url: new URL(target, o.base).href }); }
            await page.settle({ quietMs: o.settleMs, maxMs: o.maxSettleMs, minMs: 500 });
            const after = await page.evaluate('performance.timeOrigin').catch(() => null);
            modes.add(clicked ? (after === before ? 'in-page' : 'link') : 'load');
        };
        for (let i = 0; i < n.laps; i++) {
            if (to !== from) await go(to);
            await go(from);
            if (to === from) await go(from);
            out.samples.push(await sample(page));
        }
        out.mode = [...modes].join('+');
        out.growth = growth(out.samples, n.budgets, 1);
        // Idle: nothing happens for idleMs; what does the page still do?
        await page.settle({ quietMs: o.settleMs, maxMs: o.maxSettleMs });
        const m0 = await page.metrics();
        const r0 = page.state.requests, b0 = page.state.bytes, u0 = page.state.urls.length;
        await sleep(o.idleMs);
        const m1 = await page.metrics();
        const seconds = o.idleMs / 1000;
        const ms = (k) => Math.round(((m1[k] || 0) - (m0[k] || 0)) * 1000);
        out.idle = {
            seconds, cpuPct: Math.round(((m1.TaskDuration - m0.TaskDuration) / seconds) * 1000) / 10,
            scriptMs: ms('ScriptDuration'), styleMs: ms('RecalcStyleDuration'), layoutMs: ms('LayoutDuration'),
            requests: page.state.requests - r0, kb: Math.round((page.state.bytes - b0) / 102.4) / 10,
            urls: dedupe(page.state.urls.slice(u0).map((u) => { try { const x = new URL(u); return x.origin + x.pathname; } catch { return u; } })).slice(0, 5),
            // Running animations keep the page painting while nothing happens (infinite ones never stop).
            animations: await page.evaluate(`(() => { const d = (e) => !e ? '?' : e.tagName.toLowerCase() + (e.id ? '#' + e.id : typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/)[0] : '');
                const run = document.getAnimations().filter((a) => a.playState === 'running');
                return { running: run.length, infinite: run.filter((a) => a.effect && a.effect.getTiming().iterations === Infinity).length,
                    list: [...new Set(run.map((a) => (a.animationName || a.transitionProperty || a.constructor.name) + ' on ' + d(a.effect && a.effect.target)))].slice(0, 4) }; })()`).catch(() => null),
        };
        const { kept, ignored } = splitErrors(page.state.errors, o.ignoreErrors);
        out.errors = dedupe(kept.map((e) => `${e.source}: ${e.text}`));
        if (Object.keys(ignored).length) out.ignored = ignored;
        out.ok = out.growth.over.length === 0;
    } finally { await page.close(); }
    return out;
}

/** Checks one site. Launches Chrome unless `browser` is given; every page runs in a fresh browser context. */
async function run(opts = {}) {
    if (!opts.base) throw new Error('browser-harness: base is required');
    const base = new URL(opts.base).origin + new URL(opts.base).pathname.replace(/\/$/, '');
    const routes = normalizeRoutes(opts.routes);
    const o = {
        base, widths: opts.widths || WIDTHS, checks: { ...(opts.checks || {}) }, minText: opts.minText ?? 200,
        settleMs: opts.settleMs ?? 600, maxSettleMs: opts.maxSettleMs ?? 15000, idleMs: opts.idleMs ?? 5000,
        ignoreErrors: (opts.ignoreErrors || []).map((x) => (typeof x === 'string' ? new RegExp(x) : x)), axe: opts.axe || {},
    };
    const navRoutes = routes.filter((r) => r.status === 200);
    const nav = opts.navigation === false || o.checks.navigation === false || !navRoutes.length ? null : {
        from: (opts.navigation && opts.navigation.from) || navRoutes[0].path,
        to: (opts.navigation && opts.navigation.to) || (navRoutes[1] || navRoutes[0]).path,
        laps: Math.max(3, (opts.navigation && opts.navigation.laps) || 5),
        budgets: { ...BUDGETS, ...((opts.navigation && opts.navigation.budgets) || {}) },
    };
    o.navigation = nav;
    const log = opts.log || (() => {});
    const report = { base, startedAt: new Date().toISOString(), widths: o.widths, routes: [], navigation: null };
    const own = !opts.browser;
    const browser = opts.browser || await launch(opts.chrome || {});
    report.chrome = browser.version;
    try {
        for (const route of routes) {
            const context = await browser.newContext();
            const t0 = Date.now();
            try { report.routes.push(await checkOneRoute(browser, context, route, o)); }
            catch (e) { report.routes.push({ path: route.path, url: new URL(route.path, base).href, status: route.status, widths: [], error: e.message, checks: Object.fromEntries(CHECKS.map((c) => [c, c === 'status' ? 'fail' : 'skip'])), ok: false }); }
            finally { await context.dispose(); }
            const last = report.routes[report.routes.length - 1];
            log(`${base}${route.path} ${last.ok ? 'pass' : 'FAIL'} (${Date.now() - t0} ms)`);
            if (browser.closed) throw new Error('Chrome exited');
        }
        if (nav) {
            const context = await browser.newContext();
            try { report.navigation = await navigationCheck(browser, context, o); }
            catch (e) { report.navigation = { from: nav.from, to: nav.to, error: e.message, ok: false }; }
            finally { await context.dispose(); }
            log(`${base} navigation ${report.navigation.ok ? 'pass' : 'FAIL'}`);
        } else report.navigation = { skipped: true };
    } catch (e) {
        report.error = e.message;
    } finally {
        if (own) await browser.close();
    }
    report.finishedAt = new Date().toISOString();
    report.summary = summarize(report);
    report.ok = report.summary.ok;
    return report;
}

module.exports = {
    run, launch, format, summarize, findChrome, axeSource,
    // pure helpers, exported for tests and for the Host CLI
    normalizeRoutes, jsonLdEntities, findText, visibleIn, growth, sitemapPaths, checkRoute, splitErrors,
    WIDTHS, CHECKS, BUDGETS, AXE, PROBE,
};
