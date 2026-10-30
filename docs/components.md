# OpenVibe components (`openvibe-shared/components`, 4.42.0)

The kit's components as a **contract that is not HTML**. The web draws them with kit.js today; an Android or iOS app
draws the same components with its own views (Jetpack Compose, SwiftUI). That is how an OpenVibe app can be a real
native app and not a web page in a frame (the owner, 2026-10-29). Colours and sizes come from
[OpenVibe Tokens](tokens.md); this file adds what each component *is*.

```js
const components = require('openvibe-shared/components');   // in a page: /shared/components.js → OpenVibeComponents
components.SPECS          // [{ id, name, summary, role, anatomy, props, variants, states, a11y, layout, native, web }]
components.get('card')    // one spec
components.validate(doc)  // a kit document → { ok, errors }
components.render(doc)    // → HTML through kit.js (an invalid document throws)
components.PREAMBLE       // what the native reference views share: { compose, swiftui }
```

## A component's spec

| Field | What it says |
| --- | --- |
| `summary`, `role` | What it is for, and its accessibility role (a link, a region named by its heading, a disclosure…) |
| `anatomy` | Its parts and the tokens each wears: `{ part: 'title', tokens: { color: 'color.text.primary', weight: 'type.weight.bold' } }`. Every token named exists in OpenVibe Tokens (tested) |
| `props` | Typed: `string`, `text`, `url` (https or same-site only), `boolean`, `number`, `icon`, one of a list, `link` ({ href, label }), `count`, `stats`, `tabs`; `required` where it is |
| `variants`, `states` | e.g. a button's `primary` / `quiet` / `danger`; default, hover, pressed, focused, disabled; a list's empty and loading |
| `a11y` | Its name, its keys, its touch target (44 px) |
| `layout` | How it behaves on a phone, a tablet and a computer |
| `web` | The kit.js builder that draws it |
| `native.compose`, `native.swiftui` | A reference view built on the same tokens: Material 3 roles from the theme's colour scheme and `OvScale` in Compose; `OvTokens` (the theme's enum) and `OvScale` in SwiftUI. Every name they use exists in the generated theme files (tested) |

The components are button, card, rail, row, list, section, fold, tabs, numbers (stats), notice and empty state.

## Kit documents (server-driven UI)

A screen can be sent as data: a tree of `{ type, props, children }`. The web renders it with `components.render`; a
native app renders the same document with its own views, so a server can change a screen without a release. This is
the pattern of Airbnb's Ghost Platform and Yandex's DivKit, on the kit's own components.

```json
{ "type": "section", "props": { "title": "Right now" }, "children": [
    { "type": "rail", "props": { "id": "now", "title": "Live", "more": { "href": "/live", "label": "See all" } }, "children": [
        { "type": "card", "props": { "href": "/c/1", "title": "Night walk", "type": "stream", "live": true, "who": "goosely" } } ] } ] }
```

`validate` is strict:
- only known types and props;
- typed values, with enums and required props;
- only the children a component takes (a rail takes cards, a list takes rows, sections and folds take anything);
- at most 8 levels, 400 nodes and 60 children;
- strings of at most 2,000 characters;
- links that are https or same-site.

`render` refuses an invalid document and goes through kit.js, which escapes every text. A document from anywhere
therefore renders safely, and it renders exactly as the direct builder calls would (tested).

## Native

`components.PREAMBLE.compose` and `.swiftui` hold what an app adds once: the kinds (`OvKind`…) and, on iOS, which
theme's tokens it wears (`typealias OvTokens = VibeDarkTokens`). The theme files themselves come from
`openvibe.design/tokens` (OpenVibe Tokens' Compose and SwiftUI targets), and the scales are `OvScale` in both.
OpenVibe.Design's `/components` page shows every component's spec, its web rendering and its Android and iOS views.

Status: the reference views follow the Compose Material 3 and SwiftUI APIs, and they are **compiled** now:
`scripts/native-check.js` writes the preamble and every view out as Kotlin and Swift, and the native CI job
(`.github/workflows/native.yml`) compiles the Kotlin with kotlinc against the Compose runtime and UI artifacts and
type-checks the Swift with swiftc against SwiftUI. A view that does not compile fails the build.
