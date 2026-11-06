'use strict';
// ov-locker-core.js is openvibe-sdk/locker for the browser, generated, never edited (scripts/build-locker-core.js):
// the file is what the pinned SDK builds to, it runs where only browser globals exist (a VM with WebCrypto and the
// encoding and stream classes, no require, no Buffer, no process), and the SDK's own test vectors open through it.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { build } = require('../scripts/build-locker-core');

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
    // The SDK's vectors, through the browser build.
    const vectors = require('openvibe-sdk/locker/vectors');
    const list = Array.isArray(vectors) ? vectors : vectors.VECTORS || Object.values(vectors).filter((v) => v && v.envelope);
    assert.ok(list.length >= 3, 'the SDK ships vectors for every lock');
    let opened = 0;
    for (const v of list) {
        const bytes = Uint8Array.from(Buffer.from(v.envelope, v.envelope_encoding || 'base64'));
        const creds = v.password ? { password: v.password } : v.key ? { key: Uint8Array.from(Buffer.from(v.key, 'base64url')) } : v.person ? { person: await C.importPersonKeys(v.person) } : null;
        if (!creds) continue;
        const plain = await C.open(bytes, creds);
        assert.strictEqual(Buffer.from(plain).toString('base64'), Buffer.from(v.plaintext, v.plaintext_encoding || 'utf8').toString('base64'), `vector ${v.name || opened} opens`);
        opened++;
    }
    assert.ok(opened >= 3, `the vectors opened (${opened})`);
    // A round trip made in the browser build opens in Node's SDK, and the other way round.
    const node = require('openvibe-sdk/locker');
    const made = await C.seal(new TextEncoder().encode('from the browser'), { lock: 'password', password: 'violet lantern river cobalt' });
    assert.strictEqual(Buffer.from(await node.open(made.bytes, { password: 'violet lantern river cobalt' })).toString(), 'from the browser');
    const back = await node.seal(Buffer.from('from node'), { lock: 'password', password: 'violet lantern river cobalt' });
    assert.strictEqual(new TextDecoder().decode(await C.open(back.bytes, { password: 'violet lantern river cobalt' })), 'from node');
    const words = await C.recoveryWords(24);
    assert.strictEqual(words.length, 24, 'a recovery kit is 24 words');
    console.log(`ov-locker-core: current with openvibe-sdk ${sdk.version}; ${opened} vectors open in a browser-only VM; browser and Node envelopes cross both ways`);
})().catch((e) => { console.error(e); process.exit(1); });
