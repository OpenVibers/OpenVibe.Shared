'use strict';

const express = require('express');
const serve = require('openvibe-shared/serve');
const frame = require('openvibe-shared/frame');
const seo = require('openvibe-shared/seo');
const cache = require('openvibe-shared/cache-policy');

const name = '__NAME__';
const siteUrl = new URL(process.env.SITE_URL || 'http://localhost:3000/');
const home = new URL('/', siteUrl).href;
const sitemap = new URL('/sitemap.xml', siteUrl).href;
const app = express();

app.use('/shared', serve.handler());

app.get('/robots.txt', (req, res) => {
    res.set('Cache-Control', cache.assetHeaders(req.path));
    res.type('text/plain').send(seo.robotsTxt({ sitemaps: [sitemap] }));
});

app.get('/sitemap.xml', (req, res) => {
    res.set('Cache-Control', cache.assetHeaders(req.path));
    res.type('application/xml').send(seo.sitemapXml([{ loc: home }]));
});

app.get('/llms.txt', (req, res) => {
    res.set('Cache-Control', cache.assetHeaders(req.path));
    res.type('text/plain').send(seo.llmsTxt({ name, summary: name, sections: [{ title: 'Pages', links: [{ title: 'Home', url: home }] }] }));
});

app.get('/', cache.applyHtml(), (req, res) => {
    const head = seo.headTags({ title: name, siteName: name, description: name, canonical: home });
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${head}
<script src="${serve.url('web-runtime.js')}" defer></script>
<script src="${serve.url('navbar.js')}" defer></script>
<script src="${serve.url('footer.js')}" defer></script>
<script>window.addEventListener('DOMContentLoaded', function () { OpenVibeNavbar.init({ service: '${name}' }); OVWebRuntime.create({ features: {}, routes: [] }).boot(); });</script>
</head>
<body>
${frame.noscriptNav({ name })}
<main><h1>${seo.esc(name)}</h1></main>
${frame.footer({ service: name, variant: 'compact' })}
</body>
</html>`);
});

module.exports = app;
