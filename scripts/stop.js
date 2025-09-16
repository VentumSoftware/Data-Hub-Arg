#!/usr/bin/env node

/**
 * Cross-platform stop script for Ventum Framework
 * Works on Windows, macOS, and Linux
 */

const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`)
};

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

async function main() {
  log.info('🛑 Stopping application...\n');
  
  const dockerCompose = await checkDockerCompose();
  if (!dockerCompose) {
    log.error('Docker Compose is not installed.');
    process.exit(1);
  }
  
  try {
    const composeFile = 'devops/docker/docker-compose.yml';
    execSync(`${dockerCompose} -f ${composeFile} down`, { stdio: 'inherit' });
    log.success('\nApplication stopped successfully!');
    console.log('\n📋 To restart: npm run start\n');
  } catch (error) {
    log.error('Failed to stop services');
    process.exit(1);
  }
}

main().catch(error => {
  log.error(`Stop failed: ${error.message}`);
  process.exit(1);
});