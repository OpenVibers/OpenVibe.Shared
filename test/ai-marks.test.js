'use strict';
// openvibe-shared/ai-marks: a model id, slug, family or provider name finds its maker's mark; anything else gets the
// neutral spark (never a letter, never another maker's mark); marks carry no markup but drawing; the licence is named.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const m = require('../ai-marks');
const DATA = require('../ai-marks-data');

const cases = {
    'deepseek/deepseek-chat': 'DeepSeek', 'claude-opus-5-5': 'Anthropic', 'anthropic': 'Anthropic', 'gpt-5-nano': 'OpenAI', 'openai/o3-mini': 'OpenAI',
    'gemini-4-carbon': 'Google', 'gemma-3-27b': 'Gemma', 'qwen3.8-max': 'Qwen', 'kimi-k3.1-pro': 'Kimi', 'glm-5.3-flash': 'GLM',
    'MiniMax-M3.1-Flash': 'MiniMax', 'llama-3.2-1b-instruct': 'Meta', 'mixtral-8x7b': 'Mistral', 'grok-4': 'xAI', 'phi-4': 'Microsoft',
    'nemotron-70b': 'NVIDIA', 'command-r-plus': 'Cohere', 'sonar-pro': 'Perplexity',
};
for (const [text, key] of Object.entries(cases)) assert.strictEqual(m.family(text), key, text);
for (const text of ['abliterated-model-large-flash', 'openrouter/auto', '', null]) assert.strictEqual(m.family(text), null, String(text));

const ds = m.mark('deepseek/deepseek-chat', { size: 28 });
assert.match(ds, /^<span class="ov-aim ov-aim--deepseek" style="--ov-aim:28px" role="img" aria-label="DeepSeek" title="DeepSeek"><svg viewBox="0 0 24 24"/);
const other = m.mark('<script>x</script>');
assert.ok(other.includes('ov-aim--other') && other.includes('aria-label="&lt;script&gt;x&lt;/script&gt;"') && !other.includes('<script>'), 'unknown: the spark, the name escaped');
assert.ok(!/aria-label/.test(m.mark('qwen', { label: false })) && /aria-hidden="true"/.test(m.mark('qwen', { label: false })), 'decorative when the row names it');

for (const [k, inner] of Object.entries(DATA)) {
    assert.ok(/^<(path|circle|rect|g|ellipse|polygon)[\s>]/.test(inner), `${k} is drawing markup`);
    assert.ok(!/<script|on[a-z]+=|href=|<image|<foreignObject|<style/i.test(inner), `${k} carries nothing but drawing`);
}
assert.strictEqual(m.FAMILIES.length, 16);
const head = fs.readFileSync(path.join(__dirname, '..', 'ai-marks-data.js'), 'utf8').slice(0, 400);
assert.ok(/@lobehub\/icons-static-svg/.test(head) && /MIT/.test(head), 'the source and its licence are named');
assert.ok(/\.ov-aim\{/.test(m.CSS) && /var\(--text-primary/.test(m.CSS), 'the tile follows the theme');
console.log('ai-marks: makers found from ids, the spark for anyone else, drawing only, the licence named');
