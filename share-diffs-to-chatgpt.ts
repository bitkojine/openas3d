#!/usr/bin/env ts-node

import clipboardy from 'clipboardy'; // default import for v3+
import * as readline from 'readline';
import { execSync } from 'child_process';

// --- CONFIGURATION ---
const ROOT_DIR = process.cwd(); // assume the script runs in the git repo root

// --- HELPER FUNCTIONS ---
function promptUser(question: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, () => {
      rl.close();
      resolve();
    })
  );
}

// --- GIT HELPER FUNCTIONS ---
function getGitCommits(): string[] {
  const log = execSync('git log --oneline', { cwd: ROOT_DIR }).toString();
  return log.split('\n').filter(Boolean);
}

function getCommitDiffs(commitHash: string): { file: string; diff: string }[] {
  // Use git show -p to get full patch for the commit
  const patch = execSync(`git show --pretty=format: --unified=5 ${commitHash}`, { cwd: ROOT_DIR }).toString();

  const fileDiffs: { file: string; diff: string }[] = [];
  const lines = patch.split('\n');
  let currentFile = '';
  let currentDiff: string[] = [];

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (currentFile && currentDiff.length > 0) {
        fileDiffs.push({ file: currentFile, diff: currentDiff.join('\n') });
      }
      const match = line.match(/b\/(.+)$/);
      currentFile = match ? match[1] : 'unknown';
      currentDiff = [line];
    } else {
      currentDiff.push(line);
    }
  }
  if (currentFile && currentDiff.length > 0) {
    fileDiffs.push({ file: currentFile, diff: currentDiff.join('\n') });
  }
  return fileDiffs;
}

// --- TODO LIST MANAGEMENT ---
interface TodoFile {
  file: string;
  done: boolean;
}

function displayTodoList(todoList: TodoFile[]) {
  console.log('\n=== FILE DIFFS TODO LIST ===');
  todoList.forEach((f, idx) => {
    console.log(`${idx + 1}. [${f.done ? 'x' : ' '}] ${f.file}`);
  });
  console.log('============================\n');
}

// --- MAIN ---
async function main() {
  // 1. List recent commits
  console.log('=== RECENT GIT COMMITS ===');
  const commits = getGitCommits();
  commits.forEach((c, idx) => console.log(`${idx + 1}: ${c}`));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const commitIndex: number = await new Promise((resolve) => {
    rl.question('Select commit number to share diffs from: ', (answer) => {
      rl.close();
      resolve(parseInt(answer, 10) - 1);
    });
  });

  if (!commits[commitIndex]) {
    console.error('Invalid commit selection.');
    process.exit(1);
  }

  const commitHash = commits[commitIndex].split(' ')[0];
  console.log(`Selected commit: ${commitHash}`);

  // 2. Get diffs
  const diffs = getCommitDiffs(commitHash);
  if (diffs.length === 0) {
    console.log('No relevant diffs found in this commit.');
    return;
  }

  // 3. Prepare todo list
  const todoList: TodoFile[] = diffs.map((d) => ({ file: d.file, done: false }));

  console.log(`=== PREPARE CHATGPT ===`);
  console.log(`You are about to share diffs for ${todoList.length} files from commit ${commitHash}.`);
  console.log(`
"I will share diffs of a Git commit from a TypeScript/VSCode project.
Each diff will show exactly what changed in the commit (additions, deletions, modifications).
Keep track of all diffs as they arrive. Do NOT generate any analysis until I instruct you.
I will track progress with a todo list."
  `);

  await promptUser('Press Enter when ready to start sharing diffs...');

  // 4. Loop through diffs
  for (const todoFile of todoList) {
    const diff = diffs.find((d) => d.file === todoFile.file)?.diff || '';
    const clipboardContent = `--- DIFF FILE: ${todoFile.file} ---\n${diff}\n--- END OF DIFF ---`;

    // ✅ Clipboardy v3+ async write
    await clipboardy.write(clipboardContent);

    console.log(`Copied diff for ${todoFile.file} to clipboard.`);

    displayTodoList(todoList);

    await promptUser('Paste this diff into ChatGPT, then press Enter to continue...');
    todoFile.done = true;
  }

  console.log('\n=== ALL DIFFS SHARED ===');
  displayTodoList(todoList);
  await promptUser('All diffs are in ChatGPT context. Press Enter to indicate you are ready to give next instructions...');
  console.log('Workflow complete. ChatGPT now has full context of the commit diffs.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
