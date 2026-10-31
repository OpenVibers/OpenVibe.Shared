'use strict';
// dock.js — the Dock itself: the pill, the card, its tabs and (K-D4) the window it can move into. It loads for
// signed-in people only, on every page, so its size is a budget like any other browser file.
// Covers the brotli budget for dock.js and the other Dock siblings it pulls in at runtime.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { sizes, brotli } = require('../scripts/size-report');

const ROOT = path.join(__dirname, '..');
const DOCK_PATH = path.join(ROOT, 'dock.js');
// dock.js was 12.27 KB brotli on 2026-10-30 (4.53.1, before the pop-out). K-D4 added 1.45 KB; the budget was that
// plus 1.5 KB. 4.56.0 adds the async token (the extension refreshes it) and the read-only scope controls; the
// budget is 14.0 KB, a 0.25 KB increase, so both still have to stay inside it.
const DOCK_BROTLI_BUDGET = 14336;   // 14.00 KB (14219 after 4.56.0 + 117 bytes of headroom)
const SIBLINGS = ['action-center.js', 'notification-ui.js', 'notification-live.js', 'ov-mark.js'];

// ── the budget ──────────────────────────────────────────────
{
    const size = brotli(fs.readFileSync(DOCK_PATH));
    assert.ok(size <= DOCK_BROTLI_BUDGET, `dock.js is ${(size / 1024).toFixed(2)} KB brotli, budget ${(DOCK_BROTLI_BUDGET / 1024).toFixed(2)} KB — the Dock is loaded on every page for signed-in people`);
}

// ── the Dock's siblings are browser files too, and the report knows them ──
{
    const s = sizes();
    assert.ok(s['dock.js'], 'the size report counts dock.js');
    for (const f of SIBLINGS) assert.ok(s[f], `the size report counts ${f}`);
}
