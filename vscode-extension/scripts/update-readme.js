const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkgPath = path.resolve(__dirname, '../package.json');
const readmePath = path.resolve(__dirname, '../README.md');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
let readme = fs.readFileSync(readmePath, 'utf8');

let version = pkg.version;

// If version doesn't have metadata (e.g. canonical SemVer from semantic-release), 
// append timestamp and hash for README traceability.
if (!version.includes('+')) {
    const timestamp = new Date().toISOString().split('T')[0];
    let gitHash = 'unknown';
    try {
        gitHash = execSync('git rev-parse --short HEAD').toString().trim();
    } catch (e) {
        // Ignore git errors
    }
    version = `${version}+${timestamp}d.${gitHash}`;
}

const updated = readme
    .replace(/- \*\*Release Version\*\*: .+/g, `- **Release Version**: ${version}`)
    .replace(/- \*\*Build Number\*\*: [\d,]+/g, '') // Remove build number if it exists
    .replace(/\*\*Build [\d,]+\*\*/g, ''); // Remove other build mentions

fs.writeFileSync(readmePath, updated);
console.log(`README.md updated with version: ${version}`);
