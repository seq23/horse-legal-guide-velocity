#!/usr/bin/env node
/**
 * The cadence gate for a client repo, measured in the only unit that applies here.
 *
 * Nothing in this repository may auto-publish. validate_publish_safety_gate.js
 * blocks any non-approved route from public output, and review_status only ever
 * becomes 'approved' through scripts/admin/*, reachable exclusively by
 * workflow_dispatch. That part is already right and this does not touch it.
 *
 * What was missing is a cadence for the thing that DOES run unattended: drafting.
 * Draft Queue Refresh has generated drafts every day at 11:15 with no ceiling, and
 * the measurement is stark:
 *
 *   306 drafts in content/drafts/generated, every one of them pending
 *   273 targets approved, the last of them on 2026-04-29
 *   0 approvals in the 17 weeks since
 *   17 drafts/week produced across the repo's 18-week life
 *
 * So the pipeline has been producing into a queue nobody is emptying. Adding a
 * 307th draft does not create capacity; it makes the queue harder to review, which
 * makes approval less likely, not more. For a client repo the binding constraint is
 * never the drafting rate - it is the client's approval bandwidth, and that is a
 * fact about a person, not a number a generator gets to choose.
 *
 * This gate reports the queue and tells the workflow whether to draft more. It
 * never fails: a full queue is a normal, correct state that needs a human, not a
 * broken build. A red job here would train everyone to ignore the one signal that
 * says the client has stopped reviewing.
 *
 * Usage: node scripts/cadence/draft_queue_gate.mjs [--json]
 * Emits should_draft=true|false to $GITHUB_OUTPUT when running in Actions.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const JSON_ONLY = process.argv.includes('--json');
const readJson = (rel, fallback = null) => {
  const f = path.join(root, rel);
  if (!fs.existsSync(f)) return fallback;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; }
};

const policy = readJson('data/cadence/policy.json', {}) || {};
const ceiling = Number(policy.unapproved_draft_ceiling ?? 50);

const backlogDoc = readJson('data/system/editorial_backlog.json', []) || [];
const backlog = Array.isArray(backlogDoc) ? backlogDoc : (backlogDoc.items || backlogDoc.backlog || []);
const pending = backlog.filter((item) => String(item?.status || item?.review_status || 'pending') === 'pending');

const targetsDoc = readJson('data/queries/page_targets.json', []) || [];
const targets = Array.isArray(targetsDoc) ? targetsDoc : (targetsDoc.targets || []);
const approved = targets.filter((t) => t?.review_status === 'approved');

const draftsDir = path.join(root, 'content/drafts/generated');
const draftFiles = fs.existsSync(draftsDir) ? fs.readdirSync(draftsDir).filter((f) => /\.mdx?$/.test(f)).length : 0;

const shouldDraft = pending.length < ceiling;
const report = {
  generated_at: new Date().toISOString().slice(0, 10),
  policy_source: 'data/cadence/policy.json',
  unapproved_draft_ceiling: ceiling,
  drafts_on_disk: draftFiles,
  drafts_pending_client_approval: pending.length,
  targets_approved: approved.length,
  should_draft: shouldDraft,
  publishing: 'client-approved only; no scheduled workflow can approve or publish',
  status: shouldDraft ? 'DRAFTING_OPEN' : 'QUEUE_FULL_AWAITING_CLIENT',
};

fs.mkdirSync(path.join(root, 'reports/cadence'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports/cadence/draft-queue-gate.json'), JSON.stringify(report, null, 2) + '\n');

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `should_draft=${shouldDraft}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `pending=${pending.length}\n`);
}

if (JSON_ONLY) {
  console.log(JSON.stringify(report, null, 2));
} else if (shouldDraft) {
  console.log(`DRAFT QUEUE ${report.status}: ${pending.length} of ${ceiling} slots used; drafting more.`);
} else {
  console.log(`DRAFT QUEUE ${report.status}: ${pending.length} drafts are waiting for client approval, ceiling is ${ceiling}.`);
  console.log('Not drafting more. This is a successful run - the queue is full, which is a decision waiting on the client, not a fault in the pipeline.');
  console.log(`Approve with the Admin Bulk Content Actions workflow (workflow_dispatch). ${approved.length} target(s) are currently approved.`);
}
// Always zero. A full queue needs a person, not a failed build.
process.exit(0);
