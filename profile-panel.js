/**
 * openvibe-shared/profile-panel.js — a person's stuff on any OpenVibe site, Steam-style: what they wear, their item
 * count, their Quest badges and their achievements in every game, with links to the full profile and inventory.
 * Browser global `OpenVibeProfilePanel`; draw with /shared/profile-panel.css.
 *
 *   <div data-ov-profile="ana"><a href="https://openvibe.network/@ana">Ana's profile</a></div>
 *   <script src="/shared/profile-panel.js" defer></script>
 *   OpenVibeProfilePanel.render(el, 'ana')      or every [data-ov-profile] on the page, by itself, once loaded
 *
 * It reads OpenVibe.Network's public profile (GET https://openvibe.network/api/v1/profiles/:username: profile@1, CORS
 * open, no credentials, cached 60 s by the Network), which gathers Inventory, Quest and Play. The panel replaces the
 * element's content (a plain link is the no-JavaScript fallback). Every value is set as text, never markup; pictures
 * load only from openvibe.media and openvibe.network. A private profile shows its name and picture only; an answer
 * that does not come leaves the fallback as it was.
 */
(function (root) {
    'use strict';
    const NAME = /^[A-Za-z0-9_]{1,32}$/;
    const MEDIA_ID = /^[A-Za-z0-9_-]{1,80}$/;
    const RARITY = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const SAFE_HOST = /^(?:[a-z0-9-]+\.)*(?:openvibe\.[a-z]+|openre\.stream)$/;
    const api = () => String((root.OpenVibeProfilePanelConfig && root.OpenVibeProfilePanelConfig.api) || 'https://openvibe.network').replace(/\/+$/, '');
    const seen = new Map();   // username \u2192 Promise(profile | null), once a page

    function load(username) {
        if (!seen.has(username)) {
            seen.set(username, fetch(`${api()}/api/v1/profiles/${encodeURIComponent(username)}`, { credentials: 'omit', headers: { Accept: 'application/json' } })
                .then((r) => (r.ok ? r.json() : null)).then((b) => (b && b.profile) || null).catch(() => null));
        }
        return seen.get(username);
    }

    function el(tag, cls, text) {
        const n = root.document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = String(text);
        return n;
    }
    /** Only https links on the network's own hosts (openvibe.* and its subdomains, openre.stream) become hrefs. */
    function safeHref(href) {
        try {
            const u = new URL(String(href || ''));
            return u.protocol === 'https:' && SAFE_HOST.test(u.hostname) ? u.href : null;
        } catch { return null; }
    }
    function link(href, cls, text) {
        const a = el('a', cls, text);
        const h = safeHref(href);
        if (h) a.href = h;
        return a;
    }
    function stat(n, label) {
        const li = el('li');
        li.appendChild(el('b', null, Number(n) || 0));
        li.appendChild(el('span', null, label));
        return li;
    }
    function section(title, cls) {
        const s = el('div', `ovpp-sec ${cls}`);
        s.appendChild(el('h3', 'ovpp-h', title));
        return s;
    }
    function itemArt(art) {
        const a = art || {};
        const box = el('span', 'ovpp-art');
        if (a.media_id && MEDIA_ID.test(String(a.media_id))) {
            const img = el('img');
            img.src = `https://openvibe.media/o/${a.media_id}`;
            img.alt = '';
            img.loading = 'lazy';
            img.width = 28; img.height = 28;
            box.appendChild(img);
        } else box.textContent = String(a.emoji || '\u25c6').slice(0, 8);
        box.setAttribute('aria-hidden', 'true');
        return box;
    }

    function draw(target, p) {
        const card = el('section', 'ovpp');
        card.setAttribute('aria-label', `${p.display_name || p.username} on OpenVibe`);
        const head = link(p.profile_url, 'ovpp-head');
        const pic = el('img', 'ovpp-pic');
        pic.src = `${api()}/avatar/${encodeURIComponent(p.username)}?s=96`;
        pic.alt = ''; pic.width = 48; pic.height = 48;
        head.appendChild(pic);
        const who = el('span', 'ovpp-who');
        who.appendChild(el('b', null, p.display_name || p.username));
        who.appendChild(el('small', null, `@${p.username}`));
        head.appendChild(who);
        card.appendChild(head);
        if (p.private) {
            card.appendChild(el('p', 'ovpp-note', 'This profile is private.'));
            target.replaceChildren(card);
            return card;
        }
        const ach = p.achievements || { total: 0, games: [] };
        const stats = el('ul', 'ovpp-stats');
        stats.appendChild(stat((p.items && p.items.count) || 0, 'items'));
        stats.appendChild(stat((p.badges || []).length, 'badges'));
        stats.appendChild(stat(ach.total || 0, 'achievements'));
        stats.appendChild(stat((ach.games || []).length, 'games'));
        card.appendChild(stats);

        if ((p.showcase || []).length) {
            const s = section('Wearing', 'ovpp-wear');
            const ul = el('ul', 'ovpp-chips');
            p.showcase.slice(0, 6).forEach((i) => {
                const li = el('li', `ovpp-chip r-${RARITY.includes(i.rarity) ? i.rarity : 'common'}`);
                const a = link(i.url, null);
                a.title = `${i.kind_name || ''} \u00b7 ${i.name}`;
                a.appendChild(itemArt(i.art));
                a.appendChild(el('span', null, i.name));
                li.appendChild(a);
                ul.appendChild(li);
            });
            s.appendChild(ul);
            card.appendChild(s);
        }
        if ((ach.games || []).length) {
            const s = section('Achievements', 'ovpp-ach');
            const ul = el('ul', 'ovpp-list');
            ach.games.slice(0, 3).forEach((g) => {
                const li = el('li');
                const a = link(g.url, 'ovpp-game', g.name);
                li.appendChild(a);
                li.appendChild(el('small', null, ` \u00b7 ${g.count} unlocked`));
                const latest = (g.recent || [])[0];
                if (latest) li.appendChild(el('span', 'ovpp-latest', `\u{1F3C6} ${latest.name}`));
                ul.appendChild(li);
            });
            s.appendChild(ul);
            card.appendChild(s);
        }
        if ((p.badges || []).length) {
            const s = section('Badges', 'ovpp-badges');
            const ul = el('ul', 'ovpp-chips');
            p.badges.slice(0, 8).forEach((b) => ul.appendChild(el('li', 'ovpp-chip ovpp-badge', `\u{1F3C5} ${b.name}`)));
            s.appendChild(ul);
            card.appendChild(s);
        }
        const foot = el('p', 'ovpp-links');
        foot.appendChild(link(p.profile_url, null, 'Full profile'));
        if (p.inventory_url) { foot.appendChild(root.document.createTextNode(' \u00b7 ')); foot.appendChild(link(p.inventory_url, null, 'Inventory')); }
        card.appendChild(foot);
        target.replaceChildren(card);
        return card;
    }

    /** Draw `username`'s panel into `target`. → the panel, or null (the fallback stays) when there is no answer. */
    async function render(target, username) {
        const name = String(username || '');
        if (!target || !NAME.test(name)) return null;
        const p = await load(name);
        return p ? draw(target, p) : null;
    }

    function renderAll(node) {
        const scope = node || root.document;
        scope.querySelectorAll('[data-ov-profile]').forEach((n) => {
            if (n.dataset.ovProfileDone) return;
            n.dataset.ovProfileDone = '1';
            render(n, n.getAttribute('data-ov-profile'));
        });
    }

    const out = { render, renderAll, _draw: draw };
    root.OpenVibeProfilePanel = out;
    if (typeof module !== 'undefined' && module.exports) module.exports = out;
    if (root.document && root.document.addEventListener) {
        if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', () => renderAll());
        else renderAll();
    }
})(typeof window !== 'undefined' ? window : globalThis);
