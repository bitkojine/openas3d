/**
 * Anti-Mock Usage Checker
 * 
 * This script scans test files for high-risk mocking patterns (e.g., mocking fs, git, or core services).
 * It encourages developers to follow the "Anti-Mock Trap" guidelines.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HIGH_RISK_MODULES = [
    'fs',
    'child_process',
    'vscode',
    'git',
    'os'
];

const HIGH_RISK_PATTERNS = [
    /jest\.mock\(['"]fs['"]\)/,
    /jest\.mock\(['"]child_process['"]\)/,
    /jest\.mock\(['"]vscode['"]\)/,
    /jest\.spyOn\(fs,/,
    /jest\.spyOn\(process, ['"]exit['"]\)/,
    /jest\.mock\(['"].*service.*['"]\)/i
];

const SEARCH_DIR = path.join(__dirname, '../src');

function findTestFiles(dir, files = []) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            findTestFiles(fullPath, files);
        } else if (file.endsWith('.test.ts') || file.endsWith('.spec.ts')) {
            files.push(fullPath);
        }
    }
    return files;
}

function checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const findings = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of HIGH_RISK_PATTERNS) {
            if (pattern.test(line)) {
                findings.push({
                    line: i + 1,
                    content: line.trim(),
                    pattern: pattern.toString()
                });
            }
        }
    }

    return findings;
}

const testFiles = findTestFiles(SEARCH_DIR);
let totalFindings = 0;
const sonarIssues = [];

console.log('🔍 Checking for high-risk mock usage...');

testFiles.forEach(file => {
    const findings = checkFile(file);
    const relativePath = path.relative(path.join(__dirname, '..'), file);

    if (findings.length > 0) {
        console.log(`\n📄 ${relativePath}:`);
        findings.forEach(f => {
            console.log(`  L${f.line}: ${f.content}`);
            totalFindings++;

            // SonarQube Generic Issue Format
            // Ensure path is relative to the PROJECT ROOT where sonar-scanner runs
            const projectRelativePath = `vscode-extension/${relativePath}`;

            sonarIssues.push({
                engineId: 'anti-mock-checker',
                ruleId: 'mock-trap',
                severity: 'MAJOR',
                type: 'CODE_SMELL',
                primaryLocation: {
                    message: `High-risk mocking pattern detected: ${f.content}. Avoid the "Mock Trap".`,
                    filePath: projectRelativePath,
                    textRange: {
                        startLine: f.line
                    }
                }
            });
        });
    }
});

// Output Sonar report if in CI
if (process.env.GITHUB_ACTIONS) {
    const reportPath = path.join(__dirname, '../sonar-mock-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({ issues: sonarIssues }, null, 2));
    console.log(`\n📊 SonarQube report generated: ${reportPath}`);
}

console.log('\n---');
if (totalFindings > 0) {
    console.log(`\n❌ Found ${totalFindings} high-risk mocking patterns.`);
    console.log('Please avoid the "Mock Trap". See docs/ANTI_MOCK_TRAP.md for guidance.');
    process.exit(1);
} else {
    console.log('\n✅ No high-risk mocking patterns found. Great job!');
}
