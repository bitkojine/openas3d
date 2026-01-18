#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import clipboardy from 'clipboardy';
import readline from 'readline';

// --- CONFIGURATION ---
// Root directory to share
const ROOT_DIR = path.resolve(__dirname, './vscode-extension/src');

// File extensions to include
const FILE_EXTENSIONS = ['.ts', '.js', '.json', '.md'];

// Ignore patterns
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', 'out'];

// --- HELPER FUNCTIONS ---
function isIgnored(filePath: string): boolean {
  return IGNORE_DIRS.some(dir => filePath.includes(`${path.sep}${dir}${path.sep}`));
}

function isValidFile(filePath: string): boolean {
  return FILE_EXTENSIONS.includes(path.extname(filePath)) && !isIgnored(filePath);
}

function getAllFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath));
    } else if (isValidFile(fullPath)) {
      results.push(fullPath);
    }
  });
  return results;
}

function promptUser(question: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(question, () => {
    rl.close();
    resolve();
  }));
}

// --- MAIN ---
async function main() {
  const files = getAllFiles(ROOT_DIR);

  console.log('=== PREPARE CHATGPT ===');
  console.log(`You are about to share ${files.length} files with ChatGPT.`);
  console.log('Suggested starting prompt to prime ChatGPT:');
  console.log(`
"I will share multiple files of a TypeScript/VSCode extension project with you.
Each file I share will be copied to your context. Keep track of all files as they arrive.
Do NOT generate any analysis or commentary until I tell you explicitly what to do next.
After all files are shared, I will instruct you on the next steps."
  `);

  await promptUser('Press Enter when ready to start sharing files...');

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(ROOT_DIR, file);

    // Prepare clipboard content with a file header
    const clipboardContent = `--- FILE: ${relativePath} ---\n${content}\n--- END OF FILE ---`;
    clipboardy.writeSync(clipboardContent);

    console.log(`Copied ${relativePath} to clipboard.`);
    await promptUser('Paste this into ChatGPT, then press Enter to continue to the next file...');
  }

  // After all files
  console.log('\n=== ALL FILES SHARED ===');
  await promptUser('All files are in ChatGPT context. Press Enter to indicate you are ready to give next instructions...');
  console.log('Workflow complete. You can now instruct ChatGPT on what to do next.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
