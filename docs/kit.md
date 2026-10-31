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
- **`search.js`**: the OpenVibe menu (search, every site, every tool) behind the orb beside the brand, loaded on first use.
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
│ navbar (sticky)              │  OpenVibe Frame: brand + menu orb, balances, bell, account
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
          meta: kit.when(ts).text, metaIso: kit.when(ts).iso, sub, unread, trail, rel: 'nofollow ugc' })
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
kit.stats([[1234, 'messages this week'], [48, 'people chatting', '/people']])   // zero and unknown values are left out; a third item makes the whole tile a link (never underlined)
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

### Cards and rails (4.28.0)

```js
kit.card({ href, title, type, ratio, image, alt, video, badge, live, corner, peek, who, whoHtml, avatar, sub, preview,
           count: [1832, 'views'], when, level, save: { href }, remind: { href }, share, more: [items] })
kit.rail({ id, title, more: { href, label }, items: [kit.card(…), …], size: 's' | 'm' | 'l', wrap }))
```

One card for every kind of thing (plan 2026-10-28 §3.4):

| Part | What it does |
| --- | --- |
| Media | In the type's shape (`kit.CARD_RATIO`): 16:9 streams, clips, runs, maps, cams, events; 1:1 memes, shoes, listings, deals; 4:3 reports, themes, games; 2:1 domains. `ratio` overrides it. Without a picture, the type's icon on a wash of the room's accent |
| Badge | Top left, one word: NEW, −24 %, WR. `live: true` draws LIVE with a pulse |
| Corner | Bottom right: a length or a price |
| Peek | One line over the media on hover or focus |
| Preview | `video`: a muted loop while the card is hovered. Computers only, never under reduced motion, and the file loads only then |
| Text preview | `preview` (4.39.0): for a thing whose text is the point (a code paste, a note), its first nine lines drawn in the media instead of the icon. A picture wins |
| Title | Two lines at most. The card is one link: the title's, stretched over it |
| Sub | `sub` (4.39.0): one plain muted line under the title: a city and a kind, a language. Not a badge, and not only on hover |
| Meta | Who (with their picture or letters), one count, when. A count of 0 or none is left out, never shown as 0. `whoHtml` shows the name as markup you escaped (with its Inventory decorations); `who` stays the plain name for the letters |
| ⋯ | Save and Remind when given, and Share always (the system share sheet, else the link copied, said in the item) |

A rail scrolls sideways and snaps:

| Screen | How it looks |
| --- | --- |
| Phone | About 1.2 cards show, and the row bleeds to the screen's edge (the page keeps a 16 px gutter) |
| Wider | 190 px (`s`), 280 px (`m`) or 400 px (`l`) cards |
| Pointer | ‹ › buttons, each hidden at its end |
| `wrap: true` (4.39.0) | Phones still swipe; from 760 px every item shows in a grid (220 px columns, 160 for `s`, 320 for `l`), with no arrows and no kit-web.js. For a front page that shows a handful of things and links to the rest |

The rail's See all, tab pills and a list's heading link are 44 px tall on touch screens and below 760 px.

A card's menu inside a rail is placed on the screen, so the scroller never clips it. An empty rail is `''`.

Cards, rails and a room's accent are drawn by `room.css` (4.29.1), loaded after `kit.css` on the pages that use them, so a page with only the kit's controls does not pay for them.

### Rooms (4.28.0)

`require('openvibe-shared/rooms')` (`window.OpenVibeRooms`) holds the fourteen rooms. Each has a neighbourhood, a host,
a hero line, an icon, a motif and an accent: a dark value (AA on `#0B0D12`) and a light value (AA on white).

Put `rooms.style(id)` on the room's wrapper with the class `ov-room`. Its pieces then use these, in the right one for
the theme's mode:

| Property | Use |
| --- | --- |
| `--room-accent` | Icons, outlines, motifs |
| `--room-strong` | Text on the page |
| `--room-fill`, `--room-on` | A filled button and its text |

`sc.room()` does this for a front door.

### Kit 2: data and tool pages (4.36.0)

The first kit was built for apps you live in: a conversation, a list, your settings. Most OpenVibe pages are something
else: a price over time, a leaderboard, a table of plans, a picture to read, a few steps to verify a domain. Before
4.36 every site drew those itself, about 10-90 KB of its own CSS each, and no two looked alike. Kit 2 is those pieces,
built under the same rules as the rest of the kit: plain HTML that works without JavaScript, escaped text, the theme's
tokens, and phone first. `node scripts/kit-gallery.js --shots <dir> --kit2` draws every piece at 320, 390, 768 and 1280
px wide, light and dark.

