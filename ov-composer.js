/**
 * ov-composer.js (openvibe-shared 4.201.0): one composer on every site. Ask 349, the owner: "how come on this composer
 * there's no file attaching system and all the other features … a better composer system unified across all sites …
 * moddable and fully customizable". ov-thread.js loads it for each thread.composer() form, and a site's own box joins
 * with OpenVibeComposer.enhance(form). The form's markup and its submit stay the site's; this adds:
 *   - files: the + menu, a paste, a drop; each one a chip above the box (a picture's thumbnail, the name and size, ×).
 *     A long paste becomes a text file, which you can put back in the box. Files go with the form (multipart); where a
 *     mod gives upload(file, onProgress), they go ahead of it, the chip shows the progress, and the form carries the ids;
 *   - "/" for commands (the site's, its mods', your own snippets) and "@" for mentions (the mods' sources);
 *   - voice, where the browser can listen; a draft kept per box until it is sent; Ctrl/⌘+B, I, E for bold, italic and
 *     code; the count near the box's limit;
 *   - your settings (what sends, voice, compact, your snippets), from "/settings" or the slash list's last row.
 *
 * 4.215.0, composer v2: OpenVibeComposer.mount(host, { preset: 'post' | 'chat' | 'agent' | 'comment', … }) draws a whole
 * composer (see mount() below); OpenVibeComposer.tool(id, spec) adds or replaces a tool module for every box.
 *
 * Mods (a site, or a script on it): OpenVibeComposer.mod({
 *   id, match(form) → bool,                         which boxes it joins (all when absent)
 *   tools: [{ id, label, path (24-unit path data), run(ctx) }],
 *   commands: [{ name, hint, insert } | { name, hint, run(ctx) }],
 *   mentions: { search(q) → Promise<[{ label, handle, sub, avatar, insert }]> },
 *   upload(file, onProgress) → Promise<{ id }>,      files go to the site's store before the send
 *   beforeSend(ctx) → false to hold the send })
 * ctx: { form, text, value, set(v), insert(s), files(), add(files), note(s), send() }.
 * A box its page sends by script (a chat, an agent's run): form.__ovc.files() → the files (File objects), uploads(): the
 * ids a mod's upload gave, clear() after the send (the text, the chips, the draft); a form 'reset' clears the same.
 * A site without script says the same in data: data-ovt-commands='[{"name","hint","insert"}]', data-ovc-max-files,
 * data-ovc-max-mb, data-ovc-no-draft.
 */
