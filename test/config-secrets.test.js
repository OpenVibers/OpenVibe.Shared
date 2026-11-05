'use strict';
// D11 S2: sealed secrets, x-bind, write-only secret routes, x-env pins, the schema in the summary, requireFresh
// and onChange, reseal() and rotation. The made-up values below exist to prove no form of them leaves the store:
// not a summary, snapshot, history, error, log or values_json.
const assert = require('assert');
const crypto = require('crypto');
let createDb;
try { ({ createDb } = require('openvibe-sdk/db')); } catch { console.log('config-secrets: skipped (openvibe-sdk not installed)'); process.exit(0); }
const express = require('express');
const { configSchema } = require('../config-pg');
const { createConfigStore, adminRoutes } = require('../config');
const { openFingerprintKey } = require('../config-core');

const USER = { type: 'user', id: 'usr_01JAB2C3D4E5F6G7H8J9K0MNPQ' };
const USER2 = { type: 'user', id: 'usr_01JAB2C3D4E5F6G7H8J9K0MNPR' };
const SECRET = 'MADE-UP-KEY-7f3a9c2e1b';
const SECRET2 = 'MADE-UP-ROTATED-2b4d6f8a';
const ENV_SECRET = 'MADE-UP-PINNED-c3d5e7f9';
const K1 = crypto.randomBytes(32);
const K2 = crypto.randomBytes(32);
const b64 = (b) => b.toString('base64');
const keks1 = { current: 'k1', keys: { k1: K1 } };
const keks12 = { current: 'k2', keys: { k1: K1, k2: K2 } };
const logs = [];
const log = (m, level) => logs.push(`${level} ${m}`);

const SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Live provider settings',
    type: 'object', additionalProperties: false,
    properties: {
        provider: { type: 'string', title: 'Provider', description: 'p', 'x-group': 'providers' },
        base_url: { type: 'string' },
        provider_key: { type: 'string', title: 'Provider key', description: 'write only', 'x-group': 'providers', 'x-bind': 'base_url' },
        api_key: { type: 'string', title: 'API key', 'x-group': 'providers' },
        danger_switch: { type: 'boolean', 'x-danger': true, 'x-group': 'danger' },
        price: { type: 'integer', 'x-unit': 'nano_usd' },
        timeout: { type: 'integer', 'x-unit': 'ms' },
    },
};
const DEFAULTS = { provider: 'p', base_url: 'https://a.example' };
const classify = (k) => (/_key$/.test(k) ? 'secret' : undefined);
const activeRow = async (db, ns) => await db.prepare("SELECT * FROM config_snapshots WHERE namespace = ? AND state = 'active'").get(ns);
const storedKey = async (db, ns) => Buffer.from((await db.prepare('SELECT hmac_key FROM config_keys WHERE namespace = ?').get(ns)).hmac_key);
const envelopeOf = async (db, ns, key) => JSON.parse((await activeRow(db, ns)).values_json)[key];
const noSecret = (text, values, what) => {
    for (const s of values) assert.ok(!String(text).includes(s), `${what} leaks a secret`);
};

