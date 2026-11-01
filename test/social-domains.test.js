'use strict';
// Domain cards (4.86.1): a service's other named domains have their own share card, and shell.page() shares it on any
// page whose canonical URL is on that host. Before, a link to openvibe.pics previewed as OpenVibe.Video, openvibe.homes
// as Rent and openvibe.website as Space.
const assert = require('assert');
const social = require('../social');
const shell = require('../shell');
const appIcons = require('../app-icons');

const want = { pics: ['media-hub', 'openvibe.pics'], download: ['media-hub', 'openvibe.download'], homes: ['rent', 'openvibe.homes'],
    website: ['space', 'openvibe.website'] };
assert.deepStrictEqual(social.DOMAINS.map((d) => d.id).sort(), Object.keys(want).sort(), 'the four named domains');
Object.entries(want).forEach(([id, [service, host]]) => {
    const d = social.domainOf(id);
    assert.ok(d && d.service === service && d.host === host, `${id}: ${service} on ${host}`);
    assert.ok(d.name && d.tagline && d.what, `${id}: name, tagline and what`);
    assert.ok(d.what.length <= 130, `${id}: the description fits the card's two lines (${d.what.length})`);
    assert.ok(social.has(id), `${id}: social/${id}.jpg is drawn`);
    assert.strictEqual(social.iconSite(id), social.iconSite(service), `${id} wears ${service}'s mark`);
    assert.ok(appIcons.has(id) && appIcons.site(id).name === `OpenVibe.${d.name}`, `${id}: an icon entry named OpenVibe.${d.name}`);
    assert.strictEqual(social.domainForHost(host), d);
    assert.strictEqual(social.domainForHost(`www.${host}:443`), d, 'www. and a port are ignored');
});
assert.strictEqual(social.domainForHost('openvibe.video'), null, 'a service\'s own first domain keeps its card');
assert.strictEqual(social.domainForHost(''), null);

// shell.page: the canonical's host picks the domain's card; the service's own domain keeps the service's card.
const og = (html) => (/og:image" content="([^"]+)"/.exec(html) || [])[1] || '';
assert.match(og(shell.page({ service: 'media-hub', canonical: 'https://openvibe.pics/a/abc', description: 'd' })), /^https:\/\/openvibe\.pics\/shared\/social\/pics\.jpg\?v=/);
assert.match(og(shell.page({ service: 'rent', canonical: 'https://openvibe.homes/', description: 'd' })), /\/shared\/social\/homes\.jpg\?v=/);
assert.match(og(shell.page({ service: 'media-hub', canonical: 'https://openvibe.video/v/1', description: 'd' })), /\/shared\/social\/media-hub\.jpg\?v=/);
assert.match(og(shell.page({ service: 'media-hub', canonical: 'https://openvibe.pics/', image: '/cover.png' })), /\/cover\.png$/, 'an explicit image still wins');
// The builders draw a card and write an icon entry for each domain (scripts run by hand; their output is committed).
const fs = require('fs');
const path = require('path');
const cards = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build-social-cards.js'), 'utf8');
assert.match(cards, /for \(const d of social\.DOMAINS\)/);
assert.match(cards, /domain: d\.host,/);
const icons = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build-icons.js'), 'utf8');
assert.match(icons, /const d = social\.domainOf\(id\);\s*if \(d\) return \{ id, name: d\.name, tagline: d\.tagline \};/);
console.log('social domains: all checks passed');
