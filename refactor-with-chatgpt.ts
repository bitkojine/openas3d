#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import clipboardy from 'clipboardy';
import readline from 'readline';

// --- CONFIGURATION ---
const ROOT_DIR = path.resolve(__dirname, './vscode-extension/src');
const FILE_EXTENSIONS = ['.ts', '.js', '.json', '.md'];
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', 'out'];
const MAX_LINES_PER_CHUNK = 500; // updated from 150 to 500

// --- HELPERS ---
function isIgnored(filePath: string): boolean {
  const relative = path.relative(ROOT_DIR, filePath);
  return IGNORE_DIRS.some(dir => relative.split(path.sep).includes(dir));
}

function isValidFile(filePath: string): boolean {
  return FILE_EXTENSIONS.includes(path.extname(filePath)) && !isIgnored(filePath);
}

function getAllFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath));
    } else if (isValidFile(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

function promptUser(question: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, () => { rl.close(); resolve(); }));
}

// --- FILE CHUNKING ---
function chunkFile(content: string, maxLines: number): string[] {
  const lines = content.split('\n');
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    chunks.push(lines.slice(i, i + maxLines).join('\n'));
  }
  return chunks;
}

// --- FILE STRUCTURE ---
function generateFileTree(dir: string, depth = 4, prefix = ''): string {
  if (depth === 0) return '';
  const items = fs.readdirSync(dir)
    .filter(i => !IGNORE_DIRS.includes(i))
    .sort((a, b) => {
      const aIsDir = fs.statSync(path.join(dir, a)).isDirectory();
      const bIsDir = fs.statSync(path.join(dir, b)).isDirectory();
      return aIsDir === bIsDir ? a.localeCompare(b) : aIsDir ? -1 : 1;
    });

  let tree = '';
  for (let i = 0; i < items.length; i++) {
    const itemPath = path.join(dir, items[i]);
    const stat = fs.statSync(itemPath);
    const isDir = stat.isDirectory();
    const symbol = isDir ? '📁' : '📄';
    tree += `${prefix}${i === items.length - 1 ? '└─' : '├─'} ${symbol} ${items[i]}\n`;
    if (isDir) {
      tree += generateFileTree(itemPath, depth - 1, `${prefix}${i === items.length - 1 ? '   ' : '│  '}`);
    }
  }
  return tree;
}

// --- CLIPBOARD PROMPT ---
async function copyPromptToClipboard(message: string) {
  clipboardy.writeSync(message);
  await promptUser('Content copied to clipboard. Paste into ChatGPT and press Enter to continue...');
}

// --- MAIN WORKFLOW ---
async function main() {
  const allFiles = getAllFiles(ROOT_DIR);

  // 1️⃣ Share file structure context (do not generate output yet)
  const fileTree = generateFileTree(ROOT_DIR);
  await copyPromptToClipboard(`
I am about to share multiple files of a TypeScript/VSCode extension project with you.
Here is the file structure for context:

${fileTree}

⚠️ IMPORTANT: Do NOT generate any output yet. This is just context. Wait until I explicitly ask you to provide feedback.
Once I have shared all files and prompts, I will ask you to provide high-level architecture guidance, modularization strategies, and design principles.
For now, just store this context.
`);

  // 2️⃣ Group files by module
  const modules: Record<string, string[]> = {};
  allFiles.forEach(file => {
    const relative = path.relative(ROOT_DIR, file);
    const parts = relative.split(path.sep);
    const moduleName = parts.length > 1 ? parts[0] : 'root';
    if (!modules[moduleName]) modules[moduleName] = [];
    modules[moduleName].push(file);
  });

  // 3️⃣ Iterate modules
  for (const [moduleName, files] of Object.entries(modules)) {
    await copyPromptToClipboard(`
We are now sharing the "${moduleName}" module.
⚠️ IMPORTANT: Do NOT generate output yet. This is context only. Consider architectural decisions, file organization, or refactoring opportunities for this module.
`);

    // Share files
    for (const file of files) {
      const relative = path.relative(ROOT_DIR, file);
      const content = fs.readFileSync(file, 'utf-8');
      const chunks = chunkFile(content, MAX_LINES_PER_CHUNK);

      for (let i = 0; i < chunks.length; i++) {
        const header = chunks.length > 1
          ? `--- FILE: ${relative} (chunk ${i + 1}/${chunks.length}) ---`
          : `--- FILE: ${relative} ---`;

        clipboardy.writeSync(`${header}\n${chunks[i]}\n--- END OF FILE ---`);
        await promptUser(`File "${relative}" (chunk ${i + 1}) copied to clipboard. Paste into ChatGPT and press Enter...`);
      }
    }

    // Post-module prompt (context-only)
    await copyPromptToClipboard(`
All files for the "${moduleName}" module have been shared.
⚠️ IMPORTANT: Do NOT generate output yet. This is context only. Wait until I explicitly request feedback.
Consider concrete architectural improvements, modularization, or refactorings for this module.
Focus on maintainability and context memory efficiency.
`);
  }

  // 4️⃣ Final overall architecture prompt (output allowed)
  await copyPromptToClipboard(`
All modules have been shared.
You may now provide overall architectural feedback, refactoring suggestions, and any recommendations for splitting or reorganizing the codebase for maintainability.
This is the first prompt where output is expected. Prior prompts were context only.
`);

  console.log('✅ Workflow complete. All prompts and files have been copied to clipboard for ChatGPT.');
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
