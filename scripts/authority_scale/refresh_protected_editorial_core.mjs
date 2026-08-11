#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const subsetHash = (obj, fields) => {
  const clean = {};
  for (const key of fields) clean[key] = obj?.[key] ?? null;
  return sha(Buffer.from(JSON.stringify(clean)));
};

const manifestPath = 'data/protected_core/protected_editorial_core.json';
const statePath = 'data/protected_core/protected_editorial_state.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const backlog = JSON.parse(fs.readFileSync('data/system/editorial_backlog.json', 'utf8'));
const calendar = JSON.parse(fs.readFileSync('data/system/content_calendar.json', 'utf8'));

manifest.files = manifest.files.map((entry) => {
  if (!fs.existsSync(entry.path)) throw new Error(`Cannot rebaseline missing protected file: ${entry.path}`);
  const bytes = fs.readFileSync(entry.path);
  return { ...entry, sha256: sha(bytes), bytes: bytes.length };
});

state.baseline_backlog_count = backlog.length;
state.baseline_calendar_count = calendar.length;
state.backlog_records = backlog.map((item) => ({ entry_id: item.entry_id, sha256: subsetHash(item, state.backlog_fields || []) }));
state.calendar_records = calendar.map((item) => ({ entry_id: item.entry_id, sha256: subsetHash(item, state.calendar_fields || []) }));
state.rebaselined_at = new Date().toISOString();
state.rebaseline_reason = 'Owner-approved protected editorial source-identity contract v2 reconciliation. Immutable source/question identity is rebaselined; native quality repair, uniqueness repair, scheduling, review, and publish-state movement remain allowed operational mutations.';

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
console.log(`Protected editorial core rebaselined: ${manifest.files.length} files, ${backlog.length} backlog records, ${calendar.length} calendar records.`);
