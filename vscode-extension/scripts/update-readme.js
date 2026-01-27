const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkgPath = path.resolve(__dirname, '../package.json');
const readmePath = path.resolve(__dirname, '../README.md');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
let readme = fs.readFileSync(readmePath, 'utf8');

let version = pkg.version;

// Try to get the latest tag and proactively bump it for local development
try {
    const latestTag = execSync('git describe --tags --abbrev=0').toString().trim().replace(/^v/, '');
    const parts = latestTag.split('.');
    if (parts.length === 3) {
        const nextPatch = parseInt(parts[2]) + 1;
        const nextVersion = `${parts[0]}.${parts[1]}.${nextPatch}`;
        // Use the next version as our base for local work
        version = nextVersion;
    }
} catch (e) {
    // If no tags, stick with package.json version
}

// Always append timestamp for local traceability.
if (!version.includes('+')) {
    const timestamp = new Date().toISOString().split('T')[0];
    version = `${version}+${timestamp}d.`;
}

const updated = readme
    .replace(/- \*\*Development Version\*\*: .+/g, `- **Development Version**: ${version}`)
    .replace(/- \*\*Build Number\*\*: [\d,]+/g, '') // Remove build number if it exists
    .replace(/\*\*Build [\d,]+\*\*/g, ''); // Remove other build mentions

fs.writeFileSync(readmePath, updated);
console.log(`README.md updated with version: ${version}`);
