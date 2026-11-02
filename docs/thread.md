# One conversation UI: `openvibe-shared/thread`

Plan L55 C4. Actor's chat proved the shape (L55 C1–C3). Vibe (openvibe.chat), Codes and the Dock use the same parts,
so a conversation looks and behaves the same on every OpenVibe site.

- **Server:** `require('openvibe-shared/thread')` builds the markup. It is complete without script and every string is
  escaped. A field named `html` is markup the caller already made safe (an answer's rendered Markdown).
- **Look:** `/shared/thread.css`, theme tokens only. The chats are the network's one sidebar (`kit.sidebar`), so a
  page also loads `/shared/kit.css` and `/shared/kit-web.js` (4.97.0).
- **Behaviour:** `/shared/ov-thread.js` adds the drawer, the search, the growing composer, Enter to send, Copy, staying
  at the bottom, and the helpers a site streams turns with.

## The parts

| Function | What it draws |
|---|---|
| `page({ sidebar, head, turns, empty, composer, panel, main, center, cls })` | The screen: the chats beside the conversation; the composer stays at the bottom. `panel` goes beside it; `main` is a plain page in the conversation's place; `center` puts the welcome and the composer together in the middle while there are no turns |
| `sidebar({ newHref, groups, pinned, nav, foot })` | New chat, Find a chat, pinned chats, the chats grouped Today / Yesterday / This week / Earlier, footer links. A column on a wide screen, a drawer on a phone |
| `group(items, whenOf)` | Items, newest first, into those groups |
| `head({ title, newHref, actions, panel })` | The sticky head: the drawer's button (phones), the title, New chat, and the panel's button where the panel is a drawer |
| `turn({ id, state, open, you, reply, who })` | One turn: the person's bubble (with files and a caption) and the reply. `who` heads the reply with an agent's face and name |
| `divider({ text, icon })` | A line across the thread: a hand-over to another agent, a wait |
| `work({ open, live, took, rows })` | The work folded under the answer: "Worked for 12 s · 3 tools", or the live line while it works. A row can carry an `icon` |
| `answer({ html, files, sources, meta, actions })` | The answer, its files, its sources as quiet links, and a footer with Copy |
| `card({ tone, title, text, html, icon, code, form })` | A question waiting for the person (`wait`), a failure (`bad`), or a note (`info`). With `form` it asks, and posts without script (an approval: Allow or Deny) |
| `panel({ id, title, sections })` | What the work produced, beside the conversation: a third column from 1180 px, a drawer from the right below |
| `composer({ action, busy, stopAction, attach, tools, starters, note, id, attrs, foot })` | The composer: grows as you type, the site's chips, Send, and Stop while a turn works. `foot` is markup under the bar; the note line is its status line |

A `rows` entry for `work()` is one of:
- `{ kind: 'step', text }`;
- `{ kind: 'note', text, level }`;
- `{ kind: 'you', text }`, something the person said while it worked;
- `{ kind: 'tool', name, input, output, ok, running, icon }`. A finished tool with no output is a plain row.

A row's `icon` is one of the thread's icons: a coding agent's `read`, `find`, `edit`, `run`, `web` and `sub`, or `tool`.

## Several agents, approvals and the panel (4.99.0)

Codes hands a task from one agent to another inside one conversation. These parts show that:

```js
thread.turn({ who: { name: 'Codex', initials: 'Cx', color: '#10a37f', sub: 'gpt-5 · Thorough' }, reply });
thread.divider({ text: 'Codex took over: Claude Code ran out of turns' });
thread.card({ tone: 'wait', icon: 'shield', title: 'Bash', text: 'wants to run', code: 'npm test',
    form: { action: '/tasks/1/approvals/9', buttons: [{ name: 'decision', value: 'allow', label: 'Allow' },
        { name: 'decision', value: 'deny', label: 'Deny', quiet: true }] } });
thread.page({ sidebar, head: thread.head({ title, panel: 'side', panelLabel: 'What it did' }), turns, composer,
    panel: thread.panel({ id: 'side', title: 'What it did', sections: [{ title: 'Agents', rows: [{ who, title, sub }] }] }) });
```

- **Colours:** an agent's colour is only ever a colour: `#rgb` to `#rrggbbaa`, or a theme token (`var(--accent)`).
  Anything else is dropped.
- **The panel:**
  - it is a column from 1180 px;
  - below that, the head's button opens it as a drawer from the right;
  - its scrim, its close button and Escape close it, and the focus returns to the button.

## Streaming

```js
OVThread.add(html);            // append a new turn (a string from thread.turn, or an element)
OVThread.live(id, 'Reading');  // the working turn's live line
OVThread.work(id, rowHtml);    // a row in its work list
OVThread.replace(id, html);    // the finished turn; its answer types in, word by word
OVThread.reveal(answerEl);     // the same reveal, for an answer a site draws itself
OVThread.tool(id, { name: 'Bash', input: 'npm test', icon: 'run', key });  // a running tool row, built from text
OVThread.toolDone(id, ok, key);  // that tool's row finished (key: the tool call's id); false: it failed, null: no result
```

A site renders those strings on the server (`GET /chat/turn/:id`, as Actor does) or in the page. The helpers keep the
thread at the bottom while the reader is there, and add Copy to new answers and code blocks.

## Rules

- **Nothing spins.** A working turn's avatar and its live line breathe, and `prefers-reduced-motion` stills them.
- **The page scrolls as a whole.** There is no inner scroll box to trap a thumb.
- **The composer works as a plain form.** Without script, Send posts and Stop posts to `stopAction`.
