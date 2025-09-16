#!/usr/bin/env node

/**
 * Deployment script for Digital Ocean
 * Deploys to dev, staging, or production environments
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

function runCommand(command, silent = false) {
  try {
    if (!silent) log.info(`Running: ${command}`);
    const output = execSync(command, { encoding: 'utf8' });
    return output;
  } catch (error) {
    log.error(`Command failed: ${command}`);
    throw error;
  }
}

async function checkPrerequisites() {
  // Check for git
  try {
    runCommand('git --version', true);
  } catch {
    log.error('Git is not installed');
    process.exit(1);
  }

  // Check for SSH key
  const sshKeyPath = path.join(process.env.HOME, '.ssh', 'id_rsa');
  if (!fs.existsSync(sshKeyPath)) {
    log.warning('No SSH key found. You may need to set up SSH authentication.');
  }

  // Check for .env file
  if (!fs.existsSync('.env')) {
    log.error('.env file not found. Please create it from .env.example');
    process.exit(1);
  }
}

async function loadEnvConfig() {
  const envContent = fs.readFileSync('.env', 'utf8');
  const config = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        config[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return config;
}

async function deployToDev(config) {
  log.header('🚀 Deploying to Development Environment');

  const host = config.DO_DEV_HOST;
  const user = config.DO_DEV_USER || 'root';
  
  if (!host) {
    log.error('DO_DEV_HOST not configured in .env');
    const inputHost = await question('Enter your Digital Ocean droplet IP: ');
    if (!inputHost) {
      log.error('Host is required');
      process.exit(1);
    }
    config.DO_DEV_HOST = inputHost;
  }

  log.info('Building Docker images...');
  runCommand('docker-compose build');

  log.info('Creating deployment archive...');
  const excludes = [
    '--exclude=node_modules',
    '--exclude=.git',
    '--exclude=.env.local',
    '--exclude=dist',
    '--exclude=build',
    '--exclude=.expo',
    '--exclude=coverage'
  ].join(' ');
  
  runCommand(`tar ${excludes} -czf deploy.tar.gz .`);

  log.info(`Uploading to ${config.DO_DEV_HOST}...`);
  runCommand(`scp deploy.tar.gz ${user}@${config.DO_DEV_HOST}:~/`);

  log.info('Deploying on server...');
  const deployCommands = `
    cd ~
    rm -rf app-backup
    mv app app-backup 2>/dev/null || true
    mkdir -p app
    tar -xzf deploy.tar.gz -C app
    cd app
    cp .env.example .env
    npm install --production
    docker-compose down
    docker-compose up -d --build
    docker exec ${config.APP_NAME || 'app'}-backend npm run migration:push
    docker exec ${config.APP_NAME || 'app'}-backend npm run audit
    docker exec ${config.APP_NAME || 'app'}-backend npm run seed
    rm ~/deploy.tar.gz
  `;

  runCommand(`ssh ${user}@${config.DO_DEV_HOST} "${deployCommands}"`);

  // Clean up local archive
  fs.unlinkSync('deploy.tar.gz');

  log.success(`Deployment complete! Access your app at http://${config.DO_DEV_HOST}:3000`);
}

async function setupDroplet(config) {
  log.header('🔧 Setting up new Digital Ocean Droplet');

  const host = await question('Enter your droplet IP address: ');
  const user = await question('Enter SSH user (default: root): ') || 'root';

  log.info('Installing Docker on droplet...');
  const setupCommands = `
    apt-get update
    apt-get install -y docker.io docker-compose git nodejs npm
    systemctl start docker
    systemctl enable docker
    docker --version
    docker-compose --version
  `;

  try {
    runCommand(`ssh ${user}@${host} "${setupCommands}"`);
    log.success('Droplet setup complete!');
    
    // Save to .env
    log.info('Saving configuration...');
    let envContent = fs.readFileSync('.env', 'utf8');
    if (!envContent.includes('DO_DEV_HOST')) {
      envContent += `\n# Digital Ocean Deployment\nDO_DEV_HOST=${host}\nDO_DEV_USER=${user}\n`;
      fs.writeFileSync('.env', envContent);
      log.success('Configuration saved to .env');
    }
  } catch (error) {
    log.error('Setup failed. Make sure you can SSH into the droplet.');
    process.exit(1);
  }
}

async function main() {
  log.header('Digital Ocean Deployment Tool');

  await checkPrerequisites();
  const config = await loadEnvConfig();

  const action = await question(`
Choose an action:
1. Deploy to Development
2. Setup new Droplet
3. Exit

Your choice (1-3): `);

  switch (action) {
    case '1':
      await deployToDev(config);
      break;
    case '2':
      await setupDroplet(config);
      break;
    case '3':
      log.info('Exiting...');
      break;
    default:
      log.error('Invalid choice');
  }

  rl.close();
}

// Run the script
main().catch(error => {
  log.error(`Deployment failed: ${error.message}`);
  rl.close();
  process.exit(1);
});