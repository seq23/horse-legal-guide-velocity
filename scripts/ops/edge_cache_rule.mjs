#!/usr/bin/env node
/**
 * Keeps the zone's Cache Rule (phase http_request_cache_settings) and the
 * dynamic-redirect phase exactly as this file says. Idempotent; run by
 * .github/workflows/edge-cache-purge.yml before every post-deploy purge, so
 * the zone can never drift from the repo.
 *
 * The rule makes horselegalguide.com eligible for the zone cache and
 * RESPECTS ORIGIN headers, so functions/_shared/edge_cache.js stays the only
 * thing deciding what is cached (s-maxage on public 200s only). The
 * expression also excludes the dynamic prefixes - defence in depth, kept
 * equal to edge_cache.js BYPASS_PREFIXES by test/edge-cache.test.js.
 * www is redirected in the middleware, so the redirect phase holds no rules.
 *
 * Usage: CLOUDFLARE_API_TOKEN=... node scripts/ops/edge_cache_rule.mjs [--dry-run]
 * Exits non-zero on any API failure (Rule 0: never a silent pass).
 */
export const ZONE_ID = '376d976e8beceb16c2f1728b2be1f8cf';
export const HOST = 'horselegalguide.com';
export const EXCLUDED_PREFIXES = ['/api/', '/admin', '/agency', '/data/'];
export const RULE_DESCRIPTION = 'horselegalguide edge cache (repo: scripts/ops/edge_cache_rule.mjs)';

export function cacheRuleset() {
  const exclusions = EXCLUDED_PREFIXES.map((p) => `not starts_with(http.request.uri.path, "${p}")`).join(' and ');
  return {
    rules: [{
      description: RULE_DESCRIPTION,
      expression: `(http.host eq "${HOST}" and ${exclusions})`,
      action: 'set_cache_settings',
      action_parameters: {
        cache: true,
        edge_ttl: { mode: 'respect_origin' },
        browser_ttl: { mode: 'respect_origin' },
      },
      enabled: true,
    }],
  };
}

export const REDIRECT_RULESET = { rules: [] };

async function put(token, phase, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/phases/${phase}/entrypoint`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(`PUT ${phase} -> HTTP ${res.status} ${JSON.stringify(json.errors || [])}`);
  return (json.result && json.result.rules) || [];
}

async function main() {
  const dry = process.argv.includes('--dry-run');
  if (dry) { console.log(JSON.stringify({ http_request_cache_settings: cacheRuleset(), http_request_dynamic_redirect: REDIRECT_RULESET }, null, 2)); return; }
  const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not set - the edge cache rule cannot be kept in sync.');
  const cache = await put(token, 'http_request_cache_settings', cacheRuleset());
  const redirect = await put(token, 'http_request_dynamic_redirect', REDIRECT_RULESET);
  console.log(`edge cache rule: ${cache.length} rule(s) in http_request_cache_settings (${cache.map((r) => r.description).join('; ')}); ${redirect.length} in http_request_dynamic_redirect`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
