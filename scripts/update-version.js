const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, '..', 'version.json');
const swFile = path.join(__dirname, '..', 'service-worker.js');

const { version } = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
let sw = fs.readFileSync(swFile, 'utf8');

const newSw = sw.replace(/const APP_VERSION = '.*?';/, `const APP_VERSION = '${version}';`);

if (sw !== newSw) {
  fs.writeFileSync(swFile, newSw);
  console.log(`Updated service-worker APP_VERSION to ${version}`);
} else {
  console.log('APP_VERSION already up to date');
}
