'use strict';
// openvibe-shared/release-compat: the N/N-1 mixed-version matrix, driven by the manifests' contract ranges
// and checked against real servers. Three releases of a small service:
//   R1  items API 1.0.0: GET /api/items -> [{ id, name }]
//   R2  items API 1.1.0 (additive): items gain `tags`; POST /api/items takes an optional `tags`
//   R3  items API 2.0.0 (breaking): `name` is renamed `title`
// and a dishonest R2x that claims 1.1.0 (^1) but ships R3's breaking response.
const assert = require('assert');
const express = require('express');
const { createRelease } = require('../release');
const compat = require('../release-compat');

function service(shape) {
    const items = [{ id: 1, name: 'first', tags: ['a'] }];
    const app = express();
    app.use(express.json());
    app.get('/api/items', (_req, res) => res.json(items.map((i) => shape(i))));
    app.post('/api/items', (req, res) => {
        const name = req.body.name || req.body.title;
        if (typeof name !== 'string') return res.status(400).json({ error: 'name required' });
        const item = { id: items.length + 1, name, tags: Array.isArray(req.body.tags) ? req.body.tags : [] };
        items.push(item);
        return res.status(201).json(shape(item));
    });
    return async () => {
        const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
        return { url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((r) => server.close(r)) };
    };
}
const v1 = (i) => ({ id: i.id, name: i.name });
const v11 = (i) => ({ id: i.id, name: i.name, tags: i.tags });
const v2 = (i) => ({ id: i.id, title: i.name, tags: i.tags });

// What each release's page does against whatever server it reaches.
const hasName = (list) => { for (const i of list) assert.strictEqual(typeof i.name, 'string', 'item.name'); };
const hasTitle = (list) => { for (const i of list) assert.strictEqual(typeof i.title, 'string', 'item.title'); };
const client1 = compat.replay([{ path: '/api/items', check: hasName }, { method: 'POST', path: '/api/items', body: { name: 'from R1' }, status: 201, check: (i) => assert.strictEqual(i.name, 'from R1') }]);
const client2 = compat.replay([{ path: '/api/items', check: hasName }, { method: 'POST', path: '/api/items', body: { name: 'from R2', tags: ['x'] }, status: 201, check: (i) => assert.strictEqual(i.name, 'from R2') }]);
const client3 = compat.replay([{ path: '/api/items', check: hasTitle }]);

// Manifests the way a service makes them (createRelease), and one the way a fixture from production looks.
const manifest = (sha, version, accepts, extra = {}) => createRelease({
    service: 'items', root: __dirname, env: { RELEASE_COMMIT: sha, RELEASE_AT: '2026-09-23T10:00:00Z' }, schema: require('openvibe-contracts/contracts/registry/release-manifest.v1.json'),
    contracts: { 'items.web-api': { version, accepts } }, logger: { warn() {} }, ...extra,
}).full();
const R1 = { name: 'R1', manifest: manifest('1111111', '1.0.0', '^1.0.0', { schemaGeneration: 3 }), server: service(v1), client: client1 };
const R2 = { name: 'R2', manifest: manifest('2222222', '1.1.0', '^1.0.0', { schemaGeneration: 4, schemaCompatibleFrom: 3 }), server: service(v11), client: client2 };
const R3 = { name: 'R3', manifest: manifest('3333333', '2.0.0', '^2.0.0', { schemaGeneration: 6 }), server: service(v2), client: client3 };
const R2x = { name: 'R2x', manifest: manifest('2222333', '1.1.0', '^1.0.0'), server: service(v2), client: client2 };

(async () => {
    // N-1 and N, both ways: an R1 page on the R2 server and an R2 page on the R1 server (rollback).
    const rows = await compat.assertMixedVersion({ releases: [R1, R2] });
    assert.deepStrictEqual(rows.map((r) => [r.page, r.server, r.compatible, r.ran, r.ok]), [['R1', 'R2', true, true, true], ['R2', 'R1', true, true, true]]);
    assert.ok(rows.every((r) => r.action === 'prompt'), 'no declared shell (so it changes every release): a compatible release prompts, never forces a reload');

    // A breaking release next to the one before it is refused (ADR-016: N-1 must keep working) …
    await assert.rejects(compat.assertMixedVersion({ releases: [R2, R3] }), (err) => {
        assert.match(err.message, /adjacent releases must be compatible/);
        assert.match(err.message, /items\.web-api: the server accepts >=2\.0\.0 <3\.0\.0, the page speaks 1\.1\.0/);
        return true;
    });
    // … and outside the window (not adjacent) the tab is told to reload before it can break.
    const wide = await compat.runMixedVersion({ releases: [R1, R2, R3] });
    const r1r3 = wide.find((r) => r.page === 'R1' && r.server === 'R3');
    assert.deepStrictEqual([r1r3.compatible, r1r3.action, r1r3.reason, r1r3.ran, r1r3.ok], [false, 'reload', 'contract', false, true]);
    assert.ok(wide.filter((r) => r.adjacent && !r.compatible).every((r) => !r.ok), 'R2 <-> R3 fail as adjacent');
    const off = await compat.runMixedVersion({ releases: [R2, R3], requireAdjacent: false });
    assert.ok(off.every((r) => r.ok && r.action === 'reload'), 'requireAdjacent: false accepts a reload-only boundary');

    // A manifest that claims compatibility its server does not honour is caught by the real calls.
    await assert.rejects(compat.assertMixedVersion({ releases: [R1, R2x] }), (err) => {
        assert.match(err.message, /declared compatible, but the R1 client failed against the R2x server: item\.name/);
        const bad = err.rows.find((r) => !r.ok);
        assert.deepStrictEqual([bad.page, bad.server, bad.ran], ['R1', 'R2x', true]);
        return true;
    });
    console.log(compat.formatMatrix(wide).split('\n').map((l) => `  ${l}`).join('\n'));

    // Rollback safety from the schema generations: R2 only expanded R1's schema (compatible from 3), R3 did not.
    assert.deepStrictEqual(compat.rollbackSafe(R2.manifest, R1.manifest), { ok: true });
    assert.strictEqual(compat.rollbackSafe(R3.manifest, R2.manifest).ok, false);
    assert.strictEqual(compat.rollbackSafe({}, R1.manifest).unknown, true);

    // Service to service: a consumer's range against a producer's.
    const media = compat.manifestFor({ service: 'media', release: 'abcdef0', contracts: { 'media.object': { version: '1.3.0', accepts: '^1.0.0' } } });
    const live = compat.manifestFor({ service: 'live', release: 'abcdef1', contracts: { 'media.object': { version: '1.1.0', accepts: '^1.0.0', role: 'consumes' } } });
    assert.deepStrictEqual(compat.consumerCompatible(live, media), { ok: true, problems: [] });
    const media2 = compat.manifestFor({ service: 'media', release: 'abcdef2', contracts: { 'media.object': { version: '2.0.0', accepts: '^2.0.0' } } });
    assert.strictEqual(compat.consumerCompatible(live, media2).ok, false);
    assert.deepStrictEqual(compat.compatible(live, media2), { ok: true, problems: [] }, 'consumed contracts are not the page\'s concern');

    console.log('release-mixed-version: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
