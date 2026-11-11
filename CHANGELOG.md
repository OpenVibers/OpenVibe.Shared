# Changelog

## 4.212.0 — 2026-11-11

A train of four pull requests (one line each):

- **A carried Live player can play on any OpenVibe page that permits Network frames.** The portable card keeps the
  original Live embed and channel addresses in its state, while its iframe loads Network's narrow Live player bridge;
  sound controls and state events pass through that frame, so no destination's frame policy changes (#473, ask 360).
- **The bar catches up on balance changes across sites (ask 273).** Once a signed-in wallet loads, its pill plays each
  currency's net gain or loss once and marks that currency's cursor read through Network's frame relay; Calm keeps one
  quiet effect, Motion Off updates the figures only. The Wallet sheet starts with the recent net amounts and the API's
  plain reason names (#474).
- **The Dock's pill stands above a page's bottom composer.** bottom.js measures a composer docked at the bottom of the
  screen (`form[data-ovt-composer]` or `data-ov-bottom-dock`) and writes `--ovb-composer`; the pill keeps above it as
  it grows and comes back when it goes (on openvibe.chat it covered the send button) (#475).
- **Glyphs: focus and bridge redrawn** after the all-glyph review: focus is a viewfinder round its centre, bridge two
  towers, the cable and the deck; both have solid twins, drawn to the set's size (the long side 0.79 of the box);
  the drop-in, sprite and fonts are rebuilt (#476).

## 4.215.0 — 2026-11-11

- **One inline comment thread for every site: `thread.renderThread` and `thread-inline.css` (new), beside the
  composer.** MediaHub's Video and Pics item pages and Community's paste and `/c` pages rendered two copies of the
  same thread; the renderer now lives in `openvibe-shared/thread`, with both sites' options:
  `attachmentsAllowed` (Pics and a paste page offer files; elsewhere the composer does not) and `draft` (the message
  kept after a failed post). It draws the quiet head, Top and Newest only when there is something to order, the
  composer or one sign-in line (the whole empty state when nobody has commented), the comments with their replies,
  targets, deletions and attachments, More, and the discussion link. The markup is byte-for-byte what the two sites
  render; each keeps its own post, delete and sign-in routes. The stylesheet is served like the package's other CSS
  (`/shared/thread-inline.css?v=<content hash>`, `files.js` STYLES), so a site pins one look. Both sites' renderer
  tests are here; MediaHub and Community delete their copies and pin this release.

## 4.211.0 — 2026-11-11

- **The menu's You tab leads with you (ask 158b, "the You tab still sucks").** Its notifications are a preview of the
  newest three, with no search, filters, foot or Load more until "Show all N" opens the whole list in place; the
  person's bar, their AI and the rest are a glance below instead of a thousand pixels down. The person's name and handle
  wrap instead of being cut (rule names-are-never-cut).
- **An agent's sheet (agent-sheet.js, new; the Dock's Actor row opens it).** One window (ov-window.js: a panel beside
  the row on a computer, a sheet on a phone) with everything about one agent: its face, state and instructions, then
  Now, Asks (first when it waits for you, with the count), Work, Schedule, Memory and Computer as tabs (arrow keys move
  between them), each with its own words when empty; the mark's wait while it reads and Retry when a read fails. Data:
  Contracts actor.agent-sheet@1 / codes.agent-sheet@1 through Network's relay (/api/frame/agents/:id/sheet,
  /api/frame/codes-agents/:id/sheet) with the bearer, no cookies; all text, never markup.
  `OVAgentSheet.open({ kind, id, name, token, frameBase, base, from, openHref })`. The row used to leave for the
  Actor's page; that page is the sheet's Open now (a modified click still goes straight there).
- **A composer's count shows only near its limit (ov-composer.js).** The last 15% of the box, at most 200 and at least
  20 characters: a 120-character search box said "120 left" while it was empty (Exchange's /models).

## 4.210.0 — 2026-11-11

- **A page's title and its line wrap before they are cut (kit.css `.ovk-head`).** The title takes up to two lines and
  its line up to three, instead of one line each with an ellipsis (the Arena's "One prompt, two models, side b…" on a
  phone). openvibe.design rule names-are-never-cut.

## 4.209.0 — 2026-11-11

**The Quest guide on any page, and the current Live step in the Dock's agent view.**

- **The Quest guide for browser pages (#464).** Pages can start the Quest guide from an opaque `qstep` link once the host
  resolves the step; it waits for late controls and checks the Events-backed completion read, and the shared navbar
  starts it from its own sign-in.
- **The Dock's agent view shows the current Live step (#466)** when the stream supplies one; older streams keep showing
  the task without a step line.

## 4.208.0 — 2026-11-11

**One move engine for every floating thing: the picture-in-picture's drag, flick, tuck, pinch, corner and place, now
shared and adopted by the window.**

- **`ov-float.js`.** `OVFloat.attach(el, { frame, key, defaults, aspect, minPx, onChange })` gives any box Live's
  picture-in-picture behaviour: docked in its frame or fixed over the page, the lift on the first move, a transform
  each animation frame, the FLIP landing with the spring, a flick, edge snapping, the tuck into a side with its tab,
  pinch and corner sizing, a double tap, the keyboard (arrows, + −, T, F, Home), fullscreen, reduced motion, and its
  place as fractions of its frame. The place is kept in localStorage by `key` and in the account through
  `OVFloat.store` (`GET`/`PATCH /api/me/layout`, the `pip` map); `OVFloat.layout()` and the `ov:float` event say where
  every box is. Its behaviour CSS is injected once; a component keeps its own look.
- **A panel window moves, tucks and keeps its place (`ov-window.js`).** A panel's head is an OVFloat handle: drag it
  anywhere, flick it, throw it past a side to tuck it with a tab, and it opens where it was left. The absolute place
  older releases wrote stays readable, and the size the corner grip keeps is unchanged.
- **Live's picture-in-picture uses it (`stream-pip.js`, in the Live release).** The viewer sessions, waits and
  actions stay Live's; the move, tuck, size, keyboard and persistence are the shared engine's.

## 4.206.0 — 2026-11-11

**The menu keeps a stream playing, the Feed in the menu is searchable with the one composer at its top, and a Code task
opens in the Dock's step card.**

- **The menu no longer pauses what is playing (#461, ask 360).** Opening the menu on a phone left live video and audio
  paused under it; the sheet now leaves media alone and the page can read the player's state.
- **The Feed in the menu (#463, ask 360).** Feed search uses Community's search and examples through Network, with
  loaded-card filtering when search is unavailable; the example searches are chips that fill the field. The Feed's
  post form is the one composer (OpenVibeComposer: files, paste, drop, commands, drafts, settings); each picture needs a
  description and other files upload to Media. Its + and the example chips carry their own styles in the menu (they
  drew as bare browser buttons in the PR's screenshots).
- **Chat and Vibe (#463).** The Chat summary's Vibe row is an accessible Open Vibe button that selects the menu's Vibe
  tab; on a desktop Chat and Vibe open the Dock after the menu closes, and the Dock opens from its pill only when that
  pill is visible.
- **A Code task in the Dock (#465, ask 354).** The Dock's Code card shows the task's live steps with the AG-UI step view
  (agent-session.js card mode) and opens the whole run.

## 4.205.0 — 2026-11-11

**Agents show their work everywhere: the one step view reads AG-UI, compact like the portal, with the one composer to
talk to the run; and every site's first HTML is crawlable.**

- **The step view reads AG-UI 1.0 (`agent-session.js`, protocol 1.2, ask 354).** Run, step, text, tool call,
  reasoning, state, activity and custom events, with OpenVibe's words in `metadata.ov` (title, kind, sources): phases
  with a plan row ("1 of 3"), steps under the agent's own titles (rows under one title show their own target), thinking
  folded to one line, sources gathered in one strip (site tiles, https links), text streamed in place.
- **Compact runs.** A group is one line (its state, its words, the step it is on in mono, the chevron), the head says
  what it is doing now, three dots while it works; `mount(el, { mode: 'card', href })` for a chat message, the Dock or
  a feed card.
- **Talk to the run with the one composer.** `mount(el, { onSend(text, { files, uploads }) })`: the shared composer's
  markup ("+" for files, paste and drop, "/" commands, voice, drafts, settings), loaded from beside the view.
- **The composer on any page (`ov-composer.js`).** `clear()` and `uploads()` for boxes sent by script, a form reset
  clears it, and it styles its own tool buttons and row, so it looks the same without thread.css.
- **`openvibe-shared/crawlable` (was #457).** Static navigation, the network's sites by group, JSON-LD and llms.txt for
  the HTML a site sends before its scripts run.

## 4.204.0 — 2026-11-11

**Buttons that show their state, windows that resize, the one composer everywhere, players that start sooner, and one
place for the network's CSP.**

- **Buttons that show what they do and what is happening (`kit.css`, `kit.js`, `kit-web.js`).** Kinds by importance
  (hero, soft, live beside primary, quiet, ghost, danger); a count badge, a status dot, a toggle's fill, a progress
  fill; attention (the one next step glows now and then); busy → a check, or a shake and red
  (`OpenVibeKitWeb.busy()`); hold-to-confirm for destructive buttons; icons that move by meaning. Every motion follows
  the motion setting. docs/kit.md#buttons.
- **A panel window can be resized (`ov-window.js`).** `resizable: true` adds a corner grip that a mouse, a finger or
  a pen drags and the arrow keys move; the size is kept with the place per id.
- **The composer carries its own look, and Vibe's Dock box is the same composer (`ov-composer.js`, `dock-vibe.js`).**
  Its styles moved out of `thread.css` into the script; Vibe's box gets drafts, "/" commands, the marks and settings,
  with `data-ovc-no-files` keeping its picture upload its own. (Was #458, never released.)
- **Players start sooner (`player.js`, #454).** The poster stays until a frame is presented; preload follows the
  connection; battery-aware HLS attachment with a low first rung. docs/player-startup.md.
- **No more macOS flakes from fixed sleeps (tests).** A browser test now checks the page with `eventually()` from
  browser-harness (it retries until the page is there, 5 s at most) instead of after a guessed sleep: 382 checks in 26
  files, including menu-places-chrome, whose 180 ms sleep against a 140 ms debounce failed on the slow macOS runners
  and held back 4.202.0 and 4.203.0. `test/fixed-waits.test.js` keeps the count of sleep-then-check places at zero.
- **`openvibe-shared/csp` (#455).** One place for the network's Content-Security-Policy pieces; `connectSources()`
  names Media, the composer's upload origin.

## 4.203.0 — 2026-11-11

- Dock conversations update edited messages and link cards live; authors can edit their own messages.

## 4.202.0 — 2026-11-11

**One field dropdown, one window for small interfaces, one user card, a measured page end, eight site groups, and the reveal remade.**

- **An empty footer column is never drawn (`footer.js`).** A group with no heading or no links is left out instead of
  showing as an untitled "0 links" fold.
- **One field dropdown (#447).** `ov-combo.js` adds async, grouped suggestions and optional creation; the composer handoff to Code and whole site names in the phone menu are included.
- **One window (#451).** `ov-window.js` supplies dialog, sheet and panel modes, and the composer's settings use it.
- **One user card (#452).** Shared mention hooks, the profile card, wallet window and display style settings.
- **Page end (#442).** A shared bottom measurement keeps the end of a page at 32 px on computer and 24 px on phone.
- **Eight site groups (#445).** The footer, rooms, You folders and home pages use the same groups.
- **Reveal (#448).** Headings emerge from blur, rules draw, and up to six cards stagger as they enter view.
- **Jump back in (#412).** The full history link and private history support are present from the 4.201.0 base.

## 4.201.0 — 2026-11-10

**Notifications move into the one menu; the mark and the name are one button; one composer and Code on every site.**
From the owner's notes of 2026-11-10 (asks 334 to 350).

- **The one menu's look (`search.js`).** Vibe's three parts (Chat, Code, Agents) sit in one row on a phone. Notifications
  in You have a head: their name, the red "n new", and Show all in the head instead of a dashed box under the list. The
  Timer under Vibe and the Dock's actions in You are rows with a glyph, not dashed folds.
- **Notifications in You, no bell in the bar (`navbar.js`, `search.js`, `notification-ui.js`).** The bar's bell is
  gone: the signed-in picture wears the red unread count, and pressing it opens the menu's You at Notifications, on
  phones and computers alike (the menu's You tab wears the red count too). The notification read/unread
  BroadcastChannel keeps open tabs in sync. Feed keeps its calm new count and live dot, now synced across same-origin
  tabs by BroadcastChannel and the storage event; the menu button shows the Feed indicator too. Messages and Vibe stay
  inside the menu on phones and open the floating Dock on computers. The pressed bar button still flies into its tab
  (`OpenVibeSearch.open({ from })`, 4.200.0's flight kept whole). The menu's feed counts are the server half's
  (Network #790).
- **A picture that cannot show becomes its initial (`footer.js`, ask 345).** Any `img[data-ov-initial]` that fails is
  replaced by its initial (a capture listener plus a sweep for early failures; CSP-safe). Footer faces and the
  account picture carry it: openvibe.locker's footer showed a broken avatar where five sites' `img-src` omit
  openvibe.media.
- **The player on a phone (`player.js`, `player.css`, ask 288).** The phone rules lost to the bar's sizing block later
  in the file, so at 390 px the row ran ~50 px off screen. A last-in-file phone block: speed and PiP out, a 64 px
  slider, mute alone under 380 px, position alone under 360 px (the length is now its own span). 1280 px unchanged.
- **The quest card module (`quest.js`, `quest.css`, `guide.js`).** The daily quest card from OpenVibe.Live's finished
  design, as a component any site can mount: `OpenVibeQuest.mount(host, { load })` returns `{ refresh, el }`, with the
  site fetching the quest shape its own way under the person's Network token. Signed out, `1 OF 3` with the streak
  chip, `DONE`; the next step marked, done steps checked. Scoped to `ovq-`, on the kit's tokens.
- **Soft pages (`soft.js`).** Prefetch on intent (pointer down, or 80 ms of hover on a computer; never on Save-Data or
  2G/3G, at most four in flight, never auth, posts, downloads, queries, anchors or `data-ov-no-prefetch`), a
  conservative prefetch-only speculation rule in Chrome/Edge, `OVMark.navStart('page')` on the press finished by the
  arriving page at first paint, and cross-document view transitions where they exist (the shared bar held still, the
  rest cross-fading 180 ms; Calm 120 ms; Off none). One opt-in line after `theme-loader.js`; not loaded by
  `navbar.js`, so a site that does not opt in is unchanged. `window.OpenVibeSoft = { on(), off(), exclude() }`.
- **Updates (`shipped.js`, ask 341).** The filter chips ask the feed with `kind=` and carry their totals; Improved has
  no tag; empty kinds say so; commit hashes open on git.openvibe.codes.
- **Icon ink normalised (`glyphs.js`, `nav-icons.js`, `kit.js`, `ov-glyphs.*`).** 666 drawings normalised to a 0.79
  ink-size target; app tiles use a 0.58 painted-ink fraction and the old oversized tile rule is gone. Measured in
  headless Chrome at 96 px (painted ink bounds in `test/fixtures/icon-ink.json`), within 3% centre and 4% size.
- **The Dock's browser test runs in two halves (`test/dock-chrome.test.js`,
  `test/dock-vibe-timer-chrome.test.js`).** The whole file took about 65 s and the runner stops a file at 60 s, so it
  timed out on the slower macOS machines. Its sections each open a fresh page: the first file runs the first half
  (`DOCK_CHROME_PART` 1, the default), the new second file sets it to 2; 0 runs both.
- **The mark and the name are one button (`navbar.js`, `ov-drop.js`, `nav-slots.js`, ask 347).** The mark and the
  site's name are one 40 px button (46 px to tap) with a chevron: the accent tint on hover, a stronger tint with a
  ring while open. It opens the site's pages (Home first, the present page marked); "All OpenVibe sites" at the end
  opens the full menu on every site. The lead button a site draws (`nav-slots.js`) matches the menu button's size and
  corner. A site that turns the switcher off keeps the old links.
- **One composer on every site (`ov-composer.js`, `ov-thread.js`, `thread.js`, `thread.css`, ask 349).** Every
  `thread.composer()` box — and any site's own form through `OpenVibeComposer.enhance(form)` — gets files (the + menu,
  paste and drop become chips: a thumbnail, the name and size, ×), `/` (the site's, its mods', the person's own, and
  settings) and `@` (the mods' mention sources), voice where the browser can listen, drafts per box for 7 days, and
  the person's settings under `/settings` (kept in this browser, and on their account once Network's composer route
  lands). `OpenVibeComposer.mod({ id, match, tools, commands, mentions, upload, beforeSend })` for mods.
- **Vibe is Chat · Code · Agents (`search.js`, `dock.js`, `dock-code.js`, ask 350).** The menu's Vibe place holds three
  parts (your chats with Vibe, your coding tasks, your agents), and the Dock grows the same Code tab. `dock-code.js`
  gives one box to start a coding task the way openvibe.codes does (Create, OpenVibe, My code) with your latest tasks
  under it — state, repository, how long ago, and Stop — read through the Network's same-origin relay.
- Budget: `dock.js` 20.51 KB brotli (budget 20.55 KB, was 20.45 KB) for the Code tab's mount branch; the tab itself
  ships in `dock-code.js`, loaded the first time it opens. `notification-ui.js` 25.72 KB (budget 25.75 KB, was
  25.7 KB) for the one menu's notifications. The bar holds its 49.9 KB budget.

## 4.200.0 — 2026-11-10

**The button becomes its tab; Vibe holds Chat and Agents; every site from the site's name.** From the owner's notes of
2026-11-10 (asks 334 to 338).

- **The button becomes its tab (`search.js`, `navbar.js`).** "When you click this button, I want it to animate into the
  tab it becomes. Same with the other buttons." The bar's button that was pressed (the menu button, the picture; the
  bell once it opens You) flies to its tab's icon in the menu and turns into it on the way: its own picture fades out as
  the tab's fades in, along one short arc, and the tab settles with a small give. The bell's count rides along to the
  tab's count. Closing flies it back into the bar. When a button flies, the sheet's close X is simply there (the menu
  button no longer travels to it). Motion Off skips it; Reduced plays it short and straight. A flying button is hidden
  by opacity, so a quick second press still lands on it. `OpenVibeSearch.open({ from })` takes the pressed element.
- **Vibe, with Chat and Agents (`search.js`, `dock-vibe.js`).** The menu's "AI" place is called Vibe; its two-part
  switch is Chat · Agents (your chats with Vibe, and your agents). The list loses its "Vibe conversations" heading and
  the large "New conversation" button: a + icon (new chat) and an ↗ icon (open in OpenVibe.Chat) stand in for them.
- **Chat, where it was Messages (`search.js`, `dock.js`).** The menu's Messages place is called Chat (on
  openvibe.chat itself, whose own tab is already "Chat", it keeps "Messages" so the row never shows one word twice). An
  ↗ icon opens OpenVibe.Chat over your conversations and in a thread; the footer that said the same in words is gone.
  The "AI chats" row among your conversations is "Vibe". The Dock's own tab is "Chat" too.
- **A place's icons in the search pill (`search.js`).** Inside the menu, a place's icons (+ and ↗) sit in the search
  pill, left of the close button, so they cost no row; the floating Dock keeps them in a slim row of their own. The
  menu mirrors the panel's buttons and each mirror presses the panel's own.
- **Every site from the site's name (`ov-drop.js`, `navbar.js`, `search.js`).** The dropdown under a site's name ends
  with "All OpenVibe sites", which opens the menu scrolled past the site's own pages to every site. The scroll had never
  run: the menu read the tab after "sites" had become "here".
- **The site's name, highlighted (`navbar.js`, ask 342).** The name that opens its pages gets its highlight as a spread
  shadow with room around it (no added width, so the name still reads whole at 360 px): a faint tint on hover; open, a
  deeper tint with a hairline ring that comes up on a small spring. Motion Off keeps it still (the theme loader's rule).
- **A quick close and reopen keeps the menu open (`search.js`).** Closing the menu steps back in history; that step's
  event arrives later and used to close a menu opened again in between. The menu now ignores the one step it took itself.
- Budget: `dock.js` 20.43 KB brotli (budget 20.45 KB, was 20.30 KB) for the "Open in Chat" icon in the always-loaded
  Dock; the Vibe-only button rules stay in `dock-vibe.js`.
## 4.199.0 — 2026-11-10

**Every page downloads about 56 KB less: the shared files are served minified.** From the owner's notes of 2026-11-10:
"Make sure everything loads … non-blocking asynchronously … minified".

- **Served minified, cached by content hash (`serve.js`, new `minify.js`; OpenVibe.Shared #429).** Sites have no build
  step by choice, so the shared browser files are minified where they are served: terser for JavaScript, clean-css for
  stylesheets. It runs once per release per file, and the immutable `?v=` address does the rest. On 4.197.0's eager set
  (the bar, the theme, the footer, the kit and the rest) that is 806 KB → 523 KB raw and 189 KB → 133 KB after brotli,
  about 56 KB less per page view; `navbar.js` alone is 49.8 KB → 34.4 KB as delivered. A file the minifier cannot
  handle, or one that would not come out smaller, is served as it is; a minifier error never fails a request. ETag and
  `?v=` immutability are unchanged. Stylesheets are minified at clean-css level 1 only (inside each rule), never level
  2, which moves and merges rules and could change which rule wins. New dependencies: `terser`, `clean-css`.
- **Avatars reserve their box (OpenVibe.Shared #430).** The bar's, the footer's, the account switcher's and the user
  card's pictures carry their width and height and decode asynchronously (the footer's also load lazily, below the
  fold), so a signed-in page no longer shifts when the picture arrives.
- Checked on production openvibe.chat with every shared file served minified, on a phone and a computer: the bar, the
  menu, Messages and AI inside it, the Dock; no page errors.

## 4.198.0 — 2026-11-10

**On a phone the menu is one sheet: Messages and AI open inside it.** From the owner's notes of 2026-11-10, with the menu
and the Dock side by side: "combine and consolidate these two menus into one unified menu … easier to search between",
and a phone picture of the Dock's own head over the menu ("Menu", "…", close, then four tabs: two rows of chrome).

- **The menu (`search.js`).** On a phone, Messages and AI in the row of places no longer close the menu to open the
  Dock's second sheet. They open inside the menu, under its own head, and become the chosen place like Feed or You. AI
  carries a small two-part switch at its top: Vibe · Agents (your Actor is the top of Agents). Feed, Here or You, typing
  in the field, or closing the menu hand the Dock's panel back with its state. On a computer the two places still open
  the floating Dock, which stays beside the work.
- **The Dock (`dock.js`, new `dock-mount.js`).** `OpenVibeDock.mountInto(host, { tab })` → `{ show(tab), destroy() }`
  shows one of the Dock's panels (chats, vibe, agents, activity) inside another sheet, with no head of its own: the same
  panel body, state, counts, token and loaders as the floating Dock, which closes while a panel is lent. The layout
  loads on first use (`dock-mount.js`), so `dock.js` stays inside its budget. Six mount and destroy laps leave no nodes or
  listeners behind (`test/dock-mount-chrome.test.js`).
- **The agent view (`dock-agent.js`).** An ended session is two lines of words with its one button beside them (it sat
  alone on a third row), and the agent view's buttons are 44 px under a finger.
- The bar's touch-feedback comment, which ships inside its styles, is one line now: the bar is back under its size
  budget with room for the next hashes.

## 4.197.0 — 2026-11-10

**The footer says "3 online", and the tooltip part works anywhere.** From the owner's notes of 2026-11-10: "Make it like
shorthand '3 online'. If you put your mouse over it, it says 'last 30 minutes'".

- **The footer's online strip (`footer.js`)** read "13 online in the last 30 min", then the faces, then "1 member · 12
  guests". It now says **"13 online"** and the faces. Hovering the count (or reaching it with the keyboard) shows the one
  tooltip: "In the last 30 minutes", and under it how many are members and guests. A press opens the same words above
  the list of names, because a finger never sees a tooltip; with guests only, the count still opens that one line
  (before, a guests-only strip opened nothing).
- **The tooltip part (`ov-tip.js`) loads at the first hover over anything that carries `data-ov-tip`**, not only over the
  bar: the footer's count, and whatever a site labels the same way. The waiting listener lives at module level, so it
  holds no bar that a soft navigation has replaced.
- A test (`menu-places-chrome`) measured the menu's origin after a fixed wait and could read it mid-motion on a busy
  machine; it now waits for the motion to end.

## 4.196.0 — 2026-11-10

**Your Actor in the Dock, redrawn: one row and one line to type in. And a tone is a lean and a glow, never a bar.** From
the owner's notes of 2026-11-10.

- **The Dock's Actor block (`dock-actor.js`).** The owner, on the Agents tab on a phone: "improve the design and layout
  so it's more intuitive, minimalist, elegant". It was a row with two outlined pills ("Resume", "Open"), a grey box
  that said "Paused" a second time beside a green dot, the model and the cap in a sentence, a field with a "Send" pill
  and a "Read recent history" pill. Now:
  - **Who, in one row.** The face wears a ring in the colour of its state (green and breathing while it works, amber
    while it waits for you, dimmed when paused), then the name and one quiet line: the state, and today's spend against
    the cap ("Paused · $0.00 of $1.00 today"; the model is that figure's tooltip). The row is the link to the Actor's
    page, so "Open" is gone.
  - **One action, the one that fits.** "Resume" in the accent when the Actor is paused; a quiet pause button when it
    runs. What happened is said in one line under the field ("Resumed.", "Sent. Your Actor reads it at its next step.",
    or why it did not go through), in place of notes piling up at the bottom.
  - **What it does, only when there is something to say.** The step it is on (a soft pulse), what it is looking at, the
    steps before it and what comes next ("Next: … , in 40 min"), as a short line of dots. A paused Actor shows none of
    it, and the state words Actor sends as a step ("Paused", "Resting until the next goal is due.") are no longer
    drawn as one.
  - **What it asks you** sits in the warning tone (a lean and a glow), with its own buttons: the first in the accent,
    "Not now" as plain words, and "1 more on your Actor's page" as a link.
  - **One field to tell it something**, with send inside the field; it lights up when there are words in it.
  - **Built once.** A refresh (every 15 seconds) used to rebuild the whole block and wiped the line being typed; now it
    repaints the row, the steps and the ask only when the answer changed, and never touches the field.
  - "Recent history" is a quiet text button; the button that opens the list closes it, one line per entry.
- **The agent view (`dock-agent.js`): no black box for a session that left no picture.** A session that ended with no
  still drew a 16:9 black stage saying "Nothing to show", which pushed the runs off a phone's screen. The stage is
  left out; the line under it still says what it was and how long it worked.
- **The kit's tone (`kit.css`).** The owner, on a notice with a red bar down its side: "instead of just like this red
  and crappy border … blur maybe effect or shadow, glow". Notices and `.ovk-tone[data-tone=good|alert|warning]` take a
  tinted hairline, a gradient that leans from the corner, a soft glow under them and a round icon chip; no side stripe
  anywhere.

## 4.195.0 — 2026-11-10

**The You tab gets a row of its own, and the menu grows out of the button that was pressed.** From the owner's notes of
2026-11-10.

- **The You tab: one slim row, and the old account block is gone from the menu.** The owner, with the block crossed
  out: "When I said integrate the user drop down into this menu, I didn't mean like this … get rid of this thing … We
  didn't really need the actual [block] here, other than like adding your account … making a new design for that."
  The row: your face and name, add or switch account, Display, Settings, Sign out (each a full touch target, with a
  tooltip). Under it, small, only what has no other home in the menu: this site's own items, your status, and Admin
  for an admin. History, Ask Vibe, Work, the Dock and the wallet are not repeated: they are tiles, the search box, the
  row of places and the balances pill. `navbar.js` hands the menu three small things (`me: { add, out, own }`) in
  place of its dropdown; `ov-home.js` draws the row.
- **The menu grows out of the pressed button** ("go … to the proper element … what you clicked on, and be more aware …
  of positioning"). On a computer it unfolded from its left corner, though its button has been at the right since
  4.193.0: its origin is now the pressed button's centre, wherever the sheet was clamped to, on the dropdown's own
  curve.
- Tests: `menu-home-screen-chrome` and `navbar-ask-vibe` read the row (the old block and its grid are not in the
  menu); `menu-places-chrome` checks the sheet's origin against the pressed button. `navbar.js` is under its budget.

## 4.194.0 — 2026-11-10

**One row of places in the menu, a wallet that is there at once, and a Sign in that says so.** From the owner's notes
of 2026-11-10.

- **The menu's head is one row of five places** ("combine and consolidate these two menus into one unified menu … It
  just seems a little much with all the buttons on the first one … the agents and AI tools versus the feed and kind of
  community stuff"). This site · Feed · Messages · AI · You, in place of three tabs with a second row of four under
  them: on a phone each is its icon over its word, on a computer side by side. Messages and AI (Vibe and your agents)
  open the Dock on those places for now; their panels move into this sheet next. A visitor has this site, Feed and
  You, as before. The Dock draws Vibe as the spark and Agents as a robot, as the row does (the spark meant two things).
- **The wallet sheet is there at once and nothing jumps** ("load faster and dynamically sync smarter … isn't so jumpy
  as it loads in, the different elements and balances"). It opens holding what it last showed in this tab, or room
  held for its three cards; the store and your items stand as placeholders of their size; the store, the kinds and the
  items are asked side by side with the balances (they waited for them before); each part arrives where it stands,
  once. What it keeps is the wallet's own answer in the person's tab, forgotten when the account changes.
- **Sign in says "sign in"** ("should represent … that they need to sign in"). In the filled circle the figure and an
  arrow coming in through a door take turns (the arrow for a moment every six seconds); under the pointer it is the
  arrow, what a press does. Off shows the figure and does not move.
- **The tooltip's file is fetched by the first pointer over the bar**, not with the page (it was fetched at once on
  any device that can hover); what that pointer rests on gets its tooltip when the file arrives.
- Tests: `menu-places-chrome` (five places in one row signed in, the doors open the Dock, three for a visitor),
  the wallet's and the bar's. `dock.js` is 20.30 KB brotli (budget raised by 0.05 KB for the robot glyph, dated).

## 4.193.0 — 2026-11-10

**The bar's right end, one tooltip, and one frame for mail.** From the owner's notes of 2026-11-10.

- **The menu button is at the right on a computer too** ("The menu button should be on the right, even on desktop …
  there's like a duplicated icon"). The orb at the bar's right is drawn on every width, and the one beside the name is
  not drawn where it is: the left end is the logo (the network's sites) and the name (this site's pages), the right
  end the menu and then the person. A second press closes the menu.
- **Sign in is an icon** ("This can be majorly improved with a custom icon. Doesn't need the label really, and could
  have a tooltip"). A filled circle with a figure in it, the size of the picture it stands in for, in the readable
  accent pair; the figure arrives on load, lifts under the pointer, and the ring runs while the sign-in page opens. Its
  name is its own (`aria-label="Sign in"`) and its tooltip. A finger's area is 44 px and stays off the menu button's.
- **New `ov-tip.js` (`OVTip`): the network's one small tooltip.** Anything with `data-ov-tip` (and an optional quiet
  second line, `data-ov-tip-sub`) gets a small card that grows out of what it names, under it or above, kept on the
  screen. A mouse sees it after a short rest (the next one at once), the keyboard's focus at once; a press, a scroll,
  Escape or leaving hides it; a finger never sees it, so nothing is said only there. The bar loads it where a pointer
  can hover; the menu button carries one too (its native `title` made a second, plain one).
- **New `email.js`: one frame for every mail** ("Improve the entire email system so it uses openvibe.design … uses the
  theme applied by the user … explain more details … what they can do, what they can click"). `frame({ theme, site,
  tone, kicker, title, lead, body, facts, code, actions, next, why, manage, preheader })` returns `{ html, text }`: the
  person's theme written on the elements (all fifty read at 4.5:1 or better), a title that says what happened, the
  facts as a list, one button and quieter links, what happens next, and why it came. Text only and safe links only. A
  tone is never a hard coloured border ("instead of just like this red … border … shadow, glow"): the card leans toward
  the tone at its top and glows in it, the kicker is a pill with a round mark, the facts stand in a box with a tinted
  hairline. `palette(theme)` and `mix(a, b, t)` are exported for a site's own blocks.
- **`mini.js` plays what the page plays.** Found on openvibe.video the hour it shipped: the page's script gives the
  video its streaming playlist, and one recording's plain file stopped with a decode error three seconds in. The small
  player now takes the playlist (`data-ov-mini-hls`) where the browser plays one by itself, in the page's cross-origin
  mode, and the plain file (`data-ov-mini-src`) otherwise; a playlist that fails gives way to the file at the same
  second. A video that cannot be played either says so ("Open its page to keep watching"), keeps the way back, and
  does not follow to the next page; it used to close without a word.
- **The wallet says what a line was for** (OpenVibe.Shared #416, from the money-reasons work): the reason is a made
  sentence, linked to the thing it paid for.
- The 4.192.0 entry's date is corrected (it said the 11th).
- Tests: `ov-tip-chrome`, `email` (every theme, every tone), `mini-chrome` (the cannot-play state), `navbar-fit-chrome`
  (the menu button at the right at every width, no second one by the name), the tap-area tests with the round Sign in.

## 4.192.0 — 2026-11-10

**The video that comes with you.** The owner, 2026-11-10, with the browser's floating picture-in-picture window over a
watch page: "should … actually [be] like YouTube where it moves that video. Now you go to the search again or the index
… the homepage … it's just kind of confusing".

- **New `mini.js` (`OpenVibeMini`): a small player of our own.** A watch page says its video may come along
  (`<video data-ov-player data-ov-mini data-ov-mini-title data-ov-mini-by>`). The shared player's picture-in-picture
  button then writes down what is playing (the page, the file, the title, who made it, the poster, the second, the
  speed, the volume, whether it was playing) and takes the person to the site's front page. Every page of the site
  that finds the record draws the small player and goes on from the same second: a card at the bottom left on a
  computer (the picture, "Back to the video" on hover, a line of progress, the title, who and the time, play and
  close), one bar above the app bar on a phone. The video's own page takes the second back and draws nothing. A page's
  own video starting closes it: one sound at a time. Where a new page may not start with sound, it plays silent with
  "Turn the sound on". The record is the tab's own (`sessionStorage`), so a private file's signed address never
  leaves the site. `OpenVibeMini.carry(video, { to })`, `.open(record)`, `.resume()`, `.close()`, `.record()`.
- **`player.js`:** on a video with `data-ov-mini` the picture-in-picture button is "Keep watching while you browse"
  and is shown also where the browser has no floating window of its own (it was hidden there).
- **A site turns it on** by loading `mini.js` on its pages (`ovServe.url('mini.js')`, deferred): the file starts
  itself and does nothing without a record. The bar does not load it: `navbar.js` is at its size budget, and the loader
  moves into the bar with the bar's diet.
- Motion: the card rises in 280 ms; Calm fades; Off does not move.
- `test/mini-chrome.test.js`: from the player's button to the front page at the same second, pause kept across pages,
  closing for the page's own video, the second handed back, Close forgets, the bar on a phone.

Across sites the record will travel another way (storage is each site's own); gapless moves need pages changed in
place. Both are researched first (plan, ask 265).

## 4.191.0 — 2026-11-10

- **A guest's page view counts at once again.** The beacon waits for the shared sign-in state only for a browser that has a token and no user yet (at most 2.5 s, so a signed-in person is not also counted as a guest); a page that knows its person, and a browser with no token at all, send it as they always did. The navbar's brotli budget follows (49.9 KB).

## 4.190.0 — 2026-11-10

**The one dropdown, the wallet in colour, who is online, and five smaller things.** From the owner's notes of
2026-11-10, each with a screenshot.

- **The site's name opens its pages** ("clicking the actual name of the domain should have a sleek little minimalist
  drop down … that just shows the pages … have the home button as an option … a custom, animated system for these drop
  downs and positioning of them, used across all sites"). New `ov-drop.js`: a small list that opens out of what was
  pressed (under it, or above when there is no room), kept on screen, its rows arriving in turn; arrow keys, Enter,
  Escape with the focus given back, a press outside; one open at a time, with the page's other panels. `OVDrop.open`,
  `.attach` and `.pages`. In the bar the name shows a small mark and lists Home first, each page with its icon and the
  present page marked; with a modifier key it is still a link to the site's home.
- **The wallet sheet in the currencies' colours, with motion** ("make this way nicer with animations and effects and
  color … nicer for the different currencies … effects like animations for the coin loss … shared and unified, also
  SDK API"). Each balance is a tinted card with its drawn icon in a tile and its action in the same colour; a light
  crosses each card as the sheet opens and the numbers count in; after a purchase the number counts to the new amount
  and the currency's pieces leave its card with the amount beside it. On a phone: the tile, the name over the number,
  the action at the right. A read that fails is said in a person's words, never a program's.
- **The effects as calls** (`purse.js`): `OpenVibePurse.burst(element, id, delta)` plays the gain or spend at any
  element, inside an open dialog too, upward near the bottom of the screen; `.count(element, from, to, format)`;
  `data-purse` gives a holder the currency's colour (`--pc`); `.ovp-play` plays an icon's own move.
- **The footer strip says who is online** ("show how many users are across all sites … the last half hour … guests
  and users, like the old forum style where it lists everyone … live smaller, only if someone's live … other
  metrics"). One read, `/api/frame/online`: the count with a few faces, members and guests, and where members may be
  named the list of them with their site; then small tiles that open what they count: live (only while someone is),
  joined this week, the site's own items, the sites, the week's page views. The page-view beacon marks a signed-in
  browser with `?in=1` (no identity), so that person is counted from their presence and not as a guest.
- **Uploads say when you already have the file** ("tell the user they already have one"). `OVUpload.queue` takes
  `checkDuplicate(file, sha256)`; the row says "You already uploaded this on 10 Nov 2026." with Open it, Use that one
  and Upload again, as one block. `OVUpload.preflight` does it for a single picker. Files over `hashLimitBytes` (32 MiB)
  or slower to hash than to send are not hashed.
- **A change is New, Improved or Fixed, with a mark** ("what is this confusing tag … better next to everything?").
  A star, an arrow up, a tick; an improvement shows the mark alone. "Better" is gone.
- **One picker for a person's computers** (`machines.js`, with Network's /add-computer): each computer a tile with
  its state and what it can run, "Auto", and "Add a computer" through OpenVibe Link.
- **One bar mount per page: an empty band under the bar is gone from seventeen sites** ("why is there so much wasted
  space or unnecessary margin … for no reason", with the space under the bar circled on openvibe.community). Since
  4.186.0 the server writes the bar's links itself, in its own `#navbar-mount`; a page whose body already had
  `<div id="navbar-mount"></div>` then had two, the bar mounted in the first, and the second stayed an empty 52 px box.
  `shell.page` puts the server's bar into the page's own mount where it has one.
- **Sign In has its own icon** (an arrow into the ring; it steps in now and then, and the ring's gap runs once
  pressed), and the menu button's three squares hop in turn every few seconds ("use a nice custom animated icon for the
  sign in … make the menu button animated as well").
- **The bottom bar's highlight is centred on its icon** ("this is all offset"). It was placed once from `offsetTop`,
  before the icons and the brand font arrived, and stayed above its icon; it is measured from where things are and
  placed again when the bar or an icon changes size.
- Jump back in links to the full history on openvibe.my; the Dock's agent can read recent history on a press (the
  history-timeline job's plumbing).

- **The test runner gives a failed browser file one more try** (`retry` in `test-runner.js`, used by this package's
  own run). Three releases in a row waited on the macOS runner, each time for different headless-Chrome files that
  pass on Linux, on Windows and locally. A pass on the second try is named in the summary.

Built by runner jobs and given their look here: the upload check (upload-dedupe), the computers picker
(machines-one-place), the footer's read (whos-online-strip), the history link (history-timeline).

## 4.189.0 — 2026-11-10

**The balances are one pill, the menu and the Dock lead to each other, and the menu opens where you are.** Seven notes
from the owner on 2026-11-10, each with a screenshot of the bar or the menu.

- **One pill for the balances** ("we just show one, but it can animate between all three … it only needs to show the
  things you have … nice icons that are animated, designed for the three currencies … a custom animation for gaining
  and losing, with coins coming out of it"). `#openvibe-chips-all` is drawn at every width, with the balances the
  person has (above zero, the largest first; the money balance leads when AI was used and it is empty) stacked in one
  place and one showing. New `purse.js`: an icon drawn for OpenCoins (a coin struck with the ring), Vibes (a cut gem)
  and the money balance (a note with a seal), each in its own colour leaned toward the theme's text so it holds on
  light and dark; a turn through the balances on the first page of a visit and one every forty seconds or so; and on a
  change the pill turns to that balance, counts the number, takes its colour for a moment and sends a few of its
  pieces in (a gain) or out (a spend) with the amount under it. Calm motion shortens the moves; Off removes them.
  The two-line pill on phones and the separate chips on computers are gone.
- **The menu opens on this site's tab** ("this button should open the first tab so people can switch between pages on
  the site they're on … make it more clear that those are pages on the site you're on"). No tab is remembered; the
  picture still opens You. The pages are tiles under "Pages on <site>", in the case it is written in, behind a dot that
  marks where you are.
- **The current site is first in its group**, the site tiles are full touch targets, and a group's name sits on a
  hairline ("design should be the first result … improve these section titles … make the icons look nicer").
- **From the menu to the Dock and back** ("how are you supposed to get to the other menu from this area … a way to hop
  over to the other interface that has the chat"). Under the menu's tabs a row opens the Dock on Vibe, Agents, Messages
  or Activity (`ctx.dock`, given by the navbar where the Dock is on); the Dock's head has "Menu", which folds the Dock
  and opens the menu out of the same button.
- **The Dock's head** ("buggy and kind of ugly … more consistent, cohesive"). Its close button was drawn as a white bar
  over blue dots: the Dock's line style for icons reached the menu button's parts. It is the same cross as the menu's
  now. The chosen tab takes the theme's accent, as the menu's does (it was a dark box inside a box). On a phone the
  head is two rows, as the menu's is: Menu, More and Close where the bar's bell and button are, and under them the
  four tabs, full width, in the look of the menu's row that leads here.

## 4.188.0 — 2026-11-10

**The account's things are in the menu.** The owner, 2026-11-10, with the dropdown under the picture marked "Replace →
to You tab": "this user drop down is just redundant … move it into the You tab of the menu … add account switching
and adding accounts to that … consolidate the two into one menu."

- **The picture opens the OpenVibe menu on You.** The block the dropdown drew (who you are, add another account,
  settings, sign out, your other accounts, the site's own items from `addMenuItem`, light or dark and Display) is a
  block of that tab, at its top, where a shorter bar with the name was. It is there wherever the bar has a person, with
  or without a token for the network's reads.
- **No dropdown.** The popup, its position, its height rules and its place among the panels (`user-menu`) are gone.
  The block rests in the bar, out of sight, while the menu is closed: a site that looks for `#openvibe-logout-btn`,
  `[data-ov-ask]` or its own item still finds it.
- **The mark is larger in the bar** (42, was 34; 34 on a small phone, was 28). The owner: "make the OV branding take
  up most of its area … stand out a little more … compared to the My." Nothing overlaps from 320 px
  (`navbar-phone-fit-chrome`).
- In the You tab, "All 65" keeps its own case (it was drawn in the heading's capitals).

## 4.187.0 — 2026-11-10

**The bar the owner chose.** 2026-11-10, in the Arena: "here's the new menu button and the logo … these two, but
improve upon and expand on it. And let's move the user … so that it's to the right of this. And instead of having
messaging and notifications, just have the notifications."

- **The menu button is "Search and apps"** (the Arena's M57): the menu itself, small: a search bar over three apps.
  Under the pointer its parts lift in turn; while the menu loads the apps breathe; open, the bar turns into one stroke
  of the close mark and the three apps line up as the other. One drawing (`OpenVibeOrb.svg()`, navbar.js) for the
  bar, the menu's sheet and the Dock's sheet, where three copies of nine dots were.
- **The mark has the wide gap** (the Arena's P07): the ground around the V where it crosses the O is 14, was 7, in
  `ov-mark.js`, `mark.js`, the app icons and the loader's tab icon alike (`test/mark.test.js`).
- **The person is last in the bar**: balances, the bell, the menu button, then the picture (or Sign In).
- **Messages is the bell.** The Messages button leaves the bar; the count of new messages (Chat's, or a site's own
  through `setMessages(count)`) is added to the bell's number and named in its label ("Notifications, 1 unread, 2 new
  messages"). With new messages and nothing else new, the bell opens the Dock on Chats; otherwise on Activity.
- **One menu.** The owner: "make sure these two share the same universal system … it just opens the actual first
  tab … same UI." The mark opens the OpenVibe menu on its first tab; `site-switcher.js`, its panel, its own icons
  and its "here" label are deleted. `OpenVibeNavbar.openSwitcher()` opens the menu.
- **All apps is a small button beside Edit** in the menu's You tab ("All 65"), where a bar the width of the sheet
  was under the grid.
- **An agent's turn shows it is thinking**: in the conversation kit (`thread.css`), the agent's avatar shows three
  rising dots while its turn is open.

Removed: `site-switcher.js` (and its export), the Messages button and its `messages: { href, onOpen, label }`
behaviours (the Dock's Chats tab is where messages open; `messages: false` still turns the count off).

## 4.186.0 — 2026-11-10

**The mark at work is a ring of dots, and thinking is a state of its own.** The owner, 2026-11-10: "the progress
animation… should make the O turn into a bunch of little circles, like how a normal loading spinner looks… a cooler
animation that actually looks like it's loading or doing something. Also, there should be one dedicated for thinking
when your agent is thinking or replying… easier to know that it's replying or outputting tokens."

- **`data-state="busy"` (working):** the O breaks into eight dots (a dash of no length with a round cap) and three
  bright ones go round the ring, dot to dot, while the V bobs. It was the O breathing. This replaces the old line
  "nothing spins": a wait is the mark's own O going round, never a borrowed spinner.
- **`data-state="think"` (new):** three dots rise in turn inside the O, the ring quiets, and the V's two strokes glimmer
  one after the other. One sign, wherever an agent is thinking or tokens are on their way.
- Both are shown at every size and stay readable with motion off (the dots are simply there).

**The menu and the Dock are one kind of sheet on a phone.** The owner: "make the two UIs look match a little better,
especially the close button, so it feels more seamless… make the animation effect for the menu opening and closing more
similar to how the other ones are… and make it cooler."

- **One close button:** the Dock's is the menu's now: the same round, ringed button, the same × of dots in the same
  colours, at the same place on the screen (measured: both centred 36px from the right edge, 34px from the top).
- **One move:** the Dock's sheet opens as a circle growing from the orb and folds back into it, with the menu's own
  timing (380 ms in, 280 ms out); it faded and scaled in 4.185.0.
- **A ring leaves the orb** as either sheet opens (smaller under Calm, by `--ov-move`).
- The close orb is measured after the sheet's layout is set, so it starts exactly on the navbar's button.

**A control nobody styled wears the theme.** The owner: "customize all the inputs and buttons and things that aren't
styled." A `<button>`, a text field, a `<select>` or a `<textarea>` with **no class of its own** gets the theme's face
from the loader: its colour, border, corner and font, and the accent on a tick box or a slider. Only the face, and at
no specificity (`:where`), so any rule a site wrote still wins and no layout moves; a control's real shape is the
kit's (`ovk-btn`, `ovk-input`). The loader grew about 1 KB raw (budget 67,600 characters).

The Dock is 20.00 KB brotli (budget 20.25 KB, with the reason beside it).

## 4.185.0 — 2026-11-10

**The You tab: your home first, a shorter bar, Most used as shortcuts.** The owner, 2026-11-10: "Your home should be
above Jump back in… the thing at the top with your username and online and the settings… a little more compact… most
used is cool, but maybe we should actually have links to whatever the user uses the most… so it's just easier to jump
to the app."

- **The order** is you, your own AI, **Your home**, Most used, Jump back in (it was you, AI, Jump back in, Most used,
  Your home). Nothing above the grid comes or goes while Home is being arranged, as before.
- **The bar with your name** is 52px tall (was 68): a 36px picture, name and handle on two tight lines. Display and
  Settings keep their 44px.
- **Most used** keeps its one bar; its key is now the apps themselves, five across: each app's icon in its own hue, its
  name, and how often with the bar's colour beside the number. Each is a link (`.ovh-key`, "Live, opened 183 times") and
  a full touch target; it was a row of small legend entries.
- **Jump back in** comes last and says what it is: "where you were last".

**A phone's Dock opens out of the navbar's menu button, and that button is its close button.** The owner, 2026-11-10:
"that close button should, instead of coming from that menu, fade and have an animation effect from the top right, the
menu button that already exists… it's supposed to be nicer connected to this." Until now the sheet rose from the bottom
and carried its own close button up with it.

- On a phone (640px and under) with the orb at the bar's right, the sheet fades and grows from the orb's centre
  (`.ovdk.from-orb`); its close orb starts exactly on the navbar's orb, as its nine dots, and settles into its x in the
  header (a glide of a few pixels and the same turn the main menu's orb makes). The navbar's own orb makes the same
  move underneath (`.ovnav-orb.is-dock`), so it is one button the whole way. The x wears the menu's colours.
- **Closing runs it back:** the x turns into the dots and returns to the bar while the sheet fades (240 ms), then the
  sheet is gone and the button is where it always was. `OpenVibeDock.close()` therefore hides a phone's sheet a moment
  later than it is called; with motion off, in a window of its own, or on a bar without the orb, it hides at once as
  before (and such a bar keeps the rise from the bottom).
- Calm keeps the move (the grow is smaller, by `--ov-move`); only motion off skips it.

`test/menu-home-screen-chrome.test.js` holds both: the order, the bar's height, the shortcuts' links and targets; the
close orb starting on the navbar's orb, settling, folding back, and standing still with motion off.

## 4.184.0 — 2026-11-10

- **Server-rendered navbar links.** The shared shell emits the configured navbar links in the reserved `#navbar-mount`
  so crawlers can read site navigation from the response HTML. The client replaces that node's contents atomically
  on hydration; server and browser use the same configured or default link list, with the existing 52px reserve.

## 4.183.0 — 2026-11-10

**Motion: Calm reduces, only Off removes.** The owner, 2026-11-10: "Reduce motion is too much reduction, it ruins a lot
of stuff, so it should still have full motion but actually just reduce it instead of getting rid of it." Until now Calm
(the person's choice, or the device asking for less motion) gave every animation and transition no length at all.

- **Four choices, one signal.** `display.motion` is `auto`, `full`, `reduced` or `off`, and `theme-loader.js` writes
  the answer on `<html>`, the device's own setting counted in: Automatic follows the device (Calm when it asks, nothing
  otherwise), Full plays everything even when the device asks (`data-ov-motion=full`), Calm is `data-ov-motion=reduced`,
  and Off (`data-ov-motion=off`) is the only choice that stops motion. `display.motion()` answers `'full'`, `'calm'` or
  `'off'`. The look panel's Motion row offers the four (Auto, Full, Calm, Off).
- **What Calm is.** `--ov-move`, the factor a moving thing multiplies its distance by: 1 in full, .35 under Calm, 0 with
  motion off (`calc(12px * var(--ov-move, 1))` in CSS, `display.move()` and `OVFx.move()` in script). The calm feel's
  lengths with no overshoot. And the loader slows every endless loop (a pulse, a drift, a shimmer) to 0.6 of its speed
  as it starts; anything that ends plays as it was written. The page itself does not glide when it scrolls; a rail or
  a sheet does.
- **The effects.** A lift rises a pixel and a reveal five; a tilt leans a third as far; a burst of confetti is a third
  of the pieces thrown half as hard; a count-up is quicker; the glint is fainter and slower; the mark keeps its intro
  and its hover and drops only the linger, and three leaves fall instead of seven; the ghost cursor glides slower and
  waits longer; a name's particle burst is three pieces, not six; a drawer slides a third of its width and fades; a strip nudges half as far and drifts at half the speed.
- **The files.** 75 rules across 45 files stopped an effect under `prefers-reduced-motion` or under
  `html[data-ov-motion=reduced]`: all are gone. What such a rule did to leave a thing finished (a drawn stroke, a
  static glow, a bar at rest) belongs to `html[data-ov-motion=off]`. The calmer keyframes that already existed (the
  menu's pop, the home screen's wiggle and card fade, a new message) stay as Calm's. Script that skipped an effect when
  the device asked skips it only with motion off; a live preview (a video that starts by itself) still waits for a tap
  under Calm.
- **For a site's own styles:** delete the rules that stop motion under `prefers-reduced-motion` or under
  `html[data-ov-motion=reduced]`; multiply a distance of 24px or more by `var(--ov-move, 1)`; keep a rule only where it
  swaps in a calmer keyframe, keyed on `html[data-ov-motion=reduced]`; a finished state belongs to
  `html[data-ov-motion=off]`. `test/motion-setting.test.js` holds this package to it.
- The loader grew about 2.9 KB raw (budget 66,500 characters). Network must accept `full` and `off` in the display
  record before a site offers them (OpenVibe.Network `server/themes/routes.js`).

**Icons: every shape glyph has a solid drawing, and every product has its mark.** Icons shown at 18 px or smaller draw
their solid form; 142 of the 278 glyphs had none. 75 of those are made of lines only and thicken when small by design;
the other 67 are shapes, and all of them are drawn now (frames and cards, marks in a disc, the media keys, things,
people, slashed shapes), so 203 of 278 glyphs have a solid drawing and every glyph without one is a line glyph.
`glyphs.svg(name, { style: 'solid' })` gave a class-ln part no stroke of its own, so a line inside a solid drawing was
filled as a shape or not drawn; it carries the stroke inline now, as the sprite already did. Site marks: eleven
product ids had no mark and drew the bare "V" (computer, mail, lock/locker, git, barcode, party, studio, my, home,
restream, node), and four things sites name as marks did the same (shoe, heart, calendar, camera). Each has its glyph
in the ring, centred by measurement; `test/site-icons.test.js` covers every product id.

## 4.181.0 — 2026-11-10

**The Dock's agent view, timeline and Actor go through Network's frame relay.** `dock-agent.js`, `dock-timeline.js`
and `dock-actor.js` asked `openvibe.codes` and `openvibe.actor` directly from every site. Every site's `connect-src`
allows `openvibe.network` and refuses those, so 49 of 49 signed-in sites logged 1-4 console errors at 1280 on
2026-11-09 (CSP on most, CORS on the sites without one). The three modules now ask Network's same-origin
`/api/frame/...` relay by default: `GET /agent-view`, its still and the four controls; `GET /agent/timeline` and its
writes; `GET /actor` and its subpaths. An explicit `base`/`agentBase`/`actorBase` (a test, or the extension's own
panel) still reaches the product itself, and nothing is asked without the person's token. The markup and styles are
unchanged. `test/dock-relay.test.js` fails if a Dock script fetches another product's origin directly again.

## 4.180.0 — 2026-11-10

- **A demo scope for motion: `data-fx-demo`** (`ov-fx.js`, `ov-mark.js`, `theme-loader.js`). Inside a container
  with this attribute the effects and the mark play even when motion is reduced, by the device or by Calm. It is for
  a page that exists to show motion, and only after the person presses a button that says so: openvibe.design's
  Motion page was completely still on a phone that asks for less motion, and never said why. Outside the container
  nothing changes: the setting holds for the rest of the page and for every other page.
  - `OVFx.confetti({ from: el })` names the element it comes from, so confetti inside a demo scope plays; without
    `from` it follows the setting as before.
  - Calm's blanket rule, the effects' reduced-motion rules and the mark's now exclude `[data-fx-demo] *`, and a demo
    scope gets its `--ov-dur-*` lengths back under Calm.

## 4.179.0 — 2026-11-09

**Share to OpenVibe Community.** The share sheet (`ov-share.js`) has a Community tile beside OpenVibe Chat: it opens
Community's new-topic form (`/forum/discuss?title=&body=`) with the title and the link filled in; the person picks the
forum and posts it themselves. OpenVibe's own places lead the grid and wear the accent. Not shown on Community's own
pages.

## 4.178.0 — 2026-11-09

**What's new reads like news (plan §9).** `shipped.js` uses the tags Blog now writes on every change (`kind`: new,
better, fixed, internal; `areas`; `plain` words) and the newest devblog Network's changelog proxy carries.
- The card (`render`): titled "What's new"; the newest devblog leads it with its picture, title and summary; each row
  shows its kind as a word tag and up to two area chips, in plain words with the commit subject as its title;
  internal changes count as housekeeping and stay out of the card, like pin bumps.
- The updates page (`log`): the same row; a second chip row filters by kind (All changes, New, Better, Fixed, and
  `?kind=` in the address); internal work gathers at the end of its day in one fold that says how many
  ("3 housekeeping changes"); pin bumps keep their grouped row ("Shared 4.177.0 reached 41 sites").
- Without the tags (older entries), rows read as before.

## 4.177.0 — 2026-11-09

- **`openvibe-shared/offer-card`: one offer from the network's shops** (`offer-card.js`, styles in `kit-data.css`). It
  shows the title and the shop, the all-in price formatted as money (`$90.00`, `€50.00`) with what it includes ("Free
  shipping", "+ $4.99 shipping", "Shipping not stated"), and how fresh the price is ("Checked 3 hours ago"). Nothing
  unknown is invented: no price or check time says so. A stale offer says "may have changed". Only http(s) links are
  kept. On a phone the price goes under the title.
- **A section's line sits under its title** (`showcase.css`). The line under a showcase section's heading was always
  indented to clear a heading icon, so a heading without one (Blog's "Latest from the OpenVibe blog") had its line
  pushed right. It is indented only when the heading has its icon.
## 4.176.0 — 2026-11-09

- **The model chip and its choice sheet** (`ai-choice.js`, `ov-ai-choice.js`, `ov-ai-choice.css`): a chip beside any
  Generate button showing the maker mark and the model's name, opening a sheet with one list of the models in the
  order the person picks (Recommended, Fastest, Cheapest, Best quality; the owner's recommendation badged), then Your
  keys, Your machines and Uncensored 18+ (only where the person confirmed). Each row says what it costs a run and how
  fast it is; a check marks the choice. The footer saves "Use this for every <task>" and links to
  Exchange. Server rendering keeps the control named before hydration; the sheet sets no scroll behind it and an
  outside tap closes it.

## 4.175.0 — 2026-11-09

- **OpenVibe Link**: the shared navigation's Machines entry points at openvibe.link/machines instead of the old
  node host, and the shipped-services list names the product Link. The Contracts pin moves to v0.373.0. No API changes.

## 4.174.0 — 2026-11-09

- **Home fills its width** (`ov-home.js`; the owner, 11-09: the icons were "offset and need to utilize more of the
  space"). The apps on the menu's Home grow with their cell up to 72 px (they were a fixed 56 px in a wider cell), the
  glyph is about half the tile, folders scale their four minis with the tile, and the grid lines up with the cards
  above it. The names are a touch larger and brighter.
- **An Edit button on Home** (`ov-home.js`). A small pencil beside "Your home" starts arranging: move apps, remove
  them, make folders. Press and hold still works. While arranging, the button is a Done pill with a check, and Home
  stays where it was: the hint is under the grid and the cards above it stay (quieted), so a long-press that turns into
  a drag never has the grid move under the finger.
- **The site's tab matches Feed and You** (`search.js`). The first tab of the menu showed the site's coloured app mark
  (a disc and ring around the glyph); it now shows the glyph alone, in the label's colour and at the other tabs'
  weight. On a phone the three tabs are tighter, so a long name like "Community" fits whole.

## 4.173.0 — 2026-11-09

- **The wallet works on sites that keep the access cookie from page scripts** (`navbar.js`, `ov-wallet.js`). 4.170's
  chips and sheet sent only a Bearer token. The sites on `openvibe-sdk/sso` with `httpOnlyAccess` (Actor, Bench, Casino,
  Codes, Connect, Design, Exchange, Vision) hand the navbar none, so their chips sat at "…" and Wallet did not open.
  With no token, the chips and the sheet now ask Network's relay with the person's Network session cookie
  (`credentials: 'include'`; Network #724 turns it into the Bearer, only for allowed origins). A wallet that cannot be
  read hides the chips instead of leaving "…". `OpenVibeWallet.open` takes `cookieSession: true`. Sites whose navbar
  reads `ov_token` are unchanged.
- **The wallet sheet goes by its content hash** (`scripts/sibling-revs.js`): `ov-wallet.js` and `ov-wallet.css` were
  loaded without `?v=` since 4.170, so a fix reached phones up to a day late.

## 4.172.0 — 2026-11-09

- **Notices read as what happened** (`notification-ui.js`, the bell, its toasts and the Dock's Activity tab): an
  agent's notice shows its task, not the words it was given ("Done: <prompt>" is the prompt; "approve: <step>
  (<task>)" is the step with an "Approval" label), and rich_content's `task_title` and `step` win when Actor sends
  them; two finished tasks are two rows. A message holding a value's JSON (a watch on a feed sends the entry, cut at
  300 characters) reads as its title and summary, and JSON with neither is left out instead of shown as code.
- **Faces per service**: Actor's notices wear an agent, Watch's an eye, Connect's and Link's a computer, Billing's a
  coin and the welcome a spark, instead of every service sharing the grid; their rows say Agents, Watch, Connect,
  Link, Community, Wallet, Blog, Design, AI or Events. The bell script's budget is 25.5 KB brotli (25.24 measured).
- **The account menu asks only the Network for Vibes** (`navbar.js`): the direct `billing.openvibe.network/api/me/vibes`
  fallback (for a Network older than 10-28) and the `billingBase` option are gone. No site's CSP allowed that host, so
  it could only fail. A Network answer without Vibes shows no Vibes chip.

## 4.171.0 — 2026-11-09

- **The page head's icon and actions sit on the title's first line** (`kit.pageHead`): a title that wraps to three
  lines (a home page's hero, openvibe.space) kept them floating beside its middle. The row aligns to the top and
  both are centred on the first line (`--ovk-page-line`, in rem and vw, so a text button in the actions keeps its size).

## 4.170.0 — 2026-11-09

- **The wallet, one sheet on every site** (`ov-wallet.js`, opened from the navbar's balance chips): OpenCoins, Vibes
  and Balance with how to earn, buy or top up; the store (items travel with the account, priced in Vibes or
  OpenCoins); your items with Equip and Unequip.
- **Through Network**: every call goes to `https://openvibe.network/api/frame/wallet/…` (Network #718, nine fixed
  Billing and Inventory paths, the person's token only). Every site's CSP refuses billing. and inventory. hosts.
- **Checkout only on a named host**: the sheet follows a checkout URL only when it is https, carries no credentials,
  and its host is one Billing names for its providers (Billing #228) or billing.openvibe.network. Anything else is
  "Checkout is unavailable."
- Each purchase carries its own idempotency key and keeps it across a retry, so a double tap never charges twice.
- Designed here: no eyebrow, makers by name ("By Live"), the close ring for the keyboard only, 44 px controls,
  phone sheet from the bottom.

## 4.169.0 — 2026-11-09

- **kit.switchRow, redrawn** (ask 44, the paste form: "polish and align it: switches, sizes"): an icon tile, a title and
  one muted line, then an iOS-style switch; the whole 56 px row is the target and the switch is the checkbox itself
  (`role="switch"`), so a form still posts without JavaScript. The older `label`/`hint`/`on` names still work.
- **kit.segmented**: three or four equal choices in one 44 px control, icons before the words; radios underneath, so
  the value posts as a radio group's. Without a label it stands alone (a form puts its own label above it).
- Glyphs: `flame` and `eye-off` (Burn after reading, Hide).

## 4.168.0 — 2026-11-09

- **The Dock's Agents tab, content-aware** (plan 2026-11-09 §7–8; the owner, 11-09: "the Agents tab's 34 identical rows
  'Draft a blog post · Done · AI · gpt-5-nano', 25 failed rows 'AI is resting for a moment' and raw JSON errors; an empty
  Agents tab that is wasted space for no reason"). `dock-runs.js` (loaded with the tab) draws each run as a row: the
  skill's icon in its own colour, the subject as the title, and one status line — Running (the live step and a thin
  bar), Waiting (what it needs), Scheduled (when), Done (the result, the cost, the time, the model with its maker's
  mark) or Failed (the words and what happens next). Open, Retry, Stop and "run again with another model" are on the
  row. Six identical failures in a day are one row, `×6`, that expands. A failure never shows the provider's own text.
- **The Agents overview** (instead of an empty middle): the next scheduled run with a countdown, today's and this
  week's numbers (runs, done, failed, spend) as three small tiles, the last three results as rows, and "Things agents
  can do for you": a grid of six skills from Actor's catalogue that start a run in one tap. The foot stays one row:
  "All runs" and "Give an agent a task".
- **The Vibe tab has a conversation list** (`dock-vibe.js`): New conversation at the top, then each chat with its last
  line, its time and the site it began on; a back arrow in a conversation. The tab opens on the conversation you had
  open within the last twenty minutes, else on the list, and the choice is the Dock's synced state, so it follows you
  across pages and sites. "Vibe did not answer" says why and offers a retry. The composer shows at once, with the
  attach and the mic.
- **The Chats tab has an AI chats row** among the DMs, placed by date like the others: the Vibe mark, "AI chats", the
  count, the last conversation's title and when Vibe answered; tapping it opens the Vibe tab on its list. A group's row
  shows up to three faces, not a number sign.
- **The Dock keeps its size and corner per person** and its grip is always visible; the Vibe conversation and the
  Agents filter are restored with it.
- **Restyled here (Opus):** a run is a row, not a box: the state as a coloured word (Running blue with a moving bar,
  Waiting amber, Done green, Failed red), its words on two lines at most, the title opens it, Approve and Retry as filled
  pills, the rest under a dots button. The tiles lead with their number (11 runs) and dots for done and failed. The Vibe
  list gives each conversation its mark and its site's name (Blog, not openvibe.blog) and New conversation is a button.
  The AI chats row has a Vibe avatar like every other row; group faces are ringed in the panel's own colour.
- The one-tap skills are read through Network (`/api/v1/me/actions/skills`): every site's CSP refuses openvibe.actor.
- The extension's read-only Dock offers no approve, decline, stop or retry.
- **Early hints: the Link header only, by default** (`openvibe-shared/sw` `earlyHints`). nginx 1.28, the host's, takes an
  upstream 103 as the final response and sends the real 200 as its body (tried 11-09 against nginx:1.28-alpine). The 103
  goes out only with `{ send103: true }` or `OV_EARLY_HINTS=1`, for a proxy that passes it on (nginx 1.29+ with
  `early_hints`). Cloudflare's Early Hints read the Link header.
- **The Feed's composer takes pictures** (the owner, 11-09: "you can make posts and put images"). Up to four, each
  with a line saying what it shows (Community requires the alt text; Post stays off until each has one). Big phone
  photos are scaled to 2560 px before they go. Each picture uploads through Network (`POST /api/frame/attachments`,
  Network #719) and the post names them (`POST /api/frame/posts`). Previews are small data: images, because not
  every site's img-src allows blob:.

## 4.167.0 — 2026-11-09

- **The Feed, everything on the network, day by day** (the owner: "one huge feed of everything… all kinds of events and
  even global chat… everything date by date… filter it by different things"). Community #310's kinds draw as rows of
  what happened: people who joined (the count on a green tile), a busy chat room ("#general is busy", 15 messages this
  hour), a quest badge (the person's face with a trophy), a calendar event (a date tile, the start in your own time), a
  wiki page (its name, not its address), a stream that is over and the network's updates. Pictures, videos and posts
  stay cards; their views, likes and replies show as icons with numbers.
- A quiet **day line** (Today, Yesterday, the weekday, then the date) where the day changes; under an earlier day a row
  says its clock time, not "yesterday" again.
- New chips: **Following** (signed in: the people you follow), Chat, Events, Wiki, Quests.
- One centred column on a computer (two columns left holes beside tall cards).
- Fixed: a card with no picture (or a person with no avatar) drew a broken image of the page itself: `safe('')` resolved
  an empty address against the page. Fixed: the Feed's root class `ovf` was the footer's, so the Feed took the
  footer's margin, padding and top border (the gap above the chips); the Feed's classes are now `ovfd-*`.
- Past go-lives fold into one card again now that Community sends them as kind `stream`.

## 4.166.0 — 2026-11-09

- **The Feed on every site** (the owner: "I still don't see the custom doom scrollable feed"): the menu's Feed, wall and
  composer reach Community through Network's frame relay (`https://openvibe.network/api/frame/feed`, `/wall`,
  `/status`; Network #714). Every site's Content-Security-Policy allows openvibe.network and refused
  openvibe.community, so on every site but five the Feed fell back to its old sections. `o.frameBase` overrides the
  relay (tests, staging); the menu no longer calls openvibe.community directly.

## 4.165.0 — 2026-11-09

- **Faster between pages and sites** (the owner, 11-09: "when you change sites… faster across sites… better caching on
  the client"): the navbar adds a same-site prerender rule beside its prefetch, and prefetches links to the other
  OpenVibe sites; `openvibe-shared/sw` sends the shell's files in a 103 Early Hint. The shared worker
  (`/openvibe-sw.js`, also the Web Push worker) keeps **only content-addressed files** (a hash in the name or
  `?v=<hash>`: immutable, public) and answers them from its cache; pages and every other file go to the network as the
  browser sends them, so no page copy outlives a sign-out, nothing cuts a slow page off, and no stale script meets new
  HTML (security review). A kill switch (`/api/v1/sw-config` on Network) unregisters it everywhere. Sites opt in to
  registering it with `OpenVibeNavbar.init({ sw: true })`.
- `robots.txt` welcomes Perplexity-User, Claude-User and Claude-SearchBot by name (discoverability, ask 93).
- You: **Most used** links to **Your stats** on OpenVibe Report (`/me`: private by default, each section publishable).

## 4.164.0 — 2026-11-09

- **Chat's two views** (`openvibe-shared/messages`, `OVMessages.render(el, { messages, view: 'room' | 'bubbles', me })`;
  the owner, 11-09: "texting bubbles like Android/iOS Messages, and the live chat room… switchable"). Bubbles: runs join
  on the inner corners, the avatar beside the first with its column kept through the run, a coloured initial when there
  is no picture, the time under the last, read ticks, sticky day chips. Room: one line per message wrapping under the
  name on a phone, each person's name in a steady colour (tuned for dark and light). Only the newest message animates.
  `OpenVibeUserMenu.register()` lets a site add actions to the shared user card.
- **Page head** (`kit.pageHead({ back, icon, title, lede, actions })`; ask 64: "less websitey… an icon system"): a small
  named back chip (44 px to the finger), the page's icon tile and name, 44 px actions, and the lede once and whole on
  every screen. Product heroes can opt in (`showcase.hero({ pageHead })`).
- **Upload kit** (`ov-upload.js`/`.css`: `OVUpload.picker`, `.queue`, `.progress`): drag and drop or choose, each file a
  row with its picture or a file glyph, an × and its own progress (speed and time left smoothed); the total above for two
  files or more; done draws a tick; Calm drops the sheen. Sites bring the transport (`upload(file, { onProgress, signal })`).
- **The Feed, fixed for real data** (Community's /api/v1/feed is live): LIVE shows only while a channel is live now
  (`live_now`, with a breathing chip and a red edge); back-to-back go-lives that are over fold into one card of faces and
  names; a trending picture shows its site's icon and "Trending" (not a "?"); video cards no longer leave the flow (their
  class collided with the preview video's, `.ovf-video`; cards are `.ovf-k-<kind>` now).

## 4.163.0 — 2026-11-09

- **You, redone** (the owner, 11-09: "the U tab still sucks, and you didn't do all the improvements"). You on top: your
  picture (online), name and @handle linking to your profile, with **Display** beside it (the Look panel: theme, icons,
  appearance, text size, motion, opening in place; navbar passes `look` to the menu) and **Settings** (Account). Display
  leaves the foot of the tab for signed-in people.
- **Jump back in** is a row of cards you swipe: each place's own hue icon, a two-line title, a time that keeps up while the
  menu is open, and LIVE with a breathing ring for a stream that is on now. It replaces Recent, which repeated the grid.
- **Most used**: the pages you opened per site, as one bar and its key (five colours that tell apart in dark and light).
- **Your own AI** is one compact row (mark, words, Set it up, an ×): a third of the height.
- **Smart folders**: until you arrange your home, the sites past the first page sit in folders from the network's groups
  (Watch, People, Make, Read, Play, Shop). A folder shows four different icons (Quick tools showed `</>` four times).
- **Drag lands where you drop**: the drop is found by the grid's slots, not the sliding apps' drawn boxes (an app sliding
  under the finger took the drop, so it landed one place off now and then).
- **The video player's bar matches Live's**: 40 px buttons (44 on touch), centred icons.
- Calm keeps the cards' fade and a slower live breath.

## 4.162.0 — 2026-11-09

- `kit.head` accepts an icon tile; `kit.section` accepts an icon and an action row that wraps on phones.
  Rails accept an icon and use a labelled button for their action. Existing section markup is preserved when neither option is supplied. Empty-state actions already use primary
  icon buttons. `tools/plain-sections-sweep.js` audits public pages for plain UI headings, empty lines and action links.
- **The menu's You tab is a home screen** (owner, 11-09: "make it more like a phone"). `ov-home.js` (a sibling, loaded
  the first time You or Feed opens): your Actor on top (its state and step, or one invitation), Recent (the last five
  places opened), then Home: your places in a grid, the most popular until you arrange it, with Tools (every tool with
  its own icon) and Build as folders. A long-press (or Edit) starts arranging: drag an app to move it, arrow keys move
  the focused one, − takes it off Home, All apps (N) lists every app and puts one back with +. The arrangement is kept
  on the device and on Network (`GET/PUT /api/v1/me/home-screen`, once Network serves it). Recent searches are gone
  from You (the field shows them).
- **The Feed tab is a wall.** What's new with you (the composer, when Community says you can post), today's numbers
  (people, streams, posts, new videos, with 14-day lines), the live bar, then the network's pulse: newest first,
  back-to-back "went live" in one row of names, Show more. Every feed card shows until you turn some off (was the
  first two); What's new names each site, what changed in plain words, when, "New" since your visit and "Big update",
  and counts today's changes.
- **The first tab is the site's name, never a page's word for itself** ("Home", "Welcome").

- **The Dock fills the phone, and its header is one row** (owner, 11-09: "go all the way to the top… wasted space", "I
  don't really understand what the pin does", "clicked off… it didn't close the pop over"). Phones: the Dock is the
  whole screen, over the bar, inside the notch area; tablets: a full-height panel on the right; desktops: a 420 × 640
  card by default. The header is the four tabs, then More and Close; More holds Start a timer, "Keep the Dock's button
  on every page" (a switch that says what off means) and Open in a window of its own. More and the timer close on a tap
  anywhere else, in the Dock or on the page, and on Escape. The Chats tab is **Messages**.

- **No pill above the headline.** `sc.hero()` no longer draws an eyebrow (the owner, 11-09: the pill above every home's
  headline "looks really cheesy… generic"); the headline and its lede say what the site is. `eyebrow` is ignored.

- **Changing pages feels like one app** (owner, 11-09). A page chosen in the menu closes it (folding into the orb on a
  phone) without spending Back; a menu still open when a page is swapped in place marks the new page; a link that leaves
  the page draws the top bar at once. The bar (navbar and Boost alike) is 3 px of the OpenVibe gradient from the theme's
  accents, with a soft glow and a bright running head; reduced motion keeps it still.
- **Loading fits a short player** (the owner, 11-09): under 300 px the mark, words and buttons shrink and the hint goes;
  Try again carries the retry arrows and other actions are icon buttons; the V ticks green before the screen fades.
- **The Dock's Actor tab** (#351, under the name Agents), **Dock chats from a site's session** (#364), **one sheet
  behaviour for scroll and dismissal** (#371), **six glyph styles** (#367) and **section headings with icons** (#369).

## 4.161.0 — 2026-11-09

- **Menus open from where you tapped** (the owner, 11-09: "custom animations… content aware… where you're clicking"):
  `OpenVibeNavbar.pop(el, trigger)` / `.unpop(el, done)`, a clip reveal with a small spring from the trigger and a quick
  close; the account menu, the Display panel, the composer's Options and Attach, and the Dock (from its pill on a
  computer) use it.
- **Calm is gentle, not still** (the owner: "the animations need to work even on calm mode"): the mark still animates a
  state (its loops play once) and menus pop small and short; only intros, hover plays and the season's leaves rest.
- **The menu's tabs show what they are**: this site's own mark, Feed with a live dot or a count of what changed since
  you last looked, You with your picture and an online dot; the tab is remembered per site.
- **You**: app icons (no ring; the glyph fills a squircle tinted with each app's own hue), Quick tools named apart from
  the Tools site with each tool's own icon, a grid that fills a computer's width, editing that never scrolls the page
  and scrolls the list near its edges, the AI invite redesigned; Jump back in with each site's icon, cleaner titles and
  Live now.
- **The account menu**: Wallet and Profile tiles; the footer keeps light, dark and auto with one Display button; the
  Look panel holds text size and motion with the theme and icons; the menu's Display row matches.
- **The Dock**: Close is the menu orb in its x form; More's dots sit on the centre line.
- **Sideways strips say they scroll**: kit rails and `[data-ovk-scroll]` fade at the edges where more is hidden, show a
  position bar, nudge once on a phone, and `drift` moves until the first touch.

## 4.160.0 — 2026-11-09

- **Feed v2: the menu's Feed is a real feed** (the owner, 11-09: "a real feed… you scroll through easy content… a filter
  system… clean, intuitive"). When Community's `/api/v1/feed` answers, the Feed tab is the composer, today's numbers, the
  live bar and one stream of cards by kind (live, clips and videos with a muted preview that plays only in view and never
  with reduced motion or data saver, pictures, posts, memes, games, compact updates), chips on top (For you, Live, Clips,
  Videos, Pics, Posts, Memes, Games, Updates), more as the end comes near, "You're all caught up" at the end; without
  the API, the wall and its sections stand as before.

- **Every section heading has an icon, and sections stand apart** (the owner, 11-09: "these section titles should have an
  icon… look nicer and more consistent, separate things… a universal system"). The showcase kit's headings carry an icon
  tile (features: grid, steps, code, demo, compare, pricing, limits, stories, stats, cards, spotlight, questions, network,
  apps each have a default; `icon:` picks another); each section has a hairline and room above it.
- **More on OpenVibe** (was "Part of OpenVibe"): the related sites with their icons, a live "Happening on OpenVibe" strip
  (who is live and the sites' trending items, from Network's Frame, text only) when the page includes `sc.NETWORK_JS`,
  and "Every OpenVibe site →" to openvibe.network/sites.

- **`openvibe-shared/ai-marks`: the AI makers' marks, one place** (the AI comparison plan, R3; the owner, 11-09: our
  hand-drawn family glyphs read as "what is it even supposed to be?"). `family(idOrName)` finds the maker from a model
  id, slug, family or provider name (16 makers: OpenAI, Anthropic, Google, Gemma, Meta, DeepSeek, Qwen, Mistral,
  Moonshot, Zhipu, MiniMax, Microsoft, xAI, NVIDIA, Cohere, Perplexity); `mark()` draws it monochrome in a theme tile,
  labelled with the maker's name; anyone else gets the neutral spark. Drawings from @lobehub/icons-static-svg (MIT),
  regenerated by `scripts/build-ai-marks.js`.
- **The composer's Options, the navbar's own buttons, the keyboard** (the owner, 11-09, on openvibe.codes: "too many
  options… hidden under a cog"; the sidebar button "to the left of the logo… the navbar SDK and API… other people can add
  icons"; the keyboard "takes up a lot of space"). `thread.composer({ options, examples })`: one Options button with the
  pickers behind it (a panel on a computer, a sheet on a phone with the page held still, a `<details>` without script),
  changed pickers as chips with ×, a dot on the button, and a placeholder that walks through examples.
  `OpenVibeNavbar.lead(spec)` and `.action(spec)`: a site's own buttons in the bar; a kit sidebar's toggle moves there on
  a phone. `html.ov-kb-open` and `--ov-kb` on every site; start pages fold `data-ovt-fold`; the Dock's phone sheet ends
  above the keyboard and no longer opens it by itself on a touch screen.
- **The Dock's pin is an upright pushpin** whose lines never cross (it read as a pin with a line through it).
- **The composer's attach, answers' actions and the quiet line** (the owner, 11-09, on Vibe: "the image button is broken…
  support all file types… a better file attach button… Copy and Try again should be actual icons… 'Vibe can get things
  wrong' should be under"): attach is one + button for every file type, and with `attach: { menu: true, library }` a
  menu of Files, Photos and videos, Take a photo (phones) and From your OpenVibe files; Copy and a site's actions are
  icon buttons named by their word (a tick when copied; Try again draws the retry arrows); the composer's note sits
  under the box.
- **A phone's drawer holds the page still** (kit.sidebar): the page behind cannot scroll and the drawer never hands its
  scroll on (the owner: a swipe on the drawer "scrolls the actual page").

## 4.159.0 — 2026-11-09

- **Homes v2: `openvibe-shared/showcase-stage`** (plan `OpenVibe_Homes_v2_Plan_2026-11-09.md`; the owner, 11-09: "make the
  home pages more unique… show the features… custom animations… infographics… a shared, modular system… still SEO
  friendly"). `stage()` is a hero with one H1, the lede and a live demo panel of the product (the site's own HTML in a
  window, phone or card frame) over the site's motif (13 drawn motifs: wave, planes, strip, shutter, bubbles, converge,
  rise, path, stickers, grid, pen, orbit, cursor); `reel()` features as cards that swipe on a phone with a small motion
  each; `numbers()` real numbers that roll up once with 30-day lines; `flow()` how it works with a line that draws.
  Server-rendered words and numbers; motion only adds, never inside an SVG's children, and stops for reduced motion and
  Calm. Its CSS (`CSS`) and starter (`MOTION_JS`) are separate, so homes that do not use it do not grow.

## 4.158.0 — 2026-11-09

- **The menu's Home.** A site whose links never name its home (Exchange: Models, Chat, Arena…) now gets Home first in
  "On <site>", and on the home page Home wears the highlight like every other page's link (owner, 11-09). A site that
  already names its home gets no second one.

- **Footer legal links are 44 px wide to a finger.** On a touch screen, Terms, Privacy, DMCA and the compact links
  reached 36 px across (11-09 tap audit on six sites, `tools/tap-audit.js`); their hit area now extends 5 px each side
  (they sit 20 px apart, so the areas never meet).

## 4.157.0 — 2026-11-09

- **Every shell page has a tab icon.** `shell.page()` adds the service's OpenVibe mark (`openvibe-shared/app-icon`
  `favicon`, the same tint as its app icons) as an inline SVG `<link rel="icon">` when the page's `head` has none.
  Without one the browser asked `/favicon.ico`, which most sites answer 404, and the tab showed a blank page icon
  (11-09: openvibe.computer, openvibe.email and openvibe.studio). A page with its own icon keeps it; `favicon: false`
  opts out.

## 4.156.0 — 2026-11-08

- **Locker unlocks with a passkey on this device.** Setting up a locker can use a passkey instead of a passphrase:
  the passkey's PRF output (user verification required) seals the private keys, and only the credential id and its
  salt are kept in this browser; the 24-word recovery kit stays the way back on any other device. Unlocking offers
  "Unlock with this device's passkey" when one is set up. The kit can also be printed.
- **Shared files open as streams** (`OVLocker.openStream`): large locked files are read chunk by chunk, each one
  verified, without holding the whole file in memory. No private key is handed to a service or a caller.
- `ov-locker-core.js` is regenerated from openvibe-sdk 0.101.0 (bounded header checks against a stored byte count,
  key export after recovery).

## 4.155.0 — 2026-11-08

- **The menu names each site by a short product name** (the owner, 11-08: "the names of websites … not cut off …
  cleaner and nicer across all the websites"). On openvibe.website the first tab read "Websites that l…", the box
  "Search Websites that look finished, or a…" and the heading "On Websites that look finished": the page title's last
  part, a tagline. The name now comes, in order, from the site's own short label, the network's name for the address,
  the "OpenVibe.X" in the title, then the address itself (openvibe.website → Website, openvibe.party → Party), and a
  title part only when it is short. Website, My, Link, Party and Computer read right now; every other site keeps its name.
- **A site under a path is that site only on that path:** Inventory lives at openvibe.my/inventory, so openvibe.my
  itself is My, not Inventory (the match was by host alone).
- Tests: `test/search-site-name-chrome.test.js` (a tagline title, a long label, and a path-aware site; it fails on
  4.154.0 with the owner's exact text).

## 4.154.0 — 2026-11-08

- **Float your agent's screen** (the owner: overlays "usable for agents, Vibe chat, Codes"). The Dock's Agents tab
  gains **Float** beside Pause, Curtain, Mute and End: the agent's live screen (Live's agent embed, with its own
  renewing view ticket) moves into a floating card that follows the person around this site and on to other OpenVibe
  sites, and the Dock closes while they watch.
- **Link shares are not first-party** (ahead of Connect's shares moving to `<label>--<user>.openvibe.link`): a share
  is a person's own app, so `*--*.openvibe.link` and `*--*.openvibe.website` are never a card's source or a card's
  destination; only openvibe.link itself and connect.openvibe.link are.
- Tests: `test/overlay-chrome.test.js` (share hosts refused, Link's apex and Connect allowed).

## 4.153.0 — 2026-11-08

- **Signed in to the network, signed in here — on phones too** (the owner: "Why am I not auto signed into some domains
  even though I signed into the network?"; the audit: 3 of 56 sites signed a person in with third-party cookies
  blocked, 46 with them allowed). The navbar's quiet check asked Network from a hidden frame, which a browser that
  blocks third-party cookies never lets see Network's session. Now, when there is a reason to think the person has a
  session (this site signed them in before, or they arrived from another OpenVibe site, by its referrer), the navbar
  takes the top-level round trip (`/auth/login?silent=1` → Network `prompt=none` → back), where Network's session is
  first-party; a guest comes back with `sso=none` and is not asked again. A first visit from anywhere else keeps the
  quiet check and FedCM, so a newcomer from a search engine gets no redirect. At most once per tab per ten minutes,
  never for bots, never after a sign-out.
- **overlay.js:** a page that already plays what a carried card would (Live's channel page for its own embed) turns
  it away with `window.OVOverlayHere = (card) => true`; cards are restored after the page's own start-up.
- Tests: `test/navbar-auth.test.js` (referrer from OpenVibe, Shoes, a search engine, typed in, the same site, a
  look-alike host), `test/overlay-chrome.test.js`.

## 4.152.0 — 2026-11-08

- **Floating cards that follow you across OpenVibe** (`overlay.js`; the owner: a mini player you move and resize like
  YouTube on Android, with the room's chat, that keeps going on other sites, and an SDK any site, agent, Vibe chat or
  Codes can use). `OpenVibeNavbar.overlay({ id, src, title, href, live, side })` opens a card that frames a first-party
  page (Live's `/embed/<name>`, a chat, an agent): drag it and it settles in the nearest corner (a flick carries it),
  pull or throw it off the side to close it, resize it with its grip, two fingers or a double tap, and a tap shows
  its controls (LIVE, its name, sound for a Live embed, chat, open the full page, close). It sits between the navbar
  and the phone's app bar, never under either; its chat opens beside it, or as a sheet above the app bar on a phone.
  At most three at once, each in its own corner; corner and size remembered per kind on the device.
- **Across sites:** while a card is open (or a page declares one: `OVOverlay.declare(id, …)`, for Live's own mini
  player), a same-tab link to another OpenVibe site carries it in `#ovo=…`; the next site's navbar loads overlay.js,
  opens the same cards and takes the hash out of the address at once (it never reaches a server). Only first-party
  https sources open, checked again on arrival; a reload on the same site brings the cards back.
- **The next site starts sooner:** when a pointer, a finger or the keyboard reaches for a link to another OpenVibe
  site, the navbar opens the connection to it then (preconnect + dns-prefetch, up to 12 origins a page).
- Test: `test/overlay-chrome.test.js`.

## 4.151.0 — 2026-11-08

- **The menu marks the page you are on** (the owner, on openvibe.chat/messages: "highlight based on page"). In
  "On <site>", the link whose path is this page's, or the longest one this page sits under (/messages/abc under
  Messages), wears the accent and `aria-current="page"`; "/" only on the home itself; another site's link never.
- **On a phone the menu opens without the keyboard.** The orb opens a menu, not a search, so the field is no longer
  focused when it opens there (the keyboard covered half the menu); focus goes to the close orb until the person taps
  the field. On a computer, and when the menu opens with "/", the field is focused as before.
- Test: `test/menu-here-current-chrome.test.js`.

## 4.150.0 — 2026-11-08

- **The menu's button turns into its close, on top of the menu** (the owner: "make it render on top … a cool effect as
  it goes in and out of the menu … turns it into the close button when it's open"). On a phone the menu covers the bar,
  so it draws the orb in the button's own place, on top: as the menu grows from it, the orb glides into the search
  field's end and its nine dots turn into an x (the edges fold away, the corners and the centre stay). That orb is the
  close; the separate round x is gone. Closing plays it backwards: the orb glides back, its x turns back into dots, and
  the menu folds into it. Reduced motion: no movement.
- **The bell opens your notifications.** With the Dock on the page, its Activity tab is the bell's list, and the bell's
  own panel opened under the Dock's sheet, so a tap seemed to do nothing (the owner). The bell now opens the Dock on
  Activity, and a second tap closes it; without the Dock it opens its panel as before
  (`OpenVibeNotifications.setBellAction`).
- **The Dock on a phone shows every tab whole.** The open tab's name was clipped ("Ac") because four tools took the row.
  The header is two rows on a phone: the tools beside the grab handle, then the four tabs sharing the width, each icon
  over its name. The pop-out (a separate window) is not offered on a phone. The notification filters scroll sideways,
  and a fade now says so.
- **Press feedback** on the bar's orb, messages, bell and picture: a small spring on a tap.
- Budgets: dock.js 16.80 KB brotli (16.55 measured).
  Tests: menu-close-chrome (the orb is the phone's close, its dots an x, one close, it folds and closes),
  dock-size.

## 4.149.0 — 2026-11-08

- **The menu has tabs at the top** (the owner, 11-08: "we should have tabs at the top … a feed tab, which allows the
  user to set the feeds … remember whichever tab the user last had open … the main tab should just show links that
  exist on that site, and under that the full list of sites … make it nicer, more compact"). Under the search field,
  one segmented row: **this site** (labelled with its name), **Feed** and **You**. The menu reopens on the tab last
  chosen (this device); the legacy drawer's "All sites" still opens on this site's tab.
  - **This site:** its own pages, then every OpenVibe site in a compact grid (a small icon and the name, three to a
    row, two on a phone), grouped as the Frame groups them with this site's group first and this site marked. No fold.
    Who is live shows here only on openvibe.live; everywhere else it is the Feed's (it confused people elsewhere).
  - **Feed:** who is live (and a red dot on the tab while anyone is), the feeds the person chose (Video's trending,
    the forum, Games' new worlds…), what changed lately, places new to them and where people go next from here; the
    chooser ("Choose your feeds (2 of 4)") at its end.
  - **You:** their workspace (signed in), their places (else the popular ones), the pages they were on, tools, their
    searches, and the display controls (theme, text size, motion).
  - Tighter section headings; switching tabs on a phone does not raise the keyboard.
  Tests: menu-feeds-chrome (three tabs; the feeds are on Feed; it reopens on the last tab), navbar-launcher (the list
  of every site, compact, no fold; Display on You), search-loading-chrome.

## 4.148.0 — 2026-11-08

- **On a phone the menu button is the orb, in the burger's place** (the owner, 11-08: "replace the hamburger with
  that button… we don't need both"). 4.137.0 kept one menu button on a phone but drew it as a plain three-line burger
  and hid the orb, the network's own nine dots with their ripple, wave and turn. The phone's menu button, at the bar's
  right where the burger was, now draws the orb: the same dots, the first-visit ripple, the wave while the menu loads,
  the glow on a press and the turn into a ✕ while the menu is open. Still one button: the orb beside the site's name
  steps aside at 860 px and below, as before; a wide bar is unchanged. The button opens the menu on this site's pages
  first, and the menu's round ✕ (4.142.0) closes it.
- **One size for the bar's controls** (the owner: "it should be a little bigger so it matches the sign in button…
  the things need to be more consistent in the nav bar in size"). Sign In, the orb, messages, the picture, the
  balances and a featured link are all 36 px tall (34 px on a phone under 400 px); before, Sign In was 33, the orb 34
  (28 by 32 on a phone, its dots drawn at 22 px), messages 32 to 36, the picture 32 and the balances 30 to 32. The
  orb draws its dots at 26 px (24 on a phone), and Sign In's corners follow the orb's (10 px).
  Tests: navbar-phone-fit-chrome checks, 320 to 430 px, that the one menu button draws the orb's nine dots and no
  burger lines and that nothing in the bar overlaps; navbar-brand checks the markup.
- **The phone's menu button keeps the bar's edge.** The orb's tap area reaches 12 px past the button, which pushed the
  bar 6 px past a 390 px phone: the page zoomed out to fit it and the Dock's pill sat 10 px from the edge instead of
  16. The button's tap area now stops inside the bar.
- Budgets: navbar.js 45 KB brotli (44.3 with the phone's menu button drawn as the orb).

## 4.147.0 — 2026-11-08

- **A link in a Dock message shows its card.** OpenVibe.Chat now resolves a known OpenVibe link when a message is sent
  (a video on OpenVibe.Video, a party invite, a shared voice or a skill on OpenVibe.Actor) and the DM API carries it on
  the message as `card`. The Dock draws it under the message: a small picture when there is one, the title as a link,
  one line, and the one move ("Watch together", "Join the party", "Borrow this agent", "Install"). The new sibling
  `dock-card.js` draws it and is loaded the first time a conversation shows a card, so dock.js grows by about 200
  bytes. Every field is data: text set as text, links only https, pictures only from openvibe.media (checked in
  `test/dock-chrome.test.js` with a card that tries a script link, a picture from elsewhere and a script button).

## 4.146.0 — 2026-11-08

- **On a phone, a home's words and its main action come first.** `showcase.hero` with an orbit put the picture above
  the title on screens under 860 px, so a phone saw a 250 px diagram before it saw what the site is or its one main
  button (Work's "Search the listings" sat at about 560 px). The orbit now follows the actions: the main button moves to
  about 270 px at 390 px wide, and the orbit, still a row of links to the site's places, follows it. It is a little
  bigger on a phone (up to 300 px), and the centre's caption is smaller and narrower, so it no longer runs into the
  lower circles ("from public boards" overlapped "Your agent" and "Alerts" on Work). Wide screens are unchanged.
  Found in the track X review of the Work home.

## 4.145.1 — 2026-11-08

- **The Dock stays open when a tap on the page opens it, on a phone.** The phone sheet closes on a tap outside it, and
  the tap that opened it (the share sheet's OpenVibe Chat, Ask your agent, any page button calling the Dock) was still
  on its way up when the sheet opened, so it read as outside and the sheet closed at once. A click made before the
  sheet opened is never "a tap outside" now. Found in the production proof of a party's Invite → OpenVibe Chat.

## 4.145.0 — 2026-11-08

- **ov-canvas.js: an agent's live panel, drawn the same on every site** (`actor.canvas@1`, Contracts 0.340.0, ADR-059,
  plan HO9). `OVCanvas.render(host, doc, { onAsk, onCheck })` draws headings, text, lists, checklists, tables,
  metrics, bar and line charts (inline SVG, their numbers also a table for screen readers), pictures and links.
  Every block is built node by node and text is plain. A picture is drawn only from openvibe.media (one that fails to
  load is removed), a link only when it is https, with its host shown. A button only calls `onAsk` with its label (the
  page sends it to the agent as the person's message); a tick calls `onCheck`. Without the callbacks the canvas only
  shows. An older version never replaces a newer one. A wide table scrolls inside its own box, so a phone's page never
  scrolls sideways. A bar chart stands on zero; a line spans its own range.

## 4.144.0 — 2026-11-08

- **Send it on OpenVibe.** The share sheet (ov-share.js) offers **OpenVibe Chat** first to a signed-in person (the Dock
  is on the page): the sheet closes and the Dock opens on **Send to…**. The person picks one of their conversations,
  or writes to someone new by their OpenVibe name, and the title and link wait in that conversation's box, unsent,
  until they press Send. Every site's Share button gets it with no change of its own: a party invite, a video, a
  paste or a post goes to a friend on OpenVibe in two taps.
- `OpenVibeDock.share({ text, title })` (dock.js; Send to… itself is `dock-share.js`, a sibling loaded the first time
  something is sent, so the Dock on every signed-in page grows by 0.3 KB) is the same move for any page: Chats opens on Send to…; Cancel
  goes back to the list. A name nobody has says so (and the nearest name it found). Starting a conversation by name
  reads OpenVibe.Chat's `/api/dm/users/search` and `POST /api/dm/conversations` with the person's own token.

## 4.143.0 — 2026-11-07

- Add `ov-sync.js` (seven domains plan B4): `OVSync.attach(mediaEl, { room, socket })` follows a `common.sync-clock@1` timeline over Chat's room socket. It measures the server clock with five `time` samples (best round trip, refreshed every 60 s), computes the room's position from `position_ms + (serverNow - at_ms) * rate`, holds the element within ±80 ms (a 0.95–1.05 playback-rate nudge between 80 and 400 ms, a seek past 400 ms), pauses and plays with the room, and puts a non-holder's own seek, play, pause or rate change back with a short notice while a holder's change becomes a `sync`. No dependencies; served as `/shared/ov-sync.js` and imported as `openvibe-shared/ov-sync`.
- ov-sync follows an https source only; Chat already keeps a room's clock on OpenVibe's own hosts.

## 4.142.0 — 2026-11-07

- **The menu has a close button on a phone** (the owner, 11-07: "This needs a close button"). Since 4.129.0 the menu
  covers the whole phone screen, the navbar's burger included, but `search.js` still hid its Close button at 860 px and
  below on a site with a burger, so only Back closed it. Now a round x (40 px, a 48 px hit area, "Close the menu" for a
  screen reader) sits at the end of the search pill at 860 px and below; a wide screen keeps the word Close. Test:
  `test/menu-close-chrome.test.js` (a phone layout: shown, on screen, the hit area, a tap closes; wide: the word).

## 4.141.0 — 2026-11-07

- **The forms kit loads when a form control is drawn, not merely present** (the owner, 11-07: "make things faster and
  more optimized").
  - A closed dialog's or a hidden box's select, checkbox or file input no longer counts.
  - Live's shell carries hidden modal forms, so every Live page fetched `ov-forms.js` and `.css` (17 KB) for
    controls nobody saw.
  - Hidden controls are watched with an IntersectionObserver, and the kit loads when one is drawn (a dialog opens, a
    fold unfolds).
  - A page with a drawn control loads it once it settles, as before.
  - Test: `test/forms-when-seen-chrome.test.js`.

## 4.140.0 — 2026-11-07

- **Native: no more Material lavender.**
  - The Compose export (`tokens.compile(…, 'compose')`, `scripts/native-check.js`) now maps Material 3's container
    roles to Vibe surfaces: `surfaceContainer*`, `surfaceBright`/`Dim`, `surfaceTint`, `secondaryContainer` (the
    navigation bar's selected pill) and `inverseSurface`.
  - Before, Compose filled cards, the bottom bar, dialogs and chips with its own lavender. OpenVibe Link for
    Android's first screens showed it.
  - Flutter's scheme is unchanged: its constructor takes these roles only from 3.22.
  - No web change, so no pin round is needed for this release.

## 4.139.0 — 2026-11-07

- **The menu's feed rows lead with their picture.** A row with a thumbnail (Trending on Video, a live channel) no
  longer shows the site's icon beside it: the picture is larger (72 × 40) and the title moves left. In a group where
  some rows have a picture, the others carry their icon in a picture-sized tile, so the titles line up. A group with
  no pictures (New worlds) keeps its icons.
- `navbar.js`'s SIBLING_REV carries search.js's new hash.

## 4.138.0 — 2026-11-07

- **38 KB off most first visits** (the owner, 11-07: "make things faster and more optimized"):
  - the footer's "shipped" line (`shipped.js`, 12 KB) is fetched only when the footer comes near the screen;
  - brand logos (`brands.js`, 26 KB, the footer's social links) wait until a logo is near the screen, or opens
    from a fold;
  - most visits never scroll that far.
- **The rest of the files loaded from beside Shared's scripts go by content hash** (4.137.0 did the bar's):
  - `shipped.js` from the footer and from `frame.js`'s updates pages;
  - `brands.js` from the glyphs, through their build;
  - `route-transition.js` from Boost.
  - `scripts/sibling-revs.js` writes FOOTER_REV and BOOST_REV; `scripts/build-glyphs.js` writes BRANDS_REV.
  - Run the glyph build first, then sibling-revs.

## 4.137.0 — 2026-11-07

- **Releases reach phones at once.** The bar loaded the menu (`search.js`), the Dock, presence, panels, notifications,
  history, the site switcher, the app bar, the release watcher, the icons and the sign-in client without a version.
  - They went out as `max-age=300, stale-while-revalidate=86400`, so a phone could keep the old menu for up to a day
    after a release. The owner still saw the menu without feeds hours after 4.135.0.
  - Every one now loads by its content hash (`?v=`), which sites serve `immutable`: each release is new URLs, and no
    edge or browser has an old copy to give.
  - The Dock's add-ons (Vibe, the Action Center, the timeline, the agent view, the timer) and the notifications'
    realtime file go the same way.
  - `scripts/sibling-revs.js` writes all three tables. `test/sibling-revs.test.js` fails on any sibling loaded
    without its hash.
- **One menu button on a phone** (the owner, 11-07: "these buttons do the same shit"). Where the burger shows (860 px
  and narrower, on a bar with page links), the orb that opened the same menu steps aside. A bar without page links
  keeps its orb, its only way in.
- **One Close.** On a phone the menu's in-box "Close" steps aside for the burger's ✕.
- **The menu opens at once.** search.js is prefetched at idle once the page settles (not on Save-Data or 2G), and as
  soon as a finger or pointer reaches the burger or the orb. By its hashed URL it is cached until the next release.
- Budgets: navbar.js 44 KB brotli (43.5 with the hashes, which do not compress, and the warm-up), dock.js 16.0 KB.

## 4.136.0 — 2026-11-07

- **One Computer in the Dock** (plan 2026-11-07: "Surf, Computer and Actor are one experience"): a timeline step
  that works on a Computer shows its machine and cost hint (`computer.machine`, `computer.cost_hint`) — the same
  object the task record and Surf's card carry, never a copy. The Now card offers **Take over** (and **Give it
  back** while you drive) on a step that names its task (`ref`) and its Computer: one call to OpenVibe.Actor's
  `POST /api/v1/tasks/{id}/takeover` or `…/giveback`, the same hand-off the agent's own `hand_to_person` uses.
  No new layout and no new CSS: the line is an existing meta row and the button an existing Dock button.

## 4.135.0 — 2026-11-07

- **Ask your agent, from any page** (plan Z3; the owner, 11-07: "have your agent with you wherever you go"):
  - `kit.askAgent({ text })` draws a chip ("✦ Ask your agent"). Any control with `data-ov-ask="…"` works the same way.
  - A tap opens the person's Vibe in the Dock with the question waiting in its box, this page's context included. It is
    never sent for them: they read it, change it and press Send.
  - Signed out, the navbar sends them to sign in.
  - New calls: `OpenVibeNavbar.askAgent(text)` and `OpenVibeDock.ask({ text })`.
- **Your feeds follow you** (the menu's "Choose your feeds", 4.132.0):
  - signed in, the choice is saved to Network (`PUT /api/v1/me/menu-feeds`, network.menu-feeds@1);
  - it is read back on a new device the first time the menu opens there;
  - a first choice made before signing in is sent up then;
  - this device's copy paints at once and stands whenever Network does not answer, and the route is new, so until
    Network ships it nothing changes.
- **Every page opens its connection to openvibe.network early** (`seo.headTags()` adds
  `<link rel="preconnect" href="https://openvibe.network" crossorigin>`, except on the Network itself;
  `preconnect: false` turns it off). The phone-speed report of 11-07 found 102 of 108 pages asking openvibe.network for
  the bar, sign-in and the menu without one.

## 4.134.0 — 2026-11-07

- **Fixed: the Dock's Agent panel could not read the timeline.** The navbar hands the Dock the person's token as a function (it may change when they sign in again); the panel used it as a string, so every call went out as `Bearer function…` and the panel said the agent was not reachable. The token is now resolved when a call is made.
- The Dock can open at a step: `OpenVibeNavbar.openDock('agent', { task: 'tsk_…' })` marks that entry in the timeline and brings it into view, so a site can send the person to the exact task it started for them.

## 4.133.0 — 2026-11-07

- The menu's network cards draw an entry's picture when the site sent one (`frame.menu-card@1`'s optional item `image`, openvibe-contracts 0.320.0): a 64×36 rounded thumbnail, `object-fit: cover`, `loading="lazy"`, `decoding="async"`, empty alt, before the title and after the site's icon. The `src` is checked again in the menu (https only); a card or entry without a picture renders exactly as before.

## 4.132.0 — 2026-11-07

- **Your feeds in the menu** (the owner, 11-07: "integrate OpenVibe.Today and OpenVibe.News … the user should be able to
  configure which data feed streams are shown"):
  - every card a site publishes (`frame.menu-card@1`, collected by Network into the Frame's `cards`) is a feed you can
    choose;
  - "Choose your feeds (N)" under them lists each with a tick and two arrows: tick to show it, arrows to order it, four
    at most;
  - the choice is kept on this device (`ovs-feeds`). With none chosen, the Network's first two show, as before.
- **Fixed: the menu's Frame fields were dropped.** The navbar's Frame cache kept only `nav`, `groups`, `soon` and
  `footer`, so since 4.128.0 the menu never saw:
  - `cards`: the sites' cards (Live now, Trending, New worlds);
  - `next`: where people go next;
  - `discover_ids`: New to you;
  - `menu.beacon`: the click beacon.

  It now keeps them, and search.js still checks every entry. The navbar budget is 43 KB brotli (42.8 KB).

## 4.131.0 — 2026-11-07

- **Your online status, on every site** (the owner, 11-07: "we could have online status, especially in DMs … Discord
  … people should be able to easily change it off"). New `presence.js`, loaded by the navbar beside itself for a
  signed-in person (`presence: false` turns it off):
  - **a dot on your picture** in the bar: online, away, do not disturb, invisible, or live — Network's own answer
    (`network.presence@1`, the self view), saved per person so every tab paints at once;
  - **a heartbeat** (`POST /api/v1/me/presence/heartbeat`) while a tab is visible, once a minute across tabs, and
    `idle: true` after five minutes without input so Network shows Away; the first input after that beats at once;
  - **Your status** in the account menu: Online (automatic), Do not disturb, Invisible, and a status line of your own
    (`PUT /api/v1/me/presence`). A card under the bar on a computer, a sheet from the bottom on a phone. Only people
    you follow or message can see it (Network's rule).

## 4.130.0 — 2026-11-07

- **Your things on every site** (the owner, 11-07: "make sure DMs are accessible across all sites … same with open coins
  and vibes … visible everywhere too"). For a signed-in person, every site's bar now shows:
  - **Messages**, beside the bell, with OpenVibe.Chat's unread count (`GET /api/dm/unread`, on load and when the tab
    comes back, at most once a minute). A click opens your conversations in place, in the Dock's Chats tab, read and
    answered there; with the Dock off it is a link to openvibe.chat/messages.
  - **The OpenCoins and Vibes balances** (the `wallet` chips of 4.24), folded into one pill on a phone as before.

  Both are on unless a site says `wallet: false` / `messages: false`, or brings its own (Live's chips, Chat's
  messages keep theirs, with their own counts). A signed-out page shows and asks nothing.

## 4.129.0 — 2026-11-07

- **One menu** (the owner, 11-07, on the right-hand drawer: "sloppy … maybe combining this menu and the other menu and just
  putting our main button on the right-hand side"). The burger now opens the OpenVibe menu, grown from the burger:
  - this site's pages lead, all of them (the drawer's job);
  - then the live bar, your places and workspace, the network, What's new, tools and Jump back in;
  - **Display** (Light/Dark/Auto, text size, Motion/Calm) sits at the foot, drawn by the same controls the drawer had.

  The orb by the logo opens the same menu with the places first. The old drawer remains only for a site that turns the
  menu off (`search: false`) or asks for it (`drawer: 'legacy'`). The burger's `aria-expanded` follows the menu.

## 4.128.0 — 2026-11-07

- **The menu, rethought around real use** (the owner, 11-07: Jump back in came first, people opened Sites every time just to
  reach Live, and it "doesn't spread traffic … not smartly done based on what's popular"). Network's data that day: Video,
  Live and Community take nearly all the page views, 48 of 67 signed-in people used one site, and people move Live ↔
  Community, Live ↔ Tools, Chat → Live, Live → Bot and Live → Video. One calm scroll, no tabs, in this order:
  - **Who is live**: "3 streams live now · 41 watching" and the live channels when Network names them (`pulse.live`).
  - **Your places**: a dock of eight big icons, the places this person uses most (else the network's most used, without
    developer services). One tap to Live from any site.
  - **On <this site>**: the bar's own links, two to a row, the rest behind "More on <site> (N)".
  - **Next from <this site>**: where people really go next (Network's moves; the Frame's `next` when it sends one).
  - **New to you**: two places this person never used, picked fairly from the ranked network so every place gets its
    turn; developer services only for people who use one. The pick holds for the whole opening.
  - **You** (signed in): your agents and Vibe (they open in the Dock), account, wallet, themes, machines.
  - **Tools**, **Recent searches**, then **Every OpenVibe site (N)** as one counted fold (this site's group first), and
    **Jump back in** last.
- `open({ tab: 'sites' })` opens the list of every site and `tab: 'tools'` scrolls to the tools, so old callers keep
  working.
- **A click beacon, only when Network asks for it** (`frame.menu.beacon`): the section, the position, where it led and
  the kind; no person and no page, so the menu can learn what helps and the ranking can spread people across the network.
- Touch screens get 44 px chips and header links.
- **Sites put their own content in the menu** (the owner, 11-07: "content aware … sites can interact and create their own
  content in the bar"), two ways:
  - **On their own pages, a card:** a site pushes `{ id, title, render(el, api) }` onto `window.OpenVibeMenuCards`
    (a queue that works before `search.js` loads) or calls `OpenVibeSearch.registerCard()`. The card draws itself
    under the workspace: Download's drop zone, Live's go-live status, Codes' new task. It is the site's own code on
    its own page. A card that throws is left out.
  - **On every site, from Network:** the Frame's `cards` (Network collects each site's
    `/.well-known/openvibe-menu.json`). The menu draws at most two, as a rail, rows or chips: Live's channels with
    their viewers, Games' new worlds, Video's trending. They are text and links only, re-checked here, and never
    another site's code.
- **Back closes the menu first** (the owner: Back on a phone left the page). Opening adds one history entry; Back pops
  it and only closes the menu. Choosing a link leaves cleanly.
- **The whole screen on a phone,** opened from the bar's orb as a circle that grows from the orb, under the safe area.
  No motion when reduced motion is asked for.
- **Your workspace** (signed in), right under your places: Agents and Vibe (open in the Dock), Codes, Files, Machines,
  Wallet, Account and Themes, one tap from every site (the owner: "access codes through this menu easily, and talk to
  your agent … less having to hop between sites").
- **What's new**: the newest real change on each site from the network changelog (library bumps left out), newest first,
  marked **New** when it shipped after your last visit there, each linking to that site's `/updates`.
- **The full list of sites**: the flagships first (Live, Video, Codes, Design, Space, Games, Chat, Tools), then every group;
  each site with its icon, a two-line description (no more cut-off words on a phone) and its own domain.
- **Every site has its own icon** (`ov-icons.js`, regenerated from Font Awesome Free 6 by `scripts/build-nav-icons.py`):
  Cam a camera, Casino dice, Surf waves, Fun masks, Meme a laughing face, Tours a compass, Vision binoculars, Shoes, Today,
  Report, Design, Domains, Exchange and Bench. Until now they borrowed a neighbour's (Cam showed Video's, Casino and Surf
  the gamepad, Fun Quest's trophy).
- **No spinning rings anywhere** (`ov-icons.js`; the owner, 10-31 and again 11-07 on Surf's and Space's cards: "things only
  spin if they're active"). The ring icons' comet spun forever on every icon on every site. Now the comet, the pulse and
  the bounce run only while `data-state="busy"`; at rest an icon is its ring and glyph with a small lift on hover.
  `data-fx` now says what *busy* looks like. Every site loses the idle spin with this release.
## 4.127.0 — 2026-11-07

- **The Dock's Agent panel** (design 2026-11-07, one agent behind the Dock): Now says what the agent is doing this moment (the mode, the step in plain words, how long, and Stop/Resume), Needs you lists every approval and question from any mode with its buttons in place, and the timeline below shows one entry per step — the mode, the title, where it ran and why, the outcome, the time, the cost and a link to the step's own page. A mode change is a line of its own.
- **Folding and filters:** today's entries are open, earlier days are counted folds ("Yesterday (14)"), and a long run of one mode folds into "12 more Code steps". A chip for each mode and for Needs you sits in the URL of the panel, and a filter never hides without a count.
- **Only me by default:** the panel shows the person's own entries only; a step's title, outcome and link, never a prompt or a diff.
- **It wears the site's theme:** the panel uses the site's own tokens and font (the navy of a dark site, the paper of a light one), with a 12 px gutter. Approve is the one filled button on a card and Stop is red. A running step's pill breathes; nothing else moves. Needs-you cards are tinted and labelled with their mode.
- **The Dock's tabs always fit:** in a narrow Dock the open tab shows its icon and name and the others their icon and count, their names kept for screen readers. "Activity" was cut off at the strip's edge.

## 4.126.0 — 2026-11-07

- **Audio description in the player (X1)**: a video with a `<track kind="descriptions">` gets an **AD** button beside
  Captions. It turns the descriptions track on and is remembered per person in localStorage, like the volume; **D**
  toggles it from the keyboard and its label says whether it is on. The active cue is shown over the picture and
  spoken through the browser's speech synthesis, so a blind viewer hears what is on screen between the speech. No
  descriptions track, no button. `player.js`, `player.css`, `test/player.test.js`.

## 4.125.0 — 2026-11-07

- **The owner's Setup page and clear settings** (`openvibe-shared/config`; OWNER-SETUP-AND-ADMIN-CLARITY-DESIGN, 2026-11-07). New schema annotations, passed through to the summary: `x-owner-input { group, unlocks, get_it_at, get_it_how, test }` marks a field for Network's Setup tab (the groups are `config.OWNER_INPUT_GROUPS`), `x-required-for` makes an unset field **Needed**, `x-enum-labels` gives every option of a choice words and a line, `x-advanced` folds a field under a counted "Advanced settings (N)", and `x-example` is a placeholder. A secret-class property loses `x-example` and `x-enum-labels` in the summary, as it already lost its default, examples and enum.
- **A wrong Setup annotation never refuses the store.** `x-owner-input`, `x-required-for`, `x-enum-labels`, `x-advanced` and `x-example` only change how a field is presented, so a wrong shape is left out of the summary with one warning (and `lintSchema` names it) instead of taking a service down at boot after a pin bump. A group given by its display name (`Voices`) is read as its id (`voices`), and `lintSchema` asks for the id. The D11 annotations (`x-env`, `x-danger`, `x-bind`, `x-unit`) still refuse the store: they decide where a value comes from and how it is guarded.
- **`config.lintSchema(schema)`** for each service's own test: it lists a field without a title, a description under 30 characters, or a choice without a label for every option. Empty means the admin panel can explain every field.
- **The summary classifies every schema property**, set or not: an unset secret key was missing from `classification`, so a form drew it as a plain field and the service then refused the value (422 `config.secret_write_only`). `classification` still names every key of `values` too.
- **A test hook in the admin routes:** `POST <base>/:namespace/test/:key` calls the service's `test` option with the stored value on the server and answers `{ ok, message }` in one line, scrubbed of every secret of the namespace; 409 `config.not_set` with no value, 404 `config.test_not_available` without a tester. `authorize` sees the action `'test'`.

## 4.124.0 — 2026-11-07

- **The Dock's agent view gets the four controls** (Agent Streams S5, Co-pilot): Pause and Resume, Curtain now, Mute and Unmute, and End, each sent through Codes to Live. The owner's own view may always resume; Live still refuses a moderator resuming the owner's pause. The line says "Paused by @name" when someone else paused the stream.

## 4.123.0 — 2026-11-06

- **The "not on the list" gate from markup**: `<div data-ov-share-gate data-kind data-id data-signed-in-as data-sign-in-url>` is started by `ov-share.js` when it loads (and by `OVShare.startGates()` for markup added later), once per element. Sites no longer write an inline script for it: an inline script needs a CSP nonce on most sites, and a value written into one with an HTML-escaping template turns its quotes into `&quot;` and breaks the script, so the gate never drew. The values are plain attributes, escaped like any other.

## 4.122.0 — 2026-11-06

- A thread start page (`page({ center })`) keeps its head at the top on wide screens: only the welcome and the composer are centred, by auto margins. Centring the whole column floated the head into the middle of a tall screen above an empty band (seen on openvibe.exchange/chat at 1280 px). Phones are unchanged.

## 4.121.0 — 2026-11-06

- **The Dock's agent view works in the window too** (Dock K-D4, on K-D3). The pop-out keeps the Agents tab's stream:
  the agent view's own style goes into the document it is mounted in, so a tab opened after the pop-out is styled in
  the window (and its style is not left on the page behind it), and a view already open when the Dock pops out carries
  its style with the rest of the Dock. Closing the window brings the same stream back to the page.
- No new file and no new request: `dock-agent.js` creates its nodes and its style from `container.ownerDocument`.
  `test/dock-chrome.test.js` covers the pop-out with the stream.

## 4.120.0 — 2026-11-06

- **The Dock's agent view** (Dock K-D3; `dock-agent.js`, `dock.js`; Agent Streams S1). The Agents tab now opens on the
  person's own desk stream: Live's embed (`/embed/agent/<ags_id>?vt=wvt_…`, the `AI agent` label, the curtain state and
  the viewer count on the picture), one line for the task with the time it has worked, and the owner's **Curtain
  now** and **End**. Above the list, and it hides itself when there is no stream, so the tab is what it was.
  - The view ticket is minted server-side by OpenVibe.Codes with the person's own token (`GET
    /api/v1/me/agent-view`) — a third-party iframe has no Live cookie — and the embed renews its own ticket while it
    plays, so nothing is re-mounted on a poll.
  - Nothing live: the last frame, read with the token and shown as a local object URL (an `<img>` cannot carry a
    bearer), with the task and the worked time.
  - No step line yet: steps are Agent Streams S2, and the view shows none until Live serves them.
  - `dock-agent.js` is a sibling loaded the first time the tab opens (3.9 KB brotli); `dock.js` grows 222 bytes and its
    budget goes to 15.50 KB. `navbar.js` passes `dockAgentBase` (default `https://openvibe.codes`).

## 4.119.0 — 2026-11-06

- A featured link keeps a place on the phone's bar: where the links row folds into the menu, the featured link (4.117.0) also shows as one tinted icon button beside Sign In or the avatar (38 px, 34 px under 400 px, a 44 px hit area on the element), named by its label for screen readers. The Node on the Network is one tap away on a phone. Only a featured link with an icon gets one; no animation.

## 4.118.0 — 2026-11-06

- Locker reset and unlock errors requiring fresh authentication now link to Network’s password reauthentication with the complete current page as the return destination, including `locker.proof_required`.
- Touch footer fold links are 44 px tall on the links themselves; the navbar TLD link is at least 44 px wide.
- Regenerate the Locker browser core from openvibe-sdk v0.92.0.

## 4.117.0 — 2026-11-06

- **A navbar link can be the site's one featured piece** (`navbar.js`; the owner, 2026-11-06: the Node on the
  Network is "a central piece", on its own subdomain). A link with `featured: true` draws as a quiet accent pill
  with its glyph on the bar — one hairline, one tint, the glyph, and nothing that moves — and leads the phone's
  menu. Every other link keeps its place and its plain look.

## 4.116.1 — 2026-11-06

- **A transfer of a people-locked item carries the recipient's slot.** The sheet wraps the content key for the new
  owner's key, saves the envelope with their slot (so they can open it while the offer is pending, before they accept),
  and sends the offer with that `key_slot` — which `openvibe-sdk/share` requires for a people lock. Someone without a
  locker is told so, and nothing is offered.

## 4.116.0 — 2026-11-06

- **The Share sheet's Locked part** (`ov-share.js`, `ov-share.css`; Locker design 2026-11-06, the pilot; docs/share.md).
  A locked item (`lock: people | password | link` in the share API's answer) gets its own part between Send it and Who
  can open it:
  - the lock in plain words, and a link lock says when the link in front of it is missing its `#k=` key;
  - a people lock shows each person's eight-word fingerprint, warns when their key changed since the slot was made,
    and offers **Use their new key**;
  - adding someone asks Network for their public key and wraps their content key on this device (the member row and
    the slot are saved together); someone without a locker is told so, not added;
  - removing someone seals the content again under a fresh key for those who stay, uploads the new envelope with the
    members, and says "They had the key before you removed them: they may still have a copy of what they already
    opened."
  - `ov-locker.js` loads on the first press of the part, never with the sheet.
- **`ov-locker.js`** gains the calls the sheet needs, all keeping the keys in the tab: `ensure()`, `keys(who)` (Network's
  key directory), `publicKeys()`, `rewrap(bytes, { add, remove, keys })` and `inspect(bytes)` (docs/locker.md).
- **`ov-locker-core.js`** regenerated from openvibe-sdk 0.89.0 (`seal.js` and `server.js` moved since 0.86.0).
  openvibe-sdk devDependency 0.86.0 → 0.89.0.
- test/ov-share-lock-chrome.test.js: the Locked part with the real crypto — lazy load, fingerprints, adding wraps for
  them (and the envelope that goes up opens for them), removing re-seals (and the removed person's key opens nothing),
  and a link lock keeps its key after `#`.

## 4.115.1 — 2026-11-06

- **Share sheet:** its headings no longer take a site's own `h2` rule (Wiki's bottom border and margin showed under the sheet's title). Every property a site might set on an `h2` is reset inside the sheet and the access gate.

## 4.115.0 — 2026-11-06

- **Locker in the browser** (`ov-locker.js`, `ov-locker.css`; plan Q2; docs/locker.md). The owner: "completely
  encrypted on our end … decrypted on the client's end, so we don't have access to any of the user data."
  - `OVLocker.open(el, { bytes | url })`: a locked item's card. A link lock opens with the key after `#k=`, and a link
    missing it says so. A password lock opens with its password, on the device. A people lock asks to unlock your
    locker, and someone not on the list is told so.
  - `OVLocker.setup()`: make your locker. A passphrase with a strength meter, a 24-word recovery kit shown once and
    checked with two of its words, then the eight-word fingerprint. Network keeps the public keys, a self-signature
    and two password-locked envelopes of the private keys.
  - `OVLocker.unlock()`: unlock with the passphrase or the recovery kit. "I lost both" starts a new locker (reset)
    after a plain warning.
  - Secrets stay in the tab's memory: never sent, never stored.
- **`ov-locker-core.js`**: `openvibe-sdk/locker` 0.86.0 for the browser, generated by `scripts/build-locker-core.js`
  from the SDK's own files (WebCrypto only).
  - test/ov-locker-core.test.js makes the SDK's vectors again in a browser-only VM, with the same bytes, and crosses
    envelopes between the browser and Node.
  - test/ov-locker-e2e-chrome.test.js uses the real crypto: make a locker, unlock it on a new device by passphrase
    and by recovery words, open what was locked for you, refuse what was not.
- openvibe-sdk devDependency 0.82.0 → 0.86.0.

## 4.114.0 — 2026-11-06

- **One Share sheet on every site** (`ov-share.js`, `ov-share.css`; plan track Q; docs/share.md). Press Share
  anywhere and the same sheet opens: a sheet from the bottom on a phone, a dialog on a computer, no tabs.
  - **Send it** (everyone): the link with Copy, which turns into a tick; on a phone, "Send with your phone" (the
    phone's own share sheet, with its contacts and apps); 16 places (X, Bluesky, WhatsApp, Reddit, Discord, Telegram,
    Threads, Mastodon, Facebook, email, Messages, LinkedIn, Pinterest, Tumblr, Hacker News, LINE), recent ones first,
    the rest behind "More (n)"; a QR code made on the device; "Start at 1:23"; embed code. Nothing is added to a
    shared link.
  - **Who can open it** (the owner, through `openvibe-sdk/share`'s router): Everyone, Anyone with the link, Specific
    people (by @name, checked as you add them; Can view or Can edit; an end date), Only me; people who asked;
    transfer of ownership, bound to the recipient, "Remove my access" by default. Saves send If-Match. A 401, 403 or
    404 leaves only Send it.
  - `OVShare.offer()` is the recipient's Accept/Decline banner; `OVShare.gate()` is the not-on-the-list page (Ask
    for access, or Sign in). Every name and title is text, never markup.
  - The navbar loads it on the first press of a `[data-ov-share-sheet]` button, so nothing loads before that. The
    kit's `[data-ovk-share]` items open it too.
  - Events: `ov-share:sent` `{ target, url }` and `ov-share:change`.
  - **A Share component** in OpenVibe Design (`openvibe-shared/components`, `kit.share({ title, url, kind, id })`): a
    kit document's `{ type: 'share' }` renders the button, and the spec gives its anatomy, states, keys, and the
    Android (Intent chooser with Direct Share) and iOS (`ShareLink`) views, so native apps share the same way.
  - **`ov-qr.js`**: a QR code from a link, made on the device with no dependency and no network (a Locker link's key
    stays on the device). `OVQR.matrix(text, { ecc })` and `OVQR.svg(text, { ecc, margin, dark, light, title })`;
    byte mode, versions 1 to 40, all eight masks. Ported from Nayuki's QR Code generator (MIT); checked module by
    module against bwip-js on 1,196 matrices (test/ov-qr.test.js). The sheet loads it on the first QR code.
  - **Brand logos**: Tumblr, Hacker News and LINE join brands.js (49 brands, Simple Icons 16.36.0, CC0).
  - Tests: test/ov-share-chrome.test.js (headless Chrome).

## 4.113.0 — 2026-11-06

- **Bot API calls can be counted at ingest, not stored row by row.** `AnalyticsTrackerPg` takes
  `countBotApiAtIngest` (off by default): a bot's API call increments `analytics_bot_api_hourly` and
  `analytics_bot_api_daily` by endpoint group, status class and bot family at flush instead of writing a raw
  `analytics_events` row. The hourly and daily rollups add those counters to raw rows, so a day's `api_calls`,
  `bot_hits` and `error_count` are what the raw rows gave before, and a day recomputed at close counts each call
  once. The admin's bot breakdown, status classes and sub-day summary include the counters; a raw page view by a
  bot still keeps its row, and the option off changes nothing. New tables are expand-only: `analyticsSchema()`
  creates them for a new install, and an existing service adds them in a migration.

- **Phone minimums in the kit** (the fleet phone sweep of 11-05/06): `.ovk-badge` is 12 px (was 11.2 px), and a room's
  own links (`.ov-room > a`) are 44 px tall on touch screens (were 40.6 px).

## 4.112.1 — 2026-11-05

- **The shared chrome meets the phone minimums** (the fleet phone sweep of 11-05, 322 pages at 390 px). Nothing
  changes on a computer.
  - **Text of at least 12 px:**
    - the footer's column headings (11.52 px on 305 pages of 55 sites);
    - its compact meta line (11.84 px);
    - the phone app bar's labels (11 px on 146 pages).
  - **44 px to the touch, measured** (`pointer: coarse` only):
    - the footer's legal links: their hit area was 39 px tall and is now 45;
    - the footer's "shipped" pill: 24 to 44 px;
    - the shipped list's rows: each row is 44 px and its subject fills it, so the hit boxes no longer overlap the next
      row's (4.46.0's padding-in/margin-out made 33.5 px boxes that did);
    - "All updates" and the patch-notes line: 18 px to 44;
    - the update log's commit hashes.

## 4.112.0 — 2026-11-05

- **`openvibe-shared/config`: `x-unit: "seconds"` is an owner-setting unit.** An integer property may now be
  annotated `seconds` (alongside `nano_usd`, `ms` and `bps`), and `summary()` carries the annotation unchanged so a
  settings form can show the input in seconds with the label "s". An unknown unit is still refused when the store is
  created, naming the unit.

## 4.111.1 — 2026-11-05

- **The tab icon is the Pair on every site.** `theme-loader.js` repaints the favicon on each theme apply
  (`<link rel="icon" data-ov-icon>`), and it still drew the retired ring mark: every site's inline Pair favicon turned
  into the old ring once the page loaded. It now draws `app-icon.js`'s `favicon()` (the heavy form, the site's glow,
  Live's red light and Games' yellow one) with the theme's `--bg-primary` as the tile; the theme accent no longer
  recolours the mark. The drawing is generated into the loader's `FAVICON` block by `scripts/build-theme-loader.js`
  from `mark.js` and `app-icon.js` (`--check` fails when stale), so it cannot drift again.
- Tests: `test/favicon-pair.test.js` (each site equals `favicon()`, the lights, the tile follows the theme, the block
  is current).

## 4.111.0 — 2026-11-04

- **`openvibe-shared/vibes-pay` (`vibes-pay.js`): Vibes Pay for any page** (MONEY.md, D12).
  - `OpenVibe.vibes.pay(payUrl)` opens the sheet in a 520 px popup on a computer and as the full page in a new tab on
    a phone (a blocked popup falls back to navigating the page). It resolves `{ status }` (plus `charge_id` and
    `pay_url` when known) from a `postMessage` whose `origin` is `https://openvibe.network` and whose data is
    `{ type: 'ov-vibes-pay', status, charge_id? }`; a popup closed without a payment resolves `{ status: 'closed' }`.
    The same result is dispatched as a bubbling `ov-vibes-pay` event on the document. Only
    `https://openvibe.network/pay/…` URLs are accepted; anything else throws before a window is opened.
  - `[data-ov-vibes-pay]` elements bind once: the label is "Pay with Vibes", the Vibes green with dark ink and a
    focus ring (light and dark themes), a 44 px target, disabled while the sheet is open, and re-enabled on the
    result. `bind(document)` is there for buttons added later; a `MutationObserver` picks them up automatically.
  - The server side creates the charge with `openvibe-sdk/vibes`. `docs/vibes-pay.md` is the guide; the button is
    not added to openvibe.design's `/components` page from this repository (that page is OpenVibe.Design's source).
All notable changes to `openvibe-shared`. Versions follow [semver](https://semver.org/): a
breaking change to any exported module, browser global or served file name is a new major.
A release is the git tag `vX.Y.Z`; consumers pin the tag's tarball (see README).

## 4.110.0 — 2026-11-04

- **`openvibe-shared/config`: sealed secrets, write-only secret routes, env pins and the owner settings'
  schema (D11 S2).** Every new option is opt-in: without a KEK the store stores, reads and redacts
  exactly as before and reports `sealed: false`.
  - **Sealed secrets.** A secret-class value is stored as `v1:<kek_id>:<fingerprint>:<hint>:<bind>:…`:
    a random 256-bit data key seals the value with AES-256-GCM, the KEK seals that data key, and both
    use the AAD `service|namespace|key|bind`. `values_json` never holds the plaintext again; `get()`
    opens the envelope for the service, and a summary, snapshot, history or rollback shows only its
    marker. The KEKs come from `opts.keks` (`{ current, keys }`) or `OV_CONFIG_KEKS` /
    `OV_CONFIG_KEK_CURRENT`; a value that is not base64 of exactly 32 bytes refuses startup with an
    error naming the variable, never the key. Only `node:crypto` is used. The namespace fingerprint
    key is plain only when no KEK is configured; with one, `config_keys` holds that same key wrapped
    under the current KEK (AES-256-GCM, AAD `openvibe-config-fingerprint|<service>|<namespace>`), so
    a database dump has no key that reproduces a fingerprint. It is rewrapped on boot and never
    changes, so markers and checksums are stable across a KEK rotation and when a KEK is first
    enabled; `reseal()` recomputes each envelope's fingerprint with it.
  - **`x-bind`.** A secret property can name another key (`x-bind: "base_url"`); its value joins the
    AAD, so changing it locks the secret until it is entered again. A copied envelope fails on another
    key or namespace.
  - **`reseal()`.** Plaintext secrets and envelopes under an older KEK move to the current KEK,
    revision by revision, preserving fingerprints and never resurrecting a changed bind. It reports
    `{ resealed, current, plaintext, locked, errors }` and is a 409 `config.no_kek` without a KEK.
  - **Write-only routes.** `PUT <base>/:namespace/secrets/:key { value, reason }` and `DELETE …` answer
    a marker (`fingerprint`, four-character `hint`, `set_at`, `set_by`, `bound_to`), never the value.
    A normal `POST` may no longer write or unset a secret-class key (422 `config.secret_write_only`); a
    marker round trip is still allowed.
  - **Env pins and the summary.** `x-env: "NAME"` makes the env value effective and read-only
    (`summary().pins`, 409 `config.pinned_in_env`). `summary()` now carries `sealed`, `kek`, `pins`,
    `secrets` and `schema`; a secret property's `default`, `examples`, `enum` and `const` are removed
    from the schema copy. The annotations `title`, `description`, `x-group`, `x-env`, `x-danger`,
    `x-bind` and `x-unit` are checked at creation.
  - **Hooks.** `onChange({ namespace, keys, actor, revision })` runs after every successful activation
    (a throwing hook is logged, never fatal); `requireFresh(req, { namespace, keys })` on `adminRoutes`
    runs before secret writes and `x-danger` keys and answers 403 `config.fresh_required` when false.
  - `test/config-secrets.test.js` covers the envelopes and their AAD, x-bind and copied envelopes,
    write-only routes, pins, the summary schema, the hooks, reseal and rotation, that a dump of
    `config_keys` and the snapshots has no key that reproduces a fingerprint, that the fingerprint is
    stable across a k1→k2 rotation and a KEK first enabled, that no-KEK markers are unchanged, and
    that no value reaches a summary, snapshot, history, error, log or `values_json`; the existing test
    still proves the no-KEK call sites and redaction are unchanged. `npm test`: 129/130 files passed,
    1 skipped (floating-promises, acorn not installed).

## 4.109.2 — 2026-11-03

- **A select inside a modal dialog or a fullscreen player opens over it.** The list (menu or phone sheet) used to be
  added to the body. A modal `<dialog>` such as the kit's sheets made it inert, and a fullscreen element hid it.
  - It now goes inside the dialog or the fullscreen element the select is in.
  - Where the browser supports popovers, it opens in the top layer, above any z-index.
  - The browser's own popover box is undone.
  - `test/ov-forms-chrome.test.js` covers a select in a modal dialog: the list is seen, a choice lands, the dialog
    stays open.

## 4.109.1 — 2026-11-03

- **`data-ov-select="bare"`: a select inside a chip or a toolbar keeps that look.** It gets no box, chevron or badge of
  its own, and only its list (the menu, or the phone sheet) is OpenVibe's. Codes' composer chips use it.
  `test/ov-forms-chrome.test.js`.

## 4.109.0 — 2026-11-03

- **OpenVibe's own select and form controls, on every site (`ov-forms.js`, `ov-forms.css`, docs/forms.md).** The owner
  asked for "a custom system for those select inputs … shared across the network and all websites rather than using
  default stuff", one that works on phones and computers alike.
  - **The select.** Every `<select>` becomes a button that opens OpenVibe's list: a menu on a computer, a sheet from
    the bottom on a phone.
    - The hidden select keeps the value, so forms, `select.value` and `change` listeners work as before.
    - An option can carry a description, a toned badge, a state dot and a "Set up" link (`data-desc`, `data-badge`,
      `data-state`, `data-href`).
    - The list has search from 9 choices, groups, multiple choice and the full keyboard.
  - **The other controls.** Checkboxes, radios and sliders take the site's accent, and `role="switch"` draws a switch.
    `.ov-field`, `.ov-input` and `.ov-choice` give the full field look to a page that asks for it.
  - **Loading.** The navbar loads both files once the page settles, only on a page with a form control.
    - Turn it off with `<html data-ov-forms="off">`, `navbar.init({ forms: false })`, or `data-ov-native` on a control.
    - `test/ov-forms-chrome.test.js` covers it.

## 4.108.1 — 2026-11-03

- **A page named after a domain keeps its Markdown twin in llms.txt.** 4.108.0 counted any last segment with a dot as a
  file, so Help's `/sites/openvibe.blog` and Host's `/catalog/domains/co.uk` kept their HTML URLs.
  `/sites/openvibe.community` got its twin only because ".community" is longer than eight letters. Now only a real
  file ending (json, xml, txt, png, html, …) makes a file. `test/llms-markdown-links.test.js`.

## 4.108.0 — 2026-11-03

- **llms.txt can link a site's own pages at their Markdown twins, and only those** (AGT-5). `seo.llmsTxt({ markdown:
  true })` used to append `.md` to every link, so `/openapi.json` became `/openapi.json.md`, and so did a feed or an
  API path. Now only the site's own pages get a twin: `/hot` → `/hot.md`, `/` → `/index.md`. Files, `/api/` and
  `/.well-known/` paths, other schemes and, given the new `base` (the site's origin), other sites' links keep their
  URL. A page with no twin still takes `html: true`. `optional` writes the llmstxt.org `## Optional` section.
  `test/llms-markdown-links.test.js`.
- **The fire name effect reads at WCAG AA on a red-tinted row** (`items.css` #ff7a1f, from #282: it was 4.42:1 on Chat).

## 4.107.4 — 2026-11-03

- **The profile panel and the user card give a lookup eight seconds, and a failed one is not kept.** A request held
  while Network restarted in a deploy round stayed in the panel's map for the page's life, so that person's panel never
  opened again until a reload (11-03, found with Live's name card). Now each lookup has an eight-second limit and a
  failure is forgotten, so the next click asks again. `test/card-fetch-limits.test.js`.

## 4.107.3 — 2026-11-03

- **On a phone, a site's own room picture sits below the hero, not behind its text.** Under 760px the room drew its
  picture behind the hero's text at 0.28 opacity. For the default motif (the orbits) that is a backdrop. A site's own
  picture is usually a sample card of words and numbers, and on 11-03 it ran through the headline on Report ("OpenVibe,
  honest" over "2 h 14 m"), Domains, Surf, Shoes and Tours. Now a picture that is not the default motif sits below the
  hero, whole and at full strength; the default motif stays a faint backdrop. `test/room-pic-phone-chrome.test.js`
  checks both at 360, 390 and 700px.

## 4.107.2 — 2026-11-03

- **The last small touch targets in the shared bar and footer reach 44px.** A re-run of the tap audit over every
  site's home (11-03: 31 of 45 sites with a small target, down from 40 of 42 on 10-29) found these:
  - Sign In was 40px tall; its invisible hit area now reaches 45px;
  - the OpenVibe menu's orb was 36.9px wide on a phone; it grows to the right, toward the open bar, so it measures
    44px while the site's name keeps the taps on its own last letters;
  - the footer's brand was 33px tall, now 45px;
  - the orbit's big nodes on a phone were 42px, now 44px.
  Nothing is drawn differently. `test/tap-areas-chrome.test.js` measures each to a finger with
  `elementFromPoint`, from 320 to 430px, signed in and out, and checks that the name and the right-hand group keep
  their own taps.

## 4.107.1 — 2026-11-03

- **Legal pages draw the brand in its own font on every site.** `legal.page()` loaded the theme loader, the navbar and
  the footer from openvibe.network, so the navbar asked openvibe.network for its brand font too, and sites whose CSP
  allows fonts only from themselves (Connect, Cam, Surf, Tips, Zone) refused it: their `/terms`, `/privacy` and
  `/dmca` showed the name in the system font. Every site serves openvibe-shared at `/shared/`, and the page now loads
  the three scripts from there.
- **The public and service pages carry the day they were written.** They said "Last updated September 18, 2026", the
  template's date, though their words are from 2026-11-03. A profile written later carries its own date
  (`PROFILE_UPDATED`); the older profiles keep theirs.

## 4.107.0 — 2026-11-03

- **Two legal profiles for sites the old ones did not fit.** Ten sites served no `/terms`, `/privacy` or `/dmca`
  because no profile told the truth about them: `info` says the site is not open yet, and `tools` promises uploads
  deleted within the hour. `public` is an open, read-only site with no account (search, reports, domain prices).
  `service` is a personal tool or API that keeps what you make with your account. A service site says in its own
  words what it does (`what`) and keeps (`makes`), whether it fetches addresses people give it (`fetches`) and whether
  it sends what they give it to AI models (`ai`), and names any extra processors (`processors`). `legal.PROFILES` lists
  every profile. `test/legal-profiles.test.js` covers them.

## 4.106.3 — 2026-11-02

- **A site on its own open.<tld> domain is named for it.** open.shoes read "OpenVibe.Shoes" in the bar and its name
  linked to openvibe.shoes (the owner's screenshot). The navbar now reads `<sub>.open.<tld>` hosts as Open.<Tld>, and a
  config can say `brand: { core: 'Open' }` itself off the domain (localhost, previews). The brand carries its front door
  as `apex` (open.shoes, openre.stream, openvibe.<tld>), and the name's links go there. The footer's fallback and the
  installed app's name (`icons/sites.json`, from the manifest's first domain) say Open.Shoes too.

## 4.106.2 — 2026-11-02

- **The site's name reads whole on a signed-in phone.** On openvibe.live a phone showed "Li…" beside the balances, the
  messages, the bell and the picture (the owner's screenshot). Up to 480px the two balances now stack in one pill, each
  with its icon, so both still show: the pill is about 53px instead of 90-103px and the name has that room. At 320px the
  OpenVibe menu's orb no longer runs into the balances. `test/navbar-phone-fit-chrome.test.js` now signs in with the
  messages button and the owner's figures (161k, 400).

## 4.106.1 — 2026-11-02

- **The OpenVibe mark opens the site switcher again, on every site.** `site-switcher.js` (4.48.0) was never in
  `files.js`'s `BROWSER` list, and sites serve `/shared/*` from that list only: the mark loaded it on the first tap, the
  site answered 404 and the switcher never opened. It is on the list now. `test/browser-files-complete.test.js` fails
  when a browser file loads a file of this package that no list serves.

## 4.106.0 — 2026-11-02

- **The ghost cursor** (`motion.js` `[data-ov-ghost]`, MOTION-1): a scene shows how it is used. An arrow walks to each
  `[data-ov-ghost-step="N"]` inside it in order, "clicks" (a ring that widens and fades, never a spinner), marks that
  step `data-ov-ghost-on` so the page can draw it chosen, and starts over after the last. It runs only while the scene
  is in view, never under reduced motion (the OS setting or `data-ov-motion="reduced"`), and is gone for good the
  moment the reader touches, clicks, types or focuses inside the scene. The cursor is aria-hidden and takes no focus or
  pointer events. `test/motion-ghost-chrome.test.js` checks it in Chrome.

## 4.105.1 — 2026-11-02

- **OpenVibe Connect draws the plug in the launcher** (`ov-icons.js` ALIASES `connect: 'plug'`), not the fallback mark.
  Connect went live with Contracts 0.279.0 (Website Connect v0). `test/site-icons.test.js` checks that every live
  site's launcher icon is a real glyph.

## 4.105.0 — 2026-11-02

- **Eight more solid drawings**, the next by use with a shape to fill: umbrella, parking, medical, drive, skull,
  hot-tub, group and gavel (136 of 277 now). The parking sign and the first-aid case keep their letter and cross as
  cut-outs; the drive keeps its case outline as a line over a filled base with two lights; the gavel's head is one
  block apart from its striking bar, so the gap still shows at 16 px. Drawn beside the line drawings, checked at 96,
  24 and 16 px on a dark ground and by Design's `validate.cleanSolid`. The glyph files and fonts are rebuilt.
- **Taglines end without a full stop, every one** (contracts 0.276.0): `icons/sites.json` (the site switcher) and the
  share cards of AI, Bench, Events, Inventory, Pics, Play, Run, Search and Zone are rebuilt from the manifests; Pics'
  domain card line in `social.js` follows. Ten of 55 had one.
- **The release browser check reads the words** (`browser-harness.js`, check `text`): the visible text has no
  "[object Object]", bare undefined/NaN, `{{ }}`, markup or an entity shown as text, or a space before a full stop.
  It warns and never fails (a developer page may show such words in code). Each was on a live site on 11-02.
- **A title that names its site gets no " · Site" suffix** (`seo.headTags` `titleSuffix`): every update log read
  "What shipped on OpenVibe.Work · OpenVibe.Work".

## 4.104.0 — 2026-11-02

- **Eight more solid drawings**, the next by use with a shape to fill: download, upload, expand, shirt, shapes,
  shelter, archive and keyboard (128 of 277 now). An arrow is filled whole and its tray stays a line; expand is
  compress's twin, four corners pushing out. Drawn beside the line drawings and checked at 48, 24 and 16 px on light
  and dark grounds. The glyph files and fonts are rebuilt.

## 4.103.0 — 2026-11-02

- **Eight more solid drawings**, the next by use on the sites (Design's usage count): retry, water, food, history,
  compress, bridge, text and steps (120 of 277 glyphs now have one). An arrow keeps its arc as a line with a filled
  head; a list keeps its rows as lines beside filled boxes. Each was drawn beside its line drawing and checked at 48,
  24 and 16 px on light and dark grounds. `ov-glyphs.js`, `ov-glyphs.svg` and the glyph fonts are rebuilt.

## 4.102.0 — 2026-11-02

- **A sidebar row with two lines** (`kit.sidebar` items): `sub` is a quiet second line under the name, a
  conversation's last message or where a search matched, with the mark beside both lines. `attrs` gives a row `data-*`
  attributes so a page's script finds it again (Chat's support inbox, `data-conv`); any other name is dropped. A
  one-line row's markup is unchanged.
- **Boost lets each parsed page go.** After a swap, boost empties the page it parsed. Chrome held that page's own
  `<video>` (the swap shows a copy) as a pending activity, and with it the whole parsed page: one document and every
  node more on each visit. On openvibe.cam, `/` ↔ `/app` grew by 3 documents and 1,729 nodes in three laps and failed
  the release check's navigation test. `boost-chrome.test.js` visits a page with a video five times in place and checks
  the document count stays put.

## 4.101.0 — 2026-11-02

- **A puzzle glyph** (`puzzle`, with a solid drawing): a jigsaw piece, knobs out on top and right, notches in, for a
  browser extension, an add-on or a plug-in. `fa-puzzle-piece` drew nothing on Coupons and Design since Font Awesome
  left. A sweep of every `fa-` name the sites use found no other gap except brands (drawn by brands.js) and words in
  Design's docs.

## 4.100.2 — 2026-11-02

- **The page prefetch runs under a nonce policy.** The navbar's inline speculation rules (4.70.0) were refused on
  every page whose Content-Security-Policy names a nonce: openvibe.chat logged it on each page. Chrome 156 ignores
  `'inline-speculation-rules'` beside a nonce. The navbar now gives its rules the page's own nonce, read from any of
  its nonced scripts. Checked on production's openvibe.chat/vibe with this navbar.js swapped in: no violation, and
  the rules carry the nonce.

## 4.100.1 — 2026-11-02

- **The browser harness counts a counted fold's text as on the page.** A closed `<details>` opens with one tap, with
  or without JavaScript, and search engines read it; the network's rule is to fold, never to hide. The release check's
  JSON-LD rule (each entity's name in the page's text; 80% of a list's items) failed Network's home: its "50 sites"
  list names the sites under "Every other neighbourhood". The contents of closed `<details>` (all but the summary) are
  now part of the text the checks read.

## 4.100.0 — 2026-11-02

From a phone sweep of every site's home (11-02):
- **A card's day as its cover.** `kit.card({ date })`: a thing without a picture that happens on a day (a drop, an
  event, a deadline) shows the weekday and month with the day large, instead of the same calendar icon on every card.
  The day stays clear of the corner's price. Shoes' "Dropping this week" was a row of identical calendar icons.
- **The aura's mark leaves the heading alone on a phone.** On a phone the aura hero (`sc-has-vis` without an orbit) is a
  watermark behind the heading, and its mark landed at the end of a long heading: AI's read "one API.V", Download's
  and Watch's the same. The glow stays; the mark goes there (the navbar shows it). Computers keep it in its column.

## 4.99.1 — 2026-11-02

- **The conversation's head follows the navbar on a phone.** The navbar slides away while you read down. The thread's
  sticky head stayed where the bar had been, leaving a gap with the thread showing through. ov-thread.js now finds the
  bar on each measure (navbar.js may draw it after the kit starts) and measures again once the slide ends.
- docs/thread.md: `OVThread.tool` and `toolDone` take the tool call's `key`.

## 4.99.0 — 2026-11-02

- **The conversation UI shows several agents, approvals and what the work produced** (plan L55 C4 stage 3, for Codes):
  - `turn({ who })` heads a reply with an agent's face (initials in its colour) and name;
  - `divider()` draws a hand-over between agents;
  - `card({ form, code, icon })` asks and posts without script (an approval: Allow or Deny);
  - `panel()` sits beside the conversation: a column from 1180 px, a drawer from the right below;
  - `page({ panel, main })` places the panel, or a plain page, in the conversation's place;
  - `sidebar({ pinned })` keeps chats above the groups, and an item takes a `dot` and a quiet `meta` word;
  - `sidebar({ findSubmit })`: Enter in Find a chat runs the site's own search (every message). Without it the form is
    filter-only, as before; the kit keeps Enter on the page only for a filter-only form, so a site that draws
    `kit.sidebar` itself (Codes) searches again on Enter;
  - `you.caption` puts a small word over the person's bubble;
  - a work row takes an `icon` (`read`, `find`, `edit`, `run`, `web`, `sub`), and a finished tool with no output is a
    plain row rather than one that opens on "Running…";
  - `composer({ id, attrs, foot })`: the form's id and the site's data attributes, and markup under the bar. The note
    line is always drawn and is the form's status line (`role="status"`);
  - `page({ center })` is a start page: the welcome and the composer sit together until there are turns. `cls` adds
    the site's classes;
  - `OVThread.tool(id, { name, input, icon, key })` and `OVThread.toolDone(id, ok, key)` stream a tool row built from
    text; a result finds its own row by key (tools run side by side), and `ok: null` is a step that ended with no result.
- 4.96.0's own sidebar code is gone from thread.css and ov-thread.js. `thread.sidebar` has drawn `kit.sidebar` since 4.97.0.
## 4.98.0 — 2026-11-02

- **Solid drawings for ten more glyphs (plan L49/L50).** The places and things the sites use most that had none
  (Design's usage count): `tree`, `tent`, `train`, `mountain`, `city`, `id`, `wallet`, `chip`, `restroom`,
  `brain`. A swapped icon at 18 px or less now shows the filled shape instead of heavier lines, and
  openvibe.design/icons.css gives them an `is-solid` class. ov-glyphs.js and ov-glyphs.svg rebuilt.

## 4.97.0 — 2026-11-02

- **The conversation UI uses the network's one sidebar.** 4.96.0's `thread.sidebar` drew a second sidebar beside
  `kit.sidebar`, which is the network's one (plan L35, the owner 10-31: "the navigation makes more sense in a
  vertical way… shared styling across everything") and which Codes already uses. Now:
  - `thread.sidebar` returns `kit.sidebar`: New chat is its action, the chats are its sections (the open one marked, a
    working one with a dot), and the site's places can be its `nav` rows.
  - Find a chat filters as you type (ov-thread.js); without script it is the kit's GET form.
  - `thread.page` lays the kit sidebar out as its first column from 761 px, with the kit's scrim.
  - `thread.head` carries `kit.sidebarButton`, so kit-web.js opens the drawer on a phone.
  - Draw with kit.css and kit-web.js beside thread.css and ov-thread.js.

## 4.96.0 — 2026-11-02

- **One conversation UI for the network** (plan L55 C4). Actor's chat proved the shape; Vibe, Codes and the Dock use
  the same parts:
  - `openvibe-shared/thread` builds the markup: the chats in a sidebar (grouped Today / Yesterday / This week /
    Earlier), the sticky head, turns, the work folded under an answer, the answer with its sources and a footer, cards,
    and the composer. Complete without script, every string escaped.
  - `/shared/thread.css` draws it with theme tokens: a page that scrolls as a whole, a composer at the bottom above a
    phone's app bar, and the chats as a column or a drawer.
  - `/shared/ov-thread.js` adds the drawer, Find a chat, the growing composer, Enter to send, Copy, staying at the
    bottom, and `OVThread.add / replace / live / work` for streaming turns. A turn that finishes types its answer in
    word by word (`OVThread.reveal`, from Actor #227); code, tables and pictures come in whole.
  - The composer takes the site's markup above the box (`top`: picked files, a problem line) and a `maxlength`; Copy
    leaves out anything marked `data-ovt-nocopy` (a citation's number).
  - Nothing spins: a working turn breathes, and reduced motion stills it.
  - `docs/thread.md`; `test/thread.test.js`.

## 4.95.0 — 2026-11-02

- **A box that scrolls can be scrolled from a keyboard** (WCAG 2.1.1). A code block, a wide table or a list held to a
  height, with nothing focusable inside it, could not be reached with Tab, so its hidden part was out of reach without
  a mouse. axe (scrollable-region-focusable) flagged such pages on six sites in the 11-02 sweep. Once the page settles,
  and again a little later and after a resize, the navbar gives each such box `tabindex="0"` (and
  `data-ov-scroll-focus`, with a focus ring). A box with a link or a button inside, a page's own tabindex, and
  `overflow: hidden` are left alone. `OpenVibeNavbar.focusScrollers()` runs it on demand for a page that draws one
  later. `test/keyboard-scrollers.test.js` checks it in a real Chrome.

## 4.94.0 — 2026-11-02

- **A labelled thing's poster may be named by username** (`data-ov-labels-owner="@name"`). The owner rule (their own
  content always shows to them) matched only a subject (`usr_…`), and a server-rendered page such as openvibe.video's
  cards knows the maker's username, not their subject. `ov-labels.js` now also matches `@username` against the
  signed-in person's username, in any case. A bare name is never an owner, so a username that looks like someone's
  subject matches nothing.
- **On a thing's own page, hide covers it instead of emptying the page** (`data-ov-labels-opened`). A watch page or a
  picture's page is somewhere the person went on purpose; with hide chosen for one of its labels, the player vanished
  and left a title over nothing. Marked opened, it is covered with the calm "Show" button that names the labels, as
  blur does. Cards and lists still hide.
- `navbar.js`'s `SIBLING_REV` moves with `ov-labels.js`.

## 4.93.2 — 2026-11-02

- **A folded footer column says how many links it holds** (from #208, 10-31). On a phone the full footer's columns are
  folds (4.53.0), and a fold showed only its heading. Each now carries its count on its line ("9 links", "1 link"), the way
  the network's other folds say what they hold. On a desktop, where every column is open, the count is hidden. Every link stays in the
  page.

## 4.93.1 — 2026-11-02

- **An `ov:` icon the ring set lacks draws as its glyph** (`showcase.icon`). Before, it drew the bare OV mark: Today's
  "Your agenda" (`ov:calendar`) showed a "V". When the ring icons do not know a name and the glyph set does, the glyph
  is drawn in a ring of its own (the accent, a soft fill and a thin ring), the same size as the ring icons.

## 4.93.0 — 2026-11-02

- **Content labels, each viewer's own choice** (plan L1, `common.content-labels@1`, `network.label-prefs@1`).
  - **`ov-labels.js`**: a page marks what carries labels with `data-ov-labels="nudity,18+"`, and optionally the media
    to cover (`data-ov-labels-media`) and the poster (`data-ov-labels-owner`). The navbar loads the file the first time
    such an element appears, as it does `ov-glyphs.js`.
    - It reads the person's choices once from Network (`GET /api/v1/me/label-prefs`, with the navbar's token, cached
      five minutes) and applies them. **show**: as it is. **blur**: the media is covered by a calm button naming the
      labels with "Show" (a playing video pauses), until tapped. **hide**: not shown.
    - Signed out, everything shows (the web default). The poster always sees their own. Things that arrive later (a
      feed's next page) are covered too.
  - **`kit.labels(labels)`**: the chips beside a title, in words ("Strong language", "Flashing lights"), 18+ in the
    warning colour. Only the labels in force: a suggestion is the creator's to confirm and is never shown to viewers.
    **`kit.labelsAttr(labels)`** writes the matching `data-ov-labels` attribute.
  - **`OpenVibeNavbar.session`**: who is signed in and the Network token, read only, for files loaded beside the
    navbar.

## 4.92.0 — 2026-11-02

- **The page starts the footer it renders** (`shell.page`, `shell.scripts`).
  - Six sites rendered the shared footer and never started it: Video, Pics, Run, Events, AI and Website. On a phone
    every fold stood open, and there was no shipped line.
  - The page's boot now starts it a moment after the site's own scripts, with the page's footer config.
  - A site that starts it itself (`OpenVibeFooter.init`) keeps its own: a started footer carries `data-ovf-live`, and
    the shell leaves it.
- **The compact footer centres its links** under its centred brand. On a phone the row sat at the left, and "Report a
  problem" wrapped alone.

## 4.91.1 — 2026-11-01

- **A numbers strip can be reached by keyboard** (`kit.stats`): on a phone the strip scrolls sideways, and a strip with
  no link in it had no way in (axe `scrollable-region-focusable`, a WCAG AA sweep of every home). It carries
  `tabindex="0"` beside its label.

## 4.91.0 — 2026-11-01

- **Buttons say they are working, then done or failed, with the mark** (`ov-mark.js`, which the navbar loads on every
  site; the plan's "buttons' busy, then done or failed, from the mark's states").
  - `OVMark.busy(button)` → `{ done(text?), fail(text?), reset() }`: the button shows the mark busy beside its label,
    keeps its width and takes no second press; done turns the V into the green tick and says "Done" (or the text),
    fail into the red "!" and a word; then the label comes back.
  - A form posted the old way (POST) does this by itself until the next page arrives, and a second submit does nothing.
    Its submitter is never disabled, so its name and value still post. A GET form, a form whose own script took the
    submit, and `data-ov-busy="off"` are left alone; the back/forward cache resets it.
  - `navbar.js` loads the new `ov-mark.js` by its content hash (`SIBLING_REV`).

## 4.90.0 — 2026-11-01

- **An audio-only recording shows the streamer, not a black box** (`player.js`, `player.css`; plan R4).
  - A browser broadcast with no camera is recorded as sound only. When the metadata says there is no picture track, the
    player shows a cover: the face from `data-ov-avatar` (else the poster) in a circle over a soft blur of it, with an
    "Audio only" tag. With no usable picture, a speaker glyph. The sound plays under it with the usual controls.
  - The player keeps a 16:9 shape (a sound file has no picture size, and the browser drew it 150 px tall), and hides
    picture-in-picture. A new source decides again.
  - Pages: put the streamer's avatar on the video as `data-ov-avatar="…"`.

## 4.89.0 — 2026-11-01

- **A card with no picture but a person shows their face** (`kit.card`, `room.css`).
  - A card with no `image` (and no `preview`) but an `avatar` draws the avatar large in a circle over a soft blur of it.
    A lone type icon in an empty box read as a missing image: Report's episodes and Tours' recordings of streams with no
    public recording.
  - The avatar is fetched at 160 px (`mediaW`), is `aria-hidden` (the body's mark and the title already name the
    person), and a script or bad URL falls back to the icon as before.

## 4.88.1 — 2026-11-01

- **An aborted view transition is silent on the account hub.**
  - Signed out, `/my` and `/themes` send the visitor to `/login`, a page that does not load the kit and so does not opt
    in to cross-document view transitions. Chrome aborted the transition and left an uncaught `InvalidStateError` on
    the sign-in page: "Transition was aborted because of invalid state. ViewTransition opt-in disabled".
  - The account switcher now handles `finished`, `ready` and `updateCallbackDone` in `pageswap`/`pagereveal`, and skips
    a `replace` navigation's transition before it starts: a redirect is not a page move, and a transition that cannot
    land has nothing to animate.

## 4.88.0 — 2026-11-01

- **Name effects read on light themes.**
  - The fifteen name effects in items.css were all drawn on dark pages: bright colour plus glow. On a light theme some
    names were unreadable: Neon and Glitch at 1.3:1, Ice at 1.6:1, and Divine was mostly white (axe flagged Community's
    pastes and Pulse).
  - Under `html[data-theme-mode="light"]`, each effect now has a variant with the same hue and motion, at a depth that
    reads on white (most stops about 4.6:1 or more).
  - Fire, Ice and Neon animate their light colours with their own keyframes. Shadow's mist and Void's glow are lighter.
  - Reduced motion still stops them all.

## 4.87.0 — 2026-11-01

- **Share cards for a service's other domains.**
  - openvibe.pics and openvibe.download (MediaHub), openvibe.homes (Rent) and openvibe.website (Space) previewed as
    their service: a link to openvibe.pics showed the OpenVibe.Video card.
  - `social.DOMAINS` names them (id, service, host, name, tagline, what); `social.domainOf(id)` and
    `social.domainForHost(host)` look them up.
  - The builders draw `social/<id>.jpg` like the service's card (the same mark, Pics in its pink) and write the
    domain's `icons/sites.json` entry.
  - `shell.page()` shares the domain's card on any page whose canonical URL is on that host, so the sites need no
    change.
- **The footer's "Nobody live right now" line reaches 4.5:1.** `.ovf-pulse-quiet` was the theme's muted text on the
  pulse's tint: 4.34:1 on Daylight, on every page with a footer (axe flagged 42 inner pages). It is now the
  secondary text.
- **Room kit pictures load at the size they are drawn.** `kit.mark` and `kit.card` put a Media object's original
  upload in the page: Report and Community drew a 3072 px, 3 MB avatar at 34 px, and Community a 2460 px picture in a
  280 px card. They now ask Media's resize ladder for the width (`?w=96` or `160` for marks, `640` for card
  pictures); `kit.mediaW(url, width)` does the same for a site's own images.

## 4.86.0 — 2026-11-01

- **Status colour names every site can use.**
  - About eighteen sites colour error and status words with `--error-text`, `--error`, `--ok` or `--warn`, and accent
    words with `--accent-text`. No theme sets those names, so each site's fallback literal showed: `#ef4444`,
    `#34d399` and `#fbbf24` are pale on light themes.
  - theme-loader.js now maps them onto the theme's own readable colours (`--danger-text`, `--danger`,
    `--success-text`, `--warning-text`, `--accent-strong`). The mapping sits in `:where(html)`, so a site that sets
    one of these names itself keeps its own value.
- **Room kit marks reach 4.5:1 for every hue.** `kit.mark`'s white letters sat on `hsl(hue 45% 38%)`, about
  3.5:1 for greens and yellows (axe on Community, Report, Tours, Shoes and Bot). Lightness is now 32%: the worst
  hue is 4.75:1. `test/kit-mark-contrast.test.js` checks all 360.
- **A room's text colour reaches 4.5:1 on its own chips.** `--room-strong` (room.css) was the bare room accent:
  3.9-4.4:1 on the room's tinted chips (Bench's benchmark ids, Exchange's listing labels). It is now the accent with a
  quarter of the theme's text mixed in, 5.2:1 or more there, the hue unchanged.
- **LIVE badges are white on a deeper red.** `kit.css`'s `--ovk-live` and showcase's `.sc-live` filled with the
  theme's `--live-red` under white text: 3.8:1 on `#ef4444`. The fill is that red at 80% over black (5.5:1); every
  built-in theme's red reaches 4.5:1 except Catppuccin's pastel pink.

## 4.85.0 — 2026-11-01

- **Share cards for fourteen more sites.**
  - Bench, Cam, Casino, Design, Domains, Exchange, Fun, Meme, Report, Surf, Today, Tours, Vision and Shoes had no
    `social/<service>.jpg`. A shared link to their homes showed no picture, because shell.page's og:image is
    `social.url(service)`.
  - Drawn by `scripts/build-social-cards.js --only …` from each manifest's `site` block (OpenVibe.Contracts main), the
    same way as every other card.
  - `icons/sites.json` names their app icons (`scripts/build-icons.js`): installable apps and the app-icons test
    need an entry for every site with a card.
  - The update log (`shipped.js`) knows the fourteen as sites, so each one's own feed is shown. A Services subdomain
    (`ai.`, `bench.openvibe.services`) and `open.shoes` resolve to their own site, the way Network's subdomains do.

## 4.84.0 — 2026-11-01

- **A page with no stylesheet of its own reads in the network's type.**
  - `shell.page` set no font. On five sites (Events, Run, AI, Bot, Games), `/updates` loads no stylesheet, and its text
    fell back to the browser's Times New Roman.
  - The head's reserve style now gives the body `var(--ov-font, 'Inter', system sans)` through `:where(body)`. At zero
    specificity, any site's own body rule wins, so nothing changes on a page that already sets its font.

## 4.83.0 — 2026-11-01

- **Status words read on light themes.**
  - The kit wrote a status in the theme's fill colours (`--success`, `--warning`, `--danger`). On Daylight, the badges
    "paid" and "expiring" on openvibe.design/kit were green and amber on white at 2.28:1 and 2.15:1.
  - `--ovk-ok-text`, `--ovk-warn-text` and `--ovk-bad-text` follow the theme's readable `--success-text`,
    `--warning-text` and `--danger-text`. They are now 5.4:1 on Daylight, and unchanged on the dark default.
  - The kit uses them for words: badges, the danger button, done and danger icon buttons, the danger fold, the menu's
    danger item, notice icons, and kit-data's rank deltas and pills.
  - Fills and borders keep the fill colours. `room.css` carries the same tokens.

## 4.82.0 — 2026-11-01

- **The motion tokens are on every page, and Reduced motion reaches every token-timed transition** (plan L45).
  - Before this release, `--ov-dur-1..4` and `--ov-ease-out`/`-spring`/`-in-out` were set only by `ov-fx.js`, which
    loads on pages with effects. Everywhere else a site's `var(--ov-dur-2, .2s)` got its fallback, so the person's
    Reduced setting could not reach it.
  - `kit.css` now sets the same tokens, with the same values, and the same feels: calm looks are slower and never
    overshoot, loud ones are quicker.
  - `html[data-ov-motion=reduced]` sets every duration to 0, and so does a device that asks for reduced motion
    (`:root:root`, above `ov-fx.js`'s own `:root`).
  - A site that writes its transitions with the tokens now follows the look and the person's choice. The design lint
    (openvibe.report/design) counts hand-set timings.
  - `room.css` carries the same tokens.

## 4.81.0 — 2026-11-01

- **Shape and elevation are tokens, and a look has a shape** (plan L45 step 2: "Paper is quiet and square, Neon glows
  and bounces").
  - `--ov-radius-1..3` (small things, cards, sheets) and `--ov-elev-1..3` (on its surface, a bar over scrolled content,
    a menu above the page) are in `kit.css`. Their defaults are the kit's own corners and shadows, so nothing moves.
  - Every kit corner and shadow now reads them: `--ovk-radius` is `--ov-radius-2`, and a 12 px corner is
    `radius-1 + 2px`. Only pills and circles stay literal.
  - The quiet looks are square, with hairlines where shadows were: Paper, Solarized Light, Nord, Nord Light, Matrix,
    Hacker and High Contrast.
  - Neon Tokyo and Vapor are round, and their raised things glow in the accent.
  - A site's own CSS can use the same tokens to follow the look: `border-radius: var(--ov-radius-2, 14px)`.
  - `room.css` carries the same tokens, and the personalities at zero specificity.

## 4.80.0 — 2026-11-01

- **33 more glyphs have a solid drawing for small sizes** (plan L50; the owner, 2026-11-01: "really tiny icons… a
  solid colour rather than the border lines"). The next most-used shapes on the sites after 4.73.0's sweep: globe,
  circle, plane, mail, eye-off, key, gauge, server, user-check, mic-off, palette, dish, layers, phone, money, care,
  news, hand, tack, help, invite, ticket, cart, box, store, map, sun, leaf, headphones, tv, bug, terminal and database.
  Drawn the same way as the others: filled shapes, holes cut with `fill-rule="evenodd"`, a part that has to stay a
  line as `class="ln"`. An "off" glyph (eye-off, mic-off) keeps its slash as a line and cuts the shape back from it,
  so the slash still reads at 14 px. 101 of 276 glyphs now have one; a glyph made only of lines (check, code, wifi,
  share) still thickens when small instead. `ov-glyphs.js` carries them (76.3 KB raw); the sprite gains
  `ovg-<name>-solid` for each.

## 4.79.0 — 2026-11-01

- **What Vibe did, as chips you can undo** (plan L48 V2). Under a Vibe answer that set or stopped a reminder or a
  timer (OpenVibe.Chat's `results` on the message), the Dock's Vibe tab shows a chip: "Reminder set: Stretch · Every
  2 hours", "Timer: 25 min focus". **Undo** for a day (Chat's `POST /api/vibe/undo`), **Open** for a reminder; an undone
  one reads "stopped" and is not offered again.
- **A timer Vibe starts shows at once.** When Vibe's answer started a timer ("Vibe, a 25-minute focus timer"), the Dock
  reads its state again, so the pill counts down without waiting for the next poll. The Vibe tab's mount takes
  `refresh`.

## 4.78.0 — 2026-11-01

- **`kit-layout.css`: the fluid scale, the layout primitives and a classless base** (plan L54 K1/K2). A file of its
  own, after `kit.css` (2.5 KB brotli); a page that uses none of it loads neither.
  - The fluid scale: `--step--2` … `--step-5` for type and `--space-3xs` … `--space-3xl` for spacing, by `clamp()`
    between 320 and 1240 px (16 → 18 px base, ratio 1.2 → 1.25). No breakpoints.
  - Eight primitives that lay out by their own width: `.ov-stack`, `.ov-cluster`, `.ov-sidebar` (`--end`),
    `.ov-switcher` (all side by side or all stacked, never two and one), `.ov-grid`, `.ov-rail`, `.ov-cover`,
    `.ov-frame`. Set by `--gap`, `--min`, `--side`, `--item`, `--ratio`.
  - `.ov-base`: plain HTML (headings, text, links, lists, quotes, code, tables, details, forms) looks finished on the
    site's theme. Every selector is inside `:where()`, so a site's own rule always wins.
  - Documented in docs/kit.md; `test/kit-layout-chrome.test.js` measures each in Chrome at 320, 1280 and 1920 px.

## 4.77.1 — 2026-11-01

- **Tabs below the fold no longer scroll the page to themselves.** kit-web.js kept the open tab in view with
  `scrollIntoView({ block: 'nearest' })`, which also scrolled the page when a tab strip sat below the fold (a settings
  section lower down, openvibe.design/kit's samples). Only the strip moves now, sideways.

## 4.77.0 — 2026-11-01

- **Talk to Vibe in any browser** (plan L48 V2). Where the browser has no speech recognition of its own (Firefox),
  the Dock's mic records instead: hold it (or tap, then tap again), up to 30 s, and OpenVibe.Chat's
  `POST /api/vibe/listen` turns the recording into text on the network's own speech-to-text (OpenVibe.AI, nothing
  kept). What was said is asked like typed text. The microphone is released as soon as the recording ends.
  - The Dock's Chat call (`chatCall`) can send a body that is not JSON: `{ body, type }`.
- **The glyphs load when a page first shows an icon** (plan L54 K4). The navbar loaded `ov-glyphs.js` only if a page
  had a Font Awesome-style icon when it mounted, so sites loaded it themselves for icons their own scripts add later.
  Now the navbar watches for the first one (a mutation schedules one look 250 ms later; the watch ends once the
  glyphs load), so a page without icons pays nothing and the sites' own `<script src="/shared/ov-glyphs.js">` can go.

## 4.76.0 — 2026-11-01

- **A timer in the Dock, on every site** (plan L48 R2; the owner, 2026-11-01: "a reminder system… timer or however
  often they want").
  - The Dock's header has a timer button with 5, 10 and 25 minutes, focus rounds (25/5 ×4, 50/5 ×2), or your own
    minutes and what it is for.
  - The timer lives in the Network's Dock state (`timer`, openvibe-contracts 0.271.0, Network #482), so it counts
    down on every OpenVibe site the person has open and follows them to the next.
  - **The pill** shows the minutes left (an agent that needs you still comes first). **The open Dock** shows a strip
    with the time, what it is for, a line that fills, +5 min and Stop.
  - **At its end:** a soft chime on a page that is showing, a notification when the person allowed them (asked once,
    when they start one), and "Time's up" in the pill. A focus round moves on to its break and its next round by
    itself; every page computes that from the same end time, so two pages writing it agree.
  - `dock-timer.js`, a new served file (3.7 KB brotli), loads only while a timer runs or its menu opens. `dock.js`
    grows by 0.45 KB (budget noted).
- **The Dock's header fits four tabs and four buttons.** The tabs are a sideways rail that never runs under the
  buttons, and a narrow Dock tightens both.

## 4.75.0 — 2026-11-01

- **The Dock keeps the Vibe tab across sites.** The Network's Dock state knows `vibe` since openvibe-contracts 0.270.0
  (Network #481), so the open tab follows the person from site to site like the others.

## 4.74.0 — 2026-11-01

- **Vibe in the Dock, on every site** (plan L48 V2; the owner, 2026-11-01: "access your agent or the AI… from across
  all websites… use a voice feature to tell it to set a reminder… have a conversation with your Vibe AI").
  - The Dock's first tab is Vibe: the same conversation as openvibe.chat/vibe (OpenVibe.Chat's `/api/vibe/chat` and
    `/api/vibe/ask`, with the person's own token), so a chat started on Live carries on on Chat and back.
  - Starters show before the first message, and Vibe's answer arrives in place. The tab polls quickly for a minute
    and a half after a message, then every 15 s while it is open. An https link is a link, and "Open in Chat" goes
    to the same conversation.
  - The mic is the browser's own speech recognition. Hold to talk, click to start and stop, or press Alt+V from any
    page, which opens the Dock on Vibe. It listens only while the person asks: no wake word, never always on.
  - `dock-vibe.js`, a new served file, holds the conversation and the mic (4.1 KB brotli). It loads the first time
    the tab opens. `dock.js` grows by the tab, its loader and Alt+V (0.55 KB; the budget note says so).
  - The Network's Dock state keeps only the tabs it knows. The Vibe tab is remembered on the site until the Network
    learns it.

## 4.73.0 — 2026-11-01

- **Solid drawings for the most-used shapes** (plan L49 step 3; the owner, 2026-11-01: "really tiny icons… a solid
  colour rather than the border lines"). Twenty more glyphs get the drawing `ov-glyphs.js` shows at 18 px and below,
  picked by how often the sites draw them: copy, scissors, volume, mute, robot, film, clipboard, computer, sliders,
  pencil, save, plug, chart, gear, search, game, idea, wrench, target and nodes (68 in all).
  - Glyphs that are only lines (check, close, plus, the arrows and chevrons, link, code, ban, stop) keep no solid one:
    their strokes thicken when small, which reads better than a filled shape would.
  - The same 24-unit grid as the line drawings, so an icon does not jump when it crosses the size.

## 4.72.0 — 2026-11-01

- **Brand logos without Font Awesome** (plan L54 K4; the owner, 2026-11-01: "get rid of Font Awesome completely").
  `brands.js`, a new module and served file, carries Simple Icons' drawings (CC0-1.0, v16.36.0): 46 brands for 59
  Font Awesome `fa-brands` names. That covers every brand an OpenVibe site names, except Microsoft, Windows, LinkedIn
  and AWS, which Simple Icons no longer carries; those stay with Font Awesome.
  - `ov-glyphs.js` draws `<i class="fa-brands fa-youtube">` as the brand. Only the small name map is inline; the
    drawings load from beside it the first time a page shows a brand.
  - Brands are filled in the text's colour. `ovg-brand-color` gives the brand's own colour (`--ovg-brand`), except
    where it is near-black and would vanish on a dark page.
  - `scripts/build-brands.js` rebuilds `brands.js` from a Simple Icons package.

## 4.71.0 — 2026-11-01

- **One hand in the bar** (the owner, 2026-11-01: "the icon set doesn't feel consistent… it seems weird that there's
  both solid and border-line icons… the navbar needs improvement"). Every icon the navbar draws is the OpenVibe set's own
  (`openvibe-shared/glyphs`): 101 of the 102 names in `nav-icons.js` are `[0, line, solid]` on the set's 24-unit grid,
  and Font Awesome's filled path stays only for the one name the set does not have yet. `scripts/build-navbar-icons.js`
  converts the entries itself, and `--check` fails while a covered name still has Font Awesome's path. The bar is line,
  in one stroke (1.9; 2.3 in the small balance chips). The bell, the messages bubble, the coins and the wallet are the
  same set's drawings. The app bar's tab you are on wears the solid one.
- **The name sized to the mark:** 19 px on wide screens, 17 px on phones and 16.5 px on the narrowest.
- **Icons: Auto, Line or Solid, per person** (plan L56; the owner: "a setting to prefer a certain icon type… we
  override it where we must… configurable for users in most cases"). A display setting, `icons`, beside motion, text
  size, contrast, the readable font, colour-blind-safe colours and OLED black. It is saved to the account, travels with
  links like the rest of the look, and is painted before first paint as `<html data-ov-icons>`. The Look panel has the
  choice, with a sample bell in each. In the glyphs' CSS the switch point is a variable per area (`--ovg-solid-below`,
  18.4 px by default), and the person's preference (`--ovg-pref`) wins over it. `.ovg-solid` and `.ovg-line` still
  force a style where a site must. The navbar and the bell follow the preference too.

## 4.70.0 — 2026-11-01

- **Line or solid, on purpose** (plan L49; the owner, 2026-11-01: "both sets for any size… swap between them…
  whichever fits the area"). `.ovg-solid` and `.ovg-line` force one at any size. An active control (the current tab,
  a pressed or selected button, `aria-current`, `aria-pressed`, `aria-selected`, `.is-here`) wears the solid drawing,
  as an app's tab bar fills the tab you are on. Kept low in specificity (`:where`) so a site can override it.
- **The app bar feels like an app's** (plan L52; "improve the mobile button so it feels seamless and smooth"):
  - it is drawn once and kept between pages;
  - one pill slides to the tab you are on;
  - a tap lights its tab at once, before the page arrives;
  - a press gives, and the new tab's icon pops.
- **Placeholders shaped like the content** ("placeholder elements while it loads, a fake thumbnail, so it is not
  jarring"):
  - `kit.skeleton({ kind, count })` with seven shapes: card (16:9), row, tile, chip, line, chat and stat;
  - kit.css shimmer, never a spinner, still under reduced motion and Calm;
  - announced as busy.
- **Moving between pages** ("the logo changing while it loads… smarter loading"):
  - `OpenVibeNavbar.busy(on)`: the mark works while something loads;
  - a plain same-site link starts the mark at once, and the next page's mark takes over (a download gives up after
    10 s);
  - speculation rules prefetch same-site pages on hover or press (`moderate`), never /auth, /api, sign-out or a
    download (`speculate: false` turns it off);
  - cross-document view transitions keep the navbar and app bar still while a server-rendered page cross-fades (off
    under reduced motion).

## 4.69.0 — 2026-11-01

- **Icons that read at every size** (plan L49; the owner, 2026-11-01: "really tiny icons… a solid colour rather than
  the border lines… so all our icons look nice across different sizes and devices"). 48 glyphs most often shown small
  have a solid drawing (`glyphs.SOLID`, `glyphs.solid(name)`, `glyphs.inner(name)`): filled shapes with holes cut
  through. ov-glyphs.js draws both, and pure CSS chooses: at 18 px and under the solid one shows, and every other
  glyph draws its lines heavier (`max(0px, (18.4px - 1.15em) * k)`: inside the SVG a px is a grid unit and an em is
  the icon's own size). The sprite carries `ovg-<name>-solid` symbols.
- **An open book** for fa-book-open (the closed one read as an empty square at 14 px).
- **Scroll areas** (kit.css): `.ov-scroll` hands the swipe on to the page at its ends, `.ov-scroll-fill` holds it
  (sheets, modals, full-screen chats), `.ov-scroll-x` scrolls sideways only. On a phone the kit's sidebar sections
  no longer trap the page.

## 4.68.0 — 2026-11-01

- **83 more glyphs, 446 Font Awesome names** (plan L49 step 1; the owner, 2026-11-01: "why Font Awesome? We should be
  using OpenVibe Design's icon system for all our icons"). Every non-brand name Live uses now has a glyph: trend up and
  down, sort, share, move, at, box, bug, megaphone, burst, the camera, chat, cloud, link, phone and user "off"
  variants, record, plus and minus circles, clapper, captions, commit, compass, cookie, couch, cubes, ear, eraser,
  laugh, fish, finish flag, flask, folder tree, skip, gem, ghost, grip, hammer, handshake, wizard hat, broken heart,
  hourglass, lungs, mask, mug, paw, walk, piggy bank, airplane, print, quote, radio, ranking, recycle, RSS, scroll,
  signature, square, sword, columns, thumbs up, undo, user circle, lock, minus, pen and tag, weight, wind, window,
  align left, and slash, plus 40 names mapped onto glyphs that already stand for the same thing. Brand logos stay
  Font Awesome Brands. ov-glyphs.js, the glyph font (22.3 KB woff2), its Font Awesome stylesheet and the sprite are
  rebuilt; existing code points are unchanged.

## 4.113.0 — 2026-11-06

- **Bot API calls can be counted at ingest, not stored row by row.** `AnalyticsTrackerPg` takes
  `countBotApiAtIngest` (off by default): a bot's API call increments `analytics_bot_api_hourly` and
  `analytics_bot_api_daily` by endpoint group, status class and bot family at flush instead of writing a raw
  `analytics_events` row. The hourly and daily rollups add those counters to raw rows, so a day's `api_calls`,
  `bot_hits` and `error_count` are what the raw rows gave before, and a day recomputed at close counts each call
  once. The admin's bot breakdown, status classes and sub-day summary include the counters; a raw page view by a
  bot still keeps its row, and the option off changes nothing. New tables are expand-only: `analyticsSchema()`
  creates them for a new install, and an existing service adds them in a migration.

## 4.67.0 — 2026-10-31

- **Share this look** (plan L45 step 4). The Look panel has a Share button beside "saved to your account". It copies
  a link to this page with `?ov-try=<theme>` (the phone's share sheet on Android and iOS). Anyone who opens it sees the
  page in that theme with theme-loader's Use it / Stop bar, and nothing is saved until they choose. Built-in themes
  only: custom colours never ride a link. `OVLook.shareLink(id)`.
- **The theme's save is dated**, as the display settings are since 4.64.0. The PUT carries `at`, and Network (since
  #458) keeps the newest copy.
- **A feel for each look** (plan L45 step 1). ov-fx.js's motion tokens follow the theme:
  - the quiet paper and light themes move calmly: a little slower, and the spring settles without overshoot;
  - the neon and terminal ones snap: quicker, with a livelier spring;
  - the rest stay lively;
  - Calm still sets every length to zero. `OVFx.FEEL` lists the two groups.

## 4.66.0 — 2026-10-31

- **`ov-fx.js`, the network's effects in one kit** (plan L45; the owner: "reusable modular sharable systems and
  interface"). The mark's motion is now available for anything on any OpenVibe page:
  - **API:** `data-fx="glint glow lift press ripple tilt reveal count confetti shimmer"`, and
    `OVFx.confetti({ x, y, count, colors })` from script;
  - **reveal:** children rise in as they come on screen (`data-fx-stagger`). Anything already on screen when it is
    wired is never hidden;
  - **count:** a number counts up the first time it is seen and ends exactly on its own text;
  - **tilt:** mouse only;
  - **confetti:** one canvas, about 1.6 s, then gone;
  - **motion tokens:** `--ov-dur-1…4`, `--ov-ease-out`, `--ov-ease-spring` and `--ov-ease-in-out`. Calm sets the
    durations to 0;
  - **rules:** nothing runs by itself. Under reduced motion or Calm, nothing is hidden, nothing counts and no confetti
    falls;
  - **loading:** navbar.js loads it from beside itself once the page settles, and only on a page with `data-fx`
    (about 2.6 KB brotli). Also exported as `openvibe-shared/ov-fx`.
- **The static mark has the new depth** (plan L44):
  - `openvibe-shared/mark` takes `depth`, on by default for the brand tone. Each stroke runs from a lighter to a deeper
    tone of its colour, the same mixes `ov-mark.js` uses (`tones(o, v)`), in user space so a straight "!" still paints.
    One-colour tones stay flat;
  - `app-icon.js` draws with it, so the installable icons (`icons/`) and the share cards (`social/`) are rebuilt with
    the deeper mark.

## 4.65.0 — 2026-10-31

- **The mark, with depth and motion** (plan L44; the owner: "the stylistic choices of the logo image need more
  improvement and cooler animations and effects"). `ov-mark.js`:
  - **depth:** each stroke runs from a lighter to a deeper tone of its own colour (gradients in user space over
    `--ovm-o`/`--ovm-v` with color-mix), so states, seasons, tones and a page's own colour still decide it. Tones stay
    flat; browsers without color-mix show flat strokes;
  - **intro:** the O rises and draws itself round, the V drops in on a spring, then a glint of light crosses the mark,
    masked by its own shape (about 1.7 s; `OVMark.intro` replays it for 2 s);
  - **hover and focus:** the V leans and the O hops as before, plus the glint and a soft glow of the two colours behind
    the mark. `data-glow` keeps the glow on, for heroes and brand pages;
  - **press:** the mark gives to 90% and springs back;
  - still: nothing spins, it moves only for its intro, on hover and for states, and keeps still under reduced motion
    and Calm (the glow appears without moving).
- `ov-mark.js` is about 4 KB larger (raw).

## 4.64.0 — 2026-10-31

- **One look, everywhere, with no flash** (plan L42; the owner: seasonal off on Network was still on, and orange, on
  Live; "make it reliable and consistent… instant load… change the theme quickly from that user drop-down… works for
  non logged in users"). Each OpenVibe domain keeps its own copy of the look; now:
  - every copy is dated (`ov_display.at`, `ov_theme.at`), and the newest wins between this browser and the account.
    An account copy without a date still wins, unless a change made here in the last minute may not have reached it;
    when this browser's copy is newer, the account catches up with that date;
  - a click on a link to another OpenVibe site carries the look (`?ov_look=`: what is painted, the display settings
    and the theme, each dated). The next site adopts it when newer, before its first paint, and takes it out of the
    address. It is read only after an OpenVibe page, so a link someone sends cannot set your look, and only colours
    pass (no `url()`, no `expression()`). Guests get it too: nothing needs an account;
  - theme-loader.js keeps what it painted in `ov_paint`, for pages whose loader comes late.
- **`openvibe-shared/look-boot`**: the inline script for the top of `<head>` on a page whose theme-loader.js is deferred
  (Live). It paints `ov_paint`, or a look a link just carried, before the first frame: colours, `data-theme` and the
  `data-ov-*` display attributes, text size, background and `color-scheme`. A season whose dates are over is left for
  the loader. `tag({ nonce })` gives the `<script>`; 1.6 KB.
- **The Look panel** (`ov-look.js`, loaded the first time it opens, 2.5 KB brotli): the palette in the account menu,
  and Look in a guest's menu, open it in place instead of sending people to openvibe.network/themes. Eleven themes and
  the season's own, the season switch, where the look is kept (your account, or this browser), and "More looks on
  openvibe.design", the home of every theme.
- **Calm keeps the O.** Reduced motion hid `.ov-mark .o` along with the old comet; the Pair's ring shares that class,
  so Calm took the O out of the mark. Only the icon's comet hides now.
- theme-loader.js's size budget is 62,000 characters (15.45 KB brotli, was 15.41).

## 4.63.0 — 2026-10-31

- **37 more glyphs, for the Font Awesome names the network still used most** (plan L32 I4; openvibe.design/icons'
  "Still Font Awesome" list, counted 10-31):
  - restroom, shelter, hot-tub, umbrella, parking, skull, group, medical, shapes, headphones, drive, check-double, tv,
    toolbox, table, scale, road, money, heart-pulse, heading, fist, fast-forward, rewind, file-code, dice, contrast,
    briefcase, timeline, seedling, rocket, list-ordered, lifebuoy, infinity, inbox, door, card and storm, drawn in the
    mark's hand;
  - 75 more Font Awesome names map to glyphs (aliases include `info-circle`, `people-arrows`, `right-left`,
    `microphone-lines`, `folder-open` and `money-bill-*`).
  - 192 glyphs for 311 Font Awesome names. The fonts gain the new glyphs at U+E09C–U+E0C0; no code point moved.
- **The glyphs' own motion** (L32 I9):
  - `ovg-draw` draws a glyph's lines in once (`--ovg-draw-duration`, `--ovg-draw-delay`), the way the mark's tick does;
  - `ovg-once` plays any animation a single time (`fa-shake ovg-once`: a bell that rings once);
  - under reduced motion, a drawn-in glyph is simply there.
- `ov-glyphs.js` is 11.1 KB brotli and still loads after first paint.

## 4.62.0 — 2026-10-31

- **Font Awesome's features, kept, on the glyphs** (plan L32 I6; the owner: "basically want to keep Font Awesome, so all
  their features"). `ov-glyphs.js` now carries its own rules for every documented Font Awesome class, with Font
  Awesome's CSS variables, so a site can drop Font Awesome's stylesheet and keep its markup:
  - sizes `fa-2xs` … `fa-2xl` and `fa-1x` … `fa-10x`, `fa-fw`, `fa-border`, `fa-pull-left` / `-right`;
  - `fa-rotate-90/180/270`, `fa-rotate-by` (`--fa-rotate-angle`), `fa-flip-horizontal/vertical/both`;
  - `fa-ul` / `fa-li`, `fa-stack` (`-1x`, `-2x`, `fa-inverse`), `fa-layers` with `fa-layers-text` and
    `fa-layers-counter`;
  - the animations `fa-beat`, `fa-bounce`, `fa-fade`, `fa-beat-fade`, `fa-flip` and `fa-shake`. `fa-spin` and
    `fa-spin-pulse` breathe instead, since nothing on the network spins (L27). Reduced motion stops all of them;
  - `fa-thin` and `fa-light` as thinner strokes of the same drawing (`--ovg-stroke`, `ovg-bold`), and
    `--fa-primary-color` on duotone icons;
  - `data-fa-transform` (grow, shrink, up, down, left, right, rotate, flip-h, flip-v), in Font Awesome's sixteenths;
  - a `title` names the icon to screen readers (`role="img"`).
  - A page that resets an icon's class list but keeps its name keeps the glyph. The drop-in is 9.1 KB brotli and loads
    after first paint.
- **The glyphs as fonts** (plan L32 I5; the owner: "exporting like web fonts, regular font files"):
  - `ov-glyphs.woff2` (12 KB, served at `/shared/ov-glyphs.woff2`), plus `glyph-fonts/ov-glyphs.ttf` and
    `glyph-fonts/ov-glyphs.otf` for desktop apps and design tools. Each glyph's strokes are expanded to outlines
    (picosvg, skia-pathops) by `scripts/build-glyph-fonts.py`, so the font draws what the SVG does.
  - `glyph-codepoints.json`: each glyph's Private Use Area code point from U+E001, given once and never reused.
  - `ov-glyphs-font.css`: `<i class="ovi ovi-eye">`. `ov-glyphs-fa.css`: Font Awesome's class names on the font, for a
    page whose every name is covered.
  - `test/glyph-fonts.test.js` fails when the fonts no longer match the registry. Builds are reproducible
    (`SOURCE_DATE_EPOCH`).
- **The sprite:** `ov-glyphs.svg`, every glyph as a `<symbol id="ovg-<name>">`, served at `/shared/ov-glyphs.svg`
  (`files.IMAGES`; `serve.js` answers `image/svg+xml`).

## 4.61.0 — 2026-10-31

- **The network's own icons: `openvibe-shared/glyphs` and `ov-glyphs.js`** (plan L32; the owner: "our own custom
  icon system… replace Font Awesome… through openvibe.design").
  - **One registry, in the mark's hand** (24-unit grid, 2-unit round strokes): the kit's 84 icons plus 71 drawn for
    the names the network asked Font Awesome for most. 155 glyphs in all, and 236 Font Awesome names mapped. That
    covers 179 of the 188 names used eight or more times; the rest are brand logos (which stay Font Awesome's) and
    a few rare amenity icons.
  - **`ov-glyphs.js`** (built by `scripts/build-glyphs.js`; 7.4 KB brotli) swaps `<i class="fa-… fa-x">` for the
    glyph in place, in the text's colour and size.
    - It follows class changes (play ↔ pause) and markup added later.
    - It leaves `fa-brands` and names it does not know to Font Awesome.
    - It turns Font Awesome's own glyph and spin off on what it swaps. A spinner becomes three dots that take turns.
  - **The navbar loads it** after first paint on any page that uses Font Awesome (a site opts out with
    `glyphs: false`). `kit.PATHS` exposes the kit's drawings to the registry.
- **The files beside the navbar load by content hash** (`SIBLING_REV`, `scripts/sibling-revs.js`): ov-mark.js,
  ov-glyphs.js and the brand face get a new URL each release. After 4.59.0 an edge served the old mark for minutes.
- navbar.js is smaller than in 4.60.0 (its longest comments tightened), so no home page grows: 40.7 KB brotli.

## 4.60.0 — 2026-10-31

- **One left sidebar for every product: `kit.sidebar`** (plan L35; the owner: "the navigation makes more sense in a
  vertical way… part of the openvibe.design shared styling across everything").
  - **The order, top to bottom:**
    - the main action (New chat, Go live, New post) and search;
    - the navigation as vertical rows: an icon and a name, the page you are on marked, a count or a dot;
    - the sections (Pinned, Today…), which scroll on their own;
    - a foot.
  - **On a computer:** a column beside the page. **On a phone:** a drawer over everything, which `kit.sidebarButton`
    opens and the scrim, its close button, Escape and a page move close. The handlers are on the document in
    kit-web.js, so a page that boost swapped in needs no wiring (Codes' rail lost its handler that way, Codes #209).
  - **New builders and icon:** `kit.withSidebar` puts the sidebar and the page side by side; a new kit icon,
    `sidebar`.
  - **In the component contract** (openvibe.design/components): `sidebar`, with a Compose `ModalNavigationDrawer` and
    a SwiftUI `NavigationSplitView` reference view, and a kit-document form (the navigation).

## 4.59.0 — 2026-10-31

- **The OpenVibe mark is the Pair** (the owner, from OpenVibe Mark Systems: "Pair, halo … I like this icon the most.
  This should be our new logo"): a ring O in blue and a round V in violet, with a gap of the ground around the V
  where it crosses the ring. The gap is a mask, so the mark sits on any ground. The V is as tall as the O and the mark
  is centred in its box, so it sits level beside a name in the navbar and centred in a tile.
  - **`openvibe-shared/mark`** (new): the mark as static SVG for servers, icons, share cards and anyone else:
    `svg({ form, tone, wide, size, title })`, `art()` to place it inside another SVG, `geo()`, `shapes()`, `COLORS`.
  - **`ov-mark.js`** draws the same numbers (`test/mark.test.js`). Two forms, the pair and the heavy (22 px wide and
    under; the old `data-form="solid"` draws the heavy). `data-wide` gives a box that hugs the mark; `data-tone="ink"`
    or `"white"` gives one colour.
  - **Every state remade for it, none of them a spin:** the intro pops the O and grows the V out of its point; hover
    leans the V back; busy bobs the V while the O breathes; ok turns the V into a tick, green; error into "!", red,
    with a shake; no into "×", grey; notify pops a dot by the V; live makes the O the record light with ripples; sleep
    closes the O like an eye. The V's shapes morph, and the gap in the ring follows them.
  - **The page-load progress is the ring:** following a link, the navbar's ring empties and draws itself round again
    at this site's learned pace (the same pace as 4.58.0), the V nodding; on arrival the ring closes and the V hops.
    `data-progress` (island.js) draws the ring to its level. `OVMark.intro(el)` replays the intro on one mark (a
    brand page, a splash).
  - **Variants:** Live, VIP, Tips, Deals and Coupons carry a light in the O (Live's red record light). **The season:**
    the O is a pumpkin with its stem and leaf in October, with caps of snow in December.
  - **The navbar** shows the mark in the wide box (`data-size="34" data-wide`), the brand button hugging it; the footer
    at 38 (28 small).
- **The brand face for the names: Nunito** (SIL OFL 1.1, `OFL-Nunito.txt`), cut to Latin and weights 700–900:
  `ov-brand.woff2`, 13.5 KB. A new `files.FONTS` list serves it at `/shared/ov-brand.woff2` (`serve.js`: `font/woff2`,
  CORS as for every shared file); it is not a browser script, so the size report and the bundle test do not count it.
  `navbar.js` declares it from beside itself (`font-display: swap`, its characters only) and sets the site name in
  it; the footer's brand and the site switcher's names use it; every one falls back to the system face. A site with
  its own `/shared` route serves `files.FONTS` beside `files.BROWSER` (`test/brand-face.test.js`).
- **App icons, favicons and share cards** are the Pair: `app-icon.js` draws it (the heavy on the favicon's tile; the
  maskable icon keeps it inside the 40 % safe circle), and `icons/*.png` and `social/*.jpg` are rebuilt; the cards set
  the names in the brand face. **The loading screen** (`loading.js`) shows the Pair at work, and its V becomes "!"
  when loading fails.

## 4.58.0 — 2026-10-31

- **The OpenVibe mark is the Loop** (the owner chose it from OpenVibe Mark Systems: "use the one that's easiest to see
  across all these resolutions and add lots of animations to it"). `ov-mark.js` draws today's open loop, refined: a
  heavier stroke, the V dipping to the middle, the dot balanced in the opening, centred in its box.
  - **Two forms of one shape:** the line (28 px and up: the navbar, headers) and the solid coin with the V cut through
    it (16–24 px, where a line would blur). The form follows `data-size`, or set `data-form="solid|line"`.
  - **Its fill is the progress.** Following a link, the navbar's mark fills as the next page loads, paced by how long
    this site's boost moves and full loads usually take in this browser (a running average per site in localStorage).
    It reaches about four fifths at the usual time, never the top before the page is here, then fills and drains back
    to the line. Single-page apps call `OVMark.navStart()` / `OVMark.navEnd()`. island.js's `data-progress` fills
    the coin to its level instead of drawing a ring around the mark.
  - **States, none of them a spin:**
    - busy: the dot hops in the V;
    - ok: the coin fills green;
    - error: it shakes and the dot drops into the V;
    - no: a small shake in grey;
    - notify: the dot pings;
    - live: ripples go out from the ring;
    - sleep: grey, the dot sinks.

    The intro draws the line in and drops the dot. Hover fills the line into the coin. The motion budget and the
    seasons are unchanged.
- **Nothing spins any more.** The kit's spinning rings are gone:
  - the loader shows the mark with its dot hopping;
  - the player's buffering is three hopping dots;
  - the Action Center, the Dock, the notifications list and agent sessions use three dots, and the Action Center's
    refresh icon pulses;
  - the showcase's and the room kit's decorative rings rest.

  The owner, 2026-10-31: "a spinning circle around an icon… is so lame… things only spin if they're active."

## 4.57.2 — 2026-10-31

- **One page is marked in the navbar after a boost page move.** A site that marks its links on the server (Codes'
  workspace) marked them for the page it served; after `openvibe-shared/boost` swapped in the next page, the old
  page's link stayed lit beside the new one (Usage and Agent catalogue both lit on openvibe.codes). The navbar now
  moves a server mark to the link that leads to the new page (or that the new page sits under).

## 4.57.1 — 2026-10-31

- **A tool's terms line wraps cleanly.** The facts in `kit.toolHead({ facts })` are spaced apart, not joined by dots,
  so a wrapped line no longer starts with a dot that reads like a list bullet.
- **`kit.seg` wraps on a narrow screen.** A segmented control with four to six options (Tools' formatters) stays
  inside a 320 px screen instead of running off it. Tools had a page-scoped rule for this; the kit does it now.

## 4.57.0 — 2026-10-30

- **The Dock can use a refreshing token and a read-only scope set** (the browser extension's one-click
  sign-in). `OpenVibeDock.mount({ token, scopes })` and the Action Center accept a `token` that is a string, a
  sync function or an async function, resolved before every request; the Dock's read, chat and notification
  calls all use it. `scopes` is optional: a site's Dock passes none and keeps every control. The extension
  passes `['dock','activity','chat.read']`, so the Agents tab keeps **Details** but hides approve/decline
  (`actions.decide` absent) and a thread hides the composer (`chat.write` absent) while still reading and
  marking read. `notification-ui.js` and `notification-live.js` resolve a token function per request too, so the realtime ticket uses the refreshed token.
- `dock.js` is 14,219 bytes brotli; the budget is 14,336 (14.0 KB), 117 bytes of headroom.

## 4.56.0 — 2026-10-30

- **A tool states its terms.** `kit.toolHead({ facts })` adds one short line under the tool's sentence:
  - what it costs;
  - where the work happens ("Runs in your browser: nothing is uploaded", or "Your file goes to our server and is
    deleted after 1 hour");
  - its limits.

  This is the first outcome of the market research for tool sites, where people's top complaint is limits they are
  never told. Facts are escaped text, or `{ text, icon }`; blanks are left out. docs/kit.md says to state them from
  the tool's real configuration, never from a guess.

## 4.55.0 — 2026-10-30

- **The tool frame: one order for every tool page** (owner ask 11). It has six new kit builders: `kit.toolHead`,
  `toolInput`, `tries`, `answer`, `family` and `tool` (docs/kit.md, "The tool frame").
  - **The order:**
    - the head, with a crumb to the family, the name, and one sentence saying what the tool does;
    - the box you type in, on the first phone screen, at 17 px so phones do not zoom in, with its clear button and
      the tool's one button;
    - two or three **Try** examples: a tap fills the box and runs the tool, and without JavaScript each one is a
      `?q=` link;
    - the answer, as labelled rows with the fact that matters marked, then the next step;
    - the family's other tools: one sideways row on a phone, a column beside the tool from 1024 px;
    - the About, questions and API folds, then "People also use".
  - **One look.** The family's tint is only on the icon tile, as a hue number that never reaches the style attribute
    as raw text; buttons keep the site's own accent. That ends the cyan, purple and orange tool pages.
  - Everything is plain HTML with escaped text, so it works without JavaScript. It is part of Kit 2: the look is in
    `kit-data.css`, and the clear button and the examples are in `kit-data-web.js`. `kit.css` and `kit-web.js` weigh
    what they did.
- **Fixed: kit-web.js never wired copy buttons, sheet buttons, confirms or titled share links.** Its `once()` marked
  an element under the same dataset name as the attribute that asks for the behaviour: `data-ovk-copy="#id"` is
  `dataset.ovkCopy`. The markup had therefore already "marked" every one of them:
  - copy buttons stayed hidden;
  - a sheet button opened nothing;
  - a kit form with `data-ovk-confirm` ("Delete it?") was sent **without asking**.

  The mark now has a name of its own (`…Wired`), in `kit-web.js` and in `kit-data-web.js`.
  `test/kit-web-chrome.test.js` checks each one in Chrome; it fails on 4.54.0.
- **The Dock keeps "in a window" to the page.** The pop-out window belongs to one page in one browser and closes with
  it, and no other device can open it again (the browser wants a click). So the Dock no longer sends `popped` to the
  Network. That also ends the refused PUT, and its retry, that 4.54.0 made on every pop-out: the Network's
  `network.dock-state@1` contract has no such key.

## 4.54.0 — 2026-10-30

- **The Dock pops out into a window of its own** (Dock plan K-D4). On a desktop browser that can (Chromium's Document
  Picture-in-Picture), the Dock's header carries a "pop out" button: the panel moves into a window of about 360 × 520
  with its tabs and its styles, and the page keeps its pill, which now reads "In a window" — press it and the panel
  comes back. Close the window and the panel returns to the page.
  - **Where the browser cannot open such a window, nothing changes**: no button, no new behaviour.
  - **The window opens only from a click.** A Dock that opened a window by itself would be a window nobody asked for.
  - **The Network is told where the Dock is** (`open`, `tab`, `popped`), as it is today. A Network whose state
    contract does not know `popped` yet refuses the body; the Dock asks again without that one key, so the rest of
    the state still reaches it.
  - **The same Dock, the same look.** The panel's own DOM and styles go with it, along with the page's theme colours.
- `test/dock-chrome.test.js`: the pop-out button only where the browser can open a window, the panel moving into it
  and back, the page's pill saying where the Dock went, and the state reaching the Network.
- `test/dock-size.test.js`: the new size budget for `dock.js` (13.77 KB brotli: 12.27 KB on 2026-10-30 plus 1.5 KB
  for the pop-out).

## 4.53.1 — 2026-10-30

- **The patch-notes link under "Recently shipped" wraps on a narrow screen.** It carries a whole post title ("Patch
  notes: 81 changes across 43 sites (Oct 30) →") and was kept on one line, so it ran past a 320 px screen (found on
  openvibe.host, which had overridden it). The short "What's in it" link in a grouped row stays whole.

## 4.53.0 — 2026-10-30

- **The full footer folds on phones** (the short-pages rule: a phone page is one or two screens, and the footer alone
  was 1.1–1.4 of them). Each link column (the site's own, Network, Popular tools, Legal) is a `<details>` fold.
  - **On a phone** (560 px and under) each column is a 48 px row with its heading and a chevron, folded. The footer
    measures 506 px at 390 px wide instead of 891 px.
  - **A desktop is unchanged.** The heading is only a heading: not a control and not in the tab order.
  - **A fold the person opens stays open** through a re-render. Turning a phone sideways (wider than 560 px) opens
    every column again.
  - **Every link stays in the page.** The server writes every fold open, so crawlers and pages without script see
    them all; the client folds them on a phone.
- `test/footer-folds.test.js`: the folds' markup, the desktop and phone rules, and the compact footer's whole footer.

## 4.52.0 — 2026-10-30

- **The Dock's Chats tab** (Dock plan K-D2). The person's conversations and DMs, on every OpenVibe site.
  - **Where they come from:** OpenVibe.Chat's own API with the person's Network token (`GET /api/dm/conversations`,
    `/unread`, `…/messages`, `…/read`; Chat checks they are in each one).
  - **The list:** named for the other person or the group, with the last line ("You: …" when it was theirs), the
    time and the unread count.
  - **A thread opens in place:** their bubbles and yours; Enter sends and Shift+Enter is a new line. It polls for new
    messages every 5 s while it is open, is marked read as it is shown, and links out to Chat.
  - The open chat is the Dock's state, so it follows you between sites. The tab counts Chat's unread messages.
  - **Safety:** what people wrote is always text, never markup, and only https pictures are shown.
- **A tap that redraws its own panel no longer closes the phone sheet.** Opening a chat replaced the list, so the
  tapped node was detached by the time the tap-outside check ran; it now reads the event's path at dispatch.
- **Narrow Docks** (under 440 px) drop the tab icons, so three tabs, their counts, the pin and × fit.
- `dockChatBase` overrides Chat's origin for tests and staging. dock.js is 12.3 KB brotli, for signed-in people only.
- `test/dock-chrome.test.js` adds the Chats scenario: the list and its counts, the thread (text, never markup), Enter
  sends, read receipts, the state, and the phone sheet staying open.

## 4.51.0 — 2026-10-30

- **The Dock** (`dock.js`; the Dock plan of 2026-10-30, K-D1; master plan L13). The owner, 10-30: your agent and your
  chats "more accessible across sites … sleek, modern, minimal". It is one surface at the edge of every OpenVibe page.
  - **The pill:** the mark (busy while an agent works), a word and a dot (amber, with a ping, when something needs
    you). It shows only while an agent works, one needs you, or the person pinned it, in the corner the Dock sits in,
    above a phone's app bar.
  - **The Dock:** a floating card on a desktop and a sheet on a phone, with two tabs. **Agents** is what needs you,
    then what runs, with Approve and Decline in place. **Activity** is the bell's list.
  - **On a desktop:** it is not modal; the head (or a tab, after 6 px) drags it to a corner and the free corner
    resizes it.
  - **State:** it is the Network's, so it follows the person between sites:
    - `GET /api/v1/me/dock`, then one debounced `PUT` per burst of changes;
    - this site's copy paints it first;
    - an open Dock reopens on a desktop, never on a phone;
    - a 404 keeps it away for a day.
  - **Weight:** navbar.js grows by 0.6 KB brotli (the loader, the account menu's Dock tile, `openDock`; its budget
    is now 41 KB). The pill and the Dock are `dock.js`, 8.6 KB brotli, loaded for signed-in people only.
  - **Test:** `test/dock-chrome.test.js` covers when the pill shows, both tabs, the PUTs, drag and resize within the
    limits, restore on desktops only, the 404, signed out, and 320 px.
- **`OpenVibeActionCenter.mount(container, { token, apiBase, buckets, onCounts })`:** the Action Center's rows in
  another surface's container, with their own data and timer.
- **`OpenVibeNotifications.renderDock(container)`:** the bell's list without a frame, with Mark all read in its foot.
- **Desktop toasts** stack above the Dock's pill in the bottom-right corner (`--ov-dock-clear`).

## 4.50.1 — 2026-10-30

- **The seasonal fall lands on the bar.** Once a day the mark's leaves (snow in winter) fell 120-280 px from the brand,
  over a page's heading on phones (Codes' conductor, 10-30). They now drift down to the bottom edge of the bar the mark
  sits in (`.openvibe-navbar`, `header` or `nav`), settle there and fade, inside the screen's width; a mark outside a
  bar gets a short fall of 36-64 px. `test/ov-mark.test.js` covers the landing, the short fall, once a day and no fall
  without a season.

## 4.50.0 — 2026-10-30

- **Rich embeds in the agent session.** The owner, 2026-10-30: "When it generates or reads or analyzed images or visuals
  or files it should show a rich embed in chat for them like in Claude, Codex, ChatGPT." A step or a message may now
  carry `attachments: [{ url, name, mime, size?, kind, role }]`; the component draws them and never builds a URL itself.
  - A step's attachments show in its group's header, visible while the group is folded: images as 136 × 92 thumbnails
    with their name, everything else as a chip with an icon. A message's show under its text.
  - A tap opens a preview sheet: the image at full width (pinch to zoom on a phone), video and audio in their players,
    a PDF in a frame, and text as code, Markdown, a CSV table or pretty JSON, highlighted — plus Open and Download.
  - The thumbnails load lazily, a broken image hides itself, and the sheet is keyboard reachable (Escape closes it).
  - Safety: an attachment loads only from the product's own origin or Media's, never from a third-party address the
    model printed; SVG is only ever an `<img>`; text is set as text, never as markup.
  - `test/agent-session-embeds-chrome.test.js` covers it in a real Chrome.

## 4.49.0 — 2026-10-30

- **Shared motion tokens for production patterns.** Adds standard and back easing curves plus fast, base, slow, and reduced durations (180, 260, 360, and 0 ms).

## 4.48.0 — 2026-10-30

- **The OpenVibe mark opens a site switcher.** The owner: "clicking the icon … its own drop-down … all the sites, so
  you can hop between them fast". `site-switcher.js` loads on the first tap of the mark, as search.js does for the
  menu.
  - What it shows: a compact grid of every open site, with Recent, then Pinned, then the frame's groups, most used
    first. The page's own site is marked.
  - How to use it: type to filter, use the arrow keys to move, Enter to go and Esc to close. Hold a site, or
    right-click it, to pin it.
  - On phones it is a sheet under the bar that keeps its own scroll.
  - Recent and pinned follow the account through Network `/api/themes/me/sites`. Signed out, they stay on this site.
    The navbar records one visit per site per 30 minutes for a signed-in person, never under GPC or DNT.
  - The site's name in the bar stays its link home. `switcher: false` keeps the mark as a home link.
  - `test/site-switcher.test.js` covers it in a real Chrome.
- **The OpenVibe menu, cleaner** (the owner: "the search input is styled all weird … For you kind of sucks … just get
  to basic tools"):
  - the search field is a rounded field with a soft focus ring; a site's own focus style can no longer draw a box
    on it;
  - the placeholder and the headings use the site's short name ("Search Download, or ask Vibe", "On Download"),
    not the page title, which was cut off;
  - "For you" is now **Start**: this site's places, **Quick tools** (QR codes, images, PDFs, word counts first,
    then the most used), recent searches, then popular sites;
  - opening, the groups rise in one after another.

## 4.47.3 — 2026-10-30

- **A tap on the logo no longer opens the menu.** On a phone, the menu button's invisible touch area (4.46.0) covered
  the whole navbar. The touch rules made the button `position: relative`, but its own `all: unset` rule came later and
  reset it, so the 44 px hit area was placed against the bar instead. A tap on the mark, the site's name or the orb
  opened the burger menu on every site on 4.46.0–4.47.2 (found on openvibe.network). The burger now keeps its own
  position. `test/navbar-hit-areas.test.js` checks that every touch hit area stays on its own button.

## 4.47.2 — 2026-10-30

- **The updates log reads as changes, not commits.** `shipped.js`'s log folds the entries of one day that are the same
  change into one row: a pin bump by package and version ("Shared 4.45.0 reached 31 sites", with a link to what's in
  it), anything else by its subject without the PR number or a leading name of the entry's own site ("Touch targets on
  phones (fleet audit)" on fourteen sites). The row shows how many sites, the time span and the sites by name; every
  commit is one tap away in its fold. Groups continue across "Load more". openvibe.network/updates went from 50 rows
  to 9 with the same 50 commits.
- The OpenVibers account every commit shares is no longer named on each row; any other author still is.
- `groupEntries(entries, dayKey)`, `groupTitle(g)` and `groupNotes(g)` are exported, so a server-rendered page groups
  the same way.

## 4.47.1 — 2026-10-30

- **No page is wider than a phone.** A sideways row (`.sc-row`, `.ovk-tabs`, `.ovk-stats`) is `position: relative`, so a
  hidden label (`.sr-only`, `position: absolute`) inside a card past the edge stays in the row instead of widening the
  page. The phone hero's watermark (`.sc-hero-vis`) sits inside the hero's corner instead of 54 px past the screen;
  five homes were 434-451 px wide on a 390 px phone.
- docs/kit.md "Scrolling on touch screens": the rules for boxes, sheets and sideways rows on touch screens, and the
  width check.

## 4.47.0 — 2026-10-29

- **The kit renders natively, on Android and iOS.** `scripts/native/compose/KitRenderer.kt` (`KitView(doc: KitNode)`, a
  Composable that parses the document with org.json) and `scripts/native/swiftui/KitRenderer.swift`
  (`KitView(doc: KitNode)`, a SwiftUI `View` that decodes it with Codable) draw a kit document with the kit's own
  reference views, wearing the generated tokens (the Material 3 colour scheme and `OvScale` in Compose, `OvTokens` and
  `OvScale` in SwiftUI). A tap comes back as an action, so the app decides what a link or a button does.
- A sample document (`scripts/native/sample-doc.json`: a hero, a card rail, a list, stats and a notice) passes
  `components.validate()`, and the native CI compiles the Kotlin against Compose and type-checks the Swift against
  SwiftUI together with the tokens and the reference views. A component added to `components.js` without a native
  view now fails the kit check, so the two languages cannot fall behind the web.

## 4.46.1 — 2026-10-29

- `showcase.apps`: a set of six or nine is three a row (`sc-apps--c3`), on a phone and from 600 px. Four columns left one
  tile alone on the last row (nine was 4 + 4 + 1).

## 4.46.0 — 2026-10-29

- **Touch targets from the fleet audit** (effective hit areas at 390 px: a 7x7 grid of `elementFromPoint` probes over
  the 44 px square around each target, `research-2026-10-29/tap-targets.md`). On touch screens (`pointer: coarse`)
  only:
  - navbar: Sign In, the menu button and the orb get an invisible 44 px hit area (drawn as before). The brand mark's grows
    to 44. The site's name is 44 tall. The orb grows only 4 px sideways, so the name 8 px away keeps its own taps;
  - footer: column links are rows of 32 px (the footer is ~180 px taller on a phone; WCAG 2.5.8 AA asks 24). The social
    links are 44 px, and the legal links in the bar get a taller hit area;
  - the shipped strip's lines get a taller hit box with no layout change (padding in, margin out);
  - kit: `.ovk-btn--small` is 44 px tall, `.ovk-go` reaches 44 px invisibly, and the find bar's field and select are
    44 px tall.

## 4.45.1 — 2026-10-29

- **The generated native code is compiled now, not just read.** `scripts/native-check.js` writes the theme's Compose
  and SwiftUI output (the default theme and the light half it pairs with) and the kit's reference views (the
  preamble and all eleven components) out as `.kt` and `.swift` files, and a new workflow
  (`.github/workflows/native.yml`) compiles the Kotlin with kotlinc against the Compose runtime and UI artifacts and
  type-checks the Swift with swiftc against SwiftUI. A generator that writes code nobody can compile fails the build
  here, instead of waiting to be found in an app.
- **Two things that check found in the Swift reference views:** the card's ratio was `16 / 9` (integer division, so
  the picture area came out square) and the numbers list keyed its rows by a tuple's field, which Swift cannot do.

## 4.45.0 — 2026-10-29

- **Comfort settings beside the theme.** Four display preferences join motion, text size, seasonal and scheme in
  theme-loader.js (`OpenVibeThemeLoader.display`), and follow the account the same way:
  - `contrast: 'more'`: secondary and muted text and the borders move toward the text colour, links in running text are
    underlined, and focus rings are thicker;
  - `font: 'readable'`: Atkinson Hyperlegible where it is installed, else Verdana or Tahoma, with a little more letter,
    word and line spacing;
  - `colors: 'cb-safe'`: success, warning and danger in Okabe-Ito blue, yellow and vermillion (with a light half), so
    red and green never carry a meaning alone;
  - `oled: 'on'`: true black backgrounds on dark themes.
  Each sets one attribute on `<html>` (`data-ov-contrast`, `data-ov-font`, `data-ov-colors`, `data-ov-oled`). The rules are
  `!important` custom properties, because the theme's own values are inline. Nothing is fetched (no font file). They
  change how any theme reads, never which theme it is. OpenVibe.Design's "Your look" sets them; OpenVibe.Network keeps
  them on the account.

## 4.44.0 — 2026-10-29

- **`showcase.fold({ id, title, hint, html, open })`** folds read-once material (how it works, the code samples, what
  every page shows) under its own heading. The heading stays visible in the summary and keeps its id, so links still
  land and the outline does not change; other showcase sections nest inside and drop their own width and padding. It
  takes the sections' width and font, which the eleven local folds written on 2026-10-29 had to repeat (three of them
  missed: one rendered in the browser's serif, edge to edge).
- **`.sc-row`** on any list makes it one sideways row on a phone (scroll snap, the next card peeking, every item still in
  the HTML) and leaves it as the page made it on wider screens. `--sc-row-w` sets the card width (82% by default). It
  wins over a page's own grid and never inherits a `flex-wrap` (the video home's figures wrapped into 2×2).

## 4.43.0 — 2026-10-29

- **A theme for one site.** `shell.page` writes `<html data-ov-service="<site>">` (the page's service id, when it is a short
  lowercase name), and theme-loader.js asks the account for `/api/themes/me/active?service=<site>`. When the person has
  set an exception for that site in OpenVibe.Design ("Games in Neon Tokyo", OpenVibe.Network#419), the site wears it;
  everywhere else, and on a Network that does not know the parameter yet, the account's theme as before.
  `OpenVibeThemeLoader.site()` names the site.

## 4.42.0 — 2026-10-29

- **OpenVibe components (`openvibe-shared/components`, also `/shared/components.js` as `window.OpenVibeComponents`).** The kit's components as a contract that is not HTML. Eleven components (button, card, rail, row, list, section, fold, tabs, numbers, notice, empty state), each described by its anatomy and the tokens every part wears, its typed props, variants, states, accessibility and phone/tablet/computer behaviour, with a reference view for Jetpack Compose and for SwiftUI on the same tokens. **Kit documents**: a screen as a JSON tree of components, validated strictly (types, enums, required props, children, depth, size, https or same-site links) and rendered through kit.js exactly as the direct builder calls would. The server-driven UI shape a native app can render with its own views. docs/components.md.
- **tokens:** the Compose, SwiftUI and Flutter files put the kit's scales (radius, space, size, type, motion) in one theme-independent `OvScale`; the theme objects carry the colours.

## 4.41.0 — 2026-10-29

- **Try a theme on any OpenVibe page: `?ov-try=<theme>`** (theme-loader.js). It paints a catalog theme on the site without saving it: built-in themes at once, gallery themes from Network's catalog. The try is kept for the tab (sessionStorage) as the person moves around, and every repaint wears the tried theme (the account's sync, another tab, the device's light/dark). A bar at the bottom, above the app bar and 44 px to the touch, says "Trying <name>" with **Use it** (saves to the account, as the studio does) and **Stop** (back to the account's theme; `?ov-try=off` does the same). Only a catalog name is read from the URL, never colours, and nothing is saved until Use it. `OpenVibeThemeLoader.try.start(id)` / `.stop()` / `.current()` do the same from a page. OpenVibe.Design links to it ("Try it on Live"). test/theme-try.test.js.

## 4.40.0 — 2026-10-29

- **OpenVibe Tokens (`openvibe-shared/tokens`, also `/shared/tokens.js` as `window.OpenVibeTokens`).** A theme as a W3C Design Tokens (DTCG) document of semantic tokens (`color.bg.base`, `color.accent.strong`, `color.status.ok.text` … plus the kit's radius, space, size, type and motion scales), compiled to CSS variables (with the network's names as aliases), Tailwind, Jetpack Compose (tokens and a Material 3 colour scheme), SwiftUI, Flutter, Figma variables and DTCG JSON. A theme's dark and light halves compile into one file. Values are validated (colours and shadows only) and names become identifiers, so nothing typed in the studio reaches generated code. This is the first piece of making the design system native-ready: real Android and iOS apps wear the same theme, without a web view. docs/tokens.md.

## 4.39.1 — 2026-10-29

- **room.css stands on its own.** A front page that loads room.css without kit.css (Media's, to skip kit.css's 25 KB)
  had no `--ovk-*` tokens: cards lost their corners and colours, a card without a picture had no background, and its
  `kit.stats` strip was a bare list. room.css now carries the same tokens (as `:where(:root)`, so kit.css's and a
  site's own values always win) and the numbers strip. The copies are identical, so loading both files changes nothing, and
  test/room-kit.test.js keeps them that way. room.css: +2.8 KB raw.

## 4.39.0 — 2026-10-29

What the front-page passes of 10-29 (Media, Quest, Actor, Rent, Services, Community) each had to add locally:

- **`kit.rail({ wrap: true })`**: phones still swipe; from 760 px every item shows in a grid, with no arrows and no
  kit-web.js. Media and Quest drew this with their own rules.
- **`kit.card({ sub, preview, whoHtml })`**: one plain muted line under the title (Rent showed the city as a badge and the
  kind only on hover); a text thing's first nine lines in the media instead of an icon (Community's code pastes); the
  name as escaped markup with its decorations. **`kit.row({ rel })`** for links people posted.
- **No tile alone on a row in `showcase.apps`**: two to four tiles (or eight, twelve…) get a column count that fills
  their rows. Four are four across on a phone, two by two from 600 px and four from 960 px (Actor had local rules).
- **44 px to the touch**: the rail's See all (32 px), tab pills (36 px), a list's heading link and the launcher's See
  all, on touch screens and below 760 px.
- **A number that is a link is not underlined**: the whole stats tile is the target, with a hover border and a focus ring.
- **The Markdown twin reads kit markup as a person sees it**: a card's who, count and time keep their spaces
  ("Maticus12 viewsTue" was what agents read), buttons, icons, players and the ⋯ menu are left out, and a stats strip
  is `- label: value` lines.
- `scripts/kit-gallery.js --rooms`: a gallery page of front-page pieces (cards, both rails, stats links, launchers).

## 4.38.0 — 2026-10-29

- **`showcase.apps`: a launcher.** A set of apps or sites as a phone's home screen shows them: icon tiles three or four
  to a row with the name under the icon on a phone, rows with a one-line tagline from 600 px, optional groups and a
  See all link. The network's front door listed its 47 sites as feature cards, 8,459 px on a phone; as a launcher it is
  about a fifth of that.

## 4.37.0 — 2026-10-29

- **Kit 2 has its own files: `kit-data.css` and `kit-data-web.js`.** Its look and behaviour moved out of `kit.css` and
  `kit-web.js`, which weigh what they did before Kit 2 again (kit.css 44 → 25.6 KB, kit-web.js 20 → 12.4 KB). A page that
  draws steps, a table, a chart, a ranking, a meter, a drop zone or a receipt adds `kit-data.css` after `kit.css`, and
  `kit-data-web.js` for chart readouts and drop zones. Why: Media's front page needed only cards and rails, and the
  44 KB kit.css took its stylesheets from 28 KB to 63 KB; every site in the pin round would have paid the same. The
  builders (`kit.js`) are unchanged. Breaking only for a page that used Kit 2 on 4.36.x without the new files (Report,
  Vision, Sources and Codes, updated alongside).

## 4.36.2 — 2026-10-29

- **kit-web.js on boosted sites:** a page reached through boost.js (a swap of `#main`, no page load) now gets the kit's
  behaviour too — copy buttons, menus, sheets, rails, drop zones, chart readouts. kit-web listens for `ov:boost:load`;
  enhance() was already idempotent.
- **Tables:** a long value (a DNS name, a model id, a URL) wraps inside its cell instead of widening the table, on wide
  screens and in the stacked phone cards.

## 4.36.1 — 2026-10-29

- **Kit 2 charts:** a scatter label right of centre could run past the chart and widen a phone page (a 390 px
  phone laid the page out at 601 px). The chart clips to its own box, and kit-web.js moves a label that would cross the
  right edge to the left of its dot. The real cause on Report was the screen-reader copy of the numbers: a table
  cannot shrink below its content, so even visually hidden it set the page's width; it now sits in a hidden box.
- **Kit headings hold their look on every site:** a site rule such as `.rp h2` had the same specificity as the kit's
  `.ovk-section > h2` and loads later, so it restyled kit headings (Report showed a section title at display size).
  The kit's heading and paragraph rules now double their class (`.ovk-section.ovk-section > h2`, `.ovk-card .ovk-card-title`),
  which outranks any one-class site rule. No markup changed.

## 4.36.0 — 2026-10-29

- **Kit 2:** the pieces data and tool pages need, in `kit.js`/`kit.css` (`kit-web.js` adds their behaviour):
  `steps` (a flow of a few steps), `table` (a real table that turns into labelled cards under 600 px), `chart`
  (`line`, `area`, `bar`, `scatter` with a frontier; an SVG stretched to the box with every label as real text,
  focusable points and bars, a screen-reader table, a hover and arrow-key readout), `rank` (a leaderboard),
  `meter`, `drop` (a file input with drag, paste and the phone camera), `receipt` (a result and what it took),
  `page` (the app page's whole shape) and `num` (money, compact, percent, ms). `kit.VERSION` is 2. Additive: no
  existing class or builder changed. See docs/kit.md, "Kit 2".
- **SEO:** `seo.jsonLd` gains `event`, `jobPosting`, `recipe` and `dataset` builders (the shapes Events, Today, Work,
  Food and Bench shipped by hand on 2026-10-29), so the next site to need one uses the shared, tested shape.

## 4.35.0 — 2026-10-29

- **Showcase:** the page root clips the horizontal axis (`html { overflow-x: clip }`), so a narrow page whose
  hero aura is drawn past the right edge never scrolls sideways on a phone. Vertical scrolling and sticky
  positioning are untouched — unlike `overflow-x: hidden`, `clip` does not create a scroll container. Four
  sites had patched this in their own stylesheets on 2026-10-29; the kit now owns it for every site that
  includes `showcase.css`.

## 4.34.0 — 2026-10-29

- **Agent discovery:** the server-only `agent-layer` module serves `/.well-known/agent.json`
  from a service descriptor and Markdown twins from the same public renderer as HTML.
  Frame discovery links, Link headers, and optional Markdown links in `llms.txt` accompany
  the three-line mount; see [the adoption guide](docs/agent-layer.md). Browser assets are unchanged.

## 4.33.0 — 2026-10-28

- **Navbar icons:** 15 more Font Awesome solid glyphs are drawn inline (`nav-icons.js`, loaded after first paint):
  `fa-gauge`, `fa-pen`, `fa-earth-americas`, `fa-hashtag`, `fa-inbox`, `fa-folder`, `fa-puzzle-piece`, `fa-shield`,
  `fa-display`, `fa-microphone`, `fa-infinity`, `fa-list`, `fa-flag-checkered`, `fa-tv` and `fa-compass`.
  - Sites already named them in their links and phone app bars, so they used to show **empty** wherever the page
    loads no icon font (Actor, Blog, Chat, Codes, Coupons, Deals, Live, News, Services, Trade, Surf).

## 4.32.0 — 2026-10-28

- **The session view** (`agent-session.js`, plan 2026-10-28 §6 decision 4, CODES-3):
  - its look moves to **`agent-session.css`** (served at /shared/, in `files.js`), so OpenVibe.Design can theme it. The
    script links it from beside itself unless the page links it in its `<head>` (do that to paint styled from the
    first line).
  - a **Files** tab: every file the agents edited or wrote, with its +/− and how many changes; a tap opens its step.
    `view.files()` answers the same list.
  - each step keeps its **raw input**, folded under Input, with Copy.
  - **cost per agent** in the head (from each agent's done line; `summary().costByAgent`) and **per step** when a
    `tool_result` carries `cost_usd` (and `duration_ms`).
  - an optional sticky **action bar**: `opts.actions` / `view.actions([{ id, label, kind }], note)` with
    `opts.onAction(id)` (Approve, Continue, Stop…); the buttons stay disabled until the page's promise settles.
  - a done line never moves the head's "who is working".

## 4.31.0 — 2026-10-28

- **The Action Center** (Notifications 2.0, plan 2026-10-28 §3.10): the ✦ beside the bell opens every agent task in one
  place, on every site.
  - Tabs: Running (re-read every 15 s while open), Waiting for you (Approve and Decline right there), Scheduled, Done
    (cost, steps and the page) and Failed (why).
  - A service that did not answer is named.
  - A 420 px popover on desktop; on phones the bell's Agents tab opens it as a full-height sheet.
  - It reads Network's `GET /api/v1/me/actions` (Network#396, contracts 0.229.0).
  - `action-center.js` loads on the first click (8 KB brotli budget); `notification-ui.js` adds only the button.
  - `init({ actions: false })` leaves the ✦ out; `openActions(anchor)` opens it from a site's own control.

## 4.30.0 — 2026-10-28

- **The bell center** (Notifications 2.0, plan 2026-10-28 §3.10):
  - a 420 px popover on desktop, and a full-height sheet on phones with a drag handle, a × and a scrim;
  - tabs: All · Mentions · Live · Deals & alerts · System · Agents, with unread counts from Network's
    `/api/notifications/unread-by-tab` (Network#392; none without it), and an Unread filter for any tab;
  - each tab says what would be there when it is empty;
  - rows carry a thumbnail from `rich_content` (image, thumbnail_url or thumbnail, never the avatar twice), an unread
    dot on the left, and swipe right to read or left to clear on touch screens.
- **Quiet hours:** in the person's window (Network `GET /api/notifications/quiet-hours`, Network#390) toasts and sounds
  wait; the bell still fills, and critical notices still show.
- **Readable tones:** severity chips, ×N counts and glyphs mix their tone toward the text colour (the orange WARNING
  chip was about 2:1 on Daylight).
- `notification-ui.js` loads only after sign-in; its size budget is 24 KB brotli (measured 22.6 KB).

## 4.29.2 — 2026-10-28

- **`sc.room()`'s look moves to `room.css`** too: 4.28.0 had put it in `showcase.css`, which every product home loads,
  and that is what failed 22 sites' CSS budgets (cssRawKB 39.8 > 37 on Help). `showcase.css` is back to its size
  before the room kit; `room.css` holds the rooms' accents, cards, rails and front door. A room's pages load
  `kit.css`, `room.css` and `showcase.css`.

## 4.29.1 — 2026-10-28

- **`room.css`**: the room kit's cards, rails and room accents leave `kit.css` for a stylesheet of their own.
  - `kit.css` stays the controls only, so sites that use the kit's controls are not charged for components they
    never draw. 4.28.0 had made 18 sites' CSS budgets fail on the pin round.
  - Pages with `kit.card`, `kit.rail` or `sc.room()` load `room.css` after `kit.css`.
- **`motion.js`, `rooms.js` and `room.css` are served at `/shared/`** (they were missing from `files.js`'s lists in
  4.28.0, so `/shared/motion.js` answered 404).
- **The new rooms have ring icons:** each room id resolves to the nearest existing glyph until it gets its own, so the
  menu never draws the fallback mark. The mapping:
  - domains: globe;
  - design: palette;
  - today: clock;
  - report: gauge;
  - surf and casino: games;
  - fun: quest;
  - meme: image;
  - exchange: trade;
  - cam: video;
  - tours: map;
  - vision: AI;
  - shoes: deals.

## 4.29.0 — 2026-10-28

- **Every result, in the OpenVibe menu** (the Search Fabric, plan 2026-10-28 §4.5; Contracts 0.225.0
  `search.fabric.query`). Pressing Enter in the menu's search box now shows every result in the panel itself.
  - **Exceptions:** a row picked with the arrows opens that row, and a place's exact name (`live`, `tools`) still
    goes to the place. "All results for …" and a recent search open the results too.
  - **Tabs:** All · OpenVibe · Web · Video · News · Products, and Yours for a signed-in person.
  - **OpenVibe's results** come at once: this site's first ("On OpenVibe.Live"), then across OpenVibe. They are
    fetched with Network's `GET /api/frame/query` (scopes network and, signed in, mine; depth quick), through the same
    connect-src as suggestions.
  - **The web's results** arrive on their own request, with skeleton rows meanwhile. Each says its host and who
    found it ("en.wikipedia.org · via Wikipedia").
  - **Snippets** run two lines.
  - **A closing line** says what was searched and how long it took ("Searched OpenVibe in 40 ms · the web through
    DeepSeek and Wikipedia in 1.4 s").
  - **Your own results and paid providers:** the person's token goes along, so their own results and the paid web
    providers are theirs.
  - **Safety:** titles are text and script links are dropped, as everywhere in the menu.
  - Typing again returns to suggestions.
- The menu's browser test waits for the lazily loaded box instead of a fixed 400 ms (a macOS runner was slower).

## 4.28.0 — 2026-10-28

- **The room kit** (plan 2026-10-28 §3.3–§3.5, §3.11): what every new room's pages are built from.
  - **`rooms.js`** (`openvibe-shared/rooms`, `window.OpenVibeRooms`): the fourteen rooms (Fun, Shoes, Tours, Today,
    Meme, Domains, Casino, Exchange, Cam, Surf, Report, Website, Vision, Design) with:
    - their neighbourhood, host, hero line (eight words at most), icon and motif;
    - an accent every 25° of OKLCH hue: a dark-theme value that passes AA on `#0B0D12`, and a light-theme value
      (text and filled buttons) that passes AA on white.

    `rooms.style(id)` on a wrapper with the class `ov-room` gives `--room-accent`, `--room-strong`, `--room-fill` and
    `--room-on`, in the right one for the theme's mode (`:root[data-theme-mode]`). An unknown room keeps the
    theme's accent.
  - **`kit.card()`**: one card for every kind of thing.
    - Media in the type's shape (16:9 streams and runs, 1:1 memes, shoes and deals, 4:3 reports and themes,
      2:1 domains) with a badge (LIVE pulses) and a corner (a length or a price).
    - A peek line on hover, and a muted preview loop that loads only while the card is hovered (computers only,
      never under reduced motion).
    - The title in two lines at most, then who, one count and when. A count of 0 or none is left out.
    - A ⋯ menu: Save and Remind when given, and Share always (the system share sheet, else the link copied).
    - The whole card is one link.
  - **`kit.rail()`**: a row that snaps.
    - About 1.2 cards show on a phone, bleeding to the screen's edge.
    - Fixed widths on wider screens (`s` for square things, `m`, `l`).
    - ‹ › buttons on devices with a pointer, each hidden at its end.
    - A card's menu inside a rail is placed on the screen, so the scroller never clips it.
  - **`sc.room()`**: a room's front door, in the order every room shares: the hero, the rails, the scenes, then
    explore, for developers, questions and the rest of OpenVibe.
    - The hero holds up to eight words, one box (with typed hints) or one Start, five chips at most, and the
      live proof.
    - Every live-proof number is real and is either live or dated; a 0 is left out.
    - The room's motif sits beside the hero, and faint in the corner on phones. The default is the room's icon in
      an aura of its accent; a room can bring its own.
    - Feature scenes alternate sides and reveal as they scroll in.
  - **`motion.js`**: reveal on scroll, a number ticker and a typed placeholder.
    - The server always writes the end state, so a page is complete without the script, under reduced motion
      (the OS setting or the account's) and for crawlers.
  - The kit's icons gain `chart`, `swap`, `wave`, `shoe` and `palette`.

## 4.27.0 — 2026-10-28

- **Notifications 2.0** (`notification-ui.js`). The owner's screenshot on 10-28: three red "Alert:
  OpenVibeBrowserCheckFailed" toasts drawn over the open menu, translucent and overlapping, a siren emoji, raw
  "run: sudo ovhost …" text, a badge of 67.
  - **Toasts:**
    - an opaque, themed card with a line glyph for the kind of notice (never an emoji), or the sender's avatar with
      the glyph as a badge;
    - a one-line title, up to two lines of text, chips, up to two actions and a timeout bar;
    - phones show one at a time under the bar, with "+N more" inside the card and swipe to dismiss;
    - desktops show up to three at the bottom right.
  - **Layering:**
    - a toast **never draws over an open menu, sheet, panel or dialog**: it waits, timers paused, and shows when the
      layer closes;
    - open layers are read from the page itself (the menu's `is-open`, any bar toggle's `aria-expanded`, a drawn
      `aria-modal`, `dialog[open]`), so a lazily loaded bell still sees a menu opened before it loaded.
  - **Grouping and priority:**
    - the same notice within 15 minutes joins the card that is showing ("Browser check failed ×3" with the sites as
      chips);
    - one notification id is one card, however often a poll or a push brings it;
    - critical first: a full stack lets a lower-priority card go, never a higher one.
  - **Operator alerts** read as System cards: "Browser check failed · Release 80b7955 · 1 failing check", the
    severity, the sites, "Open status", and the fix command behind **Copy fix command** in the bell, never in the
    body.
  - **The bell:**
    - day headers, category chips, unread dots and grouped repeats, plus search;
    - the row's read and dismiss buttons sit on its time line, never over its text, and are always shown on touch
      screens;
    - polling toasts only what is unread and newer than the last thing seen.
- **Budget:** `notification-ui.js` 13 → 20 KB brotli. It loads only after sign-in, when the bell mounts.

## 4.26.1 — 2026-10-28

- **No site name twice:**
  - **The problem:** 14 homes opened with "OpenVibe.X · …" under a navbar that already says the name.
  - **The fix:** an eyebrow led by the site's name ("OpenVibe.Food · What should we eat?") now keeps only what follows it ("What should we eat?"), starting with a capital.
  - **Unchanged:** a name later in the phrase stays. An eyebrow that is only the name was already left out (4.23.0).

## 4.26.0 — 2026-10-28

- **Every showcase hero gets a visual** (`showcase.js` `hero`; the owner, 2026-10-28: the heroes were "ugly af,
  boring… not easy to understand… nice animated visuals"). The 32 sites whose home starts with `sc.hero` get it on this
  pin, with no change of their own.
  - **The aura:** with no aside of its own, a hero shows the site's mark in three slowly turning rings with accent
    dots and a breathing glow, beside the words on a computer and faintly in the top corner on a phone, where it takes
    no space.
  - **The orbit:** `hero({ …, orbit: { center: { title, sub, href }, inner: [{ icon, label, href }], outer: [...] } })`.
    The site's main places turn on the inner ring with their names, and more on the outer ring, every icon upright and
    linked. On a phone it sits small above the words. Network's front door has the same orbit.
  - **Opting out and overriding:** `visual: false` keeps a hero plain, and an `aside` of the page's own still wins.
  - **Motion:** transforms only, still under either reduced-motion setting.

## 4.25.0 — 2026-10-28

The brand bar, from the owner's phone on 2026-10-28.

- **A new mark: the open loop** (`ov-mark.js`, `app-icon.js`): one stroke, an O opened at the top by the V, with the
  site's dot in the opening. It replaces the ring, comet, white V and orbiting dot.
  - **Colour:** from the accent towards violet.
  - **Motion:** it draws itself in, and a short light runs along it.
  - **Light themes:** the dot follows the text colour, so it shows there.
  - **Icons and cards:** app icons (`icons/`), favicons and share cards (`social/`) are redrawn with it.
  - The owner: "the open vibe logo isn't even that great… new ideas… more modern… better effects".
- **The OpenVibe menu's orb, beside the brand** (`navbar.js`). The magnifier on the right is gone (the owner: "the
  little diamond thing… cool animations… next to the logo").
  - **The orb:** nine dots as a diamond. Hovered, a ripple runs from the centre; it waves while the menu loads, and it is
    an × while the menu is open (a second click closes it). Nothing moves at rest.
  - **The menu** (`search.js`) drops from the orb under the bar: a panel on a computer, a sheet as tall as its contents
    on a phone. "On this site" chips carry the place's own icon.
  - **Events:** `search.js` sends `openvibe-menu` events and calls `onClose`.
- **Both balances on phones.** The folded pill shows OpenCoins and Vibes at every width (it showed the first one up
  to 440 px). The bar's padding, gaps, picture and buttons tighten under 400 px; under 350 px the site's word gives
  way to the mark.
- **Vibes beside OpenCoins in the account menu.**
  - **One request:** the navbar asks OpenVibe.Network once, `GET /api/coins/me?with=vibes`, Network#373. Every site's
    connect-src allows the Network and none allowed Billing, so Vibes never showed. An older Network falls back to
    Billing.
  - **Labels:** each balance names itself.
- **The account menu on a phone** is a sheet the width of the screen.
  - **Tiles:** they never leave one alone on a row (five share a row, six make two of three).
  - **Anonymous:** the pill reads whole.
  - **Footer:** its buttons share the row evenly.
- **On a phone the bar steps away** while you read down and comes back on the first scroll up. It never does with a
  menu open or focus inside it. `autoHide: false` keeps it.
- **Messages beside the bell** (`messages: { onOpen, href }`, `setMessages(n)` for the unread count), for a site
  that would otherwise float a bubble over the page (the owner: "this DMs button is like buggy as hell on mobile").
- **Routers get paths.** `onNavigate` (the bar, the account menu and the app bar) receives `/@name?tab=x`, never a
  full address. On Live, "My channel" (`https://openvibe.live/@name`) had opened `/https://openvibe.live/@name`.

## 4.24.4 — 2026-10-28

- **`agent-session.js`: no made-up run time.** A finished run mounted without `startedAt` (a replay) showed "0 s"; it
  now shows no time until its done line says how long it took. A live run, or one given `startedAt`, still counts
  from then. `summary().durationMs` is 0 when the time is not known.

## 4.24.3 — 2026-10-28

- **`agent-session.js`: web steps read as lookups.** A tool whose name speaks of the web (`web_search`, `web_fetch`) is
  a web step before a file search, and a query given as its description reads "Looked up …". An address reads
  "Opened …". OpenVibe.Actor's web searches showed as "Listed …".

## 4.24.2 — 2026-10-28

- **`agent-session.js` takes `link(url)`**, which decides which https addresses in an agent's text become links; the
  rest stay text. OpenVibe.Actor's agents browse untrusted pages, so its task page links only the person's own desk, as
  its server-drawn timeline always did. Without `link`, every https address links, as before.

## 4.24.1 — 2026-10-28

- **`agent-session.js` reads OpenVibe.Actor's task events** (`actor.task-event@1`), so Actor's agents show in the same
  view as every coding agent. The owner asked that it "handle that between all agents… in a smart way".
  - **Mapping:** plan is a quiet line, text what it said (an error a note), a hand-off a divider, a check a note (a passed
    check is good news, not a problem), and `tool_call`/`tool_result` are steps. A result without an id finds its step
    by tool.
  - **Agents:** any line may name its `agent`, and the head follows who is working. A hand-off without a `from` is the
    agent that was working.
  - **States:** `{ t: 'state' }` lines (Actor's task states) move the head.
  - **No duplicates:** an agent's start after its hand-off no longer lists it twice.

## 4.24.0 — 2026-10-28

- **`agent-session.js`: a coding agent's session, as people read it.** Asked for by the owner, 2026-10-28, showing
  the Claude app's session view whose running command said "Output unavailable": "OpenVibe.Codes should… actually show
  the output from the agent… more user friendly… handle that between all agents… in a smart way".
  - **Steps:** steps in a row fold into one group ("1 command · 1 edit · 2 reads", with +/− and a running, done or
    failed mark).
  - **Inside a step:** its command and diff, and its output, live while it runs; a failed step opens by itself.
  - **Helpers:** a helper's steps nest under it.
  - **Hand-offs:** they read "Claude Code → Codex", with the reason.
  - **The head** stays in view: state, agents, time, steps, files changed, cost, and the plan (TodoWrite) as one line
    that opens.
  - **Filters:** Everything, What it said, Steps, Problems; Follow keeps the newest step in view.
  - **Formats:** it reads Claude Code's stream-json (every OpenVibe.Codes harness adapter's shape) and Codes' job lines
    (protocol 1.1).
  - **Safety:** the agent's text is never markup, and only https addresses link.
  - **For servers:** `normalize`, `kindOf` and `diffLines` work in Node.
  - Docs: `docs/agent-session.md`. Tests: `agent-session` (node) and `agent-session-chrome`.

## 4.23.0 — 2026-10-28

The owner, 2026-10-28, on the phone:
- the launcher and the magnifier "kind of accomplish the same exact thing… combine… a better hierarchy… use this user's
  history… autocomplete… maybe use tabs";
- the account menu: "a lot of this is just not even really needed… a plus button… better use of icons… compactness…
  data-driven";
- the balances "look a little weird… polish… use the space".

- **One OpenVibe menu** (`search.js`). The magnifier, `/` or Ctrl+K opens search, every site and every tool together.
  - **Before typing**, three tabs:
    - *For you*: jump back in from the person's Network history, this site's pages, recent searches, and their sites
      (or the most used across OpenVibe);
    - *Sites*: every site in the Frame's groups;
    - *Tools*: your tools, the most used tools from the Frame's analytics, and the families.
  - **Typing** makes one ranked list: go to (name matches; tools you used first), this site's results and pages, your
    history, the rest of OpenVibe (the sites you use first), tools for it, your searches, then search everywhere and
    Ask Vibe.
  - **Completion:** the box completes from your searches, history, the sites and this site's pages; Tab or → takes it.
  - Results carry their site's icon.
  - `OpenVibeNavbar.openMenu(tab)` opens it on a tab.
  - The drawer's "All sites" opens the Sites tab.
- **The launcher button is gone.** Its panel, catalog and site lists moved into `search.js`, which loads on first use,
  so `navbar.js` is 15 KB smaller (161 → 146 KB raw, 37.4 → 33.8 KB brotli). Guests' display controls moved to the
  foot of the phone drawer.
- **A compact account menu.**
  - **Header:** + (add an account), the gear and sign out sit beside the name; other accounts are small pills.
  - **Your places:** a grid of icons, four across, the site's own first, eight shown and the rest under More. The order
    follows what this person opens: counted on this device only, a place opened twice moves up.
  - **Foot:** one row for light, dark, auto, text size, motion and themes.
  - **Gone from it:** Notifications (the bell has them; the row stays where there is no bell), "Recently used" (the
    menu's Jump back in) and the long list.
  - Items take `short` for the grid's label.
- **Calm balances.**
  - **The pill:** one pill on the bar's own surface; each balance a coloured icon and a plain number, a hairline between
    them.
  - **On phones:** the pill shows the first balance up to 440 px, so the site's name always reads whole, with Apple's
    wider system font too; a tap lists both. Wider screens show both. The pill is compact at every phone width.
  - **Computers:** one chip per balance in the same style.
  - **Room:** on phones the bar drops the empty spacer's gap.
- **The showcase hero on a phone** (the owner on openvibe.quest: "why is there empty space at the top… why is
  openvibe.quest twice… better visuals… icon usage… reduce wasted space… the same for all the other sites"). Every site
  built on `showcase` gets:
  - **No repeated name:** an eyebrow that is only the site's name ("OpenVibe.Quest") is left out, since the navbar shows
    it; any other eyebrow stays, and `{ icon, text }` gives it an icon.
  - **Less space and text:** the hero starts 14 px under the bar (was 36), and the title and lede tighten.
  - **Buttons:** they sit side by side.
  - **Numbers:** they go three across, and `stats` items take an `icon`.
- The mark's seasonal leaves fall under the menus, not over them.
- `docs/kit.md`: the OpenVibe menu, the account menu, balances.
- Tests: `navbar-launcher` covers the Sites tab and "All sites"; `search-loading-chrome` covers the tabs and the
  completion; `navbar-touch-hover` checks the menu's hover-only rows; `navbar-phone-fit-chrome` checks the bar
  from 320 to 430 px; `navbar-brand` covers the new header and grid.

## 4.22.2 — 2026-10-28

- **In-page links scroll instead of reloading** (`boost.js`). A link to a part of the page (`href="#the-quests"`) made
  Chrome fire `popstate` with no state. boost answered every state-less `popstate` with `location.reload()`, so the page
  loaded again and landed at the top (openvibe.quest's "See the quests", on every boosted site).
  - boost now knows which page it is showing. A `popstate` on that same page (a part link, or Back and Forward between
    parts) is left to the browser: the part scrolls into view, and Back returns to where the person was.
  - `test/boost-chrome.test.js` covers both.

## 4.22.1 — 2026-10-28

- **Search suggestions reach every site.** `search.js` asked `search.openvibe.network` from the page, and the
  `connect-src` of 33 sites refused it (Live among them): the magnifier opened but suggested nothing. Suggestions now
  come through OpenVibe.Network's `GET /api/frame/suggest`. That route asks Search, keeps answers 30 s and keeps
  Search's limit per person; every site already allows `openvibe.network` for the navbar.
  `OpenVibeSearch.suggest(q, { url })` takes either address.
- **The navbar fits a phone, signed in.** On openvibe.games the site's name was drawn under the launcher and the
  magnifier: the right-hand group (magnifier, balances, bell, picture, menu) left the brand about 19 px, and the name
  never clipped. The changes:
  - **The name:** it gives way with an ellipsis, and only the site's word shows up to 480 px (was 420).
  - **Balances:** up to 440 px the folded balances show the first one; a tap lists all.
  - **The launcher:** a signed-in phone (and every phone under 375 px) keeps it in the menu's "All sites".
  - **Spacing:** the right-hand buttons sit 2 px apart under 400 px.

  New `test/navbar-phone-fit-chrome.test.js` covers 320–430 px, signed in and out.

## 4.22.0 — 2026-10-28

- **A tidier navbar** (the owner, 2026-10-28: "reanalyze all the nav bars across all the sites… redundant feeling
  options… awkward… not front-facing of what the important stuff is"). A sweep of the 38 sites' bars found three
  problems:
  - **Other sites repeated** after every site's own links ("Live · Tools · Space · Community"), twice on Codes and
    News.
    - The bar no longer repeats them: the launcher lists every site, and the phone drawer keeps "Across OpenVibe".
    - `networkLinks: <n>` (or `true` for four) brings the strip back for a site that wants it.
  - **Long bars**, up to twelve entries. Links marked `more: true` now fold into one "More" dropdown, and the drawer
    lists them like the others. Clicking More opens it; it never follows a link.
  - **"What shipped" and "Search" as main places.** docs/kit.md ("The navbar's links") sets the rules: four or five
    places with icons, `more` for the rest, Search as the magnifier, Updates in the footer, the account menu for the
    person's things.
- **Who OpenVibe is, in every site's structured data** (`seo.jsonLd.organization()`, the publisher every page names).
  - The Organization gains a description, `alternateName` (OpenVibe Network, OpenVibers), a
    `disambiguatingDescription` ("…not the Openvibe mobile social-media aggregator app"), and fifteen sites in `sameAs`.
  - Why: Google's AI Overview for "whois openvibe" described an unrelated "Openvibe" app (the owner, 2026-10-28).
  - Network's home page and llms.txt say the same (Network #368).
- `test/navbar-more.test.js`; `test/seo-org.test.js`; `perf-budget-chrome` gives a loaded runner three tries to report
  the late block's shift (it failed macOS CI twice on 2026-10-28).

## 4.21.0 — 2026-10-28

- **Search on every site** (`search.js`; navbar `search`, `openSearch()`).
  - The owner, 2026-10-28: "a magnifying glass button that's more compact, shared across the sites… intelligent… lazy
    loading and autocomplete… reused in the SDK and API".
  - Every navbar has a magnifier; `/` and Ctrl+K open it too. `search.js` loads on first use.
  - It shows this site's pages and your recent searches, then OpenVibe.Search's suggestions as you type (the older
    request cancelled). This site's results come first, then the rest of OpenVibe.
  - It always offers the site's own search page, "Search all of OpenVibe" and "Ask Vibe".
  - Keyboard and screen-reader friendly; full screen on phones. `search: false` hides it.
  - `OpenVibeSearch.suggest()` serves a page's own box.
  - The navbar's budget is 37.5 KB (37.05 with the button).
- **Loading, redesigned and shared** (`loading.js`, `OpenVibeLoading`).
  - The owner, 2026-10-28, of Live's stream loader: "old and outdated… consider the latest frames of the stream…
    minimalistic… reusable and shared across the sites".
  - An edge-to-edge overlay with no card: the thing's own picture blurred and drifting, a thin ring, one status line,
    and a two-pixel progress line.
  - `update` / `slow` (a hint and actions) / `fail` (Retry) / `done` (fades out); skeleton rows for lists.
- `shipped.js` labels OpenRestream "Restream" among the short names (the launcher did the same in Network #367).
- `test/search-loading-chrome.test.js`:
  - Search: lazy, scoped, cancelled, text-only titles, script links dropped, keyboard.
  - Loading: steps, slow, fail, done, skeleton.
  - No sideways scroll at 390 px.

## 4.20.1 — 2026-10-28

- **The kit's behaviour is its own small file, `kit-web.js`** (about 7 KB, 2 KB compressed): copy buttons, menus that
  close, Enter to send, confirms, sliders and sheets.
  - A server-rendered site loads only `kit-web.js`. Its markup comes from `kit.js`'s builders on the server.
  - A page that draws itself loads `kit.js` too; `OpenVibeKit.enhance()` now calls `OpenVibeKitWeb.enhance()`.
  - Loading all of `kit.js` (33 KB) on every page pushed a site's home over its JavaScript budget (Coupons: 328 KB raw
    against 292).

## 4.20.0 — 2026-10-28

- **The OpenVibe Kit** (`kit.js`, `kit.css`; `require('openvibe-shared/kit')`, `window.OpenVibeKit`). One set of app
  pieces for every site and anyone's, phone first.
  - The owner, 2026-10-28: "the pages are so dang long… use tabs or collapsible areas… on a phone it should act more
    like an app… one app ecosystem across all our systems… part of the SDK and the API… explained in Markdown and on
    the wiki… reusable for other people's projects."
  - **The pieces:** a sticky head (back, title, one line, icon actions) with link tabs (`tabs`, `tabOf`), rows and
    lists, sections, folds and a "more" menu; switch, range, select, segmented and chip rows with a save bar; a find
    row and a dock (the composer pinned at the bottom); a numbers strip; empty states, notices, copyable snippets,
    bottom sheets; buttons, icon buttons, one-button forms with a confirm; 78 line icons; `when()` and `mark()`.
  - **How it runs:** the same builders on the server and in the page, every text escaped and unsafe URLs dropped.
    `enhance()` adds copy buttons, menus that close, Enter to send, confirms, sliders that speak and sheets, and runs
    by itself in the page.
  - **The look:** `kit.css` on the site's theme tokens (`--ovk-*` from `--bg-*`, `--text-*`, `--accent-strong`…).
    44 px touch targets, a sticky head and dock, layouts for phones (< 600 px), tablets and computers (≥ 1024 px,
    `.ovk-split`).
  - **Docs and gallery:** docs/kit.md (the why, with the 38-site phone sweep; the shape of a page; every builder;
    adoption) and `scripts/kit-gallery.js` (one page with every piece, screenshots at 390/768/1280 and a sideways-scroll
    check).
- **The phone app bar** (`appbar.js`; navbar `appBar`, `setAppBar()`).
  - A site's main places as a bottom tab bar under 760 px: `appBar: true` takes the links that carry an icon (four and
    More, which opens the drawer), or a list of five.
  - The open page is marked, a link's dot shows on its tab, and clicks go through `onClick` and `onNavigate`.
  - It steps aside for the keyboard and open panels, and keeps the page's last line above it (`html.ov-has-appbar`,
    `--ovnav-appbar-h`).
  - `navbar.js` loads it only for a site that sets `appBar`, so the navbar's own size is unchanged.

## 4.19.0 — 2026-10-28

- **Footer `variant: 'auto'`** (`footer.js`). The owner, 2026-10-28: "the full-size footer on the chat pages might be a
  little much … if we want to have that app-like design … make it a little more sleeker across sites".
  - It shows the full footer on the site's front page (and the paths in `fullOn`, default `['/']`), and the one quiet
    line (`compact`, with "More from OpenVibe" to open the rest) everywhere else.
  - On the server, `ssr({ variant: 'auto', path })` picks from the request's path; with no path it is compact.
  - In the browser it reads `location.pathname`, follows back and forward on a single-page site, and
    `setVariant('auto')` is a variant like the others.
  - A claim still wins over it (Live's channel while live).
  - `autoFor(path, fullOn)` is exported.

## 4.18.0 — 2026-10-28

- **The account menu, reviewed** (`navbar.js`). The owner, 2026-10-28: "duplicated things … could just be organized
  better … so many icons sizes that aren't consistent … needs a full review". The changes:
  - **Nothing twice.**
    - The balances are left out of the menu's header when the bar shows them (a site's `coins`/`vibes` chips, or
      `wallet: true`).
    - "My Profile" is gone: the name and picture are the profile link.
    - "Seasonal themes" is gone: its switch is on openvibe.network/themes, beside the themes.
    - "Linked Services" is gone (it is in the account page), and so is "Across OpenVibe": the other sites are the
      launcher's and the drawer's.
  - **One order on every site.**
    - First the site's own rows (`before`, its `sections`, then `after`, which now sits with them).
    - Then **You**: Account & settings, Notifications, My channel, History, Ask Vibe, Work together, and Admin for an
      admin or the owner.
    - Then **Display**: Light / Dark / Auto, text size, animations, and Themes ›.
    - Then Sign out.
  - **One icon box.** Every row's glyph keeps its height and sits centred in the same 20 px box, whatever its width
    (an id card is wider than a bell).
  - Rows are 13 px text in 32 px rows, and a link row no longer overflows the menu by its padding.

- **The browser harness on macOS** (`browser-harness.js`): Chrome starts with `--disable-backgrounding-occluded-windows`,
  `--disable-renderer-backgrounding` and `--disable-background-timer-throttling`, so every page draws and runs its timers
  as if in front. On macOS a new page counted as an occluded window and painted nothing (the Core Web Vitals test saw no
  paint and no shift). CI now runs the suite on Windows and macOS too.
- **`perf-budget` vitals wait for the first paint before the click** (`measure({ browser })`): Chrome stops recording
  LCP at the first input, and a slower machine clicked before anything was painted (no LCP at all on the macOS runner).

## 4.17.0 — 2026-10-27

- **`wallet: true`: OpenCoins and Vibes in the bar on any site** (`navbar.js`; owner, 2026-10-27: "make that as a
  feature in the shared nav bar … maybe we'll put it on games too").
  - The navbar asks the Network (`/api/coins/me`) and Billing (`/api/me/vibes`) itself, at most once a minute, and again
    when the tab comes back.
  - The last balances are kept per person (`localStorage`), so the next page paints the chips at once: no empty chips,
    no jump.
  - Vibes hides while Billing answers 409 (not the ledger yet). A site's own chips with the ids `coins`/`vibes` (Live)
    win; signed out, nothing is asked.
  - On a phone they fold into one chip (4.16.0).

## 4.16.0 — 2026-10-27

- **Balance chips fold into one on a phone** (`navbar.js`; owner, 2026-10-27: "the currencies are taking up all the
  space … compact the two currencies into a single one when on smaller mobile resolutions … so you can still swap
  between sites on mobile").
  - With two or more chips at 560 px and narrower, the bar shows one chip with each icon and a short value ("161k · 400").
  - A tap lists each in full; a row does what its chip does (a chip may now carry a `label`).
  - `setChip` keeps both up to date. A site can show the site switcher next to its logo again (Live hid it to make room).
- **"Across OpenVibe" in the menu is a section of its own:**
  - a tinted block with a header (the OV mark) and **All sites** (it opens the launcher);
  - the other sites two to a row, each with its mark (up to eight).
- **Icons no longer pop in.**
  - `ov-icons.js` loads once when the page settles (`requestIdleCallback`), and at once on intent (a pointer over the
    launcher, a touch, focus), instead of the first time the launcher, menu or drawer opened.
  - Every icon slot there has its size and a faint ring until it is drawn, so nothing moves when the glyphs arrive.
- **An open tab stays on the latest version** (`release-watch.js`; owner, 2026-10-27: "make sure people are on the
  latest version … if the client needs to update or something, it should just be self-aware or intelligently do that").
  - A release that only prompted ("Update ready · Reload") used to wait for the button forever. Now it applies itself
    while nobody is looking: after the tab has been hidden for 30 s, unless something is protected (typing, a dirty form,
    playing media, a live camera or mic, `[data-ov-protected]`, `OVProtected()`).
  - Any reload comes back at the same scroll position, for the same address, for ten minutes.
  - A site can opt out with `OVReleaseConfig.autoApply = false`. Style and content releases still apply in place, and
    required ones reload when safe, as before.

## 4.15.2 — 2026-10-27

- **Showcase sections no longer fade in** (`showcase.js`, `showcase.css`). The scroll reveal animated opacity from
  nothing, so a section below the fold was half transparent when it was measured. Text in it then failed contrast checks:
  the post-release browser check (axe) reported color contrast on ten product homes (help, host, inventory, media, rent,
  run, services, space, vip, zone). VIP's muted text measured #4d5464, its colour at about half opacity. The sections
  still rise 18 px into place for people who want motion. `test/showcase.test.js` fails if the reveal animates opacity again.

## 4.15.1 — 2026-10-27

- **The compact footer is one line again** (`footer.js`). 4.15.0 put "More from OpenVibe" on a row of its own under the
  compact line, so every page with the compact footer lost about 25 px: 78 px instead of 53 px at 1400 px wide. That
  includes players, a live channel and the Games editor, whose canvas shrank and moved its snap control under a click
  its tests make, so Games#157 failed. Closed, "More from OpenVibe" now ends the line as a link like the others (the
  compact footer is a wrapping row); opened, it takes a full-width row below with its pill, as before. Measured in
  Chrome: 46 px closed at 1400 px, as in 4.14.0; 135 px on a 390 px phone (152 in 4.15.0); opened, unchanged.

## 4.15.0 — 2026-10-27

- **The footer adapts to what the page is doing, opens up from compact, and shows the network right now** (`footer.js`;
  the owner, 2026-10-27: "you can use compact footer on the live streamer channel when they are live only … but it
  should be full mode when not live. make sure thats something the shared footer system can handle … in a modular way
  … more alive and has some stats … allow user to expand to full even on pages that use compact … ensure maximized SEO").
  - `OpenVibeFooter.claim('compact' | 'full', key)` → `release()`: a part of the page asks for a variant while it needs
    it (Live's channel while its stream plays). Compact wins over full, any claim over the page's own; releasing brings
    back what is left. `setVariant` stays the page's own (an SPA route's); `OpenVibeFooter.variant` is what shows.
  - The compact footer carries the whole footer in a "More from OpenVibe" disclosure (a `<details>`): opening it needs
    no script, and its links are in the page, server-rendered too, so a player or channel page links the network the
    way a home page does (crawlers follow them; nothing is hidden by CSS).
  - The pulse line, at the top of the full footer (and the opened compact one): streams live now (a pulsing dot),
    people watching, the open sites and last week's page views, from OpenVibe.Network's `/api/frame/pulse`
    (OpenVibe.Network#345). It is read when the footer scrolls into view and every minute while it stays there;
    `pulse: false` leaves it out. Nobody live: "Nobody live right now · go live".
  - The network column lists eight sites, not six.
  `test/footer-alive.test.js`.

## 4.14.0 — 2026-10-26

- **The navbar's brand is big enough for a finger** (`navbar.js`). On touch screens the wordmark's links were 22 px tall
  and the mark 30 px. They now reach about 44 px (the navbar's height, and a clear ring around the mark) under
  `(pointer: coarse)`, without moving anything.
- **Volume on phones, and a video with no sound says so** (`player.js`, `player.css`; the owner, 2026-10-26, on
  openvibe.video: "Volume seems broken … on mobile can't hear this and also can't easily adjust volume"). Touch screens
  only had the mute button. Now the volume slider shows there too, finger-sized (84 px, an 18 px thumb), wherever the
  page can set the volume (`.can-volume`: Android). An iPhone leaves volume to its own buttons, so it keeps the mute
  button alone. A video with no sound track (that VOD, 5986, was recorded without its microphone) showed a working
  speaker that did nothing. Now, once the browser can tell, it shows "No sound in this video" once, with a dimmed speaker
  that says it again when tapped, no slider and no "Tap for sound". Firefox reports this directly (`mozHasAudio`).
  Chrome and Safari count it: no audio decoded after 2 s of decoded video, which they count muted or not. A new source
  asks again. `test/player.test.js`.

## 4.13.0 — 2026-10-26

- **Switching accounts works on every site** (`navbar.js`; the owner, 2026-10-26: "the thing that lets you switch …
  between different accounts doesn't work"). On a product site the account menu's other accounts dispatched an event only
  openvibe.network's account switcher listens to, so a click did nothing, and "Add another account" went to the Network
  and back to the page without signing the site in. Each other account is now a link through OpenVibe.Network's chooser
  (`/login?switch_to=<id>&login_hint=<username>`) that comes back through the site's own sign-in (its `loginUrl`, made
  absolute), so the site ends up signed in as the chosen account whatever its session; "Add another account"
  (`add_account=1`) does the same for a new one. The list is the accounts this browser used on the site (the account
  switcher's plus the ones the navbar saw signed in, `openvibe_seen_accounts`: names and pictures, at most ten, never a
  token). openvibe.network's own pages still switch in place; "Switch to Anonymous" shows only there. Account names in
  the menu are escaped as text. Needs OpenVibe.Network's chooser of the same night (switch_to, add_account).
  `test/navbar-switch-account.test.js`.
- **A person's stuff on any site** (`profile-panel.js`, `profile-panel.css`, new). One tag (`data-ov-profile="name"`)
  draws someone's worn items, their counts of items, badges, achievements and games, their latest unlock per game and
  links to their profile and inventory, from OpenVibe.Network's public profile (which gathers Inventory, Quest and
  Play since Network#333 and Play#38). Steam-style, so Games, Quest and any site can show it (the owner, 2026-10-25).
  `data-ov-profile="me"` is whoever is signed in on that site (its own `/auth/me`), so a page cached for everyone can
  show "your stuff" (a `hidden` element appears once drawn). `test/profile-panel.test.js`.
- **One lit row in the menus on phones** (`navbar.js`). A tap left `:hover` on the row it touched, so the "all sites"
  launcher showed two highlighted rows: the site you are on and the last one your finger crossed (the owner, 2026-10-25,
  on openre.stream). The launcher's and the phone drawer's hover backgrounds now apply only under `@media (hover:
  hover)`; the site you are on and keyboard focus stay lit everywhere. On phones a launcher row's description is one line
  (OpenVibe.Network sends short menu labels with the regrouped sites), so the list is shorter and easier to scan.
  `test/navbar-touch-hover.test.js`.
- **The phone menu always opens on screen** (`navbar.js`). The burger's drawer is anchored to the bar (`position:
  absolute`, right under it) instead of the viewport. On a page wider than the phone (openvibe.chat/messages with a long
  pasted link was 939 px on a 412 px phone), the fixed drawer opened off-screen and the menu looked missing (the owner,
  2026-10-25). `test/navbar-drawer-overflow.test.js`. The navbar's brotli budget is 33.5 KB (was 33; 33.0 KB now).
- **Ask Vibe from every site** (`navbar.js`). The account menu's "Ask Actor" is now **Ask Vibe**: it opens a new chat
  with Vibe, OpenVibe's assistant, at `openvibe.chat/vibe`, with the text selected on the page and the page's address
  filled in (never sent by itself; OpenVibe.Chat#165). `_ask.askVibeHref` replaces `askActorHref`;
  `test/navbar-ask-vibe.test.js` replaces `navbar-ask-actor.test.js`. Beside it, **Work together** starts a workspace
  room on OpenVibe.Chat (`openvibe.chat/work`): a team and Vibe with a work queue, alerts from other systems and a
  shared screen (OpenVibe.Chat#163–#168).
- **Richer home pages for every site** (`showcase.js`, `showcase.css`, `docs/home-pages.md`). The owner, 2026-10-25:
  "more rich content and different types… shared code so you can make nice home pages across all our different sites…
  and other people can reuse too". About 30 sites build their homes from showcase.
  - New sections:
    - `stats`: a strip of real numbers.
    - `cards`: rich content in a grid or a swipeable rail, with lazy images that hold their ratio, a LIVE badge and
      "See all".
    - `spotlight`: features shown with a picture or a short muted loop, alternating sides.
    - `faq`: an accordion that works without JavaScript, plus `faqJsonLd()`.
    - `network`: "Part of OpenVibe", up to four related products from the curated `RELATED` map, with ring icons
      and the `ov_from` tag, so the network links together in a readable, crawlable way.
  - `jsonLd()` writes structured data that cannot close its script early.
  - The hero gets a soft glow from the theme's accent. Sections rise in on scroll (CSS scroll-driven animations, only
    without reduced motion).
  - The same safe-link and escaping rules as the other sections.
- **One OpenVibe for search engines and AI crawlers** (`seo.js`):
  - `headTags` adds OpenVibe's Organization node beside a WebSite that names it as publisher but did not include it.
    Chat, Video, OpenRestream, Actor and Work had the reference without the node.
  - `robotsTxt` says yes to search, AI answers and AI training in so many words (`Content-Signal: search=yes,
    ai-input=yes, ai-train=yes`) unless a site passes `allowAI: false`. The owner, 2026-10-25: "fully AI allowed and
    indexable".

- **The player sounds, loads and looks better** (`player.js`, `player.css`). The owner, 2026-10-25: "the volume up and
  down button on mobile will actually unmute… those little color sample type s*** so that it loads that then the
  thumbnail… then the actual video… that background effect… the mute button looks a little weird".
  - **Sound:**
    - A video playing muted (autoplay) shows "Tap for sound", and the first tap on it unmutes.
    - The media volume keys unmute and set the level wherever a browser passes them to the page (`AudioVolumeUp`
      and the rest; phones keep their hardware buttons to themselves).
    - The viewer's own mute is remembered; a page's autoplay mute is not.
    - The Media Session API gives lock screens and headsets play, pause and seek.
  - **Loading in layers:**
    - `data-ov-color` paints the average colour at once, and `data-ov-thumb` (a tiny inline image) shows blurred.
    - The poster sharpens over them, then the first frame fades in.
    - Without `data-ov-color`, the poster's average colour is used when the browser allows it.
  - **Ambient glow:** `data-ov-ambient` adds a glow of the picture around the player, as in YouTube's ambient mode: a
    32×18 sample every 0.7 s while the player plays and is on screen, blurred and crossfaded. It is off for reduced
    motion and data saver, and softer in light themes.
  - **Controls:**
    - One rounded, filled icon set (Material Icons Round). The mute icon was a crude cross.
    - Buttons press in; the big play button has a soft ring.
    - A short sign shows a seek (±10 s, on its side) or a volume level.
    - Touch screens drop the volume slider and keep the mute button; phones get 40 px targets.

## 4.12.0 — 2026-10-25

- **Avatars show the picture the account has now.** The owner, 2026-10-25: their picture showed on Live but the
  navbar on openvibe.network drew their initial. A user record can be older than its picture (a site's session, or a
  remembered account, from before the picture was set).
  - The navbar (`navbar.js`) and the footer's account row (`footer.js`) ask the Network's `/avatar/<username>` when a
    record has no openvibe.media picture. That route redirects to the current picture, or answers an initial.
  - A picture that fails to load asks `/avatar/<username>` once (`data-retry-src`) before falling back to the initial.
    That also covers an image that failed before the handler was attached.
  - On openvibe.network itself the request is same-origin.
- **The launcher fits a phone.** Its panel was `min(760px, 100vw - 24px)` wide plus its padding and border, so on a page
  without a global `box-sizing: border-box` it ran 10 px past the screen and the page scrolled sideways. It is now
  `border-box`.

- **Every theme in light and dark.** The owner, 2026-10-25: "each theme should have a light counterpart instead of … a
  mixed bag", with an easy light and dark switch in the account menu.
  - **Pairs:** `builtin-themes.js` `PAIRS` gives every theme its other half, and each theme carries `pair`. That makes 25
    pairs and 50 themes. Thirteen are new light ones: Dawn, Tokyo Day, Alucard, Monokai Light, Shallows, Ash, Vapor
    Day, Greenbar, Nord Light, Bright, High Contrast Light, Hayride and Snowfall. Cloud is now named "Vibe Light", the
    default's light half.
  - **October** (the owner's picks): Midnight Pumpkin (`halloween`), pumpkin orange on OpenVibe's navy, replaces the
    violet Pumpkin Night, and **Hayride** is its light half. December gets **Snowfall** beside Frost. `SEASONS` entries
    carry `light`. A season stands in for the default theme in either mode (Vibe or Vibe Light).
  - **Light / Dark / Auto** (`theme-loader.js`, `OpenVibeThemeLoader.scheme.get()/set()`; the account menu and the
    launcher's Display box):
    - Light or Dark saves the picked theme's other half (the default's half when a community theme has none). The
      season stays as it was.
    - Auto (the display preference `scheme: auto`, synced like the others) paints the half matching the device, and
      follows it when it changes.
    - `pairOf(id)` and `modeOf(id)` are exported too.
  - **Smaller loader:** the theme map is now rows of values against one list of token names, expanded at load into the
    same full sets. `theme-loader.js` went from 59.5 KB to 50.7 KB with thirteen more themes.

- **The OpenVibe mark wears the season; the pumpkin button is gone.** The owner, 2026-10-25: the badge beside the brand
  "takes up a lot of space … especially on mobile"; integrate it into the logo instead.
  - **The mark's look** (`ov-mark.js`): `<html data-ov-season-mark="halloween|winter">` (set by `theme-loader.js` for
    anyone who has not turned seasonal themes off, whatever their theme) dresses every mark.
    - October: a pumpkin's stem, leaf and faint ribs, with the V as its grin.
    - December: a cap of snow on the ring.
  - **Moments:**
    - The leaf unfurls when the mark plays its intro.
    - Every 4 to 8 minutes a mark on screen flickers like a candle for a second.
    - On the first visit of the day, a few leaves (snowflakes in December) drift down from the first mark seen.
    - None of this runs under either reduced-motion setting.
  - **Navbar:** no `.ovnav-season` badge. The switch stays in the account menu ("Seasonal themes") and the display box.
- **Theme changes follow you between sites without a jolt** (`theme-loader.js`). The owner, 2026-10-25: a seasonal
  toggle on Live, then Themes in the menu, showed openvibe.network in the old theme until a refresh.
  - **Saves outlive the page:** both PUTs (`/api/themes/me`, `/api/themes/me/display`) are `keepalive`, so a choice made
    just before following a link still lands.
  - **The account is asked again:**
    - when the page comes back into view (at most every 10 s);
    - once more 2.5 s after arriving from another site, since that site's save may land after this page first asked.
  - **Corrections fade:** a theme that changes under someone (the account's answer, another tab) crossfades for 0.4 s
    instead of jumping. An answer that changes nothing repaints nothing. Calm motion never fades.
- **Your name in the account menu opens your profile.** The avatar and name at the top of the menu link to
  `openvibe.network/@username` (an anonymous visitor's to `/my`). They were plain text, and pressing them did nothing.

## 4.11.0 — 2026-10-25

- **Seasonal themes.** The owner, 2026-10-24: a Halloween theme and style on every site, as the default during
  October, part of a seasonal system that turns on by date, with an opt-out for anyone who wants their normal
  default.
  - **Two seasonal themes** (`builtin-themes.js`):
    - Pumpkin Night (`halloween`): pumpkin orange on a violet night, October 1–31;
    - Frost (`frost`): frosted teal on a midnight sky, December 1–31.
  - **How they turn on.** A theme with `season: { id, name, from, to }` (MM-DD, both days included, the visitor's own
    calendar) is also listed in `SEASONS`, and `seasonOn(date)` finds the season for a date. A season may run over New
    Year.
  - **What the loader paints** (`theme-loader.js`, Seasons):
    - Anyone on the default theme sees the season's theme in its place while it runs. A theme someone picked, or a
      customised default, stays theirs.
    - `<html>` carries `data-ov-season="<id>"` and `data-theme` names the theme on screen. The saved choice
      (`getCurrent()`) stays the person's.
    - `window` gets `ov:season` with `{ id, name, theme }` or `null`.
    - API: `OpenVibeThemeLoader.seasons.{ SEASONS, now(), showing() }`.
  - **The opt-out** is a display preference, `seasonal: on|off` (on by default). It repaints at once and in other tabs,
    and is saved to the account with text size and motion (`PUT /api/themes/me/display`). Network stores it once it
    accepts the key; until then it stays in the browser. Picking the default theme during a season turns seasonal
    themes off: "my normal theme".
  - **The navbar** shows the season's emblem beside the brand while a season runs: a pumpkin, or a snowflake in
    December. It is pressed while the season's theme shows and faded when seasonal themes are off, and a click flips
    it. The account menu's Display section and the launcher's display row get a "Seasonal themes" switch.

## 4.10.0 — 2026-10-24

- **items.css draws `name-fx-twofat`, "2fat Bass Drop"**, the one-of-a-kind name effect the owner asked for 2fat on
  2026-10-23: the name thumps on the beat in club lights, with an equalizer before it and a speaker after it. Its
  particles (`px-twofat`) are notes, a CD and a tape in club pink. Like Josh Vegas, the Calm setting
  (`data-ov-motion=reduced`) and the system's reduced motion stop it, so it shows the same on openvibe.chat, Network's
  pages and every site drawing items as on Live (Live#318, OpenVibe.Inventory#71).
- **Shared's own status text uses the 4.9.0 twins**: the showcase's "yes" cells and the island's action buttons
  (`--ovis-t`: `--success-text`/`--danger-text` by state, the accent otherwise; the status colour stays their fill and
  tint). Shared now writes no status colour as text without its twin (H4's last uses; the 23 sites moved on 10-22/23).
- **"Report a problem" in every site's footer** (the Legal column, and the compact line). It opens a ticket on
  openvibe.help with the site and the page filled in (OpenVibe.Help#81):
  `https://openvibe.help/tickets/new?site=<host without www.>&page=<origin + path>`.
  - The page leaves out the query and the fragment, where a sign-in code or a token can ride.
  - A server-rendered footer links the plain form, and a click fills in the page at that moment, so a single-page
    app's current route is the one reported.
- **`analytics/pg` keeps bot rows shorter when asked**: `pruneRawEventsPg(db, { days, botDays })` and the tracker's
  `retention: { days, botDays }` delete `is_bot` rows after `botDays` (default `days`, so nothing changes until a
  service sets it). Bot rows are in the hourly and daily rollups once their day closes, and were half or more of the raw
  table: Live 1.49M of 2.47M rows (it prunes them at 7 days itself since 10-22), Network 1.22M of 2.46M (991 MB).
- **`analytics/pg` `getStats` reads the raw range 9 times instead of 17** (plan J3). On Live's production data
  (1.3M rows), 30 days took 8 to 12 s and now 2.8 s; 7 days 3.1 s → 1.5 s. Related reads share one grouped scan,
  split in JS: status codes and bot types; device, browser, OS and country; the busiest API calls and the slowest paths;
  and requests, the signed-in split and sessions. Each distinct count per group (visitors per page, per hour of the day,
  per day signed in or not) groups by session first instead of sorting for `COUNT(DISTINCT)`. The numbers and response
  shapes are unchanged: the old and new reads matched on production inside one snapshot, and
  `test/analytics-pg.test.js` checks each list on known rows.

## 4.9.0 — 2026-10-23

- **Status colours that read as text** (plan 2026-10-22, track H4). After 4.8.0, axe in the light themes still failed
  where sites write a status colour as text: `--success` on white reads at 2.3:1 (Games' achievement counts, Work's
  badges, Food's recall classes). The status colours themselves stay exactly as each theme set them, because they are
  backgrounds too (a live badge under white text, an amber strip under dark text) and darkening them would spoil those.
  Instead each gets a `-text` twin held to 4.5:1 on every surface: `--success-text`, `--warning-text`,
  `--danger-text`, `--error-text`, `--info-text` and `--live-red-text`. A light theme that sets no status colours
  carries the default theme's (theme-loader merges them first), so its twins are derived from those on its own
  surfaces: snow's text green is `#167e3c`. Write `color: var(--success-text, var(--success))`; the navbar, user card,
  notifications and account switcher do so for their red "danger" words. `STATUS_TOKENS` is exported.
- **`name-fx-vegas` in items.css**: the one-of-a-kind "Josh Vegas" name effect (OpenVibe.Inventory `fx_vegas`, issued by
  Live), drawn as Live draws it: casino-gold text under marquee lights between two slot reels that spin and land on 7,
  and the name pops like a jackpot as they do. The reels are pseudo-elements, so the Calm setting and reduced motion
  stop them explicitly. Its set's particles (`px-vegas`: suits, dice and coins) are casino gold.

## 4.8.0 — 2026-10-22

- **Text reads at 4.5:1 in every light theme** (WCAG AA; plan 2026-10-22, track H4). axe failed 50 to 155 contrast
  checks on every site's home in each of the 12 light themes, through three tokens:
  - `--accent-light` was a pale tint used as link and eyebrow text (snow's `#38bdf8` on white is 2.1:1);
  - `--text-muted` sat at 4.1 to 4.4 on the secondary surfaces;
  - `--accent` sat just under the floor in a few light themes.

  `builtin-themes.js` `deriveTokens` now moves a text token below 4.5:1 on any of the theme's surfaces (`--bg-primary`,
  `-secondary`, `-tertiary`, `-card`, `-input`, `-hover`) toward black, just far enough, measured on the rounded hex.
  - Light themes: `--text-secondary`, `--text-muted`, `--accent` and `--accent-light`.
  - Dark themes: the two text tokens only; their accents are the theme's brand colour and already read, so Vibe's
    `#3b82f6` is unchanged.
  - A token that already reads is left exactly as set.

  `theme-loader.js` is regenerated. `readableText`, `TEXT_TOKENS` and `SURFACES` are exported. Measured on production
  pages with the new values applied: snow on openvibe.network went from 50 failures to 0 apart from site-specific
  colours, Food from 14 to 0.
- **"Recently shipped"** (`shipped.js`): the site chip's label uses `--text-primary` on its accent tint (the tint cost
  `--accent-light` about 0.4 of contrast).

## 4.7.0 — 2026-10-20

- **The video player** (`player.js`, `player.css`, served at `/shared/`): one look for every `<video>` across the
  network (the owner asked to "override the default style of video players across all our sites and vods … for a
  more unified look"). `video[data-ov-player]` gets the network's controls in place of the browser's: a scrubber with
  the buffered range and the time under the pointer, play, volume, time, captions, speed, picture-in-picture and
  fullscreen, hidden while playing and idle, with YouTube's keys and touch gestures. Progressive (no script, native
  controls) and media-element only, so a page's HLS, captions and chapters keep working.

## 4.6.0 — 2026-10-20

- **Page cards.** A site's big pages get a share card of their own, `social/<service>-<page>.jpg`, drawn like the site
  card with the page's name as the headline, the site's brand beside the mark and the page's address in the pill:
  `live-rundown` (The Rundown), `live-content`, `live-moments` (AI Moments) and `live-chat`. They are listed in
  `scripts/build-social-cards.js` (`PAGES`); `social.url('live-rundown')` and `/shared/social/live-rundown.jpg` work
  like a site card. `--only live` renders a site with its page cards.
- **Live's card re-rendered** from Contracts 0.205.4: "Go live from your browser", with no OBS, no downloads and no
  follower minimum underneath (it said "Streams, clips and chat").

## 4.5.0 — 2026-10-20

- **Video sitemaps.** `seo.sitemapXml` takes `videos` on a URL: `{ thumbnail_loc, title, description, content_loc
  and/or player_loc, duration?, view_count?, publication_date?, family_friendly?, uploader?, uploader_info?, live? }`,
  written as Google's `<video:video>` (sitemap-video/1.1). The `xmlns:video` namespace is declared only when a video
  is listed, so every existing sitemap is byte-for-byte the same. An entry missing a thumbnail, title, description or
  a file/player is left out (its page stays). Titles are clipped to 100 characters, descriptions to 2,048, and a
  duration outside 1–28,800 seconds is omitted. First user: openvibe.video, whose recordings and clips had no video
  sitemap.

## 4.4.0 — 2026-10-17

- **Every site in the launcher, in groups.** The menu beside the brand showed the first 12 of the network's sites (the
  owner: "missing tons of sites … needs organization"). It now lists every site the Frame sends (up to 60), under the
  Frame's `groups` in order (Watch & stream, Create & play, Talk & learn, Shop & everyday, Build & automate, Your
  OpenVibe), most used first within each, as compact tiles: four across on a computer, two on a phone, with the
  tagline under each name and the page's own site marked (`aria-current`). The search box stays on top while the menu
  scrolls. A site in a group the navbar does not know goes in the last group; a Frame without groups (older Network)
  shows one "Sites" section. Products on their own domain (Pics, Download, Homes) come with Network's frame.
- The Frame cache key is `ov_frame_v2` (navbar.js and footer.js alike), so a cached 12-site answer is not reused.
- navbar.js: 31.4 KB brotli (budget 32 KB).

## 4.3.0 — 2026-10-17

- **Vibes in the account menu on every site.** Next to the OpenCoins chip, the menu header shows the person's Vibes
  from OpenVibe.Billing (`GET https://billing.openvibe.network/api/me/vibes`, their token, no cookies; the owner: "make
  vibes cross site too like opencoins"). Billing answers 409 until it is the money ledger, and then no chip shows,
  never a shadow number. The chip links to openvibe.live, where Vibes are bought and spent. `billingBase` points
  elsewhere for a test cell. Both balances load in parallel, once per page, and a site with its own `headerChips`
  (Live) still asks nothing.

## 4.2.2 — 2026-10-16

- **IndexNow sends 100 URLs a request.** `ping()` (and the debounced `pingSoon()` flush) splits a list into requests of
  100 URLs, a second apart, and returns the URLs sent and the first refusal's status. api.indexnow.org answered 403 to
  a 939-URL list from a host whose key it accepted for one URL; 100 at a time were all 200. `createIndexNow` takes
  `chunkGapMs` (tests pass 0); `CHUNK` is exported.

## 4.2.1 — 2026-10-15

- **A showcase table that scrolls is a focusable region.** `compare()` and `limits()` wrap their table in
  `.sc-table-wrap`, which scrolls sideways on a phone. The wrapper is now `tabindex="0" role="region"`, labelled by the
  section's heading. An axe scan (WCAG 2.1 AA) of every OpenVibe home at 390 px flagged it on ai.openvibe.services
  (`scrollable-region-focusable`, serious). Code samples already were.

## 4.2.0 — 2026-10-15

- **"Ask Actor" in the account menu.** Signed in, the menu's You section has Ask Actor after Notifications. It opens
  openvibe.actor's console with the text the person had selected on the page (up to 1000 characters, spaces folded)
  as the ask, and the page's https address (without its hash, up to 400 characters) as where it came from
  (`/console?ask=&from=`). With nothing selected it opens the plain console. The selection is read when the avatar is
  pressed, since the press itself can clear it. Nothing runs until the person presses Run it in Actor. Signed out,
  the link is not shown. Hidden with the rest of the defaults by `menu: { defaults: false }`.
- The navbar's brotli budget is 31 KB (was 30): it measures 30.6 KB with Ask Actor and its built-in glyph.

## 4.1.9 — 2026-10-15

- **Avatars are asked for in the size they are shown.** When a person's picture is an openvibe.media object
  (`/o/med_…`), the navbar asks for `?w=<size>&fmt=webp` (64 for the chip, 72 for the menu, 48 for the account
  switcher, already twice the shown size). The footer's 24 px avatar asks for 64. Media answers a resized WebP (Fabric
  F4, Media's `/o/:id?w=&fmt=`): a sampled 18.6 KB avatar is under 1 KB at 96 px. Any other picture address is used as
  it is.

## 4.1.8 — 2026-10-15

- **Four showcase steps sit two by two below four columns.** In a section narrower than four steps across (under
  1192 px), `sc-steps` with exactly four items uses two columns instead of `auto-fit`'s three and one, which left
  step 4 alone on openvibe.zone and openvibe.download. Three, five and more steps are unchanged.

## 4.1.7 — 2026-10-15

- **`shell.page()` removes the browser's body margin.** A site with no stylesheet of its own (openvibe.events,
  openvibe.bot) kept the default 8 px, so the Frame's footer stopped short of the window's edges. The head's reserved
  style now starts with `body{margin:0}`; sites that set it themselves are unchanged.

## 4.1.6 — 2026-10-15

- **Play and Inventory show their own "Recently shipped".** `shipped.js` knew no `play` or `inventory` id, so the
  widget fell back to the page's host and play.openvibe.network listed Network's changes. Both ids are in the registry
  now, and the test checks that every site in `icons/sites.json` resolves to itself.
- **Share cards and install manifests for Play and Zone.** `social/play.jpg` and `social/zone.jpg` are drawn from their
  Contracts site blocks (build-social-cards.js), and `icons/sites.json` names both (build-icons.js; 37 services), so their
  pages get an `og:image` and an installable manifest like every other site.

## 4.1.5 — 2026-10-15

- **Steps line up.** In a row of steps, a step whose text is one line had a gap under its title: the row stretched it to
  its taller neighbour's height, and its own grid spread the extra space between title and text. `.sc-steps li` now
  keeps its rows at the top (`align-content:start`).
- **Four cards never fall three and one.** A section is now a size container (`container-type:inline-size`), and a grid
  of exactly four cards in a section narrower than four columns (520–1035 px) sits two by two. Wider sections keep four
  across; phones keep one column.

## 4.1.4 — 2026-10-14

- **A `play` glyph for OpenVibe.Play.** Play (achievements and leaderboards for every OpenVibe game) gets its own icon:
  a podium under a star in the stroke set (`OpenVibeIcons.svg('play')`), and Font Awesome's ranking star in the solid
  set. Before it, Play's site could only borrow Games' controller, and the navbar keys a site's entry by its icon, so
  the two collided.

## 4.1.3 — 2026-10-12

- **`shell.page()` holds the navbar's place.** The navbar script is deferred and mounts into the page's `#navbar-mount`;
  on a slow first paint the 52 px bar arrived after it and pushed the page down (CLS 0.058 on many homes in a phone
  sweep). The head now reserves `#navbar-mount{min-height:52px}`, and a `<noscript>` style removes the empty mount
  without JavaScript.
- **The updates log no longer jumps while it loads.** `shipped.js` log showed "Loading…" inside the days, then the site
  chips and the patch notes arrived above it and pushed it down (CLS 0.17 on openvibe.live/updates on a phone). The
  first load now shows one standalone "Loading…" line, a site's own chips are drawn before the data, and the chips,
  patch notes and days land together.

## 4.1.2 — 2026-10-12

- **"Recently shipped" tells visitors what changed, not which library was bumped.** The one-liner and the short
  list (`shipped.js` latest and list) pass over library pin bumps ("openvibe-shared v4.1.0 (was v4.0.0)", opened by
  pin-bump.js on every repo at once): they read three times as many entries and show the newest real changes; when
  only pin bumps shipped, those are shown rather than an empty block. The full updates log keeps every deployed commit.
  `isHousekeeping(entry)` is exported.

## 4.1.1 — 2026-10-12

- **`release.js` reads the commit time on release-layout services.** A release directory belongs to the deploying
  user while the service runs as its own, so git refused it ("detected dubious ownership") and `released_at` fell back
  to the boot time — on openvibe.live and openre.stream, for example. The read-only git calls now pass
  `-c safe.directory=<the release's real path>`, so `released_at` is the commit time again (the sitemaps' static
  `lastmod` and open tabs' release checks use it).
- **Showcase grids balance five, six or nine cards** in three columns on a wide screen (≥ 900 px), instead of four
  and a lonely last row (the Wiki and Events homes showed 4 + 2).

## 4.1.0 — 2026-10-12

- **Every `shell.page()` site is an installable web app, with no per-site code.** A new `icons/` directory ships
  four pre-rendered app icons (192 and 512, any and maskable) per app-icon tint variant — 8 sets, 32 palette PNGs,
  about 630 KB, since most sites share the network's tint — drawn by `scripts/build-icons.js` from
  `app-icon.svg({ site: variant, maskable })`; `icons/sites.json` gives each of the 35 services with a share card its
  name, tagline and variant (`social.iconSite`). The new `openvibe-shared/app-icons` module names them (`has`, `url`,
  `site`, `isIcon`, `path`), and `serve.js` answers them at `/shared/icons/<variant>[-maskable]-<size>.png` beside the
  browser files and share cards.
- `serve.js` now also answers `GET /shared/manifest/<service>.webmanifest` as `application/manifest+json`, built
  from the service's Contracts `site` block (name and tagline, committed in `icons/sites.json`) with the same
  hashed icon URLs, `start_url`/`scope` `/`, `display: standalone`, the app-icon background and the navbar's
  `#0d131d` theme colour. Unknown services 404.
- `shell.page()` adds `<link rel="manifest">` and `<link rel="apple-touch-icon">` for the page's service when it has
  icons, using the same service resolution as the share-card default (`service`, else `navbar.service`, else
  `footer.service`). `manifest: false` opts out, and a page whose `head` already carries a manifest link keeps it.

## 4.0.3 — 2026-10-11

- Share cards: `run` (openvibe.run has a site block since openvibe-contracts 0.141.0) and a redrawn `host` (its tagline
  is now "Hosting, compared honestly").

## 4.0.2 — 2026-10-11

- `shell.page()` finds the site's share card from `navbar.service` or `footer.service` when the page itself names no
  `service` (most sites set it only there), so their pages get `og:image` too.
- The site template pins openvibe-shared v4.0.0 (it still named v3.0.0).

## 4.0.1 — 2026-10-11

- Tagged in error on the 4.0.0 commit: identical to 4.0.0. Use 4.0.2.

## 4.0.0 — 2026-10-11

- **Share cards for every site** (`openvibe-shared/social`, new): a 1200×630 card per service in
  `social/<service>.jpg` (about 60 KB each), drawn by `scripts/build-social-cards.js` from the Contracts service
  manifests' `site` blocks (name, tagline, what, first domain, accent) with the app-icon mark and embedded Inter.
  `serve.js` answers them at `/shared/social/<service>.jpg?v=<hash>` beside the browser files, and `shell.page()` uses
  the site's card for `og:image`/`twitter:image` (with `summary_large_image`) when the page names no image and has a
  canonical; `image: null` opts out. `social.url(service)` gives the URL to pages that build their own head.
- **Breaking (for a caller relying on it):** `middleware.js` `extractToken` no longer reads Live's legacy `token`
  cookie: only the bearer, `ov_token` and the WebSocket query parameter. Live stopped setting that cookie and Chat
  stopped reading it (compatibility register C-05). No OpenVibers service imports this module today.

## 3.0.1 — 2026-10-10

- `notification-live.js` (the bell's realtime feed) resumes from Events' opaque cursor: `last_event_id` is the last
  SSE id Events sent, handed back as it came, never a number it read from the message. A replay after a reconnect is
  dropped by its `event_id` (the last 256 heard), not by position. `state()` reports `lastId` in place of `lastSeq`.
- `release-watch.js` drops a replayed release message by its `event_id` alone (it already resumed from the cursor).
- With these, nothing in Shared reads Events' numeric seq as a position, so Events can stop accepting one (plan T7,
  ADR-042 decision 7). A bell on an older pin keeps working after that; a reconnect then starts at the head, and the
  count poll fills in.

## 3.0.0 — 2026-10-10

- Removed the SQLite configuration store. `createConfigStore` now requires an openvibe-sdk/db handle and returns a promise of the ready PostgreSQL store. `fromRows`, `adminRoutes`, `configSchema`, and other non-SQLite exports remain.
- Removed SQLite analytics: `AnalyticsTracker`, `analytics/tracker`, `analytics/schema`, `analytics/prune-cli`, the SQLite retention and scrub functions, and the SQLite `ANALYTICS_SCHEMA` and `ensureSchema` exports. Use `analytics/pg` (`AnalyticsTrackerPg`, `analyticsSchema`, `pruneRawEventsPg`). `analytics/retention` still exports `MAX_DAYS`.
- Consumers already passing an openvibe-sdk/db handle to `createConfigStore` and using `analytics/pg` need no code changes. Live's `test/shared-pins.test.js` still lists `openvibe-shared/analytics/prune-cli` in `RESOLVE_ONLY`; remove that entry when updating its pin.
- `better-sqlite3` is gone from devDependencies (and the lockfile).

## 2.21.2 — 2026-10-10

- `release-watch.js` reopens its release-notification stream with `last_event_id` set to the last SSE id Events sent
  (its opaque cursor, ADR-042), not the numeric seq it computed from the message. It still drops a replayed message
  by the seq the data carries. This is one of the last consumers of Events' numeric positions (plan T7 retires them).

## 2.21.1 — 2026-10-10

- **The last fallback "V"s go.** A scan of every site's home page found ring icons drawing the "V" for names with no
  glyph: Quest (page), Rent (db, deploy, gauge, page), Food (location, page) and openvibe.download (db, link, shield).
  - New glyphs, each a Font Awesome Free solid twin plus a stroke fallback: `gauge`, `link`, `shield` and `plug`.
  - New aliases onto existing glyphs: `page` → `docs`, `db`/`database` → `zone`, `location` → `ip`, `gamepad` →
    `games`, `robot` → `bot`, `deploy` → `upload`, `copy` → `paste` and `activity` → `ping`.
  - The navbar set is unchanged.

## 2.21.0 — 2026-10-10

- **Every product has its own ring icon.** Ten sites on the openvibe.network home drew the fallback "V": Actor, Help,
  Inventory, MediaHub, Quest, Rent, Services, Space, Watch and Work. They now get Font Awesome Free solid glyphs like
  the rest: brain, question mark, open box, hard drive, trophy, key, cubes, rocket, eye and briefcase. Glyphs are also
  added for the products opening next: `events` (bolt), `ai` (chip), `run` (terminal), `billing` (wallet), `feeds`
  (RSS), `pics` (photos), `homes` (house), `website` (window), `zone` (database) and `fund` (hand with coin). `bot`
  gets the solid robot. New aliases: `media-hub`/`mediahub` → `drive`, `sources` → `feeds`, `agent` → `actor`,
  `jobs` → `work`. Each new name also has a stroke glyph.
- Centring re-measured (`scripts/measure-icons.js`): the solid twins had inherited offsets measured for their old
  stroke glyphs. Games sat 1.5 units high and Tools 1.3 units right; every glyph is now centred on its measured
  bounds.
- `scripts/build-nav-icons.py` draws a ring-only glyph without adding it to `nav-icons.js`. navbar.js's width table and
  size budget are unchanged.

## 2.20.4 — 2026-10-10

- Ring icons (`ov-icons.js`, `showcase.css`) no longer put a CSS transform on any element inside the SVG. On a phone,
  scrolling left some icons unpainted: a glyph missing inside its ring, or a whole chip icon blank. The icons that
  failed were the ones under the scrolling thumb, plus the cards whose comet spins. Both used CSS transforms on SVG
  children (`transform-box: view-box` with `transform-origin` on the glyph, a rotated comet circle, a rotated progress
  circle and a scaled pulse).
  - The comet is now a dash moving round the ring (`stroke-dashoffset`), and the progress arc is a path that starts at
    twelve o'clock.
  - Pulse animates opacity only, and the hover lift scales the whole `<svg>` element.
  - Hover effects apply only under `(hover: hover)`, so a thumb scrolling over a link starts nothing.
  - At rest the icons render the same as 2.20.3, comet position included.

## 2.20.3 — 2026-10-10

- Filled controls use the theme's readable pair, `--accent-strong` with `--on-accent-strong`, instead of `--accent` with
  white. White on the default accent (#3b82f6) is 3.68:1, under WCAG AA's 4.5:1 for text this size; the strong pair is
  4.62:1 in the default theme, and every theme defines it (dark text on the light accents). This covers the primary
  `ui.js` button, the toast's primary action, the account switcher's add button, the footer's avatar initial (white on
  #60a5fa was 2.5:1) and the navbar launcher's pressed segment. The release UX check's axe run flagged the same pairing
  on product sites.

## 2.20.2 — 2026-10-09

- On a phone (≤ 420 px) the compact navbar keeps a joined brand whole: openre.stream shows "OpenRestream", not "stream"
  (other sites still shrink "OpenVibe.Live" to "Live").

## 2.20.1 — 2026-10-09

- The OpenRestream brand on openre.stream reads as one word: "OpenRe" and "stream" touch, with no padding between the
  two links (`.openvibe-navbar-brand.joined`). 2.20.0 left about 2 px between them, which read as two words.

## 2.20.0 — 2026-10-09

- The product at openre.stream is **OpenRestream** (owner, 2026-10-09), not "OpenRe.Stream". The navbar brand there
  reads as one word: "OpenRe" + "stream" with no dot between, in the brand's two colours, both linking to
  openre.stream (`brand().joined`, `brand().site`; ingest.openre.stream is "Ingest.OpenRestream"). The footer,
  `shipped.js` and the showcase name it OpenRestream too.

## 2.19.0 — 2026-10-09

- `items.js` draws **community badges** (`network.badge.image@1`, OpenVibe.Inventory's Workshop): the badge's
  reviewed image, from OpenVibe.Media, in an `img.ov-badge` just before the name. The image comes straight from the
  equipped read's `media_id`, with no extra request, and only ids of the `med_…` shape become a URL. items.css sizes it
  to the text.

## 2.18.0 — 2026-10-09

- `items.js` draws two more renderers. **Hats** (`live.hat.glyph@1`): the emoji just before the name, with Live's
  float/pulse/warp motion. **Particles** (`live.particle.css@1`): a short burst of the item's characters when you point
  at or focus the name, never on its own. Hats and particles take their emoji, motion and characters from Live's
  definitions: one public read per page, only when someone on it wears one. Elements are made from the name's own
  document. items.css carries Live's hat motions and particle colours. Reduced motion and the Calm setting stop the
  hats and hide the bursts.

## 2.17.0 — 2026-10-09

- `items.js` + `items.css`: what people wear in OpenVibe.Inventory, on any site (plan T21 "equip everywhere"). A name
  marked `data-ov-subject="usr_…"` gets its owner's name effect (`live.name_effect.css@1`: `ov-fx` + the token) from
  Inventory's public batch read, 100 people per request with a 60 s cache. items.css holds Live's 13 name effects
  unchanged, so a name looks the same in Live's chat and everywhere else; reduced motion stops the animation.

## 2.16.0 — 2026-10-09

- The account menu links your public profile: **My Profile** → `https://openvibe.network/@<username>` (plan T21: the
  picture, bio, what you wear and the items you own in OpenVibe.Inventory), next to My Account and My Channel. Signed-in
  accounts only; an anonymous identity has no profile.

## 2.15.0 — 2026-10-08

- The navbar fades into the page at the very top (no background or border) and brings its frosted bar back with a
  smooth transition as you scroll; it keeps that state itself (`.ovnav-top`) on every render and scroll, so a page no
  longer has to. A page whose hero runs under the bar sets `body.ov-nav-overlay`: the bar then sits over the hero with a
  soft scrim for its text (a fixed bar, like Live's, needs no pull-up; `--ovnav-real-h` is 0 for it).
- The navbar sticks again on sites that mount it in `#navbar-mount`: the wrapper was exactly the bar's height, so the bar
  had no room to stick and scrolled away. The wrapper is sticky now.
- navbar.js brotli budget 29 → 30 KB (29.4 KB with the fade).

## 2.14.1 — 2026-10-08

- shipped.js names every site (Space, Services, Actor, Run, Watch, Download and the rest): the update log showed
  "space", "services" and "actor" in lowercase next to "Host" and "Community". A site missing from the list still reads
  as a name (its id capitalised), and `siteName` is exported.

## 2.14.0 — 2026-10-08

- A boost page move no longer keeps the old navbar. 2.13.3 removed the render's document listeners, but panels.js
  still held every panel ever registered (the drawer on each render; signed in, the account menu too) in its list,
  with a MutationObserver, so each re-render kept the whole removed bar and its listeners alive.
  `OpenVibePanels.register()` now takes `signal` (an AbortSignal: the registration ends when it aborts, its observer
  is disconnected) and returns its `unregister()`; `OpenVibePanels.unregister(el)` does the same by element. The
  navbar registers its panels with the render's signal, gives the display rows' `ov:display` window listeners that
  signal too, and drops a gone render's queued registrations.
- browser-harness: the navigation probe forgets a window or document listener when its AbortSignal aborts, as the
  browser does. It kept every one, and with it whatever the listener closed over, so the growth check also measured
  its own probe: with 2.13.3's navbar alone it still saw the old bars.
- Measured with ovhost browser-check's method (probe on, forced GC, lap 2 → 5), the patched files served into the
  live pages: openvibe.codes +780 nodes, +60 listeners → 0, 0; openvibe.services +852, +60 → 0, 0; openvibe.space
  +744, +72 → 0, 0; openvibe.community +3324, +72 → 0, 0. Both halves are needed: either one alone still grows.
- New test boost-navbar-chrome.test.js (real Chrome: navbar, panels and boost over six laps, measured like
  browser-check; no node or listener growth, no detached bar); panels.test.js and navbar-brand.test.js cover the
  signal lifecycle.
- The navbar's notes on `history`, `silentLogin`, `fedcm` and `fedcmLogin` moved to the README (navbar.js 28.8 KB
  brotli, budget 29 KB).

## 2.13.3 — 2026-10-08

- The navbar removes the document listeners of its previous render (the outside-click closers of the launcher, the
  dropdowns, the drawer and the account menu) with an AbortController per render. Every re-render — each
  `openvibe-shared/boost` page move re-renders the bar — had left them on document, keeping the removed bar and its
  listeners alive: ovhost browser-check measured +25–40 listeners and +250–1100 nodes per navigation lap on
  openvibe.space and openvibe.community (2026-10-08).

## 2.13.2 — 2026-10-08

- The navbar loads `ov-mark.js` only when no `<script src=".../ov-mark.js">` is on the page yet: a page carrying its own async
  tag that had not run when the navbar rendered got a second copy (ovhost browser-check "script requested twice" on
  openvibe.coupons, .reviews, .services, .vip and openre.stream, 2026-10-08).

## 2.13.1 — 2026-10-08

- `showcase` code samples are a focus stop with a name (`<pre tabindex="0" aria-label="…">`): a sample that scrolls
  sideways could not be reached from the keyboard (axe `scrollable-region-focusable`, serious; ovhost browser-check
  on ai.openvibe.services and openvibe.events, 2026-10-08).

- `scripts/pin-bump.js` (plan T1, the pin bot): after a release of openvibe-contracts, -shared, -sdk or -publishing,
  `node scripts/pin-bump.js <library> <tag> [--repos A,B] [--apply]` opens one PR per OpenVibers repository that pins
  the library below the tag: every pin moved, the npm or pnpm lockfile refreshed, STATUS.json and the README versions
  block rewritten by `scripts/docs-status.js`. A dry run by default; CI tests each PR (full suite and pin drift).

## 2.13.0 — 2026-10-07

- `release-watch` now connects to `https://openvibe.events` by default; the notification bell follows the stream URL in Network's ticket. A site pinning this release must allow `connect-src https://openvibe.events` in its CSP.

## 2.12.0 — 2026-10-07

- `showcase`: the sections (`.sc-hero`, `.sc-sec`, `.sc-cta`) set their own font stack (`--ov-font`, else Inter and
  the system sans-serif fonts). `shell.page` adds no base stylesheet, so a home built from the shell and the
  showcase rendered in the browser's default serif face (OpenVibe.Events, Reviews, Deals, Trade, Host).
- `footer`: the Frame footer sets the same font stack on `.ovf`, as the navbar already does, so it no longer
  inherits a serif face on pages without a body font.
- `app-icon`: `space` (indigo, OpenVibe.Space) and `ai` (cyan, OpenVibe.AI) tints.
- `navbar`: the brand spells `openvibe.space`, `openvibe.services`, `openvibe.events` and `openvibe.bot` with their
  names (Space, Services, Events, Bot), and the `space` service falls back to the Space brand off the network.

## 2.11.0 — 2026-10-07

- `ov-icons`: a `bot` glyph (a robot head with its antenna, eyes and side lights, in the family's 24-unit stroke
  style), centred by hand (`OFFSETS.bot` `[0, 0.75]`: its bounds run from y 3.5 to 19) so no other icon's
  measured offset moves. OpenVibe.Bot's site block (openvibe-contracts 0.106.0) names the icon `bot`; until a
  site pins this release its navigation shows the OV mark for Bot.

## 2.10.1 — 2026-10-05

- `openvibe-shared/shipped`: OpenVibe.Bot is a known site (`bot` → "Bot"), so its changelog lines and filter chip
  read "Bot" rather than the raw id, and `?site=bot` / `openvibe.bot` resolve to it.

## 2.10.0 — 2026-10-05

- `openvibe-shared/showcase`: `nextSteps({ id, title, lede, items })` renders up to four next steps on other OpenVibe
  products (Shared ADR 0002, plan D94, `docs/adr/0002-traffic-between-products.md`). An item is
  `{ to, what, text?, href, from?, embed? }`: `to` picks the ring icon and the "on OpenVibe.X" label, `from` appends
  the referral tag `ov_from=<from>` (nothing about the person), `embed` adds an "Embed it" link. Only `https://` URLs
  or site paths are rendered; an unusable item is left out and no items render ''. Styled in `showcase.css`.
- `docs/adr/0002-traffic-between-products.md` (proposed): next-step cards, shareable result pages, embeds and badges
  (live-rendered SVG + a proof page that re-checks the fact), and quests.
## 2.9.0 — 2026-10-04

- `openvibe-shared/showcase`: a feature card's ring icon (`icon: 'ov:…'`) now fills the 40 px icon slot
  (`--ovi-size: 40px`, class `sc-ic-ov`, no second tinted tile behind it). Before, the ring drew at 22 px
  inside the tile, so its glyph read at about 10 px. Font Awesome icons keep the tinted tile.
- `scripts/docs-status.js` (new; plan D41 docs currency): reads a repository's openvibe-contracts/sdk/
  shared/publishing codeload pins and keeps STATUS.json's `contracts`/`sdk`/`shared`/`updated` fields
  and the README `<!-- versions:start -->`/`<!-- versions:end -->` block in step with them, preserving
  every other STATUS key (and any prose after a version). `--check` reports drift and exits 1; a
  repository that pins nothing omits the block. In write mode `updated` is rewritten only when one of
  those fields really changed, so a rerun with no pin change touches nothing.
- The reusable test workflow's "docs currency" step is **off by default** (`docs-status: false`):
  consumer repositories do not have the README versions block yet, so a default-on check would fail
  their CI. A repository turns it on with `docs-status: true` once its README carries the
  `<!-- versions:start -->` block and its STATUS.json `contracts`/`sdk`/`shared` fields match its pins.

## 2.8.0 — 2026-10-04

- `openvibe-shared/test-runner`: `parallel: 'auto'` resolves to `max(1, min(8, cpus - 1))` (before, any
  non-number made the runner start nothing); a numeric pin works as before and no option keeps the
  `min(4, cpus - 1)` default. `run()` also returns the resolved `parallel`, and `resolveParallel()` is
  exported. Each test file runs in its own process and owns its database (`createTestDb`: its own PGlite,
  or under `test:pg` its own PostgreSQL schema, roles and port), so files parallelize safely and a repo
  no longer needs `parallel: 1`.

## 2.7.0 — 2026-10-04

- `openvibe-shared/notifications`: a new `CONFIRMATION_REQUESTED` type (category `system`, priority
  `high`, icon 🔑, title "Approval needed"). OpenVibe.Network sends it to an agent's owner when a
  confirmation for that agent's sensitive capability use is created and waits for them.

## 2.6.0 — 2026-10-03

- `openvibe-shared/shell` (new): `page(o)` composes a whole server-rendered document — the doctype
  and `<head>` from `seo.headTags` (plus `seo.pageSummary` when `summary` is given), the theme-loader
  before the first paint, `web-runtime.js`/`navbar.js`/`footer.js` deferred through `serve.url`, the
  no-JavaScript nav from `frame.noscriptNav`, the body and `frame.footer`. `scripts(o)` returns just
  the head scripts and the inline boot: the runtime options as JSON with `<` escaped, so a value can
  never close the `<script>`. Every interpolated value (title, description, `lang`, body attributes)
  is escaped. `templates/site/server/app.js` now calls `shell.page` instead of hand-writing the
  document. Additive: a new subpath export, nothing removed.

## 2.5.0 — 2026-10-02

- `seo.feedXml(feed, { format })` takes items as `{ title, link, guid?, description?, content?, author?,
  published, updated? }` and the feed's `language` and `selfUrl`. RSS adds `<language>`, an
  `atom:link rel="self"` and a `lastBuildDate` that is always present. Atom adds
  `link rel="alternate"`/`rel="self"`, `xml:lang`, `<content type="html">` and an `<updated>` that is
  always present. Without `updated`, both use the newest item date, or now when there are no items.
  Text is escaped with `esc`, so `'` becomes `&#39;`. The 2.4.0 `url`, `id` and `summary` still work.
- `seo.llmsFull` takes `base` and sections of `pages: [{ title, url, text | html }]`: each page
  renders as `### title`, `URL: …` and its full text (HTML stripped), in input order, and
  `maxBytes` ends the file with a `(truncated: N more pages at <base>/llms.txt)` line. The
  2.4.0 `{ url, body }` sections render unchanged. `seo.pageSummary` now converts to an HTML
  string — `<meta name="ai-summary">`, WebPage JSON-LD and, with string `facts`, a
  `<noscript><section data-ai-summary>` block — and has `.head`/`.body`; its `meta`, `jsonLd` and
  `html` are unchanged. `templates/site` serves `/llms-full.txt` and puts the summary in its head.
- `perf-budget` measures Core Web Vitals (plan T11). `measure({ browser })` opens the page in
  Chrome through `browser-harness` after the byte pass, clicks once, and adds
  `cwv: { lcpMs, inpMs, cls }`. `check()` accepts `lcpMs`, `inpMs` and `cls` budgets and throws
  when they are used without `cwv`; `format()` prints a `cwv:` line. Without `browser`,
  measurement is unchanged and needs no Chrome.

- The asset pipeline adds `hashAsset(bytes)`, generated AVIF and WebP srcsets from
  `picture({ src, widths, ... })`, and `openvibe-build-assets` to copy files to
  hashed names with a `manifest.json` lookup. The builder does not transcode images.

- `openvibe-shared/assets` (plan T11): content-addressed asset URLs and responsive `<picture>` markup for
  a product page. `hash(bytes)` is the estate's sha256 truncated to 12 hex; `url(src, hash)` appends
  `?v=`, replaces an old one and leaves the path unchanged when there is no hash; `srcset(entries)` builds
  a srcset; `picture({ src, hash?, alt, width, height, sizes, sources })` emits AVIF before WebP before
  the fallback `<img>` (any other type ranks after WebP), renders a plain `<img>` when there is nothing to
  choose between, and renders nothing without a `src`. Formats come from the caller: this package does not
  transcode images, so it only emits the AVIF/WebP variants a site's own build produced.

## 2.4.0 — 2026-10-02

- The SEO kit adds `llmsFull` for full-text AI maps, `pageSummary` for escaped page
  summaries and WebPage data, `feedXml` for RSS 2.0 and Atom 1.0, and `feedLinkTags`.
  Product, review, rating, image gallery and VideoObject JSON-LD builders are available
  through `jsonLd`. The package root now exposes the kit as `seo`.

## 2.3.1 — 2026-09-29

- `showcase.css` is served at `/shared/showcase.css` (files.js `STYLES`, text/css): the showcase sections and the ring
  icons' CSS as one cacheable stylesheet, so a product home links it instead of inlining ~10 KB of CSS in every page
  (and boost loads it styles-first on a swap). Generated by `scripts/build-styles.js`; the test fails when it is stale.
  `serve.js` answers each file with its own content type.

## 2.3.0 — 2026-09-29

- `openvibe-shared/showcase` (plan T11, D92): the sections a product's home page is built from — `hero`, `features`,
  `steps`, `code`, `demo`, `compare`, `pricing`, `limits` (pricing that equals the API's limits, citing its source),
  `stories`, `cta` — rendered on the server as plain HTML with inline `CSS` on the theme tokens. Every string is
  escaped (only a field named `html` passes markup through), a section with no items renders nothing, and heading ids
  come from titles so a page renders the same bytes every time.

## 2.2.0 — 2026-09-29

Boost on real sites (plan T11):
- `boost.js` starts itself from its script tag: `<script src="/shared/boost.js" data-main="#main" defer>` (optional
  `data-prefix`, `data-exclude="/a/,/b/"`); the controller is `OVBoost.controller`. `OVBoost.start()` still works.
- A swap also carries the new page's `<body>` class (page-type classes).
- `navbar.js` follows boost: on `ov:boost:load` the bar re-renders (active links, a sign-in that returns to the new
  page) and records the new page in the signed-in person's history.

## 2.1.0 — 2026-09-29

Three new modules for plan T11, plus `serve.js` now taking its cache headers from the shared policy (its own headers are
unchanged):
- `openvibe-shared/cache-policy` — `isHashed(path)`, `assetHeaders(path, { hashed })` (immutable for a content-addressed
  asset, otherwise `public, max-age=300, stale-while-revalidate=86400`), `htmlHeaders({ private, maxAge, swr })` and an
  `applyHtml()` middleware, so "hashed asset = immutable, HTML = stale-while-revalidate" is one rule instead of one
  per site.
- `openvibe-shared/indexnow` — `createIndexNow({ host, key, keyLocation?, endpoint?, fetch, log })` → `keyFile`,
  `ping(urls)` (one POST, deduped, https-only, own host, ≤10,000 URLs, never throws) and `pingSoon(urls)` (one
  debounced batch in 30 s). No key means no request.
- `boost.js` (`OVBoost.start({ main })`, served at `/shared/boost.js`) — smooth same-site page moves for a server-rendered
  site: a click fetches the next page (prefetched on hover, focus or touch), loads its new stylesheets first, swaps
  `<main>` in place with the shared transition, updates the title and the head tags that describe the page, runs the new
  main's inline scripts once, keeps history and scroll, and moves focus to the content. Any doubt (another release
  marker `<meta name="ov-boost">`, other external scripts, a non-HTML answer, a redirect off the site, an error) is a
  normal page load. Pages listen for `ov:boost:load` to wire their widgets.

## 2.0.0 — 2026-09-29

**X-Internal-Key is gone from the shared package** (plan T2: every internal call in the estate uses a service token).
Breaking, and nothing in the estate used any of it:
- `internalApiAuth` (the `middleware` export and the index re-export) is removed.
- `OpenVibeAuthClient#verifyTokenInternal` (Network's `/internal/verify-token`, deleted) and `#getUserProfile` (a route
  Network never had) are removed; the rest of the client is unchanged.
- The deprecated `openvibe-shared/chrome-ssr` alias is removed: use `openvibe-shared/frame`.

## 1.30.1 — 2026-09-28

Page moves, measured on Live with a 400 ms network: the bar runs from the click, "Loading Content…" appears at 150 ms and follows the phase ("starting up"), the styled page fades in, and nothing shows unstyled in between. Fixes to 1.30.0: the first move after a server-rendered page is animated (the "first page" is the first `enter()` before any route change, route generation ≤ 1, not simply the first call); `route-transition.js` is fetched a few seconds after load, so it is ready for the first click; the loading line sits over the page's visible area but outside the section (a page script that re-renders its section while loading can no longer take it away); the file is requested by path, so the site's versions map hashes it.

## 1.30.0 — 2026-09-28

**Pages never show unstyled, and moving between them looks finished.** `web-runtime.js`: a feature's stylesheets (its dependencies' too, `rt.stylesOf(name)`) start downloading together with its markup fragment, and the fragment is inserted only once they have loaded (or timed out), so a route no longer flashes unstyled markup for a moment. New `rt.enter(section, work, { label })`: the page's content stays hidden while its route loads, keeping its space (no layout jump), and is shown when the work settles, failure included. On the first in-site move the runtime fetches the new **`route-transition.js`** from next to itself (a browser file in `files.js`, export `openvibe-shared/route-transition`): a progress bar across the top, after 150 ms a centred "Loading Content…" line with the current phase under it (`<prefix>:phase` events: "applying styles", "starting up", or the site's own `rt.status(text)`), then an opacity-only fade-in (a transform would make the page the containing block of its fixed children). Theme tokens colour it; reduced motion gets none of the animation. The first page of a visit is never animated (it arrived server-rendered). The runtime's usage notes moved to the README ("The web runtime"), keeping it at 6.2 KB brotli (budget 6.5); the transition layer is 1.6 KB and loads only when someone moves.

## 1.29.2 — 2026-09-28

**Navbar dropdowns open again.** A top link's dropdown (Live's "Go Live" → Dashboard) opened but was cut off: it hangs below the links row, which scrolls sideways (`overflow-x: auto`) and so clips anything below it. The menu is now fixed-positioned under its link whenever it can show (hover, keyboard focus, a tap), measured from the box a filtered or transformed bar makes for fixed children. The usage notes at the top of `navbar.js` moved to the README ("The navbar"), which keeps the file inside its 29 KB brotli budget (28.7 KB).

## 1.29.1 — 2026-09-28

**Themes repaint the whole page and keep button text readable.** `applyVars` sets the canvas through the variables (`var(--bg-primary, value)`), so a page with its own theme switcher that sets `--bg-primary` later repaints the background too, instead of leaving the first theme's colour behind; `save()` applies the theme it saves, so every token, the canvas and the browser UI follow at once. A theme without its own `--on-accent` (custom colours, older server themes) gets one derived by WCAG relative luminance, near-black on bright accents (a lime green) and white on dark ones; `OpenVibeThemeLoader.onColor(hex)` is exported for pages that paint their own accent surfaces. **Navbar brand, compact:** the mark and the name sit 6px apart with 2px padding, the ".Live" part hugs the name, and the bar's side padding follows the viewport (`clamp(8px, 1.6vw, 16px)`), so narrow screens keep more room for links.

## 1.29.0 — 2026-09-28

**`openvibe-shared/analytics/pg`: request analytics on PostgreSQL** (ADR-035; ADR-021's privacy bounds unchanged). `AnalyticsTrackerPg` is the tracker on an openvibe-sdk/db handle, with the same tables and `getStats`, `getOverview` and `getBotAnalysis` shapes; `analyticsSchema()` is the DDL for the service's migrations; `pruneRawEventsPg` is the 30-day retention in batches. The request path never waits for the database: rows buffer in memory and `flush()` writes them in one transaction every 5 s (or at 100). Unique visitors stay right across processes: the day's salt is shared through `analytics_day_salts`, so the visitor hash is computed at flush, while (address, user agent) wait in memory until then, as the rate counters always did; no address reaches the database. Session ids stay per process, as they were. Every SUM is cast to bigint (numeric comes back as text). `test/analytics-pg.test.js` on PGlite: two trackers count one visitor once, DNT records nothing, rollups, dashboards and retention. Needed by Network's and Live's PostgreSQL passes.

## 1.28.1 — 2026-09-28

Fixes the owner reported from phones.
- **Account panel:** the panel scrolls as a whole and its sections keep their height. The panel is a flex column, which let its sections shrink, so on a height-limited phone screen the accounts block ("Switch to Anonymous", "Add another account") collapsed into a sliver with its own scrollbar. The account rows now have the menu rows' size, weight and icon width.
- **OpenVibe.Codes mark:** a mark at rest (every page after the first of a visit) paused the codes variant's looping V animation at its first frame, where the V is not drawn yet, so the logo showed only the ring and the dot. At rest the V is now fully drawn.
- **Footer:** phones no longer reserve 84–96 px of empty space under the footer. A page with a fixed bottom bar sets `--ov-footer-clearance` to its height; the default is none.

## 1.28.0 — 2026-09-28

**`openvibe-shared/config` on PostgreSQL** (ADR-035: Media, Network and Live keep their configuration here). Given an openvibe-sdk/db handle, `createConfigStore` uses the new `config-pg.js`, which is the same store on the async handle. Revisions are immutable, activation is atomic, the last-known-good revision is restored when `onActivate` fails, secret values are redacted with a per-namespace fingerprint key, legacy values are imported, and so on. On this path `createConfigStore` returns a promise of the store: it has read, restored or seeded its active revision when the promise resolves. `get()` and `revision()` stay in memory. The other methods are async. The tables come from the service's migrations: `configSchema()` is their DDL, the SQLite schema converted. `adminRoutes` awaits either kind of store. The better-sqlite3 path is unchanged. `test/config-pg.test.js` runs every scenario of `test/config.test.js` on PGlite (openvibe-sdk v0.20.4, which returns `bytea` as a Buffer, is a dev dependency).

## 1.27.0 — 2026-09-28

**`openvibe-shared/express-async`: an async handler's rejection no longer ends the process.** Express 4 ignores what a handler returns, so a promise that an `async (req, res) => …` handler rejects (a database error, a thrown problem) became an unhandled rejection, and Node 22 exits on one. The move to PostgreSQL (ADR-035) made most handlers async; nine services had between 5 and 41 such routes. `routeAsyncErrors(app)` patches the app's own Express 4 `Layer` once, so the rejection goes to `next(err)` and the service's error handler answers, exactly as a synchronous throw always did. Error handlers get the same treatment. On Express 5, which handles promises itself, it does nothing. **`instrument()` calls it**, and every service calls `instrument()`, so a pin bump is the whole change. `test/express-async.test.js`.

## 1.26.0 — 2026-09-28

**Async gauges** (ADR-035: services on PostgreSQL read their counts asynchronously). A gauge's `collect()` may return a promise. The `/metrics` handler (`metricsHandler`, and the `instrument()` middleware that uses it) now calls the new `registry.metricsAsync({ timeoutMs = 2000 })`. It awaits every async collect together. A collect that rejects or runs past its budget is left out of that scrape and is never reported stale, just as a throwing one already was. The synchronous `registry.metrics()` is unchanged, and it leaves an async gauge out. The handler is now an async function; Express and plain `http` callers need no change. `test/metrics.test.js` covers async, rejecting and slow collects. This replaces the "one scrape behind" workaround the first PostgreSQL services used.

## 1.25.0 — 2026-09-28

**`openvibe-shared/test-runner`: no fake green in `npm test`** (roadmap WS-Q task 7). Every service carried its own copy of `test/run.js`, and each counted a test file that exited 0 as passed, including one that printed `…: skipped (no ffmpeg)` and checked nothing. The runner is now one module: `require('openvibe-shared/test-runner').main({ dir: __dirname, timeoutMs, pad, hide, env })` (`run()` returns the results for a caller that wants them).
- Same behaviour as the copies: every `*.test.js` in `dir` in its own process, a few at a time, `NODE_ENV=test`, a timeout per file, name filters from the arguments, and the last 40 lines of a failed file (minus `hide` lines).
- **Skips.** A test prints `<label>: skipped (<why>)` for each thing it could not run (the convention OpenVibe.Host's acceptance runner already reads). Such a file is listed with ○ and its reasons, and is not counted as passed: the summary reads `148/150 test files passed, 2 skipped (…)`, and only a run with nothing skipped says `N/N test files passed`. Skips alone exit 0; `--strict` (or `OV_TEST_STRICT=1`) makes them fail the run.
- This package's `test/run.js` uses it; `test/test-runner.test.js` covers pass, skip, partial skip, failure, hidden lines, filters and strict.

## 1.24.0 — 2026-09-28

**No fake green in readiness** (roadmap WS-Q task 7: "skipped counts as yellow; nothing may be marked green by being synthesised from skipped parts"). `ready.js` had only `ok` and `fail`, so a check whose feature was not configured had to claim `ok` (Network's Discord bot, Media's events outbox and News's source pull did) or fail and turn the service yellow for a setting.
- **`skip(reason, detail?)`**, exported by `openvibe-shared/ready`, or a check returning `{ skipped: reason }`: the check reports status `skipped` with `reason` (and `detail`), never `ok`, and is listed in the new `skipped` array of the body.
- A skipped **optional** check leaves a service whose other checks passed `ready`. A skipped **required** check is listed in `degraded` too, and the service is `degraded` (still HTTP 200: nothing failed).
- A service is `ready` only when at least one check really passed: one with no checks, or with every check skipped, is `degraded`. This changes what a service with no checks reports (before: `ready`).

## 1.23.1 — 2026-09-27

**Two release-watch fixes found by the release-lifecycle acceptance scenarios** (D46, roadmap WS-P task 16; OpenVibe.Host `scripts/release-acceptance.js`). release-watch.js stays within its 5 KB brotli budget (4.99 KB; comments shortened).
- **An account switch during an update** (scenario 9). An in-place update fetches its regions with the session (`credentials: 'same-origin'`), so a region can be rendered for whoever is signed in. On sites that switch accounts in place (Live: the `openvibe-auth-changed` window event), a region fetched for the previous account and still waiting for focus to leave it, or still in flight when the account changed, was committed as fetched: the new account (or a guest, after signing out) saw what the server had rendered for the previous one. Now `openvibe-auth-changed` drops such regions and fetches them again with the new session, and an answer that arrives after a switch is never committed (counted as `deferred: account`, a new reason `/release-metrics` accepts). The switch itself still reloads nothing, prompts nothing and opens no second stream.
- **Resuming an offline tab** (scenario 14). Back online, the release stream reconnected at once only when it had given up (6 failures); a tab that came back while still backing off waited out the backoff (up to 8 minutes) before hearing release notifications again. `online` now reconnects at once from the cursor in both cases, like `notification-live.js` does.

New tests: `test/release-account-switch.test.js` and `test/release-offline-resume.test.js` (offline: no prompt, no reload, nothing counted as failed; back online: one `/release.json` read straight to the newest release, in place; a connection lost mid-update leaves the page whole and prompts once; past the window, never reloaded under a focused field; a hidden tab resumes its stream when shown). And `test/release-reading.test.js` (scenario 4, a feed update while reading: a region above the viewport that grows or shrinks moves the page by exactly that, the region keeps its own scroll, a region in view is not compensated; nothing to fix). All three print `[metric] name=value` lines the acceptance runner reads.

## 1.23.0 — 2026-09-27

**Web runtime** (roadmap WS-P task 6). New browser file `web-runtime.js` (`OVWebRuntime.create(options)`), in `files.js` and exported as `openvibe-shared/web-runtime`: OpenVibe.Live's feature loader (`public/js/ov-loader.js`), made shareable and extended. 6.1 KB brotli, budget 6.5 KB.
- **Carried over from Live.** Features from a registry (fragment, deps, css, js, `after` hook, `stubs`, `idle`) and routes; scripts and stylesheets once each, the server's own tags included; versioned URLs; route generations; route scopes (timers, listeners, observers, AbortSignal); intent and idle prefetch; stubs for inline handlers; a retry box for a route that failed.
- **Transactional asset groups.** A feature commits (hook, event, loaded) only when every script loaded. A failure withdraws the stylesheets that attempt added (unless another feature wants them) and the failed tag; a retry fetches only what is missing, and nothing runs twice.
- **Scopes refuse late registrations.** An interval, timeout, listener, observer, fetch or child scope registered after its route ended is refused and counted, not left running. `scope.fetch()` uses the route's signal; `scope.child()` scopes one component; `scope.held()` counts what a scope holds. Fired timeouts are released.
- **A prefetch budget**: a count, and bytes where sizes are known.
- **Diagnostics**: `diagnostics()` and `leaks()` (duplicate tags, failed and rolled-back assets, late registrations, what the current route holds).
- **Other changes.** `showRouteError` builds its box from DOM nodes. Assets from another origin are keyed by origin and path, so a CDN file never collides with a local one. The idle prefetch also starts when the page has already loaded.

`test/web-runtime.test.js` covers it in a linkedom page where tags load or fail on cue. `test/web-runtime-chrome.test.js` covers it in headless Chrome against a local site: a slow script still runs in order, a real 404 rolls the group back and the retry completes it, and a route's interval stops and its fetch aborts.

## 1.22.0 — 2026-09-26

**The notification bell in realtime** (roadmap WS-E task 3, WS-F task 1; openvibe-contracts 0.61.0, ADR-005 amendment 2). It is off by default. A site turns it on with `OpenVibeNavbar.init({ notificationsRealtime: true })`, or with `OpenVibeNotifications.init({ realtime: true })`.
- **New browser file `notification-live.js`** (`OVNotificationLive.create({ ticketUrl, token, credentials, onNotification, onGap, onState })`), in `files.js`, 2.4 KB brotli (budget 3 KB). For every (re)connect it asks Network for a realtime ticket (`POST /api/v1/realtime/ticket`), then opens Events' `/realtime/stream?topics=network.notification.*&ticket=…` without credentials, resuming with `last_event_id`.
  - Only events whose subject is the ticket's person count; another person's, other types and replays are ignored.
  - `event: gap` is reported.
  - Errors close the stream (a ticket opens one stream) and back off from 2 s, with jitter. After ten failures in a row it stops, until the browser is `online` again.
  - Hidden 5 minutes, it closes; shown, it resumes.
  - A Content-Security-Policy refusal, 401/403 or 503 (`REALTIME_TICKETS=off` on Network) stop it.
- **`notification-ui.js`** loads it from its own directory when realtime is on. An event re-reads the count and toasts new items, once per burst, and again after a poll already in flight. A gap also reloads the open lists. The 15 s poll runs only every 2 min while the stream is open. `setToken()` restarts the feed for the new person, and `realtimeState()` reports it. notification-ui.js gets a 13 KB brotli budget (12.7 KB).
- **navbar.js** passes `notificationsRealtime` through.

`test/notification-live.test.js` covers the above in a linkedom page: subscribe, resume from the cursor with a fresh ticket, a gap re-reading the count, CSP-blocked falling back to 15 s polling, a guessed `user:<other>` topic yielding nothing, and the ticket never being kept.

`test/notification-live-chrome.test.js` runs it in headless Chrome, with a real EventSource, against a stand-in for the ticket route and Events' stream. A dropped connection resumes from the cursor with a fresh ticket, with nothing lost or repeated; a retention gap is reported; another person's event is ignored. It is skipped without Chrome. `browser-harness` now exports `openPage` for it.

## 1.21.0 — 2026-09-26

**Browser harness: an unreachable host** (ADR-024, roadmap WS-E task 1).
- `openPage(…, { block })` makes every request matching a pattern fail, as if the host were down.
- `checkUnreachable(url, { block, widths, minText })` loads a page that way (by default with `openvibe.network` unreachable, where the theme, the frame and sign-in live). It reports whether the page still paints: status 200, settled, real text, a `--accent` theme token and a background (the body's, or the html's when the body has none). The blocked requests themselves are not counted as errors.
- Tested in headless Chrome: a page whose theme stylesheet is blocked keeps its inline default.

Host's `browser-check.js --network-down` runs it against every site.

## 1.20.0 — 2026-09-26

**Release manifest 1.2.0** (roadmap WS-P task 7; openvibe-contracts 0.60.0, ADR-016 amendment 2).
- `createRelease({ clientGeneration, minClientGeneration, shell })` serves `client_generation`, `min_client_generation` (also env `MIN_CLIENT_GENERATION`) and `shell: { version, components }`, where the version is the first 12 hex of SHA-256 over the named components' ids and versions.
- The meta tag carries `data-generation`.
- A tab below the minimum generation reloads when safe (`required`). A changed shell is never applied in place; it prompts.
- release-watch stays under its 5 KB brotli budget (4.94 KB) with a tighter header comment.

The Contracts devDependency moves to 0.60.0.

## 1.19.0 — 2026-09-26

**The update matrix, complete** (roadmap WS-P task 8). `release-update.js` sends `ov:content-dispose` (bubbling, `{ component, release }`) on a region just before it is replaced, so a stateless widget inside can drop its listeners and timers; `ov:content-updated` follows as before, to mount it again. Tests now cover every row of the matrix: stylesheet swap and `ov:styles-updated`, revision-aware content with scroll kept, widget disposal and remount, deferral of busy regions, the prompt, and the security minimum. The README "Releases" section lists the rows.

## 1.18.0 — 2026-09-26

**Update telemetry** (roadmap WS-P task 14).
- **Prompts are counted.** `release-watch.js` records `prompted` when it shows the update prompt, with reason `optional`, or `required`, `window` or `contract` when a reload must follow. `release.js` accepts the new outcome into `release_client_updates_total`.
- **Sessions by generation.** Each tab sends a beat to the metrics URL once its manifest is read and then every 5 minutes, carrying a random 16-hex id kept in memory only and the release it runs. On `pagehide` it sends `ended`. The collector keeps the tabs heard from in the last 12 minutes, at most 20,000 per registry, and exposes the gauge `release_client_sessions{generation="current"|"older"}`. `current` is the release the process serves: `mount` and `collect` pass it, or pass `collect(registry, { currentRelease })` yourself. Sec-GPC/DNT requests are still not counted.
- **Size.** release-watch stays within its 5 KB brotli budget (4.96 KB); comments were shortened to make room.

## 1.17.1 — 2026-09-26

Fix: `release-watch.js` acts on a `host.release.published` event only when its `origin` (when present) is the page's own. A service id alone is not unique across the network: Sites' placeholder pages reuse product ids (`ai`, `coupons`, …), so a placeholder's release made the real product's tabs check for nothing.

## 1.17.0 — 2026-09-26

**Release notifications in `release-watch.js`** (roadmap WS-P task 9, ADR-016 amendment 1). When a release goes live, OpenVibe.Host publishes `host.release.published` to OpenVibe.Events (contract `host.release.published@1`, openvibe-contracts 0.58.0; `ovhost deploy` and `ovhost announce`). The event is public, has subject `release` and carries `service`, `release`, `commit` and `origin`. Tabs now hear about a release within seconds instead of at their next poll:
- **One stream per tab.** release-watch opens one EventSource, without credentials, on `https://events.openvibe.network/realtime/stream?topics=host.release.published`, once the page's release and service are known.
- **Which events count.** Only those for the page's service: `OVReleaseConfig.service`, the meta tag's `data-service`, else `/release.json`'s `service`.
- **Generations.** The tab ignores the release it runs, the one it already knows from `/release.json` and one already queued (a hex prefix of the other counts as the same release). It also ignores a repeated event id and a seq at or below the last one seen.
- **Coalescing.** A new release runs the usual `check(true)` after a random 0–20 s delay, so tabs do not all fetch at once. Everything arriving while that check is pending collapses into it, and after a check there are 30 s of quiet, after which whatever arrived meanwhile gets one more check. The update plan, the prompt and the safe-reload rules are unchanged.
- **Gaps.** An `event: gap` (events missed while away) also runs a coalesced check.
- **Account switches.** The events are public, so `openvibe-auth-changed` changes nothing, and a second load of the script still returns early, so there is never a second EventSource.
- **Hidden tabs.** A tab hidden for 5 minutes closes its stream: the poll and the check on becoming visible cover it, and it reopens on return with `last_event_id`.
- **Failures.** An error closes the stream at once, rather than letting the browser retry every 3 s, and it reopens after 30 s, doubling to 15 minutes, with jitter. After 6 failures in a row only polling is left until the browser comes back online.
- **Polling.** Unchanged throughout (focus, visibility, `online`, every 10 minutes). Without EventSource, or when Events cannot be reached, nothing else changes.
- **Configuration.** The default URL applies on https pages. `OVReleaseConfig.eventsUrl` or the meta tag's `data-events` sets another URL, and `false` or `"off"` turns it off. Events answers `https://*.openvibe.*` origins and those in its `REALTIME_CORS_ORIGINS`; elsewhere the stream fails and backs off.
- **CSP.** A site's Content-Security-Policy must allow the Events origin in `connect-src`, as Live and Community already do. Otherwise the browser refuses the stream and logs that refusal once. release-watch sees the `securitypolicyviolation` for its URL, stops (state `blocked`) and stays on polling. Add `https://events.openvibe.network` to `connect-src`, or set `data-events="off"`, when you move a site to this release.
- **State.** `OVRelease.state().realtime` reports `{ state, service, url, events, ignored, checks, failures, lastSeq }`.

`release-watch.js` is 4.7 KB brotli (was 3.2 KB). Its budget in `test/release-update.test.js` moves from 3.5 KB to 5 KB for this.

`release-compat` `openPage()` also takes `globals` (extra window properties, such as a fake `EventSource` or a `Math` with a fixed `random`). It adds `timeouts()` (the pending delays), `fireTimeouts(filter)`, `dispatch(type)` and `timeoutsSet`.

Tests are in `test/release-watch-realtime.test.js`. Additive.

## 1.16.1 — 2026-09-26

Fix: the **OV mark** (`ov-mark.js`) no longer animates forever. Its SVG animations restyle and re-lay-out on the main thread every frame, which kept every idle page with the navbar 12–29% busy (the browser check counted 8–19 endless animations per page). A mark now moves for the intro (the first 8 s of a visit in a tab, from the first time a mark is on screen; the next page of a multi-page site finishes that intro rather than starting another), while it or its link is hovered or focused (plus 1.2 s), and while it shows activity (`data-state` busy/ok from `island.js`). Otherwise its CSS animations are paused where they are and its SMIL clock is stopped, so it keeps its look. It never moves while the page is hidden, while it is off-screen (IntersectionObserver), with `data-static`, under `prefers-reduced-motion` or under the network's own reduced-motion setting (`html[data-ov-motion=reduced]`); the V's light sweep, a SMIL animation, used to keep running in all of those. Measured in headless Chrome after five page loads: 12 running animations and 16.5% CPU before, none and 0% after. `test/ov-mark.test.js`. Sites pick it up with their `openvibe-shared` pin (the file is `/shared/ov-mark.js`); pages that load it from openvibe.network get it when Network's pin moves.

## 1.16.0 — 2026-09-26

**`openvibe-shared/browser-harness`** (roadmap WS-Q task 3, WS-T tasks 3 and 4): Live's browser smoke suite, generalised for any site. It drives headless Chrome over the DevTools protocol with Node's own WebSocket (Node 22+, no dependency), one browser context per route. `run({ base, routes, widths, checks, navigation, … })` checks every route at 390, 768 and 1280 px: the HTTP status (a route can expect 404), console errors (exceptions, `console.error`, failed loads, CSP), horizontal overflow (naming the elements) and scripts requested twice. With JavaScript off it checks the visible text (200 characters), exactly one absolute canonical link (a noindex page may have none), and that JSON-LD parses and its headline or name is in the visible text. For an ItemList, at least 80% of the item names must be visible. axe-core runs at the widest width: serious and critical violations fail, moderate is reported. Once per site, A → B → A navigation runs five times, clicking a link when there is one so a single-page app navigates in place. After a forced GC it samples heap, DOM nodes, listeners and documents (`Performance.getMetrics`), plus live intervals, pending timeouts and open WebSockets (a probe installed before page scripts). A measure fails when it grows past its budget from lap 2 to the last lap and is still growing (`BUDGETS`). CPU, requests and bytes over 5 idle seconds are reported, not failed. `ignoreErrors` rules are counted per label, never dropped silently. `format()` gives text or Markdown, and `summarize()` gives per-check counts. axe-core is not vendored: an installed `axe-core` is used, else 4.13.0 comes from jsDelivr, checked against a pinned sha384 (the same bytes as the npm tarball) and cached. `test/browser-harness-chrome.test.js` runs it in real Chrome against a fixture and skips without Chrome. Additive.

Fix: the selected filter chip of the shared update log (`shipped.js`, every site's `/updates`) was white on `--accent` (3.67:1). It now uses `--accent-strong` / `--on-accent-strong` (4.5:1 or better in every theme), like the navbar's Sign In button. The harness found it.

## 1.15.0 — 2026-09-26

**`openvibe-shared/perf-budget`** (roadmap WS-T task 1): size budgets for a page's first load, measured from the running server with no browser. `measure({ base, path })` fetches the page and every same-origin script and stylesheet it names. It reports the files and their raw and brotli KB; cross-origin assets are listed as `external` and not weighed. `check(m, budgets)` lists the budgets exceeded, and `format()` is the failure message.

## 1.14.0 — 2026-09-26

**`openvibe-shared/config`, the configuration model** (roadmap WS-C task 7): `createConfigStore({ db, service, namespace, schema, validate, classify, defaults, legacy, onActivate })` keeps one namespace of a service's configuration as immutable revisions (`common.config-snapshot@1`) in the service's own better-sqlite3 database (`config_snapshots`; several namespaces per database). `get()` serves the active values from memory; `propose`/`activate`/`apply` validate (a built-in JSON Schema subset and/or `validate()`), classify every key (public, internal by default, secret) and activate in one transaction, and a throwing `onActivate` puts the last-known-good back in memory and in the database, rejects the new revision with the error and throws it. `rollback()` activates a copy of the previous good revision (or `to`) as a new revision; `history()`, `lastKnownGood()` and `summary()` are redacted: a secret is `{ redacted: true, fingerprint }`, an HMAC-SHA256 under a random 32-byte key made per namespace on first use (`config_keys`; never served, never logged), a snapshot's checksum covers the values as shown, and secret values never leave or reach the log. A marker sent back keeps the secret it stands for only when its fingerprint matches. Revision 1 comes from `defaults` or a legacy source (`legacy`, `import()`, `fromRows()` for typed key-value rows). `adminRoutes(stores, { requireAdmin })` serves `GET /api/admin/config`, `GET /api/admin/config/:namespace/history`, `POST /api/admin/config/:namespace` and `POST /api/admin/config/:namespace/rollback` with problem+json errors, on Express or plain http, without depending on either. No new dependency. Additive.

## 1.13.0 — 2026-09-25

Accessibility (roadmap WS-T task 3), from an axe survey of every site. The navbar's **Sign In** button read at 3.67:1 (white on #3b82f6) on nine sites: every theme now derives **`--accent-strong` / `--on-accent-strong`**, the accent deepened (under white) or lightened (under dark ink) just enough for 4.5:1, and the button uses them (`test/login-contrast.test.js` checks all 35 themes). The two tokens are in `theme-sync` and the loader's map. The **footer** reads `{ label, href }` items as `{ name, url }`, so a site passing the navbar's shape no longer renders empty links (Media and Games did). Additive.

## 1.12.0 — 2026-09-24

- **`openvibe-shared/serve`: a site serves its own pinned copy of the shared browser files.** Mount it with `app.use('/shared', serve.handler())` and reference files with `serve.url('navbar.js')`, which gives `/shared/navbar.js?v=<content hash>`. The current hash is cached immutably, anything else for five minutes. ETag is the hash, the files are CORS-open and cross-origin readable, and only the files `openvibe-shared/files` lists are served. A site's pin then decides what its pages run, and the Frame keeps working while openvibe.network is down.
- The navbar loads its lazy siblings from wherever it was itself loaded: `nav-icons.js`, `release-watch.js`, `ov-icons.js`, `panels.js`, `notification-ui.js`, `ov-mark.js`, `sso-client.js` and `history.js`. Before, several were always fetched from openvibe.network (or the `apiBase`); the network's copy is now only the fallback. The footer already loaded `shipped.js` this way.

## 1.11.1 — 2026-09-24

Fix: the footer's "shipped X ago" line uses the footer's own `service` (`live`, `wiki`, …). Before, it resolved the page's hostname, so a local or unmapped host showed the whole network. A site id that is not a registry id (a Tools satellite's `dev`) falls back to the hostname rather than to the whole network.

## 1.11.0 — 2026-09-24

**The OpenVibe Frame.** The shared navbar, footer and "shipped" views every OpenVibe site sits in were called the "chrome", which was borrowed jargon easily mistaken for the browser. They are now the Frame:

- `openvibe-shared/frame` is the server module (formerly `openvibe-shared/chrome-ssr`, which stays as a deprecated alias until 2.0.0).
- The navbar and footer read `https://openvibe.network/api/frame` (Network keeps `/api/chrome` as an alias for older copies) and send their page-view beacon to `/api/frame/hit`.
- They share `window.OpenVibeFrame`; `OpenVibeChrome` points at the same object.
- The browser cache key is `ov_frame_v1`.

No behaviour change.

## 1.10.0 — 2026-09-24

`openvibe-shared/chrome-ssr` gains the server-side pieces of the shared update system, so every site renders the same markup instead of its own copy:

- `shipped({ service, updates, title, limit })`: the home page block (the pill and the recent changes), with a plain link without JavaScript.
- `updatesBody({ service, siteName })`: the body of a site's `/updates` page. Without JavaScript it falls back to openvibe.network's server-rendered log.
- `shippedScript()`: the script tag.

`shipped.js` styles both. Additive.

## 1.9.0 — 2026-09-24

- **One "shipped" and update-log system for every site** (`shipped.js`). There are three views: `latest` (the "🚀 shipped 5m ago: …" pill), `list` (the recent changes plus the latest Patch notes link and an "All updates" link) and `log` (a full `/updates` page: changes grouped by day, "Load more" by cursor, this site or the whole network with a filter per site, and the Patch notes posts). Views mount from markup, `data-ov-shipped="latest|list|log"` with `data-service`, `data-limit`, `data-more` and `data-href`, when the script loads, or from code with `latest()`, `list()` (`mount()`), `log()` and `scan()`. The feed is now `https://openvibe.network/api/v1/changelog`, a cached proxy of OpenVibe.Blog's changelog that every site's CSP already allows. One request is shared per page; the "ago" text stays current; `serviceFor(host)` maps hostnames to registry ids.
- **Footer.** Every footer carries the "shipped X ago" line and an **Updates** link. The link goes to the site's own log (`updates: '/updates'`) or, by default, `openvibe.network/updates?site=<host>`. The footer loads `shipped.js` lazily from its own origin; turn it off with `shipped: false`. `detectService()` now knows the TLD sites (`openvibe.wiki` → `wiki`, `openre.stream` → `openre`).
- **Fix: an empty bordered bar in the footer.** The signed-in row's `display:flex` beat its `hidden` attribute on sites without a global `[hidden]` rule.
- **Fix: "Sign In" shown to signed-in people on sites with their own session** (openvibe.blog and the other publishing sites). When a stored token is stale or refused, the navbar now drops it and asks the site's `sessionUrl` instead of giving up. The navbar also takes a new `logoutUrl` (for example `/auth/logout?next={path}`), so Sign out ends the site's server-side session too. `loginUrl` and `logoutUrl` accept `{url}` (the full return URL) and `{path}` (its local path).

Everything is additive.

## 1.8.0 — 2026-09-24

`shipped.js` (browser file, also `openvibe-shared/shipped`): "Recently shipped" for any OpenVibe site.
`OpenVibeShipped.mount(el, { service, limit, title })` reads the network changelog OpenVibe.Blog keeps
(`GET https://openvibe.blog/api/v1/changelog`): what each site deployed, newest first, each line
linked to its commit, and a link to the latest "Patch notes" post that gathers a batch of changes.
Without `service` it shows the whole network with site labels. DOM nodes only (commit text is never
parsed as HTML), https links only, hidden when there is nothing or the fetch fails; styles follow
the theme variables. Additive.

## 1.7.0 — 2026-09-24

`openvibe-shared/trace` (Track O): one W3C trace across the services a request touches.
`trace.install(app)` (right after openvibe-contracts' `http.middleware()`) runs each request inside
an AsyncLocalStorage holding its trace and request ids, and wraps `fetch()` once so a call to a
loopback address or an OpenVibe host carries `traceparent` (the request's trace id, a new span) and
`X-OpenVibe-Request-Id`, unless it sets its own. Calls to anyone else (payment and AI providers,
user-chosen URLs) are untouched, so trace ids never leave the network; outside a request nothing is
added. Also `trace.current()`, `trace.outboundHeaders()`, `trace.run(ctx, fn)`. Additive.

## 1.6.0 — 2026-09-24

`openvibe-shared/egress`: the one rule for connecting to an address someone else chose. Live
(`server/net/egress.js`), Events (`server/egress.js`) and Tools (`apps/_shared/egress.js`) each had a
copy and they had drifted: Live allowed the 3fff::/20 documentation range and 5f00::/16, and only knew
the /96 NAT64 prefix. This module is the strictest union: `isPublicAddress`, `embeddedV4`, `expandV6`,
`normalizeHost`, `isInternalName`, a connect-time `safeLookup` (every DNS answer must be public, so there
is no rebinding window), `createSafeLookup` for tests, `assertPublicUrl` and `EgressDenied`. Node only;
the three services keep their own fetch, delivery and throttle wrappers on top of it.

Fixed: `release.collect()` counted client beacons per socket address, which behind the proxy is
127.0.0.1 for everyone, so one 30-a-minute bucket refused the whole site. It now keys by `req.ip`
(the app's trust-proxy view), or `keyOf(req)` when given.

## 1.5.1 — 2026-09-23

Touch and keyboard feedback in the shared chrome (owner feedback: phones flashed a theme-blind blue
box over anything tapped). The navbar, its dropdowns, the launcher, the drawer and the footer turn
off `-webkit-tap-highlight-color`, show a slight press (`scale`, which composes with existing
transforms) and give keyboard focus one ring in the theme accent. Rules are wrapped in `:where()`
so they carry zero specificity: the chrome's own `:focus-visible` rules and host pages still win.
With reduced motion the press is a brief dim instead of a shrink.

## 1.5.0 — 2026-09-23

Roadmap Track R (D42–D46, ADR-016): release manifests with components, open tabs updated in place,
update metrics, and a mixed-version test harness. Additive; a service that changes nothing keeps
serving exactly the manifest it served on 1.4.0.

- **`/release.json` carries the registry.release-manifest 1.1.0 fields** (openvibe-contracts
  v0.31.0): `components` (`{ id: { kind: style|content|script|server, version } }`), `assets` (logical
  path → content-addressed URL, component, sha384 integrity), `schema_generation`,
  `schema_compatible_from`, `contract_ranges` (`{ id: { version, accepts: ">=a.b.c <x.y.z", role? } }`)
  and `metrics_url`. `createRelease()` takes `components` (`assets` under `publicDir`, `files` under
  `root`; versions are content hashes), `contracts` (`^`, `~`, `x`, `>=` ranges are normalised),
  `schemaGeneration`/`schemaCompatibleFrom` (numbers or functions), `assetUrl`, `recheckMs` and
  `metricsPath`. Without a declared `shell` component its version is the release, so every release
  still reloads. The package versions are part of the shell's hash, so a Shared bump never applies
  in place.
- **The contract filter.** The served manifest keeps only the fields the service's installed
  openvibe-contracts release-manifest schema declares. Under openvibe-contracts ≤ 0.30.x that is
  the 1.0.0 set, so `/release.json` keeps validating. `full()` is the unfiltered manifest,
  `fields()` what is served, `validate()` checks the served one with the service's contracts, and
  `refresh()` re-reads git, env and files.
- **`release.mount(app, { registry })`** mounts GET `/release.json` and POST `/release-metrics`.
  Tabs' reports go into `release_client_updates_total{outcome,reason}` in the service's
  `openvibe-shared/metrics` registry, and so into `/metrics`. Outcomes are `applied` (by the kinds
  applied), `reloaded` (`user`, `required`, `window`, `contract`), `deferred` (`typing`, `dirty`,
  `protected`, `media`, `capture`, `active`) and `failed` (`style`, `style-timeout`, `content`,
  `origin`, `script`). An unknown reason counts as `other`. A report is at most 4 KB, counts at most
  50 per reason, and one address sends at most 30 a minute. Sec-GPC/DNT reports are dropped.
  `collect(registry)` is the POST handler on its own.
- **release-watch.js** keeps its rules: it prompts once, and reloads by itself only when it must
  and only when that is safe. Now it also reads the page's own manifest at load, even with the
  meta tag, and hands a release with components or contract ranges to **release-update.js** (new
  browser file, loaded on demand from the same directory). The update is applied in place when
  only style, content or server components changed and the contract ranges still hold. New
  `<link>`s are matched by path or `data-ov-asset` and load beside the old ones, which are removed
  only after every new one has loaded. `[data-ov-content="<component>"]` regions are re-fetched
  (`data-ov-src`, default the page URL) with no scripts, frames or inline handlers. Each region is
  replaced only when nothing inside it has focus, is protected or plays; otherwise it waits, and an
  unchanged `data-ov-rev` is skipped. Any failure keeps the old page and falls back to the prompt.
  Contracts outside the server's range force a reload, but still only when safe. It counts outcomes
  and beacons them (on hide, after an update, before a reload) to `OVReleaseConfig.metricsUrl`, the
  meta tag's `data-metrics` or the manifest's `metrics_url`, same origin only. It emits
  `ov:release-applied`, `ov:styles-updated` and `ov:content-updated`. The new
  `OVReleaseConfig.inPlace: false` turns in-place updates off.
- **navbar.js**: `init({ releaseWatch: { … } })` is passed to release-watch as `OVReleaseConfig`.
- **`openvibe-shared/release-compat`** (new, Node): `runMixedVersion` and `assertMixedVersion` run
  the page × server matrix from the manifests' contract ranges. Where the manifests say
  compatible, they call the real server with the other release's client. Where they say
  incompatible, they require the tab's plan to be a reload. Adjacent releases must be compatible.
  Also `replay(calls)`, `manifestFor()`, `consumerCompatible()` (service to service),
  `rollbackSafe()` (schema generations), `plan()`/`compatible()` (the tab's own logic) and
  `openPage()`, which runs release-watch in a linkedom page for in-place tests.
- Sizes (brotli q11): release-watch.js 1.7 → 3.1 KB (+1.4 KB; it loads after first paint at low
  priority). release-update.js is 2.9 KB and loads only when a release lists components. navbar.js
  is +21 bytes (27.9 KB). Both release files have a 3.5 KB budget test.
- Dev only: `linkedom` and `openvibe-contracts` (v0.30.2) are devDependencies.
  `test/fixtures/release-manifest.v1.1.0.json` is Contracts' 1.1.0 schema, used until that
  devDependency moves to v0.31.0.

## 1.4.0 — 2026-09-23

`openvibe-shared/analytics` is now the ADR-021 module (roadmap register item 26 and C-80). It
replaces three hand-copied versions in Live `server/analytics/`, Tools `apps/_shared/analytics/`
and Network `server/analytics/`. The old `analytics.js` was removed. It stored raw IPs, user ids,
cities and full user agents, and deleted raw rows only after 90 days. No deployed service still
used it.

- **Same API, ADR-021 behaviour.** `new AnalyticsTracker(db, service[, opts])`, `middleware()`,
  `trackEvent()`, `flush()`, `aggregate()`, `getStats()`, `getOverview()`, `getBotAnalysis()` and
  `destroy()` all keep their shapes. A raw row has a route template, a referer origin, a
  user-agent class, a rotating session id, a country and a signed-in flag. `ip`, `user_id` and
  `city` are always NULL. Unique visitors come from day-salted hashes, which are deleted once the
  day's rollup is final. The rate check keeps its counters in memory only.
- **Sec-GPC and DNT are honoured on the server.** A request with `Sec-GPC: 1` or `DNT: 1` is not
  recorded at all: no raw row, visitor hash, session id or rate counter. It is therefore also
  missing from the rollups, because ADR-021 provides for no separate opted-out count.
  `trackEvent(name, { headers })` does the same. `privacy.optedOut(headers)` is exported.
- **`analytics/event.v1`** is the documented raw event shape:
  `docs/schemas/analytics-event.v1.json`, exported as
  `openvibe-shared/analytics/event.v1.json`. `openvibe-shared/analytics/event` provides
  `toEvent(row)`, `validateEvent(ev)` and `checkRow(row)`. `checkRow` rejects a row that has
  ip/user_id/city set. The validator reads the schema file itself. `trackEvent` now stores NULL for
  a value outside the schema, and throws a `TypeError` for an event name outside it.
- **Retention.** The tracker schedules the 30-day raw-event prune by default. Pass
  `retention: false` if the service runs `retention.pruneRawEvents` itself. The new
  `retention.schedulePrune(db, opts)` returns `{ run, stop }`. Days above 30 are refused.
- **Service specifics are options** (formerly Network's `network.js`). `paramPrefixes` adds
  parameter words to the defaults. `pathRules` is a list of `[RegExp, replacement]` rewrites
  applied before templating. Both are accepted by the tracker and by
  `retention.scrubEvents`/`scrubRollups`/`inspect`, so legacy rows are templated like new
  ones.
- **`openvibe-shared/analytics/prune-cli`** is the prune and one-time scrub command. Each service
  wraps it in its own script and passes `Database`, `defaultDb` or a `targets` hook, extra flags
  and path options. It runs a dry run by default. `--apply` needs `--backup` or `--no-backup`. It
  backs up one database to a file or several to a directory. Backups are owner-only (0600)
  because a pre-scrub backup holds the old IPs. It checks that rollup totals are unchanged and
  can VACUUM.
- An over-long route template now loses whole segments and ends in `/*`. Before, it was cut at
  200 characters, possibly mid-segment.
- The root export (`require('openvibe-shared')`) and `openvibe-shared/analytics` keep the names
  that 1.x exported: `classifyRequest`, `parseUserAgent`, `ANALYTICS_SCHEMA` and
  `BOT_USER_AGENTS` now use the ADR-021 code. `SUSPICIOUS_PATTERNS` is a frozen, deprecated
  object that nothing reads, and it will be removed in 2.0.0.
- Package shape: [docs/adr/0001-one-package-subpath-exports.md](docs/adr/0001-one-package-subpath-exports.md)
  (proposed) keeps one package with explicit subpath exports. `exports` gains the `analytics/*`
  subpaths, and `test/package.test.js` now refuses wildcard subpaths and any module file without
  an entry.
- Dev only: `better-sqlite3` is a devDependency for the analytics tests. The package itself has
  no native dependency.

## 1.3.0 — 2026-09-23

Observability and readiness (roadmap Track O, §15.19). Additive only; both modules are Node-only
and have no dependencies.

- `openvibe-shared/metrics`: a Prometheus text-format registry (counter, gauge with optional
  scrape-time `collect()`, histogram with fixed buckets) that caps every metric's label
  combinations (past `maxSeries` they fold into one `_overflow` series, counted by
  `metrics_series_overflow_total`). `instrument(app, { service, release })` mounts the golden-signal
  middleware — `http_requests_total{method,route,status_class}`,
  `http_request_duration_seconds{method,route}`, `http_requests_in_flight` — keyed by the route
  TEMPLATE (`req.baseUrl` with id-like segments as `:id` + `req.route.path`, or a caller's
  `normalize(req)`; unmatched requests are `unmatched`, never the raw URL), process metrics
  (`process_resident_memory_bytes`, `nodejs_heap_*`, `nodejs_eventloop_lag_seconds{stat}`,
  `process_cpu_seconds_total`, `process_uptime_seconds`), `release_info{service,release}`, and
  `GET /metrics`, which answers only a direct loopback caller (127.0.0.1/::1 with no
  `X-Forwarded-For`, `X-Real-IP`, `Forwarded` or `CF-Connecting-IP`) and 404s everyone else.
- `openvibe-shared/ready`: `createReadiness({ service, release, checks, details })` → `handler` and
  `run()`. Each named check reports `status`, `required`, `latency_ms` and `checked_at` (a cached
  check keeps the time it really ran). `ready` is false (HTTP 503) only when a required check fails;
  failed optional checks are listed in `degraded` and the service stays ready (`status:
  "degraded"`). Failure reasons are one line with URL credentials, query strings and
  `token=`/`key=` values removed.

## 1.2.1 — 2026-09-23

- `release-watch.js` never reloads a tab that is playing `<video>`/`<audio>` or holds a live
  camera/microphone stream (viewers look idle while watching; broadcasters must never be cut).

## 1.2.0 — 2026-09-23

- `navbar.js` loads `release-watch.js` (from the same place it was loaded from) four seconds after
  `init()`, so every site on the shared navbar gets release prompts once it serves `/release.json`.
  A site without the route costs one 404 per page load; `init({ releaseWatch: false })` opts out.

## 1.1.1 — 2026-09-23

- `release-watch.js` works without the `<meta name="ov-release">` tag: the release `/release.json`
  reports when the script loads becomes the page's baseline, and a site that serves no
  `/release.json` is asked once and left alone. Adopting it is a route plus one script tag.

## 1.1.0 — 2026-09-23

Active-client update safety (ADR-016, contract `registry.release-manifest@1`). Additive only.

- `openvibe-shared/release` (server): `createRelease({ service })` → `handler` for
  `GET /release.json` (deployed commit, commit time, package versions, `MIN_CLIENT_RELEASE`,
  24 h mixed-version window) and `metaTag()` for the page's own release.
- `release-watch.js` (browser, served at `/shared/release-watch.js`): on focus, visibility,
  reconnect and every 10 minutes, compares the page's release with `/release.json`. A newer
  release shows one Reload toast; a required release or one older than the window reloads the tab
  only when it is hidden or idle, no text field has focus and nothing is protected
  (`form[data-dirty="true"]`, `[data-ov-protected]`, `window.OVProtected()`).

## 1.0.0 — 2026-09-22

First release from its own repository. Imported history-free from
`OpenVibe.Network/packages/openvibe-shared` at Network commit `f337eb6`; every module is
byte-identical to that commit except `navbar.js`, which only changed as listed below.
Vendored copies in Media, Tools and Community carried a stale `ov-icons.js` (and Community a
stale navbar test); canonical was correct everywhere — see `docs/divergence-2026-09-22.md`.

### Changed
- **navbar.js no longer ships every glyph.** The 87 Font Awesome solid glyph paths moved to a new
  browser file, `nav-icons.js`. navbar.js keeps the 13 glyphs it draws itself (account menu,
  admin link, wallet chip) plus the widths of the rest, and fetches `nav-icons.js?v=<content hash>`
  once, after first paint, the first time a site's link, chip or menu row names another glyph —
  from the directory navbar.js was loaded from, else `https://openvibe.network/shared/`. The slot
  is an empty `<svg>` of the glyph's exact size until the path arrives, so nothing moves; the
  finished DOM and pixels are identical to the Network copy (checked in headless Chrome). If
  `nav-icons.js` cannot load, those icons fall back to `<i class="fa-solid …">` (the behaviour
  before inline glyphs). A page that loads `nav-icons.js` before navbar.js gets every glyph
  synchronously. New option: `iconsUrl`.
  navbar.js: 151.8 KB raw / 39.0 KB brotli → 118.6 KB / 27.6 KB.
- `scripts/build-nav-icons.py` now writes `nav-icons.js`; `scripts/build-navbar-icons.js`
  regenerates navbar.js's block from it (`--check` in the tests).

### Added
- `files.js` (`require('openvibe-shared/files')`): the list of browser files a site may serve at
  `/shared/<file>`, the package directory, `isBrowserFile()` and `path()`.
- `exports` for every module (`openvibe-shared/navbar`, `/nav-icons`, `/theme-loader`, … and
  `/package.json`); every subpath the Network copy exported still resolves to the same file.
- Tests: `test/run.js`, a navbar.js size budget (29 KB brotli) and icon availability test,
  browser-bundle hygiene (no `require()` or Node globals in served files), package exports.
- `scripts/size-report.js`: raw and brotli (q11) size of every browser file.
- CI on Node 22.22.1, including an install of a tag-style tarball into an empty project.
