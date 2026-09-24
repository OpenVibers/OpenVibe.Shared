'use strict';
/**
 * openvibe-shared/egress: the one rule for connecting to an address that someone else chose (a URL a
 * user typed, a developer's webhook endpoint, a host a network tool probes). Live, Events and Tools
 * each had their own copy and the copies had drifted; this is the strictest union of them.
 *
 *   isPublicAddress(ip)        true only for a globally routable unicast address: no loopback, RFC 1918,
 *                              link-local (cloud metadata), CGNAT, 0/8, multicast, documentation
 *                              (incl. 3fff::/20), benchmarking, reserved, unique/site-local IPv6, SRv6
 *                              SIDs, and no IPv6 form wrapping one of those (v4-mapped, v4-compatible,
 *                              NAT64 64:ff9b::/96 and 64:ff9b:1::/48, 6to4, Teredo)
 *   embeddedV4(ip), expandV6(ip)
 *   normalizeHost(host), isInternalName(host)   names refused before DNS (localhost, *.local, …)
 *   safeLookup                 dns.lookup replacement for http/https/net: fails unless EVERY answer is
 *                              public, so the socket connects to the checked address (no rebinding).
 *                              Node does not call lookup for an IP literal: check literals first
 *                              (assertPublicUrl does, on every redirect hop)
 *   createSafeLookup({ lookup, isAllowed })     the same with an injected resolver (tests)
 *   assertPublicUrl(url, { lookup, protocols })  -> URL, or throws EgressDenied
 *   EgressDenied               code EGRESS_DENIED
 *
 * No dependencies beyond Node. Server-side only.
 */
const dns = require('dns');
const net = require('net');

const V4_BLOCKED = [
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
    ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
    ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];
const V6_BLOCKED = [
    ['::', 128], ['::1', 128], ['::', 96], ['100::', 64], ['2001::', 23], ['2001:db8::', 32], ['3fff::', 20],
    ['5f00::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
];
const blocked = new net.BlockList();
for (const [a, p] of V4_BLOCKED) blocked.addSubnet(a, p, 'ipv4');
for (const [a, p] of V6_BLOCKED) blocked.addSubnet(a, p, 'ipv6');

/** An IPv6 address as its 8 numeric words, or null. */
function expandV6(ip) {
    let s = String(ip || '').toLowerCase();
    const pct = s.indexOf('%');
    if (pct >= 0) s = s.slice(0, pct);
    if (!net.isIPv6(s)) return null;
    const dq = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (dq) {
        const p = dq[1].split('.').map(Number);
        s = s.slice(0, -dq[1].length) + `${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`;
    }
    const [head, tail] = s.split('::');
    const h = head ? head.split(':') : [];
    const t = tail !== undefined ? (tail ? tail.split(':') : []) : null;
    const words = t === null ? h : [...h, ...Array(8 - h.length - t.length).fill('0'), ...t];
    if (words.length !== 8) return null;
    return words.map((w) => parseInt(w || '0', 16));
}

/** The IPv4 address an IPv6 address reaches (mapped, compatible, NAT64, 6to4, Teredo), or null. */
function embeddedV4(ip) {
    const w = expandV6(ip);
    if (!w) return null;
    const v4 = (hi, lo) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
    const zeros = (a, b) => w.slice(a, b).every((x) => x === 0);
    if (zeros(0, 5) && (w[5] === 0xffff || w[5] === 0) && (w[6] || w[7])) return v4(w[6], w[7]);   // ::ffff:a.b.c.d, ::a.b.c.d
    if (w[0] === 0x64 && w[1] === 0xff9b) return v4(w[6], w[7]);                                      // 64:ff9b::/96 and 64:ff9b:1::/48
    if (w[0] === 0x2002) return v4(w[1], w[2]);                                                       // 6to4
    if (w[0] === 0x2001 && w[1] === 0) return v4(w[6] ^ 0xffff, w[7] ^ 0xffff);                       // Teredo client
    return null;
}

/** True only for a globally routable unicast address the server may connect to for someone else. */
function isPublicAddress(ip) {
    const s = String(ip || '');
    const family = net.isIP(s);
    if (family === 4) return !blocked.check(s, 'ipv4');
    if (family === 6) {
        const bare = s.split('%')[0];
        if (blocked.check(bare, 'ipv6')) return false;
        const v4 = embeddedV4(bare);
        return v4 === null ? true : !blocked.check(v4, 'ipv4');
    }
    return false;
}

/** Lower-case, drop [brackets] and trailing dots. */
function normalizeHost(host) {
    let h = String(host || '').trim().toLowerCase();
    if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
    return h.replace(/\.+$/, '');
}

/** Names that can only mean this machine or a private network: refused before any DNS. */
function isInternalName(host) {
    const h = normalizeHost(host);
    if (net.isIP(h)) return false;
    return !h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')
        || h.endsWith('.home.arpa') || !h.includes('.');
}

class EgressDenied extends Error {
    constructor(message) { super(message); this.name = 'EgressDenied'; this.code = 'EGRESS_DENIED'; this.status = 403; }
}

/** A dns.lookup-compatible function that fails unless every answer passes `isAllowed`. */
function createSafeLookup({ lookup = dns.lookup, isAllowed = isPublicAddress } = {}) {
    return function safeLookup(hostname, options, callback) {
        if (typeof options === 'function') { callback = options; options = {}; }
        const opts = typeof options === 'number' ? { family: options } : { ...(options || {}) };
        const host = normalizeHost(hostname);
        const finish = (addrs) => {
            if (!addrs.length) return callback(new EgressDenied(`no address for ${host}`));
            if (addrs.some((a) => !isAllowed(a.address))) return callback(new EgressDenied(`${host} resolves to a non-public address`));
            if (opts.all) return callback(null, addrs);
            return callback(null, addrs[0].address, addrs[0].family);
        };
        if (net.isIP(host)) return finish([{ address: host, family: net.isIP(host) }]);
        if (isInternalName(host)) return callback(new EgressDenied(`${host} is not a public host name`));
        lookup(host, { all: true, family: opts.family || 0 }, (err, addrs) => (err ? callback(err) : finish(addrs || [])));
    };
}
const safeLookup = createSafeLookup();

/** The URL, once its scheme is allowed and its host resolves to public addresses only; else throws EgressDenied. */
async function assertPublicUrl(url, { lookup, protocols = ['http:', 'https:'] } = {}) {
    let u;
    try { u = url instanceof URL ? url : new URL(String(url)); } catch { throw new EgressDenied('not a URL'); }
    if (!protocols.includes(u.protocol)) throw new EgressDenied(`${u.protocol} is not allowed`);
    if (u.username || u.password) throw new EgressDenied('credentials in the URL are not allowed');
    const look = lookup ? createSafeLookup({ lookup }) : safeLookup;
    await new Promise((resolve, reject) => look(u.hostname, { all: true }, (e) => (e ? reject(e) : resolve())));
    return u;
}

module.exports = {
    isPublicAddress, embeddedV4, expandV6, normalizeHost, isInternalName,
    safeLookup, createSafeLookup, assertPublicUrl, EgressDenied,
    V4_BLOCKED: Object.freeze(V4_BLOCKED.map((x) => Object.freeze(x))), V6_BLOCKED: Object.freeze(V6_BLOCKED.map((x) => Object.freeze(x))),
};
