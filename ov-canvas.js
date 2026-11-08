/**
 * openvibe-shared/ov-canvas.js — an agent's live panel (actor.canvas@1, ADR-059, plan HO9), drawn the same on every
 * site that shows it: Chat, Surf, the Dock and Actor.
 *
 *   OVCanvas.render(host, doc, { onAsk(label, block), onCheck(blockId, itemId, done) }) → the version drawn
 *   OVCanvas.valid(doc)   → true when doc is an actor.canvas@1 document this renderer can draw
 *
 * A canvas is DATA. Every block is built node by node (never innerHTML), text is plain, a picture is drawn only from
 * openvibe.media and a link only when it is https — the contract says so, and this file checks it again, because what
 * it draws was written by a model. A button never acts: it calls onAsk with its label, and the page sends that to the
 * agent as the person's own message. A checklist tick calls onCheck. A page without the callback gets a canvas that
 * only shows. An older version than the one on screen is ignored, so a late update never rolls the panel back.
 * Charts are inline SVG with their numbers in a table for screen readers; a table scrolls inside its own box, so the
 * page never scrolls sideways.
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OVCanvas) return;

    const MEDIA = /^https:\/\/openvibe\.media\/[A-Za-z0-9._~/%-]{1,1024}(\?[A-Za-z0-9._~=&%-]{0,200})?$/;
    const HTTPS = /^https:\/\/[^\s"'<>]{1,2048}$/;
    const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;
    const MAX_BLOCKS = 60;
    const CSS = `
.ovc { --ovc-bg: var(--bg-secondary, #111a2c); --ovc-panel: var(--bg-tertiary, #16213a); --ovc-text: var(--text-primary, #e6edf7);
  --ovc-muted: var(--text-secondary, #9fb0c8); --ovc-line: var(--border-color, rgba(255, 255, 255, .12)); --ovc-accent: var(--accent, #60a5fa);
  --ovc-on-accent: var(--on-accent-strong, var(--on-accent, #0a0f1c)); --ovc-c1: var(--ovc-accent); --ovc-c2: #22d3ee; --ovc-c3: #f59e0b; --ovc-c4: #a78bfa;
  display: grid; gap: 12px; min-width: 0; padding: 14px; border-radius: 14px; background: var(--ovc-bg); border: 1px solid var(--ovc-line);
  color: var(--ovc-text); font-size: 14px; line-height: 1.45; overflow-wrap: anywhere; }
:root[data-theme-mode="light"] .ovc { --ovc-c2: #0e7490; --ovc-c3: #b45309; --ovc-c4: #6d28d9; }
.ovc-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.ovc-title { font-size: 15px; font-weight: 800; letter-spacing: -.01em; min-width: 0; }
.ovc-when { flex: none; font-size: 12px; color: var(--ovc-muted); }
.ovc h3, .ovc h4 { margin: 4px 0 0; line-height: 1.25; text-wrap: balance; }
.ovc h3 { font-size: 17px; font-weight: 800; } .ovc h4 { font-size: 13px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--ovc-muted); }
.ovc-text { margin: 0; white-space: pre-wrap; }
.ovc-list { margin: 0; padding-left: 20px; display: grid; gap: 4px; }
.ovc-check { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.ovc-check label { display: flex; align-items: flex-start; gap: 10px; min-height: 40px; padding: 8px 10px; border-radius: 10px; cursor: pointer; }
.ovc-check label:hover { background: var(--ovc-panel); }
.ovc-check input { flex: none; width: 18px; height: 18px; margin: 1px 0 0; accent-color: var(--ovc-accent); }
.ovc-check input:checked + span { color: var(--ovc-muted); text-decoration: line-through; }
.ovc-check input:disabled { cursor: default; }
.ovc-table { max-width: 100%; overflow-x: auto; border-radius: 10px; border: 1px solid var(--ovc-line); }
.ovc-table table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.ovc-table th, .ovc-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--ovc-line); white-space: nowrap; }
.ovc-table th { font-size: 12px; font-weight: 800; color: var(--ovc-muted); background: var(--ovc-panel); }
.ovc-table tr:last-child td { border-bottom: 0; }
.ovc-table .is-num { text-align: right; font-variant-numeric: tabular-nums; }
.ovc-metric { display: grid; gap: 2px; padding: 12px 14px; border-radius: 12px; background: var(--ovc-panel); }
.ovc-metric-l { font-size: 12px; font-weight: 700; color: var(--ovc-muted); }
.ovc-metric-v { font-size: 26px; font-weight: 850; letter-spacing: -.02em; line-height: 1.1; font-variant-numeric: tabular-nums; }
.ovc-metric-n { font-size: 12.5px; color: var(--ovc-muted); }
.ovc-chart { margin: 0; display: grid; gap: 6px; }
.ovc-chart svg { width: 100%; max-width: 100%; height: auto; display: block; }
.ovc-chart .ax { stroke: var(--ovc-line); stroke-width: 1; }
.ovc-chart text { fill: var(--ovc-muted); font-size: 10px; font-family: inherit; }
.ovc-chart figcaption { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--ovc-muted); }
.ovc-chart figcaption i { display: inline-block; width: 10px; height: 10px; margin-right: 5px; border-radius: 3px; vertical-align: -1px; }
.ovc-s1 { --c: var(--ovc-c1); } .ovc-s2 { --c: var(--ovc-c2); } .ovc-s3 { --c: var(--ovc-c3); } .ovc-s4 { --c: var(--ovc-c4); }
.ovc-chart rect.v { fill: var(--c); } .ovc-chart polyline.v { fill: none; stroke: var(--c); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.ovc-chart circle.v { fill: var(--c); } .ovc-chart figcaption i { background: var(--c); }
.ovc-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.ovc-img { display: block; width: 100%; max-width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--ovc-line); background: var(--ovc-panel); }
.ovc-link { display: grid; gap: 2px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--ovc-line); color: var(--ovc-text); text-decoration: none; }
.ovc-link:hover, .ovc-link:focus-visible { border-color: var(--ovc-accent); }
.ovc-link b { font-weight: 700; color: var(--ovc-accent); } .ovc-link span { font-size: 12px; color: var(--ovc-muted); }
.ovc-btn { justify-self: start; min-height: 40px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--ovc-accent); color: var(--ovc-on-accent);
  font: inherit; font-weight: 750; cursor: pointer; }
.ovc-btn:disabled { opacity: .55; cursor: default; }
.ovc-btn:focus-visible, .ovc-check input:focus-visible, .ovc-table:focus-visible { outline: 2px solid var(--ovc-accent); outline-offset: 2px; }
`;
    function styles(doc) {
        if (doc.getElementById('ov-canvas-css')) return;
        const st = doc.createElement('style');
        st.id = 'ov-canvas-css';
        st.textContent = CSS;
        (doc.head || doc.documentElement).appendChild(st);
    }

    const str = (v, n) => String(v == null ? '' : v).slice(0, n);
    function make(doc, tag, cls, text) {
        const n = doc.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }
    function ago(iso) {
        const t = Date.parse(iso || '');
        if (!Number.isFinite(t)) return '';
        const m = Math.round((Date.now() - t) / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m} min ago`;
        if (m < 1440) return `${Math.floor(m / 60)} h ago`;
        return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString() : str(v, 200));

    function valid(doc) {
        return !!(doc && typeof doc === 'object' && doc.canvas === 'actor.canvas@1' && Array.isArray(doc.blocks)
            && Number.isInteger(doc.version) && doc.version >= 1);
    }

    /** A small chart: bars grouped by x, or one line per series. Nothing is fetched; the numbers are also a table. */
    function chart(doc, b) {
        const series = (Array.isArray(b.series) ? b.series : []).slice(0, 4)
            .map((s) => ({ name: str(s && s.name, 40), points: (Array.isArray(s && s.points) ? s.points : []).slice(0, 60).filter((p) => p && Number.isFinite(Number(p.y))) }))
            .filter((s) => s.points.length);
        if (!series.length) return null;
        const xs = [];
        series.forEach((s) => s.points.forEach((p) => { const x = str(p.x, 20); if (!xs.includes(x)) xs.push(x); }));
        const ys = series.flatMap((s) => s.points.map((p) => Number(p.y)));
        // Bars stand on zero; a line spans its own range (a price moving from 240 to 199 must not look flat).
        let lo = b.kind === 'line' ? Math.min(...ys) : Math.min(0, ...ys);
        let hi = b.kind === 'line' ? Math.max(...ys) : (Math.max(0, ...ys) || 1);
        if (b.kind === 'line') { const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.1 || 1; lo -= pad; hi += pad; }
        const W = 320, H = 150, L = 34, R = 8, T = 8, B = 22;
        const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
        const step = (W - L - R) / xs.length;
        const NS = 'http://www.w3.org/2000/svg';
        const svg = doc.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', `${b.kind === 'line' ? 'Line' : 'Bar'} chart of ${series.map((s) => s.name).join(', ')}`);
        const add = (tag, attrs, text) => { const e = doc.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, String(v))); if (text != null) e.textContent = text; svg.appendChild(e); return e; };
        const base = b.kind === 'line' ? lo : 0;
        add('line', { class: 'ax', x1: L, x2: W - R, y1: y(base), y2: y(base) });
        const unit = str(b.unit, 12);
        const top = Math.max(...ys), bottom = Math.min(...ys);
        add('text', { x: L - 4, y: y(top) + 4, 'text-anchor': 'end' }, `${top.toLocaleString()}${unit}`);
        if (b.kind === 'line' ? bottom !== top : bottom < 0) add('text', { x: L - 4, y: y(bottom) + 4, 'text-anchor': 'end' }, `${bottom.toLocaleString()}${unit}`);
        const every = Math.max(1, Math.ceil(xs.length / 8));
        xs.forEach((x, i) => { if (i % every === 0) add('text', { x: L + step * (i + .5), y: H - 6, 'text-anchor': 'middle' }, x.slice(0, 8)); });
        series.forEach((s, k) => {
            const cls = `v ovc-s${k + 1}`;
            if (b.kind === 'line') {
                const pts = s.points.map((p) => `${(L + step * (xs.indexOf(str(p.x, 20)) + .5)).toFixed(1)},${y(Number(p.y)).toFixed(1)}`);
                add('polyline', { class: cls, points: pts.join(' ') });
                if (s.points.length === 1) add('circle', { class: cls, cx: pts[0].split(',')[0], cy: pts[0].split(',')[1], r: 3.5 });
            } else {
                const bw = Math.max(2, (step * .7) / series.length);
                s.points.forEach((p) => {
                    const i = xs.indexOf(str(p.x, 20)), v = Number(p.y);
                    const top = Math.min(y(v), y(0)), h = Math.max(1, Math.abs(y(v) - y(0)));
                    add('rect', { class: cls, x: (L + step * i + step * .15 + bw * k).toFixed(1), y: top.toFixed(1), width: bw.toFixed(1), height: h.toFixed(1), rx: 2 });
                });
            }
        });
        const fig = make(doc, 'figure', 'ovc-chart');
        fig.appendChild(svg);
        const cap = make(doc, 'figcaption');
        series.forEach((s, k) => { const it = make(doc, 'span', `ovc-s${k + 1}`); it.appendChild(make(doc, 'i')); it.appendChild(doc.createTextNode(s.name)); cap.appendChild(it); });
        fig.appendChild(cap);
        // The numbers, for a screen reader (the picture says the same thing).
        const t = make(doc, 'table', 'ovc-sr');
        const hr = make(doc, 'tr'); hr.appendChild(make(doc, 'th', null, '')); series.forEach((s) => hr.appendChild(make(doc, 'th', null, s.name)));
        t.appendChild(hr);
        xs.forEach((x) => {
            const r = make(doc, 'tr'); r.appendChild(make(doc, 'th', null, x));
            series.forEach((s) => { const p = s.points.find((q) => str(q.x, 20) === x); r.appendChild(make(doc, 'td', null, p ? `${Number(p.y).toLocaleString()}${unit}` : '')); });
            t.appendChild(r);
        });
        fig.appendChild(t);
        return fig;
    }

    function block(doc, b, opts) {
        if (!b || typeof b !== 'object') return null;
        switch (b.type) {
        case 'heading': return make(doc, b.level === 2 ? 'h4' : 'h3', null, str(b.text, 120));
        case 'text': return make(doc, 'p', 'ovc-text', str(b.text, 4000));
        case 'list': {
            const l = make(doc, b.ordered ? 'ol' : 'ul', 'ovc-list');
            (Array.isArray(b.items) ? b.items : []).slice(0, 50).forEach((x) => l.appendChild(make(doc, 'li', null, str(x, 280))));
            return l;
        }
        case 'checklist': {
            const l = make(doc, 'ul', 'ovc-check');
            (Array.isArray(b.items) ? b.items : []).slice(0, 50).forEach((it) => {
                if (!it || !ID.test(String(it.id || ''))) return;
                const li = make(doc, 'li'), lab = make(doc, 'label'), box = make(doc, 'input');
                box.type = 'checkbox'; box.checked = !!it.done;
                if (typeof opts.onCheck === 'function' && ID.test(String(b.id || ''))) box.addEventListener('change', () => opts.onCheck(String(b.id), String(it.id), box.checked));
                else box.disabled = true;
                lab.appendChild(box); lab.appendChild(make(doc, 'span', null, str(it.text, 280)));
                li.appendChild(lab); l.appendChild(li);
            });
            return l;
        }
        case 'table': {
            const cols = (Array.isArray(b.columns) ? b.columns : []).slice(0, 8).map((c) => str(c, 40));
            if (!cols.length) return null;
            const wrap = make(doc, 'div', 'ovc-table');
            wrap.tabIndex = 0;
            wrap.setAttribute('role', 'region');
            wrap.setAttribute('aria-label', cols.join(', '));
            const t = make(doc, 'table'), head = make(doc, 'thead'), hr = make(doc, 'tr');
            cols.forEach((c) => hr.appendChild(make(doc, 'th', null, c)));
            head.appendChild(hr); t.appendChild(head);
            const body = make(doc, 'tbody');
            (Array.isArray(b.rows) ? b.rows : []).slice(0, 100).forEach((row) => {
                const r = make(doc, 'tr');
                cols.forEach((_, i) => { const v = Array.isArray(row) ? row[i] : ''; r.appendChild(make(doc, 'td', typeof v === 'number' ? 'is-num' : null, num(v))); });
                body.appendChild(r);
            });
            t.appendChild(body); wrap.appendChild(t);
            return wrap;
        }
        case 'metric': {
            const m = make(doc, 'div', 'ovc-metric');
            m.appendChild(make(doc, 'span', 'ovc-metric-l', str(b.label, 60)));
            m.appendChild(make(doc, 'b', 'ovc-metric-v', str(b.value, 40)));
            if (b.note) m.appendChild(make(doc, 'span', 'ovc-metric-n', str(b.note, 120)));
            return m;
        }
        case 'chart': return chart(doc, b);
        case 'image': {
            if (!MEDIA.test(String(b.src || ''))) return null;
            const img = make(doc, 'img', 'ovc-img');
            img.alt = str(b.alt, 200); img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
            img.addEventListener('error', () => img.remove());   // a picture that is gone leaves no empty frame
            img.src = b.src;
            return img;
        }
        case 'link': {
            const href = String(b.href || '');
            if (!HTTPS.test(href)) return null;
            let host = '';
            try { host = new URL(href).host; } catch (e) { return null; }
            const a = make(doc, 'a', 'ovc-link');
            a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
            a.appendChild(make(doc, 'b', null, str(b.text, 120)));
            a.appendChild(make(doc, 'span', null, host));
            return a;
        }
        case 'button': {
            if (b.action !== 'ask') return null;
            const label = str(b.label, 40);
            const btn = make(doc, 'button', 'ovc-btn', label);
            btn.type = 'button';
            if (typeof opts.onAsk === 'function') {
                btn.addEventListener('click', () => {
                    opts.onAsk(label, b);
                    btn.disabled = true; btn.textContent = 'Sent';
                    setTimeout(() => { btn.disabled = false; btn.textContent = label; }, 2500);
                });
            } else btn.disabled = true;
            return btn;
        }
        default: return null;   // a block this renderer does not know is left out, never guessed at
        }
    }

    const drawn = new WeakMap();   // host → the version on screen
    function render(host, doc, opts) {
        if (!host || !valid(doc)) return null;
        const o = opts || {};
        const had = drawn.get(host);
        if (had != null && doc.version < had) return had;   // a late, older update never rolls the panel back
        const d = host.ownerDocument || document;
        styles(d);
        const box = make(d, 'section', 'ovc');
        box.setAttribute('aria-label', str(doc.title, 120) || 'Canvas');
        const head = make(d, 'div', 'ovc-head');
        head.appendChild(make(d, 'span', 'ovc-title', str(doc.title, 120)));
        if (doc.updated_at) { const t = make(d, 'time', 'ovc-when', ago(doc.updated_at)); t.dateTime = String(doc.updated_at); head.appendChild(t); }
        box.appendChild(head);
        doc.blocks.slice(0, MAX_BLOCKS).forEach((b) => { const n = block(d, b, o); if (n) box.appendChild(n); });
        host.replaceChildren(box);
        drawn.set(host, doc.version);
        return doc.version;
    }

    root.OVCanvas = { render, valid };
})(typeof window !== 'undefined' ? window : globalThis);
