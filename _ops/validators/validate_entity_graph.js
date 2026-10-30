// validate:entity-graph - the site's entity record, read as code.
//
// Authority audit, 30 Oct 2026: no repo in the grid had anything checking that
// the sameAs it publishes is the sameAs it means to publish. This gate makes
// data/entities/entity.json the one record and holds every built page to it:
//
//   - entity.json itself is well formed: https URLs, no duplicates, nothing on
//     the site's own host (a sameAs pointing at yourself says nothing), nothing
//     listed both as published and as pending, and - this is a client site -
//     no parentOrganization (no Spry Labs, no West Peek).
//   - every public page's Organization node carries exactly entity.sameAs, and
//     the same @id, name, logo and description.
//
// Rule 0: zero public pages, or zero Organization nodes across them, is a
// failure, never a pass. The weekly entity_backlink_watch keeps entity.json
// true against the live web; this gate keeps the build true to entity.json.
const fs = require('fs');
const path = require('path');
const { createReport } = require('./helpers');
const { publicPages, jsonLdGraph } = require('./seo_pages');

const ENTITY = 'data/entities/entity.json';
const report = createReport('validate_entity_graph', 'page');

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; }
}
function block(file, code, message, fixHint) {
  report.addIssue({ file, code, message, fixHint, blocking: true });
}

let entity = null;
let summary = 'entity graph not checked';
try {
  entity = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), ENTITY), 'utf8'));
} catch (e) {
  block(ENTITY, 'entity_record_unreadable', `${ENTITY} is missing or not JSON: ${e.message}`, 'Restore data/entities/entity.json; write_jsonld.js reads the Organization node from it.');
}

if (entity) {
  const siteHost = String(entity.site_host || '').toLowerCase();
  if (!siteHost) block(ENTITY, 'entity_site_host_missing', 'entity.json has no site_host, so self-reference cannot be checked.');
  for (const key of ['@id', 'name', 'url', 'logo', 'description']) {
    if (!entity[key] || typeof entity[key] !== 'string') block(ENTITY, 'entity_field_missing', `entity.json has no ${key}.`);
  }
  if (!Array.isArray(entity.sameAs) || !entity.sameAs.length) {
    block(ENTITY, 'entity_same_as_empty', 'entity.json sameAs is empty: the publisher has nothing that identifies it off this site.');
  }
  const same = Array.isArray(entity.sameAs) ? entity.sameAs : [];
  const pending = (entity.profiles_pending || []).map((p) => (typeof p === 'string' ? p : p && p.url));
  const awaiting = (entity.profiles_awaiting_client_approval || []).map((p) => p && p.url);
  const seen = new Set();
  for (const url of same) {
    const host = hostOf(url);
    if (!host || !/^https:\/\//.test(url)) block(ENTITY, 'entity_same_as_not_https_url', `sameAs entry "${url}" is not an https URL.`);
    if (host && siteHost && (host === siteHost || host.endsWith(`.${siteHost}`))) {
      block(ENTITY, 'entity_same_as_self_reference', `sameAs entry "${url}" is on the site's own host ${siteHost}.`, 'sameAs names other places the same entity lives; remove the self link.');
    }
    if (seen.has(url)) block(ENTITY, 'entity_same_as_duplicate', `sameAs lists "${url}" twice.`);
    seen.add(url);
    if (pending.includes(url) || awaiting.includes(url)) block(ENTITY, 'entity_same_as_also_pending', `"${url}" is in sameAs and also listed as pending/awaiting approval.`);
  }
  if (entity.site_kind === 'client' && entity.parentOrganization) {
    block(ENTITY, 'entity_client_has_parent', `Client site declares parentOrganization ${JSON.stringify(entity.parentOrganization)}; a client site is published by the client alone.`);
  }
  const parentHost = hostOf(entity.parentOrganization && (entity.parentOrganization['@id'] || entity.parentOrganization));
  if (parentHost && /westpeek|west-peek/.test(parentHost)) {
    block(ENTITY, 'entity_parent_names_west_peek', 'parentOrganization points at West Peek; Spry and client sites never link West Peek.');
  }

  const pages = publicPages('validate:entity-graph');
  let orgNodes = 0;
  for (const page of pages) {
    let graph;
    try { graph = jsonLdGraph(page.html); } catch (e) {
      block(page.rel, 'entity_jsonld_unparseable', `JSON-LD does not parse: ${e.message}`);
      continue;
    }
    for (const org of graph.filter((n) => n && n['@type'] === 'Organization')) {
      orgNodes += 1;
      const got = Array.isArray(org.sameAs) ? org.sameAs : (org.sameAs ? [org.sameAs] : []);
      const want = same;
      const equal = got.length === want.length && [...got].sort().every((u, i) => u === [...want].sort()[i]);
      if (!equal) block(page.rel, 'entity_same_as_drift', `Organization sameAs ${JSON.stringify(got)} != entity.json sameAs ${JSON.stringify(want)}.`, 'scripts/lib/write_jsonld.js must read sameAs from data/entities/entity.json; rebuild.');
      for (const url of got) {
        const host = hostOf(url);
        if (host && siteHost && (host === siteHost || host.endsWith(`.${siteHost}`))) block(page.rel, 'entity_page_same_as_self_reference', `Organization sameAs "${url}" is on the site's own host.`);
      }
      if (org['@id'] !== entity['@id']) block(page.rel, 'entity_id_drift', `Organization @id "${org['@id']}" != entity.json "${entity['@id']}".`);
      if (org.name !== entity.name) block(page.rel, 'entity_name_drift', `Organization name "${org.name}" != entity.json "${entity.name}".`);
      const logo = org.logo && (org.logo.url || org.logo);
      if (logo !== entity.logo) block(page.rel, 'entity_logo_drift', `Organization logo "${logo}" != entity.json "${entity.logo}".`);
      if (org.description !== entity.description) block(page.rel, 'entity_description_drift', `Organization description "${org.description}" != entity.json "${entity.description}".`);
    }
  }
  if (!orgNodes) {
    block('dist/', 'entity_zero_organization_nodes', `Checked ${pages.length} public pages and found no Organization node: the gate examined nothing.`);
  }
  summary = `Entity graph consistent: ${orgNodes} Organization nodes across ${pages.length} public pages carry entity.json (sameAs=${same.length}, no self-reference, @id/name/logo/description match).`;
}

report.finalize(summary);
