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
 *   OVThread.tool(id, { name, input, icon, key })   a running tool row in the turn's work list (built here, text only)
 *   OVThread.toolDone(id, ok, key)  that tool's row finished (the row with key, else the last running one); ok false: it
 *                                   failed, null: it ended with no result (no mark)
 * Booted on load and after an in-place page swap (openvibe-shared/boost's ov:boost:load).
 */
(function (root) {
    'use strict';
    if (root.OVThread) return;
    var fine = root.matchMedia && root.matchMedia('(hover: hover) and (pointer: fine)').matches;
    // Motion off (html[data-ov-motion=off], theme-loader.js) is the only setting that skips an effect; Calm plays it.
    var reduce = document.documentElement.getAttribute('data-ov-motion') === 'off';
    var canCopy = !!(root.navigator && navigator.clipboard && navigator.clipboard.writeText);
    const THREAD_REV = { 'ov-composer.js': '2d469fb0766f', 'ov-combo.js': '3e426e56fc75' };
    var selfSrc = (document.currentScript && document.currentScript.src) || '';
    // 4.202.0: the one dropdown for a field (ov-combo.js: a repository, a person), wherever a page asks for it.
    function loadCombo() {
        if (root.OVCombo) { root.OVCombo.scan(); return; }
        if (loadCombo.on || !document.querySelector('input[data-ov-combo]')) return;
        loadCombo.on = true;
        var m = /^(https?:\/\/[^?#]*\/)ov-thread(?:\.[0-9a-f]{6,})?\.js(?:[?#]|$)/.exec(selfSrc);
        var s = document.createElement('script');
        s.async = true;
        s.src = (m ? m[1] : 'https://openvibe.network/shared/') + 'ov-combo.js' + (THREAD_REV['ov-combo.js'] ? '?v=' + THREAD_REV['ov-combo.js'] : '');
        document.head.appendChild(s);
    }
    function loadComposer() {
        if (root.OpenVibeComposer) { root.OpenVibeComposer.scan(); return; }
        if (loadComposer.on) return;
        loadComposer.on = true;
        var m = /^(https?:\/\/[^?#]*\/)ov-thread(?:\.[0-9a-f]{6,})?\.js(?:[?#]|$)/.exec(selfSrc);
        var s = document.createElement('script');
        s.async = true;
        s.src = (m ? m[1] : 'https://openvibe.network/shared/') + 'ov-composer.js' + (THREAD_REV['ov-composer.js'] ? '?v=' + THREAD_REV['ov-composer.js'] : '');
        document.head.appendChild(s);
    }

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
            // An icon button shows a tick for a moment (its word is only for screen readers and the tooltip).
            var path = btn.querySelector('svg path'); var d = path && path.getAttribute('d');
            if (path) path.setAttribute('d', 'M5 12.5l4.5 4.5L19 7.5');
            btn.classList.add('is-done'); if (btn.title) btn.title = 'Copied';
            setTimeout(function () { label.textContent = was; if (path) path.setAttribute('d', d); btn.classList.remove('is-done'); if (btn.title) btn.title = was; }, 1400);
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

    // The icons a streamed tool row can carry (thread.js draws the same ones on the server).
    var ICONS = {
        tool: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
        read: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
        find: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
        edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
        run: 'M3 4h18v16H3zM7 9l3 3-3 3M13 15h4',
        web: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
        sub: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
        ok: 'M5 12l5 5 9-10',
        bad: 'M6 6l12 12M18 6L6 18',
    };
    function svgIcon(name) {
        var ns = 'http://www.w3.org/2000/svg';
        var s = document.createElementNS(ns, 'svg');
        s.setAttribute('class', 'ovt-ic'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
        var p = document.createElementNS(ns, 'path'); p.setAttribute('d', ICONS[name] || ICONS.tool);
        s.appendChild(p);
        return s;
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
        tool: function (id, t) {
            t = t || {};
            var li = document.createElement('li');
            li.className = 'ovt-w-tool is-run';
            if (t.key != null) li.setAttribute('data-key', String(t.key));
            var row = document.createElement('div');
            row.className = 'ovt-w-row';
            var b = document.createElement('b'); b.textContent = String(t.name || 'Tool');
            row.appendChild(svgIcon(t.icon)); row.appendChild(b);
            if (t.input) { var inp = document.createElement('span'); inp.className = 'ovt-w-in'; inp.textContent = String(t.input).slice(0, 200); row.appendChild(inp); }
            var st = document.createElement('span'); st.className = 'ovt-w-st';
            var dot = document.createElement('span'); dot.className = 'ovt-dot'; dot.setAttribute('aria-hidden', 'true');
            st.appendChild(dot); row.appendChild(st); li.appendChild(row);
            return api.work(id, li);
        },
        toolDone: function (id, ok, key) {
            var rows = qa(turnEl(id), '[data-ovt-work] > .ovt-w-tool.is-run');
            var li = key != null ? rows.filter(function (r) { return r.getAttribute('data-key') === String(key); })[0] : rows[rows.length - 1];
            if (!li) return null;
            li.classList.remove('is-run'); li.classList.add(ok === null ? 'is-done' : ok === false ? 'is-bad' : 'is-ok');
            var st = q(li, '.ovt-w-st');
            if (st) { st.textContent = ''; if (ok !== null) st.appendChild(svgIcon(ok === false ? 'bad' : 'ok')); }
            return li;
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
        loadCombo();
        qa(document, '[data-ovt]').forEach(function (box) {
            if (box.dataset.ovtReady) return;
            box.dataset.ovtReady = '1';
            var head = q(box, '[data-ovt-head]');

            // Under the navbar: the sticky head and the chats column follow its bottom edge. The bar is found on each
            // measure (navbar.js may draw it after this runs), and measured again once its slide ends: on a phone it
            // slides away while reading down (.32 s), and the head then moves up to the top instead of leaving a gap.
            var topWas = -1, ticking = false, trail = 0;
            function measure() {
                ticking = false;
                var nav = document.querySelector('.openvibe-navbar') || document.getElementById('navbar-mount');
                var b = nav && nav.getBoundingClientRect ? Math.max(0, Math.round(nav.getBoundingClientRect().bottom || 0)) : 0;
                if (b !== topWas) { topWas = b; box.style.setProperty('--ovt-top', b + 'px'); }
                if (head) head.classList.toggle('is-stuck', root.scrollY > 8);
            }
            function onScroll() {
                if (!ticking) { ticking = true; (root.requestAnimationFrame || setTimeout)(measure); }
                clearTimeout(trail); trail = setTimeout(measure, 380);
            }
            measure();
            root.addEventListener('scroll', onScroll, { passive: true });
            root.addEventListener('resize', onScroll);
            setTimeout(measure, 400);

            // The panel (thread.panel): a drawer from the right below 1180 px, opened from the head's button; its scrim, its
            // close button and Escape close it, and the focus goes in and comes back.
            var pan = q(box, '[data-ovt-panel]');
            var panOpen = q(box, '[data-ovt-panel-open]');
            var panScrim = q(box, '[data-ovt-panel-scrim]');
            function panel(on) {
                if (!pan) return;
                box.classList.toggle('is-panel', on);
                if (panScrim) panScrim.hidden = !on;
                if (panOpen) panOpen.setAttribute('aria-expanded', on ? 'true' : 'false');
                if (on) { var c = q(pan, '[data-ovt-panel-close]'); if (c) c.focus(); }
                else if (panOpen && document.activeElement && pan.contains(document.activeElement)) panOpen.focus();
            }
            if (pan) {
                if (panOpen) panOpen.addEventListener('click', function () { panel(!box.classList.contains('is-panel')); });
                qa(box, '[data-ovt-panel-close], [data-ovt-panel-scrim]').forEach(function (el) { el.addEventListener('click', function () { panel(false); }); });
                document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('is-panel')) panel(false); });
            }

            // Find a chat, in the network's sidebar (kit.sidebar): it filters as you type. Enter keeps you here when the
            // form is filter-only (thread.sidebar's default); otherwise it runs the site's own search (every message).
            var kfind = q(box, '.ovk-sidebar-find input');
            if (kfind) {
                var kform = kfind.closest('form');
                if (kform && kform.hasAttribute('data-ovt-filter-only')) kform.addEventListener('submit', function (e) { e.preventDefault(); });
                kfind.addEventListener('input', function () {
                    var term = kfind.value.trim().toLowerCase();
                    qa(box, '.ovk-sidebar-secs .ovk-sidebar-item').forEach(function (a) { var tt = q(a, '.ovk-sidebar-t'); a.hidden = !!term && (!tt || tt.textContent.toLowerCase().indexOf(term) === -1); });
                    qa(box, '.ovk-sidebar-secs .ovk-sidebar-sec').forEach(function (sec) { sec.hidden = !!term && !sec.querySelector('.ovk-sidebar-item:not([hidden])'); });
                });
            }

            // The composer.
            var form = q(box, '[data-ovt-composer]');
            if (form) loadComposer();
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

            // The examples: while the box is empty and not being typed in, its placeholder walks through them (a fade).
            if (text && text.getAttribute('data-ovt-examples') && !text.__ovtEx) {
                text.__ovtEx = true;
                var exI = 0;
                var exTimer = setInterval(function () {
                    if (!text.isConnected) { clearInterval(exTimer); return; }
                    var list; try { list = JSON.parse(text.getAttribute('data-ovt-examples') || '[]'); } catch (e) { list = []; }
                    if (!list.length || text.value || document.activeElement === text || document.hidden) return;
                    exI = (exI + 1) % list.length;
                    text.classList.add('is-ph-out');
                    setTimeout(function () { text.placeholder = list[exI]; text.classList.remove('is-ph-out'); }, 220);
                }, 3600);
            }

            // Options: one button, the pickers behind it (a <details>, so it opens without script too). A tap outside,
            // Escape or Done closes it; on a phone it is a sheet and the page behind stays put; a changed picker shows as
            // a chip beside the button, and its × puts the default back.
            qa(box, '[data-ovt-opts]').forEach(function (d) {
                if (d.__ovt) return; d.__ovt = true;
                var chips = d.parentNode ? q(d.parentNode, '[data-ovt-opts-chips]') : null;
                var dot = q(d, '.ovt-opts-dot');
                function phone() { return root.matchMedia && root.matchMedia('(max-width: 640px)').matches; }
                function lock(on) { document.documentElement.classList.toggle('ovt-sheet-open', !!on && phone()); }
                function close() { if (d.open) { d.open = false; } }
                d.addEventListener('toggle', function () {
                    lock(d.open);
                    // On a computer the panel grows out of its button (the navbar's shared motion); a phone's sheet rises.
                    if (d.open && !phone() && root.OpenVibeNavbar && root.OpenVibeNavbar.pop) { var pnl = q(d, '.ovt-opts-panel'); if (pnl) root.OpenVibeNavbar.pop(pnl, q(d, 'summary')); }
                    if (d.open) { var f = q(d, '.ovt-opts-body select, .ovt-opts-body input, .ovt-opts-body button'); if (f && !phone()) f.focus({ preventScroll: true }); }
                });
                document.addEventListener('pointerdown', function (e) { if (d.open && !d.contains(e.target)) close(); }, true);
                d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && d.open) { e.stopPropagation(); close(); var s = q(d, 'summary'); if (s) s.focus(); } });
                var x = q(d, '[data-ovt-opts-close]'); if (x) x.addEventListener('click', function (e) { e.preventDefault(); close(); });
                function label(el) {
                    if (el.tagName === 'SELECT') { var o = el.options[el.selectedIndex]; return o ? o.textContent.trim() : el.value; }
                    var l = el.closest('label'); return l ? l.textContent.trim() : el.value;
                }
                function paint() {
                    if (!chips) return;
                    chips.textContent = '';
                    var any = false;
                    qa(d, '[data-ovt-default]').forEach(function (el) {
                        if (el.closest('[hidden]') || (el.offsetParent === null && !d.open && getComputedStyle(el.closest('label, .ovt-opt') || el).display === 'none')) return;
                        var def = el.getAttribute('data-ovt-default');
                        var cur = el.tagName === 'SELECT' ? el : q(el, 'input:checked');
                        var val = cur ? cur.value : def;
                        if (val === def) return;
                        any = true;
                        var chip = document.createElement('span'); chip.className = 'ovt-opt-chip';
                        var t = document.createElement('span'); t.textContent = label(cur).slice(0, 40); chip.appendChild(t);
                        var b = document.createElement('button'); b.type = 'button'; b.className = 'ovt-opt-chip-x'; b.setAttribute('aria-label', 'Back to the default: ' + t.textContent); b.textContent = '×';
                        b.addEventListener('click', function () {
                            if (el.tagName === 'SELECT') el.value = def; else { var r = q(el, 'input[value="' + (root.CSS && CSS.escape ? CSS.escape(def) : def) + '"]'); if (r) r.checked = true; }
                            (el.tagName === 'SELECT' ? el : q(el, 'input:checked') || el).dispatchEvent(new Event('change', { bubbles: true }));
                        });
                        chip.appendChild(b);
                        chip.addEventListener('click', function (e) { if (e.target === b) return; d.open = true; });
                        chips.appendChild(chip);
                    });
                    if (dot) dot.hidden = !any;
                }
                d.addEventListener('change', paint);
                if (form) form.addEventListener('ovt:options', paint);
                paint();
            });

            // Attach's menu: a tap outside or a chosen file closes it.
            qa(box, '[data-ovt-attach]').forEach(function (d) {
                if (d.__ovt) return; d.__ovt = true;
                document.addEventListener('pointerdown', function (e) { if (d.open && !d.contains(e.target)) d.open = false; }, true);
                d.addEventListener('change', function () { d.open = false; });
                d.addEventListener('toggle', function () { if (d.open && root.OpenVibeNavbar && root.OpenVibeNavbar.pop) { var pp = q(d, '.ovt-attach-pop'); if (pp) root.OpenVibeNavbar.pop(pp, q(d, 'summary')); } });
                d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && d.open) { e.stopPropagation(); d.open = false; var s = q(d, 'summary'); if (s) s.focus(); } });
            });

            // A kit sidebar's button goes into the navbar, before the brand, on a phone (11-09, the owner: the button on a
            // row of its own under the bar wasted the space): the bar's lead slot opens the same drawer.
            var sbBtn = q(box, '.ovt-head [data-ovk-sidebar-open]');
            if (sbBtn) navLead(box, sbBtn, 0);

            enhance(box);
            if (!location.hash && q(box, '[data-ovt-thread] > li')) toBottom(false);
        });
    }

    // The navbar may draw after this script: try for a few seconds. The slot goes when a page without a thread loads.
    var leadOn = false;
    function navLead(box, btn, n) {
        var nav = root.OpenVibeNavbar;
        if (!nav || typeof nav.lead !== 'function' || !nav.getElement || !nav.getElement()) { if (n < 40) setTimeout(function () { navLead(box, btn, n + 1); }, 125); return; }
        nav.lead({ icon: 'sidebar', label: btn.getAttribute('aria-label') || 'Your conversations', sidebar: btn.getAttribute('aria-controls') || '', phoneOnly: true });
        leadOn = true;
        box.classList.add('has-nav-lead');
    }
    document.addEventListener('ov:boost:load', function () {
        if (leadOn && !document.querySelector('[data-ovt] .ovt-head [data-ovk-sidebar-open]') && root.OpenVibeNavbar && root.OpenVibeNavbar.lead) { root.OpenVibeNavbar.lead(null); leadOn = false; }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
    document.addEventListener('ov:boost:load', start);
})(typeof window !== 'undefined' ? window : globalThis);
