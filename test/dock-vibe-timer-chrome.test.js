'use strict';
// The Dock in a real headless Chrome, second half: Vibe, voice, the glyphs, the timer, a Network without the route, and
// Ask your agent. The checks live in dock-chrome.test.js, which
// runs its first half by default; the file took about 65 s whole and the runner stops a file at 60 s (macOS, 2026-11-10).
process.env.DOCK_CHROME_PART = '2';
require('./dock-chrome.test.js');
