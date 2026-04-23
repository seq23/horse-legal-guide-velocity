const fs = require('fs');
const path = require('path');

function loadText(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8').trim();
}

function loadDisclaimers() {
  return {
    short: loadText('templates/partial.footer.html'),
    fullDisclaimer: loadText('data/system/disclaimer_full.txt'),
    fullPrivacy: loadText('data/system/privacy_policy_full.txt')
  };
}

module.exports = { loadDisclaimers };
