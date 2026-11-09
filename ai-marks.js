'use strict';
/**
 * openvibe-shared/ai-marks — the AI makers' marks, one place for every site that lists models (Exchange, Report, Chat,
 * Bench, Design). The owner, 11-09, on Exchange's home: model-family glyphs we drew ourselves read as "what is it even
 * supposed to be?"; the AI comparison plan asks for the makers' recognisable marks, as every leaderboard shows them.
 *
 *   const marks = require('openvibe-shared/ai-marks');
 *   marks.family('deepseek/deepseek-chat')   → 'DeepSeek'   (a model id, a slug, a family or a provider name)
 *   marks.mark('anthropic', { size: 24 })     → <span class="ov-aim ov-aim--anthropic" …><svg …>…</svg></span>
 *   marks.mark('someone-new')                 → the neutral spark (never a letter in a circle, never another maker's mark)
 *   marks.CSS                                 the few rules (a tile in the theme's tokens), once per page
 *
 * Marks are monochrome in currentColor (they follow the theme); the maker's name is the label (label: false when the row
 * already names it). The drawings come from @lobehub/icons-static-svg (MIT; see ai-marks-data.js and NOTICE in it).
 */
const DATA = require('./ai-marks-data');

const NAMES = {
    OpenAI: 'OpenAI', Anthropic: 'Anthropic', Google: 'Google', Gemma: 'Gemma', Meta: 'Meta', DeepSeek: 'DeepSeek', Qwen: 'Qwen',
    Mistral: 'Mistral AI', Kimi: 'Moonshot AI', GLM: 'Zhipu AI', MiniMax: 'MiniMax', Microsoft: 'Microsoft', xAI: 'xAI',
    NVIDIA: 'NVIDIA', Cohere: 'Cohere', Perplexity: 'Perplexity',
};
// Order matters: the more specific first (gemma before gemini/google; grok before x).
const RULES = [
    [/gemma/i, 'Gemma'], [/gemini|google|palm|bard/i, 'Google'], [/claude|anthropic/i, 'Anthropic'],
    [/deepseek/i, 'DeepSeek'], [/qwen|qwq|alibaba|tongyi/i, 'Qwen'], [/kimi|moonshot/i, 'Kimi'], [/glm|zhipu|z\.ai|chatglm/i, 'GLM'],
    [/minimax|abab/i, 'MiniMax'], [/llama|meta\b|^meta|facebook/i, 'Meta'], [/mistral|mixtral|codestral|ministral|magistral|pixtral/i, 'Mistral'],
    [/\bphi-?\d|microsoft|wizardlm/i, 'Microsoft'], [/grok|x-ai|\bxai\b/i, 'xAI'], [/nvidia|nemotron/i, 'NVIDIA'],
    [/cohere|command-?r|\baya\b/i, 'Cohere'], [/perplexity|sonar/i, 'Perplexity'],
    [/openai|gpt|\bo[134](-|\b)|chatgpt|davinci|whisper|dall-?e/i, 'OpenAI'],
];
const SPARK = '<path d="M12 3l1.9 5.2L19 10l-5.1 1.8L12 17l-1.9-5.2L5 10l5.1-1.8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** The maker's family key for a model id, slug, family or provider name; null when none matches. */
function family(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    const exact = Object.keys(DATA).find((k) => k.toLowerCase() === t.toLowerCase());
    if (exact) return exact;
    for (const [re, key] of RULES) if (re.test(t)) return key;
    return null;
}

/** The mark as HTML: a tile with the maker's drawing (or the neutral spark), labelled with the maker's name. */
function mark(text, { size = 24, label = true, cls = '' } = {}) {
    const key = family(text);
    const px = Math.max(12, Math.min(96, Number(size) || 24));
    const name = key ? NAMES[key] : String(text || 'Other');
    const svg = `<svg viewBox="0 0 24 24" width="${Math.round(px * 0.62)}" height="${Math.round(px * 0.62)}" fill="currentColor" fill-rule="evenodd" aria-hidden="true" focusable="false">${key ? DATA[key] : SPARK}</svg>`;
    return `<span class="ov-aim ov-aim--${key ? key.toLowerCase() : 'other'}${cls ? ` ${esc(cls)}` : ''}" style="--ov-aim:${px}px"${label ? ` role="img" aria-label="${esc(name)}" title="${esc(name)}"` : ' aria-hidden="true"'}>${svg}</span>`;
}

const CSS = '.ov-aim{display:inline-grid;place-items:center;flex:none;width:var(--ov-aim,24px);height:var(--ov-aim,24px);border-radius:calc(var(--ov-aim,24px) * .28);'
    + 'background:color-mix(in srgb,var(--text-primary,#e8ecf3) 8%,transparent);color:var(--text-primary,#e8ecf3);box-shadow:inset 0 0 0 1px var(--border,rgba(255,255,255,.1))}'
    + '.ov-aim svg{display:block}.ov-aim--other{color:var(--accent,#3b82f6)}';

module.exports = { family, mark, CSS, FAMILIES: Object.keys(DATA), NAMES };
