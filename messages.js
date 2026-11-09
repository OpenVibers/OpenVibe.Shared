'use strict';
/** Render Chat messages as a compact room or grouped conversation bubbles. */
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
function render(root, { messages = [], view = 'room', me = null, now = new Date() } = {}) {
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
            if (!messages[index + 1] || String(messages[index + 1].sender_id || messages[index + 1].user_id || messages[index + 1].from || messages[index + 1].username || '') !== sender || !stamp || !timeValue(messages[index + 1]) || timeValue(messages[index + 1]).getTime() - stamp > 180000) {
                const meta = document.createElement('div'); meta.className = 'ovm-meta'; const time = document.createElement('time'); if (date) { time.dateTime = date.toISOString(); text(time, new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)); } meta.appendChild(time);
                if (mine && message.read) { const tick = document.createElement('span'); tick.className = 'ovm-tick'; tick.setAttribute('aria-label', 'Read'); text(tick, '✓✓'); meta.appendChild(tick); }
                body.appendChild(meta);
            }
            group.appendChild(body); root.appendChild(group);
        }
        previous = { sender, stamp };
    });
    return root;
}
const api = { render };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') {
    window.OVMessages = api;
    const ov = window.ov = window.ov || {};
    ov.chat = ov.chat || {};
    ov.chat.messages = api;
}
