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
                data = body; if (!selected && data.choice) choose(data.choice, false); return body;
            }
            function close() { if (!dialog) return; dialog.close(); dialog.remove(); dialog=null; document.documentElement.style.overflow=oldOverflow; chip.focus(); }
            function rows(parent, title, list, empty) {
                const section=document.createElement('section'), h=document.createElement('h3');h.textContent=title;section.append(h);
                if (!list.length) {const p=document.createElement('p');p.className='ov-ai-muted';p.textContent=empty || 'No measured options yet.';section.append(p);}
                list.forEach(row=>{
                    const b=document.createElement('button');b.type='button';b.className='ov-ai-option';b.setAttribute('aria-pressed',String(same(selected,row)));b.append(mark(row.maker || row.model));
                    const text=document.createElement('span'), name=document.createElement('strong'), detail=document.createElement('small');name.textContent=row.name || row.model;
                    detail.textContent=[row.price_estimate_usd == null ? 'Price not measured' : row.price_estimate_usd === 0 ? row.source === 'openvibe' ? 'Free' : 'Your capacity' : `$${row.price_estimate_usd.toFixed(4)} estimated per run`,row.speed_ms ? `${Math.round(row.speed_ms/1000)} s` : 'Speed not measured',row.machine_name].filter(Boolean).join(' · ');
                    text.append(name,detail);b.append(text);const tick=document.createElement('span');tick.textContent=same(selected,row) ? '✓' : '';tick.setAttribute('aria-hidden','true');b.append(tick);
                    b.addEventListener('click',()=>{choose(row);draw();});section.append(b);
                });parent.append(section);
            }
            function draw() {
                dialog.replaceChildren();const header=document.createElement('header'), title=document.createElement('h2'), x=document.createElement('button');title.textContent='Choose a model';title.id='ov-ai-title';x.type='button';x.className='ovk-button ovk-button-quiet';x.textContent='Close';x.addEventListener('click',close);header.append(title,x);dialog.append(header);dialog.setAttribute('aria-labelledby',title.id);
                const content=document.createElement('div');content.className='ov-ai-options';dialog.append(content);
                const all=data.options.openvibe || [], standard=all.filter(x=>!x.adult);
                const recommended=all.find(x=>same(x,data.recommended || data.choice));
                rows(content,'Recommended',recommended ? [recommended] : [],'The owner’s model is not available right now.');
                rows(content,'Fastest',standard.filter(x=>x.speed_ms!=null).sort((a,b)=>a.speed_ms-b.speed_ms).slice(0,5));
                rows(content,'Cheapest',standard.filter(x=>x.price_estimate_usd!=null).sort((a,b)=>a.price_estimate_usd-b.price_estimate_usd).slice(0,5));
                rows(content,'Best quality',standard.filter(x=>x.quality!=null).sort((a,b)=>b.quality-a.quality).slice(0,5),'Report has no rating for these models yet.');
                if(data.adult) rows(content,'Uncensored 18+',all.filter(x=>x.adult));
                rows(content,'Your keys',data.options.keys || [],'Add your own provider key on Exchange.');
                rows(content,'Your machines',data.options.machines || [],'Connect a computer with OpenVibe Link.');
                rows(content,'All models',standard);
                const footer=document.createElement('footer'), save=document.createElement('button'), manage=document.createElement('a'), status=document.createElement('p');status.setAttribute('role','status');save.type='button';save.className='ovk-button';save.textContent=`Use this for every ${host.dataset.taskLabel}`;save.disabled=!selected;manage.href='https://openvibe.exchange/console';manage.textContent='Manage on Exchange →';
                save.addEventListener('click',async()=>{save.disabled=true;try {const r=await fetch(`${host.dataset.saveEndpoint}/${encodeURIComponent(host.dataset.task)}`,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(selected)});if(!r.ok) {const e=await r.json();throw new Error(e.detail || 'Sign in on Exchange to save your choice.');}status.textContent='Saved for this task.';}catch(e){status.textContent=e.message;}finally{save.disabled=false;}});
                footer.append(save,manage,status);dialog.append(footer);
            }
            chip.addEventListener('click',async()=>{
                if(dialog) return;dialog=document.createElement('dialog');dialog.className='ov-ai-sheet';dialog.innerHTML='<div class="ov-ai-skeleton" role="status" aria-label="Loading models"></div>';document.body.append(dialog);oldOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';dialog.showModal();
                dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom) close();}});
                try {await load();if(dialog) draw();}catch(e){if(dialog){dialog.textContent=e.message;const b=document.createElement('button');b.type='button';b.textContent='Close';b.className='ovk-button';b.addEventListener('click',close);dialog.append(b);}}
            });
            load().catch(()=>{});
        });
    }
    return {init};
}));
