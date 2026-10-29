'use strict';
const assert = require('node:assert/strict');
const express = require('express');
const agent = require('../agent-layer');
const seo = require('../seo');
const shell = require('../shell');
const kit = require('../kit');
const descriptor = { id: 'example', name: 'Example', purpose: 'Public examples', home: 'https://example.com/', docs: '/docs', api: '/api', openapi: '/openapi.json', mcp: { url: '/mcp', auth: 'bearer' }, policy: { auth: ['none', 'Network OIDC', 'bearer'], rateLimit: '60 requests/minute' } };
const manifest = JSON.parse(JSON.stringify(agent.agentManifest(descriptor)));
assert.equal(manifest.openapi, 'https://example.com/openapi.json');
assert.equal(manifest.mcp.transport, 'streamable-http');
assert.equal(manifest.policy.robots, 'https://openvibe.network/bot.json');
assert.deepEqual(manifest.policy.auth, descriptor.policy.auth);
assert.equal(agent.agentManifest(descriptor, { name: 'Override' }).name, 'Override');
assert.deepEqual(JSON.parse(JSON.stringify(agent.agentManifest())), { network: 'OpenVibe', policy: { robots: 'https://openvibe.network/bot.json' } });
const html = shell.page({ title: 'Guide & examples', canonical: 'https://example.com/guide', body: '<main><h1>Guide</h1>' + kit.section({ title: 'Steps', body: '<p>Read <a href="/docs">the docs</a>.</p><img src="/photo.png" alt="A real photo"><img src="/blank.png"><ol start="3"><li>First<ul><li>Nested</li></ul></li><li>Second</li></ol><table><tr><th>Name</th><th>Value</th></tr><tr><td>A | B</td><td>1</td></tr></table><h3>Details</h3><script>secretCode()</script><div hidden>hiddenText</div>' }) + '</main>' });
const app = express();
agent.mount(app, { descriptor, render: path => path === '/guide' || path === '/' ? { html, updated: '2026-10-29' } : path === '/error' ? Promise.reject(new Error('render failed')) : null });
app.use((err, req, res, next) => res.status(500).send(err.message));
(async () => {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        const m = await fetch(base + '/.well-known/agent.json');
        assert.match(m.headers.get('content-type'), /^application\/json/);
        assert.equal(m.headers.get('cache-control'), 'public, max-age=3600');
        assert.deepEqual(await m.json(), manifest);
        for (const path of ['/guide.md', '/guide?format=markdown', '/index.md']) {
            const res = await fetch(base + path);
            assert.equal(res.status, 200);
            assert.equal(res.headers.get('content-type'), 'text/markdown; charset=utf-8');
            assert.equal(res.headers.get('cache-control'), 'public, max-age=300');
            const text = await res.text();
            assert.match(text, /^---\ntitle: "Guide & examples"\ncanonical:/);
            assert.match(text, /updated: "2026-10-29"/);
            assert.match(text, /# Guide & examples/);
            assert.ok(text.indexOf('# Guide\n') < text.indexOf('## Steps'));
            assert.ok(text.indexOf('## Steps') < text.indexOf('### Details'));
            assert.match(text, /\[the docs\]\(\/docs\)/);
            assert.match(text, /!\[A real photo\]\(\/photo.png\)/);
            assert.match(text, /!\[\]\(\/blank.png\)/);
            assert.match(text, /3\. First/);
            assert.match(text, /   - Nested/);
            assert.match(text, /\| Name \| Value \|\n\| --- \| --- \|\n\| A \\\| B \| 1 \|/);
            assert.ok(!text.includes('secretCode') && !text.includes('hiddenText'));
        }
        const res = await fetch(base + '/guide');
        assert.match(res.headers.get('link'), /<\/guide.md>; rel="alternate"; type="text\/markdown"/);
        assert.equal(res.headers.get('vary'), 'Accept');
        const doc = await res.text();
        assert.match(doc, /<link rel="alternate" type="text\/markdown" href="\/guide.md">/);
        assert.match(doc, /<link rel="describedby" href="https:\/\/example.com\/llms.txt">/);
        assert.match(shell.page({ canonical: descriptor.home, agentLayer: true }), /rel="describedby"/);
        assert.equal((await fetch(base + '/missing.md')).status, 404);
        assert.equal((await fetch(base + '/missing?format=markdown')).status, 404);
        assert.equal((await fetch(base + '/error.md')).status, 500);
        const head = await fetch(base + '/guide.md', { method: 'HEAD' });
        assert.equal(await head.text(), '');
        assert.equal(head.headers.get('content-type'), 'text/markdown; charset=utf-8');
        assert.match((await fetch(base + '/guide', { headers: { Accept: 'text/markdown' } })).headers.get('content-type'), /text\/markdown/);
        assert.equal((await fetch(base + '/guide.md', { method: 'POST' })).status, 404);
        assert.match((await fetch(base + '/guide', { headers: { Accept: 'text/html, text/markdown;q=0' } })).headers.get('content-type'), /text\/html/);
        assert.match(seo.llmsTxt({ name: 'Example', markdown: true, sections: [{ title: 'Pages', links: [{ title: 'Home', url: descriptor.home }] }], optional: [{ title: 'External', url: 'https://other.example/', html: true }] }), /index.md\)[\s\S]*## Optional[\s\S]*\(HTML\)/);
        // 4.39.0: kit markup reads as a person sees it: a card's who · count · when keep their spaces, its ⋯ menu and
        // buttons are not content, and a stats strip is "- label: value" lines.
        {
            const cards = '<main>' + kit.rail({ title: 'Latest', items: [kit.card({ href: '/p/1', title: 'Release notes', who: 'Maticus', count: [12, 'views'], sub: 'Markdown' })] })
                + kit.stats([[26, 'services you can call', '/docs/api'], [106, 'capabilities']]) + '</main>';
            const t = agent.markdownTwin({ html: cards, title: 'Home', canonical: 'https://example.com/' });
            assert.match(t, /Maticus 12 views/, t);
            assert.ok(!/Maticus12/.test(t) && !/Share|Scroll back|Scroll on/.test(t), 'no run-together text, no menu or arrow buttons');
            assert.match(t, /- \[services you can call\]\(\/docs\/api\): 26\n- capabilities: 106/);
            assert.match(agent.markdownTwin({ html: '<main><p>H<sub>2</sub>O and x<sup>2</sup></p></main>', title: 't', canonical: '/' }), /H2O and x2/, 'sub and sup stay inside the word');
        }
        console.log('agent-layer: manifest, real Frame/Kit twins, discovery, methods, errors and llms checks passed');
    } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(err => { console.error(err); process.exitCode = 1; });