Kit 2 is two files of its own, served at `/shared/` like the rest: **`kit-data.css`** (load it after `kit.css`) and
**`kit-data-web.js`** (the chart readout, scatter labels and drop zones; steps, tables, rankings, meters and receipts need
no script). A page that draws none of them loads neither, so `kit.css` and `kit-web.js` weigh what they did before
Kit 2 (split in 4.37.0).

```html
<link rel="stylesheet" href="${ovServe.url('kit.css')}">
<link rel="stylesheet" href="${ovServe.url('kit-data.css')}">
<script src="${ovServe.url('kit-data-web.js')}" defer></script>
```

| Builder | What it is for | On a phone |
| --- | --- | --- |
| `steps({ items, current })` | A flow of a few steps: opt in, verify, choose, live. Done steps link back; later ones never link ahead. | Dots joined by a line, and "Step 2 of 4 · Verify the domain" |
| `table({ columns, rows, caption })` | Plans, endpoints, prices: anything you compare across columns. | Each row is a card: the `primary` column is its title, and every other cell names its column |
| `chart({ type, series \| points, x, y })` | `line` and `area` (history: a price, a count, a rating over time), `bar` (one bar per day or kind), `scatter` (quality against cost, with a dashed `frontier` through the best points) | The same chart, with its words at their real size |
| `rank({ items, base, fmt })` | A leaderboard: the place, the name, the value ± its interval, the change since last time, and a bar in proportion | The bar runs under the name |
| `meter({ value, max, tone })` | How full something is. `tone: 'auto'` for use of a limit (amber from 75 %, red from 90 %). Without a tone, more is simply more (a confidence) | |
| `drop({ name, accept, camera, auto })` | Where a file goes: a real file input, plus drag and drop, paste and the phone's camera (kit-web.js). `auto` sends the form when a file is chosen | A "Take a photo" button |
| `receipt({ title, body, facts, actions })` | A result and what it took: the answer first, then one quiet line of facts (model, cost, time, confidence, what is kept) | The facts wrap |
| `page({ head, body, side, dock })` | The whole shape of an app page in one call; `side` sits beside the content from 1024 px and under it below that | |
| `num(v, fmt)` | Numbers the way a reader wants them: `'money'` ($12.50, $0.10, $0.027), `'compact'` (1.2M), `'percent'`, `'ms'` (840 ms, 2.4 s), `'int'`. A missing value is "–", never 0 | |

```js
const kit = require('openvibe-shared/kit');
kit.chart({ type: 'line', title: 'Price over 90 days', x: { time: true }, y: { fmt: 'money', zero: false },
    series: [{ name: 'Price', points: rows.map((r) => [r.seen_at, r.price]) }] });
kit.rank({ base: 900, fmt: 'int', items: models.map((m) => ({ name: m.name, href: `/m/${m.id}`, value: m.elo, interval: m.ci, delta: m.moved })) });
kit.steps({ current: 1, items: [{ label: 'Opt in', href: '/merchant' }, { label: 'Verify the domain' }, { label: 'Live' }] });
```

How the charts are drawn, so they read on a phone: the lines and areas are an SVG stretched to the box
(`preserveAspectRatio="none"`, and the stroke keeps its width with `vector-effect`), while every tick label, legend,
point and bar is real HTML placed by percent. Text stays its real size from 320 px to 1280 px, points and bars are
focusable and say their values, ticks fall on round numbers (1, 2 or 5 × 10ⁿ) and on round moments (hours, days, weeks,
months), and a table with the same numbers sits behind each chart for screen readers. kit-data-web.js adds the readout on
lines and areas (under the pointer, a tap, or ← → Home End) and hides a scatter label that would sit on one already
shown, best points first. Colours: `--ovk-c1` is the theme's accent, then `--ovk-c2` … `--ovk-c5` (cyan, amber,
violet, green), with deeper tones in light themes.

### The tool frame (4.55.0)

A tool page has one job: a person types or drops something in and gets an answer. Before 4.55 every OpenVibe tool drew
its own page. A whois lookup had a centred cyan icon over a wall of sibling-tool chips, the JSON tools were purple, and
the converters orange. On a phone the box you type in was often below the first screen. The tool frame puts every
tool page in the same order:

