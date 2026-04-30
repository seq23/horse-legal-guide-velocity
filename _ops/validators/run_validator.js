const { spawnSync } = require('child_process');
const path = require('path');

const validatorRel = process.argv[2];
const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const mode = modeArg ? modeArg.split('=')[1] : 'audit';

if (!validatorRel) {
  console.error('Usage: node _ops/validators/run_validator.js <validator-rel-path> [--mode=audit|enforce]');
  process.exit(1);
}

const validatorAbs = path.resolve(process.cwd(), validatorRel);
const result = spawnSync(process.execPath, [validatorAbs, `--mode=${mode}`], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: { ...process.env, VALIDATION_MODE: mode }
});
process.exit(result.status || 0);
