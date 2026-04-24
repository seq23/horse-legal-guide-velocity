const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function main() {
  const repoDir = process.cwd();
  const sha = execSync('git rev-parse --short HEAD', { cwd: repoDir }).toString().trim();
  const date = new Date();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const fileName = `horse-legal-guide-velocity-main_BASELINE_${mm}-${dd}-${yy}_${sha}.zip`;
  const outPath = path.join(path.dirname(repoDir), fileName);
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  execSync(`zip -r ${JSON.stringify(outPath)} . -x ".git/*" "node_modules/*" "coverage/*" "tmp/*" ".DS_Store"`, { cwd: repoDir, stdio: 'inherit' });
  console.log(outPath);
}

main();
