'use strict';
const marks = require('./ai-marks');
    const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function render({ task, label = task, endpoint = '/api/ai/choices', saveEndpoint = '/api/ai/choices', choice = null, name = 'choice' } = {}) {
        const templates = marks.FAMILIES.map(m => `<template data-maker="${esc(m)}">${marks.mark(m, { label: false })}</template>`).join('');
        return `<span class="ov-ai-choice" data-ai-choice data-task="${esc(task)}" data-task-label="${esc(label)}" data-endpoint="${esc(endpoint)}" data-save-endpoint="${esc(saveEndpoint)}"><button class="ovk-button ovk-button-quiet ov-ai-chip" type="button" aria-haspopup="dialog" data-ai-open>${marks.mark(choice?.model || 'OpenVibe', { label: false })}<span data-ai-label>${esc(choice?.model || 'Choose model')}</span><span aria-hidden="true">▾</span></button><input type="hidden" name="${esc(name)}" value="${choice ? esc(JSON.stringify(choice)) : ''}" data-ai-value>${templates}<template data-maker="Other">${marks.mark('Other', {label:false})}</template></span>`;
    }

module.exports = { render };
