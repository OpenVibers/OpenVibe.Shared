'use strict';
/**
 * openvibe-shared/express-async — route an async Express 4 handler's rejection to next(err).
 *
 * Express 4 calls a handler and ignores what it returns, so a promise an `async (req, res) => …` handler rejects
 * (a database error, a thrown problem) becomes an unhandled rejection, and Node 22 ends the process on one. Services
 * moved to PostgreSQL (ADR-035) made most handlers async, so every OpenVibe service needs this. It patches the Layer
 * class of the app's own express copy, once: a handler's rejection goes to next(err), where the service's error
 * handler answers (a 500 problem), exactly as a synchronous throw always did. Error handlers (four arguments) get the
 * same treatment. Express 5 handles promises itself: there it does nothing.
 *
 *   require('openvibe-shared/express-async').routeAsyncErrors(app);   // instrument() (openvibe-shared/metrics) calls it
 */
const PATCHED = Symbol.for('openvibe.shared.expressAsync');

function layerClassOf(app) {
    if (!app || typeof app.use !== 'function') return null;
    if (!app._router && typeof app.lazyrouter === 'function') app.lazyrouter();   // Express 4 only
    const router = app._router;
    if (!router || !Array.isArray(router.stack) || !router.stack.length) return null;
    const Layer = router.stack[0].constructor;
    return Layer && Layer.prototype && typeof Layer.prototype.handle_request === 'function' ? Layer : null;
}

function settle(out, next, fallback) {
    if (out && typeof out.then === 'function') out.then(undefined, (err) => next(err || fallback || new Error('async handler rejected')));
}

/** → true when it patched, false when there was nothing to patch (Express 5, or patched already). */
function routeAsyncErrors(app) {
    const Layer = layerClassOf(app);
    if (!Layer || Layer.prototype[PATCHED]) return false;
    Layer.prototype.handle_request = function handle(req, res, next) {
        const fn = this.handle;
        if (fn.length > 3) return next();   // an error handler is not a request handler (as Express does)
        let out;
        try { out = fn(req, res, next); } catch (err) { return next(err); }
        return settle(out, next);
    };
    Layer.prototype.handle_error = function handleError(error, req, res, next) {
        const fn = this.handle;
        if (fn.length !== 4) return next(error);
        let out;
        try { out = fn(error, req, res, next); } catch (err) { return next(err); }
        return settle(out, next, error);
    };
    Layer.prototype[PATCHED] = true;
    return true;
}

module.exports = { routeAsyncErrors };
