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
  function mount(host, options) {
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
      if (state === 'loading') html = '<p role="status">Loading your Link computers…</p>';
      else if (state === 'signed-out') html = '<p role="status">Sign in to choose a computer.</p>';
      else if (state === 'unreachable') html = '<p role="status">Link could not be reached. Your current choice is kept.</p>';
      else if (!machines.length) html = '<p role="status">None yet.</p>' + (autoLabel ? `<ul class="ovk-list"><li class="ovk-row"><label class="ovk-row--static"><input type="radio" name="${safe(inputName)}__choice" value="" checked><span class="ovk-row-main"><span class="ovk-row-top"><strong>${safe(autoLabel)}</strong></span></span></label></li></ul>` : '');
      else {
        html = '<ul class="ovk-list">' + (autoLabel ? `<li class="ovk-row"><label class="ovk-row--static"><input type="radio" name="${safe(inputName)}__choice" value=""${value ? '' : ' checked'}><span class="ovk-row-main"><span class="ovk-row-top"><strong>${safe(autoLabel)}</strong></span></span></label></li>` : '') + machines.map((m) => {
          const name = m.name || m.id;
          const system = m.system || m.os || m.kind || 'Link computer';
          const status = m.online ? 'Online' : (m.last_seen_at ? `Last seen ${safe(m.last_seen_at)}` : 'Offline');
          const checked = m.id === value ? ' checked' : '';
          return `<li class="ovk-row"><label class="ovk-row--static"><input type="radio" name="${safe(inputName)}__choice" value="${safe(m.id)}"${checked}><span class="ovk-row-main"><span class="ovk-row-top"><strong>${safe(name)}</strong><span class="ovk-row-meta">${safe(status)}</span></span><span class="ovk-row-sub"><span>${safe(system)} · Can run: ${safe(canRun(m))}</span></span></span></label></li>`;
        }).join('') + '</ul>';
      }
      html += `<p><a class="ovk-btn ovk-btn--quiet" href="${safe(addUrl)}?return_to=${encodeURIComponent(location.href)}">Add a computer</a></p>`;
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
