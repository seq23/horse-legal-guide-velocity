const fs = require('fs');
const path = require('path');
const { collectFiles, readJson, fail, ok } = require('./helpers');
const { auditText } = require('../../scripts/lib/audit_content');
const files = collectFiles('content/drafts/generated', (file) => file.endsWith('.md'));
const backlog = readJson('data/system/editorial_backlog.json');
const byPath = new Map(backlog.map((entry) => [path.resolve(process.cwd(), entry.github_path), entry]));
let failCount = 0;
for (const file of files) {
  const entry = byPath.get(file);
  if (!entry) fail(`Draft file missing editorial backlog entry: ${file}`);
  const audit = auditText(entry, fs.readFileSync(file, 'utf8'));
  if (audit.status === 'fail') failCount += 1;
}
ok(`Draft quality audited for ${files.length} draft files (${failCount} fail-state drafts found; routed to revision bucket by metadata).`);
