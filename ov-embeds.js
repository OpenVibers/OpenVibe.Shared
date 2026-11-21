/**
 * openvibe-shared/ov-embeds.js — rich content in an agent's answer (4.335.0; the owner, 11-21, on Actor's chat: "improve
 * the formatting of these links and make more rich embedded content in the chat … make it more AI … a system that's
 * able to just detect shit that it can add or make using custom HTML, or just generate code just like in the chat").
 *
 * Two ways in, one look:
 *   - detected: an answer's links become cards when there is something to show (a video, a picture, a repository, a
 *     task, a stream), and a fenced block of `chart` (a JSON spec) or `html` / `svg` becomes the thing it describes;
 *   - asked for: an agent step's `ui` of type `chart` ({ type, title?, labels, series, unit? }) or `widget`
 *     ({ html, title? }) is drawn the same way (ov-session.js registers both, and this file fills them in).
 *
 *   OVEmbeds.enrich(node)          upgrades a rendered answer: its chart/html/svg blocks, its waiting ui cards, and
 *                                  cards for its links (three at most, after the words). Safe to call again.
 *   OVEmbeds.chart(spec)           → an element (an SVG chart: bar, line, area, pie, donut), or null for a bad spec
 *   OVEmbeds.widget(html, opts)    → an element: the HTML running in a sandbox (scripts yes; the page, its cookies,
 *                                    the network and top navigation no), Preview and Code, sized to what it draws
 *   OVEmbeds.linkInfo(url)         → { kind, label, sub, glyph, rich } for an https address, or null
 *   OVEmbeds.linkCard(url)         → an element, or null when a link has nothing more to show than its chip
 *
 * A widget is an iframe with sandbox="allow-scripts" (an opaque origin: nothing of the page or the person is reachable)
 * and srcdoc, so it also keeps the page's own policy: no requests, no outside pictures. It reports its height to its
 * frame (checked by the frame's own window) and is held between 120 and 720 px. Colours are the page's tokens with
 * fallbacks for both modes; things enter with a short rise that follows html[data-ov-motion] (Calm shortens it, Off has
 * none).
 */
