'use strict';
// Your AI plans on You (4.339.0, plan AD.39 item 9): each coding agent's tightest plan window, what is left and when it
// resets, from the Network's GET /api/me/usage (it asks OpenVibe.Codes; no site's CSP allows openvibe.codes), under the
// apps for a signed-in person, never while arranging, and drawn as text (names are never markup).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'ov-home.js'), 'utf8');
global.window = undefined;
const sandbox = {};
new Function('globalThis', 'document', src.replace("if (typeof document === 'undefined' || root.OpenVibeHome) return;", 'if (root.OpenVibeHome) return;'))(sandbox, {});
const P = sandbox.OpenVibeHome._plans;
const NOW = Date.parse('2026-11-28T06:00:00Z');

assert.strictEqual(P.in('2026-11-28T06:30:00Z', NOW), 'resets within the hour');
assert.strictEqual(P.in('2026-11-28T11:00:00Z', NOW), 'resets in 5 h');
assert.strictEqual(P.in('2026-12-01T06:00:00Z', NOW), 'resets in 3 d');
assert.strictEqual(P.in('2026-11-27T06:00:00Z', NOW), '');
assert.strictEqual(P.in(null, NOW), '');

const rows = P.rows({ agents: [
    { name: 'Claude Code', windows: [{ name: 'Week', left_pct: 84, resets_at: '2026-12-01T06:00:00Z' }] },
    { name: 'Codex', windows: [{ name: 'Week', left_pct: 60 }, { name: '5 hours', left_pct: 12, resets_at: '2026-11-28T08:00:00Z' }] },
    { name: 'Command Code', windows: [{ name: 'Week', left_pct: 0 }] },
    { name: 'Nothing yet', windows: [] },
    { windows: [{ name: 'Week', left_pct: 50 }] },
] }, NOW);
assert.deepStrictEqual(JSON.parse(JSON.stringify(rows)), [
    { name: 'Claude Code', window: 'Week', left: 84, level: '', say: 'Week: 84% left · resets in 3 d' },
    { name: 'Codex', window: '5 hours', left: 12, level: 'low', say: '5 hours: 12% left · resets in 2 h' },
    { name: 'Command Code', window: 'Week', left: 0, level: 'out', say: 'Week: 0% left' },
], 'the tightest window per agent; agents with no window or no name left out');
assert.deepStrictEqual(JSON.parse(JSON.stringify(P.rows(null, NOW))), []);
assert.strictEqual(P.rows({ agents: Array.from({ length: 9 }, (_, i) => ({ name: `A${i}`, windows: [{ name: 'Week', left_pct: 50 }] })) }, NOW).length, 4, 'four at most');

// The page side: asked from the Network with the person's token, text only, under the grid, never while arranging.
assert.match(src, /\/api\/me\/usage`, \{ credentials: 'omit', headers: \{ Accept: 'application\/json', Authorization: `Bearer \$\{o\.token\}` \} \}/);
assert.ok(!/openvibe\.codes\/api/.test(src), 'never Codes directly');
assert.match(src, /el\.append\(grid\);\n\s*if \(signedIn\(o\) && o\.plans !== false && !state\.edit\) el\.append\(plansSlot\(o\)\);/);
const fill = src.slice(src.indexOf('function fillPlans'), src.indexOf('function plansSlot'));
assert.ok(!/innerHTML/.test(fill), 'drawn as text');
console.log('ov-home-plans: the tightest window per agent in words and a meter, from the Network, text only, under the apps');
