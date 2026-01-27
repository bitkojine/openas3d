const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkgPath = path.resolve(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

console.log('Syncing version proactively...');

try {
    // 1. Get latest tag
    const latestTag = execSync('git describe --tags --abbrev=0').toString().trim().replace(/^v/, '');
    console.log(`Latest release tag found: v${latestTag}`);

    // 2. Calculate next patch
    const parts = latestTag.split('.');
    if (parts.length === 3) {
        const nextPatch = parseInt(parts[2]) + 1;
        const nextVersion = `${parts[0]}.${parts[1]}.${nextPatch}`;

        console.log(`Proactively bumping to: ${nextVersion} (next expected release)`);

        // 3. Update package.json
        pkg.version = nextVersion;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
        console.log('package.json updated.');

        // 4. Update README via update-readme script
        // This ensures the "Development Version" line is also updated
        console.log('Updating README...');
        execSync('node scripts/update-readme.js', { stdio: 'inherit' });
    } else {
        console.log('Could not parse version parts. Skipping proactive bump.');
    }
} catch (e) {
    console.log('Error during sync:', e.message);
    process.exit(1);
}
