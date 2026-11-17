'use strict';
// "Use your own…" in every session and every composer (4.283.0; the owner, 11-16: "a place where it brings you to set up
// your different harnesses and API keys … even if you choose Actor … the shared node, their own computer"): the Agent and
// Runs on lists end with it, the session's "How it runs" has "Your own setup", and both files carry the same list of
// places (Link for your computer and machines, Codes for coding agents, Actor's model page, Locker for keys), https only,
// with the Frame's own list taking over when it sends one.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const places = (src) => {
    const m = src.match(/const SETUP = \[([\s\S]*?)\n\s*\];/);
    assert.ok(m, 'a SETUP list');
    return [...m[1].matchAll(/\{ id: '([a-z]+)', name: '([^']+)', line: '(?:[^'\\]|\\.)*', url: '([^']+)'(?:, back: true)? \}/g)].map((x) => [x[1], x[2], x[3]]);
};
const session = read('ov-session.js'), composer = read('ov-composer.js');
const a = places(session), b = places(composer);
assert.strictEqual(a.length, 5, `five places (${a.length})`);
assert.deepStrictEqual(a, b, 'the session and the composer offer the same places');
assert.ok(a.every(([, , url]) => /^https:\/\/openvibe\.(link|codes|actor|locker)\//.test(url)), 'OpenVibe https pages only');
// 4.294.0 (the owner, 11-17: "configure their own API keys"): your own AI key first.
assert.deepStrictEqual(a.map((x) => x[0]), ['keys', 'computer', 'harnesses', 'machines', 'signins']);
// Your computer comes back to the page it was opened from (openvibe.link/add-computer answers 400 without return_to).
for (const [name, src] of [['ov-session.js', session], ['ov-composer.js', composer]]) {
    assert.ok(/id: 'computer'[^\n]*url: 'https:\/\/openvibe\.link\/add-computer', back: true \}/.test(src), `${name}: add-computer is told where to come back`);
    assert.ok(/searchParams\.set\('return_to'/.test(src), `${name}: return_to set when opened`);
}
// Wired: the row at the end of Agent and Runs on in both, and the session's own section.
for (const [name, src] of [['ov-session.js', session], ['ov-composer.js', composer]]) {
    assert.ok(/name: 'Use your own…'/.test(src), `${name}: the row`);
    assert.ok(/'(Agent|Harness)', \[\.\.\.\(opts\.agents \|\| \[\]\)[^\n]*SETUP_ROW\]/.test(src) || /title: '(Agent|Harness)'[^\n]*SETUP_ROW\]/.test(src), `${name}: at the end of Agent`);
    assert.ok(/'Runs on'[^\n]*SETUP_ROW\]/.test(src) || /title: 'Runs on'[^\n]*SETUP_ROW\]/.test(src), `${name}: at the end of Runs on`);
    assert.ok(/opts\.setup/.test(src), `${name}: the Frame's own list takes over`);
}
assert.ok(/id: 'setup', name: 'Your own setup'/.test(session) && /section === 'setup'/.test(session), 'the session\'s How it runs has it');
console.log('your-setup: Use your own… ends Agent and Runs on in sessions and composers, one list of five places, the Frame may send its own');
