const fs=require('fs'),path=require('path');const{renderLayout}=require('../lib/render_page');const{readJson}=require('../lib/load_config');
const { clusterIndex, siblingBlock } = require('../lib/site_navigation');
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');const dir=p=>fs.mkdirSync(p,{recursive:true});const sp=v=>String(v||'').replace(/^\/+|\/+$/g,'');
function section(t){return {insight:'insights',article:'articles',whitepaper:'whitepapers',deep_authority:'authority',authority:'authority',template:'templates'}[t]||`${t}s`;}function label(t){return{insight:'Insight',article:'Article',whitepaper:'White paper',deep_authority:'Authority brief',authority:'Authority brief',template:'Template and tool'}[t]||String(t||'Editorial')}function title(s){return{insights:'Insights',articles:'Articles',whitepapers:'White Papers',authority:'Authority Briefs',templates:'Templates and Tools'}[s]||s}function cadence(s){return{insights:'Daily',articles:'Weekly',whitepapers:'Monthly',authority:'Quarterly',templates:'On demand'}[s]||'Scheduled'}
function date(e){return e.publish_date||e.scheduled_date||e.date}function approved(e){return e.status==='approved'||e.review_status==='approved'||e.status==='published'}function due(e,t){return /^\d{4}-\d{2}-\d{2}$/.test(date(e)||'')&&date(e)<=t}function today(){return process.env.PUBLISH_TODAY||new Date().toISOString().slice(0,10)}
function liveSlug(e){let s=sp(e.slug||e.entry_id).replace(/^drafts\/\d{4}-\d{2}-\d{2}\//,'').replace(/^drafts\//,'').replace(/^\d{4}-\d{2}-\d{2}\//,'');return`/${section(e.content_type)}/${date(e)}/${sp(s)}/`}
function parse(raw){let m=raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);return m?m[2].trim():raw}function inline(x){return esc(x).replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')}

/**
 * Markdown -> HTML for editorial drafts and the pages they publish to.
 *
 * Three constructs were added beyond the original paragraph/list/heading set,
 * all of them because content already in the queue was silently losing meaning:
 *
 *  - Tables. Every one of the 300 queued drafts carries a "defensible data
 *    atom" written as a markdown table (a clause map, a comparison table, a
 *    risk matrix). None of them rendered as a table: the pipe rows fell through
 *    to the paragraph branch and shipped as a run-on line of pipes. The data
 *    atom is the part of the draft most likely to be quoted by an answer
 *    engine, so this was the worst possible thing to render as mush.
 *
 *  - Blockquotes. Template and clause text has to be visually separable from
 *    the explanation around it, or a reader cannot tell which words are the
 *    document and which words are the commentary.
 *
 *  - ```generator fences. See scripts/build/render_document_tool.js for why a
 *    working fill-in tool is the differentiator on these queries.
 *
 * Everything except the generator block is still escaped through inline(): raw
 * HTML in a draft body is content, not markup, and is not trusted here.
 */
function md(raw){
  const { renderDocumentTool, renderToolAssets } = require('./render_document_tool');
  const tools = [];
  // Pull fenced generator blocks out before line parsing so their JSON is never
  // treated as prose. Any other fenced block is kept as escaped preformatted
  // text rather than being dropped on the floor.
  const withoutFences = String(raw).replace(/```([a-z0-9_-]*)\r?\n([\s\S]*?)```/gi, (whole, lang, inner) => {
    if (String(lang).toLowerCase() !== 'generator') {
      tools.push(`<pre class="draft-pre">${esc(inner.trim())}</pre>`);
      return `\nTOOLSLOT${tools.length - 1}\n`;
    }
    let spec;
    try { spec = JSON.parse(inner); }
    catch (err) {
      // A malformed spec must be loud. A tool that silently renders as nothing
      // is exactly the "job produced nothing and CI stayed green" failure this
      // repo already guards against elsewhere.
      throw new Error(`write_editorial_pages: generator block is not valid JSON: ${err.message}`);
    }
    tools.push(renderDocumentTool(spec, tools.length));
    return `\nTOOLSLOT${tools.length - 1}\n`;
  });

  const out = [];
  let p = [], l = [], q = [], rows = [];
  const fp = () => { if (p.length) { out.push(`<p>${inline(p.join(' '))}</p>`); p = []; } };
  const fl = () => { if (l.length) { out.push(`<ul>${l.map(x => `<li>${inline(x)}</li>`).join('')}</ul>`); l = []; } };
  const fq = () => { if (q.length) { out.push(`<blockquote class="clause-text"><p>${q.map(inline).join('</p><p>')}</p></blockquote>`); q = []; } };
  const cells = (line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const ft = () => {
    if (!rows.length) { return; }
    // A separator row (|---|---|) marks the row above it as the header.
    const isRule = (r) => r.every((c) => /^:?-{2,}:?$/.test(c));
    const body = rows.filter((r) => !isRule(r));
    const hasHead = rows.length > 1 && isRule(rows[1]);
    const head = hasHead ? body.shift() : null;
    const thead = head ? `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` : '';
    const tbody = `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    out.push(`<div class="table-scroll"><table>${thead}${tbody}</table></div>`);
    rows = [];
  };
  const flushAll = () => { fp(); fl(); fq(); ft(); };

  for (const r of String(withoutFences).split(/\r?\n/)) {
    const line = r.trim();
    if (!line) { flushAll(); continue; }
    const placeholder = line.match(/^TOOLSLOT(\d+)$/);
    if (placeholder) { flushAll(); out.push(tools[Number(placeholder[1])]); continue; }
    if (/^\|.*\|$/.test(line)) { fp(); fl(); fq(); rows.push(cells(line)); continue; }
    ft();
    if (/^#{1,6}\s+/.test(line)) {
      fp(); fl(); fq();
      const n = Math.min(3, Math.max(2, line.match(/^#+/)[0].length));
      out.push(`<h${n}>${inline(line.replace(/^#{1,6}\s+/, ''))}</h${n}>`);
    } else if (/^>\s?/.test(line)) {
      fp(); fl();
      q.push(line.replace(/^>\s?/, ''));
    } else if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      fp(); fq();
      l.push(line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''));
    } else {
      fl(); fq();
      p.push(line);
    }
  }
  flushAll();
  // The tool stylesheet and behaviour are emitted once per rendered body, and
  // only when a body actually contains a tool.
  const assets = /class="doc-tool"/.test(out.join('')) ? renderToolAssets() : '';
  return out.join('\n') + assets;
}
const nav='<nav><p><a href="/">Home</a> · <a href="/insights/">Insights</a> · <a href="/articles/">Articles</a> · <a href="/whitepapers/">White Papers</a> · <a href="/authority/">Authority Briefs</a> · <a href="/coverage/">Coverage</a></p></nav>';

/**
 * The topic hubs, listed on each editorial landing page.
 *
 * These landings carry no live items while the publishing cadence is frozen, so
 * before this a reader who arrived on /insights/ had six links out and none of
 * them reached the library. The hubs are the pages the site already publishes;
 * nothing here is new content.
 */
function hubDirectory() {
  const hubs = [...clusterIndex().values()];
  return siblingBlock({
    heading: 'Topic hubs',
    intro: 'The clusters this library covers, each collecting the educational pages filed under it.',
    items: hubs.map((h) => ({ slug: h.slug, title: h.title })),
  });
}
function landing(sec,items,cfg){const rows=items.filter(e=>e.section===sec).map(e=>`<article class="review-card"><h2><a href="${e.live_slug}">${esc(e.title)}</a></h2><p class="muted">${esc(e.publish_date)} · ${esc(label(e.content_type))} · ${esc((e.source_cluster||'general').replace(/-/g,' '))}</p><p>${esc(e.source_query_title||e.notes||'Neutral educational equine-law analysis.')}</p></article>`).join('\n')||'<p class="muted">No approved due items are live in this section yet. Approved future-dated items remain queued until their scheduled date.</p>';let tt=title(sec);return renderLayout({title:`${tt} | Horse Legal Guide`,description:`Scheduled ${tt.toLowerCase()} for Horse Legal Guide.`,url:`/${sec}/`,body:`<header class="content-header"><span class="eyebrow">${cadence(sec)} editorial surface</span><h1>${esc(tt)}</h1><p class="muted">Approved ${tt.toLowerCase()} publish here only when their scheduled date has arrived. Approval alone does not mass-publish future content.</p></header>${nav}<section><h2>Live ${esc(tt.toLowerCase())}</h2>${rows}</section>${hubDirectory()}<section class="routing-block"><p>This editorial surface supports general equine-law education and routes specific legal questions back to <a href="${esc(cfg.canonical_domain)}">${esc(cfg.canonical_brand_name)}</a>.</p></section>`})}
function writeEditorialPages(dist){const cfg=readJson('data/system/config.json'),backlog=readJson('data/system/editorial_backlog.json'),t=today(),live=[];for(const e of backlog){e.publish_date=date(e);
  // Cleared unconditionally, every run, before the gate below decides whether
  // to set them back. A stale live_slug left over from a run where this entry
  // WAS live (then got rejected, or unapproved) is exactly as wrong a signal
  // to generate_admin_manifest.js as one that was never gated at all.
  delete e.live_slug;delete e.section;
  if(!approved(e)||!due(e,t))continue;if(!e.github_path||!fs.existsSync(path.resolve(process.cwd(),e.github_path)))continue;
  // live_slug/section are set ONLY here, on an entry that has actually passed
  // both gates above, and only these get persisted to editorial_backlog.json
  // below. generate_admin_manifest.js reads entry.live_slug as its sole
  // "public_url" signal - setting it unconditionally on every entry (as this
  // used to, in-memory only) would have made every one of the 306 backlog
  // entries look published the moment that mutation started being persisted.
  e.live_slug=liveSlug(e);e.section=section(e.content_type);
  live.push(e);const d=path.join(dist,sp(e.live_slug));dir(d);let body=`<header class="content-header"><span class="eyebrow">${esc(label(e.content_type))} · ${esc(e.publish_date)}</span><h1>${esc(e.title)}</h1><p class="muted">General educational information for the horse world. This page is scheduled publishing output, not legal advice.</p></header>${nav}<article>${md(parse(fs.readFileSync(path.resolve(process.cwd(),e.github_path),'utf8')))}</article><nav><p><a href="/${e.section}/">Back to ${esc(title(e.section))}</a></p></nav>`;fs.writeFileSync(path.join(d,'index.html'),renderLayout({title:e.title,description:(e.source_query_title||e.title).slice(0,155),url:e.live_slug,body}))}const BASE_SECTIONS=['insights','articles','whitepapers','authority'];/* A section landing is written for the four standing cadences, plus any
   section that actually has a live page in it. Nothing new appears on the
   public site until an entry in that section is both owner-approved and
   past its scheduled date, so a queued-but-unapproved family never creates
   an empty public index - and an approved one can never publish under a
   section whose landing page does not exist, which would leave its own
   'Back to' link pointing at a 404. */const sections=[...new Set([...BASE_SECTIONS,...live.map(e=>e.section)])];for(const s of sections){dir(path.join(dist,s));fs.writeFileSync(path.join(dist,s,'index.html'),landing(s,live,cfg))}fs.writeFileSync(path.join(dist,'editorial-publishing-state.json'),JSON.stringify({today:t,live_count:live.length,live_entries:live.map(e=>({entry_id:e.entry_id,content_type:e.content_type,publish_date:e.publish_date,live_slug:e.live_slug}))},null,2));
  // Confirmed 2026-09-03: a revoke correctly clears e.live_slug above and
  // removes the rendered dist/ page, but horselegalguide.com kept serving a
  // stale cached 200 for the revoked path anyway - a Cloudflare Pages edge
  // cache behaviour that survives both a per-URL purge and "Purge
  // Everything" (see functions/_shared/live_gate.js and RUNBOOK.md's "Cache
  // purge on revoke"). This file is the denylist that gate reads at request
  // time: every path that was ever live and is not live right now, keyed off
  // the same revoked_from_live/previously_live_slug fields
  // validate_admin_approval_reaches_live.js already trusts. An entry revoked
  // and never re-approved is denied; an entry revoked and later re-approved
  // back to the SAME slug is correctly excluded (e.live_slug was just reset
  // above to equal previously_live_slug again).
  const revokedPaths=[...new Set(backlog.filter(e=>e.revoked_from_live&&e.previously_live_slug&&e.live_slug!==e.previously_live_slug).map(e=>e.previously_live_slug))];
  fs.writeFileSync(path.join(dist,'editorial-revoked-paths.json'),JSON.stringify({today:t,revoked_paths:revokedPaths},null,2));
  // live_slug/section/publish_date above were only ever mutated on the
  // in-memory backlog array, never written back to
  // data/system/editorial_backlog.json - so scripts/admin/generate_admin_manifest.js,
  // which runs later in the same build and re-reads that file fresh from disk,
  // always saw public_url:null even for an entry that this function had just
  // published. /admin/'s "Pages published by this system" card showed "0...
  // never" while the live count next to it, and the article itself, said
  // otherwise. Persisting it here is what makes generate_admin_manifest.js see
  // the same truth this function just wrote to dist/.
  fs.writeFileSync(path.resolve(process.cwd(),'data/system/editorial_backlog.json'),JSON.stringify(backlog,null,2)+'\n');
  return live}
// md/parse are exported so the draft preview surface renders a draft body with
// the exact same markdown pipeline the published page will use. A preview that
// renders differently from the eventual page is not a preview.
module.exports={writeEditorialPages,section,label,liveSlug,date,approved,due,md,parse};
