#!/usr/bin/env node

/**
 * Manual deployment trigger script
 * Uses GitHub API to trigger deployment workflows
 */

const { execSync } = require('child_process');
const https = require('https');
const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2);
const targetBranch = args[0] || 'dev';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, silent = false) {
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
    return output.trim();
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase());
    });
  });
}

async function triggerGitHubWorkflow(owner, repo, workflowFile, branch, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      ref: branch
    });

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Node.js Deployment Script',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 204) {
          resolve({ success: true });
        } else {
          reject(new Error(`GitHub API returned ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function deploy() {
  log('\n🚀 Manual Deployment Trigger', 'bright');
  log('==============================\n', 'bright');

  // Validate target branch
  const branchWorkflowMap = {
    'dev': 'deploy-dev.yml',
    'staging': 'deploy-staging.yml',
    'main': 'deploy-production.yml',
    'prod': 'deploy-production.yml',
    'production': 'deploy-production.yml'
  };

  // Normalize branch name
  let normalizedBranch = targetBranch;
  if (targetBranch === 'prod' || targetBranch === 'production') {
    normalizedBranch = 'main';
  }

  const workflowFile = branchWorkflowMap[targetBranch];
  if (!workflowFile) {
    log(`❌ Invalid target branch: ${targetBranch}`, 'red');
    log(`   Valid options are: dev, staging, main/prod/production`, 'yellow');
    process.exit(1);
  }

  // Get repository info from git remote
  let repoInfo;
  try {
    const remoteUrl = execCommand('git config --get remote.origin.url', true);
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
    if (match) {
      repoInfo = {
        owner: match[1],
        repo: match[2]
      };
    } else {
      throw new Error('Could not parse GitHub repository URL');
    }
  } catch (error) {
    log('❌ Could not determine GitHub repository', 'red');
    log('   Make sure you have a GitHub remote configured', 'yellow');
    process.exit(1);
  }

  // Map branch to environment
  const environments = {
    'dev': 'Development',
    'staging': 'Staging',
    'main': 'Production'
  };

  // Show deployment info
  log(`📍 Repository: ${repoInfo.owner}/${repoInfo.repo}`, 'cyan');
  log(`🎯 Target branch: ${normalizedBranch}`, 'cyan');
  log(`🌍 Environment: ${environments[normalizedBranch]}`, 'yellow');
  log(`📋 Workflow: ${workflowFile}`, 'cyan');

  // Check for GitHub token
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    log('\n❌ GitHub token not found!', 'red');
    log('\n📖 To set up a GitHub token:', 'bright');
    log('   1. Go to https://github.com/settings/tokens', 'blue');
    log('   2. Generate a new token with "repo" and "workflow" scopes', 'blue');
    log('   3. Set it as an environment variable:', 'blue');
    log('      export GITHUB_TOKEN=your_token_here', 'cyan');
    log('\n   Or pass it when running the script:', 'blue');
    log('      GITHUB_TOKEN=your_token node scripts/trigger-deploy.js dev', 'cyan');
    process.exit(1);
  }

  // Confirm deployment
  const answer = await promptUser(`\n⚠️  Deploy to ${environments[normalizedBranch]}? (y/n) `);
  
  if (answer !== 'y') {
    log('❌ Deployment cancelled.', 'red');
    process.exit(0);
  }

  try {
    log('\n📤 Triggering GitHub Actions workflow...', 'cyan');
    
    await triggerGitHubWorkflow(
      repoInfo.owner,
      repoInfo.repo,
      workflowFile,
      normalizedBranch,
      token
    );

    // Success!
    log('\n✅ Deployment workflow triggered successfully!', 'green');
    log('\n📊 Monitor deployment progress:', 'bright');
    log(`   https://github.com/${repoInfo.owner}/${repoInfo.repo}/actions`, 'blue');
    
    // Show expected outcomes based on branch
    if (normalizedBranch === 'dev') {
      log('\n🌐 Development deployment:', 'bright');
      log('   - Will create/update DigitalOcean droplet', 'blue');
      log('   - Installs Docker and dependencies', 'blue');
      log('   - Deploys your application', 'blue');
      log('   - Runs database migrations', 'blue');
    } else if (normalizedBranch === 'staging') {
      log('\n🌐 Staging deployment to DigitalOcean App Platform', 'bright');
    } else if (normalizedBranch === 'main') {
      log('\n🌐 Production deployment to Kubernetes cluster', 'bright');
    }

  } catch (error) {
    log(`\n❌ Failed to trigger deployment: ${error.message}`, 'red');
    
    if (error.message.includes('401')) {
      log('\n⚠️  Authentication failed. Check your GitHub token.', 'yellow');
    } else if (error.message.includes('404')) {
      log('\n⚠️  Workflow not found. Make sure the workflow file exists:', 'yellow');
      log(`   .github/workflows/${workflowFile}`, 'cyan');
    }
    
    process.exit(1);
  }
}

// Show usage if --help
if (args.includes('--help') || args.includes('-h')) {
  log('\n📚 Manual Deployment Trigger', 'bright');
  log('============================\n', 'bright');
  log('Usage: node scripts/trigger-deploy.js [branch]', 'bright');
  log('\nExamples:', 'bright');
  log('  node scripts/trigger-deploy.js dev        # Deploy to development', 'cyan');
  log('  node scripts/trigger-deploy.js staging    # Deploy to staging', 'cyan');
  log('  node scripts/trigger-deploy.js main       # Deploy to production', 'cyan');
  log('  node scripts/trigger-deploy.js prod       # Deploy to production (alias)', 'cyan');
  log('\nEnvironment variables:', 'bright');
  log('  GITHUB_TOKEN or GH_TOKEN    # Required for GitHub API access', 'cyan');
  log('\nDefault branch is "dev" if not specified.', 'yellow');
  process.exit(0);
}

// Run deployment
deploy().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});