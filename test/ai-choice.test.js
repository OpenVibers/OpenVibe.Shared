'use strict';
const assert=require('assert');
const {render}=require('../ai-choice');
const html=render({task:'design.icon',label:'icon',choice:{model:'anthropic/claude-opus-5-5',source:'openvibe'}});
assert(html.includes('aria-haspopup="dialog"'));assert(html.includes('ov-aim--anthropic'));assert(html.includes('name="choice"'));
assert(!render({task:'<script>alert(1)</script>',label:'" onload="x'}).includes('<script>'));
const files=require('../files');assert(files.isBrowserFile('ov-ai-choice.js'));assert(files.isBrowserFile('ov-ai-choice.css'));
console.log('AI choice renders safe, named controls and uses the shared maker marks');
