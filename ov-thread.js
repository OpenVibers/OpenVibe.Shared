/* openvibe-shared/ov-thread.js — the conversation UI's behaviour (plan L55 C4), for markup from openvibe-shared/thread
 * drawn with thread.css. The page works without it; with it:
 *   - the chats open as a drawer on a phone (Esc or the scrim closes it), and the search box filters them;
 *   - the composer grows as you type, Enter sends on a keyboard (Shift+Enter is a new line), Send waits for words;
 *   - a starter fills the composer; Copy on each answer and on each code block;
 *   - the thread opens at its bottom and stays there while you are there;
 *   - the sticky head and the chats column sit under the navbar, and follow it when it steps away.
 * A site that streams turns uses window.OVThread:
 *   OVThread.add(html)            append a turn (string or element) to the page's thread
 *   OVThread.replace(id, html)    swap the turn data-turn="id" (its answer fades in)
 *   OVThread.live(id, text)       the working turn's live line ("Reading the page")
 *   OVThread.work(id, html)       append a row to the turn's work list
 *   OVThread.enhance(el)          Copy buttons for answers and code under el (add/replace call it)
 * Booted on load and after an in-place page swap (openvibe-shared/boost's ov:boost:load).
 */
(function (root) {
    'use strict';
    if (root.OVThread) return;
    var fine = root.matchMedia && root.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var canCopy = !!(root.navigator && navigator.clipboard && navigator.clipboard.writeText);

    function q(el, sel) { return el ? el.querySelector(sel) : null; }
    function qa(el, sel) { return el ? Array.prototype.slice.call(el.querySelectorAll(sel)) : []; }
    function frag(html) {
        if (typeof html !== 'string') return html;
        var t = document.createElement('template');
        t.innerHTML = html.trim();
        return t.content.firstElementChild;
    }
    function nearBottom() { return (root.innerHeight || 0) + (root.scrollY || 0) >= (document.documentElement.scrollHeight || 0) - 220; }
    function toBottom(smooth) { if (typeof root.scrollTo === 'function') root.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth && !reduce ? 'smooth' : 'auto' }); }

    function copyText(text, btn) {
        if (!canCopy) return;
        navigator.clipboard.writeText(text).then(function () {
            var label = btn.querySelector('span') || btn;
            var was = label.textContent;
            label.textContent = 'Copied';
            setTimeout(function () { label.textContent = was; }, 1400);
        }).catch(function () { /* a refused clipboard changes nothing */ });
    }

    /** Copy on answers and code blocks under el (once each). */
    function enhance(el) {
        if (!el) return el;
        qa(el, '[data-ovt-copy]').forEach(function (b) {
            if (b.dataset.ovtReady) return;
            b.dataset.ovtReady = '1';
            if (!canCopy) return;
            b.hidden = false;
            b.addEventListener('click', function () {
                var turn = b.closest('.ovt-turn');
                var ans = q(turn, '[data-ovt-answer]');
                if (ans) copyText(ans.innerText.trim(), b);
            });
        });
        if (canCopy) qa(el, '.ovt-answer pre').forEach(function (pre) {
            if (pre.querySelector('.ovt-code-copy')) return;
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'ovt-code-copy';
            b.textContent = 'Copy';
            b.addEventListener('click', function () { var code = pre.querySelector('code') || pre; copyText(code.innerText.replace(/\nCopy$/, ''), b); });
            pre.appendChild(b);
        });
        return el;
    }

    function threadEl() { return document.querySelector('[data-ovt] [data-ovt-thread]'); }
    function turnEl(id) { return document.querySelector('[data-ovt] [data-turn="' + String(id).replace(/"/g, '') + '"]'); }

    var api = {
        enhance: enhance,
        add: function (html) {
            var list = threadEl();
            var el = frag(html);
            if (!list || !el) return null;
            var stay = nearBottom();
            el.classList.add('is-new');
            list.appendChild(el);
            var empty = q(list.closest('[data-ovt]'), '.ovt-empty-state');
            if (empty) empty.hidden = true;
            enhance(el);
            if (stay) toBottom(true);
            return el;
        },
        replace: function (id, html) {
            var old = turnEl(id);
            var el = frag(html);
            if (!old || !el) return null;
            var stay = nearBottom();
            if (!el.hasAttribute('data-open') && old.hasAttribute('data-open')) el.classList.add('is-fresh');
            old.replaceWith(el);
            enhance(el);
            if (stay) toBottom(false);
            return el;
        },
        live: function (id, text) {
            var line = q(turnEl(id), '[data-ovt-live]');
            if (line) line.textContent = String(text) + '…';
        },
        work: function (id, html) {
            var list = q(turnEl(id), '[data-ovt-work]');
            var el = frag(html);
            if (!list || !el) return null;
            var stay = nearBottom();
            list.appendChild(el);
            if (stay) toBottom(false);
            return el;
        },
    };
    root.OVThread = api;

    function start() {
        qa(document, '[data-ovt]').forEach(function (box) {
            if (box.dataset.ovtReady) return;
            box.dataset.ovtReady = '1';
            var head = q(box, '[data-ovt-head]');

            // Under the navbar: the sticky head and the chats column follow its bottom edge.
            var nav = document.querySelector('.openvibe-navbar') || document.getElementById('navbar-mount');
            var topWas = -1, ticking = false;
            function measure() {
                ticking = false;
                var b = nav && nav.getBoundingClientRect ? Math.max(0, Math.round(nav.getBoundingClientRect().bottom || 0)) : 0;
                if (b !== topWas) { topWas = b; box.style.setProperty('--ovt-top', b + 'px'); }
                if (head) head.classList.toggle('is-stuck', root.scrollY > 8);
            }
            function onScroll() { if (!ticking) { ticking = true; (root.requestAnimationFrame || setTimeout)(measure); } }
            measure();
            root.addEventListener('scroll', onScroll, { passive: true });
            root.addEventListener('resize', onScroll);
            setTimeout(measure, 400);

            // The drawer on a phone.
            var opener = q(box, '[data-ovt-open]');
            var scrim = q(box, '.ovt-scrim');
            var closeBtn = q(box, '.ovt-side-close');
            function drawer(on) {
                box.classList.toggle('is-drawer', on);
                if (scrim) scrim.hidden = !on;
                if (closeBtn) closeBtn.hidden = !on;
                if (opener) opener.setAttribute('aria-expanded', on ? 'true' : 'false');
                if (on) { var f = q(box, '[data-ovt-find]'); if (f && fine) f.focus(); }
                else if (opener && document.activeElement && box.querySelector('.ovt-side').contains(document.activeElement)) opener.focus();
            }
            if (opener) opener.addEventListener('click', function () { drawer(true); });
            qa(box, '[data-ovt-close]').forEach(function (el) { el.addEventListener('click', function () { drawer(false); }); });
            document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('is-drawer')) drawer(false); });

            // Find a chat.
            var find = q(box, '[data-ovt-find]');
            if (find) find.addEventListener('input', function () {
                var term = find.value.trim().toLowerCase();
                qa(box, '.ovt-list li').forEach(function (li) { var a = li.querySelector('a'); li.hidden = !!term && (!a || (a.getAttribute('data-title') || '').indexOf(term) === -1); });
                qa(box, '.ovt-group').forEach(function (g) { var ul = g.nextElementSibling; g.hidden = !!ul && !ul.querySelector('li:not([hidden])'); });
            });

            // The composer.
            var form = q(box, '[data-ovt-composer]');
            var text = q(box, '[data-ovt-text]');
            var send = q(box, '[data-ovt-send]');
            function grow() { if (!text) return; text.style.height = 'auto'; text.style.height = Math.min(text.scrollHeight, root.innerHeight * 0.4) + 'px'; }
            function syncSend() { if (send && text) send.disabled = !text.value.trim(); }
            if (text) {
                text.addEventListener('input', function () { grow(); syncSend(); });
                text.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && fine && text.value.trim()) {
                        e.preventDefault();
                        if (form.requestSubmit) form.requestSubmit(send || undefined); else form.submit();
                    }
                });
                grow();
                syncSend();
            }
            qa(box, '[data-ovt-starter]').forEach(function (b) {
                b.addEventListener('click', function () { if (!text) return; text.value = b.getAttribute('data-ovt-starter'); grow(); syncSend(); text.focus(); });
            });

            enhance(box);
            if (!location.hash && q(box, '[data-ovt-thread] > li')) toBottom(false);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
    document.addEventListener('ov:boost:load', start);
})(typeof window !== 'undefined' ? window : globalThis);
