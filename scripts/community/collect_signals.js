const fs = require('fs');
const path = require('path');
const rawPath = path.resolve(process.cwd(), 'data/community/raw_signals.json');
if (!fs.existsSync(rawPath)) {
  fs.writeFileSync(rawPath, '[]\n');
}
console.log('Community signal collection complete.');
