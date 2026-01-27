const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '../package.json');
const readmePath = path.resolve(__dirname, '../README.md');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
let readme = fs.readFileSync(readmePath, 'utf8');

const version = pkg.version;
// For README, we might want to show the canonical version or the full local one
// Spec says local builds preserve SemVer ordering and provide traceability.
// We'll update the "Release Version" in README.

const updated = readme
    .replace(/- \*\*Release Version\*\*: .+/g, `- **Release Version**: ${version}`)
    .replace(/- \*\*Build Number\*\*: [\d,]+/g, '') // Remove build number if it exists
    .replace(/\*\*Build [\d,]+\*\*/g, ''); // Remove other build mentions

fs.writeFileSync(readmePath, updated);
console.log(`README.md updated with version: ${version}`);
