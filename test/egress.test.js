'use strict';
/** openvibe-shared/egress: one public-address rule for Live, Events and Tools, strict where the old copies disagreed. */
const assert = require('assert');
const http = require('http');
const eg = require('../egress');

let n = 0;
const check = (name, fn) => { fn(); n++; };

check('private, reserved and special IPv4 ranges are refused; public unicast passes', () => {
    for (const ip of ['0.0.0.0', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.0.0.8', '192.0.2.1',
        '192.88.99.1', '192.168.1.1', '198.18.0.1', '198.51.100.7', '203.0.113.9', '224.0.0.1', '240.0.0.1', '255.255.255.255']) assert.strictEqual(eg.isPublicAddress(ip), false, ip);
    for (const ip of ['1.1.1.1', '8.8.8.8', '93.184.216.34', '172.32.0.1', '100.128.0.1']) assert.strictEqual(eg.isPublicAddress(ip), true, ip);
});

check('IPv6: special ranges and every form that wraps a private IPv4 are refused', () => {
    for (const ip of ['::', '::1', 'fe80::1', 'fe80::1%eth0', 'fec0::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '100::1', '2001:db8::1',
        '3fff::1', '5f00::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '::127.0.0.1', '64:ff9b::7f00:1',
        '64:ff9b:1::a9fe:a9fe', '2002:7f00:1::', '2001:0:4136:e378:8000:63bf:80ff:fffe']) assert.strictEqual(eg.isPublicAddress(ip), false, ip);
    for (const ip of ['2606:4700:4700::1111', '2a00:1450:4001::200e', '64:ff9b::808:808', '::ffff:8.8.8.8']) assert.strictEqual(eg.isPublicAddress(ip), true, ip);
    assert.strictEqual(eg.embeddedV4('2001:0:4136:e378:8000:63bf:80ff:fffe'), '127.0.0.1', 'Teredo client address');
    assert.strictEqual(eg.embeddedV4('2002:c0a8:101::1'), '192.168.1.1', '6to4');
    assert.strictEqual(eg.isPublicAddress('not an ip'), false);
});

check('internal names are refused before DNS', () => {
    for (const h of ['localhost', 'LOCALHOST.', 'api.localhost', 'printer.local', 'db.internal', 'nas.home.arpa', 'intranet', '']) assert.strictEqual(eg.isInternalName(h), true, h);
    for (const h of ['openvibe.live', 'example.org.', '8.8.8.8', '[::1]']) assert.strictEqual(eg.isInternalName(h), false, h);
});

const lookupOf = (answers) => (host, _o, cb) => cb(null, answers[host] || []);
(async () => {
    const look = eg.createSafeLookup({ lookup: lookupOf({ 'good.example': [{ address: '93.184.216.34', family: 4 }], 'rebind.example': [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }] }) });
    const call = (h, o) => new Promise((r) => look(h, o, (e, a, f) => r({ e, a, f })));
    let r = await call('good.example', {});
    assert.deepStrictEqual([r.e, r.a, r.f], [null, '93.184.216.34', 4]);
    r = await call('good.example', { all: true });
    assert.deepStrictEqual(r.a, [{ address: '93.184.216.34', family: 4 }]);
    r = await call('rebind.example', {});
    assert.ok(r.e instanceof eg.EgressDenied && r.e.code === 'EGRESS_DENIED', 'any non-public answer fails the whole lookup');
    assert.ok((await call('localhost', {})).e instanceof eg.EgressDenied);
    assert.ok((await call('[::ffff:127.0.0.1]', {})).e instanceof eg.EgressDenied, 'a literal is checked without DNS');
    n++;

    const lk = lookupOf({ 'good.example': [{ address: '93.184.216.34', family: 4 }] });
    assert.strictEqual((await eg.assertPublicUrl('https://good.example/x', { lookup: lk })).hostname, 'good.example');
    for (const bad of ['ftp://good.example/', 'https://user:pw@good.example/', 'http://127.0.0.1/', 'not a url', 'http://nowhere.example/']) {
        await assert.rejects(eg.assertPublicUrl(bad, { lookup: lk }), eg.EgressDenied, bad);
    }
    n++;

    // The real Node stack: a connection through safeLookup to a loopback server is refused at connect time.
    const srv = await new Promise((res) => { const s = http.createServer((q, a) => a.end('secret')).listen(0, '127.0.0.1', () => res(s)); });
    // (Node does not call lookup for an IP literal: callers check literals first, as assertPublicUrl does.)
    const viaName = eg.createSafeLookup({ lookup: lookupOf({ 'rebound.example': [{ address: '127.0.0.1', family: 4 }] }) });
    const err = await new Promise((res) => http.get({ host: 'rebound.example', port: srv.address().port, lookup: viaName }, () => res(null)).on('error', res));
    srv.close();
    assert.ok(err && err.code === 'EGRESS_DENIED', `connect-time refusal (${err && err.code})`);
    n++;
    console.log(`egress: ${n} checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });
