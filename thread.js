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
 * Draw with kit.css and kit-web.js beside thread.css and ov-thread.js.
 */
function sidebar({ id = 'ovt-chats', label = 'Your chats', newHref = null, newLabel = 'New chat', find = true, findAction = '', findPlaceholder = 'Find a chat', groups = [], pinned = [], empty = 'Your chats show here.', nav = [], foot = [] } = {}) {
    const item = (c) => ({ href: c.href, label: clip(c.title, 80), here: !!c.current, dot: c.dot || (c.live ? 'busy' : null), meta: c.dot || c.live ? '' : (c.meta || ''), mark: c.mark || '' });
    const sections = [
        ...(pinned && pinned.length ? [{ title: 'Pinned', items: pinned.map(item) }] : []),
        ...groups.filter((g) => g && g.items && g.items.length).map((g) => ({ title: g.name, items: g.items.map(item) })),
    ];
    return kit.sidebar({
        id, label,
        action: newHref ? { href: newHref, label: newLabel, icon: 'plus' } : null,
        find: find ? { action: findAction || newHref || '', name: 'q', placeholder: findPlaceholder, label: findPlaceholder } : null,
        nav,
        sections: sections.length ? sections : [{ title: '', items: [], empty }],
        foot: foot.length ? `<p class="ovt-side-foot">${foot.map((f) => `<a href="${esc(f.href)}">${esc(f.label)}</a>`).join('')}</p>` : '',
    });
}

/**
 * The sticky head over the thread: the button that opens the chats on a phone (kit.sidebarButton), the title, New chat,
 * and the caller's actions. `sidebar` names the sidebar's id (false for none). `panel` names a panel()'s id: a button
 * that opens it where it is a drawer (below 1180 px), labelled `panelLabel`.
 */
function head({ title = '', newHref = null, sidebar: sid = 'ovt-chats', sidebarLabel = 'Your chats', actions = '', panel: pid = null, panelLabel = 'Details' } = {}) {
    const panelBtn = pid ? `<button type="button" class="ovt-btn ovt-panel-open" data-ovt-panel-open aria-controls="${esc(pid)}" aria-expanded="false" aria-label="${esc(panelLabel)}" title="${esc(panelLabel)}">${icon('panel')}</button>` : '';
    return `<header class="ovt-head" data-ovt-head>${sid ? kit.sidebarButton({ id: sid, label: sidebarLabel }) : ''}<h1 class="ovt-title">${esc(title)}</h1>${actions || ''}${newHref ? `<a class="ovt-btn" href="${esc(newHref)}" aria-label="New chat">${icon('plus')}</a>` : ''}${panelBtn}</header>`;
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
 * is a plain row, with nothing to open.
 */
function work({ open = false, live = 'Working', took = null, rows = [] } = {}) {
    const tools = rows.filter((r) => r.kind === 'tool').length;
    if (!open && !rows.length) return '';
    const items = rows.map((r) => {
        if (r.kind === 'tool') {
            const st = r.running || r.ok == null ? 'is-run' : r.ok ? 'is-ok' : 'is-bad';
            const head = `${icon(r.icon || 'tool')}<b>${esc(r.name || 'Tool')}</b>${r.input ? `<span class="ovt-w-in">${esc(clip(r.input, 90))}</span>` : ''}<span class="ovt-w-st">${st === 'is-run' ? '<span class="ovt-dot" aria-hidden="true"></span>' : icon(st === 'is-ok' ? 'ok' : 'bad')}</span>`;
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
        copy ? `<button type="button" class="ovt-act" data-ovt-copy hidden>${icon('copy')}<span>Copy</span></button>` : '',
        ...actions.map((a) => `<a class="ovt-act" href="${esc(a.href)}">${icon(a.icon || 'more')}<span>${esc(a.label)}</span></a>`),
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
 *   sections: [{ title, html, rows: [{ who, icon, title, sub, html }] }]; a row's who draws an agent's face (turn's who),
 *   icon a thread icon; html is the caller's safe markup in place of title and sub.
 */
function panel({ id = 'ovt-panel', title = 'Details', sections = [] } = {}) {
    const row = (r) => `<li>${r.who ? face(r.who) : r.icon ? icon(r.icon) : ''}<span>${r.html != null ? r.html : `<b>${esc(r.title || '')}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}`}</span></li>`;
    const secs = sections.filter(Boolean).map((s) => `<section class="ovt-panel-sec">${s.title ? `<h3>${esc(s.title)}</h3>` : ''}${s.rows && s.rows.length ? `<ul class="ovt-panel-rows">${s.rows.map(row).join('')}</ul>` : ''}${s.html || ''}</section>`).join('');
    return `<aside class="ovt-panel" id="${esc(id)}" aria-label="${esc(title)}" data-ovt-panel><div class="ovt-panel-head"><h2>${esc(title)}</h2><button type="button" class="ovt-btn ovt-panel-close" data-ovt-panel-close aria-label="Close">${icon('close')}</button></div>${secs}</aside>`;
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
 */
function composer({ action = '', method = 'post', name = 'text', placeholder = 'Message', value = '', busy = false, sendLabel = 'Send', stopAction = null, hidden = {}, tools = '', starters = [], note = '', attach = null, label = 'Message', top = '', maxlength = null, id = null, attrs = {}, foot = '' } = {}) {
    const extra = Object.entries(attrs || {}).map(([k, v]) => attr(k, v)).join('');
    const hid = Object.entries(hidden || {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');
    return `${starters.length ? `<div class="ovt-starters">${starters.map((s) => `<button type="button" class="ovt-starter" data-ovt-starter="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
<form class="ovt-composer${busy ? ' is-busy' : ''}"${attr('id', id)} method="${esc(method)}" action="${esc(action)}" data-ovt-composer${attach ? ' enctype="multipart/form-data"' : ''}${extra}>${hid}
${top || ''}<label class="ovt-sr" for="ovt-text">${esc(label)}</label>
<textarea id="ovt-text" name="${esc(name)}" rows="1" placeholder="${esc(placeholder)}"${maxlength ? ` maxlength="${Number(maxlength) || ''}"` : ''} data-ovt-text${busy ? '' : ' required'}>${esc(value)}</textarea>
<div class="ovt-c-row"><div class="ovt-c-tools">${attach ? `<label class="ovt-btn ovt-attach" title="Attach files">${icon('attach')}<span class="ovt-sr">Attach files</span><input type="file" name="${esc(attach.name || 'files')}"${attach.accept ? ` accept="${esc(attach.accept)}"` : ''} multiple data-ovt-files hidden></label>` : ''}${tools || ''}</div>
${stopAction != null ? `<button type="submit" class="ovt-stop"${stopAction ? ` formaction="${esc(stopAction)}" formnovalidate` : ''}${busy && stopAction ? '' : ' hidden'} data-ovt-stop>${icon('stop')}<span>Stop</span></button>` : ''}<button type="submit" class="ovt-send" data-ovt-send aria-label="${esc(sendLabel)}">${icon('send')}<span class="ovt-sr">${esc(sendLabel)}</span></button></div>
${foot || ''}<p class="ovt-c-note" data-ovt-note role="status">${esc(note || '')}</p>
</form>`;
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

module.exports = { page, sidebar, head, turn, divider, work, answer, card, panel, composer, files, face, group, groupOf, icon, esc };
