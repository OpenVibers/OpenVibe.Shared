'use strict';
/**
 * openvibe-shared/quest — the daily quest card any OpenVibe site can show.
 *
 *   const card = OpenVibeQuest.mount(document.getElementById('quest'), {
 *       load: () => fetch('/api/home/daily-quest').then((r) => r.json()),
 *   });
 *   card.refresh();   // read again and redraw
 *
 * `load()` returns the same shape OpenVibe.Live's server reads from OpenVibe.Quest:
 *   { signed_in, quest, more: { quests, sites, mine: { badges, in_progress, completed } } }
 * The site fetches it its own way, from its own server, with the person's Network token; the browser never calls
 * Quest. `more` may be missing: the card still draws and the door falls back to its one line.
 *
 * Every field is data: set as text, links only when https. The card is built node by node and draws once into the
 * host it is given. Its look is quest.css (scoped to .ovq- classes, built on the kit's tokens); link it beside this
 * script. Without it the card still says everything, plain.
 */
(function (root) {
    'use strict';
    if (typeof document === 'undefined' || root.OpenVibeQuest) return;

    const QUEST_URL = 'https://openvibe.quest/';
    let cards = 0;
    // The card's small marks are its own SVG (a site may not load Font Awesome): aria-hidden, the text's colour.
    const PATHS = {
        'chevron-down': 'M6 9l6 6 6-6', 'chevron-right': 'M9 6l6 6-6 6', 'arrow-right': 'M5 12h14M13 6l6 6-6 6',
        fire: 'M12 2.8c.6 3 3.2 4.7 3.2 8.2a3.2 3.2 0 0 1-6.4 0c0-1.3.4-2.2 1.1-3C7.8 9.6 5.8 11.8 5.8 14.8a6.2 6.2 0 0 0 12.4 0C18.2 9 13.1 6.4 12 2.8z',
    };
    const glyph = (name, cls) => {
        const span = document.createElement('span');
        span.className = `ovq-g ${cls || ''}`.trim();
        span.setAttribute('aria-hidden', 'true');
        span.innerHTML = `<svg viewBox="0 0 24 24"><path d="${PATHS[name]}"/></svg>`;
        return span;
    };
    const el = (tag, cls, text) => {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = String(text);
        return node;
    };
    const href = (value) => (/^https:\/\//.test(String(value || '')) ? String(value) : QUEST_URL);
    /** The site's name from its host: openvibe.pics → OpenVibe.Pics. */
    function siteName(host) {
        const part = String(host || '').split('.')[1] || '';
        return part ? `OpenVibe.${part.charAt(0).toUpperCase()}${part.slice(1)}` : '';
    }
    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    /** The one line at the door: what waits on OpenVibe.Quest, from whatever the site could read. */
    function moreLine(more) {
        const own = more.mine || null;
        const bits = [];
        if (own) {
            const badges = Number(own.badges) || 0;
            const going = Number(own.in_progress) || 0;
            if (badges) bits.push(plural(badges, 'badge', 'badges'));
            if (going) bits.push(`${plural(going, 'quest', 'quests')} going`);
            const left = (Number(more.quests) || 0) - (Number(own.completed) || 0) - going;
            if (left > 0) bits.push(`${left} more to try`);
        }
        if (!bits.length && Number(more.quests)) {
            bits.push(`${more.quests} quests${Number(more.sites) ? ` on ${more.sites} sites` : ''}, each with a badge`);
        }
        if (!bits.length) bits.push('Every quest, your badges and your streak');
        return bits.join(' · ');
    }

    /**
     * Put a quest card into `host`. `load()` reads the data shape above (async); `refresh()` reads and redraws it.
     * One card per host: mounting twice returns the first one.
     */
    function mount(host, { load } = {}) {
        if (!host || typeof host.appendChild !== 'function') throw new TypeError('OpenVibeQuest.mount: pass the element to fill');
        if (typeof load !== 'function') throw new TypeError('OpenVibeQuest.mount: load() must return the quest data');
        if (host._ovq) return host._ovq;

        const card = el('div', 'ovq-quest');
        card.hidden = true;
        card.dataset.progress = '0';
        const head = el('button', 'ovq-head');
        head.type = 'button';
        head.setAttribute('aria-expanded', 'false');
        const icon = el('span', 'ovq-icon ov-icon');
        icon.dataset.icon = 'quest';
        icon.setAttribute('aria-hidden', 'true');
        const titles = el('span', 'ovq-titles');
        const kicker = el('span', 'ovq-kicker');
        const title = el('span', 'ovq-title');
        const bar = el('span', 'ovq-bar');
        bar.setAttribute('aria-hidden', 'true');
        bar.append(el('i'), el('i'), el('i'));
        titles.append(kicker, title, bar);
        const chip = el('span', 'ovq-chip');
        chip.hidden = true;
        const chev = glyph('chevron-down', 'ovq-chev');
        chev.setAttribute('aria-hidden', 'true');
        head.append(icon, titles, chip, chev);

        const body = el('div', 'ovq-body');
        body.id = `ovq-body-${++cards}`;
        head.setAttribute('aria-controls', body.id);
        body.hidden = true;
        const story = el('p', 'ovq-story');
        const steps = el('ol', 'ovq-steps');
        const more = el('a', 'ovq-more');
        more.href = QUEST_URL;
        const moreText = el('span', 'ovq-more-text');
        const moreTitle = el('b');
        moreTitle.textContent = 'More on OpenVibe.Quest';
        const moreLineEl = el('span');
        moreText.append(moreTitle, moreLineEl);
        const arrow = glyph('arrow-right', 'ovq-arrow');
        arrow.setAttribute('aria-hidden', 'true');
        more.append(moreText, arrow);
        body.append(story, steps, more);
        card.append(head, body);
        host.appendChild(card);

        head.addEventListener('click', () => {
            body.hidden = !body.hidden;
            head.setAttribute('aria-expanded', String(!body.hidden));
            card.classList.toggle('open', !body.hidden);
        });

        /** Draw one answer. A quest with anything but three steps is not this card. */
        function draw(data) {
            const quest = data && data.quest;
            if (!quest || !Array.isArray(quest.steps) || quest.steps.length !== 3) { card.hidden = true; return false; }
            const mine = !!data.signed_in;
            const progress = Math.max(0, Math.min(3, Number(quest.progress) || 0));
            const streak = Math.max(0, Number(quest.streak) || 0);
            card.dataset.progress = mine ? String(progress) : '0';
            kicker.textContent = !mine ? "TODAY'S QUEST"
                : quest.completed ? "TODAY'S QUEST · DONE" : `TODAY'S QUEST · ${progress} OF 3`;
            title.textContent = String(quest.title || '');
            chip.replaceChildren();
            chip.hidden = !(mine && streak > 0);
            if (!chip.hidden) {
                const fire = glyph('fire', 'ovq-fire is-fill');
                fire.setAttribute('aria-hidden', 'true');
                chip.append(fire, ` ${streak}`);
                chip.title = `${streak}-day streak`;
                chip.setAttribute('aria-label', chip.title);
            }
            story.textContent = String(quest.story || '');
            const next = mine && !quest.completed ? quest.steps.find((step) => !step.done) : null;
            steps.replaceChildren();
            for (const step of quest.steps) {
                const row = el('li');
                const a = el('a');
                a.href = href(step.href);
                const siteIcon = el('span', 'ovq-site-icon ov-appicon');
                siteIcon.dataset.icon = String(step.site || '').split('.')[1] || 'quest';
                siteIcon.dataset.size = '32';
                siteIcon.setAttribute('aria-hidden', 'true');
                const text = el('span', 'ovq-step');
                const sentence = el('span', null, step.sentence || '');
                const where = el('small', null, step === next ? `Next · ${siteName(step.site)}` : siteName(step.site));
                text.append(sentence, where);
                a.append(siteIcon, text);
                if (mine && step.done) {
                    row.classList.add('is-done');
                    const done = el('span', 'ovq-check', '✓');
                    done.setAttribute('aria-label', 'Done');
                    a.append(done);
                } else {
                    const go = glyph('chevron-right', 'ovq-go');
                    go.setAttribute('aria-hidden', 'true');
                    a.append(go);
                }
                if (step === next) row.classList.add('is-next');
                row.append(a);
                steps.append(row);
            }
            moreLineEl.textContent = moreLine((data && data.more) || {});
            card.hidden = false;
            return true;
        }

        let seq = 0;
        async function refresh() {
            const mine = ++seq;
            let data = null;
            try { data = await load(); } catch { data = null; }
            if (mine !== seq) return false;
            return draw(data);
        }
        const api = { refresh, el: card };
        host._ovq = api;
        void refresh();
        return api;
    }

    /** Mount every explicit quest host in a page. The site supplies its authenticated reader. */
    function mountAll({ load, root: page = document } = {}) {
        if (typeof load !== 'function') throw new TypeError('OpenVibeQuest.mountAll: load() must return the quest data');
        return [...page.querySelectorAll('[data-ov-quest]')].map((host) => mount(host, { load: () => load(host) }));
    }

    root.OpenVibeQuest = { mount, mountAll };
    if (typeof module === 'object' && module.exports) module.exports = { mount, mountAll };
})(typeof window !== 'undefined' ? window : globalThis);
