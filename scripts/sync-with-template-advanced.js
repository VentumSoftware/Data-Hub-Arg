#!/usr/bin/env node

/**
 * Advanced template sync with selective module updates
 * Allows syncing shared modules while protecting custom code
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
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.cyan}${colors.bright}${msg}${colors.reset}\n`),
  module: (msg) => console.log(`${colors.magenta}📦${colors.reset} ${msg}`)
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

function loadTemplateConfig() {
  const configPath = path.join(process.cwd(), '.template-config.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

async function selectModulesToSync(config) {
  if (!config || !config.sharedModules) {
    return [];
  }

  log.header('📦 Select Modules to Sync');
  console.log('Available shared modules from template:\n');
  
  const modules = config.sharedModules;
  modules.forEach((module, index) => {
    console.log(`${index + 1}. ${module}`);
  });
  
  console.log(`\n${colors.bright}Options:${colors.reset}`);
  console.log('  - Enter numbers separated by commas (e.g., 1,3,5)');
  console.log('  - Enter "all" to sync all modules');
  console.log('  - Enter "none" to skip module sync');
  console.log('  - Enter "core" for auth/users/common modules only');
  
  const choice = await question('\nYour selection: ');
  
  if (choice.toLowerCase() === 'none') {
    return [];
  }
  
  if (choice.toLowerCase() === 'all') {
    return modules;
  }
  
  if (choice.toLowerCase() === 'core') {
    return modules.filter(m => 
      m.includes('/auth') || 
      m.includes('/users') || 
      m.includes('/common') ||
      m.includes('authSlice') ||
      m.includes('userSlice')
    );
  }
  
  // Parse number selection
  const selected = choice.split(',')
    .map(n => parseInt(n.trim()) - 1)
    .filter(n => n >= 0 && n < modules.length)
    .map(n => modules[n]);
  
  return selected;
}

async function syncSpecificPaths(paths, remote) {
  if (paths.length === 0) {
    log.info('No paths selected for sync.');
    return;
  }
  
  log.header('🔄 Syncing Selected Paths');
  
  for (const pathToSync of paths) {
    log.module(`Syncing: ${pathToSync}`);
    
    // Check if path exists in remote
    const checkCommand = `git ls-tree -r ${remote}/main --name-only | grep "^${pathToSync}"`;
    const exists = execCommand(checkCommand);
    
    if (!exists) {
      log.warning(`Path not found in template: ${pathToSync}`);
      continue;
    }
    
    // Checkout the specific path from template
    const syncCommand = `git checkout ${remote}/main -- ${pathToSync}`;
    const result = execCommand(syncCommand);
    
    if (result !== null) {
      log.success(`Synced: ${pathToSync}`);
    } else {
      log.error(`Failed to sync: ${pathToSync}`);
    }
  }
}

async function main() {
  log.header('🚀 Ventum Framework - Advanced Template Sync');
  
  // Check if we're in a git repository
  if (!fs.existsSync('.git')) {
    log.error('This is not a git repository!');
    rl.close();
    process.exit(1);
  }
  
  // Load template configuration
  const config = loadTemplateConfig();
  if (!config) {
    log.warning('No .template-config.json found. Using basic sync mode.');
  }
  
  const TEMPLATE_REPO = config?.templateRepo || 'https://github.com/jbnogal-ventum/ventum-framework.git';
  const UPSTREAM_REMOTE = 'template-upstream';
  
  // Check current status
  log.info('Checking git status...');
  const status = execCommand('git status --porcelain');
  if (status && status.trim()) {
    log.warning('You have uncommitted changes!');
    const proceed = await question('Commit them first? (y/n): ');
    if (proceed.toLowerCase() === 'y') {
      const message = await question('Commit message: ');
      execCommand('git add .');
      execCommand(`git commit -m "${message}"`);
      log.success('Changes committed!');
    }
  }
  
  // Add template as upstream if not exists
  if (!execCommand(`git remote | grep ${UPSTREAM_REMOTE}`)) {
    log.info(`Adding template repository as '${UPSTREAM_REMOTE}' remote...`);
    execCommand(`git remote add ${UPSTREAM_REMOTE} ${TEMPLATE_REPO}`);
  }
  
  // Fetch latest from template
  log.info('Fetching latest changes from template...');
  execCommand(`git fetch ${UPSTREAM_REMOTE}`);
  
  // Show what's new
  log.header('📊 Template Updates Available');
  const commits = execCommand(`git log HEAD..${UPSTREAM_REMOTE}/main --oneline -5`);
  if (commits && commits.trim()) {
    console.log('Recent template commits:');
    console.log(commits);
  } else {
    log.info('Your project is up to date with the template!');
  }
  
  // Sync strategy selection
  console.log(`\n${colors.bright}Sync Strategy:${colors.reset}`);
  console.log('1. Selective module sync (recommended)');
  console.log('2. Full merge (includes all template changes)');
  console.log('3. Infrastructure only (docker, nginx, scripts)');
  console.log('4. View detailed changes');
  console.log('5. Cancel');
  
  const strategy = await question('\nChoose strategy (1-5): ');
  
  switch(strategy) {
    case '1':
      // Selective module sync
      const selectedModules = await selectModulesToSync(config);
      await syncSpecificPaths(selectedModules, UPSTREAM_REMOTE);
      
      // Also sync infrastructure files
      const infraFiles = config?.syncableFiles || [];
      if (infraFiles.length > 0) {
        const syncInfra = await question('\nAlso sync infrastructure files? (y/n): ');
        if (syncInfra.toLowerCase() === 'y') {
          await syncSpecificPaths(infraFiles, UPSTREAM_REMOTE);
        }
      }
      break;
      
    case '2':
      // Full merge
      log.info('Performing full merge...');
      const mergeResult = execCommand(`git merge ${UPSTREAM_REMOTE}/main --allow-unrelated-histories`, { stdio: 'inherit' });
      if (mergeResult !== null) {
        log.success('Full merge completed!');
      }
      break;
      
    case '3':
      // Infrastructure only
      const infraPaths = [
        ...(config?.syncableFiles || []),
        ...(config?.syncableDirs || [])
      ];
      await syncSpecificPaths(infraPaths, UPSTREAM_REMOTE);
      break;
      
    case '4':
      // View changes
      log.header('📝 Changed Files');
      const changedFiles = execCommand(`git diff --name-status HEAD ${UPSTREAM_REMOTE}/main`);
      console.log(changedFiles);
      
      const viewDetails = await question('\nView detailed diff? (y/n): ');
      if (viewDetails.toLowerCase() === 'y') {
        execCommand(`git diff HEAD ${UPSTREAM_REMOTE}/main`, { stdio: 'inherit' });
      }
      break;
      
    case '5':
      log.info('Sync cancelled.');
      break;
      
    default:
      log.error('Invalid choice!');
  }
  
  // Show final status
  const finalStatus = execCommand('git status --short');
  if (finalStatus && finalStatus.trim()) {
    log.header('📋 Changes to Review');
    console.log(finalStatus);
    console.log('\nNext steps:');
    console.log('1. Review changes: git diff');
    console.log('2. Test your application');
    console.log('3. Commit when ready: git commit -am "Sync with template"');
  }
  
  rl.close();
}

main().catch(error => {
  log.error(`Sync failed: ${error.message}`);
  rl.close();
  process.exit(1);
});