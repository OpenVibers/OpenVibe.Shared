# OpenVibe Tokens (`openvibe-shared/tokens`, 4.40.0)

A theme on the network is a map of CSS custom properties (`--bg-primary`, `--accent`, …) that theme-loader.js paints
on every site. OpenVibe Tokens is the same theme as a **platform-neutral design-token document** in the
[W3C Design Tokens (DTCG)](https://www.designtokens.org/) format. That one document compiles to the web, Android,
iOS, Flutter and Figma, so a native OpenVibe app wears exactly the theme a person picked on the web, without a web
view.

```js
const tokens = require('openvibe-shared/tokens');          // in a page: /shared/tokens.js → window.OpenVibeTokens
const doc = tokens.fromTheme(theme);                        // { name, slug, mode, variables } → DTCG document
tokens.toTheme(doc);                                        // and back, with the network's CSS names
tokens.compile(doc, 'compose');                             // one theme
tokens.compile([darkDoc, lightDoc], 'swiftui');             // a theme's two halves in one file
tokens.fileName(doc, 'swiftui');                            // "VibeTheme.swift"
tokens.TARGETS;                                             // [{ id, label, ext, lang }]
tokens.flatten(doc);                                        // [{ path, type, value, description }]
```

## The tokens

Colours are semantic, named for what they do rather than for a CSS property.

| Token | The network's CSS name | What it is for |
| --- | --- | --- |
| `color.bg.base` · `surface` · `subtle` · `raised` · `hover` · `input` | `--bg-primary` · `--bg-secondary` · `--bg-tertiary` · `--bg-card` · `--bg-hover` · `--bg-input` | The page, bands, wells, cards, hover, fields |
| `color.text.primary` · `secondary` · `muted` | `--text-primary` · `--text-secondary` · `--text-muted` | Body, supporting text, hints |
| `color.accent.base` · `light` · `dark` · `strong` · `on` · `onStrong` · `glow` | `--accent` … `--on-accent-strong`, `--accent-glow` | Links and focus; filled buttons and their text |
| `color.line.base` · `strong` | `--border` · `--border-light` | Dividers; outlines that must show |
| `color.status.{ok,warn,bad,info,live}.base` · `.text` | `--success` / `--success-text` … `--live-red` / `--live-red-text` | Fills, and text that reads on every surface |
| `shadow.base` · `large` | `--shadow` · `--shadow-lg` | Cards and menus; dialogs |

The kit's scales are the same on every theme:

- `radius.sm` · `md` · `lg` · `pill`
- `space.xs` … `xxl` (4–32)
- `size.tap` (44), `size.icon`, `size.avatar`
- `type.family.base` · `mono`
- `type.size.caption` … `display`
- `type.weight.*`
- `motion.duration.fast` · `base` · `slow`
- `motion.easing.standard`

## Targets

| Target | What you get |
| --- | --- |
| `css` | `--ov-color-bg-base: …` and the rest, plus the network's own names as aliases (`--bg-primary: var(--ov-color-bg-base)`) and `color-scheme`. A pair writes one block per `[data-theme-mode]` |
| `tailwind` | A `tailwind.config.js` whose colours, radii, spacing and shadows point at the CSS variables, so switching between light and dark needs no rebuild |
| `compose` | `object <Name>Tokens { val ColorBgBase = Color(0xFF0A0F1C) … val RadiusMd = 14.dp … }` and a Material 3 `darkColorScheme(…)`/`lightColorScheme(…)`: `MaterialTheme(colorScheme = VibeDarkColorScheme) { … }` |
| `swiftui` | `public enum <Name>Tokens { static let colorScheme: ColorScheme; static let colorBgBase = Color(.sRGB, …); static let radiusMd: CGFloat … }` |
| `flutter` | `class <Name>Tokens { static const colorBgBase = Color(0xFF…) … }` and a `ColorScheme(brightness: …)` |
| `figma` | A variables collection with one mode per document (`color/bg/base` → `{ r, g, b, a }` per mode), for import with a Figma variables plugin or the REST API |
| `json` | The DTCG document, or `{ dark, light }` for a pair |

## Safety

The tokens come from themes people write in the studio, and the output is code that developers paste into apps. So
nothing is passed through unchecked:

- A colour must be `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()` or `rgba()` with channels of 0–255; named colours are
  refused.
- A shadow must be offsets, a blur, an optional spread and such a colour.
- Any other value is dropped.
- Names become identifiers of letters and digits only (`T` in front of a leading digit; `Theme` when nothing is left).
- Descriptions appear only inside one-line comments, with newlines and `*/` removed.
- A Compose package name that is not a valid Kotlin package falls back to `network.openvibe.theme`.

`test/tokens.test.js` round-trips all 50 built-in themes, compiles every target, and feeds in a theme whose name and
values try to inject code.

Status: the generated Kotlin, Swift and Dart are checked against the Compose Material 3, SwiftUI and Flutter APIs by
review and by the tests' expected lines. The Kotlin and the Swift are also **compiled** now: `scripts/native-check.js`
writes the generated sources out, and the native CI job (`.github/workflows/native.yml`) compiles the Kotlin with
kotlinc against the Compose runtime and UI artifacts and type-checks the Swift with swiftc against SwiftUI. The Dart
still has no toolchain here.

## Comfort settings (4.45.0)

A theme says what the network looks like; comfort settings say how it should read for this person, on every site and
on top of any theme. They are display preferences (`OpenVibeThemeLoader.display.set({ contrast: 'more' })`), saved on the
device and on the account:

| Setting | Values | What changes |
|---|---|---|
| `contrast` | `normal`, `more` | secondary and muted text and the borders toward the text colour; links in running text underlined; thicker focus rings |
| `font` | `default`, `readable` | Atkinson Hyperlegible or Verdana or Tahoma, with more letter, word and line spacing |
| `colors` | `default`, `cb-safe` | success, warning and danger in Okabe-Ito blue, yellow and vermillion (light and dark halves) |
| `oled` | `off`, `on` | true black backgrounds when the theme is dark |

A native app reads the same object from `GET /api/themes/me/active` (`display`) and applies the same rules to its own
tokens: the settings are data, not CSS.

## Why this shape (native apps, not web views)

The owner, 2026-10-29: "translate it to official and optimized Android and iOS apps in the future that aren't just web
browser reskin kiosks." A native app needs:

- the person's theme as values its own UI toolkit understands (Compose `ColorScheme`, SwiftUI `Color`), not a
  stylesheet;
- the kit's scales (tap size, radii, spacing, type, motion) as numbers;
- one source of truth.

Today's CSS names stay as they are (every site keeps working), and they are aliases of the semantic tokens. The kit's
components get the same treatment next: specs by anatomy, states and roles, plus JSON documents that native renderers
can draw. See DESIGN-OVERHAUL-PLAN.md, pillars B and E.