1. **The head.** A crumb back to the family ("Network tools ›"), the tool's name, and one sentence saying what it does.
   The icon tile carries the family's tint; nothing else does.
2. **The box.** A big field (17 px, so phones do not zoom in), its clear button, and the tool's one button: under the
   field on a phone, beside it from 600 px. Under the box are two or three real **Try** examples; a tap fills the box
   and runs the tool.
3. **The answer**, when there is one. It shows labelled rows with the fact that matters marked ("in 10 months"), then
   the **next step**: watch it for changes, look up the same name's DNS, compress the picture just made. A tool that
   finds something wrong says what and where (`tone: 'bad'`).
4. **The family.** The other tools of the same kind. On a phone they are one row that scrolls sideways, with short
   names; from 1024 px they are a column beside the tool, with full names and the open tool marked.
5. **The folds**, closed: About, the questions, "Use it from code". Their text stays in the page for search engines.
6. **People also use**: a short list.

Buttons and links keep the site's own accent, so a tool looks like the site it is on.

| Builder | What it draws |
| --- | --- |
| `toolHead({ icon, iconHtml, hue, family, crumb: { href, label }, title, task, facts, level })` | The head. `hue` is the family's tint (0–360); without it, a hue is hashed from `family` or the crumb, so a family always gets the same one. `facts` (4.56.0) is the tool's terms in one short line: what it costs, where the work happens, its limits and how long a file is kept (`['Free', 'Runs in your browser: nothing is uploaded', 'Files up to 50 MB']`). Say them from the tool's real configuration, never from a guess |
| `toolInput({ name, label, placeholder, value, button, icon, type, inputmode, action, method, hidden, tries })` | The box as a GET form (`?q=…` runs the tool without JavaScript); `tries: { items: [{ value, label }] }` adds the examples |
| `tries({ name, items, target, run })` | Examples for a box the page draws itself (an editor, a box outside a form): `target` is its selector, and `run` is the button to press when there is no form |
| `answer({ title, badge, actions, rows: [[label, value, note]], body, next, tone })` | The answer. A value can be `{ html }`; a note is a pill (`'1 year ago'`, or `{ text, tone: 'warn' }`); `aria-live` announces it when it arrives |
| `family({ title, more: { href, label }, items: [{ href, label, short, current }] })` | The family row or column |
| `tool({ head, input, answer, family, folds, related })` | All of it, in order. `input` is any markup: `toolInput`, `drop`, or a `textarea.ovk-tool-editor` with its button. The answer slot `.ovk-tool-out` is always there (hidden while empty), so a page that draws its answer in the browser fills it |

```js
const kit = require('openvibe-shared/kit');
kit.tool({
    head: kit.toolHead({ icon: 'globe', family: 'network', crumb: { href: '/network', label: 'Network tools' },
        title: 'Whois Lookup', task: 'Who registered a domain, when it was made and when it runs out.' }),
    input: kit.toolInput({ name: 'q', label: 'Domain or IP address', placeholder: 'example.com or 1.1.1.1', button: 'Look up',
        inputmode: 'url', tries: { items: [{ value: 'openvibe.network' }, { value: '1.1.1.1' }] } }),
    answer: result ? kit.answer({ title: result.domain, badge: { text: 'Registered', tone: 'ok' },
        rows: [['Registrar', result.registrar], ['Expires', result.expires, { text: result.expiresIn, tone: 'warn' }]],
        next: [kit.button({ href: watchUrl, label: 'Watch for changes', icon: 'bell', kind: 'quiet', small: true })] }) : '',
    family: kit.family({ title: 'Network tools', more: { href: '/network', label: 'All 22' }, items }),
    folds: [kit.fold({ title: 'About Whois Lookup', body }), kit.fold({ title: 'Use it from code', meta: 'API', body: kit.snippet({ code }) })],
    related: kit.list(rows, { title: 'People also use' }),
});
```

The frame is part of Kit 2: its look is in `kit-data.css` and its behaviour (the clear button and the examples) in
`kit-data-web.js`. A page that draws no tool loads neither, so `kit.css` and `kit-web.js` weigh what they did.

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
3. **Search is the orb beside the brand**, not a link: `search: { owner, label, page }` points it at the site's own
   results and search page.
