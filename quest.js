'use strict';

/** Mount a plain-kit daily quest card. The host page owns its look and authenticated fetch. */
function mountQuestCards(root = document, { fetchImpl = globalThis.fetch, token, baseUrl = 'https://openvibe.quest' } = {}) {
    const nodes = [...root.querySelectorAll('[data-ov-quest]')];
    const escape = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const pending = nodes.map(async (node) => {
        const response = await fetchImpl(`${baseUrl}/api/v1/quests/today`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include',
        });
        if (!response.ok) { node.replaceChildren(); node.hidden = true; return; }
        const quest = await response.json();
        node.innerHTML = `<section aria-label="Today's quest"><h2>${escape(quest.title)}</h2><p>${escape(quest.story)}</p><ol>${quest.steps.map((step) => `<li><a href="${escape(step.href)}">${escape(step.sentence)}</a>${step.done ? ' <span>Done</span>' : ''}</li>`).join('')}</ol><p>${Number(quest.progress) || 0} of ${quest.steps.length} steps</p></section>`;
        node.hidden = false;
    });
    return Promise.allSettled(pending);
}

module.exports = { mountQuestCards };
