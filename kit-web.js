/**
 * openvibe-shared/kit-web.js — the OpenVibe Kit's behaviour in the page, on its own: what a server-rendered site needs
 * (kit.js's builders already made its markup on the server). About 5 KB; it runs by itself when it loads and again for
 * markup added later through OpenVibeKitWeb.enhance(container) (kit.js's OpenVibeKit.enhance() calls it too).
 *
 *   copy buttons   [data-ovk-copy="#id"] are shown where the clipboard works and copy the target's text
 *   menus          details.ovk-more: one open at a time; a click elsewhere or Escape closes them
 *   the head       html.ovk-scrolled once the page scrolls (the sticky head's shadow)
 *   the composer   textarea[data-ovk-enter]: Enter sends (Shift+Enter, or a phone's own Enter, is a new line); it grows
 *   confirms       form[data-ovk-confirm]: asked first (OpenVibeUI.confirm when the page has it)
 *   sliders        input[type=range][data-ovk-unit] say their value
 *   sheets         [data-ovk-sheet="#id"] opens dialog.ovk-sheet; the backdrop, Close and Escape close it
 *   tabs           a sideways-scrolling tab strip keeps the open tab in view
 *   rails          .ovk-rail: ‹ › scroll a page of cards on devices with a pointer, hidden at either end
 *   share          [data-ovk-share]: the network's Share sheet (ov-share.js, beside this file); without it, the system
 *                  share sheet, else the link copied (the menu item says "Link copied")
 *   sidebars       kit.sidebar on a phone: [data-ovk-sidebar-open] opens the drawer; the scrim, its close button, Escape
 *                  and a page move close it (document-level, so boost-swapped pages need no wiring)
 *   card previews  .ovk-card video[data-src]: a muted loop while the card is hovered or focused (pointers only, never
 *                  under reduced motion; the file loads only then)
 *
 * Idempotent and safe on a page that uses none of it. docs/kit.md describes the pieces.
 */
