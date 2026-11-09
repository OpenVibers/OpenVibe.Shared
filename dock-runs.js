/** The Dock's content-aware run list. All content comes from Network's action feed and Actor's skill catalogue. */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OpenVibeDockRuns) return;
    const CSS = `
.ovdk-overview{display:grid;gap:10px;padding:12px}.ovdk-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.ovdk-tile{min-width:0;padding:10px;border:1px solid var(--border,rgba(127,127,127,.2));border-radius:12px;background:var(--bg-secondary,rgba(127,127,127,.06))}
.ovdk-tile b{display:block;font-size:12px}.ovdk-tile span{display:block;margin-top:5px;font-size:12px;color:var(--text-secondary,#a8a8b2);line-height:1.4}
.ovdk-overview h3{font-size:13px;margin:10px 0 0}.ovdk-skills{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
.ovdk-skills button{min-height:44px;padding:9px;border-radius:10px;border:1px solid var(--border,rgba(127,127,127,.2));background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit;font-size:12px}
.ovdk-skills button:hover{border-color:var(--accent,#3b82f6)}.ovdk-run-filters{display:flex;gap:4px;overflow-x:auto;padding:8px 10px}
.ovdk-run-filters button{min-height:36px;padding:0 11px;border:1px solid var(--border,rgba(127,127,127,.2));border-radius:99px;background:transparent;color:inherit;cursor:pointer;white-space:nowrap;font:inherit;font-size:12px}
.ovdk-run-filters button[aria-pressed=true]{background:var(--accent,#3b82f6);color:var(--on-accent,#fff)}
.ovdk-runs{list-style:none;margin:0;padding:0 10px 10px;display:grid;gap:6px}.ovdk-run{display:grid;grid-template-columns:36px minmax(0,1fr);gap:9px;padding:10px;border:1px solid var(--border,rgba(127,127,127,.2));border-radius:12px;min-width:0}
.ovdk-run-ic{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:color-mix(in srgb,var(--run-color,var(--accent,#3b82f6)) 15%,transparent);color:var(--run-color,var(--accent,#3b82f6))}
.ovdk-run-sub{min-width:0;display:grid;gap:4px}.ovdk-run-sub>b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ovdk-run-line{font-size:12px;color:var(--text-secondary,#a8a8b2);line-height:1.4}
.ovdk-run-model{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--text-secondary,#a8a8b2)}.ovdk-run-maker{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:6px;background:color-mix(in srgb,var(--text-primary,#ececf1) 8%,transparent)}.ovdk-run-maker svg{width:14px;height:14px;fill:currentColor}
.ovdk-run[data-state=failed] .ovdk-run-line{color:var(--live-red,#e5484d)}.ovdk-run-bar{height:3px;background:var(--border,rgba(127,127,127,.2));border-radius:9px;overflow:hidden}.ovdk-run-bar:after{content:'';display:block;width:45%;height:100%;background:var(--accent,#3b82f6)}
.ovdk-run-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.ovdk-run-actions a,.ovdk-run-actions button,.ovdk-run-actions summary{min-height:36px;display:inline-flex;align-items:center;padding:0 7px;color:var(--accent,#3b82f6);background:transparent;border:0;cursor:pointer;font:inherit;font-size:12px;text-decoration:none}
.ovdk-run-actions details{position:relative}.ovdk-run-actions details menu{position:absolute;right:0;z-index:2;min-width:180px;padding:4px;margin:0;list-style:none;border:1px solid var(--border,rgba(127,127,127,.2));border-radius:10px;background:var(--bg-primary,#19191f);box-shadow:0 8px 24px rgba(0,0,0,.2)}
.ovdk-run-repeat{display:block;width:100%;min-height:36px;text-align:left;border:0;background:transparent;color:var(--accent,#3b82f6);font:inherit;cursor:pointer}
@media(max-width:640px){.ovdk-run-filters button,.ovdk-run-actions a,.ovdk-run-actions button,.ovdk-run-actions summary,.ovdk-run-repeat{min-height:44px}.ovdk-skills button{min-height:52px}}
`;
    const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text); return e; };
    const ago = (at) => { const n = Date.parse(at || ''); if (!Number.isFinite(n)) return ''; const m = Math.max(0, Math.round((Date.now() - n) / 60000)); return m < 1 ? 'now' : m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h` : `${Math.floor(m / 1440)} d`; };
    const until = (at) => { const m = Math.max(0, Math.ceil((Date.parse(at || '') - Date.now()) / 60000)); return m < 1 ? 'now' : m < 60 ? `in ${m} min` : m < 1440 ? `in ${Math.ceil(m / 60)} h` : `in ${Math.ceil(m / 1440)} d`; };
    const cash = (n) => n == null ? '' : Number(n) < .01 ? `$${Number(n).toFixed(4)}` : `$${Number(n).toFixed(2)}`;
    const iconOf = (it) => { const s = String(it.skill || it.subject && it.subject.kind || it.kind || ''); return /post|blog|write/.test(s) ? ['fa-pen','#d7974d'] : /wiki|article|research/.test(s) ? ['fa-book','#9875d8'] : /image|pic|meme/.test(s) ? ['fa-image','#d66bad'] : /chat|thread/.test(s) ? ['fa-comments','#61a9d7'] : /code|repo/.test(s) ? ['fa-code','#63b89c'] : /clip|stream|video/.test(s) ? ['fa-film','#dc866a'] : /quest/.test(s) ? ['fa-flag','#b9a74b'] : ['fa-sparkles','#8b92d9']; };
    const isUrl = (u) => /^https:\/\//.test(String(u || ''));
    function mount(panel, o) {
        const st = o.styles && o.styles(); if (st && !st.textContent.includes('.ovdk-overview{')) st.textContent += CSS;
        let doc = null, busy = false, timer = 0, filter = o.state().agent_filter || 'all';
        const request = async (path, init) => o.call(path, init);
        const all = () => doc ? ['waiting','running','scheduled','done','failed'].flatMap((b) => doc.buckets[b] || []) : [];
        function row(it) {
            const li = h('li', 'ovdk-run ovac-item'); li.dataset.state = it.bucket; li.dataset.bucket = it.bucket;
            const [glyph, color] = iconOf(it); li.style.setProperty('--run-color', color);
            const ic = h('span', 'ovdk-run-ic'); const i = h('i', `fa-solid ${glyph}`); i.setAttribute('aria-hidden', 'true'); ic.append(i);
            const body = h('div', 'ovdk-run-sub');
            const title = it.subject && it.subject.title || it.title || 'Agent run'; body.append(h('b', '', title));
            const error = it.run_error; let line = '';
            if (it.bucket === 'running') line = `Running: ${it.step || it.summary || 'Working'}`;
            else if (it.bucket === 'waiting') line = `Waiting: ${it.summary || 'Your answer is needed'}`;
            else if (it.bucket === 'scheduled') line = `Scheduled: ${it.next_run_at ? new Date(it.next_run_at).toLocaleString() : 'Time pending'}`;
            else if (it.bucket === 'failed') line = `Failed: ${error ? error.words + ' ' + error.next : 'This run could not finish. Open it for details.'}`;
            else line = ['Done', it.summary, cash(it.cost_usd), it.duration_ms != null ? `${Math.round(it.duration_ms / 1000)}s` : ''].filter(Boolean).join(' · ');
            body.append(h('span', 'ovdk-run-line', line));
            if (it.model) { const model = h('span', 'ovdk-run-model'); const mark = root.OpenVibeAIMarks && root.OpenVibeAIMarks.mark(it.maker, it.model); if (mark) model.append(mark); model.append(String(it.model)); body.append(model); }
            if (it.bucket === 'running') body.append(h('span', 'ovdk-run-bar'));
            const acts = h('div', 'ovdk-run-actions');
            if (it.bucket === 'waiting' && (it.actions || []).includes('approve')) for (const action of ['approve','decline']) {
                const b = h('button', action === 'approve' ? 'primary' : '', action === 'approve' ? 'Approve' : 'Decline'); b.type = 'button'; b.dataset.do = action;
                b.addEventListener('click', async () => { b.disabled = true; try { await request(`/api/v1/me/actions/${encodeURIComponent(it.service)}/${encodeURIComponent(it.id)}/${action}`, { method: 'POST', body: '{}' }); b.textContent = action === 'approve' ? 'Approved' : 'Declined'; } catch { b.disabled = false; b.textContent = 'Try again'; } }); acts.append(b);
            }
            const url = it.subject && it.subject.url || it.href; if (isUrl(url)) { const a = h('a', '', 'Open'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; acts.append(a); }
            if (it.bucket === 'running' && (it.actions || []).includes('cancel')) { const b = h('button', '', 'Stop'); b.type = 'button'; b.addEventListener('click', async () => { b.disabled = true; try { await request(`/api/v1/me/actions/${encodeURIComponent(it.service)}/${encodeURIComponent(it.id)}/cancel`, { method: 'POST', body: '{}' }); refresh(); } catch { b.disabled = false; } }); acts.append(b); }
            if (it.bucket === 'failed' && (it.actions || []).includes('retry')) { const b = h('button', '', 'Retry'); b.type = 'button'; b.addEventListener('click', async () => { b.disabled = true; try { await request(`/api/v1/me/actions/${encodeURIComponent(it.service)}/${encodeURIComponent(it.id)}/retry`, { method: 'POST', body: '{}' }); refresh(); } catch { b.disabled = false; } }); acts.append(b); }
            if (it.service === 'actor' && (it.kind === 'agent_task') && ['done', 'failed'].includes(it.bucket)) { const menu = h('details'); const summary = h('summary', '', 'More'); menu.append(summary); const list = h('menu');
                const choose = h('li'); const a = h('a', '', 'Choose another model'); a.href = 'https://openvibe.actor/chat/model'; a.target = '_blank'; a.rel = 'noopener'; choose.append(a); list.append(choose);
                const rerun = h('li'); const b = h('button', '', 'Run again'); b.type = 'button'; b.addEventListener('click', async () => { b.disabled = true; try { await request(`/api/v1/me/actions/actor/${encodeURIComponent(it.id)}/retry`, { method: 'POST', body: '{}' }); menu.open = false; refresh(); } catch { b.disabled = false; b.textContent = 'Try again'; } }); rerun.append(b); list.append(rerun); menu.append(list); acts.append(menu); }
            body.append(acts); li.append(ic, body); if (root.OVGlyphs) root.OVGlyphs.swap(li); return li;
        }
        function grouped(items) { const map = new Map(); for (const it of items) { const day = String(it.updated_at || it.created_at || '').slice(0,10); const key = [it.skill || it.kind, it.subject && it.subject.kind || '', it.bucket, day].join('|'); if (!map.has(key)) map.set(key, []); map.get(key).push(it); } return [...map.values()]; }
        function rows(items, target) { const list = h('ul', 'ovdk-runs'); grouped(items).forEach((group) => { if (group.length === 1) list.append(row(group[0])); else { const li = row(group[0]); const b = h('button', 'ovdk-run-repeat', `×${group.length} similar runs · Show all`); const details = h('ul', 'ovdk-runs'); details.hidden = true; group.slice(1).forEach((it) => details.append(row(it))); b.addEventListener('click', () => { details.hidden = !details.hidden; b.textContent = details.hidden ? `×${group.length} similar runs · Show all` : 'Hide repeats'; }); li.querySelector('.ovdk-run-sub').append(b, details); list.append(li); } }); target.append(list); }
        async function skills(box) {
            try {
                const res = await fetch(`${String(o.actorBase).replace(/\/+$/,'')}/api/v1/skills`, { headers: { accept: 'application/json' } });
                if (!res.ok) return;
                const data = await res.json();
                const available = (data.listings || []).filter((x) => x && x.skill && x.scan && x.scan.state === 'passed' && x.curator && x.curator.state === 'active').slice(0, 6);
                if (!available.length) return;
                box.append(h('h3', '', 'Things agents can do for you'));
                const grid = h('div', 'ovdk-skills');
                available.forEach((s) => {
                    const b = h('button', '', s.skill.name); b.type = 'button'; b.setAttribute('aria-label', `Start ${s.skill.name}`);
                    b.addEventListener('click', async () => {
                        b.disabled = true;
                        try {
                            const out = await request(`/api/v1/me/actions/skills/${encodeURIComponent(s.id)}/run`, { method: 'POST', body: JSON.stringify({ input: {}, choice: { mode: 'balanced' } }) });
                            if (out.run && out.run.id) root.location.href = `${o.actorBase}/tasks/${encodeURIComponent(out.run.id)}`;
                            else refresh();
                        } catch { b.disabled = false; b.textContent = `${s.skill.name} · Try again`; }
                    });
                    grid.append(b);
                });
                box.append(grid);
            } catch { /* catalogue unavailable */ }
        }
        function overview() { const box = h('section', 'ovdk-overview'); const tiles = h('div', 'ovdk-tiles'); const now = Date.now(); const items = all(); const next = (doc.buckets.scheduled || []).find((x) => x.next_run_at); const periods = [[1,'Today'],[7,'This week']];
            const first = h('div', 'ovdk-tile'); first.append(h('b', '', 'Next scheduled'), h('span', '', next ? `${next.title} · ${until(next.next_run_at)}` : 'Nothing scheduled')); tiles.append(first);
            periods.forEach(([days,label]) => { const recent = items.filter((x) => now - Date.parse(x.updated_at || x.created_at) < days * 86400000); const done = recent.filter((x) => x.bucket === 'done').length, failed = recent.filter((x) => x.bucket === 'failed').length; const tile = h('div', 'ovdk-tile'); tile.append(h('b', '', label), h('span', '', `${recent.length} runs · ${done} done · ${failed} failed · ${cash(recent.reduce((n,x) => n + (Number(x.cost_usd) || 0),0))}`)); tiles.append(tile); }); box.append(tiles);
            const recent = [...(doc.buckets.done || []), ...(doc.buckets.failed || [])].sort((a,b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0,3); if (recent.length) { box.append(h('h3', '', 'Last results')); rows(recent, box); }
            skills(box); return box; }
        function paint() { if (!doc) return; panel.textContent = ''; const items = all(); const filters = h('div', 'ovdk-run-filters'); for (const [id,label] of [['all','All'],['running','Running'],['waiting','Waiting'],['scheduled','Scheduled'],['done','Done'],['failed','Failed']]) { const b = h('button', '', label); b.type='button'; b.setAttribute('aria-pressed', String(filter===id)); b.addEventListener('click', () => { filter=id; o.save({agent_filter:id}); paint(); }); filters.append(b); } panel.append(filters);
            if (filter==='all' && !(doc.counts.running || doc.counts.waiting)) panel.append(overview());
            else { const shown = filter==='all' ? items : (doc.buckets[filter] || []); if (shown.length) rows(shown,panel); else panel.append(h('p','ovdk-none','No runs in this view.')); }
            const foot = h('div','ovdk-foot'); const allLink = h('a','','All runs'); allLink.href='https://openvibe.actor/tasks'; const give = h('a','','Give an agent a task'); give.href='https://openvibe.actor/skills'; foot.append(allLink,give); (o.foot || panel).append(foot); }
        async function refresh() { if (busy || !o.active()) return; busy=true; clearTimeout(timer); try { doc = await request('/api/v1/me/actions'); if (doc && doc.buckets) { paint(); if (o.onCounts) o.onCounts(doc.counts || {}); } } catch { panel.textContent=''; panel.append(h('div','ovdk-none','Your runs did not load. Open Agents again to retry.')); } finally { busy=false; if (o.active() && doc && doc.counts && doc.counts.running) timer=setTimeout(refresh,15000); } }
        refresh(); if (o.loadMarks) o.loadMarks().then((ok) => { if (ok && doc) paint(); });
        return { refresh, destroy: () => clearTimeout(timer) };
    }
    root.OpenVibeDockRuns = { mount };
})(typeof window !== 'undefined' ? window : globalThis);
