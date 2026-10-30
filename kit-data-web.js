/**
 * openvibe-shared/kit-data-web.js — Kit 2's behaviour in the page (split from kit-web.js in 4.37.0):
 *
 *   charts         .ovk-chart-plot[data-ovk-chart]: the values under the pointer, a tap, or ← → Home End
 *   scatter labels a label that would cover another, or cross the right edge, is hidden or moved
 *   drop zones     [data-ovk-drop]: drag and drop, paste, the camera on phones, the file's name and picture
 *   tool frame     [data-ovk-clear] shows while its box has text and empties it; a[data-ovk-try] fills the box and runs
 *                  the tool (its form's submit, else the [data-ovk-run] button); without this it is a ?name=value link
 *
 * It runs by itself when it loads, again on a boosted page swap (ov:boost:load), and for markup added later through
 * OpenVibeKitData.enhance(container). Idempotent and safe on a page that uses none of it. Load it on a page that draws
 * kit.chart, kit.drop or the tool frame (kit.steps, table, rank, meter and receipt need no script).
 */
(function (root) {
    'use strict';
    function enhance(rootEl) {
        if (typeof document === 'undefined') return;
        const scope = rootEl || document;
        const all = (sel) => Array.prototype.slice.call(scope.querySelectorAll ? scope.querySelectorAll(sel) : []);
        // The mark has a name of its own (…Wired), apart from the data-ovk-* attribute that asks for the behaviour (4.55.0).
        const once = (el, key) => { const k = `${key}Wired`; if (el.dataset[k]) return false; el.dataset[k] = '1'; return true; };
        // Charts (Kit 2): a rule, a dot per series and the values under the pointer or the arrow keys, on lines and areas.
        all('.ovk-chart-plot[data-ovk-chart]').forEach((plot) => {
            if (!once(plot, 'ovkChart')) return;
            let data; try { data = JSON.parse(plot.getAttribute('data-ovk-chart')); } catch (e) { return; }
            if (!data || !data.x || !data.x.length) return;
            const rule = plot.querySelector('.ovk-chart-rule'), tip = plot.querySelector('.ovk-chart-tip');
            if (!rule || !tip) return;
            let at = -1;
            const show = (i) => {
                at = Math.max(0, Math.min(data.x.length - 1, i));
                const [px, label] = data.x[at];
                rule.style.left = `${px}%`; rule.hidden = false;
                rule.innerHTML = data.s.map((s) => (s.v[at] ? `<i class="ovk-chart-s${s.c}" style="bottom:${s.v[at][0]}%"></i>` : '')).join('');
                tip.textContent = '';
                const b = document.createElement('b'); b.textContent = label; tip.appendChild(b);
                data.s.forEach((s) => { if (!s.v[at]) return; const line = document.createElement('span'); line.className = `ovk-chart-s${s.c}`; line.innerHTML = '<i></i>'; line.appendChild(document.createTextNode(`${s.n ? `${s.n} ` : ''}${s.v[at][1]}`)); tip.appendChild(line); });
                tip.hidden = false;
                const w = plot.clientWidth, tw = tip.offsetWidth, x = (px / 100) * w;
                tip.style.left = `${Math.max(0, Math.min(w - tw, x + 12 + tw > w ? x - tw - 12 : x + 12))}px`;
            };
            const hide = () => { rule.hidden = true; tip.hidden = true; };
            const nearest = (clientX) => {
                const r = plot.getBoundingClientRect(); const p = ((clientX - r.left) / r.width) * 100;
                let best = 0; for (let i = 1; i < data.x.length; i++) if (Math.abs(data.x[i][0] - p) < Math.abs(data.x[best][0] - p)) best = i;
                return best;
            };
            plot.addEventListener('pointermove', (e) => show(nearest(e.clientX)));
            plot.addEventListener('pointerdown', (e) => show(nearest(e.clientX)));
            plot.addEventListener('pointerleave', hide);
            plot.addEventListener('blur', hide);
            plot.addEventListener('focus', () => show(at < 0 ? data.x.length - 1 : at));
            plot.addEventListener('keydown', (e) => {
                const step = { ArrowLeft: -1, ArrowRight: 1, Home: -1e9, End: 1e9 }[e.key];
                if (step == null) { if (e.key === 'Escape') hide(); return; }
                e.preventDefault(); show((at < 0 ? data.x.length - 1 : at) + step);
            });
        });
        // Scatter labels (Kit 2): a label that would sit on one already shown is hidden (best points first); its dot still says it.
        all('.ovk-chart--scatter .ovk-chart-plot').forEach((plot) => {
            const names = Array.prototype.slice.call(plot.querySelectorAll('.ovk-chart-name'));
            if (names.length < 2) return;
            const place = () => {
                names.forEach((n) => { n.classList.remove('is-hidden'); n.parentNode.classList.remove('is-flip'); });
                // A label that would run past the plot's right edge goes to the left of its dot.
                const edge = plot.getBoundingClientRect().right + 4;
                names.forEach((n) => { if (!n.parentNode.classList.contains('is-right') && n.getBoundingClientRect().right > edge) n.parentNode.classList.add('is-flip'); });
                const order = names.slice().sort((a, b) => (b.parentNode.classList.contains('is-best') - a.parentNode.classList.contains('is-best')) || (parseFloat(b.parentNode.style.bottom) - parseFloat(a.parentNode.style.bottom)));
                const kept = [];
                order.forEach((n) => {
                    const r = n.getBoundingClientRect();
                    const hit = kept.some((k) => r.left < k.right + 4 && r.right + 4 > k.left && r.top < k.bottom + 2 && r.bottom + 2 > k.top);
                    if (hit) n.classList.add('is-hidden'); else kept.push(r);
                });
            };
            if (!once(plot, 'ovkLabels')) return;
            place();
            if (typeof ResizeObserver !== 'undefined') new ResizeObserver(place).observe(plot);
        });
        // Drop zones (Kit 2): drag and drop, paste, the camera on phones, the chosen file's name and picture.
        all('[data-ovk-drop]').forEach((box) => {
            if (!once(box, 'ovkDrop')) return;
            const input = box.querySelector('.ovk-drop-input'), zone = box.querySelector('.ovk-drop-zone'), name = box.querySelector('.ovk-drop-name');
            if (!input || !zone) return;
            box.classList.add('is-js');
            let url = null;
            const shown = () => {
                const files = Array.prototype.slice.call(input.files || []);
                box.classList.toggle('has-file', files.length > 0);
                if (!name) return;
                name.textContent = '';
                if (url) { URL.revokeObjectURL(url); url = null; }
                if (!files.length) return;
                if (files.length === 1 && /^image\//.test(files[0].type) && window.URL) {
                    const img = document.createElement('img'); url = URL.createObjectURL(files[0]); img.src = url; img.alt = ''; name.appendChild(img);
                }
                name.appendChild(document.createTextNode(files.length === 1 ? files[0].name : `${files.length} files`));
            };
            const take = (list) => {
                if (!list || !list.length || typeof DataTransfer === 'undefined') return;
                const dt = new DataTransfer();
                Array.prototype.slice.call(list, 0, input.multiple ? list.length : 1).forEach((f) => dt.items.add(f));
                input.files = dt.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            };
            input.addEventListener('change', () => {
                shown();
                if (box.hasAttribute('data-ovk-auto') && input.files && input.files.length && input.form) (input.form.requestSubmit ? input.form.requestSubmit() : input.form.submit());
            });
            ['dragenter', 'dragover'].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); box.classList.add('is-over'); }));
            ['dragleave', 'dragend'].forEach((t) => zone.addEventListener(t, () => box.classList.remove('is-over')));
            zone.addEventListener('drop', (e) => { e.preventDefault(); box.classList.remove('is-over'); take(e.dataTransfer && e.dataTransfer.files); });
            // Paste: only while this is the page's one drop zone, and never into a field someone is typing in.
            document.addEventListener('paste', (e) => {
                if (document.querySelectorAll('[data-ovk-drop]').length !== 1) return;
                const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
                const files = e.clipboardData && e.clipboardData.files; if (files && files.length) { e.preventDefault(); take(files); }
            });
            const cam = box.querySelector('.ovk-drop-cam'), camInput = box.querySelector('[data-ovk-drop-cam]');
            if (cam && camInput && window.matchMedia && matchMedia('(pointer: coarse)').matches) {
                cam.hidden = false;
                camInput.addEventListener('change', () => { take(camInput.files); camInput.value = ''; });
            }
        });
        // The tool frame: a clear button shows while its box has text; a "Try" example fills the box and runs the tool
        // (its form's submit, else the run button it names). Without this, the example is a link to ?name=value.
        all('[data-ovk-clear]').forEach((b) => {
            const f = document.querySelector(b.getAttribute('data-ovk-clear'));
            if (!f || !once(b, 'ovkClear')) return;
            const sync = () => { b.hidden = !f.value; };
            f.addEventListener('input', sync); sync();
            b.addEventListener('click', () => { f.value = ''; sync(); f.dispatchEvent(new Event('input', { bubbles: true })); f.focus(); });
        });
        all('a[data-ovk-try]').forEach((a) => {
            if (!once(a, 'ovkTry')) return;
            a.addEventListener('click', (e) => {
                const sel = a.getAttribute('data-ovk-for');
                const form = a.closest('form');
                const f = (sel && document.querySelector(sel)) || (form && form.elements.namedItem(a.getAttribute('data-ovk-name') || 'q'));
                if (!f || !('value' in f)) return;
                e.preventDefault();
                f.value = a.getAttribute('data-ovk-try');
                f.dispatchEvent(new Event('input', { bubbles: true }));
                const run = a.getAttribute('data-ovk-run');
                const btn = run && document.querySelector(run);
                if (btn) btn.click();
                else if (f.form) { if (f.form.requestSubmit) f.form.requestSubmit(); else f.form.submit(); }
            });
        });
    }

    const api = { enhance };
    root.OpenVibeKitData = api;
    if (typeof module === 'object' && module.exports) { module.exports = api; return; }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => enhance(document));
        else enhance(document);
        document.addEventListener('ov:boost:load', () => enhance(document));
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
