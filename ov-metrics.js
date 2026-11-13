/**
 * openvibe-shared/ov-metrics.js — the network's one way to show numbers (ai-metrics.md, 2026-11-12): Report, Exchange,
 * Compare and the admin panel draw their AI and usage numbers with these, and nobody draws a chart of their own. The
 * look is the theme's (tokens only); every piece works at 390 px, in both themes, and with motion off.
 *
 *   OVMetrics.tiles([{ label, value, unit?, sub?, trend?: [n], delta?: 0.12, better?: 'up'|'down', href? }])
 *   OVMetrics.spark(values, { label?, width?, height? })            a trend line with its last point
 *   OVMetrics.bars(rows, { label, value, format?, max?, note? })     a ranked bar list
 *   OVMetrics.percentiles({ p50, p90?, p95 }, { unit: 'ms'|'tps'|'usd', max?, label? })   p50 and p95 on one scale
 *   OVMetrics.split([{ label, value, tone? }], { format? })         one bar split into its parts, with a legend
 *   OVMetrics.table(rows, [{ key, label, format?, numeric?, bar? }], { sort?, caption? })   a sortable table
 *   OVMetrics.format.{ ms, usd, count, tokens, rate, tps, bytes, delta }   the same words everywhere
 *
 * Builders return DOM elements (no innerHTML of data). In Node only `format` is there (servers write the same words).
 */
