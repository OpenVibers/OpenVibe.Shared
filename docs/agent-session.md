# Agent sessions (`agent-session.js`)

A coding agent's session, as people read it. It shows:
- what the agent said;
- the steps it took, grouped and folded, each with its command, change and output, live while the step runs;
- its helpers, nested;
- the hand-offs from one agent to the next;
- the plan it keeps;
- a summary that stays at the top.

It works the same for every agent OpenVibe.Codes runs: Claude Code, Codex, OpenCode, Command Code, Aider, DeepSeek,
OpenVibe.AI and your own model. They all reach it in one of the two shapes below.

The owner, 2026-10-28, showing the Claude app's session view, where a running command said "Output unavailable":
"OpenVibe.Codes should… actually show the output from the agent… more user friendly… handle that between all
agents… in a smart way… way better than this idea."

## Use

```html
<div id="session"></div>
<script src="/shared/agent-session.js"></script>
<script>
  const view = OpenVibeAgentSession.mount(document.getElementById('session'), { title: 'Fix the stats', status: 'running' });
  source.onmessage = (e) => view.push(JSON.parse(e.data));   // live lines
  view.pushAll(savedLines);                                   // or a finished session at once
  view.status('succeeded');                                   // queued | placed | running | succeeded | failed | cancelled | expired
</script>
```

**From Node:**
- `require('openvibe-shared/agent-session')` gives `normalize(event)`, which turns one stream-json event into lines.
- `kindOf(toolName)` returns the step's kind.
- `diffLines(a, b)` returns the line diff behind an edit's +/− counts.

## What it shows

**The head** stays in view:
- the state;
- the agents in order (Claude Code → Codex after a hand-off);
- the time, the steps and commands, the files changed with +/−, and the cost;
- the plan as one line ("Fixing the test · 2 of 4") that opens into the whole list.

**The feed:**
- **What it said:** light Markdown with paragraphs, lists, `code`, code blocks and https links. Nothing in a line ever
  becomes markup.
- **Steps:** steps in a row are one folded group ("1 command · 1 edit · 2 reads", or "Ran 2 commands"), showing +/− and
  a running, done or failed mark. A group of one is just the step.
  - **Inside a step:** the command, with Copy; the change as a coloured diff; the output, with Copy.
  - **While a step runs**, its output arrives as the agent prints it, and the row shows a timer.
  - **A failed step** opens by itself.
- **Helpers** (a Task step) show what they were asked, and their steps nest under them.
- **Hand-offs** read "Claude Code → Codex", with the reason under the agents.
- **Warnings and errors** appear as notes; the end is a card with the agent's last words.

**Filters:** Everything, What it said, Steps, Problems. **Follow** keeps the newest step in view.

**Layout:** phones get one scrolling row of filters, smaller code and the full width.

**Theme:** the colours come from the page's theme tokens, so it reads in light and dark.

**Links:** `mount(el, { link: (url) => … })` decides which https addresses in the agents' text become links; the rest
stay text. A site whose agents read untrusted pages should link only its own (Actor links only the person's desk).

## The shapes it reads

**1. Claude Code's stream-json**, the shape every Codes harness adapter emits. See OpenVibe.Codes' `harness/events.js`:
`system/init`, `assistant` text and `tool_use`, `user` `tool_result`, `system` warning/error/handoff/usage, and one
`result`. An event from a helper carries `parent_tool_use_id`. The harness adds `{ type: 'system', subtype:
'tool_progress', tool_use_id, text }` for output while a step runs, from agents whose steps the harness runs itself.

**2. Codes' job lines** (job protocol 1.1, additive to 1.0), one JSON object per line:

| Line | Meaning |
| --- | --- |
| `{ t: 'agent', agent, model }` | an agent started |
| `{ t: 'text', text, parent? }` | what it said |
| `{ t: 'tool', id, name, what, input?, parent? }` | a step began (Bash, Read, Edit, Write, Grep, Glob, LS, WebFetch, WebSearch, Task, TodoWrite, or any name: kinds come from its words) |
| `{ t: 'tool_progress', id, chunk }` | output while it runs |
| `{ t: 'tool_result', id, ok, output }` | how it ended |
| `{ t: 'handoff', from, to?, reason }` | one agent stopped and the next took over |
| `{ t: 'note', text, level? }` | a warning or an error |
| `{ t: 'step', text }` | the job's own progress: cloning, the branch, files changed, pushing |
| `{ t: 'usage', input_tokens, output_tokens }` | |
| `{ t: 'done', ok, text, duration_ms, cost_usd, turns }` | the end |

A line with `parent` belongs to the helper whose Task step has that id. Any line may carry `agent`; the head follows
who is working. `{ t: 'state', state }` moves the head.

**3. OpenVibe.Actor's task events** (`actor.task-event@1`, since 4.24.1):

| Event | Shown as |
| --- | --- |
| `{ kind: 'state' \| 'end', state }` | the head's state |
| `{ kind: 'output', step: 'plan', text }` | a quiet line |
| `{ kind: 'output', step: 'text', text, is_error? }` | what it said (an error as a note) |
| `{ kind: 'output', step: 'handoff', agent, text }` | a divider to `agent` |
| `{ kind: 'output', step: 'check', text }` | a note ("Checked…" is good news) |
| `{ kind: 'output', step: 'tool_call' \| 'tool_result', tool, input / text }` | steps, paired by tool |
