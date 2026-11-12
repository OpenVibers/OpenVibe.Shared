'use strict';
const assert = require('assert');
const { parseHTML } = require('linkedom');
const { window } = parseHTML('<!doctype html><html><body><ol id="messages"></ol></body></html>');
global.document = window.document;
const { render } = require('../messages');
const root = document.getElementById('messages');
render(root, { view: 'bubbles', me: 1, now: new Date('2026-11-09T12:00:00Z'), messages: [
    { id: 1, sender_id: 2, username: 'bob', display_name: 'Bob', avatar_url: 'https://openvibe.media/fixture/bob.png', created_at: '2026-11-09 11:58:00', message: 'Hi https://openvibe.today/' },
    { id: 2, sender_id: 2, username: 'bob', display_name: 'Bob', created_at: '2026-11-09 11:59:00', message: '👋' },
    { id: 3, sender_id: 1, username: 'alice', created_at: '2026-11-09 11:59:30', message: 'Hello' },
] });
assert.strictEqual(root.querySelectorAll('.ovm-day').length, 1);
assert.strictEqual(root.querySelectorAll('.ovm-group').length, 3);
assert.strictEqual(root.querySelector('.ovm-avatar').getAttribute('src'), 'https://openvibe.media/fixture/bob.png');
assert.strictEqual(root.querySelector('.ovm-link').getAttribute('href'), 'https://openvibe.today/');
assert.strictEqual(root.querySelector('.ovm-group[data-mine="true"]').dataset.tail, 'true');
render(root, { view: 'room', messages: [{ id: 4, username: 'bob', message: 'room line' }] });
assert.strictEqual(root.querySelector('.ovm-room-text').textContent, 'room line');
// Actions (openvibe.design rule 138): one cluster per message at its corner; edit and delete only on your own;
// "edited" is one word after the words.
const pressed = [];
render(root, { view: 'room', me: 1, actions: ['reply', 'edit', 'delete'], onAction: (id, m) => pressed.push(`${id}:${m.id}`), messages: [
    { id: 5, sender_id: 2, username: 'bob', message: 'theirs' },
    { id: 6, sender_id: 1, username: 'alice', message: 'mine', edited_at: '2026-11-12 02:49:00' },
] });
const rows = root.querySelectorAll('.ovm-room');
assert.strictEqual(rows[0].querySelectorAll('.ovm-actions .ovm-act').length, 1, 'someone else\'s message: reply only');
assert.deepStrictEqual([...rows[1].querySelectorAll('.ovm-act')].map((b) => b.dataset.action), ['reply', 'edit', 'delete']);
assert.strictEqual(rows[1].querySelectorAll('.ovm-actions').length, 1, 'one cluster');
assert.ok(!rows[1].querySelector('.ovm-room-text .ovm-act'), 'no action inside the words');
assert.strictEqual(rows[1].querySelector('.ovm-room-text').nextElementSibling.className, 'ovm-edited', '"edited" right after the words');
assert.strictEqual(rows[1].querySelector('.ovm-edited').textContent, 'edited');
assert.ok(/^Edited/.test(rows[1].querySelector('.ovm-edited').title));
rows[1].querySelector('.ovm-act-edit').dispatchEvent(new window.Event('click', { bubbles: true }));
assert.deepStrictEqual(pressed, ['edit:6']);
assert.ok(rows[1].querySelector('.ovm-act-edit').getAttribute('aria-label'), 'each action is labelled');
// A site's own row gets the same cluster.
const own = document.createElement('div'); own.className = 'chat-msg'; root.appendChild(own);
const { actions } = require('../messages');
assert.strictEqual(actions(own, ['reply', 'edit'], { mine: false }).children.length, 1);
assert.strictEqual(actions(own, ['edit'], { mine: false }), null, 'nothing to offer: no cluster');
// The CSS: absolute, hidden until asked for, thumb-sized without hover.
const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'messages.css'), 'utf8');
assert.match(css, /\.ovm-actions \{ position: absolute;[^}]*display: none;/);
assert.match(css, /@media \(hover: none\) \{[\s\S]{0,300}\.ovm-act \{ width: 44px; height: 40px;/);
console.log('messages: room and bubbles, groups, dates, links and profile picture ok; actions in one cluster; edited after the words');
