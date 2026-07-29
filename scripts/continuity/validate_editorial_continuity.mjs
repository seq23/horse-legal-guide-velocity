#!/usr/bin/env node
import fs from 'node:fs';
const report=JSON.parse(fs.readFileSync('data/continuity/editorial_continuity_report.json','utf8'));
const backlog=JSON.parse(fs.readFileSync('data/system/editorial_backlog.json','utf8'));
const calendar=JSON.parse(fs.readFileSync('data/system/content_calendar.json','utf8'));
const errors=[];
if(report.horizon_days<90||report.horizon_days>180) errors.push('horizon');
if(report.publication_authority!=='EXISTING_HORSE_MANUAL_ADMIN_APPROVAL_FLOW') errors.push('authority');
if(Number(report.new_pending_entries||0)<0) errors.push('count');
const bIds=backlog.map(x=>x.entry_id); const cIds=calendar.map(x=>x.entry_id);
if(new Set(bIds).size!==bIds.length) errors.push('duplicate-backlog-ids');
if(new Set(cIds).size!==cIds.length) errors.push('duplicate-calendar-ids');
const cSet=new Set(cIds);
for(const x of backlog.filter(x=>x.continuity_generated===true)){
  if(!cSet.has(x.entry_id)) errors.push(`continuity-missing-calendar:${x.entry_id}`);
  if(x.status!=='pending'||x.review_status!=='pending') errors.push(`continuity-not-pending:${x.entry_id}`);
  if(x.date<='2026-12-31') errors.push(`continuity-date-not-future:${x.entry_id}`);
}
console.log(JSON.stringify({ok:!errors.length,...report,continuity_backlog_entries:backlog.filter(x=>x.continuity_generated===true).length,errors},null,2));
if(errors.length) process.exit(1);