(function (root) {
    'use strict';
    // ov-share.js beside this file (its query, so a release's copy goes with this one's), for [data-ovk-share].
    const SHARE_SRC = (() => { try { const me = document.currentScript; return me && me.src ? me.src.replace(/kit-web\.js(\?[^#]*)?.*$/, 'ov-share.js$1') : ''; } catch (_) { return ''; } })();
    const CHECK = '<svg class="ovk-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

    /** Opens or closes a sidebar drawer: its scrim, its buttons' aria-expanded, and the focus into it. */
    function setSidebar(sb, on) {
        if (!sb) return;
        sb.classList.toggle('is-open', on);
        // The page behind a phone's drawer stays put (11-09, the owner: a swipe on the drawer "scrolls the actual page").
        document.documentElement.classList.toggle('ovk-drawer-open', !!on);
        const wrap = sb.closest('.ovk-with-sidebar') || document;
        const scrim = wrap.querySelector('[data-ovk-sidebar-scrim]');
        if (scrim) scrim.hidden = !on;
        Array.prototype.forEach.call(document.querySelectorAll('[data-ovk-sidebar-open]'), (b) => { if (!b.getAttribute('aria-controls') || b.getAttribute('aria-controls') === sb.id) b.setAttribute('aria-expanded', on ? 'true' : 'false'); });
        if (on) { const first = sb.querySelector('.ovk-sidebar-link.is-here, .ovk-sidebar-action, a, input'); if (first && first.focus) first.focus({ preventScroll: true }); }
    }

    function enhance(rootEl) {
        if (typeof document === 'undefined') return;
        const scope = rootEl || document;
        const all = (sel) => Array.prototype.slice.call(scope.querySelectorAll ? scope.querySelectorAll(sel) : []);
        if (scope.querySelector && scope.querySelector('dialog.ovk-sheet, details.ovk-more') && !root.OVSurfaces && !document.getElementById('ov-surfaces-loader')) {
            const sc = document.createElement('script'); sc.id = 'ov-surfaces-loader'; sc.src = SHARE_SRC ? SHARE_SRC.replace('ov-share.js', 'surfaces.js') : '/shared/surfaces.js'; sc.async = true; document.head.appendChild(sc);
        }
        // Marks an element as wired. The mark has its own name (…Wired): `data-ovk-copy="#id"` is dataset.ovkCopy, so a mark
        // under that same name was already set by the markup, and copy, sheets, confirms and titled shares never wired.
        const once = (el, key) => { const k = `${key}Wired`; if (el.dataset[k]) return false; el.dataset[k] = '1'; return true; };
        // Copy buttons: shown only where the clipboard works; the icon turns into a check for a moment.
        all('[data-ovk-copy]').forEach((b) => {
            if (!once(b, 'ovkCopy') || !navigator.clipboard) return;
            b.hidden = false;
            b.addEventListener('click', () => {
                const t = document.querySelector(b.getAttribute('data-ovk-copy'));
                if (!t) return;
                navigator.clipboard.writeText(t.value != null && t.tagName !== 'PRE' ? t.value : t.textContent).then(() => {
                    const was = b.innerHTML; b.innerHTML = CHECK; b.classList.add('is-done');
                    setTimeout(() => { b.innerHTML = was; b.classList.remove('is-done'); }, 1400);
                }, () => {});
            });
        });
        // Menus: one open at a time; a click elsewhere or Escape closes them.
        all('details.ovk-more').forEach((d) => {
            if (!once(d, 'ovkMore')) return;
            d.addEventListener('toggle', () => {
                if (d.open) all('details.ovk-more[open]').forEach((o) => { if (o !== d) o.open = false; });
                if (root.OVSurfaces) {
                    if (!d.__ovSurface) d.__ovSurface = root.OVSurfaces.popover({ el: d, trigger: d.querySelector('summary'), close: () => { d.open = false; } });
                    if (d.open) d.__ovSurface.open(); else d.__ovSurface.close();
                }
                // Inside a rail (a sideways scroller clips anything that hangs out of it) the menu is placed on the screen.
                const pop = d.querySelector('.ovk-pop');
                if (!pop || !d.closest('.ovk-rail-track')) return;
                pop.classList.toggle('is-fixed', d.open);
                if (!d.open) { pop.style.left = pop.style.top = ''; return; }
                const r = d.getBoundingClientRect();
                const w = pop.offsetWidth, h = pop.offsetHeight;
                pop.style.left = `${Math.max(8, Math.min(r.right - w, innerWidth - w - 8))}px`;
                pop.style.top = `${r.bottom + 4 + h > innerHeight - 8 ? Math.max(8, r.top - h - 4) : r.bottom + 4}px`;
                const shut = () => { d.open = false; };
                const track = d.closest('.ovk-rail-track');
                track.addEventListener('scroll', shut, { once: true, passive: true });
                window.addEventListener('scroll', shut, { once: true, passive: true });
            });
        });
        if (!document.documentElement.dataset.ovkDoc) {
            document.documentElement.dataset.ovkDoc = '1';
            document.addEventListener('pointerdown', (e) => {
                Array.prototype.forEach.call(document.querySelectorAll('details.ovk-more[open]'), (d) => { if (!d.contains(e.target)) d.open = false; });
            }, true);
            document.addEventListener('keydown', (e) => {
                if (e.key !== 'Escape') return;
                Array.prototype.forEach.call(document.querySelectorAll('details.ovk-more[open]'), (d) => { d.open = false; const s = d.querySelector('summary'); if (s) s.focus(); });
                Array.prototype.forEach.call(document.querySelectorAll('.ovk-sidebar.is-open'), (sb) => setSidebar(sb, false));
            });
            // The left sidebar on a phone (kit.sidebar): its button opens it; the scrim, its close button, Escape and a page
            // move close it. Handled on the document, so a page boost swapped in works without being wired again.
            document.addEventListener('click', (e) => {
                const t = e.target && e.target.closest ? e.target : null;
                if (!t) return;
                const open = t.closest('[data-ovk-sidebar-open]');
                if (open) { setSidebar(document.getElementById(open.getAttribute('aria-controls') || '') || document.querySelector('[data-ovk-sidebar]'), true); return; }
                if (t.closest('[data-ovk-sidebar-close], [data-ovk-sidebar-scrim]')) Array.prototype.forEach.call(document.querySelectorAll('.ovk-sidebar.is-open'), (sb) => setSidebar(sb, false));
            });
            document.addEventListener('ov:boost:before', () => Array.prototype.forEach.call(document.querySelectorAll('.ovk-sidebar.is-open'), (sb) => setSidebar(sb, false)));
            // The head casts a shadow once the page has scrolled under it.
            let ticking = false;
            const mark = () => { ticking = false; document.documentElement.classList.toggle('ovk-scrolled', (window.scrollY || 0) > 4); };
            window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(mark); } }, { passive: true });
            mark();
        }
        // The composer: Enter sends (Shift+Enter, or a phone's own Enter key, is a new line); the box grows with the text.
        const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
        all('textarea[data-ovk-enter]').forEach((ta) => {
            if (!once(ta, 'ovkEnter')) return;
            const grow = () => { if (CSS && CSS.supports && CSS.supports('field-sizing', 'content')) return; ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, Math.round(innerHeight * 0.4))}px`; };
            ta.addEventListener('input', grow);
            ta.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' || e.shiftKey || e.isComposing || coarse) return;
                e.preventDefault();
                const f = ta.form; if (f) { if (f.requestSubmit) f.requestSubmit(); else f.submit(); }
            });
        });
        // A form that asks first (delete, leave): the network's confirm dialog when the page has it.
        all('form[data-ovk-confirm]').forEach((f) => {
            if (!once(f, 'ovkConfirm')) return;
            f.addEventListener('submit', (e) => {
                if (f.dataset.ovkConfirmed) { delete f.dataset.ovkConfirmed; return; }
                e.preventDefault();
                const msg = f.getAttribute('data-ovk-confirm');
                const ask = window.OpenVibeUI && window.OpenVibeUI.confirm ? window.OpenVibeUI.confirm({ title: msg, danger: true }) : Promise.resolve(window.confirm(msg));
                ask.then((ok) => { if (ok) { f.dataset.ovkConfirmed = '1'; if (f.requestSubmit) f.requestSubmit(e.submitter || undefined); else f.submit(); } });
            });
        });
        // Sliders say their value.
        all('input[type=range][data-ovk-unit]').forEach((r) => {
            if (!once(r, 'ovkRange')) return;
            const u = r.getAttribute('data-ovk-unit');
            r.addEventListener('input', () => r.setAttribute('aria-valuetext', `${r.value}${u === '%' ? ' percent' : ` ${u}`}`));
        });
        // Sheets: a button opens its dialog; the backdrop, Close and Escape close it.
        all('[data-ovk-sheet]').forEach((b) => {
            if (!once(b, 'ovkSheet')) return;
            b.addEventListener('click', () => {
                const d = document.querySelector(b.getAttribute('data-ovk-sheet'));
                if (d && d.showModal && !d.open) d.showModal();
            });
        });
        all('dialog.ovk-sheet').forEach((d) => {
            if (!once(d, 'ovkDialog')) return;
            d.addEventListener('click', (e) => { if (e.target === d || (e.target.closest && e.target.closest('[data-ovk-close]'))) d.close(); });
        });
        // Tabs that scroll sideways keep the open one in view.
        // Only the strip moves, sideways: scrollIntoView would also scroll the page to a strip below the fold.
        all('.ovk-tabs [aria-current="page"]').forEach((a) => {
            if (!once(a, 'ovkTab')) return;
            const strip = a.closest('.ovk-tabs');
            if (!strip || strip.scrollWidth <= strip.clientWidth) return;
            const ar = a.getBoundingClientRect(), sr = strip.getBoundingClientRect();
            strip.scrollLeft += (ar.left + ar.width / 2) - (sr.left + sr.width / 2);
        });
        // Rails: ‹ › move a page of cards where there is a pointer to click them; each hides at its end.
        const fine = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
        const still = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.getAttribute('data-ov-motion') === 'reduced';
        all('.ovk-rail').forEach((r) => {
            if (!once(r, 'ovkRail')) return;
            const track = r.querySelector('.ovk-rail-track');
            const prev = r.querySelector('.ovk-rail-prev');
            const next = r.querySelector('.ovk-rail-next');
            if (!track || !prev || !next || !fine) return;
            const update = () => {
                const max = track.scrollWidth - track.clientWidth;
                prev.hidden = track.scrollLeft <= 4;
                next.hidden = track.scrollLeft >= max - 4;
            };
            const go = (dir) => track.scrollBy({ left: dir * Math.max(track.clientWidth * 0.85, 200), behavior: still() ? 'auto' : 'smooth' });
            prev.addEventListener('click', () => go(-1));
            next.addEventListener('click', () => go(1));
            track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
            if (typeof ResizeObserver === 'function') new ResizeObserver(update).observe(track); else window.addEventListener('resize', update);
            update();
        });
        // Every sideways strip says it scrolls (11-09, the owner: "it's not very apparent you can horizontal scroll… a little
        // bounce… or auto scroll until you tap"): a kit rail's track, or any element marked data-ovk-scroll. Its edges fade
        // where more is hidden (is-more-start / is-more-end); on a touch screen it nudges once when it first comes into view;
        // data-ovk-scroll="drift" drifts slowly while in view (back and forth) and stops for good at the first touch,
        // wheel or keyboard focus. Reduced motion: fades only.
        all('.ovk-rail-track, [data-ovk-scroll]').forEach((track) => {
            if (!once(track, 'ovkScroll')) return;
            // A thin position bar under the strip (a thumb as wide as the share in view), shown while there is more.
            let bar = null, thumb = null;
            if (track.getAttribute('data-ovk-scroll-bar') !== 'off') {
                bar = document.createElement('span'); bar.className = 'ovk-scroll-bar'; bar.setAttribute('aria-hidden', 'true'); bar.hidden = true;
                thumb = document.createElement('i'); bar.appendChild(thumb);
                track.insertAdjacentElement('afterend', bar);
            }
            const edges = () => {
                const max = track.scrollWidth - track.clientWidth;
                track.classList.toggle('is-more-start', max > 4 && track.scrollLeft > 4);
                track.classList.toggle('is-more-end', max > 4 && track.scrollLeft < max - 4);
                if (bar) {
                    bar.hidden = max <= 4;
                    if (max > 4) { const share = track.clientWidth / track.scrollWidth; thumb.style.width = `${Math.max(14, share * 100)}%`; thumb.style.transform = `translateX(${(track.scrollLeft / max) * ((1 / Math.max(share, 0.14)) - 1) * 100}%)`; }
                }
            };
            track.addEventListener('scroll', () => requestAnimationFrame(edges), { passive: true });
            if (typeof ResizeObserver === 'function') new ResizeObserver(edges).observe(track);
            edges();
            if (still() || typeof IntersectionObserver !== 'function') return;
            const drift = track.getAttribute('data-ovk-scroll') === 'drift';
            let touched = false, inView = false, raf = 0, dir = 1, last = 0, pos = -1;
            const stop = () => { touched = true; cancelAnimationFrame(raf); raf = 0; };
            ['pointerdown', 'wheel', 'focusin', 'touchstart'].forEach((ev) => track.addEventListener(ev, stop, { passive: true, once: true }));
            const step = (t) => {
                raf = 0;
                if (touched || !inView || document.hidden) return;
                const dt = last ? Math.min(64, t - last) : 16; last = t;
                const max = track.scrollWidth - track.clientWidth;
                if (max <= 4) return;
                // A float of its own: a browser rounds scrollLeft, and under a pixel a frame would never move.
                if (pos < 0 || Math.abs(pos - track.scrollLeft) > 2) pos = track.scrollLeft;
                pos = Math.max(0, Math.min(max, pos + dir * dt * 0.028));
                track.scrollLeft = pos;
                if (pos >= max - 1) dir = -1; else if (pos <= 0) dir = 1;
                raf = requestAnimationFrame(step);
            };
            let nudged = false;
            new IntersectionObserver((entries) => {
                for (const e of entries) {
                    inView = e.isIntersecting && e.intersectionRatio >= 0.6;
                    if (!inView || touched) continue;
                    const max = track.scrollWidth - track.clientWidth;
                    if (max <= 4) continue;
                    if (drift) { last = 0; if (!raf) raf = requestAnimationFrame(step); continue; }
                    // One nudge, phones only (a computer has the ‹ › buttons): 48 px along and back.
                    if (!nudged && !fine && track.scrollLeft < 4) {
                        nudged = true;
                        setTimeout(() => { if (touched) return; track.scrollBy({ left: 48, behavior: 'smooth' }); setTimeout(() => { if (!touched) track.scrollBy({ left: -48, behavior: 'smooth' }); }, 420); }, 350);
                    }
                }
            }, { threshold: [0, 0.6] }).observe(track);
        });
        // Share: the system sheet where there is one, else the link copied, said in the item itself.
        all('[data-ovk-share]').forEach((a) => {
            if (!once(a, 'ovkShare')) return;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const link = new URL(a.getAttribute('href'), location.href).href;
                const title = a.getAttribute('data-ovk-share') || document.title;
                const done = () => { const d = a.closest('details'); if (d) d.open = false; };
                // The network's one Share sheet (ov-share.js, 4.114.0) when it can load; the device's own sheet, or the
                // link copied, when it cannot.
                const sheet = () => { done(); root.OVShare.open(Object.assign(root.OVShare.fromButton(a), { url: link, title })); };
                if (root.OVShare) { sheet(); return; }
                if (SHARE_SRC && !a.dataset.ovkShareTried) {
                    a.dataset.ovkShareTried = '1';
                    if (!document.querySelector('link[href*="ov-share.css"]')) { const ln = document.createElement('link'); ln.rel = 'stylesheet'; ln.href = SHARE_SRC.replace('ov-share.js', 'ov-share.css'); document.head.appendChild(ln); }
                    const sc = document.createElement('script'); sc.src = SHARE_SRC; sc.async = true;
                    sc.onload = () => { if (root.OVShare) sheet(); else a.click(); };
                    sc.onerror = () => a.click();
                    document.head.appendChild(sc);
                    return;
                }
                if (navigator.share) { navigator.share({ title, url: link }).then(done, () => {}); return; }
                if (!navigator.clipboard) { location.href = link; return; }
                navigator.clipboard.writeText(link).then(() => {
                    const span = a.querySelector('span');
                    const was = span ? span.textContent : '';
                    if (span) span.textContent = 'Link copied';
                    setTimeout(() => { if (span) span.textContent = was; done(); }, 1200);
                }, () => {});
            });
        });
        // Card previews: a muted loop while hovered or focused, on computers only, never under reduced motion.
        if (fine) all('.ovk-card').forEach((c) => {
            const v = c.querySelector('video.ovk-card-video[data-src]');
            if (!v || !once(c, 'ovkPeek')) return;
            const on = () => { if (still()) return; if (!v.src) v.src = v.getAttribute('data-src'); c.classList.add('is-playing'); const p = v.play(); if (p && p.catch) p.catch(() => {}); };
            const off = () => { c.classList.remove('is-playing'); try { v.pause(); } catch (e) { /* not started */ } };
            c.addEventListener('mouseenter', on); c.addEventListener('mouseleave', off);
            c.addEventListener('focusin', on); c.addEventListener('focusout', off);
        });
    }


    const api = { enhance };
    root.OpenVibeKitWeb = api;
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => enhance(document));
        else enhance(document);
        // A boosted page swap (boost.js) brings new markup without a load: enhance it too (enhance is idempotent).
        document.addEventListener('ov:boost:load', () => enhance(document));
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
