'use strict';
// The Dock loads on every OpenVibe site, so its scripts may not fetch another product's origin directly: each site's
// connect-src allows openvibe.network and refuses openvibe.codes and openvibe.actor (2026-11-09: 49 sites logged 1-4
// console errors at 1280). The three reads and their controls go through Network's same-origin frame relay
// (/api/frame/agent-view…, /api/frame/agent…, /api/frame/tasks…, /api/frame/actor…); an explicit base (a test, the
// extension's own panel) still reaches the product. This check fails when a Dock script takes the direct road again,
// and when one of the three modules loses either the relay default or its no-token guard.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const scripts = fs.readdirSync(ROOT).filter((f) => /^dock.*\.js$/.test(f)).sort();
assert.ok(scripts.includes('dock.js') && scripts.includes('dock-agent.js') && scripts.includes('dock-timeline.js') && scripts.includes('dock-actor.js'), 'the Dock and its three agent modules are here');
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// Another product's origin: anything under openvibe.* other than openvibe.network (the Frame's own host).
const OTHER = /https:\/\/openvibe\.(?!network\b)[a-z0-9-]+/i;

/** Every fetch()'s first argument, with its parentheses and quotes balanced (so a call inside a call is read whole). */
function fetchArgs(code) {
    const out = [];
    const re = /(?:^|[^.\w$])fetch\s*\(/g;
    let m;
    while ((m = re.exec(code))) {
        let i = re.lastIndex, depth = 1, quote = null, arg = '';
        for (; i < code.length && depth > 0; i += 1) {
            const c = code[i];
            if (quote) {
                if (c === '\\') { arg += c + (code[i + 1] || ''); i += 1; continue; }
                if (c === quote) quote = null;
            } else if (c === '"' || c === "'" || c === '`') quote = c;
            else if (c === '(') depth += 1;
            else if (c === ')') { depth -= 1; if (depth === 0) break; }
            arg += c;
        }
        out.push(arg.trim());
    }
    return out;
}

// 1. No fetch names another product's origin, as a literal or through a variable set to one.
const offenders = [];
for (const file of scripts) {
    const code = src(file);
    const args = fetchArgs(code);
    for (const arg of args) if (OTHER.test(arg)) offenders.push(`${file}: fetch(${arg.slice(0, 100)})`);
    for (const m of code.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:String\(\s*)?['"`](https:\/\/openvibe\.(?!network\b)[a-z0-9-]+)/g)) {
        if (args.some((arg) => new RegExp(`(^|[^\\w$])${m[1]}([^\\w$]|$)`).test(arg))) offenders.push(`${file}: fetch uses ${m[1]}, which is ${m[2]}`);
    }
}
assert.deepStrictEqual(offenders, [], 'the Dock must not fetch another product\'s origin directly; it goes through Network\'s /api/frame relay:\n  ' + offenders.join('\n  '));

// 2. Each agent module defaults to the relay and asks nothing without the person's token.
for (const [file, guard] of [['dock-agent.js', /if \(!t\) throw/], ['dock-timeline.js', /if \(!auth\) throw/], ['dock-actor.js', /if \(!t\) throw/]]) {
    const code = src(file);
    assert.ok(/frameBase[^;]*openvibe\.network\/api\/frame/.test(code), `${file} defaults to Network's frame relay`);
    assert.ok(/endpoint = \(path\)/.test(code), `${file} builds its calls from that one endpoint`);
    assert.ok(guard.test(code), `${file} asks nothing when the person is not signed in`);
}

// 3. The relay's paths are the ones Network serves, and the Dock hands every module the same relay.
const agent = src('dock-agent.js');
assert.ok(agent.includes("path.replace(/^\\/api\\/v1\\/me\\/agent-view/, '/agent-view')"), 'dock-agent.js maps Codes\' view to the relay');
assert.ok(agent.includes("endpoint('/api/v1/me/agent-view/frame')"), 'the still comes through the relay too');
const timeline = src('dock-timeline.js');
assert.ok(timeline.includes("/api/v1/agent/timeline"), 'the timeline still asks for its own steps');
assert.ok(timeline.includes("/api/v1/agent/approvals/") && timeline.includes('/api/v1/agent/kill-switch'), 'its two writes still go to Actor through the relay');
const actor = src('dock-actor.js');
assert.ok(actor.includes("frameBase + '/actor' + path"), 'dock-actor.js maps /actor and its subpaths to the relay');
const dock = src('dock.js');
assert.ok(/const frameBase = \(\) => String\(o\.frameBase \|\|/.test(dock), 'the Dock derives the relay from its Network base');
assert.ok(/base: directBase\(o\.actorBase\), frameBase: frameBase\(\)/.test(dock), 'the timeline and the Actor block get both bases');
assert.ok(/base: directBase\(o\.agentBase\), frameBase: frameBase\(\)/.test(dock), 'so does the agent view');
assert.ok(!/base: agentBase\(\)|base: actorBase\(\)/.test(dock), 'no module is handed a product origin as its default');

console.log('dock relay: the Dock\'s scripts fetch Network\'s /api/frame relay, never another product directly');
console.log('all passed');