(function (root, factory) {
    const api = factory(typeof document !== 'undefined' ? document : null);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.OVMetrics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (doc) {
    'use strict';

    // ── The words ──
    const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
    const DASH = '—';
    const format = {
        ms(v) { const n = num(v); if (n == null) return DASH; if (n < 1000) return `${Math.round(n)} ms`; if (n < 60000) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)} s`; return `${Math.floor(n / 60000)} min ${Math.round((n % 60000) / 1000)} s`; },
        usd(v) { const n = num(v); if (n == null) return DASH; if (n === 0) return '$0'; if (Math.abs(n) < 1) { const d = Math.min(6, Math.max(2, 1 - Math.floor(Math.log10(Math.abs(n))))); return `$${n.toFixed(d).replace(/(\.\d\d\d*?)0+$/, '$1')}`; } if (Math.abs(n) < 100) return `$${n.toFixed(2)}`; return `$${Math.round(n).toLocaleString('en-US')}`; },
        count(v) { const n = num(v); if (n == null) return DASH; const a = Math.abs(n); if (a < 1000) return String(Math.round(n)); if (a < 1e6) return `${(n / 1e3).toFixed(a < 1e4 ? 1 : 0)}k`; if (a < 1e9) return `${(n / 1e6).toFixed(a < 1e7 ? 1 : 0)}M`; return `${(n / 1e9).toFixed(1)}B`; },
        tokens(v) { const s = format.count(v); return s === DASH ? s : `${s} tokens`; },
        rate(v) { const n = num(v); if (n == null) return DASH; const p = n * 100; return `${p >= 99.95 || p === 0 ? p.toFixed(0) : p >= 10 ? p.toFixed(1) : p.toFixed(2)}%`; },
        tps(v) { const n = num(v); return n == null ? DASH : `${n >= 100 ? Math.round(n) : n.toFixed(1)} tok/s`; },
        bytes(v) { const n = num(v); if (n == null) return DASH; const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; let x = n; while (x >= 1024 && i < u.length - 1) { x /= 1024; i++; } return `${x.toFixed(x < 10 && i ? 1 : 0)} ${u[i]}`; },
        delta(v) { const n = num(v); if (n == null) return ''; const p = n * 100; return `${p > 0 ? '+' : ''}${Math.abs(p) < 10 ? p.toFixed(1) : Math.round(p)}%`; },
    };
    if (!doc) return { format };

    // ── The look: theme tokens only ──
    const CSS = [
        '.ovm-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:10px}',
        '.ovm-tile{display:grid;gap:4px;align-content:start;padding:12px 14px;border:1px solid var(--border,#2a3346);border-radius:14px;background:var(--bg-card,transparent);min-width:0;color:inherit;text-decoration:none}',
        'a.ovm-tile:hover,a.ovm-tile:focus-visible{border-color:var(--accent,#5b8cff)}',
        '.ovm-label{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text-muted,#8b96ad)}',
        '.ovm-value{font-size:24px;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}',
        '.ovm-value small{font-size:13px;font-weight:600;color:var(--text-secondary,#b7c0d3);margin-left:3px}',
        '.ovm-sub{font-size:12.5px;color:var(--text-secondary,#b7c0d3);font-variant-numeric:tabular-nums}',
        '.ovm-delta{font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}.ovm-delta.is-good{color:var(--success,#22c55e)}.ovm-delta.is-bad{color:var(--danger,#ef4444)}',
        '.ovm-spark{display:block;width:100%;height:28px;overflow:visible}.ovm-spark path{fill:none;stroke:var(--accent,#5b8cff);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}.ovm-spark .ovm-area{fill:var(--accent,#5b8cff);opacity:.12;stroke:none}.ovm-spark circle{fill:var(--accent,#5b8cff)}',
        '.ovm-bars{list-style:none;margin:0;padding:0;display:grid;gap:6px}',
        '.ovm-bar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;align-items:center;font-size:13.5px}',
        '.ovm-bar-l{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ovm-bar-v{font-variant-numeric:tabular-nums;color:var(--text-secondary,#b7c0d3)}',
        '.ovm-bar-t{grid-column:1/-1;height:6px;border-radius:999px;background:var(--bg-tertiary,rgba(127,127,127,.15));overflow:hidden}.ovm-bar-t>span{display:block;height:100%;border-radius:inherit;background:var(--accent,#5b8cff)}',
        '.ovm-bar small{grid-column:1/-1;color:var(--text-muted,#8b96ad);font-size:12px}',
        '.ovm-pct{display:grid;gap:6px;min-width:0}.ovm-pct-track{position:relative;height:10px;border-radius:999px;background:var(--bg-tertiary,rgba(127,127,127,.15))}',
        '.ovm-pct-range{position:absolute;top:0;bottom:0;border-radius:999px;background:color-mix(in srgb,var(--accent,#5b8cff) 35%,transparent)}',
        '.ovm-pct-mark{position:absolute;top:-3px;width:3px;height:16px;border-radius:2px;background:var(--accent,#5b8cff);transform:translateX(-50%)}.ovm-pct-mark.is-tail{background:var(--warning,#f59e0b)}',
        '.ovm-pct-keys{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:var(--text-secondary,#b7c0d3);font-variant-numeric:tabular-nums}.ovm-pct-keys b{color:var(--text,inherit)}',
        '.ovm-split{display:grid;gap:8px}.ovm-split-bar{display:flex;height:12px;border-radius:999px;overflow:hidden;background:var(--bg-tertiary,rgba(127,127,127,.15))}.ovm-split-bar>span{height:100%}',
        '.ovm-split-legend{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:var(--text-secondary,#b7c0d3)}.ovm-split-legend i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px;vertical-align:0}',
        '.ovm-t1{background:var(--accent,#5b8cff)}.ovm-t2{background:var(--success,#22c55e)}.ovm-t3{background:var(--warning,#f59e0b)}.ovm-t4{background:var(--text-muted,#8b96ad)}.ovm-t5{background:var(--danger,#ef4444)}',
        '.ovm-table-wrap{overflow-x:auto;border:1px solid var(--border,#2a3346);border-radius:12px;container:ovm-table/inline-size}',
        '.ovm-table{border-collapse:collapse;width:100%;font-size:13.5px}.ovm-table caption{text-align:left;padding:10px 12px;font-weight:600}',
        '.ovm-table th,.ovm-table td{padding:8px 12px;border-bottom:1px solid var(--border,#2a3346);text-align:left;white-space:nowrap}.ovm-table tr:last-child td{border-bottom:0}',
        '.ovm-table th{font-size:12px;font-weight:600;color:var(--text-muted,#8b96ad)}.ovm-table th button{all:unset;cursor:pointer;display:inline-flex;gap:4px;align-items:center}.ovm-table th button:focus-visible{outline:2px solid var(--accent,#5b8cff);outline-offset:2px;border-radius:4px}',
        '.ovm-table td.is-num,.ovm-table th.is-num{text-align:right;font-variant-numeric:tabular-nums}.ovm-table th.is-num button{flex-direction:row-reverse}',
        // A narrow box (a phone, a side column): each row is a card, its name on top and each value under its label;
        // the heads become sort buttons. The roles keep it a table for a screen reader whatever its display. This
        // block comes after the base table rules, so it wins the cascade at equal specificity.
        '@container ovm-table (max-width:520px){.ovm-table,.ovm-table tbody,.ovm-table thead,.ovm-table td{display:block}'
        + '.ovm-table caption{display:block;white-space:normal}.ovm-table thead tr{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;border-bottom:1px solid var(--border,#2a3346)}'
        + '.ovm-table thead th{display:block;border:0;padding:0}.ovm-table th button{min-height:36px;padding:0 10px;box-sizing:border-box;border:1px solid var(--border,#2a3346);border-radius:999px}'
        + '.ovm-table th[aria-sort=ascending] button,.ovm-table th[aria-sort=descending] button{border-color:var(--accent,#5b8cff);color:var(--text-primary,#e6edf7)}'
        + '.ovm-table th.is-num button{flex-direction:row}'
        + '.ovm-table tbody tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 16px;padding:10px 12px;border-bottom:1px solid var(--border,#2a3346)}.ovm-table tbody tr:last-child{border-bottom:0}'
        + '.ovm-table td,.ovm-table td.is-num{border:0;padding:0;white-space:normal;text-align:left;min-width:0;overflow-wrap:anywhere}'
        + '.ovm-table td:first-child{grid-column:1/-1;font-weight:600}'
        + '.ovm-table td:not(:first-child)::before{content:attr(data-label);display:block;font-size:11.5px;font-weight:400;color:var(--text-muted,#8b96ad)}'
        + '.ovm-table td .ovm-cellbar{display:block;width:100%;margin:4px 0 0}}',
        '.ovm-cellbar{display:inline-block;width:48px;height:5px;margin-left:8px;border-radius:999px;background:var(--bg-tertiary,rgba(127,127,127,.15));vertical-align:middle;overflow:hidden}.ovm-cellbar>span{display:block;height:100%;background:var(--accent,#5b8cff)}',
        '@media (prefers-reduced-motion:no-preference){html:not([data-ov-motion=off]) .ovm-bar-t>span,html:not([data-ov-motion=off]) .ovm-cellbar>span{transition:width .35s ease}}',
    ].join('');
    function style() {
        if (doc.getElementById('ov-metrics-css')) return;
        const s = doc.createElement('style'); s.id = 'ov-metrics-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
    }
    function el(tag, cls, kids, attrs) {
        const n = doc.createElement(tag);
        if (cls) n.className = cls;
        for (const k in attrs || {}) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
        (kids || []).forEach((c) => { if (c != null && c !== false) n.append(c); });
        return n;
    }
    const SVG = 'http://www.w3.org/2000/svg';
    const svgEl = (tag, attrs) => { const n = doc.createElementNS(SVG, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

    function spark(values, o = {}) {
        style();
        const v = (Array.isArray(values) ? values : []).map(num).filter((x) => x != null);
        const w = o.width || 120; const h = o.height || 28;
        const svg = svgEl('svg', { class: 'ovm-spark', viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', role: 'img', 'aria-label': o.label || (v.length ? `Trend: from ${v[0]} to ${v[v.length - 1]}` : 'No trend yet') });
        if (v.length < 2) return svg;
        const lo = Math.min(...v); const hi = Math.max(...v); const span = hi - lo || 1;
        const pts = v.map((x, i) => [(i / (v.length - 1)) * (w - 4) + 2, h - 3 - ((x - lo) / span) * (h - 6)]);
        const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
        svg.append(svgEl('path', { class: 'ovm-area', d: `${d} L${pts[pts.length - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z` }), svgEl('path', { d }), svgEl('circle', { cx: pts[pts.length - 1][0].toFixed(1), cy: pts[pts.length - 1][1].toFixed(1), r: '2.5' }));
        return svg;
    }

    function tiles(items) {
        style();
        const box = el('div', 'ovm-tiles', [], { role: 'list' });
        for (const it of Array.isArray(items) ? items : []) {
            const value = el('span', 'ovm-value', [String(it.value == null ? DASH : it.value), it.unit ? el('small', '', [it.unit]) : null]);
            const kids = [el('span', 'ovm-label', [it.label]), value];
            if (it.delta != null && Number.isFinite(Number(it.delta))) {
                const good = (Number(it.delta) >= 0) === ((it.better || 'up') === 'up');
                kids.push(el('span', `ovm-delta ${Number(it.delta) === 0 ? '' : good ? 'is-good' : 'is-bad'}`, [format.delta(it.delta)], { title: 'Against the period before' }));
            }
            if (it.sub) kids.push(el('span', 'ovm-sub', [it.sub]));
            if (Array.isArray(it.trend) && it.trend.length > 1) kids.push(spark(it.trend, { label: `${it.label}: trend` }));
            box.append(el(it.href ? 'a' : 'div', 'ovm-tile', kids, { role: 'listitem', href: it.href || null }));
        }
        return box;
    }

    function bars(rows, o = {}) {
        style();
        const list = (Array.isArray(rows) ? rows : []).filter(Boolean);
        const val = (r) => num(typeof o.value === 'function' ? o.value(r) : r[o.value || 'value']) || 0;
        const lab = (r) => String(typeof o.label === 'function' ? o.label(r) : r[o.label || 'label']);
        const fmt = o.format || ((x) => format.count(x));
        const max = num(o.max) || Math.max(1e-12, ...list.map(val));
        const ul = el('ul', 'ovm-bars');
        for (const r of [...list].sort((a, b) => val(b) - val(a))) {
            const pct = Math.max(0, Math.min(100, (val(r) / max) * 100));
            ul.append(el('li', 'ovm-bar', [el('span', 'ovm-bar-l', [lab(r)], { title: lab(r) }), el('span', 'ovm-bar-v', [fmt(val(r), r)]), el('span', 'ovm-bar-t', [el('span', '', [], { style: `width:${pct.toFixed(1)}%` })], { 'aria-hidden': 'true' }), o.note ? el('small', '', [o.note(r)]) : null]));
        }
        return ul;
    }

    function percentiles(p, o = {}) {
        style();
        const f = o.unit === 'tps' ? format.tps : o.unit === 'usd' ? format.usd : format.ms;
        const p50 = num(p && p.p50); const p90 = num(p && p.p90); const p95 = num(p && p.p95);
        const max = num(o.max) || Math.max(1e-9, p95 || 0, p90 || 0, p50 || 0) * 1.15;
        const at = (x) => `${Math.max(0, Math.min(100, (x / max) * 100)).toFixed(1)}%`;
        const track = el('div', 'ovm-pct-track', [], { 'aria-hidden': 'true' });
        if (p50 != null && p95 != null) track.append(el('span', 'ovm-pct-range', [], { style: `left:${at(Math.min(p50, p95))};width:calc(${at(Math.abs(p95 - p50))})` }));
        if (p50 != null) track.append(el('span', 'ovm-pct-mark', [], { style: `left:${at(p50)}` }));
        if (p95 != null) track.append(el('span', 'ovm-pct-mark is-tail', [], { style: `left:${at(p95)}` }));
        const keys = el('p', 'ovm-pct-keys', [el('span', '', ['p50 ', el('b', '', [f(p50)])]), p90 != null ? el('span', '', ['p90 ', el('b', '', [f(p90)])]) : null, el('span', '', ['p95 ', el('b', '', [f(p95)])]), p && p.n != null ? el('span', '', [`${format.count(p.n)} samples`]) : null]);
        const box = el('div', 'ovm-pct', [o.label ? el('span', 'ovm-label', [o.label]) : null, track, keys], { role: 'group', 'aria-label': `${o.label || 'Distribution'}: median ${f(p50)}, 95th percentile ${f(p95)}` });
        return box;
    }

    function split(parts, o = {}) {
        style();
        const list = (Array.isArray(parts) ? parts : []).filter((x) => x && num(x.value) > 0);
        const total = list.reduce((s, x) => s + num(x.value), 0) || 1;
        const fmt = o.format || format.count;
        const bar = el('div', 'ovm-split-bar', [], { 'aria-hidden': 'true' });
        const legend = el('ul', 'ovm-split-legend');
        list.forEach((x, i) => {
            const tone = `ovm-t${x.tone || (i % 5) + 1}`;
            bar.append(el('span', tone, [], { style: `width:${((num(x.value) / total) * 100).toFixed(1)}%`, title: `${x.label}: ${fmt(x.value)}` }));
            legend.append(el('li', '', [el('i', tone), `${x.label} ${fmt(x.value)} (${format.rate(num(x.value) / total)})`]));
        });
        return el('div', 'ovm-split', [bar, legend], { role: 'group', 'aria-label': o.label || 'Split' });
    }

    function table(rows, columns, o = {}) {
        style();
        const data = (Array.isArray(rows) ? rows : []).slice();
        const cols = Array.isArray(columns) ? columns : [];
        let sortKey = o.sort && o.sort.key ? o.sort.key : null;
        let dir = o.sort && o.sort.dir === 'asc' ? 1 : -1;
        const maxOf = {};
        for (const c of cols) if (c.bar) maxOf[c.key] = Math.max(1e-12, ...data.map((r) => num(r[c.key]) || 0));
        const t = el('table', 'ovm-table', [o.caption ? el('caption', '', [o.caption]) : null], { role: 'table' });
        const head = el('tr', '', [], { role: 'row' });
        const tbody = el('tbody', '', [], { role: 'rowgroup' });
        function drawBody() {
            const sorted = sortKey ? [...data].sort((a, b) => { const x = a[sortKey]; const y = b[sortKey]; const nx = num(x); const ny = num(y); return (nx != null && ny != null ? nx - ny : String(x == null ? '' : x).localeCompare(String(y == null ? '' : y))) * dir; }) : data;
            tbody.replaceChildren(...sorted.map((r) => el('tr', '', cols.map((c) => {
                const v = r[c.key];
                const text = c.format ? c.format(v, r) : (v == null ? DASH : String(v));
                const kids = [text];
                if (c.bar && num(v) != null) kids.push(el('span', 'ovm-cellbar', [el('span', '', [], { style: `width:${((num(v) / maxOf[c.key]) * 100).toFixed(1)}%` })], { 'aria-hidden': 'true' }));
                return el('td', c.numeric ? 'is-num' : '', kids, { role: 'cell', 'data-label': c.label });
            }), { role: 'row' })));
            head.querySelectorAll('th').forEach((th) => th.setAttribute('aria-sort', th.dataset.key === sortKey ? (dir === 1 ? 'ascending' : 'descending') : 'none'));
        }
        for (const c of cols) {
            const sortIc = el('span', 'ovm-sort', [], { 'aria-hidden': 'true' }); sortIc.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="14" height="14" style="vertical-align:-2px"><path d="M3.5 5.8h9.2M3.5 12h6.2M3.5 18.2h3M17.5 4.8v14.4M14.3 16.2l3 3l3-3"/></svg>';
            const b = el('button', '', [c.label, sortIc], { type: 'button' });
            b.addEventListener('click', () => { if (sortKey === c.key) dir = -dir; else { sortKey = c.key; dir = c.numeric ? -1 : 1; } drawBody(); });
            const th = el('th', c.numeric ? 'is-num' : '', [b], { scope: 'col', role: 'columnheader', 'data-key': c.key });
            head.append(th);
        }
        t.append(el('thead', '', [head], { role: 'rowgroup' }), tbody);
        drawBody();
        return el('div', 'ovm-table-wrap', [t]);
    }

    return { format, tiles, spark, bars, percentiles, split, table, CSS };
});
