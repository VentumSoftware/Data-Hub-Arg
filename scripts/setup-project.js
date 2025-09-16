#!/usr/bin/env node

/**
 * Cross-platform project setup script for Ventum Framework
 * Works on Windows, macOS, and Linux
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

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

function updateJsonFile(filePath, updates) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  Object.assign(content, updates);
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
}

function replaceInFile(filePath, searchValue, replaceValue) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(new RegExp(searchValue, 'g'), replaceValue);
  fs.writeFileSync(filePath, content);
}

function createReadme(projectName) {
  const readme = `# ${projectName}

Built with [Ventum Framework](https://github.com/your-org/ventum-framework) - A production-ready full-stack template.

## Quick Start

### Using npm scripts (cross-platform):
\`\`\`bash
# Install dependencies and start
npm run start

# For production mode
npm run start:prod
\`\`\`

### Or using platform-specific scripts:

**Linux/macOS:**
\`\`\`bash
./start.sh
\`\`\`

**Windows:**
\`\`\`cmd
start.bat
\`\`\`

## Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Database**: localhost:5432

## Development

\`\`\`bash
# Start development environment
npm run dev

# Start mobile app
npm run mobile:start

# Run tests
npm run test

# Build for production
npm run build

# Stop all services
npm run stop
\`\`\`

## Mobile App

\`\`\`bash
# Start Expo development server
npm run mobile:start

# Run on iOS simulator
npm run mobile:ios

# Run on Android emulator
npm run mobile:android

# Run in web browser
npm run mobile:web
\`\`\`

## Project Structure

\`\`\`
${projectName}/
├── packages/
│   ├── backend/          # NestJS API server
│   ├── frontend/         # React application
│   ├── mobile/           # React Native app
│   └── shared/           # Shared utilities
├── services/
│   ├── nginx/            # Nginx configurations
│   └── sftp/             # SFTP server config
├── scripts/              # Cross-platform scripts
├── docker-compose.yml    # Docker configuration
└── .env                  # Environment variables
\`\`\`

## Configuration

All configuration is in \`.env\`. See \`.env.example\` for available options.

## License

MIT
`;
  
  fs.writeFileSync('README.md', readme);
}

async function setupGit(projectName, githubUsername) {
  try {
    // Check if we're in the ventum-framework repo
    let currentRemote = '';
    try {
      currentRemote = execSync('git config --get remote.origin.url', { encoding: 'utf8', stdio: 'pipe' }).trim();
    } catch (e) {
      // No remote configured, which is fine
    }
    
    if (currentRemote.includes('ventum-framework')) {
      log.warning('⚠️  Detected ventum-framework repository remote');
      log.info('📦 Creating fresh git repository for your project...');
      
      // Remove existing git repository completely
      if (fs.existsSync('.git')) {
        if (process.platform === 'win32') {
          execSync('rmdir /s /q .git', { stdio: 'ignore', shell: true });
        } else {
          execSync('rm -rf .git', { stdio: 'ignore' });
        }
      }
      
      // Initialize completely new repository
      execSync('git init', { stdio: 'ignore' });
      execSync('git add .', { stdio: 'ignore' });
      execSync(`git commit -m "Initial commit - ${projectName} setup from Ventum Framework"`, { stdio: 'ignore' });
      
      log.success('✅ New git repository created (no longer linked to ventum-framework)');
      
      // Important warning
      log.header('⚠️  IMPORTANT: Your project is no longer connected to ventum-framework');
      console.log(`${colors.yellow}This is now a completely independent project.${colors.reset}`);
      console.log(`${colors.yellow}To sync with template updates later, use: npm run sync-template${colors.reset}\n`);
    } else if (fs.existsSync('.git')) {
      // User already has a different git repo, just update remotes if needed
      log.info('📦 Keeping existing git repository');
      
      // Remove ventum-framework remote if it exists
      try {
        const remotes = execSync('git remote', { encoding: 'utf8' }).trim().split('\n');
        if (remotes.includes('origin') && currentRemote.includes('ventum-framework')) {
          execSync('git remote remove origin', { stdio: 'ignore' });
          log.info('Removed ventum-framework remote');
        }
      } catch (e) {
        // Ignore errors
      }
      
      execSync('git add .', { stdio: 'ignore' });
      execSync(`git commit -m "Setup ${projectName} from Ventum Framework"`, { stdio: 'ignore' });
    } else {
      // No git repo exists, create new one
      execSync('git init', { stdio: 'ignore' });
      execSync('git add .', { stdio: 'ignore' });
      execSync(`git commit -m "Initial commit - ${projectName} setup from Ventum Framework"`, { stdio: 'ignore' });
      log.success('Git repository initialized!');
    }
    
    // Show instructions for setting up remote
    if (githubUsername) {
      log.header('📌 Next steps for GitHub:');
      console.log('1. Create a new repository on GitHub: https://github.com/new');
      console.log(`   - Name: ${projectName}`);
      console.log('   - Keep it empty (no README, .gitignore, or license)\n');
      console.log('2. Then run these commands:');
      console.log(`   ${colors.cyan}git remote add origin https://github.com/${githubUsername}/${projectName}.git${colors.reset}`);
      console.log(`   ${colors.cyan}git branch -M main${colors.reset}`);
      console.log(`   ${colors.cyan}git push -u origin main${colors.reset}`);
    } else {
      log.header('📌 Next steps:');
      console.log('1. Create a new repository on GitHub/GitLab/Bitbucket');
      console.log('2. Add the remote:');
      console.log(`   ${colors.cyan}git remote add origin <your-repository-url>${colors.reset}`);
      console.log('3. Push your code:');
      console.log(`   ${colors.cyan}git branch -M main${colors.reset}`);
      console.log(`   ${colors.cyan}git push -u origin main${colors.reset}`);
    }
  } catch (error) {
    log.warning('Git setup skipped (git might not be installed)');
  }
}

async function main() {
  log.header('🚀 Ventum Framework - New Project Setup');
  
  // Get project name
  let projectName = process.argv[2];
  if (!projectName) {
    projectName = await question('Enter your project name (e.g., my-awesome-app): ');
  }
  
  if (!projectName) {
    log.error('Project name is required!');
    rl.close();
    process.exit(1);
  }
  
  // Clean project name
  projectName = projectName.toLowerCase().replace(/\s+/g, '-');
  
  log.info(`Setting up project: ${colors.bright}${projectName}${colors.reset}`);
  
  // Get GitHub username
  const githubUsername = await question('Enter your GitHub username (or press Enter to skip GitHub setup): ');
  
  // Get mobile app configuration (optional)
  log.header('📱 Mobile App Configuration (Optional - press Enter to skip)');
  const configureMobile = await question('Configure mobile app now? (y/n): ');
  let mobileConfig = {};
  
  if (configureMobile.toLowerCase() === 'y') {
    mobileConfig = {
      appleId: await question('Apple ID email (for App Store): '),
      appleTeamId: await question('Apple Team ID: '),
      ascAppId: await question('App Store Connect App ID: '),
      googlePlayEmail: await question('Google Play service account email: '),
      expoUsername: await question('Expo username (for EAS): ')
    };
  }
  
  // Update package.json files
  log.info('📝 Updating package.json files...');
  
  updateJsonFile('package.json', { name: projectName });
  
  // Check and update backend package
  if (fs.existsSync('packages/backend/package.json')) {
    updateJsonFile('packages/backend/package.json', { name: `@${projectName}/backend` });
  } else {
    log.warning('Backend package.json not found - skipping');
  }
  
  // Check and update frontend package
  if (fs.existsSync('packages/frontend/package.json')) {
    updateJsonFile('packages/frontend/package.json', { name: `@${projectName}/frontend` });
  } else {
    log.warning('Frontend package.json not found - skipping');
  }
  
  // Check and update shared package (create if doesn't exist)
  const sharedPackagePath = 'packages/shared/package.json';
  if (fs.existsSync(sharedPackagePath)) {
    updateJsonFile(sharedPackagePath, { name: `@${projectName}/shared` });
  } else {
    log.warning('Shared package not found - creating it...');
    // Create shared directory if it doesn't exist
    const sharedDir = path.dirname(sharedPackagePath);
    if (!fs.existsSync(sharedDir)) {
      fs.mkdirSync(sharedDir, { recursive: true });
    }
    
    // Create basic shared package.json
    const sharedPackageJson = {
      name: `@${projectName}/shared`,
      version: '1.0.0',
      description: 'Shared utilities and types',
      main: 'index.js',
      types: 'index.d.ts',
      scripts: {
        build: 'tsc',
        dev: 'tsc --watch'
      },
      devDependencies: {
        '@types/node': '^20.10.0',
        'typescript': '^5.3.3'
      }
    };
    
    fs.writeFileSync(sharedPackagePath, JSON.stringify(sharedPackageJson, null, 2));
    
    // Create basic index.ts file
    const indexPath = path.join(sharedDir, 'index.ts');
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, '// Shared utilities and types\nexport {};\n');
    }
    
    // Create tsconfig.json for shared
    const tsconfigPath = path.join(sharedDir, 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) {
      const tsconfig = {
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          outDir: './dist',
          rootDir: './',
          declaration: true,
          declarationMap: true
        },
        include: ['**/*.ts'],
        exclude: ['node_modules', 'dist']
      };
      fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
    }
    
    log.success('Created shared package');
  }
  
  // Update mobile package if it exists
  if (fs.existsSync('packages/mobile/package.json')) {
    updateJsonFile('packages/mobile/package.json', { name: `@${projectName}/mobile` });
    
    // Update app.json for mobile
    if (fs.existsSync('packages/mobile/app.json')) {
      const appJsonPath = 'packages/mobile/app.json';
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      
      // Create a readable name from project name (e.g., my-app -> My App)
      const displayName = projectName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      appJson.expo.name = displayName;
      appJson.expo.slug = projectName;
      appJson.expo.ios.bundleIdentifier = `com.${projectName.replace(/-/g, '')}.app`;
      appJson.expo.android.package = `com.${projectName.replace(/-/g, '')}.app`;
      appJson.expo.scheme = projectName;
      
      fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
      log.success('Updated mobile app configuration');
    }
    
    // Create EAS configuration if mobile was configured
    if (Object.keys(mobileConfig).length > 0 && mobileConfig.expoUsername) {
      const easJsonPath = 'packages/mobile/eas.json';
      const easConfig = {
        cli: {
          version: ">= 5.9.0",
          promptToConfigurePushNotifications: false
        },
        build: {
          development: {
            developmentClient: true,
            distribution: "internal",
            android: {
              gradleCommand: ":app:assembleDebug"
            },
            ios: {
              buildConfiguration: "Debug",
              simulator: true
            },
            channel: "development"
          },
          preview: {
            distribution: "internal",
            android: {
              buildType: "apk"
            },
            ios: {
              simulator: true
            },
            channel: "preview"
          },
          production: {
            android: {
              gradleCommand: ":app:bundleRelease"
            },
            ios: {
              buildConfiguration: "Release"
            },
            channel: "production"
          }
        },
        submit: {
          production: {}
        }
      };
      
      // Add iOS submit config if Apple credentials provided
      if (mobileConfig.appleId && mobileConfig.appleTeamId) {
        easConfig.submit.production.ios = {
          appleId: mobileConfig.appleId,
          ascAppId: mobileConfig.ascAppId || `${projectName}-app-id`,
          appleTeamId: mobileConfig.appleTeamId
        };
      }
      
      // Add Android submit config if Google Play email provided
      if (mobileConfig.googlePlayEmail) {
        easConfig.submit.production.android = {
          serviceAccountKeyPath: "./google-play-key.json",
          track: "production"
        };
      }
      
      fs.writeFileSync(easJsonPath, JSON.stringify(easConfig, null, 2));
      log.success('Created EAS configuration for mobile builds');
      
      // Create .easignore file
      const easIgnorePath = 'packages/mobile/.easignore';
      const easIgnoreContent = `# EAS Build ignore file
node_modules/
.expo/
dist/
npm-debug.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
web-build/
.env*
google-play-key.json

# macOS
.DS_Store
`;
      fs.writeFileSync(easIgnorePath, easIgnoreContent);
      log.success('Created .easignore file');
    }
    
    // Update mobile App.tsx with project name
    if (fs.existsSync('packages/mobile/App.tsx')) {
      const appTsxPath = 'packages/mobile/App.tsx';
      let appContent = fs.readFileSync(appTsxPath, 'utf8');
      
      // Replace Ventum Mobile with project name
      const displayName = projectName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
        
      appContent = appContent.replace(/Ventum Mobile/g, displayName);
      fs.writeFileSync(appTsxPath, appContent);
    }
  }
  
  // Update workspace references
  const filesToUpdate = [
    'packages/backend/package.json',
    'packages/frontend/package.json',
    'packages/backend/tsconfig.json',
    'packages/frontend/tsconfig.json'
  ];
  
  filesToUpdate.forEach(file => {
    if (fs.existsSync(file)) {
      replaceInFile(file, '@app/', `@${projectName}/`);
    }
  });
  
  // Update .env files
  log.info('🔧 Updating environment configuration...');
  
  if (fs.existsSync('.env.example')) {
    replaceInFile('.env.example', 'APP_NAME=.*', `APP_NAME=${projectName}`);
    
    // Add mobile configuration to .env.example if provided
    if (Object.keys(mobileConfig).length > 0) {
      let envContent = fs.readFileSync('.env.example', 'utf8');
      
      // Add mobile section if not exists
      if (!envContent.includes('# Mobile App Configuration')) {
        envContent += `\n# Mobile App Configuration
EXPO_USERNAME=${mobileConfig.expoUsername || ''}
APPLE_ID=${mobileConfig.appleId || ''}
APPLE_TEAM_ID=${mobileConfig.appleTeamId || ''}
ASC_APP_ID=${mobileConfig.ascAppId || ''}
GOOGLE_PLAY_EMAIL=${mobileConfig.googlePlayEmail || ''}
`;
        fs.writeFileSync('.env.example', envContent);
      }
    }
  }
  
  // Copy .env.example to .env if it doesn't exist
  if (!fs.existsSync('.env') && fs.existsSync('.env.example')) {
    fs.copyFileSync('.env.example', '.env');
    log.success('Created .env file');
  }
  
  if (fs.existsSync('.env')) {
    replaceInFile('.env', 'APP_NAME=.*', `APP_NAME=${projectName}`);
    
    // Add mobile configuration to .env if provided
    if (Object.keys(mobileConfig).length > 0) {
      let envContent = fs.readFileSync('.env', 'utf8');
      
      // Add mobile section if not exists
      if (!envContent.includes('# Mobile App Configuration')) {
        envContent += `\n# Mobile App Configuration
EXPO_USERNAME=${mobileConfig.expoUsername || ''}
APPLE_ID=${mobileConfig.appleId || ''}
APPLE_TEAM_ID=${mobileConfig.appleTeamId || ''}
ASC_APP_ID=${mobileConfig.ascAppId || ''}
GOOGLE_PLAY_EMAIL=${mobileConfig.googlePlayEmail || ''}
`;
        fs.writeFileSync('.env', envContent);
      }
    }
  }
  
  // Update README
  log.info('📚 Updating README...');
  createReadme(projectName);
  
  // Remove .initialized file
  if (fs.existsSync('.initialized')) {
    fs.unlinkSync('.initialized');
    log.info('🔄 Removed initialization marker for fresh setup');
  }
  
  // Set up Git
  if (githubUsername) {
    log.header('🔗 Setting up GitHub repository...');
    await setupGit(projectName, githubUsername);
  } else {
    log.warning('Skipping GitHub setup. You can set it up manually later.');
  }
  
  // Success message
  log.header('✅ Project setup complete!');
  
  console.log(`\n${colors.bright}🚀 To start your project:${colors.reset}`);
  console.log(`   ${colors.cyan}npm run start${colors.reset}        (cross-platform)`);
  console.log(`   ${colors.cyan}./start.sh${colors.reset}           (Linux/macOS)`);
  console.log(`   ${colors.cyan}start.bat${colors.reset}            (Windows)\n`);
  console.log(`📚 For more information, see README.md\n`);
  console.log(`${colors.green}${colors.bright}Happy coding! 🎉${colors.reset}\n`);
  
  rl.close();
}

// Run the script
main().catch(error => {
  log.error(`Setup failed: ${error.message}`);
  rl.close();
  process.exit(1);
});