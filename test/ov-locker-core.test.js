'use strict';
// ov-locker-core.js is openvibe-sdk/locker for the browser, generated, never edited (scripts/build-locker-core.js):
// the file is what the pinned SDK builds to, it runs where only browser globals exist (a VM with WebCrypto and the
// encoding and stream classes, no require, no Buffer, no process), and the SDK's own test vectors open through it.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { build } = require('../scripts/build-locker-core');
assert.doesNotThrow(() => require('../ov-locker-core'), 'ov-locker-core.js loads in Node too (the browser globals are there)');

const ROOT = path.join(__dirname, '..');
const file = fs.readFileSync(path.join(ROOT, 'ov-locker-core.js'), 'utf8');
assert.strictEqual(file, build(), 'ov-locker-core.js is current: run node scripts/build-locker-core.js');

const ctx = { crypto: globalThis.crypto, TextEncoder, TextDecoder, ReadableStream, TransformStream, WritableStream, Uint8Array, ArrayBuffer, DataView, console, btoa, atob };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(file, ctx);
const C = ctx.OVLockerCore;
const sdk = require('openvibe-sdk/package.json');
assert.strictEqual(C.SDK_VERSION, sdk.version, 'built from the pinned SDK');
['seal', 'open', 'inspect', 'recoveryWords', 'generatePersonKeys', 'exportPersonKeys', 'exportPrivateKeys', 'importPersonKeys', 'fingerprintOf'].forEach((fn) => {
    assert.strictEqual(typeof C[fn], 'function', `the core has ${fn} (ov-locker.js calls it)`);
});

(async () => {
    // The SDK's shared vectors, made again by the browser build: the same headers, the same envelope bytes (SHA-256),
    // the same fingerprint, recovery phrase and inspect answers, as test/locker.test.js checks in the SDK.
    const vectors = require('openvibe-sdk/locker/vectors');
    const sha256 = (b) => require('crypto').createHash('sha256').update(Buffer.from(b)).digest('hex');
    const P = vectors.PERSON;
    const random = vectors.fixedRandom();
    const made = {
        people: await C.seal(vectors.CONTENT, { lock: 'people', keys: [{ subject: vectors.SUBJECT, publicKey: P.ecdhPublic }], random, ephemeral: { private: P.ecdh } }),
        password: await C.seal(vectors.CONTENT, { lock: 'password', password: 'correct horse battery staple', random }),
        link: await C.seal(vectors.CONTENT, { lock: 'link', random }),
    };
    let opened = 0;
    vectors.CASES.forEach((tc) => {
        assert.deepStrictEqual(JSON.parse(JSON.stringify(made[tc.name].header)), tc.header, `the ${tc.name} header`);
        assert.strictEqual(sha256(made[tc.name].bytes), tc.envelope_sha256, `the ${tc.name} envelope, the same bytes`);
        assert.deepStrictEqual(JSON.parse(JSON.stringify(C.inspect(made[tc.name].bytes))), vectors.INSPECT[tc.name], `inspect on ${tc.name}`);
        opened++;
    });
    assert.strictEqual(await C.fingerprintOf(P.ecdhPublic, P.signingPublic), P.fingerprint, 'the same fingerprint');
    assert.strictEqual(C.recoveryWords(24, { random: vectors.fixedRandom(0x5eed1e) }), vectors.RECOVERY.phrase, 'the same recovery phrase');
    const keysBack = await C.importPersonKeys({ ecdh: P.ecdh, signing: P.signing });
    assert.strictEqual(new TextDecoder().decode(await C.open(made.people.bytes, { person: keysBack })), vectors.CONTENT, 'the people vector opens with its person');
    // A round trip made in the browser build opens in Node's SDK, and the other way round.
    const node = require('openvibe-sdk/locker');
    const crossed = await C.seal(new TextEncoder().encode('from the browser'), { lock: 'password', password: 'violet lantern river cobalt' });
    assert.strictEqual(Buffer.from(await node.open(crossed.bytes, { password: 'violet lantern river cobalt' })).toString(), 'from the browser');
    const back = await node.seal(Buffer.from('from node'), { lock: 'password', password: 'violet lantern river cobalt' });
    assert.strictEqual(new TextDecoder().decode(await C.open(back.bytes, { password: 'violet lantern river cobalt' })), 'from node');
    const kit = C.recoveryWords(24);
    assert.strictEqual(String(kit).split(' ').length, 24, 'a recovery kit is 24 words');
    console.log(`ov-locker-core: current with openvibe-sdk ${sdk.version}; ${opened} vectors made again, the same bytes, in a browser-only VM; browser and Node envelopes cross both ways`);
})().catch((e) => { console.error(e); process.exit(1); });
