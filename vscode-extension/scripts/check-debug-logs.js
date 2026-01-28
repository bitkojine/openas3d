const fs = require('fs');
const path = require('path');

// Patterns for debug logging that should be caught
const DEBUG_PATTERNS = [
  // Basic console methods that shouldn't be in production
  /console\.log\(/g,
  /console\.debug\(/g,
  /console\.info\(/g,
  
  // Suspicious console.warn patterns (usually debug info)
  /console\.warn\(['"`]Raycast|Event:|Handling:|Jest Stderr:/g,
  
  // Console.log in specific contexts that are definitely debug
  /console\.log\(['"`]\[.*\].*:/g,
];

const EXCLUDED_DIRS = ['node_modules', 'out', 'dist', 'coverage', '.vscode-test'];
const EXCLUDED_FILES = ['**/*.test.ts', '**/*.test.js', '**/*.d.ts'];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  
  DEBUG_PATTERNS.forEach((pattern, index) => {
    const matches = content.match(pattern);
    if (matches) {
      const lines = content.split('\n');
      matches.forEach(match => {
        // Find line numbers for this match
        lines.forEach((line, lineIndex) => {
          if (line.includes(match) && !line.trim().startsWith('//')) {
            // Skip commented lines
            issues.push({ 
              line: lineIndex + 1, 
              pattern: pattern.source,
              match: match.trim(),
              code: line.trim()
            });
          }
        });
      });
    }
  });
  
  return issues;
}

function scanDirectory(dir) {
  let totalIssues = 0;
  const filesWithIssues = [];
  
  function walk(currentDir) {
    try {
      const files = fs.readdirSync(currentDir);
      
      for (const file of files) {
        const fullPath = path.join(currentDir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !EXCLUDED_DIRS.includes(file)) {
          walk(fullPath);
        } else if (file.match(/\.(ts|js)$/)) {
          const relativePath = path.relative(process.cwd(), fullPath);
          
          // Skip test files and excluded patterns
          const isTestFile = relativePath.match(/\.test\.(ts|js)$/) || 
                           relativePath.startsWith('src/test/') ||
                           relativePath.includes('__mocks__') ||
                           relativePath.includes('fixtures');
          
          if (!isTestFile) {
            const issues = checkFile(fullPath);
            if (issues.length > 0) {
              filesWithIssues.push({ file: relativePath, issues });
              totalIssues += issues.length;
            }
          }
        }
      }
    } catch (err) {
      // Skip directories we can't read
    }
  }
  
  walk(dir);
  return { totalIssues, filesWithIssues };
}

function main() {
  console.log('🔍 Checking for debug logging issues...\n');
  
  const result = scanDirectory('src');
  
  if (result.totalIssues > 0) {
    console.log(`🚨 Found ${result.totalIssues} debug logging issues:\n`);
    
    result.filesWithIssues.forEach(({ file, issues }) => {
      console.log(`📁 ${file}:`);
      issues.forEach(issue => {
        console.log(`  ❌ Line ${issue.line}: ${issue.match}`);
        console.log(`     Code: ${issue.code}`);
        console.log(`     Pattern: ${issue.pattern}`);
        console.log('');
      });
    });
    
    console.log(`\n❌ Please remove debug logging before committing`);
    console.log(`💡 Use console.error() or console.warn() for legitimate error/warning messages`);
    process.exit(1);
  } else {
    console.log('✅ No debug logging issues found');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkFile, scanDirectory };
