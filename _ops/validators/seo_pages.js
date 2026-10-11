// Shared readers for the SEO hygiene gates (favicon/manifest, social meta,
// JSON-LD page kinds, home definition + speakable, sitemap count, IndexNow key).
// Every gate walks the same public page set so no two of them keep their own list.
const fs = require('fs');
const path = require('path');
const { collectRequired } = require('./helpers');

const DIST = 'dist';
const OPERATOR_DIRS = new Set(['admin', 'agency']);

function siteOrigin() {
  const config = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/system/config.json'), 'utf8'));
  return String(config.site_domain || 'https://horselegalguide.com').replace(/\/$/, '');
}

// Every public HTML page in dist/: index.html files outside the operator dirs.
function publicPages(label) {
  const distAbs = path.resolve(process.cwd(), DIST);
  return collectRequired(DIST, (file) => file.endsWith(`${path.sep}index.html`), label)
    .map((abs) => {
      const rel = path.relative(distAbs, abs).split(path.sep).join('/');
      const urlPath = '/' + rel.replace(/index\.html$/, '');
      return { abs, rel: `dist/${rel}`, urlPath, html: fs.readFileSync(abs, 'utf8') };
    })
    .filter((p) => !OPERATOR_DIRS.has(p.urlPath.split('/')[1]));
}

function decode(value) {
  return String(value || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function metaContent(html, attr, name) {
  const re = new RegExp(`<meta\\s+${attr}="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+content="([^"]*)"`, 'gi');
  const all = [...html.matchAll(re)].map((m) => decode(m[1]));
  return all;
}

function isNoindex(html) {
  return /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html);
}

function canonicalOf(html) {
  const m = html.match(/<link rel="canonical" href="([^"]+)"/i);
  return m ? m[1] : '';
}

function jsonLdGraph(html) {
  const nodes = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    const doc = JSON.parse(m[1]);
    const items = Array.isArray(doc) ? doc : (doc['@graph'] || [doc]);
    nodes.push(...items);
  }
  return nodes;
}

// The dist/ file a same-origin absolute or root-relative URL is served from.
function distFileFor(url) {
  const origin = siteOrigin();
  let p = String(url || '');
  if (p.startsWith(origin)) p = p.slice(origin.length);
  if (!p.startsWith('/')) return null;
  return path.resolve(process.cwd(), DIST, '.' + p.split('?')[0]);
}

function pngSize(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

module.exports = { DIST, siteOrigin, publicPages, metaContent, isNoindex, canonicalOf, jsonLdGraph, distFileFor, pngSize, decode };
