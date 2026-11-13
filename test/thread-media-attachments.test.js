'use strict';
// A comment's Media composer attachments (4.247.0, plan §Z.9): with mediaAttachments the box takes any video, picture,
// sound, PDF or text at Media's limits and says so; without it nothing changes. A video plays (Media's web copy, the
// network's player), one still being made is a link to the file with its first frame, a picture and a sound show, and
// nothing off openvibe.media is ever drawn.
const assert = require('node:assert/strict');
const thread = require('../thread');

const ID = 'att_01JZ0M0Q8F3K2V7YB6N4T5R9WQ';
const at = (path) => `https://openvibe.media/a/${ID}/${path}`;
const answerWith = (attachments) => ({
    thread: { id: 'cth_1', access_id: 'cth_1', comment_count: 1 },
    comments: [{ id: 7, message: 'Look', created_at: '2026-11-13T00:00:00Z', author: { username: 'kim' }, attachments }],
});
const draw = (attachments, extra = {}) => thread.renderThread({ answer: answerWith(attachments), base: '/x', post: '/x/c', remove: '/x/r', signedIn: true, ...extra });

// The box.
const media = draw([], { mediaAttachments: true });
assert.match(media, /data-ovc-media="1"/);
assert.match(media, /data-ovc-max-files="4"/);
assert.match(media, /accept="image\/\*,video\/\*,audio\/\*,application\/pdf,text\/plain,\.mkv,\.avi,\.mov/);
assert.match(media, /videos up to 300 MB \(MP4, MOV, MKV, AVI, WebM and the rest\)/);
const plain = draw([]);
assert.doesNotMatch(plain, /data-ovc-media/);
assert.match(plain, /accept="image\/jpeg,image\/png,image\/gif,image\/webp,application\/pdf,text\/plain"/);
assert.match(plain, /16 MB each/);
assert.doesNotMatch(draw([], { mediaAttachments: true, attachmentsAllowed: false }), /data-ovc-media/, 'no files, no Media');

// A video with its web copy: the network's player, the poster, its shape and length.
const video = draw([{ id: ID, kind: 'video', name: '7224.mp4', media_type: 'video/x-matroska', url: at('7224.mkv'), poster: at('thumb.jpg'),
    playback: { url: at('playback.mp4'), mime: 'video/mp4', ready: true }, duration_s: 73.4, width: 1920, height: 1080 }]);
assert.match(video, new RegExp(`<video data-ov-player controls preload="none" playsinline src="${at('playback.mp4').replace(/[.]/g, '\\.')}" poster="${at('thumb.jpg').replace(/[.]/g, '\\.')}" width="1920" height="1080"`));
assert.match(video, /<figcaption>7224\.mp4 · 1:13<\/figcaption>/);

// A video whose copy is still being made: its first frame and a link to the file.
const preparing = draw([{ id: ID, kind: 'video', url: at('a.avi'), poster: at('thumb.jpg'), playback: { url: at('playback.mp4'), ready: false } }]);
assert.match(preparing, /class="ovc-attach ovc-attach--video is-preparing" href="https:\/\/openvibe\.media\/a\//);
assert.doesNotMatch(preparing, /<video/);

// A picture and a sound; a file.
assert.match(draw([{ id: ID, kind: 'image', name: 'p.heic', url: at('p.heic'), poster: at('thumb.jpg') }]), /<img src="https:\/\/openvibe\.media\/a\/att_[^"]+\/thumb\.jpg" alt="p\.heic"/);
assert.match(draw([{ id: ID, kind: 'audio', url: at('s.ogg') }]), /<audio controls preload="none" src="https:\/\/openvibe\.media\/a\//);
assert.match(draw([{ id: ID, kind: 'file', name: 'notes.pdf', url: at('notes.pdf') }]), /ovc-attach--file" href="https:\/\/openvibe\.media\/a\/[^"]+"[^>]*>notes\.pdf</);

// Never a URL off openvibe.media, never a script.
assert.doesNotMatch(draw([{ id: ID, kind: 'video', url: 'https://evil.example/a.mp4', playback: { url: 'https://evil.example/a.mp4', ready: true } }]), /evil|<video/);
assert.doesNotMatch(draw([{ id: ID, kind: 'video', url: at('a.mp4'), playback: { url: 'javascript:alert(1)', ready: true } }]), /javascript:|<video/);
assert.doesNotMatch(draw([{ id: ID, kind: 'image', name: '"><script>x</script>', url: at('p.png') }]), /<script>x/);
assert.doesNotMatch(draw([{ id: 'att_bad', kind: 'image', url: at('p.png') }]), /openvibe\.media\/a\//, 'an id that is not one is dropped');

// The old Media objects draw as before.
assert.match(draw([{ id: 'med_01JZ0M0Q8F3K2V7YB6N4T5R9WQ', media_type: 'image/png', name: 'x.png' }]), /https:\/\/openvibe\.media\/o\/med_/);

console.log('thread-media-attachments: any video plays in a comment; the box takes it at Media\'s limits');
