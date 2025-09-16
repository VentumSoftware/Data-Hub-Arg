#!/usr/bin/env node

/**
 * Script to sync forked projects with the latest template updates
 * Run this in your forked project to pull latest changes from ventum-framework
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.cyan}${colors.bright}${msg}${colors.reset}\n`)
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function execCommand(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', ...options });
  } catch (error) {
    return null;
  }
}

function hasRemote(remoteName) {
  const remotes = execCommand('git remote');
  return remotes && remotes.includes(remoteName);
}

async function main() {
  log.header('🔄 Ventum Framework - Template Sync');
  
  // Check if we're in a git repository
  if (!fs.existsSync('.git')) {
    log.error('This is not a git repository!');
    log.info('Please run this command from your project root directory.');
    rl.close();
    process.exit(1);
  }
  
  // Check if this is the template repository itself
  const remoteUrl = execCommand('git config --get remote.origin.url');
  if (remoteUrl && remoteUrl.includes('ventum-framework')) {
    log.warning('This appears to be the template repository itself!');
    log.info('This script should be run in forked projects, not the template.');
    rl.close();
    process.exit(1);
  }
  
  // Configuration
  const TEMPLATE_REPO = 'https://github.com/jbnogal-ventum/ventum-framework.git';
  const UPSTREAM_REMOTE = 'template-upstream';
  
  // Check current status
  log.info('Checking git status...');
  const status = execCommand('git status --porcelain');
  if (status && status.trim()) {
    log.warning('You have uncommitted changes!');
    console.log(status);
    const proceed = await question('Do you want to continue? (y/n): ');
    if (proceed.toLowerCase() !== 'y') {
      log.info('Sync cancelled.');
      rl.close();
      process.exit(0);
    }
  }
  
  // Add template as upstream if not exists
  if (!hasRemote(UPSTREAM_REMOTE)) {
    log.info(`Adding template repository as '${UPSTREAM_REMOTE}' remote...`);
    execCommand(`git remote add ${UPSTREAM_REMOTE} ${TEMPLATE_REPO}`);
    log.success('Template remote added!');
  } else {
    log.info(`Template remote '${UPSTREAM_REMOTE}' already exists.`);
  }
  
  // Fetch latest from template
  log.info('Fetching latest changes from template...');
  execCommand(`git fetch ${UPSTREAM_REMOTE}`);
  
  // Get current branch
  const currentBranch = execCommand('git branch --show-current').trim();
  log.info(`Current branch: ${currentBranch}`);
  
  // Choose merge strategy
  console.log('\nHow would you like to sync with the template?');
  console.log('1. Merge template changes (recommended - preserves your history)');
  console.log('2. Cherry-pick specific commits');
  console.log('3. View changes only (no merge)');
  
  const choice = await question('Enter your choice (1-3): ');
  
  switch(choice) {
    case '1':
      // Merge changes
      log.info('Merging template changes...');
      const mergeResult = execCommand(`git merge ${UPSTREAM_REMOTE}/main --allow-unrelated-histories`, { stdio: 'inherit' });
      
      if (mergeResult !== null) {
        log.success('Template changes merged successfully!');
        log.info('Please review the changes and resolve any conflicts if necessary.');
      } else {
        log.warning('Merge resulted in conflicts. Please resolve them and commit.');
        console.log('\nTo resolve conflicts:');
        console.log('1. Open conflicted files and resolve manually');
        console.log('2. Run: git add <resolved-files>');
        console.log('3. Run: git commit');
      }
      break;
      
    case '2':
      // Cherry-pick commits
      log.info('Showing recent template commits...\n');
      const commits = execCommand(`git log ${UPSTREAM_REMOTE}/main --oneline -10`);
      console.log(commits);
      
      const commitHash = await question('\nEnter commit hash to cherry-pick (or "skip" to cancel): ');
      if (commitHash && commitHash !== 'skip') {
        execCommand(`git cherry-pick ${commitHash}`, { stdio: 'inherit' });
        log.success('Commit cherry-picked!');
      }
      break;
      
    case '3':
      // View changes only
      log.info('Showing changes between your project and template...\n');
      execCommand(`git log HEAD..${UPSTREAM_REMOTE}/main --oneline`, { stdio: 'inherit' });
      
      console.log('\nTo see detailed changes, run:');
      console.log(`  git diff HEAD ${UPSTREAM_REMOTE}/main`);
      break;
      
    default:
      log.error('Invalid choice!');
  }
  
  log.header('📝 Next Steps');
  console.log('1. Review the changes carefully');
  console.log('2. Test your application thoroughly');
  console.log('3. Commit and push when ready');
  console.log('\nTo see what changed: git diff HEAD~1');
  console.log('To undo merge: git reset --hard HEAD~1');
  
  rl.close();
}

main().catch(error => {
  log.error(`Sync failed: ${error.message}`);
  rl.close();
  process.exit(1);
});