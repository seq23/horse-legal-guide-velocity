#!/usr/bin/env node
'use strict';
/**
 * Install Microsoft Clarity only on public form or purchase pages (e9).
 *
 * The snippet resolves its project id from location.hostname rather than being
 * hardcoded, because some trees serve more than one domain from the same files
 * (spryexecutiveos.com and billionairehighperformancecoach.com are one tree with
 * two separate Clarity projects). A hardcoded id would send one domain's sessions
 * to the other domain's project.
 *
 * Reconcile existing tags too, so a removed form also removes its recording tag.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = path.join(ROOT, 'data/clarity_projects.json');
const MARKER = 'data-clarity-loader';

if (!fs.existsSync(CONFIG)) {
  console.error(`clarity: missing ${path.relative(ROOT, CONFIG)}`);
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
const projects = cfg.projects || {};
const outDir = path.resolve(ROOT, cfg.public_root || '.');
const skipDirs = new Set([
  ...(cfg.skip_dirs || []),
  '.git', 'node_modules', '.pages-output', 'dist', 'scripts', 'data', 'reports',
  'artifacts', 'docs', 'tests', 'fixtures', 'config', 'content', 'templates',
]);
const skipFiles = new Set(cfg.skip_files || []);

if (!Object.keys(projects).length) {
  console.error('clarity: no projects configured');
  process.exit(1);
}

// One loader for every page. It picks the project by host so a shared tree cannot
// report one domain's sessions under another domain's project.
const snippet = `<script ${MARKER}>(function(w,d,m){var h=(w.location.hostname||"").toLowerCase().replace(/^www\\./,"");var id=m[h];if(!id)return;w.clarity=w.clarity||function(){(w.clarity.q=w.clarity.q||[]).push(arguments)};var s=d.createElement("script");s.async=1;s.src="https://www.clarity.ms/tag/"+id;var f=d.getElementsByTagName("script")[0];f.parentNode.insertBefore(s,f)})(window,document,${JSON.stringify(projects)})</script>`;

let touched = 0;
let already = 0;
let skipped = 0;
let removed = 0;

function formOrBuy(html, rel) {
  // Operator forms and error pages are not visitor conversion steps. Ignore
  // script strings and comments that merely describe a form or checkout.
  if (/^(admin|agency)\//.test(rel) || rel === '404.html') return false;
  const markup = html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  if (/<form\b/i.test(markup)) return true;
  return [...markup.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].some((m) => {
    try {
      const url = new URL(m[1] ?? m[2] ?? m[3], 'https://horselegalguide.com/');
      return /^https?:$/.test(url.protocol) && (
        /(^|\.)(gumroad\.com|stripe\.com|paypal\.com|lemonsqueezy\.com|square\.link|checkout\.shopify\.com)$/.test(url.hostname)
        || /\/(checkout|cart|buy|order|book(ing)?)(\/|$)/i.test(url.pathname)
      );
    } catch { return false; }
  });
}

function walk(dir, depth) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!skipDirs.has(entry.name)) walk(abs, depth + 1); continue; }
    if (!entry.name.endsWith('.html')) continue;
    const rel = path.relative(outDir, abs).replace(/\\/g, '/');
    if (skipFiles.has(rel) || skipFiles.has(entry.name)) { skipped += 1; continue; }
    const original = fs.readFileSync(abs, 'utf8');
    const html = original.replace(/<script\b[^>]*\bdata-clarity-loader\b[^>]*>[\s\S]*?<\/script>\s*/gi, '');
    if (!formOrBuy(html, rel)) {
      if (html !== original) { fs.writeFileSync(abs, html); removed += 1; }
      skipped += 1;
      continue;
    }
    if (!/<\/head>/i.test(html)) { skipped += 1; continue; }
    const next = html.replace(/<\/head>/i, `${snippet}</head>`);
    if (next === original) { already += 1; continue; }
    fs.writeFileSync(abs, next);
    touched += 1;
  }
}
walk(outDir, 0);

console.log(`clarity: installed on ${touched} form/buy page(s); ${already} unchanged; ${removed} removed; ${skipped} skipped`);
