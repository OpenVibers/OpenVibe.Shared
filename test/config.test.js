'use strict';
// config.js: validation, classification and redaction, atomic activation with last-known-good
// restored when onActivate throws (memory and database), rollback as a new revision, legacy import,
// two namespaces in one database, restart and an interrupted activation, serialized applies,
// pruning that keeps the last-known-good, and /api/admin/config on Express and on plain http.
const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const Database = require('better-sqlite3');
const express = require('express');
const { createConfigStore, adminRoutes, fromRows, canonical, ConfigError } = require('../config');

let contracts = null;
try { contracts = require('openvibe-contracts'); } catch { /* optional */ }
const hasSnapshotContract = (() => { try { return !!(contracts && contracts.resolve('common.config-snapshot@1')); } catch { return false; } })();

const USER = { type: 'user', id: 'usr_01JAB2C3D4E5F6G7H8J9K0MNPQ' };
const SECRET = 'sk_live_TOPSECRET_9f8e7d6c5b4a';
const sha = (v) => crypto.createHash('sha256').update(canonical(v)).digest('hex');
/** The namespace's fingerprint key, read the way only the service itself can, and a fingerprint under it. */
const keyOf = (db, ns) => db.prepare('SELECT hmac_key FROM config_keys WHERE namespace = ?').get(ns).hmac_key;
const fp = (db, ns, v) => crypto.createHmac('sha256', keyOf(db, ns)).update(canonical(v)).digest('hex');
/** Every form a key could leak in, for every namespace in a database, and the unkeyed hash of SECRET. */
const leakForms = (db) => db.prepare('SELECT hmac_key FROM config_keys').all()
    .flatMap((r) => [r.hmac_key.toString('hex'), r.hmac_key.toString('base64'), r.hmac_key.toString('base64url')])
    .concat([sha(SECRET)]);
