const { spawnSync } = require('child_process');
const validators = [
  '_ops/validators/validate_query_traceability.js',
  '_ops/validators/validate_entity_coverage.js',
  '_ops/validators/validate_internal_authority_graph.js',
  '_ops/validators/validate_canonical_url_contract.js',
  '_ops/validators/validate_crawl_contract.js',
  '_ops/validators/validate_sitemap_page_parity.js'
];
const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const mode = modeArg ? modeArg.split('=')[1] : 'audit';
let failed = false;
for (const validator of validators) {
  const result = spawnSync(process.execPath, ['_ops/validators/run_validator.js', validator, `--mode=${mode}`], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, VALIDATION_MODE: mode }
  });
  if ((result.status || 0) !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
