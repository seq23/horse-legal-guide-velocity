const fs=require('fs');const path=require('path');
function fail(m){console.error('GITHUB_ACTIONS_TRACE_FAIL: '+m);process.exitCode=1;}
const p='data/admin/github_actions_trace.json';
if(!fs.existsSync(p)) fail(`${p} missing. Run npm run ops:simulate-github-actions.`);
else {
  const x=JSON.parse(fs.readFileSync(p,'utf8'));
  if(!String(x.truth_boundary||'').includes('local simulated')) fail('truth boundary must say local simulated');
  const actual=fs.readdirSync('.github/workflows').filter(f=>/\.ya?ml$/.test(f)).sort();
  const traced=(x.workflows||[]).map(w=>w.workflow).sort();
  if(!Array.isArray(x.workflows)) fail('workflows trace must be an array');
  if(Number(x.workflow_count)!==actual.length) fail(`workflow_count ${x.workflow_count} does not match actual workflow inventory ${actual.length}`);
  for(const file of actual) if(!traced.includes(file)) fail(`actual workflow missing from simulation trace: ${file}`);
  for(const file of traced) if(!actual.includes(file)) fail(`simulation trace references nonexistent workflow: ${file}`);
  if(x.failed>0) fail(`${x.failed} simulated workflows failed`);
  for(const w of x.workflows||[]){
    if(!w.workflow||!w.status||!w.report) fail(`malformed workflow row: ${JSON.stringify(w)}`);
    if(!fs.existsSync(w.report)) fail(`missing report ${w.report}`);
  }
}
if(!process.exitCode) console.log('GitHub Actions simulation trace OK');