4. **"What shipped" lives in the footer** (Updates), which every site has.
5. **The account menu holds the person's things** (dashboard, settings, admin), and the OpenVibe menu holds the other
   sites.
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
- **Signed in:** the balances fold into one pill under 560 px that always shows **both**, OpenCoins and Vibes (4.25.0;
  a tap lists them in full). Under 440 px the pill tightens; under 350 px the site's word gives way to the mark so the
  balances keep their icons.
- **The menu's orb** stays beside the brand at every width.
- **Spacing:** under 400 px the bar's padding, gaps, picture and buttons tighten.
- **Reading down a phone** (under 760 px), the bar steps away and comes back on the first scroll up. It never does
  with one of its menus open or focus inside it. `autoHide: false` keeps it.
- **The account menu** is a sheet the width of the screen under 560 px. Its tiles never leave one alone on a row.

**Messages** (4.25.0): a site with messages puts them beside the bell instead of a bubble over the page.

```js
OpenVibeNavbar.init({ …, messages: { onOpen: () => openInbox(), href: '/messages' } })   // href without onOpen: a link
OpenVibeNavbar.setMessages(3)                                                             // the unread count (0 hides it)
```

**Routers get paths** (4.25.0): `onNavigate(path, event)` receives `/@name?tab=x#y` for a link on this site, never a
full address. The account menu's "My channel" is `https://openvibe.live/@name` on every site, and Live's router once
put it under `/`.

`test/navbar-phone-fit-chrome.test.js` measures the bar from 320 to 430 px, signed in and out.

## The hero's visual

`sc.hero()` draws a visual beside the words (4.26.0):
- **The aura:** the site's mark in turning rings. A hero gets it with nothing to pass.
- **The orbit:** `orbit: { center, inner, outer }` puts the site's own places around the mark, linked and named.
- **Opting out and overriding:** `visual: false` keeps a hero plain, and an `aside` of your own takes the slot instead.
- **On a phone:** the orbit sits small above the words, and the aura faintly in the corner.

## The mark

The OpenVibe mark is **the Pair** (4.59.0; the owner chose "Pair, halo" from OpenVibe Mark Systems on 2026-10-31): a
ring O in blue (`#4f7cff`) and a round V in violet (`#8b5cf6`), with a gap of the ground around the V where it crosses
the ring. The gap is a mask, so the mark sits on any ground: a photo, a gradient, a light or a dark theme.
- **Geometry:** the V is exactly as tall as the O, and the mark is centred in its box, so it sits level beside a word
  and centred in a tile. One set of numbers, drawn by `openvibe-shared/mark` (static SVG for servers, icons, share
  cards and downloads) and by `ov-mark.js` (the browser drop-in); `test/mark.test.js` holds them together.
- **Forms:** the pair, and the heavy (thicker strokes) at 22 px wide and under, where the pair's gap would close. The
  form follows `data-size`, or set `data-form="pair|heavy"`.
- **Boxes:** square by default (`data-size` is its width and height); `data-wide` hugs the mark (94 × 57), for a
  mark beside a name: the navbar uses `data-size="34" data-wide`, the footer `38`.
