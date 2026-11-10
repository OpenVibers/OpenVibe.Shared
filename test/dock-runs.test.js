'use strict';
/**
 * The Dock's Agents tab (plan 2026-11-09 §7–8): the content-aware run rows and the overview that replaces an empty
 * middle. The rows say what a run was about, one status line says where it is, repeats fold into one row, and a
 * failure says why in words and what happens next — never the provider's own JSON.
 *
 * The classes are the design's: ovdk-run, ovdk-run-ic, ovdk-run-sub, ovdk-overview, ovdk-tiles, ovdk-skills and
 * ovdk-vibe-list. Opus refines from here, so the names are part of the contract.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const runs = fs.readFileSync(path.join(__dirname, '..', 'dock-runs.js'), 'utf8');
const vibe = fs.readFileSync(path.join(__dirname, '..', 'dock-vibe.js'), 'utf8');
const dock = fs.readFileSync(path.join(__dirname, '..', 'dock.js'), 'utf8');
const marks = fs.readFileSync(path.join(__dirname, '..', 'ai-marks-client.js'), 'utf8');
const builder = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build-ai-marks-client.js'), 'utf8');

// ── the classes the design names ────────────────────────────────────────────
for (const cls of ['ovdk-run', 'ovdk-run-ic', 'ovdk-run-sub', 'ovdk-overview', 'ovdk-tiles', 'ovdk-skills']) {
    assert.ok(runs.includes(cls), `the Agents tab has a ${cls}`);
}
assert.ok(vibe.includes('ovdk-vibe-list'), 'the Vibe tab has a list');

// ── the row says what the run was about ─────────────────────────────────────
assert.ok(runs.includes('it.subject && it.subject.title'), 'the row is titled by its subject');
assert.ok(runs.includes('subject.kind'), 'the subject carries its kind');
assert.ok(runs.includes('skill'), 'the row names the skill');
assert.ok(runs.includes('iconOf'), 'the skill has its own icon');
for (const [skill, glyph] of [['post', 'fa-pen'], ['wiki', 'fa-book'], ['image', 'fa-image'], ['chat', 'fa-comments'], ['code', 'fa-code'], ['clip', 'fa-film'], ['quest', 'fa-flag']]) {
    assert.ok(runs.includes(glyph), `the ${skill} skill draws ${glyph}`);
}
assert.ok(/--run-color/.test(runs), 'the icon is in the skill\'s own colour');

// ── one status line per state ───────────────────────────────────────────────
assert.ok(runs.includes("st = 'Running'"), 'a running run says what it is doing');
assert.ok(runs.includes("st = 'Waiting'"), 'a waiting run says what it needs');
assert.ok(runs.includes("st = 'Scheduled'"), 'a scheduled run says when');
assert.ok(runs.includes("st = 'Failed'"), 'a failed run says why');
assert.ok(runs.includes('cost_usd'), 'a finished run says what it cost');
assert.ok(runs.includes('duration_ms'), 'a finished run says how long it took');
assert.ok(runs.includes('it.model'), 'a finished run names the model');
assert.ok(runs.includes('maker'), 'the model carries its maker');
assert.ok(runs.includes('OpenVibeAIMarks'), 'the maker\'s mark is drawn');
assert.ok(runs.includes('ovdk-run-bar'), 'a running run has a thin bar');

// ── a failure says why, and what happens next ───────────────────────────────
assert.ok(runs.includes('run_error'), 'the failure carries its safe error');
assert.ok(runs.includes('error.words'), 'the failure shows the words');
assert.ok(runs.includes('error.next'), 'the failure shows the next step');
assert.ok(!runs.includes('it.error_detail'), 'the raw provider text never reaches the row');
assert.ok(!/innerHTML\s*=\s*[^;]*error/.test(runs), 'no error is written as markup');

// ── the row's actions ───────────────────────────────────────────────────────
assert.ok(runs.includes("h('a', 'ovdk-run-title')"), 'a row opens from its title');
assert.ok(runs.includes("'Retry'"), 'a failed run can be retried');
assert.ok(runs.includes("'Stop'"), 'a running run can be stopped');
assert.ok(runs.includes('Run again with another model'), 'a run can be made again with another model');
assert.ok(runs.includes('Pick a model'), 'a failure that needs a model says so');
assert.ok(runs.includes('Add a key'), 'and one that needs a key says so');

// ── repeats fold into one row ───────────────────────────────────────────────
assert.ok(runs.includes('grouped'), 'the runs are grouped');
assert.ok(runs.includes('`×${group.length}'), 'a group says how many it holds');
assert.ok(runs.includes('ovdk-run-repeat'), 'a group expands');

// ── the overview, instead of an empty middle ────────────────────────────────
assert.ok(runs.includes("h('small', '', 'Next')") && runs.includes('Nothing scheduled'), 'the overview says what runs next');
assert.ok(runs.includes('ovdk-tile'), 'the numbers are small tiles');
assert.ok(runs.includes('Today'), "the overview says today's numbers");
assert.ok(runs.includes('This week'), 'and this week\'s');
assert.ok(runs.includes('Last results'), 'the overview keeps the last results');
assert.ok(runs.includes('Things agents can do for you'), 'the overview offers the catalogue');
assert.ok(runs.includes('/api/v1/me/actions/skills'), 'the catalogue is Actor\'s, read through Network');
assert.ok(runs.includes("'All runs'"), 'the foot keeps All runs');
assert.ok(runs.includes("'Give an agent a task'"), 'and Give an agent a task');

// ── the phone: 44 px, no spinners ───────────────────────────────────────────
assert.ok(/min-height:44px/.test(runs), 'every control is 44 px on a phone');
assert.ok(!runs.includes('spinner'), 'there is no spinner');
assert.ok(!runs.includes('innerHTML'), 'the tab writes no markup of its own');

// ── the Vibe tab: a list, a back arrow, and why it did not answer ───────────
assert.ok(vibe.includes('openList'), 'the Vibe tab has a list');
assert.ok(vibe.includes('ovdk-vibe-back'), 'a conversation has a back arrow');
assert.ok(vibe.includes('20 * 60000'), 'the tab opens on the conversation you had within twenty minutes');
assert.ok(vibe.includes('ctx.state'), 'the choice is the Dock\'s synced state');
assert.ok(vibe.includes('ctx.save'), 'and it is written back');
assert.ok(vibe.includes('Vibe did not answer'), 'a failure says so');
assert.ok(vibe.includes("'Retry'"), 'and offers a retry');
assert.ok(vibe.includes('ovdk-attach'), 'the composer has an attach');
assert.ok(vibe.includes('ovdk-mic'), 'and the mic');
assert.ok(!vibe.includes('box.focus()') || /touch|coarse|pointer/.test(vibe), 'the composer does not take the focus on a touch screen');

// ── the Dock loads them, and the Chats row opens the Vibe tab ──────────────
assert.ok(dock.includes("load('dock-runs.js'"), 'the Dock loads the Agents tab');
assert.ok(dock.includes("load('ai-marks-client.js'"), 'and the maker marks with it');
assert.ok(dock.includes('ovdk-runs-foot'), 'the Agents tab has its own foot');
assert.ok(dock.includes("h('b', '', 'Vibe')"), 'the Chat tab has the Vibe row (your chats with Vibe)');
assert.ok(dock.includes('vibeOnList'), 'and it opens the Vibe tab on its list');
assert.ok(dock.includes('groupAvatar'), "a group's row shows faces, not a number sign");
assert.ok(dock.includes('answered'), 'and when Vibe last answered');
assert.ok(dock.includes('ovdk-size::after') || dock.includes('.ovdk-size'), 'the Dock has a grip to resize it with');

console.log("dock v2: the run rows, the overview, the Vibe list and the Chats row");
