# The OpenVibe Kit

One set of app pieces for every OpenVibe site, and for anyone else's: a sticky head with its tabs, lists of rows,
cards that fold, settings rows, a search row, a composer pinned at the bottom, and a bottom tab bar on phones. The
pieces are built on the server or in the page with the same functions. They look the same on every site, in every
theme, and they fit a phone first.

- **`kit.js`**: the builders (`require('openvibe-shared/kit')` on the server, `window.OpenVibeKit` in the page).
- **`kit-web.js`**: the behaviour in the page (copy buttons, menus that close, Enter to send, confirms, sheets), about
  7 KB. It runs by itself, and again on new markup through `OpenVibeKit.enhance(container)`. A server-rendered site
  loads only this one.
- **`kit.css`**: the look, built on the site's theme tokens.
- **`appbar.js`**: the phone tab bar. `navbar.js` loads it only for a site that sets `appBar`.
- **`search.js`**: search across OpenVibe from the navbar's magnifier, loaded on first use.
- **`loading.js`**: the one loading look (an overlay over the thing's own picture) and skeleton rows.

The package is MIT. Every site serves its own pinned copy at `/shared/kit.css`, `/shared/kit.js`, `/shared/kit-web.js` and
`/shared/appbar.js` (`openvibe-shared/serve`), so a page keeps working when another site is down.

## Why

The owner, 2026-10-28:

> "The pages are so dang long still… use tabs or collapsible areas… consider which areas are going to be more useful
> than others and make it more simple and straightforward while still being powerful."
>
> "On a phone they want it to act more like an app, not a huge long web page… a whole app ecosystem across all our
> systems in harmony… optimized across all devices, tablet, mobile phone, computer."

The same day, a sweep measured the front page of all 38 live sites at 390 px wide, signed out
(`scripts/kit-gallery.js` has the gallery; the sweep script is in the plan state):

| What | At 390 px |
|---|---|
| Length | 6 to 22 screens, most 10 to 15 (Media 22.5, Network 19.9, Quest 17.3, Actor 17.2, Services 16.4) |
| Before the real content | the hero (badge, title, a 5-7 line paragraph, 2-3 stacked full-width buttons) takes about 1.5 screens |
| Numbers | two-column cards, about one more screen |
| Footer | 530-925 px, about a whole screen (now only on a site's front page: footer `variant: 'auto'`, 4.19) |
| Tap targets under 32 px | up to 101 a page (Media 101, Chat 81, Live 68, Quest 68, Search 53) |
| Text under 12 px | up to 244 elements (Media 244, Live 130, Community 46, Help 43) |
| Fixed on screen | only the navbar; no site had a bottom bar |
| Sideways scroll | none (the 2026-10-17 sweep held) |

## The shape of a page

```
┌──────────────────────────────┐
│ navbar (sticky)              │  OpenVibe Frame: brand, launcher, bell, account
├──────────────────────────────┤
│ ‹  Title            ⓘ  •••   │  kit.head: back, title, one muted line, icon actions   ┐ sticky under
│ ( Look ) Privacy  Sound  …   │  kit.tabs: the page's parts, one at a time             ┘ the navbar
├──────────────────────────────┤
│ content                      │  rows, sections, folds; one or two screens, never ten
│                              │
├──────────────────────────────┤
│ ( Message #general     ) (↑) │  kit.dock: the one thing you type, pinned (sticky)
├──────────────────────────────┤
│  ✦     💬     👥    ⚙    ☰   │  app bar (phones, < 760 px): the site's main places
└──────────────────────────────┘
```

Rules every page follows:

1. **One or two screens.** A part people use every visit is open. A part used once (setup, embed snippets, hooks, a
   danger zone) folds. A page with distinct parts gets tabs (`?tab=`), and the server builds only the open tab, so
   each request reads less.
2. **The content first.** Signed in, a site opens on its app (the conversation, the list, the search), not on its
   introduction. The hero and the long explanations are for new visitors and search engines.
3. **Icons for actions, words for content.** Header actions are icon buttons with a label for screen readers and a
   tooltip. A row is the whole tap target. Primary actions say what they do ("Start a room", not "Submit").
4. **44 px to the touch.** Rows are at least 56 px, buttons at least 44 px (`--ovk-tap`), icon buttons 44 px on touch
   screens.
5. **Fixed where it helps.** The head and tabs stick under the navbar. The dock and a form's save bar stick above the
   app bar. Nothing else floats.
6. **No sideways scroll** except strips meant to scroll: tabs, numbers, chips.
7. **Works without JavaScript.** Every piece is plain HTML (links, forms, `<details>`). `enhance()` only adds copy
   buttons, menus that close, Enter to send, confirms and sheets.

## Sizes

| Width | What changes |
|---|---|
| < 600 px (phone) | numbers scroll sideways, sheets come up from the bottom, the dock spans the screen |
| < 760 px | the app bar shows (when the site sets `appBar`) |
| ≥ 600 px (tablet) | numbers sit in a grid, the save button is its natural width |
| ≥ 1024 px (computer) | `.ovk-split` puts a sticky side panel (320 px) beside the content |

## Colours

The kit uses the site's theme (`theme-loader.js`), so it wears every theme in light and dark:

| Kit token | From the theme | Fallback |
|---|---|---|
| `--ovk-bg` | `--bg-primary` | `#0b0f17` |
| `--ovk-panel` | `--bg-card`, `--bg-secondary` | `#121826` |
| `--ovk-panel-2` | `--bg-hover`, `--bg-tertiary` | `#1a2233` |
| `--ovk-input` | `--bg-input` | `#0f1522` |
| `--ovk-line` | `--border` | `rgba(255,255,255,.1)` |
| `--ovk-text`, `--ovk-muted` | `--text-primary`, `--text-muted` | |
| `--ovk-accent` | `--accent` | `#3b82f6` |
| `--ovk-fill`, `--ovk-on-fill` | `--accent-strong`, `--on-accent-strong` (readable filled controls) | |
| `--ovk-ok`, `--ovk-warn`, `--ovk-bad`, `--ovk-live` | `--success`, `--warning`, `--danger`, `--live-red` | |
| `--ovk-top` | `--ovnav-real-h` (navbar.js sets it) | `52px` |
| `--ovk-bottom` | `--ovnav-appbar-h` (appbar.js sets it on phones) | `0px` |

Every class starts with `ovk-`, and nothing in `kit.css` styles a bare element, so the kit can sit beside a site's own
CSS.

## The pieces

Text arguments are escaped. Arguments named `body`, `html`, `before`, `after`, `actions`, `trail`, `badge`, `extra`
and `mark` take markup, usually another builder's output. A URL is kept only when it is `http(s)://`, a same-site
path, a query or a fragment; anything else becomes `#`.

### Head and tabs

```js
kit.head({ title, sub, back: { href, label }, actions: [kit.iconButton(…), kit.more(…)], tabs: kit.tabs(…) })
kit.tabs({ base: '/settings', items: [{ key: 'look', label: 'Look', count, icon }], active, param: 'tab' })
kit.tabOf(req.query, ['look', 'sound'])   // the open tab: a known key, else the first
```

The head sticks under the navbar and casts a shadow once the page scrolls (`html.ovk-scrolled`). Tabs are links, so
they work without JavaScript. On the server, build only the open tab's data. A form posts a hidden `tab`, redirects
back to `?tab=…&saved=1`, and changes only its own tab's fields: an unchecked switch on another tab must not be
reset.

### Lists and rows

```js
kit.list(rows, { title: 'Your rooms', more: { href: '/rooms', label: 'All' }, flush, empty: 'No rooms yet.' })
kit.row({ href, mark: kit.mark({ name, src, square }), title, badge: kit.badge('live', 'live'),
          meta: kit.when(ts).text, metaIso: kit.when(ts).iso, sub, unread, trail })
```

A row has a mark (a picture, or up to two letters on a colour from the name; `square` for places), the title with a
badge and the time on one line, and one muted line under it. With `href` the whole row is a link. Without it the row is
static, and `trail` can hold its own forms (a role select with a check button). `kit.when()` gives 14:05 today,
Yesterday, a weekday this week, `Oct 20` this year, else the date.

### Sections, folds, menus

```js
kit.section({ title: 'Members', count: 12, note: 'Who can do what', body, id })
kit.fold({ id, title: 'Put this room on your site', meta: 'two ways', open, body, tone: 'danger' })
kit.more({ label: 'More', items: [{ href, label, icon }, { action: '/x/delete', label, icon, danger, confirm }] })
```

### Settings rows

```js
kit.switchRow({ name, label, hint, on })
kit.rangeRow({ name, label, value, min, max, step, unit: '%' })
kit.selectRow({ name, label, hint, options: [[value, label]], value })
kit.seg({ name, label, options: [[value, label]], value })
kit.chips({ name, label, options: [[value, label, checked]], single })
kit.saveBar({ label: 'Save settings' })
```

Inside `<form class="ovk-form">`, each row keeps its label on the left and its control on the right. The save bar
stays in reach above the app bar.

### Search, add, compose

```js
kit.find({ action, method: 'get' | 'post', name, placeholder, icon: 'search' | 'plus', extra, hidden, inset })
kit.dock({ action, name: 'message', placeholder: 'Message #general', before: attachButton })
```

`find` is a pill with an icon, the input, optional controls (a select) and a round button: search with `get`, "add
by name" with `post`. `dock` is the composer pinned at the bottom: one line that grows, Enter sends (Shift+Enter, or a
phone's own Enter, makes a new line), and a round send button.

### Numbers, empty states, notices, code, sheets

```js
kit.stats([[1234, 'messages this week'], [48, 'people chatting']])   // zero and unknown values are left out
kit.empty({ icon: 'chat', title, text, action: { href, label, icon } })
kit.notice({ kind: 'ok' | 'error' | 'warn' | 'info', text })
kit.snippet({ code, id })                       // a copy button in the corner
kit.sheet({ id, title, body }) + kit.sheetButton({ sheet: id, label, icon: 'filter' })
```

A sheet comes up from the bottom on phones and is a centred dialog on computers.

### Controls and icons

```js
kit.button({ href | type, label, icon, kind: 'primary' | 'quiet' | 'ghost' | 'danger', small })
kit.iconButton({ href | type, icon, label, name, value })
kit.action({ action: '/s/x/leave', icon: 'leave', label: 'Leave', confirm: 'Leave the server?' })
kit.badge(text, 'accent' | 'ok' | 'warn' | 'bad' | 'live') · kit.dot(n) · kit.icon(name) · kit.ICONS
```

`kit.ICONS` lists the icon names: 24-unit line drawings in the text's colour, among them `back`, `plus`, `send`,
`search`, `gear`, `members`, `invite`, `chat`, `bell`, `home`, `spark`, `live`, `video`, `image`, `tag`, `coin`,
`trophy`, `map`, `code`, `robot` and `game`.

## The navbar's links

The 2026-10-28 sweep of all 38 sites' bars found three habits that made them feel crowded and repetitive:
- other sites repeated after every site's own links ("Live · Tools · Space · Community", twice on some);
- "What shipped" and "Search" as main places;
- up to twelve entries.

The rules since 4.22.0:

1. **Four or five main places, with icons**, in the order people use them: the site's home or feed, finding (browse,
   categories), what is theirs (watches, tickets, saved), and the site's main verb (post, go live, write). The same
   icons make the phone app bar (`appBar: true`).
2. **The rest is `more: true`.** Those links fold into one "More" on computers and are listed in the phone drawer:
   guides, sources, "how it works", the API.
3. **Search is the magnifier**, not a link: `search: { owner, label, page }` points it at the site's own results and
   search page.
4. **"What shipped" lives in the footer** (Updates), which every site has.
5. **The account menu holds the person's things** (dashboard, settings, admin), and the launcher holds the other sites.
   The bar no longer repeats them (`networkLinks` brings the strip back for a site that really wants it).

```js
OpenVibeNavbar.init({ service: 'food', links: [
    { label: 'Food near you', href: '/near', icon: 'fa-location-dot' },
    { label: 'Food boxes', href: '/boxes', icon: 'fa-utensils' },
    { label: 'Meal plan', href: '/plan', icon: 'fa-list-check' },
    { label: 'Cupboard', href: '/pantry', icon: 'fa-house' },
    { label: 'Food list', href: '/foods', more: true },
], appBar: true, search: { owner: 'food', label: 'OpenVibe.Food' } })
```

**On a phone** the bar keeps the site's name readable and never stacks one control on another (4.22.1):
- **The name:** the site's word alone ("Games", not "OpenVibe.Games") up to 480 px. When there is still no room, it
  ends with an ellipsis and is never drawn under the buttons.
- **Signed in:**
  - the balances fold into one pill showing the first balance, up to 440 px (a tap lists them all);
  - the launcher steps into the menu, whose "All sites" opens it.
- **Everyone under 375 px:** the launcher steps into the menu.
- **Spacing:** the right-hand buttons sit closer together under 400 px.

`test/navbar-phone-fit-chrome.test.js` measures the bar from 320 to 430 px, signed in and out.

## The app bar

```js
OpenVibeNavbar.init({ …, links: [{ label: 'Rooms', href: '/rooms', icon: 'fa-people-group' }, …], appBar: true })
OpenVibeNavbar.init({ …, appBar: [{ label, href, icon, id, page, dot }] })   // five at most
OpenVibeNavbar.setAppBar(spec | false)
```

- **`appBar: true`** builds the bar from the site's own links that carry an icon: the first four, then **More**, which
  opens the navbar's drawer with the rest. Five fit without More.
- **What's open:** the open page is the link whose path matches, or a path under it, or the page given to
  `setActive()`. A link's `dot` shows on its tab.
- **Clicks** go through the link's `onClick` and the site's `onNavigate`, so single-page sites keep their routing.
- **Keeping out of the way:** the bar shows under 760 px only. It steps aside while the keyboard is up or a panel is
  open. `html.ov-has-appbar` and `--ovnav-appbar-h` keep the page's last line above it.

Pick the places people go every visit: the home or feed, search, what is theirs (messages, saved, their page), and
the site's main verb (go live, post, ask). Settings and the rest live in More.

## Search, on every site

The navbar has a magnifier on every site. `/` or Ctrl+K opens it too. The first time someone asks, the navbar loads
`search.js` (about 17 KB), so pages that are never searched pay nothing.

What it does:
- **Before typing:** the site's own pages, and what you searched before on this device.
- **While typing:** suggestions from OpenVibe.Search for every site, this site's results first. They are anonymous, and
  the older request is cancelled when you type on.
- **Always offered:** the site's own search page (when it has one), "Search all of OpenVibe" and "Ask Vibe".
- **Keys:** arrows move, Enter opens, Escape closes.
- **Layout:** a phone gets the whole screen; a computer gets a panel near the top.

```js
OpenVibeNavbar.init({ …, search: { owner: 'live', label: 'OpenVibe.Live', page: '/search' } })   // or search: false
OpenVibeNavbar.openSearch('seattle')                     // open it from anything on the page
OpenVibeSearch.suggest('sea', { owner: 'live' })          // the same suggestions for a page's own box
```

The suggestions come through OpenVibe.Network: `GET https://openvibe.network/api/frame/suggest?q=&owner=&limit=`
asks OpenVibe.Search's `GET /api/v1/suggest` and keeps answers for 30 seconds. A site's Content-Security-Policy
already lets the navbar reach `openvibe.network`, so a site needs nothing new in its `connect-src`.

Both paths answer any origin (anonymous, never with credentials). So the same suggestions work from anyone's page:
pass `{ url: 'https://search.openvibe.network/api/v1/suggest' }` where your `connect-src` allows Search itself. The
SDK has them too: `openvibe-sdk/search`'s `search.suggest(text, { owner, type, limit })` and
`search.query(text, { owner, type })`.

## Loading

`loading.js` is the network's one loading look, on Live's player and anywhere something takes a moment. It covers
what is loading edge to edge, with no card:
- the thing's own picture behind it, blurred and drifting (a stream's latest frame, a video's poster);
- a thin turning ring around a soft dot;
- one word of status, and one quiet line under it;
- a two-pixel line along the bottom that fills step by step, or sweeps while the progress is unknown.

When it's slow, a hint and its actions appear. When it fails, it says what happened and offers Retry. When it's done,
it fades away.

```js
const l = OpenVibeLoading.mount(playerEl, { poster: stream.thumbnail_url, label: 'Connecting', sub: 'Getting your viewer ready', steps: 5 })
l.update({ step: 2, label: 'Opening secure link', sub: 'Almost there' })
l.slow({ hint: 'This is taking longer than usual.', actions: [{ label: 'Try again', onClick }, { label: 'Copy details', onClick }] })
l.fail({ title: 'Could not connect', detail: 'The stream stopped answering.', actions: [{ label: 'Retry', onClick }] })
l.done()
OpenVibeLoading.skeleton(listEl, { rows: 3 })            // shimmering rows while a list loads → .done()
```

The element it mounts into should be positioned. Motion stops under `prefers-reduced-motion`, and the status is
announced to screen readers (`role=status`, or `alert` when it fails).

## Using it

**An OpenVibe site (Node, server-rendered):**

```js
const kit = require('openvibe-shared/kit');
const serve = require('openvibe-shared/serve');
// <link rel="stylesheet" href="${serve.url('kit.css')}">  <script src="${serve.url('kit-web.js')}" defer></script>
res.send(layout({ body: kit.head({ title: 'Rooms', actions: [kit.iconButton({ href: '/rooms?new=1', icon: 'plus', label: 'Start a room' })] })
    + kit.list(rooms.map((r) => kit.row({ href: `/r/${r.slug}`, mark: kit.mark({ name: r.name }), title: r.name, sub: r.topic }))) }));
```

**A site that draws its own pages (Live's single-page app):** load `/shared/kit.js` and `/shared/kit-web.js`, and call
the same builders on `window.OpenVibeKit`. After inserting markup, call `OpenVibeKit.enhance(container)`.

**An app built on the OpenVibe SDK:** the Frame (`openvibe-sdk/frame`) loads the kit with the navbar and footer:
`mountFrame({ …, kit: true, appBar: true })` in the page, or `frameTags({ …, kit: true })` for a server-rendered
page. The files come from openvibe.network's copy of this release.

**Anyone else's project:** install the release (`"openvibe-shared": "https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v4.20.0"`)
and serve `kit.css`, `kit-web.js` (and `kit.js` to build in the page) from it, or copy the files: they need nothing
else. Without OpenVibe's theme,
set the `--bg-*`, `--text-*` and `--accent` variables yourself, or keep the fallbacks.

## Seeing it

`node scripts/kit-gallery.js > gallery.html` writes one page with every piece and the app bar on.
`node scripts/kit-gallery.js --shots <dir>` serves the package folder and screenshots it at 390, 768 and 1280 px. It
prints any sideways scroll, so the gallery doubles as the visual test.
