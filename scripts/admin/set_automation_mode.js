const fs = require('fs');
const path = require('path');
const mode = process.argv[2];
const allowed = ['manual', 'assisted', 'auto_generate_only', 'auto_score_only', 'auto_approve_low_risk', 'auto_publish_due', 'full_auto'];
if (!allowed.includes(mode)) throw new Error(`Usage: node scripts/admin/set_automation_mode.js <${allowed.join('|')}>`);
const p = path.resolve(process.cwd(), 'data/system/automation_mode.json');
const state = JSON.parse(fs.readFileSync(p, 'utf8'));
if (mode === 'full_auto' && process.env.ALLOW_FULL_AUTO !== 'true') {
  throw new Error('full_auto requires ALLOW_FULL_AUTO=true. Legal-adjacent content remains guarded by default.');
}
const next = {
  ...state,
  mode,
  auto_collect_signals: ['assisted', 'auto_generate_only', 'auto_approve_low_risk', 'auto_publish_due', 'full_auto'].includes(mode),
  auto_generate_drafts: ['assisted', 'auto_generate_only', 'auto_approve_low_risk', 'auto_publish_due', 'full_auto'].includes(mode),
  auto_self_heal: ['assisted', 'auto_approve_low_risk', 'auto_publish_due', 'full_auto'].includes(mode),
  auto_prevalidate: ['assisted', 'auto_approve_low_risk', 'auto_publish_due', 'full_auto'].includes(mode),
  auto_score: mode !== 'manual',
  auto_approve: ['auto_approve_low_risk', 'full_auto'].includes(mode),
  auto_publish_approved_due: ['auto_publish_due', 'full_auto'].includes(mode),
  full_auto_enabled: mode === 'full_auto',
  last_changed_at: new Date().toISOString(),
  last_changed_by: process.env.GITHUB_ACTOR || process.env.USER || 'local-operator'
};
fs.writeFileSync(p, JSON.stringify(next, null, 2) + '\n');
console.log(`Automation mode set to ${mode}`);