(async () => {
    const db = createDb({ pglite: true, log: { log() {}, warn() {} } });
    await db.query(configSchema());

    // ── KEKs: every bad shape is refused at startup, naming the variable and the key id, never a byte ──
    const bad = async (opts, re) => {
        let err;
        await assert.rejects(createConfigStore(opts), (e) => { err = e; return re.test(e.message); });
        return err;
    };
    let err = await bad({ db, service: 'live', namespace: 'live.kek.a', keks: { current: 'k1', keys: { k1: Buffer.alloc(31) } } }, /opts\.keks\.keys\.k1/);
    assert.ok(!err.message.includes(b64(Buffer.alloc(31))), 'the error never carries the key');
    await bad({ db, service: 'live', namespace: 'live.kek.b', keks: { current: 'k1', keys: { k1: 'a string' } } }, /opts\.keks\.keys\.k1/);
    await bad({ db, service: 'live', namespace: 'live.kek.c', keks: { current: 'k9', keys: { k1: K1 } } }, /opts\.keks\.current/);
    await bad({ db, service: 'live', namespace: 'live.kek.d', keks: { keys: { k1: K1 } } }, /opts\.keks\.current/);
    await bad({ db, service: 'live', namespace: 'live.kek.e', env: { OV_CONFIG_KEKS: `k1:${b64(Buffer.alloc(31))}`, OV_CONFIG_KEK_CURRENT: 'k1' } }, /OV_CONFIG_KEKS/);
    await bad({ db, service: 'live', namespace: 'live.kek.f', env: { OV_CONFIG_KEKS: `k1:${b64(K1)}` } }, /OV_CONFIG_KEK_CURRENT/);
    await bad({ db, service: 'live', namespace: 'live.kek.g', env: { OV_CONFIG_KEKS: `k1:${b64(K1)},bad`, OV_CONFIG_KEK_CURRENT: 'k1' } }, /OV_CONFIG_KEKS/);
    await bad({ db, service: 'live', namespace: 'live.kek.h', env: { OV_CONFIG_KEKS: `k1:${b64(K1)},k1:${b64(K2)}`, OV_CONFIG_KEK_CURRENT: 'k1' } }, /twice/);
    const envStore = await createConfigStore({ db, service: 'live', namespace: 'live.kek.env', env: { OV_CONFIG_KEKS: `k1:${b64(K1)}`, OV_CONFIG_KEK_CURRENT: 'k1' }, log });
    assert.strictEqual(envStore.sealed, true);
    assert.strictEqual(envStore.kek, 'k1');

    // ── Sealed storage: values_json holds envelopes, get() opens them, nothing else shows the value ──
    const activations = [];
    const changes = [];
    let failNext = null;
    const live = await createConfigStore({
        db, service: 'live', namespace: 'live.sealed', schema: SCHEMA, classify, defaults: DEFAULTS, keks: keks1, log,
        onActivate: async (values) => { activations.push(values); if (failNext) { const e = failNext; failNext = null; throw e; } },
        onChange: async (e) => changes.push(e),
    });
    assert.strictEqual(live.sealed, true);
    await live.apply({ provider_key: SECRET, api_key: SECRET2, price: 1000, timeout: 250 }, { actor: USER, reason: 'keys' });
    assert.strictEqual(live.get('provider_key'), SECRET, 'the service gets the plaintext');
    assert.strictEqual(live.get('api_key'), SECRET2);
    assert.strictEqual(activations.at(-1).provider_key, SECRET, 'onActivate gets the plaintext');
    const sealedRow = await activeRow(db, 'live.sealed');
    const sealedValues = JSON.parse(sealedRow.values_json);
    for (const k of ['provider_key', 'api_key']) {
        assert.match(sealedValues[k], /^v1:k1:[0-9a-f]{64}:/, `${k} is an envelope`);
        assert.ok(!sealedValues[k].includes(SECRET) && !sealedValues[k].includes(SECRET2));
    }
    noSecret(sealedRow.values_json, [SECRET, SECRET2], 'values_json');
    noSecret(JSON.stringify(await live.snapshot(live.revision())), [SECRET, SECRET2], 'snapshot');
    noSecret(JSON.stringify(await live.history({ limit: 200 })), [SECRET, SECRET2], 'history');
    noSecret(JSON.stringify(await live.lastKnownGood()), [SECRET, SECRET2], 'last-known-good');
    noSecret(JSON.stringify(await live.summary()), [SECRET, SECRET2], 'summary');
    const summary = await live.summary();
    assert.strictEqual(summary.sealed, true);
    assert.strictEqual(summary.kek, 'k1');
    assert.deepStrictEqual(summary.values.provider_key, { redacted: true, fingerprint: summary.secrets.provider_key.fingerprint });
    assert.strictEqual(summary.secrets.provider_key.hint, SECRET.slice(-4), 'the four-character hint');
    assert.strictEqual(summary.secrets.provider_key.bound_to, 'https://a.example', 'bound to the base URL');
    assert.deepStrictEqual(summary.secrets.provider_key.set_by, USER);
    assert.match(summary.secrets.provider_key.set_at, /^\d{4}-\d\d-\d\dT/);
    assert.strictEqual(summary.secrets.api_key.bound_to, null);
    // The schema is in the summary, with the owner annotations intact.
    assert.strictEqual(summary.schema.properties.provider.title, 'Provider');
    assert.strictEqual(summary.schema.properties.provider['x-group'], 'providers');
    assert.strictEqual(summary.schema.properties.danger_switch['x-danger'], true);
    assert.strictEqual(summary.schema.properties.provider_key['x-bind'], 'base_url');
    assert.strictEqual(summary.schema.properties.price['x-unit'], 'nano_usd');
    // A database dump (config_keys plus snapshots) has no key that reproduces a fingerprint.
    const dumpKey = await storedKey(db, 'live.sealed');
    assert.ok(dumpKey.toString('utf8').startsWith('ovfp.v1.'), 'config_keys holds a KEK-wrapped key, not the fingerprint key');
    assert.notStrictEqual(dumpKey.length, 32);
    const unwrapped = openFingerprintKey(dumpKey, { service: 'live', namespace: 'live.sealed', keys: new Map([['k1', K1]]) });
    assert.strictEqual(unwrapped.key.length, 32);
    assert.ok(!dumpKey.equals(unwrapped.key));
    assert.notStrictEqual(crypto.createHmac('sha256', dumpKey).update(JSON.stringify(SECRET)).digest('hex'), summary.secrets.api_key.fingerprint);
    for (const r of await db.prepare('SELECT namespace, hmac_key FROM config_keys').all()) {
        const b = Buffer.from(r.hmac_key);
        assert.ok(!b.includes(unwrapped.key), `${r.namespace} config_keys holds the raw fingerprint key`);
        if (b.length === 32) assert.notStrictEqual(crypto.createHmac('sha256', b).update(JSON.stringify(SECRET)).digest('hex'), summary.secrets.api_key.fingerprint, `${r.namespace} reproduces the marker`);
    }
    for (const r of await db.prepare('SELECT namespace, values_json FROM config_snapshots').all()) {
        assert.ok(!Buffer.from(r.values_json).includes(unwrapped.key), `${r.namespace} values_json holds the raw fingerprint key`);
    }
    // Restart: the same KEK reads the same values and the same markers.
    const restarted = await createConfigStore({ db, service: 'live', namespace: 'live.sealed', schema: SCHEMA, classify, defaults: DEFAULTS, keks: keks1, log });
    assert.strictEqual(restarted.get('provider_key'), SECRET);
    assert.deepStrictEqual((await restarted.summary()).values, summary.values, 'stable fingerprints');
    summary.values.provider = 'MUTATED';
    summary.values.base_url = 'https://mutated.example';
    assert.strictEqual(live.get('provider'), 'p', 'a summary copy cannot change the store');
    assert.strictEqual(live.get('base_url'), 'https://a.example');

    // ── x-bind: a changed bound value locks the secret; entering it again binds it to the new value; rollback restores both ──
    const beforeBind = live.revision();
    await live.apply({ base_url: 'https://b.example' }, { merge: true, actor: USER, reason: 'new host' });
    assert.strictEqual(live.get('base_url'), 'https://b.example');
    assert.strictEqual(live.get('provider_key'), undefined, 'the secret no longer opens');
    assert.strictEqual(live.get('api_key'), SECRET2, 'an unbound secret is untouched');
    const lockedSummary = await live.summary();
    assert.ok(lockedSummary.values.provider_key.redacted, 'it is still shown as set');
    assert.strictEqual(lockedSummary.secrets.provider_key.bound_to, 'https://a.example', 'the marker names what it was sealed to');
    noSecret(JSON.stringify(lockedSummary), [SECRET], 'locked summary');
    await live.setSecret('provider_key', SECRET, { actor: USER, reason: 'for the new host' });
    assert.strictEqual(live.get('provider_key'), SECRET, 'entering it again seals it to the new bind');
    assert.strictEqual((await live.summary()).secrets.provider_key.bound_to, 'https://b.example');
    const boundAgain = live.revision();
    const envelopeAtBind = await envelopeOf(db, 'live.sealed', 'provider_key');
    await live.apply({ base_url: 'https://c.example' }, { merge: true, actor: USER });
    assert.strictEqual(live.get('provider_key'), undefined);
    const rolled = await live.rollback({ to: boundAgain, actor: USER, reason: 'back to b' });
    assert.strictEqual(rolled.copied_from, boundAgain, 'the rollback copies the revision that had both b and the key');
    assert.strictEqual(live.get('base_url'), 'https://b.example');
    assert.strictEqual(live.get('provider_key'), SECRET, 'rolling back the bind restores the sealed value');
    assert.strictEqual(await envelopeOf(db, 'live.sealed', 'provider_key'), envelopeAtBind, 'the rollback restored the envelope itself');

    // A new secret may not bind to a secret-class key, and x-bind must name a known, unbound key.
    await assert.rejects(createConfigStore({
        db, service: 'live', namespace: 'live.bindsecret', schema: { type: 'object', properties: { a_key: { type: 'string' }, b_key: { type: 'string', 'x-bind': 'a_key' } } }, classify, keks: keks1, log,
    }), /x-bind/);
    await assert.rejects(createConfigStore({ db, service: 'live', namespace: 'live.bindunknown', schema: { type: 'object', properties: { a_key: { type: 'string', 'x-bind': 'nope' } } }, classify, keks: keks1, log }), /unknown key/);
    await assert.rejects(createConfigStore({ db, service: 'live', namespace: 'live.bindself', schema: { type: 'object', properties: { a_key: { type: 'string', 'x-bind': 'a_key' } } }, classify, keks: keks1, log }), /itself/);

    // A copied envelope does not open under another key (the AAD names the key), and never becomes a value.
    const providerEnvelope = await envelopeOf(db, 'live.sealed', 'provider_key');
    await live.setSecret('api_key', providerEnvelope, { actor: USER, reason: 'a copy' });
    assert.strictEqual(live.get('api_key'), undefined, 'a copied envelope is locked');
    assert.strictEqual(JSON.parse((await activeRow(db, 'live.sealed')).values_json).api_key, providerEnvelope, 'it is stored as the envelope, not as the other value');
    await live.setSecret('api_key', SECRET2, { actor: USER, reason: 'entered again' });
    assert.strictEqual(live.get('api_key'), SECRET2);

    // ── Write-only secret routes on Express ──
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        const who = req.headers['x-test-user'];
        if (who === 'owner') req.user = { id: 2, role: 'admin', owner: true, subject_id: USER2.id };
        else if (who === 'admin') req.user = { id: 1, role: 'admin', subject_id: USER.id };
        else if (who === 'nosubject') req.user = { id: 3, role: 'admin' };
        next();
    });
    const requireAdmin = (req, res, next) => (req.user && req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin only' }));
    const authorize = (req, { action, keys }) => action === 'read' || (req.user && req.user.owner) || !keys.some((k) => live.classify(k, undefined) === 'secret');
    let freshOk = false;
    const freshCalls = [];
    const requireFresh = (req, ctx) => { freshCalls.push(ctx); return freshOk; };
    adminRoutes([live], { requireAdmin, authorize, requireFresh, actor: (req) => ({ type: 'user', id: req.user.subject_id }) }).mount(app);
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const texts = [];
    async function call(method, path, { user = 'admin', body } = {}) {
        const res = await fetch(base + path, { method, headers: { 'x-test-user': user, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
        const text = await res.text();
        texts.push(text);
        return { status: res.status, type: res.headers.get('content-type') || '', body: text ? JSON.parse(text) : null };
    }
    const beforeFresh = live.revision();
    let res = await call('PUT', '/api/admin/config/live.sealed/secrets/api_key', { user: 'owner', body: { value: SECRET, reason: 'fresh?' } });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.code, 'config.fresh_required');
    assert.strictEqual(live.revision(), beforeFresh, 'a refused fresh check writes nothing');
    assert.deepStrictEqual(freshCalls.at(-1), { namespace: 'live.sealed', keys: ['api_key'] });
    freshOk = true;
    res = await call('PUT', '/api/admin/config/live.sealed/secrets/api_key', { user: 'owner', body: { value: SECRET, reason: 'owner key' } });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.deepStrictEqual(Object.keys(res.body).sort(), ['bound_to', 'fingerprint', 'hint', 'redacted', 'set_at', 'set_by']);
    assert.ok(!JSON.stringify(res.body).includes(SECRET));
    assert.strictEqual(res.body.set_by.id, USER2.id);
    assert.strictEqual(live.get('api_key'), SECRET);
    assert.deepStrictEqual(changes.at(-1).keys, ['api_key'], 'a secret write raises onChange');
    assert.strictEqual(JSON.parse((await activeRow(db, 'live.sealed')).values_json).api_key.startsWith('v1:'), true);
    // A normal POST is not a secret write path.
    res = await call('POST', '/api/admin/config/live.sealed', { user: 'owner', body: { values: { api_key: SECRET2 }, merge: true } });
    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.body.code, 'config.secret_write_only');
    // Even the value it already holds may not be carried through the normal route.
    res = await call('POST', '/api/admin/config/live.sealed', { user: 'owner', body: { values: { api_key: SECRET }, merge: true } });
    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.body.code, 'config.secret_write_only');
    res = await call('POST', '/api/admin/config/live.sealed', { user: 'owner', body: { values: {}, merge: true, unset: ['api_key'] } });
    assert.strictEqual(res.status, 422, 'unsetting a secret through the normal route is write-only too');
    assert.strictEqual(res.body.code, 'config.secret_write_only');
    assert.strictEqual(live.get('api_key'), SECRET);
    // A marker round trip is allowed: it carries no value.
    res = await call('POST', '/api/admin/config/live.sealed', { user: 'owner', body: { values: { api_key: (await live.summary()).values.api_key }, merge: true, reason: 'form' } });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(live.get('api_key'), SECRET);
    // Only a secret-class key can be written through the secret route.
    res = await call('PUT', '/api/admin/config/live.sealed/secrets/provider', { user: 'owner', body: { value: 'x', reason: 'nope' } });
    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.body.code, 'config.not_secret');
    // A missing value is a bad request, never an empty secret.
    res = await call('PUT', '/api/admin/config/live.sealed/secrets/api_key', { user: 'owner', body: { reason: 'missing' } });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'config.bad_request');
    // An admin who does not own the secret is refused before write-only/fresh checks.
    res = await call('PUT', '/api/admin/config/live.sealed/secrets/api_key', { user: 'admin', body: { value: SECRET2, reason: 'no' } });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.code, 'config.forbidden');
    // DELETE needs a fresh sign-in too, then writes a new revision without the key and answers the empty marker.
    freshOk = false;
    res = await call('DELETE', '/api/admin/config/live.sealed/secrets/api_key', { user: 'owner', body: { reason: 'gone' } });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.code, 'config.fresh_required');
    assert.strictEqual(live.get('api_key'), SECRET, 'a refused delete changes nothing');
    freshOk = true;
    res = await call('DELETE', '/api/admin/config/live.sealed/secrets/api_key', { user: 'owner', body: { reason: 'gone' } });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.deepStrictEqual(Object.keys(res.body).sort(), ['bound_to', 'fingerprint', 'hint', 'redacted', 'set_at', 'set_by']);
    assert.strictEqual(res.body.fingerprint, null);
    assert.strictEqual(live.get('api_key'), undefined);
    assert.ok(!JSON.stringify(JSON.parse((await activeRow(db, 'live.sealed')).values_json)).includes('api_key'));
    res = await call('DELETE', '/api/admin/config/live.sealed/secrets/api_key', { user: 'owner', body: { reason: 'again' } });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.code, 'config.secret_not_set');
    // An x-danger key needs a fresh sign-in through a normal POST, and no secret is involved.
    freshOk = false;
    res = await call('POST', '/api/admin/config/live.sealed', { user: 'owner', body: { values: { danger_switch: true }, merge: true, reason: 'money' } });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.code, 'config.fresh_required');
    assert.deepStrictEqual(freshCalls.at(-1), { namespace: 'live.sealed', keys: ['danger_switch'] });
    freshOk = true;
    res = await call('POST', '/api/admin/config/live.sealed', { user: 'owner', body: { values: { danger_switch: true }, merge: true, reason: 'money' } });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(live.get('danger_switch'), true);
    noSecret(texts.join('\n'), [SECRET, SECRET2], 'responses');
    assert.ok(texts.every((x) => !x.includes(SECRET)));
    server.closeAllConnections();
    server.close();

    // A plain http server dispatches the two new routes too.
    const plain = adminRoutes([live], { requireAdmin: (_q, _s, nx) => nx(), requireFresh: () => true, actor: () => USER });
    const plainServer = require('http').createServer((req, res) => plain.handle(req, res));
    plainServer.listen(0);
    await new Promise((r) => plainServer.once('listening', r));
    const pbase = `http://127.0.0.1:${plainServer.address().port}`;
    const pr = await fetch(`${pbase}/api/admin/config/live.sealed/secrets/api_key`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: SECRET, reason: 'plain' }) });
    assert.strictEqual(pr.status, 200, await pr.clone().text());
    assert.strictEqual(live.get('api_key'), SECRET);
    const pdel = await fetch(`${pbase}/api/admin/config/live.sealed/secrets/api_key`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: '{"reason":"plain"}' });
    assert.strictEqual(pdel.status, 200);
    plainServer.close();

    // ── x-env pins: the env's value is effective and read-only in the store and the routes ──
    const pinSchema = {
        type: 'object', additionalProperties: false,
        properties: {
            base_url: { type: 'string', 'x-env': 'OV_TEST_BASE_URL' },
            max: { type: 'integer', 'x-env': 'OV_TEST_MAX' },
            pinned_key: { type: 'string', 'x-env': 'OV_TEST_PINNED_KEY' },
            free: { type: 'string' },
        },
    };
    const pinEnv = { OV_TEST_BASE_URL: 'https://pinned.example', OV_TEST_MAX: '42', OV_TEST_PINNED_KEY: ENV_SECRET };
    const pinned = await createConfigStore({ db, service: 'live', namespace: 'live.pins', schema: pinSchema, classify, env: pinEnv, defaults: { free: 'f' }, keks: keks1, log });
    assert.strictEqual(pinned.get('base_url'), 'https://pinned.example');
    assert.strictEqual(pinned.get('max'), 42, 'an x-env integer is typed');
    assert.strictEqual(pinned.get('pinned_key'), ENV_SECRET, 'a pinned secret is effective');
    const pinSummary = await pinned.summary();
    assert.deepStrictEqual(pinSummary.pins, {
        base_url: { env: 'OV_TEST_BASE_URL', pinned: true },
        max: { env: 'OV_TEST_MAX', pinned: true },
        pinned_key: { env: 'OV_TEST_PINNED_KEY', pinned: true },
    });
    assert.strictEqual(pinSummary.values.base_url, 'https://pinned.example');
    assert.deepStrictEqual(pinSummary.values.pinned_key, { redacted: true, fingerprint: pinSummary.secrets.pinned_key.fingerprint });
    noSecret(JSON.stringify(pinSummary), [ENV_SECRET], 'pinned summary');
    await assert.rejects(pinned.apply({ base_url: 'https://elsewhere.example' }, { merge: true, actor: USER }), (e) => e.code === 'config.pinned_in_env' && e.status === 409);
    await assert.rejects(pinned.apply({}, { merge: true, unset: ['max'], actor: USER }), (e) => e.code === 'config.pinned_in_env' && e.status === 409);
    await assert.rejects(pinned.setSecret('pinned_key', SECRET, { actor: USER }), (e) => e.code === 'config.pinned_in_env' && e.status === 409);
    await assert.rejects(pinned.deleteSecret('pinned_key', { actor: USER }), (e) => e.code === 'config.pinned_in_env' && e.status === 409);
    const pinApp = express();
    pinApp.use(express.json());
    pinApp.use((req, _res, next) => { req.user = { role: 'admin', owner: true, subject_id: USER.id }; next(); });
    adminRoutes([pinned], { requireAdmin: (_q, _s, nx) => nx(), requireFresh: () => true }).mount(pinApp);
    const pinServer = pinApp.listen(0);
    await new Promise((r) => pinServer.once('listening', r));
    const pinBase = `http://127.0.0.1:${pinServer.address().port}`;
    let pres = await fetch(`${pinBase}/api/admin/config/live.pins`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ values: { base_url: 'https://x.example' }, merge: true }) });
    assert.strictEqual(pres.status, 409);
    assert.strictEqual((await pres.json()).code, 'config.pinned_in_env');
    pres = await fetch(`${pinBase}/api/admin/config/live.pins/secrets/pinned_key`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: SECRET }) });
    assert.strictEqual(pres.status, 409);
    assert.strictEqual((await pres.json()).code, 'config.pinned_in_env');
    pinServer.close();
    // A declared env name that is not set pins nothing and stays writable.
    const unpinned = await createConfigStore({ db, service: 'live', namespace: 'live.unpinned', schema: pinSchema, classify, env: {}, defaults: {}, keks: keks1, log });
    assert.deepStrictEqual((await unpinned.summary()).pins, {});
    await unpinned.apply({ base_url: 'https://writable.example' }, { merge: true, actor: USER });
    assert.strictEqual(unpinned.get('base_url'), 'https://writable.example');

    // ── The schema in the summary never carries a secret default ──
    const leaky = {
        type: 'object', additionalProperties: false,
        properties: {
            api_key: { type: 'string', default: 'LEAK-ME-DEFAULT-1', enum: ['LEAK-ME-ENUM-2'], const: 'LEAK-ME-CONST-3', examples: ['LEAK-ME-EXAMPLE-4'], title: 'Key' },
            provider: { type: 'string', default: 'p' },
        },
    };
    const leak = await createConfigStore({ db, service: 'live', namespace: 'live.schema', schema: leaky, classify, defaults: {}, keks: keks1, log });
    const leakSummary = await leak.summary();
    for (const x of ['LEAK-ME-DEFAULT-1', 'LEAK-ME-ENUM-2', 'LEAK-ME-CONST-3', 'LEAK-ME-EXAMPLE-4']) assert.ok(!JSON.stringify(leakSummary).includes(x), `${x} is stripped from the summary`);
    assert.strictEqual(leakSummary.schema.properties.provider.default, 'p', 'a public default stays');
    // A default secret cannot leak through an invalid_defaults error either.
    const defaultSecret = 'DEFAULT-MADE-UP-SECRET-5';
    let defaultErr;
    await assert.rejects(createConfigStore({
        db, service: 'live', namespace: 'live.bad_default_secret', schema: { type: 'object', properties: { api_key: { type: 'string', maxLength: 5 } } }, classify, defaults: { api_key: defaultSecret }, keks: keks1, log,
    }), (e) => { defaultErr = e; return e.code === 'config.invalid_defaults'; });
    assert.ok(!defaultErr.message.includes(defaultSecret), 'the invalid-defaults error is scrubbed');
    // A value-dependent classifier can still make an x-bind target secret after creation: never show that value.
    const valueClassify = (k, v) => (k === 'base_secret' && v === 'BIND-MADE-UP-SECRET-6' ? 'secret' : (k === 'bound_key' ? 'secret' : undefined));
    const bindLeak = await createConfigStore({
        db, service: 'live', namespace: 'live.bindleak', schema: { type: 'object', additionalProperties: false, properties: { base_secret: { type: 'string' }, bound_key: { type: 'string', 'x-bind': 'base_secret' } } }, classify: valueClassify, env: {}, keks: false, log,
    });
    await bindLeak.apply({ base_secret: 'BIND-MADE-UP-SECRET-6', bound_key: 'BOUND-VALUE' }, { actor: USER });
    const bindLeakSummary = await bindLeak.summary();
    assert.ok(!JSON.stringify(bindLeakSummary).includes('BIND-MADE-UP-SECRET-6'), 'a secret bind target is not echoed in bound_to');
    assert.strictEqual(bindLeakSummary.secrets.bound_key.bound_to, null);
    const enumSecret = await createConfigStore({ db, service: 'live', namespace: 'live.enumsecret', schema: { type: 'object', additionalProperties: false, properties: { api_key: { type: 'string', enum: ['ENUM-MADE-UP-SECRET-7'] } } }, classify, defaults: {}, keks: keks1, log });
    await assert.rejects(enumSecret.setSecret('api_key', 'another value', { actor: USER }), (e) => e.code === 'config.invalid' && !JSON.stringify(e).includes('ENUM-MADE-UP-SECRET-7'));
    // `seconds` is an owner-setting unit (an integer the form shows in seconds, labelled "s"); anything else is refused.
    const seconds = await createConfigStore({ db, service: 'live', namespace: 'live.secondsunit', schema: { type: 'object', properties: { x: { type: 'integer', 'x-unit': 'seconds' } } }, keks: keks1, log });
    assert.strictEqual((await seconds.summary()).schema.properties.x['x-unit'], 'seconds');
    await assert.rejects(createConfigStore({ db, service: 'live', namespace: 'live.badunit', schema: { type: 'object', properties: { x: { type: 'integer', 'x-unit': 'fortnights' } } }, keks: keks1, log }), /x-unit/);
    await assert.rejects(createConfigStore({ db, service: 'live', namespace: 'live.badenv', schema: { type: 'object', properties: { x: { type: 'string', 'x-env': 'lower-case' } } }, keks: keks1, log }), /x-env/);
    await assert.rejects(createConfigStore({ db, service: 'live', namespace: 'live.baddanger', schema: { type: 'object', properties: { x: { type: 'boolean', 'x-danger': 'yes' } } }, keks: keks1, log }), /x-danger/);

    // ── No KEK: exactly yesterday's storage and redaction, flagged sealed: false ──
    const plainStore = await createConfigStore({ db, service: 'live', namespace: 'live.plain', schema: SCHEMA, classify, defaults: DEFAULTS, env: {}, log });
    assert.strictEqual(plainStore.sealed, false);
    assert.strictEqual(plainStore.kek, null);
    await plainStore.apply({ api_key: SECRET }, { merge: true, actor: USER });
    const plainRow = await activeRow(db, 'live.plain');
    assert.ok(JSON.parse(plainRow.values_json).api_key === SECRET, 'without a KEK the row keeps the value as it did');
    assert.deepStrictEqual((await plainStore.summary()).values.api_key, { redacted: true, fingerprint: (await plainStore.summary()).secrets.api_key.fingerprint });
    assert.strictEqual((await plainStore.summary()).sealed, false);
    await assert.rejects(plainStore.reseal(), (e) => e.code === 'config.no_kek' && e.status === 409);
    noSecret(JSON.stringify(await plainStore.history({ limit: 200 })), [SECRET], 'plain history');

    // ── reseal(): plaintext rows move under the current KEK, old KEKs rotate, no value changes ──
    const beforeReseal = await plainStore.summary();
    const plainSnap = await plainStore.snapshot(plainStore.revision());
    const plainKey = await storedKey(db, 'live.plain');
    assert.strictEqual(plainKey.length, 32, 'without a KEK config_keys still holds the plain 32-byte key');
    assert.strictEqual(beforeReseal.secrets.api_key.fingerprint, crypto.createHmac('sha256', plainKey).update(JSON.stringify(SECRET)).digest('hex'), "no KEK keeps today's marker");
    const migrated = await createConfigStore({ db, service: 'live', namespace: 'live.plain', schema: SCHEMA, classify, defaults: DEFAULTS, env: {}, keks: keks1, log });
    assert.ok((await storedKey(db, 'live.plain')).toString('utf8').startsWith('ovfp.v1.k1'), 'enabling a KEK wraps the same fingerprint key');
    assert.strictEqual(migrated.get('api_key'), SECRET, 'reading the open plaintext is unchanged');
    const report1 = await migrated.reseal();
    assert.strictEqual(report1.plaintext, 1);
    assert.strictEqual(report1.resealed, 0);
    const migratedRow = await activeRow(db, 'live.plain');
    assert.ok(!migratedRow.values_json.includes(SECRET), 'reseal put the plaintext away');
    assert.match(JSON.parse(migratedRow.values_json).api_key, /^v1:k1:/);
    assert.strictEqual(migrated.get('api_key'), SECRET, 'the same value after reseal');
    assert.deepStrictEqual((await migrated.summary()).values.api_key, beforeReseal.values.api_key, 'the marker fingerprint survives reseal');
    assert.strictEqual((await migrated.snapshot(migrated.revision())).checksum, plainSnap.checksum, 'the checksum survives reseal');
    // Rotation: start with both KEKs once, which rewraps the fingerprint key under k2 without moving it;
    // the k1 envelope still needs resealing before k1 can go.
    const rotating = await createConfigStore({ db, service: 'live', namespace: 'live.plain', schema: SCHEMA, classify, defaults: DEFAULTS, env: {}, keks: keks12, log });
    assert.strictEqual(rotating.get('api_key'), SECRET, 'two KEKs open the old one');
    assert.ok((await storedKey(db, 'live.plain')).toString('utf8').startsWith('ovfp.v1.k2'), 'the fingerprint key wrapper follows the current KEK');
    const fpBeforeRotation = (await rotating.summary()).secrets.api_key.fingerprint;
    const snapBeforeRotation = await rotating.snapshot(rotating.revision());
    const k2Only = await createConfigStore({ db, service: 'live', namespace: 'live.plain', schema: SCHEMA, classify, defaults: DEFAULTS, env: {}, keks: { current: 'k2', keys: { k2: K2 } }, log });
    assert.strictEqual(k2Only.get('api_key'), undefined, 'a k1 envelope does not open with k2 alone');
    const report2 = await rotating.reseal();
    assert.strictEqual(report2.resealed, 1);
    assert.match(JSON.parse((await activeRow(db, 'live.plain')).values_json).api_key, /^v1:k2:/);
    const k2After = await createConfigStore({ db, service: 'live', namespace: 'live.plain', schema: SCHEMA, classify, defaults: DEFAULTS, env: {}, keks: { current: 'k2', keys: { k2: K2 } }, log });
    assert.strictEqual(k2After.get('api_key'), SECRET, 'after reseal the current KEK alone reads it');
    assert.strictEqual((await k2After.summary()).secrets.api_key.fingerprint, fpBeforeRotation, 'the marker fingerprint survives the k1 -> k2 rotation');
    assert.strictEqual((await k2After.snapshot(k2After.revision())).checksum, snapBeforeRotation.checksum, 'and so does the snapshot checksum');
    await assert.rejects(createConfigStore({ db, service: 'live', namespace: 'live.plain', schema: SCHEMA, classify, defaults: DEFAULTS, env: {}, keks: false, log }), /sealed under a KEK/);

    // reseal() recomputes an envelope's fingerprint rather than trusting its header.
    const refp = await createConfigStore({ db, service: 'live', namespace: 'live.refp', schema: SCHEMA, classify, defaults: DEFAULTS, env: {}, keks: keks1, log });
    await refp.apply({ api_key: SECRET }, { merge: true, actor: USER });
    const refpRow = await activeRow(db, 'live.refp');
    const refpValues = JSON.parse(refpRow.values_json);
    const refpParts = refpValues.api_key.split(':');
    const realFp = refpParts[2];
    refpParts[2] = '0'.repeat(64);
    await db.prepare('UPDATE config_snapshots SET values_json = ? WHERE namespace = ? AND revision = ?').run(JSON.stringify({ ...refpValues, api_key: refpParts.join(':') }), 'live.refp', refpRow.revision);
    const refpRotated = await createConfigStore({ db, service: 'live', namespace: 'live.refp', schema: SCHEMA, classify, defaults: DEFAULTS, env: {}, keks: keks12, log });
    assert.strictEqual(refpRotated.get('api_key'), SECRET);
    const refpReport = await refpRotated.reseal();
    assert.strictEqual(refpReport.resealed, 1);
    const refpAfter = JSON.parse((await activeRow(db, 'live.refp')).values_json).api_key;
    assert.strictEqual(refpAfter.split(':')[2], realFp, 'reseal recomputed the fingerprint with the stable key');
    assert.strictEqual((await refpRotated.summary()).secrets.api_key.fingerprint, realFp);
    // The same check for an envelope already under the current KEK: a fingerprint that does not match is repaired.
    const refpVals2 = JSON.parse((await activeRow(db, 'live.refp')).values_json);
    const refpParts2 = refpVals2.api_key.split(':');
    refpParts2[2] = 'f'.repeat(64);
    await db.prepare('UPDATE config_snapshots SET values_json = ? WHERE namespace = ? AND revision = ?').run(JSON.stringify({ ...refpVals2, api_key: refpParts2.join(':') }), 'live.refp', (await activeRow(db, 'live.refp')).revision);
    const refpReport2 = await refpRotated.reseal();
    assert.strictEqual(refpReport2.resealed, 1);
    assert.strictEqual(JSON.parse((await activeRow(db, 'live.refp')).values_json).api_key.split(':')[2], realFp);
    assert.strictEqual((await k2After.history({ limit: 200 })).filter((s) => s.state !== 'rejected').every((s) => !JSON.stringify(s).includes(SECRET)), true);
    // A KEK that is missing from the environment leaves its rows locked and named in the report.
    const orphanRow = await activeRow(db, 'live.plain');
    await db.prepare("UPDATE config_snapshots SET values_json = ? WHERE namespace = 'live.plain' AND revision = ?")
        .run(JSON.stringify({ ...JSON.parse(orphanRow.values_json), api_key: (JSON.parse(orphanRow.values_json).api_key).replace(/^v1:k2:/, 'v1:k9:') }), orphanRow.revision);
    const orphan = await createConfigStore({ db, service: 'live', namespace: 'live.plain', schema: SCHEMA, classify, defaults: DEFAULTS, env: {}, keks: { current: 'k2', keys: { k2: K2 } }, log });
    assert.strictEqual(orphan.get('api_key'), undefined);
    const report3 = await orphan.reseal();
    assert.ok(report3.locked >= 1);
    assert.ok(!JSON.stringify(report3).includes(SECRET));

    // ── Hooks: onChange after every activation, never on a proposal, and a failure does not refuse activation ──
    const hookChanges = [];
    let alertDown = false;
    const hooked = await createConfigStore({
        db, service: 'live', namespace: 'live.hooks', schema: SCHEMA, classify, defaults: DEFAULTS, keks: keks1, log,
        onChange: async (e) => { hookChanges.push(e); if (alertDown) throw new Error('alert down'); },
    });
    const hookRev = hooked.revision();
    alertDown = true;
    await hooked.apply({ timeout: 100 }, { merge: true, actor: USER, reason: 'make the alert fail' });
    alertDown = false;
    assert.strictEqual(hooked.get('timeout'), 100, 'onChange never refuses an activation');
    assert.strictEqual(hookChanges.length, 1);
    assert.deepStrictEqual(hookChanges[0].keys, ['timeout']);
    assert.deepStrictEqual(hookChanges[0].actor, USER);
    assert.strictEqual(hookChanges[0].revision, hookRev + 1);
    assert.ok(logs.some((l) => l.includes('onChange failed') && l.includes('alert down')));
    await hooked.propose({ timeout: 200 }, { merge: true, actor: USER });
    assert.strictEqual(hookChanges.length, 1, 'a proposal is not an activation');
    await hooked.rollback({ actor: USER });
    assert.strictEqual(hookChanges.length, 2);
    assert.ok(hookChanges[1].keys.includes('timeout'));

    // ── No secret ever reaches the log, a stored error or a response ──
    failNext = new Error(`provider said no to ${SECRET}`);
    await assert.rejects(live.apply({ danger_switch: false, timeout: 300 }, { merge: true, actor: USER }), (e) => !e.message.includes(SECRET) && e.message.includes('[redacted]'));
    const failedRow = await db.prepare("SELECT error FROM config_snapshots WHERE namespace = 'live.sealed' AND state = 'rejected' ORDER BY revision DESC LIMIT 1").get();
    assert.ok(failedRow && failedRow.error && !failedRow.error.includes(SECRET), 'a stored error is scrubbed');
    noSecret(logs.join('\n'), [SECRET, SECRET2, ENV_SECRET], 'the log');
    const stored = await db.prepare('SELECT namespace, values_json FROM config_snapshots').all();
    for (const r of stored) assert.ok(!r.values_json.includes(SECRET), `${r.namespace} values_json`);
    for (const text of texts) noSecret(text, [SECRET, SECRET2], 'a route response');
    noSecret(JSON.stringify(await live.summary()), [SECRET], 'the sealed summary after the failure');

    console.log('config secrets: envelopes, x-bind, write-only routes, x-env pins, summary schema, requireFresh, onChange, reseal and rotation ok');
})().catch((err) => { console.error(err); process.exit(1); });
