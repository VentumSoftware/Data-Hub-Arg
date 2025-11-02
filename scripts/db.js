#!/usr/bin/env node

/**
 * Database management script for containerized environments
 * Supports multiple microservices with their own databases
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

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

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const database = args[1] || 'main'; // Default to main database

// Load environment variables and detect which compose file to use
function loadEnvFile() {
  const env = {};

  // Try to load from .env file
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        env[key.trim()] = value.trim();
      }
    });
  }

  return env;
}

// Detect which docker-compose file is being used based on running containers
function detectComposeFile() {
  const composeFiles = [
    'devops/docker/docker-compose.dev.yml',
    'devops/docker/docker-compose.staging.yml',
    'devops/docker/docker-compose.yml'
  ];

  for (const file of composeFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;

    try {
      // Check if any containers from this compose file are running
      const result = execSync(`docker compose -f ${file} ps --format json 2>/dev/null || echo "[]"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });

      const containers = JSON.parse(result.trim() || '[]');
      if (Array.isArray(containers) && containers.length > 0) {
        return file;
      }
    } catch (error) {
      continue;
    }
  }

  // Default to dev if nothing is running
  return 'devops/docker/docker-compose.dev.yml';
}

// Get APP_NAME from running containers or compose file
function getAppNameFromCompose(composeFile) {
  // First, try to detect from running containers
  try {
    const runningContainers = execSync('docker ps --format "{{.Names}}"', {
      encoding: 'utf8'
    }).trim().split('\n');

    // Look for container names matching pattern: name-service-env or name-service
    for (const container of runningContainers) {
      // Match patterns: app-name-api-dev, app-name-api, app-api-dev, app-api
      const match = container.match(/^(.+?)-(api|web|postgres|nginx|rabbitmq)(-dev|-prod|-staging)?$/);
      if (match) {
        return match[1];
      }
    }
  } catch (error) {
    // Continue to next method
  }

  // Fall back to parsing compose config
  try {
    const result = execSync(`docker compose -f ${composeFile} config --format json`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    });

    const config = JSON.parse(result);
    const services = Object.values(config.services || {});

    if (services.length > 0) {
      const firstContainer = services[0].container_name || '';
      // Container name format: ${APP_NAME}-service[-env]
      const match = firstContainer.match(/^(.+?)-(api|web|postgres|nginx|rabbitmq)/);
      if (match) {
        return match[1].replace(/-dev$/, '').replace(/-prod$/, '').replace(/-staging$/, '');
      }
    }
  } catch (error) {
    // Silent fail
  }

  return 'app';
}

// Check if Docker is running
function checkDocker() {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Check if container is running
function isContainerRunning(containerName) {
  try {
    const result = execSync(`docker ps --filter "name=${containerName}" --format "{{.Names}}"`, { 
      encoding: 'utf8' 
    });
    return result.includes(containerName);
  } catch {
    return false;
  }
}

// Find actual running container name
function findRunningContainer(appName, service) {
  try {
    // Try different naming patterns
    const patterns = [
      `${appName}-${service}-dev`,
      `${appName}-${service}-prod`,
      `${appName}-${service}-staging`,
      `${appName}-${service}`
    ];

    for (const pattern of patterns) {
      const result = execSync(`docker ps --filter "name=${pattern}" --format "{{.Names}}"`, {
        encoding: 'utf8'
      }).trim();

      if (result) {
        return result;
      }
    }
  } catch (error) {
    // Continue
  }

  // Fallback to basic pattern
  return `${appName}-${service}`;
}

// Get database configuration for a service
function getDatabaseConfig(database, env) {
  const appName = env.APP_NAME || 'app';

  // Database naming convention: app_<database>_local for development
  // e.g., app_main_local, app_auth_local, app_users_local
  const dbConfigs = {
    main: {
      container: findRunningContainer(appName, 'api'),
      dbName: env.POSTGRES_DB || 'app_main',
      dbUser: env.POSTGRES_USER || 'app_user',
      dbPassword: env.POSTGRES_PASSWORD || 'app_password',
      dbHost: 'postgres',
      dbPort: '5432'
    },
    // Example configurations for future microservices
    auth: {
      container: `${appName}-auth`,
      dbName: `${appName}_auth_local`,
      dbUser: env.AUTH_DB_USER || env.POSTGRES_USER || 'app_user',
      dbPassword: env.AUTH_DB_PASSWORD || env.POSTGRES_PASSWORD || 'app_password',
      dbHost: env.AUTH_DB_HOST || 'postgres',
      dbPort: env.AUTH_DB_PORT || '5432'
    },
    users: {
      container: `${appName}-users`,
      dbName: `${appName}_users_local`,
      dbUser: env.USERS_DB_USER || env.POSTGRES_USER || 'app_user',
      dbPassword: env.USERS_DB_PASSWORD || env.POSTGRES_PASSWORD || 'app_password',
      dbHost: env.USERS_DB_HOST || 'postgres',
      dbPort: env.USERS_DB_PORT || '5432'
    }
  };
  
  // If database not configured, use default pattern
  if (!dbConfigs[database]) {
    return {
      container: `${appName}-${database}`,
      dbName: `${appName}_${database}_local`,
      dbUser: env.POSTGRES_USER || 'app_user',
      dbPassword: env.POSTGRES_PASSWORD || 'app_password',
      dbHost: 'postgres',
      dbPort: '5432'
    };
  }
  
  return dbConfigs[database];
}

// Execute command in container with database override
function execInContainer(containerName, command, dbConfig, description) {
  log.info(description || `Executing: ${command}`);
  
  // Build DATABASE_URL for the specific database
  const databaseUrl = `postgresql://${dbConfig.dbUser}:${dbConfig.dbPassword}@${dbConfig.dbHost}:${dbConfig.dbPort}/${dbConfig.dbName}`;
  
  // Set environment variables for the command
  const envVars = [
    `-e DATABASE_URL="${databaseUrl}"`,
    `-e POSTGRES_DB="${dbConfig.dbName}"`,
    `-e POSTGRES_USER="${dbConfig.dbUser}"`,
    `-e POSTGRES_PASSWORD="${dbConfig.dbPassword}"`,
    `-e POSTGRES_HOST="${dbConfig.dbHost}"`,
    `-e POSTGRES_PORT="${dbConfig.dbPort}"`
  ].join(' ');

  const fullCommand = `docker exec ${envVars} ${containerName} ${command}`;
  
  try {
    execSync(fullCommand, { stdio: 'inherit' });
    return true;
  } catch (error) {
    log.error(`Failed to execute command in ${containerName}`);
    return false;
  }
}

// Database commands
const commands = {
  migrate: {
    description: 'Run database migrations',
    npm: 'npm run migration:push',
    info: 'Applying database schema changes...'
  },
  seed: {
    description: 'Seed database with initial data',
    npm: 'npm run seed',
    info: 'Seeding database with initial data...'
  },
  backup: {
    description: 'Backup database',
    npm: 'npm run migration:backup',
    info: 'Creating database backup...'
  },
  audit: {
    description: 'Setup CDC audit tables',
    npm: 'npm run audit',
    info: 'Setting up audit tables...'
  },
  reset: {
    description: 'Reset database (migrate + seed + audit)',
    npm: 'npm run migration:full',
    info: 'Resetting database (migrations + seed + audit)...'
  },
  status: {
    description: 'Check database connection status',
    custom: true,
    info: 'Checking database status...'
  }
};

// Show help
function showHelp() {
  log.header('📊 Database Management Tool');
  console.log('Usage: npm run db:<command> [database]');
  console.log('\nCommands:');
  
  Object.entries(commands).forEach(([cmd, config]) => {
    console.log(`  ${colors.cyan}${cmd.padEnd(10)}${colors.reset} ${config.description}`);
  });
  
  console.log('\nExamples:');
  console.log('  npm run db:migrate          # Run migrations for main database');
  console.log('  npm run db:seed              # Seed main database');
  console.log('  npm run db:reset             # Full reset (migrate + seed + audit)');
  console.log('  npm run db:migrate auth      # Run migrations for auth database');
  console.log('  npm run db:seed users        # Seed users database');
  console.log('  npm run db:status            # Check main database connection');
  
  console.log('\nDatabases:');
  console.log('  main (default)               # Main application database');
  console.log('  auth                         # Authentication service database');
  console.log('  users                        # Users service database');
  console.log('  <custom>                     # Any custom microservice database');
  
  console.log('\nDatabase Naming Convention:');
  console.log('  Development: <app_name>_<database>_local');
  console.log('  Example: myapp_auth_local, myapp_users_local');
}

// Check database status
async function checkDatabaseStatus(dbConfig, env) {
  const appName = env.APP_NAME || 'app';
  
  log.info(`Checking database connection: ${dbConfig.dbName}`);
  
  // First check if the database exists
  const checkDbCmd = `psql -U ${dbConfig.dbUser} -h ${dbConfig.dbHost} -p ${dbConfig.dbPort} -lqt | cut -d \\| -f 1 | grep -qw ${dbConfig.dbName}`;
  
  try {
    execSync(`docker exec ${appName}-postgres sh -c "${checkDbCmd}"`, { stdio: 'pipe' });
    log.success(`Database '${dbConfig.dbName}' exists`);
  } catch {
    log.warning(`Database '${dbConfig.dbName}' does not exist yet`);
    log.info('Run migrations to create it: npm run db:migrate ' + (dbConfig.dbName === 'app_main' ? '' : dbConfig.dbName.replace('_local', '').replace(appName + '_', '')));
    return false;
  }
  
  // Try to connect to database
  const checkCmd = `psql -U ${dbConfig.dbUser} -h ${dbConfig.dbHost} -p ${dbConfig.dbPort} -d ${dbConfig.dbName} -c "SELECT version();"`;
  
  try {
    execSync(`docker exec ${appName}-postgres ${checkCmd}`, { stdio: 'pipe' });
    log.success('Database is connected and responsive');
    
    // Show table count
    const tableCountCmd = `psql -U ${dbConfig.dbUser} -h ${dbConfig.dbHost} -p ${dbConfig.dbPort} -d ${dbConfig.dbName} -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"`;
    const tableCount = execSync(`docker exec ${appName}-postgres ${tableCountCmd}`, { encoding: 'utf8' }).trim();
    log.info(`Tables in database: ${tableCount}`);
    
    return true;
  } catch (error) {
    log.error('Database connection failed');
    return false;
  }
}

// Main execution
async function main() {
  // Check Docker
  if (!checkDocker()) {
    log.error('Docker is not running. Please start Docker first.');
    process.exit(1);
  }

  // Show help if no command
  if (!command || command === 'help') {
    showHelp();
    process.exit(0);
  }

  // Validate command
  if (!commands[command]) {
    log.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }

  // Detect which compose file is being used
  const composeFile = detectComposeFile();
  log.info(`Detected compose file: ${composeFile}`);

  // Load environment
  const env = loadEnvFile();

  // Always try to get APP_NAME from running containers first, then fall back to .env
  const detectedAppName = getAppNameFromCompose(composeFile);
  env.APP_NAME = detectedAppName || env.APP_NAME || 'app';

  const dbConfig = getDatabaseConfig(database, env);

  log.header(`Database Management: ${command}`);
  log.info(`Environment: ${env.APP_NAME}`);
  log.info(`Database: ${database} (${dbConfig.dbName})`);
  log.info(`Container: ${dbConfig.container}`);
  
  // Check if container is running
  if (!isContainerRunning(dbConfig.container)) {
    log.error(`Container '${dbConfig.container}' is not running`);
    log.info('Start the services first: npm run start');
    process.exit(1);
  }
  
  // Execute command
  const cmdConfig = commands[command];
  
  if (command === 'status') {
    await checkDatabaseStatus(dbConfig, env);
  } else if (cmdConfig.npm) {
    const success = execInContainer(dbConfig.container, cmdConfig.npm, dbConfig, cmdConfig.info);
    
    if (success) {
      log.success(`Database ${command} completed successfully for '${dbConfig.dbName}'!`);
    } else {
      log.error(`Database ${command} failed for '${dbConfig.dbName}'`);
      process.exit(1);
    }
  }
  
  // Show next steps
  if (command === 'migrate') {
    console.log('\nNext steps:');
    console.log('  - Run seeds: npm run db:seed');
    console.log('  - Setup audit: npm run db:audit');
  } else if (command === 'reset') {
    console.log('\nDatabase has been fully reset with migrations, seeds, and audit tables.');
  }
}

// Run the script
main().catch(error => {
  log.error(`Script failed: ${error.message}`);
  process.exit(1);
});