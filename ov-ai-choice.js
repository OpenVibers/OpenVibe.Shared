/* One task's model chip and choice sheet. Server rendering keeps the control named before hydration. */
(function (root, factory) {
    root.OpenVibeAiChoice = factory(); root.OpenVibeAiChoice.init();
}(typeof window === 'undefined' ? globalThis : window, function () {
    'use strict';
    function init(scope) {
        (scope || document).querySelectorAll('[data-ai-choice]').forEach(host => {
            if (host.dataset.ready) return; host.dataset.ready = '1';
            const chip = host.querySelector('[data-ai-open]'), value = host.querySelector('[data-ai-value]');
            let selected = value.value ? JSON.parse(value.value) : null, data = null, dialog = null, oldOverflow = '';
            const same = (a,b) => a && b && a.model === b.model && a.source === b.source && a.machine === b.machine;
            function mark(model) {
                const family = /anthropic|claude/i.test(model) ? 'Anthropic' : /gpt|openai/i.test(model) ? 'OpenAI' : /gemini|google/i.test(model) ? 'Google' : /deepseek/i.test(model) ? 'DeepSeek' : /qwen/i.test(model) ? 'Qwen' : /llama|meta/i.test(model) ? 'Meta' : /mistral/i.test(model) ? 'Mistral' : /minimax/i.test(model) ? 'MiniMax' : /kimi|moonshot/i.test(model) ? 'Kimi' : /glm|zai/i.test(model) ? 'GLM' : 'Other';
                // The server render carries one template per maker. A page that placed the chip by hand has none: the
                // chip still names the model, with a neutral mark, rather than breaking on the first click.
                const template = host.querySelector(`template[data-maker="${family}"]`) || host.querySelector('template[data-maker="Other"]');
                if (template) return template.content.cloneNode(true);
                const span = document.createElement('span');
                span.className = 'ov-aim ov-aim--other';
                span.setAttribute('aria-hidden', 'true');
                return span;
            }
            function choose(row, picked = true) {
                selected = {model:row.model,source:row.source,...(row.machine ? {machine:row.machine}: {})};
                if (picked) value.value = JSON.stringify(selected);
                host.querySelector('[data-ai-label]').textContent = row.name || row.model;
                chip.querySelector('.ov-aim')?.remove(); chip.prepend(mark(row.model));
                if (picked) host.dispatchEvent(new CustomEvent('ai-choice', {bubbles:true,detail:selected}));
            }
            async function load() {
                const response = await fetch(`${host.dataset.endpoint}?task=${encodeURIComponent(host.dataset.task)}`, {credentials:'same-origin',headers:{Accept:'application/json'}});
                const body = await response.json(); if (!response.ok) throw new Error(body.detail || 'Models are unavailable. Try again.');
                data = body; const opts = data.options || {}; const known = [...(opts.openvibe || []), ...(opts.keys || []), ...(opts.machines || [])].find(r => same(r, selected || data.choice)); if (known) choose(known, false); else if (!selected && data.choice) choose(data.choice, false); return body;
            }
            function close() { if (!dialog) return; dialog.close(); dialog.remove(); dialog=null; document.documentElement.style.overflow=oldOverflow; chip.focus(); }
            function rows(parent, title, list, empty, rec) {
                const section=document.createElement('section'), h=document.createElement('h3');h.textContent=title;section.append(h);
                if (!list.length) {const p=document.createElement('p');p.className='ov-ai-muted';p.textContent=empty || 'No measured options yet.';section.append(p);}
                list.forEach(row=>{
                    const b=document.createElement('button');b.type='button';b.className='ov-ai-option';b.setAttribute('aria-pressed',String(same(selected,row)));b.append(mark(row.maker || row.model));
                    const text=document.createElement('span'), name=document.createElement('strong'), detail=document.createElement('small');name.textContent=row.name || row.model;
                    detail.textContent=[row.price_estimate_usd == null ? 'Price not measured' : row.price_estimate_usd === 0 ? row.source === 'openvibe' ? 'Free' : 'Your capacity' : `$${row.price_estimate_usd.toFixed(4)} estimated per run`,row.speed_ms ? `${Math.round(row.speed_ms/1000)} s` : 'Speed not measured',row.machine_name].filter(Boolean).join(' · ');
                    if(rec && same(rec,row)){const badge=document.createElement('em');badge.className='ov-ai-rec';badge.textContent='Recommended';name.append(' ',badge);}text.append(name,detail);b.append(text);const tick=document.createElement('span');tick.textContent=same(selected,row) ? '✓' : '';tick.setAttribute('aria-hidden','true');b.append(tick);
                    b.addEventListener('click',()=>{choose(row);draw();});section.append(b);
                });parent.append(section);
            }
            // One list of the models, in the order the person picks (Recommended, Fastest, Cheapest, Best quality),
            // then their own keys and machines; the owner's recommendation carries a badge. Opus's design, 11-09: the
            // first version listed the same models four times over.
            let order = 'recommended';
            const ORDERS = [['recommended', 'Recommended'], ['fastest', 'Fastest'], ['cheapest', 'Cheapest'], ['quality', 'Best quality']];
            function ordered(list) {
                const known = (k, desc) => { const a = list.filter(x => x[k] != null).sort((x, y) => desc ? y[k] - x[k] : x[k] - y[k]); return a.concat(list.filter(x => x[k] == null)); };
                if (order === 'fastest') return known('speed_ms');
                if (order === 'cheapest') return known('price_estimate_usd');
                if (order === 'quality') return known('quality', true);
                const rec = list.find(x => same(x, data.recommended || data.choice));
                return rec ? [rec, ...list.filter(x => x !== rec)] : list;
            }
            function draw() {
                const scrollTop = dialog.querySelector('.ov-ai-options') ? dialog.querySelector('.ov-ai-options').scrollTop : 0;
                dialog.replaceChildren();
                const header = document.createElement('header'), titles = document.createElement('div'), title = document.createElement('h2'), sub = document.createElement('p'), x = document.createElement('button');
                title.textContent = 'Choose a model'; title.id = 'ov-ai-title';
                sub.textContent = `For ${host.dataset.taskLabel || 'this task'}`; sub.className = 'ov-ai-sub';
                titles.append(title, sub);
                x.type = 'button'; x.className = 'ov-ai-x'; x.setAttribute('aria-label', 'Close'); x.textContent = '×'; x.addEventListener('click', close);
                header.append(titles, x); dialog.append(header); dialog.setAttribute('aria-labelledby', title.id);
                const sorter = document.createElement('div'); sorter.className = 'ov-ai-order'; sorter.setAttribute('role', 'group'); sorter.setAttribute('aria-label', 'Order the models');
                ORDERS.forEach(([id, label]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('aria-pressed', String(order === id)); b.addEventListener('click', () => { order = id; draw(); }); sorter.append(b); });
                dialog.append(sorter);
                const content = document.createElement('div'); content.className = 'ov-ai-options'; dialog.append(content);
                const all = data.options.openvibe || [], standard = all.filter(x => !x.adult);
                rows(content, 'Models', ordered(standard), 'No models are available right now.', data.recommended || data.choice);
                rows(content, 'Your keys', data.options.keys || [], 'Add your own provider key on Exchange.');
                rows(content, 'Your machines', data.options.machines || [], 'Connect a computer with OpenVibe Link.');
                if (data.adult) rows(content, 'Uncensored 18+', all.filter(x => x.adult));
                content.scrollTop = scrollTop;
                const footer=document.createElement('footer'), save=document.createElement('button'), manage=document.createElement('a'), status=document.createElement('p');status.setAttribute('role','status');save.type='button';save.className='ovk-btn ovk-btn--primary';save.textContent=`Use this for every ${host.dataset.taskLabel}`;save.disabled=!selected;manage.href='https://openvibe.exchange/console';manage.textContent='Manage on Exchange';
                save.addEventListener('click',async()=>{save.disabled=true;try {const r=await fetch(`${host.dataset.saveEndpoint}/${encodeURIComponent(host.dataset.task)}`,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(selected)});if(!r.ok) {const e=await r.json();throw new Error(e.detail || 'Sign in on Exchange to save your choice.');}status.textContent='Saved for this task.';}catch(e){status.textContent=e.message;}finally{save.disabled=false;}});
                footer.append(save,manage,status);dialog.append(footer);
            }
            chip.addEventListener('click',async()=>{
                if(dialog) return;dialog=document.createElement('dialog');dialog.className='ov-ai-sheet';dialog.innerHTML='<div class="ov-ai-skeleton" role="status" aria-label="Loading models"></div>';document.body.append(dialog);oldOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';dialog.showModal();
                dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom) close();}});
                try {await load();if(dialog) draw();}catch(e){if(dialog){dialog.textContent=e.message;const b=document.createElement('button');b.type='button';b.textContent='Close';b.className='ovk-btn ovk-btn--quiet';b.addEventListener('click',close);dialog.append(b);}}
            });
            load().catch(()=>{});
        });
    }
    return {init};
}));
