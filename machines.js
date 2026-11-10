/* Shared picker for a person's OpenVibe Link machines. Pages provide a signed-in
 * Network token through OpenVibeNavbar and may declare data-needs for filtering. */
(function (root) {
  'use strict';

  function safe(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function canRun(machine) {
    const roles = Array.isArray(machine.roles) ? machine.roles : [];
    return roles.map((role) => ({ 'codes.worker': 'coding jobs', 'desks.host': 'browser desks', 'ai.host': 'your AI models', 'bot.robot': 'robot controls' }[role] || role)).join(', ') || 'Link connection';
  }
  function needsMachine(machine, needs) {
    if (!needs) return true;
    const roles = Array.isArray(machine.roles) ? machine.roles : [];
    const map = { desktop: ['desks.host'], browser: ['desks.host'], models: ['ai.host'], worker: ['codes.worker'] };
    return (map[needs] || [needs]).some((role) => roles.includes(role));
  }
  function sessionToken() {
    try { const nav = root.OpenVibeNavbar; return nav && nav.session && nav.session.token || null; } catch (_) { return null; }
  }
  const svg = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const G = {
    pc: svg('<rect x="3" y="4.5" width="18" height="12" rx="2.5"/><path d="M8.5 20h7M12 16.5V20"/>'),
    phone: svg('<rect x="7" y="2.5" width="10" height="19" rx="3"/><path d="M10.5 18h3"/>'),
    auto: svg('<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'),
    plus: svg('<path d="M12 5.5v13M5.5 12h13"/>'),
    lock: svg('<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
    off: svg('<path d="M4 4l16 16M8.6 8.7A6.5 6.5 0 0 0 5.5 12M18.5 12a6.5 6.5 0 0 0-5-6.3M2.5 9a12 12 0 0 1 3-2.3M21.5 9a12 12 0 0 0-6-3.4M12 18.5v.01"/>'),
  };
  // "2026-11-10T08:14:00Z" → "3 h ago": when a computer was last seen, as a person would say it.
  function ago(iso) {
    const t = Date.parse(iso); if (!isFinite(t)) return String(iso || '');
    const m = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (m < 2) return 'just now'; if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24); return d < 30 ? `${d} ${d === 1 ? 'day' : 'days'} ago` : new Date(t).toISOString().slice(0, 10);
  }
  const CSS = `
.ovmc { display: grid; gap: 8px; }
.ovmc p { margin: 0; }
.ovmc-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.ovmc-row { position: relative; margin: 0; padding: 0; border: 0; background: none; }
.ovmc-row > label { position: relative; display: flex; align-items: center; gap: 12px; min-height: 60px; box-sizing: border-box; padding: 8px 14px 8px 10px; border-radius: 16px; cursor: pointer; background: color-mix(in srgb, var(--text-primary, #e6edf7) 4.5%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text-primary, #e6edf7) 9%, transparent); transition: background-color .15s, box-shadow .2s, transform .12s; }
.ovmc-row > label:hover { background: color-mix(in srgb, var(--text-primary, #e6edf7) 8%, transparent); }
.ovmc-row > label:active { transform: scale(.985); }
.ovmc-row input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.ovmc-row:has(input:checked) > label { background: color-mix(in srgb, var(--accent, #3b82f6) 14%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--accent, #3b82f6) 55%, transparent); }
.ovmc-row:has(input:focus-visible) > label { outline: 2px solid var(--accent, #3b82f6); outline-offset: 2px; }
.ovmc-ic { flex: none; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; color: var(--accent-light, var(--accent, #60a5fa)); background: color-mix(in srgb, var(--accent, #3b82f6) 13%, transparent); }
.ovmc-row.is-off .ovmc-ic { color: var(--text-muted, #93a0b4); background: color-mix(in srgb, var(--text-primary, #e6edf7) 7%, transparent); }
.ovmc-row .ovk-row-main { display: grid; gap: 2px; min-width: 0; flex: 1; }
.ovmc-row .ovk-row-top { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ovmc-row strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }
.ovmc-row .ovk-row-sub { font-size: 12.5px; color: var(--text-secondary, #a8b3c4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovmc-state { flex: none; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-muted, #93a0b4); }
.ovmc-state::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; opacity: .6; }
.ovmc-state.is-on { color: var(--success-text, #34d399); }
.ovmc-state.is-on::before { opacity: 1; box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 22%, transparent); animation: ovmc-on 2.4s ease-in-out infinite; }
@keyframes ovmc-on { 50% { box-shadow: 0 0 0 calc(3px + 3px * var(--ov-move, 1)) color-mix(in srgb, currentColor 6%, transparent); } }
.ovmc-tick { flex: none; width: 22px; height: 22px; border-radius: 50%; box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--text-primary, #e6edf7) 26%, transparent); transition: background-color .15s, box-shadow .15s; }
.ovmc-row:has(input:checked) .ovmc-tick { background: var(--accent, #3b82f6); box-shadow: none; position: relative; }
.ovmc-row:has(input:checked) .ovmc-tick::after { content: ""; position: absolute; left: 8px; top: 4.5px; width: 5px; height: 10px; border-right: 2.4px solid #fff; border-bottom: 2.4px solid #fff; transform: rotate(45deg); animation: ovmc-tick .25s cubic-bezier(.2, 1.6, .4, 1) both; }
@keyframes ovmc-tick { from { transform: rotate(45deg) scale(0); } }
.ovmc-note { display: flex; align-items: center; gap: 12px; padding: 8px 12px 8px 10px; border-radius: 16px; font-size: 14px; color: var(--text-secondary, #a8b3c4); background: color-mix(in srgb, var(--text-primary, #e6edf7) 4.5%, transparent); }
.ovmc-note .ovmc-ic { color: var(--text-muted, #93a0b4); background: color-mix(in srgb, var(--text-primary, #e6edf7) 7%, transparent); }
.ovmc-wait { display: grid; gap: 6px; }
.ovmc-wait span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.ovmc-wait i { display: block; height: 60px; border-radius: 16px; background: linear-gradient(100deg, color-mix(in srgb, var(--text-primary, #e6edf7) 5%, transparent) 40%, color-mix(in srgb, var(--text-primary, #e6edf7) 11%, transparent) 50%, color-mix(in srgb, var(--text-primary, #e6edf7) 5%, transparent) 60%) 0 0 / 220% 100%; animation: ovmc-wait 1.4s ease-in-out infinite; }
.ovmc-wait i + i { opacity: .6; animation-delay: .15s; }
@keyframes ovmc-wait { to { background-position: -120% 0; } }
.ovmc-add a.ovk-btn { display: flex; align-items: center; justify-content: flex-start; gap: 12px; width: 100%; min-height: 60px; box-sizing: border-box; padding: 8px 14px 8px 10px; border-radius: 16px; text-align: left; text-decoration: none; color: inherit; background: none; border: 1.5px dashed color-mix(in srgb, var(--accent, #3b82f6) 45%, transparent); transition: background-color .15s, border-color .15s, transform .12s; }
.ovmc-add a.ovk-btn:hover { background: color-mix(in srgb, var(--accent, #3b82f6) 9%, transparent); border-color: var(--accent, #3b82f6); }
.ovmc-add a.ovk-btn:active { transform: scale(.985); }
.ovmc-add b { display: block; font-size: 15px; }
.ovmc-add small { display: block; font-size: 12.5px; font-weight: 500; color: var(--text-secondary, #a8b3c4); }`;
  function styles() {
    if (!root.document || root.document.getElementById('ovmc-style')) return;
    const st = root.document.createElement('style'); st.id = 'ovmc-style'; st.textContent = CSS; root.document.head.appendChild(st);
  }
  function mount(host, options) {
    styles();
    options = options || {};
    if (!host) throw new TypeError('A machine picker host is required');
    const needs = options.needs || host.getAttribute('data-needs') || '';
    const inputName = options.name || host.getAttribute('data-name') || 'machine';
    const autoLabel = options.autoLabel || host.getAttribute('data-auto-label') || '';
    const principalName = options.principalName || host.getAttribute('data-principal-name') || '';
    let principalValue = host.getAttribute('data-principal-value') || '';
    let selected = options.value || host.getAttribute('data-value') || (host.querySelector('input[type="hidden"]') || {}).value || '';
    let machines = [];
    let state = 'loading';
    const addUrl = (options.addUrl || host.getAttribute('data-add-url') || 'https://openvibe.link/add-computer');
    function paint() {
      const hidden = host.querySelector('input[type="hidden"]');
      const value = hidden ? hidden.value : selected;
      let html = '';
      const row = (id, checked, glyph, name, meta, sub, cls) => `<li class="ovk-row ovmc-row${cls || ''}"><label class="ovk-row--static"><input type="radio" name="${safe(inputName)}__choice" value="${safe(id)}"${checked ? ' checked' : ''}><span class="ovmc-ic" aria-hidden="true">${glyph}</span><span class="ovk-row-main"><span class="ovk-row-top"><strong>${safe(name)}</strong>${meta}</span>${sub ? `<span class="ovk-row-sub"><span>${safe(sub)}</span></span>` : ''}</span><span class="ovmc-tick" aria-hidden="true"></span></label></li>`;
      const auto = (checked) => (autoLabel ? row('', checked, G.auto, autoLabel, '', 'OpenVibe picks where it runs') : '');
      const note = (glyph, text) => `<p class="ovmc-note" role="status"><span class="ovmc-ic" aria-hidden="true">${glyph}</span><span>${text}</span></p>`;
      if (state === 'loading') html = '<p class="ovmc-wait" role="status"><span>Loading your Link computers…</span><i></i><i></i></p>';
      else if (state === 'signed-out') html = note(G.lock, 'Sign in to choose a computer.');
      else if (state === 'unreachable') html = note(G.off, 'Link could not be reached. Your current choice is kept.');
      else if (!machines.length) html = note(G.pc, needs ? 'None of your computers can run this yet.' : 'You have no computers on Link yet.') + (autoLabel ? `<ul class="ovk-list ovmc-list">${auto(true)}</ul>` : '');
      else {
        html = '<ul class="ovk-list ovmc-list">' + auto(!value) + machines.map((m) => {
          const system = m.system || m.os || m.kind || 'Link computer';
          const meta = `<span class="ovk-row-meta ovmc-state${m.online ? ' is-on' : ''}">${m.online ? 'Online' : (m.last_seen_at ? `Seen ${safe(ago(m.last_seen_at))}` : 'Offline')}</span>`;
          return row(m.id, m.id === value, /phone|android|ios/i.test(system) ? G.phone : G.pc, m.name || m.id, meta, `${system} · Can run: ${canRun(m)}`, m.online ? '' : ' is-off');
        }).join('') + '</ul>';
      }
      html += `<p class="ovmc-add"><a class="ovk-btn ovk-btn--quiet" href="${safe(addUrl)}?return_to=${encodeURIComponent(location.href)}"><span class="ovmc-ic" aria-hidden="true">${G.plus}</span><span><b>Add a computer</b><small>Through OpenVibe Link, once, for every site</small></span></a></p>`;
      host.classList.add('ovmc');
      host.innerHTML = html;
      let hiddenInput = host.querySelector('input[type="hidden"]');
      if (!hiddenInput) { hiddenInput = document.createElement('input'); hiddenInput.type = 'hidden'; host.appendChild(hiddenInput); }
      hiddenInput.name = inputName; hiddenInput.value = selected;
      host.value = selected;
      if (principalName) {
        let principal = host.querySelector('input[type="hidden"][data-machine-principal]');
        if (!principal) { principal = document.createElement('input'); principal.type = 'hidden'; principal.setAttribute('data-machine-principal', ''); host.appendChild(principal); }
        principal.name = principalName;
        principal.value = (machines.find((m) => m.id === selected) || {}).principal_id || principalValue;
      }
      host.querySelectorAll('input[type="radio"]').forEach((radio) => radio.addEventListener('change', () => {
        if (!radio.checked) return;
        selected = radio.value; hiddenInput.value = selected;
        host.value = selected;
        const chosen = machines.find((m) => m.id === selected);
        if (principalName) {
          const principal = host.querySelector('input[type="hidden"][data-machine-principal]');
          principalValue = chosen && chosen.principal_id || '';
          if (principal) principal.value = principalValue;
        }
        host.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { id: selected, machine: chosen || null } }));
      }));
    }
    async function load() {
      const token = options.getToken ? await options.getToken() : sessionToken();
      if (!token) { state = 'signed-out'; paint(); return; }
      state = 'loading'; paint();
      try {
        const api = options.apiBase || host.getAttribute('data-api-base') || 'https://openvibe.network';
        const response = await (options.fetch || fetch)(`${api.replace(/\/$/, '')}/api/v1/machines`, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, credentials: 'omit' });
        if (!response.ok) throw new Error(`Link returned ${response.status}`);
        const data = await response.json();
        machines = (Array.isArray(data.machines) ? data.machines : []).filter((m) => m && typeof m.id === 'string' && needsMachine(m, needs));
        state = 'ready';
      } catch (_) { state = 'unreachable'; }
      paint();
    }
    paint(); load();
    return { reload: load, get value() { return selected; }, setValue(id) { selected = String(id || ''); paint(); } };
  }
  root.OpenVibeMachines = { mount, needsMachine, canRun };
  if (root.document) root.document.querySelectorAll('[data-ov-machines]').forEach((host) => mount(host));
  if (typeof module === 'object' && module.exports) module.exports = root.OpenVibeMachines;
})(typeof window !== 'undefined' ? window : globalThis);
