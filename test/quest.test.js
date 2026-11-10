'use strict';
const assert = require('node:assert/strict');
const { mountQuestCards } = require('../quest');
const { startQuestGuide } = require('../guide');

(async () => {
    const card = { hidden: true, innerHTML: '' };
    const mounted = await mountQuestCards({ querySelectorAll: () => [card] }, {
        fetchImpl: async (url) => ({ ok: true, json: async () => ({ title: 'Today', story: 'Go explore', progress: 1,
            steps: [{ sentence: 'Upload a picture', href: 'https://openvibe.pics/', done: true }] }) }),
    });
    assert.equal(mounted[0].status, 'fulfilled');
    assert.equal(card.hidden, false);
    assert.match(card.innerHTML, /Upload a picture/);

    const listeners = new Map();
    const note = { textContent: '', children: [], setAttribute() {}, remove() { this.removed = true; }, append(x) { this.children.push(x); }, replaceChildren(x) { this.textContent = x; } };
    const control = { scrollIntoView() { this.arrived = true; }, insertAdjacentElement(_where, el) { this.note = el; }, contains: () => false };
    const root = {
        querySelector: () => control, createElement: () => note, createTextNode: (s) => s,
        addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name),
    };
    global.CSS = { escape: (s) => s };
    let completed = false;
    const stop = startQuestGuide({ root, step: { hook: 'pics.upload', help: 'Choose a picture', event_type: 'mediahub.picture.uploaded' }, nextHref: '/next', onDone: () => { completed = true; } });
    assert.equal(control.arrived, true);
    assert.equal(note.textContent, 'Choose a picture');
    listeners.get('ov:quest:step-done')({ detail: { event_type: 'mediahub.picture.uploaded' } });
    assert.equal(completed, true);
    assert.equal(note.children[0].href, '/next');
    stop();
    assert.equal(note.removed, true);
    process.stdout.write('quest card and guide passed\n');
})().catch((err) => { process.stderr.write(String(err.stack || err) + '\n'); process.exit(1); });
