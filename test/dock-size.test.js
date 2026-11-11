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
// 4.74.0 (2026-11-01, L48 V2) adds the Vibe tab's entry, its loader and Alt+V: +568 bytes (14757). The conversation
// and the mic are dock-vibe.js (4.1 KB brotli), loaded the first time the tab opens, not on every page.
// 4.76.0 (2026-11-01, L48 R2) adds the timer's button, its loader and the pill's countdown hook: +456 bytes (15213).
// 4.120.0 (2026-11-06, K-D3) adds the agent view's container and its lazy loader: +222 bytes (15435). The view itself
// (the embed, Curtain now, End, the still) is dock-agent.js, 3.9 KB brotli, loaded the first time the Agents tab opens.
// Send to… (4.144.0: a conversation or a new name for what the share sheet sends) is dock-share.js, loaded the first
// time something is sent, not on every page.
// The timer itself (menu, countdown, chime, focus rounds) is dock-timer.js (3.7 KB brotli), loaded only while a timer
// runs or its menu opens; the header's tab rail and narrow-width rules came with it.
const DOCK_BROTLI_BUDGET = 21040;   // 20.55 KB with the Code tab (ask 350, 2026-11-10: Chat · Code · Agents; the tab lives in dock-code.js, only its mount branch ships in dock.js); was 20940 with "Open in Chat" as an icon over your chats and in a thread (ask 336, 2026-11-10); 20.30 KB 20.30 KB with a robot for Agents, so the spark means one thing (Vibe) in the Dock as in the menu's row of places (4.194.0, 2026-11-10); 20.25 KB: 20.04 KB with a phone's sheet opening and closing as the menu's does (a circle from the orb, the menu's close button in the menu's place, a ring as it opens; 4.186.0, 2026-11-10); 20.00 KB: 19.80 KB with a phone's sheet opening out of the navbar's orb (4.185.0, 2026-11-10: the hand-off's styles and its two functions, about 0.95 KB; it runs as the sheet opens, so it cannot be a sibling loaded later); 19.00 KB: 18.63 KB with Dock v2's AI chats row, the conversation list, the group faces and the maker's marks (2026-11-09); 18.50 KB: 18.1 KB with the Actor tab, the sheets' shared surface and Dock chats from a site's session (4.162.0, 2026-11-09); 18.34 KB measured on 2026-11-09 with Dock v2's Chats summary and its lazy Agents rows; 18.00 KB: 17.9 KB with the orb's × as Close, dots drawn on the centre line and the pop from the pill (4.161.0, 2026-11-09); 17.50 KB: 17.28 KB with the full-screen phone Dock, the one-row header and its More menu (2026-11-09, owner: the pin unclear, pop-overs that did not close) + headroom; 16.80 KB: 16.55 KB with the phone header's two rows (4.150.0, 2026-11-08: the open tab read "Ac") + headroom; 16.40 KB: 16.30 KB with the link cards' loader (4.147.0, 2026-11-08; the card itself is dock-card.js, loaded the first time one shows) + headroom; 16.25 KB: 16.07 KB with OpenVibe Chat's hooks (share(), canSend(), the draft; 4.144.0, 2026-11-08), Send to… itself is dock-share.js (1.9 KB, loaded on first use); 16.0 KB: 15.74 KB with its siblings' ?v= content hashes (4.137.0, 2026-11-07) + headroom; 15.70 KB: 15.55 KB with Ask your agent (4.135.0, 2026-11-07) + headroom; was 15.50 KB (15435 after 4.120.0)
const SIBLINGS = ['action-center.js', 'notification-ui.js', 'notification-live.js', 'ov-mark.js', 'dock-vibe.js', 'dock-mount.js', 'dock-runs.js', 'ai-marks-client.js', 'dock-timer.js', 'dock-agent.js', 'dock-share.js', 'dock-card.js'];

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
