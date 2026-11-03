'use strict';
// legal.js — the public and service profiles (11-03): ten sites served no /terms, /privacy or /dmca because no profile
// told the truth about them ("info" says the site is not open yet; "tools" promises uploads deleted within the hour).
//   node test/legal-profiles.test.js
const assert = require('assert');
const legal = require('../legal');

const text = (kind, site) => legal.build(kind, site).sections.map(([h, html]) => `${h}\n${html}`).join('\n');

// public: open, read-only, no account; never "not open yet", never an account to delete, no counter-notice.
{
    const site = { host: 'openvibe.report', name: 'OpenVibe.Report', profile: 'public', what: 'The network\'s numbers open to everyone.' };
    const t = text('terms', site);
    assert.match(t, /What OpenVibe\.Report does\n<p>The network&#39;s numbers open to everyone\.<\/p>/);
    assert.match(t, /No account needed/);
    assert.doesNotMatch(t, /not open yet|delete your account|Your account\n/);
    const p = text('privacy', site);
    assert.match(p, /What you look up/);
    assert.doesNotMatch(p, /deleted automatically|Account data: until/);
    const d = text('dmca', site);
    assert.match(d, /does not host uploads from the public/);
    assert.doesNotMatch(d, /Counter-notice/);
}

// service: what it keeps, fetches and AI only when the site says so; its own processors named.
{
    const site = { host: 'openvibe.watch', name: 'OpenVibe.Watch', profile: 'service', what: 'Watch a page and get told when it changes.', makes: ['the watches you set', 'what each check found'], fetches: true };
    const t = text('terms', site);
    assert.match(t, /What you make here\n<p>OpenVibe\.Watch keeps what you make with it: the watches you set and what each check found/);
    assert.match(t, /Requests it makes for you/);
    assert.doesNotMatch(t, /AI models\n/, 'no AI unless the site says so');
    assert.match(t, /Your content and the licence you give us/);
    assert.doesNotMatch(t, /deleted automatically|not open yet/);
    const p = text('privacy', site);
    assert.match(p, /The watches you set and what each check found, linked to your account/);
    assert.match(p, /Addresses you give it/);
    assert.doesNotMatch(p, /What you send to AI models/);
    assert.match(text('dmca', site), /keeps what its users make for themselves/);
}
{
    const site = { host: 'ai.openvibe.services', name: 'OpenVibe AI', profile: 'service', ai: true, makes: ['your runs and their costs'], processors: ['your <own> list'] };
    assert.match(text('terms', site), /AI models\n<p>Some of what OpenVibe AI does sends what you give it to an AI model/);
    const p = text('privacy', site);
    assert.match(p, /What you send to AI models/);
    assert.match(p, /the AI providers whose models answer your requests/);
    assert.match(p, /your &lt;own&gt; list/, 'escaped');
    assert.doesNotMatch(p, /Addresses you give it/);
}

// The older profiles read as before.
{
    assert.match(text('terms', { host: 'x.openvibe.tools', name: 'X', profile: 'info' }), /This site is not open yet/);
    assert.match(text('privacy', { host: 'openvibe.tools', name: 'OpenVibe.Tools', profile: 'tools' }), /deleted automatically/);
    assert.doesNotMatch(text('terms', { host: 'openvibe.live', name: 'OpenVibe.Live', profile: 'streaming' }), /What you make here|No account needed/);
}

// Each profile's pages carry the day its words were written.
assert.strictEqual(legal.build('terms', { host: 'openvibe.report', name: 'R', profile: 'public' }).updated, '2026-11-03');
assert.match(legal.article('privacy', { host: 'openvibe.watch', name: 'W', profile: 'service' }), /<time datetime="2026-11-03">November 3, 2026<\/time>/);
assert.match(legal.article('terms', { host: 'openvibe.live', name: 'L', profile: 'streaming' }), /<time datetime="2026-09-18">September 18, 2026<\/time>/);
assert.deepStrictEqual(legal.PROFILES, ['streaming', 'tools', 'ugc', 'games', 'hosting', 'account', 'info', 'public', 'service']);
for (const profile of legal.PROFILES) for (const kind of Object.keys(legal.TITLES)) assert.ok(legal.page(kind, { host: 'a.openvibe.network', name: 'A', profile, id: 'network' }).includes('</html>'));
console.log('legal profiles: all checks passed');
