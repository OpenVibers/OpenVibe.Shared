'use strict';
// The full footer's link columns are folds (footer.js; the owner's short-pages rule, 2026-10-28: a phone page is one or
// two screens, and the footer alone was 1.1–1.4 of them): the server writes every column open, so a page without
// script and every crawler still has all the links; on a desktop the heading reads and behaves as a heading; on a
// phone each column is a 48 px row with a chevron.
const assert = require('assert');
const footer = require('../footer');

const links = [
    { heading: 'Watch', items: [{ name: 'Live now', url: '/browse' }, { name: 'Clips', url: '/clips' }] },
    { heading: 'Create', items: [{ name: 'Go live', url: '/go-live' }] },
];
const html = footer.buildHTML({ service: 'live', variant: 'full', links });

const folds = html.match(/<details class="ovf-fold"[^>]*>/g) || [];
assert.ok(folds.length >= 4, `the site's columns, Network and Legal are folds (${folds.length})`);
assert.ok(folds.every((d) => / open\b/.test(d)), 'every fold is written open');
for (const [label, heading, count] of [['Watch', 'Watch', 2], ['Create', 'Create', 1], ['The OpenVibe network', 'Network', 9], ['Legal', 'Legal', 4]]) {
    const re = new RegExp(`<nav class="ovf-col" aria-label="${label}"><details class="ovf-fold" open><summary><h3>${heading}</h3><span class="ovf-fold-n">· ${count}</span></summary>`);
    assert.match(html, re, `${label}: a nav, its fold, its heading and its count on the fold's line`);
}
for (const href of ['/browse', '/clips', '/go-live']) assert.ok(html.includes(`href="${href}"`), `${href} stays in the page`);

// The compact footer opens into the whole one: its columns are folds too.
const compact = footer.buildHTML({ service: 'live', variant: 'compact', links });
assert.ok((compact.match(/<details class="ovf-fold" open>/g) || []).length >= 4, 'the compact footer\'s whole footer folds the same way');

// Desktop: the summary is not a control. Phone: a 48 px row with a chevron.
const css = footer.CSS;
assert.match(css, /\.ovf-fold>summary\{list-style:none;cursor:default;pointer-events:none\}/);
const phone = css.slice(css.indexOf('@media (max-width:560px)'));
assert.ok(phone.length < css.length, 'the phone block exists');
assert.match(phone, /\.ovf-fold>summary\{pointer-events:auto;cursor:pointer;[^}]*min-height:48px\}/);
assert.match(phone, /\.ovf-fold-n\{display:inline;/, 'the count shows on a phone');
assert.match(phone, /\.ovf-fold\[open\]>summary::after\{transform:/);

console.log('footer-folds: all checks passed');
