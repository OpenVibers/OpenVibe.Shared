'use strict';
// Request reduction shared by the PostgreSQL tracker.
const crypto = require('crypto');
const privacy = require('./privacy');
const { allowed } = require('./event');

const SESSION_IDLE_MS = 30 * 60 * 1000;
const MAX_TRACKED_CLIENTS = 200000;
const MAX_BUFFER = 5000;
const SESSION_ID_RE = /^[0-9a-f]{16}$/;
const METHOD_RE = /^[A-Z][A-Z-]{0,15}$/;
const EVENT_NAME_RE = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;
const ALLOWED = { device: allowed('device'), browser: allowed('browser'), os: allowed('os') };

const pad = (n) => String(n).padStart(2, '0');
/** 'YYYY-MM-DD HH:MM:SS' in UTC, the format of CURRENT_TIMESTAMP. */
function sqlTime(ms) {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
const dayOf = (ms) => sqlTime(ms).slice(0, 10);
const hourOf = (ms) => sqlTime(ms).slice(0, 13) + ':00:00';

function isStaticOrHealth(path) {
    return path === '/api/health' || path === '/health' ||
        /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map)$/i.test(path);
}

class AnalyticsTrackerCore {
    constructor(db, service, opts = {}) {
        this.db = db;
        this.service = service;
        this._now = opts.now || Date.now;
        this._pathOpts = privacy.pathOptions({ paramPrefixes: opts.paramPrefixes, pathRules: opts.pathRules });
        this.pruneJob = null;
        this._buffer = [];
        this._visitors = new Map();
        this._sessions = new Map();
        this._rates = new Map();
        this._saltDay = null;
        this._salt = null;
        this._timers = [];
    }

    _sessionId(vhash, nowMs) {
        let s = this._sessions.get(vhash);
        if (!s || nowMs - s.last > SESSION_IDLE_MS) {
            s = { sid: crypto.randomBytes(8).toString('hex'), last: nowMs };
            this._sessions.set(vhash, s);
        }
        s.last = nowMs;
        return s.sid;
    }

    /** Hits from this client in the current and previous minute (memory only). */
    _rateHit(ip, nowMs) {
        const minute = Math.floor(nowMs / 60000);
        let r = this._rates.get(ip);
        if (!r) { r = { minute, count: 0, prev: 0 }; this._rates.set(ip, r); }
        if (r.minute !== minute) {
            r.prev = r.minute === minute - 1 ? r.count : 0;
            r.count = 0;
            r.minute = minute;
        }
        r.count++;
        return r.count + r.prev;
    }

    _sweep() {
        const nowMs = this._now();
        const minute = Math.floor(nowMs / 60000);
        for (const [ip, r] of this._rates) if (r.minute < minute - 1) this._rates.delete(ip);
        for (const [h, s] of this._sessions) if (nowMs - s.last > SESSION_IDLE_MS) this._sessions.delete(h);
        if (this._rates.size > MAX_TRACKED_CLIENTS) this._rates.clear();
        if (this._sessions.size > MAX_TRACKED_CLIENTS) this._sessions.clear();
    }

    _push(event, visitor) {
        if (this._buffer.length >= MAX_BUFFER) this._buffer.shift();
        this._buffer.push(event);
        if (visitor) {
            const key = `${visitor.hour}|${visitor.vhash}`;
            const prev = this._visitors.get(key);
            if (!prev) this._visitors.set(key, visitor);
            else if (visitor.authenticated) prev.authenticated = true;
        }
        if (this._buffer.length >= 100) this.flush();
    }

