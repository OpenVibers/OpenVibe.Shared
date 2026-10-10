'use strict';
/** Backend-independent analytics retention bounds. */
const { sqlTime } = require('./core');

const MAX_DAYS = 30;
const DEFAULT_BATCH = 5000;

function checkDays(days) {
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > MAX_DAYS) {
        throw new Error(`days must be an integer from 1 to ${MAX_DAYS} (ADR-021 keeps raw analytics at most ${MAX_DAYS} days)`);
    }
    return n;
}

/** The created_at bound: rows strictly older than this are pruned. */
function cutoffFor(days, nowMs = Date.now()) {
    return sqlTime(nowMs - checkDays(days) * 86400000);
}

module.exports = { MAX_DAYS, DEFAULT_BATCH, checkDays, cutoffFor };
