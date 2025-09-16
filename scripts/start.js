#!/usr/bin/env node

/**
 * Cross-platform start script for Ventum Framework
 * Works on Windows, macOS, and Linux
 */

const { execSync, spawn } = require('child_process');
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

// Get environment argument
const environment = process.argv[2] || 'local';

async function checkDocker() {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function checkDockerCompose() {
  try {
    // Try new docker compose command first
    execSync('docker compose version', { stdio: 'ignore' });
    return 'docker compose';
  } catch {
    try {
      // Try old docker-compose command
      execSync('docker-compose --version', { stdio: 'ignore' });
      return 'docker-compose';
    } catch {
      return null;
    }
  }
}

async function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return env;
}

async function createEnvFile() {
  const examplePath = path.join(process.cwd(), '.env.example');
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(examplePath)) {
    log.error('.env.example file not found!');
    process.exit(1);
  }
  
  fs.copyFileSync(examplePath, envPath);
  log.success('.env file created from template');
  
  log.warning('Please edit .env with your configuration:');
  console.log('   - Set your Google OAuth credentials (optional)');
  console.log('   - Update database passwords for production');
  console.log('   - Configure other environment variables as needed\n');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('Press Enter to continue after editing .env (or Ctrl+C to exit)...', () => {
      rl.close();
      resolve();
    });
  });
}

async function runCommand(command, description) {
  log.info(description || `Running: ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    log.error(`Failed to run: ${command}`);
    return false;
  }
}

async function waitForService(seconds) {
  log.info(`Waiting ${seconds} seconds for services to start...`);
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function main() {
  log.header('🚀 Ventum Framework Startup');
  log.info(`Starting application in ${colors.bright}${environment}${colors.reset} mode...`);
  
  // Check Docker
  if (!await checkDocker()) {
    log.error('Docker is not installed. Please install Docker first.');
    console.log('   Visit: https://docs.docker.com/get-docker/');
    process.exit(1);
  }
  
  // Check Docker Compose
  const dockerCompose = await checkDockerCompose();
  if (!dockerCompose) {
    log.error('Docker Compose is not installed. Please install Docker Compose first.');
    console.log('   Visit: https://docs.docker.com/compose/install/');
    process.exit(1);
  }
  
  log.success(`Found Docker Compose: ${dockerCompose}`);
  
  // Check/Create .env file
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    log.info('Creating .env file from template...');
    await createEnvFile();
  }
  
  // Set NODE_ENV
  process.env.NODE_ENV = (environment === 'prod' || environment === 'production') 
    ? 'production' 
    : 'development';
  
  // Install dependencies if needed
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    log.info('Installing dependencies...');
    await runCommand('npm install', '📦 Installing npm packages...');
  }
  
  // Build and start Docker services
  log.header('🏗️  Building and starting services...');
  
  const composeFile = 'devops/docker/docker-compose.yml';
  
  if (!await runCommand(`${dockerCompose} -f ${composeFile} build`, 'Building Docker images...')) {
    process.exit(1);
  }
  
  if (!await runCommand(`${dockerCompose} -f ${composeFile} up -d`, 'Starting Docker containers...')) {
    process.exit(1);
  }
  
  // Wait for services
  await waitForService(10);
  
  // Load environment variables
  const env = await loadEnvFile();
  const appName = env.APP_NAME || 'app';
  const containerName = `${appName}-api`;
  
  // Check if first run
  const initializedPath = path.join(process.cwd(), '.initialized');
  if (!fs.existsSync(initializedPath)) {
    log.header('🔧 First run detected. Initializing database...');
    
    await waitForService(10);
    
    // Run migrations
    log.info('📊 Running database migrations...');
    await runCommand(`docker exec ${containerName} npm run migration:push`);
    
    // Run CDC/audit setup
    log.info('📝 Setting up audit tables (CDC)...');
    await runCommand(`docker exec ${containerName} npm run audit`);
    
    // Run seeds
    log.info('🌱 Seeding database...');
    await runCommand(`docker exec ${containerName} npm run seed`);
    
    // Mark as initialized
    fs.writeFileSync(initializedPath, new Date().toISOString());
    log.success('Database initialized successfully!');
  }
  
  // Show access points
  const frontendPort = env.FRONTEND_PORT || '5173';
  const backendPort = env.BACKEND_PORT || '3000';
  const postgresPort = env.POSTGRES_PORT || '5432';
  const sftpPort = env.SFTP_PORT || '2222';
  
  log.header('✅ Application started successfully!');
  
  console.log(`${colors.bright}📌 Access points:${colors.reset}`);
  console.log(`   Frontend: ${colors.cyan}http://localhost:${frontendPort}${colors.reset}`);
  console.log(`   Backend:  ${colors.cyan}http://localhost:${backendPort}${colors.reset}`);
  console.log(`   Database: ${colors.cyan}localhost:${postgresPort}${colors.reset}`);
  console.log(`   SFTP:     ${colors.cyan}localhost:${sftpPort}${colors.reset}`);
  
  console.log(`\n${colors.bright}📋 Useful commands:${colors.reset}`);
  console.log(`   View logs:        ${dockerCompose} logs -f`);
  console.log(`   Stop services:    npm run stop`);
  console.log(`   Restart:          npm run start`);
  console.log(`   Production mode:  npm run start:prod\n`);
}

// Run the script
main().catch(error => {
  log.error(`Startup failed: ${error.message}`);
  process.exit(1);
});