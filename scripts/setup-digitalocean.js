#!/usr/bin/env node

/**
 * DigitalOcean Setup Helper
 * Guides through setting up DigitalOcean secrets for deployment
 */

const fs = require('fs');
const { execSync } = require('child_process');
const readline = require('readline');
const path = require('path');

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

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function setupDigitalOcean() {
  log('\n🌊 DigitalOcean Deployment Setup', 'bright');
  log('==================================\n', 'bright');

  log('This script will help you set up DigitalOcean secrets for deployment.\n', 'cyan');

  // Check if SSH key exists
  const sshKeyPath = path.join(process.env.HOME, '.ssh', 'do_deploy_key');
  const sshPubKeyPath = `${sshKeyPath}.pub`;
  
  if (!fs.existsSync(sshKeyPath)) {
    log('📝 SSH key not found. Creating a new one...', 'yellow');
    
    const email = await promptUser('Enter your email for the SSH key: ');
    
    try {
      execSync(`ssh-keygen -t ed25519 -f ${sshKeyPath} -C "${email}" -N ""`, { stdio: 'inherit' });
      log('✅ SSH key created successfully!', 'green');
    } catch (error) {
      log('❌ Failed to create SSH key', 'red');
      process.exit(1);
    }
  } else {
    log('✅ SSH key found at ~/.ssh/do_deploy_key', 'green');
  }

  // Get SSH key fingerprint
  log('\n📋 Getting SSH key fingerprint...', 'cyan');
  const fingerprint = execSync(`ssh-keygen -l -E md5 -f ${sshPubKeyPath}`, { encoding: 'utf8' })
    .split(' ')[1]
    .replace('MD5:', '');
  
  log(`   Fingerprint: ${fingerprint}`, 'yellow');

  // Get SSH private key
  const privateKey = fs.readFileSync(sshKeyPath, 'utf8');
  const publicKey = fs.readFileSync(sshPubKeyPath, 'utf8');

  log('\n🔑 Required GitHub Secrets:', 'bright');
  log('============================\n', 'bright');

  log('Add these secrets to your GitHub repository:', 'cyan');
  log('(Settings → Secrets and variables → Actions)\n', 'cyan');

  log('1. DO_ACCESS_TOKEN', 'yellow');
  log('   Get from: https://cloud.digitalocean.com/account/api/tokens', 'blue');
  log('   Required scopes: Read & Write\n', 'blue');

  log('2. DO_SSH_KEY_FINGERPRINT', 'yellow');
  log(`   Value: ${fingerprint}\n`, 'green');

  log('3. DO_SSH_PRIVATE_KEY', 'yellow');
  log('   Value: (copy everything below including BEGIN/END lines)', 'blue');
  log('   ' + privateKey.split('\n').join('\n   '), 'cyan');

  log('\n📝 Next Steps:', 'bright');
  log('==============\n', 'bright');

  log('1. Add the SSH public key to DigitalOcean:', 'yellow');
  log('   https://cloud.digitalocean.com/account/security', 'blue');
  log('   Public key:', 'blue');
  log(`   ${publicKey.trim()}`, 'cyan');

  log('\n2. Create a DigitalOcean API token:', 'yellow');
  log('   https://cloud.digitalocean.com/account/api/tokens', 'blue');

  log('\n3. Add all three secrets to GitHub:', 'yellow');
  log('   https://github.com/jbnogal-ventum/ventum-framework/settings/secrets/actions', 'blue');

  const upload = await promptUser('\nWould you like to upload these secrets to GitHub now? (y/n) ');
  
  if (upload.toLowerCase() === 'y') {
    log('\n🔄 Uploading secrets to GitHub...', 'cyan');
    
    const token = await promptUser('Enter your DigitalOcean API token: ');
    
    try {
      // Upload using GitHub CLI
      execSync(`echo "${fingerprint}" | gh secret set DO_SSH_KEY_FINGERPRINT`, { stdio: 'pipe' });
      log('✅ Uploaded DO_SSH_KEY_FINGERPRINT', 'green');
      
      execSync(`echo "${privateKey}" | gh secret set DO_SSH_PRIVATE_KEY`, { stdio: 'pipe' });
      log('✅ Uploaded DO_SSH_PRIVATE_KEY', 'green');
      
      execSync(`echo "${token}" | gh secret set DO_ACCESS_TOKEN`, { stdio: 'pipe' });
      log('✅ Uploaded DO_ACCESS_TOKEN', 'green');
      
      log('\n✅ All secrets uploaded successfully!', 'green');
      log('\n🚀 You can now test deployment with: npm run deploy:dev', 'bright');
    } catch (error) {
      log(`\n❌ Failed to upload secrets: ${error.message}`, 'red');
      log('Please add them manually on GitHub.', 'yellow');
    }
  }
}

// Run setup
setupDigitalOcean().catch(error => {
  log(`\n❌ Error: ${error.message}`, 'red');
  process.exit(1);
});