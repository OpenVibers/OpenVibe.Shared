'use strict';
// openvibe-shared/express-async: an async handler's rejection reaches the error handler (a 500), never an unhandled
// rejection that ends the process; synchronous throws, next(err) and async error handlers keep working; patching twice
// is a no-op; instrument() applies it.
const assert = require('assert');
let express;
try { express = require('express'); } catch { console.log('express-async: skipped (express not installed)'); process.exit(0); }
const { routeAsyncErrors } = require('../express-async');
const metrics = require('../metrics');

(async () => {
    let unhandled = 0;
    process.on('unhandledRejection', () => { unhandled++; });
    const app = express();
    metrics.instrument(app, { service: 't', release: 'r' });
    assert.strictEqual(routeAsyncErrors(app), false, 'instrument() patched it already');
    app.get('/async', async () => { throw Object.assign(new Error('db down'), { status: 503 }); });
    app.get('/sync', () => { throw new Error('sync'); });
    app.get('/ok', async (_req, res) => { res.json({ ok: true }); });
    app.get('/next', (_req, _res, next) => next(new Error('via next')));
    app.get('/bad-handler', async () => { throw new Error('first'); });
    app.use(async (err, req, res, next) => { if (req.path === '/bad-handler') throw new Error('handler broke'); res.status(err.status || 500).json({ error: err.message }); });
    app.use((err, _req, res, _next) => { res.status(500).json({ error: `last: ${err.message}` }); });
    const s = await new Promise((r) => { const x = app.listen(0, '127.0.0.1', () => r(x)); });
    const get = async (p) => { const r = await fetch(`http://127.0.0.1:${s.address().port}${p}`); return [r.status, await r.json()]; };
    try {
        assert.deepStrictEqual(await get('/async'), [503, { error: 'db down' }]);
        assert.deepStrictEqual(await get('/sync'), [500, { error: 'sync' }]);
        assert.deepStrictEqual(await get('/ok'), [200, { ok: true }]);
        assert.deepStrictEqual(await get('/next'), [500, { error: 'via next' }]);
        assert.deepStrictEqual(await get('/bad-handler'), [500, { error: 'last: handler broke' }], 'an async error handler that throws reaches the next one');
        assert.strictEqual(unhandled, 0);
        console.log('express-async: all checks passed');
    } finally { s.close(); }
})().catch((err) => { console.error(err); process.exit(1); });
