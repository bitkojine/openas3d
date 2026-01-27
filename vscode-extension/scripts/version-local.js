const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkgPath = path.resolve(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// Only run on local builds (not CI)
if (process.env.CI) {
  console.log('CI detected, skipping local versioning.');
  process.exit(0);
}

const timestamp = new Date().toISOString().split('T')[0];
let gitHash = 'unknown';
try {
  gitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  // Ignore git errors
}

// Format: 0.2.0+2023-01-27.a1b2c3
const cleanVersion = pkg.version.split('+')[0];
const localVersion = `${cleanVersion}+${timestamp}d.${gitHash}`;

pkg.version = localVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Local version set to: ${localVersion}`);
