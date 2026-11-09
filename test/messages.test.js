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
console.log('messages: room and bubbles, groups, dates, links and profile picture ok');
