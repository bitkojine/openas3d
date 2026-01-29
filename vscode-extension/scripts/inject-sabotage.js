const fs = require('fs');
const path = require('path');

// Helper to find files recursively
function findFiles(dir, pattern) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(findFiles(fullPath, pattern));
        } else if (file.includes('test.ts') || file.includes('test.js')) {
            results.push(fullPath);
        }
    });
    return results;
}

const testFiles = findFiles('/Users/name/trusted-git/oss/openas3d/vscode-extension/src', 'test');

testFiles.forEach(file => {
    // Skip the sabotage setup itself
    if (file.includes('sabotage-setup.ts')) return;

    const content = fs.readFileSync(file, 'utf8');

    if (content.includes('jest.mock') || content.includes('jest.fn') || content.includes('jest.spyOn')) {
        // Check if already sabotaged
        if (content.startsWith('throw new Error("Mock Sabotaged!')) {
            console.log(`Skipping already sabotaged: ${file}`);
            return;
        }

        console.log(`Sabotaging ${file}...`);
        const sabotagedContent = `throw new Error("Mock Sabotaged! This test uses mocking (jest.mock, jest.fn, or jest.spyOn).");\n\n` + content;
        fs.writeFileSync(file, sabotagedContent);
    }
});
