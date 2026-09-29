'use strict';
/**
 * openvibe-shared/indexnow — tell search engines a page changed, in one POST, per the IndexNow
 * protocol. A site mounts it once at boot (serving its key file) and calls pingSoon() wherever it
 * publishes; batching and debouncing are the module's job, because one publish touches a page, a
 * sitemap and a feed and no engine wants three separate requests for that.
 *
 *   const indexnow = require('openvibe-shared/indexnow').createIndexNow({ host: 'openvibe.wiki', key: process.env.INDEXNOW_KEY });
 *   app.get(`/${key}.txt`, indexnow.keyFile);      // engines fetch the key from here
 *   indexnow.pingSoon(['/wiki/Mars', '/sitemap.xml']);
 *
 * The protocol: POST { host, key, keyLocation, urlList } to api.indexnow.org. Only https URLs that
 * are on `host` belong in the batch (a foreign host is a different key's job), the list is deduped,
 * and one batch may carry at most 10,000 URLs — more are dropped, because a request that large is
 * refused anyway. Nothing here throws: a failed ping must never take a publish down with it, so the
 * failure is logged once and { sent: 0, status } says what happened.
 *
 * A key is 8–128 hex or alphanumeric characters (what IndexNow's own tools generate); anything else
 * is refused at createIndexNow() so a typo cannot quietly produce batches every engine rejects.
 */
const DEFAULT_ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URL_LIST = 10000;
const BATCH_MS = 30000;
const KEY_RE = /^[A-Za-z0-9]{8,128}$/;

/** Accepts 'openvibe.wiki', 'https://openvibe.wiki/' or a full URL; yields the bare host the protocol wants. */
function normaliseHost(host) {
    const s = String(host || '').trim();
    try { return new URL(s).host.toLowerCase(); } catch { /* not a URL: a bare host */ }
    return s.replace(/^[a-z]+:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
}

/**
 * @param {object} o
 * @param {string} o.host the site's host, e.g. 'openvibe.wiki' (a full origin also works)
 * @param {string} o.key the IndexNow key; 8–128 hex/alnum. Unset disables pinging entirely.
 * @param {string} [o.keyLocation] where the key file is served; defaults to `host` + '/' + key + '.txt'
 * @param {string} [o.endpoint] the API endpoint (test and self-hosted servers override it)
 * @param {Function} [o.fetch] the fetch to POST with; defaults to globalThis.fetch
 * @param {Function} [o.log] where a failure is reported once; defaults to console.warn
 * @returns {{keyFile: Function, ping: Function, pingSoon: Function, flush: Function, enabled: boolean}}
 */
function createIndexNow({ host, key, keyLocation, endpoint = DEFAULT_ENDPOINT, fetch: fetchImpl, log } = {}) {
    const theHost = normaliseHost(host);
    const doFetch = fetchImpl || ((...args) => globalThis.fetch(...args));
    const warn = typeof log === 'function' ? log : (...args) => console.warn('[indexnow]', ...args);
    const keySet = key != null && String(key).trim() !== '';
    if (keySet && !KEY_RE.test(String(key).trim())) throw new Error('openvibe-shared/indexnow: key must be 8–128 hex or alphanumeric characters');
    const theKey = keySet ? String(key).trim() : null;
    const location = keyLocation || (theHost && theKey ? `https://${theHost}/${theKey}.txt` : null);

    let queued = new Set();
    let timer = null;

    /** Keep only absolute https URLs on this host, deduped, in insertion order. */
    function clean(urls) {
        const list = Array.isArray(urls) ? urls : urls == null ? [] : [urls];
        const kept = [];
        for (const raw of list) {
            let u;
            try { u = new URL(String(raw)); } catch { continue; }
            if (u.protocol !== 'https:') continue;
            if (normaliseHost(u.host) !== theHost) continue;
            if (queued.has(u.toString()) || kept.includes(u.toString())) continue;
            kept.push(u.toString());
        }
        return kept;
    }

    /**
     * POST one batch now. Never throws.
     * @returns {Promise<{sent: number, status: number|string, skipped?: string}>}
     */
    async function ping(urls) {
        const urlList = clean(urls).slice(0, MAX_URL_LIST);
        if (!theKey) return { sent: 0, status: 0, skipped: 'no key' };
        if (!urlList.length) return { sent: 0, status: 0, skipped: 'nothing to send' };
        const body = { host: theHost, key: theKey, keyLocation: location, urlList };
        try {
            const res = await doFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify(body),
            });
            const status = res && typeof res.status === 'number' ? res.status : 0;
            // 200 and 202 are both accepted by the protocol; anything else is the engine saying no.
            if (status !== 200 && status !== 202) warn(`ping rejected with status ${status} for ${urlList.length} url(s)`);
            return { sent: status === 200 || status === 202 ? urlList.length : 0, status };
        } catch (err) {
            warn(`ping failed for ${urlList.length} url(s): ${err && err.message ? err.message : err}`);
            return { sent: 0, status: 0 };
        }
    }

    /** Sends everything queued now and clears the queue (used by the debounce timer and by tests). */
    async function flush() {
        if (!timer) return { sent: 0, status: 0, skipped: 'empty' };
        clearTimeout(timer);
        timer = null;
        const batch = [...queued];
        queued = new Set();
        return ping(batch);
    }

    /** Queue URLs and send one batch in 30s, coalescing everything published in the meantime. */
    function pingSoon(urls) {
        if (!theKey) return 0;
        for (const u of clean(urls)) queued.add(u);
        if (queued.size && !timer) {
            timer = setTimeout(() => { void flush(); }, BATCH_MS);   // ping never rejects
            if (timer.unref) timer.unref();
        }
        return queued.size;
    }

    /** GET /<key>.txt — the key file the protocol requires engines to be able to fetch. */
    function keyFile(req, res, next) {
        if (typeof next === 'function' && (!req || !req.url || !new RegExp(`^/${theKey}\\.txt/?$`).test(String(req.url).split('?')[0]))) return next();
        if (!theKey) { res.statusCode = 404; return res.end('no key'); }
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.end(theKey);
    }

    return { keyFile, ping, pingSoon, flush, enabled: Boolean(theKey) };
}

module.exports = { createIndexNow, KEY_RE, MAX_URL_LIST, BATCH_MS, DEFAULT_ENDPOINT };