(function (root) {
    'use strict';
    if (root.OpenVibeComposer || typeof document === 'undefined') return;

    // 4.203.0: the composer carries its own look (it was in thread.css), so any box on any page gets it: the Dock's
    // Vibe and Code boxes included. Injected once, before the first box is joined.
    const CSS = `.ovt-composer { position: relative; display: grid; gap: 6px; max-width: 780px; margin: 0 auto; padding: 10px 12px; border: 1px solid var(--border, rgba(148,163,184,.18)); border-radius: 18px; background: var(--bg-card, #131c2e); color: var(--text-primary, #e6edf7); }
.ovt-composer textarea { width: 100%; min-height: 48px; box-sizing: border-box; padding: 6px 2px; border: 0; outline: 0; resize: vertical; background: transparent; color: inherit; font: inherit; }
.ovt-c-row { display: flex; align-items: center; gap: 8px; }
.ovt-c-tools { flex: 1; display: flex; align-items: center; gap: 6px; }
.ovt-send { min-height: 40px; padding: 0 14px; border: 0; border-radius: 12px; background: var(--accent, #3b82f6); color: var(--on-accent, #fff); font: inherit; font-weight: 650; cursor: pointer; }
.ovt-send:disabled { opacity: .5; }
.ovt-composer .ovc-file.ovc-image { height: auto; min-height: 100px; flex-wrap: wrap; overflow: visible; }
.ovt-composer .ovc-image input { flex: 1 0 100%; min-width: 0; min-height: 36px; box-sizing: border-box; border: 1px solid var(--border, rgba(148,163,184,.18)); border-radius: 8px; background: var(--bg-primary, #0b1220); color: inherit; font: inherit; }
.ovc-files { display: flex; gap: 8px; overflow-x: auto; padding: 2px 0 8px; margin: 0 0 2px -4px; scrollbar-width: thin; }
.ovc-files[hidden] { display: none; }
.ovc-file { position: relative; flex: none; display: flex; align-items: center; gap: 9px; max-width: 230px; height: 52px; padding: 5px 30px 5px 5px; box-sizing: border-box; border-radius: 14px;
    border: 1px solid var(--ovt-line, var(--border, rgba(148, 163, 184, .18))); background: color-mix(in srgb, var(--text-primary, #fff) 4%, transparent); overflow: hidden; animation: ovc-in .2s cubic-bezier(.2, .9, .3, 1) both; }
.ovc-file.is-bad { border-color: color-mix(in srgb, var(--live-red, #ef4444) 70%, transparent); }
.ovc-file.is-up::after { content: ""; position: absolute; left: 0; bottom: 0; height: 3px; width: calc(var(--p, 0) * 100%); background: var(--ovt-accent, var(--accent, #3b82f6)); transition: width .2s; }
.ovc-file-th { flex: none; width: 40px; height: 40px; border-radius: 10px; object-fit: cover; background: #0b1220; }
.ovc-file-ic { display: grid; place-items: center; background: color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 16%, transparent); color: var(--ovt-accent, var(--accent, #3b82f6)); font-size: 11px; font-weight: 750; letter-spacing: .02em; }
.ovc-file-t { min-width: 0; display: grid; line-height: 1.25; }
.ovc-file-n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; font-weight: 600; color: var(--text-primary, #e6edf7); }
.ovc-file-s { font-size: 12px; color: var(--text-muted, #7386a3); white-space: nowrap; }
.ovc-file.is-bad .ovc-file-s { color: var(--live-red, #ef4444); }
.ovc-file-x, .ovc-file-b { position: absolute; top: 4px; right: 4px; display: grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 8px; background: none; color: var(--text-secondary, #b4c0d4); cursor: pointer; }
.ovc-file-b { top: auto; bottom: 4px; }
.ovc-file-x:hover, .ovc-file-b:hover, .ovc-file-x:focus-visible, .ovc-file-b:focus-visible { background: var(--bg-hover, color-mix(in srgb, var(--text-primary, #fff) 10%, transparent)); color: var(--text-primary, #e6edf7); }
.ovc-file-x svg, .ovc-file-b svg { width: 15px; height: 15px; }
.ovc-dropping { border-color: var(--ovt-accent, var(--accent, #3b82f6)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 30%, transparent), 0 8px 30px rgba(0, 0, 0, .25); }
.ovc-dropping::before { content: "Drop to attach"; position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; border-radius: inherit; background: color-mix(in srgb, var(--bg-card, #131c2e) 86%, var(--ovt-accent, var(--accent, #3b82f6))); color: var(--text-primary, #e6edf7); font-weight: 650; pointer-events: none; }
.ovc-pop { position: absolute; z-index: 40; left: 6px; right: 6px; bottom: calc(100% + 8px); max-height: min(320px, 50vh); overflow: auto; padding: 6px; border-radius: 16px; border: 1px solid var(--ovt-line, var(--border, rgba(148, 163, 184, .18)));
    background: var(--bg-card, #131c2e); box-shadow: 0 18px 50px rgba(0, 0, 0, .35); animation: ovc-in .16s cubic-bezier(.2, .9, .3, 1) both; }
.ovt.is-start .ovc-pop { bottom: auto; top: calc(100% + 8px); }
.ovc-pop[hidden] { display: none; }
.ovc-pop-i { display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 6px 10px; box-sizing: border-box; border: 0; border-radius: 11px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ovc-pop-i[aria-selected="true"], .ovc-pop-i:hover { background: color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 14%, transparent); }
.ovc-pop-ic, .ovc-pop-av { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: var(--ovt-accent, var(--accent, #3b82f6)); background: color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 12%, transparent); object-fit: cover; }
.ovc-pop-av { border-radius: 50%; }
.ovc-pop-ic svg { width: 17px; height: 17px; }
.ovc-pop-t { min-width: 0; display: grid; line-height: 1.3; }
.ovc-pop-t b { font-weight: 650; font-size: 14px; color: var(--text-primary, #e6edf7); }
.ovc-pop-t span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; color: var(--text-muted, #7386a3); }
.ovc-pop-tag { font-size: 11px; font-weight: 650; padding: 2px 7px; border-radius: 999px; color: var(--ovt-accent, var(--accent, #3b82f6)); background: color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 12%, transparent); }
.ovc-mic[aria-pressed="true"] { color: var(--live-red, #ef4444); background: color-mix(in srgb, var(--live-red, #ef4444) 14%, transparent); animation: ovc-listen 1.4s ease-in-out infinite; }
.ovc-count { flex: none; font-size: 12px; font-variant-numeric: tabular-nums; color: var(--text-muted, #7386a3); }
.ovc-count.is-low { color: var(--live-red, #ef4444); }
.ovc-count[hidden] { display: none; }
.ovt-composer.ovc-compact { padding: 6px 8px 6px 12px; border-radius: 18px; }
.ovt-composer.ovc-compact .ovt-c-row { margin-top: 0; }
.ovt-composer.ovc-compact .ovt-btn, .ovt-composer.ovc-compact .ovt-send { width: 36px; min-width: 36px; height: 36px; }
@keyframes ovc-in { from { opacity: 0; transform: translateY(4px) scale(.98); } }
@keyframes ovc-listen { 50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--live-red, #ef4444) 18%, transparent); } }
html[data-ov-motion=off] .ovc-file, html[data-ov-motion=off] .ovc-pop, html[data-ov-motion=off] .ovc-mic { animation: none; }
.ovc-set { width: min(460px, calc(100vw - 24px)); max-height: min(640px, calc(100vh - 32px)); padding: 0; border: 1px solid var(--ovt-line, rgba(148, 163, 184, .2)); border-radius: 20px; background: var(--bg-card, #131c2e); color: var(--text-primary, #e6edf7); box-shadow: 0 30px 80px rgba(0, 0, 0, .5); }
.ovc-set::backdrop { background: rgba(2, 6, 14, .55); }
.ovc-set.ovc-set-in { width: auto; max-height: none; border: 0; border-radius: 0; background: none; box-shadow: none; }
.ovc-set-in .ovc-set-f { padding: 0; }
.ovc-set-f { display: grid; gap: 14px; padding: 6px 18px 18px; }
.ovc-set-h { display: flex; align-items: center; justify-content: space-between; margin: 0 -8px 0 0; font-size: 17px; }
.ovc-set-g { margin: 0; padding: 0; border: 0; display: grid; gap: 6px; }
.ovc-set-g legend { padding: 0 0 6px; font-weight: 650; font-size: 14px; }
.ovc-set label { display: flex; align-items: center; gap: 10px; min-height: 40px; font-size: 14.5px; cursor: pointer; }
.ovc-set small, .ovc-set-p { color: var(--text-muted, #7386a3); font-size: 12.5px; margin: 0; }
.ovc-set input[type=radio], .ovc-set input[type=checkbox] { width: 18px; height: 18px; accent-color: var(--accent, #3b82f6); }
.ovc-set-l { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.ovc-set-l li { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; padding: 4px 4px 4px 10px; border-radius: 10px; background: color-mix(in srgb, var(--text-primary, #fff) 4%, transparent); }
.ovc-set-l span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary, #b4c0d4); font-size: 13px; }
.ovc-set-add { display: grid; grid-template-columns: 110px 1fr auto; gap: 8px; align-items: start; }
.ovc-set-add input, .ovc-set-add textarea { box-sizing: border-box; width: 100%; padding: 9px 10px; border-radius: 10px; border: 1px solid var(--ovt-line, rgba(148, 163, 184, .25)); background: var(--bg-input, rgba(2, 6, 14, .35)); color: inherit; font: inherit; font-size: 14px; resize: vertical; }
.ovc-set-btn { height: 40px; padding: 0 14px; border: 0; border-radius: 12px; background: var(--accent, #3b82f6); color: var(--on-accent, #fff); font: inherit; font-weight: 650; cursor: pointer; }
@media (max-width: 480px) { .ovc-set-add { grid-template-columns: 1fr; } .ovc-file { max-width: 200px; } }
/* 4.205.0: the composer's own tool buttons and row on a page without thread.css (an agent's run, a card, any box), so it
   is the same composer everywhere. Where thread.css is loaded its rules are the same. */
.ovc .ovt-btn { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; border: 0; background: none; color: var(--text-secondary, #b4c0d4); cursor: pointer; text-decoration: none; }
.ovc .ovt-btn:hover, .ovc .ovt-btn:focus-visible { background: var(--bg-hover, color-mix(in srgb, var(--text-primary, #fff) 6%, transparent)); color: var(--text-primary, #e6edf7); }
.ovc .ovt-btn .ovt-ic, .ovc .ovt-btn svg { width: 22px; height: 22px; }
.ovc .ovt-c-row { display: flex; align-items: center; gap: 6px; }
.ovc .ovt-c-tools { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ovc .ovt-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
/* 4.215.0, composer v2 (the owner, 11-12: "super elegant … some kind of social media platform … shared in harmony across
   sites … feature rich … modular"). A mounted composer (OpenVibeComposer.mount) is .ovc-v2[data-preset=post|chat|agent|
   comment]: the person's picture beside a box that grows, the attachments as a strip (pictures as tiles you describe),
   one row of round tools, the option chips, the count ring and the send. */
.ovc-v2.ovt-composer { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; max-width: none; padding: 14px 14px 10px; border-radius: 22px; border: 1px solid var(--ovt-line, var(--border, rgba(148, 163, 184, .18))); background: var(--bg-card, #131c2e); transition: border-color .18s, box-shadow .18s; }
.ovc-v2.ovt-composer:focus-within { border-color: color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 55%, var(--ovt-line, rgba(148, 163, 184, .18))); box-shadow: 0 0 0 4px color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 14%, transparent); }
/* The full width is the words' (the owner, 11-12: "a big space on the left … use the full space"): the person's
   picture, their name and who sees it are one line above the box, as Threads and Bluesky compose. */
.ovc-v2 .ovc-head { display: flex; align-items: center; gap: 10px; min-width: 0; }
.ovc-v2 .ovc-av { flex: none; width: 36px; height: 36px; border-radius: 50%; object-fit: cover; background: color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 22%, var(--bg-card, #131c2e)); display: grid; place-items: center; color: var(--text-primary, #e6edf7); font-weight: 700; font-size: 15px; }
.ovc-v2 .ovc-head-n { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; font-size: 15px; color: var(--text-primary, #e6edf7); }
.ovc-v2 .ovc-body { min-width: 0; display: grid; gap: 8px; }
.ovc-v2 .ovc-body > * { min-width: 0; }
.ovc-v2 .ovc-files { max-width: 100%; }
.ovc-v2 textarea { display: block; width: 100%; min-height: 26px; max-height: 40vh; box-sizing: border-box; margin: 0; padding: 8px 2px 4px; border: 0; outline: 0; resize: none; overflow-y: auto; background: transparent; color: var(--text-primary, #e6edf7); font: inherit; font-size: 17px; line-height: 1.45; }
.ovc-v2 textarea::placeholder { color: var(--text-muted, #7386a3); }
.ovc-v2 .ovt-c-row { display: flex; align-items: center; gap: 4px; padding-top: 8px; border-top: 1px solid color-mix(in srgb, var(--ovt-line, rgba(148, 163, 184, .18)) 70%, transparent); }
.ovc-v2 .ovt-c-tools { flex: 1; min-width: 0; display: flex; align-items: center; gap: 2px; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
.ovc-v2 .ovt-c-tools::-webkit-scrollbar { display: none; }
.ovc-v2 .ovt-btn { position: relative; flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; border: 0; background: none; color: var(--ovt-accent, var(--accent-light, var(--accent, #60a5fa))); cursor: pointer; transition: background-color .15s, transform .12s; }
.ovc-v2 .ovt-btn:hover, .ovc-v2 .ovt-btn:focus-visible { background: color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 14%, transparent); }
.ovc-v2 .ovt-btn:active { transform: scale(.92); }
.ovc-v2 .ovt-btn svg { width: 21px; height: 21px; }
.ovc-v2 .ovt-btn input[type=file] { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.ovc-v2 .ovc-chips { display: flex; align-items: center; gap: 6px; flex: none; }
.ovc-v2 .ovc-head .ovc-chips { margin-left: auto; }
.ovc-chip { position: relative; display: inline-flex; align-items: center; gap: 6px; max-width: 160px; height: 32px; padding: 0 12px 0 10px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 45%, transparent); color: var(--ovt-accent, var(--accent-light, var(--accent, #60a5fa))); font-size: 13px; font-weight: 650; white-space: nowrap; cursor: pointer; }
.ovc-chip svg { flex: none; width: 15px; height: 15px; }
.ovc-chip-v { overflow: hidden; text-overflow: ellipsis; }
.ovc-chip select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; font: inherit; }
.ovc-chip:focus-within { box-shadow: 0 0 0 3px color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 30%, transparent); }
.ovc-ring { flex: none; width: 26px; height: 26px; margin: 0 4px; }
.ovc-ring circle { fill: none; stroke-width: 3; }
.ovc-ring .ovc-ring-bg { stroke: color-mix(in srgb, var(--text-primary, #fff) 12%, transparent); }
.ovc-ring .ovc-ring-fg { stroke: var(--ovt-accent, var(--accent, #3b82f6)); stroke-linecap: round; transition: stroke-dashoffset .15s, stroke .15s; }
.ovc-ring.is-near .ovc-ring-fg { stroke: #f59e0b; }
.ovc-ring.is-over .ovc-ring-fg { stroke: var(--live-red, #ef4444); }
.ovc-ring[hidden] { display: none; }
.ovc-v2 .ovt-send { flex: none; min-height: 38px; padding: 0 20px; border: 0; border-radius: 999px; background: var(--ovt-accent, var(--accent, #3b82f6)); color: var(--on-accent, #fff); font: inherit; font-weight: 700; font-size: 15px; cursor: pointer; transition: opacity .15s, transform .12s; }
.ovc-v2 .ovt-send:not(:disabled):active { transform: scale(.96); }
.ovc-v2 .ovt-send:disabled { opacity: .45; cursor: default; }
.ovc-v2 .ovt-send--round { display: grid; place-items: center; width: 40px; min-width: 40px; height: 40px; padding: 0; border-radius: 50%; }
.ovc-v2 .ovt-send--round svg { width: 19px; height: 19px; }
.ovc-cam { padding: 0; border: 0; border-radius: 22px; width: min(560px, 96vw); max-height: 94vh; overflow: hidden; background: #05070c; color: #fff; display: flex; flex-direction: column; }
.ovc-cam::backdrop { background: rgba(2, 6, 14, .72); }
.ovc-cam-stage { position: relative; flex: 1; min-height: 0; background: #000; }
.ovc-cam-v { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: #000; }
.ovc-cam.is-mirror .ovc-cam-v { transform: scaleX(-1); }
.ovc-cam-msg { position: absolute; inset: auto 14px 14px; margin: 0; padding: 10px 12px; border-radius: 12px; background: rgba(0, 0, 0, .72); font-size: 14px; line-height: 1.4; }
.ovc-cam-t { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); padding: 3px 10px; border-radius: 999px; background: #dc2626; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.ovc-cam-modes { display: flex; justify-content: center; gap: 4px; padding: 10px 0 0; }
.ovc-cam-modes button { min-height: 32px; padding: 0 14px; border: 0; border-radius: 999px; background: none; color: rgba(255, 255, 255, .7); font: 600 13px/1 inherit; letter-spacing: .04em; text-transform: uppercase; cursor: pointer; }
.ovc-cam-modes [aria-pressed="true"] { color: #fde047; }
.ovc-cam-bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 22px max(18px, env(safe-area-inset-bottom)); }
.ovc-cam-b { display: grid; place-items: center; width: 48px; height: 48px; border: 0; border-radius: 50%; background: rgba(255, 255, 255, .14); color: #fff; cursor: pointer; }
.ovc-cam-b svg { width: 22px; height: 22px; }
.ovc-cam-shutter { width: 72px; height: 72px; border-radius: 50%; border: 4px solid #fff; background: #fff; box-shadow: inset 0 0 0 4px #05070c; cursor: pointer; transition: transform var(--ov-dur-1, .12s) ease, background-color var(--ov-dur-2, .2s) ease; }
.ovc-cam-shutter:active { transform: scale(.94); }
.ovc-cam.is-video .ovc-cam-shutter { background: #dc2626; }
.ovc-cam.is-recording .ovc-cam-shutter { background: #dc2626; box-shadow: inset 0 0 0 20px #05070c; }
.ovc-cam.is-recording .ovc-cam-modes, .ovc-cam.is-recording [data-a="flip"] { visibility: hidden; }
@media (max-width: 600px) { .ovc-cam { width: 100vw; max-width: none; height: 100dvh; max-height: none; border-radius: 0; } .ovc-cam-v { height: 100%; aspect-ratio: auto; } }
html[data-ov-motion=off] .ovc-cam-shutter { transition: none; }
/* A failed upload: its own picture (or icon) becomes the Try again button; a post's tile says it in words. */
.ovc-file-r { position: absolute; left: 5px; top: 5px; width: 40px; height: 40px; display: grid; grid-auto-flow: column; place-content: center; align-items: center; gap: 6px; padding: 0; border: 0; border-radius: 10px; background: rgba(5, 7, 12, .66); color: #fff; font: 700 13px/1 inherit; cursor: pointer; }
.ovc-file-r svg { width: 18px; height: 18px; }
.ovc-file-r:hover, .ovc-file-r:focus-visible { background: rgba(5, 7, 12, .8); }
.ovc-file-r-t { display: none; }
.ovc-v2[data-preset=post] .ovc-file.ovc-image .ovc-file-r, .ovc-v2[data-preset=comment] .ovc-file.ovc-image .ovc-file-r { left: 0; top: 0; width: 100%; height: 150px; border-radius: 15px 15px 0 0; }
.ovc-v2[data-preset=post] .ovc-file.ovc-image .ovc-file-r-t, .ovc-v2[data-preset=comment] .ovc-file.ovc-image .ovc-file-r-t { display: inline; }
/* Post · Ask · Do (4.218.0) */
.ovc-v2 .ovc-verbs--head { margin-left: auto; margin-right: 0; }
.ovc-v2 .ovc-head .ovc-chips + .ovc-verbs--head { margin-left: 6px; }
.ovc-v2 .ovc-verbs { flex: none; display: inline-flex; gap: 2px; padding: 3px; margin-right: 4px; border-radius: 999px; background: color-mix(in srgb, var(--text-primary, #fff) 6%, transparent); }
.ovc-v2 .ovc-verb { display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 10px; border: 0; border-radius: 999px; background: none; color: var(--text-muted, #93a0b4); font: 600 13px/1 inherit; cursor: pointer; }
.ovc-v2 .ovc-verb svg { width: 15px; height: 15px; }
.ovc-v2 .ovc-verb[aria-pressed="true"] { background: var(--bg-card, #131c2e); color: var(--text-primary, #e6edf7); box-shadow: 0 1px 3px rgba(0, 0, 0, .3); }
.ovc-v2 .ovc-verb[data-verb="ask"][aria-pressed="true"] svg { color: #c084fc; }
.ovc-v2 .ovc-verb[data-verb="do"][aria-pressed="true"] svg { color: #fbbf24; }
@media (max-width: 520px) { .ovc-v2 .ovc-verb:not([aria-pressed="true"]) span { display: none; } .ovc-v2 .ovc-verb:not([aria-pressed="true"]) { width: 34px; padding: 0; justify-content: center; } }
.ovc-v2 .ovc-ask-chips { display: flex; gap: 6px; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.ovc-v2 .ovc-ask-chips::-webkit-scrollbar { display: none; }
.ovc-v2 .ovc-ask-chips > * { flex: none; }
.ovc-v2:not(.is-asking) .ovc-ask-chips { display: none; }
.ovc-v2[data-preset=chat] .ovc-ask-chips { grid-column: 1 / -1; }
.ovc-v2 .ovc-chip--btn { background: transparent; font-family: inherit; font-size: 13px; font-weight: 650; cursor: pointer; }
.ovc-v2 .ovc-chip--btn .ovc-chip-v { max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovc-v2 .ovc-chip--btn.is-on svg { color: var(--ovt-accent, var(--accent-light, #60a5fa)); }
.ovc-v2.is-asking { border-color: color-mix(in srgb, #a855f7 45%, var(--ovt-line, transparent)); }
.ovc-v2.is-asking[data-verb="do"] { border-color: color-mix(in srgb, #f59e0b 45%, var(--ovt-line, transparent)); }
.ovc-sheet { box-sizing: border-box; padding: 0; border: 1px solid var(--border, rgba(148, 163, 184, .2)); border-radius: 20px; width: min(520px, 94vw); max-height: 80vh; background: var(--bg-card, #131c2e); color: var(--text-primary, #e6edf7); overflow: hidden; display: flex; flex-direction: column; }
.ovc-sheet::backdrop { background: rgba(2, 6, 14, .6); }
.ovc-sheet-h { display: flex; align-items: center; justify-content: space-between; padding: 12px 10px 8px 18px; font-size: 16px; }
.ovc-sheet-b { overflow: auto; padding: 0 10px 14px; display: grid; gap: 4px; }
.ovc-sheet-find:focus { outline: none; border-color: var(--ovt-accent, var(--accent, #3b82f6)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 25%, transparent); }
.ovc-sheet-find { width: 100%; box-sizing: border-box; height: 42px; margin: 0 0 6px; padding: 0 14px; border: 1px solid var(--border, rgba(148, 163, 184, .2)); border-radius: 12px; background: var(--bg-primary, #0b0f19); color: inherit; font: inherit; font-size: 16px; }
.ovc-sheet h3 { margin: 12px 8px 4px; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted, #93a0b4); }
.ovc-sheet-note { margin: 8px; color: var(--text-muted, #93a0b4); font-size: 14px; }
.ovc-models { display: grid; gap: 2px; }
.ovc-model { display: flex; align-items: center; gap: 4px; }
.ovc-model[hidden] { display: none; }
.ovc-model-b { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 6px 10px; border: 0; border-radius: 12px; background: none; color: inherit; text-align: left; font: inherit; cursor: pointer; }
.ovc-model-b:hover, .ovc-model-b:focus-visible { background: color-mix(in srgb, var(--text-primary, #fff) 6%, transparent); }
.ovc-model-b[aria-pressed="true"] { background: color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 16%, transparent); }
.ovc-model-m { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; background: color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 20%, transparent); font-weight: 800; font-size: 14px; }
.ovc-model-t { min-width: 0; display: grid; }
.ovc-model-n { display: flex; align-items: center; gap: 6px; min-width: 0; }
.ovc-model-t b { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }
.ovc-model-t small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted, #93a0b4); font-size: 12.5px; }
.ovc-model-rec { flex: none; padding: 1px 7px; border-radius: 999px; background: color-mix(in srgb, #22c55e 18%, transparent); color: #86efac; font: 700 10.5px/1.6 inherit; font-style: normal; vertical-align: 2px; }
.ovc-model-x { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 10px; color: var(--text-muted, #93a0b4); }
.ovc-model-x:hover { color: var(--text-primary, #e6edf7); background: color-mix(in srgb, var(--text-primary, #fff) 6%, transparent); }
.ovc-model-x svg, .ovc-sheet-more svg { width: 16px; height: 16px; }
.ovc-sheet-more { display: inline-flex; align-items: center; gap: 6px; margin: 10px 8px 0; color: var(--ovt-accent, var(--accent-light, #60a5fa)); font-size: 14px; font-weight: 600; text-decoration: none; }
.ovc-src { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 6px 10px; border-radius: 12px; cursor: pointer; }
.ovc-src:hover { background: color-mix(in srgb, var(--text-primary, #fff) 5%, transparent); }
.ovc-src > svg { flex: none; width: 20px; height: 20px; color: var(--ovt-accent, var(--accent-light, #60a5fa)); }
.ovc-src > span { flex: 1; min-width: 0; display: grid; }
.ovc-src small { color: var(--text-muted, #93a0b4); font-size: 12.5px; }
.ovc-src input { flex: none; width: 20px; height: 20px; accent-color: var(--ovt-accent, var(--accent, #3b82f6)); }
@media (max-width: 600px) { .ovc-sheet { width: 100vw; max-width: none; margin: auto 0 0; border-radius: 22px 22px 0 0; max-height: 86vh; padding-bottom: env(safe-area-inset-bottom); } }
.ovc-answer { box-sizing: border-box; margin: 10px 0 0; padding: 12px 14px; border: 1px solid color-mix(in srgb, #a855f7 30%, var(--border, rgba(148, 163, 184, .2))); border-radius: 18px; background: color-mix(in srgb, #a855f7 6%, var(--bg-card, #131c2e)); color: var(--text-primary, #e6edf7); }
.ovc-answer header { display: flex; align-items: center; gap: 8px; }
.ovc-answer header > svg { width: 17px; height: 17px; color: #c084fc; }
.ovc-answer header small { color: var(--text-muted, #93a0b4); }
.ovc-answer header .ovc-bar-x { margin-left: auto; }
.ovc-answer-t { margin: 6px 0 0; white-space: pre-wrap; line-height: 1.5; font-size: 15px; }
.ovc-answer-t.is-waiting { color: var(--text-muted, #93a0b4); }
.ovc-answer-t.is-bad { color: #fca5a5; }
.ovc-cites { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 0; padding: 0; list-style: none; }
.ovc-cites a { display: inline-block; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 4px 10px; border-radius: 999px; background: color-mix(in srgb, var(--text-primary, #fff) 7%, transparent); color: var(--text-primary, #e6edf7); font-size: 12.5px; text-decoration: none; }
.ovc-answer footer { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.ovc-answer-a { min-height: 36px; padding: 0 14px; border: 1px solid var(--border, rgba(148, 163, 184, .22)); border-radius: 999px; background: none; color: var(--text-primary, #e6edf7); font: 600 13.5px/1 inherit; cursor: pointer; }
.ovc-answer-a:first-child { background: var(--ovt-accent, var(--accent, #3b82f6)); border-color: transparent; color: #fff; }
@media (pointer: coarse) { .ovc-answer-a { min-height: 44px; } }
.ovc-v2 .ovc-bar { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 4px 4px 4px 10px; border-radius: 12px; background: color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 14%, transparent); font-size: 13px; line-height: 1.3; }
.ovc-v2 .ovc-bar > svg { flex: none; width: 15px; height: 15px; color: var(--ovt-accent, var(--accent-light, #60a5fa)); }
.ovc-v2 .ovc-bar > b { flex: none; font-weight: 700; color: var(--text-primary, #e6edf7); }
.ovc-v2 .ovc-bar > span { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted, #93a0b4); }
.ovc-bar-x { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 50%; background: transparent; color: var(--text-muted, #93a0b4); cursor: pointer; }
.ovc-bar-x:hover, .ovc-bar-x:focus-visible { background: color-mix(in srgb, var(--text-primary, #fff) 10%, transparent); color: var(--text-primary, #e6edf7); }
.ovc-bar-x svg { width: 15px; height: 15px; }
@media (pointer: coarse) { .ovc-bar-x { width: 40px; height: 40px; } }
.ovc-v2.is-editing { box-shadow: 0 0 0 2px color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 45%, transparent); }
.ovc-v2.is-running .ovt-send { background: color-mix(in srgb, var(--text-primary, #fff) 14%, transparent); color: var(--text-primary, #e6edf7); }
.ovc-v2 .ovc-files { margin: 0; padding: 0 0 2px; }
.ovc-v2[data-preset=post] .ovc-file.ovc-image, .ovc-v2[data-preset=comment] .ovc-file.ovc-image { flex-direction: column; flex-wrap: nowrap; align-items: stretch; width: 150px; max-width: 150px; height: auto; padding: 0; border-radius: 16px; overflow: hidden; }
.ovc-v2[data-preset=post] .ovc-file.ovc-image .ovc-file-th, .ovc-v2[data-preset=comment] .ovc-file.ovc-image .ovc-file-th { width: 100%; height: 150px; border-radius: 15px 15px 0 0; }
.ovc-v2[data-preset=post] .ovc-file.ovc-image .ovc-file-t, .ovc-v2[data-preset=comment] .ovc-file.ovc-image .ovc-file-t { display: none; }
.ovc-v2[data-preset=post] .ovc-file.ovc-image input, .ovc-v2[data-preset=comment] .ovc-file.ovc-image input { flex: none; width: 100%; min-height: 38px; margin: 0; border: 0; border-top: 1px solid var(--ovt-line, rgba(148, 163, 184, .18)); border-radius: 0 0 15px 15px; padding: 8px 10px; background: transparent; font-size: 13px; }
.ovc-v2[data-preset=post] .ovc-file.ovc-image .ovc-file-x, .ovc-v2[data-preset=comment] .ovc-file.ovc-image .ovc-file-x { top: 6px; right: 6px; background: rgba(0, 0, 0, .6); color: #fff; border-radius: 50%; }
.ovc-v2 .ovc-note { margin: 6px 0 0; font-size: 13px; color: var(--text-muted, #7386a3); }
.ovc-v2 .ovc-note:empty { display: none; }
.ovc-v2.is-busy { opacity: .8; }
/* chat: one line that grows, the tools beside it, the send round. */
.ovc-v2[data-preset=chat].ovt-composer { padding: 6px 6px 6px 10px; border-radius: 26px; }
.ovc-v2[data-preset=chat] .ovc-body { grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 4px; }
.ovc-v2[data-preset=chat] .ovc-files, .ovc-v2[data-preset=chat] .ovc-bar { grid-column: 1 / -1; }   /* a line of their own above the one-line box */
.ovc-v2[data-preset=chat] textarea { font-size: 16px; padding: 9px 2px; }
.ovc-v2[data-preset=chat] .ovt-c-row { padding: 0; border: 0; }
.ovc-v2[data-preset=chat] .ovt-c-tools { flex: none; }
/* agent: a roomy box, tools left, the mode chip and the round send right. */
.ovc-v2[data-preset=agent] textarea { min-height: 52px; font-size: 16px; }
/* comment: small, the picture smaller. */
.ovc-v2[data-preset=comment].ovt-composer { padding: 10px 12px 8px; border-radius: 18px; }
.ovc-v2[data-preset=comment] .ovc-av { width: 28px; height: 28px; font-size: 12px; }
.ovc-v2[data-preset=comment] .ovc-head-n { font-size: 14px; }
.ovc-v2[data-preset=comment] textarea { font-size: 15px; }
/* Emoji: a small panel above the box. */
.ovc-emoji { position: absolute; z-index: 41; left: 8px; bottom: calc(100% + 8px); display: grid; grid-template-columns: repeat(8, 38px); gap: 2px; max-width: calc(100% - 16px); max-height: 232px; overflow: auto; padding: 8px; border-radius: 16px; border: 1px solid var(--ovt-line, rgba(148, 163, 184, .18)); background: var(--bg-card, #131c2e); box-shadow: 0 18px 50px rgba(0, 0, 0, .35); animation: ovc-in .16s cubic-bezier(.2, .9, .3, 1) both; }
.ovc-emoji[hidden] { display: none; }
.ovc-repo { position: absolute; z-index: 41; left: 8px; right: 8px; bottom: calc(100% + 8px); display: grid; gap: 6px; max-width: 520px; max-height: min(420px, 60vh); padding: 10px; border-radius: 16px; border: 1px solid var(--ovt-line, rgba(148, 163, 184, .18)); background: var(--bg-card, #131c2e); box-shadow: 0 18px 50px rgba(0, 0, 0, .35); animation: ovc-in .16s cubic-bezier(.2, .9, .3, 1) both; }
.ovc-repo[hidden] { display: none; }
.ovc-repo-q { width: 100%; box-sizing: border-box; min-height: 42px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--ovt-line, rgba(148, 163, 184, .22)); background: var(--bg-primary, rgba(0, 0, 0, .2)); color: inherit; font: inherit; font-size: 15px; outline: 0; }
.ovc-repo-q:focus-visible { border-color: var(--ovt-accent, var(--accent, #3b82f6)); }
.ovc-repo-list { display: grid; gap: 2px; overflow-y: auto; overscroll-behavior: contain; min-height: 0; }
.ovc-repo-list:empty { display: none; }
.ovc-repo-row { display: flex; align-items: flex-start; gap: 10px; width: 100%; min-height: 52px; padding: 8px; border: 0; border-radius: 12px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ovc-repo-row:hover, .ovc-repo-row:focus-visible { background: color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 12%, transparent); outline: 0; }
.ovc-repo-av { flex: none; width: 32px; height: 32px; border-radius: 9px; object-fit: cover; display: grid; place-items: center; background: color-mix(in srgb, currentColor 8%, transparent); }
.ovc-repo-av svg { width: 18px; height: 18px; }
.ovc-repo-t { min-width: 0; display: grid; gap: 1px; }
.ovc-repo-t b { font-size: 14px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ovc-repo-t small { font-size: 12.5px; color: var(--text-secondary, #a8b3c4); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.ovc-repo-t i { font-style: normal; font-size: 11.5px; color: var(--text-muted, #93a0b4); }
.ovc-repo-note { margin: 2px 4px; font-size: 12.5px; color: var(--text-muted, #93a0b4); }
.ovc-repo-note[hidden] { display: none; }
html[data-ov-motion=off] .ovc-repo { animation: none; }
.ovc-emoji button { width: 38px; height: 38px; border: 0; border-radius: 10px; background: none; font-size: 22px; line-height: 1; cursor: pointer; }
.ovc-emoji button:hover, .ovc-emoji button:focus-visible { background: color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 14%, transparent); }
@media (max-width: 480px) { .ovc-v2.ovt-composer { padding: 12px 12px 8px; } .ovc-emoji { grid-template-columns: repeat(7, 38px); } .ovc-v2 .ovt-send { padding: 0 16px; } }
html[data-ov-motion=off] .ovc-emoji { animation: none; }

/* 4.223.0: the + sheet, the mic first, the examples' fade, the round send. */
.ovc-v2, form.ovc[data-ovc-contain] { container: ovc / inline-size; }
.ovc-more[aria-expanded="true"] { background: color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 18%, transparent); }
.ovc-more svg { transition: transform .25s cubic-bezier(.3, 1.4, .4, 1); }
.ovc-more[aria-expanded="true"] svg { transform: rotate(45deg); }
@container ovc (max-width: 460px) {
  .ovt-c-tools > .ovt-btn:not(.ovc-mic):not(.ovc-more) ~ .ovt-btn:not(.ovc-mic):not(.ovc-more):not([aria-pressed="true"]) { display: none; }
}
.ovc-tray { grid-column: 1 / -1; flex: 1 0 100%; width: 100%; box-sizing: border-box; margin-top: 8px; padding: 8px 0 2px; border-top: 1px solid var(--border, rgba(148,163,184,.14)); animation: ovc-tray-in .22s cubic-bezier(.2, .9, .3, 1.15) both; }
.ovc-tray-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 4px; }
.ovc-tray-i { all: unset; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 10px 4px 8px; border-radius: 14px; cursor: pointer; text-align: center; -webkit-tap-highlight-color: transparent; }
.ovc-tray-ic { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 15px; color: var(--ovt-accent, var(--accent-light, var(--accent, #60a5fa)));
  background: linear-gradient(150deg, color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 30%, transparent), color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 12%, transparent));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ovt-accent, var(--accent, #3b82f6)) 30%, transparent); transition: transform .2s cubic-bezier(.3, 1.4, .4, 1); }
.ovc-tray-ic svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.ovc-tray-t { font-family: 'OV Brand', Nunito, Inter, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; font-weight: 800; line-height: 1.2; color: var(--text-primary, #e6edf7); text-wrap: balance; }
.ovc-tray-i:active .ovc-tray-ic { transform: scale(.92); }
.ovc-tray-i:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
@media (hover: hover) and (pointer: fine) { .ovc-tray-i:hover { background: color-mix(in srgb, var(--text-primary, #e6edf7) 6%, transparent); } .ovc-tray-i:hover .ovc-tray-ic { transform: translateY(-2px); } }
@keyframes ovc-tray-in { from { opacity: 0; transform: translateY(8px) scale(.98); } }
html[data-ov-motion=reduced] .ovc-tray { animation-name: ovc-fade-calm; }
@keyframes ovc-fade-calm { from { opacity: 0; } }
html[data-ov-motion=off] .ovc-tray, html[data-ov-motion=off] .ovc-more svg { animation: none; transition: none; }
.ovc textarea::placeholder, .ovt-composer textarea::placeholder { transition: opacity .25s ease; }
.ovc textarea.ovc-ph-swap::placeholder, .ovt-composer textarea.ovc-ph-swap::placeholder { opacity: 0; }
.ovc-v2 .ovt-send--round { background: linear-gradient(150deg, color-mix(in srgb, var(--accent, #3b82f6) 85%, #fff), var(--accent-strong, var(--accent, #2563eb))); color: var(--on-accent-strong, #fff);
  box-shadow: 0 6px 18px -6px color-mix(in srgb, var(--accent, #3b82f6) 70%, transparent); transition: transform .2s cubic-bezier(.3, 1.4, .4, 1), opacity .2s, box-shadow .2s; }
.ovc-v2 .ovt-send--round svg { width: 20px; height: 20px; stroke-width: 2.3; }
.ovc-v2 .ovt-send--round:disabled { opacity: 1; background: color-mix(in srgb, var(--text-primary, #e6edf7) 9%, transparent); color: var(--text-muted, #7386a3); box-shadow: none; }
.ovc-v2 .ovt-send--round:not(:disabled):active { transform: scale(.9); }
`;
    function styles() { if (document.getElementById('ovc-styles')) return; const st = document.createElement('style'); st.id = 'ovc-styles'; st.textContent = CSS; document.head.appendChild(st); }
    const mods = [];
    // 4.202.0: your settings open in the one window (ov-window.js: a sheet on a phone, swiped down to close), loaded
    // from beside this file; without it, a plain <dialog>.
    const COMPOSER_REV = { 'ov-window.js': 'd3d8f9e3e6d2', 'ov-capture.js': '91f3b2cb25e3' };
    const selfSrc = (document.currentScript && document.currentScript.src) || '';
    function needWindow() {
        return new Promise((ok) => {
            if (root.OVWindow) return ok(root.OVWindow);
            const m = /^(https?:\/\/[^?#]*\/)ov-composer(?:\.[0-9a-f]{6,})?\.js(?:[?#]|$)/.exec(selfSrc);
            if (!m) return ok(null);
            const sc = document.createElement('script');
            sc.src = m[1] + 'ov-window.js' + (COMPOSER_REV['ov-window.js'] ? '?v=' + COMPOSER_REV['ov-window.js'] : '');
            sc.onload = () => ok(root.OVWindow || null); sc.onerror = () => ok(null);
            document.head.appendChild(sc);
        });
    }
    // 4.217.0: the camera button opens the shared capture core (ov-capture.js, OVCapture), loaded from beside this file.
    function needCapture() {
        return new Promise((ok) => {
            if (root.OVCapture && root.OVCapture.version >= 2) return ok(root.OVCapture);
            const m = /^(https?:\/\/[^?#]*\/)ov-composer(?:\.[0-9a-f]{6,})?\.js(?:[?#]|$)/.exec(selfSrc);
            if (!m) return ok(root.OVCapture || null);
            const sc = document.createElement('script');
            sc.src = m[1] + 'ov-capture.js' + (COMPOSER_REV['ov-capture.js'] ? '?v=' + COMPOSER_REV['ov-capture.js'] : '');
            sc.onload = () => ok(root.OVCapture || null); sc.onerror = () => ok(null);
            document.head.appendChild(sc);
        });
    }
    // 4.217.0: a picture bigger than the box wants (data-ovc-resize, the long side in pixels; mount(): 2560, an agent's
    // 1568 as the agents portal sent them) is made smaller here before it uploads. GIFs and SVGs are left alone.
    async function shrink(file, max) {
        if (!max || !/^image\/(jpeg|png|webp)$/.test(file.type || '') || typeof createImageBitmap !== 'function') return file;
        let bmp = null;
        try { bmp = await createImageBitmap(file); } catch { return file; }
        const long = Math.max(bmp.width, bmp.height);
        if (long <= max) { if (bmp.close) bmp.close(); return file; }
        const k = max / long, w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
        if (bmp.close) bmp.close();
        const blob = await new Promise((r) => canvas.toBlob(r, file.type, 0.9));
        if (!blob || blob.size >= file.size) return file;
        try { return new File([blob], file.name, { type: file.type, lastModified: file.lastModified }); } catch { return file; }
    }
    const live = new Set();
    const PREFS_KEY = 'ov:composer';
    const DEFAULTS = { send_key: 'enter', voice: true, density: 'comfy', snippets: [] };
    const PATH_OK = /^[MmLlHhVvCcSsQqTtAaZz0-9 ,.\-]{1,2000}$/;
    const Speech = root.SpeechRecognition || root.webkitSpeechRecognition || null;
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    const IC = {
        mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21',
        plus: 'M12 5v14M5 12h14',
        timer: 'M12 4.5a8.2 8.2 0 1 1 0 16.4 8.2 8.2 0 0 1 0-16.4zM12 8.6v4.2l2.7 1.7M9.6 2.6h4.8',
        // A repository: a branch from one commit to two (the registry's git-branch; no company's mark).
        repo: 'M6.5 4.5v15M17.5 10a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zM6.5 21.8a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zM17.5 10c0 4.5-4 6.2-11 6.6',
        star: 'M12 4.2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z',
        up: 'M12 19V5.5M6.2 11.2L12 5.4l5.8 5.8',
        x: 'M7 7l10 10M17 7L7 17',
        file: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5',
        slash: 'M15 4L9 20',
        at: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1',
        gear: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7',
        back: 'M9 14l-5-5 5-5M4 9h11a5 5 0 0 1 0 10h-3',
        photo: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01',
        clip: 'M20 11.5l-8.3 8.3a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9',
        smile: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
        globe: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM3 12h18M12 3c2.5 2.7 3.6 5.7 3.6 9s-1.1 6.3-3.6 9c-2.5-2.7-3.6-5.7-3.6-9S9.5 5.7 12 3z',
        spark: 'M12 3l1.9 5.1 5.1 1.9-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
        send: 'M5 12h14M13 6l6 6-6 6',
        stop: 'M7 7h10v10H7z',
        cpu: 'M8 8h8v8H8zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3',
        gauge: 'M5 18a8 8 0 1 1 14 0M12 14l3-4',
        reply: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z',
        pen: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
        check: 'M5 12.5l4.5 4.5L19 7',
        camera: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 10a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z',
        flip: 'M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2M20 4v4h-4M4 20v-4h4',
        retry: 'M4 12a8 8 0 1 0 2.3-5.7L4 8.5M4 4v4.5h4.5',
        bolt: 'M13 3L5 13.5h6L10 21l9-11h-6.2z',
        model: 'M12 3l7.5 4.3v8.4L12 20l-7.5-4.3V7.3zM12 8v4.2M12 12.2l3.6 2.1M12 12.2l-3.6 2.1',
        layers: 'M12 4l8.5 4.5L12 13 3.5 8.5zM3.5 13L12 17.5 20.5 13',
        ext: 'M14 5h5v5M19 5l-8 8M10 6H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4',
    };
    const svg = (d, cls) => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
    const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
    const store = {
        get(k) { try { return JSON.parse(root.localStorage.getItem(k) || 'null'); } catch { return null; } },
        set(k, v) { try { if (v == null) root.localStorage.removeItem(k); else root.localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
    };
    const size = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`);

    // ── Your settings: this browser's copy, and your account's when the Network keeps them (the same on every site).
    let prefs = Object.assign({}, DEFAULTS, store.get(PREFS_KEY) || {});
    let synced = false, rev = null;
    const token = () => { try { const n = root.OpenVibeNavbar; return n && typeof n.token === 'function' ? n.token() : null; } catch { return null; } };
    const NET = 'https://openvibe.network/api/v1/me/composer';
    async function pull() {
        const t = token(); if (!t) return;
        try {
            const r = await fetch(NET, { headers: { authorization: `Bearer ${t}`, accept: 'application/json' }, credentials: 'omit' });
            if (!r.ok) return;
            const j = await r.json();
            synced = true; rev = j.rev != null ? j.rev : null;
            prefs = Object.assign({}, DEFAULTS, j.prefs || j);
            store.set(PREFS_KEY, prefs);
            live.forEach((c) => c.refresh());
        } catch { /* local only */ }
    }
    async function push() {
        const t = token(); if (!t || !synced) return;
        try {
            const r = await fetch(NET, { method: 'PUT', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json', accept: 'application/json' }, credentials: 'omit', body: JSON.stringify({ prefs, rev }) });
            if (r.status === 409) { await pull(); return; }
            if (r.ok) { const j = await r.json().catch(() => ({})); if (j.rev != null) rev = j.rev; }
        } catch { /* kept locally */ }
    }
    function setPrefs(next) {
        prefs = Object.assign({}, DEFAULTS, prefs, next);
        prefs.snippets = (prefs.snippets || []).filter((s) => s && /^[\w-]{1,30}$/.test(s.trigger || '') && s.text).slice(0, 50);
        store.set(PREFS_KEY, prefs);
        live.forEach((c) => c.refresh());
        push();
    }
    root.addEventListener('storage', (e) => { if (e.key === PREFS_KEY) { prefs = Object.assign({}, DEFAULTS, store.get(PREFS_KEY) || {}); live.forEach((c) => c.refresh()); } });

    // ── One box.
    function enhance(form) {
        if (!form || form.__ovc) return form && form.__ovc;
        styles();
        const text = form.querySelector('[data-ovt-text]') || form.querySelector('textarea');
        if (!text) return null;
        const row = form.querySelector('.ovt-c-row');
        // A box drawn by its own page marks its row with data-ovc-tools (Vibe's); else the composer's own row.
        const tools = form.querySelector('.ovt-c-tools') || form.querySelector('[data-ovc-tools]');
        const note = form.querySelector('[data-ovt-note]');
        const send = form.querySelector('[data-ovt-send]') || form.querySelector('[type="submit"]');
        const inputs = () => [...form.querySelectorAll('input[type="file"]')];
        const mine = () => mods.filter((m) => !m.match || m.match(form));
        const uploader = () => { const m = mine().find((x) => typeof x.upload === 'function'); return m ? m.upload : null; };
        // data-ovc-no-files: the box handles its own files (the Dock's Vibe box uploads a picture as it is picked).
        const noFiles = form.hasAttribute('data-ovc-no-files');
        const canFile = () => !noFiles && !!(inputs().length || uploader());
        const maxFiles = Number(form.getAttribute('data-ovc-max-files')) || 10;
        const maxBytes = (Number(form.getAttribute('data-ovc-max-mb')) || 25) * 1048576;
        const files = [];
        let quiet = '';
        const wasRequired = !!text.required;   // a box that was not required stays so (the Dock's Vibe box)

        const say = (s) => { if (!note) return; if (!quiet) quiet = note.textContent; note.textContent = s; clearTimeout(say.t); say.t = setTimeout(() => { note.textContent = quiet; quiet = ''; }, 5000); };
        const fire = () => text.dispatchEvent(new Event('input', { bubbles: true }));
        const ctx = {
            form, text,
            get value() { return text.value; },
            set(v) { text.value = v; fire(); },
            insert(s) { const a = text.selectionStart, b = text.selectionEnd; text.setRangeText(s, a, b, 'end'); fire(); text.focus(); },
            files: () => files.map((f) => f.file),
            add: (list) => add(list),
            note: say,
            send: () => { if (form.requestSubmit) form.requestSubmit(send || undefined); else form.submit(); },
        };

        // Files: a strip of chips above the box.
        const strip = el('div', 'ovc-files');
        strip.hidden = true;
        strip.setAttribute('aria-label', 'Attached files');
        const firstLabel = form.querySelector(`label[for="${text.id}"]`);
        const anchor = firstLabel && firstLabel.parentNode === text.parentNode ? firstLabel : text;
        anchor.parentNode.insertBefore(strip, anchor);
        const accepts = (file) => {
            const list = inputs().map((i) => i.getAttribute('accept') || '');
            if (!list.length || list.some((a) => !a)) return true;
            const acc = list.join(',');
            const name = (file.name || '').toLowerCase(), type = (file.type || '').toLowerCase();
            return acc.split(',').map((x) => x.trim().toLowerCase()).some((a) => !a || (a.startsWith('.') ? name.endsWith(a) : a.endsWith('/*') ? type.startsWith(a.slice(0, -1)) : type === a));
        };
        function syncInputs() {
            if (noFiles) return;
            if (uploader()) { inputs().forEach((i) => { i.value = ''; }); return; }
            const [first, ...rest] = inputs();
            if (!first || typeof DataTransfer === 'undefined') return;
            const dt = new DataTransfer();
            files.forEach((f) => dt.items.add(f.file));
            first.files = dt.files;
            rest.forEach((i) => { i.value = ''; });
        }
        function paintFile(f) {
            const kind = (f.file.type || '').split('/')[0];
            const chip = f.chip || el('div', 'ovc-file');
            f.chip = chip;
            chip.classList.toggle('is-bad', !!f.error);
            chip.classList.toggle('is-up', f.progress != null && f.progress < 1 && !f.error);
            chip.style.setProperty('--p', String(f.progress == null ? 1 : f.progress));
            const ext = ((f.file.name || '').split('.').pop() || 'file').slice(0, 4).toUpperCase();
            const thumb = f.url && kind === 'image' ? `<img class="ovc-file-th" src="${f.url}" alt="">` : f.url && kind === 'video' ? `<video class="ovc-file-th" src="${f.url}" muted preload="metadata"></video>` : `<span class="ovc-file-th ovc-file-ic">${f.pasted ? svg(IC.file) : ext}</span>`;
            chip.innerHTML = `${thumb}<span class="ovc-file-t"><span class="ovc-file-n"></span><span class="ovc-file-s"></span></span>`
                + (f.pasted ? `<button type="button" class="ovc-file-b" data-ovc-back aria-label="Put the text back in the box" title="Put it back in the box">${svg(IC.back)}</button>` : '')
                + (f.error && uploader() ? `<button type="button" class="ovc-file-r" data-ovc-retry aria-label="Try the upload again" title="Try again">${svg(IC.retry)}<span class="ovc-file-r-t">Try again</span></button>` : '')
                + `<button type="button" class="ovc-file-x" data-ovc-x aria-label="Remove">${svg(IC.x)}</button>`;
            chip.querySelector('.ovc-file-n').textContent = f.pasted ? 'Pasted text' : f.file.name || 'File';
            chip.querySelector('.ovc-file-s').textContent = f.error || (f.pasted ? `${f.lines} lines · ${size(f.file.size)}` : f.progress != null && f.progress < 1 ? `${Math.round(f.progress * 100)}%` : size(f.file.size));
            chip.querySelector('[data-ovc-x]').setAttribute('aria-label', `Remove ${f.pasted ? 'the pasted text' : f.file.name || 'the file'}`);
            if (!chip.isConnected) strip.appendChild(chip);
        }
        function remove(f) {
            const i = files.indexOf(f); if (i < 0) return;
            files.splice(i, 1);
            if (f.url) URL.revokeObjectURL(f.url);
            if (f.hidden) f.hidden.remove();
            form.dispatchEvent(new CustomEvent('ovc:file-removed', { detail: { file: f.file, chip: f.chip } }));
            f.chip.remove();
            strip.hidden = !files.length;
            syncInputs();
            syncSend();
        }
        function add(list, pasted) {
            const up = uploader();
            for (const file of [...(list || [])]) {
                if (files.length >= maxFiles) { say(`Up to ${maxFiles} files at a time.`); break; }
                if (!accepts(file)) { say(`${file.name || 'That file'}: this box does not take that kind of file.`); continue; }
                if (file.size > maxBytes) { say(`${file.name || 'That file'} is ${size(file.size)}: the limit is ${size(maxBytes)}.`); continue; }
                const kind = (file.type || '').split('/')[0];
                const f = { file, url: kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : null, pasted: !!pasted, lines: pasted ? pasted.lines : 0, text: pasted ? pasted.text : null };
                files.push(f);
                paintFile(f);
                form.dispatchEvent(new CustomEvent('ovc:file-added', { detail: { file, chip: f.chip } }));
                const resize = Number(form.getAttribute('data-ovc-resize')) || 0;
                if (up || resize) {
                    if (up) { f.progress = 0; paintFile(f); }
                    shrink(file, resize).then((small) => {
                        if (!files.includes(f)) return;
                        if (small !== f.file) { f.file = small; syncInputs(); paintFile(f); }
                        if (up) sendUp(f);
                    });
                }
            }
            strip.hidden = !files.length;
            syncInputs();
            syncSend();
        }
        function sendUp(f) {
            const up = uploader(); if (!up) return;
            f.error = null; f.progress = 0; paintFile(f); syncSend();
            Promise.resolve(up(f.file, (p) => { f.progress = Math.max(0, Math.min(0.99, Number(p) || 0)); paintFile(f); syncSend(); }))
                .then((r) => {
                    if (!files.includes(f)) return;
                    f.progress = 1; f.id = r && r.id;
                    if (f.id) { f.hidden = el('input'); f.hidden.type = 'hidden'; f.hidden.name = form.getAttribute('data-ovc-ids') || 'attachments'; f.hidden.value = f.id; form.appendChild(f.hidden); }
                    paintFile(f); syncSend();
                }, (e) => { if (!files.includes(f)) return; f.error = (e && e.message) || 'Did not upload'; paintFile(f); syncSend(); });
        }
        strip.addEventListener('click', (e) => {
            const chip = e.target.closest && e.target.closest('.ovc-file'); if (!chip) return;
            const f = files.find((x) => x.chip === chip); if (!f) return;
            if (e.target.closest('[data-ovc-x]')) { remove(f); text.focus(); }
            else if (e.target.closest('[data-ovc-back]')) { const t = f.text; remove(f); ctx.insert(t); }
            else if (e.target.closest('[data-ovc-retry]')) sendUp(f);
        });
        form.addEventListener('change', (e) => {
            const i = e.target; if (noFiles || !i || i.type !== 'file' || i.__ovcSync) return;
            const picked = [...(i.files || [])];
            i.__ovcSync = true; i.value = ''; i.__ovcSync = false;
            add(picked);
        });
        text.addEventListener('paste', (e) => {
            const cd = e.clipboardData; if (!cd || !canFile()) return;
            const got = [...(cd.files || [])];
            if (got.length) { e.preventDefault(); add(got); return; }
            const t = cd.getData('text/plain') || '';
            const lines = t.split('\n').length;
            if (t.length > 6000 || lines > 120) {
                // Only where the box takes a text file (or a mod uploads): a box for pictures keeps the paste as text.
                const asFile = new File([t], 'pasted-text.txt', { type: 'text/plain' });
                if (!uploader() && !accepts(asFile)) return;
                e.preventDefault();
                add([asFile], { lines, text: t });
                say('The long paste went in as a file: ↩ on it puts it back in the box.');
            }
        });
        const zone = form.closest('[data-ovt]') || form;
        let depth = 0;
        const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
        zone.addEventListener('dragenter', (e) => { if (!hasFiles(e) || !canFile()) return; depth++; form.classList.add('ovc-dropping'); });
        zone.addEventListener('dragleave', () => { if (depth && --depth === 0) form.classList.remove('ovc-dropping'); });
        zone.addEventListener('dragover', (e) => { if (hasFiles(e) && canFile()) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
        zone.addEventListener('drop', (e) => { if (!hasFiles(e) || !canFile()) return; e.preventDefault(); depth = 0; form.classList.remove('ovc-dropping'); add(e.dataTransfer.files); text.focus(); });

        // Send waits for words or a file, and for uploads to finish.
        const busy = () => files.some((f) => f.progress != null && f.progress < 1 && !f.error);
        function syncSend() {
            if (!send || form.classList.contains('is-busy')) return;
            send.disabled = busy() || (!text.value.trim() && !files.length);
            if (wasRequired && text.required && files.length) text.required = false;
            else if (wasRequired && !files.length && !text.required && !form.classList.contains('is-busy')) text.required = true;
        }
        text.addEventListener('input', syncSend);
        if (form.classList.contains('ovc-v2')) {
            const grow = () => { text.style.height = 'auto'; text.style.height = `${Math.min(text.scrollHeight + 2, Math.round((root.innerHeight || 800) * 0.4))}px`; };
            text.addEventListener('input', grow);
            requestAnimationFrame(grow);
        }

        // The slash list and the mention list: one popover above the box.
        const pop = el('div', 'ovc-pop');
        pop.setAttribute('role', 'listbox');
        pop.id = `ovc-pop-${Math.random().toString(36).slice(2, 8)}`;
        pop.hidden = true;
        form.appendChild(pop);
        text.setAttribute('aria-controls', pop.id);
        let items = [], at = 0, trig = null, seq = 0;
        function siteCommands() {
            let list = [];
            try { list = JSON.parse(form.getAttribute('data-ovt-commands') || '[]'); } catch { /* none */ }
            return list.filter((c) => c && /^[\w-]{1,30}$/.test(c.name || ''));
        }
        function commands() {
            const own = (prefs.snippets || []).map((s) => ({ name: s.trigger, hint: s.label || s.text.slice(0, 60), insert: s.text, mine: true }));
            const fromMods = mine().flatMap((m) => m.commands || []);
            return [...siteCommands(), ...fromMods, ...own, { name: 'settings', hint: 'Your composer: what sends, voice, your own commands', run: () => openSettings() }];
        }
        function caretWord() {
            const upto = text.value.slice(0, text.selectionStart);
            let m = upto.match(/(?:^|\n)\/([\w-]{0,30})$/);
            if (m) return { kind: 'slash', q: m[1], from: upto.length - m[1].length - 1 };
            m = upto.match(/(?:^|[\s(])@([\w.-]{0,30})$/);
            if (m && mine().some((x) => x.mentions && typeof x.mentions.search === 'function')) return { kind: 'at', q: m[1], from: upto.length - m[1].length - 1 };
            return null;
        }
        function close() { pop.hidden = true; items = []; trig = null; text.removeAttribute('aria-activedescendant'); text.setAttribute('aria-expanded', 'false'); }
        function paintPop() {
            if (!items.length) { close(); return; }
            pop.innerHTML = '';
            items.forEach((it, i) => {
                const b = el('button', 'ovc-pop-i');
                b.type = 'button'; b.id = `${pop.id}-${i}`;
                b.setAttribute('role', 'option');
                b.setAttribute('aria-selected', i === at ? 'true' : 'false');
                const lead = it.avatar ? el('img', 'ovc-pop-av') : el('span', 'ovc-pop-ic', svg(trig && trig.kind === 'at' ? IC.at : it.name === 'settings' ? IC.gear : IC.slash));
                if (it.avatar) { lead.src = it.avatar; lead.alt = ''; }
                const t = el('span', 'ovc-pop-t');
                const n = el('b'); n.textContent = trig && trig.kind === 'at' ? it.label : `/${it.name}`;
                const h = el('span'); h.textContent = trig && trig.kind === 'at' ? (it.sub || (it.handle ? `@${it.handle}` : '')) : it.hint || '';
                t.append(n, h);
                b.append(lead, t);
                if (it.mine) b.appendChild(el('span', 'ovc-pop-tag', 'Yours'));
                b.addEventListener('mousedown', (e) => e.preventDefault());
                b.addEventListener('click', () => choose(i));
                pop.appendChild(b);
            });
            pop.hidden = false;
            text.setAttribute('aria-expanded', 'true');
            text.setAttribute('aria-activedescendant', `${pop.id}-${at}`);
            const cur = pop.children[at]; if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
        }
        async function look() {
            const w = caretWord();
            if (!w) { close(); return; }
            trig = w; const mineSeq = ++seq;
            if (w.kind === 'slash') {
                const q = w.q.toLowerCase();
                items = commands().filter((c) => !q || c.name.toLowerCase().startsWith(q) || (c.hint || '').toLowerCase().includes(q)).slice(0, 12);
                at = 0; paintPop(); return;
            }
            const srcs = mine().filter((m) => m.mentions && typeof m.mentions.search === 'function');
            const lists = await Promise.all(srcs.map((m) => Promise.resolve(m.mentions.search(w.q)).catch(() => [])));
            if (mineSeq !== seq) return;
            items = lists.flat().filter((x) => x && x.label).slice(0, 8);
            at = 0; paintPop();
        }
        function choose(i) {
            const it = items[i]; if (!it || !trig) return;
            const end = text.selectionStart;
            const from = trig.from, kind = trig.kind;
            close();
            if (kind === 'at') { text.setRangeText(it.insert || `@${it.handle || it.label} `, from, end, 'end'); fire(); text.focus(); return; }
            text.setRangeText('', from, end, 'end');
            if (typeof it.run === 'function') { fire(); try { it.run(ctx); } catch (e) { console.error(e); } return; }
            text.setRangeText(String(it.insert || ''), from, from, 'end'); fire(); text.focus();
        }
        let lookT = 0;
        text.addEventListener('input', () => { clearTimeout(lookT); lookT = setTimeout(() => { lookT = 0; look(); }, trig && trig.kind === 'at' ? 140 : 0); });
        text.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== text) close(); }, 120));
        text.setAttribute('aria-autocomplete', 'list');

        // Keys, before the thread's own: the list's arrows and Enter, what sends, and the marks.
        form.addEventListener('keydown', (e) => {
            if (e.target !== text) return;
            // Enter right after the last letter: the slash list is read now, so "/settings" + Enter picks it.
            if (e.key === 'Enter' && lookT) { clearTimeout(lookT); lookT = 0; const w = caretWord(); if (w && w.kind === 'slash') look(); }
            if (!pop.hidden && items.length) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); at = (at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; paintPop(); return; }
                if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); choose(at); return; }
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
            }
            const mod = mac ? e.metaKey : e.ctrlKey;
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                if (mod) { e.preventDefault(); e.stopPropagation(); if (!send || !send.disabled) ctx.send(); return; }
                if (prefs.send_key === 'mod-enter') { e.stopPropagation(); return; }
                if (busy()) { e.preventDefault(); e.stopPropagation(); say('A file is still uploading.'); return; }
                if (!text.value.trim() && files.length && (root.matchMedia ? root.matchMedia('(pointer: fine)').matches : true)) { e.preventDefault(); e.stopPropagation(); ctx.send(); return; }
            }
            const wrap = { b: '**', i: '_', e: '`' }[mod && !e.altKey && !e.shiftKey ? e.key.toLowerCase() : ''];
            if (wrap) {
                e.preventDefault(); e.stopPropagation();
                const a = text.selectionStart, z = text.selectionEnd, sel = text.value.slice(a, z);
                text.setRangeText(wrap + sel + wrap, a, z, 'select');
                if (!sel) text.setSelectionRange(a + wrap.length, a + wrap.length);
                else text.setSelectionRange(a + wrap.length, z + wrap.length);
                fire();
            }
        }, true);

        // The send: the mods may hold it; files still uploading hold it; the draft goes.
        const draftKey = form.hasAttribute('data-ovc-no-draft') ? null : `ov:draft:${location.pathname}#${form.id || form.getAttribute('action') || ''}`;
        form.addEventListener('submit', (e) => {
            if (busy()) { e.preventDefault(); e.stopImmediatePropagation(); say('A file is still uploading.'); return; }
            for (const m of mine()) {
                if (typeof m.beforeSend !== 'function') continue;
                let ok; try { ok = m.beforeSend(ctx); } catch (err) { console.error(err); }
                if (ok === false) { e.preventDefault(); e.stopImmediatePropagation(); return; }
            }
            if (draftKey) store.set(draftKey, null);
            close();
        }, true);
        if (draftKey) {
            const d = store.get(draftKey);
            if (d && d.t && !text.value && Date.now() - (d.at || 0) < 7 * 864e5) { text.value = d.t; fire(); }
            let dt = 0;
            text.addEventListener('input', () => { clearTimeout(dt); dt = setTimeout(() => store.set(draftKey, text.value.trim() ? { t: text.value, at: Date.now() } : null), 400); });
        }

        // The count, near the box's limit.
        let count = null;
        if (text.maxLength > 0 && row) {
            count = el('span', 'ovc-count'); count.setAttribute('aria-live', 'polite');
            row.insertBefore(count, send && send.parentNode === row ? send : null);
            // The count shows only near the limit: the last 15% of a box, at most 200 and at least 20 characters (a 120-character
            // search box said "120 left" while empty, 2026-11-11).
            const paintCount = () => { const left = text.maxLength - text.value.length; count.hidden = left > Math.min(200, Math.max(20, Math.round(text.maxLength * 0.15))); count.textContent = `${left} left`; count.classList.toggle('is-low', left < 20); };
            text.addEventListener('input', paintCount); paintCount();
        }

        // Voice: the browser listens, the words go in at the caret as they come.
        let mic = null, rec = null;
        // 4.223.0, the +: every tool of this box in one sheet (its row's own, the mods', and the extras such as Timer), big
        // and named. On a narrow box the row keeps the mic, the + and the first tool; the sheet has the rest.
        let more = null, sheet = null;
        function closeSheet() { if (sheet) { sheet.remove(); sheet = null; } if (more) more.setAttribute('aria-expanded', 'false'); }
        function openSheet(ev) {
            if (sheet) { closeSheet(); return; }
            sheet = el('div', 'ovc-tray'); sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Tools');
            const grid = el('div', 'ovc-tray-grid');
            const add = (label, path, act, drawn) => {
                const b = el('button', 'ovc-tray-i', `<span class="ovc-tray-ic">${drawn ? '' : svg(PATH_OK.test(path || '') ? path : IC.slash)}</span><span class="ovc-tray-t"></span>`);
                if (drawn) { const c = drawn.cloneNode(true); c.removeAttribute('width'); c.removeAttribute('height'); c.removeAttribute('class'); b.firstChild.appendChild(c); }   // the button's own whole drawing
                b.type = 'button'; b.querySelector('.ovc-tray-t').textContent = label;
                b.addEventListener('click', () => { closeSheet(); try { act(); } catch (e) { console.error(e); } });
                grid.appendChild(b);
            };
            const seen = new Set();
            [...tools.children].forEach((t) => {
                if (t === mic || t === more || !t.matches('.ovt-btn, button, label') || t.matches('[type="submit"], [data-ovt-send], .ovc-mic, .ovdk-mic, .ovdk-go, [hidden]')) return;
                const label = t.getAttribute('aria-label') || t.title || ''; if (!label || seen.has(label)) return; seen.add(label);
                const input = t.querySelector('input[type=file]');
                add(label, '', () => { if (input) input.click(); else t.click(); }, t.querySelector('svg'));
            });
            Object.keys(TOOL).forEach((id) => {
                const t = TOOL[id]; if (!t || !t.extra || seen.has(t.label) || form.hasAttribute(`data-ovc-no-${id}`)) return; seen.add(t.label);
                add(t.label, t.path, () => t.run(ctx, more, form));
            });
            sheet.appendChild(grid);
            form.appendChild(sheet);   // inside the box, under its row: nothing can clip it
            more.setAttribute('aria-expanded', 'true');
            // From the keyboard (a click with no pointer) focus moves into the sheet; a tap leaves it on the +.
            if (ev && ev.detail === 0) { const first = sheet.querySelector('button'); if (first) first.focus(); }
            sheet.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeSheet(); more.focus(); } });
        }
        if (tools && !form.hasAttribute('data-ovc-no-more')) {
            more = el('button', 'ovt-btn ovc-more', svg(IC.plus));
            more.type = 'button'; more.setAttribute('aria-label', 'More: attach, timer and tools'); more.title = 'More';
            more.setAttribute('aria-haspopup', 'dialog'); more.setAttribute('aria-expanded', 'false');
            more.addEventListener('click', openSheet);
            const lead = tools.querySelector(':scope > .ovdk-mic');   // a page's own mic stays first
            tools.insertBefore(more, lead ? lead.nextSibling : tools.firstChild);
            document.addEventListener('pointerdown', (e) => { if (sheet && !sheet.contains(e.target) && !more.contains(e.target)) closeSheet(); });
        }
        // What people do with this box, in turn while it is empty and you are elsewhere (Calm: slower; Off: the first stays).
        {
            let ex = null; try { ex = JSON.parse(form.dataset.ovcExamples || 'null'); } catch { ex = null; }
            if (Array.isArray(ex) && ex.length > 1 && typeof setInterval === 'function') {
                let k = 0;
                const motion = () => (document.documentElement.getAttribute('data-ov-motion') || '');
                const tick = setInterval(() => {
                    if (!form.isConnected) { clearInterval(tick); return; }
                    if (motion() === 'off' || text.value || document.activeElement === text) return;
                    k = (k + 1) % ex.length;
                    text.classList.add('ovc-ph-swap');
                    setTimeout(() => { text.placeholder = String(ex[k]).slice(0, 80); text.classList.remove('ovc-ph-swap'); }, motion() === 'reduced' ? 120 : 260);
                }, motion() === 'reduced' ? 8000 : 4200);
            }
        }
        function micButton() {
            if (!Speech || !tools) return;
            if (!prefs.voice || form.hasAttribute('data-ovc-no-voice')) { if (mic) { mic.remove(); mic = null; } return; }
            if (mic) return;
            mic = el('button', 'ovt-btn ovc-mic', svg(IC.mic));
            mic.type = 'button'; mic.setAttribute('aria-label', 'Speak'); mic.title = 'Speak'; mic.setAttribute('aria-pressed', 'false');
            mic.addEventListener('click', () => {
                if (rec) { rec.stop(); return; }
                rec = new Speech();
                rec.lang = document.documentElement.lang || navigator.language || 'en-US';
                rec.interimResults = true; rec.continuous = true;
                const a = text.selectionStart, z = text.selectionEnd, head = text.value.slice(0, a), tail = text.value.slice(z);
                const pad = head && !/\s$/.test(head) ? ' ' : '';
                rec.onresult = (ev) => { let s = ''; for (let i = 0; i < ev.results.length; i++) s += ev.results[i][0].transcript; text.value = head + pad + s + tail; text.setSelectionRange((head + pad + s).length, (head + pad + s).length); fire(); };
                rec.onend = () => { rec = null; mic.setAttribute('aria-pressed', 'false'); mic.title = 'Speak'; text.focus(); };
                rec.onerror = (ev) => { if (ev.error === 'not-allowed') say('The microphone is blocked for this site.'); };
                try { rec.start(); mic.setAttribute('aria-pressed', 'true'); mic.title = 'Stop listening'; } catch { rec = null; }
            });
            tools.insertBefore(mic, tools.firstChild);
            if (more && more.parentNode === tools) tools.insertBefore(more, mic.nextSibling);
        }

        // The mods' tools: buttons in the row, in the order the mods came.
        let modTools = [];
        function paintTools() {
            modTools.forEach((b) => b.remove()); modTools = [];
            if (!tools) return;
            for (const t of mine().flatMap((m) => m.tools || [])) {
                if (!t || !t.label || typeof t.run !== 'function') continue;
                const b = el('button', 'ovt-btn ovc-tool', svg(PATH_OK.test(t.path || '') ? t.path : IC.slash));
                b.type = 'button'; b.setAttribute('aria-label', t.label); b.title = t.label;
                b.addEventListener('click', () => { try { t.run(ctx); } catch (e) { console.error(e); } });
                tools.appendChild(b);
                modTools.push(b);
            }
        }

        const api = {
            form, ctx,
            refresh() { form.classList.toggle('ovc-compact', prefs.density === 'compact'); micButton(); paintTools(); syncSend(); },
            add, files: () => files.map((f) => f.file), clearFiles: () => { [...files].forEach(remove); },
            uploads: () => files.map((f) => f.id).filter(Boolean),
            clear() { files.slice().forEach(remove); text.value = ''; if (draftKey) store.set(draftKey, null); fire(); },
            destroy() { live.delete(api); pop.remove(); strip.remove(); if (mic) mic.remove(); if (more) more.remove(); closeSheet(); modTools.forEach((b) => b.remove()); form.__ovc = null; },
        };
        form.__ovc = api;
        form.addEventListener('reset', () => setTimeout(() => api.clear(), 0));
        live.add(api);
        form.classList.add('ovc');
        api.refresh();
        return api;
    }


    // ── 4.215.0: a whole composer, mounted (composer v2). ─────────────────────────────────────────────────────────────
    // A site no longer draws its own box: OpenVibeComposer.mount(host, options) draws one of the presets, and everything
    // enhance() gives (files, paste, drop, uploads, commands, mentions, voice, drafts, keys, the count) comes with it.
    //   options: { preset: 'post' | 'chat' | 'agent' | 'comment', id, name ('text'), placeholder, label, maxLength,
    //     user: { display_name | username, avatar_url }, tools: ['photo', 'file', 'attach', 'emoji', 'voice'] (the
    //     preset's own when absent), accept, maxFiles, maxMb, required (true), noDraft,
    //     audience / mode: { name, label, options: [[value, label]], value } (a chip each); chips: [{ name, label, icon
    //     ('globe' | 'spark' | 'cpu' | 'gauge'), options, value, onChange }] for any more (an agent's Model and Reasoning,
    //     as the agents portal's box has),
    //     submitLabel, upload(file, onProgress), mentions, commands, beforeSend,
    //     onSubmit({ text, files, uploads, audience, mode }, api) → a promise; false keeps the box as it is }
    //   → the enhance api plus { form, text, send, note, setBusy(bool), setRunning(bool, onStop) (the send becomes Stop
    //     while a run works, as in the agents portal), values() (every chip's value by name),
    //     edit({ text, onSave(text) → false keeps editing, onCancel, label }) (the box takes your message's words under an
    //     "Editing your message" bar; Enter saves, Esc or × puts back what was in the box; the send is a check),
    //     reply({ name, text, data, onClear }) (a "Replying to …" bar; onSubmit's value carries reply: data),
    //     clearBar(), editing() }.
    // 4.218.0, Post · Ask · Do (research-2026-11-12/composer-post-ask-do.md): verbs: ['post', 'ask', 'do'] (a site
    //   opts in; the first is where the box starts) draws one switch at the start of the row. Ask and Do add three chips:
    //   Model (a sheet over the Frame's /choices?task=: Auto, then OpenVibe from Exchange's directory with prices, your
    //   keys, your computers, your plans), Sources (web, OpenVibe, mine, this page) and Depth (quick, balanced, deep).
    //   ask: { task, context: { site, url, title, kind, id } }, frameBase (default https://openvibe.network/api/frame),
    //   onAsk(value, api) / onDo(value, api) to answer it yourself; without them the box asks the Frame (/ask, /do) and
    //   streams the run into an answer card under the box (api.answer() gives the card to a site that answers itself).
    //   value = { verb, text, files, uploads, model, sources, depth, context, chips }.
    // A tool is a module: OpenVibeComposer.tool(id, { label, path, accept? | run(ctx, button, form) }) adds or replaces
    // one for every box; a preset or a site names the ones it shows. Mods (mod()) still add their own buttons.
    const EXAMPLES = {
        agent: ['Ask for anything', 'Find a live stream about cooking', 'Start a 10-minute timer', 'Summarize today’s Rundown', 'Write a title for my stream', 'What did people post today?'],
        post: ["What's new?", 'Share a photo from today', 'Ask your followers a question', 'Post a clip you made'],
    };
    const PRESET = {
        post: { tools: ['photo', 'camera', 'file', 'emoji', 'voice'], send: 'Post', avatar: true, rows: 2, max: 2000, ring: true, resize: 2560 },
        chat: { tools: ['attach', 'emoji', 'voice'], send: '', avatar: false, rows: 1, max: 4000, ring: false, resize: 2560 },
        agent: { tools: ['attach', 'camera', 'voice'], send: '', avatar: false, rows: 2, max: 16000, ring: false, resize: 1568 },
        comment: { tools: ['photo', 'emoji'], send: 'Reply', avatar: true, rows: 1, max: 2000, ring: true, resize: 2560 },
    };
    const EMOJI = '😀 😂 🥹 😊 😍 🥰 😘 😎 🤩 🥳 😇 🙂 😉 😌 🤔 🤨 😐 🙄 😏 😬 😮 😱 😭 😤 😡 🤯 🥶 🥵 😴 🤤 🤗 🫡 🤝 👍 👎 👏 🙌 🙏 💪 👀 🫶 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ✨ 🔥 💯 🎉 🎊 🏆 🎮 🎧 🎵 📸 🎬 🍕 🍔 🍿 ☕ 🍻 🌈 🌙 ⭐ ⚡ 💥 💀 🤖 👻 🐐 🦆 🐸 🚀 ✅ ❌ ⚠️ ❓ 👋 🫠'.split(' ');
    const TOOL = {
        photo: { label: 'Photos and video', path: IC.photo, accept: 'image/*,video/*' },
        // 4.223.0: in every box's + (extra: never in a row of its own). Your timers are Vibe's: one list on every site.
        timer: {
            label: 'Timer', path: IC.timer, extra: true,
            run(ctx, button) {
                const D = root.OpenVibeDock;
                if (D && typeof D.timer === 'function') { try { D.timer(button); return; } catch (e) { console.error(e); } }
                const N = root.OpenVibeNavbar;
                if (N && typeof N.openMenuOn === 'function') { try { N.openMenuOn('vibe'); ctx.note('Say “a timer for 10 minutes” to Vibe.'); return; } catch { /* below */ } }
                ctx.note('Sign in to set timers: they ring on every OpenVibe site.');
            },
        },
        file: { label: 'Files', path: IC.file, accept: '' },
        attach: { label: 'Attach', path: IC.clip, accept: '' },
        emoji: {
            label: 'Emoji', path: IC.smile,
            run(ctx, button, form) {
                let panel = form.querySelector('.ovc-emoji');
                if (panel) { panel.hidden = !panel.hidden; if (!panel.hidden) panel.querySelector('button').focus(); return; }
                panel = el('div', 'ovc-emoji'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Emoji');
                EMOJI.forEach((e) => {
                    const b = el('button'); b.type = 'button'; b.textContent = e; b.setAttribute('aria-label', e);
                    b.addEventListener('click', () => { ctx.insert(e); panel.hidden = true; });
                    panel.appendChild(b);
                });
                panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { panel.hidden = true; button.focus(); } });
                document.addEventListener('pointerdown', (e) => { if (!panel.hidden && !panel.contains(e.target) && !button.contains(e.target)) panel.hidden = true; });
                form.appendChild(panel);
                panel.querySelector('button').focus();
            },
        },
        // 4.225.0: a repository from GitHub, found through OpenVibe Exchange's code search (the Frame's
        // /api/frame/code/search): its address goes into the box, where every site draws it as a card.
        github: { label: 'GitHub', path: IC.repo, extra: true, run: (ctx, button, form) => openRepoSearch(ctx, button, form) },
        voice: { label: 'Speak', builtin: true },   // enhance() draws the microphone where the browser can listen
        camera: { label: 'Camera', path: IC.camera, run: (ctx, button) => openCamera(ctx, button) },
    };
    // The camera (4.217.0): a photo or a clip straight into the box, through the shared capture core. A sheet over the
    // page (the whole screen on a phone): the picture, Photo or Video, the shutter, flip and close. Nothing is kept or
    // sent until the person sends the message.
    async function openCamera(ctx, button) {
        const C = await needCapture();
        if (!C) { ctx.note('The camera could not start here.'); return; }
        styles();
        const dlg = el('dialog', 'ovc-cam'); dlg.setAttribute('aria-label', 'Camera');
        dlg.innerHTML = `<div class="ovc-cam-stage"><video class="ovc-cam-v" playsinline muted autoplay></video><p class="ovc-cam-msg" hidden></p><span class="ovc-cam-t" hidden>0:00</span></div>
<div class="ovc-cam-modes" role="group" aria-label="Photo or video"><button type="button" data-m="photo" aria-pressed="true">Photo</button><button type="button" data-m="video" aria-pressed="false">Video</button></div>
<div class="ovc-cam-bar"><button type="button" class="ovc-cam-b" data-a="close" aria-label="Close the camera">${svg(IC.x)}</button><button type="button" class="ovc-cam-shutter" data-a="shoot" aria-label="Take a photo"></button><button type="button" class="ovc-cam-b" data-a="flip" aria-label="Switch camera">${svg(IC.flip)}</button></div>`;
        document.body.appendChild(dlg);
        const video = dlg.querySelector('video'), msg = dlg.querySelector('.ovc-cam-msg'), timer = dlg.querySelector('.ovc-cam-t'), shoot = dlg.querySelector('[data-a="shoot"]');
        let stream = null, facing = (C.settings.load().facing) || 'user', mode = 'photo', rec = null, tick = 0;
        const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const stop = () => { if (rec) { rec.cancel(); rec = null; } clearInterval(tick); C.stop(stream); stream = null; };
        const close = () => { stop(); try { dlg.close(); } catch { /* closed */ } dlg.remove(); if (button) button.focus(); };
        async function start() {
            C.stop(stream); stream = null; msg.hidden = true;
            try {
                stream = await C.open({ mode: mode === 'video' ? 'camera' : 'camera_only', facing });
                video.srcObject = stream; dlg.classList.toggle('is-mirror', facing === 'user');
            } catch (err) {
                const fix = C.explain(err, mode === 'video' ? 'camera' : 'camera_only');
                msg.textContent = `${fix.title}. ${fix.steps.join(' ')}`; msg.hidden = false;
            }
        }
        dlg.addEventListener('click', async (e) => {
            const b = e.target.closest && e.target.closest('button'); if (!b) return;
            if (b.dataset.m && !rec) {
                mode = b.dataset.m;
                dlg.querySelectorAll('[data-m]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
                dlg.classList.toggle('is-video', mode === 'video');
                shoot.setAttribute('aria-label', mode === 'video' ? 'Record' : 'Take a photo');
                start();
            } else if (b.dataset.a === 'close') close();
            else if (b.dataset.a === 'flip' && !rec) { facing = facing === 'user' ? 'environment' : 'user'; C.settings.save({ facing }); start(); }
            else if (b.dataset.a === 'shoot' && stream) {
                if (mode === 'photo') {
                    try {
                        const blob = await C.photo(stream, { mirror: facing === 'user' });
                        ctx.add([new File([blob], `photo-${stamp()}.jpg`, { type: blob.type || 'image/jpeg' })]);
                        close();
                    } catch (err) { msg.textContent = 'The photo did not take. Try again.'; msg.hidden = false; }
                } else if (!rec) {
                    rec = C.record(stream, { maxSeconds: 60 });
                    dlg.classList.add('is-recording'); shoot.setAttribute('aria-label', 'Stop recording');
                    timer.hidden = false;
                    tick = setInterval(() => { const t = Math.floor(rec ? rec.seconds() : 0); timer.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }, 250);
                } else {
                    const r = rec; rec = null; clearInterval(tick);
                    dlg.classList.remove('is-recording');
                    const blob = await r.stop();
                    if (blob) {
                        const ext = /mp4/.test(blob.type) ? 'mp4' : /webm/.test(blob.type) ? 'webm' : 'video';
                        ctx.add([new File([blob], `clip-${stamp()}.${ext}`, { type: blob.type || 'video/webm' })]);
                    }
                    close();
                }
            }
        });
        dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
        if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
        start();
    }
    /** The GitHub tool's panel: a field, the repositories as you type (a quarter second after the last key), one press
     * puts the address in the box. Everything is text; only https pictures from GitHub's avatar host are drawn. */
    function openRepoSearch(ctx, button, form) {
        let panel = form.querySelector('.ovc-repo');
        if (panel) { panel.hidden = !panel.hidden; if (!panel.hidden) panel.querySelector('input').focus(); return; }
        styles();
        panel = el('div', 'ovc-repo'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'A repository from GitHub');
        const field = el('input', 'ovc-repo-q'); field.type = 'search'; field.placeholder = 'Search GitHub'; field.setAttribute('aria-label', 'Search GitHub repositories'); field.autocomplete = 'off'; field.spellcheck = false;
        const list = el('div', 'ovc-repo-list'); list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Repositories');
        const note = el('p', 'ovc-repo-note'); note.textContent = 'Type what the project does: “goal bar overlay”, “markdown editor”.';
        panel.append(field, list, note);
        const frame = String(form.getAttribute('data-ovc-frame') || 'https://openvibe.network').replace(/\/+$/, '');
        let t = 0, gen = 0;
        const close = () => { panel.hidden = true; button.focus(); };
        const pick = (r) => { ctx.insert(`${r.url} `); panel.hidden = true; };
        const draw = (items) => {
            list.textContent = '';
            items.forEach((r) => {
                const b = el('button', 'ovc-repo-row'); b.type = 'button'; b.setAttribute('role', 'option');
                let av = null;
                try { const u = new URL(String(r.owner_avatar_url || '')); if (u.protocol === 'https:' && u.hostname === 'avatars.githubusercontent.com') { av = el('img', 'ovc-repo-av'); av.src = u.href; av.alt = ''; av.loading = 'lazy'; } } catch { /* no picture */ }
                if (!av) { av = el('span', 'ovc-repo-av'); av.innerHTML = svg(IC.repo); }
                const t1 = el('span', 'ovc-repo-t');
                const name = el('b'); name.textContent = String(r.full_name || '');
                const sub = el('small'); sub.textContent = String(r.description || '');
                const meta = el('i'); meta.textContent = [r.language, Number.isFinite(r.stars) ? `★ ${r.stars >= 1000 ? `${(r.stars / 1000).toFixed(1)}k` : r.stars}` : '', r.license].filter(Boolean).join(' · ');
                t1.append(name, sub, meta);
                b.append(av, t1);
                b.addEventListener('click', () => pick(r));
                list.appendChild(b);
            });
        };
        const search = async () => {
            const q = field.value.trim();
            const my = ++gen;
            if (q.length < 2) { list.textContent = ''; note.hidden = false; note.textContent = 'Type what the project does: “goal bar overlay”, “markdown editor”.'; return; }
            note.hidden = false; note.textContent = 'Searching…';
            try {
                const r = await fetch(`${frame}/api/frame/code/search?q=${encodeURIComponent(q)}&limit=8`, { credentials: 'omit', headers: { accept: 'application/json' } });
                const j = await r.json().catch(() => ({}));
                if (my !== gen) return;
                if (!r.ok) throw new Error(j.error || 'Search is unavailable right now');
                const items = Array.isArray(j.items) ? j.items : [];
                draw(items);
                note.hidden = items.length > 0;
                note.textContent = items.length ? '' : 'Nothing found. Try other words.';
            } catch (err) { if (my === gen) { list.textContent = ''; note.hidden = false; note.textContent = (err && err.message) || 'Search is unavailable right now'; } }
        };
        field.addEventListener('input', () => { clearTimeout(t); t = setTimeout(search, 250); });
        field.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); close(); }
            else if (e.key === 'Enter') { e.preventDefault(); const first = list.querySelector('.ovc-repo-row'); if (first) first.click(); else { clearTimeout(t); search(); } }
            else if (e.key === 'ArrowDown') { const first = list.querySelector('.ovc-repo-row'); if (first) { e.preventDefault(); first.focus(); } }
        });
        list.addEventListener('keydown', (e) => {
            const rows = [...list.querySelectorAll('.ovc-repo-row')]; const k = rows.indexOf(document.activeElement);
            if (e.key === 'ArrowDown' && k < rows.length - 1) { e.preventDefault(); rows[k + 1].focus(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); (k > 0 ? rows[k - 1] : field).focus(); }
            else if (e.key === 'Escape') { e.preventDefault(); close(); }
        });
        document.addEventListener('pointerdown', (e) => { if (!panel.hidden && !panel.contains(e.target) && !button.contains(e.target)) panel.hidden = true; });
        form.appendChild(panel);
        field.focus();
    }
    function tool(id, spec) {
        if (!/^[\w-]{1,30}$/.test(id || '') || !spec) return;
        TOOL[id] = Object.assign({}, TOOL[id] || {}, spec);
    }
    const initial = (u) => String((u && (u.display_name || u.username)) || '?').trim().charAt(0).toUpperCase() || '?';
    const FRAME = 'https://openvibe.network/api/frame';
    const VERBS = { post: { icon: 'send', hint: 'to people' }, ask: { icon: 'spark', word: 'Ask', hint: 'AI answers you' }, do: { icon: 'bolt', word: 'Do', hint: 'Actor does it for you' } };
    const SOURCES = [['web', 'Web', 'globe'], ['openvibe', 'OpenVibe', 'layers'], ['mine', 'Mine', 'file'], ['page', 'This page', 'photo']];
    const choicesCache = new Map();
    // The Frame's model list for a task, in one shape whatever answered (the Frame's groups, or AI's own options).
    async function loadChoices(frame, task) {
        const key = `${frame}|${task}`;
        if (choicesCache.has(key)) return choicesCache.get(key);
        const job = fetch(`${frame}/choices?task=${encodeURIComponent(task)}`, { credentials: 'include', headers: { Accept: 'application/json' } })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Models are unavailable right now.'))))
            .then((d) => {
                if (Array.isArray(d.groups)) return d;
                const o = d.options || {};
                return { recommended: d.recommended, groups: [['openvibe', 'OpenVibe'], ['keys', 'Your keys'], ['machines', 'Your computers']].map(([id, title]) => ({ id, title, rows: o[id] || [] })) };
            });
        choicesCache.set(key, job);
        job.catch(() => choicesCache.delete(key));
        return job;
    }
    const money = (row) => {
        if (row.free || (row.price && row.price.in === 0) || row.price_estimate_usd === 0) return 'Free';
        if (row.price && row.price.in != null) return `$${Number(row.price.in).toFixed(row.price.in < 1 ? 2 : 1)} / M`;
        if (row.price_estimate_usd != null) return `about $${Number(row.price_estimate_usd).toFixed(3)}`;
        return '';
    };
    function mount(host, o = {}) {
        if (!host) return null;
        styles();
        const name = PRESET[o.preset] ? o.preset : 'post';
        const p = PRESET[name];
        const form = el('form', 'ovt-composer ovc-v2');
        form.dataset.preset = name;
        if (o.id) form.id = o.id;
        form.setAttribute('data-ovc', '');
        form.setAttribute('data-ovc-max-files', String(o.maxFiles || 10));
        form.setAttribute('data-ovc-max-mb', String(o.maxMb || 100));
        if (o.noDraft) form.setAttribute('data-ovc-no-draft', '');
        const resize = o.resize != null ? Number(o.resize) || 0 : p.resize || 0;
        if (resize) form.setAttribute('data-ovc-resize', String(resize));
        const want = (o.tools || p.tools).filter((t) => TOOL[t]);
        if (!want.includes('voice')) form.setAttribute('data-ovc-no-voice', '');
        // A post or a reply opens with one line: the person's picture (or first letter), their name and who sees it.
        const body = el('div', 'ovc-body');
        const head = el('div', 'ovc-head');
        if (p.avatar && o.user) {
            const src = o.user.avatar_url || o.user.avatar;
            const av = src ? el('img', 'ovc-av') : el('span', 'ovc-av');
            if (src) { av.src = src; av.alt = ''; av.loading = 'lazy'; } else av.textContent = initial(o.user);
            av.setAttribute('aria-hidden', 'true');
            const nm = el('span', 'ovc-head-n'); nm.textContent = String(o.user.display_name || o.user.username || '');
            head.append(av, nm);
        }
        const ta = el('textarea');
        ta.name = o.name || 'text'; ta.rows = p.rows; ta.maxLength = o.maxLength || p.max;
        ta.placeholder = o.placeholder || (name === 'post' ? "What's new?" : name === 'agent' ? 'Ask for anything' : name === 'comment' ? 'Write a reply' : 'Write a message');
        ta.setAttribute('aria-label', o.label || ta.placeholder);
        { const ex = Array.isArray(o.examples) ? o.examples : (o.placeholder ? null : EXAMPLES[name]); if (ex && ex.length > 1) form.dataset.ovcExamples = JSON.stringify(ex.slice(0, 8)); }
        ta.setAttribute('data-ovt-text', '');
        if (o.required !== false) ta.required = true;
        const row = el('div', 'ovt-c-row'), tools = el('div', 'ovt-c-tools'), chips = el('div', 'ovc-chips');
        const ctxOf = () => (form.__ovc && form.__ovc.ctx) || null;
        for (const id of want) {
            const t = TOOL[id];
            if (t.builtin) continue;
            if (id === 'camera' && !(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function')) continue;
            if (typeof t.run !== 'function' && t.accept === undefined) continue;
            const b = el(typeof t.run === 'function' ? 'button' : 'label', `ovt-btn ovc-t-${id}`, svg(t.path || IC.slash));
            b.title = t.label; b.setAttribute('aria-label', t.label);
            if (typeof t.run === 'function') { b.type = 'button'; b.addEventListener('click', () => { const c = ctxOf(); if (c) t.run(c, b, form); }); }
            else {
                const input = el('input'); input.type = 'file'; input.multiple = true; input.tabIndex = -1;
                const acc = o.accept != null && id !== 'photo' ? o.accept : t.accept;
                if (acc) input.accept = acc;
                input.setAttribute('aria-label', t.label);
                b.tabIndex = 0;
                b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
                b.appendChild(input);
            }
            tools.appendChild(b);
        }
        // Option chips: who sees it (a post), how the agent works (agent). A select under a pill: the browser's own list.
        const chip = (spec, path) => {
            if (!spec || !Array.isArray(spec.options) || !spec.options.length) return null;
            const c = el('label', 'ovc-chip', svg(path));
            const v = el('span', 'ovc-chip-v');
            const sel = el('select'); sel.name = spec.name || 'option'; sel.setAttribute('aria-label', spec.label || 'Option');
            spec.options.forEach(([value, label]) => { const op = el('option'); op.value = value; op.textContent = label; sel.appendChild(op); });
            if (spec.value != null) sel.value = spec.value;
            const paint = () => { v.textContent = (sel.selectedOptions[0] && sel.selectedOptions[0].textContent) || ''; };
            sel.addEventListener('change', () => { paint(); if (typeof spec.onChange === 'function') spec.onChange(sel.value); });
            paint();
            c.append(v, sel);
            return c;
        };
        const aud = chip(o.audience, IC.globe), md = chip(o.mode, IC.spark);
        if (aud) chips.appendChild(aud);
        if (md) chips.appendChild(md);
        (Array.isArray(o.chips) ? o.chips : []).forEach((spec) => { const c = chip(spec, IC[spec && spec.icon] || IC.spark); if (c) chips.appendChild(c); });
        // The ring: how much of the limit is used; amber near it, red over it (the words stay; the send waits).
        let ring = null;
        if (p.ring) {
            ring = el('span', 'ovc-ring');
            ring.innerHTML = '<svg viewBox="0 0 26 26" width="26" height="26" aria-hidden="true"><circle class="ovc-ring-bg" cx="13" cy="13" r="10"/><circle class="ovc-ring-fg" cx="13" cy="13" r="10" stroke-dasharray="62.83" stroke-dashoffset="62.83" transform="rotate(-90 13 13)"/></svg>';
            ring.hidden = true;
        }
        const send = el('button', p.send ? 'ovt-send' : 'ovt-send ovt-send--round', p.send ? '' : svg(IC.up));
        if (p.send) send.textContent = o.submitLabel || p.send;
        send.type = 'submit'; send.disabled = true; send.setAttribute('data-ovt-send', '');
        send.setAttribute('aria-label', o.submitLabel || p.send || 'Send');
        // A post or a reply says who sees it above the box (a phone's row keeps room for the tools); a chat or an agent's
        // box keeps its chip beside the send.
        const above = name === 'post' || name === 'comment';
        // Post · Ask · Do: one switch at the start of the row (a site opts in with verbs).
        const verbs = (Array.isArray(o.verbs) ? o.verbs : []).filter((v) => VERBS[v]);
        let verb = verbs.length ? (verbs.includes(o.verb) ? o.verb : verbs[0]) : 'post';
        const frame = o.frameBase || FRAME;
        const askTask = (o.ask && o.ask.task) || (name === 'agent' ? 'agent' : 'chat');
        let model = null;
        try { model = JSON.parse(localStorage.getItem(`ov:composer:model:${askTask}`) || 'null'); } catch { model = null; }
        model = model || { model: 'openvibe/auto', source: 'openvibe', name: 'Auto' };
        const sources = new Set((o.ask && o.ask.sources) || ['web', 'openvibe']);
        let switcher = null;
        if (verbs.length > 1) {
            switcher = el('div', 'ovc-verbs'); switcher.setAttribute('role', 'group'); switcher.setAttribute('aria-label', 'What this box does');
            verbs.forEach((v) => {
                const word = v === 'post' ? (o.submitLabel || p.send || 'Send') : VERBS[v].word;
                const b = el('button', 'ovc-verb', svg(IC[v === 'post' ? (p.send ? 'send' : 'send') : VERBS[v].icon]) + `<span>${word}</span>`);
                b.type = 'button'; b.dataset.verb = v; b.title = `${word}: ${VERBS[v].hint}`; b.setAttribute('aria-label', `${word}: ${VERBS[v].hint}`);
                b.addEventListener('click', () => setVerb(v));
                switcher.appendChild(b);
            });
            if (above && head) { switcher.classList.add('ovc-verbs--head'); head.appendChild(switcher); } else row.appendChild(switcher);
        }
        const askChips = el('div', 'ovc-ask-chips'); askChips.setAttribute('role', 'group'); askChips.setAttribute('aria-label', 'How it is answered');
        const modelChip = el('button', 'ovc-chip ovc-chip--btn', `${svg(IC.model)}<span class="ovc-chip-v"></span>`);
        modelChip.type = 'button'; modelChip.setAttribute('aria-haspopup', 'dialog');
        const paintModel = () => { modelChip.querySelector('.ovc-chip-v').textContent = model.name || model.model; modelChip.setAttribute('aria-label', `Model: ${model.name || model.model}. Change it`); };
        const srcChip = el('button', 'ovc-chip ovc-chip--btn', `${svg(IC.globe)}<span class="ovc-chip-v"></span>`);
        srcChip.type = 'button'; srcChip.setAttribute('aria-haspopup', 'dialog');
        const paintSources = () => {
            const on = SOURCES.filter(([id]) => sources.has(id) && (id !== 'page' || (o.ask && o.ask.context)));
            srcChip.querySelector('.ovc-chip-v').textContent = on.length ? on.map(([, w]) => w).join(' · ') : 'No sources';
            srcChip.classList.toggle('is-on', sources.has('web'));
            srcChip.setAttribute('aria-label', `Sources: ${srcChip.textContent}. Change them`);
        };
        const depthChip = chip({ name: 'depth', label: 'Depth', options: [['quick', 'Quick'], ['balanced', 'Balanced'], ['deep', 'Deep research']], value: (o.ask && o.ask.depth) || 'balanced' }, IC.gauge);
        askChips.append(modelChip, srcChip, depthChip);
        paintModel(); paintSources();
        modelChip.addEventListener('click', () => openModels());
        srcChip.addEventListener('click', () => openSources());
        row.appendChild(tools);
        if (!above) row.appendChild(chips);
        if (ring) row.appendChild(ring);
        row.appendChild(send);
        if (above && chips.children.length) head.appendChild(chips);
        if (head.children.length) body.appendChild(head);
        // Ask and Do's chips: a line of their own above the words (scrolls sideways on a narrow screen, never wider).
        if (verbs.includes('ask') || verbs.includes('do')) body.appendChild(askChips);
        body.append(ta, row);
        const note = el('p', 'ovc-note'); note.setAttribute('data-ovt-note', ''); note.setAttribute('role', 'status');
        form.append(body, note);
        host.appendChild(form);
        if (o.upload || o.mentions || o.commands || o.beforeSend) {
            mod({ id: `mount-${o.id || Math.random().toString(36).slice(2, 8)}`, match: (f) => f === form, upload: o.upload, mentions: o.mentions, commands: o.commands, beforeSend: o.beforeSend });
        }
        const api = enhance(form);
        // A post's or a reply's pictures and files go under its words, as a feed shows them; a chat or an agent's box keeps
        // them above the line it types in.
        if (above) { const strip = body.querySelector('.ovc-files'); if (strip) ta.after(strip); }
        if (ring) {
            const C = 62.83, fg = ring.querySelector('.ovc-ring-fg');
            const paint = () => {
                const used = ta.value.length / ta.maxLength;
                ring.hidden = !ta.value.length;
                fg.setAttribute('stroke-dashoffset', String(C * (1 - Math.min(1, used))));
                ring.classList.toggle('is-near', used >= 0.85 && used < 1);
                ring.classList.toggle('is-over', used >= 1);
            };
            ta.addEventListener('input', paint); paint();
        }
        const setBusy = (on) => { form.classList.toggle('is-busy', !!on); send.disabled = !!on || (!ta.value.trim() && !api.files().length); };
        const values = () => Object.fromEntries([...chips.querySelectorAll('select')].map((sel) => [sel.name, sel.value]));
        // While a run works the send is Stop (the agents portal's box): a click calls onStop, nothing is sent.
        let stopFn = null;
        const sendFace = send.innerHTML, sendLabel = send.getAttribute('aria-label');
        send.addEventListener('click', (e) => { if (!stopFn) return; e.preventDefault(); e.stopImmediatePropagation(); const f = stopFn; try { f(); } catch (err) { console.error(err); } }, true);
        const setRunning = (on, onStop) => {
            stopFn = on ? (typeof onStop === 'function' ? onStop : () => {}) : null;
            form.classList.toggle('is-running', !!on);
            if (on) { send.innerHTML = svg(IC.stop); send.classList.add('ovt-send--round'); send.setAttribute('aria-label', 'Stop'); send.title = 'Stop'; send.disabled = false; }
            else { send.innerHTML = sendFace; send.classList.toggle('ovt-send--round', !p.send); send.setAttribute('aria-label', sendLabel); send.title = ''; api.refresh(); }
        };
        // One bar above the box at a time: "Editing your message" or "Replying to …" (openvibe.design rule 138: a
        // message's actions are a cluster at its corner, and what they start is said here, in the box).
        let bar = null, barClose = null, editing = null, replying = null;
        const clearBar = () => {
            const f = barClose; barClose = null;
            if (bar) { bar.remove(); bar = null; }
            form.classList.remove('is-editing', 'is-replying');
            if (f) f();
        };
        const showBar = (icon, title, detail, onClose) => {
            clearBar();
            bar = el('div', 'ovc-bar', svg(icon));
            const t = el('b'); t.textContent = title;
            const d = el('span'); d.textContent = detail || '';
            const x = el('button', 'ovc-bar-x', svg(IC.x)); x.type = 'button'; x.title = 'Cancel'; x.setAttribute('aria-label', `Cancel: ${title}`);
            x.addEventListener('click', () => { clearBar(); ta.focus(); });
            bar.append(t, d, x);
            body.insertBefore(bar, head.parentNode === body ? head.nextSibling : body.firstChild);
            barClose = onClose;
        };
        const sendFaceOf = () => { send.innerHTML = sendFace; send.classList.toggle('ovt-send--round', !p.send); send.setAttribute('aria-label', sendLabel); send.title = ''; };
        const edit = (spec = {}) => {
            const draft = editing ? editing.draft : ta.value;
            if (replying) clearBar();
            showBar(IC.pen, spec.label || 'Editing your message', 'Enter saves · Esc cancels', () => {
                const was = editing; editing = null;
                sendFaceOf();
                if (was && !was.saved) { ta.value = was.draft; ta.dispatchEvent(new Event('input', { bubbles: true })); if (typeof was.onCancel === 'function') was.onCancel(); }
                api.refresh();
            });
            editing = { draft, onSave: spec.onSave, onCancel: spec.onCancel, saved: false };
            form.classList.add('is-editing');
            ta.value = String(spec.text || '');
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            send.innerHTML = svg(IC.check); send.classList.add('ovt-send--round'); send.setAttribute('aria-label', 'Save'); send.title = 'Save';
            api.refresh();
            ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length;
        };
        const reply = (spec = {}) => {
            if (editing) clearBar();
            const who = String(spec.name || 'someone');
            showBar(IC.reply, `Replying to ${who}`, String(spec.text || '').slice(0, 140), () => { const was = replying; replying = null; if (was && typeof was.onClear === 'function') was.onClear(); });
            replying = { data: spec.data !== undefined ? spec.data : { name: who, text: spec.text }, onClear: spec.onClear };
            form.classList.add('is-replying');
            ta.focus();
        };
        ta.addEventListener('keydown', (e) => { if (e.key === 'Escape' && bar) { e.preventDefault(); e.stopPropagation(); clearBar(); } });
        // ── Post · Ask · Do ──
        const postFace = send.innerHTML, postLabel = send.getAttribute('aria-label'), postRound = send.classList.contains('ovt-send--round');
        function setVerb(v) {
            if (!VERBS[v] || (verbs.length && !verbs.includes(v))) return;
            verb = v;
            form.dataset.verb = v;
            form.classList.toggle('is-asking', v !== 'post');
            if (switcher) switcher.querySelectorAll('.ovc-verb').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.verb === v)));
            if (v === 'post') { send.innerHTML = postFace; send.classList.toggle('ovt-send--round', postRound); send.setAttribute('aria-label', postLabel); }
            else { send.innerHTML = svg(IC[VERBS[v].icon]); send.classList.add('ovt-send--round'); send.setAttribute('aria-label', VERBS[v].word); }
            ta.placeholder = v === 'ask' ? 'Ask anything' : v === 'do' ? 'Tell Actor what to do' : (o.placeholder || ta.dataset.ovcPlaceholder || ta.placeholder);
            api.refresh();
        }
        ta.dataset.ovcPlaceholder = ta.placeholder;
        // A sheet (the whole width on a phone) for the model list and the sources.
        function sheet(title, build) {
            const dlg = el('dialog', 'ovc-sheet'); dlg.setAttribute('aria-label', title);
            dlg.innerHTML = `<div class="ovc-sheet-h"><b></b><button type="button" class="ovc-bar-x" aria-label="Close">${svg(IC.x)}</button></div><div class="ovc-sheet-b"></div>`;
            dlg.querySelector('b').textContent = title;
            const close = () => { try { dlg.close(); } catch { /* closed */ } dlg.remove(); };
            dlg.querySelector('.ovc-bar-x').addEventListener('click', close);
            dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
            dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
            document.body.appendChild(dlg);
            build(dlg.querySelector('.ovc-sheet-b'), close);
            if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
            return dlg;
        }
        function openModels() {
            sheet('Model', async (b, close) => {
                const find = el('input', 'ovc-sheet-find'); find.type = 'search'; find.placeholder = 'Find a model'; find.setAttribute('aria-label', 'Find a model');
                const list = el('div', 'ovc-models');
                b.append(find, list);
                const pick = (row) => {
                    model = { model: row.model, source: row.source || 'openvibe', ...(row.machine ? { machine: row.machine } : {}), name: row.name || row.model };
                    try { localStorage.setItem(`ov:composer:model:${askTask}`, JSON.stringify(model)); } catch { /* private mode */ }
                    paintModel(); close(); ta.focus();
                };
                const rowEl = (row, rec) => {
                    const r = el('div', 'ovc-model');
                    const btn = el('button', 'ovc-model-b'); btn.type = 'button';
                    btn.setAttribute('aria-pressed', String(row.model === model.model && (row.source || 'openvibe') === (model.source || 'openvibe')));
                    const mark = el('span', 'ovc-model-m'); mark.textContent = String(row.maker || row.name || row.model || '?').trim().charAt(0).toUpperCase();
                    const t = el('span', 'ovc-model-t'); const line = el('span', 'ovc-model-n'); const n = el('b'); n.textContent = row.name || row.model; line.appendChild(n); const d = el('small');
                    d.textContent = [money(row), row.speed ? `${row.speed}` : '', row.maker || ''].filter(Boolean).join(' · ') || row.detail || '';
                    if (rec) { const badge = el('em', 'ovc-model-rec'); badge.textContent = 'Recommended'; line.appendChild(badge); }
                    t.append(line, d); btn.append(mark, t);
                    btn.addEventListener('click', () => pick(row));
                    r.appendChild(btn);
                    if (row.url) { const a = el('a', 'ovc-model-x', svg(IC.ext)); a.href = row.url; a.target = '_blank'; a.rel = 'noopener'; a.title = 'Compare on OpenVibe.Exchange'; a.setAttribute('aria-label', `${row.name || row.model} on OpenVibe.Exchange`); r.appendChild(a); }
                    r.dataset.find = `${row.name || ''} ${row.model || ''} ${row.maker || ''}`.toLowerCase();
                    return r;
                };
                const auto = { model: 'openvibe/auto', source: 'openvibe', name: 'Auto', detail: 'OpenVibe picks a model for each question' };
                list.appendChild(rowEl(auto));
                const wait = el('p', 'ovc-sheet-note'); wait.textContent = 'Loading the models…'; list.appendChild(wait);
                try {
                    const data = await loadChoices(frame, askTask);
                    wait.remove();
                    const rec = data.recommended;
                    (data.groups || []).forEach((g) => {
                        if (!g.rows || !g.rows.length) return;
                        const h = el('h3'); h.textContent = g.title || g.id; list.appendChild(h);
                        g.rows.forEach((row) => list.appendChild(rowEl(row, rec && rec.model === row.model && (rec.source || 'openvibe') === (row.source || 'openvibe'))));
                    });
                    const more = el('a', 'ovc-sheet-more', `Every model, compared, on OpenVibe.Exchange ${svg(IC.ext)}`); more.href = 'https://openvibe.exchange/models'; more.target = '_blank'; more.rel = 'noopener';
                    list.appendChild(more);
                } catch (err) { wait.textContent = (err && err.message) || 'Models are unavailable right now.'; }
                find.addEventListener('input', () => {
                    const q = find.value.trim().toLowerCase();
                    list.querySelectorAll('.ovc-model').forEach((r) => { r.hidden = !!q && !r.dataset.find.includes(q); });
                });
                find.focus();
            });
        }
        function openSources() {
            sheet('What the answer may read', (b) => {
                SOURCES.forEach(([id, word, icon]) => {
                    if (id === 'page' && !(o.ask && o.ask.context)) return;
                    const lab = el('label', 'ovc-src', `${svg(IC[icon])}<span><b></b><small></small></span>`);
                    lab.querySelector('b').textContent = word;
                    lab.querySelector('small').textContent = id === 'web' ? 'Search the web (OpenVibe Search, then other engines)' : id === 'openvibe' ? 'Posts, streams, videos, wiki and pastes on OpenVibe' : id === 'mine' ? 'Your own posts, files and chats' : `This ${(o.ask.context && o.ask.context.kind) || 'page'}`;
                    const box = el('input'); box.type = 'checkbox'; box.checked = sources.has(id); box.setAttribute('role', 'switch');
                    box.addEventListener('change', () => { if (box.checked) sources.add(id); else sources.delete(id); paintSources(); });
                    lab.appendChild(box);
                    b.appendChild(lab);
                });
            });
        }
        // The answer (or the run) under the box: streamed text, its sources, the model and three ways on.
        let card = null;
        function answer(question) {
            if (card) card.remove();
            card = el('section', 'ovc-answer'); card.setAttribute('aria-live', 'polite');
            card.innerHTML = `<header>${svg(IC[verb === 'do' ? 'bolt' : 'spark'])}<b></b><small></small><button type="button" class="ovc-bar-x" aria-label="Close the answer">${svg(IC.x)}</button></header><div class="ovc-answer-t"></div><ol class="ovc-cites" hidden></ol><footer hidden></footer>`;
            card.querySelector('b').textContent = verb === 'do' ? 'Actor' : 'Answer';
            card.querySelector('small').textContent = model.name || '';
            const body = card.querySelector('.ovc-answer-t'), cites = card.querySelector('.ovc-cites'), foot = card.querySelector('footer');
            body.textContent = verb === 'do' ? 'Planning…' : 'Thinking…'; body.classList.add('is-waiting');
            card.querySelector('.ovc-bar-x').addEventListener('click', () => { card.remove(); card = null; });
            form.after(card);
            let started = false;
            const ctl = {
                el: card,
                append(delta) { if (!started) { body.textContent = ''; body.classList.remove('is-waiting'); started = true; } body.textContent += String(delta || ''); },
                set(t) { started = true; body.classList.remove('is-waiting'); body.textContent = String(t || ''); },
                cite(list) {
                    cites.replaceChildren();
                    (list || []).forEach((c, i) => {
                        const li = el('li'); const a = el('a'); a.href = c.url; a.target = '_blank'; a.rel = 'noopener nofollow';
                        a.textContent = `${c.n || i + 1}. ${c.title || c.site || c.url}`; if (c.site) a.title = c.site;
                        li.appendChild(a); cites.appendChild(li);
                    });
                    cites.hidden = !cites.children.length;
                },
                done(meta = {}) {
                    if (meta.answer != null) ctl.set(meta.answer);
                    if (meta.citations) ctl.cite(meta.citations);
                    if (meta.cost != null) card.querySelector('small').textContent = `${model.name || ''} · $${Number(meta.cost).toFixed(3)}`;
                    foot.replaceChildren();
                    const act = (label, fn) => { const b = el('button', 'ovc-answer-a'); b.type = 'button'; b.textContent = label; b.addEventListener('click', fn); foot.appendChild(b); };
                    if (verbs.includes('post')) act(name === 'chat' ? 'Send it' : name === 'comment' ? 'Reply with it' : 'Post it', () => { setVerb('post'); ta.value = body.textContent; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); });
                    act('Continue in Vibe', () => { form.dispatchEvent(new CustomEvent('ovc:continue', { bubbles: true, detail: { run: meta.run, question } })); if (root.OVDock && typeof root.OVDock.open === 'function') root.OVDock.open('vibe', { run: meta.run, text: question }); });
                    if (verb === 'ask' && verbs.includes('do')) act('Do this', () => { setVerb('do'); ta.value = question; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); });
                    foot.hidden = false;
                },
                fail(msg) { started = true; body.classList.remove('is-waiting'); body.classList.add('is-bad'); body.textContent = String(msg || 'That did not work. Try again.'); },
            };
            return ctl;
        }
        // Ask or Do through the Frame: start the run, then follow its events (AG-UI) into the card.
        async function viaFrame(value, ctl) {
            const r = await fetch(`${frame}/${value.verb}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(value) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok || !d.run) throw new Error(d.detail || d.error || (r.status === 401 ? 'Sign in to ask.' : 'Could not ask right now.'));
            const events = d.events || `${frame.replace(/\/api\/frame\/?$/, '')}/api/v1/runs/${encodeURIComponent(d.run)}/events`;
            if (typeof EventSource !== 'function') return;
            await new Promise((resolve) => {
                const es = new EventSource(events, { withCredentials: true });
                const end = () => { es.close(); resolve(); };
                es.onmessage = (m) => {
                    let ev = null; try { ev = JSON.parse(m.data); } catch { return; }
                    if (ev.type === 'TEXT_MESSAGE_CONTENT') ctl.append(ev.delta);
                    else if (ev.type === 'CUSTOM' && ev.name === 'citations') ctl.cite(ev.value);
                    else if (ev.type === 'RUN_FINISHED') { ctl.done({ run: d.run, ...(ev.result || {}) }); end(); }
                    else if (ev.type === 'RUN_ERROR') { ctl.fail(ev.message); end(); }
                };
                es.onerror = () => { if (es.readyState === 2) { ctl.fail('The answer stopped. Try again.'); end(); } };
            });
        }
        form.addEventListener('submit', async (e) => {
            if (verb === 'post' || editing) return;
            e.preventDefault(); e.stopImmediatePropagation();
            if (form.classList.contains('is-busy')) return;
            const text = ta.value.trim();
            if (!text && !api.files().length) return;
            const value = { verb, text, files: api.files(), uploads: api.uploads(), model, sources: [...sources], depth: depthChip ? depthChip.querySelector('select').value : 'balanced', context: (o.ask && o.ask.context) || null, chips: values() };
            const ctl = answer(text);
            setBusy(true);
            try {
                const own = verb === 'ask' ? o.onAsk : o.onDo;
                if (typeof own === 'function') await own(value, Object.assign(api, { card: ctl }));
                else await viaFrame({ ...value, files: undefined }, ctl);
                api.clear();
            } catch (err) { ctl.fail((err && err.message) || String(err)); }
            setBusy(false);
            api.refresh();
        }, true);
        if (verbs.length) setVerb(verb);

        // Saving an edit is not a send: it runs first and nothing else hears the submit.
        form.addEventListener('submit', async (e) => {
            if (!editing) return;
            e.preventDefault(); e.stopImmediatePropagation();
            if (form.classList.contains('is-busy')) return;
            const text = ta.value.trim(), ed = editing;
            if (!text) { api.ctx.note('A message can\'t be empty.'); return; }
            setBusy(true);
            let keep = false;
            try { keep = typeof ed.onSave === 'function' ? (await ed.onSave(text)) === false : false; }
            catch (err) { keep = true; api.ctx.note(String((err && err.message) || err)); }
            setBusy(false);
            if (!keep && editing === ed) { ed.saved = true; ta.value = ed.draft; ta.dispatchEvent(new Event('input', { bubbles: true })); clearBar(); }
            api.refresh();
        }, true);
        if (typeof o.onSubmit === 'function') {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (form.classList.contains('is-busy')) return;
                const value = { text: ta.value.trim(), files: api.files(), uploads: api.uploads(), audience: aud ? aud.querySelector('select').value : null, mode: md ? md.querySelector('select').value : null, chips: values(), reply: replying ? replying.data : null };
                setBusy(true);
                let keep = false;
                try { keep = (await o.onSubmit(value, api)) === false; }
                catch (err) { keep = true; api.ctx.note(String((err && err.message) || err)); }
                setBusy(false);
                if (!keep) { api.clear(); if (replying) clearBar(); }
                api.refresh();
            });
        }
        return Object.assign(api, { form, text: ta, send, note, setBusy, setRunning, values, edit, reply, clearBar, editing: () => !!editing,
            verb: () => verb, setVerb, model: () => model, sources: () => [...sources], answer });
    }

    // ── Your settings, in a sheet: what sends, voice, compact, your own commands.
    let sheet = null;
    function openSettings(from) {
        const opener = from || document.activeElement;
        needWindow().then((W) => settingsIn(W, opener));
    }
    function settingsIn(W, opener) {
        let win = null;
        if (!W && !sheet) {
            sheet = el('dialog', 'ovc-set');
            sheet.setAttribute('aria-label', 'Your composer');
            sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });
            document.body.appendChild(sheet);
        }
        const k = mac ? '⌘' : 'Ctrl';
        const host = W ? el('div', 'ovc-set ovc-set-in') : sheet;
        host.innerHTML = `<form method="dialog" class="ovc-set-f">${W ? '' : `<header class="ovc-set-h"><b>Your composer</b><button class="ovt-btn" value="done" aria-label="Done">${svg(IC.x)}</button></header>`}
<fieldset class="ovc-set-g"><legend>Send with</legend><label><input type="radio" name="send_key" value="enter"> Enter <small>(Shift+Enter for a new line)</small></label><label><input type="radio" name="send_key" value="mod-enter"> ${k}+Enter <small>(Enter for a new line)</small></label></fieldset>
<label class="ovc-set-c"><input type="checkbox" name="voice"> A microphone button${Speech ? '' : ' <small>(this browser cannot listen)</small>'}</label>
<label class="ovc-set-c"><input type="checkbox" name="compact"> A compact box</label>
<fieldset class="ovc-set-g"><legend>Your commands</legend><p class="ovc-set-p">Type / and the word, and its text goes in. Up to 50.</p><ul class="ovc-set-l"></ul>
<div class="ovc-set-add"><input name="trigger" placeholder="word" maxlength="30" pattern="[A-Za-z0-9_-]+" aria-label="The word after /"><textarea name="snippet" rows="2" maxlength="4000" placeholder="The text it puts in" aria-label="The text it puts in"></textarea><button type="button" class="ovc-set-btn" data-ovc-add>Add</button></div></fieldset>
<p class="ovc-set-p">${synced ? 'Saved to your account: the same on every OpenVibe site.' : 'Saved in this browser.'}</p></form>`;
        const f = host.querySelector('form');
        f.send_key.value = prefs.send_key;
        f.voice.checked = !!prefs.voice; f.voice.disabled = !Speech;
        f.compact.checked = prefs.density === 'compact';
        const list = host.querySelector('.ovc-set-l');
        const paintList = () => {
            list.innerHTML = '';
            (prefs.snippets || []).forEach((s, i) => {
                const li = el('li');
                const w = el('b'); w.textContent = `/${s.trigger}`;
                const t = el('span'); t.textContent = s.text.slice(0, 80);
                const x = el('button', 'ovt-btn', svg(IC.x)); x.type = 'button'; x.setAttribute('aria-label', `Remove /${s.trigger}`);
                x.addEventListener('click', () => { const next = prefs.snippets.slice(); next.splice(i, 1); setPrefs({ snippets: next }); paintList(); });
                li.append(w, t, x); list.appendChild(li);
            });
        };
        paintList();
        f.addEventListener('change', (e) => {
            if (e.target.name === 'send_key') setPrefs({ send_key: f.send_key.value });
            else if (e.target.name === 'voice') setPrefs({ voice: f.voice.checked });
            else if (e.target.name === 'compact') setPrefs({ density: f.compact.checked ? 'compact' : 'comfy' });
        });
        host.querySelector('[data-ovc-add]').addEventListener('click', () => {
            const w = f.trigger.value.trim().replace(/^\//, ''), t = f.snippet.value;
            if (!/^[\w-]{1,30}$/.test(w)) { f.trigger.focus(); return; }
            if (!t.trim()) { f.snippet.focus(); return; }
            setPrefs({ snippets: (prefs.snippets || []).filter((s) => s.trigger !== w).concat([{ trigger: w, text: t }]) });
            f.trigger.value = ''; f.snippet.value = '';
            paintList(); f.trigger.focus();
        });
        f.addEventListener('submit', (e) => e.preventDefault());
        if (W) win = W.open({ id: 'ov-composer-settings', title: 'Your composer', body: host, kind: 'dialog', size: 'sm', from: opener, focus: 'input[name=send_key]:checked' });
        else { if (typeof sheet.showModal === 'function') sheet.showModal(); else sheet.setAttribute('open', ''); const first = f.querySelector('input[name=send_key]:checked'); if (first) first.focus(); }
        return win;
    }

    function mod(m) {
        if (!m || !m.id) return;
        const i = mods.findIndex((x) => x.id === m.id);
        if (i >= 0) mods[i] = m; else mods.push(m);
        live.forEach((c) => c.refresh());
    }
    function scan(scope) { (scope || document).querySelectorAll('[data-ovt-composer], [data-ovc]').forEach((f) => enhance(f)); }

    root.OpenVibeComposer = { enhance, mount, tool, mod, scan, presets: () => Object.keys(PRESET), tools: () => Object.keys(TOOL), settings: openSettings, get prefs() { return Object.assign({}, prefs); }, setPrefs };
    if (typeof module === 'object' && module.exports) module.exports = { enhance, mount, tool, mod, scan };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scan(), { once: true }); else scan();
    document.addEventListener('ov:boost:load', () => { live.forEach((c) => { if (!c.form.isConnected) c.destroy(); }); scan(); });
    pull();
})(typeof window !== 'undefined' ? window : globalThis);
