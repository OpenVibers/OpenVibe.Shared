# Forms: OpenVibe's own select and controls

`ov-forms.js` and `ov-forms.css` (4.109.0) give every OpenVibe site one look for form controls in place of the
browser's defaults. The owner asked for this on 2026-11-03: "a custom system for those select inputs … shared across
the network and all websites rather than using default stuff … with mobile, desktop, etc. device specific support".

## What a site gets with no work

The navbar loads both files once the page settles, for any page with a `select`, a checkbox, a radio, a slider or a
file input. It loads them then, or the first time one appears.

- **Every `<select>`** becomes a button that opens OpenVibe's own list:
  - on a computer, a menu under the button (or above it, when there is more room there);
  - on a phone (up to 640 px, or a touch screen up to 900 px), a sheet from the bottom with rows a finger tall, a
    title, a scrim, and a head you drag down to close.
- **The hidden `<select>` still holds the value.**
  - A form posts what it posted before.
  - `select.value = …`, `selectedIndex` and `change` listeners keep working.
  - A choice fires `input` and `change`.
  - With no script, the page has its plain select.
- **Checkboxes, radios, sliders and progress bars** take the site's accent.
- **`<input type="checkbox" role="switch">`** is a switch.
- **A file input's button** is a button.

None of these change a size: every rule is `:where()`, so a site's own rule always wins.

## Saying more about a choice

```html
<select name="agent" data-ov-title="Fallback agent">
  <option value="">None</option>
  <option value="codex" data-state="ok" data-badge="20% used"
          data-desc="ChatGPT plan · signed in on ada-laptop">Codex</option>
  <option value="aider" disabled data-state="off" data-desc="Not installed"
          data-href="/agents#aider" data-href-label="Install">Aider</option>
</select>
```

| On `<option>` | What it draws |
|---|---|
| `data-desc` | a second line under the label |
| `data-badge` | a short tag on the right, toned by `data-state` |
| `data-state` | `ok`, `warn`, `bad`, `off` or `new`: a dot before the label, and the badge's colour |
| `data-icon` | one or two characters before the label (an emoji, a letter) |
| `data-href`, `data-href-label` | a link on the row ("Set up", "Sign in"). A disabled option keeps it, so a choice that is not ready says how to make it ready. |

| On `<select>` | |
|---|---|
| `data-ov-search="on"` / `"off"` | a search box (on by itself from 9 choices) |
| `data-ov-title` | the phone sheet's title (otherwise the select's label) |
| `data-placeholder` | the button's words when nothing is chosen (a multiple select) |
| `multiple` | rows with boxes; the list stays open, and the button says "a, c" or "3 chosen" |
| `size="5"` | stays the browser's list box: it is already a list on the page |
| `data-ov-native` | stays the browser's own (also on any ancestor) |

Groups (`<optgroup>`) are headings in the list. A `required` select left empty marks its button and takes the focus:
the browser cannot point its bubble at a hidden control.

## The keyboard

| Key | On the closed button | In the open list |
|---|---|---|
| Enter, Space, ↓ | opens the list | Enter or Space chooses |
| ↑ | opens it at the last choice | moves up |
| ↓ | | moves down |
| Home, End, PageUp, PageDown | | move |
| A letter | jumps to the next choice that starts with it | searches, or jumps when there is no search box |
| Escape | | closes it and gives the focus back |
| Tab | | closes it |

The list is a `listbox` with `aria-activedescendant`. The button is named by the select's own label.

## Opting in to the full field look

```html
<div class="ov-field">
  <label for="key">API key</label>
  <input id="key" name="key" autocomplete="off">
  <p class="ov-field-hint">Stored sealed; never shown again.</p>
  <p class="ov-field-error" hidden>That key was refused.</p>
</div>
<div class="ov-choices">
  <label class="ov-choice"><input type="radio" name="h" value="codex">
    <span class="ov-choice-body"><b class="ov-choice-title">Codex</b><span class="ov-choice-desc">Your ChatGPT plan</span></span>
    <span class="ov-sel-badge is-ok">Ready</span></label>
</div>
```

- `.ov-field`: a label, a control 44 px tall (16 px text on a touch screen, so a phone does not zoom), a hint and an
  error. A select inside it is as tall as its text inputs.
- `.ov-input`: the same look on one input.
- `.ov-choices` / `.ov-choice`: choices drawn as cards, with the checked one outlined in the accent.

## Turning it off

- **For a site:** `<html data-ov-forms="off">`, or `navbar.init({ forms: false })`.
- **For a part of a page, or one control:** `data-ov-native`.
- **To avoid the late paint:** a site that wants the look before first paint links `/shared/ov-forms.css` in its
  `<head>`; the navbar then adds only the script.

## The API

- `OVForms.enhance(root)`: enhances the selects under `root`. New markup is also found by itself.
- `OVForms.refresh(select)`: reads a select again.
- `OVForms.open(select)` and `OVForms.close()`: open or close its list.

## Tests

`test/ov-forms-chrome.test.js` runs in headless Chrome and checks:
- the menu, and the keyboard skipping a disabled choice;
- the badge and the setup link;
- a script that sets the value;
- search and groups;
- a multiple select;
- that the form posts the values;
- an empty required select;
- markup added later;
- the switch;
- on a phone, the sheet and its 44 px rows, with no page overflow.
