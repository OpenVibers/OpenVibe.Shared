// ═══════════════════════════════════════════════════════════════
// OpenVibe — the agent button (openvibe-shared 4.288.0; plan §AD.15, the owner, 11-16: "a button … across all sites …
// that will start an agent or spawn an agent to do something … extremely configurable").
//
// In markup (the navbar loads this file once a page has one):
//   <button data-ov-agent="Set this up for me"                  the label (an empty button gets the glyph and this)
//           data-ov-agent-task="Set up AI here with safe defaults"   what to do (else the label)
//           data-ov-agent-context="page | selection | form | none"   what goes with it (default: page)
//           data-ov-agent-form="#settings"                       the form, when it is not the button's own
//           data-ov-agent-who="auto | actor | codes | <agent id or harness>"
//           data-ov-agent-model="<model id>"
//           data-ov-agent-approve="first">                       fill the box; the person reads it and presses send
// In script:
//   const run = await OVAgent.spawn({ task, context, form, agent, harness, model, approve, onEvent });
//   run.on('started' | 'step' | 'ended', fn); await run.done   → { ref, status, summary, outputs, url }
//   OVAgent.context('form', { form })                           → the words spawn would send with the task
//
// What happens: the menu opens on Vibe, the one session surface, and a session starts with the task and the page's
// context, worked where the person chose (the box's chip: agent, model, runs on). The run is told where it was asked
// (agents.run-start@1 context: site, url, title, kind). A form's context never carries a password, a key, a card, a
// one-time code or a hidden field, and nothing a page wrote is ever run as markup here.
// ═══════════════════════════════════════════════════════════════
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || (root.OVAgent && !root.OVAgent._stub)) return;

    const MAX_TASK = 2000;
    const MAX_PAGE = 1200;
    const MAX_SELECTION = 4000;
    const MAX_FIELDS = 40;
    const MAX_VALUE = 500;
    const STARTED_WITHIN_MS = 10 * 60 * 1000;   // approve: 'first' waits for the person to press send
    // Fields whose values never leave the page: their type, their autocomplete, or a name that says what they hold.
    const SKIP_TYPES = new Set(['password', 'hidden', 'file', 'submit', 'button', 'reset', 'image']);
    const SECRET_AUTOCOMPLETE = /^(cc-|current-password|new-password|one-time-code)/i;
    const SECRET_NAME = /pass(word|code|phrase)?|secret|token|api[-_ ]?key|private[-_ ]?key|\bkey\b|card|cvc|cvv|ssn|iban|\bpin\b|otp/i;

    const squash = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    const clip = (s, n) => { const t = squash(s); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
    const pageUrl = () => { try { const u = new URL(location.href); u.hash = ''; return u.toString(); } catch { return ''; } };

    function labelOf(el) {
        try {
            if (el.labels && el.labels.length) return squash(el.labels[0].textContent);
        } catch { /* */ }
        return squash(el.getAttribute('aria-label') || (el.closest('label') && el.closest('label').textContent) || el.getAttribute('placeholder') || el.name || el.id || '');
    }
    function secret(el) {
        const type = String(el.type || '').toLowerCase();
        if (SKIP_TYPES.has(type)) return true;
        if (SECRET_AUTOCOMPLETE.test(el.getAttribute('autocomplete') || '')) return true;
        if (el.closest('[data-ov-agent-private]')) return true;
        return SECRET_NAME.test(`${el.name || ''} ${el.id || ''} ${labelOf(el)}`);
    }
    /** A form's fields as "Label: value" lines, secrets left out (and said to be). */
    function formText(form) {
        if (!form || !form.elements) return '';
        const lines = []; let held = 0;
        for (const el of form.elements) {
            if (lines.length >= MAX_FIELDS) break;
            if (!el.name && !el.id) continue;
            if (el.disabled || el.tagName === 'FIELDSET' || el.tagName === 'OBJECT' || el.tagName === 'OUTPUT') continue;
            if (secret(el)) { if (!SKIP_TYPES.has(String(el.type || '').toLowerCase()) || el.type === 'password') held++; continue; }
            const type = String(el.type || '').toLowerCase();
            let v;
            if (type === 'checkbox') v = el.checked ? 'yes' : 'no';
            else if (type === 'radio') { if (!el.checked) continue; v = el.value; }
            else if (el.tagName === 'SELECT') v = [...el.selectedOptions].map((o) => squash(o.textContent)).join(', ');
            else v = el.value;
            const label = clip(labelOf(el), 80) || 'Field';
            lines.push(`${label}: ${clip(v, MAX_VALUE) || '(empty)'}`);
        }
        if (held) lines.push(`(${held} private field${held === 1 ? '' : 's'} left out)`);
        return lines.join('\n');
    }
    function mainText() {
        const main = document.querySelector('main, [role="main"], article') || document.body;
        if (!main) return '';
        let text = '';
        try { text = main.innerText || main.textContent || ''; } catch { text = ''; }
        return clip(text, MAX_PAGE);
    }
    function formFor(o, from) {
        const f = o && o.form;
        if (f && f.elements) return f;
        if (typeof f === 'string') { try { return document.querySelector(f); } catch { return null; } }
        const sel = from && from.getAttribute && from.getAttribute('data-ov-agent-form');
        if (sel) { try { return document.querySelector(sel); } catch { return null; } }
        return (from && from.closest && from.closest('form')) || null;
    }
    /** The words that go with the task, and what kind they are: page | selection | form | none (or the page's own). */
    function context(kind, o = {}, from = null) {
        if (kind && typeof kind === 'object') return { kind: 'given', text: clip(kind.text || '', MAX_SELECTION) };
        const k = String(kind || 'page');
        if (k === 'none') return { kind: 'none', text: '' };
        if (k === 'selection') {
            let s = '';
            try { s = String(root.getSelection ? root.getSelection() : '').trim(); } catch { s = ''; }
            if (s) return { kind: 'selection', text: clip(s, MAX_SELECTION) };
        }
        if (k === 'form') {
            const text = formText(formFor(o, from));
            if (text) return { kind: 'form', text };
        }
        const desc = (document.querySelector('meta[name="description"]') || {}).content || '';
        const h1 = (document.querySelector('h1') || {}).textContent || '';
        const body = mainText();
        return { kind: 'page', text: [clip(h1, 200), clip(desc, 300), body].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join('\n') };
    }
    function words(task, ctx) {
        const t = clip(task, MAX_TASK);
        if (!ctx.text) return t;
        const where = clip(document.title, 120);
        const head = ctx.kind === 'form' ? 'The form' : ctx.kind === 'selection' ? 'What I selected' : ctx.kind === 'given' ? 'Context' : 'The page';
        return `${t}\n\n${head}${where ? ` (on ${where}, ${pageUrl()})` : ` (${pageUrl()})`}:\n${ctx.text}`;
    }

    // Every session event the menu's Vibe sees (search.js forwards them as "ov:session").
    const listeners = new Set();
    root.addEventListener('ov:session', (e) => { const d = e && e.detail; if (d) listeners.forEach((fn) => { try { fn(d.type, d.data || {}); } catch { /* */ } }); });

    function handle(onEvent) {
        const on = new Map();
        let ref = null; let settle; let since = Date.now();
        const done = new Promise((ok) => { settle = ok; });
        const fire = (name, data) => {
            (on.get(name) || []).forEach((fn) => { try { fn(data); } catch { /* the page's */ } });
            if (typeof onEvent === 'function') { try { onEvent(name, data); } catch { /* the page's */ } }
        };
        const watch = (type, data) => {
            if (type === 'session.started' && !ref && Date.now() - since < STARTED_WITHIN_MS) { ref = data.ref; fire('started', { ref, run: data.run }); return; }
            if (!ref || data.ref !== ref) return;
            if (type === 'session.step') fire('step', data.step);
            else if (type === 'session.approval') fire('approval', data);
            else if (type === 'session.ended') {
                const run = data.run || {};
                const out = { ref, status: run.status || 'ended', summary: run.result_summary || '', outputs: run.outputs || [], url: run.url || '' };
                fire('ended', out); listeners.delete(watch); settle(out);
            }
        };
        listeners.add(watch);
        return {
            get ref() { return ref; },
            done,
            on(name, fn) { if (typeof fn === 'function') { if (!on.has(name)) on.set(name, []); on.get(name).push(fn); } return this; },
            stop() { listeners.delete(watch); },
            _restart() { since = Date.now(); },
        };
    }

    /** Start an agent with a task and the page's context. Resolves to a handle (on, done, ref, stop). */
    async function spawn(o = {}, from = null) {
        const task = squash(o.task || '');
        if (!task) throw new TypeError('OVAgent.spawn needs a task');
        const ctx = context(o.context == null ? 'page' : o.context, o, from);
        const text = words(task, ctx);
        const who = squash(o.agent || o.harness || '') || null;
        const runContext = { site: clip(location.hostname, 60), url: pageUrl().slice(0, 2000), title: clip(document.title, 300), kind: ctx.kind === 'given' ? 'page' : ctx.kind };
        if (!runContext.title) delete runContext.title;
        const h = handle(o.onEvent);
        const S = root.OpenVibeSearch;
        if (S && typeof S.ask === 'function') {
            S.ask(text, { agent: who && who !== 'auto' ? who : null, model: o.model ? String(o.model).slice(0, 160) : null, context: runContext, prefill: o.approve === 'first' || o.approve === true });
        } else {
            // No menu here (a page without the navbar): Vibe on openvibe.chat, in a new tab, with the words.
            h.stop();
            const url = `https://openvibe.chat/vibe?ask=${encodeURIComponent(text.slice(0, 1800))}`;
            try { root.open(url, '_blank', 'noopener'); } catch { location.href = url; }
        }
        return h;
    }

    // The buttons: one listener for the page, whatever is added later.
    const CSS = `[data-ov-agent][data-ov-agent-drawn] { display: inline-flex; align-items: center; gap: 8px; }
[data-ov-agent][data-ov-agent-drawn] .ovag-ic { width: 16px; height: 16px; flex: none; }
[data-ov-agent][aria-busy="true"] { cursor: progress; }
[data-ov-agent][aria-busy="true"] .ovag-ic { animation: ovag-turn 1.1s linear infinite; }
@keyframes ovag-turn { to { transform: rotate(360deg); } }
html[data-ov-motion="off"] [data-ov-agent] .ovag-ic { animation: none; }`;
    function style() {
        if (document.getElementById('ov-agent-styles')) return;
        const s = document.createElement('style'); s.id = 'ov-agent-styles'; s.textContent = CSS; (document.head || document.documentElement).append(s);
    }
    /** An empty button gets the agent glyph and its label (data-ov-agent), drawn by ov-glyphs.js like every glyph. */
    function draw(btn) {
        if (btn.hasAttribute('data-ov-agent-drawn') || btn.textContent.trim() || btn.children.length) return;
        const label = squash(btn.getAttribute('data-ov-agent')) || 'Ask an agent';
        const ic = document.createElement('i'); ic.setAttribute('data-ov-icon', 'spark'); ic.setAttribute('aria-hidden', 'true'); ic.className = 'ovag-ic';
        const t = document.createElement('span'); t.textContent = label;
        btn.append(ic, t); btn.setAttribute('data-ov-agent-drawn', '');
    }
    function drawAll(rootEl) { try { (rootEl || document).querySelectorAll('[data-ov-agent]').forEach(draw); } catch { /* */ } }
    document.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('[data-ov-agent]') : null;
        if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
        e.preventDefault();
        if (btn.getAttribute('aria-busy') === 'true') return;
        const d = (k) => btn.getAttribute(`data-ov-agent-${k}`);
        const task = d('task') || btn.getAttribute('data-ov-agent') || '';
        btn.setAttribute('aria-busy', 'true');
        const idle = () => btn.removeAttribute('aria-busy');
        spawn({ task, context: d('context') || 'page', agent: d('who'), model: d('model'), approve: d('approve') === 'first' ? 'first' : false }, btn)
            .then((h) => {
                btn.dispatchEvent(new CustomEvent('ov-agent:spawned', { bubbles: true, detail: { run: h } }));
                setTimeout(idle, 900);
                h.on('ended', (out) => btn.dispatchEvent(new CustomEvent('ov-agent:ended', { bubbles: true, detail: out })));
            }, idle);
    });
    function ready() {
        style(); drawAll();
        if (typeof MutationObserver === 'function' && document.body) {
            let soon = 0;
            new MutationObserver(() => { if (soon) return; soon = setTimeout(() => { soon = 0; drawAll(); }, 200); }).observe(document.body, { childList: true, subtree: true });
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true }); else ready();

    root.OVAgent = { spawn: (o) => spawn(o), context: (kind, o) => context(kind, o || {}).text, version: '4.288.0' };
    if (typeof module === 'object' && module.exports) module.exports = root.OVAgent;
})(typeof globalThis !== 'undefined' ? globalThis : this);
