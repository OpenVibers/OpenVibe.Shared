'use strict';

const express = require('express');
const serve = require('openvibe-shared/serve');
const shell = require('openvibe-shared/shell');
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

app.get('/llms-full.txt', (req, res) => {
    res.set('Cache-Control', cache.assetHeaders(req.path));
    res.type('text/plain').send(seo.llmsFull({ site: name, summary: name, base: home, sections: [{ title: 'Pages', pages: [{ title: 'Home', url: '/', text: name }] }] }));
});

app.get('/', cache.applyHtml(), (req, res) => {
    res.type('html').send(shell.page({
        name,
        title: name,
        siteName: name,
        description: name,
        canonical: home,
        summary: name,
        url: home,
        body: `<main><h1>${seo.esc(name)}</h1></main>`,
        footer: { service: name, variant: 'compact' },
    }));
});

module.exports = app;