(function (root) {
    'use strict';
    if (root.OVEmbeds) return;
    const doc = root.document;
    const SVGNS = 'http://www.w3.org/2000/svg';
    const el = (tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text); return e; };
    const sv = (tag, attrs) => { const e = doc.createElementNS(SVGNS, tag); for (const k in attrs || {}) e.setAttribute(k, String(attrs[k])); return e; };
    const GLYPH = {
        play: '<path d="M8 5.5v13l10.5-6.5Z"/>',
        repo: '<path d="M6 3.5h11.5v14H7.5a1.5 1.5 0 0 0 0 3h10"/><path d="M6 3.5v15.5"/><path d="M10 7.5h4"/>',
        code: '<path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5"/>',
        task: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>',
        live: '<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
        image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4.5 18 5-5 3.5 3.5 2.5-2.5 4 4"/>',
        link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/>',
        open: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
        chart: '<path d="M4 19.5h16M7 16v-5M12 16V7M17 16v-8"/>',
        copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
        model: '<path d="M12 3.5 19.5 8v8L12 20.5 4.5 16V8Z"/><path d="M4.5 8 12 12.5 19.5 8M12 12.5v8"/>',
    };
    const glyph = (name, size = 20) => { const s = sv('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', class: 'ove-g' }); s.innerHTML = GLYPH[name] || GLYPH.link; return s; };
    const https = (u) => { try { const x = new URL(String(u)); return x.protocol === 'https:' ? x : null; } catch { return null; } };

    const CSS = `
.ove-cards{display:grid;gap:8px;margin-top:10px}
.ove-card{position:relative;display:grid;grid-template-columns:40px minmax(0,1fr) 18px;align-items:center;gap:12px;min-height:60px;box-sizing:border-box;padding:10px 12px;border-radius:16px;border:1px solid var(--border,rgba(148,163,184,.2));background:var(--bg-card,rgba(255,255,255,.03));color:inherit;text-decoration:none;animation:ove-in .3s cubic-bezier(.2,.8,.2,1) both;transition:border-color .15s,background-color .15s,transform .12s}
.ove-card:hover{border-color:color-mix(in srgb,var(--accent,#3b82f6) 55%,var(--border,rgba(148,163,184,.2)));background:color-mix(in srgb,var(--accent,#3b82f6) 5%,var(--bg-card,transparent))}
.ove-card:active{transform:scale(.985)}
.ove-card:focus-visible{outline:2px solid var(--accent,#3b82f6);outline-offset:2px}
.ove-ic{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:color-mix(in srgb,var(--accent,#3b82f6) 14%,transparent);color:var(--accent-light,var(--accent,#60a5fa))}
.ove-ic .ove-g{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ove-ic.is-play .ove-g{fill:currentColor;stroke:none}
.ove-t{display:grid;gap:2px;min-width:0}
.ove-t b{font-size:15px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ove-t small{font-size:13px;color:var(--text-muted,#8a96ad);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ove-go{width:18px;height:18px;color:var(--text-muted,#8a96ad);transition:transform .2s cubic-bezier(.2,1.2,.3,1)}
.ove-go .ove-g{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ove-card:hover .ove-go{transform:translate(calc(2px * var(--ov-move,1)),calc(-2px * var(--ov-move,1)));color:var(--accent-light,var(--accent,#60a5fa))}
.ove-pic{display:block;overflow:hidden;max-width:100%;border-radius:16px;border:1px solid var(--border,rgba(148,163,184,.2));animation:ove-in .3s cubic-bezier(.2,.8,.2,1) both}
.ove-pic img{display:block;max-width:100%;max-height:360px;margin:0 auto;object-fit:contain}
.ove-box{display:grid;gap:8px;margin:10px 0;padding:12px;border-radius:16px;border:1px solid var(--border,rgba(148,163,184,.2));background:var(--bg-card,rgba(255,255,255,.03));animation:ove-in .3s cubic-bezier(.2,.8,.2,1) both;min-width:0}
.ove-box-h{display:flex;align-items:center;gap:8px;min-width:0}
.ove-box-h b{flex:1;min-width:0;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ove-box-h .ove-g{flex:none;width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;color:var(--accent-light,var(--accent,#60a5fa))}
.ove-tabs{display:inline-flex;gap:2px;padding:2px;border-radius:10px;background:color-mix(in srgb,var(--text-primary,#e6edf7) 6%,transparent)}
.ove-tabs button,.ove-act{min-height:32px;padding:0 10px;border:0;border-radius:8px;background:none;color:var(--text-secondary,#a8b3c4);font:inherit;font-size:13px;font-weight:650;cursor:pointer}
.ove-tabs button[aria-selected=true]{background:var(--bg-primary,#0b1220);color:var(--text-primary,#e6edf7);box-shadow:0 1px 3px rgba(0,0,0,.25)}
.ove-act{display:inline-grid;place-items:center;width:32px;padding:0}
.ove-act .ove-g{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ove-act:hover,.ove-tabs button:hover{color:var(--text-primary,#e6edf7)}
.ove-frame{display:block;width:100%;height:220px;min-height:120px;max-height:720px;border:0;border-radius:12px;background:#fff;resize:vertical;overflow:auto;transition:height .2s}
.ove-src{margin:0;max-height:360px;overflow:auto;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--text-primary,#e6edf7) 5%,transparent);font:12.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre}
.ove-chart svg{display:block;width:100%;height:auto;overflow:visible}
.ove-chart text{fill:var(--text-muted,#8a96ad);font:11px system-ui,sans-serif}
.ove-chart .ove-grid{stroke:color-mix(in srgb,var(--text-primary,#e6edf7) 10%,transparent);stroke-width:1}
.ove-chart .ove-mark{transition:opacity .15s}
.ove-chart .ove-mark:hover{opacity:.8}
.ove-legend{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:13px;color:var(--text-secondary,#a8b3c4)}
.ove-legend span{display:inline-flex;align-items:center;gap:6px}
.ove-legend i{width:10px;height:10px;border-radius:3px}
.ove-c0{--c:var(--accent,#3b82f6)}.ove-c1{--c:var(--success,#22c55e)}.ove-c2{--c:var(--warning,#f59e0b)}.ove-c3{--c:var(--danger,#ef4444)}.ove-c4{--c:var(--accent-2,#a855f7)}.ove-c5{--c:var(--info,#06b6d4)}
@keyframes ove-in{from{opacity:0;transform:translateY(calc(6px * var(--ov-move,1)))}to{opacity:1;transform:none}}
html[data-ov-motion=off] .ove-card,html[data-ov-motion=off] .ove-pic,html[data-ov-motion=off] .ove-box,html[data-ov-motion=off] .ove-frame{animation:none;transition:none}
@media (prefers-reduced-motion:reduce){.ove-card,.ove-pic,.ove-box{animation:none}}`;
    function styles() {
        if (!doc || doc.getElementById('ove-css')) return;
        const st = el('style'); st.id = 'ove-css'; st.textContent = CSS; doc.head.appendChild(st);
    }

    // ── what a link is ──
    const IMAGE = /\.(png|jpe?g|gif|webp|avif)$/i;
    function youtubeId(u) {
        const h = u.hostname.replace(/^www\.|^m\./, '');
        if (h === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
        if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
            if (u.pathname === '/watch') return u.searchParams.get('v');
            const m = /^\/(shorts|embed|live)\/([\w-]{6,20})/.exec(u.pathname);
            return m ? m[2] : null;
        }
        return null;
    }
    function linkInfo(url) {
        const u = https(url);
        if (!u) return null;
        const host = u.hostname.replace(/^www\./, '').toLowerCase();
        const parts = u.pathname.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
        const yt = youtubeId(u);
        if (yt && /^[\w-]{6,20}$/.test(yt)) return { kind: 'youtube', id: yt, label: 'YouTube video', sub: 'youtube.com', glyph: 'play', rich: true };
        if (IMAGE.test(u.pathname)) return { kind: 'image', label: parts[parts.length - 1] || host, sub: host, glyph: 'image', rich: true };
        if (host === 'git.openvibe.codes' && parts.length >= 2) return { kind: 'repo', label: `${parts[0]}/${parts[1]}`, sub: 'Repository on OpenVibe Git', glyph: 'repo', rich: true };
        if (host === 'github.com' && parts.length >= 2) {
            const n = /^(pull|issues)$/.test(parts[2] || '') && /^\d+$/.test(parts[3] || '') ? ` #${parts[3]}` : '';
            return { kind: 'repo', label: `${parts[0]}/${parts[1]}${n}`, sub: n ? (parts[2] === 'pull' ? 'Pull request on GitHub' : 'Issue on GitHub') : 'Repository on GitHub', glyph: 'repo', rich: true };
        }
        if (host === 'openvibe.codes' && parts[0] === 'run' && parts[1] === 'tasks' && parts[2]) return { kind: 'task', label: 'Codes task', sub: `${parts[2].slice(0, 14)}… on OpenVibe.Codes`, glyph: 'code', rich: true };
        if (host === 'openvibe.actor' && parts[0] === 'tasks' && parts[1]) return { kind: 'task', label: 'Actor task', sub: `${parts[1].slice(0, 14)}… on OpenVibe.Actor`, glyph: 'task', rich: true };
        if (host === 'openvibe.live' && parts.length === 1 && /^[\w.-]{2,40}$/.test(parts[0]) && !/^(chat|browse|search|feed|updates|rundown|docs|broadcast|settings|vods|clips)$/.test(parts[0])) return { kind: 'live', label: parts[0], sub: 'Channel on OpenVibe.Live', glyph: 'live', rich: true };
        if (host === 'openvibe.video' || (host === 'openvibe.live' && /^(vods|clips)$/.test(parts[0] || ''))) return { kind: 'video', label: parts[parts.length - 1] || 'Video', sub: host === 'openvibe.video' ? 'OpenVibe.Video' : 'OpenVibe.Live', glyph: 'play', rich: true };
        if (host === 'openvibe.exchange' && parts[0] === 'm' && parts.length >= 2) return { kind: 'model', label: parts.slice(1).join('/'), sub: 'Model on OpenVibe.Exchange', glyph: 'model', rich: true };
        const tail = parts.length ? parts[parts.length - 1].replace(/[-_]+/g, ' ').slice(0, 48) : '';
        return { kind: 'page', label: tail || host, sub: host, glyph: 'link', rich: false };
    }

    function linkCard(url) {
        const info = linkInfo(url);
        if (!info || !info.rich) return null;
        const u = https(url);
        if (info.kind === 'image') {
            const a = el('a', 'ove-pic'); a.href = u.href; a.target = '_blank'; a.rel = 'nofollow noopener noreferrer'; a.setAttribute('aria-label', `Picture: ${info.label}`);
            const img = el('img'); img.alt = info.label; img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
            // A page that may not show this host's pictures (its own policy) drops the frame rather than show it broken.
            img.addEventListener('error', () => { const c = card(u, { ...info, rich: true, kind: 'page', glyph: 'image' }); a.replaceWith(c); });
            img.src = u.href; a.append(img);
            return a;
        }
        return card(u, info);
    }
    function card(u, info) {
        const a = el('a', 'ove-card'); a.href = u.href; a.target = '_blank'; a.rel = 'nofollow noopener noreferrer';
        a.dataset.oveKind = info.kind;
        const ic = el('span', `ove-ic${info.glyph === 'play' ? ' is-play' : ''}`); ic.append(glyph(info.glyph, 22));
        const t = el('span', 'ove-t'); t.append(el('b', '', info.label), el('small', '', info.sub));
        const go = el('span', 'ove-go'); go.append(glyph('open', 18));
        a.append(ic, t, go);
        return a;
    }

    // ── charts ──
    const num = (v) => (typeof v === 'number' ? v : Number(String(v).replace(/[, ]/g, '')));
    const fmt = (v, unit) => {
        const a = Math.abs(v);
        const s = a >= 1e9 ? `${+(v / 1e9).toFixed(1)}B` : a >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : a >= 1e4 ? `${+(v / 1e3).toFixed(1)}k` : `${+v.toFixed(a < 10 && a % 1 ? 2 : 0)}`;
        return unit ? (/^[$€£¥]$/.test(unit) ? `${unit}${s}` : `${s}${unit === '%' ? '' : ' '}${unit}`) : s;
    };
    function niceMax(m) { if (m <= 0) return 1; const p = 10 ** Math.floor(Math.log10(m)); const n = m / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
    function chart(spec) {
        if (!spec || typeof spec !== 'object') return null;
        const type = ['bar', 'line', 'area', 'pie', 'donut'].includes(spec.type) ? spec.type : 'bar';
        const labels = Array.isArray(spec.labels) ? spec.labels.slice(0, 40).map((x) => String(x).slice(0, 24)) : [];
        let series = Array.isArray(spec.series) ? spec.series : Array.isArray(spec.data) ? [{ name: spec.name || '', data: spec.data }] : [];
        series = series.slice(0, 6).map((s) => ({ name: String((s && s.name) || '').slice(0, 40), data: (Array.isArray(s && s.data) ? s.data : []).slice(0, labels.length || 40).map(num) }))
            .filter((s) => s.data.length && s.data.every(Number.isFinite));
        if (!series.length) return null;
        const n = labels.length || series[0].data.length;
        const unit = typeof spec.unit === 'string' ? spec.unit.slice(0, 8) : '';
        const box = el('figure', 'ove-box ove-chart'); box.style.margin = '10px 0';
        const head = el('div', 'ove-box-h'); head.append(glyph('chart', 20), el('b', '', String(spec.title || '').slice(0, 120) || 'Chart'));
        box.append(head);
        const W = 600, H = type === 'pie' || type === 'donut' ? 260 : 280;
        const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${spec.title || 'Chart'}: ${series.map((s) => s.name).filter(Boolean).join(', ')}` });
        if (type === 'pie' || type === 'donut') {
            const vals = series[0].data.map((v) => Math.max(0, v));
            const total = vals.reduce((a, b) => a + b, 0) || 1;
            const cx = W / 2, cy = H / 2, r = 110, ir = type === 'donut' ? 62 : 0;
            let a0 = -Math.PI / 2;
            vals.forEach((v, i) => {
                const a1 = a0 + (v / total) * Math.PI * 2;
                const big = a1 - a0 > Math.PI ? 1 : 0;
                const p = (a, rr) => `${cx + rr * Math.cos(a)} ${cy + rr * Math.sin(a)}`;
                const d = ir ? `M${p(a0, r)}A${r} ${r} 0 ${big} 1 ${p(a1, r)}L${p(a1, ir)}A${ir} ${ir} 0 ${big} 0 ${p(a0, ir)}Z` : `M${cx} ${cy}L${p(a0, r)}A${r} ${r} 0 ${big} 1 ${p(a1, r)}Z`;
                const path = sv('path', { d, class: `ove-mark ove-c${i % 6}`, style: 'fill:var(--c)' });
                const t = sv('title'); t.textContent = `${labels[i] || `#${i + 1}`}: ${fmt(v, unit)} (${Math.round((v / total) * 100)}%)`; path.append(t);
                svg.append(path); a0 = a1;
            });
            box.append(svg);
            const lg = el('div', 'ove-legend');
            vals.forEach((v, i) => { const s = el('span', `ove-c${i % 6}`); const sw = el('i'); sw.style.background = 'var(--c)'; s.append(sw, doc.createTextNode(`${labels[i] || `#${i + 1}`} · ${fmt(v, unit)}`)); lg.append(s); });
            box.append(lg);
            return box;
        }
        const L = 48, R = 12, T = 12, B = 34;
        const pw = W - L - R, ph = H - T - B;
        const all = series.flatMap((s) => s.data);
        const min = Math.min(0, ...all);
        const max = niceMax(Math.max(...all, 0) - min) + min;
        const y = (v) => T + ph - ((v - min) / (max - min || 1)) * ph;
        for (let k = 0; k <= 4; k++) {
            const v = min + ((max - min) * k) / 4;
            svg.append(sv('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'ove-grid' }));
            const tx = sv('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end' }); tx.textContent = fmt(v, unit); svg.append(tx);
        }
        const step = pw / n;
        const every = Math.max(1, Math.ceil(n / 10));
        for (let i = 0; i < n; i += every) {
            const tx = sv('text', { x: L + step * i + step / 2, y: H - 12, 'text-anchor': 'middle' }); tx.textContent = (labels[i] || String(i + 1)).slice(0, 12); svg.append(tx);
        }
        if (type === 'bar') {
            const gw = step * 0.72, bw = gw / series.length;
            series.forEach((s, si) => s.data.forEach((v, i) => {
                const x = L + step * i + (step - gw) / 2 + bw * si;
                const top = y(Math.max(v, 0)), bot = y(Math.min(v, 0));
                const rect = sv('rect', { x: x + 1, y: top, width: Math.max(1, bw - 2), height: Math.max(1, bot - top), rx: Math.min(4, bw / 3), class: `ove-mark ove-c${si % 6}`, style: 'fill:var(--c)' });
                const t = sv('title'); t.textContent = `${s.name ? `${s.name}, ` : ''}${labels[i] || `#${i + 1}`}: ${fmt(v, unit)}`; rect.append(t);
                svg.append(rect);
            }));
        } else {
            series.forEach((s, si) => {
                const pts = s.data.map((v, i) => [L + step * i + step / 2, y(v)]);
                if (type === 'area') svg.append(sv('path', { d: `M${pts[0][0]} ${y(Math.max(min, 0))}L${pts.map((p) => p.join(' ')).join('L')}L${pts[pts.length - 1][0]} ${y(Math.max(min, 0))}Z`, class: `ove-c${si % 6}`, style: 'fill:var(--c);opacity:.18' }));
                svg.append(sv('path', { d: `M${pts.map((p) => p.join(' ')).join('L')}`, class: `ove-c${si % 6}`, style: 'fill:none;stroke:var(--c);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round' }));
                pts.forEach((p, i) => {
                    const c = sv('circle', { cx: p[0], cy: p[1], r: n > 24 ? 2.5 : 4, class: `ove-mark ove-c${si % 6}`, style: 'fill:var(--c)' });
                    const t = sv('title'); t.textContent = `${s.name ? `${s.name}, ` : ''}${labels[i] || `#${i + 1}`}: ${fmt(s.data[i], unit)}`; c.append(t);
                    svg.append(c);
                });
            });
        }
        box.append(svg);
        if (series.length > 1 || series[0].name) {
            const lg = el('div', 'ove-legend');
            series.forEach((s, i) => { const sp = el('span', `ove-c${i % 6}`); const sw = el('i'); sw.style.background = 'var(--c)'; sp.append(sw, doc.createTextNode(s.name || `Series ${i + 1}`)); lg.append(sp); });
            box.append(lg);
        }
        return box;
    }

    // ── a widget: HTML the agent made, running in a sandbox ──
    let frames = 0;
    const live = new Map();   // frame id → iframe
    function listen() {
        if (listen.on || !root.addEventListener) return;
        listen.on = true;
        root.addEventListener('message', (e) => {
            const d = e.data;
            if (!d || typeof d !== 'object' || typeof d.oveFrame !== 'string') return;
            const f = live.get(d.oveFrame);
            if (!f || !f.isConnected) { live.delete(d.oveFrame); return; }
            if (e.source !== f.contentWindow) return;   // only that frame speaks for itself
            const h = Math.max(120, Math.min(720, Math.round(Number(d.h) || 0)));
            if (h && !f.dataset.oveSized) f.style.height = `${h}px`;
        });
    }
    function widget(html, opts = {}) {
        const src = String(html || '').slice(0, 200000);
        if (!src.trim()) return null;
        styles(); listen();
        const id = `ovef-${Date.now().toString(36)}-${++frames}`;
        const box = el('div', 'ove-box ove-widget');
        const head = el('div', 'ove-box-h');
        const tabs = el('div', 'ove-tabs'); tabs.setAttribute('role', 'tablist');
        const tPrev = el('button', '', 'Preview'); const tCode = el('button', '', 'Code');
        [tPrev, tCode].forEach((b) => { b.type = 'button'; b.setAttribute('role', 'tab'); });
        tabs.append(tPrev, tCode);
        const copy = el('button', 'ove-act'); copy.type = 'button'; copy.setAttribute('aria-label', 'Copy the code'); copy.title = 'Copy the code'; copy.append(glyph('copy', 18));
        head.append(glyph(opts.svg ? 'image' : 'code', 20), el('b', '', String(opts.title || '').slice(0, 120) || (opts.svg ? 'Picture' : 'Live preview')), tabs, copy);
        const frame = el('iframe', 'ove-frame');
        frame.setAttribute('sandbox', 'allow-scripts');
        frame.setAttribute('referrerpolicy', 'no-referrer');
        frame.setAttribute('loading', 'lazy');
        frame.title = String(opts.title || 'Live preview').slice(0, 120);
        const sizer = `<script>(function(){function s(){try{parent.postMessage({oveFrame:${JSON.stringify(id)},h:Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0)},"*")}catch(e){}}addEventListener("load",s);new ResizeObserver(s).observe(document.documentElement);setTimeout(s,300)})()<\/script>`;
        const base = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{color-scheme:light}body{margin:12px;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a}img,svg,canvas,video{max-width:100%}</style></head><body>';
        frame.srcdoc = opts.svg ? `${base}<div style="display:grid;place-items:center">${src}</div>${sizer}</body></html>` : /<html[\s>]/i.test(src) ? src.replace(/<\/body>/i, `${sizer}</body>`) + (/<\/body>/i.test(src) ? '' : sizer) : `${base}${src}${sizer}</body></html>`;
        live.set(id, frame);
        // A person who drags the frame keeps their size.
        frame.addEventListener('mouseup', () => { frame.dataset.oveSized = '1'; });
        const code = el('pre', 'ove-src'); code.append(el('code', '', src)); code.hidden = true;
        const pick = (preview) => {
            tPrev.setAttribute('aria-selected', String(preview)); tCode.setAttribute('aria-selected', String(!preview));
            frame.hidden = !preview; code.hidden = preview;
        };
        tPrev.addEventListener('click', () => pick(true)); tCode.addEventListener('click', () => pick(false));
        copy.addEventListener('click', async () => { try { await root.navigator.clipboard.writeText(src); copy.title = 'Copied'; } catch { copy.title = 'Select the code to copy it'; pick(false); } });
        pick(true);
        box.append(head, frame, code);
        return box;
    }

    // ── an answer, upgraded ──
    function parseSpec(text) { try { const j = JSON.parse(String(text || '').trim()); return j && typeof j === 'object' ? j : null; } catch { return null; } }
    function enrich(node, { max = 3 } = {}) {
        if (!node || !node.querySelectorAll) return;
        styles();
        node.querySelectorAll('pre[data-lang]:not([data-ove])').forEach((pre) => {
            const lang = String(pre.dataset.lang || '').toLowerCase();
            const text = pre.textContent || '';
            let made = null;
            if (lang === 'chart' || (lang === 'json' && /"series"\s*:|"labels"\s*:/.test(text) && /"type"\s*:\s*"(bar|line|area|pie|donut)"/.test(text))) made = chart(parseSpec(text));
            else if (lang === 'html') made = widget(text);
            else if (lang === 'svg' || (lang === 'xml' && /^\s*<svg[\s>]/i.test(text))) made = widget(text, { svg: true });
            pre.dataset.ove = made ? 'made' : 'kept';
            if (made) { pre.hidden = true; pre.after(made); }
        });
        node.querySelectorAll('[data-ove-wait]:not([data-ove])').forEach((ph) => {
            const kind = ph.dataset.oveWait;
            const data = ph.__oveData || {};
            const made = kind === 'chart' ? chart(data) : kind === 'widget' ? widget(data.html, data) : null;
            ph.dataset.ove = made ? 'made' : 'kept';
            if (made) ph.replaceWith(made); else ph.textContent = 'This could not be drawn.';
        });
        const words = node.querySelector('.ovse-words') || node;
        if (words.dataset.oveCards) return;
        words.dataset.oveCards = '1';
        const seen = new Set();
        const urls = [];
        words.querySelectorAll('a[href]').forEach((a) => {
            if (a.closest('.ovse-sources, .ove-cards, .ove-box')) return;
            const u = https(a.href); if (!u) return;
            const key = u.href.replace(/[#?].*$/, '').replace(/\/+$/, '');
            if (seen.has(key)) return; seen.add(key); urls.push(u.href);
        });
        const cards = urls.map(linkCard).filter(Boolean).slice(0, max);
        if (!cards.length) return;
        const wrap = el('div', 'ove-cards');
        cards.forEach((c, i) => { c.style.animationDelay = `${i * 50}ms`; wrap.append(c); });
        words.after(wrap);
    }

    root.OVEmbeds = { enrich, chart, widget, linkInfo, linkCard, CSS, version: 1 };
})(typeof window !== 'undefined' ? window : globalThis);
