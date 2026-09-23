'use strict';
/**
 * openvibe-shared/analytics: request analytics within ADR-021 (OpenVibe.Contracts
 * docs/adr/ADR-021-analytics.md). A raw event has no IP, user or subject id, or city. Paths are route
 * templates and referers are reduced to origins. A user agent is stored as a class, sessions are
 * rotating ids, and raw events are pruned after 30 days. A request with `Sec-GPC: 1` or `DNT: 1` is
 * not recorded. The event shape is analytics/event.v1 (docs/schemas/analytics-event.v1.json).
 *
 *   const { AnalyticsTracker } = require('openvibe-shared/analytics');
 *   const tracker = new AnalyticsTracker(db, 'live', { retention: { days: 30 } });   // db: better-sqlite3
 *   app.use(tracker.middleware());
 *
 * Parts (also available as subpaths): tracker, privacy, retention, schema, event, prune-cli.
 * No dependencies: the caller passes its own better-sqlite3 handle (and Database, for the CLI).
 */

const { AnalyticsTracker } = require('./tracker');
const privacy = require('./privacy');
const retention = require('./retention');
const schema = require('./schema');
const event = require('./event');

/**
 * @deprecated The pre-ADR-021 module's tuning object, kept so the 1.x export list stays complete
 * (register item C-80). It is frozen and read-only, and the tracker does not read it. It will be
 * removed in 2.0.0.
 */
const SUSPICIOUS_PATTERNS = Object.freeze({
    highRequestRate: privacy.HIGH_REQUEST_RATE,
    rapidPageViews: 20,
    noJsExecution: true,
    honeypotPaths: Object.freeze([...privacy.HONEYPOT_PATHS]),
});

module.exports = {
    AnalyticsTracker,
    privacy,
    retention,
    schema,
    event,
    ensureSchema: schema.ensureSchema,
    optedOut: privacy.optedOut,
    // Names the pre-ADR module exported. They are kept for 1.x and now use the ADR-021 behaviour.
    classifyRequest: privacy.classifyRequest,
    parseUserAgent: privacy.parseUserAgent,
    ANALYTICS_SCHEMA: schema.ANALYTICS_SCHEMA,
    BOT_USER_AGENTS: privacy.BOT_USER_AGENTS,
    SUSPICIOUS_PATTERNS,
};
