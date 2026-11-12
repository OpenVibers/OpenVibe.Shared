'use strict';
/**
 * Render Chat messages as a compact room or grouped conversation bubbles.
 *
 *   render(root, { messages, view: 'room' | 'bubbles', me, now, actions, onAction })
 *     actions: the ids to offer on each message ('reply', 'edit', 'react', 'translate', 'copy', 'delete'), or
 *              (message, { mine }) → ids. 'edit' and 'delete' are offered only on your own messages.
 *     onAction(id, message, row): a button was pressed (an 'ovm:action' event with { action, message } also bubbles).
 *   actions(row, ids, { onAction, message }) → the cluster: the same buttons for a row a site draws itself (Live's chat).
 *   edited(textNode, at) → the quiet "edited" word after a message's words, its time as the title.
 *
 * A message's actions are one cluster at its corner (openvibe.design rule 138): shown on hover or focus on a computer,
 * on a tap on a phone, never in the words. "edited" is one quiet word after them, never a line of its own.
 */
const text = (parent, value) => parent.appendChild(document.createTextNode(String(value == null ? '' : value)));
function safeLinkify(node, value) {
    const raw = String(value || ''), re = /https?:\/\/[^\s<>"']+/g;
    let last = 0, match;
    while ((match = re.exec(raw))) {
        if (match.index > last) text(node, raw.slice(last, match.index));
        const a = document.createElement('a'); a.className = 'ovm-link'; a.href = match[0]; a.rel = 'nofollow noopener noreferrer'; a.target = '_blank'; text(a, match[0]); node.appendChild(a);
        last = match.index + match[0].length;
    }
    if (last < raw.length) text(node, raw.slice(last));
}
function timeValue(message) { let raw = String(message.created_at || message.at || '').replace(' ', 'T'); if (raw && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) raw += 'Z'; const d = new Date(raw); return Number.isNaN(d.getTime()) ? null : d; }
function safeAvatar(value) { try { const u = new URL(String(value || '')); return u.protocol === 'https:' && !u.port && u.hostname.toLowerCase() === 'openvibe.media' ? u.href : ''; } catch { return ''; } }
/** A steady hue per person: their name in the room and their initial's circle keep one colour everywhere. */
function hueOf(id) { let x = 7; for (const c of String(id || '')) x = (x * 31 + c.codePointAt(0)) % 360; return x; }
function dayLabel(date, now) {
    const days = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000);
    if (days === 0) return 'Today'; if (days === 1) return 'Yesterday';
    return new Intl.DateTimeFormat(undefined, { weekday: days < 7 ? 'short' : undefined, day: 'numeric', month: 'short' }).format(date);
}
// The actions' icons (24-unit strokes, as the composer's).
const ICON = {
    reply: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z',
    edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
    react: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
    translate: 'M4 5h9M8.5 3v2M6 5c.6 3 2.6 5.5 5.5 7M11 5c-.8 3.6-3.2 6.4-6.5 8M13 21l4-10 4 10M14.5 17.5h5',
    copy: 'M9 9h10v12H9zM5 15V3h10',
    delete: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
};
const LABEL = { reply: 'Reply', edit: 'Edit your message', react: 'React', translate: 'Translate', copy: 'Copy text', delete: 'Delete your message' };
const OWN = new Set(['edit', 'delete']);
function svgIcon(path) {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '16'); s.setAttribute('height', '16'); s.setAttribute('aria-hidden', 'true');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    const p = document.createElementNS(ns, 'path'); p.setAttribute('d', path); s.appendChild(p);
    return s;
}
/** One cluster of icon buttons at a row's corner. A site's own rows (Live's chat) use it too, so every chat matches. */
function actions(row, ids, { onAction = null, message = null, mine = false } = {}) {
    if (!row) return null;
    let box = row.querySelector(':scope > .ovm-actions');
    if (!box) { box = document.createElement('span'); box.className = 'ovm-actions'; row.appendChild(box); }
    box.replaceChildren();
    (ids || []).filter((id) => ICON[id] && (!OWN.has(id) || mine)).forEach((id) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = `ovm-act ovm-act-${id}`; b.dataset.action = id; b.title = LABEL[id]; b.setAttribute('aria-label', LABEL[id]);
        b.appendChild(svgIcon(ICON[id]));
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            row.classList.remove('is-acting');
            if (typeof onAction === 'function') onAction(id, message, row);
            const view = row.ownerDocument && row.ownerDocument.defaultView;
            const CE = (view && view.CustomEvent) || (typeof CustomEvent === 'function' ? CustomEvent : null);
            if (CE) row.dispatchEvent(new CE('ovm:action', { bubbles: true, detail: { action: id, message } }));
        });
        box.appendChild(b);
    });
    row.classList.add('ovm-has-actions');
    if (!box.children.length) { box.remove(); row.classList.remove('ovm-has-actions'); return null; }
    return box;
}
/** "edited": one quiet word right after the words, the time it changed as its title. */
function edited(after, at) {
    if (!after || !after.parentNode) return null;
    let mark = after.nextElementSibling && after.nextElementSibling.classList.contains('ovm-edited') ? after.nextElementSibling : null;
    if (!mark) { mark = document.createElement('small'); mark.className = 'ovm-edited'; after.after(mark); }
    mark.textContent = 'edited';
    const raw = String(at || '');
    const d = raw ? new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw.replace(' ', 'T')) ? raw.replace(' ', 'T') : raw.replace(' ', 'T') + 'Z') : null;
    mark.title = d && !isNaN(d) ? `Edited at ${new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(d)}` : 'Edited';
    return mark;
}
/** A phone has no hover: a tap on a message shows its actions, a tap elsewhere hides them. */
function tapToAct(root) {
    if (!root || root.__ovmTap) return;
    root.__ovmTap = true;
    root.addEventListener('click', (e) => {
        const t = e.target;
        if (!t || !t.closest || t.closest('.ovm-actions')) return;
        const noHover = typeof matchMedia === 'function' && matchMedia('(hover: none)').matches;
        const row = t.closest('.ovm-has-actions');
        root.querySelectorAll('.is-acting').forEach((r) => { if (r !== row) r.classList.remove('is-acting'); });
        if (noHover && row && !t.closest('a, button, input, textarea')) row.classList.toggle('is-acting');
    });
}
function render(root, { messages = [], view = 'room', me = null, now = new Date(), actions: offer = null, onAction = null } = {}) {
    if (!root || !root.ownerDocument) throw new TypeError('A message list element is required');
    if (view !== 'room' && view !== 'bubbles') throw new TypeError('view must be "room" or "bubbles"');
    root.replaceChildren(); root.classList.add('ovm-messages'); root.dataset.view = view;
    let previous = null, activeDay = '';
    messages.forEach((message, index) => {
        const date = timeValue(message), stamp = date ? date.getTime() : 0;
        const day = date ? dayLabel(date, now) : '';
        if (view === 'bubbles' && day && day !== activeDay) { const separator = document.createElement('li'); separator.className = 'ovm-day'; text(separator, day); root.appendChild(separator); activeDay = day; }
        const sender = String(message.sender_id || message.user_id || message.from || message.username || '');
        const mine = me != null && String(message.sender_id || message.user_id || '') === String(me);
        const same = previous && sender === previous.sender && stamp && previous.stamp && stamp - previous.stamp >= 0 && stamp - previous.stamp <= 180000;
        if (view === 'room') {
            const row = document.createElement('li'); row.className = 'ovm-room'; row.dataset.id = String(message.id || '');
            const time = document.createElement('time'); if (date) { time.dateTime = date.toISOString(); text(time, new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date)); } row.appendChild(time);
            const author = document.createElement('span'); author.className = 'ovm-room-author'; author.style.setProperty('--ovm-h', String(hueOf(sender))); text(author, message.display_name || message.username || 'Someone'); row.appendChild(author);
            const body = document.createElement('span'); body.className = 'ovm-room-text'; safeLinkify(body, message.message || message.text); row.appendChild(body); root.appendChild(row);
            if (message.edited_at) edited(body, message.edited_at);
            const ids = typeof offer === 'function' ? offer(message, { mine }) : offer;
            if (ids && ids.length) actions(row, ids, { onAction, message, mine });
        } else {
            const group = document.createElement('li'); group.className = 'ovm-group'; group.dataset.id = String(message.id || ''); group.dataset.mine = String(mine); group.dataset.tail = String(!messages[index + 1] || String(messages[index + 1].sender_id || messages[index + 1].user_id || messages[index + 1].from || messages[index + 1].username || '') !== sender);
            if (same) group.dataset.continued = 'true';
            if (!mine && !same && safeAvatar(message.avatar_url)) { const avatar = document.createElement('img'); avatar.className = 'ovm-avatar'; avatar.alt = ''; avatar.loading = 'lazy'; avatar.referrerPolicy = 'no-referrer'; avatar.src = safeAvatar(message.avatar_url); group.appendChild(avatar); }
            else if (!mine && !same) { const spacer = document.createElement('span'); spacer.className = 'ovm-avatar is-initial'; spacer.setAttribute('aria-hidden', 'true'); spacer.style.setProperty('--ovm-h', String(hueOf(sender))); text(spacer, String(message.display_name || message.username || '?').trim().charAt(0).toUpperCase()); group.appendChild(spacer); }
            else if (!mine) { const gap = document.createElement('span'); gap.className = 'ovm-avatar is-gap'; gap.setAttribute('aria-hidden', 'true'); group.appendChild(gap); }   // a run keeps the avatar's column
            const body = document.createElement('div'); body.className = 'ovm-group-body';
            if (!mine && !same) { const author = document.createElement('div'); author.className = 'ovm-author'; text(author, message.display_name || message.username || 'Someone'); body.appendChild(author); }
            const bubble = document.createElement('div'); bubble.className = 'ovm-bubble';
            if (message.reply_to) { const quote = document.createElement('span'); quote.className = 'ovm-reply'; text(quote, message.reply_to.message || message.reply_to.text || 'Reply'); bubble.appendChild(quote); }
            const content = document.createElement('span'); content.className = 'ovm-text'; const value = String(message.message || message.text || '');
            if (/^(?:\p{Extended_Pictographic}|\s)+$/u.test(value) && value.trim()) bubble.classList.add('ovm-emoji-only');
            safeLinkify(content, value); bubble.appendChild(content); body.appendChild(bubble);
            if (message.edited_at) edited(content, message.edited_at);
            const ids = typeof offer === 'function' ? offer(message, { mine }) : offer;
            if (ids && ids.length) actions(bubble, ids, { onAction, message, mine });
            if (!messages[index + 1] || String(messages[index + 1].sender_id || messages[index + 1].user_id || messages[index + 1].from || messages[index + 1].username || '') !== sender || !stamp || !timeValue(messages[index + 1]) || timeValue(messages[index + 1]).getTime() - stamp > 180000) {
                const meta = document.createElement('div'); meta.className = 'ovm-meta'; const time = document.createElement('time'); if (date) { time.dateTime = date.toISOString(); text(time, new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)); } meta.appendChild(time);
                if (mine && message.read) { const tick = document.createElement('span'); tick.className = 'ovm-tick'; tick.setAttribute('aria-label', 'Read'); text(tick, '✓✓'); meta.appendChild(tick); }
                body.appendChild(meta);
            }
            group.appendChild(body); root.appendChild(group);
        }
        previous = { sender, stamp };
    });
    if (offer) tapToAct(root);
    return root;
}
const api = { render, actions, edited, tapToAct };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') {
    window.OVMessages = api;
    const ov = window.ov = window.ov || {};
    ov.chat = ov.chat || {};
    ov.chat.messages = api;
}
