'use strict';
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// openvibe-shared/thread — one conversation UI for the network (plan L55 C4): the chats in a sidebar, the thread of
// turns, the work an agent did folded under its answer, and the composer. Actor's chat proved the shape (L55 C1–C3);
// Vibe (openvibe.chat), Codes and the Dock use the same parts, so a conversation looks and behaves the same on every
// site. Server-rendered and complete without script; ov-thread.js adds the drawer, the search, the growing composer,
// Enter to send, copy, staying at the bottom, and helpers to add and update turns as they stream. Draw with
// thread.css. Theme tokens only.
//
//   const thread = require('openvibe-shared/thread');
//   thread.page({
//       sidebar: thread.sidebar({ newHref: '/chat', groups: thread.group(chats, (c) => c.at) .map(...) }),
//       head: thread.head({ title: 'Plan a weekend' }),
//       turns: [thread.turn({ id, you: { text }, reply: thread.work({...}) + thread.answer({...}) })],
//       composer: thread.composer({ action: '/chat', placeholder: 'Ask anything' }),
//   });
//
// Every string is escaped; a field named html is markup the caller already made safe (an answer's rendered Markdown).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const kit = require('./kit');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = (name, v) => (v == null || v === false ? '' : v === true ? ` ${name}` : ` ${name}="${esc(v)}"`);
const clip = (s, n) => { const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

// Stroke icons, 24-unit grid, drawn in currentColor (thread.css sizes them).
const P = {
    plus: 'M12 5v14M5 12h14',
    close: 'M6 6l12 12M18 6L6 18',
    menu: 'M4 7h16M4 12h16M4 17h16',
    chev: 'M8 10l4 4 4-4',
    copy: 'M9 9h10v10H9zM5 15V5h10',
    retry: 'M4 12a8 8 0 0 1 14-5.3M20 4v4.5h-4.5M20 12a8 8 0 0 1-14 5.3M4 20v-4.5h4.5',
    like: 'M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.5 2.5L13 10h5.5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.3 20H7',
    dislike: 'M7 13V4H4v9zM7 13l4 7c1.5 0 2.5-1 2.5-2.5L13 14h5.5a2 2 0 0 0 2-2.3l-1.2-6A2 2 0 0 0 17.3 4H7',
    share: 'M12 15V4M8 8l4-4 4 4M5 13v6h14v-6',
    edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
    photo: 'M4 6h16v12H4zM4 15l4.5-4 3.5 3 2.5-2 5.5 4.5M15.5 9.5h.01',
    camera: 'M4 8h3.5L9 5.5h6L16.5 8H20v11H4zM12 11a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
    file: 'M6 3h8l4 4v14H6zM14 3v4h4',
    cloud: 'M7 18h10.5a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.6-1.5A4 4 0 0 0 7 18z',
    add: 'M12 5v14M5 12h14',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    tool: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
    ok: 'M5 12l5 5 9-10',
    bad: 'M6 6l12 12M18 6L6 18',
    step: 'M9 6l6 6-6 6',
    note: 'M5 5h14v10H9l-4 4z',
    you: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
    file: 'M7 3h7l5 5v13H7zM14 3v5h5',
    send: 'M5 12l14-7-5 14-2.5-5.5z',
    stop: 'M7 7h10v10H7z',
    attach: 'M16.5 6.5l-8 8a2.5 2.5 0 0 0 3.5 3.5l8-8a4.5 4.5 0 0 0-6.4-6.4l-8 8',
    options: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
    handover: 'M4 8h13l-3-3M20 16H7l3 3',
    wait: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    panel: 'M4 4h16v16H4zM15 4v16',
    shield: 'M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6zM9 12l2 2 4-4',
    // A step's kind (work rows' icon): read, find, edit, run, web, sub.
    read: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    find: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
    edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
    run: 'M3 4h18v16H3zM7 9l3 3-3 3M13 15h4',
    web: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
    sub: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
};
const icon = (name, cls = '') => `<svg class="ovt-ic${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[name] || P.note}"/></svg>`;

/** Today / Yesterday / This week / Earlier, from an ISO time (or ms) and now. */
function groupOf(when, now = Date.now()) {
    const t = typeof when === 'number' ? when : Date.parse(when);
    if (!Number.isFinite(t)) return 'Earlier';
    const day = (x) => { const d = new Date(x); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
    const days = Math.round((day(now) - day(t)) / 864e5);
    return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? 'This week' : 'Earlier';
}

/** Items (newest first) into the sidebar's groups: [{ name, items }]. `whenOf(item)` gives each one's time. */
function group(items, whenOf, now = Date.now()) {
    const out = [];
    for (const it of items || []) {
        const name = groupOf(whenOf(it), now);
        if (!out.length || out[out.length - 1].name !== name) out.push({ name, items: [] });
        out[out.length - 1].items.push(it);
    }
    return out;
}

/**
 * The chats, in the network's one sidebar (kit.sidebar, plan L35: "the navigation makes more sense in a vertical way…
 * shared styling across everything"): New chat on top, Find a chat (it filters as you type with ov-thread.js; without
 * script it is a GET to `findAction`), the site's places as vertical rows (nav), then the chats in their groups. A column
 * beside the conversation on a wide screen, a drawer on a phone (kit-web.js opens it from head()'s button).
 *   groups: [{ name, items: [{ href, title, current, live, dot, meta, mark }] }];  nav: kit.sidebar's [{ href, label, icon, here, count }]
 *   pinned: chats kept above the groups (Codes' conductor), the same shape as a group's items
 *   dot: 'busy' (live sets it), 'needs' (waiting for the person) or 'bad'; meta: a quiet word after the title ("2h")
 *   findSubmit: Enter in Find a chat runs the site's search at findAction (every message), not only the filter
 * Draw with kit.css and kit-web.js beside thread.css and ov-thread.js.
 */
function sidebar({ id = 'ovt-chats', label = 'Your chats', newHref = null, newLabel = 'New chat', find = true, findAction = '', findPlaceholder = 'Find a chat', findSubmit = false, groups = [], pinned = [], empty = 'Your chats show here.', nav = [], foot = [] } = {}) {
    const item = (c) => ({ href: c.href, label: clip(c.title, 80), here: !!c.current, dot: c.dot || (c.live ? 'busy' : null), meta: c.dot || c.live ? '' : (c.meta || ''), mark: c.mark || '' });
    const sections = [
        ...(pinned && pinned.length ? [{ title: 'Pinned', items: pinned.map(item) }] : []),
        ...groups.filter((g) => g && g.items && g.items.length).map((g) => ({ title: g.name, items: g.items.map(item) })),
    ];
    const html = kit.sidebar({
        id, label,
        action: newHref ? { href: newHref, label: newLabel, icon: 'plus' } : null,
        find: find ? { action: findAction || newHref || '', name: 'q', placeholder: findPlaceholder, label: findPlaceholder } : null,
        nav,
        sections: sections.length ? sections : [{ title: '', items: [], empty }],
        foot: foot.length ? `<p class="ovt-side-foot">${foot.map((f) => `<a href="${esc(f.href)}">${esc(f.label)}</a>`).join('')}</p>` : '',
    });
    return findSubmit ? html : html.replace('<form class="ovk-sidebar-find"', '<form class="ovk-sidebar-find" data-ovt-filter-only');
}

/**
 * The sticky head over the thread: the button that opens the chats on a phone (kit.sidebarButton), the title, New chat,
 * and the caller's actions. `sidebar` names the sidebar's id (false for none). `panel` names a panel()'s id: a button
 * that opens it where it is a drawer (below 1180 px), labelled `panelLabel`.
 */
function head({ title = '', newHref = null, sidebar: sid = 'ovt-chats', sidebarLabel = 'Your chats', actions = '', panel: pid = null, panelLabel = 'Details' } = {}) {
    const panelBtn = pid ? `<button type="button" class="ovt-btn ovt-panel-open" data-ovt-panel-open aria-controls="${esc(pid)}" aria-expanded="false" aria-label="${esc(panelLabel)}" title="${esc(panelLabel)}">${icon('panel')}</button>` : '';
    return `<header class="ovt-head" data-ovt-head>${sid ? kit.sidebarButton({ id: sid, label: sidebarLabel }) : ''}${title ? `<h1 class="ovt-title">${esc(title)}</h1>` : '<span class="ovt-title"></span>'}${actions || ''}${newHref ? `<a class="ovt-btn" href="${esc(newHref)}" aria-label="New chat">${icon('plus')}</a>` : ''}${panelBtn}</header>`;
}

// An agent's colour, only as a colour: #rgb…#rrggbbaa or a theme token, never anything else in a style attribute.
const COLOUR = /^(#[0-9a-f]{3,8}|var\(--[a-z0-9-]+\))$/i;
/** An agent's face: its initials (or the caller's safe mark) in its own colour. who: { name, initials, color, mark } */
function face(who = {}) {
    const colour = who.color && COLOUR.test(String(who.color)) ? ` style="--ovt-who:${who.color}"` : '';
    const inner = who.mark != null ? who.mark : esc(String(who.initials || String(who.name || '?').slice(0, 1).toUpperCase()).slice(0, 2));
    return `<span class="ovt-avatar is-who"${colour} aria-hidden="true">${inner}</span>`;
}

const bytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${Number(n) || 0} B`);
/** Files beside a message: a picture as a thumbnail, anything else as a named chip. files: [{ href, name, size, image }] */
function files(list = []) {
    if (!list || !list.length) return '';
    return `<ul class="ovt-files">${list.map((f) => `<li>${f.image
        ? `<a href="${esc(f.href)}" target="_blank" rel="noopener"><img src="${esc(f.href)}" alt="${esc(f.name || '')}" loading="lazy"></a>`
        : `<a class="ovt-file" href="${esc(f.href)}" target="_blank" rel="noopener">${icon('file')}<span><b>${esc(f.name || 'File')}</b>${f.size != null ? `<small>${bytes(f.size)}</small>` : ''}</span></a>`}</li>`).join('')}</ul>`;
}

/**
 * One turn: what the person wrote (a bubble, with any files), and the reply (the caller's markup: work(), answer(),
 * card()…). open marks a turn still working (its avatar breathes; ov-thread.js follows it).
 *   who: { name, initials, color, sub, mark } heads the reply with an agent's face and name, for a site where several
 *        agents work in one conversation (Codes hands a task from one to another); sub is a quiet line ("sonnet · Thorough")
 *   you.caption: a small word over the person's bubble ("Hand-over brief");  reply: null draws only the person's side
 */
function turn({ id = null, state = null, open = false, you = {}, reply = '', avatar = true, who = null, attrs = {} } = {}) {
    const extra = Object.entries(attrs || {}).map(([k, v]) => attr(k, v)).join('');
    const mine = you && (you.html != null || you.text != null || (you.files && you.files.length))
        ? `<div class="ovt-you">${you.caption ? `<span class="ovt-caption">${esc(you.caption)}</span>` : ''}${files(you.files)}${you.html != null ? `<div class="ovt-bubble">${you.html}</div>` : you.text != null ? `<p class="ovt-bubble">${esc(you.text)}</p>` : ''}</div>` : '';
    const mark = who ? face(who) : avatar ? '<span class="ovt-avatar" aria-hidden="true"></span>' : '';
    const name = who ? `<p class="ovt-who"><b>${esc(who.name || 'Agent')}</b>${who.sub ? `<span>${esc(who.sub)}</span>` : ''}</p>` : '';
    const bot = reply == null ? '' : `<div class="ovt-bot">${mark}<div class="ovt-reply">${name}${reply}</div></div>`;
    return `<li class="ovt-turn${state ? ` state-${esc(state)}` : ''}"${attr('id', id ? `t-${id}` : null)}${attr('data-turn', id)}${attr('data-state', state)}${open ? ' data-open' : ''}${extra}>
${mine}${bot}
</li>`;
}

/** A line across the thread between turns: a hand-over to another agent ("Codex took over"), a wait. icon: handover | wait */
function divider({ text = '', icon: ic = 'handover' } = {}) {
    return `<li class="ovt-divider"><span>${icon(ic)}${esc(text)}</span></li>`;
}

/**
 * The work, folded under the answer: "Worked for 12 s · 3 tools", or, while it works, the live line ("Reading the
 * page…"), open. rows: [{ kind: 'step' | 'note' | 'you' | 'tool', text, level, name, input, output, ok, running, icon }].
 * icon: a thread icon for the row (a coding agent's read, find, edit, run, web, sub); a tool that finished with no output
 * is a plain row, with nothing to open. running: false with no ok is a step that ended without a result: no mark.
 */
function work({ open = false, live = 'Working', took = null, rows = [] } = {}) {
    const tools = rows.filter((r) => r.kind === 'tool').length;
    if (!open && !rows.length) return '';
    const items = rows.map((r) => {
        if (r.kind === 'tool') {
            const st = r.running === false && r.ok == null ? 'is-done' : r.running || r.ok == null ? 'is-run' : r.ok ? 'is-ok' : 'is-bad';
            const mark = st === 'is-run' ? '<span class="ovt-dot" aria-hidden="true"></span>' : st === 'is-done' ? '' : icon(st === 'is-ok' ? 'ok' : 'bad');
            const head = `${icon(r.icon || 'tool')}<b>${esc(r.name || 'Tool')}</b>${r.input ? `<span class="ovt-w-in">${esc(clip(r.input, 90))}</span>` : ''}<span class="ovt-w-st">${mark}</span>`;
            if (r.output == null && st !== 'is-run') return `<li class="ovt-w-tool ${st}"><div class="ovt-w-row">${head}</div></li>`;
            return `<li class="ovt-w-tool ${st}"><details><summary>${head}</summary>
${r.output != null ? `<pre class="ovt-w-out">${esc(clip(r.output, 1500))}</pre>` : '<p class="ovt-w-out ovt-muted">Running…</p>'}</details></li>`;
        }
        if (r.kind === 'you') return `<li class="ovt-w-you">${icon('you')}<p>${esc(clip(r.text, 300))}</p></li>`;
        if (r.kind === 'note') return `<li class="ovt-w-note${r.level ? ` is-${esc(r.level)}` : ''}">${icon('note')}<p>${esc(clip(r.text, 700))}</p></li>`;
        return `<li class="ovt-w-step">${icon(r.icon || 'step')}<span>${esc(clip(r.text, 300))}</span></li>`;
    });
    const line = open
        ? `<span class="ovt-w-live" data-ovt-live>${esc(live)}…</span>`
        : `<span>${took ? `Worked for ${esc(took)}` : 'Worked'}${tools ? ` · ${tools} tool${tools === 1 ? '' : 's'}` : ''}</span>`;
    return `<details class="ovt-work"${open ? ' open data-open' : ''}><summary>${line}${icon('chev', 'ovt-chev')}</summary><ol class="ovt-w-list" data-ovt-work>${items.join('')}</ol></details>`;
}

/**
 * The answer: rendered Markdown (html, already safe), files and charts, sources as quiet links, and a footer with what
 * it ran on and the actions (Copy is drawn hidden and shown by ov-thread.js, which can copy).
 *   meta: ['Balanced · DeepSeek', '$0.002', '14 s'];  actions: [{ label, href, icon }]
 */
function answer({ html = '', files: att = [], sources = [], meta = [], actions = [], copy = true } = {}) {
    const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return clip(u, 40); } };
    const acts = [
        // Icon buttons, as every assistant draws them (11-09, the owner: "Copy and Try again should be actual icons"): the
        // word is the tooltip and the accessible name.
        copy ? `<button type="button" class="ovt-act" data-ovt-copy title="Copy" aria-label="Copy" hidden>${icon('copy')}<span class="ovt-sr">Copy</span></button>` : '',
        ...actions.map((a) => `<a class="ovt-act" href="${esc(a.href)}" title="${esc(a.label)}" aria-label="${esc(a.label)}">${icon(a.icon || (/again|retry/i.test(String(a.label)) ? 'retry' : 'more'))}<span class="ovt-sr">${esc(a.label)}</span></a>`),
    ].join('');
    return `<div class="ovt-answer" data-ovt-answer>${html}</div>
${files(att)}
${sources.length ? `<p class="ovt-sources">${sources.slice(0, 8).map((u) => `<a href="${esc(u)}" rel="nofollow ugc noopener" target="_blank">${esc(host(u))}</a>`).join('')}</p>` : ''}
${meta.length || acts ? `<div class="ovt-meta">${meta.filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join('')}<span class="ovt-acts">${acts}</span></div>` : ''}`;
}

/**
 * A card in the reply: a question waiting for the person (wait), a failure (bad), or a note (info). html is safe markup.
 * With form it is a form that asks something (an agent wanting to run a command: Allow or Deny), posting without script:
 *   code: what it wants to run (a block that scrolls inside itself);  icon: a thread icon before the title (shield, wait…)
 *   form: { action, hidden: { k: v }, buttons: [{ name, value, label, quiet }] }
 */
function card({ tone = 'info', title = '', text = null, html = '', code = null, icon: ic = null, form = null } = {}) {
    const lead = ic ? icon(ic) : '';
    const said = title ? `<b>${esc(title)}</b>${text != null ? ` ${esc(text)}` : ''}` : text != null ? esc(text) : '';
    const words = !said ? '' : ic ? `<p class="ovt-card-h">${lead}<span>${said}</span></p>` : `<p>${said}</p>`;
    const block = code != null ? `<pre class="ovt-card-code" tabindex="0">${esc(code)}</pre>` : '';
    if (!form) return `<div class="ovt-card is-${esc(tone)}">${words}${block}${html}</div>`;
    const hid = Object.entries(form.hidden || {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');
    const buttons = (form.buttons || []).map((b) => `<button type="submit" class="ovt-card-btn${b.quiet ? ' is-quiet' : ''}"${attr('name', b.name)}${attr('value', b.value)}>${esc(b.label)}</button>`).join('');
    return `<form class="ovt-card is-${esc(tone)}" method="post" action="${esc(form.action || '')}">${hid}${words}${block}${html}${buttons ? `<div class="ovt-card-acts">${buttons}</div>` : ''}</form>`;
}

/**
 * The panel beside the conversation: what the work produced (who worked on it, where, the changes, the proof). A third
 * column from 1180 px; below that a drawer from the right that head({ panel: id })'s button opens (ov-thread.js).
 *   sections: [{ title, html, rows: [{ who, icon, iconHtml, title, sub, html }] }]; a row's who draws an agent's face (turn's
 *   who), icon a thread icon, iconHtml the site's own safe icon; html is the caller's safe markup in place of title and sub.
 */
function panel({ id = 'ovt-panel', title = 'Details', sections = [] } = {}) {
    const row = (r) => `<li>${r.who ? face(r.who) : r.iconHtml != null ? r.iconHtml : r.icon ? icon(r.icon) : ''}<span>${r.html != null ? r.html : `<b>${esc(r.title || '')}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}`}</span></li>`;
    const secs = sections.filter(Boolean).map((s) => `<section class="ovt-panel-sec">${s.title ? `<h3>${esc(s.title)}</h3>` : ''}${s.rows && s.rows.length ? `<ul class="ovt-panel-rows">${s.rows.map(row).join('')}</ul>` : ''}${s.html || ''}</section>`).join('');
    return `<aside class="ovt-panel" id="${esc(id)}" aria-label="${esc(title)}" data-ovt-panel><div class="ovt-panel-head"><h2>${esc(title)}</h2><button type="button" class="ovt-btn ovt-panel-close" data-ovt-panel-close aria-label="Close">${icon('close')}</button></div>${secs}</aside>`;
}

/**
 * Attach (11-09, the owner: "a better file attach button… support all file types"): one + button. Every file type by
 * default (attach.accept narrows it). With attach.menu, a small menu: Files, Photos and videos, Take a photo (a phone's
 * camera), and From your OpenVibe files when the site gives attach.library (an href). All the inputs share one name, so
 * the plain form posts them all.
 */
function attachHtml(attach) {
    const name = esc(attach.name || 'files');
    const input = (accept, extra = '') => `<input type="file" name="${name}"${accept ? ` accept="${esc(accept)}"` : ''} multiple data-ovt-files${extra} hidden>`;
    if (!attach.menu) return `<label class="ovt-btn ovt-attach" title="Attach files">${icon('add')}<span class="ovt-sr">Attach files</span>${input(attach.accept)}</label>`;
    const row = (ic, label, inner) => `<label class="ovt-attach-row" role="menuitem">${icon(ic)}<span>${esc(label)}</span>${inner}</label>`;
    return `<details class="ovt-attach-menu" data-ovt-attach><summary class="ovt-btn ovt-attach" title="Attach" aria-label="Attach">${icon('add')}</summary><div class="ovt-attach-pop" role="menu">`
        + row('file', 'Files', input(attach.accept))
        + row('photo', 'Photos and videos', input('image/*,video/*'))
        + `<label class="ovt-attach-row ovt-attach-cam" role="menuitem">${icon('camera')}<span>Take a photo</span>${input('image/*', ' capture="environment"')}</label>`
        + (attach.library ? `<a class="ovt-attach-row" role="menuitem" href="${esc(attach.library)}">${icon('cloud')}<span>From your OpenVibe files</span></a>` : '')
        + '</div></details>';
}

/** The composer's Options: one button, the pickers behind it, and the chips of what differs from the defaults. */
function optionsHtml({ html, label = 'Options' }) {
    return `<details class="ovt-opts" data-ovt-opts><summary class="ovt-btn ovt-opts-btn" aria-label="${esc(label)}" title="${esc(label)}">${icon('options')}<i class="ovt-opts-dot" aria-hidden="true"></i></summary>`
        + `<div class="ovt-opts-panel" role="group" aria-label="${esc(label)}"><div class="ovt-opts-head"><b>${esc(label)}</b><button type="button" class="ovt-btn ovt-opts-x" data-ovt-opts-close aria-label="Done">${icon('close')}</button></div><div class="ovt-opts-body">${html}</div></div></details>`
        + '<span class="ovt-opts-chips" data-ovt-opts-chips></span>';
}

/**
 * The composer, at the bottom of the screen: a box that grows as you type, the caller's tools (a mode chip, a model
 * chip, attach), and Send, which becomes Stop while a turn works (busy). Works as a plain form without script.
 *   hidden: { parent: 'tsk_…' };  starters: ['Plan a weekend in Lisbon', …] (shown on an empty chat)
 *   top: the site's safe markup above the box (picked files, a problem line);  maxlength: the box's limit
 *   stopAction: where Stop posts while a turn works; '' draws Stop hidden, for a page whose script starts turns itself
 *   id, attrs: the form's id (inputs outside it join it with form="id") and the site's data attributes
 *   foot: the site's safe markup under the bar (where the work runs, recent repositories); note: a quiet line under that,
 *   which is also the form's status line (role="status": a site's script says "Sending…" there)
 *   options: { html, label } the site's safe pickers behind one Options button (11-09, the owner: "too many options…
 *   hidden under a cog"): a panel on a computer, a sheet on a phone, a <details> without script. A picker whose
 *   <select> or radio group carries data-ovt-default="<value>" shows as a chip beside the button while it differs
 *   (its × puts the default back), and the button wears a dot.
 *   examples: ['Make the home page faster on phones', …] the box's placeholder walks through them while it is empty
 *   commands: [{ name: 'fix', hint: 'Fix a bug', insert: 'Fix this: ' }] the box's "/" list (ov-composer.js, 4.201.0),
 *   with the person's own commands and the site's mods (files, @, voice and drafts come with it on every box)
 */
function composer({ action = '', method = 'post', name = 'text', placeholder = 'Message', value = '', busy = false, sendLabel = 'Send', stopAction = null, hidden = {}, tools = '', starters = [], note = '', attach = null, label = 'Message', top = '', maxlength = null, id = null, attrs = {}, foot = '', options = null, examples = [], commands = [], preset = null } = {}) {
    const cmds = (commands || []).filter((c) => c && /^[\w-]{1,30}$/.test(c.name || '')).slice(0, 30).map((c) => ({ name: c.name, hint: String(c.hint || '').slice(0, 120), insert: String(c.insert || '').slice(0, 4000) }));
    const extra = Object.entries(attrs || {}).map(([k, v]) => attr(k, v)).join('') + (cmds.length ? attr('data-ovt-commands', JSON.stringify(cmds)) : '');
    const hid = Object.entries(hidden || {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');
    return `${starters.length ? `<div class="ovt-starters">${starters.map((s) => `<button type="button" class="ovt-starter" data-ovt-starter="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
<form class="ovt-composer${busy ? ' is-busy' : ''}"${attr('id', id)} method="${esc(method)}" action="${esc(action)}" data-ovt-composer${preset ? attr('data-ovt-preset', preset) : ''}${attach ? ' enctype="multipart/form-data"' : ''}${extra}>${hid}
${top || ''}<label class="ovt-sr" for="ovt-text">${esc(label)}</label>
<textarea id="ovt-text" name="${esc(name)}" rows="1" placeholder="${esc(placeholder)}"${maxlength ? ` maxlength="${Number(maxlength) || ''}"` : ''}${examples && examples.length ? ` data-ovt-examples="${esc(JSON.stringify(examples.slice(0, 12).map((x) => String(x).slice(0, 140))))}"` : ''} data-ovt-text${busy ? '' : ' required'}>${esc(value)}</textarea>
<div class="ovt-c-row"><div class="ovt-c-tools">${attach ? attachHtml(attach) : ''}${tools || ''}${options && options.html ? optionsHtml(options) : ''}</div>
${stopAction != null ? `<button type="submit" class="ovt-stop"${stopAction ? ` formaction="${esc(stopAction)}" formnovalidate` : ''}${busy && stopAction ? '' : ' hidden'} data-ovt-stop>${icon('stop')}<span>Stop</span></button>` : ''}<button type="submit" class="ovt-send" data-ovt-send aria-label="${esc(sendLabel)}">${icon('send')}<span class="ovt-sr">${esc(sendLabel)}</span></button></div>
${foot || ''}<p class="ovt-c-note" data-ovt-note role="status">${esc(note || '')}</p>
</form>`;
}

// The inline Community thread a page shows under a thing (MediaHub's Video and Pics item pages, Community's paste
// and /c pages): the same markup on every site, from the comment service's answer. Draw with thread-inline.css.
const MEDIA_ID = /^med_[0-9A-HJKMNP-TV-Z]{26}$/;
// 4.247.0 (plan §Z.9): a comment's file uploaded through Media's composer attachments (composer.attachment@1): a video
// plays (Media's web copy when the original is not one a browser plays), a picture shows, a sound plays.
const ATT_ID = /^att_[0-9A-HJKMNP-TV-Z]{26}$/;
const ATT_URL = /^https:\/\/openvibe\.media\/a\/att_[0-9A-HJKMNP-TV-Z]{26}\/[^?#]{1,300}$/;
// What a comment box with mediaAttachments takes: Media sniffs the bytes, so the list only guides the picker.
const MEDIA_ACCEPT = 'image/*,video/*,audio/*,application/pdf,text/plain,.mkv,.avi,.mov,.m4v,.3gp,.3g2,.webm,.ogv,.wmv,.flv,.mpg,.mpeg,.ts,.mts,.m2ts,.vob,.heic,.heif,.avif';
const MEDIA_NOTE = 'Up to four files: pictures up to 20 MB, videos up to 300 MB (MP4, MOV, MKV, AVI, WebM and the rest), sound up to 50 MB, PDFs and text up to 25 MB.';
const USERNAME = /^[A-Za-z0-9_]{1,32}$/;
const ID = /^\d{1,15}$/;
const safeHttps = (value) => { try { const url = new URL(String(value)); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };
/** One Media composer attachment on a comment: a player, a picture, a sound or a file link (never a URL off openvibe.media). */
function mediaAttachment(a) {
    const url = ATT_URL.test(String(a.url || '')) ? String(a.url) : null;
    if (!url) return '';
    const poster = ATT_URL.test(String(a.poster || '')) ? String(a.poster) : null;
    const type = String(a.media_type || a.mime || '');
    const kind = a.kind || (type.startsWith('video/') ? 'video' : type.startsWith('image/') ? 'image' : type.startsWith('audio/') ? 'audio' : 'file');
    const title = esc(a.name || (kind === 'video' ? 'Video' : kind === 'image' ? 'Picture' : kind === 'audio' ? 'Sound' : 'Attached file'));
    const w = Number(a.width || a.w) || 0, h = Number(a.height || a.h) || 0;
    const size = w > 0 && h > 0 && w <= 10000 && h <= 10000 ? ` width="${Math.round(w)}" height="${Math.round(h)}"` : '';
    if (kind === 'video') {
        const pb = a.playback && a.playback.ready && ATT_URL.test(String(a.playback.url || '')) ? String(a.playback.url) : null;
        const secs = Number(a.duration_s);
        const length = Number.isFinite(secs) && secs > 0 ? `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')}` : '';
        if (!pb) {
            return `<a class="ovc-attach ovc-attach--video is-preparing" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${poster ? `<img src="${esc(poster)}" alt="" loading="lazy"${size}>` : ''}<span>Getting the video ready to play here. Open the file</span></a>`;
        }
        return `<figure class="ovc-attach ovc-attach--video"><video data-ov-player controls preload="none" playsinline src="${esc(pb)}"${poster ? ` poster="${esc(poster)}"` : ''}${size} aria-label="${title}"></video>${length ? `<figcaption>${title} · ${length}</figcaption>` : ''}</figure>`;
    }
    if (kind === 'image') return `<a class="ovc-attach ovc-attach--image" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(poster || url)}" alt="${title}" loading="lazy" width="120"></a>`;
    if (kind === 'audio') return `<figure class="ovc-attach ovc-attach--audio"><audio controls preload="none" src="${esc(url)}" aria-label="${title}"></audio><figcaption>${title}</figcaption></figure>`;
    return `<a class="ovc-attach ovc-attach--file" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${title}</a>`;
}
const author = (c) => c.author || c;
const username = (c) => author(c).username || c.username || '';
const name = (c) => author(c).display_name || c.display_name || username(c) || c.anon_name || 'Member';
// §Z.3: a person's subject (usr_…), the only key a name effect hangs on. Never invented: what the answer carries is what is used.
const OVC_SUBJECT_RE = /^usr_[0-9A-HJKMNP-TV-Z]{26}$/;
const ovcSubjectOf = (c) => {
    if (!c || typeof c !== 'object') return null;
    const a = author(c) || {};
    for (const key of ['subject', 'subject_id', 'user_subject', 'author_subject', 'owner_subject']) {
        const v = a[key] != null ? a[key] : c[key];
        if (typeof v === 'string' && OVC_SUBJECT_RE.test(v)) return v;
        if (v && typeof v === 'object' && typeof v.id === 'string' && OVC_SUBJECT_RE.test(v.id)) return v.id;
    }
    return null;
};
// §Z.3: the name wears its effect, hat and badge. The name text sits in its own span, so the hat stands beside it.
const ovcNameMarkup = (who, words) => {
    const subject = ovcSubjectOf(who);
    return `<span${subject ? ` data-ov-subject="${subject}"` : ''}>${esc(words)}</span>`;
};
// UTC is what the server knows; the reader's own zone and clock replace it in the page (theme-loader's time, 4.248.0).
const date = (iso) => {
    const ms = Date.parse(String(iso || ''));
    if (!Number.isFinite(ms)) return { short: '', full: '' };
    const full = new Date(ms).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
    const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    const unit = seconds < 60 ? ['second', seconds] : seconds < 3600 ? ['minute', Math.floor(seconds / 60)]
        : seconds < 86400 ? ['hour', Math.floor(seconds / 3600)] : seconds < 2592000 ? ['day', Math.floor(seconds / 86400)]
            : seconds < 31536000 ? ['month', Math.floor(seconds / 2592000)] : ['year', Math.floor(seconds / 31536000)];
    return { short: seconds < 60 ? 'just now' : `${unit[1]} ${unit[0]}${unit[1] === 1 ? '' : 's'} ago`, full };
};

function query(base, sort, extra = {}, anchor = 'comments') {
    const q = new URLSearchParams({ sort, ...extra });
    return `${base}${base.includes('?') ? '&' : '?'}${q.toString()}#${anchor}`;
}

/**
 * The inline Community thread a page shows under a thing (Video, Pics, a paste page, /c): the quiet head, the
 * composer or one sign-in line, the comments with their replies, targets and attachments, the order (Top and
 * Newest only when there is something to put in order), More, and the link to the discussion. Server-rendered and
 * complete without script; ov-thread.js and ov-composer.js give the composer its behaviour.
 *   answer: the comment service's answer ({ thread, comments, next_cursor, viewer }), or null for a thread nobody
 *   has commented on;  base: the page's own address (sorting, paging and reply links come back here)
 *   post, remove: where the composer and Delete post;  signedIn: this person may write
 *   attachmentsAllowed: the composer offers files (Community's paste page and Pics say yes; elsewhere no)
 *   mediaAttachments: 4.247.0 (§Z.9), the files go to Media's composer attachments as they are picked (any video,
 *   picture, sound, PDF or text, at Media's limits) and the form carries their ids in `attachments`; only for a post
 *   route that reads that field (Community's, from #439). Without a viewer token the box keeps the plain upload.
 *   draft: the message kept in the box after a failed post
 *   sort, replyId, expandedId, expandedReplies, error: as the page received them
 */
function renderThread({ answer, base, post, remove, signedIn, attachmentsAllowed = true, mediaAttachments = false, sort = 'top', replyId = null, expandedId = null, expandedReplies = null, error = null, draft = '' }) {
    const comments = Array.isArray(answer && answer.comments) ? answer.comments : [];
    const accessId = answer && answer.thread && String(answer.thread.access_id || answer.thread.id || '');
    const threadUrl = safeHttps(answer && answer.thread && answer.thread.url) || (/^cth_[A-Za-z0-9_-]{22}$/.test(accessId) ? `https://openvibe.community/c/${accessId}` : null);
    const validReply = ID.test(String(replyId || '')) ? String(replyId) : null;
    const validExpanded = ID.test(String(expandedId || '')) ? String(expandedId) : null;
    // Signed out, the composer's spot is one line; with no comments yet that line is the whole empty state (no second
    // box saying the same thing).
    const signIn = `<p class="ovc-signin">${comments.length ? 'Sign in to comment.' : 'Be the first to comment.'} <a class="ovk-btn ovk-btn--primary" href="/auth/login?next=${encodeURIComponent(query(base, sort))}">Sign in</a></p>`;
    const composer_html = (parent = null) => signedIn ? composer({ action: post, name: 'message', label: 'Comment', placeholder: parent ? 'Write a reply…' : 'Add a comment…', value: draft, maxlength: 2000,
        sendLabel: parent ? 'Reply' : 'Comment', hidden: parent ? { parent_id: parent } : {},
        attach: attachmentsAllowed ? { name: 'files', accept: mediaAttachments ? MEDIA_ACCEPT : 'image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain' } : null, preset: 'comment',
        note: attachmentsAllowed ? (mediaAttachments ? MEDIA_NOTE : 'Up to four files, 16 MB each. JPEG, PNG, GIF, WebP, PDF or text.') : '',
        attrs: attachmentsAllowed && mediaAttachments ? { 'data-ovc-media': '1', 'data-ovc-max-files': '4' } : {},
    }) : signIn;
    const attachments = (c) => (Array.isArray(c.attachments) ? c.attachments : []).map((a) => {
        if (ATT_ID.test(String(a.id || ''))) return mediaAttachment(a);
        if (!MEDIA_ID.test(String(a.id || ''))) return '';
        const url = `https://openvibe.media/o/${a.id}`;
        const title = esc(a.name || 'Attached file');
        return `<a class="ovc-attach${String(a.media_type || '').startsWith('image/') ? ' ovc-attach--image' : ' ovc-attach--file'}" href="${url}" target="_blank" rel="noopener noreferrer">${String(a.media_type || '').startsWith('image/')
            ? `<img src="${url}" alt="${title}" loading="lazy" width="120">` : title}</a>`;
    }).join('');
    const comment = (c, root = null) => {
        const id = String(c.id);
        if (!ID.test(id)) return '';
        const gone = !!(c.deleted || c.is_deleted);
        const user = username(c);
        const profile = USERNAME.test(user) ? `https://openvibe.network/@${encodeURIComponent(user)}` : null;
        const avatar = safeHttps(author(c).avatar_url || c.avatar_url) || (profile ? `https://openvibe.network/avatar/${encodeURIComponent(user)}?s=80` : null);
        const when = date(c.created_at);
        const targetId = ID.test(String(c.reply_to_id || '')) ? String(c.reply_to_id) : null;
        const topId = root || id;
        const target = targetId && c.reply_to ? `<a class="ovc-target" href="${query(base, sort, { replies: topId }, `comment-${targetId}`)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="14" height="14" style="margin-right:4px;vertical-align:-2px"><path d="M9.2 5.8L4 11l5.1 5.1M4 11h10.3a6.2 6.2 0 0 1 6.2 6.2v1"/></svg>@${ovcNameMarkup(c.reply_to, c.reply_to.display_name || 'Member')}</a>` : '';
        const controls = !gone ? `<div class="ovc-actions">${signedIn ? `<a class="ovk-btn ovk-btn--quiet" href="${query(base, sort, { reply: id }, `comment-${id}`)}" data-ovc-reply="${id}">Reply</a>` : ''}${c.can_delete && signedIn ? `<form method="post" action="${esc(remove)}"><input type="hidden" name="comment_id" value="${id}"><button class="ovk-btn ovk-btn--quiet" type="submit">Delete</button></form>` : ''}</div>` : '';
        let replies = '';
        if (!root) {
            const rows = validExpanded === id && Array.isArray(expandedReplies) ? expandedReplies : (Array.isArray(c.replies) ? c.replies : []);
            const more = Math.max(0, Number(c.reply_count || 0) - rows.length);
            replies = `<div class="ovc-replies" data-ovc-replies="${id}">${rows.map((r) => comment(r, id)).join('')}${more ? `<a class="ovc-more ovk-btn ovk-btn--quiet" data-ovc-more="${id}" href="${query(base, sort, { replies: id })}">${more} more ${more === 1 ? 'reply' : 'replies'}</a>` : ''}</div>`;
        }
        return `<article class="ovc-comment" id="comment-${id}"><header>${avatar ? `<img src="${esc(avatar)}" alt="" width="32" height="32" loading="lazy">` : ''}${profile ? `<a href="${profile}">${ovcNameMarkup(c, name(c))}</a>` : ovcNameMarkup(c, name(c))}${when.short ? `<time datetime="${esc(c.created_at)}" data-ov-time="ago" title="${esc(when.full)}">${esc(when.short)}</time>` : ''}</header>${target}${gone ? '<p>Comment removed</p>' : `<p>${esc(c.message || '')}</p>${attachments(c)}`}${controls}${validReply === id ? `<div data-ovc-composer-slot>${composer_html(id)}</div>` : ''}${replies}</article>`;
    };
    const hasReplySlot = validReply && comments.some((c) => String(c.id) === validReply || (validExpanded === String(c.id) && Array.isArray(expandedReplies) ? expandedReplies : c.replies || []).some((r) => String(r.id) === validReply));
    // Top and Newest only when there is something to put in order.
    const order = comments.length < 2 && !(answer && answer.next_cursor) ? '' : `<nav class="ovc-order" aria-label="Comment order">${[['top', 'Top'], ['new', 'Newest']].map(([key, label]) => `<a class="ovk-btn ovk-btn--quiet${sort === key ? ' is-active' : ''}" href="${query(base, key)}"${sort === key ? ' aria-current="page"' : ''} data-ovc-order>${label}</a>`).join('')}</nav>`;
    const next = answer && answer.next_cursor ? `<a class="ovk-btn ovk-btn--quiet ovc-more" href="${query(base, sort, { after: answer.next_cursor })}" data-ovc-order>More comments</a>` : '';
    return `<section class="ovc-thread" id="comments" data-ovc-thread><div class="ovc-head"><h2>Comments</h2>${order}</div>${error ? `<p role="alert">${esc(error)}</p>` : ''}${!hasReplySlot ? `<div data-ovc-composer-slot>${composer_html()}</div>` : ''}${comments.length ? `<div class="ovc-list">${comments.map((c) => comment(c)).join('')}</div>` : (signedIn ? '<p class="ovc-none">Be the first to comment.</p>' : '')}${next}${threadUrl ? `<p class="ovc-community"><a href="${esc(threadUrl)}">Discuss on OpenVibe.Community</a></p>` : ''}</section>`;
}

/**
 * The whole screen: the sidebar and the conversation (head, the turns or the empty state, the composer). Wrap it in
 * the site's page; on a phone the composer stays at the bottom above the app bar.
 *   panel: a panel() beside the conversation;  main: a plain page in the conversation's place (a site's settings,
 *   agents or usage, drawn in the same frame as its chats), with no composer
 *   center: with no turns yet, the welcome and the composer sit together in the middle of the screen (a start page);
 *   cls: the site's classes on the root
 */
function page({ sidebar: side = '', head: top = '', turns = [], empty = '', composer: comp = '', panel: pan = '', label = 'Conversation', main = null, center = false, cls = '' } = {}) {
    // The kit's sidebar closes on its scrim (kit-web.js); the panel on its own (ov-thread.js).
    const scrim = side && side.includes('data-ovk-sidebar') ? '<div class="ovk-sidebar-scrim" data-ovk-sidebar-scrim hidden></div>' : '';
    const body = main != null ? `<div class="ovt-scroll ovt-page">${main}</div>`
        : `<div class="ovt-scroll">${turns.length ? `<ol class="ovt-thread" data-ovt-thread>${turns.join('')}</ol>` : `<div class="ovt-empty-state">${empty}</div><ol class="ovt-thread" data-ovt-thread></ol>`}</div>
<div class="ovt-dock">${comp}</div>`;
    const classes = ['ovt', pan ? 'has-panel' : '', center && !turns.length && main == null ? 'is-start' : '', cls || ''].filter(Boolean).map(esc).join(' ');
    return `<div class="${classes}" data-ovt>${side}${scrim}<section class="ovt-main" aria-label="${esc(label)}">${top}
${body}</section>${pan ? `${pan}<div class="ovt-panel-scrim" data-ovt-panel-scrim hidden></div>` : ''}</div>`;
}

module.exports = { page, sidebar, head, turn, divider, work, answer, card, panel, composer, renderThread, files, face, group, groupOf, icon, esc };