- **Tones:** brand by default; `data-tone="ink"` (the text colour, for stamps and UI) or `"white"` (on a colour tile).
- **Motion, all of it meaning something and none of it a spin:**
  - the intro: the O pops in and the V grows out of its point; hover: the V leans back and the O hops;
  - a page on its way (the navbar's mark): the ring empties and draws itself round again at this site's usual pace,
    the V nods while it waits and hops when the page is here (`OVMark.navStart()` / `navEnd()` for single-page apps);
    a known progress (`data-progress`, island.js) draws the ring to its level;
  - the states (`data-state`): busy (the V bobs, the O breathes), ok (the V becomes a tick, green; the tick only ever
    means done), error (the V becomes "!", red, and it shakes), no (a "×", grey), notify (a dot pops up by the V),
    live (the O is the record light, ripples go out), sleep (the O closes like an eye).
  - otherwise it rests (the motion budget), and never moves under either reduced-motion setting.
- **Variants:** each site keeps its own pace (`data-variant`); Live, VIP, Tips, Deals and Coupons carry a light in
  the O (Live's is the red record light).
- **The season:** the O is a pumpkin with its stem and leaf in October, and wears caps of snow in December.
- **The names** beside it are set in the brand face, Nunito (`ov-brand.woff2`, served at `/shared/ov-brand.woff2`,
  SIL OFL; Latin, 700–900): the navbar's site name, the footer's brand, the site switcher and the share cards.
- **App icons, favicons and share cards** draw the same mark (`app-icon.js`, `scripts/build-icons.js`,
  `scripts/build-social-cards.js`); the loading screen (`loading.js`) shows it at work, and its V turns into "!" when
  loading fails.

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

## The OpenVibe menu: search, every site, every tool

One control on every site: the orb beside the brand (or `/`, or Ctrl+K) opens the OpenVibe menu. It used to be two
panels doing the same job, the launcher's dots (every site) and the magnifier (search).

**The orb** (4.25.0; the owner: "the little diamond thing… an icon that has cool animations and effects… next to the
logo"): nine dots set as a diamond, the centre in the accent.
- **Hovered:** a ripple runs out from the centre and the dots take the accent's colours.
- **While the menu loads:** the dots wave.
- **While it is open:** the diamond turns into an × that closes it.
- **At rest it doesn't move**, and reduced motion turns all of it off. The owner, 2026-10-28:
"combine… a better hierarchy… use this user's history… autocomplete… maybe use tabs". The navbar loads `search.js` the
first time someone asks, so a page nobody searches pays nothing (and the navbar itself got 15 KB lighter).

**Before typing**, three tabs:

| Tab | What it shows |
| --- | --- |
| For you | **Jump back in**: the places this person went lately anywhere on OpenVibe (their Network history, signed in). **On this site**: the site's own pages as chips. **Recent searches** (this device, can be cleared). **Your sites**: the sites they use most, or, for a guest, the most used across OpenVibe (the Frame's analytics ranking). |
| Sites | Every open site by what people come to do (the Frame's groups), the one you are on marked. The phone drawer's "All sites" opens this tab. |
| Tools | **Your tools** (from their history), **Most used on OpenVibe** (the Frame's analytics), the tool families, and every tool. |

**Typing** makes one ranked list:
1. **Go to**: sites, tool families and tools whose *name* matches. Tools the person used before come first.
2. **On this site**: OpenVibe.Search's results for this site, and its matching pages.
3. **Your history**: pages they visited whose title matches.
4. **Across OpenVibe**: the rest of Search's suggestions, the sites they use most first.
5. **Tools for it**: tools whose description mentions it.
6. **Your searches**, then **Search**: this site's own search page, all of OpenVibe, and Ask Vibe.

The box also completes what you type, from your searches, your history, the sites and this site's pages. The
completion shows faintly behind the text; Tab or → takes it.

**Keys:** arrows move, Enter opens, Escape closes.

**Layout:** opened from the orb, the menu drops from it under the bar. On a computer it is a panel from the orb's side, with
the keys listed at its foot. On a phone it is a sheet as tall as its contents. Opened any other way, it is a centred
panel (a phone gets the whole screen).

```js
OpenVibeNavbar.init({ …, search: { owner: 'live', label: 'OpenVibe.Live', page: '/search' } })   // or search: false
OpenVibeNavbar.openSearch('seattle')                     // open it on a search
OpenVibeNavbar.openMenu('sites')                         // or on a tab: 'you' | 'sites' | 'tools'
OpenVibeSearch.suggest('sea', { owner: 'live' })          // the same suggestions for a page's own box
```

**Where the data comes from:**

| Data | Source |
| --- | --- |
| Suggestions | OpenVibe.Network's `GET https://openvibe.network/api/frame/suggest?q=&owner=&limit=`, which asks OpenVibe.Search's `GET /api/v1/suggest` and keeps answers 30 s. |
| History | `GET https://openvibe.network/api/history?limit=60` with the person's own token, read once per opening and kept two minutes. Anonymous sessions keep none. |
| Sites and the ranking | The Frame (`/api/frame`, which the navbar already holds). |
| Tools | `https://openvibe.network/api/catalog.json`, kept 30 minutes. |

Every one of those is on `openvibe.network`, which every site's Content-Security-Policy already allows, so a site
needs nothing new in its `connect-src`.

Search answers any origin (anonymous, never with credentials), so the same suggestions work from anyone's page. Pass
`{ url: 'https://search.openvibe.network/api/v1/suggest' }` where your `connect-src` allows Search itself. The SDK
has them too: `openvibe-sdk/search`'s `search.suggest(text, { owner, type, limit })` and
`search.query(text, { owner, type })`.

## The account menu

Pressing your picture opens a compact menu (4.23.0; the owner: "a lot of this is just not even really needed… a plus
button… better use of icons… compactness… data-driven"):

- **The header:** your picture and name (both open your profile). Beside them, **+** (add another account), the
  **gear** (account and settings) and **sign out**. Other accounts, and Anonymous where the switcher runs, are a row of
  small pills under the name.
- **Your places:** a grid of icons, four across, with the site's own items first (`menu.before` / `menu.after`) and then
  My channel, History, Ask Vibe, Work together and Admin. Notifications appear only where the bar has no bell. The
  grid shows eight; the rest are under **More**.
- **The order follows use:** a place opened twice moves up. It is counted on this device only, in `ov-menu-use`, and
  never sent anywhere.
- **One row at the foot:** Light, Dark, Auto, text size, animations and themes. Guests find the same controls at the
  foot of the phone drawer.

A site's items can carry `short` (the grid's label: `{ label: 'Streamer setup', short: 'Setup' }`). `menu.sections`
still render as their own rows.

## Home page heroes (showcase)

**`sc.apps({ title, lede, groups: [{ name, items: [{ icon, name, text, href }] }], more })`** (4.38.0) shows a set of
apps as a launcher, the way a phone's home screen does: icon tiles three or four to a row with the name under the icon
on a phone, rows with a one-line tagline from 600 px. Use it where a page lists sites or products to jump to (the
network's front door, /sites, a directory); it replaces a stack of feature cards, which on a phone is one screen per
four sites. Since 4.39.0 no tile sits alone on a row: a set of two to four (or eight, twelve…) gets a column count
that fills its rows; four tiles are four across on a phone, two by two from 600 px and four from 960 px.

`showcase.hero({ eyebrow, title, accent, lede, actions, note })` is the top of most product homes. On a phone (since
4.23.0):
- it starts right under the bar;
- the two buttons sit side by side;
- the numbers after it (`showcase.stats`) go three across, each with an optional `icon`.

Don't pass the site's own name as the eyebrow: it is left out, because the navbar's brand already says it. Use the
eyebrow for something worth reading first ("Free, nothing to install"), with `{ icon, text }` for an icon.

### Folds and phone rows (4.44.0)

A product home is "a taste and a door": on a phone it shows a little of everything and links to the rest. Two pieces
do most of that:

- `showcase.fold({ title: 'How it works', hint: 'four steps', html: showcase.steps({…}) + showcase.code({…}) })` for
  what is read once. The heading stays visible (and its id with it); the steps, facts or code open on a tap.
- `class="sc-row"` on a card list (`<ul class="my-cards sc-row">`) for anything with more than four cards: on a phone
  it is one sideways row with the next card peeking, so twenty listings cost one card's height and none is dropped.
  Small tiles set `style="--sc-row-w:46%"`.

Lists that are text (questions, chips, table rows) are cut on phones instead, with `nth-child` and a link to the whole
list; a closing call that repeats the hero, or a "find your way around" grid that repeats the nav, is left out.

### Scrolling on touch screens (4.47.1)

A finger drag must always move something. The rules every site follows:

- A short list flows in the page. It has no box of its own.
- A long or live list (chat, a transcript, chapters on a phone) keeps a box no taller than 60% of the screen
  (`max-height: min(60svh, 26rem)`) with `overscroll-behavior-y: auto`. At the box's end the drag carries on into
  the page. `contain` there traps the finger (openvibe.video's chapters, 10-29).
- Sheets, menus and dialogs keep `overscroll-behavior: contain` and lock the page behind them.
- A sideways row (`.sc-row`, `.ovk-tabs`, a site's own card strip) is `position: relative` as well as `overflow-x: auto`.
  Without that, a hidden label (`.sr-only`, `position: absolute`) inside a card past the edge is placed outside the
  row and widens the whole page: openvibe.coupons was 2208 px wide on a 390 px phone and search.openvibe.network
  3407 px.
- Decoration (a hero's watermark, a turning ring) stays inside its section, or the section sets `overflow-x: clip`.

Check a page with `document.documentElement.scrollWidth`, which must equal the screen width at 320, 360 and 390 px,
with and without touch.

## Balances

`wallet: true` (or a site's own `coins` and `vibes` chips) shows the balances as one calm pill on phones. Each balance
is a coloured icon and a plain number, with a hairline between them. Up to 440 px only the first balance shows, and a
tap lists them all. Computers get one chip per balance in the same style.

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
