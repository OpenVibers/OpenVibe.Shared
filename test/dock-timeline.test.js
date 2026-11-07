'use strict';
/**
 * The Dock's Agent panel (design 2026-11-07): Now, Needs you and the one timeline, with the folds and the filters.
 * The panel is set as text, never as markup, and it reads only the person's own timeline.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const panel = fs.readFileSync(path.join(__dirname, '..', 'dock-timeline.js'), 'utf8');
const dock = fs.readFileSync(path.join(__dirname, '..', 'dock.js'), 'utf8');

// The panel is what the person reads.
assert.ok(panel.includes('OpenVibeDockTimeline'), 'the panel is named');
assert.ok(/root\.OpenVibeDockTimeline = \{ mount \}/.test(panel), 'it mounts');
assert.ok(panel.includes("'Now'"), 'Now is first');
assert.ok(panel.includes("'Needs you'"), 'Needs you is under it');
assert.ok(panel.indexOf("el(doc, 'h3', null, 'Now')") < panel.indexOf("el(doc, 'h3', null, 'Needs you')"), 'Now comes before Needs you');
assert.ok(panel.includes('Your agent is idle'), 'nothing running says so');

// The three parts of an entry.
for (const part of ['ovdt-mode', 'ovdt-title', 'ovdt-outcome', 'ovdt-meta']) {
    assert.ok(panel.includes(part), 'the entry shows ' + part);
}
assert.ok(panel.includes('placement'), 'the entry says where it ran and why');
assert.ok(panel.includes('transition'), 'a mode change is a line of its own');
assert.ok(panel.includes('cost_usd'), 'the cost is shown when there was one');
assert.ok(panel.includes('entry.link'), 'the entry links to the step\'s own page');

// The folds and the filters.
assert.ok(panel.includes('Yesterday ('), 'earlier days fold with a count');
assert.ok(panel.includes('This week ('), 'and so does the week');
assert.ok(panel.includes("' more '"), 'a long run of one mode folds into "N more Code steps"');
assert.ok(panel.includes('aria-pressed'), 'a filter chip says whether it is on');
assert.ok(panel.includes('url.searchParams.set'), 'the filters are in the URL of the panel');
assert.ok(panel.includes('counts'), 'a filter never hides without a count');

// The person's own timeline, and only that.
assert.ok(panel.includes('/api/v1/agent/timeline'), 'the panel reads the timeline');
assert.ok(panel.includes('/api/v1/agent/approvals/'), 'an approval is answered in the mode that owns it');
assert.ok(panel.includes('/api/v1/agent/kill-switch'), 'the kill switch is one button on Now');
assert.ok(!panel.includes('innerHTML'), 'the panel never writes markup');
assert.ok(!/entry\.prompt|entry\.diff|\.prompt\b|\.diff\b/.test(panel), 'the panel reads no prompt and no diff');

// Phone: every control is 44 px, and the panel is the first thing in the Agents tab.
assert.ok(/min-height:44px/.test(panel), 'every control is 44 px');
assert.ok(dock.includes("load('dock-timeline.js'"), 'the Dock loads the panel');
assert.ok(dock.includes("panel.querySelector('.ovdk-timeline')"), 'the panel has its own place in the tab');
assert.ok(dock.indexOf('ovdk-timeline') < dock.indexOf('ovdk-agent'), 'the panel comes before the desk view');
assert.ok(dock.includes('https://openvibe.actor'), 'the panel reads OpenVibe.Actor');

// The person's token: the navbar hands the Dock a function, so the panel resolves it when it calls.
assert.ok(/typeof rawToken === 'function' \? await rawToken\(\)/.test(panel), 'a token given as a function is resolved at the call');
assert.ok(!panel.includes("'Bearer ' + token }"), 'the panel never sends a function as a bearer');
assert.ok(panel.includes('async function bearer()'), 'the bearer is resolved once per call');

// Opening the Dock at a task: the entry that carries it is marked and brought into view.
assert.ok(panel.includes('ovdt-focus'), 'the focused entry is marked');
assert.ok(panel.includes('scrollIntoView'), 'the focused entry is brought into view');
assert.ok(panel.includes('entry.ref === wanted'), 'the step is found by the id the site opened the Dock with');
assert.ok(dock.includes('focus: () => o.task || null'), 'the Dock tells the panel which step to point at');
const navbar = fs.readFileSync(path.join(__dirname, '..', 'navbar.js'), 'utf8');
assert.ok(/function openDock\(tab, opts\)/.test(navbar), 'the navbar opens the Dock with the step to point at');

console.log('dock timeline: now, needs you, the timeline, the folds and the filters');
console.log('all passed');
