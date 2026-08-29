#!/usr/bin/env node
/**
 * Say, at the workflow level, whether live citation observation actually
 * happened - and if it did not, why, by name.
 *
 * This is the "Report why" half of the convention already used by
 * drafts-refresh.yml (scripts/cadence/draft_queue_gate.mjs) and
 * approved-content-email.yml (scripts/social/email_credential_gate.mjs): the
 * lane may stop for a reason that needs a person, but never without saying so
 * in the log.
 *
 * live_query_observer.js exits 0 only when every provider failure was
 * owner-held (401/403 key rejected, 402 out of credits, 429 quota exhausted, or
 * no key configured). Any other failure shape still fails the lane red, so
 * reaching this reporter with an owner-held stop is the only way a blackout can
 * be green - and it will be a named one.
 *
 * Reads data/search/query_observations.json. Always exits 0; it reports, it
 * does not gate.
 */
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.cwd(), 'data/search/query_observations.json');
if (!fs.existsSync(file)) {
  console.log('NAMED_STOP: NO_OBSERVATION_ARTIFACT - data/search/query_observations.json was not written by this run.');
  process.exit(0);
}

const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
const observations = doc.observations || [];
const succeeded = observations.filter((o) => o.status === 'ok');
const stop = doc.stop || null;

if (!stop) {
  console.log(`Live citation observation ran: ${succeeded.length} of ${observations.length} panel quer${observations.length === 1 ? 'y' : 'ies'} observed against ${doc.primary_provider || 'the configured provider'} (provider_state ${doc.provider_state}).`);
  process.exit(0);
}

console.log(`NAMED_STOP: ${stop.reason} - ${stop.detail}`);
if (stop.owner_action) console.log(`Owner action: ${stop.owner_action}`);
for (const row of stop.provider_statuses || []) {
  console.log(`  ${row.provider}: ${row.http_status === null ? 'no HTTP status' : `HTTP ${row.http_status}`} on ${row.attempts} attempt(s)${row.owner_held ? ' (owner-held: billing/quota/credential)' : ' (NOT owner-held: this shape fails the lane red)'}`);
}
console.log(`No observation was recorded and none is claimed: ${succeeded.length} of ${observations.length} succeeded, provider_state ${doc.provider_state}.`);
console.log('Observation resumes automatically on the next run once the provider account is unblocked - no provider is disabled.');
process.exit(0);
