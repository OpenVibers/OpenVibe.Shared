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
 *   OVThread.reveal(answerEl)     type an answer in, word by word (replace does it when a working turn finishes)
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

    /**
     * What a reader means by an answer's text: without the Copy buttons and anything marked data-ovt-nocopy (a citation's
     * number: "visits 12" was "visits 1 2"); the space before a removed mark goes when punctuation follows it. innerText
     * keeps line breaks only for laid-out nodes, so the copy is read while it sits, invisible, in the page (Actor's, 11-01).
     */
    function plainText(el) {
        var c = el.cloneNode(true);
        qa(c, '[data-ovt-nocopy], .ovt-code-copy').forEach(function (x) {
            var before = x.previousSibling, after = x.nextSibling;
            if (before && before.nodeType === 3 && (!after || (after.nodeType === 3 && /^[\s,.;:!?)]/.test(after.nodeValue)))) before.nodeValue = before.nodeValue.replace(/\s+$/, '');
            x.remove();
        });
        if (c.style) c.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + (el.clientWidth || 600) + 'px;opacity:0;pointer-events:none';
        c.setAttribute('aria-hidden', 'true');
        document.body.appendChild(c);
        var t = String(c.innerText || c.textContent || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        c.remove();
        return t;
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
                if (!ans) return;
                // What a reader means to copy: not the Copy buttons, nor anything the site marked data-ovt-nocopy (a citation's number).
                copyText(plainText(ans), b);
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

    /**
     * The answer types in (the owner, 2026-11-01: "text streams in, with nice effects"). An answer that arrives whole
     * is revealed word by word, fast (about 45 frames, whatever its length); code, tables, pictures and anything marked
     * data-ovt-whole come in whole as the words reach them. Only opacity changes, so a screen reader reads it all at once,
     * and reduced motion shows it at once.
     */
    function reveal(ans) {
        if (!ans || reduce || !document.createTreeWalker) return;
        var WHOLE = 'pre, table, img, figure, [data-ovt-whole]';
        var words = [];
        var walker = document.createTreeWalker(ans, 4, { acceptNode: function (n) { return n.parentNode.closest(WHOLE) ? 2 : (/\S/.test(n.nodeValue) ? 1 : 2); } });
        var nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(function (n) {
            var f = document.createDocumentFragment();
            n.nodeValue.split(/(\s+)/).forEach(function (part) {
                if (!part) return;
                if (/^\s+$/.test(part)) { f.appendChild(document.createTextNode(part)); return; }
                var w = document.createElement('span'); w.className = 'ovt-sw'; w.textContent = part; f.appendChild(w); words.push(w);
            });
            n.parentNode.replaceChild(f, n);
        });
        var blocks = qa(ans, WHOLE).filter(function (b) { return !b.parentNode.closest(WHOLE); });
        blocks.forEach(function (b) { b.classList.add('ovt-sw'); });
        var all = words.concat(blocks);
        if (!all.length) return;
        ans.classList.add('is-revealing');
        var per = Math.max(2, Math.ceil(words.length / 45)), i = 0;
        var raf = root.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
        (function step() {
            for (var k = 0; k < per && i < words.length; k++, i++) words[i].classList.add('on');
            var last = words[Math.max(0, i - 1)];
            blocks.forEach(function (b) { if (!b.classList.contains('on') && last && (b.compareDocumentPosition(last) & 4)) b.classList.add('on'); });
            if (i < words.length) raf(step);
            else { all.forEach(function (w) { w.classList.add('on'); }); setTimeout(function () { ans.classList.remove('is-revealing'); }, 300); }
        })();
    }

    function threadEl() { return document.querySelector('[data-ovt] [data-ovt-thread]'); }
    function turnEl(id) { return document.querySelector('[data-ovt] [data-turn="' + String(id).replace(/"/g, '') + '"]'); }

    var api = {
        enhance: enhance,
        reveal: reveal,
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
            var finished = !el.hasAttribute('data-open') && old.hasAttribute('data-open');
            old.replaceWith(el);
            enhance(el);
            // A turn that just finished: its answer types in (or, where motion is reduced or words cannot be split, fades).
            if (finished) { var ans = q(el, '[data-ovt-answer]'); if (ans && !reduce && document.createTreeWalker) reveal(ans); else el.classList.add('is-fresh'); }
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
