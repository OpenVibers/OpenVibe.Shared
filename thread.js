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
 * The chats: New chat, a search box, the groups of links, and a footer of links. A column on a wide screen, a drawer
 * on a phone (opened by the head's menu button).
 *   groups: [{ name, items: [{ href, title, current, live }] }]
 */
function sidebar({ label = 'Your chats', newHref = null, newLabel = 'New chat', find = true, groups = [], empty = 'Your chats show here.', foot = [] } = {}) {
    const list = groups.filter((g) => g && g.items && g.items.length);
    return `<aside class="ovt-side" id="ovt-chats" aria-label="${esc(label)}" data-ovt-side>
<div class="ovt-side-head">${newHref ? `<a class="ovt-new" href="${esc(newHref)}">${icon('plus')}<span>${esc(newLabel)}</span></a>` : ''}<button type="button" class="ovt-side-close" data-ovt-close aria-label="Close the chats" hidden>${icon('close')}</button></div>
${find ? `<label class="ovt-find"><span class="ovt-sr">Find a chat</span><input type="search" placeholder="Find a chat" data-ovt-find autocomplete="off"></label>` : ''}
<nav class="ovt-list">${list.length ? list.map((g) => `<p class="ovt-group">${esc(g.name)}</p><ul>${g.items.map((c) => `<li><a href="${esc(c.href)}"${c.current ? ' aria-current="page"' : ''} data-title="${esc(String(c.title || '').toLowerCase())}">${c.live ? '<span class="ovt-dot" aria-hidden="true"></span>' : ''}<span>${esc(clip(c.title, 80))}</span></a></li>`).join('')}</ul>`).join('') : `<p class="ovt-empty">${esc(empty)}</p>`}</nav>
${foot.length ? `<p class="ovt-side-foot">${foot.map((f) => `<a href="${esc(f.href)}">${esc(f.label)}</a>`).join('')}</p>` : ''}
</aside>
<div class="ovt-scrim" data-ovt-close hidden></div>`;
}

/** The sticky head over the thread: the drawer's button (phones), the title, New chat, and the caller's actions. */
function head({ title = '', newHref = null, menu = true, actions = '' } = {}) {
    return `<header class="ovt-head" data-ovt-head>${menu ? `<button type="button" class="ovt-btn ovt-menu" data-ovt-open aria-controls="ovt-chats" aria-expanded="false" aria-label="Your chats">${icon('menu')}</button>` : ''}<h1 class="ovt-title">${esc(title)}</h1>${actions || ''}${newHref ? `<a class="ovt-btn" href="${esc(newHref)}" aria-label="New chat">${icon('plus')}</a>` : ''}</header>`;
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
 */
function turn({ id = null, state = null, open = false, you = {}, reply = '', avatar = true, attrs = {} } = {}) {
    const extra = Object.entries(attrs || {}).map(([k, v]) => attr(k, v)).join('');
    const mine = you && (you.html != null || you.text != null || (you.files && you.files.length))
        ? `<div class="ovt-you">${files(you.files)}${you.html != null ? `<div class="ovt-bubble">${you.html}</div>` : you.text != null ? `<p class="ovt-bubble">${esc(you.text)}</p>` : ''}</div>` : '';
    return `<li class="ovt-turn${state ? ` state-${esc(state)}` : ''}"${attr('id', id ? `t-${id}` : null)}${attr('data-turn', id)}${attr('data-state', state)}${open ? ' data-open' : ''}${extra}>
${mine}<div class="ovt-bot">${avatar ? '<span class="ovt-avatar" aria-hidden="true"></span>' : ''}<div class="ovt-reply">${reply}</div></div>
</li>`;
}

/**
 * The work, folded under the answer: "Worked for 12 s · 3 tools", or, while it works, the live line ("Reading the
 * page…"), open. rows: [{ kind: 'step' | 'note' | 'you' | 'tool', text, level, name, input, output, ok, running }].
 */
function work({ open = false, live = 'Working', took = null, rows = [] } = {}) {
    const tools = rows.filter((r) => r.kind === 'tool').length;
    if (!open && !rows.length) return '';
    const items = rows.map((r) => {
        if (r.kind === 'tool') {
            const st = r.running || r.ok == null ? 'is-run' : r.ok ? 'is-ok' : 'is-bad';
            return `<li class="ovt-w-tool ${st}"><details><summary>${icon('tool')}<b>${esc(r.name || 'Tool')}</b>${r.input ? `<span class="ovt-w-in">${esc(clip(r.input, 90))}</span>` : ''}<span class="ovt-w-st">${st === 'is-run' ? '<span class="ovt-dot" aria-hidden="true"></span>' : icon(st === 'is-ok' ? 'ok' : 'bad')}</span></summary>
${r.output != null ? `<pre class="ovt-w-out">${esc(clip(r.output, 1500))}</pre>` : '<p class="ovt-w-out ovt-muted">Running…</p>'}</details></li>`;
        }
        if (r.kind === 'you') return `<li class="ovt-w-you">${icon('you')}<p>${esc(clip(r.text, 300))}</p></li>`;
        if (r.kind === 'note') return `<li class="ovt-w-note${r.level ? ` is-${esc(r.level)}` : ''}">${icon('note')}<p>${esc(clip(r.text, 700))}</p></li>`;
        return `<li class="ovt-w-step">${icon('step')}<span>${esc(clip(r.text, 300))}</span></li>`;
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

/** A card in the reply: a question waiting for the person (wait), a failure (bad), or a note (info). html is safe markup. */
function card({ tone = 'info', title = '', text = null, html = '' } = {}) {
    return `<div class="ovt-card is-${esc(tone)}">${title ? `<p><b>${esc(title)}</b>${text != null ? ` ${esc(text)}` : ''}</p>` : text != null ? `<p>${esc(text)}</p>` : ''}${html}</div>`;
}

/**
 * The composer, at the bottom of the screen: a box that grows as you type, the caller's tools (a mode chip, a model
 * chip, attach), and Send, which becomes Stop while a turn works (busy). Works as a plain form without script.
 *   hidden: { parent: 'tsk_…' };  starters: ['Plan a weekend in Lisbon', …] (shown on an empty chat)
 *   top: the site's safe markup above the box (picked files, a problem line);  maxlength: the box's limit
 */
function composer({ action = '', method = 'post', name = 'text', placeholder = 'Message', value = '', busy = false, sendLabel = 'Send', stopAction = null, hidden = {}, tools = '', starters = [], note = '', attach = null, label = 'Message', top = '', maxlength = null } = {}) {
    const hid = Object.entries(hidden || {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');
    return `${starters.length ? `<div class="ovt-starters">${starters.map((s) => `<button type="button" class="ovt-starter" data-ovt-starter="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
<form class="ovt-composer${busy ? ' is-busy' : ''}" method="${esc(method)}" action="${esc(action)}" data-ovt-composer${attach ? ' enctype="multipart/form-data"' : ''}>${hid}
${top || ''}<label class="ovt-sr" for="ovt-text">${esc(label)}</label>
<textarea id="ovt-text" name="${esc(name)}" rows="1" placeholder="${esc(placeholder)}"${maxlength ? ` maxlength="${Number(maxlength) || ''}"` : ''} data-ovt-text${busy ? '' : ' required'}>${esc(value)}</textarea>
<div class="ovt-c-row"><div class="ovt-c-tools">${attach ? `<label class="ovt-btn ovt-attach" title="Attach files">${icon('attach')}<span class="ovt-sr">Attach files</span><input type="file" name="${esc(attach.name || 'files')}"${attach.accept ? ` accept="${esc(attach.accept)}"` : ''} multiple data-ovt-files hidden></label>` : ''}${tools || ''}</div>
${busy && stopAction ? `<button type="submit" class="ovt-stop" formaction="${esc(stopAction)}" formnovalidate data-ovt-stop>${icon('stop')}<span>Stop</span></button>` : ''}<button type="submit" class="ovt-send" data-ovt-send aria-label="${esc(sendLabel)}">${icon('send')}<span class="ovt-sr">${esc(sendLabel)}</span></button></div>
${note ? `<p class="ovt-c-note" data-ovt-note>${esc(note)}</p>` : ''}
</form>`;
}

/**
 * The whole screen: the sidebar and the conversation (head, the turns or the empty state, the composer). Wrap it in
 * the site's page; on a phone the composer stays at the bottom above the app bar.
 */
function page({ sidebar: side = '', head: top = '', turns = [], empty = '', composer: comp = '', label = 'Conversation' } = {}) {
    return `<div class="ovt" data-ovt>${side}<section class="ovt-main" aria-label="${esc(label)}">${top}
<div class="ovt-scroll">${turns.length ? `<ol class="ovt-thread" data-ovt-thread>${turns.join('')}</ol>` : `<div class="ovt-empty-state">${empty}</div><ol class="ovt-thread" data-ovt-thread></ol>`}</div>
<div class="ovt-dock">${comp}</div></section></div>`;
}

module.exports = { page, sidebar, head, turn, work, answer, card, composer, files, group, groupOf, icon, esc };
