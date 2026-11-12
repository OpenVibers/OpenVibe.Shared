'use strict';
// openvibe-shared/quest in a linkedom page: the card draws every state with the same words and links as the
// OpenVibe.Live home card, marks the next step, tolerates a missing `more`, and redraws on refresh. The guide's
// own test stays here too: it points at a hooked control and finishes on its event.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const { startQuestGuide, startFromLocation } = require('../guide');
const files = require('../files');

const { window, document } = parseHTML('<!doctype html><html><head></head><body></body></html>');
global.window = window;
global.document = document;
const { mount, mountAll } = require('../quest');

const step = (site, sentence, extra = {}) => ({ site: `openvibe.${site}`, sentence, href: `https://openvibe.${site}/`, ...extra });
const quest = (extra = {}) => ({
    title: 'Make something today',
    story: 'Three small things, across the network, to make today yours.',
    steps: [step('pics', 'Upload a picture'), step('chat', 'Send a public chat message'), step('live', 'Go live for a stream')],
    progress: 0,
    ...extra,
});

function host() {
    const node = document.createElement('div');
    document.body.append(node);
    return node;
}

(async () => {
    assert.ok(files.isBrowserFile('quest.js'), 'sites serve quest.js');
    assert.ok(files.isBrowserFile('guide.js'), 'sites serve guide.js');
    assert.ok(files.isBrowserFile('quest.css'), 'sites serve quest.css');
    const declarativeHost = host();
    declarativeHost.setAttribute('data-ov-quest', '');
    const [declarative] = mountAll({ load: async () => ({ signed_in: false, quest: quest() }) });
    assert.strictEqual(declarative, declarativeHost._ovq);
    await declarative.refresh();
    assert.equal(declarative.el.hidden, false);

    // Signed out: today's quest, the three doors, no streak and no progress.
    const out = mount(host(), { load: async () => ({ signed_in: false, quest: quest(), more: { quests: 24, sites: 8 } }) });
    await out.refresh();
    assert.equal(out.el.hidden, false);
    assert.equal(out.el.dataset.progress, '0');
    assert.equal(out.el.querySelector('.ovq-kicker').textContent, "TODAY'S QUEST");
    assert.equal(out.el.querySelector('.ovq-title').textContent, 'Make something today');
    assert.equal(out.el.querySelector('.ovq-story').textContent, 'Three small things, across the network, to make today yours.');
    const outSteps = [...out.el.querySelectorAll('.ovq-steps li')];
    assert.equal(outSteps.length, 3);
    assert.deepEqual(outSteps.map((li) => li.querySelector('a').href), ['https://openvibe.pics/', 'https://openvibe.chat/', 'https://openvibe.live/']);
    assert.deepEqual(outSteps.map((li) => li.querySelector('.ovq-step span').textContent), ['Upload a picture', 'Send a public chat message', 'Go live for a stream']);
    assert.deepEqual(outSteps.map((li) => li.querySelector('.ovq-step small').textContent), ['OpenVibe.Pics', 'OpenVibe.Chat', 'OpenVibe.Live']);
    assert.equal(out.el.querySelectorAll('.is-next, .is-done').length, 0);
    assert.equal(out.el.querySelectorAll('.ovq-steps .ov-appicon').length, 3, 'each step wears its site\'s app icon (design rule 142)');
    assert.deepEqual([...out.el.querySelectorAll('.ovq-steps .ov-appicon')].map((i) => [i.dataset.icon, i.dataset.size]), [['pics', '32'], ['chat', '32'], ['live', '32']]);
    assert.equal(out.el.querySelector('.ovq-chip').hidden, true);
    assert.equal(out.el.querySelector('.ovq-more-line, .ovq-more-text span').textContent, '24 quests on 8 sites, each with a badge');
    assert.equal(out.el.querySelector('.ovq-more').href, 'https://openvibe.quest/');

    // One step done, a streak: the next step is marked, the done one checked, and the door counts what is left.
    const one = mount(host(), {
        load: async () => ({
            signed_in: true,
            quest: quest({ progress: 1, streak: 5, steps: [
                step('pics', 'Upload a picture', { done: true }),
                step('chat', 'Send a public chat message', { done: false }),
                step('live', 'Go live for a stream', { done: false }),
            ] }),
            more: { quests: 12, sites: 6, mine: { badges: 3, in_progress: 1, completed: 2 } },
        }),
    });
    await one.refresh();
    assert.equal(one.el.dataset.progress, '1');
    assert.equal(one.el.querySelector('.ovq-kicker').textContent, "TODAY'S QUEST · 1 OF 3");
    const chip = one.el.querySelector('.ovq-chip');
    assert.equal(chip.hidden, false);
    assert.equal(chip.textContent.trim(), '5');
    assert.equal(chip.title, '5-day streak');
    assert.equal(chip.getAttribute('aria-label'), '5-day streak');
    const oneSteps = [...one.el.querySelectorAll('.ovq-steps li')];
    assert.equal(oneSteps[0].classList.contains('is-done'), true);
    assert.equal(oneSteps[0].classList.contains('is-next'), false);
    assert.equal(oneSteps[0].querySelector('.ovq-check').textContent, '✓');
    assert.equal(oneSteps[1].classList.contains('is-next'), true);
    assert.equal(oneSteps[1].querySelector('.ovq-step small').textContent, 'Next · OpenVibe.Chat');
    assert.equal(oneSteps[2].classList.contains('is-next'), false);
    assert.equal(one.el.querySelector('.ovq-more-text span').textContent, '3 badges · 1 quest going · 9 more to try');
    assert.equal(oneSteps[0].querySelector('.ovq-go'), null, 'no chevron on a done step');

    // All done: the head says so, the three steps are checked, and nothing is "next".
    const done = mount(host(), {
        load: async () => ({
            signed_in: true,
            quest: quest({ progress: 3, streak: 5, completed: true, steps: [
                step('pics', 'Upload a picture', { done: true }),
                step('chat', 'Send a public chat message', { done: true }),
                step('live', 'Go live for a stream', { done: true }),
            ] }),
            more: { quests: 12, sites: 6, mine: { badges: 3, in_progress: 1, completed: 2 } },
        }),
    });
    await done.refresh();
    assert.equal(done.el.dataset.progress, '3');
    assert.equal(done.el.querySelector('.ovq-kicker').textContent, "TODAY'S QUEST · DONE");
    assert.equal(done.el.querySelectorAll('.ovq-steps li.is-done').length, 3);
    assert.equal(done.el.querySelectorAll('.ovq-steps li.is-next').length, 0);
    assert.equal(done.el.querySelectorAll('.ovq-check').length, 3);

    // A missing `more` still draws the card, with the door's own line.
    const bare = mount(host(), { load: async () => ({ signed_in: false, quest: quest() }) });
    await bare.refresh();
    assert.equal(bare.el.hidden, false);
    assert.equal(bare.el.querySelector('.ovq-more-text span').textContent, 'Every quest, your badges and your streak');

    // refresh() redraws the new answer; anything that is not a three-step quest hides the card instead.
    let answer = { signed_in: false, quest: quest() };
    const changing = mount(host(), { load: async () => answer });
    await changing.refresh();
    answer = { signed_in: true, quest: quest({ progress: 3, completed: true, steps: [
        step('pics', 'Upload a picture', { done: true }),
        step('chat', 'Send a public chat message', { done: true }),
        step('live', 'Go live for a stream', { done: true }),
    ] }) };
    await changing.refresh();
    assert.equal(changing.el.querySelector('.ovq-kicker').textContent, "TODAY'S QUEST · DONE");
    answer = { signed_in: true, quest: { ...quest(), steps: [step('pics', 'Upload a picture')] } };
    await changing.refresh();
    assert.equal(changing.el.hidden, true);
    answer = null;
    const broken = mount(host(), { load: async () => { throw new Error('offline'); } });
    await broken.refresh();
    assert.equal(broken.el.hidden, true);

    // The guide: still points at a hooked control without activating it, and finishes on its event.
    const listeners = new Map();
    const note = { textContent: '', children: [], setAttribute() {}, remove() { this.removed = true; }, append(x) { this.children.push(x); }, replaceChildren(x) { this.textContent = x; } };
    const control = { scrollIntoView() { this.arrived = true; }, insertAdjacentElement(_where, el) { this.note = el; }, contains: () => false };
    const guideRoot = {
        querySelector: () => control, createElement: () => note, createTextNode: (s) => s,
        addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name),
    };
    global.CSS = { escape: (s) => s };
    let completed = false;
    const stop = startQuestGuide({ root: guideRoot, step: { hook: 'pics.upload', help: 'Choose a picture', event_type: 'mediahub.picture.uploaded' }, nextHref: '/next', onDone: () => { completed = true; } });
    assert.equal(control.arrived, true);
    assert.equal(note.textContent, 'Choose a picture');
    listeners.get('ov:quest:step-done')({ detail: { event_type: 'mediahub.picture.uploaded' } });
    assert.equal(completed, true);
    assert.equal(note.children[0].href, '/next');
    stop();
    assert.equal(note.removed, true);

    let requested = null;
    const stopFromLink = await startFromLocation({
        location: { href: 'https://openvibe.pics/?qstep=AbC_0123456789' }, document: guideRoot,
        load: async (id) => { requested = id; return { step: { hook: 'pics.upload', help: 'Choose a picture', event_type: 'mediahub.picture.uploaded' } }; },
    });
    assert.equal(requested, 'AbC_0123456789');
    assert.equal(control.arrived, true);
    stopFromLink();
    let mountedLater = false;
    const delayedRoot = { ...guideRoot, querySelector: () => mountedLater ? control : null,
        documentElement: {}, defaultView: { MutationObserver: class {
            constructor(notify) { this.notify = notify; }
            observe() { mountedLater = true; this.notify(); }
            disconnect() {}
        } } };
    const stopDelayed = await startFromLocation({ location: { href: 'https://openvibe.pics/?qstep=AbC_0123456789' },
        document: delayedRoot, load: async () => ({ step: { hook: 'pics.upload', help: 'Choose a picture', event_type: 'mediahub.picture.uploaded' } }) });
    assert.equal(mountedLater, true);
    stopDelayed();
    let observed = false;
    const stopPolled = startQuestGuide({ root: guideRoot,
        step: { hook: 'pics.upload', help: 'Choose a picture', event_type: 'mediahub.picture.uploaded' },
        checkDone: async () => ({ step: { done: true } }), pollMs: 1, onDone: () => { observed = true; } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(observed, true, 'the guide follows the Events-backed step read');
    stopPolled();
    requested = null;
    await startFromLocation({ location: { href: 'https://openvibe.pics/?qstep=plain text' }, document: guideRoot, load: async (id) => { requested = id; } });
    assert.equal(requested, null);
    const browser = { document: guideRoot };
    vm.runInNewContext(fs.readFileSync(require.resolve('../guide'), 'utf8'), { window: browser });
    assert.equal(typeof browser.OpenVibeQuestGuide.startFromLocation, 'function');

    process.stdout.write('quest card and guide passed\n');
})().catch((err) => { process.stderr.write(String(err.stack || err) + '\n'); process.exit(1); });
