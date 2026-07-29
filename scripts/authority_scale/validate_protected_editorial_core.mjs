#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
function sha(buf){ return crypto.createHash('sha256').update(buf).digest('hex'); }
function subsetHash(obj,fields){
  const clean={}; for(const k of fields) clean[k]=obj?.[k] ?? null;
  return sha(Buffer.from(JSON.stringify(clean)));
}
const manifest=JSON.parse(fs.readFileSync('data/protected_core/protected_editorial_core.json','utf8'));
const state=JSON.parse(fs.readFileSync('data/protected_core/protected_editorial_state.json','utf8'));
const errors=[];
for(const x of manifest.files){
  if(!fs.existsSync(x.path)){ errors.push(`missing:${x.path}`); continue; }
  const h=sha(fs.readFileSync(x.path));
  if(h!==x.sha256) errors.push(`drift:${x.path}`);
}
const backlog=JSON.parse(fs.readFileSync('data/system/editorial_backlog.json','utf8'));
const calendar=JSON.parse(fs.readFileSync('data/system/content_calendar.json','utf8'));
const backlogMap=new Map(backlog.map(x=>[x.entry_id,x]));
const calendarMap=new Map(calendar.map(x=>[x.entry_id,x]));
for(const rec of state.backlog_records||[]){
  const item=backlogMap.get(rec.entry_id);
  if(!item){ errors.push(`missing-baseline-backlog-record:${rec.entry_id}`); continue; }
  if(subsetHash(item,state.backlog_fields||[])!==rec.sha256) errors.push(`baseline-backlog-identity-drift:${rec.entry_id}`);
}
for(const rec of state.calendar_records||[]){
  const item=calendarMap.get(rec.entry_id);
  if(!item){ errors.push(`missing-baseline-calendar-record:${rec.entry_id}`); continue; }
  if(subsetHash(item,state.calendar_fields||[])!==rec.sha256) errors.push(`baseline-calendar-identity-drift:${rec.entry_id}`);
}
console.log(JSON.stringify({ok:!errors.length,repo:manifest.repo,protected_files:manifest.files.length,baseline_backlog_records:state.baseline_backlog_count,current_backlog_records:backlog.length,baseline_calendar_records:state.baseline_calendar_count,current_calendar_records:calendar.length,policy:manifest.policy,state_policy:state.policy,errors},null,2));
if(errors.length) process.exit(1);