const assertNoLeak = (text, forms, what) => { for (const f of forms) assert.ok(!String(text).includes(f), `${what} leaks a key or an unkeyed hash`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t = Date.parse('2026-09-25T12:00:00.000Z');
const clock = () => new Date(t += 1000);
const logs = [];
const log = (m, level) => logs.push(`${level} ${m}`);

/** The common.config-snapshot@1 shape, checked here and by the contract when the pinned copy has it. */
function assertSnapshot(s) {
    const keys = ['service', 'namespace', 'revision', 'previous_revision', 'state', 'values', 'classification', 'checksum', 'created_at', 'created_by', 'activated_at', 'activated_by', 'reason', 'error', 'copied_from'];
    assert.deepStrictEqual(Object.keys(s).sort(), [...keys].sort());
    assert.ok(['proposed', 'active', 'superseded', 'rejected', 'rolled_back'].includes(s.state), s.state);
    assert.ok(Number.isInteger(s.revision) && s.revision >= 1);
    assert.match(s.checksum, /^[0-9a-f]{64}$/);
    assert.deepStrictEqual(Object.keys(s.values).sort(), Object.keys(s.classification).sort(), 'every key classified');
    for (const [k, v] of Object.entries(s.values)) {
        const marker = !!(v && typeof v === 'object' && v.redacted === true);
        assert.strictEqual(marker, s.classification[k] === 'secret', `${k} redacted exactly when secret`);
        if (marker) { assert.deepStrictEqual(Object.keys(v).sort(), ['fingerprint', 'redacted']); assert.match(v.fingerprint, /^[0-9a-f]{64}$/); }
    }
    assert.strictEqual(s.checksum, sha(s.values), 'the checksum covers the values as shown');
    if (s.state === 'rejected') assert.ok(s.error, 'a rejected revision names its error');
    if (['active', 'superseded', 'rolled_back'].includes(s.state)) assert.ok(s.activated_at, `${s.state} has activated_at`);
    if (hasSnapshotContract) {
        const r = contracts.validate('common.config-snapshot@1', s);
        assert.ok(r.valid, JSON.stringify(r.errors));
    }
    return s;
}
const assertProblem = (body, status, code) => {
    assert.strictEqual(body.status, status);
    assert.strictEqual(body.code, code);
    assert.strictEqual(body.type, `https://openvibe.network/problems/${code}`);
    if (contracts) assert.ok(contracts.validate('errors.problem@1', body).valid, JSON.stringify(body));
};

/** A handle that counts statement executions, to prove get() never touches the database. */
function counting(db) {
    const c = { n: 0 };
    return {
        c,
        exec: (s) => db.exec(s),
        transaction: (fn) => db.transaction(fn),
        prepare(sql) {
            const st = db.prepare(sql);
            return { get: (...a) => (c.n++, st.get(...a)), all: (...a) => (c.n++, st.all(...a)), run: (...a) => (c.n++, st.run(...a)) };
        },
    };
}
const rowOf = (db, ns, rev) => db.prepare('SELECT * FROM config_snapshots WHERE namespace = ? AND revision = ?').get(ns, rev);

(async () => {
    const db = new Database(':memory:');

    // ── Construction ──
    assert.throws(() => createConfigStore({}), /better-sqlite3/);
    assert.throws(() => createConfigStore({ db, service: 'Live', namespace: 'live.x' }), /service/);
    assert.throws(() => createConfigStore({ db, service: 'live', namespace: 'media.x' }), /namespace/);
    assert.throws(() => createConfigStore({ db, service: 'live', namespace: 'live' }), /namespace/);
    assert.throws(() => createConfigStore({ db, service: 'live', namespace: 'live.x', schema: { oneOf: [] } }), /unsupported keyword "oneOf"/);
    assert.throws(() => createConfigStore({ db, service: 'live', namespace: 'live.x', schema: { type: 'object', properties: { a: { $ref: '#' } } } }), /unsupported keyword "\$ref"/);
    assert.throws(() => createConfigStore({ db, service: 'live', namespace: 'live.x', classify: 'secret' }), /classify/);
    assert.throws(() => createConfigStore({ db, service: 'live', namespace: 'live.bad_defaults', schema: { type: 'object', properties: { a: { type: 'string' } } }, defaults: { a: 1 }, log }),
        (e) => e.code === 'config.invalid_defaults');

    // ── Seeded from defaults ──
    const SCHEMA = {
        $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Live site settings',
        type: 'object', additionalProperties: false, required: ['site_name'],
        properties: {
            site_name: { type: 'string', minLength: 1, maxLength: 60, description: 'shown in the navbar' },
            max_bitrate_kbps: { type: 'integer', minimum: 500, maximum: 20000 },
            mode: { enum: ['open', 'invite', 'closed'] },
            support_email: { type: 'string', pattern: '^[^@\\s]+@[^@\\s]+$', format: 'email' },
            youtube_api_key: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' }, maxItems: 3, uniqueItems: true },
            banner: { type: ['object', 'null'], additionalProperties: false, properties: { text: { type: 'string' } } },
        },
    };
    const DEFAULTS = { site_name: 'OpenVibe.Live', max_bitrate_kbps: 6000, mode: 'open', youtube_api_key: '' };
    const classify = (k) => (/api_key|secret|token/.test(k) ? 'secret' : ['site_name', 'mode'].includes(k) ? 'public' : undefined);
    let activations = [];
    let failNext = null;
    let tighten = false;
    const liveOpts = {
        db, service: 'live', namespace: 'live.site_settings', schema: SCHEMA, classify, defaults: DEFAULTS, log, now: clock,
        validate: (v) => {
            if (v.mode === 'closed' && v.max_bitrate_kbps > 10000) return [{ path: '/max_bitrate_kbps', message: 'must be at most 10000 while closed' }];
            if (v.youtube_api_key && !/^[A-Za-z0-9_-]+$/.test(v.youtube_api_key)) return `youtube_api_key ${v.youtube_api_key} has characters keys never have`;
            if (tighten && v.max_bitrate_kbps < 7500) return 'max_bitrate_kbps is below the new floor';
            return true;
        },
        onActivate: async (values, previous, info) => {
            activations.push({ values, previous, info });
            await sleep(1);
            if (failNext && !info.restoring) { const e = failNext; failNext = null; throw e; }
        },
    };
    const counted = counting(db);
    const live = createConfigStore({ ...liveOpts, db: counted });
    assert.strictEqual(live.revision(), 1);
    assert.deepStrictEqual(live.get(), DEFAULTS);
    assert.strictEqual(live.get('mode'), 'open');
    assert.ok(Object.isFrozen(live.get()));
    assert.throws(() => { live.get().mode = 'closed'; }, TypeError);
    const seeded = assertSnapshot(live.lastKnownGood());
    assert.strictEqual(seeded.revision, 1);
    assert.strictEqual(seeded.state, 'active');
    assert.strictEqual(seeded.previous_revision, null);
    assert.strictEqual(seeded.reason, 'seeded from defaults');
    assert.deepStrictEqual(seeded.created_by, { type: 'service', id: 'live' });
    assert.strictEqual(activations.length, 0, 'seeding does not run onActivate');
    const reads = counted.c.n;
    for (let i = 0; i < 1000; i++) { live.get(); live.get('mode'); live.revision(); }
    assert.strictEqual(counted.c.n, reads, 'get() and revision() never read the database');

    // ── Validation rejects, and nothing is stored ──
    const before = live.history({ limit: 200 }).length;
    const cases = [
        [{ ...DEFAULTS, max_bitrate_kbps: 100 }, '/max_bitrate_kbps'],
        [{ ...DEFAULTS, max_bitrate_kbps: 6000.5 }, '/max_bitrate_kbps'],
        [{ ...DEFAULTS, max_bitrate_kbps: NaN }, '/max_bitrate_kbps'],
        [{ ...DEFAULTS, mode: 'party' }, '/mode'],
        [{ ...DEFAULTS, support_email: 'nope' }, '/support_email'],
        [{ ...DEFAULTS, unknown_key: 1 }, '/unknown_key'],
        [{ ...DEFAULTS, site_name: '' }, '/site_name'],
        [{ ...DEFAULTS, tags: ['a', 'a'] }, '/tags'],
        [{ ...DEFAULTS, tags: ['a', 1] }, '/tags/1'],
        [{ ...DEFAULTS, banner: { text: 'x', extra: true } }, '/banner/extra'],
        [{ ...DEFAULTS, mode: 'closed', max_bitrate_kbps: 15000 }, '/max_bitrate_kbps'],
        [{ ...DEFAULTS, 'bad key': 1 }, '/bad key'],
        [{ ...DEFAULTS, when: new Date() }, '/when'],
    ];
    for (const [values, path] of cases) {
        const ok = (e) => e instanceof ConfigError && e.code === 'config.invalid' && e.status === 422 && e.errors.some((x) => x.path === path);
        assert.throws(() => live.propose(values, { actor: USER }), ok, `${path} is refused`);
        await assert.rejects(live.apply(values, { actor: USER }), ok);
    }
    assert.throws(() => live.propose('nope'), (e) => e.code === 'config.invalid');
    const required = createConfigStore({ db, service: 'live', namespace: 'live.required', schema: { type: 'object', required: ['a'] }, log });
    assert.strictEqual(required.revision(), null, 'no defaults and no legacy: nothing active');
    assert.deepStrictEqual(required.get(), {});
    assert.throws(() => required.propose({ b: 1 }), (e) => e.errors[0].path === '/a' && e.errors[0].message === 'is required');
    assert.strictEqual(live.history({ limit: 200 }).length, before, 'a refused proposal is not stored');
    assert.strictEqual(live.revision(), 1);
    // Messages name the rule, never the value; a validate() that echoes a secret is scrubbed.
    assert.throws(() => live.propose({ ...DEFAULTS, youtube_api_key: 12345678 }), (e) => !JSON.stringify(e.errors).includes('12345678') && !e.message.includes('12345678'));
    assert.throws(() => live.propose({ ...DEFAULTS, youtube_api_key: `${SECRET} !` }), (e) => !e.message.includes(SECRET) && e.message.includes('[redacted]'));
    assert.throws(() => live.propose(DEFAULTS, { actor: { type: 'user', id: '42' } }), (e) => e.code === 'config.bad_actor');

    // ── Propose, then activate ──
    const v2 = { ...DEFAULTS, max_bitrate_kbps: 8000, youtube_api_key: SECRET };
    const p = assertSnapshot(live.propose(v2, { actor: USER.id, reason: 'raise the cap' }));
    assert.strictEqual(p.state, 'proposed');
    assert.strictEqual(p.revision, 2);
    assert.strictEqual(p.previous_revision, 1);
    assert.strictEqual(p.activated_at, null);
    assert.deepStrictEqual(p.created_by, USER, 'a usr_ id string is a user subject');
    assert.deepStrictEqual(p.values.youtube_api_key, { redacted: true, fingerprint: fp(db, 'live.site_settings', SECRET) });
    assert.strictEqual(p.classification.youtube_api_key, 'secret');
    assert.strictEqual(p.classification.site_name, 'public');
    assert.strictEqual(p.classification.max_bitrate_kbps, 'internal', 'an unclassified key is internal');
    assert.notStrictEqual(p.checksum, sha(v2), 'an unkeyed checksum of the full values is never served');
    assert.ok(!JSON.stringify(p).includes(sha(SECRET)), 'nor an unkeyed hash of the secret');
    assert.strictEqual(live.get('max_bitrate_kbps'), 6000, 'a proposal changes nothing');
    const a = assertSnapshot(await live.activate(2, { actor: USER }));
    assert.strictEqual(a.state, 'active');
    assert.deepStrictEqual(a.activated_by, USER);
    assert.strictEqual(live.revision(), 2);
    assert.strictEqual(live.get('youtube_api_key'), SECRET, 'the service itself gets the real value');
    assert.strictEqual(activations.length, 1);
    assert.strictEqual(activations[0].values.max_bitrate_kbps, 8000);
    assert.strictEqual(activations[0].previous.max_bitrate_kbps, 6000);
    assert.deepStrictEqual(activations[0].info, { namespace: 'live.site_settings', revision: 2, previous_revision: 1, restoring: false });
    assert.strictEqual(live.snapshot(1).state, 'superseded');
    assert.strictEqual(live.lastKnownGood().revision, 2);
    assert.ok(rowOf(db, 'live.site_settings', 2).values_json.includes(SECRET), 'the row keeps the secret so it can be activated again');
    await assert.rejects(live.activate(2), (e) => e.code === 'config.not_proposed' && e.status === 409);
    await assert.rejects(live.activate(99), (e) => e.code === 'config.revision_not_found' && e.status === 404);
    // A proposal made on an older active revision is stale.
    const stale = live.propose({ mode: 'invite' }, { merge: true, actor: USER });
    await live.apply({ mode: 'closed' }, { merge: true, actor: USER, reason: 'maintenance' });
    await assert.rejects(live.activate(stale.revision, { actor: USER }), (e) => e.code === 'config.stale' && e.status === 409);
    assert.strictEqual(live.snapshot(stale.revision).state, 'proposed', 'a stale proposal is left as it was');
    const goodRev = live.revision();
    const goodValues = live.get();
    assert.deepStrictEqual({ mode: goodValues.mode, max: goodValues.max_bitrate_kbps, key: goodValues.youtube_api_key }, { mode: 'closed', max: 8000, key: SECRET }, 'merge keeps the other keys');

    // ── A throwing onActivate restores the last-known-good, in memory and in the database ──
    activations = [];
    failNext = new Error(`bucket refused key ${SECRET}`);
    let thrown;
    await assert.rejects(live.apply({ max_bitrate_kbps: 9000, youtube_api_key: `${SECRET}x` }, { merge: true, actor: USER }), (e) => { thrown = e; return true; });
    assert.ok(thrown instanceof ConfigError);
    assert.strictEqual(thrown.code, 'config.activation_failed');
    assert.strictEqual(thrown.status, 422);
    assert.ok(thrown.message.includes('bucket refused key [redacted]') && !thrown.message.includes(SECRET), thrown.message);
    assert.ok(thrown.cause.message.includes('bucket refused'), 'the original error is the cause');
    const failedRev = thrown.revision;
    assert.strictEqual(failedRev, goodRev + 1);
    assert.strictEqual(live.revision(), goodRev, 'memory: the previous revision is active again');
    assert.strictEqual(live.get(), goodValues, 'memory: the same values object as before');
    const failedRow = rowOf(db, 'live.site_settings', failedRev);
    assert.strictEqual(failedRow.state, 'rejected', 'database: the new revision is rejected');
    assert.strictEqual(failedRow.activated_at, null);
    assert.ok(failedRow.error.startsWith('onActivate: bucket refused key [redacted]') && !failedRow.error.includes(SECRET));
    assert.strictEqual(rowOf(db, 'live.site_settings', goodRev).state, 'active', 'database: the previous revision is active again');
    assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM config_snapshots WHERE namespace = 'live.site_settings' AND state = 'active'").get().n, 1);
    assert.strictEqual(activations.length, 2, 'onActivate ran for the new values, then again to restore');
    assert.strictEqual(activations[1].info.restoring, true);
    assert.strictEqual(activations[1].values, goodValues);
    assert.strictEqual(activations[1].previous.max_bitrate_kbps, 9000);
    assert.strictEqual(live.lastKnownGood().revision, goodRev);
    assertSnapshot(live.snapshot(failedRev));
    const restarted = createConfigStore({ ...liveOpts, db });
    assert.strictEqual(restarted.revision(), goodRev, 'a restart after the failure serves the last-known-good');

    // Validation that fails at activation time (the rules changed since the proposal) rejects it too.
    const p2 = live.propose({ max_bitrate_kbps: 7000 }, { merge: true, actor: USER });
    tighten = true;
    await assert.rejects(live.activate(p2.revision, { actor: USER }), (e) => e.code === 'config.invalid' && e.revision === p2.revision);
    tighten = false;
    assert.strictEqual(live.snapshot(p2.revision).state, 'rejected');
    assert.match(live.snapshot(p2.revision).error, /below the new floor/);
    assert.strictEqual(live.revision(), goodRev);

    // ── Rollback: a new revision copying an older good one; history is never rewritten ──
    const goodSnap = live.snapshot(goodRev);
    const lowered = await live.apply({ max_bitrate_kbps: 5000 }, { merge: true, actor: USER, reason: 'lower' });
    const r = assertSnapshot(await live.rollback({ actor: USER, reason: 'too low' }));
    assert.strictEqual(r.copied_from, goodRev);
    assert.strictEqual(r.previous_revision, lowered.revision);
    assert.strictEqual(r.reason, 'too low');
    assert.strictEqual(r.checksum, goodSnap.checksum);
    assert.strictEqual(live.snapshot(lowered.revision).state, 'rolled_back');
    assert.strictEqual(live.get('max_bitrate_kbps'), 8000);
    assert.strictEqual(live.get('youtube_api_key'), SECRET, 'the secret comes back from the row');
    assert.deepStrictEqual({ ...live.snapshot(goodRev), state: null }, { ...goodSnap, state: null }, 'the copied revision is untouched (only its state moved)');
    assert.strictEqual(live.snapshot(goodRev).state, 'superseded');
    const again = await live.rollback({ actor: USER });
    assert.strictEqual(again.copied_from, lowered.revision, 'rolling back a rollback undoes it');
    assert.strictEqual(again.reason, `rollback to revision ${lowered.revision}`);
    assert.strictEqual(live.get('max_bitrate_kbps'), 5000);
    await live.rollback({ actor: USER, to: 1 });
    assert.deepStrictEqual(live.get(), DEFAULTS);
    await assert.rejects(live.rollback({ to: live.revision() }), (e) => e.code === 'config.already_active' && e.status === 409);
    await assert.rejects(live.rollback({ to: failedRev }), (e) => e.code === 'config.not_good' && e.status === 409);
    await assert.rejects(live.rollback({ to: 999 }), (e) => e.code === 'config.revision_not_found' && e.status === 404);
    failNext = new Error('nope');
    const beforeFailedRollback = live.revision();
    await assert.rejects(live.rollback({ actor: USER, to: goodRev }), (e) => e.code === 'config.activation_failed');
    assert.strictEqual(live.revision(), beforeFailedRollback);
    assert.strictEqual(live.snapshot(beforeFailedRollback).state, 'active', 'a failed rollback puts the rolled_back revision back');
    const fresh = createConfigStore({ db, service: 'live', namespace: 'live.fresh', defaults: { a: 1 }, log });
    await assert.rejects(fresh.rollback(), (e) => e.code === 'config.no_previous');
    await assert.rejects(required.rollback(), (e) => e.code === 'config.nothing_active');

    // ── Secrets: redacted everywhere they leave, kept by a redacted round trip ──
    await live.rollback({ actor: USER, to: goodRev });
    const summary = live.summary();
    assert.deepStrictEqual(summary.values.youtube_api_key, { redacted: true, fingerprint: fp(db, 'live.site_settings', SECRET) });
    assert.strictEqual(summary.values.youtube_api_key.fingerprint, crypto.createHmac('sha256', keyOf(db, 'live.site_settings')).update(JSON.stringify(SECRET)).digest('hex'), 'HMAC-SHA256 of the canonical JSON under the stored key');
    assertSnapshot(summary.active);
    assertSnapshot(summary.last_known_good);
    const roundTrip = await live.apply({ ...summary.values, max_bitrate_kbps: 7777 }, { actor: USER });
    assert.strictEqual(live.get('youtube_api_key'), SECRET, 'sending the marker back keeps the secret');
    assert.strictEqual(roundTrip.values.youtube_api_key.fingerprint, summary.values.youtube_api_key.fingerprint, 'an unchanged value keeps its fingerprint');
    const refusedMarker = (e) => e.code === 'config.invalid' && e.errors[0].path === '/youtube_api_key';
    assert.throws(() => live.propose({ ...DEFAULTS, youtube_api_key: { redacted: true, fingerprint: fp(db, 'live.site_settings', 'other') } }), refusedMarker, 'a fingerprint of another value is refused');
    assert.throws(() => live.propose({ ...DEFAULTS, youtube_api_key: { redacted: true, fingerprint: sha(SECRET) } }), refusedMarker, 'an unkeyed hash of the right value is refused');
    assert.throws(() => live.propose({ ...DEFAULTS, youtube_api_key: { redacted: true, sha256: sha(SECRET) } }), refusedMarker, 'the old { redacted, sha256 } shape is refused');
    assert.throws(() => live.propose({ ...DEFAULTS, banner: { redacted: false, text: 'x' } }), (e) => e.errors.some((x) => x.path === '/banner'), 'a redacted member is reserved for markers');
    const history = live.history({ limit: 200 });
    const keyFps = new Set(history.filter((h) => h.state !== 'rejected' && live.snapshot(h.revision)).map((h) => h.values.youtube_api_key.fingerprint));
    assert.ok(keyFps.has(fp(db, 'live.site_settings', SECRET)) && keyFps.has(fp(db, 'live.site_settings', '')), 'fingerprints differ exactly when the value does');
    for (const s of live.history({ limit: 200 })) assertSnapshot(s);
    assert.ok(!JSON.stringify(live.history({ limit: 200 })).includes(SECRET));
    assert.ok(!JSON.stringify(live.summary()).includes(SECRET));
    // A key classified secret later is redacted in the revisions stored before.
    const flags = createConfigStore({ db, service: 'live', namespace: 'live.flags', defaults: {}, log });
    await flags.apply({ webhook_url: 'https://hooks.example/T0K3N' }, { actor: USER });
    assert.strictEqual(flags.history()[0].values.webhook_url, 'https://hooks.example/T0K3N');
    const flags2 = createConfigStore({ db, service: 'live', namespace: 'live.flags', classify: { webhook_url: 'secret' }, log });
    assert.ok(flags2.history().every((s) => !JSON.stringify(s).includes('T0K3N')));
    assert.strictEqual(flags2.history()[0].classification.webhook_url, 'secret');
    // A lost key is replaced on the next start: fingerprints change and older markers stop round-tripping.
    const oldMarker = flags2.summary().values.webhook_url;
    db.prepare("DELETE FROM config_keys WHERE namespace = 'live.flags'").run();
    const flags3 = createConfigStore({ db, service: 'live', namespace: 'live.flags', classify: { webhook_url: 'secret' }, log });
    assert.notDeepStrictEqual(flags3.summary().values.webhook_url, oldMarker);
    assert.throws(() => flags3.propose({ webhook_url: oldMarker }), (e) => e.code === 'config.invalid');
    assert.strictEqual(flags3.propose({ webhook_url: flags3.summary().values.webhook_url }).values.webhook_url.fingerprint, flags3.summary().values.webhook_url.fingerprint);

    // ── Two stores (and two services) in one database ──
    const TIER_SCHEMA = { type: 'object', additionalProperties: false, properties: { minAgeDays: { type: 'integer', minimum: 0 }, r2Enabled: { type: 'boolean' }, b2_key: { type: 'string' } } };
    const media = createConfigStore({ db, service: 'media', namespace: 'media.storage_tier', schema: TIER_SCHEMA, classify: { b2_key: 'secret' }, defaults: { minAgeDays: 7, r2Enabled: true }, log });
    const liveRev = live.revision();
    assert.strictEqual(media.revision(), 1, 'each namespace numbers its own revisions');
    await media.apply({ minAgeDays: 3, b2_key: SECRET }, { merge: true, actor: USER });
    assert.strictEqual(media.revision(), 2);
    assert.strictEqual(live.revision(), liveRev, 'the other namespace is untouched');
    assert.ok(media.history().every((s) => s.namespace === 'media.storage_tier' && s.service === 'media'));
    assert.ok(live.history({ limit: 200 }).every((s) => s.namespace === 'live.site_settings'));
    // The same secret in two namespaces: different keys, different fingerprints, and one's marker is refused by the other.
    assert.strictEqual(live.get('youtube_api_key'), media.get('b2_key'));
    assert.notStrictEqual(live.summary().values.youtube_api_key.fingerprint, media.summary().values.b2_key.fingerprint);
    assert.throws(() => live.propose({ youtube_api_key: media.summary().values.b2_key }, { merge: true }), (e) => e.code === 'config.invalid');
    const keyRows = db.prepare('SELECT namespace, hmac_key FROM config_keys').all();
    assert.ok(keyRows.length >= 5 && keyRows.every((k) => Buffer.isBuffer(k.hmac_key) && k.hmac_key.length === 32), 'a random 32-byte key per namespace');
    assert.strictEqual(new Set(keyRows.map((k) => k.hmac_key.toString('hex'))).size, keyRows.length, 'no two namespaces share a key');

    // ── Restart: a new store on the same database serves the same active values ──
    const live2 = createConfigStore({ ...liveOpts, db });
    assert.deepStrictEqual(live2.get(), live.get());
    assert.strictEqual(live2.revision(), live.revision());
    assert.strictEqual(live2.lastKnownGood().revision, live.lastKnownGood().revision);
    assert.deepStrictEqual(live2.summary(), live.summary(), 'the key survives a restart: same fingerprints, same checksums');
    assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM config_keys WHERE namespace = 'live.site_settings'").get().n, 1);
    const media2 = createConfigStore({ db, service: 'media', namespace: 'media.storage_tier', schema: TIER_SCHEMA, classify: { b2_key: 'secret' }, defaults: { minAgeDays: 7, r2Enabled: true }, log });
    assert.deepStrictEqual(media2.get(), { minAgeDays: 3, r2Enabled: true, b2_key: SECRET });
    // A release that adds a default serves it at once, without a new revision.
    const media3 = createConfigStore({ db, service: 'media', namespace: 'media.storage_tier', classify: { b2_key: 'secret' }, defaults: { minAgeDays: 7, r2Enabled: true, r2MinViews: 20 }, log });
    assert.strictEqual(media3.get('r2MinViews'), 20);
    assert.strictEqual(media3.revision(), 2);
    assert.deepStrictEqual(media3.changes({ minAgeDays: 4 }, { merge: true }), ['minAgeDays']);
    await media3.apply({}, { merge: true, unset: ['minAgeDays'], actor: USER });
    assert.strictEqual(media3.get('minAgeDays'), 7, 'an unset key falls back to its default');
    // Another store (another process) moved the namespace: this one's copy is stale until reload().
    await assert.rejects(media.apply({ minAgeDays: 6 }, { merge: true, actor: USER }), (e) => e.code === 'config.stale' && e.status === 409);
    assert.strictEqual(media.get('minAgeDays'), 3);
    assert.strictEqual(media.reload(), media3.revision());
    assert.strictEqual(media.get('minAgeDays'), 7);

    // An activation interrupted by a stop (onActivate never finished) is rejected at the next boot,
    // and pruning while it hangs keeps the last-known-good even outside the window.
    const hanging = createConfigStore({ db, service: 'live', namespace: 'live.hang', defaults: { n: 0 }, keep: 2, log, onActivate: () => new Promise(() => {}) });
    hanging.apply({ n: 1 }, { actor: USER }).catch(() => {});
    await sleep(5);
    assert.strictEqual(rowOf(db, 'live.hang', 2).state, 'active');
    assert.strictEqual(hanging.lastKnownGood().revision, 1, 'not good until onActivate finished');
    for (let i = 0; i < 3; i++) hanging.propose({ n: 10 + i }, { actor: USER });
    const hangRevs = db.prepare("SELECT revision FROM config_snapshots WHERE namespace = 'live.hang' ORDER BY revision").all().map((x) => x.revision);
    assert.deepStrictEqual(hangRevs, [1, 2, 4, 5], 'pruned to the newest two, plus the active and the last-known-good');
    const rebooted = createConfigStore({ db, service: 'live', namespace: 'live.hang', defaults: { n: 0 }, log });
    assert.strictEqual(rebooted.revision(), 1);
    assert.strictEqual(rebooted.get('n'), 0);
    assert.strictEqual(rowOf(db, 'live.hang', 2).state, 'rejected');
    assert.match(rowOf(db, 'live.hang', 2).error, /interrupted/);

    // ── Concurrency: applies run one at a time and get increasing revisions ──
    let running = 0; let overlapped = false;
    const conc = createConfigStore({ db, service: 'live', namespace: 'live.concurrency', defaults: { n: 0 }, log, onActivate: async () => { running++; if (running > 1) overlapped = true; await sleep(5); running--; } });
    const [s1, s2, s3] = await Promise.all([conc.apply({ n: 1 }, { actor: USER }), conc.apply({ n: 2 }, { actor: USER }), conc.apply({ n: 3 }, { actor: USER })]);
    assert.deepStrictEqual([s1.revision, s2.revision, s3.revision], [2, 3, 4]);
    assert.deepStrictEqual([s1.previous_revision, s2.previous_revision, s3.previous_revision], [1, 2, 3]);
    assert.ok(!overlapped, 'onActivate never overlaps');
    assert.strictEqual(conc.get('n'), 3);
    assert.deepStrictEqual(conc.history().map((s) => s.state), ['active', 'superseded', 'superseded', 'superseded']);
    const b1 = await conc.apply({ n: 4 }, { actor: USER });
    const b2 = await conc.apply({ n: 5 }, { actor: USER });
    assert.strictEqual(b2.revision, b1.revision + 1);
    const conc2 = createConfigStore({ db, service: 'live', namespace: 'live.concurrency', log });
    const [c1, c2] = await Promise.all([conc.apply({ n: 6 }, { actor: USER }), Promise.resolve().then(() => conc2.propose({ n: 7 }, { actor: USER }))]);
    assert.ok(c2.revision !== c1.revision, 'two stores on one namespace never reuse a revision');

    // ── Pruning: the newest N, and never the active one ──
    const pr = createConfigStore({ db, service: 'live', namespace: 'live.prune', defaults: { n: 0 }, keep: 3, log });
    for (let i = 1; i <= 6; i++) await pr.apply({ n: i }, { actor: USER });
    assert.deepStrictEqual(pr.history().map((s) => s.revision), [7, 6, 5]);
    const pr2 = createConfigStore({ db, service: 'live', namespace: 'live.prune2', defaults: { n: 0 }, keep: 2, log, onActivate: (v) => { if (v.n > 0) throw new Error('refused'); } });
    for (let i = 1; i <= 5; i++) await assert.rejects(pr2.apply({ n: i }, { actor: USER }), (e) => e.code === 'config.activation_failed');
    assert.deepStrictEqual(pr2.history().map((s) => `${s.revision}:${s.state}`), ['6:rejected', '5:rejected', '1:active']);
    assert.strictEqual(pr2.lastKnownGood().revision, 1);
    assert.deepStrictEqual(pr2.history({ limit: 1, before: 6 }).map((s) => s.revision), [5], 'paged with before');

    // ── Legacy import ──
    const rows = [
        { key: 'site_name', value: 'Old Live', type: 'string' },
        { key: 'max_bitrate_kbps', value: '4500', type: 'number' },
        { key: 'registration_open', value: 'true', type: 'boolean' },
        { key: 'banner', value: '{"text":"hi"}', type: 'json' },
        { key: 'broken_json', value: '{', type: 'json' },
        { key: 'resend_api_key', value: 're_abcdef123456', type: 'secret' },
        { key: 'bad key', value: 'x' },
        { key: '__proto__', value: 'x' },
    ];
    assert.deepStrictEqual(fromRows(rows), { site_name: 'Old Live', max_bitrate_kbps: 4500, registration_open: true, banner: { text: 'hi' }, broken_json: '{', resend_api_key: 're_abcdef123456', 'bad key': 'x' });
    assert.deepStrictEqual(fromRows([{ key: 'storage_tier.minAgeDays', value: '3' }, { key: 'storage_tier.r2Enabled', value: 'false' }, { key: 'other', value: '1' }], { prefix: 'storage_tier.', type: 'json' }), { minAgeDays: 3, r2Enabled: false });
    const legacyDb = new Database(':memory:');
    let legacyReads = 0;
    const importOpts = { db: legacyDb, service: 'network', namespace: 'network.site_settings', classify: (k) => (/api_key/.test(k) ? 'secret' : undefined), defaults: { site_name: 'OpenVibe' }, legacy: () => { legacyReads++; return rows; }, log };
    const imp = createConfigStore(importOpts);
    assert.strictEqual(imp.revision(), 1);
    assert.strictEqual(imp.snapshot(1).reason, 'imported from the legacy source');
    assert.strictEqual(imp.get('site_name'), 'Old Live', 'legacy wins over defaults for revision 1');
    assert.strictEqual(imp.get('max_bitrate_kbps'), 4500);
    assert.ok(!('bad key' in imp.get()), 'a key the contract cannot carry is left behind');
    assert.ok(logs.some((l) => l.includes('network.site_settings') && l.includes('not imported') && l.includes('"bad key"')));
    assert.deepStrictEqual(imp.snapshot(1).values.resend_api_key, { redacted: true, fingerprint: fp(legacyDb, 'network.site_settings', 're_abcdef123456') });
    assertSnapshot(imp.snapshot(1));
    createConfigStore(importOpts);
    assert.strictEqual(legacyReads, 1, 'the legacy source is read once, when the namespace is new');
    assert.strictEqual(imp.import(rows), null, 'import is a no-op once the namespace has revisions');
    const imp2 = createConfigStore({ db: legacyDb, service: 'network', namespace: 'network.other', log });
    assert.strictEqual(imp2.revision(), null);
    const imported = imp2.import({ a: 1 }, { reason: 'from site_settings' });
    assert.strictEqual(imported.revision, 1);
    assert.strictEqual(imported.reason, 'from site_settings');
    assert.strictEqual(imp2.get('a'), 1);
    const strictImport = createConfigStore({ db: legacyDb, service: 'network', namespace: 'network.strict', schema: { type: 'object', properties: { n: { type: 'integer' } } }, legacy: { n: 'not a number' }, log });
    assert.strictEqual(strictImport.get('n'), 'not a number', 'what runs today is imported even when it does not validate');
    assert.ok(logs.some((l) => l.startsWith('warn') && l.includes('network.strict') && l.includes('do not validate')));

    // ── Secrets never reach the log ──
    assert.ok(logs.length > 10);
    assert.ok(!logs.join('\n').includes(SECRET), 'no secret in the log');
    assertNoLeak(logs.join('\n'), leakForms(db).concat(leakForms(legacyDb)), 'the log');
    assert.ok(!logs.join('\n').includes('re_abcdef123456'));
    assert.ok(logs.some((l) => /live\.site_settings: revision \d+ active \(was \d+\) by user:usr_/.test(l)));

    // ── /api/admin/config on Express ──
    const USER2 = 'usr_01JAB2C3D4E5F6G7H8J9K0MNPR';
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        const who = req.headers['x-test-user'];
        if (who === 'admin') req.user = { id: 1, role: 'admin', subject_id: USER.id };
        else if (who === 'owner') req.user = { id: 2, role: 'admin', subject_id: USER2, owner: true };
        else if (who === 'nosubject') req.user = { id: 3, role: 'admin' };
        else if (who === 'viewer') req.user = { id: 4, role: 'user', subject_id: USER.id };
        next();
    });
    let handlerRan = 0;
    const requireAdmin = (req, res, next) => (req.user && req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin only' }));
    const authorize = (req, { action, keys }) => { handlerRan++; return action === 'read' || !!(req.user && req.user.owner) || !keys.some((k) => classify(k) === 'secret'); };
    assert.throws(() => adminRoutes([live]), /requireAdmin/);
    assert.throws(() => adminRoutes([live, live2], { requireAdmin }), /twice/);
    adminRoutes([live, media], { requireAdmin, authorize, router: app });
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const texts = [];
    async function call(method, path, { user = 'admin', body } = {}) {
        const res = await fetch(base + path, { method, headers: { 'x-test-user': user, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
        const text = await res.text();
        texts.push(text);
        return { status: res.status, type: res.headers.get('content-type') || '', cache: res.headers.get('cache-control'), body: text ? JSON.parse(text) : null };
    }

    let res = await call('GET', '/api/admin/config', { user: 'viewer' });
    assert.strictEqual(res.status, 403);
    assert.deepStrictEqual(res.body, { error: 'Admin only' }, "requireAdmin's own answer");
    assert.strictEqual(handlerRan, 0, 'the handler never ran');
    res = await call('GET', '/api/admin/config');
    assert.strictEqual(res.status, 200);
    assert.match(res.type, /^application\/json/);
    assert.strictEqual(res.cache, 'no-store');
    assert.deepStrictEqual(res.body.namespaces.map((n) => n.namespace), ['live.site_settings', 'media.storage_tier']);
    const liveEntry = res.body.namespaces[0];
    assert.strictEqual(liveEntry.revision, live.revision());
    assert.deepStrictEqual(liveEntry.values.youtube_api_key, { redacted: true, fingerprint: fp(db, 'live.site_settings', SECRET) });
    assert.strictEqual(liveEntry.last_known_good.revision, live.lastKnownGood().revision);
    assertSnapshot(liveEntry.active);
    res = await call('GET', '/api/admin/config/media.storage_tier');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.values.b2_key, { redacted: true, fingerprint: fp(db, 'media.storage_tier', SECRET) });
    // A form round trip: the marker it was shown keeps the secret, even for an admin who may not change it.
    res = await call('POST', '/api/admin/config/live.site_settings', { body: { values: { youtube_api_key: liveEntry.values.youtube_api_key }, merge: true, reason: 'form round trip' } });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(live.get('youtube_api_key'), SECRET);
    assert.deepStrictEqual(res.body.values.youtube_api_key, liveEntry.values.youtube_api_key);
    res = await call('POST', '/api/admin/config/live.site_settings', { user: 'owner', body: { values: { youtube_api_key: { redacted: true, fingerprint: '0'.repeat(64) } }, merge: true } });
    assertProblem(res.body, 422, 'config.invalid');
    assert.strictEqual(res.body.errors[0].path, '/youtube_api_key');
    res = await call('GET', '/api/admin/config/nope.settings');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.type, 'application/problem+json');
    assertProblem(res.body, 404, 'config.namespace_not_found');

    res = await call('GET', '/api/admin/config/live.site_settings/history?limit=2');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.snapshots.length, 2);
    res.body.snapshots.forEach(assertSnapshot);
    assert.strictEqual(res.body.next_before, res.body.snapshots[1].revision);
    const older = await call('GET', `/api/admin/config/live.site_settings/history?limit=200&before=${res.body.next_before}`);
    assert.ok(older.body.snapshots.every((s) => s.revision < res.body.next_before));
    assert.strictEqual(older.body.next_before, null);

    const liveBefore = live.revision();
    res = await call('POST', '/api/admin/config/live.site_settings', { body: { values: { mode: 'invite' }, merge: true, reason: 'soft launch' } });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assertSnapshot(res.body);
    assert.strictEqual(res.body.revision, liveBefore + 1);
    assert.strictEqual(res.body.state, 'active');
    assert.deepStrictEqual(res.body.created_by, USER, 'the actor comes from req.user.subject_id');
    assert.strictEqual(res.body.reason, 'soft launch');
    assert.strictEqual(live.get('mode'), 'invite');
    res = await call('POST', '/api/admin/config/live.site_settings', { body: { values: { max_bitrate_kbps: 1 }, merge: true } });
    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.type, 'application/problem+json');
    assertProblem(res.body, 422, 'config.invalid');
    assert.deepStrictEqual(res.body.errors, [{ path: '/max_bitrate_kbps', message: 'must be >= 500' }]);
    res = await call('POST', '/api/admin/config/live.site_settings', { body: { reason: 'no values' } });
    assertProblem(res.body, 400, 'config.bad_request');
    res = await call('POST', '/api/admin/config/live.site_settings', { body: { values: { youtube_api_key: 'AIzaNEW' }, merge: true } });
    assertProblem(res.body, 403, 'config.forbidden');
    assert.strictEqual(live.get('youtube_api_key'), SECRET, 'authorize() refused a secret change');
    res = await call('POST', '/api/admin/config/live.site_settings', { user: 'owner', body: { values: { youtube_api_key: 'AIzaNEW' }, merge: true } });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.created_by.id, USER2);
    assert.strictEqual(live.get('youtube_api_key'), 'AIzaNEW');
    res = await call('POST', '/api/admin/config/live.site_settings', { user: 'nosubject', body: { values: { mode: 'open' }, merge: true } });
    assertProblem(res.body, 403, 'config.actor_required');
    failNext = new Error(`Media said no to ${SECRET}`);
    res = await call('POST', '/api/admin/config/live.site_settings', { user: 'owner', body: { values: { youtube_api_key: SECRET, mode: 'open' }, merge: true } });
    assertProblem(res.body, 422, 'config.activation_failed');
    assert.strictEqual(live.get('mode'), 'invite', 'the failure restored the previous values');

    res = await call('POST', '/api/admin/config/live.site_settings/rollback', { body: { reason: 'undo the key' } });
    assertProblem(res.body, 403, 'config.forbidden');
    res = await call('POST', '/api/admin/config/live.site_settings/rollback', { user: 'owner', body: { reason: 'undo the key' } });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assertSnapshot(res.body);
    assert.ok(res.body.copied_from);
    assert.strictEqual(live.get('youtube_api_key'), SECRET);
    res = await call('POST', '/api/admin/config/live.site_settings/rollback', { user: 'owner', body: { to: 'one' } });
    assertProblem(res.body, 400, 'config.bad_request');
    res = await call('POST', '/api/admin/config/live.site_settings/rollback', { user: 'owner', body: { to: 99999 } });
    assertProblem(res.body, 404, 'config.revision_not_found');
    const emptyStore = createConfigStore({ db, service: 'media', namespace: 'media.empty', defaults: { a: 1 }, log });
    const emptyApp = express();
    emptyApp.use(express.json());
    adminRoutes(emptyStore, { requireAdmin: (_req, _res, next) => next(), actor: () => USER }).mount(emptyApp);
    const emptyServer = emptyApp.listen(0);
    await new Promise((r) => emptyServer.once('listening', r));
    const er = await fetch(`http://127.0.0.1:${emptyServer.address().port}/api/admin/config/media.empty/rollback`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const erBody = await er.json();
    assertProblem(erBody, 409, 'config.no_previous');
    emptyServer.close();
    assert.ok(texts.every((x) => !x.includes(SECRET)), 'no response ever carries the secret');
    assert.ok(!logs.join('\n').includes(SECRET));
    const forms = leakForms(db);
    texts.forEach((x, i) => assertNoLeak(x, forms, `route response ${i}`));
    assertNoLeak(JSON.stringify([live.summary(), media.summary(), live.history({ limit: 200 }), media.history({ limit: 200 }), live.lastKnownGood()]), forms, 'summary and history');
    server.closeAllConnections();
    server.close();

    // ── Plain http, a basePath under an app-scoped router, and direct handlers ──
    const plain = adminRoutes([media], {
        requireAdmin: (req, res, next) => (req.headers.authorization === 'Bearer admin' ? next() : (res.statusCode = 401, res.end())),
        actor: () => ({ type: 'service', id: 'live' }),
    });
    const plainServer = http.createServer((req, res) => plain.handle(req, res));
    plainServer.listen(0);
    await new Promise((r) => plainServer.once('listening', r));
    const pbase = `http://127.0.0.1:${plainServer.address().port}`;
    const auth = { authorization: 'Bearer admin' };
    assert.strictEqual((await fetch(`${pbase}/api/admin/config`)).status, 401);
    let pr0 = await fetch(`${pbase}/api/admin/config`, { headers: auth });
    assert.strictEqual(pr0.status, 200);
    assert.strictEqual((await pr0.json()).namespaces[0].namespace, 'media.storage_tier');
    pr0 = await fetch(`${pbase}/api/admin/config/media.storage_tier`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ values: { minAgeDays: 5 }, merge: true, reason: 'plain http' }) });
    const plainSnap = await pr0.json();
    assert.strictEqual(pr0.status, 200, JSON.stringify(plainSnap));
    assert.deepStrictEqual(plainSnap.created_by, { type: 'service', id: 'live' });
    assert.strictEqual(media.get('minAgeDays'), 5);
    pr0 = await fetch(`${pbase}/api/admin/config/media.storage_tier/history?limit=1`, { headers: auth });
    assert.strictEqual((await pr0.json()).snapshots.length, 1);
    pr0 = await fetch(`${pbase}/api/admin/config/media.storage_tier`, { method: 'POST', headers: auth, body: '{not json' });
    assertProblem(await pr0.json(), 400, 'config.bad_request');
    pr0 = await fetch(`${pbase}/elsewhere`, { headers: auth });
    assertProblem(await pr0.json(), 404, 'config.route_not_found');
    for (const path of ['/api/admin/config', '/api/admin/config/media.storage_tier', '/api/admin/config/media.storage_tier/history?limit=200']) {
        assertNoLeak(await (await fetch(pbase + path, { headers: auth })).text(), leakForms(db), `plain ${path}`);
    }
    plainServer.close();

    const scoped = express();
    scoped.use(express.json());
    const sub = express.Router({ mergeParams: true });
    adminRoutes([media], { requireAdmin: (_req, _res, next) => next(), basePath: '/config', actor: (req) => ({ type: 'service', id: req.params.app || 'live' }) }).mount(sub);
    scoped.use('/api/v1/:app/admin', sub);
    const scopedServer = scoped.listen(0);
    await new Promise((r) => scopedServer.once('listening', r));
    const sres = await fetch(`http://127.0.0.1:${scopedServer.address().port}/api/v1/live/admin/config/media.storage_tier`);
    assert.strictEqual(sres.status, 200);
    assert.strictEqual((await sres.json()).namespace, 'media.storage_tier');
    scopedServer.close();

    const direct = adminRoutes([media], { requireAdmin: (req, res, next) => (req.admin ? next() : (res.statusCode = 403, res.end('no'))) });
    const fakeRes = () => ({ headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; this.done = true; } });
    const denied = fakeRes();
    await direct.list({ url: '/api/admin/config' }, denied);
    assert.strictEqual(denied.statusCode, 403, 'a handler used directly is still guarded');
    const allowedRes = fakeRes();
    direct.list({ url: '/api/admin/config', admin: true }, allowedRes);
    await sleep(5);
    assert.strictEqual(allowedRes.statusCode, 200);
    assert.strictEqual(direct.routes.length, 5);
    assert.deepStrictEqual(direct.routes.map((x) => `${x.method.toUpperCase()} ${x.path}`), [
        'GET /api/admin/config', 'GET /api/admin/config/:namespace', 'GET /api/admin/config/:namespace/history',
        'POST /api/admin/config/:namespace', 'POST /api/admin/config/:namespace/rollback',
    ]);

    assertNoLeak(logs.join('\n'), leakForms(db).concat(leakForms(legacyDb)), 'the whole log');
    assert.ok(!logs.join('\n').includes(SECRET));

    console.log(`config: store, validation, last-known-good, rollback, secrets, legacy, restart, concurrency and routes ok${hasSnapshotContract ? ' (snapshots checked against common.config-snapshot@1)' : ''}`);
})().catch((err) => { console.error(err); process.exit(1); });
