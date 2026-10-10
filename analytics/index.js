'use strict';
/** PostgreSQL analytics and the shared privacy and event helpers. */
const privacy = require('./privacy');
const retention = require('./retention');
const event = require('./event');
const { AnalyticsTrackerPg, analyticsSchema, pruneRawEventsPg } = require('./pg');
const SUSPICIOUS_PATTERNS = Object.freeze({
    highRequestRate: privacy.HIGH_REQUEST_RATE,
    rapidPageViews: 20,
    noJsExecution: true,
    honeypotPaths: Object.freeze([...privacy.HONEYPOT_PATHS]),
});
module.exports = {
    AnalyticsTrackerPg, analyticsSchema, pruneRawEventsPg,
    privacy, retention, event,
    optedOut: privacy.optedOut,
    classifyRequest: privacy.classifyRequest,
    parseUserAgent: privacy.parseUserAgent,
    BOT_USER_AGENTS: privacy.BOT_USER_AGENTS,
    SUSPICIOUS_PATTERNS,
};
