#!/usr/bin/env node

/**
 * Auto-generate secure secrets for development and deployment
 * Updates .env file with randomly generated passwords and secrets
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

// Load environment variables from .env file
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n');
    
    envLines.forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2];
      }
    });
  }
}

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

function generateSecurePassword(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function generateSecureCookieSecret(length = 64) {
  return crypto.randomBytes(length).toString('base64url');
}

function updateEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    log('❌ .env file not found. Please copy .env.example to .env first.', 'red');
    process.exit(1);
  }

  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Generate new secrets
  const secrets = {
    POSTGRES_PASSWORD: generateSecurePassword(16),
    COOKIE_SECRET: generateSecureCookieSecret(64),
    PLAUSIBLE_DB_PASSWORD: generateSecurePassword(16),
    PLAUSIBLE_SECRET_KEY: generateSecurePassword(64),
    SFTP_PASSWORD: generateSecurePassword(16)
  };

  log('\n🔐 Generating secure secrets...', 'bright');
  log('============================\n', 'bright');

  // Update each secret in the .env file
  Object.entries(secrets).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
      log(`✅ Updated ${key}`, 'green');
    } else {
      log(`⚠️  ${key} not found in .env file`, 'yellow');
    }
  });

  // Write updated content back to .env
  fs.writeFileSync(envPath, envContent);
  
  log('\n📝 Updated .env file with new secrets', 'green');
  
  // Also update DATABASE_URL with new password
  const dbPassword = secrets.POSTGRES_PASSWORD;
  const dbUrlRegex = /^DATABASE_URL=postgresql:\/\/app_user:([^@]+)@postgres:5432\/app_main$/m;
  if (dbUrlRegex.test(envContent)) {
    envContent = envContent.replace(dbUrlRegex, `DATABASE_URL=postgresql://app_user:${dbPassword}@postgres:5432/app_main`);
    fs.writeFileSync(envPath, envContent);
    log('✅ Updated DATABASE_URL with new password', 'green');
  }

  return secrets;
}

function getRepositoryInfo() {
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2]
      };
    }
    throw new Error('Could not parse GitHub repository URL');
  } catch (error) {
    throw new Error('Could not determine GitHub repository. Make sure you have a GitHub remote configured.');
  }
}

async function encryptSecret(secretValue, publicKey) {
  try {
    // Use our custom encryption module
    const { encryptSecretSimple } = require('./github-secret-encryption');
    return encryptSecretSimple(secretValue, publicKey);
  } catch (error) {
    // Fallback to base64 if encryption fails
    console.warn('Encryption failed, using base64 fallback:', error.message);
    
    // Try a simpler approach using Node.js built-in crypto
    const crypto = require('crypto');
    const publicKeyBuffer = Buffer.from(publicKey, 'base64');
    
    try {
      // GitHub uses libsodium, but we can try RSA if the key is RSA format
      const key = crypto.createPublicKey({
        key: publicKeyBuffer,
        format: 'der',
        type: 'spki'
      });
      
      // Use RSA-OAEP padding for encryption
      const encrypted = crypto.publicEncrypt({
        key: key,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      }, Buffer.from(secretValue, 'utf8'));
      
      return encrypted.toString('base64');
    } catch (cryptoError) {
      // If all else fails, throw an error
      throw new Error(`Failed to encrypt: ${cryptoError.message}`);
    }
  }
}

async function uploadSecretToGitHub(owner, repo, secretName, secretValue, token) {
  return new Promise((resolve, reject) => {
    try {
      // Check if GitHub CLI is available and use it instead
      const { execSync } = require('child_process');
      
      // Try using GitHub CLI first (more reliable)
      try {
        execSync('gh --version', { stdio: 'pipe' });
        
        // Set the secret using GitHub CLI with the token
        const result = execSync(
          `echo "${secretValue}" | GITHUB_TOKEN="${token}" gh secret set ${secretName} --repo ${owner}/${repo}`,
          { stdio: 'pipe', encoding: 'utf8' }
        );
        
        resolve({ success: true });
        return;
      } catch (ghError) {
        // GitHub CLI not available or failed, fall back to API
      }
      
      // Fall back to direct API call
      const keyOptions = {
        hostname: 'api.github.com',
        path: `/repos/${owner}/${repo}/actions/secrets/public-key`,
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Node.js Secret Upload Script',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      };

      const keyReq = https.request(keyOptions, (keyRes) => {
        let keyData = '';
        keyRes.on('data', (chunk) => keyData += chunk);
        keyRes.on('end', () => {
          if (keyRes.statusCode !== 200) {
            reject(new Error(`Failed to get public key: ${keyRes.statusCode} ${keyData}`));
            return;
          }

          const keyInfo = JSON.parse(keyData);
          
          // Use proper encryption for GitHub API
          encryptSecret(secretValue, keyInfo.key).then(encryptedValue => {
            // Now upload the secret
            const secretData = JSON.stringify({
              encrypted_value: encryptedValue,
              key_id: keyInfo.key_id
            });

            const uploadOptions = {
              hostname: 'api.github.com',
              path: `/repos/${owner}/${repo}/actions/secrets/${secretName}`,
              method: 'PUT',
              headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Node.js Secret Upload Script',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json',
                'Content-Length': secretData.length
              }
            };

            const uploadReq = https.request(uploadOptions, (uploadRes) => {
              let uploadData = '';
              uploadRes.on('data', (chunk) => uploadData += chunk);
              uploadRes.on('end', () => {
                if (uploadRes.statusCode === 201 || uploadRes.statusCode === 204) {
                  resolve({ success: true });
                } else {
                  reject(new Error(`Failed to upload secret: ${uploadRes.statusCode} ${uploadData}`));
                }
              });
            });

            uploadReq.on('error', reject);
            uploadReq.write(secretData);
            uploadReq.end();

          }).catch(error => {
            reject(new Error(`Failed to encrypt secret: ${error.message}`));
          });
        });
      });

      keyReq.on('error', reject);
      keyReq.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

async function uploadAllSecrets(secrets, upload = false) {
  if (!upload) {
    log('\n🚀 Deployment Secrets (add these to GitHub repository secrets):', 'bright');
    log('================================================================\n', 'bright');

    Object.entries(secrets).forEach(([key, value]) => {
      log(`${key}=${value}`, 'cyan');
    });

    log('\n📖 How to add these to GitHub:', 'bright');
    log('1. Go to your repository on GitHub', 'blue');
    log('2. Settings → Secrets and variables → Actions', 'blue');
    log('3. Click "New repository secret" for each one above', 'blue');
    log('4. Copy the name and value exactly as shown', 'blue');
    log('\n💡 Or run with --upload flag to automatically upload them:', 'yellow');
    log('   npm run generate:secrets -- --upload', 'cyan');
    
    return secrets;
  }

  // Load .env file to get token
  loadEnvFile();
  
  // Check for GitHub token
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    throw new Error(`GitHub token not found! Set one of these environment variables:
    - GITHUB_TOKEN=your_token_here (as environment variable)
    - GH_TOKEN=your_token_here (as environment variable)
    - Add GITHUB_TOKEN=your_token to your .env file
    
Generate a token at: https://github.com/settings/tokens
Required scopes: repo, workflow`);
  }

  const repoInfo = getRepositoryInfo();
  
  log('\n🔄 Uploading secrets to GitHub repository...', 'bright');
  log(`📍 Repository: ${repoInfo.owner}/${repoInfo.repo}\n`, 'cyan');

  const uploadResults = [];
  for (const [secretName, secretValue] of Object.entries(secrets)) {
    try {
      await uploadSecretToGitHub(repoInfo.owner, repoInfo.repo, secretName, secretValue, token);
      log(`✅ Uploaded ${secretName}`, 'green');
      uploadResults.push({ name: secretName, success: true });
    } catch (error) {
      log(`❌ Failed to upload ${secretName}: ${error.message}`, 'red');
      uploadResults.push({ name: secretName, success: false, error: error.message });
    }
  }

  const successful = uploadResults.filter(r => r.success).length;
  const failed = uploadResults.filter(r => !r.success).length;

  log(`\n📊 Upload Summary:`, 'bright');
  log(`   ✅ Successful: ${successful}`, 'green');
  if (failed > 0) {
    log(`   ❌ Failed: ${failed}`, 'red');
  }

  return secrets;
}

function generateDeploymentSecrets(upload = false) {
  const deploymentSecrets = {
    // Environment-specific secrets for GitHub Actions
    DEV_DB_PASSWORD: generateSecurePassword(16),
    STAGING_DB_PASSWORD: generateSecurePassword(16),
    PRODUCTION_DB_PASSWORD: generateSecurePassword(16),
    
    DEV_COOKIE_SECRET: generateSecureCookieSecret(64),
    STAGING_COOKIE_SECRET: generateSecureCookieSecret(64),
    PRODUCTION_COOKIE_SECRET: generateSecureCookieSecret(64)
  };

  return uploadAllSecrets(deploymentSecrets, upload);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const uploadFlag = args.includes('--upload') || args.includes('-u');

  log('\n🔒 Secret Generator for Ventum Framework', 'bright');
  log('=====================================\n', 'bright');

  try {
    // Update local .env file
    const localSecrets = updateEnvFile();
    
    // Generate deployment secrets
    const deploymentSecrets = await generateDeploymentSecrets(uploadFlag);
    
    log('\n⚠️  Important Security Notes:', 'yellow');
    log('• Local secrets have been updated in your .env file', 'yellow');
    log('• Never commit secrets to version control', 'yellow');
    log('• Use different secrets for each environment', 'yellow');
    log('• Rotate secrets regularly in production', 'yellow');
    
    if (uploadFlag) {
      log('\n🎯 Next Steps:', 'bright');
      log('1. Add your DigitalOcean secrets manually:', 'blue');
      log('   - DO_ACCESS_TOKEN (DigitalOcean API token)', 'cyan');
      log('   - DO_SSH_KEY_FINGERPRINT (SSH key fingerprint)', 'cyan');
      log('   - DO_SSH_PRIVATE_KEY (SSH private key content)', 'cyan');
      log('2. Test deployment: npm run deploy:dev', 'blue');
    }
    
    log('\n✅ Secret generation completed successfully!', 'green');
    
  } catch (error) {
    log(`\n❌ Error generating secrets: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Show usage if --help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  log('\n🔐 Secret Generator', 'bright');
  log('==================\n', 'bright');
  log('Usage:', 'bright');
  log('  node scripts/generate-secrets.js                 # Generate and display secrets', 'cyan');
  log('  node scripts/generate-secrets.js --upload        # Generate and upload to GitHub', 'cyan');
  log('  npm run generate:secrets                         # Same as first option', 'cyan');
  log('  npm run generate:secrets -- --upload             # Same as second option', 'cyan');
  log('\nThis script will:', 'bright');
  log('  • Generate secure random passwords for local development', 'cyan');
  log('  • Update your .env file with new secrets', 'cyan');
  log('  • Display (or upload) deployment secrets for GitHub Actions', 'cyan');
  log('\nRequirements for --upload:', 'bright');
  log('  • GitHub Personal Access Token with repo and workflow scopes', 'yellow');
  log('  • Set as environment variable: GITHUB_TOKEN=your_token', 'yellow');
  log('  • Git repository with GitHub remote', 'yellow');
  log('\nMake sure to have a .env file (copy from .env.example) before running.', 'yellow');
  process.exit(0);
}

main().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});