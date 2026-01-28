#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Same patterns as the main debug log checker
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

const EXCLUDED_PATTERNS = [
  /src\/test\//,
  /src\/test\/fixtures\//,
  /\.test\.ts$/,
  /\.test\.js$/,
  /__mocks__\//,
  /fixtures\//,
];

function getStagedFiles() {
  try {
    // Get staged files, filter for TypeScript/JavaScript in src directory
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', { 
      encoding: 'utf8',
      cwd: process.cwd()
    });
    
    return output
      .split('\n')
      .filter(file => file.trim())
      .filter(file => file.match(/vscode-extension\/src\/.*\.(ts|js)$/))
      .filter(file => !EXCLUDED_PATTERNS.some(pattern => pattern.test(file)))
      .map(file => file.replace('vscode-extension/', '')); // Remove the prefix
  } catch (error) {
    console.error('❌ Failed to get staged files:', error.message);
    process.exit(1);
  }
}

function checkFileContent(filePath, content) {
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

function getStagedContent(filePath) {
  try {
    // Get the staged content of the file using the full path
    const fullPath = `vscode-extension/${filePath}`;
    const output = execSync(`git show :${fullPath}`, { 
      encoding: 'utf8',
      cwd: process.cwd()
    });
    return output;
  } catch (error) {
    console.error(`❌ Failed to get staged content for ${filePath}:`, error.message);
    return null;
  }
}

function main() {
  const startTime = Date.now();
  
  try {
    const stagedFiles = getStagedFiles();
    
    if (stagedFiles.length === 0) {
      console.log('✅ No relevant files to check');
      process.exit(0);
    }
    
    console.log(`🔍 Checking ${stagedFiles.length} staged file(s) for debug logging...\n`);
    
    let totalIssues = 0;
    const filesWithIssues = [];
    
    for (const file of stagedFiles) {
      const content = getStagedContent(file);
      if (content === null) continue;
      
      const issues = checkFileContent(file, content);
      if (issues.length > 0) {
        filesWithIssues.push({ file, issues });
        totalIssues += issues.length;
      }
    }
    
    const duration = Date.now() - startTime;
    
    if (totalIssues > 0) {
      console.log(`🚨 Found ${totalIssues} debug logging issue(s) in staged files:\n`);
      
      filesWithIssues.forEach(({ file, issues }) => {
        console.log(`📁 ${file}:`);
        issues.forEach(issue => {
          console.log(`  ❌ Line ${issue.line}: ${issue.match}`);
          console.log(`     Code: ${issue.code}`);
          console.log(`     Pattern: ${issue.pattern}`);
          console.log('');
        });
      });
      
      console.log(`❌ Please remove debug logging before committing`);
      console.log(`💡 Use console.error() or console.warn() for legitimate error/warning messages`);
      console.log(`💡 Or use --no-verify to bypass (not recommended)`);
      console.log(`⏱️  Check completed in ${duration}ms`);
      process.exit(1);
    } else {
      console.log(`✅ No debug logging issues found in staged files`);
      console.log(`⏱️  Check completed in ${duration}ms`);
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Pre-commit debug log check failed:', error.message);
    // Don't block the commit if the script fails - that would be too frustrating
    console.log('⚠️  Proceeding with commit (but please report this issue)');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { getStagedFiles, checkFileContent, getStagedContent };
