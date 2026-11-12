# The bottom of the screen (plan 279) and the page's end (plan 280)

The owner, 2026-11-10:

> "That fixed bottom position is kind of buggy … as you scroll up and down, so let's make that nice and smooth and
> perfect across all sites."

> "That huge wasted space … in between that and the footer … It's just waste."

## One measured number

A phone's visible viewport is not its layout viewport. The browser's toolbar slides away while the page scrolls, a
keyboard opens, an orientation turns; a bar placed at `bottom: 0` of the layout viewport is then behind the very
thing the person is looking at. `bottom.js` measures the difference and writes it where CSS can use it:

| variable | meaning |
|---|---|
| `--ovb-lift` | px between the layout viewport's bottom and the visible (visual) viewport's bottom; every bottom-docked part moves up by it with `translate` (a paint, never layout) |
| `--ovb-vh` | the visible viewport's height in px, measured — never a `100vh`/`100dvh` guess |
| `--ovb-bar` | the app bar's height while it is on screen (0 when it is away) |
| `--ovb-mini` | the small player's height plus its 8 px gap while it is the full-width bar on a phone |
| `--ovb-base` | `max(--ovb-bar, env(safe-area-inset-bottom))`: where the first docked part starts |
| `--ovb-dock` | `--ovb-base + --ovb-mini`: how far anything above all of them sits from the bottom edge |

`navbar.js` loads `bottom.js` on every page before the bar and the small player draw. Every rule that uses
these variables keeps its old value as the fallback, so a page that did not get `bottom.js` keeps the bar it had.

The parts move with `translate: 0 calc(-1 * var(--ovb-lift, 0px))`, never by changing `bottom` or `height` while the
person scrolls; `--ovb-bar`/`--ovb-mini` are measured from the elements themselves by a `ResizeObserver`, so a bar
that steps aside for the keyboard or a player that changes shape is followed without a guess.

## One stacking order

The bottom of the screen, low to high (these are the only z-indexes that belong to it; all of them live in
`bottom.js`):

| layer | class | z-index |
|---|---|---|
| the app bar | `.ovnav-appbar` | `--ovb-z-bar` (9990) |
| the small player | `.ovmini` | `--ovb-z-mini` (9991) |

Sheets (10060), the notification panel (99999) and toasts/notices
(2147483000+) sit above all of these and do not belong to the bottom stack.

## The page's end

Content ends, then **32 px on a computer (24 on a phone)**, then the footer. That gap is the footer's own
`margin-top` (`footer.js`); a site may not add its own bottom padding above it. The last block's bottom margin
collapses with the footer's, so it does not add — but a container's `padding-bottom` does, and is removed in the
site that has it.

`scripts/audit-page-end.js` measures the gap on every site's home at 390 and 1280 and lists every page over the rule:

```
node scripts/audit-page-end.js
node scripts/audit-page-end.js --footer-rule        # with the Shared rule applied (what is left for the sites)
node scripts/audit-page-end.js --hosts openvibe.wiki --width 390
```

## The check

`test/bottom-chrome.test.js` drives a real headless Chrome at 360×740, 390×844 and 430×932. It scrolls up and down
while a shimmed `visualViewport` opens and closes the toolbar (the layout viewport stays put, as a real toolbar's
update reaches the visible viewport first), and fails when:

- the app bar's bottom edge is more than 1 px from the visible viewport's bottom;
- the small player is not 8 px above the bar;
- any of the three overlaps another;
- a gap jumps by more than 1 px between samples.

```
ov test test/bottom-chrome.test.js
```
