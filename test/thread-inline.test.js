'use strict';
// openvibe-shared/thread's renderThread (4.215.0): the inline Community thread Video, Pics, Community's paste page and
// /c show, carried from OpenVibe.MediaHub test/comments-inline.test.js and OpenVibe.Community's page tests. The
// markup is one renderer: attachments only where the site allows them, the draft kept, and signed out the composer's
// spot is one sign-in line (the whole empty state when nobody has commented).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { renderThread } = require('../thread');
const files = require('../files');
const serve = require('../serve');

const answer = {
    thread: { id: 'cth_1234567890123456789012' }, viewer: { can_comment: true },
    comments: [{ id: 10, message: 'A <picture>', author: { username: 'alice', display_name: 'Alice', avatar_url: 'https://openvibe.network/avatar/alice' },
        created_at: '2026-11-10T12:00:00Z', reply_count: 3, can_delete: true,
        attachments: [{ id: 'med_01JAB2C3D4E5F6G7H8J9K0MNPQ', name: 'image.png', media_type: 'image/png' },
            { id: 'med_01JAB2C3D4E5F6G7H8J9K0MNPR', name: 'notes.pdf', media_type: 'application/pdf' }],
        replies: [{ id: 11, parent_id: 10, reply_to_id: 10, reply_to: { display_name: 'Alice' }, message: 'First', author: { username: 'bob', display_name: 'Bob' } },
            { id: 12, parent_id: 10, reply_to_id: 11, reply_to: { display_name: 'Bob' }, message: 'Second', author: { username: 'alice', display_name: 'Alice' } }],
    }],
};
const options = { answer, base: '/watch?v=12345678901', post: '/u/vup_1/comments', remove: '/u/vup_1/comments/delete', sort: 'top' };

const signedOut = renderThread({ ...options, signedIn: false });
assert.match(signedOut, /class="ovc-thread"/);
assert.match(signedOut, /Sign in to comment/);
assert.doesNotMatch(signedOut, /data-ovt-composer/);
assert.doesNotMatch(signedOut, /<nav class="ovc-order"/, 'one top-level comment has nothing to put in order');
assert.doesNotMatch(signedOut, /ovk-empty/, 'the empty box is gone; the sign-in line says it');
assert.match(signedOut, /1 more reply/);
assert.match(signedOut, /href="https:\/\/openvibe.network\/@alice"/);
assert.match(signedOut, /class="ovc-target"/);
assert.match(signedOut, /&lt;picture&gt;/);
assert.match(signedOut, /<img src="https:\/\/openvibe.media\/o\/med_/);
assert.match(signedOut, /notes.pdf/);
assert.match(signedOut, /%2Fwatch%3Fv%3D12345678901%26sort%3Dtop/);
assert.match(signedOut, /<p class="ovc-community"><a href="https:\/\/openvibe.community\/c\/cth_1234567890123456789012">Discuss on OpenVibe.Community<\/a><\/p>/);

// Top and Newest appear only when there is something to order.
const two = renderThread({ ...options, answer: { ...answer, comments: [...answer.comments, { ...answer.comments[0], id: 20, replies: [], reply_count: 0 }] }, signedIn: false });
assert.match(two, /<nav class="ovc-order"/);
assert.match(two, /sort=new/);
assert.match(two, /aria-current="page"/);

const signedIn = renderThread({ ...options, signedIn: true, replyId: 11 });
assert.match(signedIn, /data-ovt-composer/);
assert.match(signedIn, /name="parent_id" value="11"/);
assert.match(signedIn, /data-ovt-files/);
assert.match(signedIn, /name="comment_id" value="10"/);
assert.match(signedIn, /Up to four files, 16 MB each/);

// Community's paste page and Pics allow files; a thread that does not (attachmentsAllowed: false) draws no picker.
const noFiles = renderThread({ ...options, signedIn: true, attachmentsAllowed: false });
assert.doesNotMatch(noFiles, /data-ovt-files/);
assert.doesNotMatch(noFiles, /Up to four files/);
assert.doesNotMatch(noFiles, /enctype="multipart\/form-data"/);
assert.match(noFiles, /data-ovt-composer/);

// A failed post keeps the person's draft in the box, escaped.
const draft = renderThread({ ...options, signedIn: true, draft: 'half <b>written</b>' });
assert.match(draft, /data-ovt-text required>half &lt;b&gt;written&lt;\/b&gt;<\/textarea>/);

// Signed out with no comments yet: one line, not the line plus an empty-state box.
const emptyOut = renderThread({ ...options, answer: { ...answer, comments: [] }, signedIn: false });
assert.match(emptyOut, /<p class="ovc-signin">Be the first to comment\. <a /, 'signed out with no comments: one line, sign-in beside it');
assert.doesNotMatch(emptyOut, /ovk-empty/);
assert.doesNotMatch(emptyOut, /<nav class="ovc-order"/);
assert.match(renderThread({ ...options, answer: { ...answer, comments: [] }, signedIn: true }), /<p class="ovc-none">Be the first to comment\.<\/p>/);

// The stylesheet is a sibling this package serves like thread.css: listed, present, content-addressed.
assert.ok(files.STYLES.includes('thread-inline.css'), 'thread-inline.css is a browser stylesheet');
assert.ok(fs.existsSync(path.join(__dirname, '..', 'thread-inline.css')));
assert.match(serve.url('thread-inline.css'), /^\/shared\/thread-inline\.css\?v=[0-9a-f]{12}$/);

process.stdout.write('Inline thread: order only with two, one sign-in line when empty, attachments and drafts per site, the hashed stylesheet\n');
