# Changelog

All notable changes to `openvibe-shared`. Versions follow [semver](https://semver.org/): a
breaking change to any exported module, browser global or served file name is a new major.
A release is the git tag `vX.Y.Z`; consumers pin the tag's tarball (see README).

## Unreleased

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
