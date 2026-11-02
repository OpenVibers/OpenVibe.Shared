'use strict';
// Busy buttons (ov-mark.js, 4.91.0; the plan: "buttons' busy, then done or failed, from the mark's states"). A button at
// work shows the mark busy beside its label, keeps its width and takes no second press; done shows the tick, fail the
// "!", then the label comes back. A form posted the old way (POST) does this by itself, never disables its submitter
// (its name and value must still post), ignores a second submit, and leaves alone a GET form, a form whose own script
// took the submit, and a form that opts out.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'ov-mark.js'), 'utf8');

function setup(html) {
    const { window, document, MutationObserver, Event } = parseHTML(`<!doctype html><html><head></head><body>${html}</body></html>`);
    let now = 1000000, timers = [];
    const clock = {
        advance(ms) {
            now += ms;
            for (;;) {
                const due = timers.filter((t) => t.at <= now).sort((a, b) => a.at - b.at)[0];
                if (!due) break;
                timers = timers.filter((t) => t !== due); due.fn();
            }
        },
    };
    const FakeDate = class extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } };
    const setT = (fn, ms) => { const t = { fn, at: now + ms }; timers.push(t); return t; };
    const clearT = (t) => { timers = timers.filter((x) => x !== t); };
    class IO { constructor() {} observe() {} unobserve() {} }
    window.matchMedia = () => ({ matches: false, addEventListener() {} });
    window.__ovMark = false;
    const session = { getItem: () => null, setItem() {}, removeItem() {} };
    new Function('window', 'document', 'IntersectionObserver', 'MutationObserver', 'setTimeout', 'clearTimeout', 'Date', 'sessionStorage', SRC)(
        window, document, IO, MutationObserver, setT, clearT, FakeDate, session);
    const submit = (form, submitter, { prevent = false } = {}) => {
        const e = new Event('submit', { bubbles: true, cancelable: true });
        e.submitter = submitter;
        if (prevent) form.addEventListener('submit', (ev) => ev.preventDefault(), { once: true });
        form.dispatchEvent(e);
        return e;
    };
    return { window, document, clock, submit };
}

(async () => {
    // ── OVMark.busy: busy, then done or fail, then the label is back ─────
    {
        const t = setup('<button id="b" type="button">Save <b>now</b></button>');
        const b = t.document.getElementById('b');
        const api = t.window.OVMark.busy(b);
        assert.ok(api && typeof api.done === 'function' && typeof api.fail === 'function', 'busy() answers done and fail');
        assert.strictEqual(t.window.OVMark.busy(b), api, 'a second busy() on the same button is the same one');
        assert.strictEqual(b.getAttribute('aria-busy'), 'true');
        assert.ok(b.classList.contains('ov-busy'), 'the button takes no second press while busy');
        assert.strictEqual(b.disabled, false, 'never disabled');
        const mark = b.querySelector('.ov-busy-mark');
        assert.ok(mark && mark.getAttribute('data-state') === 'busy' && mark.getAttribute('aria-hidden') === 'true', 'the mark at work, beside the label');
        assert.ok(mark.querySelector('svg'), 'the mark is drawn');
        api.done();
        assert.strictEqual(mark.getAttribute('data-state'), 'ok', 'done: the tick');
        assert.match(b.textContent, /Done/);
        t.clock.advance(1500);
        assert.strictEqual(b.innerHTML, 'Save <b>now</b>', 'the label comes back exactly');
        assert.ok(!b.hasAttribute('aria-busy') && !b.classList.contains('ov-busy'));
        const again = t.window.OVMark.busy(b);
        again.fail('Not saved');
        assert.strictEqual(b.querySelector('.ov-busy-mark').getAttribute('data-state'), 'error', 'fail: the "!"');
        assert.match(b.textContent, /Not saved/);
        t.clock.advance(2700);
        assert.strictEqual(b.innerHTML, 'Save <b>now</b>');
    }

    // ── a form posted the old way ─────
    {
        const t = setup(`<form id="post" method="post" action="/report"><button id="worked" name="result" value="worked">It worked</button><button id="failed" name="result" value="failed">It didn't work</button></form>
<form id="get" method="get" action="/search"><button id="go">Search</button></form>
<form id="mine" method="post" action="/x"><button id="mineb">Send</button></form>
<form id="off" method="post" action="/x" data-ov-busy="off"><button id="offb">Send</button></form>`);
        const $ = (id) => t.document.getElementById(id);
        const first = t.submit($('post'), $('failed'));
        assert.strictEqual(first.defaultPrevented, false, 'the post goes through');
        assert.strictEqual($('failed').getAttribute('aria-busy'), 'true', 'the button pressed is the busy one');
        assert.strictEqual($('worked').hasAttribute('aria-busy'), false, 'not the other');
        assert.strictEqual($('failed').disabled, false, 'its name and value still post');
        const second = t.submit($('post'), $('worked'));
        assert.strictEqual(second.defaultPrevented, true, 'a second submit does nothing');
        t.submit($('get'), $('go'));
        assert.strictEqual($('go').hasAttribute('aria-busy'), false, 'a GET form is left alone');
        t.submit($('mine'), $('mineb'), { prevent: true });
        assert.strictEqual($('mineb').hasAttribute('aria-busy'), false, 'a form whose own script took the submit is left alone');
        t.submit($('off'), $('offb'));
        assert.strictEqual($('offb').hasAttribute('aria-busy'), false, 'data-ov-busy="off" opts out');
        // Back from the back/forward cache: nothing is busy.
        const e = new t.window.Event('pageshow'); e.persisted = true; t.window.dispatchEvent(e);
        assert.strictEqual($('failed').hasAttribute('aria-busy'), false);
        assert.strictEqual(t.submit($('post'), $('worked')).defaultPrevented, false, 'and the form posts again');
    }

    // ── the CSS ─────
    {
        const t = setup('');
        const css = t.document.getElementById('ov-mark-css').textContent;
        assert.match(css, /\.ov-busy\{cursor:progress;pointer-events:none\}/);
        assert.match(css, /\.ov-busy-mark\{/);
    }
    console.log('busy buttons: busy, done, fail, the label back; POST forms by themselves; GET, taken and opted-out forms left alone');
})().catch((e) => { console.error(e); process.exit(1); });