    /**
     * Record one finished request. `entryPath` is the path as it arrived (req.path inside a mounted
     * router is relative by the time the response finishes). Returns false, recording nothing, for an
     * opted-out request (Sec-GPC: 1 / DNT: 1); true otherwise.
     */
    record(req, res, entryPath, responseTimeMs) {
        const headers = req.headers || {};
        if (privacy.optedOut(headers)) return false;
        entryPath = String(entryPath || '');
        const nowMs = this._now();
        const ua = String(headers['user-agent'] || '');
        const ip = String(req.ip || (req.socket && req.socket.remoteAddress) || '');
        const bot = privacy.classifyRequest({ headers, path: entryPath });
        if (this._rateHit(ip, nowMs) > privacy.HIGH_REQUEST_RATE && !bot.isBot) {
            bot.isBot = true;
            bot.botType = 'rate_limit';
            bot.confidence = 0.80;
        }
        const parsed = privacy.parseUserAgent(ua);
        const day = dayOf(nowMs);
        const vhash = this._visitorHash(ip, ua, day);
        const authenticated = !!(req.user && (req.user.id != null || req.user.sub != null));
        const isApi = entryPath.startsWith('/api/') || entryPath.startsWith('/internal/') || entryPath.startsWith('/oauth/');
        this._push({
            service: this.service,
            event_type: isApi ? 'api_call' : 'pageview',
            path: privacy.routeTemplate(req, entryPath, this._pathOpts),
            method: METHOD_RE.test(String(req.method || '')) ? req.method : null,
            status_code: res.statusCode,
            response_time_ms: responseTimeMs,
            session_id: this._sessionId(vhash, nowMs),
            country: privacy.countryCode(headers['cf-ipcountry']),
            user_agent: privacy.uaClass(ua),
            referer: privacy.refererOrigin(headers.referer || headers.referrer),
            is_bot: bot.isBot,
            bot_type: bot.botType,
            device_type: parsed.device,
            browser: parsed.browser,
            os: parsed.os,
            authenticated,
            created_at: sqlTime(nowMs),
        }, { day, hour: hourOf(nowMs), vhash, authenticated });
        return true;
    }

    /**
     * Express middleware: one row per finished request (health checks, static assets and opted-out
     * requests skipped).
     */
    middleware() {
        return (req, res, next) => {
            const entryPath = req.path || '';
            if (isStaticOrHealth(entryPath) || privacy.optedOut(req.headers)) return next();
            const started = Date.now();
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                try { this.record(req, res, entryPath, Date.now() - started); }
                catch (err) { console.error(`[Analytics:${this.service}] record error:`, err.message); }
            };
            res.once('finish', finish);
            res.once('close', finish);
            next();
        };
    }

    /**
     * A custom (non-HTTP) event. Personal fields in `data` (ip, user_id, city) are ignored; path,
     * referer and user_agent are reduced like a request's; session_id is kept only if it is one of
     * this tracker's rotating ids; any other value outside analytics/event.v1 is stored as NULL, and
     * an event name outside it throws a TypeError. Pass the triggering request's headers as
     * `data.headers` when there is one: an opted-out request (Sec-GPC / DNT) records nothing.
     * Returns whether it recorded.
     */
    trackEvent(eventType, data = {}) {
        const name = String(eventType == null ? 'event' : eventType);
        if (!EVENT_NAME_RE.test(name)) throw new TypeError(`analytics event name must match ${EVENT_NAME_RE} (analytics/event.v1)`);
        if (privacy.optedOut(data.headers)) return false;
        const nowMs = this._now();
        const ua = data.user_agent ? String(data.user_agent) : '';
        const parsed = ua ? privacy.parseUserAgent(ua) : {};
        const method = data.method ? String(data.method).toUpperCase() : null;
        const status = Number(data.status_code);
        const ms = Number(data.response_time_ms);
        const botType = data.bot_type ? String(data.bot_type) : null;
        const pick = (field, given, fallback) => (ALLOWED[field].includes(given) ? given : (fallback || null));
        this._push({
            service: this.service,
            event_type: name,
            path: data.path ? privacy.normalisePath(data.path, this._pathOpts) : null,
            method: method && METHOD_RE.test(method) ? method : null,
            status_code: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
            response_time_ms: Number.isFinite(ms) && ms >= 0 ? Math.round(ms) : null,
            session_id: SESSION_ID_RE.test(String(data.session_id || '')) ? data.session_id : null,
            country: privacy.countryCode(data.country),
            user_agent: ua ? privacy.uaClass(ua) : null,
            referer: privacy.refererOrigin(data.referer),
            is_bot: !!data.is_bot,
            bot_type: botType && /^[a-z0-9_]{1,32}$/.test(botType) ? botType : null,
            device_type: pick('device', data.device_type, parsed.device),
            browser: pick('browser', data.browser, parsed.browser),
            os: pick('os', data.os, parsed.os),
            authenticated: !!data.authenticated,
            created_at: sqlTime(nowMs),
        }, null);
        return true;
    }

}

module.exports = { AnalyticsTrackerCore, sqlTime, dayOf, hourOf };
