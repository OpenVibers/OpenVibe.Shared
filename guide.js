'use strict';

(function (root) {

/** Point at a real hooked control without activating it or covering it. The host owns pointer styling. */
function startQuestGuide({ step, nextHref, root = document, onDone = () => {}, checkDone = null, pollMs = 5000 } = {}) {
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
        if (poll) clearInterval(poll);
        note.replaceChildren(root.createTextNode('Done. '));
        if (nextHref) {
            const link = root.createElement('a'); link.href = nextHref; link.textContent = 'Next step'; note.append(link);
        }
        onDone(step);
    };
    root.addEventListener('ov:quest:step-done', done);
    const poll = typeof checkDone === 'function' && !step.done ? setInterval(async () => {
        try { const latest = await checkDone(); if (latest?.step?.done) done({ detail: { event_type: step.event_type } }); }
        catch { /* the Events receipt may still be arriving; the next read retries */ }
    }, pollMs) : null;
    if (poll && typeof poll.unref === 'function') poll.unref();
    const dismiss = (event) => {
        if (event.key === 'Escape' || (event.type === 'pointerdown' && !note.contains(event.target) && !control.contains(event.target))) stop();
    };
    function stop() { if (poll) clearInterval(poll); root.removeEventListener('ov:quest:step-done', done); root.removeEventListener('keydown', dismiss); root.removeEventListener('pointerdown', dismiss); note.remove(); }
    root.addEventListener('keydown', dismiss); root.addEventListener('pointerdown', dismiss);
    if (step.done) done({ detail: { event_type: step.event_type } });
    return stop;
}

/** Resolve only a short opaque step id. The host supplies an authenticated reader. */
async function startFromLocation({ load, location = root.location, document: page = root.document, onDone } = {}) {
    if (typeof load !== 'function' || !location || !page) return () => {};
    const id = new URL(location.href).searchParams.get('qstep');
    if (!id || !/^[A-Za-z0-9_-]{12,48}$/.test(id)) return () => {};
    const answer = await load(id);
    if (!answer || !answer.step || !answer.step.hook) return () => {};
    // Many sites render the target after their page data arrives. Watch briefly instead of losing the guide.
    const selector = `[data-ov-guide="${CSS.escape(answer.step.hook)}"]`;
    if (!page.querySelector(selector) && page.defaultView?.MutationObserver) await new Promise((resolve) => {
        const observer = new page.defaultView.MutationObserver(() => {
            if (page.querySelector(selector)) { observer.disconnect(); clearTimeout(timer); resolve(); }
        });
        const timer = setTimeout(() => { observer.disconnect(); resolve(); }, 15000);
        observer.observe(page.documentElement, { childList: true, subtree: true });
    });
    return startQuestGuide({ step: answer.step, nextHref: answer.next_href, root: page, onDone, checkDone: () => load(id) });
}

const api = { startQuestGuide, startFromLocation };
if (typeof module === 'object' && module.exports) module.exports = api;
if (root && root.document) root.OpenVibeQuestGuide = api;
})(typeof window !== 'undefined' ? window : globalThis);
