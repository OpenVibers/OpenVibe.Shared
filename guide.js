'use strict';

/** Point at a real hooked control without activating it or covering it. The host owns pointer styling. */
function startQuestGuide({ step, nextHref, root = document, onDone = () => {} } = {}) {
    if (!step || !/^[a-z][a-z0-9_.-]{1,63}$/.test(step.hook || '') || !step.event_type) return () => {};
    const control = root.querySelector(`[data-ov-guide="${CSS.escape(step.hook)}"]`);
    if (!control) return () => {};
    control.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const note = root.createElement('aside');
    note.setAttribute('data-ov-quest-guide', '');
    note.setAttribute('role', 'status');
    note.textContent = step.help;
    control.insertAdjacentElement('beforebegin', note);
    let finished = false;
    const done = (event) => {
        if (finished || !event || event.detail?.event_type !== step.event_type) return;
        finished = true;
        note.replaceChildren(root.createTextNode('Done. '));
        if (nextHref) {
            const link = root.createElement('a'); link.href = nextHref; link.textContent = 'Next step'; note.append(link);
        }
        onDone(step);
    };
    root.addEventListener('ov:quest:step-done', done);
    const dismiss = (event) => {
        if (event.key === 'Escape' || (event.type === 'pointerdown' && !note.contains(event.target) && !control.contains(event.target))) stop();
    };
    function stop() { root.removeEventListener('ov:quest:step-done', done); root.removeEventListener('keydown', dismiss); root.removeEventListener('pointerdown', dismiss); note.remove(); }
    root.addEventListener('keydown', dismiss); root.addEventListener('pointerdown', dismiss);
    return stop;
}

module.exports = { startQuestGuide };
