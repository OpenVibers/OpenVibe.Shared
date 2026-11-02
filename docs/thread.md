# One conversation UI: `openvibe-shared/thread`

Plan L55 C4. Actor's chat proved the shape (L55 C1–C3). Vibe (openvibe.chat), Codes and the Dock use the same parts,
so a conversation looks and behaves the same on every OpenVibe site.

- **Server:** `require('openvibe-shared/thread')` builds the markup. It is complete without script and every string is
  escaped. A field named `html` is markup the caller already made safe (an answer's rendered Markdown).
- **Look:** `/shared/thread.css`, theme tokens only.
- **Behaviour:** `/shared/ov-thread.js` adds the drawer, the search, the growing composer, Enter to send, Copy, staying
  at the bottom, and the helpers a site streams turns with.

## The parts

| Function | What it draws |
|---|---|
| `page({ sidebar, head, turns, empty, composer })` | The screen: the chats beside the conversation; the composer stays at the bottom |
| `sidebar({ newHref, groups, foot })` | New chat, Find a chat, the chats grouped Today / Yesterday / This week / Earlier, footer links. A column on a wide screen, a drawer on a phone |
| `group(items, whenOf)` | Items, newest first, into those groups |
| `head({ title, newHref, actions })` | The sticky head: the drawer's button (phones), the title, New chat |
| `turn({ id, state, open, you, reply })` | One turn: the person's bubble (with files) and the reply |
| `work({ open, live, took, rows })` | The work folded under the answer: "Worked for 12 s · 3 tools", or the live line while it works |
| `answer({ html, files, sources, meta, actions })` | The answer, its files, its sources as quiet links, and a footer with Copy |
| `card({ tone, title, text, html })` | A question waiting for the person (`wait`), a failure (`bad`), or a note (`info`) |
| `composer({ action, busy, stopAction, attach, tools, starters, note })` | The composer: grows as you type, the site's chips, Send, and Stop while a turn works |

A `rows` entry for `work()` is one of:
- `{ kind: 'step', text }`;
- `{ kind: 'note', text, level }`;
- `{ kind: 'you', text }`, something the person said while it worked;
- `{ kind: 'tool', name, input, output, ok, running }`.

## Streaming

```js
OVThread.add(html);            // append a new turn (a string from thread.turn, or an element)
OVThread.live(id, 'Reading');  // the working turn's live line
OVThread.work(id, rowHtml);    // a row in its work list
OVThread.replace(id, html);    // the finished turn; its answer fades in
```

A site renders those strings on the server (`GET /chat/turn/:id`, as Actor does) or in the page. The helpers keep the
thread at the bottom while the reader is there, and add Copy to new answers and code blocks.

## Rules

- **Nothing spins.** A working turn's avatar and its live line breathe, and `prefers-reduced-motion` stills them.
- **The page scrolls as a whole.** There is no inner scroll box to trap a thumb.
- **The composer works as a plain form.** Without script, Send posts and Stop posts to `stopAction`.
